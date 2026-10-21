import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { EUER_ZEILE_STEUERFREI, KU_HINWEIS, eRechnungAus, vorlageFuer, xrechnungUbl, type Beleg } from "@amtlos/fachlogik";
import { sicherungErstellen, sicherungLesen, sicherungLesenMitDateien } from "../src/unterlagen/sicherung";
import { LEERER_STAND, anlegen, aufbewahrungspflichtig, ausgeben, belegLoeschen, belegSetzen, bezahltSetzen, felderSetzen, standAus, stornieren, ungesichert, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { EUER_NICHT_ENTHALTEN, belegDateiname, euerUebernahme, jahreMitDaten, standardZeitraum, steuerpaket, zeitraeume } from "../src/unterlagen/steuerpaket";
import { perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", email: "info@salon.example", telefon: "089 1", steuernummer: "143/123/45678", iban: "DE89370400440532013000" };
const beleg = (id: string, datum: string, brutto: number, o: Partial<Beleg> = {}): Beleg => ({ id, datum, lieferant: "Friseurbedarf Müller", nummer: `L-${id}`, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: brutto }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: `${datum}T08:00:00Z`, geaendert: `${datum}T08:00:00Z`, ...o });
function rechnung(s: Stand, id: string, datum: string, preis: string, bezahlt?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  let s2 = felderSetzen(s1, id, { datum, kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3\n80333 München", kunde_email: "kim@example.org", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis, satz: "19" }] }, t(datum));
  s2 = ausgeben(s2, id, t(datum));
  return bezahlt ? bezahltSetzen(s2, id, bezahlt) : s2;
}

describe("Belege (E-133): Stand, Aufbewahrung, Zusammenführen", () => {
  it("liest Belege, zählt sie als aufbewahrungspflichtig und als ungesichert", () => {
    const s = belegSetzen({ ...LEERER_STAND, betrieb: BETRIEB }, beleg("b1", "2026-10-02", 11900), t("2026-10-02"));
    expect(standAus(JSON.stringify(s)).belege).toHaveLength(1);
    expect(standAus(JSON.stringify({ version: 1, belege: [{ id: "x" }, null] })).belege).toEqual([]);
    expect(aufbewahrungspflichtig(s)).toHaveLength(1);
    expect(ungesichert(s)).toBe(true);
    expect(belegLoeschen(s, "b1").belege).toEqual([]);
  });
  it("führt Belege nach ID zusammen: Neueres gewinnt, nur auf dem Gerät Vorhandenes bleibt", () => {
    const alt = beleg("b1", "2026-10-02", 1000);
    const neu = { ...alt, lieferant: "Neu GmbH", geaendert: "2026-10-05T10:00:00Z" };
    const geraet: Stand = { ...LEERER_STAND, belege: [neu, beleg("b2", "2026-10-03", 500)] };
    const sicherung: Stand = { ...LEERER_STAND, belege: [alt, beleg("b3", "2026-10-04", 700)] };
    const z = zusammenfuehren(geraet, sicherung);
    expect(z.stand.belege.map((b) => b.id).sort()).toEqual(["b1", "b2", "b3"]);
    expect(z.stand.belege.find((b) => b.id === "b1")!.lieferant).toBe("Neu GmbH");
  });
  it("Sicherung Version 2 trägt die Belegdateien, Version 1 bleibt lesbar", () => {
    const s = belegSetzen(LEERER_STAND, beleg("b1", "2026-10-02", 1000, { datei: "abcd1234.jpg" }), t("2026-10-02"));
    const zufall = (n: number) => new Uint8Array(n).fill(7);
    const v2 = sicherungErstellen(s, "sonnenschein-2026", zufall, t("2026-10-02"), 1000, { "abcd1234.jpg": "AAEC" });
    expect(JSON.parse(v2).version).toBe(2);
    const r = sicherungLesenMitDateien(v2, "sonnenschein-2026");
    expect(r.dateien).toEqual({ "abcd1234.jpg": "AAEC" });
    expect(r.stand.belege[0]!.datei).toBe("abcd1234.jpg");
    const v1 = sicherungErstellen(s, "sonnenschein-2026", zufall, t("2026-10-02"), 1000);
    expect(JSON.parse(v1).version).toBe(1);
    expect(sicherungLesen(v1, "sonnenschein-2026").belege).toHaveLength(1);
  });
});

describe("Voranmeldung und EÜR aus Belegen (E-133)", () => {
  it("übernimmt die Vorsteuer nach Belegdatum; Belege ohne Vorsteuerabzug werden gezählt, nicht summiert", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    s = rechnung(s, "r1", "2026-10-05", "100,00");
    s = belegSetzen(s, beleg("b1", "2026-10-02", 11900), t("2026-10-02"));
    s = belegSetzen(s, beleg("b2", "2026-10-20", 1070, { steuer: [{ satz: 7, brutto_cent: 1070 }] }), t("2026-10-20"));
    s = belegSetzen(s, beleg("b3", "2026-10-21", 5950, { vorsteuer: false }), t("2026-10-21"));
    s = belegSetzen(s, beleg("b4", "2026-11-02", 11900), t("2026-11-02"));
    const okt = umsaetzeFuer(s.unterlagen, "2026-10", s.betrieb, "soll", s.belege)!;
    expect(okt.werte.umsatz_19).toBe("100,00");
    expect(okt.werte.vorsteuer).toBe("19,70");
    expect(okt.vorsteuerBelege).toBe(2);
    expect(okt.ohneVorsteuer).toBe(1);
    expect(perioden([], s.betrieb, "soll", s.belege)).toContain("2026-11");
  });
  it("EÜR: Einnahmen nach Zahlungseingang, Ausgaben nach Zahltag, Vorsteuer als eigene Zeile, Anschaffungen gemeldet", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    s = rechnung(s, "r1", "2026-03-05", "100,00", "2026-03-20");
    s = rechnung(s, "r2", "2026-12-20", "50,00", "2027-01-10"); // Zufluss 2027
    s = rechnung(s, "r3", "2026-06-01", "80,00"); // unbezahlt
    s = belegSetzen(s, beleg("b1", "2026-02-02", 11900), t("2026-02-02"));
    s = belegSetzen(s, beleg("b2", "2026-05-02", 238000, { kategorie: "anlage" }), t("2026-05-02"));
    const e = euerUebernahme(s, "2026");
    expect(e.einnahmen).toEqual([
      { datum: "", text: "Umsätze aus Rechnungen (netto)", kategorie: "Umsatzsteuerpflichtige Betriebseinnahmen", betrag: "100,00" },
      { datum: "", text: "Vereinnahmte Umsatzsteuer", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: "19,00" },
    ]);
    expect(e.ausgaben[0]).toMatchObject({ kategorie: "Waren, Rohstoffe und Hilfsstoffe einschließlich der Nebenkosten", betrag: "100,00" });
    expect(e.ausgaben.at(-1)).toMatchObject({ kategorie: "Gezahlte Vorsteuerbeträge", betrag: "399,00" });
    expect(e.anlagen).toBe(1);
    expect(e.unbezahlt).toBe(1);
    expect(e.hinweis).toBe(EUER_NICHT_ENTHALTEN);
    expect(jahreMitDaten(s)).toEqual(["2027", "2026"]);
  });
  it("EÜR: steuerfreie innergemeinschaftliche Lieferung in der Zeile für steuerfreie Einnahmen; Hinweis auf USt-Zahlungen und AfA", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: { ...BETRIEB, ust_idnr: "DE123456789" } };
    s = rechnung(s, "r1", "2026-03-05", "100,00", "2026-03-20");
    const [s1] = anlegen(s, "rechnung", t("2026-08-27"), "r2");
    s = felderSetzen(s1, "r2", { datum: "2026-08-27", leistungsdatum: "2026-08-25", kunde_name: "Feinkost Huber GmbH", kunde_anschrift: "Ringstraße 1\n1010 Wien", kunde_land: "AT", kunde_ust_idnr: "ATU12345678", hinweise: ["igl"], positionen: [{ bezeichnung: "Präsentbox", menge: "40", einheit: "Stück", preis: "21,00", satz: "0" }] }, t("2026-08-27"));
    s = bezahltSetzen(ausgeben(s, "r2", t("2026-08-27")), "r2", "2026-09-10");
    expect(eRechnungAus(s.unterlagen.find((u) => u.id === "r2")!.daten, s.betrieb).daten.steuerart).toBe("igl");
    const e = euerUebernahme(s, "2026");
    expect(e.einnahmen).toEqual([
      { datum: "", text: "Umsätze aus Rechnungen (netto)", kategorie: "Umsatzsteuerpflichtige Betriebseinnahmen", betrag: "100,00" },
      { datum: "", text: "Steuerfreie und nicht steuerbare Umsätze aus Rechnungen", kategorie: EUER_ZEILE_STEUERFREI, betrag: "840,00" },
      { datum: "", text: "Vereinnahmte Umsatzsteuer", kategorie: "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben", betrag: "19,00" },
    ]);
    // dieselben Zeilentexte wie in den Vorschlägen der Vorlage „EÜR“
    const vorschlaege = vorlageFuer("euer")!.abschnitte.flatMap((a) => a.felder).flatMap((f) => ("felder" in f && f.felder ? f.felder : [])).flatMap((f) => ("vorschlaege" in f && f.vorschlaege ? f.vorschlaege : []));
    for (const z of e.einnahmen) expect(vorschlaege, z.kategorie).toContain(z.kategorie);
    expect(e.hinweis).toMatch(/Umsatzsteuer-Vorauszahlungen/);
    expect(e.hinweis).toMatch(/Abschreibungen \(AfA\)/);
  });
});

describe("Paket für die Steuerberatung (E-133)", () => {
  it("bietet über den Jahreswechsel Vormonate und Vorquartale an und wählt das letzte abgeschlossene Quartal vor", () => {
    const namen = zeitraeume("2027-01-15").map((x) => x.name);
    expect(namen).toEqual(["2027-01", "2026-12", "2026-11", "2027-Q1", "2026-Q4", "2026-Q3", "2026-Q2", "2027", "2026"]);
    expect(zeitraeume("2027-01-15").find((x) => x.name === "2026-12")).toEqual({ von: "2026-12-01", bis: "2026-12-31", name: "2026-12" });
    expect(standardZeitraum("2027-01-15")).toBe("2026-Q4");
    expect(standardZeitraum("2026-10-19")).toBe("2026-Q3");
    expect(standardZeitraum("2026-05-02")).toBe("2026-Q1");
  });
  it("enthält DATEV-Stapel, Listen, E-Rechnungen und Belegdateien des Zeitraums", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: { kontenrahmen: "SKR03", beraternummer: "1001", mandantennummer: "42" } };
    s = rechnung(s, "r1", "2026-10-05", "100,00", "2026-10-10");
    s = belegSetzen(s, beleg("b1", "2026-10-02", 11900, { datei: "f1.jpg", lieferant: "Müller & Söhne" }), t("2026-10-02"));
    s = belegSetzen(s, beleg("b2", "2026-07-02", 500), t("2026-07-02"));
    const z = zeitraeume("2026-10-13").find((x) => x.name === "2026-Q4")!;
    expect(z).toEqual({ von: "2026-10-01", bis: "2026-12-31", name: "2026-Q4" });
    const p = steuerpaket(s, z, s.steuerberatung, { "f1.jpg": new Uint8Array([1, 2, 3]) }, "2026-10-13T12:00:00.000Z");
    expect(p).toMatchObject({ rechnungen: 1, belege: 1, ohneXml: 0, dateiname: "Amtlos-Steuerberatung-Salon-Sonne-2026-Q4.zip" });
    const inhalt = unzipSync(p.zip);
    // Amtlos-Belegnummer nach Erfassung je Jahr: b2 (Juli) wurde zuerst erfasst → B2026-001, b1 → B2026-002
    expect(Object.keys(inhalt).sort()).toEqual(["Belege/B2026-002_2026-10-02_Mueller-Soehne_L-b1.jpg", "Belege_2026-Q4.csv", "Buchungsliste_2026-Q4.csv", "E-Rechnungen/2026-001.xml", "EXTF_Buchungsstapel_2026-Q4.csv", "Fragen_2026-Q4.txt", "LIESMICH.txt", "Rechnungen_2026-Q4.csv"].sort());
    expect(strFromU8(inhalt["EXTF_Buchungsstapel_2026-Q4.csv"]!, true).startsWith('"EXTF";700;21')).toBe(true);
    const re = strFromU8(inhalt["Rechnungen_2026-Q4.csv"]!).replace(/^\uFEFF/, "").split("\r\n");
    expect(re[0]).toBe("Nummer;Datum;Leistungsdatum;Leistungszeitraum;Kunde;USt-IdNr. Kunde;Steuerart;Netto;USt;Brutto;Steuersätze;Fällig am;Bezahlt am;Offener Betrag zum 31.12.2026;Storno zu");
    expect(re[1]).toBe("2026-001;05.10.2026;05.10.2026;;Kim Beispiel;;Standard;100,00;19,00;119,00;19 %;19.10.2026;10.10.2026;0,00;");
    expect(re[2]).toBe("Summe 19 %;;;;;;;100,00;19,00;119,00;19 %;;;;");
    expect(re[3]).toBe("Summe gesamt;;;;;;;100,00;19,00;119,00;;;;0,00;");
    const be = strFromU8(inhalt["Belege_2026-Q4.csv"]!).replace(/^\uFEFF/, "").split("\r\n");
    expect(be[0]).toBe("Amtlos-Belegnr.;Datum;Lieferant;Belegnummer (Lieferant);Belegfeld 1 (DATEV);Kategorie;Zeile Anlage EÜR;Konto (DATEV);Netto;USt;Vorsteuer;Brutto;Steuersätze;Zahlung;Zahltag (für EÜR verwendet);Datei;Notiz;Steuerschuldnerschaft;Im Buchungsstapel");
    expect(be[1]).toBe("B2026-002;02.10.2026;Müller & Söhne;L-b1;L-b1;Waren und Material;Waren, Rohstoffe und Hilfsstoffe einschließlich der Nebenkosten;3400;100,00;19,00;19,00;119,00;19 %;Überweisung oder Karte;02.10.2026 (fehlt – Belegdatum verwendet);B2026-002_2026-10-02_Mueller-Soehne_L-b1.jpg;;;ja");
    expect(be[2]).toBe("Summe;;;;;;;;100,00;19,00;19,00;119,00;;;;;;;");
    expect(Array.from(inhalt["Belege/B2026-002_2026-10-02_Mueller-Soehne_L-b1.jpg"]!)).toEqual([1, 2, 3]);
    // DATEV: Belegfeld 1 wie in der Belegliste, Buchungs-GUID gesetzt
    const extf = strFromU8(inhalt["EXTF_Buchungsstapel_2026-Q4.csv"]!, true).split("\r\n");
    expect(extf.some((z) => z.includes(';"L-b1";'))).toBe(true);
    const xml = strFromU8(inhalt["E-Rechnungen/2026-001.xml"]!);
    expect(xml).toBe(xrechnungUbl(eRechnungAus(s.unterlagen[0]!.daten, s.betrieb).daten, KU_HINWEIS));
    expect(belegDateiname(beleg("x", "2026-01-01", 1, { lieferant: "", nummer: null, datei: "a.pdf" }))).toBe("2026-01-01_ohne-name.pdf");
    expect(belegDateiname(beleg("y", "2026-01-31", 1, { lieferant: "Lohnbüro Weiß", nummer: "LA 01/2026", datei: "b.pdf" }))).toBe("2026-01-31_Lohnbuero-Weiss_LA-01-2026.pdf");
    expect(belegDateiname(beleg("z", "2026-02-01", 1, { lieferant: "Café Crème", nummer: null, datei: "c.jpg" }))).toBe("2026-02-01_Cafe-Creme.jpg");
    expect(belegDateiname(beleg("z", "2026-02-01", 1, { lieferant: "Café Crème", nummer: "Nr. 7", datei: "c.jpg" }), "B2026-004")).toBe("B2026-004_2026-02-01_Cafe-Creme_Nr-7.jpg");
    expect(steuerpaket({ ...s, betrieb: { ...s.betrieb, name: "Café Morgenrot" } }, z, s.steuerberatung, {}, "2026-10-13T12:00:00.000Z").dateiname).toBe("Amtlos-Steuerberatung-Cafe-Morgenrot-2026-Q4.zip");
    // Hinweis: Paket nach Rechnungsdatum, Voranmeldung nach Leistungsdatum
    expect(strFromU8(inhalt["LIESMICH.txt"]!)).toMatch(/nach dem Leistungsdatum zu \(Soll-Versteuerung\).*abweichen/);
  });
});

describe("Paket für die Steuerberatung: LIESMICH, Fragen, Listen (Durchsicht Steuerberaterin)", () => {
  /** Jahr 2026: Rechnungen (eine an einen Privatkunden ohne E-Mail, eine storniert im Folgequartal, eine offen), Belege aller Fragearten */
  function jahr(): Stand {
    let s: Stand = { ...LEERER_STAND, betrieb: { ...BETRIEB, rechtsform: "Einzelunternehmen", versteuerung: "soll", ust_idnr: "DE123456789" }, steuerberatung: { kontenrahmen: "SKR03", beraternummer: "1001", mandantennummer: "42" } };
    s = rechnung(s, "r1", "2026-03-05", "100,00", "2026-03-20");
    s = rechnung(s, "r2", "2026-03-28", "200,00"); // storniert im April
    const [s1] = anlegen(s, "rechnung", t("2026-11-02"), "r3");
    s = ausgeben(felderSetzen(s1, "r3", { datum: "2026-11-02", kunde_name: "Pat Privat", kunde_anschrift: "Am Bach 2\n80333 München", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis: "40,00", satz: "19" }] }, t("2026-11-02")), "r3", t("2026-11-02"));
    const [s2, st] = stornieren(s, "r2", t("2026-04-03"), "st1");
    s = ausgeben(s2, st!.id, t("2026-04-03"));
    s = belegSetzen(s, beleg("b1", "2026-02-02", 11900, { nummer: null }), t("2026-02-02"));
    s = belegSetzen(s, beleg("b2", "2026-05-02", 9520, { kategorie: "fahrzeug", bezahlt: "2026-05-03" }), t("2026-05-02"));
    s = belegSetzen(s, beleg("b3", "2026-06-02", 5950, { kategorie: "bewirtung", zahlung: "bar", notiz: "Kundengespräch" }), t("2026-06-02"));
    s = belegSetzen(s, beleg("b4", "2026-07-02", 238000, { kategorie: "anlage", zahlung: "privat" }), t("2026-07-02"));
    return s;
  }
  const JAHR = { von: "2026-01-01", bis: "2026-12-31", name: "2026" };
  const Q1 = { von: "2026-01-01", bis: "2026-03-31", name: "2026-Q1" };

  it("LIESMICH: Mandant, Jahrespaket-Hinweis, Rechnungen ohne E-Rechnung mit Grund, „Nicht enthalten“", () => {
    const s = jahr();
    const p = steuerpaket(s, JAHR, s.steuerberatung, {}, "2027-02-15T10:00:00.000Z");
    const l = strFromU8(unzipSync(p.zip)["LIESMICH.txt"]!);
    for (const z of ["Mandant (Angaben aus der App)", "- Name: Salon Sonne", "- Rechtsform: Einzelunternehmen", "- Steuernummer: 143/123/45678", "- USt-IdNr.: DE123456789", "- Kleinunternehmer (§ 19 UStG): nein", "- Versteuerung: Soll (vereinbarte Entgelte)", "- Kontenrahmen: SKR03", "- Berater-/Mandantennummer: 1001 / 42", "- Zeitraum: 01.01.2026 bis 31.12.2026 (2026)", "- App: Amtlos 1.0.0", "- Erstellt am: 15.02.2027 10:00 Uhr (UTC)"]) expect(l, z).toContain(z);
    expect(l).toContain("Nicht zusätzlich zu den Monats-/Quartalsstapeln importieren – gleiche Buchungen.");
    expect(l).toContain("- 2026-003 (Pat Privat): Privatkunde (ohne E-Mail erfasst) – keine E-Rechnung nötig");
    expect(p.ohneXml).toBe(1);
    // R10: der Kassensatz steht einmal unter „Wichtig“, nicht noch einmal unter „Nicht enthalten“
    expect(l).toMatch(/\r\nWichtig\r\n- Falls der Betrieb eine Kasse nutzt: Kassenumsätze fehlen/);
    expect(l).toMatch(/Nicht enthalten – bitte zusätzlich liefern\r\n- Kontoauszüge/);
    for (const w of ["Kontoauszüge", "Privatentnahmen und Privateinlagen", "Umsatzsteuer-Vorauszahlungen und Erstattungen", "Abschreibungen (AfA)", "Lohnjournal"]) expect(l, w).toContain(w);
    // Quartalspaket: kein Jahressatz; fehlende Angaben werden genannt
    const q = strFromU8(unzipSync(steuerpaket({ ...s, betrieb: { ...s.betrieb, versteuerung: "" } }, Q1, s.steuerberatung, {}, "2026-04-10T08:00:00").zip)["LIESMICH.txt"]!);
    expect(q).not.toContain("Monats-/Quartalsstapeln");
    expect(q).toContain("- Versteuerung: nicht angegeben (Soll angenommen)");
    expect(q).toContain("- Erstellt am: 10.04.2026 08:00 Uhr\r\n");
    const ohneMail = { ...s, betrieb: { ...s.betrieb, email: "" } };
    expect(strFromU8(unzipSync(steuerpaket(ohneMail, Q1, s.steuerberatung, {}, "2026-04-10T08:00:00").zip)["LIESMICH.txt"]!)).toMatch(/- 2026-001 \(Kim Beispiel\): Angaben fehlen: E-Mail des Betriebs/);
  });

  it("Fragen_<Zeitraum>.txt: nur Abschnitte mit Einträgen, Sachverhalte ohne Bewertung", () => {
    const s = jahr();
    const p = steuerpaket(s, JAHR, s.steuerberatung, {}, "2027-02-15T10:00:00.000Z");
    const f = strFromU8(unzipSync(p.zip)["Fragen_2026.txt"]!);
    expect(f).toContain("Belege mit Zahlungsweg Überweisung/Karte ohne Zahltag");
    expect(f).toMatch(/Wann wurde bezahlt\?\r\n- B2026-001 · 02\.02\.2026 · Friseurbedarf Müller · 119,00 € brutto\r\n/);
    expect(f).toMatch(/Belege ohne Belegnummer des Lieferanten[^\n]*\r\n- B2026-001 /);
    expect(f).toMatch(/Rechnungen ohne vermerkten Zahlungseingang zum 31\.12\.2026:\r\n- 2026-003 · 02\.11\.2026 · Pat Privat · 47,60 € brutto · fällig 16\.11\.2026\r\n/);
    expect(f).toMatch(/Privat bezahlte Belege[^\n]*\r\n- B2026-004 /);
    expect(f).toMatch(/Kfz-Kosten: Fahrzeug und privater Anteil\?\r\n- B2026-002 /);
    expect(f).toMatch(/Bewirtung: Anlass und Teilnehmer\?\r\n- B2026-003 · 02\.06\.2026 · Friseurbedarf Müller · 59,50 € brutto · Notiz: Kundengespräch\r\n/);
    expect(f).toMatch(/Nutzungsdauer\? \(Computerhardware und Software: auch 1 Jahr möglich, BMF 22\.02\.2022\)\r\n- B2026-004 · 02\.07\.2026 · Friseurbedarf Müller · 2\.380,00 € brutto · 2\.000,00 € netto/);
    // Storno im selben Jahr: kein Bezug zu einem anderen Zeitraum; keine Gutschriften
    expect(f).not.toContain("Stornos mit Bezug");
    expect(f).not.toContain("Gutschriften");
    // R11: Barbelege gegen Kasse – woher das Bargeld kam (Kassenminus)
    expect(f).toMatch(/Bar bezahlte Belege \(im Stapel gegen Kasse\)[^\n]*\r\n- B2026-/);
    expect(p.fragen).toBe(8);
    // Q1: die stornierte Rechnung (Storno im April) gehört dazu; Bewirtung/Kfz fehlen
    const q = strFromU8(unzipSync(steuerpaket(s, Q1, s.steuerberatung, {}, "2026-04-10T08:00:00").zip)["Fragen_2026-Q1.txt"]!);
    expect(q).toMatch(/Stornos mit Bezug zu einem anderen Zeitraum[^\n]*\r\n- 2026-002 · 28\.03\.2026 · Kim Beispiel · 238,00 € brutto · storniert durch 2026-004 vom 03\.04\.2026 \(anderer Zeitraum\)/);
    expect(q).toMatch(/zum 31\.03\.2026:\r\n- 2026-002 /); // zum Quartalsende noch offen (Storno erst im April)
    expect(q).not.toContain("Kfz-Kosten");
    expect(q).not.toContain("Bewirtung");
    const q2 = strFromU8(unzipSync(steuerpaket(s, { von: "2026-04-01", bis: "2026-06-30", name: "2026-Q2" }, s.steuerberatung, {}, "2026-07-10T08:00:00").zip)["Fragen_2026-Q2.txt"]!);
    expect(q2).toMatch(/- 2026-004 · 03\.04\.2026 · Kim Beispiel · -238,00 € brutto · storniert RE 2026-002 vom 28\.03\.2026 \(anderer Zeitraum\)/);
    // leerer Zeitraum
    const leer = strFromU8(unzipSync(steuerpaket(s, { von: "2026-09-01", bis: "2026-09-30", name: "2026-09" }, s.steuerberatung, {}, "2026-10-10T08:00:00").zip)["Fragen_2026-09.txt"]!);
    expect(leer).toContain("Keine offenen Punkte gefunden.");
  });

  it("Rechnungsliste: sortiert nach Datum und Nummer, Storno ohne „-0,00“, Summen je Satz; Buchungstext des Stornos mit Bezug; Zahltag fehlt markiert", () => {
    const s = jahr();
    const inhalt = unzipSync(steuerpaket(s, JAHR, s.steuerberatung, {}, "2027-02-15T10:00:00.000Z").zip);
    const re = strFromU8(inhalt["Rechnungen_2026.csv"]!).replace(/^\uFEFF/, "").split("\r\n").filter(Boolean);
    expect(re.slice(1).map((z) => z.split(";")[0])).toEqual(["2026-001", "2026-002", "2026-004", "2026-003", "Summe 19 %", "Summe gesamt"]); // nach Datum (Storno 2026-004 vom April vor 2026-003 vom November)
    expect(re[3]).toBe("2026-004;03.04.2026;03.04.2026;;Kim Beispiel;;Standard;-200,00;-38,00;-238,00;19 %;;;0,00;2026-002");
    expect(re.join("\n")).not.toContain("-0,00");
    expect(re.at(-1)).toBe("Summe gesamt;;;;;;;140,00;26,60;166,60;;;;47,60;");
    const liste = strFromU8(inhalt["Buchungsliste_2026.csv"]!);
    expect(liste).toContain(";Storno 2026-004 zu RE 2026-002 Kim Beispiel;19;");
    expect(liste).toContain(";B2026-001;Friseurbedarf Müller Wareneinkauf;19;");
    expect(liste).toContain(";L-b2;Friseurbedarf Müller Kfz;19;");
    const be = strFromU8(inhalt["Belege_2026.csv"]!);
    expect(be).toContain("02.02.2026 (fehlt – Belegdatum verwendet)");
    expect(be).toContain(";03.05.2026;"); // Zahltag vorhanden
  });

  it("Rechnungs-PDFs: mit `rechnungsPdfs` unter Rechnungen/<Nummer>_<Kunde>.pdf und in der Spalte „Datei“", () => {
    const s = jahr();
    const ohne = unzipSync(steuerpaket(s, JAHR, s.steuerberatung, {}, "2027-02-15T10:00:00.000Z").zip);
    expect(Object.keys(ohne).some((k) => k.startsWith("Rechnungen/"))).toBe(false);
    const p = steuerpaket(s, JAHR, s.steuerberatung, {}, "2027-02-15T10:00:00.000Z", { rechnungsPdfs: { r1: new Uint8Array([37, 80]), r3: new Uint8Array([1]) } });
    expect(p.pdfs).toBe(2);
    const inhalt = unzipSync(p.zip);
    expect(Object.keys(inhalt).filter((k) => k.startsWith("Rechnungen/")).sort()).toEqual(["Rechnungen/2026-001_Kim-Beispiel.pdf", "Rechnungen/2026-003_Pat-Privat.pdf"]);
    const re = strFromU8(inhalt["Rechnungen_2026.csv"]!).replace(/^\uFEFF/, "").split("\r\n");
    expect(re[0]!.endsWith(";Storno zu;Datei")).toBe(true);
    expect(re[1]!.endsWith(";2026-001_Kim-Beispiel.pdf")).toBe(true);
    expect(re[2]!.endsWith(";")).toBe(true);
    const l = strFromU8(inhalt["LIESMICH.txt"]!);
    expect(l).toContain("- Rechnungen/: PDFs der Rechnungen (2)");
    expect(l).not.toContain("Die PDFs der Ausgangsrechnungen liegen beim Betrieb.");
  });
});
