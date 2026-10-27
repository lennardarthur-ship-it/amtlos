/**
 * E-226: Antworten der Prüfer vom 27.10.2026 (Mail beim Gründer, im Register in unseren Worten, ohne Namen).
 * 1) Rechtsanwalt zu den zwei Entwürfen (T-313): beide „anpassen“ – seine Ergänzungen wörtlich übernommen (v2), damit ohne
 *    erneute Vorlage freigegeben.
 * 2) Rechtsanwalt zur Einstufung der Folgen (T-311 (1)): sieben Einträge „hoch“ auf seine Anweisung (neue Versionen,
 *    Folgen-Texte unverändert) – damit von ihm freigegeben.
 * 4) Steuerberater zu T-310: Kleinunternehmer-Warnungen 80 %/95 % v7 bestätigt; Fundstelle „§ 19 Abs. 1 Satz 1 UStG,
 *    Abschnitt 19.1 UStAE“ für die Regel, dass schon der Umsatz über 100.000 € steuerpflichtig ist (App-Hinweis
 *    `ust_ku_gemischt`, Code-Kommentare, Rechtsgrundlage der Einträge, die die Regel nennen).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { KATALOG, auswertung, type Profil } from "../src/pflichten/check";
import { pruefVermerk, type PruefungRoh } from "../src/pflichten/pruefer";
import { T as TEXT } from "../src/texte";

const WURZEL = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
const AM = new Date(2026, 9, 27);
type P = { id: string; version: number; erklaerung: { de: string }; rechtsgrundlage: string[]; sanktion: { text: { de: string }; schwere: string }; pruefung?: PruefungRoh };
const pflichten = KATALOG.pflichten as unknown as P[];
const pflicht = (id: string) => pflichten.find((p) => p.id === id)!;
interface Block { pruefer: string; umfang: string; nachweis: { art: string; datum: string; rolle: string; umfang: string; aufbewahrung: string }; eintraege: Record<string, { version: number; stand: string; quelle: string }> }
const REG = YAML.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8")) as Block[];
const block = (rolle: string, id: string, version: number) =>
  REG.find((b) => b.pruefer === rolle && b.nachweis.art === "mail" && b.nachweis.datum === "2026-10-27" && b.eintraege[id]?.version === version);
const PRUEFLISTE = fs.readFileSync(path.join(WURZEL, "PRUEFLISTE.md"), "utf8").split("\n");
const zeile = (t: string) => PRUEFLISTE.find((z) => z.startsWith(`| ${t} |`)) ?? "";
const flach = (s: string) => s.replace(/\s+/g, " ");

describe("E-226 (1): Entwürfe in der Fassung des Rechtsanwalts", () => {
  it("Preisermäßigung v2: drei Ergänzungen wörtlich an der angegebenen Stelle, Einstufung mittel, freigegeben", () => {
    const p = pflicht("online.preisermaessigung");
    expect(p.version).toBe(2);
    const e = flach(p.erklaerung.de);
    const s1 = "(§ 11 Abs. 1 PAngV).";
    const eugh = "Eine Ermäßigung in Prozent oder ein durchgestrichener Preis muss sich auf diesen niedrigsten Preis der letzten 30 Tage beziehen (EuGH, Urteil vom 26.9.2024, C-330/23).";
    const s2 = "(§ 11 Abs. 2 PAngV).";
    const gp = "Musst du nur den Grundpreis angeben (§ 4 Abs. 2 PAngV), gilt das entsprechend für den Grundpreis (§ 11 Abs. 3 PAngV).";
    expect(e).toContain(`${s1} ${eugh} `);
    expect(e).toContain(`${s2} ${gp} Das gilt nicht für individuelle`);
    expect(e.indexOf(eugh)).toBeLessThan(e.indexOf(s2));
    expect(flach(p.sanktion.text.de)).toMatch(/\(§ 20 Nr\. 1 PAngV in Verbindung mit § 3 Abs\. 1 Satz 1 Nr\. 2, Abs\. 2 WiStrG 1954\)\. Außerdem können Mitbewerber und Verbände abmahnen \(§§ 3a, 8 UWG\)\.$/);
    expect(p.sanktion.schwere).toBe("mittel");
    expect(p.rechtsgrundlage).toEqual(["§ 11 PAngV"]);
    expect(block("recht", p.id, 2)?.nachweis.umfang).toMatch(/in seiner Fassung laut Anmerkung/);
    expect(pruefVermerk(p.version, p.pruefung, AM)).toMatch(/Rechtsanwalt, Stand 27\.10\.2026/);
  });
  it("Preisermäßigung gilt auch im Laden ohne Onlineshop (Anmerkung des Rechtsanwalts – der Bereich schränkt nicht ein)", () => {
    const LADEN: Profil = { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", gruendungsdatum: "2022-03-01", bundesland: "NW", "taetigkeit.einordnung": "gewerbe", "kunden.segmente": ["b2c"], "vertrieb.kanaele": ["ladengeschaeft"], "produkte.arten": ["physisch"], "datenverarbeitung.arten": ["kundendaten"] };
    expect(auswertung(LADEN, "2026-10-27").gilt.map((x) => x.id)).toContain("online.preisermaessigung");
  });
  it("Werbe-E-Mails v2:Folgen ersetzt, Satz zur Nachweisbarkeit angefügt, Rechtsgrundlage um DSGVO ergänzt, freigegeben", () => {
    const p = pflicht("online.werbe_email_einwilligung");
    expect(p.version).toBe(2);
    expect(flach(p.sanktion.text.de)).toBe(
      "Nach dem UWG kein Bußgeld (§ 20 UWG erfasst nur Telefonwerbung). Mitbewerber und Verbände können Beseitigung und Unterlassung verlangen (§ 8 Abs. 1, 3 UWG), meist mit einer Abmahnung; der Empfänger selbst kann Unterlassung verlangen. Fehlt die Einwilligung, kann die Datenschutzaufsicht ein Bußgeld verhängen (Art. 83 Abs. 5 DSGVO), und der Empfänger kann Schadensersatz fordern (Art. 82 DSGVO).",
    );
    expect(flach(p.erklaerung.de)).toMatch(/\(§ 7 Abs\. 2 Nr\. 3 Buchst\. c UWG\)\. Die Einwilligung musst du nachweisen können \(Art\. 7 Abs\. 1 DSGVO\); üblich ist dafür das Double-Opt-in mit Bestätigungs-E-Mail\.$/);
    expect(p.rechtsgrundlage).toEqual(["§ 7 Abs. 2 Nr. 2, Abs. 3 UWG", "Art. 6 Abs. 1, Art. 7 DSGVO"]);
    expect(p.sanktion.schwere).toBe("mittel");
    expect(block("recht", p.id, 2)?.nachweis.umfang).toMatch(/in seiner Fassung laut Anmerkung/);
    expect(pruefVermerk(p.version, p.pruefung, AM)).toMatch(/Rechtsanwalt, Stand 27\.10\.2026/);
  });
});

describe("E-226 (2): Einstufung „hoch“ auf Anweisung des Rechtsanwalts", () => {
  const SIEBEN = ["branche.immo_gwg", "branche.it_scheinselbststaendigkeit", "branche.transport_erlaubnis", "branche.transport_lenkzeiten", "branche.transport_lenkzeiten_national", "produkte.batterien", "produkte.elektrogeraete"];
  it("alle sieben „hoch“, neue Version, vom Rechtsanwalt freigegeben", () => {
    for (const id of SIEBEN) {
      const p = pflicht(id);
      expect(p.sanktion.schwere, id).toBe("hoch");
      const b = block("recht", id, p.version);
      expect(b, id).toBeDefined();
      expect(b!.nachweis.umfang, id).toMatch(/Einstufung hoch laut seiner Anweisung/);
      expect(pruefVermerk(p.version, p.pruefung, AM), id).toMatch(/Rechtsanwalt, Stand 27\.10\.2026/);
    }
  });
});

describe("E-226 (4): Steuerberater – Warnungen v7 bestätigt, Fundstelle § 19 Abs. 1 Satz 1 UStG", () => {
  const FUNDSTELLE = ["steuern.kleinunternehmer_grenze_ueberschritten", "steuern.kleinunternehmer_warnung_80", "steuern.kleinunternehmer_warnung_95", "steuern.kleinunternehmerregelung"];
  it("Bestätigung der Warnungen v7 im Register", () => {
    for (const id of ["steuern.kleinunternehmer_warnung_80", "steuern.kleinunternehmer_warnung_95"]) expect(block("steuern", id, 7), id).toBeDefined();
  });
  it("Einträge mit der Regel zum Überschreiten der 100.000 € zitieren § 19 Abs. 1 Satz 1 UStG und Abschnitt 19.1 UStAE – freigegeben", () => {
    for (const id of FUNDSTELLE) {
      const p = pflicht(id);
      expect(p.rechtsgrundlage, id).toContain("§ 19 Abs. 1 Satz 1 UStG");
      expect(p.rechtsgrundlage, id).toContain("Abschnitt 19.1 UStAE");
      expect(block("steuern", id, p.version)?.nachweis.umfang, id).toMatch(/Fundstelle laut seiner Antwort/);
      expect(pruefVermerk(p.version, p.pruefung, AM), id).toMatch(/Steuerberater \(Stand 27\.10\.2026\)/);
    }
  });
  it("App-Hinweis und Code-Kommentare nennen Satz 1 statt Satz 2", () => {
    expect(TEXT.ust_ku_gemischt).toContain("(§ 19 Abs. 1 Satz 1 UStG, Abschnitt 19.1 UStAE)");
    expect(TEXT.ust_ku_gemischt).not.toMatch(/Satz 2/);
    const code = fs.readFileSync(path.join(WURZEL, "apps/mobile/src/unterlagen/ustAusRechnungen.ts"), "utf8");
    expect(code).not.toMatch(/§ 19 Abs\. 1 Satz 2/);
  });
});

describe("E-226: alle Einträge mit Vermerk", () => {
  // E-231: dazu ein Entwurf ohne Vermerk (T-337)
  it("230 von 231 mit Vermerk; Rechtsanwalt 168, Steuerberater 35", () => {
    expect(pflichten).toHaveLength(231);
    expect(pflichten.filter((p) => !pruefVermerk(p.version, p.pruefung, AM)).map((p) => p.id)).toEqual(["steuern.ust_voranmeldung_kleinunternehmer"]);
    const zahl = (r: string) => pflichten.filter((p) => p.pruefung?.geprueft_von?.includes(r)).length;
    expect([zahl("recht"), zahl("steuern")]).toEqual([168, 35]);
  });
  it("PRUEFLISTE: T-310, T-311 (1) und T-313 erledigt, T-311 (2) bleibt offen", () => {
    for (const t of ["T-310", "T-313"]) expect(zeile(t), t).toMatch(/Erledigt 27\.10\.2026.*E-226/);
    expect(zeile("T-311")).toMatch(/\(1\).*Erledigt 27\.10\.2026.*E-226/);
    expect(zeile("T-311")).toMatch(/\(2\) offen/);
  });
});
