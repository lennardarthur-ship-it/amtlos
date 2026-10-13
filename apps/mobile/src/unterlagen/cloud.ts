/**
 * iCloud-Sicherung (E-129, vorbereitet): Im eigenen App-Build (Development/TestFlight) legt Amtlos verschlüsselte
 * Sicherungen im iCloud-Drive-Ordner „Amtlos“ ab. In Expo Go fehlt das native Modul – dann ist die Funktion
 * unsichtbar. Bibliothek: react-native-cloud-storage (iCloud Documents, Config-Plugin in app.json).
 */
import type * as Bibliothek from "react-native-cloud-storage";

type Lib = typeof Bibliothek;
let geladen: Lib | null | undefined;
/** Erst bei Bedarf laden – in Expo Go fehlt das native Modul, dann bleibt die Funktion aus, statt die App zu stören. */
function lib(): Lib | null {
  if (geladen === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      geladen = require("react-native-cloud-storage") as Lib;
    } catch {
      geladen = null;
    }
  }
  return geladen;
}

const ORDNER = "/Amtlos";
export const AKTUELL = `${ORDNER}/Amtlos-Sicherung-aktuell.amtlos`;

export async function cloudVerfuegbar(): Promise<boolean> {
  try {
    const l = lib();
    return l ? await l.CloudStorage.isCloudAvailable() : false;
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
  const l = lib();
  if (!l) throw new Error("iCloud nicht verfügbar");
  const { CloudStorage, CloudStorageScope } = l;
  if (!(await CloudStorage.exists(ORDNER, CloudStorageScope.Documents))) await CloudStorage.mkdir(ORDNER, CloudStorageScope.Documents);
  await CloudStorage.writeFile(AKTUELL, text, CloudStorageScope.Documents);
  await CloudStorage.writeFile(`${ORDNER}/Amtlos-Sicherung-${kalenderwoche(jetzt)}.amtlos`, text, CloudStorageScope.Documents);
}

/** Letzte Sicherung aus iCloud (oder null). */
export async function cloudLesen(): Promise<string | null> {
  try {
    const l = lib();
    if (!l) return null;
    const { CloudStorage, CloudStorageScope } = l;
    if (!(await CloudStorage.exists(AKTUELL, CloudStorageScope.Documents))) return null;
    return await CloudStorage.readFile(AKTUELL, CloudStorageScope.Documents);
  } catch {
    return null;
  }
}

/**
 * Belegdateien liegen einzeln im Unterordner „Belege“ (verschlüsselt mit dem Sicherungsschlüssel) und werden nur
 * einmal hochgeladen – sonst müsste jede automatische Sicherung alle Fotos neu verpacken (Speicher, Akku, Tempo).
 */
// je Sicherungsschlüssel ein eigener Ordner (Kennung aus dem Salz): ein neues Passwort mischt sich nie mit alten Dateien
const belege = (kennung: string) => `${ORDNER}/Belege-${kennung}`;

/** Namen der schon in iCloud liegenden Belegdateien. */
export async function cloudDateien(kennung: string): Promise<Set<string>> {
  const l = lib();
  if (!l) return new Set();
  const { CloudStorage, CloudStorageScope } = l;
  if (!(await CloudStorage.exists(belege(kennung), CloudStorageScope.Documents))) return new Set();
  return new Set((await CloudStorage.readdir(belege(kennung), CloudStorageScope.Documents)).map((n) => n.replace(/\.amtlos$/, "")));
}

export async function cloudDateiSchreiben(kennung: string, name: string, text: string): Promise<void> {
  const l = lib();
  if (!l) throw new Error("iCloud nicht verfügbar");
  const { CloudStorage, CloudStorageScope } = l;
  if (!(await CloudStorage.exists(ORDNER, CloudStorageScope.Documents))) await CloudStorage.mkdir(ORDNER, CloudStorageScope.Documents);
  if (!(await CloudStorage.exists(belege(kennung), CloudStorageScope.Documents))) await CloudStorage.mkdir(belege(kennung), CloudStorageScope.Documents);
  await CloudStorage.writeFile(`${belege(kennung)}/${name}.amtlos`, text, CloudStorageScope.Documents);
}

export async function cloudDateiLesen(kennung: string, name: string): Promise<string | null> {
  try {
    const l = lib();
    if (!l) return null;
    const { CloudStorage, CloudStorageScope } = l;
    const pfad = `${belege(kennung)}/${name}.amtlos`;
    if (!(await CloudStorage.exists(pfad, CloudStorageScope.Documents))) return null;
    return await CloudStorage.readFile(pfad, CloudStorageScope.Documents);
  } catch {
    return null;
  }
}

/** Vorhandene Sicherung nicht überschreiben, sondern unter neuem Namen beiseitelegen (z. B. beim Einrichten auf einem neuen iPhone). */
export async function cloudBeiseitelegen(text: string, jetzt = new Date()): Promise<void> {
  const l = lib();
  if (!l) return;
  const { CloudStorage, CloudStorageScope } = l;
  await CloudStorage.writeFile(`${ORDNER}/Amtlos-Sicherung-vorher-${jetzt.toISOString().slice(0, 16).replace(":", "-")}.amtlos`, text, CloudStorageScope.Documents);
}
