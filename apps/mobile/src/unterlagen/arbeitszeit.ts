/**
 * R12 (Kurier #11): schneller erfassen im Arbeitszeitnachweis – „nächster Tag mit gleichen Zeiten“ und „Woche
 * kopieren“. Reine Funktionen über den Arbeitstagen; ein eingetragener Monat begrenzt die neuen Tage. Neue Tage tragen
 * keine Zeitstempel – „erfasst am“ setzt die App beim Speichern (speicher.ts, tageStempeln).
 */
import { monatSchluessel, type Eintrag } from "@amtlos/fachlogik";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const plusTage = (iso: string, n: number) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);
const t = (e: Eintrag, k: string) => (typeof e[k] === "string" ? (e[k] as string).trim() : "");
/** Tag mit Uhrzeiten (Beginn und Ende) – nur solche dienen als Muster. */
const mitZeiten = (e: Eintrag) => ISO.test(t(e, "datum")) && Boolean(t(e, "beginn") && t(e, "ende"));

/** Kopie eines Tags mit neuem Datum: Zeiten, Pause und Einsatzort – keine Bemerkung, keine Zeitstempel. */
const kopie = (e: Eintrag, datum: string): Eintrag => ({ datum, beginn: t(e, "beginn"), ende: t(e, "ende"), pause: t(e, "pause"), einsatzort: t(e, "einsatzort"), bemerkung: "" });

/** Liegt der Tag im eingetragenen Monat (wenn einer eingetragen ist)? */
const imMonat = (datum: string, monat: string | null | undefined) => {
  const m = monat ? monatSchluessel(monat) : null;
  return !m || datum.startsWith(m);
};

/**
 * Nächster Tag nach dem letzten Tag mit Zeiten, mit denselben Zeiten. Sonntage überspringt Amtlos, wenn der letzte Tag
 * kein Sonntag war. null, wenn es keinen Tag mit Zeiten gibt oder der nächste Tag nicht mehr im Monat liegt.
 */
export function naechsterTag(tage: readonly Eintrag[], monat?: string | null): Eintrag | null {
  const muster = tage.filter(mitZeiten).sort((a, b) => t(a, "datum").localeCompare(t(b, "datum"))).at(-1);
  if (!muster) return null;
  const letzter = t(muster, "datum");
  const sonntag = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() === 0;
  let datum = plusTage(letzter, 1);
  if (sonntag(datum) && !sonntag(letzter)) datum = plusTage(datum, 1);
  const vorhanden = new Set(tage.map((e) => t(e, "datum")));
  while (vorhanden.has(datum)) datum = plusTage(datum, 1);
  return imMonat(datum, monat) && imMonat(letzter, monat) ? kopie(muster, datum) : null;
}

/**
 * Woche kopieren: die Tage mit Zeiten aus den sieben Tagen bis zum letzten Arbeitstag, je um sieben Tage verschoben –
 * nur Tage, die es noch nicht gibt und die im eingetragenen Monat liegen.
 */
export function wocheKopieren(tage: readonly Eintrag[], monat?: string | null): Eintrag[] {
  const muster = tage.filter(mitZeiten);
  if (!muster.length) return [];
  const letzter = muster.map((e) => t(e, "datum")).sort().at(-1)!;
  const ab = plusTage(letzter, -6);
  const vorhanden = new Set(tage.map((e) => t(e, "datum")));
  return muster
    .filter((e) => t(e, "datum") >= ab)
    .sort((a, b) => t(a, "datum").localeCompare(t(b, "datum")))
    .map((e) => kopie(e, plusTage(t(e, "datum"), 7)))
    .filter((e) => !vorhanden.has(t(e, "datum")) && imMonat(t(e, "datum"), monat));
}
