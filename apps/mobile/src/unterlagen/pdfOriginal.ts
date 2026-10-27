/**
 * E-228 (Steuerberater zu T-300): Das zuerst geteilte bzw. gedruckte PDF einer festgeschriebenen Unterlage wird selbst
 * aufbewahrt – byte-genau, verschlüsselt im Belegordner wie die Dateien der Belege (dateien.ts), mit Synchronisation,
 * Sicherung, offenem Archiv und Steuerberater-Paket. Ein bei jeder Ausgabe neu erzeugtes PDF kann sich durch
 * Änderungen am Druckdienst des Geräts ändern und passt dann nicht mehr zum gespeicherten Prüfwert (§ 147 Abs. 2 Nr. 1
 * AO, § 14b UStG). Erneutes Teilen und Drucken gibt deshalb dieses Original weiter; das festgehaltene HTML (E-220)
 * bleibt für Vorschau und als Ersatz, falls die Datei (noch) fehlt.
 *
 * Reine Funktionen ohne Gerät (testbar); Ablage und Lesen der Datei übernimmt der Aufrufer.
 */
import { istBelegDateiname } from "@amtlos/fachlogik";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

/** Das aufbewahrte PDF einer festgeschriebenen Unterlage (bzw. Fassung oder unbestätigten Ausgabe). */
export interface PdfOriginal {
  /** Name der verschlüsselten Datei im Belegordner (wie bei Belegen, z. B. „m1x2y3z4.pdf“) */
  datei: string;
  /** SHA-256 (hex) genau dieser Bytes */
  sha256: string;
  /** Größe in Bytes */
  groesse: number;
  /** wann es aufbewahrt wurde (ISO) */
  am: string;
  /**
   * „eingelesen“: nicht beim Teilen aufbewahrt, sondern später eingelesen (z. B. aus dem Postausgang) bzw. neu erzeugt –
   * und als Original übernommen, weil sein SHA-256 mit dem beim ersten Teilen gespeicherten Prüfwert übereinstimmt.
   */
  quelle?: "eingelesen";
}

/**
 * Obergrenze je PDF: Die Synchronisation nimmt Dateien bis 15 Mio. Zeichen (verschlüsselt, Base64, apps/api
 * tresor.controller.ts) – 10 MB passen mit Reserve. Ein größeres PDF (z. B. mit sehr großem Logo) wird nicht
 * aufbewahrt; dann bleibt es wie bisher bei festgehaltenem HTML und Prüfwert (die App sagt es dazu).
 */
export const PDF_ORIGINAL_MAX = 10 * 1024 * 1024;

export const pdfPruefwert = (bytes: Uint8Array): string => bytesToHex(sha256(bytes));

/** Beginnt die Datei wie ein PDF („%PDF-“)? */
export const istPdf = (bytes: Uint8Array): boolean => bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;

const istIso = (w: unknown): w is string => typeof w === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(w);

/** Gespeicherte Angabe lesen – nur mit gültigem Dateinamen (G-1: keine Pfade aus Sync oder Sicherung), Prüfwert und Zeitpunkt. */
export function pdfOriginalAus(roh: unknown): PdfOriginal | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  const r = roh as Record<string, unknown>;
  if (!istBelegDateiname(r.datei) || typeof r.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(r.sha256) || !istIso(r.am)) return null;
  const groesse = typeof r.groesse === "number" && Number.isFinite(r.groesse) && r.groesse >= 0 ? Math.round(r.groesse) : 0;
  return { datei: r.datei, sha256: r.sha256, groesse, am: r.am, ...(r.quelle === "eingelesen" ? { quelle: "eingelesen" as const } : {}) };
}

/** Angabe für frisch ausgegebene Bytes (ohne Datei – die vergibt der Aufrufer beim Ablegen). */
export function pdfOriginalFuer(datei: string, bytes: Uint8Array, am: string, quelle?: "eingelesen"): PdfOriginal {
  return { datei, sha256: pdfPruefwert(bytes), groesse: bytes.length, am, ...(quelle ? { quelle } : {}) };
}

/** Lassen sich diese Bytes aufbewahren (PDF, nicht leer, nicht zu groß)? */
export const aufbewahrbar = (bytes: Uint8Array | null | undefined): bytes is Uint8Array => Boolean(bytes && bytes.length <= PDF_ORIGINAL_MAX && istPdf(bytes));

/**
 * Aufbewahrtes Original lesen – nur, wenn die Bytes zum Prüfwert passen (eine beschädigte oder vertauschte Datei gilt
 * nicht als Original). null: kein Original, Datei fehlt (z. B. noch nicht synchronisiert) oder passt nicht.
 */
export async function originalLesen(pdf: PdfOriginal | undefined, lesen: (name: string) => Promise<Uint8Array | null>): Promise<Uint8Array | null> {
  if (!pdf) return null;
  const bytes = await lesen(pdf.datei).catch(() => null);
  return bytes && pdfPruefwert(bytes) === pdf.sha256 ? bytes : null;
}

/** Unterlage, soweit hier gebraucht */
export interface MitPdf {
  festgeschrieben?: string;
  pdfSha256?: string;
  pdf?: PdfOriginal;
  pdfFolgt?: boolean;
}

/**
 * Ein PDF dieser festgeschriebenen Unterlage geht gerade zum ersten Mal hinaus (zuerst war die XRechnung geteilt,
 * `pdfFolgt`): Dann ist es das erste geteilte PDF und wird das Original.
 */
export const erstesPdf = (u: MitPdf): boolean => Boolean(u.festgeschrieben && !u.pdf && u.pdfFolgt);

/**
 * Vergleich eines (eingelesenen oder neu erzeugten) PDFs mit dem beim ersten Teilen gespeicherten Prüfwert:
 *   - „gleich“: SHA-256 stimmt – es ist byte-genau das damals geteilte PDF, es darf als Original aufbewahrt werden,
 *   - „abweichend“: anderer Inhalt – kein Original (z. B. später erneut erzeugt, anders gespeichert, andere Rechnung),
 *   - „ohne_pruefwert“: beim ersten Ausgeben wurde kein Prüfwert gespeichert (gedruckt, Web-Vorschau, zuerst
 *     XRechnung) – nicht nachprüfbar, also kein Original,
 *   - „kein_pdf“: die Datei ist kein PDF (oder zu groß),
 *   - „schon_da“: es gibt schon ein aufbewahrtes Original, oder die Unterlage ist nicht festgeschrieben.
 */
export type PdfVergleich = "gleich" | "abweichend" | "ohne_pruefwert" | "kein_pdf" | "schon_da";
export function pdfVergleichen(u: MitPdf, bytes: Uint8Array): { ergebnis: PdfVergleich; sha256: string } {
  const sha = pdfPruefwert(bytes);
  if (!u.festgeschrieben || u.pdf) return { ergebnis: "schon_da", sha256: sha };
  if (!aufbewahrbar(bytes)) return { ergebnis: "kein_pdf", sha256: sha };
  if (!u.pdfSha256) return { ergebnis: "ohne_pruefwert", sha256: sha };
  return { ergebnis: sha === u.pdfSha256 ? "gleich" : "abweichend", sha256: sha };
}

/**
 * Bytes für Teilen, Drucken, Paket und Archiv: das aufbewahrte Original, wenn es lesbar ist und zum Prüfwert passt –
 * sonst neu erzeugt (aus dem festgehaltenen HTML). `original` sagt, welches es ist.
 */
export async function ausgabePdf(u: MitPdf, lesen: (name: string) => Promise<Uint8Array | null>, erzeugen: () => Promise<Uint8Array | null>): Promise<{ bytes: Uint8Array | null; original: boolean }> {
  const o = u.festgeschrieben ? await originalLesen(u.pdf, lesen) : null;
  if (o) return { bytes: o, original: true };
  return { bytes: await erzeugen().catch(() => null), original: false };
}

/** Was eine PDF-Ausgabe (Teilen, Drucken) braucht – auf dem Gerät expo-print, Teilen-Menü und Belegordner, im Test Attrappen. */
export interface PdfAusgabeUmgebung {
  /** Datei aus dem Belegordner lesen (entschlüsselt) */
  lesen(name: string): Promise<Uint8Array | null>;
  /** PDF aus dem HTML erzeugen und teilen bzw. drucken – mit den Bytes der ausgegebenen Datei (im Web ohne) */
  erzeugenUndAusgeben(): Promise<{ ok: boolean; sha256?: string; bytes?: Uint8Array }>;
  /** gespeicherte Bytes unverändert teilen bzw. drucken */
  bytesAusgeben(bytes: Uint8Array): Promise<boolean>;
  /** Bytes verschlüsselt im Belegordner ablegen – liefert den Dateinamen */
  ablegen(bytes: Uint8Array): Promise<string>;
  jetzt(): string;
}

export interface PdfAusgabeErgebnis {
  ok: boolean;
  /** SHA-256 der ausgegebenen Datei (im Web ohne) */
  sha256?: string;
  /** das aufbewahrte Original wurde unverändert weitergegeben */
  original: boolean;
  /** es gibt ein Original, es ließ sich hier aber nicht lesen (z. B. noch nicht synchronisiert) – neu erzeugt */
  originalFehlt: boolean;
  /** erste Ausgabe: das eben ausgegebene PDF, abgelegt – für Festschreibung bzw. unbestätigte Ausgabe */
  neu?: PdfOriginal;
  /** festgeschrieben ohne Original: das eben ausgegebene PDF ist das erste bzw. passt zum Prüfwert – nachträglich setzen */
  nachgereicht?: PdfOriginal;
}

/**
 * E-228: eine PDF-Ausgabe. Festgeschrieben mit Original → genau diese Bytes. Sonst neu erzeugt; bei der ersten Ausgabe
 * einer Vorlage mit Festschreibung (`aufbewahren`) werden die Bytes abgelegt (`neu`). Festgeschrieben ohne Original:
 * Ist es das erste PDF nach der XRechnung (`pdfFolgt`) oder stimmt das neu erzeugte PDF byte-genau mit dem beim ersten
 * Teilen gespeicherten Prüfwert überein, wird es nachgereicht – sonst ist es nur eine Wiedergabe. Scheitert das
 * Ablegen, geht die Ausgabe trotzdem durch (wie bisher nur mit Prüfwert und HTML).
 */
export async function pdfAusgabe(u: MitPdf, aufbewahren: boolean, e: PdfAusgabeUmgebung): Promise<PdfAusgabeErgebnis> {
  let originalFehlt = false;
  if (u.festgeschrieben && u.pdf) {
    const o = await originalLesen(u.pdf, (n) => e.lesen(n));
    if (o) return { ok: await e.bytesAusgeben(o), sha256: u.pdf.sha256, original: true, originalFehlt: false };
    originalFehlt = true;
  }
  const erg = await e.erzeugenUndAusgeben();
  const r: PdfAusgabeErgebnis = { ok: erg.ok, ...(erg.sha256 ? { sha256: erg.sha256 } : {}), original: false, originalFehlt };
  if (!erg.ok || !aufbewahrbar(erg.bytes)) return r;
  const bytes = erg.bytes;
  const ablegen = async (quelle?: "eingelesen") => {
    try {
      return pdfOriginalFuer(await e.ablegen(bytes), bytes, e.jetzt(), quelle);
    } catch {
      return undefined;
    }
  };
  if (!u.festgeschrieben) {
    if (aufbewahren) {
      const neu = await ablegen();
      if (neu) r.neu = neu;
    }
    return r;
  }
  if (!u.pdf && (erstesPdf(u) || (u.pdfSha256 && pdfPruefwert(bytes) === u.pdfSha256))) {
    const n = await ablegen(erstesPdf(u) ? undefined : "eingelesen");
    if (n) r.nachgereicht = n;
  }
  return r;
}

/**
 * E-228 (T-300 b): ein früher geteiltes PDF einlesen (z. B. aus dem Postausgang der Mail) und mit dem beim ersten Teilen
 * gespeicherten Prüfwert vergleichen. Nur bei „gleich“ wird es abgelegt und als Original zurückgegeben.
 */
export async function pdfEinlesen(u: MitPdf, bytes: Uint8Array, ablegen: (bytes: Uint8Array) => Promise<string>, jetzt: string): Promise<{ ergebnis: PdfVergleich; sha256: string; pdf?: PdfOriginal }> {
  const v = pdfVergleichen(u, bytes);
  if (v.ergebnis !== "gleich") return v;
  return { ...v, pdf: pdfOriginalFuer(await ablegen(bytes), bytes, jetzt, "eingelesen") };
}
