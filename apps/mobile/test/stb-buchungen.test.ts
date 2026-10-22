/**
 * StB-Prüfung Kanzlei Heckler und Busch (21.10.2026) im Steuerberater-Paket: Soll-Stapel einer GmbH mit
 * Zahlungseingängen und offenen Forderungen zum 31.12. (A-4), Verrechnungskonto Gesellschafter (B-6), EÜR gesperrt
 * (E-4), Kontenvorgaben in Stapel, LIESMICH, Stand und Migration 6 → 7.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { LEERER_STAND, MIGRATIONEN, anlegen, ausgeben, belegSetzen, bezahltSetzen, felderSetzen, standAus, stornieren, type Stand } from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket } from "../src/unterlagen/steuerpaket";
import { kasseFuerUst } from "../src/unterlagen/kasse";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "31877", mandantennummer: "20514" };
const JAHR = { von: "2026-01-01", bis: "2026-12-31", name: "2026" };
const datei = (p: { zip: Uint8Array }, n: string) => strFromU8(unzipSync(p.zip)[n]!);
const latin1 = (p: { zip: Uint8Array }, n: string) => Buffer.from(unzipSync(p.zip)[n]!).toString("latin1");

function rechnung(s: Stand, id: string, datum: string, preis: string, bezahlt?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  let s2 = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: "Elbstudio GmbH", kunde_anschrift: "Hafenstraße 3\n20457 Hamburg", kunde_email: "re@elbstudio.example", positionen: [{ bezeichnung: "Leistung", menge: "1", einheit: "", preis, satz: "19" }] }, t(datum));
  s2 = ausgeben(s2, id, t(datum));
  return bezahlt ? bezahltSetzen(s2, id, bezahlt) : s2;
}

function salon(versteuerung = "ist"): Stand {
  let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Salon Sonne GmbH", rechtsform: "GmbH", strasse: "Osterstraße 1", plz: "20259", ort: "Hamburg", steuernummer: "41/724/03619", versteuerung }, steuerberatung: SB };
  s = rechnung(s, "r16", "2026-11-19", "844,50", "2026-12-03"); // 1.004,96 brutto
  s = rechnung(s, "r17", "2026-12-11", "660,00", "2027-01-12"); // 785,40 brutto, bezahlt erst 2027
  s = rechnung(s, "r18", "2026-12-18", "840,00"); // 999,60 brutto, offen
  s = belegSetzen(s, { id: "b34", datum: "2026-10-06", lieferant: "Buchhandlung", nummer: "Bon 06-1044", kategorie: "fortbildung", steuer: [{ satz: 7, brutto_cent: 4280 }], vorsteuer: true, zahlung: "privat", erstellt: "2026-10-06T10:00:00Z", geaendert: "2026-10-06T10:00:00Z" }, t("2026-10-06"));
  return s;
}

describe("A-4: Soll-Stapel der GmbH", () => {
  const zeilenAus = (p: { zip: Uint8Array }) => latin1(p, "EXTF_Buchungsstapel_2026.csv").split("\r\n").slice(2, -1).map((x) => x.split(";"));
  const saldoAus = (z: string[][], konto: string) => z.reduce((a, f) => a + (f[6] === konto ? 1 : f[7] === konto ? -1 : 0) * (f[1] === '"S"' ? 1 : -1) * (f[117] === "1" ? -1 : 1) * Number(f[0]!.replace(",", "")), 0);

  it("Nachtrag 22.10.2026: Zahlungseingänge standardmäßig NICHT gebucht – 1410 = alle Rechnungen, LIESMICH erklärt Saldo und offene Forderungen", () => {
    const p = steuerpaket(salon(), JAHR, SB, {}, "2027-02-15T10:00:00");
    const z = zeilenAus(p);
    // Forderung an Erlös je Rechnung, keine Bankbuchung
    expect(z.filter((f) => f[6] === "1200" || f[7] === "1200")).toEqual([]);
    expect(saldoAus(z, "1410")).toBe(100496 + 78540 + 99960);
    // B-6: privat ausgelegter Beleg der GmbH im Stapel auf 0731 (korrigierter Bericht, nicht 0755), Sachkonto mit BU 8
    expect(z.find((f) => f[6] === "0731")!.slice(0, 9)).toEqual(["42,80", '"H"', '"EUR"', "", "", "", "0731", "4945", '"8"']);
    expect(z.some((f) => f[6] === "0755" || f[7] === "0755")).toBe(false);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Bilanzierender Betrieb (GmbH): Soll-Stapel");
    expect(l).toContain("Zahlungseingänge sind nicht gebucht – die Kanzlei bucht die Bank aus dem Kontoauszug (Bank an Forderungen 1410)");
    expect(l).toContain("Saldo 1410 aus diesem Stapel zum 31.12.2026: 2.789,96 €");
    expect(l).toContain("laut Rechnungsliste zum 31.12.2026: 1.785,00 €");
    expect(l).toContain("in den Kontenvorgaben „Zahlungseingänge buchen“ einschalten");
    expect(l).toContain("- Kontoauszüge – Zahlungen sind nicht gebucht.");
    expect(l).toContain("- Gewinnermittlung: Bilanz");
    expect(l).toContain("- Kontenvorgaben der Kanzlei: keine – Standardkonten des Kontenrahmens");
    expect(l).toContain("Festschreibung 0 (Kopf und Feld 114)");
    expect(l).toContain("Verrechnungskonto Gesellschafter (0731)");
  });

  it("mit Kontenvorgabe „Zahlungseingänge buchen“: Bank an Forderung zum Zahltag – Saldo 1410 zum 31.12. = offene Forderungen 1.785,00 €", () => {
    const sb = { ...SB, kontenvorgaben: { zahlungenBuchen: true } };
    const p = steuerpaket({ ...salon(), steuerberatung: sb }, JAHR, sb, {}, "2027-02-15T10:00:00");
    const z = zeilenAus(p);
    expect(saldoAus(z, "1410")).toBe(78540 + 99960);
    expect(saldoAus(z, "1200")).toBe(100496);
    expect(z.filter((f) => f[6] === "1200").map((f) => [f[0], f[1], f[7], f[9]])).toEqual([["1004,96", '"S"', "1410", "0312"]]);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Saldo 1410 aus diesem Stapel zum 31.12.2026: 1.785,00 €");
    expect(l).toContain("Zahlungseingänge buchen: ja");
    // Buchungsliste: Belegfeld der Zahlung = Rechnungsnummer
    expect(datei(p, "Buchungsliste_2026.csv")).toMatch(/03\.12\.2026;1004,96;S;1200;1410;;2026-001;Zahlung RE/);
  });

  it("Kontenvorgaben: Zahlungseingänge aus, Bank, Verrechnungskonto und Belege gegen Bank wirken in Stapel und LIESMICH", () => {
    const s = { ...salon(), steuerberatung: { ...SB, kontenvorgaben: { kanzlei: "Kanzlei Muster", konten: { verrechnungGesellschafter: "0730", bank: "1210" }, zahlungenBuchen: false } } };
    const p = steuerpaket(s, JAHR, s.steuerberatung, {}, "2027-02-15T10:00:00");
    const liste = datei(p, "Buchungsliste_2026.csv");
    expect(liste).not.toContain(";1210;1410;");
    expect(liste).toContain(";H;0730;4945;8;");
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("- Kontenvorgaben der Kanzlei: Kanzlei Muster: Verrechnungskonto Gesellschafter 0730; Bank 1210; Zahlungseingänge buchen: nein");
    expect(l).toContain("Zahlungseingänge sind nicht gebucht – die Kanzlei bucht die Bank aus dem Kontoauszug (Bank an Forderungen 1410)");
    const mitBank = { ...salon(), belege: [{ ...salon().belege[0]!, zahlung: "bank" as const }], steuerberatung: { ...SB, kontenvorgaben: { belegeGegenBank: true } } };
    expect(datei(steuerpaket(mitBank, JAHR, mitBank.steuerberatung, {}, "2027-02-15T10:00:00"), "Buchungsliste_2026.csv")).toContain(";H;1200;4945;8;");
  });

  it("Storno mit Erstattung: Generalumkehr im Stapel, Erstattung Bank im Haben (mit Vorgabe); Einzelunternehmen (EÜR) ohne Zahlungsbuchungen", () => {
    let s = rechnung(salon("soll"), "r20", "2026-06-01", "100,00", "2026-06-05");
    const [s3, st] = stornieren(s, "r20", t("2026-06-09"));
    s = bezahltSetzen(ausgeben(s3, st!.id, t("2026-06-09")), st!.id, "2026-06-12");
    const z = zeilenAus(steuerpaket(s, JAHR, SB, {}, "2027-02-15T10:00:00"));
    const storno = z.find((f) => /Storno/.test(f[13] ?? ""))!;
    expect([storno[1], storno[6], storno[7], storno[113], storno[117]]).toEqual(['"S"', "1410", "8400", "0", "1"]);
    expect(z.filter((f) => f[6] === "1200")).toEqual([]);
    const sb = { ...SB, kontenvorgaben: { zahlungenBuchen: true } };
    const zMit = zeilenAus(steuerpaket({ ...s, steuerberatung: sb }, JAHR, sb, {}, "2027-02-15T10:00:00"));
    expect(zMit.filter((f) => f[6] === "1200" && f[9] === "1206").map((f) => [f[0], f[1]])).toEqual([["119,00", '"H"']]);
    const eu = { ...s, betrieb: { ...s.betrieb, name: "Salon Sonne", rechtsform: "Einzelunternehmen" }, steuerberatung: sb };
    expect(datei(steuerpaket(eu, JAHR, sb, {}, "2027-02-15T10:00:00"), "Buchungsliste_2026.csv")).not.toContain(";1200;1410;");
  });
});

describe("E-4: keine EÜR für bilanzierende Betriebe", () => {
  it("GmbH gesperrt; Einzelunternehmen mit Buchführungspflicht laut Finanzamt ebenfalls; Kontenvorgabe „EÜR“ hebt die Sperre auf", () => {
    expect(euerUebernahme(salon(), "2026").gesperrt).toBe(true);
    const eu = { ...salon(), betrieb: { ...salon().betrieb, name: "Salon Sonne", rechtsform: "Einzelunternehmen" } };
    expect(euerUebernahme(eu, "2026").gesperrt).toBeUndefined();
    expect(euerUebernahme({ ...eu, profil: { "steuern.buchfuehrung_mitteilung": true } }, "2026").gesperrt).toBe(true);
    expect(euerUebernahme({ ...salon(), steuerberatung: { ...SB, kontenvorgaben: { gewinnermittlung: "euer" } } }, "2026").gesperrt).toBeUndefined();
  });
});

describe("E-1/E-3: EÜR-Übernahme", () => {
  const eu = (): Stand => ({ ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Café Morgenrot", rechtsform: "Einzelunternehmen" }, steuerberatung: SB });
  it("E-3: Bewirtung nur mit 70 % als Ausgabe, der nicht abziehbare Teil im Text; Vorsteuer voll", () => {
    const s = belegSetzen(eu(), { id: "b1", datum: "2026-03-02", lieferant: "Gasthaus Krone", nummer: "1", kategorie: "bewirtung", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: "2026-03-02", erstellt: "2026-03-02T10:00:00Z", geaendert: "2026-03-02T10:00:00Z" }, t("2026-03-02"));
    const e = euerUebernahme(s, "2026");
    const z = e.ausgaben.find((x) => x.kategorie === "Bewirtungsaufwendungen")!;
    expect(z.betrag).toBe("70,00");
    expect(z.text).toContain("nicht abziehbar 30,00 €");
    expect(e.ausgaben.find((x) => x.kategorie === "Gezahlte Vorsteuerbeträge")!.betrag).toBe("19,00");
  });
  it("E-1: Vorschlag der USt-Zahlungen aus den Voranmeldungen des Jahres (letzte Fassung je Zeitraum), ohne Voranmeldung keiner", () => {
    expect(euerUebernahme(rechnung(eu(), "r1", "2026-03-10", "100,00", "2026-03-20"), "2026").ustVorschlag).toBeUndefined();
    let s = rechnung(eu(), "r1", "2026-03-10", "100,00", "2026-03-20");
    const [s1] = anlegen(s, "ust_voranmeldung", t("2026-04-08"), "va1");
    s = felderSetzen(s1, "va1", { zeitraum: "1. Quartal 2026", umsatz_19: "1.000,00", vorsteuer: "50,00" }, t("2026-04-08"));
    const [s2] = anlegen(s, "ust_voranmeldung", t("2026-07-08"), "va2");
    s = felderSetzen(s2, "va2", { zeitraum: "2. Quartal 2026", umsatz_19: "100,00", vorsteuer: "40,00" }, t("2026-07-08"));
    const [s3] = anlegen(s, "ust_voranmeldung", t("2026-01-08"), "va0");
    s = felderSetzen(s3, "va0", { zeitraum: "4. Quartal 2025", umsatz_19: "500,00" }, t("2026-01-08"));
    const v = euerUebernahme(s, "2026").ustVorschlag!;
    // 190,00 − 50,00 = 140,00 Zahllast; 19,00 − 40,00 = 21,00 Erstattung → 119,00
    expect(v).toContain("Deine 2 Voranmeldungen für 2026 in der App ergeben zusammen 119,00 €");
    expect(v).toContain("Zehn-Tage-Regel");
  });
});

describe("Nachtrag 22.10.2026: OSS-Rechnung in Stapel und EÜR", () => {
  it("Feld 40 nur Länderkennzeichen, Feld 41 Satz, Konto 8320; EÜR: Netto „nicht umsatzsteuerbar“, ausländische USt als vereinnahmte USt", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Kerzenwerk Lina Hoff", rechtsform: "Einzelunternehmen", ust_idnr: "DE347215896", versteuerung: "soll" }, steuerberatung: SB };
    const [s1] = anlegen(s, "rechnung", t("2026-12-16"), "o1");
    s = felderSetzen(s1, "o1", { datum: "2026-12-16", leistung_gleich: true, kunde_name: "Katharina Weber", kunde_anschrift: "Gumpendorfer Straße 72\n1060 Wien\nÖsterreich", kunde_art: "privat", oss: true, oss_satz: "20", positionen: [{ bezeichnung: "Geschenkset", menge: "1", einheit: "", preis: "100,00", satz: "19" }] }, t("2026-12-16"));
    s = bezahltSetzen(ausgeben(s, "o1", t("2026-12-16")), "o1", "2026-12-18");
    const z = latin1(steuerpaket(s, JAHR, SB, {}, "2027-02-15T10:00:00"), "EXTF_Buchungsstapel_2026.csv").split("\r\n").slice(2, -1).map((x) => x.split(";"));
    expect(z.map((f) => [f[0], f[6], f[7], f[39], f[40]])).toEqual([["120,00", "1410", "8320", '"AT"', "20,00"]]);
    const e = euerUebernahme(s, "2026");
    expect(e.einnahmen.find((x) => x.kategorie === "Umsatzsteuerpflichtige Betriebseinnahmen")).toBeUndefined();
    expect(e.einnahmen.find((x) => /nicht umsatzsteuerbare/.test(x.kategorie ?? ""))!.betrag).toBe("100,00");
    expect(e.einnahmen.find((x) => x.kategorie === "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben")!.betrag).toBe("20,00");
  });
});

describe("Kontenvorgaben im Stand", () => {
  it("Migration 6 → 7 bereinigt vorhandene Vorgaben, Lesen behält gültige, verwirft ungültige", () => {
    expect(MIGRATIONEN[6]!({ version: 6, steuerberatung: { kontenrahmen: "SKR03", kontenvorgaben: { konten: { bank: "12" } } } })).toEqual({ version: 6, steuerberatung: { kontenrahmen: "SKR03" } });
    expect(MIGRATIONEN[6]!({ version: 6 })).toEqual({ version: 6 });
    const s = standAus(JSON.stringify({ ...LEERER_STAND, steuerberatung: { ...SB, kontenvorgaben: { konten: { gutscheinVerbindlichkeit: "1701", bank: "x" }, belegeGegenBank: true } } }));
    expect(s.version).toBe(7);
    expect(s.steuerberatung.kontenvorgaben).toEqual({ konten: { gutscheinVerbindlichkeit: "1701" }, belegeGegenBank: true });
    expect(standAus(JSON.stringify({ ...LEERER_STAND, steuerberatung: SB })).steuerberatung.kontenvorgaben).toBeUndefined();
  });
  it("B-9: Überschuss auf ein Ertragskonto ohne Umsatzsteuer zählt nicht als Kassenumsatz 19 % in der Voranmeldung", () => {
    const s = { ...LEERER_STAND, steuerberatung: { ...SB, kontenvorgaben: { konten: { kassendifferenzErtrag: "2700" } } } };
    expect(kasseFuerUst(s).ueberschuesse).toEqual([]);
  });
});
