/**
 * PDF auf dem Gerät (E-121): HTML → PDF mit expo-print, Weitergabe über das Teilen-Menü (Dateien, Mail, AirDrop,
 * Drucken). Im Web (Vorschau, Rundgang) öffnet sich das Dokument in einem neuen Fenster.
 */
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/** A4 in Punkt (72 dpi). */
const A4 = { width: 595, height: 842 };
const RAND = { top: 40, bottom: 40, left: 36, right: 36 };

function imWebOeffnen(html: string) {
  const w = (globalThis as unknown as { open?: (u: string, n: string) => { document: { write(s: string): void; close(): void } } | null }).open?.("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

/** Erstellt das PDF unter einem lesbaren Dateinamen und öffnet das Teilen-Menü. */
export async function pdfTeilen(html: string, dateiname: string, quer = false): Promise<void> {
  if (Platform.OS === "web") return imWebOeffnen(html);
  const seite = quer ? { width: A4.height, height: A4.width } : A4;
  const { uri } = await Print.printToFileAsync({ html, ...seite, margins: RAND });
  let ziel = uri;
  try {
    const datei = new File(Paths.cache, dateiname);
    if (datei.exists) datei.delete();
    await new File(uri).move(datei);
    ziel = datei.uri;
  } catch {
    // Umbenennen ist Komfort – notfalls mit dem vorläufigen Namen teilen
  }
  if (!(await Sharing.isAvailableAsync())) return Print.printAsync({ uri: ziel });
  await Sharing.shareAsync(ziel, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: dateiname });
}

/** Druckvorschau des Systems (dort auch „Als PDF sichern“). */
export async function drucken(html: string, quer = false): Promise<void> {
  if (Platform.OS === "web") return imWebOeffnen(html);
  await Print.printAsync({ html, orientation: quer ? Print.Orientation.landscape : Print.Orientation.portrait, margins: RAND });
}
