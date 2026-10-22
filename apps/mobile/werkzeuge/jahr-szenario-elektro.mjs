/**
 * Jahres-Szenario „Elektro Brandt“ 2026 (Einzelunternehmen, Elektro-Meisterbetrieb in Dortmund, Soll-Versteuerung,
 * vierteljährliche Voranmeldung, 2 Gesellen und 1 Auszubildender mit 17 Jahren, Werkstatt, Werkstattwagen, Arbeit auf
 * Baustellen): erzeugt mit den echten Funktionen der App alle Unterlagen eines Jahres – 25 Rechnungen (PDF + XRechnung)
 * mit Bauleistungen nach § 13b UStG, Abschlags- und Schlussrechnung, Storno mit Ersatzrechnung per „Kopieren“, Skonto,
 * Photovoltaik zum Nullsteuersatz, überfällige Rechnung mit Zahlungserinnerung; 44 Belege (Großhandel, empfangene
 * XRechnung, Tank, Leasing, Anlage, GWG, Kleinbeträge, Subunternehmer nach § 13b); Arbeitsschutz- und Personalvorlagen;
 * Kontrollmappe; Voranmeldungen Q1–Q4; EÜR; Steuererklärung; Steuerberater-Pakete Q4 und Jahr (entpackt); Pflichten-Check
 * (auch mit der Branche „Bau“ als Variante) – und schreibt SZENARIO.md mit allen Eingaben, den unabhängig gerechneten
 * Erwartungswerten (werkzeuge/jahr-szenario-elektro-daten.ts) und jeder Abweichung.
 *
 *   cd packages/fachlogik && npx tsc -p tsconfig.build.json
 *   cd apps/mobile && node werkzeuge/jahr-szenario-elektro.mjs [ausgabe]     # Standard: /tmp/claude-0/elektro
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

/**
 * Fachliche Beobachtungen beim Erzeugen (Oktober 2026), die sich nicht als Zahlvergleich automatisieren lassen – mit
 * Fundstelle und Vorschlag. Bei jedem Lauf erneut prüfen und hier pflegen.
 */
const BEOBACHTUNGEN = [
  "**[schwer] Keine XRechnung bei Leistungszeitraum.** Steht in der Rechnung ein Zeitraum („12.01.–11.02.2026“) oder Text statt eines einzelnen Datums, liefert `eRechnungAus` kein Leistungsdatum und blockiert die E-Rechnung mit „Leistungsdatum als Datum (TT.MM.JJJJ)“ (`packages/fachlogik/src/dokumente/buchhaltung.ts:138`, `isoAus`). Betroffen hier 6 von 15 B2B-Rechnungen, darunter alle drei § 13b-Rechnungen an den Generalunternehmer – im Handwerk ist der Leistungszeitraum der Normalfall, und ab 2027/2028 ist die E-Rechnung im B2B Pflicht. Vorschlag: Zeiträume „TT.MM.(JJJJ)–TT.MM.JJJJ“ erkennen und als Abrechnungszeitraum BG-14 (BT-73/BT-74) übertragen, besser zwei Datumsfelder „Leistung von/bis“.",
  "**[schwer] Umsatzsteuer im falschen Quartal bei Zeitraum- und Abschlagsrechnungen (Soll).** `zuordnen` nimmt ohne erkennbares Leistungsdatum das Rechnungsdatum (`apps/mobile/src/unterlagen/ustAusRechnungen.ts:54–59`). 2026-015 (Leistung bis 30.06., Rechnung 03.07.) landet in Q3 statt Q2; die Abschlagsrechnung 2026-014 (Juni, vor Ausführung, bezahlt 08.07.) in Q2 statt Q3 (Mindest-Ist, § 13 Abs. 1 Nr. 1 a Satz 4 UStG). Folge: Q2 +8.118,00 € Bemessungsgrundlage, Q3 −8.118,00 €, Zahllast ±1.542,42 €. Die App meldet nur die Anzahl „nach Rechnungsdatum zugeordnet“. Vorschlag: Zeitraumende als Leistungsdatum verwenden; Rechnungsart „Abschlag“ mit Zuordnung nach Zahlungseingang; deutlicher Hinweis in der Voranmeldung, welche Rechnungen per Rechnungsdatum eingeordnet wurden.",
  "**[schwer] Öffentliche Auftraggeber: keine Leitweg-ID.** Die Rechnungsvorlage hat kein Feld für Leitweg-ID/Käuferreferenz; BT-10 der XRechnung bekommt die Rechnungsnummer (2026-020 an die Stadt Dortmund). Rechnungseingangsplattformen der öffentlichen Hand weisen solche XRechnungen zurück. Vorschlag: Feld „Leitweg-ID bzw. Käuferreferenz“ (selten) in `rechnung` und Übergabe als `kaeufer_referenz` in `eRechnungAus` (`buchhaltung.ts:138–170`), an der Kundin speicherbar.",
  "**[mittel] § 13b als Leistungsempfänger nicht abbildbar.** Die Subunternehmer-Bauleistung (b41, 955,00 €) lässt sich nur als 0-%-Beleg ohne Vorsteuer erfassen (`packages/fachlogik/src/belege.ts:20–41`, kein Merkmal Steuerschuldnerschaft); die Voranmeldung hat keine Kz 84/85/67, das Paket stellt keine Frage, DATEV bucht ohne 13b-Automatik auf 3100. Die Zahllast stimmt zufällig (Steuer = Vorsteuer), die Kennzahlen fehlen. Vorschlag: Beleg-Schalter „Steuerschuldnerschaft (§ 13b)“ mit Netto, daraus Kz 84/85 und 67; Frage im Paket.",
  "**[mittel] Voranmeldung ohne Kz 60 und Kz 87.** § 13b-Ausgangsumsätze (111.312,50 €) und PV zum Nullsteuersatz (15.056,00 €) stehen zusammen unter „Umsätze ohne Umsatzsteuer“; der Hinweis nennt nur Kz 41/43/21 (`buchhaltung.ts:693`). Vorschlag: sofort den Hinweistext um „60 Leistungen nach § 13b (Steuerschuldner ist der Empfänger)“ ergänzen; mittelfristig getrennte Felder je Steuerart (die Steuerart kennt `eRechnungAus` bereits).",
  "**[mittel] Einheiten „m“ und „Std.“ werden als Stück übertragen.** `CODE_JE_TEXT` kennt nur ausgeschriebene Einheiten (`packages/fachlogik/src/erechnung.ts:135–139`); „25 m“ geht als 25 × C62 in die XRechnung (2026-006, 2026-022). Vorschlag: Aliase m, lfm, Std., Std, h, Stk., St., psch./pauschal ergänzen.",
  "**[mittel] Nullsteuersatz (§ 12 Abs. 3 UStG) wird wie eine Steuerbefreiung behandelt.** 0 % mit Hinweistext ⇒ Steuerart „befreit“: Summenzeile „Umsatzsteuer 0 % (steuerfrei, siehe Hinweis)“ (`buchhaltung.ts:32–37`), EÜR-Zeile „umsatzsteuerfrei …“ (`apps/mobile/src/unterlagen/steuerpaket.ts:117`), Paketliste „befreit“ (`steuerpaket.ts:212`), XRechnung Kategorie E. Für Elektrobetriebe mit PV-Anlagen alltäglich. Vorschlag: Hinweis-Baustein „Nullsteuersatz PV (§ 12 Abs. 3 UStG)“ mit eigener Steuerart; EÜR-Zeile und XRechnung-Kategorie fachlich festlegen (siehe Rechtsfragen).",
  "**[mittel] Skonto ist nicht abbildbar.** Der Zahlungseingang kennt nur ein Datum (`apps/mobile/src/unterlagen/speicher.ts:489`, `bezahltSetzen`); 2026-021 wurde mit 2 % Skonto (71,19 €) bezahlt – Voranmeldung Q4 (Minderung nach § 17 UStG, 59,82 € netto) und EÜR-Zufluss sind zu hoch. Auf der Rechnung steht im Zahlungsblock und GiroCode der volle Betrag bis zum Nettoziel, der Skonto nur im freien Hinweis; in der XRechnung landet er als Note statt als Zahlungsbedingung (BT-20). Vorschlag: Feld „Skonto % / Tage“ an der Rechnung (Text, Zahlungsblock, BT-20) und „bezahlter Betrag“ beim Zahlungseingang mit Differenz als Entgeltminderung.",
  "**[mittel] Kontrollmappe nimmt nur das neueste Prüfprotokoll.** Prüfprotokolle werden über das Namensfeld „datum“ (Zeitfeld) zu einer Gruppe zusammengefasst (`apps/mobile/src/unterlagen/kontrollmappe.ts:20, 56–60`); das Werkstatt-Protokoll (Frist bis 02/2027) fehlt, weil das Baustellen-Protokoll jünger ist. Vorschlag: Prüfprotokolle nach `einsatz` gruppieren bzw. alle noch nicht abgelaufenen Protokolle aufnehmen.",
  "**[mittel] Pflichten-Check: Bauleistungen hängen allein an der Branche „Bau“.** Ein Elektro-Meisterbetrieb wählt „Handwerk“; dann fehlen Bauabzugsteuer/Freistellungsbescheinigung (`catalog/pflichten/steuern.bauabzugsteuer_freistellung.yaml`), Baustellenverordnung und jeder Hinweis auf § 13b. Wählt er zusätzlich „Bau“, kommt SOKA-BAU dazu (siehe Rechtsfragen). Vorschlag: eigene Frage „Arbeitet ihr auf Baustellen bzw. erbringt Bauleistungen für andere Unternehmen?“ als Auslöser für § 48 EStG, BaustellV (Arbeitgeberpflichten) und § 13b-Hinweise, getrennt von der Tarif-Branche.",
  "**[mittel] „Unterweisung jährlich wiederholen“ erscheint erst nach einer in Amtlos erfassten Unterweisung.** Auslöser ist nur das Ereignis „unterweisung_durchgefuehrt“ (`catalog/pflichten/arbeitsschutz.unterweisung_wiederholen.yaml`). Ein Betrieb mit Beschäftigten seit 2017 sieht am 15.01.2026 nur die Erstunterweisung. Vorschlag: für Bestandsbetriebe mit Beschäftigten die Wiederholung ab Check-Datum anzeigen („letzte Unterweisung?“ abfragen).",
  "**[mittel] Jugendlicher Auszubildender: halbjährliche Unterweisung und Nachuntersuchung ohne Termin.** Der Unterweisungsnachweis setzt immer „mindestens einmal jährlich … nächster Termin 20.07.2027“ (`packages/fachlogik/src/dokumente/arbeitsschutz.ts:199, 216`), § 29 Abs. 2 JArbSchG verlangt halbjährlich; `personal.jugendarbeitsschutz` ist „dauerhaft“ ohne Termine – die Nachuntersuchung (§ 33 JArbSchG, ein Jahr nach Beginn: 01.08.2026) erscheint nirgends. (Befund aus dem Salon-Szenario, weiter offen.)",
  "**[mittel] DGUV V3: Prüftermine aus dem Protokoll werden nicht genutzt.** Das Protokoll trägt „nächste Prüfung“ (Baustelle 14.12.2026, Richtwert 3 Monate), `arbeitsschutz.dguv_v3` hat aber keine Termine („sobald sie als Regeldaten hinterlegt sind“). Werkstattgeräte mit 12 Monaten bei Richtwert 6 Monate: kein Hinweis. Vorschlag: Erinnerung aus dem frühesten „nächste Prüfung“ der ausgegebenen Protokolle; Hinweis, wenn „nächste“ über dem Richtwert liegt.",
  "**[mittel] Rechnung: Schlussblock rutscht auf Seite 2.** 10 von 27 Rechnungen haben eine zweite Seite nur mit Hinweisen und Gruß (alle mit § 14b- bzw. § 13b-Hinweis), bei 2026-013 und 2026-019 steht der Summenblock allein auf Seite 2, obwohl Seite 1 ein Drittel frei hat (`buchhaltung.ts:391`, Block `.abschluss`). Gerade der Pflichthinweis „Steuerschuldnerschaft des Leistungsempfängers“ steht dadurch getrennt von den Beträgen. Vorschlag: Pflichthinweise direkt unter die Summen (vor den Zahlungsblock) setzen und nur Gruß/Dank umbrechen lassen.",
  "**[mittel] Fehlender Aufbewahrungshinweis bei Privatkunden wird nicht bemerkt.** 2026-017 (Gartenbeleuchtung an Privatperson) ist ohne den Hinweis nach § 14 Abs. 4 Nr. 9 UStG teilbar; `pruefen` (`buchhaltung.ts:276`) kennt keinen Privatkunden. Vorschlag: Schalter „Empfänger ist Privatperson“ an Kunde/Rechnung; bei Handwerk im Profil den Hinweis vorbelegen bzw. warnen.",
  "**[mittel] Abschlags- und Schlussrechnung ohne eigene Art.** Titel bleibt „Rechnung“ (`rechnungsTitel`, `buchhaltung.ts:174`), XRechnung 380, der Abzug des Abschlags (§ 14 Abs. 5 Satz 2 UStG: Entgelt und Steuer abzusetzen) geht nur als negative Zeile plus Freitext. Vorschlag: Rechnungsart „Abschlagsrechnung“/„Schlussrechnung“ mit Auswahl der bezahlten Abschläge (Netto und Steuer getrennt ausgewiesen), passender Titel und USt-Zuordnung nach Zahlung.",
  "**[gering] Steuerberater-Paket:** „Nicht enthalten“ nennt Kassenumsätze auch ohne Kasse (`steuerpaket.ts:581`); Fragen erwähnen den § 13b-Beleg nicht; EÜR-Übernahme beschriftet die § 13b-Summe mit „(z. B. innergemeinschaftliche Lieferung)“ (`steuerpaket.ts:161`); DATEV bucht § 13b-Umsätze auf 8100 statt einem eigenen Konto (bekannter Prüfpunkt `packages/fachlogik/src/buchungen.ts:431`).",
  "**[gering] Pflichten-Check GPSR** gilt schon mit „B2C + Waren“, der Text spricht vom Onlineshop (`catalog/pflichten/produkte.gpsr.yaml`); für einen Handwerker ohne Fernabsatz unpassend formuliert. Vorschlag: Auslöser auf Online-/Marktplatz-Vertrieb einschränken oder Text allgemein fassen (fachlich prüfen).",
  "**[gering] Zahlungserinnerung:** Text korrekt (Nummer, Betrag, Fälligkeit, IBAN), aber IBAN ohne Vierergruppen, Verwendungszweck „2026-023“ statt „Rechnung 2026-023“ wie auf der Rechnung, Anrede „Guten Tag Hausverwaltung Rüdiger Lenz,“, keine neue Frist; die App vermerkt nicht, dass/wann erinnert wurde (`apps/mobile/src/texte.ts:333`, `apps/mobile/src/seiten/Abschluss.tsx:363–370`). Vorschlag: `ibanText` verwenden, „Rechnung <Nr.>“, Datum der Erinnerung speichern und anzeigen.",
  "**[gering] Fälligkeit auf einem Feiertag:** 2026-027 „bis zum 01.01.2027“ – keine Verschiebung auf den nächsten Werktag.",
  "**[gering] Vorschläge passen nicht zum Gewerk:** Kundenkartei-Vorschlag mit „Gesundheitsangaben (z. B. Allergien)“ (`packages/fachlogik/src/dokumente/bausteine.ts:1203`), Lohn mit „Minijobber“, VVT-Logfiles 30 Tage gegen 10 Tage in der Datenschutzerklärung (`bausteine.ts:1291`, bekannt); Gefährdungsbeurteilung-Vorschläge „Handwerk“ ohne elektrotechnische Gefährdungen (fünf Sicherheitsregeln, Störlichtbogen), Unterweisungsthemen ohne Elektro- und Baustellenthema – beides hier als eigene Zeilen ergänzt.",
  "**[gering] Arbeitszeitnachweis Auszubildender:** Berufsschultage lassen sich nur als Bemerkung eintragen; die Summe (97:00 h) zählt die anzurechnenden Berufsschulzeiten nicht (§ 9 Abs. 2 JArbSchG). Vorschlag: Spalte „angerechnete Zeit“.",
  "**[gering] EÜR:** eine Erstattung des Finanzamts lässt sich ohne Hinweis als negative „gezahlte USt“ eintragen (das Werkzeug trägt sie jetzt als Einnahme „Vom Finanzamt erstattete … Umsatzsteuer“ ein); Lohnkonto: Kirchensteuermerkmal „rk“ ohne Kirchensteuerbeträge ohne Hinweis.",
  "**Geprüft und unauffällig:** alle 28 Rechnungsbeträge (Mengen 1,25 / 1,5 / 2,5 / 3,5 / 4,25 / 7,5 / 12,5 Std. bzw. m, 2.800 m Kabel, negative Abzugszeile, 0-%-Rechnungen), fortlaufende Nummern inkl. Storno und Ersatzrechnung per „Kopieren“ (ohne Storno-Bezug, neues Datum), Festschreibung; § 13b-PDF mit Pflichthinweis, beiden USt-IdNrn. und 0,00 € Steuer, XRechnung AE/VATEX-EU-AE; Aufbewahrungshinweis auf allen markierten Privatkundenrechnungen; Vorsteuer aller 44 Belege inkl. eingelesener XRechnung (MTR/H87/LS); EÜR-Kategorien, AfA, Anlagen/Unbezahlt-Zähler; Pakete (Anzahlen, Summen, offene Beträge, Rechnungs-PDFs, Belegdateien, DATEV-Spalten, GUIDs, Soll-Satz im LIESMICH); Zahlungserinnerung (Fälligkeit 17.11., 14 Tage überfällig, Knopf sichtbar); USt-Voranmeldung vierteljährlich ab Vorjahreszahllast ≤ 9.000 € und Termine; Pflichten Handwerksrolle, Rentenversicherung der Handwerker, Jugendarbeitsschutz, Gefahrstoffe, DGUV V3, EÜR/ESt/GewSt.",
];

/** Ergebnis der Durchsicht jeder PDF-Seite (PNG, 60 dpi) – von Hand gepflegt (Oktober 2026). */
const DURCHSICHT = [
  "**Rechnungen 01–27 und Storno 09 (38 Seiten):** Layout einheitlich, Beträge, Steuersätze und Einheiten (gebeugt: „1,5 Stunden“, „2 Tage“; „Std.“/„m“ wie eingegeben) korrekt. Seite 2 nur mit Hinweisen und Gruß bei 2026-001, -003, -004, -007, -008, -010, -011, -018, -023, -026; bei 2026-013 und -019 steht der ganze Summenblock auf Seite 2, Seite 1 hat unten ein Drittel frei [mittel, siehe oben]. § 13b-Rechnungen: Summenzeile „Umsatzsteuer 0 % (Steuerschuldnerschaft des Leistungsempfängers) auf … 0,00 €“, der Pflichthinweis selbst steht erst auf Seite 2. PV 2026-026: Summenzeile „0 % (steuerfrei, siehe Hinweis)“, Nullsteuersatz-Text auf Seite 2. Skonto 2026-021: „Bitte überweisen Sie 3.559,29 € bis zum 01.11.2026“ neben „2 % Skonto bis 12.10.“ [gering]. Abschlag 2026-014 heißt „Rechnung“. Privatkunden mit „Sehr geehrte Damen und Herren“ (bekannt) [gering]. Fußzeile „Inhaber/in: Jens Brandt“ – ungebeugt [gering].",
  "**Gewerbeanmeldung, Impressum, Datenschutzerklärung (3 S.), AVV (3 S.), Datenschutzinformation (4 S.), VVT (7 S.):** inhaltlich richtig. Impressum-Überschrift „Inhaber/in“ [gering]. AVV: Seite 3 nur § 5 und Unterschriften, Anlage TOM angekündigt, aber nicht beigefügt (bekannt) [gering]. VVT: Löschfrist Logfiles 30 Tage gegen 10 Tage in der Datenschutzerklärung; Kundenkartei mit Gesundheitsangaben, Lohn mit Minijobbern [gering].",
  "**Verfahrensdokumentation (3 S.), Aufbewahrungsplan (1 S.):** in Ordnung; Seite 3 der Verfahrensdokumentation nur Abschnitt 5 und Unterschrift [gering].",
  "**Nachweise Arbeitsbedingungen (2 × 2 S.), Personalfragebogen (3 × 2 S.), Lohnkonten (3 × 1 S. quer), Arbeitszeitnachweise (2 × 2 S.):** Inhalte korrekt, „an verschiedenen Orten“ passt zu Baustellen. Personalfragebogen Seite 2 nur eine Zeile plus Unterschrift; beim 16-/17-jährigen Azubi „Monatliches Entgelt“ und keine Unterschrift der gesetzlichen Vertretung (bekannt) [gering]. Arbeitszeitnachweise: Seite 2 nur Fußnote und Unterschriften [gering]; Fußnote nennt „Bau“ unter den § 2a-Branchen – der Betrieb hat im Check „keine“ gewählt.",
  "**Gefährdungsbeurteilungen Baustelle (5 S.) und Werkstatt (3 S.):** Vorschläge und eigene Zeilen sauber nach Faktoren; viel Leerraum, weil jeder Faktor-Abschnitt ganz auf die nächste Seite rückt (Seite 1 halb leer) [gering]. Mutterschutz-Texte passen.",
  "**Unterweisungen (2 × 2 S. bzw. 1 S.):** jährliche Unterweisung: Teilnehmerliste beginnt auf Seite 1, Unterschriftzeilen auf Seite 2 (bekannt) [gering]; Azubi-Unterweisung mit „mindestens einmal jährlich … nächster Termin 20.07.2027“ [mittel, siehe oben].",
  "**Gefahrstoffverzeichnis (1 S. quer), Betriebsanweisungen BA-01/BA-02 (je 1 S.):** korrekt, fehlendes SDB rot markiert.",
  "**Prüfprotokolle DGUV V3 (2 × 2 S. quer):** Prüfer ist der eigene Meister – passt. Seite 2 jeweils nur Richtwert-Satz und Unterschriften; Werkstatt „Richtwert 6 Monate“ neben eingetragenen 12 Monaten ohne Hinweis [gering].",
  "**USt-Voranmeldungen Q1–Q4 (je 1 S.):** „nach vereinbarten Entgelten“, Kz 81 mit Cent trotz „in vollen Euro“ (bekannt) [gering]; „Steuerfreie oder nicht steuerbare Umsätze“ mit Hinweis auf 41/43/21 statt 60/87 [mittel].",
  "**EÜR (3 S.), Steuererklärung (2 S.):** Beträge stimmen mit der Übernahme; § 13b-Summe mit Text „Steuerfreie Umsätze … (z. B. innergemeinschaftliche Lieferung)“ [gering]; Steuererklärung Seite 2 nur Notiz und Übertragungszeilen [gering].",
  "**Kontrollmappe (Deckblatt 2 S. + 15 Unterlagen):** Inhaltsverzeichnis mit Seitenzahlen stimmt; Werkstatt-Prüfprotokoll fehlt [mittel]; Titel bei 40 Zeichen abgeschnitten („Gießharz für Kabelmuffen (2-Komponenten-“) [gering]; Reihenfolge Datenschutz vor Arbeitsschutz – für eine BG-/Gewerbeaufsichtskontrolle umgekehrt hilfreicher [gering].",
  "**Belegdateien (Eingaben des Werkzeugs, 43 S.):** lesbar, je eine Seite.",
];

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? "/tmp/claude-0/elektro");
for (const d of ["pdf", "rechnungen", "png", "belege", "steuerpaket-q4", "steuerpaket-jahr"]) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".zip")) fs.rmSync(path.join(OUT, f));

// ---------------------------------------------------------------- bündeln
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const gebaut = path.join(OUT, ".jahr-szenario-elektro.mjs");
execFileSync(path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild"), [path.join(HIER, "jahr-szenario-elektro.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const S = await import(gebaut);
fs.rmSync(gebaut);
const D = S.D;

const bau = S.standBauen();
const { s } = bau;
const auffaellig = [...bau.auffaellig];
const vergleiche = [...bau.vergleiche];
const infos = [...bau.infos];
/** Beträge in Cent (als Euro dargestellt); Anzahlen mit `anzahl` als String vergleichen */
const vergleich = (bereich, was, app, erwartet, grund = "") => {
  const ok = app === erwartet;
  vergleiche.push({ bereich, was, app: typeof app === "number" ? D.eur(app) : String(app), erwartet: typeof erwartet === "number" ? D.eur(erwartet) : String(erwartet), ok });
  if (!ok) auffaellig.push(`${bereich} – ${was}: App ${typeof app === "number" ? D.eur(app) : app}, erwartet ${typeof erwartet === "number" ? D.eur(erwartet) : erwartet}.${grund ? ` ${grund}` : ""}`);
};
const anzahl = (bereich, was, app, erwartet, grund = "") => vergleich(bereich, was, String(app), String(erwartet), grund);

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

const pdfBytes = {};
for (const d of bau.docs) {
  const rel = `${d.ordner}/${d.datei}`;
  const bytes = await appPdf(S.dokHtml(s, d.uid), d.quer);
  pdfBytes[d.uid] = bytes;
  fs.writeFileSync(path.join(OUT, rel), bytes);
  merke(rel, `${d.titel}: ${d.worum}`);
}
for (const x of bau.xmls) {
  fs.writeFileSync(path.join(OUT, "rechnungen", x.datei), x.xml);
  merke(`rechnungen/${x.datei}`, `XRechnung 3.0 (UBL) zu Rechnung ${x.nummer}, erzeugt mit eRechnungAus + xrechnungUbl wie „Als E-Rechnung teilen“.`);
}
// Zahlungserinnerung: der Text, den die App ins Teilen-Menü gibt
{
  const datei = `Zahlungserinnerung-${bau.erinnerung.nummer}.txt`;
  fs.writeFileSync(path.join(OUT, "rechnungen", datei), bau.erinnerung.text + "\n");
  merke(`rechnungen/${datei}`, `Text der Zahlungserinnerung (TEXT.erinnerung_text wie in Abschluss.tsx) am ${D.de(bau.erinnerung.heute)}: ${bau.erinnerung.tage} Tage überfällig, fällig seit ${bau.erinnerung.faellig ? D.de(bau.erinnerung.faellig) : "?"}.`);
}
const belegBytes = {};
for (const b of bau.belegDateien) {
  const bytes = b.xml ? new TextEncoder().encode(b.xml) : await einfachPdf(b.html);
  belegBytes[b.datei] = bytes;
  fs.writeFileSync(path.join(OUT, "belege", b.datei), bytes);
  const roh = D.BELEGE.find((x) => b.datei.startsWith(x.id + "."));
  merke(`belege/${b.datei}`, `Eingabe: ${roh.lieferant} ${roh.nummer ?? ""} vom ${D.de(roh.datum)} – ${roh.worum}`);
}

// ---------------------------------------------------------------- Kontrollmappe (wie Kontrollmappe.tsx: Deckblatt, Seiten, zusammenfügen)
{
  const heute = "2026-10-20";
  const teile = [];
  for (const e of bau.mappe.eintraege) teile.push(pdfBytes[e.id] ?? (await appPdf(S.dokHtml(s, e.id), false)));
  const seitenJe = await Promise.all(teile.map(S.seitenzahl));
  let deckSeiten = 1;
  let deck = null;
  for (let i = 0; i < 2; i++) {
    const start = S.startSeiten(deckSeiten, seitenJe);
    deck = await appPdf(S.deckblattHtml(s.betrieb.name, heute, bau.mappe.eintraege.map((e, j) => ({ ...e, seite: start[j] }))), false);
    const n = await S.seitenzahl(deck);
    if (n === deckSeiten) break;
    deckSeiten = n;
  }
  const mappe = await S.mappeZusammenfuegen([deck, ...teile]);
  const name = S.mappeDateiname(s.betrieb.name, heute);
  fs.writeFileSync(path.join(OUT, "pdf", name), mappe);
  merke(`pdf/${name}`, `Kontrollmappe (mappenAuswahl, deckblattHtml, mappeZusammenfuegen): ${bau.mappe.eintraege.length} Unterlagen, ${deckSeiten} Seite(n) Deckblatt; ${bau.mappe.unvollstaendig} unvollständige ausgelassen.`);
  anzahl("Kontrollmappe", "Seiten gesamt = Deckblatt + Summe der Unterlagen", await S.seitenzahl(mappe), deckSeiten + seitenJe.reduce((a, b) => a + b, 0));
}
await browser.close();

// ---------------------------------------------------------------- Steuerberater-Pakete
const rechnungsPdfs = Object.fromEntries(bau.docs.filter((d) => d.ordner === "rechnungen").map((d) => [d.uid, pdfBytes[d.uid]]));
const pk = S.pakete(s, belegBytes, rechnungsPdfs);
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
  const bereich = `Paket ${name}`;
  fs.writeFileSync(path.join(OUT, erg.dateiname), erg.zip);
  merke(erg.dateiname, `Steuerberater-Paket ${name} (steuerpaket() mit Rechnungs-PDFs, ZIP wie in der App).`);
  const inhalt = S.unzipSync(erg.zip);
  for (const [p, bytes] of Object.entries(inhalt)) {
    fs.mkdirSync(path.dirname(path.join(OUT, ordner, p)), { recursive: true });
    fs.writeFileSync(path.join(OUT, ordner, p), bytes);
  }
  merke(`${ordner}/`, `entpacktes Paket ${name}: ${Object.keys(inhalt).length} Dateien (${Object.keys(inhalt).filter((p) => !p.includes("/")).join(", ")}, E-Rechnungen/, Rechnungen/, Belege/).`);
  const im = (iso) => iso >= zr.von && iso <= zr.bis;
  const vg = D.vorgaenge().filter((x) => im(x.datum));
  const bl = D.BELEGE.filter((b) => im(b.datum));
  const re = liste(inhalt[`Rechnungen_${zr.name}.csv`]);
  anzahl(bereich, "Anzahl Rechnungen (nach Rechnungsdatum)", re.zeilen.length, vg.length);
  vergleich(bereich, "Rechnungsliste: Summe Netto", summe(re.zeilen.map((z) => centAus(re.w(z, "Netto")))), summe(vg.map((x) => x.vz * x.s.netto)));
  vergleich(bereich, "Rechnungsliste: Summe USt", summe(re.zeilen.map((z) => centAus(re.w(z, "USt")))), summe(vg.map((x) => x.vz * x.s.ust)));
  vergleich(bereich, "Rechnungsliste: Summe Brutto", summe(re.zeilen.map((z) => centAus(re.w(z, "Brutto")))), summe(vg.map((x) => x.vz * x.s.brutto)));
  const gesamt = re.summen.find((z) => z[0] === "Summe gesamt");
  if (re.zeilen.length) vergleich(bereich, "Rechnungsliste: „Summe gesamt“ Brutto = Summe der Zeilen", gesamt ? centAus(re.w(gesamt, "Brutto")) : NaN, summe(re.zeilen.map((z) => centAus(re.w(z, "Brutto")))));
  const art = (nr) => { const z = re.zeilen.find((x) => re.w(x, "Nummer") === nr); return z ? re.w(z, "Steuerart") : "–"; };
  for (const x of vg.filter((y) => y.steuerart !== "standard" && y.art === "rechnung")) vergleich(bereich, `Rechnungsliste: Steuerart ${x.nummer}`, art(x.nummer), x.steuerart === "reverse_charge" ? "Reverse Charge" : "Nullsteuersatz (§ 12 Abs. 3 UStG)", x.steuerart === "nullsatz" ? "Die Liste kennt nur Standard, igL, Reverse Charge, § 19, befreit (apps/mobile/src/unterlagen/steuerpaket.ts:212)." : "");
  // offener Betrag: Rechnungen, die erst 2027 bezahlt werden
  const spaet = vg.filter((x) => x.art === "rechnung" && x.bezahlt && x.bezahlt > zr.bis).map((x) => x.nummer);
  const offen = summe(re.zeilen.map((z) => centAus(re.w(z, "Offener Betrag"))));
  const erwOffen = summe(vg.filter((x) => x.art === "rechnung" && !x.r.storno && (!x.bezahlt || x.bezahlt > zr.bis)).map((x) => x.s.brutto));
  vergleich(bereich, `Rechnungsliste: offener Betrag zum ${D.de(zr.bis)} (${spaet.join(", ")})`, offen, erwOffen);
  anzahl(bereich, "Rechnungs-PDFs im Paket (Rechnungen/)", Object.keys(inhalt).filter((p) => p.startsWith("Rechnungen/")).length, vg.length);
  const be = liste(inhalt[`Belege_${zr.name}.csv`]);
  anzahl(bereich, "Anzahl Belege (nach Belegdatum)", be.zeilen.length, bl.length);
  vergleich(bereich, "Belegliste: Summe Brutto", summe(be.zeilen.map((z) => centAus(be.w(z, "Brutto")))), summe(bl.map((b) => D.belegSumme(b).brutto)));
  vergleich(bereich, "Belegliste: Summe Vorsteuer", summe(be.zeilen.map((z) => centAus(be.w(z, "Vorsteuer")))), summe(bl.map((b) => D.belegSumme(b).vorsteuer)));
  anzahl(bereich, "Belegdateien im Paket", Object.keys(inhalt).filter((p) => p.startsWith("Belege/")).length, bl.length);
  const ohneXml = vg.filter((x) => !("email" in D.KUNDEN[x.kunde])).length;
  const mitZeitraum = vg.filter((x) => "email" in D.KUNDEN[x.kunde] && x.r.leistungText && !/^\d{2}\.\d{2}\.\d{4}$/.test(x.r.leistungText)).map((x) => x.nummer);
  anzahl(bereich, "E-Rechnungen im Paket (alle Rechnungen an Unternehmen mit E-Mail)", Object.keys(inhalt).filter((p) => p.startsWith("E-Rechnungen/")).length, vg.length - ohneXml, mitZeitraum.length ? `Ohne XRechnung, weil die Leistung als Zeitraum bzw. Text eingetragen ist („Leistungsdatum als Datum (TT.MM.JJJJ)“): ${mitZeitraum.join(", ")} – darunter alle § 13b-Rechnungen an den Generalunternehmer.` : "");
  const extf = csvLesen(inhalt[`EXTF_Buchungsstapel_${zr.name}.csv`], "latin1");
  const zeilen = extf.slice(2);
  const erwBuchungen = summe(vg.map((x) => Object.values(x.s.gruppen).filter((g) => g.netto + g.ust !== 0).length)) + summe(bl.filter((b) => b.kategorie !== "personal").map((b) => b.saetze.filter((x) => x.betrag).length)); // R10: Personal nicht im Stapel
  // R12: je Skonto beim Zahlungseingang im Zeitraum eine Buchung „Gewährte Skonti 19 %“ (8736) an Forderungen
  const skontoBuchungen = D.RECHNUNGEN.filter((r) => r.skonto && r.bezahlt && r.bezahlt >= zr.von && r.bezahlt <= zr.bis).length;
  anzahl(bereich, "DATEV: Anzahl Buchungen", zeilen.length, erwBuchungen + skontoBuchungen);
  if (skontoBuchungen) vergleich(bereich, "DATEV: Skonto 2026-021 auf 8736 an 1410 (brutto)", summe(zeilen.filter((z) => z[6] === "8736" && z[7] === "1410").map((z) => centAus(z[0]))), summe(D.RECHNUNGEN.filter((r) => r.skonto && r.bezahlt >= zr.von && r.bezahlt <= zr.bis).map((r) => D.skontoVon(r).brutto)));
  vergleich(bereich, "DATEV: Spalten je Zeile = Spalten im Kopf", zeilen.every((z) => z.length === extf[1].length) ? "ja" : "nein", "ja");
  vergleich(bereich, "DATEV: Kopf Beraternummer/Mandant", `${extf[0][10]}/${extf[0][11]}`, "41522/30318");
  const kontoSumme = (konto) => summe(zeilen.filter((z) => z[7] === konto || z[6] === konto).map((z) => (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
  const kontoBetrag = (konto) => summe(zeilen.filter((z) => z[7] === konto).map((z) => (z[1] === "H" ? -1 : 1) * (z[117] === "1" ? -1 : 1) * centAus(z[0])));
  vergleich(bereich, "DATEV: Brutto auf Erlöskonto 8400 (19 %)", kontoBetrag("8400"), summe(vg.filter((x) => x.steuerart === "standard").map((x) => x.vz * ((x.s.gruppen["19"]?.netto ?? 0) + (x.s.gruppen["19"]?.ust ?? 0)))));
  const r13b = summe(vg.filter((x) => x.steuerart === "reverse_charge").map((x) => x.vz * x.s.netto));
  if (r13b) vergleich(bereich, "DATEV: § 13b-Bauleistungen auf SKR03 8337 (Konto laut buchungen.ts-Prüfpunkt)", kontoBetrag("8337"), r13b, `Die App bucht alle 0-%-Umsätze auf 8100 (dort ${D.eur(kontoBetrag("8100"))} €), packages/fachlogik/src/buchungen.ts:130, 431.`);
  const pv = summe(vg.filter((x) => x.steuerart === "nullsatz").map((x) => x.vz * x.s.netto));
  if (pv) infos.push(`${bereich}: PV zum Nullsteuersatz (${D.eur(pv)} €) im DATEV-Stapel auf ${[...new Set(zeilen.filter((z) => centAus(z[0]) === pv).map((z) => z[7]))].join("/") || "?"} gebucht (Konto mit der Steuerberatung klären).`);
  if (bl.some((b) => b.p13b)) infos.push(`${bereich}: empfangene § 13b-Leistung (b41, ${D.eur(D.belegSumme(D.BELEGE.find((b) => b.p13b)).netto)} €) im DATEV-Stapel auf Konto ${zeilen.filter((z) => z[10] === "KY-26-0142").map((z) => `${z[6]}/${z[7]} BU „${z[8]}“`).join(", ") || "?"} – ohne § 13b-Automatik (z. B. SKR03 3120 o. ä., mit der Steuerberatung klären).`);
  void kontoSumme;
  const liesmich = Buffer.from(inhalt["LIESMICH.txt"]).toString("utf8");
  const fragen = inhalt[`Fragen_${zr.name}.txt`] ? Buffer.from(inhalt[`Fragen_${zr.name}.txt`]).toString("utf8") : "";
  vergleich(bereich, "LIESMICH: Mandant mit Rechtsform Einzelunternehmen und Versteuerung Soll", /- Rechtsform: Einzelunternehmen\r\n/.test(liesmich) && /- Versteuerung: Soll /.test(liesmich) ? "ja" : "nein", "ja");
  vergleich(bereich, "LIESMICH: Hinweis Rechnungsdatum (Paket) ↔ Leistungsdatum (Voranmeldung, Soll)", /nach dem Leistungsdatum zu \(Soll-Versteuerung\)/.test(liesmich) ? "ja" : "nein", "ja");
  vergleich(bereich, "LIESMICH: kein Kassenhinweis in der ersten Zeile (laut Check keine Kasse)", /^Betrieb mit Kasse|^Falls der Betrieb/.test(liesmich) ? "Kassenhinweis" : "keiner", "keiner");
  vergleich(bereich, "LIESMICH: „Nicht enthalten“ nennt Kassenumsätze, obwohl der Betrieb laut Check keine Kasse hat", /- Kassenumsätze/.test(liesmich) ? "ja" : "nein", "nein", "Zeile fest im Text (apps/mobile/src/unterlagen/steuerpaket.ts:581); bei kassenLage „keine“ weglassen.");
  vergleich(bereich, "LIESMICH: Satz „Nicht zusätzlich … importieren“ genau im Jahrespaket", /Nicht zusätzlich zu den Monats-\/Quartalsstapeln importieren/.test(liesmich) ? "ja" : "nein", /^\d{4}$/.test(zr.name) ? "ja" : "nein");
  vergleich(bereich, "Fragen: privat bezahlter Beleg (b36) aufgeführt", bl.some((b) => b.zahlung === "privat") ? (/Privat bezahlte Belege/.test(fragen) ? "ja" : "nein") : "–", bl.some((b) => b.zahlung === "privat") ? "ja" : "–");
  vergleich(bereich, "Fragen: Anschaffung über 800 € (b25) aufgeführt", bl.some((b) => b.kategorie === "anlage") ? (/Anschaffungen über 800 €/.test(fragen) ? "ja" : "nein") : "–", bl.some((b) => b.kategorie === "anlage") ? "ja" : "–");
  if (bl.some((b) => b.p13b)) vergleich(bereich, "Fragen: empfangene Leistung ohne USt (§ 13b) als Frage aufgeführt", /13b|Steuerschuldnerschaft|ohne Umsatzsteuer/.test(fragen) ? "ja" : "nein", "ja", "Ein Beleg mit 0 % und Notiz „§ 13b“ erzeugt keine Frage an die Steuerberatung (apps/mobile/src/unterlagen/steuerpaket.ts fragenText).");
  vergleich(bereich, `Fragen: offene Rechnungen zum Stichtag (${spaet.join(", ")}) aufgeführt`, spaet.every((n) => fragen.includes(n)) ? "ja" : "nein", "ja");
  return { anzahl: Object.keys(inhalt).length, buchungen: zeilen.length, fragen: erg.fragen };
}
const pq4 = paketPruefen("Q4 2026", { von: "2026-10-01", bis: "2026-12-31", name: "2026-Q4" }, pk.q4, "steuerpaket-q4");
const pj = paketPruefen("Jahr 2026", { von: "2026-01-01", bis: "2026-12-31", name: "2026" }, pk.jahr, "steuerpaket-jahr");

// ---------------------------------------------------------------- Dateinamen und Texte in den PDFs
{
  const nichtAscii = bau.docs.filter((d) => /[^A-Za-z0-9._-]/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen mit anderen Zeichen als A–Z, 0–9, „.“, „-“", nichtAscii.length ? nichtAscii.map((d) => d.datei).join(", ") : "keine", "keine");
  const ohneDatum = bau.docs.filter((d) => !/-\d{4}-\d{2}-\d{2}\.pdf$/.test(d.datei));
  vergleich("Dateinamen", "PDF-Namen enden mit vollständigem Datum", ohneDatum.length ? ohneDatum.map((d) => d.datei).join(", ") : "alle", "alle");
  const storno = bau.docs.filter((d) => d.titel === "Stornorechnung" && !/Storno/.test(d.datei));
  vergleich("Dateinamen", "Stornorechnung heißt im Dateinamen „Stornorechnung“", storno.length ? storno.map((d) => d.datei).join(", ") : "ja", "ja");
}
const pdftext = (p) => execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8" }).replace(/−/g, "-");
for (const x of D.vorgaenge()) {
  const d = bau.docs.find((y) => y.ordner === "rechnungen" && y.datei.includes(x.nummer));
  if (!d) continue;
  const txt = pdftext(path.join(OUT, "rechnungen", d.datei)).replace(/\s+/g, " ");
  const soll = `${x.vz < 0 ? "-" : ""}${D.eur(x.s.brutto)}`;
  if (!txt.includes(soll)) auffaellig.push(`PDF ${d.datei}: Rechnungsbetrag ${soll} € nicht im Text gefunden.`);
  if (x.art !== "rechnung") continue;
  if (x.steuerart === "reverse_charge") {
    vergleich(`PDF ${x.nummer} (§ 13b)`, "Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ (§ 14a Abs. 5 UStG)", /Steuerschuldnerschaft des Leistungsempfängers/.test(txt) ? "ja" : "nein", "ja");
    vergleich(`PDF ${x.nummer} (§ 13b)`, "keine Umsatzsteuer ausgewiesen (keine Zeile „Umsatzsteuer 19 %“)", /Umsatzsteuer 19 %/.test(txt) ? "19 % ausgewiesen" : "keine", "keine");
    // StB-Prüfung C-2 (Nachtrag 22.10.2026): „Umsatzsteuer: entfällt (§ 13b UStG)“ statt „Umsatzsteuer 0 % … 0,00 €“
    vergleich(`PDF ${x.nummer} (§ 13b, C-2)`, "Summenzeile „Umsatzsteuer: entfällt (§ 13b UStG)“ statt „Umsatzsteuer 0 %“", txt.includes("Umsatzsteuer: entfällt (§ 13b UStG)") && !/Umsatzsteuer 0 %/.test(txt) ? "ja" : "nein", "ja");
    vergleich(`PDF ${x.nummer} (§ 13b)`, "USt-IdNr. des Leistungsempfängers und des Leistenden", /DE814527390/.test(txt) && /DE297641853/.test(txt) ? "ja" : "nein", "ja");
  }
  if (x.r.hinweise?.includes("grundstueck")) vergleich(`PDF ${x.nummer} (Privatkunde)`, "Aufbewahrungshinweis § 14 Abs. 4 Nr. 9 UStG", /zwei Jahre aufzubewahren/.test(txt) ? "ja" : "nein", "ja");
  if (x.steuerart === "nullsatz") {
    vergleich(`PDF ${x.nummer} (PV)`, "Hinweis auf den Nullsteuersatz § 12 Abs. 3 UStG", /§ 12 Abs\. 3/.test(txt) ? "ja" : "nein", "ja");
    vergleich(`PDF ${x.nummer} (PV)`, "Summenzeile benennt 0 % als Nullsteuersatz (nicht „steuerfrei“)", /Umsatzsteuer 0 % \(steuerfrei/.test(txt) ? "„Umsatzsteuer 0 % (steuerfrei, siehe Hinweis)“" : "ok", "ok", "Der Nullsteuersatz ist keine Steuerbefreiung; die Summenzeile stammt aus nullProzentText (packages/fachlogik/src/dokumente/buchhaltung.ts:35).");
  }
  if (x.r.skonto) {
    const m = /Bitte überweisen Sie ([\d.,]+) €/.exec(txt);
    infos.push(`PDF ${x.nummer} (Skonto): Zahlungsblock „Bitte überweisen Sie ${m?.[1] ?? "?"} € bis …“ mit GiroCode über den vollen Betrag; der Skontosatz steht nur im freien Hinweis (kein Skonto-Betrag, kein Skonto-Datum im Zahlungsblock).`);
  }
  if (x.r.abschlag) vergleich(`PDF ${x.nummer} (Abschlag)`, "als „Abschlagsrechnung“ betitelt", /Abschlagsrechnung 2026-014/.test(txt) ? "ja" : "Titel „Rechnung 2026-014“", "ja", "Titel kommt aus rechnungsTitel (Rechnung/Stornorechnung/Gutschrift), packages/fachlogik/src/dokumente/buchhaltung.ts:174.");
  if (x.r.schlussZu) vergleich(`PDF ${x.nummer} (Schlussrechnung)`, "Abschlag mit Steuerbetrag abgesetzt (§ 14 Abs. 5 Satz 2 UStG) – im Text vorhanden", /4\.446,00/.test(txt) ? "ja (im freien Hinweis)" : "nein", "ja (im freien Hinweis)");
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
for (const d of bau.docs.filter((y) => y.vorlage === "impressum")) {
  const txt = pdftext(path.join(OUT, "pdf", d.datei)).replace(/\s+/g, " ");
  for (const [was, re] of [["USt-IdNr.", /DE297641853/], ["Handwerkskammer Dortmund", /Handwerkskammer Dortmund/], ["Berufsbezeichnung Elektrotechnikermeister", /Elektrotechnikermeister/], ["Handwerksordnung", /Handwerksordnung/]]) vergleich("Impressum (§ 5 DDG)", `enthält ${was}`, re.test(txt) ? "ja" : "nein", "ja");
}
for (const d of bau.docs.filter((y) => y.vorlage === "pruefprotokoll_elektro")) {
  const txt = pdftext(path.join(OUT, "pdf", d.datei)).replace(/\s+/g, " ");
  infos.push(`Prüfprotokoll ${d.datei}: Richtwert laut PDF „${(/Richtwert[^.]*\./.exec(txt) ?? ["–"])[0]}“.`);
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
const q = D.ustQuartale();
const j = D.jahresSummen();
const eu = D.euerUnabhaengig();

md.push(`# Jahres-Szenario „${B.name}“ 2026`, "",
  `Erzeugt mit \`apps/mobile/werkzeuge/jahr-szenario-elektro.mjs\` am ${new Date().toISOString().slice(0, 10)} – mit den echten Funktionen der App (anlegen → felderSetzen → ausgeben/festschreiben → stornieren, kopieren, bezahltSetzen, belegSetzen, eRechnungLesen/belegAusERechnung, umsaetzeFuer (Soll), euerUebernahme, steuerpaket mit Rechnungs-PDFs, faelligAm/tageUeberfaellig/TEXT.erinnerung_text, mappenAuswahl/deckblattHtml/mappeZusammenfuegen, auswertung, dokumentHtml + Fußzeile wie in der App). Die Erwartungswerte stammen aus \`apps/mobile/werkzeuge/jahr-szenario-elektro-daten.ts\`, die nichts aus der App importiert.`, "",
  "**Neu erzeugen:** `cd packages/fachlogik && npx tsc -p tsconfig.build.json && cd ../../apps/mobile && node werkzeuge/jahr-szenario-elektro.mjs /tmp/claude-0/elektro`. Alle Namen, Anschriften, Steuer- und Kontonummern sind erfunden.", "",
  "## Betrieb", "",
  tab(["Angabe", "Wert"], [
    ["Name", `${B.name}, ${B.strasse}, ${B.plz} ${B.ort} (${B.bundesland})`],
    ["Rechtsform", `Einzelunternehmen, Inhaber ${D.INHABER.name}, ${D.INHABER.meister}; Betrieb seit ${D.de(D.GRUENDUNG)}; Handwerksrolle (Anlage A Nr. 25 HwO), Handwerkskammer Dortmund, BG ETEM`],
    ["Steuer", `StNr ${B.steuernummer}, USt-IdNr ${B.ust_idnr}, Regelbesteuerung, SOLL-Versteuerung, Voranmeldung VIERTELJÄHRLICH, EÜR; Bauleistender im Sinne des § 13b Abs. 5 Satz 2 UStG (Nachweis USt 1 TG angenommen)`],
    ["Bank", `${B.bank}, IBAN ${B.iban}, BIC ${B.bic}`], ["Kontakt", `${B.telefon}, ${B.email}, ${B.website} (Kontaktformular)`],
    ["Beschäftigte", Object.values(D.MITARBEITER).map((x) => `${x.name} (${x.taetigkeit}, seit ${D.de(x.beginn)})`).join("; ") + " – Leon Hagedorn ist 17 (Jugendlicher)"],
    ["Betriebsmittel", "Werkstatt und Lager (gemietet), Werkstattwagen DO-EB 214 (Leasing, nur betrieblich), Installationstester (Anlage 2026), eigene DGUV-V3-Prüfung"],
    ["Steuerberatung", "Steuerbüro Hagemann & Kurt (EÜR, Lohn), DATEV SKR03, Berater 41522 / Mandant 30318"],
  ]), "");

md.push("## Erzeugte Dateien", "", `Ordner: \`${OUT}\`. PNG-Ansichten jeder PDF-Seite (60 dpi) in \`png/\`. \`stand.json\` ist der komplette App-Stand am Ende.`, "");
md.push(tab(["Datei", "Seiten", "Inhalt / Eingaben"], dateien.map((x) => [`\`${x.rel}\``, seiten[x.rel] ?? "", x.inhalt])), "");
md.push("### Übersprungene Vorlagen", "", tab(["Vorlage", "Grund"], bau.uebersprungen.map((u) => [u.titel, u.grund])), "");

md.push("## Eingaben: Ausgangsrechnungen", "", "Beträge in €. Zeilen: Menge × Einzelpreis, auf Cent gerundet; USt aus der Summe je Satz. „Steuer-Q“ = Quartal, in dem die Steuer nach Gesetz entsteht (unabhängig gerechnet).", "");
md.push(tab(["Nr.", "Datum", "Leistung", "Kunde", "Art", "Netto", "USt", "Brutto", "Bezahlt", "Steuer-Q", "Was"], D.vorgaenge().map((x) => [x.nummer, D.de(x.datum), x.art === "storno" ? `Storno zu ${x.r.nummer}` : x.r.leistungText ?? D.de(x.leistung), D.KUNDEN[x.kunde].name, x.art === "storno" ? "Storno" : x.r.abschlag ? "Abschlag" : x.r.schlussZu ? "Schluss" : x.steuerart === "reverse_charge" ? "§ 13b" : x.steuerart === "nullsatz" ? "§ 12 (3)" : x.r.skonto ? `Skonto ${x.r.skonto} %` : "", e(x.vz * x.s.netto), e(x.vz * x.s.ust), e(x.vz * x.s.brutto), x.bezahlt ? D.de(x.bezahlt) : "–", D.steuerQuartal(x).q ?? "–", x.art === "storno" ? x.r.storno.grund : x.r.worum])), "");
md.push("Positionen:", "");
for (const r of D.RECHNUNGEN) md.push(`- **${r.nummer}** an ${D.KUNDEN[r.kunde].name}, Ziel ${r.ziel === "sofort" ? "sofort" : `${r.ziel} Tage`}${r.hinweise?.length ? `, Hinweise ${r.hinweise.join(", ")}` : ""}${r.befreiung ? ", Hinweis Nullsteuersatz" : ""}: ${r.pos.map((p) => `${String(p.menge).replace(".", ",")} ${p.einheit} „${p.bez}“ à ${e(p.preis)} € (${p.satz} %)`).join("; ")}`);
md.push("", `Zahlungserinnerung (Text der App, am ${D.de(bau.erinnerung.heute)}):`, "", "```", bau.erinnerung.text, "```", "");

md.push("## Eingaben: Belege", "", "„Vorsteuer“ = auf dem Beleg ausgewiesene Steuer. In die App wird der Bruttobetrag je Satz eingegeben.", "");
md.push(tab(["ID", "Datum", "Lieferant / Nr.", "Kategorie", "je Satz: netto + USt", "Brutto", "Vorsteuer", "Zahlung", "Was"], D.BELEGE.map((b) => {
  const sm = D.belegSumme(b);
  return [b.id, D.de(b.datum), `${b.lieferant}${b.nummer ? ` / ${b.nummer}` : ""}`, b.kategorie, sm.jeSatz.map((x) => `${x.satz} %: ${e(x.netto)} + ${e(x.ust)}`).join("<br>"), e(sm.brutto), b.vorsteuer ? e(sm.vorsteuer) : b.p13b ? "§ 13b (Kz 67)" : "nein", `${b.zahlung}${b.bezahlt ? `, bezahlt ${D.de(b.bezahlt)}` : ""}`, b.worum];
})), "");
md.push("## Annahmen", "", `- Löhne (Annahmen „vom Steuerbüro“): Kowalczyk 3.450 €/3.550 € ab Juli, Reinartz 3.250 €, Azubi Hagedorn 960 €/1.050 € ab August; AG-Anteile 21,35 % (BG separat). Personalkosten je Quartal: ${[1, 2, 3, 4].map((n) => `Q${n} ${e(D.personalQuartal(n))} €`).join(", ")}.`,
  `- USt-Zahllast Q4/2025 (gezahlt 12.01.2026): ${e(D.UST_Q4_2025.betrag)} €. Vorauszahlungen 2026 in Höhe der ELSTER-Zahllast (volle Euro), Zahltage ${Object.entries(D.UST_ZAHLTAGE).map(([k, v]) => `${k}: ${D.de(v)}`).join(", ")}.`,
  `- AfA Installationstester: ${e(D.belegSumme(D.BELEGE.find((b) => b.id === "b25")).netto)} € / 5 Jahre × 9/12 = **${e(eu.afa)} €** (Nutzungsdauer angenommen).`,
  "- Werkstattwagen ohne Privatnutzung (Kastenwagen, 2 Sitze); Inhaber fährt privat ein eigenes Fahrzeug – keine Entnahme.", "");

md.push("## Erwartete Kennzahlen (unabhängig gerechnet)", "", "### Umsatzsteuer-Voranmeldungen (Soll)", "", "Kz 81: steuerpflichtig 19 % (nach Skonto-Minderung); Kz 60: § 13b-Bauleistungen an Hochbau Kemper; Kz 87: PV zum Nullsteuersatz; Kz 66: Vorsteuer aus Rechnungen nach Belegdatum; Kz 84/85/67: empfangene Bauleistung (§ 13b) – Steuer = Vorsteuer.", "");
md.push(tab(["Quartal", "Rechnungen", "Kz 81 (19 %)", "davon Skonto", "Kz 60 (§ 13b)", "Kz 87 (0 %)", "Kz 66", "Kz 84 / 85 / 67", "USt gesamt", "Vorsteuer gesamt", "Zahllast exakt", "Zahllast ELSTER"], [
  ...q.map((x) => [x.q, x.nummern.join(", "), e(x.r19), e(x.skonto19), e(x.r13b), e(x.rNull), e(x.vorsteuer66), `${e(x.kz84)} / ${e(x.kz85)} / ${e(x.kz67)}`, e(x.ust), e(x.vorsteuer), e(x.zahllast), e(x.elsterZahllast)]),
  ["Jahr", "", e(j.r19), "", e(j.r13b), e(j.rNull), e(j.vorsteuer66), `${e(j.kz84)} / ${e(j.kz85)} / ${e(j.kz85)}`, e(j.ust), e(j.vorsteuer), e(j.zahllast), e(j.elsterZahllast)],
]), "");
md.push("### EÜR 2026 (Zufluss/Abfluss)", "", tab(["Posten", "Betrag €"], [
  [`Umsatzsteuerpflichtige Betriebseinnahmen netto (19 % und Nullsteuersatz; ${eu.reAnzahl} Zahlungen, Skonto abgezogen)`, e(eu.rePflichtig)],
  ["  davon Nullsteuersatz PV (2026-026)", e(eu.reNull)],
  ["Einnahmen, für die der Leistungsempfänger die USt nach § 13b schuldet", e(eu.re13b)],
  ["Vereinnahmte USt", e(eu.reUst)], ["Vom Finanzamt erstattete USt (Überschuss Q1/2026 laut ELSTER)", e(eu.ustErstattet)], ["(Skonto brutto, im Zufluss bereits abgezogen)", e(eu.skontoSumme)],
  ["**Summe Betriebseinnahmen**", `**${e(eu.einnahmen)}**`],
  ...Object.entries(eu.nachKategorie).map(([k, w]) => [`Ausgaben ${k} (${w.anzahl} Belege)`, e(w.betrag)]),
  ["Gezahlte Vorsteuer (nach Zahltag; ohne b14, bezahlt 2027)", e(eu.vorsteuer)], ["An das Finanzamt gezahlte USt (Q4/2025 + Vorauszahlungen Q2–Q3/2026)", e(eu.ustGezahlt)],
  ["**Summe Betriebsausgaben (ohne AfA)**", `**${e(eu.ausgaben)}**`], ["AfA", e(eu.afa)], ["**Gewinn**", `**${e(eu.ergebnis)}**`],
]), "");
md.push("### Steuerberater-Pakete", "", `- Q4 2026: ${pq4.buchungen} Buchungen, ${pq4.anzahl} Dateien, ${pq4.fragen} Punkte in Fragen_2026-Q4.txt.`, `- Jahr 2026: alle ${D.vorgaenge().length} Rechnungen inkl. Storno, alle ${D.BELEGE.length} Belege; ${pj.buchungen} Buchungen, ${pj.anzahl} Dateien, ${pj.fragen} Punkte in Fragen_2026.txt.`, "");

md.push("## Vergleich App ↔ unabhängige Rechnung", "", `${vergleiche.filter((x) => x.ok).length} von ${vergleiche.length} Prüfungen stimmen. Abweichungen (✗) stehen zusätzlich unter „Auffälligkeiten“.`, "");
md.push(tab(["", "Bereich", "Prüfung", "App", "erwartet"], vergleiche.map((x) => [x.ok ? "✓" : "✗", x.bereich, x.was, x.app, x.erwartet])), "");
md.push("Übernahme „Aus Rechnungen“ (Soll) je Quartal – Rohwerte der App:", "", tab(["Quartal", "Rechnungen", "davon nach Rechnungsdatum", "umsatz_19", "umsatz_7", "umsatz_frei", "vorsteuer"], bau.ust.map((u) => [u.q, u.appAnzahl, u.ersatz, u.app.umsatz_19, u.app.umsatz_7, u.app.umsatz_frei, u.app.vorsteuer])), "");
md.push("EÜR-Übernahme der App (Rohzeilen):", "", tab(["Liste", "Bezeichnung", "Zeile Anlage EÜR", "Betrag"], [...bau.euer.uebernahme.einnahmen.map((x) => ["Einnahme", x.text, x.kategorie, x.betrag]), ...bau.euer.uebernahme.ausgaben.map((x) => ["Ausgabe", x.text, x.kategorie, x.betrag])]), "", `Ergebnis der fertigen EÜR: ${bau.euer.ergebnis.map(([a, b]) => `${a} ${b}`).join(", ")}. Hinweis der Übernahme: „${bau.euer.uebernahme.hinweis}“`, "");
md.push("Kontrollmappe (Auswahl der App):", "", tab(["#", "Unterlage", "Bereich", "Datum", "geteilt", "ID"], bau.mappe.eintraege.map((x, i) => [i + 1, x.titel, x.bereich, D.de(x.datum), x.geteilt ? "ja" : "nein", x.id])), "", `Erwartet: ${bau.mappe.erwartet.join(", ")}.`, "");

md.push(`## Pflichten-Check der App (Stichtag ${D.de(bau.pflichten.stichtag)})`, "", "Profil: Handwerk (Anlage A), Einzelunternehmen, Gewerbe, NRW/Dortmund, Gründung 01.04.2014, 3 Beschäftigte (1 Azubi, 1 unter 18), Sofortmeldebranche „keine“, Lohnsteuer monatlich, keine Kasse, Website, Regelbesteuerung, Steuerberatung, Kunden B2B/B2C Inland, Vertrieb beim Kunden vor Ort, Waren und Dienstleistungen, Gefahrstoffe, elektrische Geräte, Rentenversicherung „Handwerksrolle“.", "");
md.push("### Gilt", "", tab(["Pflicht", "nächster Termin", "Termine 12 Mon.", "Vorlagen laut App", "erzeugt", "Grund laut App"], bau.pflichten.gilt.map((p) => [`${p.titel} (\`${p.id}\`)`, p.termin ? D.de(p.termin) : "–", p.termine, p.vorlagen.join(", ") || "–", p.vorlage ? (p.erzeugt ? "ja" : "**nein**") : "", p.grund])), "");
md.push("### Gründungsschritte (Betrieb läuft > 6 Monate, App stellt sie zurück)", "", tab(["Pflicht", "Vorlage", "erzeugt"], bau.pflichten.gruendung.map((p) => [`${p.titel} (\`${p.id}\`)`, p.vorlage ?? "–", p.vorlage ? (p.erzeugt ? "ja" : "nein") : ""])), "");
if (bau.pflichten.unbekannt.length) md.push("### Noch offen (App braucht weitere Antworten)", "", ...bau.pflichten.unbekannt.map((p) => `- ${p.titel}${p.fragen.length ? ` – Fragen: ${p.fragen.join(", ")}` : ""}`), "");
md.push("### Variante: zusätzlich Branche „Bau“ und Sofortmeldebranche „Bau“", "", "Kommt dazu:", "", ...(bau.pflichten.variante.neu.length ? bau.pflichten.variante.neu.map((p) => `- ${p.titel} (\`${p.id}\`) – ${p.grund}`) : ["- nichts"]), "", `Fällt weg: ${bau.pflichten.variante.weg.join(", ") || "nichts"}.`, "");

md.push("## Auffälligkeiten beim Erzeugen", "", "### Automatisch erkannt (Abweichungen gegen die unabhängige Rechnung bzw. Plausibilitätsprüfungen)", "");
md.push(...(auffaellig.length ? auffaellig.map((a) => `- ${a}`) : ["- keine"]), "");
md.push("### Fachlich festgestellt (nicht automatisch prüfbar), mit Fundstelle und Vorschlag", "", ...(BEOBACHTUNGEN.length ? BEOBACHTUNGEN.map((b) => `- ${b}`) : ["- (noch nicht gepflegt)"]), "");
md.push("## Durchsicht jeder PDF-Seite (PNG 60 dpi, von Hand)", "", ...(DURCHSICHT.length ? DURCHSICHT.map((b) => `- ${b}`) : ["- (noch nicht gepflegt)"]), "");
md.push("## Hinweise der App und weitere Informationen", "", ...infos.map((i) => `- ${i}`), `- ${kosit}`, "");
fs.writeFileSync(path.join(OUT, "SZENARIO.md"), md.join("\n"));

console.log(`${bau.docs.length} Unterlagen, ${bau.xmls.length} XRechnungen, ${bau.belegDateien.length} Belegdateien, ${pdfs.length} PDFs → ${OUT}`);
console.log(`Vergleiche: ${vergleiche.filter((x) => x.ok).length}/${vergleiche.length} ok; Auffälligkeiten: ${auffaellig.length}`);
console.log(kosit);
for (const a of auffaellig) console.log(`  - ${a}`);
