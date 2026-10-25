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

async function ordnerAnlegen(a: Ablage, ordner: string): Promise<void> {
  // der gewählte Ordner selbst („“) existiert immer
  if (ordner && !(await a.exists(ordner))) await a.mkdir(ordner);
}

/**
 * Sichern: die aktuelle Datei wird jedes Mal ersetzt, die Wochen-Sicherung ebenso (Stand am Ende der Woche). Dazu
 * kommt je Tag eine Sicherung, die nur einmal geschrieben wird – mit dem Stand vom Tagesbeginn (M8): Wer heute
 * versehentlich etwas löscht, findet es in der Sicherung von heute früh bzw. gestern noch.
 */
export async function schreiben(o: SicherungsOrt, text: string, jetzt = new Date()): Promise<void> {
  const { ablage: a, ordner } = o;
  await ordnerAnlegen(a, ordner);
  const tagesDatei = datei(ordner, `Tag-${tag(jetzt)}`);
  if (!(await a.exists(tagesDatei))) {
    // Stand vom Tagesbeginn: die bisherige aktuelle Sicherung, sonst die neue
    const bisher = await aktuellerPfad(o);
    const vorher = bisher ? await a.readFile(bisher).catch(() => null) : null;
    await a.writeFile(tagesDatei, vorher ?? text);
  }
  await a.writeFile(aktuellName(ordner), text);
  await a.writeFile(datei(ordner, kalenderwoche(jetzt)), text);
  await aufraeumen(o).catch(() => undefined);
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
  await o.ablage.writeFile(datei(o.ordner, `vorher-${jetzt.toISOString().slice(0, 16).replace(":", "-")}`), text);
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
