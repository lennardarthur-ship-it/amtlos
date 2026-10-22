/** E-167 (Sifa-Durchsicht 22.10.2026, B-036): Fettbrand nach Fettmenge getrennt – BGN ASI 2.15 Nr. 4. */
import { describe, expect, it } from "vitest";
import { vorlageFuer, type ListenFeld } from "../src/index.js";

const gb = vorlageFuer("gefaehrdungsbeurteilung")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "gefaehrdungen") as ListenFeld;
const fett = gb.vorschlaege!.filter((x) => x.titel.startsWith("Fettbrand und Fettexplosion an Fritteusen"));
const stufe = (m: string) => fett.find((x) => x.titel.includes(m))!;

describe("Fettbrand nach Fettmenge (B-036)", () => {
  it("drei Vorschläge statt einem: bis 50 l, 50 bis 100 l, über 100 l", () => {
    expect(fett.map((x) => x.titel)).toEqual([
      "Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag (Fettmenge bis 50 l).",
      "Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag (Fettmenge 50 bis 100 l).",
      "Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag (Fettmenge über 100 l).",
    ]);
    for (const x of fett) {
      expect(x.gruppe).toBe("Gastronomie / Café");
      expect(x.quelle).toBe("BGN ASI 2.15 Nr. 4; DGUV Regel 110-003, Abschn. 3.3.1");
      expect(x.werte).toMatchObject({ faktor: "sonstiges", unterpunkt: "brand", schwere: "schwer" });
      // nur die Schwere wird vorgeschlagen – keine Risikostufe, keine Wahrscheinlichkeit (Blatt „D“)
      expect(x.werte.risiko).toBeUndefined();
      expect(x.werte.wahrscheinlichkeit).toBeUndefined();
    }
  });
  it("Löschvermögen mindestens Fettmenge plus 25 %; geübte Person erst ab 50 l; über 100 l ortsfeste Löscheinrichtung", () => {
    const m = (s: string) => String(stufe(s).werte.massnahme);
    expect(m("bis 50 l")).toMatch(/Brandklasse F.*Löschvermögen mindestens Fettmenge plus 25 % Reserve \(z\. B\. 20 l Fett → 25 F\)/);
    expect(m("bis 50 l")).not.toMatch(/geübte Person|ortsfeste/);
    expect(m("50 bis 100 l")).toMatch(/plus 25 %.*benannte, im Löschen geübte Person und ständige Beobachtung der Fritteuse – oder eine ortsfeste Löscheinrichtung/s);
    expect(m("über 100 l")).toMatch(/Ortsfeste Löscheinrichtung/);
    expect(m("über 100 l")).not.toMatch(/geübte Person/);
    // der alte, vermischte Vorschlag ist weg
    expect(gb.vorschlaege!.some((x) => x.titel === "Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag.")).toBe(false);
  });
});
