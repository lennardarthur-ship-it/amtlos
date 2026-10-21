/**
 * Rechtsstand des Pflichten-Katalogs (Phase 1): bis zu welchem Monat Gesetze und Quellen eingearbeitet sind. Steht in
 * der App beim Hinweis „keine Rechts- oder Steuerberatung“ und auf der Website (apps/website/bauen.mjs liest diese Datei).
 *
 * Quelle in dieser Reihenfolge: das Feld `rechtsstand` im gebündelten Katalog (vom Katalog-Build gesetzt), sonst das
 * jüngste Datum aus `quellen[].abgerufen` bzw. `pruefung.geprueft_am`, sonst {@link RECHTSSTAND_ERSATZ}.
 */
import roh from "./katalog.json";

/** Rückfall, wenn der Katalog kein Datum trägt (JJJJ-MM). */
export const RECHTSSTAND_ERSATZ = "2026-10";

type KatalogDaten = {
  rechtsstand?: unknown;
  pflichten?: { quellen?: { abgerufen?: unknown }[] | null; pruefung?: { geprueft_am?: unknown } | null }[];
};

const MONAT = /^(\d{4})-(0[1-9]|1[0-2])/;
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Rechtsstand als JJJJ-MM. `katalog` nur für Tests – sonst der gebündelte Katalog. */
export function rechtsstand(katalog: KatalogDaten = roh as unknown as KatalogDaten): string {
  const eigen = typeof katalog.rechtsstand === "string" ? MONAT.exec(katalog.rechtsstand) : null;
  if (eigen) return `${eigen[1]}-${eigen[2]}`;
  const daten = (katalog.pflichten ?? []).flatMap((p) => [...(p.quellen ?? []).map((q) => q.abgerufen), p.pruefung?.geprueft_am]);
  const neuestes = daten
    .filter((d): d is string => typeof d === "string" && MONAT.test(d))
    .sort()
    .at(-1);
  return neuestes ? neuestes.slice(0, 7) : RECHTSSTAND_ERSATZ;
}

/** „Oktober 2026“ */
export function rechtsstandMonat(stand = rechtsstand()): string {
  const m = MONAT.exec(stand);
  return m ? `${MONATE[Number(m[2]) - 1]} ${m[1]}` : stand;
}

/** „Rechtsstand: Oktober 2026“ */
export function rechtsstandText(stand = rechtsstand()): string {
  return `Rechtsstand: ${rechtsstandMonat(stand)}`;
}
