/**
 * Ende-zu-Ende-verschlüsselte Synchronisation (E-134) – reine Funktionen, ohne Gerät und ohne Netz testbar.
 *
 * - Sync-Schlüssel: 32 zufällige Bytes je Konto. Auf dem Server liegt er nur in einer Hülle, verschlüsselt mit einem
 *   Schlüssel aus dem Sync-Passwort (PBKDF2-SHA256, AES-256-GCM). Ein neues Gerät öffnet die Hülle mit dem Passwort.
 * - Stand und Belegdateien gehen nur mit dem Sync-Schlüssel verschlüsselt an den Server (Format amtlos-tresor).
 * - Zusammenführen: je Unterlage, Beleg und Person gewinnt die zuletzt geänderte Fassung; festgeschriebene Unterlagen
 *   werden nie ersetzt; Löschvermerke verhindern, dass Gelöschtes zurückkommt; Betrieb, Pflichten-Check, Haken und
 *   Steuerberatung gehen nach dem Zeitpunkt ihrer letzten Änderung. Gerätegebundenes (Face ID, Erinnerungen, iCloud,
 *   Bewertungsbitte, Testmodus) bleibt auf jedem Gerät, wie es ist.
 */
import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import type { Person } from "@amtlos/fachlogik";
import { PASSWORT_MINDESTLAENGE, SICHERUNG_ITERATIONEN, ausBase64, base64, utf8 } from "../unterlagen/sicherung";
import { nummerDoppelt, standAus, type Stand, type Unterlage } from "../unterlagen/speicher";
import { tresorOeffnen, tresorSchliessen } from "../unterlagen/tresor";

export const SCHLUESSEL_FORMAT = "amtlos-schluessel";
const HUELLE_ZUSATZ = `${SCHLUESSEL_FORMAT}:1`;

export class SyncFehler extends Error {
  constructor(public art: "passwort" | "format" | "konflikt" | "netz" | "pro" | "anmeldung" | "konto") {
    super(art);
  }
}

interface Huelle {
  format: typeof SCHLUESSEL_FORMAT;
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterationen: number;
  salz: string;
  nonce: string;
  daten: string;
}

/** Sync-Schlüssel in eine Hülle packen, die nur das Passwort öffnet. */
export function huelleErstellen(sync: Uint8Array, passwort: string, zufall: (n: number) => Uint8Array, iterationen = SICHERUNG_ITERATIONEN): string {
  if (passwort.length < PASSWORT_MINDESTLAENGE) throw new SyncFehler("passwort");
  if (sync.length !== 32) throw new SyncFehler("format");
  const salz = zufall(16);
  const nonce = zufall(12);
  const k = pbkdf2(sha256, utf8(passwort), salz, { c: iterationen, dkLen: 32 });
  const daten = gcm(k, nonce, utf8(HUELLE_ZUSATZ)).encrypt(sync);
  const h: Huelle = { format: SCHLUESSEL_FORMAT, version: 1, kdf: "PBKDF2-SHA256", iterationen, salz: base64(salz), nonce: base64(nonce), daten: base64(daten) };
  return JSON.stringify(h);
}

/** Hülle mit dem Passwort öffnen; wirft SyncFehler „passwort“ bei falschem Passwort oder veränderter Hülle. */
export function huelleOeffnen(text: string, passwort: string): Uint8Array {
  let h: Partial<Huelle>;
  try {
    h = JSON.parse(text) as Partial<Huelle>;
  } catch {
    throw new SyncFehler("format");
  }
  if (h.format !== SCHLUESSEL_FORMAT || h.version !== 1 || h.kdf !== "PBKDF2-SHA256" || !(Number(h.iterationen) > 0) || typeof h.salz !== "string" || typeof h.nonce !== "string" || typeof h.daten !== "string") throw new SyncFehler("format");
  try {
    const k = pbkdf2(sha256, utf8(passwort), ausBase64(h.salz), { c: h.iterationen!, dkLen: 32 });
    return gcm(k, ausBase64(h.nonce), utf8(HUELLE_ZUSATZ)).decrypt(ausBase64(h.daten));
  } catch {
    throw new SyncFehler("passwort");
  }
}

/** Was synchronisiert wird: alles außer gerätegebundenen Einstellungen. */
export function syncInhalt(s: Stand): Stand {
  const { appSperre: _a, cloudSicherung: _c, erinnerungen: _e, proTest: _p, bewertung: _b, letzteSicherung: _l, ...rest } = s;
  return { ...rest, appSperre: false, cloudSicherung: false, erinnerungen: false, proTest: false, bewertung: { erfolge: 0 } } as Stand;
}

export const standVerschluesseln = (s: Stand, sync: Uint8Array, nonce: Uint8Array) => tresorSchliessen(JSON.stringify(syncInhalt(s)), sync, nonce);
export function standEntschluesseln(text: string, sync: Uint8Array): Stand {
  try {
    return standAus(tresorOeffnen(text, sync));
  } catch {
    throw new SyncFehler("passwort");
  }
}
export const dateiVerschluesseln = (bytes: Uint8Array, sync: Uint8Array, nonce: Uint8Array) => tresorSchliessen(base64(bytes), sync, nonce);
export const dateiEntschluesseln = (text: string, sync: Uint8Array) => ausBase64(tresorOeffnen(text, sync));

const neuer = (a: string | undefined, b: string | undefined) => (a ?? "") >= (b ?? "");

/** Elemente nach ID zusammenführen: neuere Fassung gewinnt, Löschvermerke entfernen, `fest` wird nie ersetzt. */
function nachId<T extends { id: string; geaendert?: string }>(lokal: T[], entfernt: T[], geloescht: Record<string, string>, praefix: string, fest: (x: T) => boolean = () => false): T[] {
  const m = new Map(lokal.map((x) => [x.id, x]));
  for (const e of entfernt) {
    const l = m.get(e.id);
    if (!l) m.set(e.id, e);
    else if (!fest(l) && (fest(e) || !neuer(l.geaendert, e.geaendert))) m.set(e.id, e);
  }
  return [...m.values()].filter((x) => fest(x) || !geloescht[`${praefix}${x.id}`] || (x.geaendert ?? "") > geloescht[`${praefix}${x.id}`]!);
}

export interface SyncZusammenfuehrung {
  stand: Stand;
  /** gleiche fortlaufende Nummer in zwei Unterlagen (z. B. auf zwei Geräten offline vergeben) */
  nummernKonflikte: string[];
}

/** Lokalen Stand mit dem Stand vom Server zusammenführen (siehe Kopf). Gerätegebundenes bleibt lokal. */
export function syncZusammenfuehren(lokal: Stand, entfernt: Stand): SyncZusammenfuehrung {
  const geloescht: Record<string, string> = { ...entfernt.geloescht };
  for (const [k, v] of Object.entries(lokal.geloescht)) if (!geloescht[k] || v > geloescht[k]!) geloescht[k] = v;
  const zeiten: Record<string, string> = { ...entfernt.zeiten };
  for (const [k, v] of Object.entries(lokal.zeiten)) if (!zeiten[k] || v > zeiten[k]!) zeiten[k] = v;
  const lokalNeuer = (bereich: string) => neuer(lokal.zeiten[bereich], entfernt.zeiten[bereich]);
  // Unterlage: festgeschrieben schlägt Entwurf; Zahlungs- und Stornovermerke werden übernommen
  const fest = (u: Unterlage) => Boolean(u.festgeschrieben);
  const unterlagen = nachId(lokal.unterlagen, entfernt.unterlagen, geloescht, "u:", fest).map((u) => {
    const andere = [...lokal.unterlagen, ...entfernt.unterlagen].filter((x) => x.id === u.id && x !== u);
    const bezahlt = u.bezahlt ?? andere.find((x) => x.bezahlt)?.bezahlt;
    const storniertDurch = u.storniertDurch ?? andere.find((x) => x.storniertDurch)?.storniertDurch;
    const ausgegeben = u.ausgegeben ?? andere.find((x) => x.ausgegeben)?.ausgegeben;
    return { ...u, ...(bezahlt ? { bezahlt } : {}), ...(storniertDurch ? { storniertDurch } : {}), ...(ausgegeben ? { ausgegeben } : {}) };
  });
  const stand: Stand = {
    ...lokal,
    betrieb: lokalNeuer("betrieb") ? lokal.betrieb : entfernt.betrieb,
    profil: lokalNeuer("profil") ? lokal.profil : entfernt.profil,
    erledigt: lokalNeuer("erledigt") ? lokal.erledigt : entfernt.erledigt,
    steuerberatung: lokalNeuer("steuerberatung") ? lokal.steuerberatung : entfernt.steuerberatung,
    unterlagen,
    belege: nachId(lokal.belege, entfernt.belege, geloescht, "b:"),
    mitarbeiter: nachId<Person>(lokal.mitarbeiter, entfernt.mitarbeiter, geloescht, "m:"),
    kunden: nachId<Person>(lokal.kunden, entfernt.kunden, geloescht, "k:"),
    geloescht,
    zeiten,
  };
  const nummernKonflikte = [...new Set(stand.unterlagen.filter((u) => nummerDoppelt(stand, u)).map((u) => String(u.daten.nummer ?? "").trim()))].filter(Boolean).sort();
  return { stand, nummernKonflikte };
}

/** Schnittstelle zum Server – im Test ein Speicher im Arbeitsspeicher. */
export interface TresorApi {
  holen(): Promise<{ version: number; schluessel: string; daten: string | null } | null>;
  speichern(version: number, daten: string): Promise<number>;
  dateien(): Promise<string[]>;
  dateiSpeichern(name: string, daten: string): Promise<void>;
  dateiHolen(name: string): Promise<string | null>;
}

export interface SyncUmgebung {
  api: TresorApi;
  sync: Uint8Array;
  zufall: (n: number) => Uint8Array;
  /** aktueller lokaler Stand (wird während der Synchronisation erneut gelesen) */
  lokal(): Stand;
  /** zusammengeführten Stand übernehmen – die Umgebung führt mit inzwischen gemachten Änderungen erneut zusammen */
  uebernehmen(s: Stand): void;
  dateiLokal(name: string): Promise<Uint8Array | null>;
  dateiAblegen(name: string, bytes: Uint8Array): Promise<void>;
}

export interface SyncErgebnis {
  version: number;
  hochgeladen: number;
  heruntergeladen: number;
  nummernKonflikte: string[];
}

/**
 * Eine Synchronisation: holen, entschlüsseln, zusammenführen, fehlende Dateien in beide Richtungen übertragen,
 * verschlüsselt speichern. Hat ein anderes Gerät inzwischen gespeichert (409), beginnt sie von vorn – höchstens dreimal.
 */
export async function synchronisieren(u: SyncUmgebung): Promise<SyncErgebnis> {
  for (let versuch = 0; versuch < 3; versuch++) {
    const t = await u.api.holen();
    if (!t) throw new SyncFehler("format");
    const entfernt = t.daten ? standEntschluesseln(t.daten, u.sync) : null;
    const z = entfernt ? syncZusammenfuehren(u.lokal(), entfernt) : { stand: u.lokal(), nummernKonflikte: [] };
    // Dateien: was dem Server fehlt, hoch; was dem Gerät fehlt, herunter
    const aufServer = new Set(await u.api.dateien());
    let hoch = 0;
    let runter = 0;
    for (const b of z.stand.belege) {
      if (!b.datei) continue;
      const lokal = await u.dateiLokal(b.datei);
      if (lokal && !aufServer.has(b.datei)) {
        await u.api.dateiSpeichern(b.datei, dateiVerschluesseln(lokal, u.sync, u.zufall(12)));
        hoch++;
      } else if (!lokal && aufServer.has(b.datei)) {
        const text = await u.api.dateiHolen(b.datei);
        if (text) {
          await u.dateiAblegen(b.datei, dateiEntschluesseln(text, u.sync));
          runter++;
        }
      }
    }
    try {
      const version = await u.api.speichern(t.version, standVerschluesseln(z.stand, u.sync, u.zufall(12)));
      u.uebernehmen(z.stand);
      return { version, hochgeladen: hoch, heruntergeladen: runter, nummernKonflikte: z.nummernKonflikte };
    } catch (e) {
      if (e instanceof SyncFehler && e.art === "konflikt") continue;
      throw e;
    }
  }
  throw new SyncFehler("konflikt");
}

export const zufallsSchluessel = (zufall: (n: number) => Uint8Array) => zufall(32);
