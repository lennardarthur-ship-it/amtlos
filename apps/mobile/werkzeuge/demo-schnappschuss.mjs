#!/usr/bin/env node
/**
 * Schnappschuss für den Demo-Modus (E-119): holt Heute, Pflichten, Pflicht-Karten, Profil, Beschäftigte und Abo
 * eines Testkontos von einer laufenden API (AUTH_MODUS=dev) und schreibt src/demo/daten.json.
 * Inhalte kommen unverändert aus dem Katalog – nichts wird erfunden. Nur Firmen- und Kontoname werden ersetzt.
 *
 *   node werkzeuge/demo-schnappschuss.mjs http://localhost:3901 <kennung>
 */
import fs from "node:fs";
const [basis = "http://localhost:3901", kennung] = process.argv.slice(2);
if (!kennung) throw new Error("Kennung fehlt");
const { token } = await (await fetch(`${basis}/v1/dev/token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kennung }) })).json();
const ich = await (await fetch(`${basis}/v1/ich`, { headers: { Authorization: `Bearer ${token}` } })).json();
const u = ich.unternehmen[0].id;
const hole = async (pfad, sprache = "de") => {
  const r = await fetch(`${basis}${pfad}`, { headers: { Authorization: `Bearer ${token}`, "X-Unternehmen-Id": u, "X-Sprache": sprache } });
  if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
  return r.json();
};
const heute = new Date().toISOString().slice(0, 10);
const daten = { stand: heute, sprachen: {} };
for (const sprache of ["de", "en"]) {
  const pflichten = (await hole("/v1/pflichten?status=alle", sprache)).filter((k) => k.status !== "nicht_zutreffend");
  const details = {};
  for (const k of pflichten) details[`${k.pflicht_id}|${k.periode}`] = await hole(`/v1/pflichten/${encodeURIComponent(k.pflicht_id)}/${encodeURIComponent(k.periode)}`, sprache);
  daten.sprachen[sprache] = { heute: await hole("/v1/heute", sprache), pflichten, details };
}
daten.profil = await hole("/v1/profil");
daten.beschaeftigte = (await hole("/v1/beschaeftigte")).map(({ id, vorname, nachname, austritt }) => ({ id, vorname, nachname, austritt }));
daten.abo = await hole("/v1/abo");
const ziel = new URL("../src/demo/daten.json", import.meta.url);
fs.mkdirSync(new URL(".", ziel), { recursive: true });
fs.writeFileSync(ziel, JSON.stringify(daten));
console.log(`✓ ${daten.sprachen.de.pflichten.length} Pflichten, ${fs.statSync(ziel).size} Bytes → src/demo/daten.json`);
