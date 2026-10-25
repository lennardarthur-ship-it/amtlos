/** RA Dr. Weber Runde 4 (25.10.2026): Handelsregister nur für GmbH, OHG und KG bestätigt – Vermerk nur bei diesen Rechtsformen. */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, VORLAGEN_GEPRUEFT, vorlageFuer, vorlageGeprueft, vorlagenPruefsumme, type VorlagenFreigabe } from "../src/index.js";

describe("Freigabe auf Rechtsformen beschränkt", () => {
  const v = vorlageFuer("handelsregister")!;
  const f: VorlagenFreigabe = { stand: "2026-10-25", bezug: "Test", pruefsumme: vorlagenPruefsumme(v, {}), rechtsformen: ["GmbH", "OHG", "KG"] };
  const liste = { ...VORLAGEN_GEPRUEFT, handelsregister: f };
  it("Rechtsform aus der Unterlage oder aus „Mein Betrieb“", () => {
    expect(vorlageGeprueft(v, { rechtsform: "OHG" }, liste)?.stand).toBe("2026-10-25");
    expect(vorlageGeprueft(v, { rechtsform: "UG (haftungsbeschränkt)" }, liste)).toBeUndefined();
    expect(vorlageGeprueft(v, {}, liste, { ...LEERER_BETRIEB, rechtsform: "KG" })?.stand).toBe("2026-10-25");
    expect(vorlageGeprueft(v, {}, liste, { ...LEERER_BETRIEB, name: "Muster GmbH & Co. KG" })).toBeUndefined();
    expect(vorlageGeprueft(v, {}, liste, { ...LEERER_BETRIEB, name: "Muster GmbH" })?.stand).toBe("2026-10-25");
  });
  it("ohne erkennbare Rechtsform (Info-Seite) kein Vermerk", () => {
    expect(vorlageGeprueft(v, undefined, liste)).toBeUndefined();
  });
});
