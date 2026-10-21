/**
 * Kasse in der App (R12) – reine Funktionen über dem Stand: wann die Kasse angeboten wird, Ruhetage, Abdeckung eines
 * Zeitraums durch Kassenabschlüsse (für Voranmeldung, EÜR, Paket) und Übersicht eines Monats. Die Rechnungen selbst
 * stehen in @amtlos/fachlogik (kasse.ts).
 */
import { fehlendeTage, kassenStandorte, kassenSummen, kassenUmsatz, kassenVerlauf, kassenWarnungen, kontenFuer, standortVon, tageText, zbonLuecken, type Kassenabschluss } from "@amtlos/fachlogik";
import { heute as heuteBerlin, type Stand } from "./speicher";
import type { KasseFuerUst } from "./ustAusRechnungen";

/**
 * Kasse anbieten: elektronische Kasse, offene Ladenkasse (Bargeld ohne elektronische Kasse), Verkauf im Laden oder am
 * Marktstand laut Check – oder es gibt schon Abschlüsse (R12 GoBD: der Marktstand mit offener Ladenkasse fehlte).
 */
export function kasseSichtbar(s: Pick<Stand, "profil" | "kasse">): boolean {
  if (s.kasse.length) return true;
  const k = s.profil["vertrieb.kanaele"];
  return s.profil["kasse.elektronisch"] === true || offeneLadenkasse(s.profil) || (Array.isArray(k) && (k.includes("ladengeschaeft") || k.includes("marktstand")));
}

/**
 * Offene Ladenkasse: laut Check Bargeld-Einnahmen und ausdrücklich keine elektronische Kasse. Nur dann bietet Amtlos den
 * Kassenbericht mit retrograder Ermittlung an – bei einer elektronischen Kasse sind die Einnahmen einzeln
 * aufzuzeichnen (§ 146 Abs. 1 Satz 1, § 146a AO), eine Rückrechnung aus dem Bestand ist dort nicht zulässig.
 */
export const offeneLadenkasse = (profil: Stand["profil"]) => profil["kasse.elektronisch"] === false && profil["kasse.bargeld"] !== false;

/** Ruhetage laut „Kasse“ (Wochentage 0 = Sonntag … 6 = Samstag), im Pflichten-Profil gespeichert (synchronisiert je Antwort). */
export function ruhetage(profil: Stand["profil"]): number[] {
  const w = profil["kasse.ruhetage"];
  return Array.isArray(w) ? w.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6) : [];
}

/** StB-Prüfung (B-9): Kassenüberschuss mit Umsatzsteuer (Erlöse 19 %) – nicht, wenn die Kanzlei ein Ertragskonto ohne Steuer vorgibt. */
export const ueberschussMitUst = (s: Partial<Pick<Stand, "steuerberatung">>) => !s.steuerberatung || !kontenFuer(s.steuerberatung.kontenrahmen, s.steuerberatung.kontenvorgaben).kassendifferenzErtrag;

/** Kassenabschlüsse für `umsaetzeFuer`. */
export const kasseFuerUst = (s: Pick<Stand, "profil" | "kasse"> & Partial<Pick<Stand, "belege" | "sachentnahmen" | "steuerberatung">>, heute = heuteBerlin()): KasseFuerUst => ({
  abschluesse: s.kasse,
  ruhetage: ruhetage(s.profil),
  heute,
  // R12 GoBD: Kassenüberschüsse (wie im Stapel als Erlös 19 %) und Sachentnahmen. StB-Prüfung (B-9): mit Kontenvorgabe
  // „Überschuss auf ein Ertragskonto ohne Umsatzsteuer“ zählen Überschüsse nicht zur Umsatzsteuer
  ueberschuesse: ueberschussMitUst(s) ? kassenWarnungen(s.kasse, s.belege ?? []).differenzen.filter((d) => d.cent > 0) : [],
  sachentnahmen: s.sachentnahmen ?? [],
});

/** Abdeckung eines Zeitraums: gar keine Abschlüsse (null), vollständig (leer) oder die fehlenden Tage. */
export function kassenAbdeckung(s: Pick<Stand, "profil" | "kasse">, von: string, bis: string, heute = heuteBerlin()): string[] | null {
  if (!s.kasse.length) return null;
  return fehlendeTage(s.kasse, von, bis, ruhetage(s.profil), heute);
}

export interface KassenMonat {
  monat: string;
  abschluesse: Kassenabschluss[];
  brutto: number;
  je: ReturnType<typeof kassenUmsatz>["je"];
  bar: number;
  karte: number;
  sonstige: number;
  /** R12 GoBD */
  trinkgeld: number;
  app: number;
  aufrechnung: number;
  gutscheinVerkauf: number;
  gutscheinEinloesung: number;
  ausgabenBar: number;
  entnahmen: number;
  einlagen: number;
  transit: number;
  /** Bestand am Monatsende (bzw. am letzten Tag mit Daten), je Standort („“ = Hauptbetrieb) */
  ende: number | null;
  endeJe: { standort: string; cent: number }[];
  /** Tage mit negativem rechnerischem Bestand (im Monat) */
  negativ: string[];
  differenzen: { datum: string; cent: number }[];
  /** fehlende Tage im Monat zwischen dem ersten Abschluss überhaupt und gestern */
  fehlend: string[];
  fehlendText: string;
  zbonLuecken: string[];
}

const monatsEnde = (monat: string) => new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)), 0)).toISOString().slice(0, 10);

/** Übersicht eines Monats (JJJJ-MM) für die Seite „Kasse“. */
export function kassenMonat(s: Pick<Stand, "profil" | "kasse" | "belege"> & Partial<Pick<Stand, "steuerberatung">>, monat: string, heute = heuteBerlin()): KassenMonat {
  const von = `${monat}-01`;
  const bis = monatsEnde(monat);
  const abschluesse = s.kasse.filter((k) => k.datum >= von && k.datum <= bis);
  const v = kassenVerlauf(s.kasse, s.belege);
  const tage = v.tage.filter((t) => t.datum >= von && t.datum <= bis);
  const sum = (f: (x: ReturnType<typeof kassenSummen>) => number) => abschluesse.reduce((a, k) => a + f(kassenSummen(k)), 0);
  // fehlende Tage ab dem ersten Abschluss überhaupt (je Standort ab seinem ersten Abschluss)
  const erster = s.kasse.reduce<string | null>((m, k) => (!m || k.datum < m ? k.datum : m), null);
  const ab = erster && erster > von ? erster : von;
  const fehlend = erster && erster <= bis ? [...new Set(kassenStandorte(s.kasse).flatMap((st) => {
    const eigene = s.kasse.filter((k) => standortVon(k) === st);
    const e = eigene.reduce((m, k) => (k.datum < m ? k.datum : m), eigene[0]!.datum);
    return fehlendeTage(eigene, e > ab ? e : ab, bis, ruhetage(s.profil), heute);
  }))].sort() : [];
  const vorMonat = v.tage.filter((t) => t.datum <= bis);
  const warnungen = kassenWarnungen(s.kasse, s.belege);
  const endeJe = kassenStandorte(s.kasse).map((st) => {
    const t = kassenVerlauf(s.kasse, s.belege, st).tage.filter((x) => x.datum <= bis);
    return { standort: st, cent: t.length ? t[t.length - 1]!.ende : 0 };
  });
  return {
    monat,
    abschluesse,
    brutto: sum((x) => x.brutto),
    je: kassenUmsatz(s.kasse, von, bis, false, { ueberschuesse: ueberschussMitUst(s) ? warnungen.differenzen.filter((d) => d.cent > 0) : [] }).je,
    bar: sum((x) => x.bar),
    karte: sum((x) => x.karte),
    sonstige: sum((x) => x.sonstige),
    trinkgeld: sum((x) => x.trinkgeld),
    app: sum((x) => x.app),
    aufrechnung: sum((x) => x.aufrechnung),
    gutscheinVerkauf: sum((x) => x.gsVerkaufEz + x.gsVerkaufMz),
    gutscheinEinloesung: sum((x) => x.gsEinlEz + x.gsEinlMz),
    ausgabenBar: tage.reduce((a, t) => a + t.ausgabenBar, 0),
    entnahmen: sum((x) => x.entnahmen),
    einlagen: sum((x) => x.einlagen),
    transit: sum((x) => x.transit),
    ende: vorMonat.length ? vorMonat[vorMonat.length - 1]!.ende : null,
    endeJe,
    negativ: [...new Set(warnungen.negativ.filter((d) => d.datum >= von && d.datum <= bis).map((d) => d.datum))],
    differenzen: warnungen.differenzen.filter((d) => d.datum >= von && d.datum <= bis),
    fehlend,
    fehlendText: fehlend.length ? tageText(fehlend) : "",
    zbonLuecken: zbonLuecken(abschluesse),
  };
}

/** Monate mit Abschlüssen (neueste zuerst), dazu der laufende Monat. */
export function kassenMonate(s: Pick<Stand, "kasse">, heute = heuteBerlin()): string[] {
  return [...new Set([heute.slice(0, 7), ...s.kasse.map((k) => k.datum.slice(0, 7))])].sort((a, b) => b.localeCompare(a));
}

/** Letzter Abschluss (für „Heute“). */
export const letzterAbschluss = (s: Pick<Stand, "kasse">) => (s.kasse.length ? s.kasse.reduce((m, k) => (k.datum > m.datum ? k : m), s.kasse[0]!) : null);
