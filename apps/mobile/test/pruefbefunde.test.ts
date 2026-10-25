import { describe, expect, it } from "vitest";
import { LEERER_STAND, anlegen, felderSetzen, kopieren, nummerDoppelt } from "../src/unterlagen/speicher";

const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne" };

describe("Befunde der Qualitätsprüfung (2026-10-13)", () => {
  it("Kopie einer Rechnung bekommt neue Nummer und das heutige Datum", () => {
    let s = anlegen({ ...LEERER_STAND, betrieb: B }, "rechnung", new Date("2026-09-01T09:00:00Z"), "r1")[0];
    s = felderSetzen(s, "r1", { datum: "2026-09-01" }, new Date("2026-09-01T09:00:00Z"));
    const [s2, k] = kopieren(s, "r1", new Date("2026-10-13T09:00:00Z"), "r2");
    expect(k!.daten.datum).toBe("2026-10-13");
    expect(k!.daten.nummer).not.toBe(s2.unterlagen.find((u) => u.id === "r1")!.daten.nummer);
  });

  it("doppelte Nummern werden auch nach Änderungen richtig erkannt (Zwischenspeicher je Liste)", () => {
    let s = anlegen({ ...LEERER_STAND, betrieb: B }, "rechnung", new Date("2026-10-01T09:00:00Z"), "a")[0];
    s = anlegen(s, "rechnung", new Date("2026-10-01T09:00:00Z"), "b")[0];
    const a = () => s.unterlagen.find((u) => u.id === "a")!;
    expect(nummerDoppelt(s, a())).toBe(false);
    s = felderSetzen(s, "b", { nummer: String(a().daten.nummer) }, new Date());
    expect(nummerDoppelt(s, a())).toBe(true);
    s = felderSetzen(s, "b", { nummer: "X-1" }, new Date());
    expect(nummerDoppelt(s, a())).toBe(false);
  });
});
