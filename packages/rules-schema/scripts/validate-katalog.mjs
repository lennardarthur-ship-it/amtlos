#!/usr/bin/env node
// CLI: node validate-katalog.mjs <catalog-dir> [--prod]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validiereKatalog } from "../validieren.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const katalogDir = path.resolve(process.argv[2] ?? path.join(here, "../../../catalog"));
const prod = process.argv.includes("--prod");
const e = validiereKatalog(katalogDir, { prod });

if (e.fehler.length) {
  console.error(`✗ ${e.fehler.length} Fehler${prod ? " (prod-Modus)" : ""}:`);
  for (const f of e.fehler) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `✓ Katalog gültig${prod ? " (prod-Modus)" : ""}: ${e.pflichten.length} Pflichten, ${e.regelwerte.length} Regelwert-Versionen, ${e.fixtures.length} Fixtures, ${e.fakten} Fakten, ${e.ereignisse} Ereignistypen`,
);
