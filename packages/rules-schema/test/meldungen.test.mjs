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
