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
   */
  steuerschuld?: Steuerschuld | null;
  /**
   * R12: bei der Zahlung abgezogenes Skonto (brutto, in Cent) – eine Minderung des Entgelts (§ 17 Abs. 1 Satz 2 UStG):
   * Die Vorsteuer mindert sich im Zeitraum der Zahlung, die Betriebsausgabe ist der gezahlte Betrag.
   */
  skonto_cent?: number | null;
}

export type Steuerschuld = "bau" | "eu";
export const STEUERSCHULD_ARTEN: { wert: Steuerschuld; text: string }[] = [
  { wert: "eu", text: "Dienstleistung aus dem EU-Ausland" },
  { wert: "bau", text: "Bauleistung aus Deutschland" },
];

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
  steuerschuld?: Steuerschuld | null;
  skonto_cent?: number | null;
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
  // Eigene Konten sind nicht sicher bekannt – vorerst die Konten von „Sonstiges“ (PRUEFLISTE).
  { id: "homeoffice", titel: "Homeoffice-Pauschale bzw. Arbeitszimmer", kurz: "Homeoffice", euer: "Aufwendungen für ein häusliches Arbeitszimmer", skr03: konto("4900"), skr04: konto("6300"), hinweis: "Tagespauschale 6 € je Tag, höchstens 1.260 € im Jahr (§ 4 Abs. 5 Satz 1 Nr. 6c EStG) – als Eigenbeleg, ohne Vorsteuer" },
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

export function belegSummen(b: Pick<Beleg, "steuer" | "vorsteuer"> & { steuerschuld?: Steuerschuld | null }): BelegSummen {
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
  return { brutto_cent: brutto, netto_cent: netto, ust_cent: ust, vorsteuer_cent: b.vorsteuer ? ust : 0 };
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

/**
 * Laufende Amtlos-Belegnummer je Jahr des Belegdatums, z. B. „B2026-017“ – abgeleitet, nicht gespeichert. Gezählt wird
 * in der Reihenfolge der Erfassung (erstellt, dann Belegdatum, dann ID): so verschiebt ein nachträglich erfasster Beleg
 * mit früherem Datum die Nummern der schon weitergegebenen Belege nicht (nur Löschen verschiebt sie).
 */
export function belegNummern(belege: Pick<Beleg, "id" | "datum" | "erstellt">[]): Map<string, string> {
  const sortiert = [...belege].sort((a, b) => a.erstellt.localeCompare(b.erstellt) || a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
  const zaehler = new Map<string, number>();
  const aus = new Map<string, string>();
  for (const b of sortiert) {
    const jahr = b.datum.slice(0, 4);
    const n = (zaehler.get(jahr) ?? 0) + 1;
    zaehler.set(jahr, n);
    aus.set(b.id, `B${jahr}-${String(n).padStart(3, "0")}`);
  }
  return aus;
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
    if (b.vorsteuer && b.skonto_cent && tag >= von && tag <= bis) skonto -= belegSkonto(b).reduce((a, x) => a + x.ust_cent, 0);
    if (b.datum < von || b.datum > bis) continue;
    const s = belegSummen(b);
    if (b.vorsteuer && s.ust_cent) {
      cent += s.ust_cent;
      anzahl++;
    } else if (s.ust_cent) ohne++;
  }
  return { cent: cent + skonto, anzahl, ohne, skonto_cent: skonto };
}

/** Steuersatz einer § 13b-Eingangsleistung: der erfasste Satz, bei 0 % der Regelsatz 19 %. */
const satz13b = (satz: number) => (satz > 0 ? satz : 19);

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
  anzahl: number;
}

/**
 * § 13b-Eingangsleistungen eines Zeitraums nach Belegdatum (vereinfachend wie die Vorsteuer – die Steuer entsteht bei
 * § 13b Abs. 1 mit Ablauf des Monats der Leistung, bei Abs. 2 mit der Rechnung, spätestens einen Monat danach; PRUEFLISTE).
 * Die Steuer schulden auch Kleinunternehmer (§ 13b Abs. 8 UStG); Vorsteuer (Kz 67) nur mit Vorsteuerabzug.
 */
export function steuerschuldFuer(belege: Beleg[], von: string, bis: string): SteuerschuldSummen {
  const r: SteuerschuldSummen = { eu_netto_cent: 0, eu_steuer_cent: 0, bau_netto_cent: 0, bau_steuer_cent: 0, vorsteuer_cent: 0, anzahl: 0 };
  for (const b of belege) {
    if (b.ungueltig || !b.steuerschuld || b.datum < von || b.datum > bis) continue;
    const netto = b.steuer.reduce((a, s) => a + s.brutto_cent, 0);
    const steuer = steuerschuldBetrag(b);
    if (b.steuerschuld === "eu") {
      r.eu_netto_cent += netto;
      r.eu_steuer_cent += steuer;
    } else {
      r.bau_netto_cent += netto;
      r.bau_steuer_cent += steuer;
    }
    if (b.vorsteuer) r.vorsteuer_cent += steuer;
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
    const skNetto = sk.reduce((a, x) => a + x.netto_cent, 0);
    const skUst = sk.reduce((a, x) => a + x.ust_cent, 0);
    vorsteuer += s.vorsteuer_cent - (b.vorsteuer ? skUst : 0);
    if (k.anlage) {
      anlagen.push(b);
      continue;
    }
    // ohne Vorsteuerabzug ist der Bruttobetrag die Betriebsausgabe
    const betrag = b.vorsteuer ? s.netto_cent - skNetto : s.brutto_cent - skNetto - skUst;
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
  };
}

/** Skonto eines Belegs: ganze Cent größer 0, sonst nichts */
const skontoAusRoh = (w: unknown): number | null => (typeof w === "number" && Number.isInteger(w) && w > 0 ? w : null);

const steuerschuldAus = (w: unknown): Steuerschuld | null => (w === "bau" || w === "eu" ? w : null);

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
  };
}

/** Inhalt eines Belegs als frühere Fassung (für das Änderungsprotokoll). */
export function belegFassung(b: Beleg, bis: string): BelegFassung {
  return { bis, datum: b.datum, lieferant: b.lieferant, nummer: b.nummer ?? null, kategorie: b.kategorie, steuer: b.steuer.map((x) => ({ ...x })), vorsteuer: b.vorsteuer, zahlung: b.zahlung, bezahlt: b.bezahlt ?? null, notiz: b.notiz ?? null, datei: b.datei ?? null, ...(b.steuerschuld ? { steuerschuld: b.steuerschuld } : {}), ...(b.skonto_cent ? { skonto_cent: b.skonto_cent } : {}) };
}

/** Hat sich der Inhalt (nicht nur der Zeitstempel) eines Belegs geändert? */
export const belegInhaltGeaendert = (a: Beleg, b: Beleg) => JSON.stringify(belegFassung(a, "")) !== JSON.stringify(belegFassung(b, ""));
