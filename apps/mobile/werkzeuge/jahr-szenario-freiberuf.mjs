/**
 * Jahres-Szenario „Mira Lindqvist – Grafikdesign“ 2026 (Freiburg, Einzelunternehmerin, freier Beruf,
 * Kleinunternehmerin nach § 19 UStG, keine Beschäftigten, Website mit Kontaktformular und Newsletter): erzeugt mit den
 * echten Funktionen der App alle Unterlagen eines Jahres – Rechnungen (PDF + XRechnung, soweit die App sie erzeugt) inkl.
 * Storno und Gutschrift, Belege (inkl. empfangener E-Rechnung), die Dokumentvorlagen (Impressum, Datenschutz, AVV, VVT,
 * Verfahrensdokumentation, Aufbewahrung, Gewerbeanmeldung), die USt-Übernahme (für Kleinunternehmer!), EÜR,
 * Steuererklärung, Steuerberater-Paket des Jahres (entpackt) und den Pflichten-Check – und schreibt SZENARIO.md mit
 * allen Eingaben, den unabhängig gerechneten Erwartungswerten (werkzeuge/jahr-szenario-freiberuf-daten.ts) und jeder
 * Abweichung.
 *
 *   cd apps/mobile && node werkzeuge/jahr-szenario-freiberuf.mjs [ausgabe]     # Standard: /tmp/claude-0/freiberuf
 *   CHROMIUM_PFAD=…   anderer Chromium (Standard /opt/pw-browsers/chromium)
 *   KOSIT=<ordner>    optional: KoSIT-Validator (<ordner>/v/validator-*.jar, <ordner>/cfg/scenarios.xml)
 *
 * Voraussetzungen wie beim Café-Szenario (jahr-szenario.mjs): pnpm install, gebaute Pakete (@amtlos/fachlogik dist:
 * cd packages/fachlogik && npx tsc -p tsconfig.build.json), Chromium, pdftotext/pdftoppm (poppler).
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
 * Beobachtungen beim Erstellen des Szenarios (Oktober 2026), die sich nicht als Zahlvergleich automatisieren lassen –
 * Quelle jeweils mit Datei:Zeile. Bei jedem Lauf erneut prüfen und hier pflegen.
 */
const BEOBACHTUNGEN = [
  "**Vorsteuer-Schalter für Kleinunternehmer:** Ein neuer Beleg startet mit „Vorsteuer abziehbar“ an (apps/mobile/src/seiten/Belege.tsx:27 `vorsteuer: true`), eine eingelesene E-Rechnung ebenso (packages/fachlogik/src/erechnungLesen.ts:391 `vorsteuer: r.summen.ust_cent > 0`) – unabhängig von „ust.kleinunternehmer“ im Profil. Eine Kleinunternehmerin darf keine Vorsteuer abziehen (§ 19 Abs. 1 UStG). Im Szenario wurde der Schalter bei allen 21 Belegen von Hand ausgeschaltet; was die Standardwerte ergäben, steht unter „Vergleich“ (Vorsteuer in der USt-Übernahme, Zeile „Gezahlte Vorsteuerbeträge“ in der EÜR). Vorschlag: Startwert `!profil['ust.kleinunternehmer']`, Schalter bei Kleinunternehmern ausblenden oder mit Hinweis.",
  "**§ 13b für Kleinunternehmer (Adobe aus Irland):** Die App kennt keine Steuer, die die Leistungsempfängerin schuldet: Der Beleg ohne USt (0 %) ist nur eine Ausgabe. Die Kleinunternehmerin schuldet aber 19 % nach § 13b Abs. 1, 5 und 8 UStG und muss dafür eine Voranmeldung abgeben (§ 18 Abs. 4a UStG). Die Vorlage „Umsatzsteuer-Voranmeldung“ hat keine Felder für Kz 46/47 (bzw. 84/85); die Zahllast musste in die Notiz. DATEV bucht den Beleg auf 4930 ohne BU-Schlüssel für § 13b. Vorschlag: Beleg-Option „Steuer schulde ich (Reverse Charge)“, Felder in der Voranmeldung, Hinweis im Pflichten-Check.",
  "**Gutschrift (Mira ist Leistungsempfängerin):** Die Rechnungsvorlage erlaubt den Hinweis „Gutschrift“ auch bei Kleinunternehmern und druckt Titel, Anrede („wir rechnen … ab und schreiben Ihnen den Betrag gut“) und „Gutschriftsbetrag“ richtig (packages/fachlogik/src/dokumente/buchhaltung.ts:264, 278, 307). Danach behandelt die App sie aber wie eine Ausgangsrechnung: gleicher Nummernkreis, Kleinunternehmer-Hinweis der AUSSTELLERIN statt des Status des leistenden Fotografen, Einnahme in der EÜR-Übernahme (apps/mobile/src/unterlagen/steuerpaket.ts:52–62), Erlös in DATEV und Rechnungsliste, XRechnung mit Typ 380 und Mira als Verkäuferin (packages/fachlogik/src/erechnung.ts:39). Vorschlag: Gutschrift als eigene Art mit vertauschten Rollen (Typ 389, Verkäufer = Leistender), in EÜR/DATEV als Ausgabe; bis dahin Hinweis „wird als Einnahme gezählt“.",
  "**Leistungen ins Ausland als Kleinunternehmerin:** Bei der Rechnung an die niederländische B.V. (USt-IdNr. NL…) druckt die App „Der Umsatz ist nach § 19 Abs. 1 UStG steuerfrei.“ Der Umsatz ist aber in Deutschland gar nicht steuerbar (Ort der Leistung NL, § 3a Abs. 2 UStG); nach § 14a Abs. 1 UStG gehören „Steuerschuldnerschaft des Leistungsempfängers“ und beide USt-IdNrn. auf die Rechnung. Wählt man den Hinweis zusätzlich, meldet die App nur „bitte prüfen“ (buchhaltung.ts:248) und die XRechnung bleibt Kategorie E (erechnung.ts:16: Kleinunternehmer schlägt die Steuerart). Gleiches für die Schweiz (nicht steuerbar, Kategorie O). Fachlich prüfen lassen; ZM ist für Kleinunternehmer nicht nötig (§ 18a Abs. 4 UStG) – die App bietet auch keine an.",
  "**EÜR-Zeile „davon nicht steuerbare Umsätze“ (R11):** Die Übernahme stellt bei Kleinunternehmern den Gesamtbetrag in die Zeile „Umsatzsteuerlicher Kleinunternehmer“ und nennt die nicht steuerbaren Umsätze (hier 4.438,00 €, NL + CH) im Text als „davon“ für die Zeile „Nicht steuerbare Umsätze sowie Umsätze nach § 19 Absatz 3 Satz 1 Nummer 1 und 2 UStG“ (apps/mobile/src/unterlagen/steuerpaket.ts, euerUebernahme) – keine eigene Zeile, damit die Summe der Einnahmen nicht doppelt zählt. Zeilennummer gegen den Vordruck 2026 prüfen.",
  "**AfA-Bemessung bei Kleinunternehmern:** Die App rechnet keine AfA aus und sagt das. Ihre Kategorie heißt „Anschaffung über 800 € netto“ (belege.ts:75) – richtig für die GWG-Grenze, aber nirgends steht, dass die Kleinunternehmerin den BRUTTObetrag abschreibt (§ 9b Abs. 1 EStG). Im Szenario: 2.199,00 € / 3 × 11/12 = 671,92 € (mit netto wären es 564,64 €). Alternativ ist für Computerhardware eine Nutzungsdauer von 1 Jahr zulässig (BMF-Schreiben zur Nutzungsdauer digitaler Wirtschaftsgüter) – nicht genutzt.",
  "**Homeoffice-Tagespauschale:** Es gibt keine Kategorie dafür; als „Sonstiges“ landet der Eigenbeleg in „Übrige unbeschränkt abziehbare Betriebsausgaben“ statt in der Zeile für Arbeitszimmer/Tagespauschale (beschränkt abziehbar, Höchstbetrag 1.260 €). Summe stimmt, Zeile nicht.",
  "**Leistungszeitraum als Text:** Rechnung 2026-003 hat „02.03.2026 – 27.03.2026“ im Feld „Datum oder Zeitraum der Leistung“ – die App erzeugt dafür keine XRechnung (isoAus in buchhaltung.ts:70 erkennt nur ein Datum) und das Steuerberater-Paket enthält sie nicht. Für Freiberufler mit Monats- oder Projektzeiträumen häufig.",
  "**USt-Voranmeldung bei Kleinunternehmern:** Der Pflichten-Check bietet keine Voranmeldung an (richtig). „Aus Rechnungen übernehmen“ funktioniert trotzdem und stellt die Kleinunternehmer-Umsätze in „Umsätze ohne Umsatzsteuer“ (ustAusRechnungen.ts:94 `s === null || s === 0`); das Formular nennt sie „Steuerfreie oder nicht steuerbare Umsätze“ mit dem Hinweis auf Kz 41/43/21 (buchhaltung.ts:617). Kleinunternehmer-Umsätze gehören in keine Kennzahl der Voranmeldung – wer sie in Kz 43 überträgt, meldet falsch. Gleichzeitig fehlt die einzige Angabe, die die Kleinunternehmerin wirklich machen muss (§ 13b, Kz 46/47): Das Formular zeigt Zahllast 0,00 € neben einer Notiz über 159,58 €. Vorschlag: bei `kleinunternehmer` die Übernahme sperren bzw. Umsätze nicht übernehmen und stattdessen § 13b-Belege anbieten.",
  "**Pflichten-Check für dieses Profil:** keine Arbeitgeber-, Gewerbe-, Kassen-, GewSt- oder USt-Voranmeldungspflichten (richtig); „Gewerbe anmelden“, IHK und GewSt erscheinen erst mit Einordnung „Gewerbe“ (Variante). Fraglich: „Zusammenfassende Meldung abgeben“ – der Auslöser fragt nur b2b + EU, nicht `ust.kleinunternehmer` (katalog.json, Pflicht steuern.zusammenfassende_meldung; Kleinunternehmer sind nach § 18a Abs. 4 UStG ausgenommen, fachlich bestätigen); „KI-Kompetenz der Beschäftigten sicherstellen“ ohne Beschäftigte (Auslöser nur ki.nutzung); „Rundfunkbeitrag für die Betriebsstätte“ bei Büro in der eigenen, schon beitragspflichtigen Wohnung (Auslöser betriebsstaetten.anzahl ≥ 1; Befreiung für Betriebsstätten in einer Wohnung prüfen, § 5 Abs. 5 Nr. 3 RBStV). Es fehlen: die Voranmeldung für § 13b-Leistungen trotz Kleinunternehmerregelung (der Katalog kennt § 13b nicht), die Künstlersozialversicherung (Grafikdesign gehört typischerweise zu den Berufen nach KSVG; Melde-/Versicherungspflicht prüfen) und die Künstlersozialabgabe für eingekaufte Fotografie (Gutschrift 2026-011) – beides nicht im Katalog. Die Rechtsform-Antwort „Freiberuflich (ohne Gewerbe)“ statt „Einzelunternehmen“ ändert nichts (Variante).",
  "**Rechnungen an Privatpersonen** (2026-002, 2026-013) beginnen fest mit „Sehr geehrte Damen und Herren“ (buchhaltung.ts:327) – bei „Lena und Tobias Hartmann“ bzw. „Dr. Ursula Brenner“ unpassend.",
];

/**
 * Durchsicht aller PDF-Seiten von Hand (Oktober 2026, PNGs mit 60 dpi, Ausschnitte mit 150 dpi; Lage per pdftotext -bbox).
 * Nach Änderungen an Vorlagen erneut ansehen und hier pflegen. [schwer/mittel/gering] = Einstufung.
 */
const DURCHSICHT = [
  "**Rechnungen 2026-001 … 2026-016 (16 Seiten, je 1 Seite):** keine Zeile „Umsatzsteuer“, keine Spalte „USt“, kein „19 %“ (der Positions-Steuersatz steht intern auf 19, wird aber nirgends gedruckt); „Der Umsatz ist nach § 19 Abs. 1 UStG steuerfrei.“ steht auf jeder Rechnung, auch auf Storno und Gutschrift. Beträge, Mengen (3,5 / 7,25 / 2,75 / 4,5 / 6,25 / 1,75 Std., 212 und 148 Seiten, 85 Stück), Rabattzeile −154,50 €, Storno mit negativen Beträgen und Verweis „storniert die Rechnung Nr. 2026-004 vom 14.04.2026“, GiroCode und Zahlungsfrist – alles richtig.",
  "[mittel] **Gutschrift 2026-011:** Titel, Anrede und „Gutschriftsbetrag“ stimmen, aber der Infoblock heißt weiter „Rechnungsnummer/Rechnungsdatum“ und zeigt Steuernummer und USt-IdNr. der Ausstellerin (Mira). Bei einer Gutschrift muss die Steuernummer bzw. USt-IdNr. des LEISTENDEN (Fotograf) darauf stehen (§ 14 Abs. 4 Nr. 2 UStG), und der Kleinunternehmer-Hinweis müsste seinen Status beschreiben. Quelle packages/fachlogik/src/dokumente/buchhaltung.ts:318–322 und 284. Vorschlag: bei „gutschrift“ Feld für Steuernummer/Status des Leistenden, Beschriftung „Gutschriftsnummer“.",
  "[mittel] **Rechnung 2026-007 (Niederlande) und 2026-008 (Schweiz):** Hinweis „steuerfrei nach § 19“ statt „nicht steuerbar“ bzw. „Steuerschuldnerschaft des Leistungsempfängers“; der Infoblock zeigt die USt-IdNr. des Kunden richtig unter der Anschrift. Siehe Beobachtungen.",
  "[gering] **Alle Rechnungen:** Die E-Mail-Adresse im Infoblock (hallo@mira-lindqvist.example) ragt etwa 4 mm über den rechten Rand des Satzspiegels hinaus (endet bei x = 554 pt, Tabelle bei 539 pt). Quelle packages/fachlogik/src/dokumente/html.ts:526 (.info margin-left 15 mm + width 75 mm). Vorschlag: Breite an den verbleibenden Platz koppeln oder lange Werte umbrechen.",
  "[gering] **Alle Rechnungen:** „Summe netto“ auf einer Kleinunternehmer-Rechnung suggeriert eine Steuer (buchhaltung.ts:274). Vorschlag: bei `ku` „Summe“ bzw. direkt „Rechnungsbetrag“. Ebenso „Umsätze aus Rechnungen (netto)“ in der EÜR (steuerpaket.ts:97).",
  "[gering] **Infoblock „Leistungsdatum/-zeitraum“** erscheint auch bei einem einzelnen Datum, sobald der Schalter „wie Rechnungsdatum“ aus ist (buchhaltung.ts:320) – unschön, nicht falsch.",
  "[gering] **Privatkunden 2026-002, 2026-013:** „Sehr geehrte Damen und Herren“ an ein Ehepaar bzw. eine namentlich bekannte Kundin (buchhaltung.ts:327).",
  "**Gewerbeanmeldung (1 Seite):** sauber, Felder richtig. Inhaltlich nur sinnvoll, wenn das Gewerbeamt Grafikdesign als Gewerbe einstuft – der Pflichten-Check verlangt sie für „Freier Beruf“ nicht (richtig).",
  "**Impressum (1 Seite):** § 5 DDG-Angaben, Inhaberin, Kontakt, USt-IdNr. (§ 27a UStG), Verantwortliche nach § 18 Abs. 2 MStV, VSBG-Satz. Ohne USt-IdNr. in „Mein Betrieb“ fällt der Abschnitt weg und es erscheint keine Steuernummer (richtig). Kein Hinweis auf die Kleinunternehmerregelung – auch nicht nötig.",
  "**Datenschutzerklärung (4 Seiten):** Hosting mit AVV, Logfiles 7 Tage, Kontaktformular, Newsletter mit Double-Opt-in und Protokollierung, lokale Schriften, Links zu Instagram/Behance, Rechte, Aufsichtsbehörde BW – vollständig und stimmig. [gering] Der Newsletter-Satz setzt die Eingabe wörtlich ein („Informationen über Neue Arbeiten …“ – Großschreibung aus der Eingabe).",
  "[mittel] **VVT ↔ Datenschutzerklärung widersprechen sich:** VVT „Betrieb der Website“ übernimmt aus dem Vorschlag „IP-Adressen in Logfiles nach 30 Tagen“ (packages/fachlogik/src/dokumente/bausteine.ts:1291), die Datenschutzerklärung sagt 7 Tage (Eingabe logfile_tage). Vorschlag: Löschfrist im VVT aus der Website-Datenschutzerklärung bzw. aus logfile_tage übernehmen oder als Platzhalter lassen.",
  "[gering] **VVT und Datenschutzinformation, „Kundenverwaltung“:** Rechtsgrundlage und Datenkategorien nennen Gesundheitsangaben (Allergien/Unverträglichkeiten, Art. 9 DSGVO) – Text aus Gastro/Beauty, für eine Designerin unpassend (bausteine.ts:1203). „Geschäftliche E-Mail-Kommunikation“ nennt „Beschäftigte“ als Betroffene, obwohl es keine gibt. Vorschlag: Vorschlagstexte nach Branche/Beschäftigten filtern.",
  "**VVT (6 Seiten), TOM, Dienstleister:** sonst stimmig; Adobe mit Drittlandbezug USA (DPF) steht korrekt in der Dienstleistertabelle, die Tätigkeiten sagen pauschal „keine Übermittlung in Drittländer“ (Eingabe, die App prüft den Widerspruch nicht).",
  "[gering] **AVV (3 Seiten):** Seite 3 enthält nur die Zeile „Anlage: Technische und organisatorische Maßnahmen des Auftragnehmers“ und die Unterschriften – die Zeile wirkt wie die Überschrift einer leeren Anlage (website.ts:318). Vorschlag: „Anlage (wird beigefügt): …“ unterhalb der Unterschriften bzw. als Aufzählung „Anlagen“.",
  "[gering] **Datenschutzinformation (5 Seiten):** Seite 5 trägt nur Abschnitt 9 (eine Zeile) – Hurenkind; vertretbar.",
  "[gering] **Verfahrensdokumentation (3 Seiten):** Vorschläge für „Steuerberatung“ sprechen nur von „Jahresabschluss“ (packages/fachlogik/src/dokumente/steuern.ts:36) – für EÜR-Rechner fehlt „EÜR und Steuererklärungen durch die Steuerberatung“. Sonst gut, keine Kasse erwähnt.",
  "**Aufbewahrungsplan (1 Seite):** drei Startzeilen (10/8/6 Jahre, „seit 2025: 8 Jahre“) – passend, nichts zu Lohn/Kasse.",
  "[schwer] **USt-Voranmeldung Q1 (1 Seite):** „Steuerfreie oder nicht steuerbare Umsätze 1.784,00 €“ (Kleinunternehmer-Umsätze nach Zufluss) mit Kennzahl-Hinweis 41/43/21; „Verbleibende Umsatzsteuer-Vorauszahlung 0,00 €“, obwohl die Notiz 159,58 € (§ 13b) nennt; Kopf „Besteuerung nach vereinnahmten Entgelten (§ 20 UStG)“ – für eine Kleinunternehmerin ohne Bedeutung. Siehe Beobachtungen.",
  "[mittel] **EÜR (2 Seiten):** Gliederung und Summen formal richtig; inhaltlich zählt die Gutschrift 2026-011 als Einnahme (+700 €) und fehlt als „Bezogene Leistungen“ (−700 €), Gewinn dadurch 1.400 € zu hoch; keine Zeile „davon nicht steuerbar“; Homeoffice-Pauschale unter „Übrige unbeschränkt abziehbare Betriebsausgaben“. Keine USt-/Vorsteuerzeilen (richtig, weil alle Belege von Hand auf „ohne Vorsteuer“ gestellt).",
  "[gering] **Unterlagen zur Steuererklärung (1 Seite):** Rechtsgrundlage nennt fest „§ 25 EStG; § 31 KStG; § 14a GewStG; § 18 Abs. 3 UStG“, obwohl nur die Einkommensteuer gewählt ist (buchhaltung.ts:656). Gewinn übernimmt den Fehler der EÜR. Vorschlag: Grundlage aus den gewählten Arten bilden.",
  "**Belege b01–b21 (20 PDF-Seiten + 1 XML):** Eingaben des Szenarios (nicht von der App), alle lesbar; Beträge und Steuerausweis passen zur Tabelle „Eingaben: Belege“.",
];

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? "/tmp/claude-0/freiberuf");
for (const d of ["pdf", "rechnungen", "png", "belege", "steuerpaket-jahr"]) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

// ---------------------------------------------------------------- bündeln
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const gebaut = path.join(OUT, ".jahr-szenario-freiberuf.mjs");
execFileSync(path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild"), [path.join(HIER, "jahr-szenario-freiberuf.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
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
const pt = (mm) => `${(Math.round(mm * MM) * 4) / 3}px`;
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

const dateien = [];
const merke = (rel, inhalt) => dateien.push({ rel, inhalt });
for (const d of bau.docs) {
  const rel = `${d.ordner}/${d.datei}`;
  fs.writeFileSync(path.join(OUT, rel), await appPdf(S.dokHtml(s, d.uid), d.quer));
  merke(rel, `${d.titel}: ${d.worum}`);
}
for (const x of bau.xmls) {
  fs.writeFileSync(path.join(OUT, "rechnungen", x.datei), x.xml);
  merke(`rechnungen/${x.datei}`, `XRechnung 3.0 (UBL) zu ${x.nummer}, erzeugt mit eRechnungAus + xrechnungUbl wie „Als E-Rechnung teilen“.`);
}
const belegBytes = {};
for (const b of bau.belegDateien) {
  const bytes = b.xml ? new TextEncoder().encode(b.xml) : await einfachPdf(b.html);
  belegBytes[b.datei] = bytes;
  fs.writeFileSync(path.join(OUT, "belege", b.datei), bytes);
  const roh = D.BELEGE.find((x) => b.datei.startsWith(x.id));
  merke(`belege/${b.datei}`, `Eingabe: ${roh.lieferant} ${roh.nummer ?? ""} vom ${D.de(roh.datum)} – ${roh.worum}`);
}
await browser.close();

// ---------------------------------------------------------------- Steuerberater-Paket des Jahres
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
 * Neuerungen nach der internen Prüfrunde Steuern (Oktober 2026): Spalten und Summenzeilen der Listen, Amtlos-Belegnummer
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
  const gi = extf[1].indexOf("Beleginfo - Inhalt 1"); // StB-Prüfung 3.1: GUID in Beleginfo 1, Feld 103 „Buchungs GUID“ leer
  const guids = ez.map((z) => z[gi]);
  vergleich(bereich, "DATEV: Buchungs-GUID in jeder Zeile (Beleginfo 1, 36 Zeichen) und eindeutig, Feld 103 leer", gi >= 0 && ez.every((z) => z[102] === "" && z[20] === "Buchungs-GUID") && guids.every((g, i) => /^[0-9a-f-]{36}$/.test(g) && guids.indexOf(g) === i) ? "ja" : "nein", "ja");
  const texte = ez.map((z) => z[13]);
  vergleich(bereich, "DATEV: Buchungstext höchstens 60 Zeichen, ohne Leerzeichen am Ende", texte.filter((t) => t.length > 60 || t !== t.trimEnd()).join(" | ") || "alle", "alle");
  const bl = liste(inhalt[`Buchungsliste_${zr.name}.csv`]);
  vergleich(bereich, "Buchungsliste: GUIDs wie im DATEV-Stapel", bl.zeilen.map((z) => bl.w(z, "Buchungs-GUID")).sort().join(",") === [...guids].sort().join(",") ? "ja" : "nein", "ja");
  const fragen = inhalt[`Fragen_${zr.name}.txt`] ? Buffer.from(inhalt[`Fragen_${zr.name}.txt`]).toString("utf8") : "";
  vergleich(bereich, `Fragen_${zr.name}.txt vorhanden`, fragen ? "ja" : "nein", "ja");
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  vergleich(bereich, "LIESMICH: Mandant-Block und „Nicht enthalten – bitte zusätzlich liefern“ (ohne Kasse keine Kassenzeile)", /Mandant \(Angaben aus der App\)/.test(liesmich) && /Nicht enthalten – bitte zusätzlich liefern/.test(liesmich) && !/Kassenumsätze/.test(liesmich) && /Lohnjournal/.test(liesmich) ? "ja" : "nein", "ja");
  // Kasse laut Pflichten-Check (nein): Hinweis auf fehlende Kassenumsätze ganz oben im LIESMICH und in den Fragen
  vergleich(bereich, "LIESMICH: „Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket.“ in der ersten Zeile", /^Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket\./.test(liesmich) ? "ja" : "nein", "nein");
  vergleich(bereich, "Fragen: Kassenhinweis", /Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket\./.test(fragen) ? "ja" : "nein", "nein");
  vergleich(bereich, "LIESMICH: Kleinunternehmer ja/nein", (/Kleinunternehmer \(§ 19 UStG\): (ja|nein)/.exec(liesmich) ?? [])[1] ?? "fehlt", kleinunternehmer ? "ja" : "nein");
  const jahr = /^\d{4}$/.test(zr.name);
  vergleich(bereich, "LIESMICH: Satz „Nicht zusätzlich zu den Monats-/Quartalsstapeln importieren“ genau im Jahrespaket", /Nicht zusätzlich zu den Monats-\/Quartalsstapeln importieren/.test(liesmich) ? "ja" : "nein", jahr ? "ja" : "nein");
  const ohneXmlZeilen = (liesmich.split("Rechnungen ohne E-Rechnung (XRechnung)")[1] ?? "").split(/\r\n\r\n/)[0].split("\r\n").filter((z) => z.startsWith("- "));
  vergleich(bereich, "LIESMICH: Rechnungen ohne E-Rechnung einzeln mit Grund", String(ohneXmlZeilen.length), String(erg.ohneXml));
  return { fragen, liesmich, rechnungen: re, belege: be };
}

const pk = S.paket(s, belegBytes);
let paketInfo = {};
{
  const name = "Jahr 2026";
  fs.writeFileSync(path.join(OUT, pk.dateiname), pk.zip);
  merke(pk.dateiname, "Steuerberater-Paket 2026 (steuerpaket(), ZIP wie in der App).");
  const inhalt = S.unzipSync(pk.zip);
  for (const [p, bytes] of Object.entries(inhalt)) {
    fs.mkdirSync(path.dirname(path.join(OUT, "steuerpaket-jahr", p)), { recursive: true });
    fs.writeFileSync(path.join(OUT, "steuerpaket-jahr", p), bytes);
  }
  merke("steuerpaket-jahr/", `entpacktes Paket: ${Object.keys(inhalt).length} Dateien (${Object.keys(inhalt).filter((p) => !p.includes("/")).join(", ")}, E-Rechnungen/, Belege/).`);
  const vg = D.vorgaenge();
  const umsatz = D.umsatzVorgaenge();
  // Spalten nach Namen, ohne die Summenzeilen am Ende; Gutschriften stehen seit Oktober 2026 in einer eigenen Liste
  const reL = liste(inhalt["Rechnungen_2026.csv"]);
  const re = reL.zeilen;
  const gs = inhalt["Gutschriften_2026.csv"] ? liste(inhalt["Gutschriften_2026.csv"]).zeilen : [];
  vergleich(`Paket ${name}`, "Anzahl Belegzeilen in Rechnungs- und Gutschriftenliste (inkl. Storno und Gutschrift)", String(re.length + gs.length), String(vg.length));
  vergleich(`Paket ${name}`, "Rechnungsliste: Summe USt (Kleinunternehmerin: 0)", summe(re.map((z) => centAus(reL.w(z, "USt")))), 0);
  vergleich(`Paket ${name}`, "Rechnungsliste: Summe Brutto der Ausgangsrechnungen (ohne die Gutschrift, die eine Ausgabe ist)", summe(re.map((z) => centAus(reL.w(z, "Brutto")))), summe(umsatz.map((x) => x.vz * x.s.brutto)));
  vergleich(`Paket ${name}`, "Rechnungsliste: Spalte Steuersätze überall „§ 19“", [...new Set(re.map((z) => reL.w(z, "Steuersätze")))].join(", "), "§ 19");
  vergleich(`Paket ${name}`, "Rechnungsliste: Spalte Steuerart überall „§ 19“", [...new Set(re.map((z) => reL.w(z, "Steuerart")))].join(", "), "§ 19");
  const beL = liste(inhalt["Belege_2026.csv"]);
  const be = beL.zeilen;
  vergleich(`Paket ${name}`, "Anzahl Belege (nach Belegdatum)", be.length, D.BELEGE.length);
  vergleich(`Paket ${name}`, "Belegliste: Summe Brutto", summe(be.map((z) => centAus(beL.w(z, "Brutto")))), summe(D.BELEGE.map((b) => D.belegSumme(b).brutto)));
  vergleich(`Paket ${name}`, "Belegliste: Summe Vorsteuer (Kleinunternehmerin: 0)", summe(be.map((z) => centAus(beL.w(z, "Vorsteuer")))), 0);
  vergleich(`Paket ${name}`, "Belegdateien im Paket", Object.keys(inhalt).filter((p) => p.startsWith("Belege/")).length, D.BELEGE.length);
  vergleich(`Paket ${name}`, "E-Rechnungen im Paket = erzeugte XRechnungen", Object.keys(inhalt).filter((p) => p.startsWith("E-Rechnungen/")).length, bau.xmls.length);
  const extf = csvLesen(inhalt["EXTF_Buchungsstapel_2026.csv"], "latin1");
  const zeilen = extf.slice(2);
  vergleich(`Paket ${name}`, "DATEV: Spalten je Zeile = Spalten im Kopf", zeilen.every((z) => z.length === extf[1].length) ? "ja" : "nein", "ja");
  const kontoSumme = (konto) => summe(zeilen.filter((z) => z[7] === konto).map((z) => (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
  // R10: die Leistung an das EU-Unternehmen (Steuerschuldnerschaft des Empfängers) geht auf 8336, nicht auf 8195
  // R11: Ist-Versteuerung (EÜR) – im Stapel nur Rechnungen mit Zahlungseingang im Jahr
  const bezahltImJahr = umsatz.filter((x) => x.bezahlt && x.bezahlt.startsWith("2026-"));
  vergleich(`Paket ${name}`, "DATEV: Brutto auf Erlöskonto 8195 (Kleinunternehmer, SKR03) – nur bezahlte Ausgangsrechnungen im Inland/Drittland (Ist)", kontoSumme("8195"), summe(bezahltImJahr.filter((x) => D.KUNDE_ORT[x.kunde] !== "eu_b2b").map((x) => x.vz * x.s.brutto)));
  vergleich(`Paket ${name}`, "DATEV: Leistung an das EU-Unternehmen auf 8336 (Empfänger schuldet die Steuer)", kontoSumme("8336"), summe(bezahltImJahr.filter((x) => D.KUNDE_ORT[x.kunde] === "eu_b2b").map((x) => x.vz * x.s.brutto)));
  vergleich(`Paket ${name}`, "DATEV: keine Buchung auf 8400/8300 (Regelsteuer-Erlöse)", zeilen.filter((z) => z[7] === "8400" || z[7] === "8300").length, 0);
  // StB-Prüfung (A-2): Kleinunternehmerin bucht Wareneingang auf das Konto ohne Vorsteuer 3200 ohne BU-Schlüssel (statt
  // 3400/3300 mit BU 40, den Rewe auf Nicht-Automatikkonten abweist) – also nirgends ein BU-Schlüssel; je Satz eine Zeile
  const warenZeilen = summe(D.BELEGE.filter((b) => b.kategorie === "waren").map((b) => b.saetze.filter((x) => x.betrag).length));
  vergleich(`Paket ${name}`, "DATEV: kein BU-Schlüssel; Wareneingang auf 3200 (Zeilen BU / Zeilen 3200)", `${zeilen.filter((z) => ["40", "9", "8"].includes(z[8])).length} / ${zeilen.filter((z) => z[7] === "3200").length}`, `0 / ${warenZeilen}`);
  vergleich(`Paket ${name}`, "DATEV: Kopf Beraternummer/Mandant", `${extf[0][10]}/${extf[0][11]}`, "41077/20318");
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  if (/Umsatzsteuer-Voranmeldung/.test(liesmich)) auffaellig.push("Paket LIESMICH.txt erklärt die Zuordnung zur Umsatzsteuer-Voranmeldung (Leistungsdatum) – bei einer Kleinunternehmerin gibt es keine (außer § 13b); der Text ist für sie irreführend (apps/mobile/src/unterlagen/steuerpaket.ts).");
  const neu = paketNeuerungen(name, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, inhalt, pk, true, D.BELEGE);
  if (D.BELEGE.some((b) => b.kategorie === "bewirtung")) vergleich(`Paket ${name}`, "Fragen: Bewirtung (Anlass und Teilnehmer?)", /Bewirtung: Anlass und Teilnehmer\?/.test(neu.fragen) ? "ja" : "nein", "ja");
  vergleich(`Paket ${name}`, "Fragen: Gutschrift aufgeführt", /Gutschriften \(der Betrieb rechnet als Leistungsempfänger ab/.test(neu.fragen) ? "ja" : "nein", "ja");
  paketInfo = { anzahl: Object.keys(inhalt).length, buchungen: zeilen.length, ohneXml: pk.ohneXml, fragen: pk.fragen };
}

// ---------------------------------------------------------------- Dateinamen
{
  const nichtAscii = bau.docs.filter((d) => /[^A-Za-z0-9._-]/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen mit anderen Zeichen als A–Z, 0–9, „.“, „-“", nichtAscii.length ? nichtAscii.map((d) => d.datei).join(", ") : "keine", "keine");
  const ohneDatum = bau.docs.filter((d) => !/-\d{4}-\d{2}-\d{2}\.pdf$/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen enden mit vollständigem Datum", ohneDatum.length ? ohneDatum.map((d) => d.datei).join(", ") : "alle", "alle");
  const gut = bau.docs.filter((d) => d.titel === "Gutschrift");
  vergleich("Dateinamen", "Gutschrift heißt im Dateinamen „Gutschrift“", gut.filter((d) => !/^\d+-Gutschrift/.test(d.datei)).map((d) => d.datei).join(", ") || "ja", "ja");
  const st = bau.docs.filter((d) => d.titel === "Stornorechnung");
  vergleich("Dateinamen", "Stornorechnung heißt im Dateinamen „Stornorechnung“", st.filter((d) => !/^\d+-Storno/.test(d.datei)).map((d) => d.datei).join(", ") || "ja", "ja");
}

// ---------------------------------------------------------------- Texte in den PDFs (pdftotext): Kleinunternehmer-Pflichten
// typografisches Minus (U+2212) der PDFs wie den Bindestrich der Erwartungswerte behandeln
const pdftext = (p) => execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8" }).replace(/\u2212/g, "-");
for (const d of bau.docs.filter((y) => y.ordner === "rechnungen")) {
  const txt = pdftext(path.join(OUT, "rechnungen", d.datei));
  const flach = txt.replace(/\s+/g, " ");
  const x = D.vorgaenge().find((v) => d.datei.includes(v.nummer));
  if (x && !flach.includes(`${x.vz < 0 ? "-" : ""}${D.eur(x.s.brutto)}`)) auffaellig.push(`PDF ${d.datei}: Betrag ${D.eur(x.s.brutto)} € nicht im Text gefunden.`);
  const ohneIdNr = flach.replace(/USt-IdNr\.?/g, "").replace(/Umsatzsteuer-Identifikationsnummer/g, "");
  if (/Umsatzsteuer|\bUSt\b|MwSt/.test(ohneIdNr)) auffaellig.push(`PDF ${d.datei}: Wort „Umsatzsteuer/USt/MwSt“ auf einer Kleinunternehmer-Rechnung: „…${/.{0,40}(Umsatzsteuer|\bUSt\b|MwSt).{0,40}/.exec(ohneIdNr)?.[0]}…“`);
  if (/\b(19|7) ?%/.test(flach)) auffaellig.push(`PDF ${d.datei}: Steuersatz „19 %“/„7 %“ auf einer Kleinunternehmer-Rechnung: „…${/.{0,40}\b(19|7) ?%.{0,20}/.exec(flach)?.[0]}…“`);
  if (x && D.KUNDE_ORT[x.kunde] === "eu_b2b") {
    if (!flach.includes("Steuerschuldnerschaft des Leistungsempfängers")) auffaellig.push(`PDF ${d.datei}: Hinweis auf die Steuerschuldnerschaft des Leistungsempfängers fehlt.`);
  } else if (!flach.includes("§ 19 Abs. 1 UStG")) auffaellig.push(`PDF ${d.datei}: Kleinunternehmer-Hinweis (§ 19 Abs. 1 UStG) fehlt.`);
  const seitenZahl = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [path.join(OUT, "rechnungen", d.datei)], { encoding: "utf8" }))?.[1] ?? 1);
  if (seitenZahl > 1) auffaellig.push(`PDF ${d.datei}: ${seitenZahl} Seiten.`);
}

// ---------------------------------------------------------------- KoSIT (optional)
let kosit = "nicht geprüft (Umgebungsvariable KOSIT nicht gesetzt)";
const KOSIT = process.env.KOSIT;
if (KOSIT && fs.existsSync(KOSIT)) {
  const jar = fs.readdirSync(path.join(KOSIT, "v")).find((f) => /^validator-.*\.jar$/.test(f));
  const sz = path.join(KOSIT, "cfg", "scenarios.xml");
  const berichte = path.join(OUT, ".kosit");
  fs.mkdirSync(berichte, { recursive: true });
  const xmlDateien = [...bau.xmls.map((x) => path.join(OUT, "rechnungen", x.datei)), path.join(OUT, "belege", "b17.xml")];
  try {
    execFileSync("java", ["-cp", `${path.join(KOSIT, "v", jar)}:${path.join(KOSIT, "v", "libs")}/*`, "de.kosit.validationtool.cmd.CommandLineApplication", "-s", sz, "-r", path.dirname(sz), "-o", berichte, ...xmlDateien], { stdio: "pipe" });
  } catch {
    /* Ergebnis steht in den Berichten */
  }
  const erg = xmlDateien.map((f) => {
    const b = fs.readdirSync(berichte).find((r) => r.startsWith(path.basename(f, ".xml")) && r.includes("report") && r.endsWith(".xml"));
    const txt = b ? fs.readFileSync(path.join(berichte, b), "utf8") : "";
    const ok = /<rep:accept/.test(txt);
    const warn = (txt.match(/<rep:message[^>]*level="warning"[^>]*>[^<]*/g) ?? []).length;
    if (!ok) auffaellig.push(`KoSIT: ${path.basename(f)} nicht akzeptiert: ${(txt.match(/<rep:message[^>]*level="error"[^>]*>[^<]*/g) ?? []).slice(0, 3).map((m) => m.replace(/<[^>]*>/g, "")).join(" | ") || "kein Bericht"}`);
    return `${path.basename(f)}: ${ok ? "akzeptiert" : "ABGELEHNT"}${warn ? ` (${warn} Warnungen)` : ""}`;
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

fs.writeFileSync(path.join(OUT, "stand.json"), JSON.stringify(s, null, 1));

// ---------------------------------------------------------------- SZENARIO.md
const e = D.eur;
const md = [];
const tab = (kopf, zeilen) => [`| ${kopf.join(" | ")} |`, `|${kopf.map(() => "---").join("|")}|`, ...zeilen.map((z) => `| ${z.map((x) => String(x ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>")).join(" | ")} |`)].join("\n");
const B = D.BETRIEB;
const eu = D.euerUnabhaengig();
const ku = D.kuUmsatz();

md.push(`# Jahres-Szenario „${B.name}“ 2026`, "",
  `Erzeugt mit \`apps/mobile/werkzeuge/jahr-szenario-freiberuf.mjs\` am ${new Date().toISOString().slice(0, 10)} – mit den echten Funktionen der App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen, belegSetzen, eRechnungLesen/belegAusERechnung, umsaetzeFuer, euerUebernahme, steuerpaket, auswertung, dokumentHtml + Fußzeile wie in der App). Die Erwartungswerte stammen aus \`apps/mobile/werkzeuge/jahr-szenario-freiberuf-daten.ts\`, die nichts aus der App importiert.`, "",
  "**Neu erzeugen:** `cd packages/fachlogik && npx tsc -p tsconfig.build.json && cd ../../apps/mobile && node werkzeuge/jahr-szenario-freiberuf.mjs /tmp/claude-0/freiberuf` (optional `KOSIT=<ordner mit v/ und cfg/>`). Alle Namen, Anschriften, Steuer- und Kontonummern sind erfunden.", "",
  "## Betrieb", "",
  tab(["Angabe", "Wert"], [
    ["Name", `${B.name}, ${B.strasse}, ${B.plz} ${B.ort} (${B.bundesland})`], ["Rechtsform/Tätigkeit", `Einzelunternehmerin Mira Lindqvist, Grafikdesign als freier Beruf, seit ${D.de(D.GRUENDUNG)}, Hauptberuf, Büro in der Wohnung, keine Beschäftigten`],
    ["Steuer", `StNr ${B.steuernummer}, USt-IdNr ${B.ust_idnr} (für EU-Kundschaft und Adobe), **Kleinunternehmerin § 19 UStG** (Umsatz 2025: ${D.UMSATZ_VORJAHR.toLocaleString("de-DE")} €), EÜR nach Zufluss`],
    ["Bank", `${B.bank}, IBAN ${B.iban}, BIC ${B.bic}`], ["Kontakt", `${B.telefon}, ${B.email}, ${B.website}`],
    ["Website", "Portfolio mit Kontaktformular, Newsletter (Double-Opt-in, Briefkasten Mailservice), Schriften lokal eingebunden, Hosting Schwarzwaldhost (AVV)"], ["Steuerberatung", "Steuerbüro Kaltenbach, einmal im Jahr (EÜR + ESt); DATEV SKR03, Berater 41077 / Mandant 20318"],
  ]), "");

md.push("## Erzeugte Dateien", "", `Ordner: \`${OUT}\`. PNG-Ansichten jeder PDF-Seite (60 dpi) in \`png/\` (Name = Pfad mit \`__\`, Suffix -Seitenzahl). \`stand.json\` ist der komplette App-Stand am Ende.`, "");
md.push(tab(["Datei", "Seiten", "Inhalt / Eingaben"], dateien.map((x) => [`\`${x.rel}\``, seiten[x.rel] ?? "", x.inhalt])), "");
md.push("### Übersprungene Vorlagen", "", tab(["Vorlage", "Grund"], bau.uebersprungen.map((u) => [u.titel, u.grund])), "");

md.push("## Eingaben: Ausgangsrechnungen", "", "Kleinunternehmerin: keine Umsatzsteuer, Rechnungsbetrag = Netto. Zeile = Menge × Einzelpreis, auf Cent gerundet. Der Schalter „Kleinunternehmer“ kommt aus dem Profil; der Steuersatz der Positionen bleibt – wie in der App – auf der Vorbelegung 19 % stehen.", "");
md.push(tab(["Nr.", "Datum", "Leistung", "Kunde (Ort)", "Betrag", "Bezahlt", "Was"], D.vorgaenge().map((x) => [x.nummer, D.de(x.datum), x.art === "storno" ? `Storno zu ${x.r.nummer}` : (x.r.leistungText ?? D.de(x.leistung)), `${D.KUNDEN[x.kunde].name} (${D.KUNDE_ORT[x.kunde]})`, e(x.vz * x.s.brutto), x.bezahlt ? D.de(x.bezahlt) : "–", x.art === "storno" ? x.r.storno.grund : x.r.worum])), "");
md.push("Positionen:", "");
for (const r of D.RECHNUNGEN) md.push(`- **${r.nummer}**${r.gutschrift ? " (Gutschrift)" : ""} an ${D.KUNDEN[r.kunde].name}, Ziel ${r.ziel === "sofort" ? "sofort" : `${r.ziel} Tage`}: ${r.pos.map((p) => `${String(p.menge).replace(".", ",")} ${p.einheit} „${p.bez}“ à ${e(p.preis)} €`).join("; ")}`);
md.push("");

md.push("## Eingaben: Belege", "", "In die App wird der Bruttobetrag je Satz eingegeben, „Vorsteuer abziehbar“ AUS (Kleinunternehmerin). „USt ausgewiesen“ = so steht es auf dem Beleg.", "");
md.push(tab(["ID", "Datum", "Lieferant / Nr.", "Kategorie", "je Satz: netto + USt", "Brutto = Ausgabe", "Zahlung", "Was"], D.BELEGE.map((b) => {
  const sm = D.belegSumme(b);
  return [b.id, D.de(b.datum), `${b.lieferant}${b.nummer ? ` / ${b.nummer}` : ""}`, b.kategorie, sm.jeSatz.map((x) => `${x.satz} %: ${e(x.netto)} + ${e(x.ust)}`).join("<br>"), e(sm.brutto), `${b.zahlung}${b.bezahlt ? `, bezahlt ${D.de(b.bezahlt)}` : ""}`, b.worum];
})), "");

md.push("## Erwartete Kennzahlen (unabhängig gerechnet)", "");
md.push(tab(["Posten", "Betrag €"], [
  [`Betriebseinnahmen: ${eu.reAnzahl} in 2026 bezahlte Ausgangsrechnungen (2026-015 offen: ${e(eu.offen)} €; 2026-004/005 heben sich auf; ohne Gutschrift 2026-011)`, e(eu.einnahmen)],
  ["  davon nicht steuerbar (NL 2026-007, CH 2026-008)", e(eu.einnahmenAusland)],
  ...Object.entries(eu.nachKategorie).map(([k, w]) => [`Ausgaben ${k} (${w.anzahl} Belege, brutto)`, e(w.betrag)]),
  ["Fremdleistung: Gutschrift 2026-011 an Jonas Kiefer Fotografie (bezahlt 10.09.)", e(eu.fremd)],
  ["An das Finanzamt gezahlte USt nach § 13b (Adobe, 19 % auf 839,88 €, gezahlt 10.04.)", e(eu.ust13b)],
  ["**Summe Betriebsausgaben (ohne AfA)**", `**${e(eu.ausgaben)}**`],
  [`AfA Laptop: ${e(eu.afaBasis)} € brutto / 3 Jahre × 11/12 (netto wären es ${e(eu.afaNettoFalsch)} €)`, e(eu.afa)],
  ["**Gewinn**", `**${e(eu.ergebnis)}**`],
  ["nicht in 2026: Mobilfunk Jul–Dez (b19, bezahlt 05.01.2027), Laptop als Anlage", ""],
]), "");
md.push(`Kleinunternehmergrenze (§ 19 Abs. 1 UStG, vereinnahmt): Gesamtumsatz 2026 Inland ${e(ku.inland)} € (+ nicht steuerbar ${e(ku.ausland)} €) – unter 25.000 € (Vorjahr) bzw. 100.000 € (laufendes Jahr): ${ku.grenzeLaufendOk && ku.vorjahrOk ? "eingehalten" : "ÜBERSCHRITTEN"}.`, "");
md.push("Umsätze je Quartal (nur Information – eine Kleinunternehmerin meldet sie nicht an) und § 13b:", "", tab(["Quartal", "Umsatz (Leistungsdatum)", "§ 13b BMG", "§ 13b Steuer", "App „Aus Rechnungen“: 19 % / 7 % / ohne USt / Vorsteuer", "Vorsteuer mit App-Standardwerten"], D.umsatzQuartale().map((q) => {
  const a = bau.ust.find((u) => u.q === q.q);
  return [q.q, e(q.umsatz), e(q.p13b), e(q.steuer13b), a ? `${a.werte.umsatz_19} / ${a.werte.umsatz_7} / ${a.werte.umsatz_frei} / ${a.werte.vorsteuer ?? "–"} (${a.anzahl} Rechnungen)` : "–", a?.vorsteuerStandard ?? "–"];
})), "");

md.push("## Vergleich App ↔ unabhängige Rechnung", "", `${vergleiche.filter((v) => v.ok).length} von ${vergleiche.length} Prüfungen stimmen. Abweichungen (✗) stehen zusätzlich unter „Auffälligkeiten“.`, "");
md.push(tab(["", "Bereich", "Prüfung", "App", "erwartet"], vergleiche.map((v) => [v.ok ? "✓" : "✗", v.bereich, v.was, v.app, v.erwartet])), "");
md.push("EÜR-Übernahme der App (Rohzeilen):", "", tab(["Liste", "Bezeichnung", "Zeile Anlage EÜR", "Betrag"], [...bau.euer.uebernahme.einnahmen.map((x) => ["Einnahme", x.text, x.kategorie, x.betrag]), ...bau.euer.uebernahme.ausgaben.map((x) => ["Ausgabe", x.text, x.kategorie, x.betrag])]), "", `Ergebnis der fertigen EÜR (Formular, nach Ergänzung von AfA und § 13b-Zahlung): ${bau.euer.ergebnis.map(([a, b]) => `${a} ${b}`).join(", ")}.`, "");
md.push("Dieselbe Übernahme mit den Standardwerten der App (alle Belege „Vorsteuer abziehbar“ an):", "", tab(["Liste", "Bezeichnung", "Zeile Anlage EÜR", "Betrag"], [...bau.euer.standard.einnahmen.map((x) => ["Einnahme", x.text, x.kategorie, x.betrag]), ...bau.euer.standard.ausgaben.map((x) => ["Ausgabe", x.text, x.kategorie, x.betrag])]), "");
md.push("### Steuerberater-Paket 2026", "", `${paketInfo.anzahl} Dateien, ${paketInfo.buchungen} DATEV-Buchungen, ${paketInfo.ohneXml} Rechnungen ohne E-Rechnung (mit Grund im LIESMICH), ${paketInfo.fragen} Punkte in Fragen_2026.txt.`, "");

md.push("## Pflichten-Check der App", "", `Profil (Antworten wie in der App): ${Object.entries(bau.profil).map(([k, w]) => `${k} = ${Array.isArray(w) ? w.join("/") : w}`).join("; ")}. Stichtag 15.01.2026.`, "");
md.push("### Gilt", "", tab(["Pflicht", "ID", "Schwere", "Nächster Termin", "Grund laut App", "Vorlage (erzeugt?)"], bau.pflichten.gilt.map((p) => [p.titel, p.id, p.schwere, p.termin ? D.de(p.termin) : "–", p.grund, p.vorlage ? `${p.vorlage} (${p.erzeugt ? "ja" : "**nein**"})` : "–"])), "");
if (bau.pflichten.gruendung.length) md.push("### Gründungsschritte (Betrieb läuft schon – vermutlich erledigt)", "", tab(["Pflicht", "ID", "Grund laut App", "Vorlage"], bau.pflichten.gruendung.map((p) => [p.titel, p.id, p.grund, p.vorlage ?? "–"])), "");
if (bau.pflichten.unbekannt.length) md.push("### Noch offen (App braucht weitere Antworten)", "", ...bau.pflichten.unbekannt.map((p) => `- ${p.titel} (${p.id})${p.fragen.length ? ` – Fragen: ${p.fragen.join(", ")}` : ""}`), "");
if (bau.pflichten.jahresende.length) md.push("### Zusätzlich am 31.12.2026", "", ...bau.pflichten.jahresende.map((p) => `- ${p.titel} (${p.id}) – ${p.grund}`), "");
md.push("### Varianten des Profils (Unterschied zu oben)", "", tab(["Variante", "kommt hinzu", "fällt weg"], bau.pflichten.varianten.map((v) => [v.name, v.nurHier.join(", ") || "–", v.fehltHier.join(", ") || "–"])), "");

md.push("## Auffälligkeiten beim Erzeugen", "");
md.push("### Automatisch erkannt (Abweichungen gegen die unabhängige Rechnung bzw. Plausibilitätsprüfungen)", "");
md.push(...(auffaellig.length ? auffaellig.map((a) => `- ${a}`) : ["- keine"]), "");
md.push("### Beim Erzeugen festgestellt (fachlich, nicht automatisch prüfbar)", "", ...BEOBACHTUNGEN.map((b) => `- ${b}`), "");
md.push("## Hinweise der App und weitere Informationen", "", ...bau.infos.map((i) => `- ${i}`), `- ${kosit}`, "");
md.push("## Durchsicht aller PDF-Seiten (von Hand, anhand der PNGs)", "", `${pdfs.length} PDFs mit ${Object.values(seiten).reduce((a, b) => a + b, 0)} Seiten. Einstufung: [schwer] falsche Steuer-/Zahlenangabe mit Außenwirkung, [mittel] fachlich falsch oder widersprüchlich, [gering] Layout/Wortwahl.`, "", ...DURCHSICHT.map((x) => `- ${x}`), "");
fs.writeFileSync(path.join(OUT, "SZENARIO.md"), md.join("\n"));

console.log(`${bau.docs.length} Unterlagen, ${bau.xmls.length} XRechnungen, ${bau.belegDateien.length} Belegdateien, ${pdfs.length} PDFs → ${OUT}`);
console.log(`Vergleiche: ${vergleiche.filter((v) => v.ok).length}/${vergleiche.length} ok; Auffälligkeiten: ${auffaellig.length}`);
for (const a of auffaellig) console.log(`  - ${a}`);
