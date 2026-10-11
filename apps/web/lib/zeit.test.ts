import { describe, expect, it } from "vitest";
import { aktuellerMonat, isoZuOrtszeit, nachbarMonat, ortszeitZuIso } from "./zeit";

describe("Ortszeit Europe/Berlin", () => {
  it("rechnet Sommer- und Winterzeit um", () => {
    expect(ortszeitZuIso("2026-07-01", "08:00")).toBe("2026-07-01T06:00:00.000Z");
    expect(ortszeitZuIso("2026-12-01", "08:00")).toBe("2026-12-01T07:00:00.000Z");
    expect(ortszeitZuIso("2026-10-25", "12:00")).toBe("2026-10-25T11:00:00.000Z"); // Tag der Umstellung, nachher
    expect(ortszeitZuIso("2026-13-01", "08:00")).toBeNull();
    expect(ortszeitZuIso("2026-07-01", "8 Uhr")).toBeNull();
  });
  it("zeigt UTC-Zeitpunkte in Ortszeit", () => {
    expect(isoZuOrtszeit("2026-07-01T22:30:00Z")).toEqual({ datum: "2026-07-02", uhrzeit: "00:30" });
    expect(aktuellerMonat(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });
  it("blättert Monate über den Jahreswechsel", () => {
    expect(nachbarMonat("2026-12", 1)).toBe("2027-01");
    expect(nachbarMonat("2026-01", -1)).toBe("2025-12");
  });
});
