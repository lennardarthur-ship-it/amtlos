/**
 * PDF auf dem Gerät (E-121, E-123): HTML → PDF mit expo-print, Fußzeile mit Seitenzahlen per pdf-lib, Weitergabe über
 * das Teilen-Menü (Dateien, Mail, AirDrop, Drucken). Im Web (Vorschau, Rundgang) öffnet sich das Dokument im Fenster.
 */
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { fussAngaben, fusszeileStempeln } from "./fusszeile";

/** A4 in Punkt (72 dpi). Ränder wie im Dokument (@page): unten Platz für die Fußzeile. */
const A4 = { width: 595, height: 842 };
const RAND = { top: 54, bottom: 62, left: 54, right: 50 };

function imWebOeffnen(html: string) {
  const w = (globalThis as unknown as { open?: (u: string, n: string) => { document: { write(s: string): void; close(): void } } | null }).open?.("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

/** Erstellt das PDF mit Fußzeile unter einem lesbaren Dateinamen und gibt die Datei-URI zurück. */
export async function pdfErstellen(html: string, dateiname: string, quer = false): Promise<string> {
  const seite = quer ? { width: A4.height, height: A4.width } : A4;
  const { uri, base64 } = await Print.printToFileAsync({ html, ...seite, margins: RAND, base64: true });
  const ziel = new File(Paths.cache, dateiname);
  try {
    const { links, rechts } = fussAngaben(html);
    const bytes = await fusszeileStempeln(base64 ?? new File(uri).base64Sync(), links, rechts);
    if (ziel.exists) ziel.delete();
    ziel.create();
    ziel.write(bytes);
    return ziel.uri;
  } catch {
    // Fußzeile und Umbenennen sind Komfort – notfalls das unveränderte PDF teilen
    return uri;
  }
}

/** Erstellt das PDF und öffnet das Teilen-Menü. */
export async function pdfTeilen(html: string, dateiname: string, quer = false): Promise<void> {
  if (Platform.OS === "web") return imWebOeffnen(html);
  const uri = await pdfErstellen(html, dateiname, quer);
  if (!(await Sharing.isAvailableAsync())) return Print.printAsync({ uri });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: dateiname });
}

/** Druckvorschau des Systems mit dem fertigen PDF (inkl. Fußzeile). */
export async function drucken(html: string, dateiname: string, quer = false): Promise<void> {
  if (Platform.OS === "web") return imWebOeffnen(html);
  await Print.printAsync({ uri: await pdfErstellen(html, dateiname, quer) });
}
