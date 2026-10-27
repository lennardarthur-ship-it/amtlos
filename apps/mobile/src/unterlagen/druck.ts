/**
 * E-220 (8b): festgehaltenes HTML einer ausgegebenen Unterlage (siehe ausgabe.ts) – zerlegen und wieder zusammensetzen.
 * Eigene Datei ohne weitere Abhängigkeiten, damit speicher.ts sie beim Festschreiben nutzen kann.
 */
import type { Betrieb } from "@amtlos/fachlogik";

/** Festgehaltenes HTML: Teile in Reihenfolge – Stilblöcke als eigene Teile, das Logo als Platzhalter */
export interface DruckFassung {
  /** Zeitpunkt der Festschreibung (ISO) */
  am: string;
  teile: string[];
}

/** Platzhalter für das Logo im festgehaltenen HTML (das Logo selbst steht im festgehaltenen Absender) – mit „<“, das aus einer Eingabe nie unmaskiert im HTML steht */
export const LOGO_PLATZHALTER = "<amtlos-logo>";

/** Fertiges HTML für die Festschreibung zerlegen: Stilblöcke als eigene Teile, Logo als Platzhalter. */
export function druckFesthalten(html: string, logo: string | undefined, am: string): DruckFassung {
  const l = (logo ?? "").trim();
  const teile = html.split(/(<style[^>]*>[\s\S]*?<\/style>)/).map((t) => (l && !t.startsWith("<style") ? t.split(l).join(LOGO_PLATZHALTER) : t));
  return { am, teile };
}

/** Festgehaltenes HTML wieder zusammensetzen (Logo aus dem festgehaltenen Absender). */
export function druckHtml(f: DruckFassung, absender: Pick<Betrieb, "logo"> | undefined): string {
  const logo = absender?.logo ?? "";
  return f.teile.map((t) => (t.startsWith("<style") ? t : t.split(LOGO_PLATZHALTER).join(logo))).join("");
}

