import { describe, expect, it } from "vitest";
import { sichererPfad } from "@amtlos/web-kern/pfad";

describe("Rücksprungziel nach der Anmeldung", () => {
  it("erlaubt eigene Pfade", () => {
    expect(sichererPfad("/einladung/AbC_-123")).toBe("/einladung/AbC_-123");
    expect(sichererPfad("/pflichten?pflicht=steuern.euer")).toBe("/pflichten?pflicht=steuern.euer");
  });
  it("verweigert fremde Ziele und Unsinn", () => {
    for (const x of ["//boese.de", "/\\boese.de", "https://boese.de", "boese", "/a\nb", "/" + "a".repeat(400), undefined, 3])
      expect(sichererPfad(x)).toBe("/heute");
  });
});
