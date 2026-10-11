export interface KatalogPruefung {
  fehler: string[];
  pflichten: { datei: string; inhalt: Record<string, unknown> & { id: string; version: number } }[];
  regelwerte: (Record<string, unknown> & { id: string; version: number; wert: number; gueltig_ab: string; gueltig_bis?: string | null })[];
  fixtures: { datei: string; inhalt: Record<string, unknown> }[];
  fakten: number;
  ereignisse: number;
}
export function validiereKatalog(katalogDir: string, optionen?: { prod?: boolean }): KatalogPruefung;
