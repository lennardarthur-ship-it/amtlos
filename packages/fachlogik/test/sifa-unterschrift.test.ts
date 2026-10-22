/** E-167 (Sifa-Durchsicht 22.10.2026, B-124, Blatt „B Vorlagen“): Unterschrift der Unterwiesenen bei Gefahr- und Biostoffen. */
import { describe, expect, it } from "vitest";
import { UNTERSCHRIFT_FEHLT, dokumentHtml, fehlendeAngaben, leereDaten, sichtbar, vorlageFuer, type Betrieb } from "../src/index.js";

const B: Betrieb = { name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", verantwortlich: "Alex Sonnberg", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Bayern" };
const v = vorlageFuer("unterweisung")!;
const basis = { ...leereDaten(v, B, "2026-10-22"), thema: "Unterweisung Gefahrstoffe", teilnehmer: [{ name: "Jana Becker" }, { name: "Lea Kim" }] };
const gefahr = { ...basis, themen: ["gefahrstoffe_inhalt_der_betriebsanweisun", "friseurchemikalien_faerbe_blondier_dauer"] };
const feld = v.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "unterschriften_papier")!;

describe("Unterweisung Gefahrstoffe und Biostoffe", () => {
  it("ohne Gefahr- und Biostoff-Themen: keine Sperre, kein Kasten", () => {
    const d = { ...basis, thema: "Jährliche Unterweisung" };
    expect(fehlendeAngaben(v, d, B)).toEqual([]);
    expect(v.formHinweis!(d)).toBeNull();
    expect(sichtbar(feld, d)).toBe(false);
  });
  it("„Alle Pflichtangaben“ erst, wenn „Unterschriften auf Papier eingeholt“ angekreuzt ist", () => {
    expect(fehlendeAngaben(v, gefahr, B)).toEqual([UNTERSCHRIFT_FEHLT]);
    expect(v.pruefenZu![UNTERSCHRIFT_FEHLT]).toBe("unterschriften_papier");
    expect(sichtbar(feld, gefahr)).toBe(true);
    expect(fehlendeAngaben(v, { ...gefahr, unterschriften_papier: true }, B)).toEqual([]);
    // Biostoffe (Praxis) ebenso
    expect(fehlendeAngaben(v, { ...basis, themen: ["praxis_biostoffe"] }, B)).toEqual([UNTERSCHRIFT_FEHLT]);
  });
  it("die App bietet den eingetippten Namen dafür nicht als genügend an", () => {
    const h = v.formHinweis!(gefahr)!;
    expect(h.form).toBe("unterschrift");
    expect(h.text).toMatch(/mündlich und arbeitsplatzbezogen.*Unterschrift bestätigt \(§ 14 Abs\. 2 GefStoffV, § 14 Abs\. 3 BioStoffV\)\. Ein eingetippter Name genügt dafür nicht/);
    expect(v.abschnitte[1]!.hilfe).toMatch(/mündlich und arbeitsplatzbezogen.*reine App- oder E-Learning-Unterweisung reicht dafür nicht/);
  });
  it("PDF: Unterschriftsspalte je Person, Hinweis zur Pflicht, Rechtsgrundlage, Betriebsanweisung und Verständniskontrolle", () => {
    const h = dokumentHtml(v, { ...gefahr, ba_nummer: "BA-01, BA-02", verstaendnis: "Fragen zu den Inhalten" } as never, B).replace(/&nbsp;|\u00a0/g, " ");
    expect(h).toContain("<th>Name</th><th>Unterschrift</th>");
    expect(h).toContain("<td>Jana Becker</td><td></td>");
    expect(h).toMatch(/Gefahrstoffe\/Biostoffe: Unterweisung mündlich und arbeitsplatzbezogen; jede unterwiesene Person bestätigt Inhalt und Zeitpunkt mit ihrer eigenhändigen Unterschrift/);
    expect(h).toContain("§ 14 Abs. 2 GefStoffV; § 4 Abs. 1 DGUV Vorschrift 1");
    expect(h).toContain("<th>Anhand Betriebsanweisung Nr.</th><td>BA-01, BA-02</td>");
    expect(h).toContain("<th>Verständnis geprüft durch</th><td>Fragen zu den Inhalten</td>");
  });
  it("Bezeichnung nennt Gefahrstoffe, aber kein Thema angekreuzt: Hinweis", () => {
    expect(v.hinweise!({ ...basis, themen: [] } as never, B)[0]).toMatch(/Kreuze das passende Thema an/);
  });
});
