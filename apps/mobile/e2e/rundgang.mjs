/**
 * Rundgang durch die Unterlagen-App (E-121, E-124, E-126) über den Web-Export, Rahmen 393×852 wie iPhone, hell oder dunkel.
 * Prüft die Wege eines neuen Nutzers: Betrieb eintragen, Pflichten-Check mit Ergebnis und Abhaken, Rechnung im geführten Ablauf (Nummer zählt hoch, Kunde wird
 * gemerkt), Abschluss mit Vorschau und PDF, Anlass „Sicherheit“ mit Vorschlägen, Mitarbeiter übernehmen, Neustart,
 * Kopie, Löschen, verschlüsselte Sicherung und Wiederherstellen. Bildschirmfotos zur Sichtprüfung. Bricht beim ersten Befund ab.
 *
 *   cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
 *   node e2e/rundgang.mjs /tmp/expo-web /tmp/bilder        # DUNKEL=1 für Dunkelmodus, CHROMIUM_PFAD optional
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

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
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, colorScheme: schema, locale: "de-DE" });
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
  pruefe((await sichtbar("Welche Pflichten gelten für dich?")) && (await p.getByRole("button", { name: "Rechnung", exact: true }).count()) > 0, "„Heute“ mit Einladung und schnellen Wegen fehlt beim Start");
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

  // Pflichten-Check (E-126): Fragen beantworten, Ergebnis, Pflichten, Unterlage zur Pflicht
  await p.getByRole("tab", { name: "Pflichten" }).click();
  await warte(800);
  pruefe(await sichtbar("Welche Pflichten gelten für dich?"), "Einladung zum Pflichten-Check fehlt");
  // gestartet über die Karte auf „Heute“: am Ende schließt der Check und wechselt zum Tab „Pflichten“ – derselbe
  // Durchgang ändert Navigation und Tab-Zustand (früher weißer Bildschirm, React-Fehler #185)
  await p.getByRole("tab", { name: "Heute" }).click();
  await warte(800);
  await knopf("Pflichten-Check starten").click();
  await warte(800);
  pruefe(await sichtbar("noch nicht von Fachleuten geprüft"), "Prüfhinweis fehlt in der Einleitung des Checks");
  await foto("check-einleitung");
  await knopf("Los geht’s").click();
  await warte();
  await p.getByRole("checkbox", { name: "Beauty und Kosmetik" }).locator("visible=true").last().click();
  await knopf("Weiter").click();
  await warte(400);
  const radio = (name) => p.getByRole("radio", { name, exact: true }).locator("visible=true").last();
  await radio("Einzelunternehmen").click();
  await warte(800);
  await radio("Gewerbe").click();
  await warte(800);
  await radio("Bayern").click();
  await warte(800);
  await feld("Wie viele Menschen arbeiten für dich, dich selbst nicht mitgezählt?").fill("3");
  await knopf("Weiter").click();
  // Fragen nach der Zahl der Beschäftigten (R10: Minijob, Löhne, Social Media …) der Reihe nach beantworten (Kasse ja, sonst nein, Zahlen 0)
  for (let i = 0; i < 30; i++) {
    await warte(500);
    if (await sichtbar("Geschafft – dein Ergebnis steht")) break;
    const datum = p.getByLabel("Wann hast du angefangen oder wann willst du anfangen?", { exact: true }).locator("visible=true");
    if (await datum.count()) { await datum.last().fill("01.03.2024"); await knopf("Weiter").click(); await warte(1200); continue; }
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
  // der Pflichten-Tab darunter zeigt schon „Für deinen Betrieb gelten …“ – das Ende des Checks erkennt man am Knopf
  const amEnde = async () => (await p.getByRole("button", { name: "Deine Pflichten ansehen", exact: true }).locator("visible=true").count()) > 0;
  for (let k = 0; k < 10 && !(await amEnde()); k++) {
    await knopf("Überspringen").click();
    await warte(500);
  }
  pruefe((await amEnde()) && (await sichtbar("Für deinen Betrieb:")) && (await sichtbar(/^Insgesamt \d+ Pflichten/)), "Ergebnis des Checks fehlt (bald Anstehendes groß, Gesamtzahl klein)");
  await foto("check-ergebnis");
  await knopf("Deine Pflichten ansehen").click();
  await warte(1200);
  pruefe(befunde.length === 0, `Fehler nach „Deine Pflichten ansehen“ (vom Check auf „Heute“): ${befunde.join(" | ")}`);
  pruefe((await p.getByRole("tab", { name: "Pflichten", selected: true }).count()) === 1, "nach dem Check nicht im Tab „Pflichten“ gelandet");
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
  pruefe(await sichtbar("0 von"), "Fortschritt fehlt");
  await foto("pflichten");
  await tippe(p.getByRole("button", { name: /^Hautschutzplan aushängen/ }).locator("visible=true").last());
  await warte(900);
  pruefe(await sichtbar("TRGS 401"), "Rechtsgrundlage fehlt in der Pflicht");
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
  pruefe(await sichtbar("1 von"), "Abhaken zählt nicht im Fortschritt");
  await foto("start-mit-pflichten");
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
  await tippe(p.getByRole("button", { name: /^Position 1/ }).locator("visible=true").last());
  await warte(800);
  await feld("Leistung oder Ware").fill("Haarschnitt");
  await feld("Menge").fill("2");
  await feld("Einzelpreis netto (€)").fill("25");
  await foto("position");
  await knopf("Fertig").click();
  await warte(800);
  pruefe(await sichtbar("59,50"), "Rechnungsbetrag nicht gerechnet (2 × 25 € + 19 %)");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("checkbox", { name: "Vielen Dank für Ihren Auftrag." }).locator("visible=true").last());
  await knopf("Zur Unterlage").click();
  await warte(1500);
  pruefe(await sichtbar("Alle Pflichtangaben sind drin."), "Rechnung trotz aller Angaben nicht vollständig");
  // auf dem Papier (E-144): Positionen und Summe stehen da; Antippen springt zum Schritt und zurück
  pruefe((await sichtbar("Haarschnitt")) && (await sichtbar("2 × 25,00 €")), "Positionen fehlen auf dem Papier");
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
  // die einzige Rechnung ist bezahlt: statt „0,00 € offen“ steht der Umsatz des Monats groß da (B2)
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
  pruefe((await sichtbar("Pro ist aktiv")) && (await sichtbar("Impressum")) && (await sichtbar("Amtlos weiterempfehlen")), "Pro-Status oder „Über Amtlos“ fehlt unter „Mein Betrieb“");
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
  // „Alle Daten löschen“ ist gesperrt, solange geteilte Rechnungen nicht gesichert sind (E-129)
  await tippe(knopf("Alle Daten löschen"));
  await warte(400);
  pruefe(await sichtbar("Erstelle zuerst eine Sicherung"), "Löschen trotz ungesicherter Rechnungen möglich");
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
  await tippe(knopf("Alle Daten löschen"));
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
  pruefe(await sichtbar("Salon Sonne · 5 Unterlagen · 1 Beleg · 1 Mitarbeiter · 1 Kunde"), "Inhalt der Sicherung nicht angezeigt");
  pruefe(await sichtbar("Nichts Neueres geht verloren"), "Zusammenführen statt Ersetzen nicht erklärt");
  await foto("wiederherstellen");
  await knopf("Jetzt wiederherstellen").click();
  await warte(1000);
  pruefe((await sichtbar("Salon Sonne")) && (await sichtbar("1 Person")), "Betrieb oder Mitarbeiter nicht wiederhergestellt");
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  pruefe((await sichtbar("Gefährdungsbeurteilung · Salon")) && (await sichtbar("2026-002 · ")) && (await sichtbar("Friseurbedarf Müller GmbH")), "Unterlagen oder Belege nicht wiederhergestellt");
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
