/**
 * Nachprüfung der Vorlagen (23.10.2026, docs/pruefberichte/2026-10-23-rueckmeldungen-runde-nachpruefung.json): Änderungen
 * nach Steuerberater (8 Vorlagen), Sifa (4 Vorlagen, 14 Baustein-Anmerkungen, Hinweise zum Hygieneplan) und Rechtsanwalt
 * (Handelsregister für OHG/KG).
 */
import { describe, expect, it } from "vitest";
import {
  BILANZ_ANHANG, BILANZ_OHNE_ANHANG, BIO_SCHUTZSTUFE_BLUT, HR_ALLE_MELDEN, HR_HAFTEINLAGE, KASSENBUCH_BESTAND_NEGATIV, KASSENBUCH_NEGATIV, KASSENBUCH_REGELN, OSS_KORREKTUR, OSS_LIEFERSCHWELLE,
  PRUEF_VORSCHLAEGE, UST_OHNE_IGE, ZM_ZEITRAUM, dokumentHtml, fehlendeAngaben, hautschutzFriseur, leereDaten, naechstePruefung, vorlageFuer, type Betrieb, type Daten, type ListenFeld,
} from "../src/index.js";
import { HYGIENE } from "../src/dokumente/bausteine.js";

const B: Betrieb = { name: "Muster", strasse: "Weg 2", plz: "72764", ort: "Reutlingen", verantwortlich: "Ole Holm", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Baden-Württemberg" };
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ");
const html = (id: string, d: Daten, b: Betrieb = B) => glatt(dokumentHtml(vorlageFuer(id)!, d, b));
const leer = (id: string, b: Betrieb = B) => glatt(dokumentHtml(vorlageFuer(id)!, leereDaten(vorlageFuer(id)!, b, "2026-10-23"), b));
const feld = (id: string, f: string) => vorlageFuer(id)!.abschnitte.flatMap((a) => a.felder).find((x) => x.id === f);
const vorschlaege = (id: string, f: string) => (feld(id, f) as ListenFeld).vorschlaege ?? [];

describe("Steuerberater: Bilanz und GuV", () => {
  it("Anhang nur bei Kapitalgesellschaft und GmbH & Co. KG; OHG, KG und e. K. ohne Anhang", () => {
    expect(html("bilanz_guv", { kleinst: false }, { ...B, rechtsform: "GmbH" })).toContain(BILANZ_ANHANG);
    expect(html("bilanz_guv", { kleinst: false }, { ...B, name: "Muster GmbH & Co. KG", rechtsform: "GmbH & Co. KG" })).toContain(BILANZ_ANHANG);
    for (const rf of ["OHG", "KG", "e. K."]) {
      const h = html("bilanz_guv", {}, { ...B, rechtsform: rf });
      expect(h, rf).not.toContain("Zum Jahresabschluss gehört ein Anhang");
      expect(h, rf).toContain(BILANZ_OHNE_ANHANG);
    }
  });
  it("Unterschrift nach Rechtsform (§ 245 HGB) und Rechtsgrundlage §§ 264, 266, 275 HGB nur bei Kapitalgesellschaften", () => {
    expect(html("bilanz_guv", {}, { ...B, rechtsform: "OHG", vertretung: "Anna Berg, Ben Kurz" })).toContain("allen persönlich haftenden Gesellschaftern (§ 245 HGB)");
    expect(html("bilanz_guv", {}, { ...B, rechtsform: "e. K." })).toContain("der Kauffrau bzw. dem Kaufmann (§ 245 HGB)");
    const v = vorlageFuer("bilanz_guv")!;
    expect(v.grundlageFuer!({}, { ...B, rechtsform: "GmbH" })).toBe("§§ 238, 242, 245, 264, 266, 275 HGB; § 5b EStG");
    expect(html("bilanz_guv", {}, { ...B, rechtsform: "KG" })).toContain("<dd>§§ 238, 242, 245 HGB; § 5b EStG</dd>");
    expect(v.pruefen!({}, { ...B, rechtsform: "KG" })[0]).toMatch(/Persönlich haftende Gesellschafter/);
  });
});

describe("Steuerberater: Umsatzsteuer-Voranmeldung – innergemeinschaftliche Erwerbe", () => {
  it("Kz 89/93 mit Steuer aus vollen Euro, Vorsteuer Kz 61, Zahllast", () => {
    const v = vorlageFuer("ust_voranmeldung")!;
    const d: Daten = { zeitraum: "Oktober 2026", umsatz_19: "1.000,00", vorsteuer: "0", ige_19: "500,50", ige_7: "100,00", vorsteuer_ige: "102,00" };
    const h = html("ust_voranmeldung", d);
    expect(h).toContain("<h2>Innergemeinschaftliche Erwerbe</h2>");
    expect(h).toMatch(/<span>89<\/span><\/td><th>Steuerpflichtige innergemeinschaftliche Erwerbe zum Steuersatz 19 %/);
    expect(h).toMatch(/<span>61<\/span><\/td><th>Vorsteuerbeträge aus dem innergemeinschaftlichen Erwerb/);
    expect(h).not.toContain(UST_OHNE_IGE);
    // ELSTER: 190 + 95 (500 € × 19 %) + 7 (100 € × 7 %) − 102 = 190; aus Cent-Beträgen 95,10 statt 95,00
    expect(v.ergebnis!(d).find(([k]) => k === "Zahllast")![1]).toMatch(/^190,10\s€$/);
    expect(v.ergebnis!(d).find(([k]) => k.startsWith("Zahllast laut ELSTER"))![1]).toMatch(/^190,00\s€$/);
  });
  it("ohne Erwerbe: ausdrücklicher Hinweis, dass sie nicht enthalten sind", () => {
    expect(leer("ust_voranmeldung")).toContain(UST_OHNE_IGE);
  });
});

describe("Steuerberater: OSS, ZM, Steuererklärung, Kassenbuch, Aufbewahrung, Personalfragebogen", () => {
  it("OSS: Lieferschwelle im Wortlaut, Korrekturen früherer Quartale; Hinweis bei negativen Beträgen", () => {
    const h = leer("oss_meldung");
    expect(h).toContain(OSS_LIEFERSCHWELLE);
    expect(h).toContain(OSS_KORREKTUR);
    expect(h).not.toContain("im Vorjahr und im laufenden Jahr zusammen");
    expect(vorlageFuer("oss_meldung")!.hinweise!({ umsaetze: [{ land: "AT", satz: "20", netto: "-50,00" }] }, B)).toEqual([OSS_KORREKTUR]);
  });
  it("ZM: Meldezeitraum nach § 18a Abs. 1 Satz 2 UStG mit laufendem Quartal", () => {
    expect(leer("zm_meldung")).toContain(ZM_ZEITRAUM);
    expect(ZM_ZEITRAUM).toContain("weder im laufenden noch in einem der vier vorangegangenen Quartale");
  });
  it("Steuererklärung: Vorauszahlungen je Steuerart getrennt, keine Summe über Steuerarten", () => {
    const h = html("steuererklaerung", { jahr: "2026", vorauszahlungen: [{ steuerart: "est", art: "Q1", betrag: "100" }, { steuerart: "gewst", art: "Q1", betrag: "50" }, { steuerart: "est", art: "Q2", betrag: "100" }] });
    expect(h).toMatch(/Summe Einkommensteuer<\/th><td class="zahl">200,00 €/);
    expect(h).toMatch(/Summe Gewerbesteuer<\/th><td class="zahl">50,00 €/);
    expect(h).toContain("<td>Einkommensteuer Q1</td>");
    expect(h).not.toContain("250,00 €");
  });
  it("Kassenbuch: Regeln im Dokument, Hinweise bei negativem Betrag und negativem Bestand", () => {
    expect(leer("kassenbuch")).toContain(KASSENBUCH_REGELN);
    expect(KASSENBUCH_REGELN).toContain("§ 146 Abs. 1 Satz 2 AO");
    const v = vorlageFuer("kassenbuch")!;
    expect(v.hinweise!({ anfang: "10", eintraege: [{ text: "Korrektur", einnahme: "-5" }] }, B)).toEqual([KASSENBUCH_NEGATIV]);
    expect(v.hinweise!({ anfang: "10", eintraege: [{ text: "Einkauf", ausgabe: "20" }] }, B)).toEqual([KASSENBUCH_BESTAND_NEGATIV]);
    expect(v.hinweise!({ anfang: "10", eintraege: [{ text: "Einkauf", ausgabe: "5" }] }, B)).toEqual([]);
  });
  it("Aufbewahrungsplan: „aufgestellt“ statt „festgestellt“ (§ 147 Abs. 4 AO)", () => {
    const h = leer("aufbewahrung");
    expect(h).toContain("der Jahresabschluss aufgestellt");
    expect(h).not.toContain("festgestellt");
  });
  it("Personalfragebogen: Geschlecht, Tätigkeit nach KldB 2010, Arbeitnehmerüberlassung, RV-Befreiung im Minijob", () => {
    const l = leer("sv_meldedaten");
    expect(l).toContain("<th>Geschlecht</th>");
    expect(l).toContain("Tätigkeit nach KldB 2010, fünfstellig (trägt der Arbeitgeber ein)");
    expect(l).toContain("Arbeitnehmerüberlassung (trägt der Arbeitgeber ein)");
    expect(l).toContain("Befreiung von der Rentenversicherungspflicht beantragt (§ 6 Abs. 1b SGB VI)");
    const h = html("sv_meldedaten", { name: "Kim", geschlecht: "W", art: "minijob", kldb: "82312", ueberlassung: "1", rv_befreiung: "befreit" });
    expect(h).toContain("<td class=\"wert\">weiblich</td>");
    expect(h).toContain("<td class=\"wert\">82312</td>");
    expect(h).toContain("1 – nein");
    expect(html("sv_meldedaten", { name: "Kim", art: "vollzeit" })).not.toContain("Rentenversicherung</th>");
    const v = vorlageFuer("sv_meldedaten")!;
    expect(v.pruefen!({ kldb: "8231" }, B)[0]).toMatch(/fünf Ziffern/);
    expect(fehlendeAngaben(v, { art: "minijob" })).toContain("Rentenversicherung im Minijob");
  });
});

describe("Sifa: Vorlagen", () => {
  it("Betriebsanweisung: Piktogramme nur als Text, ohne Raute; B-240 und B-241 im Wortlaut des Prüfers", () => {
    const h = html("betriebsanweisung", { piktogramme: ["GHS02", "GHS05"] });
    expect(h).toContain('<span class="ghs-eintrag">GHS02 Flamme</span>');
    expect(h).not.toContain('class="ghs"');
    const b = (feld("betriebsanweisung", "beschraenkung") as { vorschlaege: string[] }).vorschlaege;
    expect(b[0]).toBe("Jugendliche dürfen mit diesem Stoff nur arbeiten, soweit dies zur Erreichung des Ausbildungsziels erforderlich ist, und unter Aufsicht einer fachkundigen Person (§ 22 Abs. 2 JArbSchG).");
    expect(b[1]).toBe("Schwangere und stillende Frauen dürfen mit diesem Stoff nicht arbeiten, soweit die Gefährdungsbeurteilung eine unverantwortbare Gefährdung ergibt (§ 11 MuSchG für Schwangere, § 12 MuSchG für Stillende).");
  });
  it("Betriebsanweisung Biostoffe: Schutzstufe ohne Vorbelegung (Pflicht), TRBA 250 im Hilfetext, Hinweis bei Blutkontakt und Stufe 1; B-283, B-284", () => {
    const v = vorlageFuer("betriebsanweisung_biostoffe")!;
    const s = feld("betriebsanweisung_biostoffe", "schutzstufe")!;
    expect(leereDaten(v, B, "2026-10-23").schutzstufe).toBeNull();
    expect(s.pflicht).toBe(true);
    expect(s.hilfe).toMatch(/TRBA 250.*mindestens Schutzstufe 2/);
    expect(v.hinweise!({ taetigkeit: "Blutentnahme und Injektionen", schutzstufe: "1" }, B)).toEqual([BIO_SCHUTZSTUFE_BLUT]);
    expect(v.hinweise!({ taetigkeit: "Blutentnahme und Injektionen", schutzstufe: "2" }, B)).toEqual([]);
    expect((feld("betriebsanweisung_biostoffe", "vorsorge") as { vorschlaege: string[] }).vorschlaege).toEqual(["Arbeitsmedizinische Vorsorge nach ArbMedVV Anhang Teil 2 beim Betriebsarzt; Impfungen (z. B. Hepatitis B) werden angeboten, soweit tätigkeitsbedingt erforderlich."]);
    const beschr = (feld("betriebsanweisung_biostoffe", "beschraenkung") as { vorschlaege: string[] }).vorschlaege;
    expect(beschr.some((x) => x.includes("mit diesem Stoff"))).toBe(false);
    expect(beschr).toHaveLength(1);
  });
  it("Expositionsverzeichnis: Geburtsdatum, Stoffkennung, Methode und Maßstab, Fußtext mit 5 Jahren und ZED", () => {
    const h = html("expositionsverzeichnis", { eintraege: [{ name: "Ole Holm", geburtsdatum: "1990-05-01", taetigkeit: "Schleifen", stoff: "Hartholzstaub", kennung: "Tätigkeit nach TRGS 906", kategorie: "k", hoehe: "unter 2 mg/m³", von: "2024-03-01", dauer: "4 h/Woche" }] });
    expect(h).toContain("geb. 01.05.1990");
    expect(h).toContain("Tätigkeit nach TRGS 906");
    expect(h).toContain("bei ausschließlich reproduktionstoxischen Stoffen 5 Jahre nach Ende der Exposition; Abgabe an die ZED möglich (§ 10a Abs. 2, 3 GefStoffV)");
    const eintraege = feld("expositionsverzeichnis", "eintraege") as ListenFeld;
    expect(eintraege.felder.find((x) => x.id === "hoehe")!.hilfe).toMatch(/Ermittlungsmethode und Beurteilungsmaßstab/);
    expect(eintraege.felder.find((x) => x.id === "kennung")!.pflicht).toBe(true);
  });
  it("Hautschutzplan: TRGS 530 nur beim Bereich Friseur; B-286 Acrylate", () => {
    expect(leer("hautschutzplan")).toContain("<dd>TRGS 401</dd>");
    expect(html("hautschutzplan", { bereich: "Nagelstudio" })).toContain("<dd>TRGS 401</dd>");
    expect(html("hautschutzplan", { bereich: "Friseursalon" })).toContain("<dd>TRGS 401; TRGS 530</dd>");
    const friseurZeile = vorschlaege("hautschutzplan", "eintraege").find((x) => x.gruppe === "Friseur")!;
    expect(hautschutzFriseur({ bereich: "Salon", eintraege: [{ anlass: friseurZeile.titel }] })).toBe(true);
    const nagel = vorschlaege("hautschutzplan", "eintraege").find((x) => x.titel.startsWith("Nagelmodellage"))!;
    expect(nagel.werte!.handschuhe).toMatch(/nach direktem Kontakt mit Acrylaten sofort/);
  });
  it("Hygieneplan (Beauty): Durchgangsarzt statt Hausarzt, HIV-PEP möglichst innerhalb von 2 Stunden (seit Rechtsanwalt Runde 3 mit Obergrenze)", () => {
    const z = HYGIENE.find((x) => x.titel === "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person")!;
    expect(z.werte!.wie).toContain("sofort Durchgangsarzt bzw. Betriebsarzt aufsuchen – eine HIV-Postexpositionsprophylaxe sollte möglichst innerhalb von 2 Stunden beginnen");
    expect(z.werte!.wie).not.toContain("Hausarzt");
  });
});

describe("Sifa: Bausteine der Gefährdungsbeurteilung", () => {
  const gef = vorschlaege("gefaehrdungsbeurteilung", "gefaehrdungen");
  it("DGUV Regel 110-010 statt DGUV Vorschrift 79 (B-054, B-200, B-233); TRBA 220 gestrichen (B-218)", () => {
    for (const x of [...gef, ...PRUEF_VORSCHLAEGE]) expect(x.quelle ?? "", x.titel).not.toContain("DGUV Vorschrift 79");
    expect(gef.find((x) => x.titel.startsWith("Brand- und Explosionsgefahr durch Druckgasflaschen"))!.quelle).toContain("DGUV Regel 110-010");
    expect(gef.find((x) => x.titel.startsWith("Gasgeräte und Flüssiggas"))!.quelle).toContain("DGUV Regel 110-010");
    expect(gef.find((x) => x.titel === "Biostoffe in Sanitärbereichen.")!.quelle).not.toContain("TRBA 220");
    const gas = PRUEF_VORSCHLAEGE.find((x) => x.titel === "Flüssiggasanlage und Gasgeräte")!;
    expect(gas.werte!.befaehigt).toBe("befähigte Person");
  });
  it("Fristen „mindestens jährlich“ (B-231, B-236, B-238) mit Terminvorschlag nach 12 Monaten; Tabelle 1B vollständig (B-226)", () => {
    for (const t of ["Regale und Lagereinrichtungen", "Hebebühne", "Firmenfahrzeuge"]) expect(PRUEF_VORSCHLAEGE.find((x) => x.titel === t)!.werte!.frist, t).toBe("mindestens jährlich");
    expect(naechstePruefung("2026-01-15", "mindestens jährlich")).toBe("15.01.2027");
    expect(naechstePruefung("2026-01-15", "Richtwert 6 Monate, in Büros höchstens 2 Jahre bei Fehlerquote unter 2 %; Werkstätten und ähnliche Bedingungen höchstens 1 Jahr; Baustellen Richtwert 3 Monate, höchstens 1 Jahr")).toBe("15.07.2026");
    expect(PRUEF_VORSCHLAEGE.find((x) => x.titel.startsWith("Ortsveränderliche"))!.werte!.frist).toContain("Werkstätten und ähnliche Bedingungen höchstens 1 Jahr; Baustellen Richtwert 3 Monate, höchstens 1 Jahr");
  });
});

describe("Rechtsanwalt: Handelsregister für OHG und KG", () => {
  it("KG: Kommanditisten mit Hafteinlage, Vertretungsregelung der Gesellschafter, alle Gesellschafter melden an", () => {
    const d: Daten = { rechtsform: "KG", firma: "Muster KG", gesellschafter: [{ name: "Anna Berg", geburtsdatum: "1980-01-01", wohnort: "Ulm", stellung: "phg" }, { name: "Ben Kurz", geburtsdatum: "1985-02-02", wohnort: "Ulm", stellung: "kommandit", hafteinlage: "10.000" }], vertretung: "Anna Berg vertritt allein." };
    const h = html("handelsregister", d);
    expect(h).toContain(HR_ALLE_MELDEN);
    expect(h).toContain("<th>Stellung, Hafteinlage</th>");
    expect(h).toContain("Kommanditist/in, Hafteinlage 10.000,00 €");
    expect(h).toMatch(/Vertretungsregelung der Gesellschafter<\/h2>/);
    expect(h).not.toContain("<h2>Geschäftsführung");
    const v = vorlageFuer("handelsregister")!;
    expect(fehlendeAngaben(v, d)).not.toContain("mindestens ein Eintrag „Person“");
    expect(v.pruefen!({ ...d, gesellschafter: [{ name: "Ben Kurz", stellung: "kommandit" }] }, B)).toEqual([HR_HAFTEINLAGE]);
  });
  it("OHG leer: Gesellschafter und Vertretungsregelung als Zeilen; GmbH unverändert mit Geschäftsführung", () => {
    const o = leer("handelsregister", { ...B, rechtsform: "OHG" });
    expect(o).toContain("<h2>Gesellschafter</h2>");
    expect(o).toMatch(/Vertretungsregelung der Gesellschafter<\/h2>/);
    expect(o).toContain(HR_ALLE_MELDEN);
    const g = leer("handelsregister", { ...B, rechtsform: "GmbH" });
    expect(g).toContain("<h2>Geschäftsführung</h2>");
    expect(g).not.toContain(HR_ALLE_MELDEN);
    expect(fehlendeAngaben(vorlageFuer("handelsregister")!, { rechtsform: "GmbH" })).toContain("mindestens ein Eintrag „Person“");
  });
});
