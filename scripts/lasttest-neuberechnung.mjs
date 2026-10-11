#!/usr/bin/env node
/**
 * Lasttest Neuberechnung (Spezifikation 10: Lasttests; Ziel aus docs/01: 100.000 Unternehmen < 30 min).
 *
 *   PGHOST=… node scripts/lasttest-neuberechnung.mjs [anzahl=2000] [parallel=8]
 *
 * Legt eine eigene Datenbank amtlos_lasttest an (wird überschrieben), importiert den Katalog, erzeugt
 * `anzahl` Unternehmen mit den Persona-Profilen aus catalog/fixtures (reihum) und misst als Worker-Rolle:
 *   1. Erstberechnung (alle Pflichten neu, Erinnerungen planen) – wie nach einem Release mit neuem Katalog
 *   2. Tageswechsel (nichts ändert sich) – der tägliche Normalfall
 * Ausgabe: Durchsatz je Sekunde und hochgerechnete Dauer für 100.000 Unternehmen bei gleicher Parallelität.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import YAML from "yaml";
import { Datenbank, heute, importiereKatalog, neuberechnenInTx, planeErinnerungen } from "@amtlos/server";
import { WURZEL, frischeDatenbank, url } from "@amtlos/server/testhilfen";

const anzahl = Number(process.argv[2] ?? 2000);
const parallel = Number(process.argv[3] ?? 8);
const ZIEL = 100_000;
const DBNAME = "amtlos_lasttest";

const personas = fs
  .readdirSync(path.join(WURZEL, "catalog/fixtures"))
  .map((f) => YAML.parse(fs.readFileSync(path.join(WURZEL, "catalog/fixtures", f), "utf8")))
  .filter((f) => f.persona && f.fakten?.["profil.rechtsform"])
  .map((f) => Object.fromEntries(Object.entries(f.fakten).filter(([k]) => k.startsWith("profil.")).map(([k, v]) => [k.slice(7), v])));

console.log(`Lasttest: ${anzahl} Unternehmen, ${personas.length} Profilvarianten, Parallelität ${parallel}`);
const urls = await frischeDatenbank(DBNAME);
const studio = new Datenbank(urls.studio);
await importiereKatalog(studio, path.join(WURZEL, "catalog"));
await studio.schliessen();

// Stammdaten als Superuser in großen Blöcken anlegen (nicht Teil der Messung)
const admin = new pg.Client({ connectionString: url(process.env.PGUSER ?? "postgres", DBNAME) });
await admin.connect();
const t0 = Date.now();
await admin.query("insert into app.konto (idp_subject, email, anzeigename) values ('last', 'last@example.org', 'Last') ");
const konto = (await admin.query("select id from app.konto where idp_subject = 'last'")).rows[0].id;
for (let start = 0; start < anzahl; start += 1000) {
  const n = Math.min(1000, anzahl - start);
  const ids = (await admin.query("insert into app.unternehmen (name) select 'Last ' || g from generate_series($1::int, $2::int) g returning id", [start, start + n - 1])).rows.map((r) => r.id);
  await admin.query("insert into app.mitgliedschaft (unternehmen_id, konto_id, rolle) select u, $2, 'inhaber' from unnest($1::uuid[]) u", [ids, konto]);
  await admin.query(
    "insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) select u, 1, d, $3 from unnest($1::uuid[], $2::jsonb[]) as x(u, d)",
    [ids, ids.map((_, i) => JSON.stringify(personas[(start + i) % personas.length])), konto],
  );
}
const unternehmen = (await admin.query("select id from app.unternehmen order by erstellt_am")).rows.map((r) => r.id);
console.log(`Stammdaten angelegt in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const worker = new Datenbank({ connectionString: urls.worker, max: parallel + 2 });
const stichtag = heute();

async function durchlauf(name) {
  let naechster = 0;
  let fehler = 0;
  const dauern = [];
  const start = Date.now();
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      while (naechster < unternehmen.length) {
        const id = unternehmen[naechster++];
        const t = Date.now();
        try {
          await worker.imKontext({ unternehmenId: id }, async (tx) => {
            const r = await neuberechnenInTx(tx, id, `lasttest:${name}`, { stichtag });
            if (r.status === "berechnet") await planeErinnerungen(tx, id, stichtag);
          });
        } catch (e) {
          fehler++;
          if (fehler <= 3) console.error(e);
        }
        dauern.push(Date.now() - t);
      }
    }),
  );
  const sek = (Date.now() - start) / 1000;
  dauern.sort((a, b) => a - b);
  const q = (p) => dauern[Math.min(dauern.length - 1, Math.floor(dauern.length * p))];
  const proSek = unternehmen.length / sek;
  const hochgerechnet = ZIEL / proSek / 60;
  const r = { name, unternehmen: unternehmen.length, sekunden: +sek.toFixed(1), je_sekunde: +proSek.toFixed(1), p50_ms: q(0.5), p95_ms: q(0.95), p99_ms: q(0.99), fehler, minuten_fuer_100k: +hochgerechnet.toFixed(1) };
  console.log(JSON.stringify(r));
  return r;
}

const erst = await durchlauf("erstberechnung");
const taeglich = await durchlauf("tageswechsel");
const groesse = (await admin.query(
  "select pg_size_pretty(pg_database_size(current_database())) as db, (select count(*) from app.pflicht_instanz)::int as instanzen, (select count(*) from app.erinnerung)::int as erinnerungen, (select count(*) from app.berechnungslauf)::int as laeufe",
)).rows[0];
console.log(JSON.stringify({ groesse }));
await worker.schliessen();
await admin.end();

const ok = erst.fehler === 0 && taeglich.fehler === 0 && taeglich.minuten_fuer_100k < 30;
console.log(ok ? `✓ Ziel erreicht: Tageswechsel für 100.000 Unternehmen ≈ ${taeglich.minuten_fuer_100k} min (< 30)` : `✗ Ziel verfehlt oder Fehler`);
process.exit(ok ? 0 : 1);
