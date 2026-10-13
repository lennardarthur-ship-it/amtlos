/**
 * Dateien zu Belegen (E-133): Fotos, PDFs und E-Rechnungen im App-Ordner – verschlüsselt mit demselben Schlüssel wie
 * der Stand (AES-256-GCM, Schlüssel im Schlüsselbund). Die Originaldatei einer E-Rechnung bleibt so byte-genau erhalten
 * (GoBD). Im Stand steht nur der Dateiname.
 */
import { Directory, File, Paths } from "expo-file-system";
import { nonce } from "./schluesselbund";
import { ausBase64, base64 } from "./sicherung";
import { tresorOeffnen, tresorSchliessen } from "./tresor";

const ordner = () => {
  const d = new Directory(Paths.document, "belege");
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};
const datei = (name: string) => new File(ordner(), `${name}.amtlos`);

export async function dateiAblegen(name: string, bytes: Uint8Array, schluessel: Uint8Array | null): Promise<void> {
  if (!schluessel) throw new Error("Ohne Schlüssel wird nichts abgelegt");
  const f = datei(name);
  if (f.exists) f.delete();
  f.create();
  f.write(tresorSchliessen(base64(bytes), schluessel, nonce()));
}

export async function dateiHolen(name: string, schluessel: Uint8Array | null): Promise<Uint8Array | null> {
  const f = datei(name);
  if (!f.exists || !schluessel) return null;
  return ausBase64(tresorOeffnen(await f.text(), schluessel));
}

export function dateiEntfernen(name: string): void {
  try {
    const f = datei(name);
    if (f.exists) f.delete();
  } catch {
    /* schon weg */
  }
}
