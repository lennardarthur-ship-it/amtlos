/**
 * Steuerliche Prüfung Steuerberatungskanzlei (21.10.2026) in der App: Voranmeldung ohne OSS-Rechnungen und mit dem Rest der
 * Schlussrechnung, Liste der nach Rechnungsdatum zugeordneten Rechnungen, OSS-Erklärung und Zusammenfassende Meldung
 * aus den Rechnungen, eigener Nummernkreis für Gutschriften, offener Betrag der Schlussrechnung.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, type Stand } from "../src/unterlagen/speicher";
import { rechnungBrutto } from "../src/unterlagen/ablage";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { ossFuer, ossQuartale, zmFuer, zmPerioden } from "../src/unterlagen/euMeldungen";
import type { Daten } from "@amtlos/fachlogik";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", ust_idnr: "DE123456789", iban: "DE89370400440532013000" };

function rechnung(s: Stand, id: string, datum: string, daten: Daten): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: "Kunde GmbH", kunde_anschrift: "Hafenstraße 3\n20457 Hamburg", kunde_email: "re@kunde.example", ...daten }, t(datum));
  return ausgeben(s2, id, t(datum));
}
const pos = (preis: string, satz = "19") => [{ bezeichnung: "Leistung", menge: "1", einheit: "Stück", preis, satz }];

describe("Voranmeldung: OSS, Schlussrechnung, Zuordnungsannahmen", () => {
  it("OSS-Rechnungen zählen nicht in der deutschen Voranmeldung (5.2)", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    s = rechnung(s, "r1", "2026-07-10", { positionen: pos("100,00") });
    s = rechnung(s, "r2", "2026-07-12", { kunde_name: "Anna Gruber", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_art: "privat", oss: true, oss_satz: "20", positionen: pos("50,00") });
    const u = umsaetzeFuer(s.unterlagen, "2026-Q3", s.betrieb)!;
    expect(u.werte.umsatz_19).toBe("100,00");
    expect(u.oss).toBe(1);
    expect(u.werte.annahmen).toContain("OSS");
  });
  it("Schlussrechnung: nur der Rest nach den Abschlägen; offener Betrag = Rest (C-4)", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    s = rechnung(s, "r1", "2026-09-11", { positionen: pos("10.000,00"), schluss: true, abschlaege: [{ nummer: "2026-014", netto: "4.000,00", satz: "19" }] });
    expect(umsaetzeFuer(s.unterlagen, "2026-Q3", s.betrieb)!.werte.umsatz_19).toBe("6.000,00");
    expect(rechnungBrutto(s.unterlagen.find((u) => u.id === "r1")!, s.betrieb)).toBe(714000);
  });
  it("Rechnungen ohne Leistungsdatum: je Rechnung als Zuordnungsannahme (5.2)", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    s = rechnung(s, "r1", "2026-08-03", { leistung_gleich: false, leistung: "Sommer 2026", positionen: pos("200,00") });
    const u = umsaetzeFuer(s.unterlagen, "2026-Q3", s.betrieb)!;
    expect(u.ersatz).toBe(1);
    expect(u.ersatzNummern).toEqual(["2026-001"]);
    expect(u.werte.nach_rechnungsdatum).toBe("2026-001 | 03.08.2026 | Kunde GmbH | 200,00");
  });
});

describe("OSS-Erklärung und Zusammenfassende Meldung aus den Rechnungen (5.2, C-9)", () => {
  it("OSS je Land und Satz im Quartal", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    const wien = { kunde_name: "Anna Gruber", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_art: "privat", oss: true, oss_satz: "20" };
    s = rechnung(s, "r1", "2026-07-12", { ...wien, positionen: pos("50,00") });
    s = rechnung(s, "r2", "2026-08-12", { ...wien, positionen: pos("150,00") });
    s = rechnung(s, "r3", "2026-08-20", { kunde_name: "Jan de Vries", kunde_anschrift: "Dam 1\n1012 AB Amsterdam\nNiederlande", kunde_art: "privat", oss: true, oss_satz: "21", positionen: pos("100,00") });
    expect(ossQuartale(s.unterlagen, s.betrieb)).toEqual(["2026-Q3"]);
    const o = ossFuer(s.unterlagen, "2026-Q3", s.betrieb)!;
    expect(o.zeilen).toEqual([{ land: "AT", satz: 20, netto_cent: 20000 }, { land: "NL", satz: 21, netto_cent: 10000 }]);
    expect(o.werte).toMatchObject({ zeitraum: "3. Quartal 2026", umsaetze: [{ land: "AT", satz: "20", netto: "200,00" }, { land: "NL", satz: "21", netto: "100,00" }] });
  });
  it("ZM: igL (L) nach Rechnungsdatum, EU-Leistung (S) nach Ausführung, volle Euro", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    const at = { kunde_name: "Wiener Kaffee GmbH", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_ust_idnr: "ATU69876543" };
    s = rechnung(s, "r1", "2026-07-15", { ...at, hinweise: ["igl"], positionen: pos("841,99", "0") });
    s = rechnung(s, "r2", "2026-07-20", { ...at, hinweise: ["reverse_charge"], positionen: pos("300,00", "0") });
    expect(zmPerioden(s.unterlagen, s.betrieb)).toEqual(["2026-Q3", "2026-07"]);
    const z = zmFuer(s.unterlagen, "2026-07", s.betrieb)!;
    expect(z.zeilen).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 84100 }, { ust_idnr: "ATU69876543", art: "S", betrag_cent: 30000 }]);
  });
});

describe("Gutschrift-Nummernkreis (B-12)", () => {
  it("Nummern „GS-…“ zählen nicht in der Reihe der Rechnungsnummern", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    s = rechnung(s, "r1", "2026-07-10", { positionen: pos("100,00") });
    s = rechnung(s, "g1", "2026-07-11", { nummer: "GS-2026-007", hinweise: ["gutschrift"], kunde_steuernummer: "12/345/67890", positionen: pos("50,00") });
    const [s2, neu] = anlegen(s, "rechnung", t("2026-07-12"), "r3");
    expect(neu.daten.nummer).toBe("2026-002");
    expect(s2.unterlagen.length).toBe(3);
  });
});
