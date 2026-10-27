/**
 * E-234 (Rechtsanwalt 27.10.2026, R5): Testhinweis für den Betatest. Eine Testvereinbarung ist nicht nötig, der kurze
 * Hinweis muss aber VOR dem Test in Textform angenommen werden – in der Testversion mit „Ich nehme teil“ (Zeitpunkt nur auf
 * dem Gerät), sonst per Antwort auf die E-Mail (docs/betatest-hinweis.md). Wortlaut des Rechtsanwalts; eingesetzt werden nur
 * der Testzeitraum (statt „[Datum]“), Name der App, Anbieter, Anschrift und E-Mail aus `ANBIETER`; der Satz zu TestFlight
 * steht nur in der TestFlight-Fassung (iPhone), und von „Mit „Ich nehme teil“ bzw. deiner Antwort auf diese E-Mail …“ steht
 * je Weg die passende Hälfte.
 *
 * Nur in Betatest-Builds (EAS-Profil „betatest“: `EXPO_PUBLIC_BETATEST=1`, Zeitraum `EXPO_PUBLIC_BETATEST_VON` und
 * `EXPO_PUBLIC_BETATEST_BIS` als JJJJ-MM-TT). Ohne gültigen Zeitraum zeigt die App den Hinweis nicht mit Platzhaltern,
 * sondern sperrt die Testversion (`werkzeuge/store-check.mjs --profile betatest` meldet den fehlenden Zeitraum vorher).
 * Reine Funktionen, ohne Gerät testbar.
 */
import { MARKE } from "@amtlos/marke";
import { ANBIETER } from "./rechtliches";

/** Umgebung des Builds – Expo setzt `EXPO_PUBLIC_*` beim Bauen ein (nur bei wörtlichem Zugriff) */
export const BETATEST_UMGEBUNG = {
  an: process.env.EXPO_PUBLIC_BETATEST === "1",
  von: process.env.EXPO_PUBLIC_BETATEST_VON ?? "",
  bis: process.env.EXPO_PUBLIC_BETATEST_BIS ?? "",
};

/** Fassung des Hinweises – neue Fassung oder neuer Zeitraum ⇒ erneut annehmen */
export const BETATEST_FASSUNG = "2026-10-27";
/** Schlüssel im Schlüsselbund des Geräts (nicht im Stand, nicht in Sicherungen) */
export const BETATEST_SCHLUESSEL = "betatest_hinweis";

export interface BetatestZeitraum {
  von: string;
  bis: string;
}
export interface BetatestAnnahme extends BetatestZeitraum {
  fassung: string;
  /** ISO-Zeitpunkt von „Ich nehme teil“ */
  zeitpunkt: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const gueltig = (d: string) => ISO.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

/** Testzeitraum aus der Umgebung – null, wenn ein Datum fehlt, ungültig ist oder „bis“ vor „von“ liegt. */
export function betatestZeitraum(von: string, bis: string): BetatestZeitraum | null {
  const v = von.trim();
  const b = bis.trim();
  return gueltig(v) && gueltig(b) && v <= b ? { von: v, bis: b } : null;
}

const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Weg, auf dem der Hinweis angenommen wird: in der App (mit bzw. ohne TestFlight) oder per E-Mail */
export type BetatestWeg = { art: "app"; testflight: boolean } | { art: "mail"; testflight: boolean };

/** Der Hinweis im Wortlaut des Rechtsanwalts (Platzhalter eingesetzt). */
export function betatestHinweis(z: BetatestZeitraum, weg: BetatestWeg): { titel: string; absaetze: string[]; bestaetigung: string } {
  const testflight = weg.testflight ? " Apple erhebt über TestFlight eigene Daten; dafür gelten die Bedingungen von Apple." : "";
  return {
    titel: `Testhinweis ${MARKE.name} (Betatest)`,
    absaetze: [
      `1. ${ANBIETER.name}, ${ANBIETER.anschrift}, stellt dir eine Testversion der App ${MARKE.name} vom ${datumDe(z.von)} bis zum ${datumDe(z.bis)} kostenlos zur Verfügung.`,
      `2. Die Testversion kann Fehler enthalten. ${MARKE.name} gibt allgemeine Informationen und ist keine Rechts- oder Steuerberatung. Richte die Einhaltung deiner Pflichten und Fristen nicht allein nach der Testversion, und lege Sicherungen deiner Daten an.`,
      "3. Wir haften nur für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit.",
      "4. Bitte gib die Testversion nicht weiter und veröffentliche keine Inhalte oder Bildschirmfotos daraus ohne unsere Zustimmung.",
      `5. Deine Rückmeldungen helfen uns. Wir dürfen sie frei verwenden, um ${MARKE.name} zu verbessern.`,
      `6. Deine Angaben in der App bleiben verschlüsselt auf deinem Gerät; wir sehen sie nicht. Für den Test verarbeiten wir nur deinen Namen, deine E-Mail-Adresse und deine Rückmeldungen (Art. 6 Abs. 1 lit. b DSGVO) und löschen sie spätestens drei Monate nach Ende des Tests.${testflight} Kontakt und deine Rechte: ${ANBIETER.email}.`,
    ],
    bestaetigung: weg.art === "app" ? "Mit „Ich nehme teil“ bestätigst du diesen Hinweis." : "Mit deiner Antwort auf diese E-Mail bestätigst du diesen Hinweis.",
  };
}

/** Annahme passt zur Fassung und zum Zeitraum dieses Builds? */
export function betatestAngenommen(roh: string | null, z: BetatestZeitraum): boolean {
  if (!roh) return false;
  try {
    const a = JSON.parse(roh) as Partial<BetatestAnnahme>;
    return a.fassung === BETATEST_FASSUNG && a.von === z.von && a.bis === z.bis && typeof a.zeitpunkt === "string" && !Number.isNaN(Date.parse(a.zeitpunkt));
  } catch {
    return false;
  }
}

export const betatestAnnahme = (z: BetatestZeitraum, jetzt = new Date()): BetatestAnnahme => ({ ...z, fassung: BETATEST_FASSUNG, zeitpunkt: jetzt.toISOString() });
