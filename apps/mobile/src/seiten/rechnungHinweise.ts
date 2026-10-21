/** R12: reine Regeln für Hinweise im Rechnungsabschluss (testbar ohne Oberfläche). */

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
