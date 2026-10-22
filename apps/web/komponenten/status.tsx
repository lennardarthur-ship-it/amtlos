import { texte, type Sprache } from "@amtlos/i18n";
import type { AnzeigeStatus } from "@/lib/typen";

const FARBE: Record<AnzeigeStatus, string> = {
  ueberfaellig: "text-frist",
  faellig_bald: "text-bald",
  angabe_fehlt: "text-tinte",
  offen: "text-tinte",
  erledigt: "text-erfolg",
  nicht_zutreffend: "text-tinte-leise",
  entfallen: "text-tinte-leise",
};

/** Form + Wort statt nur Farbe (WCAG 1.4.1): voll = überfällig, halb = bald, Fragezeichen = Angabe fehlt, Haken = erledigt, leer = offen. */
export function StatusForm({ status, className = "" }: { status: AnzeigeStatus | "gruen" | "gelb" | "rot"; className?: string }) {
  const p = { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": true, className: `flex-none ${className}` };
  switch (status) {
    case "ueberfaellig":
    case "rot":
      return <svg {...p}><circle cx="6" cy="6" r="5" fill="currentColor" /></svg>;
    case "faellig_bald":
    case "gelb":
      return <svg {...p}><circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 1.75a4.25 4.25 0 0 1 0 8.5z" fill="currentColor" /></svg>;
    case "angabe_fehlt":
      return <svg {...p}><circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.6" /></svg>;
    case "erledigt":
      return <svg {...p}><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "nicht_zutreffend":
    case "entfallen":
      return <svg {...p}><path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
    default:
      return <svg {...p}><circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
  }
}

export function StatusText({ status, sprache }: { status: AnzeigeStatus; sprache: Sprache }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${FARBE[status]}`}>
      <StatusForm status={status} />
      {texte(sprache).status[status]}
    </span>
  );
}
