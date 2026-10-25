/**
 * Nachkontrolle T. Baum (23.10.2026): Unter den Vorlagen steht der Vermerk aus @amtlos/fachlogik (pruefHinweisFuer) –
 * „Vorlagen fachlich durchgesehen (Stand 23.10.2026)“ bei den freigegebenen Vorlagen, solange die Prüfsumme passt, sonst
 * der allgemeine Prüfhinweis. Nie im PDF.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRUEFHINWEIS, VORLAGEN, dokumentHtml, pruefHinweisFuer, vorlageFuer } from "@amtlos/fachlogik";
import { LEERER_STAND } from "../src/unterlagen/speicher";

const APP = path.resolve(__dirname, "..");
const quelle = (d: string) => fs.readFileSync(path.join(APP, d), "utf8");
const VERMERK = "Vorlagen fachlich durchgesehen (Stand 23.10.2026)";

describe("Vermerk je Vorlage in der App", () => {
  it("Abschluss (mit Daten der Unterlage) und Info-Seite nutzen pruefHinweisFuer statt des festen Hinweises", () => {
    expect(quelle("src/seiten/Abschluss.tsx")).toContain("{pruefHinweisFuer(v, d, z.stand.betrieb)}");
    expect(quelle("src/seiten/InfoSeite.tsx")).toContain("{pruefHinweisFuer(v)}");
    for (const d of ["src/seiten/Abschluss.tsx", "src/seiten/InfoSeite.tsx"]) expect(quelle(d), d).not.toMatch(/\{PRUEFHINWEIS\}/);
  });

  it("die fünf freigegebenen Vorlagen mit Vermerk, der Hygieneplan nur als Lebensmittelbetrieb", () => {
    for (const id of ["haccp", "allergene", "ifsg_belehrung", "hygieneschulung"]) expect(pruefHinweisFuer(vorlageFuer(id)!, {}), id).toBe(VERMERK);
    expect(pruefHinweisFuer(vorlageFuer("hygieneplan")!, { art: "lebensmittel" })).toBe(VERMERK);
    expect(pruefHinweisFuer(vorlageFuer("hygieneplan")!, { art: "beauty" })).toBe("Vorlagen fachlich durchgesehen (Stand 25.10.2026)");
    for (const id of ["rechnung", "unterweisung", "impressum", "hautschutzplan"]) expect(pruefHinweisFuer(vorlageFuer(id)!, {}), id).toBe(VERMERK);
    // Gefährdungsbeurteilung: Vermerk mit den Baustein-Korrekturen der Durchsicht vom 23.10.2026 entfallen
    for (const id of ["handelsregister"]) expect(pruefHinweisFuer(vorlageFuer(id)!, {}), id).toBe(PRUEFHINWEIS); // ohne Rechtsform kein Vermerk
  });

  it("nie im PDF", () => {
    for (const v of VORLAGEN) expect(dokumentHtml(v, {}, LEERER_STAND.betrieb), v.id).not.toContain("fachlich durchgesehen");
  });
});
