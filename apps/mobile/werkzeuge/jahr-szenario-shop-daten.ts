/**
 * Jahres-Szenario „Kerzenwerk Lina Hoff“ (Hamburg, 2026) – nur die ROHDATEN und eine davon UNABHÄNGIGE Rechnung der
 * erwarteten Kennzahlen: Umsatzsteuer je Monat nach vereinbarten Entgelten (Soll, § 13 Abs. 1 Nr. 1 a UStG) mit
 * Inland, innergemeinschaftlichen Lieferungen (Kz 41), § 13b-Leistungen (Kz 46/47/67) und – getrennt – den
 * Fernverkäufen über den One-Stop-Shop (§ 3c, § 18j UStG) je Quartal und Land; dazu die Einnahmen-Überschuss-Rechnung
 * (Zufluss/Abfluss, § 4 Abs. 3, § 11 EStG). Diese Datei importiert absichtlich nichts aus der App oder aus
 * @amtlos/fachlogik – nur die kleinen Formatierhilfen des Café-Szenarios (jahr-szenario-daten.ts, ebenfalls ohne
 * App-Bezug). Prüferinnen und Prüfer sollen die Ausgaben der App (werkzeuge/jahr-szenario-shop.ts) dagegen halten.
 *
 * Alle Namen, Anschriften, Steuer- und Kontonummern des Betriebs, der Kundschaft und der meisten Lieferanten sind
 * erfunden (Domains auf .example); PayPal, Stripe und Meta stehen als die im Auftrag genannten Dienste. Beträge in Cent.
 */
import { de, eur, rund } from "./jahr-szenario-daten";

export { de, eur, rund };

// ---------------------------------------------------------------- Hilfen (eigene Implementierung, nicht aus der App)

const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);
export const monat = (iso: string) => iso.slice(0, 7);
export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const MONATE_2026 = MONATE.map((_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
export const quartalVon = (m: string) => `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`;
/** Netto aus Brutto (kaufmännisch auf Cent) */
export const nettoAus = (brutto: number, satz: number) => rund((brutto * 100) / (100 + satz));
/** volle Euro (ELSTER rechnet die Bemessungsgrundlagen in vollen Euro) */
const voll = (c: number) => Math.trunc(c / 100) * 100;

/** deutsche IBAN mit gültiger Prüfziffer aus BLZ und Kontonummer (erfundenes Konto) */
function ibanDe(blz: string, konto: string): string {
  const bban = blz + konto.padStart(10, "0");
  let rest = 0;
  for (const z of `${bban}131400`) rest = (rest * 10 + Number(z)) % 97;
  return `DE${String(98 - rest).padStart(2, "0")}${bban}`;
}

/** nächster Werktag (Sa/So → Montag; Feiertage spielen an den verwendeten Tagen keine Rolle) */
function werktag(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function letzterBankarbeitstag(jahr: number, m: number): string {
  const d = new Date(Date.UTC(jahr, m, 0, 12));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- Betrieb

export const JAHR = "2026";
export const BETRIEB = {
  name: "Kerzenwerk Lina Hoff",
  strasse: "Bahrenfelder Straße 244",
  plz: "22765",
  ort: "Hamburg",
  bundesland: "Hamburg",
  verantwortlich: "Lina Hoff",
  telefon: "040 85407219",
  email: "hallo@kerzenwerk-hoff.example",
  website: "www.kerzenwerk-hoff.example",
  steuernummer: "43/158/02741",
  ust_idnr: "DE347215896",
  iban: ibanDe("20050550", "1384402917"),
  bank: "Hamburger Sparkasse",
  bic: "HASPDEHHXXX",
  rechtsform: "Einzelunternehmen",
  versteuerung: "soll",
  farbe: "#8A5A44",
};
export const GRUENDUNG = "2023-04-01";

export const KUNDEN = {
  k1: { name: "Hafenliebe GmbH", anschrift: "Ottenser Hauptstraße 14\n22765 Hamburg", email: "einkauf@hafenliebe.example" },
  k2: { name: "Hotel Elbresidenz GmbH & Co. KG", anschrift: "Elbchaussee 301\n22605 Hamburg", email: "kreditoren@elbresidenz.example" },
  k3: { name: "Wohnkultur Steiner GmbH", anschrift: "Herrengasse 17\n8010 Graz\nÖsterreich", email: "buchhaltung@wohnkultur-steiner.example", ust_idnr: "ATU68215437" },
  k4: { name: "Lisa Brandt", anschrift: "Eppendorfer Landstraße 61\n20249 Hamburg" },
  k5: { name: "Laden Kleinod e. K.", anschrift: "Hüxstraße 88\n23552 Lübeck", email: "rechnung@kleinod-luebeck.example" },
  k6: { name: "Jonas Albers", anschrift: "Holtenauer Straße 129\n24105 Kiel" },
  k7: { name: "Nordwind Consulting GmbH", anschrift: "Neuer Wall 50\n20354 Hamburg", email: "office@nordwind-consulting.example" },
  k8: { name: "Tanja Möller", anschrift: "Am Felde 9\n22765 Hamburg" },
  // Nachtrag StB 22.10.2026: Privatpersonen im EU-Ausland, die per E-Mail (nicht über den Shop) bestellen – OSS-Rechnungen
  k9: { name: "Katharina Weber", anschrift: "Gumpendorfer Straße 72\n1060 Wien\nÖsterreich" },
  k10: { name: "Sanne de Vries", anschrift: "Oudegracht 211\n3511 NG Utrecht\nNiederlande" },
  k11: { name: "Camille Rousseau", anschrift: "12 Rue Mercière\n69002 Lyon\nFrankreich" },
  k12: { name: "Pieter Claes", anschrift: "Korenlei 9\n9000 Gent\nBelgien" },
} as const;
export type KundeId = keyof typeof KUNDEN;
/** Steuerart der Kundschaft: Inland, Unternehmen in Österreich (igL), Privatperson im EU-Ausland (OSS) */
export const KUNDE_ORT: Record<KundeId, "inland" | "eu_b2b" | "eu_b2c"> = { k1: "inland", k2: "inland", k3: "eu_b2b", k4: "inland", k5: "inland", k6: "inland", k7: "inland", k8: "inland", k9: "eu_b2c", k10: "eu_b2c", k11: "eu_b2c", k12: "eu_b2c" };

export const MITARBEITERIN = {
  m1: {
    name: "Paula Krüger", anschrift: "Große Rainstraße 31\n22765 Hamburg", geburtsdatum: "2001-06-14", geburtsort: "Itzehoe", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Packen und Versand (Minijob)", beginn: "2025-09-01", steuer_id: "57204918366", sv_nummer: "13140601K513", krankenkasse: "BARMER", iban: ibanDe("20050550", "1399120458"),
  },
} as const;

// ---------------------------------------------------------------- Ausgangsrechnungen

export interface Pos { bez: string; menge: number; einheit: string; preis: number; satz: 19 | 7 | 0 }
export interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  /** Leistungsdatum (ISO), null = wie Rechnungsdatum */
  leistung: string | null;
  ziel: "7" | "14" | "30" | "sofort";
  kunde: KundeId;
  pos: Pos[];
  hinweis: string;
  /** innergemeinschaftliche Lieferung (Hinweis „igl“, 0 %) */
  igl?: boolean;
  /** Zahlungseingang (Zufluss für die EÜR; bei Zahlung VOR der Leistung entsteht die Steuer schon mit der Vereinnahmung) */
  bezahlt: string | null;
  storno?: { datum: string; nummer: string; id: string; grund: string };
  /** ersetzt die stornierte Rechnung */
  ersetzt?: string;
  /** Rechnung zu einer Shop-Bestellung, deren Umsatz schon im Shop-Bericht steht (Brutto laut Shop) */
  shopBestellung?: { nr: string; brutto: number };
  /**
   * Nachtrag StB 22.10.2026: Fernverkauf an eine Privatperson im EU-Ausland nach Überschreiten der EU-Schwelle (§ 3c
   * Abs. 4 UStG, 17.07.2026) – Steuer des Bestimmungslands (Regelsatz laut `LAENDER`), OSS-Erklärung beim BZSt, nicht in
   * der deutschen Voranmeldung. Die Positionen stehen mit „19“ in den Rohdaten; gerechnet wird mit dem Satz des Landes.
   */
  oss?: Land;
  worum: string;
}

const DANKE = "Vielen Dank für Ihre Bestellung.\nBitte geben Sie bei der Zahlung die Rechnungsnummer an.";
const p = (bez: string, menge: number, einheit: string, preis: number, satz: 19 | 0 = 19): Pos => ({ bez, menge, einheit, preis, satz });
const KERZE = "Duftkerze im Glas 180 g, Rapswachs, Baumwolldocht";
const SEIFE = "Naturseife 100 g, kaltgerührt (kosmetisches Mittel)";
const STUMPEN = "Stumpenkerze Rapswachs 7 × 12 cm";
const SET = "Geschenkset „Winterlicht“ (Duftkerze und zwei Naturseifen)";
const VERSAND = "Versandkostenpauschale Großhandel";
/** Hinweis auf OSS-Rechnungen (Ware wird versandt, Ort der Lieferung im Bestimmungsland, § 3c Abs. 1 UStG) */
const OSS_HINWEIS = (land: "AT" | "NL" | "FR" | "BE") =>
  `Fernverkauf: Die Lieferung ist in ${{ AT: "Österreich", NL: "den Niederlanden", FR: "Frankreich", BE: "Belgien" }[land]} steuerbar (§ 3c UStG); berechnet ist die Umsatzsteuer des Bestimmungslands.\nVielen Dank für Ihre Bestellung.`;
const IGL_HINWEIS = "Lieferung an: Wohnkultur Steiner GmbH, Herrengasse 17, 8010 Graz, Österreich. Beförderung durch HanseVersand Paketdienst GmbH.\nVielen Dank für Ihre Bestellung.";

export const RECHNUNGEN: Rechnung[] = [
  { id: "r01", nummer: "2026-001", datum: "2026-01-20", leistung: "2026-01-19", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-02-02",
    worum: "Großhandel Concept-Store Hamburg: 120 Duftkerzen, 60 Seifen, Versand. Bezahlt im Februar (EÜR), USt im Januar (Soll, Leistung 19.01.).",
    pos: [p(KERZE, 120, "Stück", 1120), p(SEIFE, 60, "Stück", 395), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r02", nummer: "2026-002", datum: "2026-02-10", leistung: "2026-02-09", ziel: "30", kunde: "k2", hinweis: DANKE, bezahlt: "2026-03-06",
    worum: "Hotel: 400 Gästeseifen 25 g und 20 Duftkerzen für die Lobby.",
    pos: [p("Gästeseife 25 g, einzeln in Papier", 400, "Stück", 115), p(KERZE, 20, "Stück", 1120)] },
  { id: "r03", nummer: "2026-003", datum: "2026-03-05", leistung: "2026-03-03", ziel: "30", kunde: "k3", igl: true, hinweis: IGL_HINWEIS, bezahlt: "2026-03-30",
    worum: "INNERGEMEINSCHAFTLICHE LIEFERUNG nach Graz (Österreich), Kundin mit USt-IdNr. ATU68215437: 0 % mit Hinweis „igl“ (Kz 41, Zusammenfassende Meldung Q1).",
    pos: [p(KERZE, 96, "Stück", 1120, 0), p(SEIFE, 48, "Stück", 395, 0), p("Fracht Österreich (Palette)", 1, "Pauschale", 3900, 0)] },
  { id: "r04", nummer: "2026-004", datum: "2026-03-18", leistung: "2026-03-17", ziel: "sofort", kunde: "k4", hinweis: "Vielen Dank – alles Gute für Ihre Hochzeit!", bezahlt: "2026-03-18",
    worum: "Privatkundin (Rechnung auf Wunsch): 80 Mini-Kerzen als Gastgeschenke mit personalisierter Banderole, direkt per E-Mail bestellt (nicht über den Shop).",
    pos: [p("Gastgeschenk Mini-Kerze 60 g mit Banderole", 80, "Stück", 420), p("Personalisierung der Banderolen (Namen und Datum)", 1, "Pauschale", 4500)] },
  { id: "r05", nummer: "2026-005", datum: "2026-04-14", leistung: "2026-04-13", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-04-27",
    worum: "Großhandel Concept-Store: Frühjahrsbestellung.",
    pos: [p(KERZE, 96, "Stück", 1120), p(STUMPEN, 48, "Stück", 680), p(SEIFE, 60, "Stück", 395), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r06", nummer: "2026-006", datum: "2026-05-06", leistung: "2026-05-05", ziel: "14", kunde: "k5", hinweis: DANKE, bezahlt: null,
    storno: { datum: "2026-05-08", nummer: "2026-007", id: "r07", grund: "Einzelpreis Duftkerze falsch (12,20 € statt 11,20 € laut Händlerpreisliste) – Storno und neue Rechnung 2026-008" },
    worum: "Händlerin Lübeck mit FALSCHEM Einzelpreis (12,20 €) → Storno 2026-007 und neue Rechnung 2026-008 zwei Tage später, alles im Mai.",
    pos: [p(KERZE, 48, "Stück", 1220), p(SEIFE, 36, "Stück", 395), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r08", nummer: "2026-008", datum: "2026-05-08", leistung: "2026-05-05", ziel: "14", kunde: "k5", ersetzt: "r06", hinweis: `Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-006 vom 06.05.2026.\n${DANKE}`, bezahlt: "2026-05-22",
    worum: "Neue Rechnung mit richtigem Preis (11,20 €), Leistung weiter 05.05.",
    pos: [p(KERZE, 48, "Stück", 1120), p(SEIFE, 36, "Stück", 395), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r09", nummer: "2026-009", datum: "2026-06-16", leistung: "2026-06-15", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-06-29",
    worum: "Großhandel Concept-Store: Sommerbestellung.",
    pos: [p(KERZE, 72, "Stück", 1120), p(SEIFE, 72, "Stück", 395), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r10", nummer: "2026-010", datum: "2026-07-08", leistung: "2026-07-07", ziel: "30", kunde: "k2", hinweis: DANKE, bezahlt: "2026-08-05",
    worum: "Hotel: 600 Gästeseifen und 30 Duftkerzen.",
    pos: [p("Gästeseife 25 g, einzeln in Papier", 600, "Stück", 115), p(KERZE, 30, "Stück", 1120)] },
  { id: "r11", nummer: "2026-011", datum: "2026-08-12", leistung: "2026-08-10", ziel: "sofort", kunde: "k6", hinweis: "Rechnung zu Ihrer Bestellung #2391 im Onlineshop, bereits bezahlt per PayPal am 10.08.2026. Vielen Dank!", bezahlt: "2026-08-10",
    shopBestellung: { nr: "#2391", brutto: 7960 },
    worum: "Privatkunde wünscht zu seiner SHOP-BESTELLUNG #2391 (79,60 € brutto, im Shop-Bericht August enthalten) eine Rechnung. Netto eingegeben (20,92 € je Kerze statt 24,90 € brutto) → 79,59 € statt 79,60 €. Beim Ergänzen der Shop-Umsätze von Hand muss diese Bestellung herausgerechnet werden, sonst zählt sie doppelt.",
    pos: [p("Duftkerze im Glas 180 g „Feigenblatt“", 3, "Stück", 2092), p("Versand innerhalb Deutschlands", 1, "Pauschale", 412)] },
  { id: "r12", nummer: "2026-012", datum: "2026-09-09", leistung: "2026-09-08", ziel: "30", kunde: "k3", igl: true, hinweis: IGL_HINWEIS, bezahlt: "2026-10-06",
    worum: "Zweite INNERGEMEINSCHAFTLICHE LIEFERUNG nach Graz (Kz 41 September, ZM Q3), bezahlt im Oktober.",
    pos: [p(KERZE, 144, "Stück", 1120, 0), p(SEIFE, 96, "Stück", 395, 0), p(STUMPEN, 48, "Stück", 680, 0), p("Fracht Österreich (Palette)", 1, "Pauschale", 4900, 0)] },
  { id: "r13", nummer: "2026-013", datum: "2026-09-25", leistung: "2026-09-24", ziel: "14", kunde: "k5", hinweis: DANKE, bezahlt: null,
    storno: { datum: "2026-10-14", nummer: "2026-014", id: "r14", grund: "Lieferung wegen Transportschadens vollständig zurückgenommen (Rücksendung am 12.10.2026 erhalten)" },
    worum: "Händlerin Lübeck: Lieferung vom 24.09. (USt September) kommt wegen Transportschadens vollständig zurück → Storno 2026-014 im OKTOBER (Minderung nach § 17 UStG im Monat der Rückgängigmachung), nie bezahlt.",
    pos: [p(KERZE, 60, "Stück", 1120), p(STUMPEN, 24, "Stück", 680), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r15", nummer: "2026-015", datum: "2026-10-20", leistung: "2026-11-16", ziel: "14", kunde: "k7", hinweis: "Lieferung am 16.11.2026. Vielen Dank für Ihren Auftrag.", bezahlt: "2026-10-30",
    worum: "Firmengeschenke: Rechnung im Oktober, Lieferung (Leistung) erst am 16.11., aber VORAB BEZAHLT am 30.10. → nach § 13 Abs. 1 Nr. 1 a Satz 4 UStG entsteht die Steuer schon im OKTOBER (Vereinnahmung vor Leistung).",
    pos: [p(SET, 50, "Stück", 2250), p("Personalisierte Grußkarte je Set", 50, "Stück", 120), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r16", nummer: "2026-016", datum: "2026-11-10", leistung: "2026-11-09", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-11-24",
    worum: "Großhandel Concept-Store: Weihnachtsbestellung.",
    pos: [p(KERZE, 144, "Stück", 1120), p(SEIFE, 96, "Stück", 395), p(SET, 48, "Stück", 2250), p(VERSAND, 1, "Pauschale", 1490)] },
  { id: "r17", nummer: "2026-017", datum: "2026-11-25", leistung: "2026-11-24", ziel: "30", kunde: "k2", hinweis: DANKE, bezahlt: "2026-12-22",
    worum: "Hotel: Adventskerzen-Sets und Gästeseifen.",
    pos: [p("Adventskerzen-Set (4 Stumpen, Rapswachs)", 60, "Stück", 1480), p("Gästeseife 25 g, einzeln in Papier", 500, "Stück", 115)] },
  { id: "r18", nummer: "2026-018", datum: "2026-12-04", leistung: "2026-12-03", ziel: "7", kunde: "k8", hinweis: "Vielen Dank – frohe Weihnachten!", bezahlt: "2026-12-11",
    worum: "Privatkundin (Rechnung auf Wunsch, Bestellung per E-Mail): 30 Geschenksets für die Weihnachtsfeier ihres Vereins; Endpreis 35,00 € je Set, netto eingegeben (29,41 €).",
    pos: [p(SET, 30, "Stück", 2941)] },
  { id: "r19", nummer: "2026-019", datum: "2026-12-15", leistung: "2026-12-14", ziel: "30", kunde: "k5", hinweis: DANKE, bezahlt: "2027-01-12",
    worum: "Händlerin Lübeck: Nachbestellung Weihnachten – zum 31.12. offen (USt Dezember, Einnahme erst 2027).",
    pos: [p(KERZE, 48, "Stück", 1120), p(SEIFE, 48, "Stück", 395), p(SET, 24, "Stück", 2250), p(VERSAND, 1, "Pauschale", 1490)] },
  // ---- Nachtrag StB 22.10.2026 (Heckler und Busch): Fernverkäufe an Privatpersonen in AT, NL, FR, BE per E-Mail-Bestellung
  // (nicht über den Shop, also nicht im Shop-Bericht) nach Überschreiten der EU-Schwelle am 17.07. – OSS mit dem Regelsatz
  // des Bestimmungslands; im DATEV-Stapel auf 8320 mit Land in Feld 40 (ohne USt-IdNr.) und Satz in Feld 41.
  { id: "r20", nummer: "2026-020", datum: "2026-12-16", leistung: "2026-12-15", ziel: "7", kunde: "k9", oss: "AT", hinweis: OSS_HINWEIS("AT"), bezahlt: "2026-12-18",
    worum: "OSS-FERNVERKAUF nach Wien (Privatkundin, Bestellung per E-Mail): 12 Geschenksets, Versand Österreich – österreichische USt 20 %, OSS-Erklärung Q4, nicht in der deutschen Voranmeldung.",
    pos: [p(SET, 12, "Stück", 2250), p("Versand nach Österreich", 1, "Pauschale", 1290)] },
  { id: "r21", nummer: "2026-021", datum: "2026-12-17", leistung: "2026-12-16", ziel: "7", kunde: "k10", oss: "NL", hinweis: OSS_HINWEIS("NL"), bezahlt: "2026-12-22",
    worum: "OSS-FERNVERKAUF nach Utrecht (Privatkundin): 24 Duftkerzen für eine Hochzeit – niederländische USt 21 %.",
    pos: [p(KERZE, 24, "Stück", 1120), p("Versand in die Niederlande", 1, "Pauschale", 1490)] },
  { id: "r22", nummer: "2026-022", datum: "2026-12-18", leistung: "2026-12-17", ziel: "7", kunde: "k11", oss: "FR", hinweis: OSS_HINWEIS("FR"), bezahlt: "2026-12-23",
    worum: "OSS-FERNVERKAUF nach Lyon (Privatkundin): 6 Geschenksets und 10 Naturseifen – französische USt 20 %.",
    pos: [p(SET, 6, "Stück", 2250), p(SEIFE, 10, "Stück", 395), p("Versand nach Frankreich", 1, "Pauschale", 1690)] },
  { id: "r23", nummer: "2026-023", datum: "2026-12-21", leistung: "2026-12-18", ziel: "14", kunde: "k12", oss: "BE", hinweis: OSS_HINWEIS("BE"), bezahlt: "2027-01-08",
    worum: "OSS-FERNVERKAUF nach Gent (Privatkunde): 36 Mini-Kerzen mit Banderole als Gastgeschenke – belgische USt 21 %; zum 31.12. offen (Soll: OSS Q4, Einnahme erst 2027).",
    pos: [p("Gastgeschenk Mini-Kerze 60 g mit Banderole", 36, "Stück", 420), p("Personalisierung der Banderolen (Namen und Datum)", 1, "Pauschale", 4500), p("Versand nach Belgien", 1, "Pauschale", 1490)] },
];

// ---------------------------------------------------------------- Onlineshop (Umsatzberichte „Shopwerk“, Beträge BRUTTO)

/**
 * Monatsbericht des Shops (Brutto inkl. USt und Versandkosten): Verkäufe an Verbraucher in Deutschland, Erstattungen
 * (Retouren/Widerruf, alle Inland), Fernverkäufe in andere EU-Länder. Bis zur Überschreitung der EU-weiten Schwelle
 * von 10.000 € (§ 3c Abs. 4 UStG) mit deutscher USt (`euDe`), danach mit der USt des Bestimmungslands (`eu`).
 */
export interface ShopMonat { monat: string; de: number; erstattung: number; euDe: number; eu: Partial<Record<Land, number>> }
export type Land = "AT" | "NL" | "FR" | "BE";
/**
 * Regelsteuersätze der Bestimmungsländer 2026 (Kerzen und Seifen: Regelsatz). Nachtrag StB 22.10.2026 geprüft am
 * 22.10.2026: AT 20 %, NL 21 %, FR 20 %, BE 21 % – Quelle: VATupdate, „Global VAT Rates by Country (2026) – Standard and
 * Reduced Rates“ (25.07.2026), https://www.vatupdate.com/2026/07/25/global-vat-rates-by-country-2026-standard-and-reduced-rates/
 * (Änderungen 2026 dort nur bei ermäßigten Sätzen: AT Lebensmittel, NL Beherbergung, BE Gastronomie).
 */
export const LAENDER: Record<Land, { name: string; satz: number }> = { AT: { name: "Österreich", satz: 20 }, NL: { name: "Niederlande", satz: 21 }, FR: { name: "Frankreich", satz: 20 }, BE: { name: "Belgien", satz: 21 } };

export const SHOP: ShopMonat[] = [
  { monat: "2026-01", de: 348040, erstattung: -4980, euDe: 139000, eu: {} },
  { monat: "2026-02", de: 291560, erstattung: -2490, euDe: 112000, eu: {} },
  { monat: "2026-03", de: 364010, erstattung: -7470, euDe: 154000, eu: {} },
  { monat: "2026-04", de: 321280, erstattung: -2490, euDe: 168000, eu: {} },
  { monat: "2026-05", de: 390450, erstattung: -5380, euDe: 186000, eu: {} },
  { monat: "2026-06", de: 338820, erstattung: 0, euDe: 211000, eu: {} },
  // Schwelle überschritten mit Bestellung #2219 am 17.07. (Österreich, 289,00 €) – ab dieser Bestellung Bestimmungsland
  { monat: "2026-07", de: 315070, erstattung: -4980, euDe: 194000, eu: { AT: 70150, NL: 36840, FR: 25570, BE: 19830 } },
  { monat: "2026-08", de: 347690, erstattung: -2490, euDe: 0, eu: { AT: 112060, NL: 69020, FR: 48090, BE: 31040 } },
  { monat: "2026-09", de: 438030, erstattung: -3380, euDe: 0, eu: { AT: 130580, NL: 81230, FR: 56610, BE: 40270 } },
  { monat: "2026-10", de: 612080, erstattung: -7470, euDe: 0, eu: { AT: 169040, NL: 104560, FR: 70220, BE: 51590 } },
  { monat: "2026-11", de: 984560, erstattung: -9960, euDe: 0, eu: { AT: 284030, NL: 176090, FR: 112050, BE: 84520 } },
  { monat: "2026-12", de: 1241690, erstattung: -12450, euDe: 0, eu: { AT: 341070, NL: 211540, FR: 139060, BE: 102080 } },
];
/** EU-Fernverkäufe 2025 (netto) – unter der Schwelle, also startet 2026 mit deutscher USt */
export const EU_FERNVERKAUF_2025 = 784000;
export const SCHWELLE = 1000000;
/** die Bestellung, mit der die Schwelle überschritten wird: schon mit österreichischer USt (§ 3c Abs. 4 UStG „überschreitet“) */
export const SCHWELLEN_BESTELLUNG = { nr: "#2219", datum: "2026-07-17", land: "AT" as Land, brutto: 28900 };

// ---------------------------------------------------------------- Märkte (offene Ladenkasse, Brutto 19 %)

/** Tageseinnahmen Weihnachtsmarkt Ottensen 01.–23.12.2026 laut Kassenbericht (Brutto) */
export const MARKT_DEZ_TAGE: number[] = [
  31250, 29800, 34550, 51200, 68850, 40100, 28950, 33400, 35600, 39850, 54500, 70250, 37700, 30150, 34200, 36550, 41200, 59800, 72150, 29800, 34600, 41900, 39100,
];
/** Bareinnahmen an Marktständen je Monat (Kunsthandwerkermarkt April–September, Weihnachtsmarkt ab 23.11.) */
export const MARKT: Record<string, number> = {
  "2026-01": 0, "2026-02": 0, "2026-03": 0, "2026-04": 61200, "2026-05": 84550, "2026-06": 112000, "2026-07": 98050, "2026-08": 121500, "2026-09": 89000,
  "2026-10": 0, "2026-11": 368000, "2026-12": sum(MARKT_DEZ_TAGE),
};
/** Kassenbuch Dezember: Wechselgeld zu Beginn, Einzahlungen auf das Geschäftskonto */
export const KASSE_DEZ = { anfang: 15000, einzahlungen: [{ datum: "2026-12-07", betrag: 250000 }, { datum: "2026-12-14", betrag: 260000 }, { datum: "2026-12-21", betrag: 270000 }, { datum: "2026-12-23", betrag: 100000 }] };

// ---------------------------------------------------------------- Minijob (Annahmen „laut Abrechnung“, nicht nachgerechnet)

/** 40 Std. × 14,50 € = 580,00 € im Monat (Minijob-Grenze 2026: 603 €); RV-Pflicht (nicht befreit) */
export const MINIJOB = { stunden: 40, lohn: 1450, brutto: 58000, an_rv: 2088 };
/** Pauschalabgaben des Arbeitgebers an die Minijob-Zentrale (Annahme 2026): KV 13 %, RV 15 %, Pauschsteuer 2 %, U1 0,8 %, U2 0,22 %, InsG 0,15 % */
export const MINIJOB_AG = { kv: 7540, rv: 8700, pauschsteuer: 1160, u1: 464, u2: 128, insg: 87 };
export const minijobAg = sum(Object.values(MINIJOB_AG));
export const minijobMonat = MINIJOB.brutto + minijobAg;
export const LOHN_MONATE = MONATE.map((m, i) => ({ monat: `${m} 2026`, zahltag: letzterBankarbeitstag(2026, i + 1), brutto: MINIJOB.brutto, sv_an: MINIJOB.an_rv, sv_ag: minijobAg }));

// ---------------------------------------------------------------- Belege

export interface BelegPos { text: string; menge?: string; satz: 19 | 7 | 0; betrag: number }
export interface BelegRoh {
  id: string;
  datum: string;
  lieferant: string;
  anschrift: string;
  nummer: string | null;
  kategorie: string;
  /** „netto“: Rechnung weist Netto und USt je Satz aus; „brutto“: Kassenbon bzw. ohne USt */
  art: "netto" | "brutto";
  saetze: { satz: 19 | 7 | 0; betrag: number }[];
  vorsteuer: boolean;
  zahlung: "bank" | "bar" | "privat";
  bezahlt: string | null;
  /** Leistung eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers: Steuerschuldnerschaft nach § 13b Abs. 1, Abs. 5 UStG */
  p13b?: boolean;
  /** steuerfreie Finanzdienstleistung eines ausländischen Unternehmers (Annahme: § 4 Nr. 8 UStG, keine § 13b-Steuer) */
  frei?: boolean;
  notiz?: string;
  pos: BelegPos[];
  worum: string;
}
const posSatz = (pos: BelegPos[], satz: number) => sum(pos.filter((x) => x.satz === satz).map((x) => x.betrag));
const ausPos = (pos: BelegPos[]) => ([19, 7, 0] as const).filter((s) => pos.some((x) => x.satz === s)).map((satz) => ({ satz, betrag: posSatz(pos, satz) }));
const einfach = (o: Omit<BelegRoh, "saetze">): BelegRoh => ({ ...o, saetze: ausPos(o.pos) });
const n19 = (text: string, betrag: number, menge?: string): BelegPos => ({ text, betrag, satz: 19, ...(menge ? { menge } : {}) });

const WACHS = { lieferant: "Wachshandel Nord GmbH", anschrift: "Billbrookdeich 167\n22113 Hamburg" };
const AROMA = { lieferant: "Aromaservice Lüneburg GmbH", anschrift: "Bei der Abtspferdetränke 4\n21335 Lüneburg" };
const SEIFENROH = { lieferant: "Seifenrohstoffe Bremen GmbH", anschrift: "Am Holzhafen 12\n28217 Bremen" };
const GLAS = { lieferant: "Glas & Docht GmbH", anschrift: "Sigmundstraße 220\n90431 Nürnberg" };
const KARTON = { lieferant: "Kartonage Hanse GmbH", anschrift: "Pinneberger Chaussee 60\n22523 Hamburg" };
const VERSANDDIENST = { lieferant: "HanseVersand Paketdienst GmbH", anschrift: "Hörgensweg 5\n22523 Hamburg" };
const SHOPWERK = { lieferant: "Shopwerk Commerce Ltd.", anschrift: "1 Grand Canal Quay\nDublin D02 Y925, Irland" };
const STRIPE = { lieferant: "Stripe Payments Europe, Ltd.", anschrift: "1 Grand Canal Street Lower, Grand Canal Dock\nDublin D02 H210, Irland" };
const PAYPAL = { lieferant: "PayPal (Europe) S.à r.l. et Cie, S.C.A.", anschrift: "22-24 Boulevard Royal\nL-2449 Luxemburg" };
const META = { lieferant: "Meta Platforms Ireland Ltd.", anschrift: "Merrion Road\nDublin 4, D04 X2K5, Irland" };
const UST_ID_NOTIZ = "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge) – USt-IdNr. des Empfängers DE347215896";

function versand(id: string, datum: string, q: number, inland: number, eu: number, bezahlt: string): BelegRoh {
  const pos = [n19(`Paketversand Inland Q${q}/2026`, inland * 429, `${inland} × 4,29 €`), n19(`Paketversand EU Q${q}/2026`, eu * 1190, `${eu} × 11,90 €`)];
  return { id, datum, ...VERSANDDIENST, nummer: `HV-26-Q${q}-0712`, kategorie: "buero", art: "netto", saetze: ausPos(pos), vorsteuer: true, zahlung: "bank", bezahlt, notiz: "Versandlabels laut Quartalsabrechnung (Lastschrift)", pos, worum: `Versandlabels Q${q} (19 %): ${inland} Pakete Inland, ${eu} EU – als „Büro, Porto“ erfasst` };
}
function stripe(id: string, datum: string, q: number, betrag: number): BelegRoh {
  const pos: BelegPos[] = [{ text: `Stripe-Gebühren Q${q}/2026 (Kartenzahlungen, Klarna, Apple Pay) – mit den Auszahlungen verrechnet`, satz: 0, betrag }];
  return { id, datum, ...STRIPE, nummer: `STR-INV-2026-Q${q}`, kategorie: "buero", art: "brutto", saetze: ausPos(pos), vorsteuer: false, zahlung: "bank", bezahlt: datum, p13b: true, notiz: UST_ID_NOTIZ, pos, worum: `Zahlungsgebühren Stripe Q${q} aus IRLAND, § 13b (Kz 46/47/67), in der App mit 0 % erfasst` };
}
function lohnBeleg(id: string, datum: string, h: 1 | 2): BelegRoh {
  const von = h === 1 ? 0 : 6;
  const pos: BelegPos[] = LOHN_MONATE.slice(von, von + 6).map((l) => ({ text: `${l.monat}: Paula Krüger – Lohn ${eur(l.brutto)} € + Pauschalabgaben Minijob-Zentrale ${eur(l.sv_ag)} €`, satz: 0 as const, betrag: l.brutto + l.sv_ag }));
  return { id, datum, lieferant: "Eigenbeleg Minijob (Abrechnung Minijob-Zentrale)", anschrift: "Kerzenwerk Lina Hoff\nBahrenfelder Straße 244, 22765 Hamburg", nummer: `LJ-2026-H${h}`, kategorie: "personal", art: "brutto", saetze: ausPos(pos), vorsteuer: false, zahlung: "bank", bezahlt: datum, notiz: "Lohn 40 Std. × 14,50 €; Pauschalabgaben inkl. 2 % einheitliche Pauschsteuer", pos, worum: `Personalkosten Minijob ${h === 1 ? "Januar–Juni" : "Juli–Dezember"} als Eigenbeleg (0 %)` };
}

export const BELEGE: BelegRoh[] = [
  einfach({ id: "b01", datum: "2026-01-08", ...WACHS, nummer: "WN-26-0108", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-15", worum: "Rapswachs/Sojawachs 300 kg (19 %)",
    pos: [n19("Rapswachs-Pastillen für Containerkerzen", 145500, "300 kg × 4,85 €"), n19("Fracht", 3900)] }),
  einfach({ id: "b02", datum: "2026-04-02", ...WACHS, nummer: "WN-26-0402", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-04-09", worum: "Wachs 250 kg (19 %)",
    pos: [n19("Rapswachs-Pastillen für Containerkerzen", 121250, "250 kg × 4,85 €"), n19("Fracht", 3900)] }),
  einfach({ id: "b03", datum: "2026-08-03", ...WACHS, nummer: "WN-26-0803", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-08-10", worum: "Wachs 300 kg (19 %)",
    pos: [n19("Rapswachs-Pastillen für Containerkerzen", 148500, "300 kg × 4,95 €"), n19("Fracht", 3900)] }),
  einfach({ id: "b04", datum: "2026-10-05", ...WACHS, nummer: "WN-26-1005", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-10-12", worum: "Wachs 600 kg für das Weihnachtsgeschäft (19 %)",
    pos: [n19("Rapswachs-Pastillen für Containerkerzen", 297000, "600 kg × 4,95 €"), n19("Fracht (2 Paletten)", 6900)] }),
  einfach({ id: "b05", datum: "2026-02-03", ...AROMA, nummer: "AL-2026-0219", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-02-10", worum: "Ätherische Öle und Duftöl (19 %) – Gefahrstoffe, siehe Verzeichnis",
    pos: [n19("Lavendelöl fein, ätherisch", 16800, "2 l"), n19("Orangenöl süß, ätherisch", 8700, "3 l"), n19("Eukalyptusöl, ätherisch", 5400, "1 l"), n19("Kerzenduftöl „Winterwald“", 11800, "2 l")] }),
  einfach({ id: "b06", datum: "2026-09-14", ...AROMA, nummer: "AL-2026-1377", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-21", worum: "Ätherische Öle und Duftöl (19 %)",
    pos: [n19("Lavendelöl fein, ätherisch", 25200, "3 l"), n19("Orangenöl süß, ätherisch", 14500, "5 l"), n19("Eukalyptusöl, ätherisch", 10800, "2 l"), n19("Kerzenduftöl „Winterwald“", 23600, "4 l")] }),
  einfach({ id: "b07", datum: "2026-03-10", ...SEIFENROH, nummer: "SB-26-03117", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-17", worum: "Seifenrohstoffe: Natriumhydroxid und Sheabutter 19 %, Oliven- und Kokosöl (Lebensmittelqualität) 7 %",
    pos: [n19("Natriumhydroxid (Ätznatron) Plätzchen 99 %", 6250, "25 kg"), n19("Sheabutter raffiniert", 15750, "15 kg"), { text: "Olivenöl nativ (Lebensmittelqualität)", menge: "60 l", satz: 7, betrag: 49800 }, { text: "Kokosöl (Lebensmittelqualität)", menge: "40 kg", satz: 7, betrag: 19600 }] }),
  einfach({ id: "b08", datum: "2026-09-08", ...SEIFENROH, nummer: "SB-26-09288", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-15", worum: "Seifenrohstoffe (19 % und 7 %)",
    pos: [n19("Natriumhydroxid (Ätznatron) Plätzchen 99 %", 6250, "25 kg"), n19("Sheabutter raffiniert", 21000, "20 kg"), { text: "Olivenöl nativ (Lebensmittelqualität)", menge: "80 l", satz: 7, betrag: 66400 }, { text: "Kokosöl (Lebensmittelqualität)", menge: "60 kg", satz: 7, betrag: 29400 }] }),
  einfach({ id: "b09", datum: "2026-02-16", ...GLAS, nummer: "GD-26-00412", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-02-23", worum: "Kerzengläser, Deckel, Dochte (19 %)",
    pos: [n19("Kerzenglas 180 ml klar", 74400, "1.200 × 0,62 €"), n19("Deckel Kork", 21600, "1.200 × 0,18 €"), n19("Baumwolldocht gewachst mit Fuß", 9000, "2.000 × 0,045 €")] }),
  einfach({ id: "b10", datum: "2026-10-12", ...GLAS, nummer: "GD-26-01988", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-10-19", worum: "Kerzengläser, Deckel, Dochte (19 %)",
    pos: [n19("Kerzenglas 180 ml klar", 148800, "2.400 × 0,62 €"), n19("Deckel Kork", 43200, "2.400 × 0,18 €"), n19("Baumwolldocht gewachst mit Fuß", 13500, "3.000 × 0,045 €")] }),
  einfach({ id: "b11", datum: "2026-03-03", ...KARTON, nummer: "KH-260303-17", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-10", worum: "Versandverpackung (19 %) – systembeteiligungspflichtig nach VerpackG",
    pos: [n19("Versandkarton 1-wellig 300 × 200 × 150 mm", 87000, "1.500 × 0,58 €"), n19("Papierpolster-Rollen", 50000, "40 × 12,50 €"), n19("Papierklebeband", 10560, "48 × 2,20 €")] }),
  einfach({ id: "b12", datum: "2026-09-22", ...KARTON, nummer: "KH-260922-04", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-29", worum: "Versandverpackung und Geschenkboxen (19 %)",
    pos: [n19("Versandkarton 1-wellig 300 × 200 × 150 mm", 174000, "3.000 × 0,58 €"), n19("Papierpolster-Rollen", 75000, "60 × 12,50 €"), n19("Geschenkbox mit Sichtfenster", 55000, "500 × 1,10 €")] }),
  einfach({ id: "b13", datum: "2026-01-12", lieferant: "Grünpunkt Duales System GmbH", anschrift: "Rheinauhafen 9\n50678 Köln", nummer: "GP-2026-118734", kategorie: "sonstiges", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-19",
    worum: "Systembeteiligung Verkaufs- und Versandverpackungen 2026 (VerpackG, Planmengen: Glas 1.900 kg, Papier/Pappe 1.450 kg, Kunststoff 60 kg) (19 %)",
    pos: [n19("Beteiligungsentgelt 2026 laut Planmengenmeldung (LUCID-Nr. DE1234567890123)", 38640)] }),
  versand("b14", "2026-03-31", 1, 412, 118, "2026-04-07"),
  versand("b15", "2026-06-30", 2, 455, 152, "2026-07-07"),
  versand("b16", "2026-09-30", 3, 470, 210, "2026-10-07"),
  { ...versand("b17", "2026-12-31", 4, 980, 395, "2027-01-08"), worum: "Versandlabels Q4 (19 %) – Belegdatum 31.12.2026, Lastschrift erst 08.01.2027 (Vorsteuer Dezember, Ausgabe 2027)" },
  einfach({ id: "b18", datum: "2026-01-04", ...SHOPWERK, nummer: "SW-IE-2026-0045871", kategorie: "buero", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-01-04", p13b: true, notiz: UST_ID_NOTIZ,
    worum: "Shop-System Jahrestarif 2026 aus IRLAND im Voraus bezahlt – § 13b (Kz 46/47/67 im Januar), in der App mit 0 % erfasst",
    pos: [{ text: "Shopwerk „Grow“, Jahrestarif 01/2026–12/2026 (12 × 39,00 €)", satz: 0, betrag: 46800 }] }),
  stripe("b19", "2026-03-31", 1, 28640),
  stripe("b20", "2026-06-30", 2, 31275),
  stripe("b21", "2026-09-30", 3, 39820),
  stripe("b22", "2026-12-31", 4, 81165),
  einfach({ id: "b23", datum: "2026-06-30", ...PAYPAL, nummer: "PP-2026-H1", kategorie: "buero", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-06-30", frei: true, notiz: "Transaktionsgebühren, mit den Zahlungen verrechnet",
    worum: "PayPal-Transaktionsgebühren Januar–Juni aus LUXEMBURG (Annahme: steuerfreie Finanzdienstleistung, keine § 13b-Steuer)",
    pos: [{ text: "Transaktionsgebühren PayPal 01–06/2026 laut Gebührenübersicht", satz: 0, betrag: 74218 }] }),
  einfach({ id: "b24", datum: "2026-12-31", ...PAYPAL, nummer: "PP-2026-H2", kategorie: "buero", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-12-31", frei: true, notiz: "Transaktionsgebühren, mit den Zahlungen verrechnet",
    worum: "PayPal-Transaktionsgebühren Juli–Dezember (Annahme wie b23)",
    pos: [{ text: "Transaktionsgebühren PayPal 07–12/2026 laut Gebührenübersicht", satz: 0, betrag: 128644 }] }),
  einfach({ id: "b25", datum: "2026-03-31", ...META, nummer: "FBADS-26-03-118455", kategorie: "werbung", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-03-31", p13b: true, notiz: UST_ID_NOTIZ,
    worum: "Werbeanzeigen Instagram/Facebook März aus IRLAND – § 13b, in der App mit 0 %",
    pos: [{ text: "Werbeanzeigen März 2026 (Kampagne „Frühlingsdüfte“)", satz: 0, betrag: 35000 }] }),
  einfach({ id: "b26", datum: "2026-11-30", ...META, nummer: "FBADS-26-11-402917", kategorie: "werbung", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-11-30", p13b: true, notiz: UST_ID_NOTIZ,
    worum: "Werbeanzeigen November aus IRLAND – § 13b, in der App mit 0 %",
    pos: [{ text: "Werbeanzeigen November 2026 (Kampagne „Winterlicht“)", satz: 0, betrag: 90000 }] }),
  einfach({ id: "b27", datum: "2026-04-01", lieferant: "Bezirksamt Altona – Marktverwaltung", anschrift: "Platz der Republik 1\n22765 Hamburg", nummer: "MV-2026-0471", kategorie: "miete", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-04-10",
    worum: "Marktgebühren Kunsthandwerkermarkt April–September (Gebührenbescheid, ohne USt – Annahme)",
    pos: [{ text: "Standplatzgebühr Saison April–September 2026, 3 m Front", satz: 0, betrag: 62400 }] }),
  einfach({ id: "b28", datum: "2026-10-15", lieferant: "Winterzauber Veranstaltungs GmbH", anschrift: "Bahrenfelder Chaussee 49\n22761 Hamburg", nummer: "WZ-2026-0088", kategorie: "miete", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-10-26",
    worum: "Standmiete Weihnachtsmarkt 23.11.–23.12. (19 %)",
    pos: [n19("Standmiete Weihnachtsmarkt Ottensen, Hütte 2,5 × 2 m, 23.11.–23.12.2026", 240000), n19("Strompauschale", 18000)] }),
  einfach({ id: "b29", datum: "2026-02-24", lieferant: "Gastro-Technik Brandt GmbH", anschrift: "Wendenstraße 130\n20537 Hamburg", nummer: "GTB-26-0244", kategorie: "anlage", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-03",
    worum: "ANLAGE über 800 € netto: Wachsschmelzgerät 30 l mit Thermostat 1.490 € netto (Nutzungsdauer 8 Jahre angenommen, ab Februar)",
    pos: [n19("Wachsschmelzgerät 30 l, Edelstahl, Zapfhahn, Thermostat 40–120 °C", 139000), n19("Lieferung und Einweisung", 10000)] }),
  einfach({ id: "b30", datum: "2026-06-09", lieferant: "Bürotechnik Elbe GmbH", anschrift: "Stresemannstraße 163\n22769 Hamburg", nummer: "BTE-260609-3", kategorie: "gwg", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-06-09",
    worum: "GWG: Etikettendrucker für Produkt- und Versandetiketten 389 € netto",
    pos: [n19("Thermotransfer-Etikettendrucker 300 dpi mit Abreißkante", 38900)] }),
  einfach({ id: "b31", datum: "2026-03-20", lieferant: "Kosmetiksicherheit Dr. Annika Marx", anschrift: "Mühlenkamp 31\n22303 Hamburg", nummer: "KS-2026-031", kategorie: "beratung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-27",
    worum: "Sicherheitsbewertung (Sicherheitsbericht Teil B, Art. 10 VO (EG) Nr. 1223/2009) für sechs Seifenrezepturen (19 %)",
    pos: [n19("Sicherheitsbewertung kosmetischer Mittel, Seifenrezepturen 1–6", 108000, "6 × 180,00 €")] }),
  einfach({ id: "b32", datum: "2026-04-22", lieferant: "Steuerbüro Ahrens", anschrift: "Max-Brauer-Allee 80\n22765 Hamburg", nummer: "2026-0198", kategorie: "beratung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-04-30",
    worum: "Steuerberatung: EÜR und Erklärungen 2025 (19 %)",
    pos: [n19("Einnahmen-Überschuss-Rechnung 2025, Einkommen-, Umsatz- und Gewerbesteuererklärung 2025", 124000)] }),
  einfach({ id: "b33", datum: "2026-01-05", lieferant: "Postfach Marketing GmbH", anschrift: "Chausseestraße 86\n10115 Berlin", nummer: "PM-2026-77120", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-05",
    worum: "Newsletter-Dienst Jahrestarif 2026 (19 %) – Auftragsverarbeiter (AVV)",
    pos: [n19("Newsletter-Tarif „Start“ bis 2.500 Empfänger, 01–12/2026 (12 × 19,00 €)", 22800)] }),
  lohnBeleg("b34", "2026-06-30", 1),
  lohnBeleg("b35", "2026-12-31", 2),
  einfach({ id: "b36", datum: "2026-05-18", lieferant: "Bürobedarf Ottensen", anschrift: "Ottenser Hauptstraße 52\n22765 Hamburg", nummer: "Bon 0518-117", kategorie: "buero", art: "brutto", vorsteuer: true, zahlung: "privat", bezahlt: null,
    worum: "KLEINBETRAGSRECHNUNG (Kassenbon), PRIVAT bezahlt (Einlage): Etikettenpapier und Klebeband (19 %)",
    pos: [n19("Etikettenpapier A4 matt, 100 Blatt", 3490), n19("Klebeband transparent 6 Rollen", 1240)] }),
  einfach({ id: "b37", datum: "2026-01-15", lieferant: "Hanse Gewerbeversicherung AG", anschrift: "Überseering 30\n22297 Hamburg", nummer: "HG-80911-2026", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-01-15",
    worum: "Betriebs- und Produkthaftpflicht 2026 (Versicherungsteuer, keine USt)",
    pos: [{ text: "Betriebs- und Produkthaftpflicht inkl. Kosmetik-Produkthaftung 2026 (Beitrag inkl. 19 % Versicherungsteuer)", satz: 0, betrag: 41230 }] }),
  einfach({ id: "b38", datum: "2026-05-11", lieferant: "Handelskammer Hamburg", anschrift: "Adolphsplatz 1\n20457 Hamburg", nummer: "HK-2026-5531207", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-05-25",
    worum: "Kammerbeitrag 2026 (kein Umsatz, 0 %)",
    pos: [{ text: "Beitrag 2026 (Grundbeitrag und Umlage)", satz: 0, betrag: 18600 }] }),
  einfach({ id: "b39", datum: "2026-04-24", lieferant: "Berufsgenossenschaft Handel und Warenlogistik", anschrift: "M 5, 7\n68161 Mannheim", nummer: "BGHW-2025-118204", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-05-15",
    worum: "Unfallversicherungsbeitrag 2025 (Minijob) laut Beitragsbescheid (0 %)",
    pos: [{ text: "Beitrag 2025 laut Bescheid (Entgeltsumme Minijob)", satz: 0, betrag: 6420 }] }),
];

// ---------------------------------------------------------------- weitere Annahmen

/** Umsatzsteuer-Voranmeldung Dezember 2025, per Lastschrift eingezogen am Fälligkeitstag 12.01.2026 (10.01. ist ein Samstag) */
export const UST_DEZ_2025 = { betrag: 118740, gezahlt: "2026-01-12" };
/** Fälligkeit der Voranmeldung (10. des Folgemonats bzw. nächster Werktag) = Tag des Lastschrifteinzugs bzw. der Erstattung */
export const VA_TAG: Record<string, string> = Object.fromEntries(MONATE_2026.map((m, i) => [m, werktag(new Date(Date.UTC(2026, i + 1, 10, 12)).toISOString().slice(0, 10))]));
/** OSS-Erklärung und Zahlung: bis Ende des Folgemonats des Quartals (Q3 am 28.10.2026 gezahlt, Q4 erst 2027) */
export const OSS_ZAHLUNG: Record<string, string> = { "2026-Q3": "2026-10-28", "2026-Q4": "2027-01-27" };
/** AfA Wachsschmelzgerät: linear 8 Jahre (Annahme), ab Februar (11/12); Altbestand laut Anlagenverzeichnis (Annahme) */
export const AFA = { beleg: "b29", jahre: 8, monate: 11, altbestand: 42000 };

// ---------------------------------------------------------------- unabhängige Rechnung

export interface RechnungsSumme { netto: number; ust: number; brutto: number; gruppen: Record<string, { netto: number; ust: number }> }
/**
 * Zeile = Menge × Preis (auf Cent gerundet), USt je Satz aus der Netto-Summe des Satzes. `ossSatz`: Fernverkauf (OSS) –
 * Positionen mit Steuer tragen den Satz des Bestimmungslands statt 19 %.
 */
export function rechnungsSumme(pos: Pos[], ossSatz?: number): RechnungsSumme {
  const gruppen: Record<string, { netto: number; ust: number }> = {};
  for (const x of pos) {
    const zeile = rund((Math.round(x.menge * 10000) * x.preis) / 10000);
    const satz = ossSatz && x.satz > 0 ? ossSatz : x.satz;
    gruppen[satz] ??= { netto: 0, ust: 0 };
    gruppen[satz]!.netto += zeile;
  }
  for (const [satz, g] of Object.entries(gruppen)) g.ust = rund((g.netto * Number(satz)) / 100);
  const netto = sum(Object.values(gruppen).map((g) => g.netto));
  const ust = sum(Object.values(gruppen).map((g) => g.ust));
  return { netto, ust, brutto: netto + ust, gruppen };
}

/** ausgewiesene Steuer eines Belegs und daraus Netto/Brutto */
export function belegSumme(b: BelegRoh) {
  let netto = 0;
  let ust = 0;
  const jeSatz: { satz: number; netto: number; ust: number; brutto: number }[] = [];
  for (const s of b.saetze) {
    const n = b.art === "netto" ? s.betrag : nettoAus(s.betrag, s.satz);
    const u = b.art === "netto" ? rund((s.betrag * s.satz) / 100) : s.betrag - n;
    netto += n;
    ust += u;
    jeSatz.push({ satz: s.satz, netto: n, ust: u, brutto: n + u });
  }
  return { netto, ust, brutto: netto + ust, vorsteuer: b.vorsteuer ? ust : 0, jeSatz };
}

export interface Vorgang { nummer: string; art: "rechnung" | "storno"; datum: string; leistung: string; bezahlt: string | null; vz: 1 | -1; s: RechnungsSumme; kunde: KundeId; r: Rechnung; ustMonat: string }
/**
 * Rechnungen und Stornos mit Vorzeichen und dem Monat, in dem die Steuer entsteht (Soll): Leistungsmonat; bei
 * Vereinnahmung vor der Leistung der Monat der Zahlung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG); Storno (Rückgängigmachung bzw.
 * Berichtigung, § 17 UStG) im Monat des Stornos. igL: Monat der Rechnung bzw. Lieferung (beide gleich, § 18b UStG).
 */
export function vorgaenge(): Vorgang[] {
  const l: Vorgang[] = [];
  for (const r of RECHNUNGEN) {
    const s = rechnungsSumme(r.pos, r.oss ? LAENDER[r.oss].satz : undefined);
    const leistung = r.leistung ?? r.datum;
    const ustTag = r.bezahlt && r.bezahlt < leistung ? r.bezahlt : leistung;
    l.push({ nummer: r.nummer, art: "rechnung", datum: r.datum, leistung, bezahlt: r.bezahlt, vz: 1, s, kunde: r.kunde, r, ustMonat: monat(ustTag) });
    if (r.storno) l.push({ nummer: r.storno.nummer, art: "storno", datum: r.storno.datum, leistung: r.storno.datum, bezahlt: null, vz: -1, s, kunde: r.kunde, r, ustMonat: monat(r.storno.datum) });
  }
  return l.sort((a, b) => a.nummer.localeCompare(b.nummer));
}

/**
 * Shop und Markt je Monat: Inland und EU vor der Schwelle mit 19 % (eine Summe), Rechnung 2026-011 herausgerechnet (sie
 * steht als eigene Rechnung in der App), EU nach der Schwelle je Land (nicht steuerbar in Deutschland, OSS).
 */
export function shopMonat(m: string) {
  const sh = SHOP.find((x) => x.monat === m)!;
  const doppelt = sum(RECHNUNGEN.filter((r) => r.shopBestellung && monat(r.leistung ?? r.datum) === m).map((r) => r.shopBestellung!.brutto));
  const brutto19 = sh.de + sh.erstattung + sh.euDe - doppelt;
  const netto19 = nettoAus(brutto19, 19);
  const markt = MARKT[m] ?? 0;
  const marktNetto = nettoAus(markt, 19);
  const oss = (Object.keys(LAENDER) as Land[]).filter((l) => sh.eu[l]).map((l) => ({ land: l, brutto: sh.eu[l]!, netto: nettoAus(sh.eu[l]!, LAENDER[l].satz) }));
  return { brutto19, netto19, ust19: brutto19 - netto19, doppelt, markt, marktNetto, marktUst: markt - marktNetto, oss, ossBrutto: sum(oss.map((o) => o.brutto)), ossNetto: sum(oss.map((o) => o.netto)) };
}

/** Prüfung der Schwelle: EU-Fernverkäufe netto 2026 bis vor der Schwellen-Bestellung und mit ihr */
export function schwelle() {
  const vorher = sum(SHOP.map((x) => nettoAus(x.euDe, 19)));
  const bestellung = nettoAus(SCHWELLEN_BESTELLUNG.brutto, LAENDER[SCHWELLEN_BESTELLUNG.land].satz);
  return { vorjahr: EU_FERNVERKAUF_2025, vorher, mit: vorher + bestellung, bestellung, ueberschritten: vorher <= SCHWELLE && vorher + bestellung > SCHWELLE };
}

export interface UstMonat {
  m: string;
  nummern: string[];
  /** OSS-Rechnungen mit Steuerentstehung in diesem Monat – nicht in der Voranmeldung (Hinweis der Übernahme) */
  oss: string[];
  /** aus Rechnungen (Soll) */
  r19: number; r0igl: number;
  shop19: number; markt19: number;
  kz81: number; kz41: number;
  kz46: number; kz47: number; kz66: number; kz67: number;
  ust: number; zahllast: number; elsterZahllast: number;
  /** § 13b-Belege des Monats */
  b13: string[];
}

/** Umsatzsteuer-Voranmeldung je Monat (Soll); Vorsteuer und § 13b nach Belegdatum. Fernverkäufe nach der Schwelle gehören NICHT hierher (OSS). */
export function ustMonate(monate = MONATE_2026): UstMonat[] {
  const v = vorgaenge();
  return monate.map((m) => {
    // OSS-Rechnungen (Steuer des Bestimmungslands) gehören nicht in die deutsche Voranmeldung
    const im = v.filter((x) => x.ustMonat === m && !x.r.oss);
    const r19 = sum(im.map((x) => x.vz * (x.s.gruppen["19"]?.netto ?? 0)));
    const r0igl = sum(im.filter((x) => x.r.igl).map((x) => x.vz * (x.s.gruppen["0"]?.netto ?? 0)));
    const sh = shopMonat(m);
    const kz81 = r19 + sh.netto19 + sh.marktNetto;
    const bl = BELEGE.filter((b) => monat(b.datum) === m);
    const kz66 = sum(bl.map((b) => belegSumme(b).vorsteuer));
    const kz46 = sum(bl.filter((b) => b.p13b).map((b) => belegSumme(b).netto));
    const kz47 = rund((kz46 * 19) / 100);
    const kz67 = kz47;
    const ust = rund((kz81 * 19) / 100) + kz47;
    const elsterKz47 = rund((voll(kz46) * 19) / 100);
    const elsterUst = rund((voll(kz81) * 19) / 100) + elsterKz47;
    return {
      m, nummern: im.map((x) => x.nummer), oss: v.filter((x) => x.ustMonat === m && x.r.oss).map((x) => x.nummer), r19, r0igl, shop19: sh.netto19, markt19: sh.marktNetto, kz81, kz41: r0igl, kz46, kz47, kz66, kz67,
      ust, zahllast: ust - kz66 - kz67, elsterZahllast: elsterUst - kz66 - elsterKz47, b13: bl.filter((b) => b.p13b).map((b) => b.id),
    };
  });
}

export function jahresSummen() {
  const q = ustMonate();
  const s = (f: (x: UstMonat) => number) => sum(q.map(f));
  return { r19: s((x) => x.r19), shop19: s((x) => x.shop19), markt19: s((x) => x.markt19), kz81: s((x) => x.kz81), kz41: s((x) => x.kz41), kz46: s((x) => x.kz46), kz47: s((x) => x.kz47), kz66: s((x) => x.kz66), kz67: s((x) => x.kz67), ust: s((x) => x.ust), zahllast: s((x) => x.zahllast), elsterZahllast: s((x) => x.elsterZahllast) };
}

/**
 * OSS-Rechnungen (Nachtrag StB 22.10.2026) je Quartal der Steuerentstehung (Soll: Leistung, § 13 Abs. 1 Nr. 1 a UStG)
 * und Land: Netto, Steuer und Brutto je Rechnung, wie sie im DATEV-Stapel auf 8320 stehen sollen.
 */
export function ossRechnungen() {
  return vorgaenge()
    .filter((x) => x.r.oss)
    .map((x) => {
      const land = x.r.oss!;
      const satz = LAENDER[land].satz;
      const g = x.s.gruppen[String(satz)]!;
      return { nummer: x.nummer, datum: x.datum, quartal: quartalVon(x.ustMonat), land, satz, netto: x.vz * g.netto, ust: x.vz * g.ust, brutto: x.vz * (g.netto + g.ust), bezahlt: x.bezahlt, kunde: x.kunde };
    });
}

/**
 * OSS-Erklärung je Quartal und Land: Bemessungsgrundlage (Summe der Monats-Netto aus dem Shop-Bericht plus Netto der
 * OSS-Rechnungen) und Steuer = Netto × Satz (je Land eine Zeile, wie in der Vorlage)
 */
export function ossQuartale() {
  const q: Record<string, { land: Land; netto: number; brutto: number; steuer: number; ausRechnungen: number }[]> = {};
  const zeile = (qq: string, land: Land) => {
    q[qq] ??= [];
    return q[qq]!.find((x) => x.land === land) ?? q[qq]![q[qq]!.push({ land, netto: 0, brutto: 0, steuer: 0, ausRechnungen: 0 }) - 1]!;
  };
  for (const sh of SHOP) {
    const qq = quartalVon(sh.monat);
    for (const o of shopMonat(sh.monat).oss) {
      const z = zeile(qq, o.land);
      z.netto += o.netto;
      z.brutto += o.brutto;
    }
  }
  for (const r of ossRechnungen()) {
    const z = zeile(r.quartal, r.land);
    z.netto += r.netto;
    z.brutto += r.brutto;
    z.ausRechnungen += r.netto;
  }
  for (const l of Object.values(q)) for (const z of l) z.steuer = rund((z.netto * LAENDER[z.land].satz) / 100);
  return Object.entries(q).map(([quartal, laender]) => ({ quartal, laender, steuer: sum(laender.map((z) => z.steuer)), netto: sum(laender.map((z) => z.netto)), brutto: sum(laender.map((z) => z.brutto)), zahlung: OSS_ZAHLUNG[quartal] ?? null }));
}

/** Abfluss-/Zuflusstag eines Belegs (privat bezahlt: Belegdatum) */
export const zahltagBeleg = (b: BelegRoh) => b.bezahlt ?? b.datum;

/** Einnahmen-Überschuss-Rechnung 2026 (Zufluss/Abfluss) */
export function euerUnabhaengig() {
  const J = `${JAHR}-`;
  const v = vorgaenge().filter((x) => x.bezahlt?.startsWith(J) && x.art === "rechnung");
  const reNettoPflichtig = sum(v.map((x) => x.s.gruppen["19"]?.netto ?? 0));
  const reFrei = sum(v.map((x) => x.s.gruppen["0"]?.netto ?? 0));
  // OSS-Rechnungen: in Deutschland nicht steuerbar (Zeile „… nicht umsatzsteuerbare Betriebseinnahmen“); die vereinnahmte
  // ausländische Umsatzsteuer steht mit in `reUst` (Zeile „Vereinnahmte Umsatzsteuer“), wie beim Shop-Bericht
  const reOssNetto = sum(v.filter((x) => x.r.oss).map((x) => x.s.gruppen[String(LAENDER[x.r.oss!].satz)]!.netto));
  const reUst = sum(v.map((x) => x.s.ust));
  // Shop und Markt: Zufluss im Monat des Berichts (Zahlungen werden bei Bestellung eingezogen), Erstattungen mindern
  const sm = MONATE_2026.map(shopMonat);
  const shopNetto19 = sum(sm.map((x) => x.netto19));
  const shopUst19 = sum(sm.map((x) => x.ust19));
  const ossNetto = sum(sm.map((x) => x.ossNetto));
  const ossUst = sum(sm.map((x) => x.ossBrutto - x.ossNetto));
  const marktNetto = sum(sm.map((x) => x.marktNetto));
  const marktUst = sum(sm.map((x) => x.marktUst));
  // Voranmeldungen: Dezember 2025 und Januar–November 2026 werden 2026 eingezogen bzw. erstattet (ELSTER-Beträge)
  const va = ustMonate().filter((x) => VA_TAG[x.m]!.startsWith(J));
  const vaGezahlt = UST_DEZ_2025.betrag + sum(va.filter((x) => x.elsterZahllast > 0).map((x) => x.elsterZahllast));
  const vaErstattet = -sum(va.filter((x) => x.elsterZahllast < 0).map((x) => x.elsterZahllast));
  const ossGezahlt = sum(ossQuartale().filter((q) => q.zahlung?.startsWith(J)).map((q) => q.steuer));
  const imJahr = BELEGE.filter((b) => zahltagBeleg(b).startsWith(J));
  const nachKategorie: Record<string, { betrag: number; anzahl: number }> = {};
  let vorsteuer = 0;
  for (const b of imJahr) {
    const s = belegSumme(b);
    vorsteuer += s.vorsteuer;
    if (b.kategorie === "anlage") continue;
    nachKategorie[b.kategorie] ??= { betrag: 0, anzahl: 0 };
    nachKategorie[b.kategorie]!.betrag += b.vorsteuer ? s.netto : s.brutto;
    nachKategorie[b.kategorie]!.anzahl++;
  }
  const ausgabenBelege = sum(Object.values(nachKategorie).map((k) => k.betrag));
  const anlage = BELEGE.find((b) => b.id === AFA.beleg)!;
  const afaNeu = rund((belegSumme(anlage).netto / AFA.jahre) * (AFA.monate / 12));
  const afa = afaNeu + AFA.altbestand;
  const einnahmen = reNettoPflichtig + reFrei + reOssNetto + reUst + shopNetto19 + shopUst19 + ossNetto + ossUst + marktNetto + marktUst + vaErstattet;
  const ausgaben = ausgabenBelege + vorsteuer + vaGezahlt + ossGezahlt;
  return {
    reNettoPflichtig, reFrei, reOssNetto, reUst, reAnzahl: v.length, shopNetto19, shopUst19, ossNetto, ossUst, marktNetto, marktUst, vaGezahlt, vaErstattet, ossGezahlt,
    nachKategorie, ausgabenBelege, vorsteuer, afaNeu, afa, einnahmen, ausgaben, gewinn: einnahmen - ausgaben - afa, belegeImJahr: imJahr.length,
    offen: sum(vorgaenge().filter((x) => x.art === "rechnung" && !x.r.storno && !(x.bezahlt ?? "9999").startsWith(J)).map((x) => x.s.brutto)),
  };
}
