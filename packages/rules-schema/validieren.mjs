// Katalog-Validierung als Modul (genutzt vom CLI scripts/validate-katalog.mjs und vom Katalog-Import).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const schemaDir = path.dirname(fileURLToPath(import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false });
addFormats(ajv);
const pruefePflicht = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemaDir, "pflicht.schema.json"), "utf8")));
const pruefeRegelwert = ajv.compile(JSON.parse(fs.readFileSync(path.join(schemaDir, "regelwert.schema.json"), "utf8")));
const fakten = new Map(JSON.parse(fs.readFileSync(path.join(schemaDir, "fakten.json"), "utf8")).fakten.map((f) => [f.pfad, f]));
const ereignisse = new Set(JSON.parse(fs.readFileSync(path.join(schemaDir, "ereignisse.json"), "utf8")).ereignisse.map((e) => e.typ));

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

/**
 * Prüft eine einzelne Pflichtversion: JSON-Schema, Fakten, Operatoren, Enum-Werte, Regelwerte, Ereignisse, Verweise.
 * Genutzt vom Katalog-Validator und vom Studio beim Speichern.
 * @param {any} p
 * @param {{ regelwertIds: Set<string>, pflichtIds: Set<string>, prod?: boolean }} kontext
 * @returns {string[]} Fehlermeldungen (leer = gültig)
 */
export function pruefePflichtObjekt(p, kontext) {
  const fehler = [];
  if (!pruefePflicht(p)) {
    for (const e of pruefePflicht.errors) fehler.push(`${e.instancePath || "/"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}`);
    return fehler;
  }
  const pruefeWert = (fakt, op, wert, pfad) => {
    if (wert && typeof wert === "object" && !Array.isArray(wert) && "regelwert" in wert) {
      if (!kontext.regelwertIds.has(wert.regelwert)) fehler.push(`${pfad}: unbekannter Regelwert '${wert.regelwert}'`);
      if (!["zahl", "betrag", "ganzzahl"].includes(fakt.typ)) fehler.push(`${pfad}: Regelwert-Vergleich auf Nicht-Zahl '${fakt.pfad}'`);
      return;
    }
    if (fakt.typ === "bool" && typeof wert !== "boolean") fehler.push(`${pfad}: '${fakt.pfad}' erwartet true/false`);
    if (["zahl", "betrag", "ganzzahl"].includes(fakt.typ) && !["in", "nicht_in"].includes(op) && typeof wert !== "number")
      fehler.push(`${pfad}: '${fakt.pfad}' erwartet eine Zahl`);
    if (fakt.werte) for (const w of Array.isArray(wert) ? wert : [wert]) if (!fakt.werte.includes(w)) fehler.push(`${pfad}: '${w}' ist kein gültiger Wert für '${fakt.pfad}'`);
    if (["in", "nicht_in", "enthaelt_eines"].includes(op) && !Array.isArray(wert)) fehler.push(`${pfad}: Operator '${op}' erwartet eine Liste`);
  };
  const pruefeBedingung = (b, pfad) => {
    if (!b || typeof b !== "object") return;
    if (b.all) return b.all.forEach((x, i) => pruefeBedingung(x, `${pfad}.all[${i}]`));
    if (b.any) return b.any.forEach((x, i) => pruefeBedingung(x, `${pfad}.any[${i}]`));
    if (b.not) return pruefeBedingung(b.not, `${pfad}.not`);
    if (b.ereignis) {
      if (!ereignisse.has(b.ereignis)) fehler.push(`${pfad}: unbekanntes Ereignis '${b.ereignis}'`);
      return;
    }
    if (b.feld) {
      const fakt = fakten.get(b.feld);
      if (!fakt) return fehler.push(`${pfad}: unbekannter Fakt '${b.feld}'`);
      if (!IMMER_ERLAUBT.includes(b.op) && !OPS_FUER_TYP[fakt.typ]?.includes(b.op)) fehler.push(`${pfad}: Operator '${b.op}' passt nicht zu Typ '${fakt.typ}' von '${b.feld}'`);
      if ("wert" in b) pruefeWert(fakt, b.op, b.wert, pfad);
    }
  };
  pruefeBedingung(p.ausloeser, "ausloeser");
  const f = p.frist;
  if (f.bezug?.ereignis && !ereignisse.has(f.bezug.ereignis)) fehler.push(`frist.bezug: unbekanntes Ereignis '${f.bezug.ereignis}'`);
  if (f.bezug?.fakt && fakten.get(f.bezug.fakt)?.typ !== "datum") fehler.push(`frist.bezug: '${f.bezug.fakt}' ist kein Datums-Fakt`);
  if (f.bezug?.pflicht_erledigt && !kontext.pflichtIds.has(f.bezug.pflicht_erledigt)) fehler.push(`frist.bezug: unbekannte Pflicht '${f.bezug.pflicht_erledigt}'`);
  f.rhythmus?.waehle?.forEach((w, i) => pruefeBedingung(w.wenn, `frist.rhythmus.waehle[${i}]`));
  if (f.verlaengerung) pruefeBedingung(f.verlaengerung.wenn, "frist.verlaengerung");
  for (const n of p.wiederholung.neu_ausloesen_bei ?? []) {
    if (n.ereignis && !ereignisse.has(n.ereignis)) fehler.push(`wiederholung: unbekanntes Ereignis '${n.ereignis}'`);
    if (n.fakt && !fakten.has(n.fakt)) fehler.push(`wiederholung: unbekannter Fakt '${n.fakt}'`);
  }
  for (const v of p.voraussetzungen ?? []) if (!kontext.pflichtIds.has(v)) fehler.push(`voraussetzungen: unbekannte Pflicht '${v}'`);
  if (kontext.prod) {
    if (p.pruefung?.status !== "freigegeben") fehler.push("prod: nicht freigegeben");
    for (const k of ["titel", "kurz", "erklaerung", "stelle"]) if (!p[k].en) fehler.push(`prod: englischer Text fehlt in '${k}'`);
    for (const q of p.quellen) if (!q.abgerufen) fehler.push(`prod: Quelle '${q.titel}' nie abgerufen`);
    if (p.status_recht === "in_kraft" && !p.gueltig_ab) fehler.push("prod: in Kraft, aber gueltig_ab fehlt");
    if (p.fachlich_zu_pruefen?.length) fehler.push(`prod: ${p.fachlich_zu_pruefen.length} offene Prüfpunkte`);
  }
  return fehler;
}

/**
 * @param {string} katalogDir Pfad zu catalog/
 * @param {{ prod?: boolean }} [optionen]
 * @returns {{ fehler: string[], pflichten: {datei: string, inhalt: any}[], regelwerte: any[], fixtures: {datei: string, inhalt: any}[], fakten: number, ereignisse: number }}
 */
export function validiereKatalog(katalogDir, optionen = {}) {
  const prod = optionen.prod === true;

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
  const pflichten = ladeYaml(path.join(katalogDir, "pflichten"));
  const pflichtIds = new Set(pflichten.map((p) => p.inhalt?.id));
  for (const { datei, inhalt: p } of pflichten) {
    for (const f of pruefePflichtObjekt(p, { regelwertIds: new Set(regelwerte.keys()), pflichtIds, prod })) fehlerAus(datei, f);
    if (p?.id && path.basename(datei).replace(/\.ya?ml$/, "") !== p.id) fehlerAus(datei, `Dateiname muss der ID '${p.id}' entsprechen`);
  }

  // ---------- Fixtures ----------
  const fixtures = ladeYaml(path.join(katalogDir, "fixtures"));
  for (const { datei, inhalt: fx } of fixtures) {
    if (!fx?.stichtag || !fx?.erwartet) {
      fehlerAus(datei, "Fixture braucht 'stichtag' und 'erwartet'");
      continue;
    }
    for (const [k, v] of Object.entries(fx.fakten ?? {})) {
      const fakt = fakten.get(k);
      if (!fakt) fehlerAus(datei, `unbekannter Fakt '${k}'`);
      else if (fakt.werte && ![].concat(v).every((w) => fakt.werte.includes(w))) fehlerAus(datei, `ungültiger Wert für '${k}': ${JSON.stringify(v)}`);
    }
    for (const e of fx.ereignisse ?? []) if (!ereignisse.has(e.typ)) fehlerAus(datei, `unbekanntes Ereignis '${e.typ}'`);
    for (const id of [...Object.keys(fx.erwartet), ...Object.keys(fx.termine_enthaelt ?? {}), ...Object.keys(fx.fehlende_fakten ?? {})])
      if (!pflichtIds.has(id)) fehlerAus(datei, `unbekannte Pflicht '${id}'`);
    for (const [id, e] of Object.entries(fx.erwartet)) if (!["gilt", "gilt_nicht", "unbekannt"].includes(e)) fehlerAus(datei, `${id}: Ergebnis '${e}' ungültig`);
  }

  return {
    fehler,
    pflichten,
    regelwerte: [...regelwerte.values()].flat().map(({ datei: _d, ...rw }) => rw),
    fixtures,
    fakten: fakten.size,
    ereignisse: ereignisse.size,
  };
}
