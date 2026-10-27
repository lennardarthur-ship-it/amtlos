/**
 * E-231 (Antwort des Steuerberaters vom 27.10.2026 zu T-323 und T-325): Erwerbe ohne Erwerbsbesteuerung sind gewöhnliche
 * Einkäufe – DATEV-Stapel mit dem Bruttobetrag, ohne Steuerschlüssel, auf dem Aufwandskonto des Belegs (Waren SKR03 3200 /
 * SKR04 5200); Vermerk „Nicht vollständig“ bei einem Beleg in der Einzahl.
 */
import { describe, expect, it } from "vitest";
import { VORLAGEN_GEPRUEFT, buchungenAusBelegen, igErwerbOhneKonto, ustNichtVollstaendig, type Beleg } from "../src/index.js";

const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-05-15", lieferant: "Fournitures SARL", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 119000 }], vorsteuer: false, zahlung: "bank", bezahlt: null, notiz: null, quelle: "hand", erstellt: "2026-05-15T09:00:00Z", geaendert: "2026-05-15T09:00:00Z", steuerschuld: "ige", lieferant_ust_idnr: "FR12345678901", ...o }) as Beleg;

describe("E-231: Erwerb ohne Erwerbsbesteuerung im DATEV-Stapel (T-323)", () => {
  it("Waren: Bruttobetrag ohne Steuerschlüssel auf Wareneingang ohne Vorsteuer (SKR03 3200 / SKR04 5200), kein Feld 116", () => {
    // Rechnung kam spät – mit Erwerbsbesteuerung stünde Feld 116; als gewöhnlicher Einkauf nicht
    const b = beleg({ erwerb_datum: "2026-02-20" });
    for (const [kr, konto] of [["SKR03", "3200"], ["SKR04", "5200"]] as const) {
      const z = buchungenAusBelegen([b], kr, { kleinunternehmer: true, igeAlsEinkauf: new Set(["b1"]) });
      expect(z).toHaveLength(1);
      expect(z[0]).toMatchObject({ betrag_cent: 119000, soll_haben: "H", gegenkonto: konto, bu_schluessel: "", datum: "2026-05-15", ust_satz: null });
      expect(z[0]!.steuerperiode ?? null).toBeNull();
    }
  });

  it("andere Kategorie: deren Konto; auch ohne Kleinunternehmer (nur steuerfreie Umsätze) nie ein Erwerbs- oder Automatikkonto", () => {
    const z = buchungenAusBelegen([beleg({ kategorie: "fremdleistungen", steuer: [{ satz: 7, brutto_cent: 50000 }] })], "SKR03", { igeAlsEinkauf: new Set(["b1"]) });
    expect(z.map((x) => [x.gegenkonto, x.bu_schluessel, x.betrag_cent])).toEqual([["3100", "", 50000]]);
    const w = buchungenAusBelegen([beleg({ vorsteuer: true })], "SKR03", { igeAlsEinkauf: new Set(["b1"]) });
    expect(w.map((x) => [x.gegenkonto, x.bu_schluessel])).toEqual([["3200", ""]]);
  });

  it("ohne die Angabe bleibt es bei den Erwerbskonten; igErwerbOhneKonto zählt gewöhnliche Einkäufe nicht", () => {
    expect(buchungenAusBelegen([beleg({})], "SKR03", { kleinunternehmer: true }).map((x) => x.gegenkonto)).toEqual(["3435"]);
    const b = beleg({ steuer: [{ satz: 16, brutto_cent: 1000 }] });
    expect(igErwerbOhneKonto([b], "SKR03", { kleinunternehmer: true })).toHaveLength(1);
    expect(igErwerbOhneKonto([b], "SKR03", { kleinunternehmer: true, igeAlsEinkauf: new Set(["b1"]) })).toHaveLength(0);
  });
});

describe("E-231: „Nicht vollständig“ in der Einzahl (T-325)", () => {
  it("1 Beleg … fehlt; mehrere Belege … fehlen", () => {
    expect(ustNichtVollstaendig(1, "ige")).toBe("Nicht vollständig: 1 Beleg ohne Euro-Betrag (innergemeinschaftlicher Erwerb) fehlt");
    expect(ustNichtVollstaendig(1, "13b")).toBe("Nicht vollständig: 1 Beleg ohne Euro-Betrag (§ 13b) fehlt");
    expect(ustNichtVollstaendig(3, "13b")).toBe("Nicht vollständig: 3 Belege ohne Euro-Betrag (§ 13b) fehlen");
  });

  it("Bestätigung als weiterer Nachweis der Freigabe ust_voranmeldung#1, Prüfsumme unverändert", () => {
    const f = VORLAGEN_GEPRUEFT.ust_voranmeldung!.weitere![0]!;
    expect(f.pruefsumme.startsWith("eb46f27c945a")).toBe(true);
    expect(f.weitere_nachweise?.some((n) => n.rolle === "steuern" && n.datum === "2026-10-27" && n.umfang.includes("T-325") && n.umfang.includes("1 Beleg ohne Euro-Betrag"))).toBe(true);
  });
});
