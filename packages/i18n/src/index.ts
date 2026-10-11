import { de, type Texte } from "./de";
import { en } from "./en";

export type { Texte };
export * from "./fragen";

export type Sprache = "de" | "en";
export const SPRACHEN: Sprache[] = ["de", "en"];
const TEXTE: Record<Sprache, Texte> = { de, en };

export function texte(s: Sprache): Texte {
  return TEXTE[s];
}

/** Platzhalter {name} ersetzen. */
export function fuelle(vorlage: string, werte: Record<string, string | number>): string {
  return vorlage.replace(/\{(\w+)\}/g, (m, k: string) => (k in werte ? String(werte[k]) : m));
}

export function sprache(wert: string | null | undefined): Sprache {
  return wert?.toLowerCase().startsWith("en") ? "en" : "de";
}

const MONATE: Record<Sprache, string[]> = {
  de: ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** Kalenderdatum (YYYY-MM-DD) ohne Zeitzonen-Verschiebung formatieren. */
export function datumLang(d: string, s: Sprache): string {
  const [j, m, t] = d.split("-").map(Number) as [number, number, number];
  return s === "de" ? `${t}. ${MONATE.de[m - 1]} ${j}` : `${t} ${MONATE.en[m - 1]} ${j}`;
}

export function datumTeile(d: string, s: Sprache): { tag: string; monat: string; jahr: string; wochentag: string } {
  const [j, m, t] = d.split("-").map(Number) as [number, number, number];
  const wt = new Date(Date.UTC(j, m - 1, t)).getUTCDay();
  const tage = s === "de" ? ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { tag: String(t), monat: MONATE[s][m - 1]!, jahr: String(j), wochentag: tage[wt]! };
}
