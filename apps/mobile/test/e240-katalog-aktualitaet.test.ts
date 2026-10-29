/**
 * E-240 (externe Rückmeldung 29.10.2026): „Rechtsinhalte kommen nur mit einem App-Update, und die App warnt nicht, wenn
 * der Katalog veraltet ist.“
 * (1) Hinweis „Rechtsstand vom TT.MM.JJJJ – bitte App aktualisieren“: mehr als 120 Tage nach dem Rechtsstand oder sofort,
 *     wenn ein Änderungsstichtag des Katalogs (Entwurf/geplant, Regelwert ohne Folgeversion) erreicht ist – mit festem
 *     Datum geprüft; auf „Heute“ und in der Einleitung des Checks; sperrt nichts.
 * (2) Inhalts-Updates (expo-updates) vorbereitet, Standard aus; Freigabe-Tor vor `eas update`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ExpoConfig } from "expo/config";
import { mitInhaltsUpdates } from "../app.config";
import { KATALOG_ALT_TAGE, aenderungsStichtage, katalogAktualitaet, rechtsstandHinweisTexte, rechtsstandTag, veraltetAb, type KatalogStand } from "../src/pflichten/aktualitaet";
import { DATENSCHUTZ, DATENSCHUTZ_ANDROID, aktualisierenLink } from "../src/rechtliches";

const hier = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(hier, "..");
const lies = (p: string) => readFileSync(path.join(APP, p), "utf8");

const kat = (k: Partial<KatalogStand> = {}): KatalogStand => ({ rechtsstand: { datum: "2026-10-21" }, pflichten: [], regelwerte: [], ...k });

describe("E-240 (1) – Aktualität des Katalogs mit festem Datum", () => {
  it("Rechtsstand aus dem gebündelten Katalog; nur Monat → Monatserster", () => {
    expect(rechtsstandTag()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rechtsstandTag(kat())).toBe("2026-10-21");
    expect(rechtsstandTag(kat({ rechtsstand: "2026-10" }))).toBe("2026-10-01");
    expect(rechtsstandTag(kat({ rechtsstand: undefined }))).toBeNull();
    expect(katalogAktualitaet("2030-01-01", kat({ rechtsstand: undefined })).grund).toBeNull();
  });

  it(`Alter: bis ${KATALOG_ALT_TAGE} Tage aktuell, ab Tag ${KATALOG_ALT_TAGE + 1} „alter“`, () => {
    expect(KATALOG_ALT_TAGE).toBe(120);
    expect(katalogAktualitaet("2026-10-29", kat())).toEqual({ stand: "2026-10-21", tage: 8, grund: null });
    expect(katalogAktualitaet("2027-02-18", kat())).toMatchObject({ tage: 120, grund: null });
    expect(katalogAktualitaet("2027-02-19", kat())).toMatchObject({ tage: 121, grund: "alter" });
    expect(veraltetAb(kat())).toBe("2027-02-19");
  });

  it("Stichtag: Entwurf/geplant mit gueltig_ab bzw. radar.erwartet_ab – ab dem Tag sofort, davor nicht", () => {
    const k = kat({ pflichten: [{ id: "x.entwurf", status_recht: "entwurf", gueltig_ab: "2027-01-01" }, { id: "y.geplant", status_recht: "geplant", gueltig_ab: null, radar: { erwartet_ab: "2026-12-01" } }] });
    expect(aenderungsStichtage(k).map((s) => [s.datum, s.id, s.art])).toEqual([["2026-12-01", "y.geplant", "entwurf"], ["2027-01-01", "x.entwurf", "entwurf"]]);
    expect(katalogAktualitaet("2026-11-30", k).grund).toBeNull();
    expect(katalogAktualitaet("2026-12-01", k)).toMatchObject({ grund: "stichtag", stichtag: { datum: "2026-12-01", id: "y.geplant" } });
    expect(veraltetAb(k)).toBe("2026-12-01");
  });

  it("kein Stichtag: beschlossen/in Kraft mit späterem Beginn (Inhalt steht fest), Daten vor dem Rechtsstand", () => {
    const k = kat({
      pflichten: [
        { id: "a", status_recht: "beschlossen", gueltig_ab: "2026-12-01", radar: { erwartet_ab: "2026-12-01" } },
        { id: "b", status_recht: "in_kraft", gueltig_ab: "2026-12-01" },
        { id: "c", status_recht: "entwurf", gueltig_ab: "2026-10-01" },
      ],
    });
    expect(aenderungsStichtage(k)).toEqual([]);
    expect(katalogAktualitaet("2027-01-15", k).grund).toBeNull();
  });

  it("Regelwert endet ohne Folgeversion → Stichtag am Tag danach; mit Folgeversion (auch beschlossen) nicht", () => {
    const ohne = kat({ regelwerte: [{ id: "w", version: 1, status_recht: "in_kraft", gueltig_ab: "2026-01-01", gueltig_bis: "2026-12-31" }] });
    expect(aenderungsStichtage(ohne)).toEqual([{ datum: "2027-01-01", id: "w@1", art: "ohne_folgewert" }]);
    expect(katalogAktualitaet("2027-01-01", ohne).grund).toBe("stichtag");
    const mit = kat({ regelwerte: [...ohne.regelwerte!, { id: "w", version: 2, status_recht: "beschlossen", gueltig_ab: "2027-01-01", gueltig_bis: null }] });
    expect(aenderungsStichtage(mit)).toEqual([]);
    // Folgeversion ohne Datum (geplant) zählt nicht
    const geplant = kat({ regelwerte: [...ohne.regelwerte!, { id: "w", version: 2, status_recht: "geplant", gueltig_ab: null }] });
    expect(aenderungsStichtage(geplant).map((s) => s.id)).toEqual(["w@1"]);
  });

  it("ein neuerer Katalog (späterer Rechtsstand) hebt den Hinweis auf", () => {
    const pflichten = [{ id: "x", status_recht: "entwurf", gueltig_ab: "2027-01-01" }];
    expect(katalogAktualitaet("2027-01-05", kat({ pflichten })).grund).toBe("stichtag");
    expect(katalogAktualitaet("2027-01-05", kat({ rechtsstand: { datum: "2027-01-02" }, pflichten })).grund).toBeNull();
  });

  it("gebündelter Katalog: heute aktuell; spätestens 121 Tage nach dem Rechtsstand veraltet", () => {
    const stand = rechtsstandTag()!;
    expect(katalogAktualitaet("2026-10-29").grund).toBeNull();
    const ab = veraltetAb()!;
    expect(ab > stand).toBe(true);
    const spaetestens = new Date(Date.parse(`${stand}T00:00:00Z`) + (KATALOG_ALT_TAGE + 1) * 864e5).toISOString().slice(0, 10);
    expect(ab <= spaetestens).toBe(true);
    expect(katalogAktualitaet(ab).grund).not.toBeNull();
  });

  it("Texte: „Rechtsstand vom TT.MM.JJJJ – bitte App aktualisieren“, ruhig, nichts gesperrt", () => {
    expect(rechtsstandHinweisTexte("2026-10-29", kat())).toBeNull();
    const alt = rechtsstandHinweisTexte("2027-03-01", kat())!;
    expect(alt.titel).toBe("Rechtsstand vom 21.10.2026 – bitte App aktualisieren");
    expect(alt.text).toMatch(/im App Store/);
    expect(alt.text).toMatch(/wie gewohnt nutzen/);
    const st = rechtsstandHinweisTexte("2027-01-02", kat({ pflichten: [{ id: "x", status_recht: "entwurf", gueltig_ab: "2027-01-01" }] }))!;
    expect(st.text).toMatch(/^Seit dem 01\.01\.2027 können Änderungen gelten/);
  });

  it("Link zur Store-Seite: Google Play über den Paketnamen, App Store über LINKS.appStore (store-check meldet ihn)", () => {
    expect(aktualisierenLink(true)).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=de\.amtlos\.app$/);
    expect(typeof aktualisierenLink(false)).toBe("string");
    expect(lies("werkzeuge/store-check.mjs")).toMatch(/LINKS\.appStore = https:\/\/apps\.apple\.com\/app\/id/);
  });

  it("eingehängt auf „Heute“ und in der Einleitung des Checks – nur Hinweis, keine Sperre", () => {
    expect(lies("src/seiten/Heute.tsx")).toMatch(/<RechtsstandHinweis \/>/);
    const check = lies("src/seiten/Check.tsx");
    const einleitung = check.slice(check.indexOf("{i < 0 ? ("), check.indexOf(") : zwischenschirm ? ("));
    expect(einleitung).toMatch(/<RechtsstandHinweis buehne \/>/);
    const h = lies("src/seiten/RechtsstandHinweis.tsx");
    expect(h).not.toMatch(/disabled=\{true\}|sperre|Alert\./);
  });
});

describe("E-240 (2) – Inhalts-Updates: vorbereitet, Standard aus", () => {
  const basis = { name: "x", slug: "amtlos", extra: { eas: { projectId: "abc-123" } } } as unknown as ExpoConfig;

  it("ohne INHALTS_UPDATES=1 nie ein Update-Server (updates.enabled false)", () => {
    expect(mitInhaltsUpdates(basis, {}).updates).toEqual({ enabled: false, checkAutomatically: "NEVER" });
    expect(mitInhaltsUpdates(basis, {}).runtimeVersion).toBeUndefined();
    // Flag ohne Projekt und ohne eigenen Server: weiter aus
    expect(mitInhaltsUpdates({ ...basis, extra: {} }, { INHALTS_UPDATES: "1" }).updates?.enabled).toBe(false);
  });

  it("mit Flag: EAS Update bzw. eigener Server, beim Start im Hintergrund, gilt erst beim nächsten Start, Fingerabdruck", () => {
    const eas = mitInhaltsUpdates(basis, { INHALTS_UPDATES: "1" });
    expect(eas.updates).toEqual({ enabled: true, url: "https://u.expo.dev/abc-123", checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 });
    expect(eas.runtimeVersion).toEqual({ policy: "fingerprint" });
    expect(mitInhaltsUpdates(basis, { INHALTS_UPDATES: "1", INHALTS_UPDATES_URL: "https://updates.example.de/manifest" }).updates?.url).toBe("https://updates.example.de/manifest");
  });

  it("Kanäle in eas.json; kein Store-Build schaltet Inhalts-Updates ein", () => {
    const eas = JSON.parse(lies("eas.json"));
    expect([eas.build.production.channel, eas.build.preview.channel, eas.build.betatest.channel]).toEqual(["production", "preview", "betatest"]);
    for (const p of Object.values(eas.build) as { env?: Record<string, string> }[]) expect(p.env?.INHALTS_UPDATES).toBeUndefined();
  });

  it("expo-updates passend zur Expo-Version installiert", () => {
    const pkg = JSON.parse(lies("package.json"));
    const require = createRequire(path.join(APP, "package.json"));
    const erwartet = (require("expo/bundledNativeModules.json") as Record<string, string>)["expo-updates"];
    expect(pkg.dependencies["expo-updates"]).toBe(erwartet);
  });

  it("Datenschutz: die freigegebenen Hinweise nennen keinen Update-Server – deshalb bleibt es aus (T-366/T-367)", () => {
    const alle = JSON.stringify([DATENSCHUTZ.abschnitte, DATENSCHUTZ_ANDROID.abschnitte]);
    expect(alle).not.toMatch(/Update-Server|expo\.dev|Expo/);
    expect(alle).toMatch(/ohne Server von/);
  });

  it("Freigabe-Tor nutzt dieselben Prüfungen wie der Store-Check", () => {
    const gate = lies("werkzeuge/inhalte-gate.mjs");
    expect(gate).toMatch(/from "\.\/freigabe-pruefungen\.mjs"/);
    expect(lies("werkzeuge/store-check.mjs")).toMatch(/import\("\.\/freigabe-pruefungen\.mjs"\)/);
    for (const t of ["katalog-buendel.mjs", "aktualitaet.ts", "Update-Server", "git\", [\"status\""]) expect(gate).toContain(t);
    expect(lies("../../docs/inhalte-aktualisieren.md")).toMatch(/inhalte-gate\.mjs/);
  });
});
