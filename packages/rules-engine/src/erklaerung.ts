import type { Knoten } from "./bedingung.js";
import type { Text } from "./typen.js";

export type Sprache = "de" | "en";

const text = (t: Text | undefined, s: Sprache): string | undefined => (t ? (t[s] ?? t.de) : undefined);

/**
 * Die Sätze, die das Ergebnis tragen ("Diese Pflicht gilt für dich, weil …").
 * - gilt:       bei all alle Kinder, bei any das erste geltende Kind
 * - gilt_nicht: bei all das erste nicht geltende Kind, bei any alle Kinder
 * - unbekannt:  die unbekannten Kinder
 * Ein Knoten mit eigenem Label ersetzt die Sätze seiner Kinder.
 */
export function entscheidendeSaetze(k: Knoten, s: Sprache = "de"): string[] {
  if (k.art === "immer") return [];
  const eigen = "label" in k ? text(k.label, s) : undefined;
  if (k.art === "vergleich" || k.art === "ereignis") return eigen ? [eigen] : [];

  // Bei 'not' kehrt sich die Bedeutung der Kind-Labels um; ohne eigenes Label nichts behaupten.
  if (k.art === "not") return eigen ? [eigen] : [];
  if (eigen) return [eigen];

  let relevant: Knoten[];
  if (k.ergebnis === "unbekannt") relevant = k.kinder.filter((c) => c.ergebnis === "unbekannt");
  else if (k.art === "all") relevant = k.ergebnis === "gilt" ? k.kinder : k.kinder.filter((c) => c.ergebnis === "gilt_nicht").slice(0, 1);
  else relevant = k.ergebnis === "gilt" ? k.kinder.filter((c) => c.ergebnis === "gilt").slice(0, 1) : k.kinder;
  return relevant.flatMap((c) => entscheidendeSaetze(c, s));
}
