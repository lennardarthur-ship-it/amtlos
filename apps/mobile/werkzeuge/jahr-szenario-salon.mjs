/**
 * Jahres-Szenario „Salon Sonne GmbH“ 2026 (GmbH, Hamburg, Ist-Versteuerung, monatliche Voranmeldung, 4 Beschäftigte
 * inkl. jugendlichem Auszubildenden, Friseurhandwerk mit Gefahrstoffen, Kasse mit TSE, Website mit Online-Terminbuchung):
 * erzeugt mit den echten Funktionen der App alle Unterlagen eines Jahres – Rechnungen (PDF + XRechnung) inkl. Storno mit
 * und ohne Erstattung, Belege (inkl. empfangener E-Rechnung), Register- und Gründungsunterlagen, Website- und
 * Datenschutzunterlagen, Beauty- und Personalvorlagen, zwölf USt-Voranmeldungen (Übernahme nach Zahlungseingang),
 * Bilanz/GuV, Steuerberater-Pakete Juni und Jahr (entpackt) – und schreibt SZENARIO.md mit allen Eingaben, den
 * unabhängig gerechneten Erwartungswerten (werkzeuge/jahr-szenario-salon-daten.ts) und jeder Abweichung.
 *
 *   cd apps/mobile && node werkzeuge/jahr-szenario-salon.mjs [ausgabe]     # Standard: /tmp/claude-0/salon
 *   KOSIT=<ordner>    optional: KoSIT-Validator (<ordner>/v/validator-*.jar, <ordner>/cfg/scenarios.xml)
 *   CHROMIUM_PFAD=…   anderer Chromium (Standard /opt/pw-browsers/chromium)
 *
 * Voraussetzungen wie jahr-szenario.mjs: pnpm install, gebaute Pakete (@amtlos/fachlogik dist), Chromium, poppler.
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
 * Fachliche Beobachtungen beim Erzeugen (Oktober 2026), die sich nicht als Zahlvergleich automatisieren lassen – mit
 * Fundstelle und Vorschlag. Bei jedem Lauf erneut prüfen und hier pflegen.
 */
const BEOBACHTUNGEN = [
  "**[schwer] § 2a SchwarzArbG: App widerspricht sich beim Friseurhandwerk.** Die Vorlagen sagen, Friseur- und Kosmetikbetriebe gehörten zu den Branchen nach § 2a SchwarzArbG (Arbeitszeitnachweis, `packages/fachlogik/src/dokumente/lohn.ts:101`; Nachweis der Arbeitsbedingungen, `packages/fachlogik/src/dokumente/personal.ts:54`). Der Pflichten-Check bietet bei „Gehört dein Betrieb zu einer dieser Branchen?“ aber keine Option dafür (`packages/i18n/src/fragen.ts:396–404`), und die Auslöser von `personal.sofortmeldung` und `personal.arbeitszeit_milog` im Katalog kennen sie nicht. Folge für den Salon: Sofortmeldung, Aufzeichnung nach § 17 MiLoG und die Unterschriftspflicht beim NachwG fehlen im Check, obwohl die Vorlagen sie für Friseure ansprechen. Vorschlag: rechtlich klären; je nach Ergebnis Option „Friseur- und Kosmetikgewerbe“ in fragen.ts und Katalog ergänzen (oder sie aus Beauty-Branche ableiten) – oder die beiden Vorlagentexte korrigieren.",
  "**[schwer → behoben] EÜR wird der GmbH ohne Warnung angeboten.** StB-Prüfung Steuerberatungskanzlei (E-4): `euerUebernahme` liefert für bilanzierende Betriebe (GmbH, UG, GmbH & Co. KG, e. K., Buchführungspflicht laut Finanzamt) nichts mehr und sagt „Bilanz statt EÜR“ (`apps/mobile/src/unterlagen/steuerpaket.ts`, `EUER_GESPERRT`); die Seite der Vorlage zeigt statt der Übernahme diesen Hinweis. Offen bleibt eine Übernahme für die GuV.",
  "**[mittel] Steuerberater-Paket bei Ist-Versteuerung falsch erklärt.** LIESMICH.txt sagt fest „Die Umsatzsteuer-Voranmeldung ordnet Rechnungen dagegen nach dem Leistungsdatum zu (Soll-Versteuerung)“ (`apps/mobile/src/unterlagen/steuerpaket.ts`, behoben: Text nach Soll/Ist) – für diesen Betrieb (Ist) gilt der Zahlungseingang. Vorschlag: Text nach `s.betrieb.versteuerung` wählen („… nach dem Zahlungseingang (Ist-Versteuerung, § 20 UStG); eine Stornorechnung zählt mit der vermerkten Erstattung“).",
  "**[mittel → behoben] DATEV: privat bezahlter Beleg einer GmbH.** StB-Prüfung (B-6): privat ausgelegte Belege und Barbelege vor dem ersten Kassenabschluss einer Kapitalgesellschaft stehen auf dem Verrechnungskonto Gesellschafter (Standard SKR03 0731 laut korrigiertem Bericht vom 22.10.2026, SKR04 vorläufig 3560; über die Kontenvorgaben der Kanzlei änderbar). Außerdem Soll-Stapel (A-4): Zahlungseingänge bucht die App seit dem Nachtrag vom 22.10.2026 nur mit der Kontenvorgabe „Zahlungseingänge buchen“ (Standard aus) – im Jahrespaket steht deshalb auf 1410 die Summe aller Rechnungen 2026, die LIESMICH erklärt das und nennt die offenen Forderungen 2026-017/-018 laut Rechnungsliste; mit der Vorgabe ist der Saldo 1410 = offene Forderungen (Gegenprobe).",
  "**[mittel] Unterweisung des jugendlichen Azubis: Frist ein Jahr statt halbjährlich.** Der Unterweisungsnachweis setzt immer „mindestens einmal jährlich … nächster Termin 10.08.2027“ (`packages/fachlogik/src/dokumente/arbeitsschutz.ts:200`), der Pflichten-Check (`arbeitsschutz.unterweisung_wiederholen`, P1Y) ebenso; `personal.jugendarbeitsschutz` ist im Katalog „dauerhaft/einmalig“ ohne Termine (halbjährliche Unterweisung § 29 Abs. 2 JArbSchG, Nachuntersuchung § 33 JArbSchG). Vorschlag: bei `beschaeftigte.jugendlich ≥ 1` eigene wiederkehrende Pflicht (6 Monate) bzw. in der Vorlage einen Schalter „Teilnehmende unter 18“ mit 6-Monats-Termin.",
  "**[mittel] Widersprüchliche Speicherdauer der Server-Logfiles.** Datenschutzerklärung: 7 Tage (Eingabe), Verzeichnis der Verarbeitungstätigkeiten aus dem Vorschlag „Betrieb der Website“: „IP-Adressen in Logfiles nach 30 Tagen“ (`packages/fachlogik/src/dokumente/bausteine.ts:1291`). Vorschlag: Löschfrist im Vorschlag aus `logfile_tage` der Datenschutzerklärung übernehmen oder neutral formulieren („laut Datenschutzerklärung“).",
  "**[mittel] Gewerbeanmeldung einer GmbH nur mit einer Person.** Die Vorlage hat einen einzigen Personenblock (`packages/fachlogik/src/dokumente/betrieb.ts:66–85`); bei einer GmbH mit zwei Geschäftsführern fehlen die Angaben zur zweiten vertretungsberechtigten Person, und nichts sagt, dass der Block die gesetzlichen Vertreter meint. Vorschlag: bei Rechtsform GmbH/UG Liste „Gesetzliche Vertreter“ wie in der Handelsregister-Vorlage.",
  "**[mittel] Jahresabschluss: Pflicht ohne Vorlage und ohne Termin.** `gesellschaft.jahresabschluss` zeigt keine Vorlage, weil `bilanz_guv` nur `steuern.buchfuehrungspflicht` und `steuern.e_bilanz` belegt (`packages/fachlogik/src/dokumente/buchhaltung.ts:490`); die Pflicht ist im Katalog „dauerhaft“ ohne Aufstellungs-/Feststellungsfrist. Außerdem hat das PDF nur eine Unterschriftslinie (bei zwei Geschäftsführern unterschreiben alle, § 245 HGB). Vorschlag: Pflicht-ID ergänzen, Fristen im Katalog fachlich prüfen lassen, Unterschriftsfelder je Geschäftsführer aus `betrieb.vertretung`.",
  "**[mittel] Kassenumsätze fehlen wie beim Café.** Ein Salon macht hier ca. 290.000 € netto über die Kasse gegenüber ca. 12.000 € aus Rechnungen; Voranmeldungen (Ist-Übernahme) und Paket kennen nur Rechnungen und Belege, die Kasse wurde zwölfmal von Hand addiert.",
  "**[gering] Beauty-Vorschläge nicht auf Bundesland/Gewerk zugeschnitten.** Hygieneplan-Vorschlag „Instrumente mit Verletzungsrisiko“ nennt „(Bayern: mind. begrenzt viruzid)“ (`packages/fachlogik/src/dokumente/bausteine.ts:2864`) – im Hamburger Salon unpassend; Rechtsgrundlage nur „Hygieneverordnung des Landes“ (`packages/fachlogik/src/dokumente/branchen.ts:360`); „Wer: Inhaber/in“ bei einer GmbH (`bausteine.ts:3010`). Vorschlag: Bundesland aus „Mein Betrieb“ einsetzen, „Inhaber/in bzw. Geschäftsführung“ aus der Rechtsform.",
  "**[gering] Pflichten-Check: Vorlagenzuordnung nur einfach.** `VORLAGE_JE_PFLICHT` nimmt je Pflicht nur die erste Vorlage (`apps/mobile/src/pflichten/check.ts:88`): bei „Gefahrstoffverzeichnis und Betriebsanweisungen“ erscheint die Betriebsanweisung nie. Vorschlag: Liste von Vorlagen je Pflicht.",
  "**[gering] Pflichten-Check: Kosmetikverordnung bei reinem Weiterverkauf.** `branche.beauty_kosmetikverordnung` gilt schon mit „Du verkaufst Kosmetik“, der Text spricht aber von eigenen Produkten. Vorschlag: Frage „eigene Produkte/unter eigenem Namen“ ergänzen.",
  "**[gering] Pflichten-Check: Ausbildungsbetrieb fehlt im Katalog.** Für den Azubi gibt es keine Pflicht zu Ausbildungsvertrag (§ 11 BBiG) bzw. Eintragung bei der Kammer, und keine Vorlage; der „Nachweis der Arbeitsbedingungen“ wäre falsch. Vorschlag: fachlich prüfen und ggf. Pflicht + Vorlage ergänzen.",
  "**[gering] Steuererklärung (KSt/GewSt/USt) nennt § 25 EStG als Rechtsgrundlage** (`packages/fachlogik/src/dokumente/buchhaltung.ts:656`), obwohl die Einkommensteuer nicht ausgewählt ist. Vorschlag: Grundlage aus den gewählten `arten` zusammensetzen.",
  "**[gering] Vorschlagstexte mit Minijobbern** („Beschäftigte, Auszubildende, Minijobber“, `bausteine.ts:1246`), obwohl das Profil keine Minijobber hat.",
  "**[gering] Belegkategorien sind EÜR-zentriert.** Die Belegliste im Paket hat die Spalte „Zeile Anlage EÜR“ auch für die GmbH (`packages/fachlogik/src/belege.ts:60–76`). Vorschlag: bei Kapitalgesellschaften ausblenden oder GuV-Posten zeigen.",
  "**[gering] Stornorechnungen heißen im Dateinamen „Rechnung-2026-008“** statt „Stornorechnung-…“ (pdfDateiname). Die Ersatzrechnung 2026-009 fordert erneut zur Zahlung auf, obwohl das Guthaben verrechnet wurde – das muss man im Hinweis selbst schreiben.",
  "**Geprüft und unauffällig:** alle 18 Rechnungsbeträge (Mengen 1,5 / 1,75 / 2,25 / 2,5 / 3,5 / 6,25 / 6,5 / 9,5 / 10,5 / 16,5 Std., zwei Rabattzeilen, zwei Stornos), fortlaufende Nummern, Festschreibung; § 35a-GmbHG-Angaben in der Fußzeile (Sitz, Registergericht, HRB, Geschäftsführung) und kein „Inhaber/in“; Ist-Übernahme in allen 12 Monaten (auch Storno mit Erstattung im Juni, Storno ohne Erstattung zählt nie, 2026-017 erst im Januar 2027); Vorsteuer nach Belegdatum (auch bei Zahlung 2027); Voranmeldungen übernehmen „Ist“ aus „Mein Betrieb“; Pflichten-Check: Jahresabschluss, Offenlegung, KSt, E-Bilanz, Buchführungspflicht, Lohnsteuer monatlich, Transparenzregister (Gründung), keine EÜR, keine ESt; DATEV-Spalten und Erlöskonto; E-Rechnung eingelesen.",
];

/** Ergebnis der Durchsicht jeder PDF-Seite (PNG, 60 dpi) – von Hand gepflegt (134 Seiten, Oktober 2026). */
const DURCHSICHT = [
  "**Rechnungen 01–18 (18 Seiten):** Layout einheitlich, alles auf einer Seite, Beträge stimmen, Fußzeile mit Sitz/Registergericht/HRB/Geschäftsführung. Mengeneinheit wird nicht gebeugt („9 Stunde“, „16,5 Stunde“, „2 Pauschale“) [gering, Eingabe „Stunde“ – Vorschlag: Einheiten-Vorschläge „Std.“/„Stunden“ oder Plural bei Menge ≠ 1]. Privatkunden 2026-003/-014 mit „Sehr geehrte Damen und Herren“ (`buchhaltung.ts:327`) [gering]. Storno 2026-008/-011 korrekt ohne Zahlungsblock mit Verweis auf das Original.",
  "**Handelsregister, Transparenzregister, Gewerbeanmeldung, Kassenmeldung:** inhaltlich richtig befüllt. Gewerbeanmeldung nur ein Geschäftsführer (siehe oben). Kassenmeldung „Hersteller / Modell“ ohne Trenner: „SalonKasse Systems GmbH SalonKasse Pro …“ [gering].",
  "**Impressum (2 Seiten):** GmbH, beide Geschäftsführer, Stammkapital, HRB, USt-IdNr., Kammer, Berufsbezeichnung – vollständig. Seite 1 endet nach Abschnitt 7 mit einer halben Seite Leerraum, Abschnitte 8–10 stehen allein auf Seite 2 [gering, Umbruch].",
  "**Datenschutzerklärung (4 Seiten):** Terminbuchung (TerminFix), Sitzungs-Cookie, Instagram-Link, Hamburger Aufsichtsbehörde korrekt. Abschnitt „Kontakt“ spricht fest von einem Kontaktformular, das es hier nicht gibt [gering]. Seite 4 nur mit dem Ende von Abschnitt 13.",
  "**AVV (3 Seiten):** verschachtelte Anführungszeichen „Nutzungsvertrag „Salon M“ vom …“ (Vorlage setzt den Hauptvertrag selbst in Anführungszeichen) [gering]. Seite 3: Überschrift „Anlage: Technische und organisatorische Maßnahmen“ steht über den Unterschriften, die Anlage selbst folgt nicht [gering]. Für die GmbH kein „vertreten durch“ bei den Vertragsparteien bzw. Unterschriften [gering].",
  "**Datenschutzinformation (5 Seiten), VVT (8 Seiten):** vollständig; Gesundheitsdaten-Einwilligung erscheint. VVT-Kopfkasten „Ansprechperson: Salon Sonne GmbH, vertreten durch …“ läuft in der schmalen Spalte über 5 Zeilen [gering]. Logfile-Widerspruch 30 ↔ 7 Tage (siehe oben).",
  "**Verfahrensdokumentation (3 S.), Aufbewahrungsplan (1 S.):** in Ordnung. Unterschrift ohne Namen/Funktion der Geschäftsführung [gering].",
  "**Nachweise Arbeitsbedingungen (3 × 2 S.), Personalfragebogen (2 × 2 S.), Lohnkonten (2 × 2 S.), Arbeitszeitnachweis, KI-Schulung:** Inhalte korrekt. Personalfragebogen: Seite 2 enthält nur drei Zeilen und die Unterschrift, Seite 1 hat unten Platz [gering, Umbruch]; beim 16-jährigen Azubi keine Unterschrift der gesetzlichen Vertretung und „Monatliches Entgelt“ statt Ausbildungsvergütung [gering]. Lohnkonto: Seite 1 zeigt nur Januar–April [gering]. Unterschriftslinie „Arbeitgeber/in“ ohne „vertreten durch“ [gering].",
  "**Gefährdungsbeurteilung Salon (5 S.):** 15 Friseur-Vorschläge + 2 eigene Zeilen sauber nach Faktoren gegliedert, Mutterschutz richtig. Keine Mängel.",
  "**Unterweisungen (2 × 2 S.):** Teilnehmerliste beginnt auf Seite 1 mit der Überschrift, die Namen stehen auf Seite 2 [gering]. Halbjährliche Unterweisung des Jugendlichen nennt „nächster Termin spätestens 10.08.2027“ (siehe oben).",
  "**Gefahrstoffverzeichnis (2 S.), Betriebsanweisungen BA-01/BA-02, Prüfprotokoll DGUV V3 (2 S.):** korrekt; fehlendes SDB rot markiert. Prüfprotokoll nennt als Richtwert für ortsveränderliche Geräte 6 Monate, die eingetragenen nächsten Prüfungen liegen 12 Monate später, ohne Hinweis der App; der ausgesonderte Föhn behält ein „nächste Prüfung“-Datum (Eingabe) [gering – Vorschlag: Hinweis, wenn „nächste“ über dem Richtwert liegt; bei „Mängel/ausgesondert“ Datum ausblenden].",
  "**Hautschutzplan (2 S.), Hygieneplan (3 S.):** Beauty-Kopf passt hier. Hygieneplan enthält bei Übernahme aller 18 Vorschläge auch invasive Kosmetik (Lanzetten, Sterilisation 121/134 °C) und „Bayern“ [gering, siehe oben].",
  "**USt-Voranmeldungen Januar–Dezember (12 S.):** je eine Seite, „Besteuerung nach vereinnahmten Entgelten (§ 20 UStG)“ korrekt, Zahllasten stimmen. Kz 81 mit Cent, obwohl daneben „im Vordruck in vollen Euro“ steht (`buchhaltung.ts:610`) [gering].",
  "**Jahresabschluss (2 S.), Steuererklärung (2 S.):** Beträge stimmen, Bilanz geht auf. Nur eine Unterschriftslinie; GuV ohne HGB-Gliederung und ohne Ertragsteuer-Zeile (Vorlage frei) [gering]. Steuererklärung: § 25 EStG in der Rechtsgrundlage; „Umsätze im Jahr“ (Ist, 300.376,92 €) weicht erwartungsgemäß von den GuV-Umsatzerlösen (301.876,92 €) ab – ein Hinweis wäre hilfreich [gering].",
  "**Belegdateien (Eingaben des Werkzeugs, 34 S.):** lesbar, je eine Seite.",
];

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? "/tmp/claude-0/salon");
for (const d of ["pdf", "rechnungen", "png", "belege", "steuerpaket-2026-06", "steuerpaket-jahr"]) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

// ---------------------------------------------------------------- bündeln
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const gebaut = path.join(OUT, ".jahr-szenario-salon.mjs");
execFileSync(path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild"), [path.join(HIER, "jahr-szenario-salon.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
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
  const bytes = b.xml ? new TextEncoder().encode(b.xml) : await einfachPdf(b.html);
  belegBytes[b.datei] = bytes;
  fs.writeFileSync(path.join(OUT, "belege", b.datei), bytes);
  const roh = D.BELEGE.find((x) => b.datei.startsWith(x.id + "."));
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
  vergleich(bereich, "LIESMICH: Mandant-Block und „Nicht enthalten – bitte zusätzlich liefern“", /Mandant \(Angaben aus der App\)/.test(liesmich) && /Nicht enthalten – bitte zusätzlich liefern/.test(liesmich) && /Kassenumsätze/.test(liesmich) && /Lohnjournal/.test(liesmich) ? "ja" : "nein", "ja");
  // Kasse laut Pflichten-Check (ja): Hinweis auf fehlende Kassenumsätze ganz oben im LIESMICH und in den Fragen
  // R10: der Kassenhinweis steht einmal an fester Stelle (LIESMICH, Abschnitt „Wichtig“), nicht mehr vor dem Kopf und in den Fragen
  vergleich(bereich, "LIESMICH: „Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket.“ einmal unter „Wichtig“", /\r\nWichtig\r\n- Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket\./.test(liesmich) && liesmich.split("Kassenumsätze").length === 2 ? "ja" : "nein", "ja");
  vergleich(bereich, "Fragen: Kassenhinweis nicht doppelt", /Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket\./.test(fragen) ? "ja" : "nein", "nein");
  vergleich(bereich, "LIESMICH: Kleinunternehmer ja/nein", (/Kleinunternehmer \(§ 19 UStG\): (ja|nein)/.exec(liesmich) ?? [])[1] ?? "fehlt", kleinunternehmer ? "ja" : "nein");
  const jahr = /^\d{4}$/.test(zr.name);
  vergleich(bereich, "LIESMICH: Satz „Nicht zusätzlich zu den Monats-/Quartalsstapeln importieren“ genau im Jahrespaket", /Nicht zusätzlich zu den Monats-\/Quartalsstapeln importieren/.test(liesmich) ? "ja" : "nein", jahr ? "ja" : "nein");
  const ohneXmlZeilen = (liesmich.split("Rechnungen ohne E-Rechnung (XRechnung)")[1] ?? "").split(/\r\n\r\n/)[0].split("\r\n").filter((z) => z.startsWith("- "));
  vergleich(bereich, "LIESMICH: Rechnungen ohne E-Rechnung einzeln mit Grund", String(ohneXmlZeilen.length), String(erg.ohneXml));
  return { fragen, liesmich, rechnungen: re, belege: be };
}

function paketPruefen(name, zr, erg, ordner) {
  fs.writeFileSync(path.join(OUT, erg.dateiname), erg.zip);
  merke(erg.dateiname, `Steuerberater-Paket ${name} (steuerpaket(), ZIP wie in der App).`);
  const inhalt = S.unzipSync(erg.zip);
  for (const [p, bytes] of Object.entries(inhalt)) {
    fs.mkdirSync(path.dirname(path.join(OUT, ordner, p)), { recursive: true });
    fs.writeFileSync(path.join(OUT, ordner, p), bytes);
  }
  merke(`${ordner}/`, `entpacktes Paket ${name}: ${Object.keys(inhalt).length} Dateien (${Object.keys(inhalt).filter((p) => !p.includes("/")).join(", ")}, E-Rechnungen/, Belege/).`);
  const im = (iso) => iso >= zr.von && iso <= zr.bis;
  const vg = D.vorgaenge().filter((x) => im(x.datum));
  const bl = D.BELEGE.filter((b) => im(b.datum));
  // Spalten nach Namen, ohne die Summenzeilen am Ende
  const reL = liste(inhalt[`Rechnungen_${zr.name}.csv`]);
  const re = reL.zeilen;
  vergleich(`Paket ${name}`, "Anzahl Rechnungen (nach Rechnungsdatum)", re.length, vg.length);
  vergleich(`Paket ${name}`, "Rechnungsliste: Summe Netto", summe(re.map((z) => centAus(reL.w(z, "Netto")))), summe(vg.map((x) => x.vz * x.s.netto)));
  vergleich(`Paket ${name}`, "Rechnungsliste: Summe Brutto", summe(re.map((z) => centAus(reL.w(z, "Brutto")))), summe(vg.map((x) => x.vz * x.s.brutto)));
  // Ist-Versteuerung: die Steuerberatung braucht den Zahlungseingang – auch die Erstattung beim Storno
  const mitZahlung = re.filter((z) => reL.w(z, "Bezahlt am")).length;
  vergleich(`Paket ${name}`, "Rechnungsliste: Spalte „Bezahlt am“ gefüllt (inkl. Erstattung Storno)", mitZahlung, vg.filter((x) => x.bezahlt).length);
  const beL = liste(inhalt[`Belege_${zr.name}.csv`]);
  const be = beL.zeilen;
  vergleich(`Paket ${name}`, "Anzahl Belege (nach Belegdatum)", be.length, bl.length);
  vergleich(`Paket ${name}`, "Belegliste: Summe Brutto", summe(be.map((z) => centAus(beL.w(z, "Brutto")))), summe(bl.map((b) => D.belegSumme(b).brutto)));
  vergleich(`Paket ${name}`, "Belegliste: Summe Vorsteuer", summe(be.map((z) => centAus(beL.w(z, "Vorsteuer")))), summe(bl.map((b) => D.belegSumme(b).vorsteuer)));
  vergleich(`Paket ${name}`, "Belegdateien im Paket", Object.keys(inhalt).filter((p) => p.startsWith("Belege/")).length, bl.length);
  const ohneXml = vg.filter((x) => !("email" in D.KUNDEN[x.kunde])).length;
  vergleich(`Paket ${name}`, "E-Rechnungen im Paket", Object.keys(inhalt).filter((p) => p.startsWith("E-Rechnungen/")).length, vg.length - ohneXml);
  const extf = csvLesen(inhalt[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1");
  const zeilen = extf.slice(2);
  // R10: Personal nicht im Stapel. StB-Prüfung (B-6): privat ausgelegte Belege der GmbH jetzt im Stapel (Verrechnungskonto
  // Gesellschafter). A-4, Nachtrag 22.10.2026: Zahlungseingänge (Bank an Forderungen) nur mit der Kontenvorgabe
  // „Zahlungseingänge buchen“ – Standard aus, also keine Zahlungsbuchungen im Stapel
  const erwBuchungen = summe(vg.map((x) => Object.values(x.s.gruppen).filter((g) => g.netto + g.ust !== 0).length)) + summe(bl.filter((b) => b.kategorie !== "personal").map((b) => b.saetze.filter((x) => x.betrag).length));
  vergleich(`Paket ${name}`, "DATEV: keine Zahlungseingänge Bank 1200 im Stapel (Kontenvorgabe „Zahlungseingänge buchen“ Standard aus)", String(zeilen.filter((z) => z[6] === "1200" || z[7] === "1200").length), "0");
  vergleich(`Paket ${name}`, "DATEV: Anzahl Buchungen", zeilen.length, erwBuchungen);
  vergleich(`Paket ${name}`, "DATEV: Spalten je Zeile = Spalten im Kopf", zeilen.every((z) => z.length === extf[1].length) ? "ja" : "nein", "ja");
  const kontoSumme = (konto) => summe(zeilen.filter((z) => z[7] === konto).map((z) => (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
  vergleich(`Paket ${name}`, "DATEV: Brutto auf Erlöskonto 8400 (19 %)", kontoSumme("8400"), summe(vg.map((x) => x.vz * x.s.brutto)));
  vergleich(`Paket ${name}`, "DATEV: Kopf Beraternummer/Mandant", `${extf[0][10]}/${extf[0][11]}`, "31877/20514");
  // StB-Prüfung (A-4), Nachtrag 22.10.2026: ohne Zahlungseingänge steht auf 1410 die Summe aller Rechnungen des Jahres
  // (Stornos negativ, unabhängig aus den Rohdaten); die LIESMICH nennt Saldo und die offenen Forderungen zum 31.12.
  // (Rechnungen 2026 ohne Storno und ohne Zahlung bis 31.12., wie in der Bilanz)
  if (zr.name === "2026") {
    const saldo1410 = summe(zeilen.map((z) => (z[6] === "1410" ? 1 : z[7] === "1410" ? -1 : 0) * (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
    const alleRechnungen = summe(vg.map((x) => x.vz * x.s.brutto));
    const offen = summe(D.vorgaenge().filter((x) => x.art === "rechnung" && !x.r.storno && !(x.bezahlt && x.bezahlt <= zr.bis)).map((x) => x.s.brutto));
    vergleich(`Paket ${name}`, "DATEV: Saldo Forderungen 1410 zum 31.12. = alle Rechnungen 2026 (Soll-Stapel ohne Zahlungseingänge, A-4/Nachtrag)", saldo1410, alleRechnungen);
    const lm = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
    vergleich(`Paket ${name}`, "LIESMICH: erklärt „Zahlungseingänge nicht gebucht“, nennt Saldo 1410 und offene Forderungen laut Rechnungsliste", /Zahlungseingänge sind nicht gebucht/.test(lm) && lm.includes(`Saldo 1410 aus diesem Stapel zum 31.12.2026: ${D.eur(alleRechnungen)} €`) && lm.includes(`laut Rechnungsliste zum 31.12.2026: ${D.eur(offen)} €`) ? "ja" : "nein", "ja");
    vergleich(`Paket ${name}`, "LIESMICH: Hinweis auf die Kontenvorgabe „Zahlungseingänge buchen“", /„Zahlungseingänge buchen“ einschalten/.test(lm) ? "ja" : "nein", "ja");
    // Gegenprobe mit der Kontenvorgabe „Zahlungseingänge buchen“: je Zahlung bzw. Erstattung eine Buchung, Saldo 1410 = offen
    const mit = csvLesen(S.unzipSync(S.jahrMitZahlungen(s, belegBytes).zip)[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1").slice(2);
    const zahlungenImZeitraum = D.vorgaenge().filter((x) => x.bezahlt && im(x.bezahlt));
    vergleich(`Paket ${name} (Vorgabe „Zahlungseingänge buchen“)`, "DATEV: Anzahl Buchungen = ohne Vorgabe + je Zahlungseingang/Erstattung eine", String(mit.length), String(erwBuchungen + zahlungenImZeitraum.length));
    const saldoMit = summe(mit.map((z) => (z[6] === "1410" ? 1 : z[7] === "1410" ? -1 : 0) * (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
    vergleich(`Paket ${name} (Vorgabe „Zahlungseingänge buchen“)`, "DATEV: Saldo Forderungen 1410 zum 31.12. = offene Rechnungen (A-4)", saldoMit, offen);
    // E-165 (A-3): unabhängige Gegenprobe „mit Personenkonten“ – eigenes Paket, das Standardpaket bleibt wie oben
    const pkErg = S.jahrMitPersonenkonten(s, belegBytes);
    fs.writeFileSync(path.join(OUT, pkErg.dateiname.replace(/\.zip$/, "-mit-Personenkonten.zip")), pkErg.zip);
    const pkInhalt = S.unzipSync(pkErg.zip);
    for (const [p, bytes] of Object.entries(pkInhalt)) {
      fs.mkdirSync(path.dirname(path.join(OUT, "steuerpaket-jahr-personenkonten", p)), { recursive: true });
      fs.writeFileSync(path.join(OUT, "steuerpaket-jahr-personenkonten", p), bytes);
    }
    merke("steuerpaket-jahr-personenkonten/", "Gegenprobe Jahrespaket mit der Kontenvorgabe „Personenkonten für Kunden und Lieferanten (OPOS)“ (E-165).");
    const pz = csvLesen(pkInhalt[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1").slice(2);
    const bereichPk = `Paket ${name} (Vorgabe „Personenkonten“)`;
    vergleich(`Paket ${name}`, "Standardpaket ohne Stammdaten „Debitoren/Kreditoren“ (Vorgabe Standard aus)", Object.keys(inhalt).some((p) => p.startsWith("EXTF_Debitoren")) ? "ja" : "nein", "nein");
    // Erwartung aus den Rohdaten: Debitoren je Empfänger (Name wie auf der Rechnung – die falsch adressierte 2026-010
    // „Möwe Event GmbH“ und ihr Storno bekommen einen eigenen Debitor) nach der ersten Rechnung (Datum, Nummer) ab 10000, Kreditoren je
    // Lieferant (Name ohne Groß-/Kleinschreibung und Satzzeichen) von Belegen per Überweisung/Karte (ohne Personal) ab 70000
    const norm = (n) => n.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();
    const empfaenger = (x) => x.r.kundeAbweichend?.name ?? D.KUNDEN[x.kunde].name;
    const deb = new Map();
    for (const x of [...D.vorgaenge()].sort((a, b) => a.datum.localeCompare(b.datum) || a.nummer.localeCompare(b.nummer, "de", { numeric: true }))) if (!deb.has(norm(empfaenger(x)))) deb.set(norm(empfaenger(x)), { nr: String(10000 + deb.size), name: empfaenger(x) });
    const kredBelege = D.BELEGE.filter((b) => b.zahlung === "bank" && b.kategorie !== "personal");
    const kred = new Map();
    for (const b of [...kredBelege].sort((a, b) => a.datum.localeCompare(b.datum))) if (!kred.has(norm(b.lieferant))) kred.set(norm(b.lieferant), String(70000 + kred.size));
    vergleich(bereichPk, "DATEV: keine Buchung auf den Sammelkonten 1410/1610", String(pz.filter((z) => ["1410", "1610"].includes(z[6]) || ["1410", "1610"].includes(z[7])).length), "0");
    vergleich(bereichPk, "DATEV: Anzahl Buchungen wie ohne Personenkonten", pz.length, erwBuchungen);
    const rechnungsZeilen = vg.flatMap((x) => Object.values(x.s.gruppen).filter((g) => g.netto + g.ust !== 0).map(() => [x.nummer, deb.get(norm(empfaenger(x))).nr]));
    vergleich(bereichPk, "DATEV: jede Rechnungsbuchung auf dem Debitor ihres Kunden (Belegfeld 1 = Rechnungsnummer)", rechnungsZeilen.filter(([nr, k]) => !pz.some((z) => z[10] === nr && z[6] === k)).map(([nr]) => nr).join(", ") || "alle", "alle");
    const saldoDeb = summe(pz.map((z) => (/^[1-6]\d{4}$/.test(z[6]) ? 1 : /^[1-6]\d{4}$/.test(z[7]) ? -1 : 0) * (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
    vergleich(bereichPk, "DATEV: Saldo aller Debitoren zum 31.12. = alle Rechnungen 2026 (wie 1410 ohne Personenkonten)", saldoDeb, alleRechnungen);
    const falsch = deb.get(norm("Möwe Event GmbH")).nr;
    vergleich(bereichPk, `DATEV: falsch adressierte Rechnung 2026-010 und ihr Storno 2026-011 gleichen sich auf demselben Debitor ${falsch} aus (Saldo 0)`, summe(pz.map((z) => (z[6] === falsch ? 1 : z[7] === falsch ? -1 : 0) * (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0]))), 0);
    vergleich(bereichPk, "DATEV: Belege per Überweisung/Karte auf dem Kreditor ihres Lieferanten (Anzahl Buchungen)", pz.filter((z) => /^[7-9]\d{4}$/.test(z[6])).length, summe(kredBelege.map((b) => b.saetze.filter((x) => x.betrag).length)));
    vergleich(bereichPk, "DATEV: Kreditoren je Lieferant (Nummer → Anzahl verschiedener Lieferanten)", new Set(pz.filter((z) => /^[7-9]\d{4}$/.test(z[6])).map((z) => z[6])).size, kred.size);
    const stamm = csvLesen(pkInhalt[`EXTF_Debitoren_Kreditoren_${zr.name}.csv`], "latin1");
    vergleich(bereichPk, "Stammdaten: Kopf EXTF/700/Kategorie 16 „Debitoren/Kreditoren“/Formatversion 5", stamm[0].slice(0, 5).join("|"), "EXTF|700|16|Debitoren/Kreditoren|5");
    vergleich(bereichPk, "Stammdaten: Konten = Debitoren und Kreditoren (Nummer und Name)", stamm.slice(2).map((z) => `${z[0]} ${z[1] || z[5]}`).join("; "), [...[...deb.values()].map((d) => `${d.nr} ${d.name}`), ...[...kred].map(([n, nr]) => `${nr} ${kredBelege.find((b) => norm(b.lieferant) === n).lieferant}`)].sort().join("; "));
    const lmPk = Buffer.from(pkInhalt["LIESMICH.txt"]).toString("utf8");
    vergleich(bereichPk, "LIESMICH: Personenkonten erklärt, Stammdaten-Datei genannt, Ist + Bilanz: Personenkonten als empfohlene Einrichtung", /Personenkonten \(Kontenvorgabe\)/.test(lmPk) && lmPk.includes(`EXTF_Debitoren_Kreditoren_${zr.name}.csv`) && /die empfohlene Einrichtung für Ist-Versteuerung mit Bilanzierung/.test(lmPk) ? "ja" : "nein", "ja");
  }
  if (bl.some((b) => b.zahlung === "privat")) {
    const privat = zeilen.filter((z) => z[6] === "1890" || z[7] === "1890").length;
    // StB-Prüfung (B-6): auf dem Verrechnungskonto Gesellschafter (SKR03 0731 laut korrigiertem Bericht vom 22.10.2026,
    // nicht 0755) in Feld 7 – privat ausgelegte Belege und Barbelege (der Salon führt keine Kassenabschlüsse in der App,
    // also „vor dem ersten Abschluss“)
    const verrechnung = zeilen.filter((z) => z[6] === "0731").length;
    vergleich(`Paket ${name}`, "DATEV: privat bezahlte und Barbelege der GmbH auf dem Verrechnungskonto 0731, nicht auf 0755 oder „Privateinlagen“ 1890 (Buchungen 0731 / 0755 / 1890)", `${verrechnung} / ${zeilen.filter((z) => z[6] === "0755" || z[7] === "0755").length} / ${privat}`, `${summe(bl.filter((b) => b.zahlung === "privat" || b.zahlung === "bar").map((b) => b.saetze.filter((x) => x.betrag).length))} / 0 / 0`);
  }
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  vergleich(`Paket ${name}`, "LIESMICH: erklärt die Zuordnung bei Ist-Versteuerung (Zahlungseingang statt Leistungsdatum)", /Ist-Versteuerung|vereinnahmte|nach (dem )?Zahlungseingang/.test(liesmich) ? "ja" : "nein", "ja");
  const neu = paketNeuerungen(name, zr, inhalt, erg, false, bl);
  vergleich(`Paket ${name}`, "LIESMICH: Mandant mit Rechtsform GmbH und Versteuerung Ist", /- Rechtsform: GmbH\r\n/.test(liesmich) && /- Versteuerung: Ist /.test(liesmich) ? "ja" : "nein", "ja");
  if (bl.some((b) => b.zahlung === "privat")) vergleich(`Paket ${name}`, "Fragen: privat bezahlter Beleg der GmbH aufgeführt", /Privat (bezahlte|ausgelegte) Belege/.test(neu.fragen) ? "ja" : "nein", "ja");
  return { anzahl: Object.keys(inhalt).length, buchungen: zeilen.length, fragen: erg.fragen };
}
const pMonat = paketPruefen("Juni 2026", { von: "2026-06-01", bis: "2026-06-30", name: "2026-06" }, pk.monat, "steuerpaket-2026-06");
const pJahr = paketPruefen("Jahr 2026", { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, pk.jahr, "steuerpaket-jahr");

// ---------------------------------------------------------------- Dateinamen und Texte in den PDFs
{
  const nichtAscii = bau.docs.filter((d) => /[^A-Za-z0-9._-]/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen mit anderen Zeichen als A–Z, 0–9, „.“, „-“", nichtAscii.length ? nichtAscii.map((d) => d.datei).join(", ") : "keine", "keine");
  const ohneDatum = bau.docs.filter((d) => !/-\d{4}-\d{2}-\d{2}\.pdf$/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen enden mit vollständigem Datum", ohneDatum.length ? ohneDatum.map((d) => d.datei).join(", ") : "alle", "alle");
}
// typografisches Minus (U+2212) der PDFs wie den Bindestrich der Erwartungswerte behandeln
const pdftext = (p) => execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8" }).replace(/\u2212/g, "-");
for (const x of D.vorgaenge()) {
  const d = bau.docs.find((y) => y.ordner === "rechnungen" && y.datei.includes(x.nummer));
  if (!d) continue;
  const txt = pdftext(path.join(OUT, "rechnungen", d.datei)).replace(/\s+/g, " ");
  const soll = `${x.vz < 0 ? "-" : ""}${D.eur(x.s.brutto)}`;
  if (!txt.includes(soll)) auffaellig.push(`PDF ${d.datei}: Rechnungsbetrag ${soll} € nicht im Text gefunden.`);
  // Pflichtangaben einer GmbH auf Geschäftsbriefen (§ 35a GmbHG): Rechtsform, Sitz, Registergericht, HRB, alle Geschäftsführer
  if (x.nummer === "2026-001") {
    for (const [was, re] of [["Registergericht", /Amtsgericht Hamburg/], ["HRB 178432", /HRB 178432/], ["Sitz", /Sitz Hamburg/], ["Geschäftsführer Alex Sonnberg", /Alex Sonnberg/], ["Geschäftsführer Chris Sonnberg", /Chris Sonnberg/], ["USt-IdNr.", /DE361847295/]]) vergleich("Rechnung 2026-001 (§ 35a GmbHG, § 14 UStG)", `PDF enthält ${was}`, re.test(txt) ? "ja" : "nein", "ja");
    vergleich("Rechnung 2026-001", "kein „Inhaber/in“ bei einer GmbH", /Inhaber/.test(txt) ? "„Inhaber“ im Text" : "nein", "nein");
  }
}
const nurSchluss = [];
for (const d of bau.docs.filter((y) => y.ordner === "rechnungen")) {
  const p = path.join(OUT, "rechnungen", d.datei);
  const n = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [p], { encoding: "utf8" }))?.[1] ?? 1);
  if (n < 2) continue;
  const s2 = execFileSync("pdftotext", ["-layout", "-f", "2", "-l", "2", p, "-"], { encoding: "utf8" });
  if (!/Rechnungsbetrag|Pos\.|Bitte überweisen/.test(s2)) nurSchluss.push(d.datei);
}
if (nurSchluss.length) auffaellig.push(`Seitenumbruch: ${nurSchluss.length} Rechnungen mit zweiter Seite nur für Hinweise/Gruß: ${nurSchluss.join(", ")}.`);
for (const d of bau.docs.filter((y) => y.vorlage === "impressum" || y.vorlage === "datenschutzerklaerung_website")) {
  const txt = pdftext(path.join(OUT, "pdf", d.datei)).replace(/\s+/g, " ");
  if (d.vorlage === "impressum") for (const [was, re] of [["USt-IdNr.", /DE361847295/], ["HRB 178432", /HRB 178432/], ["Chris Sonnberg", /Chris Sonnberg/], ["Stammkapital", /25\.000/]]) vergleich("Impressum (§ 5 DDG)", `enthält ${was}`, re.test(txt) ? "ja" : "nein", "ja");
  if (d.vorlage === "datenschutzerklaerung_website") for (const [was, re] of [["Terminbuchung", /Terminbuchung|Termin/], ["TerminFix", /TerminFix/], ["Instagram", /Instagram/]]) vergleich("Datenschutzerklärung", `enthält ${was}`, re.test(txt) ? "ja" : "nein", "ja");
}

// ---------------------------------------------------------------- KoSIT (optional; StB-Prüfung C-15: auch Salon, Shop, Elektro)
let kosit = "nicht geprüft (Umgebungsvariable KOSIT nicht gesetzt)";
const KOSIT = process.env.KOSIT;
if (KOSIT && fs.existsSync(KOSIT)) {
  const jar = fs.readdirSync(path.join(KOSIT, "v")).find((f) => /^validator-.*\.jar$/.test(f));
  const sz = path.join(KOSIT, "cfg", "scenarios.xml");
  const berichte = path.join(OUT, ".kosit");
  fs.mkdirSync(berichte, { recursive: true });
  const xmlDateien = bau.xmls.map((x) => path.join(OUT, "rechnungen", x.datei));
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
const mo = D.ustMonate();
const j = D.jahresSummen();
const g = D.guv();
const bz = D.bilanz();

md.push(`# Jahres-Szenario „${B.name}“ 2026`, "",
  `Erzeugt mit \`apps/mobile/werkzeuge/jahr-szenario-salon.mjs\` am ${new Date().toISOString().slice(0, 10)} – mit den echten Funktionen der App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, bezahltSetzen auch für die Erstattung, belegSetzen, eRechnungLesen/belegAusERechnung, umsaetzeFuer mit „ist“, euerUebernahme, steuerpaket, auswertung, dokumentHtml + Fußzeile wie in der App). Die Erwartungswerte stammen aus \`apps/mobile/werkzeuge/jahr-szenario-salon-daten.ts\`, die nichts aus der App importiert.`, "",
  "**Neu erzeugen:** `cd packages/fachlogik && npx tsc -p tsconfig.build.json && cd ../../apps/mobile && node werkzeuge/jahr-szenario-salon.mjs /tmp/claude-0/salon`. Alle Namen, Anschriften, Register-, Steuer- und Kontonummern sind erfunden.", "",
  "## Betrieb", "",
  tab(["Angabe", "Wert"], [
    ["Firma", `${B.name}, ${B.strasse}, ${B.plz} ${B.ort} (${B.bundesland})`],
    ["Rechtsform", `GmbH, Stammkapital 25.000 € (voll eingezahlt), Gesellschaftsvertrag ${D.de(D.GRUENDUNG.vertrag)}, eingetragen ${D.de(D.GRUENDUNG.eintragung)} ${B.registergericht} ${B.registernummer}, Geschäftsbeginn ${D.de(D.GRUENDUNG.beginn)}; Transparenzregister gemeldet 02.04.2025`],
    ["Gesellschafter-Geschäftsführer", D.GESELLSCHAFTER.map((x) => `${x.name} (${x.anteil}; ${x.rolle})`).join("; ")],
    ["Steuer", `StNr ${B.steuernummer}, USt-IdNr ${B.ust_idnr}, Regelbesteuerung, IST-Versteuerung (§ 20 UStG), Voranmeldung MONATLICH, Bilanzierung (HGB), Kleinstkapitalgesellschaft`],
    ["Bank", `${B.bank}, IBAN ${B.iban}, BIC ${B.bic}`], ["Kontakt", `${B.telefon}, ${B.email}, ${B.website} (mit Online-Terminbuchung TerminFix, Instagram-Link)`],
    ["Beschäftigte", Object.values(D.MITARBEITER).map((x) => `${x.name} (${x.taetigkeit}, seit ${D.de(x.beginn)})`).join("; ") + " – Finn Jürgensen ist 17 (Jugendlicher)"],
    ["Handwerk", "Friseurhandwerk (Anlage A HwO), Handwerksrolle mit Betriebsleiterin Chris Sonnberg (Friseurmeisterin), Handwerkskammer Hamburg, BGW"],
    ["Kasse", "SalonKasse Pro mit USB-TSE (Kassenmeldung 20.06.2025)"], ["Steuerberatung", "Behrens & Ohlsen PartG mbB (Buchführung, Jahresabschluss), DATEV SKR03, Berater 31877 / Mandant 20514"],
  ]), "");

md.push("## Erzeugte Dateien", "", `Ordner: \`${OUT}\`. PNG-Ansichten jeder PDF-Seite (60 dpi) in \`png/\`. \`stand.json\` ist der komplette App-Stand am Ende.`, "");
md.push(tab(["Datei", "Seiten", "Inhalt / Eingaben"], dateien.map((x) => [`\`${x.rel}\``, seiten[x.rel] ?? "", x.inhalt])), "");
md.push("### Übersprungene Vorlagen", "", tab(["Vorlage", "Grund"], bau.uebersprungen.map((u) => [u.titel, u.grund])), "");

md.push("## Eingaben: Ausgangsrechnungen (alle 19 %)", "", "Beträge in €. Zeilen: Menge × Einzelpreis, auf Cent gerundet; USt aus der Summe je Satz. „Bezahlt“ = Zahlungseingang, bei Stornos die Erstattung.", "");
md.push(tab(["Nr.", "Datum", "Leistung", "Kunde", "Netto", "USt", "Brutto", "Bezahlt/erstattet", "Ist-Monat", "Was"], D.vorgaenge().map((x) => [x.nummer, D.de(x.datum), x.art === "storno" ? `Storno zu ${x.r.nummer}` : D.de(x.leistung), D.KUNDEN[x.kunde].name, e(x.vz * x.s.netto), e(x.vz * x.s.ust), e(x.vz * x.s.brutto), x.bezahlt ? D.de(x.bezahlt) : "–", x.bezahlt ? x.bezahlt.slice(0, 7) : "–", x.art === "storno" ? x.r.storno.grund : x.r.worum])), "");
md.push("Positionen:", "");
for (const r of D.RECHNUNGEN) md.push(`- **${r.nummer}** an ${r.kundeAbweichend ? `„${r.kundeAbweichend.name}“ (absichtlich falsch)` : D.KUNDEN[r.kunde].name}, Ziel ${r.ziel === "sofort" ? "sofort" : `${r.ziel} Tage`}: ${r.pos.map((p) => `${String(p.menge).replace(".", ",")} ${p.einheit} „${p.bez}“ à ${e(p.preis)} €`).join("; ")}`);
md.push("");

md.push("## Eingaben: Belege", "", "„Vorsteuer“ = auf dem Beleg ausgewiesene Steuer (bei Rechnungen Netto × Satz, bei Kassenbons/Fahrkarte aus dem Brutto). In die App wird der Bruttobetrag je Satz eingegeben.", "");
md.push(tab(["ID", "Datum", "Lieferant / Nr.", "Kategorie", "je Satz: netto + USt", "Brutto", "Vorsteuer", "Zahlung", "Was"], D.BELEGE.map((b) => {
  const sm = D.belegSumme(b);
  return [b.id, D.de(b.datum), `${b.lieferant}${b.nummer ? ` / ${b.nummer}` : ""}`, b.kategorie, sm.jeSatz.map((x) => `${x.satz} %: ${e(x.netto)} + ${e(x.ust)}`).join("<br>"), e(sm.brutto), b.vorsteuer ? e(sm.vorsteuer) : "nein", `${b.zahlung}${b.bezahlt ? `, bezahlt ${D.de(b.bezahlt)}` : ""}`, b.worum];
})), "");

md.push("## Eingaben: Kasse, Lohn, Annahmen", "", "Kassenumsätze (Dienstleistungen und Produktverkauf, 19 %) laut Z-Bon-Monatssumme. Die App kennt diese Umsätze nicht – sie wurden in jede Voranmeldung von Hand addiert.", "");
md.push(tab(["Monat", "Brutto", "Netto", "USt"], [...D.KASSE_MONATE.map((k) => [k.monat, e(k.b19), e(k.n19), e(k.u19)]), ["Summe", e(summe(D.KASSE_MONATE.map((k) => k.b19))), e(summe(D.KASSE_MONATE.map((k) => k.n19))), e(summe(D.KASSE_MONATE.map((k) => k.u19)))]]), "");
md.push(`- Löhne (Annahmen „vom Lohnbüro“): Mia Petersen 2.900 €/3.000 € ab Juli, Leonie Brandt 2.750 €, Aylin Demir 1.750 € (Teilzeit), Finn Jürgensen 820 €/900 € ab August (Azubi); AG-Anteile 21,15 %. Geschäftsführer je ${e(D.GF_GEHALT)} € (sozialversicherungsfrei). Personalkosten je Quartal: ${[1, 2, 3, 4].map((n) => `Q${n} ${e(D.personalQuartal(n))} €`).join(", ")}; Lohnsteuer je Monat ca. ${e(D.lohnsteuerMonat(0))} € ⇒ Lohnsteuer-Anmeldung monatlich (§ 41a Abs. 2 EStG: > 5.000 € im Vorjahr).`,
  `- Eröffnungsbilanz 01.01.2026 (Annahme): BGA ${e(D.EROEFFNUNG.bga)}, Kasse ${e(D.EROEFFNUNG.kasse)}, Bank ${e(D.EROEFFNUNG.bank)}; Stammkapital ${e(D.EROEFFNUNG.stammkapital)}, Verlustvortrag ${e(D.EROEFFNUNG.verlustvortrag)}, Gesellschafterdarlehen ${e(D.EROEFFNUNG.darlehenGesellschafter)}, USt Dezember 2025 ${e(D.EROEFFNUNG.ustDez2025)} (gezahlt 12.01.2026). AfA Altbestand 2026 ${e(D.AFA_ALTBESTAND)}; Behandlungsstuhl ${e(g.stuhl)} / 8 Jahre × 10/12 = ${e(g.afaStuhl)}.`,
  "- USt-Zahlungen: Zahllast jedes Monats am 10. des Folgemonats (exakt, mit Cent); Dezember 2026 wird am 11.01.2027 gezahlt und steht daher als Verbindlichkeit in der Bilanz.", "");

md.push("## Erwartete Kennzahlen (unabhängig gerechnet)", "", "### Umsatzsteuer-Voranmeldungen 2026 (Ist: Rechnungen nach Zahlungseingang, Storno nach Erstattung; Kasse nach Z-Bon; Vorsteuer nach Belegdatum)", "");
md.push(tab(["Monat", "Rechnungen (Ist)", "Rechnungen 19 %", "Kasse 19 %", "Kz 81 (19 %)", "USt", "Vorsteuer (Kz 66)", "Zahllast exakt", "Zahllast ELSTER"], [
  ...mo.map((x) => [x.m, x.nummern.join(", ") || "–", e(x.r19), e(x.k19), e(x.bmg19), e(x.ust), e(x.vorsteuer), e(x.zahllast), e(x.elsterZahllast)]),
  ["Jahr", "", e(j.r19), e(j.k19), e(j.r19 + j.k19), e(j.ust), e(j.vorsteuer), e(j.zahllast), e(j.elsterZahllast)],
]), "", "Nicht in 2026: 2026-017 (bezahlt 12.01.2027 → Januar 2027), 2026-018 (offen), 2026-010 und Storno 2026-011 (nie gezahlt, keine Erstattung).", "");
md.push("### GuV 2026 (HGB, periodengerecht; vor Ertragsteuern)", "", tab(["Posten", "Betrag €"], [...Object.entries(g.ertraege).map(([k, w]) => [k, e(w)]), ["**Summe Erträge**", `**${e(g.summeErtraege)}**`], ...Object.entries(g.aufwand).map(([k, w]) => [k, e(w)]), ["**Summe Aufwendungen**", `**${e(g.summeAufwand)}**`], ["**Jahresüberschuss**", `**${e(g.jahresueberschuss)}**`]]), "");
md.push("### Bilanz zum 31.12.2026", "", tab(["Aktiva", "€", "Passiva", "€"], Array.from({ length: Math.max(bz.aktiva.length, bz.passiva.length) }, (_, i) => [bz.aktiva[i]?.[0] ?? "", bz.aktiva[i] ? e(bz.aktiva[i][1]) : "", bz.passiva[i]?.[0] ?? "", bz.passiva[i] ? e(bz.passiva[i][1]) : ""]).concat([["**Summe**", `**${e(bz.summeAktiva)}**`, "**Summe**", `**${e(bz.summePassiva)}**`]])), "",
  `Forderungen: ${bz.offen.join(", ")} (brutto). Bank fortgeschrieben aus allen Zahlungen (kein Ausgleichsposten); dass Aktiva = Passiva, ist die Probe der unabhängigen Rechnung.`, "");
md.push("### Steuerberater-Pakete", "", `- Juni 2026: Rechnungen mit Rechnungsdatum im Juni (${D.vorgaenge().filter((x) => x.datum.startsWith("2026-06")).map((x) => x.nummer).join(", ")}), Belege ${D.BELEGE.filter((b) => b.datum.startsWith("2026-06")).map((b) => b.id).join(", ")}; ${pMonat.buchungen} Buchungen, ${pMonat.anzahl} Dateien, ${pMonat.fragen} Punkte in Fragen_2026-06.txt. Für die Voranmeldung Juni (Ist) zählen dagegen ${mo[5].nummern.join(", ")} nach Zahlungseingang/Erstattung.`,
  `- Jahr 2026: alle ${D.vorgaenge().length} Rechnungen inkl. 2 Stornos, alle ${D.BELEGE.length} Belege; ${pJahr.buchungen} Buchungen, ${pJahr.anzahl} Dateien, ${pJahr.fragen} Punkte in Fragen_2026.txt.`, "");

md.push("## Vergleich App ↔ unabhängige Rechnung", "", `${vergleiche.filter((v) => v.ok).length} von ${vergleiche.length} Prüfungen stimmen. Abweichungen (✗) stehen zusätzlich unter „Auffälligkeiten“.`, "");
md.push(tab(["", "Bereich", "Prüfung", "App", "erwartet"], vergleiche.map((v) => [v.ok ? "✓" : "✗", v.bereich, v.was, v.app, v.erwartet])), "");
md.push("Übernahme „Aus Rechnungen“ (Ist) je Monat – Rohwerte der App vor dem Ergänzen der Kasse:", "", tab(["Monat", "Versteuerung", "Rechnungen", "umsatz_19", "umsatz_7", "umsatz_frei", "vorsteuer", "fertige VA: 19 % / Vorsteuer"], bau.ust.map((u) => [u.m, u.versteuerung, u.appAnzahl, u.app.umsatz_19, u.app.umsatz_7, u.app.umsatz_frei, u.app.vorsteuer, `${u.final.umsatz_19} / ${u.final.vorsteuer}`])), "");
md.push("EÜR-Übernahme für die GmbH (seit der StB-Prüfung E-4 gesperrt – die Listen sind leer):", "", tab(["Liste", "Bezeichnung", "Zeile Anlage EÜR", "Betrag"], [...bau.euer.einnahmen.map((x) => ["Einnahme", x.text, x.kategorie, x.betrag]), ...bau.euer.ausgaben.map((x) => ["Ausgabe", x.text, x.kategorie, x.betrag])]), "", `Hinweis der Übernahme: „${bau.euer.hinweis}“`, "");

md.push(`## Pflichten-Check der App für den Salon (Stichtag ${D.de(bau.pflichten.stichtag)})`, "", "Profil: Beauty/Kosmetik + Handwerk (Anlage A), GmbH (eingetragen, 2 Gesellschafter, Kalenderjahr), Gewerbe, Hamburg, 4 Beschäftigte (1 Azubi, 1 unter 18, kein Minijob), Lohnsteuer monatlich, elektronische Kasse, Website, Regelbesteuerung, Steuerberatung, Gründung 01.04.2025, Kunden B2B/B2C Inland, Gefahrstoffe, elektrische Geräte, Kunden-, Beschäftigten- und Gesundheitsdaten, Dienstleister, KI-Nutzung.", "");
md.push("### Gilt", "", tab(["Pflicht", "nächster Termin", "Termine 12 Mon.", "Vorlage laut App", "erzeugt", "Grund laut App"], bau.pflichten.gilt.map((p) => [`${p.titel} (\`${p.id}\`)`, p.termin ? D.de(p.termin) : "–", p.termine, p.vorlage ?? "–", p.vorlage ? (p.erzeugt ? "ja" : "**nein**") : "", p.grund])), "");
md.push("### Gründungsschritte (Betrieb läuft > 6 Monate, App stellt sie zurück)", "", tab(["Pflicht", "Vorlage", "erzeugt"], bau.pflichten.gruendung.map((p) => [`${p.titel} (\`${p.id}\`)`, p.vorlage ?? "–", p.vorlage ? (p.erzeugt ? "ja" : "nein") : ""])), "");
if (bau.pflichten.unbekannt.length) md.push("### Noch offen (App braucht weitere Antworten)", "", ...bau.pflichten.unbekannt.map((p) => `- ${p.titel}${p.fragen.length ? ` – Fragen: ${p.fragen.join(", ")}` : ""}`), "");

md.push("## Auffälligkeiten beim Erzeugen", "", "### Automatisch erkannt (Abweichungen gegen die unabhängige Rechnung bzw. Plausibilitätsprüfungen)", "");
md.push(...(auffaellig.length ? auffaellig.map((a) => `- ${a}`) : ["- keine"]), "");
md.push("### Fachlich festgestellt (nicht automatisch prüfbar), mit Fundstelle und Vorschlag", "", ...(BEOBACHTUNGEN.length ? BEOBACHTUNGEN.map((b) => `- ${b}`) : ["- (noch nicht gepflegt)"]), "");
md.push("## Durchsicht jeder PDF-Seite (PNG 60 dpi, von Hand)", "", ...(DURCHSICHT.length ? DURCHSICHT.map((b) => `- ${b}`) : ["- (noch nicht gepflegt)"]), "");
md.push("## Hinweise der App und weitere Informationen", "", ...bau.infos.map((i) => `- ${i}`), `- ${kosit}`, "");
fs.writeFileSync(path.join(OUT, "SZENARIO.md"), md.join("\n"));

console.log(`${bau.docs.length} Unterlagen, ${bau.xmls.length} XRechnungen, ${bau.belegDateien.length} Belegdateien, ${pdfs.length} PDFs → ${OUT}`);
console.log(`Vergleiche: ${vergleiche.filter((v) => v.ok).length}/${vergleiche.length} ok; Auffälligkeiten: ${auffaellig.length}`);
console.log(kosit);
for (const a of auffaellig) console.log(`  - ${a}`);
