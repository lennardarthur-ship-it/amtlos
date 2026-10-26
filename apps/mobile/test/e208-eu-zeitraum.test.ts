/**
 * E-208 (Befund 8a): EU-Umsätze standen in der Voranmeldung in einem anderen Zeitraum als in der Zusammenfassenden
 * Meldung – das BZSt gleicht beide ab. Ursache: Die ZM ordnete innergemeinschaftliche Lieferungen nach der Rechnung zu
 * (§ 18a Abs. 8 UStG), die Voranmeldung nach der Leistung (Soll) bzw. nach dem Zahlungseingang (Ist); sonstige Leistungen
 * an Unternehmen im EU-Ausland bei Ist ebenfalls nach dem Zahltag. Richtig für beide (§ 18b Satz 1 Nr. 1 und 2, Satz 2
 * und 3 UStG): Lieferung im Zeitraum der Rechnung, spätestens im Monat nach der Lieferung; sonstige Leistung im Zeitraum
 * der Ausführung – unabhängig von Soll- oder Ist-Versteuerung.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, type Stand } from "../src/unterlagen/speicher";
import { umsaetzeFuer, type Versteuerung } from "../src/unterlagen/ustAusRechnungen";
import { zmFuer } from "../src/unterlagen/euMeldungen";
import type { Daten } from "@amtlos/fachlogik";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", ust_idnr: "DE123456789", iban: "DE89370400440532013000" };
const AT = { kunde_name: "Wiener Kaffee GmbH", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_email: "re@wien.example", kunde_ust_idnr: "ATU69876543", zahlungsziel: "30" };
const pos = (preis: string) => [{ bezeichnung: "Kaffeebohnen", menge: "1", einheit: "Stück", preis, satz: "0" }];

function rechnung(s: Stand, id: string, datum: string, daten: Daten, bezahlt?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = ausgeben(felderSetzen(s1, id, { datum, leistung_gleich: true, ...AT, ...daten }, t(datum)), id, t(datum));
  return bezahlt ? bezahltSetzen(s2, id, bezahlt, t(bezahlt)) : s2;
}
const kz = (s: Stand, periode: string, v: Versteuerung, feld: "umsatz_igl" | "umsatz_21") => umsaetzeFuer(s.unterlagen, periode, s.betrieb, v)?.werte[feld];
const zm = (s: Stand, periode: string) => zmFuer(s.unterlagen, periode, s.betrieb)!.zeilen;

describe("E-208: Voranmeldung (Kz 41/21) und ZM im selben Zeitraum", () => {
  it("Soll: Lieferung am 28.09., Rechnung am 05.10. – beide im 4. Quartal (vorher Voranmeldung im 3.)", () => {
    const s = rechnung({ ...LEERER_STAND, betrieb: BETRIEB }, "r1", "2026-10-05", { leistung_gleich: false, leistung: "28.09.2026", hinweise: ["igl"], positionen: pos("1.000,00") });
    expect(zm(s, "2026-Q4")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 100000 }]);
    expect(kz(s, "2026-Q4", "soll", "umsatz_igl")).toBe("1.000,00");
    expect(kz(s, "2026-Q3", "soll", "umsatz_igl") ?? "0,00").toBe("0,00");
  });

  it("Rechnung erst lange nach der Lieferung: spätestens im Monat nach der Lieferung (Lieferung Juli, Rechnung 15.09. → August)", () => {
    const s = rechnung({ ...LEERER_STAND, betrieb: BETRIEB }, "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.07.2026", hinweise: ["igl"], positionen: pos("500,00") });
    expect(zm(s, "2026-08")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 50000 }]);
    expect(kz(s, "2026-08", "soll", "umsatz_igl")).toBe("500,00");
    expect(kz(s, "2026-08", "ist", "umsatz_igl")).toBe("500,00");
  });

  it("Ist: Lieferung und Rechnung im September, bezahlt im Oktober – beide im 3. Quartal (vorher Voranmeldung im 4.)", () => {
    const s = rechnung({ ...LEERER_STAND, betrieb: BETRIEB }, "r1", "2026-09-10", { hinweise: ["igl"], positionen: pos("800,00") }, "2026-10-20");
    expect(zm(s, "2026-Q3")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 80000 }]);
    expect(kz(s, "2026-Q3", "ist", "umsatz_igl")).toBe("800,00");
    expect(kz(s, "2026-Q4", "ist", "umsatz_igl") ?? "0,00").toBe("0,00");
  });

  it("Ist: sonstige Leistung an ein Unternehmen in Österreich im September, bezahlt im Oktober – Kz 21 und ZM „S“ im 3. Quartal", () => {
    const s = rechnung({ ...LEERER_STAND, betrieb: BETRIEB }, "r1", "2026-09-10", { hinweise: ["reverse_charge"], positionen: pos("300,00") }, "2026-10-05");
    expect(zm(s, "2026-Q3")).toEqual([{ ust_idnr: "ATU69876543", art: "S", betrag_cent: 30000 }]);
    expect(kz(s, "2026-Q3", "ist", "umsatz_21")).toBe("300,00");
    expect(kz(s, "2026-Q4", "ist", "umsatz_21") ?? "0,00").toBe("0,00");
  });

  it("Inlandsumsätze bei Ist weiter nach dem Zahlungseingang", () => {
    const s = rechnung({ ...LEERER_STAND, betrieb: BETRIEB }, "r1", "2026-09-10", { kunde_name: "Kunde GmbH", kunde_anschrift: "Hafenstraße 3\n20457 Hamburg", kunde_ust_idnr: "", positionen: [{ bezeichnung: "Leistung", menge: "1", einheit: "Stück", preis: "100,00", satz: "19" }] }, "2026-10-05");
    expect(umsaetzeFuer(s.unterlagen, "2026-Q4", s.betrieb, "ist")!.werte.umsatz_19).toBe("100,00");
    expect(umsaetzeFuer(s.unterlagen, "2026-Q3", s.betrieb, "ist")!.werte.umsatz_19 ?? "0,00").toBe("0,00");
  });
});
