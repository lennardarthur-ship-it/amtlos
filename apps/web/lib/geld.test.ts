import { describe, expect, it } from "vitest";
import { centAus, euroFeld, euroText, mengeAus } from "./geld";

describe("Geldbeträge", () => {
  it("liest und schreibt je Sprache", () => {
    expect(centAus("1.234,56", "de")).toBe(123456);
    expect(centAus("1,234.56", "en")).toBe(123456);
    expect(centAus("80", "de")).toBe(8000);
    expect(centAus("29,9", "de")).toBe(2990);
    expect(centAus("", "de")).toBeNull();
    expect(centAus("12,345", "de")).toBeNaN(); // drei Nachkommastellen bei Geld: Fehler statt Raten
    expect(centAus("-5,00", "de")).toBe(-500);
    expect(euroFeld(123456, "de")).toBe("1234,56");
    expect(euroText(123456, "de").replace(/\s/g, " ")).toBe("1.234,56 €"); // Intl setzt ein geschütztes Leerzeichen
    expect(mengeAus("2,5", "de")).toBe(2.5);
    expect(mengeAus("2.5", "en")).toBe(2.5);
  });
});
