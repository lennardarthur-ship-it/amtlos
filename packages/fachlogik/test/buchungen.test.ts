import { describe, expect, it } from "vitest";
import { belegNummern, belegnummerNormal, type Beleg } from "../src/belege.js";
import {
  BU_OHNE_STEUER,
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
    expect(b[0]).toMatchObject({ datum: "2026-10-05", betrag_cent: 642, soll_haben: "S", konto: "1400", gegenkonto: "8300", bu_schluessel: "", belegfeld1: "2026-005", buchungstext: "RE 2026-005 Kim Beispiel", ust_satz: 7, art: "einnahme", quelle_id: "re-1" });
    expect(b[1]).toMatchObject({ betrag_cent: 11900, soll_haben: "S", konto: "1400", gegenkonto: "8400", ust_satz: 19 });
    const s4 = buchungenAusRechnungen([r], "SKR04");
    expect(s4.map((x) => [x.konto, x.gegenkonto])).toEqual([["1200", "4300"], ["1200", "4400"]]);
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

  it("Storno dreht Soll und Haben um; die Versteuerungsart ändert nichts; Nullbeträge fallen weg", () => {
    const st = buchungenAusRechnungen([{ ...RE, id: "re-2", nummer: "2026-006", art: "storno" }], "SKR03", { versteuerung: "ist" });
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ betrag_cent: 11900, soll_haben: "H", konto: "1400", gegenkonto: "8400", art: "storno", buchungstext: "Storno 2026-006 Kim Beispiel", quelle_id: "re-2" });
    expect(buchungenAusRechnungen([RE], "SKR03", { versteuerung: "ist" })).toEqual(buchungenAusRechnungen([RE], "SKR03"));
    expect(buchungenAusRechnungen([{ ...RE, positionen: [] }], "SKR03")).toEqual([]);
  });

  it("Beleg bar mit Bewirtung: 4650 an 1000 (SKR03), 6640 an 1600 (SKR04); Bank an Verbindlichkeiten, privat an Privateinlagen", () => {
    const b = buchungenAusBelegen([BELEG], "SKR03");
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ datum: "2026-10-07", betrag_cent: 5950, soll_haben: "S", konto: "4650", gegenkonto: "1000", bu_schluessel: "", belegfeld1: "Bon-4711", buchungstext: "Gasthaus Krone Bewirtung", ust_satz: 19, art: "ausgabe", quelle_id: "k9x1abcd2efg" });
    expect(buchungenAusBelegen([BELEG], "SKR04")[0]).toMatchObject({ konto: "6640", gegenkonto: "1600" });
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "bank" }], "SKR03")[0]?.gegenkonto).toBe("1600");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "bank" }], "SKR04")[0]?.gegenkonto).toBe("3300");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR03")[0]?.gegenkonto).toBe("1890");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR04")[0]?.gegenkonto).toBe("2180");
  });

  it("Beleg ohne Vorsteuer bekommt BU 40 (nur bei Satz > 0); mehrere Sätze ergeben mehrere Buchungen mit Konto je Satz", () => {
    const ohne = buchungenAusBelegen([{ ...BELEG, vorsteuer: false, nummer: null, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 1190 }, { satz: 7, brutto_cent: 214 }, { satz: 0, brutto_cent: 500 }] }], "SKR03");
    expect(ohne.map((x) => [x.konto, x.bu_schluessel, x.betrag_cent])).toEqual([["3400", BU_OHNE_STEUER, 1190], ["3300", "40", 214], ["3200", "", 500]]);
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

  it("Buchungs-GUID: stabil aus Quelle und Steuersatz, 36 Zeichen, je Satz verschieden; steht in DATEV-Feld „Buchungs GUID“", () => {
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
    expect(zeile[DATEV_GUID]).toBe(`"${g}"`);
  });

  it("Amtlos-Belegnummer je Jahr in der Reihenfolge der Erfassung; Belegnummer des Lieferanten normalisiert", () => {
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
    expect(kopf.startsWith('"EXTF";700;21;"Buchungsstapel";13;20261013120000000;;"RE";"Amtlos";;12345;67890;20260101;4;20261001;20261031;"Amtlos Rechnungen und Belege";;1;0;0;"EUR";')).toBe(true);
    expect(kopf.split(";")).toHaveLength(31);
    expect(kopf.endsWith(';"EUR";;;;;"03";;;;')).toBe(true);
    expect(DATEV_SPALTEN).toHaveLength(125);
    expect(zeilen[1]!.split(";")).toHaveLength(125);
    expect(zeilen[1]!.startsWith("Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;")).toBe(true);
    expect(zeilen[2]).toBe('119,00;"S";"EUR";;;;1400;8400;;0510;"2026-005";;;"RE 2026-005 Kim Beispiel"' + ";".repeat(89) + `"${buchungsGuid("re-1", 19)}"` + ";".repeat(22));
    expect(zeilen[2]!.split(";")).toHaveLength(125);
    expect(zeilen[3]!.startsWith('59,50;"S";"EUR";;;;4650;1000;;0710;"Bon-4711";;;"Gasthaus Krone Bewirtung";')).toBe(true);
    // BU-Schlüssel als Text, innere Anführungszeichen verdoppelt, Fälligkeit in Belegfeld 2, Erzeugt-am ohne Millisekunden
    const bu = datevExtf([{ ...buchungen[1]!, bu_schluessel: "40", belegfeld2: "151126", buchungstext: 'Café "Mond"' }], { ...EXPORT, kontenrahmen: "SKR04", erzeugtAm: "2026-10-13T12:00:00" });
    expect(bu.split("\r\n")[2]!.startsWith('59,50;"S";"EUR";;;;4650;1000;"40";0710;"Bon-4711";"151126";;"Café ""Mond""";')).toBe(true);
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
    expect(csv.startsWith("﻿Datum;Betrag;S/H;Konto;Gegenkonto;BU;Beleg;Text;USt;Buchungs-GUID\r\n")).toBe(true);
    const zeilen = csv.slice(1, -2).split("\r\n");
    expect(zeilen[1]).toBe(`05.10.2026;119,00;S;1400;8400;;2026-005;"RE 2026-005 Kim; Beispiel";19;${buchungsGuid("re-1", 19)}`);
    expect(zeilen[2]).toBe(`07.10.2026;59,50;S;4650;1000;40;Bon-4711;Gasthaus Krone Bewirtung;19;${buchungsGuid(BELEG.id, 19)}`);
    expect(buchungslisteCsv(buchungenAusRechnungen([{ ...RE, kleinunternehmer: true }], "SKR03"))).toContain(`;RE 2026-005 Kim Beispiel;;${buchungsGuid("re-1", null)}\r\n`);
  });

  it("Prüfpunkte sind nicht leer und nennen BU 40, Generalumkehr, Feldliste und Ist-Versteuerung", () => {
    const p = pruefpunkteBuchungen();
    expect(p.length).toBeGreaterThanOrEqual(6);
    for (const w of ["BU-Schlüssel 40", "Generalumkehr", "125 Felder", "Ist-Versteuerung", "TTMM", "8100"]) expect(p.some((s) => s.includes(w)), w).toBe(true);
  });
});
