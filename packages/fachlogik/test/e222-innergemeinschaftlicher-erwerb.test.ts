/**
 * E-222 (externer Prüfer, Befund 10): innergemeinschaftliche Erwerbe aus den Belegen – Kz 89/93 mit Steuer, Vorsteuer
 * Kz 61, DATEV-Erwerbskonten (Standard nur 19 % mit Vorsteuer, UNSICHER; sonst nur mit Kontenvorgabe).
 */
import { describe, expect, it } from "vitest";
import { STEUERSCHULD_ARTEN, belegAus, belegSummen, buchungenAusBelegen, igErwerbOhneKonto, kontenFuer, steuerschuldFuer, vorsteuerFuer, type Beleg } from "../src/index.js";

const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-03-10", lieferant: "Fournitures SARL", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100000 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, quelle: "hand", erstellt: "2026-03-10T09:00:00Z", geaendert: "2026-03-10T09:00:00Z", ...o }) as Beleg;

describe("E-222: innergemeinschaftlicher Erwerb am Beleg", () => {
  it("Art „Waren aus dem EU-Ausland“ wählbar und gespeichert", () => {
    expect(STEUERSCHULD_ARTEN.map((a) => a.wert)).toContain("ige");
    const b = belegAus({ ...beleg({ steuerschuld: "ige" }) });
    expect(b?.steuerschuld).toBe("ige");
  });

  it("Betrag ohne Umsatzsteuer, keine Vorsteuer aus Kz 66", () => {
    const b = beleg({ steuerschuld: "ige" });
    expect(belegSummen(b)).toEqual({ brutto_cent: 100000, netto_cent: 100000, ust_cent: 0, vorsteuer_cent: 0 });
    expect(vorsteuerFuer([b], "2026-03-01", "2026-03-31").cent).toBe(0);
  });

  it("Kz 89/93 mit Steuer, Vorsteuer Kz 61, getrennt von § 13b", () => {
    const belege = [
      beleg({ id: "a", steuerschuld: "ige", steuer: [{ satz: 19, brutto_cent: 100000 }, { satz: 7, brutto_cent: 20000 }] }),
      beleg({ id: "b", steuerschuld: "ige", steuer: [{ satz: 0, brutto_cent: 5000 }] }), // 0 % wie § 13b: Regelsatz
      beleg({ id: "c", steuerschuld: "eu", kategorie: "buero", steuer: [{ satz: 0, brutto_cent: 10000 }] }),
      beleg({ id: "d", steuerschuld: "ige", datum: "2026-04-01" }), // anderer Monat
    ];
    const r = steuerschuldFuer(belege, "2026-03-01", "2026-03-31");
    expect(r).toMatchObject({ ige_19_netto_cent: 105000, ige_19_steuer_cent: 19950, ige_7_netto_cent: 20000, ige_7_steuer_cent: 1400, ige_vorsteuer_cent: 21350, ige_anzahl: 2, ige_andere_cent: 0 });
    // § 13b unverändert: Kz 46/47 und Kz 67 nur aus dem EU-Leistungsbeleg
    expect(r).toMatchObject({ eu_netto_cent: 10000, eu_steuer_cent: 1900, vorsteuer_cent: 1900, anzahl: 1 });
  });

  it("ohne Vorsteuerabzug: Steuer ja, Kz 61 nein; Teilabzug anteilig", () => {
    expect(steuerschuldFuer([beleg({ steuerschuld: "ige", vorsteuer: false })], "2026-03-01", "2026-03-31")).toMatchObject({ ige_19_steuer_cent: 19000, ige_vorsteuer_cent: 0 });
    expect(steuerschuldFuer([beleg({ steuerschuld: "ige", vorsteuer_anteil: 50 })], "2026-03-01", "2026-03-31")).toMatchObject({ ige_19_steuer_cent: 19000, ige_vorsteuer_cent: 9500 });
  });
});

describe("E-222: DATEV-Stapel", () => {
  it("19 % mit Vorsteuer auf das Erwerbskonto (SKR03 3425 / SKR04 5425, UNSICHER), Betrag ohne Steuer, ohne BU", () => {
    const b = beleg({ steuerschuld: "ige" });
    const z3 = buchungenAusBelegen([b], "SKR03");
    expect(z3).toHaveLength(1);
    expect(z3[0]).toMatchObject({ gegenkonto: "3425", bu_schluessel: "", betrag_cent: 100000, konto: "1610", soll_haben: "H" });
    expect(buchungenAusBelegen([b], "SKR04")[0]).toMatchObject({ gegenkonto: "5425", bu_schluessel: "", betrag_cent: 100000 });
    expect(igErwerbOhneKonto([b], "SKR03")).toEqual([]);
  });

  it("7 % und ohne Vorsteuer ohne Standard: keine Zeile, aber in der Liste für LIESMICH; mit Kontenvorgabe gebucht", () => {
    const b = beleg({ steuerschuld: "ige", steuer: [{ satz: 19, brutto_cent: 100000 }, { satz: 7, brutto_cent: 20000 }] });
    expect(buchungenAusBelegen([b], "SKR03").map((x) => x.gegenkonto)).toEqual(["3425"]);
    expect(igErwerbOhneKonto([b], "SKR03").map((x) => [x.satz, x.betrag_cent, x.vorsteuer])).toEqual([[7, 20000, true]]);
    const vorgaben = { konten: { igErwerb7: "3999" } };
    expect(buchungenAusBelegen([b], "SKR03", { vorgaben }).map((x) => x.gegenkonto)).toEqual(["3425", "3999"]);
    expect(igErwerbOhneKonto([b], "SKR03", { vorgaben })).toEqual([]);
    // Kleinunternehmer bzw. ohne Vorsteuerabzug: kein Standard
    expect(buchungenAusBelegen([beleg({ steuerschuld: "ige" })], "SKR03", { kleinunternehmer: true })).toEqual([]);
    expect(igErwerbOhneKonto([beleg({ steuerschuld: "ige" })], "SKR03", { kleinunternehmer: true }).map((x) => x.vorsteuer)).toEqual([false]);
    expect(kontenFuer("SKR04").igErwerb).toEqual({ mit: { 19: "5425", 7: "" }, ohne: { 19: "", 7: "" } });
  });

  it("§ 13b-Belege unverändert auf 3123/3120", () => {
    expect(buchungenAusBelegen([beleg({ steuerschuld: "eu", steuer: [{ satz: 0, brutto_cent: 1000 }] })], "SKR03")[0]?.gegenkonto).toBe("3123");
  });
});
