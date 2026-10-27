/**
 * E-234 (Rechtsanwalt 27.10.2026, R3): Vorlage „Handelsregister“.
 * - UG (haftungsbeschränkt): freigegeben wie die GmbH, mit seinem Hinweis „Stammkapital vor der Anmeldung voll und in bar
 *   einzahlen, Sacheinlagen sind ausgeschlossen (§ 5a Abs. 2 GmbHG)“ – eigene Freigabe (handelsregister#1, nur UG).
 * - e. K.: keine Gesellschafter (kein Abschnitt „Gesellschafter“ mit „Anteil“), „Ort der Handelsniederlassung“ (§ 29 HGB)
 *   statt „Sitz“, Abschnitt „Inhaber/in“.
 * - GmbH & Co. KG und UG & Co. KG: Komplementärin mit Firma, Rechtsform, Sitz, Registergericht und Registernummer statt
 *   Geburtsdatum und Wohnort (§ 106 Abs. 2 Nr. 2 Buchst. b HGB); keine Geschäftsführung der KG, sondern „Geschäftsführer der
 *   Komplementärin (zur Information)“; Vertretungsregelung; bei der UG & Co. KG wie bei der GmbH & Co. KG auch § 106 Abs. 7
 *   HGB und Stellung/Hafteinlage (§ 162 Abs. 1 HGB). Diese drei bleiben ohne Vermerk, bis er die neuen Beispiele bestätigt.
 * - Die Freigabe für GmbH, OHG und KG (25.10.2026) bleibt unverändert gültig (Teilsummen gleich).
 */
import { describe, expect, it } from "vitest";
import { FREIGEGEBENE_TEILSUMMEN } from "../src/dokumente/geprueft-teilsummen.js";
import { sichtbarerText } from "../src/dokumente/geprueft.js";
import { LEERER_BETRIEB, PRUEFHINWEIS, dokumentHtml, freigabenFuer, leereDaten, pruefHinweisFuer, vorlageFuer, vorlagenPruefstand, type Betrieb, type Daten } from "../src/index.js";

const v = vorlageFuer("handelsregister")!;
const betrieb = (rechtsform: string, extra: Partial<Betrieb> = {}): Betrieb => ({ ...LEERER_BETRIEB, name: `Muster ${rechtsform}`, ort: "Musterstadt", rechtsform, ...extra });
const text = (b: Betrieb, d: Daten = {}) => sichtbarerText(dokumentHtml(v, { ...leereDaten(v, b, "2026-10-27"), ...d }, b)).replace(/&nbsp;|\u00a0/g, " ").replace(/\s+/g, " ");
const PERSONEN = { gesellschafter: [{ name: "Kim Beispiel", geburtsdatum: "1990-01-01", wohnort: "Musterstadt", anteil: "100 %", stellung: "kommandit", hafteinlage: "1000" }], fuehrung: [{ name: "Alex Muster", geburtsdatum: "1985-05-05", wohnort: "Musterstadt" }] };

describe("E-234: Handelsregister – e. K.", () => {
  const t = text(betrieb("e. K."), { sitz: "Musterstadt", ...PERSONEN });
  it("keine Gesellschafter, kein „Anteil“; „Ort der Handelsniederlassung“ statt „Sitz“; „Inhaber/in“", () => {
    expect(t).not.toMatch(/Gesellschafter/);
    expect(t).not.toContain("Anteil");
    expect(t).not.toContain("Kim Beispiel");
    expect(t).toContain("Ort der Handelsniederlassung");
    expect(t).not.toMatch(/\bSitz\b/);
    expect(t).toContain("Inhaber/in");
    expect(t).toContain("Alex Muster");
    expect(t).not.toContain("Geschäftsführung");
    expect(t).not.toContain("Stammkapital");
  });
});

describe("E-234: Handelsregister – GmbH & Co. KG und UG & Co. KG", () => {
  const ko = { komplementaer: "Muster Verwaltungs GmbH", komplementaer_rechtsform: "GmbH", komplementaer_sitz: "Musterstadt", komplementaer_registergericht: "Amtsgericht Musterstadt", komplementaer_registernummer: "HRB 2001" };
  for (const rf of ["GmbH & Co. KG", "UG (haftungsbeschränkt) & Co. KG"]) {
    it(`${rf}: Komplementärin mit Registerangaben, Kommanditisten mit Hafteinlage, keine Geschäftsführung der KG, Vertretungsregelung`, () => {
      const t = text(betrieb(rf, ko), PERSONEN);
      expect(t).toContain("Persönlich haftende Gesellschafterin (Komplementärin)");
      for (const x of ["Muster Verwaltungs GmbH", "Amtsgericht Musterstadt", "HRB 2001", "Registergericht", "Registernummer"]) expect(t).toContain(x);
      expect(t).toContain("§ 106 Abs. 7 HGB");
      expect(t).toContain("§ 162 Abs. 1 HGB");
      expect(t).toContain("Hafteinlage 1.000,00 €");
      expect(t).toContain("Geschäftsführer der Komplementärin (zur Information)");
      expect(t).not.toContain("Geschäftsführung bzw. Inhaber/in");
      expect(t).toContain("Vertretungsregelung der Gesellschafter");
      expect(t).toContain("Die Komplementärin vertritt die Gesellschaft allein; die Kommanditisten vertreten nicht.");
      expect(t).not.toContain("Anteil");
    });
  }
  it("eingetragene Vertretungsregelung geht vor; ohne Angaben zur Komplementärin Linien zum Ausfüllen (Rechtsform aus der Rechtsform der KG)", () => {
    const t = text(betrieb("UG (haftungsbeschränkt) & Co. KG"), { vertretung: "Eigene Regelung" });
    expect(t).toContain("Eigene Regelung");
    expect(t).not.toContain("vertritt die Gesellschaft allein");
    expect(t).toMatch(/Rechtsform UG \(haftungsbeschränkt\)/);
  });
});

describe("E-234: Handelsregister – UG", () => {
  it("Hinweis zur Einzahlung (§ 5a Abs. 2 GmbHG) nur bei der UG", () => {
    expect(text(betrieb("UG (haftungsbeschränkt)"))).toContain("Stammkapital vor der Anmeldung voll und in bar einzahlen, Sacheinlagen sind ausgeschlossen (§ 5a Abs. 2 GmbHG).");
    for (const rf of ["GmbH", "OHG", "KG", "e. K.", "GmbH & Co. KG"]) expect(text(betrieb(rf)), rf).not.toContain("§ 5a Abs. 2 GmbHG");
  });
  it("Vermerk für UG (eigene Freigabe vom 27.10.2026), weiter für GmbH, OHG, KG; nicht für e. K. und die Co. KG", () => {
    expect(pruefHinweisFuer(v, {}, betrieb("UG (haftungsbeschränkt)"))).toContain("Stand 27.10.2026");
    for (const rf of ["GmbH", "OHG", "KG"]) expect(pruefHinweisFuer(v, {}, betrieb(rf)), rf).toContain("Stand 25.10.2026");
    for (const rf of ["e. K.", "GmbH & Co. KG", "UG (haftungsbeschränkt) & Co. KG"]) expect(pruefHinweisFuer(v, {}, betrieb(rf)), rf).toBe(PRUEFHINWEIS);
  });
  it("Freigabe GmbH/OHG/KG unverändert: heutige Teilsummen = freigegebene", () => {
    const [erste, ug] = freigabenFuer("handelsregister");
    expect(vorlagenPruefstand(v, erste!).teile).toEqual(FREIGEGEBENE_TEILSUMMEN.handelsregister);
    expect(ug!.rechtsformen).toEqual(["UG (haftungsbeschränkt)"]);
    expect(vorlagenPruefstand(v, ug!).teile).toEqual(FREIGEGEBENE_TEILSUMMEN["handelsregister#1"]);
  });
});
