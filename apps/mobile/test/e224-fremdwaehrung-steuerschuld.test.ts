/**
 * E-224: Ein Beleg mit innergemeinschaftlichem Erwerb (E-222) bzw. § 13b in fremder Währung (E-221) ohne eingetragenen
 * Euro-Betrag hat 0 €. Die Voranmeldung zählte ihn als „übernommen“, setzte aber nichts in Kz 89/93/61 bzw. 46/47, 84/85, 67
 * und warnte nicht. Jetzt: Warnung in der Übernahme, Zeile auf dem PDF, Rückfrage vor dem Teilen bzw. Drucken.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ustNichtVollstaendig, type Beleg } from "@amtlos/fachlogik";
import { T as TEXT } from "../src/texte";
import { LEERER_STAND, type Stand, type Unterlage } from "../src/unterlagen/speicher";
import { vaOhneEuroFrage } from "../src/unterlagen/pruefung";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");

const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", steuernummer: "13/123/45678" };
const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-03-10", lieferant: "Supplier AB", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100000 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, quelle: "erechnung", erstellt: "2026-03-10T09:00:00Z", geaendert: "2026-03-10T09:00:00Z", ...o }) as Beleg;
const fremd = { waehrung: "SEK", steuer: [{ satz: 19, brutto_cent: 1000000 }] };
const igeSek = beleg({ id: "ige-sek", steuerschuld: "ige", lieferant_ust_idnr: "SE123456789001", fremd, steuer: [{ satz: 19, brutto_cent: 0 }] });
const rcUsd = beleg({ id: "rc-usd", steuerschuld: "eu", kategorie: "buero", fremd: { waehrung: "USD", steuer: [{ satz: 0, brutto_cent: 5000 }] }, steuer: [{ satz: 0, brutto_cent: 0 }] });

describe("E-224: Voranmeldung warnt bei Steuerschuld-Belegen ohne Euro-Betrag", () => {
  it("innergemeinschaftlicher Erwerb in SEK ohne Euro-Betrag: nicht als übernommen gezählt, Warnung und Zeile auf dem PDF", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [igeSek], false)!;
    expect(r.igeBelege).toBe(0);
    expect(r.igeOhneEuro).toBe(1);
    // keine Felder gesetzt – von Hand Eingetragenes bleibt stehen
    expect(r.werte).not.toHaveProperty("ige_19");
    expect(TEXT.e224_ige_ohne_euro(2)).toContain("2 Belege mit innergemeinschaftlichem Erwerb ohne Euro-Betrag – nicht in Kz 89/93/61 enthalten");
    expect(TEXT.e224_ige_ohne_euro(1)).toContain("1 Beleg mit innergemeinschaftlichem Erwerb ohne Euro-Betrag – nicht in Kz 89/93/61 enthalten");
    // E-227: auf dem PDF jetzt im Wortlaut des Steuerberaters oben („Nicht vollständig“) statt unter den Annahmen
    expect(r.werte.unvollstaendig).toBe(ustNichtVollstaendig(1, "ige"));
  });

  it("§ 13b in USD ohne Euro-Betrag: Warnung (Kz 46/47, 84/85, 67) – auch im Kleinunternehmer-Zeitraum", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [rcUsd], false)!;
    expect(r.steuerschuldBelege).toBe(0);
    expect(r.rcOhneEuro).toBe(1);
    expect(r.werte).not.toHaveProperty("rc_eu_netto");
    expect(r.werte.unvollstaendig).toBe(ustNichtVollstaendig(1, "13b"));
    expect(TEXT.e224_13b_ohne_euro(1)).toContain("nicht in Kz 46/47, 84/85 und 67 enthalten");
    const ku = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [rcUsd, igeSek], true)!;
    expect(ku.kleinunternehmer).toBe(true);
    expect(ku.rcOhneEuro).toBe(1);
    // Kleinunternehmer: Erwerbe werden ohnehin nicht übernommen (Erwerbsschwelle) – weiter im Hinweis dazu gezählt
    expect(ku.igeKu).toBe(1);
  });

  it("mit Euro-Betrag keine Warnung", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [{ ...igeSek, steuer: [{ satz: 19, brutto_cent: 86957 }] }], false)!;
    expect(r).toMatchObject({ igeBelege: 1, igeOhneEuro: 0, rcOhneEuro: 0 });
    expect(r.werte.annahmen).not.toContain("ohne Euro-Betrag");
  });

  it("Rückfrage vor dem Teilen der Voranmeldung, solange solche Belege im Zeitraum liegen", () => {
    const va = (zeitraum: string): Unterlage => ({ id: "va", vorlage: "ust_voranmeldung", daten: { zeitraum }, erstellt: "2026-04-02T09:00:00Z", geaendert: "2026-04-02T09:00:00Z" }) as Unterlage;
    const s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, belege: [igeSek, rcUsd] };
    const q = vaOhneEuroFrage(s, va("März 2026"))!;
    expect(q.titel).toBe(TEXT.e224_frage_titel);
    expect(q.text).toContain(TEXT.e224_ige_ohne_euro(1));
    expect(q.text).toContain(TEXT.e224_13b_ohne_euro(1));
    expect(q.ja).toBe(TEXT.e224_frage_ja);
    expect(vaOhneEuroFrage(s, va("1. Quartal 2026"))).not.toBeNull();
    expect(vaOhneEuroFrage(s, va("April 2026"))).toBeNull();
    expect(vaOhneEuroFrage({ ...s, belege: [] }, va("März 2026"))).toBeNull();
    expect(vaOhneEuroFrage(s, { ...va("März 2026"), vorlage: "rechnung" })).toBeNull();
  });

  it("Teilen/Drucken fragt vor der Ausgabe; die Übernahme zeigt die Warnung", () => {
    const abschluss = lies("seiten/Abschluss.tsx");
    const ausgabe = abschluss.slice(abschluss.indexOf("const ausgabe = async"), abschluss.indexOf("const eRechnung = async"));
    expect(ausgabe).toMatch(/vaOhneEuroFrage\(z\.stand, u\)/);
    expect(ausgabe.indexOf("vaOhneEuroFrage")).toBeLessThan(ausgabe.indexOf("pdfAusgabe(u, "));
    // E-239: als Blocker (sichtbarer Kasten) in ustMeldungen.ts
    const ablauf = lies("seiten/ustMeldungen.ts");
    expect(ablauf).toMatch(/r\.igeOhneEuro \? blocker\(TEXT\.e224_ige_ohne_euro\(r\.igeOhneEuro\)\)/);
    expect(ablauf).toMatch(/r\.rcOhneEuro \? blocker\(TEXT\.e224_13b_ohne_euro\(r\.rcOhneEuro\)\)/);
  });
});
