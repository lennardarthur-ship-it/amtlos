/**
 * E-166: Lücken aus der Prüfmappe Lebensmittelhygiene – Kern des HACCP-Verfahrens (Art. 5 Abs. 2 VO (EG) Nr. 852/2004:
 * Gefahrenanalyse, CCP mit Entscheidungshilfe, Grenzwerte, Überwachung, Korrekturmaßnahmen, Verifizierung,
 * Dokumentation), Hygieneplan-Zeilen für Bäckerei und Foodtruck, Gefährdungen für Praxen.
 */
import { describe, expect, it } from "vitest";
import {
  CCP_BEGRUENDUNG,
  CCP_FRAGEN,
  CCP_FRAGEN_QUELLE,
  CCP_HINWEIS,
  CCP_VORSCHLAEGE,
  GHP_KURZ,
  GRENZWERT_HACCP,
  HACCP_RUECKRUF,
  GEFAHRENANALYSE,
  HACCP_AUFBEWAHRUNG,
  HYGIENE_BAECKEREI,
  HYGIENE_FOODTRUCK,
  HYGIENE_THEMEN_LEBENSMITTEL,
  PROZESSSCHRITTE,
  dokumentHtml,
  eintragAusVorschlag,
  gruppenFuerBetrieb,
  leereDaten,
  mobilerVerkauf,
  vorlageFuer,
  type Betrieb,
  type Daten,
  type Eintrag,
  type ListenFeld,
  type Option,
} from "../src/index.js";

const B: Betrieb = { name: "Café-Bäckerei Lindenblüte", strasse: "Marktplatz 3", plz: "72764", ort: "Reutlingen", verantwortlich: "Mara Lindner", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Baden-Württemberg" };
const v = (id: string) => vorlageFuer(id)!;
const feld = (id: string, f: string) => v(id).abschnitte.flatMap((a) => a.felder).find((x) => x.id === f)!;
const liste = (id: string, f: string) => feld(id, f) as ListenFeld;
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ").replace(/\u00ad/g, "");
const html = (id: string, d: Daten) => glatt(dokumentHtml(v(id), d, B));
const aus = (id: string, f: string, gruppen: string[]): Eintrag[] => liste(id, f).vorschlaege!.filter((x) => gruppen.includes(x.gruppe ?? "")).map((x) => eintragAusVorschlag(liste(id, f), x, B, "2026-10-22"));
const GRUPPEN = ["Gastronomie / Café", "Bäckerei", "Foodtruck / mobiler Verkauf"];

describe("HACCP: Kern nach Art. 5 Abs. 2 VO (EG) Nr. 852/2004", () => {
  it("Formular in der Reihenfolge der Grundsätze; Messprotokoll und Kontrollpunkte bleiben", () => {
    const titel = v("haccp").abschnitte.map((a) => a.titel);
    expect(titel).toEqual(["Zeitraum und Verantwortung", "Gefahrenanalyse", "Kritische Kontrollpunkte", "Kontrollpunkte", "Verifizierung und Dokumentation", "Messungen"]);
    expect(liste("haccp", "gefahren").felder.map((f) => f.id)).toEqual(["schritt", "arten", "gefahr", "lenkung", "ccp", "begruendung"]);
    // Prüfbericht Lebensmittelhygiene: Einstufung CCP / Kontrollpunkt (GHP) als zusätzliches Feld
    expect(liste("haccp", "ccps").felder.map((f) => f.id)).toEqual(["schritt", "einstufung", "gefahr", "grenzwert", "ueberwachung", "wer", "wann", "korrektur"]);
    expect(liste("haccp", "punkte").vorschlaege!.length).toBeGreaterThanOrEqual(21);
    expect(feld("haccp", "messungen").art).toBe("liste");
  });

  it("leeres Blatt zeigt die Struktur: Prozessschritte, Entscheidungshilfe, Überwachung wer/wie oft, Verifizierung, Aufbewahrung", () => {
    const h = html("haccp", leereDaten(v("haccp"), B, "2026-10-22", ["gastro_cafe"]));
    for (const s of PROZESSSCHRITTE) expect(h, s).toContain(`<strong>${s}</strong>`);
    expect(h).toContain("<th>Prozessschritt</th><th>Gefahr</th><th>Lenkungsmaßnahme</th><th>CCP?</th>");
    expect(h).toContain("<th>CCP / Prozessschritt</th><th>Grenzwert</th><th>Überwachung</th><th>Korrekturmaßnahme</th>");
    for (const f of CCP_FRAGEN) expect(h).toContain(f.replace(/&/g, "&amp;"));
    expect(h).toContain("Codex Alimentarius CXC 1-1969");
    expect((h.match(/Wie:<br>Wer:<br>Wie oft:/g) ?? []).length).toBe(4);
    expect(h).toContain('<ul class="ankreuzen">');
    expect(h).toContain(HACCP_AUFBEWAHRUNG);
    expect(h).toContain("Art und Größe des Betriebs angemessen");
    // bisherige Teile unverändert
    expect(h).toContain("Kontrollpunkte, Grenzwerte und Korrekturmaßnahmen");
    expect(h).toContain("<h2>Messprotokoll</h2>");
    expect(h.indexOf("Gefahrenanalyse</h2>")).toBeLessThan(h.indexOf("Kontrollpunkte, Grenzwerte"));
  });

  it("Vorschläge je Branchengruppe: Gastronomie mit allen Prozessschritten, jeder CCP der Analyse hat Grenzwert, Überwachung und Korrektur", () => {
    expect([...new Set(GEFAHRENANALYSE.map((x) => x.gruppe))]).toEqual(GRUPPEN);
    expect([...new Set(CCP_VORSCHLAEGE.map((x) => x.gruppe))]).toEqual(GRUPPEN);
    expect(GEFAHRENANALYSE.filter((x) => x.gruppe === GRUPPEN[0]).map((x) => x.werte.schritt)).toEqual([...PROZESSSCHRITTE]);
    // Titel eindeutig (die App wählt Vorschläge über den Titel aus)
    for (const l of [GEFAHRENANALYSE, CCP_VORSCHLAEGE]) expect(new Set(l.map((x) => x.titel)).size).toBe(l.length);
    for (const g of GRUPPEN) {
      const d: Daten = { zeitraum: "Oktober 2026", gefahren: aus("haccp", "gefahren", [g]), ccps: aus("haccp", "ccps", [g]) };
      expect(v("haccp").hinweise!(d, B), g).toEqual([]);
    }
    for (const c of CCP_VORSCHLAEGE) for (const k of ["grenzwert", "ueberwachung", "wer", "wann", "korrektur"]) expect(String(c.werte[k]), `${c.titel} ${k}`).not.toBe("");
  });

  it("Werte mit Quelle; nach dem Prüfbericht Lebensmittelhygiene ohne „fachlich zu prüfen“", () => {
    for (const c of CCP_VORSCHLAEGE) {
      expect(c.quelle, c.titel).not.toMatch(/zu prüfen/);
      for (const w of Object.values(c.werte)) if (typeof w === "string" && /\d/.test(w)) expect(`${w} ${c.quelle}`, c.titel).toMatch(/BfR|LAVES|BgVV/);
      expect(JSON.stringify(c.werte), c.titel).not.toMatch(/zu prüfen|übertragen/);
    }
    const kern = CCP_VORSCHLAEGE.find((x) => x.titel === "Erhitzen – Kerntemperatur")!;
    expect(kern.werte.grenzwert).toBe("an allen Stellen (Kern) mindestens +72 °C für mindestens 2 Minuten");
    expect(kern.quelle).toContain("BfR, Presseinformation 13/2024");
    expect(String(CCP_VORSCHLAEGE.find((x) => x.titel === "Regenerieren")!.werte.grenzwert)).toContain("nur einmal regenerieren");
    for (const g of GEFAHRENANALYSE) expect(g.quelle, g.titel).not.toMatch(/zu prüfen/);
    // Zahlen gehören in die CCP-Tabelle – einzige Ausnahme: sofort kühlen nach dem Füllen (L-033)
    for (const g of GEFAHRENANALYSE.filter((x) => x.titel !== "Füllen und Garnieren (Sahne, Creme)")) expect(JSON.stringify(g.werte), g.titel).not.toMatch(/°C/);
  });

  it("Prüfbericht Lebensmittelhygiene: CCP nur für Erhitzen, Heißhalten, Abkühlen; Kühlen als Kontrollpunkt (GHP)", () => {
    const ccps = GEFAHRENANALYSE.filter((x) => x.werte.ccp === "ja").map((x) => x.titel);
    expect(ccps).toEqual(["Erhitzen", "Heißhalten", "Abkühlen", "Regenerieren", "Erhitzen von Cremes und Füllungen", "Erhitzen am Stand", "Heißhalten am Stand"]);
    for (const t of ["Lagerung gekühlt", "Kühllagerung Konditoreiwaren", "Transport und Kühlung unterwegs"]) {
      const g = GEFAHRENANALYSE.find((x) => x.titel === t)!;
      expect(g.werte, t).toMatchObject({ ccp: "nein", begruendung: CCP_BEGRUENDUNG[1] });
    }
    expect(CCP_BEGRUENDUNG[1]).toBe("Frage 1: mit der Basishygiene beherrscht – Kontrollpunkt mit Aufzeichnung");
    expect(GEFAHRENANALYSE.find((x) => x.titel === "Füllen und Garnieren (Sahne, Creme)")!.werte).toMatchObject({ begruendung: CCP_BEGRUENDUNG[0] });
    expect(String(GEFAHRENANALYSE.find((x) => x.titel === "Füllen und Garnieren (Sahne, Creme)")!.werte.lenkung)).toContain("Sahne nur aus pasteurisierter Ware");
    const backen = GEFAHRENANALYSE.find((x) => x.titel === "Backen")!;
    expect(backen.werte.arten).toEqual(["biologisch", "chemisch", "physikalisch"]);
    expect(backen.quelle).toContain("VO (EU) 2017/2158");
    // berichtigter Prüfbericht: kleine Betriebe Anhang II Teil A, Teil B nur zusätzlich für Filial-/Franchisebetriebe
    expect(backen.quelle).toContain("Art. 2 Abs. 2 mit Anhang II Teil A bei Abgabe im eigenen Laden oder an örtliche Einzelhändler; Anhang II Teil B nach Art. 2 Abs. 3 nur zusätzlich für zentral gesteuerte Filial- und Franchisebetriebe");
    expect(String(GEFAHRENANALYSE.find((x) => x.titel === "Lagerung tiefgekühlt")!.werte.lenkung)).toContain("Auftaudatum beschriften, aufgetaute Ware binnen 24 Stunden verarbeiten");
    expect(GEFAHRENANALYSE.find((x) => x.titel === "Zubereitung")!.werte.arten).toContain("chemisch");
    // Kühlzeilen bleiben in der CCP-Tabelle, gekennzeichnet; alle übrigen sind CCP
    expect(CCP_VORSCHLAEGE.filter((x) => x.werte.einstufung === "ghp").map((x) => x.titel)).toEqual(["Lagerung gekühlt – Kühltemperatur", "Kühllagerung Konditoreiwaren", "Transport und Kühlung unterwegs"]);
    expect(CCP_VORSCHLAEGE.filter((x) => x.werte.einstufung !== "ghp").every((x) => x.werte.einstufung === "ccp")).toBe(true);
    for (const t of ["Heißhalten", "Heißhalten am Stand"]) {
      const c = CCP_VORSCHLAEGE.find((x) => x.titel === t)!;
      expect(c.werte.grenzwert).toBe("mindestens +60 °C an allen Stellen, höchstens 3 Stunden");
      expect(String(c.werte.korrektur)).toContain("auf mindestens +72 °C Kerntemperatur nacherhitzen (nur einmal)");
      expect(String(c.werte.wann)).toMatch(/danach alle 2 Stunden$/);
    }
    expect(CCP_FRAGEN[3]).toMatch(/oder hält er sie sicher auf einem unbedenklichen Maß/);
    expect(CCP_FRAGEN_QUELLE).toContain("CXC 1-1969 (Rev. 2020), Diagramm 2");
  });

  it("CCP-Tabelle: Kontrollpunkt (GHP) sichtbar; frühere Einträge ohne Einstufung gelten als CCP", () => {
    const alt = html("haccp", { zeitraum: "Mai 2026", ccps: [{ schritt: "Lagerung gekühlt – Kühltemperatur", grenzwert: "höchstens +7 °C", korrektur: "x" }] });
    expect(alt).not.toContain(GHP_KURZ);
    expect(alt).not.toContain("Anhang I Nr. 3.12");
    const neu = html("haccp", { zeitraum: "Mai 2026", ccps: aus("haccp", "ccps", ["Gastronomie / Café"]) });
    expect(neu).toContain(`<strong>Lagerung gekühlt – Kühltemperatur</strong><br><span class="klein"><em>${GHP_KURZ}</em></span>`);
    expect(neu).not.toContain(`<strong>Heißhalten</strong><br><span class="klein"><em>${GHP_KURZ}</em></span>`);
    expect(neu).toContain("Anhang I Nr. 3.12");
    // Entscheidungshilfe mit Hinweis, Aufzeichnungen mit Rückruf-Satz, Fußtext mit den Branchenleitlinien
    expect(neu).toContain(CCP_HINWEIS);
    expect(neu).toContain(HACCP_RUECKRUF);
    for (const s of ["DEHOGA", "Bäckerhandwerk", "ortsveränderlichen Betriebsstätten"]) expect(neu, s).toContain(s);
    expect(neu).not.toContain("Aufzeichnungen nur bei Abweichungen");
  });

  it("Hinweise: Gefahrenanalyse fehlt, CCP ohne Grenzwert, Entscheidung offen", () => {
    const h = (d: Daten) => v("haccp").hinweise!(d, B).join(" ");
    expect(h({ zeitraum: "Oktober 2026" })).toMatch(/Gefahrenanalyse fehlt noch/);
    expect(h({ gefahren: [{ schritt: "Erhitzen", ccp: "ja", gefahr: "x", lenkung: "y" }] })).toMatch(/„Erhitzen“ ist als kritischer Kontrollpunkt bestimmt/);
    expect(h({ gefahren: [{ schritt: "Erhitzen", ccp: "ja" }], ccps: [{ schritt: "Erhitzen – Kerntemperatur", grenzwert: "72 °C" }] })).toBe("");
    expect(h({ gefahren: [{ schritt: "Ausgabe", ccp: "offen" }] })).toMatch(/Noch nicht entschieden.*„Ausgabe“/);
  });

  it("ausgefüllt: Gefahrenarten, CCP-Entscheidung mit Begründung, Überwachung; Grenzwert im Messprotokoll auch aus dem CCP", () => {
    const d: Daten = {
      zeitraum: "Oktober 2026", verantwortlich: "Mara Lindner", stand: "2026-10-01",
      gefahren: aus("haccp", "gefahren", ["Gastronomie / Café"]), ccps: aus("haccp", "ccps", ["Gastronomie / Café"]),
      verifizierung: ["protokolle_durchsehen", "aenderungen"], aufzeichnungen: ["konzept", "wareneingang"], aufbewahrung: HACCP_AUFBEWAHRUNG, naechste_pruefung: "2027-04-01",
      messungen: [{ datum: "2026-10-01", kontrollpunkt: "Erhitzen – Kerntemperatur", wert: "78 °C", in_ordnung: "ja" }],
    };
    const h = html("haccp", d);
    expect(h).toContain("Verantwortlich");
    expect(h).toContain("Stand der Gefahrenanalyse");
    expect(h).toContain('<span class="klein">biologisch, physikalisch, Allergene</span>');
    expect(h).toContain("<strong>ja</strong><br><span class=\"klein\">Frage 4: dieser Schritt beseitigt die Gefahr oder hält sie sicher auf einem unbedenklichen Maß – CCP</span>");
    expect(h).toContain('<span class="klein">Wer:</span> Koch / Köchin');
    expect(h).toContain("Gefahrenanalyse und CCP überprüfen, sobald sich Produkte, Abläufe, Geräte oder Lieferanten ändern");
    expect(h).toContain("Wareneingangskontrollen, Lieferscheine und Rechnungen (auch für die Rückverfolgbarkeit)");
    expect(h).toContain("01.04.2027");
    expect(h).toContain("<td>Erhitzen – Kerntemperatur</td><td>an allen Stellen (Kern) mindestens +72 °C für mindestens 2 Minuten</td>");
    expect(h).not.toContain('<ul class="ankreuzen">');
  });
});

describe("Hygieneplan Lebensmittel: Bäckerei und Foodtruck", () => {
  const vorschlaege = liste("hygieneplan", "eintraege").vorschlaege!;
  it("eigene Gruppen mit den Themenbereichen des Lebensmittel-Plans; vom Prüfbericht bestätigt, Grenzwerte nur in den Eigenkontrollen", () => {
    expect(vorschlaege.filter((x) => x.gruppe === "Bäckerei")).toEqual(HYGIENE_BAECKEREI);
    expect(vorschlaege.filter((x) => x.gruppe === "Foodtruck / mobiler Verkauf")).toEqual(HYGIENE_FOODTRUCK);
    // neue Titel kommen sonst nicht vor (die App wählt Vorschläge über den Titel aus)
    for (const x of [...HYGIENE_BAECKEREI, ...HYGIENE_FOODTRUCK]) expect(vorschlaege.filter((y) => y.titel === x.titel), x.titel).toHaveLength(1);
    for (const x of [...HYGIENE_BAECKEREI, ...HYGIENE_FOODTRUCK]) {
      expect(HYGIENE_THEMEN_LEBENSMITTEL as readonly string[]).toContain(String(x.werte.thema));
      expect(x.quelle, x.titel).not.toMatch(/zu prüfen/);
      for (const w of Object.values(x.werte)) expect(String(w), x.titel).not.toMatch(/°C/);
    }
    expect(HYGIENE_BAECKEREI.find((x) => x.titel.startsWith("Zutaten mit Allergenen"))!.werte.thema).toBe("Allergenmanagement");
    expect(HYGIENE_BAECKEREI.find((x) => x.titel === "Kühlraum und Kühltheke für Konditoreiwaren")!.werte.wie).toContain(GRENZWERT_HACCP);
    const t = JSON.stringify(HYGIENE_BAECKEREI);
    for (const s of ["Sahne nur aus pasteurisierter Ware, Restsahne täglich entsorgen", "auf Schimmel prüfen", "Mehlsäcke nach Anbruch verschlossen lagern", "Einmalhandschuhe ersetzen das Händewaschen nicht"]) expect(t, s).toContain(s);
  });
  it("Foodtruck: Wasser im Fahrzeug, Handwaschgelegenheit, Kühlung unterwegs, Abfall/Abwasser, Standplatzwechsel", () => {
    const t = JSON.stringify(HYGIENE_FOODTRUCK);
    for (const s of ["Wassertank", "§ 11 Abs. 2 TrinkwV", "Handwaschbecken mit fließendem warmem und kaltem Wasser", "Kühlung unterwegs", "Abfall und Abwasser", "Standplatzwechsel", "Anhang II Kap. III"]) expect(t, s).toContain(s);
    // Prüfbericht Lebensmittelhygiene (L-116, L-117, L-119, L-120)
    for (const s of ["Eiswürfel und Wasser für Lebensmittel nur aus Trinkwasser", "ohne Handwaschbecken mit Warmwasser kein Umgang mit rohem Fleisch", "Nr. 1.1.8", "nicht in den Abwassertank", "Abstand zu Abfallcontainern, keine Tiere", "Tank nach Saisonende leer und trocken lagern"]) expect(t, s).toContain(s);
  });
  it("Café mit Backstube: Plan ohne Beauty-Hinweis, nach Themenbereichen geordnet", () => {
    const eintraege = [...aus("hygieneplan", "eintraege", ["Gastronomie / Café", "Bäckerei", "Foodtruck / mobiler Verkauf"])];
    const d: Daten = { art: "lebensmittel", bereich: "Backstube und Verkauf", erstellt_von: "Mara Lindner", datum: "2026-10-22", eintraege };
    expect(v("hygieneplan").hinweise!(d, B)).toEqual([]);
    const h = html("hygieneplan", d);
    expect(h).toContain("Sahneautomat, Spritzbeutel und Tüllen");
    expect(h).toContain("Handwaschgelegenheit im Fahrzeug");
    expect(h).not.toContain("Hygieneverordnung des Landes");
  });
});

describe("Branchengruppen: Foodtruck und Praxis", () => {
  it("mobiler Verkauf aus Reisegewerbe, Marktstand oder Name – nur mit Lebensmitteln", () => {
    expect(mobilerVerkauf({ "taetigkeit.branchen": ["gastronomie_lebensmittel"], "erlaubnis.gewo_paragraphen": ["55"] })).toBe(true);
    expect(mobilerVerkauf({ "taetigkeit.branchen": ["gastronomie_lebensmittel"], "vertrieb.kanaele": ["marktstand"] })).toBe(true);
    expect(mobilerVerkauf({ "taetigkeit.branchen": ["gastronomie_lebensmittel"] }, "Burger Foodtruck Kim")).toBe(true);
    expect(mobilerVerkauf({ "taetigkeit.branchen": ["gastronomie_lebensmittel"] }, "Café Morgenrot")).toBe(false);
    expect(mobilerVerkauf({ "taetigkeit.branchen": ["handwerk"], "vertrieb.kanaele": ["marktstand"] })).toBe(false);
  });
  it("Praxis / Gesundheit: Gefährdungen mit BioStoffV und TRBA 250, Röntgen nur als Hinweis; Unterweisungsthemen", () => {
    expect(gruppenFuerBetrieb(["gesundheit_pflege"])).toEqual(["praxis"]);
    const gb = liste("gefaehrdungsbeurteilung", "gefaehrdungen").vorschlaege!.filter((x) => x.gruppe === "Praxis / Gesundheit");
    // E-167: dazu vier Gefährdungen aus der Sifa-Durchsicht (Gewalt, Laser, Narkosegase, Mutterschutz bei Biostoffen)
    expect(gb.length).toBe(9);
    const t = JSON.stringify(gb);
    for (const s of ["TRBA 250", "§ 11 Abs. 3 BioStoffV", "Abwurfbehälter", "TRGS 525", "TRGS 401", "Strahlenschutz"]) expect(t, s).toContain(s);
    // E-167: Prüfstand der Durchsicht – nur „offen“ behält „fachlich zu prüfen“. E-202: die Fachkraft für Arbeitssicherheit
    // hat 40 der 41 Bausteine bestätigt – nur B-105 (Nadelstichverletzungen, arbeitsmedizinisch) bleibt markiert
    expect(gb.find((x) => /Röntgen/.test(x.titel))!.quelle).toMatch(/StrlSchV/);
    expect(gb.filter((x) => /fachlich zu prüfen$/.test(x.quelle ?? "")).map((x) => x.titel.slice(0, 20))).toEqual(["Stich- und Schnittve"]);
    const themen = (feld("unterweisung", "themen") as { optionen: Option[] }).optionen.filter((o) => o.gruppen?.includes("praxis"));
    expect(themen.map((o) => o.wert)).toEqual(["praxis_biostoffe", "praxis_nadelstich", "praxis_desinfektion"]);
  });
});
