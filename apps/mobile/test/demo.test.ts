import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { Katalog } from "@amtlos/rules-engine";
import { ApiFehler, ApiKlient, type KartenDetail } from "../src/kern/api";
import { demoAbruf } from "../src/demo/demo";
import katalogJson from "../src/demo/katalog.json";

const katalog = katalogJson as unknown as Katalog;
const WURZEL = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse(s: string): unknown };

const klient = (jetzt: Date, sprache: "de" | "en" = "de") =>
  new ApiKlient({ basis: "https://demo", token: async () => "demo", unternehmen: () => "demo-unternehmen", sprache: () => sprache, abruf: demoAbruf(katalog, () => jetzt) });

interface Fixture { stichtag: string; fakten: Record<string, unknown>; ereignisse?: unknown[]; erwartet: Record<string, string> }
const fixtures = fs
  .readdirSync(path.join(WURZEL, "catalog/fixtures"))
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => ({ datei: f, ...(YAML.parse(fs.readFileSync(path.join(WURZEL, "catalog/fixtures", f), "utf8")) as Fixture) }))
  // Die Demo kennt keine Ereignisse und nur Profilangaben
  .filter((fx) => !fx.ereignisse?.length && Object.keys(fx.fakten).every((k) => k.startsWith("profil.")))
  // Radar-Einträge werden nicht als Aufgaben angelegt (sollInstanzen) – Fixtures nur mit Radar entfallen hier
  .filter((fx) => Object.keys(fx.erwartet).some((id) => !(katalog.pflichten.find((p) => p.id === id) as { radar?: unknown } | undefined)?.radar));

describe("Demo-Modus: leerer Start, Rechnen auf dem Gerät", () => {
  it("katalog.json ist aktuell (node werkzeuge/katalog-buendel.mjs)", () => {
    const ids = fs.readdirSync(path.join(WURZEL, "catalog/pflichten")).filter((f) => f.endsWith(".yaml")).length;
    expect(katalog.pflichten.length).toBe(ids);
  });

  it("startet ohne Unternehmen und ohne Pflichten; nach dem Anlegen fehlt nur das Profil", async () => {
    const k = klient(new Date("2026-10-11T10:00:00Z"));
    expect((await k.ich()).unternehmen).toEqual([]);
    await expect(k.profil()).rejects.toBeInstanceOf(ApiFehler);
    const u = await k.unternehmenAnlegen("Mein Laden");
    expect((await k.ich()).unternehmen).toEqual([{ ...u, rolle: "inhaber" }]);
    expect((await k.profil()).version).toBe(0);
    const h = await k.heute();
    expect(h.als_naechstes).toEqual([]);
    expect(h.zaehler.offen).toBe(0);
  });

  it.each(fixtures.map((fx) => [fx.datei, fx] as const))("rechnet wie die Engine: %s", async (_datei, fx) => {
    const k = klient(new Date(`${fx.stichtag}T10:00:00Z`));
    await k.unternehmenAnlegen("Testbetrieb");
    const profil = Object.fromEntries(Object.entries(fx.fakten).map(([key, v]) => [key.slice("profil.".length), v]));
    await k.profilSpeichern(profil);
    const liste = await k.pflichten();
    let gefunden = 0;
    for (const [pflicht, erwartet] of Object.entries(fx.erwartet)) {
      const karten = liste.filter((x) => x.pflicht_id === pflicht);
      gefunden += karten.length;
      for (const x of karten) expect(x.ergebnis, `${pflicht}`).toBe(erwartet);
      if (erwartet === "gilt_nicht") for (const x of karten) expect(x.status).toBe("nicht_zutreffend");
      if (erwartet === "unbekannt") for (const x of karten) expect(x.status).toBe("angabe_fehlt");
    }
    expect(gefunden).toBeGreaterThan(0);
  });

  it("Erledigen wirkt auf Heute und Karte; Wieder öffnen nimmt es zurück; Englisch aus dem Katalog", async () => {
    const fx = fixtures.find((f) => Object.values(f.erwartet).includes("gilt"))!;
    const k = klient(new Date(`${fx.stichtag}T10:00:00Z`), "en");
    await k.unternehmenAnlegen("Testbetrieb");
    await k.profilSpeichern(Object.fromEntries(Object.entries(fx.fakten).map(([key, v]) => [key.slice(7), v])));
    const h = await k.heute();
    const ziel = h.als_naechstes[0]!;
    expect(ziel).toBeTruthy();
    const detail: KartenDetail = await k.pflicht(ziel.pflicht_id, ziel.periode);
    const p = katalog.pflichten.find((x) => x.id === ziel.pflicht_id)! as unknown as { titel: { de: string; en?: string } };
    expect(detail.titel).toBe(p.titel.en ?? p.titel.de);
    await k.erledigen(ziel.pflicht_id, ziel.periode);
    const danach = await k.heute();
    expect(danach.zaehler.erledigt).toBe(h.zaehler.erledigt + 1);
    expect((await k.pflicht(ziel.pflicht_id, ziel.periode)).status).toBe("erledigt");
    await k.wiederOeffnen(ziel.pflicht_id, ziel.periode);
    expect((await k.pflicht(ziel.pflicht_id, ziel.periode)).status).toBe(ziel.status);
  });

  it("hält den Stand über einen Neustart der App (Speicher) und rechnet dann neu", async () => {
    let abgelegt: string | null = null;
    const speicher = { lesen: async () => abgelegt, schreiben: async (v: string) => void (abgelegt = v) };
    const fx = fixtures[0]!;
    const jetzt = new Date(`${fx.stichtag}T10:00:00Z`);
    const neu = () => new ApiKlient({ basis: "https://demo", token: async () => "demo", unternehmen: () => "demo-unternehmen", sprache: () => "de", abruf: demoAbruf(katalog, () => jetzt, speicher) });
    const a = neu();
    await a.unternehmenAnlegen("Testbetrieb");
    await a.profilSpeichern(Object.fromEntries(Object.entries(fx.fakten).map(([key, v]) => [key.slice(7), v])));
    const ziel = (await a.heute()).als_naechstes[0]!;
    await a.erledigen(ziel.pflicht_id, ziel.periode);
    const b = neu(); // „App neu gestartet“
    expect((await b.ich()).unternehmen[0]!.name).toBe("Testbetrieb");
    expect((await b.pflicht(ziel.pflicht_id, ziel.periode)).status).toBe("erledigt");
    expect((await b.pflichten()).length).toBe((await a.pflichten()).length);
  });
});
