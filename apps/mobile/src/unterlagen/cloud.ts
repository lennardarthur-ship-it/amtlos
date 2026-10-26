/**
 * iCloud-Sicherung (E-129, vorbereitet): Im eigenen App-Build (Development/TestFlight) legt Amtlos verschlüsselte
 * Sicherungen im iCloud-Drive-Ordner „Amtlos“ ab (technischer Ordnername, bleibt bei einer Umbenennung der Marke – sonst
 * fände die App vorhandene Sicherungen nicht mehr). Die Dateinamen tragen den sichtbaren Namen (`MARKE.name`); gelesen und
 * aufgeräumt wird unabhängig vom Präfix, damit Sicherungen unter einem früheren Namen („Amtlos-Sicherung-…“) weiter zählen.
 * In Expo Go fehlt das native Modul – dann ist die Funktion unsichtbar. Bibliothek: react-native-cloud-storage (iCloud Documents, Config-Plugin in app.json).
 *
 * Der Ablauf (aktuell, Tag, Woche, Aufräumen, Belegordner) steht seit E-190 in `cloudLogik.ts` und gilt genauso für den
 * Sicherungsordner auf Android (`cloud.android.ts`); hier nur die Anbindung an iCloud Drive.
 */
import type * as Bibliothek from "react-native-cloud-storage";
import { MARKE } from "@amtlos/marke";
import * as logik from "./cloudLogik";
import type { Ablage, SicherungsOrt } from "./cloudLogik";

export { kalenderwoche, zuLoeschen, WOCHEN_BEHALTEN, TAGE_BEHALTEN, VORHER_BEHALTEN } from "./cloudLogik";

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

/** Technischer Ordnername in iCloud Drive – nicht mit der Marke ändern (amtlos-intern: docs/14-marke.md). */
const ORDNER = "/Amtlos";
export const AKTUELL = `${ORDNER}/${MARKE.name}-Sicherung-aktuell.amtlos`;

/** iCloud Drive (Dokumente des App-Containers) als Ablage – ohne natives Modul wirft jede Operation. */
function ort(): SicherungsOrt {
  const l = lib();
  if (!l) throw new Error("iCloud nicht verfügbar");
  const { CloudStorage, CloudStorageScope } = l;
  const d = CloudStorageScope.Documents;
  const ablage: Ablage = {
    exists: (p) => CloudStorage.exists(p, d),
    mkdir: (p) => CloudStorage.mkdir(p, d),
    readdir: (p) => CloudStorage.readdir(p, d),
    readFile: (p) => CloudStorage.readFile(p, d),
    writeFile: (p, t) => CloudStorage.writeFile(p, t, d),
    unlink: (p) => CloudStorage.unlink(p, d),
    rmdir: (p) => CloudStorage.rmdir(p, { recursive: true }, d),
  };
  return { ablage, ordner: ORDNER };
}

export async function cloudVerfuegbar(): Promise<boolean> {
  try {
    const l = lib();
    return l ? await l.CloudStorage.isCloudAvailable() : false;
  } catch {
    return false;
  }
}

export async function cloudSchreiben(text: string, jetzt = new Date()): Promise<void> {
  await logik.schreiben(ort(), text, jetzt);
}

/** Letzte Sicherung aus iCloud (oder null). */
export async function cloudLesen(): Promise<string | null> {
  if (!lib()) return null;
  return logik.lesen(ort());
}

/** Namen der schon in iCloud liegenden Belegdateien. */
export async function cloudDateien(kennung: string): Promise<Set<string>> {
  if (!lib()) return new Set();
  return logik.dateien(ort(), kennung);
}

export async function cloudDateiSchreiben(kennung: string, name: string, text: string): Promise<void> {
  await logik.dateiSchreiben(ort(), kennung, name, text);
}

export async function cloudDateiLesen(kennung: string, name: string): Promise<string | null> {
  if (!lib()) return null;
  return logik.dateiLesen(ort(), kennung, name);
}

/** Vorhandene Sicherung nicht überschreiben, sondern unter neuem Namen beiseitelegen (z. B. beim Einrichten auf einem neuen iPhone). */
export async function cloudBeiseitelegen(text: string, jetzt = new Date()): Promise<void> {
  if (!lib()) return;
  await logik.beiseitelegen(ort(), text, jetzt);
}

/**
 * Ordnerwahl gibt es nur auf Android (E-190) – iCloud Drive braucht keine. Gleiche Schnittstelle wie `cloud.android.ts`,
 * damit „Deine Daten“ und die Einrichtung für beide Plattformen dieselben Aufrufe nutzen.
 */
export const ORDNER_WAHL = false;
export type OrdnerStatus = { art: "ok"; name: string } | { art: "keiner" } | { art: "kein_zugriff"; name: string };
export async function ordnerStatus(): Promise<OrdnerStatus> {
  return { art: "ok", name: "iCloud Drive" };
}
export async function ordnerWaehlen(): Promise<OrdnerStatus | null> {
  return null;
}
export async function ordnerVergessen(): Promise<void> {}
