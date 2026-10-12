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
await new Promise((r) => srv.listen(4998, r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const schema = process.env.DUNKEL ? "dark" : "light";
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, colorScheme: schema, locale: "de-DE" });
const p = await ctx.newPage();
const befunde = [];
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
const sichtbar = async (text) => (await p.getByText(text, { exact: false }).locator("visible=true").count()) > 0;

try {
  await p.goto("http://localhost:4998/");
  await warte(2500);
  pruefe(await sichtbar("Ausfüllen, prüfen, als PDF teilen"), "Startseite fehlt");
  pruefe(await sichtbar("Wofür brauchst du etwas?"), "Anlässe fehlen auf der Startseite");
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
  await tippe(p.getByRole("radio", { name: "Bayern" }).locator("visible=true").last());
  await foto("betrieb");
  await knopf("Zurück").click();
  await warte(800);
  pruefe(!(await sichtbar("Steht dann auf jeder Unterlage")), "Hinweis bleibt nach dem Eintragen stehen");

  // Pflichten-Check (E-126): Fragen beantworten, Ergebnis, Pflichten, Unterlage zur Pflicht
  pruefe(await sichtbar("Welche Pflichten gelten für dich?"), "Einladung zum Pflichten-Check fehlt");
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
  await warte(400);
  await radio("Ja").click(); // elektronische Kasse
  await warte(800);
  await radio("Nein").click(); // keine Website
  await warte(800);
  await radio("Nein").click(); // keine Kleinunternehmerregelung
  await warte(800);
  await feld("Wann hast du angefangen oder wann willst du anfangen?").fill("01.03.2024");
  await knopf("Weiter").click();
  await warte(1200);
  pruefe(await sichtbar("Für deinen Betrieb gelten"), "Ergebnis des Checks fehlt");
  await foto("check-ergebnis");
  await knopf("Deine Pflichten ansehen").click();
  await warte(1200);
  pruefe((await sichtbar("Hautschutzplan aushängen")) && (await sichtbar("Elektronische Kasse beim Finanzamt melden")) && !(await sichtbar("Impressum auf der Website")), "Pflichten passen nicht zum Profil (Beauty, Kasse, keine Website)");
  pruefe(await sichtbar("0 von"), "Fortschritt fehlt");
  await foto("pflichten");
  await tippe(p.getByRole("button", { name: /^Hautschutzplan aushängen/ }).locator("visible=true").last());
  await warte(900);
  pruefe(await sichtbar("TRGS 401"), "Rechtsgrundlage fehlt in der Pflicht");
  await knopf("Unterlage erstellen").click();
  await warte(900);
  pruefe(await sichtbar("Hautschutzplan"), "Unterlage zur Pflicht startet nicht");
  await knopf("Schließen").click();
  await warte(800);
  await tippe(knopf("Als erledigt markieren"));
  await warte(500);
  await knopf("Zurück").click();
  await warte(800);
  pruefe(await sichtbar("1 von"), "Abhaken zählt nicht im Fortschritt");
  await knopf("Zurück").click();
  await warte(800);
  pruefe(await sichtbar("Deine Pflichten"), "Fortschritt fehlt auf der Startseite");
  await foto("start-mit-pflichten");

  // Rechnung im geführten Ablauf
  await knopf("Rechnung schreiben").click();
  await warte(900);
  pruefe((await feld("Rechnungsnummer").inputValue()) === "2026-001" || /^\d{4}-001$/.test(await feld("Rechnungsnummer").inputValue()), "Rechnungsnummer nicht vorbelegt");
  pruefe((await p.getByRole("tab").locator("visible=true").count()) === 0, "Tab-Leiste im Ablauf sichtbar");
  await tippe(knopf("Wozu brauche ich das?"));
  await warte(800);
  pruefe(await sichtbar("§ 14 Abs. 4 UStG"), "Rechtsgrundlage fehlt unter „Wozu“");
  await knopf("Zurück").click();
  await warte(700);
  await foto("rechnung-1");
  await knopf("Weiter").click();
  await warte();
  await feld("Name oder Firma").fill("Kim Beispiel");
  await feld("Anschrift").fill("Gartenweg 3\n80333 München");
  pruefe(await sichtbar("Weitere Angaben (1)"), "seltene Felder nicht hinter „Weitere Angaben“");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("button", { name: /^Position 1/ }).locator("visible=true").last());
  await warte(800);
  await feld("Leistung oder Ware").fill("Haarschnitt");
  await feld("Menge").fill("2");
  await tippe(p.getByRole("radio", { name: "Stück" }).locator("visible=true").last());
  await feld("Einzelpreis netto (€)").fill("25");
  await foto("position");
  await knopf("Fertig").click();
  await warte(800);
  pruefe(await sichtbar("59,50"), "Rechnungsbetrag nicht gerechnet (2 × 25 € + 19 %)");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("checkbox", { name: "Vielen Dank für Ihren Auftrag." }).locator("visible=true").last());
  await knopf("Zum Dokument").click();
  await warte(1500);
  pruefe(await sichtbar("Alle Pflichtangaben sind drin."), "Rechnung trotz aller Angaben nicht vollständig");
  await foto("abschluss");
  const [fenster] = await Promise.all([ctx.waitForEvent("page"), knopf("PDF teilen").click()]);
  await fenster.waitForLoadState();
  const html = await fenster.content();
  pruefe(html.includes("Salon Sonne") && html.includes("Kim Beispiel") && html.includes("Haarschnitt") && html.includes("59,50") && html.includes("Vielen Dank für Ihren Auftrag."), "PDF-Inhalt der Rechnung unvollständig");
  await fenster.setViewportSize({ width: 794, height: 1123 });
  await fenster.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${schema}-dokument.png` });
  await fenster.close();
  await knopf("Vorschau groß ansehen").click();
  await warte(1200);
  await foto("vorschau");
  await knopf("Zurück").click();
  await warte(700);
  await knopf("Schließen").click();
  await warte(900);
  pruefe(await sichtbar("Rechnung · 2026-001"), "Rechnung fehlt unter „Zuletzt bearbeitet“");

  // zweite Rechnung: Nummer zählt hoch, gespeicherter Kunde füllt die Anschrift
  await knopf("Rechnung schreiben").click();
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
  await knopf("Rechnung schreiben").click();
  await warte(900);
  await knopf("Schließen").click();
  await warte(900);
  await p.getByRole("tab", { name: "Meine" }).click();
  await warte(800);
  pruefe((await p.getByRole("button", { name: /^Rechnung · / }).locator("visible=true").count()) === 2, "leere Rechnung nicht verworfen oder zweite fehlt");
  await p.getByRole("tab", { name: "Unterlagen" }).click();
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
  await tippe(knopf("Eigene Gefährdung hinzufügen"));
  await warte(800);
  await knopf("Fertig").click();
  await warte(800);
  pruefe((await p.getByRole("button", { name: /^Gefährdung \d/ }).locator("visible=true").count()) === 2, "leerer eigener Eintrag nicht verworfen");
  await knopf("Weiter").click();
  await warte();
  await tippe(p.getByRole("radio", { name: /keine Schutzmaßnahmen erforderlich/ }).locator("visible=true").last());
  await knopf("Weiter").click();
  await warte();
  await knopf("Zum Dokument").click();
  await warte(1200);
  pruefe(await sichtbar("Alle Pflichtangaben sind drin."), "Gefährdungsbeurteilung trotz aller Angaben nicht vollständig");
  await knopf("Schließen").click();
  await warte(800);
  await knopf("Zurück").click();
  await warte(800);

  // Mitarbeiter anlegen und in eine Unterweisung übernehmen
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  await tippe(knopf("Mitarbeiter hinzufügen"));
  await warte(800);
  await feld("Vor- und Nachname").fill("Sam Muster");
  await feld("Tätigkeit").fill("Friseur/in");
  await knopf("Fertig").click();
  await warte(800);
  pruefe(await sichtbar("Sam Muster"), "Mitarbeiter nicht gespeichert");
  pruefe(await sichtbar("Kim Beispiel"), "Kunde aus der Rechnung nicht gemerkt");
  await foto("mein-betrieb");
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(700);
  await feld("Unterlage suchen").fill("unterweisung");
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
  await feld("Unterlage suchen").fill("allergen");
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
  await feld("Unterlage suchen").fill("");

  // Neustart: Daten bleiben
  await warte(800);
  await p.reload();
  await warte(2500);
  await p.getByRole("tab", { name: "Meine" }).click();
  await warte(800);
  pruefe((await sichtbar("Gefährdungsbeurteilung · Salon")) && (await sichtbar("Allergenliste")) && (await sichtbar("Rechnung · 2026-001")) && (await sichtbar("Unterweisungsnachweis")), "Unterlagen nach Neustart verloren");
  await foto("meine");

  // bestehende Unterlage öffnet beim Abschluss; Kopie anlegen und wieder löschen
  await p.getByRole("button", { name: /^Gefährdungsbeurteilung · Salon/ }).first().click();
  await warte(1200);
  pruefe(await sichtbar("Angaben bearbeiten"), "bestehende Unterlage öffnet nicht beim Abschluss");
  await tippe(knopf("Kopie anlegen"));
  await warte(900);
  await knopf("Übersicht").click();
  await warte(900);
  await tippe(knopf("Löschen"));
  await tippe(knopf("Ja, löschen"));
  await warte(1000);
  await knopf("Schließen").click();
  await warte(900);
  pruefe((await p.getByRole("button", { name: /^Gefährdungsbeurteilung · Salon/ }).locator("visible=true").count()) === 1, "Kopie nicht angelegt oder nicht gelöscht");

  // Mein Betrieb: verschlüsselt sichern, alles löschen, wiederherstellen (E-125)
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  pruefe((await feld("Name des Betriebs").inputValue()) === "Salon Sonne", "Betrieb nach Neustart verloren");
  await tippe(knopf("Daten sichern"));
  await warte(800);
  await feld("Passwort").fill("kurz");
  pruefe(await sichtbar("Mindestens 10 Zeichen"), "kurzes Passwort nicht angemahnt");
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
  await knopf("Zurück").click();
  await warte(800);
  await tippe(knopf("Alle Daten löschen"));
  await tippe(knopf("Ja, löschen"));
  await warte(800);
  pruefe((await feld("Name des Betriebs").inputValue()) === "", "Betrieb nach „alles löschen“ nicht leer");
  pruefe(!(await sichtbar("Sam Muster")), "Mitarbeiter nach „alles löschen“ noch da");
  await p.getByRole("tab", { name: "Meine" }).click();
  await warte(800);
  pruefe(await sichtbar("Noch keine Unterlagen"), "Unterlagen nach „alles löschen“ noch da");
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
  pruefe(await sichtbar("Salon Sonne · 5 Unterlagen · 1 Mitarbeiter · 1 Kunde"), "Inhalt der Sicherung nicht angezeigt");
  await foto("wiederherstellen");
  await knopf("Jetzt wiederherstellen").click();
  await warte(1000);
  pruefe((await feld("Name des Betriebs").inputValue()) === "Salon Sonne" && (await sichtbar("Sam Muster")), "Betrieb oder Mitarbeiter nicht wiederhergestellt");
  await p.getByRole("tab", { name: "Meine" }).click();
  await warte(800);
  pruefe((await sichtbar("Gefährdungsbeurteilung · Salon")) && (await sichtbar("Rechnung · 2026-002")), "Unterlagen nicht wiederhergestellt");
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
