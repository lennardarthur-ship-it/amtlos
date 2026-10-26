/**
 * Rundgang durch die Unterlagen-App (E-121, E-124, E-126) über den Web-Export, Rahmen 393×852 wie iPhone, hell oder dunkel.
 * Prüft die Wege eines neuen Nutzers: Betrieb eintragen, Pflichten-Check mit Ergebnis und Abhaken, Rechnung im geführten Ablauf (Nummer zählt hoch, Kunde wird
 * gemerkt), Abschluss mit Vorschau und PDF, Anlass „Sicherheit“ mit Vorschlägen, Mitarbeiter übernehmen, Neustart,
 * Kopie, Löschen, verschlüsselte Sicherung und Wiederherstellen. Bildschirmfotos zur Sichtprüfung. Bricht beim ersten Befund ab.
 * E-188: der erste Pflichten-Check ohne Pro (Bezahlschirm einmal danach, „Später“, nur die ersten 3 Pflichten), am Ende
 * der Teil ohne Pro (Neues gesperrt; erneut teilen, Storno, Kasse und Kassenbuch frei).
 * E-200: Hinweis nach dem Ende von Pro (Aufzeichnungs- und Aufbewahrungspflichten laufen weiter), „Alle Daten löschen“ erst
 * nach dem kostenlosen Export „Daten für die Betriebsprüfung“ (ZIP geprüft) und der Bestätigung, dass er gespeichert ist.
 * E-202: ein Kassensturz; der Export enthält Kassenstuerze.csv samt Feldbeschreibung (Sachentnahmen nur mit Daten).
 *
 *   cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
 *   node e2e/rundgang.mjs /tmp/expo-web /tmp/bilder        # DUNKEL=1 für Dunkelmodus, BREITE=375 für 375 pt, CHROMIUM_PFAD optional
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MARKE } from "../../../packages/marke/index.js";
import { strFromU8, unzipSync } from "fflate";

const require = createRequire(path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../web/package.json"));
const { chromium } = require("playwright-core");
const [DIR, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((req, res) => {
  let p = path.join(DIR, decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, "index.html");
  const ext = path.extname(p);
  res.writeHead(200, { "Content-Type": ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : ext === ".ttf" ? "font/ttf" : "text/html" });
  fs.createReadStream(p).pipe(res);
});
// freier Port – mehrere Rundgänge (hell, dunkel) dürfen gleichzeitig laufen
await new Promise((r) => srv.listen(Number(process.env.PORT) || 0, r));
const ADRESSE = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const schema = process.env.DUNKEL ? "dark" : "light";
// BREITE=375 für das kleine iPhone (Sichtprüfung der Bezahlschirme in 375 pt)
const ctx = await browser.newContext({ viewport: { width: Number(process.env.BREITE) || 393, height: Number(process.env.BREITE) === 375 ? 812 : 852 }, deviceScaleFactor: 2, colorScheme: schema, locale: "de-DE" });
const p = await ctx.newPage();
const befunde = [];
// Rückfragen (Löschen, Storno) sind System-Dialoge – im Rundgang bestätigen
p.on("dialog", (d) => void d.accept());
p.on("pageerror", (e) => befunde.push(`Seitenfehler: ${e.message}`));
p.on("console", (m) => {
  if (m.type() === "error") befunde.push(`Konsole: ${m.text().slice(0, 200)}`);
});
let n = 0;
const foto = async (name) => p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${schema}-${name}.png` });
const warte = (ms = 600) => p.waitForTimeout(ms);
function pruefe(bed, text) {
  if (!bed) throw new Error(`Befund: ${text}`);
}
/** Die oberste Ebene eines Stapels ist die zuletzt eingehängte; Elemente darunter sind verdeckt. */
const knopf = (name) => p.getByRole("button", { name, exact: true }).locator("visible=true").last();
const feld = (label) => p.getByLabel(label, { exact: true }).locator("visible=true").last();
/** Tippen nach Scrollen in die Mitte – sonst liegt die Tab-Leiste über Elementen am unteren Rand. */
async function tippe(l) {
  await l.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await l.click();
}
/** Eine Ebene zurück: „Zurück“ in der Leiste, auf der ersten Seite eines Blatts „Schließen“ (E-141). */
async function zurueck() {
  const z = knopf("Zurück");
  if ((await p.getByRole("button", { name: "Zurück", exact: true }).locator("visible=true").count()) > 0) await z.click();
  else await knopf("Schließen").click();
}
/** Blatt „Neu erstellen“ über den „+“-Knopf in der Tab-Leiste (E-138) */
async function neu() {
  // „+“ sitzt rechts in der Tab-Leiste; heißt wie das Blatt, das er öffnet
  if ((await p.getByRole("button", { name: "Neu erstellen", exact: true }).locator("visible=true").count()) === 0) {
    await p.getByRole("tab", { name: "Heute" }).click();
    await warte(700);
  }
  await knopf("Neu erstellen").click();
  await warte(900);
}
const sichtbar = async (text) => (await p.getByText(text, { exact: false }).locator("visible=true").count()) > 0;

try {
  await p.goto(ADRESSE);
  await warte(2500);
  // Start auf „Heute“ (E-142): Bühne mit Rechnung und Beleg, auf dem Blatt die Einladung zum Check
  pruefe((await sichtbar("Welche Pflichten kommen für dich in Frage?")) && (await p.getByRole("button", { name: "Rechnung", exact: true }).count()) > 0, "„Heute“ mit Einladung und schnellen Wegen fehlt beim Start");
  await foto("start-pflichten");
  await neu();
  await warte(800);
  pruefe(await sichtbar("Ausfüllen, prüfen, als PDF teilen"), "Startseite fehlt");
  pruefe(await sichtbar("Wofür brauchst du eine Unterlage?"), "Anlässe fehlen auf der Startseite");
  pruefe(await sichtbar("Betrieb eintragen"), "Hinweis „Betrieb eintragen“ fehlt bei leerem Betrieb");
  await foto("start");

  // Betrieb eintragen (aus der Zeile auf der Startseite)
  await p.getByRole("button", { name: /^Betrieb eintragen/ }).first().click();
  await warte();
  await feld("Name des Betriebs").fill("Salon Sonne");
  await feld("Straße und Hausnummer").fill("Hauptstraße 1");
  await feld("PLZ").fill("80331");
  await feld("Ort").fill("München");
  await feld("Inhaber/in oder verantwortliche Person").fill("Alex Muster");
  await feld("Steuernummer").fill("143/123/45678");
  // Hausfarbe gehört zu Pro (E-132): ohne Pro öffnet sich der Bezahlschirm, im Testpaket testweise einschaltbar
  await tippe(p.getByRole("radio", { name: "Bordeaux" }).locator("visible=true").last());
  await warte(800);
  pruefe((await sichtbar("Logo und Hausfarbe auf Rechnungen und Unterlagen gibt es mit Pro")) && (await sichtbar("Immer kostenlos")) && (await sichtbar("verlängert sich automatisch")), "Bezahlschirm mit Grund, Freiumfang und Abo-Hinweis fehlt");
  await foto("pro");
  await knopf("Pro testweise einschalten").click();
  await warte(900);
  pruefe(await sichtbar("Pro ist testweise an."), "keine Bestätigung nach dem Einschalten von Pro");
  await tippe(p.getByRole("radio", { name: "Bordeaux" }).locator("visible=true").last()); // Hausfarbe (E-129)
  // Bundesland auf einer eigenen Auswahlseite (E-131) – wählt und geht zurück
  await tippe(knopf("Bundesland"));
  await warte(600);
  await tippe(p.getByRole("radio", { name: "Bayern" }).locator("visible=true").last());
  await warte(600);
  pruefe((await knopf("Bundesland").textContent()).includes("Bayern"), "Bundesland nach der Auswahl nicht in der Zeile");
  await foto("betrieb");
  await zurueck();
  await warte(800);
  pruefe(!(await sichtbar("Steht dann auf jeder Unterlage")), "Hinweis bleibt nach dem Eintragen stehen");
  await knopf("Schließen").click();
  await warte(900);

  // E-188: den ersten Pflichten-Check macht ein neuer Nutzer ohne Pro – Pro (testweise) bis nach dem Ergebnis aus;
  // Logo und Hausfarbe bleiben gespeichert und stehen wieder auf der Rechnung, sobald Pro an ist
  const proSchalten = async (an) => {
    await p.getByRole("tab", { name: "Mein Betrieb" }).click();
    await warte(800);
    await tippe(p.getByRole("button", { name: new RegExp(`^(Pro ist aktiv|${MARKE.proName})`) }).locator("visible=true").first());
    await warte(900);
    // nach „Alles löschen“ ist auch der Testschalter aus – nur schalten, was nicht schon so ist
    if (an && (await knopf("Pro testweise einschalten").count()) > 0) {
      await knopf("Pro testweise einschalten").click();
      await warte(900);
      pruefe(await sichtbar("Pro ist testweise an."), "keine Bestätigung nach dem Einschalten von Pro");
      return;
    }
    if (!an && (await sichtbar("Pro testweise ausschalten"))) {
      await tippe(knopf("Pro testweise ausschalten"));
      await warte(600);
    }
    await zurueck();
    await warte(800);
  };
  await proSchalten(false);
  pruefe(await sichtbar("Pflichten-Check kostenlos – alles Weitere mit Pro"), "ohne Pro fehlt unter „Mein Betrieb“ der Hinweis, was kostenlos ist");
  // E-200: Pro war (testweise) an und ist beendet – Hinweis, dass die Aufzeichnungs- und Aufbewahrungspflichten weiterlaufen
  pruefe((await sichtbar("ist beendet. Deine Aufzeichnungs- und Aufbewahrungspflichten laufen weiter")) && (await knopf("Daten exportieren").count()) > 0, "kein Hinweis nach dem Ende von Pro (E-200)");
  await foto("pro-beendet");
  await tippe(knopf("Verstanden"));
  await warte(500);
  pruefe(!(await sichtbar("ist beendet. Deine Aufzeichnungs- und Aufbewahrungspflichten laufen weiter")), "Hinweis zum Ende von Pro lässt sich nicht wegtippen");

  // Pflichten-Check (E-126): Fragen beantworten, Ergebnis, Pflichten, Unterlage zur Pflicht
  await p.getByRole("tab", { name: "Pflichten" }).click();
  await warte(800);
  pruefe(await sichtbar("Welche Pflichten kommen für dich in Frage?"), "Einladung zum Pflichten-Check fehlt");
  // gestartet über die Karte auf „Heute“: am Ende schließt der Check und wechselt zum Tab „Pflichten“ – derselbe
  // Durchgang ändert Navigation und Tab-Zustand (früher weißer Bildschirm, React-Fehler #185)
  await p.getByRole("tab", { name: "Heute" }).click();
  await warte(800);
  await knopf("Pflichten-Check starten").click();
  await warte(800);
  // E-171: Wortlaut je nach Prüfstand des Katalogs (keine/teilweise/alle) – der Beratungs-Hinweis steht immer da
  pruefe(await sichtbar("keine Rechts- oder Steuerberatung"), "Prüfhinweis fehlt in der Einleitung des Checks");
  await foto("check-einleitung");
  await knopf("Los geht’s").click();
  await warte();
  await p.getByRole("checkbox", { name: "Beauty und Kosmetik" }).locator("visible=true").last().click();
  await knopf("Weiter").click();
  await warte(400);
  const radio = (name) => p.getByRole("radio", { name, exact: true }).locator("visible=true").last();
  await radio("Einzelunternehmen").click();
  await warte(800);
  // R12: Reihenfolge der Kernfragen ändert sich (Startdatum direkt nach der Rechtsform) – jede Frage am Inhalt erkennen
  // (Gewerbe, Bayern, 3 Beschäftigte, Kasse ja, sonst nein, Zahlen 0)
  for (let i = 0; i < 45; i++) {
    await warte(500);
    if (await sichtbar("Geschafft – dein Ergebnis steht")) break;
    const menschen = p.getByLabel("Wie viele Menschen arbeiten für dich, dich selbst nicht mitgezählt?", { exact: true }).locator("visible=true");
    if (await menschen.count()) { await menschen.last().fill("3"); await knopf("Weiter").click(); continue; }
    if (await radio("Gewerbe").count()) { await radio("Gewerbe").click(); continue; }
    if (await radio("Bayern").count()) { await radio("Bayern").click(); continue; }
    const datum = p.getByLabel("Wann hast du angefangen oder wann willst du anfangen?", { exact: true }).locator("visible=true");
    if (await datum.count()) { await datum.last().fill("01.03.2024"); await knopf("Weiter").click(); await warte(1200); continue; }
    // weitere Datumsfragen (R11, z. B. „Seit wann hast du die elektronische Kasse“)
    if (await sichtbar(/^Seit wann /)) { await p.getByRole("textbox").locator("visible=true").last().fill("01.03.2024"); await knopf("Weiter").click(); await warte(1200); continue; }
    if (await sichtbar("Wer macht die Löhne")) { await radio("Ein Lohnbüro").click(); continue; }
    const ja = p.getByRole("radio", { name: "Ja", exact: true }).locator("visible=true");
    if ((await sichtbar(/Kasse/)) && (await ja.count())) { await ja.last().click(); continue; }
    const nein = p.getByRole("radio", { name: /^Nein/ }).locator("visible=true");
    if (await nein.count()) { await nein.first().click(); continue; }
    const tb = p.getByRole("textbox").locator("visible=true");
    if (await tb.count()) { await tb.last().fill("0"); await knopf("Weiter").click(); continue; }
    const r = p.getByRole("radio").locator("visible=true");
    if (await r.count()) { await r.first().click(); continue; }
    await knopf(/Weiter|Überspringen/).click();
  }
  await warte(1200);
  // Zwischenschirm: Ergebnis steht, Zusatzfragen sind freiwillig (E-136); eine Zusatzfrage ansehen, dann überspringen
  pruefe(await sichtbar("Geschafft – dein Ergebnis steht"), "Zwischenschirm vor den Zusatzfragen fehlt");
  await foto("check-zwischen");
  // Hauptknopf ist „Ergebnis ansehen“, „Genauer machen (n Fragen)“ der Weg zu den Zusatzfragen (B6)
  await p.getByRole("button", { name: /^Genauer machen/ }).locator("visible=true").last().click();
  await warte(600);
  pruefe(await sichtbar("Genauer machen · Frage 1 von"), "Zusatzfragen ohne eigenen Fortschritt");
  pruefe((await knopf("Überspringen").count()) > 0, "ohne Antwort kein „Überspringen“");
  // E-188: ohne Pro kein „Was hast du schon?“ (der Schritt nennt viele Pflichten beim Namen) – gleich das Ergebnis
  const ergebnis = async () => (await sichtbar(/sind jetzt dran|ist jetzt dran|nichts dringend/)) && (await p.getByRole("button", { name: "Deine Pflichten ansehen", exact: true }).locator("visible=true").count()) > 0;
  for (let k = 0; k < 10 && !(await sichtbar("Was hast du schon?")) && !(await ergebnis()); k++) {
    await knopf("Überspringen").click();
    await warte(500);
  }
  pruefe(!(await sichtbar("Was hast du schon?")), "„Was hast du schon?“ ohne Pro (nennt gesperrte Pflichten beim Namen)");
  // E-188: nach dem ersten Check kurz das Ergebnis, dann einmal von selbst der Bezahlschirm darüber – „Später“
  // schließt ihn, das kostenlose Ergebnis bleibt
  await warte(2000);
  pruefe((await sichtbar(/^\d+ Pflichten kommen für dich in Frage$/)) && (await sichtbar("Immer kostenlos")) && (await sichtbar("verlängert sich automatisch")) && (await knopf("Später").count()) > 0, "Bezahlschirm nach dem ersten Pflichten-Check (mit „Später“) fehlt");
  await foto("pro-nach-check");
  await knopf("Später").click();
  await warte(1800);
  pruefe(!(await sichtbar(/^\d+ Pflichten kommen für dich in Frage$/)), "Bezahlschirm nach „Später“ nicht geschlossen oder kommt wieder");
  pruefe((await ergebnis()) && (await sichtbar(/^Insgesamt \d+ Pflichten/)), "Ergebnis des Checks fehlt (eine Hauptzahl groß, Gesamtzahl klein)");
  // R11 (Berater d): was Lohnbüro bzw. Steuerberatung macht, steht nicht unter „Mit diesen 3 fängst du an“
  pruefe(!(await sichtbar("Macht dein Lohnbüro")), "Aufgabe des Lohnbüros im Einstieg des Ergebnisses");
  // E-188: ohne Pro die ersten 3 Pflichten, die übrigen nur als Zahl
  pruefe((await sichtbar("Mit diesen 3 fängst du an")) && (await sichtbar(/^… und \d+ weitere Pflichten$/)) && (await knopf("Alle Pflichten mit Pro").count()) > 0, "Ergebnis ohne Pro: die ersten 3 Pflichten oder „… und N weitere“ fehlen");
  await foto("check-ergebnis");
  await knopf("Deine Pflichten ansehen").click();
  await warte(1200);
  pruefe(befunde.length === 0, `Fehler nach dem Check (vom Check auf „Heute“): ${befunde.join(" | ")}`);
  pruefe((await p.getByRole("tab", { name: "Pflichten", selected: true }).count()) === 1, "nach dem Check nicht im Tab „Pflichten“ gelandet");
  pruefe(!(await sichtbar(/^\d+ Pflichten kommen für dich in Frage$/)), "Bezahlschirm nach dem Check kam ein zweites Mal");
  // E-188: „Deine Pflichten“ ohne Pro – 3 Pflichten, der Rest als Zahl, kein Jahresraster; eine gesperrte öffnet den Bezahlschirm
  pruefe((await sichtbar("Deine ersten 3 Pflichten")) && (await sichtbar(/^… und \d+ weitere Pflichten$/)) && (await sichtbar("Dein Jahr mit allen Terminen – mit Pro")) && !(await sichtbar("Alle ansehen:")), "Pflichten-Tab ohne Pro zeigt mehr als die ersten 3 oder keinen Hinweis auf die übrigen");
  await foto("pflichten-frei");
  await tippe(knopf("Alle Pflichten mit Pro"));
  await warte(900);
  pruefe((await sichtbar("Alle Pflichten – mit Pro")) && (await sichtbar("verlängert sich automatisch")), "Bezahlschirm „Alle Pflichten“ fehlt");
  await zurueck();
  await warte(800);
  // der Rest des ersten Rundgangs mit Pro (testweise) – ohne Pro geht es weiter unten
  await proSchalten(true);
  await p.getByRole("tab", { name: "Pflichten" }).click();
  await warte(900);
  // Bühne (E-142): das Jahr mit den Terminen je Monat
  pruefe((await sichtbar("Dein Jahr")) && (await p.getByLabel(/: \d+ Termine?$/).count()) > 0, "Jahresblick fehlt im Pflichten-Tab");
  await foto("pflichten-jahr");
  pruefe(await sichtbar("Jetzt dran"), "„Jetzt dran“ fehlt im Pflichten-Tab");
  pruefe(await sichtbar("Kurz klären"), "„Kurz klären“ mit den wirksamsten Fragen fehlt");
  // die vollständige Liste ist eingeklappt (E-136): aufklappen
  await tippe(p.getByRole("button", { name: /^Alle ansehen: \d+ Pflichten/ }).locator("visible=true").last());
  await warte(500);
  pruefe((await sichtbar("Hautschutzplan aushängen")) && (await sichtbar("Elektronische Kasse beim Finanzamt melden")) && !(await sichtbar("Impressum auf der Website")), "Pflichten passen nicht zum Profil (Beauty, Kasse, keine Website)");
  pruefe(await sichtbar("Aus der Gründung"), "Gründungsschritte des bestehenden Betriebs nicht abgetrennt");
  pruefe(await sichtbar(/^0 von \d+/), "Fortschritt fehlt");
  await foto("pflichten");
  await tippe(p.getByRole("button", { name: /^Hautschutzplan aushängen/ }).locator("visible=true").last());
  await warte(900);
  pruefe(await sichtbar("TRGS 401"), "Rechtsgrundlage fehlt in der Pflicht");
  // E-156: mit Pro die Details (Grund, Erklärung, Grundlage, Quellen) – ohne Pro weiter unten der Hinweis darauf
  pruefe(!(await sichtbar("Mit Pro: Erklärung, Folgen, Schritte")), "Pro-Hinweis in der Pflicht trotz Pro");
  await foto("pflicht-pro");
  pruefe(await sichtbar("Drucken oder teilen, dann ist die Pflicht erledigt."), "Pflicht mit Vorlage sagt nicht, wann sie erledigt ist");
  await knopf("Ausfüllen").click();
  await warte(900);
  pruefe(await sichtbar("Hautschutzplan"), "Unterlage zur Pflicht startet nicht");
  await knopf("Schließen").click();
  await warte(800);
  await tippe(knopf("Erledigt"));
  await warte(500);
  await zurueck();
  await warte(800);
  pruefe(await sichtbar(/^1 von \d+/), "Abhaken zählt nicht im Fortschritt");
  await foto("start-mit-pflichten");

  // R12: Kassenabschluss – Betrieb mit Kasse sieht „Kasse“ auf „Heute“; Tagesabschluss in wenigen Feldern
  await p.getByRole("tab", { name: "Heute" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Kasse: Tagesabschlüsse/ }).locator("visible=true").last());
  await warte(900);
  pruefe(await sichtbar("Noch keine Tagesabschlüsse"), "Kasse ohne leeren Zustand");
  await tippe(knopf("Tagesabschluss erfassen"));
  await warte(900);
  await feld("Umsatz 19 % (brutto)").fill("238,00");
  await feld("Umsatz 7 % (brutto)").fill("107,00");
  await feld("Davon mit Karte").fill("145,00");
  await warte(300);
  pruefe(await sichtbar("Bar eingenommen (Umsatz): 200,00 €"), "Bareinnahmen werden nicht live gerechnet");
  await foto("kasse-tagesabschluss");
  await tippe(knopf("Tagesabschluss speichern"));
  await warte(1200);
  pruefe((await sichtbar("1 Tagesabschluss")) && (await sichtbar("Umsatz 19 % (brutto)")), "Tagesabschluss nicht in der Monatsübersicht");
  await foto("kasse-monat");
  await tippe(p.getByRole("button", { name: /^(Mo|Di|Mi|Do|Fr|Sa|So), \d{2}\.\d{2}\.\d{4}/ }).locator("visible=true").last());
  await warte(900);
  pruefe((await sichtbar("Korrigieren")) && !(await sichtbar("Tagesabschluss speichern")), "gespeicherter Tag ist nicht festgeschrieben");
  await zurueck();
  await warte(800);
  // E-202: ein Kassensturz (Zählprotokoll) – er gehört in den Export für die Betriebsprüfung (Kassenstuerze.csv)
  await tippe(knopf("Kassensturz jetzt"));
  await warte(900);
  await feld("Gezählter Bestand").fill("200,00");
  await feld("Gezählt von bzw. anwesend").fill("Sam Muster");
  await tippe(p.getByRole("button", { name: /^Kassensturz speichern/ }).locator("visible=true").last());
  await warte(900);
  pruefe(await sichtbar("Kassensturz gespeichert"), "Kassensturz nicht gespeichert");
  // nach dem Speichern schließt die Seite selbst; nur zurück, wenn sie noch offen ist
  if (await knopf("Kassensturz jetzt").count() === 0) {
    await zurueck();
    await warte(800);
  }
  await zurueck();
  await warte(800);
  await neu();
  await warte(800);

  // Rechnung im geführten Ablauf
  await knopf("Rechnung").click();
  await warte(900);
  pruefe((await feld("Rechnungsnummer").inputValue()) === "2026-001" || /^\d{4}-001$/.test(await feld("Rechnungsnummer").inputValue()), "Rechnungsnummer nicht vorbelegt");
  pruefe((await p.getByRole("tab").locator("visible=true").count()) === 0, "Tab-Leiste im Ablauf sichtbar");
  await tippe(knopf("Wozu brauche ich das?"));
  await warte(800);
  pruefe(await sichtbar("§ 14 Abs. 4 UStG"), "Rechtsgrundlage fehlt unter „Wozu“");
  await zurueck();
  await warte(700);
  await foto("rechnung-1");
  await knopf("Weiter").click();
  await warte();
  await feld("Name oder Firma").fill("Kim Beispiel");
  await feld("Anschrift").fill("Gartenweg 3\n80333 München");
  pruefe(await sichtbar(/Weitere Angaben \(\d+\)/), "seltene Felder nicht hinter „Weitere Angaben“");
  await knopf("Weiter").click();
  await warte();
  // R12 (UX #5): im Salon sind Bruttopreise vorbelegt und der Schalter steht sichtbar über den Positionen
  pruefe((await p.getByRole("switch", { name: "Preise inkl. Umsatzsteuer (brutto)", checked: true }).locator("visible=true").count()) > 0, "Bruttopreise im Salon nicht sichtbar vorbelegt");
  await tippe(p.getByRole("button", { name: /^Position 1/ }).locator("visible=true").last());
  await warte(800);
  await feld("Leistung oder Ware").fill("Haarschnitt");
  await feld("Menge").fill("2");
  // R12 (UX #14): Einheit im Salon „Pauschale“, in der Rechnung „2 Pauschalen“
  pruefe((await sichtbar("2 Pauschalen")) || (await p.getByRole("radio", { name: "Pauschale", checked: true }).locator("visible=true").count()) > 0, "Einheit „Pauschale“ im Salon nicht vorbelegt");
  await feld("Einzelpreis brutto (€)").fill("29,75");
  await foto("position");
  await knopf("Fertig").click();
  await warte(800);
  pruefe(await sichtbar("59,50"), "Rechnungsbetrag nicht gerechnet (2 × 29,75 € brutto)");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("checkbox", { name: "Vielen Dank für Ihren Auftrag." }).locator("visible=true").last());
  await knopf("Zur Unterlage").click();
  await warte(1500);
  pruefe(await sichtbar("Alle Pflichtangaben sind drin."), "Rechnung trotz aller Angaben nicht vollständig");
  // auf dem Papier (E-144): Positionen und Summe stehen da; Antippen springt zum Schritt und zurück
  pruefe((await sichtbar("Haarschnitt")) && (await sichtbar("2 × 29,75 €")), "Positionen fehlen auf dem Papier");
  await foto("abschluss");
  await tippe(p.getByRole("button", { name: /^Rechnungsempfänger(:| bearbeiten)/ }).locator("visible=true").last());
  await warte(800);
  pruefe((await feld("Name oder Firma").inputValue()) === "Kim Beispiel", "Antippen auf dem Papier springt nicht zum Empfänger");
  await knopf("Übersicht").click();
  await warte(900);
  const [fenster] = await Promise.all([ctx.waitForEvent("page"), knopf("PDF teilen").click()]);
  await fenster.waitForLoadState();
  const html = await fenster.content();
  pruefe(html.includes("--akzent:#702434") && html.includes('class="anschrift"') && html.includes("Amtlos Sans"), "Rechnung nicht als Geschäftsbrief in Hausfarbe mit eingebetteter Schrift (E-129)");
  pruefe(html.includes("Salon Sonne") && html.includes("Kim Beispiel") && html.includes("Haarschnitt") && html.includes("59,50") && html.includes("Vielen Dank für Ihren Auftrag."), "PDF-Inhalt der Rechnung unvollständig");
  await fenster.setViewportSize({ width: 794, height: 1123 });
  await fenster.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${schema}-dokument.png` });
  await fenster.close();
  await warte(600);
  pruefe((await sichtbar("Geteilt am")) && (await knopf("Stornieren").count()) > 0 && (await p.getByRole("button", { name: "Löschen", exact: true }).locator("visible=true").count()) === 0, "Rechnung nach dem Teilen nicht festgeschrieben");
  await foto("festgeschrieben");
  // Zahlungseingang vermerken (E-129): ändert die festgeschriebene Rechnung nicht
  await tippe(knopf("Als bezahlt markieren"));
  await warte(500);
  pruefe(await sichtbar("Bezahlt am"), "Zahlungseingang nicht vermerkt");
  // E-Rechnung (E-128): fehlen Angaben für XRechnung (hier E-Mail, Telefon, IBAN), nennt Amtlos sie statt einer ungültigen Datei
  await knopf("Als E-Rechnung teilen (XRechnung)").click();
  await warte(600);
  await foto("e-rechnung-fehlt");
  pruefe((await sichtbar("Für die E-Rechnung fehlt noch")) && (await sichtbar("E-Mail des Empfängers")) && (await sichtbar("IBAN (Mein Betrieb)")), "E-Rechnung nennt fehlende Angaben nicht");
  await warte(400);
  await knopf("Vorschau groß ansehen").click();
  await warte(1200);
  await foto("vorschau");
  await zurueck();
  await warte(700);
  await knopf("Schließen").click();
  await warte(900);
  await p.getByRole("tab", { name: "Heute" }).click();
  await warte(800);
  pruefe(await sichtbar("2026-001 · "), "Rechnung fehlt unter „Zuletzt bearbeitet“");
  // die einzige Rechnung ist bezahlt: auf der Karte „Alles bezahlt“ mit dem Umsatz des Monats statt „0,00 € offen“ (B2, E-189)
  pruefe((await sichtbar("Alles bezahlt")) && (await sichtbar("Umsatz im ")), "„Alles bezahlt“ mit Monatsumsatz fehlt auf „Heute“");
  await foto("heute");

  // zweite Rechnung (Knopf auf der Bühne): Nummer zählt hoch, gespeicherter Kunde füllt die Anschrift
  await knopf("Rechnung").click();
  await warte(900);
  pruefe((await feld("Rechnungsnummer").inputValue()) === "2026-002", "Rechnungsnummer zählt nicht hoch");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("radio", { name: "Kim Beispiel" }).locator("visible=true").last());
  pruefe((await feld("Anschrift").inputValue()).includes("Gartenweg 3"), "gespeicherter Kunde füllt die Anschrift nicht");
  await foto("kunde-gewaehlt");
  await knopf("Schließen").click();
  await warte(900);
  // dritte Rechnung sofort schließen: unveränderte neue Unterlagen verschwinden
  await knopf("Rechnung").click();
  await warte(900);
  await knopf("Schließen").click();
  await warte(900);
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  pruefe((await p.getByRole("button", { name: /2026-00\d · / }).locator("visible=true").count()) === 2, "leere Rechnung nicht verworfen oder zweite fehlt");
  await neu();
  await warte(700);

  // Anlass „Sicherheit am Arbeitsplatz“ → Gefährdungsbeurteilung mit Vorschlägen
  await tippe(p.getByRole("button", { name: /^Sicherheit am Arbeitsplatz/ }).first());
  await warte(800);
  await foto("anlass");
  await tippe(p.getByRole("button", { name: /^Gefährdungsbeurteilung/ }).locator("visible=true").last());
  await warte(900);
  pruefe((await feld("Beurteilt von").inputValue()) === "Alex Muster", "„Beurteilt von“ nicht aus dem Betrieb vorausgefüllt");
  await tippe(p.getByRole("radio", { name: "Salon" }).locator("visible=true").last());
  await foto("gefaehrdung-1");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("button", { name: /^Aus \d+ Vorschlägen wählen/ }).locator("visible=true").last());
  await warte(800);
  await p.getByRole("radio", { name: "Friseur" }).locator("visible=true").last().click();
  await warte();
  const vorschlaege = p.getByRole("checkbox").locator("visible=true");
  await tippe(vorschlaege.nth(0));
  await tippe(vorschlaege.nth(1));
  await tippe(p.getByRole("button", { name: /^Details: / }).locator("visible=true").nth(0));
  await warte(400);
  await foto("vorschlaege");
  await knopf("2 Einträge übernehmen").click();
  await warte(900);
  pruefe(await sichtbar("Ausrutschen, Stolpern und Stürzen"), "Vorschlag nicht als Gefährdung übernommen");
  // eigener Eintrag ohne Angaben verschwindet wieder
  await tippe(knopf("Gefährdung selbst hinzufügen"));
  await warte(800);
  await knopf("Fertig").click();
  await warte(800);
  pruefe((await p.getByRole("button", { name: /^Gefährdung \d/ }).locator("visible=true").count()) === 2, "leerer eigener Eintrag nicht verworfen");
  // E-167 (Sifa, Blatt „D Risikoskala“): Risiko aus Schwere × Wahrscheinlichkeit – ohne Vorbelegung, je Eintrag wählen
  for (const i of [0, 1]) {
    await tippe(p.getByRole("button", { name: /^Gefährdung \d/ }).locator("visible=true").nth(i));
    await warte(700);
    await tippe(p.getByRole("radio", { name: /^mittel \(mit Ausfallzeit\)/ }).locator("visible=true").last());
    await tippe(p.getByRole("radio", { name: "möglich", exact: true }).locator("visible=true").last());
    if (i === 0) await foto("gefaehrdung-risiko");
    await knopf("Fertig").click();
    await warte(700);
  }
  await knopf("Weiter").click();
  await warte();
  // E-167: Schritt „Prüfungen der Arbeitsmittel“ (§ 3 Abs. 6 BetrSichV) – freiwillig, hier übersprungen
  pruefe(await sichtbar("Prüfungen der Arbeitsmittel"), "Schritt „Prüfungen der Arbeitsmittel“ fehlt");
  await foto("gefaehrdung-pruefungen");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("radio", { name: /keine Schutzmaßnahmen erforderlich/ }).locator("visible=true").last());
  await knopf("Weiter").click();
  await warte();
  await knopf("Zur Unterlage").click();
  await warte(1200);
  pruefe(await sichtbar("Alle Pflichtangaben sind drin."), "Gefährdungsbeurteilung trotz aller Angaben nicht vollständig");
  // das Blatt hat sich beim Start geschlossen – nach dem Ablauf ist man wieder im Tab
  await knopf("Schließen").click();
  await warte(800);

  // Mitarbeiter anlegen und in eine Unterweisung übernehmen
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  pruefe((await sichtbar("Salon Sonne")) && (await sichtbar("Steuer und Bank")) && (await sichtbar("1 Kunde")), "Übersicht „Mein Betrieb“ fehlt (Kopf, Gruppen, Kundenzahl)");
  pruefe((await sichtbar("Pro ist aktiv")) && (await sichtbar("Impressum")) && (await sichtbar(`${MARKE.name} weiterempfehlen`)), `Pro-Status oder „Über ${MARKE.name}“ fehlt unter „Mein Betrieb“`);
  await foto("mein-betrieb");
  await tippe(p.getByRole("button", { name: /^Mitarbeiter/ }).locator("visible=true").last());
  await warte(800);
  await tippe(knopf("Mitarbeiter hinzufügen"));
  await warte(800);
  await feld("Vor- und Nachname").fill("Sam Muster");
  await feld("Tätigkeit").fill("Friseur/in");
  await knopf("Fertig").click();
  await warte(800);
  pruefe(await sichtbar("Sam Muster"), "Mitarbeiter nicht gespeichert");
  await foto("mitarbeiter");
  await zurueck();
  await warte(700);
  await tippe(p.getByRole("button", { name: /^Kunden/ }).locator("visible=true").last());
  await warte(800);
  pruefe(await sichtbar("Kim Beispiel"), "Kunde aus der Rechnung nicht gemerkt");
  await zurueck();
  await warte(700);
  await neu();
  await warte(700);
  await feld("Vorlage suchen").fill("unterweisung");
  await warte();
  await tippe(p.getByRole("button", { name: /^Unterweisungsnachweis/ }).first());
  await warte(900);
  await knopf("Weiter").click();
  await warte();
  await knopf("Weiter").click();
  await warte();
  await tippe(knopf("Mitarbeiter eintragen (1)"));
  await warte();
  pruefe(await sichtbar("Sam Muster"), "Mitarbeiter nicht als Teilnehmende übernommen");
  await foto("teilnehmende");
  await knopf("Schließen").click();
  await warte(800);

  // Allergene: Mehrfachauswahl in einem Eintrag
  await neu();
  await feld("Vorlage suchen").fill("allergen");
  await warte();
  await tippe(p.getByRole("button", { name: /^Allergenliste/ }).first());
  await warte(900);
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("button", { name: /^Gericht 1/ }).locator("visible=true").last());
  await warte(800);
  await feld("Name").fill("Apfelkuchen");
  await p.getByRole("checkbox", { name: "Eier" }).locator("visible=true").last().click();
  await p.getByRole("checkbox", { name: "Milch (einschließlich Laktose)" }).locator("visible=true").last().click();
  await warte();
  pruefe(await p.getByRole("checkbox", { name: "Eier" }).locator("visible=true").last().isChecked(), "Allergen nicht ausgewählt");
  await foto("allergene");
  await knopf("Fertig").click();
  await warte(700);
  await knopf("Schließen").click();
  await warte(800);

  // Gewerbe online anmelden – Schritt für Schritt: aus dem Abschluss des Datenblatts, Felder des GewA 1 mit „fehlt“,
  // Weg zum Portal (München → Bundesportal), Abhaken mit Tag, Sprung zurück ins Datenblatt. Fotos in 375 pt.
  await neu();
  await feld("Vorlage suchen").fill("gewerbe");
  await warte();
  await tippe(p.getByRole("button", { name: /^Gewerbeanmeldung/ }).first());
  await warte(900);
  pruefe((await feld("Vor- und Nachname").inputValue()) === "Alex Muster", "Name im Datenblatt nicht aus dem Betrieb vorbelegt");
  await feld("Geburtsort").fill("München, Deutschland");
  await knopf("Weiter").click();
  await warte();
  await feld("Angemeldete Tätigkeit").fill("Friseurhandwerk");
  await knopf("Zur Unterlage").click();
  await warte(1200);
  await tippe(p.getByRole("button", { name: /^Online anmelden – Schritt für Schritt/ }).locator("visible=true").last());
  await warte(1000);
  pruefe((await sichtbar("GewA 1 · Feld 4")) && (await sichtbar("Muster")) && (await sichtbar("Friseurhandwerk")), "Felder des GewA 1 mit den Werten fehlen");
  pruefe(await sichtbar("fehlt – im Datenblatt ergänzen"), "fehlende Angabe nicht markiert");
  pruefe((await sichtbar("Das brauchst du")) && (await sichtbar("Bundesportal")) && (await sichtbar("je nach Gemeinde")), "„Das brauchst du“ oder Bundesportal fehlt (München)");
  pruefe((await sichtbar(`${MARKE.name} übermittelt nichts an Behörden`)) && (await sichtbar("keine Rechts")), "Hinweise „übermittelt nichts“ und Rechtshinweis fehlen");
  const groesse = p.viewportSize();
  await p.setViewportSize({ width: 375, height: 812 });
  await warte(700);
  await foto("gewerbe-online-oben-375");
  await p.getByRole("button", { name: "Zum Online-Antrag", exact: true }).locator("visible=true").last().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await warte(500);
  await foto("gewerbe-online-mitte-375");
  await p.getByTestId("rechtshinweis-vorlage").locator("visible=true").last().evaluate((el) => el.scrollIntoView({ block: "end" }));
  await warte(500);
  await foto("gewerbe-online-unten-375");
  await p.setViewportSize(groesse);
  await warte(500);
  // Zum Online-Antrag: öffnet das Bundesportal (Antwort im Rundgang ersetzt, kein Netz nötig)
  await ctx.route("https://verwaltung.bund.de/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>Bundesportal</title>" }));
  const [portal] = await Promise.all([ctx.waitForEvent("page"), tippe(knopf("Zum Online-Antrag"))]);
  await portal.waitForLoadState();
  pruefe(portal.url() === "https://verwaltung.bund.de/leistungsverzeichnis/DE/leistung/99050012104000", `Online-Antrag öffnet ${portal.url()}`);
  await portal.close();
  await warte(400);
  await tippe(knopf("Erledigt markieren"));
  await warte(700);
  pruefe(await sichtbar("als erledigt vermerkt"), "Gewerbeanmeldung nicht abgehakt");
  await tippe(knopf("Haken entfernen"));
  await warte(500);
  // „Im Datenblatt ergänzen“ springt zurück in den Ablauf, zum Schritt mit dem Geburtsdatum
  await tippe(p.getByRole("button", { name: "Im Datenblatt ergänzen: Geburtsdatum", exact: true }).locator("visible=true").last());
  await warte(1000);
  pruefe((await p.getByLabel("Geburtsdatum", { exact: true }).locator("visible=true").count()) > 0, "„Im Datenblatt ergänzen“ springt nicht zum Feld");
  await knopf("Schließen").click();
  await warte(800);

  // E-Rechnung empfangen (E-133): XRechnung über die Dateiauswahl → Beleg, ausgefüllt; danach das Paket für die Steuerberatung
  const F = await import(new URL("../../../packages/fachlogik/dist/index.js", import.meta.url).href);
  const eingang = F.xrechnungUbl({ nummer: "L-2026-77", rechnungsdatum: "2026-10-08", leistungsdatum: "2026-10-08", faellig_am: "2026-10-22", steller: { name: "Friseurbedarf Müller GmbH", strasse: "Lagerweg 4", plz: "85748", ort: "Garching", land: "DE", email: "rechnung@mueller.example", telefon: "089 9", steuernummer: null, ust_idnr: "DE811111111", iban: "DE02120300000000202051" }, kunde: { name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", land: "DE", email: "info@salon.example", geschaeftskunde: true }, positionen: [{ bezeichnung: "Farbe 60 ml", menge: 10, einheit: "stueck", preis_cent: 650, ust_satz: 19 }], kleinunternehmer: false }, F.KU_HINWEIS);
  const xmlPfad = `${OUT}/eingang-xrechnung.xml`;
  fs.writeFileSync(xmlPfad, eingang);
  await neu();
  await warte(700);
  await tippe(knopf("Beleg"));
  await warte(800);
  const [xmlWahl] = await Promise.all([p.waitForEvent("filechooser"), tippe(p.getByRole("button", { name: /^Datei oder E-Rechnung/ }).locator("visible=true").last())]);
  await xmlWahl.setFiles(xmlPfad);
  await warte(1500);
  pruefe(await sichtbar("Aus der E-Rechnung übernommen"), "E-Rechnung nicht als Beleg übernommen");
  pruefe((await feld("Lieferant oder Geschäft").inputValue()) === "Friseurbedarf Müller GmbH" && (await feld("Betrag brutto (€)").inputValue()) === "77,35", "Lieferant oder Betrag aus der E-Rechnung falsch");
  await foto("beleg-erechnung");
  await knopf("Fertig").click();
  await warte(700);
  await zurueck();
  await warte(700);
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  pruefe((await sichtbar("Friseurbedarf Müller GmbH")) && (await sichtbar("Belege")), "Beleg fehlt in der Ablage");
  await foto("ablage-belege");
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Paket für die Steuerberatung/ }).locator("visible=true").last());
  await warte(800);
  await tippe(p.getByRole("radio", { name: "Jahr 2026" }).locator("visible=true").last());
  await warte(300);
  await foto("steuerberatung");
  const [paket] = await Promise.all([p.waitForEvent("download"), knopf("Paket teilen").click()]);
  const zipPfad = `${OUT}/${paket.suggestedFilename()}`;
  await paket.saveAs(zipPfad);
  const zipText = fs.readFileSync(zipPfad).toString("latin1");
  pruefe(zipText.includes("EXTF_Buchungsstapel_2026.csv") && /Belege\/(B\d{4}-\d{3}_)?2026-10-08_Friseurbedarf-Mueller-GmbH_L-2026-77\.xml/.test(zipText) && zipText.includes("Rechnungen_2026.csv"), "Paket für die Steuerberatung unvollständig");
  // dem Betrieb fehlen E-Mail, Telefon und IBAN – keine E-Rechnung im Paket, und die App sagt es
  await warte(600);
  pruefe(await sichtbar("keine E-Rechnung im Paket"), "fehlende E-Rechnung im Paket nicht gemeldet");
  await zurueck();
  await warte(700);

  // Neustart: Daten bleiben
  await warte(800);
  await p.reload();
  await warte(2500);
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  pruefe((await sichtbar("Gefährdungsbeurteilung · Salon")) && (await sichtbar("Allergenliste")) && (await sichtbar("2026-001 · ")) && (await sichtbar("Unterweisungsnachweis")), "Unterlagen nach Neustart verloren");
  await foto("meine");

  // bestehende Unterlage öffnet beim Abschluss; Kopie anlegen und wieder löschen
  await p.getByRole("button", { name: /^Gefährdungsbeurteilung · Salon/ }).first().click();
  await warte(1200);
  pruefe(await sichtbar("Zum Bearbeiten antippen"), "bestehende Unterlage öffnet nicht beim Abschluss (Papier)");
  await tippe(knopf("Kopie anlegen"));
  await warte(900);
  await knopf("Übersicht").click();
  await warte(900);
  await tippe(knopf("Löschen"));
  await warte(1000);
  await knopf("Schließen").click();
  await warte(900);
  pruefe((await p.getByRole("button", { name: /^Gefährdungsbeurteilung · Salon/ }).locator("visible=true").count()) === 1, "Kopie nicht angelegt oder nicht gelöscht");

  // Mein Betrieb: verschlüsselt sichern, alles löschen, wiederherstellen (E-125)
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Angaben zum Betrieb/ }).locator("visible=true").last());
  await warte(800);
  pruefe((await feld("Name des Betriebs").inputValue()) === "Salon Sonne", "Betrieb nach Neustart verloren");
  await zurueck();
  await warte(700);
  // „Alle Daten löschen“ ist gesperrt, solange aufbewahrungspflichtige Daten nicht exportiert sind (E-129, E-200)
  await tippe(knopf("Alle Daten löschen"));
  await warte(400);
  pruefe(await sichtbar("Exportiere zuerst die Daten für die Betriebsprüfung"), "Löschen ohne Export für die Betriebsprüfung möglich");
  await tippe(knopf("Abbrechen"));
  await warte(300);
  await tippe(knopf("Daten sichern"));
  await warte(800);
  await feld("Passwort").fill("kurz");
  pruefe(await sichtbar("Mindestens 12 Zeichen"), "kurzes Passwort nicht angemahnt");
  await feld("Passwort").fill("sonnenschein-2026");
  await feld("Passwort wiederholen").fill("sonnenschein-2026");
  await foto("sicherung");
  const [download] = await Promise.all([p.waitForEvent("download"), knopf("Sicherung erstellen").click()]);
  const sicherung = `${OUT}/${download.suggestedFilename()}`;
  await download.saveAs(sicherung);
  const inhalt = fs.readFileSync(sicherung, "utf8");
  pruefe(inhalt.includes('"AES-256-GCM"') && !inhalt.includes("Salon Sonne") && !inhalt.includes("Sam Muster") && !inhalt.includes("143/123"), "Sicherung nicht verschlüsselt oder mit Klartext");
  await warte(600);
  pruefe(await sichtbar("Sicherung erstellt."), "keine Bestätigung nach dem Sichern");
  await zurueck();
  await warte(800);
  // E-200: die Sicherung allein genügt nicht – erst der Export für die Betriebsprüfung, als gespeichert bestätigt
  await tippe(knopf("Alle Daten löschen"));
  await warte(400);
  pruefe((await sichtbar("Exportiere zuerst die Daten für die Betriebsprüfung")) && !(await knopf("Ja, löschen").count()), "Löschen nach der Sicherung ohne Export möglich (E-200)");
  await tippe(knopf("Daten für Betriebsprüfung exportieren"));
  await warte(900);
  pruefe((await sichtbar("Daten für die Betriebsprüfung")) && (await sichtbar("Kostenlos, auch ohne Pro")), "Seite „Daten für die Betriebsprüfung“ öffnet nicht");
  await foto("pruefexport");
  const [zipLaden] = await Promise.all([p.waitForEvent("download"), knopf("Exportieren").click()]);
  const pruefZip = `${OUT}/${zipLaden.suggestedFilename()}`;
  await zipLaden.saveAs(pruefZip);
  const pruefInhalt = unzipSync(new Uint8Array(fs.readFileSync(pruefZip)));
  const pruefNamen = Object.keys(pruefInhalt);
  pruefe(/Betriebspruefung/.test(zipLaden.suggestedFilename()), `Dateiname des Exports: ${zipLaden.suggestedFilename()}`);
  for (const n of ["Rechnungen.csv", "Belege.csv", "Kassenabschluesse.csv", "Kassenstuerze.csv", "Aenderungsprotokoll.csv", "Feldbeschreibung.txt"]) pruefe(pruefNamen.includes(n), `Export ohne ${n}`);
  // E-202: Kassenstürze mit Zählprotokoll und Beschreibung der Spalten; Sachentnahmen nur, wenn welche erfasst sind (hier keine – Salon)
  const sturz = strFromU8(pruefInhalt["Kassenstuerze.csv"] ?? new Uint8Array());
  const feldtext = strFromU8(pruefInhalt["Feldbeschreibung.txt"]);
  pruefe(sturz.includes("Gezählter Bestand") && sturz.includes("200,00") && sturz.includes("Sam Muster"), `Kassenstürze im Export unvollständig: ${sturz.slice(0, 200)}`);
  pruefe(feldtext.includes("Kassenstuerze.csv") && feldtext.includes("Endbestand letzter Abschluss") && !pruefNamen.includes("Sachentnahmen.csv") && !feldtext.includes("Sachentnahmen.csv"), "Feldbeschreibung ohne Kassenstürze oder mit Sachentnahmen ohne Daten");
  // der Beleg im Rundgang ist eine empfangene E-Rechnung (Original unverändert); die Rechnung an eine Privatperson hat keine XRechnung
  pruefe(pruefNamen.some((n) => n.startsWith("E-Rechnungen/eingehend/")) && strFromU8(pruefInhalt["Belege.csv"]).includes("E-Rechnungen/eingehend/"), "Export ohne empfangene E-Rechnung bzw. ohne Pfad in der Belegliste");
  pruefe(!pruefNamen.some((n) => /EXTF|stand\.json|\.pdf$/.test(n) && !n.startsWith("Belege/")), `Export enthält mehr als verlangt: ${pruefNamen.join(", ")}`);
  pruefe(strFromU8(pruefInhalt["Feldbeschreibung.txt"]).includes("Rechnungen.csv") && strFromU8(pruefInhalt["Rechnungen.csv"]).includes("2026-001"), "Feldbeschreibung oder Rechnungsliste unvollständig");
  await warte(600);
  await tippe(p.getByRole("switch", { name: "Ich habe die Datei gespeichert" }).locator("visible=true").last());
  await warte(900);
  pruefe((await sichtbar("Export vom")) && (await knopf("Ja, löschen").count()) > 0, "nach dem bestätigten Export kein „Ja, löschen“ (E-200)");
  await foto("loeschen-nach-export");
  await tippe(knopf("Ja, löschen"));
  await warte(800);
  pruefe(await sichtbar("Betrieb eintragen"), "Betrieb nach „alles löschen“ nicht leer");
  pruefe(!(await sichtbar("1 Person")), "Mitarbeiter nach „alles löschen“ noch da");
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  pruefe(await sichtbar("Noch nichts abgelegt"), "Unterlagen nach „alles löschen“ noch da");
  await foto("leer");
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  await tippe(knopf("Sicherung wiederherstellen"));
  await warte(800);
  const [auswahl] = await Promise.all([p.waitForEvent("filechooser"), knopf("Sicherungsdatei auswählen").click()]);
  await auswahl.setFiles(sicherung);
  await warte(800);
  await feld("Passwort").fill("falsches-passwort");
  await knopf("Öffnen").click();
  await warte(1500);
  pruefe(await sichtbar("Das Passwort passt nicht"), "falsches Passwort nicht erkannt");
  await feld("Passwort").fill("sonnenschein-2026");
  await knopf("Öffnen").click();
  await warte(2500);
  pruefe(await sichtbar("Salon Sonne · 6 Unterlagen · 1 Beleg · 1 Kassenabschluss · 1 Mitarbeiter · 1 Kunde"), "Inhalt der Sicherung nicht angezeigt");
  pruefe(await sichtbar("Nichts Neueres geht verloren"), "Zusammenführen statt Ersetzen nicht erklärt");
  await foto("wiederherstellen");
  await knopf("Jetzt wiederherstellen").click();
  await warte(1000);
  pruefe((await sichtbar("Salon Sonne")) && (await sichtbar("1 Person")), "Betrieb oder Mitarbeiter nicht wiederhergestellt");
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  pruefe((await sichtbar("Gefährdungsbeurteilung · Salon")) && (await sichtbar("2026-002 · ")) && (await sichtbar("Friseurbedarf Müller GmbH")), "Unterlagen oder Belege nicht wiederhergestellt");

  // E-188 (Modell Check-Teaser): ohne Pro nur die ersten 3 Pflichten; Neues (Rechnung, Beleg, Vorlage, Kopie, Kassentag)
  // öffnet den Bezahlschirm mit Anlass; eigene Daten bleiben: erneut teilen, stornieren, Kasse und Kassenbuch ansehen
  // und teilen. Vorher noch mit Pro die Allergenliste teilen – danach endet Pro.
  await proSchalten(true);
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Allergenliste/ }).locator("visible=true").first());
  await warte(1200);
  const [mitProPdf] = await Promise.all([ctx.waitForEvent("page"), knopf("PDF teilen").click()]);
  await mitProPdf.waitForLoadState();
  pruefe((await mitProPdf.content()).includes("Apfelkuchen"), "PDF der Allergenliste (mit Pro) unvollständig");
  await mitProPdf.close();
  await warte(600);
  await knopf("Schließen").click();
  await warte(900);
  await proSchalten(false);
  pruefe(await sichtbar("Pflichten-Check kostenlos – alles Weitere mit Pro"), "ohne Pro fehlt unter „Mein Betrieb“ der Hinweis, was kostenlos ist");
  const bezahlschirm = async (titel, name) => {
    await warte(900);
    pruefe((await sichtbar(titel)) && (await sichtbar("Immer kostenlos")) && (await sichtbar("verlängert sich automatisch")), `Bezahlschirm „${titel}“ fehlt`);
    await foto(name);
  };

  // Pflicht ohne Pro: eine der ersten 3 – Überblick, Termin bzw. Stand und Abhaken; Details als Hinweis, Rechtshinweis bleibt
  await p.getByRole("tab", { name: "Pflichten" }).click();
  await warte(900);
  pruefe((await sichtbar("Deine ersten 3 Pflichten")) && (await sichtbar(/^… und \d+ weitere Pflichten$/)), "Pflichten ohne Pro (nach dem Ende von Pro): erste 3 oder „… und N weitere“ fehlen");
  await tippe(p.getByText("Deine ersten 3 Pflichten", { exact: true }).locator("visible=true").last().locator("xpath=following::*[@role='button'][1]"));
  await warte(900);
  pruefe((await sichtbar("Mit Pro: Erklärung, Folgen, Schritte")) && (await sichtbar("keine Rechts- oder Steuerberatung")), "freie Pflicht ohne Pro: Hinweis auf die Details oder Rechtshinweis fehlt");
  pruefe((await sichtbar("Haken entfernen")) || (await sichtbar("Erledigt")) || (await sichtbar(/^Als erledigt/)), "freie Pflicht ohne Pro lässt sich nicht abhaken");
  await foto("pflicht-frei");
  await tippe(knopf("Mit Pro ansehen"));
  await bezahlschirm("Jede Pflicht erklärt – mit Pro", "pro-pflicht");
  await zurueck();
  await warte(700);
  await zurueck();
  await warte(800);

  // Erinnerungen: der Schalter für Mitteilungen öffnet den Bezahlschirm
  const erinnern = p.getByRole("switch", { name: /An Fristen erinnern/ }).locator("visible=true").last();
  await erinnern.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await warte(300);
  await foto("erinnerung-frei");
  await erinnern.click();
  await bezahlschirm("Erinnerung vor jeder Frist – mit Pro", "pro-erinnerungen");
  await zurueck();
  await warte(800);

  // Neues anlegen nur mit Pro: Rechnung und Beleg von „Heute“ aus, eine Vorlage aus dem Katalog – kein leerer Entwurf
  await p.getByRole("tab", { name: "Heute" }).click();
  await warte(800);
  await knopf("Rechnung").click();
  await bezahlschirm("Rechnungen schreiben – mit Pro", "pro-rechnung");
  await zurueck();
  await warte(800);
  await knopf("Beleg").click();
  await bezahlschirm("Belege erfassen – mit Pro", "pro-beleg");
  await zurueck();
  await warte(800);
  pruefe(!(await sichtbar("Rechnungsnummer")), "ohne Pro wurde trotzdem eine Rechnung angelegt");

  // Vorlagen: eine schon geteilte teilt man immer wieder; ein vorhandener Entwurf bleibt, sein PDF gehört zu Pro
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Allergenliste/ }).locator("visible=true").first());
  await warte(1200);
  pruefe((await knopf("PDF teilen").count()) > 0 && !(await sichtbar("PDF teilen · Pro")), "geteilte Vorlage lässt sich ohne Pro nicht erneut teilen");
  await foto("vorlage-erneut");
  const [vorlagePdf] = await Promise.all([ctx.waitForEvent("page"), knopf("PDF teilen").click()]);
  await vorlagePdf.waitForLoadState();
  pruefe((await vorlagePdf.content()).includes("Apfelkuchen"), "erneut geteiltes PDF der Vorlage unvollständig");
  await vorlagePdf.close();
  await warte(600);
  await knopf("Schließen").click();
  await warte(900);
  await tippe(p.getByRole("button", { name: /^Gefährdungsbeurteilung · Salon/ }).locator("visible=true").first());
  await warte(1200);
  pruefe((await sichtbar("Als PDF teilen und drucken gehört zu Pro")) && (await knopf("PDF teilen · Pro").count()) > 0 && (await sichtbar("Zum Bearbeiten antippen")), "vorhandener Entwurf ohne Pro: Hinweis, „PDF teilen · Pro“ oder Bearbeiten fehlt");
  await foto("vorlage-pro");
  await knopf("PDF teilen · Pro").click();
  await bezahlschirm("Alle Vorlagen – mit Pro", "pro-vorlage");
  const auswegVorlage = p.getByRole("button", { name: "Als Entwurf behalten", exact: true }).locator("visible=true").last();
  pruefe((await auswegVorlage.count()) > 0, "Ausweg „Als Entwurf behalten“ fehlt auf dem Bezahlschirm des Entwurfs");
  await auswegVorlage.click();
  await warte(900);
  pruefe((await sichtbar("Zum Bearbeiten antippen")) && (await knopf("PDF teilen · Pro").count()) > 0, "nach „Als Entwurf behalten“ nicht zurück beim Entwurf");
  await knopf("Schließen").click();
  await warte(900);

  // Rechnung 2026-001 (mit Pro geteilt): erneut teilen frei (ohne Hausfarbe), E-Rechnung und Kopie mit Pro, Storno immer
  await tippe(p.getByRole("button", { name: /2026-001 · / }).locator("visible=true").first());
  await warte(1200);
  pruefe((await knopf("PDF teilen").count()) > 0 && !(await sichtbar("PDF teilen · Pro")), "geteilte Rechnung lässt sich ohne Pro nicht erneut teilen");
  const [rechnungPdf] = await Promise.all([ctx.waitForEvent("page"), knopf("PDF teilen").click()]);
  await rechnungPdf.waitForLoadState();
  const rechnungHtml = await rechnungPdf.content();
  pruefe(rechnungHtml.includes("Haarschnitt") && !rechnungHtml.includes("--akzent:#702434"), "Rechnung ohne Pro nicht erneut geteilt oder mit Hausfarbe (Briefkopf gehört zu Pro)");
  await rechnungPdf.close();
  await warte(600);
  await foto("rechnung-erneut");
  await knopf("Als E-Rechnung teilen (XRechnung) · Pro").click();
  await bezahlschirm("E-Rechnung für Firmenkunden – mit Pro", "pro-e-rechnung");
  await zurueck();
  await warte(700);
  await tippe(knopf("Kopie anlegen · Pro"));
  await bezahlschirm("Rechnungen schreiben – mit Pro", "pro-kopie");
  await zurueck();
  await warte(700);
  await tippe(knopf("Stornieren"));
  await warte(1500);
  pruefe((await knopf("PDF teilen").count()) > 0 && !(await sichtbar("PDF teilen · Pro")), "Storno ohne Pro nicht frei teilbar (GoBD)");
  const [stornoPdf] = await Promise.all([ctx.waitForEvent("page"), knopf("PDF teilen").click()]);
  await stornoPdf.waitForLoadState();
  pruefe((await stornoPdf.content()).includes("Haarschnitt"), "Storno-PDF ohne Pro unvollständig");
  await stornoPdf.close();
  await warte(800);
  await foto("storno-frei");
  for (let k = 0; k < 5 && (await p.getByRole("tab", { name: "Unterlagen" }).locator("visible=true").count()) === 0; k++) {
    await knopf("Schließen").click();
    await warte(900);
  }

  // Kasse (E-188): erfasste Tage und ihr Kassenbuch bleiben ohne Pro sichtbar und teilbar, neue Tage mit Pro
  await p.getByRole("tab", { name: "Heute" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Kasse: Tagesabschlüsse/ }).locator("visible=true").last());
  await warte(900);
  pruefe((await sichtbar("1 Tagesabschluss")) && (await sichtbar("Neue Tagesabschlüsse erfasst du mit Pro")) && (await knopf("Tagesabschluss erfassen · Pro").count()) > 0, "Kasse ohne Pro: erfasster Tag, Hinweis oder „Tagesabschluss erfassen · Pro“ fehlt");
  await foto("kasse-frei");
  await tippe(p.getByRole("button", { name: /^(Mo|Di|Mi|Do|Fr|Sa|So), \d{2}\.\d{2}\.\d{4}/ }).locator("visible=true").last());
  await warte(900);
  pruefe((await sichtbar("Korrigieren")) && (await sichtbar("Umsatz 19 % (brutto)")), "erfasster Kassentag ohne Pro nicht zu öffnen oder nicht korrigierbar");
  await zurueck();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Kassenbuch .* ansehen$/ }).locator("visible=true").last());
  await warte(1200);
  const [kassenbuch] = await Promise.all([ctx.waitForEvent("page"), knopf("Kassenbuch teilen").click()]);
  await kassenbuch.waitForLoadState();
  const kassenbuchHtml = await kassenbuch.content();
  fs.writeFileSync(`${OUT}/kassenbuch-ohne-pro.html`, kassenbuchHtml);
  pruefe(kassenbuchHtml.includes("Kassenbuch") && kassenbuchHtml.includes("Tageseinnahmen bar") && kassenbuchHtml.includes("200,00"), "Kassenbuch ohne Pro nicht teilbar oder unvollständig");
  await kassenbuch.close();
  await warte(800);
  await zurueck();
  await warte(800);
  await tippe(knopf("Tagesabschluss erfassen · Pro"));
  await bezahlschirm("Kasse und Kassenbuch – mit Pro", "pro-kasse");
  await zurueck();
  await warte(700);
  await zurueck();
  await warte(800);

  // Kontrollmappe: die Mappe gehört zu Pro, jede Unterlage öffnet einzeln (Auge)
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Kontrollmappe/ }).locator("visible=true").first());
  await warte(1000);
  pruefe((await sichtbar("Die Mappe in einem PDF gehört zu Pro")) && (await p.getByRole("button", { name: /^Allergenliste.* öffnen$/ }).locator("visible=true").count()) > 0, "Kontrollmappe ohne Pro: Hinweis oder Weg zur einzelnen Unterlage fehlt");
  await foto("kontrollmappe-frei");
  await tippe(p.getByRole("button", { name: /^Allergenliste.* öffnen$/ }).locator("visible=true").first());
  await warte(1200);
  pruefe((await knopf("PDF teilen").count()) > 0, "Unterlage aus der Kontrollmappe öffnet nicht oder ist ohne Pro nicht teilbar");
  await knopf("Schließen").click();
  await warte(900);
  await tippe(p.getByRole("button", { name: /^Mappe (mit \d+ Unterlagen? )?teilen · Pro$/ }).locator("visible=true").last());
  await bezahlschirm("Kontrollmappe in einem PDF – mit Pro", "pro-kontrollmappe");
  await zurueck();
  await warte(700);
  await zurueck();
  await warte(800);

  // Paket für die Steuerberatung
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  await tippe(p.getByRole("button", { name: /^Paket für die Steuerberatung/ }).locator("visible=true").last());
  await warte(800);
  await knopf("Paket teilen · Pro").click();
  await bezahlschirm("Paket für die Steuerberatung – mit Pro", "pro-steuerberatung");
  await zurueck();
  await warte(700);
  await zurueck();
  await warte(700);
  if (befunde.length) throw new Error(befunde.join("\n"));
  console.log(`✓ Rundgang ${schema} ohne Befunde (${n} Bilder in ${OUT})`);
} catch (e) {
  await foto("befund").catch(() => undefined);
  console.error(e.message);
  if (befunde.length) console.error(befunde.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
  srv.close();
}
