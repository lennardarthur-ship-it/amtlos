export interface KatalogPruefung {
  fehler: string[];
  pflichten: { datei: string; inhalt: Record<string, unknown> & { id: string; version: number } }[];
  regelwerte: (Record<string, unknown> & { id: string; version: number; wert: number; gueltig_ab: string; gueltig_bis?: string | null })[];
  fixtures: { datei: string; inhalt: Record<string, unknown> }[];
  fakten: number;
  ereignisse: number;
}
export function validiereKatalog(katalogDir: string, optionen?: { prod?: boolean }): KatalogPruefung;
export function pruefePflichtObjekt(p: unknown, kontext: { regelwertIds: Set<string>; pflichtIds: Set<string>; prod?: boolean }): string[];
export function meldungDeutsch(e: { keyword: string; instancePath: string; params: Record<string, unknown>; message?: string }): string | null;
