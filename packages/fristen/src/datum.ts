/**
 * Kalenderdaten ohne Uhrzeit und ohne Zeitzone.
 * Fristen sind Kalendertage (docs/02-datenmodell: date für Fristen), daher rechnen wir mit
 * "Epochentagen" (Tage seit 1970-01-01, UTC) und vermeiden jede Abhängigkeit von der lokalen Zeitzone.
 */

/** ISO-Datum `YYYY-MM-DD`. */
export type Datum = string;

const DATUM_MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PRO_TAG = 86_400_000;

export interface Ymd {
  jahr: number;
  monat: number; // 1–12
  tag: number; // 1–31
}

export function zerlege(d: Datum): Ymd {
  const m = DATUM_MUSTER.exec(d);
  if (!m) throw new Error(`Ungültiges Datum: '${d}' (erwartet YYYY-MM-DD)`);
  const ymd = { jahr: Number(m[1]), monat: Number(m[2]), tag: Number(m[3]) };
  if (ymd.monat < 1 || ymd.monat > 12 || ymd.tag < 1 || ymd.tag > tageImMonat(ymd.jahr, ymd.monat)) {
    throw new Error(`Ungültiges Datum: '${d}'`);
  }
  return ymd;
}

export function datum(jahr: number, monat: number, tag: number): Datum {
  if (monat < 1 || monat > 12 || tag < 1 || tag > tageImMonat(jahr, monat)) {
    throw new Error(`Ungültiges Datum: ${jahr}-${monat}-${tag}`);
  }
  return `${String(jahr).padStart(4, "0")}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

export function istGueltig(d: string): d is Datum {
  try {
    zerlege(d);
    return true;
  } catch {
    return false;
  }
}

export function istSchaltjahr(jahr: number): boolean {
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;
}

export function tageImMonat(jahr: number, monat: number): number {
  return [31, istSchaltjahr(jahr) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monat - 1] ?? NaN;
}

export function zuEpochentag(d: Datum): number {
  const { jahr, monat, tag } = zerlege(d);
  return Date.UTC(jahr, monat - 1, tag) / MS_PRO_TAG;
}

export function ausEpochentag(n: number): Datum {
  const dt = new Date(n * MS_PRO_TAG);
  return datum(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function plusTage(d: Datum, tage: number): Datum {
  return ausEpochentag(zuEpochentag(d) + tage);
}

/**
 * Monate addieren mit Monatsende-Regel: Existiert der Tag im Zielmonat nicht,
 * wird der letzte Tag des Zielmonats genommen (31.01. + 1 Monat = 28./29.02.).
 */
export function plusMonate(d: Datum, monate: number): Datum {
  const { jahr, monat, tag } = zerlege(d);
  const index = jahr * 12 + (monat - 1) + monate;
  const zJahr = Math.floor(index / 12);
  const zMonat = (index % 12) + 1;
  return datum(zJahr, zMonat, Math.min(tag, tageImMonat(zJahr, zMonat)));
}

/** 0 = Sonntag … 6 = Samstag (wie Date.getUTCDay). */
export function wochentag(d: Datum): number {
  return (((zuEpochentag(d) + 4) % 7) + 7) % 7; // 1970-01-01 war ein Donnerstag
}

export function vergleiche(a: Datum, b: Datum): number {
  return a < b ? -1 : a > b ? 1 : 0; // ISO-Format ist lexikographisch sortierbar
}

export function differenzTage(von: Datum, bis: Datum): number {
  return zuEpochentag(bis) - zuEpochentag(von);
}

export function letzterTagImMonat(jahr: number, monat: number): Datum {
  return datum(jahr, monat, tageImMonat(jahr, monat));
}

export function jahrVon(d: Datum): number {
  return zerlege(d).jahr;
}
