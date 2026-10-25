/**
 * Beispiel-PDFs für die fachliche Durchsicht (Rückmeldungen Runde 3, 24.10.2026): Steuerberater und Rechtsanwalt konnten in den
 * Vorlagen-PDFs nur das GmbH- bzw. Lebensmittel-Beispiel sehen. Dieses Werkzeug erzeugt realistisch ausgefüllte Beispiele
 * für die Rechtsformen und Fassungen, die dort fehlten – gedruckt wie die App (A4, Ränder je Gestalt, eingebettete Schriften,
 * Fußzeile; Chromium wie werkzeuge/dokumente-pruefen.mjs):
 *   - handelsregister: OHG (zwei persönlich haftende Gesellschafter, Vertretungsregelung) und KG (Komplementär, zwei
 *     Kommanditisten mit Hafteinlage),
 *   - bilanz_guv: OHG, KG, e. K., GmbH & Co. KG und Kleinstkapitalgesellschaft (UG mit Angaben unter der Bilanz),
 *   - hygieneplan in der Fassung „beauty“: Auswahl (alle Vorschläge, alle Schalter an) und voll für einen Betrieb in Bayern und
 *     einen in Nordrhein-Westfalen (der Bayern-Zusatz erscheint nur in Bayern),
 *   - betriebsanweisung_biostoffe: Auswahl und voll (mit B-276).
 * Daneben pruefsummen.json: je Beispiel die Prüfsumme der Vorlage (vorlagenPruefsumme), beim Hygieneplan für die Fassung
 * art = beauty. Alle Namen und Zahlen sind erfunden.
 *
 *   node werkzeuge/vorlagen-beispiele.mjs <zielordner>      # CHROMIUM_PFAD optional (Standard /opt/pw-browsers/chromium)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
if (!process.argv[2]) {
  console.error("Aufruf: node werkzeuge/vorlagen-beispiele.mjs <zielordner>");
  process.exit(2);
}
const OUT = path.resolve(process.argv[2]);
fs.mkdirSync(OUT, { recursive: true });

// Fachlogik, Schriften und Fußzeile aus den Quellen bündeln (wie werkzeuge/dokumente-pruefen.mjs)
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const esbuild = path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild");
const eintrag = `export * from "${path.resolve(APP, "../../packages/fachlogik/src/dokumente/index.ts")}";
export { LEERER_BETRIEB } from "${path.resolve(APP, "../../packages/fachlogik/src/dokumente/typen.ts")}";
export { mitSchriften } from "${path.join(APP, "src/unterlagen/schriften.ts")}";
export { fussAngaben, fusszeileStempeln } from "${path.join(APP, "src/unterlagen/fusszeile.ts")}";`;
const quelle = path.join(OUT, ".beispiele-eintrag.ts");
const gebaut = path.join(OUT, ".beispiele.mjs");
fs.writeFileSync(quelle, eintrag);
execFileSync(esbuild, [quelle, "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const F = await import(gebaut);
fs.rmSync(quelle);
fs.rmSync(gebaut);

const HEUTE = "2026-10-24";
const vorlage = (id) => {
  const v = F.vorlageFuer(id);
  if (!v) throw new Error(`Vorlage ${id} fehlt`);
  return v;
};
const feld = (v, id) => v.abschnitte.flatMap((a) => a.felder).find((x) => x.id === id);
/** Neue Unterlage wie in der App: Startwerte, Startwerte aus „Mein Betrieb“ bzw. dem Check, dann die Beispielangaben. */
const unterlage = (v, b, werte) => ({ ...F.leereDaten(v, b, HEUTE), ...F.profilStartwerte(v, {}, b), ...werte });
const posten = (l) => l.map(([p, betrag]) => ({ posten: p, betrag }));

// ---------------------------------------------------------------- Beispielbetriebe (erfunden)
const basis = { ...F.LEERER_BETRIEB, iban: "DE89370400440532013000", bank: "Beispielbank", bic: "COBADEFFXXX" };
const OHG = { ...basis, name: "Schreinerei Holm & Berg OHG", strasse: "Gartenstraße 14", plz: "72764", ort: "Reutlingen", bundesland: "Baden-Württemberg", verantwortlich: "Ole Holm", telefon: "07121 556677", email: "info@holm-berg.example", steuernummer: "68/123/45001", rechtsform: "OHG", registergericht: "Amtsgericht Stuttgart", registernummer: "HRA 731245", vertretung: "Ole Holm, Lena Berg", farbe: "#5a4632" };
const KG = { ...basis, name: "Elektro Krüger KG", strasse: "Industriestraße 8", plz: "90429", ort: "Nürnberg", bundesland: "Bayern", verantwortlich: "Tom Krüger", telefon: "0911 334455", email: "info@elektro-krueger.example", steuernummer: "241/123/45002", rechtsform: "KG", registergericht: "Amtsgericht Nürnberg", registernummer: "HRA 18934", vertretung: "Tom Krüger", farbe: "#1d4f7a" };
const EK = { ...basis, name: "Feinkost Lindner e. K.", strasse: "Marktplatz 5", plz: "72764", ort: "Reutlingen", bundesland: "Baden-Württemberg", verantwortlich: "Mara Lindner", telefon: "07121 778899", email: "info@feinkost-lindner.example", steuernummer: "68/123/45003", rechtsform: "e. K.", registergericht: "Amtsgericht Stuttgart", registernummer: "HRA 732001", vertretung: "Mara Lindner", farbe: "#6b4a2b" };
const COKG = { ...basis, name: "Bau Becker GmbH & Co. KG", strasse: "Am Hafen 21", plz: "48155", ort: "Münster", bundesland: "Nordrhein-Westfalen", verantwortlich: "Jana Becker", telefon: "0251 123456", email: "info@bau-becker.example", steuernummer: "336/5701/4004", rechtsform: "GmbH & Co. KG", registergericht: "Amtsgericht Münster", registernummer: "HRA 9876", vertretung: "Jana Becker, Felix Becker", farbe: "#8a3b12" };
const UG = { ...basis, name: "Salon Sonne UG (haftungsbeschränkt)", strasse: "Hauptstraße 1", plz: "80331", ort: "München", bundesland: "Bayern", verantwortlich: "Alex Sonnberg", telefon: "089 123456", email: "hallo@salon-sonne.example", steuernummer: "143/123/45678", rechtsform: "UG (haftungsbeschränkt)", registergericht: "Amtsgericht München", registernummer: "HRB 271234", vertretung: "Alex Sonnberg", farbe: "#702434" };
const KOSMETIK_BY = { ...basis, name: "Kosmetik & Fußpflege Anna Roth", strasse: "Ludwigstraße 9", plz: "93047", ort: "Regensburg", bundesland: "Bayern", verantwortlich: "Anna Roth", telefon: "0941 123123", email: "hallo@kosmetik-roth.example", steuernummer: "244/123/45005", rechtsform: "Einzelunternehmen", farbe: "#7a3a5c" };
const KOSMETIK_NW = { ...basis, name: "Nagel- und Fußpflegestudio Kaya", strasse: "Ehrenstraße 40", plz: "50672", ort: "Köln", bundesland: "Nordrhein-Westfalen", verantwortlich: "Elif Kaya", telefon: "0221 456456", email: "hallo@studio-kaya.example", steuernummer: "214/5123/4006", rechtsform: "Einzelunternehmen", farbe: "#2f5d62" };

// ---------------------------------------------------------------- Handelsregister: OHG und KG
const hr = vorlage("handelsregister");
const HR_OHG = unterlage(hr, OHG, {
  firma: "Schreinerei Holm & Berg OHG", rechtsform: "OHG", sitz: "Reutlingen", anschrift: "Gartenstraße 14\n72764 Reutlingen",
  gegenstand: "Schreinerarbeiten, Herstellung und Montage von Möbeln und Innenausbauten sowie der Handel mit Holzprodukten.",
  gesellschafter: [
    { name: "Ole Holm", geburtsdatum: "1984-04-12", wohnort: "Reutlingen", anteil: "50 %", stellung: "phg", hafteinlage: "" },
    { name: "Lena Berg", geburtsdatum: "1990-09-03", wohnort: "Pfullingen", anteil: "50 %", stellung: "phg", hafteinlage: "" },
  ],
  fuehrung: [],
  vertretung: "Jeder Gesellschafter vertritt die Gesellschaft allein (Einzelvertretung).",
});
const HR_KG = unterlage(hr, KG, {
  firma: "Elektro Krüger KG", rechtsform: "KG", sitz: "Nürnberg", anschrift: "Industriestraße 8\n90429 Nürnberg",
  gegenstand: "Elektroinstallation, Prüfung elektrischer Anlagen und Geräte sowie der Handel mit Elektrozubehör.",
  gesellschafter: [
    { name: "Tom Krüger", geburtsdatum: "1979-02-17", wohnort: "Nürnberg", anteil: "60 %", stellung: "phg", hafteinlage: "" },
    { name: "Anna Krüger", geburtsdatum: "1982-11-30", wohnort: "Fürth", anteil: "25 %", stellung: "kommandit", hafteinlage: "20.000,00" },
    { name: "Paul Weiß", geburtsdatum: "1975-06-08", wohnort: "Erlangen", anteil: "15 %", stellung: "kommandit", hafteinlage: "10.000,00" },
  ],
  fuehrung: [],
  vertretung: "Der persönlich haftende Gesellschafter Tom Krüger vertritt die Gesellschaft allein. Die Kommanditisten vertreten die Gesellschaft nicht.",
});

// ---------------------------------------------------------------- Bilanz und GuV je Rechtsform
const bg = vorlage("bilanz_guv");
const bilanz = (b, werte) => unterlage(bg, b, { stichtag: "2025-12-31", aufgestellt: "2026-04-15", ...werte });
const BG_OHG = bilanz(OHG, {
  ertraege: posten([["Umsatzerlöse", "612.400,00"], ["Sonstige betriebliche Erträge", "3.150,00"]]),
  aufwendungen: posten([["Materialaufwand", "248.900,00"], ["Personalaufwand", "196.300,00"], ["Abschreibungen", "21.400,00"], ["Sonstige betriebliche Aufwendungen", "58.750,00"]]),
  ertragsteuern: "12.300,00",
  aktiva: posten([["Technische Anlagen und Maschinen", "84.200,00"], ["Betriebs- und Geschäftsausstattung", "23.600,00"], ["Vorräte", "31.500,00"], ["Forderungen aus Lieferungen und Leistungen", "46.800,00"], ["Kassenbestand, Bankguthaben", "38.900,00"]]),
  passiva: posten([["Kapitalanteil Ole Holm", "61.000,00"], ["Kapitalanteil Lena Berg", "61.000,00"], ["Rückstellungen", "14.500,00"], ["Verbindlichkeiten gegenüber Kreditinstituten", "52.300,00"], ["Verbindlichkeiten aus Lieferungen und Leistungen", "36.200,00"]]),
});
const BG_KG = bilanz(KG, {
  ertraege: posten([["Umsatzerlöse", "1.284.000,00"], ["Sonstige betriebliche Erträge", "6.200,00"]]),
  aufwendungen: posten([["Materialaufwand", "562.300,00"], ["Personalaufwand", "448.100,00"], ["Abschreibungen", "38.700,00"], ["Sonstige betriebliche Aufwendungen", "121.400,00"]]),
  ertragsteuern: "24.900,00",
  aktiva: posten([["Fahrzeuge", "96.000,00"], ["Betriebs- und Geschäftsausstattung", "41.300,00"], ["Vorräte", "58.200,00"], ["Forderungen aus Lieferungen und Leistungen", "142.600,00"], ["Kassenbestand, Bankguthaben", "71.900,00"]]),
  passiva: posten([["Kapitalanteil Tom Krüger (Komplementär)", "118.000,00"], ["Kommanditkapital Anna Krüger", "20.000,00"], ["Kommanditkapital Paul Weiß", "10.000,00"], ["Rückstellungen", "36.400,00"], ["Verbindlichkeiten gegenüber Kreditinstituten", "128.500,00"], ["Verbindlichkeiten aus Lieferungen und Leistungen", "97.100,00"]]),
});
const BG_EK = bilanz(EK, {
  ertraege: posten([["Umsatzerlöse", "918.500,00"]]),
  aufwendungen: posten([["Wareneinsatz", "587.200,00"], ["Personalaufwand", "164.800,00"], ["Abschreibungen", "14.900,00"], ["Sonstige betriebliche Aufwendungen", "62.300,00"]]),
  ertragsteuern: "9.800,00",
  aktiva: posten([["Ladeneinrichtung", "48.700,00"], ["Warenbestand", "64.300,00"], ["Forderungen", "8.400,00"], ["Kassenbestand, Bankguthaben", "41.600,00"]]),
  passiva: posten([["Eigenkapital", "92.500,00"], ["Rückstellungen", "7.900,00"], ["Verbindlichkeiten gegenüber Kreditinstituten", "28.400,00"], ["Verbindlichkeiten aus Lieferungen und Leistungen", "34.200,00"]]),
});
const BG_COKG = bilanz(COKG, {
  kleinst: false,
  ertraege: posten([["Umsatzerlöse", "3.462.000,00"], ["Sonstige betriebliche Erträge", "18.400,00"]]),
  aufwendungen: posten([["Materialaufwand", "1.736.000,00"], ["Personalaufwand", "1.102.500,00"], ["Abschreibungen", "142.800,00"], ["Sonstige betriebliche Aufwendungen", "296.300,00"]]),
  ertragsteuern: "61.200,00",
  aktiva: posten([["Bauten auf fremden Grundstücken", "214.000,00"], ["Technische Anlagen und Maschinen", "386.500,00"], ["Vorräte", "92.400,00"], ["Forderungen aus Lieferungen und Leistungen", "418.900,00"], ["Kassenbestand, Bankguthaben", "167.200,00"]]),
  passiva: posten([["Kommanditkapital", "250.000,00"], ["Rücklagen", "312.600,00"], ["Rückstellungen", "118.300,00"], ["Verbindlichkeiten gegenüber Kreditinstituten", "401.800,00"], ["Verbindlichkeiten aus Lieferungen und Leistungen", "196.300,00"]]),
});
const BG_KLEINST = bilanz(UG, {
  kleinst: true,
  ertraege: posten([["Umsatzerlöse", "186.400,00"], ["Sonstige Erträge", "1.200,00"]]),
  aufwendungen: posten([["Materialaufwand", "38.600,00"], ["Personalaufwand", "102.300,00"], ["Abschreibungen", "6.800,00"], ["Sonstige Aufwendungen", "24.100,00"]]),
  ertragsteuern: "4.700,00",
  aktiva: posten([["Anlagevermögen", "28.400,00"], ["Umlaufvermögen", "41.900,00"]]),
  passiva: posten([["Eigenkapital", "24.800,00"], ["Rückstellungen", "6.300,00"], ["Verbindlichkeiten", "39.200,00"]]),
  haftung: "Bürgschaft gegenüber der Beispielbank für ein Darlehen der Sonnberg Immobilien GbR: 20.000,00 €",
  organkredite: "Darlehen an den Geschäftsführer Alex Sonnberg: 8.000,00 €, Zinssatz 3 % jährlich, Laufzeit bis 31.12.2028; im Geschäftsjahr zurückgezahlt: 2.000,00 €",
});

// ---------------------------------------------------------------- Hygieneplan, Fassung „beauty“
const hp = vorlage("hygieneplan");
const hpEintraege = hp.abschnitte.flatMap((a) => a.felder).find((x) => x.id === "eintraege");
const LM_GRUPPEN = ["Gastronomie / Café", "Bäckerei", "Foodtruck / mobiler Verkauf"];
const beautyZeilen = (b, nur) => hpEintraege.vorschlaege.filter((x) => !LM_GRUPPEN.includes(x.gruppe) && (!nur || nur.test(x.titel))).map((x) => F.eintragAusVorschlag(hpEintraege, x, b, HEUTE));
/** Auswahl: alle Beauty-Vorschläge, jede Auswahl der Fassung „beauty“, alle Schalter an */
const hpAuswahl = (b) => {
  const d = unterlage(hp, b, { art: "beauty", bereich: "Kosmetik, Nagelstudio und Fußpflege", erstellt_von: b.verantwortlich, eintraege: beautyZeilen(b) });
  for (const f of hp.abschnitte.flatMap((a) => a.felder)) if (f.art === "schalter") d[f.id] = true;
  return d;
};
// voll: ein Kosmetik- und Fußpflegestudio mit Beschäftigten – die Zeilen, die es typischerweise braucht (ohne Haarwaschbecken)
const VOLL_ZEILEN = /^(Händewaschen|Hygienische Händedesinfektion|Einmalhandschuhe|Hautdesinfektion|Instrumente mit Verletzungsrisiko|Instrumente, die die Haut|Arbeitsplatz|Behandlungsliege|Fußboden|Wäsche|Reinigungsutensilien|Abfall allgemein|Spitze, scharfe|Umgang mit Blut|Hygieneplan pflegen)/;
const hpVoll = (b, bereich) => unterlage(hp, b, { art: "beauty", bereich, erstellt_von: b.verantwortlich, datum: HEUTE, mit_beschaeftigten: true, eintraege: beautyZeilen(b, VOLL_ZEILEN) });

// ---------------------------------------------------------------- Betriebsanweisung Biostoffe
const ba = vorlage("betriebsanweisung_biostoffe");
const vorschlaegeFuer = (id, gruppe) => {
  const f = feld(ba, id);
  return (f.vorschlaege ?? []).filter((t) => !gruppe || !f.vorschlagGruppen?.[t] || f.vorschlagGruppen[t].includes(gruppe));
};
const TEILE = ["gefahren", "schutz", "unfall", "entsorgung", "vorsorge", "beschraenkung"];
const baAuswahl = unterlage(ba, KOSMETIK_BY, {
  taetigkeit: "Kosmetikbehandlung mit möglichem Blutkontakt", biostoffe: "Krankheitserreger in Blut und Körperflüssigkeiten (z. B. Hepatitis-B-, Hepatitis-C-Virus, HIV)", schutzstufe: "2", nummer: "BA-B-01",
  ...Object.fromEntries(TEILE.map((id) => [id, vorschlaegeFuer(id).join("\n")])),
  notruf: "Notruf 112 · Ersthelferin: Anna Roth, Tel. 0151 2345678", erstellt_von: "Anna Roth", datum: HEUTE,
});
const baVoll = unterlage(ba, KOSMETIK_BY, {
  taetigkeit: "Fußpflege", biostoffe: "Krankheitserreger in Blut und Körperflüssigkeiten (z. B. Hepatitis-B-, Hepatitis-C-Virus, HIV); Erreger von Haut- und Nagelpilz", schutzstufe: "2", nummer: "BA-B-02",
  ...Object.fromEntries(TEILE.map((id) => [id, vorschlaegeFuer(id, "kosmetik").join("\n")])),
  notruf: "Notruf 112 · Ersthelferin: Anna Roth, Tel. 0151 2345678 · Durchgangsarzt: Praxis Dr. Huber, Tel. 0941 765432", erstellt_von: "Anna Roth", datum: HEUTE,
});

// ---------------------------------------------------------------- Beispiele
const BEAUTY = { fassung: { feld: "art", wert: "beauty" } };
const BEAUTY_GRUPPEN = [...new Set(hpEintraege.vorschlaege.map((x) => x.gruppe).filter((g) => !LM_GRUPPEN.includes(g)))];
const BEISPIELE = [
  ["handelsregister-beispiel-ohg", hr, HR_OHG, OHG, "OHG mit zwei persönlich haftenden Gesellschaftern und Vertretungsregelung"],
  ["handelsregister-beispiel-kg", hr, HR_KG, KG, "KG mit einem Komplementär und zwei Kommanditisten mit Hafteinlage"],
  ["bilanz_guv-beispiel-ohg", bg, BG_OHG, OHG, "OHG: kein Anhang, Unterschrift aller persönlich haftenden Gesellschafter"],
  ["bilanz_guv-beispiel-kg", bg, BG_KG, KG, "KG: kein Anhang, Unterschrift des persönlich haftenden Gesellschafters"],
  ["bilanz_guv-beispiel-ek", bg, BG_EK, EK, "e. K.: kein Anhang, Unterschrift der Kauffrau"],
  ["bilanz_guv-beispiel-gmbh-co-kg", bg, BG_COKG, COKG, "GmbH & Co. KG (keine Kleinstgesellschaft): Anhang-Hinweis, Unterschrift aller Geschäftsführer der Komplementär-GmbH"],
  ["bilanz_guv-beispiel-kleinst-ug", bg, BG_KLEINST, UG, "Kleinstkapitalgesellschaft (UG): Angaben unter der Bilanz nach § 264 Abs. 1 Satz 5 HGB statt Anhang"],
  ["hygieneplan-beauty-auswahl", hp, hpAuswahl(KOSMETIK_BY), KOSMETIK_BY, "Fassung „beauty“, alle Vorschläge, alle Schalter an (Betrieb in Bayern)", BEAUTY],
  ["hygieneplan-beauty-voll-bayern", hp, hpVoll(KOSMETIK_BY, "Kosmetik und Fußpflege"), KOSMETIK_BY, "Fassung „beauty“, Kosmetik- und Fußpflegestudio in Bayern – mit Bayern-Zusatz", BEAUTY],
  ["hygieneplan-beauty-voll-nordrhein-westfalen", hp, hpVoll(KOSMETIK_NW, "Nagelstudio und Fußpflege"), KOSMETIK_NW, "Fassung „beauty“, Nagel- und Fußpflegestudio in Nordrhein-Westfalen – ohne Bayern-Zusatz", BEAUTY],
  ["betriebsanweisung_biostoffe-auswahl", ba, baAuswahl, KOSMETIK_BY, "alle Vorschläge (Praxis und Kosmetik), mit B-276"],
  ["betriebsanweisung_biostoffe-voll", ba, baVoll, KOSMETIK_BY, "Fußpflege, Vorschläge für Kosmetik, mit B-276"],
];

const MM = 72 / 25.4;
const px = (mm) => `${(Math.round(mm * MM) * 4) / 3}px`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
const summen = {};
for (const [name, v, daten, b, beschreibung, freigabe] of BEISPIELE) {
  const html = F.mitSchriften(F.dokumentHtml(v, daten, b));
  const ang = F.fussAngaben(html);
  const [o, r, u, l] = F.RAENDER[ang.gestalt] ?? F.RAENDER.nachweis;
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ format: "A4", landscape: !!v.querformat, margin: { top: px(o), right: px(r), bottom: px(u), left: px(l) }, printBackground: true });
  fs.writeFileSync(path.join(OUT, `${name}.pdf`), await F.fusszeileStempeln(new Uint8Array(pdf), ang));
  const pruefsumme = F.vorlagenPruefsumme(v, freigabe);
  summen[`${name}.pdf`] = {
    vorlage: v.id,
    beschreibung,
    rechtsform: b.rechtsform || null,
    bundesland: b.bundesland || null,
    ...(freigabe ? { fassung: freigabe.fassung } : {}),
    pruefsumme,
    pruefsumme_kurz: pruefsumme.slice(0, 12),
    // Hygieneplan: zum Vergleich die Prüfsumme nur mit den Beauty-Vorschlägen (wie die Lebensmittel-Freigabe mit `gruppen`)
    ...(freigabe ? { pruefsumme_nur_beauty_gruppen: F.vorlagenPruefsumme(v, { ...freigabe, gruppen: BEAUTY_GRUPPEN }), gruppen: BEAUTY_GRUPPEN } : {}),
  };
}
await browser.close();
fs.writeFileSync(path.join(OUT, "pruefsummen.json"), `${JSON.stringify({ erstellt: HEUTE, hinweis: "Beispiele mit erfundenen Angaben; Prüfsumme = vorlagenPruefsumme der Vorlage (Hygieneplan: Fassung art = beauty)", beispiele: summen }, null, 2)}\n`);
for (const [datei, s] of Object.entries(summen)) console.log(`${datei.padEnd(48)} ${s.pruefsumme_kurz}  ${s.beschreibung}`);
console.log(`${BEISPIELE.length} Beispiele und pruefsummen.json in ${OUT}`);
