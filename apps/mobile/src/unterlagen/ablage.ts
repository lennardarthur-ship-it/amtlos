/**
 * „Meine Unterlagen“ – reine Funktionen für Filter, Suche und die Summe offener Rechnungen (ohne Gerät testbar).
 */
import { eRechnungAus, kategorieFuer, summen, unterlagenName, vorlageFuer, type Beleg, type Betrieb } from "@amtlos/fachlogik";
import { offeneRechnungen } from "./ustAusRechnungen";
import type { Unterlage } from "./speicher";

export type Filter = "alle" | "rechnungen" | "offen" | "entwuerfe" | "belege";

const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/** Welche Filter sich lohnen: „Rechnungen“ erst, wenn es welche gibt, „Offen“ nur mit offenen Rechnungen, „Entwürfe“ nur mit Entwürfen. */
export function filterVerfuegbar(unterlagen: Unterlage[], belege = 0): Filter[] {
  const f: Filter[] = ["alle"];
  if (belege) f.push("belege");
  if (unterlagen.some((u) => u.vorlage === "rechnung")) f.push("rechnungen");
  if (offeneRechnungen(unterlagen).length) f.push("offen");
  if (unterlagen.some((u) => !u.festgeschrieben)) f.push("entwuerfe");
  return f;
}

/** Unterlagen nach Filter und Suchtext (Name der Unterlage, Nummer, Kundenname). */
export function filtern(unterlagen: Unterlage[], filter: Filter, suche = ""): Unterlage[] {
  const s = suche.trim().toLocaleLowerCase("de");
  const offen = new Set(offeneRechnungen(unterlagen).map((u) => u.id));
  return unterlagen.filter((u) => {
    if (filter === "rechnungen" && u.vorlage !== "rechnung") return false;
    if (filter === "offen" && !offen.has(u.id)) return false;
    if (filter === "entwuerfe" && u.festgeschrieben) return false;
    if (filter === "belege") return false;
    if (!s) return true;
    const v = vorlageFuer(u.vorlage);
    const text = [v ? unterlagenName(v, u.daten) : "", u.daten.kunde_name, u.daten.nummer, u.daten.bereich, u.daten.arbeitsbereich].filter((x): x is string => typeof x === "string").join(" ").toLocaleLowerCase("de");
    return text.includes(s);
  });
}

/** Belege nach Suchtext (Lieferant, Nummer, Kategorie), neueste zuerst. */
export function belegeFiltern(belege: Beleg[], suche = ""): Beleg[] {
  const s = suche.trim().toLocaleLowerCase("de");
  return [...belege]
    .filter((b) => !s || [b.lieferant, b.nummer ?? "", kategorieFuer(b.kategorie).titel, b.notiz ?? ""].join(" ").toLocaleLowerCase("de").includes(s))
    .sort((a, b) => b.datum.localeCompare(a.datum) || b.geaendert.localeCompare(a.geaendert));
}

// Bruttobetrag je Rechnungsinhalt zwischengespeichert – Listen fragen ihn für jede Zeile ab
const bruttoZwischen = new WeakMap<object, number>();

/** Rechnungsbetrag brutto in Cent (bei Storno negativ). */
export function rechnungBrutto(u: Unterlage, betrieb: Betrieb): number {
  const da = bruttoZwischen.get(u.daten);
  if (da !== undefined) return da;
  const { daten } = eRechnungAus(u.daten, betrieb);
  const c = summen(daten.positionen, daten.kleinunternehmer).brutto_cent * (daten.art === "storno" ? -1 : 1);
  bruttoZwischen.set(u.daten, c);
  return c;
}

/** Offene (geteilte, unbezahlte, nicht stornierte) Rechnungen: Anzahl und Bruttosumme in Cent. */
export function offeneSumme(unterlagen: Unterlage[], betrieb: Betrieb): { anzahl: number; cent: number } {
  const offen = offeneRechnungen(unterlagen).filter((u) => !istStorno(u));
  const cent = offen.reduce((a, u) => a + rechnungBrutto(u, betrieb), 0);
  return { anzahl: offen.length, cent };
}

/** Rechnungen: neueste Rechnung zuerst (Rechnungsdatum, dann Nummer) – eine Zahlung ändert die Reihenfolge nicht. */
export function rechnungenSortiert(l: Unterlage[]): Unterlage[] {
  const d = (u: Unterlage) => (typeof u.daten.datum === "string" ? u.daten.datum : u.erstellt.slice(0, 10));
  const n = (u: Unterlage) => (typeof u.daten.nummer === "string" ? u.daten.nummer : "");
  return [...l].sort((a, b) => d(b).localeCompare(d(a)) || n(b).localeCompare(n(a), "de", { numeric: true }));
}

export const euroText = (cent: number) => `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100)} €`;
