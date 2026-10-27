/**
 * E-223 (Entscheidung zu T-124/T-270): Der Katalog-Import vergleicht vorhandene Versionen ohne interne Notizen
 * (`fachlich_zu_pruefen`) und ohne Prüfstand (`pruefung`) – eine nachgezogene Notiz ist keine neue Fassung.
 * Geänderter Inhalt einer vorhandenen Version bleibt ein Fehler. (Ohne Datenbank: Vergleich direkt.)
 */
import { describe, expect, it } from "vitest";
import { NICHT_INHALT, gleicherInhalt } from "../src/index.js";

const basis = { id: "steuern.ust.satz_regel", version: 1, wert: 19, gueltig_ab: "2026-01-01", fachlich_zu_pruefen: ["[FACHLICH ZU PRÜFEN] alt"], pruefung: { status: "entwurf" } };

describe("E-223: Import-Vergleich ohne Notizen und Prüfstand", () => {
  it("nur Notiz bzw. Prüfstand geändert: gleicher Inhalt", () => {
    expect(gleicherInhalt(basis, { ...basis, fachlich_zu_pruefen: ["bestätigt"] })).toBe(true);
    expect(gleicherInhalt(basis, { ...basis, pruefung: { status: "freigegeben", geprueft_version: 1 } })).toBe(true);
    const { fachlich_zu_pruefen: _f, ...ohneNotiz } = basis;
    expect(gleicherInhalt(basis, ohneNotiz)).toBe(true);
  });
  it("Inhalt geändert (Wert, gültig ab, Text): weiterhin verschieden", () => {
    expect(gleicherInhalt(basis, { ...basis, wert: 7 })).toBe(false);
    expect(gleicherInhalt(basis, { ...basis, gueltig_ab: "2007-01-01" })).toBe(false);
    expect(gleicherInhalt(basis, { ...basis, aenderungsnotiz: { de: "neu" } })).toBe(false);
  });
  it("genau diese drei Felder (E-233: dazu nicht_vor_freigabe)", () => {
    expect([...NICHT_INHALT].sort()).toEqual(["fachlich_zu_pruefen", "nicht_vor_freigabe", "pruefung"]);
  });
});
