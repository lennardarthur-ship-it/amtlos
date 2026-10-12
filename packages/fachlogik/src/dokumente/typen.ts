/**
 * Dokumentvorlagen (E-121): jede Vorlage beschreibt ihr Formular deklarativ (Abschnitte und Felder) und erzeugt aus
 * den Eingaben ein HTML-Dokument, das die App als PDF ausgibt. Rein, ohne DOM und ohne Node-APIs.
 */

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
}

export const LEERER_BETRIEB: Betrieb = { name: "", strasse: "", plz: "", ort: "", verantwortlich: "", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "" };

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
  ist?: string;
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
}

export type EinfachesFeld =
  /** `vorschlaege`: antippbare Formulierungen – bei „text“ ersetzen sie den Inhalt, bei „mehrzeilig“ kommen sie als neue Zeile dazu */
  | (FeldBasis & { art: "text" | "mehrzeilig"; vorbelegung?: "verantwortlich" | "betrieb_kontakt"; vorschlaege?: string[] })
  | (FeldBasis & { art: "datum"; vorbelegung?: "heute" })
  | (FeldBasis & { art: "uhrzeit" })
  /** Euro-Betrag, gespeichert wie eingegeben („1.234,50“) */
  | (FeldBasis & { art: "betrag"; vorbelegung?: string })
  /** Zahl, gespeichert wie eingegeben („1,5“) */
  | (FeldBasis & { art: "zahl"; vorbelegung?: string })
  | (FeldBasis & { art: "wahl"; optionen: Option[]; vorbelegung?: string })
  | (FeldBasis & { art: "schalter"; vorbelegung?: boolean })
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
  abschnitte: VorlagenAbschnitt[];
  /** Rechtsgrundlage für den Dokumentkopf, z. B. „§§ 5, 6 ArbSchG“ */
  grundlage?: string;
  /** Unterlage betrifft eine gespeicherte Person (Mitarbeiter, Kunde): Auswahl füllt diese Felder */
  person?: PersonenBezug;
  /** Feld mit fortlaufender Nummer (z. B. Rechnungsnummer): neue Unterlagen zählen hoch */
  fortlaufend?: string;
  /** Querformat (breite Tabellen, Aushänge) */
  querformat?: boolean;
  html(daten: Daten, betrieb: Betrieb): string;
  /** Ergebnis zum Anzeigen in der App (Summen, Zahllast …) */
  ergebnis?(daten: Daten): [string, string][];
  /** Fehlende Angaben außerhalb des Formulars, z. B. in „Mein Betrieb“ */
  pruefen?(daten: Daten, betrieb: Betrieb): string[];
  /** Reiner Text zum Kopieren, z. B. für die Website */
  alsText?(daten: Daten, betrieb: Betrieb): string;
}
