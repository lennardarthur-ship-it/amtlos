import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const hier = path.dirname(fileURLToPath(import.meta.url));
const s = JSON.parse(readFileSync(path.resolve(hier, "../store/de.json"), "utf8")) as Record<string, unknown> & { bilder: { bildschirm: string; titel: string }[] };

describe("Store-Texte (E-132) halten die Grenzen des App Store ein", () => {
  it("Längen von Name, Untertitel, Werbetext, Schlüsselwörtern und Beschreibung", () => {
    expect((s.name as string).length).toBeLessThanOrEqual(30);
    expect((s.untertitel as string).length).toBeLessThanOrEqual(30);
    expect((s.werbetext as string).length).toBeLessThanOrEqual(170);
    expect(Buffer.byteLength(s.schluesselwoerter as string)).toBeLessThanOrEqual(100);
    expect((s.beschreibung as string).length).toBeLessThanOrEqual(4000);
    expect((s.neu as string).length).toBeLessThanOrEqual(4000);
  });
  it("Abo-Pflichtangaben stehen in der Beschreibung, und es gibt 3 bis 10 Bilder", () => {
    expect(s.beschreibung).toMatch(/verlängert sich automatisch/);
    expect(s.beschreibung).toMatch(/ersetzt keine Rechts- oder Steuerberatung/);
    expect(s.bilder.length).toBeGreaterThanOrEqual(3);
    expect(s.bilder.length).toBeLessThanOrEqual(10);
  });
});
