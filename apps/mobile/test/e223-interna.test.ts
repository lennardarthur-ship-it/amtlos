/**
 * E-223 (externer Prüfer): (a) „freigegeben, aber noch offen“ – keine freigegebene Fassung mit offener Prüfmarke;
 * (b) interne Notizen im Bündel der App – nichts davon in katalog.json, Web-Export oder Website.
 * Regeln in werkzeuge/interna.mjs (auch store-check).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as F from "@amtlos/fachlogik";
import { LEERER_STAND } from "../src/unterlagen/speicher";
import { auslieferung, buendelBefunde, markerBefunde, ohneInterna, PRUEFUNG_FELDER } from "../werkzeuge/interna.mjs";

const APP = path.resolve(__dirname, "..");

describe("E-223 a: freigegebene Pflichten, Regelwerte und Vorlagen ohne offene Prüfmarke", () => {
  it("kein freigegebener Eintrag und kein freigegebener Regelwert mit „[FACHLICH ZU PRÜFEN]“, „fachlich zu prüfen“, „TODO“ oder „Platzhalter“ (Notiz nur eingeordnet)", () => {
    expect(markerBefunde()).toEqual([]);
  });
  it("Vorlagen: eine freigegebene Fassung mit Stellen „fachlich zu prüfen“ heißt in der App „teilweise durchgesehen“", () => {
    let geprueft = 0;
    const cafe = { ...LEERER_STAND.betrieb, name: "Café Sonne", bundesland: "Berlin" };
    for (const v of F.VORLAGEN) {
      const d: F.Daten = v.id === "hygieneplan" ? { art: "lebensmittel" } : {};
      const f = F.vorlageGeprueft(v, d, F.VORLAGEN_GEPRUEFT, cafe);
      if (!f) continue;
      geprueft++;
      const offen = F.aktuellerPruefstand(v, f).offen;
      const hinweis = F.pruefHinweisFuer(v, d, cafe);
      if (offen > 0) expect(hinweis, v.id).toMatch(/teilweise/);
      else expect(hinweis, v.id).not.toMatch(/teilweise/);
    }
    expect(geprueft).toBeGreaterThan(30);
  });
});

describe("E-223 b: nichts Internes im Bündel", () => {
  it("katalog.json (Pflichten-Check, Unterlagen) und – falls gebaut – Web-Export und Website ohne Notizfelder, Marken und Namen", () => {
    const befunde = (auslieferung() as { datei: string; katalog: boolean }[]).flatMap(({ datei, katalog }) => buendelBefunde(fs.readFileSync(datei, "utf8"), { katalog }).map((b: string) => `${path.relative(APP, datei)}: ${b}`));
    expect(befunde).toEqual([]);
  });
  it("Prüfstand im Bündel nur mit den Feldern, die der Vermerk braucht", () => {
    const k = JSON.parse(fs.readFileSync(path.join(APP, "src/pflichten/katalog.json"), "utf8")) as { pflichten: { pruefung?: object }[]; regelwerte: { pruefung?: object }[]; rechtsstand: object };
    for (const e of [...k.pflichten, ...k.regelwerte]) for (const f of Object.keys(e.pruefung ?? {})) expect(PRUEFUNG_FELDER).toContain(f);
    expect(Object.keys(k.rechtsstand)).toEqual(["datum"]);
  });
  it("Prüfung erkennt die Befunde (Probe mit einem Eintrag wie vor E-223)", () => {
    const alt = { id: "x", katalog_nr: "G.1", fachlich_zu_pruefen: ["[FACHLICH ZU PRÜFEN] Wert"], aenderungsnotiz: { de: "neu" }, radar: { wahrscheinlichkeit: "mittel", vorbereitung: [{ de: "a" }], erwartet_ab: null }, pruefung: { status: "freigegeben", geprueft_von: ["recht"], notiz: "intern" } };
    expect(buendelBefunde(JSON.stringify(alt), { katalog: true })).toEqual(expect.arrayContaining(["Feld „fachlich_zu_pruefen“", "Marke „[FACHLICH ZU PRÜFEN]“", "Feld „katalog_nr“", "Feld „wahrscheinlichkeit“", "Prüfstand mit Feld „notiz“"]));
    expect(buendelBefunde(JSON.stringify(ohneInterna(alt)), { katalog: true })).toEqual([]);
    // gebündeltes JavaScript schreibt Umlaute als Escape
    expect(buendelBefunde('t="[FACHLICH ZU PR\\xdcFEN] Wert"')).toEqual(["Marke „[FACHLICH ZU PRÜFEN]“"]);
  });
  it("interne Prüfunterlagen nicht im Code der App: Zuordnung der Arbeitsschutz-Durchsicht und die Texte der Web-App", () => {
    expect("SIFA_PRUEFUNG" in F).toBe(false);
    const quellen: string[] = [];
    const rein = (o: string) => { for (const e of fs.readdirSync(o, { withFileTypes: true })) { const p = path.join(o, e.name); if (e.isDirectory()) rein(p); else if (/\.tsx?$/.test(e.name)) quellen.push(fs.readFileSync(p, "utf8")); } };
    rein(path.join(APP, "src"));
    // @amtlos/i18n (Wurzel) zöge die Texte der Web-App mit Entwürfen der Rechtstexte ins Bündel – die App braucht nur die Fragen
    expect(quellen.filter((q) => /from "@amtlos\/i18n"/.test(q))).toEqual([]);
  });
});
