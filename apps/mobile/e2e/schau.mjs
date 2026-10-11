/**
 * Bildschirmfotos der App über den Web-Export (Expo Web), Rahmen 393×852 wie iPhone.
 * Zweck: Design prüfen ohne Simulator (E-117). Kein Test, keine Behauptung über iOS-Darstellung.
 *
 *   cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
 *   cd apps/web && CHROMIUM_PFAD=/tmp/chromium node ../mobile/e2e/schau.mjs /tmp/expo-web /tmp/bilder <kennung|demo>   # DUNKEL=1 für Dunkelmodus
 *   Mit „demo“ statt einer Kennung läuft alles über den Demo-Modus (E-119), ohne API.
 *
 * Erwartet die API auf :3901 (siehe docs/07); Anfragen an :3001 werden mit CORS weitergereicht.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const DIR = process.argv[2];
const OUT = process.argv[3];
const KENNUNG = process.argv[4] ?? "app-schau";
const srv = http.createServer((req, res) => {
  let p = path.join(DIR, decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, "index.html");
  const ext = path.extname(p);
  res.writeHead(200, { "Content-Type": ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : ext === ".ttf" ? "font/ttf" : "text/html" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(4999, r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/tmp/chromium", headless: true, args: ["--no-sandbox"] });
const schema = process.env.DUNKEL ? "dark" : "light";
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, colorScheme: schema, locale: "de-DE" });
const p = await ctx.newPage();
await p.route("http://localhost:3001/**", async (route) => {
  const req = route.request();
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  try {
    const kopf = {};
    for (const [k, v] of Object.entries(req.headers())) if (["authorization", "content-type", "x-unternehmen-id", "x-sprache", "accept"].includes(k)) kopf[k] = v;
    const r = await fetch(req.url().replace("localhost:3001", "localhost:3901"), { method: req.method(), headers: kopf, body: req.method() === "GET" ? undefined : req.postData() });
    await route.fulfill({ status: r.status, headers: { ...cors, "content-type": r.headers.get("content-type") ?? "application/json" }, body: Buffer.from(await r.arrayBuffer()) });
  } catch (e) {
    console.log("Proxy-Fehler", req.method(), req.url(), e.message);
    await route.abort();
  }
});
p.on("pageerror", (e) => console.log("Seitenfehler:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("Konsole:", m.text().slice(0, 200)); });
await p.goto("http://localhost:4999/");
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/app-${schema}-anmelden.png` });
if (KENNUNG === "demo") await p.getByRole("button", { name: "Ohne Konto ausprobieren" }).click();
else {
  await p.getByLabel("Kennung").fill(KENNUNG);
  await p.getByRole("button", { name: "Anmelden" }).click();
}
await p.waitForTimeout(3500);
await p.screenshot({ path: `${OUT}/app-${schema}-heute.png`, fullPage: true });
for (const [tab, name] of [["Pflichten", "pflichten"], ["Stempeln", "stempeln"], ["Beleg", "beleg"], ["Mehr", "mehr"]]) {
  await p.getByRole("tab", { name: tab }).click();
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${OUT}/app-${schema}-${name}.png`, fullPage: true });
}
await p.getByRole("tab", { name: "Heute" }).click();
await p.waitForTimeout(1500);
const frag = p.locator('[role="button"]').filter({ hasText: "Kurze Nachfragen" }).first();
if (await frag.count()) { await frag.click(); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/app-${schema}-nachfragen.png` }); await p.getByLabel("Später weitermachen").click(); await p.waitForTimeout(800); }
const karte = p.locator('[role="button"]').filter({ hasText: "Ansehen und erledigen" }).first();
if (await karte.count()) { await karte.click(); await p.waitForTimeout(2000); await p.screenshot({ path: `${OUT}/app-${schema}-pflicht.png`, fullPage: true }); }
await browser.close(); srv.close();
