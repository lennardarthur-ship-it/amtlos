/**
 * E-220 (4): Kleinbetragsrechnung (§ 33 UStDV) nicht bei Fernverkäufen, innergemeinschaftlichen Lieferungen und
 * Steuerschuldnerschaft des Leistungsempfängers. § 33 Satz 3 UStDV: „Die Sätze 1 und 2 gelten nicht für Rechnungen über
 * Leistungen im Sinne der §§ 3c, 6a und 13b des Gesetzes.“ Dann gelten die vollen Angaben nach § 14 Abs. 4 UStG –
 * Name und Anschrift des Empfängers sind Pflicht, das Leistungsdatum steht auf der Rechnung.
 */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, dokumentHtml, fehlendeAngaben, kleinbetrag, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";

const BETRIEB: Betrieb = { ...LEERER_BETRIEB, name: "Shop Nord", strasse: "Hafen 1", plz: "20457", ort: "Hamburg", steuernummer: "12/345/67890", ust_idnr: "DE123456789", bundesland: "Hamburg" };
const v = vorlageFuer("rechnung")!;
const pos = [{ bezeichnung: "Teekanne", menge: "1", preis: "100", satz: "19" }];
const KLEIN: Daten = { nummer: "2026-101", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", positionen: pos };
const html = (d: Daten) => dokumentHtml(v, d, BETRIEB).replace(/\u00a0|&nbsp;/g, " ");

describe("E-220 (4): Kleinbetragsrechnung nach § 33 UStDV", () => {
  it("Inland bis 250 € bleibt Kleinbetragsrechnung (ohne Empfänger, ohne Leistungsdatum, Steuersatz beim Gesamtbetrag)", () => {
    expect(kleinbetrag(KLEIN)).toBe(true);
    expect(fehlendeAngaben(v, KLEIN)).not.toContain("Name oder Firma");
    expect(html(KLEIN)).not.toContain("Leistungsdatum");
    expect(html(KLEIN)).toContain("Rechnungsbetrag inkl. 19 % USt");
  });

  it("Fernverkauf mit OSS (§ 3c UStG): volle Angaben nach § 14 Abs. 4 UStG", () => {
    const d: Daten = { ...KLEIN, oss: true, oss_satz: "20", kunde_name: "Anna Gruber", kunde_anschrift: "Ringstraße 1\n1010 Wien\nÖsterreich" };
    expect(kleinbetrag(d)).toBe(false);
    expect(fehlendeAngaben(v, { ...d, kunde_name: "", kunde_anschrift: "" })).toEqual(expect.arrayContaining(["Name oder Firma", "Anschrift"]));
    expect(html(d)).toContain("Leistungsdatum");
    expect(html(d)).not.toContain("Rechnungsbetrag inkl.");
  });

  it("OSS ohne Anschrift: auch dann keine Vereinfachung (Empfänger bleibt Pflicht)", () => {
    const d: Daten = { ...KLEIN, oss: true, oss_satz: "20" };
    expect(kleinbetrag(d)).toBe(false);
    expect(fehlendeAngaben(v, d)).toEqual(expect.arrayContaining(["Name oder Firma", "Anschrift"]));
  });

  it("Privatperson im EU-Ausland ohne OSS (unter der Schwelle des § 3c Abs. 4 UStG): seit E-228 (T-299 beantwortet) mit deutscher Steuer Vereinfachung", () => {
    const d: Daten = { ...KLEIN, kunde_name: "Jan de Vries", kunde_anschrift: "Dam 1\n1012 Amsterdam\nNiederlande" };
    expect(kleinbetrag(d)).toBe(true);
    expect(html(d)).not.toContain("Leistungsdatum");
  });

  it("§ 13b auch über den Freitext im Befreiungshinweis und innergemeinschaftliche Lieferung (§ 6a): keine Vereinfachung", () => {
    const p0 = [{ ...pos[0]!, satz: "0" }];
    expect(kleinbetrag({ ...KLEIN, positionen: p0, befreiung: "Steuerschuldnerschaft des Leistungsempfängers nach § 13b UStG" })).toBe(false);
    expect(kleinbetrag({ ...KLEIN, positionen: p0, hinweise: ["reverse_charge"] })).toBe(false);
    expect(kleinbetrag({ ...KLEIN, positionen: p0, hinweise: ["igl"] })).toBe(false);
  });

  it("Unternehmen im Inland mit Anschrift: weiterhin Kleinbetragsrechnung", () => {
    expect(kleinbetrag({ ...KLEIN, kunde_name: "Café Elbe", kunde_anschrift: "Elbchaussee 2\n22763 Hamburg" })).toBe(true);
  });
});
