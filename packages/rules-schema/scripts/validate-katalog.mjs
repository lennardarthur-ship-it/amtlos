#!/usr/bin/env node
// Validiert catalog/ gegen die JSON-Schemas und prüft Querverweise:
// - feld existiert im Fakten-Katalog, Operator passt zum Typ, Enum-Werte sind gültig
// - Regelwert-Verweise existieren
// - Ereignistypen existieren
// - Regelwert-Versionen derselben ID überlappen sich nicht
// - Voraussetzungen verweisen auf existierende Pflichten
// Aufruf: node validate-katalog.mjs <catalog-dir> [--prod]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.resolve(here, "..");
const katalogDir = path.resolve(process.argv[2] ?? path.join(schemaDir, "../../catalog"));
const prod = process.argv.includes("--prod");

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false });
addFormats(ajv);
const pruefePflicht = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemaDir, "pflicht.schema.json"), "utf8")));
const pruefeRegelwert = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemaDir, "regelwert.schema.json"), "utf8")));
const fakten = new Map(JSON.parse(fs.readFileSync(path.join(schemaDir, "fakten.json"), "utf8")).fakten.map((f) => [f.pfad, f]));
const ereignisse = new Set(JSON.parse(fs.readFileSync(path.join(schemaDir, "ereignisse.json"), "utf8")).ereignisse.map((e) => e.typ));

const fehler = [];
const fehlerAus = (datei, msg) => fehler.push(`${datei}: ${msg}`);

const ladeYaml = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ datei: path.join(path.basename(dir), f), inhalt: YAML.parse(fs.readFileSync(path.join(dir, f), "utf8")) }))
    : [];

// ---------- Regelwerte ----------
const regelwerte = new Map(); // id -> versionen[]
for (const { datei, inhalt } of ladeYaml(path.join(katalogDir, "regelwerte"))) {
  for (const rw of Array.isArray(inhalt) ? inhalt : [inhalt]) {
    if (!pruefeRegelwert(rw)) {
      for (const e of pruefeRegelwert.errors) fehlerAus(datei, `${rw?.id ?? "?"}@${rw?.version ?? "?"} ${e.instancePath} ${e.message}`);
      continue;
    }
    if (!regelwerte.has(rw.id)) regelwerte.set(rw.id, []);
    regelwerte.get(rw.id).push({ ...rw, datei });
  }
}
const tag = (d) => (d == null ? Infinity : Date.parse(d));
for (const [id, versionen] of regelwerte) {
  const nummern = versionen.map((v) => v.version);
  if (new Set(nummern).size !== nummern.length) fehlerAus(versionen[0].datei, `${id}: doppelte Versionsnummer`);
  const sortiert = [...versionen].sort((a, b) => tag(a.gueltig_ab) - tag(b.gueltig_ab));
  for (let i = 1; i < sortiert.length; i++) {
    if (tag(sortiert[i].gueltig_ab) <= tag(sortiert[i - 1].gueltig_bis))
      fehlerAus(sortiert[i].datei, `${id}: Gültigkeit v${sortiert[i].version} überlappt v${sortiert[i - 1].version}`);
  }
  for (const v of versionen) if (v.gueltig_bis && tag(v.gueltig_bis) < tag(v.gueltig_ab)) fehlerAus(v.datei, `${id}@${v.version}: gueltig_bis vor gueltig_ab`);
}

// ---------- Pflichten ----------
const OPS_FUER_TYP = {
  zahl: ["==", "!=", ">", ">=", "<", "<=", "in", "nicht_in"],
  betrag: ["==", "!=", ">", ">=", "<", "<="],
  ganzzahl: ["==", "!=", ">", ">=", "<", "<=", "in", "nicht_in"],
  bool: ["=="],
  datum: ["==", "!=", ">", ">=", "<", "<="],
  enum: ["==", "!=", "in", "nicht_in"],
  enum_liste: ["enthaelt", "enthaelt_eines"],
  text: ["==", "!=", "in", "nicht_in"],
};
const IMMER_ERLAUBT = ["vorhanden", "nicht_vorhanden"];

const pflichten = ladeYaml(path.join(katalogDir, "pflichten"));
const pflichtIds = new Set(pflichten.map((p) => p.inhalt?.id));

function pruefeWert(datei, fakt, op, wert, pfad) {
  if (wert && typeof wert === "object" && !Array.isArray(wert) && "regelwert" in wert) {
    if (!regelwerte.has(wert.regelwert)) fehlerAus(datei, `${pfad}: unbekannter Regelwert '${wert.regelwert}'`);
    if (!["zahl", "betrag", "ganzzahl"].includes(fakt.typ)) fehlerAus(datei, `${pfad}: Regelwert-Vergleich auf Nicht-Zahl '${fakt.pfad}'`);
    return;
  }
  if (fakt.typ === "bool" && typeof wert !== "boolean") fehlerAus(datei, `${pfad}: '${fakt.pfad}' erwartet true/false`);
  if (["zahl", "betrag", "ganzzahl"].includes(fakt.typ) && !["in", "nicht_in"].includes(op) && typeof wert !== "number")
    fehlerAus(datei, `${pfad}: '${fakt.pfad}' erwartet eine Zahl`);
  if (fakt.werte) {
    const liste = Array.isArray(wert) ? wert : [wert];
    for (const w of liste) if (!fakt.werte.includes(w)) fehlerAus(datei, `${pfad}: '${w}' ist kein gültiger Wert für '${fakt.pfad}'`);
  }
  if (["in", "nicht_in", "enthaelt_eines"].includes(op) && !Array.isArray(wert)) fehlerAus(datei, `${pfad}: Operator '${op}' erwartet eine Liste`);
}

function pruefeBedingung(datei, b, pfad) {
  if (!b || typeof b !== "object") return;
  if (b.all) return b.all.forEach((x, i) => pruefeBedingung(datei, x, `${pfad}.all[${i}]`));
  if (b.any) return b.any.forEach((x, i) => pruefeBedingung(datei, x, `${pfad}.any[${i}]`));
  if (b.not) return pruefeBedingung(datei, b.not, `${pfad}.not`);
  if (b.ereignis) {
    if (!ereignisse.has(b.ereignis)) fehlerAus(datei, `${pfad}: unbekanntes Ereignis '${b.ereignis}'`);
    return;
  }
  if (b.feld) {
    const fakt = fakten.get(b.feld);
    if (!fakt) return fehlerAus(datei, `${pfad}: unbekannter Fakt '${b.feld}'`);
    if (!IMMER_ERLAUBT.includes(b.op) && !OPS_FUER_TYP[fakt.typ]?.includes(b.op))
      fehlerAus(datei, `${pfad}: Operator '${b.op}' passt nicht zu Typ '${fakt.typ}' von '${b.feld}'`);
    if ("wert" in b) pruefeWert(datei, fakt, b.op, b.wert, pfad);
  }
}

for (const { datei, inhalt: p } of pflichten) {
  if (!pruefePflicht(p)) {
    for (const e of pruefePflicht.errors) fehlerAus(datei, `${e.instancePath || "/"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}`);
    continue;
  }
  if (path.basename(datei).replace(/\.ya?ml$/, "") !== p.id) fehlerAus(datei, `Dateiname muss der ID '${p.id}' entsprechen`);
  pruefeBedingung(datei, p.ausloeser, "ausloeser");
  const f = p.frist;
  if (f.bezug?.ereignis && !ereignisse.has(f.bezug.ereignis)) fehlerAus(datei, `frist.bezug: unbekanntes Ereignis '${f.bezug.ereignis}'`);
  if (f.bezug?.fakt && fakten.get(f.bezug.fakt)?.typ !== "datum") fehlerAus(datei, `frist.bezug: '${f.bezug.fakt}' ist kein Datums-Fakt`);
  if (f.bezug?.pflicht_erledigt && !pflichtIds.has(f.bezug.pflicht_erledigt)) fehlerAus(datei, `frist.bezug: unbekannte Pflicht '${f.bezug.pflicht_erledigt}'`);
  f.rhythmus?.waehle?.forEach((w, i) => pruefeBedingung(datei, w.wenn, `frist.rhythmus.waehle[${i}]`));
  if (f.verlaengerung) pruefeBedingung(datei, f.verlaengerung.wenn, "frist.verlaengerung");
  for (const n of p.wiederholung.neu_ausloesen_bei ?? []) {
    if (n.ereignis && !ereignisse.has(n.ereignis)) fehlerAus(datei, `wiederholung: unbekanntes Ereignis '${n.ereignis}'`);
    if (n.fakt && !fakten.has(n.fakt)) fehlerAus(datei, `wiederholung: unbekannter Fakt '${n.fakt}'`);
  }
  for (const v of p.voraussetzungen ?? []) if (!pflichtIds.has(v)) fehlerAus(datei, `voraussetzungen: unbekannte Pflicht '${v}'`);

  if (prod) {
    if (p.pruefung?.status !== "freigegeben") fehlerAus(datei, "prod: nicht freigegeben");
    for (const k of ["titel", "kurz", "erklaerung", "stelle"]) if (!p[k].en) fehlerAus(datei, `prod: englischer Text fehlt in '${k}'`);
    for (const q of p.quellen) if (!q.abgerufen) fehlerAus(datei, `prod: Quelle '${q.titel}' nie abgerufen`);
    if (p.status_recht === "in_kraft" && !p.gueltig_ab) fehlerAus(datei, "prod: in Kraft, aber gueltig_ab fehlt");
    if (p.fachlich_zu_pruefen?.length) fehlerAus(datei, `prod: ${p.fachlich_zu_pruefen.length} offene Prüfpunkte`);
  }
}

const anzahlRw = [...regelwerte.values()].reduce((s, v) => s + v.length, 0);
if (fehler.length) {
  console.error(`✗ ${fehler.length} Fehler${prod ? " (prod-Modus)" : ""}:`);
  for (const f of fehler) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ Katalog gültig${prod ? " (prod-Modus)" : ""}: ${pflichten.length} Pflichten, ${anzahlRw} Regelwert-Versionen, ${fakten.size} Fakten, ${ereignisse.size} Ereignistypen`);
