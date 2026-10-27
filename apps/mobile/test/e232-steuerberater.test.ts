/**
 * E-232 (Steuerberater 27.10.2026) im Steuerberater-Paket und in der EÜR der App:
 * - T-331: Kursdifferenz als eigene Zeile im Stapel (2150/2660 bzw. 6880/4840), auch bei Bilanz und bar,
 * - T-332: Überzahlung in der EÜR am Tag des Geldeingangs, Rückzahlung als Ausgabe, Verrechnung kein neuer Zufluss,
 * - T-333: Bilanz – Ausbuchung uneinbringlicher Forderungen (2406/2401), EÜR nur Liste, später Eingegangenes nur genannt,
 *   EU- und OSS-Rechnungen „bitte mit der Steuerberatung klären“.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Beleg } from "@amtlos/fachlogik";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, felderSetzen, guthabenVerrechnen, guthabenZurueckzahlen, uneinbringlichSetzen, zahlungVermerken, type Stand } from "../src/unterlagen/speicher";
import { einnahmenAusRechnungen, euerUebernahme, steuerpaket } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { T as TEXT } from "../src/texte";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const SB_BILANZ = { ...SB, kontenvorgaben: { gewinnermittlung: "bilanz" as const } };
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", rechtsform: "Einzelunternehmen", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000", versteuerung: "soll" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "ust.kleinunternehmer": false } };
const datei = (p: { zip: Uint8Array }, n: string) => strFromU8(unzipSync(p.zip)[n]!);
const Q = (q: string) => ({ von: `2026-${q}-01`, bis: `2026-${q}-${q === "04" || q === "09" ? "30" : "31"}`, name: `2026-${q}` });
const USD: Beleg = { id: "bu", datum: "2026-10-05", lieferant: "Cloud Tools Inc.", nummer: "INV-1001", kategorie: "buero", steuer: [{ satz: 19, brutto_cent: 11006 }], vorsteuer: true, zahlung: "bank", bezahlt: "2026-10-12", erstellt: "2026-10-06T08:00:00.000Z", geaendert: "2026-10-06T08:00:00.000Z", fremd: { waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 11900 }], ust: 1900, kurs: 1.0812, kurs_datum: "2026-10-01", gezahlt_eur_cent: 11180 } } as Beleg;

function re(s0: Stand, id: string, datum: string, o: { kunde?: string; anschrift?: string; positionen?: Record<string, string>[]; extra?: Record<string, unknown> } = {}): Stand {
  const [s1] = anlegen(s0, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: o.kunde ?? "Muster GmbH", kunde_anschrift: o.anschrift ?? "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: o.positionen ?? [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "100,00", satz: "19" }, { bezeichnung: "Speisen", menge: "1", einheit: "", preis: "100,00", satz: "7" }], ...(o.extra ?? {}) }, t(datum));
  return ausgeben(s2, id, t(datum));
}

describe("E-232 (T-331): Kursdifferenz im Stapel", () => {
  it("EÜR: Zeile 1610 an 2150 über 1,74 € zum Zahltag ohne BU; Hauptzeile unverändert; LIESMICH ohne „bitte buchen“", () => {
    const s = belegSetzen(BASIS, USD, t("2026-10-06"));
    const p = steuerpaket(s, Q("10"), SB, {}, "2026-11-01T10:00:00.000Z");
    const bl = datei(p, "Buchungsliste_2026-10.csv");
    expect(bl).toMatch(/05\.10\.2026;110,06;H;1610;4930;9;INV-1001;/);
    expect(bl).toMatch(/12\.10\.2026;1,74;H;1610;2150;;INV-1001;/);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("INV-1001: umgerechnet 110,06 €, gezahlt 111,80 € am 12.10.2026, Differenz 1,74 €");
    expect(l).toContain("„Aufwendungen aus Kursdifferenzen“ (2150)");
    expect(l).not.toContain("kein Konto für Kursdifferenzen");
    // EÜR der App unverändert: gezahlter Betrag abzüglich umgerechneter Vorsteuer
    expect(euerUebernahme(s, "2026").ausgaben.find((z) => z.kategorie === "Übrige unbeschränkt abziehbare Betriebsausgaben")!.betrag).toBe("94,23");
  });

  it("Zahltag im Folgemonat: Kursdifferenz im Stapel des Zahlungsmonats; Bilanz ebenso (Verbindlichkeit ausgeglichen), § 256a HGB genannt", () => {
    const b = { ...USD, bezahlt: "2026-11-03" };
    const s = belegSetzen({ ...BASIS, steuerberatung: SB_BILANZ }, b, t("2026-10-06"));
    expect(datei(steuerpaket(s, Q("10"), SB_BILANZ, {}, "2026-12-01T10:00:00.000Z"), "Buchungsliste_2026-10.csv")).not.toContain(";2150;");
    const nov = steuerpaket(s, Q("11"), SB_BILANZ, {}, "2026-12-01T10:00:00.000Z");
    expect(datei(nov, "Buchungsliste_2026-11.csv")).toMatch(/03\.11\.2026;1,74;H;1610;2150;;INV-1001;/);
    expect(datei(nov, "LIESMICH.txt")).toContain("(§ 256a HGB)");
  });

  it("bar und weniger gezahlt: gegen dasselbe Konto wie der Barbeleg (ohne Kassenführung Privateinlage) an 2660", () => {
    const s = belegSetzen(BASIS, { ...USD, zahlung: "bar", fremd: { ...USD.fremd!, gezahlt_eur_cent: 10900 } }, t("2026-10-06"));
    const bl = datei(steuerpaket(s, Q("10"), SB, {}, "2026-11-01T10:00:00.000Z"), "Buchungsliste_2026-10.csv");
    expect(bl).toMatch(/05\.10\.2026;110,06;H;1890;4930;9;INV-1001;/);
    expect(bl).toMatch(/12\.10\.2026;1,06;S;1890;2660;;INV-1001;/);
  });

  it("Hinweis am Beleg nennt die eigene Buchung", () => {
    expect(TEXT.e229_gezahlt_eur_hilfe).toContain("steht die Kursdifferenz im Steuerberater-Paket als eigene Buchung");
  });
});

describe("E-232 (T-332 a): Überzahlung in der EÜR am Tag des Geldeingangs", () => {
  /** r1 (226 €) am 02.04. mit 300 € bezahlt (74 € Guthaben), r2 (226 €) am 20.12.; Verrechnung 74 € am 15.01.2027 */
  function fall(ist = true): Stand {
    let s = re({ ...BASIS, betrieb: { ...BETRIEB, versteuerung: ist ? "ist" : "soll" } }, "r1", "2026-03-25");
    s = re(s, "r2", "2026-12-20");
    s = zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 30000 }, t("2026-04-02"), "z1");
    return s;
  }
  it("Überzahlung 2026 Einnahme, Verrechnung 2027 kein neuer Zufluss; Rückzahlung Ausgabe; Voranmeldung (Ist) weiter zum Tag der Verrechnung", () => {
    let s = fall();
    s = guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2027-01-15", 5000, t("2027-01-15"));
    s = guthabenZurueckzahlen(s, "r1", "z1-ue", "2027-01-20", 2400, t("2027-01-20"));
    const e26 = euerUebernahme(s, "2026");
    expect(e26.einnahmen.find((z) => (z.text ?? "").startsWith("Überzahlungen von Kunden"))).toMatchObject({ betrag: "74,00", kategorie: expect.stringContaining("Umsatzsteuerfreie, nicht umsatzsteuerbare") });
    const e27 = euerUebernahme(s, "2027");
    // keine Einnahme aus der Verrechnung, aber die Rückzahlung als Ausgabe
    expect(e27.einnahmen.filter((z) => /Umsätze aus Rechnungen|Vereinnahmte/.test(z.text ?? ""))).toEqual([]);
    expect(e27.ausgaben.find((z) => (z.text ?? "").startsWith("Rückzahlungen von Überzahlungen"))).toMatchObject({ betrag: "24,00", kategorie: "Übrige unbeschränkt abziehbare Betriebsausgaben" });
    // ohne EÜR-Sicht (Kleinunternehmer-Umsatz, Ist-Voranmeldung) zählt die Verrechnung weiter als Entgelt am Tag der Verrechnung
    expect(einnahmenAusRechnungen(s).some((x) => x.tag === "2027-01-15")).toBe(true);
    expect(einnahmenAusRechnungen(s, { euer: true }).some((x) => x.tag === "2027-01-15")).toBe(false);
    expect(umsaetzeFuer(s.unterlagen, "2027-01", s.betrieb, "ist")!.werte.umsatz_19).not.toMatch(/^(0,00)?$/);
    // Summe über beide Jahre: genau das Geld, das kam (226 + 74) abzüglich Rückzahlung – nichts doppelt
    const geld = (j: string) => euerUebernahme(s, j).einnahmen.reduce((a, z) => a + Number((z.betrag ?? "0").replace(/\./g, "").replace(",", ".")), 0) - euerUebernahme(s, j).ausgaben.filter((z) => (z.text ?? "").startsWith("Rückzahlungen")).reduce((a, z) => a + Number((z.betrag ?? "0").replace(",", ".")), 0);
    expect(Math.round((geld("2026") + geld("2027")) * 100)).toBe(30000 - 2400);
  });

  it("LIESMICH: EÜR am Tag der Überzahlung, Ist-Hinweis zum Stapel; Vorauszahlungs-Hinweis mit Ist-Satz", () => {
    let s = fall();
    s = guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-12-21", 5000, t("2026-12-21"));
    const l = datei(steuerpaket(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, SB, {}, "2027-01-02T10:00:00.000Z"), "LIESMICH.txt");
    expect(l).toContain("EÜR (§ 11 EStG): Einnahme ist der Geldeingang am Tag der Überzahlung");
    expect(l).toContain("dann zählt bei Ist-Versteuerung schon der Tag des Geldeingangs");
    expect(TEXT.e229_ueberzahlung("31,00 €", "119,00 €")).toContain("bei Ist-Versteuerung zählt dann schon der Tag des Geldeingangs für die Umsatzsteuer");
  });
});

describe("E-232 (T-333): Forderung uneinbringlich im Stapel", () => {
  const bilanz = (s: Stand): Stand => ({ ...s, steuerberatung: SB_BILANZ });
  it("Bilanz: Ausbuchung 19 % und 7 % brutto gegen Forderungen zum Tag (2406/2401), LIESMICH ohne „FEHLEN“", () => {
    let s = bilanz(re(BASIS, "r1", "2026-02-10"));
    s = uneinbringlichSetzen(s, "r1", { datum: "2026-09-15", grund: "insolvenz" }, t("2026-09-20"));
    const p = steuerpaket(s, Q("09"), SB_BILANZ, {}, "2026-10-01T10:00:00.000Z");
    const bl = datei(p, "Buchungsliste_2026-09.csv");
    expect(bl).toMatch(/15\.09\.2026;119,00;H;1410;2406;;/);
    expect(bl).toMatch(/15\.09\.2026;107,00;H;1410;2401;;/);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Im Stapel ausgebucht zum Tag der Uneinbringlichkeit");
    expect(l).not.toContain("FEHLEN die Ausbuchung");
    // SKR04
    expect(datei(steuerpaket({ ...s, steuerberatung: { ...SB_BILANZ, kontenrahmen: "SKR04" } }, Q("09"), { ...SB_BILANZ, kontenrahmen: "SKR04" }, {}, "2026-10-01T10:00:00.000Z"), "Buchungsliste_2026-09.csv")).toMatch(/15\.09\.2026;119,00;H;1210;6936;;/);
  });

  it("Bilanz nach Teilzahlung: nur der offene Rest; später Eingegangenes wird nicht gebucht, nur genannt", () => {
    let s = bilanz(re(BASIS, "r1", "2026-02-10"));
    s = zahlungVermerken(s, "r1", { datum: "2026-03-05", betrag_cent: 11300 });
    s = uneinbringlichSetzen(s, "r1", { datum: "2026-09-15", grund: "insolvenz" }, t("2026-09-20"));
    s = zahlungVermerken(s, "r1", { datum: "2026-10-20", betrag_cent: 5000 });
    expect(datei(steuerpaket(s, Q("09"), SB_BILANZ, {}, "2026-11-01T10:00:00.000Z"), "Buchungsliste_2026-09.csv")).toMatch(/15\.09\.2026;59,50;H;1410;2406;;[\s\S]*15\.09\.2026;53,50;H;1410;2401;;|15\.09\.2026;53,50;H;1410;2401;;[\s\S]*15\.09\.2026;59,50;H;1410;2406;;/);
    const okt = steuerpaket(s, Q("10"), SB_BILANZ, {}, "2026-11-01T10:00:00.000Z");
    expect(datei(okt, "Buchungsliste_2026-10.csv")).not.toMatch(/;240[16];/);
    expect(datei(okt, "LIESMICH.txt")).toContain("Nach der Uneinbringlichkeit noch eingegangen (RE");
    expect(datei(okt, "LIESMICH.txt")).toContain("Dafür bucht der Stapel nichts zurück");
  });

  it("EÜR (Soll): keine Ausbuchung im Stapel, nur die Liste", () => {
    let s = re(BASIS, "r1", "2026-02-10");
    s = uneinbringlichSetzen(s, "r1", { datum: "2026-09-15", grund: "insolvenz" }, t("2026-09-20"));
    const p = steuerpaket(s, Q("09"), SB, {}, "2026-10-01T10:00:00.000Z");
    expect(datei(p, "Buchungsliste_2026-09.csv")).not.toMatch(/;240[16];/);
    expect(datei(p, "LIESMICH.txt")).toContain("Einnahmen-Überschuss-Rechnung: keine Ausbuchung");
  });

  it("EU-Leistung (0 %, ZM) bzw. OSS: „bitte mit der Steuerberatung klären“ – in LIESMICH und am Vermerk; 0 % ohne Konto nicht im Stapel", () => {
    let s = bilanz(re(BASIS, "r1", "2026-02-10", { kunde: "Studio Nord BV", anschrift: "Dam 1\n1012 Amsterdam\nNiederlande", positionen: [{ bezeichnung: "Beratung", menge: "1", einheit: "", preis: "500,00", satz: "0" }], extra: { kunde_ust_idnr: "NL123456789B01", hinweise: ["reverse_charge"] } }));
    s = uneinbringlichSetzen(s, "r1", { datum: "2026-09-15", grund: "insolvenz" }, t("2026-09-20"));
    const p = steuerpaket(s, Q("09"), SB_BILANZ, {}, "2026-10-01T10:00:00.000Z");
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("RE");
    expect(l).toMatch(/Zusammenfassende Meldung\): .*bitte mit der Steuerberatung klären|Zusammenfassende Meldung.*bitte mit der Steuerberatung klären/);
    expect(l).toContain("Ohne Konto (andere Steuersätze, z. B. 0 %), deshalb NICHT im Stapel");
    expect(datei(p, "Buchungsliste_2026-09.csv")).not.toMatch(/;240[16];/);
    expect(TEXT.e232_uneinbringlich_eu_oss("oss")).toContain("OSS-Erklärung");
    expect(TEXT.e232_uneinbringlich_eu_oss("zm")).toContain("bitte mit der Steuerberatung klären".replace("bitte", "Bitte"));
    expect(lies("seiten/Abschluss.tsx")).toContain("TEXT.e232_uneinbringlich_eu_oss(euOss)");
  });
});
