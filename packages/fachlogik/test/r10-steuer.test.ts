/**
 * R10 Steuer (interne Prüfrunde Steuern, Elektro, Freiberuf): Steuerart der Rechnung, Hinweise ohne Hindernis, Leitweg-ID und
 * Bestellnummer in der XRechnung, Gutschrift mit den Steuerdaten des Leistenden, Abschlagsrechnung, § 13b-Belege,
 * Voranmeldung mit Kz 87/21/46–47/84–85/67/39, fremd adressierte E-Rechnung.
 */
import { describe, expect, it } from "vitest";
import {
  KU_HINWEIS,
  LEERER_BETRIEB,
  belegAusERechnung,
  belegSummen,
  dokumentHtml,
  eRechnungAus,
  eRechnungLesen,
  kaeuferFremd,
  steuerschuldFuer,
  vorlageFuer,
  vorsteuerFuer,
  xrechnungUbl,
  type Beleg,
  type Betrieb,
  type Daten,
} from "../src/index.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Elektro Brandt", strasse: "Hafenstr. 3", plz: "44147", ort: "Dortmund", verantwortlich: "Kai Brandt", telefon: "0231 1", email: "info@brandt.example", steuernummer: "314/5555/1234", ust_idnr: "DE123456789", iban: "DE02120300000000202051", bundesland: "Nordrhein-Westfalen" };
const html = (d: Daten, b: Betrieb = B) => dokumentHtml(vorlageFuer("rechnung")!, d, b).replace(/&nbsp;|\u00a0/g, " ");
const hinweise = (d: Daten, extra?: { kleinunternehmer?: boolean | null }) => vorlageFuer("rechnung")!.hinweise!(d, B, extra);
const pruefe = (d: Daten) => vorlageFuer("rechnung")!.pruefen!(d, B);
const RE: Daten = { nummer: "2026-020", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n44135 Dortmund", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Installation", menge: "1", einheit: "Stunde", preis: "100", satz: "19" }] };

describe("Steuerart aus Hinweisen und Freitext", () => {
  it("„§ 13b“ im Befreiungstext gilt als Steuerschuldnerschaft des Empfängers – mit Hinweis", () => {
    const d = { ...RE, positionen: [{ bezeichnung: "Bauleistung", menge: "1", preis: "1000", satz: "0" }], befreiung: "Steuerschuldnerschaft nach § 13b UStG" };
    expect(eRechnungAus(d, B).daten.steuerart).toBe("reverse_charge");
    expect(hinweise(d).some((h) => h.includes("13b"))).toBe(true);
    // mit dem Pflichthinweis: kein Hinweis mehr
    expect(hinweise({ ...d, hinweise: ["reverse_charge"] }).some((h) => h.includes("„13b“"))).toBe(false);
  });
  it("Nullsteuersatz (§ 12 Abs. 3 UStG) ist eine eigene Steuerart", () => {
    const d = { ...RE, positionen: [{ bezeichnung: "PV-Anlage", menge: "1", preis: "10000", satz: "0" }], befreiung: "Nullsteuersatz nach § 12 Abs. 3 UStG (Photovoltaikanlage)" };
    expect(eRechnungAus(d, B).daten.steuerart).toBe("nullsatz");
    expect(eRechnungAus(d, B).fehlt).toEqual([]);
  });
});

describe("Leitweg-ID, Bestellnummer, öffentliche Auftraggeber", () => {
  it("Leitweg-ID in BT-10, Bestellnummer in BT-13; ohne Leitweg-ID wie bisher die Rechnungsnummer", () => {
    const d = { ...RE, kunde_name: "Stadt Dortmund", kunde_leitweg_id: "05913000-00012-37", bestellnummer: "BE-4711" };
    const xml = xrechnungUbl(eRechnungAus(d, B).daten, KU_HINWEIS);
    expect(xml).toContain("<cbc:BuyerReference>05913000-00012-37</cbc:BuyerReference>");
    expect(xml).toMatch(/<cac:OrderReference>\s*<cbc:ID>BE-4711<\/cbc:ID>/);
    expect(xml.indexOf("<cac:OrderReference>")).toBeLessThan(xml.indexOf("<cac:AccountingSupplierParty>"));
    expect(xrechnungUbl(eRechnungAus(RE, B).daten, KU_HINWEIS)).toContain("<cbc:BuyerReference>2026-020</cbc:BuyerReference>");
    const h = html(d);
    expect(h).toContain("Leitweg-ID");
    expect(h).toContain("BE-4711");
  });
  it("Behörde ohne Leitweg-ID: Hinweis (kein Hindernis); Stadtwerke zählen nicht", () => {
    expect(hinweise({ ...RE, kunde_name: "Stadt Dortmund" }).some((h) => h.includes("Leitweg-ID"))).toBe(true);
    expect(hinweise({ ...RE, kunde_name: "Landratsamt Lörrach" }).some((h) => h.includes("Leitweg-ID"))).toBe(true);
    expect(hinweise({ ...RE, kunde_name: "Stadtwerke Dortmund GmbH" }).some((h) => h.includes("Leitweg-ID"))).toBe(false);
    expect(pruefe({ ...RE, kunde_name: "Stadt Dortmund" })).toEqual([]);
  });
});

describe("Kunden im Ausland", () => {
  const NL = { ...RE, kunde_name: "Studio Grachtwerk B.V.", kunde_anschrift: "Keizersgracht 221\n1016 DV Amsterdam\nNiederlande", kunde_ust_idnr: "NL859310276B01" };
  it("EU-Unternehmen mit 19 %: Hinweis auf § 3a Abs. 2 und Steuerschuldnerschaft", () => {
    expect(hinweise(NL).some((h) => h.includes("§ 3a Abs. 2") && h.includes("NL"))).toBe(true);
    expect(hinweise({ ...NL, hinweise: ["reverse_charge"], positionen: [{ bezeichnung: "Design", menge: "1", preis: "100", satz: "0" }] })).toEqual([]);
  });
  it("Kleinunternehmer an EU-Unternehmen: Hinweis; mit Steuerschuldnerschaft steht deren Hinweis statt § 19 auf der Rechnung", () => {
    expect(hinweise({ ...NL, kleinunternehmer: true }).some((h) => h.includes("„steuerfrei nach § 19 UStG“"))).toBe(true);
    const mit = { ...NL, kleinunternehmer: true, hinweise: ["reverse_charge"] };
    expect(pruefe(mit)).toEqual([]);
    const h = html(mit);
    expect(h).toContain("Steuerschuldnerschaft des Leistungsempfängers");
    expect(h).not.toContain(KU_HINWEIS);
    expect(xrechnungUbl(eRechnungAus(mit, B).daten, KU_HINWEIS)).not.toContain(KU_HINWEIS);
  });
  it("Kleinunternehmer und igL: Widerspruch mit Empfehlung", () => {
    expect(hinweise({ ...NL, kleinunternehmer: true, hinweise: ["igl"] })[0]).toMatch(/^Widerspruch/);
  });
  it("Schweiz: „UID/MWST-Nr.“ und kein GiroCode", () => {
    const ch = { ...RE, kunde_name: "Atelier Rheinblick AG", kunde_anschrift: "Spalenberg 12\n4051 Basel\nSchweiz", kunde_ust_idnr: "CHE-123.456.789 MWST" };
    const h = html(ch);
    expect(h).toContain("UID/MWST-Nr. CHE-123.456.789");
    expect(h).not.toContain("GiroCode");
    expect(html(RE)).toContain("GiroCode");
  });
  it("Kleinunternehmer-Schalter weicht vom Pflichten-Check ab: Hinweis", () => {
    expect(hinweise({ ...RE, kleinunternehmer: false }, { kleinunternehmer: true }).some((h) => h.includes("Pflichten-Check"))).toBe(true);
    expect(hinweise({ ...RE, kleinunternehmer: true }, { kleinunternehmer: true }).some((h) => h.includes("Pflichten-Check"))).toBe(false);
  });
});

describe("Gutschrift und Abschlag", () => {
  const GS: Daten = { ...RE, nummer: "2026-011", kunde_name: "Jonas Kiefer Fotografie", kunde_anschrift: "Wiesenweg 4\n79098 Freiburg", hinweise: ["gutschrift"], kunde_steuernummer: "06/123/45678" };
  it("Gutschrift druckt Steuernummer bzw. USt-IdNr. des Leistenden, nicht die eigene", () => {
    const h = html(GS);
    expect(h).toContain("06/123/45678");
    expect(h).toContain("Steuernr. Leistender");
    expect(h).not.toMatch(/>Steuernummer<\/td>/);
    expect(pruefe({ ...GS, kunde_steuernummer: "" })).toContain("Steuernummer oder USt-IdNr. des Leistenden (bei Gutschrift)");
    expect(pruefe(GS)).toEqual([]);
  });
  it("Gutschrift: Kleinunternehmerregelung des Leistenden entscheidet (ohne Angabe wie bisher der Schalter)", () => {
    expect(eRechnungAus({ ...GS, kleinunternehmer: true, leistender_steuer: "regel" }, B).daten.kleinunternehmer).toBe(false);
    expect(eRechnungAus({ ...GS, kleinunternehmer: false, leistender_steuer: "ku" }, B).daten.kleinunternehmer).toBe(true);
    expect(eRechnungAus({ ...GS, kleinunternehmer: true }, B).daten.kleinunternehmer).toBe(true);
  });
  it("Abschlagsrechnung heißt so", () => {
    expect(html({ ...RE, abschlag: true })).toContain(">Abschlagsrechnung 2026-020<");
  });
});

describe("§ 13b-Belege und fremd adressierte E-Rechnung", () => {
  const BEL: Beleg = { id: "b1", datum: "2026-05-10", lieferant: "Kernbohrtechnik", kategorie: "fremdleistungen", steuer: [{ satz: 0, brutto_cent: 95500 }], vorsteuer: true, zahlung: "bank", erstellt: "2026-05-10", geaendert: "2026-05-10", steuerschuld: "bau" };
  it("Kz 84/85/67 für eine Bauleistung, Kz 46/47 für eine EU-Leistung; Kleinunternehmer ohne Kz 67", () => {
    const r = steuerschuldFuer([BEL, { ...BEL, id: "b2", steuerschuld: "eu", steuer: [{ satz: 0, brutto_cent: 46800 }], vorsteuer: false }], "2026-04-01", "2026-06-30");
    // E-222: dazu die Felder der innergemeinschaftlichen Erwerbe (hier 0); E-224: Belege ohne Euro-Betrag (hier keine)
    expect(r).toEqual({ bau_netto_cent: 95500, bau_steuer_cent: 18145, eu_netto_cent: 46800, eu_steuer_cent: 8892, vorsteuer_cent: 18145, anzahl: 2, ige_19_netto_cent: 0, ige_19_steuer_cent: 0, ige_7_netto_cent: 0, ige_7_steuer_cent: 0, ige_vorsteuer_cent: 0, ige_andere_cent: 0, ige_anzahl: 0, ohne_euro: 0, ige_ohne_euro: 0, ige_ohne_erwerbsdatum: 0 });
    // in der normalen Vorsteuer zählt er nicht, Brutto = Netto
    expect(vorsteuerFuer([BEL], "2026-04-01", "2026-06-30").cent).toBe(0);
    expect(belegSummen(BEL)).toEqual({ brutto_cent: 95500, netto_cent: 95500, ust_cent: 0, vorsteuer_cent: 0 });
  });
  it("E-Rechnung an einen anderen Käufer: Vorsteuer aus, Warnung in der Notiz", () => {
    const xml = xrechnungUbl(eRechnungAus({ ...RE, kunde_name: "Elektro Becker e.K.", kunde_anschrift: "Rheinstr. 9\n79104 Freiburg" }, { ...B, name: "Großhandel Nord GmbH" }).daten, KU_HINWEIS);
    const r = eRechnungLesen(xml)!;
    expect(kaeuferFremd(r, { name: "Elektro Brandt", plz: "44147" })).toBe(true);
    expect(kaeuferFremd(r, { name: "Elektro Becker", plz: "79104" })).toBe(false);
    const b = belegAusERechnung(r, "x", "2026-10-12T10:00:00Z", { betrieb: { name: "Elektro Brandt", plz: "44147" } });
    expect(b.vorsteuer).toBe(false);
    expect(b.notiz).toContain("nicht an deinen Betrieb");
    expect(belegAusERechnung(r, "x", "2026-10-12T10:00:00Z", { betrieb: { name: "Elektro Becker e.K.", plz: "79104" } }).vorsteuer).toBe(true);
  });
});

describe("Voranmeldung: neue Kennzahlen", () => {
  const va = (d: Daten) => dokumentHtml(vorlageFuer("ust_voranmeldung")!, d, B).replace(/&nbsp;|\u00a0/g, " ");
  it("Kz 87, 21, 46/47, 84/85, 67, 39 und Dauerfristverlängerung", () => {
    const h = va({ zeitraum: "Dezember 2026", umsatz_19: "1000", vorsteuer: "50", umsatz_87: "15056", umsatz_21: "720", rc_eu_netto: "468", rc_eu_steuer: "88,92", rc_bau_netto: "955", rc_bau_steuer: "181,45", vorsteuer_13b: "270,37", sondervorauszahlung: "100", dauerfrist: true });
    for (const kz of ["87", "21", "46", "47", "84", "85", "67", "39"]) expect(h, kz).toContain(`>${kz}<`);
    expect(h).toContain("Dauerfristverlängerung einen Monat später");
    // Zahllast: 190 + 88,92 + 181,45 − 50 − 270,37 − 100 = 40,00
    expect(vorlageFuer("ust_voranmeldung")!.ergebnis!({ umsatz_19: "1000", vorsteuer: "50", rc_eu_steuer: "88,92", rc_bau_steuer: "181,45", vorsteuer_13b: "270,37", sondervorauszahlung: "100" }).at(-1)?.join(" ").replace(/\s/g, " ")).toBe("Zahllast 40,00 €");
  });
});

describe("Steuererklärung: Feststellungserklärung für Personengesellschaften", () => {
  const v = vorlageFuer("steuererklaerung")!;
  const GBR: Betrieb = { ...B, name: "Brandt & Sohn GbR", rechtsform: "GbR" };
  it("Auswahl, Grundlage §§ 180, 181 AO, keine ESt der Gesellschaft", () => {
    expect(v.abschnitte[0]!.felder.some((f) => f.art === "mehrfach" && f.optionen.some((o) => o.wert === "feststellung"))).toBe(true);
    expect(v.pflichten).toContain("steuern.feststellungserklaerung");
    expect(v.grundlageFuer!({}, GBR)).toBe("§§ 180, 181 AO; § 14a GewStG; § 18 Abs. 3 UStG");
    expect(v.grundlageFuer!({}, B)).toBe("§ 25 EStG; § 14a GewStG; § 18 Abs. 3 UStG");
    expect(v.grundlageFuer!({}, { ...B, rechtsform: "GmbH" })).toBe("§ 31 KStG; § 14a GewStG; § 18 Abs. 3 UStG");
    expect(v.hinweise!({ arten: ["est"] }, GBR)[0]).toContain("§ 180");
    expect(v.hinweise!({ arten: ["feststellung"] }, GBR)).toEqual([]);
    expect(v.hinweise!({ arten: ["est"] }, B)).toEqual([]);
  });
});
