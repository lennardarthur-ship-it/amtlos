/**
 * PDF auf dem Gerät (E-121, E-123): HTML → PDF mit expo-print, Fußzeile mit Seitenzahlen per pdf-lib, Weitergabe über
 * das Teilen-Menü (Dateien, Mail, AirDrop, Drucken). Im Web (Vorschau, Rundgang) öffnet sich das Dokument im Fenster.
 */
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { teilen } from "./teilen";
import { Platform } from "react-native";
import { RAENDER, type Gestalt } from "@amtlos/fachlogik";
import { fussAngaben, fusszeileStempeln } from "./fusszeile";
import { mitSchriften } from "./schriften";
import { cacheDateiLoeschen } from "./aufraeumen";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

/** A4 in Punkt (72 dpi). Ränder je Gestalt (E-129): unten Platz für die Fußzeile. */
const A4 = { width: 595, height: 842 };
const MM = 72 / 25.4;

export function raender(gestalt: string) {
  const [oben, rechts, unten, links] = RAENDER[(gestalt in RAENDER ? gestalt : "nachweis") as Gestalt];
  return { top: Math.round(oben * MM), right: Math.round(rechts * MM), bottom: Math.round(unten * MM), left: Math.round(links * MM) };
}

function imWebOeffnen(html: string) {
  const w = (globalThis as unknown as { open?: (u: string, n: string) => { document: { write(s: string): void; close(): void } } | null }).open?.("", "_blank");
  if (!w) return;
  w.document.write(mitSchriften(html));
  w.document.close();
}

/** Erstellt das PDF mit Fußzeile unter einem lesbaren Dateinamen und gibt die Datei-URI zurück. */
export async function pdfErstellen(roh: string, dateiname: string, quer = false): Promise<string> {
  const html = mitSchriften(roh);
  const angaben = fussAngaben(html);
  const seite = quer ? { width: A4.height, height: A4.width } : A4;
  const margins = raender(angaben.gestalt);
  const { uri, base64 } = await Print.printToFileAsync({ html, ...seite, margins, base64: true });
  const ziel = new File(Paths.cache, dateiname);
  try {
    const bytes = await fusszeileStempeln(base64 ?? new File(uri).base64Sync(), angaben);
    if (ziel.exists) ziel.delete();
    ziel.create();
    // E-193: File.write ist seit Expo SDK 58 asynchron – ohne await ginge das PDF leer oder abgeschnitten ins Teilen-Menü
    await ziel.write(bytes);
    return ziel.uri;
  } catch {
    // Ohne gestempelte Fußzeile stehen die Geschäftsangaben (Steuer, Bank, Register) im Fluss am Dokumentende
    const ersatz = await Print.printToFileAsync({ html: html.replace(/<body class="([^"]*)">/, '<body class="$1 fuss-im-fluss">'), ...seite, margins });
    return ersatz.uri;
  } finally {
    // das ungestempelte Zwischen-PDF nie liegen lassen (Kundendaten unverschlüsselt im Cache)
    cacheDateiLoeschen(uri);
  }
}

/** PDF als Bytes (für das Paket an die Steuerberatung); im Web gibt es kein expo-print – dann null. */
export async function pdfBytes(html: string, dateiname: string, quer = false): Promise<Uint8Array | null> {
  if (Platform.OS === "web") return null;
  const uri = await pdfErstellen(html, dateiname, quer);
  try {
    return new File(uri).bytesSync();
  } finally {
    cacheDateiLoeschen(uri);
  }
}

/** Erstellt das PDF und öffnet das Teilen-Menü; true, wenn es weitergegeben wurde (false: abgebrochen). */
export async function pdfTeilen(html: string, dateiname: string, quer = false): Promise<boolean> {
  if (Platform.OS === "web") {
    imWebOeffnen(html);
    return true;
  }
  const uri = await pdfErstellen(html, dateiname, quer);
  try {
    if (Platform.OS !== "ios" && !(await Sharing.isAvailableAsync())) return await druckenUri(uri);
    return await teilen(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", titel: dateiname });
  } finally {
    cacheDateiLoeschen(uri);
  }
}

/**
 * R12 GoBD: wie `pdfTeilen`, liefert dazu den SHA-256 (hex) genau der geteilten PDF-Datei – für die Festschreibung einer
 * Rechnung (Nachweis, welches PDF rausging). Im Web gibt es kein PDF (Fenster) – dann ohne Hash.
 */
export async function pdfTeilenMitHash(html: string, dateiname: string, quer = false): Promise<{ ok: boolean; sha256?: string }> {
  if (Platform.OS === "web") {
    imWebOeffnen(html);
    return { ok: true };
  }
  const uri = await pdfErstellen(html, dateiname, quer);
  try {
    const sha = bytesToHex(sha256(new File(uri).bytesSync()));
    const ok = Platform.OS !== "ios" && !(await Sharing.isAvailableAsync()) ? await druckenUri(uri) : await teilen(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", titel: dateiname });
    return { ok, sha256: sha };
  } finally {
    cacheDateiLoeschen(uri);
  }
}

/**
 * E-228: PDF erzeugen und teilen bzw. drucken – mit den Bytes genau der ausgegebenen Datei (zum Aufbewahren als Original)
 * und ihrem SHA-256. Im Web gibt es kein PDF (Fenster) – dann ohne Bytes.
 */
export async function pdfAusgeben(html: string, dateiname: string, quer: boolean, art: "teilen" | "drucken"): Promise<{ ok: boolean; sha256?: string; bytes?: Uint8Array }> {
  if (Platform.OS === "web") {
    imWebOeffnen(html);
    return { ok: true };
  }
  const uri = await pdfErstellen(html, dateiname, quer);
  try {
    const bytes = new File(uri).bytesSync();
    const ok = art === "drucken" || (Platform.OS !== "ios" && !(await Sharing.isAvailableAsync())) ? await druckenUri(uri) : await teilen(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", titel: dateiname });
    return { ok, sha256: bytesToHex(sha256(bytes)), bytes };
  } finally {
    cacheDateiLoeschen(uri);
  }
}

/**
 * E-228: ein aufbewahrtes PDF (Original) unverändert teilen bzw. drucken – keine neue Erzeugung. Die Datei liegt nur für
 * die Dauer des Teilens unverschlüsselt im Cache.
 */
export async function pdfBytesAusgeben(bytes: Uint8Array, dateiname: string, art: "teilen" | "drucken"): Promise<boolean> {
  if (Platform.OS === "web") {
    // Web (Vorschau mit Synchronisation): das Original als PDF im Fenster
    const g = globalThis as unknown as { open?: (u: string, n: string) => unknown; URL: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void }; Blob: new (t: unknown[], o: { type: string }) => unknown };
    const url = g.URL.createObjectURL(new g.Blob([bytes], { type: "application/pdf" }));
    g.open?.(url, "_blank");
    setTimeout(() => g.URL.revokeObjectURL(url), 60_000);
    return true;
  }
  const ziel = new File(Paths.cache, dateiname);
  if (ziel.exists) ziel.delete();
  ziel.create();
  try {
    await ziel.write(bytes);
    if (art === "drucken" || (Platform.OS !== "ios" && !(await Sharing.isAvailableAsync()))) return await druckenUri(ziel.uri);
    return await teilen(ziel.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", titel: dateiname });
  } finally {
    cacheDateiLoeschen(ziel.uri);
  }
}

/** Druckdialog; ein Abbrechen meldet expo-print als Fehler – das ist hier kein Fehler, sondern false. */
async function druckenUri(uri: string): Promise<boolean> {
  try {
    await Print.printAsync({ uri });
    return true;
  } catch (e) {
    if (/did not complete|incomplete|cancel/i.test(String((e as Error)?.message ?? e))) return false;
    throw e;
  }
}

/** Druckvorschau des Systems mit dem fertigen PDF (inkl. Fußzeile); true, wenn gedruckt wurde. */
export async function drucken(html: string, dateiname: string, quer = false): Promise<boolean> {
  if (Platform.OS === "web") {
    imWebOeffnen(html);
    return true;
  }
  const uri = await pdfErstellen(html, dateiname, quer);
  try {
    return await druckenUri(uri);
  } finally {
    cacheDateiLoeschen(uri);
  }
}
