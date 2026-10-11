import "server-only";
import path from "node:path";
import { redirect } from "next/navigation";
import { cache } from "react";
import type PgBoss from "pg-boss";
import { Datenbank, JOBS, erzeugeWarteschlange, studioKonto, type StudioKonto, type Tx } from "@amtlos/server";
import { sitzung } from "@amtlos/web-kern/sitzung";

/**
 * Das Studio spricht direkt mit der Datenbank – als Rolle amtlos_studio, die Katalogdaten schreiben,
 * aber keine Mandantendaten lesen kann (0001, Schema-Test „Studio-Rolle hat keinen Zugriff“).
 */
let db: Datenbank | undefined;
let boss: Promise<PgBoss> | undefined;

function verbindung(): string {
  const url = process.env.STUDIO_DATABASE_URL;
  if (!url) throw new Error("STUDIO_DATABASE_URL fehlt");
  return url;
}

export function datenbank(): Datenbank {
  db ??= new Datenbank({ connectionString: verbindung(), max: 5 });
  return db;
}

export function fixtureVerzeichnis(): string {
  return process.env.KATALOG_DIR ? path.join(process.env.KATALOG_DIR, "fixtures") : path.resolve(process.cwd(), "../../catalog/fixtures");
}

/** Rollout nach Release: Tageswechsel-Job verteilt die Neuberechnung auf alle Unternehmen (Worker). */
export async function rollout(tx: Tx, nummer: string): Promise<void> {
  boss ??= (async () => {
    const b = erzeugeWarteschlange(verbindung());
    b.on("error", (e) => console.error("Warteschlange:", e.message));
    await b.start();
    return b;
  })();
  await (await boss).send(JOBS.tageswechsel, { grund: `release:${nummer}` }, { db: { executeSql: (text: string, values: unknown[]) => tx.client.query(text, values) } });
}

/** Angemeldete Person mit Plattformrolle – sonst Anmeldung bzw. „Kein Zugang“. */
export const ich = cache(async (): Promise<StudioKonto> => {
  const s = await sitzung();
  if (!s) redirect("/anmelden");
  const k = await studioKonto(datenbank(), s.sub);
  if (!k) redirect("/kein-zugang");
  return k;
});

export const darfRedigieren = (k: StudioKonto) => k.rollen.includes("redaktion") || k.rollen.includes("plattform_admin");
export const darfPruefen = (k: StudioKonto) => k.rollen.includes("experte") || k.rollen.includes("plattform_admin");
