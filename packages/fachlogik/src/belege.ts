/**
 * Belege und Ausgaben (E-133): reine Funktionen ohne Gerät. Ein Beleg ist eine Eingangsrechnung, ein Kassenbon oder
 * ein Eigenbeleg – mit Bruttobetrag je Steuersatz, Kategorie (Zeile der Anlage EÜR, Konto SKR03/SKR04) und dem Tag der
 * Zahlung (Abfluss, § 11 Abs. 2 EStG). Daraus entstehen die Vorsteuer der Umsatzsteuer-Voranmeldung (Kz 66) und die
 * Betriebsausgaben der EÜR. Fachlich zu prüfen: PRUEFLISTE T-79.
 */
import { umschreiben } from "./dateinamen.js";
import { rundeCent } from "./rechnung.js";
import { minderungNachSatz, type SatzBetrag } from "./skonto.js";

export type Zahlungsweg = "bank" | "bar" | "privat";
export type BelegQuelle = "hand" | "foto" | "erechnung";

/** Bruttobetrag je Steuersatz – ein Beleg kann mehrere Sätze haben (Restaurant: Speisen 7 %, Getränke 19 %). */
export interface BelegSteuer {
  /** Steuersatz in Prozent: 19, 7 oder 0 */
  satz: number;
  brutto_cent: number;
}

export interface Beleg {
  id: string;
  /** Belegdatum (Rechnungsdatum des Lieferanten), ISO */
  datum: string;
  lieferant: string;
  /** Rechnungs- oder Belegnummer des Lieferanten */
  nummer?: string | null;
  kategorie: string;
  steuer: BelegSteuer[];
  /** Vorsteuer abziehbar (ordnungsgemäße Rechnung mit Steuerausweis liegt vor, § 15 Abs. 1 UStG) */
  vorsteuer: boolean;
  zahlung: Zahlungsweg;
  /** Tag der Zahlung (ISO). Ohne Angabe gilt das Belegdatum. */
  bezahlt?: string | null;
  notiz?: string | null;
  /** Dateiname des Fotos oder der E-Rechnung im Ordner der App */
  datei?: string | null;
  quelle?: BelegQuelle;
  erstellt: string;
  geaendert: string;
  /**
   * Als ungültig markiert (ISO): Innerhalb der Aufbewahrungsfrist wird ein Beleg nicht gelöscht, sondern mit Grund
   * ungültig gesetzt – Datensatz und Datei bleiben erhalten, er zählt aber nirgends mehr mit (GoBD).
   */
  ungueltig?: string | null;
  ungueltig_grund?: string | null;
  /** frühere Fassungen (älteste zuerst) – Änderungen an einem Beleg werden protokolliert, nicht überschrieben */
  historie?: BelegFassung[];
  /**
   * Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG, R10): Der Betrieb schuldet die Umsatzsteuer auf diese
   * Eingangsleistung selbst. „bau“: Bauleistung eines im Inland ansässigen Unternehmers (§ 13b Abs. 2 Nr. 4, Abs. 5
   * Satz 2 UStG); „eu“: sonstige Leistung eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers (§ 13b Abs. 1
   * UStG). Die Beträge in `steuer` sind dann die Rechnungsbeträge ohne Umsatzsteuer (Bemessungsgrundlage).
   * E-222: „ige“ – innergemeinschaftlicher Erwerb (§ 1 Abs. 1 Nr. 5, § 1a UStG): Waren von einem Unternehmer aus einem
   * anderen EU-Land, der steuerfrei liefert; der Betrieb schuldet die Erwerbsteuer (§ 13a Abs. 1 Nr. 2 UStG, Kz 89/93) und
   * zieht sie mit Vorsteuerabzug als Vorsteuer ab (§ 15 Abs. 1 Satz 1 Nr. 3 UStG, Kz 61) – kein Fall des § 13b, aber
   * gleich erfasst (Beträge ohne Umsatzsteuer, Steuer selbst angemeldet).
   */
  steuerschuld?: Steuerschuld | null;
  /**
   * R12: bei der Zahlung abgezogenes Skonto (brutto, in Cent) – eine Minderung des Entgelts (§ 17 Abs. 1 Satz 2 UStG):
   * Die Vorsteuer mindert sich im Zeitraum der Zahlung, die Betriebsausgabe ist der gezahlte Betrag.
   */
  skonto_cent?: number | null;
  /**
   * R12 GoBD: Amtlos-Belegnummer („B2026-017“), beim Erfassen vergeben und dauerhaft gespeichert – sie ändert sich
   * nicht, wenn ein anderer Beleg gelöscht wird oder sich das Belegdatum ändert.
   */
  nr?: string | null;
  /**
   * R12 GoBD: festgeschrieben (ISO) – sobald der Beleg in einem Steuerberater-Paket oder einer abgegebenen
   * Voranmeldung steckt. Danach nur noch mit Grund änderbar (die vorige Fassung bleibt in `historie`), nie löschbar.
   */
  festgeschrieben?: string | null;
  /**
   * StB-Prüfung (B-10): Art des Anlageguts bei der Kategorie „Anschaffung über 800 €“ – bestimmt das Anlagenkonto
   * (Maschinen, Betriebs- und Geschäftsausstattung, Fahrzeug, Software). Ohne Angabe: Betriebs- und Geschäftsausstattung.
   */
  anlage_art?: AnlageArt | null;
  /**
   * StB-Prüfung (5.2, E-165): Vorsteuer nur teilweise abziehbar (§ 15 Abs. 4 UStG) – abziehbarer Anteil in Prozent
   * (größer 0, kleiner 100, höchstens zwei Nachkommastellen), z. B. für gemischt genutzte Eingangsleistungen einer Praxis
   * mit steuerfreien Heilbehandlungen (§ 4 Nr. 14 UStG) und steuerpflichtigen Umsätzen. Gilt nur mit `vorsteuer`.
   */
  vorsteuer_anteil?: number | null;
  /**
   * Alternative zu `vorsteuer_anteil`: abziehbare Vorsteuer als Betrag in Cent (größer 0, kleiner als die Steuer des
   * Belegs). Bei mehreren Steuersätzen nach der Steuer je Satz verteilt. Ist beides gesetzt, gilt der Betrag.
   */
  vorsteuer_betrag_cent?: number | null;
  /** E-165 (Personenkonten): USt-IdNr. und Anschrift des Lieferanten, soweit bekannt (aus der E-Rechnung) */
  lieferant_ust_idnr?: string | null;
  lieferant_anschrift?: string | null;
  /**
   * E-214 (Steuerberater 26.10.2026, GoBD): Kennung des Geräts, auf dem der geltende Inhalt festgeschrieben bzw.
   * zuletzt nach der Festschreibung korrigiert wurde – gehört nicht zum Inhalt.
   */
  geraet?: string | null;
  /**
   * E-214: Eingang des geltenden Inhalts beim Synchronisationsserver (`BelegEingang`) – entscheidet bei zwei
   * verschiedenen Korrekturen desselben festgeschriebenen Belegs, welche zuletzt kam. Gehört nicht zum Inhalt.
   */
  eingang?: BelegEingang | null;
  /** E-221: Rechnung in fremder Währung – Originalwährung, -beträge und eingetragener Kurs (gehört zum Inhalt) */
  fremd?: BelegFremd | null;
}

/**
 * E-214: Eingang beim Synchronisationsserver. Der Server sieht nur Chiffretext; er zählt jeden gespeicherten Stand
 * (Versionszähler, nur die nächste Version wird angenommen) und vermerkt den Zeitpunkt. `seit`: Einrichtung der
 * Synchronisation auf dem Server (ein neu eingerichteter Tresor zählt wieder ab 1), `version`: Version, mit der der
 * Inhalt zuerst beim Server einging, `zeit`: Serverzeit dieser Version (wird nach dem Hochladen ergänzt),
 * `spaetestens`: nur bekannt, dass der Inhalt spätestens mit dieser Version da war (von einer älteren App hochgeladen).
 */
export interface BelegEingang {
  seit: string;
  version: number;
  zeit?: string;
  spaetestens?: boolean;
}

/** E-214: Eingang lesen – Unlesbares fällt weg. */
export function belegEingangAus(w: unknown): BelegEingang | null {
  if (!w || typeof w !== "object") return null;
  const r = w as Record<string, unknown>;
  if (typeof r.seit !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(r.seit) || typeof r.version !== "number" || !Number.isSafeInteger(r.version) || r.version < 0) return null;
  return { seit: r.seit, version: r.version, ...(typeof r.zeit === "string" && /^\d{4}-\d{2}-\d{2}T/.test(r.zeit) ? { zeit: r.zeit } : {}), ...(r.spaetestens === true ? { spaetestens: true } : {}) };
}

/** E-214: Reihenfolge zweier Eingänge beim Server (negativ: a früher), null wenn einer fehlt. */
export function eingangVergleich(a: BelegEingang | null | undefined, b: BelegEingang | null | undefined): number | null {
  if (!a || !b) return null;
  if (a.seit !== b.seit) return a.seit < b.seit ? -1 : 1;
  return a.version - b.version;
}

/** E-214: Geräte-Kennung lesen (wie die App sie vergibt: Buchstaben, Ziffern, Bindestrich) */
export const geraetAus = (w: unknown): string | null => (typeof w === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(w) ? w : null);

/** StB-Prüfung (B-10): Arten von Anlagegütern mit eigenem Anlagenkonto */
export type AnlageArt = "maschinen" | "bga" | "kfz" | "software";
export const ANLAGE_ARTEN: { wert: AnlageArt; text: string }[] = [
  { wert: "bga", text: "Betriebs- und Geschäftsausstattung (Möbel, Geräte)" },
  { wert: "maschinen", text: "Maschinen" },
  { wert: "kfz", text: "Fahrzeug" },
  { wert: "software", text: "Software" },
];
const anlageArtAus = (w: unknown): AnlageArt | null => (w === "maschinen" || w === "bga" || w === "kfz" || w === "software" ? w : null);

export type Steuerschuld = "bau" | "eu" | "ige";
export const STEUERSCHULD_ARTEN: { wert: Steuerschuld; text: string }[] = [
  { wert: "eu", text: "Dienstleistung aus dem EU-Ausland" },
  { wert: "bau", text: "Bauleistung aus Deutschland" },
  // E-222: innergemeinschaftlicher Erwerb – Waren, nicht § 13b
  { wert: "ige", text: "Waren aus dem EU-Ausland (innergemeinschaftlicher Erwerb)" },
];
/** E-222: Kurztext der Art für Listen (Belegliste, Fragen, LIESMICH). */
export const steuerschuldText = (s: Steuerschuld) => (s === "ige" ? "innergemeinschaftlicher Erwerb" : s === "eu" ? "sonstige Leistung EU" : "Bauleistung Inland");
/** E-222: § 13b-Beleg (Kz 46/47, 84/85, 67) – nicht der innergemeinschaftliche Erwerb. */
export const ist13b = (b: { steuerschuld?: Steuerschuld | null }) => b.steuerschuld === "eu" || b.steuerschuld === "bau";

/**
 * E-221: Eingangsrechnung in fremder Währung (BT-5 ≠ EUR). Der Beleg rechnet nur in Euro (`steuer`); hier stehen
 * Originalwährung und -beträge, damit die Umrechnung nachvollziehbar bleibt. Die App ruft keine Kurse ab: Den Euro-Betrag
 * bzw. den Kurs trägt der Betrieb ein (§ 16 Abs. 6 UStG: Durchschnittskurs, den das BMF für den Monat bekannt gibt; der
 * Tageskurs nur mit Gestattung des Finanzamts).
 */
export interface BelegFremd {
  /** Währung der Rechnung (ISO 4217, z. B. „USD“) */
  waehrung: string;
  /** Beträge je Steuersatz in der Rechnungswährung (in Hundertsteln), wie `steuer` aufgebaut */
  steuer: BelegSteuer[];
  /** ausgewiesene Umsatzsteuer in der Rechnungswährung (Hundertstel) */
  ust?: number | null;
  /** Umsatzsteuer in Euro laut Rechnung (BT-111 bei Steuerwährung EUR, BT-6) */
  ust_eur_cent?: number | null;
  /** eingetragener Umrechnungskurs: 1 € = `kurs` Einheiten der Rechnungswährung */
  kurs?: number | null;
  /** Tag bzw. Monat, für den der Kurs gilt (ISO-Tag) */
  kurs_datum?: string | null;
}

const WAEHRUNG = /^[A-Z]{3}$/;
/** E-221: Kurs aus dem Stand – größer 0, höchstens sechs Nachkommastellen. */
export const kursGueltig = (w: unknown): w is number => typeof w === "number" && Number.isFinite(w) && w > 0 && w < 1e7 && Math.abs(Math.round(w * 1e6) - w * 1e6) < 1e-6;

/** E-221: Fremdwährung eines Belegs lesen – Unlesbares fällt weg (dann kein Feld). */
export function fremdAus(w: unknown): BelegFremd | null {
  if (!w || typeof w !== "object") return null;
  const r = w as Record<string, unknown>;
  if (typeof r.waehrung !== "string" || !WAEHRUNG.test(r.waehrung) || r.waehrung === "EUR" || !Array.isArray(r.steuer)) return null;
  const steuer = (r.steuer as unknown[])
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
    .map((x) => ({ satz: Number(x.satz), brutto_cent: Number(x.brutto_cent) }))
    .filter((x) => Number.isInteger(x.brutto_cent) && Number.isFinite(x.satz) && x.satz >= 0 && x.satz < 100);
  if (!steuer.length) return null;
  const ganz = (x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : null);
  return {
    waehrung: r.waehrung,
    steuer,
    ...(ganz(r.ust) !== null ? { ust: ganz(r.ust) } : {}),
    ...(ganz(r.ust_eur_cent) !== null ? { ust_eur_cent: ganz(r.ust_eur_cent) } : {}),
    ...(kursGueltig(r.kurs) ? { kurs: r.kurs } : {}),
    ...(typeof r.kurs_datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.kurs_datum) ? { kurs_datum: r.kurs_datum } : {}),
  };
}

/** Eine frühere Fassung eines Belegs: Inhalt, wie er bis `bis` galt. */
export interface BelegFassung {
  /** galt bis zu diesem Zeitpunkt (ISO) */
  bis: string;
  datum: string;
  lieferant: string;
  nummer?: string | null;
  kategorie: string;
  steuer: BelegSteuer[];
  vorsteuer: boolean;
  zahlung: Zahlungsweg;
  bezahlt?: string | null;
  notiz?: string | null;
  datei?: string | null;
  /** E-221: Fremdwährung (wie am Beleg) */
  fremd?: BelegFremd | null;
  steuerschuld?: Steuerschuld | null;
  skonto_cent?: number | null;
  anlage_art?: AnlageArt | null;
  vorsteuer_anteil?: number | null;
  vorsteuer_betrag_cent?: number | null;
  /** R12 GoBD: Grund, mit dem diese Fassung nach der Festschreibung ersetzt wurde */
  grund?: string | null;
  /** E-214: Gerät und Eingang beim Server dieser Fassung (wie am Beleg) */
  geraet?: string | null;
  eingang?: BelegEingang | null;
  /**
   * E-214: bei der Zusammenführung nicht übernommene Korrektur (`grund` = Konfliktgrund): nach welcher Regel die andere
   * gilt – „eingang“: später beim Server eingegangen; „geraetezeit“: ohne Eingang beim Server (Sicherung, Datei), nach
   * der Uhr der Geräte zuletzt geändert –, Zeitpunkt, Gerät und Eingang der geltenden Fassung und der Grund, mit dem
   * diese (nicht übernommene) Korrektur gemacht wurde.
   */
  vorrang?: "eingang" | "geraetezeit";
  gegen_geaendert?: string;
  gegen_geraet?: string | null;
  gegen_eingang?: BelegEingang | null;
  korrektur_grund?: string | null;
}

/**
 * Erlaubter Dateiname einer Belegdatei (Name aus der App: Zufallskennung und Endung). Alles andere – Pfade wie
 * „../x“, Schrägstriche, sehr lange Namen – kommt nie in den Stand, damit ein präparierter Stand aus Sync oder
 * Sicherung keine Dateien außerhalb des Belegordners schreibt oder löscht.
 */
export const istBelegDateiname = (name: unknown): name is string => typeof name === "string" && /^[A-Za-z0-9_-]{4,64}\.[a-z0-9]{1,8}$/.test(name);

/** Steuersätze, die in Belegen vorkommen dürfen – 16 % und 5 % galten im 2. Halbjahr 2020 und liegen noch in der Frist. */
export const BELEG_SAETZE_ERLAUBT = [19, 16, 7, 5, 0] as const;

export interface Kategorie {
  id: string;
  /** in Alltagssprache */
  titel: string;
  /** Kurzbezeichnung für Buchungstexte, höchstens 15 Zeichen */
  kurz: string;
  /** Zeile der Anlage EÜR (Wortlaut) – fachlich zu prüfen */
  euer: string;
  /** Standardkonten je Steuersatz (Automatikkonten mit Vorsteuer) – fachlich zu prüfen */
  skr03: Record<number, string>;
  skr04: Record<number, string>;
  hinweis?: string;
  /** keine sofortige Betriebsausgabe (Anlagevermögen, Abschreibung) */
  anlage?: boolean;
  /** nur zum Teil abziehbar (Anteil in Prozent) */
  abziehbar?: number;
}

const konto = (k: string) => ({ 19: k, 7: k, 0: k });

/** Kategorien in Alltagssprache mit Zuordnung zur Anlage EÜR und Standardkonten (T-79). */
export const KATEGORIEN: Kategorie[] = [
  { id: "waren", titel: "Waren und Material", kurz: "Wareneinkauf", euer: "Waren, Rohstoffe und Hilfsstoffe einschließlich der Nebenkosten", skr03: { 19: "3400", 7: "3300", 0: "3200" }, skr04: { 19: "5400", 7: "5300", 0: "5200" } },
  { id: "fremdleistungen", titel: "Fremdleistungen", kurz: "Fremdleistung", euer: "Bezogene Leistungen", skr03: konto("3100"), skr04: konto("5900") },
  { id: "personal", titel: "Personal (Löhne, Gehälter, Sozialabgaben)", kurz: "Personal", euer: "Ausgaben für eigenes Personal", skr03: konto("4120"), skr04: konto("6020"), hinweis: "ohne Vorsteuer" },
  { id: "miete", titel: "Miete und Nebenkosten", kurz: "Miete", euer: "Miete/Pacht für Geschäftsräume und betrieblich genutzte Grundstücke", skr03: konto("4210"), skr04: konto("6310"), hinweis: "Strom, Gas und Wasser vom Versorger: Kategorie „Energie“" },
  // R10: Strom, Gas und Wasser nicht auf Miete (Steuerberatung) – eigene Kategorie, in der EÜR nicht in der Mietzeile
  { id: "energie", titel: "Energie (Strom, Gas, Wasser)", kurz: "Energie", euer: "Sonstige Aufwendungen für betrieblich genutzte Grundstücke", skr03: konto("4240"), skr04: konto("6325") },
  { id: "buero", titel: "Büro, Porto, Telefon, Software", kurz: "Büro/Telefon", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4930"), skr04: konto("6815") },
  { id: "werbung", titel: "Werbung", kurz: "Werbung", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4600"), skr04: konto("6600") },
  { id: "reise", titel: "Reisekosten", kurz: "Reisekosten", euer: "Übernachtungs- und Reisenebenkosten bei Geschäftsreisen", skr03: konto("4670"), skr04: konto("6670") },
  { id: "bewirtung", titel: "Bewirtung", kurz: "Bewirtung", euer: "Bewirtungsaufwendungen", skr03: konto("4650"), skr04: konto("6640"), abziehbar: 70, hinweis: "70 % abziehbar (§ 4 Abs. 5 Nr. 2 EStG), Bewirtungsbeleg mit Anlass und Teilnehmern" },
  { id: "geschenke", titel: "Geschenke", kurz: "Geschenke", euer: "Geschenke", skr03: konto("4630"), skr04: konto("6610"), hinweis: "bis 50 € je Person und Jahr abziehbar (§ 4 Abs. 5 Nr. 1 EStG)" },
  { id: "fahrzeug", titel: "Fahrzeug (Kraftstoff, Reparatur, Wartung)", kurz: "Kfz", euer: "Kraftfahrzeugkosten und andere Fahrtkosten", skr03: konto("4530"), skr04: konto("6530"), hinweis: "Kfz-Steuer und Kfz-Versicherung: eigene Kategorien" },
  { id: "kfz_steuer", titel: "Kfz-Steuer", kurz: "Kfz-Steuer", euer: "Kraftfahrzeugkosten und andere Fahrtkosten", skr03: konto("4510"), skr04: konto("7685"), hinweis: "ohne Vorsteuer" },
  { id: "kfz_versicherung", titel: "Kfz-Versicherung", kurz: "Kfz-Versich.", euer: "Kraftfahrzeugkosten und andere Fahrtkosten", skr03: konto("4520"), skr04: konto("6520"), hinweis: "ohne Vorsteuer" },
  { id: "versicherungen", titel: "Versicherungen und Beiträge", kurz: "Versicherung", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4360"), skr04: konto("6400"), hinweis: "meist ohne Vorsteuer" },
  { id: "beratung", titel: "Steuerberatung, Rechtsberatung, Buchführung", kurz: "Beratung", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4950"), skr04: konto("6825") },
  { id: "fortbildung", titel: "Fortbildung", kurz: "Fortbildung", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4945"), skr04: konto("6821") },
  { id: "gwg", titel: "Geräte und Ausstattung bis 800 € netto", kurz: "GWG", euer: "Aufwendungen für geringwertige Wirtschaftsgüter nach § 6 Absatz 2 EStG", skr03: konto("4855"), skr04: konto("6260"), hinweis: "sofort abziehbar (§ 6 Abs. 2 EStG)" },
  { id: "anlage", titel: "Anschaffung über 800 € netto (wird abgeschrieben)", kurz: "Anlagegut", euer: "AfA auf unbewegliche Wirtschaftsgüter / bewegliche Wirtschaftsgüter / immaterielle Wirtschaftsgüter", skr03: konto("0420"), skr04: konto("0650"), anlage: true, hinweis: "keine sofortige Betriebsausgabe – Abschreibung über die Nutzungsdauer" },
  // R10: Tagespauschale (§ 4 Abs. 5 Satz 1 Nr. 6c EStG) bzw. Arbeitszimmer – eigene Zeile der Anlage EÜR; Eigenbeleg ohne Vorsteuer.
  // StB-Prüfung (B-11): SKR03 4288 / SKR04 6348 „Aufwendungen für ein häusliches Arbeitszimmer“ („Nummer in Rewe prüfen“) –
  // statt der Konten von „Sonstiges“; über die Kontenvorgaben der Kanzlei änderbar.
  { id: "homeoffice", titel: "Homeoffice-Pauschale bzw. Arbeitszimmer", kurz: "Homeoffice", euer: "Aufwendungen für ein häusliches Arbeitszimmer", skr03: konto("4288"), skr04: konto("6348"), hinweis: "Tagespauschale 6 € je Tag, höchstens 1.260 € im Jahr (§ 4 Abs. 5 Satz 1 Nr. 6c EStG) – als Eigenbeleg, ohne Vorsteuer" },
  { id: "sonstiges", titel: "Sonstiges", kurz: "Sonstiges", euer: "Übrige unbeschränkt abziehbare Betriebsausgaben", skr03: konto("4900"), skr04: konto("6300") },
];

export const kategorieFuer = (id: string): Kategorie => KATEGORIEN.find((k) => k.id === id) ?? KATEGORIEN[KATEGORIEN.length - 1]!;

export const ZAHLUNGSWEGE: { wert: Zahlungsweg; text: string }[] = [
  { wert: "bank", text: "Überweisung oder Karte" },
  { wert: "bar", text: "Bar" },
  { wert: "privat", text: "Privat bezahlt (Einlage)" },
];

export const STEUERSAETZE = [19, 7, 0] as const;

/** Netto und Umsatzsteuer aus einem Bruttobetrag (kaufmännisch gerundet). */
export function ausBrutto(brutto_cent: number, satz: number): { netto_cent: number; ust_cent: number } {
  const netto = rundeCent((brutto_cent * 100) / (100 + satz));
  return { netto_cent: netto, ust_cent: brutto_cent - netto };
}

export interface BelegSummen {
  brutto_cent: number;
  netto_cent: number;
  /** ausgewiesene Umsatzsteuer – als Vorsteuer nur zählbar, wenn `vorsteuer` gesetzt ist */
  ust_cent: number;
  vorsteuer_cent: number;
}

export function belegSummen(b: Pick<Beleg, "steuer" | "vorsteuer"> & Partial<Pick<Beleg, "vorsteuer_anteil" | "vorsteuer_betrag_cent">> & { steuerschuld?: Steuerschuld | null }): BelegSummen {
  // § 13b: die Rechnung weist keine Umsatzsteuer aus – der Betrag ist netto, die Steuer schuldet der Betrieb (steuerschuldFuer)
  if (b.steuerschuld) {
    const n = b.steuer.reduce((a, s) => a + s.brutto_cent, 0);
    return { brutto_cent: n, netto_cent: n, ust_cent: 0, vorsteuer_cent: 0 };
  }
  let brutto = 0;
  let netto = 0;
  let ust = 0;
  for (const s of b.steuer) {
    const a = ausBrutto(s.brutto_cent, s.satz);
    brutto += s.brutto_cent;
    netto += a.netto_cent;
    ust += a.ust_cent;
  }
  // E-165: nur der abziehbare Teil zählt als Vorsteuer (Teilabzug nach § 15 Abs. 4 UStG)
  const vorsteuer = b.vorsteuer ? vorsteuerAufteilung(b).reduce((a, x) => a + x.abziehbar_cent, 0) : 0;
  return { brutto_cent: brutto, netto_cent: netto, ust_cent: ust, vorsteuer_cent: vorsteuer };
}

/** Umsatzsteuer eines Belegs je Steuersatz – ausgewiesen bzw. bei § 13b die selbst geschuldete Steuer. */
function steuerJeSatz(b: Pick<Beleg, "steuer"> & { steuerschuld?: Steuerschuld | null }): { satz: number; brutto_cent: number; ust_cent: number }[] {
  return b.steuer.map((s) => ({ satz: s.satz, brutto_cent: s.brutto_cent, ust_cent: b.steuerschuld ? rundeCent((s.brutto_cent * satz13b(s.satz)) / 100) : ausBrutto(s.brutto_cent, s.satz).ust_cent }));
}

/** E-165: Ist am Beleg ein Teilabzug eingetragen (Prozent oder Betrag)? */
export const belegTeilabzug = (b: Partial<Pick<Beleg, "vorsteuer" | "vorsteuer_anteil" | "vorsteuer_betrag_cent">>) => !!b.vorsteuer && (!!b.vorsteuer_betrag_cent || !!b.vorsteuer_anteil);

export interface VorsteuerTeil {
  satz: number;
  /** Umsatzsteuer dieses Satzes (bei § 13b: die selbst geschuldete Steuer) */
  ust_cent: number;
  /** davon als Vorsteuer abziehbar */
  abziehbar_cent: number;
}

/**
 * StB-Prüfung (5.2, E-165): Vorsteuer eines Belegs je Steuersatz mit abziehbarem Teil – ohne Vorsteuerabzug 0, ohne
 * Teilabzug die ganze Steuer, mit Prozentsatz die Steuer × Anteil (kaufmännisch gerundet je Satz), mit Betrag dieser
 * Betrag nach der Steuer je Satz verteilt (Rest auf den Satz mit der höchsten Steuer). Gilt auch für § 13b-Belege
 * (Kz 67 nur anteilig). Die Aufteilung selbst (Schlüssel nach § 15 Abs. 4 UStG) legt die Steuerberatung fest.
 */
export function vorsteuerAufteilung(b: Pick<Beleg, "steuer" | "vorsteuer"> & Partial<Pick<Beleg, "vorsteuer_anteil" | "vorsteuer_betrag_cent">> & { steuerschuld?: Steuerschuld | null }): VorsteuerTeil[] {
  const je = steuerJeSatz(b).filter((x) => x.ust_cent);
  if (!b.vorsteuer) return je.map((x) => ({ satz: x.satz, ust_cent: x.ust_cent, abziehbar_cent: 0 }));
  const gesamt = je.reduce((a, x) => a + x.ust_cent, 0);
  const betrag = b.vorsteuer_betrag_cent && b.vorsteuer_betrag_cent > 0 ? Math.min(b.vorsteuer_betrag_cent, gesamt) : 0;
  if (betrag && gesamt) {
    const teile = je.map((x) => ({ satz: x.satz, ust_cent: x.ust_cent, abziehbar_cent: Math.floor((betrag * x.ust_cent) / gesamt) }));
    const rest = betrag - teile.reduce((a, x) => a + x.abziehbar_cent, 0);
    if (rest && teile.length) teile.reduce((m, x) => (x.ust_cent > m.ust_cent ? x : m), teile[0]!).abziehbar_cent += rest;
    return teile;
  }
  const p = b.vorsteuer_anteil;
  if (p && p > 0 && p < 100) return je.map((x) => ({ satz: x.satz, ust_cent: x.ust_cent, abziehbar_cent: rundeCent((x.ust_cent * p) / 100) }));
  return je.map((x) => ({ satz: x.satz, ust_cent: x.ust_cent, abziehbar_cent: x.ust_cent }));
}

/** Abziehbarer Teil der Vorsteuer eines Satzes als Verhältnis 0…1 (für Skonto und Buchungen). */
export function vorsteuerVerhaeltnis(b: Parameters<typeof vorsteuerAufteilung>[0], satz: number): number {
  const t = vorsteuerAufteilung(b).find((x) => x.satz === satz);
  return t && t.ust_cent ? t.abziehbar_cent / t.ust_cent : b.vorsteuer ? 1 : 0;
}

/** E-165: abziehbarer Teil der Vorsteuer aus einem Skonto (die Minderung trifft Vorsteuer im Verhältnis des Belegs). */
export function belegSkontoAbziehbar(b: Pick<Beleg, "steuer" | "skonto_cent" | "vorsteuer"> & Partial<Pick<Beleg, "vorsteuer_anteil" | "vorsteuer_betrag_cent">> & { steuerschuld?: Steuerschuld | null }): number {
  if (!b.vorsteuer) return 0;
  return belegSkonto(b).reduce((a, x) => a + rundeCent(x.ust_cent * vorsteuerVerhaeltnis(b, x.satz ?? 0)), 0);
}

/**
 * R12: Skonto eines Belegs je Steuersatz (brutto, netto, Steuer) – aufgeteilt nach den Bruttobeträgen. Leer ohne Skonto
 * und bei § 13b-Belegen (dort ändert sich die selbst geschuldete Steuer – nicht abgebildet, PRUEFLISTE).
 */
export function belegSkonto(b: Pick<Beleg, "steuer" | "skonto_cent"> & { steuerschuld?: Steuerschuld | null }): SatzBetrag[] {
  const m = b.skonto_cent ?? 0;
  if (!m || b.steuerschuld) return [];
  return minderungNachSatz(
    m,
    b.steuer.map((s) => {
      const a = ausBrutto(s.brutto_cent, s.satz);
      return { satz: s.satz, netto_cent: a.netto_cent, ust_cent: a.ust_cent };
    }),
  ).filter((x) => x.brutto_cent);
}

/** Tatsächlich gezahlter Betrag eines Belegs (brutto abzüglich Skonto). */
export const belegGezahlt = (b: Pick<Beleg, "steuer" | "skonto_cent" | "vorsteuer"> & { steuerschuld?: Steuerschuld | null }) => belegSummen(b).brutto_cent - (b.steuerschuld ? 0 : (b.skonto_cent ?? 0));

/**
 * Belegnummer des Lieferanten in einer Form, die DATEV (Belegfeld 1), Dateinamen und Listen gleich zeigen: Umlaute
 * umgeschrieben, alles außer Buchstaben und Ziffern zu „-“ zusammengezogen, höchstens 36 Zeichen („LA 01/2026“ →
 * „LA-01-2026“).
 */
export function belegnummerNormal(s: string | null | undefined): string {
  return umschreiben(s ?? "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/, "");
}

/** Form einer Amtlos-Belegnummer: „B2026-017“ */
export const BELEGNUMMER = /^B(\d{4})-(\d{3,6})$/;

/**
 * Amtlos-Belegnummer je Beleg, z. B. „B2026-017“. R12 GoBD: Gespeicherte Nummern (`nr`, beim Erfassen vergeben) gelten
 * unverändert. Nur Belege ohne Nummer (ältere Daten vor der Migration) bekommen eine abgeleitete – je Jahr des
 * Belegdatums nach der höchsten vorhandenen Nummer, in der Reihenfolge der Erfassung (erstellt, Belegdatum, ID).
 */
export function belegNummern(belege: Pick<Beleg, "id" | "datum" | "erstellt" | "nr">[]): Map<string, string> {
  const sortiert = [...belege].sort((a, b) => a.erstellt.localeCompare(b.erstellt) || a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
  const zaehler = new Map<string, number>();
  const aus = new Map<string, string>();
  for (const b of sortiert) {
    const m = b.nr ? BELEGNUMMER.exec(b.nr) : null;
    if (!m) continue;
    aus.set(b.id, b.nr!);
    zaehler.set(m[1]!, Math.max(zaehler.get(m[1]!) ?? 0, Number(m[2])));
  }
  for (const b of sortiert) {
    if (aus.has(b.id)) continue;
    const jahr = b.datum.slice(0, 4);
    const n = (zaehler.get(jahr) ?? 0) + 1;
    zaehler.set(jahr, n);
    aus.set(b.id, `B${jahr}-${String(n).padStart(3, "0")}`);
  }
  return aus;
}

/** Nächste freie Amtlos-Belegnummer für ein Jahr (YYYY) – nach der höchsten vergebenen (auch gelöschter, siehe `vergeben`). */
export function naechsteBelegnummer(belege: readonly Pick<Beleg, "nr">[], jahr: string, vergeben: readonly string[] = []): string {
  let max = 0;
  for (const n of [...belege.map((b) => b.nr ?? ""), ...vergeben]) {
    const m = BELEGNUMMER.exec(n);
    if (m && m[1] === jahr) max = Math.max(max, Number(m[2]));
  }
  return `B${jahr}-${String(max + 1).padStart(3, "0")}`;
}

/** Kennung eines Belegs in DATEV (Belegfeld 1), Belegliste und Dateiname: Nummer des Lieferanten (normalisiert), sonst die Amtlos-Belegnummer. */
export const belegKennung = (b: Pick<Beleg, "nummer">, amtlosNr: string) => belegnummerNormal(b.nummer) || amtlosNr;

/** Tag, nach dem ein Beleg der EÜR zugeordnet wird: Zahlung (Abfluss), sonst Belegdatum. */
export const zahltag = (b: Pick<Beleg, "datum" | "bezahlt">) => b.bezahlt || b.datum;

/**
 * Vorsteuer eines Zeitraums (nach Belegdatum – die Rechnung liegt vor, § 15 Abs. 1 Nr. 1 UStG; T-79). R12: Skonto mindert
 * die Vorsteuer im Zeitraum der Zahlung (§ 17 Abs. 1 Satz 2 UStG) – `skonto_cent` ist diese Minderung (negativ, in `cent` enthalten).
 */
export function vorsteuerFuer(belege: Beleg[], von: string, bis: string): { cent: number; anzahl: number; ohne: number; skonto_cent: number } {
  let cent = 0;
  let anzahl = 0;
  let ohne = 0;
  let skonto = 0;
  for (const b of belege) {
    if (b.ungueltig) continue;
    const tag = zahltag(b);
    // E-165: Skonto mindert nur den abziehbaren Teil der Vorsteuer
    if (b.vorsteuer && b.skonto_cent && tag >= von && tag <= bis) skonto -= belegSkontoAbziehbar(b);
    if (b.datum < von || b.datum > bis) continue;
    const s = belegSummen(b);
    if (b.vorsteuer && s.vorsteuer_cent) {
      cent += s.vorsteuer_cent;
      anzahl++;
    } else if (s.ust_cent) ohne++;
  }
  return { cent: cent + skonto, anzahl, ohne, skonto_cent: skonto };
}

/** Steuersatz einer § 13b-Eingangsleistung (E-222: auch des innergemeinschaftlichen Erwerbs): der erfasste Satz, bei 0 % der Regelsatz 19 %. */
export const satz13b = (satz: number) => (satz > 0 ? satz : 19);

/** Umsatzsteuer, die der Betrieb für eine § 13b-Eingangsleistung schuldet (0 ohne Steuerschuldnerschaft). */
export function steuerschuldBetrag(b: Pick<Beleg, "steuer"> & { steuerschuld?: Steuerschuld | null }): number {
  if (!b.steuerschuld) return 0;
  return b.steuer.reduce((a, s) => a + rundeCent((s.brutto_cent * satz13b(s.satz)) / 100), 0);
}

export interface SteuerschuldSummen {
  /** Kz 46/47: sonstige Leistungen nach § 13b Abs. 1 UStG (EU) – Bemessungsgrundlage und Steuer */
  eu_netto_cent: number;
  eu_steuer_cent: number;
  /** Kz 84/85: andere Leistungen nach § 13b Abs. 2 UStG (hier: Bauleistungen) */
  bau_netto_cent: number;
  bau_steuer_cent: number;
  /** Kz 67: Vorsteuer aus Leistungen nach § 13b UStG (nur bei Vorsteuerabzug) */
  vorsteuer_cent: number;
  /** § 13b-Belege (ohne innergemeinschaftliche Erwerbe) */
  anzahl: number;
  /**
   * E-222: innergemeinschaftliche Erwerbe – Kz 89 (19 %) und Kz 93 (7 %) mit Bemessungsgrundlage und Steuer, Vorsteuer
   * Kz 61 (nur mit Vorsteuerabzug, zum abziehbaren Teil), Zahl der Belege; `ige_andere_cent`: Bemessungsgrundlage zu
   * anderen Sätzen (16 %/5 % aus 2020) – ohne Kennzahl in der Vorlage, nicht übernommen.
   */
  ige_19_netto_cent: number;
  ige_19_steuer_cent: number;
  ige_7_netto_cent: number;
  ige_7_steuer_cent: number;
  ige_vorsteuer_cent: number;
  ige_andere_cent: number;
  ige_anzahl: number;
  /**
   * E-224: Belege ohne Betrag in Euro (0 € – typisch eine Rechnung in fremder Währung, für die noch kein Euro-Betrag bzw. Kurs
   * eingetragen ist, E-221): nicht in den Summen und nicht in `anzahl`/`ige_anzahl`, sondern hier gezählt – § 13b
   * (Kz 46/47, 84/85, 67) bzw. innergemeinschaftlicher Erwerb (Kz 89/93, 61). Die Voranmeldung warnt damit.
   */
  ohne_euro: number;
  ige_ohne_euro: number;
}

/**
 * § 13b-Eingangsleistungen eines Zeitraums nach Belegdatum (vereinfachend wie die Vorsteuer – die Steuer entsteht bei
 * § 13b Abs. 1 mit Ablauf des Monats der Leistung, bei Abs. 2 mit der Rechnung, spätestens einen Monat danach; PRUEFLISTE).
 * Die Steuer schulden auch Kleinunternehmer (§ 13b Abs. 8 UStG); Vorsteuer (Kz 67) nur mit Vorsteuerabzug.
 */
export function steuerschuldFuer(belege: Beleg[], von: string, bis: string): SteuerschuldSummen {
  const r: SteuerschuldSummen = { eu_netto_cent: 0, eu_steuer_cent: 0, bau_netto_cent: 0, bau_steuer_cent: 0, vorsteuer_cent: 0, anzahl: 0, ige_19_netto_cent: 0, ige_19_steuer_cent: 0, ige_7_netto_cent: 0, ige_7_steuer_cent: 0, ige_vorsteuer_cent: 0, ige_andere_cent: 0, ige_anzahl: 0, ohne_euro: 0, ige_ohne_euro: 0 };
  for (const b of belege) {
    if (b.ungueltig || !b.steuerschuld || b.datum < von || b.datum > bis) continue;
    // E-224: ohne Euro-Betrag (fremde Währung ohne Umrechnung, E-221) trägt der Beleg nichts bei – nicht als übernommen zählen
    if (!b.steuer.some((s) => s.brutto_cent)) {
      if (b.steuerschuld === "ige") r.ige_ohne_euro++;
      else r.ohne_euro++;
      continue;
    }
    // E-222: innergemeinschaftlicher Erwerb nach Belegdatum – die Steuer entsteht mit der Rechnung, spätestens mit Ablauf des
    // dem Erwerb folgenden Monats (§ 13 Abs. 1 Nr. 6 UStG; den Tag des Erwerbs kennt der Beleg nicht – Annahme in der Übernahme)
    if (b.steuerschuld === "ige") {
      for (const s of b.steuer) {
        const satz = satz13b(s.satz);
        const steuer = rundeCent((s.brutto_cent * satz) / 100);
        if (satz === 19) {
          r.ige_19_netto_cent += s.brutto_cent;
          r.ige_19_steuer_cent += steuer;
        } else if (satz === 7) {
          r.ige_7_netto_cent += s.brutto_cent;
          r.ige_7_steuer_cent += steuer;
        } else r.ige_andere_cent += s.brutto_cent;
      }
      if (b.vorsteuer) r.ige_vorsteuer_cent += vorsteuerAufteilung(b).filter((x) => satz13b(x.satz) === 19 || satz13b(x.satz) === 7).reduce((a, x) => a + x.abziehbar_cent, 0);
      r.ige_anzahl++;
      continue;
    }
    const netto = b.steuer.reduce((a, s) => a + s.brutto_cent, 0);
    const steuer = steuerschuldBetrag(b);
    if (b.steuerschuld === "eu") {
      r.eu_netto_cent += netto;
      r.eu_steuer_cent += steuer;
    } else {
      r.bau_netto_cent += netto;
      r.bau_steuer_cent += steuer;
    }
    // E-165: Vorsteuer aus § 13b (Kz 67) nur zum abziehbaren Teil
    if (b.vorsteuer) r.vorsteuer_cent += vorsteuerAufteilung(b).reduce((a, x) => a + x.abziehbar_cent, 0);
    r.anzahl++;
  }
  return r;
}

export interface EuerAusgabenZeile {
  kategorie: Kategorie;
  netto_cent: number;
  anzahl: number;
}

/** Betriebsausgaben eines Jahres nach Kategorie – nach Zahltag (§ 11 Abs. 2 EStG), netto; Vorsteuer separat. */
export function ausgabenFuer(belege: Beleg[], jahr: string): { zeilen: EuerAusgabenZeile[]; vorsteuer_cent: number; anlagen: Beleg[]; summe_cent: number } {
  const nach = new Map<string, EuerAusgabenZeile>();
  let vorsteuer = 0;
  const anlagen: Beleg[] = [];
  for (const b of belege) {
    if (b.ungueltig || !zahltag(b).startsWith(`${jahr}-`)) continue;
    const k = kategorieFuer(b.kategorie);
    const s = belegSummen(b);
    // R12: Skonto mindert Ausgabe und Vorsteuer – gezahlt ist der Betrag nach Abzug (§ 11 Abs. 2 EStG)
    const sk = belegSkonto(b);
    const skBrutto = sk.reduce((a, x) => a + x.netto_cent + x.ust_cent, 0);
    // E-165: abziehbarer Teil der Vorsteuer (voll, anteilig oder keiner) – der nicht abziehbare Teil ist Betriebsausgabe
    const skAbziehbar = belegSkontoAbziehbar(b);
    vorsteuer += s.vorsteuer_cent - skAbziehbar;
    if (k.anlage) {
      anlagen.push(b);
      continue;
    }
    // ohne Vorsteuerabzug ist der Bruttobetrag die Betriebsausgabe, mit Teilabzug brutto abzüglich abziehbarer Vorsteuer
    const betrag = s.brutto_cent - skBrutto - (s.vorsteuer_cent - skAbziehbar);
    const z = nach.get(k.id) ?? { kategorie: k, netto_cent: 0, anzahl: 0 };
    z.netto_cent += betrag;
    z.anzahl++;
    nach.set(k.id, z);
  }
  const zeilen = [...nach.values()].sort((a, b) => b.netto_cent - a.netto_cent);
  return { zeilen, vorsteuer_cent: vorsteuer, anlagen, summe_cent: zeilen.reduce((a, z) => a + z.netto_cent, 0) };
}

/** Zeilen der Anlage EÜR für Einnahmen – dieselben Texte wie in den Vorschlägen der Vorlage „EÜR“ */
export const EUER_ZEILE_STEUERPFLICHTIG = "Umsatzsteuerpflichtige Betriebseinnahmen";
export const EUER_ZEILE_STEUERFREI = "Umsatzsteuerfreie, nicht umsatzsteuerbare Betriebseinnahmen sowie Betriebseinnahmen, für die der Leistungsempfänger die Umsatzsteuer nach § 13b UStG schuldet";

export interface Einnahme {
  /** Tag des Zahlungseingangs (Zufluss) */
  tag: string;
  /** Stornos negativ */
  netto_cent: number;
  ust_cent: number;
  /**
   * Anteil von `netto_cent` ohne Umsatzsteuer, weil steuerfrei, nicht steuerbar oder vom Empfänger geschuldet
   * (innergemeinschaftliche Lieferung, Steuerbefreiung, § 13b) – eigene Zeile der Anlage EÜR
   */
  steuerfrei_cent?: number;
  /** Kleinunternehmer: Anteil nicht steuerbarer Umsätze (Leistungsort im Ausland) – „davon“-Zeile der Anlage EÜR */
  nicht_steuerbar_cent?: number;
  kleinunternehmer: boolean;
}

/** EÜR eines Jahres: Einnahmen nach Zufluss (§ 11 Abs. 1 EStG), Ausgaben nach Abfluss; Umsatzsteuer als eigene Zeilen. */
export function euerFuer(einnahmen: Einnahme[], belege: Beleg[], jahr: string) {
  const im = einnahmen.filter((e) => e.tag.startsWith(`${jahr}-`));
  const einnahmen_netto = im.reduce((a, e) => a + e.netto_cent, 0);
  const steuerfrei = im.reduce((a, e) => a + (e.steuerfrei_cent ?? 0), 0);
  const nichtSteuerbar = im.reduce((a, e) => a + (e.nicht_steuerbar_cent ?? 0), 0);
  const ust_vereinnahmt = im.reduce((a, e) => a + e.ust_cent, 0);
  const ausgaben = ausgabenFuer(belege, jahr);
  const summe_einnahmen = einnahmen_netto + ust_vereinnahmt;
  const summe_ausgaben = ausgaben.summe_cent + ausgaben.vorsteuer_cent;
  return {
    einnahmen_netto_cent: einnahmen_netto,
    /** davon steuerfrei / nicht steuerbar / § 13b (in `einnahmen_netto_cent` enthalten) */
    einnahmen_steuerfrei_cent: steuerfrei,
    /** Kleinunternehmer: davon nicht steuerbar (in `einnahmen_netto_cent` enthalten) */
    einnahmen_nicht_steuerbar_cent: nichtSteuerbar,
    ust_vereinnahmt_cent: ust_vereinnahmt,
    summe_einnahmen_cent: summe_einnahmen,
    ausgaben,
    summe_ausgaben_cent: summe_ausgaben,
    ergebnis_cent: summe_einnahmen - summe_ausgaben,
    anzahl_einnahmen: im.length,
  };
}

const steuerAus = (roh: unknown): BelegSteuer[] =>
  Array.isArray(roh)
    ? (roh as unknown[])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .map((x) => ({ satz: Number(x.satz), brutto_cent: Number(x.brutto_cent) }))
        .filter((x) => Number.isInteger(x.brutto_cent) && (BELEG_SAETZE_ERLAUBT as readonly number[]).includes(x.satz))
    : [];
const ZAHLUNGEN = ["bank", "bar", "privat"] as const;
const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

function fassungAus(roh: unknown): BelegFassung | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  if (!s("bis")) return null;
  return {
    bis: s("bis"),
    datum: s("datum"),
    lieferant: s("lieferant"),
    nummer: s("nummer") || null,
    kategorie: s("kategorie"),
    steuer: steuerAus(r.steuer),
    vorsteuer: r.vorsteuer === true,
    zahlung: ZAHLUNGEN.find((z) => z === r.zahlung) ?? "bank",
    bezahlt: s("bezahlt") || null,
    notiz: s("notiz") || null,
    datei: istBelegDateiname(r.datei) ? r.datei : null,
    ...(steuerschuldAus(r.steuerschuld) ? { steuerschuld: steuerschuldAus(r.steuerschuld) } : {}),
    ...(skontoAusRoh(r.skonto_cent) ? { skonto_cent: skontoAusRoh(r.skonto_cent) } : {}),
    ...(anlageArtAus(r.anlage_art) ? { anlage_art: anlageArtAus(r.anlage_art) } : {}),
    ...teilabzugAus(r),
    ...(fremdAus(r.fremd) ? { fremd: fremdAus(r.fremd) } : {}),
    ...(s("grund") ? { grund: s("grund").slice(0, 300) } : {}),
    ...(geraetAus(r.geraet) ? { geraet: geraetAus(r.geraet) } : {}),
    ...(belegEingangAus(r.eingang) ? { eingang: belegEingangAus(r.eingang) } : {}),
    ...(r.vorrang === "eingang" || r.vorrang === "geraetezeit" ? { vorrang: r.vorrang } : {}),
    ...(/^\d{4}-\d{2}-\d{2}T/.test(s("gegen_geaendert")) ? { gegen_geaendert: s("gegen_geaendert") } : {}),
    ...(geraetAus(r.gegen_geraet) ? { gegen_geraet: geraetAus(r.gegen_geraet) } : {}),
    ...(belegEingangAus(r.gegen_eingang) ? { gegen_eingang: belegEingangAus(r.gegen_eingang) } : {}),
    ...(s("korrektur_grund") ? { korrektur_grund: s("korrektur_grund").slice(0, 300) } : {}),
  };
}

/** Skonto eines Belegs: ganze Cent größer 0, sonst nichts */
const skontoAusRoh = (w: unknown): number | null => (typeof w === "number" && Number.isInteger(w) && w > 0 ? w : null);

const steuerschuldAus = (w: unknown): Steuerschuld | null => (w === "bau" || w === "eu" || w === "ige" ? w : null);

/** E-165: Anteil der abziehbaren Vorsteuer in Prozent – größer 0, kleiner 100, auf zwei Nachkommastellen; sonst null. */
export function vorsteuerAnteilAus(w: unknown): number | null {
  const n = typeof w === "string" ? Number(w.replace(",", ".").replace(/[%\s]/g, "")) : typeof w === "number" ? w : NaN;
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return null;
  return Math.round(n * 100) / 100;
}
/** E-165: Teilabzug aus einem gespeicherten Beleg – Betrag (ganze Cent > 0) geht vor Prozent. */
function teilabzugAus(r: Record<string, unknown>): Pick<Beleg, "vorsteuer_anteil" | "vorsteuer_betrag_cent"> {
  const betrag = typeof r.vorsteuer_betrag_cent === "number" && Number.isInteger(r.vorsteuer_betrag_cent) && r.vorsteuer_betrag_cent > 0 ? r.vorsteuer_betrag_cent : null;
  if (betrag) return { vorsteuer_betrag_cent: betrag };
  const p = vorsteuerAnteilAus(r.vorsteuer_anteil);
  return p ? { vorsteuer_anteil: p } : {};
}
const textAus = (w: unknown, n: number) => (typeof w === "string" && w.trim() ? w.trim().slice(0, n) : null);

/**
 * Gespeicherten Beleg prüfen und bereinigen (unbekannte Felder fallen weg); null, wenn Kernangaben fehlen. Wer den
 * Rohsatz trotzdem aufbewahren muss (Aufbewahrungspflicht), reicht ihn bei null unverändert weiter.
 */
export function belegAus(roh: unknown): Beleg | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  if (!s("id") || !ISO_TAG.test(s("datum"))) return null;
  const zahlung = ZAHLUNGEN.find((z) => z === r.zahlung) ?? "bank";
  const quelle = (["hand", "foto", "erechnung"] as const).find((q) => q === r.quelle);
  const historie = Array.isArray(r.historie) ? (r.historie as unknown[]).map(fassungAus).filter((f): f is BelegFassung => f !== null) : [];
  return {
    id: s("id"),
    datum: s("datum"),
    lieferant: s("lieferant"),
    nummer: s("nummer") || null,
    kategorie: kategorieFuer(s("kategorie")).id,
    steuer: steuerAus(r.steuer),
    vorsteuer: r.vorsteuer === true,
    zahlung,
    bezahlt: ISO_TAG.test(s("bezahlt")) ? s("bezahlt") : null,
    notiz: s("notiz") || null,
    // nur Namen, wie die App sie vergibt (G-1) – nie Pfade
    datei: istBelegDateiname(r.datei) ? r.datei : null,
    ...(quelle ? { quelle } : {}),
    erstellt: s("erstellt") || s("datum"),
    geaendert: s("geaendert") || s("erstellt") || s("datum"),
    ...(s("ungueltig") ? { ungueltig: s("ungueltig"), ungueltig_grund: s("ungueltig_grund") || null } : {}),
    ...(historie.length ? { historie } : {}),
    ...(steuerschuldAus(r.steuerschuld) ? { steuerschuld: steuerschuldAus(r.steuerschuld) } : {}),
    ...(skontoAusRoh(r.skonto_cent) ? { skonto_cent: skontoAusRoh(r.skonto_cent) } : {}),
    ...(BELEGNUMMER.test(s("nr")) ? { nr: s("nr") } : {}),
    ...(anlageArtAus(r.anlage_art) ? { anlage_art: anlageArtAus(r.anlage_art) } : {}),
    ...(/^\d{4}-\d{2}-\d{2}T/.test(s("festgeschrieben")) ? { festgeschrieben: s("festgeschrieben") } : {}),
    ...teilabzugAus(r),
    ...(textAus(r.lieferant_ust_idnr, 20) ? { lieferant_ust_idnr: textAus(r.lieferant_ust_idnr, 20) } : {}),
    ...(textAus(r.lieferant_anschrift, 300) ? { lieferant_anschrift: textAus(r.lieferant_anschrift, 300) } : {}),
    ...(geraetAus(r.geraet) ? { geraet: geraetAus(r.geraet) } : {}),
    ...(belegEingangAus(r.eingang) ? { eingang: belegEingangAus(r.eingang) } : {}),
    ...(fremdAus(r.fremd) ? { fremd: fremdAus(r.fremd) } : {}),
  };
}

/** Inhalt eines Belegs als frühere Fassung (für das Änderungsprotokoll); `grund`: warum sie ersetzt wurde (R12 GoBD). */
export function belegFassung(b: Beleg, bis: string, grund?: string): BelegFassung {
  return { ...(grund ? { grund: grund.trim().slice(0, 300) } : {}), bis, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer ?? null, kategorie: b.kategorie, steuer: b.steuer.map((x) => ({ ...x })), vorsteuer: b.vorsteuer, zahlung: b.zahlung, bezahlt: b.bezahlt ?? null, notiz: b.notiz ?? null, datei: b.datei ?? null, ...(b.steuerschuld ? { steuerschuld: b.steuerschuld } : {}), ...(b.skonto_cent ? { skonto_cent: b.skonto_cent } : {}), ...(b.anlage_art ? { anlage_art: b.anlage_art } : {}), ...(b.vorsteuer_betrag_cent ? { vorsteuer_betrag_cent: b.vorsteuer_betrag_cent } : b.vorsteuer_anteil ? { vorsteuer_anteil: b.vorsteuer_anteil } : {}), ...(fremdAus(b.fremd) ? { fremd: fremdAus(b.fremd) } : {}) };
}

/** Hat sich der Inhalt (nicht nur der Zeitstempel) eines Belegs geändert? */
export const belegInhaltGeaendert = (a: Beleg, b: Beleg) => JSON.stringify(belegFassung(a, "")) !== JSON.stringify(belegFassung(b, ""));
