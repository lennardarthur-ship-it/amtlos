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

  if (typeof rechtsform === "string") {
    f["abgeleitet.ist_kapitalgesellschaft"] = rechtsform === "ug" || rechtsform === "gmbh";
    // R12 (Rechtsprüfung Befund 1): GmbH & Co. KG – keine natürliche Person haftet unbeschränkt (§ 264a HGB, § 15a Abs. 1 S. 3 InsO).
    // E-176: OHG und KG nicht – dort haftet mindestens ein Gesellschafter persönlich unbeschränkt (§ 126, § 161 Abs. 1 HGB)
    f["abgeleitet.ist_kapitalgesellschaft_oder_co_kg"] = rechtsform === "ug" || rechtsform === "gmbh" || rechtsform === "gmbh_co_kg";
    // R12: juristische Personen und eingetragene Personengesellschaften (§ 20 Abs. 1 GwG, Registeranmeldung).
    // E-176: OHG und KG sind zur Eintragung ins Handelsregister anzumelden (§ 106 Abs. 1, § 161 Abs. 2 HGB) – wie GmbH & Co. KG
    f["abgeleitet.ist_eingetragene_gesellschaft"] = ["ug", "gmbh", "gmbh_co_kg", "ohg", "kg", "partg", "partg_mbb"].includes(rechtsform);
    // Freigabe Rechtsanwalt 22.10.2026 (B.16): die GbR ist eingetragene Personengesellschaft erst mit dem Eintrag im
    // Gesellschaftsregister (eGbR, § 707 BGB) – Angabe wie bei den anderen Gesellschaften; ohne Angabe unbekannt (E-033)
    if (rechtsform === "gbr") {
      const register = profil["profil.gesellschaft.handelsregister"];
      if (typeof register === "string") f["abgeleitet.ist_eingetragene_gesellschaft"] = register === "eingetragen";
      else delete f["abgeleitet.ist_eingetragene_gesellschaft"];
    }
  }
  if (typeof einordnung === "string" && einordnung !== "unklar") f["abgeleitet.ist_gewerbe"] = einordnung === "gewerbe";
  if (typeof gruendung === "string") {
    const j = jahrVon(gruendung);
    const s = jahrVon(stichtag);
    f["abgeleitet.ist_gruendungsjahr"] = j === s;
    f["abgeleitet.ist_vorjahr_gruendungsjahr"] = j === s - 1;
    f["abgeleitet.noch_nicht_gestartet"] = gruendung > stichtag; // ISO-Daten sind lexikographisch vergleichbar
  }
  // Steuerberater 22.10.2026: Fristen ab Eröffnung bzw. Aufnahme der Tätigkeit (§ 138 Abs. 4 AO) – eigene Angabe, sonst das
  // Startdatum (die Startfrage lautet „Wann hast du angefangen oder wann willst du anfangen?“)
  const beginn = profil["profil.taetigkeit_beginn"];
  if (typeof beginn === "string") f["abgeleitet.taetigkeit_beginn"] = beginn;
  else if (typeof gruendung === "string") f["abgeleitet.taetigkeit_beginn"] = gruendung;
  if (typeof beschaeftigte === "number") f["abgeleitet.hat_beschaeftigte"] = beschaeftigte >= 1;
  return f;
}

/** Aus welchen Profil-Fakten ein abgeleiteter Fakt entsteht – damit "Angabe fehlt" nach der richtigen Angabe fragt. */
export const QUELLFAKTEN: Readonly<Record<string, readonly string[]>> = {
  "abgeleitet.ist_kapitalgesellschaft": ["profil.rechtsform"],
  "abgeleitet.ist_kapitalgesellschaft_oder_co_kg": ["profil.rechtsform"],
  // bei der GbR entscheidet zusätzlich der Eintrag im Gesellschaftsregister (eGbR)
  "abgeleitet.ist_eingetragene_gesellschaft": ["profil.rechtsform", "profil.gesellschaft.handelsregister"],
  "abgeleitet.ist_gewerbe": ["profil.taetigkeit.einordnung"],
  "abgeleitet.ist_gruendungsjahr": ["profil.gruendungsdatum"],
  "abgeleitet.ist_vorjahr_gruendungsjahr": ["profil.gruendungsdatum"],
  "abgeleitet.noch_nicht_gestartet": ["profil.gruendungsdatum"],
  "abgeleitet.taetigkeit_beginn": ["profil.gruendungsdatum"],
  "abgeleitet.hat_beschaeftigte": ["profil.beschaeftigte.gesamt"],
};

/**
 * Ersetzt abgeleitete Fakten durch die Angaben, die der Nutzer machen kann. Mit `bekannt` entfallen Quellangaben, die
 * schon vorliegen (z. B. die Rechtsform „GbR“, wenn nur der Registereintrag fehlt).
 */
export function zuErfragendeFakten(fakten: Iterable<string>, bekannt?: Fakten): string[] {
  const ergebnis = new Set<string>();
  for (const f of fakten) {
    const quellen = QUELLFAKTEN[f] ?? [f];
    for (const q of quellen) if (!bekannt || quellen.length === 1 || bekannt[q] === undefined || bekannt[q] === null) ergebnis.add(q);
  }
  return [...ergebnis];
}
