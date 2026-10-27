/**
 * E-217: Antworten der Prüfer vom 27.10.2026 (Mail beim Gründer, im Register in unseren Worten).
 * A) Steuerberater zu T-282: Voranmeldung bestätigt mit Korrektur der Fundstelle und kleiner Ergänzung – der Satz zur
 *    Dauerfristverlängerung steht jetzt in seiner Fassung (v9), seine Bestätigung gilt für v9. Der Neugründer-Radar nennt
 *    noch die alte Fundstelle – nicht still geändert, Frage an den Steuerberater (PRUEFLISTE).
 * B1) Rechtsanwalt zu T-278: Datenschutzbeauftragter v4 bestätigt; Maßgaben: die 20-Personen-Schwelle (§ 38 Abs. 1 Satz 1
 *    BDSG) gilt in allen Branchen unabhängig von den Fällen des Satzes 2 (auch bei „Nichts davon“), Hilfetext unter
 *    der Antwort „Für eine Verarbeitung ist eine Datenschutz-Folgenabschätzung nötig“.
 * B2) NIS2: (a) „unter 50“ statt „unter 10“, (b) „IT, Agentur, Freelancer“ wie „Andere“, (c) weitere NIS2-Branchen
 *    Gesundheit und Pflege, Transport und Logistik, Lebensmittel (Gastronomie und Lebensmittel); Satz zur Bilanzsumme.
 *    So umgesetzt gilt die Regel ohne erneute Vorlage als bestätigt.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { StandardKalender } from "@amtlos/fristen";
import { SCHRITTE } from "@amtlos/i18n";
import { auswerten, type Katalog } from "@amtlos/rules-engine";
import { KATALOG, auswertung, type Profil } from "../src/pflichten/check";
import { pruefVermerk, type PruefungRoh } from "../src/pflichten/pruefer";

const WURZEL = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
const AM = new Date(2026, 9, 27);
const STICHTAG = "2026-10-27";
type Label = { de: string };
type P = { id: string; version: number; erklaerung?: { de: string }; aenderungsnotiz?: { de: string }; ausloeser?: unknown; pruefung?: PruefungRoh };
const pflichten = KATALOG.pflichten as unknown as P[];
const pflicht = (id: string) => pflichten.find((p) => p.id === id)!;
interface Block { pruefer: string; umfang: string; nachweis: { art: string; datum: string; rolle: string; umfang: string; aufbewahrung: string }; eintraege: Record<string, { version: number; stand: string; quelle: string }> }
const REG = YAML.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8")) as Block[];
const EN = (YAML.parse(fs.readFileSync(path.join(WURZEL, "catalog/uebersetzungen/en.yaml"), "utf8")) as { eintraege: { de: string; en: string }[] }).eintraege;
const PRUEFLISTE = fs.readFileSync(path.join(WURZEL, "PRUEFLISTE.md"), "utf8").split("\n");
const zeilen = (re: RegExp) => PRUEFLISTE.filter((z) => /^\| T-28[6-9] \|/.test(z) && re.test(z));
const block = (rolle: string, id: string, version: number) => REG.find((b) => b.pruefer === rolle && b.nachweis.art === "mail" && b.nachweis.datum === "2026-10-27" && b.eintraege[id]?.version === version);
/** alle Labels eines Auslösers (rekursiv) */
const labels = (b: unknown): string[] => {
  if (!b || typeof b !== "object") return [];
  const o = b as Record<string, unknown>;
  const eigen = o.label ? [(o.label as Label).de] : [];
  return [...eigen, ...Object.values(o).flatMap((v) => (Array.isArray(v) ? v.flatMap(labels) : typeof v === "object" ? labels(v) : []))];
};

/** Wortlaut des Steuerberaters (Mail vom 27.10.2026) */
const SATZ_V9 =
  "Eine Dauerfristverlängerung bleibt auf Antrag möglich, auch wenn du als Neugründer monatlich abgibst: Die Voranmeldung ist dann einen Monat später fällig (§ 18 Abs. 6 UStG, §§ 46 bis 48 UStDV), und du zahlst einmal im Jahr eine Sondervorauszahlung – siehe „Sondervorauszahlung zur Umsatzsteuer leisten“.";
const SATZ_V8 =
  "Eine Dauerfristverlängerung bleibt möglich, auch wenn du als Neugründer monatlich abgibst: Die Voranmeldung ist dann einen Monat später fällig (§ 18 Abs. 1 UStG, §§ 46 ff. UStDV), und du zahlst einmal im Jahr eine Sondervorauszahlung – siehe „Sondervorauszahlung zur Umsatzsteuer leisten“.";

describe("E-217 A) Umsatzsteuer-Voranmeldung v9 – Satz in der Fassung des Steuerberaters", () => {
  const va = () => pflicht("steuern.ust_voranmeldung");
  it("v9 enthält genau seinen Satz statt des Satzes aus v8; sonst nichts geändert", () => {
    expect(va().version).toBe(9);
    const e = va().erklaerung!.de;
    expect(e).toContain(SATZ_V9);
    expect(e).not.toContain(SATZ_V8);
    expect(e).not.toContain("§ 18 Abs. 1 UStG");
    expect(e).toContain("Hast du 2026 oder später gegründet, gibst du ab 2027 im Gründungsjahr und im Folgejahr monatlich ab (§ 18 Abs. 2 Satz 4 UStG). " + SATZ_V9);
    expect(va().aenderungsnotiz!.de).toMatch(/§ 18 Abs\. 6 UStG/);
  });
  it("englische Übersetzung nachgezogen (Erklärung und Änderungsnotiz)", () => {
    const quelle = YAML.parse(fs.readFileSync(path.join(WURZEL, "catalog/pflichten/steuern.ust_voranmeldung.yaml"), "utf8")) as P;
    const e = EN.find((x) => x.de.replace(/\s+/g, " ") === quelle.erklaerung!.de.replace(/\s+/g, " "));
    expect(e, "Übersetzung der Erklärung").toBeDefined();
    expect(e!.en).toMatch(/on application/);
    expect(e!.en).toMatch(/§ 18\(6\) UStG, §§ 46 to 48 UStDV/);
    expect(EN.some((x) => x.de === va().aenderungsnotiz!.de)).toBe(true);
  });
  it("Bestätigung des Steuerberaters für v9 (Mail 27.10.2026), Vermerk wieder da", () => {
    const b = block("steuern", "steuern.ust_voranmeldung", 9);
    expect(b).toBeDefined();
    expect(b!.nachweis.umfang).toContain("Satz zur Dauerfristverlängerung in seiner Fassung");
    expect(pruefVermerk(va().version, va().pruefung, AM)).toMatch(/Steuerberater \(Stand 27\.10\.2026\)/);
  });
  it("Neugründer-Radar nicht still geändert – Frage an den Steuerberater in der PRUEFLISTE", () => {
    const radar = pflicht("steuern.ust_va_neugruender_radar");
    expect(radar.version).toBe(3);
    expect(radar.erklaerung!.de).toContain("(§ 18 Abs. 1 UStG, §§ 46 ff. UStDV)");
    expect(pruefVermerk(radar.version, radar.pruefung, AM)).toMatch(/Steuerberater/);
    expect(zeilen(/ust_va_neugruender_radar/).some((z) => z.includes("§ 18 Abs. 6 UStG") && /\| StB \| E-217 \|$/.test(z))).toBe(true);
  });
});

const basis = (branche: string, beschaeftigte: number, mehr: Profil = {}): Profil => ({ "taetigkeit.branchen": [branche], rechtsform: "gmbh", gruendungsdatum: "2021-03-01", bundesland: "NI", "beschaeftigte.gesamt": beschaeftigte, ...mehr });
type A = ReturnType<typeof auswertung>;
const gilt = (a: A, id: string) => a.gilt.some((p) => p.id === id);
const haengtAb = (a: A, id: string) => a.unbekannt.find((p) => p.id === id);
const sichtbar = (a: A, id: string) => [...a.gilt, ...a.gruendung, ...a.unbekannt, ...a.beiEinstellung].some((p) => p.id === id);
const BRANCHEN = Object.keys(SCHRITTE.flatMap((s) => s.fragen).find((f) => f.feld === "taetigkeit.branchen")!.optionen!);

describe("E-217 B1) Datenschutzbeauftragter v4", () => {
  it("20-Personen-Schwelle (§ 38 Abs. 1 Satz 1 BDSG) in jeder Branche unabhängig von „Nichts davon“: mit Zählung gilt die Pflicht", () => {
    expect(BRANCHEN.length).toBeGreaterThan(10);
    for (const b of BRANCHEN) {
      const fakten = { "profil.taetigkeit.branchen": [b], "profil.rechtsform": "gmbh", "profil.gruendungsdatum": "2018-01-01", "profil.beschaeftigte.gesamt": 25, "abgeleitet.beschaeftigte.zaehlung_bdsg38": 22, "profil.datenschutz.dsb_gruende": ["keine"], "profil.datenverarbeitung.arten": ["kundendaten"] };
      const e = auswerten({ katalog: KATALOG as unknown as Katalog, fakten, ereignisse: [], stichtag: STICHTAG, kalender: new StandardKalender() }).find((x) => x.pflicht_id === "datenschutz.dsb")!;
      expect(e.ergebnis, b).toBe("gilt");
    }
  });
  it("in der App (Zählung nicht abgeleitet) bleibt er ab 20 Beschäftigten bei „Nichts davon“ sichtbar („hängt ab“), unter 20 nicht", () => {
    for (const b of BRANCHEN) {
      expect(haengtAb(auswertung(basis(b, 25, { "datenschutz.dsb_gruende": ["keine"], "datenverarbeitung.arten": ["kundendaten"] }), STICHTAG), "datenschutz.dsb"), b).toBeDefined();
      expect(sichtbar(auswertung(basis(b, 19, { "datenschutz.dsb_gruende": ["keine"], "datenverarbeitung.arten": ["kundendaten"] }), STICHTAG), "datenschutz.dsb"), b).toBe(false);
    }
  });
  it("Hilfetext unter der Antwort „Für eine Verarbeitung ist eine Datenschutz-Folgenabschätzung nötig“ (Wortlaut des Rechtsanwalts)", () => {
    const f = SCHRITTE.flatMap((s) => s.fragen).find((x) => x.feld === "datenschutz.dsb_gruende")!;
    expect(f.optionen!.dsfa_pflichtig!.de).toBe("Für eine Verarbeitung ist eine Datenschutz-Folgenabschätzung nötig");
    expect(f.optionHilfe?.dsfa_pflichtig?.de).toBe(
      "Typisch bei umfangreicher Verarbeitung von Gesundheitsdaten oder systematischer Videoüberwachung öffentlich zugänglicher Bereiche (Liste der Datenschutzkonferenz). Eine Anamnese in einem kleinen Studio oder eine einzelne Kamera im Lager reicht dafür meist nicht.",
    );
    expect(f.optionHilfe?.dsfa_pflichtig?.en).toMatch(/Data Protection Conference/);
    expect(Object.keys(f.optionHilfe!)).toEqual(["dsfa_pflichtig"]);
  });
  it("v4 unverändert und vom Rechtsanwalt bestätigt (Mail 27.10.2026)", () => {
    const d = pflicht("datenschutz.dsb");
    expect(d.version).toBe(4);
    expect(block("recht", "datenschutz.dsb", 4)).toBeDefined();
    expect(pruefVermerk(d.version, d.pruefung, AM)).toMatch(/Rechtsanwalt, Stand 27\.10\.2026/);
  });
});

const REG_ID = "it_sicherheit.nis2_registrierung";
const MELDE_ID = "it_sicherheit.nis2_meldepflichten";
const PRUEF_ID = "it_sicherheit.nis2_pruefen";
const NIS2_NEU = ["gesundheit_pflege", "transport_logistik", "gastronomie_lebensmittel"];
const NIS2 = ["it_agentur_freelancer", "sonstige", ...NIS2_NEU];
const SATZ_BILANZ = "Liegt deine Bilanzsumme bei höchstens 10 Mio. €, bist du trotzdem nicht erfasst.";

describe("E-217 B2) NIS2 nach den Vorgaben des Rechtsanwalts", () => {
  const JA = { "nis2.betroffen": "ja", "nis2.betroffen_seit": "2026-01-01" };
  it("(a) unter 50 statt unter 10: ohne Antwort zu NIS2 mit 30 Beschäftigten und Umsatz bis 10 Mio. € nicht betroffen; ab 50 „hängt ab“", () => {
    for (const b of ["sonstige", "handwerk", "gastronomie_lebensmittel"]) {
      const a = auswertung(basis(b, 30, { "umsatz.vorjahr": 4_000_000 }), STICHTAG);
      for (const id of [REG_ID, MELDE_ID]) expect(sichtbar(a, id), `${b} ${id}`).toBe(false);
      const gross = auswertung(basis(b, 50, { "umsatz.vorjahr": 4_000_000 }), STICHTAG);
      for (const id of [REG_ID, MELDE_ID]) expect(haengtAb(gross, id), `${b} 50 ${id}`).toBeDefined();
    }
  });
  it("(a) außerhalb der NIS2-Branchen unter 50 ohne Antwort und ohne Umsatz nicht betroffen (Handwerk 30)", () => {
    const a = auswertung(basis("handwerk", 30), STICHTAG);
    for (const id of [REG_ID, MELDE_ID, PRUEF_ID]) expect(sichtbar(a, id), id).toBe(false);
  });
  it("(b) IT wie „Andere“: ohne Antwort zu NIS2 unter 50 mit Umsatz bis 10 Mio. € nicht betroffen; ohne Umsatz „hängt ab“ mit Frage nach dem Umsatz", () => {
    const klein = auswertung(basis("it_agentur_freelancer", 5, { "umsatz.vorjahr": 400_000 }), STICHTAG);
    for (const id of [REG_ID, MELDE_ID]) expect(sichtbar(klein, id), id).toBe(false);
    const offen = auswertung(basis("it_agentur_freelancer", 5), STICHTAG);
    for (const id of [REG_ID, MELDE_ID]) expect(haengtAb(offen, id)?.offeneFragen, id).toEqual(expect.arrayContaining(["nis2.betroffen", "umsatz.vorjahr"]));
  });
  it("T-287: NIS2 „ja“ gilt unabhängig von Größe, Umsatz und Branche (größenunabhängige Fälle über die Frage); „nein“ nie", () => {
    for (const b of BRANCHEN) {
      const ja = auswertung(basis(b, 2, { "umsatz.vorjahr": 150_000, ...JA }), STICHTAG);
      for (const id of [REG_ID, MELDE_ID]) expect(gilt(ja, id), `${b} ja ${id}`).toBe(true);
      const nein = auswertung(basis(b, 2, { "umsatz.vorjahr": 150_000, "nis2.betroffen": "nein" }), STICHTAG);
      for (const id of [REG_ID, MELDE_ID, PRUEF_ID]) expect(sichtbar(nein, id), `${b} nein ${id}`).toBe(false);
    }
    // kleiner IT-Betrieb (z. B. DNS-Dienst) mit „ja“: beide gelten, Registrierung mit Termin drei Monate ab Betroffenheit
    const it = auswertung(basis("it_agentur_freelancer", 3, { "umsatz.vorjahr": 400_000, ...JA }), STICHTAG);
    const reg = it.gilt.find((p) => p.id === REG_ID)!;
    expect(reg.naechsterTermin ?? reg.vergangeneTermine?.[0] ?? null).toBeTruthy();
    expect(gilt(it, MELDE_ID)).toBe(true);
  });
  it("T-287: „Weiß ich nicht“ – unter 50 ohne Umsatz in einer NIS2-Branche: „NIS2 prüfen“ mit der Frage; mit Umsatz bis 10 Mio. € Registrierung und Meldepflichten nicht betroffen", () => {
    for (const b of NIS2) {
      const offen = auswertung(basis(b, 5, { "nis2.betroffen": "unklar" }), STICHTAG);
      expect(sichtbar(offen, PRUEF_ID), b).toBe(true);
      for (const id of [REG_ID, MELDE_ID]) expect(sichtbar(offen, id), `${b} ${id}`).toBe(false);
      const klein = auswertung(basis(b, 5, { "nis2.betroffen": "unklar", "umsatz.vorjahr": 900_000 }), STICHTAG);
      // Registrierung und Meldepflichten nicht betroffen; „NIS2 prüfen“ bleibt in den NIS2-Branchen (v5, unverändert)
      for (const id of [REG_ID, MELDE_ID]) expect(sichtbar(klein, id), `${b} klein ${id}`).toBe(false);
    }
  });
  it("(c) Gesundheit und Pflege, Transport und Logistik, Gastronomie und Lebensmittel: ohne Umsatz „hängt ab“ (Rückfrage NIS2 und Umsatz), bis 10 Mio. € nicht erfasst, darüber erfasst", () => {
    for (const b of NIS2_NEU) {
      const offen = auswertung(basis(b, 5), STICHTAG);
      for (const id of [REG_ID, MELDE_ID]) expect(haengtAb(offen, id)?.offeneFragen, `${b} ${id}`).toEqual(expect.arrayContaining(["nis2.betroffen", "umsatz.vorjahr"]));
      expect(sichtbar(offen, PRUEF_ID), b).toBe(true);
      const klein = auswertung(basis(b, 5, { "umsatz.vorjahr": 900_000 }), STICHTAG);
      for (const id of [REG_ID, MELDE_ID, PRUEF_ID]) expect(sichtbar(klein, id), `${b} ${id}`).toBe(false);
      const ueber = auswertung(basis(b, 5, { "umsatz.vorjahr": 12_000_000 }), STICHTAG);
      for (const id of [REG_ID, MELDE_ID]) expect(haengtAb(ueber, id)?.offeneFragen, `${b} ${id}`).toEqual(expect.arrayContaining(["nis2.betroffen"]));
    }
  });
  it("übrige Branchen unter 50 ohne Umsatz weiter nicht erfasst (kein Industrie-Eintrag in der Branchenliste, Handwerk nicht ausdrücklich Herstellung)", () => {
    for (const b of BRANCHEN.filter((x) => !NIS2.includes(x))) {
      const a = auswertung(basis(b, 5), STICHTAG);
      for (const id of [REG_ID, MELDE_ID, PRUEF_ID]) expect(sichtbar(a, id), `${b} ${id}`).toBe(false);
    }
  });
  it("Satz zur Bilanzsumme dort, wo die Umsatzregel steht (Bedingung bzw. Erklärung)", () => {
    for (const id of [REG_ID, MELDE_ID]) expect(labels(pflicht(id).ausloeser).some((l) => l.includes("10 Mio. €") && l.endsWith(SATZ_BILANZ)), id).toBe(true);
    expect(pflicht(PRUEF_ID).erklaerung!.de).toContain("mehr als 10 Mio. € Jahresumsatz und Jahresbilanzsumme. " + SATZ_BILANZ);
    // „hängt ab“ zeigt die Bedingung mit dem Satz
    const p = haengtAb(auswertung(basis("transport_logistik", 5), STICHTAG), REG_ID)!;
    expect((p as unknown as { grund: string }).grund).toContain(SATZ_BILANZ.replace(/\.$/, ""));
    for (const t of [SATZ_BILANZ]) expect(EN.some((x) => x.de.includes(t)), t).toBe(true);
  });
  it("neue Versionen vom Rechtsanwalt bestätigt (Mail 27.10.2026, ohne erneute Vorlage)", () => {
    for (const [id, v] of [[REG_ID, 7], [MELDE_ID, 6], [PRUEF_ID, 5]] as const) {
      const p = pflicht(id);
      expect(p.version, id).toBe(v);
      expect(block("recht", id, v), id).toBeDefined();
      expect(block("recht", id, v)!.nachweis.umfang.replace(/\s+/g, " "), id).toContain("NIS2 ja ⇒ unabhängig von der Größe, wie in seiner Antwort");
      expect(pruefVermerk(p.version, p.pruefung, AM), id).toMatch(/Rechtsanwalt, Stand 27\.10\.2026/);
    }
  });
});

describe("E-217: alle Einträge mit Vermerk", () => {
  // E-222: Kleinunternehmer-Warnungen v7 warten auf den Steuerberater (T-310) – 35 → 33; E-223: zwei neue Einträge im Entwurf
  // E-226: Warnungen bestätigt und die zwei neuen Einträge freigegeben – 230 von 230 mit Vermerk
  // E-231: dazu ein Entwurf ohne Vermerk (T-337)
  it("231 Einträge, 230 mit Vermerk; Rechtsanwalt 168, Steuerberater 35 (E-226, E-231)", () => {
    expect(pflichten).toHaveLength(231);
    expect(pflichten.filter((p) => !pruefVermerk(p.version, p.pruefung, AM)).map((p) => p.id).sort()).toEqual(["steuern.ust_voranmeldung_kleinunternehmer"]);
    const zahl = (r: string) => pflichten.filter((p) => pruefVermerk(p.version, p.pruefung, AM) && p.pruefung!.geprueft_von!.includes(r)).length;
    expect([zahl("recht"), zahl("steuern")]).toEqual([168, 35]);
  });
  it("PRUEFLISTE: T-278, T-282 und T-287 erledigt", () => {
    for (const t of ["T-278", "T-282", "T-287"]) expect(PRUEFLISTE.find((z) => z.startsWith(`| ${t} |`)), t).toMatch(/Erledigt 27\.10\.2026.*E-217/);
  });
});
