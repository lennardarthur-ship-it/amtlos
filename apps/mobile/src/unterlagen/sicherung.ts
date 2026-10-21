/**
 * Verschlüsselte Datensicherung (E-125): Der ganze Stand (Betrieb, Unterlagen, Mitarbeiter mit SV-Nummer, Steuer-ID
 * und IBAN, Kunden) wird mit einem Passwort verschlüsselt – AES-256-GCM, Schlüssel per PBKDF2-SHA256 aus dem Passwort.
 * In der Datei steht nichts im Klartext außer Format und Verfahren. Ohne Passwort lässt sie sich nicht öffnen.
 * Reine Funktionen (Zufall wird hineingereicht), damit sie ohne Gerät testbar sind.
 */
import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { istBelegDateiname } from "@amtlos/fachlogik";
import { StandFehler, standAus, type Stand } from "./speicher";

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
/** Für neue Passwörter (H-1, Teil 3): mindestens so viele Zeichen – oder ein Satz aus mindestens drei Wörtern. */
export const PASSWORT_EMPFOHLEN = 12;

const HAEUFIG = ["passwort", "password", "kennwort", "geheim", "amtlos", "qwertz", "qwerty", "asdf", "yxcv", "hallo", "willkommen", "welcome", "sommer", "winter", "fruehling", "frühling", "herbst", "januar", "dezember", "iloveyou", "ichliebedich", "schatz", "admin", "letmein", "monkey", "dragon", "football", "fussball", "fußball", "bayern", "dortmund", "schalke", "berlin", "hamburg", "muenchen", "münchen", "deutschland", "test", "login", "master", "hello", "secret", "sonne", "blume", "hase", "mausi", "baby", "abc", "xyz"];
const FOLGEN = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertzuiopü", "asdfghjklöä", "yxcvbnm", "qwertyuiop", "zxcvbnm"];

/**
 * Stärke eines neuen Passworts – eine einfache Abschätzung ohne Wörterbuch-Bibliothek: Gesperrt sind kurze
 * Passwörter, solche aus wenigen verschiedenen Zeichen und solche, die nach Abzug häufiger Wörter, Tastatur- und
 * Zahlenfolgen, Jahreszahlen und Wiederholungen kaum noch etwas Eigenes enthalten („Sommer2025!“, „Passwort1234“).
 * Liefert null, wenn das Passwort genügt, sonst den Grund.
 */
export function passwortSchwaeche(pw: string): "kurz" | "einfach" | null {
  const woerter = pw.split(/[\s\-_.,;:+/]+/).filter((w) => /\p{L}{3,}/u.test(w));
  const satz = woerter.length >= 3 && new Set(woerter.map((w) => w.toLowerCase())).size >= 3;
  if (pw.length < PASSWORT_MINDESTLAENGE || (!satz && pw.length < PASSWORT_EMPFOHLEN)) return "kurz";
  if (new Set(pw.toLowerCase()).size < 6) return "einfach";
  let kern = pw.toLowerCase();
  for (const w of HAEUFIG) kern = kern.split(w).join(" ");
  for (const f of FOLGEN) for (let n = f.length; n >= 4; n--) for (let i = 0; i + n <= f.length; i++) kern = kern.split(f.slice(i, i + n)).join(" ");
  kern = kern
    .replace(/(19|20)\d{2}/g, " ")
    .replace(/(.)\1{2,}/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  // was übrig bleibt, muss für sich genug Vielfalt haben
  return new Set(kern).size < 6 || kern.length < 7 ? "einfach" : null;
}
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

// ---- Kodierung: native Funktionen, wo die Laufzeit sie hat – sonst in JavaScript (R9 Performance)
//
// Hermes (React Native 0.86) bringt TextEncoder, atob und btoa mit, Expo ergänzt TextDecoder; im Web und in Node gibt
// es alles. Jede native Funktion wird beim Laden einmal mit festen Werten geprüft – weicht sie ab (z. B. ein TextDecoder
// ohne `fatal` oder mit verschlucktem BOM), bleibt es bei der JavaScript-Fassung. Die Ausgabe ist byte-gleich.

type Global = {
  TextEncoder?: new () => { encode(s: string): Uint8Array };
  TextDecoder?: new (label?: string, o?: { fatal?: boolean; ignoreBOM?: boolean }) => { decode(b: Uint8Array): string };
  atob?: (s: string) => string;
  btoa?: (s: string) => string;
};
type U8Base64 = { fromBase64?: (s: string) => Uint8Array };
const G = globalThis as unknown as Global;
const PROBE = "Aä€😀\u{feff}z";
const PROBE_BYTES = [0x41, 0xc3, 0xa4, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80, 0xef, 0xbb, 0xbf, 0x7a];
const gleicheBytes = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.prototype.every.call(a, (x: number, i: number) => x === b[i]);

/** utf8 in JavaScript (Rückfall) – wirft bei einzelnen Surrogaten (URIError). */
export function utf8Js(s: string): Uint8Array {
  const b = unescape(encodeURIComponent(s));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
/** ausUtf8 in JavaScript (Rückfall) – wirft bei ungültigem UTF-8, lässt ein BOM stehen. */
export function ausUtf8Js(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return decodeURIComponent(escape(s));
}
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** base64 in JavaScript (Rückfall). */
export function base64Js(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + (i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63]! : "=") + (i + 2 < bytes.length ? ALPHABET[n & 63]! : "=");
  }
  return s;
}
/** ausBase64 in JavaScript (Rückfall): großzügig – Zeichen außerhalb des Alphabets (auch „=“) werden übergangen. */
export function ausBase64Js(s: string): Uint8Array {
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

const pruefen = <T>(f: () => T | null): T | null => {
  try {
    return f();
  } catch {
    return null;
  }
};
const encoder = pruefen(() => {
  const e = G.TextEncoder ? new G.TextEncoder() : null;
  return e && gleicheBytes(e.encode(PROBE), PROBE_BYTES) ? e : null;
});
const decoder = pruefen(() => {
  const d = G.TextDecoder ? new G.TextDecoder("utf-8", { fatal: true, ignoreBOM: true }) : null;
  if (!d || d.decode(new Uint8Array([0xef, 0xbb, 0xbf, ...PROBE_BYTES])) !== `\u{feff}${PROBE}`) return null;
  // ungültiges UTF-8 muss werfen wie die JavaScript-Fassung – sonst würde Kaputtes still zu „�“
  try {
    d.decode(new Uint8Array([0x41, 0xc3]));
    return null;
  } catch {
    return d;
  }
});
/** Bytes ↔ „Binärtext“ (ein Zeichen je Byte) für atob/btoa – in Stücken, damit der Aufrufstapel reicht. */
function binaerText(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return s;
}
const nativBtoa = pruefen(() => (G.btoa && G.btoa(binaerText(new Uint8Array(PROBE_BYTES))) === base64Js(new Uint8Array(PROBE_BYTES)) ? G.btoa : null));
const nativFromBase64 = pruefen(() => {
  const f = (Uint8Array as unknown as U8Base64).fromBase64;
  return f && gleicheBytes(f("QcOk4oKs8J+YgO+7v3o"), PROBE_BYTES) ? f : null;
});
const nativAtob = pruefen(() => {
  if (!G.atob) return null;
  const t = G.atob("QcOk4oKs8J+YgO+7v3o");
  return t.length === PROBE_BYTES.length && PROBE_BYTES.every((b, i) => t.charCodeAt(i) === b) ? G.atob : null;
});
const UNGUELTIG = /[^A-Za-z0-9+/]/;
const UNGUELTIG_ALLE = /[^A-Za-z0-9+/]/g;

/** Text → UTF-8. Nativ ersetzt ein einzelnes Surrogat durch U+FFFD, statt zu werfen – gültiger Text ist byte-gleich. */
export function utf8(s: string): Uint8Array {
  return encoder ? encoder.encode(s) : utf8Js(s);
}
export function ausUtf8(bytes: Uint8Array): string {
  return decoder ? decoder.decode(bytes) : ausUtf8Js(bytes);
}
export function base64(bytes: Uint8Array): string {
  return nativBtoa ? nativBtoa(binaerText(bytes)) : base64Js(bytes);
}
export function ausBase64(s: string): Uint8Array {
  if (!nativFromBase64 && !nativAtob) return ausBase64Js(s);
  // wie die JavaScript-Fassung: „=“ am Ende und fremde Zeichen übergehen, ohne Polsterung dekodieren
  let ende = s.length;
  while (ende > 0 && s.charCodeAt(ende - 1) === 61) ende--;
  let rein = ende === s.length ? s : s.slice(0, ende);
  if (UNGUELTIG.test(rein)) rein = rein.replace(UNGUELTIG_ALLE, "");
  // Länge mit Rest 1 ist kein gültiges Base64 – das behandelt die JavaScript-Fassung (wie bisher großzügig)
  if (rein.length % 4 === 1) return ausBase64Js(rein);
  try {
    if (nativFromBase64) return nativFromBase64(rein);
    const t = nativAtob!(rein);
    const out = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
    return out;
  } catch {
    return ausBase64Js(rein);
  }
}

/** Welche native Kodierung greift (für Tests und Messungen). */
export const kodierungNativ = { utf8: Boolean(encoder), ausUtf8: Boolean(decoder), base64: Boolean(nativBtoa), ausBase64: nativFromBase64 ? "fromBase64" : nativAtob ? "atob" : null };

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
  // unlesbarer Inhalt oder Stand aus einer neueren App-Version: keine Sicherung, die sich einspielen ließe
  const lesen = (json: string) => {
    try {
      return standAus(json);
    } catch (e) {
      if (e instanceof StandFehler) throw new SicherungsFehler("format");
      throw e;
    }
  };
  if (d.version === 1) return { stand: lesen(klartext), dateien: {}, schluessel: k };
  let roh: { stand?: unknown; dateien?: unknown };
  try {
    roh = JSON.parse(klartext) as { stand?: unknown; dateien?: unknown };
  } catch {
    throw new SicherungsFehler("format");
  }
  const dateien: Dateien = {};
  // nur Dateinamen, wie die App sie vergibt (G-1)
  if (roh.dateien && typeof roh.dateien === "object") for (const [k, v] of Object.entries(roh.dateien as Record<string, unknown>)) if (typeof v === "string" && istBelegDateiname(k)) dateien[k] = v;
  return { stand: lesen(JSON.stringify(roh.stand ?? null)), dateien, schluessel: k };
}

/**
 * Belegdateien, auf die der Stand verweist, die aber nicht in `dateien` stecken (H3). Eine Sicherung mit fehlenden
 * Dateien ist nicht vollständig: Sie darf nicht als Sicherung zählen und „Alle Daten löschen“ nicht freigeben.
 */
export function fehlendeDateien(stand: Stand, dateien: Dateien): string[] {
  return [...new Set([...stand.belege, ...stand.belegArchiv, ...stand.kasse].map((b) => b.datei).filter((n): n is string => Boolean(n) && !dateien[n!]))];
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
