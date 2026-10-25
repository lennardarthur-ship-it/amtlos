/** Prüfbericht Lebensmittelhygiene (Lebensmittelfachbeauftragter, 22.10.2026, Fragen 12 und 15): Schulungsnachweis und IfSG-Bescheinigungen in der Kontrollmappe. */
import { describe, expect, it } from "vitest";
import { vorlageFuer } from "@amtlos/fachlogik";
import { T as TEXT } from "../src/texte";
import { deckblattHtml, fuerKontrolle, gehoertInMappe, mitIfsgBescheinigungen } from "../src/unterlagen/kontrollmappe";
import { STAETTEN_VORLAGEN } from "../src/unterlagen/speicher";

describe("Kontrollmappe Lebensmittel nach dem Prüfbericht", () => {
  it("nimmt den Schulungsnachweis nach § 4 LMHV in die Mappe und in die Hygiene-Kontrolle", () => {
    expect(gehoertInMappe(vorlageFuer("hygieneschulung")!)).toBe(true);
    expect(fuerKontrolle("hygieneschulung", "hygiene")).toBe(true);
    expect(fuerKontrolle("hygieneschulung", "alle")).toBe(true);
    expect(fuerKontrolle("hygieneschulung", "zoll")).toBe(false);
    expect(STAETTEN_VORLAGEN.has("hygieneschulung")).toBe(true);
  });

  it("erinnert auf dem Deckblatt an die Bescheinigungen des Gesundheitsamts, wenn eine Belehrung nach § 43 IfSG dabei ist", () => {
    expect(mitIfsgBescheinigungen(["haccp", "ifsg_belehrung"])).toBe(true);
    expect(mitIfsgBescheinigungen(["haccp", "allergene"])).toBe(false);
    expect(TEXT.lm_mappe_ifsg_bescheinigungen).toMatch(/Bescheinigungen des Gesundheitsamts.*§ 43 Abs\. 5 IfSG/);
    const html = deckblattHtml("Café Mond", "2026-10-22", [], "Hygiene", [], { hinweis: TEXT.lm_mappe_ifsg_bescheinigungen });
    expect(html).toContain("Bescheinigungen des Gesundheitsamts");
  });
});
