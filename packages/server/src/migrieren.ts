import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { PGBOSS_SCHEMA, erzeugeWarteschlange, queuesAnlegen } from "./warteschlange.js";

export interface MigrationsErgebnis {
  angewendet: string[];
  bereitsVorhanden: string[];
}

/**
 * Spielt db/migrations/*.sql in Reihenfolge ein (als Eigentümer-Rolle).
 * Jede Migration läuft in einer eigenen Transaktion; eine bereits angewendete Migration mit
 * geänderter Prüfsumme bricht ab (Migrationen sind nach dem Einspielen unveränderlich).
 * Danach: pg-boss-Schema anlegen und den Anwendungsrollen Zugriff geben.
 */
export async function migrieren(verbindung: string, verzeichnis: string): Promise<MigrationsErgebnis> {
  const client = new pg.Client({ connectionString: verbindung });
  await client.connect();
  const ergebnis: MigrationsErgebnis = { angewendet: [], bereitsVorhanden: [] };
  try {
    await client.query("create schema if not exists betrieb");
    await client.query(`create table if not exists betrieb.schema_migration (
      name text primary key, sha256 text not null, angewendet_am timestamptz not null default now())`);
    const vorhanden = new Map(
      (await client.query<{ name: string; sha256: string }>("select name, sha256 from betrieb.schema_migration")).rows.map((r) => [r.name, r.sha256]),
    );
    const dateien = fs.readdirSync(verzeichnis).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
    for (const datei of dateien) {
      const sql = fs.readFileSync(path.join(verzeichnis, datei), "utf8");
      const sha = createHash("sha256").update(sql).digest("hex");
      const alt = vorhanden.get(datei);
      if (alt) {
        if (alt !== sha) throw new Error(`Migration ${datei} wurde nach dem Einspielen geändert (Prüfsumme). Neue Migration anlegen.`);
        ergebnis.bereitsVorhanden.push(datei);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into betrieb.schema_migration (name, sha256) values ($1, $2)", [datei, sha]);
        await client.query("commit");
        ergebnis.angewendet.push(datei);
      } catch (e) {
        await client.query("rollback");
        throw new Error(`Migration ${datei} fehlgeschlagen: ${(e as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }

  const boss = erzeugeWarteschlange(verbindung, { migrieren: true });
  boss.on("error", () => undefined);
  await boss.start();
  await queuesAnlegen(boss);
  await boss.stop({ graceful: false, wait: true });

  const c2 = new pg.Client({ connectionString: verbindung });
  await c2.connect();
  try {
    for (const rolle of ["amtlos_app", "amtlos_worker", "amtlos_studio"]) {
      await c2.query(`grant usage on schema ${PGBOSS_SCHEMA} to ${rolle}`);
      await c2.query(`grant select, insert, update, delete on all tables in schema ${PGBOSS_SCHEMA} to ${rolle}`);
      await c2.query(`grant usage, select on all sequences in schema ${PGBOSS_SCHEMA} to ${rolle}`);
      await c2.query(`grant execute on all functions in schema ${PGBOSS_SCHEMA} to ${rolle}`);
      await c2.query(`alter default privileges in schema ${PGBOSS_SCHEMA} grant select, insert, update, delete on tables to ${rolle}`);
    }
  } finally {
    await c2.end();
  }
  return ergebnis;
}
