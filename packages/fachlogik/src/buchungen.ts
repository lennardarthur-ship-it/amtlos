/**
 * Buchungen und DATEV-Export (E-133): aus Ausgangsrechnungen und Belegen entstehen einfache Buchungssätze (Forderung an
 * Erlös, Aufwand an Verbindlichkeit/Kasse/Privateinlage). Sie gehen als DATEV-Format „Buchungsstapel“ (EXTF, Version
 * 700, Kategorie 21) an die Steuerberatung oder als lesbare CSV an Menschen und Tabellenprogramme. Reine Funktionen
 * ohne Gerät; die Kodierung nach Windows-1252 liefert `datevExtfBytes`, das Schreiben der Datei ist Sache des Aufrufers.
 *
 * Fachlich zu prüfen – siehe `pruefpunkteBuchungen()` und PRUEFLISTE:
 * - Die Spaltenliste der Buchungszeile (125 Felder der Version 700) hat die Steuerberatungskanzlei (21.10.2026, 3.1)
 *   byteweise gegen das DATEV-Format geprüft: formal konform. Gefüllt werden die Kernfelder 1–14, Beleginfo 1 (stabile
 *   Buchungs-GUID), 36 KOST1, 40 EU-Land u. UStID, 114 Festschreibung (0), 115/116 und 118 Generalumkehr.
 * - Im Dateikopf stehen „Datum vom“ und „Datum bis“ als JJJJMMTT (wie der Wirtschaftsjahresbeginn), nicht als TTMMJJJJ;
 *   Feld 27 trägt den Kontenrahmen („03“/„04“).
 * - Konten und BU-Schlüssel 9/8/40 laut Prüfbericht; endgültig nach dem Testimport (Abschnitt 3.3 des Berichts).
 *
 * R10 (interne Prüfrunde Steuern, PRUEFLISTE T-113): Belege mit Vorsteuer auf Konten ohne Steuerautomatik bekommen BU 9 (19 %) bzw. 8 (7 %); das
 * Erlöskonto richtet sich nach der Steuerart der Rechnung (igL, § 13b Inland, EU-Leistung, Drittland); § 13b-Eingangs-
 * leistungen gehen auf eigene Konten; Gutschriften werden als Aufwand gebucht; Personal-Belege und privat ausgelegte
 * Belege einer Kapitalgesellschaft bleiben aus dem Stapel (nur Belegliste); Leistungsdatum und Datum der Steuerperiode
 * stehen in den Feldern 115/116; Forderungen und Verbindlichkeiten auf Konten ohne Kontokorrent.
 *
 * StB-Prüfung Steuerberatungskanzlei (21.10.2026, Abschnitt 3 und 4):
 * - A-1: Bei Belegen (Eingangsrechnungen, Gutschriften, Kassenfehlbeträgen) steht das Verbindlichkeits-, Kassen-, Bank-
 *   bzw. Privatkonto in Feld 7 „Konto“ (im Haben), das Sachkonto mit BU-Schlüssel in Feld 8 „Gegenkonto“ – der
 *   BU-Schlüssel bezieht sich in DATEV auf das Gegenkonto. Erlös- und Skontobuchungen waren schon so aufgebaut.
 * - 3.1/A-5: Feld 103 „Buchungs GUID“ bleibt leer (wird von DATEV vergeben); die stabile Kennung steht in Beleginfo 1
 *   („Buchungs-GUID“). Feld 114 „Festschreibung“ = 0, solange der Stapel ungeprüft ist. Stornos mit Generalumkehr
 *   (Feld 118 = 1) auf der ursprünglichen Soll/Haben-Seite.
 * - A-2: Kleinunternehmer buchen Wareneingang auf das Konto ohne Vorsteuer (SKR03 3200, SKR04 5200) statt 3400 + BU 40.
 * - A-4/B-6: Bilanzierende Betriebe: Zahlungseingänge Bank an Forderungen (nur mit Kontenvorgabe, Standard aus – Nachtrag
 *   22.10.2026); Kapitalgesellschaften buchen privat
 *   ausgelegte Belege auf das Verrechnungskonto Gesellschafter (SKR03 0731, SKR04 3560 UNSICHER) statt Privateinlage/Geldtransit.
 *   Korrektur der Kanzlei vom 22.10.2026: 0755 (im Bericht vom 21.10.) ist das Konto für offene Ausschüttungen; Standard
 *   SKR03 0731 „Verbindlichkeiten gegenüber Gesellschaftern – Restlaufzeit bis 1 Jahr“. SKR04-Gegenstück zu 0731 laut
 *   Kanzlei folgt (nach dem Testimport) – bis dahin bleibt 3560.
 * - B-2: Nullsteuersatz (§ 12 Abs. 3 UStG) auf ein eigenes Erlöskonto mit Kz-87-Automatik.
 * - B-4/B-9/B-10/B-11: einzelne Konten über die Kontenvorgaben der Kanzlei (kontenvorgaben.ts, `kontenFuer`).
 *
 * E-165 (Abschnitt 10 Prio 3):
 * - A-3 Personenkonten (Kontenvorgabe, Standard aus): Rechnungen, Skonto, Zahlungseingänge und Gutschriften auf dem
 *   Personenkonto des Kunden (`personenkonto`, Debitor 10000–69999 bzw. bei Gutschriften Kreditor) statt Forderungen
 *   bzw. Verbindlichkeiten; Belege per Überweisung/Karte auf dem Kreditor des Lieferanten (`o.kreditoren`). Belegfeld 1
 *   bleibt die Rechnungs- bzw. Belegnummer – damit zieht DATEV die offenen Posten aus (OPOS).
 * - 5.2 Vorsteuer-Teilabzug je Beleg (§ 15 Abs. 4 UStG): ein Beleg mit abziehbarem Anteil wird je Steuersatz in zwei
 *   Zeilen gebucht – der abziehbare Teil brutto mit BU 9/8 (DATEV rechnet daraus genau die abziehbare Vorsteuer), der
 *   nicht abziehbare Teil brutto ohne Steuerschlüssel auf demselben Aufwandskonto (Automatikkonto: BU 40). § 13b-Belege
 *   entsprechend auf die Konten „mit“ bzw. „ohne Vorsteuer“.
 */
import { belegKennung, belegSkonto, belegTeilabzug, igeSteuerTag, kategorieFuer, satz13b, vorsteuerAufteilung, vorsteuerVerhaeltnis, zahltag, type AnlageArt, type Beleg } from "./belege.js";
import { formImNamen } from "./dokumente/betrieb.js";
import type { Kontenvorgaben } from "./kontenvorgaben.js";
import { restGruppen, summen, type Abschlag, type Position } from "./rechnung.js";
import { minderungNachSatz, type SatzBetrag } from "./skonto.js";
import { STEUERART_NULLSATZ, type Steuerart } from "./steuerart.js";
import { MARKE } from "@amtlos/marke";

export type Kontenrahmen = "SKR03" | "SKR04";

export interface Buchung {
  /** Belegdatum (ISO) */
  datum: string;
  /** in Cent, immer positiv – die Seite steht in `soll_haben` */
  betrag_cent: number;
  /** Soll/Haben-Kennzeichen aus Sicht des Kontos in `konto` */
  soll_haben: "S" | "H";
  konto: string;
  gegenkonto: string;
  /** meist leer, weil Automatikkonten die Steuer selbst rechnen */
  bu_schluessel: string;
  /** Rechnungs-/Belegnummer, höchstens 36 Zeichen, nur zulässige Zeichen (siehe `belegfeld1Aus`) */
  belegfeld1: string;
  /** Fälligkeit TTMMJJ (optional) */
  belegfeld2?: string;
  /** höchstens 60 Zeichen */
  buchungstext: string;
  /** Steuersatz in Prozent; null bei Kleinunternehmern */
  ust_satz: number | null;
  /** „umbuchung“ (R12): Geld zwischen Kasse, Geldtransit und Privat – weder Einnahme noch Ausgabe */
  art: "einnahme" | "ausgabe" | "storno" | "umbuchung";
  /** ID der Rechnung oder des Belegs, aus dem die Buchung stammt */
  quelle_id: string;
  /**
   * stabile Kennung der Buchung (36 Zeichen), abgeleitet aus Quelle und Steuersatz. StB-Prüfung 3.1: steht in
   * „Beleginfo - Inhalt 1“ (Art „Buchungs-GUID“), nicht im DATEV-Feld 103 „Buchungs GUID“ (das vergibt DATEV)
   */
  guid?: string;
  /** Leistungsdatum (ISO) – DATEV-Feld „Leistungsdatum“ (115) */
  leistungsdatum?: string | null;
  /** Tag, nach dem die App die Umsatzsteuer dem Zeitraum zuordnet (ISO) – DATEV-Feld „Datum Zuord. Steuerperiode“ (116) */
  steuerperiode?: string | null;
  /** USt-IdNr. des Abnehmers bei innergemeinschaftlichen Lieferungen und EU-Leistungen – „EU-Land u. UStID (Bestimmung)“ */
  eu_ustid?: string | null;
  /** R12: Kostenstelle (KOST1), z. B. Filiale einer Kasse */
  kost1?: string;
  /** OSS: Steuersatz des Bestimmungslands – DATEV-Feld 41 „EU-Steuersatz (Bestimmung)“ (Land in Feld 40) */
  eu_steuersatz?: number | null;
  /**
   * StB-Prüfung 3.1: Storno als Generalumkehr (Feld 118 = 1) – die Buchung steht auf der Soll/Haben-Seite der
   * ursprünglichen Buchung und wird von DATEV umgekehrt; wer Salden rechnet, zählt sie mit umgekehrtem Vorzeichen.
   */
  generalumkehr?: boolean;
}

/** Vorzeichen einer Buchung aus Sicht von Feld 7 „Konto“: Soll +1, Haben −1, mit Generalumkehr umgekehrt. */
export const buchungsVorzeichen = (b: Pick<Buchung, "soll_haben" | "generalumkehr">) => (b.soll_haben === "S" ? 1 : -1) * (b.generalumkehr ? -1 : 1);

/** Was eine Ausgangsrechnung für die Buchung braucht – Teilmenge der gespeicherten Rechnung. */
export interface AusgangsRechnungFuerBuchung {
  id: string;
  nummer: string;
  /** Rechnungsdatum (ISO) */
  datum: string;
  /** Tag des Zahlungseingangs (ISO) – für die Buchung derzeit ohne Bedeutung, siehe Prüfpunkt Ist-Versteuerung */
  bezahlt?: string | null;
  art: "rechnung" | "storno";
  /** bei einem Storno: Nummer der stornierten Rechnung (für den Buchungstext „Storno … zu RE …“) */
  storniert_nummer?: string | null;
  /**
   * Gutschrift (§ 14 Abs. 2 Satz 2 UStG): der Betrieb rechnet als Leistungsempfänger ab – für ihn eine Ausgabe, kein
   * Erlös. Wird nicht als Erlös gebucht; die Ausgabe kommt aus dem Beleg bzw. von der Steuerberatung.
   */
  gutschrift?: boolean;
  kleinunternehmer: boolean;
  kunde: string;
  positionen: Position[];
  /** Grund für 0 % (aus der Rechnung); bestimmt das Erlöskonto */
  steuerart?: Steuerart;
  /** Land des Empfängers (ISO 3166-1 alpha-2) – Inland, übriges Gemeinschaftsgebiet oder Drittland */
  kunde_land?: string | null;
  /** E-208: Hinweis auf die Steuerbefreiung (bei Steuerart „befreit“) – Ausfuhrlieferung (§ 4 Nr. 1 Buchst. a) hat ein eigenes Erlöskonto */
  befreiungsgrund?: string | null;
  kunde_ust_idnr?: string | null;
  /** Leistungsdatum bzw. Ende des Leistungszeitraums (ISO) */
  leistungsdatum?: string | null;
  /** Tag der Zuordnung zur Steuerperiode, wie die Voranmeldung der App ihn verwendet (ISO) */
  steuerperiode?: string | null;
  /** Gutschrift: der Betrieb (Aussteller, Leistungsempfänger) ist Kleinunternehmer – keine Vorsteuer */
  empfaenger_ku?: boolean;
  /**
   * R12 (Ist-Versteuerung mit Teilzahlungen): nur diese Beträge je Steuersatz buchen (brutto) statt der ganzen Rechnung –
   * z. B. eine Zahlung samt Skonto. `guid_zusatz` unterscheidet mehrere Buchungen derselben Rechnung.
   */
  anteil?: SatzBetrag[];
  guid_zusatz?: string;
  /** StB-Prüfung (C-4): Schlussrechnung – abgesetzte Abschläge; gebucht wird nur der Rest je Steuersatz (`restGruppen`) */
  abschlaege?: Abschlag[];
  /**
   * E-218 (T-274): Schlussrechnung über einen EU-Umsatz, deren Anzahlungen nicht auf dem Erlöskonto stehen (Bilanz:
   * erhaltene Anzahlungen; EÜR: Konto ohne Umsatzsteuerfunktion) – gebucht wird das volle Entgelt statt des Rests.
   */
  vollesEntgelt?: boolean;
  /** StB-Prüfung (5.2): OSS – Leistung an eine Privatperson im EU-Ausland mit der Steuer des Bestimmungslands */
  oss?: { land: string; satz: number } | null;
  /**
   * E-165 (A-3): Personenkonto des Kunden (Debitor) bzw. bei Gutschriften des Leistenden (Kreditor) – nur gesetzt, wenn
   * die Kontenvorgabe „Personenkonten“ an ist; sonst die Sammelkonten Forderungen/Verbindlichkeiten.
   */
  personenkonto?: string | null;
}

/**
 * OSS, Feld 40 „EU-Land u. UStID (Bestimmung)“: bei Fernverkäufen und Leistungen an Privatpersonen nur das
 * Länderkennzeichen des Bestimmungslands, keine USt-IdNr. (Nachtrag der Steuerberatungskanzlei vom 22.10.2026).
 * Kennzeichen wie in der USt-IdNr. bzw. im OSS-Verfahren – Griechenland „EL“ statt ISO „GR“.
 */
export const ossLandKennzeichen = (land: string) => {
  const l = land.trim().toUpperCase().slice(0, 2);
  return l === "GR" ? "EL" : l;
};

/** Mitgliedstaaten der EU außer Deutschland (ISO 3166-1; Griechenland als GR) – für Erlöskonten und Hinweise. */
export const EU_LAENDER = ["AT", "BE", "BG", "CY", "CZ", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"] as const;
export const istEuAusland = (land: string | null | undefined) => !!land && (EU_LAENDER as readonly string[]).includes(land.toUpperCase());
/**
 * E-222: USt-IdNr. aus einem anderen EU-Land (Länderpräfix eines Mitgliedstaats außer DE; Griechenland „EL“) – Voraussetzung
 * dafür, dass der Lieferant steuerfrei liefert und beim Betrieb ein innergemeinschaftlicher Erwerb entsteht. Nur die Form,
 * keine Prüfung beim BZSt.
 */
export function ustIdnrEuAusland(idnr: string | null | undefined): boolean {
  const n = (idnr ?? "").replace(/[\s.-]/g, "").toUpperCase();
  const m = /^([A-Z]{2})[0-9A-Z+*]{2,12}$/.exec(n);
  if (!m) return false;
  return istEuAusland(m[1] === "EL" ? "GR" : m[1]!);
}

/**
 * BU-Schlüssel, der die Steuerautomatik eines Automatikkontos aufhebt („keine Steuer“) – gesetzt, wenn ein Beleg keinen
 * Vorsteuerabzug erlaubt, das Kategorie-Konto aber Vorsteuer automatisch ziehen würde. Fachlich zu prüfen.
 */
export const BU_OHNE_STEUER = "40";
/** BU-Schlüssel für Vorsteuer auf Konten ohne Steuerautomatik: 9 = 19 %, 8 = 7 % (16 % und 5 % aus 2020: offen, PRUEFLISTE). */
export const BU_VORSTEUER: Record<number, string> = { 19: "9", 7: "8" };

/**
 * Automatikkonten der verwendeten Kategorien: Die Steuer rechnet DATEV aus dem Konto selbst (kein BU-Schlüssel, ohne
 * Vorsteuerabzug BU 40). Alle anderen Aufwandskonten sind ohne Automatik und brauchen BU 9/8 (fachlich zu prüfen).
 */
export const AUTOMATIKKONTEN: Record<Kontenrahmen, readonly string[]> = {
  // R12: Skontokonten mit Steuersatz (gewährte Skonti 19 %/7 %, erhaltene Skonti 19 %/7 % Vorsteuer) – PRUEFLISTE
  SKR03: ["3400", "3300", "3120", "3123", "3140", "3143", "8736", "8731", "3736", "3731"],
  SKR04: ["5400", "5300", "5920", "5923", "5940", "5943", "4736", "4731", "5736", "5731"],
};

/**
 * Konten für § 13b-Eingangsleistungen (Automatik: Umsatzsteuer, mit Vorsteuerabzug auch die Vorsteuer): Bauleistung eines
 * im Inland ansässigen Unternehmers bzw. sonstige Leistung eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers.
 * R11: auch ohne Vorsteuerabzug (Kleinunternehmer, steuerfreie Umsätze nach § 4 Nr. 8 ff.) – Konten „ohne Vorsteuer und
 * 19 % Umsatzsteuer“, sonst fehlte die Steuer (Kz 47/85) im Stapel. SKR03 3120/3123 bzw. 3140/3143, SKR04 5920/5923
 * bzw. 5940/5943 – nach Angabe der Steuerberatung, gegen den Kontenrahmen prüfen (PRUEFLISTE).
 */
export const KONTEN_13B: Record<Kontenrahmen, { mit: { bau: string; eu: string }; ohne: { bau: string; eu: string } }> = {
  SKR03: { mit: { bau: "3120", eu: "3123" }, ohne: { bau: "3140", eu: "3143" } },
  SKR04: { mit: { bau: "5920", eu: "5923" }, ohne: { bau: "5940", eu: "5943" } },
};

/** Sachkonten je Kontenrahmen – fachlich zu prüfen. Aufwandskonten stehen in der Kategorie (belege.ts). */
export const BUCHUNGSKONTEN: Record<
  Kontenrahmen,
  {
    /**
     * StB-Prüfung (A-4, B-6): Bank – Zahlungseingänge bilanzierender Betriebe, mit der Kontenvorgabe „Belege gegen
     * Bank“ auch Belege per Überweisung oder Karte. SKR03 1200, SKR04 1800 (pruefpunkteBuchungen, bisher schon genannt).
     */
    bank: string;
    /**
     * StB-Prüfung (B-6, Frage 7): Verrechnungskonto Gesellschafter einer Kapitalgesellschaft – „Verbindlichkeiten
     * gegenüber Gesellschaftern – Restlaufzeit bis 1 Jahr“, Standard SKR03 0731 (korrigierter Bericht vom 22.10.2026;
     * 0755 ist das Konto für offene Ausschüttungen), kanzleiabhängig (Kontenvorgaben).
     * UNSICHER (PRUEFLISTE): SKR04 3560 ist der bisherige Standard – SKR04-Gegenstück zu 0731 laut Kanzlei folgt.
     */
    verrechnungGesellschafter: string;
    /** StB-Prüfung (B-11): Homeoffice-Pauschale bzw. häusliches Arbeitszimmer – SKR03 4288 / SKR04 6348 („Nummer in Rewe prüfen“) */
    homeoffice: string;
    /**
     * StB-Prüfung (B-10): Anlagenkonten nach Art – Maschinen 0400/0440, Betriebs- und Geschäftsausstattung 0420/0650,
     * Kfz 0320/0520, Software 0027/0135 (SKR03/SKR04 laut Bericht).
     */
    anlagen: Record<AnlageArt, string>;
    /** Forderungen aus Lieferungen und Leistungen */
    forderungen: string;
    /** Verbindlichkeiten aus Lieferungen und Leistungen */
    verbindlichkeiten: string;
    kasse: string;
    privateinlagen: string;
    /** R12: Privatentnahmen allgemein (Bargeld aus der Kasse) */
    privatentnahmen: string;
    /** R12: Geldtransit – Kartenzahlungen der Kasse bis zur Gutschrift auf dem Bankkonto, Bargeld auf dem Weg zur Bank */
    geldtransit: string;
    /** R12: gewährte Skonti je Steuersatz (0 = ohne Umsatzsteuer, auch Kleinunternehmer) – Minderung der Erlöse */
    skontiGewaehrt: { 19: string; 7: string; 0: string };
    /** R12: erhaltene Skonti je Steuersatz der Vorsteuer (0 = ohne Vorsteuer) – Minderung des Aufwands */
    skontiErhalten: { 19: string; 7: string; 0: string };
    /**
     * Erlöskonten je Steuersatz; `ku` für Kleinunternehmer (§ 19 UStG), `0` für steuerfreie Umsätze (§ 4 Nr. 8 ff. UStG,
     * Kz 48), `igl` innergemeinschaftliche Lieferung, `rc13b` § 13b-Umsatz im Inland, `eu` sonstige Leistung an
     * Unternehmen im übrigen Gemeinschaftsgebiet (Empfänger schuldet die Steuer), `drittland` im Drittland steuerbare
     * Leistung (im Inland nicht steuerbar).
     * StB-Prüfung (B-2): `nullsatz` – Nullsteuersatz nach § 12 Abs. 3 UStG (Photovoltaik) mit Kz-87-Automatik statt
     * 8100/4100 (Kz 48). Der Bericht nennt keine Nummer („in Rewe nach Nullsteuersatz bzw. § 12 Abs. 3 suchen“);
     * Standard SKR03 8290 / SKR04 4290 („Erlöse 0 % USt“, Steuerschlüssel S0 – Herstellerangaben microdat/Lexware),
     * UNSICHER: über die Kontenvorgaben der Kanzlei festlegen.
     */
    erloese: { 19: string; 7: string; 0: string; ku: string; igl: string; rc13b: string; eu: string; drittland: string; nullsatz: string; oss: string; ausfuhr: string; befreit43: string };
    /*
     * E-208: `erloese.ausfuhr` – steuerfreie Ausfuhrlieferungen (§ 4 Nr. 1 Buchst. a UStG, Kz 43, mit Vorsteuerabzug).
     * Vorher fielen sie auf `0` (8100/4100, steuerfreie Umsätze § 4 Nr. 8 ff. ohne Vorsteuerabzug, Kz 48) – die
     * Voranmeldung der App meldet sie aber in Kz 43 (`kennzahlBefreiung`). Standard SKR03 8120 / SKR04 4120
     * („Steuerfreie Umsätze § 4 Nr. 1a UStG“ im DATEV-Standardkontenrahmen) – E-214: vom Steuerberater bestätigt
     * (26.10.2026), Prüfung im DATEV-Testimport offen (PRUEFLISTE T-221); über die Kontenvorgaben änderbar.
     * E-214: `erloese.befreit43` – übrige steuerfreie Umsätze mit Vorsteuerabzug (§ 4 Nr. 2–7 UStG, Kz 43), vorher auf
     * 8100/4100 (Kz 48). SKR03 8150 / SKR04 4150 „Sonstige steuerfreie Umsätze § 4 Nr. 2–7 UStG“ – vom Steuerberater
     * genannt (26.10.2026), im DATEV-Testimport zu prüfen (T-221); Kontenvorgabe `erloesKz43`.
     */
    /*
     * Koordination Rechnungen (OSS, § 18j UStG): `erloese.oss` – „Erlöse aus im anderen EU-Land steuerpflichtigen
     * Lieferungen“ SKR03 8320 / SKR04 4320 (DATEV-Bereich 8320–8329 bzw. 4320–4329), Kontenbereich von die Steuerberatungskanzlei
     * und Steuerberater bestätigt (Nachtrag 22.10.2026). Land in Feld 40 (bei Privatpersonen nur das Länderkennzeichen, keine
     * USt-IdNr.) und Steuersatz des Bestimmungslands in Feld 41. Offen (PRUEFLISTE T-128): Steuerschlüssel – über die
     * Kontenvorgaben änderbar.
     */
    /** Aufwandskonto für Gutschriften (bezogene Leistungen) */
    gutschrift: string;
    /**
     * R12 GoBD: verkaufte, noch nicht eingelöste Mehrzweck-Gutscheine (§ 3 Abs. 15 UStG) – „sonstige Verbindlichkeiten“.
     * UNSICHER (PRUEFLISTE): SKR03 1700, SKR04 3500 – mit der Kanzlei abstimmen (manche nutzen ein eigenes Konto).
     */
    gutscheinVerbindlichkeit: string;
    /**
     * R12 GoBD: Fehlbetrag laut Zählung – sonstige betriebliche Aufwendungen (wie die Kategorie „Sonstiges“, ohne
     * Vorsteuer). Überschüsse gehen als Erlös zum Regelsatz. Mit der Kanzlei abstimmen (PRUEFLISTE).
     */
    kassendifferenzAufwand: string;
    /**
     * StB-Prüfung (A-9, B-9): Überschuss laut Zählung – leer: Erlöse 19 % (wie bisher); sonst ein Ertragskonto ohne
     * Umsatzsteuer nach Hausregel der Kanzlei (z. B. 2700 / 4830 „Sonstige Erträge“).
     */
    kassendifferenzErtrag: string;
    /**
     * R12 GoBD: unentgeltliche Wertabgaben (Sachentnahmen, § 3 Abs. 1b UStG) – „Entnahme durch den Unternehmer für Zwecke
     * außerhalb des Unternehmens (Waren)“ 19 % / 7 % (Automatik). UNSICHER (PRUEFLISTE): SKR03 8910/8915, SKR04 4620/4610.
     */
    sachentnahme: { 19: string; 7: string };
    /**
     * R12 GoBD: gewährte Skonti auf steuerfreie innergemeinschaftliche Lieferungen bzw. auf Umsätze, für die der
     * Empfänger die Steuer schuldet (§ 13b, EU-Leistung). UNSICHER (PRUEFLISTE): SKR03 8743 bzw. 8741, SKR04 4743 bzw. 4741.
     */
    skontiGewaehrtIgl: string;
    skontiGewaehrtRc: string;
    /**
     * E-218 (Steuerberater 27.10.2026, T-274): „Erhaltene Anzahlungen auf Bestellungen“ – bilanzierende Betriebe buchen
     * bezahlte Anzahlungen auf innergemeinschaftliche Lieferungen bzw. EU-Leistungen hierauf, ohne Steuerschlüssel, und
     * verrechnen sie mit der Schlussrechnung. SKR03 1710 / SKR04 3250 (vom Steuerberater genannt; im DATEV-Testimport
     * T-221 zu prüfen), Kontenvorgabe `anzahlungenErhalten`.
     */
    anzahlungenErhalten: string;
    /**
     * E-218 (T-274): EÜR – Erlöskonto OHNE Umsatzsteuerfunktion für Anzahlungen auf innergemeinschaftliche Lieferungen
     * bzw. EU-Leistungen (Einnahme mit der Zahlung, § 11 EStG; nicht in der Voranmeldung), umgebucht mit der
     * Schlussrechnung. Kein Standard – das Konto gibt der Steuerberater im Testimport vor (T-221); leer = nicht
     * festgelegt, dann fehlen diese Buchungen im Stapel und LIESMICH nennt sie (Kontenvorgabe `anzahlungEuEuer`).
     */
    anzahlungEuEuer: string;
    /**
     * E-222: innergemeinschaftlicher Erwerb (Beleg mit `steuerschuld: "ige"`) – Automatikkonten für Erwerbsteuer (Kz 89/93)
     * und, mit Vorsteuerabzug, Vorsteuer (Kz 61), gebucht mit der Bemessungsgrundlage. E-227 (Steuerberater 27.10.2026):
     * mit Vorsteuerabzug 19 % SKR03 3425 / SKR04 5425 (bestätigt), 7 % SKR03 3420 / SKR04 5420; ohne Vorsteuerabzug 19 %
     * SKR03 3435 / SKR04 5435, 7 % SKR03 3430 / SKR04 5430 (von ihm genannt) – über die Kontenvorgaben änderbar. Andere
     * Sätze (16 %/5 % aus 2020) haben kein Konto: diese Zeilen fehlen im Stapel, LIESMICH nennt sie.
     */
    igErwerb: { mit: { 19: string; 7: string }; ohne: { 19: string; 7: string } };
  }
> = {
  // Forderungen/Verbindlichkeiten ohne Kontokorrent (1410/1610 bzw. 1210/3310), damit beim Bankabruf kein OPOS nötig ist
  SKR03: { bank: "1200", verrechnungGesellschafter: "0731", homeoffice: "4288", anlagen: { maschinen: "0400", bga: "0420", kfz: "0320", software: "0027" }, forderungen: "1410", verbindlichkeiten: "1610", kasse: "1000", privateinlagen: "1890", privatentnahmen: "1800", geldtransit: "1360", skontiGewaehrt: { 19: "8736", 7: "8731", 0: "8730" }, skontiErhalten: { 19: "3736", 7: "3731", 0: "3730" }, erloese: { 19: "8400", 7: "8300", 0: "8100", ku: "8195", igl: "8125", rc13b: "8337", eu: "8336", drittland: "8338", nullsatz: "8290", oss: "8320", ausfuhr: "8120", befreit43: "8150" }, gutschrift: "3100", gutscheinVerbindlichkeit: "1700", kassendifferenzAufwand: "4900", kassendifferenzErtrag: "", sachentnahme: { 19: "8910", 7: "8915" }, skontiGewaehrtIgl: "8743", skontiGewaehrtRc: "8741", anzahlungenErhalten: "1710", anzahlungEuEuer: "", igErwerb: { mit: { 19: "3425", 7: "3420" }, ohne: { 19: "3435", 7: "3430" } } },
  // UNSICHER: verrechnungGesellschafter 3560 – SKR04-Gegenstück zu 0731 laut Kanzlei folgt
  SKR04: { bank: "1800", verrechnungGesellschafter: "3560", homeoffice: "6348", anlagen: { maschinen: "0440", bga: "0650", kfz: "0520", software: "0135" }, forderungen: "1210", verbindlichkeiten: "3310", kasse: "1600", privateinlagen: "2180", privatentnahmen: "2100", geldtransit: "1460", skontiGewaehrt: { 19: "4736", 7: "4731", 0: "4730" }, skontiErhalten: { 19: "5736", 7: "5731", 0: "5730" }, erloese: { 19: "4400", 7: "4300", 0: "4100", ku: "4185", igl: "4125", rc13b: "4337", eu: "4336", drittland: "4338", nullsatz: "4290", oss: "4320", ausfuhr: "4120", befreit43: "4150" }, gutschrift: "5900", gutscheinVerbindlichkeit: "3500", kassendifferenzAufwand: "6300", kassendifferenzErtrag: "", sachentnahme: { 19: "4620", 7: "4610" }, skontiGewaehrtIgl: "4743", skontiGewaehrtRc: "4741", anzahlungenErhalten: "3250", anzahlungEuEuer: "", igErwerb: { mit: { 19: "5425", 7: "5420" }, ohne: { 19: "5435", 7: "5430" } } },
};

/** Wirksame Konten eines Stapels: Kontenrahmen plus Kontenvorgaben der Kanzlei. */
export type Konten = (typeof BUCHUNGSKONTEN)[Kontenrahmen];

/**
 * Konten des Kontenrahmens mit den Vorgaben der Kanzlei (nur gesetzte, gültige Nummern ersetzen den Standard) – alle
 * Buchungsfunktionen und die Listen des Pakets rechnen damit.
 */
export function kontenFuer(kontenrahmen: Kontenrahmen, vorgaben?: Kontenvorgaben | null): Konten {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const v = vorgaben?.konten ?? {};
  const w = (x: string | undefined, standard: string) => (x && /^\d{4}$/.test(x) ? x : standard);
  return {
    ...k,
    forderungen: w(v.forderungen, k.forderungen),
    verbindlichkeiten: w(v.verbindlichkeiten, k.verbindlichkeiten),
    kasse: w(v.kasse, k.kasse),
    bank: w(v.bank, k.bank),
    geldtransit: w(v.geldtransit, k.geldtransit),
    privateinlagen: w(v.privateinlagen, k.privateinlagen),
    privatentnahmen: w(v.privatentnahmen, k.privatentnahmen),
    verrechnungGesellschafter: w(v.verrechnungGesellschafter, k.verrechnungGesellschafter),
    gutscheinVerbindlichkeit: w(v.gutscheinVerbindlichkeit, k.gutscheinVerbindlichkeit),
    kassendifferenzAufwand: w(v.kassendifferenzAufwand, k.kassendifferenzAufwand),
    // ein Überschuss auf dem Erlöskonto 19 % gilt wie „ohne Vorgabe“ (mit Umsatzsteuer)
    kassendifferenzErtrag: v.kassendifferenzErtrag && /^\d{4}$/.test(v.kassendifferenzErtrag) && v.kassendifferenzErtrag !== k.erloese[19] ? v.kassendifferenzErtrag : "",
    homeoffice: w(v.homeoffice, k.homeoffice),
    anzahlungenErhalten: w(v.anzahlungenErhalten, k.anzahlungenErhalten),
    // E-218: kein Standard – nur eine gesetzte, gültige Vorgabe
    anzahlungEuEuer: w(v.anzahlungEuEuer, k.anzahlungEuEuer),
    // E-222/E-227: innergemeinschaftlicher Erwerb – Standardkonten laut Steuerberater, über die Kontenvorgaben änderbar
    igErwerb: { mit: { 19: w(v.igErwerb19, k.igErwerb.mit[19]), 7: w(v.igErwerb7, k.igErwerb.mit[7]) }, ohne: { 19: w(v.igErwerbOhneVst19, k.igErwerb.ohne[19]), 7: w(v.igErwerbOhneVst7, k.igErwerb.ohne[7]) } },
    erloese: { ...k.erloese, nullsatz: w(v.erloesNullsatz, k.erloese.nullsatz), oss: w(v.erloesOss, k.erloese.oss), ausfuhr: w(v.erloesAusfuhr, k.erloese.ausfuhr), befreit43: w(v.erloesKz43, k.erloese.befreit43) },
    anlagen: { maschinen: w(v.anlageMaschinen, k.anlagen.maschinen), bga: w(v.anlageBga, k.anlagen.bga), kfz: w(v.anlageKfz, k.anlagen.kfz), software: w(v.anlageSoftware, k.anlagen.software) },
  };
}

/**
 * StB-Prüfung (A-4, E-4): Gewinnermittlung durch Bilanz statt EÜR – Kapitalgesellschaften (GmbH, UG, AG), GmbH & Co. KG,
 * OHG und KG (Handelsgesellschaften, §§ 6, 238 HGB; E-176) und eingetragene Kaufleute (§ 238 HGB), außerdem wer vom
 * Finanzamt zur Buchführung aufgefordert wurde (§ 141 AO).
 * Die Kontenvorgabe der Kanzlei geht vor (z. B. e. K. unter den Grenzen des § 241a HGB: EÜR).
 */
export function bilanzierend(o: { rechtsform?: string | null; name?: string; buchfuehrungMitteilung?: boolean | null; vorgabe?: "bilanz" | "euer" | null }): boolean {
  if (o.vorgabe) return o.vorgabe === "bilanz";
  if (o.buchfuehrungMitteilung === true) return true;
  const rf = (o.rechtsform ?? "").trim();
  const form = rf ? formImNamen(rf) : formImNamen(o.name ?? "");
  return form === "GmbH" || form === "UG (haftungsbeschränkt)" || form === "AG" || form === "GmbH & Co. KG" || form === "OHG" || form === "KG" || form === "e. K.";
}

/** BU-Schlüssel eines Aufwands: Automatikkonto ohne Vorsteuerabzug 40, Konto ohne Automatik mit Vorsteuer 9/8, sonst leer. */
export function buAufwand(kontenrahmen: Kontenrahmen, konto: string, satz: number, vorsteuer: boolean): string {
  if (satz <= 0) return "";
  if (AUTOMATIKKONTEN[kontenrahmen].includes(konto)) return vorsteuer ? "" : BU_OHNE_STEUER;
  return vorsteuer ? (BU_VORSTEUER[satz] ?? "") : "";
}

const UMLAUTE: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "AE", Ö: "OE", Ü: "UE", ß: "ss" };

/** Belegfeld 1: höchstens 36 Zeichen aus Ziffern, Buchstaben und $ & % * + - / (DATEV); Umlaute werden umschrieben. */
export function belegfeld1Aus(s: string): string {
  return s
    .replace(/[äöüÄÖÜß]/g, (z) => UMLAUTE[z] ?? z)
    .replace(/[^A-Za-z0-9$&%*+\-/]/g, "")
    .slice(0, 36);
}

/** Leerraum zusammenziehen und auf `n` Zeichen kürzen (Buchungstext, Bezeichnung). */
const kuerze = (s: string, n: number) => Array.from(s.replace(/\s+/g, " ").trim()).slice(0, n).join("").trimEnd(); // nach Zeichen, nicht mitten durch ein Emoji

/** Länge des Lieferanten- bzw. Kundennamens im Buchungstext */
const NAME_IM_TEXT = 40;

/**
 * Stabile Buchungs-GUID (36 Zeichen, Form 8-4-4-4-12, Version 8 nach RFC 9562) aus Quelle und Steuersatz: dieselbe
 * Rechnung bzw. derselbe Beleg ergibt in jedem Paket dieselbe GUID. Kein Zufall, keine Kryptografie – vier FNV-1a-Hashes.
 */
export function buchungsGuid(quelle_id: string, satz: number | null): string {
  const text = `amtlos|${quelle_id}|${satz === null ? "ku" : satz}`;
  const teile: string[] = [];
  for (let seed = 0; seed < 4; seed++) {
    let h = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    teile.push(h.toString(16).padStart(8, "0"));
  }
  const hex = teile.join("").split("");
  hex[12] = "8"; // Version 8 (frei definiert)
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16); // Variante RFC 9562
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** E-208: Ausfuhrlieferung (§ 4 Nr. 1 Buchst. a UStG) im Befreiungshinweis – wie in der XRechnung (Kategorie G) und Kz 43 */
const AUSFUHR_HINWEIS = /§\s*4\s+Nr\.\s*1\s*(?:Buchst\.\s*)?a(?![a-zäöü])/i;
/** E-214: übrige Befreiungen mit Vorsteuerabzug (§ 4 Nr. 2 bis 7 UStG, Kz 43) – wie `kennzahlBefreiung` */
const BEFREIT_43_HINWEIS = /§\s*4\s+Nr\.\s*[2-7](?!\d)/i;

export function erloeskonto(k: Konten, satz: number | null, r?: Pick<AusgangsRechnungFuerBuchung, "steuerart" | "kunde_land"> & { oss?: AusgangsRechnungFuerBuchung["oss"]; befreiungsgrund?: string | null }): string {
  const land = (r?.kunde_land ?? "DE").toUpperCase();
  // OSS: Steuer des Bestimmungslands – eigenes Erlöskonto (8320/4320, Kontenbereich von der Kanzlei bestätigt), nicht 8400/8300
  if (r?.oss && satz !== null && satz > 0) return k.erloese.oss;
  // Leistung an ein Unternehmen im übrigen Gemeinschaftsgebiet mit Steuerschuldnerschaft des Empfängers – auch bei
  // Kleinunternehmern (Ort der Leistung im Ausland, § 3a Abs. 2 UStG)
  if ((satz === 0 || satz === null) && r?.steuerart === "reverse_charge") return istEuAusland(land) ? k.erloese.eu : land === "DE" ? k.erloese.rc13b : k.erloese.drittland;
  if (satz === null) return k.erloese.ku;
  if (satz === 7) return k.erloese[7];
  // StB-Prüfung (B-2): Nullsteuersatz (§ 12 Abs. 3 UStG) auf das Konto mit Kz 87, nicht auf das steuerfreie Konto (Kz 48)
  // E-208: Ausfuhrlieferung (§ 4 Nr. 1 Buchst. a UStG, Kz 43) auf das eigene Konto, nicht auf 8100/4100 (§ 4 Nr. 8 ff., Kz 48)
  if (satz === 0 && r?.steuerart === "befreit" && AUSFUHR_HINWEIS.test(r.befreiungsgrund ?? "")) return k.erloese.ausfuhr;
  // E-214 (Steuerberater 26.10.2026): § 4 Nr. 2–7 UStG (Kz 43) auf „Sonstige steuerfreie Umsätze § 4 Nr. 2–7 UStG“
  if (satz === 0 && r?.steuerart === "befreit" && BEFREIT_43_HINWEIS.test(r.befreiungsgrund ?? "")) return k.erloese.befreit43;
  if (satz === 0) return r?.steuerart === "igl" ? k.erloese.igl : r?.steuerart === STEUERART_NULLSATZ ? k.erloese.nullsatz : k.erloese[0];
  // Regelsatz; ein unbekannter Satz landet ebenfalls hier (die App kennt nur 19, 7 und 0)
  return k.erloese[19];
}

/** Optionen der Buchungsfunktionen: Kontenvorgaben der Kanzlei (B-4/B-9/B-10/B-11) */
export interface BuchungsOptionen {
  vorgaben?: Kontenvorgaben | null;
}

/**
 * Je Rechnung und Steuersatz eine Buchung Forderungen an Erlöse mit dem Bruttobetrag (das Automatikkonto rechnet die
 * Umsatzsteuer selbst). Gebucht wird zum Datum in `datum` – bei Ist-Versteuerung ohne Bilanz und bei
 * Abschlagsrechnungen gibt der Aufrufer den Zahltag mit und lässt Unbezahltes weg (R11, Prüfpunkt). Gutschriften (auch
 * ihre Stornos) werden als Aufwand gebucht.
 * StB-Prüfung 3.1: Stornos als Generalumkehr (Feld 118 = 1) auf der Seite der ursprünglichen Buchung (Forderung im
 * Soll), nicht mehr als einfache Umkehrbuchung im Haben – sonst stimmen Verkehrszahlen und Umsätze je Konto nicht.
 */
export function buchungenAusRechnungen(rechnungen: AusgangsRechnungFuerBuchung[], kontenrahmen: Kontenrahmen, o?: BuchungsOptionen & { versteuerung?: "soll" | "ist" }): Buchung[] {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const aus: Buchung[] = [];
  for (const r of rechnungen) {
    if (r.gutschrift) {
      aus.push(...gutschriftBuchungen(r, kontenrahmen, o));
      continue;
    }
    const storno = r.art === "storno";
    const kunde = kuerze(r.kunde, NAME_IM_TEXT);
    const buchungstext = kuerze(storno ? `Storno ${r.nummer}${r.storniert_nummer ? ` zu RE ${r.storniert_nummer}` : ""} ${kunde}` : `RE ${r.nummer} ${kunde}`, 60);
    // Schlussrechnung (C-4): nur der Rest nach Abzug der Abschläge – die Abschläge stehen schon mit ihrer Zahlung im Stapel
    const gruppen = r.anteil ? r.anteil.map((a) => ({ satz: a.satz, netto_cent: a.netto_cent, ust_cent: a.ust_cent })) : r.vollesEntgelt ? summen(r.positionen, r.kleinunternehmer).gruppen : restGruppen(r);
    for (const g of gruppen) {
      const brutto = g.netto_cent + g.ust_cent;
      if (!brutto) continue;
      aus.push({
        datum: r.datum,
        betrag_cent: Math.abs(brutto),
        // eine negative Summe (nur bei negativen Positionen) steht im Haben; ein Storno auf derselben Seite mit Generalumkehr
        soll_haben: brutto < 0 ? "H" : "S",
        konto: r.personenkonto || k.forderungen,
        gegenkonto: erloeskonto(k, g.satz, r),
        bu_schluessel: "",
        belegfeld1: belegfeld1Aus(r.nummer),
        buchungstext,
        ust_satz: g.satz,
        art: storno ? "storno" : "einnahme",
        quelle_id: r.id,
        guid: buchungsGuid(r.guid_zusatz ? `${r.id}|${r.guid_zusatz}` : r.id, g.satz),
        leistungsdatum: r.leistungsdatum ?? null,
        steuerperiode: r.steuerperiode ?? null,
        // USt-IdNr. des Abnehmers für Kz 41/21 und die Zusammenfassende Meldung
        // OSS (Nachtrag 22.10.2026): bei Fernverkäufen an Privatpersonen nur das Länderkennzeichen, nie eine USt-IdNr.
        eu_ustid: r.oss && g.satz ? ossLandKennzeichen(r.oss.land) : (g.satz === 0 || g.satz === null) && (r.steuerart === "igl" || (r.steuerart === "reverse_charge" && istEuAusland(r.kunde_land))) && r.kunde_ust_idnr ? r.kunde_ust_idnr.replace(/\s/g, "").toUpperCase() : null,
        ...(r.oss && g.satz ? { eu_steuersatz: r.oss.satz } : {}),
        ...(storno ? { generalumkehr: true } : {}),
      });
    }
  }
  return aus;
}

/**
 * Gutschrift (§ 14 Abs. 2 Satz 2 UStG): der Betrieb ist Leistungsempfänger – Verbindlichkeiten (Feld 7, Haben) an
 * Aufwand (bezogene Leistungen, Feld 8) mit Vorsteuer (BU 9/8 zum Gegenkonto, A-1), wenn der Leistende Umsatzsteuer
 * ausweist und der Betrieb kein Kleinunternehmer ist. Ein Storno der Gutschrift als Generalumkehr.
 */
function gutschriftBuchungen(r: AusgangsRechnungFuerBuchung, kontenrahmen: Kontenrahmen, o?: BuchungsOptionen): Buchung[] {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const storno = r.art === "storno";
  const text = kuerze(`${storno ? "Storno " : ""}Gutschrift ${r.nummer} ${kuerze(r.kunde, NAME_IM_TEXT)}`, 60);
  const aus: Buchung[] = [];
  for (const g of summen(r.positionen, r.kleinunternehmer).gruppen) {
    const brutto = g.netto_cent + g.ust_cent;
    if (!brutto) continue;
    aus.push({
      datum: r.datum,
      betrag_cent: Math.abs(brutto),
      soll_haben: brutto < 0 ? "S" : "H",
      konto: r.personenkonto || k.verbindlichkeiten,
      gegenkonto: k.gutschrift,
      bu_schluessel: g.satz ? buAufwand(kontenrahmen, k.gutschrift, g.satz, !r.empfaenger_ku) : "",
      belegfeld1: belegfeld1Aus(r.nummer),
      buchungstext: text,
      ust_satz: g.satz,
      art: "ausgabe",
      quelle_id: r.id,
      guid: buchungsGuid(r.id, g.satz),
      leistungsdatum: r.leistungsdatum ?? null,
      ...(storno ? { generalumkehr: true } : {}),
    });
  }
  return aus;
}

/** Skontokonto je Steuersatz – 16 % und 5 % (2020) wie 19 % bzw. 7 % (PRUEFLISTE), ohne Satz das Konto ohne Steuer. */
const skontoKonto = (konten: { 19: string; 7: string; 0: string }, satz: number | null) => (satz === null || satz <= 0 ? konten[0] : satz <= 7 ? konten[7] : konten[19]);

/**
 * R12 GoBD: Art einer Rechnung für Skonto und Zusammenfassende Meldung – „igl“ (steuerfreie innergemeinschaftliche
 * Lieferung), „rc“ (Empfänger schuldet die Steuer: § 13b im Inland oder sonstige Leistung ins EU-Ausland) oder null.
 */
export function skontoSonderfall(r: Pick<AusgangsRechnungFuerBuchung, "steuerart" | "kleinunternehmer">): "igl" | "rc" | null {
  if (r.kleinunternehmer) return null;
  return r.steuerart === "igl" ? "igl" : r.steuerart === "reverse_charge" ? "rc" : null;
}

/** Muss die Zusammenfassende Meldung nach einem Skonto angepasst werden? igL und sonstige Leistungen ins EU-Ausland (§ 18a UStG). */
export const zmBetroffen = (r: Pick<AusgangsRechnungFuerBuchung, "steuerart" | "kleinunternehmer" | "kunde_land">) => skontoSonderfall(r) === "igl" || (skontoSonderfall(r) === "rc" && istEuAusland(r.kunde_land));

/**
 * R12: gewährtes Skonto bzw. andere Minderung beim Zahlungseingang einer Ausgangsrechnung (§ 17 Abs. 1 UStG) – je
 * Steuersatz „Gewährte Skonti“ an Forderungen, zum Tag der Zahlung (Feld 116 ebenso). Die Skontokonten mit Steuersatz
 * sind Automatikkonten (kein BU-Schlüssel); Kleinunternehmer und 0 % auf das Konto ohne Umsatzsteuer.
 * R12 GoBD: Skonto auf eine innergemeinschaftliche Lieferung bzw. einen Umsatz, für den der Empfänger die Steuer
 * schuldet, auf eigene Konten (UNSICHER, PRUEFLISTE) und mit der USt-IdNr. des Empfängers – sonst mindert DATEV
 * Kz 41/60/21 und die Zusammenfassende Meldung nicht. StB-Prüfung (A-1): diese Reihenfolge ist richtig.
 */
export function skontoBuchungenRechnung(r: Pick<AusgangsRechnungFuerBuchung, "id" | "nummer" | "kunde" | "kleinunternehmer" | "positionen"> & Partial<Pick<AusgangsRechnungFuerBuchung, "steuerart" | "kunde_land" | "kunde_ust_idnr" | "abschlaege" | "oss" | "personenkonto">>, minderungen: { id: string; datum: string; brutto_cent: number; steuerperiode?: string; guid_zusatz?: string }[], kontenrahmen: Kontenrahmen, o?: BuchungsOptionen): Buchung[] {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const gruppen = restGruppen(r);
  const sonder = skontoSonderfall(r);
  const ustid = sonder && (sonder === "igl" || istEuAusland(r.kunde_land)) && r.kunde_ust_idnr ? r.kunde_ust_idnr.replace(/\s/g, "").toUpperCase() : null;
  const aus: Buchung[] = [];
  for (const m of minderungen) {
    if (!m.brutto_cent) continue;
    for (const a of minderungNachSatz(m.brutto_cent, gruppen)) {
      if (!a.brutto_cent) continue;
      const nullSatz = a.satz === 0 || a.satz === null;
      // OSS: Minderung der Erlöse des Bestimmungslands auf dem OSS-Erlöskonto mit Land (Feld 40) und Satz (Feld 41) –
      // nicht auf „Gewährte Skonti 19 %“, sonst minderte DATEV die deutsche Umsatzsteuer
      const oss = r.oss && !nullSatz ? r.oss : null;
      aus.push({
        datum: m.datum,
        betrag_cent: Math.abs(a.brutto_cent),
        soll_haben: a.brutto_cent < 0 ? "H" : "S",
        konto: oss ? k.erloese.oss : sonder && nullSatz ? (sonder === "igl" ? k.skontiGewaehrtIgl : k.skontiGewaehrtRc) : skontoKonto(k.skontiGewaehrt, r.kleinunternehmer ? null : a.satz),
        ...(oss ? { eu_ustid: ossLandKennzeichen(oss.land), eu_steuersatz: oss.satz } : {}),
        ...(sonder && nullSatz && ustid ? { eu_ustid: ustid } : {}),
        gegenkonto: r.personenkonto || k.forderungen,
        bu_schluessel: "",
        belegfeld1: belegfeld1Aus(r.nummer),
        buchungstext: kuerze(`Skonto RE ${r.nummer} ${kuerze(r.kunde, NAME_IM_TEXT)}`, 60),
        ust_satz: r.kleinunternehmer ? null : a.satz,
        art: "einnahme",
        quelle_id: r.id,
        guid: buchungsGuid(`${r.id}|skonto|${m.id}${m.guid_zusatz ? `|${m.guid_zusatz}` : ""}`, a.satz),
        // E-218: Skonto auf eine EU-Anzahlung vor der Meldung – Zeitraum der Schlussrechnung
        steuerperiode: m.steuerperiode ?? m.datum,
      });
    }
  }
  return aus;
}

/**
 * E-218 (Steuerberater 27.10.2026, T-274): Buchungen für Anzahlungen auf innergemeinschaftliche Lieferungen bzw.
 * EU-Leistungen – sie dürfen nicht zum Zahltag auf dem Erlöskonto (8125/8336 bzw. 4125/4336) stehen, weil sie nicht in
 * Kz 41/21 und nicht in die ZM gehören (§ 18b Satz 2 und 3 UStG). `anzahlungskonto`: bei Bilanz „Erhaltene Anzahlungen
 * auf Bestellungen“, bei EÜR das Erlöskonto ohne Umsatzsteuerfunktion (Kontenvorgabe). Alle ohne Steuerschlüssel.
 * - „zahlung“: bezahlte Anzahlung zum Zahltag – Forderungen (Feld 7, Soll) an Anzahlungskonto, ohne Feld 116.
 * - „skonto“: Skonto auf die Anzahlung, abgezogen vor der Meldung der Lieferung bzw. Leistung – Anzahlungskonto an
 *   Forderungen zum Zahltag (keine Minderung in einem früheren Zeitraum; sie mindert das Entgelt der Schlussrechnung).
 * - „verrechnung“ (Bilanz): mit der Schlussrechnung Anzahlungskonto an Forderungen – die Schlussrechnung steht mit dem
 *   vollen Entgelt auf dem Erlöskonto.
 * - „umbuchung“ (EÜR): mit der Schlussrechnung Anzahlungskonto an Erlöskonto der Schlussrechnung, mit Feld 116 nach
 *   § 18b UStG und USt-IdNr.
 * Bei einer Stornorechnung (Schlussrechnung) als Generalumkehr auf derselben Seite.
 */
export function euAnzahlungBuchung(art: "zahlung" | "skonto" | "verrechnung" | "umbuchung", r: AusgangsRechnungFuerBuchung, b: { id: string; datum: string; betrag_cent: number }, anzahlungskonto: string, kontenrahmen: Kontenrahmen, o?: BuchungsOptionen): Buchung {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const ford = r.personenkonto || k.forderungen;
  const storno = r.art === "storno";
  const kunde = kuerze(r.kunde, NAME_IM_TEXT);
  const text = { zahlung: `Anzahlung RE ${r.nummer} ${kunde}`, skonto: `Skonto Anzahlung RE ${r.nummer} ${kunde}`, verrechnung: `${storno ? "Storno " : ""}Verrechn. Anzahlungen RE ${r.nummer} ${kunde}`, umbuchung: `${storno ? "Storno " : ""}Umbuch. Anzahlungen RE ${r.nummer} ${kunde}` }[art];
  const ustid = r.kunde_ust_idnr ? r.kunde_ust_idnr.replace(/\s/g, "").toUpperCase() : null;
  const negativ = b.betrag_cent < 0;
  return {
    datum: b.datum,
    betrag_cent: Math.abs(b.betrag_cent),
    soll_haben: negativ ? "H" : "S",
    konto: art === "zahlung" ? ford : anzahlungskonto,
    gegenkonto: art === "zahlung" ? anzahlungskonto : art === "umbuchung" ? erloeskonto(k, 0, r) : ford,
    bu_schluessel: "",
    belegfeld1: belegfeld1Aus(r.nummer),
    buchungstext: kuerze(text, 60),
    ust_satz: 0,
    art: storno ? "storno" : art === "zahlung" ? "einnahme" : "umbuchung",
    quelle_id: r.id,
    guid: buchungsGuid(`${r.id}|anzahlung-${art}|${b.id}`, 0),
    ...(art === "umbuchung" ? { leistungsdatum: r.leistungsdatum ?? null, steuerperiode: r.steuerperiode ?? null, eu_ustid: ustid } : {}),
    ...(storno ? { generalumkehr: true } : {}),
  };
}

/**
 * StB-Prüfung (A-4): Zahlungseingänge auf Ausgangsrechnungen bilanzierender Betriebe – Bank (Feld 7, Soll) an
 * Forderungen, zum Zahltag; eine Erstattung (Storno mit Rückzahlung) Bank im Haben. So steht zum Stichtag der offene
 * Betrag auf dem Forderungskonto. Skonto bzw. Minderung bucht `skontoBuchungenRechnung`. Ohne Steuer (Geldbewegung).
 */
export function zahlungsBuchungenRechnung(r: Pick<AusgangsRechnungFuerBuchung, "id" | "nummer" | "kunde" | "art"> & Partial<Pick<AusgangsRechnungFuerBuchung, "personenkonto">>, zahlungen: readonly { id: string; datum: string; betrag_cent: number }[], kontenrahmen: Kontenrahmen, o?: BuchungsOptionen): Buchung[] {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const storno = r.art === "storno";
  return zahlungen
    .filter((z) => z.betrag_cent)
    .map((z): Buchung => {
      // Zahlungseingang im Soll der Bank; Erstattung (Storno) bzw. negativer Betrag im Haben
      const eingang = storno ? z.betrag_cent < 0 : z.betrag_cent > 0;
      return {
        datum: z.datum,
        betrag_cent: Math.abs(z.betrag_cent),
        soll_haben: eingang ? "S" : "H",
        konto: k.bank,
        gegenkonto: r.personenkonto || k.forderungen,
        bu_schluessel: "",
        belegfeld1: belegfeld1Aus(r.nummer),
        buchungstext: kuerze(`${storno ? "Erstattung" : "Zahlung"} RE ${r.nummer} ${kuerze(r.kunde, NAME_IM_TEXT)}`, 60),
        ust_satz: null,
        art: "umbuchung",
        quelle_id: r.id,
        guid: buchungsGuid(`${r.id}|zahlung|${z.id}`, null),
      };
    });
}

/**
 * Konto eines Belegs nach Zahlungsweg – bar nur gegen Kasse, wenn die App die Kasse an diesem Tag führt (R12).
 * R12 GoBD: Barbelege vor dem ersten Kassenabschluss (bzw. ohne Kasse in der App) gegen Privateinlage – aus der eigenen
 * Tasche bezahlt; Geldtransit wäre sonst ein Parkkonto mit Restsaldo (Frage im Paket).
 * StB-Prüfung (B-6, Frage 7): Kapitalgesellschaften haben keine Privatkonten – privat ausgelegte Belege und Barbelege vor
 * dem ersten Kassenabschluss auf das Verrechnungskonto Gesellschafter (nicht Geldtransit). Mit der Kontenvorgabe
 * „Belege gegen Bank“ Überweisung/Karte direkt gegen Bank statt Verbindlichkeiten.
 */
export function belegGegenkonto(b: Pick<Beleg, "zahlung" | "datum" | "bezahlt">, k: Konten, kasseAb: string | null | undefined, kapitalgesellschaft = false, vorgaben?: Kontenvorgaben | null): string {
  if (b.zahlung === "privat") return kapitalgesellschaft ? k.verrechnungGesellschafter : k.privateinlagen;
  if (b.zahlung !== "bar") return vorgaben?.belegeGegenBank ? k.bank : k.verbindlichkeiten;
  // ohne Angabe wie bisher Kasse; mit Angabe: ab dem ersten Kassenabschluss Kasse, sonst Privateinlage bzw. Verrechnungskonto
  if (kasseAb === undefined) return k.kasse;
  return kasseAb && zahltag(b) >= kasseAb ? k.kasse : kapitalgesellschaft ? k.verrechnungGesellschafter : k.privateinlagen;
}

export interface BelegBuchungsOptionen extends BuchungsOptionen {
  nummern?: Map<string, string>;
  kapitalgesellschaft?: boolean;
  kleinunternehmer?: boolean;
  kasseAb?: string | null;
  /** E-165 (A-3): Kreditor je Beleg-ID – ersetzt das Verbindlichkeitskonto bei Belegen per Überweisung/Karte */
  kreditoren?: ReadonlyMap<string, string>;
  /**
   * E-227 (Erwerbsschwelle, § 1a Abs. 3 UStG): Belege mit innergemeinschaftlichem Erwerb, deren Erwerbsbesteuerung nicht
   * festgestellt ist (Kleinunternehmer bzw. nur steuerfreie Umsätze unter der Schwelle oder ohne Angabe) – nicht mit
   * Erwerbsteuer buchen; der Aufrufer nennt sie in LIESMICH.
   */
  igeNichtBuchen?: ReadonlySet<string>;
}

/** Konto des Zahlungswegs eines Belegs, mit Personenkonten der Kreditor statt Verbindlichkeiten (E-165). */
function zahlkontoBeleg(b: Beleg, k: Konten, o?: BelegBuchungsOptionen): string {
  const konto = belegGegenkonto(b, k, o?.kasseAb, o?.kapitalgesellschaft, o?.vorgaben);
  const kreditor = o?.kreditoren?.get(b.id);
  return kreditor && konto === k.verbindlichkeiten ? kreditor : konto;
}

/**
 * E-165 (5.2): Bruttobetrag eines Steuersatzes in einen Teil mit abziehbarer Vorsteuer und einen ohne aufteilen – der
 * Teil mit Vorsteuer so, dass DATEV aus ihm (BU 9/8, Steuer = brutto × p / (100 + p)) genau `abziehbar` rechnet.
 * § 13b (`netto`): der Teil, dessen Steuer (× p / 100) den abziehbaren Betrag ergibt.
 */
export function teilenNachVorsteuer(betrag_cent: number, satz: number, abziehbar_cent: number, netto = false): { mit: number; ohne: number } {
  const p = netto ? (satz > 0 ? satz : 19) : satz;
  if (p <= 0 || abziehbar_cent <= 0) return { mit: 0, ohne: betrag_cent };
  const vz = betrag_cent < 0 ? -1 : 1;
  const ganz = Math.abs(betrag_cent);
  const mit = Math.min(ganz, Math.round((Math.abs(abziehbar_cent) * (netto ? 100 : 100 + p)) / p));
  return { mit: vz * mit, ohne: vz * (ganz - mit) };
}

/**
 * Sachkonto eines Belegs je Steuersatz: Kategorie-Konto; Anlagegüter nach Art (B-10), Homeoffice (B-11) aus den
 * Konten; Kleinunternehmer buchen Waren auf das Konto ohne Vorsteuer (A-2: SKR03 3200 / SKR04 5200 statt 3400 + BU 40).
 */
export function belegSachkonto(b: Pick<Beleg, "kategorie"> & { anlage_art?: AnlageArt | null }, satz: number, kontenrahmen: Kontenrahmen, k: Konten, o?: { kleinunternehmer?: boolean }): string {
  const kat = kategorieFuer(b.kategorie);
  if (kat.anlage) return k.anlagen[b.anlage_art ?? "bga"];
  if (kat.id === "homeoffice") return k.homeoffice;
  const konten = kontenrahmen === "SKR03" ? kat.skr03 : kat.skr04;
  if (kat.id === "waren" && o?.kleinunternehmer) return konten[0] ?? "";
  return konten[satz] ?? konten[19] ?? "";
}

/**
 * R12: erhaltenes Skonto eines Belegs – je Steuersatz Konto des Belegs (Verbindlichkeiten, Kasse, Privat) an
 * „Erhaltene Skonti“, zum Zahltag. Mit Vorsteuerabzug die Konten mit Vorsteuer (Automatik), sonst das Konto ohne.
 * R12 GoBD: Nur Waren und Material gehen auf „Erhaltene Skonti“ (in der DATEV-EÜR Teil des Wareneinkaufs); bei allen
 * anderen Kategorien (Miete, Reparatur, Büro …) mindert das Skonto das Aufwandskonto selbst – mit demselben
 * BU-Schlüssel wie der Beleg, damit DATEV die Vorsteuer anteilig zurücknimmt. So stimmt die DATEV-EÜR mit der App-EÜR
 * überein, die das Skonto ebenfalls bei der Ausgabenart abzieht. StB-Prüfung (A-1): diese Reihenfolge ist richtig.
 */
export function skontoBuchungenBelege(belege: Beleg[], kontenrahmen: Kontenrahmen, o?: BelegBuchungsOptionen): Buchung[] {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const aus: Buchung[] = [];
  for (const b of belege) {
    if (!b.skonto_cent || !belegImStapel(b, o)) continue;
    const kat = kategorieFuer(b.kategorie);
    const belegfeld1 = belegfeld1Aus(belegKennung(b, o?.nummern?.get(b.id) ?? belegfeld1Aus(b.id).slice(0, 12).toUpperCase()));
    for (const a of belegSkonto(b)) {
      const mitVst = b.vorsteuer && !o?.kleinunternehmer;
      const satz = a.satz ?? 0;
      const aufwand = kat.id === "waren" ? null : belegSachkonto(b, satz, kontenrahmen, k, o);
      const zeile = (betrag: number, vst: boolean, guidZusatz: string): Buchung => ({
        datum: zahltag(b),
        betrag_cent: Math.abs(betrag),
        soll_haben: betrag < 0 ? "H" : "S",
        konto: zahlkontoBeleg(b, k, o),
        gegenkonto: aufwand ?? skontoKonto(k.skontiErhalten, vst ? a.satz : null),
        bu_schluessel: aufwand ? buAufwand(kontenrahmen, aufwand, satz, vst) : "",
        belegfeld1,
        buchungstext: kuerze(`Skonto ${kuerze(b.lieferant, NAME_IM_TEXT)} ${kat.kurz}`, 60),
        ust_satz: a.satz,
        art: "ausgabe",
        quelle_id: b.id,
        guid: buchungsGuid(`${b.id}|skonto${guidZusatz}`, a.satz),
      });
      // E-165: Teilabzug – die Minderung trifft abziehbaren und nicht abziehbaren Teil im Verhältnis des Belegs
      if (mitVst && belegTeilabzug(b) && satz > 0) {
        const t = teilenNachVorsteuer(a.brutto_cent, satz, Math.round(Math.abs(a.ust_cent) * vorsteuerVerhaeltnis(b, satz)));
        if (t.mit) aus.push(zeile(t.mit, true, ""));
        if (t.ohne) aus.push(zeile(t.ohne, false, "|nicht-abziehbar"));
        continue;
      }
      aus.push(zeile(a.brutto_cent, mitVst, ""));
    }
  }
  return aus;
}

/**
 * Je Beleg und Steuersatz eine Buchung mit dem Bruttobetrag. StB-Prüfung (A-1): Feld 7 „Konto“ ist das Konto des
 * Zahlungswegs im Haben – Verbindlichkeiten (bzw. Bank, Kontenvorgabe), bei Barzahlung Kasse (R12: mit `kasseAb` nur ab
 * dem ersten Kassenabschluss, davor Privateinlage bzw. Verrechnungskonto Gesellschafter), bei privater Zahlung
 * Privateinlage bzw. Verrechnungskonto; Feld 8 „Gegenkonto“ das Sachkonto aus der Kategorie mit BU-Schlüssel in Feld 9
 * (der Schlüssel gehört in DATEV zum Gegenkonto). Ohne Vorsteuerabzug auf Automatikkonten BU 40.
 * Belegfeld 1: Nummer des Lieferanten (normalisiert, `belegnummerNormal`), sonst die App-Belegnummer aus
 * `o.nummern` (`belegNummern`), ohne diese die Beleg-ID in Kurzform. Buchungstext: Lieferant (höchstens 40 Zeichen)
 * und Kurzbezeichnung der Kategorie.
 */
export function buchungenAusBelegen(belege: Beleg[], kontenrahmen: Kontenrahmen, o?: BelegBuchungsOptionen): Buchung[] {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const aus: Buchung[] = [];
  for (const b of belege) {
    if (!belegImStapel(b, o)) continue;
    if (b.steuerschuld === "ige" && o?.igeNichtBuchen?.has(b.id)) continue;
    const kat = kategorieFuer(b.kategorie);
    // E-227 (Steuerberater 27.10.2026): Erwerb zum Belegdatum; liegt es nach dem Ende des Monats nach dem Erwerb, trägt
    // Feld 116 den letzten Tag dieses Monats (§ 13 Abs. 1 Nr. 6 UStG); Feld 40 bleibt leer (USt-IdNr. des Lieferanten in LIESMICH)
    const tag116 = b.steuerschuld === "ige" && igeSteuerTag(b) !== b.datum ? igeSteuerTag(b) : null;
    // § 13b: mit Vorsteuerabzug die Konten „19 % Vorsteuer und 19 % Umsatzsteuer“, sonst „ohne Vorsteuer“ (R11)
    const mitVst = b.vorsteuer && !o?.kleinunternehmer;
    const zahlkonto = zahlkontoBeleg(b, k, o);
    const buchungstext = kuerze(`${kuerze(b.lieferant, NAME_IM_TEXT)} ${kat.kurz}`, 60);
    const belegfeld1 = belegfeld1Aus(belegKennung(b, o?.nummern?.get(b.id) ?? belegfeld1Aus(b.id).slice(0, 12).toUpperCase()));
    // E-165 (5.2): abziehbare Vorsteuer je Satz bei Teilabzug
    const teil = mitVst && belegTeilabzug(b) ? vorsteuerAufteilung(b) : null;
    for (const s of b.steuer) {
      if (!s.brutto_cent) continue;
      const zeile = (betrag: number, vst: boolean, guidZusatz: string, text = buchungstext): Buchung | null => {
        // § 13b: Automatikkonto für die Steuer (und ggf. die Vorsteuer); sonst das Sachkonto der Kategorie
        // E-222: innergemeinschaftlicher Erwerb auf das Erwerbskonto des Satzes – ohne festgelegtes Konto keine Zeile (igErwerbOhneKonto)
        const sachkonto = b.steuerschuld === "ige" ? igErwerbKonto(k, s.satz, vst) : b.steuerschuld ? KONTEN_13B[kontenrahmen][vst ? "mit" : "ohne"][b.steuerschuld] : belegSachkonto(b, s.satz, kontenrahmen, k, o);
        if (!sachkonto) return null;
        return {
          datum: b.datum,
          betrag_cent: Math.abs(betrag),
          // Ausgabe: Zahlungskonto im Haben; eine Gutschrift des Lieferanten (negativ) im Soll
          soll_haben: betrag < 0 ? "S" : "H",
          konto: zahlkonto,
          gegenkonto: sachkonto,
          bu_schluessel: b.steuerschuld ? "" : buAufwand(kontenrahmen, sachkonto, s.satz, vst),
          belegfeld1,
          buchungstext: text,
          ust_satz: s.satz,
          art: "ausgabe",
          quelle_id: b.id,
          guid: buchungsGuid(`${b.id}${guidZusatz}`, s.satz),
          ...(tag116 ? { steuerperiode: tag116 } : {}),
        };
      };
      const t = teil?.find((x) => x.satz === s.satz);
      if (teil && t && t.abziehbar_cent < t.ust_cent && (s.satz > 0 || b.steuerschuld)) {
        // Teilabzug: abziehbarer Teil mit Vorsteuer, Rest ohne – zwei Zeilen mit eigener GUID
        const g = teilenNachVorsteuer(s.brutto_cent, s.satz, t.abziehbar_cent, !!b.steuerschuld);
        const mit = g.mit ? zeile(g.mit, true, "", kuerze(`${buchungstext} VSt-Anteil`, 60)) : null;
        const ohne = g.ohne ? zeile(g.ohne, false, "|nicht-abziehbar", kuerze(`${buchungstext} ohne VSt`, 60)) : null;
        if (mit) aus.push(mit);
        if (ohne) aus.push(ohne);
        continue;
      }
      const z = zeile(s.brutto_cent, mitVst, "");
      if (z) aus.push(z);
    }
  }
  return aus;
}

/** E-222: Erwerbskonto eines innergemeinschaftlichen Erwerbs nach Satz (0 % wie § 13b: 19 %) und Vorsteuerabzug – "" ohne Konto. */
export function igErwerbKonto(k: Konten, satz: number, vst: boolean): string {
  const s = satz13b(satz);
  const je = k.igErwerb[vst ? "mit" : "ohne"];
  return s === 19 || s === 7 ? je[s] : "";
}

/** E-222: Teil eines innergemeinschaftlichen Erwerbs, der mangels Konto nicht im Stapel steht (für LIESMICH). */
export interface IgErwerbOhneKonto {
  beleg: Beleg;
  satz: number;
  betrag_cent: number;
  vorsteuer: boolean;
}

/**
 * E-222: Innergemeinschaftliche Erwerbe, für die kein Erwerbskonto festgelegt ist (7 %, ohne Vorsteuerabzug, andere
 * Sätze) – diese Zeilen fehlen im Stapel (`buchungenAusBelegen`); LIESMICH nennt sie mit Tag und Betrag.
 */
export function igErwerbOhneKonto(belege: Beleg[], kontenrahmen: Kontenrahmen, o?: BelegBuchungsOptionen): IgErwerbOhneKonto[] {
  const k = kontenFuer(kontenrahmen, o?.vorgaben);
  const aus: IgErwerbOhneKonto[] = [];
  for (const b of belege) {
    if (b.steuerschuld !== "ige" || !belegImStapel(b, o) || o?.igeNichtBuchen?.has(b.id)) continue;
    const mitVst = b.vorsteuer && !o?.kleinunternehmer;
    const teil = mitVst && belegTeilabzug(b) ? vorsteuerAufteilung(b) : null;
    for (const s of b.steuer) {
      if (!s.brutto_cent) continue;
      const t = teil?.find((x) => x.satz === s.satz);
      if (teil && t && t.abziehbar_cent < t.ust_cent) {
        const g = teilenNachVorsteuer(s.brutto_cent, s.satz, t.abziehbar_cent, true);
        if (g.mit && !igErwerbKonto(k, s.satz, true)) aus.push({ beleg: b, satz: satz13b(s.satz), betrag_cent: g.mit, vorsteuer: true });
        if (g.ohne && !igErwerbKonto(k, s.satz, false)) aus.push({ beleg: b, satz: satz13b(s.satz), betrag_cent: g.ohne, vorsteuer: false });
        continue;
      }
      if (!igErwerbKonto(k, s.satz, mitVst)) aus.push({ beleg: b, satz: satz13b(s.satz), betrag_cent: s.brutto_cent, vorsteuer: mitVst });
    }
  }
  return aus;
}

/**
 * Gehört ein Beleg in den Buchungsstapel? Nicht: Personal (Lohn bucht die Steuerberatung aus der Lohnbuchhaltung,
 * sonst doppelt). StB-Prüfung (B-6): privat ausgelegte Belege einer Kapitalgesellschaft stehen jetzt im Stapel – auf
 * dem Verrechnungskonto Gesellschafter (vorher nur in der Belegliste, die Kanzlei musste nachbuchen).
 */
export function belegImStapel(b: Pick<Beleg, "kategorie" | "zahlung">, _o?: { kapitalgesellschaft?: boolean }): boolean {
  return b.kategorie !== "personal";
}

// ---------------------------------------------------------------------------------------------------------------------
// DATEV-Format „Buchungsstapel“ (EXTF, Version 700, Kategorie 21)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Spaltenüberschriften der Buchungszeile, Version 700 (125 Felder) – laut StB-Prüfung (3.1) in der Reihenfolge des
 * Leitfadens. Gefüllt werden die Felder 1–14, 21/22 (Beleginfo 1: Buchungs-GUID), 37, 40, 114, 115, 116 und 118.
 */
export const DATEV_SPALTEN: readonly string[] = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "Diverse Adressnummer",
  "Geschäftspartnerbank",
  "Sachverhalt",
  "Zinssperre",
  "Beleglink",
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [`Beleginfo - Art ${i}`, `Beleginfo - Inhalt ${i}`]),
  "KOST1 - Kostenstelle",
  "KOST2 - Kostenstelle",
  "Kost-Menge",
  "EU-Land u. UStID (Bestimmung)",
  "EU-Steuersatz (Bestimmung)",
  "Abw. Versteuerungsart",
  "Sachverhalt L+L",
  "Funktionsergänzung L+L",
  "BU 49 Hauptfunktionstyp",
  "BU 49 Hauptfunktionsnummer",
  "BU 49 Funktionsergänzung",
  ...Array.from({ length: 20 }, (_, i) => i + 1).flatMap((i) => [`Zusatzinformation - Art ${i}`, `Zusatzinformation- Inhalt ${i}`]),
  "Stück",
  "Gewicht",
  "Zahlweise",
  "Forderungsart",
  "Veranlagungsjahr",
  "Zugeordnete Fälligkeit",
  "Skontotyp",
  "Auftragsnummer",
  "Buchungstyp",
  "USt-Schlüssel (Anzahlungen)",
  "EU-Land (Anzahlungen)",
  "Sachverhalt L+L (Anzahlungen)",
  "EU-Steuersatz (Anzahlungen)",
  "Erlöskonto (Anzahlungen)",
  "Herkunft-Kz",
  "Buchungs GUID",
  "KOST-Datum",
  "SEPA-Mandatsreferenz",
  "Skontosperre",
  "Gesellschaftername",
  "Beteiligtennummer",
  "Identifikationsnummer",
  "Zeichnernummer",
  "Postensperre bis",
  "Bezeichnung SoBil-Sachverhalt",
  "Kennzeichen SoBil-Buchung",
  "Festschreibung",
  "Leistungsdatum",
  "Datum Zuord. Steuerperiode",
  "Fälligkeit",
  "Generalumkehr (GU)",
  "Steuersatz",
  "Land",
  "Abrechnungsreferenz",
  "BVV-Position",
  "EU-Land u. UStID (Ursprung)",
  "EU-Steuersatz (Ursprung)",
  "Abw. Skontokonto",
];

/** Index des Felds „Buchungs GUID“ (Feld 103) – bleibt beim Import leer, „wird von DATEV verwendet“ (StB-Prüfung 3.1) */
export const DATEV_GUID = DATEV_SPALTEN.indexOf("Buchungs GUID");
/** Beleginfo 1 (Felder 21/22): Art „Buchungs-GUID“ und die stabile Kennung der Buchung */
export const DATEV_BELEGINFO_ART1 = DATEV_SPALTEN.indexOf("Beleginfo - Art 1");
export const DATEV_BELEGINFO_INHALT1 = DATEV_SPALTEN.indexOf("Beleginfo - Inhalt 1");
/** Art der Beleginfo, unter der die stabile Kennung steht (höchstens 20 Zeichen) */
export const BELEGINFO_GUID = "Buchungs-GUID";
/** Feld 114 „Festschreibung“ (0 = nicht festschreiben) und Feld 118 „Generalumkehr (GU)“ */
export const DATEV_FESTSCHREIBUNG = DATEV_SPALTEN.indexOf("Festschreibung");
export const DATEV_GENERALUMKEHR = DATEV_SPALTEN.indexOf("Generalumkehr (GU)");
/** Felder 115 „Leistungsdatum“, 116 „Datum Zuord. Steuerperiode“ und 40 „EU-Land u. UStID (Bestimmung)“ */
export const DATEV_LEISTUNGSDATUM = DATEV_SPALTEN.indexOf("Leistungsdatum");
export const DATEV_STEUERPERIODE = DATEV_SPALTEN.indexOf("Datum Zuord. Steuerperiode");
export const DATEV_EU_USTID = DATEV_SPALTEN.indexOf("EU-Land u. UStID (Bestimmung)");
/** Feld 41 „EU-Steuersatz (Bestimmung)“ – OSS: Steuersatz des Bestimmungslands */
export const DATEV_EU_STEUERSATZ = DATEV_SPALTEN.indexOf("EU-Steuersatz (Bestimmung)");
/** Feld „KOST1 - Kostenstelle“ (R12, Filiale einer Kasse) */
export const DATEV_KOST1 = DATEV_SPALTEN.indexOf("KOST1 - Kostenstelle");

export interface DatevExtfOptionen {
  beraternummer?: string;
  mandantennummer?: string;
  /** Beginn des Wirtschaftsjahres (ISO), z. B. "2026-01-01" */
  wjBeginn: string;
  /** Zeitraum des Stapels (ISO); alle Belegdaten müssen darin liegen */
  von: string;
  bis: string;
  kontenrahmen: Kontenrahmen;
  /** Stellen der Sachkonten, Standard 4 */
  sachkontenlaenge?: number;
  /** Bezeichnung des Stapels, höchstens 30 Zeichen */
  bezeichnung?: string;
  /** Zeitpunkt der Erzeugung (ISO) – wird ohne Zeitzonenumrechnung übernommen */
  erzeugtAm: string;
}

/** Textfeld im DATEV-Format: in doppelten Anführungszeichen, innere Anführungszeichen verdoppelt. */
const inAnfz = (s: string) => `"${s.replace(/"/g, '""')}"`;
const inAnfzOderLeer = (s: string | undefined) => (s ? inAnfz(s) : "");
/** Betrag „1234,56“ (Komma, kein Tausenderpunkt) */
const betragMitKomma = (cent: number) => {
  const c = Math.round(Math.abs(cent));
  return `${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;
};
const nurZiffern = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
const jjjjmmtt = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
/** Belegdatum im DATEV-Format TTMM – das Jahr ergibt sich aus dem Stapelzeitraum */
const ttmm = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7);
const ttmmjjjjOhnePunkt = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
const ttmmjjjj = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** „Erzeugt am“ als JJJJMMTThhmmssfff aus einem ISO-Zeitpunkt; fehlende Teile werden mit Nullen gefüllt. */
function erzeugtAmAus(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?/.exec(iso);
  if (!m) return "";
  return `${m[1]}${m[2]}${m[3]}${m[4] ?? "00"}${m[5] ?? "00"}${m[6] ?? "00"}${(m[7] ?? "").padEnd(3, "0")}`;
}

/**
 * DATEV-Format „Buchungsstapel“ als Text: Kopfzeile mit 31 Feldern, Spaltenüberschriften, je Buchung eine Zeile mit
 * 125 Feldern; Zeilenende CRLF. Textfelder stehen in Anführungszeichen, Zahlen nicht. Die Kodierung nach Windows-1252
 * übernimmt `datevExtfBytes`.
 */
export function datevExtf(buchungen: Buchung[], o: DatevExtfOptionen): string {
  const kopf = [
    inAnfz("EXTF"), // 1 Kennzeichen
    "700", // 2 Versionsnummer
    "21", // 3 Datenkategorie: Buchungsstapel
    inAnfz("Buchungsstapel"), // 4 Formatname
    "13", // 5 Formatversion
    erzeugtAmAus(o.erzeugtAm), // 6 Erzeugt am
    "", // 7 Importiert
    inAnfz("RE"), // 8 Herkunft
    inAnfz(MARKE.name), // 9 Exportiert von
    "", // 10 Importiert von
    nurZiffern(o.beraternummer), // 11 Beraternummer
    nurZiffern(o.mandantennummer), // 12 Mandantennummer
    jjjjmmtt(o.wjBeginn), // 13 WJ-Beginn
    String(o.sachkontenlaenge ?? 4), // 14 Sachkontenlänge
    jjjjmmtt(o.von), // 15 Datum vom (JJJJMMTT – fachlich zu prüfen)
    jjjjmmtt(o.bis), // 16 Datum bis
    inAnfz(kuerze(o.bezeichnung ?? "Rechnungen und Belege", 30)), // 17 Bezeichnung (Marke steht in Feld 9; mit Marke würde ein langer Name gekürzt)
    "", // 18 Diktatkürzel
    "1", // 19 Buchungstyp: Finanzbuchführung
    "0", // 20 Rechnungslegungszweck: unabhängig
    "0", // 21 Festschreibung: keine
    inAnfz("EUR"), // 22 Währungskennzeichen
    "", // 23 reserviert
    "", // 24 Derivatskennzeichen
    "", // 25 reserviert
    "", // 26 reserviert
    inAnfz(o.kontenrahmen === "SKR03" ? "03" : "04"), // 27 Sachkontenrahmen
    "", // 28 ID der Branchenlösung
    "", // 29 reserviert
    "", // 30 reserviert
    "", // 31 Anwendungsinformation
  ];
  const zeilen = buchungen.map((b) => {
    const f = new Array<string>(DATEV_SPALTEN.length).fill("");
    f[0] = betragMitKomma(b.betrag_cent);
    f[1] = inAnfz(b.soll_haben);
    f[2] = inAnfz("EUR");
    f[6] = b.konto;
    f[7] = b.gegenkonto;
    f[8] = inAnfzOderLeer(b.bu_schluessel);
    f[9] = ttmm(b.datum);
    f[10] = inAnfzOderLeer(belegfeld1Aus(b.belegfeld1));
    f[11] = inAnfzOderLeer(b.belegfeld2 ? belegfeld1Aus(b.belegfeld2).slice(0, 12) : "");
    f[13] = inAnfz(kuerze(b.buchungstext, 60));
    // StB-Prüfung 3.1: Feld 103 bleibt leer; die stabile Kennung in Beleginfo 1 (Jahres- und Monatspakete erkennbar gleich)
    if (b.guid) {
      f[DATEV_BELEGINFO_ART1] = inAnfz(BELEGINFO_GUID);
      f[DATEV_BELEGINFO_INHALT1] = inAnfz(b.guid.slice(0, 36));
    }
    // Feld 114: 0 = beim Import nicht festschreiben (leer hieße Festschreibung), solange der Stapel ungeprüft ist (A-5)
    f[DATEV_FESTSCHREIBUNG] = "0";
    // Feld 118: Storno als Generalumkehr auf der ursprünglichen Soll/Haben-Seite
    if (b.generalumkehr) f[DATEV_GENERALUMKEHR] = "1";
    if (b.eu_ustid) f[DATEV_EU_USTID] = inAnfz(b.eu_ustid.slice(0, 15));
    if (b.eu_steuersatz) f[DATEV_EU_STEUERSATZ] = betragMitKomma(Math.round(b.eu_steuersatz * 100));
    if (b.kost1) f[DATEV_KOST1] = inAnfz(b.kost1.slice(0, 36));
    // Datumsfelder TTMMJJJJ – damit ordnet DATEV die Umsatzsteuer wie die Voranmeldung der App zu
    if (b.leistungsdatum) f[DATEV_LEISTUNGSDATUM] = ttmmjjjjOhnePunkt(b.leistungsdatum);
    if (b.steuerperiode) f[DATEV_STEUERPERIODE] = ttmmjjjjOhnePunkt(b.steuerperiode);
    return f.join(";");
  });
  return [kopf.join(";"), DATEV_SPALTEN.join(";"), ...zeilen].join("\r\n") + "\r\n";
}

/** Zeichen außerhalb von Latin-1, die Windows-1252 in 0x80–0x9F ablegt (Euro, typografische Anführungszeichen, Gedankenstrich …). */
const CP1252_SONDERZEICHEN: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Text nach Windows-1252 (ANSI) kodieren, wie DATEV es erwartet: ASCII und Latin-1 (Ä Ö Ü ä ö ü ß …) unverändert, das
 * Euro-Zeichen als 0x80, typografische Zeichen nach Tabelle, alles andere als „?“.
 */
export function datevExtfBytes(inhalt: string): Uint8Array {
  const aus = new Uint8Array(inhalt.length);
  let n = 0;
  for (const zeichen of inhalt) {
    const cp = zeichen.codePointAt(0)!;
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) aus[n++] = cp;
    else aus[n++] = CP1252_SONDERZEICHEN[cp] ?? 0x3f;
  }
  return aus.slice(0, n);
}

/**
 * Lesbare Buchungsliste mit Semikolon für Menschen und Tabellenprogramme: UTF-8 mit BOM, Zeilenende CRLF. Letzte Spalte
 * „Generalumkehr“: „ja“ bei Stornos (DATEV kehrt die Buchung um – für Salden mit umgekehrtem Vorzeichen zählen).
 */
export function buchungslisteCsv(buchungen: Buchung[]): string {
  const feld = (s: string) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const zeilen = buchungen.map((b) =>
    [ttmmjjjj(b.datum), betragMitKomma(b.betrag_cent), b.soll_haben, b.konto, b.gegenkonto, b.bu_schluessel, b.belegfeld1, b.buchungstext, b.ust_satz === null ? "" : String(b.ust_satz), b.guid ?? "", b.generalumkehr ? "ja" : ""]
      .map(feld)
      .join(";"),
  );
  return "﻿" + ["Datum;Betrag;S/H;Konto;Gegenkonto;BU;Beleg;Text;USt;Buchungs-GUID;Generalumkehr", ...zeilen].join("\r\n") + "\r\n";
}

/** Fachlich unsichere Punkte dieser Datei als Sätze – für die PRUEFLISTE. */
export function pruefpunkteBuchungen(): string[] {
  return [
    "Sachkonten: Forderungen aus L+L ohne Kontokorrent (SKR03 1410, SKR04 1210), Verbindlichkeiten aus L+L ohne Kontokorrent (1610/3310), Kasse (1000/1600), Privateinlagen (1890/2180) und Erlöskonten 19 % (8400/4400), 7 % (8300/4300), Kleinunternehmer § 19 UStG (8195/4185) gegen den aktuellen DATEV-Kontenrahmen prüfen.",
    "Erlöskonten nach Steuerart: igL 8125/4125 (mit „EU-Land u. UStID“), § 13b im Inland 8337/4337, sonstige Leistung an Unternehmen im übrigen Gemeinschaftsgebiet (Empfänger schuldet die Steuer, Kz 21) 8336/4336, im Drittland steuerbare Leistung 8338/4338 – die Steuerberatung nannte 8338 für die EU-Leistung; nach unserem Stand ist 8338 das Drittlandkonto und 8336 das EU-Konto. Bitte prüfen. StB-Prüfung (B-1): bestätigt. Nullsteuersatz (§ 12 Abs. 3 UStG, Kz 87, B-2): eigene Steuerart und eigenes Erlöskonto mit Kz-87-Automatik, Standard SKR03 8290 / SKR04 4290 – der Bericht nennt keine Nummer („in Rewe nach Nullsteuersatz bzw. § 12 Abs. 3 suchen“); über die Kontenvorgaben der Kanzlei festlegen.",
    "E-208: Steuerfreie Ausfuhrlieferungen (§ 4 Nr. 1 Buchst. a UStG, Kz 43) auf SKR03 8120 / SKR04 4120 statt wie bisher 8100/4100 (§ 4 Nr. 8 ff., Kz 48) – E-214: vom Steuerberater bestätigt (26.10.2026); übrige Kz-43-Befreiungen (§ 4 Nr. 2–7 UStG) auf SKR03 8150 / SKR04 4150 („Sonstige steuerfreie Umsätze § 4 Nr. 2–7 UStG“). Beides im DATEV-Testimport prüfen (T-221); über die Kontenvorgaben änderbar.",
    "Automatikkonten: nur SKR03 3400/3300 (Wareneingang 19/7 %), 3120/3123 (§ 13b) und SKR04 5400/5300 gelten als Automatikkonten (kein BU, ohne Vorsteuerabzug BU 40). Alle anderen Kategorie-Konten (z. B. 4930, 4600, 4210, 3100, 0420) gelten als Konten ohne Automatik und bekommen bei Vorsteuer BU 9 (19 %) bzw. 8 (7 %). Für die Sätze 16 % und 5 % (2. Halbjahr 2020) setzt der Export keinen BU-Schlüssel.",
    "BU-Schlüssel 40 („keine Steuer“ bei Automatikkonten) wird nur auf Automatikkonten gesetzt, wenn ein Beleg keinen Vorsteuerabzug erlaubt. StB-Prüfung (A-2): Kleinunternehmer buchen Wareneingang auf SKR03 3200 / SKR04 5200 ohne Schlüssel statt 3400/5400 mit BU 40.",
    "StB-Prüfung (A-1): Belegbuchungen (Eingangsbelege, Gutschriften, Kassenfehlbeträge) mit dem Zahlungskonto (Verbindlichkeiten, Kasse, Bank, Privat bzw. Verrechnungskonto) in Feld 7 „Konto“ im Haben und dem Sachkonto mit BU-Schlüssel in Feld 8 „Gegenkonto“ – im Testimport prüfen, ob Rewe den Schlüssel so annimmt.",
    "§ 13b-Eingangsleistungen (R11): mit Vorsteuerabzug SKR03 3120 (Bauleistung eines im Inland ansässigen Unternehmers) bzw. 3123 (sonstige Leistung eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers), SKR04 5920/5923; ohne Vorsteuerabzug (Kleinunternehmer, Belege mit „Vorsteuer abziehbar“ aus) SKR03 3140/3143, SKR04 5940/5943 – alle als Automatikkonten für die Umsatzsteuer (und ggf. Vorsteuer) 19 %. Im Prüfbericht der Steuerberatung vom 21./22.10.2026 schriftlich als richtig bestätigt (B-3, Frage 4; PRUEFLISTE T-201, E-197); 7-%-Fälle und § 13b-Lieferungen (Schrott, Mobilfunk) sind nicht abgebildet.",
    "E-222/E-227 innergemeinschaftlicher Erwerb (Beleg „Waren aus dem EU-Ausland“): Bemessungsgrundlage ohne BU auf ein Automatikkonto für Erwerbsteuer und Vorsteuer – mit Vorsteuerabzug 19 % SKR03 3425 / SKR04 5425, 7 % SKR03 3420 / SKR04 5420; ohne Vorsteuerabzug 19 % SKR03 3435 / SKR04 5435, 7 % SKR03 3430 / SKR04 5430 (Steuerberater 27.10.2026; über die Kontenvorgaben änderbar). Buchungsdatum = Belegdatum; liegt es nach dem Ende des Monats nach dem Erwerb, Feld 116 = letzter Tag dieses Monats (§ 13 Abs. 1 Nr. 6 UStG). Feld 40 bleibt leer, die USt-IdNr. des Lieferanten steht in LIESMICH. Kleinunternehmer und Betriebe mit nur steuerfreien Umsätzen: ohne festgestellte Erwerbsbesteuerung (Erwerbsschwelle, § 1a Abs. 3 UStG) nicht gebucht, LIESMICH nennt sie. Im Testimport prüfen (T-221).",
    "Gutschriften (§ 14 Abs. 2 Satz 2 UStG) werden als Aufwand auf „bezogene Leistungen“ (SKR03 3100, SKR04 5900) an Verbindlichkeiten gebucht, mit BU 9/8 bei ausgewiesener Steuer – passendes Aufwandskonto je nach Leistung mit der Steuerberatung klären.",
    "Personal-Belege stehen nur in der Belegliste, nicht im Stapel. StB-Prüfung (B-6): privat ausgelegte Belege und Barbelege vor dem ersten Kassenabschluss einer Kapitalgesellschaft auf das Verrechnungskonto Gesellschafter, Standard SKR03 0731 „Verbindlichkeiten gegenüber Gesellschaftern – Restlaufzeit bis 1 Jahr“ (korrigierter Bericht vom 22.10.2026; 0755 ist das Konto für offene Ausschüttungen); SKR04 vorläufig 3560 – UNSICHER, das SKR04-Gegenstück zu 0731 nennt die Kanzlei nach dem Testimport; kanzleiabhängig über die Kontenvorgaben.",
    "Felder 115 „Leistungsdatum“ und 116 „Datum Zuord. Steuerperiode“ (TTMMJJJJ) sind bei Ausgangsrechnungen gefüllt; Feld 40 „EU-Land u. UStID (Bestimmung)“ bei igL und EU-Leistungen – Format und Feldnummern prüfen.",
    "StB-Prüfung (3.1): Stornos als Generalumkehr (Feld 118 = 1) auf der ursprünglichen Soll/Haben-Seite; Feld 114 „Festschreibung“ = 0 in jeder Zeile (Kopf Feld 21 ebenfalls 0).",
    "Spaltenliste der Buchungszeile (125 Felder, Version 700, Formatversion 13): laut StB-Prüfung (3.1) formal konform. Feld 103 „Buchungs GUID“ bleibt leer (wird von DATEV verwendet); die stabile Kennung aus Quelle und Steuersatz steht in Beleginfo 1 (Art „Buchungs-GUID“, Inhalt die GUID).",
    "Dateikopf: „Datum vom“ und „Datum bis“ stehen als JJJJMMTT (nicht TTMMJJJJ), Feld 27 trägt den Kontenrahmen („03“/„04“), Festschreibung 0, Rechnungslegungszweck 0, Herkunft „RE“ – gegen die Formatbeschreibung prüfen. Berater- und Mandantennummer sind beim Import Pflicht.",
    "StB-Prüfung (A-4): Bilanzierende Betriebe (GmbH, UG, AG, GmbH & Co. KG, OHG, KG, e. K., Buchführungspflicht nach § 141 AO – Kontenvorgabe geht vor) bekommen einen Soll-Stapel: Forderungen an Erlöse zum Rechnungsdatum (Feld 115 Leistungsdatum). Zahlungseingänge Bank (SKR03 1200, SKR04 1800) an Forderungen zum Zahltag nur mit der Kontenvorgabe „Zahlungseingänge buchen“ – Standard aus (Nachtrag der Kanzlei vom 22.10.2026: die Kanzlei bucht die Bank aus dem Kontoauszug; bis dahin stehen alle Rechnungen als Forderung, LIESMICH nennt Saldo und offene Forderungen laut Rechnungsliste). EÜR-Übernahme für bilanzierende Betriebe gesperrt (E-4).",
    "Ist-Versteuerung (§ 20 UStG) ohne Bilanz (R11): Rechnungen stehen erst mit dem Zahlungseingang im Stapel – Forderungen (1410/1210) an Erlös mit dem Zahltag als Belegdatum und in Feld 116; unbezahlte Rechnungen stehen nur in der Rechnungsliste. Abschlagsrechnungen ebenso (auch bei Soll), weil die Steuer erst mit der Zahlung entsteht. Ob DATEV die Ist-Versteuerung so ohne OPOS richtig auflöst, ist offen – Testimport.",
    "Belegdatum im Format TTMM: das Jahr ergibt sich aus dem Stapelzeitraum. Alle Buchungen eines Stapels müssen in „Datum vom/bis“ und im Wirtschaftsjahr liegen – der Aufrufer muss je Zeitraum (Monat oder Jahr) einen eigenen Stapel erzeugen.",
    "Belege mit Zahlungsweg Bank werden gegen Verbindlichkeiten aus L+L ohne Kontokorrent gebucht, die Zahlung selbst nicht (sie kommt aus dem Kontoauszug der Steuerberatung). StB-Prüfung (B-6): Kontenvorgabe „Belege gegen Bank“ bucht sie direkt gegen Bank (SKR03 1200, SKR04 1800) – Hausregel der Kanzlei.",
    "StB-Prüfung (B-4, B-9, B-10, B-11): Kontenvorgaben der Kanzlei – Gutscheine (z. B. 1701), Kassendifferenz (Überschuss alternativ 2700/4830 ohne USt), Verrechnungskonto, Bank, Anlagenkonten nach Art (Maschinen 0400/0440, BGA 0420/0650, Kfz 0320/0520, Software 0027/0135), Homeoffice 4288/6348 – in der App einstellbar oder als JSON-Datei der Kanzlei (docs/pruefmappe-steuer/kontenvorgaben.md).",
    "R12 Kasse (GoBD): nur Bargeld über die Kasse – Kartenanteil und App-Zahlungen direkt Geldtransit (1360/1460) an Erlöse 19 %/7 % (8400/8300 bzw. 4400/4300), „auf Rechnung“ Forderungen an Erlöse, der Rest Kasse (1000/1600) an Erlöse; unbare Zahlungen werden im Verhältnis der Umsätze je Steuersatz aufgeteilt (die Kasse kennt die Zuordnung nicht). Kartentrinkgeld (an das Personal bar ausgezahlt) Geldtransit an Kasse ohne Steuer. Gutscheine: Einzweck-Verkauf Erlös zum Satz des Gutscheins, Einlösung kein zweiter Erlös; Mehrzweck-Verkauf an „sonstige Verbindlichkeiten“ (SKR03 1700, SKR04 3500 – UNSICHER), Einlösung Verbindlichkeit an Erlöse. Bargeld zur Bank Geldtransit an Kasse; Privatentnahme 1800/2100 an Kasse; Privateinlage Kasse an 1890/2180 – mit Eigenbeleg-Nummer in Belegfeld 1. Kassendifferenzen: Überschuss Kasse an Erlöse 19 %, Fehlbetrag 4900/6300 an Kasse (mit der Kanzlei abstimmen). Barbelege vor dem ersten Kassenabschluss gegen Privateinlage. Leistungsdatum und Feld 116 = Tag des Z-Bons.",
    "R12 Skonto: gewährte Skonti SKR03 8736 (19 %), 8731 (7 %), 8730 (ohne USt, Kleinunternehmer, 0 %), SKR04 4736/4731/4730 an Forderungen zum Zahltag; auf innergemeinschaftliche Lieferungen SKR03 8743 / SKR04 4743, auf Umsätze mit Steuerschuld des Empfängers (§ 13b, EU-Leistung) SKR03 8741 / SKR04 4741 – beide UNSICHER, mit USt-IdNr. in Feld 40. Erhaltene Skonti nur bei „Waren und Material“ auf SKR03 3736/3731/3730, SKR04 5736/5731/5730; bei anderen Kategorien gegen das Aufwandskonto mit BU wie der Beleg. Die Skontokonten mit Steuersatz gelten als Automatikkonten (kein BU-Schlüssel). Bei Ist-Versteuerung wird je Zahlung der erhaltene Betrag plus Skonto als Erlös und das Skonto als Minderung gebucht.",
    "R12 Sachentnahmen: Privatentnahmen (1800/2100) an „Entnahme durch den Unternehmer … (Waren)“ 7 % SKR03 8915 / SKR04 4610 bzw. 19 % SKR03 8910 / SKR04 4620 – brutto, Automatik. Kontonummern UNSICHER, gegen den aktuellen Kontenrahmen prüfen; Kleinunternehmer: nicht gebucht.",
    "E-165 Personenkonten (Kontenvorgabe, Standard aus): Debitor (10000–69999) statt Forderungen bei Rechnungen, Skonto und Zahlungseingängen, Kreditor (70000–99999) statt Verbindlichkeiten bei Belegen per Überweisung/Karte und Gutschriften; Belegfeld 1 = Rechnungs- bzw. Belegnummer für den OP-Ausgleich. Bar und privat bezahlte Belege bleiben auf Kasse/Privat. Stammdaten als EXTF „Debitoren/Kreditoren“ (Kategorie 16, Formatversion 5). Ist-Versteuerung bilanzierender Betriebe: Feld 116 (Zahltag) unverändert – laut Kanzlei braucht Ist + Bilanzierung vermutlich Personenkonten (Mandantenstamm „Ist“ mit OPOS), im Testimport bestätigen.",
    "E-165 Vorsteuer-Teilabzug (§ 15 Abs. 4 UStG): je Steuersatz zwei Buchungen – abziehbarer Teil brutto mit BU 9/8 (Betrag so gerundet, dass DATEV genau die abziehbare Vorsteuer rechnet), nicht abziehbarer Teil brutto ohne BU auf demselben Aufwandskonto (Automatikkonto BU 40); § 13b-Belege anteilig auf 3123/3143 bzw. 5923/5943. Alternativen: DATEV-Buchungsschlüssel 90/9000 bzw. 9xxx „aufzuteilende Vorsteuer“ (ganze Vorsteuer auf das Konto „Aufzuteilende Vorsteuer“, Aufteilung durch die Kanzlei – DATEV-Hilfe-Dokument 0904313) oder voll mit BU und Umbuchung auf „Nicht abziehbare Vorsteuer“ – bitte bestätigen, welche Variante gewünscht ist.",
    "Belegfeld 1 wird auf die DATEV-zulässigen Zeichen (Ziffern, Buchstaben, $ & % * + - /) gekürzt, Umlaute werden umschrieben – stimmt die Zeichenliste? Textfelder werden nach Windows-1252 kodiert; andere Zeichen werden „?“.",
  ];
}
