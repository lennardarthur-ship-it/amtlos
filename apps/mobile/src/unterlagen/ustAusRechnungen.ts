/**
 * Rechnungen speisen die Umsatzsteuer-Voranmeldung (E-128): Umsätze je Steuersatz aus den festgeschriebenen
 * Rechnungen eines Monats oder Quartals; Stornorechnungen zählen negativ. Entwürfe zählen nicht – sie sind nicht raus.
 */
import { eRechnungAus, umsaetzeNachSatz, ustZeitraum, type Betrieb } from "@amtlos/fachlogik";
import type { Unterlage } from "./speicher";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function periodeText(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) return `${MONATE[Number(m[2]) - 1]} ${m[1]}`;
  const q = /^(\d{4})-Q([1-4])$/.exec(p);
  return q ? `${q[2]}. Quartal ${q[1]}` : p;
}

const betragText = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);

const festeRechnungen = (unterlagen: Unterlage[]) => unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string");

/** Monate und Quartale, in denen es festgeschriebene Rechnungen gibt – neueste zuerst. */
export function perioden(unterlagen: Unterlage[]): string[] {
  const set = new Set<string>();
  for (const u of festeRechnungen(unterlagen)) {
    const d = u.daten.datum as string;
    set.add(d.slice(0, 7));
    set.add(`${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`);
  }
  return [...set].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1));
}

/** Felder der Voranmeldung für einen Zeitraum („JJJJ-MM“ oder „JJJJ-Qn“). */
export function umsaetzeFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb): { werte: Record<string, string>; anzahl: number } | null {
  const z = ustZeitraum(periode);
  if (!z) return null;
  const im = festeRechnungen(unterlagen).filter((u) => (u.daten.datum as string) >= z.von && (u.daten.datum as string) <= z.bis);
  const gruppen = umsaetzeNachSatz(im.map((u) => {
    const { daten } = eRechnungAus(u.daten, betrieb);
    return { art: daten.art ?? "rechnung", kleinunternehmer: daten.kleinunternehmer, positionen: daten.positionen };
  }));
  const summe = (f: (s: number | null) => boolean) => gruppen.filter((g) => f(g.satz)).reduce((a, g) => a + g.netto_cent, 0);
  return {
    anzahl: im.length,
    werte: { zeitraum: periodeText(periode), umsatz_19: betragText(summe((s) => s === 19)), umsatz_7: betragText(summe((s) => s === 7)), umsatz_frei: betragText(summe((s) => s === null || s === 0)) },
  };
}
