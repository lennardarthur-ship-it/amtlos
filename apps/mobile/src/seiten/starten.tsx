import { createContext, useCallback, useContext } from "react";
import { useNav, type Nav } from "../ui/navigation";
import { useAktionen, useAmtlosStatus } from "../zustand";
import { ausgabeGrund, erstellenErlaubt } from "../pro/regeln";
import { Ablauf } from "./Ablauf";
import { ProSeite } from "./Pro";

/**
 * Wohin ein Ablauf aufgeht: normalerweise als Blatt über der aktuellen Seite. Aus dem Blatt „Neu erstellen“ heraus
 * ersetzt der Ablauf das Blatt – es ist zum Wählen da, nicht zum Arbeiten.
 */
export const ZielKontext = createContext<((auf: (nav: Nav) => void) => void) | null>(null);

export function useZiel() {
  const nav = useNav();
  const ziel = useContext(ZielKontext);
  return useCallback((auf: (n: Nav) => void) => (ziel ? ziel(auf) : auf(nav)), [nav, ziel]);
}

/**
 * Vorlage antippen = sofort loslegen (E-124): neue Unterlage anlegen und den Ablauf im Vollbild öffnen. E-188: eine
 * neue Unterlage (Rechnung oder Vorlage) anlegen gehört zu Pro – ohne Pro öffnet sich der Bezahlschirm mit Anlass, es
 * entsteht kein leerer Entwurf; nach dem Kauf geht es gleich los.
 */
export function useStarten() {
  // nur die Handlung – Seiten mit diesem Hook zeichnen sonst bei jeder Eingabe neu (R9 Performance)
  const { anlegen } = useAktionen();
  const { pro } = useAmtlosStatus();
  const nav = useNav();
  const ziel = useZiel();
  return (vorlageId: string) => {
    const los = () => {
      // E-219: der Zustand legt ohne Pro nichts an (zweite Sicherung hinter der Sperre unten)
      const u = anlegen(vorlageId);
      if (!u) return void nav.oeffnen("pro", () => <ProSeite grund={ausgabeGrund({ vorlage: vorlageId })} danach={los} />, true);
      ziel((n) => n.oeffnen(`ablauf-${u.id}`, () => <Ablauf id={u.id} neu />, true));
    };
    if (erstellenErlaubt(pro)) return los();
    nav.oeffnen("pro", () => <ProSeite grund={ausgabeGrund({ vorlage: vorlageId })} danach={los} />, true);
  };
}

/** Bestehende Unterlage öffnen – beim Abschluss mit Vorschau und Übersicht. */
export function useOeffnen() {
  const ziel = useZiel();
  // gleichbleibende Funktion: Listenzeilen (memo) zeichnen sich sonst bei jeder Eingabe neu
  return useCallback((unterlageId: string) => ziel((nav) => nav.oeffnen(`ablauf-${unterlageId}`, () => <Ablauf id={unterlageId} amEnde />, true)), [ziel]);
}
