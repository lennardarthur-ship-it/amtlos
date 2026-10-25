/**
 * Steuerliche Prüfung Steuerberatungskanzlei (21.10.2026): Rechnungen, XRechnung, Voranmeldung, OSS und ZM –
 * Nullsteuersatz (B-2, C-12), Privatkunde mit Grundstücksbezug (C-3), Leitweg-ID (C-13), Skonto in BT-20 (C-15),
 * Schlussrechnung (C-4), Ersatzrechnung (C-6), volle Euro in der Voranmeldung (5.2), OSS und ZM (5.2, C-9),
 * Gutschrift-Nummernkreis (B-12), Einheitencodes (C-17), Nachlass als AllowanceCharge (C-16), Registerangaben (C-14).
 */
import { describe, expect, it } from "vitest";
import {
  KU_HINWEIS,
  LEERER_BETRIEB,
  OSS_FRIST,
  PERSONEN_FELDER,
  RECHNUNG_GUTSCHRIFT_NUMMER,
  RECHNUNG_LEITWEG_FEHLT,
  RECHNUNG_NULLSATZ_GEMISCHT,
  RECHNUNG_OSS_LAND,
  RECHNUNG_SCHLUSS_LEER,
  STEUERART_NULLSATZ,
  abschlagsSumme,
  dokumentHtml,
  eRechnungAus,
  einheitCode,
  istGutschriftNummer,
  leereDaten,
  leitwegFormatOk,
  personAus,
  personIn,
  restGruppen,
  satzZahl,
  vollEuro,
  vorlageFuer,
  xrechnungUbl,
  zahlbetrag,
  type Betrieb,
  type Daten,
} from "../src/index.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Elektro Brandt", strasse: "Hafenstr. 3", plz: "44147", ort: "Dortmund", verantwortlich: "Kai Brandt", telefon: "0231 1", email: "info@brandt.example", steuernummer: "314/5555/1234", ust_idnr: "DE123456789", iban: "DE02120300000000202051", bundesland: "Nordrhein-Westfalen" };
const R = vorlageFuer("rechnung")!;
/** Leerzeichen und Minuszeichen der Ausgabe vereinheitlichen (euro() setzt geschützte Leerzeichen und U+2212) */
const n = (t: string) => t.replace(/&nbsp;|\u00a0|\u202f/g, " ").replace(/\u2212/g, "-");
const nl = (l: [string, string][]) => l.map(([a, b]) => [a, n(b)]);
const html = (d: Daten, b: Betrieb = B) => n(dokumentHtml(R, d, b));
const pruefe = (d: Daten) => R.pruefen!(d, B);
const hinweise = (d: Daten, extra?: { handwerk?: boolean }) => R.hinweise!(d, B, extra);
const RE: Daten = { nummer: "2026-030", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n44135 Dortmund", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Installation", menge: "1", einheit: "Stunde", preis: "100", satz: "19" }] };

describe("Prio 1: Nullsteuersatz § 12 Abs. 3 UStG als eigene Auswahl", () => {
  const pv: Daten = { ...RE, kunde_name: "Miriam Osei", positionen: [{ bezeichnung: "PV-Anlage 9,8 kWp mit Speicher", menge: "1", einheit: "Pauschale", preis: "15056", satz: "nullsatz" }] };
  it("Steuersatz „0 % (§ 12 Abs. 3 UStG)“ in der Auswahl, rechnet mit 0 %", () => {
    const satz = R.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "positionen");
    const optionen = satz && satz.art === "liste" ? satz.felder.find((f) => f.id === "satz") : undefined;
    expect(optionen && "optionen" in optionen ? optionen.optionen.map((o) => o.text) : []).toContain("0 % (§ 12 Abs. 3 UStG)");
    expect(satzZahl("nullsatz")).toBe(0);
    expect(satzZahl("")).toBe(19);
  });
  it("Steuerart „nullsatz“ (gemeinsamer Wert aus steuerart.ts), Pflichthinweis von selbst, XRechnung Kategorie Z ohne Befreiungsgrund", () => {
    const { daten, fehlt } = eRechnungAus(pv, B);
    expect(daten.steuerart).toBe(STEUERART_NULLSATZ);
    expect(daten.befreiungsgrund).toMatch(/§ 12 Abs\. 3 UStG/);
    expect(fehlt).toEqual([]);
    expect(pruefe(pv)).toEqual([]);
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    expect(xml).toMatch(/<cac:ClassifiedTaxCategory>\s*<cbc:ID>Z<\/cbc:ID>\s*<cbc:Percent>0<\/cbc:Percent>/);
    expect(xml).toMatch(/<cac:TaxCategory>\s*<cbc:ID>Z<\/cbc:ID>\s*<cbc:Percent>0<\/cbc:Percent>\s*<cac:TaxScheme>/);
    expect(xml).not.toContain("TaxExemptionReason");
    expect(html(pv)).toContain("Umsatzsteuer 0 % (Nullsteuersatz nach § 12 Abs. 3 UStG");
  });
  it("Nullsteuersatz und steuerfreie Position zusammen: Hinweis, getrennt zu schreiben", () => {
    const d = { ...pv, befreiung: "Steuerfreie Leistung nach § 4 Nr. 14 UStG", positionen: [...(pv.positionen as Daten[]), { bezeichnung: "Sonstiges", menge: "1", preis: "10", satz: "0" }] } as Daten;
    expect(pruefe(d)).toContain(RECHNUNG_NULLSATZ_GEMISCHT);
  });
});

describe("C-3: Privatkunde mit Grundstücksbezug, C-13: Leitweg-ID", () => {
  const privat: Daten = { ...RE, kunde_name: "Udo Wessel", kunde_anschrift: "Am Hombruchsfeld 7\n44225 Dortmund", kunde_email: "", kunde_art: "privat", grundstueck_bezug: true };
  it("Art des Kunden wird am Kunden gemerkt und wieder eingesetzt", () => {
    expect(PERSONEN_FELDER.kunde.some((f) => f.id === "art")).toBe(true);
    expect(personAus(R, privat)).toMatchObject({ name: "Udo Wessel", art: "privat" });
    expect(personIn(R, { name: "Udo Wessel", art: "privat" })).toMatchObject({ kunde_art: "privat" });
  });
  it("Privatperson + Leistung an einem Grundstück: Aufbewahrungshinweis (§ 14b) steht ohne eigene Auswahl auf der Rechnung, nur einmal", () => {
    expect(html(privat)).toContain("zwei Jahre aufzubewahren (§ 14b Abs. 1 Satz 5 UStG)");
    expect(html({ ...privat, hinweise: ["grundstueck"] }).match(/zwei Jahre aufzubewahren/g)).toHaveLength(1);
    expect(html({ ...privat, grundstueck_bezug: false })).not.toContain("zwei Jahre aufzubewahren");
    expect(html({ ...privat, kunde_art: "unternehmen" })).not.toContain("zwei Jahre aufzubewahren");
  });
  it("Handwerk: Schalter „Leistung an einem Grundstück“ vorbelegt", () => {
    expect(leereDaten(R, B, "2026-10-12", ["handwerk_allgemein"]).grundstueck_bezug).toBe(true);
    expect(leereDaten(R, B, "2026-10-12", ["friseur"]).grundstueck_bezug).not.toBe(true);
  });
  it("öffentliche Stelle ohne Leitweg-ID: fehlt für die E-Rechnung; mit Leitweg-ID in BT-10, sonst die Rechnungsnummer", () => {
    const amt = { ...RE, kunde_name: "Stadt Dortmund", kunde_art: "oeffentlich" };
    expect(eRechnungAus(amt, B).fehlt).toContain(RECHNUNG_LEITWEG_FEHLT);
    const mit = { ...amt, kunde_leitweg_id: "05913000-00012-37" };
    expect(eRechnungAus(mit, B).fehlt).toEqual([]);
    expect(xrechnungUbl(eRechnungAus(mit, B).daten, KU_HINWEIS)).toContain("<cbc:BuyerReference>05913000-00012-37</cbc:BuyerReference>");
    expect(xrechnungUbl(eRechnungAus(RE, B).daten, KU_HINWEIS)).toContain("<cbc:BuyerReference>2026-030</cbc:BuyerReference>");
    expect(leitwegFormatOk("05913000-00012-37")).toBe(true);
    expect(leitwegFormatOk("991-01234-44")).toBe(true);
    expect(leitwegFormatOk("Stadt Dortmund")).toBe(false);
  });
});

describe("C-15: Skonto in BT-20 in eigener Zeile (BR-DE-18)", () => {
  it("#SKONTO#TAGE=10#PROZENT=2.00# allein in der ersten Zeile, Freitext in der Folgezeile", () => {
    const xml = xrechnungUbl(eRechnungAus({ ...RE, skonto: true, skonto_prozent: "2", skonto_tage: "10" }, B).daten, KU_HINWEIS);
    const note = /<cac:PaymentTerms>\s*<cbc:Note>([\s\S]*?)<\/cbc:Note>/.exec(xml)![1]!;
    const zeilen = note.split("\n");
    expect(zeilen[0]).toMatch(/^#SKONTO#TAGE=10#PROZENT=2\.00#$/);
    expect(zeilen[1]).toMatch(/^Bei Zahlung bis zum/);
  });
});

describe("C-4: Schlussrechnung mit abgesetzten Abschlägen", () => {
  const schluss: Daten = {
    ...RE,
    nummer: "2026-019",
    kunde_name: "Autohaus Sommer GmbH",
    positionen: [{ bezeichnung: "Elektroinstallation Werkstatterweiterung", menge: "1", einheit: "Pauschale", preis: "58500", satz: "19" }],
    schluss: true,
    abschlaege: [{ nummer: "2026-014", datum: "2026-06-26", netto: "23400", satz: "19" }],
  };
  it("Abschlag mit Entgelt und Steuer getrennt abgesetzt, Rest zu zahlen (§ 14 Abs. 5 Satz 2 UStG)", () => {
    const h = html(schluss);
    expect(h).toContain("Schlussrechnung 2026-019");
    expect(h).toContain("abzüglich Abschlagsrechnung Nr. 2026-014 vom 26.06.2026: Entgelt");
    expect(h).toContain("-23.400,00 €");
    expect(h).toContain("abzüglich darauf entfallende Umsatzsteuer 19 %");
    expect(h).toContain("-4.446,00 €");
    expect(h).toContain("Noch zu zahlen");
    // 58.500 + 19 % = 69.615,00; abzüglich 27.846,00 → 41.769,00
    expect(h).toContain("41.769,00 €");
    expect(nl(R.ergebnis!(schluss)).at(-1)).toEqual(["Noch zu zahlen", "41.769,00 €"]);
  });
  it("Voranmeldung zählt nur den Rest; XRechnung mit PrepaidAmount und Verweis auf den Abschlag", () => {
    const { daten } = eRechnungAus(schluss, B);
    expect(abschlagsSumme(daten.abschlaege).brutto_cent).toBe(2784600);
    expect(restGruppen(daten)).toEqual([{ satz: 19, netto_cent: 3510000, ust_cent: 666900 }]);
    expect(zahlbetrag(daten)).toBe(4176900);
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    expect(xml).toContain('<cbc:PrepaidAmount currencyID="EUR">27846.00</cbc:PrepaidAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">41769.00</cbc:PayableAmount>');
    expect(xml).toMatch(/<cac:BillingReference>\s*<cac:InvoiceDocumentReference>\s*<cbc:ID>2026-014<\/cbc:ID>/);
    expect(xml).toContain("Abgesetzte Abschlagsrechnungen");
    expect(xml.indexOf("<cbc:PrepaidAmount")).toBeLessThan(xml.indexOf("<cbc:PayableAmount"));
  });
  it("Schlussrechnung ohne Abschläge: Prüfung meldet es", () => {
    expect(pruefe({ ...schluss, abschlaege: [] })).toContain(RECHNUNG_SCHLUSS_LEER);
  });
});

describe("C-6: Ersatzrechnung", () => {
  it("Bezug auf die stornierte Rechnung im Betreff und in der XRechnung (BG-3)", () => {
    const d = { ...RE, ersetzt_nummer: "2026-009" };
    expect(html(d)).toContain("Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-009.");
    expect(xrechnungUbl(eRechnungAus(d, B).daten, KU_HINWEIS)).toMatch(/<cbc:ID>2026-009<\/cbc:ID>/);
    // steht der Bezug schon im Hinweis, nicht doppelt
    expect(html({ ...d, hinweis: "Diese Rechnung ersetzt die stornierte Rechnung Nr. 2026-009 vom 26.06.2026." }).match(/ersetzt die stornierte/g)).toHaveLength(1);
  });
});

describe("5.2: Voranmeldung in vollen Euro mit Zuordnungsannahmen", () => {
  const VA = vorlageFuer("ust_voranmeldung")!;
  const d: Daten = { versteuerung: "soll", zeitraum: "3. Quartal 2026", umsatz_19: "21.095,99", umsatz_7: "100,50", vorsteuer: "1.000,00", nach_rechnungsdatum: "2026-013 | 12.06.2026 | Sarah Demir | 9.924,60" };
  it("Kz 81/86 ohne Cent, Steuer daraus; Zahllast wie ELSTER als letzte Zeile", () => {
    expect(vollEuro(2109599)).toBe(2109500);
    expect(vollEuro(-11250)).toBe(-11200);
    const h = n(dokumentHtml(VA, d, B));
    expect(h).toContain("21.095 €");
    expect(h).toContain("100 €");
    // 21.095 × 19 % = 4.008,05; 100 × 7 % = 7,00 → 4.015,05 − 1.000,00 = 3.015,05
    expect(h).toContain("3.015,05 €");
    expect(h).toContain("Aus den Cent-Beträgen gerechnet");
    const erg = VA.ergebnis!(d);
    expect(erg[2]![0]).toBe("Zahllast");
    expect(nl(erg).at(-1)).toEqual(["Zahllast laut ELSTER (volle Euro)", "3.015,05 €"]);
  });
  it("nach Rechnungsdatum zugeordnete Rechnungen je Rechnung auf dem PDF", () => {
    const h = dokumentHtml(VA, d, B);
    expect(h).toContain("Zuordnungsannahmen");
    expect(h).toContain("2026-013");
    expect(h).toContain("Sarah Demir");
  });
});

describe("5.2/C-9: OSS und Zusammenfassende Meldung", () => {
  it("Rechnung mit OSS: Satz des Bestimmungslands, Land im EU-Ausland; ohne OSS ein Hinweis auf die Lieferschwelle", () => {
    const wien: Daten = { ...RE, kunde_name: "Anna Gruber", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_email: "", kunde_art: "privat", oss: true, oss_satz: "20" };
    const { daten } = eRechnungAus(wien, B);
    expect(daten.oss).toEqual({ land: "AT", satz: 20 });
    expect(daten.positionen[0]!.ust_satz).toBe(20);
    expect(html(wien)).toContain("20 %");
    expect(pruefe(wien)).toEqual([]);
    expect(pruefe({ ...wien, kunde_anschrift: "Am Markt 1\n44135 Dortmund" })).toContain(RECHNUNG_OSS_LAND);
    expect(hinweise({ ...wien, oss: false }).some((h) => h.includes("10.000 €") && h.includes("OSS"))).toBe(true);
  });
  it("Vorlage OSS-Erklärung: Steuer je Land und Satz, Frist ohne Verschiebung", () => {
    const V = vorlageFuer("oss_meldung")!;
    expect(V.pflichten).toEqual(["steuern.oss_erklaerung"]);
    const d: Daten = { zeitraum: "3. Quartal 2026", umsaetze: [{ land: "AT", satz: "20", netto: "1.000,00" }, { land: "NL", satz: "21", netto: "500,00" }] };
    expect(nl(V.ergebnis!(d))).toEqual([["Bemessungsgrundlage", "1.500,00 €"], ["Steuer an das BZSt", "305,00 €"]]);
    const h = dokumentHtml(V, d, B);
    expect(h).toContain("Österreich");
    expect(h).toContain("Niederlande");
    expect(OSS_FRIST).toMatch(/verschiebt sich nicht/);
  });
  it("Vorlage Zusammenfassende Meldung: volle Euro je USt-IdNr. und Art", () => {
    const V = vorlageFuer("zm_meldung")!;
    expect(V.pflichten).toEqual(["steuern.zusammenfassende_meldung"]);
    const d: Daten = { zeitraum: "Juli 2026", meldungen: [{ ust_idnr: "ATU69876543", art: "L", betrag: "841,99" }] };
    expect(nl(V.ergebnis!(d))).toEqual([["Summe der Meldungen", "841,00 €"]]);
    expect(dokumentHtml(V, d, B)).toContain("ATU69876543");
    expect(V.pruefen!({ ...d, meldungen: [{ ust_idnr: "12345", art: "L", betrag: "1" }] }, B).length).toBe(1);
  });
});

describe("Prio 3: Gutschrift-Nummernkreis, Einheitencodes, AllowanceCharge, Registerangaben", () => {
  it("Gutschrift mit Rechnungsnummer: Hinweis auf eigenen Nummernkreis „GS-“", () => {
    const gs = { ...RE, hinweise: ["gutschrift"], kunde_steuernummer: "12/345/67890" };
    expect(hinweise(gs)).toContain(RECHNUNG_GUTSCHRIFT_NUMMER);
    expect(hinweise({ ...gs, nummer: "GS-2026-001" })).not.toContain(RECHNUNG_GUTSCHRIFT_NUMMER);
    expect(istGutschriftNummer("GS-2026-001")).toBe(true);
    expect(istGutschriftNummer("2026-011")).toBe(false);
  });
  it("UN/ECE-Codes je Einheit (HUR, DAY, C62, MTR, LS, KGM, LTR, ANN, IE)", () => {
    expect(["Stunde", "Std.", "Tag", "Stück", "Meter", "m", "Pauschale", "kg", "Liter", "Jahr", "Person"].map(einheitCode)).toEqual(["HUR", "HUR", "DAY", "C62", "MTR", "MTR", "LS", "KGM", "LTR", "ANN", "IE"]);
    expect(hinweise({ ...RE, positionen: [{ bezeichnung: "Kabel", menge: "2", einheit: "Rolle", preis: "10", satz: "19" }] }).some((h) => h.includes("„Rolle“") && h.includes("C62"))).toBe(true);
  });
  it("Nachlass (negativer Preis) als AllowanceCharge auf Dokumentebene statt negativer Menge; Summen nach BR-CO-10/13", () => {
    const d = { ...RE, positionen: [{ bezeichnung: "Installation", menge: "2", einheit: "Stunde", preis: "100", satz: "19" }, { bezeichnung: "Rabatt Stammkunde", menge: "1", einheit: "Pauschale", preis: "-20", satz: "19" }] };
    const xml = xrechnungUbl(eRechnungAus(d, B).daten, KU_HINWEIS);
    expect(xml.match(/<cac:InvoiceLine>/g)).toHaveLength(1);
    expect(xml).not.toMatch(/<cbc:InvoicedQuantity[^>]*>-/);
    expect(xml).toMatch(/<cac:AllowanceCharge>\s*<cbc:ChargeIndicator>false<\/cbc:ChargeIndicator>\s*<cbc:AllowanceChargeReason>Rabatt Stammkunde<\/cbc:AllowanceChargeReason>\s*<cbc:Amount currencyID="EUR">20.00<\/cbc:Amount>\s*<cac:TaxCategory>\s*<cbc:ID>S<\/cbc:ID>\s*<cbc:Percent>19<\/cbc:Percent>/);
    expect(xml).toMatch(/<cbc:LineExtensionAmount currencyID="EUR">200.00<\/cbc:LineExtensionAmount>\s*<cbc:TaxExclusiveAmount currencyID="EUR">180.00<\/cbc:TaxExclusiveAmount>/);
    expect(xml).toContain('<cbc:AllowanceTotalAmount currencyID="EUR">20.00</cbc:AllowanceTotalAmount>');
    expect(xml.indexOf("<cac:AllowanceCharge>")).toBeLessThan(xml.indexOf("<cac:TaxTotal>"));
  });
  it("GmbH mit Registernummer: BT-30 und BT-33 in der PartyLegalEntity", () => {
    const g: Betrieb = { ...B, name: "Salon Sonne GmbH", rechtsform: "GmbH", registergericht: "Amtsgericht Hamburg", registernummer: "HRB 123456", vertretung: "Mara Sonne" };
    const xml = xrechnungUbl(eRechnungAus(RE, g).daten, KU_HINWEIS);
    expect(xml).toMatch(/<cac:PartyLegalEntity>\s*<cbc:RegistrationName>Salon Sonne GmbH<\/cbc:RegistrationName>\s*<cbc:CompanyID>HRB 123456<\/cbc:CompanyID>\s*<cbc:CompanyLegalForm>GmbH, Sitz Dortmund, Amtsgericht Hamburg HRB 123456, Geschäftsführung: Mara Sonne<\/cbc:CompanyLegalForm>/);
    expect(xrechnungUbl(eRechnungAus(RE, B).daten, KU_HINWEIS)).not.toContain("CompanyLegalForm");
  });
});
