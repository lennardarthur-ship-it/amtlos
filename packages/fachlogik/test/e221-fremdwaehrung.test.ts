/**
 * E-221 Befund 3: Eingehende E-Rechnungen in fremder Währung wurden als Euro übernommen (119 USD → Beleg über 119 €).
 * Jetzt: Währung (BT-5), Steuerwährung (BT-6) und Umsatzsteuer in Abrechnungswährung (BT-111) lesen; ohne Euro-Angabe
 * keine stille Umrechnung – der Beleg wartet auf den Euro-Betrag, Originalwährung und -betrag stehen am Beleg.
 */
import { describe, expect, it } from "vitest";
import { belegAus, belegFassung, belegSummen } from "../src/belege.js";
import { belegAusERechnung, eRechnungLesen, fremdBetragText, fremdUmrechnen, kursAus } from "../src/erechnungLesen.js";

const ubl = (o: { waehrung: string; steuerwaehrung?: string; ustEur?: string; netto?: string; ust?: string; brutto?: string; satz?: string; kategorie?: string }) => {
  const w = o.waehrung;
  const netto = o.netto ?? "100.00";
  const ust = o.ust ?? "19.00";
  const brutto = o.brutto ?? "119.00";
  const satz = o.satz ?? "19";
  const kat = o.kategorie ?? "S";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-1001</cbc:ID><cbc:IssueDate>2026-10-05</cbc:IssueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${w}</cbc:DocumentCurrencyCode>${o.steuerwaehrung ? `<cbc:TaxCurrencyCode>${o.steuerwaehrung}</cbc:TaxCurrencyCode>` : ""}
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Cloud Tools Inc.</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Elektro Brandt</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="${w}">${ust}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${w}">${netto}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${w}">${ust}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${kat}</cbc:ID><cbc:Percent>${satz}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  ${o.ustEur ? `<cac:TaxTotal><cbc:TaxAmount currencyID="${o.steuerwaehrung}">${o.ustEur}</cbc:TaxAmount></cac:TaxTotal>` : ""}
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${w}">${netto}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${w}">${netto}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${w}">${brutto}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${w}">${brutto}</cbc:PayableAmount></cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${w}">${netto}</cbc:LineExtensionAmount><cac:Item><cbc:Name>Lizenz</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${kat}</cbc:ID><cbc:Percent>${satz}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item></cac:InvoiceLine>
</Invoice>`;
};

const cii = (o: { waehrung: string; steuerwaehrung?: string; ustEur?: string }) => `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument><ram:ID>CH-77</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">20261012</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>Uhrenwerk Biel AG</ram:Name><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE811111111</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>Elektro Brandt</ram:Name></ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      ${o.steuerwaehrung ? `<ram:TaxCurrencyCode>${o.steuerwaehrung}</ram:TaxCurrencyCode>` : ""}
      <ram:InvoiceCurrencyCode>${o.waehrung}</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax><ram:CalculatedAmount>38.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>200.00</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>200.00</ram:LineTotalAmount><ram:TaxBasisTotalAmount>200.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${o.waehrung}">38.00</ram:TaxTotalAmount>
        ${o.ustEur ? `<ram:TaxTotalAmount currencyID="${o.steuerwaehrung}">${o.ustEur}</ram:TaxTotalAmount>` : ""}
        <ram:GrandTotalAmount>238.00</ram:GrandTotalAmount><ram:DuePayableAmount>238.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

const JETZT = "2026-10-27T09:00:00.000Z";

describe("E-221 Befund 3: E-Rechnung in fremder Währung", () => {
  it("liest Währung, Steuerwährung (BT-6) und Umsatzsteuer in Abrechnungswährung (BT-111) – UBL und CII", () => {
    const usd = eRechnungLesen(ubl({ waehrung: "USD" }))!;
    expect(usd.waehrung).toBe("USD");
    expect(usd.steuerwaehrung).toBeNull();
    expect(usd.ust_steuerwaehrung_cent).toBeNull();
    const chf = eRechnungLesen(ubl({ waehrung: "CHF", steuerwaehrung: "EUR", ustEur: "19.84" }))!;
    expect(chf.waehrung).toBe("CHF");
    expect(chf.steuerwaehrung).toBe("EUR");
    expect(chf.ust_steuerwaehrung_cent).toBe(1984);
    // die Summen bleiben in Rechnungswährung (das TaxTotal mit Teilbeträgen)
    expect(chf.summen.ust_cent).toBe(1900);
    const ciiChf = eRechnungLesen(cii({ waehrung: "CHF", steuerwaehrung: "EUR", ustEur: "39.68" }))!;
    expect(ciiChf).toMatchObject({ waehrung: "CHF", steuerwaehrung: "EUR", ust_steuerwaehrung_cent: 3968 });
    expect(ciiChf.summen.ust_cent).toBe(3800);
    const eur = eRechnungLesen(ubl({ waehrung: "EUR" }))!;
    expect(eur).toMatchObject({ waehrung: "EUR", steuerwaehrung: null, ust_steuerwaehrung_cent: null });
  });

  it("119 USD wird kein Beleg über 119 €: Euro-Betrag offen, Original mit Währung am Beleg und in der Notiz", () => {
    const r = eRechnungLesen(ubl({ waehrung: "USD" }))!;
    const b = belegAusERechnung(r, "b1", JETZT);
    expect(belegSummen(b).brutto_cent).toBe(0);
    expect(belegSummen(b).vorsteuer_cent).toBe(0);
    expect(b.steuer).toEqual([{ satz: 19, brutto_cent: 0 }]);
    expect(b.fremd).toEqual({ waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 11900 }], ust: 1900 });
    expect(b.notiz).toContain("Rechnung in USD: 119,00 USD (darin Umsatzsteuer 19,00 USD)");
    expect(b.notiz).toContain("§ 16 Abs. 6 UStG");
    expect(b.notiz).not.toContain("119,00 €");
    // CII genauso
    const c = belegAusERechnung(eRechnungLesen(cii({ waehrung: "CHF" }))!, "b2", JETZT);
    expect(belegSummen(c).brutto_cent).toBe(0);
    expect(c.fremd).toMatchObject({ waehrung: "CHF", steuer: [{ satz: 19, brutto_cent: 23800 }], ust: 3800 });
  });

  it("Umsatzsteuer in Euro ausgewiesen (BT-6 = EUR, BT-111): Vorsteuer genau dieser Betrag, Euro-Brutto daraus abgeleitet", () => {
    const b = belegAusERechnung(eRechnungLesen(ubl({ waehrung: "CHF", steuerwaehrung: "EUR", ustEur: "19.84" }))!, "b3", JETZT);
    const s = belegSummen(b);
    expect(s.ust_cent).toBe(1984);
    expect(s.vorsteuer_cent).toBe(1984);
    expect(s.brutto_cent).toBe(12426); // 104,42 € netto + 19,84 € USt
    expect(b.fremd).toMatchObject({ waehrung: "CHF", ust_eur_cent: 1984 });
    expect(b.notiz).toContain("19,84 €");
    expect(b.notiz).toContain("bitte mit dem tatsächlich gezahlten Euro-Betrag abgleichen");
    // CII mit BT-111
    const c = belegAusERechnung(eRechnungLesen(cii({ waehrung: "CHF", steuerwaehrung: "EUR", ustEur: "39.68" }))!, "b4", JETZT);
    expect(belegSummen(c).ust_cent).toBe(3968);
  });

  it("Steuerwährung nicht Euro: keine Übernahme der Steuer als Euro", () => {
    const b = belegAusERechnung(eRechnungLesen(ubl({ waehrung: "USD", steuerwaehrung: "CHF", ustEur: "17.00" }))!, "b5", JETZT);
    expect(belegSummen(b).brutto_cent).toBe(0);
  });

  it("Euro-Rechnungen unverändert (kein Feld fremd, Beträge wie bisher)", () => {
    const b = belegAusERechnung(eRechnungLesen(ubl({ waehrung: "EUR" }))!, "b6", JETZT);
    expect(b.fremd).toBeUndefined();
    expect(belegSummen(b).brutto_cent).toBe(11900);
    expect(b.notiz ?? "").not.toContain("Rechnung in");
  });

  it("Umrechnen nur mit eingegebenem Kurs (1 € = x Einheiten), keine Kurse aus dem Netz", () => {
    expect(kursAus("1,0812")).toBe(1.0812);
    expect(kursAus("0")).toBeNull();
    expect(kursAus("abc")).toBeNull();
    expect(kursAus("1,1234567")).toBeNull();
    expect(fremdUmrechnen({ waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 11900 }] }, 1.0812)).toEqual([{ satz: 19, brutto_cent: 11006 }]);
    expect(fremdBetragText(11900, "USD")).toBe("119,00 USD");
  });

  it("Fremdwährung bleibt beim Speichern/Laden erhalten und gehört zum Inhalt (Änderungsprotokoll)", () => {
    const b = { ...belegAusERechnung(eRechnungLesen(ubl({ waehrung: "USD" }))!, "b7", JETZT), steuer: [{ satz: 19, brutto_cent: 11006 }] };
    const mitKurs = { ...b, fremd: { ...b.fremd!, kurs: 1.0812, kurs_datum: "2026-10-31" } };
    const geladen = belegAus(JSON.parse(JSON.stringify(mitKurs)))!;
    expect(geladen.fremd).toEqual({ waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 11900 }], ust: 1900, kurs: 1.0812, kurs_datum: "2026-10-31" });
    expect(belegFassung(mitKurs, "x").fremd).toEqual(geladen.fremd);
    // Unsinn fällt weg
    expect(belegAus({ ...mitKurs, fremd: { waehrung: "usd!", steuer: [] } })!.fremd).toBeUndefined();
  });
});
