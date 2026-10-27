/**
 * E-228 (T-299): Antwort des Steuerberaters zur Kleinbetragsrechnung (§ 33 UStDV). Volle Angaben nur, wenn die Rechnung
 * selbst die Besteuerung im Bestimmungsland ausweist (OSS – auch bei Verzicht auf die Schwelle nach § 3c Abs. 4 Satz 2
 * UStG), bei § 13b und bei innergemeinschaftlicher Lieferung. Eine Privatperson im EU-Ausland mit deutscher Umsatzsteuer
 * (Fernverkauf unter der Schwelle des § 3c Abs. 4 UStG, sonstige Leistung mit Ort im Inland nach § 3a Abs. 1 UStG) darf
 * die Vereinfachung nutzen. Ohne deutsche Steuer (0 %-Position, Ort der Leistung womöglich im Ausland) bleibt es
 * vorsorglich bei den vollen Angaben.
 */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, dokumentHtml, fehlendeAngaben, kleinbetrag, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";

const BETRIEB: Betrieb = { ...LEERER_BETRIEB, name: "Shop Nord", strasse: "Hafen 1", plz: "20457", ort: "Hamburg", steuernummer: "12/345/67890", ust_idnr: "DE123456789", bundesland: "Hamburg" };
const v = vorlageFuer("rechnung")!;
const pos = [{ bezeichnung: "Teekanne", menge: "1", preis: "100", satz: "19" }];
const KLEIN: Daten = { nummer: "2026-101", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", positionen: pos };
const NL: Daten = { ...KLEIN, kunde_name: "Jan de Vries", kunde_anschrift: "Dam 1\n1012 Amsterdam\nNiederlande" };
const html = (d: Daten) => dokumentHtml(v, d, BETRIEB).replace(/\u00a0|&nbsp;/g, " ");

describe("E-228 (T-299): Kleinbetragsrechnung an Privatpersonen im EU-Ausland", () => {
  it("Privatperson im EU-Ausland mit deutscher Umsatzsteuer (unter der Schwelle, kein OSS): Vereinfachung erlaubt", () => {
    expect(kleinbetrag(NL)).toBe(true);
    expect(html(NL)).toContain("Rechnungsbetrag inkl. 19 % USt");
    expect(html(NL)).not.toContain("Leistungsdatum");
    // Empfänger ist dann keine Pflichtangabe – das Land (für den OSS-Hinweis) steht aber in der Anschrift
    expect(fehlendeAngaben(v, { ...NL, kunde_name: "" })).not.toContain("Name oder Firma");
  });

  it("dieselbe Rechnung mit 7 %: ebenfalls Vereinfachung", () => {
    expect(kleinbetrag({ ...NL, positionen: [{ ...pos[0]!, satz: "7" }] })).toBe(true);
  });

  it("Kleinunternehmer (§ 19 UStG, deutsche Regelung) an eine Privatperson im EU-Ausland: Vereinfachung erlaubt", () => {
    expect(kleinbetrag({ ...NL, kleinunternehmer: true })).toBe(true);
  });

  it("OSS (Steuer des Bestimmungslands, auch nach Verzicht auf die Schwelle): volle Angaben", () => {
    const d: Daten = { ...NL, oss: true, oss_satz: "21" };
    expect(kleinbetrag(d)).toBe(false);
    expect(html(d)).toContain("Leistungsdatum");
    expect(html(d)).not.toContain("Rechnungsbetrag inkl.");
  });

  it("Privatperson im EU-Ausland ohne deutsche Steuer (0 %, Ort der Leistung ggf. im Ausland): vorsorglich volle Angaben", () => {
    const d: Daten = { ...NL, positionen: [{ ...pos[0]!, satz: "0" }], befreiung: "Nicht im Inland steuerbare Leistung" };
    expect(kleinbetrag(d)).toBe(false);
    expect(html(d)).toContain("Leistungsdatum");
    // gemischt: eine Position ohne deutsche Steuer genügt
    expect(kleinbetrag({ ...NL, positionen: [pos[0]!, { bezeichnung: "Montage vor Ort", menge: "1", preis: "50", satz: "0" }] })).toBe(false);
  });

  it("§ 13b und innergemeinschaftliche Lieferung bleiben ohne Vereinfachung; Inland unverändert", () => {
    const p0 = [{ ...pos[0]!, satz: "0" }];
    expect(kleinbetrag({ ...KLEIN, positionen: p0, hinweise: ["reverse_charge"] })).toBe(false);
    expect(kleinbetrag({ ...KLEIN, positionen: p0, hinweise: ["igl"] })).toBe(false);
    expect(kleinbetrag(KLEIN)).toBe(true);
    expect(kleinbetrag({ ...KLEIN, positionen: [{ ...pos[0]!, satz: "0" }], befreiung: "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG" })).toBe(true);
  });

  it("über 250 € brutto: keine Kleinbetragsrechnung", () => {
    expect(kleinbetrag({ ...NL, positionen: [{ ...pos[0]!, preis: "250" }] })).toBe(false);
  });
});
