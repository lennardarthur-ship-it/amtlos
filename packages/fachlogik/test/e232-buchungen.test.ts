/**
 * E-232 (Steuerberater 27.10.2026): Kursdifferenz bei Belegen in fremder Währung als eigene Zeile im DATEV-Stapel (T-331)
 * und Ausbuchung uneinbringlicher Forderungen bilanzierender Betriebe (T-333) – Konten laut Steuerberater, über die
 * Kontenvorgaben änderbar.
 */
import { describe, expect, it } from "vitest";
import { BUCHUNGSKONTEN, KONTENVORGABE_FELDER, buchungenAusBelegen, forderungsverlustBuchungen, kontenFuer, kursdifferenzBuchungenBelege, type Beleg } from "../src/index.js";

const USD: Beleg = { id: "bu", datum: "2026-10-05", lieferant: "Cloud Tools Inc.", nummer: "INV-1001", kategorie: "buero", steuer: [{ satz: 19, brutto_cent: 11006 }], vorsteuer: true, zahlung: "bank", bezahlt: "2026-10-12", erstellt: "2026-10-06T08:00:00.000Z", geaendert: "2026-10-06T08:00:00.000Z", fremd: { waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 11900 }], ust: 1900, kurs: 1.0812, kurs_datum: "2026-10-01", gezahlt_eur_cent: 11180 } } as Beleg;
const saldo = (bs: { konto: string; gegenkonto: string; soll_haben: "S" | "H"; betrag_cent: number }[], konto: string) => bs.reduce((a, b) => a + (b.konto === konto ? (b.soll_haben === "S" ? 1 : -1) * b.betrag_cent : 0) - (b.gegenkonto === konto ? (b.soll_haben === "S" ? 1 : -1) * b.betrag_cent : 0), 0);

describe("E-232 (T-331): Kursdifferenz als eigene Zeile", () => {
  it("Konten laut Steuerberater: Aufwand SKR03 2150 / SKR04 6880, Ertrag SKR03 2660 / SKR04 4840", () => {
    expect([BUCHUNGSKONTEN.SKR03.kursAufwand, BUCHUNGSKONTEN.SKR03.kursErtrag, BUCHUNGSKONTEN.SKR04.kursAufwand, BUCHUNGSKONTEN.SKR04.kursErtrag]).toEqual(["2150", "2660", "6880", "4840"]);
    expect(kontenFuer("SKR03", { konten: { kursAufwand: "2151", kursErtrag: "2661" } })).toMatchObject({ kursAufwand: "2151", kursErtrag: "2661" });
    expect(KONTENVORGABE_FELDER.map((f) => f.id)).toEqual(expect.arrayContaining(["kursAufwand", "kursErtrag", "forderungsverlust19", "forderungsverlust7"]));
  });

  it("mehr gezahlt (1,74 €): Verbindlichkeiten an 2150 zum Zahltag ohne BU; Aufwand und Vorsteuer bleiben umgerechnet; zusammen der gezahlte Betrag", () => {
    const k = kursdifferenzBuchungenBelege([USD], "SKR03");
    expect(k).toEqual([expect.objectContaining({ datum: "2026-10-12", betrag_cent: 174, soll_haben: "H", konto: "1610", gegenkonto: "2150", bu_schluessel: "", ust_satz: null, belegfeld1: "INV-1001" })]);
    const haupt = buchungenAusBelegen([USD], "SKR03");
    expect(haupt).toEqual([expect.objectContaining({ betrag_cent: 11006, konto: "1610", gegenkonto: "4930", bu_schluessel: "9" })]);
    // Verbindlichkeit = gezahlter Betrag (Kontoauszug: 1610 an Bank 111,80 € gleicht aus)
    expect(saldo([...haupt, ...k], "1610")).toBe(-11180);
    // SKR04
    expect(kursdifferenzBuchungenBelege([USD], "SKR04")[0]).toMatchObject({ konto: "3310", gegenkonto: "6880" });
  });

  it("weniger gezahlt: Ertrag 2660, Konto im Soll; bar gegen Kasse, privat gegen Privateinlage; ohne gezahlten Betrag keine Zeile", () => {
    const weniger = { ...USD, fremd: { ...USD.fremd!, gezahlt_eur_cent: 10900 } };
    expect(kursdifferenzBuchungenBelege([weniger], "SKR03")[0]).toMatchObject({ betrag_cent: 106, soll_haben: "S", konto: "1610", gegenkonto: "2660", art: "einnahme" });
    expect(kursdifferenzBuchungenBelege([{ ...USD, zahlung: "bar" }], "SKR03")[0]).toMatchObject({ konto: "1000", gegenkonto: "2150" });
    expect(kursdifferenzBuchungenBelege([{ ...USD, zahlung: "privat" }], "SKR03")[0]).toMatchObject({ konto: "1890" });
    expect(kursdifferenzBuchungenBelege([{ ...USD, fremd: { ...USD.fremd!, gezahlt_eur_cent: null } }], "SKR03")).toEqual([]);
    expect(kursdifferenzBuchungenBelege([{ ...USD, fremd: { ...USD.fremd!, gezahlt_eur_cent: 11006 } }], "SKR03")).toEqual([]);
    // Belege gegen Bank (Kontenvorgabe) und Kreditor (Personenkonten)
    expect(kursdifferenzBuchungenBelege([USD], "SKR03", { vorgaben: { belegeGegenBank: true } })[0]!.konto).toBe("1200");
    expect(kursdifferenzBuchungenBelege([USD], "SKR03", { kreditoren: new Map([["bu", "70001"]]) })[0]!.konto).toBe("70001");
    // Personal steht nicht im Stapel, ebenso Erwerbe ohne festgestellte Erwerbsbesteuerung
    expect(kursdifferenzBuchungenBelege([{ ...USD, kategorie: "personal" }], "SKR03")).toEqual([]);
    expect(kursdifferenzBuchungenBelege([{ ...USD, steuerschuld: "ige" }], "SKR03", { igeNichtBuchen: new Set(["bu"]) })).toEqual([]);
  });
});

describe("E-232 (T-333 a): Forderungsverlust bei Bilanz", () => {
  const r = { id: "r1", nummer: "2026-7", kunde: "Pleite GmbH" };
  it("19 % → SKR03 2406 / SKR04 6936, 7 % → 2401 / 6931, Bruttobetrag gegen Forderungen, ohne BU, zum Tag", () => {
    const { buchungen, ohneKonto } = forderungsverlustBuchungen(r, "2026-09-30", [{ satz: 19, brutto_cent: 11900 }, { satz: 7, brutto_cent: 5350 }], "SKR03");
    expect(ohneKonto).toEqual([]);
    expect(buchungen).toEqual([
      expect.objectContaining({ datum: "2026-09-30", betrag_cent: 11900, soll_haben: "H", konto: "1410", gegenkonto: "2406", bu_schluessel: "", ust_satz: 19, belegfeld1: "2026-7" }),
      expect.objectContaining({ betrag_cent: 5350, gegenkonto: "2401", ust_satz: 7 }),
    ]);
    expect(forderungsverlustBuchungen(r, "2026-09-30", [{ satz: 19, brutto_cent: 100 }, { satz: 7, brutto_cent: 100 }], "SKR04").buchungen.map((b) => [b.konto, b.gegenkonto])).toEqual([["1210", "6936"], ["1210", "6931"]]);
    // Debitor statt Sammelkonto, Kontenvorgabe
    expect(forderungsverlustBuchungen({ ...r, personenkonto: "10001" }, "2026-09-30", [{ satz: 19, brutto_cent: 100 }], "SKR03", { vorgaben: { konten: { forderungsverlust19: "2407" } } }).buchungen[0]).toMatchObject({ konto: "10001", gegenkonto: "2407" });
  });

  it("0 % und andere Sätze: kein Konto (LIESMICH); nichts Offenes: keine Zeile", () => {
    const { buchungen, ohneKonto } = forderungsverlustBuchungen(r, "2026-09-30", [{ satz: 0, brutto_cent: 5000 }, { satz: 19, brutto_cent: 0 }, { satz: 16, brutto_cent: 116 }], "SKR03");
    expect(buchungen).toEqual([]);
    expect(ohneKonto).toEqual([{ satz: 0, brutto_cent: 5000 }, { satz: 16, brutto_cent: 116 }]);
  });
});
