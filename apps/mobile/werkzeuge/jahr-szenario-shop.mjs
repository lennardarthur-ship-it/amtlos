/**
 * Jahres-Szenario „Kerzenwerk Lina Hoff“ 2026 (Einzelunternehmen, Hamburg, Kerzen und Naturseifen aus eigener Werkstatt,
 * Regelbesteuerung, Soll, monatliche Voranmeldung, eine Minijobberin; Verkauf über den eigenen Onlineshop in Deutschland
 * und – über der EU-Schwelle per OSS – in andere EU-Länder, an Marktständen und an Händler, davon einer in Österreich
 * mit innergemeinschaftlicher Lieferung; Gebühren aus Irland/Luxemburg mit § 13b): erzeugt mit den echten Funktionen
 * der App alle Unterlagen eines Jahres – Rechnungen (PDF + XRechnung) inkl. Stornos, Belege, Website- und
 * Datenschutzunterlagen, Minijob-Unterlagen, Arbeitsschutz (heißes Wachs, Natronlauge, ätherische Öle), Kassenbuch der
 * Marktkasse, zwölf USt-Voranmeldungen, EÜR, Steuererklärung, Kontrollmappe, Steuerberater-Pakete November und Jahr
 * (entpackt) – und schreibt SZENARIO.md mit allen Eingaben, den unabhängig gerechneten Erwartungswerten
 * (werkzeuge/jahr-szenario-shop-daten.ts) und jeder Abweichung.
 *
 *   cd apps/mobile && node werkzeuge/jahr-szenario-shop.mjs [ausgabe]     # Standard: /tmp/claude-0/shop
 *   CHROMIUM_PFAD=…   anderer Chromium (Standard /opt/pw-browsers/chromium)
 *
 * Voraussetzungen wie jahr-szenario.mjs: pnpm install, gebaute Pakete (@amtlos/fachlogik dist), Chromium, poppler.
 * Ändert keinen Produktcode und schreibt nichts ins Repository.
 */
/* global URL, process, document, TextDecoder, Buffer, console -- Node-Skript (document: im Browser per page.evaluate) */
/* eslint-disable no-console -- Ausgabe auf der Konsole ist der Zweck des Werkzeugs */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Fachliche Beobachtungen beim Erzeugen (Oktober 2026), die sich nicht als Zahlvergleich automatisieren lassen – mit
 * Fundstelle und Vorschlag. Bei jedem Lauf erneut prüfen und hier pflegen.
 */
const BEOBACHTUNGEN = [
  "**[schwer] Shop- und Marktumsätze fehlen – und anders als bei der Kasse warnt die App nicht.** Rund 96.900 € netto (Shop Inland/EU vor der Schwelle 59.544 €, OSS 21.323 €, Marktkasse 16.048 €) stehen nur rund 17.500 € aus Rechnungen gegenüber. Voranmeldung, EÜR-Übernahme und Steuerberater-Paket kennen nur Rechnungen und Belege. Der Hinweis hängt allein an `kasse.elektronisch` (`apps/mobile/src/unterlagen/steuerpaket.ts:76` `kassenHinweis`, `:83` `kassenSatzPaket`). Bei „Eigener Onlineshop“ ohne Kasse sagen Übernahme und LIESMICH nichts; die Zeile „Kassenumsätze (Z-Bons …)“ (`steuerpaket.ts:581`) passt nicht auf Shop-Berichte. Vorschlag (sofort): die Lage zusätzlich aus `vertrieb.kanaele` (onlineshop/marktplatz/app) ableiten, Text „Umsätze laut Shop-/Plattform- und Zahlungsberichten fehlen“. Als neue Funktion: monatlicher Sammelumsatz (Brutto je Land und Satz, Erstattungen) aus einem Shop-CSV, der in Voranmeldung, OSS, EÜR und DATEV einfließt.",
  "**[schwer] OSS gibt es in der App nicht.** Die EU-Schwelle (10.000 €, § 3c Abs. 4 UStG) wird am 17.07. überschritten; OSS Q3 1.221,32 €, Q4 3.126,72 €. Im Katalog gibt es keine Pflicht zu § 18j UStG oder § 3c (keine Datei unter `catalog/pflichten/`), keine Vorlage, und die Rechnung kennt nur 19/7/0 % (`packages/fachlogik/src/dokumente/buchhaltung.ts:23` `SAETZE`). Eine Rechnung auf Wunsch an eine Verbraucherin in Wien (20 %) lässt sich nicht richtig schreiben (siehe Varianten). Vorschlag: Pflicht „Fernverkäufe in die EU: Schwelle überwachen, OSS-Registrierung und Quartalserklärung“ (Auslöser b2c + Regionen eu + Waren + onlineshop/marktplatz) – fachlich prüfen lassen; dazu als neue Funktion Länder-Steuersätze, ein OSS-Arbeitsblatt je Quartal und eine Schwellenzählung.",
  "**[schwer] § 13b: kein Merkmal am Beleg, keine Kennzahlen.** Shopwerk, Stripe und Meta (Irland) lassen sich nur mit 0 % und ohne Vorsteuer erfassen (`packages/fachlogik/src/belege.ts:20` `Beleg` ohne Steuerschuld-Merkmal). Die Voranmeldung hat keine Kz 46/47/67 (`buchhaltung.ts:652–661`). Die Zahllast stimmt, weil sich Steuer und Vorsteuer ausgleichen; Umsatzsteuer und Vorsteuer des Jahres in der Steuererklärung fehlen aber je 670,13 €. DATEV bucht die Belege auf 4930/4600 ohne Steuerschlüssel (`packages/fachlogik/src/buchungen.ts:183`). Vorschlag (neue Funktion): Schalter „Steuerschuldnerschaft des Leistungsempfängers (§ 13b)“ am Beleg mit Herkunft EU/Drittland; daraus Kz 46/47/67 (bzw. 52/53, 84/85) und ein DATEV-Steuerschlüssel nach Abstimmung mit der Steuerberatung.",
  "**[mittel] Soll-Versteuerung: Zahlung vor der Leistung wird nicht erkannt.** 2026-015: Rechnung 20.10., Leistung 16.11., voll bezahlt am 30.10. Nach § 13 Abs. 1 Nr. 1 a Satz 4 UStG entsteht die Steuer im Oktober; `zuordnen()` nimmt im Soll-Modus immer das Leistungsdatum (`apps/mobile/src/unterlagen/ustAusRechnungen.ts:54–60`). Folge: Zahllast Oktober −227,98 €, November +227,98 €. Vorschlag (sofort): im Soll-Modus bei vermerkter Zahlung vor dem Leistungsdatum den Zahltag nehmen (Stornos ausgenommen). Teilzahlungen (Anzahlungen) bräuchten eine neue Funktion.",
  "**[mittel] igL: Steuerart bekannt, aber Kz 41 nicht ausgewiesen; ZM ohne Termin und ohne Vorlage.** Rechnung, XRechnung (Kategorie K, BT-48) und EÜR-Zeile stimmen. Die Voranmeldung zeigt die 1.303,80 € bzw. 2.367,40 € aber nur unter „Steuerfreie oder nicht steuerbare Umsätze“ und überlässt die Kennzahl der Nutzerin (`buchhaltung.ts:654`, `:693`), obwohl `eRechnungAus` die Steuerart „igl“ liefert. DATEV bucht auf 8100 statt eines igL-Kontos (`buchungen.ts:88`). Die Pflicht „Zusammenfassende Meldung“ hat keinen Termin (`catalog/pflichten/steuern.zusammenfassende_meldung.yaml`, Frist „dauerhaft“; fällig wären 27.04. und 26.10.2026). Vorschlag: in `umsaetzeFuer` 0 % nach Steuerart trennen (igl → eigenes Feld „Kz 41“); ZM-Termine (monatlich bzw. vierteljährlich, § 18a UStG) fachlich prüfen und im Katalog hinterlegen. Eine ZM-Vorlage wäre eine neue Funktion (schon im Café-Szenario vermerkt).",
  "**[mittel] Teil-Retoure als „Gutschrift“ verschwindet aus der Umsatzsteuer.** Die Händlerin schickt 12 Kerzen zurück; im Handel heißt die Korrektur „Gutschrift“. Mit diesem Hinweis lässt die App den Beleg als Abrechnung des Leistungsempfängers ganz aus (Variante: umsatz_19 unverändert statt −134,40 €). Der Hinweis heißt nur „Gutschrift“ (`packages/fachlogik/src/dokumente/bausteine.ts:2094`). Eine Teilkorrektur gibt es nicht, nur das Stornieren der ganzen Rechnung. Vorschlag (sofort): Text „Gutschrift (Abrechnung durch den Leistungsempfänger, § 14 Abs. 2 Satz 2 UStG) – keine Rechnungskorrektur“ und ein Hinweis auf das Stornieren. Neue Funktion: „Rechnungskorrektur/Teilgutschrift“ mit Bezug auf die Originalrechnung (§ 17 UStG).",
  "**[mittel] Rechnung zu einer Shop-Bestellung: Doppelerfassung und Netto-Zwang.** 2026-011 dokumentiert die Bestellung #2391, die schon im Shop-Bericht steht. Die App kann das nicht markieren; wer die Shop-Umsätze ergänzt, zählt sie doppelt (hier von Hand herausgerechnet). Preise gehen nur netto: 79,59 € statt 79,60 €. Außerdem fordert das PDF „Bitte überweisen Sie 79,59 € sofort“, obwohl der Hinweis „bereits bezahlt per PayPal“ sagt (Zahlungsblock auch bei vermerkter Zahlung). Vorschlag: Zahlungsblock weglassen, wenn `bezahlt` am oder vor dem Rechnungsdatum vermerkt ist (sofort). Als neue Funktion: Bruttopreise für Verbraucherrechnungen und ein Merkmal „Umsatz schon über Shop/Kasse erfasst“, das die Rechnung aus Voranmeldung und EÜR herausnimmt.",
  "**[mittel] Pflichten-Check: Plausibilität für einen Online-Kosmetikshop.** (1) KosmetikVO nur, wenn die Branche „Beauty und Kosmetik“ gewählt ist (`catalog/pflichten/branche.beauty_kosmetikverordnung.yaml`). Mit „Onlinehandel“ und Produkt „Kosmetik“ fehlt sie (Variante). Die Erklärung nennt verantwortliche Person, Sicherheitsbewertung und PIF, nicht aber die CPNP-Notifizierung vor dem Inverkehrbringen (Art. 13), die gute Herstellungspraxis (Art. 8) und die Kennzeichnung (Art. 19). (2) Dieselbe Branche zieht den Hygieneplan nach IfSG bzw. Länder-Hygieneverordnung nach sich, der für Studios gedacht ist, nicht für die Herstellung. (3) Keine OSS-Pflicht (siehe oben). (4) „Link zur OS-Plattform prüfen“ mit VO (EU) Nr. 524/2013 (`catalog/pflichten/online.os_link.yaml`). Die OS-Plattform ist eingestellt; die Verordnung wurde mit Wirkung zum 20.07.2025 aufgehoben (VO (EU) 2024/3228) – bitte fachlich bestätigen und dann in „Link entfernen“ umwandeln oder streichen. (5) Der Widerrufsbutton (gilt ab 19.06.2026) erscheint am 15.01. nicht im 12-Monats-Blick, erst ab Juli. (6) Für ein Einzelunternehmen bleiben „AWV-Meldung“ und „Investitionsprüfung“ dauerhaft „offen“: Die Frage `gesellschafter.auslaendische_investoren` wird nur bei GmbH/UG gestellt (`packages/i18n/src/fragen.ts:86`, `:112`). (7) „Anmeldezeitraum der Lohnsteuer angeben“ gilt, obwohl bei nur einem Minijob mit 2 % Pauschsteuer keine Lohnsteuer-Anmeldung anfällt; eine Antwort „keine“ fehlt. (8) Keine Antwort für Markt-/Weihnachtsmarktstände (`fragen.ts:339`). Wer „Über Marktplätze“ ankreuzt, bekommt Marktplatz-/DAC7-Pflichten (Variante). (9) VerpackG, GPSR, PAngV (Grundpreis je 100 g bei Seife), Widerrufsbelehrung und Button-Lösung erscheinen richtig, aber ohne Vorlage (Muster-Widerrufsbelehrung/-formular, GPSR-Produktangaben, LUCID/Systembeteiligung als Nachweis). BFSG und VSBG fehlen richtigerweise (1 Beschäftigte).",
  "**[mittel] Datenschutzerklärung für einen Shop unvollständig.** Es gibt keine Bausteine für Bestellabwicklung, Zahlungsdienstleister, Versanddienst, Kundenkonto oder Tracking-/Werbe-Pixel (`packages/fachlogik/src/dokumente/website.ts:44–62`); alles stand hier in „Weitere Verarbeitungen“. Der feste Absatz „Pflicht zur Bereitstellung … weder gesetzlich noch vertraglich verpflichtet“ (`website.ts:89`) ist für Bestellungen falsch (ohne Name/Anschrift kein Vertrag). Auch VVT und Datenschutzinformation haben keinen Vorschlag „Onlineshop/Bestellabwicklung“. Vorschlag: Bausteine „Onlineshop“, „Zahlungsdienstleister“, „Versand“, „Werbe-Pixel (Einwilligung)“; den Satz zur Bereitstellung bei Shop-Bausteinen anpassen.",
  "**[mittel] EÜR-Übernahme: Der Hinweis nennt USt-Zahlungen und AfA, nicht aber Shop-, Markt- und OSS-Einnahmen** (`steuerpaket.ts:146` `EUER_NICHT_ENTHALTEN`). Die OSS-Zahlung an das BZSt hat keine eigene Zeile; sie steht hier mit unter „An das Finanzamt gezahlte … Umsatzsteuer“. Vorschlag: Hinweis nach Profil ergänzen; die Zuordnung der OSS-Beträge in der Anlage EÜR fachlich bestätigen lassen.",
  "**[gering] Lohnkonto Minijob:** „Steuerklasse“ ist Pflicht (`packages/fachlogik/src/dokumente/lohn.ts:142`), deshalb meldet die App „Fehlt noch: Steuerklasse“, obwohl bei der Pauschsteuer keine ELStAM gelten. Eine Spalte „Pauschsteuer (Minijob-Zentrale)“ fehlt (`lohn.ts:109`), die 2 % stecken hier in „SV-Beiträge Arbeitgeber“. Vorschlag: Art „Minijob (pauschal)“ mit optionaler Steuerklasse und eigener Spalte – fachlich prüfen (§ 4 Abs. 2 Nr. 8 LStDV).",
  "**[gering] Kontrollmappe:** Bei 12 Unterlagen läuft das Deckblatt wegen des Schlusssatzes auf eine zweite, fast leere Seite (`apps/mobile/src/unterlagen/kontrollmappe.ts:133`). Die Titel werden nach 40 Zeichen mitten im Wort abgeschnitten („… (Großhandel, Markts“, „… Eukaly“) (`packages/fachlogik/src/dokumente/index.ts:187`). Vorschlag: Hinweis in die Fußzeile bzw. kleiner setzen, an Wortgrenzen kürzen und „…“ anhängen.",
  "**[gering] Arbeitsschutz-Vorschläge passen nicht auf Herstellung.** Keine Gruppe „Werkstatt/Herstellung“ (heißes Wachs, Wachsbrand, Laugen, ätherische Öle); die Gruppe „Handwerk“ ist bau-lastig, Hautschutzplan-Vorschläge gibt es nur für Friseure. Die Zeilen wurden von Hand geschrieben.",
  "**[gering] Kassenbuch** heißt „Vorlage zum Ausdrucken“, lässt sich aber vollständig ausfüllen und wird nicht festgeschrieben. Endbestand 1.104,50 € stimmt. Ob ein in der App geführtes Kassenbuch die Unveränderbarkeit (§ 146 Abs. 4 AO) erfüllt, ist eine Frage an die Fachprüfung.",
  "**Geprüft und unauffällig:** alle 19 Rechnungsbeträge inkl. zweier Stornos (eins im selben Monat, eins im Folgemonat), fortlaufende Nummern, Festschreibung; igL-Rechnungen mit beiden USt-IdNrn. und Hinweis, XRechnung Kategorie K mit BT-48; 16 XRechnungen (nur Privatkunden ohne); Vorsteuer aus Brutto ohne Cent-Abweichung (auch 7 %-Rohstoffe); Soll-Übernahme in 10 von 12 Monaten exakt, Storno 2026-014 richtig im Oktober; Vorsteuer nach Belegdatum (b17 im Dezember, Ausgabe 2027); EÜR-Übernahme (Zufluss/Abfluss, igL-Zeile, Anlage erkannt, privat bezahlter Beleg); EÜR und Gewinn nach den Ergänzungen von Hand exakt; Pflichten-Check für EÜR, ESt/GewSt/USt, monatliche Voranmeldung (10.02.), Minijob, § 17 MiLoG, Gefahrstoffe, AVV/VVT, BFSG/VSBG richtig nicht; Kontrollmappe mit beiden AVV und beiden Betriebsanweisungen.",
];

/** Ergebnis der Durchsicht jeder PDF-Seite (PNG, 60 dpi) – von Hand gepflegt. */
const DURCHSICHT = [
  "**Rechnungen 01–19 (21 Seiten):** einheitlich, bis auf die igL-Rechnungen alles auf einer Seite, Beträge und Fälligkeiten stimmen; Fußzeile mit Steuernummer und USt-IdNr. **2026-003 und 2026-012:** Der Pflichthinweis „Steuerfreie innergemeinschaftliche Lieferung (§ 4 Nr. 1 Buchst. b …)“, Lieferanschrift und Gruß stehen allein auf Seite 2, obwohl auf Seite 1 rund ein Viertel frei ist; die Summenzeile „Umsatzsteuer 0 % (steuerfreie innergemeinschaftliche Lieferung) auf 1.303,80 €“ bricht dreizeilig um [gering]. **2026-011** fordert trotz „bereits bezahlt“ zur Überweisung auf (siehe oben) [mittel]. Privatkunden 2026-004/-011/-018 mit „Sehr geehrte Damen und Herren“ [gering, bekannt]. Stornos 2026-007/-014 ohne Zahlungsblock mit Verweis auf das Original, Leistungsdatum des Originals. Fußzeile „Inhaber/in: Lina Hoff“ statt „Inhaberin“ [gering].",
  "**Impressum (1 S.):** vollständig für ein Einzelunternehmen (Inhaber/in, Kontakt, USt-IdNr., VSBG „nicht bereit“), keine Steuernummer, kein OS-Link. Überschrift „Inhaber/in“ nicht an die Person angepasst [gering].",
  "**Datenschutzerklärung (5 S.):** 16 Abschnitte, Hosting Irland, Banner, Newsletter, Hamburger Aufsicht richtig. Die Shop-Teile stehen gesammelt unter „Weitere Verarbeitungen“ als lange Absätze ohne Zwischenüberschriften; „Pflicht zur Bereitstellung“ falsch für Bestellungen (siehe oben). Seite 5 nur mit dem Ende von Abschnitt 15 und Abschnitt 16.",
  "**AVV Shopwerk und Postfach Marketing (je 3 S.):** Parteien, Gegenstand und Unterauftragnehmer korrekt; Anführungszeichen im Hauptvertrag („… Tarif ‚Grow‘ …“) richtig verschachtelt. Für den irischen Anbieter mit US-Unterauftragnehmer gibt es keinen eigenen Absatz zu Drittlandübermittlungen über die Weisungsklausel hinaus [gering]. Seite 3: nur § 5 und Unterschriften.",
  "**Datenschutzinformation (5 S.), VVT (8 S.):** vollständig; die eigenen Zeilen „Onlineshop“ und „Meta-Pixel“ sauber im Raster nach Art. 30. VVT-Feld „Zwecke (lit. b)“ auch beim Pixel (Einwilligung) – nur Beschriftung.",
  "**Verfahrensdokumentation (3 S.), Aufbewahrungsplan (1 S.):** in Ordnung; Shop-Berichte, OSS, Marktkasse und PIF stehen als ergänzte Zeilen. Der Aufbewahrungsplan rechnet „aufbewahren bis“ aus Frist + Jahr richtig.",
  "**Minijob: Nachweis (2 S.), Personalfragebogen (2 S.), Lohnkonto (1 S.), Arbeitszeitnachweis (1 S.):** Inhalte korrekt (580 €, 40:00 h, Personengruppe 109). Lohnkonto: Feld „Steuerklasse“ leer mit Linie, Pauschsteuer ohne Spalte. Personalfragebogen Seite 2 nur mit Zeile 13 und Unterschrift [gering, bekannt].",
  "**Gefährdungsbeurteilung (3 S.), Unterweisung (2 S.), Gefahrstoffverzeichnis (1 S., quer), BA-01/BA-02, Hautschutzplan (je 1 S.):** gut lesbar; fehlendes Sicherheitsdatenblatt beim Duftöl als „fehlt – anfordern“ markiert. Unterweisungsnachweis: Seite 2 enthält nur den Satz zur jährlichen Wiederholung [gering, Umbruch]. Der Hautschutzplan trägt den braunen Beauty-Kopf – für eine Werkstatt unpassend [gering].",
  "**Kassenbuch Dezember (2 S., quer):** 23 Tageseinnahmen und 4 Einzahlungen, laufender Bestand und Summenzeile stimmen (9.754,50 € / 8.800,00 € / 1.104,50 €).",
  "**USt-Voranmeldungen Januar–Dezember (14 S.):** „nach vereinbarten Entgelten“ richtig, Kz 81/66/83 stimmen bis auf Oktober/November (2026-015). igL nur als „Steuerfreie oder nicht steuerbare Umsätze“ mit Kennzahl-Auswahl im Kleingedruckten; § 13b nur in der Notiz. März und September laufen wegen der Notiz auf eine zweite Seite, die nur die Felder „Übermittelt am / Transferticket“ enthält [gering, Umbruch]. Kz 81 mit Cent, obwohl „im Vordruck in vollen Euro“ daneben steht [gering, bekannt].",
  "**EÜR (3 S.), Steuererklärung (2 S.):** Beträge stimmen, Summen je Anlage-EÜR-Zeile übersichtlich. Steuererklärung: „Umsatzsteuer/Vorsteuer im Jahr“ ohne § 13b (in der Notiz erklärt); Seite 2 nur mit Notiz und Übermittlungsfeldern.",
  "**Kontrollmappe (33 S.):** Deckblatt mit 12 Einträgen und richtigen Startseiten; Seite 2 des Deckblatts fast leer, Titel mitten im Wort gekürzt (siehe oben). Danach die Unterlagen mit eigenen Fußzeilen.",
  "**Belegdateien (Eingaben des Werkzeugs, 39 S.):** lesbar, je eine Seite; § 13b-Rechnungen mit „Reverse charge“-Vermerk und USt-IdNr. der Empfängerin.",
];

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? "/tmp/claude-0/shop");
for (const d of ["pdf", "rechnungen", "png", "belege", "steuerpaket-2026-11", "steuerpaket-jahr"]) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

// ---------------------------------------------------------------- bündeln
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const gebaut = path.join(OUT, ".jahr-szenario-shop.mjs");
execFileSync(path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild"), [path.join(HIER, "jahr-szenario-shop.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
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

// ---------------------------------------------------------------- PDF wie die App (wie jahr-szenario.mjs)
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
  merke(`rechnungen/${x.datei}`, `XRechnung 3.0 (UBL) zu Rechnung ${x.nummer}, erzeugt mit eRechnungAus + xrechnungUbl wie „Als E-Rechnung teilen“.`);
}
const belegBytes = {};
for (const b of bau.belegDateien) {
  const bytes = await einfachPdf(b.html);
  belegBytes[b.datei] = bytes;
  fs.writeFileSync(path.join(OUT, "belege", b.datei), bytes);
  const roh = D.BELEGE.find((x) => b.datei.startsWith(x.id + "."));
  merke(`belege/${b.datei}`, `Eingabe: ${roh.lieferant} ${roh.nummer ?? ""} vom ${D.de(roh.datum)} – ${roh.worum}`);
}

// ---------------------------------------------------------------- Kontrollmappe wie die Seite „Kontrollmappe“ (Deckblatt zweimal, dann zusammenfügen)
const km = S.mappe(s);
{
  const teile = [];
  for (const x of km.html) teile.push(await appPdf(x.html, x.quer));
  const seiten = await Promise.all(teile.map(S.seitenzahl));
  let deckSeiten = 1;
  let deck = null;
  for (let i = 0; i < 2; i++) {
    const start = S.startSeiten(deckSeiten, seiten);
    deck = await appPdf(S.deckblattHtml(s.betrieb.name, "2026-12-31", km.eintraege.map((e, j) => ({ ...e, seite: start[j] }))), false);
    const n = await S.seitenzahl(deck);
    if (n === deckSeiten) break;
    deckSeiten = n;
  }
  const bytes = await S.mappeZusammenfuegen([deck, ...teile]);
  const name = S.mappeDateiname(s.betrieb.name, "2026-12-31");
  fs.writeFileSync(path.join(OUT, "pdf", name), bytes);
  merke(`pdf/${name}`, `Kontrollmappe (mappenAuswahl + deckblattHtml + mappeZusammenfuegen wie die Seite „Kontrollmappe“): ${km.eintraege.length} Unterlagen – ${km.eintraege.map((e) => e.titel).join(", ")}; ${km.unvollstaendig} unvollständige ausgelassen.`);
  const inMappe = new Set(km.eintraege.map((e) => e.vorlage));
  for (const [vid, warum] of [["gefaehrdungsbeurteilung", "Arbeitsschutz"], ["gefahrstoffverzeichnis", "Gefahrstoffe"], ["betriebsanweisung", "Gefahrstoffe"], ["unterweisung", "Arbeitsschutz"], ["arbeitszeitnachweis", "§ 17 MiLoG (Zoll)"], ["nachweis_arbeitsbedingungen", "NachwG"], ["datenschutz_dokumentation", "VVT"], ["avv", "Art. 28 DSGVO"], ["hautschutzplan", "TRGS 401"]]) {
    vergleich("Kontrollmappe", `enthält ${vid} (${warum})`, inMappe.has(vid) ? "ja" : "nein", "ja");
  }
  vergleich("Kontrollmappe", "beide AVV (Shop-System und Newsletter) enthalten", String(km.eintraege.filter((e) => e.vorlage === "avv").length), "2");
  vergleich("Kontrollmappe", "beide Betriebsanweisungen (BA-01, BA-02) enthalten", String(km.eintraege.filter((e) => e.vorlage === "betriebsanweisung").length), "2");
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

function paketPruefen(name, zr, erg, ordner) {
  fs.writeFileSync(path.join(OUT, erg.dateiname), erg.zip);
  merke(erg.dateiname, `Steuerberater-Paket ${name} (steuerpaket(), ZIP wie in der App).`);
  const inhalt = S.unzipSync(erg.zip);
  for (const [p, bytes] of Object.entries(inhalt)) {
    fs.mkdirSync(path.dirname(path.join(OUT, ordner, p)), { recursive: true });
    fs.writeFileSync(path.join(OUT, ordner, p), bytes);
  }
  merke(`${ordner}/`, `entpacktes Paket ${name}: ${Object.keys(inhalt).length} Dateien (${Object.keys(inhalt).filter((p) => !p.includes("/")).join(", ")}, E-Rechnungen/, Belege/).`);
  const bereich = `Paket ${name}`;
  const im = (iso) => iso >= zr.von && iso <= zr.bis;
  const vg = D.vorgaenge().filter((x) => im(x.datum));
  const bl = D.BELEGE.filter((b) => im(b.datum));
  const re = liste(inhalt[`Rechnungen_${zr.name}.csv`]);
  vergleich(bereich, "Anzahl Rechnungen (nach Rechnungsdatum)", re.zeilen.length, vg.length);
  vergleich(bereich, "Rechnungsliste: Summe Netto", summe(re.zeilen.map((z) => centAus(re.w(z, "Netto")))), summe(vg.map((x) => x.vz * x.s.netto)));
  vergleich(bereich, "Rechnungsliste: Summe Brutto", summe(re.zeilen.map((z) => centAus(re.w(z, "Brutto")))), summe(vg.map((x) => x.vz * x.s.brutto)));
  const igl = re.zeilen.filter((z) => /igL/.test(re.w(z, "Steuerart"))).map((z) => re.w(z, "Nummer"));
  vergleich(bereich, "Rechnungsliste: Steuerart „igL“ bei den Österreich-Rechnungen", igl.join(", ") || "keine", vg.filter((x) => x.r.igl && x.art === "rechnung").map((x) => x.nummer).join(", ") || "keine");
  const be = liste(inhalt[`Belege_${zr.name}.csv`]);
  vergleich(bereich, "Anzahl Belege (nach Belegdatum)", be.zeilen.length, bl.length);
  vergleich(bereich, "Belegliste: Summe Brutto", summe(be.zeilen.map((z) => centAus(be.w(z, "Brutto")))), summe(bl.map((b) => D.belegSumme(b).brutto)));
  vergleich(bereich, "Belegliste: Summe Vorsteuer", summe(be.zeilen.map((z) => centAus(be.w(z, "Vorsteuer")))), summe(bl.map((b) => D.belegSumme(b).vorsteuer)));
  vergleich(bereich, "Belegdateien im Paket", Object.keys(inhalt).filter((p) => p.startsWith("Belege/")).length, bl.length);
  const extf = csvLesen(inhalt[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1");
  const zeilen = extf.slice(2);
  vergleich(bereich, "DATEV: Spalten je Zeile = Spalten im Kopf", zeilen.every((z) => z.length === extf[1].length) ? "ja" : "nein", "ja");
  vergleich(bereich, "DATEV: Kopf Beraternummer/Mandant", `${extf[0][10]}/${extf[0][11]}`, "52190/10744");
  const kontoSumme = (konto) => summe(zeilen.filter((z) => z[7] === konto).map((z) => (z[1] === "H" ? -1 : 1) * centAus(z[0])));
  vergleich(bereich, "DATEV: Brutto auf Erlöskonto 8400 (19 %)", kontoSumme("8400"), summe(vg.map((x) => x.vz * (x.s.gruppen["19"] ? x.s.gruppen["19"].netto + x.s.gruppen["19"].ust : 0))));
  if (vg.some((x) => x.r.igl)) vergleich(bereich, "DATEV: igL auf eigenem Erlöskonto (SKR03 8125 statt 8100 „steuerfrei“)", kontoSumme("8125") ? "8125" : kontoSumme("8100") ? "8100" : "–", "8125");
  // § 13b-Belege: im Stapel ohne Steuerschlüssel für Reverse Charge
  const b13 = bl.filter((b) => b.p13b);
  if (b13.length) {
    const kennungen = new Set(b13.map((b) => (b.nummer ?? "").replace(/[^A-Za-z0-9$&%*+\-/]/g, "").slice(0, 36)));
    const zeilen13 = zeilen.filter((z) => [...kennungen].some((k) => k && z[10].startsWith(k.slice(0, 12))));
    // R10: § 13b-Belege auf dem Automatikkonto 3123 (sonstige Leistung aus dem EU-Ausland, Vorsteuer und Umsatzsteuer)
    vergleich(bereich, `DATEV: § 13b-Belege (${b13.map((b) => b.id).join(", ")}) auf dem § 13b-Konto 3123`, zeilen13.length ? ([...new Set(zeilen13.map((z) => `${z[6]}/${z[8] || "ohne BU"}`))].join(", ")) : "nicht gefunden", "3123/ohne BU");
  }
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  const fragen = inhalt[`Fragen_${zr.name}.txt`] ? Buffer.from(inhalt[`Fragen_${zr.name}.txt`]).toString("utf8") : "";
  vergleich(bereich, "LIESMICH: Hinweis auf fehlende Shop-/Markt-Umsätze (Onlineshop laut Profil, offene Ladenkasse)", /Shop|Marktkasse|Ladenkasse|Plattform|Zahlungsdienst/.test(liesmich) ? "ja" : "nein", "ja");
  vergleich(bereich, "LIESMICH: Hinweis auf OSS-Fernverkäufe bzw. § 13b-Belege", /OSS|One-Stop|13b/.test(liesmich) ? "ja" : "nein", "ja");
  vergleich(bereich, "LIESMICH: erklärt Soll-Versteuerung (Leistungsdatum)", /Soll-Versteuerung|Leistungsdatum/.test(liesmich) ? "ja" : "nein", "ja");
  vergleich(bereich, "LIESMICH: Rechtsform Einzelunternehmen", /- Rechtsform: Einzelunternehmen/.test(liesmich) ? "ja" : "nein", "ja");
  return { anzahl: Object.keys(inhalt).length, buchungen: zeilen.length, fragen: erg.fragen, fragenText: fragen };
}
const pMonat = paketPruefen("November 2026", { von: "2026-11-01", bis: "2026-11-30", name: "2026-11" }, pk.monat, "steuerpaket-2026-11");
const pJahr = paketPruefen("Jahr 2026", { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, pk.jahr, "steuerpaket-jahr");

// ---------------------------------------------------------------- Dateinamen und Texte in den PDFs
{
  const nichtAscii = bau.docs.filter((d) => /[^A-Za-z0-9._-]/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen mit anderen Zeichen als A–Z, 0–9, „.“, „-“", nichtAscii.length ? nichtAscii.map((d) => d.datei).join(", ") : "keine", "keine");
}
const pdftext = (p) => execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8" }).replace(/−/g, "-");
for (const x of D.vorgaenge()) {
  const d = bau.docs.find((y) => y.ordner === "rechnungen" && y.datei.includes(x.nummer));
  if (!d) continue;
  const txt = pdftext(path.join(OUT, "rechnungen", d.datei)).replace(/\s+/g, " ");
  const soll = `${x.vz < 0 ? "-" : ""}${D.eur(x.s.brutto)}`;
  if (!txt.includes(soll)) auffaellig.push(`PDF ${d.datei}: Rechnungsbetrag ${soll} € nicht im Text gefunden.`);
  if (x.r.igl && x.art === "rechnung") {
    for (const [was, re] of [["USt-IdNr. der Kundin ATU68215437", /ATU68215437/], ["eigene USt-IdNr. DE347215896", /DE347215896/], ["Hinweis steuerfreie innergemeinschaftliche Lieferung", /innergemeinschaftliche Lieferung/]]) vergleich(`Rechnung ${x.nummer} (§ 14a Abs. 3 UStG)`, `PDF enthält ${was}`, re.test(txt) ? "ja" : "nein", "ja");
  }
  if (x.nummer === "2026-001") vergleich("Rechnung 2026-001 (Einzelunternehmen)", "Zahlungsblock ohne doppelten Namen – die Inhaberin steht schon in der Firma (R11: „Empfänger: Kerzenwerk Lina Hoff“)", /Empfänger: Kerzenwerk Lina Hoff(?! \(Lina Hoff\))/.test(txt) ? "ja" : "nein", "ja");
}
for (const d of bau.docs.filter((y) => y.vorlage === "impressum" || y.vorlage === "datenschutzerklaerung_website")) {
  const txt = pdftext(path.join(OUT, "pdf", d.datei)).replace(/\s+/g, " ");
  if (d.vorlage === "impressum") {
    for (const [was, re] of [["USt-IdNr.", /DE347215896/], ["Inhaberin Lina Hoff", /Lina Hoff/], ["Telefon", /040 85407219/]]) vergleich("Impressum (§ 5 DDG)", `enthält ${was}`, re.test(txt) ? "ja" : "nein", "ja");
    vergleich("Impressum (§ 5 DDG)", "keine Steuernummer", /43\/158\/02741/.test(txt) ? "Steuernummer steht drin" : "keine", "keine");
  }
  if (d.vorlage === "datenschutzerklaerung_website") for (const [was, re] of [["Shop-System (Hoster)", /Shopwerk/], ["Newsletter-Dienst", /Postfach Marketing/], ["Zahlungsdienstleister", /PayPal/], ["Einwilligungsbanner", /Einwilligungsbanner/], ["Hamburger Aufsichtsbehörde", /Hamburg/]]) vergleich("Datenschutzerklärung", `enthält ${was}`, re.test(txt) ? "ja" : "nein", "ja");
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
const mo = D.ustMonate();
const j = D.jahresSummen();
const eu = D.euerUnabhaengig();
const oss = D.ossQuartale();
const sw = D.schwelle();

md.push(`# Jahres-Szenario „${B.name}“ 2026`, "",
  `Erzeugt mit \`apps/mobile/werkzeuge/jahr-szenario-shop.mjs\` am ${new Date().toISOString().slice(0, 10)} – mit den echten Funktionen der App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen, belegSetzen, umsaetzeFuer mit „soll“, euerUebernahme, steuerpaket, mappenAuswahl/deckblattHtml/mappeZusammenfuegen, auswertung, dokumentHtml + Fußzeile wie in der App). Die Erwartungswerte stammen aus \`apps/mobile/werkzeuge/jahr-szenario-shop-daten.ts\`, die nichts aus der App importiert.`, "",
  "**Neu erzeugen:** `cd packages/fachlogik && npx tsc -p tsconfig.build.json && cd ../../apps/mobile && node werkzeuge/jahr-szenario-shop.mjs /tmp/claude-0/shop`. Namen, Anschriften, Steuer- und Kontonummern des Betriebs, der Kundschaft und der meisten Lieferanten sind erfunden.", "",
  "## Betrieb", "",
  tab(["Angabe", "Wert"], [
    ["Firma", `${B.name}, ${B.strasse}, ${B.plz} ${B.ort} (${B.bundesland}) – Einzelunternehmen, Inhaberin ${B.verantwortlich}, Gewerbe seit ${D.de(D.GRUENDUNG)}`],
    ["Tätigkeit", "Herstellung von Duftkerzen (Rapswachs) und kaltgerührten Naturseifen (kosmetische Mittel) in eigener Werkstatt; Verkauf über eigenen Onlineshop (Shop-System „Shopwerk“, Irland), Kunsthandwerker- und Weihnachtsmarkt (offene Ladenkasse), Großhandel an Läden/Hotels in Deutschland und an eine Händlerin in Graz"],
    ["Steuer", `StNr ${B.steuernummer}, USt-IdNr ${B.ust_idnr}, Regelbesteuerung, SOLL-Versteuerung, Voranmeldung MONATLICH (Zahllast Vorjahr 14.200 €), keine Dauerfristverlängerung, EÜR`],
    ["EU-Fernverkäufe", `2025: ${e(sw.vorjahr)} € netto (unter 10.000 €). 2026: bis 16.07. ${e(sw.vorher)} € netto mit deutscher USt; Bestellung ${D.SCHWELLEN_BESTELLUNG.nr} am ${D.de(D.SCHWELLEN_BESTELLUNG.datum)} (${e(sw.bestellung)} € netto) überschreitet die Schwelle (${e(sw.mit)} €) → ab dieser Bestellung USt des Bestimmungslands, OSS-Erklärungen Q3/Q4 beim BZSt`],
    ["Bank", `${B.bank}, IBAN ${B.iban}, BIC ${B.bic}`], ["Kontakt", `${B.telefon}, ${B.email}, ${B.website}`],
    ["Beschäftigte", "Paula Krüger, Minijob seit 01.09.2025 (Packen und Versand), 40 Std./Monat × 14,50 € = 580 €, RV-pflichtig"],
    ["Steuerberatung", "Steuerbüro Ahrens (EÜR und Erklärungen), DATEV SKR03, Berater 52190 / Mandant 10744"],
  ]), "");

md.push("## Erzeugte Dateien", "", `Ordner: \`${OUT}\`. PNG-Ansichten jeder PDF-Seite (60 dpi) in \`png/\`. \`stand.json\` ist der komplette App-Stand am Ende.`, "");
md.push(tab(["Datei", "Seiten", "Inhalt / Eingaben"], dateien.map((x) => [`\`${x.rel}\``, seiten[x.rel] ?? "", x.inhalt])), "");
md.push("### Übersprungene Vorlagen", "", tab(["Vorlage", "Grund"], bau.uebersprungen.map((u) => [u.titel, u.grund])), "");

md.push("## Eingaben: Ausgangsrechnungen", "", "Beträge in €. Zeilen: Menge × Einzelpreis (netto), auf Cent gerundet; USt aus der Summe je Satz. „USt-Monat“ = Monat, in dem die Steuer nach Soll entsteht (unabhängig gerechnet).", "");
md.push(tab(["Nr.", "Datum", "Leistung", "Kunde", "Netto", "USt", "Brutto", "Bezahlt", "USt-Monat", "Was"], D.vorgaenge().map((x) => [x.nummer, D.de(x.datum), x.art === "storno" ? `Storno zu ${x.r.nummer}` : D.de(x.leistung), D.KUNDEN[x.kunde].name, e(x.vz * x.s.netto), e(x.vz * x.s.ust), e(x.vz * x.s.brutto), x.bezahlt ? D.de(x.bezahlt) : "–", x.ustMonat, x.art === "storno" ? x.r.storno.grund : x.r.worum])), "");
md.push("Positionen:", "");
for (const r of D.RECHNUNGEN) md.push(`- **${r.nummer}** an ${D.KUNDEN[r.kunde].name}${r.igl ? " (igL, 0 %)" : ""}, Ziel ${r.ziel === "sofort" ? "sofort" : `${r.ziel} Tage`}: ${r.pos.map((p) => `${String(p.menge).replace(".", ",")} ${p.einheit} „${p.bez}“ à ${e(p.preis)} €`).join("; ")}`);
md.push("");

md.push("## Eingaben: Onlineshop, Märkte, Minijob", "", "Shop-Umsatzberichte (brutto, inkl. Versandkosten). „EU vor Schwelle“ trägt deutsche USt; „EU nach Schwelle“ je Land mit der Steuer des Bestimmungslands (AT 20 %, NL 21 %, FR 20 %, BE 21 %). Die App kennt keine dieser Zahlen – sie wurden in Voranmeldungen und EÜR von Hand ergänzt (August ohne Bestellung #2391, die als Rechnung 2026-011 in der App steht).", "");
md.push(tab(["Monat", "Inland", "Erstattungen", "EU vor Schwelle", "AT", "NL", "FR", "BE", "Markt (bar)", "netto 19 % (Shop) / Markt"], D.SHOP.map((x) => {
  const sm = D.shopMonat(x.monat);
  return [x.monat, e(x.de), e(x.erstattung), e(x.euDe), e(x.eu.AT ?? 0), e(x.eu.NL ?? 0), e(x.eu.FR ?? 0), e(x.eu.BE ?? 0), e(D.MARKT[x.monat] ?? 0), `${e(sm.netto19)} / ${e(sm.marktNetto)}`];
})), "");
md.push(`- Minijob: ${e(D.MINIJOB.brutto)} € im Monat; Pauschalabgaben (Annahme 2026) KV 13 %, RV 15 %, Pauschsteuer 2 %, U1 0,8 %, U2 0,22 %, InsG 0,15 % = ${e(D.minijobAg)} €; RV-Anteil Arbeitnehmerin 3,6 % = ${e(D.MINIJOB.an_rv)} €; Personalkosten ${e(D.minijobMonat)} €/Monat.`,
  `- USt-Vorauszahlung Dezember 2025: ${e(D.UST_DEZ_2025.betrag)} €, Lastschrift am ${D.de(D.UST_DEZ_2025.gezahlt)} (außerhalb der 10-Tage-Frist, Ausgabe 2026). Voranmeldungen 2026: Lastschrift bzw. Erstattung am Fälligkeitstag. OSS Q3: Zahlung ${D.de(D.OSS_ZAHLUNG["2026-Q3"])}; Q4 erst 2027.`,
  `- AfA: Wachsschmelzgerät ${e(D.belegSumme(D.BELEGE.find((b) => b.id === "b29")).netto)} € / ${D.AFA.jahre} Jahre × ${D.AFA.monate}/12 = ${e(eu.afaNeu)} €; Altbestand ${e(D.AFA.altbestand)} € (Annahme).`, "");

md.push("## Eingaben: Belege", "", "„Vorsteuer“ = ausgewiesene Steuer. § 13b-Belege (Irland) und PayPal (Luxemburg) haben keine USt; in der App mit 0 % und ohne Vorsteuer erfasst.", "");
md.push(tab(["ID", "Datum", "Lieferant / Nr.", "Kategorie", "je Satz: netto + USt", "Brutto", "Vorsteuer", "§ 13b", "Zahlung", "Was"], D.BELEGE.map((b) => {
  const sm = D.belegSumme(b);
  return [b.id, D.de(b.datum), `${b.lieferant}${b.nummer ? ` / ${b.nummer}` : ""}`, b.kategorie, sm.jeSatz.map((x) => `${x.satz} %: ${e(x.netto)} + ${e(x.ust)}`).join("<br>"), e(sm.brutto), b.vorsteuer ? e(sm.vorsteuer) : "nein", b.p13b ? "ja" : b.frei ? "frei (Annahme)" : "", `${b.zahlung}${b.bezahlt ? `, bezahlt ${D.de(b.bezahlt)}` : ""}`, b.worum];
})), "");

md.push("## Erwartete Kennzahlen (unabhängig gerechnet)", "", "### Umsatzsteuer-Voranmeldungen 2026 (Soll)", "", "Kz 81 = Rechnungen 19 % (Leistungsmonat; 2026-015 wegen Vorauszahlung im Oktober; Stornos im Storno-Monat) + Shop Inland/EU vor Schwelle + Marktkasse (netto). Kz 41 = igL. Kz 46/47/67 = § 13b (Belegdatum). „Zahllast ELSTER“ rechnet Kz 81/46 in vollen Euro.", "");
md.push(tab(["Monat", "Rechnungen", "Re. 19 %", "Shop 19 %", "Markt 19 %", "Kz 81", "Kz 41", "Kz 46", "Kz 47 = Kz 67", "Kz 66", "Zahllast exakt", "Zahllast ELSTER"], [
  ...mo.map((x) => [x.m, x.nummern.join(", ") || "–", e(x.r19), e(x.shop19), e(x.markt19), e(x.kz81), e(x.kz41), e(x.kz46), e(x.kz47), e(x.kz66), e(x.zahllast), e(x.elsterZahllast)]),
  ["Jahr", "", e(j.r19), e(j.shop19), e(j.markt19), e(j.kz81), e(j.kz41), e(j.kz46), e(j.kz47), e(j.kz66), e(j.zahllast), e(j.elsterZahllast)],
]), "");
md.push("### OSS-Erklärungen (BZSt, nicht in der Voranmeldung)", "", tab(["Quartal", "Land", "Brutto", "Netto", "Steuer", "Zahlung"], oss.flatMap((q) => [...q.laender.map((z) => [q.quartal, `${z.land} (${D.LAENDER[z.land].satz} %)`, e(z.brutto), e(z.netto), e(z.steuer), ""]), [q.quartal, "**Summe**", e(q.brutto), e(q.netto), `**${e(q.steuer)}**`, q.zahlung ? D.de(q.zahlung) : "–"]])), "");
md.push("### Zusammenfassende Meldungen (§ 18a UStG)", "", `- Q1: Wohnkultur Steiner GmbH, ATU68215437, ${e(mo.filter((x) => x.m <= "2026-03").reduce((a, x) => a + x.kz41, 0))} € (Abgabe bis 27.04.2026).`, `- Q3: dieselbe Kundin, ${e(mo.filter((x) => x.m >= "2026-07" && x.m <= "2026-09").reduce((a, x) => a + x.kz41, 0))} € (Abgabe bis 26.10.2026).`, "");
md.push("### EÜR 2026 (Zufluss/Abfluss)", "", tab(["Posten", "Betrag €"], [
  ["Rechnungen: steuerpflichtig netto", e(eu.reNettoPflichtig)], ["Rechnungen: igL (steuerfrei)", e(eu.reFrei)], ["Rechnungen: vereinnahmte USt", e(eu.reUst)],
  ["Shop Inland/EU vor Schwelle netto (ohne #2391)", e(eu.shopNetto19)], ["darauf USt 19 %", e(eu.shopUst19)], ["OSS-Fernverkäufe netto (nicht steuerbar)", e(eu.ossNetto)], ["darauf ausländische USt", e(eu.ossUst)],
  ["Marktkasse netto", e(eu.marktNetto)], ["darauf USt", e(eu.marktUst)], ["USt-Erstattungen", e(eu.vaErstattet)], ["**Summe Einnahmen**", `**${e(eu.einnahmen)}**`],
  ...Object.entries(eu.nachKategorie).map(([k, x]) => [`Belege ${k} (${x.anzahl})`, e(x.betrag)]), ["Gezahlte Vorsteuer", e(eu.vorsteuer)], ["USt-Vorauszahlungen an das Finanzamt", e(eu.vaGezahlt)], ["OSS-Zahlung an das BZSt", e(eu.ossGezahlt)],
  ["**Summe Ausgaben (ohne AfA)**", `**${e(eu.ausgaben)}**`], ["AfA", e(eu.afa)], ["**Gewinn**", `**${e(eu.gewinn)}**`],
]), "", `Offene Forderung am 31.12.: ${e(eu.offen)} € (2026-019, Einnahme 2027). Beleg b17 (Lastschrift 08.01.2027) ist Ausgabe 2027, seine Vorsteuer zählt in der Voranmeldung Dezember 2026.`, "");
md.push("### Steuerberater-Pakete", "", `- November 2026: ${pMonat.buchungen} Buchungen, ${pMonat.anzahl} Dateien, ${pMonat.fragen} Punkte in Fragen_2026-11.txt.`, `- Jahr 2026: alle ${D.vorgaenge().length} Rechnungen inkl. 2 Stornos, alle ${D.BELEGE.length} Belege; ${pJahr.buchungen} Buchungen, ${pJahr.anzahl} Dateien, ${pJahr.fragen} Punkte in Fragen_2026.txt.`, "");

md.push("## Vergleich App ↔ unabhängige Rechnung", "", `${vergleiche.filter((v) => v.ok).length} von ${vergleiche.length} Prüfungen stimmen. Abweichungen (✗) stehen zusätzlich unter „Auffälligkeiten“.`, "");
md.push(tab(["", "Bereich", "Prüfung", "App", "erwartet"], vergleiche.map((v) => [v.ok ? "✓" : "✗", v.bereich, v.was, v.app, v.erwartet])), "");
md.push("Übernahme „Aus Rechnungen“ (Soll) je Monat – Rohwerte der App vor dem Ergänzen von Shop und Markt:", "", tab(["Monat", "Rechnungen", "umsatz_19", "umsatz_frei", "vorsteuer", "fertige VA: 19 % / Vorsteuer", "Ergebnis"], bau.ust.map((u) => [u.m, u.appAnzahl, u.app.umsatz_19, u.app.umsatz_frei, u.app.vorsteuer, `${u.final.umsatz_19} / ${u.final.vorsteuer}`, u.zahllast])), "");
md.push("EÜR-Übernahme der App (vor den Ergänzungen von Hand):", "", tab(["Liste", "Bezeichnung", "Zeile Anlage EÜR", "Betrag"], [...bau.euer.uebernahme.einnahmen.map((x) => ["Einnahme", x.text, x.kategorie, x.betrag]), ...bau.euer.uebernahme.ausgaben.map((x) => ["Ausgabe", x.text, x.kategorie, x.betrag])]), "", `Hinweis der Übernahme: „${bau.euer.uebernahme.hinweis}“`, "");
md.push("### Varianten (eigener Stand, ändern die Zahlen oben nicht)", "", ...bau.varianten.map((x) => `- **${x.titel}:** ${x.ergebnis}`), "");

md.push(`## Pflichten-Check der App (Stichtag ${D.de(bau.pflichten.stichtag)})`, "", "Profil: Onlinehandel + Beauty/Kosmetik, Einzelunternehmen, Gewerbe, Hamburg, 1 Beschäftigte (Minijob), keine elektronische Kasse, Website, Regelbesteuerung, Steuerberatung, Gründung 01.04.2023, Kunden B2C/B2B in Deutschland und EU, Vertrieb „Eigener Onlineshop“, Produkte Waren + Verpackung + Kosmetik, Gefahrstoffe, elektrische Geräte, Kunden-/Beschäftigtendaten, Newsletter, Tracking, Dienstleister.", "");
md.push("### Gilt", "", tab(["Pflicht", "Rechtsgrundlage laut App", "nächster Termin", "Termine 12 Mon.", "Vorlagen laut App", "erzeugt", "Grund laut App"], bau.pflichten.gilt.map((p) => [`${p.titel} (\`${p.id}\`)`, p.rechtsgrundlage, p.termin ? D.de(p.termin) : "–", p.termine, p.vorlagen.join(", ") || "–", p.vorlagen.length ? (p.erzeugt ? "ja" : "**nein**") : "", p.grund])), "");
if (bau.pflichten.gruendung.length) md.push("### Gründungsschritte (App stellt sie zurück)", "", tab(["Pflicht", "Vorlage"], bau.pflichten.gruendung.map((p) => [`${p.titel} (\`${p.id}\`)`, p.vorlagen.join(", ") || "–"])), "");
if (bau.pflichten.unbekannt.length) md.push("### Noch offen (App braucht weitere Antworten)", "", ...bau.pflichten.unbekannt.map((p) => `- ${p.titel} (\`${p.id}\`)${p.fragen.length ? ` – Fragen: ${p.fragen.join(", ")}` : ""}`), "");

md.push("## Auffälligkeiten beim Erzeugen", "", "### Automatisch erkannt (Abweichungen gegen die unabhängige Rechnung bzw. Plausibilitätsprüfungen)", "");
md.push(...(auffaellig.length ? auffaellig.map((a) => `- ${a}`) : ["- keine"]), "");
md.push("### Fachlich festgestellt (nicht automatisch prüfbar), mit Fundstelle und Vorschlag", "", ...(BEOBACHTUNGEN.length ? BEOBACHTUNGEN.map((b) => `- ${b}`) : ["- (noch nicht gepflegt)"]), "");
md.push("## Durchsicht jeder PDF-Seite (PNG 60 dpi, von Hand)", "", ...(DURCHSICHT.length ? DURCHSICHT.map((b) => `- ${b}`) : ["- (noch nicht gepflegt)"]), "");
md.push("## Hinweise der App und weitere Informationen", "", ...bau.infos.map((i) => `- ${i}`), "");
fs.writeFileSync(path.join(OUT, "SZENARIO.md"), md.join("\n"));

console.log(`${bau.docs.length} Unterlagen, ${bau.xmls.length} XRechnungen, ${bau.belegDateien.length} Belegdateien, ${pdfs.length} PDFs → ${OUT}`);
console.log(`Vergleiche: ${vergleiche.filter((v) => v.ok).length}/${vergleiche.length} ok; Auffälligkeiten: ${auffaellig.length}`);
for (const a of auffaellig) console.log(`  - ${a}`);
