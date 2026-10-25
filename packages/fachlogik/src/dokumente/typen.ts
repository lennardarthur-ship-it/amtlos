/**
 * Dokumentvorlagen (E-121): jede Vorlage beschreibt ihr Formular deklarativ (Abschnitte und Felder) und erzeugt aus
 * den Eingaben ein HTML-Dokument, das die App als PDF ausgibt. Rein, ohne DOM und ohne Node-APIs.
 */

import type { Gestalt } from "./html.js";

/** Angaben zum Betrieb – einmal eingegeben, in allen Unterlagen vorausgefüllt. */
export interface Betrieb {
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  /** Inhaber/in oder verantwortliche Person */
  verantwortlich: string;
  telefon: string;
  email: string;
  steuernummer: string;
  ust_idnr: string;
  iban: string;
  /** für die zuständige Datenschutz-Aufsichtsbehörde u. a. */
  bundesland: string;
  /** Angaben auf Geschäftsbriefen von Gesellschaften (§ 35a GmbHG, § 37a HGB) – nur ausgefüllt, wenn zutreffend */
  rechtsform?: string;
  registergericht?: string;
  registernummer?: string;
  /** Geschäftsführung bzw. vertretungsberechtigte Personen – bei der GmbH & Co. KG die Geschäftsführer der Komplementärin */
  vertretung?: string;
  /**
   * E-193 (8a): GmbH & Co. KG bzw. UG (haftungsbeschränkt) & Co. KG – Angaben zur persönlich haftenden Gesellschafterin
   * (Komplementärin) für Geschäftsbriefe und Rechnungen (§ 125a Abs. 1 Satz 2, § 177a HGB i. V. m. § 35a GmbHG): Firma,
   * Rechtsform, Sitz, Registergericht und Registernummer; ihre Geschäftsführer stehen in `vertretung`.
   */
  komplementaer?: string;
  komplementaer_rechtsform?: string;
  komplementaer_sitz?: string;
  komplementaer_registergericht?: string;
  komplementaer_registernummer?: string;
  /** Umsatzsteuer nach vereinbarten („soll“) oder vereinnahmten („ist“) Entgelten (§§ 16, 20 UStG) */
  versteuerung?: string;
  /**
   * R11: Kleinunternehmer (§ 19 UStG) bis einschließlich diesem Tag (ISO), danach regelbesteuert – leer, wenn es keinen
   * Wechsel gab. Rechnungen und Belege aus der Zeit davor prüft die App gegen diesen Tag.
   */
  ku_bis?: string;
  /** Logo als Data-URL (PNG/JPEG), erscheint im Briefkopf */
  logo?: string;
  /** Hausfarbe für Briefkopf und Akzente (#rrggbb) */
  farbe?: string;
  /** Bankname und BIC (Rechnungen) */
  bank?: string;
  bic?: string;
  /** Website (Briefkopf, Fußzeile) */
  website?: string;
  /**
   * E-165 (StB-Prüfung 5.2): vorläufige Vorsteuerquote in Prozent bei steuerfreien und steuerpflichtigen Umsätzen
   * (§ 15 Abs. 4 UStG, Schlüssel von der Steuerberatung) – belegt den Anteil beim Einlesen einer E-Rechnung vor. Leer: keine.
   */
  vorsteuerquote?: string;
}

export const LEERER_BETRIEB: Betrieb = { name: "", strasse: "", plz: "", ort: "", verantwortlich: "", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "", rechtsform: "", registergericht: "", registernummer: "", vertretung: "", komplementaer: "", komplementaer_rechtsform: "", komplementaer_sitz: "", komplementaer_registergericht: "", komplementaer_registernummer: "", versteuerung: "", ku_bis: "", logo: "", farbe: "", bank: "", bic: "", website: "", vorsteuerquote: "" };

/** Ein Wert in einem Listeneintrag. */
export type EintragWert = string | boolean | string[] | null;
export type Eintrag = Record<string, EintragWert>;
export type Wert = EintragWert | Eintrag[];
export type Daten = Record<string, Wert>;

export interface Option {
  wert: string;
  text: string;
  /** Kurzbeleg, z. B. „BGW“ oder „§ 622 BGB“ – in der App unter dem Baustein angezeigt */
  quelle?: string;
  /**
   * Branchengruppen, für die der Baustein passt (R10), z. B. ["friseur", "kosmetik"]; „alle“ oder ohne Angabe: für jeden
   * Betrieb. Die App zeigt passende zuerst und den Rest unter „Weitere“ (siehe BRANCHEN_GRUPPEN).
   */
  gruppen?: string[];
  /**
   * R12: Baustein nur zeigen, wenn die Bedingung erfüllt ist (mehrere: eine genügt) – gewählte bleiben immer sichtbar,
   * z. B. „innergemeinschaftliche Lieferung“ nicht bei Kleinunternehmern.
   */
  wenn?: Bedingung | Bedingung[];
}

/** Vorbereiteter Listeneintrag zum Übernehmen, z. B. eine typische Gefährdung mit Maßnahmen. */
export interface Vorschlag {
  /** Gruppe zum Filtern, z. B. Branche */
  gruppe?: string;
  titel: string;
  werte: Eintrag;
  quelle?: string;
}

/** Bedingung: Feld nur zeigen, wenn ein anderes Feld gesetzt ist (Schalter an) bzw. einen bestimmten Wert hat. */
export interface Bedingung {
  feld: string;
  /** Wert (bei Mehrfachauswahl: ist ausgewählt); mehrere Werte: einer davon genügt */
  ist?: string | string[];
  /** Bedingung umkehren: Feld zeigen, wenn die Bedingung NICHT erfüllt ist */
  nicht?: boolean;
}

interface FeldBasis {
  id: string;
  label: string;
  hilfe?: string;
  /** fehlt die Angabe, nennt die App sie unter „Fehlt noch“ (das PDF lässt sich trotzdem erstellen) */
  pflicht?: boolean;
  wenn?: Bedingung;
  /** selten nötig: die App zeigt das Feld erst unter „Weitere Angaben“ (oder wenn es schon ausgefüllt ist) */
  selten?: boolean;
  /** hervorgehoben (R10): Angabe, die nur der Betrieb kennt, z. B. der Produktname im Hautschutzplan */
  hervor?: boolean;
  /** R12 (Listeneinträge): ein neuer Eintrag übernimmt den Wert des vorigen (z. B. Steuersatz der letzten Position) */
  wieVorher?: boolean;
}

export type EinfachesFeld =
  /** `vorschlaege`: antippbare Formulierungen – bei „text“ ersetzen sie den Inhalt, bei „mehrzeilig“ kommen sie als neue Zeile dazu */
  /** `vorbelegung`: Angaben aus „Mein Betrieb“ oder ein fester Startwert (`{ text: "Stück" }`) */
  /**
   * `vorschlagGruppen` (R10): Branchengruppen je Vorschlag (fehlt einer: für alle) – die App zeigt nur die passenden.
   * `vorbelegungGruppen`: die Vorbelegung gilt nur für diese Branchengruppen (z. B. „prüfende Elektrofachkraft“ = Inhaber
   * nur im Handwerk). `vorschlaegeAus`: Vorschläge aus einer anderen Liste derselben Unterlage (z. B. Kontrollpunkte).
   */
  | (FeldBasis & { art: "text" | "mehrzeilig"; vorbelegung?: "verantwortlich" | "betrieb_kontakt" | { text: string }; vorschlaege?: string[]; vorschlagGruppen?: Record<string, string[]>; vorbelegungGruppen?: string[]; vorschlaegeAus?: { liste: string; feld: string }; /** R12: Startwert je Branchengruppe (erste passende), z. B. Einheit „Pauschale“ im Salon */ vorbelegungJe?: Record<string, string> })
  | (FeldBasis & { art: "datum"; vorbelegung?: "heute" })
  /** `jetzt`: Knopf „Jetzt“ setzt die aktuelle Uhrzeit */
  | (FeldBasis & { art: "uhrzeit"; jetzt?: boolean })
  /** Euro-Betrag, gespeichert wie eingegeben („1.234,50“) */
  | (FeldBasis & { art: "betrag"; vorbelegung?: string })
  /** Zahl, gespeichert wie eingegeben („1,5“) */
  | (FeldBasis & { art: "zahl"; vorbelegung?: string })
  /** `vorbelegungJe` (R11): Startwert je Branchengruppe des Betriebs (erste passende Gruppe), sonst `vorbelegung` */
  | (FeldBasis & { art: "wahl"; optionen: Option[]; vorbelegung?: string; vorbelegungJe?: Record<string, string> })
  /** `vorbelegungJe` (R12): Startwert je Branchengruppe, z. B. Bruttopreise im Salon und im Café */
  | (FeldBasis & { art: "schalter"; vorbelegung?: boolean; vorbelegungJe?: Record<string, boolean> })
  | (FeldBasis & { art: "mehrfach"; optionen: Option[] })
  /** Textbausteine zum Ankreuzen (Liste untereinander, mit Quelle); gespeichert werden die Werte */
  | (FeldBasis & { art: "bausteine"; optionen: Option[]; vorbelegung?: string[] });

/** Wiederholbare Gruppe, z. B. Gefährdungen, Gefahrstoffe, Teilnehmende. */
export type ListenFeld = FeldBasis & {
  art: "liste";
  /** Bezeichnung eines Eintrags („Gefährdung“) für „+ Gefährdung hinzufügen“ */
  eintrag: string;
  /** Feld, dessen Wert einen Eintrag in der Übersicht benennt */
  titelFeld: string;
  felder: EinfachesFeld[];
  /** Einträge einer neuen Unterlage (sonst ein leerer Eintrag) */
  start?: Eintrag[];
  /** Neue Unterlage beginnt ohne Eintrag (z. B. wenn Vorschläge der bessere Start sind) */
  leerStarten?: boolean;
  /** Vorbereitete Einträge zum Übernehmen */
  vorschlaege?: Vorschlag[];
  /** Bezeichnung der Gruppen, z. B. „Branche“ */
  gruppenLabel?: string;
  /** Einträge lassen sich aus den gespeicherten Mitarbeitern übernehmen (Feld `titelFeld` = Name) */
  ausMitarbeitern?: boolean;
};

export type Feld = EinfachesFeld | ListenFeld;

export interface VorlagenAbschnitt {
  titel?: string;
  hilfe?: string;
  felder: Feld[];
}

/** Gespeicherte Personen, die Vorlagen vorausfüllen (E-124): Mitarbeiter und Kunden. */
export type PersonenArt = "mitarbeiter" | "kunde";
export type PersonAngaben = { name: string } & Record<string, string | null>;
export type Person = PersonAngaben & { id: string };
/** Zuordnung Personenfeld → Feld der Vorlage, z. B. { name: "kunde_name", anschrift: "kunde_anschrift" } */
export interface PersonenBezug {
  art: PersonenArt;
  felder: Record<string, string>;
}

export type Bereich = "steuern" | "datenschutz" | "personal" | "arbeitsschutz" | "betrieb" | "gastro" | "beauty";

export interface Vorlage {
  id: string;
  /** Titel des Dokuments */
  titel: string;
  /** ein Satz: was im Dokument steht */
  beschreibung: string;
  bereich: Bereich;
  /** Pflichten im Katalog, die das Dokument belegt */
  pflichten: string[];
  /** Feld, das eine einzelne Unterlage in „Meine Unterlagen“ benennt (z. B. Arbeitsbereich) */
  namensFeld?: string;
  /** Titel der einzelnen Unterlage, wenn er von den Daten abhängt (z. B. „Stornorechnung“, „Gutschrift“) – für Name und Dateiname */
  titelFuer?(daten: Daten): string;
  abschnitte: VorlagenAbschnitt[];
  /** Rechtsgrundlage für den Dokumentkopf, z. B. „§§ 5, 6 ArbSchG“ */
  grundlage?: string;
  /** Rechtsgrundlage nach den Angaben (z. B. nur die gewählten Erklärungen) – statt `grundlage` im Dokumentkopf */
  grundlageFuer?: (d: Daten, b: Betrieb) => string;
  /** Unterlage betrifft eine gespeicherte Person (Mitarbeiter, Kunde): Auswahl füllt diese Felder */
  person?: PersonenBezug;
  /** Feld mit fortlaufender Nummer (z. B. Rechnungsnummer): neue Unterlagen zählen hoch */
  fortlaufend?: string;
  /** geht an Kunden (Rechnung): ohne Rechtsgrundlage und Bereich im Kopf – das ist für die eigenen Unterlagen */
  kundendokument?: boolean;
  /**
   * Aushang für Gäste bzw. Kundschaft (Allergenliste): ohne Rechtsgrundlage und Bereich im Kopf wie ein Kundendokument,
   * aber ohne dessen Folgen in der App (Teilen erst bei vollständigen Pflichtangaben, Hinweis auf fehlenden Absender) –
   * das leere Blatt zum Ausfüllen von Hand bleibt so druckbar.
   */
  ohneKopfangaben?: boolean;
  /** wird beim ersten Teilen oder Drucken festgeschrieben (GoBD): danach nicht mehr änderbar oder löschbar (E-127) */
  festschreiben?: boolean;
  /**
   * R12: Nachweis (Arbeitszeit, NachwG, Ausweis-Hinweis): wird wie eine Rechnung beim ersten Teilen festgeschrieben,
   * korrigiert aber nicht per Storno, sondern als neue Fassung mit Datum und Grund – die alte Fassung bleibt erhalten.
   * Zusammen mit `festschreiben`.
   */
  korrektur?: boolean;
  /** Umsätze lassen sich aus festgeschriebenen Rechnungen übernehmen (Umsatzsteuer-Voranmeldung, E-128) */
  ausRechnungen?: boolean;
  /** StB-Prüfung (5.2, C-9): OSS-Erklärung bzw. Zusammenfassende Meldung aus den geteilten Rechnungen übernehmen */
  ausEuRechnungen?: "oss" | "zm";
  /** lässt sich zusätzlich als E-Rechnung (XRechnung) teilen (E-128) */
  eRechnung?: boolean;
  /** Korrektur einer festgeschriebenen Unterlage nur per Storno (Rechnung) */
  storno?: boolean;
  /** Startwerte aus dem Pflichten-Check: Feld der Vorlage → Profilfeld (z. B. kleinunternehmer → ust.kleinunternehmer) */
  ausProfil?: Record<string, string>;
  /**
   * R12: Startwerte aus mehreren Antworten des Pflichten-Checks (z. B. Bruttopreise, wenn nur Privatkunden), die
   * `ausProfil` nicht abbildet – beim Anlegen einer neuen Unterlage, pro Unterlage überschreibbar.
   */
  profilStart?(profil: Record<string, unknown>, betrieb?: Betrieb): Daten;
  /** Startwerte aus „Mein Betrieb“: Feld → Betriebsfeld (z. B. Soll-/Ist-Versteuerung) */
  ausBetrieb?: Record<string, keyof Betrieb>;
  /** Querformat (breite Tabellen, Aushänge) */
  querformat?: boolean;
  /** Gestaltung passend zum Zweck (E-129): Brief, Vertrag, Aushang, Nachweis, Formular, Handbuch – Standard Nachweis */
  gestalt?: Gestalt;
  html(daten: Daten, betrieb: Betrieb): string;
  /** Ergebnis zum Anzeigen in der App (Summen, Zahllast …) */
  ergebnis?(daten: Daten): [string, string][];
  /** Pflichtfelder, die bei diesen Angaben keine Pflicht sind (R11: Empfänger bei der Kleinbetragsrechnung) */
  nichtPflicht?(daten: Daten): string[];
  /** Fehlende Angaben außerhalb des Formulars, z. B. in „Mein Betrieb“ */
  pruefen?(daten: Daten, betrieb: Betrieb): string[];
  /**
   * Hinweise, die nicht am Teilen hindern (R10): z. B. Leitweg-ID bei Behörden, EU-Kunde mit 19 %, Abweichung vom
   * Pflichten-Check. `extra.kleinunternehmer`: Antwort im Pflichten-Check, falls vorhanden.
   */
  hinweise?(daten: Daten, betrieb: Betrieb, extra?: { kleinunternehmer?: boolean | null; /** R11: Handwerk oder Bau laut Pflichten-Check */ handwerk?: boolean }): string[];
  /**
   * Nachkontrolle Rechtsanwalt (21.10.2026): Form, in der die Unterlage auszuhändigen ist (NachwG: Schriftform in den
   * Branchen nach § 2a SchwarzArbG, sonst Textform). Die App zeigt den Text als Kasten am Anfang des Ablaufs und im
   * Abschluss vor dem Teilen. `offen`: die Angabe, die die Form bestimmt, fehlt noch.
   */
  formHinweis?(daten: Daten): { form: "schrift" | "text" | "offen" | "unterschrift"; text: string } | null;
  /** Meldung aus `pruefen` → Feld, bei dem man sie behebt (für „Ergänzen“ im Abschluss) */
  pruefenZu?: Record<string, string>;
  /** Reiner Text zum Kopieren, z. B. für die Website */
  alsText?(daten: Daten, betrieb: Betrieb): string;
}
