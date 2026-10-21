/**
 * Sachentnahmen (unentgeltliche Wertabgaben, R12 GoBD) – reine Funktionen ohne Gerät.
 *
 * Wer Waren aus dem eigenen Betrieb privat verbraucht (Gastronomie, Bäckerei, Lebensmittelhandel), versteuert die
 * Entnahme (§ 3 Abs. 1b Satz 1 Nr. 1 UStG) und erfasst sie als Betriebseinnahme. Die Finanzverwaltung veröffentlicht
 * dafür jährliche Pauschbeträge je Person und Gewerbeklasse (netto, aufgeteilt nach ermäßigtem und vollem Steuersatz).
 * Amtlos rechnet die Beträge NICHT selbst aus: Die Inhaberin trägt die Werte aus dem aktuellen BMF-Schreiben ein (die
 * amtliche Quelle für 2026 war bei der Umsetzung nicht abrufbar – PRUEFLISTE).
 *
 * Wirkung: Voranmeldung (Kz 86/81, im Zeitraum des Buchungstags), EÜR (netto in „Sonstige Sach-, Nutzungs- und
 * Leistungsentnahmen“, Steuer in „Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben“),
 * DATEV-Stapel (Privatentnahmen an „Entnahme durch den Unternehmer … (Waren)“ 7 %/19 %, brutto, Automatik). Kleinunternehmer:
 * keine Umsatzsteuer, nicht im Stapel (mit der Kanzlei klären).
 */
import { belegfeld1Aus, buchungsGuid, kontenFuer, type Buchung, type BuchungsOptionen, type Kontenrahmen } from "./buchungen.js";
import { rundeCent } from "./rechnung.js";

export interface Sachentnahme {
  id: string;
  /** Tag der Buchung (ISO) – Jahreswert z. B. zum 31.12. oder monatlich je ein Zwölftel */
  datum: string;
  /** Bemessungsgrundlage zum ermäßigten Satz (7 %), netto in Cent */
  netto7_cent: number;
  /** Bemessungsgrundlage zum Regelsatz (19 %), netto in Cent */
  netto19_cent: number;
  /** z. B. „Pauschbetrag 2026, 1 Person, Café und Konditorei“ */
  text?: string | null;
  erstellt: string;
}

const ganz = (w: unknown) => (typeof w === "number" && Number.isInteger(w) && w >= 0 ? w : null);

/** Gespeicherte Sachentnahme prüfen; null bei Unlesbarem. */
export function sachentnahmeAus(roh: unknown): Sachentnahme | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  const r = roh as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || typeof r.datum !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.datum)) return null;
  const n7 = ganz(r.netto7_cent) ?? 0;
  const n19 = ganz(r.netto19_cent) ?? 0;
  if (!n7 && !n19) return null;
  const text = typeof r.text === "string" && r.text.trim() ? r.text.trim().slice(0, 200) : null;
  return { id: r.id, datum: r.datum, netto7_cent: n7, netto19_cent: n19, ...(text ? { text } : {}), erstellt: typeof r.erstellt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(r.erstellt) ? r.erstellt : `${r.datum}T00:00:00.000Z` };
}

/** Umsatzsteuer auf eine Entnahme (kaufmännisch gerundet). */
export const entnahmeSteuer = (netto: number, satz: 7 | 19) => rundeCent((netto * satz) / 100);

/** Summen eines Zeitraums: netto je Satz und Steuer. */
export function sachentnahmenFuer(l: readonly Sachentnahme[], von: string, bis: string): { netto7: number; netto19: number; ust7: number; ust19: number; anzahl: number } {
  const r = { netto7: 0, netto19: 0, ust7: 0, ust19: 0, anzahl: 0 };
  for (const x of l) {
    if (x.datum < von || x.datum > bis) continue;
    r.netto7 += x.netto7_cent;
    r.netto19 += x.netto19_cent;
    r.ust7 += entnahmeSteuer(x.netto7_cent, 7);
    r.ust19 += entnahmeSteuer(x.netto19_cent, 19);
    r.anzahl++;
  }
  return r;
}

/**
 * Buchungen: Privatentnahmen (Feld 7) an Entnahme 7 % bzw. 19 % (Feld 8, brutto, Automatikkonto) – nicht bei
 * Kleinunternehmern. StB-Prüfung (A-1): Sachkonto mit Steuer als Gegenkonto – richtig; Konten nach Kontenvorgaben.
 */
export function sachentnahmeBuchungen(l: readonly Sachentnahme[], kontenrahmen: Kontenrahmen, o: BuchungsOptionen & { kleinunternehmer?: boolean } = {}): Buchung[] {
  if (o.kleinunternehmer) return [];
  const k = kontenFuer(kontenrahmen, o.vorgaben);
  const aus: Buchung[] = [];
  for (const x of l)
    for (const satz of [7, 19] as const) {
      const netto = satz === 7 ? x.netto7_cent : x.netto19_cent;
      if (!netto) continue;
      aus.push({ datum: x.datum, betrag_cent: netto + entnahmeSteuer(netto, satz), soll_haben: "S", konto: k.privatentnahmen, gegenkonto: k.sachentnahme[satz], bu_schluessel: "", belegfeld1: belegfeld1Aus(`SE${x.datum.replace(/-/g, "")}`), buchungstext: `Sachentnahme ${satz} %${x.text ? ` ${x.text}` : ""}`.slice(0, 60), ust_satz: satz, art: "einnahme", quelle_id: x.id, guid: buchungsGuid(`${x.id}|sachentnahme`, satz), leistungsdatum: x.datum, steuerperiode: x.datum });
    }
  return aus;
}
