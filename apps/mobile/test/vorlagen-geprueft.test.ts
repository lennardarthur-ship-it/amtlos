/**
 * Unter den Vorlagen steht der Vermerk aus @amtlos/fachlogik (pruefHinweisFuer) – „Vorlage fachlich durchgesehen von
 * einem … (Stand …)“ nur bei unterschriebener Freigabe mit passender Prüfsumme (E-196), sonst der allgemeine Prüfhinweis.
 * Nie im PDF.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRUEFHINWEIS, VORLAGEN, dokumentHtml, pruefHinweisFuer, vorlageFuer } from "@amtlos/fachlogik";
import { LEERER_STAND } from "../src/unterlagen/speicher";

const APP = path.resolve(__dirname, "..");
const quelle = (d: string) => fs.readFileSync(path.join(APP, d), "utf8");

describe("Vermerk je Vorlage in der App", () => {
  it("Abschluss (mit Daten der Unterlage) und Info-Seite nutzen pruefHinweisFuer statt des festen Hinweises", () => {
    expect(quelle("src/seiten/Abschluss.tsx")).toContain("{pruefHinweisFuer(v, d, z.stand.betrieb)}");
    expect(quelle("src/seiten/InfoSeite.tsx")).toContain("{pruefHinweisFuer(v)}");
    for (const d of ["src/seiten/Abschluss.tsx", "src/seiten/InfoSeite.tsx"]) expect(quelle(d), d).not.toMatch(/\{PRUEFHINWEIS\}/);
  });

  it("E-196: zurzeit bei keiner Vorlage ein Vermerk (unterschrieben sind nur fünf, und die haben seit E-193 eine neue Fußzeile)", () => {
    for (const v of VORLAGEN) {
      expect(pruefHinweisFuer(v, {}), v.id).toBe(PRUEFHINWEIS);
      if (v.id === "hygieneplan") for (const art of ["lebensmittel", "beauty"]) expect(pruefHinweisFuer(v, { art }), art).toBe(PRUEFHINWEIS);
    }
    expect(pruefHinweisFuer(vorlageFuer("handelsregister")!, { rechtsform: "GmbH" })).toBe(PRUEFHINWEIS);
  });

  it("nie im PDF", () => {
    for (const v of VORLAGEN) expect(dokumentHtml(v, {}, LEERER_STAND.betrieb), v.id).not.toContain("fachlich durchgesehen");
  });
});
