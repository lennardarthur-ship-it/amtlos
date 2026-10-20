/**
 * Jahres-Szenario „Café Morgenrot“ (Leipzig, 2026) – nur die ROHDATEN und eine davon UNABHÄNGIGE Rechnung der
 * erwarteten Kennzahlen. Diese Datei importiert absichtlich nichts aus der App oder aus @amtlos/fachlogik: Prüferinnen
 * und Prüfer sollen die Ausgaben der App (werkzeuge/jahr-szenario.ts) gegen diese Zahlen halten können.
 *
 * Alle Namen, Anschriften, Steuer- und Kontonummern sind erfunden (Domains auf .example). Beträge in Cent.
 */

// ---------------------------------------------------------------- Hilfen (eigene Implementierung, nicht aus der App)

/** kaufmännisch runden, symmetrisch (−0,5 → −1) */
export const rund = (x: number) => Math.sign(x) * Math.round(Math.abs(x));
/** Cent → „1.234,56“ */
export const eur = (c: number) => {
  const neg = c < 0;
  const a = Math.abs(Math.round(c));
  const ganz = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${ganz},${String(a % 100).padStart(2, "0")}`;
};
/** ISO → TT.MM.JJJJ */
export const de = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
export const quartal = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;

/** deutsche IBAN mit gültiger Prüfziffer aus BLZ und Kontonummer (erfundenes Konto) */
function ibanDe(blz: string, konto: string): string {
  const bban = blz + konto.padStart(10, "0");
  let rest = 0;
  for (const z of `${bban}131400`) rest = (rest * 10 + Number(z)) % 97;
  return `DE${String(98 - rest).padStart(2, "0")}${bban}`;
}

/** kleiner deterministischer Zufall (mulberry32), damit jeder Lauf dieselben Tageswerte erzeugt */
function zufall(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- Betrieb

export const JAHR = "2026";
export const BETRIEB = {
  name: "Café Morgenrot",
  strasse: "Zschochersche Straße 48",
  plz: "04229",
  ort: "Leipzig",
  bundesland: "Sachsen",
  verantwortlich: "Jana Weber",
  telefon: "0341 4927183",
  email: "hallo@cafe-morgenrot.example",
  website: "www.cafe-morgenrot.example",
  steuernummer: "231/284/51637",
  ust_idnr: "DE318452976",
  iban: ibanDe("86055592", "1102345678"),
  bank: "Sparkasse Leipzig",
  bic: "WELADE8LXXX",
  rechtsform: "Einzelunternehmen",
  versteuerung: "soll",
  farbe: "#B5462F",
};
export const INHABERIN = { name: "Jana Weber", geburtsname: "Jana Lehmann", geburtsdatum: "1986-11-03", geburtsort: "Leipzig", wohnanschrift: "Holbeinstraße 21\n04229 Leipzig" };
export const GRUENDUNG = "2022-03-01";

export const KUNDEN = {
  k1: { name: "Gohliser Software GmbH", anschrift: "Menckestraße 27\n04155 Leipzig", email: "buchhaltung@gohliser-software.example" },
  k2: { name: "Kanzlei Brandt & Seidel Rechtsanwälte PartG mbB", anschrift: "Dittrichring 12\n04109 Leipzig", email: "rechnungen@brandt-seidel.example" },
  k3: { name: "Kunstverein Plagwitz e. V.", anschrift: "Karl-Heine-Straße 93\n04229 Leipzig", email: "kasse@kunstverein-plagwitz.example" },
  k4: { name: "Wohnungsgenossenschaft Lindenau eG", anschrift: "Lützner Straße 160\n04179 Leipzig", email: "einkauf@wg-lindenau.example" },
  k5: { name: "Katrin Hoffmann", anschrift: "Kochstraße 44\n04275 Leipzig" },
  k6: { name: "Thomas Becker", anschrift: "Arndtstraße 9\n04275 Leipzig" },
  k7: { name: "Alpenblick Events GmbH", anschrift: "Mariahilfer Straße 88\n1070 Wien\nÖsterreich", email: "office@alpenblick-events.example", ust_idnr: "ATU69876543" },
  k8: { name: "Zahnarztpraxis Dr. med. dent. Lena Vogt", anschrift: "Karl-Liebknecht-Straße 101\n04275 Leipzig", email: "praxis@zahnarzt-vogt.example" },
} as const;
export type KundeId = keyof typeof KUNDEN;

export const MITARBEITER = {
  m1: {
    name: "Sabine Krüger", anschrift: "Georg-Schwarz-Straße 112\n04179 Leipzig", geburtsdatum: "1988-07-14", geburtsort: "Halle (Saale)", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Koch/Köchin", beginn: "2022-03-01", steuer_id: "57381924650", steuerklasse: "I", sv_nummer: "53140788K123", krankenkasse: "AOK PLUS", iban: ibanDe("86055592", "1190043217"),
  },
  m2: {
    name: "Leon Schubert", anschrift: "Erich-Zeigner-Allee 35\n04229 Leipzig", geburtsdatum: "2003-02-09", geburtsort: "Dresden", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Servicekraft", beginn: "2025-09-01", steuer_id: "83054127693", steuerklasse: "I", sv_nummer: "65090203S047", krankenkasse: "Techniker Krankenkasse", iban: ibanDe("86055592", "1240088315"),
  },
} as const;

// ---------------------------------------------------------------- Ausgangsrechnungen

export interface Pos { bez: string; menge: number; einheit: string; preis: number; satz: 19 | 7 | 0 }
export interface Rechnung {
  id: string;
  /** erwartete fortlaufende Nummer */
  nummer: string;
  datum: string;
  /** Leistungsdatum (ISO), null = wie Rechnungsdatum */
  leistung: string | null;
  ziel: "7" | "14" | "30" | "sofort";
  kunde: KundeId;
  /** abweichende Empfängerangaben (absichtlich falsche Rechnung) */
  kundeAbweichend?: { name: string; anschrift: string };
  pos: Pos[];
  hinweise?: string[];
  hinweis: string;
  bezahlt: string | null;
  /** wird an diesem Tag storniert; die Stornorechnung bekommt die Nummer `stornoNummer` */
  storno?: { datum: string; nummer: string; id: string; grund: string };
  /** ersetzt die stornierte Rechnung mit dieser ID (Rechnungskorrektur) */
  ersetzt?: string;
  worum: string;
}

const DANKE = "Vielen Dank für Ihren Auftrag.\nBitte geben Sie bei der Zahlung die Rechnungsnummer an.";

export const RECHNUNGEN: Rechnung[] = [
  { id: "r01", nummer: "2026-001", datum: "2026-01-22", leistung: "2026-01-20", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-02-03",
    worum: "Frühstückscatering für 18 Personen (Teamfrühstück) am 20.01.: Speisen 7 %, Getränke und Lieferung 19 %.",
    pos: [
      { bez: "Frühstücksbuffet (je Person)", menge: 18, einheit: "Person", preis: 1450, satz: 7 },
      { bez: "Kaffee, Tee und Säfte – Getränkepauschale (je Person)", menge: 18, einheit: "Person", preis: 420, satz: 19 },
      { bez: "Lieferung und Aufbau", menge: 1, einheit: "Pauschale", preis: 2500, satz: 19 },
    ] },
  { id: "r02", nummer: "2026-002", datum: "2026-02-12", leistung: "2026-02-11", ziel: "14", kunde: "k2", hinweis: DANKE, bezahlt: "2026-02-20",
    worum: "Mittagsimbiss für eine Mandantenveranstaltung am 11.02.: Fingerfood und Kuchen 7 %, Kaffee und Wasser 19 %.",
    pos: [
      { bez: "Fingerfood-Platte gemischt (24 Teile)", menge: 6, einheit: "Stück", preis: 4200, satz: 7 },
      { bez: "Kuchenplatte (16 Stück)", menge: 2, einheit: "Stück", preis: 2850, satz: 7 },
      { bez: "Kaffee/Tee in der Pumpkanne (2 Liter)", menge: 4, einheit: "Stück", preis: 1200, satz: 19 },
      { bez: "Mineralwasser 0,75 l", menge: 12, einheit: "Stück", preis: 280, satz: 19 },
    ] },
  { id: "r03", nummer: "2026-003", datum: "2026-03-07", leistung: null, ziel: "sofort", kunde: "k5", hinweis: "Vielen Dank für Ihre Bestellung.", bezahlt: "2026-03-09",
    worum: "Privatkundin: Geburtstagstorte zum Abholen und 0,5 kg Kaffeebohnen (Lieferungen, 7 %).",
    pos: [
      { bez: "Geburtstagstorte Schokolade-Himbeere (24 Stück)", menge: 1, einheit: "Stück", preis: 6800, satz: 7 },
      { bez: "Kaffeebohnen Hausmischung", menge: 0.5, einheit: "Kilogramm", preis: 2600, satz: 7 },
    ] },
  { id: "r04", nummer: "2026-004", datum: "2026-03-19", leistung: "2026-03-13", ziel: "14", kunde: "k3", kundeAbweichend: { name: "Kunstverein Plagwitz", anschrift: "Karl-Heine-Straße 39\n04229 Leipzig" }, hinweis: DANKE, bezahlt: null,
    storno: { datum: "2026-03-24", nummer: "2026-005", id: "r05", grund: "Empfänger falsch (Vereinsname ohne „e. V.“, Hausnummer 39 statt 93) – Storno und neue Rechnung 2026-006" },
    worum: "Vernissage am 13.03.: Canapés 7 %, Sekt/Saft und 2,75 Std. Servicepersonal 19 %. Empfänger falsch geschrieben → storniert (2026-005) und neu gestellt (2026-006).",
    pos: [
      { bez: "Canapés, gemischt", menge: 120, einheit: "Stück", preis: 190, satz: 7 },
      { bez: "Sekt 0,75 l", menge: 10, einheit: "Stück", preis: 1150, satz: 19 },
      { bez: "Saftschorle 1 l", menge: 8, einheit: "Stück", preis: 450, satz: 19 },
      { bez: "Servicepersonal", menge: 2.75, einheit: "Stunde", preis: 3200, satz: 19 },
    ] },
  { id: "r06", nummer: "2026-006", datum: "2026-03-24", leistung: "2026-03-13", ziel: "14", kunde: "k3", ersetzt: "r04", hinweis: `Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-004 vom 19.03.2026.\n${DANKE}`, bezahlt: "2026-04-02",
    worum: "Korrigierte Rechnung zur Vernissage (gleiche Positionen wie 2026-004, richtiger Empfänger).",
    pos: [
      { bez: "Canapés, gemischt", menge: 120, einheit: "Stück", preis: 190, satz: 7 },
      { bez: "Sekt 0,75 l", menge: 10, einheit: "Stück", preis: 1150, satz: 19 },
      { bez: "Saftschorle 1 l", menge: 8, einheit: "Stück", preis: 450, satz: 19 },
      { bez: "Servicepersonal", menge: 2.75, einheit: "Stunde", preis: 3200, satz: 19 },
    ] },
  { id: "r07", nummer: "2026-007", datum: "2026-04-16", leistung: "2026-04-15", ziel: "14", kunde: "k4", hinweis: DANKE, bezahlt: "2026-04-30",
    worum: "Mitgliederversammlung am 15.04.: belegte Brötchen 7 % mit Rabattzeile −10 % auf Speisen, Kaffee 19 %.",
    pos: [
      { bez: "Belegte Brötchen, gemischt", menge: 80, einheit: "Stück", preis: 240, satz: 7 },
      { bez: "Kaffee (Liter)", menge: 12, einheit: "Liter", preis: 650, satz: 19 },
      { bez: "Rabatt 10 % auf Speisen (Stammkunde)", menge: 1, einheit: "Pauschale", preis: -1920, satz: 7 },
    ] },
  { id: "r08", nummer: "2026-008", datum: "2026-05-21", leistung: "2026-05-20", ziel: "14", kunde: "k8", hinweis: DANKE, bezahlt: "2026-06-01",
    worum: "Kuchenbuffet zum Praxisjubiläum am 20.05.: Kuchen 7 %, Kaffee-Flatrate 19 %.",
    pos: [
      { bez: "Kuchen und Torten (Stück)", menge: 40, einheit: "Stück", preis: 320, satz: 7 },
      { bez: "Kaffee-Flatrate (je Person)", menge: 25, einheit: "Person", preis: 390, satz: 19 },
    ] },
  { id: "r09", nummer: "2026-009", datum: "2026-06-26", leistung: "2026-06-20", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: null,
    storno: { datum: "2026-07-08", nummer: "2026-010", id: "r10", grund: "40 statt der tatsächlich 32 Gäste berechnet – Storno und neue Rechnung 2026-011 (Leistung bleibt 20.06.2026)" },
    worum: "Sommerfest am 20.06. für 40 Personen berechnet, es kamen 32 → im Juli storniert (2026-010) und mit 32 Personen neu gestellt (2026-011). Quartalsübergreifend!",
    pos: [
      { bez: "Grillbuffet vegetarisch/klassisch (je Person)", menge: 40, einheit: "Person", preis: 2400, satz: 7 },
      { bez: "Getränkepauschale (je Person)", menge: 40, einheit: "Person", preis: 950, satz: 19 },
      { bez: "Servicepersonal", menge: 5.5, einheit: "Stunde", preis: 3200, satz: 19 },
      { bez: "Geschirr- und Besteckverleih (je Person)", menge: 40, einheit: "Person", preis: 150, satz: 19 },
    ] },
  { id: "r11", nummer: "2026-011", datum: "2026-07-08", leistung: "2026-06-20", ziel: "14", kunde: "k1", ersetzt: "r09", hinweis: `Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-009 vom 26.06.2026 (32 statt 40 Personen).\n${DANKE}`, bezahlt: "2026-07-20",
    worum: "Neue Rechnung Sommerfest mit 32 Personen (Leistungsdatum 20.06.2026).",
    pos: [
      { bez: "Grillbuffet vegetarisch/klassisch (je Person)", menge: 32, einheit: "Person", preis: 2400, satz: 7 },
      { bez: "Getränkepauschale (je Person)", menge: 32, einheit: "Person", preis: 950, satz: 19 },
      { bez: "Servicepersonal", menge: 5.5, einheit: "Stunde", preis: 3200, satz: 19 },
      { bez: "Geschirr- und Besteckverleih (je Person)", menge: 32, einheit: "Person", preis: 150, satz: 19 },
    ] },
  { id: "r12", nummer: "2026-012", datum: "2026-08-27", leistung: "2026-08-25", ziel: "30", kunde: "k7", hinweise: ["igl"], hinweis: "Vielen Dank für Ihren Auftrag.", bezahlt: "2026-09-10",
    worum: "Österreich (B2B, USt-IdNr. ATU…): 40 Präsentboxen per Spedition nach Wien – steuerfreie innergemeinschaftliche Lieferung (0 %, Hinweis „igl“).",
    pos: [
      { bez: "Präsentbox „Leipziger Lerche“ (6 Lerchen, 250 g Röstkaffee)", menge: 40, einheit: "Stück", preis: 1890, satz: 0 },
      { bez: "Versand per Spedition nach Wien", menge: 1, einheit: "Pauschale", preis: 8500, satz: 0 },
    ] },
  { id: "r13", nummer: "2026-013", datum: "2026-09-17", leistung: "2026-09-16", ziel: "14", kunde: "k2", hinweis: DANKE, bezahlt: "2026-10-01",
    worum: "Kanzleijubiläum am 16.09.: Fingerfood/Antipasti 7 %, Wein und 4,25 Std. Service 19 %.",
    pos: [
      { bez: "Fingerfood-Platte gemischt (24 Teile)", menge: 10, einheit: "Stück", preis: 4200, satz: 7 },
      { bez: "Antipasti-Platte", menge: 4, einheit: "Stück", preis: 3600, satz: 7 },
      { bez: "Weißwein 0,75 l", menge: 12, einheit: "Stück", preis: 1650, satz: 19 },
      { bez: "Servicepersonal", menge: 4.25, einheit: "Stunde", preis: 3200, satz: 19 },
    ] },
  { id: "r14", nummer: "2026-014", datum: "2026-10-08", leistung: null, ziel: "sofort", kunde: "k6", hinweis: "Vielen Dank für Ihren Besuch.", bezahlt: "2026-10-12",
    worum: "Privatkunde: 1,5 kg Espressobohnen (7 %) und Barista-Kurs für 2 Personen (19 %).",
    pos: [
      { bez: "Kaffeebohnen Espresso-Mischung", menge: 1.5, einheit: "Kilogramm", preis: 2400, satz: 7 },
      { bez: "Barista-Grundkurs (je Person, 3 Stunden)", menge: 2, einheit: "Person", preis: 4500, satz: 19 },
    ] },
  { id: "r15", nummer: "2026-015", datum: "2026-11-12", leistung: "2026-11-11", ziel: "14", kunde: "k4", hinweis: DANKE, bezahlt: null,
    worum: "Seniorennachmittag am 11.11.: Kuchen 7 %, Kaffee 19 %. Bleibt UNBEZAHLT (fällig 26.11., überfällig).",
    pos: [
      { bez: "Kuchen und Torten (Stück)", menge: 60, einheit: "Stück", preis: 320, satz: 7 },
      { bez: "Kaffee/Tee in der Pumpkanne (2 Liter)", menge: 10, einheit: "Stück", preis: 1200, satz: 19 },
    ] },
  { id: "r16", nummer: "2026-016", datum: "2026-12-10", leistung: "2026-12-09", ziel: "30", kunde: "k1", hinweis: DANKE, bezahlt: "2027-01-08",
    worum: "Weihnachtsfeier am 09.12.: Menü 7 %, Glühwein/Getränke/6 Std. Service 19 %. Bezahlt erst am 08.01.2027 (EÜR 2027).",
    pos: [
      { bez: "Weihnachtsmenü, 3 Gänge (je Person)", menge: 35, einheit: "Person", preis: 3200, satz: 7 },
      { bez: "Glühwein und Punsch (Liter)", menge: 15, einheit: "Liter", preis: 1200, satz: 19 },
      { bez: "Getränkepauschale alkoholfrei (je Person)", menge: 35, einheit: "Person", preis: 450, satz: 19 },
      { bez: "Servicepersonal", menge: 6, einheit: "Stunde", preis: 3200, satz: 19 },
    ] },
  { id: "r17", nummer: "2026-017", datum: "2026-12-18", leistung: "2026-12-17", ziel: "14", kunde: "k3", hinweis: DANKE, bezahlt: "2026-12-29",
    worum: "Jahresausklang im Kunstverein am 17.12.: Canapés 7 %, Sekt 19 %.",
    pos: [
      { bez: "Canapés, gemischt", menge: 80, einheit: "Stück", preis: 190, satz: 7 },
      { bez: "Sekt 0,75 l", menge: 6, einheit: "Stück", preis: 1150, satz: 19 },
    ] },
];

// ---------------------------------------------------------------- Lohn (Zahlen vom Lohnbüro – nicht nachgerechnet, Annahmen)

export interface LohnMonat { monat: string; zahltag: string; brutto: number; lohnsteuer: number; sv_an: number; sv_ag: number; stunden?: number }
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const letzterTag = (m: number) => new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10);
/** letzter Bankarbeitstag des Monats (ohne Feiertagsprüfung – im Szenario fällt keiner darauf) */
const letzterWerktag = (m: number) => {
  const d = new Date(Date.UTC(2026, m, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
/** Vollzeit-Köchin: 2.950 € bis Juni, ab Juli 3.050 €; LSt Steuerklasse I (Werte des Lohnbüros); SV AN 22,25 % (Sachsen, kinderlos), AG 22,84 % inkl. Umlagen */
export const LOHN_M1: LohnMonat[] = MONATE.map((m, i) => {
  const brutto = i < 6 ? 295000 : 305000;
  return { monat: `${m} 2026`, zahltag: letzterWerktag(i + 1), brutto, lohnsteuer: i < 6 ? 30925 : 33108, sv_an: rund(brutto * 0.2225), sv_ag: rund(brutto * 0.2284) };
});
/** Minijob Service: 14,50 €/Std., Stunden je Monat (Mai: 36 Std. gearbeitet + 4,5 Std. Urlaub); AG-Pauschalabgaben 31,47 % (KV 13, RV 15, Pauschsteuer 2, U1 1,1, U2 0,22, InsG 0,15); RV-befreit */
const STUNDEN_M2 = [38.5, 36, 40, 41, 40.5, 41.5, 41.5, 30, 40, 39.5, 38, 41.5];
export const STUNDENLOHN_M2 = 1450;
export const LOHN_M2: LohnMonat[] = MONATE.map((m, i) => {
  const brutto = rund(STUNDEN_M2[i]! * STUNDENLOHN_M2);
  return { monat: `${m} 2026`, zahltag: letzterWerktag(i + 1), brutto, lohnsteuer: 0, sv_an: 0, sv_ag: rund(brutto * 0.3147), stunden: STUNDEN_M2[i]! };
});
/** Personalkosten eines Quartals (Bruttolöhne + Arbeitgeberanteile beider Beschäftigter) */
export const personalQuartal = (q: number) =>
  [0, 1, 2].reduce((a, k) => {
    const i = (q - 1) * 3 + k;
    return a + LOHN_M1[i]!.brutto + LOHN_M1[i]!.sv_ag + LOHN_M2[i]!.brutto + LOHN_M2[i]!.sv_ag;
  }, 0);

// ---------------------------------------------------------------- Belege (Eingangsrechnungen, Kassenbons, Eigenbelege)

export interface BelegPos { text: string; menge?: string; satz: 19 | 7 | 0; betrag: number }
export interface BelegRoh {
  id: string;
  datum: string;
  lieferant: string;
  anschrift: string;
  nummer: string | null;
  kategorie: string;
  /** „netto“: Rechnung weist Netto und USt je Satz aus (USt = rund(netto × Satz)); „brutto“: Kassenbon/Kleinbetragsrechnung, nur Bruttobetrag je Satz */
  art: "netto" | "brutto";
  /** je Satz: bei „netto“ der Nettobetrag, bei „brutto“ der Bruttobetrag */
  saetze: { satz: 19 | 7 | 0; betrag: number }[];
  vorsteuer: boolean;
  zahlung: "bank" | "bar" | "privat";
  bezahlt: string | null;
  notiz?: string;
  /** Datei: Foto/PDF oder E-Rechnung */
  datei: "pdf" | "xml";
  /** Positionen für den Beleg (Netto bei „netto“, Brutto bei „brutto“) */
  pos: BelegPos[];
  worum: string;
}

const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);
const posSatz = (pos: BelegPos[], satz: number) => sum(pos.filter((p) => p.satz === satz).map((p) => p.betrag));
/** Sätze aus den Positionen ableiten */
const ausPos = (pos: BelegPos[]) => ([19, 7, 0] as const).filter((s) => pos.some((p) => p.satz === s)).map((satz) => ({ satz, betrag: posSatz(pos, satz) }));

const VERMIETER = { lieferant: "Immobilienverwaltung Krause & Söhne GbR", anschrift: "Gottschedstraße 7\n04109 Leipzig" };
const LOHNBUERO = { lieferant: "Lohnbüro Lorenz (Eigenbeleg Lohnjournal)", anschrift: "Petra Lorenz, Merseburger Straße 201\n04178 Leipzig" };
const ENERGIE = { lieferant: "Lindenauer Energie GmbH", anschrift: "Industriestraße 85\n04229 Leipzig" };
const GROSSMARKT = { lieferant: "Großmarkt Leipzig-Nord GmbH", anschrift: "Maximilianallee 50\n04129 Leipzig" };
const ROESTWERK = { lieferant: "Röstwerk Plagwitz GmbH", anschrift: "Weißenfelser Straße 65\n04229 Leipzig" };
const GASTROTECHNIK = { lieferant: "Gastrotechnik Sachsen GmbH", anschrift: "Torgauer Straße 231\n04347 Leipzig" };

function miete(id: string, datum: string, q: number, bezahlt: string): BelegRoh {
  const von = MONATE[(q - 1) * 3]!;
  const bis = MONATE[q * 3 - 1]!;
  const pos: BelegPos[] = [{ text: `Gewerbemiete Café, Zschochersche Straße 48, EG (${von}–${bis} 2026, 3 × 1.650,00 €)`, satz: 19, betrag: 495000 }, { text: `Nebenkostenvorauszahlung (${von}–${bis} 2026, 3 × 200,00 €)`, satz: 19, betrag: 60000 }];
  return { id, datum, ...VERMIETER, nummer: `MR-2026-Q${q}`, kategorie: "miete", art: "netto", saetze: ausPos(pos), vorsteuer: true, zahlung: "bank", bezahlt, notiz: "Mietvertrag mit Option zur Umsatzsteuer (§ 9 UStG), vierteljährlich im Voraus", datei: "pdf", pos, worum: `Miete und Nebenkosten Q${q} (Dauerrechnung, 19 %)` };
}
function lohn(id: string, q: number): BelegRoh {
  const datum = letzterTag(q * 3);
  const betrag = personalQuartal(q);
  return {
    id, datum, ...LOHNBUERO, nummer: `LJ-2026-Q${q}`, kategorie: "personal", art: "brutto", saetze: [{ satz: 0, betrag }], vorsteuer: false, zahlung: "bank", bezahlt: datum,
    notiz: "Bruttolöhne und Arbeitgeberanteile (Köchin Vollzeit, Minijob Service) laut Lohnjournal; Zahlungen an Beschäftigte, Krankenkassen, Minijob-Zentrale und Finanzamt", datei: "pdf",
    pos: [0, 1, 2].flatMap((k) => {
      const i = (q - 1) * 3 + k;
      return [
        { text: `${LOHN_M1[i]!.monat}: Sabine Krüger – Bruttolohn`, satz: 0 as const, betrag: LOHN_M1[i]!.brutto },
        { text: `${LOHN_M1[i]!.monat}: Sabine Krüger – AG-Anteile SV und Umlagen`, satz: 0 as const, betrag: LOHN_M1[i]!.sv_ag },
        { text: `${LOHN_M2[i]!.monat}: Leon Schubert – Minijob ${String(LOHN_M2[i]!.stunden).replace(".", ",")} Std. × 14,50 €`, satz: 0 as const, betrag: LOHN_M2[i]!.brutto },
        { text: `${LOHN_M2[i]!.monat}: Leon Schubert – Pauschalabgaben Minijob-Zentrale`, satz: 0 as const, betrag: LOHN_M2[i]!.sv_ag },
      ];
    }),
    worum: `Personalkosten Q${q} als Eigenbeleg (Lohnjournal, 0 %, ohne Vorsteuer)`,
  };
}
function grossmarkt(id: string, datum: string, nr: string, n7: number, n19: number, bezahlt: string, monate: string): BelegRoh {
  const pos: BelegPos[] = [
    { text: `Lebensmittel: Molkereiprodukte, Eier, Mehl, Zucker, Obst und Gemüse, Fleisch und Käse (${monate})`, satz: 7, betrag: n7 },
    { text: `Getränke (Säfte, Wasser, Wein, Sekt), Servietten, Reinigungs- und Verbrauchsmaterial (${monate})`, satz: 19, betrag: n19 },
  ];
  return { id, datum, ...GROSSMARKT, nummer: nr, kategorie: "waren", art: "netto", saetze: ausPos(pos), vorsteuer: true, zahlung: "bank", bezahlt, notiz: "Quartals-Sammelrechnung zur Kundenkarte 40-118734", datei: "pdf", pos, worum: `Wareneinkauf Großmarkt ${monate} (7 % + 19 %)` };
}
const einfach = (o: Omit<BelegRoh, "saetze">): BelegRoh => ({ ...o, saetze: ausPos(o.pos) });

/** Die Positionen der empfangenen E-Rechnung (XRechnung) – Grundlage für das XML des Lieferanten */
export const ERECHNUNG_POS = [
  { bez: "Espresso-Bohnen „Morgenrot Hausmischung“", menge: 45, einheit: "Kilogramm", preis: 2190, satz: 7 as const },
  { bez: "Espresso entkoffeiniert", menge: 5, einheit: "Kilogramm", preis: 2450, satz: 7 as const },
  { bez: "Filterkaffee Äthiopien Sidamo", menge: 20, einheit: "Kilogramm", preis: 1920, satz: 7 as const },
  { bez: "Versandkosten", menge: 1, einheit: "Pauschale", preis: 1290, satz: 7 as const },
];

export const BELEGE: BelegRoh[] = [
  miete("b01", "2026-01-02", 1, "2026-01-05"),
  miete("b02", "2026-04-01", 2, "2026-04-03"),
  miete("b03", "2026-07-01", 3, "2026-07-03"),
  miete("b04", "2026-10-01", 4, "2026-10-05"),
  lohn("b05", 1),
  lohn("b06", 2),
  lohn("b07", 3),
  lohn("b08", 4),
  einfach({ id: "b09", datum: "2026-01-20", ...ENERGIE, nummer: "AB-7731-2026-1", kategorie: "miete", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-22", datei: "pdf", worum: "Abschläge Strom und Gas Januar–Juni (19 %), als „Miete und Nebenkosten“ erfasst (keine eigene Kategorie Energie)",
    pos: [{ text: "Abschläge Strom Januar–Juni 2026 (6 × 290,00 €)", satz: 19, betrag: 174000 }, { text: "Abschläge Erdgas Januar–Juni 2026 (6 × 160,00 €)", satz: 19, betrag: 96000 }] }),
  einfach({ id: "b10", datum: "2026-07-20", ...ENERGIE, nummer: "AB-7731-2026-2", kategorie: "miete", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-07-22", datei: "pdf", worum: "Abschläge Strom und Gas Juli–Dezember (19 %)",
    pos: [{ text: "Abschläge Strom Juli–Dezember 2026 (6 × 290,00 €)", satz: 19, betrag: 174000 }, { text: "Abschläge Erdgas Juli–Dezember 2026 (6 × 160,00 €)", satz: 19, betrag: 96000 }] }),
  grossmarkt("b11", "2026-03-31", "SR-2026-03-4471", 880421, 194185, "2026-04-08", "Januar–März 2026"),
  grossmarkt("b12", "2026-06-30", "SR-2026-06-5120", 1016840, 221860, "2026-07-08", "April–Juni 2026"),
  grossmarkt("b13", "2026-09-30", "SR-2026-09-5893", 1051486, 234490, "2026-10-08", "Juli–September 2026"),
  { ...grossmarkt("b14", "2026-12-30", "SR-2026-12-6601", 945850, 208425, "2027-01-08", "Oktober–Dezember 2026"), worum: "Wareneinkauf Großmarkt Q4 (7 % + 19 %) – Belegdatum 30.12.2026, bezahlt erst 08.01.2027 (Vorsteuer Q4/2026, Ausgabe EÜR 2027)" },
  einfach({ id: "b15", datum: "2026-02-18", ...ROESTWERK, nummer: "RP-26-0112", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-02-25", datei: "pdf", worum: "Röstkaffee (PDF-Rechnung, 7 %)",
    pos: [{ text: "Espresso-Bohnen „Morgenrot Hausmischung“", menge: "40 kg × 21,50 €", satz: 7, betrag: 86000 }, { text: "Filterkaffee Kolumbien Huila", menge: "20 kg × 18,90 €", satz: 7, betrag: 37800 }] }),
  einfach({ id: "b16", datum: "2026-09-14", ...ROESTWERK, nummer: "RP-26-0871", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-24", datei: "xml", worum: "Röstkaffee als E-RECHNUNG (XRechnung UBL) empfangen, mit der App eingelesen (7 %)",
    pos: ERECHNUNG_POS.map((p) => ({ text: p.bez, menge: `${String(p.menge).replace(".", ",")} × ${eur(p.preis)} €`, satz: p.satz, betrag: rund(p.menge * p.preis) })) }),
  einfach({ id: "b17", datum: "2026-05-09", lieferant: "Frischemarkt Lindenau", anschrift: "Lützner Straße 39\n04177 Leipzig", nummer: "Bon 4711-0509-0183", kategorie: "waren", art: "brutto", vorsteuer: true, zahlung: "bar", bezahlt: null, datei: "pdf", worum: "Kassenbon mit 7 % UND 19 % (Kleinbetragsrechnung, bar, steht im Kassenbuch Mai)",
    pos: [{ text: "Schlagsahne 30 % (6 × 1 l)", satz: 7, betrag: 1794 }, { text: "Süßrahmbutter (8 × 250 g)", satz: 7, betrag: 1592 }, { text: "Zitronen Bio (2 kg)", satz: 7, betrag: 734 }, { text: "Spülmittel (2 × 1 l)", satz: 19, betrag: 598 }, { text: "Müllbeutel 120 l (3 Rollen)", satz: 19, betrag: 1719 }] }),
  einfach({ id: "b18", datum: "2026-05-16", lieferant: "Markt am Felsenkeller", anschrift: "Karl-Heine-Straße 32\n04229 Leipzig", nummer: null, kategorie: "waren", art: "brutto", vorsteuer: true, zahlung: "bar", bezahlt: null, datei: "pdf", worum: "Kleinbetragsrechnung ohne Nummer (Milch nachgekauft, 7 %, bar)",
    pos: [{ text: "Frischmilch 3,5 % (12 × 1 l à 1,39 €), 7 %", satz: 7, betrag: 1668 }, { text: "Hafermilch Barista (1 l), 7 %", satz: 7, betrag: 179 }] }),
  einfach({ id: "b19", datum: "2026-05-22", lieferant: "Schreibwaren Krause (Postfiliale)", anschrift: "Merseburger Straße 102\n04177 Leipzig", nummer: "Q-220526-17", kategorie: "buero", art: "brutto", vorsteuer: true, zahlung: "bar", bezahlt: null, datei: "pdf", worum: "Briefmarken (steuerfrei, 0 %, bar)",
    pos: [{ text: "Briefmarken 0,95 € (10 Stück), umsatzsteuerfrei", satz: 0, betrag: 950 }] }),
  einfach({ id: "b20", datum: "2026-03-03", ...GASTROTECHNIK, nummer: "GT-2026-0147", kategorie: "anlage", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-10", datei: "pdf", worum: "ANLAGE über 800 € netto: Haubenspülmaschine 3.450 € netto (Abschreibung 5 Jahre, ab März)",
    pos: [{ text: "Haubenspülmaschine HX-500 (Gastro), inkl. Wasserenthärter", satz: 19, betrag: 318000 }, { text: "Lieferung, Montage und Inbetriebnahme", satz: 19, betrag: 27000 }] }),
  einfach({ id: "b21", datum: "2026-02-10", ...GASTROTECHNIK, nummer: "GT-2026-0089", kategorie: "gwg", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-02-12", datei: "pdf", worum: "GWG: Espressomühle 649 € netto",
    pos: [{ text: "Espressomühle mit stufenloser Mahlgradverstellung, 64-mm-Mahlscheiben", satz: 19, betrag: 64900 }] }),
  einfach({ id: "b22", datum: "2026-06-18", lieferant: "Tankhof Lindenau", anschrift: "Lützner Straße 121\n04177 Leipzig", nummer: "Bon 2026-061834", kategorie: "fahrzeug", art: "brutto", vorsteuer: true, zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Tankquittung Diesel (Lieferwagen für Catering, 19 %, Karte)",
    pos: [{ text: "Diesel 46,12 l × 1,699 €", satz: 19, betrag: 7836 }] }),
  einfach({ id: "b23", datum: "2026-04-20", lieferant: "Druckhaus Connewitz", anschrift: "Bornaische Straße 18\n04277 Leipzig", nummer: "DC-2604-332", kategorie: "werbung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-04-27", datei: "pdf", worum: "Flyer-Druck (19 %)",
    pos: [{ text: "Flyer DIN A6, 4/4-farbig, 2.000 Stück", satz: 19, betrag: 20000 }] }),
  einfach({ id: "b24", datum: "2026-01-10", lieferant: "Hostwerk Leipzig GmbH", anschrift: "Spinnereistraße 7\n04179 Leipzig", nummer: "HW-2026-00418", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-10", datei: "pdf", worum: "Webhosting und E-Mail 2026 (19 %) – Auftragsverarbeiter (AVV)",
    pos: [{ text: "Webhosting „Business S“ inkl. 5 E-Mail-Postfächer, 01/2026–12/2026", satz: 19, betrag: 12000 }] }),
  einfach({ id: "b25", datum: "2026-01-05", lieferant: "KassaVista GmbH", anschrift: "Am Brühl 12\n04109 Leipzig", nummer: "KV-R-2026-10293", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-07", datei: "pdf", worum: "Kassensoftware und Cloud-TSE 2026 (19 %)",
    pos: [{ text: "Kassen-App KassaVista POS, Lizenz 2026", satz: 19, betrag: 23400 }, { text: "Cloud-TSE inkl. Zertifikat, Jahresgebühr 2026", satz: 19, betrag: 11790 }] }),
  einfach({ id: "b26", datum: "2026-02-20", lieferant: "Steuerkanzlei Albrecht & Partner mbB", anschrift: "Käthe-Kollwitz-Straße 60\n04109 Leipzig", nummer: "2026-0217", kategorie: "beratung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-02", datei: "pdf", worum: "Steuerberatung: EÜR und Erklärungen 2025 (19 %)",
    pos: [{ text: "Einnahmen-Überschuss-Rechnung 2025", satz: 19, betrag: 68000 }, { text: "Einkommen-, Gewerbe- und Umsatzsteuererklärung 2025", satz: 19, betrag: 52000 }] }),
  einfach({ id: "b27", datum: "2026-01-15", lieferant: "Mitteldeutsche Gastro-Versicherung AG", anschrift: "Augustusplatz 9\n04109 Leipzig", nummer: "VS-88213-2026", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-01-15", datei: "pdf", worum: "Betriebshaftpflicht und Inhaltsversicherung (keine USt, Versicherungsteuer)",
    pos: [{ text: "Betriebshaftpflicht und Inhaltsversicherung 2026 (Beitrag inkl. 19 % Versicherungsteuer, keine Umsatzsteuer)", satz: 0, betrag: 61240 }] }),
  einfach({ id: "b28", datum: "2026-09-10", lieferant: "Akademie für Lebensmittelhygiene Sachsen", anschrift: "Prager Straße 26\n04103 Leipzig", nummer: "ALS-26-0931", kategorie: "fortbildung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-10", datei: "pdf", worum: "Hygieneschulung HACCP (19 %)",
    pos: [{ text: "Tagesseminar „HACCP in der Gastronomie“, Teilnehmerin Jana Weber", satz: 19, betrag: 10000 }] }),
  einfach({ id: "b29", datum: "2026-07-22", lieferant: "Kältetechnik Möckern GmbH", anschrift: "Max-Liebermann-Straße 80\n04159 Leipzig", nummer: "KM-1987", kategorie: "sonstiges", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-07-30", datei: "pdf", worum: "Reparatur Kuchenvitrine (19 %)",
    pos: [{ text: "Austausch Lüftermotor Kuchenvitrine, Material", satz: 19, betrag: 14500 }, { text: "Arbeitszeit Kältetechniker 2 Std. × 72,50 €", satz: 19, betrag: 14500 }] }),
  einfach({ id: "b30", datum: "2026-03-30", lieferant: "SchädlingsStopp Leipzig", anschrift: "Theodor-Heuss-Straße 14\n04318 Leipzig", nummer: "SST-2026-112", kategorie: "fremdleistungen", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-04-07", datei: "pdf", worum: "Schädlingsmonitoring Jahrespauschale (19 %)",
    pos: [{ text: "Schädlingsmonitoring 2026 (4 Kontrollen, Köderstationen), Jahrespauschale", satz: 19, betrag: 34000 }] }),
  einfach({ id: "b31", datum: "2026-08-12", lieferant: "Elektro Wendt GmbH", anschrift: "Dieskaustraße 150\n04249 Leipzig", nummer: "EW-26-0412", kategorie: "fremdleistungen", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-08-20", datei: "pdf", worum: "DGUV-V3-Prüfung der Elektrogeräte (19 %), passt zum Prüfprotokoll",
    pos: [{ text: "Prüfung ortsveränderlicher elektrischer Geräte nach DGUV V3 (12 Geräte)", satz: 19, betrag: 16000 }] }),
  einfach({ id: "b32", datum: "2026-11-05", lieferant: "Buchhaus am Markt", anschrift: "Markt 10\n04109 Leipzig", nummer: "Bon 11-0518", kategorie: "fortbildung", art: "brutto", vorsteuer: true, zahlung: "privat", bezahlt: null, datei: "pdf", worum: "Fachbuch, privat bezahlt (Einlage), 7 %",
    pos: [{ text: "Fachbuch „Allergenkennzeichnung in der Gastronomie“", satz: 7, betrag: 2990 }] }),
];

// ---------------------------------------------------------------- Kasse (elektronische Registrierkasse mit TSE)

/** Z-Bon-Summen je Monat (brutto je Satz) – Mai wird aus den Tageswerten berechnet */
const KASSE_BRUTTO: Record<string, { b7: number; b19: number }> = {
  "01": { b7: 624901, b19: 584599 }, "02": { b7: 600366, b19: 559931 }, "03": { b7: 686994, b19: 641184 },
  "04": { b7: 760321, b19: 715476 }, "06": { b7: 879069, b19: 848494 },
  "07": { b7: 913791, b19: 880921 }, "08": { b7: 866957, b19: 839045 }, "09": { b7: 798295, b19: 761065 },
  "10": { b7: 746881, b19: 702647 }, "11": { b7: 664031, b19: 622418 }, "12": { b7: 817512, b19: 783032 },
};

export interface KassenTag { datum: string; zbon: number; b7: number; b19: number; bar: number }
/** Mai 2026: geöffnet Di–So (montags Ruhetag), Tageswerte deterministisch */
export const KASSE_MAI: KassenTag[] = (() => {
  const r = zufall(20260501);
  const tage: KassenTag[] = [];
  let zbon = 1204;
  for (let t = 1; t <= 31; t++) {
    const iso = `2026-05-${String(t).padStart(2, "0")}`;
    const wt = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 So … 6 Sa
    if (wt === 1) continue;
    const feiertag = iso === "2026-05-01" || iso === "2026-05-14";
    const basis = wt === 0 ? 86000 : wt === 6 ? 78000 : feiertag ? 82000 : 52000;
    const brutto = Math.round(basis * (0.85 + 0.3 * r()));
    const b7 = Math.round(brutto * (0.5 + 0.06 * r()));
    const b19 = brutto - b7;
    const bar = Math.round(brutto * (0.38 + 0.1 * r()));
    tage.push({ datum: iso, zbon: zbon++, b7, b19, bar });
  }
  return tage;
})();
KASSE_BRUTTO["05"] = { b7: sum(KASSE_MAI.map((t) => t.b7)), b19: sum(KASSE_MAI.map((t) => t.b19)) };

/** Netto und USt aus dem Bruttobetrag (Z-Bon weist je Satz aus) */
const ausBruttoUnabh = (brutto: number, satz: number) => {
  const netto = rund((brutto * 100) / (100 + satz));
  return { netto, ust: brutto - netto };
};
export const KASSE_MONATE = Object.keys(KASSE_BRUTTO)
  .sort()
  .map((m) => {
    const k = KASSE_BRUTTO[m]!;
    const a7 = ausBruttoUnabh(k.b7, 7);
    const a19 = ausBruttoUnabh(k.b19, 19);
    return { monat: `2026-${m}`, b7: k.b7, b19: k.b19, n7: a7.netto, u7: a7.ust, n19: a19.netto, u19: a19.ust };
  });

/** Kassenbuch der Bargeldkasse für Mai 2026 (Bareinnahmen lt. Z-Bon, Barausgaben, Geldtransit zur Bank) */
export const KASSENBUCH_ANFANG = 41230;
export interface KbEintrag { datum: string; beleg: string; text: string; einnahme: number; ausgabe: number }
export const KASSENBUCH_MAI: KbEintrag[] = (() => {
  const e: KbEintrag[] = [];
  let bestand = KASSENBUCH_ANFANG;
  let transit = 1;
  const barBelege = BELEGE.filter((b) => b.zahlung === "bar" && b.datum.startsWith("2026-05"));
  for (const t of KASSE_MAI) {
    // dienstags vor Öffnung: Bargeld bis auf 400 € Wechselgeld zur Bank bringen
    const wt = new Date(`${t.datum}T12:00:00Z`).getUTCDay();
    if (wt === 2 && bestand > 40000) {
      const betrag = Math.floor((bestand - 40000) / 1000) * 1000;
      e.push({ datum: t.datum, beleg: `GT-05-${String(transit++).padStart(2, "0")}`, text: "Geldtransit: Einzahlung Sparkasse (Tagesumsätze)", einnahme: 0, ausgabe: betrag });
      bestand -= betrag;
    }
    for (const b of barBelege.filter((x) => x.datum === t.datum)) {
      const brutto = sum(b.saetze.map((s) => s.betrag));
      e.push({ datum: t.datum, beleg: b.nummer ?? "ohne Nr.", text: `${b.lieferant}: ${b.pos.map((p) => p.text.split(" (")[0]).join(", ")}`.slice(0, 90), einnahme: 0, ausgabe: brutto });
      bestand -= brutto;
    }
    e.push({ datum: t.datum, beleg: `Z ${t.zbon}`, text: `Tageseinnahmen bar lt. Z-Bon Nr. ${t.zbon} (Kassensystem mit TSE)`, einnahme: t.bar, ausgabe: 0 });
    bestand += t.bar;
    if (t.datum === "2026-05-30") {
      e.push({ datum: t.datum, beleg: "PE-05", text: "Privatentnahme Inhaberin (Eigenbeleg)", einnahme: 0, ausgabe: 20000 });
      bestand -= 20000;
    }
  }
  return e;
})();
export const kassenbuchEnde = () => KASSENBUCH_ANFANG + sum(KASSENBUCH_MAI.map((x) => x.einnahme - x.ausgabe));

// ---------------------------------------------------------------- weitere Annahmen

/** Umsatzsteuer-Zahllast Q4/2025, gezahlt am 12.01.2026 (Annahme, aus dem Vorjahr) */
export const UST_Q4_2025 = { betrag: 298640, gezahlt: "2026-01-12" };
/** Zahltag der Vorauszahlung je Quartal (10. des Folgemonats bzw. nächster Werktag) */
export const UST_ZAHLTAGE: Record<string, string> = { "2026-Q1": "2026-04-10", "2026-Q2": "2026-07-10", "2026-Q3": "2026-10-12", "2026-Q4": "2027-01-11" };
/** Abschreibung Haubenspülmaschine: linear 5 Jahre, zeitanteilig ab März (10/12) */
export const AFA = { beleg: "b20", jahre: 5, monate: 10 };

// ---------------------------------------------------------------- unabhängige Rechnung

export interface RechnungsSumme { netto: number; ust: number; brutto: number; gruppen: Record<string, { netto: number; ust: number }> }
/** Summen einer Rechnung: Zeile = Menge × Preis (auf Cent gerundet), USt je Satz aus der Netto-Summe des Satzes */
export function rechnungsSumme(pos: Pos[]): RechnungsSumme {
  const gruppen: Record<string, { netto: number; ust: number }> = {};
  for (const p of pos) {
    const zeile = rund((Math.round(p.menge * 10000) * p.preis) / 10000);
    gruppen[p.satz] ??= { netto: 0, ust: 0 };
    gruppen[p.satz]!.netto += zeile;
  }
  for (const [satz, g] of Object.entries(gruppen)) g.ust = rund((g.netto * Number(satz)) / 100);
  const netto = sum(Object.values(gruppen).map((g) => g.netto));
  const ust = sum(Object.values(gruppen).map((g) => g.ust));
  return { netto, ust, brutto: netto + ust, gruppen };
}

/** ausgewiesene Steuer eines Belegs (so wie sie auf dem Beleg steht) und daraus Netto/Brutto */
export function belegSumme(b: BelegRoh) {
  let netto = 0;
  let ust = 0;
  const jeSatz: { satz: number; netto: number; ust: number; brutto: number }[] = [];
  for (const s of b.saetze) {
    const n = b.art === "netto" ? s.betrag : ausBruttoUnabh(s.betrag, s.satz).netto;
    const u = b.art === "netto" ? rund((s.betrag * s.satz) / 100) : s.betrag - n;
    netto += n;
    ust += u;
    jeSatz.push({ satz: s.satz, netto: n, ust: u, brutto: n + u });
  }
  return { netto, ust, brutto: netto + ust, vorsteuer: b.vorsteuer ? ust : 0, jeSatz };
}
export const zahltagBeleg = (b: BelegRoh) => b.bezahlt ?? b.datum;

/** Ausgangsrechnungen samt Stornos als Liste von Buchungsvorgängen mit Vorzeichen */
export function vorgaenge() {
  const l: { nummer: string; art: "rechnung" | "storno"; datum: string; leistung: string; bezahlt: string | null; vz: 1 | -1; s: RechnungsSumme; kunde: KundeId; r: Rechnung }[] = [];
  for (const r of RECHNUNGEN) {
    const s = rechnungsSumme(r.pos);
    l.push({ nummer: r.nummer, art: "rechnung", datum: r.datum, leistung: r.leistung ?? r.datum, bezahlt: r.bezahlt, vz: 1, s, kunde: r.kunde, r });
    if (r.storno) l.push({ nummer: r.storno.nummer, art: "storno", datum: r.storno.datum, leistung: r.storno.datum, bezahlt: null, vz: -1, s, kunde: r.kunde, r });
  }
  return l.sort((a, b) => a.nummer.localeCompare(b.nummer));
}

export interface UstQuartal {
  q: string;
  /** nur Ausgangsrechnungen (das, was die App aus Rechnungen übernehmen kann) */
  r19: number; r7: number; r0: number;
  /** Kasse (Z-Bons) netto */
  k19: number; k7: number;
  vorsteuer: number;
  /** Bemessungsgrundlagen gesamt */
  bmg19: number; bmg7: number; frei: number;
  /** exakt mit Cent */
  ust: number; zahllast: number;
  /** wie ELSTER: Bemessungsgrundlagen in vollen Euro (Cent abgeschnitten), Steuer daraus */
  elsterUst: number; elsterZahllast: number;
}

/**
 * USt je Quartal bei Soll-Versteuerung: Rechnungen nach Leistungsdatum, Stornorechnungen im Zeitraum des Stornos
 * (§ 17 UStG), Kassenumsätze im Monat des Z-Bons, Vorsteuer nach Belegdatum mit der ausgewiesenen Steuer.
 *
 * Rechnungskorrektur (Storno + neue Rechnung für DIESELBE Leistung): Die Leistung wird nur einmal versteuert – im
 * Zeitraum der Leistung mit dem ursprünglich berechneten Entgelt; die Änderung (Storno − neue Rechnung) wirkt im
 * Zeitraum der Korrektur (§ 17 Abs. 1 Satz 7 UStG; zu hoch ausgewiesene Steuer schuldet der Unternehmer bis zur
 * Berichtigung, § 14c Abs. 1 UStG). Die neue Rechnung zählt daher im Zeitraum ihres Ausstellungsdatums, nicht noch
 * einmal im Zeitraum der Leistung. Fachlich zu bestätigen – siehe SZENARIO.md.
 */
export function ustQuartale(): UstQuartal[] {
  const v = vorgaenge();
  return [1, 2, 3, 4].map((n) => {
    const q = `2026-Q${n}`;
    const im = v.filter((x) => quartal(x.art === "storno" || x.r.ersetzt ? x.datum : x.leistung) === q);
    const r = (satz: string) => sum(im.map((x) => x.vz * (x.s.gruppen[satz]?.netto ?? 0)));
    const km = KASSE_MONATE.filter((k) => quartal(`${k.monat}-01`) === q);
    const k19 = sum(km.map((k) => k.n19));
    const k7 = sum(km.map((k) => k.n7));
    const vorsteuer = sum(BELEGE.filter((b) => quartal(b.datum) === q).map((b) => belegSumme(b).vorsteuer));
    const bmg19 = r("19") + k19;
    const bmg7 = r("7") + k7;
    const ust = rund((bmg19 * 19) / 100) + rund((bmg7 * 7) / 100);
    const voll = (c: number) => Math.trunc(c / 100) * 100;
    const elsterUst = rund((voll(bmg19) * 19) / 100) + rund((voll(bmg7) * 7) / 100);
    return { q, r19: r("19"), r7: r("7"), r0: r("0"), k19, k7, vorsteuer, bmg19, bmg7, frei: r("0"), ust, zahllast: ust - vorsteuer, elsterUst, elsterZahllast: elsterUst - vorsteuer };
  });
}

/** EÜR 2026 (§ 4 Abs. 3 EStG): Zufluss/Abfluss */
export function euerUnabhaengig() {
  const v = vorgaenge();
  const bezahlt = v.filter((x) => x.bezahlt?.startsWith(`${JAHR}-`));
  const reNetto = sum(bezahlt.map((x) => x.vz * x.s.netto));
  const reUst = sum(bezahlt.map((x) => x.vz * x.s.ust));
  const kasseNetto = sum(KASSE_MONATE.map((k) => k.n7 + k.n19));
  const kasseUst = sum(KASSE_MONATE.map((k) => k.u7 + k.u19));
  const imJahr = BELEGE.filter((b) => zahltagBeleg(b).startsWith(`${JAHR}-`));
  const nachKategorie: Record<string, { betrag: number; anzahl: number }> = {};
  let vorsteuer = 0;
  for (const b of imJahr) {
    const s = belegSumme(b);
    vorsteuer += s.vorsteuer;
    if (b.kategorie === "anlage") continue;
    const betrag = b.vorsteuer ? s.netto : s.brutto;
    nachKategorie[b.kategorie] ??= { betrag: 0, anzahl: 0 };
    nachKategorie[b.kategorie]!.betrag += betrag;
    nachKategorie[b.kategorie]!.anzahl++;
  }
  const anlage = BELEGE.find((b) => b.id === AFA.beleg)!;
  const afa = rund((belegSumme(anlage).netto / AFA.jahre) * (AFA.monate / 12));
  const quartale = ustQuartale();
  const ustGezahlt = UST_Q4_2025.betrag + sum(quartale.filter((q) => UST_ZAHLTAGE[q.q]!.startsWith(`${JAHR}-`)).map((q) => q.elsterZahllast));
  const ausgabenBelege = sum(Object.values(nachKategorie).map((k) => k.betrag));
  const einnahmen = reNetto + reUst + kasseNetto + kasseUst;
  const ausgaben = ausgabenBelege + vorsteuer + ustGezahlt;
  return {
    reNetto, reUst, reAnzahl: bezahlt.length, kasseNetto, kasseUst, nachKategorie, vorsteuer, afa, ustGezahlt, ausgabenBelege,
    einnahmen, ausgaben, ergebnis: einnahmen - ausgaben - afa,
    /** nur, was die App aus Rechnungen und Belegen übernehmen kann (ohne Kasse, USt-Zahlungen, AfA) */
    nurAppDaten: { einnahmen: reNetto + reUst, ausgaben: ausgabenBelege + vorsteuer },
    belegeImJahr: imJahr.length,
  };
}

/** erwartete Summen je Steuersatz über das Jahr (Rechnungen nach Leistung/Storno, Kasse) */
export function jahresSummen() {
  const q = ustQuartale();
  const s = (f: (x: UstQuartal) => number) => sum(q.map(f));
  return { r19: s((x) => x.r19), r7: s((x) => x.r7), r0: s((x) => x.r0), k19: s((x) => x.k19), k7: s((x) => x.k7), vorsteuer: s((x) => x.vorsteuer), ust: s((x) => x.ust), zahllast: s((x) => x.zahllast) };
}
