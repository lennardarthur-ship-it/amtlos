#!/usr/bin/env node
/**
 * Betriebs-Kommandos:
 *   amtlos-server migrieren            MIGRATION_DATABASE_URL, Verzeichnis db/migrations
 *   amtlos-server katalog-importieren  MIGRATION_DATABASE_URL (oder STUDIO_DATABASE_URL), Verzeichnis catalog/
 *   amtlos-server umgebung <dev|test|staging|prod>            setzt katalog.plattform (nur Eigentümer)
 *   amtlos-server plattformrolle <sub> <email> <name> <rolle> [qualifikation=nachweis]
 *                                       legt Konto, Plattformrolle und optional Qualifikation an
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
    case "umgebung": {
      const ziel = process.argv[3];
      if (!["dev", "test", "staging", "prod"].includes(ziel ?? "")) throw new Error("umgebung <dev|test|staging|prod>");
      const db = new Datenbank(umgebung("MIGRATION_DATABASE_URL"));
      try {
        await db.imKontext({}, (tx) => tx.abfrage("update katalog.plattform set umgebung = $1", [ziel]));
        console.warn(`Umgebung: ${ziel}`);
      } finally {
        await db.schliessen();
      }
      break;
    }
    case "plattformrolle": {
      const [sub, email, name, rolle, qual] = process.argv.slice(3);
      if (!sub || !email || !name || !["plattform_admin", "redaktion", "experte", "support"].includes(rolle ?? ""))
        throw new Error("plattformrolle <sub> <email> <name> <plattform_admin|redaktion|experte|support> [qualifikation=nachweis]");
      const db = new Datenbank(umgebung("MIGRATION_DATABASE_URL"));
      try {
        await db.imKontext({}, async (tx) => {
          const k = await tx.eine<{ id: string }>("select app.konto_anmelden($1, $2, $3) as id", [sub, email, name]);
          await tx.abfrage("insert into app.konto_plattform_rolle values ($1, $2) on conflict do nothing", [k!.id, rolle]);
          if (qual) {
            const [art, nachweis] = qual.split("=");
            await tx.abfrage(
              "insert into katalog.experte_qualifikation (konto_id, art, nachweis) values ($1, $2, $3) on conflict (konto_id, art) do update set nachweis = excluded.nachweis",
              [k!.id, art, nachweis ?? "ohne Nachweis"],
            );
          }
        });
        console.warn(`Plattformrolle ${rolle} für ${sub} gesetzt${qual ? ` (${qual.split("=")[0]})` : ""}`);
      } finally {
        await db.schliessen();
      }
      break;
    }
    default:
      console.error("Befehle: migrieren | katalog-importieren | umgebung | plattformrolle");
      process.exit(2);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
