/**
 * E-Rechnung (E-128): XRechnung 3.0 in UBL-Syntax – rein, ohne Node-APIs, damit Server und App dasselbe erzeugen.
 * Der Server macht daraus mit @e-invoice-eu/core CII und ZUGFeRD; die App schreibt das UBL-XML selbst (`xrechnungUbl`).
 * Beide prüft die CI mit dem KoSIT-Validator.
 */
import { EINHEIT_CODE, summen, type RechnungsDaten } from "./rechnung.js";

const betrag = (cent: number) => (cent / 100).toFixed(2);
const geld = (cent: number) => ({ "@currencyID": "EUR" as const, wert: betrag(cent) });

/** Rechnung → UBL-Struktur als JSON (Format der Bibliothek @e-invoice-eu/core auf dem Server, hier auch Grundlage für das XML der App). */
export function eRechnungsDokument(r: RechnungsDaten, kuHinweis: string): Record<string, unknown> {
  const s = summen(r.positionen, r.kleinunternehmer);
  const kategorie = (satz: number | null) => (satz === null ? { "cbc:ID": "E", "cbc:Percent": "0" } : { "cbc:ID": "S", "cbc:Percent": String(satz) });
  const vz = r.art === "storno" ? -1 : 1; // Storno: Rechnungskorrektur mit negativen Beträgen (Typ 384)
  const m = (cent: number) => geld(vz * cent);
  const steuerSchemas = [
    ...(r.steller.ust_idnr ? [{ "cbc:CompanyID": r.steller.ust_idnr, "cac:TaxScheme": { "cbc:ID": "VAT" } }] : []),
    ...(r.steller.steuernummer ? [{ "cbc:CompanyID": r.steller.steuernummer, "cac:TaxScheme": { "cbc:ID": "FC" } }] : []),
  ];
  const doc: Record<string, unknown> = {
    "cbc:CustomizationID": "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
    "cbc:ProfileID": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    "cbc:ID": r.nummer,
    "cbc:IssueDate": r.rechnungsdatum,
    ...(r.faellig_am ? { "cbc:DueDate": r.faellig_am } : {}),
    "cbc:InvoiceTypeCode": r.art === "storno" ? "384" : "380",
    ...(r.hinweis || r.kleinunternehmer ? { "cbc:Note": [r.kleinunternehmer ? kuHinweis : null, r.hinweis].filter(Boolean) } : {}),
    "cbc:DocumentCurrencyCode": "EUR",
    // BT-10 ist in der XRechnung Pflicht; ohne Käuferreferenz verwenden wir die Rechnungsnummer (Prüfpunkt T-07)
    "cbc:BuyerReference": r.kunde.kaeufer_referenz || r.nummer,
    ...(r.art === "storno" && r.storniert_nummer ? { "cac:BillingReference": [{ "cac:InvoiceDocumentReference": { "cbc:ID": r.storniert_nummer } }] } : {}),
    "cac:AccountingSupplierParty": {
      "cac:Party": {
        "cbc:EndpointID": r.steller.email, "cbc:EndpointID@schemeID": "EM",
        // BR-CO-26: ohne USt-IdNr. braucht der Verkäufer eine Kennung (BT-29) – wir setzen die Steuernummer ein (Prüfpunkt T-11)
        ...(!r.steller.ust_idnr && r.steller.steuernummer ? { "cac:PartyIdentification": [{ "cbc:ID": r.steller.steuernummer }] } : {}),
        "cac:PostalAddress": { "cbc:StreetName": r.steller.strasse, "cbc:CityName": r.steller.ort, "cbc:PostalZone": r.steller.plz, "cac:Country": { "cbc:IdentificationCode": r.steller.land } },
        ...(steuerSchemas.length ? { "cac:PartyTaxScheme": steuerSchemas } : {}),
        "cac:PartyLegalEntity": { "cbc:RegistrationName": r.steller.name },
        "cac:Contact": { "cbc:Name": r.steller.name, "cbc:Telephone": r.steller.telefon ?? "", "cbc:ElectronicMail": r.steller.email },
      },
    },
    "cac:AccountingCustomerParty": {
      "cac:Party": {
        ...(r.kunde.email ? { "cbc:EndpointID": r.kunde.email, "cbc:EndpointID@schemeID": "EM" } : {}),
        "cac:PostalAddress": { "cbc:StreetName": r.kunde.strasse ?? "", "cbc:CityName": r.kunde.ort ?? "", "cbc:PostalZone": r.kunde.plz ?? "", "cac:Country": { "cbc:IdentificationCode": r.kunde.land } },
        ...(r.kunde.ust_idnr ? { "cac:PartyTaxScheme": [{ "cbc:CompanyID": r.kunde.ust_idnr, "cac:TaxScheme": { "cbc:ID": "VAT" } }] } : {}),
        "cac:PartyLegalEntity": { "cbc:RegistrationName": r.kunde.name },
      },
    },
    ...(r.leistungsdatum ? { "cac:Delivery": { "cbc:ActualDeliveryDate": r.leistungsdatum } } : {}),
    ...(r.steller.iban
      ? { "cac:PaymentMeans": [{ "cbc:PaymentMeansCode": "58", "cac:PayeeFinancialAccount": { "cbc:ID": r.steller.iban.replace(/\s/g, ""), ...(r.steller.bic ? { "cac:FinancialInstitutionBranch": { "cbc:ID": r.steller.bic } } : {}) } }] }
      : {}),
    "cac:TaxTotal": [
      {
        "cbc:TaxAmount": m(s.ust_cent).wert, "cbc:TaxAmount@currencyID": "EUR",
        "cac:TaxSubtotal": s.gruppen.map((g) => ({
          "cbc:TaxableAmount": m(g.netto_cent).wert, "cbc:TaxableAmount@currencyID": "EUR",
          "cbc:TaxAmount": m(g.ust_cent).wert, "cbc:TaxAmount@currencyID": "EUR",
          "cac:TaxCategory": { ...kategorie(g.satz), ...(g.satz === null ? { "cbc:TaxExemptionReason": kuHinweis } : {}), "cac:TaxScheme": { "cbc:ID": "VAT" } },
        })),
      },
    ],
    "cac:LegalMonetaryTotal": {
      "cbc:LineExtensionAmount": m(s.netto_cent).wert, "cbc:LineExtensionAmount@currencyID": "EUR",
      "cbc:TaxExclusiveAmount": m(s.netto_cent).wert, "cbc:TaxExclusiveAmount@currencyID": "EUR",
      "cbc:TaxInclusiveAmount": m(s.brutto_cent).wert, "cbc:TaxInclusiveAmount@currencyID": "EUR",
      "cbc:PayableAmount": m(s.brutto_cent).wert, "cbc:PayableAmount@currencyID": "EUR",
    },
    "cac:InvoiceLine": r.positionen.map((p, i) => ({
      "cbc:ID": String(i + 1),
      "cbc:InvoicedQuantity": String(vz * p.menge), "cbc:InvoicedQuantity@unitCode": p.einheit_code ?? EINHEIT_CODE[p.einheit],
      "cbc:LineExtensionAmount": m(s.zeilen[i]!).wert, "cbc:LineExtensionAmount@currencyID": "EUR",
      "cac:Item": { "cbc:Name": p.bezeichnung, "cac:ClassifiedTaxCategory": { ...kategorie(r.kleinunternehmer ? null : p.ust_satz), "cac:TaxScheme": { "cbc:ID": "VAT" } } },
      "cac:Price": { "cbc:PriceAmount": betrag(p.preis_cent), "cbc:PriceAmount@currencyID": "EUR" },
    })),
  };
  return { "ubl:Invoice": doc };
}


const NS = {
  "xmlns:ubl": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
};
const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Element aus der JSON-Struktur: Schlüssel „x@attr“ sind Attribute von „x“, Listen wiederholen das Element. */
function element(name: string, wert: unknown, attribute: Record<string, string>, tiefe: number): string {
  const einzug = "  ".repeat(tiefe);
  const attr = Object.entries(attribute).map(([k, v]) => ` ${k}="${escXml(v)}"`).join("");
  if (Array.isArray(wert)) return wert.map((w) => element(name, w, attribute, tiefe)).join("");
  if (wert && typeof wert === "object") return `${einzug}<${name}${attr}>\n${kinder(wert as Record<string, unknown>, tiefe + 1)}${einzug}</${name}>\n`;
  if (wert === null || wert === undefined || wert === "") return "";
  return `${einzug}<${name}${attr}>${escXml(String(wert))}</${name}>\n`;
}
function kinder(o: Record<string, unknown>, tiefe: number): string {
  return Object.entries(o)
    .filter(([k]) => !k.includes("@"))
    .map(([k, w]) => {
      const attribute = Object.fromEntries(Object.entries(o).filter(([a]) => a.startsWith(`${k}@`)).map(([a, v]) => [a.slice(k.length + 1), String(v)]));
      return element(k, w, attribute, tiefe);
    })
    .join("");
}

/** XRechnung 3.0 (UBL) als XML-Text. */
export function xrechnungUbl(r: RechnungsDaten, kuHinweis: string): string {
  const doc = eRechnungsDokument(r, kuHinweis)["ubl:Invoice"] as Record<string, unknown>;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${element("ubl:Invoice", doc, NS, 0)}`;
}

/** Einheit aus dem Freitext der App → UN/ECE-Code (Rec. 20); Unbekanntes als Stück (C62). */
const CODE_JE_TEXT: Record<string, string> = {
  stück: "C62", stueck: "C62", stunde: "HUR", minute: "MIN", tag: "DAY", woche: "WEE", monat: "MON", pauschale: "LS", pauschal: "LS",
  kilogramm: "KGM", gramm: "GRM", liter: "LTR", meter: "MTR", quadratmeter: "MTK", kubikmeter: "MTQ", kilometer: "KMT", kilowattstunde: "KWH",
};
export const einheitCode = (text: string) => CODE_JE_TEXT[text.trim().toLowerCase()] ?? "C62";
