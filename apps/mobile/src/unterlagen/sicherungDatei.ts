/** Sicherungsdatei teilen bzw. auswählen (iOS/Android): Datei im Cache, Teilen-Menü; Auswahl über die Dateien-App. */
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export const zufall = (n: number) => Crypto.getRandomBytes(n);

export async function dateiTeilen(name: string, text: string, mimeType = "application/octet-stream"): Promise<void> {
  const ziel = new File(Paths.cache, name);
  if (ziel.exists) ziel.delete();
  ziel.create();
  ziel.write(text);
  await Sharing.shareAsync(ziel.uri, { mimeType, dialogTitle: name, UTI: mimeType === "application/xml" ? "public.xml" : undefined });
  // die Datei ist verschlüsselt; trotzdem nicht im Cache liegen lassen
  try {
    ziel.delete();
  } catch {
    /* schon weg */
  }
}

/** Datei auswählen; null bei Abbruch. */
export async function dateiWaehlen(): Promise<{ name: string; text: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const f = new File(a.uri);
  const text = await f.text();
  try {
    f.delete();
  } catch {
    /* nicht unsere Kopie */
  }
  return { name: a.name, text };
}

/** Binärdatei teilen (Steuerberater-Paket, Originale von Belegen). */
export async function dateiTeilenBytes(name: string, bytes: Uint8Array, mimeType: string): Promise<void> {
  const ziel = new File(Paths.cache, name);
  if (ziel.exists) ziel.delete();
  ziel.create();
  ziel.write(bytes);
  await Sharing.shareAsync(ziel.uri, { mimeType, dialogTitle: name, UTI: mimeType === "application/zip" ? "public.zip-archive" : mimeType === "application/pdf" ? "com.adobe.pdf" : mimeType === "application/xml" ? "public.xml" : mimeType.startsWith("image/") ? "public.jpeg" : undefined });
  try {
    ziel.delete();
  } catch {
    /* schon weg */
  }
}

/** Datei als Bytes auswählen (PDF, XML, Bilder); null bei Abbruch. */
export async function dateiWaehlenBytes(typen: string[]): Promise<{ name: string; bytes: Uint8Array; mime: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: typen, copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const f = new File(a.uri);
  const bytes = f.bytesSync();
  try {
    f.delete();
  } catch {
    /* nicht unsere Kopie */
  }
  return { name: a.name, bytes, mime: a.mimeType ?? "" };
}
