/**
 * TypeScript-Abbild von packages/rules-schema/pflicht.schema.json und regelwert.schema.json.
 * Das JSON-Schema ist maßgeblich; diese Typen müssen dazu passen (geprüft durch test/schema-kompatibel.test.ts).
 */
import type { Datum, FaelligkeitsRegel, Rhythmus, Verschiebung } from "@amtlos/fristen";

export interface Text {
  de: string;
  en?: string;
}

export type Ergebnis = "gilt" | "gilt_nicht" | "unbekannt";
export type StatusRecht = "in_kraft" | "beschlossen" | "entwurf" | "geplant" | "ausgelaufen";
export type Operator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "nicht_in"
  | "enthaelt"
  | "enthaelt_eines"
  | "vorhanden"
  | "nicht_vorhanden";

export interface RegelwertVerweis {
  regelwert: string;
  faktor?: number;
}
export type Wert = number | string | boolean | (number | string)[] | RegelwertVerweis;

export type Bedingung =
  | { all: Bedingung[]; label?: Text }
  | { any: Bedingung[]; label?: Text }
  | { not: Bedingung; label?: Text }
  | { immer: true }
  | { feld: string; op: Operator; wert?: Wert; label?: Text }
  | { ereignis: string; op: "eingetreten" | "nicht_eingetreten" | "geplant"; innerhalb?: string; label?: Text };

export type Frist =
  | { typ: "dauerhaft"; erinnerung?: string[] }
  | { typ: "absolut"; datum: Datum; verschiebung: Verschiebung; erinnerung?: string[] }
  | {
      typ: "relativ";
      bezug: { ereignis: string } | { fakt: string } | { pflicht_erledigt: string };
      versatz: string;
      zeitpunkt?: "spaetestens" | "vor_beginn";
      /** Nur mit bezug.ereignis: eine Instanz je Ereignis (Periode aenderung-JJJJMMTT) */
      je_ereignis?: boolean;
      verschiebung: Verschiebung;
      erinnerung?: string[];
    }
  | {
      typ: "wiederkehrend";
      rhythmus:
        | Rhythmus
        | {
            /** E-206: Hinweis aus dem Katalog, wenn dieser Zweig den Rhythmus bestimmt (z. B. warum monatlich statt der Angabe) */
            waehle: { wenn: Bedingung; dann: Rhythmus; hinweis?: Text }[];
            sonst: Rhythmus;
            /**
             * E-206: Rhythmus je Kalenderjahr wählen – die abgeleiteten Fakten (abgeleitet.ist_gruendungsjahr, abgeleitet.jahr …)
             * gelten dann für das Jahr der Periode statt für den Stichtag (z. B. monatlich nur im Gründungs- und Folgejahr).
             */
            je_jahr?: boolean;
          };
      faellig: FaelligkeitsRegel;
      verlaengerung?: { wenn: Bedingung; versatz: string };
      verschiebung: Verschiebung;
      erinnerung?: string[];
    };

export interface Pflicht {
  schema_version: 1;
  id: string;
  version: number;
  katalog_nr?: string;
  titel: Text;
  kurz: Text;
  erklaerung: Text;
  rechtsgrundlage: string[];
  kategorie: string;
  ausloeser: Bedingung;
  voraussetzungen?: string[];
  phase?: "gruendung";
  frist: Frist;
  wiederholung: { art: "einmalig" | "periodisch" | "bei_aenderung" | "dauerhaft"; neu_ausloesen_bei?: ({ fakt: string } | { ereignis: string })[] };
  sanktion: { text: Text; schwere: "niedrig" | "mittel" | "hoch" };
  /** Auch ohne Termin dringend („Jetzt dran“), unabhängig von der angezeigten Sanktionsschwere (Standard: false) */
  dringend_ohne_termin?: boolean;
  status_recht: StatusRecht;
  gueltig_ab: Datum | null;
  gueltig_bis?: Datum | null;
  erneut_erledigen?: boolean;
  /** R10: Pflicht, Hinweis oder freiwillige Option (Standard: Pflicht) */
  einordnung?: "pflicht" | "hinweis" | "option";
  /** R10: wann die Pflicht in der App als erledigt gilt (Standard: einmalig) */
  erledigung?: { art: "einmalig" | "laufend" | "bestaetigen"; zeitraum?: "monat" | "jahr"; naechster_termin_aus?: string; bestaetigung?: Text };
  [weitere: string]: unknown;
}

export interface RegelwertVersion {
  id: string;
  version: number;
  wert: number;
  gueltig_ab: Datum;
  gueltig_bis?: Datum | null;
  [weitere: string]: unknown;
}

/** Rechtsstand des ganzen Katalogs (catalog/rechtsstand.yaml): Tag, bis zu dem die veränderlichen Einträge geprüft sind. */
export interface Rechtsstand {
  /** ISO-Datum, z. B. "2026-10-21" */
  datum: Datum;
  hinweis?: string;
}

export interface Katalog {
  pflichten: readonly Pflicht[];
  regelwerte: readonly RegelwertVersion[];
  /** Fehlt bei Katalogen ohne catalog/rechtsstand.yaml (z. B. Tests, ältere Bündel) */
  rechtsstand?: Rechtsstand;
}

/** Fakten nach fakten.json. Fehlende Schlüssel oder null bedeuten "unbekannt". */
export type Fakten = Readonly<Record<string, unknown>>;

export interface Ereignis {
  typ: string;
  datum: Datum;
  /** true, wenn durch ein späteres Storno-Ereignis aufgehoben */
  storniert?: boolean;
}
