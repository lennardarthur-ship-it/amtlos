/**
 * Jahres-Szenario „Physiotherapie am Markt – Tom Reiter“ (Leipzig, 2026) – nur die ROHDATEN und eine davon UNABHÄNGIGE
 * Rechnung der erwarteten Kennzahlen. Diese Datei importiert absichtlich nichts aus der App oder aus @amtlos/fachlogik:
 * Prüferinnen und Prüfer sollen die Ausgaben der App (werkzeuge/jahr-szenario-praxis.ts) gegen diese Zahlen halten können.
 *
 * Betrieb: Einzelpraxis für Physiotherapie, freier Beruf (§ 18 Abs. 1 Nr. 1 EStG, „ähnlicher Beruf“), kein Gewerbe,
 * Heilbehandlungen steuerfrei nach § 4 Nr. 14 Buchst. a UStG (Kassenpatienten über ein Abrechnungszentrum, Privatpatienten,
 * Berufsgenossenschaft), daneben steuerpflichtige Umsätze zu 19 % (Wellness-/Präventionsmassagen ohne Verordnung,
 * Verkauf von Therabändern und Tapes, betriebliche Gesundheitstage und Rückenkurse für Firmen). Keine Kleinunternehmer-
 * regelung (steuerpflichtiger Gesamtumsatz 2025 über 25.000 €), Ist-Versteuerung (§ 20 UStG), vierteljährliche
 * Voranmeldung, EÜR nach § 4 Abs. 3 EStG. Teilweiser Vorsteuerabzug nach § 15 Abs. 2 und 4 UStG. Zwei Beschäftigte
 * (Physiotherapeutin Teilzeit, Rezeption Minijob). Alle Namen, Anschriften, Steuer- und Kontonummern sind erfunden
 * (Domains auf .example). Beträge in Cent.
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
const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);

/** deutsche IBAN mit gültiger Prüfziffer aus BLZ und Kontonummer (erfundenes Konto) */
function ibanDe(blz: string, konto: string): string {
  const bban = blz + konto.padStart(10, "0");
  let rest = 0;
  for (const z of `${bban}131400`) rest = (rest * 10 + Number(z)) % 97;
  return `DE${String(98 - rest).padStart(2, "0")}${bban}`;
}

// ---------------------------------------------------------------- Betrieb

export const JAHR = "2026";
export const QUARTALE = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"] as const;
export const BETRIEB = {
  name: "Physiotherapie am Markt – Tom Reiter",
  strasse: "Markt 11",
  plz: "04109",
  ort: "Leipzig",
  bundesland: "Sachsen",
  verantwortlich: "Tom Reiter",
  telefon: "0341 23187640",
  email: "praxis@physio-am-markt.example",
  website: "www.physio-am-markt.example",
  steuernummer: "231/245/07813",
  /** beantragt für den Bezug von Software aus Irland (§ 13b) und für Firmenkunden */
  ust_idnr: "DE318426507",
  iban: ibanDe("86055592", "1100427815"),
  bank: "Sparkasse Leipzig",
  bic: "WELADE8LXXX",
  rechtsform: "Einzelunternehmen",
  versteuerung: "ist",
  farbe: "#2E6F73",
};
/** IBAN des Medizintechnik-Händlers in seiner E-Rechnung (erfunden, mit gültiger Prüfziffer) */
export const LIEFERANT_IBAN = ibanDe("85050300", "221045678");
export const INHABER = { name: "Tom Reiter", berufsbezeichnung: "Physiotherapeut", erlaubnis: "Erlaubnis zum Führen der Berufsbezeichnung „Physiotherapeut“ nach § 1 MPhG, erteilt 2012 (Sachsen)" };
export const GRUENDUNG = "2021-07-01";
/**
 * Umsätze 2025 (vereinnahmt, netto): gesamt 193.000 €, davon steuerpflichtig 25.100 €. Für die Kleinunternehmergrenze
 * zählen die steuerfreien Heilbehandlungen nach § 4 Nr. 14 UStG nicht zum Gesamtumsatz (§ 19 UStG, fachlich bestätigen) –
 * 25.100 € > 25.000 €, also Regelbesteuerung.
 */
export const UMSATZ_VORJAHR = 193000;
export const UMSATZ_VORJAHR_STEUERPFLICHTIG = 25100;
export const UMSATZ_PROGNOSE = 205000;
/** USt-Zahllast 2025 (für den Voranmeldungszeitraum: über 2.000 € und bis 9.000 € → vierteljährlich, § 18 Abs. 2 UStG) */
export const ZAHLLAST_VORJAHR = 3650;
/**
 * Vorläufiger Aufteilungsschlüssel für die Vorsteuer aus gemischt genutzten Eingangsleistungen (§ 15 Abs. 4 UStG):
 * Anteil der steuerpflichtigen an allen Umsätzen des Vorjahres, 25.100 / 193.000 = 13,0 %. Endgültig nach den Umsätzen
 * 2026 in der Jahreserklärung (Umsatzschlüssel – nur zulässig, wenn keine wirtschaftlich zutreffendere Zurechnung möglich ist).
 */
export const QUOTE_VORLAEUFIG = 13;

export type Ort = "privat" | "b2b" | "traeger";
export const KUNDEN = {
  k1: { name: "Leipziger Stadtwerkstatt Software GmbH", anschrift: "Karl-Liebknecht-Straße 112\n04275 Leipzig", email: "rechnung@stadtwerkstatt-software.example" },
  k2: { name: "Mitteldeutsches Druckhaus AG", anschrift: "Torgauer Straße 231\n04347 Leipzig", email: "kreditoren@md-druckhaus.example" },
  k3: { name: "Sachsenlogistik Paketdienst GmbH", anschrift: "Am Alten Flughafen 5\n04356 Leipzig", email: "eingangsrechnungen@sachsenlogistik.example" },
  /** Unfallversicherungsträger (erfunden): Heilbehandlung nach einem Arbeitsunfall, direkt abgerechnet, steuerfrei */
  k4: { name: "Unfallversicherung Mitteldeutsche Wirtschaft, Bezirksverwaltung Leipzig", anschrift: "Richard-Wagner-Straße 9\n04109 Leipzig", email: "reha-leipzig@uv-mitteldeutsche-wirtschaft.example" },
  p1: { name: "Dr. Johanna Krüger", anschrift: "Funkenburgstraße 21\n04105 Leipzig", anrede: "Sehr geehrte Frau Dr. Krüger" },
  p2: { name: "Matthias Vogel", anschrift: "Kochstraße 44\n04275 Leipzig", anrede: "Sehr geehrter Herr Vogel" },
  p3: { name: "Lea Wagner", anschrift: "Gohliser Straße 9\n04155 Leipzig", anrede: "Sehr geehrte Frau Wagner" },
  p4: { name: "Petra Neumann", anschrift: "Karl-Heine-Straße 77\n04229 Leipzig", anrede: "Sehr geehrte Frau Neumann" },
  p5: { name: "Ralf Köhler", anschrift: "Eisenbahnstraße 120\n04315 Leipzig", anrede: "Sehr geehrter Herr Köhler" },
  p6: { name: "Jonas Becker", anschrift: "Holbeinstraße 30\n04229 Leipzig", anrede: "Sehr geehrter Herr Becker" },
  p7: { name: "Ingrid Hoffmann", anschrift: "Zschochersche Straße 15\n04229 Leipzig", anrede: "Sehr geehrte Frau Hoffmann" },
  p8: { name: "Paul Schreiber", anschrift: "Prager Straße 200\n04299 Leipzig", anrede: "Sehr geehrter Herr Schreiber" },
  p9: { name: "Sabine Lorenz", anschrift: "Delitzscher Straße 68\n04129 Leipzig", anrede: "Sehr geehrte Frau Lorenz" },
} as const;
export type KundeId = keyof typeof KUNDEN;
export const KUNDE_ART: Record<KundeId, Ort> = { k1: "b2b", k2: "b2b", k3: "b2b", k4: "traeger", p1: "privat", p2: "privat", p3: "privat", p4: "privat", p5: "privat", p6: "privat", p7: "privat", p8: "privat", p9: "privat" };

// ---------------------------------------------------------------- Ausgangsrechnungen

export interface Pos { bez: string; menge: number; einheit: string; preis: number; satz: 19 | 0 }
export interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  /** Leistungsdatum (ISO); null = wie Rechnungsdatum */
  leistung: string | null;
  /** Behandlungszeitraum als Text (Serie von Behandlungen) */
  leistungText?: string;
  ziel: "7" | "14" | "30" | "sofort";
  kunde: KundeId;
  pos: Pos[];
  hinweis: string;
  bezahlt: string | null;
  storno?: { datum: string; nummer: string; id: string; grund: string };
  worum: string;
}

/** Text auf der Rechnung bei steuerfreien Positionen (Feld „Hinweis auf die Steuerbefreiung“) */
export const BEFREIUNG = "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG.";

// Preisliste der Praxis (Privatpatienten, steuerfrei) – eigene Preise, angelehnt an die üblichen Heilmittelpositionen
const KG = { bez: "Krankengymnastik (KG), Einzelbehandlung", einheit: "Behandlung", preis: 3800, satz: 0 as const };
const MT = { bez: "Manuelle Therapie (MT)", einheit: "Behandlung", preis: 4500, satz: 0 as const };
const MLD = { bez: "Manuelle Lymphdrainage (MLD 45 Min.)", einheit: "Behandlung", preis: 5200, satz: 0 as const };
const FANGO = { bez: "Wärmetherapie mit Fango (ergänzendes Heilmittel)", einheit: "Behandlung", preis: 1600, satz: 0 as const };
const HAUSBESUCH = { bez: "Hausbesuch (Wegepauschale)", einheit: "Besuch", preis: 2200, satz: 0 as const };
const KGG = { bez: "Gerätegestützte Krankengymnastik (KG-Gerät)", einheit: "Behandlung", preis: 5500, satz: 0 as const };
const ELEKTRO = { bez: "Elektrotherapie (ergänzendes Heilmittel)", einheit: "Behandlung", preis: 1200, satz: 0 as const };
// Leistungen zu 19 % (Bruttopreise der Preisliste: 69,00 € / 40,00 € / 590,00 € / 14,90 € / 9,90 € → netto eingegeben)
const WELLNESS = { bez: "Wellness-Massage 60 Min. (ohne ärztliche Verordnung)", einheit: "Behandlung", preis: 5798, satz: 19 as const };
const PRAEVENTION = { bez: "Präventive Rückenmassage 30 Min. (ohne ärztliche Verordnung)", einheit: "Behandlung", preis: 3361, satz: 19 as const };
const ZEHNER = { bez: "10er-Karte Wellness-Massage 60 Min.", einheit: "Karte", preis: 49580, satz: 19 as const };
const THERABAND = { bez: "Theraband 2,5 m, mittel (Verkauf)", einheit: "Stück", preis: 1252, satz: 19 as const };
const TAPE = { bez: "Kinesio-Tape 5 m (Verkauf)", einheit: "Rolle", preis: 832, satz: 19 as const };
// Firmen (19 %)
const TAG = { bez: "Betrieblicher Gesundheitstag: Rückenscreening und Kurzmassagen am Arbeitsplatz (Tagessatz)", einheit: "Tag", preis: 185000, satz: 19 as const };
const VORTRAG = { bez: "Vortrag „Ergonomie am Arbeitsplatz“ (60 Min.)", einheit: "Pauschale", preis: 38000, satz: 19 as const };
const ANFAHRT = { bez: "Anfahrt und Aufbau mobile Behandlungsliegen", einheit: "Pauschale", preis: 4500, satz: 19 as const };
const RUECKENFIT = { bez: "Kurs „Rückenfit im Betrieb“, 60 Min. (je Termin)", einheit: "Termin", preis: 22000, satz: 19 as const };
// Berufsgenossenschaft (eigene Vergütungsvereinbarung, steuerfrei)
const BG_KG = { bez: "Krankengymnastik nach Arbeitsunfall (Vergütung laut Vereinbarung)", einheit: "Behandlung", preis: 3240, satz: 0 as const };
const BG_WAERME = { bez: "Wärmetherapie (Heißluft)", einheit: "Behandlung", preis: 980, satz: 0 as const };
const BG_BERICHT = { bez: "Therapiebericht an den Durchgangsarzt", einheit: "Bericht", preis: 1850, satz: 0 as const };

const p = (x: Omit<Pos, "menge">, menge: number): Pos => ({ ...x, menge });
const VO = (datum: string, arzt: string) => `Heilmittelverordnung vom ${datum} (${arzt}). Bitte reichen Sie diese Rechnung mit der Kopie der Verordnung bei Ihrer Krankenversicherung bzw. Beihilfestelle ein.`;
const DANKE = "Vielen Dank für Ihr Vertrauen.";

export const RECHNUNGEN: Rechnung[] = [
  { id: "r01", nummer: "2026-001", datum: "2026-01-16", leistung: null, leistungText: "05.01.2026 – 15.01.2026", ziel: "14", kunde: "p1", bezahlt: "2026-01-28",
    hinweis: `${VO("02.01.2026", "Dr. med. Frank Albrecht, Orthopädie")}\n${DANKE}`, worum: "Privatpatientin (Beihilfe): 6 × MT + 6 × Fango, steuerfrei; Behandlungszeitraum als Text.",
    pos: [p(MT, 6), p(FANGO, 6)] },
  { id: "r02", nummer: "2026-002", datum: "2026-01-30", leistung: "2026-01-28", ziel: "14", kunde: "k1", bezahlt: "2026-02-12",
    hinweis: "Vielen Dank für die Zusammenarbeit.", worum: "Firma: Gesundheitstag mit Vortrag und Anfahrt (19 %), XRechnung.",
    pos: [p(TAG, 1), p(VORTRAG, 1), p(ANFAHRT, 1)] },
  { id: "r03", nummer: "2026-003", datum: "2026-02-13", leistung: null, leistungText: "19.01.2026 – 12.02.2026", ziel: "14", kunde: "p2", bezahlt: "2026-02-27",
    hinweis: `${VO("15.01.2026", "Dr. med. Susanne Hartig, Allgemeinmedizin")}\n${DANKE}`, worum: "Privatpatient: 10 × KG, steuerfrei.",
    pos: [p(KG, 10)] },
  { id: "r04", nummer: "2026-004", datum: "2026-02-27", leistung: "2026-02-26", ziel: "sofort", kunde: "p3", bezahlt: "2026-02-27",
    hinweis: DANKE, worum: "Selbstzahlerin: 2 Wellness-Massagen ohne Verordnung (19 %) – Bruttopreis 69,00 € je Massage, netto 57,98 € eingegeben → Rechnungsbetrag 137,99 € statt 138,00 €.",
    pos: [p(WELLNESS, 2)] },
  { id: "r05", nummer: "2026-005", datum: "2026-03-13", leistung: null, leistungText: "16.02.2026 – 12.03.2026", ziel: "14", kunde: "p4", bezahlt: "2026-03-20",
    hinweis: `${VO("10.02.2026", "Dr. med. Frank Albrecht, Orthopädie")}\n${DANKE}`, worum: "GEMISCHTE Rechnung: 6 × KG steuerfrei + 2 Therabänder und 1 Kinesio-Tape zum Mitnehmen (19 %).",
    pos: [p(KG, 6), p(THERABAND, 2), p(TAPE, 1)] },
  { id: "r06", nummer: "2026-006", datum: "2026-03-27", leistung: "2026-03-25", ziel: "14", kunde: "k3", bezahlt: "2026-04-08",
    hinweis: "Vielen Dank für die Zusammenarbeit.", worum: "Firma: Rückenkurs 8 Termine (19 %), bezahlt erst im April → bei Ist-Versteuerung Q2.",
    pos: [p(RUECKENFIT, 8)] },
  { id: "r07", nummer: "2026-007", datum: "2026-04-10", leistung: null, leistungText: "09.03.2026 – 09.04.2026", ziel: "14", kunde: "p5", bezahlt: "2026-04-24",
    hinweis: `${VO("04.03.2026", "Dr. med. Ines Brandt, Gefäßchirurgie")}\n${DANKE}`, worum: "Privatpatient: 10 × MLD, steuerfrei.",
    pos: [p(MLD, 10)] },
  { id: "r08", nummer: "2026-008", datum: "2026-04-24", leistung: "2026-04-23", ziel: "30", kunde: "k4", bezahlt: "2026-05-20",
    hinweis: "Aktenzeichen des Unfallversicherungsträgers: 26/04117-L, Unfall vom 12.03.2026, Verordnung des Durchgangsarztes vom 20.03.2026.", worum: "Berufsgenossenschaft (Unfallversicherungsträger, mit E-Mail): Heilbehandlung nach Arbeitsunfall, steuerfrei – XRechnung mit Kategorie E.",
    pos: [p(BG_KG, 8), p(BG_WAERME, 8), p(BG_BERICHT, 1)] },
  { id: "r09", nummer: "2026-009", datum: "2026-05-08", leistung: null, ziel: "sofort", kunde: "p6", bezahlt: "2026-05-08",
    hinweis: "Die Karte ist ab Ausstellung 12 Monate gültig.", worum: "Selbstzahler: 10er-Karte Wellness (19 %), sofort bezahlt (Anzahlung für künftige Leistungen – Ist-Versteuerung: Steuer mit Zahlung).",
    pos: [p(ZEHNER, 1)] },
  { id: "r10", nummer: "2026-010", datum: "2026-05-22", leistung: "2026-05-20", ziel: "30", kunde: "k2", bezahlt: null,
    storno: { datum: "2026-05-29", nummer: "2026-011", id: "r11", grund: "3 statt der durchgeführten 2 Gesundheitstage berechnet – Storno und neue Rechnung 2026-012" },
    hinweis: "Vielen Dank für die Zusammenarbeit.", worum: "Firma: 3 Gesundheitstage statt 2 berechnet → storniert (2026-011) und neu gestellt (2026-012).",
    pos: [p(TAG, 3), p(VORTRAG, 1), p(ANFAHRT, 3)] },
  { id: "r12", nummer: "2026-012", datum: "2026-05-29", leistung: "2026-05-20", ziel: "30", kunde: "k2", bezahlt: "2026-06-15",
    hinweis: "Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-010 vom 22.05.2026.\nVielen Dank für die Zusammenarbeit.", worum: "Korrigierte Rechnung: 2 Gesundheitstage (19.05. und 20.05.).",
    pos: [p(TAG, 2), p(VORTRAG, 1), p(ANFAHRT, 2)] },
  { id: "r13", nummer: "2026-013", datum: "2026-06-19", leistung: null, leistungText: "21.05.2026 – 18.06.2026", ziel: "14", kunde: "p7", bezahlt: "2026-07-03",
    hinweis: `${VO("18.05.2026", "Dr. med. Susanne Hartig, Allgemeinmedizin")} Hausbesuch ärztlich verordnet.\n${DANKE}`, worum: "Privatpatientin: 8 × KG als Hausbesuch, steuerfrei; bezahlt im Juli (Q3).",
    pos: [p(KG, 8), p(HAUSBESUCH, 8)] },
  { id: "r14", nummer: "2026-014", datum: "2026-07-17", leistung: null, leistungText: "15.06.2026 – 16.07.2026", ziel: "14", kunde: "p8", bezahlt: "2026-07-31",
    hinweis: `${VO("10.06.2026", "Dr. med. Frank Albrecht, Orthopädie")}\n${DANKE}`, worum: "Privatpatient: 6 × KG-Gerät, steuerfrei.",
    pos: [p(KGG, 6)] },
  { id: "r15", nummer: "2026-015", datum: "2026-08-14", leistung: "2026-08-12", ziel: "14", kunde: "k1", bezahlt: "2026-09-01",
    hinweis: "Vielen Dank für die Zusammenarbeit.", worum: "Firma: Rückenkurs 8 Termine + Gesundheitstag (19 %).",
    pos: [p(RUECKENFIT, 8), p(TAG, 1), p(ANFAHRT, 1)] },
  { id: "r16", nummer: "2026-016", datum: "2026-09-11", leistung: "2026-09-11", ziel: "sofort", kunde: "p9", bezahlt: "2026-09-11",
    hinweis: DANKE, worum: "Selbstzahlerin: 3 präventive Rückenmassagen ohne Verordnung + 1 Theraband (19 %).",
    pos: [p(PRAEVENTION, 3), p(THERABAND, 1)] },
  { id: "r17", nummer: "2026-017", datum: "2026-10-09", leistung: null, leistungText: "07.09.2026 – 08.10.2026", ziel: "14", kunde: "p1", bezahlt: "2026-10-23",
    hinweis: `${VO("03.09.2026", "Dr. med. Frank Albrecht, Orthopädie")}\n${DANKE}`, worum: "Privatpatientin: 6 × MT + 6 × Elektrotherapie, steuerfrei.",
    pos: [p(MT, 6), p(ELEKTRO, 6)] },
  { id: "r18", nummer: "2026-018", datum: "2026-10-30", leistung: "2026-10-28", ziel: "14", kunde: "k3", bezahlt: "2026-11-16",
    hinweis: "Vielen Dank für die Zusammenarbeit.", worum: "Firma: Gesundheitstag mit Vortrag (19 %).",
    pos: [p(TAG, 1), p(VORTRAG, 1), p(ANFAHRT, 1)] },
  { id: "r19", nummer: "2026-019", datum: "2026-11-20", leistung: "2026-11-18", ziel: "14", kunde: "k2", bezahlt: "2026-12-10",
    hinweis: "Vielen Dank für die Zusammenarbeit.", worum: "Firma: Rückenkurs 8 Termine (19 %).",
    pos: [p(RUECKENFIT, 8)] },
  { id: "r20", nummer: "2026-020", datum: "2026-12-11", leistung: null, leistungText: "09.11.2026 – 10.12.2026", ziel: "14", kunde: "p2", bezahlt: null,
    hinweis: `${VO("05.11.2026", "Dr. med. Susanne Hartig, Allgemeinmedizin")}\n${DANKE}`, worum: "Privatpatient: 6 × MT, steuerfrei – zum Jahresende UNBEZAHLT (Zahlung 08.01.2027).",
    pos: [p(MT, 6)] },
  { id: "r21", nummer: "2026-021", datum: "2026-12-18", leistung: "2026-12-16", ziel: "30", kunde: "k1", bezahlt: null,
    hinweis: "Vielen Dank für die Zusammenarbeit.", worum: "Firma: Gesundheitstag Dezember (19 %) – zum Jahresende UNBEZAHLT (Ist: nicht in Q4).",
    pos: [p(TAG, 1), p(ANFAHRT, 1)] },
];

// ---------------------------------------------------------------- Einnahmen ohne Rechnung in der App

/**
 * Kassenpatienten: Die Praxis rechnet über das Abrechnungszentrum ab (§ 302 SGB V); es zahlt monatlich gesammelt aus und
 * verrechnet seine Gebühr (2,4 % zzgl. 19 % USt). Einnahme ist der volle Kassenanteil (brutto vor Gebühr), Zufluss am
 * Auszahlungstag. Rechnungen an einzelne Kassen erzeugt das Abrechnungszentrum, nicht die App.
 */
export const GKV = [
  { monat: "Dezember 2025", zufluss: "2026-01-28", betrag: 1184000 },
  { monat: "Januar 2026", zufluss: "2026-02-26", betrag: 1261000 },
  { monat: "Februar 2026", zufluss: "2026-03-27", betrag: 1239500 },
  { monat: "März 2026", zufluss: "2026-04-28", betrag: 1312000 },
  { monat: "April 2026", zufluss: "2026-05-28", betrag: 1248000 },
  { monat: "Mai 2026", zufluss: "2026-06-26", betrag: 1290500 },
  { monat: "Juni 2026", zufluss: "2026-07-28", betrag: 1326000 },
  { monat: "Juli 2026", zufluss: "2026-08-27", betrag: 1095000 },
  { monat: "August 2026", zufluss: "2026-09-28", betrag: 1173000 },
  { monat: "September 2026", zufluss: "2026-10-28", betrag: 1341500 },
  { monat: "Oktober 2026", zufluss: "2026-11-26", betrag: 1308000 },
  { monat: "November 2026", zufluss: "2026-12-28", betrag: 1277000 },
  { monat: "Dezember 2026", zufluss: "2027-01-28", betrag: 1199000 },
];
export const AZ = { name: "AbrechnungsZentrum Mitteldeutschland GmbH", anschrift: "Bautzner Straße 145\n01099 Dresden", promille: 24 };
export const azGebuehr = (betrag: number) => rund((betrag * AZ.promille) / 1000);

/** Gesetzliche Zuzahlungen der Kassenpatienten (10 % + 10 € je Verordnung), am Empfang per EC-Karte bzw. bar kassiert – je Quartal */
export const ZUZAHLUNGEN: Record<string, number> = { "2026-Q1": 268450, "2026-Q2": 281130, "2026-Q3": 246580, "2026-Q4": 290340 };
/** Verkauf und Wellness-Einzeltermine am Empfang ohne Rechnung (EC-Karte, Quittung), 19 % – BRUTTO je Quartal */
export const EMPFANG_BRUTTO: Record<string, number> = { "2026-Q1": 190400, "2026-Q2": 214200, "2026-Q3": 178500, "2026-Q4": 238000 };
export const empfang = (q: string) => {
  const brutto = EMPFANG_BRUTTO[q] ?? 0;
  const netto = rund((brutto * 100) / 119);
  return { brutto, netto, ust: brutto - netto };
};

// ---------------------------------------------------------------- Belege

/**
 * Zuordnung für den Vorsteuerabzug (§ 15 Abs. 2, 4 UStG): „pflichtig“ = nur für steuerpflichtige Umsätze (voll abziehbar),
 * „frei“ = nur für steuerfreie Heilbehandlungen (nicht abziehbar), „gemischt“ = für beides (abziehbar nach Schlüssel),
 * „keine“ = ohne Umsatzsteuer.
 */
export type Zuordnung = "pflichtig" | "frei" | "gemischt" | "keine";
export interface BelegPos { text: string; menge?: string; satz: 19 | 7 | 0; betrag: number }
export interface BelegRoh {
  id: string;
  datum: string;
  lieferant: string;
  anschrift: string;
  nummer: string | null;
  kategorie: string;
  art: "netto" | "brutto";
  saetze: { satz: 19 | 7 | 0; betrag: number }[];
  zahlung: "bank" | "bar" | "privat";
  bezahlt: string | null;
  zuordnung: Zuordnung;
  notiz?: string;
  datei: "pdf" | "xml";
  pos: BelegPos[];
  /** sonstige Leistung eines im EU-Ausland ansässigen Unternehmers: Tom schuldet die Steuer (§ 13b Abs. 1, 5 UStG) */
  p13b?: boolean;
  worum: string;
}

const posSatz = (pos: BelegPos[], satz: number) => sum(pos.filter((x) => x.satz === satz).map((x) => x.betrag));
const ausPos = (pos: BelegPos[]) => ([19, 7, 0] as const).filter((s) => pos.some((x) => x.satz === s)).map((satz) => ({ satz, betrag: posSatz(pos, satz) }));
const einfach = (o: Omit<BelegRoh, "saetze">): BelegRoh => ({ ...o, saetze: ausPos(o.pos) });

const VERMIETER = { lieferant: "Grundstücksgesellschaft Markt 11 GbR", anschrift: "Katharinenstraße 8\n04109 Leipzig" };
const VERSICHERER = { lieferant: "Mitteldeutsche Heilberufe-Versicherung AG", anschrift: "Augustusplatz 5\n04109 Leipzig" };
const THERAPIEBEDARF = { lieferant: "Therapiebedarf Sachsen GmbH", anschrift: "Messe-Allee 2\n04356 Leipzig" };
const MEDIZINTECHNIK = { lieferant: "Medizintechnik Elbe GmbH", anschrift: "Großenhainer Straße 99\n01127 Dresden" };
const WAESCHE = { lieferant: "Textilservice Pleiße GmbH", anschrift: "Kohlenstraße 44\n04107 Leipzig" };
const TELEFON = { lieferant: "LeipzigNet GmbH", anschrift: "Prager Straße 26\n04103 Leipzig" };
const REINIGUNG = { lieferant: "Glanzwerk Gebäudeservice GmbH", anschrift: "Zwickauer Straße 60\n04103 Leipzig" };
const EIGEN = { lieferant: "Eigenbeleg Tom Reiter (Lohnjournal)", anschrift: "Markt 11\n04109 Leipzig" };

/** Positionen der empfangenen E-Rechnung (XRechnung) des Medizintechnik-Händlers – Grundlage für das XML des Lieferanten */
export const ERECHNUNG_POS = [
  { bez: "Kombinationsgerät Elektro- und Ultraschalltherapie „Sonostim 2“ (Seriennr. SS2-26-01844)", menge: 1, einheit: "Stück", preis: 329000, satz: 19 as const },
  { bez: "Einweisung nach § 10 MPBetreibV und Lieferung", menge: 1, einheit: "Pauschale", preis: 20000, satz: 19 as const },
];

/** Monatliche Gebühren des Abrechnungszentrums eines Quartals (nach Auszahlungstag) */
const azPos = (q: string): BelegPos[] => GKV.filter((g) => quartal(g.zufluss) === q).map((g) => ({ text: `Abrechnungsgebühr 2,4 % auf ${eur(g.betrag)} € (Leistungsmonat ${g.monat}, verrechnet mit der Auszahlung vom ${de(g.zufluss)})`, satz: 19, betrag: azGebuehr(g.betrag) }));
const azLetzte = (q: string) => GKV.filter((g) => quartal(g.zufluss) === q).at(-1)!.zufluss;

// ---------------------------------------------------------------- Personal

export const MITARBEITER = {
  m1: {
    name: "Anna Seidel", anschrift: "Arthur-Hoffmann-Straße 54\n04275 Leipzig", geburtsdatum: "1994-09-21", geburtsort: "Halle (Saale)", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Physiotherapeutin", beginn: "2023-03-01", steuer_id: "53920184736", steuerklasse: "I", sv_nummer: "13210994S017", krankenkasse: "AOK PLUS", iban: ibanDe("86055592", "1100583026"),
  },
  m2: {
    name: "Mareike Franke", anschrift: "Wurzner Straße 101\n04318 Leipzig", geburtsdatum: "2001-04-02", geburtsort: "Leipzig", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Empfang und Terminorganisation (Minijob)", beginn: "2025-09-01", steuer_id: "68150372948", steuerklasse: "I", sv_nummer: "13020401F523", krankenkasse: "Techniker Krankenkasse", iban: ibanDe("86055592", "1100691157"),
  },
};
/** AG-Anteile Sozialversicherung (Annahme 2026: KV 7,3 % + Zusatzbeitrag-Hälfte, PV, RV, AV) und Umlagen U1/U2/Insolvenzgeld (Annahme) */
export const AG_SV = 0.2115;
export const AN_SV = 0.2175;
export const UMLAGEN = 0.0147;
/** Minijob: Pauschalbeiträge KV 13 %, RV 15 %, Pauschsteuer 2 %, Umlagen 1,47 % (Annahme); die Beschäftigte ist von der RV-Pflicht befreit */
export const MINIJOB_PAUSCHAL = 0.3147;
export const MINIJOB_SV_AG = 0.28;
export const MINIJOB_GRENZE_2026 = 60300;
export const MINDESTLOHN_2026 = 1390;
export const LOHN_M1 = 245000;
export const LSTEUER_M1 = 20750;
export const LOHN_M2 = 58000;
export const STUNDENLOHN_M2 = 1450;

export interface LohnMonat { monat: string; zahltag: string; brutto: number; lohnsteuer: number; sv_an: number; sv_ag: number }
export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const letzterWerktag = (m: number) => {
  const d = new Date(Date.UTC(2026, m, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
export const LOHN: Record<"m1" | "m2", LohnMonat[]> = {
  m1: MONATE.map((m, i) => ({ monat: `${m} 2026`, zahltag: letzterWerktag(i + 1), brutto: LOHN_M1, lohnsteuer: LSTEUER_M1, sv_an: rund(LOHN_M1 * AN_SV), sv_ag: rund(LOHN_M1 * AG_SV) })),
  m2: MONATE.map((m, i) => ({ monat: `${m} 2026`, zahltag: letzterWerktag(i + 1), brutto: LOHN_M2, lohnsteuer: 0, sv_an: 0, sv_ag: rund(LOHN_M2 * MINIJOB_SV_AG) })),
};
/** Personalkosten je Monat (Brutto + AG-Anteile + Umlagen bzw. Minijob-Pauschalen) */
export const personalMonat = () => LOHN_M1 + rund(LOHN_M1 * AG_SV) + rund(LOHN_M1 * UMLAGEN) + LOHN_M2 + rund(LOHN_M2 * MINIJOB_PAUSCHAL);
function personalBeleg(id: string, datum: string, halb: 1 | 2): BelegRoh {
  const mon = halb === 1 ? MONATE.slice(0, 6) : MONATE.slice(6);
  return einfach({
    id, datum, ...EIGEN, nummer: `LJ-2026-H${halb}`, kategorie: "personal", art: "brutto", zahlung: "bank", bezahlt: datum, zuordnung: "keine", datei: "pdf",
    notiz: "Bruttolöhne, AG-Anteile und Umlagen laut Lohnjournal des Lohnbüros; Minijob-Pauschalen an die Minijob-Zentrale",
    worum: `Personalkosten ${mon[0]}–${mon[5]} als Eigenbeleg (Lohnjournal, 0 %)`,
    pos: [
      { text: `${mon[0]}–${mon[5]}: ${MITARBEITER.m1.name} – 6 × (Brutto ${eur(LOHN_M1)} € + AG-SV ${eur(rund(LOHN_M1 * AG_SV))} € + Umlagen ${eur(rund(LOHN_M1 * UMLAGEN))} €)`, satz: 0, betrag: 6 * (LOHN_M1 + rund(LOHN_M1 * AG_SV) + rund(LOHN_M1 * UMLAGEN)) },
      { text: `${mon[0]}–${mon[5]}: ${MITARBEITER.m2.name} (Minijob) – 6 × (${eur(LOHN_M2)} € + Pauschalabgaben ${eur(rund(LOHN_M2 * MINIJOB_PAUSCHAL))} €)`, satz: 0, betrag: 6 * (LOHN_M2 + rund(LOHN_M2 * MINIJOB_PAUSCHAL)) },
    ],
  });
}

export const BELEGE: BelegRoh[] = [
  einfach({ id: "b01", datum: "2026-01-02", ...VERMIETER, nummer: "MV-2021-07 / H1-2026", kategorie: "miete", art: "brutto", zahlung: "bank", bezahlt: null, zuordnung: "keine", datei: "pdf", worum: "Praxismiete Januar–Juni (Dauerbeleg, monatlich überwiesen); Vermieter ohne Option zur USt (§ 4 Nr. 12 UStG)",
    pos: [{ text: "Miete Praxisräume Markt 11, 1. OG (142 m²) inkl. Nebenkostenvorauszahlung, Januar–Juni 2026", menge: "6 × 1.680,00 €", satz: 0, betrag: 1008000 }] }),
  einfach({ id: "b02", datum: "2026-07-01", ...VERMIETER, nummer: "MV-2021-07 / H2-2026", kategorie: "miete", art: "brutto", zahlung: "bank", bezahlt: null, zuordnung: "keine", datei: "pdf", worum: "Praxismiete Juli–Dezember (Dauerbeleg)",
    pos: [{ text: "Miete Praxisräume Markt 11, 1. OG (142 m²) inkl. Nebenkostenvorauszahlung, Juli–Dezember 2026", menge: "6 × 1.680,00 €", satz: 0, betrag: 1008000 }] }),
  einfach({ id: "b03", datum: "2026-01-08", lieferant: "CloudOffice Ireland Ltd.", anschrift: "Block C, Grand Canal Dock\nDublin 2, Irland", nummer: "CO-IE-26-0019384", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-01-08", zuordnung: "gemischt", datei: "pdf", p13b: true,
    notiz: "Reverse Charge – Steuerschuldnerschaft des Leistungsempfängers; USt-IdNr. DE318426507 beim Kauf angegeben",
    worum: "Cloud-Telefonanlage und Office-Paket aus IRLAND ohne USt: Tom schuldet 19 % nach § 13b UStG (Kz 46/47), Vorsteuer daraus nur anteilig (Kz 67)",
    pos: [{ text: "Cloud phone system + office suite, annual plan 01/2026–12/2026", menge: "12 × 34,00 €", satz: 0, betrag: 40800 }] }),
  einfach({ id: "b04", datum: "2026-01-15", lieferant: "TheraPlan Software GmbH", anschrift: "Wiener Platz 3\n01069 Dresden", nummer: "TP-2026-10477", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-01-20", zuordnung: "gemischt", datei: "pdf",
    worum: "Praxissoftware (Terminbuch, Patientenakte, Online-Terminbuchung) Jahreslizenz – Auftragsverarbeiter (AVV), gemischt genutzt",
    pos: [{ text: "Praxissoftware „TheraPlan Praxis M“ inkl. Online-Terminbuchung und Patientendokumentation, Jahreslizenz 2026 (2 Therapeutenplätze, 1 Empfang)", satz: 19, betrag: 118800 }] }),
  einfach({ id: "b05", datum: "2026-01-20", ...VERSICHERER, nummer: "HV-88213-2026", kategorie: "versicherungen", art: "brutto", zahlung: "bank", bezahlt: "2026-01-20", zuordnung: "keine", datei: "pdf", worum: "Berufs- und Betriebshaftpflicht (Versicherungsteuer, keine USt)",
    pos: [{ text: "Berufs- und Betriebshaftpflicht für Physiotherapiepraxen 2026 (inkl. Versicherungsteuer, keine Umsatzsteuer)", satz: 0, betrag: 48600 }] }),
  einfach({ id: "b06", datum: "2026-01-20", ...VERSICHERER, nummer: "IV-88214-2026", kategorie: "versicherungen", art: "brutto", zahlung: "bank", bezahlt: "2026-01-20", zuordnung: "keine", datei: "pdf", worum: "Inhalts- und Elektronikversicherung der Praxis",
    pos: [{ text: "Inhalts- und Elektronikversicherung Praxis 2026 (inkl. Versicherungsteuer)", satz: 0, betrag: 21400 }] }),
  einfach({ id: "b07", datum: "2026-01-28", lieferant: "Hygienehandel Mitte GmbH", anschrift: "Industriestraße 85\n04229 Leipzig", nummer: "HM-260128-12", kategorie: "waren", art: "netto", zahlung: "bank", bezahlt: "2026-02-04", zuordnung: "gemischt", datei: "pdf", worum: "Flächen- und Händedesinfektion, Einmalhandschuhe (gemischt)",
    pos: [{ text: "Flächendesinfektion alkoholfrei, 5-l-Kanister (2 Stück)", satz: 19, betrag: 7980 }, { text: "Händedesinfektion 1 l (6 Stück) und Nitril-Einmalhandschuhe (4 Boxen)", satz: 19, betrag: 8850 }] }),
  einfach({ id: "b08", datum: "2026-01-28", lieferant: "Parkhaus Am Brühl", anschrift: "Am Brühl 1\n04109 Leipzig", nummer: "P-0128-4471", kategorie: "reise", art: "brutto", zahlung: "bank", bezahlt: null, zuordnung: "pflichtig", datei: "pdf", worum: "Kleinbetragsrechnung Parken beim Gesundheitstag der Stadtwerkstatt (nur steuerpflichtige Leistung)",
    pos: [{ text: "Parkgebühr Tagesticket", satz: 19, betrag: 1200 }] }),
  einfach({ id: "b09", datum: "2026-02-05", ...MEDIZINTECHNIK, nummer: "MTE-2026-00213", kategorie: "anlage", art: "netto", zahlung: "bank", bezahlt: "2026-02-19", zuordnung: "frei", datei: "xml",
    worum: "ANLAGE als E-RECHNUNG: Elektro-/Ultraschall-Kombigerät 3.490,00 € netto, nur für verordnete Heilbehandlung → keine Vorsteuer, AfA vom Bruttobetrag (§ 9b EStG), Nutzungsdauer 5 Jahre (Annahme), ab Februar",
    pos: ERECHNUNG_POS.map((x) => ({ text: x.bez, menge: `${x.menge} × ${eur(x.preis)} €`, satz: x.satz, betrag: rund(x.menge * x.preis) })) }),
  einfach({ id: "b10", datum: "2026-02-20", ...THERAPIEBEDARF, nummer: "TBS-26-02-0388", kategorie: "waren", art: "netto", zahlung: "bank", bezahlt: "2026-03-02", zuordnung: "pflichtig", datei: "pdf", worum: "Therabänder und Kinesio-Tapes zum Weiterverkauf (nur steuerpflichtige Umsätze → voller Vorsteuerabzug)",
    pos: [{ text: "Theraband 2,5 m, mittel, VE 20 Stück (zum Weiterverkauf)", satz: 19, betrag: 19000 }, { text: "Kinesio-Tape 5 m, VE 30 Rollen (zum Weiterverkauf)", satz: 19, betrag: 17000 }] }),
  einfach({ id: "b11", datum: "2026-03-06", lieferant: "Schreibwaren am Thomaskirchhof", anschrift: "Thomaskirchhof 20\n04109 Leipzig", nummer: "Bon 0306-221", kategorie: "buero", art: "brutto", zahlung: "bar", bezahlt: null, zuordnung: "gemischt", datei: "pdf", worum: "Kleinbetragsrechnung Büromaterial (bar aus der Praxiskasse)",
    pos: [{ text: "Terminkärtchen 500 Stück, Kugelschreiber, Ordner", satz: 19, betrag: 3890 }] }),
  einfach({ id: "b12", datum: "2026-03-14", lieferant: "Akademie für Manuelle Therapie Sachsen GmbH", anschrift: "Bautzner Landstraße 40\n01324 Dresden", nummer: "AMT-26-0314", kategorie: "fortbildung", art: "netto", zahlung: "bank", bezahlt: "2026-03-14", zuordnung: "frei", datei: "pdf", worum: "Fortbildung Manuelle Therapie (Pflichtfortbildung für die Kassenzulassung, nur steuerfreie Heilbehandlung → keine Vorsteuer)",
    pos: [{ text: "Refresher Manuelle Therapie Wirbelsäule, 14./15.03.2026 (20 Fortbildungspunkte)", satz: 19, betrag: 42000 }] }),
  einfach({ id: "b13", datum: "2026-03-25", lieferant: "Steuerkanzlei Sommer & Partner", anschrift: "Gottschedstraße 12\n04109 Leipzig", nummer: "SP-2026-0325", kategorie: "beratung", art: "netto", zahlung: "bank", bezahlt: "2026-04-07", zuordnung: "gemischt", datei: "pdf", worum: "Steuerberatung: EÜR, USt- und ESt-Erklärung 2025 (gemischt)",
    pos: [{ text: "Einnahmen-Überschuss-Rechnung 2025", satz: 19, betrag: 72000 }, { text: "Umsatzsteuer-Jahreserklärung 2025 mit Vorsteueraufteilung", satz: 19, betrag: 28000 }, { text: "Einkommensteuererklärung 2025 (betrieblicher Teil)", satz: 19, betrag: 38000 }] }),
  ...(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"] as const).map((q, i) =>
    einfach({ id: `b${14 + i}`, datum: azLetzte(q), lieferant: AZ.name, anschrift: AZ.anschrift, nummer: `AZM-${q}-77120`, kategorie: "sonstiges", art: "netto", zahlung: "bank", bezahlt: azLetzte(q), zuordnung: "frei", datei: "pdf",
      notiz: "Gebühren mit den Auszahlungen verrechnet (Sammelrechnung zum Quartal)",
      worum: `Abrechnungszentrum ${q}: Gebühren 2,4 % zzgl. 19 % USt, mit den Auszahlungen verrechnet – nur steuerfreie Kassenumsätze → keine Vorsteuer`,
      pos: azPos(q) }),
  ),
  einfach({ id: "b18", datum: "2026-04-22", ...THERAPIEBEDARF, nummer: "TBS-26-04-0712", kategorie: "waren", art: "netto", zahlung: "bank", bezahlt: "2026-05-04", zuordnung: "gemischt", datei: "pdf", worum: "Massageöl, Fangopackungen, Einmalauflagen (verordnete und Wellness-Behandlungen → gemischt)",
    pos: [{ text: "Massageöl neutral 5 l (2 Stück)", satz: 19, betrag: 9640 }, { text: "Fangoparaffin 10 kg und Einmalauflagen 50 m (3 Rollen)", satz: 19, betrag: 19000 }] }),
  einfach({ id: "b19", datum: "2026-05-16", lieferant: "Wellness-Akademie Leipzig UG (haftungsbeschränkt)", anschrift: "Karl-Tauchnitz-Straße 3\n04107 Leipzig", nummer: "WAL-2026-061", kategorie: "fortbildung", art: "netto", zahlung: "bank", bezahlt: "2026-05-16", zuordnung: "pflichtig", datei: "pdf", worum: "Fortbildung Hot-Stone-Massage (nur Wellness, steuerpflichtig → voller Vorsteuerabzug)",
    pos: [{ text: "Tageskurs Hot-Stone-Massage, 16.05.2026", satz: 19, betrag: 29000 }] }),
  einfach({ id: "b20", datum: "2026-05-22", lieferant: "Postfiliale Markt", anschrift: "Grimmaische Straße 2\n04109 Leipzig", nummer: "Q-220526-03", kategorie: "buero", art: "brutto", zahlung: "bar", bezahlt: null, zuordnung: "keine", datei: "pdf", worum: "Briefmarken (steuerfrei, 0 %, bar)",
    pos: [{ text: "Briefmarken 0,95 € (20 Stück), umsatzsteuerfrei", satz: 0, betrag: 1900 }] }),
  einfach({ id: "b21", datum: "2026-05-15", lieferant: "Berufsgenossenschaft für Gesundheitsdienst und Wohlfahrtspflege (BGW)", anschrift: "Pappelallee 33/35/37\n22089 Hamburg", nummer: "BGW-Beitrag 2025", kategorie: "versicherungen", art: "brutto", zahlung: "bank", bezahlt: "2026-05-15", zuordnung: "keine", datei: "pdf", worum: "Beitrag zur gesetzlichen Unfallversicherung 2025 (Umlage, keine USt)",
    pos: [{ text: "Beitragsbescheid 2025: Umlage gesetzliche Unfallversicherung (2 Beschäftigte, Unternehmer freiwillig versichert)", satz: 0, betrag: 41250 }] }),
  einfach({ id: "b22", datum: "2026-06-11", ...THERAPIEBEDARF, nummer: "TBS-26-06-1022", kategorie: "gwg", art: "netto", zahlung: "bank", bezahlt: "2026-06-22", zuordnung: "frei", datei: "pdf", worum: "GWG: Trainingsgeräte für die gerätegestützte KG (nur verordnete Behandlung → keine Vorsteuer); einzeln unter 800 € netto",
    pos: [{ text: "Therapiekreisel Ø 40 cm (2 Stück), Gymnastikbälle 65/75 cm (4 Stück), Kurzhantel-Set 1–5 kg", satz: 19, betrag: 64200 }] }),
  einfach({ id: "b23", datum: "2026-06-30", ...WAESCHE, nummer: "TSP-2026-H1-0811", kategorie: "sonstiges", art: "netto", zahlung: "bank", bezahlt: "2026-07-06", zuordnung: "gemischt", datei: "pdf", worum: "Mietwäsche Handtücher und Liegenbezüge Januar–Juni (gemischt)",
    pos: [{ text: "Mietwäsche Handtücher, Liegenbezüge, Arbeitskleidung, Januar–Juni 2026", menge: "6 × 148,00 €", satz: 19, betrag: 88800 }] }),
  einfach({ id: "b24", datum: "2026-12-31", ...WAESCHE, nummer: "TSP-2026-H2-1602", kategorie: "sonstiges", art: "netto", zahlung: "bank", bezahlt: "2027-01-08", zuordnung: "gemischt", datei: "pdf", worum: "Mietwäsche Juli–Dezember – Rechnung 31.12.2026, Zahlung 08.01.2027 (Vorsteuer Q4/2026, Ausgabe EÜR 2027)",
    pos: [{ text: "Mietwäsche Handtücher, Liegenbezüge, Arbeitskleidung, Juli–Dezember 2026", menge: "6 × 152,00 €", satz: 19, betrag: 91200 }] }),
  einfach({ id: "b25", datum: "2026-06-30", ...TELEFON, nummer: "LN-4410-26-1", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-07-03", zuordnung: "gemischt", datei: "pdf", worum: "Internet und Festnetz Januar–Juni (gemischt)",
    pos: [{ text: "Glasfaser Business 250 inkl. Festnetz, Januar–Juni 2026", menge: "6 × 49,90 €", satz: 19, betrag: 29940 }] }),
  einfach({ id: "b26", datum: "2026-12-31", ...TELEFON, nummer: "LN-4410-26-2", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2027-01-05", zuordnung: "gemischt", datei: "pdf", worum: "Internet und Festnetz Juli–Dezember – Lastschrift 05.01.2027 (Ausgabe EÜR 2027)",
    pos: [{ text: "Glasfaser Business 250 inkl. Festnetz, Juli–Dezember 2026", menge: "6 × 49,90 €", satz: 19, betrag: 29940 }] }),
  einfach({ id: "b27", datum: "2026-06-30", ...REINIGUNG, nummer: "GW-26-0630-17", kategorie: "sonstiges", art: "netto", zahlung: "bank", bezahlt: "2026-07-10", zuordnung: "gemischt", datei: "pdf", worum: "Praxisreinigung Januar–Juni (gemischt)",
    pos: [{ text: "Unterhaltsreinigung Praxis nach Reinigungsplan (3 × wöchentlich), Januar–Juni 2026", menge: "6 × 240,00 €", satz: 19, betrag: 144000 }] }),
  einfach({ id: "b28", datum: "2026-12-31", ...REINIGUNG, nummer: "GW-26-1231-17", kategorie: "sonstiges", art: "netto", zahlung: "bank", bezahlt: "2026-12-31", zuordnung: "gemischt", datei: "pdf", worum: "Praxisreinigung Juli–Dezember (gemischt)",
    pos: [{ text: "Unterhaltsreinigung Praxis nach Reinigungsplan (3 × wöchentlich), Juli–Dezember 2026", menge: "6 × 240,00 €", satz: 19, betrag: 144000 }] }),
  personalBeleg("b29", "2026-06-30", 1),
  personalBeleg("b30", "2026-12-31", 2),
  einfach({ id: "b31", datum: "2026-09-15", ...MEDIZINTECHNIK, nummer: "MTE-2026-01177", kategorie: "sonstiges", art: "netto", zahlung: "bank", bezahlt: "2026-09-29", zuordnung: "frei", datei: "pdf", worum: "Sicherheitstechnische und messtechnische Kontrolle des Kombigeräts (MPBetreibV) – nur Heilbehandlung → keine Vorsteuer",
    pos: [{ text: "Sicherheitstechnische Kontrolle (STK) nach § 11 MPBetreibV und messtechnische Kontrolle Kombigerät „Sonostim 2“, Eintrag ins Medizinproduktebuch", satz: 19, betrag: 16500 }] }),
  einfach({ id: "b32", datum: "2026-09-18", lieferant: "Elektro Lindenau GmbH", anschrift: "Merseburger Straße 140\n04177 Leipzig", nummer: "EL-26-0918", kategorie: "sonstiges", art: "netto", zahlung: "bank", bezahlt: "2026-09-30", zuordnung: "gemischt", datei: "pdf", worum: "Prüfung ortsveränderlicher elektrischer Geräte (DGUV V3), 12 Geräte (gemischt)",
    pos: [{ text: "Wiederholungsprüfung ortsveränderlicher elektrischer Betriebsmittel nach DGUV Vorschrift 3, 12 Geräte, mit Prüfprotokoll", satz: 19, betrag: 18900 }] }),
  einfach({ id: "b33", datum: "2026-02-02", lieferant: "Verband Physiotherapie Mitteldeutschland e. V.", anschrift: "Dittrichring 18\n04109 Leipzig", nummer: "M-2026-1182", kategorie: "versicherungen", art: "brutto", zahlung: "bank", bezahlt: "2026-02-02", zuordnung: "keine", datei: "pdf", worum: "Mitgliedsbeitrag Berufsverband 2026 (keine USt)",
    pos: [{ text: "Mitgliedsbeitrag 2026 (Praxisinhaber)", satz: 0, betrag: 33600 }] }),
  einfach({ id: "b34", datum: "2026-10-06", lieferant: "Druckerei Connewitz", anschrift: "Bornaische Straße 3\n04277 Leipzig", nummer: "DC-26-1006", kategorie: "werbung", art: "netto", zahlung: "bank", bezahlt: "2026-10-15", zuordnung: "gemischt", datei: "pdf", worum: "Praxisflyer und Flyer „Gesundheitstag im Betrieb“ (gemischt)",
    pos: [{ text: "Flyer DIN lang, 4/4-farbig, 2.000 Stück (Praxisinformation und Angebot Gesundheitstage)", satz: 19, betrag: 23600 }] }),
  einfach({ id: "b35", datum: "2026-10-28", lieferant: "Parkhaus Am Brühl", anschrift: "Am Brühl 1\n04109 Leipzig", nummer: "P-1028-9032", kategorie: "reise", art: "brutto", zahlung: "bank", bezahlt: null, zuordnung: "pflichtig", datei: "pdf", worum: "Kleinbetragsrechnung Parken beim Gesundheitstag der Sachsenlogistik (steuerpflichtig)",
    pos: [{ text: "Parkgebühr Tagesticket", satz: 19, betrag: 900 }] }),
];

// ---------------------------------------------------------------- weitere Annahmen

/** AfA Kombigerät: linear 5 Jahre (Annahme), ab Februar (11/12), Bemessung BRUTTO, weil die Vorsteuer nicht abziehbar ist (§ 9b Abs. 1 EStG) */
export const AFA = { beleg: "b09", jahre: 5, monate: 11 };
/** Zahltage der Voranmeldungen (ohne Dauerfristverlängerung, 10. des Folgemonats bzw. nächster Werktag) */
export const VA_ZAHLTAG: Record<string, string> = { "2026-Q1": "2026-04-10", "2026-Q2": "2026-07-10", "2026-Q3": "2026-10-12", "2026-Q4": "2027-01-11" };
/** Zahllast Q4/2025 (Annahme), gezahlt am 12.01.2026 – außerhalb der 10-Tage-Regel des § 11 Abs. 2 Satz 2 EStG, also Ausgabe 2026 */
export const VA_Q4_2025 = { betrag: 90540, zahltag: "2026-01-12" };
export const EST_VORAUSZAHLUNG = 320000;

// ---------------------------------------------------------------- unabhängige Rechnung

export interface RechnungsSumme { netto: number; ust: number; brutto: number; pflichtig: number; frei: number }
/** Zeile = Menge × Preis (auf Cent gerundet); USt je Satz auf die Summe des Satzes gerundet */
export function rechnungsSumme(pos: Pos[]): RechnungsSumme {
  const zeilen = pos.map((x) => ({ satz: x.satz, n: rund((Math.round(x.menge * 10000) * x.preis) / 10000) }));
  const pflichtig = sum(zeilen.filter((z) => z.satz === 19).map((z) => z.n));
  const frei = sum(zeilen.filter((z) => z.satz === 0).map((z) => z.n));
  const ust = rund((pflichtig * 19) / 100);
  return { netto: pflichtig + frei, ust, brutto: pflichtig + frei + ust, pflichtig, frei };
}

export function belegSumme(b: BelegRoh) {
  let netto = 0;
  let ust = 0;
  const jeSatz: { satz: number; netto: number; ust: number; brutto: number }[] = [];
  for (const s of b.saetze) {
    const n = b.art === "netto" ? s.betrag : rund((s.betrag * 100) / (100 + s.satz));
    const u = b.art === "netto" ? rund((s.betrag * s.satz) / 100) : s.betrag - n;
    netto += n;
    ust += u;
    jeSatz.push({ satz: s.satz, netto: n, ust: u, brutto: n + u });
  }
  return { netto, ust, brutto: netto + ust, jeSatz };
}
export const zahltagBeleg = (b: BelegRoh) => b.bezahlt ?? b.datum;

export function vorgaenge() {
  const l: { nummer: string; art: "rechnung" | "storno"; datum: string; bezahlt: string | null; vz: 1 | -1; s: RechnungsSumme; kunde: KundeId; r: Rechnung }[] = [];
  for (const r of RECHNUNGEN) {
    const s = rechnungsSumme(r.pos);
    l.push({ nummer: r.nummer, art: "rechnung", datum: r.datum, bezahlt: r.bezahlt, vz: 1, s, kunde: r.kunde, r });
    // Storno einer nie bezahlten Rechnung: bei Ist-Versteuerung weder Einnahme noch Erstattung
    if (r.storno) l.push({ nummer: r.storno.nummer, art: "storno", datum: r.storno.datum, bezahlt: null, vz: -1, s, kunde: r.kunde, r });
  }
  return l.sort((a, b) => a.nummer.localeCompare(b.nummer));
}
/** Rechnungen mit Zahlungseingang im Zeitraum (Ist) */
const bezahltIn = (von: string, bis: string) => vorgaenge().filter((x) => x.bezahlt && x.bezahlt >= von && x.bezahlt <= bis);
const qGrenzen = (q: string) => {
  const n = Number(q.slice(-1));
  const von = `${q.slice(0, 4)}-${String(n * 3 - 2).padStart(2, "0")}-01`;
  const bis = new Date(Date.UTC(Number(q.slice(0, 4)), n * 3, 0)).toISOString().slice(0, 10);
  return { von, bis };
};

/** Vorsteuer eines Belegs nach Zuordnung und Quote (gemischt: Anteil wird je Quartal auf die Summe gerechnet) */
export const steuer13b = (b: BelegRoh) => (b.p13b ? rund((belegSumme(b).netto * 19) / 100) : 0);

/**
 * Voranmeldung je Quartal (Ist): Umsätze nach Zahlungseingang, Vorsteuer nach Belegdatum, vorläufige Quote 13 %.
 * Zusätzlich, was die App aus Rechnungen und Belegen übernehmen kann (`app…`) und was von Hand dazukommt.
 */
export function ustQuartale(quote = QUOTE_VORLAEUFIG) {
  return QUARTALE.map((q) => {
    const { von, bis } = qGrenzen(q);
    const re = bezahltIn(von, bis);
    const rePflichtig = sum(re.map((x) => x.vz * x.s.pflichtig));
    const reUst = sum(re.map((x) => x.vz * x.s.ust));
    const reFrei = sum(re.map((x) => x.vz * x.s.frei));
    const em = empfang(q);
    const gkv = sum(GKV.filter((g) => quartal(g.zufluss) === q).map((g) => g.betrag));
    const zz = ZUZAHLUNGEN[q] ?? 0;
    const belege = BELEGE.filter((b) => quartal(b.datum) === q);
    const ust = (z: Zuordnung) => sum(belege.filter((b) => b.zuordnung === z).map((b) => belegSumme(b).ust));
    const vstVoll = ust("pflichtig");
    const gemischtGesamt = ust("gemischt");
    const vstAnteil = rund((gemischtGesamt * quote) / 100);
    const bmg13b = sum(belege.filter((b) => b.p13b).map((b) => belegSumme(b).netto));
    const st13b = sum(belege.filter((b) => b.p13b).map(steuer13b));
    // Vorsteuer aus § 13b: nur anteilig, weil die Leistung gemischt genutzt wird
    const vst13b = sum(belege.filter((b) => b.p13b && b.zuordnung === "gemischt").map((b) => rund((steuer13b(b) * quote) / 100))) + sum(belege.filter((b) => b.p13b && b.zuordnung === "pflichtig").map(steuer13b));
    const u19 = rePflichtig + em.netto;
    const ust19 = rund((u19 * 19) / 100);
    const vorsteuer = vstVoll + vstAnteil + vst13b;
    const zahllast = ust19 + st13b - vorsteuer;
    const vstStandard = sum(belege.map((b) => belegSumme(b).ust));
    return {
      q, von, bis, rechnungen: re.length,
      rePflichtig, reUst, reFrei, empfang: em, gkv, zuzahlungen: zz,
      /** Kz 81 Bemessungsgrundlage 19 % */ u19,
      /** Steuer auf Kz 81 (ELSTER rechnet sie aus der Bemessungsgrundlage) */ ust19,
      /** Summe der Steuer laut Rechnungen + Empfang (zum Vergleich mit ust19) */ ustAusgewiesen: reUst + em.ust,
      /** Kz 48: steuerfreie Umsätze ohne Vorsteuerabzug (§ 4 Nr. 8 bis 29 UStG) */ kz48: reFrei + gkv + zz,
      bmg13b, st13b, vstVoll, gemischtGesamt, vstAnteil, vst13b, vorsteuer, zahllast,
      /** was „Aus Rechnungen übernehmen“ der App liefern sollte: nur Rechnungen und Belege mit Vorsteuer-Schalter an (= „pflichtig“) */
      app: { umsatz_19: rePflichtig, umsatz_frei: reFrei, vorsteuer: vstVoll },
      /** Vorsteuer, wenn alle Belege mit dem Startwert „Vorsteuer abziehbar“ an blieben */
      vstStandard,
      /** Vorsteuer, die ein Inhaber ohne Aufteilung bekäme, wenn er gemischte Belege „an“ ließe und nur die rein steuerfreien ausschaltete */
      vstOhneAufteilung: vstVoll + gemischtGesamt,
    };
  });
}

/** Steuerpflichtige und gesamte Umsätze 2026 (vereinnahmt, netto) und endgültige Quote (auf volle Prozent gerundet – Annahme) */
export function jahresQuote() {
  const qs = ustQuartale();
  const pflichtig = sum(qs.map((q) => q.u19));
  const frei = sum(qs.map((q) => q.kz48));
  const exakt = (pflichtig * 100) / (pflichtig + frei);
  return { pflichtig, frei, gesamt: pflichtig + frei, exakt, quote: Math.round(exakt) };
}

/** USt-Jahreserklärung 2026: wie die Voranmeldungen, Vorsteuer aus gemischten Belegen mit der endgültigen Quote */
export function ustJahr() {
  const jq = jahresQuote();
  const vorl = ustQuartale();
  const endg = ustQuartale(jq.quote);
  const summe = (l: typeof vorl, k: "ust19" | "st13b" | "vorsteuer" | "zahllast" | "vstAnteil" | "vst13b") => sum(l.map((q) => q[k]));
  const ust = rund((jq.pflichtig * 19) / 100);
  const vorsteuer = sum(endg.map((q) => q.vstVoll)) + rund((sum(endg.map((q) => q.gemischtGesamt)) * jq.quote) / 100) + sum(endg.map((q) => q.vst13b));
  const st13b = summe(endg, "st13b");
  const jahr = ust + st13b - vorsteuer;
  return { quote: jq.quote, exakt: jq.exakt, ust, st13b, vorsteuer, jahr, vorauszahlungen: summe(vorl, "zahllast"), abschluss: jahr - summe(vorl, "zahllast"), vorsteuerVorl: summe(vorl, "vorsteuer") };
}

/** EÜR 2026 (§ 4 Abs. 3 EStG): Zufluss/Abfluss */
export function euerUnabhaengig() {
  const qs = ustQuartale();
  const reBez = bezahltIn(`${JAHR}-01-01`, `${JAHR}-12-31`);
  const rePflichtig = sum(reBez.map((x) => x.vz * x.s.pflichtig));
  const reFrei = sum(reBez.map((x) => x.vz * x.s.frei));
  const reUst = sum(reBez.map((x) => x.vz * x.s.ust));
  const empfangNetto = sum(qs.map((q) => q.empfang.netto));
  const empfangUst = sum(qs.map((q) => q.empfang.ust));
  const gkv = sum(GKV.filter((g) => g.zufluss.startsWith(`${JAHR}-`)).map((g) => g.betrag));
  const zuzahlungen = sum(Object.values(ZUZAHLUNGEN));
  const einnahmen = rePflichtig + reFrei + reUst + empfangNetto + empfangUst + gkv + zuzahlungen;
  const imJahr = BELEGE.filter((b) => zahltagBeleg(b).startsWith(`${JAHR}-`));
  const nachKategorie: Record<string, { brutto: number; appSicht: number; anzahl: number }> = {};
  let vstPflichtigBezahlt = 0;
  for (const b of imJahr) {
    if (b.kategorie === "anlage") continue;
    const sm = belegSumme(b);
    nachKategorie[b.kategorie] ??= { brutto: 0, appSicht: 0, anzahl: 0 };
    nachKategorie[b.kategorie]!.brutto += sm.brutto;
    // in der App: Vorsteuer-Schalter nur bei „pflichtig“ an → netto, sonst brutto
    nachKategorie[b.kategorie]!.appSicht += b.zuordnung === "pflichtig" ? sm.netto : sm.brutto;
    nachKategorie[b.kategorie]!.anzahl++;
    if (b.zuordnung === "pflichtig") vstPflichtigBezahlt += sm.ust;
  }
  const ausgabenBelege = sum(Object.values(nachKategorie).map((k) => k.brutto));
  const vaGezahlt = VA_Q4_2025.betrag + sum(qs.filter((q) => VA_ZAHLTAG[q.q]!.startsWith(`${JAHR}-`)).map((q) => q.zahllast));
  const anlage = BELEGE.find((b) => b.id === AFA.beleg)!;
  const afaBasis = belegSumme(anlage).brutto;
  const afa = rund((afaBasis / AFA.jahre) * (AFA.monate / 12));
  const ausgaben = ausgabenBelege + vaGezahlt;
  return {
    rePflichtig, reFrei, reUst, empfangNetto, empfangUst, gkv, zuzahlungen, einnahmen, reAnzahl: reBez.length,
    nachKategorie, vstPflichtigBezahlt, ausgabenBelege, vaGezahlt, afa, afaBasis, ausgaben, ergebnis: einnahmen - ausgaben - afa,
    belegeImJahr: imJahr.length,
    offen: sum(vorgaenge().filter((x) => x.vz === 1 && !x.bezahlt && !x.r.storno).map((x) => x.s.brutto)),
    gkvGebuehren: sum(GKV.filter((g) => g.zufluss.startsWith(`${JAHR}-`)).map((g) => azGebuehr(g.betrag))),
  };
}
