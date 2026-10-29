/** Sicherungsdatei teilen bzw. auswählen (iOS/Android): Datei im Cache, Teilen-Menü; Auswahl über die Dateien-App. */
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File, FileMode, Paths } from "expo-file-system";
import { CONTAINER_KENNUNG, istContainer, type Leser, type Schreiber } from "./sicherungContainer";
import { teilen } from "./teilen";

export const zufall = (n: number) => Crypto.getRandomBytes(n);

/** Datei ins Teilen-Menü; true, wenn sie weitergegeben wurde (false: abgebrochen). */
export async function dateiTeilen(name: string, text: string, mimeType = "application/octet-stream"): Promise<boolean> {
  const ziel = new File(Paths.cache, name);
  if (ziel.exists) ziel.delete();
  ziel.create();
  // SDK 58: `write` ist asynchron – erst teilen, wenn die Datei vollständig geschrieben ist
  await ziel.write(text);
  try {
    return await teilen(ziel.uri, { mimeType, titel: name, UTI: mimeType === "application/xml" ? "public.xml" : undefined });
  } finally {
    // die Datei ist verschlüsselt; trotzdem nicht im Cache liegen lassen
    try {
      ziel.delete();
    } catch {
      /* schon weg */
    }
  }
}

/** Datei auswählen; null bei Abbruch. */
export async function dateiWaehlen(): Promise<{ name: string; text: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const f = new File(a.uri);
  try {
    return { name: a.name, text: await f.text() };
  } finally {
    // auch wenn das Lesen scheitert, die Kopie nicht im Cache liegen lassen (G-12)
    try {
      f.delete();
    } catch {
      /* nicht unsere Kopie */
    }
  }
}

/** Binärdatei teilen (Steuerberater-Paket, Originale von Belegen). */
export async function dateiTeilenBytes(name: string, bytes: Uint8Array, mimeType: string): Promise<boolean> {
  const ziel = new File(Paths.cache, name);
  if (ziel.exists) ziel.delete();
  ziel.create();
  await ziel.write(bytes);
  try {
    return await teilen(ziel.uri, { mimeType, titel: name, UTI: mimeType === "application/zip" ? "public.zip-archive" : mimeType === "application/pdf" ? "com.adobe.pdf" : mimeType === "application/xml" ? "public.xml" : mimeType.startsWith("image/") ? "public.jpeg" : mimeType === "text/calendar" ? "com.apple.ical.ics" : undefined });
  } finally {
    try {
      ziel.delete();
    } catch {
      /* schon weg */
    }
  }
}

/** Datei als Bytes auswählen (PDF, XML, Bilder); null bei Abbruch. */
export async function dateiWaehlenBytes(typen: string[]): Promise<{ name: string; bytes: Uint8Array; mime: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: typen, copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const f = new File(a.uri);
  try {
    return { name: a.name, bytes: f.bytesSync(), mime: a.mimeType ?? "" };
  } finally {
    // auch wenn das Lesen scheitert, die Kopie nicht im Cache liegen lassen (G-12)
    try {
      f.delete();
    } catch {
      /* nicht unsere Kopie */
    }
  }
}

/**
 * Sicherung Stück für Stück in eine Datei im Cache schreiben und teilen (E-194) – die Datei entsteht nie am Stück im
 * Arbeitsspeicher. `schreiben` bekommt einen Schreiber; geteilt wird erst, wenn alles geschrieben ist. Die Datei wird
 * danach gelöscht.
 */
export async function sicherungTeilen<T>(name: string, schreiben: (s: Schreiber) => Promise<T>): Promise<{ geteilt: boolean; ergebnis: T }> {
  const ziel = new File(Paths.cache, name);
  if (ziel.exists) ziel.delete();
  ziel.create();
  try {
    const h = ziel.open(FileMode.WriteOnly);
    let ergebnis: T;
    try {
      ergebnis = await schreiben({ schreiben: (b) => h.writeBytes(b) });
    } finally {
      h.close();
    }
    return { geteilt: await teilen(ziel.uri, { mimeType: "application/octet-stream", titel: name }), ergebnis };
  } finally {
    try {
      ziel.delete();
    } catch {
      /* schon weg */
    }
  }
}

/** Gewählte Sicherungsdatei: Textformat (Version 1/2) als Text, Container (Version 3) zum Lesen in Stücken. */
export interface GewaehlteSicherung {
  name: string;
  text: string | null;
  leser: (() => Promise<Leser>) | null;
  /** Kopie im Cache löschen, wenn sie nicht mehr gebraucht wird */
  entfernen(): void;
}

/** Sicherungsdatei auswählen; null bei Abbruch. Ein Container bleibt bis `entfernen` im Cache (gelesen wird in Stücken). */
export async function sicherungWaehlen(): Promise<GewaehlteSicherung | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  const f = new File(a.uri);
  const entfernen = () => {
    try {
      if (f.exists) f.delete();
    } catch {
      /* nicht unsere Kopie */
    }
  };
  try {
    const h = f.open(FileMode.ReadOnly);
    let anfang: Uint8Array;
    try {
      anfang = h.readBytesSync(CONTAINER_KENNUNG.length);
    } finally {
      h.close();
    }
    if (istContainer(anfang)) {
      const leser = async (): Promise<Leser> => {
        const lh = f.open(FileMode.ReadOnly);
        return { lesen: (n) => lh.readBytes(n), schliessen: () => lh.close() };
      };
      return { name: a.name, text: null, leser, entfernen };
    }
    const text = await f.text();
    entfernen();
    return { name: a.name, text, leser: null, entfernen: () => undefined };
  } catch (e) {
    // auch wenn das Lesen scheitert, die Kopie nicht im Cache liegen lassen (G-12)
    entfernen();
    throw e;
  }
}
