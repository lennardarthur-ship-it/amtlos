// Verständliche Fehlermeldungen für die Redaktion (Studio). Ausführen: node --test test/
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import YAML from "yaml";
import { pruefePflichtObjekt } from "../validieren.mjs";

const basis = YAML.parse(fs.readFileSync(new URL("../../../catalog/pflichten/arbeitsschutz.gefaehrdungsbeurteilung.yaml", import.meta.url), "utf8"));
const ctx = { regelwertIds: new Set(), pflichtIds: new Set() };
const pruefe = (x) => pruefePflichtObjekt({ ...basis, ...x }, ctx);

test("gültige Pflicht hat keine Meldungen", () => assert.deepEqual(pruefe({}), []));
test("leere Pflichttexte", () => assert.deepEqual(pruefe({ titel: { de: "" } }), ["Titel › Deutsch: darf nicht leer sein"]));
test("Bedingung: nur die gemeinte Variante wird gemeldet", () => {
  assert.deepEqual(pruefe({ ausloeser: { feld: "profil.beschaeftigte.gesamt", op: ">=" } }), ["Auslöser: „Wert“ fehlt"]);
  assert.deepEqual(pruefe({ ausloeser: { all: [{ feld: "profil.beschaeftigte.gesamt", op: ">=" }] } }), ["Auslöser › all › Nr. 1: „Wert“ fehlt"]);
  assert.deepEqual(pruefe({ ausloeser: { gibts: 1 } }), ["Auslöser: unbekannte Art – erlaubt sind all, any, not, immer, ereignis oder feld"]);
});
test("Frist: Variante nach typ, Format in Klartext", () => {
  assert.deepEqual(pruefe({ frist: { typ: "relativ" } }), ["Frist: „bezug“ fehlt", "Frist: „Versatz“ fehlt", "Frist: „Verschiebung“ fehlt"]);
  assert.deepEqual(pruefe({ frist: { typ: "absolut", datum: "31.12.2026", verschiebung: { regel: "keine", kalender: "bundesland" } } }), ["Frist › Datum: hat nicht das richtige Format (Datum JJJJ-MM-TT)"]);
});
test("Querverweise", () => {
  assert.deepEqual(pruefe({ ausloeser: { feld: "profil.gibt_es_nicht", op: "==", wert: 1 } }), ["ausloeser: unbekannter Fakt 'profil.gibt_es_nicht'"]);
});

test("Voraussetzungen im Kreis werden gemeldet", async () => {
  const os = await import("node:os");
  const path = await import("node:path");
  const { validiereKatalog } = await import("../validieren.mjs");
  const ziel = fs.mkdtempSync(path.join(os.tmpdir(), "katalog-"));
  fs.cpSync(new URL("../../../catalog", import.meta.url), ziel, { recursive: true });
  const datei = path.join(ziel, "pflichten/gruendung.elster_konto.yaml");
  const p = YAML.parse(fs.readFileSync(datei, "utf8"));
  p.voraussetzungen = ["gruendung.fragebogen_steuerliche_erfassung"];
  fs.writeFileSync(datei, YAML.stringify(p));
  const r = validiereKatalog(ziel);
  assert.ok(r.fehler.some((f) => f.includes("voraussetzungen bilden einen Kreis")), r.fehler.join("\n"));
  fs.rmSync(ziel, { recursive: true });
});

test("Regelwert: deutsche Meldungen und Plausibilität", async () => {
  const { pruefeRegelwertObjekt } = await import("../validieren.mjs");
  const rw = { schema_version: 1, id: "a.b", version: 1, bezeichnung: { de: "X" }, einheit: "prozent", wert: 25, gueltig_ab: "2026-01-01", status_recht: "in_kraft", rechtsgrundlage: ["§ 1"], quellen: [{ titel: "Q", url: "https://example.org", abgerufen: null }] };
  assert.deepEqual(pruefeRegelwertObjekt(rw), []);
  assert.deepEqual(pruefeRegelwertObjekt({ ...rw, wert: 120 }), ["Wert: Prozent zwischen 0 und 100"]);
  assert.deepEqual(pruefeRegelwertObjekt({ ...rw, rechtsgrundlage: [] }), ["Rechtsgrundlagen: braucht mindestens 1 Eintrag"]);
  assert.deepEqual(pruefeRegelwertObjekt({ ...rw, gueltig_bis: "2025-01-01" }), ["Gültig bis: liegt vor „Gültig ab“"]);
});
