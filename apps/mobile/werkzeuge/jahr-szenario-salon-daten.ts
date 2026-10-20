/**
 * Jahres-Szenario „Salon Sonne GmbH“ (Hamburg, 2026) – nur die ROHDATEN und eine davon UNABHÄNGIGE Rechnung der
 * erwarteten Kennzahlen: Umsatzsteuer je Monat nach vereinnahmten Entgelten (Ist-Versteuerung, § 13 Abs. 1 Nr. 1 b,
 * § 20 UStG), Vorsteuer, Jahressummen, GuV und Bilanz zum 31.12.2026. Diese Datei importiert absichtlich nichts aus der
 * App oder aus @amtlos/fachlogik – nur die kleinen Formatierhilfen des Café-Szenarios (jahr-szenario-daten.ts, ebenfalls
 * ohne App-Bezug). Prüferinnen und Prüfer sollen die Ausgaben der App (werkzeuge/jahr-szenario-salon.ts) dagegen halten.
 *
 * Alle Namen, Anschriften, Register-, Steuer- und Kontonummern sind erfunden (Domains auf .example). Beträge in Cent.
 */
import { de, eur, rund } from "./jahr-szenario-daten";

export { de, eur, rund };

// ---------------------------------------------------------------- Hilfen (eigene Implementierung, nicht aus der App)

const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);
export const monat = (iso: string) => iso.slice(0, 7);
export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const MONATE_2026 = MONATE.map((_, i) => `2026-${String(i + 1).padStart(2, "0")}`);

/** deutsche IBAN mit gültiger Prüfziffer aus BLZ und Kontonummer (erfundenes Konto) */
function ibanDe(blz: string, konto: string): string {
  const bban = blz + konto.padStart(10, "0");
  let rest = 0;
  for (const z of `${bban}131400`) rest = (rest * 10 + Number(z)) % 97;
  return `DE${String(98 - rest).padStart(2, "0")}${bban}`;
}

// ---------------------------------------------------------------- Betrieb

export const JAHR = "2026";
export const BETRIEB = {
  name: "Salon Sonne GmbH",
  strasse: "Osterstraße 112",
  plz: "20259",
  ort: "Hamburg",
  bundesland: "Hamburg",
  verantwortlich: "Alex Sonnberg",
  telefon: "040 49302871",
  email: "hallo@salon-sonne.example",
  website: "www.salon-sonne.example",
  steuernummer: "41/724/03619",
  ust_idnr: "DE361847295",
  iban: ibanDe("20050550", "1262417730"),
  bank: "Hamburger Sparkasse",
  bic: "HASPDEHHXXX",
  rechtsform: "GmbH",
  registergericht: "Amtsgericht Hamburg",
  registernummer: "HRB 178432",
  vertretung: "Alex Sonnberg, Chris Sonnberg",
  versteuerung: "ist",
  farbe: "#C27C0E",
};
/** Gesellschafter-Geschäftsführer (je 50 %, je einzelvertretungsberechtigt, von § 181 BGB befreit) */
export const GESELLSCHAFTER = [
  { name: "Alex Sonnberg", geburtsname: "Alex Brockmann", geburtsdatum: "1988-05-21", geburtsort: "Hamburg", wohnort: "Hamburg", wohnanschrift: "Heußweg 41\n20255 Hamburg", staatsangehoerigkeit: "deutsch", anteil: "12.500,00 € (50 %)", rolle: "Geschäftsführer (kaufmännisch)" },
  { name: "Chris Sonnberg", geburtsname: "", geburtsdatum: "1990-09-02", geburtsort: "Lübeck", wohnort: "Hamburg", wohnanschrift: "Heußweg 41\n20255 Hamburg", staatsangehoerigkeit: "deutsch", anteil: "12.500,00 € (50 %)", rolle: "Geschäftsführerin, Friseurmeisterin (Betriebsleiterin nach § 7 HwO)" },
];
export const STAMMKAPITAL = 2500000;
/** Gesellschaftsvertrag (Notar), Eintragung ins Handelsregister, Geschäftsbeginn */
export const GRUENDUNG = { vertrag: "2025-03-10", eintragung: "2025-03-27", beginn: "2025-04-01" };

export const KUNDEN = {
  k1: { name: "Elbstudio Fotografie GmbH", anschrift: "Große Elbstraße 145\n22767 Hamburg", email: "buchhaltung@elbstudio.example" },
  k2: { name: "Hotel Alsterblick GmbH & Co. KG", anschrift: "An der Alster 52\n20099 Hamburg", email: "kreditoren@hotel-alsterblick.example" },
  k3: { name: "Nordlicht Media AG", anschrift: "Kehrwieder 8\n20457 Hamburg", email: "eingangsrechnungen@nordlicht-media.example" },
  k4: { name: "Petersen & Wulf Steuerberatungsgesellschaft mbH", anschrift: "Mittelweg 117\n20148 Hamburg", email: "verwaltung@petersen-wulf.example" },
  k5: { name: "Modehaus Brandt KG", anschrift: "Neuer Wall 61\n20354 Hamburg", email: "rechnungen@modehaus-brandt.example" },
  k6: { name: "Lena Hartmann", anschrift: "Blankeneser Landstraße 23\n22587 Hamburg" },
  k7: { name: "Jonas Wiegand", anschrift: "Sachsentor 19\n21029 Hamburg" },
  k8: { name: "Möwe Events GmbH", anschrift: "Stresemannstraße 374\n22761 Hamburg", email: "finance@moewe-events.example" },
} as const;
export type KundeId = keyof typeof KUNDEN;

export const MITARBEITER = {
  m1: {
    name: "Mia Petersen", anschrift: "Fruchtallee 88\n20259 Hamburg", geburtsdatum: "1996-02-11", geburtsort: "Kiel", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Friseur/in", beginn: "2025-04-01", steuer_id: "48291037562", steuerklasse: "I", sv_nummer: "18110296P012", krankenkasse: "Techniker Krankenkasse", iban: ibanDe("20050550", "1270331845"),
  },
  m2: {
    name: "Leonie Brandt", anschrift: "Bismarckstraße 17\n20259 Hamburg", geburtsdatum: "1993-07-30", geburtsort: "Hamburg", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Friseur/in", beginn: "2025-04-01", steuer_id: "60317428915", steuerklasse: "IV", sv_nummer: "18300793B025", krankenkasse: "DAK-Gesundheit", iban: ibanDe("20050550", "1280554120"),
  },
  m3: {
    name: "Aylin Demir", anschrift: "Methfesselstraße 6\n20257 Hamburg", geburtsdatum: "1999-11-04", geburtsort: "Hamburg", staatsangehoerigkeit: "deutsch, türkisch",
    taetigkeit: "Friseur/in", beginn: "2025-10-01", steuer_id: "71846293051", steuerklasse: "I", sv_nummer: "18041199D513", krankenkasse: "AOK Rheinland/Hamburg", iban: ibanDe("20050550", "1291188034"),
  },
  m4: {
    name: "Finn Jürgensen", anschrift: "Eppendorfer Weg 201\n20253 Hamburg", geburtsdatum: "2009-03-15", geburtsort: "Hamburg", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Auszubildender Friseur", beginn: "2025-08-01", steuer_id: "92750183644", steuerklasse: "I", sv_nummer: "18150309J018", krankenkasse: "Techniker Krankenkasse", iban: ibanDe("20050550", "1302276651"),
  },
} as const;

// ---------------------------------------------------------------- Ausgangsrechnungen (alle 19 %)

export interface Pos { bez: string; menge: number; einheit: string; preis: number; satz: 19 | 7 | 0 }
export interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  /** Leistungsdatum (ISO), null = wie Rechnungsdatum */
  leistung: string | null;
  ziel: "7" | "14" | "30" | "sofort";
  kunde: KundeId;
  kundeAbweichend?: { name: string; anschrift: string };
  pos: Pos[];
  hinweis: string;
  /** Zahlungseingang – entscheidet bei Ist-Versteuerung über den Voranmeldungszeitraum */
  bezahlt: string | null;
  /** Storno mit eigener Nummer; `erstattet` = Tag, an dem der Betrag zurückgezahlt wurde (null: nichts gezahlt, nichts erstattet) */
  storno?: { datum: string; nummer: string; id: string; grund: string; erstattet: string | null };
  ersetzt?: string;
  worum: string;
}

const DANKE = "Vielen Dank für Ihren Auftrag.\nBitte geben Sie bei der Zahlung die Rechnungsnummer an.";
const p = (bez: string, menge: number, einheit: string, preis: number): Pos => ({ bez, menge, einheit, preis, satz: 19 });

export const RECHNUNGEN: Rechnung[] = [
  { id: "r01", nummer: "2026-001", datum: "2026-01-14", leistung: "2026-01-12", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-01-27",
    worum: "Lookbook-Shooting am 12.01.: Hair & Make-up mit zwei Stylistinnen je 6,5 Std., Anfahrt, Material. Bezahlt im selben Monat.",
    pos: [p("Hair & Make-up am Set, Stylistin 1", 6.5, "Stunde", 7500), p("Hair & Make-up am Set, Stylistin 2", 6.5, "Stunde", 7500), p("Anfahrt Studio Altona", 1, "Pauschale", 4500), p("Materialpauschale (Make-up, Stylingprodukte)", 1, "Pauschale", 6000)] },
  { id: "r02", nummer: "2026-002", datum: "2026-01-29", leistung: "2026-01-24", ziel: "14", kunde: "k2", hinweis: DANKE, bezahlt: "2026-02-10",
    worum: "Brautstyling für das Hochzeitsarrangement des Hotels (3 Bräute, 4 Begleitpersonen, Samstagszuschlag 2,5 Std.). Bezahlt im FEBRUAR (Ist: USt Februar).",
    pos: [p("Brautstyling (Haare und Make-up) je Braut", 3, "Stück", 24000), p("Styling Brautmutter/Trauzeugin", 4, "Stück", 8500), p("Samstagszuschlag vor Ort", 2.5, "Stunde", 4000)] },
  { id: "r03", nummer: "2026-003", datum: "2026-02-18", leistung: "2026-02-14", ziel: "7", kunde: "k6", hinweis: "Vielen Dank für Ihr Vertrauen – alles Gute für Sie beide!", bezahlt: "2026-02-24",
    worum: "Privatkundin (Braut): Probestyling 1,5 Std., Brautstyling am Hochzeitstag 3,5 Std., Anfahrt, Haarschmuck.",
    pos: [p("Probestyling Braut (Haare und Make-up)", 1.5, "Stunde", 8500), p("Brautstyling am Hochzeitstag, vor Ort", 3.5, "Stunde", 8500), p("Anfahrt Hamburg-Blankenese", 1, "Pauschale", 3500), p("Haarschmuck (Perlenspange)", 1, "Stück", 2490)] },
  { id: "r04", nummer: "2026-004", datum: "2026-03-06", leistung: "2026-03-05", ziel: "30", kunde: "k3", hinweis: DANKE, bezahlt: "2026-04-08",
    worum: "Werbe-Shooting „Frühling“ (2 Drehtage, 16 Std. Stylistin, 9,5 Std. Assistenz). Bezahlt im APRIL (Ist: USt April, nicht März).",
    pos: [p("Hair & Make-up Werbe-Shooting, 2 Drehtage", 16, "Stunde", 7500), p("Assistenz Styling", 9.5, "Stunde", 4500), p("Materialpauschale je Drehtag", 2, "Pauschale", 6000)] },
  { id: "r05", nummer: "2026-005", datum: "2026-03-20", leistung: "2026-03-18", ziel: "14", kunde: "k4", hinweis: DANKE, bezahlt: "2026-04-02",
    worum: "Kosmetik-Workshop „Natürliches Business-Make-up“ für 12 Mitarbeiterinnen: 3 Std. Leitung, 12 Produktsets, Rabattzeile −10 % auf die Leitung. Bezahlt im APRIL.",
    pos: [p("Workshopleitung Kosmetik-Workshop", 3, "Stunde", 18000), p("Produktset je Teilnehmerin (Pinsel, Pflegeproben)", 12, "Stück", 1850), p("Rabatt 10 % Neukundenaktion auf die Workshopleitung", 1, "Pauschale", -5400)] },
  { id: "r06", nummer: "2026-006", datum: "2026-04-23", leistung: "2026-04-21", ziel: "30", kunde: "k5", hinweis: DANKE, bezahlt: "2026-05-29",
    worum: "Modenschau-Styling: 3 Stylistinnen à 5,5 Std. = 16,5 Std., Produktverbrauch. Bezahlt im MAI.",
    pos: [p("Styling Modenschau (3 Stylistinnen à 5,5 Std.)", 16.5, "Stunde", 7000), p("Haarspray und Stylingprodukte (Verbrauch)", 1, "Pauschale", 8900)] },
  { id: "r07", nummer: "2026-007", datum: "2026-05-15", leistung: "2026-05-12", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-05-28",
    storno: { datum: "2026-06-09", nummer: "2026-008", id: "r08", grund: "9 statt der tatsächlich 7,5 Stunden berechnet – Storno und neue Rechnung 2026-009; der gezahlte Betrag wird verrechnet", erstattet: "2026-06-12" },
    worum: "Katalog-Shooting am 12.05. mit 9 Std. berechnet und im MAI voll BEZAHLT; tatsächlich 7,5 Std. → Storno 2026-008 im Juni, Erstattung am 12.06. vermerkt (Ist: Minderung im Juni), neue Rechnung 2026-009.",
    pos: [p("Hair & Make-up Katalog-Shooting Herbst", 9, "Stunde", 7500), p("Materialpauschale", 1, "Pauschale", 6000)] },
  { id: "r09", nummer: "2026-009", datum: "2026-06-09", leistung: "2026-05-12", ziel: "14", kunde: "k1", ersetzt: "r07", hinweis: `Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-007 vom 15.05.2026 (7,5 statt 9 Stunden).\n${DANKE}`, bezahlt: "2026-06-12",
    worum: "Neue Rechnung Katalog-Shooting mit 7,5 Std. (Leistung weiter 12.05.), mit dem Guthaben verrechnet am 12.06.",
    pos: [p("Hair & Make-up Katalog-Shooting Herbst", 7.5, "Stunde", 7500), p("Materialpauschale", 1, "Pauschale", 6000)] },
  { id: "r10", nummer: "2026-010", datum: "2026-07-09", leistung: "2026-07-04", ziel: "14", kunde: "k8", kundeAbweichend: { name: "Möwe Event GmbH", anschrift: "Stresemannstraße 347\n22761 Hamburg" }, hinweis: DANKE, bezahlt: null,
    storno: { datum: "2026-07-14", nummer: "2026-011", id: "r11", grund: "Empfänger falsch (Firma „Möwe Event GmbH“ statt „Möwe Events GmbH“, Hausnummer 347 statt 374) – Storno und neue Rechnung 2026-012", erstattet: null },
    worum: "Festival-Make-up beim Sommerfest am 04.07. – Empfänger falsch, nie bezahlt → Storno 2026-011 ohne Erstattung (Ist: zählt in keinem Monat), neu gestellt als 2026-012.",
    pos: [p("Glitzer- und Festival-Make-up Sommerfest (2 Stylistinnen)", 8, "Stunde", 6500), p("Material Glitzer und Gesichtsfarben (hautverträglich)", 1, "Pauschale", 7500)] },
  { id: "r12", nummer: "2026-012", datum: "2026-07-14", leistung: "2026-07-04", ziel: "14", kunde: "k8", ersetzt: "r10", hinweis: `Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-010 vom 09.07.2026.\n${DANKE}`, bezahlt: "2026-08-11",
    worum: "Korrigierte Rechnung Sommerfest (richtiger Empfänger), bezahlt im AUGUST.",
    pos: [p("Glitzer- und Festival-Make-up Sommerfest (2 Stylistinnen)", 8, "Stunde", 6500), p("Material Glitzer und Gesichtsfarben (hautverträglich)", 1, "Pauschale", 7500)] },
  { id: "r13", nummer: "2026-013", datum: "2026-08-27", leistung: "2026-08-23", ziel: "14", kunde: "k2", hinweis: DANKE, bezahlt: "2026-09-15",
    worum: "Styling-Vorführung auf der Hochzeitsmesse im Hotel (6,25 Std.) und 5 Model-Brautfrisuren. Bezahlt im SEPTEMBER.",
    pos: [p("Styling-Vorführung Hochzeitsmesse", 6.25, "Stunde", 7500), p("Model-Styling (Brautfrisur) je Model", 5, "Stück", 9500)] },
  { id: "r14", nummer: "2026-014", datum: "2026-09-25", leistung: null, ziel: "sofort", kunde: "k7", hinweis: "Vielen Dank – alles Gute zur Hochzeit!", bezahlt: "2026-09-28",
    worum: "Privatkunde (Bräutigam): Haarschnitt und Bartpflege vor Ort 1,75 Std., Anfahrt, Bartöl.",
    pos: [p("Bräutigam-Styling vor Ort: Haarschnitt und Bartpflege", 1.75, "Stunde", 6500), p("Anfahrt Hamburg-Bergedorf", 1, "Pauschale", 3500), p("Bartöl 30 ml", 1, "Stück", 1890)] },
  { id: "r15", nummer: "2026-015", datum: "2026-10-16", leistung: "2026-10-14", ziel: "30", kunde: "k3", hinweis: DANKE, bezahlt: "2026-11-20",
    worum: "TV-Spot: Hair & Make-up 10,5 Std., maskenbildnerische Effekte 2,25 Std., Material. Bezahlt im NOVEMBER.",
    pos: [p("Hair & Make-up TV-Spot", 10.5, "Stunde", 7500), p("Maskenbildnerische Effekte (Narbe, Schweiß)", 2.25, "Stunde", 9000), p("Materialpauschale", 1, "Pauschale", 9500)] },
  { id: "r16", nummer: "2026-016", datum: "2026-11-19", leistung: "2026-11-18", ziel: "14", kunde: "k4", hinweis: DANKE, bezahlt: "2026-12-03",
    worum: "Zweiter Kosmetik-Workshop für 15 Mitarbeiterinnen: 3,5 Std. Leitung, 15 Produktsets, Rabattzeile −10 % Stammkunde. Bezahlt im DEZEMBER.",
    pos: [p("Workshopleitung Kosmetik-Workshop „Make-up für den Abend“", 3.5, "Stunde", 18000), p("Produktset je Teilnehmerin (Pinsel, Pflegeproben)", 15, "Stück", 1850), p("Rabatt 10 % Stammkunde auf die Workshopleitung", 1, "Pauschale", -6300)] },
  { id: "r17", nummer: "2026-017", datum: "2026-12-11", leistung: "2026-12-09", ziel: "30", kunde: "k1", hinweis: DANKE, bezahlt: "2027-01-12",
    worum: "Weihnachts-Shooting am 09.12. – bezahlt erst am 12.01.2027 (Ist: USt Januar 2027, in keiner Voranmeldung 2026).",
    pos: [p("Hair & Make-up Weihnachts-Shooting", 8, "Stunde", 7500), p("Materialpauschale", 1, "Pauschale", 6000)] },
  { id: "r18", nummer: "2026-018", datum: "2026-12-18", leistung: "2026-12-17", ziel: "14", kunde: "k5", hinweis: DANKE, bezahlt: null,
    worum: "Neujahrs-Lookbook (2 Stylistinnen, 12 Std.) – zum 31.12. noch offen (Forderung; Ist: keine USt 2026).",
    pos: [p("Styling Neujahrs-Lookbook (2 Stylistinnen)", 12, "Stunde", 7000)] },
];

// ---------------------------------------------------------------- Kasse (Z-Bon-Summen je Monat, alles 19 %)

/** Bruttoumsatz der Kasse (Dienstleistungen und Verkauf von Pflegeprodukten, alles 19 %), laut Z-Bon-Monatssumme */
export const KASSE_BRUTTO: Record<string, number> = {
  "2026-01": 2614050, "2026-02": 2431580, "2026-03": 2889020, "2026-04": 2837040, "2026-05": 3014090, "2026-06": 2861530,
  "2026-07": 2748060, "2026-08": 2426010, "2026-09": 2940570, "2026-10": 2983040, "2026-11": 3091590, "2026-12": 3637020,
};
const ausBrutto = (brutto: number, satz: number) => {
  const netto = rund((brutto * 100) / (100 + satz));
  return { netto, ust: brutto - netto };
};
export const KASSE_MONATE = MONATE_2026.map((m) => ({ monat: m, b19: KASSE_BRUTTO[m]!, n19: ausBrutto(KASSE_BRUTTO[m]!, 19).netto, u19: ausBrutto(KASSE_BRUTTO[m]!, 19).ust }));

// ---------------------------------------------------------------- Lohn (Annahmen „vom Lohnbüro“, nicht nachgerechnet)

export interface LohnMonat { monat: string; zahltag: string; brutto: number; lohnsteuer: number; sv_an: number; sv_ag: number }
const letzterWerktag = (m: number) => {
  const d = new Date(Date.UTC(2026, m, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const letzterTag = (m: number) => new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10);
/** AG-Anteil Sozialversicherung inkl. Umlagen U1/U2/InsG (Annahme), AN-Anteil kinderlos bzw. unter 23 */
const AG = 0.2115;
const lohnReihe = (brutto: (i: number) => number, lst: (b: number) => number, an: number): LohnMonat[] =>
  MONATE.map((m, i) => {
    const b = brutto(i);
    return { monat: `${m} 2026`, zahltag: letzterWerktag(i + 1), brutto: b, lohnsteuer: lst(b), sv_an: rund(b * an), sv_ag: rund(b * AG) };
  });
export const LOHN = {
  m1: lohnReihe((i) => (i < 6 ? 290000 : 300000), (b) => (b === 290000 ? 32041 : 34383), 0.2175),
  m2: lohnReihe(() => 275000, () => 18266, 0.2115),
  m3: lohnReihe(() => 175000, () => 9116, 0.2175),
  m4: lohnReihe((i) => (i < 7 ? 82000 : 90000), () => 0, 0.2115),
};
/** Gesellschafter-Geschäftsführer mit Mehrheit bzw. Sperrminorität: nicht sozialversicherungspflichtig (Annahme, Statusfeststellung liegt vor) */
export const GF_GEHALT = 400000;
export const GF_LST = 74600;
export const personalMonat = (i: number) => sum(Object.values(LOHN).map((l) => l[i]!.brutto + l[i]!.sv_ag)) + 2 * GF_GEHALT;
export const personalQuartal = (q: number) => [0, 1, 2].reduce((a, k) => a + personalMonat((q - 1) * 3 + k), 0);
/** Lohnsteuer je Monat (für die monatliche Lohnsteuer-Anmeldung, Annahme) */
export const lohnsteuerMonat = (i: number) => sum(Object.values(LOHN).map((l) => l[i]!.lohnsteuer)) + 2 * GF_LST;

// ---------------------------------------------------------------- Belege

export interface BelegPos { text: string; menge?: string; satz: 19 | 7 | 0; betrag: number }
export interface BelegRoh {
  id: string;
  datum: string;
  lieferant: string;
  anschrift: string;
  nummer: string | null;
  kategorie: string;
  /** „netto“: Rechnung weist Netto und USt je Satz aus; „brutto“: Kassenbon/Kleinbetragsrechnung bzw. ohne USt */
  art: "netto" | "brutto";
  saetze: { satz: 19 | 7 | 0; betrag: number }[];
  vorsteuer: boolean;
  zahlung: "bank" | "bar" | "privat";
  bezahlt: string | null;
  notiz?: string;
  datei: "pdf" | "xml";
  pos: BelegPos[];
  worum: string;
}
const posSatz = (pos: BelegPos[], satz: number) => sum(pos.filter((x) => x.satz === satz).map((x) => x.betrag));
const ausPos = (pos: BelegPos[]) => ([19, 7, 0] as const).filter((s) => pos.some((x) => x.satz === s)).map((satz) => ({ satz, betrag: posSatz(pos, satz) }));
const einfach = (o: Omit<BelegRoh, "saetze">): BelegRoh => ({ ...o, saetze: ausPos(o.pos) });

const VERMIETER = { lieferant: "Elbimmobilien Verwaltung Hansen KG", anschrift: "Rothenbaumchaussee 40\n20148 Hamburg" };
const LOHNBUERO = { lieferant: "Lohnbüro Elbe (Eigenbeleg Lohnjournal)", anschrift: "Svenja Albers, Holstenstraße 1\n22767 Hamburg" };
const ENERGIE = { lieferant: "Elbstrom Hamburg GmbH", anschrift: "Billstraße 80\n20539 Hamburg" };
const FRISEURBEDARF = { lieferant: "Friseurbedarf Nord GmbH", anschrift: "Wandsbeker Zollstraße 25\n22041 Hamburg" };
const SALONMOEBEL = { lieferant: "Salonmöbel Hanse GmbH", anschrift: "Billbrookdeich 210\n22113 Hamburg" };
const TEXTIL = { lieferant: "Textilservice Alster GmbH", anschrift: "Bramfelder Chaussee 300\n22177 Hamburg" };
export const HAIRTEC = { lieferant: "Hairtec Profi-Vertrieb GmbH", anschrift: "Hammerbrookstraße 93\n20097 Hamburg", strasse: "Hammerbrookstraße 93", plz: "20097", ort: "Hamburg", email: "rechnung@hairtec.example", telefon: "040 23880410", steuernummer: "46/753/01288", ust_idnr: "DE298114763", iban: ibanDe("20050550", "1240887766"), bic: "HASPDEHHXXX" };

function miete(id: string, datum: string, q: number, bezahlt: string): BelegRoh {
  const von = MONATE[(q - 1) * 3]!;
  const bis = MONATE[q * 3 - 1]!;
  const pos: BelegPos[] = [{ text: `Gewerbemiete Salon, Osterstraße 112, EG (${von}–${bis} 2026, 3 × 2.400,00 €)`, satz: 19, betrag: 720000 }, { text: `Nebenkostenvorauszahlung (${von}–${bis} 2026, 3 × 380,00 €)`, satz: 19, betrag: 114000 }];
  return { id, datum, ...VERMIETER, nummer: `MR-2026-Q${q}`, kategorie: "miete", art: "netto", saetze: ausPos(pos), vorsteuer: true, zahlung: "bank", bezahlt, notiz: "Mietvertrag mit Option zur Umsatzsteuer (§ 9 UStG), vierteljährlich im Voraus", datei: "pdf", pos, worum: `Miete und Nebenkosten Q${q} (Dauerrechnung, 19 %)` };
}
function lohn(id: string, q: number): BelegRoh {
  const datum = letzterTag(q * 3);
  const pos: BelegPos[] = [0, 1, 2].flatMap((k) => {
    const i = (q - 1) * 3 + k;
    return [
      ...Object.entries(LOHN).map(([mid, l]) => ({ text: `${l[i]!.monat}: ${MITARBEITER[mid as keyof typeof MITARBEITER].name} – Brutto ${eur(l[i]!.brutto)} € + AG-Anteile ${eur(l[i]!.sv_ag)} €`, satz: 0 as const, betrag: l[i]!.brutto + l[i]!.sv_ag })),
      { text: `${MONATE[i]} 2026: Geschäftsführergehälter Alex und Chris Sonnberg (je ${eur(GF_GEHALT)} €, sozialversicherungsfrei)`, satz: 0 as const, betrag: 2 * GF_GEHALT },
    ];
  });
  return {
    id, datum, ...LOHNBUERO, nummer: `LJ-2026-Q${q}`, kategorie: "personal", art: "brutto", saetze: [{ satz: 0, betrag: personalQuartal(q) }], vorsteuer: false, zahlung: "bank", bezahlt: datum,
    notiz: "Bruttolöhne, Ausbildungsvergütung, Geschäftsführergehälter und Arbeitgeberanteile laut Lohnjournal; Lohnsteuer-Anmeldung monatlich", datei: "pdf", pos, worum: `Personalkosten Q${q} als Eigenbeleg (Lohnjournal, 0 %, ohne Vorsteuer)`,
  };
}
function friseurbedarf(id: string, datum: string, nr: string, n19: number, bezahlt: string, monate: string): BelegRoh {
  const pos: BelegPos[] = [
    { text: `Oxidationshaarfarben, Entwickler 6 %/9 %, Blondierpulver, Dauerwellmittel (${monate})`, satz: 19, betrag: rund(n19 * 0.46) },
    { text: `Shampoo, Pflege und Styling (Salongebrauch und Verkauf an Kundinnen) (${monate})`, satz: 19, betrag: rund(n19 * 0.41) },
    { text: `Einwegmaterial: Nitrilhandschuhe, Folien, Nackenpapier, Färbepinsel (${monate})`, satz: 19, betrag: n19 - rund(n19 * 0.46) - rund(n19 * 0.41) },
  ];
  return { id, datum, ...FRISEURBEDARF, nummer: nr, kategorie: "waren", art: "netto", saetze: ausPos(pos), vorsteuer: true, zahlung: "bank", bezahlt, notiz: "Quartals-Sammelrechnung zur Kundennummer FN-30418", datei: "pdf", pos, worum: `Wareneinkauf Friseurbedarf ${monate} (19 %)` };
}

/** Positionen der empfangenen E-Rechnung (XRechnung UBL) – Grundlage für das XML des Lieferanten */
export const ERECHNUNG_POS = [
  { bez: "Pflegeshampoo Repair 1000 ml (Verkauf)", menge: 24, preis: 1490, satz: 19 as const },
  { bez: "Haarmaske Repair 500 ml (Verkauf)", menge: 18, preis: 1740, satz: 19 as const },
  { bez: "Stylingspray Medium Hold 300 ml (Verkauf)", menge: 36, preis: 895, satz: 19 as const },
  { bez: "Versandkosten", menge: 1, preis: 990, satz: 19 as const },
];

export const BELEGE: BelegRoh[] = [
  miete("b01", "2026-01-02", 1, "2026-01-05"),
  miete("b02", "2026-04-01", 2, "2026-04-03"),
  miete("b03", "2026-07-01", 3, "2026-07-03"),
  miete("b04", "2026-10-01", 4, "2026-10-05"),
  einfach({ id: "b05", datum: "2026-01-15", ...ENERGIE, nummer: "ES-4471-26-1", kategorie: "miete", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-20", datei: "pdf", worum: "Abschläge Strom Januar–Juni (19 %), als „Miete und Nebenkosten“ erfasst (keine eigene Kategorie Energie)",
    pos: [{ text: "Abschläge Strom Januar–Juni 2026 (6 × 310,00 €)", satz: 19, betrag: 186000 }] }),
  einfach({ id: "b06", datum: "2026-07-15", ...ENERGIE, nummer: "ES-4471-26-2", kategorie: "miete", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-07-20", datei: "pdf", worum: "Abschläge Strom Juli–Dezember (19 %)",
    pos: [{ text: "Abschläge Strom Juli–Dezember 2026 (6 × 310,00 €)", satz: 19, betrag: 186000 }] }),
  lohn("b07", 1),
  lohn("b08", 2),
  lohn("b09", 3),
  lohn("b10", 4),
  friseurbedarf("b11", "2026-03-31", "FN-26-03-1182", 412380, "2026-04-09", "Januar–März 2026"),
  friseurbedarf("b12", "2026-06-30", "FN-26-06-1544", 438915, "2026-07-09", "April–Juni 2026"),
  friseurbedarf("b13", "2026-09-30", "FN-26-09-1907", 401270, "2026-10-08", "Juli–September 2026"),
  { ...friseurbedarf("b14", "2026-12-29", "FN-26-12-2263", 476840, "2027-01-07", "Oktober–Dezember 2026"), worum: "Wareneinkauf Friseurbedarf Q4 (19 %) – Belegdatum 29.12.2026, bezahlt erst 07.01.2027 (Vorsteuer Dezember 2026 auch bei Ist-Versteuerung)" },
  einfach({ id: "b15", datum: "2026-09-08", ...HAIRTEC, nummer: "HT-2026-30871", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-22", datei: "xml", worum: "Pflegeprodukte zum Weiterverkauf als E-RECHNUNG (XRechnung UBL) empfangen, mit der App eingelesen (19 %)",
    pos: ERECHNUNG_POS.map((x) => ({ text: x.bez, menge: `${x.menge} × ${eur(x.preis)} €`, satz: x.satz, betrag: rund(x.menge * x.preis) })) }),
  einfach({ id: "b16", datum: "2026-01-08", lieferant: "Fachverlag Haar & Mode GmbH", anschrift: "Am Sandtorkai 37\n20457 Hamburg", nummer: "AB-26-008812", kategorie: "fortbildung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-12", datei: "pdf", worum: "FACHZEITSCHRIFT „Salon Praxis“, Jahresabo 2026 (7 %)",
    pos: [{ text: "Fachzeitschrift „Salon Praxis“, Jahresabonnement 2026 (12 Ausgaben, gedruckt)", satz: 7, betrag: 9800 }] }),
  einfach({ id: "b17", datum: "2026-03-12", ...SALONMOEBEL, nummer: "SH-2026-0331", kategorie: "anlage", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-19", datei: "pdf", worum: "ANLAGE über 800 € netto: hydraulischer Behandlungsstuhl 1.975 € netto (Nutzungsdauer 8 Jahre, ab März)",
    pos: [{ text: "Hydraulischer Behandlungs- und Bedienstuhl „Linea“ mit Kopfstütze, Kunstleder anthrazit", satz: 19, betrag: 189000 }, { text: "Lieferung und Montage", satz: 19, betrag: 8500 }] }),
  einfach({ id: "b18", datum: "2026-02-17", ...SALONMOEBEL, nummer: "SH-2026-0172", kategorie: "gwg", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-02-20", datei: "pdf", worum: "GWG: Arbeitswagen (Rollwagen) mit 5 Schubladen 649 € netto",
    pos: [{ text: "Arbeitswagen „Trolley Pro“ mit 5 Schubladen und Föhnhalter", satz: 19, betrag: 64900 }] }),
  einfach({ id: "b19", datum: "2026-05-06", lieferant: "Drogeriemarkt Osterstraße", anschrift: "Osterstraße 98\n20259 Hamburg", nummer: "Bon 0506-2231", kategorie: "waren", art: "brutto", vorsteuer: true, zahlung: "bar", bezahlt: null, datei: "pdf", worum: "KLEINBETRAGSRECHNUNG (Kassenbon, bar) mit 19 % und 7 %",
    pos: [{ text: "Wattepads (6 × 120 Stück)", satz: 19, betrag: 1074 }, { text: "Abschminktücher (4 Pack)", satz: 19, betrag: 796 }, { text: "Küchenrolle (8 Rollen)", satz: 19, betrag: 495 }, { text: "Kaffeebohnen für den Kundenkaffee (1 kg)", satz: 7, betrag: 1499 }] }),
  einfach({ id: "b20", datum: "2026-01-05", lieferant: "SalonKasse Systems GmbH", anschrift: "Spaldingstraße 160\n20097 Hamburg", nummer: "SK-R-2026-04418", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-07", datei: "pdf", worum: "Kassensoftware und TSE 2026 (19 %)",
    pos: [{ text: "Kassen-Software SalonKasse Pro, Lizenz 2026", satz: 19, betrag: 38400 }, { text: "TSE (USB-Stick-TSE) Zertifikatsverlängerung 2026", satz: 19, betrag: 12900 }] }),
  einfach({ id: "b21", datum: "2026-01-10", lieferant: "Webhaus Hamburg GmbH", anschrift: "Schanzenstraße 75\n20357 Hamburg", nummer: "WH-26-01093", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-10", datei: "pdf", worum: "Webhosting und E-Mail 2026 (19 %) – Auftragsverarbeiter",
    pos: [{ text: "Webhosting „Business“ inkl. 6 E-Mail-Postfächer, 01–12/2026", satz: 19, betrag: 18000 }] }),
  einfach({ id: "b22", datum: "2026-01-03", lieferant: "TerminFix GmbH", anschrift: "Torstraße 140\n10119 Berlin", nummer: "TF-2026-118204", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-06", datei: "pdf", worum: "Online-Terminbuchung Jahreslizenz 2026 (19 %) – Auftragsverarbeiter (AVV)",
    pos: [{ text: "Online-Terminbuchung „Salon M“ (5 Kalender, SMS-Erinnerung), 01–12/2026", satz: 19, betrag: 58800 }] }),
  einfach({ id: "b23", datum: "2026-04-20", lieferant: "Steuerkanzlei Behrens & Ohlsen PartG mbB", anschrift: "Ballindamm 17\n20095 Hamburg", nummer: "2026-0412", kategorie: "beratung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-04-28", datei: "pdf", worum: "Steuerberatung: Jahresabschluss 2025 (Bilanz, GuV, E-Bilanz) und Erklärungen 2025 (19 %)",
    pos: [{ text: "Jahresabschluss 2025 (Rumpfwirtschaftsjahr 01.04.–31.12.2025), E-Bilanz", satz: 19, betrag: 185000 }, { text: "Körperschaft-, Gewerbe- und Umsatzsteuererklärung 2025", satz: 19, betrag: 60000 }] }),
  einfach({ id: "b24", datum: "2026-10-12", lieferant: "Steuerkanzlei Behrens & Ohlsen PartG mbB", anschrift: "Ballindamm 17\n20095 Hamburg", nummer: "2026-1077", kategorie: "beratung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-10-20", datei: "pdf", worum: "Steuerberatung: laufende Finanzbuchhaltung und Voranmeldungen Januar–September 2026 (19 %)",
    pos: [{ text: "Finanzbuchhaltung und Umsatzsteuer-Voranmeldungen 01–09/2026 (9 × 180,00 €)", satz: 19, betrag: 162000 }] }),
  einfach({ id: "b25", datum: "2026-01-15", lieferant: "Hanse Gewerbeversicherung AG", anschrift: "Überseering 30\n22297 Hamburg", nummer: "HG-77120-2026", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-01-15", datei: "pdf", worum: "Betriebs- und Berufshaftpflicht Friseure, Inhaltsversicherung (keine USt, Versicherungsteuer)",
    pos: [{ text: "Betriebs- und Berufshaftpflicht, Inhaltsversicherung 2026 (Beitrag inkl. 19 % Versicherungsteuer, keine Umsatzsteuer)", satz: 0, betrag: 78430 }] }),
  einfach({ id: "b26", datum: "2026-03-02", lieferant: "Handwerkskammer Hamburg", anschrift: "Holstenwall 12\n20355 Hamburg", nummer: "BB-2026-447120", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-03-16", datei: "pdf", worum: "Kammerbeitrag 2026 der Handwerkskammer (kein Umsatz, 0 %)",
    pos: [{ text: "Beitrag 2026: Grundbeitrag Kapitalgesellschaft und Zusatzbeitrag", satz: 0, betrag: 42000 }] }),
  einfach({ id: "b27", datum: "2026-11-24", lieferant: "Bundesanzeiger Verlag GmbH", anschrift: "Amsterdamer Straße 192\n50735 Köln", nummer: "BAnz-26-9917324", kategorie: "sonstiges", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-11-27", datei: "pdf", worum: "Hinterlegung des Jahresabschlusses 2025 (Kleinstkapitalgesellschaft, § 326 Abs. 2 HGB) beim Unternehmensregister (19 %)",
    pos: [{ text: "Hinterlegung Jahresabschluss 2025, Salon Sonne GmbH, HRB 178432", satz: 19, betrag: 1250 }] }),
  einfach({ id: "b28", datum: "2026-06-30", ...TEXTIL, nummer: "TA-26-06-0718", kategorie: "fremdleistungen", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-07-06", datei: "pdf", worum: "Handtuch- und Umhangservice Januar–Juni (19 %)",
    pos: [{ text: "Mietwäsche Handtücher und Kundenumhänge inkl. Waschen (Januar–Juni 2026, 6 × 145,00 €)", satz: 19, betrag: 87000 }] }),
  { ...einfach({ id: "b29", datum: "2026-12-30", ...TEXTIL, nummer: "TA-26-12-1490", kategorie: "fremdleistungen", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2027-01-08", datei: "pdf", worum: "",
    pos: [{ text: "Mietwäsche Handtücher und Kundenumhänge inkl. Waschen (Juli–Dezember 2026, 6 × 145,00 €)", satz: 19, betrag: 87000 }] }), worum: "Handtuch- und Umhangservice Juli–Dezember (19 %) – bezahlt erst 08.01.2027" },
  einfach({ id: "b30", datum: "2026-08-18", lieferant: "Elektro Kaiser GmbH", anschrift: "Lutterothstraße 54\n20255 Hamburg", nummer: "EK-26-0918", kategorie: "fremdleistungen", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-08-25", datei: "pdf", worum: "DGUV-V3-Prüfung der Elektrogeräte (19 %), passt zum Prüfprotokoll",
    pos: [{ text: "Prüfung ortsveränderlicher elektrischer Geräte nach DGUV V3 (14 Geräte à 12,00 €)", satz: 19, betrag: 16800 }] }),
  einfach({ id: "b31", datum: "2026-05-20", lieferant: "Hair Academy Hamburg GmbH", anschrift: "Valentinskamp 24\n20354 Hamburg", nummer: "HAH-26-0533", kategorie: "fortbildung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-05-22", datei: "pdf", worum: "Seminar „Balayage & Color Melting“ für 2 Friseurinnen (19 %)",
    pos: [{ text: "Tagesseminar „Balayage & Color Melting“ am 18.05.2026, Teilnehmerinnen Mia Petersen und Leonie Brandt (2 × 290,00 €)", satz: 19, betrag: 58000 }] }),
  einfach({ id: "b32", datum: "2026-09-30", lieferant: "DB Fernverkehr AG", anschrift: "Stephensonstraße 1\n60326 Frankfurt am Main", nummer: "Auftrag 7Q4KX2", kategorie: "reise", art: "brutto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-30", datei: "pdf", worum: "Bahnfahrkarte Hamburg–Düsseldorf und zurück zur Friseurmesse, 2 Personen (Fernverkehr 7 %, Fahrausweis als Kleinbetragsrechnung)",
    pos: [{ text: "Flexpreis Hamburg Hbf – Düsseldorf Hbf und zurück, 2 Erwachsene, 2. Klasse, 03.–04.10.2026", satz: 7, betrag: 23980 }] }),
  einfach({ id: "b33", datum: "2026-02-05", lieferant: "Hygienehandel Nord GmbH", anschrift: "Ruhrstraße 49\n22761 Hamburg", nummer: "HN-260205-77", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-02-12", datei: "pdf", worum: "Desinfektionsmittel (Hände, Flächen, Instrumente) und Nitrilhandschuhe (19 %)",
    pos: [{ text: "Händedesinfektion 1 l (6 Stück), Flächendesinfektion alkoholisch 1 l (6 Stück)", satz: 19, betrag: 9840 }, { text: "Instrumentendesinfektion Konzentrat 2 l (2 Stück)", satz: 19, betrag: 6400 }, { text: "Nitril-Einmalhandschuhe puderfrei, Größe S/M (10 × 100 Stück)", satz: 19, betrag: 12400 }] }),
  einfach({ id: "b34", datum: "2026-10-06", lieferant: "Buchhandlung am Eppendorfer Baum", anschrift: "Eppendorfer Baum 8\n20249 Hamburg", nummer: "Bon 06-1044", kategorie: "fortbildung", art: "brutto", vorsteuer: true, zahlung: "privat", bezahlt: null, datei: "pdf", worum: "Fachbuch, von Geschäftsführerin Chris Sonnberg PRIVAT bezahlt (7 %) – bei einer GmbH keine Privateinlage, sondern Verbindlichkeit gegenüber der Gesellschafterin",
    pos: [{ text: "Fachbuch „Farbtheorie für Friseure“", satz: 7, betrag: 3990 }] }),
  einfach({ id: "b35", datum: "2026-04-09", lieferant: "Elbdruck Medien GmbH", anschrift: "Schützenstraße 9\n22761 Hamburg", nummer: "ED-2604-219", kategorie: "werbung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-04-15", datei: "pdf", worum: "Flyer und Gutscheinkarten (19 %)",
    pos: [{ text: "Flyer DIN lang, 4/4-farbig, 2.500 Stück", satz: 19, betrag: 14500 }, { text: "Gutscheinkarten im Scheckkartenformat, 500 Stück", satz: 19, betrag: 12000 }] }),
];

// ---------------------------------------------------------------- weitere Annahmen (Eröffnungsbilanz, AfA, Zahlungen)

/** Eröffnungsbilanz 01.01.2026 (= Schlussbilanz des Rumpfwirtschaftsjahrs 2025, Annahme der Steuerberatung) */
export const EROEFFNUNG = {
  bga: 2460000, kasse: 80000, bank: 2130000,
  stammkapital: STAMMKAPITAL, verlustvortrag: -690000, darlehenGesellschafter: 2000000, ustDez2025: 860000,
};
/** Umsatzsteuer Dezember 2025 (Zahllast), gezahlt am 12.01.2026 */
export const UST_DEZ_2025 = { betrag: EROEFFNUNG.ustDez2025, gezahlt: "2026-01-12" };
/** AfA 2026 auf die Salon-Einrichtung aus 2025 laut Anlagenverzeichnis (Annahme) */
export const AFA_ALTBESTAND = 360000;
/** Behandlungsstuhl: linear 8 Jahre, ab März (10/12) */
export const AFA_STUHL = { beleg: "b17", jahre: 8, monate: 10 };
/** Umsatzsteuer-Voranmeldung monatlich, abgegeben und gezahlt am 10. des Folgemonats (bzw. nächster Werktag) */
export const VA_TAG: Record<string, string> = Object.fromEntries(MONATE_2026.map((m, i) => {
  const d = new Date(Date.UTC(2026, i + 1, 10));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return [m, d.toISOString().slice(0, 10)];
}));

// ---------------------------------------------------------------- unabhängige Rechnung

export interface RechnungsSumme { netto: number; ust: number; brutto: number; gruppen: Record<string, { netto: number; ust: number }> }
/** Zeile = Menge × Preis (auf Cent gerundet), USt je Satz aus der Netto-Summe des Satzes */
export function rechnungsSumme(pos: Pos[]): RechnungsSumme {
  const gruppen: Record<string, { netto: number; ust: number }> = {};
  for (const x of pos) {
    const zeile = rund((Math.round(x.menge * 10000) * x.preis) / 10000);
    gruppen[x.satz] ??= { netto: 0, ust: 0 };
    gruppen[x.satz]!.netto += zeile;
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
    const n = b.art === "netto" ? s.betrag : ausBrutto(s.betrag, s.satz).netto;
    const u = b.art === "netto" ? rund((s.betrag * s.satz) / 100) : s.betrag - n;
    netto += n;
    ust += u;
    jeSatz.push({ satz: s.satz, netto: n, ust: u, brutto: n + u });
  }
  return { netto, ust, brutto: netto + ust, vorsteuer: b.vorsteuer ? ust : 0, jeSatz };
}

export interface Vorgang { nummer: string; art: "rechnung" | "storno"; datum: string; leistung: string; bezahlt: string | null; vz: 1 | -1; s: RechnungsSumme; kunde: KundeId; r: Rechnung }
/** Rechnungen und Stornos mit Vorzeichen; bei der Stornorechnung ist „bezahlt“ der Tag der Erstattung */
export function vorgaenge(): Vorgang[] {
  const l: Vorgang[] = [];
  for (const r of RECHNUNGEN) {
    const s = rechnungsSumme(r.pos);
    l.push({ nummer: r.nummer, art: "rechnung", datum: r.datum, leistung: r.leistung ?? r.datum, bezahlt: r.bezahlt, vz: 1, s, kunde: r.kunde, r });
    if (r.storno) l.push({ nummer: r.storno.nummer, art: "storno", datum: r.storno.datum, leistung: r.storno.datum, bezahlt: r.storno.erstattet, vz: -1, s, kunde: r.kunde, r });
  }
  return l.sort((a, b) => a.nummer.localeCompare(b.nummer));
}

export interface UstMonat {
  m: string;
  /** Rechnungen mit Zahlungseingang (bzw. Erstattung) in diesem Monat */
  nummern: string[];
  r19: number; r7: number; r0: number;
  k19: number;
  vorsteuer: number;
  bmg19: number; bmg7: number;
  ust: number; zahllast: number;
  elsterZahllast: number;
}

/**
 * Umsatzsteuer je Monat bei Ist-Versteuerung: Rechnungen im Monat des Zahlungseingangs (vereinnahmte Entgelte), eine
 * Stornorechnung im Monat der Erstattung – wurde nie gezahlt, zählt weder Rechnung noch Storno. Kassenumsätze im Monat
 * des Z-Bons. Vorsteuer nach Belegdatum (Rechnung liegt vor, Leistung bezogen – unabhängig von der eigenen
 * Ist-Versteuerung, § 15 Abs. 1 Nr. 1 UStG).
 */
export function ustMonate(monate = MONATE_2026): UstMonat[] {
  const v = vorgaenge();
  return monate.map((m) => {
    const im = v.filter((x) => x.bezahlt && monat(x.bezahlt) === m);
    const r = (satz: string) => sum(im.map((x) => x.vz * (x.s.gruppen[satz]?.netto ?? 0)));
    const k19 = KASSE_MONATE.find((k) => k.monat === m)?.n19 ?? 0;
    const vorsteuer = sum(BELEGE.filter((b) => monat(b.datum) === m).map((b) => belegSumme(b).vorsteuer));
    const bmg19 = r("19") + k19;
    const bmg7 = r("7");
    const ust = rund((bmg19 * 19) / 100) + rund((bmg7 * 7) / 100);
    const voll = (c: number) => Math.trunc(c / 100) * 100;
    const elsterUst = rund((voll(bmg19) * 19) / 100) + rund((voll(bmg7) * 7) / 100);
    return { m, nummern: im.map((x) => x.nummer), r19: r("19"), r7: r("7"), r0: r("0"), k19, vorsteuer, bmg19, bmg7, ust, zahllast: ust - vorsteuer, elsterZahllast: elsterUst - vorsteuer };
  });
}

export function jahresSummen() {
  const q = ustMonate();
  const s = (f: (x: UstMonat) => number) => sum(q.map(f));
  return { r19: s((x) => x.r19), r7: s((x) => x.r7), r0: s((x) => x.r0), k19: s((x) => x.k19), vorsteuer: s((x) => x.vorsteuer), ust: s((x) => x.ust), zahllast: s((x) => x.zahllast), elsterZahllast: s((x) => x.elsterZahllast) };
}

/** Kategorie → GuV-Posten (Gesamtkostenverfahren, § 275 Abs. 2 HGB, vereinfacht) */
const GUV_POSTEN: Record<string, string> = {
  waren: "Materialaufwand: Roh-, Hilfs- und Betriebsstoffe, bezogene Waren", fremdleistungen: "Materialaufwand: bezogene Leistungen", personal: "Personalaufwand (Löhne, Gehälter, soziale Abgaben)",
  gwg: "Abschreibungen auf Sachanlagen (inkl. GWG)",
};
const SONSTIGE = "Sonstige betriebliche Aufwendungen";

/**
 * GuV 2026 nach HGB (periodengerecht, NICHT nach Zahlung): Umsatzerlöse = alle Rechnungen mit Leistung 2026 (Storno
 * gegen Original, neue Rechnung zählt) plus Kassenumsätze netto; Aufwand = Belege nach Belegdatum (netto bei
 * Vorsteuerabzug, sonst brutto), Anlage nur über die AfA. Ohne Ertragsteuern (KSt/GewSt rechnet die Steuerberatung).
 */
export function guv() {
  const v = vorgaenge().filter((x) => x.leistung.startsWith(JAHR) || x.art === "storno");
  const erloeseRechnungen = sum(v.map((x) => x.vz * x.s.netto));
  const erloeseKasse = sum(KASSE_MONATE.map((k) => k.n19));
  const aufwand: Record<string, number> = {};
  for (const b of BELEGE.filter((x) => x.datum.startsWith(JAHR) && x.kategorie !== "anlage")) {
    const s = belegSumme(b);
    const posten = GUV_POSTEN[b.kategorie] ?? SONSTIGE;
    aufwand[posten] = (aufwand[posten] ?? 0) + (b.vorsteuer ? s.netto : s.brutto);
  }
  const stuhl = belegSumme(BELEGE.find((b) => b.id === AFA_STUHL.beleg)!).netto;
  const afaStuhl = rund((stuhl / AFA_STUHL.jahre) * (AFA_STUHL.monate / 12));
  const afaPosten = "Abschreibungen auf Sachanlagen (inkl. GWG)";
  aufwand[afaPosten] = (aufwand[afaPosten] ?? 0) + AFA_ALTBESTAND + afaStuhl;
  const ertraege = { "Umsatzerlöse aus Rechnungen": erloeseRechnungen, "Umsatzerlöse Kasse (Dienstleistungen und Verkauf)": erloeseKasse };
  const summeErtraege = erloeseRechnungen + erloeseKasse;
  const summeAufwand = sum(Object.values(aufwand));
  return { ertraege, aufwand, summeErtraege, summeAufwand, jahresueberschuss: summeErtraege - summeAufwand, afaStuhl, stuhl };
}

/**
 * Bilanz zum 31.12.2026, aus der Eröffnungsbilanz und allen Zahlungsflüssen des Jahres fortgeschrieben (kein
 * Ausgleichsposten): Bank = Anfang + Zahlungseingänge (Rechnungen brutto, Kasse brutto, Erstattung negativ) − bezahlte
 * Belege brutto (bar wie Bank: Bargeld wird um diese Beträge weniger eingezahlt, Kassenbestand bleibt) − Personal −
 * USt-Zahlungen (Dez. 2025 und Jan.–Nov. 2026 in Höhe der exakten Zahllast). USt-Verbindlichkeit = Anfang + gebuchte USt
 * (je Rechnung bzw. Z-Bon) − Vorsteuer − Zahlungen; darin auch die noch nicht fällige USt der offenen Rechnungen (Ist).
 */
export function bilanz() {
  const g = guv();
  const v = vorgaenge();
  const zahlungenRechnungen = sum(v.filter((x) => x.bezahlt?.startsWith(JAHR)).map((x) => x.vz * x.s.brutto));
  const kasse = sum(KASSE_MONATE.map((k) => k.b19));
  const bezahlteBelege = BELEGE.filter((b) => b.zahlung !== "privat" && (b.bezahlt ?? b.datum).startsWith(JAHR) && b.kategorie !== "personal");
  const belegeAus = sum(bezahlteBelege.map((b) => belegSumme(b).brutto));
  const personal = sum([1, 2, 3, 4].map(personalQuartal));
  const monate = ustMonate();
  const ustGezahlt = UST_DEZ_2025.betrag + sum(monate.filter((x) => VA_TAG[x.m]!.startsWith(JAHR)).map((x) => x.zahllast));
  const bank = EROEFFNUNG.bank + zahlungenRechnungen + kasse - belegeAus - personal - ustGezahlt;
  // offene Rechnungen am 31.12. (nicht storniert, nicht bezahlt in 2026)
  const offen = v.filter((x) => x.art === "rechnung" && !x.r.storno && !(x.bezahlt?.startsWith(JAHR)));
  const forderungen = sum(offen.map((x) => x.s.brutto));
  const offeneBelege = BELEGE.filter((b) => b.zahlung === "bank" && b.datum.startsWith(JAHR) && !(b.bezahlt ?? b.datum).startsWith(JAHR));
  const verbLuL = sum(offeneBelege.map((b) => belegSumme(b).brutto));
  const privatBezahlt = sum(BELEGE.filter((b) => b.zahlung === "privat").map((b) => belegSumme(b).brutto));
  const ustGebucht = sum(v.filter((x) => !(x.r.storno && x.art === "rechnung" && !x.bezahlt) && !(x.art === "storno" && !x.bezahlt)).map((x) => x.vz * x.s.ust)) + sum(KASSE_MONATE.map((k) => k.u19));
  const vorsteuer = sum(BELEGE.filter((b) => b.datum.startsWith(JAHR)).map((b) => belegSumme(b).vorsteuer));
  const ustVerb = EROEFFNUNG.ustDez2025 + ustGebucht - vorsteuer - ustGezahlt;
  const bga = EROEFFNUNG.bga - AFA_ALTBESTAND + g.stuhl - g.afaStuhl;
  const aktiva: [string, number][] = [
    ["Sachanlagen: Betriebs- und Geschäftsausstattung", bga],
    ["Forderungen aus Lieferungen und Leistungen", forderungen],
    ["Kassenbestand", EROEFFNUNG.kasse],
    ["Guthaben bei Kreditinstituten", bank],
  ];
  const passiva: [string, number][] = [
    ["Gezeichnetes Kapital", EROEFFNUNG.stammkapital],
    ["Verlustvortrag", EROEFFNUNG.verlustvortrag],
    ["Jahresüberschuss 2026 (vor Ertragsteuern)", g.jahresueberschuss],
    ["Verbindlichkeiten aus Lieferungen und Leistungen", verbLuL],
    ["Verbindlichkeiten gegenüber Gesellschaftern", EROEFFNUNG.darlehenGesellschafter + privatBezahlt],
    ["Sonstige Verbindlichkeiten (Umsatzsteuer Dezember und noch nicht fällige USt)", ustVerb],
  ];
  return { aktiva, passiva, summeAktiva: sum(aktiva.map((x) => x[1])), summePassiva: sum(passiva.map((x) => x[1])), bank, forderungen, offen: offen.map((x) => x.nummer), verbLuL, ustVerb, ustGezahlt, personal };
}

/** Was eine EÜR (die für die GmbH NICHT gilt) nach Zufluss/Abfluss aus Rechnungen und Belegen hätte – nur zum Vergleich mit der Übernahme der App */
export function euerZufluss() {
  const v = vorgaenge().filter((x) => x.bezahlt?.startsWith(JAHR));
  const imJahr = BELEGE.filter((b) => (b.bezahlt ?? b.datum).startsWith(JAHR));
  return {
    reNetto: sum(v.map((x) => x.vz * x.s.netto)),
    reUst: sum(v.map((x) => x.vz * x.s.ust)),
    ausgabenOhneAnlage: sum(imJahr.filter((b) => b.kategorie !== "anlage").map((b) => (b.vorsteuer ? belegSumme(b).netto : belegSumme(b).brutto))),
    vorsteuer: sum(imJahr.map((b) => belegSumme(b).vorsteuer)),
  };
}
