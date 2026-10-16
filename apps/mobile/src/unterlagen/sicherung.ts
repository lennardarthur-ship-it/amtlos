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
 * Iterationen für PBKDF2-SHA256. Gerechnet wird rein in JavaScript (kein natives PBKDF2 in Expo) – auf dem iPhone ohne
 * JIT wären die von OWASP empfohlenen 600.000 viele Sekunden. Deshalb vorerst 150.000; mit einer nativen Ableitung
 * steigt die Zahl (PRUEFLISTE T-85). Die Zahl steht in jeder Datei – ältere Sicherungen bleiben lesbar. Beim Öffnen gilt
 * eine Obergrenze, damit eine präparierte Datei die App nicht minutenlang blockiert (E-143).
 */
export const SICHERUNG_ITERATIONEN = 150_000;
export const ITERATIONEN_HOECHSTENS = 5_000_000;
export const PASSWORT_MINDESTLAENGE = 10;
/** bindet Format und Version an den Inhalt – geänderte Kopfdaten fallen beim Entschlüsseln auf */
const ZUSATZ = `${SICHERUNG_FORMAT}:1`;

export class SicherungsFehler extends Error {
  constructor(public art: "format" | "passwort") {
    super(art === "format" ? "Keine Amtlos-Sicherung" : "Passwort falsch oder Datei beschädigt");
  }
}

/** Dateien zu Belegen (Name → Base64), seit Version 2 in der Sicherung (E-133) */
export type Dateien = Record<string, string>;

/** Klartext in der Sicherung: Version 1 = nur der Stand, Version 2 = Stand und Belegdateien */
function inhalt(stand: Stand, dateien?: Dateien): { version: 1 | 2; text: string } {
  return dateien && Object.keys(dateien).length ? { version: 2, text: JSON.stringify({ stand, dateien }) } : { version: 1, text: JSON.stringify(stand) };
}

interface Datei {
  format: typeof SICHERUNG_FORMAT;
  version: 1 | 2;
  erstellt: string;
  kdf: { name: "PBKDF2-SHA256"; iterationen: number; salz: string };
  chiffre: { name: "AES-256-GCM"; nonce: string };
  daten: string;
}

// ---- Kodierung ohne Abhängigkeit von TextEncoder/Buffer (nicht überall in React Native vorhanden)

export function utf8(s: string): Uint8Array {
  const b = unescape(encodeURIComponent(s));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
export function ausUtf8(bytes: Uint8Array): string {
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

/** Abgeleiteter Schlüssel für automatische Sicherungen (E-129): einmal aus dem Passwort, dann im Schlüsselbund. */
export interface SicherungsSchluessel {
  schluessel: Uint8Array;
  salz: Uint8Array;
  iterationen: number;
}

export function schluesselAusPasswort(passwort: string, zufall: (n: number) => Uint8Array, iterationen = SICHERUNG_ITERATIONEN): SicherungsSchluessel {
  if (passwort.length < PASSWORT_MINDESTLAENGE) throw new Error("Passwort zu kurz");
  const salz = zufall(16);
  return { schluessel: schluessel(passwort, salz, iterationen), salz, iterationen };
}

/**
 * Sicherung mit einem schon abgeleiteten Schlüssel – dasselbe Dateiformat wie `sicherungErstellen`, also mit dem
 * Passwort wiederherstellbar; ohne die langsame Schlüsselableitung bei jeder automatischen Sicherung.
 */
export function sicherungMitSchluessel(stand: Stand, k: SicherungsSchluessel, zufall: (n: number) => Uint8Array, jetzt = new Date(), dateien?: Dateien): string {
  const nonce = zufall(12);
  const i = inhalt(stand, dateien);
  const geheim = gcm(k.schluessel, nonce, utf8(ZUSATZ)).encrypt(utf8(i.text));
  const d: Datei = { format: SICHERUNG_FORMAT, version: i.version, erstellt: jetzt.toISOString(), kdf: { name: "PBKDF2-SHA256", iterationen: k.iterationen, salz: base64(k.salz) }, chiffre: { name: "AES-256-GCM", nonce: base64(nonce) }, daten: base64(geheim) };
  return JSON.stringify(d, null, 1);
}

/** Sicherung als Text (JSON) erstellen. `zufall` liefert kryptografisch sichere Zufallsbytes. */
export function sicherungErstellen(stand: Stand, passwort: string, zufall: (n: number) => Uint8Array, jetzt = new Date(), iterationen = SICHERUNG_ITERATIONEN, dateien?: Dateien): string {
  if (passwort.length < PASSWORT_MINDESTLAENGE) throw new Error("Passwort zu kurz");
  const salz = zufall(16);
  const nonce = zufall(12);
  const i = inhalt(stand, dateien);
  const geheim = gcm(schluessel(passwort, salz, iterationen), nonce, utf8(ZUSATZ)).encrypt(utf8(i.text));
  const d: Datei = { format: SICHERUNG_FORMAT, version: i.version, erstellt: jetzt.toISOString(), kdf: { name: "PBKDF2-SHA256", iterationen, salz: base64(salz) }, chiffre: { name: "AES-256-GCM", nonce: base64(nonce) }, daten: base64(geheim) };
  return JSON.stringify(d, null, 1);
}

/** Sicherung lesen. Wirft SicherungsFehler „format“ (keine Sicherung) oder „passwort“ (falsch oder verändert). */
export function sicherungLesen(text: string, passwort: string): Stand {
  return sicherungLesenMitDateien(text, passwort).stand;
}

/** Sicherung lesen – mit den Belegdateien (leer bei Version 1) und dem abgeleiteten Schlüssel (für Belege in iCloud). */
export function sicherungLesenMitDateien(text: string, passwort: string): { stand: Stand; dateien: Dateien; schluessel: Uint8Array } {
  let d: Partial<Datei>;
  try {
    d = JSON.parse(text) as Partial<Datei>;
  } catch {
    throw new SicherungsFehler("format");
  }
  if (d.format !== SICHERUNG_FORMAT || (d.version !== 1 && d.version !== 2) || d.kdf?.name !== "PBKDF2-SHA256" || d.chiffre?.name !== "AES-256-GCM" || typeof d.daten !== "string" || !(d.kdf.iterationen > 0) || d.kdf.iterationen > ITERATIONEN_HOECHSTENS) throw new SicherungsFehler("format");
  let klar: Uint8Array;
  const k = schluessel(passwort, ausBase64(d.kdf.salz), d.kdf.iterationen);
  try {
    klar = gcm(k, ausBase64(d.chiffre.nonce), utf8(ZUSATZ)).decrypt(ausBase64(d.daten));
  } catch {
    throw new SicherungsFehler("passwort");
  }
  const klartext = ausUtf8(klar);
  if (d.version === 1) return { stand: standAus(klartext), dateien: {}, schluessel: k };
  const roh = JSON.parse(klartext) as { stand?: unknown; dateien?: unknown };
  const dateien: Dateien = {};
  if (roh.dateien && typeof roh.dateien === "object") for (const [k, v] of Object.entries(roh.dateien as Record<string, unknown>)) if (typeof v === "string" && /^[\w.-]+$/.test(k)) dateien[k] = v;
  return { stand: standAus(JSON.stringify(roh.stand ?? null)), dateien, schluessel: k };
}

/** Kennung eines Sicherungsschlüssels (aus dem Salz) – Ordnername der Belegdateien in iCloud. */
export const schluesselKennung = (salz: Uint8Array) => Array.from(salz.subarray(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");

/** Salz und Runden aus einer Sicherungsdatei (ohne Passwort) – null, wenn es keine ist. */
export function sicherungsKdf(text: string): { salz: Uint8Array; iterationen: number } | null {
  try {
    const d = JSON.parse(text) as Partial<Datei>;
    return d.format === SICHERUNG_FORMAT && d.kdf?.salz && d.kdf.iterationen > 0 ? { salz: ausBase64(d.kdf.salz), iterationen: d.kdf.iterationen } : null;
  } catch {
    return null;
  }
}

const DATEI_ZUSATZ = `${SICHERUNG_FORMAT}-datei:1`;

/** Eine Belegdatei für die iCloud-Sicherung verschlüsseln (Schlüssel der Sicherung, eigener Zusatz). */
export function sicherungsDatei(bytes: Uint8Array, k: Uint8Array, zufall: (n: number) => Uint8Array): string {
  const nonce = zufall(12);
  return JSON.stringify({ format: `${SICHERUNG_FORMAT}-datei`, version: 1, nonce: base64(nonce), daten: base64(gcm(k, nonce, utf8(DATEI_ZUSATZ)).encrypt(bytes)) });
}

/** Belegdatei aus der iCloud-Sicherung öffnen; null, wenn sie nicht passt. */
export function sicherungsDateiLesen(text: string, k: Uint8Array): Uint8Array | null {
  try {
    const d = JSON.parse(text) as { format?: string; nonce?: string; daten?: string };
    if (d.format !== `${SICHERUNG_FORMAT}-datei` || !d.nonce || !d.daten) return null;
    return gcm(k, ausBase64(d.nonce), utf8(DATEI_ZUSATZ)).decrypt(ausBase64(d.daten));
  } catch {
    return null;
  }
}

/** Dateiname mit Datum, ohne Angaben zum Betrieb. */
export const sicherungsName = (heute: string) => `Amtlos-Sicherung-${heute}.amtlos`;
