/** Web (nur Vorschau und Rundgang): kein Schlüsselbund – die Daten liegen dort unverschlüsselt im Browser. */
import * as Crypto from "expo-crypto";

export const schluesselbundMoeglich = false;
export async function schluesselHolen(_anlegen: boolean): Promise<Uint8Array | null> {
  return null;
}
export const nonce = () => Crypto.getRandomBytes(12);
export async function schluesselLoeschen(): Promise<void> {}
export async function schluesselArchivieren(_jetzt?: Date): Promise<void> {}
export async function archivierteSchluessel(): Promise<Uint8Array[]> {
  return [];
}
export async function archivLoeschen(): Promise<void> {}
export async function autoSchluesselSpeichern(_k: unknown): Promise<void> {}
export async function autoSchluesselHolen(): Promise<null> {
  return null;
}
export async function autoSchluesselLoeschen(): Promise<void> {}
