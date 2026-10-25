/**
 * StB-Prüfung Steuerberatungskanzlei (21.10.2026, 5.2, C-9): OSS-Erklärung und Zusammenfassende Meldung aus den geteilten
 * Rechnungen – Übertragungshilfe wie die Voranmeldung, die App übermittelt nichts.
 *
 * - OSS (§ 18j UStG): Rechnungen mit dem Schalter „OSS“ (Steuer des Bestimmungslands) je Land und Steuersatz, im
 *   Quartal der Zuordnung wie in der Voranmeldung (Soll: Leistung, Ist: Zahlung; Stornos im Zeitraum des Stornos).
 * - ZM (§ 18a UStG): innergemeinschaftliche Lieferungen („L“) im Zeitraum der Rechnung, spätestens im Monat nach der
 *   Lieferung (§ 18a Abs. 8 UStG); sonstige Leistungen an Unternehmen im EU-Ausland mit Steuerschuldnerschaft des
 *   Empfängers („S“) im Zeitraum der Ausführung. Je USt-IdNr. und Art, in vollen Euro. Kleinunternehmer melden nicht.
 *
 * Gutschriften (der Betrieb ist Leistungsempfänger) zählen nicht. Fachlich zu prüfen: Zuordnung der ZM bei Teil- und
 * Anzahlungen.
 */
import { eRechnungAus, istEuAusland, restGruppen, ustZeitraum, type Betrieb, type RechnungsDaten } from "@amtlos/fachlogik";
import type { Unterlage } from "./speicher";
import { istGutschrift, periodeText, zuordnungsTage, type Versteuerung } from "./ustAusRechnungen";

const betragText = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);
const quartal = (tag: string) => `${tag.slice(0, 4)}-Q${Math.floor((Number(tag.slice(5, 7)) - 1) / 3) + 1}`;
const istStorno = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";
/** letzter Tag des Monats nach dem Tag (ISO) */
const endeFolgemonat = (tag: string) => new Date(Date.UTC(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)) + 1, 0)).toISOString().slice(0, 10);

interface Posten {
  u: Unterlage;
  daten: RechnungsDaten;
  tag: string;
  vz: number;
}

/** Geteilte Rechnungen (ohne Gutschriften, ohne Kleinunternehmer-Rechnungen) mit dem Tag ihrer Zuordnung */
function posten(unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung): Posten[] {
  const tage = zuordnungsTage(unterlagen, betrieb, v);
  return unterlagen
    .filter((u) => tage.has(u.id) && !istGutschrift(u) && u.daten.kleinunternehmer !== true)
    .map((u) => {
      const { daten } = eRechnungAus(u.daten, betrieb);
      return { u, daten, tag: tage.get(u.id) ?? "", vz: daten.art === "storno" ? -1 : 1 };
    });
}

// ---------------------------------------------------------------- OSS

export interface OssZeile {
  land: string;
  satz: number;
  netto_cent: number;
}

const ossPosten = (unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung) => posten(unterlagen, betrieb, v).filter((p) => p.daten.oss && p.tag);

/** Quartale mit OSS-Rechnungen – neueste zuerst. */
export const ossQuartale = (unterlagen: Unterlage[], betrieb: Betrieb, v: Versteuerung = "soll") => [...new Set(ossPosten(unterlagen, betrieb, v).map((p) => quartal(p.tag)))].sort().reverse();

/** OSS-Umsätze eines Quartals („JJJJ-Qn“) je Land und Steuersatz, mit den Werten für die Vorlage „oss_meldung“. */
export function ossFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb, v: Versteuerung = "soll"): { zeilen: OssZeile[]; anzahl: number; werte: Record<string, unknown> } | null {
  const z = ustZeitraum(periode);
  if (!z || !periode.includes("Q")) return null;
  const im = ossPosten(unterlagen, betrieb, v).filter((p) => p.tag >= z.von && p.tag <= z.bis);
  const je = new Map<string, OssZeile>();
  for (const p of im)
    for (const g of restGruppen(p.daten)) {
      if (!g.satz) continue;
      const land = p.daten.oss!.land.toUpperCase();
      const k = `${land}|${g.satz}`;
      const e = je.get(k) ?? { land, satz: g.satz, netto_cent: 0 };
      e.netto_cent += p.vz * g.netto_cent;
      je.set(k, e);
    }
  const zeilen = [...je.values()].sort((a, b) => a.land.localeCompare(b.land) || b.satz - a.satz);
  return {
    zeilen,
    anzahl: im.length,
    werte: { zeitraum: periodeText(periode), umsaetze: zeilen.map((x) => ({ land: x.land, satz: String(x.satz).replace(".", ","), netto: betragText(x.netto_cent) })) },
  };
}

// ---------------------------------------------------------------- Zusammenfassende Meldung

export interface ZmZeile {
  ust_idnr: string;
  art: "L" | "S";
  betrag_cent: number;
}

/** ZM-relevante Rechnungen mit dem Tag des Meldezeitraums */
function zmPosten(unterlagen: Unterlage[], betrieb: Betrieb): (Posten & { art: "L" | "S" })[] {
  const aus: (Posten & { art: "L" | "S" })[] = [];
  for (const p of posten(unterlagen, betrieb, "soll")) {
    const land = (p.daten.kunde.land ?? "DE").toUpperCase();
    if (!p.daten.kunde.ust_idnr || !istEuAusland(land)) continue;
    if (p.daten.steuerart === "igl") {
      // Lieferung: Zeitraum der Rechnung, spätestens der Monat nach der Lieferung (§ 18a Abs. 8 UStG); Storno im eigenen Zeitraum
      const lieferung = p.daten.leistungsdatum ?? p.daten.leistungszeitraum?.bis ?? p.daten.rechnungsdatum;
      const tag = istStorno(p.u) ? p.daten.rechnungsdatum : [p.daten.rechnungsdatum, endeFolgemonat(lieferung)].sort()[0]!;
      aus.push({ ...p, tag, art: "L" });
    } else if (p.daten.steuerart === "reverse_charge" && p.tag) aus.push({ ...p, art: "S" });
  }
  return aus;
}

/** Monate und Quartale mit ZM-relevanten Rechnungen – neueste zuerst. */
export function zmPerioden(unterlagen: Unterlage[], betrieb: Betrieb): string[] {
  const set = new Set<string>();
  for (const p of zmPosten(unterlagen, betrieb)) {
    set.add(p.tag.slice(0, 7));
    set.add(quartal(p.tag));
  }
  return [...set].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1));
}

/** Zusammenfassende Meldung für einen Monat oder ein Quartal je USt-IdNr. und Art (volle Euro), mit den Werten für „zm_meldung“. */
export function zmFuer(unterlagen: Unterlage[], periode: string, betrieb: Betrieb): { zeilen: ZmZeile[]; anzahl: number; werte: Record<string, unknown> } | null {
  const z = ustZeitraum(periode);
  if (!z) return null;
  const im = zmPosten(unterlagen, betrieb).filter((p) => p.tag >= z.von && p.tag <= z.bis);
  const je = new Map<string, ZmZeile>();
  for (const p of im) {
    const ust = p.daten.kunde.ust_idnr!.replace(/\s/g, "").toUpperCase();
    const k = `${ust}|${p.art}`;
    const e = je.get(k) ?? { ust_idnr: ust, art: p.art, betrag_cent: 0 };
    e.betrag_cent += p.vz * restGruppen(p.daten).filter((g) => g.satz === 0).reduce((a, g) => a + g.netto_cent, 0);
    je.set(k, e);
  }
  const zeilen = [...je.values()].map((x) => ({ ...x, betrag_cent: Math.trunc(x.betrag_cent / 100) * 100 })).sort((a, b) => a.ust_idnr.localeCompare(b.ust_idnr) || a.art.localeCompare(b.art));
  return {
    zeilen,
    anzahl: im.length,
    werte: { zeitraum: periodeText(periode), meldungen: zeilen.map((x) => ({ ust_idnr: x.ust_idnr, art: x.art, betrag: betragText(x.betrag_cent) })) },
  };
}
