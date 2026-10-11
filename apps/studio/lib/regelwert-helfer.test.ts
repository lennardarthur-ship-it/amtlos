import { describe, expect, it } from "vitest";
import { ausFormular, zahlAusText } from "./regelwert-helfer";

describe("Regelwert-Formular", () => {
  it("liest deutsche und technische Zahlen", () => {
    expect(zahlAusText("13,90")).toBe(13.9);
    expect(zahlAusText("25.000")).toBe(25000); // Dreiergruppen = Tausendertrenner
    expect(zahlAusText("13.90")).toBe(13.9);
    expect(zahlAusText("25.000,01")).toBe(25000.01);
    expect(zahlAusText("800000")).toBe(800000);
    expect(zahlAusText("")).toBeNull();
    expect(zahlAusText("abc")).toBeNull();
  });

  it("baut das Dokument, leere Quellen und optionale Felder entfallen, feste Einheit gewinnt", () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({
      bezeichnung_de: "Mindestlohn", bezeichnung_en: "", wert: "13,90", einheit: "EUR", gueltig_ab: "2026-01-01", gueltig_bis: "",
      status_recht: "in_kraft", rechtsgrundlage: "§ 1 MiLoG\n\n", q0_titel: "MiLoG", q0_url: "https://example.org", q0_abgerufen: "", q0_fundstelle: "",
      q1_titel: "", q1_url: "", katalog_nr: "", fachlich_zu_pruefen: "Datum prüfen",
    })) f.set(k, v);
    expect(ausFormular(f, "personal.mindestlohn", "EUR_pro_stunde")).toEqual({
      id: "personal.mindestlohn", bezeichnung: { de: "Mindestlohn" }, einheit: "EUR_pro_stunde", wert: 13.9, gueltig_ab: "2026-01-01", gueltig_bis: null,
      status_recht: "in_kraft", rechtsgrundlage: ["§ 1 MiLoG"], quellen: [{ titel: "MiLoG", url: "https://example.org", abgerufen: null }],
      fachlich_zu_pruefen: ["Datum prüfen"],
    });
  });
});
