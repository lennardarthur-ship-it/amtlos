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
/**
 * Version 2 (M-1): Der Zusatztext (AAD) bindet den Chiffretext an seinen Zweck, z. B. „datei:<Name>“ oder
 * „sync-stand:<Konto>“. Ein Server kann so keine Belegdatei gegen eine andere oder den Stand eines anderen Kontos
 * tauschen. Version 1 (fester Zusatz) bleibt lesbar.
 */
const zusatz2 = (kontext: string) => `${TRESOR_FORMAT}:2:${kontext}`;

interface Tresor {
  format: typeof TRESOR_FORMAT;
  version: 1 | 2;
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

/** Verschlüsseln. Mit `kontext` im Format 2 (gebunden an den Zweck), sonst im Format 1. */
export function tresorSchliessen(klartext: string, schluessel: Uint8Array, nonce: Uint8Array, kontext?: string): string {
  if (schluessel.length !== 32 || nonce.length !== 12) throw new Error("Schlüssel oder Nonce ungültig");
  const geheim = gcm(schluessel, nonce, utf8(kontext === undefined ? ZUSATZ : zusatz2(kontext))).encrypt(utf8(klartext));
  const t: Tresor = { format: TRESOR_FORMAT, version: kontext === undefined ? 1 : 2, nonce: base64(nonce), daten: base64(geheim) };
  return JSON.stringify(t);
}

/** Version eines Tresors (1 oder 2), null wenn es keiner ist. */
export function tresorVersion(text: string): 1 | 2 | null {
  try {
    const d = JSON.parse(text) as Partial<Tresor>;
    return d.format === TRESOR_FORMAT && (d.version === 1 || d.version === 2) ? d.version : null;
  } catch {
    return null;
  }
}

/**
 * Entschlüsseln; wirft bei falschem Schlüssel, veränderten Daten oder falschem Kontext. Format 2 öffnet sich nur mit
 * dem Kontext, mit dem es verschlüsselt wurde; Format 1 (ältere Daten) immer mit dem festen Zusatz.
 */
export function tresorOeffnen(text: string, schluessel: Uint8Array, kontext?: string): string {
  const d = JSON.parse(text) as Partial<Tresor>;
  if (d.format !== TRESOR_FORMAT || (d.version !== 1 && d.version !== 2) || typeof d.nonce !== "string" || typeof d.daten !== "string") throw new Error("Kein Amtlos-Tresor");
  if (d.version === 2 && kontext === undefined) throw new Error("Kontext fehlt");
  return ausUtf8(gcm(schluessel, ausBase64(d.nonce), utf8(d.version === 1 ? ZUSATZ : zusatz2(kontext!))).decrypt(ausBase64(d.daten)));
}
