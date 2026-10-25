/**
 * Gespeicherter Stand auf iPhone und Android (E-194): verschlüsselte Teildateien im Dokumentenordner der App
 * (`<Dokumente>/stand/`), Ablauf in `standAblage.ts`. Gleiche Schnittstelle wie `standSpeicher.web.ts`.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { nonce, schluesselHolen } from "./schluesselbund";
import { StandAblage, type Dateisystem } from "./standAblage";

const NAME = /^[0-9A-Za-z._-]+$/;
const wurzel = () => new Directory(Paths.document, "stand");
/** Datei unter `stand/` – nur einfache Namen, keine Pfade von außen */
function datei(name: string): File {
  const teile = name.split("/");
  if (!teile.length || teile.length > 2 || !teile.every((t) => NAME.test(t) && t !== "." && t !== "..")) throw new Error("Ungültiger Name");
  return new File(wurzel(), ...teile);
}
function ordnerFuer(name: string): void {
  const teile = name.split("/");
  const d = teile.length > 1 ? new Directory(wurzel(), teile[0]!) : wurzel();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

const dateisystem: Dateisystem = {
  lesen: async (name) => {
    const f = datei(name);
    return f.exists ? f.bytes() : null;
  },
  schreiben: async (name, bytes) => {
    ordnerFuer(name);
    const f = datei(name);
    f.create({ overwrite: true });
    // SDK 58: `write` ist asynchron – erst nach dem Schreiben weiter
    await f.write(bytes);
  },
  ersetzen: async (name, bytes) => {
    ordnerFuer(name);
    const neu = datei(`${name}.neu`);
    neu.create({ overwrite: true });
    await neu.write(bytes);
    // ersetzt die bisherige Datei erst, wenn die neue vollständig geschrieben ist
    neu.moveSync(datei(name), { overwrite: true });
  },
  namen: (ordner) => {
    const d = ordner ? new Directory(wurzel(), ordner) : wurzel();
    if (!d.exists) return [];
    return d.list().filter((e): e is File => e instanceof File).map((e) => e.name);
  },
  loeschen: (name) => {
    const f = datei(name);
    if (f.exists) f.delete();
  },
  verschieben: (von, nach) => {
    ordnerFuer(nach);
    datei(von).moveSync(datei(nach), { overwrite: true });
  },
  leeren: () => {
    const d = wurzel();
    if (d.exists) d.delete();
  },
};

const ablage = new StandAblage(dateisystem, AsyncStorage, { holen: schluesselHolen }, nonce);

export const standSpeicher = {
  laden: () => ablage.laden(),
  /** Auf dem Gerät nie unverschlüsselt (E-143) */
  speichern: (text: string, k: Uint8Array | null): Promise<void> => (k ? ablage.speichern(text, k) : Promise.reject(new Error("Ohne Schlüssel wird nichts gespeichert"))),
  beiseitelegen: (k: Uint8Array | null) => ablage.beiseitelegen(k),
  beiseitegelegtVorhanden: () => ablage.beiseitegelegtVorhanden(),
  beiseitegelegteOeffnen: (schluessel: readonly Uint8Array[]) => ablage.beiseitegelegteOeffnen(schluessel),
  allesLoeschen: (nachLadefehler: boolean) => ablage.allesLoeschen(nachLadefehler),
};
