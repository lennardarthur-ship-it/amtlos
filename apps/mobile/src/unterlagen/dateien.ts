/**
 * Dateien zu Belegen (E-133): Fotos, PDFs und E-Rechnungen im App-Ordner – verschlüsselt mit demselben Schlüssel wie
 * der Stand (AES-256-GCM, Schlüssel im Schlüsselbund). Die Originaldatei einer E-Rechnung bleibt so byte-genau erhalten
 * (GoBD). Im Stand steht nur der Dateiname.
 */
import { istBelegDateiname } from "@amtlos/fachlogik";
import { Directory, File, Paths } from "expo-file-system";
import { nonce } from "./schluesselbund";
import { ausBase64, base64 } from "./sicherung";
import { tresorOeffnen, tresorSchliessen } from "./tresor";

const ordner = () => {
  const d = new Directory(Paths.document, "belege");
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};
/** Datei im Belegordner – nur unter einem Namen, wie die App ihn vergibt (G-1: keine Pfade aus Sync oder Sicherung). */
const datei = (name: string, endung = ".amtlos") => {
  if (!istBelegDateiname(name)) throw new Error("Ungültiger Dateiname");
  return new File(ordner(), `${name}${endung}`);
};
/** Zusatztext der Verschlüsselung: bindet den Inhalt an den Dateinamen (M-1) */
const kontext = (name: string) => `datei:${name}`;

/**
 * Datei verschlüsselt ablegen – erst vollständig unter einem Zwischennamen schreiben, dann die alte ersetzen (G4):
 * bricht das Schreiben ab, bleibt die bisherige Datei unversehrt.
 */
export async function dateiAblegen(name: string, bytes: Uint8Array, schluessel: Uint8Array | null): Promise<void> {
  if (!schluessel) throw new Error("Ohne Schlüssel wird nichts abgelegt");
  const f = datei(name);
  const neu = datei(name, ".amtlos.neu");
  if (neu.exists) neu.delete();
  neu.create();
  neu.write(tresorSchliessen(base64(bytes), schluessel, nonce(), kontext(name)));
  // überschreibt die bisherige Datei erst, wenn die neue vollständig geschrieben ist
  neu.moveSync(f, { overwrite: true });
}

export async function dateiHolen(name: string, schluessel: Uint8Array | null): Promise<Uint8Array | null> {
  if (!istBelegDateiname(name)) return null;
  const f = datei(name);
  if (!f.exists || !schluessel) return null;
  return ausBase64(tresorOeffnen(await f.text(), schluessel, kontext(name)));
}

export function dateiEntfernen(name: string): void {
  if (!istBelegDateiname(name)) return;
  try {
    const f = datei(name);
    if (f.exists) f.delete();
  } catch {
    /* schon weg */
  }
}

/** Alle Belegdateien löschen (bei „Alle Daten löschen“) – auch solche, auf die kein Beleg mehr zeigt. */
export function alleDateienEntfernen(): void {
  try {
    const d = new Directory(Paths.document, "belege");
    if (d.exists) d.delete();
  } catch {
    /* schon weg */
  }
}
