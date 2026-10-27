#!/usr/bin/env node
/**
 * Katalogauszug fürs Gerät (E-121): aus catalog/pflichten nur die Pflichten, die eine Vorlage belegt (aus dem gebauten
 * @amtlos/fachlogik – vorher „pnpm build“), und nur die Angaben, die die App zeigt (Titel, Kurztext, Rechtsgrundlage,
 * Quellen, Prüfstand). Inhalte werden nicht verändert. Schreibt src/unterlagen/katalog.json; die CI prüft die Aktualität.
 *
 * Für den Pflichten-Check (E-126) zusätzlich den ganzen Katalog für die Regel-Engine: alle Pflichten und Regelwerte,
 * nur deutsch, ohne die Prüfnotizen der Redaktion → src/pflichten/katalog.json.
 *
 * E-223: Nichts Internes ins Bündel (es ist nach dem Entpacken der App lesbar): ohne `fachlich_zu_pruefen` (Pflichten UND
 * Regelwerte), ohne Katalognummer (die App zeigt sie nicht), ohne Wahrscheinlichkeit und Vorbereitung des Radars (nicht angezeigt, nicht geprüft – offene-punkte.yaml
 * „nicht_angezeigt“) und vom Prüfstand nur, was der Vermerk braucht (Status, Rollen, Daten, Version, Einschränkung,
 * offene Themen) – keine Namen, keine Notizen. werkzeuge/interna.mjs prüft das Bündel (Test e223, store-check).
 *
 * E-233: Einträge mit `nicht_vor_freigabe: true` (neu nach dem Startstand) kommen erst mit ihrer Freigabe ins Bündel –
 * bis dahin zeigt die App sie gar nicht (statt „fachlich noch nicht geprüft“); interna.mjs `zurueckgehalten`.
 *
 * Marke (docs/14-marke.md): Die redaktionellen Katalogtexte (catalog/, versioniert und geprüft) nennen die App „Amtlos“.
 * Im Bündel steht stattdessen der sichtbare Name aus packages/marke/marke.json – nach einer Umbenennung neu bündeln.
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
const { MARKE } = await import(path.join(wurzel, "packages/marke/index.js"));
/** Produktname der Katalogtexte („Amtlos“, „Amtlos Pro“) → sichtbare Marke, in allen Zeichenketten */
const markeText = (t) => t.replace(/\bAmtlos Pro\b/g, MARKE.proName).replace(/\bAmtlos\b/g, MARKE.name);
const mitMarke = (d) => (typeof d === "string" ? markeText(d) : Array.isArray(d) ? d.map(mitMarke) : d && typeof d === "object" ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, mitMarke(v)])) : d);
const benutzt = new Set(VORLAGEN.flatMap((v) => v.pflichten));
const { ohneInterna, zurueckgehalten } = await import("./interna.mjs");

const pflichten = fs
  .readdirSync(ordner)
  .filter((f) => /\.ya?ml$/.test(f))
  .sort()
  .map((f) => YAML.parse(fs.readFileSync(path.join(ordner, f), "utf8")))
  .filter((p) => benutzt.has(p.id) && !zurueckgehalten(p))
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
fs.writeFileSync(ziel, JSON.stringify(mitMarke(pflichten), null, 1) + "\n");
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
const roh = lesenAlle(ordner);
const zurueck = roh.filter(zurueckgehalten).map((p) => p.id);
const voll = roh.filter((p) => !zurueckgehalten(p)).map((p) => nurDeutsch(ohneInterna(p)));
const regelwerte = lesenAlle(path.join(wurzel, "catalog/regelwerte")).flatMap((x) => (Array.isArray(x) ? x : [x])).map((r) => nurDeutsch(ohneInterna(r)));
// Rechtsstand des ganzen Katalogs (catalog/rechtsstand.yaml) → katalog.rechtsstand, in der App über rechtsstandText(KATALOG)
const rechtsstandRoh = YAML.parse(fs.readFileSync(path.join(wurzel, "catalog/rechtsstand.yaml"), "utf8"));
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rechtsstandRoh?.datum))) throw new Error("catalog/rechtsstand.yaml: datum (JJJJ-MM-TT) fehlt");
// E-223: nur das Datum – der Hinweis ist eine Notiz der Redaktion (die App zeigt ihn nicht)
const rechtsstand = { datum: String(rechtsstandRoh.datum) };
const zielVoll = path.join(hier, "../src/pflichten/katalog.json");
fs.mkdirSync(path.dirname(zielVoll), { recursive: true });
fs.writeFileSync(zielVoll, JSON.stringify(mitMarke({ rechtsstand, pflichten: voll, regelwerte })) + "\n");
console.log(`✓ ${voll.length} Pflichten, ${regelwerte.length} Regelwerte, Rechtsstand ${rechtsstand.datum} (${Math.round(fs.statSync(zielVoll).size / 1024)} KB) → src/pflichten/katalog.json`);
if (zurueck.length) console.log(`ℹ ${zurueck.length} Eintrag/Einträge bis zur Freigabe zurückgehalten (nicht im Bündel, E-233): ${zurueck.join(", ")}`);
// E-211: Regelwerte mit eigenem Prüfstand – nicht bestätigte, auf die Pflichten verweisen, nennt der Vermerk der Pflicht;
// store-check meldet sie als Startblocker. Hier nur der Hinweis (das Bündel braucht alle Werte, sonst rechnet die Engine „unbekannt“).
{
  const ids = new Set(JSON.stringify(voll).match(/"regelwert":"[a-z0-9_.]+"/g)?.map((m) => m.slice(13, -1)) ?? []);
  const offen = regelwerte.filter((r) => ids.has(r.id) && !(r.pruefung?.status === "freigegeben" && r.pruefung.geprueft_version === r.version && r.pruefung.bestaetigt_am));
  if (offen.length) console.log(`⚠ ${offen.length} von Pflichten verwendete Regelwert-Versionen noch nicht fachlich bestätigt (Vermerk nennt sie, store-check: Startblocker)`);
}
