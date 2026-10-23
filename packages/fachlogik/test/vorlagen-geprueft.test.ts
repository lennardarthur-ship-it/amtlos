/**
 * Nachkontrolle T. Baum (23.10.2026): Vermerk „Vorlagen fachlich durchgesehen (Stand 23.10.2026)“ bei Eigenkontrollen
 * (HACCP), Hygieneplan (nur Lebensmittelbetrieb), Allergenliste, Belehrung nach § 43 IfSG und Schulungsnachweis – nur,
 * solange die Prüfsumme der Bausteine und Texte zum freigegebenen Stand passt.
 */
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEERER_BETRIEB, PRUEFHINWEIS, VERIFIZIERUNG, VORLAGEN, dokumentHtml, leereDaten,VORLAGEN_GEPRUEFT, geprueftVermerk, pruefHinweisFuer, sha256, vorlageFuer, vorlageGeprueft, vorlagenPruefsumme, type Daten, type Vorlage } from "../src/index.js";

const FUENF = ["haccp", "hygieneplan", "allergene", "ifsg_belehrung", "hygieneschulung"];
// Durchsicht 23.10.2026: StB Busch, T. Koch, RA Dr. Weber (E-177)
// Gefährdungsbeurteilung: Vermerk entfallen mit den Baustein-Korrekturen aus derselben Durchsicht (T. Koch, B-054, B-200,
// B-218, B-226, B-231, B-233, B-236, B-238) – erneut vorlegen
const WEITERE = ["rechnung", "euer", "verfahrensdokumentation", "kassenmeldung", "lohnkonto", "unterweisung", "gefahrstoffverzeichnis",
  "betriebsanweisung_maschine", "pruefprotokoll_elektro", "datenschutz_dokumentation", "datenschutzerklaerung_website", "avv", "datenschutzinformation", "datenpanne",
  "video_hinweisschild", "anamnese_einwilligung", "arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ki_kompetenz", "ausweis_hinweis", "schluesselquittung",
  "impressum", "gewerbeanmeldung", "transparenzregister"];
const ALLE = [...FUENF, ...WEITERE];
const VERMERK = "Vorlagen fachlich durchgesehen (Stand 23.10.2026)";

describe("Vorlagen fachlich durchgesehen (Nachkontrolle T. Baum 23.10.2026)", () => {
  afterEach(() => vi.useRealTimers());

  it("zentrale Liste: genau die fünf Vorlagen, Stand 23.10.2026, ohne Namen im Vermerk", () => {
    expect(Object.keys(VORLAGEN_GEPRUEFT).sort()).toEqual([...ALLE].sort());
    for (const id of WEITERE) {
      expect(vorlageFuer(id), id).toBeDefined();
      expect(VORLAGEN_GEPRUEFT[id]!.stand).toBe("2026-10-23");
      expect(vorlagenPruefsumme(vorlageFuer(id)!), id).toBe(VORLAGEN_GEPRUEFT[id]!.pruefsumme);
    }
    for (const id of FUENF) {
      expect(vorlageFuer(id), id).toBeDefined();
      expect(VORLAGEN_GEPRUEFT[id]!.stand).toBe("2026-10-23");
      expect(VORLAGEN_GEPRUEFT[id]!.bezug).toBe("Nachkontrolle T. Baum 23.10.2026");
      expect(VORLAGEN_GEPRUEFT[id]!.pruefsumme).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(geprueftVermerk("2026-10-23")).toBe(VERMERK);
    expect(VERMERK).not.toMatch(/Baum/);
  });

  it("Prüfsumme passt zum freigegebenen Stand – sonst entfällt der Vermerk in der App", () => {
    // Schlägt dieser Test fehl, hat sich eine freigegebene Vorlage geändert: die Änderung zurücknehmen oder die Vorlage
    // erneut fachlich durchsehen lassen und erst dann die Prüfsumme in geprueft.ts neu eintragen.
    for (const id of FUENF) expect(vorlagenPruefsumme(vorlageFuer(id)!), id).toBe(VORLAGEN_GEPRUEFT[id]!.pruefsumme);
  });

  it("Vermerk bei den fünf Vorlagen, bei allen anderen der bisherige Hinweis", () => {
    for (const v of VORLAGEN) {
      const d: Daten = v.id === "hygieneplan" ? { art: "lebensmittel" } : {};
      expect(pruefHinweisFuer(v, d), v.id).toBe(ALLE.includes(v.id) ? VERMERK : PRUEFHINWEIS);
    }
  });

  it("Hygieneplan: nur in der Fassung für Lebensmittelbetriebe; ohne Unterlage (Info-Seite) der bisherige Hinweis", () => {
    const h = vorlageFuer("hygieneplan")!;
    expect(pruefHinweisFuer(h, { art: "lebensmittel" })).toBe(VERMERK);
    expect(pruefHinweisFuer(h, { art: "beauty" })).toBe(PRUEFHINWEIS);
    expect(pruefHinweisFuer(h, {})).toBe(PRUEFHINWEIS);
    expect(pruefHinweisFuer(h)).toBe(PRUEFHINWEIS);
    // die übrigen gelten auch ohne Unterlage
    expect(pruefHinweisFuer(vorlageFuer("haccp")!)).toBe(VERMERK);
    // Beauty-Vorschläge gehören nicht zur Freigabe: eine Änderung dort lässt den Vermerk stehen
    const beauty: Vorlage = {
      ...h,
      abschnitte: h.abschnitte.map((a) => ({ ...a, felder: a.felder.map((f) => (f.art === "liste" && f.vorschlaege ? { ...f, vorschlaege: f.vorschlaege.map((x) => (x.gruppe === "Alle Beauty-Betriebe" ? { ...x, titel: `${x.titel} (geändert)` } : x)) } : f)) })),
    };
    expect(beauty.abschnitte.some((a) => a.felder.some((f) => f.art === "liste" && f.vorschlaege?.some((x) => x.titel.endsWith("(geändert)"))))).toBe(true);
    expect(vorlagenPruefsumme(beauty)).toBe(VORLAGEN_GEPRUEFT.hygieneplan!.pruefsumme);
  });

  it("jede Änderung an Bausteinen, Hilfetexten oder festen Texten hebt den Vermerk auf", () => {
    const haccp = vorlageFuer("haccp")!;
    // Hilfetext eines Abschnitts
    const hilfe: Vorlage = { ...haccp, abschnitte: haccp.abschnitte.map((a, i) => (i === 0 ? { ...a, hilfe: `${a.hilfe ?? ""} Neu.` } : a)) };
    // Inhalt eines Vorschlags (Grenzwert)
    const grenzwert: Vorlage = {
      ...haccp,
      abschnitte: haccp.abschnitte.map((a) => ({ ...a, felder: a.felder.map((f) => (f.art === "liste" && f.id === "punkte" && f.vorschlaege ? { ...f, vorschlaege: f.vorschlaege.map((x, j) => (j === 0 ? { ...x, werte: { ...x.werte, grenzwert: "höchstens +8 °C" } } : x)) } : f)) })),
    };
    // fester Text im Dokument (nur in html, nicht in der Formularbeschreibung)
    const dokument: Vorlage = { ...haccp, html: (d, b) => haccp.html(d, b).replace("Gefahrenanalyse", "Gefahrenanalyse (geändert)") };
    // nur Gestaltung (CSS) zählt nicht
    const gestaltung: Vorlage = { ...haccp, html: (d, b) => haccp.html(d, b).replace("</style>", " .neu{color:red}</style>") };
    for (const [name, v] of [["Hilfetext", hilfe], ["Grenzwert", grenzwert], ["Dokumenttext", dokument]] as const) {
      expect(vorlagenPruefsumme(v), name).not.toBe(VORLAGEN_GEPRUEFT.haccp!.pruefsumme);
      expect(vorlageGeprueft(v), name).toBeUndefined();
      expect(pruefHinweisFuer(v), name).toBe(PRUEFHINWEIS);
    }
    expect(haccp.html({}, LEERER_BETRIEB)).toContain("</style>");
    expect(vorlagenPruefsumme(gestaltung)).toBe(VORLAGEN_GEPRUEFT.haccp!.pruefsumme);
    expect(pruefHinweisFuer(gestaltung)).toBe(VERMERK);
  });

  it("Prüfsumme hängt nicht vom heutigen Datum ab", () => {
    vi.useFakeTimers();
    for (const tag of ["2026-10-23T08:00:00Z", "2031-03-01T12:00:00Z"]) {
      vi.setSystemTime(new Date(tag));
      for (const id of FUENF) {
        // frisches Objekt: an der Merkliste vorbei neu rechnen
        const v = { ...vorlageFuer(id)! };
        expect(vorlagenPruefsumme(v), `${id} ${tag}`).toBe(VORLAGEN_GEPRUEFT[id]!.pruefsumme);
      }
    }
  });

  it("SHA-256 ohne Node-APIs stimmt mit node:crypto überein", () => {
    for (const t of ["", "abc", "Allergene und Zusatzstoffe – °C ≤ 𝄞", "x".repeat(10_000)]) expect(sha256(t)).toBe(createHash("sha256").update(t, "utf8").digest("hex"));
  });
});

describe("Nachkontrolle T. Baum (23.10.2026): Ergänzungen und Hinweise 1–5", () => {
  const html = (id: string) => {
    const v = vorlageFuer(id)!;
    return dokumentHtml(v, leereDaten(v, LEERER_BETRIEB, "2026-10-23"), LEERER_BETRIEB);
  };
  it("L-085 ohne „fachlich zu prüfen“; Klarspül-Korrekturmaßnahme im Hilfetext des Monatsrasters", () => {
    expect(VERIFIZIERUNG.find((o) => o.wert === "kontrollen")!.quelle).not.toMatch(/zu prüfen/);
    const raster = vorlageFuer("haccp")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "raster_geraete")!;
    expect(raster.hilfe).toContain("unter Richtwert: Geschirr erneut spülen, Gerät vom Kundendienst prüfen lassen.");
  });
  it("Hinweis 1: Hackfleisch-Fundstellen getrennt (zugekauft Nr. 3.3.1, eigene Herstellung Nr. 3.1.3)", () => {
    const punkte = vorlageFuer("haccp")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "punkte");
    const vs = punkte?.art === "liste" ? (punkte.vorschlaege ?? []) : [];
    expect(vs.find((x) => x.titel === "Kühlung Hackfleisch")!.quelle).toMatch(/^Tier-LMHV Anlage 5 Kap\. II Nr\. 3\.3\.1;/);
    expect(vs.find((x) => x.titel === "Kühlung Hackfleisch – nur bei eigener Herstellung")!.quelle).toMatch(/^Tier-LMHV Anlage 5 Kap\. II Nr\. 3\.1\.3;/);
  });
  it("Hinweise 3 und 5: Überschriften der Allergenliste und der CCP-Tabelle", () => {
    expect(html("allergene")).toContain("Allergene und Zusatzstoffe in unseren Speisen und Getränken</h1>");
    expect(html("haccp")).toContain("Kritische Kontrollpunkte (CCP) und Temperaturkontrollen (GHP)</h2>");
  });
});
