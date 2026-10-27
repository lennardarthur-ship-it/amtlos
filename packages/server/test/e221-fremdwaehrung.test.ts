/**
 * E-221 Befund 3 (Server, Beleg-Upload über die API): Eine E-Rechnung in fremder Währung wurde mit ihren Beträgen als
 * Euro in app.beleg gespeichert (119 USD → brutto_cent 11900). Jetzt: ohne Euro-Angabe bleiben Brutto und Steuer leer
 * (der Betrieb trägt den Euro-Betrag ein), die Umsatzsteuer in Euro laut Rechnung (BT-6 = EUR, BT-111) wird übernommen;
 * Währung und Originalbeträge stehen in e_rechnung.
 */
import { describe, expect, it } from "vitest";
import { belegBetraegeEuro, eRechnungLesen } from "../src/finanzen.js";

const ubl = (w: string, extra = "") => `<?xml version="1.0"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"><cbc:ID>R-8</cbc:ID><cbc:IssueDate>2026-09-30</cbc:IssueDate><cbc:DocumentCurrencyCode>${w}</cbc:DocumentCurrencyCode>${extra ? "<cbc:TaxCurrencyCode>EUR</cbc:TaxCurrencyCode>" : ""}<cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Cloud Tools Inc.</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty><cac:TaxTotal><cbc:TaxAmount currencyID="${w}">19.00</cbc:TaxAmount></cac:TaxTotal>${extra}<cac:LegalMonetaryTotal><cbc:TaxInclusiveAmount currencyID="${w}">119.00</cbc:TaxInclusiveAmount></cac:LegalMonetaryTotal></Invoice>`;
const cii = (w: string, eur?: string) => `<?xml version="1.0"?><rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"><rsm:ExchangedDocument><ram:ID>CH-1</ram:ID></rsm:ExchangedDocument><rsm:SupplyChainTradeTransaction><ram:ApplicableHeaderTradeSettlement>${eur ? "<ram:TaxCurrencyCode>EUR</ram:TaxCurrencyCode>" : ""}<ram:InvoiceCurrencyCode>${w}</ram:InvoiceCurrencyCode><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:TaxTotalAmount currencyID="${w}">38.00</ram:TaxTotalAmount>${eur ? `<ram:TaxTotalAmount currencyID="EUR">${eur}</ram:TaxTotalAmount>` : ""}<ram:GrandTotalAmount>238.00</ram:GrandTotalAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`;

describe("E-221 Befund 3: Beleg-Upload in fremder Währung", () => {
  it("USD ohne Euro-Angabe: Brutto und Steuer leer, Original bleibt in den gelesenen Daten", () => {
    const g = eRechnungLesen(ubl("USD"));
    expect(g).toMatchObject({ waehrung: "USD", brutto_cent: 11900, ust_cent: 1900, steuerwaehrung: null, ust_steuerwaehrung_cent: null });
    expect(belegBetraegeEuro(g)).toEqual({ brutto_cent: null, ust_cent: null });
    expect(belegBetraegeEuro(eRechnungLesen(cii("CHF")))).toEqual({ brutto_cent: null, ust_cent: null });
  });
  it("Umsatzsteuer in Euro laut Rechnung (BT-6/BT-111): Steuer übernommen, Brutto offen", () => {
    const g = eRechnungLesen(ubl("CHF", '<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">19.84</cbc:TaxAmount></cac:TaxTotal>'));
    expect(g).toMatchObject({ waehrung: "CHF", ust_cent: 1900, steuerwaehrung: "EUR", ust_steuerwaehrung_cent: 1984 });
    expect(belegBetraegeEuro(g)).toEqual({ brutto_cent: null, ust_cent: 1984 });
    const c = eRechnungLesen(cii("CHF", "39.68"));
    expect(c).toMatchObject({ ust_cent: 3800, ust_steuerwaehrung_cent: 3968 });
    expect(belegBetraegeEuro(c)).toEqual({ brutto_cent: null, ust_cent: 3968 });
  });
  it("Euro wie bisher", () => {
    expect(belegBetraegeEuro(eRechnungLesen(ubl("EUR")))).toEqual({ brutto_cent: 11900, ust_cent: 1900 });
  });
});
