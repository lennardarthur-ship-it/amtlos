/** Was einer Unterlage noch fehlt – Pflichtangaben der Vorlage plus Prüfungen über alle Unterlagen (doppelte Nummer). */
import { GMBH_ANGABEN, fehlendeAngaben, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { nummerDoppelt, type Stand, type Unterlage } from "./speicher";

export const NUMMER_DOPPELT = "Rechnungsnummer ist schon vergeben";

/** R12 (Kfz #6): Rechtsform aus dem Pflichten-Check, solange „Mein Betrieb“ keine nennt – für § 35a GmbHG. */
const RECHTSFORM_AUS_CHECK: Record<string, string> = { ug: "UG (haftungsbeschränkt)", gmbh: "GmbH" };

/** Betrieb für die Prüfung: mit der Rechtsform aus dem Check, wenn in „Mein Betrieb“ keine steht. */
export function betriebFuerPruefung(s: Stand): Betrieb {
  const rf = RECHTSFORM_AUS_CHECK[String(s.profil.rechtsform ?? "")];
  return rf && !(s.betrieb.rechtsform ?? "").trim() ? { ...s.betrieb, rechtsform: rf } : s.betrieb;
}

export function fehltFuer(s: Stand, u: Unterlage): string[] {
  const v = vorlageFuer(u.vorlage);
  if (!v) return [];
  // Gesellschaft noch nicht im Handelsregister: Registergericht und HRB gibt es noch nicht – dann nicht verlangen
  const eingetragen = !["nicht_beantragt", "beantragt"].includes(String(s.profil["gesellschaft.handelsregister"] ?? ""));
  const fehlt = fehlendeAngaben(v, u.daten, betriebFuerPruefung(s)).filter((x) => eingetragen || !x.includes(GMBH_ANGABEN));
  return [...fehlt, ...(nummerDoppelt(s, u) ? [NUMMER_DOPPELT] : [])];
}
