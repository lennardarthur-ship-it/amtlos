/** Was einer Unterlage noch fehlt – Pflichtangaben der Vorlage plus Prüfungen über alle Unterlagen (doppelte Nummer). */
import { GMBH_ANGABEN, KG_REGISTERGERICHT, KG_REGISTERNUMMER, fehlendeAngaben, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { nummerDoppelt, type Stand, type Unterlage } from "./speicher";

export const NUMMER_DOPPELT = "Rechnungsnummer ist schon vergeben";

/** R12 (Kfz #6): Rechtsform aus dem Pflichten-Check, solange „Mein Betrieb“ keine nennt – für § 35a GmbHG (E-193: und §§ 125, 177a HGB). */
const RECHTSFORM_AUS_CHECK: Record<string, string> = { ug: "UG (haftungsbeschränkt)", gmbh: "GmbH", gmbh_co_kg: "GmbH & Co. KG" };

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
  // E-193 (8a): ebenso Registergericht und -nummer der GmbH & Co. KG selbst (die Komplementärin ist schon eingetragen)
  const fehlt = fehlendeAngaben(v, u.daten, betriebFuerPruefung(s)).filter((x) => eingetragen || !(x.includes(GMBH_ANGABEN) || x === KG_REGISTERGERICHT || x === KG_REGISTERNUMMER));
  return [...fehlt, ...(nummerDoppelt(s, u) ? [NUMMER_DOPPELT] : [])];
}
