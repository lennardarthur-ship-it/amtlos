import { describe, expect, it } from "vitest";
import { WERKZEUGE, WERKZEUG_PFAD, branchenAusProfil } from "./branchen";

describe("Branchenpakete", () => {
  it("liest die Branchen aus dem Profil in fester Reihenfolge; Onlineshop zählt als Onlinehandel", () => {
    expect(branchenAusProfil({ "taetigkeit.branchen": ["handwerk", "gastronomie_lebensmittel", "sonstige"] })).toEqual(["gastronomie_lebensmittel", "handwerk"]);
    expect(branchenAusProfil({ "vertrieb.kanaele": ["onlineshop"] })).toEqual(["onlinehandel"]);
    expect(branchenAusProfil({})).toEqual([]);
  });
  it("jedes Werkzeug hat eine Seite", () => {
    for (const w of Object.values(WERKZEUGE).flat()) expect(WERKZEUG_PFAD[w]).toMatch(/^\//);
  });
});
