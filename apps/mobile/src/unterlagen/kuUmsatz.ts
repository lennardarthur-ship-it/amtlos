/**
 * Kleinunternehmergrenze (§ 19 Abs. 1, 2 UStG; Steuerberater 22.10.2026, Katalog C.23): „Gesamtumsatz ist die nach
 * vereinnahmten Entgelten berechnete Summe der vom Unternehmer ausgeführten steuerbaren Umsätze“ (§ 19 Abs. 2 Satz 1
 * UStG n. F.) – für Kleinunternehmer immer nach Zufluss, unabhängig von der Versteuerungsart.
 *
 * Aus den Daten auf dem Gerät, in zwei Zählweisen (Steuerberater, Rückmeldung Runde 2):
 * - mit Ersatzregel `finanzen.umsatz.vereinnahmt_laufendes_jahr` / `…_vorjahr` (für die Warnungen 80 %/95 % – vorsichtig):
 *   eine gestellte Rechnung ohne jeden Zahlungsvermerk zählt mit dem Rechnungsdatum, die Warnung kommt so eher zu früh;
 * - ohne offene Rechnungen `finanzen.umsatz.bezahlt_laufendes_jahr` / `…_vorjahr` (für „Grenze überschritten“ und
 *   „ab 1. Januar“): nur tatsächliche Zahlungseingänge – wer zu früh Umsatzsteuer ausweist, schuldet sie nach § 14c
 *   Abs. 2 UStG. Liegt nur die erste Zählung über einer Grenze, zeigt die App den Hinweis
 *   `steuern.kleinunternehmer_grenze_offene_rechnungen`.
 * Beide zählen:
 * - Zahlungseingänge auf gestellte Ausgangsrechnungen (netto, wie in der EÜR: je Zahlung bzw. zum Tag „bezahlt“;
 *   Schlussrechnung mit dem Rest nach Abschlägen; bezahlte Stornos negativ), Gutschriften nicht (keine Umsätze);
 * - Kasseneinnahmen laut Tagesabschlüssen (Tag des Abschlusses), Sachentnahmen (§ 3 Abs. 1b UStG, steuerbar – bestätigt).
 * Nicht gezählt:
 * - nicht steuerbar: Kleinunternehmer-Leistungen an Unternehmen im Ausland (Leistungsort im Ausland, § 3a Abs. 2 UStG)
 *   und OSS-Rechnungen (Ort im Bestimmungsland);
 * - steuerfreie Umsätze (§ 19 Abs. 2 Satz 1 UStG, z. B. Heilbehandlungen nach § 4 Nr. 14 UStG): Positionen zu 0 % einer
 *   Rechnung mit der Steuerart „befreit“ (Hinweis auf die Steuerbefreiung, steuerart.ts) – bei Kleinunternehmer-Rechnungen
 *   nach dem Steuersatz, der an der Position steht, anteilig auf jede Zahlung. Der Nullsteuersatz (§ 12 Abs. 3 UStG) ist
 *   steuerpflichtig und zählt mit;
 * - eine stornierte Rechnung ohne Zahlungsvermerk und ihr Storno ohne Zahlungsvermerk (es floss nichts); teilweise
 *   bezahlte Rechnungen zählen nur mit ihren Zahlungen.
 * Nicht abgezogen, weil die App sie nicht erkennt: Verkäufe von Anlagegütern, die als Rechnung erfasst sind (§ 19 Abs. 2
 * Satz 2 UStG) – dann ist der Wert zu hoch; die Einträge sagen das. Umsätze außerhalb der App (Shop, Plattform, fremde
 * Rechnungen) fehlen.
 */
import { SATZ_NULLSATZ, drittlandLand, eRechnungAus, euUnternehmenLand, kassenUmsatz, restGruppen, sachentnahmenFuer, satzZahl, summen, type RechnungsDaten } from "@amtlos/fachlogik";
import { absenderFuer, type Stand, type Unterlage } from "./speicher";
import { einnahmenAusRechnungen, istKleinunternehmer, umsatzRechnungen } from "./steuerpaket";
import { istOssRechnung } from "./ustAusRechnungen";

export interface VereinnahmterUmsatz {
  /** Gesamtumsatz im Zeitraum in Cent (netto), mit der Ersatzregel für Rechnungen ohne Zahlungsvermerk */
  cent: number;
  /** davon aus Rechnungen ohne Zahlungsvermerk, ersatzweise nach Rechnungsdatum gezählt (`cent − ersatz_cent` = nur Zahlungen) */
  ersatz_cent: number;
  /** so viele Rechnungen ohne Zahlungsvermerk sind darin enthalten */
  ersatz: number;
  /** herausgerechnete steuerfreie Umsätze (Steuerart „befreit“, Positionen zu 0 %) – Zahlungen und Ersatzregel zusammen */
  steuerfrei_cent: number;
}

const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";
const mitZahlungsvermerk = (u: Unterlage | undefined) => Boolean(u && (u.bezahlt || u.zahlungen?.length));

/** Kleinunternehmer-Leistung an ein Unternehmen im Ausland – nicht steuerbar (wie `nicht_steuerbar_cent` der EÜR). */
function nichtSteuerbar(u: Unterlage, steuerart: string | undefined, ku: boolean): boolean {
  return ku && (steuerart === "reverse_charge" || !!euUnternehmenLand(u.daten) || !!drittlandLand(u.daten));
}

/** Rechnungspositionen wie in eRechnungAus (leere Zeilen fallen weg) mit dem eingetragenen Steuersatz. */
const txt = (e: Record<string, unknown>, k: string) => (typeof e[k] === "string" ? (e[k] as string).trim() : "");
const positionenRoh = (u: Unterlage) => (Array.isArray(u.daten.positionen) ? (u.daten.positionen as unknown[]) : []).filter((e): e is Record<string, unknown> => !!e && typeof e === "object").filter((e) => txt(e, "bezeichnung") || txt(e, "preis"));

/**
 * Steuerfreie Positionen einer Kleinunternehmer-Rechnung mit Steuerart „befreit“: Die Rechnungsdaten tragen bei
 * Kleinunternehmern keinen Steuersatz – maßgeblich ist der an der Position gewählte (0 %, nicht Nullsteuersatz). Anteil am Netto.
 */
function kuFreiAnteil(u: Unterlage, daten: RechnungsDaten): number {
  const roh = positionenRoh(u);
  const { zeilen } = summen(daten.positionen, true);
  const gesamt = zeilen.reduce((a, z) => a + z, 0);
  if (!gesamt || roh.length !== zeilen.length) return 0;
  const frei = zeilen.reduce((a, z, i) => {
    const satz = txt(roh[i]!, "satz");
    return a + (satz !== SATZ_NULLSATZ && satzZahl(satz) === 0 ? z : 0);
  }, 0);
  return frei / gesamt;
}

/** Steuerfreier Teil (Steuerart „befreit“, Positionen zu 0 %) von Netto-Gruppen einer Rechnung. */
function freiAusGruppen(u: Unterlage, daten: RechnungsDaten, gruppen: { satz: number | null; netto_cent: number }[]): number {
  if (daten.steuerart !== "befreit") return 0;
  if (!daten.kleinunternehmer) return gruppen.filter((g) => g.satz === 0).reduce((a, g) => a + g.netto_cent, 0);
  return Math.round(gruppen.reduce((a, g) => a + g.netto_cent, 0) * kuFreiAnteil(u, daten));
}

/** Gesamtumsatz nach § 19 Abs. 2 UStG aus den Daten der App für den Zeitraum `von`–`bis` (YYYY-MM-DD). */
export function vereinnahmterUmsatz(s: Stand, von: string, bis: string): VereinnahmterUmsatz {
  const im = (tag: string) => tag >= von && tag <= bis;
  // OSS-Rechnungen (und ihre Stornos) sind im Inland nicht steuerbar
  const oss = new Set(s.unterlagen.filter((u) => u.vorlage === "rechnung" && istOssRechnung(u)).map((u) => u.id));
  const ohneOss: Stand = { ...s, unterlagen: s.unterlagen.filter((u) => !oss.has(u.id) && !(u.stornoZuId && oss.has(u.stornoZuId))) };
  let cent = 0;
  for (const e of einnahmenAusRechnungen(ohneOss)) if (im(e.tag)) cent += e.netto_cent - (e.nicht_steuerbar_cent ?? 0);

  // steuerfreie Umsätze aus Zahlungseingängen: je Rechnung mit Steuerart „befreit“ (auch ihr Storno) die Zahlungen im Zeitraum
  const rechnungen = umsatzRechnungen(ohneOss);
  let freiZahlungen = 0;
  for (const u of rechnungen) {
    const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
    if (daten.steuerart !== "befreit") continue;
    const anteil = daten.kleinunternehmer ? kuFreiAnteil(u, daten) : 0;
    for (const e of einnahmenAusRechnungen({ ...ohneOss, unterlagen: [u] })) {
      if (!im(e.tag) || e.nicht_steuerbar_cent) continue;
      freiZahlungen += e.kleinunternehmer ? Math.round(e.netto_cent * anteil) : (e.steuerfrei_cent ?? 0);
    }
  }

  // Ersatzregel: Rechnungen ohne jeden Zahlungsvermerk mit dem Rechnungsdatum
  const nachId = new Map(ohneOss.unterlagen.map((u) => [u.id, u]));
  let ersatzCent = 0;
  let freiErsatz = 0;
  let ersatz = 0;
  for (const u of rechnungen) {
    if (mitZahlungsvermerk(u) || istStorno(u)) continue;
    // storniert: ohne Zahlungsvermerk floss nichts; ein Storno ohne Zahlungsvermerk zählt deshalb ebenfalls nicht
    if (u.storniertDurch && !mitZahlungsvermerk(nachId.get(u.storniertDurch))) continue;
    const tag = String(u.daten.datum);
    if (!im(tag)) continue;
    const { daten } = eRechnungAus(u.daten, absenderFuer(s, u));
    if (nichtSteuerbar(u, daten.steuerart, daten.kleinunternehmer)) continue;
    const gruppen = restGruppen(daten);
    const freiHier = freiAusGruppen(u, daten, gruppen);
    ersatzCent += gruppen.reduce((a, g) => a + g.netto_cent, 0) - freiHier;
    freiErsatz += freiHier;
    ersatz++;
  }

  // Kasse (Tagesabschlüsse) und Sachentnahmen – wie in der EÜR
  const ku = istKleinunternehmer(s);
  const ka = kassenUmsatz(s.kasse, von, bis, ku);
  const kasse = ku ? ka.je[0].brutto : ka.je[19].netto + ka.je[7].netto + ka.je[0].brutto;
  const se = sachentnahmenFuer(s.sachentnahmen, von, bis);
  return { cent: cent - freiZahlungen + ersatzCent + kasse + se.netto7 + se.netto19, ersatz_cent: ersatzCent, ersatz, steuerfrei_cent: freiZahlungen + freiErsatz };
}

/**
 * Fakten für die Auswertung (Pflichten-Check): Gesamtumsatz des laufenden Jahres bis zum Stichtag und des ganzen
 * Vorjahres, in Euro – `vereinnahmt_*` mit der Ersatzregel für Rechnungen ohne Zahlungsvermerk, `bezahlt_*` nur aus
 * tatsächlichen Zahlungseingängen, Kasse und Sachentnahmen. Nur, wenn in der App Rechnungen gestellt oder
 * Kassenabschlüsse erfasst sind – sonst bleiben die Fakten unbekannt (die Wächter fragen dann nach der Prognose bzw. dem
 * Vorjahresumsatz im Profil).
 */
export function umsatzFakten(s: Stand, stichtag: string): Record<string, number> {
  const daten = umsatzRechnungen(s).length > 0 || s.kasse.some((k) => !k.geschlossen) || s.sachentnahmen.length > 0;
  if (!daten) return {};
  const jahr = Number(stichtag.slice(0, 4));
  const euro = (c: number) => Math.round(c) / 100;
  const lj = vereinnahmterUmsatz(s, `${jahr}-01-01`, stichtag);
  const vj = vereinnahmterUmsatz(s, `${jahr - 1}-01-01`, `${jahr - 1}-12-31`);
  return {
    "finanzen.umsatz.vereinnahmt_laufendes_jahr": euro(lj.cent),
    "finanzen.umsatz.vereinnahmt_vorjahr": euro(vj.cent),
    "finanzen.umsatz.bezahlt_laufendes_jahr": euro(lj.cent - lj.ersatz_cent),
    "finanzen.umsatz.bezahlt_vorjahr": euro(vj.cent - vj.ersatz_cent),
  };
}
