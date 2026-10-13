/**
 * Rechnungen speisen die Umsatzsteuer-Voranmeldung (E-128, seit E-129 nach dem richtigen Zeitpunkt):
 * - Soll (vereinbarte Entgelte, § 13 Abs. 1 Nr. 1 a UStG): Zeitraum, in dem die Leistung ausgeführt wurde –
 *   also nach dem Leistungsdatum der Rechnung. Eine Stornorechnung mindert im Zeitraum des Stornos (§ 17 UStG).
 * - Ist (vereinnahmte Entgelte, § 13 Abs. 1 Nr. 1 b, § 20 UStG): Zeitraum, in dem das Geld eingegangen ist – nach dem
 *   Zahlungseingang, den du an der Rechnung vermerkst. Unbezahlte Rechnungen zählen nicht; eine Stornorechnung zählt
 *   erst, wenn du die Erstattung vermerkst.
 * Nur festgeschriebene (geteilte) Rechnungen zählen – Entwürfe sind nicht raus. Fachlich zu prüfen: T-70.
 */
import { eRechnungAus, umsaetzeNachSatz, ustZeitraum, type Betrieb } from "@amtlos/fachlogik";
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

const festeRechnungen = (unterlagen: Unterlage[]) => unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string");

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
export function perioden(unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung = "soll"): string[] {
  const set = new Set<string>();
  for (const u of festeRechnungen(unterlagen)) {
    const z = zuordnen(u, v, betrieb);
    if (z.tag) for (const p of periodenVon(z.tag)) set.add(p);
  }
  return [...set].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1));
}

/** Festgeschriebene Rechnungen ohne vermerkten Zahlungseingang (nicht storniert, keine Stornorechnung). */
export const offeneRechnungen = (unterlagen: Unterlage[]) => festeRechnungen(unterlagen).filter((u) => !u.bezahlt && !u.storniertDurch && !(typeof u.daten.storno_zu === "string" && u.daten.storno_zu));

export interface UstUebernahme {
  werte: Record<string, string>;
  anzahl: number;
  /** Soll: so viele Rechnungen ohne eindeutiges Leistungsdatum, nach Rechnungsdatum zugeordnet */
  ersatz: number;
  /** Ist: so viele geteilte Rechnungen ohne Zahlungseingang (zählen nicht) */
  offen: number;
}

/** Felder der Voranmeldung für einen Zeitraum („JJJJ-MM“ oder „JJJJ-Qn“). */
export function umsaetzeFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb, v: Versteuerung = "soll"): UstUebernahme | null {
  const z = ustZeitraum(periode);
  if (!z) return null;
  const im = festeRechnungen(unterlagen)
    .map((u) => zuordnen(u, v, betrieb))
    .filter((x) => x.tag && x.tag >= z.von && x.tag <= z.bis);
  const gruppen = umsaetzeNachSatz(
    im.map(({ u }) => {
      const { daten } = eRechnungAus(u.daten, betrieb);
      return { art: daten.art ?? "rechnung", kleinunternehmer: daten.kleinunternehmer, positionen: daten.positionen };
    }),
  );
  const summe = (f: (s: number | null) => boolean) => gruppen.filter((g) => f(g.satz)).reduce((a, g) => a + g.netto_cent, 0);
  return {
    anzahl: im.length,
    ersatz: im.filter((x) => x.ersatz).length,
    offen: v === "ist" ? offeneRechnungen(unterlagen).length : 0,
    werte: { zeitraum: periodeText(periode), umsatz_19: betragText(summe((s) => s === 19)), umsatz_7: betragText(summe((s) => s === 7)), umsatz_frei: betragText(summe((s) => s === null || s === 0)) },
  };
}
