import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { ausgabenFuer, belegAus, belegFassung, belegInhaltGeaendert, istBelegDateiname, vorsteuerFuer, type Beleg } from "../src/belege.js";
import { INFLATE_HOECHSTENS, inflate } from "../src/erechnungLesen.js";

const beleg = (o: Partial<Beleg> = {}): Beleg => ({ id: "b1", datum: "2026-10-02", lieferant: "Müller", nummer: null, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, erstellt: "2026-10-02T08:00:00Z", geaendert: "2026-10-02T08:00:00Z", ...o });

describe("Dateinamen von Belegen (G-1)", () => {
  it("lässt nur Namen zu, wie die App sie vergibt", () => {
    expect(istBelegDateiname("lx9k2abc12.jpg")).toBe(true);
    for (const boese of ["../../Library/x.jpg", "a/b.jpg", "x.jpg", "abcd", "abcd.JPG ", "..\\x.jpg", `${"a".repeat(65)}.jpg`, 3, null]) expect(istBelegDateiname(boese)).toBe(false);
  });
  it("belegAus verwirft Pfade im Dateinamen", () => {
    expect(belegAus({ ...beleg(), datei: "../../Library/Preferences/x" })?.datei).toBeNull();
    expect(belegAus({ ...beleg(), datei: "lx9k2abc12.pdf" })?.datei).toBe("lx9k2abc12.pdf");
  });
});

describe("Belege bleiben vollständig (M4, H2)", () => {
  it("behält Steuersätze aus dem 2. Halbjahr 2020 (16 % und 5 %)", () => {
    const b = belegAus({ ...beleg({ datum: "2020-09-01" }), steuer: [{ satz: 16, brutto_cent: 11600 }, { satz: 5, brutto_cent: 1050 }] });
    expect(b?.steuer).toEqual([{ satz: 16, brutto_cent: 11600 }, { satz: 5, brutto_cent: 1050 }]);
  });
  it("behält Ungültig-Vermerk und Änderungsprotokoll; ungültige Belege zählen nicht", () => {
    const alt = beleg();
    const b = belegAus({ ...beleg({ steuer: [{ satz: 19, brutto_cent: 1 }] }), ungueltig: "2026-10-05T00:00:00Z", ungueltig_grund: "doppelt", historie: [belegFassung(alt, "2026-10-04T00:00:00Z")] })!;
    expect(b.ungueltig_grund).toBe("doppelt");
    expect(b.historie?.[0]?.steuer[0]?.brutto_cent).toBe(11900);
    expect(vorsteuerFuer([b], "2026-10-01", "2026-10-31").anzahl).toBe(0);
    expect(ausgabenFuer([b], "2026").summe_cent).toBe(0);
    expect(belegInhaltGeaendert(alt, { ...alt, geaendert: "2027-01-01T00:00:00Z" })).toBe(false);
    expect(belegInhaltGeaendert(alt, { ...alt, lieferant: "Meier" })).toBe(true);
  });
});

describe("Entpackbombe im ZUGFeRD-PDF (G-2)", () => {
  it("bricht oberhalb der Grenze ab", () => {
    const bombe = zlib.deflateSync(new Uint8Array(INFLATE_HOECHSTENS + 1024));
    expect(bombe.length).toBeLessThan(100_000);
    expect(() => inflate(new Uint8Array(bombe))).toThrow(/zu groß/);
    expect(() => inflate(new Uint8Array(zlib.deflateSync(new Uint8Array(5000))), 4096)).toThrow(/zu groß/);
  });
  it("entpackt Daten unterhalb der Grenze weiter vollständig", () => {
    const daten = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
    expect(inflate(new Uint8Array(zlib.deflateSync(daten)))).toEqual(daten);
  });
});
