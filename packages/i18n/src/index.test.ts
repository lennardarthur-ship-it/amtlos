import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { de } from "./de";
import { en } from "./en";
import { SCHRITTE, datumLang, datumTeile, fuelle, schrittFuerFakt } from "./index";

const require = createRequire(import.meta.url);
const fakten = require("../../rules-schema/fakten.json") as { fakten: { pfad: string; typ: string; werte?: string[] }[] };
const ereignisse = require("../../rules-schema/ereignisse.json") as { ereignisse: { typ: string }[] };

type Baum = { [k: string]: string | Baum };
const lies = (o: Baum, pfad: string): string => pfad.split(".").reduce<string | Baum>((x, k) => (x as Baum)[k]!, o) as string;

function schluessel(o: object, p = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? schluessel(v, `${p}${k}.`) : [`${p}${k}`]));
}

describe("Übersetzungen", () => {
  it("Deutsch und Englisch haben dieselben Schlüssel und keine leeren Texte", () => {
    expect(schluessel(en).sort()).toEqual(schluessel(de).sort());
    for (const k of schluessel(en)) expect(lies(en as unknown as Baum, k)).not.toBe("");
  });
  it("Platzhalter sind in beiden Sprachen gleich", () => {
    for (const k of schluessel(de)) {
      const a = lies(de as unknown as Baum, k).match(/\{\w+\}/g)?.sort();
      const b = lies(en as unknown as Baum, k).match(/\{\w+\}/g)?.sort();
      expect(b, k).toEqual(a);
    }
  });
  it("jeder Ereignistyp hat einen Text", () => {
    for (const e of ereignisse.ereignisse) expect(de.ereignis).toHaveProperty(e.typ);
  });
  it("füllt Platzhalter und formatiert Daten ohne Zeitzonen", () => {
    expect(fuelle("{n} offen", { n: 3 })).toBe("3 offen");
    expect(datumLang("2026-11-10", "de")).toBe("10. Nov. 2026");
    expect(datumLang("2026-11-10", "en")).toBe("10 Nov 2026");
    expect(datumTeile("2026-10-11", "de")).toEqual({ tag: "11", monat: "Okt.", jahr: "2026", wochentag: "So" });
  });
});

describe("Onboarding-Fragen passen zum Fakten-Katalog", () => {
  const nachFeld = new Map(fakten.fakten.filter((f) => f.pfad.startsWith("profil.")).map((f) => [f.pfad.slice(7), f]));
  const ART: Record<string, string[]> = {
    auswahl: ["enum"], mehrfach: ["enum_liste"], janein: ["bool"], zahl: ["ganzzahl"], betrag: ["betrag", "zahl"], datum: ["datum"], text: ["text"],
  };
  for (const s of SCHRITTE)
    for (const f of s.fragen)
      it(`${s.id}/${f.feld}`, () => {
        const fakt = nachFeld.get(f.feld);
        expect(fakt, `Fakt profil.${f.feld} fehlt in fakten.json`).toBeDefined();
        expect(ART[f.art]).toContain(fakt!.typ);
        if (fakt!.werte) expect(Object.keys(f.optionen ?? {}).sort()).toEqual([...fakt!.werte].sort());
        // E-217: Hilfetexte unter Antworten nur zu vorhandenen Antworten, deutsch und englisch
        for (const [k, t] of Object.entries(f.optionHilfe ?? {})) {
          expect(Object.keys(f.optionen ?? {}), k).toContain(k);
          expect(t.de.length > 0 && t.en.length > 0, k).toBe(true);
        }
      });
  it("findet den Schritt zu einem fehlenden Fakt", () => {
    expect(schrittFuerFakt("profil.beschaeftigte.gesamt")).toBe("beschaeftigte");
    expect(schrittFuerFakt("profil.gibt_es_nicht")).toBeUndefined();
  });
});
