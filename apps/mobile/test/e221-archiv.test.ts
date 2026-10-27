/**
 * E-221 Befund 9: Offenes Archiv – (a) die festgehaltene XRechnung (und das PDF) einer Konfliktkopie (K1, abweichend
 * festgeschriebene Fassung derselben Rechnung von einem anderen Gerät) bzw. eines doppelten Stornos (K2) fehlte, weil
 * das Archiv nur „zählende“ Rechnungen nahm; (b) gleich benannte Dateien überschrieben sich (gleiche Rechnungsnummer und
 * Kunde von zwei Geräten, Belege mit gleicher Nummer, Datum und Lieferant, Z-Bons gleicher Nummer an zwei Standorten);
 * (c) eine Rechnung mit festgehaltenem Original verlor ihre XML, sobald die Daten heute nicht mehr vollständig für eine
 * E-Rechnung reichten; (d) Z-Bons früherer Fassungen eines korrigierten Kassenabschlusses fehlten. Dasselbe (c) im
 * Steuerberater-Paket.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { type Beleg, type KassenInhalt } from "@amtlos/fachlogik";
import { archivRechnungen, offenesArchiv } from "../src/unterlagen/archiv";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, felderSetzen, kasseKorrigieren, kasseSpeichern, type Stand } from "../src/unterlagen/speicher";
import { gestellteRechnungen, steuerpaket } from "../src/unterlagen/steuerpaket";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000", verantwortlich: "Jana Winter" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "kasse.elektronisch": true, "ust.kleinunternehmer": false } };
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const tag = (datum: string, o: Partial<KassenInhalt> = {}): KassenInhalt => ({ datum, zbon: null, umsatz: [{ satz: 19, brutto_cent: 11900 }], karte_cent: 0, sonstige_cent: 0, bewegungen: [], ...o });
const beleg = (id: string, datum: string, o: Partial<Beleg> = {}): Beleg => ({ id, datum, lieferant: "Großmarkt", nummer: null, kategorie: "waren", steuer: [{ satz: 7, brutto_cent: 1070 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: `${datum}T08:00:00.000Z`, geaendert: `${datum}T08:00:00.000Z`, ...o });
const dateienIm = (zip: Uint8Array) => unzipSync(zip);
const text = (zip: Uint8Array, name: string) => strFromU8(dateienIm(zip)[name]!).replace(/^\uFEFF/, "");

function rechnung(s: Stand, id: string, datum: string, preis = "100,00", nummer?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, ...(nummer ? { nummer } : {}), kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis, satz: "19" }] }, t(datum));
  return ausgeben(s2, id, t(datum));
}

describe("E-221 Befund 9: offenes Archiv vollständig und ohne Überschreiben", () => {
  it("(a) Konfliktkopie: ihre festgehaltene XRechnung und ihr PDF sind im Archiv, unter eigenem Namen", () => {
    const s0 = rechnung(BASIS, "r1", "2026-01-22");
    const u = s0.unterlagen[0]!;
    expect(u.xml).toBeTruthy();
    const kopie = { ...u, id: "r1-kabc", konfliktKopieVon: "r1", daten: { ...u.daten, positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "120,00", satz: "19" }] }, xml: u.xml!.replace("Catering", "Catering (andere Fassung)") };
    const s: Stand = { ...s0, unterlagen: [...s0.unterlagen, kopie] };
    // zählt nicht (EÜR, Voranmeldung, Listen) – gehört aber ins Archiv
    expect(gestellteRechnungen(s).map((x) => x.id)).toEqual(["r1"]);
    expect(archivRechnungen(s).map((x) => x.id)).toEqual(["r1", "r1-kabc"]);
    const a = offenesArchiv(s, {}, "2026-02-01T10:00:00.000Z", { rechnungsPdfs: { r1: new Uint8Array([1]), "r1-kabc": new Uint8Array([2]) } });
    const z = dateienIm(a.zip);
    const xml = Object.keys(z).filter((n) => n.startsWith("E-Rechnungen/")).sort();
    const pdf = Object.keys(z).filter((n) => n.startsWith("Rechnungen/")).sort();
    expect(xml).toHaveLength(2);
    expect(pdf).toHaveLength(2);
    expect(xml.map((n) => strFromU8(z[n]!)).some((x) => x.includes("Catering (andere Fassung)"))).toBe(true);
    expect(xml.map((n) => strFromU8(z[n]!))).toContain(u.xml);
    expect(xml.some((n) => n.includes("Konfliktkopie"))).toBe(true);
    expect(text(a.zip, "LIESMICH.txt")).toContain("Konfliktkopie");
  });

  it("(b) gleiche Rechnungsnummer und Kunde von zwei Geräten: beide Dateien bleiben, Namen eindeutig und gleich bei jedem Lauf", () => {
    let s = rechnung(BASIS, "ra", "2026-01-22", "100,00", "2026-001");
    s = rechnung(s, "rb", "2026-01-23", "200,00", "2026-001");
    const pdfs = { ra: new Uint8Array([1]), rb: new Uint8Array([2]) };
    const a = offenesArchiv(s, {}, "2026-02-01T10:00:00.000Z", { rechnungsPdfs: pdfs });
    const z = dateienIm(a.zip);
    const namen = Object.keys(z).filter((n) => n.startsWith("Rechnungen/") || n.startsWith("E-Rechnungen/")).sort();
    expect(namen).toHaveLength(4);
    expect(new Set(namen.map((n) => n.toLowerCase())).size).toBe(4);
    // deterministisch: andere Reihenfolge im Stand, gleiche Namen
    const b = offenesArchiv({ ...s, unterlagen: [...s.unterlagen].reverse() }, {}, "2026-02-01T10:00:00.000Z", { rechnungsPdfs: pdfs });
    expect(Object.keys(dateienIm(b.zip)).filter((n) => n.startsWith("Rechnungen/") || n.startsWith("E-Rechnungen/")).sort()).toEqual(namen);
    // PDF und XML derselben Rechnung tragen denselben Namen
    const ra = namen.find((n) => n.startsWith("Rechnungen/") && z[n]![0] === 1)!;
    expect(namen).toContain(ra.replace("Rechnungen/", "E-Rechnungen/").replace(/\.pdf$/, ".xml"));
  });

  it("(b) Belege mit gleicher Nummer, Datum und Lieferant (zwei Geräte): beide Originale im Archiv", () => {
    let s = belegSetzen(BASIS, beleg("b1", "2026-01-23", { datei: "foto1111.jpg" }), t("2026-01-23"));
    s = { ...s, belege: [...s.belege, { ...beleg("b2", "2026-01-23", { datei: "foto2222.jpg" }), nr: s.belege[0]!.nr }] };
    const a = offenesArchiv(s, { "foto1111.jpg": new Uint8Array([1]), "foto2222.jpg": new Uint8Array([2]) }, "2026-02-01T10:00:00.000Z");
    const z = dateienIm(a.zip);
    const belege = Object.keys(z).filter((n) => n.startsWith("Belege/"));
    expect(belege).toHaveLength(2);
    expect(belege.map((n) => z[n]![0]).sort()).toEqual([1, 2]);
  });

  it("(b, d) Kasse: gleiche Z-Bon-Nummer an zwei Standorten und der Z-Bon der früheren Fassung bleiben erhalten", () => {
    let s = BASIS;
    [s] = kasseSpeichern(s, tag("2026-01-24", { zbon: "100", datei: "zbon1111.jpg", anfang_cent: 1000 }), t("2026-01-24", 20), "k1");
    [s] = kasseSpeichern(s, tag("2026-01-24", { zbon: "100", datei: "zbon2222.jpg", standort: "Filiale" }), t("2026-01-24", 21), "k2");
    s = kasseKorrigieren(s, "k1", tag("2026-01-24", { zbon: "100", datei: "zbon3333.jpg", anfang_cent: 1000 }), "Falsches Foto des Z-Bons angehängt", t("2026-01-25"));
    const dateien = { "zbon1111.jpg": new Uint8Array([1]), "zbon2222.jpg": new Uint8Array([2]), "zbon3333.jpg": new Uint8Array([3]) };
    const a = offenesArchiv(s, dateien, "2026-02-01T10:00:00.000Z");
    const z = dateienIm(a.zip);
    const kasse = Object.keys(z).filter((n) => n.startsWith("Kasse/"));
    expect(kasse.map((n) => z[n]![0]).sort()).toEqual([1, 2, 3]);
  });

  it("(c) festgehaltenes Original bleibt drin, auch wenn die Daten heute nicht mehr für eine E-Rechnung reichen – Archiv und Steuerberater-Paket", () => {
    const s0 = rechnung(BASIS, "r1", "2026-01-22");
    const u = s0.unterlagen[0]!;
    expect(u.xml).toBeTruthy();
    // ältere Daten: ohne festgehaltenen Absender, und „Mein Betrieb“ ist heute unvollständig (Steuernummer gelöscht)
    const { absender: _a, ...ohneAbsender } = u;
    const s: Stand = { ...s0, betrieb: { ...s0.betrieb, steuernummer: "", ust_idnr: "" }, unterlagen: [ohneAbsender] };
    const a = offenesArchiv(s, {}, "2026-02-01T10:00:00.000Z");
    const xml = Object.keys(dateienIm(a.zip)).filter((n) => n.startsWith("E-Rechnungen/"));
    expect(xml).toHaveLength(1);
    expect(text(a.zip, xml[0]!)).toBe(u.xml);
    const p = steuerpaket(s, { von: "2026-01-01", bis: "2026-01-31", name: "2026-01" }, SB, {}, "2026-02-01T10:00:00.000Z");
    const px = Object.keys(dateienIm(p.zip)).filter((n) => n.startsWith("E-Rechnungen/"));
    expect(px).toHaveLength(1);
    expect(text(p.zip, px[0]!)).toBe(u.xml);
  });

  it("Archiv-Seite erzeugt die PDFs für alle festgeschriebenen Rechnungen (auch Konfliktkopien)", () => {
    const q = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/seiten/Sicherung.tsx"), "utf8");
    expect(q).toContain("const rechnungen = archivRechnungen(s);");
  });
});
