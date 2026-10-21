// Katalog-Validierung als Modul (genutzt vom CLI scripts/validate-katalog.mjs und vom Katalog-Import).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import YAML from "yaml";

const schemaDir = path.dirname(fileURLToPath(import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false, verbose: true });
addFormats(ajv);
const pflichtSchema = JSON.parse(fs.readFileSync(path.join(schemaDir, "pflicht.schema.json"), "utf8"));
const pruefePflicht = ajv.compile(pflichtSchema);
/** Schema-Objekt → Pfad, um oneOf-Fehler ihrer Stelle im Schema zuzuordnen (Ajv liefert relative schemaPaths). */
const SCHEMA_PFAD = new Map([
  ...Object.entries(pflichtSchema.$defs).map(([k, v]) => [v, `/$defs/${k}`]),
  [pflichtSchema.$defs.fristWiederkehrend.properties.faellig, "/$defs/fristWiederkehrend/properties/faellig"],
]);
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

const FELDNAMEN = {
  bezeichnung: "Bezeichnung", einheit: "Einheit", wert: "Wert", katalog_nr: "Katalog-Nr.", fundstelle: "Fundstelle",
  titel: "Titel", kurz: "In einem Satz", erklaerung: "Erklärung", stelle: "Zuständige Stelle", sanktion: "Folgen", text: "Text",
  rechtsgrundlage: "Rechtsgrundlagen", quellen: "Quellen", ausloeser: "Auslöser", frist: "Frist", wiederholung: "Wiederholung",
  kategorie: "Kategorie", kanal: "Kanal", automatisierung: "Automatisierung", status_recht: "Rechtsstatus", gueltig_ab: "Gültig ab",
  gueltig_bis: "Gültig bis", begriffe: "Fachbegriffe", begriff: "Begriff", titel_quelle: "Titel", url: "Adresse", abgerufen: "Abgerufen am",
  de: "Deutsch", en: "Englisch", radar: "Radar", wahrscheinlichkeit: "Wahrscheinlichkeit", versatz: "Versatz", datum: "Datum",
  verschiebung: "Verschiebung", faellig: "Fälligkeit", termine: "Termine", rhythmus: "Rhythmus", id: "ID", schwere: "Schwere",
};

/** Ajv-Meldungen in verständliches Deutsch für die Redaktion. */
export function meldungDeutsch(e) {
  const pfad = (e.instancePath || "").split("/").filter(Boolean).map((t) => (/^\d+$/.test(t) ? `Nr. ${Number(t) + 1}` : FELDNAMEN[t] ?? t)).join(" › ");
  const wo = pfad || "Pflicht";
  switch (e.keyword) {
    case "required": return `${wo}: „${FELDNAMEN[e.params.missingProperty] ?? e.params.missingProperty}“ fehlt`;
    case "minLength": return `${wo}: darf nicht leer sein`;
    case "minItems": return `${wo}: braucht mindestens ${e.params.limit} Eintrag${e.params.limit === 1 ? "" : "e"}`;
    case "enum": return `${wo}: muss einer dieser Werte sein: ${e.params.allowedValues.join(", ")}`;
    case "const": return `${wo}: muss „${e.params.allowedValue}“ sein`;
    case "format": return `${wo}: hat nicht das richtige Format (${e.params.format === "date" ? "Datum JJJJ-MM-TT" : e.params.format === "uri" ? "vollständige Adresse mit https://" : e.params.format})`;
    case "pattern": return `${wo}: hat nicht die erlaubte Form`;
    case "type": return `${wo}: falscher Typ (erwartet ${e.params.type})`;
    case "additionalProperties": return `${wo}: unbekanntes Feld „${e.params.additionalProperty}“`;
    case "minimum": case "maximum": case "exclusiveMinimum": return `${wo}: Wert außerhalb des erlaubten Bereichs`;
    case "oneOf": case "anyOf": return `${wo}: passt zu keiner erlaubten Variante`;
    case "if": return null; // Folgemeldung, die eigentliche Ursache steht separat
    case "variante": return `${wo}: unbekannte Art – ${e.params.art.endsWith("bedingung") ? "erlaubt sind all, any, not, immer, ereignis oder feld" : e.params.art.endsWith("frist") ? "typ muss dauerhaft, absolut, relativ oder wiederkehrend sein" : "art passt zu keiner erlaubten Fälligkeit"}`;
    default: return `${wo}: ${e.message}`;
  }
}

/**
 * Bei oneOf (Bedingung, Frist, …) meldet Ajv die Fehler aller Varianten – für Menschen unlesbar.
 * Hier wird die gemeinte Variante am Unterscheidungsmerkmal erkannt (Schlüssel bzw. typ/art) und nur
 * gegen diese erneut geprüft, rekursiv. Ohne erkennbares Merkmal bleibt „passt zu keiner Variante“.
 */
const SCHEMA_ID = "https://amtlos.de/schemas/pflicht/1.json";
const VARIANTE = {
  "/$defs/bedingung": (d) => (d && typeof d === "object" ? ({ all: "alle", any: "eine", not: "nicht", immer: "immer", ereignis: "ereignistest", feld: "vergleich" })[["all", "any", "not", "immer", "ereignis", "feld"].find((k) => k in d)] : undefined)?.replace(/^/, "/$defs/"),
  "/$defs/frist": (d) => ({ dauerhaft: "/$defs/fristDauerhaft", absolut: "/$defs/fristAbsolut", relativ: "/$defs/fristRelativ", wiederkehrend: "/$defs/fristWiederkehrend" })[d?.typ],
  "/$defs/fristWiederkehrend/properties/faellig": (d) => {
    const i = ["tag_nach_periodenende", "feste_termine", "n_letzter_bankarbeitstag"].indexOf(d?.art);
    return i < 0 ? undefined : `/$defs/fristWiederkehrend/properties/faellig/oneOf/${i}`;
  },
};
const liesPfad = (d, pfad) => pfad.split("/").filter(Boolean).reduce((x, k) => (x == null ? x : x[k.replace(/~1/g, "/").replace(/~0/g, "~")]), d);

function erklaere(validator, daten, praefix = "") {
  if (validator(daten)) return [];
  let errs = validator.errors.map((e) => ({ ...e, instancePath: praefix + e.instancePath }));
  const oneOfs = errs.filter((e) => e.keyword === "oneOf").sort((a, b) => a.instancePath.length - b.instancePath.length);
  const erledigt = [];
  for (const o of oneOfs) {
    if (erledigt.some((p) => o.instancePath.startsWith(p))) continue;
    const wahl = VARIANTE[SCHEMA_PFAD.get(o.parentSchema)]?.(liesPfad(daten, o.instancePath.slice(praefix.length)));
    const art = SCHEMA_PFAD.get(o.parentSchema);
    if (!VARIANTE[art]) continue;
    erledigt.push(o.instancePath);
    const unter = wahl ? ajv.getSchema(`${SCHEMA_ID}#${wahl}`) : undefined;
    if (!unter) {
      // Unterscheidungsmerkmal fehlt: eine klare Meldung statt der Fehler aller Varianten
      errs = [...errs.filter((e) => !(e.instancePath === o.instancePath || e.instancePath.startsWith(`${o.instancePath}/`))), { keyword: "variante", instancePath: o.instancePath, params: { art }, schemaPath: "" }];
      continue;
    }
    errs = [
      ...errs.filter((e) => !(e.instancePath === o.instancePath || e.instancePath.startsWith(`${o.instancePath}/`))),
      ...erklaere(unter, liesPfad(daten, o.instancePath.slice(praefix.length)), o.instancePath),
    ];
  }
  return errs;
}

/**
 * Prüft eine einzelne Regelwertversion (Schema und Plausibilität), deutsche Meldungen. Genutzt vom Studio.
 * @param {any} rw
 * @returns {string[]}
 */
export function pruefeRegelwertObjekt(rw) {
  if (!pruefeRegelwert(rw)) return [...new Set(pruefeRegelwert.errors.map(meldungDeutsch).filter(Boolean).map((m) => m.replace(/^Pflicht:/, "Regelwert:")))];
  const fehler = [];
  if (rw.gueltig_bis && rw.gueltig_bis < rw.gueltig_ab) fehler.push("Gültig bis: liegt vor „Gültig ab“");
  if (["EUR", "EUR_pro_stunde", "EUR_pro_monat", "anzahl", "tage", "monate", "jahre"].includes(rw.einheit) && rw.wert < 0) fehler.push("Wert: darf nicht negativ sein");
  if (rw.einheit === "prozent" && (rw.wert < 0 || rw.wert > 100)) fehler.push("Wert: Prozent zwischen 0 und 100");
  return fehler;
}

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
    return [...new Set(erklaere(pruefePflicht, p).map(meldungDeutsch).filter(Boolean))];
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
  if (f?.je_ereignis && !f?.bezug?.ereignis) fehler.push("frist.je_ereignis: nur mit Bezug auf ein Ereignis möglich");
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
  // Voraussetzungen dürfen keinen Kreis bilden (sonst ist im Gründungsassistenten nie etwas zu tun)
  const vor = new Map(pflichten.map((p) => [p.inhalt?.id, p.inhalt?.voraussetzungen ?? []]));
  const zustand = new Map();
  const besuche = (id, pfad) => {
    if (zustand.get(id) === "fertig") return;
    if (zustand.get(id) === "aktiv") { fehlerAus(`${id}.yaml`, `voraussetzungen bilden einen Kreis: ${[...pfad, id].join(" → ")}`); return; }
    zustand.set(id, "aktiv");
    for (const v of vor.get(id) ?? []) besuche(v, [...pfad, id]);
    zustand.set(id, "fertig");
  };
  for (const id of vor.keys()) besuche(id, []);

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

  // ---------- Rechtsstand (catalog/rechtsstand.yaml) ----------
  let rechtsstand = null;
  const rsDatei = path.join(katalogDir, "rechtsstand.yaml");
  if (fs.existsSync(rsDatei)) {
    rechtsstand = YAML.parse(fs.readFileSync(rsDatei, "utf8"));
    const datum = String(rechtsstand?.datum ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || Number.isNaN(Date.parse(datum))) fehlerAus("rechtsstand.yaml", "datum muss ein Datum JJJJ-MM-TT sein");
    if (rechtsstand?.hinweis != null && typeof rechtsstand.hinweis !== "string") fehlerAus("rechtsstand.yaml", "hinweis muss Text sein");
    const erlaubt = new Set(["datum", "hinweis"]);
    for (const k of Object.keys(rechtsstand ?? {})) if (!erlaubt.has(k)) fehlerAus("rechtsstand.yaml", `unbekanntes Feld '${k}'`);
  } else if (prod) fehlerAus("rechtsstand.yaml", "prod: Rechtsstand fehlt");

  return {
    fehler,
    rechtsstand,
    pflichten,
    regelwerte: [...regelwerte.values()].flat().map(({ datei: _d, ...rw }) => rw),
    fixtures,
    fakten: fakten.size,
    ereignisse: ereignisse.size,
  };
}
