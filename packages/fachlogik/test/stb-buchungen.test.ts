/**
 * StB-Prüfung Kanzlei Heckler und Busch (21.10.2026), Abschnitte 3 und 4: Kontoseite des BU-Schlüssels (A-1),
 * Feldbelegung 103/114/118 (3.1), Soll-Stapel mit Zahlungseingängen (A-4), Verrechnungskonto Gesellschafter (B-6),
 * Nullsteuersatz (B-2), Kleinunternehmer-Wareneingang (A-2) und Kontenvorgaben der Kanzlei (B-4/B-9/B-10/B-11).
 */
import { describe, expect, it } from "vitest";
import { KATEGORIEN, belegAus, type Beleg } from "../src/belege.js";
import {
  BUCHUNGSKONTEN,
  DATEV_FESTSCHREIBUNG,
  DATEV_GENERALUMKEHR,
  DATEV_GUID,
  DATEV_SPALTEN,
  bilanzierend,
  buchungenAusBelegen,
  buchungenAusRechnungen,
  buchungsVorzeichen,
  buchungsGuid,
  datevExtf,
  erloeskonto,
  kontenFuer,
  ossLandKennzeichen,
  skontoBuchungenRechnung,
  zahlungsBuchungenRechnung,
  type AusgangsRechnungFuerBuchung,
  type Buchung,
} from "../src/buchungen.js";
import { kassenBuchungen, kassenDifferenzBuchungen, type Kassenabschluss } from "../src/kasse.js";
import { KONTENVORGABE_FELDER, kontenvorgabenAus, kontenvorgabenAusJson, kontenvorgabenJson } from "../src/kontenvorgaben.js";
import { STEUERART_NULLSATZ, STEUERARTEN, istNullsatz, istSteuerart } from "../src/steuerart.js";

const RE: AusgangsRechnungFuerBuchung = { id: "r1", nummer: "2026-017", datum: "2026-12-11", art: "rechnung", kleinunternehmer: false, kunde: "Elbstudio GmbH", positionen: [{ bezeichnung: "Shooting", menge: 1, einheit: "stunde", preis_cent: 66000, ust_satz: 19 }] };
const BELEG: Beleg = { id: "b1", datum: "2026-02-01", lieferant: "Hansen KG", nummer: "MR-2026-Q1", kategorie: "miete", steuer: [{ satz: 19, brutto_cent: 992460 }], vorsteuer: true, zahlung: "bank", erstellt: "2026-02-01", geaendert: "2026-02-01" };
const EXPORT = { beraternummer: "31877", mandantennummer: "20514", wjBeginn: "2026-01-01", von: "2026-01-01", bis: "2026-12-31", kontenrahmen: "SKR03" as const, erzeugtAm: "2027-02-15T10:00:00" };
/** Feld n (1-basiert wie in der DATEV-Formatbeschreibung) einer Buchungszeile */
const feld = (zeile: string, n: number) => zeile.split(";")[n - 1];
const zeilen = (b: Buchung[]) => datevExtf(b, EXPORT).split("\r\n").slice(2, -1);

describe("A-1: BU-Schlüssel gehört zum Gegenkonto", () => {
  it("Eingangsbeleg: Verbindlichkeit in Feld 7 (Haben), Sachkonto in Feld 8, BU 9 in Feld 9 – wie im Bericht „9924,60;H;…;1610;4210;9“", () => {
    const z = zeilen(buchungenAusBelegen([BELEG], "SKR03"))[0]!;
    expect([feld(z, 1), feld(z, 2), feld(z, 7), feld(z, 8), feld(z, 9)]).toEqual(["9924,60", '"H"', "1610", "4210", '"9"']);
    expect(DATEV_SPALTEN[6]).toBe("Konto");
    expect(DATEV_SPALTEN[7]).toBe("Gegenkonto (ohne BU-Schlüssel)");
    expect(DATEV_SPALTEN[8]).toBe("BU-Schlüssel");
  });
  it("Kasse, Privat, Bank: das Zahlungskonto steht in Feld 7, die Kasse auch beim Kassenfehlbetrag", () => {
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "bar" }], "SKR03")[0]).toMatchObject({ konto: "1000", gegenkonto: "4210", soll_haben: "H", bu_schluessel: "9" });
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR04")[0]).toMatchObject({ konto: "2180", gegenkonto: "6310", soll_haben: "H" });
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "bank" }], "SKR03", { vorgaben: { belegeGegenBank: true } })[0]).toMatchObject({ konto: "1200", gegenkonto: "4210" });
    expect(kassenDifferenzBuchungen([{ datum: "2026-11-28", cent: -230 }], "SKR03")[0]).toMatchObject({ konto: "1000", gegenkonto: "4900", soll_haben: "H", bu_schluessel: "" });
  });
  it("Gutschrift eines Lieferanten (negativer Beleg) im Soll; Erlöse und Kasse bleiben Forderung bzw. Kasse an Erlös", () => {
    expect(buchungenAusBelegen([{ ...BELEG, steuer: [{ satz: 19, brutto_cent: -11900 }] }], "SKR03")[0]).toMatchObject({ konto: "1610", gegenkonto: "4210", soll_haben: "S" });
    expect(zeilen(buchungenAusRechnungen([RE], "SKR03")).map((z) => [feld(z, 7), feld(z, 8), feld(z, 9)])).toEqual([["1410", "8400", ""]]);
    const k: Kassenabschluss = { id: "k", datum: "2026-05-02", zbon: "1", umsatz: [{ satz: 19, brutto_cent: 11900 }], karte_cent: 0, bewegungen: [], erstellt: "2026-05-02T22:00:00Z" } as unknown as Kassenabschluss;
    expect(kassenBuchungen([k], "SKR03")[0]).toMatchObject({ konto: "1000", gegenkonto: "8400", soll_haben: "S" });
  });
});

describe("3.1: Feld 103 leer, GUID in Beleginfo, Feld 114 = 0, Generalumkehr 118", () => {
  it("Feld 103 „Buchungs GUID“ leer, Beleginfo-Art 1 / -Inhalt 1 (Felder 21/22) mit der stabilen GUID, Feld 114 = 0", () => {
    expect(DATEV_GUID + 1).toBe(103);
    expect(DATEV_FESTSCHREIBUNG + 1).toBe(114);
    expect(DATEV_GENERALUMKEHR + 1).toBe(118);
    expect(DATEV_SPALTEN[20]).toBe("Beleginfo - Art 1");
    const z = zeilen(buchungenAusRechnungen([RE], "SKR03"))[0]!;
    expect(feld(z, 103)).toBe("");
    expect(feld(z, 21)).toBe('"Buchungs-GUID"');
    expect(feld(z, 22)).toBe(`"${buchungsGuid("r1", 19)}"`);
    expect(feld(z, 114)).toBe("0");
    expect(feld(z, 118)).toBe("");
    expect(z.split(";")).toHaveLength(125);
    // Kopf: Feld 21 Festschreibung 0
    expect(datevExtf([], EXPORT).split("\r\n")[0]!.split(";")[20]).toBe("0");
  });
  it("Storno: ursprüngliche Seite (Soll) mit Generalumkehr 1; Saldo zählt umgekehrt", () => {
    const st = buchungenAusRechnungen([{ ...RE, id: "r2", nummer: "2026-018", art: "storno" }], "SKR03");
    const z = zeilen(st)[0]!;
    expect([feld(z, 2), feld(z, 7), feld(z, 8), feld(z, 118)]).toEqual(['"S"', "1410", "8400", "1"]);
    expect(buchungsVorzeichen(st[0]!)).toBe(-1);
    // Storno einer Gutschrift ebenfalls als Generalumkehr
    const gs = buchungenAusRechnungen([{ ...RE, gutschrift: true, art: "storno" }], "SKR03")[0]!;
    expect(gs).toMatchObject({ konto: "1610", gegenkonto: "3100", soll_haben: "H", generalumkehr: true });
  });
});

describe("A-4: Soll-Stapel bilanzierender Betriebe mit offenen Forderungen zum 31.12.", () => {
  it("GmbH, UG, GmbH & Co. KG, e. K. und Buchführungspflicht nach § 141 AO bilanzieren; Kontenvorgabe geht vor", () => {
    expect(bilanzierend({ rechtsform: "GmbH" })).toBe(true);
    expect(bilanzierend({ rechtsform: "", name: "Lang Ventures UG (haftungsbeschränkt)" })).toBe(true);
    expect(bilanzierend({ rechtsform: "GmbH & Co. KG" })).toBe(true);
    expect(bilanzierend({ rechtsform: "e. K." })).toBe(true);
    // E-176: OHG und KG sind Handelsgesellschaften (§§ 6, 238 HGB) – § 241a HGB gilt nur für Einzelkaufleute
    expect(bilanzierend({ rechtsform: "OHG" })).toBe(true);
    expect(bilanzierend({ rechtsform: "KG" })).toBe(true);
    expect(bilanzierend({ rechtsform: "", name: "Becker & Sohn KG" })).toBe(true);
    expect(bilanzierend({ rechtsform: "GbR" })).toBe(false);
    expect(bilanzierend({ rechtsform: "Einzelunternehmen" })).toBe(false);
    expect(bilanzierend({ rechtsform: "Einzelunternehmen", buchfuehrungMitteilung: true })).toBe(true);
    expect(bilanzierend({ rechtsform: "e. K.", vorgabe: "euer" })).toBe(false);
  });
  it("Forderung an Erlös mit der Rechnung, Zahlung Bank an Forderung: Saldo 1410 = offene Rechnungen (Salon 2026-017/-018: 1.785,00 €)", () => {
    const r17 = { ...RE, positionen: [{ ...RE.positionen[0]!, preis_cent: 66000 }] }; // 785,40 brutto
    const r18 = { ...RE, id: "r18", nummer: "2026-018", datum: "2026-12-18", positionen: [{ ...RE.positionen[0]!, preis_cent: 84000 }] }; // 999,60 brutto
    const r16 = { ...RE, id: "r16", nummer: "2026-016", datum: "2026-11-19", positionen: [{ ...RE.positionen[0]!, preis_cent: 84450 }] }; // 1.004,96 brutto, bezahlt 03.12.
    const b = [...buchungenAusRechnungen([r16, r17, r18], "SKR03"), ...zahlungsBuchungenRechnung(r16, [{ id: "z", datum: "2026-12-03", betrag_cent: 100496 }], "SKR03")];
    const saldo = (konto: string) => b.reduce((a, x) => a + (x.konto === konto ? buchungsVorzeichen(x) * x.betrag_cent : 0) - (x.gegenkonto === konto ? buchungsVorzeichen(x) * x.betrag_cent : 0), 0);
    expect(saldo("1410")).toBe(78540 + 99960);
    expect(saldo("1200")).toBe(100496);
    expect(b.at(-1)).toMatchObject({ datum: "2026-12-03", konto: "1200", gegenkonto: "1410", soll_haben: "S", bu_schluessel: "", ust_satz: null, art: "umbuchung" });
    // Erstattung zu einem Storno: Bank im Haben
    expect(zahlungsBuchungenRechnung({ ...r16, art: "storno" }, [{ id: "e", datum: "2026-12-05", betrag_cent: 1000 }], "SKR04")[0]).toMatchObject({ konto: "1800", gegenkonto: "1210", soll_haben: "H" });
  });
  it("B-6: privat ausgelegte Belege und Barbelege vor dem ersten Kassenabschluss einer Kapitalgesellschaft auf 0731 (SKR04 vorläufig 3560)", () => {
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR03", { kapitalgesellschaft: true })[0]!.konto).toBe("0731");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "bar" }], "SKR04", { kapitalgesellschaft: true, kasseAb: null })[0]!.konto).toBe("3560");
    expect(buchungenAusBelegen([{ ...BELEG, zahlung: "privat" }], "SKR03", { kapitalgesellschaft: true, vorgaben: { konten: { verrechnungGesellschafter: "0730" } } })[0]!.konto).toBe("0730");
    // Einlagen und Entnahmen der Kasse einer Gesellschaft ebenfalls über das Verrechnungskonto
    const k = { id: "k", datum: "2026-05-02", zbon: "", umsatz: [], karte_cent: 0, bewegungen: [{ art: "einlage", betrag_cent: 5000 }], erstellt: "2026-05-02T22:00:00Z" } as unknown as Kassenabschluss;
    expect(kassenBuchungen([k], "SKR03", { kapitalgesellschaft: true }).find((x) => x.betrag_cent === 5000)).toMatchObject({ konto: "1000", gegenkonto: "0731" });
  });
});

describe("B-2: Nullsteuersatz als eigene Steuerart mit eigenem Erlöskonto (Kz 87)", () => {
  it("gemeinsame Konstante STEUERART_NULLSATZ; Konto 8290/4290 statt 8100/4100, per Kontenvorgabe änderbar", () => {
    expect(STEUERART_NULLSATZ).toBe("nullsatz");
    expect(STEUERARTEN).toContain(STEUERART_NULLSATZ);
    expect(istSteuerart("nullsatz") && istNullsatz("nullsatz") && !istNullsatz("befreit")).toBe(true);
    const pv = { ...RE, steuerart: STEUERART_NULLSATZ, positionen: [{ ...RE.positionen[0]!, ust_satz: 0 }] };
    expect(buchungenAusRechnungen([pv], "SKR03")[0]).toMatchObject({ gegenkonto: "8290", bu_schluessel: "", ust_satz: 0 });
    expect(buchungenAusRechnungen([pv], "SKR04")[0]!.gegenkonto).toBe("4290");
    expect(buchungenAusRechnungen([{ ...pv, steuerart: "befreit" }], "SKR03")[0]!.gegenkonto).toBe("8100");
    expect(buchungenAusRechnungen([pv], "SKR03", { vorgaben: { konten: { erloesNullsatz: "8287" } } })[0]!.gegenkonto).toBe("8287");
    expect(erloeskonto(kontenFuer("SKR03"), 0, { steuerart: "nullsatz" })).toBe("8290");
  });
});

describe("A-2: Kleinunternehmer – Wareneingang ohne Automatik und ohne BU 40", () => {
  it("3200/5200 ohne Schlüssel statt 3400/3300 mit BU 40; andere Kategorien ohne BU", () => {
    const waren = { ...BELEG, kategorie: "waren", vorsteuer: true, steuer: [{ satz: 19, brutto_cent: 1190 }, { satz: 7, brutto_cent: 107 }] };
    expect(buchungenAusBelegen([waren], "SKR03", { kleinunternehmer: true }).map((x) => [x.gegenkonto, x.bu_schluessel])).toEqual([["3200", ""], ["3200", ""]]);
    expect(buchungenAusBelegen([waren], "SKR04", { kleinunternehmer: true })[0]!.gegenkonto).toBe("5200");
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "buero" }], "SKR03", { kleinunternehmer: true })[0]!.bu_schluessel).toBe("");
    // Regelbesteuerung ohne Vorsteuerabzug: weiter Automatikkonto mit BU 40
    expect(buchungenAusBelegen([{ ...waren, vorsteuer: false }], "SKR03")[0]).toMatchObject({ gegenkonto: "3400", bu_schluessel: "40" });
  });
});

describe("B-4/B-9/B-10/B-11: Kontenvorgaben der Kanzlei", () => {
  it("Standardkonten je Kontenrahmen laut Bericht; Vorgaben ersetzen nur gültige vierstellige Nummern", () => {
    expect(BUCHUNGSKONTEN.SKR03).toMatchObject({ bank: "1200", verrechnungGesellschafter: "0731", homeoffice: "4288", anlagen: { maschinen: "0400", bga: "0420", kfz: "0320", software: "0027" } });
    expect(BUCHUNGSKONTEN.SKR04).toMatchObject({ bank: "1800", verrechnungGesellschafter: "3560", homeoffice: "6348", anlagen: { maschinen: "0440", bga: "0650", kfz: "0520", software: "0135" } });
    const k = kontenFuer("SKR03", { konten: { gutscheinVerbindlichkeit: "1701", kassendifferenzErtrag: "2700", forderungen: "14x0" } });
    expect([k.gutscheinVerbindlichkeit, k.kassendifferenzErtrag, k.forderungen]).toEqual(["1701", "2700", "1410"]);
    // Überschuss auf dem Erlöskonto 19 % zählt wie keine Vorgabe
    expect(kontenFuer("SKR03", { konten: { kassendifferenzErtrag: "8400" } }).kassendifferenzErtrag).toBe("");
  });
  it("Anlagenkonten nach Art, Homeoffice 4288/6348, Kassendifferenz-Überschuss ohne Umsatzsteuer", () => {
    const anlage = { ...BELEG, kategorie: "anlage", anlage_art: "kfz" as const };
    expect(buchungenAusBelegen([anlage], "SKR03")[0]!.gegenkonto).toBe("0320");
    expect(buchungenAusBelegen([{ ...anlage, anlage_art: "software" as const }], "SKR04")[0]!.gegenkonto).toBe("0135");
    expect(buchungenAusBelegen([{ ...anlage, anlage_art: null }], "SKR03")[0]!.gegenkonto).toBe("0420");
    expect(buchungenAusBelegen([anlage], "SKR03", { vorgaben: { konten: { anlageKfz: "0350" } } })[0]!.gegenkonto).toBe("0350");
    expect(belegAus({ ...anlage })!.anlage_art).toBe("kfz");
    expect(belegAus({ ...anlage, anlage_art: "haus" })!.anlage_art).toBeUndefined();
    expect(KATEGORIEN.find((x) => x.id === "homeoffice")!.skr03[0]).toBe("4288");
    expect(buchungenAusBelegen([{ ...BELEG, kategorie: "homeoffice", vorsteuer: false, steuer: [{ satz: 0, brutto_cent: 126000 }] }], "SKR04")[0]!.gegenkonto).toBe("6348");
    expect(kassenDifferenzBuchungen([{ datum: "2026-11-28", cent: 230 }], "SKR03", { vorgaben: { konten: { kassendifferenzErtrag: "2700" } } })[0]).toMatchObject({ konto: "1000", gegenkonto: "2700", ust_satz: null, soll_haben: "S" });
    expect(kassenDifferenzBuchungen([{ datum: "2026-11-28", cent: -230 }], "SKR03", { vorgaben: { konten: { kassendifferenzAufwand: "4910" } } })[0]!.gegenkonto).toBe("4910");
  });
  it("Import der JSON-Datei der Kanzlei: Konten, Optionen, Kontenrahmen, Warnungen; ungültige Dateien mit Grund", () => {
    const datei = JSON.stringify({ format: "kontenvorgaben", version: 1, kanzlei: "Kanzlei Muster", stand: "2026-10-21", kontenrahmen: "SKR04", konten: { verrechnungGesellschafter: "3519", gutscheinVerbindlichkeit: "3501", bank: "12", sonstwas: "1234" }, optionen: { belegeGegenBank: true, zahlungenBuchen: false, gewinnermittlung: "bilanz", farbe: "blau" } });
    const r = kontenvorgabenAusJson(`\uFEFF${datei}`);
    expect(r.kontenrahmen).toBe("SKR04");
    expect(r.vorgaben).toEqual({ konten: { verrechnungGesellschafter: "3519", gutscheinVerbindlichkeit: "3501" }, belegeGegenBank: true, zahlungenBuchen: false, gewinnermittlung: "bilanz", kanzlei: "Kanzlei Muster", stand: "2026-10-21" });
    expect(r.warnungen).toEqual(["Bank: „12“ ist keine vierstellige Kontonummer", "unbekanntes Konto „sonstwas“", "unbekannte Option „farbe“"]);
    // Rundweg: Export liest sich wieder gleich
    expect(kontenvorgabenAusJson(kontenvorgabenJson(r.vorgaben, "SKR04"))).toEqual({ vorgaben: r.vorgaben, kontenrahmen: "SKR04", warnungen: [] });
    expect(() => kontenvorgabenAusJson("kein json")).toThrow("kein gültiges JSON");
    expect(() => kontenvorgabenAusJson(JSON.stringify({ format: "datev" }))).toThrow("Unbekanntes Format");
    expect(() => kontenvorgabenAusJson(JSON.stringify({ konten: { bank: "x" } }))).toThrow("keine gültigen Konten");
    expect(kontenvorgabenAus({ konten: { bank: "1201", fremd: "1" }, belegeGegenBank: "ja" })).toEqual({ konten: { bank: "1201" } });
    expect(KONTENVORGABE_FELDER.map((f) => f.id)).toContain("homeoffice");
  });
});

describe("Koordination Rechnungen: OSS und Schlussrechnung", () => {
  it("OSS: eigenes Erlöskonto 8320/4320 (Kontenbereich bestätigt, Kontenvorgabe) mit Land in Feld 40 und Steuersatz in Feld 41", () => {
    const oss = { ...RE, kunde_land: "AT", oss: { land: "AT", satz: 20 }, positionen: [{ ...RE.positionen[0]!, preis_cent: 10000, ust_satz: 20 }] };
    const b = buchungenAusRechnungen([oss], "SKR03");
    expect(b[0]).toMatchObject({ gegenkonto: "8320", betrag_cent: 12000, eu_ustid: "AT", eu_steuersatz: 20 });
    const z = zeilen(b)[0]!;
    expect([feld(z, 40), feld(z, 41)]).toEqual(['"AT"', "20,00"]);
    expect(buchungenAusRechnungen([oss], "SKR04")[0]!.gegenkonto).toBe("4320");
    expect(buchungenAusRechnungen([oss], "SKR03", { vorgaben: { konten: { erloesOss: "8321" } } })[0]!.gegenkonto).toBe("8321");
  });
  it("OSS (Nachtrag 22.10.2026): Feld 40 nur mit dem Länderkennzeichen – auch wenn eine USt-IdNr. erfasst ist; Griechenland „EL“; Storno und Skonto ebenso", () => {
    const oss = { ...RE, kunde_land: "NL", kunde_ust_idnr: "NL001234567B01", oss: { land: "nl", satz: 21 }, positionen: [{ ...RE.positionen[0]!, preis_cent: 10000, ust_satz: 21 }] };
    const z = zeilen(buchungenAusRechnungen([oss], "SKR03"))[0]!;
    expect([feld(z, 7), feld(z, 8), feld(z, 40), feld(z, 41)]).toEqual(["1410", "8320", '"NL"', "21,00"]);
    expect(feld(zeilen(buchungenAusRechnungen([{ ...oss, kunde_land: "GR", oss: { land: "GR", satz: 24 } }], "SKR03"))[0]!, 40)).toBe('"EL"');
    expect(ossLandKennzeichen(" at ")).toBe("AT");
    const st = zeilen(buchungenAusRechnungen([{ ...oss, art: "storno" as const }], "SKR03"))[0]!;
    expect([feld(st, 40), feld(st, 41), feld(st, 118)]).toEqual(['"NL"', "21,00", "1"]);
    // Skonto auf eine OSS-Rechnung: Minderung auf dem OSS-Erlöskonto mit Land und Satz, nicht „Gewährte Skonti 19 %“ (8736)
    const sk = skontoBuchungenRechnung(oss, [{ id: "z1", datum: "2026-12-20", brutto_cent: 242 }], "SKR03");
    expect(sk.map((b) => [b.konto, b.gegenkonto, b.betrag_cent, b.eu_ustid, b.eu_steuersatz])).toEqual([["8320", "1410", 242, "NL", 21]]);
    // igL dagegen weiter mit USt-IdNr.
    const igl = { ...RE, kunde_land: "AT", kunde_ust_idnr: "ATU 12345678", steuerart: "igl" as const, positionen: [{ ...RE.positionen[0]!, ust_satz: 0 }] };
    expect(feld(zeilen(buchungenAusRechnungen([igl], "SKR03"))[0]!, 40)).toBe('"ATU12345678"');
  });
  it("Schlussrechnung: gebucht wird nur der Rest nach Abzug der Abschläge je Steuersatz (restGruppen)", () => {
    const schluss = { ...RE, positionen: [{ ...RE.positionen[0]!, preis_cent: 300000 }], abschlaege: [{ nummer: "2026-014", satz: 19, netto_cent: 100000, ust_cent: 19000 }] };
    expect(buchungenAusRechnungen([schluss], "SKR03").map((x) => [x.gegenkonto, x.betrag_cent])).toEqual([["8400", 238000]]);
  });
});
