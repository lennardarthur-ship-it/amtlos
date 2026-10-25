/** Rechtsanwalt Runde 4 (25.10.2026): Handelsregister nur für GmbH, OHG und KG bestätigt – Vermerk nur bei diesen Rechtsformen. */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, VORLAGEN_GEPRUEFT, vorlageFuer, vorlageGeprueft, vorlagenPruefsumme, type VorlagenFreigabe } from "../src/index.js";

describe("Freigabe auf Rechtsformen beschränkt", () => {
  const v = vorlageFuer("handelsregister")!;
  // unterschriebene Test-Freigabe (E-196); die Prüfsumme rechnet nur mit Beispielbetrieben dieser Rechtsformen
  const RF = ["GmbH", "OHG", "KG"];
  const f: VorlagenFreigabe = { stand: "2026-10-25", rolle: "recht", unterschrieben_am: "2026-10-25", unterschrift: "test.jpg", bezug: "Test", pruefsumme: vorlagenPruefsumme(v, { rechtsformen: RF }), rechtsformen: RF };
  const liste = { ...VORLAGEN_GEPRUEFT, handelsregister: f };
  it("Rechtsform aus der Unterlage oder aus „Mein Betrieb“", () => {
    expect(vorlageGeprueft(v, { rechtsform: "OHG" }, liste)?.stand).toBe("2026-10-25");
    expect(vorlageGeprueft(v, { rechtsform: "UG (haftungsbeschränkt)" }, liste)).toBeUndefined();
    expect(vorlageGeprueft(v, {}, liste, { ...LEERER_BETRIEB, rechtsform: "KG" })?.stand).toBe("2026-10-25");
    expect(vorlageGeprueft(v, {}, liste, { ...LEERER_BETRIEB, name: "Muster GmbH & Co. KG" })).toBeUndefined();
    expect(vorlageGeprueft(v, {}, liste, { ...LEERER_BETRIEB, name: "Muster GmbH" })?.stand).toBe("2026-10-25");
  });
  it("Prüfsumme hängt an den Rechtsformen der Freigabe: Beispiele anderer Rechtsformen zählen nicht", () => {
    expect(vorlagenPruefsumme(v, { rechtsformen: RF })).not.toBe(vorlagenPruefsumme(v, {}));
  });
  it("ohne Unterschrift kein Vermerk (E-196)", () => {
    expect(vorlageGeprueft(v, { rechtsform: "OHG" }, { ...liste, handelsregister: { ...f, unterschrieben_am: null } })).toBeUndefined();
    expect(vorlageGeprueft(v, { rechtsform: "OHG" }, { ...liste, handelsregister: { ...f, stand: "2026-10-26" } })).toBeUndefined();
  });
  it("Prüfsumme hängt an den Rechtsformen der Freigabe: Beispiele anderer Rechtsformen zählen nicht", () => {
    expect(vorlagenPruefsumme(v, { rechtsformen: RF })).not.toBe(vorlagenPruefsumme(v, {}));
  });
  it("ohne Unterschrift kein Vermerk (E-196)", () => {
    expect(vorlageGeprueft(v, { rechtsform: "OHG" }, { ...liste, handelsregister: { ...f, unterschrieben_am: null } })).toBeUndefined();
    expect(vorlageGeprueft(v, { rechtsform: "OHG" }, { ...liste, handelsregister: { ...f, stand: "2026-10-26" } })).toBeUndefined();
  });
  it("ohne erkennbare Rechtsform (Info-Seite) kein Vermerk", () => {
    expect(vorlageGeprueft(v, undefined, liste)).toBeUndefined();
  });
});
