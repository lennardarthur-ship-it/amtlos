#!/usr/bin/env node
/**
 * Katalogauszug fürs Gerät (E-121): aus catalog/pflichten nur die Pflichten, die eine Vorlage belegt (aus dem gebauten
 * @amtlos/fachlogik – vorher „pnpm build“), und nur die Angaben, die die App zeigt (Titel, Kurztext, Rechtsgrundlage,
 * Quellen, Prüfstand). Inhalte werden nicht verändert. Schreibt src/unterlagen/katalog.json; die CI prüft die Aktualität.
 *
 * Für den Pflichten-Check (E-126) zusätzlich den ganzen Katalog für die Regel-Engine: alle Pflichten und Regelwerte,
 * nur deutsch, ohne die Prüfnotizen der Redaktion → src/pflichten/katalog.json.
 *
 *   node werkzeuge/katalog-buendel.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.resolve(hier, "../../..");
const YAML = createRequire(path.join(wurzel, "packages/rules-engine/package.json"))("yaml");
const ordner = path.join(wurzel, "catalog/pflichten");
const { VORLAGEN } = await import(path.join(wurzel, "packages/fachlogik/dist/index.js"));
const benutzt = new Set(VORLAGEN.flatMap((v) => v.pflichten));

const pflichten = fs
  .readdirSync(ordner)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort()
  .map((f) => YAML.parse(fs.readFileSync(path.join(ordner, f), "utf8")))
  .filter((p) => benutzt.has(p.id))
  .map((p) => ({
    id: p.id,
    titel: p.titel.de,
    kurz: p.kurz?.de ?? "",
    rechtsgrundlage: p.rechtsgrundlage ?? [],
    quellen: (p.quellen ?? []).filter((q) => q.url).map((q) => ({ titel: q.titel, url: q.url })),
    geprueft: p.pruefung?.status === "freigegeben",
  }));
const ziel = path.join(hier, "../src/unterlagen/katalog.json");
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, JSON.stringify(pflichten, null, 1) + "\n");
console.log(`✓ ${pflichten.length} Pflichten → src/unterlagen/katalog.json`);

// Pflichten-Check (E-126): ganzer Katalog für @amtlos/rules-engine, Inhalte unverändert
const nurDeutsch = (d) => {
  if (Array.isArray(d)) return d.map(nurDeutsch);
  if (d && typeof d === "object") {
    const k = Object.keys(d);
    if (typeof d.de === "string" && k.every((x) => x === "de" || x === "en")) return { de: d.de };
    return Object.fromEntries(k.map((x) => [x, nurDeutsch(d[x])]));
  }
  return d;
};
const lesenAlle = (o) => fs.readdirSync(o).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => YAML.parse(fs.readFileSync(path.join(o, f), "utf8")));
const voll = lesenAlle(ordner).map(({ fachlich_zu_pruefen: _weg, ...p }) => nurDeutsch(p));
const regelwerte = lesenAlle(path.join(wurzel, "catalog/regelwerte")).flatMap((x) => (Array.isArray(x) ? x : [x])).map(nurDeutsch);
const zielVoll = path.join(hier, "../src/pflichten/katalog.json");
fs.mkdirSync(path.dirname(zielVoll), { recursive: true });
fs.writeFileSync(zielVoll, JSON.stringify({ pflichten: voll, regelwerte }) + "\n");
console.log(`✓ ${voll.length} Pflichten, ${regelwerte.length} Regelwerte (${Math.round(fs.statSync(zielVoll).size / 1024)} KB) → src/pflichten/katalog.json`);
