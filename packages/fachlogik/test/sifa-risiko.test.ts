/** E-167 (Sifa-Durchsicht 22.10.2026, Blatt „D Risikoskala“): Risiko aus Schwere × Wahrscheinlichkeit, keine Vorbelegung. */
import { describe, expect, it } from "vitest";
import { RISIKO_MATRIX, dokumentHtml, eintragAusVorschlag, fehlendeAngaben, leereDaten, neuerEintrag, risikoAus, vorlageFuer, type Betrieb, type ListenFeld } from "../src/index.js";

const B: Betrieb = { name: "Café Morgenrot", strasse: "Markt 1", plz: "72764", ort: "Reutlingen", verantwortlich: "Mara Lindner", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Baden-Württemberg" };
const v = vorlageFuer("gefaehrdungsbeurteilung")!;
const liste = v.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "gefaehrdungen") as ListenFeld;
const html = (d: Record<string, unknown>) => dokumentHtml(v, d as never, B).replace(/&nbsp;|\u00a0/g, " ");

describe("Risikomatrix", () => {
  it("entspricht dem Vorschlag der Sifa (Zeile Schwere, Spalte Wahrscheinlichkeit)", () => {
    expect(RISIKO_MATRIX).toEqual({
      leicht: { unwahrscheinlich: "gering", moeglich: "gering", wahrscheinlich: "mittel" },
      mittel: { unwahrscheinlich: "gering", moeglich: "mittel", wahrscheinlich: "hoch" },
      schwer: { unwahrscheinlich: "mittel", moeglich: "hoch", wahrscheinlich: "hoch" },
    });
    // seltene, aber schwere Ereignisse landen nicht mehr bei „gering“
    expect(risikoAus("schwer", "unwahrscheinlich")).toBe("mittel");
    expect(risikoAus("schwer", null)).toBe("");
    expect(risikoAus(null, "wahrscheinlich")).toBe("");
  });
  it("neuer Eintrag ohne Vorbelegung; Schwere und Wahrscheinlichkeit sind Pflicht", () => {
    const e = neuerEintrag(liste, B, "2026-10-22");
    expect(e.schwere).toBeNull();
    expect(e.wahrscheinlichkeit).toBeNull();
    expect(liste.felder.some((f) => f.id === "risiko")).toBe(false);
    const d = { ...leereDaten(v, B, "2026-10-22"), arbeitsbereich: "Küche", mutterschutz_ergebnis: "umgestaltung", gefaehrdungen: [{ ...e, beschreibung: "Glasbruch", massnahme: "Handschuhe", faktor: "arbeitsmittel" }] };
    expect(fehlendeAngaben(v, d, B)).toEqual(["Gefährdung: Schwere des möglichen Schadens", "Gefährdung: Wahrscheinlichkeit"]);
    // ohne Bewertung druckt die Spalte eine Linie, keine Stufe
    expect(html(d)).toContain("<td>Glasbruch</td><td><span class=\"zelle-linie\"></span></td>");
  });
  it("Vorschlag mit Risiko „hoch“ schlägt nur die Schwere vor; die Stufe entsteht erst mit der Wahrscheinlichkeit", () => {
    const vs = liste.vorschlaege!.find((x) => x.titel.startsWith("Elektrischer Schlag und Störlichtbogen"))!;
    const e = eintragAusVorschlag(liste, vs, B, "2026-10-22");
    expect(e.schwere).toBe("schwer");
    expect(e.wahrscheinlichkeit).toBeNull();
    for (const x of liste.vorschlaege!) expect(x.werte.risiko, x.titel).toBeUndefined();
    const h = html({ gefaehrdungen: [{ ...e, wahrscheinlichkeit: "moeglich" }], mutterschutz_ergebnis: "umgestaltung" });
    expect(h).toContain("<strong>hoch</strong><br><span class=\"klein\">schwer / möglich</span>");
  });
  it("Legende mit Matrix und Handlungsbedarf auf dem PDF, auch auf dem leeren Blatt", () => {
    for (const h of [html(leereDaten(v, B, "2026-10-22")), html({ gefaehrdungen: [{ beschreibung: "x", massnahme: "y", schwere: "leicht", wahrscheinlichkeit: "wahrscheinlich" }] })]) {
      expect(h).toContain("<h3>Risiko: Schwere × Wahrscheinlichkeit</h3>");
      expect(h).toContain("<th>Schwere des möglichen Schadens</th><th>unwahrscheinlich</th><th>möglich</th><th>wahrscheinlich</th>");
      expect(h).toMatch(/Handlungsbedarf: hoch – sofort handeln.*mittel – zeitnah handeln, mit Termin; gering – bei Gelegenheit/);
    }
  });
  it("bestehende Unterlagen: alte Einzelstufe bleibt stehen, mit Vermerk und Hinweis „neu bewerten“", () => {
    const alt = { arbeitsbereich: "Küche", mutterschutz_ergebnis: "umgestaltung", gefaehrdungen: [{ beschreibung: "Rutschgefahr", massnahme: "Matten", faktor: "arbeitsstaette", risiko: "mittel" }, { beschreibung: "Fettbrand", massnahme: "Löscher", faktor: "sonstiges", risiko: "hoch", schwere: "schwer", wahrscheinlichkeit: "unwahrscheinlich" }] };
    const h = html(alt);
    expect(h).toContain("mittel<br><span class=\"klein\">bisherige Einstufung – neu bewerten</span>");
    // mit Schwere und Wahrscheinlichkeit gilt die neue Stufe, nicht die alte
    expect(h).toContain("<strong>mittel</strong><br><span class=\"klein\">schwer / unwahrscheinlich</span>");
    expect(v.hinweise!(alt as never, B).join(" ")).toMatch(/Risiko neu bewerten: Eine Gefährdung hat noch die bisherige Einstufung/);
    expect(fehlendeAngaben(v, alt as never, B)).toContain("Gefährdung 1: Schwere des möglichen Schadens");
    expect(v.ergebnis!(alt as never)).toEqual([["Risiko hoch", "0"], ["Risiko mittel", "1"], ["Risiko gering", "0"], ["Noch nicht bewertet", "1"], ["Gefährdungen", "2"]]);
  });
  it("„Sonstige Gefährdungen“ nach festen Unterpunkten; leeres Blatt mit Brand, Elektrik, Notfall", () => {
    const h = html({ gefaehrdungen: [{ beschreibung: "Fettbrand", massnahme: "Löscher", faktor: "sonstiges", unterpunkt: "brand" }, { beschreibung: "Erste Hilfe", massnahme: "Verbandkasten", faktor: "sonstiges", unterpunkt: "notfall" }] });
    expect(h.indexOf("<h3>Brand- und Explosionsgefährdung</h3>")).toBeLessThan(h.indexOf("<h3>Notfallorganisation (Erste Hilfe, Flucht und Rettung)</h3>"));
    const leer = html(leereDaten(v, B, "2026-10-22"));
    for (const t of ["Brand- und Explosionsgefährdung", "Elektrische Gefährdung", "Notfallorganisation (Erste Hilfe, Flucht und Rettung)"]) expect(leer).toContain(`<h3>${t}</h3>`);
  });
});
