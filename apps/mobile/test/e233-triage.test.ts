/**
 * E-233 (Gründer 27.10.2026: „Prüfliste immer geprüft und aktuell – was du selbst beantworten kannst, beantworte selbst“).
 *
 * 1) Neue Entwürfe nach dem Startstand mit `nicht_vor_freigabe: true` erscheinen erst mit ihrer Freigabe: nicht im Bündel
 *    der App (katalog-buendel.mjs), kein Startblocker in store-check („jeder Eintrag fachlich freigegeben“), sondern dort als
 *    zurückgehalten genannt. Erster Fall: steuern.ust_voranmeldung_kleinunternehmer (C.37, § 18 Abs. 4a UStG) – der Hinweis
 *    der App am Beleg und bei der Übernahme in die Voranmeldung bleibt. Kein anderer Eintrag darf einen zurückgehaltenen
 *    voraussetzen oder nennen (Validator).
 * 2) Fundstelle im Hinweis zur Erwerbsschwelle: neue Fahrzeuge und verbrauchsteuerpflichtige Waren nimmt § 1a Abs. 5 Satz 1
 *    UStG von Absatz 3 aus („Absatz 3 gilt nicht für den Erwerb neuer Fahrzeuge und verbrauchsteuerpflichtiger Waren.“) –
 *    nicht § 1a Abs. 3 Nr. 2 UStG (T-336 (2)).
 * 3) PRUEFLISTE: Zusammenfassung oben, jede offene Zeile mit Einordnung (B Sammelrunde, C Gründer, D Startblocker), keine
 *    doppelt offene Nummer.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { KATALOG, auswertung, checkFragen, type Profil } from "../src/pflichten/check";
import { T as TEXT } from "../src/texte";
import { katalogEntwuerfe, ohneInterna, zurueckgehalten } from "../werkzeuge/interna.mjs";
import { validiereKatalog } from "../../../packages/rules-schema/validieren.mjs";

const WURZEL = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => Record<string, unknown>; stringify: (x: unknown) => string };
const ID = "steuern.ust_voranmeldung_kleinunternehmer";
const C37 = YAML.parse(fs.readFileSync(path.join(WURZEL, `catalog/pflichten/${ID}.yaml`), "utf8")) as { nicht_vor_freigabe?: boolean; pruefung: { status: string }; titel: { de: string } };
const KU: Profil = { rechtsform: "einzelunternehmen", gruendungsdatum: "2022-01-01", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "ust.kleinunternehmer": true, "umsatz.vorjahr": 20000, "einkauf.eu_unternehmen": true };

describe("E-233 (1): Entwurf C.37 erscheint erst mit der Freigabe", () => {
  it("im Katalog als Entwurf mit nicht_vor_freigabe", () => {
    expect(C37.pruefung.status).toBe("entwurf");
    expect(C37.nicht_vor_freigabe).toBe(true);
    expect(zurueckgehalten(C37)).toBe(true);
  });
  it("nicht im Bündel der App – die Auswertung zeigt ihn weder als „gilt“ noch als „hängt ab“", () => {
    expect(KATALOG.pflichten.map((p) => p.id)).not.toContain(ID);
    const a = auswertung(KU, "2026-10-27");
    expect([...a.gilt, ...a.unbekannt].map((x) => x.id)).not.toContain(ID);
    const unterlagen = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/unterlagen/katalog.json"), "utf8")) as { id: string }[];
    expect(unterlagen.map((p) => p.id)).not.toContain(ID);
    for (const datei of ["../src/pflichten/katalog.json", "../src/unterlagen/katalog.json"]) expect(fs.readFileSync(path.join(__dirname, datei), "utf8")).not.toContain("nicht_vor_freigabe");
  });
  it("der Hinweis der App zu § 18 Abs. 4a UStG bleibt (Beleg, Übernahme in die Voranmeldung)", () => {
    expect(TEXT.e227_ku_va_pflicht).toContain("§ 18 Abs. 4a UStG");
  });
  it("die Frage nach dem Einkauf im EU-Ausland bleibt im Kern-Check der Kleinunternehmer (USt-IdNr., gruendung.ust_idnr)", () => {
    const { "einkauf.eu_unternehmen": _e, ...ohne } = KU;
    expect(checkFragen(ohne).map((f) => f.feld)).toContain("einkauf.eu_unternehmen");
    expect(fs.readFileSync(path.join(WURZEL, "catalog/pflichten/gruendung.ust_idnr.yaml"), "utf8")).toContain("profil.einkauf.eu_unternehmen");
  });
  it("store-check: kein blockierender Entwurf, C.37 als zurückgehalten genannt", () => {
    expect(katalogEntwuerfe()).toEqual({ blockierend: [], zurueckgehalten: [ID] });
  });
  it("Regel: nur ohne Freigabe zurückgehalten; ein Entwurf ohne Merkmal bleibt Startblocker; das Merkmal geht nie ins Bündel", () => {
    expect(zurueckgehalten({ nicht_vor_freigabe: true, pruefung: { status: "freigegeben" } })).toBe(false);
    expect(zurueckgehalten({ pruefung: { status: "entwurf" } })).toBe(false);
    expect(zurueckgehalten({ nicht_vor_freigabe: true, pruefung: { status: "in_pruefung" } })).toBe(true);
    expect(Object.keys(ohneInterna({ id: "x", nicht_vor_freigabe: true }))).toEqual(["id"]);
  });
  it("Validator: ein anderer Eintrag darf den zurückgehaltenen weder voraussetzen noch nennen", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e233-"));
    try {
      fs.cpSync(path.join(WURZEL, "catalog"), tmp, { recursive: true });
      expect(validiereKatalog(tmp).fehler).toEqual([]);
      const datei = path.join(tmp, "pflichten/steuern.ust_voranmeldung.yaml");
      const p = YAML.parse(fs.readFileSync(datei, "utf8")) as { erklaerung: { de: string } };
      p.erklaerung.de += ` Siehe „${C37.titel.de}“.`;
      fs.writeFileSync(datei, YAML.stringify(p));
      expect((validiereKatalog(tmp).fehler as string[]).some((f) => f.includes("zurückgehalten"))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("E-233 (2): Fundstelle neue Fahrzeuge / verbrauchsteuerpflichtige Waren", () => {
  it("§ 1a Abs. 5 Satz 1 UStG statt § 1a Abs. 3 Nr. 2 UStG", () => {
    const h = TEXT.e227_schwelle_hinweis("12.500 €");
    expect(h).toContain("Bei der Erwerbsschwelle zählen sie nicht mit (§ 1a Abs. 5 Satz 1 UStG)");
    expect(h).not.toContain("§ 1a Abs. 3 Nr. 2 UStG");
  });
});

describe("E-233 (3): PRUEFLISTE eingeordnet", () => {
  const liste = fs.readFileSync(path.join(WURZEL, "PRUEFLISTE.md"), "utf8");
  const zeilen = liste.split("\n").filter((z) => /^\| [TGJ]-\d+ \|/.test(z));
  const offen = zeilen.filter((z) => !(z.split("|")[2] ?? "").trim().startsWith("~~"));
  it("Zusammenfassung oben mit Datum, Zahlen je Gruppe und Ort der Sammelrunde", () => {
    const kopf = liste.slice(0, liste.indexOf("## Grundsätzliche Punkte"));
    expect(kopf).toMatch(/Triage 27\.10\.2026 \(E-233\)/);
    for (const g of ["A", "B", "C", "D"]) expect(kopf).toMatch(new RegExp(`\\*\\*${g}\\*\\*[^|\\n]*\\d+`));
    expect(kopf).toMatch(/beim Gründer/);
  });
  it("jede offene Zeile trägt ihre Einordnung, keine Nummer doppelt offen", () => {
    const ohne = offen.filter((z) => !/\*\*\[(B → Sammelrunde 20\.11\.|C Gründer[^\]]*|D Startblocker[^\]]*)\]\*\*/.test(z)).map((z) => (z.split("|")[1] ?? "").trim());
    expect(ohne).toEqual([]);
    const nr = offen.map((z) => (z.split("|")[1] ?? "").trim());
    expect(nr.filter((n, i) => nr.indexOf(n) !== i)).toEqual([]);
  });
  it("C.37 in der Sammelrunde, kein Startblocker; T-339 entschieden (ereignisbezogen, erst mit der Freigabe)", () => {
    const z = (t: string) => zeilen.find((x) => x.startsWith(`| ${t} |`)) ?? "";
    expect(z("T-337")).toMatch(/\[B → Sammelrunde 20\.11\.\]/);
    expect(z("T-337")).not.toMatch(/Startblocker:\*\* `steuern/);
    expect(z("T-339")).toMatch(/Selbst geklärt 27\.10\.2026 \(E-233\)/);
  });
});

describe("E-233 (4): T-265 nach der Linie des Gründers – Kernfrage statt „hängt ab“", () => {
  const solo: Profil = { rechtsform: "einzelunternehmen", gruendungsdatum: "2023-03-01", "taetigkeit.einordnung": "gewerbe", "taetigkeit.branchen": ["handwerk"], bundesland: "BW", "beschaeftigte.gesamt": 0, "ust.kleinunternehmer": false };
  const fragen = (p: Profil) => checkFragen(p).map((f) => f.feld);
  it("Gewinn im Vorjahr bis zum Freibetrag (Wert aus dem Auslöser der Gewerbesteuererklärung): erwarteter Gewinn im Kern-Check", () => {
    expect(fragen({ ...solo, "gewinn.vorjahr": 18000 })).toContain("gewinn.prognose_laufendes_jahr");
    expect(fragen({ ...solo, "gewinn.vorjahr": 40000 })).not.toContain("gewinn.prognose_laufendes_jahr");
    expect(fragen(solo)).not.toContain("gewinn.prognose_laufendes_jahr");
    expect(fragen({ ...solo, "taetigkeit.einordnung": "freiberuf", "gewinn.vorjahr": 18000 })).not.toContain("gewinn.prognose_laufendes_jahr");
    const a = auswertung({ ...solo, "gewinn.vorjahr": 18000, "gewinn.prognose_laufendes_jahr": 10000 }, "2026-10-27");
    expect(a.unbekannt.map((x) => x.id)).not.toContain("steuern.gewst_erklaerung");
  });
  it("e. K. mit Vorjahr: Umsatz des Vorjahres im Kern-Check (§ 241a HGB), andere Rechtsformen nicht", () => {
    expect(fragen({ ...solo, rechtsform: "ek" })).toContain("umsatz.vorjahr");
    expect(fragen(solo)).not.toContain("umsatz.vorjahr");
    expect(fragen({ ...solo, rechtsform: "ek", gruendungsdatum: "2026-02-01" })).not.toContain("umsatz.vorjahr");
  });
});
