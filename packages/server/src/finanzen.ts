/**
 * Finanzen light (Bauabschnitt 4, Spezifikation 6.5): Summen, E-Rechnung (XRechnung/ZUGFeRD), Lesen empfangener
 * E-Rechnungen, Umsatz für den Kleinunternehmer-Wächter, unveränderliche Ablage (E-088).
 *
 * Rechenregeln nach EN 16931: Positionsbetrag = Menge × Preis (auf Cent gerundet), Steuer je Steuersatz auf die
 * Summe der Positionen dieses Satzes (auf Cent gerundet). Steuersätze kommen aus Regelwerten, nie aus dem Code.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@cantoo/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";
import { InvoiceService, type Invoice } from "@e-invoice-eu/core";
import { XMLParser } from "fast-xml-parser";
import type { Tx } from "./datenbank.js";

// ---------------------------------------------------------------- Ablage (Objektspeicher)

/** Unveränderliche Ablage: ein Schlüssel wird genau einmal beschrieben (WORM). */
export interface Ablage {
  ablegen(schluessel: string, inhalt: Buffer): Promise<void>;
  lesen(schluessel: string): Promise<Buffer>;
}

/** Ablage im Dateisystem (Entwicklung, Tests, eigener Server mit verschlüsseltem Volume). S3-kompatibel folgt mit dem Hosting. */
export class DateiAblage implements Ablage {
  constructor(private readonly verzeichnis: string) {}
  private pfad(schluessel: string) {
    if (!/^[a-z0-9-]+\/[a-f0-9]{64}(\.[a-z0-9]+)?$/.test(schluessel)) throw new Error("Ungültiger Ablage-Schlüssel");
    return path.join(this.verzeichnis, schluessel);
  }
  async ablegen(schluessel: string, inhalt: Buffer) {
    const p = this.pfad(schluessel);
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    try {
      await fs.promises.writeFile(p, inhalt, { flag: "wx", mode: 0o440 }); // nie überschreiben
    } catch (e) {
      // Gleicher Inhalt (gleicher Hash) liegt schon da: in Ordnung
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  async lesen(schluessel: string) {
    return fs.promises.readFile(this.pfad(schluessel));
  }
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest();

/** Datei ablegen und als Dokument erfassen (im Kontext des Unternehmens). Gibt die Dokument-ID zurück. */
export async function dokumentAblegen(
  tx: Tx,
  ablage: Ablage,
  d: { unternehmenId: string; kontoId?: string; titel: string; art: string; quelle: "upload" | "generiert" | "email" | "geraet"; mime: string; inhalt: Buffer; endung: string },
): Promise<{ id: string; sha256: string }> {
  const hash = sha256(d.inhalt);
  const schluessel = `${d.unternehmenId}/${hash.toString("hex")}.${d.endung}`;
  await ablage.ablegen(schluessel, d.inhalt);
  const vorhanden = await tx.eine<{ id: string }>("select id from app.dokument where objekt_key = $1", [schluessel]);
  if (vorhanden) return { id: vorhanden.id, sha256: hash.toString("hex") };
  const r = await tx.eine<{ id: string }>(
    `insert into app.dokument (unternehmen_id, titel, art, quelle, objekt_key, mime, groesse_bytes, sha256, erstellt_von)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [d.unternehmenId, d.titel, d.art, d.quelle, schluessel, d.mime, d.inhalt.length, hash, d.kontoId ?? null],
  );
  return { id: r!.id, sha256: hash.toString("hex") };
}

// ---------------------------------------------------------------- Rechnungen: Summen

export interface Position {
  bezeichnung: string;
  menge: number;
  einheit: Einheit;
  preis_cent: number; // Nettopreis je Einheit
  ust_satz: number | null; // Prozent; null bei Kleinunternehmern
}
export type Einheit = "stueck" | "stunde" | "tag" | "monat" | "pauschal" | "kilogramm";
/** UN/ECE Recommendation 20 – technische Codes für die E-Rechnung */
export const EINHEIT_CODE: Record<Einheit, string> = { stueck: "C62", stunde: "HUR", tag: "DAY", monat: "MON", pauschal: "LS", kilogramm: "KGM" };

const rundeCent = (x: number) => Math.sign(x) * Math.round(Math.abs(x)); // kaufmännisch, symmetrisch

export interface Summen {
  zeilen: number[]; // Netto je Position in Cent
  gruppen: { satz: number | null; netto_cent: number; ust_cent: number }[];
  netto_cent: number;
  ust_cent: number;
  brutto_cent: number;
}

export function summen(positionen: Position[], kleinunternehmer: boolean): Summen {
  const zeilen = positionen.map((p) => rundeCent(p.menge * p.preis_cent));
  const nachSatz = new Map<number | null, number>();
  positionen.forEach((p, i) => {
    const satz = kleinunternehmer ? null : p.ust_satz;
    nachSatz.set(satz, (nachSatz.get(satz) ?? 0) + zeilen[i]!);
  });
  const gruppen = [...nachSatz].map(([satz, netto]) => ({ satz, netto_cent: netto, ust_cent: satz === null ? 0 : rundeCent((netto * satz) / 100) }));
  const netto_cent = zeilen.reduce((a, b) => a + b, 0);
  const ust_cent = gruppen.reduce((a, g) => a + g.ust_cent, 0);
  return { zeilen, gruppen, netto_cent, ust_cent, brutto_cent: netto_cent + ust_cent };
}

// ---------------------------------------------------------------- E-Rechnung erzeugen

export interface Steller {
  name: string; strasse: string; plz: string; ort: string; land: string; email: string; telefon?: string | null;
  steuernummer?: string | null; ust_idnr?: string | null; iban?: string | null; bic?: string | null;
}
export interface KundeDaten {
  name: string; strasse?: string | null; plz?: string | null; ort?: string | null; land: string; email?: string | null;
  ust_idnr?: string | null; kaeufer_referenz?: string | null; geschaeftskunde: boolean;
}
export interface RechnungsDaten {
  nummer: string; rechnungsdatum: string; leistungsdatum?: string | null; faellig_am?: string | null;
  steller: Steller; kunde: KundeDaten; positionen: Position[]; kleinunternehmer: boolean; hinweis?: string | null;
  art?: "rechnung" | "storno"; storniert_nummer?: string | null;
}

/** Was für eine gültige E-Rechnung (XRechnung) fehlt – als verständliche Liste. Leer = vollständig. */
export function fehlendFuerERechnung(r: RechnungsDaten): string[] {
  const f: string[] = [];
  const s = r.steller;
  if (!s.name || !s.strasse || !s.plz || !s.ort) f.push("steller.anschrift");
  if (!s.email) f.push("steller.email");
  if (!s.telefon) f.push("steller.telefon");
  if (!s.steuernummer && !s.ust_idnr) f.push("steller.steuernummer_oder_ust_idnr");
  if (!s.iban) f.push("steller.iban");
  if (!r.kunde.name || !r.kunde.strasse || !r.kunde.plz || !r.kunde.ort) f.push("kunde.anschrift");
  if (r.kunde.geschaeftskunde && !r.kunde.email) f.push("kunde.email");
  if (!r.positionen.length) f.push("positionen");
  if (r.positionen.some((p) => !p.bezeichnung || !(p.menge > 0) || !Number.isInteger(p.preis_cent))) f.push("positionen.ungueltig");
  if (!r.kleinunternehmer && r.positionen.some((p) => p.ust_satz === null)) f.push("positionen.steuersatz");
  if (!r.leistungsdatum) f.push("leistungsdatum");
  return f;
}

const betrag = (cent: number) => (cent / 100).toFixed(2);
const geld = (cent: number) => ({ "@currencyID": "EUR" as const, wert: betrag(cent) });

/** Rechnung → internes Format der Bibliothek (UBL-Struktur als JSON). */
export function eRechnungsDaten(r: RechnungsDaten, kuHinweis: string): Invoice {
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
      "cbc:InvoicedQuantity": String(vz * p.menge), "cbc:InvoicedQuantity@unitCode": EINHEIT_CODE[p.einheit],
      "cbc:LineExtensionAmount": m(s.zeilen[i]!).wert, "cbc:LineExtensionAmount@currencyID": "EUR",
      "cac:Item": { "cbc:Name": p.bezeichnung, "cac:ClassifiedTaxCategory": { ...kategorie(r.kleinunternehmer ? null : p.ust_satz), "cac:TaxScheme": { "cbc:ID": "VAT" } } },
      "cac:Price": { "cbc:PriceAmount": betrag(p.preis_cent), "cbc:PriceAmount@currencyID": "EUR" },
    })),
  };
  return { "ubl:Invoice": doc } as unknown as Invoice;
}

const stumm = { log: () => undefined, warn: () => undefined, error: () => undefined } as unknown as Console;

/** XRechnung als CII-XML (Syntax, die auch in ZUGFeRD steckt). */
export async function xrechnungXml(r: RechnungsDaten, kuHinweis: string): Promise<string> {
  const ergebnis = await new InvoiceService(stumm).generate(eRechnungsDaten(r, kuHinweis), { format: "XRECHNUNG-CII", lang: "de-de" });
  return String(ergebnis);
}

/** ZUGFeRD/Factur-X (Profil XRechnung): menschenlesbares PDF mit eingebetteter XML, PDF/A-3. */
export async function zugferdPdf(r: RechnungsDaten, kuHinweis: string, pdf: Buffer): Promise<Buffer> {
  const ergebnis = await new InvoiceService(stumm).generate(eRechnungsDaten(r, kuHinweis), {
    format: "Factur-X-XRechnung",
    lang: "de-de",
    pdf: { buffer: pdf, filename: `${r.nummer}.pdf`, mimetype: "application/pdf" },
  });
  return Buffer.from(ergebnis as Uint8Array);
}

// ---------------------------------------------------------------- PDF

const SCHRIFTEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schriften");
const euro = (cent: number) => `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100)} €`;
const datumDe = (d?: string | null) => (d ? d.split("-").reverse().join(".") : "");
const EINHEIT_TEXT: Record<Einheit, string> = { stueck: "Stück", stunde: "Std.", tag: "Tag", monat: "Monat", pauschal: "pauschal", kilogramm: "kg" };

/** Schlichtes Rechnungs-PDF (A4) mit eingebetteter Schrift. Layout bewusst einfach; Texte auf Deutsch. */
export async function rechnungPdf(r: RechnungsDaten, kuHinweis: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const normal = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans.ttf")), { subset: true });
  const fett = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans-Bold.ttf")), { subset: true });
  doc.setTitle(`${r.art === "storno" ? "Stornorechnung" : "Rechnung"} ${r.nummer}`);
  doc.setAuthor(r.steller.name);
  doc.setProducer("Amtlos");
  const s = summen(r.positionen, r.kleinunternehmer);
  const vz = r.art === "storno" ? -1 : 1;

  let seite: PDFPage = doc.addPage([595.28, 841.89]);
  let y = 800;
  const text = (t: string, x: number, groesse = 10, f: PDFFont = normal, rechts = false) => {
    const breite = f.widthOfTextAtSize(t, groesse);
    seite.drawText(t, { x: rechts ? x - breite : x, y, size: groesse, font: f, color: rgb(0.1, 0.12, 0.15) });
  };
  const zeile = (abstand = 14) => {
    y -= abstand;
    if (y < 80) {
      seite = doc.addPage([595.28, 841.89]);
      y = 800;
    }
  };

  text(r.steller.name, 50, 9, fett);
  text(`${r.steller.strasse} · ${r.steller.plz} ${r.steller.ort}`, 50 + fett.widthOfTextAtSize(r.steller.name, 9) + 8, 9);
  zeile(40);
  for (const z of [r.kunde.name, r.kunde.strasse, `${r.kunde.plz ?? ""} ${r.kunde.ort ?? ""}`.trim(), r.kunde.land !== "DE" ? r.kunde.land : null].filter(Boolean) as string[]) {
    text(z, 50, 11);
    zeile(15);
  }
  zeile(30);
  text(`${r.art === "storno" ? "Stornorechnung" : "Rechnung"} ${r.nummer}`, 50, 16, fett);
  zeile(22);
  const meta = [
    ["Rechnungsdatum", datumDe(r.rechnungsdatum)],
    ["Leistungsdatum", datumDe(r.leistungsdatum)],
    ...(r.faellig_am ? [["Zahlbar bis", datumDe(r.faellig_am)]] : []),
    ...(r.storniert_nummer ? [["Storno zu Rechnung", r.storniert_nummer]] : []),
    ...(r.steller.ust_idnr ? [["USt-IdNr.", r.steller.ust_idnr]] : []),
    ...(r.steller.steuernummer ? [["Steuernummer", r.steller.steuernummer]] : []),
    ...(r.kunde.ust_idnr ? [["USt-IdNr. Kunde", r.kunde.ust_idnr]] : []),
  ];
  for (const [k, v] of meta) {
    text(k!, 50, 10);
    text(v!, 180, 10);
    zeile();
  }
  zeile(16);
  text("Pos.", 50, 9, fett); text("Bezeichnung", 80, 9, fett); text("Menge", 330, 9, fett, true); text("Einzelpreis", 410, 9, fett, true); if (!r.kleinunternehmer) text("USt", 428, 9, fett); text("Betrag", 545, 9, fett, true);
  zeile(6);
  seite.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  zeile(14);
  r.positionen.forEach((p, i) => {
    text(String(i + 1), 50, 9);
    // Bezeichnung umbrechen statt abschneiden (die Leistung muss vollständig auf der Rechnung stehen)
    const zeilenText: string[] = [];
    for (const wort of p.bezeichnung.split(/\s+/)) {
      const letzte = zeilenText.at(-1);
      if (letzte !== undefined && normal.widthOfTextAtSize(`${letzte} ${wort}`, 9) <= 190) zeilenText[zeilenText.length - 1] = `${letzte} ${wort}`;
      else zeilenText.push(wort);
    }
    text(zeilenText[0] ?? "", 80, 9);
    text(`${new Intl.NumberFormat("de-DE").format(vz * p.menge)} ${EINHEIT_TEXT[p.einheit]}`, 330, 9, normal, true);
    text(euro(p.preis_cent), 410, 9, normal, true);
    text(euro(vz * s.zeilen[i]!), 545, 9, normal, true);
    if (!r.kleinunternehmer && p.ust_satz !== null) text(`${p.ust_satz} %`, 428, 9, normal);
    for (const weitere of zeilenText.slice(1)) {
      zeile(12);
      text(weitere, 80, 9);
    }
    zeile();
  });
  seite.drawLine({ start: { x: 300, y: y + 6 }, end: { x: 545, y: y + 6 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  zeile(6);
  text("Summe netto", 300, 10); text(euro(vz * s.netto_cent), 545, 10, normal, true);
  zeile();
  for (const g of s.gruppen) {
    if (g.satz === null) continue;
    text(`Umsatzsteuer ${g.satz} % auf ${euro(vz * g.netto_cent)}`, 300, 10); text(euro(vz * g.ust_cent), 545, 10, normal, true);
    zeile();
  }
  text("Gesamtbetrag", 300, 11, fett); text(euro(vz * s.brutto_cent), 545, 11, fett, true);
  zeile(28);
  if (r.kleinunternehmer) {
    text(kuHinweis, 50, 9);
    zeile();
  }
  if (r.hinweis) for (const z of r.hinweis.split("\n").slice(0, 6)) { text(z.slice(0, 100), 50, 9); zeile(); }
  if (r.steller.iban) {
    zeile(6);
    text(`Bankverbindung: IBAN ${r.steller.iban}${r.steller.bic ? ` · BIC ${r.steller.bic}` : ""}`, 50, 9);
    zeile();
  }
  text(`${r.steller.email}${r.steller.telefon ? ` · ${r.steller.telefon}` : ""}`, 50, 8);
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

// ---------------------------------------------------------------- E-Rechnung empfangen

export interface GeleseneERechnung {
  syntax: "CII" | "UBL";
  nummer: string | null;
  datum: string | null;
  verkaeufer: string | null;
  brutto_cent: number | null;
  ust_cent: number | null;
  waehrung: string | null;
  customization: string | null;
}

const zuCent = (x: unknown) => {
  const n = Number(typeof x === "object" && x !== null ? (x as Record<string, unknown>)["#text"] : x);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const txt = (x: unknown): string | null => (x == null ? null : typeof x === "object" ? String((x as Record<string, unknown>)["#text"] ?? "") || null : String(x));
/** Sicherer Zugriff auf verschachtelte, unbekannte XML-Strukturen */
function g(o: unknown, ...pfad: string[]): unknown {
  return pfad.reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Record<string, unknown>)[k] : undefined), o);
}
const ciiDatum = (x: unknown) => {
  const t = txt(x);
  return t && /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : t;
};

/**
 * Liest die Kerndaten einer empfangenen E-Rechnung (CII oder UBL). Prüft nur Lesbarkeit und Pflichtfelder für
 * die Belegerfassung – die vollständige Prüfung nach EN 16931/XRechnung macht der KoSIT-Validator (E-088).
 * Wirft bei Dateien, die keine E-Rechnung sind. Externe Entitäten werden nicht aufgelöst.
 */
export function eRechnungLesen(xml: string): GeleseneERechnung {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("E-Rechnung enthält DOCTYPE/ENTITY – abgelehnt");
  const p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, processEntities: false, parseTagValue: false });
  const d = p.parse(xml) as Record<string, unknown>;
  if (d.CrossIndustryInvoice) {
    const c = d.CrossIndustryInvoice;
    const t = g(c, "SupplyChainTradeTransaction", "ApplicableHeaderTradeSettlement");
    const sum = g(t, "SpecifiedTradeSettlementHeaderMonetarySummation");
    const steuer = g(sum, "TaxTotalAmount");
    return {
      syntax: "CII",
      nummer: txt(g(c, "ExchangedDocument", "ID")),
      datum: ciiDatum(g(c, "ExchangedDocument", "IssueDateTime", "DateTimeString")),
      verkaeufer: txt(g(c, "SupplyChainTradeTransaction", "ApplicableHeaderTradeAgreement", "SellerTradeParty", "Name")),
      brutto_cent: zuCent(g(sum, "GrandTotalAmount")),
      ust_cent: zuCent(Array.isArray(steuer) ? steuer[0] : steuer),
      waehrung: txt(g(t, "InvoiceCurrencyCode")),
      customization: txt(g(c, "ExchangedDocumentContext", "GuidelineSpecifiedDocumentContextParameter", "ID")),
    };
  }
  const u = d.Invoice ?? d.CreditNote;
  if (u) {
    const steuer = g(u, "TaxTotal");
    const tax = Array.isArray(steuer) ? steuer[0] : steuer;
    return {
      syntax: "UBL",
      nummer: txt(g(u, "ID")),
      datum: txt(g(u, "IssueDate")),
      verkaeufer: txt(g(u, "AccountingSupplierParty", "Party", "PartyLegalEntity", "RegistrationName")) ?? txt(g(u, "AccountingSupplierParty", "Party", "PartyName", "Name")),
      brutto_cent: zuCent(g(u, "LegalMonetaryTotal", "TaxInclusiveAmount")),
      ust_cent: zuCent(g(tax, "TaxAmount")),
      waehrung: txt(g(u, "DocumentCurrencyCode")),
      customization: txt(g(u, "CustomizationID")),
    };
  }
  throw new Error("Keine E-Rechnung (weder CII noch UBL)");
}

// ---------------------------------------------------------------- Umsatz für den Kleinunternehmer-Wächter

/**
 * Umsatz des Kalenderjahres aus den gestellten Rechnungen in Amtlos (netto, Stornos abgezogen), in Euro.
 * null, wenn das Unternehmen in Amtlos keine Rechnung gestellt hat – dann gibt es den Fakt nicht (E-088, G-06).
 */
export async function umsatzLaufendesJahr(tx: Tx, unternehmenId: string, jahr: number): Promise<number | null> {
  const r = await tx.eine<{ anzahl: number; summe: string | null }>(
    `select (select count(*)::int from app.rechnung where unternehmen_id = $1 and status <> 'entwurf') as anzahl,
            sum(case when art = 'storno' then -netto_cent else netto_cent end)::text as summe
       from app.rechnung
      where unternehmen_id = $1 and status <> 'entwurf' and extract(year from rechnungsdatum) = $2`,
    [unternehmenId, jahr],
  );
  if (!r || r.anzahl === 0) return null;
  return Number(r.summe ?? 0) / 100;
}
