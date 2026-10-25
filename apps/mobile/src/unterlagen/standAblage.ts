/**
 * Ablage des gespeicherten Stands auf dem Gerät (E-194) – ersetzt den einen AsyncStorage-Eintrag „amtlos.unterlagen.v1“.
 *
 * Warum: Auf Android liegt AsyncStorage in einer SQLite-Tabelle (eine Zeile je Schlüssel). Eine Zeile über rund 2 MB
 * passt nicht mehr in das CursorWindow und lässt sich nicht mehr lesen, die ganze Datenbank ist standardmäßig auf 6 MB
 * begrenzt. Der verschlüsselte Stand (dazu Base64) wuchs bei vielen Rechnungen darüber hinaus – genau bei den Betrieben
 * mit den meisten Daten. Auf dem iPhone gibt es keine solche Grenze, der ganze Text ging aber jedes Mal am Stück über
 * die Brücke.
 *
 * Jetzt: Der Klartext (JSON des Stands, `kompakt.ts`) wird in Teile zerlegt; jeder Teil liegt als eigene Datei im
 * Dokumentenordner der App (`stand/`), einzeln verschlüsselt im Binärformat (AES-256-GCM, Schlüssel im Schlüsselbund,
 * Zusatztext bindet Generation, Nummer und Anzahl der Teile – vertauschte, fehlende oder fremde Teile fallen auf). Jede
 * Speicherung schreibt eine neue Generation; erst wenn alle Teile liegen, wird `kopf.json` atomar ersetzt (schreiben
 * unter Zwischennamen, dann umbenennen). Bricht das Schreiben ab, gilt weiter die vorige Generation. Die beim Start
 * geladene Generation bleibt als „vorher“ erhalten (G6).
 *
 * Umzug aus AsyncStorage: alt lesen → neu schreiben → neu zurücklesen und vergleichen → Ersatzkopie `alt/vor-umzug.txt`
 * → erst dann den alten Eintrag entfernen. Scheitert ein Schritt, bleibt der alte Eintrag unberührt (beim nächsten
 * Speichern wird es erneut versucht). Lässt sich der alte Eintrag nicht lesen (zu groß für das CursorWindow, kaputt,
 * Schlüssel fehlt), gibt es einen Ladefehler – nie einen leeren Stand, nie ein Überschreiben.
 *
 * Rein (Dateisystem, AsyncStorage und Schlüssel werden hineingereicht) und ohne Gerät testbar (test/e194-speicher.test.ts).
 */
import { istTresor, tresorBytesOeffnen, tresorBytesSchliessen, tresorOeffnen, tresorSchliessen } from "./tresor";
import { ausUtf8, utf8 } from "./sicherung";

/** Alter AsyncStorage-Schlüssel des Stands (E-121/E-129) und seine Nebeneinträge */
export const ALT_SCHLUESSEL = "amtlos.unterlagen.v1";
export const ALT_VORHER = `${ALT_SCHLUESSEL}.vorher`;
export const ALT_BEISEITE = `${ALT_SCHLUESSEL}.unlesbar.`;
/** Zusatztext für beiseitegelegte, vorher unverschlüsselte Daten (G-6) */
export const BEISEITE_KONTEXT = "beiseite";

export const KOPF = "kopf.json";
export const KOPF_FORMAT = "amtlos-stand";
/** Zeichen je Teil: höchstens 3 Byte je Zeichen in UTF-8 → jeder Teil unter 800 KB, weit unter jeder Grenze */
export const TEIL_ZEICHEN = 256 * 1024;
const BEISEITE = "beiseite";
const ALT = "alt";
export const ERSATZKOPIE = `${ALT}/vor-umzug.txt`;

/** Dateioperationen relativ zum Ordner `stand/` – Namen wie „kopf.json“ oder „beiseite/x.txt“. */
export interface Dateisystem {
  /** ganze Datei lesen; null, wenn sie fehlt */
  lesen(name: string): Promise<Uint8Array | null>;
  /** Datei schreiben (eine vorhandene wird ersetzt); fehlende Ordner werden angelegt */
  schreiben(name: string, bytes: Uint8Array): Promise<void>;
  /** Datei atomar ersetzen: vollständig unter einem Zwischennamen schreiben, dann umbenennen */
  ersetzen(name: string, bytes: Uint8Array): Promise<void>;
  /** Namen der Dateien in einem Ordner („“ = oberste Ebene), ohne Unterordner; [] wenn er fehlt */
  namen(ordner: string): string[];
  loeschen(name: string): void;
  /** Datei umbenennen bzw. in einen anderen Ordner verschieben */
  verschieben(von: string, nach: string): void;
  /** alles unter `stand/` löschen */
  leeren(): void;
}

/** Was von AsyncStorage gebraucht wird (Umzug, alte beiseitegelegte Stände). */
export interface AltSpeicher {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

export interface Schluesselquelle {
  /** Schlüssel aus dem Schlüsselbund; mit `anlegen` einen neuen, falls keiner da ist. Wirft, wenn er beschädigt ist. */
  holen(anlegen: boolean): Promise<Uint8Array | null>;
}

interface Generation {
  gen: string;
  teile: number;
}
interface Kopf {
  format: typeof KOPF_FORMAT;
  version: 1;
  /** fehlt: bewusst leer begonnen (nach einem Ladefehler) */
  aktuell?: Generation;
  /** beim Start geladene Generation (G6) – bleibt liegen, bis eine andere geladen wurde */
  vorher?: Generation;
  /** alter AsyncStorage-Eintrag: umgezogen (geprüft) oder unlesbar und deshalb unangetastet aufbewahrt */
  alt?: "migriert" | "unlesbar";
}

export type LadeFehlerArt = "unlesbar" | "schluessel" | "zu_gross";
export class LadeFehler extends Error {
  constructor(public art: LadeFehlerArt) {
    super(art === "zu_gross" ? "Gespeicherter Stand zu groß zum Lesen" : art === "schluessel" ? "Schlüssel fehlt" : "Gespeicherter Stand unlesbar");
  }
}

/** Android: AsyncStorage kann eine Zeile über ~2 MB nicht mehr lesen (SQLiteBlobTooBigException / CursorWindow). */
export const istZuGross = (e: unknown) => /CursorWindow|too big|TooBig/i.test(e instanceof Error ? e.message : String(e));

const teilName = (gen: string, i: number) => `${gen}-${i}.teil`;
const TEIL = /^([0-9a-z]+)-(\d+)\.teil$/;
const kontext = (g: Generation, i: number) => `stand:${g.gen}:${i}/${g.teile}`;
const pfad = (ordner: string, name: string) => (ordner ? `${ordner}/${name}` : name);
const gleich = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Text in Stücke von höchstens `n` UTF-16-Zeichen – nie zwischen den beiden Hälften eines Surrogatpaars. */
export function zerlegen(text: string, n = TEIL_ZEICHEN): string[] {
  if (!text) return [""];
  const aus: string[] = [];
  let i = 0;
  while (i < text.length) {
    let ende = Math.min(text.length, i + n);
    const c = text.charCodeAt(ende - 1);
    // ein Surrogatpaar bleibt zusammen (bei sehr kleinem n kommt es ganz in dieses Stück)
    if (ende < text.length && c >= 0xd800 && c <= 0xdbff) ende = ende - 1 > i ? ende - 1 : ende + 1;
    aus.push(text.slice(i, ende));
    i = ende;
  }
  return aus;
}

function kopfAus(bytes: Uint8Array | null): Kopf | null {
  if (!bytes) return null;
  try {
    const k = JSON.parse(ausUtf8(bytes)) as Partial<Kopf>;
    const gen = (g: unknown): g is Generation => Boolean(g && typeof g === "object" && typeof (g as Generation).gen === "string" && /^[0-9a-z]+$/.test((g as Generation).gen) && Number.isInteger((g as Generation).teile) && (g as Generation).teile > 0);
    if (k.format !== KOPF_FORMAT || k.version !== 1) return null;
    if (k.aktuell !== undefined && !gen(k.aktuell)) return null;
    return { format: KOPF_FORMAT, version: 1, ...(k.aktuell ? { aktuell: k.aktuell } : {}), ...(gen(k.vorher) ? { vorher: k.vorher } : {}), ...(k.alt === "migriert" || k.alt === "unlesbar" ? { alt: k.alt } : {}) };
  } catch {
    return null;
  }
}

export class StandAblage {
  private kopf: Kopf | null = null;
  /** beim Start geladene Generation (G6) */
  private vorher: Generation | undefined;
  /** roher alter Eintrag, solange der Umzug nicht abgeschlossen ist (wird beim nächsten Speichern nachgeholt) */
  private altRoh: string | null = null;
  /** alter Eintrag ließ sich nicht lesen und bleibt unangetastet */
  private altUnlesbar = false;
  private kette: Promise<unknown> = Promise.resolve();
  /** Kopf schon gelesen (beim Laden) – sonst lesen ihn die Verwaltungsfunktionen selbst */
  private kopfBekannt = false;
  private zaehler = 0;

  constructor(
    private fs: Dateisystem,
    private alt: AltSpeicher,
    private schluessel: Schluesselquelle,
    private nonce: () => Uint8Array,
    private teilZeichen = TEIL_ZEICHEN,
  ) {}

  /** nacheinander ausführen – zwei Speicherungen dürfen sich nie überholen */
  private reihe<T>(f: () => Promise<T>): Promise<T> {
    const p = this.kette.then(f, f);
    this.kette = p.catch(() => undefined);
    return p;
  }

  private neueGen(): string {
    this.zaehler = (this.zaehler + 1) % 1296;
    const zufall = Array.from(this.nonce().subarray(0, 4), (b) => b.toString(36).padStart(2, "0")).join("");
    return `${Date.now().toString(36).padStart(9, "0")}${this.zaehler.toString(36).padStart(2, "0")}${zufall}`;
  }

  private async kopfLesen(): Promise<Kopf | null> {
    // der Zwischenname bleibt nur, wenn das Umbenennen abbrach – dann ist er die neueste vollständige Fassung
    return kopfAus(await this.fs.lesen(KOPF).catch(() => null)) ?? kopfAus(await this.fs.lesen(`${KOPF}.neu`).catch(() => null));
  }

  private async kopfSchreiben(k: Kopf): Promise<void> {
    await this.fs.ersetzen(KOPF, utf8(JSON.stringify(k)));
    this.kopf = k;
    this.kopfBekannt = true;
  }

  /** Kopf und Vermerk zum alten Eintrag, auch wenn (noch) nicht geladen wurde */
  private async kopfSicher(): Promise<void> {
    if (this.kopfBekannt) return;
    this.kopf = await this.kopfLesen();
    this.altUnlesbar = this.altUnlesbar || this.kopf?.alt === "unlesbar";
    this.kopfBekannt = true;
  }

  /** Generation lesen und entschlüsseln (mit dem ersten passenden Schlüssel); wirft LadeFehler „unlesbar“. */
  private async generationLesen(g: Generation, schluessel: readonly Uint8Array[], ordner = ""): Promise<string> {
    const teile: string[] = [];
    for (let i = 0; i < g.teile; i++) {
      const roh = await this.fs.lesen(pfad(ordner, teilName(g.gen, i))).catch(() => null);
      if (!roh) throw new LadeFehler("unlesbar");
      let klar: Uint8Array | null = null;
      for (const k of schluessel) {
        try {
          klar = tresorBytesOeffnen(roh, k, kontext(g, i));
          break;
        } catch {
          /* nächster Schlüssel */
        }
      }
      if (!klar) throw new LadeFehler("unlesbar");
      teile.push(ausUtf8(klar));
    }
    return teile.join("");
  }

  /** Generationen in einem Ordner nach Dateinamen (falls der Kopf fehlt): neueste zuerst, nur lückenlose. */
  private generationenRaten(ordner: string): Generation[] {
    const je = new Map<string, Set<number>>();
    for (const n of this.fs.namen(ordner)) {
      const m = TEIL.exec(n);
      if (m) je.set(m[1]!, (je.get(m[1]!) ?? new Set()).add(Number(m[2])));
    }
    return [...je.entries()]
      .filter(([, s]) => [...s].every((i) => i < s.size))
      .map(([gen, s]) => ({ gen, teile: s.size }))
      .sort((a, b) => (a.gen < b.gen ? 1 : -1));
  }

  /**
   * Stand laden. Liefert den Klartext (null: noch nichts gespeichert) und den Schlüssel. Wirft LadeFehler, wenn es
   * Daten gibt, die sich nicht lesen lassen – der Aufrufer darf dann nichts überschreiben.
   */
  laden(): Promise<{ text: string | null; schluessel: Uint8Array | null }> {
    return this.reihe(async () => {
      this.altRoh = null;
      const kopf = await this.kopfLesen();
      this.kopf = kopf;
      this.kopfBekannt = true;
      this.altUnlesbar = kopf?.alt === "unlesbar";
      if (kopf) {
        if (!kopf.aktuell) return { text: null, schluessel: await this.schluessel.holen(true).catch(() => null) };
        const k = await this.schluessel.holen(false).catch(() => null);
        if (!k) throw new LadeFehler("schluessel");
        const text = await this.generationLesen(kopf.aktuell, [k]);
        this.vorher = kopf.aktuell;
        // ein nach dem Umzug noch liegender alter Eintrag (Entfernen war gescheitert) – jetzt wegräumen
        if (kopf.alt === "migriert") await this.altAufraeumen(k).catch(() => undefined);
        return { text, schluessel: k };
      }
      // Teile ohne Kopf (Kopf verloren): nie leer beginnen – die neueste lesbare Generation nehmen
      const geraten = this.generationenRaten("");
      if (geraten.length) {
        const k = await this.schluessel.holen(false).catch(() => null);
        if (!k) throw new LadeFehler("schluessel");
        for (const g of geraten) {
          try {
            const text = await this.generationLesen(g, [k]);
            this.vorher = g;
            await this.kopfSchreiben({ format: KOPF_FORMAT, version: 1, aktuell: g, vorher: g }).catch(() => undefined);
            return { text, schluessel: k };
          } catch {
            /* ältere versuchen */
          }
        }
        throw new LadeFehler("unlesbar");
      }
      return this.altLaden();
    });
  }

  /** Umzug aus dem alten AsyncStorage-Eintrag (oder ein ganz neuer Start). */
  private async altLaden(): Promise<{ text: string | null; schluessel: Uint8Array | null }> {
    let roh: string | null;
    try {
      roh = await this.alt.getItem(ALT_SCHLUESSEL);
    } catch (e) {
      // Android: zu groß für das CursorWindow – der Eintrag bleibt, wie er ist; nichts wird überschrieben
      throw new LadeFehler(istZuGross(e) ? "zu_gross" : "unlesbar");
    }
    if (roh === null) {
      // es gab schon einmal Daten (Ersatzkopie vom Umzug), aber weder Kopf noch Teile: nicht leer beginnen
      if (this.fs.namen(ALT).length) throw new LadeFehler("unlesbar");
      return { text: null, schluessel: await this.schluessel.holen(true).catch(() => null) };
    }
    let klar: string;
    let k: Uint8Array | null;
    if (istTresor(roh)) {
      k = await this.schluessel.holen(false).catch(() => null);
      if (!k) throw new LadeFehler("schluessel");
      try {
        klar = tresorOeffnen(roh, k);
      } catch {
        throw new LadeFehler("unlesbar");
      }
    } else {
      klar = roh;
      // ältere, unverschlüsselte Daten (vor E-129): Schlüssel anlegen
      k = await this.schluessel.holen(true).catch(() => null);
    }
    if (!lesbaresJson(klar)) throw new LadeFehler("unlesbar");
    this.altRoh = roh;
    // gleich umziehen (mit Gegenprobe); klappt es nicht, beim nächsten Speichern noch einmal – der alte Eintrag bleibt
    if (k) await this.speichernIntern(klar, k, true).catch(() => undefined);
    return { text: klar, schluessel: k };
  }

  /** Klartext verschlüsselt in einer neuen Generation speichern. */
  speichern(text: string, k: Uint8Array): Promise<void> {
    return this.reihe(() => this.speichernIntern(text, k, false));
  }

  private async speichernIntern(text: string, k: Uint8Array, pruefen: boolean): Promise<void> {
    const teile = zerlegen(text, this.teilZeichen);
    const g: Generation = { gen: this.neueGen(), teile: teile.length };
    let alt = this.kopf?.alt ?? (this.altUnlesbar ? "unlesbar" : undefined);
    const umzug = this.altRoh !== null;
    try {
      for (let i = 0; i < teile.length; i++) await this.fs.schreiben(teilName(g.gen, i), tresorBytesSchliessen(utf8(teile[i]!), k, this.nonce(), kontext(g, i)));
      // Gegenprobe (Umzug): erst zurücklesen und vergleichen, dann gilt die neue Fassung
      if (pruefen && (await this.generationLesen(g, [k])) !== text) throw new Error("Gegenprobe fehlgeschlagen");
      if (umzug) {
        // Ersatzkopie des alten Eintrags (verschlüsselt), bevor er entfernt wird
        await this.ablegenGeprueft(ERSATZKOPIE, this.altRoh!, k);
        alt = "migriert";
      }
    } catch (e) {
      // halbe Generation wieder weg – die bisherige gilt weiter
      for (let i = 0; i < teile.length; i++) this.loeschenStill(teilName(g.gen, i));
      throw e;
    }
    const vorher = this.vorher ?? (umzug ? g : undefined);
    await this.kopfSchreiben({ format: KOPF_FORMAT, version: 1, aktuell: g, ...(vorher ? { vorher } : {}), ...(alt ? { alt } : {}) });
    if (umzug) this.vorher = vorher;
    this.aufraeumen();
    if (umzug) {
      this.altRoh = null;
      await this.altAufraeumen(k).catch(() => undefined);
    }
  }

  /** Teile, die zu keiner gültigen Generation (aktuell, vorher) gehören, löschen. */
  private aufraeumen(): void {
    const behalten = new Set([this.kopf?.aktuell?.gen, this.kopf?.vorher?.gen, this.vorher?.gen].filter(Boolean));
    for (const n of this.fs.namen("")) {
      const m = TEIL.exec(n);
      if (m && !behalten.has(m[1]!)) this.loeschenStill(n);
    }
  }

  private loeschenStill(name: string): void {
    try {
      this.fs.loeschen(name);
    } catch {
      /* schon weg */
    }
  }

  /** Text als Datei ablegen (Klartext wird verschlüsselt) und zurücklesen – wirft, wenn er nicht genau so liegt. */
  private async ablegenGeprueft(name: string, text: string, k: Uint8Array | null): Promise<void> {
    const inhalt = utf8(istTresor(text) || !k ? text : tresorSchliessen(text, k, this.nonce(), BEISEITE_KONTEXT));
    await this.fs.schreiben(name, inhalt);
    const zurueck = await this.fs.lesen(name);
    if (!zurueck || !gleich(zurueck, inhalt)) throw new Error(`Ablegen fehlgeschlagen: ${name}`);
  }

  /**
   * Alte AsyncStorage-Einträge nach dem Umzug wegräumen – jeder erst, nachdem er geprüft als Datei liegt. Was sich nicht
   * lesen lässt, bleibt stehen. Ein alter Haupteintrag, der nicht der Ersatzkopie gleicht (ältere App hat danach
   * geschrieben), wird beiseitegelegt statt verworfen.
   */
  private async altAufraeumen(k: Uint8Array | null): Promise<void> {
    const zeit = zeitstempel();
    // jeder Eintrag für sich: scheitert einer (zu groß, Speicher voll), bleibt er stehen und die anderen gehen weiter
    const schritt = async (f: () => Promise<void>) => {
      try {
        await f();
      } catch {
        /* bleibt in AsyncStorage */
      }
    };
    await schritt(async () => {
      const haupt = await this.alt.getItem(ALT_SCHLUESSEL);
      if (haupt === null) return;
      const ersatz = await this.fs.lesen(ERSATZKOPIE).catch(() => null);
      if (!(ersatz && ausUtf8(ersatz) === haupt)) await this.ablegenGeprueft(`${BEISEITE}/${zeit}-alt.txt`, haupt, k);
      await this.alt.removeItem(ALT_SCHLUESSEL);
    });
    await schritt(async () => {
      const vorher = await this.alt.getItem(ALT_VORHER);
      if (vorher === null) return;
      await this.ablegenGeprueft(`${ALT}/vorher.txt`, vorher, k);
      await this.alt.removeItem(ALT_VORHER);
    });
    const keys = await this.alt.getAllKeys().catch(() => [] as readonly string[]);
    for (const key of keys.filter((x) => x.startsWith(ALT_BEISEITE))) {
      await schritt(async () => {
        const t = await this.alt.getItem(key);
        if (t === null) return;
        await this.ablegenGeprueft(`${BEISEITE}/${dateiTeil(key.slice(ALT_BEISEITE.length))}.txt`, t, k);
        await this.alt.removeItem(key);
      });
    }
  }

  /**
   * Nach einem Ladefehler (Wiederherstellen, „Neu beginnen“): die unlesbaren Daten beiseitelegen – nie löschen, nie im
   * Klartext (G-6). Neue Teile liegen schon verschlüsselt und werden nur verschoben. Ein alter Eintrag, der sich nicht
   * lesen lässt (zu groß), bleibt in AsyncStorage stehen und wird vermerkt, damit er nicht erneut den Start blockiert.
   */
  beiseitelegen(k: Uint8Array | null): Promise<void> {
    return this.reihe(async () => {
      await this.kopfSicher();
      const zeit = zeitstempel();
      const kopf = this.kopf;
      // zuerst der alte Eintrag (kann scheitern – dann ist noch nichts verschoben), danach die neuen Teile
      let unlesbar = this.altUnlesbar;
      for (const [key, name] of [
        [ALT_SCHLUESSEL, "alt"],
        [ALT_VORHER, "alt-vorher"],
      ] as const) {
        let t: string | null;
        try {
          t = await this.alt.getItem(key);
        } catch {
          // zu groß oder gestört: bleibt unangetastet stehen
          unlesbar = true;
          continue;
        }
        if (t === null) continue;
        await this.ablegenGeprueft(`${BEISEITE}/${zeit}-${name}.txt`, t, k);
        await this.alt.removeItem(key);
      }
      if (kopf?.aktuell) await this.fs.schreiben(`${BEISEITE}/${zeit}-kopf.json`, utf8(JSON.stringify(kopf)));
      for (const n of this.fs.namen("").filter((x) => TEIL.test(x))) this.fs.verschieben(n, `${BEISEITE}/${n}`);
      this.altRoh = null;
      this.altUnlesbar = unlesbar;
      this.vorher = undefined;
      this.loeschenStill(KOPF);
      this.loeschenStill(`${KOPF}.neu`);
      this.kopf = null;
      // vermerken, dass bewusst leer begonnen wird (und ob ein unlesbarer alter Eintrag stehen bleibt)
      await this.kopfSchreiben({ format: KOPF_FORMAT, version: 1, ...(unlesbar ? { alt: "unlesbar" as const } : {}) });
    });
  }

  /** Gibt es beiseitegelegte Daten (H4)? */
  async beiseitegelegtVorhanden(): Promise<boolean> {
    await this.kopfSicher();
    if (this.fs.namen(BEISEITE).length || this.altUnlesbar) return true;
    return (await this.alt.getAllKeys().catch(() => [] as readonly string[])).some((x) => x.startsWith(ALT_BEISEITE));
  }

  /**
   * Beiseitegelegte Stände mit den gegebenen Schlüsseln öffnen (H4); liefert die Klartexte, die sich öffnen ließen.
   * Sie bleiben aufbewahrt. Ein unlesbarer alter Eintrag wird erneut versucht – lässt er sich jetzt lesen, wird er als
   * Datei beiseitegelegt und aus AsyncStorage entfernt.
   */
  beiseitegelegteOeffnen(schluessel: readonly Uint8Array[]): Promise<string[]> {
    return this.reihe(async () => {
      await this.kopfSicher();
      const texte: string[] = [];
      const namen = this.fs.namen(BEISEITE).sort();
      const gelesen = new Set<string>();
      for (const n of namen.filter((x) => x.endsWith("-kopf.json"))) {
        const kopf = kopfAus(await this.fs.lesen(`${BEISEITE}/${n}`).catch(() => null));
        for (const g of [kopf?.aktuell, kopf?.vorher]) {
          if (!g || gelesen.has(g.gen)) continue;
          gelesen.add(g.gen);
          try {
            texte.push(await this.generationLesen(g, schluessel, BEISEITE));
          } catch {
            /* bleibt beiseitegelegt */
          }
        }
      }
      for (const g of this.generationenRaten(BEISEITE)) {
        if (gelesen.has(g.gen)) continue;
        try {
          texte.push(await this.generationLesen(g, schluessel, BEISEITE));
        } catch {
          /* bleibt beiseitegelegt */
        }
      }
      for (const n of namen.filter((x) => x.endsWith(".txt"))) {
        const b = await this.fs.lesen(`${BEISEITE}/${n}`).catch(() => null);
        const klar = b ? textOeffnen(ausUtf8(b), schluessel) : null;
        if (klar) texte.push(klar);
      }
      // ältere App: beiseitegelegte Stände noch in AsyncStorage
      for (const key of (await this.alt.getAllKeys().catch(() => [] as readonly string[])).filter((x) => x.startsWith(ALT_BEISEITE)).sort()) {
        const t = await this.alt.getItem(key).catch(() => null);
        const klar = t ? textOeffnen(t, schluessel) : null;
        if (klar) texte.push(klar);
      }
      if (this.altUnlesbar) {
        const t = await this.alt.getItem(ALT_SCHLUESSEL).catch(() => null);
        const klar = t ? textOeffnen(t, schluessel) : null;
        if (t !== null && klar) {
          texte.push(klar);
          try {
            await this.ablegenGeprueft(`${BEISEITE}/${zeitstempel()}-alt.txt`, t, null);
            await this.alt.removeItem(ALT_SCHLUESSEL);
            this.altUnlesbar = false;
            const { alt: _a, ...rest } = this.kopf ?? { format: KOPF_FORMAT, version: 1 as const };
            await this.kopfSchreiben(rest);
          } catch {
            /* bleibt in AsyncStorage */
          }
        }
      }
      return texte;
    });
  }

  /**
   * „Alle Daten löschen“. Ohne Ladefehler: alles (auch Beiseitegelegtes, Ersatzkopie, alte Einträge). Nach einem
   * Ladefehler (H4): nur der aktuelle Stand – Beiseitegelegtes und ein unlesbarer alter Eintrag bleiben.
   */
  allesLoeschen(nachLadefehler: boolean): Promise<void> {
    return this.reihe(async () => {
      await this.kopfSicher();
      this.altRoh = null;
      this.vorher = undefined;
      this.kopf = null;
      if (!nachLadefehler) {
        this.altUnlesbar = false;
        this.fs.leeren();
        const reste = (await this.alt.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k === ALT_SCHLUESSEL || k.startsWith(`${ALT_SCHLUESSEL}.`));
        for (const k of reste) await this.alt.removeItem(k).catch(() => undefined);
        return;
      }
      for (const n of this.fs.namen("")) if (TEIL.test(n)) this.loeschenStill(n);
      this.loeschenStill(KOPF);
      this.loeschenStill(`${KOPF}.neu`);
      if (this.altUnlesbar) await this.kopfSchreiben({ format: KOPF_FORMAT, version: 1, alt: "unlesbar" });
    });
  }
}

/** Ist der Text ein JSON-Objekt? (Unlesbares nie mit einem leeren Stand überschreiben) */
function lesbaresJson(t: string): boolean {
  try {
    const w = JSON.parse(t) as unknown;
    return Boolean(w && typeof w === "object");
  } catch {
    return false;
  }
}

/** Beiseitegelegten Text öffnen: Tresor mit einem der Schlüssel (auch doppelt verpackt, G-6) oder Klartext. */
function textOeffnen(text: string, schluessel: readonly Uint8Array[]): string | null {
  const oeffnen = (t: string): string | null => {
    if (!istTresor(t)) return t;
    for (const k of schluessel) {
      try {
        return tresorOeffnen(t, k, BEISEITE_KONTEXT);
      } catch {
        /* nächster Schlüssel */
      }
    }
    return null;
  };
  let klar = oeffnen(text);
  if (klar && istTresor(klar)) klar = oeffnen(klar);
  return klar && lesbaresJson(klar) ? klar : null;
}

const zeitstempel = () => new Date().toISOString().replace(/[^0-9]/g, "");
const dateiTeil = (s: string) => s.replace(/[^0-9A-Za-z-]/g, "") || zeitstempel();
