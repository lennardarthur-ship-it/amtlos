import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { KU_HINWEIS, eRechnungAus, xrechnungUbl, type Beleg } from "@amtlos/fachlogik";
import { sicherungErstellen, sicherungLesen, sicherungLesenMitDateien } from "../src/unterlagen/sicherung";
import { LEERER_STAND, anlegen, aufbewahrungspflichtig, ausgeben, belegLoeschen, belegSetzen, bezahltSetzen, felderSetzen, standAus, ungesichert, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { belegDateiname, euerUebernahme, jahreMitDaten, steuerpaket, zeitraeume } from "../src/unterlagen/steuerpaket";
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
    const s = belegSetzen(LEERER_STAND, beleg("b1", "2026-10-02", 1000, { datei: "abc.jpg" }), t("2026-10-02"));
    const zufall = (n: number) => new Uint8Array(n).fill(7);
    const v2 = sicherungErstellen(s, "sonnenschein-2026", zufall, t("2026-10-02"), 1000, { "abc.jpg": "AAEC" });
    expect(JSON.parse(v2).version).toBe(2);
    const r = sicherungLesenMitDateien(v2, "sonnenschein-2026");
    expect(r.dateien).toEqual({ "abc.jpg": "AAEC" });
    expect(r.stand.belege[0]!.datei).toBe("abc.jpg");
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
    expect(jahreMitDaten(s)).toEqual(["2027", "2026"]);
  });
});

describe("Paket für die Steuerberatung (E-133)", () => {
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
    expect(Object.keys(inhalt).sort()).toEqual(["Belege/2026-10-02_Muller-Sohne_L-b1.jpg", "Belege_2026-Q4.csv", "Buchungsliste_2026-Q4.csv", "E-Rechnungen/2026-001.xml", "EXTF_Buchungsstapel_2026-Q4.csv", "LIESMICH.txt", "Rechnungen_2026-Q4.csv"].sort());
    expect(strFromU8(inhalt["EXTF_Buchungsstapel_2026-Q4.csv"]!, true).startsWith('"EXTF";700;21')).toBe(true);
    expect(strFromU8(inhalt["Rechnungen_2026-Q4.csv"]!)).toContain("2026-001;05.10.2026;05.10.2026;Kim Beispiel;100,00;19,00;119,00;19 %;10.10.2026;");
    expect(strFromU8(inhalt["Belege_2026-Q4.csv"]!)).toContain("Müller & Söhne");
    expect(Array.from(inhalt["Belege/2026-10-02_Muller-Sohne_L-b1.jpg"]!)).toEqual([1, 2, 3]);
    const xml = strFromU8(inhalt["E-Rechnungen/2026-001.xml"]!);
    expect(xml).toBe(xrechnungUbl(eRechnungAus(s.unterlagen[0]!.daten, s.betrieb).daten, KU_HINWEIS));
    expect(belegDateiname(beleg("x", "2026-01-01", 1, { lieferant: "", nummer: null, datei: "a.pdf" }))).toBe("2026-01-01_ohne-name.pdf");
  });
});
