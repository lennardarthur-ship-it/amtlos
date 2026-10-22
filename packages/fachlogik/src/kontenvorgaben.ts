/**
 * Kontenvorgaben der Kanzlei (StB-Prüfung Heckler und Busch, 21.10.2026, B-4/B-6/B-9/B-10/B-11): Kanzleien haben feste
 * Hausregeln für einzelne Konten (Verrechnungskonto Gesellschafter, Gutscheine, Kassendifferenz, Bank statt
 * Verbindlichkeiten, Anlagenkonten nach Art, Homeoffice). Der Kontenrahmen allein reicht dafür nicht.
 *
 * Ohne Vorgabe gilt das Standardkonto des Kontenrahmens (`BUCHUNGSKONTEN` in buchungen.ts). Der Betrieb trägt
 * Abweichungen selbst ein oder lädt eine kleine JSON-Datei, die die Kanzlei schickt (Format: `kontenvorgabenAusJson`,
 * beschrieben in docs/pruefmappe-steuer/kontenvorgaben.md). Reine Funktionen ohne Gerät.
 */
import type { Kontenrahmen } from "./buchungen.js";

/** Konten, die die Kanzlei vorgeben kann – Sachkonten mit 4 Stellen (Sachkontenlänge 4 im DATEV-Kopf). */
export type KontenvorgabeKonto =
  | "forderungen"
  | "verbindlichkeiten"
  | "kasse"
  | "bank"
  | "geldtransit"
  | "privateinlagen"
  | "privatentnahmen"
  | "verrechnungGesellschafter"
  | "gutscheinVerbindlichkeit"
  | "kassendifferenzAufwand"
  | "kassendifferenzErtrag"
  | "erloesNullsatz"
  | "erloesOss"
  | "homeoffice"
  | "anlageMaschinen"
  | "anlageBga"
  | "anlageKfz"
  | "anlageSoftware";

export interface Kontenvorgaben {
  /** abweichende Konten (nur gesetzte gelten, sonst das Standardkonto des Kontenrahmens) */
  konten?: Partial<Record<KontenvorgabeKonto, string>>;
  /** Belege mit Zahlungsweg „Überweisung oder Karte“ direkt gegen Bank statt gegen Verbindlichkeiten (B-6 „Bank statt 1610“) */
  belegeGegenBank?: boolean;
  /**
   * bilanzierende Betriebe: Zahlungseingänge auf Rechnungen buchen (Bank an Forderungen, A-4) – Standard NEIN (Nachtrag der
   * Kanzlei vom 22.10.2026: Kanzleien buchen die Bank aus dem Kontoauszug)
   */
  zahlungenBuchen?: boolean;
  /** Gewinnermittlung festlegen; ohne Angabe nach Rechtsform bzw. Mitteilung des Finanzamts (A-4/E-4) */
  gewinnermittlung?: "bilanz" | "euer";
  /** Herkunft: Name der Kanzlei und Stand der Vorgabe (aus der Importdatei) – für LIESMICH */
  kanzlei?: string;
  stand?: string;
}

/** Felder der Kontenvorgaben in der Reihenfolge der Anzeige – mit Bezeichnung und Herkunft des Standards. */
export const KONTENVORGABE_FELDER: readonly { id: KontenvorgabeKonto; titel: string; hilfe?: string }[] = [
  { id: "verrechnungGesellschafter", titel: "Verrechnungskonto Gesellschafter", hilfe: "Kapitalgesellschaft: privat ausgelegte Belege und Barbelege vor dem ersten Kassenabschluss (statt Privateinlage/Geldtransit), Einlagen und Entnahmen der Kasse. Standard SKR03 0731 „Verbindlichkeiten gegenüber Gesellschaftern – Restlaufzeit bis 1 Jahr“; SKR04 vorläufig 3560 (Gegenstück zu 0731 bitte von der Kanzlei)." },
  { id: "bank", titel: "Bank", hilfe: "Zahlungseingänge bilanzierender Betriebe; mit „Belege gegen Bank“ auch Belege per Überweisung oder Karte." },
  { id: "forderungen", titel: "Forderungen aus Lieferungen und Leistungen" },
  { id: "verbindlichkeiten", titel: "Verbindlichkeiten aus Lieferungen und Leistungen" },
  { id: "kasse", titel: "Kasse" },
  { id: "geldtransit", titel: "Geldtransit (Karte, Bargeld zur Bank)" },
  { id: "privateinlagen", titel: "Privateinlagen" },
  { id: "privatentnahmen", titel: "Privatentnahmen" },
  { id: "gutscheinVerbindlichkeit", titel: "Mehrzweck-Gutscheine (Verbindlichkeit)", hilfe: "Viele Kanzleien nutzen ein eigenes Unterkonto, z. B. 1701 „Verbindlichkeiten aus Gutscheinen“." },
  { id: "kassendifferenzAufwand", titel: "Kassendifferenz: Fehlbetrag" },
  { id: "kassendifferenzErtrag", titel: "Kassendifferenz: Überschuss", hilfe: "Leer: Erlöse 19 %. Ein anderes Konto (z. B. 2700/4830 „Sonstige Erträge“) wird ohne Umsatzsteuer gebucht." },
  { id: "erloesNullsatz", titel: "Erlöse Nullsteuersatz (§ 12 Abs. 3 UStG, Kz 87)", hilfe: "Konto mit Kz-87-Funktion im Kontenrahmen der Kanzlei (in Rewe nach „Nullsteuersatz“ bzw. „§ 12 Abs. 3“ suchen)." },
  { id: "erloesOss", titel: "Erlöse OSS (Steuer des Bestimmungslands)", hilfe: "Fernverkäufe und Leistungen an Privatpersonen im EU-Ausland (§ 18j UStG), z. B. 8320/4320 „Erlöse aus im anderen EU-Land steuerpflichtigen Lieferungen“." },
  { id: "homeoffice", titel: "Homeoffice-Pauschale / Arbeitszimmer" },
  { id: "anlageMaschinen", titel: "Anlagen: Maschinen" },
  { id: "anlageBga", titel: "Anlagen: Betriebs- und Geschäftsausstattung" },
  { id: "anlageKfz", titel: "Anlagen: Fahrzeuge" },
  { id: "anlageSoftware", titel: "Anlagen: Software" },
];

const KONTO_IDS = new Set<string>(KONTENVORGABE_FELDER.map((f) => f.id));
/** Sachkonto mit 4 Stellen (Sachkontenlänge 4) */
export const istSachkonto = (w: unknown): w is string => typeof w === "string" && /^\d{4}$/.test(w);
const text = (w: unknown, n: number) => (typeof w === "string" && w.trim() ? w.replace(/\s+/g, " ").trim().slice(0, n) : undefined);

/** Gespeicherte Kontenvorgaben prüfen und bereinigen – Unbekanntes und ungültige Kontonummern fallen weg. */
export function kontenvorgabenAus(roh: unknown): Kontenvorgaben {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  const r = roh as Record<string, unknown>;
  const konten: Partial<Record<KontenvorgabeKonto, string>> = {};
  if (r.konten && typeof r.konten === "object" && !Array.isArray(r.konten))
    for (const [k, w] of Object.entries(r.konten as Record<string, unknown>)) if (KONTO_IDS.has(k) && istSachkonto(w)) konten[k as KontenvorgabeKonto] = w;
  const aus: Kontenvorgaben = {};
  if (Object.keys(konten).length) aus.konten = konten;
  if (typeof r.belegeGegenBank === "boolean") aus.belegeGegenBank = r.belegeGegenBank;
  if (typeof r.zahlungenBuchen === "boolean") aus.zahlungenBuchen = r.zahlungenBuchen;
  if (r.gewinnermittlung === "bilanz" || r.gewinnermittlung === "euer") aus.gewinnermittlung = r.gewinnermittlung;
  const kanzlei = text(r.kanzlei, 80);
  if (kanzlei) aus.kanzlei = kanzlei;
  if (typeof r.stand === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.stand)) aus.stand = r.stand;
  return aus;
}

/** Sind Vorgaben gesetzt (mindestens ein Konto oder eine Option)? */
export const kontenvorgabenGesetzt = (v: Kontenvorgaben | null | undefined) => !!v && (Object.keys(v.konten ?? {}).length > 0 || v.belegeGegenBank !== undefined || v.zahlungenBuchen !== undefined || v.gewinnermittlung !== undefined);

/** Kennung des Dateiformats der Kanzlei-Datei */
export const KONTENVORGABEN_FORMAT = "kontenvorgaben";

export interface KontenvorgabenImport {
  vorgaben: Kontenvorgaben;
  /** Kontenrahmen laut Datei (optional) – gilt dann auch für das Paket */
  kontenrahmen?: Kontenrahmen;
  /** Einträge, die nicht übernommen wurden (unbekannter Schlüssel, ungültige Nummer) */
  warnungen: string[];
}

/**
 * Kontenvorgaben aus der JSON-Datei der Kanzlei lesen. Format (Version 1):
 * `{ "format": "kontenvorgaben", "version": 1, "kanzlei": "…", "stand": "JJJJ-MM-TT", "kontenrahmen": "SKR03",
 *    "konten": { "verrechnungGesellschafter": "0731", … }, "optionen": { "belegeGegenBank": false, "zahlungenBuchen": false,
 *    "gewinnermittlung": "bilanz" } }` – alle Angaben außer `konten` bzw. `optionen` freiwillig.
 * Wirft einen Fehler mit lesbarer Meldung, wenn die Datei kein solches Objekt ist.
 */
export function kontenvorgabenAusJson(inhalt: string): KontenvorgabenImport {
  let roh: unknown;
  try {
    roh = JSON.parse(inhalt.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Die Datei ist kein gültiges JSON.");
  }
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) throw new Error("Die Datei enthält keine Kontenvorgaben.");
  const r = roh as Record<string, unknown>;
  if (r.format !== undefined && r.format !== KONTENVORGABEN_FORMAT) throw new Error(`Unbekanntes Format „${String(r.format)}“ – erwartet „${KONTENVORGABEN_FORMAT}“.`);
  if (r.version !== undefined && r.version !== 1) throw new Error(`Version ${String(r.version)} wird nicht unterstützt – erwartet 1.`);
  const warnungen: string[] = [];
  const konten = r.konten && typeof r.konten === "object" && !Array.isArray(r.konten) ? (r.konten as Record<string, unknown>) : {};
  for (const [k, w] of Object.entries(konten)) {
    if (!KONTO_IDS.has(k)) warnungen.push(`unbekanntes Konto „${k}“`);
    else if (!istSachkonto(w)) warnungen.push(`${KONTENVORGABE_FELDER.find((f) => f.id === k)!.titel}: „${String(w)}“ ist keine vierstellige Kontonummer`);
  }
  const optionen = r.optionen && typeof r.optionen === "object" && !Array.isArray(r.optionen) ? (r.optionen as Record<string, unknown>) : {};
  for (const k of Object.keys(optionen)) if (!["belegeGegenBank", "zahlungenBuchen", "gewinnermittlung"].includes(k)) warnungen.push(`unbekannte Option „${k}“`);
  const vorgaben = kontenvorgabenAus({ ...optionen, konten, kanzlei: r.kanzlei, stand: r.stand });
  if (!kontenvorgabenGesetzt(vorgaben)) throw new Error("Die Datei enthält keine gültigen Konten oder Optionen.");
  const kr = r.kontenrahmen === "SKR03" || r.kontenrahmen === "SKR04" ? r.kontenrahmen : undefined;
  if (r.kontenrahmen !== undefined && !kr) warnungen.push(`Kontenrahmen „${String(r.kontenrahmen)}“ unbekannt – nicht übernommen`);
  return { vorgaben, ...(kr ? { kontenrahmen: kr } : {}), warnungen };
}

/** Kontenvorgaben als Datei im selben Format (zum Weitergeben an die Kanzlei oder ein zweites Gerät). */
export function kontenvorgabenJson(v: Kontenvorgaben, kontenrahmen: Kontenrahmen): string {
  const { konten, belegeGegenBank, zahlungenBuchen, gewinnermittlung, kanzlei, stand } = v;
  const optionen = { ...(belegeGegenBank !== undefined ? { belegeGegenBank } : {}), ...(zahlungenBuchen !== undefined ? { zahlungenBuchen } : {}), ...(gewinnermittlung ? { gewinnermittlung } : {}) };
  return JSON.stringify({ format: KONTENVORGABEN_FORMAT, version: 1, ...(kanzlei ? { kanzlei } : {}), ...(stand ? { stand } : {}), kontenrahmen, konten: konten ?? {}, optionen }, null, 2) + "\n";
}
