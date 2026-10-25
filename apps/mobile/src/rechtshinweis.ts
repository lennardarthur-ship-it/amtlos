/**
 * Phase 1 (RDG, Haftung): Hinweis „keine Rechts- oder Steuerberatung“ mit Rechtsstand – unter dem Ergebnis des
 * Pflichten-Checks, im Pflichten-Tab, in jeder Pflicht, in jedem Vorlagen-Ablauf (außer Rechnungen) und unter
 * „Rechtliches“. Gezeichnet von `RechtsHinweis` (seiten/gemeinsam.tsx).
 *
 * Bewusst nie im PDF: Hygieneplan, Arbeitszeitnachweis, Rechnung usw. sind Unterlagen des Betriebs, die er Kontrolleuren
 * und Kunden vorlegt – ein Hinweis von Amtlos hätte darin nichts zu suchen (vgl. PRUEFHINWEIS in @amtlos/fachlogik).
 */
import { KATALOG } from "./pflichten/check";
import { istGanzGeprueft, istGeprueft, type PruefungRoh } from "./pflichten/pruefer";
import { rechtsstandText } from "./pflichten/rechtsstand";
import { T as TEXT } from "./texte";

export type HinweisArt = "pflichten" | "vorlage" | "recht";

/**
 * E-171: wie viel des Katalogs (geltendes Recht) in der aktuellen Version fachlich geprüft ist. „alle“ nur, wenn jeder
 * Eintrag ohne Einschränkung und ohne offene Prüfpunkte geprüft ist (E-196).
 */
export function katalogGeprueft(pflichten: readonly { version: number; status_recht?: unknown; pruefung?: unknown }[] = KATALOG.pflichten): "keine" | "teil" | "alle" {
  const geltend = pflichten.filter((p) => p.status_recht === undefined || p.status_recht === "in_kraft");
  const n = geltend.filter((p) => istGeprueft(p.version, p.pruefung as PruefungRoh | undefined)).length;
  const ganz = geltend.filter((p) => istGanzGeprueft(p.version, p.pruefung as PruefungRoh | undefined)).length;
  return n === 0 ? "keine" : ganz === geltend.length ? "alle" : "teil";
}

/** Hinweis im Pflichten-Check (Einleitung) passend zum Prüfstand. */
export function checkHinweis(stand = katalogGeprueft()): string {
  return stand === "alle" ? TEXT.check_hinweis_alle : stand === "teil" ? TEXT.check_hinweis_teil : TEXT.check_hinweis;
}

/**
 * Text und Rechtsstand für eine Stelle; `ganz` ist die Zeile für VoiceOver. `pflicht` (Details einer Pflicht): mit dem
 * Vermerk des Prüfers bzw. „noch nicht geprüft“ für genau diese Pflicht.
 */
export function rechtsHinweis(art: HinweisArt, stand = rechtsstandText(), pflicht?: { pruefVermerk: string | null }): { text: string; stand: string; ganz: string } {
  const pruef = katalogGeprueft();
  const text = pflicht
    ? pflicht.pruefVermerk
      ? TEXT.hinweis_pflicht_geprueft(pflicht.pruefVermerk)
      : TEXT.hinweis_pflicht_ungeprueft
    : art === "pflichten"
      ? pruef === "alle"
        ? TEXT.hinweis_pflichten_alle
        : pruef === "teil"
          ? TEXT.hinweis_pflichten_teil
          : TEXT.hinweis_pflichten
      : art === "vorlage"
        ? TEXT.hinweis_vorlage
        : TEXT.hinweis_recht;
  return { text, stand, ganz: `${text} ${stand}.` };
}

/**
 * Vorlagen mit Hinweis: alle außer Rechnung und Stornorechnung – die sind reine Geschäftsvorgänge (Pflichtangaben prüft
 * die App), keine Vorlage für einen rechtlichen Sachverhalt.
 */
export const mitVorlagenHinweis = (v: { kundendokument?: boolean; storno?: boolean }) => !v.kundendokument && !v.storno;
