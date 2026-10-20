/**
 * App-Store-Bilder (E-132): echte Bildschirme aus dem Web-Export mit dem Demo-Stand (werkzeuge/demo-stand.ts),
 * gesetzt auf 1290 × 2796 (iPhone 6,9″) mit Überschrift aus store/de.json, in der Reihenfolge von `bilder`.
 * Ergebnis: <ausgabe>/store-1…6-<bildschirm>.png.
 *
 * Über jedem Bildschirm steht eine Statusleiste wie auf dem iPhone (9:41, volles Netz, WLAN, voller Akku) in der Farbe
 * der obersten Bildzeile – der Web-Export hat keine; ohne sie wirkt der Bildschirm abgeschnitten.
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
  // erste Pflicht unter „Als Nächstes“ auf „Heute“ (welche das ist, hängt vom Tag ab)
  // nur Pflichten („In 7 Tagen fällig“, „Heute fällig“ …), nicht die überfällige Rechnung („seit 3 Tagen fällig“)
  await p.getByRole("button", { name: /In \d+ Tagen fällig|Heute fällig|Morgen fällig|Seit .* überfällig|Nächster Termin/ }).locator("visible=true").first().click();
  await warte(900);
  await foto("pflicht");
  await knopf("Schließen").click();
  await warte(700);
  await tab("Unterlagen");
  await foto("ablage");
  await p.getByRole("button", { name: /2026-003 · / }).locator("visible=true").first().click();
  await warte(1500);
  await knopf("Vorschau groß ansehen").click();
  await warte(1800);
  await foto("rechnung");
  await knopf("Schließen").click();
  await warte(600);
  await knopf("Schließen").click();
  await warte(700);
  await knopf("Neu erstellen").click(); // „+“ in der Tab-Leiste
  await warte(1000);
  await foto("vorlagen");
  await knopf("Schließen").click();
  await warte(700);
  await tab("Mein Betrieb");
  await foto("betrieb");
} finally {
  srv.close();
}

// Setzen: Überschrift oben, Bildschirm darunter (abgerundet, unten angeschnitten wie im Store üblich)
// dieselbe Schrift wie die App (E-139): Onest, Überschrift extrafett
const schrift = (d) => `data:font/ttf;base64,${fs.readFileSync(path.join(APP, "node_modules/@expo-google-fonts/onest", d)).toString("base64")}`;
const css = `@font-face{font-family:A;font-weight:400;src:url(${schrift("400Regular/Onest_400Regular.ttf")})}@font-face{font-family:A;font-weight:600;src:url(${schrift("600SemiBold/Onest_600SemiBold.ttf")})}@font-face{font-family:S;font-weight:800;src:url(${schrift("800ExtraBold/Onest_800ExtraBold.ttf")})}`;
const png = (name) => `data:image/png;base64,${roh[name].toString("base64")}`;

// Lupe: derselbe echte Bildschirm, Ausschnitt vergrößert (Breite der Lupe 1130 px, mittig über dem Gerät)
const lupeHtml = (name, l, oben) => {
  const breite = 1130;
  const faktor = breite / l.b; // Bildschirmbreite in px der Lupe
  const hoehe = Math.round(faktor * l.h * (852 / 393));
  return `<div class="lupe" style="top:${oben}px;width:${breite}px;height:${hoehe}px;background-image:url(${png(name)});background-size:${Math.round(faktor)}px auto;background-position:${Math.round(-l.x * faktor)}px ${Math.round(-l.y * faktor * (852 / 393))}px"></div>`;
};

/**
 * iOS-Statusleiste (B16): 9:41 links, rechts Netz, WLAN und voller Akku – weiß auf der grünen Bühne, dunkel auf hellem
 * Grund. Höhe 54 pt wie beim iPhone mit Dynamic Island, in Bildschirm-Pixeln der Aufnahme (3×); skaliert mit dem Bild.
 */
const statusleiste = (breite) => {
  const f = breite / (393 * 3); // Pixel der Aufnahme → Pixel im Satz
  const px = (n) => Math.round(n * 3 * f);
  return `<div class="status" style="height:${px(54)}px;padding:0 ${px(34)}px 0 ${px(52)}px;font-size:${px(17)}px">
    <span style="font-family:S;font-weight:800;letter-spacing:-.2px">9:41</span>
    <span style="display:flex;gap:${px(6)}px;align-items:center">
      <svg width="${px(19)}" height="${px(12)}" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="currentColor"/><rect x="5.2" y="5.5" width="3.2" height="6.5" rx="1" fill="currentColor"/><rect x="10.4" y="3" width="3.2" height="9" rx="1" fill="currentColor"/><rect x="15.6" y="0" width="3.2" height="12" rx="1" fill="currentColor"/></svg>
      <svg width="${px(17)}" height="${px(12)}" viewBox="0 0 17 12"><path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5l1.2-1.2C14 1.7 11.4.6 8.5.6S3 1.7 1 3.6l1.2 1.2C3.9 3.2 6.1 2.3 8.5 2.3zm0 3.4c1.5 0 2.9.6 4 1.6l1.2-1.2C12.3 4.8 10.5 4 8.5 4S4.7 4.8 3.3 6.1l1.2 1.2c1.1-1 2.5-1.6 4-1.6zm0 3.4c.6 0 1.2.2 1.7.6L8.5 11.4 6.8 9.7c.5-.4 1.1-.6 1.7-.6z" fill="currentColor"/></svg>
      <svg width="${px(27)}" height="${px(13)}" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill="currentColor" fill-opacity=".45"/></svg>
    </span></div>`;
};
// Farbe der obersten Bildzeile → Grund der Statusleiste; Schrift hell oder dunkel je nach Helligkeit
const statusFarbe = `<script>document.querySelectorAll(".schirm").forEach((s)=>{const i=s.querySelector("img");const los=()=>{const c=document.createElement("canvas");c.width=i.naturalWidth;c.height=4;const x=c.getContext("2d");x.drawImage(i,0,0);const [r,g,b]=x.getImageData(Math.round(i.naturalWidth/2),1,1,1).data;const st=s.querySelector(".status");st.style.background="rgb("+r+","+g+","+b+")";st.style.color=(0.299*r+0.587*g+0.114*b)>150?"#0c1f18":"#fff"};i.complete?los():i.onload=los})</script>`;

const satz = await browser.newPage({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
for (const [i, b] of texte.bilder.entries()) {
  if (!roh[b.bildschirm]) throw new Error(`Bildschirm fehlt: ${b.bildschirm}`);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
  html,body{margin:0;width:1290px;height:2796px;overflow:hidden}
  body{background:#063b29;font-family:A;color:#fff;position:relative}
  .text{position:absolute;top:150px;left:110px;right:110px}
  h1{font-family:S;font-weight:800;font-size:104px;line-height:1.04;margin:0;letter-spacing:-3px}
  p{font-size:52px;line-height:1.3;margin:36px 0 0;color:#7fe3b8}
  .geraet{position:absolute;left:140px;right:140px;top:${b.oben ?? 760}px;border-radius:88px;padding:16px;background:linear-gradient(#f4f7f5,#cfd9d4);box-shadow:0 0 0 3px rgba(255,255,255,.18),0 50px 140px rgba(0,0,0,.45)}
  .schirm{border-radius:72px;overflow:hidden}
  .status{display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;font-family:A;font-weight:600}
  .geraet img{display:block;width:100%}
  .lupe{position:absolute;left:80px;border-radius:40px;border:10px solid #fff;background-color:#fff;background-repeat:no-repeat;box-shadow:0 40px 100px rgba(0,0,0,.45)}
  </style></head><body><div class="text"><h1>${b.titel}</h1><p>${b.text}</p></div>
  <div class="geraet"><div class="schirm">${statusleiste(1290 - 280 - 32)}<img src="${png(b.bildschirm)}"></div></div>${b.lupe ? lupeHtml(b.bildschirm, b.lupe, 1500) : ""}${statusFarbe}</body></html>`;
  await satz.setContent(html, { waitUntil: "load" });
  await satz.waitForTimeout(150);
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
  body{background:#063b29;font-family:A;color:#fff;position:relative}
  .text{position:absolute;left:72px;top:96px;width:600px}
  .marke{font-weight:600;font-size:34px;color:#7fe3b8;letter-spacing:.5px}
  h1{font-family:S;font-weight:800;font-size:66px;line-height:1.04;margin:24px 0 0;letter-spacing:-2px}
  p{font-size:30px;line-height:1.35;margin:28px 0 0;color:#7fe3b8}
  .geraet{position:absolute;left:760px;top:70px;width:372px;border-radius:44px;padding:8px;background:linear-gradient(#f4f7f5,#cfd9d4);box-shadow:0 0 0 2px rgba(255,255,255,.18),0 30px 80px rgba(0,0,0,.45)}
  .geraet img{display:block;width:100%;border-radius:36px}
  </style></head><body><div class="text"><div class="marke">Amtlos</div><h1>${titel}</h1><p>Pflichten-Check, Rechnungen und über 30 Vorlagen für kleine Betriebe – auf dem iPhone.</p></div>
  <div class="geraet"><img src="${png(texte.bilder[0].bildschirm)}"></div></body></html>`, { waitUntil: "load" });
  await og.screenshot({ path: path.join(WEB, "og.jpg"), type: "jpeg", quality: 85 });
}
await browser.close();
console.log(`✓ ${texte.bilder.length} Store-Bilder in ${OUT}${WEB ? `, Website-Bilder in ${WEB}` : ""}`);
