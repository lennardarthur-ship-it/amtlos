/**
 * Schlüssel für die verschlüsselte Ablage (E-129) im Schlüsselbund: nur auf diesem Gerät, nur wenn es entsperrt ist,
 * nicht in iCloud-Schlüsselbund oder Geräte-Backups. Zieht man auf ein neues iPhone um, geht das über die Datensicherung.
 */
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { ausBase64, base64, type SicherungsSchluessel } from "./sicherung";

const NAME = "amtlos.schluessel.v1";
const OPTIONEN: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Verschlüsselung auf diesem Gerät möglich? */
export const schluesselbundMoeglich = true;

/** Gespeicherten Schlüssel holen; mit `anlegen` wird einer erzeugt, wenn noch keiner da ist. */
export async function schluesselHolen(anlegen: boolean): Promise<Uint8Array | null> {
  const da = await SecureStore.getItemAsync(NAME, OPTIONEN);
  if (da) {
    const k = ausBase64(da);
    if (k.length === 32) return k;
    throw new Error("Schlüssel beschädigt");
  }
  if (!anlegen) return null;
  const neu = Crypto.getRandomBytes(32);
  await SecureStore.setItemAsync(NAME, base64(neu), OPTIONEN);
  // erst verwenden, wenn er sich wieder lesen lässt – sonst wären die Daten nach dem Speichern verloren
  const pruef = await SecureStore.getItemAsync(NAME, OPTIONEN);
  return pruef === base64(neu) ? neu : null;
}

export const nonce = () => Crypto.getRandomBytes(12);

/** Nach „Alle Daten löschen“ auch den Schlüssel entfernen. */
export async function schluesselLoeschen(): Promise<void> {
  await SecureStore.deleteItemAsync(NAME, OPTIONEN);
}

const AUTO = "amtlos.autosicherung.v1";

/** Schlüssel für automatische Sicherungen speichern (abgeleitet aus dem Sicherungspasswort, E-129). */
export async function autoSchluesselSpeichern(k: SicherungsSchluessel): Promise<void> {
  await SecureStore.setItemAsync(AUTO, JSON.stringify({ k: base64(k.schluessel), s: base64(k.salz), i: k.iterationen }), OPTIONEN);
}

export async function autoSchluesselHolen(): Promise<SicherungsSchluessel | null> {
  const roh = await SecureStore.getItemAsync(AUTO, OPTIONEN);
  if (!roh) return null;
  const d = JSON.parse(roh) as { k: string; s: string; i: number };
  return { schluessel: ausBase64(d.k), salz: ausBase64(d.s), iterationen: d.i };
}

export async function autoSchluesselLoeschen(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTO, OPTIONEN);
}
