/**
 * Ende-zu-Ende-verschlüsselte Synchronisation (E-134) – reine Funktionen, ohne Gerät und ohne Netz testbar.
 *
 * - Sync-Schlüssel: 32 zufällige Bytes je Konto. Auf dem Server liegt er nur in einer Hülle, verschlüsselt mit einem
 *   Schlüssel aus dem Sync-Passwort (PBKDF2-SHA256, AES-256-GCM). Ein neues Gerät öffnet die Hülle mit dem Passwort.
 * - Stand und Belegdateien gehen nur mit dem Sync-Schlüssel verschlüsselt an den Server (Format amtlos-tresor).
 * - Zusammenführen: je Unterlage, Beleg und Person gewinnt die zuletzt geänderte Fassung; festgeschriebene Unterlagen
 *   und Belege werden nie durch eine andere Fassung ersetzt, ihre Historie nur ergänzt (E-209); Löschvermerke verhindern, dass Gelöschtes zurückkommt; Betrieb, Pflichten-Check, Haken und
 *   Steuerberatung gehen nach dem Zeitpunkt ihrer letzten Änderung. Gerätegebundenes (Face ID, Erinnerungen, iCloud,
 *   Bewertungsbitte, Testmodus) bleibt auf jedem Gerät, wie es ist.
 * - E-214 (Steuerberater 26.10.2026): Bei zwei verschiedenen Korrekturen desselben festgeschriebenen Belegs gilt die,
 *   die zuletzt beim Server einging – nicht die mit der späteren Uhrzeit des Geräts. Der Server sieht nur Chiffretext,
 *   nimmt aber nur die nächste Version an (Versionszähler, 409 sonst). Vor dem Zusammenführen bekommen deshalb die
 *   festgeschriebenen Belege dieses Geräts ohne Eingang die Version, die dieses Hochladen erhält (`eingangVormerken`;
 *   scheitert es, beginnt alles mit dem unveränderten Stand von vorn), die vom Server geholten ohne Eingang „spätestens
 *   mit“ der geholten Version; der Server liefert dazu die Einrichtung des Tresors (`seit`, ein neu eingerichteter
 *   Tresor zählt wieder ab 1) und nach dem Hochladen seine Zeit (`empfangen`, `eingangZeitSetzen`). Nicht übernommene
 *   Korrekturen stehen mit Inhalt, Zeitpunkt, Gerät, Eingang und Grund in der Historie und im Änderungsprotokoll.
 */
import { gcm } from "@noble/ciphers/aes";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha2";
import { kassenVereinen, kassenstuerzeVereinen, type Person } from "@amtlos/fachlogik";
import { ITERATIONEN_HOECHSTENS, PASSWORT_MINDESTLAENGE, SICHERUNG_ITERATIONEN, ausBase64, base64, utf8 } from "../unterlagen/sicherung";
import { belegNummernSichern, eingangVormerken, eingangZeitSetzen, konfliktEintraege, type NichtUebernommen, protokollVereinen, sachentnahmenVereinen, belegeVereinen, dateienImStand, staettenVereinen, fremdVereinen, mehrfachStorniert, nummernKonflikteVon, standAus, stornoVerweisePruefen, unterlagenZusammenfuehren, type Stand, type Unterlage } from "../unterlagen/speicher";
import { tresorOeffnen, tresorSchliessen, tresorVersion } from "../unterlagen/tresor";

export const SCHLUESSEL_FORMAT = "amtlos-schluessel";
const HUELLE_ZUSATZ = `${SCHLUESSEL_FORMAT}:1`;

export class SyncFehler extends Error {
  constructor(public art: "passwort" | "format" | "konflikt" | "netz" | "pro" | "anmeldung" | "konto" | "voll") {
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
  if (h.format !== SCHLUESSEL_FORMAT || h.version !== 1 || h.kdf !== "PBKDF2-SHA256" || !(Number(h.iterationen) > 0) || Number(h.iterationen) > ITERATIONEN_HOECHSTENS || typeof h.salz !== "string" || typeof h.nonce !== "string" || typeof h.daten !== "string") throw new SyncFehler("format");
  try {
    const k = pbkdf2(sha256, utf8(passwort), ausBase64(h.salz), { c: h.iterationen!, dkLen: 32 });
    return gcm(k, ausBase64(h.nonce), utf8(HUELLE_ZUSATZ)).decrypt(ausBase64(h.daten));
  } catch {
    throw new SyncFehler("passwort");
  }
}

/** Was synchronisiert wird: alles außer gerätegebundenen Einstellungen (dazu die Partner-ID, Phase 2.3 – sie bleibt auf dem Gerät). */
export function syncInhalt(s: Stand): Stand {
  const { appSperre: _a, cloudSicherung: _c, erinnerungen: _e, proTest: _p, bewertung: _b, letzteSicherung: _l, sicherungsNachweis: _n, partnerId: _pa, bezahlschirmNachCheck: _bz, geraet: _g, ...rest } = s;
  return { ...rest, appSperre: false, cloudSicherung: false, erinnerungen: false, proTest: false, bewertung: { erfolge: 0 } } as Stand;
}

/**
 * Stand für den Server (M-1): Format 2, gebunden an das Konto, mit einem fortlaufenden Zähler im verschlüsselten
 * Inhalt. Jedes Gerät merkt sich den höchsten gesehenen Zähler; einen älteren Stand (vom Server zurückgespielt)
 * lehnt es ab. Ohne Konto (Tests, ältere Aufrufer) wie bisher Format 1.
 */
export function standVerschluesseln(s: Stand, sync: Uint8Array, nonce: Uint8Array, konto?: string, zaehler = 0): string {
  if (konto === undefined) return tresorSchliessen(JSON.stringify(syncInhalt(s)), sync, nonce);
  return tresorSchliessen(JSON.stringify({ zaehler, stand: syncInhalt(s) }), sync, nonce, `sync-stand:${konto}`);
}

/**
 * Stand vom Server öffnen. `gesehen`: höchster schon gesehener Zähler – ein kleinerer (zurückgespielter alter Stand)
 * oder ein Stand ohne Zähler, nachdem schon einer mit Zähler da war, ergibt SyncFehler „format“.
 */
export function standEntschluesselnMitZaehler(text: string, sync: Uint8Array, konto?: string, gesehen = 0): { stand: Stand; zaehler: number } {
  let klar: string;
  try {
    klar = tresorOeffnen(text, sync, konto === undefined ? undefined : `sync-stand:${konto}`);
  } catch {
    throw new SyncFehler("passwort");
  }
  try {
    if (tresorVersion(text) === 1) {
      if (gesehen > 0) throw new SyncFehler("format");
      return { stand: standAus(klar), zaehler: 0 };
    }
    const roh = JSON.parse(klar) as { zaehler?: unknown; stand?: unknown };
    const zaehler = typeof roh.zaehler === "number" && Number.isSafeInteger(roh.zaehler) && roh.zaehler >= 0 ? roh.zaehler : -1;
    if (zaehler < 0 || zaehler < gesehen) throw new SyncFehler("format");
    return { stand: standAus(JSON.stringify(roh.stand ?? null)), zaehler };
  } catch (e) {
    // unlesbar oder aus einer neueren App-Version: nichts zusammenführen, nichts überschreiben
    throw e instanceof SyncFehler ? e : new SyncFehler("format");
  }
}
export const standEntschluesseln = (text: string, sync: Uint8Array, konto?: string, gesehen = 0): Stand => standEntschluesselnMitZaehler(text, sync, konto, gesehen).stand;

/** Belegdatei für den Server – Format 2, gebunden an den Dateinamen (M-1). */
export const dateiVerschluesseln = (bytes: Uint8Array, sync: Uint8Array, nonce: Uint8Array, name?: string) => tresorSchliessen(base64(bytes), sync, nonce, name === undefined ? undefined : `sync-datei:${name}`);
export const dateiEntschluesseln = (text: string, sync: Uint8Array, name?: string) => ausBase64(tresorOeffnen(text, sync, name === undefined ? undefined : `sync-datei:${name}`));

const neuer = (a: string | undefined, b: string | undefined) => (a ?? "") >= (b ?? "");

/** Elemente nach ID zusammenführen: neuere Fassung gewinnt, Löschvermerke entfernen, `fest` wird nie ersetzt. */
function nachId<T extends { id: string; geaendert?: string }>(lokal: T[], entfernt: T[], geloescht: Record<string, string>, praefix: string, fest: (x: T) => boolean = () => false): T[] {
  const m = new Map(lokal.map((x) => [x.id, x]));
  for (const e of entfernt) {
    const l = m.get(e.id);
    if (!l) m.set(e.id, e);
    // festgeschrieben schlägt Entwurf; bei gleichem Stand gewinnt die zuletzt geänderte Fassung (Zahlung, Storno setzen `geaendert`)
    else if (fest(l) !== fest(e) ? fest(e) : !neuer(l.geaendert, e.geaendert)) m.set(e.id, e);
  }
  return [...m.values()].filter((x) => fest(x) || !geloescht[`${praefix}${x.id}`] || (x.geaendert ?? "") > geloescht[`${praefix}${x.id}`]!);
}

export interface SyncZusammenfuehrung {
  stand: Stand;
  /** gleiche fortlaufende Nummer in zwei Unterlagen (z. B. auf zwei Geräten offline vergeben) */
  nummernKonflikte: string[];
  /** auf zwei Geräten verschieden festgeschrieben (K1) – die zuerst festgeschriebene gilt, die andere ist Konfliktkopie */
  festKonflikte: string[];
  /** E-209: festgeschriebene Belege, deren abweichende Fassung vom anderen Gerät nicht übernommen wurde (Belegnummern) */
  belegKonflikte: string[];
  /** Rechnungen mit mehr als einer festgeschriebenen Stornorechnung (K2) */
  mehrfachStorniert: string[];
}

/**
 * Karte schlüsselweise zusammenführen (G1): je Schlüssel gewinnt die Seite mit dem neueren Zeitpunkt
 * `zeiten["<bereich>:<schlüssel>"]`. Ohne Zeitpunkt auf beiden Seiten (ältere Daten) bleibt erhalten, was eine Seite hat.
 */
function schluesselweise<T>(lokal: Record<string, T>, entfernt: Record<string, T>, lz: Record<string, string>, ez: Record<string, string>, bereich: string): Record<string, T> {
  const p = `${bereich}:`;
  const schluessel = new Set([...Object.keys(lokal), ...Object.keys(entfernt), ...[...Object.keys(lz), ...Object.keys(ez)].filter((k) => k.startsWith(p)).map((k) => k.slice(p.length))]);
  const aus: Record<string, T> = {};
  for (const k of schluessel) {
    const tl = lz[p + k] ?? "";
    const te = ez[p + k] ?? "";
    const quelle = tl === te ? (k in lokal ? lokal : entfernt) : tl > te ? lokal : entfernt;
    if (k in quelle) aus[k] = quelle[k]!;
  }
  return aus;
}

/** Lokalen Stand mit dem Stand vom Server zusammenführen (siehe Kopf). Gerätegebundenes bleibt lokal. */
export function syncZusammenfuehren(lokal: Stand, entfernt: Stand, jetzt = new Date()): SyncZusammenfuehrung {
  const geloescht: Record<string, string> = { ...entfernt.geloescht };
  for (const [k, v] of Object.entries(lokal.geloescht)) if (!geloescht[k] || v > geloescht[k]!) geloescht[k] = v;
  const zeiten: Record<string, string> = { ...entfernt.zeiten };
  for (const [k, v] of Object.entries(lokal.zeiten)) if (!zeiten[k] || v > zeiten[k]!) zeiten[k] = v;
  const lokalNeuer = (bereich: string) => neuer(lokal.zeiten[bereich], entfernt.zeiten[bereich]);
  const fest = (u: Unterlage) => Boolean(u.festgeschrieben);
  // Unterlagen feldweise vereinen (festgeschrieben schlägt Entwurf, Zahlung und Storno gehen nicht verloren; zwei
  // verschieden festgeschriebene Fassungen werden nie vermischt – K1); Löschvermerke wie bei allen anderen;
  // Verweise auf gelöschte Stornos fallen weg
  const u = unterlagenZusammenfuehren(lokal.unterlagen, entfernt.unterlagen);
  // nach dem Löschvermerk geändert oder geteilt: bleibt
  const zuletzt = (x: Unterlage) => (x.ausgegeben && x.ausgegeben > x.geaendert ? x.ausgegeben : x.geaendert);
  const unterlagen = stornoVerweisePruefen([...u.liste.values()].filter((x) => fest(x) || !geloescht[`u:${x.id}`] || zuletzt(x) > geloescht[`u:${x.id}`]!));
  // Belege: gültige und ungültig markierte gemeinsam (die neuere Fassung gewinnt, auch beim Ungültig-Vermerk);
  // ungültig markierte bleiben immer (Aufbewahrungspflicht), gültige weichen einem neueren Löschvermerk
  // E-209: festgeschriebene Belege werden nie ersetzt oder gelöscht, ihre Historie wird nur ergänzt (`belegZweiVereinen`)
  const belegKonflikte = new Set<string>();
  const nichtUebernommen: NichtUebernommen[] = [];
  const belege = [...belegeVereinen([...lokal.belege, ...lokal.belegArchiv], [...entfernt.belege, ...entfernt.belegArchiv], belegKonflikte, nichtUebernommen).values()].filter((b) => b.ungueltig || b.festgeschrieben || !geloescht[`b:${b.id}`] || b.geaendert > geloescht[`b:${b.id}`]!);
  const stand: Stand = {
    ...lokal,
    betrieb: lokalNeuer("betrieb") ? lokal.betrieb : entfernt.betrieb,
    profil: schluesselweise(lokal.profil, entfernt.profil, lokal.zeiten, entfernt.zeiten, "profil"),
    erledigt: schluesselweise(lokal.erledigt, entfernt.erledigt, lokal.zeiten, entfernt.zeiten, "erledigt"),
    steuerberatung: lokalNeuer("steuerberatung") ? lokal.steuerberatung : entfernt.steuerberatung,
    unterlagen,
    belege: belege.filter((b) => !b.ungueltig),
    belegArchiv: belege.filter((b) => b.ungueltig),
    mitarbeiter: nachId<Person>(lokal.mitarbeiter, entfernt.mitarbeiter, geloescht, "m:"),
    kunden: nachId<Person>(lokal.kunden, entfernt.kunden, geloescht, "k:"),
    lieferanten: nachId<Person>(lokal.lieferanten, entfernt.lieferanten, geloescht, "l:"),
    fremd: fremdVereinen(lokal.fremd, entfernt.fremd),
    // R12: Kassenabschlüsse sind festgeschrieben – nach ID vereinen, nie löschen; Korrekturen beider Geräte bleiben
    kasse: kassenVereinen(lokal.kasse, entfernt.kasse),
    // R12: Betriebsstätten nach ID, die zuletzt geänderte gewinnt; Löschvermerke „s:“
    betriebsstaetten: staettenVereinen(lokal.betriebsstaetten, entfernt.betriebsstaetten, geloescht),
    // R12 GoBD: Kassenstürze und Protokoll nie verlieren; Sachentnahmen nach ID mit Löschvermerk „e:“
    kassenstuerze: kassenstuerzeVereinen(lokal.kassenstuerze, entfernt.kassenstuerze),
    protokoll: protokollVereinen(lokal.protokoll, entfernt.protokoll),
    sachentnahmen: sachentnahmenVereinen(lokal.sachentnahmen, entfernt.sachentnahmen, geloescht),
    geloescht,
    zeiten,
  };
  // E-214: Konflikte (nicht übernommene Korrekturen, Konfliktkopien) auch ins Änderungsprotokoll
  const konfliktNeu = konfliktEintraege(stand.protokoll, unterlagen, nichtUebernommen, jetzt);
  if (konfliktNeu.length) stand.protokoll = protokollVereinen(stand.protokoll, konfliktNeu);
  const gesichert = belegNummernSichern(stand);
  return { stand: gesichert, nummernKonflikte: nummernKonflikteVon(gesichert), festKonflikte: u.konflikte, belegKonflikte: [...belegKonflikte].sort(), mehrfachStorniert: mehrfachStorniert(gesichert.unterlagen) };
}

/** Schnittstelle zum Server – im Test ein Speicher im Arbeitsspeicher. */
/** E-214: Antwort des Servers auf das Speichern – neue Version, Serverzeit des Eingangs, Einrichtung des Tresors. */
export interface SpeicherAntwort {
  version: number;
  empfangen?: string;
  seit?: string;
}

export interface TresorApi {
  /** E-214: `seit` – Einrichtung des Tresors auf dem Server (ISO), `geaendert_am` – Serverzeit der aktuellen Version */
  holen(): Promise<{ version: number; schluessel: string; daten: string | null; seit?: string; geaendert_am?: string } | null>;
  /** neue Version; E-214: mit Serverzeit des Eingangs (ältere Server und Tests: nur die Zahl) */
  speichern(version: number, daten: string): Promise<number | SpeicherAntwort>;
  dateien(): Promise<string[]>;
  dateiSpeichern(name: string, daten: string): Promise<void>;
  dateiHolen(name: string): Promise<string | null>;
}

export interface SyncUmgebung {
  api: TresorApi;
  sync: Uint8Array;
  /** Konto, an das der Stand gebunden ist (M-1); ohne Angabe Format 1 wie bisher */
  konto?: string;
  /** höchster bisher gesehener Zähler des Stands und ihn merken (M-1, Schutz vor zurückgespielten Ständen) */
  zaehlerLesen?(): Promise<number>;
  zaehlerMerken?(n: number): Promise<void>;
  zufall: (n: number) => Uint8Array;
  /** aktueller lokaler Stand (wird während der Synchronisation erneut gelesen) */
  lokal(): Stand;
  /** zusammengeführten Stand übernehmen – die Umgebung führt mit inzwischen gemachten Änderungen erneut zusammen */
  uebernehmen(s: Stand): void;
  dateiLokal(name: string): Promise<Uint8Array | null>;
  /**
   * Liegt die Datei auf dem Gerät? – ohne sie zu lesen (R9 Performance). Ohne diese Funktion wird wie früher gelesen.
   * Eine vorhandene Datei, die auch auf dem Server liegt, wird dann weder gelesen noch entschlüsselt.
   */
  dateiVorhanden?(name: string): boolean | Promise<boolean>;
  dateiAblegen(name: string, bytes: Uint8Array): Promise<void>;
}

export interface SyncErgebnis {
  version: number;
  hochgeladen: number;
  heruntergeladen: number;
  nummernKonflikte: string[];
  festKonflikte: string[];
  belegKonflikte: string[];
  mehrfachStorniert: string[];
  /** Belegdateien auf dem Server, die sich nicht entschlüsseln ließen (M5) – übersprungen, nicht abgelegt */
  defekteDateien: string[];
  /** Belegdateien, die weder auf dem Gerät noch auf dem Server liegen (M5) */
  fehlendeDateien: string[];
}

/**
 * Eine Synchronisation: holen, entschlüsseln, zusammenführen, fehlende Dateien in beide Richtungen übertragen,
 * verschlüsselt speichern. Hat ein anderes Gerät inzwischen gespeichert (409), beginnt sie von vorn – höchstens dreimal.
 */
export async function synchronisieren(u: SyncUmgebung): Promise<SyncErgebnis> {
  for (let versuch = 0; versuch < 3; versuch++) {
    const t = await u.api.holen();
    if (!t) throw new SyncFehler("format");
    const gesehen = (await u.zaehlerLesen?.()) ?? 0;
    const entfernt = t.daten ? standEntschluesselnMitZaehler(t.daten, u.sync, u.konto, gesehen) : null;
    // E-214: Eingang beim Server vormerken – lokal die Version dieses Hochladens, vom Server Geholtes „spätestens“ mit der
    // geholten Version (nur wenn der Server die Einrichtung des Tresors nennt)
    const seit = eingangSeit(t.seit);
    const lokal = seit ? eingangVormerken(u.lokal(), { seit, version: t.version + 1 }) : u.lokal();
    const vomServer = entfernt && seit ? eingangVormerken(entfernt.stand, { seit, version: t.version, spaetestens: true }) : entfernt?.stand;
    const z: SyncZusammenfuehrung = vomServer ? syncZusammenfuehren(lokal, vomServer) : { stand: lokal, nummernKonflikte: [], festKonflikte: [], belegKonflikte: [], mehrfachStorniert: [] };
    // Dateien: was dem Server fehlt, hoch; was dem Gerät fehlt, herunter – auch die ungültig markierter Belege
    const aufServer = new Set(await u.api.dateien());
    let hoch = 0;
    let runter = 0;
    const defekt: string[] = [];
    const fehlend: string[] = [];
    // Belegdateien, Fotos der Z-Bons (R12) und Kopien der Aufenthaltstitel (R12 Personal)
    for (const datei of dateienImStand(z.stand)) {
      // zuerst gegen den Server prüfen, lokal nur nachsehen – gelesen und entschlüsselt wird erst zum Hochladen
      const da = u.dateiVorhanden ? await u.dateiVorhanden(datei) : undefined;
      const server = aufServer.has(datei);
      if (server && da) continue;
      const lokal = da === false ? null : await u.dateiLokal(datei);
      if (lokal && !server) {
        await u.api.dateiSpeichern(datei, dateiVerschluesseln(lokal, u.sync, u.zufall(12), u.konto === undefined ? undefined : datei));
        hoch++;
      } else if (!lokal && server) {
        const text = await u.api.dateiHolen(datei);
        if (!text) {
          fehlend.push(datei);
          continue;
        }
        // eine beschädigte oder vertauschte Datei blockiert nicht die ganze Synchronisation (M5)
        let bytes: Uint8Array;
        try {
          bytes = dateiEntschluesseln(text, u.sync, datei);
        } catch {
          defekt.push(datei);
          continue;
        }
        await u.dateiAblegen(datei, bytes);
        runter++;
      } else if (!lokal) fehlend.push(datei);
    }
    try {
      const zaehler = Math.max(gesehen, entfernt?.zaehler ?? 0) + 1;
      const antwort = await u.api.speichern(t.version, standVerschluesseln(z.stand, u.sync, u.zufall(12), u.konto, zaehler));
      const version = typeof antwort === "number" ? antwort : antwort.version;
      await u.zaehlerMerken?.(zaehler);
      // E-214: Serverzeit an die Eingänge dieser Version (geht mit der nächsten Synchronisation hinaus)
      const empfangen = typeof antwort === "number" ? undefined : eingangSeit(antwort.empfangen);
      u.uebernehmen(seit && empfangen && version === t.version + 1 ? eingangZeitSetzen(z.stand, seit, version, empfangen) : z.stand);
      return { version, hochgeladen: hoch, heruntergeladen: runter, nummernKonflikte: z.nummernKonflikte, festKonflikte: z.festKonflikte, belegKonflikte: z.belegKonflikte, mehrfachStorniert: z.mehrfachStorniert, defekteDateien: defekt, fehlendeDateien: fehlend };
    } catch (e) {
      if (e instanceof SyncFehler && e.art === "konflikt") continue;
      throw e;
    }
  }
  throw new SyncFehler("konflikt");
}

/** E-214: Zeitpunkt vom Server als ISO-Text (UTC) – null, wenn keiner oder unlesbar */
function eingangSeit(w: unknown): string | null {
  if (typeof w !== "string" || !w) return null;
  const t = Date.parse(w);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export const zufallsSchluessel = (zufall: (n: number) => Uint8Array) => zufall(32);
