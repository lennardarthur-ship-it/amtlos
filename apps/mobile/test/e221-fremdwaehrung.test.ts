/**
 * E-221 Befund 3 in der App: E-Rechnung in fremder Währung – Meldung nicht in Euro, Beleg wartet auf den Euro-Betrag,
 * Original und Kurs bleiben bei Speichern, Sicherung und Synchronisation erhalten und stehen im Steuerberater-Paket.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { belegAusERechnung, belegSummen, eRechnungLesen, fremdUmrechnen } from "@amtlos/fachlogik";
import { syncZusammenfuehren } from "../src/konto/sync";
import { LEERER_STAND, belegSetzen, belegeFestschreiben, standAus, type Stand } from "../src/unterlagen/speicher";
import { steuerpaket } from "../src/unterlagen/steuerpaket";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Elektro Brandt", steuernummer: "231/100/40001" }, profil: { "ust.kleinunternehmer": false } };

const USD = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>INV-1001</cbc:ID><cbc:IssueDate>2026-10-05</cbc:IssueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>USD</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Cloud Tools Inc.</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Elektro Brandt</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="USD">19.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="USD">100.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="USD">19.00</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="USD">100.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="USD">100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="USD">119.00</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="USD">119.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>`;

describe("E-221 Befund 3: fremde Währung in der App", () => {
  const roh = belegAusERechnung(eRechnungLesen(USD)!, "bu", "2026-10-06T08:00:00.000Z");

  it("Beleg aus USD-Rechnung: 0 € bis zum Euro-Betrag; mit Kurs umgerechnet, Kurs bleibt gespeichert – auch nach Sicherung, Sync und Festschreibung", () => {
    let s = belegSetzen(BASIS, roh, t("2026-10-06"));
    expect(belegSummen(s.belege[0]!).brutto_cent).toBe(0);
    const b = s.belege[0]!;
    s = belegSetzen(s, { ...b, steuer: fremdUmrechnen(b.fremd!, 1.0812), fremd: { ...b.fremd!, kurs: 1.0812, kurs_datum: "2026-10-01" } }, t("2026-10-07"));
    expect(belegSummen(s.belege[0]!).brutto_cent).toBe(11006);
    expect(s.belege[0]!.fremd).toMatchObject({ waehrung: "USD", kurs: 1.0812, kurs_datum: "2026-10-01" });
    // Sicherung/Datei und Synchronisation behalten das Feld
    const geladen = standAus(JSON.stringify(s));
    expect(geladen.belege[0]!.fremd).toEqual(s.belege[0]!.fremd);
    const fest = belegeFestschreiben(s, ["bu"], t("2026-10-08"));
    const zusammen = syncZusammenfuehren(fest, geladen).stand;
    expect(zusammen.belege[0]!.fremd).toEqual(s.belege[0]!.fremd);
    expect(zusammen.belege[0]!.festgeschrieben).toBeTruthy();
    // Kurs ändern nach der Festschreibung ist eine Korrektur mit Grund (Inhalt) – ohne Grund nicht
    const ohneGrund = belegSetzen(fest, { ...fest.belege[0]!, fremd: { ...fest.belege[0]!.fremd!, kurs: 1.1 } }, t("2026-10-09"));
    expect(ohneGrund.belege[0]!.fremd!.kurs).toBe(1.0812);
  });

  it("Steuerberater-Paket: Frage mit Original, Kurs bzw. „EURO-BETRAG FEHLT“", () => {
    const s = belegSetzen(BASIS, roh, t("2026-10-06"));
    const p = steuerpaket(s, { von: "2026-10-01", bis: "2026-10-31", name: "2026-10" }, SB, {}, "2026-11-01T10:00:00.000Z");
    const fragen = strFromU8(unzipSync(p.zip)["Fragen_2026-10.txt"]!);
    expect(fragen).toContain("Belege aus Rechnungen in fremder Währung");
    expect(fragen).toContain("Original 119,00 USD · ohne Kurs · EURO-BETRAG FEHLT");
  });

  it("Erfassen: Meldung in der Rechnungswährung (vorher „119,00 €“), Seite mit Kurs und Umrechnung", () => {
    const q = lies("seiten/Belege.tsx");
    expect(q).toContain("else if (b.fremd) melden(");
    expect(q).toContain("fremdBetragText(gelesen.summen.brutto_cent, b.fremd.waehrung)");
    expect(q).toContain("{b.fremd ? <FremdTeil b={b} setze={setze}");
    expect(q).toContain("const steuer = fremdUmrechnen(f, kurs);");
  });
});
