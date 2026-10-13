/**
 * „Meine Unterlagen“ – reine Funktionen für Filter, Suche und die Summe offener Rechnungen (ohne Gerät testbar).
 */
import { eRechnungAus, summen, unterlagenName, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { offeneRechnungen } from "./ustAusRechnungen";
import type { Unterlage } from "./speicher";

export type Filter = "alle" | "rechnungen" | "offen" | "entwuerfe";

const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/** Welche Filter sich lohnen: „Rechnungen“ erst, wenn es welche gibt, „Offen“ nur mit offenen Rechnungen, „Entwürfe“ nur mit Entwürfen. */
export function filterVerfuegbar(unterlagen: Unterlage[]): Filter[] {
  const f: Filter[] = ["alle"];
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
    if (!s) return true;
    const v = vorlageFuer(u.vorlage);
    const text = [v ? unterlagenName(v, u.daten) : "", u.daten.kunde_name, u.daten.nummer, u.daten.bereich, u.daten.arbeitsbereich].filter((x): x is string => typeof x === "string").join(" ").toLocaleLowerCase("de");
    return text.includes(s);
  });
}

/** Offene (geteilte, unbezahlte, nicht stornierte) Rechnungen: Anzahl und Bruttosumme in Cent. */
export function offeneSumme(unterlagen: Unterlage[], betrieb: Betrieb): { anzahl: number; cent: number } {
  const offen = offeneRechnungen(unterlagen).filter((u) => !istStorno(u));
  const cent = offen.reduce((a, u) => {
    const { daten } = eRechnungAus(u.daten, betrieb);
    return a + summen(daten.positionen, daten.kleinunternehmer).brutto_cent;
  }, 0);
  return { anzahl: offen.length, cent };
}

export const euroText = (cent: number) => `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100)} €`;
