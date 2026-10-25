import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ExpoConfig } from "expo/config";
import { SYNC_DATENARTEN, mitBuild } from "../app.config";
import { knopfText, preisZeile } from "../src/pro/bezahltext";
import { hilfeZiel } from "../src/rechtliches";
import { T as TEXT } from "../src/texte";
import { MARKE } from "@amtlos/marke";
import { fehlerbericht } from "../src/ui/fehlerbericht";

const hier = path.dirname(fileURLToPath(import.meta.url));
const app = JSON.parse(readFileSync(path.resolve(hier, "../app.json"), "utf8")) as { expo: ExpoConfig };

describe("Bezahlschirm (App-Review B2/R2/R3)", () => {
  it("ohne Kauf und ohne Testmodus gibt es keinen Knopf – nie „Pro testweise einschalten“", () => {
    expect(knopfText({ kaufAktiv: false, testmodus: false })).toBeNull();
    expect(knopfText({ kaufAktiv: false, testmodus: true })).toBe(TEXT.pro_test_einschalten);
    expect(knopfText({ kaufAktiv: true, testmodus: false, gewaehlt: { test: null } })).toBe(TEXT.pro_abonnieren);
    expect(knopfText({ kaufAktiv: true, testmodus: false, gewaehlt: { test: "14 Tage" } })).toBe(TEXT.pro_test_starten);
  });
  it("Preis nach dem Testzeitraum steht in derselben Zeile; ohne Berechtigung nur der Preis", () => {
    expect(preisZeile({ preis: "49,99 €", zeitraum: "jährlich", je: "pro Jahr", test: "14 Tage" })).toBe("14 Tage kostenlos, danach 49,99 € pro Jahr");
    expect(preisZeile({ preis: "4,99 €", zeitraum: "monatlich", je: "pro Monat", test: null })).toBe("4,99 € pro Monat");
    expect(preisZeile({ preis: "4,99 €", zeitraum: "monatlich", je: "", test: null })).toBe("4,99 € monatlich");
    expect(preisZeile(undefined)).toBeNull();
  });
});

describe("Store-Konfiguration (App-Review B3/R7)", () => {
  it("Export-Compliance: eigene Verschlüsselung ist deklariert", () => {
    expect(app.expo.ios?.config?.usesNonExemptEncryption).toBe(true);
  });
  it("Kaufhistorie mit App-Funktionalität und Analysen; Konto-Daten nur in Builds mit Sync", () => {
    const arten = app.expo.ios?.privacyManifests?.NSPrivacyCollectedDataTypes ?? [];
    expect(arten.map((d) => d.NSPrivacyCollectedDataType)).toEqual(["NSPrivacyCollectedDataTypePurchaseHistory"]);
    expect(arten[0]?.NSPrivacyCollectedDataTypePurposes).toEqual(expect.arrayContaining(["NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"]));
    expect(mitBuild(app.expo, false)).toBe(app.expo);
    const mitSync = mitBuild(app.expo, true).ios?.privacyManifests?.NSPrivacyCollectedDataTypes ?? [];
    expect(mitSync).toHaveLength(1 + SYNC_DATENARTEN.length);
    expect(mitSync.map((d) => d.NSPrivacyCollectedDataType)).toEqual(expect.arrayContaining(["NSPrivacyCollectedDataTypeEmailAddress", "NSPrivacyCollectedDataTypeName", "NSPrivacyCollectedDataTypeUserID"]));
    // übrige Angaben bleiben erhalten, doppelt wird nichts
    expect(mitBuild(mitBuild(app.expo, true), true).ios?.privacyManifests?.NSPrivacyCollectedDataTypes).toHaveLength(mitSync.length);
    expect(mitBuild(app.expo, true).ios?.privacyManifests?.NSPrivacyAccessedAPITypes).toEqual(app.expo.ios?.privacyManifests?.NSPrivacyAccessedAPITypes);
  });
});

describe("Versprechen in der App (App-Review R6) und Kontakt (B1)", () => {
  it("Onboarding verspricht keine Abgabe der Voranmeldung und kennzeichnet Pro", () => {
    const r = TEXT.start_punkte.find((p) => p.symbol === "eurosign.circle")!;
    expect(r.text).not.toMatch(/Voranmeldung gleich mit/);
    expect(r.text).toMatch(/E-Rechnung \(Pro\)/);
    expect(r.text).toMatch(/Voranmeldung[^.]*\(Pro\)/);
  });
  it("Hilfe & Kontakt: Support-Seite, sonst die Anbieter-E-Mail, nie etwas Erfundenes", () => {
    expect(hilfeZiel("https://amtlos.de/hilfe", "hallo@x.de")).toBe("https://amtlos.de/hilfe");
    expect(hilfeZiel("", "hallo@x.de")).toBe("mailto:hallo@x.de");
    expect(hilfeZiel("", "")).toBe("");
  });
});

describe("Fehlerbericht der Fehlergrenze", () => {
  it("enthält Version, Meldung und gekürzten Stack – sonst nichts", () => {
    const e = new Error("x ist undefined");
    e.stack = ["Error: x ist undefined", ...Array.from({ length: 40 }, (_, i) => `    at f${i} (app.js:${i})`)].join("\n");
    const b = fehlerbericht(e, "\n    in Heute\n    in Rahmen", { version: "1.0.0", plattform: "ios 18.0", zeit: new Date("2026-10-20T10:00:00Z") });
    expect(b.startsWith(`${MARKE.name} 1.0.0 · ios 18.0 · 2026-10-20T10:00:00.000Z`)).toBe(true);
    expect(b).toMatch(/Error: x ist undefined/);
    expect(b).toMatch(/weitere Zeilen/);
    expect(b).toMatch(/in Heute/);
    expect(b).not.toMatch(/at f30 /);
    expect(fehlerbericht("kaputt", null, { version: "1.0.0", plattform: "ios", zeit: new Date(0) })).toMatch(/Error: kaputt/);
  });
});
