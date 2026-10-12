/** Was einer Unterlage noch fehlt – Pflichtangaben der Vorlage plus Prüfungen über alle Unterlagen (doppelte Nummer). */
import { fehlendeAngaben, vorlageFuer } from "@amtlos/fachlogik";
import { nummerDoppelt, type Stand, type Unterlage } from "./speicher";

export const NUMMER_DOPPELT = "Rechnungsnummer ist schon vergeben";

export function fehltFuer(s: Stand, u: Unterlage): string[] {
  const v = vorlageFuer(u.vorlage);
  if (!v) return [];
  return [...fehlendeAngaben(v, u.daten, s.betrieb), ...(nummerDoppelt(s, u) ? [NUMMER_DOPPELT] : [])];
}
