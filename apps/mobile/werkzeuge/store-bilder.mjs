/**
 * App-Store-Bilder (E-132): echte Bildschirme aus dem Web-Export mit dem Demo-Stand (werkzeuge/demo-stand.ts),
 * gesetzt auf 1290 × 2796 (iPhone 6,9″) mit Überschrift aus store/de.json. Ergebnis: <ausgabe>/store-1…6.png.
 *
 *   cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
 *   node werkzeuge/store-bilder.mjs /tmp/expo-web /tmp/store-bilder     # DUNKEL=1 für dunkle Bildschirme
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const [DIR, OUT] = process.argv.slice(2);
if (!DIR || !OUT) throw new Error("Aufruf: node werkzeuge/store-bilder.mjs <web-export> <ausgabe>");
fs.mkdirSync(OUT, { recursive: true });

// Demo-Stand mit esbuild bauen und ausführen
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const esbuild = path.join(pnpm, esbuildOrdner, "node_modules/esbuild");
const gebaut = path.join(OUT, ".demo-stand.mjs");
execFileSync(path.join(esbuild, "bin/esbuild"), [path.join(HIER, "demo-stand.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const stand = execFileSync("node", [gebaut], { encoding: "utf8" }).trim();
fs.rmSync(gebaut);
const texte = JSON.parse(fs.readFileSync(path.join(APP, "store/de.json"), "utf8"));

const srv = http.createServer((req, res) => {
  let p = path.join(DIR, decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, "index.html");
  const ext = path.extname(p);
  res.writeHead(200, { "Content-Type": ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : ext === ".ttf" ? "font/ttf" : ext === ".png" ? "image/png" : "text/html" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(4997, r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const schema = process.env.DUNKEL ? "dark" : "light";
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, colorScheme: schema, locale: "de-DE", timezoneId: "Europe/Berlin" });
await ctx.addInitScript((s) => {
  if (!localStorage.getItem("amtlos.unterlagen.v1")) localStorage.setItem("amtlos.unterlagen.v1", s);
}, stand);
const p = await ctx.newPage();
const warte = (ms = 700) => p.waitForTimeout(ms);
const knopf = (name) => p.getByRole("button", { name, exact: true }).locator("visible=true").last();
const tab = async (name) => {
  await p.getByRole("tab", { name }).click();
  await warte(900);
};
const roh = {};
const foto = async (name) => {
  roh[name] = await p.screenshot();
};

try {
  await p.goto("http://localhost:4997/");
  await warte(2500);
  await foto("pflichten");
  await p.getByRole("button", { name: /^Gefährdungsbeurteilung erstellen/ }).locator("visible=true").first().click();
  await warte(900);
  await foto("pflicht");
  await knopf("Zurück").click();
  await warte(700);
  await tab("Unterlagen");
  await foto("ablage");
  await p.getByRole("button", { name: /^Rechnung · 2026-003/ }).locator("visible=true").first().click();
  await warte(1500);
  await knopf("Vorschau groß ansehen").click();
  await warte(1800);
  await foto("rechnung");
  await knopf("Zurück").click();
  await warte(600);
  await knopf("Schließen").click();
  await warte(700);
  await tab("Vorlagen");
  await foto("vorlagen");
  await tab("Mein Betrieb");
  await foto("betrieb");
} finally {
  srv.close();
}

// Setzen: Überschrift oben, Bildschirm darunter (abgerundet, unten angeschnitten wie im Store üblich)
const schrift = (d) => `data:font/ttf;base64,${fs.readFileSync(path.join(APP, "node_modules/@expo-google-fonts/atkinson-hyperlegible", d)).toString("base64")}`;
const css = `@font-face{font-family:A;font-weight:400;src:url(${schrift("400Regular/AtkinsonHyperlegible_400Regular.ttf")})}@font-face{font-family:A;font-weight:700;src:url(${schrift("700Bold/AtkinsonHyperlegible_700Bold.ttf")})}`;
const satz = await browser.newPage({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
for (const [i, b] of texte.bilder.entries()) {
  const bild = roh[b.bildschirm];
  if (!bild) throw new Error(`Bildschirm fehlt: ${b.bildschirm}`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
  html,body{margin:0;width:1290px;height:2796px;overflow:hidden}
  body{background:linear-gradient(180deg,#136f5b 0%,#0d5143 100%);font-family:A;color:#fff;position:relative}
  .text{position:absolute;top:150px;left:110px;right:110px}
  h1{font-weight:700;font-size:104px;line-height:1.08;margin:0;letter-spacing:-1px}
  p{font-size:52px;line-height:1.3;margin:36px 0 0;color:#cfe8e0}
  .geraet{position:absolute;left:140px;right:140px;top:${b.oben ?? 760}px;border-radius:88px;padding:18px;background:#0b2f28;box-shadow:0 40px 120px rgba(0,0,0,.35)}
  .geraet img{display:block;width:100%;border-radius:72px}
  </style></head><body><div class="text"><h1>${b.titel}</h1><p>${b.text}</p></div>
  <div class="geraet"><img src="data:image/png;base64,${bild.toString("base64")}"></div></body></html>`;
  await satz.setContent(html, { waitUntil: "load" });
  await satz.screenshot({ path: path.join(OUT, `store-${i + 1}-${b.bildschirm}${schema === "dark" ? "-dunkel" : ""}.png`) });
}
await browser.close();
console.log(`✓ ${texte.bilder.length} Store-Bilder in ${OUT}`);
