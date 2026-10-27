/**
 * E-221 Befund 6: Das Steuerberater-Paket schrieb die Belege auf Android fest, auch wenn das Teilen abgebrochen wurde
 * (expo-sharing meldet dort keinen Abbruch, `dateiTeilenBytes` liefert immer true). Jetzt: festgeschrieben wird nur
 * nach einer Übergabe – auf Android erst nach „Ja, übergeben“, sonst als eigener, ausdrücklicher Schritt; auf dem
 * iPhone meldet das Teilen-Menü den Abbruch. Dieselbe Lücke hatte die erste Ausgabe der Voranmeldung (sie schreibt die
 * Belege ihres Zeitraums fest, fragte auf Android aber nicht nach).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const antworten: boolean[] = [];
const fragen: string[] = [];
vi.mock("../src/ui/bestaetigen", () => ({
  bestaetigen: async (o: { titel: string }) => {
    fragen.push(o.titel);
    return antworten.shift() ?? false;
  },
}));

const { paketUebergeben } = await import("../src/unterlagen/paketUebergabe");
const { versandBestaetigt } = await import("../src/seiten/versand");

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");

describe("E-221 Befund 6: Steuerberater-Paket erst nach der Übergabe festschreiben", () => {
  beforeEach(() => {
    antworten.length = 0;
    fragen.length = 0;
  });

  const lauf = async (o: { geteilt: boolean; android: boolean; ja: boolean }) => {
    let fest = 0;
    let gefragt = 0;
    const r = await paketUebergeben({ teilen: async () => o.geteilt, bestaetigen: async () => (gefragt++, o.ja), festschreiben: () => void fest++, android: o.android });
    return { r, fest, gefragt };
  };

  it("Android, Teilen „zurück“ (meldet trotzdem geteilt) und „Nein, noch nicht“: nichts festgeschrieben", async () => {
    expect(await lauf({ geteilt: true, android: true, ja: false })).toEqual({ r: "offen", fest: 0, gefragt: 1 });
  });
  it("Android mit „Ja, übergeben“: festgeschrieben", async () => {
    expect(await lauf({ geteilt: true, android: true, ja: true })).toEqual({ r: "fest", fest: 1, gefragt: 1 });
  });
  it("iPhone: Abbruch gemeldet – nichts festgeschrieben, keine Frage; geteilt – festgeschrieben ohne Frage", async () => {
    expect(await lauf({ geteilt: false, android: false, ja: true })).toEqual({ r: "abgebrochen", fest: 0, gefragt: 0 });
    expect(await lauf({ geteilt: true, android: false, ja: false })).toEqual({ r: "fest", fest: 1, gefragt: 0 });
  });

  it("Seite: festschreiben nur über paketUebergeben, mit den Belegen beim Packen; „doch übergeben“ als eigener Schritt", () => {
    const q = lies("seiten/Steuerberatung.tsx");
    // vorher: if (!(await dateiTeilenBytes(...))) return; z.belegeFestschreiben(...)
    expect(q).not.toMatch(/dateiTeilenBytes\(p\.dateiname, p\.zip, "application\/zip"\)\)\)\) return;\s*\/\/[^\n]*\n\s*z\.belegeFestschreiben/);
    expect(q).toContain("festschreiben: () => z.belegeFestschreiben(ids),");
    expect(q).toContain("android: ANDROID,");
    expect(q).toContain('if (ergebnis === "offen") return setOffenesPaket({ ids, name: nameVon(wahl) });');
    expect(q).toContain("z.belegeFestschreiben(offenesPaket.ids)");
    // genau zwei Stellen schreiben fest: nach der Bestätigung und „doch übergeben“
    expect(q.match(/z\.belegeFestschreiben\(/g)?.length).toBe(2);
  });

  it("Voranmeldung: erste Ausgabe auf Android nur nach Bestätigung (schreibt Belege fest), iPhone ohne Frage", async () => {
    const va = { id: "ust_voranmeldung", festschreiben: undefined, storno: undefined };
    antworten.push(false);
    expect(await versandBestaetigt({ festgeschrieben: undefined, ausgegeben: undefined }, va, false, true)).toBe(false);
    expect(fragen).toEqual(["Hast du die Voranmeldung weitergegeben oder gespeichert?"]);
    antworten.push(true);
    expect(await versandBestaetigt({ festgeschrieben: undefined, ausgegeben: undefined }, va, true, true)).toBe(true);
    // schon abgegeben: keine Frage mehr (die Belege sind schon festgeschrieben); iPhone nie
    expect(await versandBestaetigt({ festgeschrieben: undefined, ausgegeben: "2026-10-10T10:00:00Z" }, va, false, true)).toBe(true);
    expect(await versandBestaetigt({ festgeschrieben: undefined, ausgegeben: undefined }, va, false, false)).toBe(true);
    expect(fragen.length).toBe(2);
    // andere Vorlagen ohne Festschreibung: wie bisher ohne Frage
    expect(await versandBestaetigt({ festgeschrieben: undefined }, { id: "angebot", festschreiben: undefined, storno: undefined }, false, true)).toBe(true);
    expect(fragen.length).toBe(2);
  });
});
