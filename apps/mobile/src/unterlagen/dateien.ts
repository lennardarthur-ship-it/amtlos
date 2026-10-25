/**
 * Dateien zu Belegen (E-133): Fotos, PDFs und E-Rechnungen im App-Ordner – verschlüsselt mit demselben Schlüssel wie
 * der Stand (AES-256-GCM, Schlüssel im Schlüsselbund). Die Originaldatei einer E-Rechnung bleibt so byte-genau erhalten
 * (GoBD). Im Stand steht nur der Dateiname.
 */
import { istBelegDateiname } from "@amtlos/fachlogik";
import { Directory, File, Paths } from "expo-file-system";
import { nonce } from "./schluesselbund";
import { ausBase64, ausUtf8 } from "./sicherung";
import { istBinaerTresor, tresorBytesOeffnen, tresorBytesSchliessen, tresorOeffnen } from "./tresor";

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
 * bricht das Schreiben ab, bleibt die bisherige Datei unversehrt. Neue Dateien im Binärformat (R9 Performance: ohne
 * doppeltes Base64, gut halb so groß); ältere Dateien im Textformat bleiben lesbar.
 */
export async function dateiAblegen(name: string, bytes: Uint8Array, schluessel: Uint8Array | null): Promise<void> {
  if (!schluessel) throw new Error("Ohne Schlüssel wird nichts abgelegt");
  const f = datei(name);
  const neu = datei(name, ".amtlos.neu");
  if (neu.exists) neu.delete();
  neu.create();
  // SDK 58: `write` ist asynchron – ohne `await` würde die Datei verschoben, bevor sie geschrieben ist (E-194)
  await neu.write(tresorBytesSchliessen(bytes, schluessel, nonce(), kontext(name)));
  // überschreibt die bisherige Datei erst, wenn die neue vollständig geschrieben ist
  neu.moveSync(f, { overwrite: true });
}

export async function dateiHolen(name: string, schluessel: Uint8Array | null): Promise<Uint8Array | null> {
  if (!istBelegDateiname(name)) return null;
  const f = datei(name);
  if (!f.exists || !schluessel) return null;
  const roh = await f.bytes();
  if (istBinaerTresor(roh)) return tresorBytesOeffnen(roh, schluessel, kontext(name));
  // älteres Textformat (Tresor-JSON mit Base64 der Datei)
  return ausBase64(tresorOeffnen(ausUtf8(roh), schluessel, kontext(name)));
}

/** Liegt die Datei auf dem Gerät? – ohne sie zu lesen oder zu entschlüsseln (Synchronisation, R9 Performance). */
export function dateiVorhanden(name: string): boolean {
  if (!istBelegDateiname(name)) return false;
  try {
    return datei(name).exists;
  } catch {
    return false;
  }
}

/** Größe der verschlüsselten Datei in Bytes (0, wenn sie fehlt) – zum Abschätzen von Sicherung und Paket. */
export function dateiGroesse(name: string): number {
  if (!istBelegDateiname(name)) return 0;
  try {
    const f = datei(name);
    return f.exists ? (f.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * Datei zum Anzeigen als vorübergehende Datei im Cache (statt einer data-URI mit noch einmal Base64). `entfernen`
 * löscht sie wieder – entschlüsselte Fotos bleiben nicht liegen; Reste (App beendet) räumt `ansichtenAufraeumen` beim
 * nächsten Start weg.
 */
export async function dateiAnzeigen(name: string, schluessel: Uint8Array | null, _mime?: string): Promise<{ uri: string; entfernen(): void } | null> {
  const bytes = await dateiHolen(name, schluessel);
  if (!bytes) return null;
  const endung = name.split(".").pop() ?? "bin";
  const tmp = new File(Paths.cache, `ansicht-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${endung}`);
  tmp.create({ overwrite: true });
  await tmp.write(bytes);
  return {
    uri: tmp.uri,
    entfernen: () => {
      try {
        if (tmp.exists) tmp.delete();
      } catch {
        /* schon weg */
      }
    },
  };
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

/** Übrig gebliebene Ansichtsdateien im Cache löschen (beim Start). */
export function ansichtenAufraeumen(): void {
  try {
    for (const e of Paths.cache.list()) {
      if (e instanceof File && e.name.startsWith("ansicht-")) {
        try {
          e.delete();
        } catch {
          /* in Benutzung */
        }
      }
    }
  } catch {
    /* kein Cache */
  }
}
