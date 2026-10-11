import { describe, expect, it } from "vitest";
import { zielPfad } from "./ziele";

describe("Ziele in Amtlos", () => {
  it("findet Seiten über das Aktionsziel und die Pflicht-ID", () => {
    expect(zielPfad("arbeitsschutz.erstunterweisung", "app.unterweisungen")).toBe("/personal/unterweisungen");
    expect(zielPfad("arbeitsschutz.dguv_v3", null)).toBe("/personal/arbeitsmittel");
    expect(zielPfad("steuern.ust_voranmeldung", "elster.ust_va")).toBe("/finanzen/ust");
    expect(zielPfad("x.y", "portal.gewerbeanzeige")).toBeNull();
    expect(zielPfad("it_sicherheit.nis2_pruefen", "onboarding.daten")).toBe("/onboarding/daten");
    expect(zielPfad("datenschutz.datenpanne_meldung", "app.datenpanne")).toBe("/datenschutz/pannen");
  });
});
