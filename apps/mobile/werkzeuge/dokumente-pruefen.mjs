/**
 * Satzspiegel-Prüfung der Dokumentvorlagen (E-130): erzeugt jede Vorlage aus @amtlos/fachlogik zweimal – mit den
 * Startwerten („leer“) und mit vollen Listen und langen Angaben („voll“) –, druckt sie wie die App (A4, Ränder je
 * Gestalt aus RAENDER, eingebettete Schriften, Fußzeile von fusszeile.ts) mit Chromium und meldet:
 *   - Elemente, die über den Satzspiegel ragen (würden abgeschnitten oder ließen Chromium das Blatt verkleinern),
 *   - eine Seite, auf der nur der Unterschriftsblock steht (mit pdftotext, falls installiert),
 *   - Aushänge, die schon mit den Startwerten mehr als ein Blatt brauchen.
 * In vitest ohne Browser lässt sich das Layout nicht messen; deshalb ein Skript. Ohne Befund Exit-Code 0.
 *
 *   node werkzeuge/dokumente-pruefen.mjs [ausgabe]     # PDFs landen in <ausgabe> (Standard: Systemtemp), CHROMIUM_PFAD optional
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const APP = path.resolve(HIER, "..");
const require = createRequire(path.resolve(APP, "../web/package.json"));
const { chromium } = require("playwright-core");
const OUT = path.resolve(process.argv[2] ?? fs.mkdtempSync(path.join(os.tmpdir(), "amtlos-dokumente-")));
fs.mkdirSync(OUT, { recursive: true });

// Fachlogik, Schriften und Fußzeile aus den Quellen bündeln (wie werkzeuge/store-bilder.mjs)
const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
const esbuild = path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild");
const eintrag = `export * from "${path.resolve(APP, "../../packages/fachlogik/src/dokumente/index.ts")}";
export { LEERER_BETRIEB } from "${path.resolve(APP, "../../packages/fachlogik/src/dokumente/typen.ts")}";
export { mitSchriften } from "${path.join(APP, "src/unterlagen/schriften.ts")}";
export { fussAngaben, fusszeileStempeln } from "${path.join(APP, "src/unterlagen/fusszeile.ts")}";`;
const quelle = path.join(OUT, ".dokumente-eintrag.ts");
const gebaut = path.join(OUT, ".dokumente.mjs");
fs.writeFileSync(quelle, eintrag);
execFileSync(esbuild, [quelle, "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const F = await import(gebaut);
fs.rmSync(quelle);
fs.rmSync(gebaut);

const B = { ...F.LEERER_BETRIEB, name: "Salon Sonne GmbH", strasse: "Hauptstraße 1", plz: "80331", ort: "München", bundesland: "Bayern", verantwortlich: "Alex Sonnberg", telefon: "089 123456", email: "hallo@salon-sonne.example", website: "www.salon-sonne.example", steuernummer: "143/123/45678", ust_idnr: "DE123456789", iban: "DE89370400440532013000", bank: "Beispielbank", bic: "COBADEFFXXX", rechtsform: "GmbH", registergericht: "Amtsgericht München", registernummer: "HRB 271234", vertretung: "Alex Sonnberg, Chris Sonnberg", farbe: "#702434" };
const HEUTE = "2026-10-13";
const LANG = "Fachgerechte Reinigung und Desinfektion der Arbeitsflächen einschließlich Ablagen nach Herstellerangaben, dokumentiert im Protokoll";

/** Volle Daten: Pflicht- und Textfelder mittellang, Listen mit 12 Einträgen, Beträge fünfstellig. */
function voll(v) {
  const d = F.leereDaten(v, B, HEUTE);
  const wert = (f, i) => {
    if (f.art === "text") return /name|von|person/i.test(f.label) ? "Maximiliane Großmann-Überlinger" : `${f.label} ${i + 1}`;
    if (f.art === "mehrzeilig") return `${LANG}.\nZweite Zeile mit weiteren Angaben.`;
    if (f.art === "betrag") return i % 5 === 4 ? "-1.234,56" : "12.345,67";
    if (f.art === "zahl") return "3";
    if (f.art === "datum") return HEUTE;
    if (f.art === "uhrzeit") return "09:30";
    return d[f.id] ?? null;
  };
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (f.art === "liste") {
        const vs = f.vorschlaege ?? [];
        d[f.id] = Array.from({ length: Math.max(12, Math.min(vs.length, 20)) }, (_, i) => {
          if (vs.length) return F.eintragAusVorschlag(f, vs[i % vs.length], B, HEUTE);
          const e = F.neuerEintrag(f, B, HEUTE);
          for (const x of f.felder) if (["text", "mehrzeilig", "betrag", "zahl", "datum", "uhrzeit"].includes(x.art)) e[x.id] = x.art === "mehrzeilig" ? LANG : wert(x, i);
          return e;
        });
      } else if (["text", "mehrzeilig", "betrag", "zahl", "uhrzeit"].includes(f.art) && !d[f.id]) d[f.id] = wert(f, 0);
    }
  return d;
}

/**
 * „auswahl“: wie „voll“, dazu jede Auswahl auf eine andere als die Startoption, alle Schalter umgelegt, alle
 * Mehrfach- und Bausteinfelder voll und alle Datumsfelder gesetzt – so erscheinen auch die Abschnitte, die erst durch
 * eine Wahl sichtbar werden.
 */
function auswahl(v) {
  const d = voll(v);
  for (const a of v.abschnitte)
    for (const f of a.felder) {
      if (f.art === "wahl" && f.optionen.length) d[f.id] = (f.optionen.find((o) => o.wert !== d[f.id]) ?? f.optionen[0]).wert;
      else if (f.art === "schalter") d[f.id] = d[f.id] !== true;
      else if ((f.art === "mehrfach" || f.art === "bausteine") && f.optionen.length) d[f.id] = f.optionen.map((o) => o.wert);
      else if (f.art === "datum" && !d[f.id]) d[f.id] = HEUTE;
    }
  return d;
}

const MM = 72 / 25.4;
const px = (mm) => `${(Math.round(mm * MM) * 4) / 3}px`;
const pdftotext = (() => {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || "/opt/pw-browsers/chromium", headless: true, args: ["--no-sandbox"] });
const page = await (await browser.newContext({ locale: "de-DE" })).newPage();
const befunde = [];
for (const v of F.VORLAGEN) {
  for (const [variante, daten] of [["leer", F.leereDaten(v, B, HEUTE)], ["voll", voll(v)], ["auswahl", auswahl(v)]]) {
    const name = `${v.id}-${variante}`;
    const html = F.mitSchriften(F.dokumentHtml(v, daten, B));
    const ang = F.fussAngaben(html);
    const [o, r, u, l] = F.RAENDER[ang.gestalt] ?? F.RAENDER.nachweis;
    const quer = !!v.querformat;
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    await page.setViewportSize({ width: Math.round((((quer ? 297 : 210) - r - l) * 96) / 25.4), height: 1000 });
    const dom = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const raus = [];
      for (const el of document.querySelectorAll("body *")) {
        const rc = el.getBoundingClientRect();
        if (!rc.width && !rc.height) continue;
        if (rc.right > W + 1 || rc.left < -1) raus.push(`${el.tagName.toLowerCase()}.${String(el.className).replace(/ /g, ".")} „${(el.textContent || "").trim().slice(0, 40)}“`);
      }
      return { raus: [...new Set(raus)].slice(0, 3), unterschriften: [...document.querySelectorAll(".unterschrift span")].map((s) => s.textContent.trim()) };
    });
    for (const x of dom.raus) befunde.push(`${name}: über den Satzspiegel: ${x}`);
    await page.emulateMedia({ media: null });
    const pdf = await page.pdf({ format: "A4", landscape: quer, margin: { top: px(o), right: px(r), bottom: px(u), left: px(l) }, printBackground: true });
    const datei = path.join(OUT, `${name}.pdf`);
    fs.writeFileSync(datei, await F.fusszeileStempeln(new Uint8Array(pdf), ang));
    if (!pdftotext) continue;
    const seiten = execFileSync("pdftotext", ["-layout", datei, "-"], { encoding: "utf8" }).split("\f").filter((s) => s.trim());
    if (ang.gestalt === "aushang" && variante === "leer" && seiten.length > 1) befunde.push(`${name}: Aushang braucht ${seiten.length} Blätter`);
    seiten.forEach((s, i) => {
      if (i === 0 || !dom.unterschriften.length) return;
      // Zeilen ohne Kopf- und Fußzeile, ohne Unterschriftsbeschriftungen
      const zeilen = s.split("\n").map((z) => z.trim()).filter(Boolean).slice(1, -1);
      const rest = zeilen.filter((z) => !dom.unterschriften.some((w) => z.includes(w)));
      if (zeilen.length && !rest.length) befunde.push(`${name}: Seite ${i + 1} enthält nur den Unterschriftsblock`);
    });
  }
}
await browser.close();
console.log(befunde.length ? befunde.join("\n") : `Keine Befunde (${F.VORLAGEN.length} Vorlagen × 3). PDFs: ${OUT}`);
process.exit(befunde.length ? 1 : 0);
