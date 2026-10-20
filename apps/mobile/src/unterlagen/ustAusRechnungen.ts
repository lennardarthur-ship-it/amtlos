/**
 * Rechnungen speisen die Umsatzsteuer-Voranmeldung (E-128, seit E-129 nach dem richtigen Zeitpunkt):
 * - Soll (vereinbarte Entgelte, § 13 Abs. 1 Nr. 1 a UStG): Zeitraum, in dem die Leistung ausgeführt wurde –
 *   also nach dem Leistungsdatum der Rechnung. Eine Stornorechnung mindert im Zeitraum des Stornos (§ 17 UStG).
 * - Ist (vereinnahmte Entgelte, § 13 Abs. 1 Nr. 1 b, § 20 UStG): Zeitraum, in dem das Geld eingegangen ist – nach dem
 *   Zahlungseingang, den du an der Rechnung vermerkst. Unbezahlte Rechnungen zählen nicht; eine Stornorechnung zählt
 *   erst, wenn du die Erstattung vermerkst.
 * Nur festgeschriebene (geteilte) Rechnungen zählen – Entwürfe sind nicht raus. Gutschriften zählen nicht: Der Betrieb
 * rechnet darin als Leistungsempfänger ab, sie sind keine eigenen Umsätze. Kleinunternehmer (§ 19 UStG) übernehmen
 * nichts – ihre Umsätze gehören in keine Kennzahl der Voranmeldung. Fachlich zu prüfen: T-70.
 */
import { eRechnungAus, umsaetzeNachSatz, ustZeitraum, vorsteuerFuer, type Beleg, type Betrieb } from "@amtlos/fachlogik";
import type { Unterlage } from "./speicher";

export type Versteuerung = "soll" | "ist";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function periodeText(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) return `${MONATE[Number(m[2]) - 1]} ${m[1]}`;
  const q = /^(\d{4})-Q([1-4])$/.exec(p);
  return q ? `${q[2]}. Quartal ${q[1]}` : p;
}

const betragText = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);

/**
 * Gutschrift (Hinweis „gutschrift“, § 14 Abs. 2 Satz 2 UStG): Der Betrieb rechnet als Leistungsempfänger selbst ab –
 * für ihn ist das eine Ausgabe, keine Einnahme. Gutschriften (und ihre Stornos) zählen deshalb nicht als Umsatz.
 */
export const istGutschrift = (u: Unterlage) => Array.isArray(u.daten.hinweise) && u.daten.hinweise.some((h) => h === "gutschrift");

/** Steht bei der EÜR-Übernahme und im Steuerberater-Paket, sobald Gutschriften dabei sind. */
export const GUTSCHRIFT_HINWEIS = "Gutschriften sind Ausgaben – bitte als Beleg erfassen bzw. von der Steuerberatung buchen lassen.";

const gestellt = (unterlagen: Unterlage[]) => unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string");
/** Geteilte Rechnungen, die Umsätze sind (ohne Gutschriften). */
const festeRechnungen = (unterlagen: Unterlage[]) => gestellt(unterlagen).filter((u) => !istGutschrift(u));
const kuRechnung = (u: Unterlage) => u.daten.kleinunternehmer === true;

interface Zuordnung {
  u: Unterlage;
  /** Tag, nach dem die Rechnung einem Zeitraum zugeordnet wird – null: zählt (noch) nicht */
  tag: string | null;
  /** Soll ohne eindeutiges Leistungsdatum: nach Rechnungsdatum zugeordnet */
  ersatz: boolean;
}

function zuordnen(u: Unterlage, v: Versteuerung, betrieb: Betrieb): Zuordnung {
  const storno = typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";
  if (v === "ist") return { u, tag: u.bezahlt ?? null, ersatz: false };
  if (storno) return { u, tag: u.daten.datum as string, ersatz: false };
  const leistung = eRechnungAus(u.daten, betrieb).daten.leistungsdatum;
  return leistung ? { u, tag: leistung, ersatz: false } : { u, tag: u.daten.datum as string, ersatz: true };
}

const periodenVon = (tag: string) => [tag.slice(0, 7), `${tag.slice(0, 4)}-Q${Math.floor((Number(tag.slice(5, 7)) - 1) / 3) + 1}`];

/** Monate und Quartale mit zuordenbaren Rechnungen – neueste zuerst. */
export function perioden(unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung = "soll", belege: Beleg[] = []): string[] {
  const set = new Set<string>();
  // Vorsteuer aus Belegen zählt nach Belegdatum (E-133) – auch Zeiträume nur mit Belegen
  for (const b of belege) for (const p of periodenVon(b.datum)) set.add(p);
  for (const u of festeRechnungen(unterlagen)) {
    const z = zuordnen(u, v, betrieb);
    if (z.tag) for (const p of periodenVon(z.tag)) set.add(p);
  }
  return [...set].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1));
}

/** Festgeschriebene Rechnungen ohne vermerkten Zahlungseingang (nicht storniert, keine Stornorechnung, keine Gutschrift). */
export const offeneRechnungen = (unterlagen: Unterlage[]) => festeRechnungen(unterlagen).filter((u) => !u.bezahlt && !u.storniertDurch && !(typeof u.daten.storno_zu === "string" && u.daten.storno_zu));

export interface UstUebernahme {
  werte: Record<string, string>;
  anzahl: number;
  /** Soll: so viele Rechnungen ohne eindeutiges Leistungsdatum, nach Rechnungsdatum zugeordnet */
  ersatz: number;
  /** Ist: so viele geteilte Rechnungen ohne Zahlungseingang (zählen nicht) */
  offen: number;
  /** Belege mit Vorsteuer im Zeitraum und solche mit Umsatzsteuer, aber ohne Vorsteuerabzug (E-133) */
  vorsteuerBelege: number;
  ohneVorsteuer: number;
  /** Kleinunternehmer: nichts übernommen (`werte` enthält nur den Zeitraum) */
  kleinunternehmer: boolean;
  /** Gutschriften im Zeitraum – keine Umsätze, nicht übernommen */
  gutschriften: number;
}

/**
 * Felder der Voranmeldung für einen Zeitraum („JJJJ-MM“ oder „JJJJ-Qn“). `kleinunternehmer`: Antwort im Pflichten-Check
 * („ust.kleinunternehmer“); ohne Antwort gilt als Kleinunternehmer, wessen Rechnungen im Zeitraum alle Kleinunternehmer-
 * Rechnungen sind. Dann wird nichts übernommen – auch keine Vorsteuer.
 */
export function umsaetzeFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb, v: Versteuerung = "soll", belege: Beleg[] = [], kleinunternehmer?: boolean): UstUebernahme | null {
  const z = ustZeitraum(periode);
  if (!z) return null;
  const imZeitraum = (u: Unterlage) => {
    const x = zuordnen(u, v, betrieb);
    return x.tag !== null && x.tag >= z.von && x.tag <= z.bis;
  };
  const gutschriften = gestellt(unterlagen).filter((u) => istGutschrift(u) && imZeitraum(u)).length;
  const alle = festeRechnungen(unterlagen)
    .map((u) => zuordnen(u, v, betrieb))
    .filter((x) => x.tag && x.tag >= z.von && x.tag <= z.bis);
  const ku = kleinunternehmer ?? (alle.length > 0 && alle.every((x) => kuRechnung(x.u)));
  if (ku) return { werte: { zeitraum: periodeText(periode) }, anzahl: 0, ersatz: 0, offen: 0, vorsteuerBelege: 0, ohneVorsteuer: 0, kleinunternehmer: true, gutschriften };
  // einzelne Kleinunternehmer-Rechnungen (z. B. aus der Zeit vor dem Wechsel zur Regelbesteuerung) zählen nicht mit
  const im = alle.filter((x) => !kuRechnung(x.u));
  const gruppen = umsaetzeNachSatz(
    im.map(({ u }) => {
      const { daten } = eRechnungAus(u.daten, betrieb);
      return { art: daten.art ?? "rechnung", kleinunternehmer: daten.kleinunternehmer, positionen: daten.positionen };
    }),
  );
  const summe = (f: (s: number | null) => boolean) => gruppen.filter((g) => f(g.satz)).reduce((a, g) => a + g.netto_cent, 0);
  const vst = vorsteuerFuer(belege, z.von, z.bis);
  return {
    vorsteuerBelege: vst.anzahl,
    ohneVorsteuer: vst.ohne,
    anzahl: im.length,
    ersatz: im.filter((x) => x.ersatz).length,
    offen: v === "ist" ? offeneRechnungen(unterlagen).length : 0,
    kleinunternehmer: false,
    gutschriften,
    werte: { zeitraum: periodeText(periode), umsatz_19: betragText(summe((s) => s === 19)), umsatz_7: betragText(summe((s) => s === 7)), umsatz_frei: betragText(summe((s) => s === null || s === 0)), ...(belege.length ? { vorsteuer: betragText(vst.cent) } : {}) },
  };
}
