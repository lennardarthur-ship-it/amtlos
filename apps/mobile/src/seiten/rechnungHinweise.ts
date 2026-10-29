/** R12: reine Regeln für Hinweise im Rechnungsabschluss (testbar ohne Oberfläche). */
import { RECHNUNG_13B_TEXT, RECHNUNG_EU_19, RECHNUNG_GUTSCHEIN, RECHNUNG_KU_DRITTLAND, RECHNUNG_KU_EU, RECHNUNG_KU_IGL, RECHNUNG_KU_PROFIL, RECHNUNG_KU_RC, RECHNUNG_KU_ZEIT, RECHNUNG_LEITWEG, RECHNUNG_NACH_KU_ZEIT, RECHNUNG_SCHLUSS_SATZ } from "@amtlos/fachlogik";

/**
 * R11/R12: Bau oder Ausbau laut Pflichten-Check – dann schlägt die Rechnung den Grundstücks-Hinweis vor (§ 14 Abs. 4
 * Nr. 9 UStG). Handwerk zählt mit, außer im Lebensmittelhandwerk (Bäckerei, Bäckerei #14); Fahrzeug-Leistungen
 * (Kfz-Werkstatt) erkennt die Vorlage selbst.
 */
export const handwerkLaut = (profil: Record<string, unknown>) => {
  const br = profil["taetigkeit.branchen"];
  if (!Array.isArray(br)) return false;
  return br.includes("bau") || (br.includes("handwerk") && !br.includes("gastronomie_lebensmittel"));
};

/** R12 (UX #4): Rechnung mit Zahlungsziel, aber ohne IBAN – die Kundin kann nicht überweisen, und der GiroCode fehlt. */
export function ohneZahlungsweg(d: Record<string, unknown>, iban: string): boolean {
  const ziel = typeof d.zahlungsziel === "string" ? d.zahlungsziel : "";
  const t = (k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
  const gutschrift = Array.isArray(d.hinweise) && d.hinweise.includes("gutschrift");
  return /^\d+$/.test(ziel) && Number(ziel) > 0 && !iban.trim() && !t("bezahlt_am") && !t("storno_zu") && !gutschrift;
}

/**
 * E-239: Stufe eines fachlichen Hinweises der Rechnung (`hinweise` der Vorlage, R10). Blocker – sichtbar vor dem Teilen –
 * sind die Hinweise auf eine wahrscheinlich falsche steuerliche Behandlung (Ort der Leistung im Ausland mit deutscher
 * Steuer, Kleinunternehmer mit igL bzw. § 13b, Widerspruch zum Pflichten-Check bzw. zur Kleinunternehmerzeit, „13b“ im
 * Befreiungstext, Gutschein zu 0 %, Abschlag mit fremdem Steuersatz) und die fehlende Leitweg-ID (Pflicht für die
 * E-Rechnung an Behörden). Alle übrigen (Einheit ohne Code, Skonto-Frist, Monat in der Position, Grundstücks-Vorschlag,
 * OSS-Schwelle, Nummernkreis für Gutschriften …) sind Hinweise. Am Text ändert sich nichts; geteilt wird wie bisher.
 */
export function rechnungHinweisStufe(text: string): "blocker" | "hinweis" {
  const fest = [RECHNUNG_13B_TEXT, RECHNUNG_LEITWEG, RECHNUNG_KU_IGL, RECHNUNG_KU_RC, RECHNUNG_KU_DRITTLAND, RECHNUNG_GUTSCHEIN, RECHNUNG_SCHLUSS_SATZ];
  // Texte mit Platzhalter: am festen Anfang erkennen (vor dem ersten Platzhalter)
  const anfang = (f: (x: never) => string, probe: unknown) => f(probe as never).split("\u0000")[0]!;
  const anfaenge = [anfang(RECHNUNG_EU_19, "\u0000"), anfang(RECHNUNG_KU_EU, "\u0000"), anfang(RECHNUNG_KU_ZEIT, "\u0000"), anfang(RECHNUNG_NACH_KU_ZEIT, "\u0000"), RECHNUNG_KU_PROFIL(true), RECHNUNG_KU_PROFIL(false)];
  return fest.includes(text) || anfaenge.some((a) => text.startsWith(a)) ? "blocker" : "hinweis";
}
