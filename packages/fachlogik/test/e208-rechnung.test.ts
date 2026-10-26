/**
 * E-208: Befunde der externen Prüfung zu Rechnungen.
 * (6) Bruttopreise: Die XRechnung nannte den gerundeten Nettopreis je Einheit (10 × 8,39 €), die Zeile aber den aus dem
 *     Brutto abgeleiteten Betrag (83,95 €) – der KoSIT-Validator meldet PEPPOL-EN16931-R120 (Schematron nicht bestanden).
 * (7) Einzelpreise wurden vor der Multiplikation auf ganze Cent gerundet: 1.000 kWh × 0,3456 € ergaben 350,00 €.
 * (8b) Ausfuhrlieferungen (§ 4 Nr. 1 Buchst. a UStG, Kz 43) standen im DATEV-Stapel auf 8100/4100 (§ 4 Nr. 8 ff., Kz 48).
 * Die XML-Beispiele prüft zusätzlich der KoSIT-Validator in der CI (scripts/e-rechnung-beispiele.mjs, auch Warnungen).
 */
import { describe, expect, it } from "vitest";
import { buchungenAusRechnungen, erloeskonto, kontenFuer, type AusgangsRechnungFuerBuchung } from "../src/buchungen.js";
import { KU_HINWEIS, LEERER_BETRIEB, dokumentHtml, eRechnungAus, fehlendFuerERechnung, nettoEinzelpreis, preisCent, summen, vorlageFuer, xrechnungUbl, zeilenCent, type Betrieb, type Daten, type Position } from "../src/index.js";

const BETRIEB: Betrieb = { ...LEERER_BETRIEB, name: "Salon Schnitt", strasse: "Marktplatz 3", plz: "80331", ort: "München", telefon: "+49 89 123456", email: "info@salon.example", steuernummer: "143/123/45678", ust_idnr: "DE123456789", iban: "DE02120300000000202051", bundesland: "Bayern" };
const KUNDE = { kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example" };
const RE: Daten = { nummer: "2026-050", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", ...KUNDE };
const BRUTTO: Daten = { ...RE, preise_brutto: true };
const pos = (menge: string, preis: string, satz = "19", bezeichnung = "Pflegeset") => ({ bezeichnung, menge, einheit: "Stück", preis, satz });

const xml = (d: Daten) => {
  const { daten, fehlt } = eRechnungAus(d, BETRIEB);
  expect(fehlt).toEqual([]);
  return xrechnungUbl(daten, KU_HINWEIS);
};
const html = (d: Daten) => dokumentHtml(vorlageFuer("rechnung")!, d, BETRIEB).replace(/\u00a0/g, " ");
const cent = (x: string) => Math.round(Number(x) * 100);
const alle = (x: string, re: RegExp) => [...x.matchAll(re)].map((m) => m[1]!);
const tag = (x: string, name: string) => new RegExp(`<cbc:${name}[^>]*>([^<]*)</cbc:${name}>`).exec(x)?.[1] ?? null;

/** Prüft die Rechenregeln, die der Validator prüft: R120 je Zeile, BR-CO-10, BR-CO-13, BR-CO-14, BR-CO-15. */
function rechenregeln(x: string) {
  const zeilen = alle(x, /<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/g).map((z) => ({ menge: Number(tag(z, "InvoicedQuantity")), betrag: cent(tag(z, "LineExtensionAmount")!), preis: tag(z, "PriceAmount")! }));
  for (const z of zeilen) {
    // PEPPOL-EN16931-R120: Zeilenbetrag = Menge × Preis (KoSIT rechnet mit kaufmännischer Rundung auf Cent)
    expect(Math.round(Math.abs(z.menge * Number(z.preis) * 100)), `${z.menge} × ${z.preis}`).toBe(Math.abs(z.betrag));
  }
  const summe = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const lineExt = cent(/<cac:LegalMonetaryTotal>[\s\S]*?<cbc:LineExtensionAmount[^>]*>([^<]*)</.exec(x)![1]!);
  const nachlass = cent(tag(x, "AllowanceTotalAmount") ?? "0");
  const netto = cent(tag(x, "TaxExclusiveAmount")!);
  const brutto = cent(tag(x, "TaxInclusiveAmount")!);
  const steuer = cent(/<cac:TaxTotal>\s*<cbc:TaxAmount[^>]*>([^<]*)</.exec(x)![1]!);
  expect(summe(zeilen.map((z) => z.betrag))).toBe(lineExt); // BR-CO-10
  expect(lineExt - nachlass).toBe(netto); // BR-CO-13
  expect(summe(alle(x, /<cac:TaxSubtotal>[\s\S]*?<cbc:TaxAmount[^>]*>([^<]*)</g).map(cent))).toBe(steuer); // BR-CO-14
  expect(netto + steuer).toBe(brutto); // BR-CO-15
  return { netto, steuer, brutto, zeilen };
}

describe("Befund 6: Bruttopreise – Nettopreis je Einheit passend zum Zeilenbetrag", () => {
  it("10 × 9,99 € brutto: Preis 8,395 € statt 8,39 €, Zeile 83,95 €, Summe genau 99,90 €", () => {
    const x = xml({ ...BRUTTO, positionen: [pos("10", "9,99")] });
    expect(tag(x, "PriceAmount")).toBe("8.395");
    const r = rechenregeln(x);
    expect(r).toMatchObject({ netto: 8395, steuer: 1595, brutto: 9990 });
    // die gedruckte Rechnung nennt dieselben Zahlen
    const h = html({ ...BRUTTO, positionen: [pos("10", "9,99")] });
    expect(h).toContain("8,395 €");
    expect(h).toContain("83,95 €");
    expect(h).toContain("99,90 €");
  });

  it("vorher: gerundeter Nettopreis × Menge wich um 5 Cent ab (Nachweis des Befunds)", () => {
    const p: Position = { bezeichnung: "Pflegeset", menge: 10, einheit: "stueck", preis_cent: 839, brutto_cent: 999, ust_satz: 19 };
    const s = summen([p], false);
    expect(s.zeilen[0]).toBe(8395);
    expect(zeilenCent(10, 839)).toBe(8390); // der alte Preis in der XML – 5 Cent Widerspruch
    expect(nettoEinzelpreis(p, s.zeilen[0]!)).toBe("8.395");
  });

  it("viele Bruttofälle: Steuersätze gemischt, Rundungsdifferenz der Gruppe, Nachlass, Storno, Skonto – alle Regeln erfüllt, Brutto genau", () => {
    const faelle: Daten[] = [
      { ...BRUTTO, positionen: [pos("1", "45,00", "19", "Haarschnitt"), pos("3", "12,99"), pos("7", "3,85", "7", "Kuchen"), pos("3", "2,95", "7", "Kaffee"), pos("1,5", "33,33")] },
      { ...BRUTTO, positionen: [pos("1", "89,90", "19", "Färben"), pos("10", "9,99"), pos("1", "-9,99", "19", "Treuerabatt")] },
      { ...BRUTTO, zahlungsziel: "sofort", storno_zu: "2026-049", positionen: [pos("10", "-9,99")] },
      { ...BRUTTO, skonto: true, skonto_prozent: "2", skonto_tage: "10", positionen: [pos("7", "19,99", "19", "Kurs"), pos("13", "1,99", "7", "Getränk")] },
      // elf gleiche Positionen: die Rundungsdifferenz der Gruppe landet auf einer Zeile – ihr Preis bekommt mehr Stellen
      { ...BRUTTO, positionen: Array.from({ length: 11 }, (_, i) => pos(String(i + 1), "0,99", "19", `Artikel ${i + 1}`)) },
      { ...BRUTTO, positionen: [pos("3", "0,01"), pos("2,3333", "17,77"), pos("1000", "0,1234")] },
    ];
    for (const d of faelle) {
      const x = xml(d);
      const r = rechenregeln(x);
      // Brutto = Summe der eingegebenen Bruttozeilen (genau, ohne Cent-Differenz)
      const { daten } = eRechnungAus(d, BETRIEB);
      const eingabe = daten.positionen.reduce((a, p) => a + zeilenCent(p.menge, p.brutto_cent!), 0);
      expect(r.brutto * (d.storno_zu ? -1 : 1)).toBe(eingabe);
      // gedruckte Summe = XML-Summe
      expect(html(d)).toContain(new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(eingabe / 100).replace(/^-/, "\u2212").replace(/\u00a0/g, " "));
    }
  });

  it("Nettorechnungen mit ganzen Cent: Preis wie bisher mit zwei Stellen", () => {
    const x = xml({ ...RE, positionen: [pos("12", "14,50", "7", "Catering")] });
    expect(tag(x, "PriceAmount")).toBe("14.50");
    expect(html({ ...RE, positionen: [pos("12", "14,50", "7", "Catering")] })).toContain("14,50 €");
  });
});

describe("Befund 7: Einzelpreise mit bis zu vier Nachkommastellen", () => {
  const STROM: Daten = { ...RE, positionen: [{ bezeichnung: "Strom", menge: "1.000", einheit: "kWh", preis: "0,3456", satz: "19" }] };
  it("1.000 kWh × 0,3456 € = 345,60 € (vorher 350,00 €)", () => {
    expect(preisCent("0,3456")).toBe(34.56);
    expect(zeilenCent(1000, 34.56)).toBe(34560);
    const x = xml(STROM);
    expect(tag(x, "PriceAmount")).toBe("0.3456");
    expect(rechenregeln(x)).toMatchObject({ netto: 34560, steuer: 6566, brutto: 41126 });
    const h = html(STROM);
    expect(h).toContain("0,3456 €");
    expect(h).toContain("345,60 €");
    expect(h).not.toContain("350,00 €");
  });
  it("Rundung erst beim Zeilenbetrag: 3 × 0,3333 € = 1,00 €, 7 × 0,0125 € = 0,09 €", () => {
    expect(zeilenCent(3, preisCent("0,3333")!)).toBe(100);
    expect(zeilenCent(7, preisCent("0,0125")!)).toBe(9); // 8,75 Cent → 9
    expect(zeilenCent(7, -1.25)).toBe(-9); // symmetrisch
  });
  it("mehr als vier Nachkommastellen werden auf vier gerundet; ganze Cent unverändert", () => {
    expect(preisCent("0,34567")).toBe(34.57);
    expect(preisCent("45,00")).toBe(4500);
    expect(preisCent("-14,50")).toBe(-1450);
    expect(preisCent("1.234,5")).toBe(123450);
  });
  it("E-Rechnung: Preis mit zwei Nachkommastellen in Cent gültig, mit mehr ungültig", () => {
    const { daten } = eRechnungAus(STROM, BETRIEB);
    expect(fehlendFuerERechnung(daten)).toEqual([]);
    expect(fehlendFuerERechnung({ ...daten, positionen: [{ ...daten.positionen[0]!, preis_cent: 34.567 }] })).toContain("positionen.ungueltig");
  });
});

describe("Befund 8b: Ausfuhrlieferungen auf das eigene Erlöskonto (Kz 43)", () => {
  const RE_A: AusgangsRechnungFuerBuchung = { id: "a1", nummer: "2026-060", datum: "2026-10-12", art: "rechnung", kleinunternehmer: false, kunde: "Zürich AG", positionen: [{ bezeichnung: "Maschine", menge: 1, einheit: "stueck", preis_cent: 500000, ust_satz: 0 }], steuerart: "befreit", kunde_land: "CH", befreiungsgrund: "Steuerfreie Ausfuhrlieferung nach § 4 Nr. 1 Buchst. a UStG" };
  it("SKR03 8120 / SKR04 4120 statt 8100/4100", () => {
    expect(buchungenAusRechnungen([RE_A], "SKR03")[0]!.gegenkonto).toBe("8120");
    expect(buchungenAusRechnungen([RE_A], "SKR04")[0]!.gegenkonto).toBe("4120");
    expect(erloeskonto(kontenFuer("SKR03"), 0, { steuerart: "befreit", kunde_land: "CH", befreiungsgrund: "steuerfrei nach § 4 Nr. 1a UStG" })).toBe("8120");
  });
  it("andere Steuerbefreiungen (§ 4 Nr. 14) bleiben auf 8100/4100; Kontenvorgabe der Kanzlei geht vor", () => {
    expect(buchungenAusRechnungen([{ ...RE_A, befreiungsgrund: "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG" }], "SKR03")[0]!.gegenkonto).toBe("8100");
    expect(buchungenAusRechnungen([RE_A], "SKR03", { vorgaben: { konten: { erloesAusfuhr: "8121" } } })[0]!.gegenkonto).toBe("8121");
  });
});
