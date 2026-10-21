/**
 * Phase 1 (RDG, Haftung): Hinweis „keine Rechts- oder Steuerberatung“ mit Rechtsstand – unter dem Ergebnis des
 * Pflichten-Checks, im Pflichten-Tab, in jeder Pflicht, in jedem Vorlagen-Ablauf (außer Rechnungen) und unter
 * „Rechtliches“. Gezeichnet von `RechtsHinweis` (seiten/gemeinsam.tsx).
 *
 * Bewusst nie im PDF: Hygieneplan, Arbeitszeitnachweis, Rechnung usw. sind Unterlagen des Betriebs, die er Kontrolleuren
 * und Kunden vorlegt – ein Hinweis von Amtlos hätte darin nichts zu suchen (vgl. PRUEFHINWEIS in @amtlos/fachlogik).
 */
import { rechtsstandText } from "./pflichten/rechtsstand";
import { T as TEXT } from "./texte";

export type HinweisArt = "pflichten" | "vorlage" | "recht";

/** Text und Rechtsstand für eine Stelle; `ganz` ist die Zeile für VoiceOver. */
export function rechtsHinweis(art: HinweisArt, stand = rechtsstandText()): { text: string; stand: string; ganz: string } {
  const text = art === "pflichten" ? TEXT.hinweis_pflichten : art === "vorlage" ? TEXT.hinweis_vorlage : TEXT.hinweis_recht;
  return { text, stand, ganz: `${text} ${stand}.` };
}

/**
 * Vorlagen mit Hinweis: alle außer Rechnung und Stornorechnung – die sind reine Geschäftsvorgänge (Pflichtangaben prüft
 * die App), keine Vorlage für einen rechtlichen Sachverhalt.
 */
export const mitVorlagenHinweis = (v: { kundendokument?: boolean; storno?: boolean }) => !v.kundendokument && !v.storno;
