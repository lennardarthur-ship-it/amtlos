/**
 * E-218 (Steuerberater 27.10.2026, T-274): Konten und Buchungen für Anzahlungen auf innergemeinschaftliche Lieferungen
 * bzw. EU-Leistungen – Bilanz „Erhaltene Anzahlungen auf Bestellungen“ (SKR03 1710 / SKR04 3250), EÜR ein Erlöskonto ohne
 * Umsatzsteuerfunktion ohne Standard (Kontenvorgabe).
 */
import { describe, expect, it } from "vitest";
import { BUCHUNGSKONTEN, buchungenAusRechnungen, euAnzahlungBuchung, kontenFuer, kontenvorgabenAus, kontenvorgabenAusJson, type AusgangsRechnungFuerBuchung } from "../src/index.js";

const schluss: AusgangsRechnungFuerBuchung = {
  id: "r1",
  nummer: "2026-0009",
  datum: "2026-09-15",
  art: "rechnung",
  kleinunternehmer: false,
  kunde: "Wiener Kaffee GmbH",
  positionen: [{ bezeichnung: "Kaffeebohnen", menge: 1, einheit: "stueck", preis_cent: 100000, ust_satz: 0 }],
  steuerart: "igl",
  kunde_land: "AT",
  kunde_ust_idnr: "ATU 69876543",
  leistungsdatum: "2026-09-10",
  steuerperiode: "2026-09-15",
  abschlaege: [{ nummer: "A-1", satz: 0, netto_cent: 40000, ust_cent: 0 }],
};

describe("E-218: Konten für Anzahlungen auf EU-Umsätze", () => {
  it("Bilanz 1710/3250 (änderbar), EÜR ohne Standard – nur eine gültige Vorgabe gilt", () => {
    expect(BUCHUNGSKONTEN.SKR03.anzahlungenErhalten).toBe("1710");
    expect(BUCHUNGSKONTEN.SKR04.anzahlungenErhalten).toBe("3250");
    expect(kontenFuer("SKR03").anzahlungEuEuer).toBe("");
    expect(kontenFuer("SKR04", { konten: { anzahlungEuEuer: "x12" } }).anzahlungEuEuer).toBe("");
    expect(kontenFuer("SKR03", { konten: { anzahlungEuEuer: "8955", anzahlungenErhalten: "1718" } })).toMatchObject({ anzahlungEuEuer: "8955", anzahlungenErhalten: "1718" });
    expect(kontenvorgabenAus({ konten: { anzahlungEuEuer: "8955" } }).konten).toEqual({ anzahlungEuEuer: "8955" });
    expect(kontenvorgabenAusJson(JSON.stringify({ format: "kontenvorgaben", version: 1, konten: { anzahlungEuEuer: "8955" } })).warnungen).toEqual([]);
  });
});

describe("E-218: Buchungen", () => {
  it("Zahlung: Forderungen an Anzahlungskonto, ohne BU, Feld 116 und USt-IdNr.", () => {
    const b = euAnzahlungBuchung("zahlung", { ...schluss, id: "a1", nummer: "A-1", abschlaege: [] }, { id: "z1", datum: "2026-07-15", betrag_cent: 40000 }, "1710", "SKR03");
    expect(b).toMatchObject({ datum: "2026-07-15", betrag_cent: 40000, soll_haben: "S", konto: "1410", gegenkonto: "1710", bu_schluessel: "", ust_satz: 0, art: "einnahme" });
    expect(b.steuerperiode).toBeUndefined();
    expect(b.eu_ustid).toBeUndefined();
  });

  it("Umbuchung (EÜR): Anzahlungskonto an 8125 mit Feld 116 und USt-IdNr.; Verrechnung (Bilanz): 1710 an Forderungen; Storno als Generalumkehr", () => {
    expect(euAnzahlungBuchung("umbuchung", schluss, { id: "s", datum: "2026-09-15", betrag_cent: 40000 }, "8955", "SKR03")).toMatchObject({ konto: "8955", gegenkonto: "8125", soll_haben: "S", steuerperiode: "2026-09-15", leistungsdatum: "2026-09-10", eu_ustid: "ATU69876543", art: "umbuchung" });
    expect(euAnzahlungBuchung("verrechnung", schluss, { id: "s", datum: "2026-09-15", betrag_cent: 40000 }, "1710", "SKR03")).toMatchObject({ konto: "1710", gegenkonto: "1410", soll_haben: "S" });
    expect(euAnzahlungBuchung("verrechnung", { ...schluss, art: "storno" }, { id: "s", datum: "2026-10-01", betrag_cent: 40000 }, "1710", "SKR03")).toMatchObject({ konto: "1710", gegenkonto: "1410", soll_haben: "S", generalumkehr: true, art: "storno" });
  });

  it("Schlussrechnung mit `vollesEntgelt`: ganzes Entgelt statt Rest nach den Abschlägen", () => {
    expect(buchungenAusRechnungen([schluss], "SKR03").map((b) => b.betrag_cent)).toEqual([60000]);
    expect(buchungenAusRechnungen([{ ...schluss, vollesEntgelt: true }], "SKR03").map((b) => b.betrag_cent)).toEqual([100000]);
  });
});
