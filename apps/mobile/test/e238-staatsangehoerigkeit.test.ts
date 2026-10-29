/**
 * E-238 (Gründerbefund 29.10.2026): „deutsche“ galt als Drittstaat – die App zeigte „Aufenthaltstitel prüfen und Kopie
 * aufbewahren“ als geltend und bot bei der Person die Kopie des Aufenthaltstitels an. Pflichten je Einordnung:
 * EU/EWR/Schweiz (auch als eine von mehreren) → gilt nicht; außerhalb oder staatenlos → gilt; nicht sicher zuzuordnen →
 * „zu prüfen“ (hängt ab) – nie still ausgeblendet, nie als geltend angenommen.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auswertung, drittstaat, profilMitStand, type MitarbeiterFuerCheck, type Profil } from "../src/pflichten/check";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "..", p), "utf8");

const LAUFEND = "personal.aufenthaltstitel_laufend";
const EINSTELLUNG = "personal.aufenthaltstitel";
const heute = "2026-10-29";
/** Gebäudereinigung mit zwei Beschäftigten (dort fragt der Check nach Drittstaaten) */
const basis: Profil = { "taetigkeit.branchen": ["gebaeudereinigung"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "NW", "beschaeftigte.gesamt": 2, gruendungsdatum: "2024-01-01" };
const person = (staatsangehoerigkeit: string | null, staat?: string): MitarbeiterFuerCheck => ({ name: "Lea Berg", beginn: "2025-03-01", staatsangehoerigkeit, ...(staat ? { staat } : {}) });

/** Wo steht die laufende Aufbewahrungspflicht? */
function stelle(profil: Profil, m: MitarbeiterFuerCheck[]): "gilt" | "zu_pruefen" | "nicht" {
  const a = auswertung(profil, heute, [], m);
  if (a.gilt.some((p) => p.id === LAUFEND)) return "gilt";
  if (a.unbekannt.some((p) => p.id === LAUFEND)) return "zu_pruefen";
  return "nicht";
}

describe("Befund nachgestellt: deutsche Staatsangehörigkeit in allen Schreibweisen ist kein Drittstaat", () => {
  for (const t of ["deutsch", "deutsche", "Deutsch", "DEUTSCH", "Deutschland", "DE", "D", "german", "German", "deutsch/türkisch", "österreichisch", "Österreich", "AT", "französisch", "Polin", "polnisch", "italienische", "schweizerisch", "Schweiz", "CH", "norwegisch", "Liechtenstein", "Island"])
    it(`„${t}“: kein Drittstaat, keine Aufenthaltspflicht – auch nicht, wenn der Check mit „Nein“ beantwortet ist`, () => {
      expect(drittstaat(t)).toBe(false);
      expect(profilMitStand({ ...basis, "personal.drittstaaten": false }, heute, [person(t)])["personal.drittstaaten"]).toBe(false);
      expect(stelle({ ...basis, "personal.drittstaaten": false }, [person(t)])).toBe("nicht");
    });
});

describe("Pflichten je Einordnung (E-238)", () => {
  it("außerhalb von EU, EWR und Schweiz oder staatenlos: die Pflicht gilt, auch wenn der Check „Nein“ sagt", () => {
    for (const t of ["türkisch", "ukrainisch", "staatenlos", "syrisch"]) {
      expect(drittstaat(t)).toBe(true);
      expect(stelle({ ...basis, "personal.drittstaaten": false }, [person(t)])).toBe("gilt");
      expect(stelle(basis, [person(t)])).toBe("gilt");
    }
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person(null, "andere")])).toBe("gilt");
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person("", "staatenlos")])).toBe("gilt");
  });
  it("nicht sicher zuzuordnen (Tippfehler, ungeklärt): „zu prüfen“ – ein „Nein“ im Check blendet sie nicht still aus", () => {
    for (const t of ["deustch", "xyz", "ungeklärt"]) {
      expect(drittstaat(t)).toBe(false);
      expect(stelle({ ...basis, "personal.drittstaaten": false }, [person(t)])).toBe("zu_pruefen");
      expect(stelle(basis, [person(t)])).toBe("zu_pruefen");
      // wer im Check „Ja“ sagt, bekommt die Pflicht wie bisher
      expect(stelle({ ...basis, "personal.drittstaaten": true }, [person(t)])).toBe("gilt");
    }
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person("deutsch", "ungeklaert")])).toBe("zu_pruefen");
  });
  it("gewählt geht vor dem Text: „deustch“ mit Wahl Deutschland ist frei", () => {
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person("deustch", "DE")])).toBe("nicht");
  });
  it("nichts eingetragen: die Antwort im Check entscheidet wie bisher", () => {
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person("")])).toBe("nicht");
    expect(stelle({ ...basis, "personal.drittstaaten": true }, [person(null)])).toBe("gilt");
    expect(stelle(basis, [person(null)])).toBe("zu_pruefen");
  });
  it("mehrere Beschäftigte: eine Person außerhalb genügt; eine unklare macht ein „Nein“ zu „zu prüfen“", () => {
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person("deutsch"), person("türkisch")])).toBe("gilt");
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person("deutsch"), person("deustch")])).toBe("zu_pruefen");
    expect(stelle({ ...basis, "personal.drittstaaten": false }, [person("deutsch"), person("Polin")])).toBe("nicht");
  });
  it("bei einer Neueinstellung dieselbe Einordnung (Pflicht vor Beginn)", () => {
    const neu = (t: string): MitarbeiterFuerCheck => ({ name: "Mia Sommer", beginn: "2026-11-02", staatsangehoerigkeit: t });
    const wo = (t: string) => {
      const a = auswertung({ ...basis, "personal.drittstaaten": false }, heute, [], [neu(t)]);
      return a.gilt.some((p) => p.id === EINSTELLUNG) ? "gilt" : a.unbekannt.some((p) => p.id === EINSTELLUNG) ? "zu_pruefen" : "nicht";
    };
    expect(wo("deutsche")).toBe("nicht");
    expect(wo("türkisch")).toBe("gilt");
    expect(wo("deustch")).toBe("zu_pruefen");
  });
});

describe("Oberfläche (E-238)", () => {
  it("Kopie des Aufenthaltstitels nur außerhalb von EU/EWR/Schweiz (oder schon Eingetragenes), nicht bei „deutsche“", () => {
    const m = lies("src/seiten/Mitarbeiter.tsx");
    expect(m).toMatch(/export function mitAufenthalt[\s\S]{0,400}staatsangehoerigkeitArt\(p\) === "drittstaat"/);
    expect(m).not.toMatch(/sa !== "deutsch"/);
    // Auswahl statt Freitext, unklare Angaben mit Bitte zur Wahl, nie still Drittstaat
    expect(m).toMatch(/export function StaatWahl/);
    expect(m).toMatch(/e238_staat_unklar/);
    expect(lies("src/seiten/Betrieb.tsx")).toMatch(/eigen=\{art === "mitarbeiter" \? \(f\) => \(f\.id === "staat" \? <StaatWahl/);
    // die Pflicht-Seite nennt, bei wem es unklar ist
    expect(lies("src/seiten/Pflichten.tsx")).toMatch(/e238_pflicht_unklar\(unklareStaaten\)/);
    // die Auswertung rechnet neu, wenn sich die Wahl ändert
    expect(lies("src/seiten/Pflichten.tsx")).toMatch(/\$\{m\.staat \?\? ""\}/);
  });
  it("Unterlagen (Personalfragebogen, Lohnkonto, Meldedaten) drucken weiter den eingetragenen Text – Vorlagen unverändert", () => {
    const lohn = readFileSync(path.join(hier, "../../../packages/fachlogik/src/dokumente/lohn.ts"), "utf8");
    expect(lohn).toContain('{ id: "staatsangehoerigkeit", art: "text", label: "Staatsangehörigkeit", pflicht: true }');
    expect(lohn).toContain('["Staatsangehörigkeit", text(d, "staatsangehoerigkeit")]');
  });
});
