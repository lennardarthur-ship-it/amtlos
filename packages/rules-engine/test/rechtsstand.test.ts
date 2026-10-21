import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { rechtsstand, rechtsstandMonat, rechtsstandText, type Rechtsstand } from "../src/index.js";
import { KATALOG_DIR } from "./hilfen.js";

describe("Rechtsstand des Katalogs", () => {
  it("formatiert Monat und Jahr", () => {
    const k = { rechtsstand: { datum: "2026-10-21", hinweis: "x" } };
    expect(rechtsstand(k)).toEqual({ datum: "2026-10-21", hinweis: "x" });
    expect(rechtsstandMonat(k)).toBe("Oktober 2026");
    expect(rechtsstandText(k)).toBe("Rechtsstand: Oktober 2026");
    expect(rechtsstandText({ rechtsstand: { datum: "2027-03-01" } })).toBe("Rechtsstand: März 2027");
  });

  it("liefert null ohne oder mit ungültigem Rechtsstand", () => {
    expect(rechtsstand({})).toBeNull();
    expect(rechtsstandText({})).toBeNull();
    expect(rechtsstandText({ rechtsstand: { datum: "Oktober 2026" } })).toBeNull();
  });

  it("catalog/rechtsstand.yaml trägt ein gültiges Datum", () => {
    const r = YAML.parse(fs.readFileSync(path.join(KATALOG_DIR, "rechtsstand.yaml"), "utf8")) as Rechtsstand;
    expect(rechtsstand({ rechtsstand: r })).not.toBeNull();
    expect(rechtsstandText({ rechtsstand: r })).toMatch(/^Rechtsstand: \S+ \d{4}$/);
  });
});
