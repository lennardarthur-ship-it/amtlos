import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { belegSummen } from "../src/belege.js";
import { xrechnungUbl } from "../src/erechnung.js";
import { belegAusERechnung, eRechnungAusPdf, eRechnungLesen, einheitText, inflate, xmlBaum, type GeleseneRechnung } from "../src/erechnungLesen.js";
import { KU_HINWEIS, summen, type RechnungsDaten } from "../src/rechnung.js";

const BASIS: RechnungsDaten = {
  nummer: "2026-0001", rechnungsdatum: "2026-10-11", leistungsdatum: "2026-10-01", faellig_am: "2026-10-25",
  steller: { name: "Annas Café", strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart", land: "DE", email: "anna@example.org", telefon: "+49 711 123", steuernummer: "93815/08152", ust_idnr: "DE123456789", iban: "DE02 1203 0000 0000 2020 51", bic: "BYLADEM1001" },
  kunde: { name: "Kunde GmbH", strasse: "Ring 5", plz: "10115", ort: "Berlin", land: "DE", email: "einkauf@kunde.example", kaeufer_referenz: "PO-77", geschaeftskunde: true },
  positionen: [
    { bezeichnung: "Beratung", menge: 2.5, einheit: "stunde", preis_cent: 8000, ust_satz: 19 },
    { bezeichnung: "Fachbuch", menge: 1, einheit: "stueck", preis_cent: 2999, ust_satz: 7 },
  ],
  kleinunternehmer: false,
  hinweis: "Vielen Dank für Ihren Auftrag.",
};

/** Factur-X (Profil EN 16931) von Hand, wie sie ein Lieferant schickt: zwei Steuersätze, IBAN, Fälligkeit, Verwendungszweck. */
const CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>L-2026-4711</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20261003</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote><ram:Content>Lieferung frei Haus.</ram:Content></ram:IncludedNote>
    <ram:IncludedNote><ram:Content>Zahlbar innerhalb von 14 Tagen.</ram:Content><ram:SubjectCode>PMT</ram:SubjectCode></ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>Kaffeebohnen Hausröstung</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>12.50</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="KGM">8</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>7</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>100.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>2</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>Wartung Siebträgermaschine</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>80.00</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="HUR">2.5</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>200.00</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>Filiale Süd</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>Rösterei Bergmann e.K.</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>79098</ram:PostcodeCode>
          <ram:LineOne>Kaiser-Joseph-Straße 8</ram:LineOne>
          <ram:CityName>Freiburg</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">06/123/45678</ram:ID></ram:SpecifiedTaxRegistration>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE987654321</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>Café Mond GmbH</ram:Name>
        <ram:PostalTradeAddress><ram:PostcodeCode>50667</ram:PostcodeCode><ram:LineOne>Mondstraße 12</ram:LineOne><ram:CityName>Köln</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">20261001</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>L-2026-4711</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>DE89370400440532013000</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>7.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>100.00</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>7</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>38.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>200.00</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>14 Tage netto</ram:Description>
        <ram:DueDateDateTime><udt:DateTimeString format="102">20261017</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>300.00</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>300.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">45.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>345.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>345.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

/**
 * Kleinstes PDF mit eingebetteter Rechnung, wie ZUGFeRD/Factur-X sie anhängen: Filespec mit /EF auf einen
 * /EmbeddedFile-Strom – wahlweise mit FlateDecode (zlib wie im PDF), indirekter /Length oder falscher /Length.
 */
function miniPdf(xml: string, o: { komprimiert?: boolean; name?: string; laengeIndirekt?: boolean; laengeFalsch?: boolean } = {}): Uint8Array {
  const inhalt = Buffer.from(xml, "utf8");
  const daten = o.komprimiert ? zlib.deflateSync(inhalt) : inhalt;
  const name = o.name ?? "factur-x.xml";
  const laenge = o.laengeIndirekt ? "6 0 R" : String(o.laengeFalsch ? daten.length + 17 : daten.length);
  const teile = [
    Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1"),
    Buffer.from(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(${name}) 4 0 R] >> >> /AF [4 0 R] >>\nendobj\n`, "latin1"),
    Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n", "latin1"),
    Buffer.from(`4 0 obj\n<< /Type /Filespec /F (${name}) /UF (${name}) /AFRelationship /Alternative /Desc (Rechnung) /EF << /F 5 0 R /UF 5 0 R >> >>\nendobj\n`, "latin1"),
    Buffer.from(`5 0 obj\n<< /Type /EmbeddedFile /Subtype /text#2Fxml /Length ${laenge}${o.komprimiert ? " /Filter /FlateDecode" : ""} /Params << /Size ${inhalt.length} /ModDate (D:20261013120000Z) >> >>\nstream\n`, "latin1"),
    daten,
    Buffer.from("\nendstream\nendobj\n", "latin1"),
    ...(o.laengeIndirekt ? [Buffer.from(`6 0 obj\n${daten.length}\nendobj\n`, "latin1")] : []),
    Buffer.from("trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"),
  ];
  return new Uint8Array(Buffer.concat(teile));
}

describe("E-Rechnungen lesen (Eingang)", () => {
  it("liest die eigene XRechnung (UBL) – Nummer, Datum, Lieferant, IBAN, Summen und Sätze wie summen()", () => {
    const xml = xrechnungUbl(BASIS, KU_HINWEIS);
    const r = eRechnungLesen(xml)!;
    const s = summen(BASIS.positionen, false);
    expect(r.format).toBe("ubl");
    expect(r.typcode).toBe("380");
    expect(r.nummer).toBe("2026-0001");
    expect(r.datum).toBe("2026-10-11");
    expect(r.faellig).toBe("2026-10-25");
    expect(r.lieferant).toEqual({ name: "Annas Café", ust_idnr: "DE123456789", steuernummer: "93815/08152", iban: "DE02120300000000202051", strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart" });
    expect(r.empfaenger.name).toBe("Kunde GmbH");
    expect(r.waehrung).toBe("EUR");
    expect(r.summen).toEqual({ netto_cent: s.netto_cent, ust_cent: s.ust_cent, brutto_cent: s.brutto_cent, zu_zahlen_cent: s.brutto_cent });
    expect(r.summen).toEqual({ netto_cent: 22999, ust_cent: 4010, brutto_cent: 27009, zu_zahlen_cent: 27009 });
    expect(r.saetze).toEqual(s.gruppen.map((g) => ({ satz: g.satz, netto_cent: g.netto_cent, ust_cent: g.ust_cent, kategorie: "S" })));
    expect(r.positionen).toEqual([
      { bezeichnung: "Beratung", menge: 2.5, einheit: "HUR", netto_cent: 20000, satz: 19 },
      { bezeichnung: "Fachbuch", menge: 1, einheit: "C62", netto_cent: 2999, satz: 7 },
    ]);
    expect(r.positionen.map((p) => einheitText(p.einheit))).toEqual(["Stunde", "Stück"]);
    // ohne PaymentID dient die Käuferreferenz als Verwendungszweck
    expect(r.verwendungszweck).toBe("PO-77");
    expect(r.hinweise).toEqual(["Vielen Dank für Ihren Auftrag."]);
  });

  it("Storno (Typ 384) kommt mit negativen Beträgen, Kleinunternehmer mit Kategorie E und ohne Steuer", () => {
    const storno = eRechnungLesen(xrechnungUbl({ ...BASIS, nummer: "2026-0003", art: "storno", storniert_nummer: "2026-0001" }, KU_HINWEIS))!;
    expect(storno.typcode).toBe("384");
    expect(storno.summen).toEqual({ netto_cent: -22999, ust_cent: -4010, brutto_cent: -27009, zu_zahlen_cent: -27009 });
    expect(storno.positionen[0]).toMatchObject({ menge: -2.5, netto_cent: -20000 });
    const ku = eRechnungLesen(xrechnungUbl({ ...BASIS, kleinunternehmer: true, steller: { ...BASIS.steller, ust_idnr: null }, positionen: BASIS.positionen.map((p) => ({ ...p, ust_satz: null })) }, KU_HINWEIS))!;
    expect(ku.lieferant.ust_idnr).toBeNull();
    expect(ku.lieferant.steuernummer).toBe("93815/08152");
    expect(ku.summen).toEqual({ netto_cent: 22999, ust_cent: 0, brutto_cent: 22999, zu_zahlen_cent: 22999 });
    expect(ku.saetze).toEqual([{ satz: 0, netto_cent: 22999, ust_cent: 0, kategorie: "E" }]);
    expect(ku.hinweise).toEqual([KU_HINWEIS, "Vielen Dank für Ihren Auftrag."]);
  });

  it("UBL CreditNote wird als negative Rechnung gelesen", () => {
    const xml = `<?xml version="1.0"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>GS-9</cbc:ID><cbc:IssueDate>2026-09-30</cbc:IssueDate><cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>Lieferant OHG</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Ich</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentDueDate>2026-10-14</cbc:PaymentDueDate><cbc:PaymentID>Gutschrift GS-9</cbc:PaymentID></cac:PaymentMeans>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">1.90</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">10.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">1.90</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">10.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">11.90</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">11.90</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:CreditNoteLine><cbc:ID>1</cbc:ID><cbc:CreditedQuantity unitCode="C62">1</cbc:CreditedQuantity><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Retoure</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item></cac:CreditNoteLine>
</CreditNote>`;
    const r = eRechnungLesen(xml)!;
    expect(r).toMatchObject({ format: "ubl", typcode: "381", nummer: "GS-9", datum: "2026-09-30", faellig: "2026-10-14", verwendungszweck: "Gutschrift GS-9" });
    expect(r.lieferant.name).toBe("Lieferant OHG");
    expect(r.summen).toEqual({ netto_cent: -1000, ust_cent: -190, brutto_cent: -1190, zu_zahlen_cent: -1190 });
    expect(r.saetze).toEqual([{ satz: 19, netto_cent: -1000, ust_cent: -190, kategorie: "S" }]);
    expect(r.positionen).toEqual([{ bezeichnung: "Retoure", menge: -1, einheit: "C62", netto_cent: -1000, satz: 19 }]);
  });

  it("liest Factur-X (CII, EN 16931) mit zwei Sätzen, IBAN, Fälligkeit und Hinweisen", () => {
    const r = eRechnungLesen(CII)!;
    expect(r.format).toBe("cii");
    expect(r.typcode).toBe("380");
    expect(r.nummer).toBe("L-2026-4711");
    expect(r.datum).toBe("2026-10-03");
    expect(r.faellig).toBe("2026-10-17");
    expect(r.lieferant).toEqual({ name: "Rösterei Bergmann e.K.", ust_idnr: "DE987654321", steuernummer: "06/123/45678", iban: "DE89370400440532013000", strasse: "Kaiser-Joseph-Straße 8", plz: "79098", ort: "Freiburg" });
    expect(r.empfaenger.name).toBe("Café Mond GmbH");
    expect(r.waehrung).toBe("EUR");
    expect(r.summen).toEqual({ netto_cent: 30000, ust_cent: 4500, brutto_cent: 34500, zu_zahlen_cent: 34500 });
    expect(r.saetze).toEqual([
      { satz: 7, netto_cent: 10000, ust_cent: 700, kategorie: "S" },
      { satz: 19, netto_cent: 20000, ust_cent: 3800, kategorie: "S" },
    ]);
    expect(r.positionen).toEqual([
      { bezeichnung: "Kaffeebohnen Hausröstung", menge: 8, einheit: "KGM", netto_cent: 10000, satz: 7 },
      { bezeichnung: "Wartung Siebträgermaschine", menge: 2.5, einheit: "HUR", netto_cent: 20000, satz: 19 },
    ]);
    expect(r.verwendungszweck).toBe("L-2026-4711");
    expect(r.hinweise).toEqual(["Lieferung frei Haus.", "Zahlbar innerhalb von 14 Tagen."]);
  });

  it("löst Entitäten und CDATA auf, überspringt Kommentare, Deklaration und DOCTYPE", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Invoice [ <!ENTITY fremd "nicht aufgelöst"> ]>
<!-- Kommentar mit <Invoice> darin -->
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>R&amp;D-1</cbc:ID>
  <cbc:IssueDate>2026-10-05</cbc:IssueDate>
  <cbc:Note><![CDATA[Hinweis <mit> & Zeichen]]></cbc:Note>
  <cbc:Note>Caf&#233; &#x20AC; &quot;Mond&quot; &apos;OK&apos; &lt;3 &gt; &fremd;</cbc:Note>
  <!-- Kommentar zwischen Elementen -->
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>M&amp;M &lt;GmbH&gt;</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyName><cbc:Name>Kunde</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount currencyID='EUR'>10.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">11.90</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">11.90</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="EUR">10.00</cbc:LineExtensionAmount><cac:Item><cbc:Name>Ding</cbc:Name></cac:Item></cac:InvoiceLine>
</ubl:Invoice>`;
    const r = eRechnungLesen(xml)!;
    expect(r.nummer).toBe("R&D-1");
    expect(r.lieferant.name).toBe("M&M <GmbH>");
    expect(r.hinweise).toEqual(["Hinweis <mit> & Zeichen", "Café € \"Mond\" 'OK' <3 > &fremd;"]);
    // ohne TaxTotal: Steuer aus Brutto minus Netto, Satz der Position unbekannt
    expect(r.summen).toEqual({ netto_cent: 1000, ust_cent: 0, brutto_cent: 1190, zu_zahlen_cent: 1190 });
    expect(r.saetze).toEqual([]);
    expect(r.positionen[0]!.satz).toBeNull();
    // der Elementbaum selbst: Präfixe fallen weg, Attribute bleiben, Leer-Elemente und BOM sind in Ordnung
    const b = xmlBaum('﻿<a:x xmlns:a="u" n="1"><a:y/><z k=\'v\'>t</z></a:x>')!;
    expect(b).toMatchObject({ name: "x", voll: "a:x", attribute: { "xmlns:a": "u", n: "1" } });
    expect(b.kinder.map((k) => k.name)).toEqual(["y", "z"]);
    expect(b.kinder[1]).toMatchObject({ attribute: { k: "v" }, text: "t" });
  });

  it("fremdes oder kaputtes XML ergibt null", () => {
    expect(eRechnungLesen("<?xml version=\"1.0\"?><Bestellung><ID>1</ID></Bestellung>")).toBeNull();
    expect(eRechnungLesen('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Order-2"><cbc:ID>1</cbc:ID></Invoice>')).toBeNull();
    expect(eRechnungLesen("")).toBeNull();
    expect(eRechnungLesen("kein xml")).toBeNull();
    expect(eRechnungLesen("<Invoice><ID>offen</Invoice>")).toBeNull();
    expect(eRechnungLesen("%PDF-1.7 binär")).toBeNull();
    // ohne Namensraum zählt der Wurzelname
    expect(eRechnungLesen("<Invoice><ID>7</ID></Invoice>")).toMatchObject({ format: "ubl", nummer: "7" });
  });

  it("belegAusERechnung: Brutto je Satz, Vorsteuer, Zahlung per Bank, Notiz mit Verwendungszweck und IBAN", () => {
    const r = eRechnungLesen(CII)!;
    const b = belegAusERechnung(r, "beleg-1", "2026-10-13T09:15:00.000Z");
    expect(b).toMatchObject({ id: "beleg-1", datum: "2026-10-03", lieferant: "Rösterei Bergmann e.K.", nummer: "L-2026-4711", kategorie: "sonstiges", vorsteuer: true, zahlung: "bank", bezahlt: null, quelle: "erechnung", erstellt: "2026-10-13T09:15:00.000Z", geaendert: "2026-10-13T09:15:00.000Z" });
    expect(b.steuer).toEqual([{ satz: 19, brutto_cent: 23800 }, { satz: 7, brutto_cent: 10700 }]);
    expect(belegSummen(b)).toEqual({ brutto_cent: 34500, netto_cent: 30000, ust_cent: 4500, vorsteuer_cent: 4500 });
    expect(b.notiz).toBe("Verwendungszweck: L-2026-4711\nIBAN: DE89370400440532013000\nFällig am 2026-10-17");
    // Kleinunternehmer-Rechnung: keine Vorsteuer; ohne Datum gilt der Tag des Imports
    const ku: GeleseneRechnung = { ...r, datum: null, verwendungszweck: null, faellig: null, lieferant: { ...r.lieferant, iban: null }, summen: { netto_cent: 5000, ust_cent: 0, brutto_cent: 5000, zu_zahlen_cent: 5000 }, saetze: [{ satz: 0, netto_cent: 5000, ust_cent: 0, kategorie: "E" }] };
    const bk = belegAusERechnung(ku, "beleg-2", "2026-10-13T09:15:00.000Z");
    expect(bk).toMatchObject({ datum: "2026-10-13", vorsteuer: false, notiz: null, steuer: [{ satz: 0, brutto_cent: 5000 }] });
    // fremder Satz (16 %) wird auf 0 % abgebildet und vermerkt; Reverse Charge bekommt einen Hinweis
    const fremd: GeleseneRechnung = { ...r, summen: { netto_cent: 20000, ust_cent: 1600, brutto_cent: 21600, zu_zahlen_cent: 21600 }, saetze: [{ satz: 16, netto_cent: 10000, ust_cent: 1600, kategorie: "S" }, { satz: 0, netto_cent: 10000, ust_cent: 0, kategorie: "AE" }] };
    const bf = belegAusERechnung(fremd, "beleg-3", "2026-10-13T09:15:00.000Z");
    expect(bf.steuer).toEqual([{ satz: 0, brutto_cent: 21600 }]);
    expect(bf.notiz).toContain("Steuersatz 16 % ist im Beleg nicht vorgesehen");
    expect(bf.notiz).toContain("Reverse Charge");
    // ohne Aufschlüsselung: Gesamtbetrag als 0 % mit Hinweis
    const ohne = belegAusERechnung({ ...r, saetze: [] }, "beleg-4", "2026-10-13T09:15:00.000Z");
    expect(ohne.steuer).toEqual([{ satz: 0, brutto_cent: 34500 }]);
    expect(ohne.notiz).toContain("Ohne Aufschlüsselung");
  });

  it("inflate: gespeicherte, feste und dynamische Huffman-Blöcke, zlib-Kopf und roher Strom", () => {
    const text = Buffer.from(Array.from({ length: 400 }, (_, i) => `Zeile ${i}: Rösterei Bergmann liefert Kaffee, Kaffee, Kaffee. `).join("\n"), "utf8");
    expect(Buffer.from(inflate(zlib.deflateSync(text, { level: 0 }))).equals(text)).toBe(true); // gespeichert
    expect(Buffer.from(inflate(zlib.deflateSync(text, { strategy: zlib.constants.Z_FIXED }))).equals(text)).toBe(true); // feste Codes
    expect(Buffer.from(inflate(zlib.deflateSync(text))).equals(text)).toBe(true); // dynamische Codes
    expect(Buffer.from(inflate(zlib.deflateRawSync(text))).equals(text)).toBe(true); // ohne zlib-Kopf
    // pseudozufällige Bytes mit Wiederholungen: lange Distanzen und alle Längencodes
    let z = 12345;
    const zufall = Buffer.alloc(200_000);
    for (let i = 0; i < zufall.length; i++) {
      z = (z * 1103515245 + 12345) & 0x7fffffff;
      zufall[i] = i % 7 === 0 && i > 40_000 ? zufall[i - 33_000]! : z >> 16;
    }
    expect(Buffer.from(inflate(zlib.deflateSync(zufall, { level: 9 }))).equals(zufall)).toBe(true);
    expect(inflate(zlib.deflateSync(Buffer.alloc(0)))).toEqual(new Uint8Array(0));
    expect(() => inflate(new Uint8Array([0x78, 0x9c, 0xff, 0xff]))).toThrow();
  });

  it("eRechnungAusPdf: eingebettetes XML mit FlateDecode, unkomprimiert, mit indirekter oder falscher /Length", () => {
    const xml = xrechnungUbl(BASIS, KU_HINWEIS);
    expect(eRechnungAusPdf(miniPdf(xml, { komprimiert: true }))).toBe(xml);
    expect(eRechnungAusPdf(miniPdf(xml))).toBe(xml);
    expect(eRechnungAusPdf(miniPdf(xml, { komprimiert: true, laengeIndirekt: true }))).toBe(xml);
    expect(eRechnungAusPdf(miniPdf(xml, { komprimiert: true, laengeFalsch: true }))).toBe(xml);
    expect(eRechnungAusPdf(miniPdf(CII, { komprimiert: true, name: "ZUGFeRD-invoice.xml" }))).toBe(CII);
    expect(eRechnungAusPdf(miniPdf(CII, { komprimiert: true, name: "xrechnung.xml" }))).toBe(CII);
    // gelesen und als Beleg verwendbar
    const r = eRechnungLesen(eRechnungAusPdf(miniPdf(CII, { komprimiert: true }))!)!;
    expect(r.summen.brutto_cent).toBe(34500);
    // ohne Dateinamen findet die Suche über /EmbeddedFile-Ströme die Rechnung, eine fremde Datei nicht
    expect(eRechnungAusPdf(miniPdf(CII, { komprimiert: true, name: "anhang.xml" }))).toBe(CII);
    expect(eRechnungAusPdf(miniPdf("<Bestellung/>", { komprimiert: true, name: "bestellung.xml" }))).toBeNull();
    expect(eRechnungAusPdf(new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n", "latin1")))).toBeNull();
    expect(eRechnungAusPdf(new Uint8Array(0))).toBeNull();
  });
});
