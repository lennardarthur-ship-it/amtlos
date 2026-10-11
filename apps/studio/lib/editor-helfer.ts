/**
 * Hilfen für den Formular-Editor (ohne React, damit testbar).
 */
import type { Bedingung, Pflicht } from "@amtlos/rules-engine";

export interface Fakt {
  pfad: string;
  typ: string;
  werte?: string[];
  herleitung?: string;
}

export const OPS_FUER_TYP: Record<string, string[]> = {
  zahl: ["==", "!=", ">", ">=", "<", "<=", "in", "nicht_in"],
  betrag: ["==", "!=", ">", ">=", "<", "<="],
  ganzzahl: ["==", "!=", ">", ">=", "<", "<=", "in", "nicht_in"],
  bool: ["=="],
  datum: ["==", "!=", ">", ">=", "<", "<="],
  enum: ["==", "!=", "in", "nicht_in"],
  enum_liste: ["enthaelt", "enthaelt_eines"],
  text: ["==", "!=", "in", "nicht_in"],
};
export const IMMER = ["vorhanden", "nicht_vorhanden"];

export const OP_TEXT: Record<string, string> = {
  "==": "ist gleich",
  "!=": "ist ungleich",
  ">": "größer als",
  ">=": "mindestens",
  "<": "kleiner als",
  "<=": "höchstens",
  in: "ist eines von",
  nicht_in: "ist keines von",
  enthaelt: "enthält",
  enthaelt_eines: "enthält eines von",
  vorhanden: "ist angegeben",
  nicht_vorhanden: "ist nicht angegeben",
};

export const istZahlTyp = (typ: string) => typ === "zahl" || typ === "betrag" || typ === "ganzzahl";
export const brauchtListe = (op: string) => op === "in" || op === "nicht_in" || op === "enthaelt_eines";

/** Passender Startwert, wenn Fakt oder Operator gewechselt wird. */
export function startwert(fakt: Fakt | undefined, op: string): unknown {
  if (!fakt || IMMER.includes(op)) return undefined;
  if (brauchtListe(op)) return [];
  if (fakt.typ === "bool") return true;
  if (istZahlTyp(fakt.typ)) return 0;
  if (fakt.werte?.length) return fakt.werte[0];
  return "";
}

/** Neue Bedingung eines Typs. */
export function neueBedingung(art: "all" | "any" | "not" | "vergleich" | "ereignis" | "immer", fakten: Fakt[], ereignisse: string[]): Bedingung {
  switch (art) {
    case "all":
      return { all: [{ immer: true }] };
    case "any":
      return { any: [{ immer: true }] };
    case "not":
      return { not: { immer: true } };
    case "immer":
      return { immer: true };
    case "ereignis":
      return { ereignis: ereignisse[0] ?? "gruendung", op: "eingetreten" };
    case "vergleich": {
      const f = fakten[0]!;
      const op = (OPS_FUER_TYP[f.typ] ?? ["=="])[0]!;
      const w = startwert(f, op);
      return w === undefined ? { feld: f.pfad, op: op as never } : ({ feld: f.pfad, op, wert: w } as Bedingung);
    }
  }
}

export function bedingungsArt(b: Bedingung): "all" | "any" | "not" | "vergleich" | "ereignis" | "immer" {
  if ("all" in b) return "all";
  if ("any" in b) return "any";
  if ("not" in b) return "not";
  if ("immer" in b) return "immer";
  if ("ereignis" in b) return "ereignis";
  return "vergleich";
}

/** Tage-Liste ⇄ Erinnerungs-Dauern (Editor zeigt nur Tage). */
export function tageZuDauern(text: string): string[] {
  return text
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x))
    .map((x) => `P${Number(x)}D`);
}
export function dauernZuTage(d: string[] | undefined): string {
  return (d ?? []).map((x) => /^P(\d+)D$/.exec(x)?.[1] ?? x).join(", ");
}

/** ISO-Dauer in Zahl + Einheit für Eingabefelder (nur eine Einheit; sonst unverändert als Text). */
export function dauerZerlegen(d: string): { zahl: number; einheit: "D" | "W" | "M" | "Y"; negativ: boolean } | undefined {
  const m = /^(-)?P(\d+)([DWMY])$/.exec(d);
  return m ? { negativ: m[1] === "-", zahl: Number(m[2]), einheit: m[3] as "D" | "W" | "M" | "Y" } : undefined;
}
export function dauerBauen(zahl: number, einheit: string, negativ = false): string {
  return `${negativ ? "-" : ""}P${Math.max(0, Math.trunc(zahl))}${einheit}`;
}

/**
 * Leere optionale Angaben entfernen, bevor gespeichert wird: leere englische Texte, leere Listen,
 * leere Felder in Quellen. Pflichtfelder bleiben, auch leer – dann meldet die Prüfung sie.
 */
export function bereinigen(p: Record<string, unknown>): Record<string, unknown> {
  const text = (t: unknown) => {
    if (!t || typeof t !== "object") return t;
    const o = t as { de?: string; en?: string };
    return { de: o.de ?? "", ...(o.en?.trim() ? { en: o.en.trim() } : {}) };
  };
  const r: Record<string, unknown> = { ...p };
  for (const k of ["titel", "kurz", "erklaerung", "stelle", "aenderungsnotiz"]) if (r[k]) r[k] = text(r[k]);
  if (r.aenderungsnotiz && !(r.aenderungsnotiz as { de: string }).de.trim()) delete r.aenderungsnotiz;
  if (r.sanktion) r.sanktion = { ...(r.sanktion as object), text: text((r.sanktion as { text: unknown }).text) };
  if (r.kosten && typeof r.kosten === "object") {
    const k = r.kosten as { text?: { de?: string } };
    r.kosten = k.text?.de?.trim() ? { ...k, text: text(k.text) } : null;
  }
  for (const k of ["begriffe", "voraussetzungen", "branchen", "dokumente", "fachlich_zu_pruefen"]) {
    const v = r[k];
    if (Array.isArray(v)) {
      const gefiltert = k === "begriffe"
        ? (v as { begriff: { de: string }; erklaerung: { de: string } }[]).filter((b) => b.begriff.de.trim()).map((b) => ({ begriff: text(b.begriff), erklaerung: text(b.erklaerung) }))
        : (v as string[]).map((x) => (typeof x === "string" ? x.trim() : x)).filter(Boolean);
      if (gefiltert.length) r[k] = gefiltert;
      else delete r[k];
    }
  }
  if (Array.isArray(r.rechtsgrundlage)) r.rechtsgrundlage = (r.rechtsgrundlage as string[]).map((x) => x.trim()).filter(Boolean);
  if (Array.isArray(r.quellen))
    r.quellen = (r.quellen as { titel: string; url: string; abgerufen?: string | null; fundstelle?: string }[])
      .filter((q) => q.titel.trim() || q.url.trim())
      .map((q) => ({ titel: q.titel.trim(), url: q.url.trim(), abgerufen: q.abgerufen || null, ...(q.fundstelle?.trim() ? { fundstelle: q.fundstelle.trim() } : {}) }));
  if (!r.gueltig_bis) r.gueltig_bis = null;
  if (!r.gueltig_ab) r.gueltig_ab = null;
  if (!r.katalog_nr) delete r.katalog_nr;
  if (r.erneut_erledigen === false) delete r.erneut_erledigen;
  if (r.aktion && typeof r.aktion === "object" && !(r.aktion as { art?: string }).art) delete r.aktion;
  if (!["entwurf", "beschlossen", "geplant"].includes(String(r.status_recht))) delete r.radar;
  delete r.pruefung; // wird aus Freigaben abgeleitet (E-039)
  return r;
}

/** Vorlage für eine neue Pflicht – nur Platzhalter, die die Prüfung ohne Ausfüllen ablehnt. */
export function neuePflicht(id: string, kategorie: string): Pflicht {
  return {
    schema_version: 1,
    id,
    version: 1,
    titel: { de: "" },
    kurz: { de: "" },
    erklaerung: { de: "" },
    rechtsgrundlage: [""],
    kategorie,
    ausloeser: { immer: true },
    frist: { typ: "dauerhaft" },
    wiederholung: { art: "einmalig" },
    stelle: { de: "" },
    kanal: "intern_dokumentieren",
    kosten: null,
    sanktion: { text: { de: "" }, schwere: "mittel" },
    automatisierung: "hinweis",
    status_recht: "in_kraft",
    gueltig_ab: null,
    gueltig_bis: null,
    quellen: [{ titel: "", url: "", abgerufen: null }],
    fachlich_zu_pruefen: [],
  } as unknown as Pflicht;
}
