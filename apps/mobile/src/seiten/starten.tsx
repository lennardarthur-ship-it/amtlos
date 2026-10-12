import { useNav } from "../ui/navigation";
import { useAmtlos } from "../zustand";
import { Ablauf } from "./Ablauf";

/** Vorlage antippen = sofort loslegen (E-124): neue Unterlage anlegen und den Ablauf im Vollbild öffnen. */
export function useStarten() {
  const { anlegen } = useAmtlos();
  const nav = useNav();
  return (vorlageId: string) => {
    const u = anlegen(vorlageId);
    nav.oeffnen(`ablauf-${u.id}`, () => <Ablauf id={u.id} neu />, true);
  };
}

/** Bestehende Unterlage öffnen – beim Abschluss mit Vorschau und Übersicht. */
export function useOeffnen() {
  const nav = useNav();
  return (unterlageId: string) => nav.oeffnen(`ablauf-${unterlageId}`, () => <Ablauf id={unterlageId} amEnde />, true);
}
