/**
 * Rundgang durch die Unterlagen-App (E-121) über den Web-Export, Rahmen 393×852 wie iPhone, hell oder dunkel.
 * Prüft die Wege eines neuen Nutzers: Betrieb eintragen, Vorlage wählen, ausfüllen, PDF, Meine Unterlagen,
 * Neustart (Daten bleiben), Kopie, Löschen. Bildschirmfotos zur Sichtprüfung. Bricht beim ersten Befund ab.
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
  pruefe(await sichtbar("Wähle aus, was du brauchst"), "Startseite zeigt keine Auswahl");
  pruefe(await sichtbar("Betrieb eintragen"), "Hinweis „Betrieb eintragen“ fehlt bei leerem Betrieb");
  await foto("start");

  // Betrieb eintragen (aus dem Hinweis)
  await knopf("Betrieb eintragen").click();
  await warte();
  await feld("Name des Betriebs").fill("Salon Sonne");
  await feld("Ort").fill("Musterstadt");
  await feld("Inhaber/in oder verantwortliche Person").fill("Alex Muster");
  await feld("Straße und Hausnummer").fill("Hauptstraße 1");
  await feld("Steuernummer").fill("12/345/67890");
  await foto("betrieb");
  await knopf("Zurück").click();
  await warte(800);
  pruefe(!(await sichtbar("Trag einmal deinen Betrieb ein")), "Hinweis bleibt nach dem Eintragen stehen");

  // Suchen und Vorlage wählen
  await feld("Unterlage suchen").fill("gefährdung");
  await warte();
  pruefe(!(await sichtbar("Kassenbuch")), "Suche filtert nicht");
  await tippe(p.getByRole("button", { name: /^Gefährdungsbeurteilung/ }).first());
  await warte();
  pruefe(await sichtbar("§ 5 ArbSchG"), "Rechtsgrundlage fehlt auf der Vorlagenseite");
  await foto("vorlage");
  await tippe(knopf("Jetzt ausfüllen"));
  await warte(800);
  pruefe((await feld("Beurteilt von").inputValue()) === "Alex Muster", "„Beurteilt von“ nicht aus dem Betrieb vorausgefüllt");
  pruefe(await sichtbar("Fehlt noch"), "„Fehlt noch“ fehlt bei leerer Unterlage");
  await feld("Arbeitsbereich oder Gewerk").fill("Salon");
  await feld("Gefährdung").fill("Rutschgefahr durch nassen Boden");
  await feld("Maßnahme").fill("Boden nach jedem Kunden fegen");
  await p.getByRole("radio", { name: "hoch" }).locator("visible=true").last().click();
  await warte();
  await foto("formular");
  pruefe(await sichtbar("Alle Pflichtangaben ausgefüllt"), "Unterlage trotz aller Angaben nicht vollständig");
  // zweite Gefährdung: hinzufügen klappt sie auf, Entfernen nimmt sie wieder weg
  await tippe(knopf("Gefährdung hinzufügen"));
  await warte();
  pruefe(await sichtbar("Gefährdung 2 (noch leer)"), "neuer Eintrag nicht aufgeklappt");
  await tippe(knopf("Entfernen"));
  await warte();
  pruefe(await sichtbar("Alle Pflichtangaben ausgefüllt"), "Entfernen des leeren Eintrags hat nicht geklappt");

  // PDF (im Web: neues Fenster mit dem Dokument)
  const [fenster] = await Promise.all([ctx.waitForEvent("page"), knopf("PDF teilen").click()]);
  await fenster.waitForLoadState();
  const html = await fenster.content();
  pruefe(html.includes("Salon Sonne") && html.includes("Rutschgefahr durch nassen Boden") && html.includes("noch nicht fachlich geprüft"), "PDF-Inhalt unvollständig");
  await fenster.setViewportSize({ width: 794, height: 1123 });
  await fenster.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${schema}-dokument.png` });
  await fenster.close();

  // Meine Unterlagen
  await p.getByRole("tab", { name: "Meine" }).click();
  await warte(800);
  pruefe(await sichtbar("Gefährdungsbeurteilung · Salon"), "Unterlage fehlt unter „Meine“");
  await foto("meine");

  // Allergene (Mehrfachauswahl), neu aus der Startseite
  // erneutes Tippen auf den aktiven Tab führt zur Startseite zurück
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte();
  pruefe(await sichtbar("Rutschgefahr durch nassen Boden"), "Tab hat die offene Unterlage nicht behalten");
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  await feld("Unterlage suchen").fill("allergen");
  await warte();
  await tippe(p.getByRole("button", { name: /^Allergenliste/ }).first());
  await warte();
  await tippe(knopf("Jetzt ausfüllen"));
  await warte(800);
  await feld("Name").fill("Apfelkuchen");
  await p.getByRole("checkbox", { name: "Eier" }).locator("visible=true").last().click();
  await p.getByRole("checkbox", { name: "Milch (einschließlich Laktose)" }).locator("visible=true").last().click();
  await warte();
  pruefe(await p.getByRole("checkbox", { name: "Eier" }).locator("visible=true").last().isChecked(), "Allergen nicht ausgewählt");
  await foto("allergene");

  // Rechnung: Ergebnis wird gerechnet, Betrieb liefert Steuernummer
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte();
  await p.getByRole("tab", { name: "Unterlagen" }).click();
  await warte(800);
  await feld("Unterlage suchen").fill("rechnung");
  await warte();
  await tippe(p.getByRole("button", { name: /^Rechnung Rechnung mit/ }).first());
  await warte();
  await tippe(knopf("Jetzt ausfüllen"));
  await warte(800);
  await feld("Rechnungsnummer").fill("2026-001");
  await feld("Datum oder Zeitraum der Leistung").fill("Oktober 2026");
  await feld("Name oder Firma").fill("Kim Beispiel");
  await feld("Anschrift").fill("Gartenweg 3, 12345 Musterstadt");
  await feld("Leistung oder Ware").fill("Haarschnitt");
  await feld("Menge").fill("2");
  await feld("Einzelpreis netto (€)").fill("25");
  await warte();
  pruefe(await sichtbar("59,50"), "Rechnungsbetrag nicht gerechnet (2 × 25 € + 19 %)");
  pruefe(await sichtbar("Alle Pflichtangaben ausgefüllt"), "Rechnung trotz aller Angaben nicht vollständig");
  await foto("rechnung");

  // Neustart: Daten bleiben
  await warte(800);
  await p.reload();
  await warte(2500);
  await p.getByRole("tab", { name: "Meine" }).click();
  await warte(800);
  pruefe(await sichtbar("Gefährdungsbeurteilung · Salon") && (await sichtbar("Allergenliste")) && (await sichtbar("Rechnung · 2026-001")), "Unterlagen nach Neustart verloren");

  // Kopie und Löschen
  await p.getByRole("button", { name: /^Gefährdungsbeurteilung · Salon/ }).first().click();
  await warte(800);
  await tippe(knopf("Kopie anlegen"));
  await warte(800);
  await tippe(knopf("Löschen"));
  await tippe(knopf("Ja, löschen"));
  await warte(900);
  await knopf("Zurück").click();
  await warte(900);
  pruefe((await p.getByRole("button", { name: /^Gefährdungsbeurteilung · Salon/ }).locator("visible=true").count()) === 1, "Kopie nicht angelegt oder nicht gelöscht");

  // Mein Betrieb: Daten bleiben, alles löschen
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await warte(800);
  pruefe((await feld("Name des Betriebs").inputValue()) === "Salon Sonne", "Betrieb nach Neustart verloren");
  await foto("mein-betrieb");
  await tippe(knopf("Alle Daten löschen"));
  await tippe(knopf("Ja, löschen"));
  await warte(800);
  pruefe((await feld("Name des Betriebs").inputValue()) === "", "Betrieb nach „alles löschen“ nicht leer");
  await p.getByRole("tab", { name: "Meine" }).click();
  await warte(800);
  pruefe(await sichtbar("Noch keine Unterlagen"), "Unterlagen nach „alles löschen“ noch da");
  await foto("leer");
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
