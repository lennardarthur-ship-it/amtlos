export interface Marke {
  /** sichtbarer Produktname, z. B. „Betriebsklar“ */
  readonly name: string;
  /** Name des Abos, z. B. „Betriebsklar Pro“ */
  readonly proName: string;
  /** Domain ohne Protokoll, z. B. „betriebsklar.de“ */
  readonly domain: string;
  /** Kontaktadresse */
  readonly email: string;
  /** https://<domain> */
  readonly website: string;
  /** Datenschutzerklärung im Netz */
  readonly datenschutz: string;
  /** Hilfe-/Support-Seite */
  readonly hilfe: string;
  /** Technische Kennungen – nur vor dem ersten Store-Release ändern */
  readonly technisch: { readonly bundleId: string; readonly scheme: string; readonly dateiendungSicherung: string };
}
export interface MarkeDaten {
  name: string;
  proName: string;
  domain: string;
  email: string;
  technisch: { bundleId: string; scheme: string; dateiendungSicherung: string };
}
export declare function markeAus(d: MarkeDaten): Marke;
export declare const MARKE: Marke;
export declare const PLATZHALTER: readonly string[];
export declare function markeEinsetzen(text: string, m?: Marke): string;
export declare function markeEinsetzenTief<T>(wert: T, m?: Marke): T;
