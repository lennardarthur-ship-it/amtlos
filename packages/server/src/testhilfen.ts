/**
 * NUR FÜR TESTS (Subpath @amtlos/server/testhilfen, nicht im Haupt-Export).
 * Frische Testdatenbank mit allen Migrationen, wie in Produktion: Schema als Nicht-Superuser-Eigentümer,
 * Dienste als eigene Login-Rollen (api_user ∈ amtlos_app, worker_user ∈ amtlos_worker, studio_user ∈ amtlos_studio).
 * Verbindung über PGHOST/PGPORT/PGUSER/PGPASSWORD (Superuser).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrieren } from "./migrieren.js";

export const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const DB_VERFUEGBAR = Boolean(process.env.PGHOST);
if (process.env.AMTLOS_DB_TESTS === "pflicht" && !DB_VERFUEGBAR) throw new Error("AMTLOS_DB_TESTS=pflicht, aber PGHOST fehlt");

export function url(benutzer: string, datenbank: string): string {
  const host = process.env.PGHOST ?? "localhost";
  const port = process.env.PGPORT ?? "5432";
  const pw = process.env.PGPASSWORD;
  const auth = pw ? `${benutzer}:${encodeURIComponent(pw)}` : benutzer;
  return host.startsWith("/")
    ? `postgresql://${auth}@localhost:${port}/${datenbank}?host=${encodeURIComponent(host)}`
    : `postgresql://${auth}@${host}:${port}/${datenbank}`;
}

const ROLLEN: [string, string | null][] = [
  ["amtlos_owner", null],
  ["amtlos_app", null],
  ["amtlos_studio", null],
  ["amtlos_worker", null],
  ["api_user", "amtlos_app"],
  ["studio_user", "amtlos_studio"],
  ["worker_user", "amtlos_worker"],
];

export async function frischeDatenbank(name: string): Promise<{ owner: string; api: string; worker: string; studio: string }> {
  const admin = new pg.Client({ connectionString: url(process.env.PGUSER ?? "postgres", "postgres") });
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.query(`create database ${name}`);
    const pw = process.env.PGPASSWORD;
    for (const [rolle, gruppe] of ROLLEN) {
      const login = rolle.endsWith("_user") || rolle === "amtlos_owner";
      const existiert = (await admin.query("select 1 from pg_roles where rolname = $1", [rolle])).rowCount;
      if (!existiert) await admin.query(`create role ${rolle} ${login ? "login" : "nologin"}${gruppe ? ` in role ${gruppe}` : ""}`);
      if (login && pw) await admin.query(`alter role ${rolle} password '${pw.replaceAll("'", "''")}'`);
    }
  } finally {
    await admin.end();
  }
  const adminDb = new pg.Client({ connectionString: url(process.env.PGUSER ?? "postgres", name) });
  await adminDb.connect();
  try {
    await adminDb.query("create extension pgcrypto; create extension citext; create extension btree_gist;");
    await adminDb.query(`grant create on database ${name} to amtlos_owner`);
  } finally {
    await adminDb.end();
  }
  await migrieren(url("amtlos_owner", name), path.join(WURZEL, "db/migrations"));
  return { owner: url("amtlos_owner", name), api: url("api_user", name), worker: url("worker_user", name), studio: url("studio_user", name) };
}
