/**
 * E-223 (externer Prüfer, Befunde a und b): Was intern ist, bleibt intern – und „freigegeben“ heißt ohne offene Prüfmarke.
 *
 * (a) `markerBefunde(wurzel)`: Kein freigegebener Katalogeintrag und kein freigegebener Regelwert trägt eine Prüfmarke
 *     („[FACHLICH ZU PRÜFEN]“, „fachlich zu prüfen“, „TODO“, „Platzhalter“) – in Texten und Daten nie, in der internen Notiz
 *     `fachlich_zu_pruefen` einer Pflicht nur, wenn der Punkt in docs/freigabe-katalog/offene-punkte.yaml eingeordnet ist
 *     (`offen` → die App zeigt „teilweise geprüft“; `erledigt` mit Grund, E-196). Regelwerte haben keine solche
 *     Einordnung: dort gar keine Marke. Vorlagen regelt schon pruefstaende.ts (Stellen mit „fachlich zu prüfen“ ⇒ Vermerk
 *     „teilweise durchgesehen“, Test e223-interna).
 * (b) `ohneInterna(eintrag)`: was katalog-buendel.mjs ins Bündel der App schreibt – ohne Notizen der Redaktion, ohne
 *     Katalognummer, ohne Wahrscheinlichkeit und Vorbereitung des Radars, vom Prüfstand nur, was der
 *     Vermerk braucht. `buendelBefunde(text)`: verbotene Felder, Marken und Namen der Prüfer (SHA-256-Abgleich mit
 *     docs/freigabe-katalog/namen-sha256.json) in einer Datei des Bündels, des Web-Exports oder der Website.
 *
 * Genutzt von katalog-buendel.mjs, store-check.mjs und apps/mobile/test/e223-interna.test.ts.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml");

/** Prüfmarken, die in einer freigegebenen Fassung nicht mehr offen stehen dürfen */
export const MARKER = /\[FACHLICH ZU PRÜFEN|fachlich zu prüfen|\bTODO\b|Platzhalter/i;

/** Vom Prüfstand braucht die App nur das (pruefer.ts: istGeprueft, pruefVermerk) – Rollen, nie Namen */
export const PRUEFUNG_FELDER = ["status", "geprueft_von", "geprueft_am", "geprueft_version", "bestaetigt_am", "einschraenkung", "offen"];
/** Felder, die nie ins Bündel gehören (intern oder nicht geprüft und nicht angezeigt) */
export const INTERNE_FELDER = ["fachlich_zu_pruefen", "katalog_nr"];
export const INTERNE_RADAR_FELDER = ["wahrscheinlichkeit", "vorbereitung"];

/** Katalogeintrag bzw. Regelwert so, wie er ins Bündel der App geht */
export function ohneInterna(e) {
  const aus = Object.fromEntries(Object.entries(e).filter(([k]) => !INTERNE_FELDER.includes(k)));
  if (aus.pruefung && typeof aus.pruefung === "object") aus.pruefung = Object.fromEntries(Object.entries(aus.pruefung).filter(([k]) => PRUEFUNG_FELDER.includes(k)));
  if (aus.radar && typeof aus.radar === "object") aus.radar = Object.fromEntries(Object.entries(aus.radar).filter(([k]) => !INTERNE_RADAR_FELDER.includes(k)));
  return aus;
}

const lesen = (p) => YAML.parse(fs.readFileSync(p, "utf8"));
const yamlDateien = (o) => fs.readdirSync(o).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => path.join(o, f));
const texte = (x, pfad = "", aus = []) => {
  if (typeof x === "string") aus.push([pfad, x]);
  else if (Array.isArray(x)) x.forEach((y, i) => texte(y, `${pfad}[${i}]`, aus));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) texte(v, pfad ? `${pfad}.${k}` : k, aus);
  return aus;
};

/** (a) Freigegebene Pflichten und Regelwerte mit offener Prüfmarke – leer, wenn alles in Ordnung ist */
export function markerBefunde(wurzel = WURZEL) {
  const befunde = [];
  const op = lesen(path.join(wurzel, "docs/freigabe-katalog/offene-punkte.yaml")) ?? {};
  const eingeordnet = new Set([...(op.offen ?? []), ...(op.erledigt ?? [])].map((p) => `${p.id}|${p.punkt}`));
  for (const f of yamlDateien(path.join(wurzel, "catalog/pflichten"))) {
    const d = lesen(f);
    if (d?.pruefung?.status !== "freigegeben") continue;
    const { fachlich_zu_pruefen: notizen, pruefung: _p, ...inhalt } = d;
    for (const [feld, t] of texte(inhalt)) if (MARKER.test(t)) befunde.push(`${d.id}@${d.version} ${feld}: ${t.slice(0, 80)}`);
    for (const t of notizen ?? []) if (MARKER.test(String(t)) && !eingeordnet.has(`${d.id}|${String(t).slice(0, 60)}`)) befunde.push(`${d.id}@${d.version} fachlich_zu_pruefen (nicht in offene-punkte.yaml eingeordnet): ${String(t).slice(0, 80)}`);
  }
  for (const f of yamlDateien(path.join(wurzel, "catalog/regelwerte")))
    for (const r of [lesen(f)].flat()) {
      if (r?.pruefung?.status !== "freigegeben") continue;
      const { pruefung: _p, ...inhalt } = r;
      for (const [feld, t] of texte(inhalt)) if (MARKER.test(t)) befunde.push(`Regelwert ${r.id}@${r.version} ${feld}: ${t.slice(0, 80)}`);
    }
  return befunde;
}

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
let namen;
/** (b) Verbotenes in einer Datei des Bündels: interne Felder, Prüfmarken der Redaktion, Namen der Prüfer */
export function buendelBefunde(roh, { katalog = false, wurzel = WURZEL } = {}) {
  // gebündeltes JavaScript schreibt Umlaute als \xFC bzw. \u00FC – vor dem Suchen zurückwandeln
  const text = roh.replace(/\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})/g, (_, x, u) => String.fromCharCode(parseInt(x ?? u, 16)));
  const befunde = [];
  if (text.includes("fachlich_zu_pruefen")) befunde.push("Feld „fachlich_zu_pruefen“");
  if (text.includes("[FACHLICH ZU PRÜFEN")) befunde.push("Marke „[FACHLICH ZU PRÜFEN]“");
  if (katalog) {
    // nur in Katalogdaten: die Schlüssel der internen Felder und die Notizmarke „Offen:“ (UI-Texte der App sagen „Offen: …“)
    for (const k of [...INTERNE_FELDER, ...INTERNE_RADAR_FELDER, "geprueft_von_namen", "nachweis", "aufbewahrung"]) if (text.includes(`"${k}":`)) befunde.push(`Feld „${k}“`);
    for (const m of text.matchAll(/"pruefung":\{([^{}]*)\}/g)) for (const k of m[1].matchAll(/"([a-z_]+)":/g)) if (!PRUEFUNG_FELDER.includes(k[1])) befunde.push(`Prüfstand mit Feld „${k[1]}“`);
    if (/\bOffen:/.test(text)) befunde.push("Notizmarke „Offen:“");
    if (MARKER.test(text)) befunde.push(`Prüfmarke „${text.match(MARKER)[0]}“`);
  }
  namen ??= JSON.parse(fs.readFileSync(path.join(wurzel, "docs/freigabe-katalog/namen-sha256.json"), "utf8"));
  const einzeln = new Set(namen.einzeln);
  const paare = new Set(namen.paare);
  const w = text.toLowerCase().match(/[a-zäöüß]+/g) ?? [];
  const wort = new Set(w);
  const paar = new Set(w.slice(1).map((b, i) => `${w[i]} ${b}`));
  if ([...wort].some((x) => einzeln.has(sha(x))) || [...paar].some((x) => paare.has(sha(x)))) befunde.push("Name eines Prüfers");
  return [...new Set(befunde)];
}

/** Dateien, die mit der App bzw. Website ausgeliefert werden: Katalogbündel, Web-Export (falls gebaut), Website (falls gebaut) */
export function auslieferung(wurzel = WURZEL) {
  const app = path.join(wurzel, "apps/mobile");
  const dateien = [path.join(app, "src/pflichten/katalog.json"), path.join(app, "src/unterlagen/katalog.json")].map((p) => ({ datei: p, katalog: true }));
  const rein = (o) => {
    if (!fs.existsSync(o)) return;
    for (const e of fs.readdirSync(o, { withFileTypes: true })) {
      const p = path.join(o, e.name);
      if (e.isDirectory()) rein(p);
      else if (/\.(js|json|html|txt|xml|map)$/.test(e.name)) dateien.push({ datei: p, katalog: false });
    }
  };
  rein(path.join(app, "web-export"));
  rein(path.join(wurzel, "apps/website/dist"));
  return dateien;
}
