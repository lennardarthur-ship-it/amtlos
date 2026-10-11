import { StandardKalender } from "@amtlos/fristen";
import { describe, expect, it } from "vitest";
import { auswerten } from "../src/index.js";
import { ladeFixtures, ladeKatalog } from "./hilfen.js";

const katalog = ladeKatalog();
const kalender = new StandardKalender();
const fixtures = ladeFixtures();

describe("Katalog-Fixtures (catalog/fixtures)", () => {
  it("es gibt Fixtures und jede Pflicht im Katalog kommt in mindestens einer vor", () => {
    expect(fixtures.length).toBeGreaterThan(0);
    const abgedeckt = new Set(fixtures.flatMap((f) => Object.keys(f.erwartet)));
    for (const p of katalog.pflichten) expect(abgedeckt, `Pflicht ohne Fixture: ${p.id}`).toContain(p.id);
  });

  for (const fx of fixtures) {
    describe(`${fx.datei} (${fx.persona})`, () => {
      const ergebnisse = auswerten({ katalog, fakten: fx.fakten, ereignisse: fx.ereignisse ?? [], stichtag: fx.stichtag, kalender });
      const nachId = new Map(ergebnisse.map((e) => [e.pflicht_id, e]));

      for (const [id, erwartet] of Object.entries(fx.erwartet)) {
        it(`${id} → ${erwartet}`, () => {
          const e = nachId.get(id);
          expect(e, `Pflicht ${id} nicht im Ergebnis`).toBeDefined();
          expect(e!.ergebnis).toBe(erwartet);
          if (erwartet === "gilt_nicht") expect(e!.termine).toEqual([]);
        });
      }

      for (const [id, termine] of Object.entries(fx.termine_enthaelt ?? {})) {
        it(`${id}: Termine ${termine.map((t) => t.join(" → ")).join(", ")}`, () => {
          const ist = nachId.get(id)!.termine.map((t) => [t.periode, t.faellig_am]);
          for (const t of termine) expect(ist).toContainEqual(t);
        });
      }

      for (const [id, fakten] of Object.entries(fx.fehlende_fakten ?? {})) {
        it(`${id}: fragt nach ${fakten.join(", ")}`, () => {
          expect([...nachId.get(id)!.fehlende_fakten].sort()).toEqual([...fakten].sort());
        });
      }
    });
  }
});

describe("Determinismus", () => {
  it("liefert für gleiche Eingabe exakt gleiche Ausgabe", () => {
    for (const fx of fixtures) {
      const a = auswerten({ katalog, fakten: fx.fakten, ereignisse: fx.ereignisse ?? [], stichtag: fx.stichtag, kalender });
      const b = auswerten({ katalog, fakten: { ...fx.fakten }, ereignisse: [...(fx.ereignisse ?? [])], stichtag: fx.stichtag, kalender: new StandardKalender() });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });
});
