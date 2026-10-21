/**
 * Prüfmappe für die anwaltliche Prüfung erzeugen (E-156): Vorlagen als PDF, Katalog als CSV, Datenschutzhinweis der App,
 * Nutzungsbedingungen-Entwurf, RDG-Änderungsliste und Prüflisten-Auszug (Zeilen mit RA, DSB oder Fach).
 *
 *   node docs/pruefmappe-anwalt/erzeugen.mjs <ziel>      # z. B. /tmp/pruefmappe
 *
 * Voraussetzung: `pnpm install`, Fachlogik gebaut (`cd packages/fachlogik && npx tsc -p tsconfig.build.json`).
 */
/* global process, console, URL */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HIER, "../..");
const ZIEL = path.resolve(process.argv[2] ?? "pruefmappe");
fs.mkdirSync(ZIEL, { recursive: true });

// 1. Vorlagen (leer, Auswahl, voll) über das vorhandene Prüfwerkzeug
const vorlagen = path.join(ZIEL, "vorlagen");
execFileSync("node", [path.join(ROOT, "apps/mobile/werkzeuge/dokumente-pruefen.mjs"), vorlagen], { cwd: path.join(ROOT, "apps/mobile"), stdio: "inherit" });

// 2. Katalog als CSV (Semikolon, UTF-8 mit BOM für Excel)
const katalog = JSON.parse(fs.readFileSync(path.join(ROOT, "apps/mobile/src/pflichten/katalog.json"), "utf8"));
const de = (x) => (x && typeof x === "object" ? (x.de ?? "") : (x ?? ""));
const ausloeser = (a) => (a ? de(a.label) || JSON.stringify(a) : "");
const zelle = (t) => `"${String(t ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const kopf = ["Nr", "ID", "Titel", "Kurz", "Kategorie", "Auslöser", "Rechtsgrundlage", "Sanktion", "Schwere", "Status Recht", "Gültig ab", "Quellen", "Prüfstatus"];
const zeilen = katalog.pflichten
  .slice()
  .sort((a, b) => String(a.katalog_nr).localeCompare(String(b.katalog_nr), "de", { numeric: true }))
  .map((p) => [p.katalog_nr, p.id, de(p.titel), de(p.kurz), p.kategorie, ausloeser(p.ausloeser), (p.rechtsgrundlage ?? []).join("; "), de(p.sanktion?.text), p.sanktion?.schwere, p.status_recht, p.gueltig_ab ?? "", (p.quellen ?? []).map((q) => q.url).join(" "), p.pruefung?.status]);
fs.writeFileSync(path.join(ZIEL, "katalog.csv"), "﻿" + [kopf, ...zeilen].map((z) => z.map(zelle).join(";")).join("\n") + "\n");

// 3. Datenschutzhinweis der App als Markdown (über esbuild aus rechtliches.ts)
const pnpm = path.join(ROOT, "node_modules/.pnpm");
const esb = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
const tmp = path.join(ZIEL, ".rechtliches.mjs");
execFileSync(path.join(pnpm, esb, "node_modules/esbuild/bin/esbuild"), [path.join(ROOT, "apps/mobile/src/rechtliches.ts"), "--bundle", "--format=esm", `--outfile=${tmp}`, "--log-level=warning"]);
const recht = await import(tmp);
fs.rmSync(tmp);
const dse = ["# Datenschutzhinweis der App (Stand des Codes)", "", `Freigegeben: ${recht.DATENSCHUTZ.freigegeben ? "ja" : "nein (Entwurf)"}`, "", "Verantwortlicher: aus den Anbieterangaben (noch nicht eingetragen, wenn leer).", ""];
for (const a of recht.DATENSCHUTZ.abschnitte) dse.push(`## ${a.titel}`, "", a.text, "");
dse.push("## Zusatz für Builds mit Synchronisation", "");
for (const a of Object.values(recht.DATENSCHUTZ_SYNC)) dse.push(`### ${a.titel}`, "", a.text, "");
fs.writeFileSync(path.join(ZIEL, "datenschutzhinweis-app.md"), dse.join("\n"));

// 4. Entwürfe und Listen
const kopiere = (von, nach) => fs.existsSync(von) && fs.copyFileSync(von, path.join(ZIEL, nach));
kopiere(path.join(HIER, "README.md"), "README.md");
kopiere(path.join(ROOT, "docs/nutzungsbedingungen-entwurf.md"), "nutzungsbedingungen-entwurf.md");
kopiere(path.join(HIER, "rdg-aenderungen.md"), "rdg-aenderungen.md");
// Website: Datenschutzerklärung und Impressum, wie sie veröffentlicht würden (Entwurfs-Build)
const web = path.join(ZIEL, ".website");
execFileSync("node", [path.join(ROOT, "apps/website/bauen.mjs"), web, "--entwurf"], { stdio: "ignore" });
for (const f of ["datenschutz.html", "impressum.html", "hilfe.html"]) fs.copyFileSync(path.join(web, f), path.join(ZIEL, `website-${f}`));
fs.rmSync(web, { recursive: true, force: true });
const pl = fs.readFileSync(path.join(ROOT, "PRUEFLISTE.md"), "utf8").split("\n");
const auszug = pl.filter((z) => z.startsWith("|") && /\|\s*[^|]*(RA|DSB|Fach)[^|]*\|/.test(z));
fs.writeFileSync(path.join(ZIEL, "PRUEFLISTE-auszug.md"), ["# Offene Fragen für Rechtsanwalt, Datenschutz und Fachleute", "", "| Nr. | Punkt | Wer | Quelle |", "|---|---|---|---|", ...auszug].join("\n") + "\n");

console.log(`✓ Prüfmappe in ${ZIEL}: ${fs.readdirSync(vorlagen).length} PDFs, ${zeilen.length} Pflichten`);
