/**
 * Verschlüsselte Datensicherung (E-125): Der ganze Stand (Betrieb, Unterlagen, Mitarbeiter mit SV-Nummer, Steuer-ID
 * und IBAN, Kunden) wird mit einem Passwort verschlüsselt – AES-256-GCM, Schlüssel per PBKDF2-SHA256 aus dem Passwort.
 * In der Datei steht nichts im Klartext außer Format und Verfahren. Ohne Passwort lässt sie sich nicht öffnen.
 * Reine Funktionen (Zufall wird hineingereicht), damit sie ohne Gerät testbar sind.
 */
import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { standAus, type Stand } from "./speicher";

export const SICHERUNG_FORMAT = "amtlos-sicherung";
/**
 * Iterationen für PBKDF2. Rein in JavaScript (Expo Go hat kein natives PBKDF2) ist mehr auf dem iPhone spürbar langsam;
 * die Zahl steht in jeder Datei, ältere Sicherungen bleiben lesbar, wenn sie später steigt.
 */
export const SICHERUNG_ITERATIONEN = 150_000;
export const PASSWORT_MINDESTLAENGE = 10;
/** bindet Format und Version an den Inhalt – geänderte Kopfdaten fallen beim Entschlüsseln auf */
const ZUSATZ = `${SICHERUNG_FORMAT}:1`;

export class SicherungsFehler extends Error {
  constructor(public art: "format" | "passwort") {
    super(art === "format" ? "Keine Amtlos-Sicherung" : "Passwort falsch oder Datei beschädigt");
  }
}

interface Datei {
  format: typeof SICHERUNG_FORMAT;
  version: 1;
  erstellt: string;
  kdf: { name: "PBKDF2-SHA256"; iterationen: number; salz: string };
  chiffre: { name: "AES-256-GCM"; nonce: string };
  daten: string;
}

// ---- Kodierung ohne Abhängigkeit von TextEncoder/Buffer (nicht überall in React Native vorhanden)

function utf8(s: string): Uint8Array {
  const b = unescape(encodeURIComponent(s));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
function ausUtf8(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return decodeURIComponent(escape(s));
}
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + (i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63]! : "=") + (i + 2 < bytes.length ? ALPHABET[n & 63]! : "=");
  }
  return s;
}
export function ausBase64(s: string): Uint8Array {
  const rein = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((rein.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < rein.length; i += 4) {
    const n = (ALPHABET.indexOf(rein[i]!) << 18) | (ALPHABET.indexOf(rein[i + 1] ?? "A") << 12) | ((ALPHABET.indexOf(rein[i + 2] ?? "A") & 63) << 6) | (ALPHABET.indexOf(rein[i + 3] ?? "A") & 63);
    if (j < out.length) out[j++] = (n >> 16) & 255;
    if (j < out.length) out[j++] = (n >> 8) & 255;
    if (j < out.length) out[j++] = n & 255;
  }
  return out;
}

const schluessel = (passwort: string, salz: Uint8Array, iterationen: number) => pbkdf2(sha256, utf8(passwort), salz, { c: iterationen, dkLen: 32 });

/** Sicherung als Text (JSON) erstellen. `zufall` liefert kryptografisch sichere Zufallsbytes. */
export function sicherungErstellen(stand: Stand, passwort: string, zufall: (n: number) => Uint8Array, jetzt = new Date(), iterationen = SICHERUNG_ITERATIONEN): string {
  if (passwort.length < PASSWORT_MINDESTLAENGE) throw new Error("Passwort zu kurz");
  const salz = zufall(16);
  const nonce = zufall(12);
  const geheim = gcm(schluessel(passwort, salz, iterationen), nonce, utf8(ZUSATZ)).encrypt(utf8(JSON.stringify(stand)));
  const d: Datei = { format: SICHERUNG_FORMAT, version: 1, erstellt: jetzt.toISOString(), kdf: { name: "PBKDF2-SHA256", iterationen, salz: base64(salz) }, chiffre: { name: "AES-256-GCM", nonce: base64(nonce) }, daten: base64(geheim) };
  return JSON.stringify(d, null, 1);
}

/** Sicherung lesen. Wirft SicherungsFehler „format“ (keine Sicherung) oder „passwort“ (falsch oder verändert). */
export function sicherungLesen(text: string, passwort: string): Stand {
  let d: Partial<Datei>;
  try {
    d = JSON.parse(text) as Partial<Datei>;
  } catch {
    throw new SicherungsFehler("format");
  }
  if (d.format !== SICHERUNG_FORMAT || d.version !== 1 || d.kdf?.name !== "PBKDF2-SHA256" || d.chiffre?.name !== "AES-256-GCM" || typeof d.daten !== "string" || !(d.kdf.iterationen > 0)) throw new SicherungsFehler("format");
  let klar: Uint8Array;
  try {
    klar = gcm(schluessel(passwort, ausBase64(d.kdf.salz), d.kdf.iterationen), ausBase64(d.chiffre.nonce), utf8(ZUSATZ)).decrypt(ausBase64(d.daten));
  } catch {
    throw new SicherungsFehler("passwort");
  }
  return standAus(ausUtf8(klar));
}

/** Dateiname mit Datum, ohne Angaben zum Betrieb. */
export const sicherungsName = (heute: string) => `Amtlos-Sicherung-${heute}.amtlos`;
