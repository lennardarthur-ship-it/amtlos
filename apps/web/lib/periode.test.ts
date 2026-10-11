import { describe, expect, it } from "vitest";
import { monatsname, periodeText } from "./periode";

describe("Perioden in Klartext", () => {
  it("beschreibt Monat, Quartal, Halbjahr und Jahr", () => {
    expect(periodeText("2026-10", "de")).toBe("für Oktober 2026");
    expect(periodeText("2026-Q3", "de")).toBe("für das 3. Quartal 2026");
    expect(periodeText("2026-H1", "en")).toBe("for H1 2026");
    expect(periodeText("2026", "de")).toBe("für 2026");
    expect(periodeText("einmalig", "de")).toBe("einmalig");
    expect(monatsname(3, "de")).toBe("März");
  });
});
