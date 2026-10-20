/**
 * Jahres-Szenario „Elektro Brandt“ (Dortmund, 2026) – nur die ROHDATEN und eine davon UNABHÄNGIGE Rechnung der
 * erwarteten Kennzahlen: Umsatzsteuer je Quartal nach vereinbarten Entgelten (Soll, § 13 Abs. 1 Nr. 1 a UStG) mit
 * Mindest-Ist bei der Abschlagsrechnung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG), Skonto als Minderung im Zeitraum der Zahlung
 * (§ 17 Abs. 1 UStG), Bauleistungen an einen Bauunternehmer ohne Steuer (§ 13b Abs. 2 Nr. 4, Abs. 5 UStG, Kz 60),
 * empfangene Bauleistung eines Subunternehmers (§ 13b, Kz 84/85/67), Photovoltaik zum Nullsteuersatz (§ 12 Abs. 3 UStG),
 * Vorsteuer nach Belegdatum und die EÜR 2026 (Zufluss/Abfluss). Diese Datei importiert absichtlich nichts aus der App
 * oder aus @amtlos/fachlogik – nur die kleinen Formatierhilfen des Café-Szenarios (jahr-szenario-daten.ts, ebenfalls ohne
 * App-Bezug). Prüferinnen und Prüfer sollen die Ausgaben der App (werkzeuge/jahr-szenario-elektro.ts) dagegen halten.
 *
 * Alle Namen, Anschriften, Steuer- und Kontonummern sind erfunden (Domains auf .example). Beträge in Cent.
 */
import { de, eur, quartal, rund } from "./jahr-szenario-daten";

export { de, eur, quartal, rund };

// ---------------------------------------------------------------- Hilfen (eigene Implementierung, nicht aus der App)

const sum = (l: number[]) => l.reduce((a, b) => a + b, 0);
export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const QUARTALE = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];

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
  name: "Elektro Brandt",
  strasse: "Wittbräucker Straße 214",
  plz: "44287",
  ort: "Dortmund",
  bundesland: "Nordrhein-Westfalen",
  verantwortlich: "Jens Brandt",
  telefon: "0231 4471820",
  email: "info@elektro-brandt.example",
  website: "www.elektro-brandt.example",
  steuernummer: "317/5048/2193",
  ust_idnr: "DE297641853",
  iban: ibanDe("44050199", "1128830456"),
  bank: "Sparkasse Dortmund",
  bic: "DORTDE33XXX",
  rechtsform: "Einzelunternehmen",
  versteuerung: "soll",
  farbe: "#1F5FA8",
};
/** Inhaber: Elektrotechnikermeister, in die Handwerksrolle eingetragen seit Betriebsbeginn */
export const INHABER = { name: "Jens Brandt", geburtsname: "", geburtsdatum: "1981-09-14", geburtsort: "Dortmund", wohnanschrift: "Am Remberg 37\n44269 Dortmund", meister: "Elektrotechnikermeister (Meisterprüfung 2011, Handwerkskammer Dortmund)" };
export const GRUENDUNG = "2014-04-01";

export const KUNDEN = {
  k1: { name: "Sabine und Thomas Kowalski", anschrift: "Harkortstraße 61\n44225 Dortmund" },
  k2: { name: "Heinz Albers", anschrift: "Benninghofer Straße 140\n44267 Dortmund" },
  k3: { name: "Dr. Miriam Osei", anschrift: "Am Gottesacker 12\n44143 Dortmund" },
  k4: { name: "Lukas Tiedemann", anschrift: "Hörder Rathausstraße 4\n44263 Dortmund" },
  k5: { name: "Bäckerei Hollmann GmbH & Co. KG", anschrift: "Faßstraße 22\n44263 Dortmund", email: "buchhaltung@baeckerei-hollmann.example" },
  k6: { name: "Hausverwaltung Rüdiger Lenz", anschrift: "Ruhrallee 85\n44139 Dortmund", email: "rechnungen@hv-lenz.example" },
  k7: { name: "Physiotherapie Anja Brück", anschrift: "Wellinghofer Straße 201\n44263 Dortmund", email: "praxis@physio-brueck.example" },
  k8: { name: "Hochbau Kemper GmbH", anschrift: "Martener Straße 410\n44379 Dortmund", email: "eingangsrechnungen@hochbau-kemper.example", ust_idnr: "DE814527390" },
  k9: { name: "Autohaus Sommer GmbH", anschrift: "Wittekindstraße 105\n44139 Dortmund", email: "kreditoren@autohaus-sommer.example" },
  k10: { name: "Wohnungsgenossenschaft Dortmund-Süd eG", anschrift: "Kirchhörder Straße 52\n44229 Dortmund", email: "technik@wg-dortmund-sued.example" },
  k11: { name: "Udo Wessel", anschrift: "Am Hombruchsfeld 7\n44225 Dortmund" },
  k12: { name: "Sarah und Can Demir", anschrift: "Am Zehnthof 9\n44269 Dortmund" },
  k13: { name: "Stadt Dortmund – Städtische Immobilienwirtschaft", anschrift: "Hövelstraße 8\n44137 Dortmund", email: "e-rechnung@siw.dortmund.example" },
} as const;
export type KundeId = keyof typeof KUNDEN;

export const MITARBEITER = {
  m1: {
    name: "Dennis Kowalczyk", anschrift: "Schüruferstraße 33\n44287 Dortmund", geburtsdatum: "1991-06-02", geburtsort: "Bochum", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Elektroniker für Energie- und Gebäudetechnik (Geselle)", beginn: "2017-09-01", steuer_id: "38152946071", steuerklasse: "I", sv_nummer: "13020691K018", krankenkasse: "AOK NordWest", iban: ibanDe("44050199", "1130044781"),
  },
  m2: {
    name: "Tobias Reinartz", anschrift: "Aplerbecker Marktplatz 6\n44287 Dortmund", geburtsdatum: "1987-11-23", geburtsort: "Dortmund", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Elektroniker für Energie- und Gebäudetechnik (Geselle)", beginn: "2020-03-01", steuer_id: "50739218463", steuerklasse: "III", sv_nummer: "13231187R027", krankenkasse: "BARMER", iban: ibanDe("44050199", "1141187320"),
  },
  m3: {
    name: "Leon Hagedorn", anschrift: "Berghofer Straße 88\n44269 Dortmund", geburtsdatum: "2009-03-11", geburtsort: "Dortmund", staatsangehoerigkeit: "deutsch",
    taetigkeit: "Auszubildender Elektroniker für Energie- und Gebäudetechnik", beginn: "2025-08-01", steuer_id: "91846027315", steuerklasse: "I", sv_nummer: "13110309H011", krankenkasse: "IKK classic", iban: ibanDe("44050199", "1152290634"),
  },
} as const;

// ---------------------------------------------------------------- Ausgangsrechnungen

export interface Pos { bez: string; menge: number; einheit: string; preis: number; satz: 19 | 7 | 0 }
export interface Rechnung {
  id: string;
  nummer: string;
  datum: string;
  /** Leistungsdatum (ISO, bei Zeiträumen das Ende) – null = wie Rechnungsdatum */
  leistung: string | null;
  /** so in der Rechnung eingetragen (Zeitraum oder Text); ohne Angabe das Datum aus `leistung` */
  leistungText?: string;
  ziel: "7" | "14" | "30" | "sofort";
  kunde: KundeId;
  pos: Pos[];
  /** Pflichthinweise der App (reverse_charge, grundstueck) */
  hinweise?: string[];
  /** Hinweis auf die Steuerbefreiung bzw. hier den Nullsteuersatz (Feld „befreiung“) */
  befreiung?: string;
  hinweis: string;
  bezahlt: string | null;
  storno?: { datum: string; nummer: string; id: string; grund: string };
  ersetzt?: string;
  /** Abschlagsrechnung: Steuer entsteht mit Vereinnahmung (Mindest-Ist) */
  abschlag?: boolean;
  /** Schlussrechnung mit abgezogenem Abschlag (Rechnungsnummer des Abschlags) */
  schlussZu?: string;
  /** Skonto in Prozent, das der Kunde bei der Zahlung abgezogen hat */
  skonto?: number;
  /** Leitweg-ID des öffentlichen Auftraggebers (gehört in BT-10 der XRechnung) */
  leitweg?: string;
  /** Zahlungserinnerung (Tag, an dem sie geschickt wird) */
  erinnerung?: string;
  worum: string;
}

const DANKE = "Vielen Dank für Ihren Auftrag.\nBitte geben Sie bei der Zahlung die Rechnungsnummer an.";
const p = (bez: string, menge: number, einheit: string, preis: number, satz: 19 | 7 | 0 = 19): Pos => ({ bez, menge, einheit, preis, satz });
const p0 = (bez: string, menge: number, einheit: string, preis: number): Pos => p(bez, menge, einheit, preis, 0);
const BV_KEMPER = "Bauvorhaben: Neubau Mehrfamilienhaus Kirchhörder Straße 118, 44229 Dortmund (12 Wohneinheiten), Auftrag vom 12.01.2026.";
export const PV_NULLSATZ = "Nullsteuersatz nach § 12 Abs. 3 Nr. 1 UStG (Lieferung und Installation einer Photovoltaikanlage mit Stromspeicher auf einem Wohngebäude, installierte Bruttoleistung nicht mehr als 30 kW peak).";

export const RECHNUNGEN: Rechnung[] = [
  { id: "r01", nummer: "2026-001", datum: "2026-01-16", leistung: "2026-01-14", ziel: "14", kunde: "k1", hinweise: ["grundstueck"], hinweis: DANKE, bezahlt: "2026-01-26",
    worum: "Privatkunden: FI-Schutzschalter löst aus – Anfahrt, 1,5 Std. Fehlersuche, FI/LS-Schalter, Kleinmaterial (19 %, Hinweis § 14b UStG).",
    pos: [p("Anfahrt Dortmund-Hombruch", 1, "Pauschale", 4500), p("Fehlersuche und Störungsbeseitigung (FI-Schutzschalter löst aus), Geselle", 1.5, "Stunde", 6800), p("FI/LS-Schalter 1-polig+N B16/30 mA, eingebaut", 1, "Stück", 8950), p("Kleinmaterial (Klemmen, Aderendhülsen)", 1, "Pauschale", 1240)] },
  { id: "r02", nummer: "2026-002", datum: "2026-01-29", leistung: "2026-01-27", ziel: "14", kunde: "k5", hinweis: DANKE, bezahlt: "2026-02-09",
    worum: "Bäckerei: 18 LED-Hallenleuchten in Backstube und Lager, 2 Monteure, Arbeitsbühne 2 Tage, Entsorgung der Altleuchten.",
    pos: [p("LED-Hallenleuchte 150 W, 4000 K, inkl. Montagezubehör", 18, "Stück", 14800), p("Montage und Anschluss, Geselle (2 Monteure à 13,5 Std.)", 27, "Stunde", 6800), p("Miete Scherenarbeitsbühne 8 m", 2, "Tag", 18500), p("Demontage und Entsorgung Altleuchten (Leuchtstofflampen)", 18, "Stück", 450)] },
  { id: "r03", nummer: "2026-003", datum: "2026-02-12", leistung: "2026-02-11", leistungText: "12.01.–11.02.2026", ziel: "30", kunde: "k8", hinweise: ["reverse_charge"], hinweis: `${BV_KEMPER}\nElektroinstallation 1. Bauabschnitt (Rohinstallation).\n${DANKE}`, bezahlt: "2026-03-06",
    worum: "BAULEISTUNG an Generalunternehmer (§ 13b UStG, 0 %, „Steuerschuldnerschaft des Leistungsempfängers“): Rohinstallation 12 Wohneinheiten, Leitungen in „m“, Arbeitszeit in „Std.“ (Einheiten, wie Elektriker sie schreiben); Leistungszeitraum statt -datum.",
    pos: [p0("Mantelleitung NYM-J 3×1,5 mm²", 2800, "m", 98), p0("Mantelleitung NYM-J 5×2,5 mm²", 650, "m", 245), p0("Geräte-Verbindungsdose UP, luftdicht", 960, "Stück", 85), p0("Rohinstallation, Geselle", 560, "Std.", 6200), p0("Rohinstallation, Auszubildender", 160, "Std.", 3200)] },
  { id: "r04", nummer: "2026-004", datum: "2026-02-20", leistung: "2026-02-18", ziel: "14", kunde: "k2", hinweise: ["grundstueck"], hinweis: DANKE, bezahlt: "2026-03-03",
    worum: "Privatkunde: neuer Zählerschrank, 12,5 m Hauptleitung, Meister 3,5 Std., Geselle 6 Std., Anmeldung beim Netzbetreiber.",
    pos: [p("Zählerschrank 2 Zählerplätze mit APZ-Feld, komplett verdrahtet", 1, "Stück", 68500), p("Hauptleitung NYY-J 5×16 mm²", 12.5, "Meter", 1480), p("Arbeitszeit Meister (Planung, Abstimmung Netzbetreiber)", 3.5, "Stunde", 7800), p("Arbeitszeit Geselle", 6, "Stunde", 6800), p("Anmeldung beim Netzbetreiber und Inbetriebsetzungsantrag", 1, "Pauschale", 9500)] },
  { id: "r05", nummer: "2026-005", datum: "2026-03-10", leistung: "2026-03-06", leistungText: "16.02.–06.03.2026", ziel: "30", kunde: "k6", hinweis: DANKE, bezahlt: "2026-03-31",
    worum: "Hausverwaltung: Reparaturen in 3 Mietwohnungen (4,25 Std., 3 Anfahrten, 18 Schalter/Steckdosen), Leistungszeitraum.",
    pos: [p("Reparaturen in 3 Mietwohnungen (Aufträge HV-26-014, -019, -022): Arbeitszeit Geselle", 4.25, "Stunde", 6800), p("Anfahrt", 3, "Pauschale", 4500), p("Schalter und Steckdosen (Serie Standard, reinweiß)", 18, "Stück", 790)] },
  { id: "r06", nummer: "2026-006", datum: "2026-03-26", leistung: "2026-03-24", ziel: "14", kunde: "k7", hinweis: DANKE, bezahlt: "2026-04-13",
    worum: "Praxis: Steckdosen und Netzwerk (25 m NYM, 60 m Cat.7 in „m“, 7,5 Std. Geselle und Azubi in „Std.“).",
    pos: [p("Mantelleitung NYM-J 3×1,5 mm²", 25, "m", 98), p("Datenkabel Cat.7 S/FTP", 60, "m", 135), p("Netzwerkdose Cat.6A, 2-fach, UP", 6, "Stück", 2450), p("Arbeitszeit Geselle", 7.5, "Std.", 6800), p("Arbeitszeit Auszubildender", 7.5, "Std.", 3200)] },
  { id: "r07", nummer: "2026-007", datum: "2026-04-09", leistung: "2026-04-07", ziel: "14", kunde: "k3", hinweise: ["grundstueck"], hinweis: DANKE, bezahlt: "2026-04-20",
    worum: "Privatkundin: Wallbox 11 kW mit Zuleitung (22 m), FI Typ A EV, Meister 2 Std., Geselle 5,5 Std., Anmeldung Netzbetreiber.",
    pos: [p("Wallbox 11 kW mit Lastmanagement, Typ 2", 1, "Stück", 89900), p("Mantelleitung NYM-J 5×6 mm²", 22, "Meter", 640), p("Fehlerstrom-Schutzschalter Typ A EV, 40 A/30 mA", 1, "Stück", 16800), p("Arbeitszeit Meister", 2, "Stunde", 7800), p("Arbeitszeit Geselle", 5.5, "Stunde", 6800), p("Anmeldung der Ladeeinrichtung beim Netzbetreiber", 1, "Pauschale", 9500)] },
  { id: "r08", nummer: "2026-008", datum: "2026-04-23", leistung: "2026-04-21", ziel: "14", kunde: "k4", hinweise: ["grundstueck"], hinweis: DANKE, bezahlt: null,
    storno: { datum: "2026-04-30", nummer: "2026-009", id: "r09", grund: "9 statt der tatsächlich 6 Gesellenstunden berechnet – Storno und neue Rechnung 2026-010" },
    worum: "Badsanierung Elektro, 9 Gesellenstunden berechnet statt 6 → nie bezahlt, Storno 2026-009, neu als 2026-010 (per „Kopieren“).",
    pos: [p("Elektroinstallation Badsanierung: Mantelleitung NYM-J 3×1,5 mm²", 35, "Meter", 98), p("Schalter, Steckdosen, Dosen", 9, "Stück", 1150), p("LED-Einbaustrahler IP65", 6, "Stück", 3900), p("Arbeitszeit Geselle", 9, "Stunde", 6800)] },
  { id: "r10", nummer: "2026-010", datum: "2026-04-30", leistung: "2026-04-21", ziel: "14", kunde: "k4", ersetzt: "r08", hinweise: ["grundstueck"], hinweis: `Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-008 vom 23.04.2026 (6 statt 9 Stunden).\n${DANKE}`, bezahlt: "2026-05-11",
    worum: "Korrigierte Rechnung Badsanierung mit 6 Gesellenstunden (in der App: stornierte Rechnung kopiert und geändert).",
    pos: [p("Elektroinstallation Badsanierung: Mantelleitung NYM-J 3×1,5 mm²", 35, "Meter", 98), p("Schalter, Steckdosen, Dosen", 9, "Stück", 1150), p("LED-Einbaustrahler IP65", 6, "Stück", 3900), p("Arbeitszeit Geselle", 6, "Stunde", 6800)] },
  { id: "r11", nummer: "2026-011", datum: "2026-05-14", leistung: "2026-05-13", leistungText: "13.04.–13.05.2026", ziel: "30", kunde: "k8", hinweise: ["reverse_charge"], hinweis: `${BV_KEMPER}\nElektroinstallation 2. Bauabschnitt (Feininstallation und Unterverteilungen).\n${DANKE}`, bezahlt: "2026-06-12",
    worum: "BAULEISTUNG § 13b: Feininstallation, 12 Unterverteilungen, 520 Std. Geselle, 180 Std. Azubi.",
    pos: [p0("Schalter und Steckdosen (Serie Standard), montiert", 960, "Stück", 620), p0("Unterverteilung 3-reihig, bestückt und verdrahtet", 12, "Stück", 24500), p0("Feininstallation, Geselle", 700, "Std.", 6200), p0("Feininstallation, Auszubildender", 180, "Std.", 3200)] },
  { id: "r12", nummer: "2026-012", datum: "2026-05-27", leistung: "2026-05-23", ziel: "14", kunde: "k5", hinweis: DANKE, bezahlt: "2026-06-08",
    worum: "Bäckerei: Notdienst am Samstag (Zuleitung Backofen), 2,5 Std. mit Samstagszuschlag, CEE-Steckdose.",
    pos: [p("Notdienstpauschale Samstag", 1, "Pauschale", 12000), p("Arbeitszeit Geselle", 2.5, "Stunde", 6800), p("Zuschlag Samstag", 2.5, "Stunde", 2500), p("CEE-Steckdose 32 A, 5-polig, AP", 1, "Stück", 6480)] },
  { id: "r13", nummer: "2026-013", datum: "2026-06-12", leistung: "2026-06-05", leistungText: "18.05.–05.06.2026", ziel: "14", kunde: "k12", hinweise: ["grundstueck"], hinweis: `Bauvorhaben: Neubau Einfamilienhaus Am Zehnthof 9, 44269 Dortmund.\n${DANKE}`, bezahlt: "2026-06-29",
    worum: "Private Bauherren: komplette Elektroinstallation Einfamilienhaus-Neubau (Leistungszeitraum, 19 % – Privatpersonen sind keine Bauleistenden).",
    pos: [p("Zählerschrank 3 Zählerplätze mit Überspannungsschutz", 1, "Stück", 148000), p("Unterverteilung 4-reihig, bestückt", 1, "Stück", 69000), p("Mantelleitung NYM-J 3×1,5 mm²", 900, "Meter", 98), p("Mantelleitung NYM-J 5×2,5 mm²", 160, "Meter", 245), p("Schalter, Steckdosen, Dosen (Serie Standard)", 145, "Stück", 1150), p("Netzwerkverkabelung Cat.7 mit Patchfeld", 1, "Pauschale", 98000), p("Arbeitszeit Geselle", 168, "Stunde", 6800), p("Arbeitszeit Auszubildender", 80, "Stunde", 3200), p("Arbeitszeit Meister (Planung, Abnahme, Messprotokoll)", 12, "Stunde", 7800)] },
  { id: "r14", nummer: "2026-014", datum: "2026-06-26", leistung: "2026-09-04", leistungText: "Ausführung ab 15.06.2026 (Abschlag nach Baufortschritt)", ziel: "14", kunde: "k9", abschlag: true,
    hinweis: `Abschlagsrechnung – die Schlussrechnung folgt nach Abnahme.\n${DANKE}`, bezahlt: "2026-07-08",
    worum: "ABSCHLAGSRECHNUNG Werkstatterweiterung (40 % von 58.500 € netto) im Juni, bezahlt am 08.07. – Steuer entsteht mit der Zahlung im Q3 (Mindest-Ist), die App ordnet nach dem Rechnungsdatum (Q2).",
    pos: [p("1. Abschlag Elektroinstallation Werkstatterweiterung laut Auftrag vom 02.06.2026 (40 % von 58.500,00 € netto)", 1, "Pauschale", 2340000)] },
  { id: "r15", nummer: "2026-015", datum: "2026-07-03", leistung: "2026-06-30", leistungText: "22.06.–30.06.2026", ziel: "30", kunde: "k10", hinweis: DANKE, bezahlt: "2026-07-31",
    worum: "Wohnungsgenossenschaft: LED-Treppenhausleuchten mit Bewegungsmelder in 9 Häusern, Leistung bis 30.06. (Q2), Rechnung am 03.07. (Q3) – nur als Zeitraum eingetragen, die App ordnet nach dem Rechnungsdatum.",
    pos: [p("LED-Treppenhausleuchte mit HF-Bewegungsmelder", 72, "Stück", 7900), p("Bewegungsmelder UP für Kellergänge", 36, "Stück", 4250), p("Arbeitszeit Geselle (2 Monteure)", 96, "Stunde", 6800), p("Arbeitszeit Auszubildender", 48, "Stunde", 3200)] },
  { id: "r16", nummer: "2026-016", datum: "2026-07-09", leistung: "2026-07-07", ziel: "14", kunde: "k1", hinweise: ["grundstueck"], hinweis: DANKE, bezahlt: "2026-07-14",
    worum: "Privatkunden: 7 Rauchwarnmelder, Montage 1,25 Std.",
    pos: [p("Rauchwarnmelder mit 10-Jahres-Batterie, Q-Label", 7, "Stück", 2990), p("Montage und Funktionsprüfung, Geselle", 1.25, "Stunde", 6800)] },
  { id: "r17", nummer: "2026-017", datum: "2026-08-06", leistung: "2026-08-04", ziel: "14", kunde: "k11", hinweis: "Die Grabarbeiten wurden vom Kunden selbst ausgeführt.\nVielen Dank für Ihren Auftrag.", bezahlt: "2026-08-19",
    worum: "Privatkunde: Gartenbeleuchtung (35 m Erdkabel, 4 Leuchten) – OHNE Aufbewahrungshinweis nach § 14 Abs. 4 Nr. 9 UStG vergessen (prüft die App das?).",
    pos: [p("Erdkabel NYY-J 3×1,5 mm²", 35, "m", 185), p("Gartenleuchte Edelstahl IP44", 4, "Stück", 11900), p("Arbeitszeit Geselle", 6, "Std.", 6800)] },
  { id: "r18", nummer: "2026-018", datum: "2026-08-27", leistung: "2026-08-26", leistungText: "17.08.–26.08.2026", ziel: "30", kunde: "k8", hinweise: ["reverse_charge"], hinweis: `${BV_KEMPER}\nInbetriebnahme, Erstprüfung und Dokumentation.\n${DANKE}`, bezahlt: "2026-09-29",
    worum: "BAULEISTUNG § 13b: Inbetriebnahme, Erstprüfung nach DIN VDE 0100-600, 12 Prüfprotokolle.",
    pos: [p0("Inbetriebnahme und Erstprüfung nach DIN VDE 0100-600, Geselle", 96, "Std.", 6200), p0("Prüfung und Dokumentation, Meister", 24, "Std.", 7400), p0("Prüfprotokolle je Wohneinheit", 12, "Stück", 4500)] },
  { id: "r19", nummer: "2026-019", datum: "2026-09-11", leistung: "2026-09-04", ziel: "14", kunde: "k9", schlussZu: "2026-014",
    hinweis: "Schlussrechnung zur Elektroinstallation Werkstatterweiterung (Abnahme am 04.09.2026). Die Abschlagsrechnung 2026-014 (netto 23.400,00 €, Umsatzsteuer 4.446,00 €, bezahlt am 08.07.2026) ist abgezogen.\nVielen Dank für Ihren Auftrag.", bezahlt: "2026-10-02",
    worum: "SCHLUSSRECHNUNG mit Abzugszeile −23.400,00 € (19 %) für den Abschlag; Leistung 04.09. (Q3).",
    pos: [p("Unterverteilung Werkstatt 4-reihig, komplett", 1, "Stück", 485000), p("Kabel NYY-J 5×10 mm² (Zuleitung UV Werkstatt)", 85, "Meter", 920), p("Mantelleitung NYM-J 5×2,5 mm²", 640, "Meter", 245), p("LED-Hallenleuchte 200 W", 32, "Stück", 18900), p("CEE-Steckdosenverteiler 32 A", 6, "Stück", 38500), p("Ladepunkt Werkstatt 22 kW", 4, "Stück", 145000), p("Arbeitszeit Geselle", 352, "Stunde", 6400), p("Arbeitszeit Auszubildender", 170, "Stunde", 3200), p("Arbeitszeit Meister", 28, "Stunde", 7400), p("abzüglich 1. Abschlag, Rechnung 2026-014 vom 26.06.2026 (netto)", 1, "Pauschale", -2340000)] },
  { id: "r20", nummer: "2026-020", datum: "2026-09-24", leistung: "2026-09-18", ziel: "30", kunde: "k13", leitweg: "05913000-00012-37",
    hinweis: "Leitweg-ID: 05913000-00012-37 · Bestellnummer SIW-2026-4471 · Kita Lindenhorster Straße 12.\nVielen Dank für Ihren Auftrag.", bezahlt: "2026-10-21",
    worum: "ÖFFENTLICHER AUFTRAGGEBER (Stadt): LED-Umrüstung einer Kita – die XRechnung braucht die Leitweg-ID als Käuferreferenz (BT-10); die App hat kein Feld dafür, sie steht nur im Hinweis.",
    pos: [p("LED-Panel 62×62, 30 W, UGR<19", 64, "Stück", 9800), p("Notleuchte LED mit Selbsttest", 14, "Stück", 18500), p("Arbeitszeit Geselle", 88, "Stunde", 6800), p("Arbeitszeit Auszubildender", 40, "Stunde", 3200), p("Prüfung Sicherheitsbeleuchtung und Protokoll", 1, "Pauschale", 28000)] },
  { id: "r21", nummer: "2026-021", datum: "2026-10-02", leistung: "2026-09-28", ziel: "30", kunde: "k10", skonto: 2,
    hinweis: "Bei Zahlung bis zum 12.10.2026 gewähren wir 2 % Skonto auf den Rechnungsbetrag.\nVielen Dank für Ihren Auftrag.", bezahlt: "2026-10-09",
    worum: "SKONTO: Leistung 28.09. (Q3), Kunde zahlt am 09.10. mit 2 % Skonto – Minderung im Q4 (§ 17 UStG) und geringerer Zufluss in der EÜR; die App kann nur „bezahlt“ vermerken.",
    pos: [p("Prüfung der Gemeinschaftsanlagen nach DIN VDE 0105-100, je Stromkreis", 144, "Stück", 950), p("Arbeitszeit Geselle", 21, "Stunde", 6800), p("Prüfprotokoll und Mängelbericht je Haus", 3, "Pauschale", 6500)] },
  { id: "r22", nummer: "2026-022", datum: "2026-10-15", leistung: "2026-10-14", ziel: "14", kunde: "k7", hinweis: DANKE, bezahlt: "2026-10-27",
    worum: "Praxis: Zuleitung Klimagerät (18 m in „m“, 3,5 Std. in „Std.“).",
    pos: [p("Mantelleitung NYM-J 3×2,5 mm²", 18, "m", 145), p("Leitungsschutzschalter B16", 1, "Stück", 1890), p("Arbeitszeit Geselle (Zuleitung Klimagerät)", 3.5, "Std.", 6800)] },
  { id: "r23", nummer: "2026-023", datum: "2026-11-03", leistung: "2026-10-30", ziel: "14", kunde: "k6", hinweis: DANKE, bezahlt: "2027-01-14", erinnerung: "2026-12-01",
    worum: "ÜBERFÄLLIG: Elektrosanierung einer Mietwohnung, fällig 17.11.2026, Zahlungserinnerung am 01.12.2026, bezahlt erst am 14.01.2027 (EÜR 2027).",
    pos: [p("Elektrosanierung Wohnung Hörder Bahnhofstraße 9, 3. OG links: Mantelleitung NYM-J 3×1,5 mm²", 320, "Meter", 98), p("Unterverteilung 2-reihig mit FI/LS", 1, "Stück", 41500), p("Schalter und Steckdosen", 64, "Stück", 790), p("Arbeitszeit Geselle", 54, "Stunde", 6800), p("Arbeitszeit Auszubildender", 38, "Stunde", 3200), p("Entsorgung Altmaterial", 1, "Pauschale", 3500)] },
  { id: "r24", nummer: "2026-024", datum: "2026-11-19", leistung: "2026-11-17", ziel: "14", kunde: "k2", hinweise: ["grundstueck"], hinweis: DANKE, bezahlt: "2026-11-30",
    worum: "Privatkunde: Überspannungsschutz Typ 1+2, Meister 1,5 Std.",
    pos: [p("Überspannungsschutz Typ 1+2 (Kombiableiter), eingebaut", 1, "Stück", 38900), p("Arbeitszeit Meister", 1.5, "Stunde", 7800)] },
  { id: "r25", nummer: "2026-025", datum: "2026-12-04", leistung: "2026-12-02", ziel: "14", kunde: "k5", hinweis: DANKE, bezahlt: "2026-12-17",
    worum: "Bäckerei: Zuleitung Kühlzelle 28 m, LS 3-polig, 4 Std.",
    pos: [p("Zuleitung Kühlzelle NYM-J 5×4 mm²", 28, "Meter", 410), p("Leitungsschutzschalter 3-polig C20", 1, "Stück", 4290), p("Arbeitszeit Geselle", 4, "Stunde", 6800)] },
  { id: "r26", nummer: "2026-026", datum: "2026-12-15", leistung: "2026-12-11", ziel: "14", kunde: "k3", hinweise: ["grundstueck"], befreiung: PV_NULLSATZ, hinweis: DANKE, bezahlt: "2026-12-22",
    worum: "PHOTOVOLTAIK 9,8 kWp mit Speicher auf dem Einfamilienhaus der Privatkundin – Nullsteuersatz § 12 Abs. 3 UStG (0 %, kein Steuerbefreiungsfall).",
    pos: [p0("PV-Module 445 Wp, Glas-Glas", 22, "Stück", 16900), p0("Hybrid-Wechselrichter 10 kW", 1, "Stück", 238000), p0("Batteriespeicher 10,2 kWh", 1, "Stück", 498000), p0("Montagesystem Ziegeldach", 1, "Pauschale", 145000), p0("Montage und Inbetriebnahme, Meister", 8, "Stunde", 7800), p0("Montage, Geselle (2 Monteure)", 28, "Stunde", 6800)] },
  { id: "r27", nummer: "2026-027", datum: "2026-12-18", leistung: "2026-12-16", ziel: "14", kunde: "k4", hinweise: ["grundstueck"], hinweis: DANKE, bezahlt: "2027-01-08",
    worum: "Privatkunde: Außensteckdose getauscht – bezahlt erst am 08.01.2027 (EÜR 2027).",
    pos: [p("Austausch defekte Außensteckdose IP44", 1, "Stück", 2490), p("Arbeitszeit Geselle", 1, "Stunde", 6800), p("Anfahrt", 1, "Pauschale", 4500)] },
];

// ---------------------------------------------------------------- Lohn (Annahmen „vom Steuerbüro“, nicht nachgerechnet)

export interface LohnMonat { monat: string; zahltag: string; brutto: number; lohnsteuer: number; sv_an: number; sv_ag: number }
const letzterTag = (m: number) => new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10);
const letzterWerktag = (m: number) => {
  const d = new Date(Date.UTC(2026, m, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
/** AG-Anteil Sozialversicherung inkl. Umlagen U1/U2/InsG (Annahme; der BG-Beitrag ist ein eigener Beleg) */
const AG = 0.2135;
const lohnReihe = (brutto: (i: number) => number, lst: (b: number) => number, an: number): LohnMonat[] =>
  MONATE.map((m, i) => {
    const b = brutto(i);
    return { monat: `${m} 2026`, zahltag: letzterWerktag(i + 1), brutto: b, lohnsteuer: lst(b), sv_an: rund(b * an), sv_ag: rund(b * AG) };
  });
export const LOHN = {
  /** Geselle, Tariferhöhung ab Juli */
  m1: lohnReihe((i) => (i < 6 ? 345000 : 355000), (b) => (b === 345000 ? 45616 : 48166), 0.2175),
  m2: lohnReihe(() => 325000, () => 18450, 0.2115),
  /** Azubi: 1. Ausbildungsjahr bis Juli, 2. ab August (Annahme) */
  m3: lohnReihe((i) => (i < 7 ? 96000 : 105000), () => 0, 0.2075),
};
export const personalMonat = (i: number) => sum(Object.values(LOHN).map((l) => l[i]!.brutto + l[i]!.sv_ag));
export const personalQuartal = (q: number) => [0, 1, 2].reduce((a, k) => a + personalMonat((q - 1) * 3 + k), 0);

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
  /** empfangene Bauleistung, für die der Betrieb die Steuer schuldet (§ 13b Abs. 2 Nr. 4, Abs. 5 Satz 2 UStG) */
  p13b?: boolean;
  worum: string;
}
const posSatz = (pos: BelegPos[], satz: number) => sum(pos.filter((x) => x.satz === satz).map((x) => x.betrag));
const ausPos = (pos: BelegPos[]) => ([19, 7, 0] as const).filter((s) => pos.some((x) => x.satz === s)).map((satz) => ({ satz, betrag: posSatz(pos, satz) }));
const einfach = (o: Omit<BelegRoh, "saetze">): BelegRoh => ({ ...o, saetze: ausPos(o.pos) });

const VERMIETER = { lieferant: "Grundstücksgemeinschaft Schulte GbR", anschrift: "Hellweg 12\n44141 Dortmund" };
const STEUERBUERO = { lieferant: "Steuerbüro Hagemann & Kurt PartG mbB", anschrift: "Kaiserstraße 48\n44135 Dortmund" };
const LOHNJOURNAL = { lieferant: "Steuerbüro Hagemann & Kurt (Eigenbeleg Lohnjournal)", anschrift: "Kaiserstraße 48\n44135 Dortmund" };
const ENERGIE = { lieferant: "Stadtwerke Hellweg Energie GmbH", anschrift: "Ostwall 50\n44135 Dortmund" };
export const GROSSHANDEL = { lieferant: "Elektro-Großhandel Westfalen GmbH", anschrift: "Bornstraße 260\n44145 Dortmund", strasse: "Bornstraße 260", plz: "44145", ort: "Dortmund", email: "e-rechnung@egw-westfalen.example", telefon: "0231 9988110", steuernummer: "314/5730/0927", ust_idnr: "DE811902345", iban: ibanDe("44050199", "1100990011"), bic: "DORTDE33XXX" };
const LEASING = { lieferant: "Westfalen Mobil Leasing GmbH", anschrift: "Rheinlanddamm 199\n44139 Dortmund" };
const TANKSTELLE = { lieferant: "Tankstelle Hörde-Süd", anschrift: "Wellinghofer Straße 88\n44263 Dortmund" };
const BAUMARKT = { lieferant: "Baumarkt Phoenix-See", anschrift: "Phoenixseestraße 10\n44263 Dortmund" };
const MESSTECHNIK = { lieferant: "Messtechnik Ruhr GmbH", anschrift: "Emil-Figge-Straße 76\n44227 Dortmund" };
const MOBILFUNK = { lieferant: "Ruhrfunk Mobil GmbH", anschrift: "Königswall 21\n44137 Dortmund" };

function miete(id: string, datum: string, q: number, bezahlt: string): BelegRoh {
  const von = MONATE[(q - 1) * 3]!;
  const bis = MONATE[q * 3 - 1]!;
  const pos: BelegPos[] = [{ text: `Miete Werkstatt und Lager, Wittbräucker Straße 214 (${von}–${bis} 2026, 3 × 1.450,00 €)`, satz: 19, betrag: 435000 }, { text: `Nebenkostenvorauszahlung (${von}–${bis} 2026, 3 × 220,00 €)`, satz: 19, betrag: 66000 }];
  return { id, datum, ...VERMIETER, nummer: `WS-2026-Q${q}`, kategorie: "miete", art: "netto", saetze: ausPos(pos), vorsteuer: true, zahlung: "bank", bezahlt, notiz: "Mietvertrag mit Option zur Umsatzsteuer (§ 9 UStG), vierteljährlich im Voraus", datei: "pdf", pos, worum: `Miete Werkstatt und Lager Q${q} (19 %)` };
}
function lohn(id: string, q: number): BelegRoh {
  const datum = letzterTag(q * 3);
  const pos: BelegPos[] = [0, 1, 2].flatMap((k) => {
    const i = (q - 1) * 3 + k;
    return Object.entries(LOHN).map(([mid, l]) => ({ text: `${l[i]!.monat}: ${MITARBEITER[mid as keyof typeof MITARBEITER].name} – Brutto ${eur(l[i]!.brutto)} € + AG-Anteile ${eur(l[i]!.sv_ag)} €`, satz: 0 as const, betrag: l[i]!.brutto + l[i]!.sv_ag }));
  });
  return {
    id, datum, ...LOHNJOURNAL, nummer: `LJ-2026-Q${q}`, kategorie: "personal", art: "brutto", saetze: [{ satz: 0, betrag: personalQuartal(q) }], vorsteuer: false, zahlung: "bank", bezahlt: datum,
    notiz: "Bruttolöhne, Ausbildungsvergütung und Arbeitgeberanteile laut Lohnjournal; Lohnsteuer-Anmeldung monatlich", datei: "pdf", pos, worum: `Personalkosten Q${q} als Eigenbeleg (Lohnjournal, 0 %, ohne Vorsteuer)`,
  };
}
function grosshandel(id: string, datum: string, nr: string, n19: number, bezahlt: string, monate: string): BelegRoh {
  const pos: BelegPos[] = [
    { text: `Kabel und Leitungen (NYM, NYY, H07RN-F, Datenkabel) (${monate})`, satz: 19, betrag: rund(n19 * 0.38) },
    { text: `Installationsmaterial: Dosen, Schalter, Steckdosen, Klemmen, Verteiler, Schutzschalter (${monate})`, satz: 19, betrag: rund(n19 * 0.44) },
    { text: `Leuchten, Leuchtmittel und Kleinmaterial (${monate})`, satz: 19, betrag: n19 - rund(n19 * 0.38) - rund(n19 * 0.44) },
  ];
  return { id, datum, ...GROSSHANDEL, nummer: nr, kategorie: "waren", art: "netto", saetze: ausPos(pos), vorsteuer: true, zahlung: "bank", bezahlt, notiz: "Monatsabrechnungen als Quartals-Sammelrechnung, Kundennummer 40-77812", datei: "pdf", pos, worum: `Material vom Elektro-Großhandel ${monate} (19 %)` };
}

/** Positionen der empfangenen E-Rechnung des Großhändlers (XRechnung UBL) – Grundlage für das XML des Lieferanten */
export const ERECHNUNG_POS = [
  { bez: "Mantelleitung NYM-J 3x1,5 mm² (10 Ringe à 100 m)", menge: 1000, code: "MTR", preis: 79, satz: 19 as const },
  { bez: "Mantelleitung NYM-J 5x2,5 mm² (5 Ringe à 100 m)", menge: 500, code: "MTR", preis: 198, satz: 19 as const },
  { bez: "Abzweigdose AP IP65 mit Klemmen", menge: 50, code: "H87", preis: 189, satz: 19 as const },
  { bez: "Frachtkosten", menge: 1, code: "LS", preis: 1490, satz: 19 as const },
];

export const BELEGE: BelegRoh[] = [
  miete("b01", "2026-01-02", 1, "2026-01-05"),
  miete("b02", "2026-04-01", 2, "2026-04-03"),
  miete("b03", "2026-07-01", 3, "2026-07-03"),
  miete("b04", "2026-10-01", 4, "2026-10-05"),
  einfach({ id: "b05", datum: "2026-01-20", ...ENERGIE, nummer: "SH-88413-26-1", kategorie: "energie", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-22", datei: "pdf", worum: "Abschläge Strom Werkstatt Januar–Juni (19 %), Kategorie „Energie“ (seit R10, vorher unter Miete)",
    pos: [{ text: "Abschläge Strom Werkstatt Januar–Juni 2026 (6 × 185,00 €)", satz: 19, betrag: 111000 }] }),
  einfach({ id: "b06", datum: "2026-07-20", ...ENERGIE, nummer: "SH-88413-26-2", kategorie: "energie", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-07-22", datei: "pdf", worum: "Abschläge Strom Werkstatt Juli–Dezember (19 %)",
    pos: [{ text: "Abschläge Strom Werkstatt Juli–Dezember 2026 (6 × 185,00 €)", satz: 19, betrag: 111000 }] }),
  lohn("b07", 1),
  lohn("b08", 2),
  lohn("b09", 3),
  lohn("b10", 4),
  grosshandel("b11", "2026-03-31", "EGW-26-03-08812", 1442480, "2026-04-14", "Januar–März 2026"),
  grosshandel("b12", "2026-06-30", "EGW-26-06-11954", 1936590, "2026-07-14", "April–Juni 2026"),
  grosshandel("b13", "2026-09-30", "EGW-26-09-15207", 2008720, "2026-10-14", "Juli–September 2026"),
  { ...grosshandel("b14", "2026-12-31", "EGW-26-12-18733", 1464350, "2027-01-14", "Oktober–Dezember 2026"), worum: "Material Q4 (19 %) – Belegdatum 31.12.2026, bezahlt erst 14.01.2027 (Vorsteuer Q4/2026, Ausgabe EÜR 2027)" },
  einfach({ id: "b15", datum: "2026-09-08", ...GROSSHANDEL, nummer: "EGW-RE-2026-77120", kategorie: "waren", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-22", datei: "xml", worum: "Kabellieferung für die Werkstatterweiterung als E-RECHNUNG (XRechnung UBL, Einheiten MTR/H87/LS) empfangen, mit der App eingelesen (19 %)",
    pos: ERECHNUNG_POS.map((x) => ({ text: x.bez, menge: `${x.menge} × ${eur(x.preis)} €`, satz: x.satz, betrag: rund(x.menge * x.preis) })) }),
  einfach({ id: "b16", datum: "2026-02-17", ...TANKSTELLE, nummer: "Bon 2602-1734", kategorie: "fahrzeug", art: "brutto", vorsteuer: true, zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Tankquittung Diesel Werkstattwagen (Kleinbetragsrechnung, Karte)",
    pos: [{ text: "Diesel 52,65 l × 1,699 €", satz: 19, betrag: 8945 }] }),
  einfach({ id: "b17", datum: "2026-06-03", ...TANKSTELLE, nummer: "Bon 2606-0412", kategorie: "fahrzeug", art: "brutto", vorsteuer: true, zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Tankquittung Diesel (Kleinbetragsrechnung, Karte)",
    pos: [{ text: "Diesel 61,33 l × 1,699 €", satz: 19, betrag: 10420 }] }),
  einfach({ id: "b18", datum: "2026-10-21", ...TANKSTELLE, nummer: "Bon 2610-2210", kategorie: "fahrzeug", art: "brutto", vorsteuer: true, zahlung: "bank", bezahlt: null, datei: "pdf", worum: "Tankquittung Diesel (Kleinbetragsrechnung, Karte)",
    pos: [{ text: "Diesel 44,91 l × 1,699 €", satz: 19, betrag: 7630 }] }),
  ...[["b19", "2026-01-05", 1], ["b20", "2026-04-02", 2], ["b21", "2026-07-02", 3], ["b22", "2026-10-02", 4]].map(([id, datum, q]) =>
    einfach({ id: id as string, datum: datum as string, ...LEASING, nummer: `WML-118204-Q${q}`, kategorie: "fahrzeug", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: datum as string, datei: "pdf", notiz: "Leasing Werkstattwagen DO-EB 214 (Kastenwagen, 2 Sitze, nur betrieblich genutzt)", worum: `Leasing Werkstattwagen Q${q} (19 %, Dauerrechnung je Quartal)`,
      pos: [{ text: `Leasingrate Kastenwagen DO-EB 214, ${MONATE[((q as number) - 1) * 3]}–${MONATE[(q as number) * 3 - 1]} 2026 (3 × 489,00 €)`, satz: 19, betrag: 146700 }] })),
  einfach({ id: "b23", datum: "2026-01-02", lieferant: "Hellweg Versicherung AG", anschrift: "Kampstraße 40\n44137 Dortmund", nummer: "KFZ-2026-551870", kategorie: "fahrzeug", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-01-02", datei: "pdf", worum: "Kfz-Haftpflicht und Vollkasko Werkstattwagen 2026 (keine USt, Versicherungsteuer)",
    pos: [{ text: "Kfz-Haftpflicht und Vollkasko 2026 (Beitrag inkl. Versicherungsteuer, keine Umsatzsteuer)", satz: 0, betrag: 118430 }] }),
  einfach({ id: "b24", datum: "2026-03-16", lieferant: "Hauptzollamt Dortmund", anschrift: "Kaiserstraße 54\n44135 Dortmund", nummer: "KraftSt DO-EB 214", kategorie: "fahrzeug", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-03-16", datei: "pdf", worum: "Kraftfahrzeugsteuer Werkstattwagen (0 %, kein Umsatz)",
    pos: [{ text: "Kraftfahrzeugsteuer 2026 für DO-EB 214", satz: 0, betrag: 17200 }] }),
  einfach({ id: "b25", datum: "2026-04-14", ...MESSTECHNIK, nummer: "MR-2026-0418", kategorie: "anlage", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-04-21", datei: "pdf", worum: "ANLAGE über 800 € netto: Installationstester (VDE 0100/0701-0702) mit Kalibrierschein, 1.935 € netto (Nutzungsdauer 5 Jahre angenommen, ab April 9/12)",
    pos: [{ text: "Installationstester Multifunktion (VDE 0100-600, VDE 0701-0702) mit Zubehörkoffer", satz: 19, betrag: 189000 }, { text: "Werkskalibrierschein", satz: 19, betrag: 4500 }] }),
  einfach({ id: "b26", datum: "2026-02-24", lieferant: "Werkzeughandel Ruhr-Ost GmbH", anschrift: "Schleefstraße 12\n44287 Dortmund", nummer: "WR-26-02331", kategorie: "gwg", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-02", datei: "pdf", worum: "GWG: Akku-Bohrhammer-Set 649 € netto",
    pos: [{ text: "Akku-Kombihammer 18 V mit 2 Akkus 5,0 Ah, Ladegerät, Koffer", satz: 19, betrag: 64900 }] }),
  einfach({ id: "b27", datum: "2026-01-15", lieferant: "Handwerker-Versicherung Westfalen VVaG", anschrift: "Märkische Straße 120\n44141 Dortmund", nummer: "BHV-2026-30418", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-01-15", datei: "pdf", worum: "Betriebshaftpflicht Elektrohandwerk (keine USt)",
    pos: [{ text: "Betriebs- und Umwelthaftpflicht Elektroinstallation 2026 (inkl. Versicherungsteuer, keine Umsatzsteuer)", satz: 0, betrag: 94860 }] }),
  einfach({ id: "b28", datum: "2026-04-24", lieferant: "Berufsgenossenschaft Energie Textil Elektro Medienerzeugnisse (BG ETEM)", anschrift: "Gustav-Heinemann-Ufer 130\n50968 Köln", nummer: "Beitragsbescheid 2025", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-05-15", datei: "pdf", worum: "Beitrag zur gesetzlichen Unfallversicherung für 2025 (Umlage, 0 %)",
    pos: [{ text: "Beitrag 2025 nach Lohnnachweis (Gefahrtarifstelle Elektrotechnik), keine Umsatzsteuer", satz: 0, betrag: 186240 }] }),
  einfach({ id: "b29", datum: "2026-03-09", lieferant: "Handwerkskammer Dortmund", anschrift: "Ardeystraße 93\n44139 Dortmund", nummer: "HWK-B-2026-118342", kategorie: "versicherungen", art: "brutto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-03-23", datei: "pdf", worum: "Kammerbeitrag 2026 (0 %)",
    pos: [{ text: "Grundbeitrag und Zusatzbeitrag 2026", satz: 0, betrag: 38500 }] }),
  einfach({ id: "b30", datum: "2026-06-30", ...MOBILFUNK, nummer: "RM-26-06-44712", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-07-03", datei: "pdf", worum: "Mobilfunk 4 Geräte Januar–Juni (19 %)",
    pos: [{ text: "Mobilfunk Business, 4 Karten, Januar–Juni 2026 (6 × 74,90 €)", satz: 19, betrag: 44940 }] }),
  einfach({ id: "b31", datum: "2026-12-30", ...MOBILFUNK, nummer: "RM-26-12-51230", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-12-30", datei: "pdf", worum: "Mobilfunk 4 Geräte Juli–Dezember (19 %)",
    pos: [{ text: "Mobilfunk Business, 4 Karten, Juli–Dezember 2026 (6 × 74,90 €)", satz: 19, betrag: 44940 }] }),
  einfach({ id: "b32", datum: "2026-01-08", lieferant: "Webhosting Ruhr GmbH", anschrift: "Rheinische Straße 1\n44137 Dortmund", nummer: "WR-2026-00811", kategorie: "buero", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-01-08", datei: "pdf", worum: "Webhosting mit Kontaktformular und E-Mail 2026 (19 %) – Auftragsverarbeiter",
    pos: [{ text: "Webhosting „Handwerk M“ inkl. 5 Postfächer, 01–12/2026", satz: 19, betrag: 15600 }] }),
  einfach({ id: "b33", datum: "2026-03-18", ...STEUERBUERO, nummer: "2026-0331", kategorie: "beratung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-27", datei: "pdf", worum: "Steuerberatung: EÜR und Erklärungen 2025 (19 %)",
    pos: [{ text: "Einnahmen-Überschuss-Rechnung 2025 mit Anlagenverzeichnis", satz: 19, betrag: 98000 }, { text: "Einkommen-, Gewerbe- und Umsatzsteuererklärung 2025", satz: 19, betrag: 47000 }] }),
  einfach({ id: "b34", datum: "2026-09-21", ...STEUERBUERO, nummer: "2026-1044", kategorie: "beratung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-09-30", datei: "pdf", worum: "Lohnabrechnungen Januar–August 2026, 3 Beschäftigte (19 %)",
    pos: [{ text: "Lohn- und Gehaltsabrechnung 01–08/2026 (8 Monate × 3 Beschäftigte × 29,00 €)", satz: 19, betrag: 69600 }] }),
  einfach({ id: "b35", datum: "2026-05-20", lieferant: "Bildungszentrum der Elektro-Innung Dortmund", anschrift: "Lindemannstraße 79\n44137 Dortmund", nummer: "BZ-26-0517", kategorie: "fortbildung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-05-27", datei: "pdf", worum: "Seminar „Änderungen DIN VDE 0100“ für Meister und einen Gesellen (19 %)",
    pos: [{ text: "Tagesseminar „Neuerungen DIN VDE 0100“ am 18.05.2026, 2 Teilnehmer (Jens Brandt, Dennis Kowalczyk) à 195,00 €", satz: 19, betrag: 39000 }] }),
  einfach({ id: "b36", datum: "2026-08-03", lieferant: "Fachbuchhandlung Ruhr", anschrift: "Westenhellweg 70\n44137 Dortmund", nummer: "Bon 0803-118", kategorie: "fortbildung", art: "brutto", vorsteuer: true, zahlung: "privat", bezahlt: null, datei: "pdf", worum: "Tabellenbuch Elektrotechnik für den Auszubildenden, PRIVAT bezahlt (Einlage), 7 %",
    pos: [{ text: "Tabellenbuch Elektrotechnik, 30. Auflage", satz: 7, betrag: 4290 }] }),
  einfach({ id: "b37", datum: "2026-03-02", lieferant: "Arbeitsschutz Profi GmbH", anschrift: "Evinger Straße 300\n44339 Dortmund", nummer: "AP-2026-03-0912", kategorie: "sonstiges", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-09", datei: "pdf", worum: "Persönliche Schutzausrüstung: Sicherheitsschuhe, isolierende Handschuhe Klasse 0, Störlichtbogen-Gesichtsschutz (19 %)",
    pos: [{ text: "Sicherheitsschuhe S3 ESD (4 Paar)", satz: 19, betrag: 33600 }, { text: "Elektriker-Schutzhandschuhe Klasse 0 (1.000 V) (4 Paar)", satz: 19, betrag: 22000 }, { text: "Störlichtbogen-Gesichtsschutzschild Klasse 2", satz: 19, betrag: 18900 }] }),
  einfach({ id: "b38", datum: "2026-05-08", ...BAUMARKT, nummer: "Bon 0508-4471", kategorie: "waren", art: "brutto", vorsteuer: true, zahlung: "bar", bezahlt: null, datei: "pdf", worum: "KLEINBETRAGSRECHNUNG Baumarkt (bar, 19 %)",
    pos: [{ text: "Brandschutz-Acryl (4 Kartuschen)", satz: 19, betrag: 2396 }, { text: "Dübel und Schrauben Sortiment", satz: 19, betrag: 1299 }, { text: "Kabelbinder 300 mm (2 Pack)", satz: 19, betrag: 692 }] }),
  einfach({ id: "b39", datum: "2026-11-12", ...BAUMARKT, nummer: "Bon 1112-0937", kategorie: "waren", art: "brutto", vorsteuer: true, zahlung: "bar", bezahlt: null, datei: "pdf", worum: "KLEINBETRAGSRECHNUNG Baumarkt (bar, 19 %)",
    pos: [{ text: "Montageschaum B2 (2 Dosen)", satz: 19, betrag: 1598 }, { text: "Gipsspachtel 5 kg", satz: 19, betrag: 1617 }] }),
  einfach({ id: "b40", datum: "2026-09-02", lieferant: "Parkhaus am Phoenix-See", anschrift: "Hörder Burgstraße 18\n44263 Dortmund", nummer: "Ticket 090226-551", kategorie: "fahrzeug", art: "brutto", vorsteuer: true, zahlung: "bar", bezahlt: null, datei: "pdf", worum: "KLEINBETRAGSRECHNUNG Parkgebühr beim Kunden (bar, 19 %)",
    pos: [{ text: "Parkgebühr 4 Std.", satz: 19, betrag: 1200 }] }),
  einfach({ id: "b41", datum: "2026-05-06", lieferant: "Kernbohrtechnik Yilmaz", anschrift: "Mallinckrodtstraße 212\n44147 Dortmund", nummer: "KY-26-0142", kategorie: "fremdleistungen", art: "netto", vorsteuer: false, zahlung: "bank", bezahlt: "2026-05-20", datei: "pdf", p13b: true,
    notiz: "Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) – Umsatzsteuer selbst anmelden; Freistellungsbescheinigung § 48b EStG liegt vor",
    worum: "SUBUNTERNEHMER-BAULEISTUNG ohne USt (§ 13b UStG): Kernbohrungen auf der Baustelle Kirchhörder Straße – Elektro Brandt schuldet die Steuer (Kz 84/85) und zieht sie als Vorsteuer ab (Kz 67); die App kennt das nicht",
    pos: [{ text: "Kernbohrungen Ø 82 mm in Stahlbeton für Leitungsdurchführungen, BV Kirchhörder Straße 118 (14 Stück × 65,00 €)", satz: 0, betrag: 91000 }, { text: "Anfahrt und Wasserabsaugung", satz: 0, betrag: 4500 }] }),
  einfach({ id: "b42", datum: "2026-07-15", lieferant: "Recycling Ruhr GmbH", anschrift: "Hafenstraße 30\n44147 Dortmund", nummer: "RR-26-07-0331", kategorie: "sonstiges", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-07-24", datei: "pdf", worum: "Entsorgung Altleuchten (Leuchtstofflampen) und Elektroschrott (19 %)",
    pos: [{ text: "Entsorgung Leuchtstofflampen und Elektroaltgeräte (Gitterbox)", satz: 19, betrag: 8900 }] }),
  einfach({ id: "b43", datum: "2026-11-05", ...MESSTECHNIK, nummer: "MR-2026-1107", kategorie: "sonstiges", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-11-12", datei: "pdf", worum: "Kalibrierung des älteren Gerätetesters (Prüfmittel für die DGUV-V3-Eigenprüfung, 19 %)",
    pos: [{ text: "Kalibrierung Gerätetester VDE 0701-0702 mit Kalibrierschein", satz: 19, betrag: 12500 }] }),
  einfach({ id: "b44", datum: "2026-03-20", lieferant: "Werbetechnik Dortmund-Süd", anschrift: "Hagener Straße 220\n44229 Dortmund", nummer: "WT-2603-77", kategorie: "werbung", art: "netto", vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-30", datei: "pdf", worum: "Fahrzeugbeschriftung Werkstattwagen (19 %)",
    pos: [{ text: "Teilfolierung und Beschriftung Kastenwagen mit Logo und Kontaktdaten", satz: 19, betrag: 68000 }] }),
];

// ---------------------------------------------------------------- weitere Annahmen

/** Umsatzsteuer-Zahllast Q4/2025, gezahlt am 12.01.2026 (Annahme aus dem Vorjahr) */
export const UST_Q4_2025 = { betrag: 412380, gezahlt: "2026-01-12" };
/** Zahltag der Vorauszahlung je Quartal (10. des Folgemonats bzw. nächster Werktag, keine Dauerfristverlängerung) */
export const UST_ZAHLTAGE: Record<string, string> = { "2026-Q1": "2026-04-10", "2026-Q2": "2026-07-10", "2026-Q3": "2026-10-12", "2026-Q4": "2027-01-11" };
/** Installationstester: linear 5 Jahre (Annahme), zeitanteilig ab April (9/12) */
export const AFA = { beleg: "b25", jahre: 5, monate: 9 };

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

const ausBrutto = (brutto: number, satz: number) => {
  const netto = rund((brutto * 100) / (100 + satz));
  return { netto, ust: brutto - netto };
};
/** ausgewiesene Steuer eines Belegs (so wie sie auf dem Beleg steht) und daraus Netto/Brutto */
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
export const zahltagBeleg = (b: BelegRoh) => b.bezahlt ?? b.datum;

/** Skonto, das der Kunde abgezogen hat: vom Bruttobetrag gerechnet, Netto und Steuer daraus (19 %) */
export function skontoVon(r: Rechnung): { brutto: number; netto: number; ust: number } {
  if (!r.skonto) return { brutto: 0, netto: 0, ust: 0 };
  const s = rechnungsSumme(r.pos);
  const brutto = rund((s.brutto * r.skonto) / 100);
  const a = ausBrutto(brutto, 19);
  return { brutto, netto: a.netto, ust: a.ust };
}

export type Steuerart = "standard" | "reverse_charge" | "nullsatz";
export interface Vorgang { nummer: string; art: "rechnung" | "storno"; datum: string; leistung: string; bezahlt: string | null; vz: 1 | -1; s: RechnungsSumme; kunde: KundeId; steuerart: Steuerart; r: Rechnung }
const steuerartVon = (r: Rechnung): Steuerart => (r.hinweise?.includes("reverse_charge") ? "reverse_charge" : r.befreiung ? "nullsatz" : "standard");
/** Rechnungen und Stornos mit Vorzeichen */
export function vorgaenge(): Vorgang[] {
  const l: Vorgang[] = [];
  for (const r of RECHNUNGEN) {
    const s = rechnungsSumme(r.pos);
    l.push({ nummer: r.nummer, art: "rechnung", datum: r.datum, leistung: r.leistung ?? r.datum, bezahlt: r.bezahlt, vz: 1, s, kunde: r.kunde, steuerart: steuerartVon(r), r });
    if (r.storno) l.push({ nummer: r.storno.nummer, art: "storno", datum: r.storno.datum, leistung: r.storno.datum, bezahlt: null, vz: -1, s, kunde: r.kunde, steuerart: steuerartVon(r), r });
  }
  return l.sort((a, b) => a.nummer.localeCompare(b.nummer));
}

/** Quartal, in dem die Steuer für einen Vorgang entsteht (Soll) – mit Begründung */
export function steuerQuartal(x: Vorgang): { q: string | null; grund: string } {
  if (x.art === "storno") return { q: quartal(x.datum), grund: "Storno: Zeitraum der Berichtigung (§ 17 UStG)" };
  if (x.r.abschlag) return x.bezahlt ? { q: quartal(x.bezahlt), grund: "Abschlag vor Ausführung: Zeitraum der Vereinnahmung (§ 13 Abs. 1 Nr. 1 a Satz 4 UStG)" } : { q: null, grund: "Abschlag nicht vereinnahmt" };
  if (x.r.ersetzt) return { q: quartal(x.datum), grund: "Ersatzrechnung: Zeitraum der Korrektur (wie Café-Szenario)" };
  return { q: quartal(x.leistung), grund: "Zeitraum der Leistung (§ 13 Abs. 1 Nr. 1 a Satz 1 UStG)" };
}

export interface UstQuartal {
  q: string;
  /** Rechnungen, die in diesem Quartal Steuer auslösen */
  nummern: string[];
  /** steuerpflichtige Umsätze 19 % (Kz 81) nach Skonto-Minderung */
  r19: number;
  /** davon Skonto-Minderung (negativ) */
  skonto19: number;
  /** Bauleistungen, für die der Empfänger die Steuer schuldet (Kz 60) */
  r13b: number;
  /** Nullsteuersatz § 12 Abs. 3 UStG (Kz 87) */
  rNull: number;
  /** Vorsteuer aus Rechnungen (Kz 66), nach Belegdatum */
  vorsteuer66: number;
  /** empfangene Bauleistungen § 13b: Bemessungsgrundlage (Kz 84), Steuer (Kz 85) = Vorsteuer (Kz 67) */
  kz84: number; kz85: number; kz67: number;
  ust: number; vorsteuer: number; zahllast: number;
  /** wie ELSTER: Bemessungsgrundlagen in vollen Euro */
  elsterZahllast: number;
}

/**
 * USt je Quartal (Soll): Rechnungen nach Leistungsdatum, Abschlag nach Zahlung (Mindest-Ist), Storno im Zeitraum des
 * Stornos, Skonto als Minderung im Zeitraum der Zahlung (§ 17 Abs. 1 Satz 7 UStG); 13b-Ausgangsumsätze ohne Steuer
 * (Kz 60); empfangene 13b-Bauleistungen nach Rechnungsdatum (§ 13b Abs. 2 UStG: Steuer entsteht mit Ausstellung der
 * Rechnung) mit gleich hoher Vorsteuer; Vorsteuer aus Rechnungen nach Belegdatum.
 */
export function ustQuartale(): UstQuartal[] {
  const v = vorgaenge();
  return QUARTALE.map((q) => {
    const im = v.filter((x) => steuerQuartal(x).q === q);
    const r = (satz: string, art?: Steuerart) => sum(im.filter((x) => !art || x.steuerart === art).map((x) => x.vz * (x.s.gruppen[satz]?.netto ?? 0)));
    const skonto19 = -sum(RECHNUNGEN.filter((x) => x.skonto && x.bezahlt && quartal(x.bezahlt) === q).map((x) => skontoVon(x).netto));
    const r19 = r("19") + skonto19;
    const imQ = BELEGE.filter((b) => quartal(b.datum) === q);
    const vorsteuer66 = sum(imQ.map((b) => belegSumme(b).vorsteuer));
    const kz84 = sum(imQ.filter((b) => b.p13b).map((b) => belegSumme(b).netto));
    const kz85 = rund((kz84 * 19) / 100);
    const kz67 = kz85;
    const ust = rund((r19 * 19) / 100) + kz85;
    const vorsteuer = vorsteuer66 + kz67;
    const voll = (c: number) => Math.trunc(c / 100) * 100;
    const elsterUst = rund((voll(r19) * 19) / 100) + rund((voll(kz84) * 19) / 100);
    const elsterVst = vorsteuer66 + rund((voll(kz84) * 19) / 100);
    return { q, nummern: im.map((x) => x.nummer), r19, skonto19, r13b: r("0", "reverse_charge"), rNull: r("0", "nullsatz"), vorsteuer66, kz84, kz85, kz67, ust, vorsteuer, zahllast: ust - vorsteuer, elsterZahllast: elsterUst - elsterVst };
  });
}

export function jahresSummen() {
  const q = ustQuartale();
  const s = (f: (x: UstQuartal) => number) => sum(q.map(f));
  return { r19: s((x) => x.r19), r13b: s((x) => x.r13b), rNull: s((x) => x.rNull), vorsteuer66: s((x) => x.vorsteuer66), kz84: s((x) => x.kz84), kz85: s((x) => x.kz85), ust: s((x) => x.ust), vorsteuer: s((x) => x.vorsteuer), zahllast: s((x) => x.zahllast), elsterZahllast: s((x) => x.elsterZahllast) };
}

/**
 * EÜR 2026 (§ 4 Abs. 3 EStG): Zufluss/Abfluss. Rechnungen mit Zahlung 2026 (Skonto mindert den Zufluss); 13b-Umsätze in
 * der Zeile „… für die der Leistungsempfänger die Umsatzsteuer nach § 13b UStG schuldet“, Nullsteuersatz-Umsätze als
 * umsatzsteuerpflichtig (0 %); Belege nach Zahltag; gezahlte USt (Q4/2025 + Q1–Q3/2026 laut ELSTER); AfA.
 */
export function euerUnabhaengig() {
  const bezahlt = vorgaenge().filter((x) => x.bezahlt?.startsWith(`${JAHR}-`));
  const skonto = (x: Vorgang) => (x.art === "rechnung" ? skontoVon(x.r) : { netto: 0, ust: 0, brutto: 0 });
  const netto = (x: Vorgang) => x.vz * x.s.netto - skonto(x).netto;
  const reNetto = sum(bezahlt.map(netto));
  const reUst = sum(bezahlt.map((x) => x.vz * x.s.ust - skonto(x).ust));
  const re13b = sum(bezahlt.filter((x) => x.steuerart === "reverse_charge").map(netto));
  const reNull = sum(bezahlt.filter((x) => x.steuerart === "nullsatz").map(netto));
  const skontoSumme = sum(bezahlt.map((x) => skonto(x).brutto));
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
  const imJahrQ = quartale.filter((q) => UST_ZAHLTAGE[q.q]!.startsWith(`${JAHR}-`));
  /** gezahlte Vorauszahlungen (Ausgabe) und Erstattungen (Einnahme, Zeile „Vom Finanzamt erstattete … Umsatzsteuer“) */
  const ustGezahlt = UST_Q4_2025.betrag + sum(imJahrQ.filter((q) => q.elsterZahllast > 0).map((q) => q.elsterZahllast));
  const ustErstattet = -sum(imJahrQ.filter((q) => q.elsterZahllast < 0).map((q) => q.elsterZahllast));
  const ausgabenBelege = sum(Object.values(nachKategorie).map((k) => k.betrag));
  const einnahmen = reNetto + reUst + ustErstattet;
  const ausgaben = ausgabenBelege + vorsteuer + ustGezahlt;
  return {
    reNetto, reUst, re13b, reNull, rePflichtig: reNetto - re13b, skontoSumme, reAnzahl: bezahlt.length, nachKategorie, vorsteuer, afa, ustGezahlt, ustErstattet, ausgabenBelege,
    einnahmen, ausgaben, ergebnis: einnahmen - ausgaben - afa, belegeImJahr: imJahr.length,
  };
}

/** Fälligkeit nach Zahlungsziel (eigene Rechnung, ohne App) */
export function faellig(r: Rechnung): string {
  if (r.ziel === "sofort") return r.datum;
  const d = new Date(`${r.datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(r.ziel));
  return d.toISOString().slice(0, 10);
}
