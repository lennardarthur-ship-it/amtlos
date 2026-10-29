#!/usr/bin/env node
/**
 * Freigabe-Tor vor einem Inhalts-Update (E-240, docs/inhalte-aktualisieren.md): Vor `eas update` (oder dem Hochladen auf
 * einen eigenen Update-Server) muss dieses Werkzeug grün sein. Ein Inhalts-Update ersetzt das JS-Bündel samt Katalog und
 * Vorlagen auf allen Geräten des Kanals – es darf deshalb nichts ausliefern, was ein Store-Release nicht auch dürfte.
 *
 * Geprüft wird:
 *  1. dieselben Freigaben wie im Store-Check (werkzeuge/freigabe-pruefungen.mjs): Katalog freigegeben und bestätigt,
 *     nichts Zurückgehaltenes, keine offene Prüfmarke, nichts Internes im Bündel, Regelwerte bestätigt, Vorlagen in der
 *     heutigen Fassung bestätigt, kein Vermerk ausgesetzt;
 *  2. Datenschutzhinweise (iPhone, Android) freigegeben;
 *  3. Bündel aktuell: katalog-buendel.mjs ergäbe dieselben Dateien wie eingecheckt;
 *  4. Aktualität: Das Update zeigt nicht sofort „bitte App aktualisieren“ (Rechtsstand und Stichtage des Katalogs,
 *     src/pflichten/aktualitaet.ts); unter 30 Tagen bis dahin nur ein Hinweis;
 *  5. Datenschutz: Inhalts-Updates rufen einen Update-Server an (IP-Adresse, Kennung der Installation) – erst, wenn die
 *     freigegebenen Datenschutzhinweise das nennen (PRUEFLISTE T-366/T-367). Bis dahin ist das Tor immer rot;
 *  6. Arbeitsstand eingecheckt (das Update entspricht einem Commit).
 *
 *   node werkzeuge/inhalte-gate.mjs [--kanal production|betatest|preview] [--heute JJJJ-MM-TT]
 *
 * Kanal „preview“ (interne Testgeräte): Freigabe-Befunde nur als Hinweis, Exit 0 – „production“ und „betatest“ streng.
 */
/* global process, console */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freigabePruefungen } from "./freigabe-pruefungen.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HIER, "..");
const WURZEL = path.resolve(APP, "../..");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const kanal = arg("--kanal") ?? "production";
if (!["production", "betatest", "preview"].includes(kanal)) throw new Error(`Unbekannter Kanal „${kanal}“ (production, betatest, preview – eas.json)`);
const heute = arg("--heute") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const streng = kanal !== "preview";

const ok = [];
const offen = [];
const hinweise = [];
const pruefe = (bed, text) => (bed ? ok : offen).push(text);
const freigabe = (bed, text) => (bed ? ok : streng ? offen : hinweise).push(text);

// 1. Freigaben wie im Store-Check
await freigabePruefungen(freigabe);

// 2. Datenschutzhinweise freigegeben
const recht = fs.readFileSync(path.join(APP, "src/rechtliches.ts"), "utf8");
freigabe(/export const DATENSCHUTZ = \{\s*freigegeben: true/.test(recht) && /export const DATENSCHUTZ_ANDROID = \{\s*freigegeben: true/.test(recht), "Datenschutzhinweise iPhone und Android freigegeben (DATENSCHUTZ, DATENSCHUTZ_ANDROID)");

// 3. Bündel aktuell – katalog-buendel.mjs neu laufen lassen und vergleichen; danach den eingecheckten Stand zurücklegen
{
  const dateien = ["src/pflichten/katalog.json", "src/unterlagen/katalog.json"].map((d) => path.join(APP, d));
  const vorher = dateien.map((d) => fs.readFileSync(d, "utf8"));
  let fehler = "";
  try {
    execFileSync(process.execPath, [path.join(HIER, "katalog-buendel.mjs")], { cwd: APP, stdio: "pipe" });
  } catch (e) {
    fehler = String(e.stderr ?? e.message).split("\n")[0];
  }
  const nachher = dateien.map((d) => fs.readFileSync(d, "utf8"));
  const anders = dateien.filter((_, i) => vorher[i] !== nachher[i]).map((d) => path.relative(APP, d));
  dateien.forEach((d, i) => fs.writeFileSync(d, vorher[i]));
  pruefe(!fehler && !anders.length, `Bündel aktuell (katalog-buendel.mjs ergibt die eingecheckten Dateien)${fehler ? ` – Fehler: ${fehler} (vorher „pnpm turbo run build“)` : anders.length ? ` – neu bündeln und einchecken: ${anders.join(", ")}` : ""}`);
}

// 4. Aktualität des Katalogs (dieselbe Logik wie in der App, mit esbuild gebündelt)
{
  const pnpm = path.join(WURZEL, "node_modules/.pnpm");
  const esbuildOrdner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
  if (!esbuildOrdner) throw new Error("esbuild nicht gefunden (pnpm install)");
  const gebaut = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "inhalte-gate-")), "aktualitaet.mjs");
  execFileSync(path.join(pnpm, esbuildOrdner, "node_modules/esbuild/bin/esbuild"), [path.join(APP, "src/pflichten/aktualitaet.ts"), "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
  const A = await import(gebaut);
  fs.rmSync(path.dirname(gebaut), { recursive: true, force: true });
  const a = A.katalogAktualitaet(heute);
  const ab = A.veraltetAb();
  const stichtage = A.aenderungsStichtage();
  const de = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "–");
  pruefe(!a.grund, `Aktualität: das Update zeigt nicht sofort „bitte App aktualisieren“ (Rechtsstand ${de(a.stand)}, ${a.tage} Tage)${a.grund === "alter" ? ` – älter als ${A.KATALOG_ALT_TAGE} Tage: Rechtsstand prüfen und catalog/rechtsstand.yaml fortschreiben` : a.grund === "stichtag" ? ` – Stichtag ${de(a.stichtag.datum)} (${a.stichtag.id}) erreicht: Eintrag fortschreiben (Inhalt bzw. erwartetes Datum) oder Folgewert anlegen, dann freigeben lassen` : ""}`);
  if (ab) {
    const tage = Math.round((Date.parse(`${ab}T00:00:00Z`) - Date.parse(`${heute}T00:00:00Z`)) / 864e5);
    const naechster = stichtage.find((s) => s.datum === ab);
    (tage < 30 ? hinweise : ok).push(`Die App zeigt „bitte App aktualisieren“ ab ${de(ab)} (in ${tage} Tagen; ${naechster ? `Stichtag ${naechster.id}` : `${A.KATALOG_ALT_TAGE} Tage nach dem Rechtsstand`})`);
  }
}

// 5. Datenschutz – deckt der freigegebene Hinweis die Abfrage beim Update-Server ab?
{
  const abschnitte = (name) => {
    const von = recht.indexOf(`export const ${name} = {`);
    return von < 0 ? "" : recht.slice(von, recht.indexOf("\n};", von));
  };
  const nennt = (t) => /Update-Server|Inhalts-Update|Aktualisierungs-Server/.test(t ?? "");
  pruefe(nennt(abschnitte("DATENSCHUTZ")) && nennt(abschnitte("DATENSCHUTZ_ANDROID")), "Datenschutz: Die freigegebenen Datenschutzhinweise nennen die Abfrage beim Update-Server (IP-Adresse, Kennung der Installation, Empfänger, Drittland) – sonst bleiben Inhalts-Updates aus (INHALTS_UPDATES nicht setzen; Gründerentscheidung PRUEFLISTE T-366, Ergänzung durch den Rechtsanwalt T-367)");
}

// 6. Arbeitsstand eingecheckt
{
  let sauber = false;
  try {
    sauber = execFileSync("git", ["status", "--porcelain"], { cwd: WURZEL, encoding: "utf8" }).trim() === "";
  } catch {
    sauber = false;
  }
  pruefe(sauber, "Arbeitsstand eingecheckt (git status leer) – das Update entspricht genau einem Commit");
}

console.log(`Inhalts-Update – Kanal „${kanal}“, Stichtag ${heute}`);
for (const t of ok) console.log(`  ✓ ${t}`);
for (const t of hinweise) console.log(`  · ${t}`);
for (const t of offen) console.log(`  ✗ ${t}`);
console.log(offen.length ? `\n${offen.length} Punkte offen – kein Inhalts-Update.` : "\nFrei für das Inhalts-Update.");
process.exitCode = offen.length ? 1 : 0;
