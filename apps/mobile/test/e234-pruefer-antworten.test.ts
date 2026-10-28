/**
 * E-234: Antworten des Rechtsanwalts (R1–R5) und des Steuerberaters (S5, S6) vom 27.10.2026 – App-Seite.
 * - S5 b: Kern-Frage für Kleinunternehmer erweitert auf Waren und Leistungen von Unternehmen im Ausland (EU und Drittländer);
 *   die Frage nach der EU nur bei „ja“ (USt-IdNr.); „nein“ beantwortet die EU-Frage mit.
 * - C.37 v2 bleibt zurückgehalten (nicht im Bündel), Folgen vom Rechtsanwalt freigegeben (geteilte Prüfung im Register).
 * - R4: Markenhinweis DATEV an der Exportstelle, unter „Über …“ und auf der Website; kein Abzeichen „DATEV“.
 * - R5: Testhinweis im Wortlaut des Rechtsanwalts, nur in Betatest-Builds, mit Testzeitraum statt „[Datum]“.
 * - PRUEFLISTE: T-123 geschlossen, Wiedervorlage T-346 datiert, T-345 bis T-348.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { BETATEST_FASSUNG, betatestAngenommen, betatestAnnahme, betatestHinweis, betatestZeitraum } from "../src/betatest";
import { KATALOG, checkFragen, folgeAntworten, frageZu, type Profil } from "../src/pflichten/check";
import { T as TEXT } from "../src/texte";
import { katalogEntwuerfe } from "../werkzeuge/interna.mjs";

const APP = path.resolve(__dirname, "..");
const WURZEL = path.resolve(APP, "../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
const lies = (d: string) => fs.readFileSync(path.join(WURZEL, d), "utf8");
const ID = "steuern.ust_voranmeldung_kleinunternehmer";
const KU: Profil = { rechtsform: "einzelunternehmen", gruendungsdatum: "2022-01-01", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "ust.kleinunternehmer": true, "umsatz.vorjahr": 20000 };
const fragen = (p: Profil) => checkFragen(p).map((f) => f.feld);

describe("E-234 S5 b: Kern-Frage nach dem Einkauf im Ausland", () => {
  it("Frage in der Fassung des Steuerberaters, mit Online-Werbung, Software-Abos, Plattformgebühren", () => {
    expect(frageZu("einkauf.ausland_unternehmen")?.frage.de).toBe("Kaufst du Waren oder Leistungen bei Unternehmen im Ausland ein (auch Online-Werbung, Software-Abos, Plattformgebühren)?");
    expect(frageZu("einkauf.ausland_unternehmen")?.frage.en).toBeTruthy();
  });
  it("Kleinunternehmer: zuerst Ausland, die EU-Frage nur bei „ja“; Regelbesteuerte bekommen beide nicht im Kern-Check", () => {
    expect(fragen(KU)).toContain("einkauf.ausland_unternehmen");
    expect(fragen(KU)).not.toContain("einkauf.eu_unternehmen");
    expect(fragen({ ...KU, "einkauf.ausland_unternehmen": true })).toContain("einkauf.eu_unternehmen");
    expect(fragen({ ...KU, "einkauf.ausland_unternehmen": false })).not.toContain("einkauf.eu_unternehmen");
    expect(fragen({ ...KU, "ust.kleinunternehmer": false })).not.toContain("einkauf.ausland_unternehmen");
  });
  it("„nein“ zum Ausland heißt auch kein EU-Einkauf; „ja“ zur EU heißt Einkauf im Ausland", () => {
    expect(folgeAntworten("einkauf.ausland_unternehmen", false, KU)).toEqual({ "einkauf.eu_unternehmen": false });
    expect(folgeAntworten("einkauf.ausland_unternehmen", true, KU)).toEqual({});
    expect(folgeAntworten("einkauf.eu_unternehmen", true, KU)).toEqual({ "einkauf.ausland_unternehmen": true });
    expect(folgeAntworten("einkauf.ausland_unternehmen", false, { ...KU, "einkauf.eu_unternehmen": true })).toEqual({});
  });
  it("neuer Fakt im Fakten-Katalog", () => {
    expect(lies("packages/rules-schema/fakten.json")).toContain('"pfad": "profil.einkauf.ausland_unternehmen"');
  });
});

// E-237: seit dem Nachtrag vom 28.10.2026 als v3 freigegeben (Steuerberater ohne Folgen, Rechtsanwalt Folgen) und im Bündel
describe("E-234 S5/R1: C.37 nach der Antwort des Steuerberaters (E-237: v3 freigegeben)", () => {
  const c37 = YAML.parse(lies(`catalog/pflichten/${ID}.yaml`)) as { version: number; nicht_vor_freigabe: boolean; kurz: { de: string }; erklaerung: { de: string }; pruefung: { status: string } };
  it("Kurztext des Steuerberaters, Jahreserklärung bis 31.07. (§ 149 Abs. 2 AO); E-237: v3, nicht mehr zurückgehalten", () => {
    expect(c37.version).toBe(3);
    expect(c37.nicht_vor_freigabe).toBeUndefined();
    expect(c37.kurz.de).toContain("für die Voranmeldungszeiträume, in denen diese Steuer entsteht, eine Voranmeldung ab – bis zum 10. Tag nach Ablauf des Zeitraums.");
    expect(c37.erklaerung.de).toContain("bis zum 31.07. des Folgejahres (§ 149 Abs. 2 AO");
    expect(c37.erklaerung.de).toContain("§ 13b Abs. 2 Nr. 1 UStG");
    expect(c37.erklaerung.de).not.toMatch(/jeden Monat/);
    expect(KATALOG.pflichten.map((p) => p.id)).toContain(ID);
    expect(katalogEntwuerfe()).toEqual({ blockierend: [], zurueckgehalten: [] });
  });
  it("Register: Folgen vom Rechtsanwalt freigegeben (Umfang sanktion); E-237: Steuerberater ohne Folgen ⇒ freigegeben", () => {
    expect(c37.pruefung.status).toBe("freigegeben");
    expect(lies("docs/freigabe-katalog/anwenden.py")).toContain('"steuer_folgen_recht": [(STEUERN, "ohne_sanktion"), (RECHT, "sanktion")]');
    const reg = YAML.parse(lies("docs/freigabe-katalog/freigaben.yaml")) as { pruefer: string; umfang: string; eintraege: Record<string, unknown> }[];
    expect(reg.some((b) => b.pruefer === "recht" && b.umfang === "sanktion" && ID in b.eintraege)).toBe(true);
    expect(reg.some((b) => b.pruefer === "steuern" && b.umfang === "ohne_sanktion" && ID in b.eintraege)).toBe(true);
    expect(execFileSync("python3", [path.join(WURZEL, "docs/freigabe-katalog/anwenden.py"), "--pruefen"], { cwd: WURZEL, encoding: "utf8" })).toContain("{'freigegeben': 231, 'in_pruefung': 0, 'entwurf': 0}");
  });
});

describe("E-234 R4: DATEV-Markenhinweis", () => {
  const SATZ = "DATEV ist eine eingetragene Marke der DATEV eG.";
  it("Wortlaut des Rechtsanwalts, an der Exportstelle und unter „Über …“", () => {
    expect(TEXT.datev_marke).toMatch(/^DATEV ist eine eingetragene Marke der DATEV eG\. .+ ist kein Produkt der DATEV eG und nicht von ihr zertifiziert\.$/);
    expect(fs.readFileSync(path.join(APP, "src/seiten/Steuerberatung.tsx"), "utf8")).toContain("{TEXT.datev_marke}");
    expect(fs.readFileSync(path.join(APP, "src/seiten/Betrieb.tsx"), "utf8")).toContain("{TEXT.datev_marke}");
  });
  it("Website (nennt das DATEV-Format) mit dem Hinweis in der Fußzeile; kein Abzeichen „DATEV“ bei Kanzleien", () => {
    expect(lies("apps/website/bauen.mjs")).toContain(SATZ);
    expect(TEXT.kanzlei_datev).not.toBe("DATEV");
  });
});

describe("E-234 R5: Testhinweis im Betatest", () => {
  const z = betatestZeitraum("2026-11-03", "2026-11-24")!;
  it("Wortlaut des Rechtsanwalts mit eingesetztem Zeitraum, TestFlight-Satz nur bei TestFlight", () => {
    const h = betatestHinweis(z, { art: "app", testflight: true });
    expect(h.titel).toMatch(/^Testhinweis .+ \(Betatest\)$/);
    expect(h.absaetze[0]).toContain("Lang Ventures UG (haftungsbeschränkt) i. G., Gomaringer Str. 33, 72770 Reutlingen, stellt dir eine Testversion der App");
    expect(h.absaetze[0]).toContain("vom 03.11.2026 bis zum 24.11.2026 kostenlos zur Verfügung.");
    expect(h.absaetze[2]).toBe("3. Wir haften nur für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit.");
    expect(h.absaetze[5]).toContain("Apple erhebt über TestFlight eigene Daten; dafür gelten die Bedingungen von Apple.");
    expect(h.absaetze[5]).toContain("(Art. 6 Abs. 1 lit. b DSGVO) und löschen sie spätestens drei Monate nach Ende des Tests.");
    expect(betatestHinweis(z, { art: "app", testflight: false }).absaetze[5]).not.toContain("TestFlight");
    expect(h.bestaetigung).toBe("Mit „Ich nehme teil“ bestätigst du diesen Hinweis.");
    expect(betatestHinweis(z, { art: "mail", testflight: false }).bestaetigung).toBe("Mit deiner Antwort auf diese E-Mail bestätigst du diesen Hinweis.");
    expect(JSON.stringify(h)).not.toContain("[Datum]");
    expect(TEXT.betatest_teilnehmen).toBe("Ich nehme teil");
  });
  it("ohne gültigen Zeitraum kein Hinweis (die Testversion sperrt); Annahme gilt nur für Fassung und Zeitraum", () => {
    expect(betatestZeitraum("", "2026-11-24")).toBeNull();
    expect(betatestZeitraum("2026-11-24", "2026-11-03")).toBeNull();
    expect(betatestZeitraum("2026-02-30", "2026-03-10")).toBeNull();
    const a = JSON.stringify(betatestAnnahme(z, new Date("2026-11-03T08:00:00Z")));
    expect(betatestAngenommen(a, z)).toBe(true);
    expect(betatestAngenommen(a, { ...z, bis: "2026-12-01" })).toBe(false);
    expect(betatestAngenommen(JSON.stringify({ ...JSON.parse(a), fassung: "alt" }), z)).toBe(false);
    expect(betatestAngenommen(null, z)).toBe(false);
    expect(BETATEST_FASSUNG).toBe("2026-10-27");
  });
  it("nur im EAS-Profil „betatest“, nie im Store-Build; App sperrt davor; store-check prüft den Zeitraum", () => {
    const eas = JSON.parse(fs.readFileSync(path.join(APP, "eas.json"), "utf8"));
    expect(eas.build.betatest.env.EXPO_PUBLIC_BETATEST).toBe("1");
    expect(eas.build.production.env?.EXPO_PUBLIC_BETATEST).toBeUndefined();
    expect(fs.readFileSync(path.join(APP, "src/App.tsx"), "utf8")).toMatch(/<BetatestTor>\s*<ZustimmungTor>/);
    expect(fs.readFileSync(path.join(APP, "werkzeuge/store-check.mjs"), "utf8")).toContain("Betatest: Testzeitraum für den Testhinweis gesetzt");
    expect(lies("docs/betatest-hinweis.md")).toContain("Mit deiner Antwort auf diese E-Mail bestätigst du diesen Hinweis.");
  });
});

describe("E-234: PRUEFLISTE", () => {
  const liste = lies("PRUEFLISTE.md");
  const z = (t: string) => liste.split("\n").find((x) => x.startsWith(`| ${t} |`)) ?? "";
  it("T-123 geschlossen mit Datum, Wiedervorlage T-346 datiert; T-337 beantwortet, Rest T-345; T-345 bis T-348 vorhanden", () => {
    expect(z("T-123")).toMatch(/\| ~~.*~~ \*\*Erledigt 27\.10\.2026 \(E-234\)/);
    expect(z("T-346")).toMatch(/04\.01\.2027/);
    expect(z("T-337")).toMatch(/Beantwortet 27\.10\.2026 \(E-234\)/);
    for (const t of ["T-345", "T-346", "T-347", "T-348"]) expect(z(t), t).toContain("E-234");
  });
});
