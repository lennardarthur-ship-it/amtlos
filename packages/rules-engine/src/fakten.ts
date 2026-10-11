import { jahrVon, type Datum } from "@amtlos/fristen";
import type { Fakten } from "./typen.js";

/**
 * Leitet die Fakten `abgeleitet.*` aus den Profil-Fakten ab (fakten.json).
 * Regel: Ist eine Eingangsgröße unbekannt, bleibt auch der abgeleitete Fakt unbekannt (E-033).
 *
 * Bewusst NICHT abgeleitet: die Beschäftigtenzählungen je Gesetz (abgeleitet.beschaeftigte.zaehlung_*).
 * Sie sind [FACHLICH ZU PRÜFEN] (PRUEFLISTE G-05) und bleiben bis zur Freigabe unbekannt,
 * damit Regeln darauf "Angabe fehlt" statt eines falschen Ergebnisses liefern.
 */
export function mitAbgeleitetenFakten(profil: Fakten, stichtag: Datum): Fakten {
  const f: Record<string, unknown> = { ...profil };
  const rechtsform = profil["profil.rechtsform"];
  const einordnung = profil["profil.taetigkeit.einordnung"];
  const gruendung = profil["profil.gruendungsdatum"];
  const beschaeftigte = profil["profil.beschaeftigte.gesamt"];

  if (typeof rechtsform === "string") f["abgeleitet.ist_kapitalgesellschaft"] = rechtsform === "ug" || rechtsform === "gmbh";
  if (typeof einordnung === "string" && einordnung !== "unklar") f["abgeleitet.ist_gewerbe"] = einordnung === "gewerbe";
  if (typeof gruendung === "string") {
    const j = jahrVon(gruendung);
    const s = jahrVon(stichtag);
    f["abgeleitet.ist_gruendungsjahr"] = j === s;
    f["abgeleitet.ist_vorjahr_gruendungsjahr"] = j === s - 1;
  }
  if (typeof beschaeftigte === "number") f["abgeleitet.hat_beschaeftigte"] = beschaeftigte >= 1;
  return f;
}

/** Aus welchen Profil-Fakten ein abgeleiteter Fakt entsteht – damit "Angabe fehlt" nach der richtigen Angabe fragt. */
export const QUELLFAKTEN: Readonly<Record<string, readonly string[]>> = {
  "abgeleitet.ist_kapitalgesellschaft": ["profil.rechtsform"],
  "abgeleitet.ist_gewerbe": ["profil.taetigkeit.einordnung"],
  "abgeleitet.ist_gruendungsjahr": ["profil.gruendungsdatum"],
  "abgeleitet.ist_vorjahr_gruendungsjahr": ["profil.gruendungsdatum"],
  "abgeleitet.hat_beschaeftigte": ["profil.beschaeftigte.gesamt"],
};

/** Ersetzt abgeleitete Fakten durch die Angaben, die der Nutzer machen kann. */
export function zuErfragendeFakten(fakten: Iterable<string>): string[] {
  const ergebnis = new Set<string>();
  for (const f of fakten) for (const q of QUELLFAKTEN[f] ?? [f]) ergebnis.add(q);
  return [...ergebnis];
}
