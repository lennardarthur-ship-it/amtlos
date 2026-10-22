/**
 * Kleinunternehmergrenze (§ 19 Abs. 1, 2 UStG; StB Busch 22.10.2026, Katalog C.23): „Gesamtumsatz ist die nach
 * vereinnahmten Entgelten berechnete Summe der vom Unternehmer ausgeführten steuerbaren Umsätze“ (§ 19 Abs. 2 Satz 1
 * UStG n. F.) – für Kleinunternehmer immer nach Zufluss, unabhängig von der Versteuerungsart.
 *
 * Aus den Daten auf dem Gerät (Fakten `finanzen.umsatz.vereinnahmt_laufendes_jahr` und `…_vorjahr`, fakten.json):
 * - Zahlungseingänge auf gestellte Ausgangsrechnungen (netto, wie in der EÜR: je Zahlung bzw. zum Tag „bezahlt“;
 *   Schlussrechnung mit dem Rest nach Abschlägen; bezahlte Stornos negativ), Gutschriften nicht (keine Umsätze);
 * - Kasseneinnahmen laut Tagesabschlüssen (Tag des Abschlusses), Sachentnahmen (§ 3 Abs. 1b UStG, steuerbar);
 * - nicht steuerbar und daher nicht gezählt: Kleinunternehmer-Leistungen an Unternehmen im Ausland (Leistungsort im
 *   Ausland, § 3a Abs. 2 UStG) und OSS-Rechnungen (Ort im Bestimmungsland);
 * - Ersatzregel (vorsichtig): eine gestellte Rechnung ohne jeden Zahlungsvermerk zählt mit dem Rechnungsdatum – die
 *   Warnung kommt so eher zu früh als zu spät. Eine stornierte Rechnung ohne Zahlungsvermerk und ihr Storno ohne
 *   Zahlungsvermerk zählen nicht (es floss nichts). Teilweise bezahlte Rechnungen zählen nur mit ihren Zahlungen.
 * Nicht abgezogen, obwohl § 19 Abs. 2 UStG sie herausnimmt, weil die App sie nicht unterscheiden kann: steuerfreie
 * Umsätze nach § 4 Nr. 8 i, 9 b, 11–29 UStG (z. B. Heilbehandlungen) und Umsätze mit Anlagevermögen – auch das zählt
 * also eher zu viel als zu wenig. Umsätze außerhalb der App (Shop, Plattform, fremde Rechnungen) fehlen.
 */
import { drittlandLand, eRechnungAus, euUnternehmenLand, kassenUmsatz, restGruppen, sachentnahmenFuer } from "@amtlos/fachlogik";
import { absenderFuer, type Stand, type Unterlage } from "./speicher";
import { einnahmenAusRechnungen, istKleinunternehmer, umsatzRechnungen } from "./steuerpaket";
import { istOssRechnung } from "./ustAusRechnungen";

export interface VereinnahmterUmsatz {
  /** Gesamtumsatz im Zeitraum in Cent (netto) */
  cent: number;
  /** davon aus Rechnungen ohne Zahlungsvermerk, ersatzweise nach Rechnungsdatum gezählt */
  ersatz_cent: number;
  /** so viele Rechnungen ohne Zahlungsvermerk sind darin enthalten */
  ersatz: number;
}

const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";
const mitZahlungsvermerk = (u: Unterlage | undefined) => Boolean(u && (u.bezahlt || u.zahlungen?.length));

/** Kleinunternehmer-Leistung an ein Unternehmen im Ausland – nicht steuerbar (wie `nicht_steuerbar_cent` der EÜR). */
function nichtSteuerbar(u: Unterlage, steuerart: string | undefined, ku: boolean): boolean {
  return ku && (steuerart === "reverse_charge" || !!euUnternehmenLand(u.daten) || !!drittlandLand(u.daten));
}

/** Gesamtumsatz nach § 19 Abs. 2 UStG aus den Daten der App für den Zeitraum `von`–`bis` (YYYY-MM-DD). */
export function vereinnahmterUmsatz(s: Stand, von: string, bis: string): VereinnahmterUmsatz {
  const im = (tag: string) => tag >= von && tag <= bis;
  // OSS-Rechnungen (und ihre Stornos) sind im Inland nicht steuerbar
  const oss = new Set(s.unterlagen.filter((u) => u.vorlage === "rechnung" && istOssRechnung(u)).map((u) => u.id));
  const ohneOss: Stand = { ...s, unterlagen: s.unterlagen.filter((u) => !oss.has(u.id) && !(u.stornoZuId && oss.has(u.stornoZuId))) };
  let cent = 0;
  for (const e of einnahmenAusRechnungen(ohneOss)) if (im(e.tag)) cent += e.netto_cent - (e.nicht_steuerbar_cent ?? 0);

  // Ersatzregel: Rechnungen ohne jeden Zahlungsvermerk mit dem Rechnungsdatum
  const nachId = new Map(ohneOss.unterlagen.map((u) => [u.id, u]));
  let ersatzCent = 0;
  let ersatz = 0;
  for (const u of umsatzRechnungen(ohneOss)) {
    if (mitZahlungsvermerk(u) || istStorno(u)) continue;
    // storniert: ohne Zahlungsvermerk floss nichts; ein Storno ohne Zahlungsvermerk zählt deshalb ebenfalls nicht
    if (u.storniertDurch && !mitZahlungsvermerk(nachId.get(u.storniertDurch))) continue;
    const tag = String(u.daten.datum);
    if (!im(tag)) continue;
    const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
    if (nichtSteuerbar(u, daten.steuerart, daten.kleinunternehmer)) continue;
    ersatzCent += restGruppen(daten).reduce((a, g) => a + g.netto_cent, 0);
    ersatz++;
  }

  // Kasse (Tagesabschlüsse) und Sachentnahmen – wie in der EÜR
  const ku = istKleinunternehmer(s);
  const ka = kassenUmsatz(s.kasse, von, bis, ku);
  const kasse = ku ? ka.je[0].brutto : ka.je[19].netto + ka.je[7].netto + ka.je[0].brutto;
  const se = sachentnahmenFuer(s.sachentnahmen, von, bis);
  return { cent: cent + ersatzCent + kasse + se.netto7 + se.netto19, ersatz_cent: ersatzCent, ersatz };
}

/**
 * Fakten für die Auswertung (Pflichten-Check): vereinnahmter Gesamtumsatz des laufenden Jahres bis zum Stichtag und
 * des ganzen Vorjahres, in Euro. Nur, wenn in der App Rechnungen gestellt oder Kassenabschlüsse erfasst sind – sonst
 * bleiben die Fakten unbekannt (die Wächter fragen dann nach der Prognose bzw. dem Vorjahresumsatz im Profil).
 */
export function umsatzFakten(s: Stand, stichtag: string): Record<string, number> {
  const daten = umsatzRechnungen(s).length > 0 || s.kasse.some((k) => !k.geschlossen) || s.sachentnahmen.length > 0;
  if (!daten) return {};
  const jahr = Number(stichtag.slice(0, 4));
  const euro = (c: number) => Math.round(c) / 100;
  return {
    "finanzen.umsatz.vereinnahmt_laufendes_jahr": euro(vereinnahmterUmsatz(s, `${jahr}-01-01`, stichtag).cent),
    "finanzen.umsatz.vereinnahmt_vorjahr": euro(vereinnahmterUmsatz(s, `${jahr - 1}-01-01`, `${jahr - 1}-12-31`).cent),
  };
}
