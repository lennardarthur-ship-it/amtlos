/** Feste Bezeichnungen, die Server (PDF) und App (Vorlagen) teilen. */
import type { Option } from "./typen.js";

/** Gefährdungsfaktoren nach § 5 Abs. 3 Nr. 1–6 ArbSchG, Wortlaut nah am Gesetz (Prüfbericht E-123), „sonstige“ ergänzt. */
export const GEFAEHRDUNGSFAKTOREN: Record<string, string> = {
  arbeitsstaette: "Gestaltung und Einrichtung der Arbeitsstätte und des Arbeitsplatzes",
  einwirkungen: "Physikalische, chemische und biologische Einwirkungen",
  arbeitsmittel: "Gestaltung, Auswahl und Einsatz von Arbeitsmitteln (Arbeitsstoffe, Maschinen, Geräte, Anlagen) und der Umgang damit",
  ablaeufe_arbeitszeit: "Gestaltung von Arbeits- und Fertigungsverfahren, Arbeitsabläufen und Arbeitszeit und deren Zusammenwirken",
  qualifikation: "Unzureichende Qualifikation und Unterweisung der Beschäftigten",
  psychisch: "Psychische Belastungen bei der Arbeit",
  sonstiges: "Sonstige Gefährdungen",
};

export const RISIKO_STUFEN: Record<string, string> = { gering: "gering", mittel: "mittel", hoch: "hoch" };

/**
 * E-167 (Sifa-Durchsicht 22.10.2026, Blatt „D Risikoskala“): Risiko aus Schwere des möglichen Schadens ×
 * Wahrscheinlichkeit – kein vorbelegter Wert; erst wenn beides gewählt ist, steht eine Stufe fest.
 */
export const SCHWERE: Record<string, string> = { leicht: "leicht (z. B. kleiner Schnitt, ohne Ausfallzeit)", mittel: "mittel (mit Ausfallzeit)", schwer: "schwer (bleibender Schaden oder tödlich)" };
export const SCHWERE_KURZ: Record<string, string> = { leicht: "leicht", mittel: "mittel", schwer: "schwer" };
export const WAHRSCHEINLICHKEIT: Record<string, string> = { unwahrscheinlich: "unwahrscheinlich", moeglich: "möglich", wahrscheinlich: "wahrscheinlich" };
/** Matrix nach Vorschlag der Sifa: Zeile Schwere, Spalte Wahrscheinlichkeit. */
export const RISIKO_MATRIX: Record<string, Record<string, "gering" | "mittel" | "hoch">> = {
  leicht: { unwahrscheinlich: "gering", moeglich: "gering", wahrscheinlich: "mittel" },
  mittel: { unwahrscheinlich: "gering", moeglich: "mittel", wahrscheinlich: "hoch" },
  schwer: { unwahrscheinlich: "mittel", moeglich: "hoch", wahrscheinlich: "hoch" },
};
/** Risikostufe aus Schwere und Wahrscheinlichkeit; leer, solange eines fehlt (keine Vorbelegung „mittel“). */
export function risikoAus(schwere: string | null | undefined, wahrscheinlichkeit: string | null | undefined): "gering" | "mittel" | "hoch" | "" {
  return (schwere && wahrscheinlichkeit && RISIKO_MATRIX[schwere]?.[wahrscheinlichkeit]) || "";
}
/** Handlungsbedarf je Stufe (unverändert aus der bisherigen Skala, Blatt „D Risikoskala“ bestätigt). */
export const HANDLUNGSBEDARF: Record<string, string> = { hoch: "sofort handeln, notfalls die Tätigkeit einstellen", mittel: "zeitnah handeln, mit Termin", gering: "bei Gelegenheit handeln, beobachten" };
/**
 * E-167 (Blatt „B Vorlagen“): feste Unterpunkte der „Sonstigen Gefährdungen“ – die sechs Faktoren des § 5 Abs. 3 ArbSchG
 * bleiben unverändert (auch für Server und API), die Unterpunkte gliedern nur den Abschnitt „Sonstige“.
 */
export const SONSTIGE_UNTERPUNKTE: Record<string, string> = { brand: "Brand- und Explosionsgefährdung", elektrisch: "Elektrische Gefährdung", notfall: "Notfallorganisation (Erste Hilfe, Flucht und Rettung)", weitere: "Weitere Gefährdungen" };

/**
 * Wirtschaftsbereiche nach § 2a Abs. 1 Nr. 1–11 SchwarzArbG in der Fassung des Gesetzes zur Modernisierung und
 * Digitalisierung der Schwarzarbeitsbekämpfung (BGBl. 2025 I Nr. 369, in Kraft seit 30.12.2025): Nr. 4 umfasst
 * plattformbasierte Lieferdienste, Nr. 11 das Friseur- und Kosmetikgewerbe; die Forstwirtschaft ist entfallen.
 * Vorprüfung 21.10.2026 (T-99) – fachlich zu bestätigen. Werte wie im Pflichten-Check (`personal.sofortmeldebranchen`).
 */
export const BRANCHEN_2A: Option[] = [
  { wert: "bau", text: "Baugewerbe" },
  { wert: "gastronomie", text: "Gaststätten und Beherbergung" },
  { wert: "personenbefoerderung", text: "Personenbeförderung" },
  { wert: "spedition_logistik", text: "Spedition, Transport und Logistik (auch plattformbasierte Lieferdienste)" },
  { wert: "schausteller", text: "Schaustellergewerbe" },
  { wert: "gebaeudereinigung", text: "Gebäudereinigung" },
  { wert: "messebau", text: "Auf- und Abbau von Messen und Ausstellungen" },
  { wert: "fleischwirtschaft", text: "Fleischwirtschaft (ohne Fleischerhandwerk)" },
  { wert: "prostitution", text: "Prostitutionsgewerbe" },
  { wert: "sicherheitsgewerbe", text: "Wach- und Sicherheitsgewerbe" },
  { wert: "friseur_kosmetik", text: "Friseur- und Kosmetikgewerbe" },
];
/** Die Branchen nach § 2a Abs. 1 SchwarzArbG in einem Satz (Fußtexte und Hinweise). */
export const BRANCHEN_2A_TEXT = "Bau, Gaststätten und Beherbergung, Personenbeförderung, Spedition, Transport und Logistik (auch Lieferdienste), Schausteller, Gebäudereinigung, Messebau, Fleischwirtschaft, Prostitution, Wach- und Sicherheitsgewerbe sowie seit 30.12.2025 Friseur- und Kosmetikgewerbe";
/** Pflichten-Check → Branche nach § 2a: „Sofortmeldebranchen“ (§ 28a Abs. 4 SGB IV, gleiche Liste) und Hauptbranche. */
const AUS_SOFORTMELDUNG: Record<string, string> = { friseur: "friseur_kosmetik", kosmetik: "friseur_kosmetik", lieferdienste: "spedition_logistik" };
const AUS_HAUPTBRANCHE: Record<string, string> = { beauty_kosmetik: "friseur_kosmetik", gebaeudereinigung: "gebaeudereinigung", bau: "bau" };
/**
 * Branche nach § 2a SchwarzArbG aus den Antworten im Pflichten-Check: erste passende Branche, „keine“, wenn die Frage nach
 * den Sofortmeldebranchen beantwortet ist und nichts passt, sonst nichts (die App fragt dann im Formular).
 */
export function branche2aAusProfil(profil: Record<string, unknown>): string | undefined {
  const sofort = profil["personal.sofortmeldebranchen"];
  const haupt = profil["taetigkeit.branchen"];
  const kandidaten = [
    ...(Array.isArray(haupt) ? haupt.map((b) => AUS_HAUPTBRANCHE[String(b)]) : []),
    ...(Array.isArray(sofort) ? sofort.map((b) => AUS_SOFORTMELDUNG[String(b)] ?? String(b)) : []),
  ].filter((w): w is string => Boolean(w) && BRANCHEN_2A.some((o) => o.wert === w));
  if (kandidaten.length) return kandidaten[0];
  return Array.isArray(sofort) ? "keine" : undefined;
}

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
