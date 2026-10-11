import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DateiAblage, eRechnungLesen, fehlendFuerERechnung, rechnungPdf, summen, xrechnungXml, zugferdPdf, type RechnungsDaten } from "../src/finanzen.js";

const KU = "Kleinunternehmer-Hinweis (Text fachlich zu prüfen)";
const basis: RechnungsDaten = {
  nummer: "2026-0001", rechnungsdatum: "2026-10-11", leistungsdatum: "2026-10-01", faellig_am: "2026-10-25",
  steller: { name: "Annas Café", strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart", land: "DE", email: "anna@example.org", telefon: "+49 711 123", steuernummer: "93815/08152", ust_idnr: "DE123456789", iban: "DE02120300000000202051" },
  kunde: { name: "Kunde GmbH", strasse: "Ring 5", plz: "10115", ort: "Berlin", land: "DE", email: "einkauf@kunde.example", geschaeftskunde: true },
  positionen: [
    { bezeichnung: "Beratung", menge: 2.5, einheit: "stunde", preis_cent: 8000, ust_satz: 19 },
    { bezeichnung: "Fachbuch", menge: 1, einheit: "stueck", preis_cent: 2999, ust_satz: 7 },
    { bezeichnung: "Material", menge: 3, einheit: "stueck", preis_cent: 333, ust_satz: 19 },
  ],
  kleinunternehmer: false,
};

describe("Rechnungssummen (EN 16931)", () => {
  it("rundet Positionen auf Cent und die Steuer je Satz auf die Summe", () => {
    const s = summen(basis.positionen, false);
    expect(s.zeilen).toEqual([20000, 2999, 999]);
    expect(s.gruppen).toEqual([{ satz: 19, netto_cent: 20999, ust_cent: 3990 }, { satz: 7, netto_cent: 2999, ust_cent: 210 }]);
    expect(s).toMatchObject({ netto_cent: 23998, ust_cent: 4200, brutto_cent: 28198 });
    expect(summen(basis.positionen, true)).toMatchObject({ ust_cent: 0, brutto_cent: 23998, gruppen: [{ satz: null, netto_cent: 23998, ust_cent: 0 }] });
    expect(summen([{ bezeichnung: "x", menge: 0.333, einheit: "stunde", preis_cent: 1000, ust_satz: 19 }], false).zeilen).toEqual([333]);
  });

  it("nennt, was für eine E-Rechnung fehlt", () => {
    expect(fehlendFuerERechnung(basis)).toEqual([]);
    expect(fehlendFuerERechnung({ ...basis, steller: { ...basis.steller, telefon: null, iban: null, steuernummer: null, ust_idnr: null }, leistungsdatum: null }))
      .toEqual(["steller.telefon", "steller.steuernummer_oder_ust_idnr", "steller.iban", "leistungsdatum"]);
  });
});

describe("E-Rechnung", () => {
  it("erzeugt XRechnung (CII) und liest sie wieder", async () => {
    const xml = await xrechnungXml(basis, KU);
    expect(xml).toContain("urn:xeinkauf.de:kosit:xrechnung_3.0");
    expect(xml).toContain("<ram:GrandTotalAmount>281.98</ram:GrandTotalAmount>");
    const g = eRechnungLesen(xml);
    expect(g).toMatchObject({ syntax: "CII", nummer: "2026-0001", datum: "2026-10-11", verkaeufer: "Annas Café", brutto_cent: 28198, ust_cent: 4200, waehrung: "EUR" });
  });

  it("Kleinunternehmer: Steuerkategorie E mit Befreiungsgrund", async () => {
    const xml = await xrechnungXml({ ...basis, kleinunternehmer: true, positionen: basis.positionen.map((p) => ({ ...p, ust_satz: null })) }, KU);
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode>");
    expect(xml).toContain(KU);
    expect(eRechnungLesen(xml).ust_cent).toBe(0);
  });

  it("Storno: Typ 384 mit Bezug und negativen Beträgen", async () => {
    const xml = await xrechnungXml({ ...basis, nummer: "2026-0002", art: "storno", storniert_nummer: "2026-0001" }, KU);
    expect(xml).toContain("<ram:TypeCode>384</ram:TypeCode>");
    expect(xml).toContain("<ram:GrandTotalAmount>-281.98</ram:GrandTotalAmount>");
    expect(xml).toContain("2026-0001");
  });

  it("PDF mit eingebetteter Schrift und ZUGFeRD mit angehängter XML", async () => {
    const pdf = await rechnungPdf(basis, KU);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toMatch(/FontFile2/); // eingebettete TrueType-Schrift
    const z = await zugferdPdf(basis, KU, pdf);
    const roh = z.toString("latin1");
    expect(roh).toMatch(/factur-x\.xml|xrechnung\.xml/i);
    expect(roh).toMatch(/pdfaid:part/);
  });

  it("liest UBL und lehnt Nicht-Rechnungen und Entitäten ab", () => {
    const ubl = `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"><cbc:CustomizationID>urn:x</cbc:CustomizationID><cbc:ID>R-7</cbc:ID><cbc:IssueDate>2026-09-30</cbc:IssueDate><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Lieferant AG</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:TaxTotal><cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount></cac:LegalMonetaryTotal></Invoice>`;
    expect(eRechnungLesen(ubl)).toMatchObject({ syntax: "UBL", nummer: "R-7", verkaeufer: "Lieferant AG", brutto_cent: 11900, ust_cent: 1900 });
    expect(() => eRechnungLesen("<html><body>nein</body></html>")).toThrow(/Keine E-Rechnung/);
    expect(() => eRechnungLesen('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><Invoice>&a;</Invoice>')).toThrow(/DOCTYPE/);
  });
});

describe("Ablage", () => {
  it("schreibt einmal, überschreibt nie, lehnt fremde Schlüssel ab", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ablage-"));
    const a = new DateiAblage(dir);
    const k = `u1/${"a".repeat(64)}.pdf`;
    await a.ablegen(k, Buffer.from("eins"));
    await a.ablegen(k, Buffer.from("zwei")); // gleicher Schlüssel: bleibt beim ersten Inhalt
    expect((await a.lesen(k)).toString()).toBe("eins");
    await expect(a.ablegen("../etc/passwd", Buffer.from("x"))).rejects.toThrow(/Ungültig/);
  });
});
