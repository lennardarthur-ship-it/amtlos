/**
 * E-165 (StB-Prüfung Steuerberatungskanzlei, Abschnitt 10 Prio 3): Personenkonten für Kunden und Lieferanten (A-3) und
 * Vorsteuer-Teilabzug je Beleg (5.2, § 15 Abs. 4 UStG). Erwartungswerte von Hand gerechnet (siehe Kommentare).
 */
import { describe, expect, it } from "vitest";
import { ausgabenFuer, belegAus, belegFassung, belegSummen, steuerschuldFuer, vorsteuerAnteilAus, vorsteuerAufteilung, vorsteuerFuer, type Beleg } from "../src/belege.js";
import { buchungenAusBelegen, buchungenAusRechnungen, datevExtf, skontoBuchungenBelege, skontoBuchungenRechnung, teilenNachVorsteuer, zahlungsBuchungenRechnung, type AusgangsRechnungFuerBuchung } from "../src/buchungen.js";
import { belegAusERechnung, type GeleseneRechnung } from "../src/erechnungLesen.js";
import { kontenvorgabenAus, kontenvorgabenAusJson, kontenvorgabenGesetzt, kontenvorgabenJson } from "../src/kontenvorgaben.js";
import { DEBKRED_SPALTEN, anschriftTeile, datevDebitorenKreditoren, gleicherPartner, istPersonenkonto, naechstesPersonenkonto, partnerName } from "../src/personenkonten.js";

const BELEG: Beleg = { id: "b1", datum: "2026-03-10", lieferant: "Glanzwerk Gebäudeservice GmbH", nummer: "GW-26-0310", kategorie: "sonstiges", steuer: [{ satz: 19, brutto_cent: 119000 }], vorsteuer: true, zahlung: "bank", erstellt: "2026-03-10", geaendert: "2026-03-10" };
const EXPORT = { beraternummer: "31877", mandantennummer: "20514", wjBeginn: "2026-01-01", von: "2026-01-01", bis: "2026-12-31", kontenrahmen: "SKR03" as const, erzeugtAm: "2027-02-15T10:00:00" };
const RE: AusgangsRechnungFuerBuchung = { id: "r1", nummer: "2026-017", datum: "2026-12-11", art: "rechnung", kleinunternehmer: false, kunde: "Elbstudio GmbH", positionen: [{ bezeichnung: "Shooting", menge: 1, einheit: "stunde", preis_cent: 100000, ust_satz: 19 }] };

describe("5.2 Vorsteuer-Teilabzug je Beleg", () => {
  it("13 % von 190,00 € Vorsteuer: abziehbar 24,70 €, Rest 165,30 € ist Betriebsausgabe", () => {
    const b = { ...BELEG, vorsteuer_anteil: 13 };
    expect(vorsteuerAufteilung(b)).toEqual([{ satz: 19, ust_cent: 19000, abziehbar_cent: 2470 }]);
    expect(belegSummen(b)).toEqual({ brutto_cent: 119000, netto_cent: 100000, ust_cent: 19000, vorsteuer_cent: 2470 });
    // Voranmeldung: nur der abziehbare Teil
    expect(vorsteuerFuer([b], "2026-03-01", "2026-03-31")).toMatchObject({ cent: 2470, anzahl: 1, ohne: 0 });
    // EÜR: 1.190,00 − 24,70 = 1.165,30 € Ausgabe, 24,70 € gezahlte Vorsteuer
    const a = ausgabenFuer([b], "2026");
    expect(a.vorsteuer_cent).toBe(2470);
    expect(a.summe_cent).toBe(116530);
  });

  it("Betrag statt Prozent: 50,00 € abziehbar; bei zwei Sätzen nach der Steuer verteilt", () => {
    expect(belegSummen({ ...BELEG, vorsteuer_betrag_cent: 5000 }).vorsteuer_cent).toBe(5000);
    // 19 %: 119,00 brutto → 19,00 Steuer; 7 %: 107,00 brutto → 7,00 Steuer; 13,00 € abziehbar: 19/26 und 7/26
    const zwei = vorsteuerAufteilung({ ...BELEG, steuer: [{ satz: 19, brutto_cent: 11900 }, { satz: 7, brutto_cent: 10700 }], vorsteuer_betrag_cent: 1300 });
    expect(zwei).toEqual([{ satz: 19, ust_cent: 1900, abziehbar_cent: 950 }, { satz: 7, ust_cent: 700, abziehbar_cent: 350 }]);
    expect(zwei.reduce((x, t) => x + t.abziehbar_cent, 0)).toBe(1300);
  });

  it("ohne Vorsteuerabzug zählt der Anteil nicht; gespeicherter Anteil wird geprüft (0 < x < 100, zwei Stellen)", () => {
    expect(belegSummen({ ...BELEG, vorsteuer: false, vorsteuer_anteil: 13 }).vorsteuer_cent).toBe(0);
    expect(vorsteuerAnteilAus("12,5")).toBe(12.5);
    expect(vorsteuerAnteilAus(100)).toBeNull();
    expect(vorsteuerAnteilAus(0)).toBeNull();
    expect(vorsteuerAnteilAus(13.456)).toBe(13.46);
    expect(belegAus({ ...BELEG, vorsteuer_anteil: 13 })?.vorsteuer_anteil).toBe(13);
    expect(belegAus({ ...BELEG, vorsteuer_anteil: 140 })?.vorsteuer_anteil).toBeUndefined();
    // Betrag geht vor Prozent
    expect(belegAus({ ...BELEG, vorsteuer_anteil: 13, vorsteuer_betrag_cent: 5000 })).toMatchObject({ vorsteuer_betrag_cent: 5000 });
    expect(belegAus({ ...BELEG, vorsteuer_anteil: 13, vorsteuer_betrag_cent: 5000 })?.vorsteuer_anteil).toBeUndefined();
    // gehört zum Inhalt (Änderungsprotokoll)
    expect(belegFassung({ ...BELEG, vorsteuer_anteil: 13 }, "2026-03-11T08:00:00Z").vorsteuer_anteil).toBe(13);
  });

  it("§ 13b anteilig: Steuer 77,52 € (Kz 47) voll, Vorsteuer (Kz 67) nur 13 % = 10,08 €", () => {
    const b: Beleg = { ...BELEG, id: "b13b", lieferant: "CloudOffice Ireland Ltd.", kategorie: "buero", steuer: [{ satz: 0, brutto_cent: 40800 }], steuerschuld: "eu", vorsteuer_anteil: 13 };
    const r = steuerschuldFuer([b], "2026-03-01", "2026-03-31");
    expect(r).toMatchObject({ eu_netto_cent: 40800, eu_steuer_cent: 7752, vorsteuer_cent: 1008 });
  });

  it("DATEV: zwei Zeilen – 154,70 € mit BU 9 (DATEV rechnet 24,70 € Vorsteuer), 1.035,30 € ohne BU, je mit eigener GUID", () => {
    const z = buchungenAusBelegen([{ ...BELEG, vorsteuer_anteil: 13 }], "SKR03");
    expect(z.map((x) => [x.betrag_cent, x.soll_haben, x.konto, x.gegenkonto, x.bu_schluessel])).toEqual([
      [15470, "H", "1610", "4900", "9"],
      [103530, "H", "1610", "4900", ""],
    ]);
    // Vorsteuer, die DATEV aus der BU-9-Zeile rechnet: 154,70 × 19 / 119 = 24,70
    expect(Math.round((15470 * 19) / 119)).toBe(2470);
    expect(new Set(z.map((x) => x.guid)).size).toBe(2);
    expect(z.reduce((a, x) => a + x.betrag_cent, 0)).toBe(119000);
    // ohne Teilabzug unverändert eine Zeile
    expect(buchungenAusBelegen([BELEG], "SKR03")).toHaveLength(1);
    // Automatikkonto (Wareneingang 3400): nicht abziehbarer Teil mit BU 40
    const w = buchungenAusBelegen([{ ...BELEG, kategorie: "waren", vorsteuer_anteil: 13 }], "SKR03");
    expect(w.map((x) => [x.gegenkonto, x.bu_schluessel])).toEqual([["3400", ""], ["3400", "40"]]);
    expect(datevExtf(z, EXPORT).split("\r\n")).toHaveLength(5);
  });

  it("DATEV § 13b anteilig: 53,05 € auf 3123 (mit Vorsteuer, 19 % = 10,08 €), 354,95 € auf 3143 (ohne)", () => {
    const z = buchungenAusBelegen([{ ...BELEG, id: "b13b", kategorie: "buero", steuer: [{ satz: 0, brutto_cent: 40800 }], steuerschuld: "eu", vorsteuer_anteil: 13 }], "SKR03");
    expect(z.map((x) => [x.betrag_cent, x.gegenkonto, x.bu_schluessel])).toEqual([[5305, "3123", ""], [35495, "3143", ""]]);
    expect(Math.round(5305 * 0.19)).toBe(1008);
    expect(teilenNachVorsteuer(40800, 0, 1008, true)).toEqual({ mit: 5305, ohne: 35495 });
  });

  it("Skonto auf einen Beleg mit Teilabzug: Minderung im Verhältnis – abziehbarer Teil mit BU, Rest ohne", () => {
    // Skonto 23,80 € brutto (20,00 + 3,80 Steuer); abziehbar 13 % von 3,80 = 0,49 → 0,49 × 119/19 = 3,07 brutto mit BU
    const z = skontoBuchungenBelege([{ ...BELEG, vorsteuer_anteil: 13, skonto_cent: 2380, bezahlt: "2026-03-20" }], "SKR03");
    expect(z.map((x) => [x.betrag_cent, x.gegenkonto, x.bu_schluessel])).toEqual([[307, "4900", "9"], [2073, "4900", ""]]);
    const v = vorsteuerFuer([{ ...BELEG, vorsteuer_anteil: 13, skonto_cent: 2380, bezahlt: "2026-03-20" }], "2026-03-01", "2026-03-31");
    expect(v.skonto_cent).toBe(-49);
    expect(v.cent).toBe(2470 - 49);
  });

  it("E-Rechnung bei gemischten Umsätzen: mit Vorsteuerquote anteilig, ohne Quote zunächst aus", () => {
    const r: GeleseneRechnung = { format: "ubl", typcode: "380", nummer: "MTE-1", datum: "2026-02-05", faellig: null, lieferant: { name: "Medizintechnik Elbe GmbH", ust_idnr: "DE 281904437", steuernummer: null, iban: null, strasse: "Großenhainer Straße 99", plz: "01127", ort: "Dresden" }, empfaenger: { name: "Physio" }, waehrung: "EUR", summen: { netto_cent: 100000, ust_cent: 19000, brutto_cent: 119000, zu_zahlen_cent: 119000 }, saetze: [{ satz: 19, netto_cent: 100000, ust_cent: 19000, kategorie: "S" }], positionen: [], verwendungszweck: null, hinweise: [] };
    const mit = belegAusERechnung(r, "x", "2026-02-06T08:00:00Z", { gemischt: true, vorsteuerquote: 13 });
    expect(mit).toMatchObject({ vorsteuer: true, vorsteuer_anteil: 13, lieferant_ust_idnr: "DE281904437", lieferant_anschrift: "Großenhainer Straße 99\n01127 Dresden" });
    expect(mit.notiz).toMatch(/anteilig 13 %/);
    const ohne = belegAusERechnung(r, "x", "2026-02-06T08:00:00Z", { gemischt: true });
    expect(ohne.vorsteuer).toBe(false);
    expect(ohne.notiz).toMatch(/zunächst ausgeschaltet/);
    // nur steuerfreie Umsätze: aus wie bisher; ohne Angabe: an
    expect(belegAusERechnung(r, "x", "2026-02-06T08:00:00Z", { nurSteuerfrei: true, gemischt: true, vorsteuerquote: 13 }).vorsteuer).toBe(false);
    expect(belegAusERechnung(r, "x", "2026-02-06T08:00:00Z").vorsteuer).toBe(true);
  });
});

describe("A-3 Personenkonten", () => {
  it("Nummernkreise nach DATEV-Standard: Debitoren 10000–69999, Kreditoren 70000–99999, fortlaufend", () => {
    expect(istPersonenkonto("10000", "debitor")).toBe(true);
    expect(istPersonenkonto("70000", "debitor")).toBe(false);
    expect(istPersonenkonto("70000", "kreditor")).toBe(true);
    expect(istPersonenkonto("1410")).toBe(false);
    expect(naechstesPersonenkonto([], "debitor")).toBe("10000");
    expect(naechstesPersonenkonto(["10000", "10004", "70002", null], "debitor")).toBe("10005");
    expect(naechstesPersonenkonto(["10000"], "kreditor")).toBe("70000");
    expect(naechstesPersonenkonto(["99999"], "kreditor")).toBeNull();
  });

  it("derselbe Partner: gleiche USt-IdNr. oder – ohne – gleicher Name (Groß-/Kleinschreibung, Umlaute, Satzzeichen)", () => {
    expect(partnerName("Glanzwerk  Gebäudeservice GmbH.")).toBe("glanzwerk gebaeudeservice gmbh");
    expect(gleicherPartner({ name: "Müller KG" }, { name: "MUELLER KG" })).toBe(true);
    expect(gleicherPartner({ name: "A", ust_idnr: "DE 123456789" }, { name: "B", ust_idnr: "DE123456789" })).toBe(true);
    expect(gleicherPartner({ name: "Müller KG", ust_idnr: "DE1" }, { name: "Müller KG", ust_idnr: "DE2" })).toBe(false);
  });

  it("Rechnung, Skonto und Zahlungseingang auf dem Debitor; Gutschrift auf dem Kreditor; Belegfeld 1 = Rechnungsnummer", () => {
    const r = { ...RE, personenkonto: "10003" };
    const [erloes] = buchungenAusRechnungen([r], "SKR03");
    expect([erloes!.konto, erloes!.gegenkonto, erloes!.belegfeld1, erloes!.betrag_cent]).toEqual(["10003", "8400", "2026-017", 119000]);
    const [skonto] = skontoBuchungenRechnung(r, [{ id: "z1", datum: "2026-12-20", brutto_cent: 2380 }], "SKR03");
    expect([skonto!.konto, skonto!.gegenkonto]).toEqual(["8736", "10003"]);
    const [zahlung] = zahlungsBuchungenRechnung(r, [{ id: "z1", datum: "2026-12-20", betrag_cent: 116620 }], "SKR03");
    expect([zahlung!.konto, zahlung!.gegenkonto, zahlung!.belegfeld1]).toEqual(["1200", "10003", "2026-017"]);
    const [gs] = buchungenAusRechnungen([{ ...RE, gutschrift: true, personenkonto: "70001" }], "SKR03");
    expect([gs!.konto, gs!.gegenkonto]).toEqual(["70001", "3100"]);
    // ohne Personenkonto wie bisher
    expect(buchungenAusRechnungen([RE], "SKR03")[0]!.konto).toBe("1410");
  });

  it("Belege: Überweisung/Karte auf dem Kreditor, bar und privat unverändert; auch Skonto", () => {
    const kreditoren = new Map([["b1", "70000"], ["b2", "70001"], ["b3", "70002"]]);
    const z = buchungenAusBelegen([BELEG, { ...BELEG, id: "b2", zahlung: "bar" }, { ...BELEG, id: "b3", zahlung: "privat" }], "SKR03", { kreditoren });
    expect(z.map((x) => x.konto)).toEqual(["70000", "1000", "1890"]);
    expect(z[0]!.belegfeld1).toBe("GW-26-0310");
    expect(skontoBuchungenBelege([{ ...BELEG, skonto_cent: 2380, bezahlt: "2026-03-20" }], "SKR03", { kreditoren })[0]!.konto).toBe("70000");
    // „Belege gegen Bank“ geht vor: dann Bank, kein Kreditor
    expect(buchungenAusBelegen([BELEG], "SKR03", { kreditoren, vorgaben: { belegeGegenBank: true } })[0]!.konto).toBe("1200");
  });

  it("Stammdaten „Debitoren/Kreditoren“: EXTF 700, Kategorie 16, Formatversion 5, Konto, Name, USt-IdNr., Anschrift", () => {
    const text = datevDebitorenKreditoren(
      [
        { konto: "70000", name: "Glanzwerk Gebäudeservice GmbH", anschrift: "Zwickauer Straße 60\n04103 Leipzig" },
        { konto: "10000", name: "Elbstudio GmbH", anschrift: "Elbstraße 5\n01067 Dresden", ust_idnr: "DE 123456789" },
        { konto: "10001", name: "Dr. Johanna Krüger", anschrift: "Ringstraße 3, 04109 Leipzig", privat: true },
      ],
      { beraternummer: "31877", mandantennummer: "20514", wjBeginn: "2026-01-01", erzeugtAm: "2027-02-15T10:00:00" },
    );
    const zeilen = text.split("\r\n");
    expect(zeilen[0]!.startsWith('"EXTF";700;16;"Debitoren/Kreditoren";5;20270215100000000;;"RE";')).toBe(true);
    expect(zeilen[0]!.split(";").slice(10, 14)).toEqual(["31877", "20514", "20260101", "4"]);
    expect(zeilen[1]!.split(";")).toEqual([...DEBKRED_SPALTEN]);
    const f = zeilen[2]!.split(";");
    expect(f.length).toBe(40);
    expect([f[0], f[1], f[6], f[7], f[8], f[9], f[14], f[15], f[17], f[18], f[19]]).toEqual(["10000", '"Elbstudio GmbH"', "2", '"Elbstudio GmbH"', '"DE"', '"123456789"', '"STR"', '"Elbstraße 5"', '"01067"', '"Dresden"', '"DE"']);
    const p = zeilen[3]!.split(";");
    expect([p[0], p[1], p[5], p[6], p[17]]).toEqual(["10001", "", '"Dr. Johanna Krüger"', "0", '"04109"']);
    expect(zeilen[4]!.split(";")[0]).toBe("70000");
    expect(anschriftTeile("Block C, Grand Canal Dock\nDublin 2, Irland")).toEqual({ strasse: "Block C", plz: "", ort: "" });
  });

  it("Kontenvorgabe „Personenkonten“: Standard aus, als Option speicher- und importierbar", () => {
    expect(kontenvorgabenAus({}).personenkonten).toBeUndefined();
    expect(kontenvorgabenGesetzt(kontenvorgabenAus({ personenkonten: true }))).toBe(true);
    const imp = kontenvorgabenAusJson(JSON.stringify({ format: "kontenvorgaben", version: 1, optionen: { personenkonten: true } }));
    expect(imp.vorgaben.personenkonten).toBe(true);
    expect(imp.warnungen).toEqual([]);
    expect(JSON.parse(kontenvorgabenJson({ personenkonten: true }, "SKR03")).optionen).toEqual({ personenkonten: true });
  });
});
