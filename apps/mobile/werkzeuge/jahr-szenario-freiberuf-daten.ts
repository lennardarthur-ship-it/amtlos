/**
 * Jahres-Szenario „Mira Lindqvist – Grafikdesign“ (Freiburg im Breisgau, 2026) – nur die ROHDATEN und eine davon
 * UNABHÄNGIGE Rechnung der erwarteten Kennzahlen. Diese Datei importiert absichtlich nichts aus der App oder aus
 * @amtlos/fachlogik: Prüferinnen und Prüfer sollen die Ausgaben der App (werkzeuge/jahr-szenario-freiberuf.ts) gegen
 * diese Zahlen halten können.
 *
 * Betrieb: Einzelunternehmerin, freier Beruf (Grafikdesign), Kleinunternehmerin nach § 19 UStG, keine Beschäftigten,
 * arbeitet von zu Hause, Ist-Zufluss (EÜR nach § 4 Abs. 3 EStG). Alle Namen, Anschriften, Steuer- und Kontonummern sind
 * erfunden (Domains auf .example). Beträge in Cent.
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
export const BETRIEB = {
  name: "Mira Lindqvist – Grafikdesign",
  strasse: "Günterstalstraße 37",
  plz: "79102",
  ort: "Freiburg im Breisgau",
  bundesland: "Baden-Württemberg",
  verantwortlich: "Mira Lindqvist",
  telefon: "0761 4587213",
  email: "hallo@mira-lindqvist.example",
  website: "www.mira-lindqvist.example",
  steuernummer: "06469/27531",
  /** beantragt 2025 wegen Kundschaft in der EU und Software aus Irland – auch Kleinunternehmer können eine haben */
  ust_idnr: "DE347812096",
  iban: ibanDe("68050101", "2045789310"),
  bank: "Sparkasse Freiburg-Nördlicher Breisgau",
  bic: "FRSPDE66XXX",
  rechtsform: "Einzelunternehmen",
  versteuerung: "ist",
  farbe: "#2F5D62",
};
export const INHABERIN = { name: "Mira Lindqvist", geburtsname: "Mira Lindqvist", geburtsdatum: "1991-06-17", geburtsort: "Göteborg (Schweden)", staatsangehoerigkeit: "deutsch und schwedisch", wohnanschrift: "Günterstalstraße 37\n79102 Freiburg im Breisgau" };
export const GRUENDUNG = "2023-04-01";
/** Profilangaben zu Umsatz/Gewinn (für die Kleinunternehmergrenzen § 19 Abs. 1 UStG: Vorjahr ≤ 25.000 €, laufendes Jahr ≤ 100.000 €) */
export const UMSATZ_VORJAHR = 19800;
export const UMSATZ_PROGNOSE = 20000;
export const KU_GRENZE_VORJAHR = 2500000;
export const KU_GRENZE_LAUFEND = 10000000;

export const KUNDEN = {
  k1: { name: "Schwarzwald Sinnesreise GmbH", anschrift: "Kaiser-Joseph-Straße 214\n79098 Freiburg im Breisgau", email: "buchhaltung@sinnesreise.example" },
  k2: { name: "Brauhaus Dreisam GmbH & Co. KG", anschrift: "Schwarzwaldstraße 140\n79117 Freiburg im Breisgau", email: "rechnungen@brauhaus-dreisam.example" },
  k3: { name: "Verlag Hochrhein Medien GmbH", anschrift: "Turmstraße 21\n79539 Lörrach", email: "kreditoren@hochrhein-medien.example" },
  k4: { name: "Physiotherapie Kerstin Faller", anschrift: "Basler Straße 61\n79100 Freiburg im Breisgau", email: "praxis@physio-faller.example" },
  k5: { name: "Lena und Tobias Hartmann", anschrift: "Eschholzstraße 12\n79106 Freiburg im Breisgau" },
  k6: { name: "Dr. Ursula Brenner", anschrift: "Sonnhalde 8\n79104 Freiburg im Breisgau" },
  k7: { name: "Atelier Rheinblick AG", anschrift: "Spalenberg 12\n4051 Basel\nSchweiz", email: "finanzen@atelier-rheinblick.example" },
  k8: { name: "Studio Grachtwerk B.V.", anschrift: "Keizersgracht 221\n1016 DV Amsterdam\nNiederlande", email: "facturen@grachtwerk.example", ust_idnr: "NL859310276B01" },
  k9: { name: "Kulturverein Zwischenraum e. V.", anschrift: "Haslacher Straße 43\n79115 Freiburg im Breisgau", email: "kasse@zwischenraum-freiburg.example" },
  /** Fotograf, Kleinunternehmer – Mira rechnet seine Leistung per Gutschrift ab (sie ist Leistungsempfängerin) */
  kf: { name: "Jonas Kiefer Fotografie", anschrift: "Habsburgerstraße 88\n79104 Freiburg im Breisgau", email: "post@kiefer-fotografie.example", steuernummer: "06/482/19375" },
} as const;
export type KundeId = keyof typeof KUNDEN;
/** Ort der Leistung: Inland, EU-Unternehmer (§ 3a Abs. 2 UStG, Empfänger schuldet die Steuer dort), Drittland */
export const KUNDE_ORT: Record<KundeId, "inland" | "eu_b2b" | "drittland"> = { k1: "inland", k2: "inland", k3: "inland", k4: "inland", k5: "inland", k6: "inland", k7: "drittland", k8: "eu_b2b", k9: "inland", kf: "inland" };

// ---------------------------------------------------------------- Ausgangsrechnungen (Kleinunternehmerin: ohne Umsatzsteuer)

export interface Pos { bez: string; menge: number; einheit: string; preis: number }
export interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  /** Leistungsdatum (ISO), null = wie Rechnungsdatum */
  leistung: string | null;
  /** Leistungszeitraum als Text (statt eines Datums) */
  leistungText?: string;
  ziel: "7" | "14" | "30" | "sofort";
  kunde: KundeId;
  pos: Pos[];
  hinweis: string;
  /** Tag des Zahlungseingangs bzw. – bei der Gutschrift – der eigenen Zahlung */
  bezahlt: string | null;
  storno?: { datum: string; nummer: string; id: string; grund: string };
  ersetzt?: string;
  /** Gutschrift (§ 14 Abs. 2 Satz 2 UStG): Mira ist Leistungsempfängerin und rechnet die Leistung des Fotografen ab */
  gutschrift?: boolean;
  worum: string;
}

const DANKE = "Vielen Dank für Ihren Auftrag.\nBitte geben Sie bei der Zahlung die Rechnungsnummer an.";

export const RECHNUNGEN: Rechnung[] = [
  { id: "r01", nummer: "2026-001", datum: "2026-01-21", leistung: "2026-01-20", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-02-02",
    worum: "Logo-Überarbeitung (Pauschale) und 3,5 Std. Abstimmung.",
    pos: [{ bez: "Überarbeitung Logo und Wortmarke (Pauschale)", menge: 1, einheit: "Pauschale", preis: 95000 }, { bez: "Abstimmungstermine vor Ort und per Video", menge: 3.5, einheit: "Stunde", preis: 7200 }] },
  { id: "r02", nummer: "2026-002", datum: "2026-02-10", leistung: null, ziel: "7", kunde: "k5", hinweis: "Vielen Dank für Ihren Auftrag und alles Gute für die Hochzeit!", bezahlt: "2026-02-14",
    worum: "Privatkunden: Hochzeitspapeterie (Pauschale) und 85 Platzkarten à 1,20 €.",
    pos: [{ bez: "Gestaltung Einladungskarte und Menükarte (Pauschale)", menge: 1, einheit: "Pauschale", preis: 48000 }, { bez: "Reinzeichnung Platzkarten (je Name)", menge: 85, einheit: "Stück", preis: 120 }] },
  { id: "r03", nummer: "2026-003", datum: "2026-03-31", leistung: null, leistungText: "02.03.2026 – 27.03.2026", ziel: "30", kunde: "k3", hinweis: DANKE, bezahlt: "2026-04-20",
    worum: "Verlag: Buchumschlag, Satz 212 Seiten à 6,50 €, 7,25 Std. Bildbearbeitung – LEISTUNGSZEITRAUM als Text statt Datum.",
    pos: [{ bez: "Umschlaggestaltung Sachbuch „Der Hochrhein zu Fuß“", menge: 1, einheit: "Pauschale", preis: 140000 }, { bez: "Satz und Layout Innenteil (je Seite)", menge: 212, einheit: "Seite", preis: 650 }, { bez: "Bildbearbeitung und Freistellungen", menge: 7.25, einheit: "Stunde", preis: 7200 }] },
  { id: "r04", nummer: "2026-004", datum: "2026-04-14", leistung: "2026-04-13", ziel: "14", kunde: "k2", hinweis: DANKE, bezahlt: null,
    storno: { datum: "2026-04-22", nummer: "2026-005", id: "r05", grund: "2,5 statt der vereinbarten 1,5 Stunden Druckdatenerstellung berechnet – Storno und neue Rechnung 2026-006" },
    worum: "Etikettendesign mit 2,5 Std. statt 1,5 Std. → storniert (2026-005) und neu gestellt (2026-006).",
    pos: [{ bez: "Etikettendesign Saisonbier „Dreisam Hell“ (Pauschale)", menge: 1, einheit: "Pauschale", preis: 115000 }, { bez: "Druckdatenerstellung und Abstimmung mit der Druckerei", menge: 2.5, einheit: "Stunde", preis: 7200 }] },
  { id: "r06", nummer: "2026-006", datum: "2026-04-22", leistung: "2026-04-13", ziel: "14", kunde: "k2", ersetzt: "r04", hinweis: `Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-004 vom 14.04.2026.\n${DANKE}`, bezahlt: "2026-05-04",
    worum: "Korrigierte Rechnung Etikettendesign (1,5 Std.).",
    pos: [{ bez: "Etikettendesign Saisonbier „Dreisam Hell“ (Pauschale)", menge: 1, einheit: "Pauschale", preis: 115000 }, { bez: "Druckdatenerstellung und Abstimmung mit der Druckerei", menge: 1.5, einheit: "Stunde", preis: 7200 }] },
  { id: "r07", nummer: "2026-007", datum: "2026-05-18", leistung: "2026-05-15", ziel: "30", kunde: "k8", hinweis: "Thank you for your order. / Vielen Dank für Ihren Auftrag.", bezahlt: "2026-06-01",
    worum: "Niederlande (EU-Unternehmen mit USt-IdNr.): 6 Illustrationen und Nutzungsrechte – Ort der Leistung NL (§ 3a Abs. 2 UStG); in der App nur „Kleinunternehmer“ an, kein Hinweis gewählt.",
    pos: [{ bez: "Illustrationen für den Website-Relaunch (je Motiv)", menge: 6, einheit: "Stück", preis: 24000 }, { bez: "Nutzungsrechte digital, weltweit, 3 Jahre (Pauschale)", menge: 1, einheit: "Pauschale", preis: 60000 }] },
  { id: "r08", nummer: "2026-008", datum: "2026-06-09", leistung: "2026-06-05", ziel: "30", kunde: "k7", hinweis: "Vielen Dank für Ihren Auftrag.", bezahlt: "2026-06-30",
    worum: "Schweiz (Drittland, Unternehmen): Corporate-Design-Handbuch und 2,75 Std. Abstimmung – nicht steuerbar in Deutschland.",
    pos: [{ bez: "Corporate-Design-Handbuch, 32 Seiten (Pauschale)", menge: 1, einheit: "Pauschale", preis: 220000 }, { bez: "Abstimmung per Videokonferenz", menge: 2.75, einheit: "Stunde", preis: 7200 }] },
  { id: "r09", nummer: "2026-009", datum: "2026-07-07", leistung: "2026-07-03", ziel: "14", kunde: "k9", hinweis: DANKE, bezahlt: "2026-07-20",
    worum: "Verein: Plakat und Flyer mit Rabattzeile −15 % (gemeinnützig).",
    pos: [{ bez: "Plakatgestaltung Sommerfestival (A1 und A3)", menge: 1, einheit: "Pauschale", preis: 65000 }, { bez: "Flyer DIN lang, 2 Seiten", menge: 1, einheit: "Pauschale", preis: 38000 }, { bez: "Rabatt 15 % für gemeinnützige Vereine", menge: 1, einheit: "Pauschale", preis: -15450 }] },
  { id: "r10", nummer: "2026-010", datum: "2026-08-12", leistung: "2026-08-10", ziel: "14", kunde: "k4", hinweis: DANKE, bezahlt: "2026-08-25",
    worum: "Physiotherapiepraxis: 5 Seitenlayouts und 4,5 Std. Bildbearbeitung.",
    pos: [{ bez: "Gestaltung Seitenlayout Praxis-Website (je Seite)", menge: 5, einheit: "Stück", preis: 18000 }, { bez: "Fotoauswahl und Bildbearbeitung", menge: 4.5, einheit: "Stunde", preis: 7200 }] },
  { id: "r11", nummer: "2026-011", datum: "2026-09-03", leistung: "2026-08-28", ziel: "14", kunde: "kf", gutschrift: true, hinweis: "Abrechnung im Gutschriftverfahren laut Vereinbarung vom 20.08.2026. Der Betrag wird auf Ihr Konto überwiesen.", bezahlt: "2026-09-10",
    worum: "GUTSCHRIFT an den Fotografen Jonas Kiefer (selbst Kleinunternehmer): Mira hat seine Produktfotos eingekauft und rechnet per Gutschrift ab – für Mira eine AUSGABE (Fremdleistung), bezahlt am 10.09.",
    pos: [{ bez: "Produktfotografie Etikettenprojekt (Tagessatz)", menge: 1, einheit: "Tag", preis: 52000 }, { bez: "Bildrechte für Print und Web, zeitlich unbegrenzt", menge: 1, einheit: "Pauschale", preis: 18000 }] },
  { id: "r12", nummer: "2026-012", datum: "2026-09-28", leistung: "2026-09-25", ziel: "14", kunde: "k1", hinweis: DANKE, bezahlt: "2026-10-12",
    worum: "Broschüre (Pauschale), 3 Kartenillustrationen, 3,5 Std. zusätzliche Korrekturen.",
    pos: [{ bez: "Broschüre Wanderführer, 24 Seiten (Pauschale)", menge: 1, einheit: "Pauschale", preis: 180000 }, { bez: "Kartenillustration (je Karte)", menge: 3, einheit: "Stück", preis: 15000 }, { bez: "Korrekturschleifen über das vereinbarte Maß hinaus", menge: 3.5, einheit: "Stunde", preis: 7200 }] },
  { id: "r13", nummer: "2026-013", datum: "2026-10-20", leistung: null, ziel: "sofort", kunde: "k6", hinweis: "Vielen Dank für Ihren Auftrag.", bezahlt: "2026-10-23",
    worum: "Privatkundin: Familienchronik 96 Seiten à 4,50 €, 6,25 Std. Bildbearbeitung à 60 €.",
    pos: [{ bez: "Layout Familienchronik (je Seite)", menge: 96, einheit: "Seite", preis: 450 }, { bez: "Bildbearbeitung historischer Fotos", menge: 6.25, einheit: "Stunde", preis: 6000 }] },
  { id: "r14", nummer: "2026-014", datum: "2026-11-16", leistung: "2026-11-13", ziel: "30", kunde: "k3", hinweis: DANKE, bezahlt: "2026-12-14",
    worum: "Verlag: Taschenbuch-Umschlag und Satz 148 Seiten.",
    pos: [{ bez: "Umschlaggestaltung Taschenbuch", menge: 1, einheit: "Pauschale", preis: 110000 }, { bez: "Satz Innenteil (je Seite)", menge: 148, einheit: "Seite", preis: 650 }] },
  { id: "r15", nummer: "2026-015", datum: "2026-12-08", leistung: "2026-12-04", ziel: "14", kunde: "k2", hinweis: DANKE, bezahlt: null,
    worum: "Weihnachtsmailing – bleibt zum Jahresende UNBEZAHLT (fällig 22.12.2026).",
    pos: [{ bez: "Weihnachtskarte und Umschlag (Gestaltung)", menge: 1, einheit: "Pauschale", preis: 69000 }, { bez: "Anpassung an Social-Media-Formate (je Format)", menge: 3, einheit: "Stück", preis: 4500 }] },
  { id: "r16", nummer: "2026-016", datum: "2026-12-17", leistung: "2026-12-15", ziel: "14", kunde: "k9", hinweis: DANKE, bezahlt: "2026-12-28",
    worum: "Verein: 4 Infografiken, 1,75 Std. Abstimmung.",
    pos: [{ bez: "Infografiken Jahresbericht (je Grafik)", menge: 4, einheit: "Stück", preis: 9500 }, { bez: "Abstimmung und Korrekturen", menge: 1.75, einheit: "Stunde", preis: 7200 }] },
];

// ---------------------------------------------------------------- Belege (Eingangsrechnungen, Kassenbons, Eigenbelege)

export interface BelegPos { text: string; menge?: string; satz: 19 | 7 | 0; betrag: number }
export interface BelegRoh {
  id: string;
  datum: string;
  lieferant: string;
  anschrift: string;
  nummer: string | null;
  kategorie: string;
  /** „netto“: Rechnung weist Netto und USt je Satz aus (USt = rund(netto × Satz)); „brutto“: Kassenbon/Kleinbetragsrechnung */
  art: "netto" | "brutto";
  saetze: { satz: 19 | 7 | 0; betrag: number }[];
  zahlung: "bank" | "bar" | "privat";
  bezahlt: string | null;
  notiz?: string;
  datei: "pdf" | "xml";
  pos: BelegPos[];
  /** Leistung eines ausländischen Unternehmers ohne Steuerausweis: Mira schuldet die Steuer (§ 13b Abs. 1, 5, 8 UStG) */
  p13b?: boolean;
  worum: string;
}

const posSatz = (pos: BelegPos[], satz: number) => sum(pos.filter((p) => p.satz === satz).map((p) => p.betrag));
const ausPos = (pos: BelegPos[]) => ([19, 7, 0] as const).filter((s) => pos.some((p) => p.satz === s)).map((satz) => ({ satz, betrag: posSatz(pos, satz) }));
const einfach = (o: Omit<BelegRoh, "saetze">): BelegRoh => ({ ...o, saetze: ausPos(o.pos) });

const NOTEBOOKHAUS = { lieferant: "Notebookhaus Freiburg GmbH", anschrift: "Bertoldstraße 52\n79098 Freiburg im Breisgau" };
const FUNKNETZ = { lieferant: "FunkNetz Süd GmbH", anschrift: "Heinrich-von-Stephan-Straße 20\n79100 Freiburg im Breisgau" };

/** Positionen der empfangenen E-Rechnung (XRechnung) der Druckerei – Grundlage für das XML des Lieferanten */
export const ERECHNUNG_POS = [
  { bez: "Visitenkarten 85 × 55 mm, 4/4-farbig, 400 g Naturpapier, Auflage 500 Stück", menge: 1, einheit: "Auflage", preis: 8900, satz: 19 as const },
  { bez: "Briefpapier DIN A4, 1/0-farbig, 100 g, Auflage 1.000 Blatt", menge: 1, einheit: "Auflage", preis: 9700, satz: 19 as const },
];

export const BELEGE: BelegRoh[] = [
  einfach({ id: "b01", datum: "2026-01-08", lieferant: "Adobe Systems Software Ireland Ltd.", anschrift: "4-6 Riverwalk, Citywest Business Campus\nDublin 24, Irland", nummer: "IEINV-2026-0108-4471", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-01-08", datei: "pdf", p13b: true,
    notiz: "Reverse Charge – Steuerschuldnerschaft des Leistungsempfängers; USt-IdNr. DE347812096 beim Kauf angegeben",
    worum: "Software-Abo aus IRLAND ohne Umsatzsteuer (Reverse Charge): Mira schuldet als Leistungsempfängerin 19 % nach § 13b UStG – auch als Kleinunternehmerin",
    pos: [{ text: "Creative Cloud Pro (alle Apps), Jahresabo 01/2026–12/2026", menge: "12 × 69,99 €", satz: 0, betrag: 83988 }] }),
  einfach({ id: "b02", datum: "2026-01-10", lieferant: "Schwarzwaldhost GmbH", anschrift: "Lörracher Straße 16\n79115 Freiburg im Breisgau", nummer: "SH-2026-03318", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-01-10", datei: "pdf", worum: "Webhosting mit Domain und Postfächern 2026 (19 %) – Auftragsverarbeiter (AVV)",
    pos: [{ text: "Webhosting „Kreativ M“ inkl. Domain und 3 Postfächer, 01/2026–12/2026", menge: "12 × 11,95 €", satz: 19, betrag: 14340 }] }),
  einfach({ id: "b03", datum: "2026-01-12", lieferant: "Hanseatische Medienversicherung AG", anschrift: "Ballindamm 17\n20095 Hamburg", nummer: "BH-55102-2026", kategorie: "versicherungen", art: "brutto", zahlung: "bank", bezahlt: "2026-01-12", datei: "pdf", worum: "Berufshaftpflicht (keine USt, Versicherungsteuer)",
    pos: [{ text: "Berufs- und Betriebshaftpflicht für Designerinnen 2026 (inkl. 19 % Versicherungsteuer, keine Umsatzsteuer)", satz: 0, betrag: 18900 }] }),
  einfach({ id: "b04", datum: "2026-01-20", lieferant: "Formfrage Verlag GmbH", anschrift: "Rotebühlplatz 30\n70173 Stuttgart", nummer: "FF-ABO-2026-8812", kategorie: "fortbildung", art: "netto", zahlung: "bank", bezahlt: "2026-01-22", datei: "pdf", worum: "Fachzeitschrift im Jahresabo (7 %)",
    pos: [{ text: "Fachzeitschrift „Formfrage“, Jahresabo 2026 (6 Ausgaben)", satz: 7, betrag: 9000 }] }),
  einfach({ id: "b05", datum: "2026-01-27", lieferant: "Briefkasten Mailservice GmbH", anschrift: "Große Elbstraße 145\n22767 Hamburg", nummer: "BM-26-004417", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-01-27", datei: "pdf", worum: "Newsletter-Versanddienst 2026 (19 %) – Auftragsverarbeiter",
    pos: [{ text: "Newsletter-Versand „Starter“ (bis 1.000 Empfänger), 01/2026–12/2026", menge: "12 × 15,00 €", satz: 19, betrag: 18000 }] }),
  einfach({ id: "b06", datum: "2026-02-03", ...NOTEBOOKHAUS, nummer: "NH-2026-01187", kategorie: "anlage", art: "netto", zahlung: "bank", bezahlt: "2026-02-03", datei: "pdf", worum: "ANLAGE: Laptop 1.847,90 € netto / 2.199,00 € brutto – für die Kleinunternehmerin zählt der Bruttobetrag als Anschaffungskosten (kein Vorsteuerabzug); AfA 3 Jahre ab Februar",
    pos: [{ text: "Notebook 14 Zoll, 32 GB RAM, 1 TB SSD (Seriennr. NB-14-77821)", satz: 19, betrag: 184790 }] }),
  einfach({ id: "b07", datum: "2026-02-24", lieferant: "Bürobedarf Wiehre", anschrift: "Urachstraße 9\n79102 Freiburg im Breisgau", nummer: "Bon 0224-0117", kategorie: "buero", art: "brutto", zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Kleinbetragsrechnung Büromaterial (19 %, EC-Karte)",
    pos: [{ text: "Skizzenblöcke A3 (3 Stück)", satz: 19, betrag: 2697 }, { text: "Druckerpapier 500 Blatt", satz: 19, betrag: 1048 }] }),
  einfach({ id: "b08", datum: "2026-03-05", lieferant: "Nahverkehr Breisgau Fahrkartenservice", anschrift: "Bismarckallee 3\n79098 Freiburg im Breisgau", nummer: "FK-0305-77120", kategorie: "reise", art: "brutto", zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Fahrkarte Freiburg–Lörrach und zurück zum Verlag (7 %, Kleinbetragsrechnung)",
    pos: [{ text: "Fahrkarte Freiburg(Brsg) Hbf – Lörrach Hbf und zurück, 2. Klasse", satz: 7, betrag: 1960 }] }),
  einfach({ id: "b09", datum: "2026-03-12", lieferant: "Buchhandlung am Münsterplatz", anschrift: "Münsterplatz 4\n79098 Freiburg im Breisgau", nummer: "Bon 12-0331", kategorie: "fortbildung", art: "brutto", zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Fachliteratur (7 %, Kleinbetragsrechnung)",
    pos: [{ text: "Fachbuch „Detailtypografie“ (Neuauflage)", satz: 7, betrag: 4800 }] }),
  einfach({ id: "b10", datum: "2026-03-20", lieferant: "Steuerbüro Kaltenbach", anschrift: "Rosastraße 11\n79098 Freiburg im Breisgau", nummer: "2026-0319", kategorie: "beratung", art: "netto", zahlung: "bank", bezahlt: "2026-04-02", datei: "pdf", worum: "Steuerberatung einmal im Jahr: EÜR und ESt-Erklärung 2025 (19 %)",
    pos: [{ text: "Einnahmen-Überschuss-Rechnung 2025", satz: 19, betrag: 32000 }, { text: "Einkommensteuererklärung 2025 (betrieblicher Teil)", satz: 19, betrag: 16000 }] }),
  einfach({ id: "b11", datum: "2026-04-02", lieferant: "Typo-Foundry Nordlicht GmbH", anschrift: "Schanzenstraße 75\n20357 Hamburg", nummer: "TFN-26-1029", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-04-02", datei: "pdf", worum: "Schriftlizenz Desktop + Web (lokal auf der Website eingebunden, 19 %)",
    pos: [{ text: "Schriftfamilie „Larix Sans“, Desktop- und Weblizenz (1 Arbeitsplatz, Website)", satz: 19, betrag: 12000 }] }),
  einfach({ id: "b12", datum: "2026-05-06", lieferant: "Copy Corner Freiburg", anschrift: "Bertoldstraße 9\n79098 Freiburg im Breisgau", nummer: "Bon 0506-221", kategorie: "buero", art: "brutto", zahlung: "privat", bezahlt: null, datei: "pdf", worum: "Probedrucke, bar aus privater Tasche bezahlt (Einlage), Kleinbetragsrechnung 19 %",
    pos: [{ text: "Farblaserdrucke A3, 400 g (Probedrucke Etiketten)", menge: "14 × 1,70 €", satz: 19, betrag: 2380 }] }),
  einfach({ id: "b13", datum: "2026-06-15", ...NOTEBOOKHAUS, nummer: "NH-2026-04402", kategorie: "gwg", art: "netto", zahlung: "bank", bezahlt: "2026-06-15", datei: "pdf", worum: "GWG: Stifttablett 389,00 € netto (Grenze 800 € gilt netto, auch für Kleinunternehmer); Ausgabe brutto",
    pos: [{ text: "Stifttablett Pro M mit Stift und Ständer", satz: 19, betrag: 38900 }] }),
  einfach({ id: "b14", datum: "2026-06-30", ...FUNKNETZ, nummer: "FN-7712-2026-1", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2026-07-03", datei: "pdf", worum: "Mobilfunk (rein betrieblicher Zweitvertrag) Januar–Juni (19 %)",
    pos: [{ text: "Mobilfunktarif „Business S“ Januar–Juni 2026", menge: "6 × 21,01 €", satz: 19, betrag: 12606 }] }),
  einfach({ id: "b15", datum: "2026-09-22", lieferant: "Fernreise-Ticketservice", anschrift: "Bismarckallee 5\n79098 Freiburg im Breisgau", nummer: "FT-2026-922-0481", kategorie: "reise", art: "brutto", zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Bahnfahrt Freiburg–München und zurück zum Workshop (Fernverkehr 7 %)",
    pos: [{ text: "Fahrkarte Freiburg(Brsg) Hbf – München Hbf und zurück, 2. Klasse, Sparpreis", satz: 7, betrag: 12980 }] }),
  einfach({ id: "b16", datum: "2026-09-23", lieferant: "Typo-Werkstatt München GmbH", anschrift: "Schwanthalerstraße 39\n80336 München", nummer: "TW-26-0388", kategorie: "fortbildung", art: "netto", zahlung: "bank", bezahlt: "2026-09-23", datei: "pdf", worum: "Workshop Editorial Design (19 %)",
    pos: [{ text: "Tagesworkshop „Editorial Design und Raster“, 23.09.2026", satz: 19, betrag: 29000 }] }),
  einfach({ id: "b17", datum: "2026-10-14", lieferant: "Druckerei Kaiserstuhl GmbH", anschrift: "Bahnhofstraße 21\n79346 Endingen am Kaiserstuhl", nummer: "DK-2026-10-0412", kategorie: "werbung", art: "netto", zahlung: "bank", bezahlt: "2026-10-21", datei: "xml", worum: "Visitenkarten und Briefpapier als E-RECHNUNG (XRechnung UBL) empfangen und eingelesen (19 %)",
    pos: ERECHNUNG_POS.map((p) => ({ text: p.bez, menge: `${p.menge} × ${eur(p.preis)} €`, satz: p.satz, betrag: rund(p.menge * p.preis) })) }),
  einfach({ id: "b18", datum: "2026-11-04", lieferant: "Postfiliale Wiehre", anschrift: "Günterstalstraße 50\n79102 Freiburg im Breisgau", nummer: "Q-041126-08", kategorie: "buero", art: "brutto", zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Briefmarken (steuerfrei, 0 %)",
    pos: [{ text: "Briefmarken 0,95 € (10 Stück), umsatzsteuerfrei", satz: 0, betrag: 950 }] }),
  einfach({ id: "b19", datum: "2026-12-31", ...FUNKNETZ, nummer: "FN-7712-2026-2", kategorie: "buero", art: "netto", zahlung: "bank", bezahlt: "2027-01-05", datei: "pdf", worum: "Mobilfunk Juli–Dezember – Rechnung vom 31.12.2026, Lastschrift erst 05.01.2027 (Ausgabe EÜR 2027)",
    pos: [{ text: "Mobilfunktarif „Business S“ Juli–Dezember 2026", menge: "6 × 21,01 €", satz: 19, betrag: 12606 }] }),
  einfach({ id: "b20", datum: "2026-12-31", lieferant: "Eigenbeleg Mira Lindqvist", anschrift: "Günterstalstraße 37\n79102 Freiburg im Breisgau", nummer: "EB-2026-01", kategorie: "homeoffice", art: "brutto", zahlung: "privat", bezahlt: null, datei: "pdf", worum: "Homeoffice-Tagespauschale (§ 4 Abs. 5 Satz 1 Nr. 6c EStG): 210 Tage × 6 € = 1.260 € (Höchstbetrag) – kein Arbeitszimmer; seit R10 eigene Kategorie „Homeoffice-Pauschale bzw. Arbeitszimmer“",
    pos: [{ text: "Tätigkeit in der häuslichen Wohnung an 210 Tagen ohne Aufsuchen einer anderen Betriebsstätte, 210 × 6,00 €", satz: 0, betrag: 126000 }] }),
  einfach({ id: "b21", datum: "2026-07-15", lieferant: "Künstlerbedarf Augustinerplatz", anschrift: "Augustinerplatz 2\n79098 Freiburg im Breisgau", nummer: "Bon 0715-0912", kategorie: "waren", art: "brutto", zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Layoutmarker und Fineliner (Material, 19 %, Kleinbetragsrechnung)",
    pos: [{ text: "Layoutmarker-Set 24 Farben", satz: 19, betrag: 4990 }, { text: "Fineliner-Set 0,1–0,8 mm", satz: 19, betrag: 1500 }] }),
];

// ---------------------------------------------------------------- weitere Annahmen

/** AfA Laptop: linear 3 Jahre (AfA-Tabelle AV, Notebooks), zeitanteilig ab Februar (11/12), Bemessung BRUTTO (§ 9b Abs. 1 EStG: nicht abziehbare Vorsteuer gehört zu den Anschaffungskosten). */
export const AFA = { beleg: "b06", jahre: 3, monate: 11 };
/** § 13b-Steuer aus dem Adobe-Abo: angemeldet mit der Voranmeldung Q1/2026 (abzugeben bis 10.04.2026), gezahlt am 10.04.2026 */
export const UST_13B = { satz: 19, zahltag: "2026-04-10", quartal: "2026-Q1" };
/** Homeoffice-Tagespauschale (b20) – gehört nach Anlage EÜR in die Zeile für das häusliche Arbeitszimmer/Tagespauschale */
export const HOMEOFFICE = { beleg: "b20", tage: 210, je_tag: 600 };

// ---------------------------------------------------------------- unabhängige Rechnung

export interface RechnungsSumme { netto: number; ust: number; brutto: number }
/** Summen einer Rechnung der Kleinunternehmerin: Zeile = Menge × Preis (auf Cent gerundet), keine Umsatzsteuer, brutto = netto */
export function rechnungsSumme(pos: Pos[]): RechnungsSumme {
  const netto = sum(pos.map((p) => rund((Math.round(p.menge * 10000) * p.preis) / 10000)));
  return { netto, ust: 0, brutto: netto };
}

/** ausgewiesene Steuer eines Belegs (so wie sie auf dem Beleg steht); die Kleinunternehmerin zieht sie NICHT ab */
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

/** Ausgangsrechnungen samt Stornos (und der Gutschrift) als Vorgänge mit Vorzeichen */
export function vorgaenge() {
  const l: { nummer: string; art: "rechnung" | "storno" | "gutschrift"; datum: string; leistung: string; bezahlt: string | null; vz: 1 | -1; s: RechnungsSumme; kunde: KundeId; r: Rechnung }[] = [];
  for (const r of RECHNUNGEN) {
    const s = rechnungsSumme(r.pos);
    l.push({ nummer: r.nummer, art: r.gutschrift ? "gutschrift" : "rechnung", datum: r.datum, leistung: r.leistung ?? r.datum, bezahlt: r.bezahlt, vz: 1, s, kunde: r.kunde, r });
    if (r.storno) l.push({ nummer: r.storno.nummer, art: "storno", datum: r.storno.datum, leistung: r.storno.datum, bezahlt: null, vz: -1, s, kunde: r.kunde, r });
  }
  return l.sort((a, b) => a.nummer.localeCompare(b.nummer));
}
/** nur echte Ausgangsumsätze (ohne Gutschrift, bei der Mira Leistungsempfängerin ist) */
export const umsatzVorgaenge = () => vorgaenge().filter((x) => x.art !== "gutschrift");

/** § 13b-Steuer (Bemessungsgrundlage = Netto der Leistung, Steuer gerundet) je Beleg */
export const steuer13b = (b: BelegRoh) => (b.p13b ? rund((belegSumme(b).netto * UST_13B.satz) / 100) : 0);

/**
 * Kleinunternehmergrenze (§ 19 Abs. 1, 2 UStG): Gesamtumsatz nach vereinnahmten Entgelten; nicht steuerbare Umsätze
 * (Ort der Leistung im Ausland: Niederlande nach § 3a Abs. 2, Schweiz) zählen nicht dazu.
 */
export function kuUmsatz() {
  const bez = umsatzVorgaenge().filter((x) => x.bezahlt?.startsWith(`${JAHR}-`));
  const inland = sum(bez.filter((x) => KUNDE_ORT[x.kunde] === "inland").map((x) => x.vz * x.s.netto));
  const ausland = sum(bez.filter((x) => KUNDE_ORT[x.kunde] !== "inland").map((x) => x.vz * x.s.netto));
  const vereinbart = sum(umsatzVorgaenge().map((x) => x.vz * x.s.netto));
  // Ersatzregel des Wächters in der App (StB Busch 22.10.2026, src/unterlagen/kuUmsatz.ts): Rechnungen ohne Zahlungsvermerk
  // zählen vorsichtshalber mit dem Rechnungsdatum, unbezahlt stornierte nicht; Auslandsumsätze bleiben draußen
  const ersatz = sum(umsatzVorgaenge().filter((x) => x.vz === 1 && !x.bezahlt && !x.r.storno && x.datum.startsWith(`${JAHR}-`) && KUNDE_ORT[x.kunde] === "inland").map((x) => x.s.netto));
  return { inland, ausland, vereinbart, ersatz, grenzeLaufendOk: inland <= KU_GRENZE_LAUFEND, vorjahrOk: UMSATZ_VORJAHR * 100 <= KU_GRENZE_VORJAHR };
}

/** Umsätze je Quartal nach Leistungsdatum (Storno im Zeitraum des Stornos) – nur zur Information; eine Kleinunternehmerin meldet sie nicht an */
export function umsatzQuartale() {
  return [1, 2, 3, 4].map((n) => {
    const q = `${JAHR}-Q${n}`;
    const im = umsatzVorgaenge().filter((x) => quartal(x.art === "storno" ? x.datum : x.leistung) === q);
    return { q, umsatz: sum(im.map((x) => x.vz * x.s.netto)), anzahl: im.length, p13b: sum(BELEGE.filter((b) => b.p13b && quartal(b.datum) === q).map((b) => belegSumme(b).netto)), steuer13b: sum(BELEGE.filter((b) => b.p13b && quartal(b.datum) === q).map(steuer13b)) };
  });
}

/** EÜR 2026 (§ 4 Abs. 3 EStG) der Kleinunternehmerin: Zufluss/Abfluss, keine Umsatzsteuer-Zeilen, Ausgaben brutto */
export function euerUnabhaengig() {
  const bezahlt = umsatzVorgaenge().filter((x) => x.bezahlt?.startsWith(`${JAHR}-`));
  const einnahmen = sum(bezahlt.map((x) => x.vz * x.s.netto));
  const einnahmenAusland = sum(bezahlt.filter((x) => KUNDE_ORT[x.kunde] !== "inland").map((x) => x.vz * x.s.netto));
  const imJahr = BELEGE.filter((b) => zahltagBeleg(b).startsWith(`${JAHR}-`));
  const nachKategorie: Record<string, { betrag: number; anzahl: number }> = {};
  for (const b of imJahr) {
    if (b.kategorie === "anlage") continue;
    nachKategorie[b.kategorie] ??= { betrag: 0, anzahl: 0 };
    nachKategorie[b.kategorie]!.betrag += belegSumme(b).brutto;
    nachKategorie[b.kategorie]!.anzahl++;
  }
  const ausgabenBelege = sum(Object.values(nachKategorie).map((k) => k.betrag));
  // Gutschrift an den Fotografen: Fremdleistung, abgeflossen am Zahltag
  const fremd = sum(vorgaenge().filter((x) => x.art === "gutschrift" && x.bezahlt?.startsWith(`${JAHR}-`)).map((x) => x.s.brutto));
  const ust13b = sum(BELEGE.filter((b) => b.p13b && UST_13B.zahltag.startsWith(`${JAHR}-`)).map(steuer13b));
  const anlage = BELEGE.find((b) => b.id === AFA.beleg)!;
  const afaBasis = belegSumme(anlage).brutto;
  const afa = rund((afaBasis / AFA.jahre) * (AFA.monate / 12));
  /** was eine Inhaberin fälschlich mit dem Nettobetrag abschriebe */
  const afaNettoFalsch = rund((belegSumme(anlage).netto / AFA.jahre) * (AFA.monate / 12));
  const ausgaben = ausgabenBelege + fremd + ust13b;
  const homeoffice = belegSumme(BELEGE.find((b) => b.id === HOMEOFFICE.beleg)!).brutto;
  return {
    einnahmen, einnahmenAusland, reAnzahl: bezahlt.length, nachKategorie, ausgabenBelege, fremd, ust13b, afa, afaBasis, afaNettoFalsch, homeoffice,
    ausgaben, ergebnis: einnahmen - ausgaben - afa,
    /** Belege, deren Zahlung in 2026 liegt */
    belegeImJahr: imJahr.length,
    /** offene Forderung zum Jahresende */
    offen: sum(umsatzVorgaenge().filter((x) => x.vz === 1 && !x.bezahlt && !x.r.storno).map((x) => x.s.netto)),
  };
}
