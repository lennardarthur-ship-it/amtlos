export type AnzeigeStatus = "offen" | "faellig_bald" | "ueberfaellig" | "angabe_fehlt" | "erledigt" | "nicht_zutreffend" | "entfallen";
export type Bereich = "steuern" | "personal" | "arbeitsschutz" | "datenschutz" | "online" | "gesellschaft";

export interface Karte {
  pflicht_id: string;
  periode: string;
  status: AnzeigeStatus;
  ergebnis: "gilt" | "gilt_nicht" | "unbekannt";
  faellig_am: string | null;
  verschoben_von: string | null;
  titel: string;
  kurz: string;
  kategorie: string;
  bereich: Bereich;
  sanktion: { text: string; schwere: "niedrig" | "mittel" | "hoch" };
  rechtsgrundlage: string[];
  warum: string[];
  zu_klaeren: string[];
  nicht_zutreffend_grund: string | null;
  fehlende_fakten: string[];
  hinweise: string[];
  aktion: { art?: string; ziel?: string; nachweis_erforderlich?: boolean } | null;
  pruefung: { status: string; geprueft_von: string[] | null; geprueft_am: string | null };
  ungeprueft: boolean;
  erledigt_am: string | null;
}

export interface KartenDetail extends Karte {
  erklaerung: string;
  begriffe: { begriff: string; erklaerung: string }[];
  stelle: string;
  kosten: string | null;
  quellen: { titel: string; url: string; abgerufen: string | null; fundstelle?: string }[];
  dokumente: string[];
  pflicht_version: number;
  nachweise: { id: string; art: string; notiz: string | null; erstellt_am: string }[];
}

export interface Heute {
  ampel: Record<Bereich, "gruen" | "gelb" | "rot">;
  als_naechstes: Karte[];
  zaehler: { offen: number; ueberfaellig: number; angabe_fehlt: number; erledigt: number };
  vor_start: { anzahl: number; seit: string | null };
}

export interface GruendungsSchritt extends Karte {
  katalog_nr?: string;
  voraussetzungen: string[];
  gesperrt_durch: { pflicht_id: string; titel: string }[];
  stelle: string;
  kanal: string;
}

export interface Gruendung {
  schritte: GruendungsSchritt[];
  fortschritt: { erledigt: number; gesamt: number; fertig: boolean };
  kapitalgesellschaft: "ug" | "gmbh" | null;
  kennzahlen: { id: string; bezeichnung: string; wert: number; einheit: string; ungeprueft: boolean }[];
}
