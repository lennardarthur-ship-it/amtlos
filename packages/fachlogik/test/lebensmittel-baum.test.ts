/**
 * Prüfbericht Lebensmittelhygiene (Tim Baum, 22.10.2026), Abschnitte A und B: Grenzwerte je Kontrollpunkt (ein Wert je
 * Zeile), Verifizierung, Aufbewahrung, Rückruf-Satz. Die Nummern (L-…) sind die der Prüfmappe zum Zeitpunkt des Berichts.
 */
import { describe, expect, it } from "vitest";
import { AUFZEICHNUNGEN, HACCP_AUFBEWAHRUNG, HACCP_FLEXIBEL, VERIFIZIERUNG, leereDaten, vorlageFuer, type Betrieb } from "../src/index.js";
import { HACCP } from "../src/dokumente/bausteine.js";

const B: Betrieb = { name: "Café Lindenblüte", strasse: "Marktplatz 3", plz: "72764", ort: "Reutlingen", verantwortlich: "Mara Lindner", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Baden-Württemberg" };
const punkt = (anfang: string) => {
  const t = HACCP.filter((x) => x.titel.startsWith(anfang));
  expect(t, anfang).toHaveLength(1);
  return t[0]!;
};

describe("Kontrollpunkte der Eigenkontrollen: ein Grenzwert je Zeile", () => {
  it("keine Doppelwerte und Bereiche mehr", () => {
    const alles = JSON.stringify(HACCP.map((x) => x.werte));
    for (const s of ["abweichende Behördenangabe", "Behördenangaben unterschiedlich", "teils werden", "+4 bis +7", "−2 bis", "bis −15 °C", "30 Minuten", "Aufkochen", "Quartal"]) expect(alles, s).not.toContain(s);
  });
  it("Werte laut Tabelle des Prüfberichts", () => {
    expect(punkt("Kühllagerung allgemein").werte.grenzwert).toBe("Kühlschrank höchstens +7 °C");
    expect(HACCP.find((x) => x.titel === "Kühlung Hackfleisch")!.werte.grenzwert).toBe("zugekauft bzw. vorverpackt: max. +2 °C");
    expect(punkt("Kühlung Hackfleisch – nur bei eigener Herstellung").werte.grenzwert).toMatch(/max\. \+7 °C Umgebung; Abgabe am Tag der Herstellung/);
    expect(punkt("Kühlung Geflügelfleisch").werte.grenzwert).toBe("max. +4 °C");
    expect(punkt("Kühlung Eiprodukte").werte.grenzwert).toBe("max. +4 °C; roheihaltige Speisen innerhalb von 24 Stunden verbrauchen");
    expect(punkt("Tiefkühlung").werte.grenzwert).toMatch(/kurzfristiger Anstieg um höchstens 3 K beim Transport oder Abtauen/);
    const heiss = punkt("Heißhalten");
    expect(heiss.werte).toMatchObject({ grenzwert: "mindestens +60 °C an allen Stellen, höchstens 3 Stunden", haeufigkeit: "bei Beginn der Ausgabe und danach alle 2 Stunden" });
    expect(heiss.werte.korrektur).toMatch(/auf mindestens \+72 °C Kerntemperatur nacherhitzen, nur einmal/);
    expect(punkt("Ausgabetemperatur Kaltspeisen").werte.korrektur).toMatch(/höchstens 2 Stunden ungekühlt.*über \+7 °C: entsorgen/);
    expect(punkt("Abkühlen heißer Speisen").quelle).toMatch(/^BgVV.*1999/);
    const we = String(punkt("Wareneingangskontrolle").werte.grenzwert);
    for (const s of ["Fleisch/Fleischerzeugnisse +7 °C", "Geflügel +4 °C", "Fleischzubereitungen +4 °C", "Konsummilch +8 °C", "Milcherzeugnisse +10 °C"]) expect(we, s).toContain(s);
    expect(punkt("Frittierfett").werte.grenzwert).toMatch(/^Eingriffswert 20 % polare Anteile.*24 %/);
    expect(punkt("Schädlingsmonitoring").werte.haeufigkeit).toMatch(/mindestens einmal im Monat/);
  });
});

describe("Verifizierung und Aufzeichnungen", () => {
  it("wöchentlich, monatlich, jährlich – ohne „fachlich zu prüfen“; Thermometerprüfung mit Eis- und Kochwasser", () => {
    const o = (w: string) => VERIFIZIERUNG.find((x) => x.wert === w)!;
    expect(o("protokolle_durchsehen").text).toContain("wöchentlich");
    expect(o("protokolle_durchsehen").quelle).toContain("2022/C 355/01, Anhang I Nr. 4");
    expect(o("regelmaessig").text).toContain("jährlich");
    expect(o("thermometer").text).toBe("Thermometer monatlich prüfen: im Eiswasser (0 °C) und in kochendem Wasser (100 °C); weicht es um mehr als 1 K ab, ersetzen");
    for (const w of ["protokolle_durchsehen", "thermometer", "regelmaessig"]) expect(`${o(w).text} ${o(w).quelle}`, w).not.toMatch(/zu prüfen/);
    expect(AUFZEICHNUNGEN.find((x) => x.wert === "wasser")!.quelle).toBe("§ 11 Abs. 2 TrinkwV");
  });
  it("Aufbewahrung als Startwert, Hinweis auf vereinfachte Aufzeichnungen nur in der App", () => {
    const v = vorlageFuer("haccp")!;
    expect(leereDaten(v, B, "2026-10-22", ["gastro_cafe"]).aufbewahrung).toBe(HACCP_AUFBEWAHRUNG);
    expect(HACCP_AUFBEWAHRUNG).toBe("12 Monate, bei haltbarer Ware bis 6 Monate nach Ablauf des MHD");
    const felder = v.abschnitte.flatMap((a) => a.felder);
    expect(felder.find((f) => f.id === "aufbewahrung")!.hilfe).toContain("Wetteraukreis");
    expect(v.abschnitte.find((a) => a.titel === "Messungen")!.hilfe).toContain("Anhang I Nr. 5");
    expect(HACCP_FLEXIBEL).toContain("Anlage 5 Kap. VII Tier-LMHV");
  });
});
