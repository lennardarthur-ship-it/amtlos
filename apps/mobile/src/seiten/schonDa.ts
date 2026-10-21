/**
 * R11 (Berater d, Befund 3): „Was hast du schon?“ – nach dem Check für Betriebe, die länger als zwölf Monate bestehen.
 * Wer seit Jahren arbeitet, hat Kasse gemeldet, Impressum online und eine Gefährdungsbeurteilung im Ordner – der
 * Fortschritt soll nicht bei „0 von 34“ beginnen. Reine Funktionen (testbar ohne Oberfläche).
 */
import { istErledigt, type Auswertung, type Erledigt, type PflichtInfo, type Profil } from "../pflichten/check";

/** Ab so vielen Monaten seit Beginn fragt Amtlos nach dem Check, was schon erledigt ist. */
export const LANG_BESTEHEND_MONATE = 12;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function minusMonate(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(j, m - 1 - n, 1));
  // Monatsende beachten (31.03. minus 1 Monat = 28./29.02.)
  const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(t, letzter));
  return d.toISOString().slice(0, 10);
}

/** Besteht der Betrieb laut Check (Gründungsdatum) länger als zwölf Monate? */
export function langBestehend(profil: Profil, stichtag: string): boolean {
  const beginn = profil.gruendungsdatum;
  return typeof beginn === "string" && ISO.test(beginn) && beginn <= minusMonate(stichtag, LANG_BESTEHEND_MONATE);
}

/**
 * Typische Pflichten, die ein bestehender Betrieb längst erfüllt hat: echte Pflichten, die einmal bzw. dauerhaft zu
 * erledigen sind (keine laufenden Termine, keine Aufgaben je neuer Person) und die nicht Lohnbüro oder Steuerberatung
 * übernehmen – noch offen. Sortiert nach Titel.
 */
export function schonDaKandidaten(a: Auswertung, e: Erledigt): PflichtInfo[] {
  return a.gilt
    .filter((p) => p.einordnung === "pflicht" && !p.lohnbuero && !p.wiederkehrend && p.erledigung.art !== "laufend" && !p.personen.length && !istErledigt(p, e))
    .sort((x, y) => x.titel.localeCompare(y.titel, "de"));
}
