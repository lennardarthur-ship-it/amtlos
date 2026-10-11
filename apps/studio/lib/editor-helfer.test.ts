import { describe, expect, it } from "vitest";
import { bereinigen, dauerBauen, dauerZerlegen, dauernZuTage, neueBedingung, neuePflicht, startwert, tageZuDauern } from "./editor-helfer";

const fakten = [
  { pfad: "profil.beschaeftigte.gesamt", typ: "ganzzahl" },
  { pfad: "profil.rechtsform", typ: "enum", werte: ["gmbh", "ug"] },
  { pfad: "profil.ust.kleinunternehmer", typ: "bool" },
];

describe("Editor-Hilfen", () => {
  it("wählt passende Startwerte je Typ und Operator", () => {
    expect(startwert(fakten[0], ">=")).toBe(0);
    expect(startwert(fakten[1], "==")).toBe("gmbh");
    expect(startwert(fakten[1], "in")).toEqual([]);
    expect(startwert(fakten[2], "==")).toBe(true);
    expect(startwert(fakten[0], "vorhanden")).toBeUndefined();
    expect(neueBedingung("vergleich", fakten, [])).toEqual({ feld: "profil.beschaeftigte.gesamt", op: "==", wert: 0 });
    expect(neueBedingung("ereignis", fakten, ["einstellung"])).toEqual({ ereignis: "einstellung", op: "eingetreten" });
  });

  it("wandelt Erinnerungen und Dauern", () => {
    expect(tageZuDauern("14, 3; x 1")).toEqual(["P14D", "P3D", "P1D"]);
    expect(dauernZuTage(["P14D", "P3D"])).toBe("14, 3");
    expect(dauerZerlegen("-P1D")).toEqual({ negativ: true, zahl: 1, einheit: "D" });
    expect(dauerZerlegen("P1M7D")).toBeUndefined();
    expect(dauerBauen(3, "M")).toBe("P3M");
  });

  it("entfernt leere optionale Angaben, lässt Pflichtfelder stehen", () => {
    const p = { ...neuePflicht("x.y", "steuern"), titel: { de: "T", en: "  " }, begriffe: [{ begriff: { de: "" }, erklaerung: { de: "" } }], radar: { wahrscheinlichkeit: "hoch" }, pruefung: { status: "freigegeben" } } as unknown as Record<string, unknown>;
    const r = bereinigen(p);
    expect(r.titel).toEqual({ de: "T" });
    expect(r).not.toHaveProperty("begriffe");
    expect(r).not.toHaveProperty("radar"); // nur bei Entwurf/geplant
    expect(r).not.toHaveProperty("pruefung"); // wird aus Freigaben abgeleitet
    expect(r).not.toHaveProperty("fachlich_zu_pruefen");
    expect(r.rechtsgrundlage).toEqual([]); // leer → Prüfung meldet „minItems“
    expect(r.quellen).toEqual([]);
  });
});
