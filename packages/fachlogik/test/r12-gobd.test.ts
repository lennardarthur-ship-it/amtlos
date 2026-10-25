/**
 * R12 GoBD (interne Prüfrunde Steuern und Betriebsprüfung): Kartentrinkgeld, Gutscheine, „auf Rechnung“, Buchung nur des Bargelds
 * über die Kasse, Kassendifferenzen, Nacherfassung, Eigenbelege, Kassensturz, Sachentnahmen, Skonto bei igL und auf
 * Nicht-Waren, feste Belegnummern.
 */
import { describe, expect, it } from "vitest";
import {
  belegNummern,
  buchungenAusBelegen,
  eigenbelegeVergeben,
  grundGenuegt,
  kassenBuchungen,
  kassenDifferenzBuchungen,
  kassenFehler,
  kassenSummen,
  kassenUmsatz,
  kassenUmsatzJeSatz,
  kassenVerlauf,
  kassenVermerk,
  kassenabschlussAus,
  kassensturzAus,
  kassenstuerzeVereinen,
  kassenbuchDaten,
  naechsteBelegnummer,
  nacherfasstTage,
  sachentnahmeBuchungen,
  sachentnahmenFuer,
  skontoBuchungenBelege,
  skontoBuchungenRechnung,
  stueckelungSumme,
  zmBetroffen,
  type Beleg,
  type Kassenabschluss,
} from "../src/index.js";

const ka = (id: string, datum: string, o: Partial<Kassenabschluss> = {}): Kassenabschluss => ({ id, datum, zbon: "7", umsatz: [{ satz: 19, brutto_cent: 11900 }, { satz: 7, brutto_cent: 10700 }], karte_cent: 0, sonstige_cent: 0, bewegungen: [], erstellt: `${datum}T20:00:00.000Z`, geaendert: `${datum}T20:00:00.000Z`, festgeschrieben: `${datum}T20:00:00.000Z`, ...o });
const summeJe = (l: { konto: string; gegenkonto: string; betrag_cent: number }[], konto: string, gegen: string) => l.filter((b) => b.konto === konto && b.gegenkonto === gegen).reduce((a, b) => a + b.betrag_cent, 0);

describe("Kasse: Trinkgeld, Gutscheine, auf Rechnung", () => {
  it("Kartentrinkgeld: Karte darf um das Trinkgeld über dem Umsatz liegen; die Kasse zahlt es aus, Geldtransit an Kasse", () => {
    const k = ka("t", "2026-05-02", { karte_cent: 23600, trinkgeld_cent: 1000 });
    expect(kassenFehler(k)).toEqual([]);
    expect(kassenFehler({ ...k, trinkgeld_cent: 0 })).toContain("unbar_zu_hoch");
    expect(kassenFehler({ ...k, trinkgeld_cent: 30000 })).toContain("trinkgeld_zu_hoch");
    expect(kassenSummen(k).bar).toBe(0);
    // Bestand: 0 bar eingenommen, 10,00 € an das Personal ausgezahlt
    expect(kassenVerlauf([{ ...k, anfang_cent: 5000 }]).tage[0]!.soll).toBe(4000);
    const b = kassenBuchungen([k], "SKR03");
    expect(summeJe(b, "1360", "8400") + summeJe(b, "1360", "8300")).toBe(22600);
    expect(b.find((x) => x.buchungstext.startsWith("Kartentrinkgeld"))).toMatchObject({ konto: "1360", gegenkonto: "1000", betrag_cent: 1000, ust_satz: null });
    // Umsatzsteuer nur auf den Umsatz, nicht auf das Trinkgeld
    expect(kassenUmsatz([k], "2026-05-01", "2026-05-31").je[19].brutto).toBe(11900);
  });
  it("Einzweck-Gutschein: Verkauf ist Umsatz zum Satz des Gutscheins, die Einlösung kein zweiter Umsatz (§ 3 Abs. 14 UStG)", () => {
    const verkauf = ka("v", "2026-05-02", { gutscheine: [{ vorgang: "verkauf", art: "einzweck", satz: 7, betrag_cent: 5350 }] });
    expect(kassenUmsatzJeSatz(verkauf)[7]).toBe(10700 + 5350);
    expect(kassenSummen(verkauf).bar).toBe(22600 + 5350);
    const einl = ka("e", "2026-05-03", { gutscheine: [{ vorgang: "einloesung", art: "einzweck", satz: 7, betrag_cent: 5350 }] });
    expect(kassenUmsatzJeSatz(einl)[7]).toBe(10700 - 5350);
    expect(kassenSummen(einl).bar).toBe(22600 - 5350);
    const u = kassenUmsatz([verkauf, einl], "2026-05-01", "2026-05-31");
    expect(u.je[7].brutto).toBe(2 * 10700);
    expect(kassenFehler(ka("x", "2026-05-03", { gutscheine: [{ vorgang: "einloesung", art: "einzweck", satz: 7, betrag_cent: 20000 }] }))).toContain("gutschein_zu_hoch");
  });
  it("Mehrzweck-Gutschein: Verkauf an Verbindlichkeit (kein Umsatz), Einlösung Verbindlichkeit an Erlöse (§ 3 Abs. 15 UStG)", () => {
    const verkauf = ka("v", "2026-05-02", { umsatz: [], gutscheine: [{ vorgang: "verkauf", art: "mehrzweck", betrag_cent: 5000 }] });
    expect(kassenUmsatz([verkauf], "2026-05-01", "2026-05-31").tage).toBe(0);
    expect(kassenBuchungen([verkauf], "SKR03").map((b) => [b.konto, b.gegenkonto, b.betrag_cent])).toEqual([["1000", "1700", 5000]]);
    const einl = ka("e", "2026-05-03", { gutscheine: [{ vorgang: "einloesung", art: "mehrzweck", betrag_cent: 5000 }] });
    const b = kassenBuchungen([einl], "SKR04");
    expect(summeJe(b, "3500", "4400") + summeJe(b, "3500", "4300")).toBe(5000);
    expect(kassenSummen(einl).bar).toBe(22600 - 5000);
  });
  it("auf Rechnung: Forderungen an Erlöse, nicht Geldtransit; App wie Karte", () => {
    const k = ka("r", "2026-05-02", { aufrechnung_cent: 11300, app_cent: 2260 });
    const b = kassenBuchungen([k], "SKR03");
    expect(summeJe(b, "1410", "8400") + summeJe(b, "1410", "8300")).toBe(11300);
    expect(summeJe(b, "1360", "8400") + summeJe(b, "1360", "8300")).toBe(2260);
    expect(summeJe(b, "1000", "8400") + summeJe(b, "1000", "8300")).toBe(22600 - 11300 - 2260);
    expect(b.some((x) => x.konto === "1360" && x.gegenkonto === "1000")).toBe(false);
  });
  it("ältere Daten mit „sonstigen“ Zahlungsarten bleiben lesbar und laufen wie Karte über Geldtransit", () => {
    const k = kassenabschlussAus({ id: "a", datum: "2026-05-02", umsatz: [{ satz: 19, brutto_cent: 1000 }], karte_cent: 0, sonstige_cent: 400, bewegungen: [], erstellt: "2026-05-02T20:00:00Z" })!;
    expect(summeJe(kassenBuchungen([k], "SKR03"), "1360", "8400")).toBe(400);
  });
});

describe("Kasse: Zeitnähe, Grund, Eigenbelege, Differenzen, Kassensturz", () => {
  it("Tag nach heute ist ein Fehler; Nacherfassung ab zwei Tagen; Grund mindestens 10 Zeichen", () => {
    expect(kassenFehler(ka("z", "2026-10-25"), "2026-10-21")).toContain("zukunft");
    expect(kassenFehler(ka("z", "2026-10-21"), "2026-10-21")).not.toContain("zukunft");
    expect(nacherfasstTage("2026-10-20", "2026-10-21T08:00:00Z")).toBe(0);
    expect(nacherfasstTage("2026-10-01", "2026-10-21T08:00:00Z")).toBe(20);
    expect(nacherfasstTage("2026-10-19", "2026-10-21")).toBe(2);
    expect(grundGenuegt("x")).toBe(false);
    expect(grundGenuegt("Tippfehler Karte")).toBe(true);
    const k = ka("n", "2026-10-01", { erstellt: "2026-10-21T08:00:00.000Z", nacherfasst_grund: "Z-Bon lag in der Schublade", historie: [{ ...ka("n", "2026-10-01"), bis: "2026-10-22T09:00:00.000Z", grund: "Kartenumsatz laut Abrechnung" }] });
    const v = kassenVermerk(k);
    expect(v).toContain("erfasst 21.10.2026, 10:00");
    expect(v).toContain("nacherfasst (20 Tage nach dem Geschäftstag): Z-Bon lag in der Schublade");
    expect(v).toContain("korrigiert am 22.10.2026, 11:00: Kartenumsatz laut Abrechnung");
    expect(kassenbuchDaten([k], [], "2026-10")!.eintraege[0]!.text).toContain("korrigiert am 22.10.2026");
  });
  it("Eigenbeleg-Nummern fortlaufend je Jahr, vorhandene bleiben; im Kassenbuch und in Belegfeld 1", () => {
    const alt = ka("a", "2026-05-02", { bewegungen: [{ art: "transit", betrag_cent: 100, beleg_nr: "EB2026-004" }] });
    const neu = eigenbelegeVergeben({ ...ka("b", "2026-05-03"), bewegungen: [{ art: "entnahme", betrag_cent: 200 }, { art: "einlage", betrag_cent: 50, beleg_nr: "EB2026-002" }] }, [alt]);
    expect(neu.bewegungen.map((b) => b.beleg_nr)).toEqual(["EB2026-005", "EB2026-002"]);
    const k = { ...ka("b", "2026-05-03"), ...neu };
    expect(kassenBuchungen([k], "SKR03").find((b) => b.konto === "1800")!.belegfeld1).toBe("EB2026-005");
    expect(kassenbuchDaten([k], [], "2026-05")!.eintraege.find((e) => e.text!.startsWith("Privatentnahme"))!.beleg).toBe("EB2026-005");
  });
  it("Kassendifferenzen gebucht: Überschuss Kasse an Erlöse 19 %, Fehlbetrag Aufwand an Kasse", () => {
    const b = kassenDifferenzBuchungen([{ datum: "2026-05-02", cent: 230 }, { datum: "2026-05-03", cent: -150, standort: "" }], "SKR03");
    // StB-Prüfung (A-1): Fehlbetrag Kasse im Haben an Aufwand (Sachkonto als Gegenkonto)
    expect(b.map((x) => [x.konto, x.gegenkonto, x.betrag_cent, x.ust_satz, x.soll_haben])).toEqual([["1000", "8400", 230, 19, "S"], ["1000", "4900", 150, null, "H"]]);
    expect(kassenDifferenzBuchungen([{ datum: "2026-05-02", cent: 230 }], "SKR04", { kleinunternehmer: true })[0]!.gegenkonto).toBe("4185");
    // Voranmeldung: Überschuss zum Regelsatz
    expect(kassenUmsatz([], "2026-05-01", "2026-05-31", false, { ueberschuesse: [{ datum: "2026-05-02", cent: 119 }] }).je[19]).toEqual({ brutto: 119, netto: 100, ust: 19 });
  });
  it("Kassensturz: Stückelung, Lesen, Vereinen ohne Verlust", () => {
    expect(stueckelungSumme({ "5000": 2, "200": 3, "1": 4 })).toBe(10604);
    const k = kassensturzAus({ id: "s1", zeitpunkt: "2026-10-21T10:15:00.000Z", gezaehlt_cent: 10604, stueckelung: { "5000": 2, "200": 3, "1": 4, "300": 1 } })!;
    expect(k.stueckelung).toEqual({ "5000": 2, "200": 3, "1": 4 });
    expect(kassensturzAus({ id: "s1", zeitpunkt: "kaputt", gezaehlt_cent: 1 })).toBeNull();
    expect(kassenstuerzeVereinen([k], [{ ...k, gezaehlt_cent: 1 }, { ...k, id: "s0", zeitpunkt: "2026-10-20T10:00:00.000Z" }]).map((x) => [x.id, x.gezaehlt_cent])).toEqual([["s0", 10604], ["s1", 10604]]);
  });
});

describe("Sachentnahmen (§ 3 Abs. 1b UStG)", () => {
  const l = [{ id: "s", datum: "2026-12-31", netto7_cent: 161000, netto19_cent: 59800, erstellt: "2026-12-31T10:00:00Z" }];
  it("Voranmeldung und Buchungen 7 %/19 % aus den eingetragenen Werten", () => {
    expect(sachentnahmenFuer(l, "2026-10-01", "2026-12-31")).toEqual({ netto7: 161000, netto19: 59800, ust7: 11270, ust19: 11362, anzahl: 1 });
    expect(sachentnahmeBuchungen(l, "SKR03").map((b) => [b.konto, b.gegenkonto, b.betrag_cent])).toEqual([["1800", "8915", 172270], ["1800", "8910", 71162]]);
    expect(sachentnahmeBuchungen(l, "SKR03", { kleinunternehmer: true })).toEqual([]);
  });
});

describe("Skonto: igL/§ 13b und erhaltenes Skonto auf Nicht-Waren", () => {
  const r = { id: "r", nummer: "2026-012", kunde: "Wien GmbH", kleinunternehmer: false, positionen: [{ bezeichnung: "Ware", menge: 1, preis_cent: 100000, ust_satz: 0 }] } as unknown as Parameters<typeof skontoBuchungenRechnung>[0];
  it("igL: eigenes Konto und USt-IdNr. (Zusammenfassende Meldung), § 13b Inland eigenes Konto", () => {
    const igl = skontoBuchungenRechnung({ ...r, steuerart: "igl", kunde_land: "AT", kunde_ust_idnr: "ATU 12345678" }, [{ id: "z", datum: "2026-10-09", brutto_cent: 2000 }], "SKR03");
    expect(igl[0]).toMatchObject({ konto: "8743", gegenkonto: "1410", betrag_cent: 2000, eu_ustid: "ATU12345678" });
    expect(skontoBuchungenRechnung({ ...r, steuerart: "reverse_charge", kunde_land: "DE" }, [{ id: "z", datum: "2026-10-09", brutto_cent: 2000 }], "SKR04")[0]!.konto).toBe("4741");
    expect(zmBetroffen({ steuerart: "igl", kleinunternehmer: false, kunde_land: "AT" })).toBe(true);
    expect(zmBetroffen({ steuerart: "reverse_charge", kleinunternehmer: false, kunde_land: "DE" })).toBe(false);
  });
  it("erhaltenes Skonto: Waren auf Erhaltene Skonti, sonst gegen das Aufwandskonto mit BU wie der Beleg", () => {
    const b = (kategorie: string): Beleg => ({ id: kategorie, datum: "2026-05-02", lieferant: "X", nummer: "1", kategorie, steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: "2026-05-10", skonto_cent: 238, erstellt: "2026-05-02T08:00:00Z", geaendert: "2026-05-02T08:00:00Z" });
    expect(skontoBuchungenBelege([b("waren")], "SKR03")[0]).toMatchObject({ konto: "1610", gegenkonto: "3736", bu_schluessel: "" });
    expect(skontoBuchungenBelege([b("buero")], "SKR03")[0]).toMatchObject({ konto: "1610", gegenkonto: "4930", bu_schluessel: "9", betrag_cent: 238 });
  });
});

describe("Belegnummern (R12 GoBD)", () => {
  it("gespeicherte Nummern gelten unverändert; ohne Nummer nach der höchsten vorhandenen", () => {
    const b = (id: string, datum: string, nr?: string) => ({ id, datum, erstellt: `${datum}T08:00:00Z`, ...(nr ? { nr } : {}) });
    const m = belegNummern([b("a", "2026-01-02", "B2026-001"), b("c", "2026-01-04", "B2026-003"), b("d", "2026-01-05")]);
    expect([...m.values()]).toEqual(["B2026-001", "B2026-003", "B2026-004"]);
    expect(naechsteBelegnummer([{ nr: "B2026-003" }], "2026", ["B2026-007"])).toBe("B2026-008");
  });
  it("Barbeleg bleibt Barbeleg: gegen Kasse ab dem ersten Abschluss", () => {
    const bar: Beleg = { id: "b", datum: "2026-05-02", lieferant: "X", kategorie: "waren", steuer: [{ satz: 7, brutto_cent: 1070 }], vorsteuer: true, zahlung: "bar", erstellt: "2026-05-02T08:00:00Z", geaendert: "2026-05-02T08:00:00Z" };
    expect(buchungenAusBelegen([bar], "SKR03", { kasseAb: "2026-05-01" })[0]!.konto).toBe("1000");
  });
});
