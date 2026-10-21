/**
 * R11 Steuer (simulierte Steuerberatung, Gebäudereinigung, Kosmetik, Tischlerei): Gutschrift als XRechnung (Typ 389,
 * Leistender als Verkäufer), Steuerkategorien Z/G/O, Abschlagsrechnung 326, Bruttopreise, § 13b-Haken mit 19 %,
 * Kleinunternehmer bis zu einem Wechseldatum, Abschlag mit „Leistungsdatum = Rechnungsdatum“, Gutschein zu 0 %,
 * Grundstücks-Hinweis im Handwerk, Vorsteuer bei nur steuerfreien Umsätzen.
 */
import { describe, expect, it } from "vitest";
import { KU_HINWEIS, LEERER_BETRIEB, belegAusERechnung, dokumentHtml, eRechnungAus, eRechnungLesen, summen, vorlageFuer, xrechnungUbl, type Betrieb, type Daten } from "../src/index.js";
import { RECHNUNG_ABSCHLAG_LEISTUNG, RECHNUNG_GRUNDSTUECK_VORSCHLAG, RECHNUNG_GUTSCHEIN, RECHNUNG_KU_ZEIT, RECHNUNG_RC_MIT_UST } from "../src/dokumente/buchhaltung.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Elektro Brandt", strasse: "Hafenstr. 3", plz: "44147", ort: "Dortmund", verantwortlich: "Kai Brandt", telefon: "0231 1", email: "info@brandt.example", steuernummer: "314/5555/1234", ust_idnr: "DE123456789", iban: "DE02120300000000202051" };
const RE: Daten = { nummer: "2026-020", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n44135 Dortmund", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Installation", menge: "1", einheit: "Stunde", preis: "100", satz: "19" }] };
const v = vorlageFuer("rechnung")!;
const xml = (d: Daten, b: Betrieb = B) => xrechnungUbl(eRechnungAus(d, b).daten, KU_HINWEIS);
const block = (x: string, tag: string) => x.slice(x.indexOf(`<${tag}>`), x.indexOf(`</${tag}>`));

describe("Gutschrift als XRechnung", () => {
  const GS: Daten = { ...RE, hinweise: ["gutschrift"], kunde_name: "Jonas Kiefer Fotografie", kunde_steuernummer: "22/333/44444", kunde_telefon: "040 99" };
  it("Typ 389, Verkäufer ist der Leistende mit seiner Steuernummer, Käufer der Betrieb", () => {
    const { fehlt } = eRechnungAus(GS, B);
    expect(fehlt).toEqual([]);
    const x = xml(GS);
    expect(x).toContain("<cbc:InvoiceTypeCode>389</cbc:InvoiceTypeCode>");
    const verkaeufer = block(x, "cac:AccountingSupplierParty");
    expect(verkaeufer).toContain("Jonas Kiefer Fotografie");
    expect(verkaeufer).toContain("22/333/44444");
    expect(verkaeufer).not.toContain("314/5555/1234");
    const kaeufer = block(x, "cac:AccountingCustomerParty");
    expect(kaeufer).toContain("Elektro Brandt");
    expect(kaeufer).toContain("DE123456789");
  });
  it("ohne Telefon bzw. Steuernummer des Leistenden: keine E-Rechnung, das PDF bleibt möglich", () => {
    const d = { ...GS, kunde_telefon: "", kunde_steuernummer: "" };
    expect(eRechnungAus(d, B).fehlt).toEqual(expect.arrayContaining(["Telefon des Leistenden (Empfänger der Gutschrift)", "Steuernummer oder USt-IdNr. des Leistenden"]));
    // fürs PDF zählt die Steuernummer des Leistenden (wie bisher), das Telefon nicht
    expect(v.pruefen!({ ...GS, kunde_telefon: "" }, B)).toEqual([]);
  });
});

describe("Steuerkategorien und Rechnungsart", () => {
  it("Nullsteuersatz Z ohne Befreiungsgrund, Ausfuhr G (VATEX-EU-G), Drittland mit Steuerschuldnerschaft O (VATEX-EU-O)", () => {
    const pos0 = [{ bezeichnung: "Ware", menge: "1", preis: "100", satz: "0" }];
    const z = xml({ ...RE, positionen: pos0, befreiung: "Nullsteuersatz nach § 12 Abs. 3 UStG (Photovoltaikanlage)" });
    expect(z).toContain("<cbc:ID>Z</cbc:ID>");
    expect(block(z, "cac:TaxTotal")).not.toContain("TaxExemptionReason");
    const g = xml({ ...RE, positionen: pos0, kunde_anschrift: "Bahnhofstr. 1\n8001 Zürich\nSchweiz", befreiung: "Steuerfreie Ausfuhrlieferung nach § 4 Nr. 1 Buchst. a UStG" });
    expect(g).toContain("<cbc:ID>G</cbc:ID>");
    expect(g).toContain("VATEX-EU-G");
    // ohne USt-IdNr. des Verkäufers bleibt es bei E (BR-G-02)
    expect(xml({ ...RE, positionen: pos0, kunde_anschrift: "Bahnhofstr. 1\n8001 Zürich\nSchweiz", befreiung: "Steuerfreie Ausfuhrlieferung nach § 4 Nr. 1 Buchst. a UStG" }, { ...B, ust_idnr: "" })).not.toContain("<cbc:ID>G</cbc:ID>");
    const o = xml({ ...RE, positionen: pos0, kunde_anschrift: "Bahnhofstr. 1\n8001 Zürich\nSchweiz", hinweise: ["reverse_charge"] });
    expect(o).toContain("<cbc:ID>O</cbc:ID>");
    expect(o).toContain("VATEX-EU-O");
    // nicht steuerbar: keine USt-IdNr. (BR-O-02), Steuernummer als Kennung
    expect(o).not.toContain("DE123456789");
  });
  it("Abschlagsrechnung als Teilrechnung 326", () => {
    expect(xml({ ...RE, abschlag: true, leistung_gleich: false, leistung: "voraussichtlich November 2026" })).toContain("<cbc:InvoiceTypeCode>326</cbc:InvoiceTypeCode>");
    expect(xml(RE)).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
  });
});

describe("Bruttopreise (Kosmetik #4)", () => {
  it("Summe trifft den Endpreis genau, Netto und Steuer aus dem Brutto", () => {
    const d = { ...RE, preise_brutto: true, positionen: [{ bezeichnung: "Wellness", menge: "2", preis: "69,00", satz: "19" }, { bezeichnung: "Gesicht", menge: "1", preis: "45,00", satz: "19" }] };
    const r = eRechnungAus(d, B).daten;
    const s = summen(r.positionen, false);
    expect(s.brutto_cent).toBe(18300);
    expect(s.netto_cent).toBe(15378);
    expect(s.zeilen.reduce((a, b) => a + b, 0)).toBe(s.netto_cent);
    expect(dokumentHtml(v, d, B)).toContain("183,00");
    // ohne Schalter wie bisher netto
    expect(summen(eRechnungAus({ ...d, preise_brutto: false }, B).daten.positionen, false).netto_cent).toBe(18300);
  });
});

describe("Rechnungsprüfung R11", () => {
  it("§ 13b- bzw. igL-Hinweis mit 19 % in den Positionen sperrt (§ 14c Abs. 1 UStG)", () => {
    expect(v.pruefen!({ ...RE, hinweise: ["reverse_charge"] }, B)).toContain(RECHNUNG_RC_MIT_UST);
    expect(v.pruefen!({ ...RE, hinweise: ["reverse_charge"], positionen: [{ bezeichnung: "Reinigung", menge: "1", preis: "100", satz: "0" }] }, B)).not.toContain(RECHNUNG_RC_MIT_UST);
  });
  it("Abschlagsrechnung mit „Leistungsdatum = Rechnungsdatum“ sperrt", () => {
    expect(v.pruefen!({ ...RE, abschlag: true }, B)).toContain(RECHNUNG_ABSCHLAG_LEISTUNG);
    expect(v.pruefen!({ ...RE, abschlag: true, leistung_gleich: false, leistung: "voraussichtlich 11/2026" }, B)).not.toContain(RECHNUNG_ABSCHLAG_LEISTUNG);
  });
  it("Leistung aus der Kleinunternehmerzeit mit USt: Warnung; Gutschein zu 0 %; Grundstücks-Hinweis im Handwerk", () => {
    const bKu = { ...B, ku_bis: "2025-12-31" };
    expect(v.hinweise!({ ...RE, leistung_gleich: false, leistung: "15.12.2025" }, bKu)).toContain(RECHNUNG_KU_ZEIT("31.12.2025"));
    expect(v.hinweise!(RE, bKu).some((h) => h.includes("Kleinunternehmerzeit"))).toBe(false);
    expect(v.hinweise!({ ...RE, positionen: [{ bezeichnung: "Gutschein Massage", menge: "1", preis: "50", satz: "0" }], befreiung: "Gutschein" }, B)).toContain(RECHNUNG_GUTSCHEIN);
    // R12: nur an Privatpersonen (§ 14 Abs. 4 Satz 1 Nr. 9 UStG) – an die Muster GmbH nicht
    const privat = { ...RE, kunde_email: "", kunde_name: "Lea Schmitz" };
    expect(v.hinweise!(privat, B, { handwerk: true })).toContain(RECHNUNG_GRUNDSTUECK_VORSCHLAG);
    expect(v.hinweise!({ ...privat, kunde_name: "Muster GmbH" }, B, { handwerk: true })).not.toContain(RECHNUNG_GRUNDSTUECK_VORSCHLAG);
    expect(v.hinweise!({ ...privat, hinweise: ["grundstueck"] }, B, { handwerk: true })).not.toContain(RECHNUNG_GRUNDSTUECK_VORSCHLAG);
    expect(v.hinweise!(privat, B)).not.toContain(RECHNUNG_GRUNDSTUECK_VORSCHLAG);
  });
  it("Zahlungsblock ohne doppelten Namen, Anrede bei schon bezahlter Rechnung", () => {
    const h = dokumentHtml(v, { ...RE, bezahlt_am: "12.10.2026" }, { ...B, name: "Hautsache Kosmetik – Nele Brandt", verantwortlich: "Nele Brandt" });
    expect(h).toContain("bereits bezahlt haben");
    const h2 = dokumentHtml(v, RE, { ...B, name: "Hautsache Kosmetik – Nele Brandt", verantwortlich: "Nele Brandt" });
    expect(h2).not.toContain("(Nele Brandt)");
  });
});

describe("E-Rechnung einlesen: nur steuerfreie Umsätze", () => {
  it("Vorsteuer aus mit Hinweis", () => {
    const r = eRechnungLesen(xrechnungUbl(eRechnungAus(RE, B).daten, KU_HINWEIS))!;
    expect(belegAusERechnung(r, "b1", "2026-10-20T10:00:00Z").vorsteuer).toBe(true);
    const b = belegAusERechnung(r, "b1", "2026-10-20T10:00:00Z", { nurSteuerfrei: true });
    expect(b.vorsteuer).toBe(false);
    expect(b.notiz).toContain("§ 15 Abs. 2 UStG");
  });
});
