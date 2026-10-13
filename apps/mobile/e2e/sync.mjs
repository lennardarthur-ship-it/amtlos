/**
 * Rundgang Synchronisation (E-134): zwei Geräte (zwei Browser-Kontexte) gegen eine lokal gestartete API.
 * Gerät A meldet sich an und richtet die Synchronisation mit einem Sync-Passwort ein; Gerät B meldet sich mit derselben
 * Kennung an, scheitert mit falschem Passwort, verbindet sich mit dem richtigen – danach haben beide Geräte die Daten
 * beider. Der Server enthält keinen Klartext. B beendet die Synchronisation, A merkt es; A löscht das Konto.
 *
 *   node e2e/sync-server.mjs &
 *   CI=1 EXPO_PUBLIC_API_URL=http://localhost:3001 npx expo export --platform web --output-dir /tmp/web-sync
 *   node e2e/sync.mjs /tmp/web-sync /tmp/bilder-sync
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../web/package.json"));
const { chromium } = require("playwright-core");
const [DIR, OUT] = process.argv.slice(2);
const API = process.env.API ?? "http://localhost:3001";
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
const befunde = [];
const KENNUNG = `e2e-${Date.now().toString(36)}`;
const PW = "sync-passwort-lang";
const SCHLUESSEL = "amtlos.unterlagen.v1";
const jetzt = new Date().toISOString();
let n = 0;

async function geraet(name, stand) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, locale: "de-DE" });
  // Startdaten nur beim ersten Laden setzen
  await ctx.addInitScript(([k, v]) => {
    if (!localStorage.getItem(k)) localStorage.setItem(k, v);
  }, [SCHLUESSEL, JSON.stringify(stand)]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => befunde.push(`${name}: Seitenfehler: ${e.message}`));
  p.on("console", (m) => {
    // erwartete Antworten des Servers (404 vor dem Einrichten, 401 nach dem Löschen) erscheinen als Netzwerkfehler
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) befunde.push(`${name}: Konsole: ${m.text().slice(0, 200)}`);
  });
  const g = {
    p,
    foto: (t) => p.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}-${t}.png` }),
    knopf: (t) => p.getByRole("button", { name: t, exact: true }).locator("visible=true").last(),
    feld: (t) => p.getByLabel(t, { exact: true }).locator("visible=true").last(),
    sichtbar: async (t) => (await p.getByText(t, { exact: false }).locator("visible=true").count()) > 0,
    stand: async () => JSON.parse(await p.evaluate((k) => localStorage.getItem(k), SCHLUESSEL)),
    async warteAuf(t, ms = 15000) {
      const bis = Date.now() + ms;
      while (Date.now() < bis) {
        if (await g.sichtbar(t)) return true;
        await p.waitForTimeout(250);
      }
      return false;
    },
  };
  await p.goto("http://localhost:4998/");
  await p.waitForTimeout(2500);
  await p.getByRole("tab", { name: "Mein Betrieb" }).click();
  await p.waitForTimeout(600);
  return g;
}
function pruefe(bed, text) {
  if (!bed) throw new Error(`Befund: ${text}`);
}
async function oeffnen(g) {
  const z = g.p.getByText("Aus – deine Daten liegen nur auf diesem Gerät", { exact: true }).locator("visible=true").last();
  await z.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await z.click();
  await g.p.waitForTimeout(700);
}

try {
  const a = await geraet("A", { version: 1, betrieb: { name: "Salon Sync", ort: "München" }, kunden: [{ id: "ka", name: "Kim von A", geaendert: jetzt }], proTest: true, zeiten: { betrieb: jetzt } });
  pruefe(await a.sichtbar("Aus – deine Daten liegen nur auf diesem Gerät"), "Zeile „Synchronisation“ fehlt unter „Mein Betrieb“");
  await a.foto("betrieb-zeile");
  await oeffnen(a);
  pruefe(await a.sichtbar("Ende-zu-Ende-verschlüsselt"), "Hinweis zur Verschlüsselung fehlt");
  await a.foto("anmelden");
  await a.feld("Kennung (Entwicklung)").fill(KENNUNG);
  await a.knopf("Anmelden").click();
  pruefe(await a.warteAuf("Sync-Passwort wählen"), "Nach der Anmeldung fehlt „Sync-Passwort wählen“");
  pruefe(await a.sichtbar(`Angemeldet als ${KENNUNG}`), "Anmeldename fehlt");
  await a.feld("Sync-Passwort").fill(PW);
  await a.feld("Passwort wiederholen").fill(PW);
  await a.foto("einrichten");
  await a.knopf("Synchronisation einrichten").click();
  pruefe(await a.warteAuf("Zuletzt synchronisiert"), "A: Synchronisation nicht an");
  await a.foto("an");

  const b = await geraet("B", { version: 1, kunden: [{ id: "kb", name: "Lu von B", geaendert: jetzt }], proTest: true });
  await oeffnen(b);
  await b.feld("Kennung (Entwicklung)").fill(KENNUNG);
  await b.knopf("Anmelden").click();
  pruefe(await b.warteAuf("Sync-Passwort eingeben"), "B: „Sync-Passwort eingeben“ fehlt (Server schon eingerichtet)");
  await b.feld("Sync-Passwort").fill("falsches-passwort-x");
  await b.knopf("Verbinden").click();
  pruefe(await b.warteAuf("Das Passwort stimmt nicht."), "B: falsches Passwort nicht erkannt");
  await b.foto("falsches-passwort");
  await b.feld("Sync-Passwort").fill(PW);
  await b.knopf("Verbinden").click();
  pruefe(await b.warteAuf("Zuletzt synchronisiert"), "B: Synchronisation nicht an");
  await b.foto("verbunden");
  const sb = await b.stand();
  pruefe(sb.betrieb.name === "Salon Sync", `B: Betrieb nicht übernommen (${sb.betrieb.name})`);
  pruefe(sb.kunden.map((k) => k.id).sort().join() === "ka,kb", `B: Kunden ${sb.kunden.map((k) => k.id)}`);
  pruefe(sb.proTest === true, "B: Gerätegebundenes (Testmodus) überschrieben");

  await a.knopf("Jetzt synchronisieren").click();
  await a.p.waitForTimeout(2500);
  const sa = await a.stand();
  pruefe(sa.kunden.map((k) => k.id).sort().join() === "ka,kb", `A: Kunden nach Sync ${sa.kunden.map((k) => k.id)}`);

  // Server: nur Chiffretext
  const tok = (await (await fetch(`${API}/v1/dev/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kennung: KENNUNG }) })).json()).token;
  const t = await (await fetch(`${API}/v1/tresor`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  pruefe(t.version >= 2 && /^\{"format":"amtlos-tresor"/.test(t.daten), `Server: kein verschlüsselter Stand (Version ${t.version})`);
  for (const geheim of ["Salon Sync", "Kim von A", "Lu von B", "München"]) pruefe(!JSON.stringify(t).includes(geheim), `Server enthält Klartext „${geheim}“`);

  // B beendet die Synchronisation → A merkt es beim nächsten Mal und hört auf
  const beenden = b.p.getByText("Synchronisation beenden", { exact: true }).locator("visible=true").last();
  await beenden.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await beenden.click();
  await b.knopf("Löschen und beenden").click();
  pruefe(await b.warteAuf("Sync-Passwort wählen"), "B: nach dem Beenden nicht wieder „einrichten“");
  pruefe((await b.stand()).kunden.length === 2, "B: Daten nach dem Beenden weg");
  await b.foto("beendet");
  const nachher = await fetch(`${API}/v1/tresor`, { headers: { Authorization: `Bearer ${tok}` } });
  pruefe(nachher.status === 404, `Server: nach dem Beenden noch Daten (${nachher.status})`);
  await a.knopf("Jetzt synchronisieren").click();
  pruefe(await a.warteAuf("Sync-Passwort wählen"), "A: hat das Beenden auf B nicht bemerkt");
  pruefe((await a.stand()).kunden.length === 2, "A: Daten nach dem Beenden weg");

  // A löscht das Konto
  const loeschen = a.p.getByText("Konto löschen", { exact: true }).locator("visible=true").last();
  await loeschen.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await loeschen.click();
  await a.foto("konto-loeschen");
  await a.knopf("Konto löschen").click();
  pruefe(await a.warteAuf("Kennung (Entwicklung)"), "A: nach dem Löschen nicht abgemeldet");
  pruefe((await a.stand()).kunden.length === 2, "A: Daten nach dem Konto-Löschen weg");
  await a.foto("konto-geloescht");

  pruefe(befunde.length === 0, befunde.join("\n"));
  console.log(`Sync-Rundgang bestanden (${n} Bildschirmfotos in ${OUT})`);
} catch (e) {
  console.error(e.message);
  if (befunde.length) console.error(befunde.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
  srv.close();
}
