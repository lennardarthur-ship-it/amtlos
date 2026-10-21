/**
 * Runde 11 (simulierte Steuerberatung und Szenarien Gebäudereinigung, Kosmetik, Tischlerei): EÜR für Kleinunternehmer
 * mit „davon“, gemischter Kleinunternehmer-Zeitraum, Vorsteuer aus Gutschriften bei Ist, Ersatzrechnung über
 * `ersetzt`, Buchungsstapel bei Ist-Versteuerung und unbezahlten Abschlägen, § 13b ohne Vorsteuerabzug, Barbelege,
 * Gutscheine, Kleinunternehmer bis zu einem Wechseldatum.
 */
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import type { Beleg } from "@amtlos/fachlogik";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, kopieren, stornieren, type Stand } from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket } from "../src/unterlagen/steuerpaket";
import { nurSteuerfreieUmsaetze, perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", iban: "DE89370400440532013000" };
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const JAHR = { von: "2026-01-01", bis: "2026-12-31", name: "2026" };

interface Opt { bezahlt?: string; ku?: boolean; gutschrift?: boolean; kunde?: string; anschrift?: string; satz?: string; abschlag?: boolean; leistung?: string; bezeichnung?: string; befreiung?: string }
function rechnung(s: Stand, id: string, datum: string, preis: string, o: Opt = {}): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  let s2 = felderSetzen(
    s1,
    id,
    {
      datum,
      ...(o.leistung ? { leistung_gleich: false, leistung: o.leistung } : {}),
      kunde_name: o.kunde ?? "Kunde GmbH",
      kunde_anschrift: o.anschrift ?? "Hafenstraße 3\n20457 Hamburg",
      kunde_email: "re@kunde.example",
      kleinunternehmer: Boolean(o.ku),
      abschlag: Boolean(o.abschlag),
      hinweise: o.gutschrift ? ["gutschrift"] : [],
      ...(o.befreiung ? { befreiung: o.befreiung } : {}),
      positionen: [{ bezeichnung: o.bezeichnung ?? "Leistung", menge: "1", einheit: "", preis, satz: o.satz ?? "19" }],
    },
    t(datum),
  );
  s2 = ausgeben(s2, id, t(datum));
  return o.bezahlt ? bezahltSetzen(s2, id, o.bezahlt) : s2;
}
const stand = (o: Partial<Stand> = {}): Stand => ({ ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, ...o });
const datei = (p: ReturnType<typeof steuerpaket>, name: string) => strFromU8(unzipSync(p.zip)[name]!);
const beleg = (o: Partial<Beleg>): Beleg => ({ id: "b1", datum: "2026-02-10", lieferant: "CloudOffice Ltd", nummer: "X-1", kategorie: "buero", steuer: [{ satz: 0, brutto_cent: 40800 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, quelle: "hand", erstellt: "2026-02-10T09:00:00Z", geaendert: "2026-02-10T09:00:00Z", ...o }) as Beleg;

describe("R11 Steuer: EÜR und Voranmeldung", () => {
  it("EÜR Kleinunternehmer: Gesamtbetrag in der KU-Zeile, nicht steuerbare Umsätze nur als „davon“ im Text", () => {
    let s = stand({ profil: { "ust.kleinunternehmer": true } });
    s = rechnung(s, "r1", "2026-03-10", "1.000,00", { bezahlt: "2026-03-20", ku: true });
    s = rechnung(s, "r2", "2026-04-10", "400,00", { bezahlt: "2026-04-20", ku: true, kunde: "Studio Zürich", anschrift: "Bahnhofstr. 1\n8001 Zürich\nSchweiz" });
    const e = euerUebernahme(s, "2026");
    expect(e.einnahmen).toHaveLength(1);
    expect(e.einnahmen[0]).toMatchObject({ kategorie: "Umsatzsteuerlicher Kleinunternehmer", betrag: "1.400,00" });
    expect(e.einnahmen[0]!.text).toContain("davon nicht steuerbar (Leistungen an Unternehmen im Ausland): 400,00 €");
  });

  it("gemischter Kleinunternehmer-Zeitraum: Rechnung mit USt wird übernommen, Vorsteuer erst ab dieser Rechnung", () => {
    let s = stand({ profil: { "ust.kleinunternehmer": true } });
    s = rechnung(s, "r1", "2026-10-05", "1.000,00", { ku: true });
    s = rechnung(s, "r2", "2026-11-20", "2.000,00");
    const belege = [beleg({ id: "b1", datum: "2026-10-10", steuer: [{ satz: 19, brutto_cent: 11900 }] }), beleg({ id: "b2", datum: "2026-12-01", steuer: [{ satz: 19, brutto_cent: 23800 }] })];
    const r = umsaetzeFuer(s.unterlagen, "2026-Q4", s.betrieb, "soll", belege, true)!;
    expect(r.kleinunternehmer).toBe(false);
    expect(r.kuGemischt).toBe(true);
    expect(r.werte.umsatz_19).toBe("2.000,00");
    expect(r.werte.vorsteuer).toBe("38,00");
  });

  it("Vorsteuer aus Gutschriften auch bei Ist ab Leistung und Gutschrift, ohne Zahlungsvermerk", () => {
    let s = stand();
    s = rechnung(s, "g1", "2026-02-10", "100,00", { gutschrift: true, kunde: "Fotograf" });
    expect(umsaetzeFuer(s.unterlagen, "2026-Q1", s.betrieb, "ist", [])!.werte.vorsteuer).toBe("19,00");
    expect(perioden(s.unterlagen, s.betrieb, "ist")).toContain("2026-Q1");
  });

  it("Ersatzrechnung: Kopie aus dem Storno merkt sich das Original; ohne Verknüpfung kein Raten bei anderem Betrag", () => {
    let s = stand();
    s = rechnung(s, "r1", "2026-03-20", "1.000,00");
    const [s2, st] = stornieren(s, "r1", t("2026-04-05"), "st1");
    s = ausgeben(s2, st!.id, t("2026-04-05"));
    const [s3, kopie] = kopieren(s, "st1", t("2026-04-05"), "r2");
    expect(kopie!.ersetzt).toBe("r1");
    // Kopie enthält die Daten des Originals (positive Preise), nicht die des Stornos
    expect((kopie!.daten.positionen as { preis: string }[])[0]!.preis).toBe("1.000,00");
    s = felderSetzen(s3, "r2", { positionen: [{ bezeichnung: "Leistung", menge: "1", einheit: "", preis: "800,00", satz: "19" }], leistung_gleich: false, leistung: "20.03.2026" }, t("2026-04-05"));
    s = ausgeben(s, "r2", t("2026-04-05"));
    // geändertes Entgelt: Ersatzrechnung im Zeitraum des Stornos – dort wirkt nur die Differenz
    expect(umsaetzeFuer(s.unterlagen, "2026-Q2", s.betrieb, "soll")!.werte.umsatz_19).toBe("-200,00");
    // ohne Verknüpfung (alte Daten) und mit anderem Betrag: keine Zuordnung zum Storno
    const alt = { ...s, unterlagen: s.unterlagen.map((u) => (u.id === "r2" ? (({ ersetzt: _w, ...rest }) => rest)(u) : u)) };
    expect(umsaetzeFuer(alt.unterlagen, "2026-Q1", alt.betrieb, "soll")!.werte.umsatz_19).toBe("1.800,00");
  });

  it("E-Rechnung einlesen: Vorsteuer aus, wenn der Betrieb nur steuerfreie Umsätze ohne Vorsteuerabzug hat", () => {
    let s = stand();
    s = rechnung(s, "r1", "2026-03-10", "60,00", { satz: "0", befreiung: "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG" });
    expect(nurSteuerfreieUmsaetze(s.unterlagen, s.betrieb)).toBe(true);
    s = rechnung(s, "r2", "2026-03-11", "60,00");
    expect(nurSteuerfreieUmsaetze(s.unterlagen, s.betrieb)).toBe(false);
  });

  it("Kleinunternehmer bis zu einem Wechseldatum: keine Voranmeldungszeiträume aus der KU-Zeit", () => {
    let s = stand({ betrieb: { ...BETRIEB, ku_bis: "2025-12-31" } });
    s = rechnung(s, "r1", "2026-01-10", "100,00", { leistung: "15.12.2025" });
    s = rechnung(s, "r2", "2026-02-10", "100,00");
    const p = perioden(s.unterlagen, s.betrieb, "soll");
    expect(p).not.toContain("2025-Q4");
    expect(p).not.toContain("2025-12");
    expect(p).toContain("2026-Q1");
  });
});

describe("R11 Steuer: Steuerberater-Paket", () => {
  it("Ist-Versteuerung (EÜR): Erlös erst mit Zahlungseingang zum Zahltag, Unbezahltes nur in der Liste", () => {
    let s = stand({ betrieb: { ...BETRIEB, versteuerung: "ist" } });
    s = rechnung(s, "r1", "2026-03-10", "100,00", { bezahlt: "2026-04-02" });
    s = rechnung(s, "r2", "2026-03-15", "200,00");
    const q1 = steuerpaket(s, { von: "2026-01-01", bis: "2026-03-31", name: "2026-Q1" }, SB, {}, "2026-04-10T08:00:00");
    const l1 = datei(q1, "Buchungsliste_2026-Q1.csv");
    expect(l1).not.toContain("RE 2026-");
    expect(datei(q1, "LIESMICH.txt")).toContain("Ist-Versteuerung: Rechnungen stehen erst mit dem Zahlungseingang im Buchungsstapel");
    const q2 = steuerpaket(s, { von: "2026-04-01", bis: "2026-06-30", name: "2026-Q2" }, SB, {}, "2026-07-10T08:00:00");
    expect(datei(q2, "Buchungsliste_2026-Q2.csv")).toMatch(/02\.04\.2026;119,00;S;1410;8400;/);
    expect(datei(q2, "EXTF_Buchungsstapel_2026-Q2.csv")).toContain("02042026");
  });

  it("Soll: unbezahlte Abschlagsrechnung nicht im Stapel, bezahlte mit dem Zahltag", () => {
    let s = stand();
    s = rechnung(s, "a1", "2026-06-26", "1.000,00", { abschlag: true, leistung: "September 2026" });
    s = rechnung(s, "a2", "2026-06-27", "500,00", { abschlag: true, leistung: "September 2026", bezahlt: "2026-07-03" });
    const p = steuerpaket(s, JAHR, SB, {}, "2027-01-10T08:00:00");
    const l = datei(p, "Buchungsliste_2026.csv");
    expect(l).not.toContain("1.190,00");
    expect(l).toMatch(/03\.07\.2026;595,00;S;1410;8400;/);
    expect(datei(p, "LIESMICH.txt")).toContain("1 Abschlagsrechnung ohne Zahlungsvermerk steht nur in der Rechnungsliste");
  });

  it("§ 13b ohne Vorsteuerabzug auf 3143, LIESMICH beschreibt den echten Fall", () => {
    const s = stand({ belege: [beleg({ steuerschuld: "eu", vorsteuer: false })] });
    const p = steuerpaket(s, JAHR, SB, {}, "2027-01-10T08:00:00");
    expect(datei(p, "Buchungsliste_2026.csv")).toMatch(/408,00;S;3143;1610;;/);
    expect(datei(p, "LIESMICH.txt")).toContain("ohne Vorsteuerabzug auf 3140 bzw. 3143 (nur Umsatzsteuer)");
    expect(datei(steuerpaket({ ...s, steuerberatung: { ...SB, kontenrahmen: "SKR04" } }, JAHR, { ...SB, kontenrahmen: "SKR04" }, {}, "2027-01-10T08:00:00"), "Buchungsliste_2026.csv")).toMatch(/;5943;3310;/);
  });

  it("Barbelege: Warnung zum Kassenminus im LIESMICH; Gutschein zu 0 % nicht im Stapel, mit Frage", () => {
    let s = stand({ belege: [beleg({ id: "b2", zahlung: "bar", steuer: [{ satz: 19, brutto_cent: 1190 }], kategorie: "buero" })] });
    s = rechnung(s, "r1", "2026-12-01", "50,00", { satz: "0", bezeichnung: "Gutschein Gesichtsbehandlung", befreiung: "nicht steuerbar" });
    const p = steuerpaket(s, JAHR, SB, {}, "2027-01-10T08:00:00");
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("negativen Kassenbestand (§ 146 Abs. 1 Satz 2 AO)");
    expect(l).toContain("Gutscheine zu 0 %");
    expect(datei(p, "Buchungsliste_2026.csv")).not.toContain("RE 2026-");
    expect(datei(p, "Fragen_2026.txt")).toContain("Einzweck-Gutschein");
  });

  it("Kleinunternehmer bis …: LIESMICH nennt den Wechsel, Fragen § 15a", () => {
    let s = stand({ betrieb: { ...BETRIEB, ku_bis: "2025-12-31" } });
    s = rechnung(s, "r1", "2026-02-10", "100,00");
    const p = steuerpaket(s, JAHR, SB, {}, "2027-01-10T08:00:00");
    expect(datei(p, "LIESMICH.txt")).toContain("- Kleinunternehmer (§ 19 UStG): bis 31.12.2025, ab 01.01.2026 regelbesteuert");
    expect(datei(p, "Fragen_2026.txt")).toContain("§ 15a UStG");
  });
});
