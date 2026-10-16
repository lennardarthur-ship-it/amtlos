/** Im Web (Tests) gibt es keinen App Store – immer Testmodus. Gleiche Schnittstelle wie kauf.ts. */
export const PRO_BERECHTIGUNG = "pro";
export const kaufAktiv = false;
export const testmodus = true;
export interface Angebot {
  id: string;
  titel: string;
  preis: string;
  zeitraum: string;
  test: string | null;
}
export const proAktiv = async () => false;
export const angebote = async (): Promise<Angebot[]> => [];
export const kaufen = async (_id: string) => false;
export const wiederherstellen = async () => false;
export const proKontoVerbinden = async (_kontoId: string) => false;
export const proKontoTrennen = async () => {};
