import type { Vorlage } from "@amtlos/fachlogik";
import { ANDROID } from "../plattform";
import { T as TEXT } from "../texte";
import { bestaetigen } from "../ui/bestaetigen";
import type { Unterlage } from "../unterlagen/speicher";

/**
 * E-193 (4): Android – expo-sharing kehrt auch nach „Zurück“ zurück, und der Druckdialog meldet einen Abbruch nicht. Vor
 * der ersten Festschreibung deshalb nachfragen, ob die Unterlage wirklich hinausging. iPhone und Web: keine Frage (das
 * Teilen-Menü von iOS meldet den Abbruch, E-127); bereits festgeschriebene Unterlagen und Vorlagen ohne Festschreibung
 * ebenso nicht.
 */
export async function versandBestaetigt(u: Pick<Unterlage, "festgeschrieben"> & Partial<Pick<Unterlage, "ausgegeben">>, v: Pick<Vorlage, "festschreiben" | "storno"> & Partial<Pick<Vorlage, "id">>, druck: boolean, android = ANDROID): Promise<boolean> {
  if (!android) return true;
  // E-221 Befund 6: Die erste Ausgabe der Voranmeldung schreibt die Belege ihres Zeitraums fest (R12) – auf Android nur
  // nach Bestätigung, sonst würde ein abgebrochenes Teilen die Belege festschreiben
  if (v.id === "ust_voranmeldung" && !u.ausgegeben) return bestaetigen({ titel: TEXT.e221_va_frage(druck), text: TEXT.e221_va_frage_text, ja: TEXT.e221_va_ja, nein: TEXT.fs_nein });
  if (!v.festschreiben || u.festgeschrieben) return true;
  return bestaetigen({ titel: TEXT.fs_frage(Boolean(v.storno), druck), text: TEXT.fs_frage_text(Boolean(v.storno)), ja: TEXT.fs_ja, nein: TEXT.fs_nein });
}

