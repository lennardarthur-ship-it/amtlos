/**
 * E-166: Rückverfolgbarkeit und Wassertank im Foodtruck im Pflichten-Check; HACCP-Vorlage mit Gefahrenanalyse und CCP
 * in den Unterlagen.
 */
import { describe, expect, it } from "vitest";
import { GEFAHRENANALYSE, leereDaten, LEERER_BETRIEB, vorlageFuer } from "@amtlos/fachlogik";
import { KATALOG, auswertung, type Profil } from "../src/pflichten/check";

const ids = (l: { id: string }[]) => l.map((p) => p.id);
const foodtruck: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BW", "beschaeftigte.gesamt": 0, "erlaubnis.gewo_paragraphen": ["55"], "vertrieb.kanaele": ["marktstand"], gruendungsdatum: "2026-12-01" };
const cafe: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "SN", "beschaeftigte.gesamt": 2, "vertrieb.kanaele": ["ladengeschaeft"], "erlaubnis.gewo_paragraphen": [], gruendungsdatum: "2022-03-01" };

describe("Pflichten-Check: Rückverfolgbarkeit und Trinkwasser im Foodtruck", () => {
  it("beide Einträge im gebündelten Katalog, als Entwurf mit offenen Prüfpunkten", () => {
    for (const id of ["branche.gastro_rueckverfolgbarkeit", "branche.gastro_trinkwasser_mobil"]) {
      const p = KATALOG.pflichten.find((x) => x.id === id);
      expect(p, id).toBeDefined();
      expect((p as unknown as { pruefung: { status: string } }).pruefung.status).toBe("entwurf");
    }
  });
  it("Foodtruck: Rückverfolgbarkeit und Anzeige des Wassertanks vier Wochen vor dem Start", () => {
    const a = auswertung(foodtruck, "2026-10-22");
    expect(ids(a.gilt)).toEqual(expect.arrayContaining(["branche.gastro_rueckverfolgbarkeit", "branche.gastro_trinkwasser_mobil"]));
    expect(a.gilt.find((p) => p.id === "branche.gastro_trinkwasser_mobil")!.naechsterTermin).toBe("2026-11-03");
  });
  it("Café mit Laden: Rückverfolgbarkeit ja, Wassertank nein; Salon: keines von beiden", () => {
    const a = auswertung(cafe, "2026-10-22");
    expect(ids(a.gilt)).toContain("branche.gastro_rueckverfolgbarkeit");
    expect(ids(a.gilt)).not.toContain("branche.gastro_trinkwasser_mobil");
    const salon = auswertung({ ...cafe, "taetigkeit.branchen": ["beauty_kosmetik"] }, "2026-10-22");
    expect(ids(salon.gilt)).not.toEqual(expect.arrayContaining(["branche.gastro_rueckverfolgbarkeit"]));
  });
});

describe("HACCP-Vorlage in der App", () => {
  it("neue Unterlage: Gefahrenanalyse und CCP leer (Vorschläge zum Übernehmen), Verantwortlich und Aufbewahrung vorbelegt", () => {
    const d = leereDaten(vorlageFuer("haccp")!, { ...LEERER_BETRIEB, verantwortlich: "Mara Lindner" }, "2026-10-22", ["gastro_cafe"]);
    expect(d.gefahren).toEqual([]);
    expect(d.ccps).toEqual([]);
    expect(d.verantwortlich).toBe("Mara Lindner");
    expect(String(d.aufbewahrung)).toMatch(/^12 Monate/);
    expect(GEFAHRENANALYSE.some((x) => x.gruppe === "Foodtruck / mobiler Verkauf")).toBe(true);
  });
});
