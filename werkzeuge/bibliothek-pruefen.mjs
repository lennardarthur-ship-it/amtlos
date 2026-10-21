/**
 * Bibliotheks-Reife (Phase 2.3, E-156): prüft, ob sich die Fachpakete ohne die App nutzen lassen – ohne CI, lokal.
 *
 * Für @amtlos/fristen, @amtlos/rules-engine und @amtlos/fachlogik:
 *   1. Grenzen: keine Importe aus apps/*, keine App-Abhängigkeiten (react, react-native, expo …), keine Node-APIs im
 *      Quelltext, nur deklarierte Abhängigkeiten.
 *   2. package.json: name, version, description, license, main, types, exports, files, sideEffects; README.md mit
 *      Zweck, Schnittstelle und Beispiel; beispiel/beispiel.mjs vorhanden.
 *   3. Tests des Pakets für sich (vitest im Paketordner) – mit `--ohne-tests` überspringen.
 *   4. `pnpm pack` je Paket (prepack: dist leeren, neu bauen) in einen Temp-Ordner; Inhalt des Tarballs prüfen.
 *   5. Leeres Temp-Projekt, Pakete offline aus den Tarballs installieren (Abhängigkeiten untereinander ebenfalls aus
 *      den Tarballs, Fremdpakete aus dem lokalen pnpm-Speicher), jedes Beispiel dort ausführen und die Typen mit tsc
 *      prüfen.
 *
 *   node werkzeuge/bibliothek-pruefen.mjs [--ohne-tests] [--behalten]
 *
 * Exit 1 bei jedem Befund.
 */
/* global process, console, URL */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PAKETE = ["fristen", "rules-engine", "fachlogik"];
const VERBOTEN = /^(react|react-dom|react-native|react-native-.*|expo|expo-.*|@expo\/.*|@react-native.*|@react-navigation\/.*|next|@amtlos\/(mobile|web|studio|api|worker|website|server|web-kern|i18n))(\/|$)/;
const ohneTests = process.argv.includes("--ohne-tests");
const behalten = process.argv.includes("--behalten");

const befunde = [];
const ok = [];
const melde = (bed, text) => (bed ? ok : befunde).push(text);
const lauf = (cmd, args, cwd, env = {}) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });

function dateien(dir, endung = /\.ts$/) {
  const r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...dateien(p, endung));
    else if (endung.test(e.name)) r.push(p);
  }
  return r;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "amtlos-bibliothek-"));
const ablage = path.join(tmp, "pakete");
const projekt = path.join(tmp, "projekt");
fs.mkdirSync(ablage);
fs.mkdirSync(projekt);
const tarballs = {};
const pnpmVersion = JSON.parse(fs.readFileSync(path.join(WURZEL, "package.json"), "utf8")).packageManager;
const speicher = lauf("pnpm", ["store", "path"], WURZEL).trim();

try {
  for (const name of PAKETE) {
    const dir = path.join(WURZEL, "packages", name);
    const pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    const p = pj.name;

    // 1. Grenzen
    const erlaubt = new Set(Object.keys(pj.dependencies ?? {}));
    const fehler = [];
    for (const f of dateien(path.join(dir, "src"))) {
      const q = fs.readFileSync(f, "utf8");
      for (const m of q.matchAll(/(?:^|\n)\s*(?:import|export)[^"';]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g)) {
        const ziel = m[1] ?? m[2] ?? m[3];
        if (ziel.startsWith(".")) {
          if (!path.resolve(path.dirname(f), ziel).startsWith(path.join(dir, "src"))) fehler.push(`${path.relative(dir, f)} → ${ziel} (außerhalb des Pakets)`);
          continue;
        }
        if (VERBOTEN.test(ziel)) fehler.push(`${path.relative(dir, f)} → ${ziel} (App-Abhängigkeit)`);
        else if (ziel.startsWith("node:")) fehler.push(`${path.relative(dir, f)} → ${ziel} (Node-API)`);
        else if (!erlaubt.has(ziel.startsWith("@") ? ziel.split("/").slice(0, 2).join("/") : ziel.split("/")[0])) fehler.push(`${path.relative(dir, f)} → ${ziel} (nicht in dependencies)`);
      }
      if (/apps\//.test(q.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) fehler.push(`${path.relative(dir, f)}: Verweis auf apps/`);
    }
    for (const d of Object.keys({ ...pj.dependencies, ...pj.peerDependencies })) if (VERBOTEN.test(d)) fehler.push(`package.json: Abhängigkeit ${d}`);
    melde(!fehler.length, `${p}: keine Importe aus apps/*, keine App-Abhängigkeiten, keine Node-APIs${fehler.length ? ` – ${fehler.join("; ")}` : ""}`);

    // 2. Metadaten, README, Beispiel
    const fehlt = ["name", "version", "description", "license", "main", "types", "exports", "files"].filter((k) => !pj[k]);
    if (pj.sideEffects !== false) fehlt.push("sideEffects: false");
    if (!pj.exports?.["."]?.types || !pj.exports?.["."]?.default) fehlt.push("exports['.'].types/default");
    if (!pj.scripts?.prepack) fehlt.push("scripts.prepack (sauberer Build vor dem Packen)");
    melde(!fehlt.length, `${p}: package.json vollständig (Lizenz „${pj.license ?? "–"}“)${fehlt.length ? ` – fehlt: ${fehlt.join(", ")}` : ""}`);
    const readme = fs.existsSync(path.join(dir, "README.md")) ? fs.readFileSync(path.join(dir, "README.md"), "utf8") : "";
    melde(/## Zweck/.test(readme) && /## Schnittstelle/.test(readme) && /## Beispiel/.test(readme) && readme.includes(p), `${p}: README.md mit Zweck, Schnittstelle und Beispiel`);
    melde(fs.existsSync(path.join(dir, "beispiel/beispiel.mjs")), `${p}: beispiel/beispiel.mjs vorhanden`);

    // 3. Tests für sich
    if (!ohneTests) {
      try {
        const aus = lauf("pnpm", ["exec", "vitest", "run"], dir);
        const n = /Tests\s+(\d+) passed/.exec(aus)?.[1];
        melde(true, `${p}: Tests im Paketordner grün (${n ?? "?"} Tests)`);
      } catch (e) {
        melde(false, `${p}: Tests scheitern – ${String(e.stdout ?? e.message).split("\n").filter((z) => /FAIL|✗|×/.test(z)).slice(0, 5).join(" | ")}`);
      }
    }

    // 4. Packen (prepack baut frisch)
    const aus = lauf("pnpm", ["pack", "--pack-destination", ablage], dir);
    const tgz = aus.trim().split("\n").filter((z) => z.endsWith(".tgz")).pop();
    const datei = tgz && path.isAbsolute(tgz) ? tgz : path.join(ablage, path.basename(tgz ?? ""));
    if (!tgz || !fs.existsSync(datei)) throw new Error(`${p}: pnpm pack lieferte keinen Tarball:\n${aus}`);
    tarballs[p] = datei;
    const inhalt = lauf("tar", ["-tzf", datei], tmp).split("\n").filter(Boolean);
    const gepacktesPj = JSON.parse(lauf("tar", ["-xzOf", datei, "package/package.json"], tmp));
    const tarFehler = [];
    for (const x of ["package/package.json", "package/README.md", "package/dist/index.js", "package/dist/index.d.ts"]) if (!inhalt.includes(x)) tarFehler.push(`fehlt ${x}`);
    for (const x of inhalt) if (/^package\/(test|beispiel|node_modules)\/|^package\/dist\/(src|test)\//.test(x)) tarFehler.push(`gehört nicht hinein: ${x}`);
    for (const [d, v] of Object.entries(gepacktesPj.dependencies ?? {})) if (String(v).startsWith("workspace:")) tarFehler.push(`${d}: ${v} nicht ersetzt`);
    melde(!tarFehler.length, `${p}: Tarball ${path.basename(datei)} (${inhalt.length} Dateien, ${Math.round(fs.statSync(datei).size / 1024)} KB)${tarFehler.length ? ` – ${tarFehler.join("; ")}` : ""}`);
  }

  // 5. Leeres Projekt, offline aus den Tarballs installieren, Beispiele ausführen, Typen prüfen
  const datei = (p) => `file:${tarballs[p]}`;
  fs.writeFileSync(
    path.join(projekt, "package.json"),
    JSON.stringify(
      {
        name: "amtlos-bibliothek-probe",
        private: true,
        type: "module",
        ...(pnpmVersion ? { packageManager: pnpmVersion } : {}),
        dependencies: Object.fromEntries(Object.keys(tarballs).map((p) => [p, datei(p)])),
        // Abhängigkeiten der Pakete untereinander ebenfalls aus den Tarballs – nie aus einer Registry
        pnpm: { overrides: Object.fromEntries(Object.keys(tarballs).map((p) => [p, datei(p)])) },
      },
      null,
      2,
    ),
  );
  try {
    lauf("pnpm", ["install", "--offline", "--store-dir", speicher, "--config.confirmModulesPurge=false"], projekt);
    melde(true, `Installation offline aus ${Object.keys(tarballs).length} Tarballs in ein leeres Projekt`);
  } catch (e) {
    melde(false, `Installation offline gescheitert – ${String(e.stderr || e.stdout || e.message).slice(0, 600)}`);
    throw new Error("Abbruch");
  }
  for (const name of PAKETE) {
    const p = JSON.parse(fs.readFileSync(path.join(WURZEL, "packages", name, "package.json"), "utf8")).name;
    const ziel = path.join(projekt, `beispiel-${name}.mjs`);
    fs.copyFileSync(path.join(WURZEL, "packages", name, "beispiel/beispiel.mjs"), ziel);
    try {
      const aus = lauf("node", [ziel], projekt);
      melde(/\nok\s*$/.test(`\n${aus}`), `${p}: Beispiel läuft im leeren Projekt (${aus.trim().split("\n").length} Zeilen Ausgabe)`);
    } catch (e) {
      melde(false, `${p}: Beispiel scheitert im leeren Projekt – ${String(e.stderr || e.message).split("\n").slice(0, 6).join(" | ")}`);
    }
  }
  // Typen: ein TS-Verbraucher mit NodeNext-Auflösung
  fs.writeFileSync(
    path.join(projekt, "typen.ts"),
    [
      'import { StandardKalender, type Datum } from "@amtlos/fristen";',
      'import { auswerten, type Katalog, type PflichtErgebnis } from "@amtlos/rules-engine";',
      'import { summen, type Position, type Betrieb } from "@amtlos/fachlogik";',
      "const k: Katalog = { pflichten: [], regelwerte: [] };",
      'const stichtag: Datum = "2026-10-21";',
      "const r: PflichtErgebnis[] = auswerten({ katalog: k, fakten: {}, ereignisse: [], stichtag, kalender: new StandardKalender() });",
      'const p: Position = { bezeichnung: "x", menge: 1, einheit: "stueck", preis_cent: 100, ust_satz: 19 };',
      "const b: Partial<Betrieb> = {};",
      "export const probe = [r.length, summen([p], false).brutto_cent, b];",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(projekt, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true, skipLibCheck: false, types: [] }, files: ["typen.ts"] }));
  try {
    lauf(process.execPath, [path.join(WURZEL, "node_modules/typescript/bin/tsc"), "-p", projekt], projekt);
    melde(true, "Typen: ein TypeScript-Verbraucher (NodeNext, strict, ohne skipLibCheck) übersetzt fehlerfrei");
  } catch (e) {
    melde(false, `Typen: tsc meldet Fehler – ${String(e.stdout || e.message).slice(0, 800)}`);
  }
} catch (e) {
  if (e.message !== "Abbruch") befunde.push(`Abbruch: ${e.message}`);
} finally {
  for (const t of ok) console.log(`  ✓ ${t}`);
  for (const t of befunde) console.log(`  ✗ ${t}`);
  if (behalten) console.log(`\nTemp-Ordner: ${tmp}`);
  else fs.rmSync(tmp, { recursive: true, force: true });
  console.log(befunde.length ? `\n${befunde.length} Befunde.` : "\nAlle Pakete lassen sich als Bibliothek nutzen.");
  process.exitCode = befunde.length ? 1 : 0;
}
