/**
 * StB GoBD (Prüfbericht Heckler und Busch, D-11): Vollsicherung außerhalb des Geräts mit Erinnerung und Nachweis.
 * Verlust oder Wechsel des iPhones darf die Bücher nicht vernichten (GoBD Rz. 103 ff.): Die App hält Datum und Art jeder
 * exportierten Vollsicherung fest (verschlüsselte Sicherungsdatei oder offenes Archiv – die automatische iCloud-Sicherung
 * zählt hier nicht, sie ist nur mit der App lesbar) und erinnert, wenn die letzte älter als 30 Tage ist.
 * Reine Funktionen ohne Gerät, damit sie testbar sind.
 */

/** Art der Vollsicherung: verschlüsselte Sicherungsdatei (wiederherstellbar) bzw. offenes Archiv (lesbar ohne App). */
export type SicherungsZiel = "datei" | "archiv";
export interface SicherungsNachweis {
  /** Zeitpunkt des Exports (ISO) */
  am: string;
  ziel: SicherungsZiel;
}

/** Nach so vielen Tagen erinnert die App an die nächste Vollsicherung (Prüfbericht: „periodisch“ – monatlich). */
export const VOLLSICHERUNG_TAGE = 30;
/** So viele Nachweise bleiben gespeichert (ein Jahr bei monatlicher Sicherung). */
export const NACHWEISE_HOECHSTENS = 12;

export const ZIEL_TEXT: Record<SicherungsZiel, string> = { datei: "verschlüsselte Sicherungsdatei", archiv: "offenes Archiv (CSV, PDF, XML)" };

/** Nachweise aus dem gespeicherten Stand lesen – Unlesbares fällt weg, neueste zuletzt. */
export function nachweiseAus(roh: unknown): SicherungsNachweis[] {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((x): x is SicherungsNachweis => typeof x === "object" && x !== null && typeof (x as SicherungsNachweis).am === "string" && !Number.isNaN(Date.parse((x as SicherungsNachweis).am)) && ((x as SicherungsNachweis).ziel === "datei" || (x as SicherungsNachweis).ziel === "archiv"))
    .map((x) => ({ am: x.am, ziel: x.ziel }))
    .sort((a, b) => a.am.localeCompare(b.am))
    .slice(-NACHWEISE_HOECHSTENS);
}

/** Einen Nachweis anhängen (höchstens NACHWEISE_HOECHSTENS, älteste fallen weg). */
export const nachweisAnhaengen = (l: readonly SicherungsNachweis[] | undefined, n: SicherungsNachweis): SicherungsNachweis[] => [...(l ?? []), n].slice(-NACHWEISE_HOECHSTENS);

/** Letzte Vollsicherung außerhalb des Geräts (oder undefined). */
export const letzteVollsicherung = (l: readonly SicherungsNachweis[] | undefined): SicherungsNachweis | undefined => (l?.length ? l[l.length - 1] : undefined);

const DATUM = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
/** „15.10.2026, verschlüsselte Sicherungsdatei“ – für die Sicherungsseite und die Verfahrensdokumentation. */
export const nachweisText = (n: SicherungsNachweis) => `${DATUM.format(new Date(n.am))}, ${ZIEL_TEXT[n.ziel]}`;

/**
 * Ist eine Vollsicherung außerhalb des Geräts fällig? Nur, wenn es etwas Aufbewahrungspflichtiges gibt (`lohnt`), seit der
 * letzten Vollsicherung etwas geändert wurde und diese älter als `nach` Tage ist (bzw. es noch keine gibt).
 * Liefert die Tage seit der letzten (null: noch nie) – oder null, wenn nichts fällig ist.
 */
export function vollsicherungFaellig(s: { sicherungsNachweis?: readonly SicherungsNachweis[]; geaendert?: string }, jetzt: Date, lohnt: boolean, nach = VOLLSICHERUNG_TAGE): { tage: number | null } | null {
  if (!lohnt) return null;
  const n = letzteVollsicherung(s.sicherungsNachweis);
  if (!n) return { tage: null };
  // nichts geändert seit der letzten Vollsicherung: Sie ist noch vollständig
  if (!s.geaendert || s.geaendert <= n.am) return null;
  const tage = Math.floor((jetzt.getTime() - Date.parse(n.am)) / 864e5);
  return tage >= nach ? { tage } : null;
}
