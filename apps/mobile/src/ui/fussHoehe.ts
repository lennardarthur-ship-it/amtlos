import { createContext } from "react";

/**
 * Höhe der Fußleiste der sichtbaren Seite – Meldungen stehen darüber statt auf Feldern oder dem Hauptknopf.
 * Jede `Fuss` meldet ihre Höhe, solange ihre Seite im Fokus ist (null: weg).
 */
export const FussKontext = createContext<((id: string, hoehe: number | null) => void) | null>(null);
