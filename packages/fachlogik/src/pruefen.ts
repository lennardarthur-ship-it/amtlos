/**
 * Plausibilitätsprüfungen für Eingaben in „Mein Betrieb“ (IBAN, PLZ, E-Mail). Nur Hinweise – gespeichert wird trotzdem,
 * denn ein Tippfehler soll nie Eingaben verlieren lassen.
 */

/** Länge der IBAN je Land (SEPA-Raum, die häufigsten); unbekannte Länder: 15–34 Zeichen. */
const IBAN_LAENGE: Record<string, number> = {
  DE: 22, AT: 20, CH: 21, LI: 21, LU: 20, BE: 16, NL: 18, FR: 27, IT: 27, ES: 24, PT: 25, DK: 18, SE: 24, FI: 18, NO: 15,
  PL: 28, CZ: 24, SK: 24, HU: 28, SI: 19, HR: 21, IE: 22, GR: 27, RO: 24, BG: 22, EE: 20, LV: 21, LT: 20, MT: 31, CY: 28, GB: 22,
};

/** IBAN ohne Leerzeichen, in Großbuchstaben. */
export const ibanNormal = (iban: string) => iban.replace(/[\s-]/g, "").toUpperCase();

/** Prüfsumme nach ISO 13616 (mod 97 = 1) und Länge je Land. Leer gilt als gültig (nichts zu prüfen). */
export function ibanGueltig(iban: string): boolean {
  const s = ibanNormal(iban);
  if (!s) return true;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const laenge = IBAN_LAENGE[s.slice(0, 2)];
  if (laenge ? s.length !== laenge : s.length < 15 || s.length > 34) return false;
  const umgestellt = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const z of umgestellt) {
    const n = z >= "A" ? String(z.charCodeAt(0) - 55) : z;
    for (const ziffer of n) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

/** Deutsche Postleitzahl: fünf Ziffern. Leer gilt als gültig. */
export const plzGueltig = (plz: string) => !plz.trim() || /^\d{5}$/.test(plz.trim());

/** E-Mail mit „@“ und Punkt in der Domain. Leer gilt als gültig. */
export const emailGueltig = (email: string) => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(email.trim());
