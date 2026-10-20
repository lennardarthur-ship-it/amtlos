/**
 * Uhrzeit und Zeitzone für die Anzeige. Die App rechnet Datum, Fristen und Rechnungsnummern nach deutscher Zeit
 * (Europe/Berlin) – auch auf Reisen.
 */
export const ZEITZONE = "Europe/Berlin";

/**
 * Stunde (0–23) in einer Zeitzone. Über `formatToParts`: `format()` liefert bei `de-DE` „10 Uhr“ (ICU, Hermes) – als
 * Zahl gelesen wäre das NaN, und der Gruß hieße immer „Guten Abend“ (M2).
 */
export function stundeIn(jetzt: Date, zeitzone = ZEITZONE): number {
  const teil = new Intl.DateTimeFormat("de-DE", { timeZone: zeitzone, hour: "numeric", hourCycle: "h23" }).formatToParts(jetzt).find((p) => p.type === "hour");
  const h = Number(teil?.value);
  // „24“ gibt es bei manchen Engines für Mitternacht trotz h23
  return Number.isFinite(h) ? h % 24 : jetzt.getHours();
}

/** Zeitzone des Geräts (IANA-Name), sonst null. */
export function geraeteZeitzone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Weicht das Gerät von der deutschen Zeit ab (G10)? Nur, wenn gerade ein anderes Datum oder eine andere Uhrzeit
 * gilt – Zeitzonen mit gleicher Zeit (z. B. Europe/Vienna) zählen nicht.
 */
export function zeitzoneAbweichend(jetzt: Date, zeitzone: string | null = geraeteZeitzone()): boolean {
  if (!zeitzone || zeitzone === ZEITZONE) return false;
  try {
    const f = (tz: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(jetzt);
    return f(zeitzone) !== f(ZEITZONE);
  } catch {
    return false;
  }
}
