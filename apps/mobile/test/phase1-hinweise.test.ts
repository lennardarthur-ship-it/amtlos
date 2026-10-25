/** Phase 1 (RDG, Haftung): Hinweis „keine Rechts- oder Steuerberatung“ und Rechtsstand – in der App, auf der Website, nie im PDF. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRUEFHINWEIS, VORLAGEN, dokumentHtml, vorlageFuer } from "@amtlos/fachlogik";
import { RECHTSSTAND_ERSATZ, rechtsstand, rechtsstandMonat, rechtsstandText } from "../src/pflichten/rechtsstand";
import { mitVorlagenHinweis, rechtsHinweis } from "../src/rechtshinweis";
import { T as TEXT } from "../src/texte";
import { LEERER_STAND } from "../src/unterlagen/speicher";

const APP = path.resolve(__dirname, "..");
const quelle = (d: string) => fs.readFileSync(path.join(APP, d), "utf8");
const KEINE_BERATUNG = "keine Rechts- oder Steuerberatung";

describe("Rechtsstand", () => {
  it("aus dem Feld `rechtsstand` des Katalogs, sonst jüngstes Abrufdatum, sonst Ersatz", () => {
    expect(rechtsstand({ rechtsstand: "2026-11-01", pflichten: [] })).toBe("2026-11");
    expect(rechtsstand({ rechtsstand: "2027-01", pflichten: [] })).toBe("2027-01");
    expect(rechtsstand({ rechtsstand: { datum: "2026-10-21", hinweis: "x" }, pflichten: [] })).toBe("2026-10");
    expect(rechtsstand({ pflichten: [{ quellen: [{ abgerufen: "2026-09-30" }, { abgerufen: null }], pruefung: { geprueft_am: "2026-10-02" } }, { quellen: null }] })).toBe("2026-10");
    expect(rechtsstand({ pflichten: [{ quellen: [{ abgerufen: null }] }] })).toBe(RECHTSSTAND_ERSATZ);
    expect(rechtsstand({ rechtsstand: "unbekannt" })).toBe(RECHTSSTAND_ERSATZ);
  });
  it("formatiert als „Rechtsstand: Oktober 2026“", () => {
    expect(rechtsstandMonat("2026-03")).toBe("März 2026");
    expect(rechtsstandText("2026-10")).toBe("Rechtsstand: Oktober 2026");
    // der gebündelte Katalog trägt ein gültiges Datum
    expect(rechtsstandText()).toMatch(/^Rechtsstand: (Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember) 20\d\d$/);
  });
});

describe("Hinweis „keine Rechts- oder Steuerberatung“ mit Rechtsstand", () => {
  it("für Pflichten, Vorlagen und Rechtliches", () => {
    for (const art of ["pflichten", "vorlage", "recht"] as const) {
      const h = rechtsHinweis(art, "Rechtsstand: Oktober 2026");
      expect(h.text).toContain(KEINE_BERATUNG);
      expect(h.ganz).toBe(`${h.text} Rechtsstand: Oktober 2026.`);
    }
    expect(rechtsHinweis("vorlage").text).toMatch(/^Vorlage, keine Rechts- oder Steuerberatung\. Prüfe die Angaben für deinen Betrieb – im Zweifel mit Anwalt oder Steuerberatung\.$/);
    expect(rechtsHinweis("pflichten").text).toMatch(/typischen Pflichten/);
    expect(TEXT.check_hinweis).toContain(KEINE_BERATUNG);
  });

  it("steht auf Check-Ergebnis, Pflichten-Tab, Pflicht, Vorlagen-Ablauf, Abschluss, „Wozu“ und Rechtliches", () => {
    // Ergebnis des Checks: als Hinweis mit Symbol
    expect(quelle("src/seiten/Check.tsx")).toMatch(/<Hinweis text=\{rechtsHinweis\("pflichten"\)\.ganz\} \/>/);
    const pflichten = quelle("src/seiten/Pflichten.tsx");
    // Pflicht (Detail), Liste im Tab (mit Pro und – E-188 – ohne Pro) und Start vor dem Check
    expect(pflichten.match(/<RechtsHinweis art="pflichten"/g)?.length).toBe(4);
    expect(pflichten).not.toContain("TEXT.pflichten_quelle");
    expect(quelle("src/seiten/Ablauf.tsx")).toMatch(/mitVorlagenHinweis\(vorlage\) \? <RechtsHinweis art="vorlage"/);
    expect(quelle("src/seiten/Abschluss.tsx")).toMatch(/mitVorlagenHinweis\(v\) \? <RechtsHinweis art="vorlage"/);
    expect(quelle("src/seiten/InfoSeite.tsx")).toMatch(/<RechtsHinweis art="vorlage"/);
    expect(quelle("src/seiten/Recht.tsx")).toMatch(/<RechtsHinweis art="recht"/);
    // ein Text-Element: VoiceOver liest Hinweis und Rechtsstand zusammen
    expect(quelle("src/seiten/gemeinsam.tsx")).toMatch(/<T v="caption"[^>]*>\s*\{`\$\{h\.text\}\\n\$\{h\.stand\}`\}\s*<\/T>/);
  });

  it("bei allen Vorlagen außer Rechnung und Storno", () => {
    expect(mitVorlagenHinweis(vorlageFuer("rechnung")!)).toBe(false);
    for (const id of ["hygieneplan", "arbeitszeitnachweis", "gefaehrdungsbeurteilung", "datenschutzerklaerung_website", "impressum"]) expect(mitVorlagenHinweis(vorlageFuer(id)!), id).toBe(true);
    expect(VORLAGEN.filter((v) => !mitVorlagenHinweis(v)).map((v) => v.id)).toEqual(["rechnung"]);
  });

  it("nie im PDF: die Unterlage gehört dem Betrieb", () => {
    // StB GoBD (Prüfbericht Steuerberatungskanzlei, Abschnitt 8): Nur die Steuer-PDFs tragen „Übertragungshilfe … Keine
    // Steuerberatung“ – auf Empfehlung der Kanzlei gehört dieser Hinweis auf das PDF, nicht nur in die App
    const STEUER_PDFS = new Set(["ust_voranmeldung", "euer", "steuererklaerung", "lohnkonto"]);
    for (const v of VORLAGEN) {
      const html = dokumentHtml(v, {}, LEERER_STAND.betrieb);
      // auch weitere Steuer-PDFs (z. B. ZM, OSS) dürfen ihn über steuerHinweis() tragen
      const ohneSteuerHinweis = html.replace(/<p class="nachsatz steuerhinweis">[\s\S]*?<\/p>/, "");
      if (STEUER_PDFS.has(v.id)) expect(html, v.id).toContain("<strong>Keine Steuerberatung</strong>");
      expect(ohneSteuerHinweis, v.id).not.toMatch(/Rechtsberatung|Steuerberatung\.|Rechtsstand/);
      expect(html, v.id).not.toContain(PRUEFHINWEIS);
      expect(html, v.id).not.toContain(rechtsHinweis("vorlage").text);
    }
  });
});

describe("RDG: keine Zusagen und kein Urteil im Einzelfall", () => {
  const VERBOTEN = /rechtssicher|garantiert|garantie(?!\s*f[üu]r die (übermittlung|usa))|abmahnsicher|100\s?%\s?(sicher|rechts)|prüft deinen fall|alle (deine )?pflichten (erfüllt|erledigt|abgedeckt)/i;
  // Funktionen als Quelltext – so zählen alle Zweige ihrer Vorlagen-Strings
  const texte = (o: unknown, schritt = 0): string[] =>
    typeof o === "string" ? [o] : typeof o === "function" ? [String(o)] : o && typeof o === "object" && schritt < 4 ? Object.values(o).flatMap((w) => texte(w, schritt + 1)) : [];

  it("App-Texte", () => {
    const alle = texte(TEXT);
    expect(alle.length).toBeGreaterThan(500);
    for (const t of alle) expect(t).not.toMatch(VERBOTEN);
  });
  it("Store-Texte und Website", () => {
    const store = quelle("store/de.json");
    const website = fs.readFileSync(path.join(APP, "../website/seite.html"), "utf8");
    for (const t of [store, website]) expect(t).not.toMatch(VERBOTEN);
    expect(JSON.parse(store).beschreibung).toContain("ersetzt keine Rechts- oder Steuerberatung");
  });
  it("Website: Hinweis am Kurz-Check und in der Fußzeile, Rechtsstand aus dem Katalog", () => {
    const website = fs.readFileSync(path.join(APP, "../website/seite.html"), "utf8");
    expect(website).toMatch(/<p class="pruefstand"><strong>Keine Rechts- oder Steuerberatung:<\/strong>/);
    expect(website).toContain('<p class="fuss-hinweis">__FUSS_HINWEIS__</p>');
    expect(website).toContain("<span>__RECHTSSTAND__</span>");
    const bauen = fs.readFileSync(path.join(APP, "../website/bauen.mjs"), "utf8");
    expect(bauen).toContain("mobile/src/pflichten/rechtsstand.ts");
    expect(bauen).toMatch(/keine Rechts- oder Steuerberatung\. \$\{esc\(RECHTSSTAND\)\}/);
  });
  it("Ergebnisse als Information nach deinen Angaben", () => {
    expect(TEXT.r10_ergebnis_bald(1, 0)).toMatch(/^Nach deinen Angaben:/);
    expect(TEXT.ergebnis_titel(3)).toBe("Für deinen Betrieb kommen 3 Pflichten in Frage");
    expect(TEXT.start_punkte[0]!.text).toContain("nach deinen Angaben in Frage");
    expect(TEXT.warum).toBe("Warum sie in Frage kommt");
  });
});
