/** E-167 (Sifa-Durchsicht 22.10.2026, Blätter „A“ und „B“): neue Vorlagen, Prüffristen, Zuordnung der Bausteine. */
import { describe, expect, it } from "vitest";
import { ANLAESSE, KURZ, SIFA_PRUEFUNG, VORLAGEN, dokumentHtml, leereDaten, naechstePruefung, vorlageFuer, type Betrieb, type Feld, type ListenFeld, type Vorlage } from "../src/index.js";

const B: Betrieb = { name: "Tischlerei Holm", strasse: "Weg 2", plz: "72764", ort: "Reutlingen", verantwortlich: "Ole Holm", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Baden-Württemberg" };
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ");
const html = (id: string, d: Record<string, unknown>) => glatt(dokumentHtml(vorlageFuer(id)!, d as never, B));
const leer = (id: string) => glatt(dokumentHtml(vorlageFuer(id)!, leereDaten(vorlageFuer(id)!, B, "2026-10-22"), B));

describe("neue Vorlagen", () => {
  it("sind verdrahtet: VORLAGEN, Kurztext, Anlass „Sicherheit“, Pflichten des Katalogs", () => {
    const neu = { betriebsanweisung_maschine: "arbeitsschutz.betriebsanweisung_arbeitsmittel", betriebsanweisung_biostoffe: "arbeitsschutz.biostoffe", expositionsverzeichnis: "arbeitsschutz.expositionsverzeichnis" };
    for (const [id, pflicht] of Object.entries(neu)) {
      const v = vorlageFuer(id)!;
      expect(VORLAGEN).toContain(v);
      expect(v.bereich).toBe("arbeitsschutz");
      expect(v.pflichten).toEqual([pflicht]);
      expect(KURZ[id], id).toBeTruthy();
      expect(ANLAESSE.find((a) => a.id === "sicherheit")!.vorlagen).toContain(id);
    }
  });
  it("Betriebsanweisung Maschinen (§ 12 BetrSichV): Gliederung, Farbe, Vorschläge für die fünf Maschinen, leer auf einem Blatt", () => {
    const l = leer("betriebsanweisung_maschine");
    expect(l).toContain("für Arbeitsmittel gemäß § 12 BetrSichV");
    for (const k of ["Anwendungsbereich", "Gefahren für Mensch und Umwelt", "Schutzmaßnahmen und Verhaltensregeln", "Verhalten bei Störungen", "Verhalten bei Unfällen – Erste Hilfe", "Instandhaltung, Entsorgung"]) expect(l).toContain(`<h2>${k}</h2>`);
    expect(l).toContain("--band:#1d5aa6");
    expect(l).toContain('class="g-aushang ba kompakt"');
    const maschine = vorlageFuer("betriebsanweisung_maschine")!.abschnitte[0]!.felder[0] as { vorschlaege?: string[] };
    expect(maschine.vorschlaege).toEqual(["Aufschnittmaschine", "Knetmaschine (Spiralkneter)", "Tischkreissäge", "Hebebühne", "Reifenmontiermaschine"]);
    const h = html("betriebsanweisung_maschine", { maschine: "Aufschnittmaschine", arbeitsbereich: "Küche", gefahren: "Schnittverletzungen.", schutz: "Restehalter benutzen.", stoerung: "Not-Halt.", unfall: "Notruf 112.", instandhaltung: "Nur im Stillstand reinigen.", beschraenkung: "Jugendliche nur unter Aufsicht.", datum: "2026-10-22" });
    expect(h).toContain("<dd>Aufschnittmaschine</dd>");
    expect(h).toContain("<h2>Beschäftigungsbeschränkungen</h2>");
  });
  it("Betriebsanweisung Biostoffe (§ 14 BioStoffV): Gliederung nach § 14 Abs. 1, Schutzstufe, optionale Kästen nur ausgefüllt", () => {
    const l = leer("betriebsanweisung_biostoffe");
    expect(l).toContain("für Tätigkeiten mit Biostoffen gemäß § 14 BioStoffV");
    for (const k of ["Gefahren für die Beschäftigten", "Schutzmaßnahmen und Verhaltensregeln", "Verhalten bei Verletzungen, Unfällen und Betriebsstörungen – Erste Hilfe", "Sachgerechte Inaktivierung und Entsorgung"]) expect(l).toContain(`<h2>${k}</h2>`);
    expect(l).not.toContain("Arbeitsmedizinische Vorsorge und Impfungen");
    const h = html("betriebsanweisung_biostoffe", { taetigkeit: "Blutentnahme", biostoffe: "HBV, HCV, HIV", schutzstufe: "2", vorsorge: "Impfangebot Hepatitis B." });
    expect(h).toContain("<dd>HBV, HCV, HIV · Schutzstufe 2</dd>");
    expect(h).toContain("<h2>Arbeitsmedizinische Vorsorge und Impfungen</h2>");
  });
  it("Expositionsverzeichnis (§ 10a GefStoffV): Hartholzstaub und Dieselmotoremissionen, Höhe und Dauer", () => {
    const h = html("expositionsverzeichnis", { stand: "2026-10-22", eintraege: [{ name: "Ole Holm", taetigkeit: "Schleifen Eiche", stoff: "Hartholzstaub (z. B. Eiche, Buche)", kategorie: "k", hoehe: "unter 2 mg/m³", von: "2024-03-01", bis: null, dauer: "4 Stunden je Woche" }] });
    expect(h).toContain("<th>Höhe der Exposition</th>");
    expect(h).toContain("krebserzeugend 1A/1B");
    expect(h).toContain("01.03.2024 – andauernd");
    expect(h).toMatch(/Verzeichnis nach § 10a GefStoffV/);
    expect(leer("expositionsverzeichnis")).toContain("<th>Name</th><th>Tätigkeit</th>");
  });
  it("Betriebsanweisung Gefahrstoffe: Signalwort, Piktogramme, Beschäftigungsbeschränkungen", () => {
    expect(leer("betriebsanweisung")).toContain("☐ Gefahr");
    const h = html("betriebsanweisung", { stoff: "Blondierpulver", signalwort: "gefahr", piktogramme: ["GHS05", "GHS07"], beschraenkung: "Schwangere nicht." });
    expect(h).toContain("<b>Gefahr</b>");
    expect(h).toContain("GHS05 Ätzwirkung");
    expect(h).toContain("<h2>Beschäftigungsbeschränkungen</h2>");
  });
});

describe("Gefährdungsbeurteilung: Prüffristen der Arbeitsmittel (§ 3 Abs. 6 BetrSichV)", () => {
  const v = vorlageFuer("gefaehrdungsbeurteilung")!;
  it("Tabelle mit Arbeitsmittel, Prüfart, Frist, befähigter Person, letzter und nächster Prüfung – auch leer", () => {
    const kopf = "<th>Arbeitsmittel</th><th>Prüfart</th><th>Frist</th><th>Befähigte Person</th><th>Letzte Prüfung</th><th>Nächste Prüfung</th>";
    expect(leer("gefaehrdungsbeurteilung")).toContain(kopf);
    const h = html("gefaehrdungsbeurteilung", { pruefungen: [{ arbeitsmittel: "Leitern und Tritte", pruefart: "Prüfung", frist: "12 Monate", befaehigt: "Ole Holm", letzte: "2026-01-15", naechste: null }] });
    expect(h).toContain("<td><strong>Leitern und Tritte</strong></td><td>Prüfung</td><td>12 Monate</td><td>Ole Holm</td><td>15.01.2026</td><td>15.01.2027</td>");
    expect(h).toContain("§ 3 Abs. 6 BetrSichV");
  });
  it("nächster Termin nur als Vorschlag aus einer Frist mit Zahl", () => {
    expect(naechstePruefung("2026-01-15", "Richtwert 6 Monate, in Büros höchstens 2 Jahre bei Fehlerquote unter 2 %")).toBe("15.07.2026");
    expect(naechstePruefung("2026-01-15", "Frist nach Gefährdungsbeurteilung (in der Regel 12 Monate)")).toBe("");
    expect(naechstePruefung("", "12 Monate")).toBe("");
  });
  it("Vorschläge mit Quelle; besonders schutzbedürftige Personen; STOP mit Substitution", () => {
    const p = v.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "pruefungen") as ListenFeld;
    expect(p.vorschlaege!.length).toBeGreaterThanOrEqual(10);
    for (const x of p.vorschlaege!) expect(x.quelle, x.titel).toBeTruthy();
    expect(v.abschnitte[1]!.hilfe).toMatch(/STOP: Substitution vor technisch vor organisatorisch vor persönlich/);
    expect(html("gefaehrdungsbeurteilung", { schutzbeduerftig: ["jugendliche", "leiharbeit"] })).toContain("<th>Besonders schutzbedürftige Personen</th><td>Jugendliche, Leiharbeitnehmerinnen und Leiharbeitnehmer</td>");
  });
});

describe("Prüfprotokoll, Gefahrstoffverzeichnis, Hautschutzplan (Blatt „B Vorlagen“)", () => {
  it("Prüfprotokoll: „Mangel – nicht verwenden“, Grenzwerte, Qualifikation, Kalibrierung, Hinweis auf falsches Datum", () => {
    const d = { datum: "2026-10-22", qualifikation: "eup", messgeraet: "Benning ST 760", kalibriert: "2027-03-31", geraete: [{ bezeichnung: "Föhn", ergebnis: "maengel", maengel: "Kabel beschädigt", naechste: "2026-10-22" }] };
    const h = html("pruefprotokoll_elektro", d);
    expect(h).toContain("<strong>Mangel – nicht verwenden:</strong> Kabel beschädigt");
    expect(h).toMatch(/Grenzwerte \(Auszug.*RPE ≤ 0,3 Ω/);
    expect(h).toContain("Elektrotechnisch unterwiesene Person unter Leitung und Aufsicht einer Elektrofachkraft");
    expect(h).toContain("Benning ST 760, kalibriert bis 31.03.2027");
    expect(vorlageFuer("pruefprotokoll_elektro")!.hinweise!(d as never, B)[0]).toMatch(/liegt das Datum nicht nach dem Prüfdatum/);
  });
  it("Gefahrstoffverzeichnis: Lagermenge, CMR-Einstufung mit Hinweis auf das Expositionsverzeichnis", () => {
    const h = html("gefahrstoffverzeichnis", { stoffe: [{ bezeichnung: "Holzstaub Eiche", gefahren: "H350", menge: "–", arbeitsbereich: "Werkstatt", cmr: "k", substitution: "nicht möglich", ba_nr: "BA-03" }] });
    expect(h).toContain("<strong>krebserzeugend 1A/1B</strong>");
    expect(h).toContain("Expositionsverzeichnis zu führen (§ 10a GefStoffV)");
    expect(h).toContain("Betriebsanweisung BA-03");
    expect(h).toContain("Substitution geprüft: nicht möglich");
  });
  it("Hautschutzplan: Musterzeilen weiterer Branchen, Händedesinfektion als Spalte, Material/Norm", () => {
    const f = vorlageFuer("hautschutzplan")!.abschnitte.flatMap((a) => a.felder).find((x) => x.id === "eintraege") as ListenFeld;
    const gruppen = new Set(f.vorschlaege!.map((x) => x.gruppe));
    for (const g of ["Friseur", "Kosmetik", "Gastronomie / Café", "Gebäudereinigung", "Praxis / Gesundheit", "Kfz-Werkstatt", "Bäckerei", "Handwerk"]) expect(gruppen, g).toContain(g);
    const praxis = f.vorschlaege!.find((x) => x.titel === "Untersuchung und Behandlung")!;
    const h = html("hautschutzplan", { eintraege: [praxis.werte] });
    expect(h).toContain("<th>Händedesinfektion</th>");
    expect(h).toContain("Material/Norm: DIN EN 455");
  });
});

/** Felder einer Vorlage samt Listenfeldern, mit Bezeichnung (wie die Prüfmappe) */
function* felder(v: Vorlage): Generator<Feld> {
  for (const a of v.abschnitte) for (const f of a.felder) {
    yield f;
    if (f.art === "liste") yield* f.felder;
  }
}
/** Baustein mit Titel in einem Feld: Vorschlag, Option oder Formulierung – mit Quelle, soweit vorhanden */
function finde(vorlage: string, feld: string, titel: string): { quelle?: string } | null {
  for (const f of felder(vorlageFuer(vorlage)!)) {
    if (f.label !== feld) continue;
    if (f.art === "liste") { const x = f.vorschlaege?.find((s) => s.titel === titel); if (x) return x; }
    if ("optionen" in f) { const o = f.optionen.find((x) => x.text === titel); if (o) return o; }
    if ((f.art === "text" || f.art === "mehrzeilig") && f.vorschlaege?.includes(titel)) return {};
  }
  return null;
}

describe("Zuordnung der Durchsicht (sifa.ts)", () => {
  it("jede Nummer B-001 bis B-197 findet ihren Baustein; Prüfstand und Vermerk passen zusammen", () => {
    const nummern = new Set(SIFA_PRUEFUNG.map((e) => e.nr));
    expect(nummern.size).toBe(197);
    for (const e of SIFA_PRUEFUNG) {
      const b = finde(e.vorlage, e.feld, e.titel);
      expect(b, `${e.nr} ${e.titel}`).not.toBeNull();
      if (!b?.quelle) continue;
      if (e.pruefstand === "offen") expect(b.quelle, e.nr).toMatch(/fachlich zu prüfen/);
      else expect(b.quelle, e.nr).not.toMatch(/fachlich zu prüfen|Nutzertest|unsicher/);
    }
    expect(SIFA_PRUEFUNG.filter((e) => e.pruefstand === "offen").every((e) => e.grund)).toBe(true);
  });
  it("keine Aussage „geprüft von“ – die Durchsicht trägt noch keinen Namen", () => {
    const alles = JSON.stringify(VORLAGEN.map((v) => [v.abschnitte, v.beschreibung])) + JSON.stringify(SIFA_PRUEFUNG);
    expect(alles).not.toMatch(/geprüft von (der|einer|unserer) Fachkraft|von Fachleuten geprüft|\[Name\]|fachlich freigegeben/i);
  });
  it("die fehlenden Gefährdungen aus Blatt „A Fehlende Bausteine“ stehen in der Gefährdungsbeurteilung", () => {
    const gb = (vorlageFuer("gefaehrdungsbeurteilung")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "gefaehrdungen") as ListenFeld).vorschlaege!;
    for (const t of ["CO2 aus Getränkeschankanlagen", "Gasgeräte und Flüssiggas", "Brandschutz allgemein", "Schweißen und Schneiden", "Feuchtarbeit und Hautbelastung durch Reinigungsmittel", "Absturz bei Glas- und Fensterreinigung", "Laser in Dermatologie", "Mutterschutz bei Biostoffen", "Flurförderzeuge", "Rangieren und Rückwärtsfahren"]) expect(gb.some((x) => x.titel.startsWith(t)), t).toBe(true);
    expect(gb.find((x) => x.titel.startsWith("Schweißen"))!.werte.massnahme).toMatch(/über 3 mg\/m³/);
  });
});
