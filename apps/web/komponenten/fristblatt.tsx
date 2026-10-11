import { datumTeile, type Sprache } from "@amtlos/i18n";
import type { AnzeigeStatus } from "@/lib/typen";

/**
 * Das Fristblatt: Datum wie auf einem Abreißkalender, Bindestreifen in der Statusfarbe.
 * Die Farbe trägt nie allein Bedeutung – Status steht immer zusätzlich als Text daneben (WCAG 1.4.1).
 */
export function Fristblatt({ datum, status, sprache }: { datum: string | null; status: AnzeigeStatus; sprache: Sprache }) {
  if (!datum) {
    return (
      <div className="fristblatt" data-status={status} data-ohne-datum aria-hidden="true">
        <span className="fristblatt-wochentag">&nbsp;</span>
        <span className="fristblatt-tag text-tinte-leise">{status === "angabe_fehlt" ? "?" : "–"}</span>
        <span className="fristblatt-monat">&nbsp;</span>
      </div>
    );
  }
  const d = datumTeile(datum, sprache);
  return (
    <div className="fristblatt" data-status={status} aria-hidden="true">
      <span className="fristblatt-wochentag">{d.wochentag}</span>
      <span className="fristblatt-tag">{d.tag}</span>
      <span className="fristblatt-monat">{d.monat}</span>
    </div>
  );
}
