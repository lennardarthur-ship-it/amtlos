/**
 * Rundgang durch die App im Demo-Modus (E-119, E-120): Web-Export der App, iPhone-Format, alle Bereiche einmal –
 * Demo starten, Schnellstart, Pflichten (Angabe ergänzen), Finanzen (Angaben, Rechnung, USt, Kassen), Personal
 * (Einstellung mit Checkliste, Zeiten, Unterweisung, Schwellen), Mehr (Gründung, Fragebogen, Postfach, Melden, Team,
 * Hilfe, Einstellungen). Braucht keinen Server. Bildschirmfotos landen im Ausgabeordner; Befunde stehen am Ende.
 *
 *   cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
 *   cd apps/web && node ../mobile/e2e/rundgang.mjs /tmp/expo-web /tmp/rundgang   # DUNKEL=1 für Dunkelmodus
 * (aus apps/web, weil dort playwright-core liegt; CHROMIUM_PFAD wie bei den Web-Tests)
 */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright-core";
const [DIR, OUT] = process.argv.slice(2);
const srv = http.createServer((req, res) => { let p = path.join(DIR, decodeURIComponent(req.url.split("?")[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, "index.html"); const ext = path.extname(p); res.writeHead(200, { "Content-Type": ext === ".js" ? "text/javascript" : ext === ".ttf" ? "font/ttf" : ext === ".json" ? "application/json" : "text/html" }); fs.createReadStream(p).pipe(res); });
await new Promise((r) => srv.listen(4997, r));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/tmp/chromium", args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: process.env.DUNKEL ? "dark" : "light" })).newPage();
const fehler = [];
p.on("pageerror", (e) => fehler.push(e.message));
p.on("console", (m) => { if (m.type() === "error") fehler.push(m.text().slice(0, 200)); });
let n = 0;
const foto = async (name, voll = false) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: voll }); };
const knopf = (name) => p.getByRole("button", { name, exact: false }).last();
const tab = (name) => p.getByRole("tab", { name });
const zurueck = async () => { await p.getByRole("button", { name: "Zurück", exact: true }).last().click(); await p.waitForTimeout(500); };
const schritt = async (name, f) => { try { await f(); } catch (e) { fehler.push(`${name}: ${e.message.split("\n")[0]}`); await foto(`FEHLER-${name}`); } };

await p.goto("http://localhost:4997"); await p.waitForTimeout(2500);
await knopf("Ohne Konto ausprobieren").click(); await p.waitForTimeout(1000);
await p.getByLabel("Name des Unternehmens").fill("Lena Design");
await knopf("Unternehmen anlegen").click(); await p.waitForTimeout(1000);
for (let i = 0; i < 8; i++) {
  for (const g of await p.getByRole("radiogroup").all()) { if (!(await g.getByRole("radio", { checked: true }).count())) await g.getByRole("radio").first().click(); }
  const felder = p.locator("input"); for (let j = 0; j < await felder.count(); j++) { const f = felder.nth(j); if (!(await f.inputValue())) await f.fill("2026-09-01").catch(() => {}); }
  const fertig = p.getByRole("button", { name: "Fertig" });
  if (await fertig.count()) { await fertig.click(); break; }
  await knopf("Weiter").click(); await p.waitForTimeout(500);
}
await p.waitForTimeout(1500); await foto("heute", true);

await schritt("pflichten", async () => { await tab("Pflichten").click(); await foto("pflichten", true); });
await schritt("kalender", async () => { await knopf("Kalender").first().click(); await foto("kalender"); await zurueck(); });
await schritt("unklar", async () => { await p.getByRole("button", { name: /warten auf eine Angabe/ }).click(); await foto("unklar"); const z = p.getByRole("button", { name: /./ }).filter({ hasText: /Angabe fehlt/ }).first(); await z.click(); await p.waitForTimeout(1200); await foto("pflicht-unklar"); await knopf("Angabe ergänzen").click(); await p.waitForTimeout(1000); await foto("angabe-ergaenzen"); await p.getByLabel("Später weitermachen").click(); await p.waitForTimeout(600); await p.getByLabel("Schließen").last().click(); await p.waitForTimeout(600); await zurueck(); });

await schritt("finanzen", async () => { await tab("Finanzen").click(); await foto("finanzen", true); });
await schritt("angaben", async () => { await knopf("Angaben und Kunden").click(); await foto("angaben"); 
  const fill = async (label, wert) => p.getByLabel(label, { exact: true }).last().fill(wert);
  await fill("Straße und Hausnummer", "Torstraße 1"); await fill("PLZ", "10119"); await fill("Ort", "Berlin"); await fill("E-Mail-Adresse", "lena@example.org"); await fill("Steuernummer", "13/123/45678");
  await knopf("Angaben speichern").click(); await p.waitForTimeout(500);
  await knopf("Kunden anlegen").click(); await fill("Name", "Studio Nord"); await knopf("Kunden anlegen").click(); await p.waitForTimeout(600); await foto("angaben-gespeichert", true); await zurueck(); });
await schritt("rechnung", async () => { await p.getByRole("button", { name: /^Rechnungen/ }).last().click(); await foto("rechnungen"); await knopf("Neue Rechnung").click(); await p.waitForTimeout(800);
  await p.getByRole("radio", { name: "Studio Nord" }).click();
  await p.getByLabel("Leistungsdatum").last().fill("01.10.2026");
  await p.getByLabel("Bezeichnung").last().fill("Logo-Entwurf"); await p.getByLabel("Einzelpreis netto (€)").last().fill("850");
  await foto("rechnung-entwurf", true); await knopf("Rechnung stellen").click(); await p.waitForTimeout(1200); await foto("rechnung-gestellt", true); await zurueck(); await foto("rechnungen-liste"); await zurueck(); });
await schritt("ust", async () => { await p.getByRole("button", { name: /^Umsatzsteuer-Voranmeldung/ }).last().click(); await p.getByRole("radio").nth(1).click(); await foto("ust", true); await zurueck(); });
await schritt("kassen", async () => { await p.getByRole("button", { name: /^Kassen/ }).last().click(); await foto("kassen"); await zurueck(); });

await schritt("personal", async () => { await tab("Personal").click(); await foto("personal"); await knopf("Jemand Neues fängt an").click(); await p.waitForTimeout(600);
  await p.getByLabel("Vorname").last().fill("Tom"); await p.getByLabel("Nachname").last().fill("Teig"); await p.getByRole("radio", { name: "Minijob" }).click(); await knopf("Heute").last().click();
  await foto("person-neu"); await knopf("Erfassen").click(); await p.waitForTimeout(1500); await foto("person-checkliste", true); await zurueck(); await foto("personal-mit-team", true); });
await schritt("zeiten", async () => { await knopf("Arbeitszeiten").first().click(); await foto("zeiten"); await zurueck(); });
await schritt("unterweisung", async () => { await knopf("Unterweisungen").first().click(); await knopf("Neue Unterweisung").click(); await p.getByLabel("Thema").last().fill("Brandschutz"); await p.getByLabel("Inhalt (was wurde erklärt?)").last().fill("Fluchtwege, Feuerlöscher, Sammelplatz."); await knopf("Anlegen").click(); await p.waitForTimeout(1200); await foto("unterweisung", true); await zurueck(); await zurueck(); });
await schritt("schwellen", async () => { await knopf("Wenn dein Team wächst").first().click(); await foto("schwellen", true); await zurueck(); });

await schritt("mehr", async () => { await tab("Mehr").click(); await foto("mehr", true); });
await schritt("gruendung", async () => { await knopf("Gründung").first().click(); await foto("gruendung", true); const fb = p.getByRole("button", { name: "Fragebogen vorbereiten" }); if (await fb.count()) { await fb.click(); await foto("fragebogen", true); await zurueck(); } await zurueck(); });
await schritt("postfach", async () => { await knopf("Behördenbriefe").first().click(); await foto("postfach"); await zurueck(); });
await schritt("melden", async () => { await knopf("Änderung melden").first().click(); await foto("melden"); await zurueck(); });
await schritt("team", async () => { await p.getByRole("button", { name: /^Team/ }).last().click(); await foto("team"); await zurueck(); });
await schritt("hilfe", async () => { await knopf("Hilfe und Fachbegriffe").first().click(); await foto("hilfe"); await zurueck(); });
await schritt("einstellungen", async () => { await knopf("Einstellungen").first().click(); await foto("einstellungen", true); await zurueck(); });
await schritt("heute-ende", async () => { await tab("Heute").click(); await foto("heute-ende", true); });
console.log(fehler.length ? `BEFUNDE:\n${fehler.join("\n")}` : "ohne Befunde");
await b.close(); srv.close();
if (fehler.length) process.exit(1);
