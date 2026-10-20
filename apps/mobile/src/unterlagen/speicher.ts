/**
 * Unterlagen und Betrieb – nur auf dem Gerät (E-121). Reine Funktionen über einem unveränderlichen Stand, damit sie
 * ohne Gerät testbar sind; zustand.tsx speichert den Stand in AsyncStorage.
 */
import { LEERER_BETRIEB, belegAus, belegFassung, belegInhaltGeaendert, belegSummen, leereDaten, type Beleg, naechsteNummer, personMerken as merken, vorlageFuer, type Betrieb, type Daten, type Person, type PersonAngaben, type PersonenArt } from "@amtlos/fachlogik";

export interface Unterlage {
  id: string;
  vorlage: string;
  daten: Daten;
  erstellt: string;
  geaendert: string;
  /** zuerst als PDF geteilt oder gedruckt (E-127) – erst dann zählt die Unterlage für eine Pflicht */
  ausgegeben?: string;
  /** festgeschrieben (Vorlagen mit `festschreiben`, z. B. Rechnung): nicht mehr änderbar oder löschbar */
  festgeschrieben?: string;
  /** storniert durch diese Unterlage (Stornorechnung) */
  storniertDurch?: string;
  /** Zahlung eingegangen am (YYYY-MM-DD, E-129) – gehört nicht zum Inhalt, ändert also keine festgeschriebene Rechnung */
  bezahlt?: string;
  /** wann die Zahlung zuletzt vermerkt oder entfernt wurde (ISO) – entscheidet beim Zusammenführen zweier Fassungen */
  bezahltGeaendert?: string;
  /** Stornorechnung: ID der stornierten Rechnung (M1) – die Nummer allein ist bei doppelt vergebenen Nummern mehrdeutig */
  stornoZuId?: string;
  /**
   * Konfliktkopie (K1): Zwei Geräte haben dieselbe Unterlage mit verschiedenem Inhalt festgeschrieben. Gültig bleibt die
   * zuerst festgeschriebene; die andere Fassung bleibt als Kopie erhalten, zählt aber nirgends mit (nicht gültig).
   */
  konfliktKopieVon?: string;
  /** SHA-256 (hex) des geteilten PDFs, wenn beim Festschreiben bekannt (H1) */
  pdfSha256?: string;
}

export interface Stand {
  version: 1;
  betrieb: Betrieb;
  unterlagen: Unterlage[];
  /** Belege und Eingangsrechnungen (E-133); Dateien liegen verschlüsselt daneben (unterlagen/dateien.ts) */
  belege: Beleg[];
  /** gespeicherte Personen, die Vorlagen vorausfüllen (E-124) */
  mitarbeiter: Person[];
  kunden: Person[];
  /** Antworten im Pflichten-Check (E-126), Schlüssel wie im Server-Profil ohne „profil.“ */
  profil: Record<string, string | number | boolean | string[] | null>;
  /** abgehakte Pflichten: Pflicht-ID → Datum */
  erledigt: Record<string, string>;
  /** lokale Erinnerungen an Fristen eingeschaltet (E-128) */
  erinnerungen: boolean;
  /** App nur nach Face ID / Code öffnen (E-129) */
  appSperre: boolean;
  /** letzte Änderung am Stand (ISO) */
  geaendert?: string;
  /** letzte erstellte Datensicherung (ISO, E-129) – von Hand oder automatisch in iCloud */
  letzteSicherung?: string;
  /** automatisch in iCloud sichern (nur im eigenen App-Build, E-129) */
  cloudSicherung: boolean;
  /** Pro testweise eingeschaltet – nur im Testmodus ohne App-Store-Anbindung (E-132) */
  proTest: boolean;
  /** Angaben für das Steuerberater-Paket (E-133) */
  steuerberatung: { kontenrahmen: "SKR03" | "SKR04"; beraternummer: string; mandantennummer: string };
  /**
   * Synchronisation (E-134): Löschvermerke („u:“ Unterlage, „b:“ Beleg, „m:“/„k:“ Person → ISO-Zeitpunkt), damit
   * Gelöschtes nicht von einem anderen Gerät zurückkommt; Zeitpunkte der letzten Änderung je Bereich (betrieb, profil,
   * erledigt, steuerberatung), damit die neuere Fassung gewinnt.
   */
  geloescht: Record<string, string>;
  zeiten: Record<string, string>;
  /** Bitte um eine Bewertung (E-132): Erfolgsmomente gezählt, zuletzt gefragt am (ISO) */
  bewertung: { erfolge: number; gefragt?: string };
  /**
   * Als ungültig markierte Belege (H2): innerhalb der Aufbewahrungsfrist nicht gelöscht, sondern hier mit Grund
   * aufbewahrt – samt Datei. Sie erscheinen in keiner Liste und zählen nirgends mit.
   */
  belegArchiv: Beleg[];
  /**
   * Was diese App-Version nicht kennt (M4): Unterlagen einer unbekannten Vorlage (neuere App, umbenannte Vorlage) und
   * Belege mit unlesbaren Kernangaben. Sie werden unverändert aufbewahrt und weitergereicht, nur nicht angezeigt –
   * nie verworfen (GoBD).
   */
  fremd: { unterlagen: Record<string, unknown>[]; belege: Record<string, unknown>[] };
}

/** Aktuelle Version des gespeicherten Stands. Höhere Versionen stammen aus einer neueren App und werden nie überschrieben. */
export const STAND_VERSION = 1;

/**
 * Migrationen: Eintrag n hebt einen Stand von Version n auf n + 1. Noch keine nötig – das Gerüst steht, damit eine
 * künftige Änderung am Format nicht in `standAus` versteckt werden muss.
 */
export const MIGRATIONEN: Record<number, (roh: Record<string, unknown>) => Record<string, unknown>> = {};

export class StandFehler extends Error {
  /** „unlesbar“: kein gültiges JSON bzw. kein Objekt; „version“: aus einer neueren App-Version */
  constructor(public art: "unlesbar" | "version") {
    super(art === "version" ? "Stand aus einer neueren App-Version" : "Stand unlesbar");
  }
}

/** Gespeicherten Stand auf die aktuelle Version heben; wirft StandFehler „version“ bei einer unbekannten, höheren Version. */
export function migrieren(roh: Record<string, unknown>): Record<string, unknown> {
  let v = typeof roh.version === "number" && Number.isInteger(roh.version) && roh.version >= 1 ? roh.version : 1;
  if (v > STAND_VERSION) throw new StandFehler("version");
  let r = roh;
  while (v < STAND_VERSION) {
    const m = MIGRATIONEN[v];
    if (!m) throw new StandFehler("version");
    r = m(r);
    v++;
  }
  return { ...r, version: STAND_VERSION };
}

export const LEERER_STAND: Stand = { version: 1, betrieb: LEERER_BETRIEB, unterlagen: [], belege: [], mitarbeiter: [], kunden: [], profil: {}, erledigt: {}, erinnerungen: false, appSperre: false, cloudSicherung: false, proTest: false, bewertung: { erfolge: 0 }, steuerberatung: { kontenrahmen: "SKR03", beraternummer: "", mandantennummer: "" }, geloescht: {}, zeiten: {}, belegArchiv: [], fremd: { unterlagen: [], belege: [] } };

function profilAus(roh: unknown): Stand["profil"] {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(
    Object.entries(roh as Record<string, unknown>).filter(([, w]) => w === null || ["string", "number", "boolean"].includes(typeof w) || (Array.isArray(w) && w.every((x) => typeof x === "string"))),
  ) as Stand["profil"];
}
function erledigtAus(roh: unknown): Record<string, string> {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(Object.entries(roh as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Karte Schlüssel → ISO-Zeitpunkt (Löschvermerke, Zeiten); Unlesbares fällt weg. */
function isoKarte(roh: unknown): Record<string, string> {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(Object.entries(roh as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(e[1])));
}

/** Zeitpunkt der letzten Änderung eines Bereichs setzen (Synchronisation, E-134). */
const mitZeit = (s: Stand, bereich: string, jetzt = new Date()): Stand => ({ ...s, zeiten: { ...s.zeiten, [bereich]: jetzt.toISOString() } });
/** Löschvermerk setzen. */
const vermerken = (s: Stand, schluessel: string, jetzt = new Date()): Stand => ({ ...s, geloescht: { ...s.geloescht, [schluessel]: jetzt.toISOString() } });

function steuerberatungAus(roh: unknown): Stand["steuerberatung"] {
  const b = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  const ziffern = (w: unknown) => (typeof w === "string" ? w.replace(/\D/g, "").slice(0, 7) : "");
  return { kontenrahmen: b.kontenrahmen === "SKR04" ? "SKR04" : "SKR03", beraternummer: ziffern(b.beraternummer), mandantennummer: ziffern(b.mandantennummer) };
}

function bewertungAus(roh: unknown): Stand["bewertung"] {
  const b = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  const erfolge = typeof b.erfolge === "number" && Number.isFinite(b.erfolge) ? Math.max(0, Math.floor(b.erfolge)) : 0;
  return typeof b.gefragt === "string" && b.gefragt ? { erfolge, gefragt: b.gefragt } : { erfolge };
}

/** Liste der Personen einer Art im Stand. */
export const PERSONEN_LISTE: Record<PersonenArt, "mitarbeiter" | "kunden"> = { mitarbeiter: "mitarbeiter", kunde: "kunden" };

function personenAus(roh: unknown): Person[] {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === "object" && typeof (p as Person).id === "string" && typeof (p as Person).name === "string"))
    .map((p) => Object.fromEntries(Object.entries(p).filter(([, w]) => typeof w === "string" || w === null)) as Person);
}

const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const istIso = (w: unknown): w is string => typeof w === "string" && ISO_ZEIT.test(w);
const ANFANG = "1970-01-01T00:00:00.000Z";
const istObjekt = (w: unknown): w is Record<string, unknown> => Boolean(w && typeof w === "object" && !Array.isArray(w));

/**
 * Eine gespeicherte Unterlage bereinigen: Zeitstempel müssen ISO-Zeitpunkte sein (K1 – sonst entschiede ein
 * präpariertes `geaendert` das Zusammenführen). Eine Festschreibung geht dabei nie verloren: Ist ihr Zeitpunkt
 * unlesbar, gilt der der Ausgabe bzw. der letzten Änderung.
 */
function unterlageAus(u: Record<string, unknown>): Unterlage {
  const erstellt = istIso(u.erstellt) ? u.erstellt : istIso(u.geaendert) ? u.geaendert : ANFANG;
  const geaendert = istIso(u.geaendert) ? u.geaendert : erstellt;
  const r: Unterlage = { ...(u as unknown as Unterlage), erstellt, geaendert };
  if (u.ausgegeben) r.ausgegeben = istIso(u.ausgegeben) ? u.ausgegeben : geaendert;
  else delete r.ausgegeben;
  if (u.festgeschrieben) r.festgeschrieben = istIso(u.festgeschrieben) ? u.festgeschrieben : (r.ausgegeben ?? geaendert);
  else delete r.festgeschrieben;
  for (const k of ["storniertDurch", "stornoZuId", "konfliktKopieVon", "pdfSha256", "bezahlt"] as const) if (typeof u[k] !== "string" || !u[k]) delete r[k];
  if (!istIso(u.bezahltGeaendert)) delete r.bezahltGeaendert;
  return r;
}

/**
 * Gespeicherten Stand lesen und bereinigen. `null` ergibt den leeren Stand. Unlesbares (kein JSON, kein Objekt) und
 * Stände einer neueren App-Version werfen StandFehler – der Aufrufer darf dann nichts überschreiben (Ladefehler).
 * Unbekannte Vorlagen und unlesbare Belege fallen nicht weg, sondern kommen nach `fremd` (M4).
 */
export function standAus(json: string | null): Stand {
  if (!json) return LEERER_STAND;
  let geparst: unknown;
  try {
    geparst = JSON.parse(json);
  } catch {
    throw new StandFehler("unlesbar");
  }
  if (!istObjekt(geparst)) throw new StandFehler("unlesbar");
  const roh = migrieren(geparst) as Partial<Stand>;
  const betrieb = { ...LEERER_BETRIEB };
  for (const k of Object.keys(LEERER_BETRIEB) as (keyof Betrieb)[]) {
    const w = (roh.betrieb as Record<string, unknown> | undefined)?.[k];
    if (typeof w === "string") betrieb[k] = w;
  }
  const r = roh as Record<string, unknown>;
  const fremdRoh = istObjekt(r.fremd) ? r.fremd : {};
  const liste = (w: unknown) => (Array.isArray(w) ? (w as unknown[]).filter(istObjekt) : []);
  // bekannte Vorlagen in `unterlagen`, unbekannte unverändert in `fremd` – auch aus `fremd` eines älteren Geräts zurück
  const unterlagen: Unterlage[] = [];
  const fremdeUnterlagen: Record<string, unknown>[] = [];
  const gesehen = new Set<string>();
  for (const u of [...liste(r.unterlagen), ...liste(fremdRoh.unterlagen)]) {
    if (typeof u.id !== "string" || gesehen.has(u.id)) continue;
    gesehen.add(u.id);
    if (typeof u.vorlage === "string" && vorlageFuer(u.vorlage) && istObjekt(u.daten)) unterlagen.push(unterlageAus(u));
    else fremdeUnterlagen.push(u);
  }
  const belege: Beleg[] = [];
  const belegArchiv: Beleg[] = [];
  const fremdeBelege: Record<string, unknown>[] = [];
  const belegGesehen = new Set<string>();
  for (const b of [...liste(r.belege), ...liste(r.belegArchiv), ...liste(fremdRoh.belege)]) {
    if (typeof b.id !== "string" || belegGesehen.has(b.id)) continue;
    belegGesehen.add(b.id);
    const g = belegAus(b);
    if (!g) fremdeBelege.push(b);
    else (g.ungueltig ? belegArchiv : belege).push(g);
  }
  const iso = (w: unknown) => (typeof w === "string" && w ? w : undefined);
  return {
    version: 1,
    betrieb,
    unterlagen,
    belege,
    belegArchiv,
    fremd: { unterlagen: fremdeUnterlagen, belege: fremdeBelege },
    mitarbeiter: personenAus(r.mitarbeiter),
    kunden: personenAus(r.kunden),
    profil: profilAus(r.profil),
    erledigt: erledigtAus(r.erledigt),
    erinnerungen: r.erinnerungen === true,
    appSperre: r.appSperre === true,
    cloudSicherung: r.cloudSicherung === true,
    proTest: r.proTest === true,
    bewertung: bewertungAus(r.bewertung),
    steuerberatung: steuerberatungAus(r.steuerberatung),
    geloescht: isoKarte(r.geloescht),
    zeiten: isoKarte(r.zeiten),
    ...(iso(r.geaendert) ? { geaendert: iso(r.geaendert) } : {}),
    ...(iso(r.letzteSicherung) ? { letzteSicherung: iso(r.letzteSicherung) } : {}),
  };
}

// Formatter einmal anlegen (R9 Performance): ein neuer Intl.DateTimeFormat je Aufruf ist rund 70× langsamer
const TAG_FORMAT = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
// „heute“ ohne Argument wird in Listen je Zeile abgefragt – je Minute einmal berechnen
let heuteZwischen: { minute: number; tag: string } | null = null;

/** Heutiges Datum in Deutschland als YYYY-MM-DD. */
export const heute = (jetzt?: Date) => {
  if (jetzt) return TAG_FORMAT.format(jetzt);
  const ms = Date.now();
  const minute = Math.floor(ms / 60_000);
  if (heuteZwischen?.minute !== minute) heuteZwischen = { minute, tag: TAG_FORMAT.format(new Date(ms)) };
  return heuteZwischen.tag;
};

/** Neuer, leerer Beleg (von Hand oder mit Foto). Kleinunternehmer (§ 19 UStG) starten ohne Vorsteuerabzug. */
export function leererBeleg(quelle: Beleg["quelle"], datei: string | null, kleinunternehmer = false, jetzt = new Date()): Beleg {
  const iso = jetzt.toISOString();
  return { id: neueId(), datum: heute(jetzt), lieferant: "", nummer: null, kategorie: "sonstiges", steuer: [{ satz: 19, brutto_cent: 0 }], vorsteuer: !kleinunternehmer, zahlung: "bank", bezahlt: null, notiz: null, datei, quelle, erstellt: iso, geaendert: iso };
}

/**
 * Zufallsquelle für IDs. Auf dem Gerät setzt schluesselbund.ts `expo-crypto` ein; sonst Web Crypto (Node, Browser).
 * Math.random nur als letzter Ausweg – IDs müssen über Geräte hinweg kollisionsfest sein (Synchronisation).
 */
let idZufall: ((n: number) => Uint8Array) | null = null;
export const idZufallSetzen = (f: (n: number) => Uint8Array) => {
  idZufall = f;
};
function zufallsBytes(n: number): Uint8Array {
  if (idZufall) return idZufall(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint8Array(n));
  return Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
}
/** Neue ID: Zeitstempel (Base36, sortierbar) und 64 Bit Zufall (Base36), nur Kleinbuchstaben und Ziffern. */
export const neueId = () => `${Date.now().toString(36)}${Array.from(zufallsBytes(8), (b) => b.toString(36).padStart(2, "0")).join("")}`;

/** Ist der gespeicherte Text lesbar? Unlesbares darf nicht durch einen leeren Stand überschrieben werden. */
export function istLesbar(json: string | null): boolean {
  if (!json) return true;
  try {
    const roh = JSON.parse(json) as unknown;
    return Boolean(roh && typeof roh === "object");
  } catch {
    return false;
  }
}

/** Nächste fortlaufende Nummer einer Vorlage aus allen vorhandenen Unterlagen (festgeschriebene lassen sich nicht löschen). */
function naechste(s: Stand, vorlageId: string, feld: string, jetzt: Date): string {
  const vorhanden = s.unterlagen.filter((u) => u.vorlage === vorlageId).map((u) => u.daten[feld]).filter((n): n is string => typeof n === "string");
  return naechsteNummer(vorhanden, heute(jetzt).slice(0, 4));
}

const nummerVon = (u: Unterlage) => {
  // eine Konfliktkopie (K1) trägt die Nummer der gültigen Fassung – sie zählt nicht als zweite Unterlage
  if (u.konfliktKopieVon) return "";
  const v = vorlageFuer(u.vorlage);
  return v?.fortlaufend && typeof u.daten[v.fortlaufend] === "string" ? (u.daten[v.fortlaufend] as string).trim() : "";
};
// Häufigkeit je „Vorlage|Nummer“ und „Vorlage|Nummer“ je ID, einmal je Liste berechnet – Listen fragen das für jede
// Zeile ab; beides als Map, damit eine Abfrage O(1) bleibt (R9 Performance: vorher quadratisch über alle Unterlagen)
const nummernZaehler = new WeakMap<Unterlage[], { anzahl: Map<string, number>; jeId: Map<string, string> }>();

/** Gibt es dieselbe Nummer schon in einer anderen Unterlage derselben Vorlage? */
export function nummerDoppelt(s: Stand, u: Unterlage): boolean {
  const n = nummerVon(u);
  if (!n) return false;
  let z = nummernZaehler.get(s.unterlagen);
  if (!z) {
    z = { anzahl: new Map(), jeId: new Map() };
    for (const x of s.unterlagen) {
      const nx = nummerVon(x);
      if (!nx) continue;
      const k = `${x.vorlage}|${nx}`;
      z.anzahl.set(k, (z.anzahl.get(k) ?? 0) + 1);
      z.jeId.set(x.id, k);
    }
    nummernZaehler.set(s.unterlagen, z);
  }
  const k = `${u.vorlage}|${n}`;
  const anzahl = z.anzahl.get(k) ?? 0;
  // u selbst zählt mit, wenn es mit derselben Nummer in der Liste steht
  return anzahl - (z.jeId.get(u.id) === k ? 1 : 0) > 0;
}

export const istFest = (u: Unterlage | undefined) => Boolean(u?.festgeschrieben);

export function anlegen(s: Stand, vorlageId: string, jetzt: Date, id = neueId()): [Stand, Unterlage] {
  const v = vorlageFuer(vorlageId);
  if (!v) throw new Error(`Unbekannte Vorlage: ${vorlageId}`);
  const daten = leereDaten(v, s.betrieb, heute(jetzt));
  // fortlaufende Nummer (Rechnung): aus den vorhandenen Unterlagen derselben Vorlage weiterzählen
  if (v.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  // Startwerte aus dem Pflichten-Check (z. B. Kleinunternehmer), pro Unterlage überschreibbar
  for (const [feld, profilFeld] of Object.entries(v.ausProfil ?? {})) {
    const w = s.profil[profilFeld];
    if (w !== undefined && w !== null && !Array.isArray(w)) daten[feld] = typeof w === "number" ? String(w) : w;
  }
  // Startwerte aus „Mein Betrieb“ (z. B. Soll-/Ist-Versteuerung)
  for (const [feld, betriebsFeld] of Object.entries(v.ausBetrieb ?? {})) {
    const w = s.betrieb[betriebsFeld];
    if (typeof w !== "string" || !w.trim()) continue;
    // Auswahlfelder (z. B. Rechtsform) nur mit einer passenden Option füllen – „GmbH“, „UG“, „e.K.“ gleich ohne Punkte/Leerzeichen
    const def = v.abschnitte.flatMap((a) => a.felder).find((f) => f.id === feld);
    if (def?.art === "wahl") {
      const norm = (x: string) => x.toLowerCase().replace(/[\s.]/g, "");
      const opt = def.optionen.find((o) => norm(o.wert) === norm(w)) ?? def.optionen.find((o) => norm(o.wert).startsWith(norm(w)));
      if (opt) daten[feld] = opt.wert;
    } else daten[feld] = w;
  }
  const u: Unterlage = { id, vorlage: v.id, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

/** Festgeschriebene Unterlagen bleiben, wie sie sind (GoBD, E-127). */
export function aendern(s: Stand, id: string, daten: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id && !u.festgeschrieben ? { ...u, daten, geaendert: jetzt.toISOString() } : u)) };
}

/** Ein Feld setzen (bzw. mehrere) – liest den aktuellen Stand, damit schnelles Tippen nichts verliert. */
export function felderSetzen(s: Stand, id: string, werte: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id && !u.festgeschrieben ? { ...u, daten: { ...u.daten, ...werte }, geaendert: jetzt.toISOString() } : u)) };
}

/**
 * Lässt sich die Unterlage mit genau diesem Inhalt ausgeben (H1)? `daten` ist der Inhalt, aus dem das PDF erzeugt
 * wurde. Hat sich die Unterlage inzwischen geändert (z. B. hat die Synchronisation während des Teilen-Menüs einen
 * neueren Entwurf gebracht), darf nicht festgeschrieben werden – sonst stünde etwas anderes fest, als verschickt wurde.
 */
export function ausgabeMoeglich(s: Stand, id: string, daten?: Daten): boolean {
  const u = s.unterlagen.find((x) => x.id === id);
  if (!u) return false;
  return !daten || Boolean(u.festgeschrieben) || JSON.stringify(u.daten) === JSON.stringify(daten);
}

/**
 * Als PDF geteilt oder gedruckt: merken, und Vorlagen mit `festschreiben` festschreiben. Mit `daten` (Inhalt des PDFs)
 * nur, wenn die Unterlage noch genau diesen Inhalt hat – sonst bleibt der Stand unverändert (siehe `ausgabeMoeglich`).
 */
export function ausgeben(s: Stand, id: string, jetzt: Date, daten?: Daten, pdfSha256?: string): Stand {
  if (!ausgabeMoeglich(s, id, daten)) return s;
  return {
    ...s,
    unterlagen: s.unterlagen.map((u) => {
      if (u.id !== id) return u;
      const fest = vorlageFuer(u.vorlage)?.festschreiben;
      if (u.ausgegeben && (!fest || u.festgeschrieben)) return u;
      const festschreiben = fest && !u.festgeschrieben;
      return { ...u, ausgegeben: u.ausgegeben ?? jetzt.toISOString(), ...(festschreiben ? { festgeschrieben: jetzt.toISOString(), ...(pdfSha256 ? { pdfSha256 } : {}) } : {}) };
    }),
  };
}

/**
 * Storno (E-127): eine festgeschriebene Rechnung wird nicht geändert, sondern durch eine Stornorechnung mit neuer
 * Nummer und negativen Beträgen aufgehoben; die Stornorechnung verweist auf Nummer und Datum der ursprünglichen.
 */
export function stornieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const alt = s.unterlagen.find((u) => u.id === id);
  const v = alt ? vorlageFuer(alt.vorlage) : undefined;
  if (!alt || !v?.storno || !alt.festgeschrieben || alt.storniertDurch || alt.daten.storno_zu || alt.konfliktKopieVon) return [s, null];
  const daten = JSON.parse(JSON.stringify(alt.daten)) as Daten;
  const negativ = (p: unknown) => (typeof p === "string" && p.trim() ? (p.trim().startsWith("-") ? p.trim().slice(1) : `-${p.trim()}`) : p);
  if (Array.isArray(daten.positionen)) daten.positionen = (daten.positionen as Record<string, unknown>[]).map((e) => ({ ...e, preis: negativ(e.preis) })) as Daten[string];
  daten.storno_zu = typeof alt.daten.nummer === "string" ? alt.daten.nummer : "";
  daten.storno_zu_datum = typeof alt.daten.datum === "string" ? alt.daten.datum : null;
  daten.datum = heute(jetzt);
  if (v.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  const u: Unterlage = { id: neu, vorlage: v.id, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString(), stornoZuId: id };
  return [{ ...s, unterlagen: [u, ...s.unterlagen.map((x) => (x.id === id ? { ...x, storniertDurch: neu } : x))] }, u];
}

/** Kopie, z. B. für den nächsten Monat oder einen weiteren Arbeitsbereich. */
export function kopieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const alt = s.unterlagen.find((u) => u.id === id);
  if (!alt) return [s, null];
  const daten = JSON.parse(JSON.stringify(alt.daten)) as Daten;
  const v = vorlageFuer(alt.vorlage);
  // eine kopierte Rechnung bekommt die nächste Nummer – Nummern dürfen nur einmal vorkommen
  if (v?.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  // die Kopie ist ein neuer Entwurf: kein Storno-Bezug, nicht ausgegeben, nicht festgeschrieben
  delete daten.storno_zu;
  delete daten.storno_zu_datum;
  // fortlaufend nummerierte Unterlagen (Rechnung) bekommen das heutige Datum – sonst passt die Nummernfolge nicht
  if (v?.fortlaufend && typeof daten.datum === "string") daten.datum = heute(jetzt);
  const u: Unterlage = { id: neu, vorlage: alt.vorlage, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

/** Löschen – außer festgeschriebene Unterlagen (Korrektur nur per Storno). */
export function loeschen(s: Stand, id: string): Stand {
  const weg = s.unterlagen.find((u) => u.id === id && !u.festgeschrieben);
  if (!weg) return s;
  // ein verworfener Storno-Entwurf gibt die ursprüngliche Rechnung wieder frei
  return { ...vermerken(s, `u:${id}`), unterlagen: s.unterlagen.filter((u) => u.id !== id).map((u) => (u.storniertDurch === id ? (({ storniertDurch: _weg, ...rest }) => rest)(u) : u)) };
}

/** Person aus einer Unterlage merken (gleicher Name ergänzt den vorhandenen Eintrag). */
export function personMerken(s: Stand, art: PersonenArt, angaben: PersonAngaben, id = neueId(), jetzt = new Date()): Stand {
  const k = PERSONEN_LISTE[art];
  const vorher = new Map(s[k].map((p) => [p.id, JSON.stringify(p)]));
  // geänderte oder neue Einträge bekommen einen Zeitstempel – sonst käme eine neue Anschrift beim Synchronisieren nicht an
  const liste = merken(s[k], angaben, id).map((p) => (vorher.get(p.id) === JSON.stringify(p) ? p : { ...p, geaendert: jetzt.toISOString() }));
  return { ...s, [k]: liste };
}

/** Person anlegen oder ändern (Bearbeiten unter „Mein Betrieb“). */
export function personSetzen(s: Stand, art: PersonenArt, p: Person, jetzt = new Date()): Stand {
  const k = PERSONEN_LISTE[art];
  const neu = { ...p, geaendert: jetzt.toISOString() };
  return { ...s, [k]: s[k].some((x) => x.id === p.id) ? s[k].map((x) => (x.id === p.id ? neu : x)) : [...s[k], neu] };
}

export function personLoeschen(s: Stand, art: PersonenArt, id: string): Stand {
  const k = PERSONEN_LISTE[art];
  return { ...vermerken(s, `${art === "mitarbeiter" ? "m" : "k"}:${id}`), [k]: s[k].filter((x) => x.id !== id) };
}

/** Personen alphabetisch. */
export const personenSortiert = (l: Person[]) => [...l].filter((p) => p.name.trim()).sort((a, b) => a.name.localeCompare(b.name, "de"));

/** Antworten im Pflichten-Check setzen. Das Bundesland übernimmt „Mein Betrieb“, solange dort keins steht. */
export function profilSetzen(s: Stand, werte: Stand["profil"], bundeslandName?: string): Stand {
  const betrieb = bundeslandName && !s.betrieb.bundesland ? { ...s.betrieb, bundesland: bundeslandName } : s.betrieb;
  const jetzt = new Date();
  let mit = mitZeit(betrieb === s.betrieb ? s : mitZeit(s, "betrieb", jetzt), "profil", jetzt);
  // je Antwort ein eigener Zeitpunkt (G1): so gehen Antworten auf zwei Geräten beim Synchronisieren nicht verloren
  for (const k of Object.keys(werte)) mit = mitZeit(mit, `profil:${k}`, jetzt);
  return { ...mit, betrieb, profil: { ...s.profil, ...werte } };
}

/** Pflicht abhaken bzw. den Haken entfernen. Wiederkehrende Pflichten gelten nur für einen Termin („Datum|Termin“). */
export function erledigtSetzen(s: Stand, pflichtId: string, datum: string | null, termin?: string | null): Stand {
  const erledigt = { ...s.erledigt };
  if (datum) erledigt[pflichtId] = termin ? `${datum}|${termin}` : datum;
  else delete erledigt[pflichtId];
  // je Pflicht ein eigener Zeitpunkt (G1): Haken auf zwei Geräten an verschiedenen Pflichten bleiben beide
  const jetzt = new Date();
  return { ...mitZeit(mitZeit(s, "erledigt", jetzt), `erledigt:${pflichtId}`, jetzt), erledigt };
}

export function betriebSetzen(s: Stand, b: Betrieb): Stand {
  return { ...mitZeit(s, "betrieb"), betrieb: b };
}

export const steuerberatungSetzen = (s: Stand, sb: Stand["steuerberatung"]): Stand => ({ ...mitZeit(s, "steuerberatung"), steuerberatung: sb });

/** Zuletzt bearbeitete zuerst. */
// je Unterlagenliste einmal sortiert (R9 Performance: Seiten fragen das bei jedem Zeichnen ab) – nicht verändern
const sortiertZwischen = new WeakMap<Unterlage[], Unterlage[]>();
export const sortiert = (s: Stand): Unterlage[] => {
  let l = sortiertZwischen.get(s.unterlagen);
  if (!l) {
    l = [...s.unterlagen].sort((a, b) => b.geaendert.localeCompare(a.geaendert));
    sortiertZwischen.set(s.unterlagen, l);
  }
  return l;
};

/**
 * Inhaltlich gleich wie im JSON (R9 Performance, ersetzt den Vergleich zweier JSON.stringify des ganzen Stands):
 * Gleiche Objekte werden sofort übersprungen – nach dem Zusammenführen ist fast alles noch dasselbe Objekt. Schlüssel
 * mit `undefined` zählen wie fehlende (wie in JSON); die Reihenfolge der Schlüssel spielt keine Rolle.
 */
export function gleicherInhalt(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b) ? true : false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const y = b as unknown[];
    if (a.length !== y.length) return false;
    for (let i = 0; i < a.length; i++) if (!gleicherInhalt(a[i] === undefined ? null : a[i], y[i] === undefined ? null : y[i])) return false;
    return true;
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const k in x) if (x[k] !== undefined && !gleicherInhalt(x[k], y[k])) return false;
  for (const k in y) if (y[k] !== undefined && x[k] === undefined) return false;
  return true;
}

/** Zwei Stände inhaltlich gleich – ohne den Zeitpunkt der letzten Änderung. */
export const standGleich = (a: Stand, b: Stand) => gleicherInhalt({ ...a, geaendert: undefined }, { ...b, geaendert: undefined });

export const betriebFehlt = (b: Betrieb) => !b.name.trim();

/** Zahlungseingang einer Rechnung setzen bzw. entfernen (E-129). */
export function bezahltSetzen(s: Stand, id: string, datum: string | null, jetzt = new Date()): Stand {
  // eigener Zeitstempel: beim Zusammenführen gewinnt so auch das Entfernen einer Zahlung
  const g = jetzt.toISOString();
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id ? (datum ? { ...u, bezahlt: datum, bezahltGeaendert: g } : (({ bezahlt: _weg, ...rest }) => ({ ...rest, bezahltGeaendert: g }))(u)) : u)) };
}

/** Unterlagen, die aufbewahrt werden müssen: festgeschriebene (Rechnungen, Kassenbuch), Belege (auch ungültig markierte) und Unbekanntes. */
export const aufbewahrungspflichtig = (s: Stand): { id: string }[] => [...s.unterlagen.filter((u) => u.festgeschrieben), ...s.belege, ...s.belegArchiv, ...(s.fremd.unterlagen as { id: string }[]), ...(s.fremd.belege as { id: string }[])];

/**
 * Ruhezeit für das Änderungsprotokoll der Belege (H2): War ein Beleg so lange unverändert, wird vor der nächsten
 * Änderung seine bisherige Fassung festgehalten. Tippen in einem Feld erzeugt so nur einen Eintrag, nicht einen je Taste.
 */
export const BELEG_RUHE_MS = 10 * 60 * 1000;
/** So lange nach dem Erfassen darf ein Beleg noch endgültig gelöscht werden (falsch erfasst, doppelt fotografiert). */
export const BELEG_LOESCHBAR_MS = 24 * 60 * 60 * 1000;

/** Beleg anlegen oder ändern (E-133). Änderungen an einem älteren Beleg werden protokolliert (H2). */
export function belegSetzen(s: Stand, b: Beleg, jetzt: Date): Stand {
  const alt = s.belege.find((x) => x.id === b.id);
  // ungültig markierte Belege bleiben, wie sie sind
  if (!alt && s.belegArchiv.some((x) => x.id === b.id)) return s;
  const iso = jetzt.toISOString();
  const historie = [...(alt?.historie ?? [])];
  if (alt && belegInhaltGeaendert(alt, b) && jetzt.getTime() - Date.parse(alt.geaendert) > BELEG_RUHE_MS) historie.push(belegFassung(alt, iso));
  const { historie: _h, ...rest } = b;
  const neu: Beleg = { ...rest, geaendert: iso, ...(historie.length ? { historie } : {}) };
  return { ...s, belege: alt ? s.belege.map((x) => (x.id === b.id ? neu : x)) : [neu, ...s.belege] };
}

/** Darf der Beleg endgültig gelöscht werden? Nur leer (nichts erfasst) oder frisch erfasst – sonst wird er ungültig markiert. */
export function belegEndgueltigLoeschbar(b: Beleg, jetzt = new Date()): boolean {
  const leer = !b.lieferant.trim() && !b.datei && !belegSummen(b).brutto_cent;
  return leer || jetzt.getTime() - Date.parse(b.erstellt) < BELEG_LOESCHBAR_MS;
}

/**
 * Beleg löschen (H2): Leere oder frisch erfasste Belege werden gelöscht (mit Löschvermerk für die Synchronisation).
 * Alle anderen liegen in der Aufbewahrungsfrist – sie werden mit Grund als ungültig markiert und ins Archiv gelegt;
 * Datensatz und Datei bleiben erhalten.
 */
export function belegLoeschen(s: Stand, id: string, jetzt = new Date(), grund = "In der App als ungültig markiert"): Stand {
  const b = s.belege.find((x) => x.id === id);
  if (!b) return s;
  if (belegEndgueltigLoeschbar(b, jetzt)) return { ...vermerken(s, `b:${id}`, jetzt), belege: s.belege.filter((x) => x.id !== id) };
  const iso = jetzt.toISOString();
  return { ...s, belege: s.belege.filter((x) => x.id !== id), belegArchiv: [{ ...b, ungueltig: iso, ungueltig_grund: grund, geaendert: iso }, ...s.belegArchiv.filter((x) => x.id !== id)] };
}

/** Belege nach Belegdatum, neueste zuerst. */
export const belegeSortiert = (s: Stand) => [...s.belege].sort((a, b) => b.datum.localeCompare(a.datum) || b.geaendert.localeCompare(a.geaendert));

/** Seit der letzten Datensicherung geändert (oder nie gesichert)? */
export function ungesichert(s: Stand): boolean {
  if (!s.letzteSicherung) return s.unterlagen.length > 0 || s.belege.length > 0 || s.belegArchiv.length > 0 || s.mitarbeiter.length > 0 || s.kunden.length > 0;
  return Boolean(s.geaendert && s.geaendert > s.letzteSicherung);
}

/**
 * „Alle Daten löschen“ (E-129): Liegen aufbewahrungspflichtige Unterlagen auf dem Gerät, nur mit einer Sicherung,
 * die nach der letzten Änderung erstellt wurde – sonst wären Rechnungen weg, die Jahre aufbewahrt werden müssen.
 */
export const allesLoeschenErlaubt = (s: Stand) => aufbewahrungspflichtig(s).length === 0 || !ungesichert(s);

/** Tage seit der letzten Sicherung, wenn eine fällig ist (ungesicherte Änderungen, älter als `nach` Tage), sonst null. */
export function sicherungFaellig(s: Stand, jetzt: Date, nach = 7): { tage: number | null } | null {
  if (!ungesichert(s) || (s.unterlagen.length === 0 && s.belege.length === 0)) return null;
  if (!s.letzteSicherung) return { tage: null };
  const tage = Math.floor((jetzt.getTime() - Date.parse(s.letzteSicherung)) / 864e5);
  return tage >= nach ? { tage } : null;
}

const istStornoRechnung = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/**
 * Ziel jeder Stornorechnung: über `stornoZuId` (M1), bei älteren Daten über die Nummer – aber nur, wenn sie
 * eindeutig ist (zwei offline vergebene gleiche Nummern dürfen nicht beide als storniert gelten).
 */
function stornoZiele(l: Unterlage[]): Map<string, Unterlage[]> {
  const nachId = new Map(l.map((u) => [u.id, u]));
  const nachNummer = new Map<string, Unterlage[]>();
  for (const x of l) {
    const n = nummerVon(x);
    if (n && !istStornoRechnung(x)) nachNummer.set(`${x.vorlage}|${n}`, [...(nachNummer.get(`${x.vorlage}|${n}`) ?? []), x]);
  }
  const ziele = new Map<string, Unterlage[]>();
  for (const st of l) {
    if (!istStornoRechnung(st) || st.konfliktKopieVon) continue;
    const kandidaten = st.stornoZuId ? [nachId.get(st.stornoZuId)].filter((x): x is Unterlage => Boolean(x)) : (nachNummer.get(`${st.vorlage}|${String(st.daten.storno_zu).trim()}`) ?? []);
    const ziel = kandidaten.length === 1 ? kandidaten[0]! : undefined;
    if (ziel && ziel.id !== st.id) ziele.set(ziel.id, [...(ziele.get(ziel.id) ?? []), st]);
  }
  return ziele;
}

/** Festgeschriebene Stornos einer Rechnung, die zuerst festgeschriebene vorn (eindeutig auf allen Geräten). */
const festeStornos = (stornos: Unterlage[]) => stornos.filter((x) => x.festgeschrieben).sort((a, b) => a.festgeschrieben!.localeCompare(b.festgeschrieben!) || a.id.localeCompare(b.id));

/**
 * Storno-Verweise abgleichen: Verweise auf eine Stornorechnung, die es nicht (mehr) gibt, entfernen – sonst ließe
 * sich die Rechnung nie mehr korrigieren; fehlende Verweise aus den vorhandenen Stornorechnungen ergänzen. Gibt es
 * mehrere Stornos zu einer Rechnung (zwei Geräte offline, K2), zeigt der Verweis auf allen Geräten auf dieselbe:
 * die zuerst festgeschriebene, sonst den Entwurf mit der kleinsten ID.
 */
export function stornoVerweisePruefen(l: Unterlage[]): Unterlage[] {
  const ids = new Set(l.map((u) => u.id));
  const ziele = stornoZiele(l);
  return l.map((u) => {
    const stornos = ziele.get(u.id) ?? [];
    const gewaehlt = festeStornos(stornos)[0] ?? [...stornos].sort((a, b) => a.id.localeCompare(b.id))[0];
    // ohne zuordenbares Storno: einen vorhandenen Verweis nur behalten, wenn die Stornorechnung noch da ist
    // und nicht eindeutig zu einer anderen Rechnung gehört
    const behalten = u.storniertDurch && ids.has(u.storniertDurch) && ![...ziele.entries()].some(([ziel, l2]) => ziel !== u.id && l2.some((x) => x.id === u.storniertDurch)) ? u.storniertDurch : undefined;
    const sd = istStornoRechnung(u) ? behalten : (gewaehlt?.id ?? behalten);
    if (sd === u.storniertDurch) return u;
    if (!sd) return (({ storniertDurch: _weg, ...rest }) => rest)(u);
    return { ...u, storniertDurch: sd };
  });
}

/**
 * Was in Umsatzsteuer-Voranmeldung, EÜR, DATEV-Export und Listen nicht mitzählt (K1, K2): Konfliktkopien und
 * festgeschriebene Stornorechnungen, auf die die stornierte Rechnung nicht verweist (doppelt storniert) – je
 * Ursprungsrechnung zählt nur die Stornorechnung aus `storniertDurch`.
 */
export function nichtZaehlend(l: Unterlage[]): Set<string> {
  const aus = new Set(l.filter((u) => u.konfliktKopieVon).map((u) => u.id));
  const nachId = new Map(l.map((u) => [u.id, u]));
  for (const [ziel, stornos] of stornoZiele(l)) {
    const sd = nachId.get(ziel)?.storniertDurch;
    for (const st of stornos) if (st.id !== sd) aus.add(st.id);
  }
  return aus;
}

/** Nummern von Rechnungen mit mehr als einer festgeschriebenen Stornorechnung (K2). */
export function mehrfachStorniert(l: Unterlage[]): string[] {
  const nachId = new Map(l.map((u) => [u.id, u]));
  return [...stornoZiele(l)].filter(([, st]) => festeStornos(st).length > 1).map(([ziel]) => nummerVon(nachId.get(ziel)!) || ziel).sort();
}

const frueher = (x?: string, y?: string) => (x && y ? (x < y ? x : y) : (x ?? y));

/** Kurzer, auf allen Geräten gleicher Hash (FNV-1a) – für die ID einer Konfliktkopie. */
function kurzHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

export interface Vereinigung {
  u: Unterlage;
  /** zweite, abweichend festgeschriebene Fassung (K1) – als Konfliktkopie unter neuer ID aufzubewahren */
  kopie?: Unterlage;
}

/**
 * Zwei Fassungen derselben Unterlage vereinen (Synchronisation und Wiederherstellen). Festgeschrieben schlägt
 * Entwurf, zwischen Entwürfen gewinnt die zuletzt geänderte Fassung. Sind beide festgeschrieben, wird der Inhalt nie
 * übernommen (K1): Gültig bleibt die zuerst festgeschriebene Fassung; weicht die andere ab, kommt sie als
 * Konfliktkopie zurück. Vermerke werden feldweise vereint: erste Ausgabe und Festschreibung nach dem früheren Datum,
 * ein Storno-Verweis aus jeder Fassung, die Zahlung nach dem Zeitpunkt ihrer letzten Änderung (ohne Zeitpunkt –
 * ältere Daten – bleibt eine vorhandene Zahlung erhalten).
 */
export function unterlagenVereinen(lokal: Unterlage, andere: Unterlage): Vereinigung {
  const fl = Boolean(lokal.festgeschrieben);
  const fa = Boolean(andere.festgeschrieben);
  let basis: Unterlage;
  let kopie: Unterlage | undefined;
  if (fl && fa) {
    const dl = JSON.stringify(lokal.daten);
    const da = JSON.stringify(andere.daten);
    // zuerst festgeschrieben gewinnt; bei gleichem Zeitpunkt entscheidet der Inhalt – auf allen Geräten gleich
    basis = lokal.festgeschrieben! < andere.festgeschrieben! ? lokal : andere.festgeschrieben! < lokal.festgeschrieben! ? andere : dl <= da ? lokal : andere;
    const zweite = basis === lokal ? andere : lokal;
    if (dl !== da) {
      const { storniertDurch: _s, bezahlt: _b, bezahltGeaendert: _bg, ...rest } = zweite;
      kopie = { ...rest, id: `${lokal.id}-konflikt-${kurzHash(JSON.stringify(zweite.daten))}`, konfliktKopieVon: lokal.id };
    }
  } else basis = fl !== fa ? (fl ? lokal : andere) : lokal.geaendert >= andere.geaendert ? lokal : andere;
  const zweite = basis === lokal ? andere : lokal;
  const r: Unterlage = { ...basis };
  const ausgegeben = frueher(lokal.ausgegeben, andere.ausgegeben);
  if (ausgegeben) r.ausgegeben = ausgegeben;
  if (fl && fa) r.festgeschrieben = frueher(lokal.festgeschrieben, andere.festgeschrieben);
  const storno = basis.storniertDurch ?? zweite.storniertDurch;
  if (storno) r.storniertDurch = storno;
  const zl = lokal.bezahltGeaendert ?? "";
  const za = andere.bezahltGeaendert ?? "";
  const quelle = zl || za ? (zl >= za ? lokal : andere) : lokal.bezahlt ? lokal : andere;
  delete r.bezahlt;
  delete r.bezahltGeaendert;
  if (quelle.bezahlt) r.bezahlt = quelle.bezahlt;
  if (quelle.bezahltGeaendert) r.bezahltGeaendert = quelle.bezahltGeaendert;
  return kopie ? { u: r, kopie } : { u: r };
}

/** Wie `unterlagenVereinen`, nur die gültige Fassung. */
export const unterlageVereinen = (lokal: Unterlage, andere: Unterlage): Unterlage => unterlagenVereinen(lokal, andere).u;

/**
 * Unterlagen zweier Stände nach ID vereinen; Konfliktkopien (K1) kommen dazu und werden ihrerseits vereint.
 * Liefert die vereinten Unterlagen und die Nummern (bzw. IDs) der Unterlagen mit Konflikt.
 */
export function unterlagenZusammenfuehren(lokal: Unterlage[], andere: Unterlage[], ueberspringen: (x: Unterlage) => boolean = () => false): { liste: Map<string, Unterlage>; konflikte: string[]; neu: number; aktualisiert: number; behalten: number } {
  const m = new Map(lokal.map((u) => [u.id, u]));
  const konflikte = new Set<string>();
  let neu = 0;
  let aktualisiert = 0;
  let behalten = 0;
  const dazu = (e: Unterlage, zaehlen: boolean) => {
    const l = m.get(e.id);
    if (!l) {
      m.set(e.id, e);
      if (zaehlen) neu++;
      return;
    }
    const v = unterlagenVereinen(l, e);
    m.set(e.id, v.u);
    if (zaehlen) {
      if (JSON.stringify(v.u) === JSON.stringify(l)) behalten++;
      else aktualisiert++;
    }
    if (v.kopie) {
      konflikte.add(nummerVon(v.u) || v.u.id);
      dazu(v.kopie, false);
    }
  };
  for (const e of andere) if (!ueberspringen(e)) dazu(e, true);
  return { liste: m, konflikte: [...konflikte].sort(), neu, aktualisiert, behalten };
}

/** Belege beider Seiten (gültige und ungültig markierte) nach ID: die zuletzt geänderte Fassung gewinnt. */
export function belegeVereinen(a: Beleg[], b: Beleg[]): Map<string, Beleg> {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const l = m.get(x.id);
    if (!l || l.geaendert < x.geaendert) m.set(x.id, x);
  }
  return m;
}

/** Fremdes (unbekannte Vorlagen, unlesbare Belege) beider Seiten nach ID vereinen – nie etwas verlieren. */
export function fremdVereinen(a: Stand["fremd"], b: Stand["fremd"]): Stand["fremd"] {
  const vereinen = (x: Record<string, unknown>[], y: Record<string, unknown>[]) => {
    const m = new Map(x.map((e) => [String(e.id), e]));
    for (const e of y) {
      const l = m.get(String(e.id));
      if (!l || String(l.geaendert ?? "") < String(e.geaendert ?? "")) m.set(String(e.id), e);
    }
    return [...m.values()];
  };
  return { unterlagen: vereinen(a.unterlagen, b.unterlagen), belege: vereinen(a.belege, b.belege) };
}

export interface Zusammenfuehrung {
  stand: Stand;
  neu: number;
  behalten: number;
  aktualisiert: number;
  /** gleiche Nummer in zwei verschiedenen Unterlagen derselben Vorlage */
  nummernKonflikte: string[];
  /** auf zwei Geräten verschieden festgeschrieben (K1): gültig bleibt die zuerst festgeschriebene, die andere ist Konfliktkopie */
  festKonflikte: string[];
  /** Rechnungen mit mehr als einer festgeschriebenen Stornorechnung (K2) */
  mehrfachStorniert: string[];
}

/**
 * Sicherung zurückspielen, ohne Neueres zu verlieren (E-129): Unterlagen werden nach ID zusammengeführt (siehe
 * `unterlagenVereinen`). Was nur auf dem Gerät existiert, bleibt. Auf dem Gerät gelöschte Entwürfe kommen nicht
 * zurück (M7); ausdrücklich wiederhergestellte Belege schon – sie bekommen einen neuen Zeitstempel, damit sie einen
 * Löschvermerk schlagen (H2). Personen, Antworten und Haken werden ergänzt; „Mein Betrieb“ nur übernommen, wenn er leer ist.
 */
export function zusammenfuehren(aktuell: Stand, gesichert: Stand, jetzt = new Date()): Zusammenfuehrung {
  // Löschvermerke für Entwürfe beider Seiten (M7) – festgeschriebene Unterlagen werden nie gelöscht
  const geloescht: Record<string, string> = { ...aktuell.geloescht };
  for (const [k, v] of Object.entries(gesichert.geloescht)) if (k.startsWith("u:") && (!geloescht[k] || v > geloescht[k]!)) geloescht[k] = v;
  const vermerk = (u: Unterlage) => geloescht[`u:${u.id}`];
  const zuletzt = (x: Unterlage) => (x.ausgegeben && x.ausgegeben > x.geaendert ? x.ausgegeben : x.geaendert);
  const weg = (u: Unterlage) => !u.festgeschrieben && Boolean(vermerk(u)) && zuletzt(u) <= vermerk(u)!;
  const u = unterlagenZusammenfuehren(aktuell.unterlagen, gesichert.unterlagen, weg);
  const unterlagen = stornoVerweisePruefen([...u.liste.values()].filter((x) => !weg(x)));

  const personen = (a: Person[], g: Person[]) => [...a, ...g.filter((p) => !a.some((x) => x.id === p.id))];
  // Belege: nach ID, die zuletzt geänderte Fassung gewinnt; nur auf dem Gerät Vorhandenes bleibt
  const lokaleBelege = [...aktuell.belege, ...aktuell.belegArchiv];
  const lokalIds = new Map(lokaleBelege.map((b) => [b.id, b]));
  let neu = u.neu;
  let aktualisiert = u.aktualisiert;
  let behalten = u.behalten;
  const iso = jetzt.toISOString();
  const wieder: Beleg[] = [];
  for (const g of [...gesichert.belege, ...gesichert.belegArchiv]) {
    const a = lokalIds.get(g.id);
    if (!a) {
      neu++;
      // auf dem Gerät (oder einem anderen) gelöscht, jetzt bewusst zurückgeholt: schlägt den Löschvermerk
      if (geloescht[`b:${g.id}`]) {
        delete geloescht[`b:${g.id}`];
        wieder.push({ ...g, geaendert: iso });
      } else wieder.push(g);
    } else if (a.geaendert < g.geaendert) {
      aktualisiert++;
      wieder.push(g);
    } else behalten++;
  }
  const belegNachId = belegeVereinen(lokaleBelege, wieder);
  const alleBelege = [...belegNachId.values()];
  const erledigt = { ...gesichert.erledigt, ...aktuell.erledigt };
  const stand: Stand = {
    ...aktuell,
    betrieb: betriebFehlt(aktuell.betrieb) ? gesichert.betrieb : aktuell.betrieb,
    unterlagen,
    belege: alleBelege.filter((b) => !b.ungueltig),
    belegArchiv: alleBelege.filter((b) => b.ungueltig),
    mitarbeiter: personen(aktuell.mitarbeiter, gesichert.mitarbeiter),
    kunden: personen(aktuell.kunden, gesichert.kunden),
    profil: { ...gesichert.profil, ...aktuell.profil },
    erledigt,
    geloescht,
    fremd: fremdVereinen(aktuell.fremd, gesichert.fremd),
  };
  return { stand, neu, behalten, aktualisiert, nummernKonflikte: nummernKonflikteVon(stand), festKonflikte: u.konflikte, mehrfachStorniert: mehrfachStorniert(stand.unterlagen) };
}

/** Nummern, die in zwei verschiedenen Unterlagen derselben Vorlage vorkommen. */
export function nummernKonflikteVon(s: Stand): string[] {
  return [...new Set(s.unterlagen.filter((u) => nummerDoppelt(s, u)).map(nummerVon))].filter(Boolean).sort();
}
