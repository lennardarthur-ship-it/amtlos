/**
 * Eingehende E-Rechnungen lesen (E-133): XRechnung in UBL-Syntax (Invoice, CreditNote) und UN/CEFACT CII (Factur-X,
 * ZUGFeRD) – rein, ohne XML-Bibliothek und ohne Node-APIs, damit Server und App dasselbe lesen. Dazu das eingebettete
 * XML aus einem ZUGFeRD/Factur-X-PDF (mit eigenem Inflate nach RFC 1951) und der Beleg (belege.ts) aus der Rechnung.
 * Geprüft wird nur die Lesbarkeit – die Prüfung nach EN 16931 macht der KoSIT-Validator.
 */
import type { Beleg, BelegSteuer } from "./belege.js";
import { rundeCent } from "./rechnung.js";

// ---------------------------------------------------------------- XML-Elementbaum

/** Element mit lokalem Namen (ohne Präfix), Attributen wie geschrieben, Kindern und dem direkten Text. */
export interface XmlElement {
  name: string;
  /** Name mit Präfix, wie geschrieben – für den Namensraum der Wurzel */
  voll: string;
  attribute: Record<string, string>;
  kinder: XmlElement[];
  text: string;
}

const lokal = (qname: string) => (qname.includes(":") ? qname.slice(qname.indexOf(":") + 1) : qname);
const istLeer = (c: number) => c === 32 || c === 9 || c === 10 || c === 13;
const istTrenner = (c: number) => istLeer(c) || c === 47 /* / */ || c === 62 /* > */ || c === 61 /* = */;

const ENTITAETEN: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Vordefinierte und numerische Entitäten auflösen; Unbekanntes bleibt stehen (keine DTD, keine externen Entitäten). */
function entitaeten(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, (ganz, e: string) => {
    if (e.startsWith("#")) {
      const cp = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ganz;
    }
    return ENTITAETEN[e] ?? ganz;
  });
}

/** Start-Tag ab `<`: Name und Attribute; null bei fehlerhaftem Aufbau. */
function startTag(xml: string, lt: number): { element: XmlElement; ende: number; leer: boolean } | null {
  const n = xml.length;
  let i = lt + 1;
  while (i < n && !istTrenner(xml.charCodeAt(i))) i++;
  const voll = xml.slice(lt + 1, i);
  if (!voll) return null;
  const element: XmlElement = { name: lokal(voll), voll, attribute: {}, kinder: [], text: "" };
  for (;;) {
    while (i < n && istLeer(xml.charCodeAt(i))) i++;
    if (i >= n) return null;
    const c = xml[i];
    if (c === ">") return { element, ende: i + 1, leer: false };
    if (c === "/") return xml[i + 1] === ">" ? { element, ende: i + 2, leer: true } : null;
    const anfang = i;
    while (i < n && !istTrenner(xml.charCodeAt(i))) i++;
    const attrName = xml.slice(anfang, i);
    if (!attrName) return null;
    while (i < n && istLeer(xml.charCodeAt(i))) i++;
    if (xml[i] !== "=") return null;
    i++;
    while (i < n && istLeer(xml.charCodeAt(i))) i++;
    const q = xml[i];
    if (q !== '"' && q !== "'") return null;
    const e = xml.indexOf(q, i + 1);
    if (e < 0) return null;
    element.attribute[attrName] = entitaeten(xml.slice(i + 1, e));
    i = e + 1;
  }
}

/** `<!DOCTYPE …>` überspringen (auch mit interner Teilmenge in `[…]`); Entitäten daraus werden nicht aufgelöst. */
function deklarationEnde(xml: string, von: number): number {
  let tiefe = 0;
  for (let i = von; i < xml.length; i++) {
    const c = xml[i];
    if (c === "[") tiefe++;
    else if (c === "]") tiefe--;
    else if (c === ">" && tiefe <= 0) return i + 1;
  }
  return xml.length;
}

/** XML-Text → Elementbaum (Wurzel). null, wenn das XML nicht wohlgeformt genug ist (offene oder falsch geschlossene Elemente). */
export function xmlBaum(xml: string): XmlElement | null {
  const n = xml.length;
  let i = xml.charCodeAt(0) === 0xfeff ? 1 : 0;
  const stapel: XmlElement[] = [];
  let wurzel: XmlElement | null = null;
  const anhaengen = (t: string) => {
    const offen = stapel[stapel.length - 1];
    if (offen) offen.text += t;
  };
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    if (lt > i) anhaengen(entitaeten(xml.slice(i, lt)));
    if (xml.startsWith("<!--", lt)) {
      const e = xml.indexOf("-->", lt + 4);
      if (e < 0) return null;
      i = e + 3;
    } else if (xml.startsWith("<![CDATA[", lt)) {
      const e = xml.indexOf("]]>", lt + 9);
      if (e < 0) return null;
      anhaengen(xml.slice(lt + 9, e));
      i = e + 3;
    } else if (xml.startsWith("<?", lt)) {
      const e = xml.indexOf("?>", lt + 2);
      if (e < 0) return null;
      i = e + 2;
    } else if (xml.startsWith("<!", lt)) {
      i = deklarationEnde(xml, lt);
    } else if (xml.startsWith("</", lt)) {
      const e = xml.indexOf(">", lt);
      if (e < 0) return null;
      const offen = stapel.pop();
      if (!offen || offen.voll !== xml.slice(lt + 2, e).trim()) return null;
      i = e + 1;
    } else {
      const tag = startTag(xml, lt);
      if (!tag) return null;
      const oben = stapel[stapel.length - 1];
      if (oben) oben.kinder.push(tag.element);
      else if (wurzel) return null; // zweite Wurzel
      else wurzel = tag.element;
      if (!tag.leer) stapel.push(tag.element);
      i = tag.ende;
    }
  }
  return stapel.length ? null : wurzel;
}

const kind = (e: XmlElement | null, name: string): XmlElement | null => e?.kinder.find((k) => k.name === name) ?? null;
const alle = (e: XmlElement | null, name: string): XmlElement[] => e?.kinder.filter((k) => k.name === name) ?? [];
const pfad = (e: XmlElement | null, ...namen: string[]): XmlElement | null => namen.reduce<XmlElement | null>((a, name) => kind(a, name), e);
const text = (e: XmlElement | null): string | null => {
  const t = e?.text.trim();
  return t ? t : null;
};
const textVon = (e: XmlElement | null, ...namen: string[]): string | null => text(pfad(e, ...namen));
/** Attribut über den lokalen Namen (`unitCode`, auch `xyz:unitCode`). */
const attr = (e: XmlElement | null, name: string): string | null => {
  if (!e) return null;
  for (const [k, v] of Object.entries(e.attribute)) if (k === name || k.endsWith(`:${name}`)) return v;
  return null;
};
/** Namensraum des Elements aus seinen eigenen xmlns-Deklarationen; null, wenn dort nicht deklariert. */
const namensraum = (e: XmlElement): string | null => {
  const dp = e.voll.indexOf(":");
  return e.attribute[dp < 0 ? "xmlns" : `xmlns:${e.voll.slice(0, dp)}`] ?? null;
};

// ---------------------------------------------------------------- Werte

const zahl = (s: string | null): number | null => {
  if (s === null) return null;
  const t = s.trim();
  const z = Number(t.includes(".") ? t : t.replace(",", "."));
  return Number.isFinite(z) ? z : null;
};
/** Betrag „119.00“ → Cent, kaufmännisch gerundet. */
const centVon = (s: string | null): number | null => {
  const z = zahl(s);
  return z === null ? null : rundeCent(z * 100);
};
/** Datum als ISO: „2026-10-11“ (UBL, ggf. mit Zeitzone) oder „20261011“ (CII, Format 102; 203 mit Uhrzeit). */
const datumVon = (s: string | null): string | null => {
  if (!s) return null;
  const t = s.trim();
  const cii = /^(\d{4})(\d{2})(\d{2})/.exec(t);
  if (cii) return `${cii[1]}-${cii[2]}-${cii[3]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
};
const ohneMinusNull = (x: number) => (x === 0 ? 0 : x);

/** UN/ECE Rec. 20 → lesbare Einheit; unbekannte Codes bleiben stehen. */
const TEXT_JE_CODE: Record<string, string> = {
  C62: "Stück", H87: "Stück", XPP: "Stück", EA: "Stück", HUR: "Stunde", MIN: "Minute", DAY: "Tag", WEE: "Woche", MON: "Monat", ANN: "Jahr", LS: "Pauschale",
  KGM: "kg", GRM: "g", TNE: "t", LTR: "l", MLT: "ml", MTR: "m", CMT: "cm", KMT: "km", MTK: "m²", MTQ: "m³", KWH: "kWh", E48: "Dienstleistungseinheit",
};
export const einheitText = (code: string) => TEXT_JE_CODE[code] ?? code;

// ---------------------------------------------------------------- Gelesene Rechnung

export interface GeleseneRechnung {
  format: "ubl" | "cii";
  /** Dokumentart (UNTDID 1001): 380 Rechnung, 381 Gutschrift, 384 Korrektur */
  typcode: string | null;
  nummer: string;
  /** Rechnungsdatum, ISO */
  datum: string | null;
  /** Fälligkeit, ISO */
  faellig: string | null;
  lieferant: { name: string; ust_idnr: string | null; steuernummer: string | null; iban: string | null; strasse?: string | null; plz?: string | null; ort?: string | null };
  empfaenger: { name: string; strasse?: string | null; plz?: string | null; ort?: string | null };
  waehrung: string;
  summen: { netto_cent: number; ust_cent: number; brutto_cent: number; zu_zahlen_cent: number };
  /** je Steuersatz; `kategorie` nach UNTDID 5305 (S, E, AE, K, Z, …) */
  saetze: { satz: number; netto_cent: number; ust_cent: number; kategorie: string }[];
  /** `einheit` ist der UN/ECE-Code (C62, HUR, …) – lesbar über `einheitText` */
  positionen: { bezeichnung: string; menge: number; einheit: string; netto_cent: number; satz: number | null }[];
  verwendungszweck: string | null;
  hinweise: string[];
}

const NS_UBL_INVOICE = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const NS_UBL_CREDITNOTE = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";
const NS_CII = "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100";

/**
 * E-Rechnung lesen: UBL 2.1 Invoice/CreditNote (XRechnung) oder CII (Factur-X, ZUGFeRD, XRechnung-CII).
 * Gutschriften (UBL CreditNote, CII TypeCode 381) werden als negative Rechnung geliefert. null bei fremdem Wurzelelement.
 */
export function eRechnungLesen(xml: string): GeleseneRechnung | null {
  const w = xmlBaum(xml);
  if (!w) return null;
  const ns = namensraum(w);
  const passt = (name: string, erwartet: string) => w.name === name && (ns === null || ns === erwartet);
  if (passt("CrossIndustryInvoice", NS_CII)) return ciiLesen(w);
  if (passt("Invoice", NS_UBL_INVOICE)) return ublLesen(w, 1);
  if (passt("CreditNote", NS_UBL_CREDITNOTE)) return ublLesen(w, -1);
  return null;
}

function ublLesen(w: XmlElement, vz: 1 | -1): GeleseneRechnung {
  const geld = (e: XmlElement | null) => {
    const c = centVon(text(e));
    return c === null ? null : ohneMinusNull(vz * c);
  };
  const lieferant = pfad(w, "AccountingSupplierParty", "Party");
  const kunde = pfad(w, "AccountingCustomerParty", "Party");
  // BT-27 ist der eingetragene Name (RegistrationName), BT-28 der Handelsname (PartyName)
  const name = (p: XmlElement | null) => textVon(p, "PartyLegalEntity", "RegistrationName") ?? textVon(p, "PartyName", "Name") ?? "";
  const steuerId = (schema: string) => alle(lieferant, "PartyTaxScheme").map((s) => (textVon(s, "TaxScheme", "ID") === schema ? textVon(s, "CompanyID") : null)).find(Boolean) ?? null;
  const adresse = kind(lieferant, "PostalAddress");
  const zahlung = alle(w, "PaymentMeans");
  const steuern = alle(w, "TaxTotal");
  // bei abweichender Steuerwährung gibt es zwei TaxTotal – das mit den Teilbeträgen ist das in Rechnungswährung
  const steuer = steuern.find((t) => kind(t, "TaxSubtotal")) ?? steuern[0] ?? null;
  const gesamt = kind(w, "LegalMonetaryTotal");
  const netto = geld(kind(gesamt, "TaxExclusiveAmount")) ?? geld(kind(gesamt, "LineExtensionAmount")) ?? 0;
  const ust = geld(kind(steuer, "TaxAmount")) ?? 0;
  const brutto = geld(kind(gesamt, "TaxInclusiveAmount")) ?? netto + ust;
  return {
    format: "ubl",
    typcode: textVon(w, "InvoiceTypeCode") ?? textVon(w, "CreditNoteTypeCode"),
    nummer: textVon(w, "ID") ?? "",
    datum: datumVon(textVon(w, "IssueDate")),
    faellig: datumVon(textVon(w, "DueDate")) ?? zahlung.map((z) => datumVon(textVon(z, "PaymentDueDate"))).find(Boolean) ?? null,
    lieferant: {
      name: name(lieferant),
      ust_idnr: steuerId("VAT"),
      steuernummer: steuerId("FC"),
      iban: zahlung.map((z) => textVon(z, "PayeeFinancialAccount", "ID")).find(Boolean) ?? null,
      strasse: textVon(adresse, "StreetName"),
      plz: textVon(adresse, "PostalZone"),
      ort: textVon(adresse, "CityName"),
    },
    empfaenger: { name: name(kunde), strasse: textVon(kind(kunde, "PostalAddress"), "StreetName"), plz: textVon(kind(kunde, "PostalAddress"), "PostalZone"), ort: textVon(kind(kunde, "PostalAddress"), "CityName") },
    waehrung: textVon(w, "DocumentCurrencyCode") ?? "EUR",
    summen: { netto_cent: netto, ust_cent: ust, brutto_cent: brutto, zu_zahlen_cent: geld(kind(gesamt, "PayableAmount")) ?? brutto },
    saetze: alle(steuer, "TaxSubtotal").map((s) => ({
      satz: zahl(textVon(s, "TaxCategory", "Percent")) ?? 0,
      netto_cent: geld(kind(s, "TaxableAmount")) ?? 0,
      ust_cent: geld(kind(s, "TaxAmount")) ?? 0,
      kategorie: textVon(s, "TaxCategory", "ID") ?? "",
    })),
    positionen: [...alle(w, "InvoiceLine"), ...alle(w, "CreditNoteLine")].map((z) => {
      const menge = kind(z, "InvoicedQuantity") ?? kind(z, "CreditedQuantity");
      return {
        bezeichnung: textVon(z, "Item", "Name") ?? "",
        menge: ohneMinusNull(vz * (zahl(text(menge)) ?? 1)),
        einheit: attr(menge, "unitCode") ?? "",
        netto_cent: geld(kind(z, "LineExtensionAmount")) ?? 0,
        satz: zahl(textVon(z, "Item", "ClassifiedTaxCategory", "Percent")),
      };
    }),
    // nur der Verwendungszweck (BT-83, cbc:PaymentID) – nie die Käuferreferenz (BT-10, z. B. „Kundennr. 10233“)
    verwendungszweck: zahlung.map((z) => textVon(z, "PaymentID")).find(Boolean) ?? null,
    hinweise: alle(w, "Note").map(text).filter((t): t is string => t !== null),
  };
}

function ciiLesen(w: XmlElement): GeleseneRechnung {
  const dokument = kind(w, "ExchangedDocument");
  const typcode = textVon(dokument, "TypeCode");
  const vz = typcode === "381" ? -1 : 1;
  const geld = (e: XmlElement | null) => {
    const c = centVon(text(e));
    return c === null ? null : ohneMinusNull(vz * c);
  };
  const transaktion = kind(w, "SupplyChainTradeTransaction");
  const vereinbarung = kind(transaktion, "ApplicableHeaderTradeAgreement");
  const abrechnung = kind(transaktion, "ApplicableHeaderTradeSettlement");
  const verkaeufer = kind(vereinbarung, "SellerTradeParty");
  const adresse = kind(verkaeufer, "PostalTradeAddress");
  // Steuerkennungen: schemeID VA = USt-IdNr., FC = Steuernummer
  const steuerId = (schema: string) => alle(verkaeufer, "SpecifiedTaxRegistration").map((r) => kind(r, "ID")).map((id) => (attr(id, "schemeID") === schema ? text(id) : null)).find(Boolean) ?? null;
  const waehrung = textVon(abrechnung, "InvoiceCurrencyCode") ?? "EUR";
  const summe = kind(abrechnung, "SpecifiedTradeSettlementHeaderMonetarySummation");
  // TaxTotalAmount kann doppelt vorkommen (Rechnungs- und Steuerwährung)
  const steuerSummen = alle(summe, "TaxTotalAmount");
  const steuerSumme = steuerSummen.find((t) => (attr(t, "currencyID") ?? waehrung) === waehrung) ?? steuerSummen[0] ?? null;
  const netto = geld(kind(summe, "TaxBasisTotalAmount")) ?? geld(kind(summe, "LineTotalAmount")) ?? 0;
  const ust = geld(steuerSumme) ?? 0;
  const brutto = geld(kind(summe, "GrandTotalAmount")) ?? netto + ust;
  return {
    format: "cii",
    typcode,
    nummer: textVon(dokument, "ID") ?? "",
    datum: datumVon(textVon(dokument, "IssueDateTime", "DateTimeString")),
    faellig: alle(abrechnung, "SpecifiedTradePaymentTerms").map((t) => datumVon(textVon(t, "DueDateDateTime", "DateTimeString"))).find(Boolean) ?? null,
    lieferant: {
      name: textVon(verkaeufer, "Name") ?? "",
      ust_idnr: steuerId("VA"),
      steuernummer: steuerId("FC"),
      iban: alle(abrechnung, "SpecifiedTradeSettlementPaymentMeans").map((z) => textVon(z, "PayeePartyCreditorFinancialAccount", "IBANID")).find(Boolean) ?? null,
      strasse: textVon(adresse, "LineOne"),
      plz: textVon(adresse, "PostcodeCode"),
      ort: textVon(adresse, "CityName"),
    },
    empfaenger: { name: textVon(vereinbarung, "BuyerTradeParty", "Name") ?? "", strasse: textVon(vereinbarung, "BuyerTradeParty", "PostalTradeAddress", "LineOne"), plz: textVon(vereinbarung, "BuyerTradeParty", "PostalTradeAddress", "PostcodeCode"), ort: textVon(vereinbarung, "BuyerTradeParty", "PostalTradeAddress", "CityName") },
    waehrung,
    summen: { netto_cent: netto, ust_cent: ust, brutto_cent: brutto, zu_zahlen_cent: geld(kind(summe, "DuePayableAmount")) ?? brutto },
    saetze: alle(abrechnung, "ApplicableTradeTax").map((t) => ({
      satz: zahl(textVon(t, "RateApplicablePercent")) ?? 0,
      netto_cent: geld(kind(t, "BasisAmount")) ?? 0,
      ust_cent: geld(kind(t, "CalculatedAmount")) ?? 0,
      kategorie: textVon(t, "CategoryCode") ?? "",
    })),
    positionen: alle(transaktion, "IncludedSupplyChainTradeLineItem").map((z) => {
      const menge = pfad(z, "SpecifiedLineTradeDelivery", "BilledQuantity");
      const zeile = kind(z, "SpecifiedLineTradeSettlement");
      return {
        bezeichnung: textVon(z, "SpecifiedTradeProduct", "Name") ?? "",
        menge: ohneMinusNull(vz * (zahl(text(menge)) ?? 1)),
        einheit: attr(menge, "unitCode") ?? "",
        netto_cent: geld(pfad(zeile, "SpecifiedTradeSettlementLineMonetarySummation", "LineTotalAmount")) ?? 0,
        satz: zahl(textVon(zeile, "ApplicableTradeTax", "RateApplicablePercent")),
      };
    }),
    // nur der Verwendungszweck (BT-83, ram:PaymentReference) – nie die Käuferreferenz (BT-10)
    verwendungszweck: textVon(abrechnung, "PaymentReference") ?? null,
    hinweise: alle(dokument, "IncludedNote").map((n) => textVon(n, "Content")).filter((t): t is string => t !== null),
  };
}

// ---------------------------------------------------------------- Beleg aus der Rechnung

const euro = (cent: number) => `${(cent / 100).toFixed(2).replace(".", ",")} €`;

/** Rechtsformzusätze und Füllwörter, die beim Namensvergleich nicht zählen */
const NAME_FUELL = new Set(["gmbh", "ug", "haftungsbeschränkt", "ag", "kg", "ohg", "gbr", "ek", "e", "k", "co", "und", "inh", "inhaber", "inhaberin", "mbh", "the", "der", "die", "das"]);
const namensTeile = (s: string) =>
  s
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !NAME_FUELL.has(w));

/**
 * Ist der Käufer der E-Rechnung (BG-7) erkennbar ein anderer als der eigene Betrieb? Gleich gilt: alle Namenswörter
 * (ohne Rechtsform) des einen stecken im anderen – „Elektro Brandt“ und „Elektro Brandt GmbH“, aber nicht „Elektro
 * Becker“ –, der Name der Inhaberin bzw. des Inhabers steht im Käufer, oder die PLZ ist gleich. Ohne Namen auf einer
 * Seite: nicht entscheidbar (false).
 */
export function kaeuferFremd(r: Pick<GeleseneRechnung, "empfaenger">, betrieb: { name: string; plz?: string | null; verantwortlich?: string | null }): boolean {
  const k = namensTeile(r.empfaenger.name);
  const b = namensTeile(betrieb.name);
  if (!k.length || !b.length) return false;
  const alleIn = (a: string[], c: string[]) => a.every((w) => c.includes(w));
  if (alleIn(b, k) || alleIn(k, b)) return false;
  const inhaber = namensTeile(betrieb.verantwortlich ?? "");
  if (inhaber.length && alleIn(inhaber, k)) return false;
  const plz = (x: string | null | undefined) => (x ?? "").replace(/\s/g, "");
  if (plz(r.empfaenger.plz) && plz(r.empfaenger.plz) === plz(betrieb.plz)) return false;
  return true;
}

/** R11: Notiz, wenn die Vorsteuer aus ist, weil der Betrieb nur steuerfreie Umsätze ohne Vorsteuerabzug hat. */
export const NUR_STEUERFREI_HINWEIS = "Vorsteuer ausgeschaltet: Deine Rechnungen sind bisher nur steuerfrei ohne Vorsteuerabzug (§ 4 Nr. 8–29 UStG) – dann ist keine Vorsteuer abziehbar (§ 15 Abs. 2 UStG). Dient die Eingangsleistung auch steuerpflichtigen Umsätzen, bitte prüfen.";

/** Hinweis im Beleg, wenn die E-Rechnung an einen anderen Käufer gerichtet ist (§ 15 Abs. 1 Nr. 1 UStG). */
export const KAEUFER_FREMD = (name: string) => `Die E-Rechnung ist an „${name}“ gerichtet, nicht an deinen Betrieb – ohne Rechnung an dich ist kein Vorsteuerabzug möglich (§ 15 Abs. 1 Nr. 1 UStG). Vorsteuer ausgeschaltet, bitte prüfen.`;

/**
 * Beleg (Eingangsrechnung) aus einer gelesenen E-Rechnung: Brutto je Steuersatz, Vorsteuer wenn Umsatzsteuer
 * ausgewiesen ist, Zahlung per Bank, noch nicht bezahlt. Sätze außer 19/7/0 und Besonderheiten (Reverse Charge,
 * innergemeinschaftlicher Erwerb) landen als Hinweis in der Notiz. Kategorie: Sonstiges – die Zuordnung macht der Betrieb.
 * Kleinunternehmer (§ 19 UStG, `o.kleinunternehmer`): Vorsteuer-Schalter aus – wie beim Beleg von Hand.
 * R11: ebenso, wenn der Betrieb nur steuerfreie Umsätze ohne Vorsteuerabzug hat (§ 4 Nr. 8–29, § 15 Abs. 2 UStG,
 * `o.nurSteuerfrei`) – mit Hinweis in der Notiz; der Schalter lässt sich wieder einschalten.
 */
export function belegAusERechnung(r: GeleseneRechnung, id: string, jetztIso: string, o: { kleinunternehmer?: boolean; nurSteuerfrei?: boolean; betrieb?: { name: string; plz?: string | null; verantwortlich?: string | null } } = {}): Beleg {
  const hinweise: string[] = [];
  // R10: fremd adressierte E-Rechnung – Warnung in der Notiz und kein Vorsteuerabzug
  const fremd = !!o.betrieb && kaeuferFremd(r, o.betrieb);
  if (fremd) hinweise.push(KAEUFER_FREMD(r.empfaenger.name));
  const nachSatz = new Map<number, number>();
  for (const s of r.saetze) {
    let satz = s.satz;
    if (satz !== 19 && satz !== 7 && satz !== 0) {
      hinweise.push(`Steuersatz ${satz} % ist im Beleg nicht vorgesehen – als 0 % übernommen, bitte prüfen.`);
      satz = 0;
    }
    nachSatz.set(satz, (nachSatz.get(satz) ?? 0) + s.netto_cent + s.ust_cent);
  }
  if (!nachSatz.size && r.summen.brutto_cent) {
    nachSatz.set(0, r.summen.brutto_cent);
    hinweise.push("Ohne Aufschlüsselung nach Steuersätzen – Gesamtbetrag als 0 % übernommen, bitte prüfen.");
  }
  const steuer: BelegSteuer[] = [...nachSatz].sort((a, b) => b[0] - a[0]).map(([satz, brutto_cent]) => ({ satz, brutto_cent }));
  const summeSaetze = steuer.reduce((a, s) => a + s.brutto_cent, 0);
  if (summeSaetze !== r.summen.brutto_cent) hinweise.push(`Summe je Steuersatz (${euro(summeSaetze)}) weicht vom Rechnungsbetrag (${euro(r.summen.brutto_cent)}) ab.`);
  // Reverse Charge: als § 13b-Beleg übernehmen – Anbieter aus dem EU-Ausland (USt-IdNr.) als sonstige Leistung, sonst wie eine Bauleistung im Inland (Kz 84/85)
  const ae = r.saetze.length > 0 && r.saetze.every((s) => s.kategorie === "AE");
  const auslandId = /^[A-Z]{2}/.exec((r.lieferant.ust_idnr ?? "").replace(/\s/g, "").toUpperCase())?.[0];
  const steuerschuld: Beleg["steuerschuld"] = ae ? (auslandId && auslandId !== "DE" ? "eu" : "bau") : null;
  if (r.saetze.some((s) => s.kategorie === "AE")) hinweise.push(ae ? "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge): als § 13b-Beleg übernommen – die Umsatzsteuer meldest du selbst an (bitte die Art der Leistung prüfen)." : "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge): Umsatzsteuer selbst anmelden und als Vorsteuer abziehen.");
  if (r.saetze.some((s) => s.kategorie === "K")) hinweise.push("Innergemeinschaftlicher Erwerb: Erwerbsteuer selbst anmelden und als Vorsteuer abziehen.");
  const ohneAbzug = !!o.nurSteuerfrei && !o.kleinunternehmer && !fremd && (r.summen.ust_cent > 0 || !!steuerschuld);
  if (ohneAbzug) hinweise.push(NUR_STEUERFREI_HINWEIS);
  const notiz = [
    r.verwendungszweck ? `Verwendungszweck: ${r.verwendungszweck}` : null,
    r.lieferant.iban ? `IBAN: ${r.lieferant.iban}` : null,
    r.faellig ? `Fällig am ${r.faellig}` : null,
    ...hinweise,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    id,
    datum: r.datum ?? jetztIso.slice(0, 10),
    lieferant: r.lieferant.name,
    nummer: r.nummer || null,
    kategorie: "sonstiges",
    steuer,
    vorsteuer: !fremd && !o.kleinunternehmer && !o.nurSteuerfrei && (r.summen.ust_cent > 0 || !!steuerschuld),
    zahlung: "bank",
    bezahlt: null,
    notiz: notiz || null,
    quelle: "erechnung",
    erstellt: jetztIso,
    geaendert: jetztIso,
    ...(steuerschuld ? { steuerschuld } : {}),
  };
}

// ---------------------------------------------------------------- Inflate (RFC 1951)

const LAENGE_BASIS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LAENGE_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANZ_BASIS = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DISTANZ_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
/** Reihenfolge der Codelängen-Codes im dynamischen Block */
const CL_REIHENFOLGE = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** Kanonischer Huffman-Code: Anzahl Codes je Länge und Symbole in Codereihenfolge (wie zlib/puff). */
interface Huffman {
  anzahl: Uint16Array;
  symbole: Uint16Array;
}

function huffman(laengen: ArrayLike<number>, n: number): Huffman {
  const anzahl = new Uint16Array(16);
  for (let i = 0; i < n; i++) anzahl[laengen[i]!]!++;
  anzahl[0] = 0;
  const versatz = new Uint16Array(16);
  for (let len = 1; len < 15; len++) versatz[len + 1] = versatz[len]! + anzahl[len]!;
  const symbole = new Uint16Array(n);
  for (let i = 0; i < n; i++) if (laengen[i]) symbole[versatz[laengen[i]!]!++] = i;
  return { anzahl, symbole };
}

const FEST_LITERAL = huffman([...Array<number>(144).fill(8), ...Array<number>(112).fill(9), ...Array<number>(24).fill(7), ...Array<number>(8).fill(8)], 288);
const FEST_DISTANZ = huffman(Array<number>(30).fill(5), 30);

class Bitleser {
  private pos = 0;
  private puffer = 0;
  private gefuellt = 0;
  constructor(private readonly daten: Uint8Array) {}
  bits(n: number): number {
    while (this.gefuellt < n) {
      if (this.pos >= this.daten.length) throw new Error("Deflate: Daten enden vorzeitig");
      this.puffer |= this.daten[this.pos++]! << this.gefuellt;
      this.gefuellt += 8;
    }
    const wert = this.puffer & ((1 << n) - 1);
    this.puffer >>>= n;
    this.gefuellt -= n;
    return wert;
  }
  /** Rest des angefangenen Bytes verwerfen (vor einem gespeicherten Block) */
  anByte() {
    this.puffer = 0;
    this.gefuellt = 0;
  }
  byte(): number {
    if (this.pos >= this.daten.length) throw new Error("Deflate: Daten enden vorzeitig");
    return this.daten[this.pos++]!;
  }
  symbol(h: Huffman): number {
    let code = 0;
    let erster = 0;
    let index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= this.bits(1);
      const anzahl = h.anzahl[len]!;
      if (code - anzahl < erster) return h.symbole[index + (code - erster)]!;
      index += anzahl;
      erster = (erster + anzahl) << 1;
      code <<= 1;
    }
    throw new Error("Deflate: ungültiger Huffman-Code");
  }
}

/**
 * Obergrenze für entpackte Daten (G-2): Eine E-Rechnung im PDF ist wenige hundert KB groß. Eine präparierte Datei
 * („Entpackbombe“) könnte sonst aus 15 MB mehrere GB machen und die App zum Absturz bringen.
 */
export const INFLATE_HOECHSTENS = 20 * 1024 * 1024;

class Ausgabe {
  private puffer: Uint8Array;
  laenge = 0;
  constructor(
    erwartet: number,
    private max = INFLATE_HOECHSTENS,
  ) {
    this.puffer = new Uint8Array(Math.min(this.max, Math.max(1024, erwartet)));
  }
  schreibe(b: number) {
    if (this.laenge === this.puffer.length) {
      if (this.laenge >= this.max) throw new Error("Deflate: entpackte Daten zu groß");
      const neu = new Uint8Array(Math.min(this.max, this.puffer.length * 2));
      neu.set(this.puffer);
      this.puffer = neu;
    }
    this.puffer[this.laenge++] = b;
  }
  zurueck(abstand: number): number {
    if (abstand > this.laenge) throw new Error("Deflate: Rückverweis vor den Anfang");
    return this.puffer[this.laenge - abstand]!;
  }
  ergebnis(): Uint8Array {
    return this.puffer.slice(0, this.laenge);
  }
}

function inflateRoh(daten: Uint8Array, max: number): Uint8Array {
  const b = new Bitleser(daten);
  const aus = new Ausgabe(daten.length * 4, max);
  let letzter = 0;
  while (!letzter) {
    letzter = b.bits(1);
    const art = b.bits(2);
    if (art === 0) {
      b.anByte();
      const len = b.byte() | (b.byte() << 8);
      const nlen = b.byte() | (b.byte() << 8);
      if (len !== (~nlen & 0xffff)) throw new Error("Deflate: Länge des gespeicherten Blocks stimmt nicht");
      for (let i = 0; i < len; i++) aus.schreibe(b.byte());
      continue;
    }
    let literal = FEST_LITERAL;
    let distanz = FEST_DISTANZ;
    if (art === 2) {
      const nlit = b.bits(5) + 257;
      const ndist = b.bits(5) + 1;
      const ncode = b.bits(4) + 4;
      if (nlit > 286 || ndist > 30) throw new Error("Deflate: zu viele Codes");
      const laengen = new Uint8Array(320);
      for (let i = 0; i < ncode; i++) laengen[CL_REIHENFOLGE[i]!] = b.bits(3);
      const codeCode = huffman(laengen, 19);
      let i = 0;
      while (i < nlit + ndist) {
        const sym = b.symbol(codeCode);
        if (sym < 16) laengen[i++] = sym;
        else {
          let wiederholung: number;
          let wert = 0;
          if (sym === 16) {
            if (i === 0) throw new Error("Deflate: Wiederholung ohne Vorgänger");
            wert = laengen[i - 1]!;
            wiederholung = 3 + b.bits(2);
          } else if (sym === 17) wiederholung = 3 + b.bits(3);
          else wiederholung = 11 + b.bits(7);
          if (i + wiederholung > nlit + ndist) throw new Error("Deflate: zu viele Codelängen");
          while (wiederholung--) laengen[i++] = wert;
        }
      }
      literal = huffman(laengen, nlit);
      distanz = huffman(laengen.subarray(nlit), ndist);
    } else if (art !== 1) throw new Error("Deflate: ungültiger Blocktyp");
    for (;;) {
      const sym = b.symbol(literal);
      if (sym < 256) aus.schreibe(sym);
      else if (sym === 256) break;
      else {
        const l = sym - 257;
        if (l >= 29) throw new Error("Deflate: ungültiger Längencode");
        const laenge = LAENGE_BASIS[l]! + b.bits(LAENGE_EXTRA[l]!);
        const d = b.symbol(distanz);
        if (d >= 30) throw new Error("Deflate: ungültiger Distanzcode");
        const abstand = DISTANZ_BASIS[d]! + b.bits(DISTANZ_EXTRA[d]!);
        for (let k = 0; k < laenge; k++) aus.schreibe(aus.zurueck(abstand));
      }
    }
  }
  return aus.ergebnis();
}

/** zlib-Strom (RFC 1950, wie /FlateDecode im PDF) oder roher Deflate-Strom (RFC 1951) entpacken. Wirft bei kaputten Daten. */
export function inflate(daten: Uint8Array, max = INFLATE_HOECHSTENS): Uint8Array {
  const b0 = daten[0] ?? 0;
  const b1 = daten[1] ?? 0;
  if (daten.length >= 2 && (b0 & 0x0f) === 8 && ((b0 << 8) | b1) % 31 === 0) {
    try {
      return inflateRoh(daten.subarray(b1 & 0x20 ? 6 : 2), max);
    } catch (e) {
      // zu groß: nicht noch einmal als Rohstrom entpacken
      if (e instanceof Error && e.message.includes("zu groß")) throw e;
      // kein zlib-Kopf, sondern zufällig passende Rohdaten – unten als roher Strom versuchen
    }
  }
  return inflateRoh(daten, max);
}

// ---------------------------------------------------------------- XML aus ZUGFeRD/Factur-X-PDF

/** Bytes als Latin-1-Text: ein Zeichen je Byte, damit Positionen im Text den Byte-Positionen entsprechen. */
function latin1(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
}

/** UTF-8 (mit oder ohne BOM) oder UTF-16 mit BOM → Text; ungültige Folgen werden zu U+FFFD. */
function textAusBytes(b: Uint8Array): string {
  const teile: string[] = [];
  if ((b[0] === 0xfe && b[1] === 0xff) || (b[0] === 0xff && b[1] === 0xfe)) {
    const be = b[0] === 0xfe;
    for (let i = 2; i + 1 < b.length; i += 2) teile.push(String.fromCharCode(be ? (b[i]! << 8) | b[i + 1]! : b[i]! | (b[i + 1]! << 8)));
    return teile.join("");
  }
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  let s = "";
  while (i < b.length) {
    const c = b[i]!;
    let cp: number;
    if (c < 0x80) {
      cp = c;
      i++;
    } else if (c >= 0xc2 && c < 0xe0 && i + 1 < b.length) {
      cp = ((c & 0x1f) << 6) | (b[i + 1]! & 0x3f);
      i += 2;
    } else if (c >= 0xe0 && c < 0xf0 && i + 2 < b.length) {
      cp = ((c & 0x0f) << 12) | ((b[i + 1]! & 0x3f) << 6) | (b[i + 2]! & 0x3f);
      i += 3;
    } else if (c >= 0xf0 && c < 0xf5 && i + 3 < b.length) {
      cp = ((c & 0x07) << 18) | ((b[i + 1]! & 0x3f) << 12) | ((b[i + 2]! & 0x3f) << 6) | (b[i + 3]! & 0x3f);
      i += 4;
    } else {
      cp = 0xfffd;
      i++;
    }
    s += String.fromCodePoint(cp);
    if (s.length >= 8192) {
      teile.push(s);
      s = "";
    }
  }
  teile.push(s);
  return teile.join("");
}

/** Ende eines PDF-Wörterbuchs ab `<<` (Position hinter dem schließenden `>>`), Strings und Kommentare übersprungen; -1 wenn offen. */
function woerterbuchEnde(t: string, von: number): number {
  let tiefe = 0;
  let k = von;
  while (k < t.length) {
    const c = t[k];
    if (c === "<") {
      if (t[k + 1] === "<") {
        tiefe++;
        k += 2;
      } else {
        const e = t.indexOf(">", k); // Hex-String
        k = e < 0 ? t.length : e + 1;
      }
    } else if (c === ">" && t[k + 1] === ">") {
      tiefe--;
      k += 2;
      if (tiefe === 0) return k;
    } else if (c === "(") {
      let klammern = 1;
      k++;
      while (k < t.length && klammern > 0) {
        if (t[k] === "\\") k += 2;
        else {
          if (t[k] === "(") klammern++;
          else if (t[k] === ")") klammern--;
          k++;
        }
      }
    } else if (c === "%") {
      while (k < t.length && t[k] !== "\n" && t[k] !== "\r") k++;
    } else k++;
  }
  return -1;
}

/** Position hinter `N G obj` des Objekts N – bei mehreren Fassungen (inkrementelle Änderungen) die letzte. */
function objektAnfang(t: string, nummer: number): number {
  const re = new RegExp(`(?:^|[^0-9])${nummer}\\s+\\d+\\s+obj\\b`, "g");
  let ergebnis = -1;
  for (let m = re.exec(t); m; m = re.exec(t)) ergebnis = m.index + m[0].length;
  return ergebnis;
}

/** Wert eines Objekts, das nur eine ganze Zahl enthält (indirekte /Length). */
function ganzzahlObjekt(t: string, nummer: number): number | null {
  const anfang = objektAnfang(t, nummer);
  const m = anfang < 0 ? null : /^\s*(\d+)\s*endobj/.exec(t.slice(anfang, anfang + 40));
  return m ? Number(m[1]) : null;
}

/** Wörterbuch und Rohdaten eines Stream-Objekts; Länge aus /Length (direkt oder indirekt), sonst bis `endstream`. */
function streamAb(t: string, bytes: Uint8Array, anfang: number): { woerterbuch: string; daten: Uint8Array } | null {
  let i = anfang;
  while (i < t.length && istLeer(t.charCodeAt(i))) i++;
  if (!t.startsWith("<<", i)) return null;
  const ende = woerterbuchEnde(t, i);
  if (ende < 0) return null;
  const woerterbuch = t.slice(i, ende);
  const strom = /^\s*stream(?:\r\n|\n|\r)/.exec(t.slice(ende, ende + 40));
  if (!strom) return null;
  const datenAnfang = ende + strom[0].length;
  const laengeM = /\/Length\s+(\d+)(?:\s+(\d+)\s+R)?/.exec(woerterbuch);
  const laenge = laengeM ? (laengeM[2] !== undefined ? ganzzahlObjekt(t, Number(laengeM[1])) : Number(laengeM[1])) : null;
  let datenEnde: number;
  if (laenge !== null && datenAnfang + laenge <= bytes.length && /^\s*endstream/.test(t.slice(datenAnfang + laenge, datenAnfang + laenge + 20))) datenEnde = datenAnfang + laenge;
  else {
    datenEnde = t.indexOf("endstream", datenAnfang);
    if (datenEnde < 0) return null;
    if (t[datenEnde - 1] === "\n") datenEnde--;
    if (t[datenEnde - 1] === "\r") datenEnde--;
  }
  return { woerterbuch, daten: bytes.subarray(datenAnfang, datenEnde) };
}

/** Inhalt eines Stream-Objekts als Text; null bei unbekanntem Filter oder kaputten Daten. */
function streamText(t: string, bytes: Uint8Array, anfang: number): string | null {
  const s = streamAb(t, bytes, anfang);
  if (!s) return null;
  const filter = /\/Filter\s*\[?\s*\/(\w+)/.exec(s.woerterbuch)?.[1] ?? null;
  try {
    const roh = filter === null ? s.daten : filter === "FlateDecode" ? inflate(s.daten) : null;
    return roh ? textAusBytes(roh) : null;
  } catch {
    return null;
  }
}

const istERechnungXml = (xml: string) => /^\s*(<\?xml|<)/.test(xml) && /CrossIndustryInvoice|:Invoice-2|:CreditNote-2|<(\w+:)?Invoice[\s>]/.test(xml);

/**
 * Eingebettetes XML einer ZUGFeRD/Factur-X-Rechnung aus den PDF-Bytes: zuerst über den Dateinamen (factur-x.xml,
 * zugferd-invoice.xml, xrechnung.xml) und die Dateispezifikation (/EF), sonst über alle /EmbeddedFile-Ströme, die eine
 * E-Rechnung enthalten. null, wenn nichts gefunden wird. Es werden nur /FlateDecode und unkomprimierte Ströme gelesen.
 */
export function eRechnungAusPdf(bytes: Uint8Array): string | null {
  const t = latin1(bytes);
  const namen = /factur-x\.xml|zugferd-invoice\.xml|xrechnung\.xml/gi;
  for (let m = namen.exec(t); m; m = namen.exec(t)) {
    const objekt = t.slice(Math.max(0, t.lastIndexOf("obj", m.index)), t.indexOf("endobj", m.index) < 0 ? t.length : t.indexOf("endobj", m.index));
    const ef = /\/EF\s*(?:<<\s*\/\w+\s+(\d+)\s+\d+\s+R|(\d+)\s+\d+\s+R)/.exec(objekt);
    if (!ef) continue;
    let nummer = ef[1] !== undefined ? Number(ef[1]) : null;
    if (nummer === null) {
      // /EF verweist auf ein eigenes Wörterbuch-Objekt
      const anfang = objektAnfang(t, Number(ef[2]));
      const ref = anfang < 0 ? null : /\/\w+\s+(\d+)\s+\d+\s+R/.exec(t.slice(anfang, anfang + 200));
      nummer = ref ? Number(ref[1]) : null;
    }
    const anfang = nummer === null ? -1 : objektAnfang(t, nummer);
    const xml = anfang < 0 ? null : streamText(t, bytes, anfang);
    if (xml && /^\s*</.test(xml)) return xml;
  }
  // Ohne lesbare Dateispezifikation (z. B. in einem Objektstrom): alle eingebetteten Dateien durchsehen
  const eingebettet = /\/Type\s*\/EmbeddedFile\b/g;
  for (let m = eingebettet.exec(t); m; m = eingebettet.exec(t)) {
    const obj = t.lastIndexOf("obj", m.index);
    if (obj < 0) continue;
    const xml = streamText(t, bytes, obj + 3);
    if (xml && istERechnungXml(xml)) return xml;
  }
  return null;
}
