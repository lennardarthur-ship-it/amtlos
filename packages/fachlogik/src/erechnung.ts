/**
 * E-Rechnung (E-128): XRechnung 3.0 in UBL-Syntax – rein, ohne Node-APIs, damit Server und App dasselbe erzeugen.
 * Der Server macht daraus mit @e-invoice-eu/core CII und ZUGFeRD; die App schreibt das UBL-XML selbst (`xrechnungUbl`).
 * Beide prüft die CI mit dem KoSIT-Validator.
 */
import { EINHEIT_CODE, summen, type RechnungsDaten } from "./rechnung.js";
import { istEuAusland } from "./buchungen.js";
import { prozentText, skontoBetrag, zahlungsbedingungenMitSkonto } from "./skonto.js";

const betrag = (cent: number) => (cent / 100).toFixed(2);
const geld = (cent: number) => ({ "@currencyID": "EUR" as const, wert: betrag(cent) });

/** Ausfuhrlieferung (§ 4 Nr. 1 Buchst. a UStG) im Befreiungshinweis */
const AUSFUHR_IM_TEXT = /§\s*4\s+Nr\.\s*1\s*(?:Buchst\.\s*)?a(?![a-zäöü])/i;

interface Partei {
  name: string; strasse?: string | null; plz?: string | null; ort?: string | null; land: string; email?: string | null; telefon?: string | null;
  steuernummer?: string | null; ust_idnr?: string | null;
}

/**
 * Rechnung → UBL-Struktur als JSON (Format der Bibliothek @e-invoice-eu/core auf dem Server, hier auch Grundlage für das XML der App).
 *
 * R11 (Steuerberatung):
 * - Gutschrift (§ 14 Abs. 2 Satz 2 UStG): Typ 389, Verkäufer (BG-4) ist der Leistende mit seiner Steuernummer bzw.
 *   USt-IdNr., Käufer (BG-7) der Betrieb, der die Gutschrift ausstellt.
 * - Steuerkategorien: Nullsteuersatz Z, Ausfuhrlieferung G (VATEX-EU-G, nur mit USt-IdNr. des Verkäufers – BR-G-02,
 *   sonst wie bisher E), Steuerschuldnerschaft eines Empfängers im Drittland O (VATEX-EU-O: nicht im Inland steuerbar).
 * - Abschlagsrechnung: Typ 326 (Teilrechnung) statt 380.
 */
export function eRechnungsDokument(r: RechnungsDaten, kuHinweis: string): Record<string, unknown> {
  const s = summen(r.positionen, r.kleinunternehmer);
  const gs = r.gutschrift === true;
  // Verkäufer und Käufer: bei einer Gutschrift rechnet der Betrieb (steller) als Käufer über die Leistung des Kunden ab
  const betrieb: Partei = r.steller;
  const gegenueber: Partei = r.kunde;
  const verkaeufer = gs ? gegenueber : betrieb;
  const kaeufer = gs ? betrieb : gegenueber;
  const land = (r.kunde.land || "DE").toUpperCase();
  // Steuerschuldnerschaft eines Unternehmens im Drittland: im Inland nicht steuerbar (O) – nur, wenn die ganze Rechnung 0 % ist (BR-O-11 ff.)
  const drittlandO = !r.kleinunternehmer && r.steuerart === "reverse_charge" && land !== "DE" && !istEuAusland(land) && s.gruppen.every((g) => g.satz === 0);
  const ausfuhrG = r.steuerart === "befreit" && AUSFUHR_IM_TEXT.test(r.befreiungsgrund ?? "") && !!verkaeufer.ust_idnr;
  // Steuerkategorie (UNTDID 5305): S Normal, E befreit (auch Kleinunternehmer), AE Steuerschuldnerschaft des Empfängers,
  // K innergemeinschaftliche Lieferung, Z Nullsteuersatz, G Ausfuhr, O nicht steuerbar
  const null0 = r.steuerart === "reverse_charge" ? (drittlandO ? "O" : "AE") : r.steuerart === "igl" ? "K" : r.steuerart === "nullsatz" ? "Z" : ausfuhrG ? "G" : "E";
  // O: in der Position ohne Steuersatz (BR-O-05), in der Aufschlüsselung mit 0 % – XRechnung verlangt BT-119 (BR-DE-14)
  const kategorie = (satz: number | null, zeile = false) => (satz === null ? { "cbc:ID": "E", "cbc:Percent": "0" } : satz === 0 ? (null0 === "O" && zeile ? { "cbc:ID": "O" } : { "cbc:ID": null0, "cbc:Percent": "0" }) : { "cbc:ID": "S", "cbc:Percent": String(satz) });
  // Kleinunternehmer mit Leistung an ein Unternehmen im EU-Ausland: Hinweis auf die Steuerschuldnerschaft statt § 19 (Kategorie bleibt E)
  const kuText = r.kleinunternehmer && r.steuerart === "reverse_charge" ? "Steuerschuldnerschaft des Leistungsempfängers" : kuHinweis;
  const befreiung = (satz: number | null): Record<string, string> =>
    satz === null
      ? { "cbc:TaxExemptionReason": kuText }
      : satz !== 0
        ? {}
        : null0 === "O"
          ? { "cbc:TaxExemptionReasonCode": "VATEX-EU-O", "cbc:TaxExemptionReason": "Nicht im Inland steuerbare Leistung (Steuerschuldnerschaft des Leistungsempfängers)" }
          : null0 === "AE"
            ? { "cbc:TaxExemptionReasonCode": "VATEX-EU-AE", "cbc:TaxExemptionReason": "Steuerschuldnerschaft des Leistungsempfängers" }
            : null0 === "K"
              ? { "cbc:TaxExemptionReasonCode": "VATEX-EU-IC", "cbc:TaxExemptionReason": "Steuerfreie innergemeinschaftliche Lieferung" }
              : null0 === "Z"
                ? {} // Nullsteuersatz: kein Befreiungsgrund (BR-Z-10)
                : null0 === "G"
                  ? { "cbc:TaxExemptionReasonCode": "VATEX-EU-G", "cbc:TaxExemptionReason": r.befreiungsgrund || "Steuerfreie Ausfuhrlieferung" }
                  : { "cbc:TaxExemptionReason": r.befreiungsgrund ?? "" };
  const vz = r.art === "storno" ? -1 : 1; // Storno: Rechnungskorrektur mit negativen Beträgen (Typ 384)
  const m = (cent: number) => geld(vz * cent);
  // nicht steuerbar (O): keine USt-IdNr. von Verkäufer und Käufer (BR-O-02)
  const mitUstId = null0 !== "O";
  const steuerSchemas = [
    ...(verkaeufer.ust_idnr && mitUstId ? [{ "cbc:CompanyID": verkaeufer.ust_idnr, "cac:TaxScheme": { "cbc:ID": "VAT" } }] : []),
    ...(verkaeufer.steuernummer ? [{ "cbc:CompanyID": verkaeufer.steuernummer, "cac:TaxScheme": { "cbc:ID": "FC" } }] : []),
  ];
  // BR-CO-26: ohne USt-IdNr. braucht der Verkäufer eine Kennung (BT-29) – die Steuernummer (Prüfpunkt T-11), bei O ohne Steuernummer die USt-IdNr.
  const kennung = !(verkaeufer.ust_idnr && mitUstId) ? (verkaeufer.steuernummer || verkaeufer.ust_idnr || null) : null;
  const anschrift = (p: Partei) => ({ "cbc:StreetName": p.strasse ?? "", "cbc:CityName": p.ort ?? "", "cbc:PostalZone": p.plz ?? "", "cac:Country": { "cbc:IdentificationCode": p.land || "DE" } });
  const typ = r.art === "storno" ? "384" : gs ? "389" : r.abschlag ? "326" : "380";
  const doc: Record<string, unknown> = {
    "cbc:CustomizationID": "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
    "cbc:ProfileID": "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0",
    "cbc:ID": r.nummer,
    "cbc:IssueDate": r.rechnungsdatum,
    ...(r.faellig_am ? { "cbc:DueDate": r.faellig_am } : {}),
    "cbc:InvoiceTypeCode": typ,
    ...(r.hinweis || r.kleinunternehmer ? { "cbc:Note": [r.kleinunternehmer ? kuText : null, r.hinweis].filter(Boolean) } : {}),
    "cbc:DocumentCurrencyCode": "EUR",
    // BT-10 ist in der XRechnung Pflicht: Leitweg-ID bzw. Käuferreferenz, ohne sie die Rechnungsnummer (Prüfpunkt T-07);
    // bei einer Gutschrift ist der Betrieb der Käufer – dann die Nummer
    "cbc:BuyerReference": (!gs && r.kunde.kaeufer_referenz) || r.nummer,
    // Leistungszeitraum statt Leistungsdatum (BG-14: BT-73 Beginn, BT-74 Ende)
    ...(!r.leistungsdatum && r.leistungszeitraum ? { "cac:InvoicePeriod": { "cbc:StartDate": r.leistungszeitraum.von, "cbc:EndDate": r.leistungszeitraum.bis } } : {}),
    // Bestellnummer des Käufers (BT-13) – in UBL nach InvoicePeriod, vor BillingReference
    ...(r.bestellnummer ? { "cac:OrderReference": { "cbc:ID": r.bestellnummer } } : {}),
    ...(r.art === "storno" && r.storniert_nummer ? { "cac:BillingReference": [{ "cac:InvoiceDocumentReference": { "cbc:ID": r.storniert_nummer } }] } : {}),
    "cac:AccountingSupplierParty": {
      "cac:Party": {
        "cbc:EndpointID": verkaeufer.email ?? "", "cbc:EndpointID@schemeID": "EM",
        ...(kennung ? { "cac:PartyIdentification": [{ "cbc:ID": kennung }] } : {}),
        "cac:PostalAddress": anschrift(verkaeufer),
        ...(steuerSchemas.length ? { "cac:PartyTaxScheme": steuerSchemas } : {}),
        "cac:PartyLegalEntity": { "cbc:RegistrationName": verkaeufer.name },
        "cac:Contact": { "cbc:Name": verkaeufer.name, "cbc:Telephone": verkaeufer.telefon ?? "", "cbc:ElectronicMail": verkaeufer.email ?? "" },
      },
    },
    "cac:AccountingCustomerParty": {
      "cac:Party": {
        ...(kaeufer.email ? { "cbc:EndpointID": kaeufer.email, "cbc:EndpointID@schemeID": "EM" } : {}),
        "cac:PostalAddress": anschrift(kaeufer),
        ...(kaeufer.ust_idnr && mitUstId ? { "cac:PartyTaxScheme": [{ "cbc:CompanyID": kaeufer.ust_idnr, "cac:TaxScheme": { "cbc:ID": "VAT" } }] } : {}),
        "cac:PartyLegalEntity": { "cbc:RegistrationName": kaeufer.name },
      },
    },
    // Lieferanschrift mit Land (BT-80) ist bei innergemeinschaftlichen Lieferungen Pflicht (BR-IC-12, BR-DE-10/11): die Anschrift des Empfängers
    ...(r.leistungsdatum || r.steuerart === "igl"
      ? { "cac:Delivery": { ...(r.leistungsdatum ? { "cbc:ActualDeliveryDate": r.leistungsdatum } : {}), ...(r.steuerart === "igl" ? { "cac:DeliveryLocation": { "cac:Address": anschrift(kaeufer) } } : {}) } }
      : {}),
    // Zahlungsanweisung (BG-16, BR-DE-1): Überweisung auf das Konto des Betriebs; bei einer Gutschrift zahlt der Betrieb
    // selbst – die Bankverbindung des Leistenden kennt die App nicht, daher „1“ (nicht festgelegt)
    ...(gs
      ? { "cac:PaymentMeans": [{ "cbc:PaymentMeansCode": "1" }] }
      : r.steller.iban
        ? { "cac:PaymentMeans": [{ "cbc:PaymentMeansCode": "58", "cac:PayeeFinancialAccount": { "cbc:ID": r.steller.iban.replace(/\s/g, ""), ...(r.steller.bic ? { "cac:FinancialInstitutionBranch": { "cbc:ID": r.steller.bic } } : {}) } }] }
        : {}),
    // R12: Skonto als Zahlungsbedingung (BT-20) – Zeile nach BR-DE-18, dann der Satz für Menschen; nur bei Rechnungen mit Zahlung
    ...(r.skonto && !gs && r.art !== "storno" && s.brutto_cent > 0
      ? { "cac:PaymentTerms": { "cbc:Note": zahlungsbedingungenMitSkonto(r.skonto, `Bei Zahlung bis zum ${r.skonto.bis.slice(8, 10)}.${r.skonto.bis.slice(5, 7)}.${r.skonto.bis.slice(0, 4)} (innerhalb von ${r.skonto.tage} Tagen) ${prozentText(r.skonto.prozent)} % Skonto (${betrag(skontoBetrag(s.brutto_cent, r.skonto.prozent))} EUR).`) } }
      : {}),
    "cac:TaxTotal": [
      {
        "cbc:TaxAmount": m(s.ust_cent).wert, "cbc:TaxAmount@currencyID": "EUR",
        "cac:TaxSubtotal": s.gruppen.map((g) => ({
          "cbc:TaxableAmount": m(g.netto_cent).wert, "cbc:TaxableAmount@currencyID": "EUR",
          "cbc:TaxAmount": m(g.ust_cent).wert, "cbc:TaxAmount@currencyID": "EUR",
          "cac:TaxCategory": { ...kategorie(g.satz), ...befreiung(g.satz), "cac:TaxScheme": { "cbc:ID": "VAT" } },
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
      // Nachlass (negativer Preis): Preis bleibt positiv, die Menge wird negativ (BR-27: Preis nie negativ)
      "cbc:InvoicedQuantity": String(vz * Math.sign(p.preis_cent || 1) * p.menge), "cbc:InvoicedQuantity@unitCode": p.einheit_code ?? EINHEIT_CODE[p.einheit],
      "cbc:LineExtensionAmount": m(s.zeilen[i]!).wert, "cbc:LineExtensionAmount@currencyID": "EUR",
      "cac:Item": { "cbc:Name": p.bezeichnung, "cac:ClassifiedTaxCategory": { ...kategorie(r.kleinunternehmer ? null : p.ust_satz, true), "cac:TaxScheme": { "cbc:ID": "VAT" } } },
      "cac:Price": { "cbc:PriceAmount": betrag(Math.abs(p.preis_cent)), "cbc:PriceAmount@currencyID": "EUR" },
    })),
  };
  return { "ubl:Invoice": doc };
}


const NS = {
  "xmlns:ubl": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  "xmlns:cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  "xmlns:cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
};
// Steuerzeichen (z. B. aus Word kopierte Zeilenumbrüche) sind in XML 1.0 verboten und machen die E-Rechnung ungültig
// eslint-disable-next-line no-control-regex
const escXml = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
  // Mehrzahl (die Rechnung beugt die Einheit nach der Menge) und gängige Kurzformen
  stunden: "HUR", minuten: "MIN", tage: "DAY", wochen: "WEE", monate: "MON", pauschalen: "LS", kilowattstunden: "KWH",
  stk: "C62", "stk.": "C62", std: "HUR", "std.": "HUR", h: "HUR", min: "MIN", "min.": "MIN", kg: "KGM", g: "GRM", l: "LTR", m: "MTR",
  "m²": "MTK", m2: "MTK", qm: "MTK", "m³": "MTQ", m3: "MTQ", km: "KMT", kwh: "KWH", "lfm": "MTR", "lfd. m": "MTR",
};
export const einheitCode = (text: string) => CODE_JE_TEXT[text.trim().toLowerCase()] ?? "C62";
