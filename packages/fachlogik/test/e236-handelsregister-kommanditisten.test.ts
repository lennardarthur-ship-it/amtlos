/**
 * E-236 (Rechtsanwalt 28.10.2026): Handelsregister – Freigabe für e. K., GmbH & Co. KG und UG (haftungsbeschränkt) & Co. KG.
 * - e. K. wie vorgelegt freigegeben (§ 29 HGB, Abschnitt „Unternehmen“).
 * - Co. KG mit einer Änderung: Abschnitt „Kommanditisten“ statt „Weitere Gesellschafter“, Stellung fest „Kommanditist/in“
 *   (die Komplementärin ist die persönlich haftende Gesellschafterin); keine natürliche Person „persönlich haftend“.
 *   Haftet zusätzlich eine natürliche Person persönlich, weist die App auf die Rechtsform KG hin.
 * - Die Freigaben GmbH/OHG/KG (25.10.2026) und UG (27.10.2026) bleiben unverändert (Teilsummen gleich).
 */
import { describe, expect, it } from "vitest";
import { FREIGEGEBENE_TEILSUMMEN } from "../src/dokumente/geprueft-teilsummen.js";
import { sichtbarerText } from "../src/dokumente/geprueft.js";
import { HR_CO_KG_KEINE_TYPISCHE, LEERER_BETRIEB, PRUEFHINWEIS, dokumentHtml, freigabenFuer, leereDaten, pruefHinweisFuer, vorlageFuer, vorlagenPruefstand, type Betrieb, type Daten, type Eintrag } from "../src/index.js";

const v = vorlageFuer("handelsregister")!;
const betrieb = (rechtsform: string, extra: Partial<Betrieb> = {}): Betrieb => ({ ...LEERER_BETRIEB, name: `Muster ${rechtsform}`, ort: "Musterstadt", rechtsform, ...extra });
const daten = (b: Betrieb, d: Daten = {}): Daten => ({ ...leereDaten(v, b, "2026-10-28"), ...d });
const text = (b: Betrieb, d: Daten = {}) => sichtbarerText(dokumentHtml(v, daten(b, d), b)).replace(/&nbsp;|\u00a0/g, " ").replace(/\s+/g, " ");
const CO_KG = ["GmbH & Co. KG", "UG (haftungsbeschränkt) & Co. KG"];
const ZWEI: Daten = {
  gesellschafter: [
    { name: "Kim Beispiel", geburtsdatum: "1990-01-01", wohnort: "Musterstadt", stellung: "kommandit", hafteinlage: "1000" },
    { name: "Pat Natürlich", geburtsdatum: "1980-02-02", wohnort: "Musterstadt", stellung: "phg" },
  ],
};

describe("E-236: Co. KG – Abschnitt „Kommanditisten“", () => {
  for (const rf of CO_KG) {
    it(`${rf}: „Kommanditisten“, Stellung immer „Kommanditist/in“, nie „persönlich haftend“ für eine Person`, () => {
      const t = text(betrieb(rf), ZWEI);
      expect(t).toContain("Kommanditisten");
      expect(t).not.toContain("Weitere Gesellschafter");
      expect(t).toContain("Kommanditist/in, Hafteinlage 1.000,00 €");
      expect(t).not.toMatch(/persönlich haftend(?!e Gesellschafterin)/);
      expect(t).toContain("Pat Natürlich");
      expect(t).toContain("Persönlich haftende Gesellschafterin (Komplementärin)");
    });
    it(`${rf}: Hinweis auf die Rechtsform KG, wenn eine natürliche Person persönlich haftet`, () => {
      const b = betrieb(rf);
      const h = v.hinweise!(daten(b, ZWEI), b);
      expect(h).toContain(HR_CO_KG_KEINE_TYPISCHE(rf));
      expect(HR_CO_KG_KEINE_TYPISCHE(rf)).toBe(`Haftet zusätzlich eine natürliche Person persönlich, ist die Gesellschaft keine typische ${rf} – wähle dann die Rechtsform KG.`);
      expect(v.hinweise!(daten(b, { gesellschafter: [(ZWEI.gesellschafter as Eintrag[])[0]!] }), b)).not.toContain(HR_CO_KG_KEINE_TYPISCHE(rf));
    });
    it(`${rf}: jeder Kommanditist braucht die Hafteinlage`, () => {
      const b = betrieb(rf);
      expect(v.pruefen!(daten(b, { gesellschafter: [{ name: "Ohne Stellung" }] }), b).join(" ")).toContain("§ 162 Abs. 1 HGB");
    });
  }
  it("KG und OHG unverändert: Stellung „persönlich haftend“ wählbar und gedruckt, kein Hinweis", () => {
    const t = text(betrieb("KG"), ZWEI);
    expect(t).toContain("Gesellschafter (persönlich haftende und Kommanditisten)");
    expect(t).toMatch(/Pat Natürlich.*persönlich haftend/);
    expect(v.hinweise?.(daten(betrieb("KG"), ZWEI), betrieb("KG")) ?? []).not.toContain(HR_CO_KG_KEINE_TYPISCHE("KG"));
  });
});

describe("E-236: Freigabe für e. K., GmbH & Co. KG und UG & Co. KG", () => {
  it("Vermerk „Stand 28.10.2026“ für die drei Rechtsformen; GmbH/OHG/KG und UG wie bisher", () => {
    for (const rf of ["e. K.", ...CO_KG]) expect(pruefHinweisFuer(v, {}, betrieb(rf)), rf).toContain("Stand 28.10.2026");
    for (const rf of ["GmbH", "OHG", "KG"]) expect(pruefHinweisFuer(v, {}, betrieb(rf)), rf).toContain("Stand 25.10.2026");
    expect(pruefHinweisFuer(v, {}, betrieb("UG (haftungsbeschränkt)"))).toContain("Stand 27.10.2026");
    // nicht angeboten: z. B. GbR
    expect(pruefHinweisFuer(v, {}, betrieb("GbR"))).toBe(PRUEFHINWEIS);
  });
  it("Teilsummen: frühere Freigaben unverändert, neue Freigabe = heutige Fassung", () => {
    const [erste, ug, drei] = freigabenFuer("handelsregister");
    expect(vorlagenPruefstand(v, erste!).teile).toEqual(FREIGEGEBENE_TEILSUMMEN.handelsregister);
    expect(vorlagenPruefstand(v, ug!).teile).toEqual(FREIGEGEBENE_TEILSUMMEN["handelsregister#1"]);
    expect(drei!.rechtsformen).toEqual(["e. K.", ...CO_KG]);
    expect(drei!.stand).toBe("2026-10-28");
    expect(drei!.rolle).toBe("recht");
    expect(drei!.nachweis?.umfang).toBe("e. K. wie vorgelegt; Co. KG mit Abschnitt Kommanditisten laut seiner Antwort");
    expect(vorlagenPruefstand(v, drei!).teile).toEqual(FREIGEGEBENE_TEILSUMMEN["handelsregister#2"]);
    expect(vorlagenPruefstand(v, drei!).summe).toBe(drei!.pruefsumme);
    // e. K. wie vorgelegt: Teilsumme der versandten Fassung (E-234) unverändert
    expect(FREIGEGEBENE_TEILSUMMEN["handelsregister#2"]!["rf:e. K."]).toBe("6a3cb1a5452c786cc22ce54a");
  });
});
