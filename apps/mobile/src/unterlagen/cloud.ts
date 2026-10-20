/**
 * iCloud-Sicherung (E-129, vorbereitet): Im eigenen App-Build (Development/TestFlight) legt Amtlos verschlüsselte
 * Sicherungen im iCloud-Drive-Ordner „Amtlos“ ab. In Expo Go fehlt das native Modul – dann ist die Funktion
 * unsichtbar. Bibliothek: react-native-cloud-storage (iCloud Documents, Config-Plugin in app.json).
 */
import type * as Bibliothek from "react-native-cloud-storage";
import { schluesselKennung, sicherungsKdf } from "./sicherung";

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

/** Tag in Deutschland (YYYY-MM-DD) für die Tages-Sicherung. */
const tag = (jetzt: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(jetzt);

/**
 * Sichern: die aktuelle Datei wird jedes Mal ersetzt, die Wochen-Sicherung ebenso (Stand am Ende der Woche). Dazu
 * kommt je Tag eine Sicherung, die nur einmal geschrieben wird – mit dem Stand vom Tagesbeginn (M8): Wer heute
 * versehentlich etwas löscht, findet es in der Sicherung von heute früh bzw. gestern noch.
 */
export async function cloudSchreiben(text: string, jetzt = new Date()): Promise<void> {
  const l = lib();
  if (!l) throw new Error("iCloud nicht verfügbar");
  const { CloudStorage, CloudStorageScope } = l;
  if (!(await CloudStorage.exists(ORDNER, CloudStorageScope.Documents))) await CloudStorage.mkdir(ORDNER, CloudStorageScope.Documents);
  const tagesDatei = `${ORDNER}/Amtlos-Sicherung-Tag-${tag(jetzt)}.amtlos`;
  if (!(await CloudStorage.exists(tagesDatei, CloudStorageScope.Documents))) {
    // Stand vom Tagesbeginn: die bisherige aktuelle Sicherung, sonst die neue
    const vorher = (await CloudStorage.exists(AKTUELL, CloudStorageScope.Documents)) ? await CloudStorage.readFile(AKTUELL, CloudStorageScope.Documents).catch(() => null) : null;
    await CloudStorage.writeFile(tagesDatei, vorher ?? text, CloudStorageScope.Documents);
  }
  await CloudStorage.writeFile(AKTUELL, text, CloudStorageScope.Documents);
  await CloudStorage.writeFile(`${ORDNER}/Amtlos-Sicherung-${kalenderwoche(jetzt)}.amtlos`, text, CloudStorageScope.Documents);
  await aufraeumen().catch(() => undefined);
}

/** So viele Wochen-Sicherungen bleiben in iCloud; ältere werden gelöscht (die aktuelle enthält ohnehin alles). */
export const WOCHEN_BEHALTEN = 12;
/** So viele Tages-Sicherungen bleiben (M8). */
export const TAGE_BEHALTEN = 7;
/** So viele beiseitegelegte Sicherungen („vorher“, z. B. vom alten iPhone) bleiben (G-5). */
export const VORHER_BEHALTEN = 3;

/** Welche Sicherungsdateien im Ordner zu löschen sind – je Art nur die neuesten behalten. */
export function zuLoeschen(namen: string[]): string[] {
  const art = (re: RegExp, behalten: number) => {
    const l = namen.filter((n) => re.test(n)).sort();
    return l.slice(0, Math.max(0, l.length - behalten));
  };
  return [...art(/^Amtlos-Sicherung-\d{4}-KW\d{2}\.amtlos$/, WOCHEN_BEHALTEN), ...art(/^Amtlos-Sicherung-Tag-\d{4}-\d{2}-\d{2}\.amtlos$/, TAGE_BEHALTEN), ...art(/^Amtlos-Sicherung-vorher-[\dT-]+\.amtlos$/, VORHER_BEHALTEN)];
}

/**
 * Aufräumen (E-143, G-5): ältere Wochen-, Tages- und beiseitegelegte Sicherungen löschen und danach die Ordner
 * „Belege-<Kennung>“, auf die keine verbliebene Sicherung mehr verweist (altes Passwort). iCloud soll nicht mit
 * jeder Woche um eine volle Kopie wachsen, und alte Kopien sollen nicht unbegrenzt liegen bleiben.
 */
async function aufraeumen(): Promise<void> {
  const l = lib();
  if (!l) return;
  const { CloudStorage, CloudStorageScope } = l;
  const namen = await CloudStorage.readdir(ORDNER, CloudStorageScope.Documents);
  const weg = new Set(zuLoeschen(namen));
  for (const n of weg) await CloudStorage.unlink(`${ORDNER}/${n}`, CloudStorageScope.Documents).catch(() => undefined);
  // Kennungen der verbliebenen Sicherungen – nur Belegordner ohne Sicherung werden gelöscht
  const sicherungen = namen.filter((n) => /^Amtlos-Sicherung-.*\.amtlos$/.test(n) && !weg.has(n));
  const kennungen = new Set<string>();
  for (const n of sicherungen) {
    const text = await CloudStorage.readFile(`${ORDNER}/${n}`, CloudStorageScope.Documents).catch(() => null);
    const kdf = text ? sicherungsKdf(text) : null;
    // eine unlesbare Sicherung: im Zweifel nichts löschen
    if (!kdf) return;
    kennungen.add(schluesselKennung(kdf.salz));
  }
  if (!kennungen.size) return;
  for (const n of namen) {
    const m = /^Belege-([0-9a-f]+)$/.exec(n);
    if (m && !kennungen.has(m[1]!)) await CloudStorage.rmdir(`${ORDNER}/${n}`, { recursive: true }, CloudStorageScope.Documents).catch(() => undefined);
  }
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
