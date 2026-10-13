/**
 * Startet die API für den Synchronisations-Rundgang (E-134): frische Datenbank, AUTH_MODUS=dev, CORS für den
 * Web-Export auf Port 4998. Braucht Postgres wie die API-Tests (PGHOST, PGPORT, PGUSER, PGPASSWORD) und eine gebaute
 * API (`npx turbo run build --filter=@amtlos/api`).
 *
 *   node e2e/sync-server.mjs            # API auf http://localhost:3001
 */
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const api = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../api");
const require = createRequire(path.join(api, "package.json"));
const { frischeDatenbank } = await import(pathToFileURL(require.resolve("@amtlos/server/testhilfen")).href);
const { erzeugeApp } = await import(pathToFileURL(path.join(api, "dist/main.js")).href);

const urls = await frischeDatenbank("amtlos_sync_e2e");
const app = await erzeugeApp({
  UMGEBUNG: "test",
  PORT: 3001,
  DATABASE_URL: urls.api,
  AUTH_MODUS: "dev",
  DEV_JWT_SECRET: "e2e-geheimnis-mindestens-zweiunddreissig-zeichen",
  WEB_URL: "http://localhost:4998",
  API_URL: "http://localhost:3001",
  RATE_ANGEMELDET: 10_000,
  RATE_ANONYM: 10_000,
  ONLINECHECK_PRIVATE_NETZE: "verboten",
  ONLINECHECK_JE_TAG: 20,
  ABO_TESTTAGE: 14,
});
await app.listen(3001);
console.warn("API für den Sync-Rundgang auf http://localhost:3001");
