/**
 * Ablauf der automatischen Sicherung (E-129, E-135, E-143; E-190) – unabhängig davon, wohin gesichert wird: iCloud Drive
 * auf dem iPhone (`cloud.ts`, react-native-cloud-storage) oder ein selbst gewählter Ordner auf Android (`cloud.android.ts`,
 * Speicherzugriffs-Framework). Beide Seiten geben nur einfache Dateioperationen (`Ablage`) vor; Dateinamen, „aktuell“,
 * Tages- und Wochen-Sicherungen, Aufräumen und Belegordner stehen hier einmal. Rein und ohne Gerät testbar
 * (test/android.test.ts mit einer Ablage im Speicher).
 */
import { MARKE } from "@amtlos/marke";
import { schluesselKennung, sicherungsKdf } from "./sicherung";

/** Einfache Dateioperationen auf Pfaden wie „/Amtlos/Datei.amtlos“ (iCloud) bzw. „/Datei.amtlos“ (Ordner auf Android). */
export interface Ablage {
  exists(pfad: string): Promise<boolean>;
  mkdir(pfad: string): Promise<void>;
  readdir(pfad: string): Promise<string[]>;
  readFile(pfad: string): Promise<string>;
  /** Datei schreiben – eine vorhandene wird vollständig ersetzt */
  writeFile(pfad: string, text: string): Promise<void>;
  unlink(pfad: string): Promise<void>;
  rmdir(pfad: string): Promise<void>;
  /**
   * E-209: Herunterladen einer Datei anstoßen, die nur in der Cloud liegt (iCloud: Platzhalter „.<Name>.icloud“, z. B.
   * auf einem neuen iPhone). Ohne diese Funktion (Android-Ordner) lädt der Anbieter beim Lesen selbst.
   */
  herunterladen?(pfad: string): Promise<void>;
}

export interface SicherungsOrt {
  ablage: Ablage;
  /** Ordner der Sicherungen innerhalb der Ablage: „/Amtlos“ in iCloud Drive, „“ (der gewählte Ordner selbst) auf Android */
  ordner: string;
  /**
   * Fehlt die aktuelle Sicherung, die neueste Wochen-Sicherung lesen (Android: dort wird „aktuell“ ersetzt, indem die alte
   * Datei gelöscht und neu angelegt wird – bricht das dazwischen ab, bleibt die Woche).
   */
  ersatzAusWoche?: boolean;
}

const datei = (ordner: string, teil: string) => `${ordner}/${MARKE.name}-Sicherung-${teil}.amtlos`;
/** Name der aktuellen Sicherung im Ordner (unter dem heutigen Markennamen) */
export const aktuellName = (ordner: string) => datei(ordner, "aktuell");
/** Sicherungsdatei mit beliebigem Namenspräfix (auch unter einem früheren Markennamen, z. B. „Amtlos-Sicherung-…“) */
export const SICHERUNG = /^.+-Sicherung-(.+)\.amtlos$/;

/** So viele Wochen-Sicherungen bleiben; ältere werden gelöscht (die aktuelle enthält ohnehin alles). */
export const WOCHEN_BEHALTEN = 12;
/** So viele Tages-Sicherungen bleiben (M8). */
export const TAGE_BEHALTEN = 7;
/** So viele beiseitegelegte Sicherungen („vorher“, z. B. vom alten Gerät) bleiben (G-5). */
export const VORHER_BEHALTEN = 3;

/** ISO-Kalenderwoche für eine Wochen-Sicherung (eine Datei je Woche, die aktuelle wird jedes Mal ersetzt). */
export function kalenderwoche(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahresanfang = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const kw = Math.ceil(((t.getTime() - jahresanfang.getTime()) / 864e5 + 1) / 7);
  return `${t.getUTCFullYear()}-KW${String(kw).padStart(2, "0")}`;
}

/** Tag in Deutschland (YYYY-MM-DD) für die Tages-Sicherung. */
const tag = (jetzt: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(jetzt);

/**
 * Welche Sicherungsdateien im Ordner zu löschen sind – je Art nur die neuesten behalten. Das Namenspräfix (Marke) zählt
 * nicht: sortiert wird nach dem Teil hinter „-Sicherung-“, so zählen auch Sicherungen unter einem früheren Namen mit.
 */
export function zuLoeschen(namen: string[]): string[] {
  const art = (re: RegExp, behalten: number) => {
    const l = namen.map((n) => [n, SICHERUNG.exec(n)?.[1] ?? ""] as const).filter(([, teil]) => re.test(teil)).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : 1));
    return l.slice(0, Math.max(0, l.length - behalten)).map(([n]) => n);
  };
  return [...art(/^\d{4}-KW\d{2}$/, WOCHEN_BEHALTEN), ...art(/^Tag-\d{4}-\d{2}-\d{2}$/, TAGE_BEHALTEN), ...art(/^vorher-[\dT-]+$/, VORHER_BEHALTEN)];
}

/** Pfad der aktuellen Sicherung: unter dem heutigen Namen, sonst die unter einem früheren Namen (Umbenennung der Marke). */
export async function aktuellerPfad(o: SicherungsOrt): Promise<string | null> {
  const { ablage: a, ordner } = o;
  if (await a.exists(aktuellName(ordner))) return aktuellName(ordner);
  if (!(await a.exists(ordner))) return null;
  const namen = await a.readdir(ordner);
  const alt = namen.filter((n) => SICHERUNG.exec(n)?.[1] === "aktuell").sort()[0];
  if (alt) return `${ordner}/${alt}`;
  if (!o.ersatzAusWoche) return null;
  const woche = namen.filter((n) => /^\d{4}-KW\d{2}$/.test(SICHERUNG.exec(n)?.[1] ?? "")).sort((x, y) => (SICHERUNG.exec(x)![1]! < SICHERUNG.exec(y)![1]! ? -1 : 1)).at(-1);
  return woche ? `${ordner}/${woche}` : null;
}

/** E-209: iCloud-Platzhalter einer noch nicht geladenen Datei („.<Name>.icloud“) */
export const platzhalterName = (name: string) => `.${name}.icloud`;
const basisname = (pfad: string) => pfad.slice(pfad.lastIndexOf("/") + 1);
const ordnerVon = (pfad: string) => pfad.slice(0, pfad.lastIndexOf("/"));

/**
 * E-209: Eine vorhandene Sicherung ließ sich nicht lesen (noch nicht aus der Cloud geladen, Lesefehler, 0 Byte) – sie
 * wird dann nie überschrieben. Erst wenn sie lesbar ist oder der Nutzer das Ersetzen ausdrücklich gewählt hat.
 */
export class SicherungUnlesbar extends Error {
  constructor(
    public pfad: string,
    public grund: "platzhalter" | "leer" | "fehler",
  ) {
    super(`Vorhandene Sicherung nicht lesbar (${grund}): ${pfad}`);
  }
}

export type VorhandeneSicherung = { art: "keine" } | { art: "lesbar"; pfad: string; text: string } | { art: "unlesbar"; pfad: string; grund: "platzhalter" | "leer" | "fehler" };

/** Pfad der aktuellen Sicherung – auch, wenn sie nur als iCloud-Platzhalter da ist (E-209). */
async function aktuellOderPlatzhalter(o: SicherungsOrt): Promise<{ pfad: string; platzhalter: boolean } | null> {
  const pfad = await aktuellerPfad(o);
  if (pfad) {
    const namen = await o.ablage.readdir(ordnerVon(pfad) || o.ordner).catch(() => [] as string[]);
    return { pfad, platzhalter: namen.includes(platzhalterName(basisname(pfad))) && !namen.includes(basisname(pfad)) };
  }
  if (!(await o.ablage.exists(o.ordner))) return null;
  const namen = await o.ablage.readdir(o.ordner);
  const p = namen.map((n) => /^\.(.+)\.icloud$/.exec(n)?.[1] ?? "").filter((n) => SICHERUNG.exec(n)?.[1] === "aktuell").sort()[0];
  return p ? { pfad: `${o.ordner}/${p}`, platzhalter: true } : null;
}

/** Datei lesen; null bei Lesefehler, "" bei leerer Datei (0 Byte bzw. nur Leerraum). */
async function versuchen(a: Ablage, pfad: string): Promise<string | null> {
  try {
    const t = await a.readFile(pfad);
    return t.trim() ? t : "";
  } catch {
    return null;
  }
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * E-209: Liegt schon eine Sicherung im Ziel, und lässt sie sich lesen? Für das Einrichten (neues Gerät) und die Wahl eines
 * neuen Ordners. Ein iCloud-Platzhalter oder eine nicht lesbare/leere Datei: Herunterladen anstoßen und einige Male
 * warten (`versuche` × `wartenMs`); bleibt sie unlesbar, „unlesbar“ – dann darf nichts geschrieben werden.
 */
export async function vorhandeneSicherung(o: SicherungsOrt, opt: { versuche?: number; wartenMs?: number; warten?: (ms: number) => Promise<void> } = {}): Promise<VorhandeneSicherung> {
  const versuche = opt.versuche ?? 5;
  const warten = opt.warten ?? pause;
  let ziel: { pfad: string; platzhalter: boolean } | null;
  try {
    ziel = await aktuellOderPlatzhalter(o);
  } catch {
    // Ordner nicht lesbar: im Zweifel als unlesbar behandeln, nichts überschreiben
    return { art: "unlesbar", pfad: aktuellName(o.ordner), grund: "fehler" };
  }
  if (!ziel) return { art: "keine" };
  let grund: "platzhalter" | "leer" | "fehler" = ziel.platzhalter ? "platzhalter" : "fehler";
  for (let i = 0; i < versuche; i++) {
    if (i > 0 || ziel.platzhalter) {
      await o.ablage.herunterladen?.(ziel.pfad).catch(() => undefined);
      await warten(opt.wartenMs ?? 1500);
    }
    const t = await versuchen(o.ablage, ziel.pfad);
    if (t) return { art: "lesbar", pfad: ziel.pfad, text: t };
    if (t === "") grund = "leer";
    else if (!ziel.platzhalter) grund = "fehler";
  }
  return { art: "unlesbar", pfad: ziel.pfad, grund };
}

async function ordnerAnlegen(a: Ablage, ordner: string): Promise<void> {
  // der gewählte Ordner selbst („“) existiert immer
  if (ordner && !(await a.exists(ordner))) await a.mkdir(ordner);
}

/**
 * Sichern: die aktuelle Datei wird jedes Mal ersetzt, die Wochen-Sicherung ebenso (Stand am Ende der Woche). Dazu
 * kommt je Tag eine Sicherung, die nur einmal geschrieben wird – mit dem Stand vom Tagesbeginn (M8): Wer heute
 * versehentlich etwas löscht, findet es in der Sicherung von heute früh bzw. gestern noch.
 */
export async function schreiben(o: SicherungsOrt, text: string, jetzt = new Date(), opt: { ersetzen?: boolean } = {}): Promise<void> {
  const { ablage: a, ordner } = o;
  await ordnerAnlegen(a, ordner);
  const tagesDatei = datei(ordner, `Tag-${tag(jetzt)}`);
  const wochenDatei = datei(ordner, kalenderwoche(jetzt));
  // E-209: Nie eine Sicherung überschreiben, die sich nicht lesen ließ (iCloud-Platzhalter auf einem neuen iPhone,
  // Lesefehler, 0 Byte) – außer der Nutzer hat das Ersetzen ausdrücklich gewählt. Herunterladen wird angestoßen.
  const namen = await a.readdir(ordner).catch(() => [] as string[]);
  const bisher = await aktuellerPfad(o);
  if (!opt.ersetzen) {
    for (const z of [aktuellName(ordner), tagesDatei, wochenDatei, ...(bisher ? [bisher] : [])]) {
      if (namen.includes(platzhalterName(basisname(z))) && !namen.includes(basisname(z))) {
        await a.herunterladen?.(z).catch(() => undefined);
        throw new SicherungUnlesbar(z, "platzhalter");
      }
    }
  }
  const vorher = bisher ? await versuchen(a, bisher) : null;
  if (bisher && !vorher && !opt.ersetzen) {
    await a.herunterladen?.(bisher).catch(() => undefined);
    throw new SicherungUnlesbar(bisher, vorher === "" ? "leer" : "fehler");
  }
  // E-209: eine Sicherung mit anderem Schlüssel (anderes Gerät, anderes Passwort, unbekannter Inhalt) nicht still
  // ersetzen, sondern zuerst beiseitelegen (die letzten VORHER_BEHALTEN bleiben)
  if (vorher && fremdeSicherung(vorher, text)) await beiseitelegen(o, vorher, jetzt);
  if (!(await a.exists(tagesDatei))) {
    // Stand vom Tagesbeginn: die bisherige aktuelle Sicherung, sonst die neue
    await a.writeFile(tagesDatei, vorher || text);
  }
  await a.writeFile(aktuellName(ordner), text);
  await a.writeFile(wochenDatei, text);
  await aufraeumen(o).catch(() => undefined);
}

/** Stammt `alt` von einem anderen Sicherungsschlüssel als `neu` (oder ist es gar keine lesbare Sicherung)? */
function fremdeSicherung(alt: string, neu: string): boolean {
  const ka = sicherungsKdf(alt);
  const kn = sicherungsKdf(neu);
  if (!kn) return false;
  return !ka || schluesselKennung(ka.salz) !== schluesselKennung(kn.salz);
}

/**
 * Aufräumen (E-143, G-5): ältere Wochen-, Tages- und beiseitegelegte Sicherungen löschen und danach die Ordner
 * „Belege-<Kennung>“, auf die keine verbliebene Sicherung mehr verweist (altes Passwort). Der Ordner soll nicht mit
 * jeder Woche um eine volle Kopie wachsen, und alte Kopien sollen nicht unbegrenzt liegen bleiben.
 */
export async function aufraeumen(o: SicherungsOrt): Promise<void> {
  const { ablage: a, ordner } = o;
  const namen = await a.readdir(ordner);
  const weg = new Set(zuLoeschen(namen));
  for (const n of weg) await a.unlink(`${ordner}/${n}`).catch(() => undefined);
  // Kennungen der verbliebenen Sicherungen – nur Belegordner ohne Sicherung werden gelöscht
  const sicherungen = namen.filter((n) => SICHERUNG.test(n) && !weg.has(n));
  const kennungen = new Set<string>();
  for (const n of sicherungen) {
    const text = await a.readFile(`${ordner}/${n}`).catch(() => null);
    const kdf = text ? sicherungsKdf(text) : null;
    // eine unlesbare Sicherung: im Zweifel nichts löschen
    if (!kdf) return;
    kennungen.add(schluesselKennung(kdf.salz));
  }
  if (!kennungen.size) return;
  for (const n of namen) {
    const m = /^Belege-([0-9a-f]+)$/.exec(n);
    if (m && !kennungen.has(m[1]!)) await a.rmdir(`${ordner}/${n}`).catch(() => undefined);
  }
}

/** Letzte Sicherung (oder null). */
export async function lesen(o: SicherungsOrt): Promise<string | null> {
  try {
    const pfad = await aktuellerPfad(o);
    return pfad ? await o.ablage.readFile(pfad) : null;
  } catch {
    return null;
  }
}

/**
 * Belegdateien liegen einzeln im Unterordner „Belege-<Kennung>“ (verschlüsselt mit dem Sicherungsschlüssel) und werden
 * nur einmal hochgeladen – sonst müsste jede automatische Sicherung alle Fotos neu verpacken (Speicher, Akku, Tempo).
 * Je Sicherungsschlüssel ein eigener Ordner (Kennung aus dem Salz): ein neues Passwort mischt sich nie mit alten Dateien.
 */
const belege = (ordner: string, kennung: string) => `${ordner}/Belege-${kennung}`;

/** Namen der schon abgelegten Belegdateien. */
export async function dateien(o: SicherungsOrt, kennung: string): Promise<Set<string>> {
  const p = belege(o.ordner, kennung);
  if (!(await o.ablage.exists(p))) return new Set();
  return new Set((await o.ablage.readdir(p)).map((n) => n.replace(/\.amtlos$/, "")));
}

export async function dateiSchreiben(o: SicherungsOrt, kennung: string, name: string, text: string): Promise<void> {
  const { ablage: a, ordner } = o;
  await ordnerAnlegen(a, ordner);
  if (!(await a.exists(belege(ordner, kennung)))) await a.mkdir(belege(ordner, kennung));
  await a.writeFile(`${belege(ordner, kennung)}/${name}.amtlos`, text);
}

export async function dateiLesen(o: SicherungsOrt, kennung: string, name: string): Promise<string | null> {
  try {
    const pfad = `${belege(o.ordner, kennung)}/${name}.amtlos`;
    if (!(await o.ablage.exists(pfad))) return null;
    return await o.ablage.readFile(pfad);
  } catch {
    return null;
  }
}

/** Vorhandene Sicherung nicht überschreiben, sondern unter neuem Namen beiseitelegen (z. B. beim Einrichten auf einem neuen Gerät). */
export async function beiseitelegen(o: SicherungsOrt, text: string, jetzt = new Date()): Promise<void> {
  await ordnerAnlegen(o.ablage, o.ordner);
  // E-209: eine schon beiseitegelegte Datei derselben Minute nicht überschreiben – eigener Name mit Zähler
  const basis = `vorher-${jetzt.toISOString().slice(0, 16).replace(":", "-")}`;
  let pfad = datei(o.ordner, basis);
  for (let i = 2; (await o.ablage.exists(pfad)) && i < 100; i++) pfad = datei(o.ordner, `${basis}-${i}`);
  await o.ablage.writeFile(pfad, text);
}

/** Bekannte Anbieter der Ordnerauswahl – deren Dokument-IDs sind keine lesbaren Pfade. */
const ANBIETER: Record<string, string> = {
  "com.google.android.apps.docs.storage": "Google Drive",
  "com.android.providers.downloads.documents": "Downloads",
  "org.nextcloud.documents": "Nextcloud",
  "com.nextcloud.client.documents": "Nextcloud",
  "com.owncloud.android.documents": "ownCloud",
  "com.dropbox.product.android.dbapp.document_provider.documents": "Dropbox",
  "com.microsoft.skydrive.content.StorageAccessProvider": "OneDrive",
};

/**
 * Lesbarer Name des gewählten Ordners für „Deine Daten“. Den Anzeigenamen liefert expo-file-system für einen
 * content://-Ordner nicht; auf dem Gerät selbst steht der Pfad in der Dokument-ID („primary:Documents/Sicherung“ →
 * „Sicherung“), bei Cloud-Anbietern ist sie undurchsichtig – dann der Name des Anbieters.
 */
export function ordnerAnzeigeName(uri: string): string {
  const m = /^content:\/\/([^/]+)\/tree\/([^/]+)/.exec(uri);
  if (!m) return "";
  const anbieter = ANBIETER[m[1]!];
  let id = m[2]!;
  try {
    id = decodeURIComponent(id);
  } catch {
    /* roh lassen */
  }
  if (m[1] === "com.android.externalstorage.documents") {
    const [speicher, pfad = ""] = id.split(":");
    return pfad.split("/").filter(Boolean).pop() ?? (speicher === "primary" ? "Interner Speicher" : speicher ?? "");
  }
  return anbieter ?? "Gewählter Ordner";
}
