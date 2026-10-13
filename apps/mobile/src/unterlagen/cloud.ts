/**
 * iCloud-Sicherung (E-129, vorbereitet): Im eigenen App-Build (Development/TestFlight) legt Amtlos verschlüsselte
 * Sicherungen im iCloud-Drive-Ordner „Amtlos“ ab. In Expo Go fehlt das native Modul – dann ist die Funktion
 * unsichtbar. Bibliothek: react-native-cloud-storage (iCloud Documents, Config-Plugin in app.json).
 */
import { CloudStorage, CloudStorageScope } from "react-native-cloud-storage";

const ORDNER = "/Amtlos";
export const AKTUELL = `${ORDNER}/Amtlos-Sicherung-aktuell.amtlos`;

export async function cloudVerfuegbar(): Promise<boolean> {
  try {
    return await CloudStorage.isCloudAvailable();
  } catch {
    return false;
  }
}

/** ISO-Kalenderwoche für eine Wochen-Sicherung (eine Datei je Woche, die aktuelle wird jedes Mal ersetzt). */
export function kalenderwoche(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahresanfang = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const kw = Math.ceil(((t.getTime() - jahresanfang.getTime()) / 864e5 + 1) / 7);
  return `${t.getUTCFullYear()}-KW${String(kw).padStart(2, "0")}`;
}

export async function cloudSchreiben(text: string, jetzt = new Date()): Promise<void> {
  if (!(await CloudStorage.exists(ORDNER, CloudStorageScope.Documents))) await CloudStorage.mkdir(ORDNER, CloudStorageScope.Documents);
  await CloudStorage.writeFile(AKTUELL, text, CloudStorageScope.Documents);
  await CloudStorage.writeFile(`${ORDNER}/Amtlos-Sicherung-${kalenderwoche(jetzt)}.amtlos`, text, CloudStorageScope.Documents);
}

/** Letzte Sicherung aus iCloud (oder null). */
export async function cloudLesen(): Promise<string | null> {
  try {
    if (!(await CloudStorage.exists(AKTUELL, CloudStorageScope.Documents))) return null;
    return await CloudStorage.readFile(AKTUELL, CloudStorageScope.Documents);
  } catch {
    return null;
  }
}
