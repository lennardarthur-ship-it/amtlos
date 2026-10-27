/**
 * E-220 (8b): Ausgegebene Unterlagen unverändert wiedergeben (§ 146 Abs. 4 AO, § 14b UStG – Doppel der Rechnung).
 *
 * Bei der Festschreibung hält die App fest, was gedruckt wurde:
 *   - `absender`: die Angaben aus „Mein Betrieb“ so, wie sie im Dokument standen (nach der Pro-Regel für Logo und
 *     Hausfarbe, `absenderGedruckt`),
 *   - `druck`: das fertige HTML des Dokuments (`druckFesthalten`) – damit bleiben auch Texte gleich, die eine spätere
 *     App-Version anders setzt (Vorlagentext, Fußzeile, Regeln wie die Kleinbetragsrechnung). Die Stilblöcke stehen als
 *     eigene Teile (gleich bei allen Unterlagen, im gespeicherten Stand nur einmal, `kompakt.ts`), das Logo steht nur im
 *     Absender und im HTML als Platzhalter.
 * Wiedergabe (`ausgabeHtml`, `fassungHtml`): festgeschrieben mit `druck` → genau dieses HTML; ohne `druck` (vor E-220
 * festgeschrieben) aus den festgeschriebenen Daten und dem festgehaltenen Absender nachgebildet (`nachgebildet`) – die
 * App sagt das dazu. Entwürfe zeigen immer den heutigen Stand von „Mein Betrieb“.
 *
 * Reine Funktionen (ohne Gerät testbar); Zerlegen und Zusammensetzen des HTML in druck.ts (auch für speicher.ts).
 */
import { dokumentHtml, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { betriebFuerDokument as mitPro } from "../pro/regeln";
import { druckHtml } from "./druck";
import type { Fassung, Stand, Unterlage } from "./speicher";

export { LOGO_PLATZHALTER, druckFesthalten, druckHtml, type DruckFassung } from "./druck";

/** Betrieb, mit dem eine Unterlage gedruckt wird: festgeschrieben der festgehaltene, sonst „Mein Betrieb“ heute. */
export function druckBetrieb(s: Pick<Stand, "betrieb">, u: Pick<Unterlage, "festgeschrieben" | "absender" | "absenderGedruckt">, pro: boolean): Betrieb {
  if (u.festgeschrieben && u.absender) return u.absenderGedruckt ? u.absender : mitPro(u.absender, pro);
  return mitPro(s.betrieb, pro);
}

/** HTML einer Unterlage zum Anzeigen, Teilen, Drucken und für Pakete – festgeschrieben genau wie ausgegeben. */
export function ausgabeHtml(s: Pick<Stand, "betrieb">, u: Unterlage, pro: boolean): string {
  if (u.festgeschrieben && u.druck) return druckHtml(u.druck, u.absender);
  const v = vorlageFuer(u.vorlage);
  if (!v) return "";
  return dokumentHtml(v, u.daten, druckBetrieb(s, u, pro));
}

/** HTML einer früheren Fassung (Nachweise mit Korrektur, Kassenbuch) – mit ihrem eigenen Absender. */
export function fassungHtml(s: Pick<Stand, "betrieb">, vorlage: string, f: Fassung, pro: boolean): string {
  if (f.druck) return druckHtml(f.druck, f.absender);
  const v = vorlageFuer(vorlage);
  if (!v) return "";
  return dokumentHtml(v, f.daten, f.absender ? (f.absenderGedruckt ? f.absender : mitPro(f.absender, pro)) : mitPro(s.betrieb, pro));
}

/**
 * Festgeschrieben, aber ohne festgehaltenes HTML (vor E-220): Die Wiedergabe ist aus den festgeschriebenen Daten
 * nachgebildet. `nachgetragen`: der Absender stammt nicht aus der Festschreibung, sondern wurde beim ersten Öffnen mit
 * dieser Version aus „Mein Betrieb“ übernommen (Zeitpunkt).
 */
export function nachgebildet(u: Pick<Unterlage, "festgeschrieben" | "druck" | "absenderNachgetragen">): { nachgetragen?: string } | null {
  if (!u.festgeschrieben || u.druck) return null;
  return u.absenderNachgetragen ? { nachgetragen: u.absenderNachgetragen } : {};
}
