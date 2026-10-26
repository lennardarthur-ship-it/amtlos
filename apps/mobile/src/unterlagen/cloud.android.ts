/**
 * Automatische Sicherung auf Android (E-190, Gegenstück zur iCloud-Sicherung): Der Nutzer wählt einmal einen Ordner über
 * die Ordnerauswahl von Android (Speicherzugriffs-Framework, SAF) – auf dem Smartphone, in Google Drive, Nextcloud oder bei
 * jedem anderen Anbieter, der sich dort einklinkt. Die App bekommt nur Zugriff auf diesen Ordner (dauerhaft, über
 * `takePersistableUriPermission` in expo-file-system) und schreibt dort dieselben verschlüsselten `.amtlos`-Dateien wie
 * in iCloud Drive: aktuell, je Tag, je Woche, Belegordner (Ablauf in `cloudLogik.ts`). Keine Anmeldung bei Google in der App.
 *
 * Der Ordner (content://-Adresse und Anzeigename) liegt nur auf diesem Gerät (AsyncStorage) – nicht im Stand, nicht in
 * der Sicherung, nicht in der Synchronisation. Fehlt die Berechtigung später (Ordner gelöscht, Anbieter abgemeldet,
 * Berechtigung entzogen), meldet `ordnerStatus` „kein_zugriff“ – „Deine Daten“ und die Sicherungs-Erinnerung sagen es,
 * und man wählt den Ordner neu.
 *
 * SAF-Besonderheiten: Kindadressen lassen sich nicht zusammensetzen (Dokument-IDs), deshalb wird je Pfadteil gelistet
 * und nach Namen gesucht; und „w“ kürzt eine vorhandene Datei bei manchen Anbietern nicht – eine Datei wird deshalb
 * gelöscht und neu angelegt, statt überschrieben (Restbytes würden die Sicherung unlesbar machen).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File } from "expo-file-system";
import { MARKE } from "@amtlos/marke";
import * as logik from "./cloudLogik";
import { ordnerAnzeigeName as anzeigeName } from "./cloudLogik";
import type { Ablage, SicherungsOrt } from "./cloudLogik";

export { kalenderwoche, zuLoeschen, WOCHEN_BEHALTEN, TAGE_BEHALTEN, VORHER_BEHALTEN, SicherungUnlesbar, type VorhandeneSicherung } from "./cloudLogik";

/** Dateien liegen direkt im gewählten Ordner – der Nutzer legt dafür am besten einen eigenen an. */
const ORDNER = "";
export const AKTUELL = `/${MARKE.name}-Sicherung-aktuell.amtlos`;
const SCHLUESSEL = "amtlos.sicherungsordner.v1";
const MIME = "application/octet-stream";

export const ORDNER_WAHL = true;
export type OrdnerStatus = { art: "ok"; name: string } | { art: "keiner" } | { art: "kein_zugriff"; name: string };
type Gemerkt = { uri: string; name: string };

async function gemerkt(): Promise<Gemerkt | null> {
  try {
    const roh = await AsyncStorage.getItem(SCHLUESSEL);
    const g = roh ? (JSON.parse(roh) as Partial<Gemerkt>) : null;
    return g && typeof g.uri === "string" && g.uri.startsWith("content://") ? { uri: g.uri, name: typeof g.name === "string" ? g.name : "" } : null;
  } catch {
    return null;
  }
}

/** Ist der Ordner noch erreichbar? `exists` ist false ohne Leserecht (entzogen) oder wenn der Ordner fehlt. */
function erreichbar(uri: string): boolean {
  try {
    return new Directory(uri).exists;
  } catch {
    return false;
  }
}

export async function ordnerStatus(): Promise<OrdnerStatus> {
  const g = await gemerkt();
  if (!g) return { art: "keiner" };
  return erreichbar(g.uri) ? { art: "ok", name: g.name } : { art: "kein_zugriff", name: g.name };
}

/** Ordnerauswahl von Android öffnen; null bei Abbruch. Der Zugriff bleibt über Neustarts erhalten. */
export async function ordnerWaehlen(): Promise<OrdnerStatus | null> {
  let d: Directory;
  try {
    d = await Directory.pickDirectoryAsync();
  } catch {
    // abgebrochen (oder keine Auswahl möglich)
    return null;
  }
  if (!d?.uri) return null;
  const name = anzeigeName(d.uri);
  await AsyncStorage.setItem(SCHLUESSEL, JSON.stringify({ uri: d.uri, name } satisfies Gemerkt));
  return erreichbar(d.uri) ? { art: "ok", name } : { art: "kein_zugriff", name };
}

export async function ordnerVergessen(): Promise<void> {
  await AsyncStorage.removeItem(SCHLUESSEL).catch(() => undefined);
}

/**
 * Einträge eines Ordners mit ihrem Anzeigenamen. `list()` liefert nur Adressen; bei Cloud-Anbietern steckt der Name
 * nicht darin (Dokument-ID). `info().files` liefert die Anzeigenamen aus derselben Abfrage in derselben Reihenfolge –
 * passen die Längen nicht, gilt der Name aus der Adresse (so bei Ordnern auf dem Gerät).
 */
function eintraege(d: Directory): { name: string; e: Directory | File }[] {
  const l = d.list();
  let namen: string[] | undefined;
  try {
    namen = d.info().files;
  } catch {
    namen = undefined;
  }
  return l.map((e, i) => ({ name: namen && namen.length === l.length ? namen[i]! : e.name, e }));
}

/** Ablage im gewählten Ordner: Pfade „/a/b.amtlos“ werden Teil für Teil über die Namen der Einträge aufgelöst. */
function ablageIn(wurzel: Directory): Ablage {
  const teile = (pfad: string) => pfad.split("/").filter(Boolean);
  const kind = (d: Directory, name: string): Directory | File | null => eintraege(d).find((x) => x.name === name)?.e ?? null;
  const finde = (pfad: string): Directory | File | null => {
    let aktuell: Directory | File = wurzel;
    for (const t of teile(pfad)) {
      if (!(aktuell instanceof Directory)) return null;
      const n = kind(aktuell, t);
      if (!n) return null;
      aktuell = n;
    }
    return aktuell;
  };
  const eltern = (pfad: string): [Directory, string] => {
    const t = teile(pfad);
    const name = t.pop();
    const d = t.length ? finde(t.join("/")) : wurzel;
    if (!name || !(d instanceof Directory)) throw new Error(`Ordner fehlt: ${pfad}`);
    return [d, name];
  };
  return {
    exists: async (p) => (teile(p).length ? finde(p) !== null : wurzel.exists),
    mkdir: async (p) => {
      const [d, name] = eltern(p);
      if (!kind(d, name)) d.createDirectory(name);
    },
    readdir: async (p) => {
      const d = teile(p).length ? finde(p) : wurzel;
      if (!(d instanceof Directory)) throw new Error(`kein Ordner: ${p}`);
      return eintraege(d).map((x) => x.name);
    },
    readFile: async (p) => {
      const f = finde(p);
      if (!(f instanceof File)) throw new Error(`keine Datei: ${p}`);
      return f.text();
    },
    writeFile: async (p, text) => {
      const [d, name] = eltern(p);
      // ersetzen statt überschreiben: „w“ kürzt bei manchen Anbietern nicht (siehe oben)
      const alt = kind(d, name);
      if (alt) alt.delete();
      const neu = d.createFile(name, MIME);
      await neu.write(text);
    },
    unlink: async (p) => {
      const f = finde(p);
      if (f) f.delete();
    },
    rmdir: async (p) => {
      const d = finde(p);
      if (d) d.delete();
    },
  };
}

async function ort(): Promise<SicherungsOrt> {
  const g = await gemerkt();
  if (!g) throw new Error("Kein Sicherungsordner gewählt");
  const wurzel = new Directory(g.uri);
  if (!wurzel.exists) throw new Error("Kein Zugriff auf den Sicherungsordner");
  return { ablage: ablageIn(wurzel), ordner: ORDNER, ersatzAusWoche: true };
}

/** Verfügbar = ein Ordner ist gewählt und erreichbar (die Ordnerwahl selbst steht immer zur Verfügung). */
export async function cloudVerfuegbar(): Promise<boolean> {
  return (await ordnerStatus()).art === "ok";
}

/** Sichern; wirft `SicherungUnlesbar`, wenn die vorhandene Sicherung nicht lesbar ist (E-209) – außer mit `ersetzen`. */
export async function cloudSchreiben(text: string, jetzt = new Date(), opt: { ersetzen?: boolean } = {}): Promise<void> {
  await logik.schreiben(await ort(), text, jetzt, opt);
}

/** E-209: vorhandene Sicherung im Ordner prüfen (Cloud-Anbieter laden beim Lesen; mehrere Versuche mit Pause). */
export async function cloudVorhanden(): Promise<logik.VorhandeneSicherung> {
  return logik.vorhandeneSicherung(await ort());
}

export async function cloudLesen(): Promise<string | null> {
  try {
    return await logik.lesen(await ort());
  } catch {
    return null;
  }
}

export async function cloudDateien(kennung: string): Promise<Set<string>> {
  return logik.dateien(await ort(), kennung);
}

export async function cloudDateiSchreiben(kennung: string, name: string, text: string): Promise<void> {
  await logik.dateiSchreiben(await ort(), kennung, name, text);
}

export async function cloudDateiLesen(kennung: string, name: string): Promise<string | null> {
  try {
    return await logik.dateiLesen(await ort(), kennung, name);
  } catch {
    return null;
  }
}

export async function cloudBeiseitelegen(text: string, jetzt = new Date()): Promise<void> {
  await logik.beiseitelegen(await ort(), text, jetzt);
}
