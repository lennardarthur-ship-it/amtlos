import { describe, expect, it } from "vitest";
import { belegNummern, belegnummerNormal, type Beleg } from "../src/belege.js";
import {
  BU_OHNE_STEUER,
  DATEV_EU_USTID,
  DATEV_LEISTUNGSDATUM,
  DATEV_STEUERPERIODE,
  buAufwand,
  DATEV_SPALTEN,
  belegfeld1Aus,
  buchungenAusBelegen,
  buchungenAusRechnungen,
  buchungslisteCsv,
  buchungsGuid,
  DATEV_GUID,
  datevExtf,
  datevExtfBytes,
  pruefpunkteBuchungen,
  type AusgangsRechnungFuerBuchung,
} from "../src/buchungen.js";
import { MARKE } from "@amtlos/marke";

const RE: AusgangsRechnungFuerBuchung = {
  id: "re-1",
  nummer: "2026-005",
  datum: "2026-10-05",
  art: "rechnung",
  kleinunternehmer: false,
  kunde: "Kim Beispiel",
  positionen: [{ bezeichnung: "Beratung", menge: 1, einheit: "pauschal", preis_cent: 10000, ust_satz: 19 }],
};

const BELEG: Beleg = {
  id: "k9x1abcd2efg",
  datum: "2026-10-07",
  lieferant: "Gasthaus Krone",
  nummer: "Bon 4711",
  kategorie: "bewirtung",
  steuer: [{ satz: 19, brutto_cent: 5950 }],
  vorsteuer: true,
  zahlung: "bar",
  erstellt: "2026-10-07",
  geaendert: "2026-10-07",
};

const EXPORT = { beraternummer: "12345", mandantennummer: "67890", wjBeginn: "2026-01-01", von: "2026-10-01", bis: "2026-10-31", kontenrahmen: "SKR03" as const, erzeugtAm: "2026-10-13T12:00:00.000Z" };

describe("Buchungen und DATEV-Export (E-132)", () => {
  it("Rechnung mit 19 % und 7 % ergibt je Satz eine Buchung Forderungen an Erlöse mit Bruttobetrag", () => {
    const r: AusgangsRechnungFuerBuchung = {
      ...RE,
      positionen: [
        { bezeichnung: "Kaffee", menge: 2, einheit: "stueck", preis_cent: 300, ust_satz: 7 },
        { bezeichnung: "Beratung", menge: 1, einheit: "stunde", preis_cent: 10000, ust_satz: 19 },
      ],
    };
    const b = buchungenAusRechnungen([r], "SKR03");
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ datum: "2026-10-05", betrag_cent: 642, soll_haben: "S", konto: "1410", gegenkonto: "8300", bu_schluessel: "", belegfeld1: "2026-005", buchungstext: "RE 2026-005 Kim Beispiel", ust_satz: 7, art: "einnahme", quelle_id: "re-1" });
    expect(b[1]).toMatchObject({ betrag_cent: 11900, soll_haben: "S", konto: "1410", gegenkonto: "8400", ust_satz: 19 });
    const s4 = buchungenAusRechnungen([r], "SKR04");
    expect(s4.map((x) => [x.konto, x.gegenkonto])).toEqual([["1210", "4300"], ["1210", "4400"]]);
  });

  it("Kleinunternehmer buchen auf 8195/4185, 0 % ohne Kleinunternehmer auf 8100/4100", () => {
    const ku = buchungenAusRechnungen([{ ...RE, kleinunternehmer: true }], "SKR03");
    expect(ku).toHaveLength(1);
    expect(ku[0]).toMatchObject({ betrag_cent: 10000, gegenkonto: "8195", ust_satz: null, bu_schluessel: "" });
    expect(buchungenAusRechnungen([{ ...RE, kleinunternehmer: true }], "SKR04")[0]?.gegenkonto).toBe("4185");
    const null_prozent = { ...RE, positionen: [{ ...RE.positionen[0]!, ust_satz: 0 }] };
    expect(buchungenAusRechnungen([null_prozent], "SKR03")[0]).toMatchObject({ betrag_cent: 10000, gegenkonto: "8100", ust_satz: 0 });
    expect(buchungenAusRechnungen([null_prozent], "SKR04")[0]?.gegenkonto).toBe("4100");
  });

  it("Storno als Generalumkehr auf der ursprünglichen Seite (StB-Prüfung 3.1); die Versteuerungsart ändert nichts; Nullbeträge fallen weg", () => {
    const st = buchungenAusRechnungen([{ ...RE, id: "re-2", nummer: "2026-006", art: "storno" }], "SKR03", { versteuerung: "ist" });
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ betrag_cent: 11900, soll_haben: "S", generalumkehr: true, konto: "1410", gegenkonto: "8400", art: "storno", buchungstext: "Storno 2026-006 Kim Beispiel", quelle_id: "re-2" });
    expect(buchungenAusRechnungen([RE], "SKR03", { versteuerung: "ist" })).toEqual(buchungenAusRechnungen([RE], "SKR03"));
    expect(buchungenAusRechnungen([{ ...RE, positionen: [] }], "SKR03")).toEqual([]);
  });

  it("Beleg bar mit Bewirtung (A-1): 1000 im Haben an 4650 mit BU 9 (SKR03), 1600 an 6640 (SKR04); Verbindlichkeiten bzw. Privateinlagen in Feld 7", () => {
    const b = buchungenAusBelegen([BELEG], "SKR03");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ datum: "2026-10-07", betrag_cent: 5950, soll_haben: "H", konto: "1000", gegenkonto: "4650", bu_schluessel: "9", belegfeld1: "Bon-4711", buchungstext: "Gasthaus Krone Bewirtung", ust_satz: 19, art: "ausgabe", quelle_id: "k9x1abcd2efg" });
    expect(buchungenAusBelegen([BELEG], "SKR04")[0]).toMatchObject({ konto: "1600", gegenkonto: "6640" });
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "bank" }], "SKR03")[0]?.konto).toBe("1610");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "bank" }], "SKR04")[0]?.konto).toBe("3310");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR03")[0]?.konto).toBe("1890");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR04")[0]?.konto).toBe("2180");
  });

  it("Beleg ohne Vorsteuer bekommt BU 40 (nur bei Satz > 0); mehrere Sätze ergeben mehrere Buchungen mit Konto je Satz", () => {
    const ohne = buchungenAusBelegen([{ ...BELEG, vorsteuer: false, nummer: null, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 1190 }, { satz: 7, brutto_cent: 214 }, { satz: 0, brutto_cent: 500 }] }], "SKR03");
    expect(ohne.map((x) => [x.gegenkonto, x.bu_schluessel, x.betrag_cent])).toEqual([["3400", BU_OHNE_STEUER, 1190], ["3300", "40", 214], ["3200", "", 500]]);
    // ohne Belegnummer: Kurzform der Beleg-ID
    expect(ohne[0]?.belegfeld1).toBe("K9X1ABCD2EFG");
    expect(ohne.every((x) => x.buchungstext === "Gasthaus Krone Wareneinkauf")).toBe(true);
    // mit Amtlos-Belegnummern: die Amtlos-Nummer statt der ID; eine eigene Nummer des Lieferanten bleibt (normalisiert)
    const nummern = new Map([["k9x1abcd2efg", "B2026-017"]]);
    expect(buchungenAusBelegen([{ ...BELEG, nummer: null }], "SKR03", { nummern })[0]?.belegfeld1).toBe("B2026-017");
    expect(buchungenAusBelegen([{ ...BELEG, nummer: "RE 2026/77 ä" }], "SKR03", { nummern })[0]?.belegfeld1).toBe("RE-2026-77-ae");
  });

  it("Buchungstext: Kurzbezeichnung der Kategorie, Lieferant/Kunde höchstens 40 Zeichen ohne Leerzeichen am Ende; Storno mit Bezug", () => {
    const lang = "Großhandel für Gastronomiebedarf und Kaffee GmbH & Co. KG Niederlassung Süd";
    const b = buchungenAusBelegen([{ ...BELEG, lieferant: lang, kategorie: "fahrzeug" }], "SKR03")[0]!;
    expect(b.buchungstext).toBe(`${Array.from(lang).slice(0, 40).join("").trimEnd()} Kfz`);
    expect(buchungenAusBelegen([{ ...BELEG, lieferant: "Stadtwerke", kategorie: "gwg" }], "SKR03")[0]?.buchungstext).toBe("Stadtwerke GWG");
    const st = buchungenAusRechnungen([{ ...RE, nummer: "2026-007", art: "storno", storniert_nummer: "2026-005" }], "SKR03")[0]!;
    expect(st.buchungstext).toBe("Storno 2026-007 zu RE 2026-005 Kim Beispiel");
    expect(buchungenAusRechnungen([{ ...RE, kunde: "Kunde mit sehr langem Namen  und  Leerzeichen am Ende 1234567" }], "SKR03")[0]?.buchungstext).toBe("RE 2026-005 Kunde mit sehr langem Namen und Leerzeic");
  });

  it("Buchungs-GUID: stabil aus Quelle und Steuersatz, 36 Zeichen, je Satz verschieden; steht in Beleginfo 1, Feld 103 bleibt leer (3.1)", () => {
    const g = buchungsGuid("re-1", 19);
    expect(g).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(buchungsGuid("re-1", 19)).toBe(g);
    expect(buchungsGuid("re-1", 7)).not.toBe(g);
    expect(buchungsGuid("re-1", null)).not.toBe(g);
    expect(buchungsGuid("re-2", 19)).not.toBe(g);
    expect(buchungenAusRechnungen([RE], "SKR03")[0]?.guid).toBe(g);
    expect(buchungenAusBelegen([BELEG], "SKR03")[0]?.guid).toBe(buchungsGuid(BELEG.id, 19));
    expect(DATEV_SPALTEN[DATEV_GUID]).toBe("Buchungs GUID");
    expect(DATEV_GUID).toBe(102);
    const zeile = datevExtf(buchungenAusRechnungen([RE], "SKR03"), EXPORT).split("\r\n")[2]!.split(";");
    expect(zeile[DATEV_GUID]).toBe("");
    expect(zeile[20]).toBe('"Buchungs-GUID"');
    expect(zeile[21]).toBe(`"${g}"`);
  });

  it(`${MARKE.name}-Belegnummer je Jahr in der Reihenfolge der Erfassung; Belegnummer des Lieferanten normalisiert`, () => {
    const n = belegNummern([
      { id: "c", datum: "2026-03-01", erstellt: "2026-03-05T10:00:00Z" },
      { id: "a", datum: "2026-01-10", erstellt: "2026-01-12T10:00:00Z" },
      { id: "d", datum: "2027-01-02", erstellt: "2027-01-03T10:00:00Z" },
      // nachträglich erfasst, früheres Datum: bekommt die nächste Nummer, die anderen bleiben
      { id: "b", datum: "2026-01-05", erstellt: "2026-04-01T10:00:00Z" },
    ]);
    expect(Object.fromEntries(n)).toEqual({ a: "B2026-001", c: "B2026-002", b: "B2026-003", d: "B2027-001" });
    expect(belegnummerNormal("LA 01/2026")).toBe("LA-01-2026");
    expect(belegnummerNormal(" Nr. 4711 ")).toBe("Nr-4711");
    expect(belegnummerNormal("Müller/Ö")).toBe("Mueller-Oe");
    expect(belegnummerNormal("  ")).toBe("");
    expect(belegnummerNormal(null)).toBe("");
    expect(belegnummerNormal("x".repeat(50))).toHaveLength(36);
  });

  it("Belegfeld 1: nur zulässige Zeichen, Umlaute umschrieben, höchstens 36 Zeichen", () => {
    expect(belegfeld1Aus("RE Nr. 2026/007 Müller & Söhne")).toBe("RENr2026/007Mueller&Soehne");
    expect(belegfeld1Aus("x".repeat(50))).toHaveLength(36);
  });

  it("datevExtf: Kopfzeile mit 31 Feldern, 125 Spalten, Buchungszeile mit Belegdatum TTMM und Texten in Anführungszeichen", () => {
    const buchungen = [...buchungenAusRechnungen([RE], "SKR03"), ...buchungenAusBelegen([BELEG], "SKR03")];
    const t = datevExtf(buchungen, EXPORT);
    expect(t.endsWith("\r\n")).toBe(true);
    const zeilen = t.slice(0, -2).split("\r\n");
    expect(zeilen).toHaveLength(2 + buchungen.length);
    const kopf = zeilen[0]!;
    expect(kopf.startsWith(`"EXTF";700;21;"Buchungsstapel";13;20261013120000000;;"RE";"${MARKE.name}";;12345;67890;20260101;4;20261001;20261031;"Rechnungen und Belege";;1;0;0;"EUR";`)).toBe(true);
    expect(kopf.split(";")).toHaveLength(31);
    expect(kopf.endsWith(';"EUR";;;;;"03";;;;')).toBe(true);
    expect(DATEV_SPALTEN).toHaveLength(125);
    expect(zeilen[1]!.split(";")).toHaveLength(125);
    expect(zeilen[1]!.startsWith("Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;")).toBe(true);
    // Feld 21/22 Beleginfo mit der GUID, Feld 114 Festschreibung 0, Feld 103 leer
    expect(zeilen[2]).toBe('119,00;"S";"EUR";;;;1410;8400;;0510;"2026-005";;;"RE 2026-005 Kim Beispiel";;;;;;;"Buchungs-GUID";' + `"${buchungsGuid("re-1", 19)}"` + ";".repeat(92) + "0" + ";".repeat(11));
    expect(zeilen[2]!.split(";")).toHaveLength(125);
    // R10: 4650 ist kein Automatikkonto – Vorsteuer über BU 9; A-1: Kasse in Feld 7 (Haben), Sachkonto mit BU in Feld 8
    expect(zeilen[3]!.startsWith('59,50;"H";"EUR";;;;1000;4650;"9";0710;"Bon-4711";;;"Gasthaus Krone Bewirtung";')).toBe(true);
    // BU-Schlüssel als Text, innere Anführungszeichen verdoppelt, Fälligkeit in Belegfeld 2, Erzeugt-am ohne Millisekunden
    const bu = datevExtf([{ ...buchungen[1]!, bu_schluessel: "40", belegfeld2: "151126", buchungstext: 'Café "Mond"' }], { ...EXPORT, kontenrahmen: "SKR04", erzeugtAm: "2026-10-13T12:00:00" });
    expect(bu.split("\r\n")[2]!.startsWith('59,50;"H";"EUR";;;;1000;4650;"40";0710;"Bon-4711";"151126";;"Café ""Mond""";')).toBe(true);
    expect(bu.split("\r\n")[0]!).toContain(";20261013120000000;;");
    expect(bu.split("\r\n")[0]!.endsWith(';"04";;;;')).toBe(true);
  });

  it("datevExtfBytes kodiert nach Windows-1252: ä → 0xE4, € → 0x80, ß → 0xDF, Gedankenstrich → 0x96, Unbekanntes → ?", () => {
    expect([...datevExtfBytes("aä€ßÄÖÜöü–")]).toEqual([0x61, 0xe4, 0x80, 0xdf, 0xc4, 0xd6, 0xdc, 0xf6, 0xfc, 0x96]);
    expect([...datevExtfBytes("a😀b")]).toEqual([0x61, 0x3f, 0x62]);
    const t = datevExtf(buchungenAusRechnungen([RE], "SKR03"), EXPORT);
    expect(datevExtfBytes(t)).toHaveLength(t.length);
  });

  it("buchungslisteCsv: UTF-8 mit BOM, Semikolon, Datum TT.MM.JJJJ, Texte mit Semikolon in Anführungszeichen", () => {
    const b = buchungenAusRechnungen([{ ...RE, kunde: "Kim; Beispiel" }], "SKR03");
    const csv = buchungslisteCsv([...b, ...buchungenAusBelegen([{ ...BELEG, vorsteuer: false }], "SKR03")]);
    expect(csv.startsWith("﻿Datum;Betrag;S/H;Konto;Gegenkonto;BU;Beleg;Text;USt;Buchungs-GUID;Generalumkehr\r\n")).toBe(true);
    const zeilen = csv.slice(1, -2).split("\r\n");
    expect(zeilen[1]).toBe(`05.10.2026;119,00;S;1410;8400;;2026-005;"RE 2026-005 Kim; Beispiel";19;${buchungsGuid("re-1", 19)};`);
    // ohne Vorsteuerabzug auf einem Konto ohne Automatik: kein BU (BU 40 nur auf Automatikkonten)
    expect(zeilen[2]).toBe(`07.10.2026;59,50;H;1000;4650;;Bon-4711;Gasthaus Krone Bewirtung;19;${buchungsGuid(BELEG.id, 19)};`);
    expect(buchungslisteCsv(buchungenAusRechnungen([{ ...RE, kleinunternehmer: true }], "SKR03"))).toContain(`;RE 2026-005 Kim Beispiel;;${buchungsGuid("re-1", null)};\r\n`);
    expect(buchungslisteCsv(buchungenAusRechnungen([{ ...RE, art: "storno" }], "SKR03"))).toContain(";ja\r\n");
  });

  it("Prüfpunkte sind nicht leer und nennen BU 40, Generalumkehr, Feldliste und Ist-Versteuerung", () => {
    const p = pruefpunkteBuchungen();
    expect(p.length).toBeGreaterThanOrEqual(6);
    for (const w of ["BU-Schlüssel 40", "Generalumkehr", "125 Felder", "Ist-Versteuerung", "TTMM", "8290", "0731", "Feld 7"]) expect(p.some((s) => s.includes(w)), w).toBe(true);
  });
});

describe("R10 Steuerberatung: BU-Schlüssel, Erlöskonten, § 13b, Felder 115/116", () => {
  const POS = (satz: number | null, preis = 10000) => [{ bezeichnung: "Leistung", menge: 1, einheit: "stueck" as const, preis_cent: preis, ust_satz: satz }];
  it("Belege mit Vorsteuer: BU 9/8 auf Konten ohne Automatik, Automatikkonten ohne BU (ohne Abzug BU 40)", () => {
    const buero = buchungenAusBelegen([{ ...BELEG, kategorie: "buero", steuer: [{ satz: 19, brutto_cent: 1190 }, { satz: 7, brutto_cent: 107 }] }], "SKR03");
    expect(buero.map((x) => [x.gegenkonto, x.bu_schluessel])).toEqual([["4930", "9"], ["4930", "8"]]);
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "buero", vorsteuer: false }], "SKR03")[0]?.bu_schluessel).toBe("");
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "waren" }], "SKR03")[0]).toMatchObject({ gegenkonto: "3400", bu_schluessel: "" });
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "waren" }], "SKR04")[0]).toMatchObject({ gegenkonto: "5400", bu_schluessel: "" });
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "werbung" }], "SKR04")[0]).toMatchObject({ gegenkonto: "6600", bu_schluessel: "9" });
    expect(buAufwand("SKR03", "4930", 0, true)).toBe("");
  });
  it("Personal-Belege bleiben aus dem Stapel; privat ausgelegte Belege einer Kapitalgesellschaft auf das Verrechnungskonto (B-6)", () => {
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "personal" }], "SKR03")).toEqual([]);
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR03", { kapitalgesellschaft: true })[0]).toMatchObject({ konto: "0731", gegenkonto: "4650", soll_haben: "H" });
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR04", { kapitalgesellschaft: true })[0]?.konto).toBe("3560");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR03")).toHaveLength(1);
  });
  it("Energie, Kfz-Steuer und Kfz-Versicherung haben eigene Konten", () => {
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "energie" }], "SKR03")[0]?.gegenkonto).toBe("4240");
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "energie" }], "SKR04")[0]?.gegenkonto).toBe("6325");
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "kfz_steuer", vorsteuer: false, steuer: [{ satz: 0, brutto_cent: 18000 }] }], "SKR03")[0]?.gegenkonto).toBe("4510");
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "kfz_versicherung", vorsteuer: false, steuer: [{ satz: 0, brutto_cent: 50000 }] }], "SKR03")[0]?.gegenkonto).toBe("4520");
  });
  it("§ 13b-Belege (R11): mit Vorsteuerabzug 3120/3123 bzw. 5920/5923, ohne 3140/3143 bzw. 5940/5943 – jeweils ohne BU", () => {
    const eu = { ...BELEG, kategorie: "buero", steuerschuld: "eu" as const, steuer: [{ satz: 0, brutto_cent: 5000 }] };
    expect(buchungenAusBelegen([eu], "SKR03")[0]).toMatchObject({ gegenkonto: "3123", bu_schluessel: "", betrag_cent: 5000 });
    expect(buchungenAusBelegen([{ ...eu, steuerschuld: "bau" }], "SKR03")[0]?.gegenkonto).toBe("3120");
    expect(buchungenAusBelegen([eu], "SKR04")[0]).toMatchObject({ gegenkonto: "5923", bu_schluessel: "" });
    expect(buchungenAusBelegen([{ ...eu, steuerschuld: "bau" }], "SKR04")[0]?.gegenkonto).toBe("5920");
    // ohne Vorsteuerabzug (Schalter aus, z. B. Heilberuf) bzw. Kleinunternehmer: Konten „ohne Vorsteuer, 19 % USt“
    expect(buchungenAusBelegen([{ ...eu, vorsteuer: false }], "SKR03")[0]).toMatchObject({ gegenkonto: "3143", bu_schluessel: "" });
    expect(buchungenAusBelegen([{ ...eu, steuerschuld: "bau", vorsteuer: false }], "SKR03")[0]?.gegenkonto).toBe("3140");
    expect(buchungenAusBelegen([eu], "SKR03", { kleinunternehmer: true })[0]?.gegenkonto).toBe("3143");
    expect(buchungenAusBelegen([{ ...eu, vorsteuer: false }], "SKR04")[0]?.gegenkonto).toBe("5943");
    expect(buchungenAusBelegen([{ ...eu, steuerschuld: "bau", vorsteuer: false }], "SKR04")[0]?.gegenkonto).toBe("5940");
  });
  it("Erlöskonto nach Steuerart: igL 8125 mit USt-IdNr., § 13b Inland 8337, EU-Leistung 8336, Drittland 8338", () => {
    const igl = buchungenAusRechnungen([{ ...RE, positionen: POS(0), steuerart: "igl", kunde_land: "AT", kunde_ust_idnr: "ATU 12345678" }], "SKR03")[0]!;
    expect(igl).toMatchObject({ gegenkonto: "8125", eu_ustid: "ATU12345678" });
    expect(buchungenAusRechnungen([{ ...RE, positionen: POS(0), steuerart: "igl", kunde_land: "AT" }], "SKR04")[0]?.gegenkonto).toBe("4125");
    expect(buchungenAusRechnungen([{ ...RE, positionen: POS(0), steuerart: "reverse_charge", kunde_land: "DE" }], "SKR03")[0]?.gegenkonto).toBe("8337");
    expect(buchungenAusRechnungen([{ ...RE, positionen: POS(0), steuerart: "reverse_charge", kunde_land: "NL", kunde_ust_idnr: "NL859310276B01" }], "SKR03")[0]).toMatchObject({ gegenkonto: "8336", eu_ustid: "NL859310276B01" });
    // Kleinunternehmer mit Leistung an ein Unternehmen im EU-Ausland: ebenfalls das EU-Konto statt 8195
    expect(buchungenAusRechnungen([{ ...RE, kleinunternehmer: true, steuerart: "reverse_charge", kunde_land: "NL" }], "SKR03")[0]?.gegenkonto).toBe("8336");
    expect(buchungenAusRechnungen([{ ...RE, positionen: POS(0), steuerart: "reverse_charge", kunde_land: "CH" }], "SKR03")[0]?.gegenkonto).toBe("8338");
    // StB-Prüfung (B-2): Nullsteuersatz auf eigenes Konto mit Kz 87 (8290/4290), nicht auf 8100 (Kz 48)
    expect(buchungenAusRechnungen([{ ...RE, positionen: POS(0), steuerart: "nullsatz" }], "SKR03")[0]?.gegenkonto).toBe("8290");
  });
  it("DATEV-Felder Leistungsdatum (115), Datum Zuord. Steuerperiode (116) und EU-Land u. UStID", () => {
    expect(DATEV_LEISTUNGSDATUM).toBe(114);
    expect(DATEV_STEUERPERIODE).toBe(115);
    const z = datevExtf(buchungenAusRechnungen([{ ...RE, positionen: POS(0), steuerart: "igl", kunde_land: "AT", kunde_ust_idnr: "ATU12345678", leistungsdatum: "2026-09-30", steuerperiode: "2026-09-30" }], "SKR03"), EXPORT).split("\r\n")[2]!.split(";");
    expect(z[DATEV_LEISTUNGSDATUM]).toBe("30092026");
    expect(z[DATEV_STEUERPERIODE]).toBe("30092026");
    expect(z[DATEV_EU_USTID]).toBe('"ATU12345678"');
  });
  it("Gutschrift mit ausgewiesener Steuer: Aufwand mit BU 9 – nicht, wenn der Betrieb Kleinunternehmer ist", () => {
    const gs: AusgangsRechnungFuerBuchung = { ...RE, gutschrift: true, positionen: POS(19) };
    expect(buchungenAusRechnungen([gs], "SKR03")[0]).toMatchObject({ konto: "1610", gegenkonto: "3100", soll_haben: "H", bu_schluessel: "9", betrag_cent: 11900 });
    expect(buchungenAusRechnungen([{ ...gs, empfaenger_ku: true }], "SKR03")[0]?.bu_schluessel).toBe("");
  });
});
