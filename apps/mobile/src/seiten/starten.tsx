import { createContext, useCallback, useContext } from "react";
import { useNav, type Nav } from "../ui/navigation";
import { useAktionen } from "../zustand";
import { Ablauf } from "./Ablauf";

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

/** Vorlage antippen = sofort loslegen (E-124): neue Unterlage anlegen und den Ablauf im Vollbild öffnen. */
export function useStarten() {
  // nur die Handlung – Seiten mit diesem Hook zeichnen sonst bei jeder Eingabe neu (R9 Performance)
  const { anlegen } = useAktionen();
  const ziel = useZiel();
  return (vorlageId: string) => {
    const u = anlegen(vorlageId);
    ziel((nav) => nav.oeffnen(`ablauf-${u.id}`, () => <Ablauf id={u.id} neu />, true));
  };
}

/** Bestehende Unterlage öffnen – beim Abschluss mit Vorschau und Übersicht. */
export function useOeffnen() {
  const ziel = useZiel();
  // gleichbleibende Funktion: Listenzeilen (memo) zeichnen sich sonst bei jeder Eingabe neu
  return useCallback((unterlageId: string) => ziel((nav) => nav.oeffnen(`ablauf-${unterlageId}`, () => <Ablauf id={unterlageId} amEnde />, true)), [ziel]);
}
