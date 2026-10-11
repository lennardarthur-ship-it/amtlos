import type { Ergebnis } from "./typen.js";

/** Dreiwertige Logik nach Kleene (E-033): unbekannt gewinnt nur, wenn nichts eindeutig entscheidet. */
export function und(werte: readonly Ergebnis[]): Ergebnis {
  if (werte.includes("gilt_nicht")) return "gilt_nicht";
  if (werte.includes("unbekannt")) return "unbekannt";
  return "gilt";
}

export function oder(werte: readonly Ergebnis[]): Ergebnis {
  if (werte.includes("gilt")) return "gilt";
  if (werte.includes("unbekannt")) return "unbekannt";
  return "gilt_nicht";
}

export function nicht(wert: Ergebnis): Ergebnis {
  return wert === "gilt" ? "gilt_nicht" : wert === "gilt_nicht" ? "gilt" : "unbekannt";
}

export const ausBool = (b: boolean): Ergebnis => (b ? "gilt" : "gilt_nicht");
