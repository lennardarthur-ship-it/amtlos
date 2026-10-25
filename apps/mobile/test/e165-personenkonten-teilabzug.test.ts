/**
 * E-165 (StB-Prüfung Steuerberatungskanzlei, Abschnitt 10 Prio 3) im Stand und im Steuerberater-Paket: Personenkonten
 * (A-3) mit dauerhaft gespeicherten Nummern, Stammdaten-Datei und LIESMICH; Vorsteuer-Teilabzug je Beleg (5.2) in
 * Voranmeldung, EÜR, Stapel und Belegliste; Hinweis auf Umsätze außerhalb der App (Praxis); Migration 7 → 8.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { syncZusammenfuehren } from "../src/konto/sync";
import { LEERER_STAND, MIGRATIONEN, anlegen, ausgeben, belegSetzen, felderSetzen, standAus, type Stand } from "../src/unterlagen/speicher";
import { euerUebernahme, kreditorenBelege, personenkontenListe, personenkontenVergeben, steuerpaket } from "../src/unterlagen/steuerpaket";
import { gemischteUmsaetze, umsaetzeFuer, vorsteuerquoteAus } from "../src/unterlagen/ustAusRechnungen";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "31877", mandantennummer: "20514" };
const JAHR = { von: "2026-01-01", bis: "2026-12-31", name: "2026" };
const datei = (p: { zip: Uint8Array }, n: string) => strFromU8(unzipSync(p.zip)[n]!);
const latin1 = (p: { zip: Uint8Array }, n: string) => Buffer.from(unzipSync(p.zip)[n]!).toString("latin1");
const zeilenAus = (p: { zip: Uint8Array }) => latin1(p, "EXTF_Buchungsstapel_2026.csv").split("\r\n").slice(2, -1).map((x) => x.split(";"));

function rechnung(s: Stand, id: string, datum: string, kunde: string, anschrift: string, preis: string, extra: Record<string, unknown> = {}): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: kunde, kunde_anschrift: anschrift, positionen: [{ bezeichnung: "Leistung", menge: "1", einheit: "", preis, satz: "19" }], ...extra }, t(datum));
  return ausgeben(s2, id, t(datum));
}
const beleg = (id: string, datum: string, lieferant: string, brutto: number, zahlung: "bank" | "bar" = "bank", extra: Record<string, unknown> = {}) => ({ id, datum, lieferant, nummer: `${id.toUpperCase()}-1`, kategorie: "sonstiges", steuer: [{ satz: 19, brutto_cent: brutto }], vorsteuer: true, zahlung, erstellt: `${datum}T10:00:00Z`, geaendert: `${datum}T10:00:00Z`, ...extra });

function betrieb(personenkonten?: boolean): Stand {
  const sb = { ...SB, ...(personenkonten === undefined ? {} : { kontenvorgaben: { personenkonten } }) };
  let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Elbe Design", strasse: "Markt 1", plz: "01067", ort: "Dresden", steuernummer: "203/100/10000", versteuerung: "soll" }, steuerberatung: sb };
  s = rechnung(s, "r2", "2026-03-02", "Zweite Kundin GmbH", "Ringstraße 3\n04109 Leipzig", "200,00");
  s = rechnung(s, "r1", "2026-02-10", "Elbstudio GmbH", "Hafenstraße 3\n20457 Hamburg", "100,00");
  s = rechnung(s, "r3", "2026-04-01", "ELBSTUDIO GmbH", "Hafenstraße 3\n20457 Hamburg", "50,00");
  s = belegSetzen(s, beleg("b1", "2026-02-12", "Glanzwerk GmbH", 11900), t("2026-02-12"));
  s = belegSetzen(s, beleg("b2", "2026-02-13", "Bäckerei Bar", 1190, "bar"), t("2026-02-13"));
  s = belegSetzen(s, beleg("b3", "2026-05-01", "glanzwerk gmbh", 23800), t("2026-05-01"));
  return s;
}

describe("A-3 Personenkonten im Stand", () => {
  it("Migration 7 → 8: leeres Lieferanten-Verzeichnis; gelesen bleibt es erhalten", () => {
    expect(MIGRATIONEN[7]!({ version: 7 })).toEqual({ version: 7, lieferanten: [] });
    expect(standAus(JSON.stringify({ version: 7, kunden: [] })).lieferanten).toEqual([]);
    const s = standAus(JSON.stringify({ ...LEERER_STAND, lieferanten: [{ id: "l1", name: "Glanzwerk GmbH", personenkonto: "70000" }] }));
    expect(s.lieferanten).toEqual([{ id: "l1", name: "Glanzwerk GmbH", personenkonto: "70000" }]);
  });

  it("ohne Kontenvorgabe keine Nummern; mit Kontenvorgabe je Kunde und Lieferant einmal, nach erstem Auftreten", () => {
    const standard = betrieb();
    expect(personenkontenVergeben(standard)).toBe(standard);
    const ohne = betrieb(false);
    expect(personenkontenVergeben(ohne)).toBe(ohne);
    const s = personenkontenVergeben(betrieb(true), t("2026-06-01"));
    // Elbstudio (10.02.) vor der Zweiten Kundin (02.03.); „ELBSTUDIO GmbH“ ist derselbe Kunde; Barbeleg ohne Kreditor
    expect(personenkontenListe(s).map((e) => [e.konto, e.name, e.art])).toEqual([
      ["10000", "Elbstudio GmbH", "debitor"],
      ["10001", "Zweite Kundin GmbH", "debitor"],
      ["70000", "Glanzwerk GmbH", "kreditor"],
    ]);
    expect(s.kunden.find((k) => k.personenkonto === "10000")?.anschrift).toBe("Hafenstraße 3\n20457 Hamburg");
    expect([...kreditorenBelege(s)].sort()).toEqual([["b1", "70000"], ["b3", "70000"]]);
    // zweimal vergeben ändert nichts
    expect(personenkontenVergeben(s)).toBe(s);
    // ein neuer, früherer Kunde verschiebt keine vergebene Nummer
    const s2 = personenkontenVergeben(rechnung(s, "r0", "2026-01-05", "Frühkunde KG", "Weg 1\n01069 Dresden", "10,00"));
    expect(personenkontenListe(s2).map((e) => [e.konto, e.name])).toEqual([["10000", "Elbstudio GmbH"], ["10001", "Zweite Kundin GmbH"], ["10002", "Frühkunde KG"], ["70000", "Glanzwerk GmbH"]]);
  });

  it("Synchronisation: das Lieferanten-Verzeichnis geht nicht verloren", () => {
    const a = personenkontenVergeben(betrieb(true), t("2026-06-01"));
    const r = syncZusammenfuehren({ ...a, lieferanten: [] }, a);
    expect(r.stand.lieferanten.map((l) => l.personenkonto)).toEqual(["70000"]);
  });
});

describe("A-3 Personenkonten im Steuerberater-Paket", () => {
  it("Standard aus: Sammelkonten 1410/1610, keine Stammdaten-Datei", () => {
    const p = steuerpaket(betrieb(), JAHR, SB, {}, "2027-02-15T10:00:00");
    expect(Object.keys(unzipSync(p.zip)).some((n) => n.startsWith("EXTF_Debitoren"))).toBe(false);
    const z = zeilenAus(p);
    expect(z.filter((f) => f[6] === "1410").length).toBe(3);
    expect(z.filter((f) => f[6] === "1610").length).toBe(2);
  });

  it("eingeschaltet: Debitor an Erlös, Sachkonto an Kreditor, Belegfeld 1 = Nummer; Stammdaten EXTF Kategorie 16; LIESMICH erklärt", () => {
    const sb = { ...SB, kontenvorgaben: { personenkonten: true } };
    const p = steuerpaket(betrieb(true), JAHR, sb, {}, "2027-02-15T10:00:00");
    const z = zeilenAus(p);
    expect(z.filter((f) => f[6] === "1410" || f[6] === "1610")).toEqual([]);
    expect(z.filter((f) => f[6] === "10000").map((f) => [f[0], f[7], f[10]])).toEqual([["119,00", "8400", '"2026-002"'], ["59,50", "8400", '"2026-003"']]);
    expect(z.filter((f) => f[6] === "70000").map((f) => [f[0], f[1], f[7], f[8], f[10]])).toEqual([["119,00", '"H"', "4900", '"9"', '"B1-1"'], ["238,00", '"H"', "4900", '"9"', '"B3-1"']]);
    // Barbeleg bleibt gegen Privateinlage (keine Kasse in der App)
    expect(z.find((f) => f[10] === '"B2-1"')![6]).toBe("1890");
    const stamm = latin1(p, "EXTF_Debitoren_Kreditoren_2026.csv").split("\r\n");
    expect(stamm[0]!.startsWith('"EXTF";700;16;"Debitoren/Kreditoren";5;')).toBe(true);
    expect(stamm.slice(2, -1).map((x) => x.split(";").slice(0, 2))).toEqual([["10000", '"Elbstudio GmbH"'], ["10001", '"Zweite Kundin GmbH"'], ["70000", '"Glanzwerk GmbH"']]);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Personenkonten (Kontenvorgabe): Rechnungen, Skonto und Gutschriften stehen auf dem Personenkonto des Kunden (Debitoren 10000–69999)");
    expect(l).toContain("EXTF_Debitoren_Kreditoren_2026.csv");
    expect(l).toContain("Personenkonten für Kunden und Lieferanten: ja");
    expect(l).toContain("Forderungen und Verbindlichkeiten gehen auf Personenkonten");
  });

  it("bilanzierend mit Ist-Versteuerung: Feld 116 unverändert, LIESMICH empfiehlt Personenkonten mit OPOS", () => {
    const gmbh = (pk: boolean) => ({ ...betrieb(pk), betrieb: { ...betrieb(pk).betrieb, name: "Elbe Design GmbH", rechtsform: "GmbH", versteuerung: "ist" } });
    const aus = datei(steuerpaket(gmbh(false), JAHR, { ...SB, kontenvorgaben: { personenkonten: false } }, {}, "2027-02-15T10:00:00"), "LIESMICH.txt");
    expect(aus).toContain("Empfohlene Einrichtung laut Kanzlei für Ist-Versteuerung mit Bilanzierung: Personenkonten mit OPOS");
    const sb = { ...SB, kontenvorgaben: { personenkonten: true } };
    const p = steuerpaket(gmbh(true), JAHR, sb, {}, "2027-02-15T10:00:00");
    const an = datei(p, "LIESMICH.txt");
    expect(an).toContain("Personenkonten sind eingeschaltet (Kontenvorgabe) – die empfohlene Einrichtung");
    // Soll-Stapel nach Rechnungsdatum, Saldo über die Debitoren
    expect(an).toContain("Saldo 1410 bzw. Debitoren aus diesem Stapel zum 31.12.2026: 416,50 €");
  });
});

describe("5.2 Vorsteuer-Teilabzug je Beleg", () => {
  function praxis(): Stand {
    let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Physio am Markt", versteuerung: "ist", vorsteuerquote: "13" }, steuerberatung: SB };
    s = belegSetzen(s, beleg("b1", "2026-03-10", "Glanzwerk GmbH", 119000, "bank", { vorsteuer_anteil: 13, bezahlt: "2026-03-12" }), t("2026-03-10"));
    s = belegSetzen(s, beleg("b2", "2026-03-11", "Therapiebedarf", 11900, "bank", { bezahlt: "2026-03-12" }), t("2026-03-11"));
    return s;
  }

  it("Voranmeldung: 24,70 € (13 % von 190,00 €) + 19,00 € voll = 43,70 € Vorsteuer", () => {
    const u = umsaetzeFuer(praxis().unterlagen, "2026-Q1", praxis().betrieb, "ist", praxis().belege, false);
    expect(u?.werte.vorsteuer).toBe("43,70");
  });

  it("EÜR: nicht abziehbare Vorsteuer (165,30 €) als Ausgabe, gezahlte Vorsteuer 43,70 €", () => {
    const e = euerUebernahme(praxis(), "2026");
    expect(e.ausgaben.find((a) => a.kategorie === "Gezahlte Vorsteuerbeträge")?.betrag).toBe("43,70");
    // Sonstiges: 1.190,00 − 24,70 + 100,00 = 1.265,30
    expect(e.ausgaben.find((a) => (a.text ?? "").startsWith("Sonstiges"))?.betrag).toBe("1.265,30");
  });

  it("Stapel: zwei Zeilen für den anteiligen Beleg; Belegliste nennt den Anteil; LIESMICH erklärt", () => {
    const p = steuerpaket(praxis(), JAHR, SB, {}, "2027-02-15T10:00:00");
    const z = zeilenAus(p).filter((f) => f[10] === '"B1-1"');
    expect(z.map((f) => [f[0], f[7], f[8]])).toEqual([["154,70", "4900", '"9"'], ["1035,30", "4900", ""]]);
    const be = datei(p, "Belege_2026.csv");
    expect(be).toContain("anteilig: 13 % (24,70 € abziehbar)");
    expect(be).toMatch(/;voll\r\n/);
    expect(datei(p, "LIESMICH.txt")).toContain("1 Beleg ist nur teilweise zum Vorsteuerabzug berechtigt (§ 15 Abs. 4 UStG");
  });

  it("gemischte Umsätze und Vorsteuerquote erkennen", () => {
    expect(vorsteuerquoteAus({ vorsteuerquote: "12,5" })).toBe(12.5);
    expect(vorsteuerquoteAus({ vorsteuerquote: "" })).toBeNull();
    expect(vorsteuerquoteAus({ vorsteuerquote: "120" })).toBeNull();
    expect(gemischteUmsaetze([], { ...LEERER_STAND.betrieb, vorsteuerquote: "13" })).toBe(true);
    expect(gemischteUmsaetze([], LEERER_STAND.betrieb)).toBe(false);
    let s: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Physio" } };
    s = rechnung(s, "r1", "2026-02-01", "Patientin", "Weg 1\n04109 Leipzig", "60,00", { befreiung: "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG.", positionen: [{ bezeichnung: "KG", menge: "1", einheit: "", preis: "60,00", satz: "0" }] });
    expect(gemischteUmsaetze(s.unterlagen, s.betrieb)).toBe(false);
    s = rechnung(s, "r2", "2026-02-02", "Wellnessgast", "Weg 2\n04109 Leipzig", "50,00");
    expect(gemischteUmsaetze(s.unterlagen, s.betrieb)).toBe(true);
    // Praxis: LIESMICH nennt Umsätze außerhalb der App (Abrechnungszentrum, Zuzahlungen)
    expect(datei(steuerpaket(s, JAHR, SB, {}, "2027-02-15T10:00:00"), "LIESMICH.txt")).toContain("Sammelauszahlungen eines Abrechnungszentrums für Kassenpatienten");
    expect(datei(steuerpaket(betrieb(), JAHR, SB, {}, "2027-02-15T10:00:00"), "LIESMICH.txt")).not.toContain("Abrechnungszentrum");
  });
});
