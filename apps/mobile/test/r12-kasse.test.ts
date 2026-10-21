/**
 * R12: Kassenabschluss und Skonto in der App – Stand (Migration 1 → 2), Sicherung und Synchronisation, Voranmeldung
 * (Kasse, Skonto Soll/Ist mit 19 % und 7 %), EÜR, DATEV-Stapel, Kontrollmappe „Kassennachschau“.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { type Beleg, type KassenInhalt } from "@amtlos/fachlogik";
import { syncZusammenfuehren } from "../src/konto/sync";
import { sicherungErstellen, sicherungLesenMitDateien, fehlendeDateien } from "../src/unterlagen/sicherung";
import { LEERER_STAND, MIGRATIONEN, STAND_VERSION, anlegen, aufbewahrungspflichtig, ausgeben, bezahltSetzen, belegSetzen, felderSetzen, kasseKorrigieren, kasseSpeichern, offenerBetrag, standAus, zahlungVermerken, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { euerUebernahme, kassenHinweisMit, steuerpaket } from "../src/unterlagen/steuerpaket";
import { kasseFuerUst, kasseSichtbar, kassenMonat } from "../src/unterlagen/kasse";
import { perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { kassenMappe } from "../src/unterlagen/kontrollmappe";
import { offenBrutto, offeneSumme } from "../src/unterlagen/ablage";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "kasse.elektronisch": true, "ust.kleinunternehmer": false } };
const tag = (datum: string, o: Partial<KassenInhalt> = {}): KassenInhalt => ({ datum, zbon: null, umsatz: [{ satz: 19, brutto_cent: 11900 }, { satz: 7, brutto_cent: 10700 }], karte_cent: 10000, sonstige_cent: 0, bewegungen: [], ...o });
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const datei = (p: { zip: Uint8Array }, name: string) => strFromU8(unzipSync(p.zip)[name]!).replace(/^\uFEFF/, "");

function rechnung(s: Stand, id: string, datum: string, positionen: { preis: string; satz: string }[], o: Record<string, unknown> = {}): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: positionen.map((p) => ({ bezeichnung: "Catering", menge: "1", einheit: "", preis: p.preis, satz: p.satz })), ...o }, t(datum));
  return ausgeben(s2, id, t(datum));
}

/** Café mit Kassenabschlüssen 01.–03.04.2026 (montags Ruhetag nicht gesetzt) */
function mitKasse(): Stand {
  let s = BASIS;
  for (const [i, d] of ["2026-04-01", "2026-04-02", "2026-04-03"].entries()) [s] = kasseSpeichern(s, tag(d, { zbon: String(100 + i), ...(i === 0 ? { anfang_cent: 20000 } : {}) }), t(d, 20), `k${i}`);
  return s;
}

describe("Stand: Migration 1 → 2, Lesen, Aufbewahrung", () => {
  it("hebt Version 1 auf 2 mit leerer Kasse; Kasse aus Version 2 bleibt erhalten", () => {
    // R12 Personal: inzwischen Version 3 (Betriebsstätten, festgeschriebene Nachweise); Phase 2.3: Version 5 (Partner-ID); Vorprüfung Recht: Version 6 (Zustimmung); StB-Prüfung: Version 7 (Kontenvorgaben)
    expect(STAND_VERSION).toBe(7);
    expect(MIGRATIONEN[1]!({ version: 1, belege: [] })).toMatchObject({ kasse: [] });
    const alt = standAus(JSON.stringify({ version: 1, betrieb: { name: "Alt" } }));
    expect(alt.version).toBe(7);
    expect(alt.kasse).toEqual([]);
    const s = mitKasse();
    const wieder = standAus(JSON.stringify(s));
    expect(wieder.kasse.map((k) => k.id)).toEqual(["k0", "k1", "k2"]);
    expect(wieder.kasse[0]!.festgeschrieben).toBeTruthy();
    // unlesbare Abschlüsse gehen nicht verloren (fremd)
    const kaputt = standAus(JSON.stringify({ ...s, kasse: [...s.kasse, { id: "x", datum: "kaputt" }] }));
    expect(kaputt.fremd.kasse).toEqual([{ id: "x", datum: "kaputt" }]);
    expect(aufbewahrungspflichtig(kaputt).map((x) => x.id)).toEqual(expect.arrayContaining(["k0", "x"]));
  });
  it("Korrektur nur mit Grund; die alte Fassung bleibt", () => {
    const s = mitKasse();
    expect(kasseKorrigieren(s, "k1", tag("2026-04-02", { karte_cent: 5000 }), "  ")).toBe(s);
    const k = kasseKorrigieren(s, "k1", tag("2026-04-02", { karte_cent: 5000, zbon: "101" }), "Terminal-Abrechnung", t("2026-04-03")).kasse.find((x) => x.id === "k1")!;
    expect(k.karte_cent).toBe(5000);
    expect(k.historie).toHaveLength(1);
  });
  it("Kasse anbieten bei elektronischer Kasse, Laden oder vorhandenen Abschlüssen", () => {
    expect(kasseSichtbar({ profil: {}, kasse: [] })).toBe(false);
    expect(kasseSichtbar({ profil: { "vertrieb.kanaele": ["ladengeschaeft"] }, kasse: [] })).toBe(true);
    expect(kasseSichtbar({ profil: {}, kasse: mitKasse().kasse })).toBe(true);
  });
});

describe("Sicherung und Synchronisation", () => {
  it("Sicherung trägt Kassenabschlüsse und Z-Bon-Fotos; Zusammenführen verliert nichts", () => {
    const [s] = kasseSpeichern(mitKasse(), tag("2026-04-04", { datei: "zbon1234.jpg" }), t("2026-04-04", 20), "k3");
    expect(fehlendeDateien(s, {})).toEqual(["zbon1234.jpg"]);
    const zufall = (n: number) => new Uint8Array(n).fill(3);
    const text = sicherungErstellen(s, "sonnenschein-2026", zufall, t("2026-04-05"), 1000, { "zbon1234.jpg": "AAEC" });
    const r = sicherungLesenMitDateien(text, "sonnenschein-2026");
    expect(r.stand.kasse).toHaveLength(4);
    // Gerät hat inzwischen korrigiert, Sicherung kennt die alte Fassung
    const geraet = kasseKorrigieren(BASIS.kasse.length ? BASIS : s, "k1", tag("2026-04-02", { karte_cent: 1 }), "Tippfehler", t("2026-04-06"));
    const z = zusammenfuehren({ ...geraet, kasse: geraet.kasse.filter((k) => k.id !== "k3") }, r.stand);
    expect(z.stand.kasse).toHaveLength(4);
    expect(z.stand.kasse.find((k) => k.id === "k1")!.karte_cent).toBe(1);
  });
  it("Sync: Abschlüsse beider Geräte, Korrekturen in beiden Richtungen gleich, nie gelöscht", () => {
    const s = mitKasse();
    const [a] = kasseSpeichern(s, tag("2026-04-04"), t("2026-04-04", 20), "ka");
    const b = kasseKorrigieren(s, "k0", tag("2026-04-01", { karte_cent: 9000, zbon: "100", anfang_cent: 20000 }), "Karte laut Abrechnung", t("2026-04-05"));
    const ab = syncZusammenfuehren(a, b).stand;
    const ba = syncZusammenfuehren(b, a).stand;
    expect(ab.kasse.map((k) => k.id)).toEqual(["k0", "k1", "k2", "ka"]);
    expect(ab.kasse).toEqual(ba.kasse);
    expect(ab.kasse[0]!.karte_cent).toBe(9000);
    // ein Gerät ohne Abschlüsse löscht nichts
    expect(syncZusammenfuehren(ab, { ...BASIS, kasse: [] }).stand.kasse).toHaveLength(4);
  });
});

describe("Voranmeldung mit Kasse", () => {
  it("übernimmt Kassenumsätze nach Tag (Netto aus Brutto je Monat), nennt fehlende Tage", () => {
    const s = mitKasse();
    expect(perioden(s.unterlagen, s.betrieb, "soll", [], s.kasse)).toContain("2026-04");
    // nur 01.–03.04. erfasst, Stichtag 05.04.: der 04.04. fehlt
    const r = umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "soll", [], false, kasseFuerUst(s, "2026-04-05"))!;
    expect(r.werte.umsatz_19).toBe("300,00");
    expect(r.werte.umsatz_7).toBe("300,00");
    expect(r.kasseTage).toBe(3);
    expect(r.kasseFehlend).toEqual(["2026-04-04"]);
    expect(kassenHinweisMit("kasse", "ust", r.kasseFehlend)!.text).toContain("04.04.2026");
    // mit Ruhetag Samstag (04.04.2026) vollständig – kein Kassenhinweis mehr
    const voll = umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "soll", [], false, { ...kasseFuerUst(s, "2026-04-05"), ruhetage: [6] })!;
    expect(voll.kasseFehlend).toEqual([]);
    expect(kassenHinweisMit("kasse", "ust", voll.kasseFehlend)).toBeNull();
    // ohne Abschlüsse bleibt der bisherige Hinweis
    expect(kassenHinweisMit("kasse", "ust", null)!.warnung).toBe(true);
    // Kleinunternehmer übernehmen keine Kassenumsätze
    expect(umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "soll", [], true, kasseFuerUst(s))!.werte.umsatz_19).toBeUndefined();
  });
  it("Monatsübersicht: Bestand, Warnung bei negativem Bestand", () => {
    const s = mitKasse();
    const m = kassenMonat(s, "2026-04", "2026-04-04");
    expect(m.brutto).toBe(3 * 22600);
    expect(m.ende).toBe(20000 + 3 * 12600);
    expect(m.negativ).toEqual([]);
    const [minus] = kasseSpeichern(s, tag("2026-04-04", { bewegungen: [{ art: "transit", betrag_cent: 100000 }] }), t("2026-04-04", 20), "k9");
    expect(kassenMonat(minus, "2026-04", "2026-04-05").negativ).toEqual(["2026-04-04"]);
  });
});

describe("Skonto beim Zahlungseingang (§ 17 UStG)", () => {
  // 100,00 € zu 19 % und 100,00 € zu 7 %: brutto 226,00 €, 2 % Skonto = 4,52 €
  const re = () => rechnung(BASIS, "r1", "2026-03-25", [{ preis: "100,00", satz: "19" }, { preis: "100,00", satz: "7" }], { skonto: true, skonto_prozent: "2", skonto_tage: "10" });
  it("Soll: Leistung im März voll, Minderung im April je Steuersatz", () => {
    const s = zahlungVermerken(re(), "r1", { datum: "2026-04-02", betrag_cent: 22148, minderung_cent: 452, art: "skonto" });
    expect(s.unterlagen[0]!.bezahlt).toBe("2026-04-02");
    expect(offenerBetrag(s, s.unterlagen[0]!)).toBe(0);
    const maerz = umsaetzeFuer(s.unterlagen, "2026-03", s.betrieb, "soll")!;
    expect([maerz.werte.umsatz_19, maerz.werte.umsatz_7]).toEqual(["100,00", "100,00"]);
    const april = umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "soll")!;
    expect([april.werte.umsatz_19, april.werte.umsatz_7]).toEqual(["-2,00", "-2,00"]);
    expect(april.minderungen).toBe(1);
  });
  it("Ist: nur der erhaltene Betrag im Zeitraum der Zahlung; Teilzahlung bleibt offen", () => {
    let s = re();
    s = zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 11300 });
    expect(s.unterlagen[0]!.bezahlt).toBeUndefined();
    expect(offenerBetrag(s, s.unterlagen[0]!)).toBe(11300);
    expect(offenBrutto(s.unterlagen[0]!, s.betrieb)).toBe(11300);
    expect(offeneSumme(s.unterlagen, s.betrieb).cent).toBe(11300);
    s = zahlungVermerken(s, "r1", { datum: "2026-05-04", betrag_cent: 10848, minderung_cent: 452, art: "skonto" });
    expect(s.unterlagen[0]!.bezahlt).toBe("2026-05-04");
    const april = umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "ist")!;
    const mai = umsaetzeFuer(s.unterlagen, "2026-05", s.betrieb, "ist")!;
    // April: Hälfte erhalten (je Satz 50,00 netto), Mai: Rest minus Skonto (50,00 − 2,00)
    expect([april.werte.umsatz_19, april.werte.umsatz_7]).toEqual(["50,00", "50,00"]);
    expect([mai.werte.umsatz_19, mai.werte.umsatz_7]).toEqual(["48,00", "48,00"]);
    // „als bezahlt markieren“ ersetzt die Zahlungen
    expect(bezahltSetzen(s, "r1", "2026-05-05").unterlagen[0]!.zahlungen).toBeUndefined();
  });
  it("EÜR: Zufluss ohne Skonto; DATEV: gewährte Skonti im Zeitraum der Zahlung", () => {
    const s = zahlungVermerken(re(), "r1", { datum: "2026-04-02", betrag_cent: 22148, minderung_cent: 452, art: "skonto" });
    const e = euerUebernahme(s, "2026");
    const zeile = (k: string) => e.einnahmen.filter((x) => x.kategorie === k).reduce((a, x) => a + Number(String(x.betrag).replace(/\./g, "").replace(",", ".")), 0);
    expect(zeile("Umsatzsteuerpflichtige Betriebseinnahmen")).toBeCloseTo(196);
    expect(zeile("Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben")).toBeCloseTo(25.48);
    const p = steuerpaket(s, { von: "2026-04-01", bis: "2026-04-30", name: "2026-04" }, SB, {}, "2026-05-02T08:00:00");
    const liste = datei(p, "Buchungsliste_2026-04.csv");
    expect(liste).toContain("02.04.2026;2,38;S;8736;1410");
    expect(liste).toContain("02.04.2026;2,14;S;8731;1410");
    // Ist (EÜR): Erlös je Zahlung (erhalten + Skonto) und Skonto zum Zahltag
    const ist = steuerpaket({ ...s, betrieb: { ...s.betrieb, versteuerung: "ist" } }, { von: "2026-04-01", bis: "2026-04-30", name: "2026-04" }, SB, {}, "2026-05-02T08:00:00");
    const l2 = datei(ist, "Buchungsliste_2026-04.csv");
    expect(l2).toContain("02.04.2026;119,00;S;1410;8400");
    expect(l2).toContain("02.04.2026;2,38;S;8736;1410");
  });
  it("XRechnung der Rechnung trägt die Skonto-Zeile (BT-20)", () => {
    const p = steuerpaket(re(), { von: "2026-03-01", bis: "2026-03-31", name: "2026-03" }, SB, {}, "2026-04-02T08:00:00");
    const xml = datei(p, "E-Rechnungen/2026-001.xml");
    expect(xml).toContain("#SKONTO#TAGE=10#PROZENT=2.00#");
  });
});

describe("EÜR, DATEV-Stapel und Kontrollmappe mit Kasse", () => {
  const bar = (id: string, datum: string, brutto: number, o: Partial<Beleg> = {}): Beleg => ({ id, datum, lieferant: "Frischemarkt", nummer: `B-${id}`, kategorie: "waren", steuer: [{ satz: 7, brutto_cent: brutto }], vorsteuer: true, zahlung: "bar", bezahlt: datum, notiz: null, datei: null, quelle: "hand", erstellt: `${datum}T08:00:00Z`, geaendert: `${datum}T08:00:00Z`, ...o });
  it("EÜR: Kasseneinnahmen netto und Umsatzsteuer als eigene Zeilen", () => {
    const e = euerUebernahme(mitKasse(), "2026");
    expect(e.kassentage).toBe(3);
    expect(e.einnahmen.find((x) => x.text?.startsWith("Kasseneinnahmen"))!.betrag).toBe("600,00");
    expect(e.einnahmen.find((x) => x.text === "Umsatzsteuer auf Kasseneinnahmen")!.betrag).toBe("78,00");
  });
  it("Stapel: Tageseinnahmen, Karte über Geldtransit, Barbelege ab dem ersten Abschluss gegen Kasse", () => {
    let s = mitKasse();
    s = belegSetzen(s, bar("b1", "2026-04-02", 1070), t("2026-04-02"));
    s = belegSetzen(s, bar("b0", "2026-03-30", 535), t("2026-03-30"));
    const p = steuerpaket(s, { von: "2026-03-01", bis: "2026-04-30", name: "2026-Q" }, SB, {}, "2026-05-02T08:00:00");
    const liste = datei(p, "Buchungsliste_2026-Q.csv");
    // R12 GoBD: Karte direkt Geldtransit an Erlöse (im Verhältnis 119 : 107), nur Bargeld über die Kasse
    expect(liste).toContain("01.04.2026;52,65;S;1360;8400");
    expect(liste).toContain("01.04.2026;47,35;S;1360;8300");
    expect(liste).toContain("01.04.2026;66,35;S;1000;8400");
    expect(liste).toContain("01.04.2026;59,65;S;1000;8300");
    expect(liste).not.toContain(";S;1360;1000;");
    // StB-Prüfung (A-1): Kasse bzw. Privateinlage in Feld 7 im Haben, Sachkonto als Gegenkonto
    expect(liste).toMatch(/02\.04\.2026;10,70;H;1000;3300/);
    // vor dem ersten Abschluss: aus eigener Tasche (Privateinlage), nicht Geldtransit
    expect(liste).toMatch(/30\.03\.2026;5,35;H;1890;3300/);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Kassenumsätze aus 3 Tagesabschlüssen");
    expect(l).not.toContain("Kassenumsätze fehlen");
    expect(l).toContain("Geldtransit (1360)");
    expect(datei(p, "Kassenabschluesse_2026-Q.csv")).toContain("01.04.2026;;100;119,00;107,00");
    expect(l).toContain("mit dem Saldovortrag des Kassenkontos (1000) abgleichen");
    expect(l).toContain("außer privat bezahlten Belegen, Bewegungen der Kasse und Sachentnahmen");
  });
  it("Kontrollmappe „Kassennachschau“: Kassenbuch je Monat aus den Abschlüssen, Kassenmeldung, falls vorhanden", () => {
    let s = mitKasse();
    expect(kassenMappe(s, "2026-05-01").map((e) => e.titel)).toEqual(["Tagesabschlüsse April 2026 und Mai 2026 (Z-Nummer, TSE, Korrekturen)", "Kassenbuch April 2026 (aus den Tagesabschlüssen)"]);
    const [s1] = anlegen(s, "kassenmeldung", t("2026-04-10"), "km");
    s = s1;
    const m = kassenMappe(s, "2026-05-01");
    expect(m.map((e) => e.vorlage)).toEqual(["tagesabschluesse", "kassenbuch", "kassenmeldung"]);
    expect(m[1]!.daten).toMatchObject({ zeitraum: "April 2026", anfang: "200,00" });
  });
});
