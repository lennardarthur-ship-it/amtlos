/**
 * Kleinunternehmer-Wächter nach vereinnahmten Entgelten (§ 19 Abs. 2 UStG n. F., StB Busch 22.10.2026, Katalog C.23):
 * Zahlungseingänge statt Rechnungsdatum, Ersatzregel für Rechnungen ohne Zahlungsvermerk, Kasse, nicht steuerbare
 * Auslandsumsätze, Stornos – und die vier Einträge in der Auswertung der App. Runde 2 (StB Busch): steuerfreie Umsätze
 * herausgerechnet, zwei Zählweisen (mit Ersatzregel für die Warnungen, nur Zahlungen für „überschritten“ und „ab 1. Januar“)
 * und der Hinweis „mit offenen Rechnungen“.
 */
import { describe, expect, it } from "vitest";
import type { KassenInhalt } from "@amtlos/fachlogik";
import { auswertung } from "../src/pflichten/check";
import { umsatzFakten, vereinnahmterUmsatz } from "../src/unterlagen/kuUmsatz";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, kasseSpeichern, stornieren, zahlungVermerken, type Stand } from "../src/unterlagen/speicher";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Atelier Kim", strasse: "Weg 1", plz: "80331", ort: "München", email: "kim@example.org", telefon: "089 1", steuernummer: "143/123/12345", iban: "DE89370400440532013000" };
const PROFIL = { rechtsform: "freiberuf", gruendungsdatum: "2022-01-01", "taetigkeit.einordnung": "freiberuf", "ust.kleinunternehmer": true, "umsatz.vorjahr": 20000, bundesland: "BY", gemeinde_ags: "09162000" };
const stand = (): Stand => ({ ...LEERER_STAND, betrieb: BETRIEB, profil: { ...PROFIL } });

type Pos = { bezeichnung: string; preis: string; satz: string };
function rechnung(s: Stand, id: string, datum: string, preis: string, o: { bezahlt?: string; kunde?: string; anschrift?: string; ku?: boolean; positionen?: Pos[]; befreiung?: string } = {}): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const positionen = (o.positionen ?? [{ bezeichnung: "Wandbild", preis, satz: "19" }]).map((p) => ({ ...p, menge: "1", einheit: "" }));
  const s2 = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: o.kunde ?? "Privatkundin", kunde_anschrift: o.anschrift ?? "Allee 2\n80333 München", kunde_email: "k@example.org", kleinunternehmer: o.ku ?? true, positionen, ...(o.befreiung ? { befreiung: o.befreiung } : {}) }, t(datum));
  const s3 = ausgeben(s2, id, t(datum));
  return o.bezahlt ? bezahltSetzen(s3, id, o.bezahlt) : s3;
}
const JAHR = ["2026-01-01", "2026-12-31"] as const;
const ergebnis = (s: Stand, stichtag: string) => {
  const a = auswertung(s.profil, stichtag, [], [], umsatzFakten(s, stichtag));
  const ids = (l: { id: string }[]) => l.map((p) => p.id);
  return { gilt: ids([...a.gilt, ...a.gruendung]), unbekannt: ids(a.unbekannt) };
};

describe("Vereinnahmter Umsatz (§ 19 Abs. 2 UStG)", () => {
  it("zählt nach dem Tag des Zahlungseingangs, nicht nach dem Rechnungsdatum", () => {
    let s = rechnung(stand(), "r1", "2025-12-15", "3.000,00", { bezahlt: "2026-01-10" });
    s = rechnung(s, "r2", "2026-03-01", "1.000,00", { bezahlt: "2026-03-20" });
    expect(vereinnahmterUmsatz(s, ...JAHR)).toEqual({ cent: 400000, ersatz_cent: 0, ersatz: 0, steuerfrei_cent: 0 });
    expect(vereinnahmterUmsatz(s, "2025-01-01", "2025-12-31").cent).toBe(0);
    // Zahlung nach dem Stichtag zählt noch nicht
    expect(umsatzFakten(s, "2026-03-19")).toEqual({ "finanzen.umsatz.vereinnahmt_laufendes_jahr": 3000, "finanzen.umsatz.vereinnahmt_vorjahr": 0, "finanzen.umsatz.bezahlt_laufendes_jahr": 3000, "finanzen.umsatz.bezahlt_vorjahr": 0 });
  });

  it("Ersatzregel: Rechnung ohne Zahlungsvermerk zählt mit dem Rechnungsdatum; Teilzahlungen nur mit den Zahlungen", () => {
    let s = rechnung(stand(), "r1", "2026-04-01", "2.000,00");
    s = rechnung(s, "r2", "2026-05-01", "1.000,00");
    s = zahlungVermerken(s, "r2", { datum: "2026-05-10", betrag_cent: 40000 });
    expect(vereinnahmterUmsatz(s, ...JAHR)).toEqual({ cent: 240000, ersatz_cent: 200000, ersatz: 1, steuerfrei_cent: 0 });
    // ohne offene Rechnungen (Zählweise für „überschritten“ und „ab 1. Januar“): nur die Teilzahlung
    expect(umsatzFakten(s, "2026-10-11")).toMatchObject({ "finanzen.umsatz.vereinnahmt_laufendes_jahr": 2400, "finanzen.umsatz.bezahlt_laufendes_jahr": 400 });
  });

  it("nicht steuerbare Leistungen an Unternehmen im Ausland zählen nicht", () => {
    let s = rechnung(stand(), "r1", "2026-03-10", "1.000,00", { bezahlt: "2026-03-20" });
    s = rechnung(s, "r2", "2026-04-10", "400,00", { bezahlt: "2026-04-20", kunde: "Studio Zürich", anschrift: "Bahnhofstr. 1\n8001 Zürich\nSchweiz" });
    s = rechnung(s, "r3", "2026-05-10", "600,00", { kunde: "Studio Zürich", anschrift: "Bahnhofstr. 1\n8001 Zürich\nSchweiz" });
    expect(vereinnahmterUmsatz(s, ...JAHR).cent).toBe(100000);
  });

  it("Storno: unbezahlt storniert zählt gar nicht, bezahlt und erstattet hebt sich auf", () => {
    let s = rechnung(stand(), "r1", "2026-03-10", "1.000,00");
    let [s2, st] = stornieren(s, "r1", t("2026-03-12"), "st1");
    s = ausgeben(s2, st!.id, t("2026-03-12"));
    expect(vereinnahmterUmsatz(s, ...JAHR)).toEqual({ cent: 0, ersatz_cent: 0, ersatz: 0, steuerfrei_cent: 0 });
    s = rechnung(s, "r2", "2026-04-10", "500,00", { bezahlt: "2026-04-15" });
    [s2, st] = stornieren(s, "r2", t("2026-04-20"), "st2");
    s = bezahltSetzen(ausgeben(s2, st!.id, t("2026-04-20")), "st2", "2026-04-22");
    expect(vereinnahmterUmsatz(s, ...JAHR).cent).toBe(0);
  });

  it("Kasseneinnahmen laut Tagesabschluss zählen mit (Kleinunternehmer: Betrag ohne Umsatzsteuer)", () => {
    const tag = (datum: string): KassenInhalt => ({ datum, zbon: null, umsatz: [{ satz: 19, brutto_cent: 50000 }], karte_cent: 0, sonstige_cent: 0, bewegungen: [] });
    let s = stand();
    [s] = kasseSpeichern(s, tag("2026-06-01"), t("2026-06-01"), "k1");
    [s] = kasseSpeichern(s, tag("2026-06-02"), t("2026-06-02"), "k2");
    expect(vereinnahmterUmsatz(s, ...JAHR).cent).toBe(100000);
    expect(umsatzFakten(s, "2026-10-11")["finanzen.umsatz.vereinnahmt_laufendes_jahr"]).toBe(1000);
  });

  it("ohne Rechnungen und Kasse in der App keine Fakten (die Wächter fragen dann das Profil)", () => {
    expect(umsatzFakten(stand(), "2026-10-11")).toEqual({});
  });
});

const BEFREIUNG = "Steuerfreie Heilbehandlung nach § 4 Nr. 14 UStG";
const GEMISCHT: Pos[] = [
  { bezeichnung: "Krankengymnastik (10 Termine)", preis: "300,00", satz: "0" },
  { bezeichnung: "Theraband", preis: "100,00", satz: "19" },
];

describe("Steuerfreie Umsätze (§ 19 Abs. 2 UStG, StB Busch Runde 2)", () => {
  it("Regelbesteuerung (wie Praxis-Szenario): Positionen zu 0 % mit Steuerbefreiung zählen nicht – bezahlt und offen", () => {
    let s = rechnung(stand(), "r1", "2026-03-01", "", { ku: false, positionen: GEMISCHT, befreiung: BEFREIUNG, bezahlt: "2026-03-10" });
    expect(vereinnahmterUmsatz(s, ...JAHR)).toEqual({ cent: 10000, ersatz_cent: 0, ersatz: 0, steuerfrei_cent: 30000 });
    // offen: Ersatzregel ebenfalls ohne den steuerfreien Teil
    s = rechnung(s, "r2", "2026-04-01", "", { ku: false, positionen: GEMISCHT, befreiung: BEFREIUNG });
    expect(vereinnahmterUmsatz(s, ...JAHR)).toEqual({ cent: 20000, ersatz_cent: 10000, ersatz: 1, steuerfrei_cent: 60000 });
    // Teilzahlung: der steuerfreie Anteil je Steuergruppe (19 % brutto 119 €, 0 % 300 €; 209,50 € = die Hälfte)
    s = zahlungVermerken(s, "r2", { datum: "2026-04-20", betrag_cent: 20950 });
    expect(vereinnahmterUmsatz(s, ...JAHR)).toMatchObject({ cent: 15000, ersatz_cent: 0, steuerfrei_cent: 45000 });
  });

  it("Storno einer bezahlten steuerfreien Rechnung hebt auch den steuerfreien Teil auf", () => {
    let s = rechnung(stand(), "r1", "2026-03-01", "", { ku: false, positionen: GEMISCHT, befreiung: BEFREIUNG, bezahlt: "2026-03-10" });
    const [s2, st] = stornieren(s, "r1", t("2026-03-20"), "st1");
    s = bezahltSetzen(ausgeben(s2, st!.id, t("2026-03-20")), "st1", "2026-03-22");
    expect(vereinnahmterUmsatz(s, ...JAHR)).toMatchObject({ cent: 0, steuerfrei_cent: 0 });
  });

  it("Kleinunternehmer: Position zu 0 % mit Hinweis auf die Steuerbefreiung zählt nicht; ohne Hinweis zählt sie (vorsichtig)", () => {
    const mit = rechnung(stand(), "r1", "2026-03-01", "", { positionen: GEMISCHT, befreiung: BEFREIUNG, bezahlt: "2026-03-10" });
    expect(vereinnahmterUmsatz(mit, ...JAHR)).toEqual({ cent: 10000, ersatz_cent: 0, ersatz: 0, steuerfrei_cent: 30000 });
    const offen = rechnung(stand(), "r1", "2026-03-01", "", { positionen: GEMISCHT, befreiung: BEFREIUNG });
    expect(vereinnahmterUmsatz(offen, ...JAHR)).toEqual({ cent: 10000, ersatz_cent: 10000, ersatz: 1, steuerfrei_cent: 30000 });
    const ohne = rechnung(stand(), "r1", "2026-03-01", "", { positionen: GEMISCHT, bezahlt: "2026-03-10" });
    expect(vereinnahmterUmsatz(ohne, ...JAHR)).toMatchObject({ cent: 40000, steuerfrei_cent: 0 });
  });

  it("Nullsteuersatz (§ 12 Abs. 3 UStG) ist steuerpflichtig und zählt mit", () => {
    const s = rechnung(stand(), "r1", "2026-05-01", "", { ku: false, positionen: [{ bezeichnung: "PV-Anlage 9,8 kWp", preis: "12.000,00", satz: "nullsatz" }], bezahlt: "2026-05-20" });
    expect(vereinnahmterUmsatz(s, ...JAHR)).toEqual({ cent: 1200000, ersatz_cent: 0, ersatz: 0, steuerfrei_cent: 0 });
  });

  it("steuerfreie Heilbehandlungen lösen keinen Wächter aus", () => {
    const s = rechnung(stand(), "r1", "2026-05-01", "", { positionen: [{ bezeichnung: "Krankengymnastik", preis: "90.000,00", satz: "0" }], befreiung: BEFREIUNG, bezahlt: "2026-05-20" });
    expect(umsatzFakten(s, "2026-10-11")).toMatchObject({ "finanzen.umsatz.vereinnahmt_laufendes_jahr": 0, "finanzen.umsatz.bezahlt_laufendes_jahr": 0 });
    expect(ergebnis(s, "2026-10-11").gilt.filter((id) => /^steuern\.kleinunternehmer_(warnung|grenze|naechstes)/.test(id))).toEqual([]);
  });
});

describe("Kleinunternehmer-Wächter in der App (C.23)", () => {
  it("Warnung 80 % aus bezahlten Rechnungen; unbezahlt vorsichtshalber nach Rechnungsdatum", () => {
    const bezahlt = rechnung(stand(), "r1", "2026-09-01", "85.000,00", { bezahlt: "2026-09-15" });
    expect(ergebnis(bezahlt, "2026-10-11").gilt).toContain("steuern.kleinunternehmer_warnung_80");
    expect(ergebnis(bezahlt, "2026-10-11").gilt).not.toContain("steuern.kleinunternehmer_warnung_95");
    // Zahlung erst nach dem Stichtag vermerkt: noch nicht vereinnahmt
    const spaeter = rechnung(stand(), "r1", "2026-09-01", "85.000,00", { bezahlt: "2026-10-20" });
    expect(ergebnis(spaeter, "2026-10-11").gilt).not.toContain("steuern.kleinunternehmer_warnung_80");
    const offen = rechnung(stand(), "r1", "2026-09-01", "85.000,00");
    expect(ergebnis(offen, "2026-10-11").gilt).toContain("steuern.kleinunternehmer_warnung_80");
  });

  it("Grenze überschritten über 100.000 € Zahlungseingänge; Vorjahr laut App über 25.000 € schließt „ab 1. Januar“ aus", () => {
    const ueber = rechnung(stand(), "r1", "2026-08-01", "100.000,01", { bezahlt: "2026-08-10" });
    expect(ergebnis(ueber, "2026-10-11").gilt).toContain("steuern.kleinunternehmer_grenze_ueberschritten");
    let s = rechnung(stand(), "r0", "2025-06-01", "26.000,00", { bezahlt: "2025-06-20" });
    s = rechnung(s, "r1", "2026-05-01", "30.000,00", { bezahlt: "2026-05-15" });
    const e = ergebnis(s, "2026-10-11");
    expect(e.gilt).toContain("steuern.kleinunternehmer_grenze_ueberschritten");
    expect(e.gilt).not.toContain("steuern.kleinunternehmer_naechstes_jahr");
    // Vorjahr unauffällig: ab 1. Januar Regelbesteuerung aus den Zahlungseingängen dieses Jahres
    const n = ergebnis(rechnung(stand(), "r1", "2026-05-01", "30.000,00", { bezahlt: "2026-05-15" }), "2026-10-11");
    expect(n.gilt).toContain("steuern.kleinunternehmer_naechstes_jahr");
    expect(n.gilt).not.toContain("steuern.kleinunternehmer_grenze_ueberschritten");
  });

  it("offene Rechnungen: Warnung ja, „überschritten“ nein – stattdessen der Hinweis; nach der Zahlung umgekehrt", () => {
    const H = "steuern.kleinunternehmer_grenze_offene_rechnungen";
    let s = rechnung(stand(), "r1", "2026-03-01", "70.000,00", { bezahlt: "2026-03-20" });
    s = rechnung(s, "r2", "2026-09-01", "30.000,01");
    expect(umsatzFakten(s, "2026-10-11")).toMatchObject({ "finanzen.umsatz.vereinnahmt_laufendes_jahr": 100000.01, "finanzen.umsatz.bezahlt_laufendes_jahr": 70000 });
    const offen = ergebnis(s, "2026-10-11");
    expect(offen.gilt).toContain(H);
    expect(offen.gilt).not.toContain("steuern.kleinunternehmer_grenze_ueberschritten");
    expect(offen.gilt).not.toContain("steuern.kleinunternehmer_warnung_95"); // mit Ersatzregel schon über 100 %
    expect(offen.gilt).toContain("steuern.kleinunternehmer_naechstes_jahr"); // Zahlungen 70.000 € > 25.000 €
    const bezahlt = ergebnis(bezahltSetzen(s, "r2", "2026-10-05"), "2026-10-11");
    expect(bezahlt.gilt).toContain("steuern.kleinunternehmer_grenze_ueberschritten");
    expect(bezahlt.gilt).not.toContain(H);
    expect(bezahlt.gilt).not.toContain("steuern.kleinunternehmer_naechstes_jahr");
  });

  it("offene Rechnungen über 25.000 €, Zahlungen darunter: kein „ab 1. Januar“, aber der Hinweis", () => {
    let s = rechnung(stand(), "r1", "2026-03-01", "20.000,00", { bezahlt: "2026-03-20" });
    s = rechnung(s, "r2", "2026-09-01", "10.000,00");
    const e = ergebnis(s, "2026-10-11");
    expect(e.gilt).toContain("steuern.kleinunternehmer_grenze_offene_rechnungen");
    expect(e.gilt).not.toContain("steuern.kleinunternehmer_naechstes_jahr");
  });
});
