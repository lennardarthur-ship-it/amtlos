/**
 * Gestaltungsbefunde der Sichtprüfung (E-130): Seitenumbrüche, Satzspiegel, DIN-5008-Brief, Inhalte. Das Layout selbst
 * misst apps/mobile/werkzeuge/dokumente-pruefen.mjs mit Chromium; hier wird geprüft, dass das HTML die Regeln trägt.
 */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, RAENDER, dokumentHtml, leereDaten, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";
import { festeLeerzeichen, ibanText, schlussZusammen, unterschriften } from "../src/dokumente/html.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", verantwortlich: "Alex Sonnberg", telefon: "089 123456", email: "hallo@salon-sonne.example", steuernummer: "143/123/45678", iban: "DE89370400440532013000", bic: "COBADEFFXXX", bank: "Beispielbank", bundesland: "Bayern" };
const HEUTE = "2026-10-13";
const html = (id: string, d: Daten = {}, b = B) => {
  const v = vorlageFuer(id)!;
  return dokumentHtml(v, { ...leereDaten(v, b, HEUTE), ...d }, b);
};
const RECHNUNG = { nummer: "2026-047", kunde_name: "Studio Nord GmbH", kunde_anschrift: "Leopoldstraße 20\n80802 München", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis: "58,82", satz: "19" }] };

describe("Satzspiegel und Seitenumbrüche", () => {
  it("hält Unterschriften mit dem kurzen Text bzw. der letzten Tabellenzeile davor zusammen", () => {
    const u = unterschriften(["Unterschrift"]);
    expect(schlussZusammen(`<section class="abschnitt"><h2>A</h2><table class="liste"><tbody><tr><td>x</td></tr></tbody></table></section><p>Ich versichere …</p>${u}`)).toMatch(/<\/section><div class="schlussblock"><p>Ich versichere …<\/p><div class="unterschriften/);
    const t = schlussZusammen(`<section class="abschnitt"><h2>A</h2><table class="liste"><colgroup><col></colgroup><thead><tr><th>N</th></tr></thead><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table></section>${u}`);
    // die letzte Zeile kommt in eine eigene Zeilengruppe derselben Tabelle (Kopf wiederholt sich auf der neuen Seite)
    expect(t).toContain('<tbody><tr><td>1</td></tr></tbody><tbody class="schluss"><tr><td>2</td></tr></tbody></table></section><div class="schlussblock nach-tabelle"><div class="unterschriften');
    // mit Summenzeile (Kassenbuch): letzte Zeile und tfoot bleiben beim Schlussblock
    const k = schlussZusammen(`<table class="liste"><thead><tr><th>N</th></tr></thead><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody><tfoot><tr class="summe"><td>S</td></tr></tfoot></table>${u}`);
    expect(k).toContain('<tbody><tr><td>1</td></tr></tbody><tbody class="schluss"><tr><td>2</td></tr></tbody><tfoot><tr class="summe"><td>S</td></tr></tfoot></table><div class="schlussblock nach-tabelle">');
    // Personalfragebogen: die Erklärung steht mit der Unterschrift, nicht allein auf der Seite davor
    // (entweder im Schlussblock oder gemeinsam in einem Block „zusammen“)
    expect(html("sv_meldedaten", { name: "Lea Wagner" })).toMatch(/<div class="schlussblock"><p style="margin-top:6mm">Ich versichere|<div class="zusammen">(?:(?!<\/section>).)*Ich versichere(?:(?!<\/section>).)*<div class="unterschriften/s);
    expect(html("gefaehrdungsbeurteilung")).toMatch(/<div class="schlussblock"><section class="abschnitt zusammen[^"]*"><h2>Wirksamkeit und Fortschreibung/);
    expect(html("betriebsanweisung", { notruf: "Notruf 112" })).toMatch(/<div class="schlussblock"><div class="notruf">/);
  });

  it("CSS: Überschriften und Bilanz brechen nicht, Zahlenköpfe rechtsbündig, Querformat ohne Randspalten-Einzug der Unterschriften", () => {
    const h = html("bilanz_guv");
    expect(h).toContain("h2, h3 { page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }");
    expect(h).toContain("table.liste th.zahl, table.liste td.zahl { text-align: right; }");
    expect(h).toContain(".g-formular .bilanz { display: flex; gap: 8mm; page-break-inside: avoid; break-inside: avoid; }");
    expect(h).toContain(".g-nachweis:not(.quer) main:has(section.abschnitt) .unterschriften");
    expect(h).toContain("table.felder { font-size: 9.4pt; table-layout: fixed; }");
  });

  it("Bilanz: Aktiva und Passiva gleich lang, Summen mit Doppellinie; Verlust ohne doppeltes Minus", () => {
    const h = html("bilanz_guv", { aktiva: [{ posten: "Bank", betrag: "100,00" }], passiva: [{ posten: "Kapital", betrag: "60,00" }, { posten: "Gewinn", betrag: "40,00" }] });
    const tabellen = h.match(/<table class="liste doppelt">.*?<\/table>/gs)!;
    expect(tabellen).toHaveLength(2);
    expect(tabellen.map((t) => (t.match(/<tbody>.*<\/tbody>/s)![0].match(/<tr>/g) ?? []).length)).toEqual([2, 2]);
    const e = html("euer", { jahr: "2026", einnahmen: [{ text: "Umsatz", betrag: "100,00" }], ausgaben: [{ text: "Miete", betrag: "300,00" }] });
    expect(e).toMatch(/Verlust<small>[^<]*<\/small><\/th><td class="zahl">200,00\u00a0€/);
  });
});

describe("Brief nach DIN 5008", () => {
  it("Informationsblock im Fluss bis 200 mm: rechter Druckrand 10 mm, Text über das Padding bis 190 mm", () => {
    expect(RAENDER.brief).toEqual([12, 10, 30, 20]);
    const h = html("rechnung", RECHNUNG);
    expect(h).toContain("body.g-brief { padding-left: 5mm; padding-right: 10mm; }");
    expect(h).toContain(".g-brief .info { flex: none; margin: 5mm 0 0 15mm; width: 75mm;");
  });

  it("lange Anschrift wird kleiner gesetzt statt den Betreff zu überdecken, nie gekürzt", () => {
    const lang = "Abteilung Rechnungsprüfung und Kreditorenbuchhaltung\nz. Hd. Frau Dr. Maximiliane-Sophie Großmann-Überlinger\nKönig-Ludwig-Straße 1234a, Hinterhaus, 4. Obergeschoss\n82467 Garmisch-Partenkirchen";
    const h = html("rechnung", { ...RECHNUNG, kunde_name: "Müller-Lüdenscheidt Haar- und Kosmetikmanufaktur Großraum Süd GmbH & Co. KG", kunde_anschrift: lang });
    expect(h).toContain('<div class="empf enger">');
    expect(h).toContain("82467 Garmisch-Partenkirchen");
    expect(html("rechnung", RECHNUNG)).toContain('<div class="empf">');
  });

  it("Rücksendeangabe: zu lang → Name und Ort", () => {
    const b = { ...B, name: "Müller-Lüdenscheidt Haar- und Kosmetikmanufaktur Süd GmbH", strasse: "Prinzregentenstraße 123a, Hinterhaus" };
    expect(html("rechnung", RECHNUNG, b)).toContain('<div class="ruecksendung">Müller-Lüdenscheidt Haar- und Kosmetikmanufaktur Süd GmbH · München</div>');
  });

  it("Inhalte: IBAN in Vierergruppen, Leistungszeitraum einmal, Reverse Charge benannt, Storno ohne Zahlungshinweis", () => {
    expect(ibanText("DE89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
    expect(ibanText("keine IBAN")).toBe("keine IBAN");
    const h = html("rechnung", { ...RECHNUNG, leistung_gleich: false, leistung: "06.10.2026 – 09.10.2026" });
    expect(h).toContain("IBAN DE89 3704 0044 0532 0130 00");
    expect(h.match(/06\.10\.2026 – 09\.10\.2026/g)).toHaveLength(1);
    const rc = html("rechnung", { ...RECHNUNG, hinweise: ["reverse_charge"], positionen: [{ bezeichnung: "Schulung", menge: "1", einheit: "", preis: "100,00", satz: "0" }] }, { ...B, ust_idnr: "DE123456789" });
    expect(rc).toContain("Umsatzsteuer 0&nbsp;% (Steuerschuldnerschaft des Leistungsempfängers) auf 100,00");
    const storno = html("rechnung", { ...RECHNUNG, storno_zu: "2026-046", hinweis: "Vielen Dank für Ihren Auftrag.\nBitte geben Sie bei der Zahlung die Rechnungsnummer an." });
    expect(storno).toContain("Vielen Dank für Ihren Auftrag.");
    expect(storno).not.toContain("Bitte geben Sie bei der Zahlung");
  });
});

describe("weitere Vorlagen", () => {
  it("AVV: der Ort steht bei der eigenen Unterschrift", () => {
    const h = html("avv", { ort_datum: "München" });
    expect(h.match(/<b>München,<\/b>/g)).toHaveLength(1);
    expect(h).toMatch(/<b>München,<\/b><\/div><span>Ort, Datum<\/span><div class="linie"><\/div><span>Auftraggeber/);
    expect(html("avv", { ort_datum: "München", rolle: "dienstleister" })).toMatch(/<b>München,<\/b><\/div><span>Ort, Datum<\/span><div class="linie"><\/div><span>Auftragnehmer/);
  });

  it("Datenpanne: ohne Uhrzeit keine erfundene „00:00 Uhr“", () => {
    const h = html("datenpanne", { entdeckt_am: "2026-10-13", entdeckt_um: "" });
    expect(h).not.toContain("00:00 Uhr");
    expect(h).toContain("16.10.2026, zur Uhrzeit des Bekanntwerdens (Uhrzeit ergänzen)");
    expect(html("datenpanne", { entdeckt_am: "2026-10-13", entdeckt_um: "10:45" })).toContain("16.10.2026, 10:45 Uhr");
  });

  it("Lohnkonto: Beträge rechtsbündig mit Summenzeile", () => {
    const h = html("lohnkonto", { monate: [{ monat: "Januar 2026", zahltag: "2026-01-28", brutto: "2.650,00" }] });
    expect(h).toContain('<td class="zahl">2.650,00\u00a0€</td>');
    expect(h).toMatch(/<tfoot><tr class="summe"><td><strong>Summe<\/strong><\/td>/);
  });

  it("Allergenliste als Matrix mit allen 14 Allergenen; IfSG-Lebensmittel einmal nummeriert", () => {
    const h = html("allergene", { gerichte: [{ name: "Käsekuchen", kategorie: "Kuchen", allergene: ["gluten", "eier", "milch"] }, { name: "Wasser", kategorie: "Getränke", allergene: [], keine: true }] });
    expect(h.match(/<th class="dreh">/g)).toHaveLength(14);
    expect(h.match(/<td class="x">×<\/td>/g)).toHaveLength(3);
    expect(h).toContain("keines der 14 Hauptallergene");
    // je Kategorie eine Zeilengruppe; SO₂ in der Erläuterung tiefgestellt
    expect(h.match(/<tbody class="gruppe-block"><tr class="gruppe">/g)).toHaveLength(2);
    expect(h).toContain("SO₂");
    const i = html("ifsg_belehrung");
    expect(i).toContain('<ol class="nummern"><li>Fleisch, Geflügelfleisch und Erzeugnisse daraus</li>');
    expect(i).not.toMatch(/<li>\d+\. /);
  });

  it("feste Leerzeichen bei Paragraf, Artikel, Gesetz, Einheit – nicht in Tags, auch in Unterzeile und Kennungsleiste", () => {
    expect(festeLeerzeichen("(§ 43 Abs. 2) bei 121 °C, Art. 32 DSGVO, § 4 Abs. 1 DGUV Vorschrift 1, §§ 5 ArbSchG, Art. 6 Abs. 1 lit. b DSGVO, § 28a SGB IV, 19 %")).toBe(
      "(§&nbsp;43 Abs.&nbsp;2) bei 121&nbsp;°C, Art.&nbsp;32&nbsp;DSGVO, §&nbsp;4 Abs.&nbsp;1 DGUV&nbsp;Vorschrift&nbsp;1, §§&nbsp;5&nbsp;ArbSchG, Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b&nbsp;DSGVO, §&nbsp;28a&nbsp;SGB&nbsp;IV, 19&nbsp;%",
    );
    expect(festeLeerzeichen('<span title="§ 43 AO">Nr. und § und</span>')).toBe('<span title="§ 43 AO">Nr. und § und</span>');
    const h = html("ifsg_belehrung");
    expect(h).toContain('<p class="unter">Belehrung durch den Arbeitgeber (§&nbsp;43 Abs.&nbsp;4&nbsp;IfSG)</p>');
    expect(h).toContain("<h1>Belehrung nach §&nbsp;43 Infektionsschutzgesetz</h1>");
    expect(h).toContain(".g-vertrag p, .g-vertrag li { text-align: left; }");
  });

  it("leere Pläne und Listen drucken Tabellen zum Ausfüllen; Kopfangaben ohne „0“ und ohne Doppelung", () => {
    const hy = html("hygieneplan", { bereich: "Bereich 1", eintraege: [] });
    expect(hy).not.toContain("Noch keine Einträge.");
    expect(hy).not.toContain("<dt>Bereich</dt>");
    expect(hy.match(/<td>&nbsp;<\/td>/g)!.length).toBe(6 * 5);
    expect(html("hautschutzplan", { eintraege: [] })).toContain('<table class="liste hoch">');
    const ha = html("haccp", { punkte: [] });
    expect(ha).not.toContain("<dt>Kontrollpunkte</dt>");
    expect(html("gefahrstoffverzeichnis", { stoffe: [] })).not.toContain("Anzahl Gefahrstoffe");
    const g = html("gefaehrdungsbeurteilung", { gefaehrdungen: [], mitwirkung: "Fachkraft für Arbeitssicherheit.\nBetriebsarzt;" });
    expect(g).toContain("<th>Gefährdung</th><th>Risiko</th><th>Schutzmaßnahmen</th><th>Umsetzung</th>");
    expect(g).toContain("Fachkraft für Arbeitssicherheit, Betriebsarzt</td>");
    expect(html("pruefprotokoll_elektro", { geraete: [] }).match(/<td>&nbsp;<\/td>/g)!.length).toBe(7 * 6);
  });

  it("Betriebsanweisung: Notruf-Zeile auch ohne Angabe, kompakter Satz bei viel Text", () => {
    expect(html("betriebsanweisung", { notruf: "" })).toContain('<div class="notruf">Notruf 112 · Ersthelfer/in: <span class="fuellen"></span></div>');
    const lang = "Sehr lange Angabe mit vielen Wörtern, die im Aushang mehr als eine Zeile braucht und so weiter.\nZweite Zeile mit weiteren Angaben.";
    expect(html("betriebsanweisung", { gefahren: lang, schutz: lang, gefahrfall: lang, erste_hilfe: lang, entsorgung: lang })).toContain('<body class="g-aushang ba kompakt">');
  });

  it("Nachweis der Arbeitsbedingungen ohne Stunden: kein „an 5 Tagen“ als Bruchstück", () => {
    expect(html("nachweis_arbeitsbedingungen")).not.toContain("an 5 Tagen");
  });

  it("Randspalte: Bereiche wie „lit. b–g“ werden nicht am Strich umbrochen", () => {
    const v = vorlageFuer("datenschutz_dokumentation")!;
    const d = leereDaten(v, B, HEUTE);
    const h = dokumentHtml(v, { ...d, verarbeitungen: [{ bezeichnung: "Kundenkartei", zweck: "x", rechtsgrundlage: "y", betroffene: "z", datenarten: "a", loeschfrist: "b" }] }, B);
    expect(h).toMatch(/<span class="nb">[^<]*–[^<]*<\/span>/);
  });
});
