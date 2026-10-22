/**
 * Satzspiegel-Prüfung der Dokumentvorlagen (E-130): erzeugt jede Vorlage aus @amtlos/fachlogik zweimal – mit den
 * Startwerten („leer“) und mit vollen Listen und langen Angaben („voll“) –, druckt sie wie die App (A4, Ränder je
 * Gestalt aus RAENDER, eingebettete Schriften, Fußzeile von fusszeile.ts) mit Chromium und meldet:
 *   - Elemente, die über den Satzspiegel ragen (würden abgeschnitten oder ließen Chromium das Blatt verkleinern),
 *   - eine Seite, auf der nur der Unterschriftsblock steht (mit pdftotext, falls installiert),
 *   - Aushänge, die schon mit den Startwerten mehr als ein Blatt brauchen.
 * In vitest ohne Browser lässt sich das Layout nicht messen; deshalb ein Skript. Ohne Befund Exit-Code 0.
 *
 *   node werkzeuge/dokumente-pruefen.mjs [ausgabe]     # PDFs landen in <ausgabe> (Standard: Systemtemp), CHROMIUM_PFAD optional
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), "amtlos-dokumente-")));
fs.mkdirSync(OUT, { recursive: true });

// Fachlogik, Schriften und Fußzeile aus den Quellen bündeln (wie werkzeuge/store-bilder.mjs)
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const esbuild = path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild");
const eintrag = `export * from "${path.resolve(APP, "../../packages/fachlogik/src/dokumente/index.ts")}";
export { LEERER_BETRIEB } from "${path.resolve(APP, "../../packages/fachlogik/src/dokumente/typen.ts")}";
export { mitSchriften } from "${path.join(APP, "src/unterlagen/schriften.ts")}";
export { fussAngaben, fusszeileStempeln } from "${path.join(APP, "src/unterlagen/fusszeile.ts")}";`;
const quelle = path.join(OUT, ".dokumente-eintrag.ts");
const gebaut = path.join(OUT, ".dokumente.mjs");
fs.writeFileSync(quelle, eintrag);
execFileSync(esbuild, [quelle, "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const F = await import(gebaut);
fs.rmSync(quelle);
fs.rmSync(gebaut);

const B = { ...F.LEERER_BETRIEB, name: "Salon Sonne GmbH", strasse: "Hauptstraße 1", plz: "80331", ort: "München", bundesland: "Bayern", verantwortlich: "Alex Sonnberg", telefon: "089 123456", email: "hallo@salon-sonne.example", website: "www.salon-sonne.example", steuernummer: "143/123/45678", ust_idnr: "DE123456789", iban: "DE89370400440532013000", bank: "Beispielbank", bic: "COBADEFFXXX", rechtsform: "GmbH", registergericht: "Amtsgericht München", registernummer: "HRB 271234", vertretung: "Alex Sonnberg, Chris Sonnberg", farbe: "#702434" };
/**
 * E-166: Beispielbetrieb für die Lebensmittel-Vorlagen (HACCP, Hygieneplan eines Lebensmittelbetriebs, Allergenliste,
 * Belehrung nach § 43 IfSG) – ein Café mit Backstube statt des Salons. Erfunden.
 */
const B_LM = { ...F.LEERER_BETRIEB, name: "Café-Bäckerei Lindenblüte", strasse: "Marktplatz 3", plz: "72764", ort: "Reutlingen", bundesland: "Baden-Württemberg", verantwortlich: "Mara Lindner", telefon: "07121 345678", email: "hallo@cafe-lindenbluete.example", website: "www.cafe-lindenbluete.example", steuernummer: "68/123/45678", ust_idnr: "DE234567891", iban: "DE89370400440532013000", bank: "Beispielbank", bic: "COBADEFFXXX", rechtsform: "Einzelunternehmen", farbe: "#6b4a2b" };
/** Vorlagen bzw. Fassungen eines Lebensmittelbetriebs: Bereich „gastro“ und die Fassungen „-lebensmittel“ des Hygieneplans. */
const lebensmittel = (v, variante) => v.bereich === "gastro" || variante.includes("lebensmittel");
const betriebFuer = (v, variante) => (lebensmittel(v, variante) ? B_LM : B);
const HEUTE = "2026-10-13";
const LANG = "Fachgerechte Reinigung und Desinfektion der Arbeitsflächen einschließlich Ablagen nach Herstellerangaben, dokumentiert im Protokoll";

/**
 * Realistische Angaben je Vorlage für „voll“ (Vorprüfung 21.10.2026): Namens- und Anschriftsfelder sollen für die Prüfung
 * nach echten Angaben aussehen, nicht nach Fülltext („Fachgerechte Reinigung …“ als Anschrift). Überschreibt die
 * erzeugten Werte; Listen hier haben realistische Längen.
 */
const REALISTISCH = {
  nachweis_arbeitsbedingungen: {
    name: "Jana Becker", anschrift: "Lindenstraße 12\n80469 München", branche: "friseur_kosmetik", beginn: "2026-11-01", taetigkeit: "Friseurin",
    entgelt_art: "monat", entgelt_betrag: "2.650,00", wochenstunden: "38,5", tage_pro_woche: "5", verteilung: "Dienstag bis Samstag nach Dienstplan",
    // Nachkontrolle Dr. Weber (21.10.2026): Überstunden widerspruchsfrei – angeordnet (Nr. 10), gesondert vergütet mit dem
    // rechnerischen Stundenlohn (Monatsgehalt, kein vereinbarter Stundenlohn) und mit dem Folgemonat fällig (Ausschlussfrist)
    ueberstunden: "ja",
    ueberstunden_verguetung: "Jede angeordnete Überstunde wird mit dem rechnerischen Stundenlohn (Monatsgehalt geteilt durch 167 Stunden) zuzüglich eines Zuschlags von 25 % vergütet und mit dem Gehalt des Folgemonats ausgezahlt.",
    bestandteile: [{ bezeichnung: "Samstagszuschlag", hoehe: "10 % des Stundenlohns für Arbeit am Samstag nach 14 Uhr" }, { bezeichnung: "Weihnachtsgeld", hoehe: "50 % eines Monatsgehalts, fällig mit dem Novembergehalt" }, { bezeichnung: "Vermögenswirksame Leistungen", hoehe: "40,00 € monatlich" }],
    zuschlaege: "", provision: "5 % vom eigenen Dienstleistungsumsatz im Monat", faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung auf das von der beschäftigten Person benannte Konto",
    pausen: "nach § 4 ArbZG: mindestens 30 Minuten bei mehr als sechs Stunden, 45 Minuten bei mehr als neun Stunden", ruhezeit: "nach § 5 ArbZG: mindestens elf Stunden ununterbrochen nach Ende der täglichen Arbeitszeit",
    schicht_text: "", abruf_text: "", ueberstunden_text: "bei unvorhersehbarem Arbeitsanfall, höchstens 10 Stunden im Monat", urlaub: "28",
    fortbildung: "Ein Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung besteht nicht.", bav_text: "Allianz Pensionskasse AG", bav_anschrift: "Reinsburgstraße 19\n70178 Stuttgart",
    kuendigung_eigen: "", kollektiv_text: "", weitere: `${F.NACHWG_AUSSCHLUSSFRIST_BEISPIEL} ${F.NACHWG_AUSSCHLUSSFRIST_UEBERSTUNDEN}`,
    arbeitsort_text: "", ausgestellt_am: "2026-10-13",
  },
  datenschutzinformation: {
    fuer_wen: "Kundinnen und Kunden des Salons", interessen: "Sicherer und störungsfreier Betrieb unserer IT\nDurchsetzung und Abwehr von Ansprüchen", ergaenzung: "",
  },
  avv: {
    partner: "IT-Service Krüger e. K.", partner_anschrift: "Bahnhofstraße 4\n80335 München", hauptvertrag: "IT-Betreuungsvertrag vom 01.09.2026", weisung_ag: "Alex Sonnberg, hallo@salon-sonne.example", weisung_an: "Tom Krüger, support@it-krueger.example",
    unterauftragnehmer: [{ name: "Hetzner Online GmbH", anschrift: "Industriestr. 25, 91710 Gunzenhausen", leistung: "Rechenzentrum für die Datensicherung", ort: "Deutschland" }, { name: "TeamViewer Germany GmbH", anschrift: "Bahnhofsplatz 2, 73033 Göppingen", leistung: "Fernwartung", ort: "EU" }],
    ort_datum: "München",
  },
};

/**
 * Hygieneplan (Nachkontrolle Dr. Weber): die Einträge passend zur Art des Betriebs – Beauty-Zeilen im Salon, die Zeilen
 * „Gastronomie / Café“ im Lebensmittelbetrieb (sonst stünden Instrumentenaufbereitung und Hautdesinfektion im Café-Plan).
 */
const LM_GRUPPEN = ["Gastronomie / Café", "Bäckerei", "Foodtruck / mobiler Verkauf"];
function hygieneEintraege(v, d) {
  if (v.id !== "hygieneplan") return d;
  const f = v.abschnitte.flatMap((a) => a.felder).find((x) => x.id === "eintraege");
  const lm = d.art === "lebensmittel";
  // E-166: Café mit Backstube – Zeilen „Gastronomie / Café“ und „Bäckerei“; Beauty-Fassungen ohne Lebensmittel-Zeilen
  const passt = (x) => (lm ? ["Gastronomie / Café", "Bäckerei"].includes(x.gruppe) : !LM_GRUPPEN.includes(x.gruppe));
  return { ...d, eintraege: f.vorschlaege.filter(passt).map((x) => F.eintragAusVorschlag(f, x, lm ? B_LM : B, HEUTE)) };
}

/** E-166: realistische Lebensmittel-Angaben des Beispielbetriebs (Café mit Backstube). */
function lebensmittelVoll(v) {
  const feld = (id) => v.abschnitte.flatMap((a) => a.felder).find((x) => x.id === id);
  const aus = (id, gruppen) => feld(id).vorschlaege.filter((x) => gruppen.includes(x.gruppe)).map((x) => F.eintragAusVorschlag(feld(id), x, B_LM, HEUTE));
  if (v.id === "haccp") {
    const messungen = [
      ["2026-10-01", "07:30", "Kühllagerung allgemein – Temperaturkontrolle Kühleinrichtungen", "5,1 °C", "ja", "", "ML"],
      ["2026-10-01", "07:35", "Kühlung feine Backwaren / Konditorwaren mit nicht durcherhitzter Füllung oder Auflage; Feinkost-, Obst-/Gemüsesalate, belegte Brötchen, Desserts", "6,0 °C", "ja", "", "TK"],
      ["2026-10-01", "11:40", "Erhitzen – Kerntemperatur", "78 °C (Quiche)", "ja", "", "TK"],
      ["2026-10-02", "07:30", "Kühllagerung allgemein – Temperaturkontrolle Kühleinrichtungen", "8,4 °C", "nein", "Tür der Kühlung stand offen; geschlossen, Ware geprüft (unter 2 Stunden, in Ordnung); Nachmessung 08:15 Uhr: 5,6 °C", "ML"],
      ["2026-10-02", "09:10", "Wareneingangskontrolle", "Milchprodukte 5,8 °C, Verpackung einwandfrei, MHD in Ordnung", "ja", "", "ML"],
      ["2026-10-02", "12:05", "Heißhalten", "66 °C (Suppe)", "ja", "", "TK"],
      ["2026-10-03", "07:30", "Tiefkühlung (Tiefkühltruhe/-raum, tiefgefrorene Lebensmittel)", "−19,5 °C", "ja", "", "ML"],
      ["2026-10-03", "14:30", "Abkühlen", "Vanillecreme: 14:30 Uhr 70 °C, 16:45 Uhr 9 °C", "ja", "", "TK"],
    ].map(([datum, uhrzeit, kontrollpunkt, wert, in_ordnung, massnahme, kuerzel]) => ({ datum, uhrzeit, kontrollpunkt, wert, in_ordnung, massnahme, kuerzel }));
    return {
      zeitraum: "Oktober 2026", verantwortlich: "Mara Lindner", stand: "2026-10-01", leerzeilen: false,
      gefahren: aus("gefahren", ["Gastronomie / Café", "Bäckerei"]),
      ccps: aus("ccps", ["Gastronomie / Café", "Bäckerei"]),
      punkte: feld("punkte").vorschlaege.filter((x) => /^(Kühllagerung allgemein|Kühlung Milcherzeugnisse|Kühlung feine Backwaren|Kühlung Eiprodukte|Tiefkühlung|Heißhalten|Abkühlen|Wareneingangskontrolle|Reinigung und Desinfektion|Schädlingsmonitoring)/.test(x.titel)).map((x) => F.eintragAusVorschlag(feld("punkte"), x, B_LM, HEUTE)),
      verifizierung: ["protokolle_durchsehen", "thermometer", "abweichungen", "aenderungen", "regelmaessig"], naechste_pruefung: "2027-04-01",
      aufzeichnungen: ["konzept", "messungen", "wareneingang", "reinigung", "schulung", "schaedlinge"],
      messungen,
    };
  }
  if (v.id === "allergene") {
    const g = [
      ["Butterbrezel", "Backwaren", ["gluten", "milch"], "Weizen"], ["Dinkel-Vollkornbrötchen", "Backwaren", ["gluten", "sesam"], "Dinkel"], ["Käsekuchen", "Kuchen und Torten", ["gluten", "eier", "milch"], "Weizen"],
      ["Schwarzwälder Kirschtorte", "Kuchen und Torten", ["gluten", "eier", "milch"], "Weizen"], ["Nussecke", "Kuchen und Torten", ["gluten", "eier", "milch", "schalenfruechte", "soja"], "Weizen", "Haselnuss"],
      ["Quiche Lorraine", "Mittagstisch", ["gluten", "eier", "milch", "sellerie"], "Weizen"], ["Linsensuppe", "Mittagstisch", ["sellerie", "senf"]], ["Obstsalat", "Frühstück", []],
      ["Cappuccino", "Heißgetränke", ["milch"]], ["Hafer-Latte", "Heißgetränke", ["gluten"], "Hafer"], ["Espresso", "Heißgetränke", []], ["Apfelschorle", "Kaltgetränke", []],
    ];
    return { stand: "2026-10-01", legende: true, gerichte: g.map(([name, kategorie, allergene, getreide = "", nuesse = ""]) => ({ name, kategorie, allergene, getreide, nuesse, keine: allergene.length === 0 })) };
  }
  if (v.id === "ifsg_belehrung") {
    return {
      datum: "2026-10-01", belehrt_von: "Mara Lindner",
      teilnehmer: [["Tom Kessler", "2024-03-04", "2024-03-15", false], ["Aylin Demir", "2026-09-10", "2026-10-01", true], ["Jonas Weber", "2025-06-02", "2025-06-16", false], ["Lena Hofmann", "2023-11-20", "2023-12-01", false]].map(([name, erstbelehrung_am, erster_arbeitstag, erstmals]) => ({ name, erstbelehrung_am, erster_arbeitstag, erstmals })),
    };
  }
  return {};
}

/**
 * E-167 (Sifa-Durchsicht): realistische Angaben für die Arbeitsschutz-Vorlagen – Risiko aus Schwere und Wahrscheinlichkeit
 * (sonst stünde in „voll“ überall eine Linie), Prüffristen mit letzter Prüfung, im Prüfprotokoll kein „nächste Prüfung =
 * Prüfdatum“ mehr (der Termin kommt als Vorschlag aus dem Richtwert), die neuen Vorlagen mit ihren Vorschlägen.
 */
const W = ["moeglich", "unwahrscheinlich", "wahrscheinlich"];
function arbeitsschutzVoll(v, d) {
  const feld = (id) => v.abschnitte.flatMap((a) => a.felder).find((x) => x.id === id);
  const vorschlaegeVon = (id) => (feld(id)?.vorschlaege ?? []).join("\n");
  if (v.id === "gefaehrdungsbeurteilung")
    return {
      ...d,
      gefaehrdungen: (d.gefaehrdungen ?? []).map((e, i) => ({ ...e, schwere: e.schwere || ["mittel", "leicht", "schwer"][i % 3], wahrscheinlichkeit: W[i % 3] })),
      pruefungen: (d.pruefungen ?? []).slice(0, 6).map((e) => ({ ...e, letzte: "2026-02-10", naechste: null })),
      schutzbeduerftig: ["jugendliche", "schwangere"],
    };
  if (v.id === "pruefprotokoll_elektro") return { ...d, einsatz: feld("einsatz").optionen[3].wert, qualifikation: "efk", geraete: (d.geraete ?? []).map((e) => ({ ...e, naechste: null })) };
  if (v.id === "betriebsanweisung_maschine") return { ...d, maschine: "Aufschnittmaschine", arbeitsbereich: "Küche", nummer: "BA-M-01", gefahren: vorschlaegeVon("gefahren").split("\n").slice(0, 2).join("\n"), schutz: vorschlaegeVon("schutz").split("\n").slice(0, 4).join("\n"), stoerung: vorschlaegeVon("stoerung"), unfall: vorschlaegeVon("unfall"), instandhaltung: vorschlaegeVon("instandhaltung"), beschraenkung: "", notruf: "Notruf 112 · Ersthelferin: Mara Lindner, Tel. 0151 2345678" };
  if (v.id === "betriebsanweisung_biostoffe") return { ...d, taetigkeit: "Blutentnahme und Injektionen", biostoffe: "Krankheitserreger in Blut und Körperflüssigkeiten (z. B. Hepatitis-B-, Hepatitis-C-Virus, HIV)", schutzstufe: "2", nummer: "BA-B-01", gefahren: vorschlaegeVon("gefahren").split("\n").slice(0, 2).join("\n"), schutz: vorschlaegeVon("schutz"), unfall: vorschlaegeVon("unfall").split("\n").slice(0, 3).join("\n"), entsorgung: vorschlaegeVon("entsorgung"), vorsorge: "", beschraenkung: "", notruf: "Notruf 112 · Ersthelfer: Dr. Jonas Weber, Tel. 0151 9876543" };
  if (v.id === "expositionsverzeichnis")
    return { ...d, eintraege: [["Ole Holm", "Schleifen und Fräsen von Eiche und Buche", "Hartholzstaub (z. B. Eiche, Buche)", "unter 2 mg/m³ (Messung vom 12.03.2026)", "2019-08-01", "etwa 6 Stunden je Woche"], ["Finn Berger", "Zuschnitt an der Formatkreissäge", "Hartholzstaub (z. B. Eiche, Buche)", "unter 1 mg/m³ (Abschätzung nach TRGS 553)", "2024-09-01", "etwa 3 Stunden je Woche"], ["Kai Demir", "Motorlauf bei der Fehlersuche in der Halle", "Dieselmotoremissionen", "Absaugung am Auspuff; Abschätzung nach TRGS 554", "2025-01-15", "etwa 1 Stunde je Woche"]].map(([name, taetigkeit, stoff, hoehe, von, dauer]) => ({ name, taetigkeit, stoff, kategorie: "k", hoehe, von, bis: null, dauer })) };
  return d;
}

/** Volle Daten: Pflicht- und Textfelder mittellang, Listen mit 12 Einträgen, Beträge fünfstellig. */
function voll(v) {
  return hygieneEintraege(v, arbeitsschutzVoll(v, { ...vollErzeugt(v), ...(REALISTISCH[v.id] ?? {}), ...(v.bereich === "gastro" ? lebensmittelVoll(v) : {}) }));
}

/**
 * Weitere Varianten (Nachkontrolle Dr. Weber): Nachweis ohne § 2a-Branche (Textform, ohne Schriftform-Zeile) und
 * Hygieneplan eines Lebensmittelbetriebs.
 */
const EXTRA = {
  // E-167: Unterweisung Gefahrstoffe – Hinweis zur Unterschrift über der Teilnahmeliste
  unterweisung: [["voll-gefahrstoffe", (v) => ({ ...voll(v), thema: "Unterweisung Gefahrstoffe", themen: ["gefahrstoffe_inhalt_der_betriebsanweisun", "friseurchemikalien_faerbe_blondier_dauer", "hautschutz_hautschutzplan_richtige_schut"], ba_nummer: "BA-01, BA-02", verstaendnis: "Fragen zu den Inhalten", teilnehmer: [{ name: "Jana Becker" }, { name: "Lea Kim" }, { name: "Mehmet Aydın" }], unterschriften_papier: true })]],
  nachweis_arbeitsbedingungen: [["voll-textform", (v) => ({ ...voll(v), branche: "keine" })]],
  hygieneplan: [["voll-lebensmittel", (v) => hygieneEintraege(v, { ...voll(v), art: "lebensmittel", bereich: "Backstube, Theke und Gastraum", erstellt_von: "Mara Lindner" })], ["leer-lebensmittel", (v) => ({ ...F.leereDaten(v, B_LM, HEUTE), art: "lebensmittel" })]],
};
function vollErzeugt(v) {
  const BB = betriebFuer(v, "voll");
  const d = F.leereDaten(v, BB, HEUTE);
  const wert = (f, i) => {
    if (f.art === "text") return /name|von|person/i.test(f.label) ? "Maximiliane Großmann-Überlinger" : `${f.label} ${i + 1}`;
    if (f.art === "mehrzeilig") return `${LANG}.\nZweite Zeile mit weiteren Angaben.`;
    if (f.art === "betrag") return i % 5 === 4 ? "-1.234,56" : "12.345,67";
    if (f.art === "zahl") return "3";
    if (f.art === "datum") return HEUTE;
    if (f.art === "uhrzeit") return "09:30";
    return d[f.id] ?? null;
  };
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (f.art === "liste") {
        const vs = f.vorschlaege ?? [];
        d[f.id] = Array.from({ length: Math.max(12, Math.min(vs.length, 20)) }, (_, i) => {
          if (vs.length) return F.eintragAusVorschlag(f, vs[i % vs.length], BB, HEUTE);
          const e = F.neuerEintrag(f, BB, HEUTE);
          for (const x of f.felder) if (["text", "mehrzeilig", "betrag", "zahl", "datum", "uhrzeit"].includes(x.art)) e[x.id] = x.art === "mehrzeilig" ? LANG : wert(x, i);
          return e;
        });
      } else if (["text", "mehrzeilig", "betrag", "zahl", "uhrzeit", "datum"].includes(f.art) && !d[f.id]) d[f.id] = wert(f, 0);
      // Bausteine ohne Startauswahl (z. B. Verarbeitungen der Datenschutzinformation): die ersten vier passenden – sonst
      // blieben die Abschnitte, die erst durch eine Auswahl entstehen, in „voll“ leer (Vorprüfung 21.10.2026, Befund 1)
      else if (f.art === "bausteine" && !(d[f.id] ?? []).length) d[f.id] = f.optionen.filter((o) => F.optionSichtbar(o, d)).slice(0, 4).map((o) => o.wert);
    }
  return d;
}

/**
 * „auswahl“: wie „voll“, dazu jede Auswahl auf eine andere als die Startoption, alle Schalter umgelegt, alle
 * Mehrfach- und Bausteinfelder voll und alle Datumsfelder gesetzt – so erscheinen auch die Abschnitte, die erst durch
 * eine Wahl sichtbar werden.
 */
function auswahl(v) {
  const d = voll(v);
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (f.art === "wahl" && f.optionen.length) d[f.id] = (f.optionen.find((o) => o.wert !== d[f.id]) ?? f.optionen[0]).wert;
      else if (f.art === "schalter") d[f.id] = d[f.id] !== true;
      else if ((f.art === "mehrfach" || f.art === "bausteine") && f.optionen.length) d[f.id] = f.optionen.map((o) => o.wert);
      else if (f.art === "datum" && !d[f.id]) d[f.id] = HEUTE;
      else if (f.art === "liste" && Array.isArray(d[f.id]))
        // auch in Listen: jeder zweite Eintrag mit umgestellten Auswahlen und Schaltern (z. B. „Beleg fehlt“, „nicht bestanden“)
        d[f.id] = d[f.id].map((e, i) => {
          if (i % 2 === 0) return e;
          const n = { ...e };
          for (const x of f.felder) {
            if (x.art === "wahl" && x.optionen.length) n[x.id] = (x.optionen.find((o) => o.wert !== n[x.id]) ?? x.optionen[0]).wert;
            else if (x.art === "schalter") n[x.id] = n[x.id] !== true;
            else if ((x.art === "mehrfach" || x.art === "bausteine") && x.optionen.length) n[x.id] = x.optionen.map((o) => o.wert);
            else if (x.art === "datum" && !n[x.id]) n[x.id] = HEUTE;
          }
          return n;
        });
    }
  return hygieneEintraege(v, d);
}

const MM = 72 / 25.4;
const px = (mm) => `${(Math.round(mm * MM) * 4) / 3}px`;
const pdftotext = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
const befunde = [];
for (const v of F.VORLAGEN) {
  for (const [variante, daten] of [["leer", F.leereDaten(v, betriebFuer(v, "leer"), HEUTE)], ["voll", voll(v)], ["auswahl", auswahl(v)], ...(EXTRA[v.id] ?? []).map(([n, f]) => [n, f(v)])]) {
    const name = `${v.id}-${variante}`;
    const html = F.mitSchriften(F.dokumentHtml(v, daten, betriebFuer(v, variante)));
    const ang = F.fussAngaben(html);
    const [o, r, u, l] = F.RAENDER[ang.gestalt] ?? F.RAENDER.nachweis;
    const quer = !!v.querformat;
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    await page.setViewportSize({ width: Math.round((((quer ? 297 : 210) - r - l) * 96) / 25.4), height: 1000 });
    const dom = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const raus = [];
      for (const el of document.querySelectorAll("body *")) {
        const rc = el.getBoundingClientRect();
        if (!rc.width && !rc.height) continue;
        if (rc.right > W + 1 || rc.left < -1) raus.push(`${el.tagName.toLowerCase()}.${String(el.className).replace(/ /g, ".")} „${(el.textContent || "").trim().slice(0, 40)}“`);
      }
      return { raus: [...new Set(raus)].slice(0, 3), unterschriften: [...document.querySelectorAll(".unterschrift span")].map((s) => s.textContent.trim()) };
    });
    for (const x of dom.raus) befunde.push(`${name}: über den Satzspiegel: ${x}`);
    await page.emulateMedia({ media: null });
    const pdf = await page.pdf({ format: "A4", landscape: quer, margin: { top: px(o), right: px(r), bottom: px(u), left: px(l) }, printBackground: true });
    const datei = path.join(OUT, `${name}.pdf`);
    fs.writeFileSync(datei, await F.fusszeileStempeln(new Uint8Array(pdf), ang));
    if (!pdftotext) continue;
    const seiten = execFileSync("pdftotext", ["-layout", datei, "-"], { encoding: "utf8" }).split("\f").filter((s) => s.trim());
    // gewollte Seitenumbrüche (Klasse „neue-seite“, z. B. Erläuterung als eigenes Blatt) zählen nicht als Überlauf
    const blaetter = 1 + (html.match(/class="[^"]*\bneue-seite\b/g) ?? []).length;
    if (ang.gestalt === "aushang" && variante === "leer" && seiten.length > blaetter) befunde.push(`${name}: Aushang braucht ${seiten.length} Blätter`);
    seiten.forEach((s, i) => {
      if (i === 0 || !dom.unterschriften.length) return;
      // Zeilen ohne Kopf- und Fußzeile, ohne Unterschriftsbeschriftungen
      const zeilen = s.split("\n").map((z) => z.trim()).filter(Boolean).slice(1, -1);
      const rest = zeilen.filter((z) => !dom.unterschriften.some((w) => z.includes(w)));
      if (zeilen.length && !rest.length) befunde.push(`${name}: Seite ${i + 1} enthält nur den Unterschriftsblock`);
    });
  }
}
await browser.close();
console.log(befunde.length ? befunde.join("\n") : `Keine Befunde (${F.VORLAGEN.length} Vorlagen × 3). PDFs: ${OUT}`);
process.exit(befunde.length ? 1 : 0);
