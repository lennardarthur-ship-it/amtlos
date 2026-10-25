/**
 * Personenkonten für Kunden und Lieferanten (E-165, StB-Prüfung Steuerberatungskanzlei A-3/E-1, Abschnitt 10 Prio 3):
 * optional (Kontenvorgabe „Personenkonten für Kunden und Lieferanten (OPOS)“, Standard aus) bekommt jeder Kunde ein
 * Debitorenkonto und jeder Lieferant ein Kreditorenkonto. Die Kanzlei kann dann offene Posten (OPOS) führen und
 * Bankzahlungen aus dem Kontoauszug gegen die Rechnungsnummer (Belegfeld 1) ausziffern.
 *
 * Nummernkreise nach der DATEV-Standardnummerierung bei Sachkontenlänge 4 (Personenkonten fünfstellig): Debitoren
 * 10000–69999, Kreditoren 70000–99999 (Quellen: Lexware-Hilfe „Warum sind die Bereiche für Kunden- und
 * Lieferantennummern fest definiert?“ – „Kundennummern 10000 bis 69999 … Lieferantennummern 70000 bis 99999“, wie in
 * DATEV; Pickware-Hilfe „Kundennummern bei Einzel-Debitorenkonten“, abgerufen 22.10.2026). Vergeben wird fortlaufend
 * ab 10000 bzw. 70000 in der Reihenfolge des ersten Auftretens; eine vergebene Nummer bleibt am Kunden bzw. Lieferanten
 * gespeichert und ändert sich nie (speicher.ts `personenkontenVergeben`).
 *
 * Stammdaten: DATEV-Format „Debitoren/Kreditoren“ (EXTF, Version 700, Datenkategorie 16, Formatversion 5 – laut
 * Formatübersichten von Drittanbietern, u. a. „Germany DATEV Export“ (Pokutsoft) und „Craft DATEVz FAQ“: „Debtor master
 * data is category 16 (Debitoren/Kreditoren), format version 5“). Pflichtfeld laut DATEV-Marktplatz-Beschreibung ist nur
 * „Konto“; gefüllt werden Konto, Name, Adressattyp, Kurzbezeichnung, EU-Land/USt-IdNr. und die Anschrift (Felder 1–20).
 * Die Datei enthält die ersten 40 Spalten der Formatbeschreibung (Name bis „Bemerkung (Sonstige)“ – in allen bekannten
 * Fassungen gleich); die übrigen Felder (Bank, Mahnwesen, …) bleiben weg. Im Testimport prüfen (PRUEFLISTE).
 */
import { umschreiben } from "./dateinamen.js";
import { MARKE } from "@amtlos/marke";

export type PersonenkontoArt = "debitor" | "kreditor";

/** DATEV-Standardnummerierung bei Sachkontenlänge 4: fünfstellige Personenkonten */
export const PERSONENKONTO_BEREICH: Record<PersonenkontoArt, { von: number; bis: number }> = {
  debitor: { von: 10000, bis: 69999 },
  kreditor: { von: 70000, bis: 99999 },
};

/** Ist `w` ein Personenkonto (fünfstellig) – mit `art` im Bereich der Debitoren bzw. Kreditoren? */
export function istPersonenkonto(w: unknown, art?: PersonenkontoArt): w is string {
  if (typeof w !== "string" || !/^\d{5}$/.test(w)) return false;
  const n = Number(w);
  const arten: PersonenkontoArt[] = art ? [art] : ["debitor", "kreditor"];
  return arten.some((a) => n >= PERSONENKONTO_BEREICH[a].von && n <= PERSONENKONTO_BEREICH[a].bis);
}

/** Name für den Vergleich: Kleinbuchstaben, Umlaute umschrieben, Satzzeichen und Leerraum zusammengezogen. */
export function partnerName(name: string): string {
  return umschreiben(name.normalize("NFC"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** USt-IdNr. ohne Leerraum, in Großbuchstaben – leer, wenn keine. */
export const ustIdNormal = (w: string | null | undefined) => (w ?? "").replace(/[\s.-]/g, "").toUpperCase();

/**
 * Schlüssel eines Geschäftspartners: die USt-IdNr., wenn bekannt, sonst der normalisierte Name. Zwei Einträge gelten als
 * derselbe Partner, wenn die USt-IdNr. gleich ist oder – ohne USt-IdNr. auf einer Seite – der Name.
 */
export function gleicherPartner(a: { name: string; ust_idnr?: string | null }, b: { name: string; ust_idnr?: string | null }): boolean {
  const ia = ustIdNormal(a.ust_idnr);
  const ib = ustIdNormal(b.ust_idnr);
  if (ia && ib) return ia === ib;
  const na = partnerName(a.name);
  return !!na && na === partnerName(b.name);
}

/** Nächste freie Nummer im Bereich (nach der höchsten vergebenen) – null, wenn der Bereich voll ist. */
export function naechstesPersonenkonto(belegt: Iterable<string | null | undefined>, art: PersonenkontoArt): string | null {
  const { von, bis } = PERSONENKONTO_BEREICH[art];
  let max = von - 1;
  for (const k of belegt) if (istPersonenkonto(k, art)) max = Math.max(max, Number(k));
  return max + 1 <= bis ? String(max + 1) : null;
}

/** Anschrift „Straße\nPLZ Ort[\nLand]“ zerlegen – was sich nicht zuordnen lässt, bleibt leer. */
export function anschriftTeile(text: string | null | undefined): { strasse: string; plz: string; ort: string } {
  const zeilen = (text ?? "").split(/\r?\n|,\s*/).map((z) => z.trim()).filter(Boolean);
  const i = zeilen.findIndex((z) => /^(?:[A-Z]{1,2}-)?\d{4,5}\s+\S/.test(z));
  if (i < 0) return { strasse: zeilen[0] ?? "", plz: "", ort: "" };
  const m = /^(?:[A-Z]{1,2}-)?(\d{4,5})\s+(.+)$/.exec(zeilen[i]!)!;
  return { strasse: i > 0 ? zeilen[i - 1]! : "", plz: m[1]!, ort: m[2]! };
}

/** Eintrag der Stammdaten-Datei */
export interface PersonenkontoStamm {
  konto: string;
  name: string;
  anschrift?: string | null;
  /** Land (ISO 3166-1 alpha-2), ohne Angabe Deutschland */
  land?: string | null;
  ust_idnr?: string | null;
  /** Privatperson (Adressattyp „keine Angabe“ statt Unternehmen) */
  privat?: boolean;
}

/** Spalten 1–40 des DATEV-Formats „Debitoren/Kreditoren“ (Formatversion 5) */
export const DEBKRED_SPALTEN: readonly string[] = [
  "Konto",
  "Name (Adressattyp Unternehmen)",
  "Unternehmensgegenstand",
  "Name (Adressattyp natürl. Person)",
  "Vorname (Adressattyp natürl. Person)",
  "Name (Adressattyp keine Angabe)",
  "Adressattyp",
  "Kurzbezeichnung",
  "EU-Land",
  "EU-UStID",
  "Anrede",
  "Titel/Akad. Grad",
  "Adelstitel",
  "Namensvorsatz",
  "Adressart",
  "Straße",
  "Postfach",
  "Postleitzahl",
  "Ort",
  "Land",
  "Versandzusatz",
  "Adresszusatz",
  "Abweichende Anrede",
  "Abw. Zustellbezeichnung 1",
  "Abw. Zustellbezeichnung 2",
  "Kennz. Korrespondenzadresse",
  "Adresse Gültig von",
  "Adresse Gültig bis",
  "Telefon",
  "Bemerkung (Telefon)",
  "Telefon GL",
  "Bemerkung (Telefon GL)",
  "E-Mail",
  "Bemerkung (E-Mail)",
  "Internet",
  "Bemerkung (Internet)",
  "Fax",
  "Bemerkung (Fax)",
  "Sonstige",
  "Bemerkung (Sonstige)",
];

export interface DebKredOptionen {
  beraternummer?: string;
  mandantennummer?: string;
  /** Beginn des Wirtschaftsjahres (ISO) */
  wjBeginn: string;
  /** Zeitpunkt der Erzeugung (ISO) */
  erzeugtAm: string;
  sachkontenlaenge?: number;
}

const inAnfz = (s: string) => `"${s.replace(/"/g, '""')}"`;
const kurz = (s: string, n: number) => Array.from(s.replace(/\s+/g, " ").trim()).slice(0, n).join("").trimEnd();
const ziffern = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
function erzeugt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?/.exec(iso);
  return m ? `${m[1]}${m[2]}${m[3]}${m[4] ?? "00"}${m[5] ?? "00"}${m[6] ?? "00"}${(m[7] ?? "").padEnd(3, "0")}` : "";
}

/**
 * DATEV-Format „Debitoren/Kreditoren“ als Text (Kodierung nach Windows-1252 mit `datevExtfBytes`): Kopfzeile wie beim
 * Buchungsstapel mit Kategorie 16 und Formatversion 5 (ohne Zeitraum), Spaltenüberschriften, je Personenkonto eine Zeile.
 * Unternehmen mit Adressattyp 2 im Feld „Name (Adressattyp Unternehmen)“, Privatpersonen mit Adressattyp 0 im Feld
 * „Name (Adressattyp keine Angabe)“ (kein Aufteilen in Vor- und Nachname). USt-IdNr.: Land in „EU-Land“, der Rest in
 * „EU-UStID“. Adressart „STR“ bei einer Straße.
 */
export function datevDebitorenKreditoren(eintraege: readonly PersonenkontoStamm[], o: DebKredOptionen): string {
  const kopf = [
    inAnfz("EXTF"), "700", "16", inAnfz("Debitoren/Kreditoren"), "5", erzeugt(o.erzeugtAm), "", inAnfz("RE"), inAnfz(MARKE.name), "",
    ziffern(o.beraternummer), ziffern(o.mandantennummer), o.wjBeginn.slice(0, 10).replace(/-/g, ""), String(o.sachkontenlaenge ?? 4),
    "", "", inAnfz(""), inAnfz(""), "", "", "", inAnfz(""), "", "", "", "", "", "", "", "", "",
  ];
  const zeilen = [...eintraege]
    .sort((a, b) => a.konto.localeCompare(b.konto))
    .map((e) => {
      const f = new Array<string>(DEBKRED_SPALTEN.length).fill("");
      const name = kurz(e.name, 50);
      const a = anschriftTeile(e.anschrift);
      const id = ustIdNormal(e.ust_idnr);
      f[0] = e.konto;
      if (e.privat) f[5] = inAnfz(name);
      else f[1] = inAnfz(name);
      f[6] = e.privat ? "0" : "2";
      f[7] = inAnfz(kurz(e.name, 15));
      if (/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(id)) {
        f[8] = inAnfz(id.slice(0, 2));
        f[9] = inAnfz(id.slice(2));
      }
      if (a.strasse) {
        f[14] = inAnfz("STR");
        f[15] = inAnfz(kurz(a.strasse, 36));
      }
      if (a.plz) f[17] = inAnfz(a.plz);
      if (a.ort) f[18] = inAnfz(kurz(a.ort, 30));
      f[19] = inAnfz((e.land ?? "DE").toUpperCase().slice(0, 2) || "DE");
      return f.join(";");
    });
  return [kopf.join(";"), DEBKRED_SPALTEN.join(";"), ...zeilen].join("\r\n") + "\r\n";
}

/** Fachlich unsichere Punkte – für die PRUEFLISTE. */
export function pruefpunktePersonenkonten(): string[] {
  return [
    "E-165 Personenkonten: Nummernkreise Debitoren 10000–69999, Kreditoren 70000–99999 (DATEV-Standard bei Sachkontenlänge 4, laut Lexware- und Pickware-Hilfe) – fortlaufend ab 10000/70000; ob die Kanzlei eigene Kreise (z. B. alphabetisch) will, im Testimport klären.",
    "E-165 Stammdaten „Debitoren/Kreditoren“: Kopf EXTF/700/16/Formatversion 5 laut Formatübersichten von Drittanbietern (nicht aus der DATEV-Formatbeschreibung selbst); nur die Spalten 1–40; Adressattyp 2 (Unternehmen) bzw. 0 (keine Angabe), EU-Land und EU-UStID getrennt, Adressart „STR“ – im Testimport prüfen.",
    "E-165 Zwei Geräte vergeben offline dieselbe Nummer an verschiedene Kunden: wird beim Zusammenführen nicht aufgelöst (selten; die LIESMICH nennt doppelte Nummern).",
  ];
}
