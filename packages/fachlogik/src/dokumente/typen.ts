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
}

export const LEERER_BETRIEB: Betrieb = { name: "", strasse: "", plz: "", ort: "", verantwortlich: "", telefon: "", email: "" };

/** Ein Wert in einem Listeneintrag. */
export type EintragWert = string | boolean | string[] | null;
export type Eintrag = Record<string, EintragWert>;
export type Wert = EintragWert | Eintrag[];
export type Daten = Record<string, Wert>;

export interface Option {
  wert: string;
  text: string;
}

/** Bedingung: Feld nur zeigen, wenn ein anderes Feld gesetzt ist (Schalter an) bzw. einen bestimmten Wert hat. */
export interface Bedingung {
  feld: string;
  ist?: string;
}

interface FeldBasis {
  id: string;
  label: string;
  hilfe?: string;
  /** fehlt die Angabe, nennt die App sie unter „Fehlt noch“ (das PDF lässt sich trotzdem erstellen) */
  pflicht?: boolean;
  wenn?: Bedingung;
}

export type EinfachesFeld =
  | (FeldBasis & { art: "text" | "mehrzeilig"; vorbelegung?: "verantwortlich" | "betrieb_kontakt" })
  | (FeldBasis & { art: "datum"; vorbelegung?: "heute" })
  | (FeldBasis & { art: "uhrzeit" })
  | (FeldBasis & { art: "wahl"; optionen: Option[]; vorbelegung?: string })
  | (FeldBasis & { art: "schalter"; vorbelegung?: boolean })
  | (FeldBasis & { art: "mehrfach"; optionen: Option[] });

/** Wiederholbare Gruppe, z. B. Gefährdungen, Gefahrstoffe, Teilnehmende. */
export type ListenFeld = FeldBasis & {
  art: "liste";
  /** Bezeichnung eines Eintrags („Gefährdung“) für „+ Gefährdung hinzufügen“ */
  eintrag: string;
  /** Feld, dessen Wert einen Eintrag in der Übersicht benennt */
  titelFeld: string;
  felder: EinfachesFeld[];
};

export type Feld = EinfachesFeld | ListenFeld;

export interface VorlagenAbschnitt {
  titel?: string;
  hilfe?: string;
  felder: Feld[];
}

export type Bereich = "arbeitsschutz" | "datenschutz" | "personal" | "steuern" | "gastro" | "beauty";

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
  /** Querformat (breite Tabellen, Aushänge) */
  querformat?: boolean;
  html(daten: Daten, betrieb: Betrieb): string;
}
