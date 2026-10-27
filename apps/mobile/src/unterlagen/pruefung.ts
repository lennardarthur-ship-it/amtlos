/** Was einer Unterlage noch fehlt – Pflichtangaben der Vorlage plus Prüfungen über alle Unterlagen (doppelte Nummer). */
import { GMBH_ANGABEN, KG_REGISTERGERICHT, KG_REGISTERNUMMER, fehlendeAngaben, offeneLuecken, steuerschuldFuer, vorlageFuer, type Betrieb, type Daten, type Vorlage } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { nummerDoppelt, zeitraumAusText, type Stand, type Unterlage } from "./speicher";

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

/**
 * E-210: Rückfrage vor Teilen, Drucken und „Als Text teilen“, solange der Text Lücken hat („[bitte ergänzen]“, im PDF eine
 * leere Linie) – sonst null. Kundendokumente gehen ohnehin nur vollständig hinaus.
 */
export function lueckenFrage(v: Vorlage, d: Daten, b: Betrieb): { titel: string; text: string; ja: string } | null {
  const n = offeneLuecken(v, d, b);
  return n ? { titel: TEXT.e210_luecken_titel(n), text: TEXT.e210_luecken_text, ja: TEXT.e210_luecken_ja } : null;
}

/**
 * E-224: Rückfrage vor Teilen bzw. Drucken einer Voranmeldung, solange in ihrem Zeitraum Belege mit innergemeinschaftlichem
 * Erwerb oder § 13b ohne Euro-Betrag liegen (fremde Währung ohne Umrechnung, E-221) – sie fehlen in Kz 89/93/61 bzw.
 * 46/47, 84/85, 67. Wie die Rückfrage bei Lücken (E-210): „Trotzdem weitergeben“ oder abbrechen. Sonst null.
 */
export function vaOhneEuroFrage(s: Stand, u: Unterlage): { titel: string; text: string; ja: string } | null {
  if (u.vorlage !== "ust_voranmeldung") return null;
  const z = zeitraumAusText(u.daten.zeitraum);
  if (!z) return null;
  const rc = steuerschuldFuer(s.belege, z.von, z.bis);
  if (!rc.ige_ohne_euro && !rc.ohne_euro) return null;
  const zeilen = [rc.ige_ohne_euro ? TEXT.e224_ige_ohne_euro(rc.ige_ohne_euro) : "", rc.ohne_euro ? TEXT.e224_13b_ohne_euro(rc.ohne_euro) : "", TEXT.e224_frage_text];
  return { titel: TEXT.e224_frage_titel, text: zeilen.filter(Boolean).join("\n\n"), ja: TEXT.e224_frage_ja };
}
