import { describe, expect, it } from "vitest";
import { zielPfad } from "./ziele";

describe("Ziele in Amtlos", () => {
  it("findet Seiten über das Aktionsziel und die Pflicht-ID", () => {
    expect(zielPfad("arbeitsschutz.erstunterweisung", "app.unterweisungen")).toBe("/personal/unterweisungen");
    expect(zielPfad("arbeitsschutz.dguv_v3", null, "alles")).toBe("/personal/arbeitsmittel");
    expect(zielPfad("steuern.ust_voranmeldung", "elster.ust_va")).toBe("/finanzen/ust");
    expect(zielPfad("x.y", "portal.gewerbeanzeige")).toBeNull();
    expect(zielPfad("it_sicherheit.nis2_pruefen", "onboarding.daten")).toBe("/onboarding/daten");
    expect(zielPfad("datenschutz.datenpanne_meldung", "app.datenpanne", "alles")).toBe("/datenschutz/pannen");
  });
  it("Werkzeuge versteckter Module verlinken nicht (E-110)", () => {
    expect(zielPfad("arbeitsschutz.dguv_v3", null, "kern")).toBeNull();
    expect(zielPfad("datenschutz.datenpanne_meldung", "app.datenpanne", "kern")).toBeNull();
    expect(zielPfad("arbeitsschutz.erstunterweisung", "app.unterweisungen", "kern")).toBe("/personal/unterweisungen");
  });
});
