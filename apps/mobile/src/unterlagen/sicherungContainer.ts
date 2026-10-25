/**
 * Sicherungsdatei Version 3 (E-194): ein Container, der Stück für Stück geschrieben und gelesen wird – nie die ganze
 * Sicherung im Arbeitsspeicher. Bis Version 2 entstand die Datei als ein JSON-Text: alle Belegfotos als Base64 im
 * Klartext, darüber AES-GCM am Stück, darüber noch einmal Base64 – ein Vielfaches der Fotos gleichzeitig im Speicher,
 * bei vielen Belegfotos stürzte die App ab. Versionen 1 und 2 bleiben lesbar (`sicherung.ts`).
 *
 * Aufbau (alle Zahlen Big Endian):
 *   „amtlos-sicherung:3\n“
 *   u32 Länge des Kopfs, Kopf als JSON (Format, Version, Erstellt, KDF mit Salz und Runden, Chiffre) – kein Klartext
 *     des Inhalts, wie bisher nur Format und Verfahren
 *   Datensätze: u32 Länge, Nonce (12 Byte), AES-256-GCM-Chiffretext. Zusatztext je Datensatz: „amtlos-sicherung:3:<Nr>:“
 *     und der Kopf – vertauschte, entfernte oder fremde Datensätze und ein geänderter Kopf fallen beim Öffnen auf.
 *   Klartext eines Datensatzes: 1 Byte Art, dann
 *     1 STAND        Stück des Stands (JSON in kompakter Schreibweise, `kompakt.ts`)
 *     2 STAND_ENDE   {"teile": n}
 *     3 DATEI        1 Byte Namenslänge, Name, 1 Byte „letztes Stück“, Stück der Belegdatei (höchstens TEIL_BYTES)
 *     4 ENDE         {"dateien": [Namen]} – fehlt er, ist die Datei abgeschnitten
 *
 * Schlüssel: PBKDF2-SHA256 aus dem Passwort wie bisher (`schluesselAusPasswort`); derselbe abgeleitete Schlüssel wie für
 * die automatische Sicherung funktioniert also auch hier.
 */
import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { istBelegDateiname } from "@amtlos/fachlogik";
import { kompaktJson } from "./kompakt";
import { ITERATIONEN_HOECHSTENS, SICHERUNG_FORMAT, SicherungsFehler, ausBase64, ausUtf8, base64, sicherungLesenMitDateien, utf8, type Dateien, type SicherungsSchluessel } from "./sicherung";
import { StandFehler, dateienImStand, standAus, type Stand } from "./speicher";
import { zerlegen } from "./standAblage";

export const CONTAINER_VERSION = 3;
export const CONTAINER_KENNUNG = utf8(`${SICHERUNG_FORMAT}:3\n`);
/** größtes Stück einer Belegdatei je Datensatz */
export const TEIL_BYTES = 512 * 1024;
/** Zeichen des Stands je Datensatz (höchstens 3 Byte je Zeichen → unter TEIL_BYTES) */
const STAND_ZEICHEN = 128 * 1024;
/** größter erlaubter Datensatz beim Lesen (präparierte Datei darf nicht beliebig viel Speicher anfordern) */
export const DATENSATZ_HOECHSTENS = TEIL_BYTES + 64 * 1024;
const ART = { STAND: 1, STAND_ENDE: 2, DATEI: 3, ENDE: 4 } as const;

/** Schreibt Bytes nacheinander ans Ende (Datei im Cache, Blob im Web). */
export interface Schreiber {
  schreiben(bytes: Uint8Array): Promise<void>;
}
/** Liest nacheinander: höchstens `n` Bytes, weniger nur am Dateiende. */
export interface Leser {
  lesen(n: number): Promise<Uint8Array>;
  schliessen?(): void;
}

/**
 * Belegdateien einer geöffneten Sicherung – eine nach der anderen. `brauchen` entscheidet je Datei, ob sie gelesen
 * wird (vorhandene bleiben); `ablegen` bekommt jeweils eine vollständige Datei. `fehler`: Dateien, die sich nicht
 * ablegen ließen oder in der Sicherung beschädigt sind (G4).
 */
export interface BelegQuelle {
  dateien(brauchen: (name: string) => Promise<boolean>, ablegen: (name: string, bytes: Uint8Array) => Promise<void>): Promise<{ fehler: number }>;
}

export interface GeoeffneteSicherung extends BelegQuelle {
  stand: Stand;
  /** aus dem Passwort abgeleiteter Schlüssel (für Belegdateien der automatischen Sicherung) */
  schluessel: Uint8Array;
  kdf: { salz: Uint8Array; iterationen: number };
  version: 1 | 2 | 3;
}

interface Kopf {
  format: typeof SICHERUNG_FORMAT;
  version: 3;
  erstellt: string;
  kdf: { name: "PBKDF2-SHA256"; iterationen: number; salz: string };
  chiffre: { name: "AES-256-GCM" };
}

const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const ausU32 = (b: Uint8Array) => ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
function verbinden(...teile: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(teile.reduce((n, t) => n + t.length, 0));
  let i = 0;
  for (const t of teile) {
    out.set(t, i);
    i += t.length;
  }
  return out;
}
const zusatz = (nr: number, kopf: Uint8Array) => verbinden(utf8(`${SICHERUNG_FORMAT}:3:${nr}:`), kopf);

/**
 * Sicherung als Container schreiben: Kopf, Stand in Stücken, dann jede Belegdatei in Stücken, zuletzt der Abschluss.
 * Gelesen wird je Belegdatei einzeln (`belege.lesen`); was sich nicht lesen lässt, steht in `fehlend` (H3).
 */
export async function containerSchreiben(
  ziel: Schreiber,
  stand: Stand,
  k: SicherungsSchluessel,
  zufall: (n: number) => Uint8Array,
  belege: { namen: readonly string[]; lesen(name: string): Promise<Uint8Array | null> },
  jetzt = new Date(),
  fortschritt?: (n: number, von: number) => void,
): Promise<{ fehlend: string[] }> {
  const kopf: Kopf = { format: SICHERUNG_FORMAT, version: 3, erstellt: jetzt.toISOString(), kdf: { name: "PBKDF2-SHA256", iterationen: k.iterationen, salz: base64(k.salz) }, chiffre: { name: "AES-256-GCM" } };
  const kopfBytes = utf8(JSON.stringify(kopf));
  await ziel.schreiben(verbinden(CONTAINER_KENNUNG, u32(kopfBytes.length), kopfBytes));
  let nr = 0;
  const datensatz = async (klar: Uint8Array) => {
    const nonce = zufall(12);
    const geheim = gcm(k.schluessel, nonce, zusatz(nr++, kopfBytes)).encrypt(klar);
    await ziel.schreiben(verbinden(u32(nonce.length + geheim.length), nonce, geheim));
  };
  const teile = zerlegen(kompaktJson(stand), STAND_ZEICHEN);
  for (const t of teile) await datensatz(verbinden(new Uint8Array([ART.STAND]), utf8(t)));
  await datensatz(verbinden(new Uint8Array([ART.STAND_ENDE]), utf8(JSON.stringify({ teile: teile.length }))));
  const fehlend: string[] = [];
  const geschrieben: string[] = [];
  let i = 0;
  for (const name of belege.namen) {
    fortschritt?.(++i, belege.namen.length);
    if (!istBelegDateiname(name)) continue;
    const bytes = await belege.lesen(name).catch(() => null);
    if (!bytes) {
      fehlend.push(name);
      continue;
    }
    const n = utf8(name);
    for (let a = 0; a === 0 || a < bytes.length; a += TEIL_BYTES) {
      const letztes = a + TEIL_BYTES >= bytes.length;
      await datensatz(verbinden(new Uint8Array([ART.DATEI, n.length]), n, new Uint8Array([letztes ? 1 : 0]), bytes.subarray(a, a + TEIL_BYTES)));
    }
    geschrieben.push(name);
  }
  await datensatz(verbinden(new Uint8Array([ART.ENDE]), utf8(JSON.stringify({ dateien: geschrieben }))));
  return { fehlend };
}

/** Beginnen die Bytes mit der Kennung des Containers? */
export function istContainer(anfang: Uint8Array): boolean {
  return anfang.length >= CONTAINER_KENNUNG.length && CONTAINER_KENNUNG.every((b, i) => anfang[i] === b);
}

/** genau `n` Bytes lesen – weniger heißt: Datei abgeschnitten */
async function genau(l: Leser, n: number): Promise<Uint8Array> {
  const teile: Uint8Array[] = [];
  let da = 0;
  while (da < n) {
    const b = await l.lesen(n - da);
    if (!b.length) throw new SicherungsFehler("format");
    teile.push(b);
    da += b.length;
  }
  return teile.length === 1 ? teile[0]! : verbinden(...teile);
}

async function kopfLesen(l: Leser): Promise<{ kopf: Kopf; kopfBytes: Uint8Array }> {
  if (!istContainer(await genau(l, CONTAINER_KENNUNG.length))) throw new SicherungsFehler("format");
  const laenge = ausU32(await genau(l, 4));
  if (laenge > 64 * 1024) throw new SicherungsFehler("format");
  const kopfBytes = await genau(l, laenge);
  let k: Partial<Kopf>;
  try {
    k = JSON.parse(ausUtf8(kopfBytes)) as Partial<Kopf>;
  } catch {
    throw new SicherungsFehler("format");
  }
  if (k.format !== SICHERUNG_FORMAT || k.version !== 3 || k.kdf?.name !== "PBKDF2-SHA256" || k.chiffre?.name !== "AES-256-GCM" || typeof k.kdf.salz !== "string" || !(k.kdf.iterationen > 0) || k.kdf.iterationen > ITERATIONEN_HOECHSTENS) throw new SicherungsFehler("format");
  return { kopf: k as Kopf, kopfBytes };
}

/** nächster Datensatz (verschlüsselt) oder null am Dateiende */
async function datensatzRoh(l: Leser): Promise<Uint8Array | null> {
  const kopf = await l.lesen(4);
  if (!kopf.length) return null;
  const laenge = ausU32(kopf.length === 4 ? kopf : verbinden(kopf, await genau(l, 4 - kopf.length)));
  if (laenge < 12 + 16 + 1 || laenge > DATENSATZ_HOECHSTENS) throw new SicherungsFehler("format");
  return genau(l, laenge);
}

const entschluesseln = (roh: Uint8Array, k: Uint8Array, nr: number, kopfBytes: Uint8Array) => gcm(k, roh.subarray(0, 12), zusatz(nr, kopfBytes)).decrypt(roh.subarray(12));

/**
 * Container öffnen: Kopf, Schlüssel aus dem Passwort, Stand. Die Belegdateien werden erst beim Einspielen gelesen –
 * in einem zweiten Durchgang, Stück für Stück (`dateien`). `leserNeu` öffnet die Datei jeweils neu von vorn.
 */
export async function containerOeffnen(leserNeu: () => Promise<Leser>, passwort: string): Promise<GeoeffneteSicherung> {
  const l = await leserNeu();
  try {
    const { kopf, kopfBytes } = await kopfLesen(l);
    const salz = ausBase64(kopf.kdf.salz);
    const k = pbkdf2(sha256, utf8(passwort), salz, { c: kopf.kdf.iterationen, dkLen: 32 });
    const teile: string[] = [];
    let nr = 0;
    for (;;) {
      const roh = await datensatzRoh(l);
      if (!roh) throw new SicherungsFehler("format");
      let klar: Uint8Array;
      try {
        klar = entschluesseln(roh, k, nr, kopfBytes);
      } catch {
        // der erste Datensatz entscheidet über das Passwort, später ist die Datei beschädigt
        throw new SicherungsFehler(nr === 0 ? "passwort" : "format");
      }
      nr++;
      if (klar[0] === ART.STAND) teile.push(ausUtf8(klar.subarray(1)));
      else if (klar[0] === ART.STAND_ENDE) {
        const e = JSON.parse(ausUtf8(klar.subarray(1))) as { teile?: unknown };
        if (e.teile !== teile.length) throw new SicherungsFehler("format");
        break;
      } else throw new SicherungsFehler("format");
    }
    let stand: Stand;
    try {
      stand = standAus(teile.join(""));
    } catch (e) {
      if (e instanceof StandFehler) throw new SicherungsFehler("format");
      throw e;
    }
    const standDatensaetze = nr;
    return {
      stand,
      schluessel: k,
      kdf: { salz, iterationen: kopf.kdf.iterationen },
      version: 3,
      dateien: (brauchen, ablegen) => containerDateien(leserNeu, k, standDatensaetze, stand, brauchen, ablegen),
    };
  } finally {
    l.schliessen?.();
  }
}

async function containerDateien(leserNeu: () => Promise<Leser>, k: Uint8Array, standDatensaetze: number, stand: Stand, brauchen: (name: string) => Promise<boolean>, ablegen: (name: string, bytes: Uint8Array) => Promise<void>): Promise<{ fehler: number }> {
  const l = await leserNeu();
  let fehler = 0;
  const geliefert = new Set<string>();
  let enthalten: string[] | null = null;
  try {
    const { kopfBytes } = await kopfLesen(l);
    // Stand überspringen (schon gelesen) – die Nummern zählen weiter
    for (let i = 0; i < standDatensaetze; i++) if (!(await datensatzRoh(l))) throw new SicherungsFehler("format");
    let nr = standDatensaetze;
    let aktuell = null as { name: string; brauchen: boolean; stuecke: Uint8Array[] } | null;
    for (;;) {
      const roh = await datensatzRoh(l);
      if (!roh) break;
      const klar = entschluesseln(roh, k, nr++, kopfBytes);
      if (klar[0] === ART.ENDE) {
        const e = JSON.parse(ausUtf8(klar.subarray(1))) as { dateien?: unknown };
        enthalten = Array.isArray(e.dateien) ? e.dateien.filter((x): x is string => typeof x === "string") : [];
        break;
      }
      if (klar[0] !== ART.DATEI) throw new SicherungsFehler("format");
      const nl = klar[1]!;
      const name = ausUtf8(klar.subarray(2, 2 + nl));
      const letztes = klar[2 + nl] === 1;
      const stueck = klar.subarray(3 + nl);
      if (!istBelegDateiname(name)) continue;
      if (aktuell?.name !== name) aktuell = { name, brauchen: !geliefert.has(name) && (await brauchen(name)), stuecke: [] };
      if (aktuell.brauchen) aktuell.stuecke.push(stueck);
      if (!letztes) continue;
      if (aktuell.brauchen) {
        try {
          await ablegen(name, aktuell.stuecke.length === 1 ? aktuell.stuecke[0]! : verbinden(...aktuell.stuecke));
        } catch {
          fehler++;
        }
      }
      geliefert.add(name);
      aktuell = null;
    }
  } catch {
    // beschädigt oder abgeschnitten: was bis hierher kam, ist abgelegt; der Rest zählt unten als Fehler
  } finally {
    l.schliessen?.();
  }
  // erwartete, aber nicht gelieferte Dateien, die auf dem Gerät fehlen
  for (const name of enthalten ?? dateienImStand(stand)) if (!geliefert.has(name) && (await brauchen(name))) fehler++;
  return { fehler };
}

/** Sicherung im Textformat (Version 1/2, auch die automatische Sicherung) öffnen – gleiche Schnittstelle. */
export function textSicherungOeffnen(text: string, passwort: string): GeoeffneteSicherung {
  const r = sicherungLesenMitDateien(text, passwort);
  return { stand: r.stand, schluessel: r.schluessel, kdf: r.kdf, version: r.version, ...belegeAusKarte(r.dateien) };
}

/** Belegdateien aus einer Karte Name → Base64 (Version 2) – erst beim Ablegen einzeln dekodiert. */
export function belegeAusKarte(d: Dateien): BelegQuelle {
  return {
    dateien: async (brauchen, ablegen) => {
      let fehler = 0;
      for (const [name, b64] of Object.entries(d)) {
        if (!(await brauchen(name))) continue;
        try {
          await ablegen(name, ausBase64(b64));
        } catch {
          fehler++;
        }
      }
      return { fehler };
    },
  };
}

/**
 * Belegdateien ergänzen, die nicht in der Sicherung selbst stecken (automatische Sicherung: Belegordner daneben) –
 * je Datei einzeln nachgeladen.
 */
export function belegeErgaenzt(q: BelegQuelle, stand: Stand, nachladen: (name: string) => Promise<Uint8Array | null>): BelegQuelle {
  return {
    dateien: async (brauchen, ablegen) => {
      const geliefert = new Set<string>();
      const r = await q.dateien(brauchen, async (name, bytes) => {
        geliefert.add(name);
        await ablegen(name, bytes);
      });
      let fehler = r.fehler;
      for (const name of dateienImStand(stand)) {
        if (geliefert.has(name) || !(await brauchen(name))) continue;
        const bytes = await nachladen(name).catch(() => null);
        if (!bytes) continue;
        try {
          await ablegen(name, bytes);
        } catch {
          fehler++;
        }
      }
      return { fehler };
    },
  };
}
