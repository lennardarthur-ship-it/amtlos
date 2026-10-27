/**
 * E-218 (Steuerberater, 27.10.2026, Antworten zu T-273 und T-274):
 * 2a. Storno „Fehler in der Rechnung“: war Voranmeldung bzw. ZM des ursprünglichen Zeitraums abgegeben, ist sie zu
 *     berichtigen – die Voranmeldung für denselben Zeitraum wie die ZM, nicht in der laufenden.
 * 2b. Tag, an dem der Fehler erkannt wurde (vorbelegt mit dem Storno) – ab ihm läuft die Monatsfrist (§ 18a Abs. 10 UStG).
 * 2c. DATEV-Feld 116 = Tag, der den ursprünglichen Zeitraum bestimmt (§ 18b), auch über den Jahreswechsel.
 * 2d. Ältere Stornos innergemeinschaftlicher Lieferungen ohne Grund: einmaliger Hinweis, Grund nachtragen.
 * 2e. Skonto auf eine Anzahlung vor der Meldung mindert das Entgelt der Schlussrechnung (§ 10 Abs. 1 UStG), nicht einen
 *     früheren Zeitraum; erst danach im Zeitraum der Zahlung.
 * 3.  DATEV: Anzahlungen auf EU-Umsätze nicht mehr zum Zahltag auf 8125/8336 – Bilanz: 1710/3250 und Verrechnung mit der
 *     Schlussrechnung; EÜR: Erlöskonto ohne Umsatzsteuerfunktion aus den Kontenvorgaben (kein Standard), Umbuchung mit der
 *     Schlussrechnung.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, euStornoSetzen, felderSetzen, kopieren, stornieren, unterlagenVereinen, zahlungVermerken, type EuStornoGrund, type Stand } from "../src/unterlagen/speicher";
import { berichtigungText, euBerichtigungen, euStornosOhneGrund, umsaetzeFuer, zuordnungsTage, type Versteuerung } from "../src/unterlagen/ustAusRechnungen";
import { zmFuer } from "../src/unterlagen/euMeldungen";
import { bilanzierendeGewinnermittlung, steuerpaket } from "../src/unterlagen/steuerpaket";
import { T as TEXT } from "../src/texte";
import { strFromU8, unzipSync } from "fflate";
import { BUCHUNGSKONTEN, KONTENVORGABE_FELDER, KU_HINWEIS, dokumentHtml, eRechnungAus, kontenFuer, vorlageFuer, xrechnungUbl, type Daten, type Kontenvorgaben } from "@amtlos/fachlogik";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", ust_idnr: "DE123456789", iban: "DE89370400440532013000" };
const GMBH = { ...BETRIEB, name: "Testbetrieb GmbH", rechtsform: "GmbH" };
const AT = { kunde_name: "Wiener Kaffee GmbH", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_email: "re@wien.example", kunde_ust_idnr: "ATU69876543", zahlungsziel: "30" };
const pos = (preis: string) => [{ bezeichnung: "Kaffeebohnen", menge: "1", einheit: "Stück", preis, satz: "0" }];
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "31877", mandantennummer: "20514" };
const leer = (betrieb = BETRIEB, kontenvorgaben?: Kontenvorgaben): Stand => ({ ...LEERER_STAND, betrieb, steuerberatung: { ...SB, ...(kontenvorgaben ? { kontenvorgaben } : {}) } });
const paket = (s: Stand, monat: string, kontenrahmen: "SKR03" | "SKR04" = "SKR03") => {
  const ende = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const sb = { ...s.steuerberatung, kontenrahmen };
  const p = steuerpaket(s, { von: `${monat}-01`, bis: ende, name: monat }, sb, {}, "2027-02-15T10:00:00");
  const dateien = unzipSync(p.zip);
  const stapelName = Object.keys(dateien).find((k) => k.startsWith("EXTF_Buchungsstapel"))!;
  const zeilen = Buffer.from(dateien[stapelName]!).toString("latin1").split("\r\n");
  return { liesmich: strFromU8(dateien["LIESMICH.txt"]!), kopf: zeilen[0]!.split(";"), zeilen: zeilen.slice(2, -1).map((x) => x.split(";")) };
};
/** Zeile kurz: Betrag;S/H;Konto;Gegenkonto;BU;Belegdatum;Feld 116;EU-USt-IdNr. */
const kurz = (f: string[]) => [f[0], f[1], f[6], f[7], f[8], f[9], f[115], f[39]].map((x) => (x ?? "").replace(/"/g, "")).join(";");

function rechnung(s: Stand, id: string, datum: string, daten: Daten, bezahlt?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = ausgeben(felderSetzen(s1, id, { datum, leistung_gleich: true, ...AT, ...daten }, t(datum)), id, t(datum));
  return bezahlt ? bezahltSetzen(s2, id, bezahlt, t(bezahlt)) : s2;
}
function storno(s: Stand, orig: string, id: string, datum: string, grund?: EuStornoGrund, erkannt?: string): Stand {
  const [s1, st] = stornieren(s, orig, t(datum), id, grund, erkannt);
  expect(st).not.toBeNull();
  return ausgeben(s1, id, t(datum));
}
function ersatz(s: Stand, orig: string, id: string, datum: string, daten: Daten): Stand {
  const [s1] = kopieren(s, orig, t(datum), id);
  return ausgeben(felderSetzen(s1, id, { datum, ...daten }, t(datum)), id, t(datum));
}
const kz = (s: Stand, periode: string, v: Versteuerung, feld: "umsatz_igl" | "umsatz_21" = "umsatz_igl") => umsaetzeFuer(s.unterlagen, periode, s.betrieb, v)?.werte[feld] ?? "0,00";
const zm = (s: Stand, periode: string) => zmFuer(s.unterlagen, periode, s.betrieb)!.zeilen;

/** igL: Lieferung 10.09., Rechnung 15.09.2026 über 1.000 € */
const lieferung = (b = BETRIEB) => rechnung(leer(b), "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["igl"], positionen: pos("1.000,00") });

describe("E-218 (2a): Berichtigung im Zeitraum der ursprünglichen Meldung – Voranmeldung für denselben Zeitraum wie die ZM", () => {
  it("Hinweise auf der Stornorechnung, auf „Heute“, bei Voranmeldung/ZM und im Paket sagen: schon abgegeben → berichtigen, Voranmeldung desselben Zeitraums, nicht die laufende", () => {
    let s = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    s = ersatz(s, "r1", "r2", "2026-11-05", { kunde_ust_idnr: "ATU12345675" });
    const b = euBerichtigungen(s.unterlagen, s.betrieb)[0]!;
    // Stornorechnung
    const hinweis = TEXT.e214_berichtigen_hinweis("September 2026", "05.12.2026");
    expect(hinweis).toContain("schon abgegeben");
    expect(hinweis).toContain("Voranmeldung für denselben Zeitraum wie die ZM");
    expect(hinweis).toContain("laufenden Voranmeldung genügt nicht");
    // Heute
    expect(TEXT.e214_berichtigen_text("st", "r", "05.12.2026")).toMatch(/schon abgegeben.*genau diesen Zeitraum, nicht in der laufenden/);
    // Voranmeldung / ZM bei der Übernahme
    expect(TEXT.e214_va_berichtigung(["st"])).toContain("Voranmeldung und ZM für denselben Zeitraum");
    expect(TEXT.e214_zm_berichtigung("05.12.2026")).toContain("Voranmeldung für denselben Zeitraum");
    expect(TEXT.e214_va_anderswo(["st"], "September 2026")).toContain("nicht in dieser Voranmeldung korrigieren");
    // PDF der Voranmeldung (Annahmen) und Paket
    expect(berichtigungText(b)).toContain("nicht in der laufenden Voranmeldung");
    expect(umsaetzeFuer(s.unterlagen, "2026-09", s.betrieb)!.werte.annahmen).toContain("Voranmeldung im selben Zeitraum wie die ZM");
    const p = paket(s, "2026-11");
    expect(p.liesmich).toMatch(/Voranmeldung für denselben Zeitraum wie die ZM[^\n]*laufenden Voranmeldung genügt nicht/);
  });
});

describe("E-218 (2b): Tag, an dem der Fehler erkannt wurde", () => {
  it("vorbelegt mit dem Storno: Frist einen Monat nach dem Storno; eingegeben (20.10.): Frist 20.11. – auch nachträglich änderbar", () => {
    const ohne = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    expect(euBerichtigungen(ohne.unterlagen, ohne.betrieb)[0]).toMatchObject({ erkannt: "2026-11-05", zmFrist: "2026-12-05" });
    const mit = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung", "2026-10-20");
    expect(euBerichtigungen(mit.unterlagen, mit.betrieb)[0]).toMatchObject({ erkannt: "2026-10-20", zmFrist: "2026-11-20" });
    // nach der Festschreibung geändert
    const spaeter = euStornoSetzen(ohne, "st1", { erkannt: "2026-10-31" }, t("2026-11-06"));
    expect(euBerichtigungen(spaeter.unterlagen, spaeter.betrieb)[0]).toMatchObject({ erkannt: "2026-10-31", zmFrist: "2026-11-30" });
    // nicht nach dem Storno; null = wieder das Datum des Stornos
    expect(euStornoSetzen(ohne, "st1", { erkannt: "2026-11-06" }, t("2026-11-06"))).toBe(ohne);
    const zurueck = euStornoSetzen(spaeter, "st1", { erkannt: null }, t("2026-11-07"));
    expect(euBerichtigungen(zurueck.unterlagen, zurueck.betrieb)[0]!.zmFrist).toBe("2026-12-05");
  });

  it("wird nicht gedruckt: Storno-PDF und XRechnung mit und ohne Tag gleich; Inhalt der festgeschriebenen Stornorechnung unverändert", () => {
    const a = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    const b = euStornoSetzen(a, "st1", { erkannt: "2026-10-20" }, t("2026-11-06"));
    const ua = a.unterlagen.find((u) => u.id === "st1")!;
    const ub = b.unterlagen.find((u) => u.id === "st1")!;
    expect(ub.daten).toEqual(ua.daten);
    expect(ub.festgeschrieben).toBe(ua.festgeschrieben);
    const v = vorlageFuer("rechnung")!;
    expect(dokumentHtml(v, ub.daten, BETRIEB)).toBe(dokumentHtml(v, ua.daten, BETRIEB));
    expect(xrechnungUbl(eRechnungAus(ub.daten, BETRIEB).daten, KU_HINWEIS)).toBe(xrechnungUbl(eRechnungAus(ua.daten, BETRIEB).daten, KU_HINWEIS));
  });

  it("Synchronisation: die zuletzt geänderte Angabe gilt, in beiden Richtungen gleich; Zurücknehmen setzt sich durch", () => {
    const basis = storno(lieferung(), "r1", "st1", "2026-11-05", "rechnung");
    const a = euStornoSetzen(basis, "st1", { erkannt: "2026-10-20" }, t("2026-11-06")).unterlagen.find((u) => u.id === "st1")!;
    const b = euStornoSetzen(basis, "st1", { erkannt: "2026-10-25" }, t("2026-11-07")).unterlagen.find((u) => u.id === "st1")!;
    expect(unterlagenVereinen(a, b).u.euStorno?.erkannt).toBe("2026-10-25");
    expect(unterlagenVereinen(b, a).u.euStorno?.erkannt).toBe("2026-10-25");
    const ohneAngabe = basis.unterlagen.find((u) => u.id === "st1")!;
    expect(unterlagenVereinen(ohneAngabe, a).u.euStorno?.erkannt).toBe("2026-10-20");
    const c = euStornoSetzen({ ...basis, unterlagen: basis.unterlagen.map((u) => (u.id === "st1" ? b : u)) }, "st1", { erkannt: null }, t("2026-11-08")).unterlagen.find((u) => u.id === "st1")!;
    expect(unterlagenVereinen(b, c).u.euStorno?.erkannt).toBeUndefined();
    expect(unterlagenVereinen(c, a).u.euStorno?.erkannt).toBeUndefined();
  });
});

describe("E-218 (2c): DATEV-Feld 116 = Tag, der den ursprünglichen Zeitraum bestimmt (§ 18b UStG) – auch in einem anderen Geschäftsjahr", () => {
  /** Lieferung 20.10.2026, Rechnung erst 10.12.2026 → § 18b: spätestens Ende des Folgemonats, also 30.11.2026 */
  const spaet = () => rechnung(leer(), "r1", "2026-12-10", { leistung_gleich: false, leistung: "20.10.2026", hinweise: ["igl"], positionen: pos("1.000,00") });

  it("Feld 116 der Originalrechnung, des Stornos und der Ersatzrechnung = 30.11.2026 (nicht Rechnungsdatum, nicht Datum einer Abgabe)", () => {
    let s = storno(spaet(), "r1", "st1", "2027-01-15", "rechnung");
    s = ersatz(s, "r1", "r2", "2027-01-15", { kunde_ust_idnr: "ATU12345675" });
    const tage = zuordnungsTage(s.unterlagen, s.betrieb);
    expect([tage.get("r1"), tage.get("st1"), tage.get("r2")]).toEqual(["2026-11-30", "2026-11-30", "2026-11-30"]);
    // Dezember-Stapel 2026: nur die Originalrechnung
    const dez = paket(s, "2026-12");
    expect(dez.zeilen.map(kurz)).toEqual(["1000,00;S;1410;8125;;1012;30112026;ATU69876543"]);
    // Januar-Stapel 2027 (anderes Geschäftsjahr): Storno und Ersatz zum 15.01.2027, Feld 116 = 30.11.2026
    const jan = paket(s, "2027-01");
    expect(jan.kopf[12]).toBe("20270101");
    expect(jan.zeilen.map(kurz).sort()).toEqual(["1000,00;S;1410;8125;;1501;30112026;ATU12345675", "1000,00;S;1410;8125;;1501;30112026;ATU69876543"]);
    for (const f of jan.zeilen) expect(f[9]!.slice(2)).toBe("01"); // Belegdatum im Stapelzeitraum
    expect(jan.liesmich).toContain("anderen Geschäftsjahr");
    expect(jan.liesmich).toContain("Feld „Datum Zuord. Steuerperiode“ = 30.11.2026");
    // Voranmeldung und ZM: November 2026 berichtigt, Januar 2027 leer
    expect(kz(s, "2026-11", "soll")).toBe("1.000,00");
    expect(kz(s, "2027-01", "soll")).toBe("0,00");
    expect(zm(s, "2026-11")).toEqual([{ ust_idnr: "ATU12345675", art: "L", betrag_cent: 100000 }, { ust_idnr: "ATU69876543", art: "L", betrag_cent: 0 }]);
  });
});

describe("E-218 (2d): ältere Stornos innergemeinschaftlicher Lieferungen ohne Grund", () => {
  it("werden gefunden, der Grund lässt sich nachtragen (nicht gedruckt) und wirkt wie beim Stornieren gewählt", () => {
    let s = storno(lieferung(), "r1", "st1", "2026-11-05");
    s = ersatz(s, "r1", "r2", "2026-11-05", { kunde_ust_idnr: "ATU12345675" });
    expect(euStornosOhneGrund(s.unterlagen, s.betrieb).map((u) => u.id)).toEqual(["st1"]);
    expect(euBerichtigungen(s.unterlagen, s.betrieb)).toEqual([]);
    const vorher = s.unterlagen.find((u) => u.id === "st1")!;
    s = euStornoSetzen(s, "st1", { grund: "rechnung" }, t("2026-12-01"));
    const nachher = s.unterlagen.find((u) => u.id === "st1")!;
    expect(nachher.daten).toEqual(vorher.daten);
    expect(euStornosOhneGrund(s.unterlagen, s.betrieb)).toEqual([]);
    expect(euBerichtigungen(s.unterlagen, s.betrieb)[0]).toMatchObject({ stornoId: "st1", monat: "2026-09", zmFrist: "2026-12-05" });
    expect(zm(s, "2026-09")).toEqual([{ ust_idnr: "ATU12345675", art: "L", betrag_cent: 100000 }, { ust_idnr: "ATU69876543", art: "L", betrag_cent: 0 }]);
  });

  it("ein beim Stornieren gewählter Grund bleibt; EU-Leistungen erscheinen seit E-235 (Steuerberater, T-294) auch im Hinweis", () => {
    const s = storno(lieferung(), "r1", "st1", "2026-11-05", "betrag");
    expect(euStornoSetzen(s, "st1", { grund: "rechnung" }, t("2026-12-01"))).toBe(s);
    const leistung = storno(rechnung(leer(), "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["reverse_charge"], positionen: pos("300,00") }), "r1", "st1", "2026-11-05");
    expect(euStornosOhneGrund(leistung.unterlagen, leistung.betrieb).map((u) => u.id)).toEqual(["st1"]);
  });
});

describe("E-218 (2e): Skonto auf eine Anzahlung vor der Meldung mindert das Entgelt der Schlussrechnung", () => {
  /** igL-Abschlag 400 € vom 10.07., Schlussrechnung 15.09. über 1.000 € (Lieferung 10.09.) */
  const mitAbschlag = (zahlung: { datum: string; betrag_cent: number; minderung_cent: number }, schluss = true, betrieb = BETRIEB, kv?: Kontenvorgaben) => {
    let s = rechnung(leer(betrieb, kv), "a1", "2026-07-10", { nummer: "A-1", abschlag: true, hinweise: ["igl"], positionen: pos("400,00") });
    s = zahlungVermerken(s, "a1", { ...zahlung, art: "skonto" }, t(zahlung.datum));
    if (schluss) s = rechnung(s, "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: ["igl"], positionen: pos("1.000,00"), schluss: true, abschlaege: [{ nummer: "A-1", netto: "400,00", satz: "0" }] });
    return s;
  };

  it("vor der Meldung (Skonto 15.07.): keine negative Meldung im Juli, Kz 41 und ZM im September 980 € (vorher Juli −8 €, September 1.000 €)", () => {
    const s = mitAbschlag({ datum: "2026-07-15", betrag_cent: 39200, minderung_cent: 800 });
    for (const v of ["soll", "ist"] as const) {
      expect(kz(s, "2026-07", v)).toBe("0,00");
      expect(kz(s, "2026-09", v)).toBe("992,00");
    }
    expect(zmFuer(s.unterlagen, "2026-07", s.betrieb)!.zeilen).toEqual([]);
    expect(zm(s, "2026-09")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 99200 }]);
  });

  it("ohne Schlussrechnung mindert das Skonto noch nirgends", () => {
    const s = mitAbschlag({ datum: "2026-07-15", betrag_cent: 39200, minderung_cent: 800 }, false);
    expect(kz(s, "2026-07", "soll")).toBe("0,00");
    expect(zmFuer(s.unterlagen, "2026-07", s.betrieb)!.zeilen).toEqual([]);
  });

  it("nach der Meldung (Skonto 05.10.): Minderung im Oktober, September bleibt 1.000 €", () => {
    const s = mitAbschlag({ datum: "2026-10-05", betrag_cent: 39200, minderung_cent: 800 });
    expect(kz(s, "2026-09", "soll")).toBe("1.000,00");
    expect(kz(s, "2026-10", "soll")).toBe("-8,00");
    expect(zm(s, "2026-10")).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: -800 }]);
  });
});

describe("E-218 (3): DATEV-Stapel – Anzahlungen auf EU-Umsätze nicht zum Zahltag auf das Erlöskonto", () => {
  const abschlagUndSchluss = (betrieb = BETRIEB, kv?: Kontenvorgaben, skonto = false, art: "igl" | "reverse_charge" = "igl") => {
    let s = rechnung(leer(betrieb, kv), "a1", "2026-07-10", { nummer: "A-1", abschlag: true, hinweise: [art], positionen: pos("400,00") });
    s = skonto ? zahlungVermerken(s, "a1", { datum: "2026-07-15", betrag_cent: 39200, minderung_cent: 800, art: "skonto" }, t("2026-07-15")) : bezahltSetzen(s, "a1", "2026-07-15", t("2026-07-15"));
    return rechnung(s, "r1", "2026-09-15", { leistung_gleich: false, leistung: "10.09.2026", hinweise: [art], positionen: pos("1.000,00"), schluss: true, abschlaege: [{ nummer: "A-1", netto: "400,00", satz: "0" }] });
  };

  it("Gewinnermittlung aus dem bestehenden Merkmal: GmbH bilanziert, Einzelunternehmen EÜR, Kontenvorgabe geht vor", () => {
    expect(bilanzierendeGewinnermittlung(leer(GMBH))).toBe(true);
    expect(bilanzierendeGewinnermittlung(leer(BETRIEB))).toBe(false);
    expect(bilanzierendeGewinnermittlung(leer(GMBH, { gewinnermittlung: "euer" }))).toBe(false);
    expect(bilanzierendeGewinnermittlung({ ...leer(BETRIEB), profil: { "steuern.buchfuehrung_mitteilung": true } })).toBe(true);
  });

  it("Bilanz (SKR03): Anzahlung zum Zahltag 1410 an 1710 ohne Steuerschlüssel und ohne Feld 116; Schlussrechnung volles Entgelt auf 8125 mit Feld 116, Verrechnung 1710 an 1410", () => {
    const s = abschlagUndSchluss(GMBH);
    expect(paket(s, "2026-07").zeilen.map(kurz)).toEqual(["400,00;S;1410;1710;;1507;;"]);
    expect(paket(s, "2026-09").zeilen.map(kurz).sort()).toEqual(["1000,00;S;1410;8125;;1509;15092026;ATU69876543", "400,00;S;1710;1410;;1509;;"]);
    expect(paket(s, "2026-09").liesmich).toContain("„Erhaltene Anzahlungen auf Bestellungen“ (1710)");
  });

  it("Bilanz (SKR04) mit EU-Leistung: 3250 und 4336", () => {
    const s = abschlagUndSchluss(GMBH, undefined, false, "reverse_charge");
    expect(paket(s, "2026-07", "SKR04").zeilen.map(kurz)).toEqual(["400,00;S;1210;3250;;1507;;"]);
    expect(paket(s, "2026-09", "SKR04").zeilen.map(kurz).sort()).toEqual(["1000,00;S;1210;4336;;1509;10092026;ATU69876543", "400,00;S;3250;1210;;1509;;"]);
    expect(BUCHUNGSKONTEN.SKR03.anzahlungenErhalten).toBe("1710");
    expect(BUCHUNGSKONTEN.SKR04.anzahlungenErhalten).toBe("3250");
  });

  it("Bilanz mit Skonto vor der Meldung: Skonto zum Zahltag gegen 1710 (ohne Steuer), mit der Schlussrechnung auf 8743 mit Feld 116 der Schlussrechnung; Forderungen und 1710 gehen auf", () => {
    const s = abschlagUndSchluss(GMBH, undefined, true);
    const jul = paket(s, "2026-07");
    expect(jul.zeilen.map(kurz).sort()).toEqual(["400,00;S;1410;1710;;1507;;", "8,00;S;1710;1410;;1507;;"]);
    const sep = paket(s, "2026-09");
    expect(sep.zeilen.map(kurz).sort()).toEqual(["1000,00;S;1410;8125;;1509;15092026;ATU69876543", "392,00;S;1710;1410;;1509;;", "8,00;S;8743;1410;;1509;15092026;ATU69876543"]);
    // Salden über beide Stapel (ohne Bankbuchungen): 1710 = 0, Erlöse netto 992 €
    const alle = [...jul.zeilen, ...sep.zeilen];
    const saldo = (konto: string) => alle.reduce((a, f) => a + (f[6] === konto ? 1 : f[7] === konto ? -1 : 0) * (f[1]!.replace(/"/g, "") === "S" ? 1 : -1) * Number(f[0]!.replace(",", ".")), 0);
    expect(saldo("1710")).toBe(0);
    expect(-saldo("8125") - saldo("8743")).toBe(992);
    expect(sep.liesmich).toContain("§ 10 Abs. 1 UStG");
  });

  it("EÜR ohne Konto in den Kontenvorgaben: keine Buchung auf 8125 zum Zahltag, Anzahlung fehlt im Stapel – LIESMICH sagt es deutlich; kein erfundenes Standardkonto", () => {
    expect(BUCHUNGSKONTEN.SKR03.anzahlungEuEuer).toBe("");
    expect(kontenFuer("SKR04").anzahlungEuEuer).toBe("");
    const s = abschlagUndSchluss();
    const jul = paket(s, "2026-07");
    expect(jul.zeilen).toEqual([]);
    expect(jul.liesmich).toContain("FEHLEN diese Buchungen im Stapel");
    expect(jul.liesmich).toContain("Anzahlung (Einnahme, § 11 EStG) zum Zahltag am 15.07.2026 über 400,00 € (RE A-1)");
    const sep = paket(s, "2026-09");
    expect(sep.zeilen.map(kurz)).toEqual(["600,00;S;1410;8125;;1509;15092026;ATU69876543"]);
    expect(sep.liesmich).toContain("Umbuchung der Anzahlungen auf das Erlöskonto am 15.09.2026 über 400,00 €");
  });

  it("EÜR mit Konto aus den Kontenvorgaben: Anzahlung zum Zahltag auf dieses Konto, Umbuchung mit der Schlussrechnung auf 8125 mit Feld 116; Skonto vor der Meldung mindert den umgebuchten Betrag", () => {
    expect(KONTENVORGABE_FELDER.some((f) => f.id === "anzahlungEuEuer")).toBe(true);
    const kv: Kontenvorgaben = { konten: { anzahlungEuEuer: "8955" } };
    const s = abschlagUndSchluss(BETRIEB, kv);
    expect(paket(s, "2026-07").zeilen.map(kurz)).toEqual(["400,00;S;1410;8955;;1507;;"]);
    expect(paket(s, "2026-09").zeilen.map(kurz).sort()).toEqual(["400,00;S;8955;8125;;1509;15092026;ATU69876543", "600,00;S;1410;8125;;1509;15092026;ATU69876543"]);
    const mitSkonto = abschlagUndSchluss(BETRIEB, kv, true);
    expect(paket(mitSkonto, "2026-07").zeilen.map(kurz).sort()).toEqual(["400,00;S;1410;8955;;1507;;", "8,00;S;8955;1410;;1507;;"]);
    expect(paket(mitSkonto, "2026-09").zeilen.map(kurz).sort()).toEqual(["392,00;S;8955;8125;;1509;15092026;ATU69876543", "600,00;S;1410;8125;;1509;15092026;ATU69876543"]);
  });

  it("Inlands-Abschläge bleiben unverändert auf dem Erlöskonto zum Zahltag", () => {
    let s = rechnung(leer(GMBH), "a1", "2026-07-10", { nummer: "A-1", abschlag: true, kunde_ust_idnr: "", kunde_anschrift: "Weg 2\n10115 Berlin", positionen: [{ bezeichnung: "Anzahlung", menge: "1", einheit: "Stück", preis: "100,00", satz: "19" }] });
    s = bezahltSetzen(s, "a1", "2026-07-15", t("2026-07-15"));
    expect(paket(s, "2026-07").zeilen.map((f) => [f[6], f[7]].join(";"))).toEqual(["1410;8400"]);
  });
});
