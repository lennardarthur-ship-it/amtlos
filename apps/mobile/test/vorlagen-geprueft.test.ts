/**
 * Unter den Vorlagen steht der Vermerk aus @amtlos/fachlogik (pruefHinweisFuer) – „Vorlage fachlich durchgesehen von
 * einem … (Stand …)“ nur bei schriftlich bestätigter Freigabe (E-197), wenn die Varianten, die den Betrieb und die
 * Unterlage betreffen (Rechtsform, Land, Rechnungsart), seit der Bestätigung unverändert sind (E-196), sonst der
 * allgemeine Prüfhinweis.
 * Nie im PDF.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRUEFHINWEIS, VORLAGEN, dokumentHtml, pruefHinweisFuer, vorlageFuer, type Daten } from "@amtlos/fachlogik";
import { LEERER_STAND } from "../src/unterlagen/speicher";

const APP = path.resolve(__dirname, "..");
const quelle = (d: string) => fs.readFileSync(path.join(APP, d), "utf8");

describe("Vermerk je Vorlage in der App", () => {
  it("Abschluss (mit Daten der Unterlage) und Info-Seite nutzen pruefHinweisFuer statt des festen Hinweises", () => {
    expect(quelle("src/seiten/Abschluss.tsx")).toContain("{pruefHinweisFuer(v, d, z.stand.betrieb)}");
    expect(quelle("src/seiten/InfoSeite.tsx")).toContain("{pruefHinweisFuer(v, undefined, z.stand.betrieb)}");
    for (const d of ["src/seiten/Abschluss.tsx", "src/seiten/InfoSeite.tsx"]) expect(quelle(d), d).not.toMatch(/\{PRUEFHINWEIS\}/);
  });

  it("E-197: Vermerk bei allen schriftlich bestätigten Vorlagen – nicht in Varianten, die sich seit der Bestätigung geändert haben", () => {
    // Handelsregister nur für GmbH, OHG, KG; Rechnung nicht für GmbH & Co. KG (Bilanz: nur Name → Rolle, E-197)
    const OHNE = ["handelsregister"];
    const cafe = { ...LEERER_STAND.betrieb, name: "Café Sonne", bundesland: "Berlin" };
    const coKg = { ...cafe, name: "Sonne GmbH & Co. KG", rechtsform: "GmbH & Co. KG" };
    for (const v of VORLAGEN) {
      const d: Daten = v.id === "hygieneplan" ? { art: "lebensmittel" } : {};
      expect(pruefHinweisFuer(v, d, cafe) !== PRUEFHINWEIS, v.id).toBe(!OHNE.includes(v.id));
      expect(pruefHinweisFuer(v, d, coKg) !== PRUEFHINWEIS, v.id).toBe(!OHNE.includes(v.id) && v.id !== "rechnung");
      if (v.id === "hygieneplan") expect(pruefHinweisFuer(v, { art: "beauty" }, cafe)).toContain("von einem Rechtsanwalt (Länderzusatz nur für Bayern geprüft)");
    }
    expect(pruefHinweisFuer(vorlageFuer("rechnung")!, {}, cafe)).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 23.10.2026)");
    expect(pruefHinweisFuer(vorlageFuer("rechnung")!, { storno_zu: "RE-1", schluss: true, storno_abschlaege: true }, cafe)).toBe(PRUEFHINWEIS);
    expect(pruefHinweisFuer(vorlageFuer("handelsregister")!, { rechtsform: "GmbH" }, { ...cafe, rechtsform: "GmbH" })).toBe("Vorlage fachlich durchgesehen von einem Rechtsanwalt (Stand 25.10.2026)");
    expect(pruefHinweisFuer(vorlageFuer("bilanz_guv")!, {}, { ...cafe, rechtsform: "GmbH" })).toContain("von einem Steuerberater");
  });

  it("nie im PDF", () => {
    for (const v of VORLAGEN) expect(dokumentHtml(v, {}, LEERER_STAND.betrieb), v.id).not.toContain("fachlich durchgesehen");
  });
});
