/**
 * Verschlüsselte Ablage auf dem Gerät (E-129): Der gespeicherte Stand (Betrieb, Unterlagen, Mitarbeiter mit
 * SV-Nummer, Steuer-ID und IBAN, Kunden) liegt nur noch verschlüsselt in AsyncStorage – AES-256-GCM mit einem
 * zufälligen Schlüssel, der im Schlüsselbund des iPhones liegt (expo-secure-store, nur dieses Gerät, nur entsperrt).
 * Reine Funktionen (Schlüssel und Nonce werden hineingereicht), damit sie ohne Gerät testbar sind.
 */
import { gcm } from "@noble/ciphers/aes";
import { ausBase64, ausUtf8, base64, utf8 } from "./sicherung";

export const TRESOR_FORMAT = "amtlos-tresor";
const ZUSATZ = `${TRESOR_FORMAT}:1`;

interface Tresor {
  format: typeof TRESOR_FORMAT;
  version: 1;
  nonce: string;
  daten: string;
}

/** Ist der gespeicherte Text ein verschlüsselter Stand? */
export function istTresor(text: string | null): boolean {
  if (!text) return false;
  try {
    const d = JSON.parse(text) as Partial<Tresor>;
    return d?.format === TRESOR_FORMAT;
  } catch {
    return false;
  }
}

export function tresorSchliessen(klartext: string, schluessel: Uint8Array, nonce: Uint8Array): string {
  if (schluessel.length !== 32 || nonce.length !== 12) throw new Error("Schlüssel oder Nonce ungültig");
  const geheim = gcm(schluessel, nonce, utf8(ZUSATZ)).encrypt(utf8(klartext));
  const t: Tresor = { format: TRESOR_FORMAT, version: 1, nonce: base64(nonce), daten: base64(geheim) };
  return JSON.stringify(t);
}

/** Entschlüsseln; wirft bei falschem Schlüssel oder veränderten Daten. */
export function tresorOeffnen(text: string, schluessel: Uint8Array): string {
  const d = JSON.parse(text) as Partial<Tresor>;
  if (d.format !== TRESOR_FORMAT || d.version !== 1 || typeof d.nonce !== "string" || typeof d.daten !== "string") throw new Error("Kein Amtlos-Tresor");
  return ausUtf8(gcm(schluessel, ausBase64(d.nonce), utf8(ZUSATZ)).decrypt(ausBase64(d.daten)));
}
