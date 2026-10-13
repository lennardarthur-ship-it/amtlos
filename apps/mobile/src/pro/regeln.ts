/**
 * Amtlos Pro (E-132) – reine Regeln, ohne Gerät testbar.
 *
 * Kostenlos bleibt alles, was jemand braucht, um Pflichten zu kennen und rechtlich sauber zu bleiben: Pflichten-Check,
 * Erinnerungen, alle Vorlagen ausfüllen und ansehen, Datensicherung als Datei, Wiederherstellen, Storno, erneutes
 * Teilen einer schon geteilten Unterlage. Begrenzt ist nur, wie viele Unterlagen im Monat zum ersten Mal als PDF
 * hinausgehen. Pro schaltet frei, was Zeit spart und was Profis brauchen.
 *
 * Grundsatz (GoBD, Datenschutz): Pro sperrt nie den Zugriff auf eigene Daten, nie eine Korrektur (Storno) und nie die
 * Sicherung – nur zusätzliche Bequemlichkeit.
 */
import type { Betrieb } from "@amtlos/fachlogik";
import type { Unterlage } from "../unterlagen/speicher";

/** Unterlagen, die kostenlos je Kalendermonat zum ersten Mal geteilt oder gedruckt werden dürfen. */
export const FREI_JE_MONAT = 5;

export type ProFunktion = "pdf" | "e_rechnung" | "ust_uebernahme" | "steuerberater" | "icloud" | "sync" | "briefkopf";

/** Reihenfolge und Inhalt der Vorteile auf dem Bezahlschirm. */
export const PRO_VORTEILE: ProFunktion[] = ["pdf", "e_rechnung", "ust_uebernahme", "steuerberater", "sync", "icloud", "briefkopf"];

const monat = (iso: string) => iso.slice(0, 7);
const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/** Im Monat von `jetzt` erstmals ausgegebene Unterlagen (ohne Stornorechnungen – Korrekturen zählen nie). */
export function verbraucht(unterlagen: Unterlage[], jetzt: Date): number {
  const m = jetzt.toISOString().slice(0, 7);
  return unterlagen.filter((u) => u.ausgegeben && monat(u.ausgegeben) === m && !istStorno(u)).length;
}

/** Wie viele kostenlose erste Ausgaben in diesem Monat noch übrig sind. */
export const uebrig = (unterlagen: Unterlage[], jetzt: Date) => Math.max(0, FREI_JE_MONAT - verbraucht(unterlagen, jetzt));

/**
 * Darf diese Unterlage jetzt geteilt oder gedruckt werden? Mit Pro immer; sonst, wenn sie schon einmal ausgegeben
 * wurde, eine Stornorechnung ist oder das Monatskontingent reicht.
 */
export function ausgabeErlaubt(unterlagen: Unterlage[], u: Unterlage, pro: boolean, jetzt: Date): boolean {
  if (pro || u.ausgegeben || istStorno(u)) return true;
  return uebrig(unterlagen, jetzt) > 0;
}

/** Betrieb für Dokumente: Logo und Hausfarbe nur mit Pro – ohne Pro der neutrale Briefkopf (die Angaben bleiben gespeichert). */
export const betriebFuerDokument = (b: Betrieb, pro: boolean): Betrieb => (pro ? b : { ...b, logo: "", farbe: "" });
