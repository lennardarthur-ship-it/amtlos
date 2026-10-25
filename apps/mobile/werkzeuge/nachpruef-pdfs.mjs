/**
 * E-196: Beispiel-PDFs der geänderten Varianten für die Nachprüflisten. Je Freigabe in geprueft.ts werden die
 * Variantengruppen verglichen (freigegebene Teilsumme ↔ heute, pruefvarianten.ts); für jede geänderte Gruppe druckt das
 * Werkzeug die Ausprägung „alles ausgewählt“ dieser Gruppe (bei Rechtsformen der erfundene Beispielbetrieb, bei der
 * Rechnung das Storno einer Schlussrechnung mit Abschlägen auf dem Startstand mit gefüllten Listen) – gedruckt wie die App
 * (A4, Ränder je Gestalt, eingebettete Schriften, Fußzeile; Chromium wie werkzeuge/vorlagen-beispiele.mjs). Ablage je
 * Rolle: <ziel>/<rolle>/vorlagen/<vorlage>-<variante>.pdf, dazu varianten.json (Prüfsummen je Gruppe freigegeben/heute).
 * Unveränderte Varianten bekommen kein PDF: Für sie gilt die Freigabe weiter.
 *
 *   node werkzeuge/nachpruef-pdfs.mjs ../../docs/freigabe-katalog/versand-2026-10-25-nachpruefung
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
if (!process.argv[2]) {
  console.error("Aufruf: node werkzeuge/nachpruef-pdfs.mjs <zielordner>");
  process.exit(2);
}
const ZIEL = path.resolve(process.argv[2]);

const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const esbuild = path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild");
const eintrag = `export * from "${path.resolve(APP, "../../packages/fachlogik/src/dokumente/index.ts")}";
export { mitSchriften } from "${path.join(APP, "src/unterlagen/schriften.ts")}";
export { fussAngaben, fusszeileStempeln } from "${path.join(APP, "src/unterlagen/fusszeile.ts")}";`;
const quelle = path.join(ZIEL, ".nachpruef-eintrag.ts");
const gebaut = path.join(ZIEL, ".nachpruef.mjs");
fs.mkdirSync(ZIEL, { recursive: true });
fs.writeFileSync(quelle, eintrag);
execFileSync(esbuild, [quelle, "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const F = await import(gebaut);
fs.rmSync(quelle);
fs.rmSync(gebaut);

const DATEI = { "rf:GmbH & Co. KG": "gmbh-co-kg", "rf:UG (haftungsbeschränkt) & Co. KG": "ug-co-kg", storno_schluss: "storno-schlussrechnung", storno: "storno", schlussrechnung: "schlussrechnung", basis: "gemeinsamer-teil", ku: "kleinunternehmer" };
const NAME = { "rf:GmbH & Co. KG": "GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG": "UG (haftungsbeschränkt) & Co. KG", storno_schluss: "Storno einer Schlussrechnung mit Abschlägen", basis: "gemeinsamer Teil (alle Betriebe)" };
const slug = (g) => DATEI[g] ?? g.replace(/^(rf|land):/, "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "");

const MM = 72 / 25.4;
const px = (mm) => `${(Math.round(mm * MM) * 4) / 3}px`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
const liste = {};
let zahl = 0;
for (const id of Object.keys(F.VORLAGEN_GEPRUEFT)) {
  const v = F.vorlageFuer(id);
  for (const [i, f] of F.freigabenFuer(id).entries()) {
    const k = i ? `${id}#${i}` : id;
    const heute = F.PRUEFSTAENDE[k].teile;
    const frei = f.teilsummen ?? {};
    const geaendert = Object.keys(heute).filter((g) => frei[g] !== heute[g]);
    if (!geaendert.length) continue;
    const ordner = path.join(ZIEL, f.rolle, "vorlagen");
    fs.mkdirSync(ordner, { recursive: true });
    const aus = F.vorlagenAuspraegungen(v, f);
    const name = `${id}${f.fassung ? `-${f.fassung.wert}` : ""}`;
    for (const g of geaendert) {
      // „alles ausgewählt“ der Gruppe: die letzte Ausprägung (bei Rechtsformen das Paar Start/voll, bei eigenen Gruppen der Startstand mit Listen)
      const a = aus.filter((x) => x.gruppe === g).at(-1);
      if (!a) continue;
      const html = F.mitSchriften(F.dokumentHtml(v, a.d, a.b));
      const ang = F.fussAngaben(html);
      const [o, r, u, l] = F.RAENDER[ang.gestalt] ?? F.RAENDER.nachweis;
      await page.setContent(html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({ format: "A4", landscape: !!v.querformat, margin: { top: px(o), right: px(r), bottom: px(u), left: px(l) }, printBackground: true });
      const datei = `${name}-${slug(g)}.pdf`;
      fs.writeFileSync(path.join(ordner, datei), await F.fusszeileStempeln(new Uint8Array(pdf), ang));
      (liste[f.rolle] ??= {})[datei] = { vorlage: id, titel: v.titel, ...(f.fassung ? { fassung: f.fassung.wert } : {}), variante: NAME[g] ?? g, teilsumme_freigegeben: frei[g] ?? null, teilsumme_heute: heute[g], unveraendert: Object.keys(heute).filter((x) => frei[x] === heute[x]).length, varianten: Object.keys(heute).length };
      zahl++;
    }
  }
}
await browser.close();
for (const [rolle, l] of Object.entries(liste)) {
  fs.writeFileSync(path.join(ZIEL, rolle, "vorlagen", "varianten.json"), `${JSON.stringify({ hinweis: "E-196: nur die seit der Freigabe geänderten Varianten (Beispielbetriebe mit erfundenen Angaben). Alle übrigen Varianten sind unverändert.", pdfs: l }, null, 2)}\n`);
  console.log(`${rolle}: ${Object.keys(l).length} PDFs`);
}
console.log(`${zahl} PDFs in ${ZIEL}`);
