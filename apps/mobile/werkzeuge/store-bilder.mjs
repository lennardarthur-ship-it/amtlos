/**
 * App-Store-Bilder (E-132): echte Bildschirme aus dem Web-Export mit dem Demo-Stand (werkzeuge/demo-stand.ts),
 * gesetzt auf 1290 × 2796 (iPhone 6,9″) mit Überschrift aus store/de.json, in der Reihenfolge von `bilder`.
 * Ergebnis: <ausgabe>/store-1…6-<bildschirm>.png.
 *
 * Optional je Bild `lupe: { x, y, b, h }` (Anteile des Bildschirms): vergrößert diesen Ausschnitt desselben echten
 * Bildschirms als Lupe über dem Gerät – z. B. Summe und GiroCode der Rechnung, die in A4-Verkleinerung unlesbar wären.
 *
 * Zusätzlich (nur hell) die Bilder der Website: <website>/<bildschirm>.jpg (464 × 1006, passend zu width/height in
 * apps/website/seite.html) und <website>/og.jpg (1200 × 630, Vorschaubild für geteilte Links). Standard für <website>
 * ist apps/website/bilder; WEBSITE=0 schaltet das ab.
 *
 *   cd apps/mobile && CI=1 npx expo export --platform web --output-dir /tmp/expo-web
 *   node werkzeuge/store-bilder.mjs /tmp/expo-web /tmp/store-bilder [website]   # DUNKEL=1 für dunkle Bildschirme
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
const [DIR, OUT, WEB_ARG] = process.argv.slice(2);
if (!DIR || !OUT) throw new Error("Aufruf: node werkzeuge/store-bilder.mjs <web-export> <ausgabe> [website-bilder]");
const WEB = process.env.DUNKEL || process.env.WEBSITE === "0" ? null : path.resolve(WEB_ARG ?? path.join(APP, "../website/bilder"));
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
  await p.getByRole("button", { name: /2026-003 · / }).locator("visible=true").first().click();
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
const png = (name) => `data:image/png;base64,${roh[name].toString("base64")}`;

// Lupe: derselbe echte Bildschirm, Ausschnitt vergrößert (Breite der Lupe 1130 px, mittig über dem Gerät)
const lupeHtml = (name, l, oben) => {
  const breite = 1130;
  const faktor = breite / l.b; // Bildschirmbreite in px der Lupe
  const hoehe = Math.round(faktor * l.h * (852 / 393));
  return `<div class="lupe" style="top:${oben}px;width:${breite}px;height:${hoehe}px;background-image:url(${png(name)});background-size:${Math.round(faktor)}px auto;background-position:${Math.round(-l.x * faktor)}px ${Math.round(-l.y * faktor * (852 / 393))}px"></div>`;
};

const satz = await browser.newPage({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
for (const [i, b] of texte.bilder.entries()) {
  if (!roh[b.bildschirm]) throw new Error(`Bildschirm fehlt: ${b.bildschirm}`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
  html,body{margin:0;width:1290px;height:2796px;overflow:hidden}
  body{background:linear-gradient(180deg,#136f5b 0%,#0d5143 100%);font-family:A;color:#fff;position:relative}
  .text{position:absolute;top:150px;left:110px;right:110px}
  h1{font-weight:700;font-size:104px;line-height:1.08;margin:0;letter-spacing:-1px}
  p{font-size:52px;line-height:1.3;margin:36px 0 0;color:#cfe8e0}
  .geraet{position:absolute;left:140px;right:140px;top:${b.oben ?? 760}px;border-radius:88px;padding:18px;background:#0b2f28;box-shadow:0 40px 120px rgba(0,0,0,.35)}
  .geraet img{display:block;width:100%;border-radius:72px}
  .lupe{position:absolute;left:80px;border-radius:40px;border:10px solid #fff;background-color:#fff;background-repeat:no-repeat;box-shadow:0 40px 100px rgba(0,0,0,.45)}
  </style></head><body><div class="text"><h1>${b.titel}</h1><p>${b.text}</p></div>
  <div class="geraet"><img src="${png(b.bildschirm)}"></div>${b.lupe ? lupeHtml(b.bildschirm, b.lupe, 1500) : ""}</body></html>`;
  await satz.setContent(html, { waitUntil: "load" });
  await satz.screenshot({ path: path.join(OUT, `store-${i + 1}-${b.bildschirm}${schema === "dark" ? "-dunkel" : ""}.png`) });
}

// Website: dieselben Bildschirme als JPG (464 × 1006) und ein Vorschaubild für geteilte Links (1200 × 630)
if (WEB) {
  fs.mkdirSync(WEB, { recursive: true });
  const web = await browser.newPage({ viewport: { width: 464, height: 1006 }, deviceScaleFactor: 1 });
  for (const name of Object.keys(roh)) {
    await web.setContent(`<!doctype html><html><body style="margin:0"><img src="${png(name)}" style="display:block;width:464px;height:1006px"></body></html>`, { waitUntil: "load" });
    await web.screenshot({ path: path.join(WEB, `${name}.jpg`), type: "jpeg", quality: 82 });
  }
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const titel = texte.bilder[0].titel;
  await og.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:linear-gradient(180deg,#136f5b 0%,#0d5143 100%);font-family:A;color:#fff;position:relative}
  .text{position:absolute;left:72px;top:96px;width:600px}
  .marke{font-weight:700;font-size:34px;color:#cfe8e0;letter-spacing:.5px}
  h1{font-weight:700;font-size:68px;line-height:1.08;margin:24px 0 0;letter-spacing:-1px}
  p{font-size:30px;line-height:1.35;margin:28px 0 0;color:#cfe8e0}
  .geraet{position:absolute;left:760px;top:70px;width:372px;border-radius:44px;padding:10px;background:#0b2f28;box-shadow:0 30px 80px rgba(0,0,0,.35)}
  .geraet img{display:block;width:100%;border-radius:36px}
  </style></head><body><div class="text"><div class="marke">Amtlos</div><h1>${titel}</h1><p>Pflichten-Check, Rechnungen und über 30 Vorlagen für kleine Betriebe – auf dem iPhone.</p></div>
  <div class="geraet"><img src="${png(texte.bilder[0].bildschirm)}"></div></body></html>`, { waitUntil: "load" });
  await og.screenshot({ path: path.join(WEB, "og.jpg"), type: "jpeg", quality: 85 });
}
await browser.close();
console.log(`✓ ${texte.bilder.length} Store-Bilder in ${OUT}${WEB ? `, Website-Bilder in ${WEB}` : ""}`);
