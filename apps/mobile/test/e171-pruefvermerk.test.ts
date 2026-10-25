import { describe, expect, it } from "vitest";
import { PRUEFER, VERMERK_NEUTRAL, istGeprueft, pruefVermerk } from "../src/pflichten/pruefer";
import { katalogGeprueft } from "../src/rechtshinweis";

const frei = { status: "freigegeben", geprueft_von: ["RA Dr. Ulrich Weber"], geprueft_am: "2026-10-22", geprueft_version: 3 };

describe("E-171 Prüfvermerk je Katalogeintrag", () => {
  it("gilt nur für die geprüfte Version", () => {
    expect(istGeprueft(3, frei)).toBe(true);
    expect(istGeprueft(4, frei)).toBe(false); // inhaltlich geändert ⇒ Kennzeichnung entfällt
    expect(istGeprueft(3, { ...frei, status: "entwurf" })).toBe(false);
    expect(istGeprueft(3, { ...frei, geprueft_version: null })).toBe(false);
    expect(istGeprueft(3, undefined)).toBe(false);
  });

  it("nennt den Prüfer nur mit Freigabe der Nennung, sonst neutral", () => {
    const v = pruefVermerk(3, frei)!;
    if (PRUEFER["RA Dr. Ulrich Weber"]!.nennung) expect(v).toContain("Dr. Ulrich Weber");
    else expect(v).toBe(VERMERK_NEUTRAL.replace("{stand}", "22.10.2026"));
    expect(v).toContain("22.10.2026");
    expect(v).not.toMatch(/rechtssicher|garantiert|freigegeben/i);
    expect(pruefVermerk(4, frei)).toBeNull();
  });

  it("Wortlaut der Prüfer ohne verbotene Zusätze", () => {
    for (const p of Object.values(PRUEFER)) expect(p.wortlaut).not.toMatch(/rechtssicher|garantiert|freigegeben/i);
  });

  it("Anteil geprüft: keine, teil, alle (nur geltendes Recht)", () => {
    const e = { version: 1, status_recht: "in_kraft", pruefung: { status: "entwurf" } };
    const g = { version: 3, status_recht: "in_kraft", pruefung: frei };
    const radar = { version: 1, status_recht: "geplant", pruefung: { status: "entwurf" } };
    expect(katalogGeprueft([e, radar])).toBe("keine");
    expect(katalogGeprueft([e, g])).toBe("teil");
    expect(katalogGeprueft([g, radar])).toBe("alle");
  });
});

import { nennungGilt } from "../src/pflichten/pruefer";
describe("Nennung höchstens zwölf Monate nach dem Prüfdatum (Vereinbarung Dr. Weber § 4 Abs. 3)", () => {
  it("vergleicht das Prüfdatum mit dem Gerätedatum", () => {
    expect(nennungGilt("2026-10-25", 12, new Date(2027, 9, 24))).toBe(true);
    expect(nennungGilt("2026-10-25", 12, new Date(2027, 9, 25))).toBe(false);
    expect(nennungGilt("2026-10-25", undefined, new Date(2030, 0, 1))).toBe(true);
  });
});
