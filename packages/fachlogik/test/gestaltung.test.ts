import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, VORLAGEN, akzent, dokumentHtml, giroCodeDaten, giroCodeSvg, leereDaten, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";
import { kontrastZuWeiss } from "../src/dokumente/html.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Café Mond GmbH", strasse: "Mondstraße 12", plz: "50667", ort: "Köln", verantwortlich: "Lea Mondt", telefon: "0221 9876543", email: "post@cafe-mond.de", steuernummer: "215/5812/0987", iban: "DE02 1203 0000 0000 2020 51", bic: "BYLADEM1001", bank: "DKB", bundesland: "Nordrhein-Westfalen", farbe: "#702434" };

describe("Gestaltung der Dokumente (E-130)", () => {
  it("GiroCode: EPC-Nutzdaten nach EPC069-12, SVG, und null ohne gültige IBAN", () => {
    const a = { name: "Café Mond GmbH", iban: "DE02 1203 0000 0000 2020 51", bic: "BYLADEM1001", betragCent: 178986, verwendungszweck: "Rechnung 2026-0231" };
    expect(giroCodeDaten(a)).toBe("BCD\n002\n1\nSCT\nBYLADEM1001\nCafé Mond GmbH\nDE02120300000000202051\nEUR1789.86\n\n\nRechnung 2026-0231");
    expect(giroCodeDaten({ ...a, bic: null, betragCent: 0 })).toBe("BCD\n002\n1\nSCT\n\nCafé Mond GmbH\nDE02120300000000202051\n\n\n\nRechnung 2026-0231");
    expect(giroCodeDaten({ ...a, iban: "DE02" })).toBeNull();
    expect(giroCodeDaten({ ...a, name: " " })).toBeNull();
    const svg = giroCodeSvg(a, 25)!;
    expect(svg).toMatch(/^<svg [^>]*width="25mm" height="25mm"/);
    // Ruhezone: 4 Module rundum, weiß im SVG selbst
    const [x, y, w] = /viewBox="(-?\d+) (-?\d+) (\d+) \d+"/.exec(svg)!.slice(1).map(Number) as [number, number, number];
    expect([x, y]).toEqual([-4, -4]);
    expect(svg).toContain(`<rect x="-4" y="-4" width="${w}" height="${w}" fill="#fff"/>`);
    expect(svg).toContain('<path d="M');
    expect(giroCodeSvg({ ...a, iban: "" })).toBeNull();
  });

  it("jede Vorlage hat eine Gestalt; Randspalten-Familien setzen Nummern und Rechtsgrundlagen, Formulare Feldnummern, der Brief den GiroCode", () => {
    for (const v of VORLAGEN) {
      const html = dokumentHtml(v, leereDaten(v, B, "2026-10-13"), B);
      const g = /<meta name="amtlos-gestalt" content="([a-z]+)">/.exec(html)?.[1];
      expect(["brief", "vertrag", "aushang", "nachweis", "formular", "handbuch"], v.id).toContain(g);
      expect(html, v.id).toContain(`<body class="g-${g}`);
      expect(html, v.id).toContain("--akzent:#702434");
      if (g === "formular") expect(html, v.id).toMatch(/class="felder"|class="kennzahlen"/);
      if (g === "handbuch" || g === "vertrag" || g === "nachweis") expect(html, v.id).toContain("<main>");
    }
    const r = vorlageFuer("rechnung")!;
    const voll = dokumentHtml(r, { ...leereDaten(r, B, "2026-10-13"), nummer: "2026-1", kunde_name: "Kim", kunde_anschrift: "Weg 1\n50667 Köln", positionen: [{ bezeichnung: "Kaffee", menge: "2", einheit: "Stück", preis: "3,00", satz: "7" }] }, B);
    expect(voll).toContain('class="anschrift"');
    expect(voll).toContain('class="qr"');
    expect(voll).toContain("Verwendungszweck: Rechnung 2026-1");
    expect(voll).toContain("Mit freundlichen Grüßen");
    // ohne IBAN keine Zahlungsaufforderung und kein GiroCode, aber das Zahlungsziel als Satz
    const ohne = dokumentHtml(r, { ...leereDaten(r, B, "2026-10-13"), nummer: "2026-1", zahlungsziel: "14", positionen: [{ bezeichnung: "Kaffee", menge: "1", einheit: "", preis: "3,00", satz: "7" }] }, { ...B, iban: "" });
    expect(ohne).not.toContain('class="qr"');
    expect(ohne).toContain("Zahlbar innerhalb von 14 Tagen");
    const ust = vorlageFuer("ust_voranmeldung")!;
    const u = dokumentHtml(ust, { ...leereDaten(ust, B, "2026-10-13"), zeitraum: "September 2026", umsatz_19: "1.000,00", vorsteuer: "50,00" }, B);
    for (const kz of ["81", "86", "66", "83"]) expect(u).toContain(`<span>${kz}</span>`);
    const vd = vorlageFuer("verfahrensdokumentation")!;
    expect(dokumentHtml(vd, leereDaten(vd, B, "2026-10-13"), B)).toContain('class="inhalt-uebersicht"');
    const ba = vorlageFuer("betriebsanweisung")!;
    const bah = dokumentHtml(ba, leereDaten(ba, B, "2026-10-13"), B);
    // leeres Blatt: kompakter Satz, damit die Linien zum Ausfüllen auf ein Blatt passen
    expect(bah).toContain('class="g-aushang ba kompakt"');
    // kurze Angaben in allen Kästen: normaler Satz (die geschätzte Höhe passt auf ein Blatt)
    const kurz = { gefahren: "Reizt die Augen.", schutz: "Schutzbrille tragen.\nHandschuhe tragen.", gefahrfall: "Aufnehmen.", erste_hilfe: "Augen spülen.", entsorgung: "Restmüll." };
    expect(dokumentHtml(ba, { ...leereDaten(ba, B, "2026-10-13"), ...kurz }, B)).toContain('class="g-aushang ba"');
    // nur ein Kasten ausgefüllt: die Linien der übrigen brauchen den kompakten Satz
    expect(dokumentHtml(ba, { ...leereDaten(ba, B, "2026-10-13"), gefahren: "Reizt die Augen." }, B)).toContain('class="g-aushang ba kompakt"');
    // Kennfarbe abgedunkelt: weiße Schrift im Band mindestens 4,5 : 1
    expect(bah).toContain("--band:#c2540a");
    expect(kontrastZuWeiss("#c2540a")).toBeGreaterThanOrEqual(4.5);
  });

  it("typografische Durchsicht (Runde 8): Hausfarbe mit Mindestkontrast, Ränder für die Fußzeile, Aushang ohne Bereich, Kennungsleiste erst ab zwei Angaben", () => {
    // zu helle Hausfarbe wird bei gleichem Farbton abgedunkelt, bis weiße Schrift 4,5 : 1 erreicht; die Auswahlfarben bleiben
    const hell = akzent({ ...B, farbe: "#C27C0E" });
    expect(kontrastZuWeiss(hell)).toBeGreaterThanOrEqual(4.5);
    expect(hell).toMatch(/^#[9a][0-9a-f]6[0-9a-f]{3}$/);
    expect(akzent({ ...B, farbe: "#702434" })).toBe("#702434");
    // Seitenränder der Gestalt als Meta-Angabe (die App setzt die Fußzeile bündig mit dem Satzspiegel)
    const plan = (id: string, d = {}) => dokumentHtml(vorlageFuer(id)!, { ...leereDaten(vorlageFuer(id)!, B, "2026-10-13"), ...d }, B);
    expect(plan("hygieneplan")).toContain('<meta name="amtlos-raender" content="12,14,16,14">');
    expect(plan("unterweisung")).toContain('<meta name="amtlos-raender" content="14,18,20,18">');
    expect(plan("rechnung")).toContain('<meta name="amtlos-raender" content="12,10,30,20">');
    // Aushang: kein Bereich der App im Kopf (Hygieneplan eines Cafés stand unter „Beauty und Kosmetik“)
    expect(plan("hygieneplan")).toContain('<div class="art"></div>');
    expect(plan("betriebsanweisung")).toContain('<div class="art"></div>');
    expect(plan("unterweisung")).toContain('<div class="art">Arbeitsschutz</div>');
    // nur eine Angabe: kleine Zeile statt Band; die Unterzeile entfällt, wenn sie schon in der Leiste steht
    const lk = plan("lohnkonto", { name: "Kim", jahr: "2026" });
    expect(lk).toContain('<p class="kennung-zeile">Rechtsgrundlage: <b>§&nbsp;41&nbsp;EStG; §&nbsp;4&nbsp;LStDV</b></p>');
    expect(lk).not.toContain('<dl class="kennung">');
    const gb = plan("gefaehrdungsbeurteilung", { arbeitsbereich: "Küche" });
    expect(gb).toContain("<dt>Arbeitsbereich</dt><dd>Küche</dd>");
    expect(gb).not.toContain('<p class="unter">Küche</p>');
  });

  it("typografische Durchsicht (Runde 8): Inhalte – Minus, Einheiten, IBAN und SV-Nummer, Lohnkonto, Unterweisung, Nachweis, Gefährdungsbeurteilung", () => {
    const v = (id: string, d: Daten) => dokumentHtml(vorlageFuer(id)!, { ...leereDaten(vorlageFuer(id)!, B, "2026-10-13"), ...d }, B).replace(/\u00a0/g, " ");
    // negative Beträge mit typografischem Minus
    const st = v("rechnung", { nummer: "2026-2", storno_zu: "2026-1", kunde_name: "Kim", kunde_anschrift: "Weg 1\n50667 Köln", positionen: [{ bezeichnung: "Kaffee", menge: "2", einheit: "Seite", preis: "-3,00", satz: "7" }] });
    expect(st).toContain("\u22126,00 €");
    expect(st).not.toMatch(/>-\d/);
    // Mehrzahl der Einheiten
    expect(st).toContain("2 Seiten");
    // Personalfragebogen: IBAN in Vierergruppen, SV-Nummer gegliedert
    const pf = v("sv_meldedaten", { name: "Lea", iban: "DE89370400440532013000", sv_nummer: "53140788K123" });
    expect(pf).toContain("DE89 3704 0044 0532 0130 00");
    expect(pf).toContain("53 140788 K 123");
    // Lohnkonto: leere Zellen und leere Spalten mit „–“, auch in der Summe; Stammdaten in drei Spalten
    const lk = v("lohnkonto", { name: "Kim", jahr: "2026", sv_nummer: "53140788K123", monate: [{ monat: "Januar 2026", zahltag: "2026-01-30", brutto: "2.000,00", lohnsteuer: "100,00" }, { monat: "Februar 2026", zahltag: "2026-02-27", brutto: "2.000,00" }] });
    expect(lk).toContain('<div class="spalten3">');
    expect(lk).toContain("53 140788 K 123");
    const fuss = /<tr class="summe">(.*?)<\/tr>/.exec(lk)![1]!;
    // Sachbezüge (Spalte 2) ganz leer: „–“ statt „0,00 €“; Lohnsteuer mit Betrag
    expect(fuss).toContain('<td class="zahl">–</td>');
    expect(fuss).toContain("<strong>100,00 €</strong>");
    expect(fuss).not.toContain("0,00 €</strong></td><td class=\"zahl\"><strong>0,00");
    expect(lk).toMatch(/Februar 2026<\/td><td>27\.02\.2026<\/td><td class="zahl">2\.000,00 €<\/td><td class="zahl">–<\/td>/);
    // Unterweisung: Bezeichnung nur als Unterzeile, Anlass und Dauer in der Kennungsleiste, Unterschriftszeilen 10 mm
    const uw = v("unterweisung", { thema: "Jährliche Unterweisung", dauer: "45 Minuten", teilnehmer: [{ name: "Kim" }] });
    expect(uw).toContain('<p class="unter">Jährliche Unterweisung</p>');
    expect(uw).not.toContain("<th>Bezeichnung</th>");
    expect(uw).toContain("<dt>Anlass</dt><dd>Wiederholungs\u00adunterweisung</dd>");
    expect(uw).toContain("<dt>Dauer</dt><dd>45 Minuten</dd>");
    expect(uw).toContain('<table class="liste hoch teilnahme">');
    expect(uw).toContain("table.liste.teilnahme td { height: 10mm; }");
    // Nachweis: kurze Punkte als Angabenzeilen unter einer Randnummer, die Nummerierung läuft weiter
    const nw = v("nachweis_arbeitsbedingungen", { name: "Kim", beginn: "2026-03-01", taetigkeit: "Koch", probezeit: "6" });
    expect(nw).toMatch(/<section class="abschnitt gruppe zusammen" style="counter-increment: abschnitt 5"><div class="gruppe-nr">2\.–6\.<\/div><table class="angaben"><tr><th>Beginn<\/th><td>01\.03\.2026<\/td><\/tr>/);
    for (const k of ["Befristung", "Arbeitsort", "Tätigkeit", "Probezeit"]) expect(nw).toContain(`<th>${k}</th>`);
    expect(nw).toContain("<h2>Arbeitsentgelt</h2>");
    // beide Parteien mehrzeilig
    expect(nw).toContain('<div class="adresse">Mondstraße 12<br>50667 Köln</div>');
    // Gefährdungsbeurteilung: Umsetzung beschriftet
    const gb = v("gefaehrdungsbeurteilung", { gefaehrdungen: [{ beschreibung: "Rutschgefahr", massnahme: "Matten", verantwortlich: "Lea", umsetzen_bis: "2026-11-01", faktor: "arbeitsstaette" }] });
    expect(gb).toContain('<span class="lbl">Wer:</span> Lea<br><span class="lbl">Frist:</span> 01.11.2026<br><span class="lbl">offen</span>');
  });

  it("typografische Durchsicht (Runde 8): CSS – Feldnummern, Randangaben, Erklärtext, Lohnkonto, Aushang, Inhaltsübersicht", () => {
    const h = dokumentHtml(vorlageFuer("ust_voranmeldung")!, leereDaten(vorlageFuer("ust_voranmeldung")!, B, "2026-10-13"), B);
    expect(h).toContain("table.felder td.nr { width: 7mm; font-size: 7.4pt; font-weight: 600; color: #4a535c;");
    expect(h).toMatch(/h2 \.rand \{ display: block;[^}]*font-size: 7\.2pt;[^}]*color: #5c666f;/);
    expect(h).toContain("table.kennzahlen th small { display: block; font-size: 7.4pt; color: #4a535c; font-weight: 400; }");
    expect(h).toContain(".spalten2 table.angaben th, .spalten2 table.angaben td, .spalten3 table.angaben th, .spalten3 table.angaben td { height: 7mm; vertical-align: top; }");
    expect(h).toContain("nav.inhalt-uebersicht > h2 { border: 0; font-size: 8.3pt;");
    expect(h).toContain(".g-aushang table.liste { font-size: 10.5pt; }");
    expect(h).toContain(".g-aushang.kompakt table.liste { font-size: 9.6pt;");
    expect(h).toContain(".g-aushang.ba .kasten ul.punkte li::marker { color: var(--band, var(--akzent)); }");
    expect(h).toContain("table.liste.lohn tr.summe td { background: var(--akzent-hauch);");
    expect(h).toContain(".g-nachweis:not(.quer) main:has(section.abschnitt) section.abschnitt table.liste { margin-left: -24mm; width: calc(100% + 24mm); }");
  });
});
