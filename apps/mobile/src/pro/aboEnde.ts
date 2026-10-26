/**
 * E-200: Hinweis bei Kündigung bzw. Ende von Pro – die Aufzeichnungs- und Aufbewahrungspflichten laufen weiter, und die
 * Daten lassen sich jederzeit kostenlos exportieren („Daten für Betriebsprüfung exportieren“). Reine Logik, ohne Gerät
 * testbar; der Wortlaut steht in texte.ts (`e200_abo_*`).
 *
 * - „gekündigt“: Pro ist aktiv, der Store meldet aber, dass sich das Abo nicht verlängert (RevenueCat `willRenew` false).
 * - „beendet“: Der Store hat geantwortet, Pro ist nicht (mehr) aktiv, und auf diesem Gerät war Pro schon einmal aktiv
 *   (`Stand.proZuletzt`).
 *
 * Weggetippt wird je Anlass: Der Schlüssel (`aboHinweisSchluessel`) steht in `Stand.aboHinweisGesehen`; ein neuer Anlass
 * (anderes Enddatum, Pro später wieder beendet) zeigt den Hinweis erneut.
 */
import type { AboStand } from "./kauf";

export type AboHinweis = { art: "gekuendigt"; endetAm: string | null; schluessel: string } | { art: "beendet"; schluessel: string };

export function aboHinweis(o: { pro: boolean; proBekannt: boolean; abo: AboStand | null; proZuletzt?: string; gesehen?: string }): AboHinweis | null {
  if (o.pro && o.abo && o.abo.aktiv && !o.abo.verlaengert) {
    const schluessel = `gekuendigt:${o.abo.endetAm ?? ""}`;
    return o.gesehen === schluessel ? null : { art: "gekuendigt", endetAm: o.abo.endetAm, schluessel };
  }
  if (!o.pro && o.proBekannt && o.proZuletzt) {
    const schluessel = `beendet:${o.proZuletzt}`;
    return o.gesehen === schluessel ? null : { art: "beendet", schluessel };
  }
  return null;
}
