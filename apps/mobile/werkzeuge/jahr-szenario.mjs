/**
 * Jahres-Szenario „Café Morgenrot“ 2026 (Einzelunternehmen, Leipzig, Soll-Versteuerung, 2 Beschäftigte, Kasse mit TSE):
 * erzeugt mit den echten Funktionen der App alle Unterlagen eines Jahres – Rechnungen (PDF + XRechnung) inkl. Storno,
 * Belege (inkl. empfangener E-Rechnung), die passenden Dokumentvorlagen, USt-Voranmeldungen Q1–Q4 (Übernahme aus
 * Rechnungen), EÜR (Übernahme), Steuerberater-Pakete Q4 und Jahr (entpackt) – und schreibt SZENARIO.md mit allen
 * Eingaben, den unabhängig gerechneten Erwartungswerten (werkzeuge/jahr-szenario-daten.ts) und jeder Abweichung.
 *
 * Zweck: ein realistischer Jahreslauf als Regressionsprüfung für Rechnungen, Belege, USt-Voranmeldung, EÜR, Steuerberater-
 * Paket, Dateinamen und Pflichten-Check. Jede Zahl der App wird gegen eine unabhängige Rechnung (jahr-szenario-daten.ts,
 * ohne App-Funktionen) verglichen; Abweichungen stehen in SZENARIO.md unter „Auffälligkeiten“, die PDFs und PNGs daneben
 * zum Durchsehen. Nach Änderungen an Steuer-, Rechnungs- oder Pflichtenlogik laufen lassen (ca. 20 s).
 *
 *   cd apps/mobile && node werkzeuge/jahr-szenario.mjs [ausgabe]     # Standard: /tmp/claude-0/jahr
 *   CHROMIUM_PFAD=…   anderer Chromium (Standard /opt/pw-browsers/chromium)
 *   KOSIT=<ordner>    optional: KoSIT-Validator prüfen lassen (<ordner>/v/validator-*.jar, <ordner>/cfg/scenarios.xml)
 *
 * Voraussetzungen: pnpm install (esbuild, playwright-core aus apps/web), gebaute Pakete (@amtlos/fachlogik dist),
 * Chromium, pdftotext (poppler). Aufbau: jahr-szenario-daten.ts = Eingaben und Erwartungswerte, jahr-szenario.ts = der
 * Stand mit denselben Funktionen wie in der App (wird hier mit esbuild gebündelt), diese Datei = PDFs, Pakete, Bericht.
 * Fachliche Beobachtungen, die sich nicht als Zahlvergleich automatisieren lassen, stehen in BEOBACHTUNGEN.
 *
 * Ändert keinen Produktcode und schreibt nichts ins Repository.
 */
/* global URL, process, document, TextEncoder, TextDecoder, Buffer, console -- Node-Skript (document: im Browser per page.evaluate) */
/* eslint-disable no-console -- Ausgabe auf der Konsole ist der Zweck des Werkzeugs */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MARKE } from "../../../packages/marke/index.js";

/**
 * Beobachtungen, die beim Erstellen des Szenarios (Oktober 2026) beim Durchsehen der PDFs und Pakete aufgefallen sind
 * und sich nicht als Zahlvergleich automatisieren lassen. Bei jedem Lauf erneut prüfen und hier pflegen.
 */
const BEOBACHTUNGEN = [
  "**Kassenumsätze kommen seit R12 aus der App.** Die Inhaberin erfasst jeden Abend den Tagesabschluss (Umsatz je Satz brutto laut Z-Bon, Kartenanteil, Geldtransit/Privatentnahme). „Aus Rechnungen übernehmen“ (USt-VA) übernimmt die Kassenumsätze (Netto je Monat aus der Bruttosumme), „EÜR übernehmen“ stellt Kasseneinnahmen und Umsatzsteuer in eigene Zeilen, der DATEV-Stapel bucht nur das Bargeld über die Kasse und den Kartenanteil direkt Geldtransit 1360 an Erlöse; die Barbelege des Mai stehen gegen Kasse, ein Kassenminus entsteht nicht. Vorher waren das rund 160.000 € netto, die von Hand ergänzt werden mussten.",
  "**R12 GoBD – Sonderfälle im November:** Kartentrinkgeld 18,50 € (07.11., bar ans Personal: Geldtransit an Kasse, kein Umsatz), Korrektur des 10.11. mit Grund (Historie, im Kassenbuch „korrigiert am …“), Gutscheine (14.11. verkauft: Mehrzweck 50 € an 1700, Einzweck 21,40 € zu 7 % als Erlös; 21.11. eingelöst: Mehrzweck Verbindlichkeit an Erlöse, Einzweck nicht noch einmal versteuert), Rechnung 2026-015 am 26.11. bar an der Kasse kassiert (Kasse an Forderungen, Zahlung an der Rechnung vermerkt), Kassensturz mit Zählprotokoll und Zählung am 28.11. mit 2,30 € Überschuss (gebucht als Erlös 19 %, in der VA Q4), Beleg b33 mit 2 % Skonto auf eine Wartung (gegen das Aufwandskonto 4900 mit BU 9). Einen Kassenbericht (retrograd) gibt es beim Café mit TSE-Kasse nicht – er ist nur bei offener Ladenkasse zulässig.",
  "**Quartalsübergreifende Rechnungskorrektur (2026-009 → Storno 2026-010 + neue Rechnung 2026-011, Leistung 20.06.):** `umsaetzeFuer` zählt die Stornorechnung im Zeitraum des Stornos (Q3, −40 Personen), die neue Rechnung aber nach ihrem Leistungsdatum im Q2. Dieselbe Leistung steht damit in Q2 doppelt (40 + 32 Personen: +768,00 € zu 7 %, +528,00 € zu 19 %), Q3 wird um 40 statt um 8 Personen gemindert. Das Jahr stimmt, die Quartale nicht (Zahllast Q2 +154,08 €, Q3 −154,08 €). Erwartet nach § 17 Abs. 1 / § 14c Abs. 1 UStG: Q2 mit dem ursprünglich berechneten Entgelt (40 Personen), Q3 nur die Differenz (−8 Personen). Fachlich bestätigen lassen; in den Notizen der VA Q3 erscheinen deshalb negative Rechnungsumsätze.",
  "**EÜR-Übernahme ohne USt-Zahlungen und ohne AfA:** Die an das Finanzamt gezahlten USt-Vorauszahlungen (hier 9.658,09 €) und die Abschreibung der Spülmaschine (575,00 €) muss man weiter von Hand eintragen; seit Oktober 2026 sagt die Übernahme das ausdrücklich („Nicht enthalten: … Umsatzsteuer-Vorauszahlungen … Abschreibungen (AfA) – bitte selbst ergänzen“). Ausrechnen tut die App beides nicht.",
  "**Innergemeinschaftliche Lieferung nach Österreich (2026-012):** Rechnung, XRechnung (VATEX-EU-IC, Lieferanschrift) und Kz-Hinweis in der VA sind in Ordnung, die EÜR-Übernahme stellt die 841,00 € in die Zeile „Umsatzsteuerfreie, nicht umsatzsteuerbare Betriebseinnahmen …“ (behoben Oktober 2026). Offen: DATEV bucht auf 8100 statt 8125 (in buchungen.ts als Prüfpunkt vermerkt), die VA hat kein eigenes Feld „Kz 41“ (nur „Umsätze ohne Umsatzsteuer“), und für die Zusammenfassende Meldung, die der Pflichten-Check bei Kunden in anderen EU-Ländern richtig anzeigt, gibt es keine Vorlage.",
  "**Kategorien ↔ Anlage EÜR/SKR03:** Strom und Gas haben keine eigene Kategorie und landen bei „Miete und Nebenkosten“ (Anlage EÜR „Miete/Pacht für Geschäftsräume“, SKR03 4210 statt z. B. 4240 Gas, Strom, Wasser). „Fremdleistungen“ wird zur Zeile „Bezogene Leistungen“ – für Schädlingsmonitoring und DGUV-Prüfung (hier so erfasst, wie es eine Inhaberin wohl täte) ist das fachlich fraglich. (Die Zeilen der Übernahme stehen inzwischen alle in der Vorschlagsliste der EÜR-Vorlage – geprüft unter „Auffälligkeiten“.)",
  "**Hygieneplan und Hautschutzplan sind Beauty-Vorlagen:** Kopf „Beauty und Kosmetik“, Rechtsgrundlage des Hygieneplans „Hygieneverordnung des Landes (auf Grundlage des IfSG)“ – für einen Lebensmittelbetrieb unpassend (dort VO (EG) Nr. 852/2004, LMHV). Der Anlass „Café, Restaurant, Lebensmittel“ verlinkt den Hygieneplan nicht mehr (dort HACCP-Eigenkontrollen); das Szenario erzeugt ihn trotzdem mit eigenen Einträgen, um die Vorlage mitzuprüfen.",
  "**Gefährdungsbeurteilung Gastro-Vorschläge:** inhaltlich gut, aber auf Großküchen zugeschnitten (Kippbratpfannen, Kochkessel, Gasgeräte, Druckgarer). Für ein kleines Café wurden sie unverändert übernommen – Prüfer sollten beurteilen, ob das so stehen bleiben darf.",
  "**Pflichten-Check für einen bestehenden Betrieb (behoben Oktober 2026):** Pflichten mit einem Ereignis als Auslöser erschienen nie, weil `auswertung()` keine Ereignisse übergab. Jetzt leitet die App dieselben Ereignisse ab, die der Server aus seinen Datensätzen hat: Beschäftigte im Profil ⇒ „einstellung“/„erste_einstellung“ (Tag: Gründungsdatum), ausgegebene Unterweisung ⇒ „unterweisung_durchgefuehrt“. Damit gelten IfSG-Belehrung, Erstunterweisung, NachwG, SV-Anmeldung und Sofortmeldung, und nach der Unterweisung vom 10.02.2026 steht die Wiederholung zum 10.02.2027 an. Offen: Der Katalog kennt die Folgebelehrung nach § 43 Abs. 4 IfSG (alle zwei Jahre) nicht als eigene Pflicht, und ein Hygieneplan ist im Katalog nur für Beauty vorgesehen.",
  "**Rechnungen an Privatpersonen** (2026-003, 2026-014) beginnen fest mit „Sehr geehrte Damen und Herren“.",
  "**Dateinamen (behoben Oktober 2026):** `pdfDateiname()` schreibt Umlaute und Akzente um („Cafe-Morgenrot“, „Krause-Soehne“, „Lohnbuero“), kürzt bei langen Namen den Namen statt des Datums und setzt das Datum beim Prüfprotokoll nur einmal; geprüft im Abschnitt Vergleich (Dateinamen, Paket).",
  "**E-Rechnung einlesen:** Die Käuferreferenz (BT-10, hier „Kundennr. 10233“) wird nicht mehr als Verwendungszweck übernommen (nur BT-83: PaymentID bzw. PaymentReference; behoben Oktober 2026). Die Kategorie steht zunächst auf „Sonstiges“ und muss geändert werden.",
  "**Zuordnung Paket ↔ Voranmeldung:** Das Steuerberater-Paket ordnet Rechnungen nach Rechnungsdatum, die VA nach Leistungsdatum. Rechnung 2026-011 (Leistung Juni) steckt im Paket Q3 (falls eines erzeugt wird), zählt aber in der VA Q2; 2026-016 (bezahlt 2027) und b14 (bezahlt 2027) stehen in Paket und VA Q4, in der EÜR 2027 – beides richtig. Seit Oktober 2026 erklärt LIESMICH.txt den Unterschied.",
  "**Geprüft und unauffällig:** alle Rechnungsbeträge (Mengen 0,5 kg, 1,5 kg, 2,75 h, 4,25 h, 5,5 h; Rabattzeile; gemischte Sätze; Storno mit negativen Beträgen), fortlaufende Nummern inkl. Stornos, Festschreibung, 16 XRechnungen vom KoSIT-Validator akzeptiert (wenn KOSIT gesetzt), Vorsteuer aus Brutto ohne Cent-Abweichung zu den ausgewiesenen Beträgen, Kassenbuch-Endbestand, DATEV-Zeilenzahl und Spaltenzahl, Belegdateien im Paket.",
];

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? "/tmp/claude-0/jahr");
for (const d of ["pdf", "rechnungen", "png", "belege", "steuerpaket-q4", "steuerpaket-jahr"]) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

// ---------------------------------------------------------------- bündeln
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const gebaut = path.join(OUT, ".jahr-szenario.mjs");
execFileSync(path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild"), [path.join(HIER, "jahr-szenario.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const S = await import(gebaut);
fs.rmSync(gebaut);
const D = S.D;

const bau = S.standBauen();
const { s } = bau;
const auffaellig = [...bau.auffaellig];
const vergleiche = [...bau.vergleiche];
const vergleich = (bereich, was, app, erwartet) => {
  const ok = app === erwartet;
  vergleiche.push({ bereich, was, app: typeof app === "number" ? D.eur(app) : String(app), erwartet: typeof erwartet === "number" ? D.eur(erwartet) : String(erwartet), ok });
  if (!ok) auffaellig.push(`${bereich} – ${was}: App ${typeof app === "number" ? D.eur(app) : app}, erwartet ${typeof erwartet === "number" ? D.eur(erwartet) : erwartet}.`);
};

// ---------------------------------------------------------------- PDF wie die App
const MM = 72 / 25.4;
const pt = (mm) => `${(Math.round(mm * MM) * 4) / 3}px`; // wie raender() in src/unterlagen/pdf.ts: auf ganze Punkt gerundet
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
async function appPdf(roh, quer) {
  const html = S.mitSchriften(roh);
  const ang = S.fussAngaben(html);
  const [o, r, u, l] = S.RAENDER[ang.gestalt] ?? S.RAENDER.nachweis;
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ format: "A4", landscape: quer, margin: { top: pt(o), right: pt(r), bottom: pt(u), left: pt(l) }, printBackground: true });
  return S.fusszeileStempeln(new Uint8Array(pdf), ang);
}
async function einfachPdf(html) {
  await page.setContent(html, { waitUntil: "load" });
  return new Uint8Array(await page.pdf({ format: "A4", printBackground: true }));
}

const dateien = []; // { pfad, art, inhalt }
const merke = (rel, inhalt) => dateien.push({ rel, inhalt });

for (const d of bau.docs) {
  const rel = `${d.ordner}/${d.datei}`;
  fs.writeFileSync(path.join(OUT, rel), await appPdf(S.dokHtml(s, d.uid), d.quer));
  merke(rel, `${d.titel}: ${d.worum}`);
}
for (const x of bau.xmls) {
  fs.writeFileSync(path.join(OUT, "rechnungen", x.datei), x.xml);
  merke(`rechnungen/${x.datei}`, `XRechnung 3.0 (UBL) zu Rechnung ${x.nummer}, erzeugt mit eRechnungAus + xrechnungUbl wie „Als E-Rechnung teilen“.`);
}

// Belegdateien (Eingaben, wie sie der Betrieb bekommt) – PDF gerendert, E-Rechnung als XML
const belegBytes = {};
for (const b of bau.belegDateien) {
  const bytes = b.xml ? new TextEncoder().encode(b.xml) : await einfachPdf(b.html);
  belegBytes[b.datei] = bytes;
  fs.writeFileSync(path.join(OUT, "belege", b.datei), bytes);
  const roh = D.BELEGE.find((x) => b.datei.startsWith(x.id));
  merke(`belege/${b.datei}`, `Eingabe: ${roh.lieferant} ${roh.nummer ?? ""} vom ${D.de(roh.datum)} – ${roh.worum}`);
}
await browser.close();

// ---------------------------------------------------------------- Steuerberater-Pakete
const pk = S.pakete(s, belegBytes);
const csvLesen = (bytes, kodierung = "utf8") => {
  const txt = kodierung === "latin1" ? Buffer.from(bytes).toString("latin1") : new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
  return txt.split(/\r\n/).filter(Boolean).map((z) => {
    const f = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < z.length; i++) {
      const c = z[i];
      if (q) {
        if (c === '"' && z[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ";") { f.push(cur); cur = ""; }
      else cur += c;
    }
    f.push(cur);
    return f;
  });
};
const centAus = (t) => {
  const m = /^(-?)([\d.]*),(\d{2})$/.exec(String(t).trim());
  return m ? (m[1] ? -1 : 1) * (Number(m[2].replace(/\./g, "")) * 100 + Number(m[3])) : NaN;
};
const summe = (l) => l.reduce((a, b) => a + b, 0);

/** CSV-Liste des Pakets mit Spalten nach Namen (Anfang des Spaltennamens genügt); Summenzeilen („Summe …“) getrennt */
const liste = (bytes) => {
  const [kopf, ...alle] = csvLesen(bytes);
  const sp = (name) => {
    const genau = kopf.indexOf(name);
    const i = genau >= 0 ? genau : kopf.findIndex((k) => k.startsWith(name));
    if (i < 0) throw new Error(`Spalte „${name}“ fehlt: ${kopf.join(";")}`);
    return i;
  };
  return { kopf, zeilen: alle.filter((z) => !/^Summe\b/.test(z[0])), summen: alle.filter((z) => /^Summe\b/.test(z[0])), sp, w: (z, name) => z[sp(name)] };
};
const isoAusDe = (t) => (/^\d{2}\.\d{2}\.\d{4}/.test(t) ? `${t.slice(6, 10)}-${t.slice(3, 5)}-${t.slice(0, 2)}` : "");
/**
 * Neuerungen nach der Durchsicht der Steuerberaterin (Oktober 2026): Spalten und Summenzeilen der Listen, Amtlos-Belegnummer
 * in Liste, Dateiname und DATEV, Buchungs-GUID, Buchungstext, Fragen-Datei, Mandanten- und „Nicht enthalten“-Block.
 */
function paketNeuerungen(name, zr, inhalt, erg, kleinunternehmer, belegeRoh) {
  const bereich = `Paket ${name}`;
  const re = liste(inhalt[`Rechnungen_${zr.name}.csv`]);
  const be = liste(inhalt[`Belege_${zr.name}.csv`]);
  vergleich(bereich, "Rechnungsliste: neue Spalten Steuerart, Fällig am, Offener Betrag, USt-IdNr. Kunde, Leistungszeitraum", ["Steuerart", "Fällig am", "Offener Betrag", "USt-IdNr.", "Leistungszeitraum"].filter((n) => !re.kopf.some((k) => k.startsWith(n))).join(", ") || "alle", "alle");
  const gesamt = re.summen.find((z) => z[0] === "Summe gesamt");
  if (re.zeilen.length) {
    vergleich(bereich, "Rechnungsliste: „Summe gesamt“ Brutto = Summe der Zeilen", gesamt ? centAus(re.w(gesamt, "Brutto")) : NaN, summe(re.zeilen.map((z) => centAus(re.w(z, "Brutto")))));
    vergleich(bereich, "Rechnungsliste: Summen je Steuersatz ergeben „Summe gesamt“ (Netto)", summe(re.summen.filter((z) => z !== gesamt).map((z) => centAus(re.w(z, "Netto")))), gesamt ? centAus(re.w(gesamt, "Netto")) : NaN);
    vergleich(bereich, "Rechnungsliste: „Summe gesamt“ offener Betrag = Summe der Zeilen", gesamt ? centAus(re.w(gesamt, "Offener Betrag")) : NaN, summe(re.zeilen.map((z) => centAus(re.w(z, "Offener Betrag")))));
  }
  const reihenfolge = re.zeilen.map((z) => `${isoAusDe(re.w(z, "Datum"))}|${re.w(z, "Nummer")}`);
  vergleich(bereich, "Rechnungsliste: sortiert nach Datum, dann Nummer", reihenfolge.every((x, i) => i === 0 || reihenfolge[i - 1].localeCompare(x, "de", { numeric: true }) <= 0) ? "ja" : "nein", "ja");
  const alleCsv = Object.keys(inhalt).filter((p) => p.endsWith(".csv") && !p.startsWith("EXTF")).map((p) => new TextDecoder().decode(inhalt[p]));
  vergleich(bereich, "Listen: kein „-0,00“", alleCsv.some((t) => /(^|;)-0,00(;|\r)/m.test(t)) ? "kommt vor" : "keins", "keins");
  if (be.zeilen.length) vergleich(bereich, "Belegliste: Summenzeile Brutto = Summe der Zeilen", be.summen[0] ? centAus(be.w(be.summen[0], "Brutto")) : NaN, summe(be.zeilen.map((z) => centAus(be.w(z, "Brutto")))));
  const nrn = be.zeilen.map((z) => be.w(z, `${MARKE.name}-Belegnr.`));
  vergleich(bereich, "Belegliste: Belegnr. der App eindeutig und in der Form B<Jahr>-nnn", nrn.every((n, i) => /^B\d{4}-\d{3}$/.test(n) && nrn.indexOf(n) === i) ? "ja" : nrn.join(", "), "ja");
  const dateiFalsch = be.zeilen.filter((z) => be.w(z, "Datei") && !(be.w(z, "Datei").startsWith(`${be.w(z, `${MARKE.name}-Belegnr.`)}_`) && inhalt[`Belege/${be.w(z, "Datei")}`]));
  vergleich(bereich, "Belegdateien beginnen mit der Belegnr. der App der Liste und liegen unter Belege/", dateiFalsch.length ? dateiFalsch.map((z) => be.w(z, "Datei")).join(", ") : "alle", "alle");
  const ohneZahltag = be.zeilen.filter((z) => /fehlt – Belegdatum verwendet/.test(be.w(z, "Zahltag"))).length;
  vergleich(bereich, "Belegliste: Markierung „fehlt – Belegdatum verwendet“ genau bei Belegen ohne Zahltag", String(ohneZahltag), String(belegeRoh.filter((b) => !b.bezahlt).length));
  const extf = csvLesen(inhalt[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1");
  const ez = extf.slice(2);
  const belegfelder = new Set(ez.map((z) => z[10]));
  // R10: Belege, die nicht in den Stapel gehören (Personal, Auslagen einer GmbH), sind in der Belegliste markiert
  const fehlend = be.zeilen.filter((z) => !/^nein/.test(be.w(z, "Im Buchungsstapel") ?? "")).map((z) => be.w(z, "Belegfeld 1 (DATEV)")).filter((b) => !belegfelder.has(b));
  vergleich(bereich, "DATEV: Belegfeld 1 der Belegbuchungen = Spalte „Belegfeld 1 (DATEV)“ der Belegliste", fehlend.length ? fehlend.join(", ") : "alle gefunden", "alle gefunden");
  const gi = extf[1].indexOf("Buchungs GUID");
  const guids = ez.map((z) => z[gi]);
  vergleich(bereich, "DATEV: Buchungs-GUID in jeder Zeile (36 Zeichen) und eindeutig", gi >= 0 && guids.every((g, i) => /^[0-9a-f-]{36}$/.test(g) && guids.indexOf(g) === i) ? "ja" : "nein", "ja");
  const texte = ez.map((z) => z[13]);
  vergleich(bereich, "DATEV: Buchungstext höchstens 60 Zeichen, ohne Leerzeichen am Ende", texte.filter((t) => t.length > 60 || t !== t.trimEnd()).join(" | ") || "alle", "alle");
  const bl = liste(inhalt[`Buchungsliste_${zr.name}.csv`]);
  vergleich(bereich, "Buchungsliste: GUIDs wie im DATEV-Stapel", bl.zeilen.map((z) => bl.w(z, "Buchungs-GUID")).sort().join(",") === [...guids].sort().join(",") ? "ja" : "nein", "ja");
  const fragen = inhalt[`Fragen_${zr.name}.txt`] ? Buffer.from(inhalt[`Fragen_${zr.name}.txt`]).toString("utf8") : "";
  vergleich(bereich, `Fragen_${zr.name}.txt vorhanden`, fragen ? "ja" : "nein", "ja");
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  vergleich(bereich, "LIESMICH: Mandant-Block und „Nicht enthalten – bitte zusätzlich liefern“", /Mandant \(Angaben aus der App\)/.test(liesmich) && /Nicht enthalten – bitte zusätzlich liefern/.test(liesmich) && /Kassenumsätze/.test(liesmich) && /Lohnjournal/.test(liesmich) ? "ja" : "nein", "ja");
  // Kasse laut Pflichten-Check (ja): Hinweis auf fehlende Kassenumsätze ganz oben im LIESMICH und in den Fragen
  // R10: der Kassenhinweis steht einmal an fester Stelle (LIESMICH, Abschnitt „Wichtig“), nicht mehr vor dem Kopf und in den Fragen
  // R12: mit Tagesabschlüssen in Amtlos sind die Kassenumsätze im Paket – der Satz sagt das einmal unter „Wichtig“
  vergleich(bereich, "LIESMICH: „Kassenumsätze aus … Tagesabschlüssen (Z-Bons) sind enthalten“ einmal unter „Wichtig“, kein „fehlen“", /\r\nWichtig\r\n- Kassenumsätze aus \d+ Tagesabschlüssen \(Z-Bons\) sind enthalten/.test(liesmich) && liesmich.split("Kassenumsätze").length === 2 && !/Kassenumsätze fehlen/.test(liesmich) ? "ja" : "nein", "ja");
  vergleich(bereich, "Fragen: Kassenhinweis nicht doppelt", /Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket\./.test(fragen) ? "ja" : "nein", "nein");
  vergleich(bereich, "LIESMICH: Kleinunternehmer ja/nein", (/Kleinunternehmer \(§ 19 UStG\): (ja|nein)/.exec(liesmich) ?? [])[1] ?? "fehlt", kleinunternehmer ? "ja" : "nein");
  const jahr = /^\d{4}$/.test(zr.name);
  vergleich(bereich, "LIESMICH: Satz „Nicht zusätzlich zu den Monats-/Quartalsstapeln importieren“ genau im Jahrespaket", /Nicht zusätzlich zu den Monats-\/Quartalsstapeln importieren/.test(liesmich) ? "ja" : "nein", jahr ? "ja" : "nein");
  const ohneXmlZeilen = (liesmich.split("Rechnungen ohne E-Rechnung (XRechnung)")[1] ?? "").split(/\r\n\r\n/)[0].split("\r\n").filter((z) => z.startsWith("- "));
  vergleich(bereich, "LIESMICH: Rechnungen ohne E-Rechnung einzeln mit Grund", String(ohneXmlZeilen.length), String(erg.ohneXml));
  return { fragen, liesmich, rechnungen: re, belege: be };
}

function paketPruefen(name, zr, erg, ordner) {
  const zip = path.join(OUT, erg.dateiname);
  fs.writeFileSync(zip, erg.zip);
  merke(erg.dateiname, `Steuerberater-Paket ${name} (steuerpaket(), ZIP wie in der App).`);
  const inhalt = S.unzipSync(erg.zip);
  for (const [p, bytes] of Object.entries(inhalt)) {
    fs.mkdirSync(path.dirname(path.join(OUT, ordner, p)), { recursive: true });
    fs.writeFileSync(path.join(OUT, ordner, p), bytes);
  }
  merke(`${ordner}/`, `entpacktes Paket ${name}: ${Object.keys(inhalt).length} Dateien (${Object.keys(inhalt).filter((p) => !p.includes("/")).join(", ")}, E-Rechnungen/, Belege/).`);
  const im = (iso) => iso >= zr.von && iso <= zr.bis;
  // erwartete Werte – unabhängig
  const vg = D.vorgaenge().filter((x) => im(x.datum));
  const bl = D.BELEGE.filter((b) => im(b.datum));
  // Spalten nach Namen, ohne die Summenzeilen am Ende
  const reL = liste(inhalt[`Rechnungen_${zr.name}.csv`]);
  const re = reL.zeilen;
  vergleich(`Paket ${name}`, "Anzahl Rechnungen (nach Rechnungsdatum)", re.length, vg.length);
  vergleich(`Paket ${name}`, "Rechnungsliste: Summe Netto", summe(re.map((z) => centAus(reL.w(z, "Netto")))), summe(vg.map((x) => x.vz * x.s.netto)));
  vergleich(`Paket ${name}`, "Rechnungsliste: Summe USt", summe(re.map((z) => centAus(reL.w(z, "USt")))), summe(vg.map((x) => x.vz * x.s.ust)));
  vergleich(`Paket ${name}`, "Rechnungsliste: Summe Brutto", summe(re.map((z) => centAus(reL.w(z, "Brutto")))), summe(vg.map((x) => x.vz * x.s.brutto)));
  const beL = liste(inhalt[`Belege_${zr.name}.csv`]);
  const be = beL.zeilen;
  vergleich(`Paket ${name}`, "Anzahl Belege (nach Belegdatum)", be.length, bl.length);
  vergleich(`Paket ${name}`, "Belegliste: Summe Brutto", summe(be.map((z) => centAus(beL.w(z, "Brutto")))), summe(bl.map((b) => D.belegSumme(b).brutto)));
  vergleich(`Paket ${name}`, "Belegliste: Summe Vorsteuer (Beleg weist aus)", summe(be.map((z) => centAus(beL.w(z, "Vorsteuer")))), summe(bl.map((b) => D.belegSumme(b).vorsteuer)));
  vergleich(`Paket ${name}`, "Belegdateien im Paket", Object.keys(inhalt).filter((p) => p.startsWith("Belege/")).length, bl.length);
  const ohneXml = vg.filter((x) => !("email" in D.KUNDEN[x.kunde])).length;
  vergleich(`Paket ${name}`, "E-Rechnungen im Paket", Object.keys(inhalt).filter((p) => p.startsWith("E-Rechnungen/")).length, vg.length - ohneXml);
  // DATEV: je Rechnung und Satz bzw. Beleg und Satz eine Buchung; Erlöskonten SKR03 (igl richtig: 8125)
  const extf = csvLesen(inhalt[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1");
  const zeilen = extf.slice(2);
  // R12: Tagesabschlüsse – je Tag 19 %, 7 %, Kartenanteil und die Bewegungen (Geldtransit, Privatentnahme)
  const kt = D.KASSE_TAGE.filter((k) => im(k.datum));
  // R12 GoBD: je Tag und Satz eine Buchung für den Kartenanteil (Geldtransit an Erlöse) und eine für den Baranteil
  // (Kasse an Erlöse); Gutscheinverkauf: dazu Mehrzweck-Gutschein als drittes Ziel, Einlösung: Verbindlichkeit an Erlöse;
  // Trinkgeld, bar kassierte Rechnung und Kassendifferenz je eine Buchung
  const SO = D.KASSE_SONDER;
  const saetze = (k) => (k.b19 ? 1 : 0) + (k.b7 ? 1 : 0);
  const erwKasse =
    summe(kt.map((k) => (k.datum === SO.gutscheinVerkauf.datum ? 2 * (saetze(k) + 1) : k.datum === SO.gutscheinEinloesung.datum ? 3 * saetze(k) : 2 * saetze(k)) + (k.datum === SO.trinkgeld.datum ? 1 : 0) + (k.datum === SO.barRechnung.datum ? 1 : 0) + (k.datum === SO.zaehlung.datum ? 1 : 0))) +
    D.KASSEN_BEWEGUNGEN_ROH.filter((b) => im(b.datum)).length;
  const erwSkonto = bl.filter((b) => b.skonto && im(b.bezahlt ?? b.datum)).length;
  const erwBuchungen = summe(vg.map((x) => Object.values(x.s.gruppen).filter((g) => g.netto + g.ust !== 0).length)) + summe(bl.filter((b) => b.kategorie !== "personal").map((b) => b.saetze.filter((x) => x.betrag).length)) + erwKasse + erwSkonto; // R10: Personal nicht im Stapel
  vergleich(`Paket ${name}`, "DATEV: Anzahl Buchungen", zeilen.length, erwBuchungen);
  vergleich(`Paket ${name}`, "DATEV: Spalten je Zeile = Spalten im Kopf", zeilen.every((z) => z.length === extf[1].length) ? "ja" : "nein", "ja");
  const kontoSumme = (konto) => summe(zeilen.filter((z) => z[7] === konto).map((z) => (z[1] === "H" ? -1 : 1) * centAus(z[0])));
  const erl = { 19: "8400", 7: "8300", 0: "8125" };
  for (const [satz, konto] of Object.entries(erl)) {
    // R12 GoBD: Kassenüberschuss als Erlös 19 %; Einzweck-Gutschein 7 % (Verkauf + / Einlösung −) gleicht sich im Monat aus
    const ueber = im(SO.zaehlung.datum) ? SO.zaehlung.ueberschuss : 0;
    const ez = (im(SO.gutscheinVerkauf.datum) ? SO.gutscheinVerkauf.einzweck7 : 0) - (im(SO.gutscheinEinloesung.datum) ? SO.gutscheinEinloesung.einzweck7 : 0);
    const erw = summe(vg.map((x) => (x.vz * ((x.s.gruppen[satz]?.netto ?? 0) + (x.s.gruppen[satz]?.ust ?? 0))))) + (satz === "19" ? summe(kt.map((k) => k.b19)) + ueber : satz === "7" ? summe(kt.map((k) => k.b7)) + ez : 0);
    if (!erw) continue;
    vergleich(`Paket ${name}`, `DATEV: Brutto auf Erlöskonto ${konto} (${satz} %${satz === "0" ? ", steuerfreie igL – SKR03 8125" : ", Rechnungen und Tagesabschlüsse"})`, kontoSumme(konto), erw);
  }
  // R12: Kartenanteil der Kasse über Geldtransit; Barbelege gegen Kasse (Amtlos führt die Kasse ab 01.01.)
  // R12 GoBD: Kartenanteil direkt Geldtransit an Erlöse (bzw. an Gutschein-Verbindlichkeit), Trinkgeld und Bankeinzahlungen Geldtransit an Kasse
  vergleich(`Paket ${name}`, "DATEV: Geldtransit 1360 im Soll = Kartenzahlungen (mit Trinkgeld) + Bankeinzahlungen der Kasse", summe(zeilen.filter((z) => z[6] === "1360").map((z) => centAus(z[0]))), summe(kt.map((k) => k.b7 + k.b19 - k.bar)) + (im(SO.trinkgeld.datum) ? SO.trinkgeld.cent : 0) + summe(D.KASSEN_BEWEGUNGEN_ROH.filter((b) => im(b.datum) && b.art === "transit").map((b) => b.betrag)));
  vergleich(`Paket ${name}`, "DATEV: Kartenanteil nicht mehr über die Kasse (keine Buchung „Kartenzahlungen“ Geldtransit an Kasse)", zeilen.some((z) => z[6] === "1360" && z[7] === "1000" && /Kartenzahlungen/.test(z[13] ?? "")) ? "ja" : "nein", "nein");
  vergleich(`Paket ${name}`, "DATEV: Barbelege gegen Kasse 1000 (kein Geldtransit)", zeilen.filter((z) => z[7] === "1360").length ? "Geldtransit" : "Kasse", "Kasse");
  vergleich(`Paket ${name}`, "DATEV: Kopf Beraternummer/Mandant", `${extf[0][10]}/${extf[0][11]}`, "29098/10457");
  // Dateinamen: Umlaute umgeschrieben („Söhne“ → „Soehne“, „Lohnbüro“ → „Lohnbuero“), unabhängig nachgebaut
  const umschrift = (t) => t.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const dateien = Object.keys(inhalt).filter((p) => p.startsWith("Belege/"));
  const mitUmlaut = bl.filter((b) => /[äöüÄÖÜßéèáàç]/.test(b.lieferant));
  // Dateiname: Amtlos-Belegnummer vorn (B2026-017_), dann Datum_Lieferant
  const umschriebenOk = mitUmlaut.filter((b) => dateien.some((p) => p.replace(/^Belege\/B\d{4}-\d{3}_/, "Belege/").startsWith(`Belege/${b.datum}_${umschrift(b.lieferant).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30)}`))).length;
  if (mitUmlaut.length) vergleich(`Paket ${name}`, "Belegdateien: Umlaute/Akzente im Lieferanten umgeschrieben (ä → ae, é → e)", String(umschriebenOk), String(mitUmlaut.length));
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  vergleich(`Paket ${name}`, "LIESMICH: Hinweis Rechnungsdatum (Paket) ↔ Leistungsdatum (Voranmeldung)", /Leistungsdatum/.test(liesmich) ? "ja" : "nein", "ja");
  const neu = paketNeuerungen(name, zr, inhalt, erg, false, bl);
  // Café: Kassenumsätze fehlen – das LIESMICH sagt es jetzt; Kfz-/Bewirtungs-/Anlagebelege landen in der Fragen-Datei
  vergleich(`Paket ${name}`, "Fragen: Abschnitte nur für Belegarten, die es im Zeitraum gibt (Kfz, Bewirtung, Anlagen > 800 €)", ["fahrzeug", "bewirtung", "anlage"].filter((k) => bl.some((b) => b.kategorie === k) !== neu.fragen.includes({ fahrzeug: "Kfz-Kosten:", bewirtung: "Bewirtung:", anlage: "Anschaffungen über 800 €" }[k])).join(", ") || "passt", "passt");
  return { anzahl: Object.keys(inhalt).length, buchungen: zeilen.length, fragen: erg.fragen };
}
// ---------------------------------------------------------------- PDF-Dateinamen (dateiname der App)
{
  const nichtAscii = bau.docs.filter((d) => /[^A-Za-z0-9._-]/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen mit anderen Zeichen als A–Z, 0–9, „.“, „-“", nichtAscii.length ? nichtAscii.map((d) => d.datei).join(", ") : "keine", "keine");
  const ohneDatum = bau.docs.filter((d) => !/-\d{4}-\d{2}-\d{2}\.pdf$/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen enden mit vollständigem Datum (auch bei langen Namen)", ohneDatum.length ? ohneDatum.map((d) => d.datei).join(", ") : "alle", "alle");
  const doppelt = bau.docs.filter((d) => /(\d{4}-\d{2}-\d{2})-\1\.pdf$/.test(d.datei));
  vergleich("Dateinamen", "kein doppeltes Datum (Prüfprotokoll: Namensfeld ist das Datum)", doppelt.length ? doppelt.map((d) => d.datei).join(", ") : "keins", "keins");
  const cafe = bau.docs.filter((d) => d.datei.includes("Morgenrot"));
  vergleich("Dateinamen", "Namen mit „Caf-“ statt „Cafe-“", cafe.filter((d) => /Caf-/.test(d.datei)).map((d) => d.datei).join(", ") || "keine", "keine");
}

const pq4 = paketPruefen("Q4 2026", { von: "2026-10-01", bis: "2026-12-31", name: "2026-Q4" }, pk.q4, "steuerpaket-q4");
const pj = paketPruefen("Jahr 2026", { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, pk.jahr, "steuerpaket-jahr");

// ---------------------------------------------------------------- Texte in den PDFs prüfen (pdftotext)
// typografisches Minus (U+2212) der PDFs wie den Bindestrich der Erwartungswerte behandeln
const pdftext = (p) => execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8" }).replace(/\u2212/g, "-");
for (const x of D.vorgaenge()) {
  const d = bau.docs.find((y) => y.ordner === "rechnungen" && y.datei.includes(x.nummer));
  if (!d) continue;
  const txt = pdftext(path.join(OUT, "rechnungen", d.datei));
  const soll = `${x.vz < 0 ? "-" : ""}${D.eur(x.s.brutto)}`;
  if (!txt.replace(/\s+/g, " ").includes(soll)) auffaellig.push(`PDF ${d.datei}: Rechnungsbetrag ${soll} € nicht im Text gefunden.`);
}

// Rechnungen mit Folgeseite, auf der nur noch Hinweise und Gruß stehen
const nurSchluss = [];
for (const d of bau.docs.filter((y) => y.ordner === "rechnungen")) {
  const p = path.join(OUT, "rechnungen", d.datei);
  const seitenZahl = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [p], { encoding: "utf8" }))?.[1] ?? 1);
  if (seitenZahl < 2) continue;
  const s2 = execFileSync("pdftotext", ["-layout", "-f", "2", "-l", "2", p, "-"], { encoding: "utf8" });
  // Zahlungsblock („Bitte überweisen …“) auf Seite 2 ist Inhalt – nur Hinweise und Gruß allein wären ein unnötiger Umbruch
  if (!/Rechnungsbetrag|Pos\.|Bitte überweisen/.test(s2)) nurSchluss.push(d.datei.replace(/^\d+-/, "").replace(/\.pdf$/, ""));
}
if (nurSchluss.length) auffaellig.push(`Seitenumbruch: ${nurSchluss.length} von ${bau.docs.filter((y) => y.ordner === "rechnungen").length} Rechnungen haben eine zweite Seite, auf der nur Hinweise und Grußformel stehen (Seite 1 hat noch Platz): ${nurSchluss.join(", ")}.`);

// ---------------------------------------------------------------- KoSIT (optional)
let kosit = "nicht geprüft (Umgebungsvariable KOSIT nicht gesetzt)";
const KOSIT = process.env.KOSIT;
if (KOSIT && fs.existsSync(KOSIT)) {
  const jar = fs.readdirSync(path.join(KOSIT, "v")).find((f) => /^validator-.*\.jar$/.test(f));
  const sz = path.join(KOSIT, "cfg", "scenarios.xml");
  const berichte = path.join(OUT, ".kosit");
  fs.mkdirSync(berichte, { recursive: true });
  const xmlDateien = [...bau.xmls.map((x) => path.join(OUT, "rechnungen", x.datei)), path.join(OUT, "belege", "b16.xml")];
  try {
    execFileSync("java", ["-cp", `${path.join(KOSIT, "v", jar)}:${path.join(KOSIT, "v", "libs")}/*`, "de.kosit.validationtool.cmd.CommandLineApplication", "-s", sz, "-r", path.dirname(sz), "-o", berichte, ...xmlDateien], { stdio: "pipe" });
  } catch {
    /* Ergebnis steht in den Berichten */
  }
  const erg = xmlDateien.map((f) => {
    const b = fs.readdirSync(berichte).find((r) => r.startsWith(path.basename(f, ".xml")) && r.includes("report") && r.endsWith(".xml"));
    const txt = b ? fs.readFileSync(path.join(berichte, b), "utf8") : "";
    const ok = /<rep:accept/.test(txt);
    if (!ok) auffaellig.push(`KoSIT: ${path.basename(f)} nicht akzeptiert: ${(txt.match(/<rep:message[^>]*level="error"[^>]*>[^<]*/g) ?? []).slice(0, 3).map((m) => m.replace(/<[^>]*>/g, "")).join(" | ") || "kein Bericht"}`);
    return `${path.basename(f)}: ${ok ? "akzeptiert" : "ABGELEHNT"}`;
  });
  fs.rmSync(berichte, { recursive: true, force: true });
  kosit = `KoSIT-Validator (${jar}, ${path.basename(KOSIT)}): ${erg.join("; ")}`;
}

// ---------------------------------------------------------------- PNG-Ansichten (60 dpi)
const pdfs = [];
const sammeln = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) sammeln(p);
    else if (f.name.endsWith(".pdf")) pdfs.push(p);
  }
};
for (const d of ["pdf", "rechnungen", "belege"]) sammeln(path.join(OUT, d));
const seiten = {};
for (const p of pdfs) {
  const rel = path.relative(OUT, p);
  const ziel = path.join(OUT, "png", rel.replace(/\//g, "__").replace(/\.pdf$/, ""));
  execFileSync("pdftoppm", ["-r", "60", "-png", p, ziel]);
  seiten[rel] = fs.readdirSync(path.join(OUT, "png")).filter((f) => f.startsWith(path.basename(ziel) + "-")).length;
}

// ---------------------------------------------------------------- stand.json
fs.writeFileSync(path.join(OUT, "stand.json"), JSON.stringify(s, null, 1));

// ---------------------------------------------------------------- SZENARIO.md
const e = D.eur;
const md = [];
const tab = (kopf, zeilen) => [`| ${kopf.join(" | ")} |`, `|${kopf.map(() => "---").join("|")}|`, ...zeilen.map((z) => `| ${z.map((x) => String(x ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>")).join(" | ")} |`)].join("\n");
const B = D.BETRIEB;
const q = D.ustQuartale();
const j = D.jahresSummen();
const eu = D.euerUnabhaengig();

md.push(`# Jahres-Szenario „${B.name}“ 2026`, "",
  `Erzeugt mit \`apps/mobile/werkzeuge/jahr-szenario.mjs\` am ${new Date().toISOString().slice(0, 10)} – mit den echten Funktionen der App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen, belegSetzen, eRechnungLesen/belegAusERechnung, umsaetzeFuer, euerUebernahme, steuerpaket, dokumentHtml + Fußzeile wie in der App). Die Erwartungswerte stammen aus \`apps/mobile/werkzeuge/jahr-szenario-daten.ts\`, die nichts aus der App importiert.`, "",
  "**Neu erzeugen:** `cd apps/mobile && node werkzeuge/jahr-szenario.mjs /tmp/claude-0/jahr` (optional `KOSIT=<ordner mit v/ und cfg/>` für den KoSIT-Validator). Alle Namen, Anschriften, Steuer- und Kontonummern sind erfunden.", "",
  "## Betrieb", "",
  tab(["Angabe", "Wert"], [
    ["Name", `${B.name}, ${B.strasse}, ${B.plz} ${B.ort} (${B.bundesland})`], ["Rechtsform", "Einzelunternehmen, Inhaberin Jana Weber, gegründet 01.03.2022"], ["Steuer", `StNr ${B.steuernummer}, USt-IdNr ${B.ust_idnr}, Regelbesteuerung, Soll-Versteuerung, Voranmeldung vierteljährlich, Gewinnermittlung EÜR`],
    ["Bank", `${B.bank}, IBAN ${B.iban}, BIC ${B.bic}`], ["Kontakt", `${B.telefon}, ${B.email}, ${B.website}`], ["Beschäftigte", "Sabine Krüger (Köchin, Vollzeit seit 03/2022), Leon Schubert (Service, Minijob seit 09/2025)"],
    ["Kasse", "Tablet-Kasse KassaVista mit Cloud-TSE (Kassenmeldung 2025); Bargeldkasse mit Kassenbuch"], ["Steuerberatung", "Albrecht & Partner (Jahresabschluss), DATEV SKR03, Berater 29098 / Mandant 10457"],
  ]), "");

md.push("## Erzeugte Dateien", "", `Ordner: \`${OUT}\`. PNG-Ansichten jeder PDF-Seite (60 dpi) in \`png/\` (Name = Pfad mit \`__\`, Suffix -Seitenzahl). \`stand.json\` ist der komplette App-Stand am Ende.`, "");
md.push(tab(["Datei", "Seiten", "Inhalt / Eingaben"], dateien.map((x) => [`\`${x.rel}\``, seiten[x.rel] ?? "", x.inhalt])), "");
md.push("### Übersprungene Vorlagen", "", tab(["Vorlage", "Grund"], bau.uebersprungen.map((u) => [u.titel, u.grund])), "");

md.push("## Eingaben: Ausgangsrechnungen", "", "Beträge netto in €. Zeilen: Menge × Einzelpreis, auf Cent gerundet; USt je Satz aus der Summe des Satzes.", "");
md.push(tab(["Nr.", "Datum", "Leistung", "Kunde", "Netto 7 %", "Netto 19 %", "Netto 0 %", "USt", "Brutto", "Bezahlt", "Was"], D.vorgaenge().map((x) => [x.nummer, D.de(x.datum), x.art === "storno" ? `Storno zu ${x.r.nummer}` : D.de(x.leistung), D.KUNDEN[x.kunde].name, e(x.vz * (x.s.gruppen["7"]?.netto ?? 0)), e(x.vz * (x.s.gruppen["19"]?.netto ?? 0)), e(x.vz * (x.s.gruppen["0"]?.netto ?? 0)), e(x.vz * x.s.ust), e(x.vz * x.s.brutto), x.bezahlt ? D.de(x.bezahlt) : "–", x.art === "storno" ? x.r.storno.grund : x.r.worum])), "");
md.push("Positionen im Einzelnen:", "");
for (const r of D.RECHNUNGEN) md.push(`- **${r.nummer}** an ${r.kundeAbweichend ? `„${r.kundeAbweichend.name}“ (absichtlich falsch)` : D.KUNDEN[r.kunde].name}, Zahlungsziel ${r.ziel === "sofort" ? "sofort" : `${r.ziel} Tage`}${r.hinweise?.length ? `, Hinweis ${r.hinweise.join(", ")}` : ""}: ${r.pos.map((p) => `${String(p.menge).replace(".", ",")} ${p.einheit} „${p.bez}“ à ${e(p.preis)} € (${p.satz} %)`).join("; ")}`);
md.push("");

md.push("## Eingaben: Belege", "", "„ausgewiesen“ = so steht die USt auf dem Beleg (bei Rechnungen: Netto × Satz, gerundet; bei Kassenbons/Kleinbetragsrechnungen aus dem Bruttobetrag herausgerechnet). In die App wird – wie vorgesehen – der Bruttobetrag je Satz eingegeben.", "");
md.push(tab(["ID", "Datum", "Lieferant / Nr.", "Kategorie", "je Satz: netto + USt", "Brutto", "Vorsteuer", "Zahlung", "Datei", "Was"], D.BELEGE.map((b) => {
  const sm = D.belegSumme(b);
  return [b.id, D.de(b.datum), `${b.lieferant}${b.nummer ? ` / ${b.nummer}` : ""}`, b.kategorie, sm.jeSatz.map((x) => `${x.satz} %: ${e(x.netto)} + ${e(x.ust)}`).join("<br>"), e(sm.brutto), b.vorsteuer ? e(sm.vorsteuer) : "nein", `${b.zahlung}${b.bezahlt ? `, bezahlt ${D.de(b.bezahlt)}` : ""}`, `belege/${b.id}.${b.datei}`, b.worum];
})), "");

md.push("## Eingaben: Kasse, Lohn, Annahmen", "", "Kassenumsätze laut monatlicher Z-Bon-Summe (brutto je Satz; Mai = Summe der Tageswerte im Kassenbuch). Seit R12 als Tagesabschlüsse in der App erfasst (Monatssumme auf die Öffnungstage Di–So verteilt, Ruhetag Montag) – Voranmeldung, EÜR und Stapel übernehmen sie von dort.", "");
md.push(tab(["Monat", "Brutto 7 %", "Netto 7 %", "USt 7 %", "Brutto 19 %", "Netto 19 %", "USt 19 %"], [...D.KASSE_MONATE.map((k) => [k.monat, e(k.b7), e(k.n7), e(k.u7), e(k.b19), e(k.n19), e(k.u19)]), ["Summe", e(summe(D.KASSE_MONATE.map((k) => k.b7))), e(summe(D.KASSE_MONATE.map((k) => k.n7))), e(summe(D.KASSE_MONATE.map((k) => k.u7))), e(summe(D.KASSE_MONATE.map((k) => k.b19))), e(summe(D.KASSE_MONATE.map((k) => k.n19))), e(summe(D.KASSE_MONATE.map((k) => k.u19)))]]), "");
md.push(`- Kassenbuch Mai: Anfangsbestand ${e(D.KASSENBUCH_ANFANG)} €, ${D.KASSENBUCH_MAI.length} Einträge, Bareinnahmen ${e(summe(D.KASSENBUCH_MAI.map((x) => x.einnahme)))} €, Ausgaben ${e(summe(D.KASSENBUCH_MAI.map((x) => x.ausgabe)))} €, **Endbestand ${e(D.kassenbuchEnde())} €**.`,
  `- Lohn Köchin: ${e(D.LOHN_M1[0].brutto)} € (Jan–Jun), ${e(D.LOHN_M1[6].brutto)} € (Jul–Dez); Jahresbrutto ${e(summe(D.LOHN_M1.map((m) => m.brutto)))} €, LSt ${e(summe(D.LOHN_M1.map((m) => m.lohnsteuer)))} €, SV AN ${e(summe(D.LOHN_M1.map((m) => m.sv_an)))} €, AG-Anteile ${e(summe(D.LOHN_M1.map((m) => m.sv_ag)))} € (LSt-Werte sind Annahmen „vom Lohnbüro“, nicht nachgerechnet).`,
  `- Lohn Minijob: ${D.LOHN_M2.map((m) => String(m.stunden).replace(".", ",")).join(" / ")} Std. × 14,50 € = Jahresbrutto ${e(summe(D.LOHN_M2.map((m) => m.brutto)))} €, Pauschalabgaben ${e(summe(D.LOHN_M2.map((m) => m.sv_ag)))} €. Höchster Monat ${e(Math.max(...D.LOHN_M2.map((m) => m.brutto)))} € (Grenze 603 €).`,
  `- Personalkosten je Quartal (Belege b05–b08): ${[1, 2, 3, 4].map((n) => `Q${n} ${e(D.personalQuartal(n))} €`).join(", ")}.`,
  `- USt-Zahllast Q4/2025 (gezahlt 12.01.2026): ${e(D.UST_Q4_2025.betrag)} € (Annahme). USt-Vorauszahlungen 2026 werden in Höhe der ELSTER-Zahllast gezahlt (Bemessungsgrundlage in vollen Euro), Zahltage ${Object.entries(D.UST_ZAHLTAGE).map(([k, v]) => `${k}: ${D.de(v)}`).join(", ")}.`,
  `- AfA Haubenspülmaschine: ${e(D.belegSumme(D.BELEGE.find((b) => b.id === "b20")).netto)} € netto / 5 Jahre × 10/12 = **${e(eu.afa)} €**.`, "");

md.push("## Erwartete Kennzahlen (unabhängig gerechnet)", "", "### Umsätze netto 2026 (Soll: Rechnungen nach Leistungsdatum, Storno im Monat des Stornos; Kasse nach Z-Bon)", "");
md.push(tab(["", "19 %", "7 %", "0 % (igL)", "Summe"], [
  ["Ausgangsrechnungen", e(j.r19), e(j.r7), e(j.r0), e(j.r19 + j.r7 + j.r0)],
  ["Kasse (Z-Bons)", e(j.k19), e(j.k7), "0,00", e(j.k19 + j.k7)],
  ["Gesamt", e(j.r19 + j.k19), e(j.r7 + j.k7), e(j.r0), e(j.r19 + j.r7 + j.r0 + j.k19 + j.k7)],
]), "");
md.push("### Umsatzsteuer-Voranmeldungen", "", "„nur Rechnungen“ = was „Aus Rechnungen übernehmen“ der App liefern muss. Vorsteuer = auf den Belegen ausgewiesene Steuer, nach Belegdatum. Zahllast exakt = (BMG 19 % × 19 % + BMG 7 % × 7 %, je gerundet) − Vorsteuer; ELSTER = Bemessungsgrundlagen ohne Cent.", "");
md.push(tab(["Quartal", "Rechnungen 19 %", "Rechnungen 7 %", "igL 0 % (Kz 41)", "Kasse 19 %", "Kasse 7 %", "Kz 81 (19 %)", "Kz 86 (7 %)", "USt", "Vorsteuer (Kz 66)", "Zahllast exakt", "Zahllast ELSTER"], [
  ...q.map((x) => [x.q, e(x.r19), e(x.r7), e(x.r0), e(x.k19), e(x.k7), e(x.bmg19), e(x.bmg7), e(x.ust), e(x.vorsteuer), e(x.zahllast), e(x.elsterZahllast)]),
  ["Jahr", e(j.r19), e(j.r7), e(j.r0), e(j.k19), e(j.k7), e(j.r19 + j.k19), e(j.r7 + j.k7), e(j.ust), e(j.vorsteuer), e(j.zahllast), e(summe(q.map((x) => x.elsterZahllast)))],
]), "");
md.push("### EÜR 2026 (Zufluss/Abfluss)", "");
md.push(tab(["Posten", "Betrag €"], [
  ["Einnahmen netto aus bezahlten Rechnungen (" + eu.reAnzahl + " Rechnungen; 2026-015 bar an der Kasse am 26.11., 2026-016 bezahlt 2027)", e(eu.reNetto)],
  ["  davon steuerfreie igL (2026-012)", e(D.vorgaenge().filter((x) => x.bezahlt?.startsWith("2026")).reduce((a, x) => a + x.vz * (x.s.gruppen["0"]?.netto ?? 0), 0))],
  ["Vereinnahmte USt aus Rechnungen", e(eu.reUst)],
  ["Kasseneinnahmen netto", e(eu.kasseNetto)], ["Vereinnahmte USt Kasse", e(eu.kasseUst)],
  ["**Summe Betriebseinnahmen**", `**${e(eu.einnahmen)}**`],
  ...Object.entries(eu.nachKategorie).map(([k, w]) => [`Ausgaben ${k} (${w.anzahl} Belege, netto bzw. brutto ohne Vorsteuerabzug)`, e(w.betrag)]),
  ["Gezahlte Vorsteuer (nach Zahltag, inkl. Spülmaschine; ohne b14, bezahlt 2027)", e(eu.vorsteuer)],
  ["An das Finanzamt gezahlte USt (Q4/2025 + Q1–Q3/2026)", e(eu.ustGezahlt)],
  ["**Summe Betriebsausgaben (ohne AfA)**", `**${e(eu.ausgaben)}**`],
  ["AfA", e(eu.afa)],
  ["**Gewinn**", `**${e(eu.ergebnis)}**`],
  ["nur aus App-Daten übernehmbar: Einnahmen / Ausgaben", `${e(eu.nurAppDaten.einnahmen)} / ${e(eu.nurAppDaten.ausgaben)}`],
]), "");
md.push("### Steuerberater-Pakete", "", `- Q4 2026: Rechnungen mit Rechnungsdatum 01.10.–31.12. (${D.vorgaenge().filter((x) => x.datum >= "2026-10-01").map((x) => x.nummer).join(", ")}), Belege mit Belegdatum im Q4 (${D.BELEGE.filter((b) => b.datum >= "2026-10-01").map((b) => b.id).join(", ")}); ${pq4.buchungen} Buchungen im DATEV-Stapel, ${pq4.anzahl} Dateien, ${pq4.fragen} Punkte in Fragen_2026-Q4.txt.`,
  `- Jahr 2026: alle ${D.vorgaenge().length} Rechnungen inkl. 2 Stornos, alle ${D.BELEGE.length} Belege; ${pj.buchungen} Buchungen, ${pj.anzahl} Dateien, ${pj.fragen} Punkte in Fragen_2026.txt. XRechnungen nur für Rechnungen mit E-Mail des Empfängers (Privatkunden 2026-003 und 2026-014 ohne).`, "");

md.push("## Vergleich App ↔ unabhängige Rechnung", "", `${vergleiche.filter((v) => v.ok).length} von ${vergleiche.length} Prüfungen stimmen. Abweichungen (✗) stehen zusätzlich unter „Auffälligkeiten“.`, "");
md.push(tab(["", "Bereich", "Prüfung", "App", "erwartet"], vergleiche.map((v) => [v.ok ? "✓" : "✗", v.bereich, v.was, v.app, v.erwartet])), "");
md.push("Übernahme „Aus Rechnungen übernehmen“ je Quartal (Rechnungen und Tagesabschlüsse, nichts von Hand ergänzt):", "", tab(["Quartal", "Rechnungen", "umsatz_19", "umsatz_7", "umsatz_frei", "vorsteuer", "fertige VA: 19 % / 7 % / frei / Vorsteuer"], bau.ust.map((u) => [u.q, u.appAnzahl, u.app.umsatz_19, u.app.umsatz_7, u.app.umsatz_frei, u.app.vorsteuer, `${u.final.umsatz_19} / ${u.final.umsatz_7} / ${u.final.umsatz_frei} / ${u.final.vorsteuer}`])), "");
md.push("EÜR-Übernahme der App (Rohzeilen):", "", tab(["Liste", "Bezeichnung", "Zeile Anlage EÜR", "Betrag"], [...bau.euer.uebernahme.einnahmen.map((x) => ["Einnahme", x.text, x.kategorie, x.betrag]), ...bau.euer.uebernahme.ausgaben.map((x) => ["Ausgabe", x.text, x.kategorie, x.betrag])]), "", `Ergebnis der fertigen EÜR (Formular): ${bau.euer.ergebnis.map(([a, b]) => `${a} ${b}`).join(", ")}.`, "");

md.push("## Pflichten-Check der App für das Café", "", "Profil: Gastronomie und Lebensmittel, Einzelunternehmen, Gewerbe, Sachsen, 2 Beschäftigte, elektronische Kasse, Website, Regelbesteuerung, Steuerberatung, Gründung 01.03.2022 (Stichtag 15.01.2026).", "");
md.push(tab(["Pflicht gilt", "Vorlage laut App", "im Szenario erzeugt"], bau.pflichten.gilt.map((p) => [p.titel, p.vorlage ?? "–", p.vorlage ? (p.erzeugt ? "ja" : "**nein**") : ""])), "");
if (bau.pflichten.unbekannt.length) md.push("Noch offen (App braucht weitere Antworten):", "", ...bau.pflichten.unbekannt.map((p) => `- ${p.titel}${p.fragen.length ? ` – Fragen: ${p.fragen.join(", ")}` : ""}`), "");

md.push("## Auffälligkeiten beim Erzeugen", "");
md.push("### Automatisch erkannt (Abweichungen gegen die unabhängige Rechnung bzw. Plausibilitätsprüfungen)", "");
md.push(...(auffaellig.length ? auffaellig.map((a) => `- ${a}`) : ["- keine"]), "");
md.push("### Beim Durchsehen der Ausgaben festgestellt (fachlich/inhaltlich, nicht automatisch prüfbar)", "", ...BEOBACHTUNGEN.map((b) => `- ${b}`), "");
md.push("## Hinweise der App und weitere Informationen", "", ...bau.infos.map((i) => `- ${i}`), `- ${kosit}`, "");
fs.writeFileSync(path.join(OUT, "SZENARIO.md"), md.join("\n"));

console.log(`${bau.docs.length} Unterlagen, ${bau.xmls.length} XRechnungen, ${bau.belegDateien.length} Belegdateien, ${pdfs.length} PDFs → ${OUT}`);
console.log(`Vergleiche: ${vergleiche.filter((v) => v.ok).length}/${vergleiche.length} ok; Auffälligkeiten: ${auffaellig.length}`);
for (const a of auffaellig) console.log(`  - ${a}`);
