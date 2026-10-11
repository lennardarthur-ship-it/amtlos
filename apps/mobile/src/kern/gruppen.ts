import type { Karte } from "./api";

export type Gruppe = "ueberfaellig" | "woche" | "monat" | "spaeter" | "laufend";

/** Pflichten nach Zeithorizont gruppieren – so liest man eine Liste am Handy: was brennt, was diese Woche, was später. */
export function gruppiere(karten: Karte[], heute: string): Record<Gruppe, Karte[]> {
  const tag = (d: string) => Math.round((Date.parse(d) - Date.parse(heute)) / 864e5);
  const g: Record<Gruppe, Karte[]> = { ueberfaellig: [], woche: [], monat: [], spaeter: [], laufend: [] };
  for (const k of karten) {
    if (k.status === "ueberfaellig") g.ueberfaellig.push(k);
    else if (!k.faellig_am) g.laufend.push(k);
    else {
      const n = tag(k.faellig_am);
      (n <= 7 ? g.woche : n <= 31 ? g.monat : g.spaeter).push(k);
    }
  }
  for (const liste of Object.values(g)) liste.sort((a, b) => (a.faellig_am ?? "9999").localeCompare(b.faellig_am ?? "9999"));
  return g;
}
