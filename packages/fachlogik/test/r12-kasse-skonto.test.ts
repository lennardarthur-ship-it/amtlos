/**
 * R12: Kassenabschluss (Tagesumsätze, Bargeldbestand, fehlende Tage, Kassenbuch, Buchungen) und Skonto (Rechnung,
 * XRechnung BT-20, Aufteilung je Steuersatz, Zahlungen, Beleg-Skonto, DATEV).
 */
import { describe, expect, it } from "vitest";
import {
  KU_HINWEIS,
  LEERER_BETRIEB,
  aufteilen,
  ausgabenFuer,
  belegSkonto,
  buchungenAusBelegen,
  dokumentHtml,
  eRechnungAus,
  fehlendeTage,
  kassenBuchungen,
  kassenKorrektur,
  kassenUmsatz,
  kassenVereinen,
  kassenVerlauf,
  kassenabschlussAus,
  kassenbuchDaten,
  minderungNachSatz,
  retrogradeBareinnahmen,
  skontoAus,
  skontoBuchungenBelege,
  skontoBuchungenRechnung,
  skontoZeile,
  summen,
  tageText,
  vorlageFuer,
  vorsteuerFuer,
  xrechnungUbl,
  zahlungenAus,
  zahlungsAnteile,
  zahlungsStand,
  zbonLuecken,
  type Beleg,
  type Betrieb,
  type Daten,
  type Kassenabschluss,
} from "../src/index.js";
import { RECHNUNG_SKONTO_FALSCH, RECHNUNG_SKONTO_FRIST } from "../src/dokumente/buchhaltung.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Elektro Brandt", strasse: "Hafenstr. 3", plz: "44147", ort: "Dortmund", verantwortlich: "Kai Brandt", telefon: "0231 1", email: "info@brandt.example", steuernummer: "314/5555/1234", ust_idnr: "DE123456789", iban: "DE02120300000000202051" };
const RE: Daten = { nummer: "2026-021", datum: "2026-10-02", leistung_gleich: true, zahlungsziel: "30", kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n44135 Dortmund", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Installation", menge: "1", einheit: "Stunde", preis: "2990,00", satz: "19" }], skonto: true, skonto_prozent: "2", skonto_tage: "10" };

const ka = (id: string, datum: string, o: Partial<Kassenabschluss> = {}): Kassenabschluss => ({ id, datum, zbon: null, umsatz: [{ satz: 19, brutto_cent: 11900 }, { satz: 7, brutto_cent: 10700 }], karte_cent: 10000, sonstige_cent: 0, bewegungen: [], erstellt: `${datum}T20:00:00.000Z`, geaendert: `${datum}T20:00:00.000Z`, festgeschrieben: `${datum}T20:00:00.000Z`, ...o });
const beleg = (id: string, datum: string, brutto: number, o: Partial<Beleg> = {}): Beleg => ({ id, datum, lieferant: "Großmarkt", nummer: `B-${id}`, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: brutto }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: `${datum}T08:00:00Z`, geaendert: `${datum}T08:00:00Z`, ...o });

describe("Skonto auf der Rechnung (§ 14 Abs. 4 Satz 1 Nr. 8 UStG) und in der XRechnung (BT-20)", () => {
  it("liest Prozent und Tage, rechnet die Frist wie das Zahlungsziel", () => {
    expect(skontoAus("2", "10")).toEqual({ prozent: 2, tage: 10 });
    expect(skontoAus("2,5", "14")).toEqual({ prozent: 2.5, tage: 14 });
    expect(skontoAus("0", "10")).toBeNull();
    expect(skontoAus("2", "")).toBeNull();
    const { daten } = eRechnungAus(RE, B);
    // 02.10. + 10 Tage = 12.10.2026 (Montag)
    expect(daten.skonto).toEqual({ prozent: 2, tage: 10, bis: "2026-10-12" });
    expect(skontoZeile({ prozent: 2, tage: 10 })).toBe("#SKONTO#TAGE=10#PROZENT=2.00#");
  });
  it("druckt die Bedingung im Zahlungsblock, der GiroCode bleibt beim vollen Betrag", () => {
    const html = dokumentHtml(vorlageFuer("rechnung")!, RE, B).replace(/&nbsp;/g, " ");
    expect(html).toContain("Bei Zahlung bis zum 12.10.2026 gewähren wir 2 % Skonto");
    expect(html).toContain("GiroCode über den vollen Betrag");
    // 3.558,10 € brutto, 2 % = 71,16 €
    expect(html.replace(/\u00a0/g, " ")).toContain("zu überweisen sind dann 3.486,94 €");
  });
  it("XRechnung: Zahlungsbedingung mit Skonto-Zeile und Zeilenumbruch, lesbarer Satz dahinter", () => {
    const xml = xrechnungUbl(eRechnungAus(RE, B).daten, KU_HINWEIS);
    expect(xml).toMatch(/<cac:PaymentTerms>\s*<cbc:Note>#SKONTO#TAGE=10#PROZENT=2\.00#\nBei Zahlung bis zum 12\.10\.2026/);
    // PaymentTerms steht nach PaymentMeans und vor TaxTotal (UBL-Reihenfolge)
    expect(xml.indexOf("<cac:PaymentMeans>")).toBeLessThan(xml.indexOf("<cac:PaymentTerms>"));
    expect(xml.indexOf("<cac:PaymentTerms>")).toBeLessThan(xml.indexOf("<cac:TaxTotal>"));
    // ohne Skonto keine Zahlungsbedingung (wie bisher)
    expect(xrechnungUbl(eRechnungAus({ ...RE, skonto: false }, B).daten, KU_HINWEIS)).not.toContain("PaymentTerms");
    // nicht bei Storno
    expect(eRechnungAus({ ...RE, storno_zu: "2026-020" }, B).daten.skonto).toBeUndefined();
  });
  it("prüft die Angaben und warnt bei einer Frist, die nicht kürzer als das Zahlungsziel ist", () => {
    const v = vorlageFuer("rechnung")!;
    expect(v.pruefen!({ ...RE, skonto_prozent: "abc" }, B)).toContain(RECHNUNG_SKONTO_FALSCH);
    expect(v.hinweise!({ ...RE, skonto_tage: "30" }, B)).toContain(RECHNUNG_SKONTO_FRIST);
    expect(v.hinweise!(RE, B)).not.toContain(RECHNUNG_SKONTO_FRIST);
  });
});

describe("Aufteilung je Steuersatz und Zahlungen", () => {
  it("teilt genau auf (größter Rest)", () => {
    expect(aufteilen(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(aufteilen(7119, [11900, 10700]).reduce((a, x) => a + x, 0)).toBe(7119);
  });
  it("Skonto 2 % bei 19 % und 7 %: Netto je Satz aus dem Brutto", () => {
    const g = summen([{ bezeichnung: "a", menge: 1, einheit: "stueck", preis_cent: 10000, ust_satz: 19 }, { bezeichnung: "b", menge: 1, einheit: "stueck", preis_cent: 10000, ust_satz: 7 }], false).gruppen;
    // brutto 119,00 + 107,00 = 226,00 → 2 % = 4,52 €
    const m = minderungNachSatz(452, g);
    expect(m.map((x) => x.brutto_cent)).toEqual([238, 214]);
    expect(m.map((x) => x.netto_cent)).toEqual([200, 200]);
    expect(m.map((x) => x.ust_cent)).toEqual([38, 14]);
  });
  it("Zahlungen: offener Rest bei Teilzahlung, Minderung nie offen; Anteile ergeben das Netto der Rechnung", () => {
    const g = summen([{ bezeichnung: "a", menge: 1, einheit: "stueck", preis_cent: 299000, ust_satz: 19 }], false).gruppen;
    const z = zahlungenAus([{ id: "z2", datum: "2026-10-20", betrag_cent: 158000 }, { id: "z1", datum: "2026-10-09", betrag_cent: 200000 }, { id: "kaputt", datum: "x", betrag_cent: 1 }]);
    expect(z.map((x) => x.id)).toEqual(["z1", "z2"]);
    expect(zahlungsStand(355810, z.slice(0, 1))).toEqual({ erhalten: 200000, minderung: 0, offen: 155810 });
    const a = zahlungsAnteile(g, z);
    expect(a.reduce((s, x) => s + x.erhalten[0]!.brutto_cent, 0)).toBe(355810);
    expect(a.reduce((s, x) => s + x.erhalten[0]!.netto_cent, 0)).toBe(299000);
    // mit Skonto: erhalten 3.486,94, Skonto 71,16 → Netto erhalten = 2.990,00 − 59,80
    const sk = zahlungsAnteile(g, zahlungenAus([{ id: "z", datum: "2026-10-09", betrag_cent: 348694, minderung_cent: 7116 }]))[0]!;
    expect(sk.minderung[0]).toMatchObject({ brutto_cent: 7116, netto_cent: 5980, ust_cent: 1136 });
    expect(sk.erhalten[0]).toMatchObject({ brutto_cent: 348694, netto_cent: 293020 });
  });
});

describe("Skonto bei Belegen (§ 17 Abs. 1 Satz 2 UStG) und DATEV", () => {
  const b = beleg("b1", "2026-09-07", 23800, { bezahlt: "2026-10-05", skonto_cent: 476 });
  it("mindert die Vorsteuer im Zeitraum der Zahlung und die Betriebsausgabe", () => {
    expect(belegSkonto(b)).toEqual([{ satz: 19, brutto_cent: 476, netto_cent: 400, ust_cent: 76 }]);
    expect(vorsteuerFuer([b], "2026-09-01", "2026-09-30").cent).toBe(3800);
    expect(vorsteuerFuer([b], "2026-10-01", "2026-10-31")).toMatchObject({ cent: -76, skonto_cent: -76 });
    const a = ausgabenFuer([b], "2026");
    expect(a.summe_cent).toBe(20000 - 400);
    expect(a.vorsteuer_cent).toBe(3800 - 76);
  });
  it("bucht erhaltene Skonti (SKR03 3736, SKR04 5736) vom Gegenkonto des Belegs zum Zahltag", () => {
    const [x] = skontoBuchungenBelege([b], "SKR03");
    expect(x).toMatchObject({ datum: "2026-10-05", konto: "1610", gegenkonto: "3736", betrag_cent: 476, soll_haben: "S", bu_schluessel: "" });
    expect(skontoBuchungenBelege([b], "SKR04")[0]).toMatchObject({ konto: "3310", gegenkonto: "5736" });
    expect(skontoBuchungenBelege([{ ...b, vorsteuer: false }], "SKR03")[0]!.gegenkonto).toBe("3730");
  });
  it("gewährte Skonti je Steuersatz an Forderungen (8736/8731, Kleinunternehmer 8730)", () => {
    const r = { id: "r1", nummer: "2026-021", kunde: "Muster GmbH", kleinunternehmer: false, positionen: [{ bezeichnung: "a", menge: 1, einheit: "stueck" as const, preis_cent: 10000, ust_satz: 19 }, { bezeichnung: "b", menge: 1, einheit: "stueck" as const, preis_cent: 10000, ust_satz: 7 }] };
    const l = skontoBuchungenRechnung(r, [{ id: "z1", datum: "2026-10-09", brutto_cent: 452 }], "SKR03");
    expect(l.map((x) => [x.konto, x.gegenkonto, x.betrag_cent, x.steuerperiode])).toEqual([["8736", "1410", 238, "2026-10-09"], ["8731", "1410", 214, "2026-10-09"]]);
    expect(skontoBuchungenRechnung({ ...r, kleinunternehmer: true }, [{ id: "z1", datum: "2026-10-09", brutto_cent: 452 }], "SKR04")[0]!.konto).toBe("4730");
  });
  it("Barbelege: mit Kassenführung in Amtlos gegen Kasse, davor bzw. ohne gegen Geldtransit (kein Kassenminus)", () => {
    const bar = beleg("b2", "2026-05-09", 1190, { zahlung: "bar" });
    expect(buchungenAusBelegen([bar], "SKR03")[0]!.gegenkonto).toBe("1000");
    expect(buchungenAusBelegen([bar], "SKR03", { kasseAb: "2026-05-01" })[0]!.gegenkonto).toBe("1000");
    expect(buchungenAusBelegen([bar], "SKR03", { kasseAb: "2026-06-01" })[0]!.gegenkonto).toBe("1360");
    expect(buchungenAusBelegen([bar], "SKR04", { kasseAb: null })[0]!.gegenkonto).toBe("1460");
  });
});

describe("Kassenabschluss: Lesen, Korrektur, Zusammenführen", () => {
  it("liest und bereinigt; Unlesbares fällt weg, Pfade nie als Datei", () => {
    expect(kassenabschlussAus({ id: "a", datum: "kaputt" })).toBeNull();
    const k = kassenabschlussAus({ id: "a", datum: "2026-05-02", umsatz: [{ satz: 19, brutto_cent: 100 }, { satz: 12, brutto_cent: 5 }], karte_cent: -3, datei: "../x.jpg", bewegungen: [{ art: "transit", betrag_cent: 0 }, { art: "entnahme", betrag_cent: 500 }], tse_seriennr: "TSE-1", festgeschrieben: "kaputt", erstellt: "2026-05-02T20:00:00Z" })!;
    expect(k.umsatz).toEqual([{ satz: 19, brutto_cent: 100 }]);
    expect(k.karte_cent).toBe(0);
    expect(k.datei).toBeNull();
    expect(k.bewegungen).toEqual([{ art: "entnahme", betrag_cent: 500 }]);
    expect(k.tse_seriennr).toBe("TSE-1");
    expect(k.festgeschrieben).toBe("2026-05-02T20:00:00Z");
  });
  it("Korrektur bewahrt die vorige Fassung mit Grund (GoBD)", () => {
    const k = ka("a", "2026-05-02");
    const neu = kassenKorrektur(k, { ...k, umsatz: [{ satz: 19, brutto_cent: 12900 }] }, "Tippfehler 19 %", "2026-05-03T08:00:00.000Z");
    expect(neu.umsatz).toEqual([{ satz: 19, brutto_cent: 12900 }]);
    expect(neu.historie).toHaveLength(1);
    expect(neu.historie![0]).toMatchObject({ grund: "Tippfehler 19 %", bis: "2026-05-03T08:00:00.000Z", umsatz: k.umsatz });
    expect(neu.festgeschrieben).toBe(k.festgeschrieben);
  });
  it("Zusammenführen verliert keine Fassung: neuere gewinnt, abweichende ältere kommt in die Historie", () => {
    const k = ka("a", "2026-05-02");
    const geraet1 = kassenKorrektur(k, { ...k, karte_cent: 5000 }, "Karte falsch", "2026-05-03T08:00:00.000Z");
    const geraet2 = kassenKorrektur(k, { ...k, karte_cent: 6000 }, "Karte laut Abrechnung", "2026-05-03T09:00:00.000Z");
    const v = kassenVereinen([geraet1, ka("b", "2026-05-03")], [geraet2]);
    expect(v.map((x) => x.id)).toEqual(["a", "b"]);
    const a = v[0]!;
    expect(a.karte_cent).toBe(6000);
    expect(a.historie!.map((h) => h.grund)).toEqual(["Karte falsch", "Karte laut Abrechnung", "Abweichende Fassung von einem anderen Gerät (Synchronisation)"]);
    expect(a.historie!.some((h) => h.karte_cent === 5000)).toBe(true);
    // in beide Richtungen gleich
    expect(kassenVereinen([geraet2], [geraet1])[0]).toEqual(a);
  });
});

describe("Kassenabschluss: Bestand, fehlende Tage, Umsatzsteuer, Kassenbuch, Buchungen", () => {
  const abschluesse = [
    ka("a", "2026-05-02", { anfang_cent: 20000, zbon: "1204" }), // bar 226,00 − 100,00 Karte = 126,00
    ka("b", "2026-05-03", { zbon: "1205", bewegungen: [{ art: "transit", betrag_cent: 30000 }] }),
    ka("c", "2026-05-05", { zbon: "1207", gezaehlt_cent: 20000 }),
  ];
  it("Bargeldbestand mit Barbelegen, Geldtransit, Zählung; negativer Bestand wird erkannt", () => {
    const bar = beleg("b9", "2026-05-03", 2380, { zahlung: "bar" });
    const vorher = beleg("b0", "2026-04-20", 999, { zahlung: "bar" });
    const v = kassenVerlauf(abschluesse, [bar, vorher]);
    expect(v.ab).toBe("2026-05-02");
    expect(v.tage.map((t) => t.soll)).toEqual([32600, 32600 + 12600 - 2380 - 30000, 12820 + 12600]);
    expect(v.negativ).toEqual([]);
    expect(v.differenzen).toEqual([{ datum: "2026-05-05", cent: 20000 - 25420 }]);
    expect(v.tage[2]!.ende).toBe(20000);
    const minus = kassenVerlauf([ka("a", "2026-05-02", { karte_cent: 22600, bewegungen: [{ art: "entnahme", betrag_cent: 5000 }] })]);
    expect(minus.negativ).toEqual(["2026-05-02"]);
  });
  it("fehlende Tage mit Ruhetag (Montag) und nur bis gestern; Z-Bon-Lücken", () => {
    // 04.05.2026 ist Montag (Ruhetag), 06.05. fehlt, 07.05. ist heute
    expect(fehlendeTage(abschluesse, "2026-05-02", "2026-05-31", [1], "2026-05-07")).toEqual(["2026-05-06"]);
    expect(fehlendeTage(abschluesse, "2026-05-01", "2026-05-05", [])).toEqual(["2026-05-01", "2026-05-04"]);
    expect(tageText(["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-12"])).toBe("01.05.–03.05.2026, 12.05.2026");
    expect(zbonLuecken(abschluesse)).toEqual(["1206"]);
  });
  it("Umsatz je Steuersatz: Netto aus der Bruttosumme je Kalendermonat", () => {
    const u = kassenUmsatz([...abschluesse, ka("d", "2026-06-01", { umsatz: [{ satz: 19, brutto_cent: 100 }] })], "2026-04-01", "2026-06-30");
    // Mai: 3 × 119,00 = 357,00 → netto 300,00; Juni: 1,00 → 0,84
    expect(u.je[19]).toEqual({ brutto: 35800, netto: 30084, ust: 5716 });
    expect(u.je[7]).toEqual({ brutto: 32100, netto: 30000, ust: 2100 });
    expect(u.tage).toBe(4);
    expect(kassenUmsatz(abschluesse, "2026-05-01", "2026-05-31", true).je[0].brutto).toBe(67800);
  });
  it("bar kassierte Rechnungen: Bestand ja, Umsatz nein; gebucht Kasse an Forderungen", () => {
    const k = ka("r", "2026-05-02", { rechnungen_cent: 5000 });
    expect(kassenUmsatz([k], "2026-05-01", "2026-05-31").je[19].brutto).toBe(11900);
    expect(kassenVerlauf([k]).tage[0]!.soll).toBe(12600 + 5000);
    expect(kassenBuchungen([k], "SKR03").find((b) => b.gegenkonto === "1410")).toMatchObject({ konto: "1000", betrag_cent: 5000 });
    expect(kassenbuchDaten([k], [], "2026-05")!.eintraege.map((e) => e.einnahme)).toEqual(["126,00", "50,00"]);
  });
  it("Filialen: Bestand und fehlende Tage je Standort, Kostenstelle im Stapel", () => {
    const l = [ka("h", "2026-05-02", { anfang_cent: 1000 }), ka("f", "2026-05-02", { standort: "Filiale Süd", anfang_cent: 500 }), ka("h2", "2026-05-03")];
    expect(kassenVerlauf(l, [], "Filiale Süd").tage.map((t) => t.soll)).toEqual([500 + 12600]);
    expect(kassenVerlauf(l).tage.map((t) => t.soll)).toEqual([13600, 26200]);
    // am 03.05. fehlt die Filiale
    expect(fehlendeTage(l, "2026-05-02", "2026-05-03")).toEqual(["2026-05-03"]);
    const b = kassenBuchungen([l[1]!], "SKR03");
    expect(b[0]!.kost1).toBe("FilialeS");
    expect(kassenbuchDaten(l, [], "2026-05", new Map(), "Filiale Süd")!.zeitraum).toBe("Mai 2026 · Filiale Süd");
  });
  it("offene Ladenkasse: Bareinnahmen retrograd aus dem gezählten Bestand", () => {
    expect(retrogradeBareinnahmen({ anfang: 20000, gezaehlt: 45000, ausgaben: 2380, entnahmen: 5000, transit: 0, einlagen: 1000 })).toBe(31380);
  });
  it("Kassenbuch des Monats aus den Abschlüssen (Vorlage „kassenbuch“, Endbestand wie der Verlauf)", () => {
    const bar = beleg("b9", "2026-05-03", 2380, { zahlung: "bar" });
    const d = kassenbuchDaten(abschluesse, [bar], "2026-05")!;
    expect(d.zeitraum).toBe("Mai 2026");
    expect(d.anfang).toBe("200,00");
    expect(d.eintraege.map((e) => e.text)).toEqual(["Tageseinnahmen bar lt. Z-Bon Nr. 1204", "Tageseinnahmen bar lt. Z-Bon Nr. 1205", "Großmarkt: Waren und Material", "Geldtransit zur Bank", "Tageseinnahmen bar lt. Z-Bon Nr. 1207", "Kassendifferenz laut Zählung"]);
    const erg = vorlageFuer("kassenbuch")!.ergebnis!(d as unknown as Daten);
    expect(erg[0]![1].replace(/\u00a0/g, " ")).toBe("200,00 €");
    expect(kassenbuchDaten(abschluesse, [], "2026-07")).toBeNull();
  });
  it("Buchungen: Kasse an Erlöse je Satz, Karte Geldtransit an Kasse, Transit, Leistungsdatum", () => {
    const l = kassenBuchungen(abschluesse.slice(0, 2), "SKR03");
    expect(l.map((b) => [b.konto, b.gegenkonto, b.betrag_cent])).toEqual([["1000", "8400", 11900], ["1000", "8300", 10700], ["1360", "1000", 10000], ["1000", "8400", 11900], ["1000", "8300", 10700], ["1360", "1000", 10000], ["1360", "1000", 30000]]);
    expect(l[0]).toMatchObject({ leistungsdatum: "2026-05-02", steuerperiode: "2026-05-02", belegfeld1: "Z1204", ust_satz: 19 });
    expect(new Set(l.map((b) => b.guid)).size).toBe(l.length);
    const skr04 = kassenBuchungen([ka("e", "2026-05-02", { bewegungen: [{ art: "entnahme", betrag_cent: 100 }, { art: "einlage", betrag_cent: 50 }] })], "SKR04", { kleinunternehmer: true });
    expect(skr04.map((b) => [b.konto, b.gegenkonto])).toEqual([["1600", "4185"], ["1600", "4185"], ["1460", "1600"], ["2100", "1600"], ["1600", "2180"]]);
  });
});
