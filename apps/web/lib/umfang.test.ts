import { describe, expect, it } from "vitest";
import { modulZuPfad, pfadSichtbar, sichtbar } from "./umfang";

describe("Umfang der Oberfläche (E-110)", () => {
  it("Kern ist Standard: Breite versteckt, Kernpfade sichtbar", () => {
    expect(sichtbar("experten", undefined)).toBe(false);
    expect(pfadSichtbar("/heute", "kern")).toBe(true);
    expect(pfadSichtbar("/personal/zeiten", "kern")).toBe(true);
    expect(pfadSichtbar("/personal/gefaehrdungsbeurteilungen/abc", "kern")).toBe(false);
    expect(pfadSichtbar("/datenschutz/pannen#melden", "kern")).toBe(false);
    expect(pfadSichtbar("/personal/unterweisungen?art=ifsg", "kern")).toBe(true);
  });
  it("alles oder eine Liste schaltet Module frei", () => {
    expect(pfadSichtbar("/radar", "alles")).toBe(true);
    expect(pfadSichtbar("/radar", "radar, frag")).toBe(true);
    expect(pfadSichtbar("/experten", "radar, frag")).toBe(false);
    expect(modulZuPfad("/online")).toBe("online");
    expect(modulZuPfad("/onlineshop")).toBeNull();
  });
});
