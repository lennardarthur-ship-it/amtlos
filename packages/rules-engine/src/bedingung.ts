import { minusDauer, vergleiche, type Datum } from "@amtlos/fristen";
import { ausBool, nicht, oder, und } from "./logik.js";
import type { AufgeloesterRegelwert, Regelwerte } from "./regelwerte.js";
import type { Bedingung, Ereignis, Ergebnis, Fakten, Operator, Text, Wert } from "./typen.js";

/** Ein Knoten im Begründungsbaum. Wird gespeichert (pflicht_instanz.begruendung) und angezeigt. */
export type Knoten =
  | { art: "all" | "any" | "not"; ergebnis: Ergebnis; label?: Text; kinder: Knoten[] }
  | { art: "immer"; ergebnis: "gilt" }
  | {
      art: "vergleich";
      ergebnis: Ergebnis;
      label?: Text;
      feld: string;
      op: Operator;
      ist: unknown;
      soll?: unknown;
      regelwert?: AufgeloesterRegelwert & { faktor?: number };
      /** Warum unbekannt: Fakt fehlt, Regelwert fehlt oder Fakt hat falschen Typ */
      fehlt?: "fakt" | "regelwert" | "typ";
    }
  | {
      art: "ereignis";
      ergebnis: Ergebnis;
      label?: Text;
      ereignis: string;
      op: "eingetreten" | "nicht_eingetreten" | "geplant";
      innerhalb?: string;
      gefunden?: Datum;
      /** E-206: „eingetreten“ durch ein geplantes (künftiges) Ereignis, an dem die Frist der Pflicht hängt */
      geplant?: true;
    };

export interface Auswertungskontext {
  fakten: Fakten;
  ereignisse: readonly Ereignis[];
  stichtag: Datum;
  regelwerte: Regelwerte;
  /**
   * E-206: Ereignistyp, an dem die Frist der gerade ausgewerteten Pflicht hängt (Frist „relativ“ mit Bezug auf das
   * Ereignis). Für diesen Typ zählt bei „eingetreten“ (ohne „innerhalb“) auch ein geplantes Ereignis: Die Frist läuft
   * spätestens mit dem Ereignis ab (z. B. Sofortmeldung am ersten Arbeitstag) – wer die Einstellung erst plant, muss
   * die Pflicht vorher sehen, nicht als „trifft nicht zu“.
   */
  geplantZaehlt?: string;
}

const bekannt = (x: unknown): boolean => x !== undefined && x !== null;

function vergleiche2(op: Operator, ist: unknown, soll: unknown): Ergebnis | "typ" {
  switch (op) {
    case "vorhanden":
      return ausBool(bekannt(ist));
    case "nicht_vorhanden":
      return ausBool(!bekannt(ist));
    case "==":
      return ausBool(ist === soll);
    case "!=":
      return ausBool(ist !== soll);
    case ">":
    case ">=":
    case "<":
    case "<=": {
      const zahl = typeof ist === "number" && typeof soll === "number";
      const text = typeof ist === "string" && typeof soll === "string"; // Datumswerte (ISO) sind lexikographisch vergleichbar
      if (!zahl && !text) return "typ";
      const c = zahl ? Math.sign((ist as number) - (soll as number)) : vergleiche(ist as string, soll as string);
      return ausBool(op === ">" ? c > 0 : op === ">=" ? c >= 0 : op === "<" ? c < 0 : c <= 0);
    }
    case "in":
    case "nicht_in": {
      if (!Array.isArray(soll)) return "typ";
      const drin = soll.includes(ist as never);
      return ausBool(op === "in" ? drin : !drin);
    }
    case "enthaelt":
      return Array.isArray(ist) ? ausBool(ist.includes(soll)) : "typ";
    case "enthaelt_eines":
      return Array.isArray(ist) && Array.isArray(soll) ? ausBool(soll.some((s) => ist.includes(s))) : "typ";
  }
}

function istVerweis(w: Wert | undefined): w is { regelwert: string; faktor?: number } {
  return typeof w === "object" && w !== null && !Array.isArray(w) && "regelwert" in w;
}

export function werteAus(b: Bedingung, ctx: Auswertungskontext): Knoten {
  if ("all" in b) {
    const kinder = b.all.map((x) => werteAus(x, ctx));
    return { art: "all", ergebnis: und(kinder.map((k) => k.ergebnis)), kinder, ...(b.label ? { label: b.label } : {}) };
  }
  if ("any" in b) {
    const kinder = b.any.map((x) => werteAus(x, ctx));
    return { art: "any", ergebnis: oder(kinder.map((k) => k.ergebnis)), kinder, ...(b.label ? { label: b.label } : {}) };
  }
  if ("not" in b) {
    const kind = werteAus(b.not, ctx);
    return { art: "not", ergebnis: nicht(kind.ergebnis), kinder: [kind], ...(b.label ? { label: b.label } : {}) };
  }
  if ("immer" in b) return { art: "immer", ergebnis: "gilt" };

  if ("ereignis" in b) {
    const ab = b.innerhalb ? minusDauer(ctx.stichtag, b.innerhalb) : undefined;
    const passend = ctx.ereignisse.filter((e) => e.typ === b.ereignis && !e.storniert);
    const vergangen = passend.filter(
      (e) => vergleiche(e.datum, ctx.stichtag) <= 0 && (ab === undefined || vergleiche(e.datum, ab) > 0),
    );
    const zukuenftig = passend.filter((e) => vergleiche(e.datum, ctx.stichtag) > 0);
    const mitGeplant = b.op === "eingetreten" && !b.innerhalb && ctx.geplantZaehlt === b.ereignis && vergangen.length === 0 && zukuenftig.length > 0;
    const treffer = b.op === "geplant" || mitGeplant ? zukuenftig : vergangen;
    const ergebnis = b.op === "nicht_eingetreten" ? ausBool(treffer.length === 0) : ausBool(treffer.length > 0);
    const gefunden = treffer.map((e) => e.datum).sort()[0];
    return {
      art: "ereignis",
      ergebnis,
      ereignis: b.ereignis,
      op: b.op,
      ...(b.innerhalb ? { innerhalb: b.innerhalb } : {}),
      ...(gefunden ? { gefunden } : {}),
      ...(mitGeplant ? { geplant: true as const } : {}),
      ...(b.label ? { label: b.label } : {}),
    };
  }

  // Vergleich über einen Fakt
  const ist = ctx.fakten[b.feld];
  const basis = { art: "vergleich" as const, feld: b.feld, op: b.op, ist: ist ?? null, ...(b.label ? { label: b.label } : {}) };

  if (b.op === "vorhanden" || b.op === "nicht_vorhanden") {
    return { ...basis, ergebnis: vergleiche2(b.op, ist, undefined) as Ergebnis };
  }

  let soll: unknown = b.wert;
  let regelwert: (AufgeloesterRegelwert & { faktor?: number }) | undefined;
  if (istVerweis(b.wert)) {
    const rw = ctx.regelwerte.zumStichtag(b.wert.regelwert, ctx.stichtag);
    if (!rw) return { ...basis, ergebnis: "unbekannt", fehlt: "regelwert", soll: { regelwert: b.wert.regelwert } };
    const faktor = b.wert.faktor;
    regelwert = { ...rw, ...(faktor !== undefined ? { faktor } : {}) };
    soll = faktor !== undefined ? Math.round(rw.wert * faktor * 100) / 100 : rw.wert;
  }

  if (!bekannt(ist)) return { ...basis, ergebnis: "unbekannt", fehlt: "fakt", soll, ...(regelwert ? { regelwert } : {}) };
  const r = vergleiche2(b.op, ist, soll);
  if (r === "typ") return { ...basis, ergebnis: "unbekannt", fehlt: "typ", soll, ...(regelwert ? { regelwert } : {}) };
  return { ...basis, ergebnis: r, soll, ...(regelwert ? { regelwert } : {}) };
}

/** Fakten, deren Fehlen das Ergebnis "unbekannt" verursacht (nur entscheidungsrelevante Zweige). */
export function fehlendeFakten(k: Knoten): string[] {
  if (k.ergebnis !== "unbekannt") return [];
  if (k.art === "vergleich") return k.fehlt === "fakt" || k.fehlt === "typ" ? [k.feld] : [];
  if (k.art === "all" || k.art === "any" || k.art === "not") return [...new Set(k.kinder.flatMap(fehlendeFakten))];
  return [];
}

export function genutzteRegelwerte(k: Knoten): { id: string; version: number }[] {
  const liste: { id: string; version: number }[] = [];
  const besuche = (n: Knoten) => {
    if (n.art === "vergleich" && n.regelwert) liste.push({ id: n.regelwert.id, version: n.regelwert.version });
    if (n.art === "all" || n.art === "any" || n.art === "not") n.kinder.forEach(besuche);
  };
  besuche(k);
  return liste.filter((x, i) => liste.findIndex((y) => y.id === x.id && y.version === x.version) === i);
}
