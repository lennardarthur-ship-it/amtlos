/**
 * E-213: Antworten der Prüfer vom 26.10.2026 (Mails beim Gründer) zu den Vorlagen.
 * - Rechnung: Der Steuerberater hat die nach E-208 geänderte Fassung bestätigt (Beispiel-PDFs mit Bruttopreisen = Gruppe
 *   `basis` und Standard) – neue Freigabe über die heutigen Teilsummen aller Varianten.
 * - Impressum der GmbH & Co. KG und der UG (haftungsbeschränkt) & Co. KG: Der Rechtsanwalt hat die Passage aus E-210
 *   bestätigt und zwei Änderungen vorgegeben bzw. vorab bestätigt – Stammkapital entfällt bei der Co. KG, Überschrift
 *   einheitlich „Vertreten durch“. Freigabe nur für diese zwei Varianten; alle anderen Varianten unverändert.
 */
import { describe, expect, it } from "vitest";
import { FREIGEGEBENE_TEILSUMMEN } from "../src/dokumente/geprueft-teilsummen.js";
import { PRUEFSTAENDE } from "../src/dokumente/pruefstaende.js";
import { LEERER_BETRIEB, freigabeBestaetigt, freigabenFuer, pruefHinweisFuer, vorlageFuer, type Betrieb } from "../src/index.js";

const imp = vorlageFuer("impressum")!;
const rechnung = vorlageFuer("rechnung")!;
const basis: Betrieb = { ...LEERER_BETRIEB, name: "Muster Betrieb", strasse: "Musterstraße 1", plz: "10115", ort: "Musterstadt", telefon: "030 1234567", email: "info@muster.example", bundesland: "Berlin", verantwortlich: "Alex Muster" };
const coKg: Betrieb = {
  ...basis, name: "Muster GmbH & Co. KG", rechtsform: "GmbH & Co. KG", registergericht: "Amtsgericht Musterstadt", registernummer: "HRA 1004", vertretung: "Alex Muster, Kim Beispiel",
  komplementaer: "Muster Verwaltungs GmbH", komplementaer_rechtsform: "GmbH", komplementaer_sitz: "Musterstadt", komplementaer_registergericht: "Amtsgericht Musterstadt", komplementaer_registernummer: "HRB 2001",
};
const ugCoKg: Betrieb = { ...coKg, name: "Muster UG (haftungsbeschränkt) & Co. KG", rechtsform: "UG (haftungsbeschränkt) & Co. KG", komplementaer: "Muster Verwaltungs UG (haftungsbeschränkt)", komplementaer_rechtsform: "UG (haftungsbeschränkt)" };
const CO_KG = ["rf:GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG"];
const KAPITAL = { kapital: "25.000 €", ausstehend: "keine" };

describe("E-213 Impressum der Co. KG: kein Stammkapital, Überschrift „Vertreten durch“", () => {
  it("GmbH & Co. KG und UG & Co. KG: Überschrift „Vertreten durch“ mit der Passage aus E-210, kein Stammkapital", () => {
    for (const b of [coKg, ugCoKg]) {
      const t = imp.alsText!(KAPITAL, b);
      expect(t, b.rechtsform).toMatch(/\nVertreten durch\ndie persönlich haftende Gesellschafterin Muster Verwaltungs /);
      expect(t, b.rechtsform).not.toContain("Vertretungsberechtigte Geschäftsführung");
      expect(t, b.rechtsform).not.toContain("Stammkapital");
      expect(t, b.rechtsform).not.toContain("Ausstehende Einlagen");
      // Registerangaben der Komplementärin bleiben
      expect(t, b.rechtsform).toContain("Amtsgericht Musterstadt HRB 2001");
    }
  });
  it("GmbH und UG unverändert: „Vertretungsberechtigte Geschäftsführung“ und Stammkapital", () => {
    for (const rf of ["GmbH", "UG (haftungsbeschränkt)"]) {
      const t = imp.alsText!(KAPITAL, { ...basis, name: `Muster ${rf}`, rechtsform: rf, vertretung: "Alex Muster" });
      expect(t, rf).toContain("Vertretungsberechtigte Geschäftsführung\nAlex Muster");
      expect(t, rf).toContain("Stammkapital\n25.000 €\nAusstehende Einlagen: keine");
    }
  });
  it("heutige Teilsummen: gegenüber der Freigabe vom 23.10.2026 nur die zwei Co.-KG-Varianten anders", () => {
    const heute = PRUEFSTAENDE["impressum"]!.teile;
    const frei = FREIGEGEBENE_TEILSUMMEN["impressum"]!;
    expect(Object.keys(heute).sort()).toEqual(Object.keys(frei).sort());
    expect(Object.keys(heute).filter((g) => heute[g] !== frei[g]).sort()).toEqual([...CO_KG].sort());
  });
  it("Prüfvermerk des Rechtsanwalts (Stand 26.10.2026) genau für die zwei Co.-KG-Varianten, sonst weiter 23.10.2026", () => {
    const zweite = freigabenFuer("impressum")[1]!;
    expect(zweite.rolle).toBe("recht");
    expect(zweite.varianten).toEqual(CO_KG);
    expect(freigabeBestaetigt(zweite)).toBe(true);
    for (const g of CO_KG) expect(FREIGEGEBENE_TEILSUMMEN["impressum#1"]![g], g).toBe(PRUEFSTAENDE["impressum"]!.teile[g]);
    for (const b of [coKg, ugCoKg]) expect(pruefHinweisFuer(imp, {}, b), b.rechtsform).toMatch(/von einem Rechtsanwalt.*Stand 26\.10\.2026/);
    for (const rf of ["GmbH", "UG (haftungsbeschränkt)", "KG", "OHG", "e. K.", "Einzelunternehmen"])
      expect(pruefHinweisFuer(imp, {}, { ...basis, name: `Muster ${rf}`, rechtsform: rf }), rf).toMatch(/von einem Rechtsanwalt.*Stand 23\.10\.2026/);
  });
});

describe("E-213 Rechnung: vom Steuerberater erneut bestätigt (E-208, PRUEFLISTE T-245)", () => {
  it("neue Freigabe über die heutigen Teilsummen aller Varianten", () => {
    const f = freigabenFuer("rechnung");
    const neu = f[f.length - 1]!;
    expect(neu.rolle).toBe("steuern");
    expect(neu.stand).toBe("2026-10-26");
    expect(neu.varianten).toBeUndefined();
    expect(freigabeBestaetigt(neu)).toBe(true);
    expect(FREIGEGEBENE_TEILSUMMEN[`rechnung#${f.length - 1}`]).toEqual(PRUEFSTAENDE["rechnung"]!.teile);
  });
  it("Vermerk wieder da – Einzelunternehmen, GmbH, Co. KG, Storno einer Schlussrechnung", () => {
    for (const b of [{ ...basis, name: "Café Sonne" }, { ...basis, name: "Muster GmbH", rechtsform: "GmbH" }, coKg, ugCoKg]) {
      expect(pruefHinweisFuer(rechnung, {}, b), b.name).toMatch(/von einem Steuerberater \(Stand 26\.10\.2026\)/);
    }
    expect(pruefHinweisFuer(rechnung, { storno_zu: "R-1", schluss: true, storno_abschlaege: true }, coKg)).toMatch(/von einem Steuerberater \(Stand 26\.10\.2026\)/);
  });
});
