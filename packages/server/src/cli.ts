#!/usr/bin/env node
/**
 * Betriebs-Kommandos:
 *   amtlos-server migrieren            MIGRATION_DATABASE_URL, Verzeichnis db/migrations
 *   amtlos-server katalog-importieren  MIGRATION_DATABASE_URL (oder STUDIO_DATABASE_URL), Verzeichnis catalog/
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Datenbank } from "./datenbank.js";
import { importiereKatalog } from "./katalog-import.js";
import { migrieren } from "./migrieren.js";

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const [befehl] = process.argv.slice(2);

function umgebung(name: string): string {
  const wert = process.env[name];
  if (!wert) throw new Error(`Umgebungsvariable ${name} fehlt`);
  return wert;
}

async function main() {
  switch (befehl) {
    case "migrieren": {
      const e = await migrieren(umgebung("MIGRATION_DATABASE_URL"), process.env.MIGRATIONEN ?? path.join(wurzel, "db/migrations"));
      console.warn(`Migrationen: ${e.angewendet.length} neu (${e.angewendet.join(", ") || "–"}), ${e.bereitsVorhanden.length} vorhanden`);
      break;
    }
    case "katalog-importieren": {
      const db = new Datenbank(process.env.STUDIO_DATABASE_URL ?? umgebung("MIGRATION_DATABASE_URL"));
      try {
        const e = await importiereKatalog(db, process.env.KATALOG ?? path.join(wurzel, "catalog"));
        console.warn(e.unveraendert ? "Katalog unverändert – kein neues Release" : `Release ${e.release} veröffentlicht (${e.neuePflichtversionen} Pflicht-, ${e.neueRegelwertversionen} Regelwertversionen neu)`);
      } finally {
        await db.schliessen();
      }
      break;
    }
    default:
      console.error("Befehle: migrieren | katalog-importieren");
      process.exit(2);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
