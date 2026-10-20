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
