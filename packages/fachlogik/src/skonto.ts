/**
 * Skonto und andere Entgeltminderungen (R12) – reine Funktionen ohne Gerät.
 *
 * - Rechnung: im Voraus vereinbarte Minderung des Entgelts („x % bei Zahlung innerhalb von n Tagen“), die auf der Rechnung
 *   stehen muss (§ 14 Abs. 4 Satz 1 Nr. 7 UStG; nach A 14.5 Abs. 19 UStAE genügt „x % Skonto bei Zahlung bis …“,
 *   der Betrag muss nicht dastehen). Der GiroCode bleibt beim vollen Rechnungsbetrag.
 * - XRechnung: Skonto in den Zahlungsbedingungen (BT-20) in der Zeilenform nach BR-DE-18 – „#SKONTO#TAGE=14#PROZENT=2.00#“,
 *   danach ein Zeilenumbruch; der lesbare Satz folgt in der nächsten Zeile.
 * - Zahlungseingang: erhaltener Betrag; eine Differenz, die als Skonto bzw. Minderung vermerkt ist, ist eine Änderung der
 *   Bemessungsgrundlage (§ 17 Abs. 1 UStG) – sie wirkt im Zeitraum der Zahlung. Eine Differenz ohne diesen Vermerk bleibt
 *   als offener Betrag stehen (Teilzahlung).
 * - Je Steuersatz wird ein Betrag im Verhältnis der Bruttobeträge aufgeteilt (größter Rest), Netto aus dem Brutto
 *   herausgerechnet. Fachlich zu prüfen: PRUEFLISTE (R12).
 */
import { rundeCent } from "./rechnung.js";

/** Skonto-Bedingung einer Rechnung: Prozent vom Rechnungsbetrag bei Zahlung innerhalb von `tage` Tagen ab Rechnungsdatum. */
export interface SkontoBedingung {
  prozent: number;
  tage: number;
}

/** „2“, „2,5“, „2.00“ → 2 bzw. 2,5; nur 0 < x < 100 mit höchstens zwei Nachkommastellen. */
export function prozentAus(t: unknown): number | null {
  const s = typeof t === "number" ? String(t) : typeof t === "string" ? t.trim().replace(/\s*%$/, "").replace(",", ".") : "";
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(s)) return null;
  const p = Number(s);
  return p > 0 && p < 100 ? p : null;
}

/** Skonto aus den Feldern der Rechnung (Prozent, Tage); null, wenn eins fehlt oder nicht passt. */
export function skontoAus(prozent: unknown, tage: unknown): SkontoBedingung | null {
  const p = prozentAus(prozent);
  const t = typeof tage === "number" ? tage : typeof tage === "string" && /^\d{1,3}$/.test(tage.trim()) ? Number(tage.trim()) : NaN;
  if (p === null || !Number.isInteger(t) || t < 1 || t > 365) return null;
  return { prozent: p, tage: t };
}

/** Skontobetrag in Cent vom Bruttobetrag (kaufmännisch gerundet). */
export const skontoBetrag = (brutto_cent: number, prozent: number) => rundeCent((brutto_cent * prozent) / 100);

/** Prozent mit Komma für Texte: 2 → „2“, 2,5 → „2,5“, 1,25 → „1,25“ */
export const prozentText = (p: number) => String(Math.round(p * 100) / 100).replace(".", ",");

/** Skonto-Zeile der XRechnung (BT-20) nach BR-DE-18 – ohne den abschließenden Zeilenumbruch. */
export const skontoZeile = (b: SkontoBedingung) => `#SKONTO#TAGE=${b.tage}#PROZENT=${b.prozent.toFixed(2)}#`;

/**
 * Zahlungsbedingungen (BT-20) mit Skonto: zuerst die maschinenlesbare Zeile, dann ein Zeilenumbruch (BR-DE-18 verlangt
 * ihn nach der letzten Skonto-Zeile) und der Satz für Menschen. Freitext darf nicht mit „#“ beginnen.
 */
export const zahlungsbedingungenMitSkonto = (b: SkontoBedingung, text: string) => `${skontoZeile(b)}\n${text.replace(/^#+/, "").trim()}`;

/** Ein Zahlungseingang zu einer Rechnung (R12). */
export interface Zahlung {
  id: string;
  /** Tag des Zahlungseingangs (ISO) */
  datum: string;
  /** erhaltener Betrag in Cent */
  betrag_cent: number;
  /** als Skonto bzw. Minderung (§ 17 UStG) vermerkte Differenz in Cent (brutto) – nie offen, nie erhalten */
  minderung_cent?: number;
  /** Art der Minderung – nur zur Anzeige */
  art?: "skonto" | "minderung";
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Gespeicherte Zahlungen prüfen; Unlesbares fällt weg. Sortiert nach Datum (dann ID). */
export function zahlungenAus(roh: unknown): Zahlung[] {
  if (!Array.isArray(roh)) return [];
  const aus: Zahlung[] = [];
  for (const x of roh as unknown[]) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const betrag = Number(r.betrag_cent);
    const minderung = r.minderung_cent === undefined || r.minderung_cent === null ? 0 : Number(r.minderung_cent);
    if (typeof r.id !== "string" || !r.id || typeof r.datum !== "string" || !ISO_TAG.test(r.datum) || !Number.isInteger(betrag) || betrag < 0 || !Number.isInteger(minderung) || minderung < 0 || betrag + minderung === 0) continue;
    aus.push({ id: r.id, datum: r.datum, betrag_cent: betrag, ...(minderung ? { minderung_cent: minderung, art: r.art === "minderung" ? "minderung" : "skonto" } : {}) });
  }
  return aus.sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
}

/** Erledigt (erhalten + gemindert) und offen bei einem Bruttobetrag. */
export function zahlungsStand(brutto_cent: number, zahlungen: readonly Zahlung[]): { erhalten: number; minderung: number; offen: number } {
  const erhalten = zahlungen.reduce((a, z) => a + z.betrag_cent, 0);
  const minderung = zahlungen.reduce((a, z) => a + (z.minderung_cent ?? 0), 0);
  return { erhalten, minderung, offen: Math.max(0, brutto_cent - erhalten - minderung) };
}

/**
 * Betrag im Verhältnis von Anteilen aufteilen (größter Rest, nach Betrag): die Teile ergeben genau den Betrag. Ohne
 * Anteile oder bei Summe 0 bekommt der erste Anteil alles.
 */
export function aufteilen(betrag: number, anteile: readonly number[]): number[] {
  if (!anteile.length) return [];
  const summe = anteile.reduce((a, x) => a + x, 0);
  if (!summe) return anteile.map((_, i) => (i === 0 ? betrag : 0));
  const roh = anteile.map((x) => (betrag * x) / summe);
  const teile = roh.map((x) => Math.trunc(x));
  let rest = betrag - teile.reduce((a, x) => a + x, 0);
  const reihenfolge = roh.map((x, i) => ({ i, r: Math.abs(x - Math.trunc(x)) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; rest !== 0 && k < reihenfolge.length * 2; k++) {
    const i = reihenfolge[k % reihenfolge.length]!.i;
    teile[i]! += Math.sign(rest);
    rest -= Math.sign(rest);
  }
  return teile;
}

/** Netto aus Brutto (kaufmännisch gerundet); ohne Steuersatz (Kleinunternehmer, 0 %) ist Brutto = Netto. */
export const nettoAusBrutto = (brutto_cent: number, satz: number | null) => (satz && satz > 0 ? rundeCent((brutto_cent * 100) / (100 + satz)) : brutto_cent);

/** Betrag je Steuersatz: brutto, netto, Steuer. */
export interface SatzBetrag {
  satz: number | null;
  brutto_cent: number;
  netto_cent: number;
  ust_cent: number;
}

/** Steuergruppe einer Rechnung (wie `summen().gruppen`). */
export interface SteuerGruppe {
  satz: number | null;
  netto_cent: number;
  ust_cent: number;
}

/** Eine Minderung (brutto) je Steuersatz nach den Bruttobeträgen der Gruppen; Netto je Satz aus dem Brutto. */
export function minderungNachSatz(brutto_cent: number, gruppen: readonly SteuerGruppe[]): SatzBetrag[] {
  const teile = aufteilen(brutto_cent, gruppen.map((g) => g.netto_cent + g.ust_cent));
  return gruppen.map((g, i) => {
    const b = teile[i]!;
    const n = nettoAusBrutto(b, g.satz);
    return { satz: g.satz, brutto_cent: b, netto_cent: n, ust_cent: b - n };
  });
}

/** Je Zahlung: was je Steuersatz erhalten und was gemindert wurde. */
export interface ZahlungsAnteil {
  zahlung: Zahlung;
  erhalten: SatzBetrag[];
  minderung: SatzBetrag[];
}

/**
 * Zahlungen einer Rechnung je Steuersatz (Ist-Versteuerung, EÜR, Buchungen): Erledigtes (erhalten + gemindert) wird
 * fortlaufend aufgeteilt – mit der letzten Zahlung ergibt sich genau der Betrag der Rechnung je Satz, ihr Netto genau
 * wie auf der Rechnung. Die Minderung je Satz rechnet Netto aus ihrem Brutto heraus; erhalten ist der Rest.
 */
export function zahlungsAnteile(gruppen: readonly SteuerGruppe[], zahlungen: readonly Zahlung[]): ZahlungsAnteil[] {
  const brutto = gruppen.map((g) => g.netto_cent + g.ust_cent);
  const gesamt = brutto.reduce((a, x) => a + x, 0);
  const erledigtJe = (cum: number) => (cum >= gesamt ? brutto : aufteilen(cum, brutto));
  const nettoJe = (je: number[]) => je.map((b, i) => (b === brutto[i] ? gruppen[i]!.netto_cent : brutto[i] ? rundeCent((gruppen[i]!.netto_cent * b) / brutto[i]!) : 0));
  let cum = 0;
  let vorher = gruppen.map(() => 0);
  let vorherNetto = gruppen.map(() => 0);
  const aus: ZahlungsAnteil[] = [];
  for (const z of [...zahlungen].sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id))) {
    cum = Math.min(gesamt, cum + z.betrag_cent + (z.minderung_cent ?? 0));
    const jetzt = erledigtJe(cum);
    const jetztNetto = nettoJe(jetzt);
    const minderung = minderungNachSatz(Math.min(z.minderung_cent ?? 0, jetzt.reduce((a, x) => a + x, 0) - vorher.reduce((a, x) => a + x, 0)), gruppen);
    const erhalten = gruppen.map((g, i) => {
      const b = jetzt[i]! - vorher[i]! - minderung[i]!.brutto_cent;
      const n = jetztNetto[i]! - vorherNetto[i]! - minderung[i]!.netto_cent;
      return { satz: g.satz, brutto_cent: b, netto_cent: n, ust_cent: b - n };
    });
    aus.push({ zahlung: z, erhalten, minderung });
    vorher = jetzt;
    vorherNetto = jetztNetto;
  }
  return aus;
}
