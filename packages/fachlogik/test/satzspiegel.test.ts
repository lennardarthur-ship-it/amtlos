/**
 * Gestaltungsbefunde der Sichtprüfung (E-130): Seitenumbrüche, Satzspiegel, DIN-5008-Brief, Inhalte. Das Layout selbst
 * misst apps/mobile/werkzeuge/dokumente-pruefen.mjs mit Chromium; hier wird geprüft, dass das HTML die Regeln trägt.
 */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, RAENDER, dokumentHtml, leereDaten, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";
import { ibanText, schlussZusammen, unterschriften } from "../src/dokumente/html.js";

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
    expect(t).toContain('<tbody><tr><td>1</td></tr></tbody></table></section><div class="schlussblock"><table class="liste fortsetzung"><colgroup><col></colgroup><tbody><tr><td>2</td></tr></tbody></table><div class="unterschriften');
    // Personalfragebogen: die Erklärung steht mit der Unterschrift, nicht allein auf der Seite davor
    expect(html("sv_meldedaten", { name: "Lea Wagner" })).toMatch(/<div class="schlussblock"><p style="margin-top:6mm">Ich versichere/);
    expect(html("gefaehrdungsbeurteilung")).toMatch(/<div class="schlussblock"><section class="abschnitt"><h2>Wirksamkeit und Fortschreibung/);
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
    const h = html("allergene", { gerichte: [{ name: "Käsekuchen", kategorie: "Kuchen", allergene: ["gluten", "eier", "milch"] }, { name: "Wasser", kategorie: "Getränke", allergene: [] }] });
    expect(h.match(/<th class="dreh">/g)).toHaveLength(14);
    expect(h.match(/<td class="x">×<\/td>/g)).toHaveLength(3);
    expect(h).toContain("keine der 14 Hauptallergene");
    const i = html("ifsg_belehrung");
    expect(i).toContain('<ol class="nummern"><li>Fleisch, Geflügelfleisch und Erzeugnisse daraus</li>');
    expect(i).not.toMatch(/<li>\d+\. /);
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
