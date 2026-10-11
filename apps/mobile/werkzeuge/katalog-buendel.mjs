#!/usr/bin/env node
/**
 * Katalog fürs Gerät (E-119): liest catalog/pflichten und catalog/regelwerte (YAML) und die englischen Übersetzungen
 * und schreibt src/demo/katalog.json. Die Übersetzung folgt katalog.lokalisiere (db/migrations/0015): jedes Objekt
 * nur aus „de“ (und „en“) bekommt „en“, wenn es für genau diesen deutschen Text eine Übersetzung gibt.
 * Inhalte werden nicht verändert.
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
const lesen = (datei) => YAML.parse(fs.readFileSync(datei, "utf8"));
const dateien = (ordner) => fs.readdirSync(ordner).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => path.join(ordner, f));

const uebersetzung = new Map(lesen(path.join(wurzel, "catalog/uebersetzungen/en.yaml")).eintraege.map((e) => [e.de, e.en]));
function lokalisiere(d) {
  if (Array.isArray(d)) return d.map(lokalisiere);
  if (d && typeof d === "object") {
    const schluessel = Object.keys(d);
    if (typeof d.de === "string" && schluessel.every((k) => k === "de" || k === "en")) {
      if ("en" in d) return d;
      const en = uebersetzung.get(d.de);
      return en === undefined ? d : { ...d, en };
    }
    return Object.fromEntries(schluessel.map((k) => [k, lokalisiere(d[k])]));
  }
  return d;
}

const pflichten = dateien(path.join(wurzel, "catalog/pflichten")).map((f) => lokalisiere(lesen(f)));
const regelwerte = dateien(path.join(wurzel, "catalog/regelwerte")).flatMap((f) => {
  const x = lesen(f);
  return (Array.isArray(x) ? x : [x]).map(lokalisiere);
});
const ziel = path.join(hier, "../src/demo/katalog.json");
fs.writeFileSync(ziel, JSON.stringify({ pflichten, regelwerte }));
console.log(`✓ ${pflichten.length} Pflichten, ${regelwerte.length} Regelwerte, ${fs.statSync(ziel).size} Bytes → src/demo/katalog.json`);
