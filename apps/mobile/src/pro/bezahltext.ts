/**
 * Texte am Kaufknopf des Bezahlschirms (App-Review B2/R3) – rein, damit sie sich testen lassen. Der Preis nach dem
 * Testzeitraum steht gleich groß direkt über dem Knopf („14 Tage kostenlos, danach 49,99 € pro Jahr“); Beträge kommen
 * immer aus dem Store (`priceString`), nie aus dem Code.
 */
import { T as TEXT } from "../texte";
import type { Angebot } from "./kauf";

/** Preiszeile über dem Knopf; null, solange kein Angebot gewählt ist. */
export function preisZeile(a: Pick<Angebot, "preis" | "zeitraum" | "je" | "test"> | undefined): string | null {
  if (!a) return null;
  const je = a.je || a.zeitraum;
  return a.test ? TEXT.pro_test_danach(a.test, a.preis, je) : TEXT.pro_preis_je(a.preis, je);
}

/**
 * Beschriftung des Kaufknopfs; null heißt: kein Kaufknopf. „Pro testweise einschalten“ gibt es nur im Testmodus –
 * ein Store-Build ohne Kauf zeigt gar keinen Knopf.
 */
export function knopfText(o: { kaufAktiv: boolean; testmodus: boolean; gewaehlt?: Pick<Angebot, "test"> }): string | null {
  if (o.kaufAktiv) return o.gewaehlt?.test ? TEXT.pro_test_starten : TEXT.pro_abonnieren;
  return o.testmodus ? TEXT.pro_test_einschalten : null;
}

/**
 * R12 (UX #12): Ersparnis des Jahresabos gegenüber zwölf Monatsabos in ganzen Prozent – nur aus den Store-Preisen;
 * null, wenn einer fehlt oder sich nichts spart.
 */
export function ersparnis(liste: readonly Pick<Angebot, "zeitraum" | "betrag">[]): number | null {
  const jahr = liste.find((a) => a.zeitraum === "jährlich")?.betrag;
  const monat = liste.find((a) => a.zeitraum === "monatlich")?.betrag;
  if (!jahr || !monat) return null;
  const p = Math.floor((1 - jahr / (monat * 12)) * 100);
  return p > 0 ? p : null;
}

/** R12 (UX #12): Monat, ab dem das Freikontingent wieder gilt („November“) – der Monat nach `jetzt` (deutsche Zeit). */
export function naechsterMonat(jetzt: Date): string {
  const [j, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(jetzt).split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(j, m, 1)));
}
