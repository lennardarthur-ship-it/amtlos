import type { Bedingung, Frist, Wert } from "./typen.js";

/**
 * Bedingungen und Fristen als deutscher Klartext – für den Studio-Editor (Vorschau „gilt, wenn …“)
 * und für Prüferinnen und Prüfer, die keine Regel-Syntax lesen sollen.
 * Beschreibt nur die Struktur, keine Bewertung; Labels der Redaktion haben Vorrang.
 */
export interface Gliederung {
  text: string;
  kinder: Gliederung[];
}

const OP: Record<string, string> = {
  "==": "ist",
  "!=": "ist nicht",
  ">": "ist größer als",
  ">=": "ist mindestens",
  "<": "ist kleiner als",
  "<=": "ist höchstens",
  in: "ist eines von",
  nicht_in: "ist keines von",
  enthaelt: "enthält",
  enthaelt_eines: "enthält mindestens eines von",
  vorhanden: "ist angegeben",
  nicht_vorhanden: "ist nicht angegeben",
};

export function wertAlsText(w: Wert | undefined): string {
  if (w === undefined) return "";
  if (typeof w === "boolean") return w ? "ja" : "nein";
  if (Array.isArray(w)) return w.map(String).join(", ");
  if (typeof w === "object") return `Regelwert „${w.regelwert}“${w.faktor !== undefined ? ` × ${String(w.faktor).replace(".", ",")}` : ""}`;
  if (typeof w === "number") return w.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return String(w);
}

export function bedingungGliederung(b: Bedingung): Gliederung {
  const label = "label" in b && b.label ? ` („${b.label.de}“)` : "";
  if ("all" in b) return { text: `alle folgenden treffen zu${label}`, kinder: b.all.map(bedingungGliederung) };
  if ("any" in b) return { text: `mindestens eines der folgenden trifft zu${label}`, kinder: b.any.map(bedingungGliederung) };
  if ("not" in b) return { text: `das Folgende trifft nicht zu${label}`, kinder: [bedingungGliederung(b.not)] };
  if ("immer" in b) return { text: "immer (für jedes Unternehmen)", kinder: [] };
  if ("ereignis" in b) {
    const zeit = b.innerhalb ? ` innerhalb von ${dauerAlsText(b.innerhalb)}` : "";
    const art = b.op === "eingetreten" ? "ist eingetreten" : b.op === "nicht_eingetreten" ? "ist nicht eingetreten" : "ist geplant";
    return { text: `Ereignis „${b.ereignis}“ ${art}${zeit}${label}`, kinder: [] };
  }
  const wert = b.op === "vorhanden" || b.op === "nicht_vorhanden" ? "" : ` ${wertAlsText(b.wert)}`;
  return { text: `${b.feld} ${OP[b.op] ?? b.op}${wert}${label}`, kinder: [] };
}

/** Gliederung als eingerückter Text (für Tests und Exporte). */
export function gliederungAlsText(g: Gliederung, tiefe = 0): string {
  return [`${"  ".repeat(tiefe)}- ${g.text}`, ...g.kinder.map((k) => gliederungAlsText(k, tiefe + 1))].join("\n");
}

const EINHEIT: Record<string, [string, string]> = { Y: ["Jahr", "Jahre"], M: ["Monat", "Monate"], W: ["Woche", "Wochen"], D: ["Tag", "Tage"] };

export function dauerAlsText(d: string): string {
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(d);
  if (!m) return d;
  const teile = (["Y", "M", "W", "D"] as const)
    .map((e, i) => [Number(m[i + 2] ?? 0), e] as const)
    .filter(([n]) => n > 0)
    .map(([n, e]) => `${n} ${n === 1 ? EINHEIT[e]![0] : EINHEIT[e]![1]}`);
  if (!teile.length) return "0 Tage";
  return `${m[1] ? "minus " : ""}${teile.join(" ")}`;
}

const VERSCHIEBUNG: Record<string, string> = {
  keine: "keine Verschiebung",
  naechster_werktag: "auf den nächsten Werktag",
  naechster_bankarbeitstag: "auf den nächsten Bankarbeitstag",
  vorheriger_werktag: "auf den vorherigen Werktag",
  vorheriger_bankarbeitstag: "auf den vorherigen Bankarbeitstag",
};

export function fristAlsText(f: Frist): string {
  switch (f.typ) {
    case "dauerhaft":
      return "laufende Pflicht ohne Termin";
    case "absolut":
      return `am ${f.datum} (${VERSCHIEBUNG[f.verschiebung.regel]})`;
    case "relativ": {
      const bezug = "ereignis" in f.bezug ? `Ereignis „${f.bezug.ereignis}“` : "fakt" in f.bezug ? `Datum „${f.bezug.fakt}“` : `Erledigung von „${f.bezug.pflicht_erledigt}“`;
      const wann = f.zeitpunkt === "vor_beginn" ? `vor ${bezug}` : `${dauerAlsText(f.versatz)} nach ${bezug}`;
      return `${wann} (${VERSCHIEBUNG[f.verschiebung.regel]})`;
    }
    case "wiederkehrend": {
      const r = typeof f.rhythmus === "string" ? f.rhythmus : `${[...new Set(f.rhythmus.waehle.map((w) => w.dann))].join(" oder ")}, sonst ${f.rhythmus.sonst}${f.rhythmus.je_jahr ? " (je Kalenderjahr)" : ""}`;
      const fa = f.faellig;
      const faellig =
        fa.art === "tag_nach_periodenende"
          ? `am ${fa.tag}. des ${fa.monate_nach ?? 1}. Monats nach Zeitraumende`
          : fa.art === "feste_termine"
            ? `an festen Terminen (${fa.termine.join(", ")})`
            : `am ${fa.n}.-letzten Bankarbeitstag${fa.arbeitstage_vorher ? `, ${fa.arbeitstage_vorher} Arbeitstage vorher` : ""}`;
      const verl = f.verlaengerung ? `, verlängert um ${dauerAlsText(f.verlaengerung.versatz)} wenn eine Bedingung zutrifft` : "";
      return `${r}, ${faellig}${verl} (${VERSCHIEBUNG[f.verschiebung.regel]})`;
    }
  }
}
