/** Feste Bezeichnungen, die Server (PDF) und App (Vorlagen) teilen. */
import type { Option } from "./typen.js";

/** Gefährdungsfaktoren in der Reihenfolge von § 5 Abs. 3 ArbSchG (Wortlaut fachlich zu prüfen, T-18). */
export const GEFAEHRDUNGSFAKTOREN: Record<string, string> = {
  arbeitsstaette: "Gestaltung und Einrichtung der Arbeitsstätte und des Arbeitsplatzes",
  einwirkungen: "Physikalische, chemische und biologische Einwirkungen",
  arbeitsmittel: "Arbeitsmittel, Maschinen, Geräte und Anlagen und der Umgang damit",
  ablaeufe_arbeitszeit: "Arbeitsverfahren, Arbeitsabläufe und Arbeitszeit",
  qualifikation: "Unzureichende Qualifikation und Unterweisung",
  psychisch: "Psychische Belastungen bei der Arbeit",
  sonstiges: "Sonstige Gefährdungen",
};

export const RISIKO_STUFEN: Record<string, string> = { gering: "gering", mittel: "mittel", hoch: "hoch" };

/** Schutzziele nach Art. 32 Abs. 1 DSGVO (Wortlaut fachlich zu prüfen, T-22). */
export const SCHUTZZIELE: Record<string, string> = {
  pseudonymisierung_verschluesselung: "Pseudonymisierung und Verschlüsselung",
  vertraulichkeit: "Vertraulichkeit",
  integritaet: "Integrität",
  verfuegbarkeit_belastbarkeit: "Verfügbarkeit und Belastbarkeit",
  wiederherstellung: "Rasche Wiederherstellung nach einem Zwischenfall",
  ueberpruefung: "Regelmäßige Überprüfung der Wirksamkeit",
  sonstiges: "Sonstige Maßnahmen",
};

/** Bewertung einer Datenpanne (Gliederung fachlich zu prüfen, T-23). */
export const DATENPANNE_RISIKO: Record<string, string> = {
  kein_risiko: "voraussichtlich kein Risiko – keine Meldung, nur Dokumentation",
  risiko: "Risiko – Meldung an die Aufsichtsbehörde",
  hohes_risiko: "hohes Risiko – Meldung und Benachrichtigung der Betroffenen prüfen",
};

/** Die 14 Hauptallergene nach Anhang II der LMIV (Bezeichnungen fachlich zu prüfen, E-099). */
export const ALLERGENE: Record<string, string> = {
  gluten: "Glutenhaltiges Getreide",
  krebstiere: "Krebstiere",
  eier: "Eier",
  fische: "Fische",
  erdnuesse: "Erdnüsse",
  soja: "Soja",
  milch: "Milch (einschließlich Laktose)",
  schalenfruechte: "Schalenfrüchte",
  sellerie: "Sellerie",
  senf: "Senf",
  sesam: "Sesamsamen",
  schwefeldioxid: "Schwefeldioxid und Sulphite",
  lupinen: "Lupinen",
  weichtiere: "Weichtiere",
};

export const optionen = (r: Record<string, string>): Option[] => Object.entries(r).map(([wert, text]) => ({ wert, text }));
