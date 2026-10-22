/** Befunde der Prüfung R10 zu den Vorlagen (ohne Rechnung und Buchhaltung): Platzhalter, Betrieb, Arbeitsschutz, Branchen, Recht. */
import { describe, expect, it } from "vitest";
import { BETRIEBSNAME_FEHLT, LEERER_BETRIEB, dokumentHtml, fehlendeAngaben, gruppenAusBranchen, leereDaten, minijobGrenzeAm, mindestlohnAm, passtZuGruppen, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";
import { richtwertMonate } from "../src/dokumente/arbeitsschutz.js";
import { tageImMonat } from "../src/dokumente/branchen.js";
import { rechtsgrundlageNeu } from "../src/dokumente/datenschutz.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Elektro Becker e.K.", strasse: "Weg 1", plz: "79098", ort: "Freiburg", verantwortlich: "Jonas Becker", telefon: "0761 1", email: "info@example.de", bundesland: "Baden-Württemberg" };
const HEUTE = "2026-10-20";
const v = (id: string) => vorlageFuer(id)!;
const html = (id: string, d: Daten, b = B) => dokumentHtml(v(id), { ...leereDaten(v(id), b, HEUTE), ...d }, b);

describe("Platzhalter „…“ und fehlender Betrieb (Jonas #2, Lea #5, Mehmet #14, Sabine #15)", () => {
  it("meldet einen nicht ersetzten Platzhalter als fehlende Angabe", () => {
    const r = v("rechnung");
    const anrede = r.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "anrede");
    if (!anrede || anrede.art !== "text" || !anrede.vorschlaege?.some((x) => x.includes("…"))) return;
    const d = { ...leereDaten(r, B, HEUTE), anrede: "Guten Tag …" };
    expect(fehlendeAngaben(r, d, B)).toContain("Anrede: Name statt „…“ eintragen");
    expect(fehlendeAngaben(r, { ...d, anrede: "Guten Tag Frau Meier" }, B)).not.toContain("Anrede: Name statt „…“ eintragen");
  });
  it("sagt „Fast fertig: Name des Betriebs“, solange der Betrieb keinen Namen hat", () => {
    const a = v("allergene");
    const d = { ...leereDaten(a, LEERER_BETRIEB, HEUTE), gerichte: [{ name: "Apfelkuchen", allergene: ["gluten"], getreidearten: ["weizen"], keine: false }] };
    expect(fehlendeAngaben(a, d, LEERER_BETRIEB)).toEqual([BETRIEBSNAME_FEHLT]);
    expect(fehlendeAngaben(a, d, B)).toEqual([]);
    // Vorlagen, die den Namen schon selbst prüfen, melden ihn nicht doppelt
    expect(fehlendeAngaben(v("impressum"), leereDaten(v("impressum"), LEERER_BETRIEB, HEUTE), LEERER_BETRIEB).filter((x) => x.startsWith("Name"))).toHaveLength(1);
  });
});

describe("Branchengruppen (Sabine #10, Jonas #19)", () => {
  it("ordnet Branchen aus dem Check den Bausteinen zu", () => {
    expect(gruppenAusBranchen(["beauty_kosmetik"])).toEqual(["friseur", "kosmetik"]);
    expect(gruppenAusBranchen(["handwerk", "bau"])).toEqual(["handwerk_allgemein"]);
    expect(passtZuGruppen(["gastro_cafe"], ["friseur"])).toBe(false);
    expect(passtZuGruppen(["alle"], ["friseur"])).toBe(true);
    expect(passtZuGruppen(["gastro_cafe"], [])).toBe(true);
  });
  it("Unterweisungsthemen tragen Branchen, mit den fünf Sicherheitsregeln fürs Handwerk", () => {
    const themen = v("unterweisung").abschnitte[1]!.felder[0]!;
    if (themen.art !== "bausteine") throw new Error("Themen");
    expect(themen.optionen.find((o) => /Fritteusen/.test(o.text))?.gruppen).toEqual(["gastro_cafe"]);
    expect(themen.optionen.find((o) => /fünf Sicherheitsregeln/.test(o.text))?.gruppen).toEqual(["handwerk_allgemein"]);
  });
});

describe("Unterweisung mit Jugendlichen (Sabine #9 und Rechtsgrundlage)", () => {
  it("nennt § 29 JArbSchG im Kopf und den halbjährlichen Termin", () => {
    const h = html("unterweisung", { thema: "Erstunterweisung", datum: "2026-09-01", jugendliche: true });
    expect(h).toContain("§&nbsp;29 JArbSchG");
    expect(h).toContain("01.03.2027");
    expect(html("unterweisung", { thema: "x", datum: "2026-09-01" })).not.toContain("JArbSchG;");
  });
});

describe("Prüfprotokoll DGUV V3 (Jonas #7, #8)", () => {
  it("rechnet die nächste Prüfung aus dem Richtwert und druckt Messwerte und Prüfort", () => {
    expect(richtwertMonate("Baustellen: Richtwert 3 Monate, höchstens 1 Jahr")).toBe(3);
    expect(richtwertMonate("Elektrische Anlagen und ortsfeste Betriebsmittel: Richtwert 4 Jahre")).toBe(48);
    const h = html("pruefprotokoll_elektro", { pruefer: "Jonas Becker", datum: "2026-10-20", einsatz: "baustellen", auftraggeber: "Bauherr Müller, Freiburg", geraete: [{ bezeichnung: "Bohrhammer", schutzklasse: "I", rpe: "0,12", riso: "> 20", ipe: "0,05", ergebnis: "bestanden" }] });
    expect(h).toContain("20.01.2027");
    expect(h).toContain("0,12&nbsp;Ω");
    expect(h).toContain("Bauherr Müller, Freiburg");
    expect(h).toContain("DIN EN 50678");
  });
});

describe("Branchen (Sabine #11, Mehmet #13, #15, #20)", () => {
  it("Hautschutzplan: ein Blatt ohne Unterschriftsblock, Produkte in einer eigenen Zeile", () => {
    const h = html("hautschutzplan", { produkt_schutz: "Stokoderm", eintraege: [{ anlass: "Färben", schutz: "Hände eincremen" }] });
    expect(h).toContain('<tr class="produkte">');
    expect(h).toContain("<strong>Stokoderm</strong>");
    expect(h).not.toContain('class="unterschriften');
  });
  it("HACCP: Monatsraster mit den Tagen des Monats und den eigenen Kontrollpunkten", () => {
    expect(tageImMonat("Februar 2028")).toBe(29);
    expect(tageImMonat("11/2026")).toBe(30);
    expect(tageImMonat("irgendwann")).toBe(31);
    const h = html("haccp", { zeitraum: "November 2026", raster: true, raster_geraete: "Kühlschrank Küche\nTiefkühltruhe", punkte: [{ punkt: "Kühlschrank Küche", grenzwert: "max. +7 °C", korrektur: "x" }] });
    expect(h).toContain("Monatsraster · November 2026");
    expect(h).toContain('<th class="tag">30</th>');
    expect(h).not.toContain('<th class="tag">31</th>');
    expect(h).toContain("max. +7");
  });
  it("IfSG: Belehrung durch den Arbeitgeber, Hinweis bei alter Bescheinigung", () => {
    const i = v("ifsg_belehrung");
    expect(i.titel).toBe("Belehrung durch den Arbeitgeber (§ 43 IfSG)");
    const d = { teilnehmer: [{ name: "Neue Kraft", erstbelehrung_am: "2026-05-15", erster_arbeitstag: "2026-10-01", erstmals: true }] };
    expect(i.hinweise?.(d, B)[0]).toMatch(/älter als drei Monate/);
    expect(i.hinweise?.({ teilnehmer: [{ ...d.teilnehmer[0]!, erstmals: false }] }, B)).toEqual([]);
  });
  it("Allergene: welches Getreide, welche Nüsse", () => {
    // Prüfbericht Lebensmittelhygiene (Frage 9): Arten als Auswahl, in der Zeile „Enthält:“; ältere Listen mit Freitext
    // zeigen diesen, bis die Art gewählt ist
    const h = html("allergene", { gerichte: [{ name: "Nusskuchen", allergene: ["gluten", "schalenfruechte"], getreidearten: ["dinkel"], nussarten: ["haselnuesse"] }] });
    expect(h).toContain("Enthält: Weizen (Dinkel), Haselnüsse");
    const alt = html("allergene", { gerichte: [{ name: "Nusskuchen", allergene: ["gluten", "schalenfruechte"], getreide: "Dinkel", nuesse: "Haselnuss" }] });
    expect(alt).toContain("Enthält: Dinkel, Haselnuss");
  });
});

describe("Recht (Recht #12, #17, #18, #15)", () => {
  it("§ 26 BDSG ist keine Auswahl mehr; ältere Verzeichnisse drucken die neue Grundlage", () => {
    const f = v("datenschutz_dokumentation").abschnitte.flatMap((a) => a.felder).flatMap((x) => (x.art === "liste" ? x.felder : [x])).find((x) => x.id === "rechtsgrundlage");
    expect(f && f.art === "mehrzeilig" ? f.vorschlaege?.join() : "").not.toContain("26 BDSG");
    expect(rechtsgrundlageNeu("Art. 88 DSGVO i. V. m. § 26 BDSG (Beschäftigungsverhältnis)")).toBe("Art. 6 Abs. 1 lit. b und c DSGVO (Beschäftigungsverhältnis)");
  });
  it("Impressum: MStV nur auf Wahl, Kapital nur mit ausstehenden Einlagen", () => {
    expect(html("impressum", { redaktion: "Max Muster" })).not.toContain("MStV");
    expect(html("impressum", { redaktionell: true, redaktion: "Max Muster" })).toContain("MStV");
    const imp = v("impressum");
    const gmbh = { ...B, name: "Salon Sonne GmbH" };
    expect(fehlendeAngaben(imp, { ...leereDaten(imp, gmbh, HEUTE), rechtsform: "GmbH", kapital: "25.000 €" }, gmbh).some((x) => x.startsWith("Ausstehende Einlagen"))).toBe(true);
    expect(fehlendeAngaben(imp, { ...leereDaten(imp, gmbh, HEUTE), rechtsform: "GmbH", kapital: "25.000 €", ausstehend: "keine" }, gmbh).some((x) => x.startsWith("Ausstehende Einlagen"))).toBe(false);
    expect(html("impressum", {})).not.toContain("VSBG");
  });
  it("NachwG: Minijob-Grenze zum Ausstellungsdatum, Hinweis zur Form", () => {
    expect(minijobGrenzeAm("2025-08-25")).toBe(55600);
    expect(minijobGrenzeAm("2026-03-01")).toBe(60300);
    expect(mindestlohnAm("2025-08-25")).toBe(1282);
    const h = html("nachweis_arbeitsbedingungen", { minijob: true, entgelt_art: "monat", entgelt_betrag: "500", ausgestellt_am: "2025-08-25", beginn: "2025-09-01" });
    expect(h).toContain("556,00");
    expect(v("nachweis_arbeitsbedingungen").hinweise?.({}, B)[0]).toMatch(/Empfangsnachweis/);
  });
});
