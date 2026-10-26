/**
 * E-214 (Steuerberater, 26.10.2026, Antworten zu T-246 und T-244):
 * 1. Storno mit Ersatzrechnung bei EU-Umsätzen – Grund „Betrag hat sich geändert“ (Storno und Ersatz im Zeitraum des
 *    Stornos, dort nur der Unterschied) bzw. „Fehler in der Rechnung“ (der ursprüngliche Zeitraum wird berichtigt: ZM
 *    innerhalb eines Monats, § 18a Abs. 10 UStG, und Voranmeldung).
 * 2. Anzahlungen/Abschläge auf EU-Umsätze werden nicht gemeldet, die Lieferung bzw. Leistung mit dem vollen Entgelt.
 * 3. Skonto auf EU-Umsätze mindert Kz 41/21 und ZM im Zeitraum der Zahlung (§ 17, § 18b Satz 4 UStG) – auch bei Ist.
 * 4. DATEV: § 4 Nr. 2–7 UStG auf SKR03 8150 / SKR04 4150 (Kontenvorgabe `erloesKz43`), § 4 Nr. 1a weiter 8120/4120.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, kopieren, stornieren, zahlungVermerken, type EuStornoGrund, type Stand } from "../src/unterlagen/speicher";
import { EU_STORNO_GRUND, euBerichtigungen, umsaetzeFuer, zuordnungsTage, type Versteuerung } from "../src/unterlagen/ustAusRechnungen";
import { zmFuer } from "../src/unterlagen/euMeldungen";
import { steuerpaket } from "../src/unterlagen/steuerpaket";
import { strFromU8, unzipSync } from "fflate";
import { BUCHUNGSKONTEN, erloeskonto, kontenFuer, dokumentHtml, vorlageFuer, eRechnungAus, xrechnungUbl, KU_HINWEIS, type Daten } from "@amtlos/fachlogik";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", ust_idnr: "DE123456789", iban: "DE89370400440532013000" };
const AT = { kunde_name: "Wiener Kaffee GmbH", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_email: "re@wien.example", kunde_ust_idnr: "ATU69876543", zahlungsziel: "30" };
const pos = (preis: string) => [{ bezeichnung: "Kaffeebohnen", menge: "1", einheit: "Stück", preis, satz: "0" }];
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "31877", mandantennummer: "20514" };
const leer = (): Stand => ({ ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB });
const paket = (s: Stand, monat: string) => {
  const ende = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const p = steuerpaket(s, { von: `${monat}-01`, bis: ende, name: monat }, SB, {}, "2026-12-15T10:00:00");
  const dateien = unzipSync(p.zip);
  const stapelName = Object.keys(dateien).find((k) => k.startsWith("EXTF_Buchungsstapel"))!;
  return { liesmich: strFromU8(dateien["LIESMICH.txt"]!), zeilen: Buffer.from(dateien[stapelName]!).toString("latin1").split("\r\n").slice(2, -1).map((x) => x.split(";")) };
};

function rechnung(s: Stand, id: string, datum: string, daten: Daten, bezahlt?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = ausgeben(felderSetzen(s1, id, { datum, leistung_gleich: true, ...AT, ...daten }, t(datum)), id, t(datum));
  return bezahlt ? bezahltSetzen(s2, id, bezahlt, t(bezahlt)) : s2;
}
/** Storno am `datum` mit Grund, geteilt */
function storno(s: Stand, orig: string, id: string, datum: string, grund?: EuStornoGrund): Stand {
  const [s1, st] = stornieren(s, orig, t(datum), id, grund);
  expect(st).not.toBeNull();
  return ausgeben(s1, id, t(datum));
}
/** Ersatzrechnung als Kopie der stornierten Rechnung (verknüpft über `ersetzt`), mit geänderten Feldern, geteilt */
function ersatz(s: Stand, orig: string, id: string, datum: string, daten: Daten): Stand {
  const [s1, k] = kopieren(s, orig, t(datum), id);
  expect(k?.ersetzt).toBe(orig);
  return ausgeben(felderSetzen(s1, id, { datum, ...daten }, t(datum)), id, t(datum));
}
const kz = (s: Stand, periode: string, v: Versteuerung, feld: "umsatz_igl" | "umsatz_21" | "umsatz_43" | "umsatz_48") => umsaetzeFuer(s.unterlagen, periode, s.betrieb, v)?.werte[feld] ?? "0,00";
const zm = (s: Stand, periode: string) => zmFuer(s.unterlagen, periode, s.betrieb)!.zeilen;

/** igL: Lieferung 10.09., Rechnung 15.09.2026 über 1.000 € – gemeldet im September (3. Quartal) */
const lieferung = () => rechnung(leer(), "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["igl"], positionen: pos("1.000,00") });

describe("E-214 (1): Storno mit Ersatzrechnung einer innergemeinschaftlichen Lieferung", () => {
  it("„Betrag hat sich geändert“: Lieferung bleibt im September, Storno und Ersatz (900 €) im November – dort nur −100 € (vorher Ersatz im Oktober)", () => {
    let s = storno(lieferung(), "r1", "st1", "2026-11-05", "betrag");
    s = ersatz(s, "r1", "r2", "2026-11-05", { positionen: pos("900,00") });
    expect(s.unterlagen.find((u) => u.id === "st1")!.daten[EU_STORNO_GRUND]).toBe("betrag");
    for (const v of ["soll", "ist"] as const) {
      expect(kz(s, "2026-09", v, "umsatz_igl")).toBe("1.000,00");
      expect(kz(s, "2026-10", v, "umsatz_igl")).toBe("0,00");
      expect(kz(s, "2026-11", v, "umsatz_igl")).toBe("-100,00");
    }
    expect(zm(s, "2026-09")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 100000 }]);
    expect(zmFuer(s.unterlagen, "2026-10", s.betrieb)!.anzahl).toBe(0);
    expect(zm(s, "2026-11")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: -10000 }]);
    expect(euBerichtigungen(s.unterlagen, s.betrieb)).toEqual([]);
  });

  it("ohne Grund (ältere Daten) wie „Betrag hat sich geändert“ – Ersatzrechnung nicht mehr in einen früheren Monat gezogen", () => {
    let s = storno(lieferung(), "r1", "st1", "2026-11-05");
    s = ersatz(s, "r1", "r2", "2026-11-05", { positionen: pos("900,00") });
    expect(kz(s, "2026-10", "soll", "umsatz_igl")).toBe("0,00");
    expect(kz(s, "2026-11", "soll", "umsatz_igl")).toBe("-100,00");
  });

  it("„Fehler in der Rechnung“ (falsche USt-IdNr.): Storno und Ersatz berichtigen den September, November bleibt leer; Berichtigung mit Monatsfrist", () => {
    let s = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    s = ersatz(s, "r1", "r2", "2026-11-05", { kunde_ust_idnr: "ATU12345675" });
    // berichtigte ZM September: alte USt-IdNr. mit 0, neue mit 1.000 €
    expect(zm(s, "2026-09")).toEqual([
      { ust_idnr: "ATU12345675", art: "L", betrag_cent: 100000 },
      { ust_idnr: "ATU69876543", art: "L", betrag_cent: 0 },
    ]);
    expect(zm(s, "2026-Q3")).toEqual(zm(s, "2026-09"));
    expect(zmFuer(s.unterlagen, "2026-11", s.betrieb)!.zeilen).toEqual([]);
    expect(kz(s, "2026-09", "soll", "umsatz_igl")).toBe("1.000,00");
    expect(kz(s, "2026-11", "soll", "umsatz_igl")).toBe("0,00");
    // DATEV-Feld 116: Storno und Ersatz im ursprünglichen Zeitraum
    const tage = zuordnungsTage(s.unterlagen, s.betrieb);
    expect(tage.get("st1")).toBe("2026-09-15");
    expect(tage.get("r2")).toBe("2026-09-15");
    const b = euBerichtigungen(s.unterlagen, s.betrieb);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ stornoId: "st1", art: "L", tag: "2026-09-15", monat: "2026-09", quartal: "2026-Q3", stornoDatum: "2026-11-05", zmFrist: "2026-12-05", erledigt: null });
    // Hinweise: im September „berichtigt“, im November „zählt anderswo“, auf dem PDF der Voranmeldung als Annahme
    const sep = umsaetzeFuer(s.unterlagen, "2026-09", s.betrieb)!;
    expect(sep.berichtigungen.map((x) => x.stornoId)).toEqual(["st1"]);
    expect(sep.werte.annahmen).toContain("berichtigt den Zeitraum der ursprünglichen Meldung");
    expect(umsaetzeFuer(s.unterlagen, "2026-11", s.betrieb)!.berichtigungenAnderswo.map((x) => x.stornoId)).toEqual(["st1"]);
    expect(zmFuer(s.unterlagen, "2026-09", s.betrieb)!.berichtigungen).toHaveLength(1);
    // als abgegeben vermerkt
    expect(euBerichtigungen(s.unterlagen, s.betrieb, { "eu-berichtigung:st1": "2026-11-20" })[0]!.erledigt).toBe("2026-11-20");
  });

  it("„Fehler in der Rechnung“ ohne Ersatzrechnung (Lieferung gab es nicht): September berichtigt auf 0", () => {
    const s = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    expect(kz(s, "2026-09", "ist", "umsatz_igl")).toBe("0,00");
    expect(zm(s, "2026-09")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 0 }]);
    expect(zmFuer(s.unterlagen, "2026-11", s.betrieb)!.zeilen).toEqual([]);
  });

  it("„Fehler in der Rechnung“ mit falschem Lieferdatum: Ersatz (Lieferung 05.07.) gehört in den August – beide Monate zu berichtigen", () => {
    let s = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    s = ersatz(s, "r1", "r2", "2026-11-05", { leistung_gleich: false, leistung: "05.07.2026" });
    expect(kz(s, "2026-08", "soll", "umsatz_igl")).toBe("1.000,00");
    expect(kz(s, "2026-09", "soll", "umsatz_igl")).toBe("0,00");
    expect(euBerichtigungen(s.unterlagen, s.betrieb)[0]!.ersatzTag).toBe("2026-08-31");
    expect(umsaetzeFuer(s.unterlagen, "2026-08", s.betrieb)!.berichtigungen).toHaveLength(1);
  });

  it("sonstige Leistung (Kz 21, ZM „S“): „Fehler in der Rechnung“ berichtigt den Monat der Ausführung, „Betrag geändert“ wirkt im Monat des Stornos", () => {
    const basis = () => rechnung(leer(), "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["reverse_charge"], positionen: pos("300,00") });
    let f = storno(basis(), "r1", "st1", "2026-11-05", "rechnung");
    f = ersatz(f, "r1", "r2", "2026-11-05", { positionen: pos("250,00") });
    expect(kz(f, "2026-09", "ist", "umsatz_21")).toBe("250,00");
    expect(kz(f, "2026-11", "ist", "umsatz_21")).toBe("0,00");
    expect(zm(f, "2026-09")).toEqual([{ ust_idnr: "ATU69876543", art: "S", betrag_cent: 25000 }]);
    expect(euBerichtigungen(f.unterlagen, f.betrieb)[0]).toMatchObject({ art: "S", monat: "2026-09" });
    let b = storno(basis(), "r1", "st1", "2026-11-05", "betrag");
    b = ersatz(b, "r1", "r2", "2026-11-05", { positionen: pos("250,00") });
    expect(kz(b, "2026-09", "soll", "umsatz_21")).toBe("300,00");
    expect(kz(b, "2026-11", "soll", "umsatz_21")).toBe("-50,00");
    expect(zm(b, "2026-11")).toEqual([{ ust_idnr: "ATU69876543", art: "S", betrag_cent: -5000 }]);
  });

  it("der Grund wird nicht gedruckt: Stornorechnung (PDF und XRechnung) mit und ohne Grund gleich", () => {
    const s0 = lieferung();
    const [a] = stornieren(s0, "r1", t("2026-11-05"), "st1");
    const [b] = stornieren(s0, "r1", t("2026-11-05"), "st1", "rechnung");
    const ua = a.unterlagen.find((u) => u.id === "st1")!;
    const ub = b.unterlagen.find((u) => u.id === "st1")!;
    expect(ub.daten[EU_STORNO_GRUND]).toBe("rechnung");
    const v = vorlageFuer("rechnung")!;
    expect(dokumentHtml(v, ub.daten, BETRIEB)).toBe(dokumentHtml(v, ua.daten, BETRIEB));
    expect(xrechnungUbl(eRechnungAus(ub.daten, BETRIEB).daten, KU_HINWEIS)).toBe(xrechnungUbl(eRechnungAus(ua.daten, BETRIEB).daten, KU_HINWEIS));
    // die Kopie (Ersatzrechnung) übernimmt den Grund nicht
    const [c] = kopieren(storno(s0, "r1", "st1", "2026-11-05", "rechnung"), "st1", t("2026-11-05"), "r2");
    expect(c.unterlagen.find((u) => u.id === "r2")!.daten[EU_STORNO_GRUND]).toBeUndefined();
  });

  it("Steuerberater-Paket nennt die Berichtigung und trägt in Feld 116 den ursprünglichen Zeitraum", () => {
    let s = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    s = ersatz(s, "r1", "r2", "2026-11-05", { kunde_ust_idnr: "ATU12345675" });
    const p = paket(s, "2026-11");
    expect(p.liesmich).toContain("Fehler in der Rechnung mit EU-Umsatz");
    expect(p.liesmich).toContain("§ 18a Abs. 10 UStG");
    const igl = p.zeilen.filter((f) => f[6] === "8125" || f[7] === "8125");
    expect(igl.length).toBeGreaterThan(0);
    for (const f of igl) expect(f[115]).toBe("15092026");
  });
});

describe("E-214 (2): Anzahlungen und Teilzahlungen auf EU-Umsätze", () => {
  it("igL-Abschlagsrechnung (bezahlt) wird nicht gemeldet; die Schlussrechnung meldet das volle Entgelt", () => {
    let s = rechnung(leer(), "a1", "2026-07-10", { abschlag: true, hinweise: ["igl"], positionen: pos("400,00") }, "2026-07-15");
    s = rechnung(s, "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["igl"], positionen: pos("1.000,00"), schluss: true, abschlaege: [{ nummer: "1", netto: "400,00", satz: "0" }] });
    for (const v of ["soll", "ist"] as const) {
      expect(kz(s, "2026-07", v, "umsatz_igl")).toBe("0,00");
      expect(kz(s, "2026-09", v, "umsatz_igl")).toBe("1.000,00");
    }
    expect(zmFuer(s.unterlagen, "2026-07", s.betrieb)!.zeilen).toEqual([]);
    expect(zm(s, "2026-09")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 100000 }]);
    expect(zuordnungsTage(s.unterlagen, s.betrieb).get("a1")).toBeNull();
  });

  it("EU-Leistung: Vorauszahlung vor der Ausführung und Abschlag verschieben nichts – Meldung erst mit der Ausführung", () => {
    let s = rechnung(leer(), "r1", "2026-08-20", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["reverse_charge"], positionen: pos("300,00") }, "2026-08-25");
    s = rechnung(s, "a1", "2026-08-20", { abschlag: true, hinweise: ["reverse_charge"], positionen: pos("100,00") }, "2026-08-22");
    for (const v of ["soll", "ist"] as const) {
      expect(kz(s, "2026-08", v, "umsatz_21")).toBe("0,00");
      expect(kz(s, "2026-09", v, "umsatz_21")).toBe("300,00");
    }
    expect(zmFuer(s.unterlagen, "2026-08", s.betrieb)!.zeilen).toEqual([]);
    expect(zm(s, "2026-09")).toEqual([{ ust_idnr: "ATU69876543", art: "S", betrag_cent: 30000 }]);
  });

  it("Teilzahlungen (Ist) melden nichts; Teilleistungen zählen mit ihrer eigenen Ausführung", () => {
    let s = rechnung(leer(), "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["igl"], positionen: pos("1.000,00") });
    s = zahlungVermerken(s, "r1", { datum: "2026-10-05", betrag_cent: 40000 }, t("2026-10-05"));
    s = zahlungVermerken(s, "r1", { datum: "2026-11-05", betrag_cent: 60000 }, t("2026-11-05"));
    s = rechnung(s, "r2", "2026-10-30", { leistung_gleich: false, leistung: "30.10.2026", hinweise: ["reverse_charge"], positionen: pos("200,00") });
    expect(kz(s, "2026-09", "ist", "umsatz_igl")).toBe("1.000,00");
    expect(kz(s, "2026-10", "ist", "umsatz_igl")).toBe("0,00");
    expect(kz(s, "2026-11", "ist", "umsatz_igl")).toBe("0,00");
    expect(kz(s, "2026-10", "ist", "umsatz_21")).toBe("200,00");
  });

  it("DATEV bei Ist mit Teilzahlungen: gebucht zum Zahltag, Feld 116 = Tag nach § 18b (vorher Zahltag)", () => {
    let s: Stand = { ...leer(), betrieb: { ...BETRIEB, versteuerung: "ist" } };
    s = rechnung(s, "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["igl"], positionen: pos("1.000,00") });
    s = zahlungVermerken(s, "r1", { datum: "2026-10-05", betrag_cent: 40000 }, t("2026-10-05"));
    const igl = paket(s, "2026-10").zeilen.filter((f) => f[6] === "8125" || f[7] === "8125");
    expect(igl).toHaveLength(1);
    expect(igl[0]![9]).toBe("0510");
    expect(igl[0]![115]).toBe("15092026");
  });
});

describe("E-214 (3): Skonto auf EU-Umsätze im Zeitraum der Zahlung", () => {
  const mitSkonto = (betrieb = BETRIEB) => {
    let s: Stand = { ...leer(), betrieb };
    s = rechnung(s, "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["igl"], positionen: pos("1.000,00") });
    return zahlungVermerken(s, "r1", { datum: "2026-10-05", betrag_cent: 98000, minderung_cent: 2000, art: "skonto" }, t("2026-10-05"));
  };
  it("Soll und Ist: Kz 41 im Oktober −20 €, September bleibt 1.000 €; ZM ebenso (vorher: bei Ist gar nicht, ZM nie)", () => {
    const s = mitSkonto();
    for (const v of ["soll", "ist"] as const) {
      expect(kz(s, "2026-09", v, "umsatz_igl")).toBe("1.000,00");
      expect(kz(s, "2026-10", v, "umsatz_igl")).toBe("-20,00");
    }
    expect(zm(s, "2026-09")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 100000 }]);
    const okt = zmFuer(s.unterlagen, "2026-10", s.betrieb)!;
    expect(okt.zeilen).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: -2000 }]);
    expect(okt.minderungen).toBe(1);
    expect(okt.anzahl).toBe(0);
  });

  it("Paket: Skonto mit Feld 116 = Zahltag, LIESMICH ohne „ZM berichtigen (§ 18a Abs. 10)“", () => {
    const p = paket(mitSkonto(), "2026-10");
    expect(p.liesmich).toContain("Zeitraums, in dem das Skonto abgezogen wurde");
    expect(p.liesmich).toContain("die ursprüngliche Meldung bleibt");
    expect(p.liesmich).not.toMatch(/Skonto auf innergemeinschaftliche[^\n]*§ 18a Abs\. 10/);
    const sk = p.zeilen.filter((f) => f[6] === "8743" || f[7] === "8743");
    expect(sk).toHaveLength(1);
    expect(sk[0]![115]).toBe("05102026");
  });
});

describe("E-214 (4): DATEV-Erlöskonten für Kz 43", () => {
  const r = (grund: string) => ({ steuerart: "befreit" as const, kunde_land: "DE", befreiungsgrund: grund });
  it("§ 4 Nr. 2–7 UStG auf 8150/4150, § 4 Nr. 1a weiter 8120/4120, § 4 Nr. 8 ff. weiter 8100/4100", () => {
    expect(erloeskonto(kontenFuer("SKR03"), 0, r("Steuerfrei nach § 4 Nr. 2 UStG"))).toBe("8150");
    expect(erloeskonto(kontenFuer("SKR04"), 0, r("Steuerfrei nach § 4 Nr. 7 UStG"))).toBe("4150");
    expect(erloeskonto(kontenFuer("SKR03"), 0, r("Steuerfreie Ausfuhrlieferung, § 4 Nr. 1 Buchst. a UStG"))).toBe("8120");
    expect(erloeskonto(kontenFuer("SKR03"), 0, r("Steuerfrei nach § 4 Nr. 1a UStG"))).toBe("8120");
    expect(erloeskonto(kontenFuer("SKR03"), 0, r("Steuerfrei nach § 4 Nr. 20 UStG"))).toBe("8100");
    expect(erloeskonto(kontenFuer("SKR04"), 0, r("Steuerfrei nach § 4 Nr. 14 UStG"))).toBe("4100");
    expect(BUCHUNGSKONTEN.SKR03.erloese.befreit43).toBe("8150");
    expect(BUCHUNGSKONTEN.SKR04.erloese.befreit43).toBe("4150");
  });
  it("Kontenvorgabe `erloesKz43` ersetzt das Standardkonto", () => {
    expect(erloeskonto(kontenFuer("SKR03", { konten: { erloesKz43: "8155" } }), 0, r("§ 4 Nr. 3 UStG"))).toBe("8155");
    expect(kontenFuer("SKR03", { konten: { erloesKz43: "x" } }).erloese.befreit43).toBe("8150");
  });
});
