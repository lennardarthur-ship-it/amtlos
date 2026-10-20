/**
 * „Meine Unterlagen“ – reine Funktionen für Filter, Suche und die Summe offener Rechnungen (ohne Gerät testbar).
 */
import { eRechnungAus, fehlendeAngaben, kategorieFuer, summen, unterlagenName, vorlageFuer, type Beleg, type Betrieb, type Daten } from "@amtlos/fachlogik";
import { istGutschrift, offeneRechnungen } from "./ustAusRechnungen";
import { nummerDoppelt, type Stand, type Unterlage } from "./speicher";

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

/** Fälligkeit einer Rechnung nach ihrem eigenen Zahlungsziel (Rechnungsdatum + Tage; „sofort“ = Rechnungsdatum). */
export function faelligAm(u: Unterlage): string | null {
  const datum = typeof u.daten.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(u.daten.datum) ? u.daten.datum : null;
  const ziel = typeof u.daten.zahlungsziel === "string" ? u.daten.zahlungsziel : "";
  if (!datum || !ziel) return null;
  if (ziel === "sofort") return datum;
  const tage = Number(ziel);
  if (!Number.isFinite(tage)) return null;
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Tage, die eine offene Rechnung über ihrem Zahlungsziel ist (0 = nicht überfällig, bezahlt oder ohne Ziel). */
export function tageUeberfaellig(u: Unterlage, heute: string, offen: Set<string>): number {
  const am = offen.has(u.id) ? faelligAm(u) : null;
  if (!am || am >= heute) return 0;
  return Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${am}T12:00:00Z`)) / 864e5);
}

/** Offene (geteilte, unbezahlte, nicht stornierte) Rechnungen: Anzahl, Bruttosumme in Cent, davon überfällig. */
export function offeneSumme(unterlagen: Unterlage[], betrieb: Betrieb, heute?: string): { anzahl: number; cent: number; ueberfaellig: number } {
  const offen = offeneRechnungen(unterlagen).filter((u) => !istStorno(u));
  const cent = offen.reduce((a, u) => a + rechnungBrutto(u, betrieb), 0);
  const ids = new Set(offen.map((u) => u.id));
  return { anzahl: offen.length, cent, ueberfaellig: heute ? offen.filter((u) => tageUeberfaellig(u, heute, ids) > 0).length : 0 };
}

/** Ids der offenen Rechnungen (für Listen: einmal berechnen, je Zeile nachschlagen). */
export const offeneIds = (unterlagen: Unterlage[]) => new Set(offeneRechnungen(unterlagen).filter((u) => !istStorno(u)).map((u) => u.id));

/**
 * Im Monat berechnet (`monat` = JJJJ-MM, nach Rechnungsdatum): geteilte Rechnungen brutto, Stornorechnungen ziehen ab.
 * `anzahl` zählt die Rechnungen ohne Stornos. Gutschriften sind Ausgaben und zählen nicht.
 */
export function monatsSumme(unterlagen: Unterlage[], betrieb: Betrieb, monat: string): { anzahl: number; cent: number } {
  const im = unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string" && u.daten.datum.startsWith(monat) && !istGutschrift(u));
  return { anzahl: im.filter((u) => !istStorno(u)).length, cent: im.reduce((a, u) => a + rechnungBrutto(u, betrieb), 0) };
}

/** Rechnungen: neueste Rechnung zuerst (Rechnungsdatum, dann Nummer) – eine Zahlung ändert die Reihenfolge nicht. */
export function rechnungenSortiert(l: Unterlage[]): Unterlage[] {
  const d = (u: Unterlage) => (typeof u.daten.datum === "string" ? u.daten.datum : u.erstellt.slice(0, 10));
  const n = (u: Unterlage) => (typeof u.daten.nummer === "string" ? u.daten.nummer : "");
  return [...l].sort((a, b) => d(b).localeCompare(d(a)) || n(b).localeCompare(n(a), "de", { numeric: true }));
}

// einmal angelegt (R9 Performance) – je Aufruf neu wäre rund 70× langsamer
const EURO = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const euroText = (cent: number) => `${EURO.format(cent / 100)} €`;

/**
 * Fehlende Pflichtangaben je Inhalt (`u.daten`) und Betrieb: Nach einem Tastendruck ist nur die bearbeitete Unterlage
 * ein neues Objekt – alle anderen kommen aus dem Zwischenspeicher (R9 Performance: vorher 2.300 × fehlendeAngaben je Taste).
 */
const angabenZwischen = new WeakMap<Daten, { betrieb: Betrieb; anzahl: number }>();
const fehltZwischen = new WeakMap<Unterlage[], { betrieb: Betrieb; je: Map<string, number> }>();

/** Anzahl fehlender Angaben (Pflichtangaben plus doppelte Nummer) – dasselbe wie `fehltFuer(s, u).length`. */
export function fehltAnzahl(s: Pick<Stand, "unterlagen" | "betrieb">, u: Unterlage): number {
  const v = vorlageFuer(u.vorlage);
  if (!v) return 0;
  let a = angabenZwischen.get(u.daten);
  if (!a || a.betrieb !== s.betrieb) {
    a = { betrieb: s.betrieb, anzahl: fehlendeAngaben(v, u.daten, s.betrieb).length };
    angabenZwischen.set(u.daten, a);
  }
  return a.anzahl + (nummerDoppelt(s as Stand, u) ? 1 : 0);
}

/** Fehlende Angaben je Unterlage – einmal je Stand für alle Seiten berechnet, nicht in jeder Zeile. */
export function fehltJeBerechnen(s: Pick<Stand, "unterlagen" | "betrieb">): Map<string, number> {
  const da = fehltZwischen.get(s.unterlagen);
  if (da?.betrieb === s.betrieb) return da.je;
  const je = new Map(s.unterlagen.map((u) => [u.id, fehltAnzahl(s, u)]));
  fehltZwischen.set(s.unterlagen, { betrieb: s.betrieb, je });
  return je;
}
