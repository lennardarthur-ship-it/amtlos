import PgBoss from "pg-boss";
import type { Tx } from "./datenbank.js";

/** Job-Namen (E-015: pg-boss in derselben Datenbank). */
export const JOBS = {
  neuberechnung: "neuberechnung",
  tageswechsel: "tageswechsel",
  erinnerungenVersenden: "erinnerungen-versenden",
  einladungVersenden: "einladung-versenden",
  marktplatzAnfrage: "marktplatz-anfrage",
  /** Täglich: endgültiges Löschen nach Frist (E-114) */
  loeschlauf: "loeschlauf",
} as const;

/** Anfrage an einen Marktplatz-Partner (E-102): der Worker liest sie im Kontext des Unternehmens. */
export interface MarktplatzJob {
  unternehmenId: string;
  anfrageId: string;
}

/**
 * Das Token steht im Job (für den Link in der E-Mail), in app.einladung nur als SHA-256.
 * pg-boss archiviert erledigte Jobs einige Tage. Das Token allein nützt dort nichts: Annehmen geht nur
 * angemeldet mit der eingeladenen E-Mail-Adresse, einmalig und bis zum Ablauf (E-079).
 */
export interface EinladungsJob {
  einladungId: string;
  token: string;
}

export interface NeuberechnungsJob {
  unternehmenId: string;
  ausgeloestDurch: string;
}

export const PGBOSS_SCHEMA = "pgboss";

export function erzeugeWarteschlange(verbindung: string, optionen: { migrieren?: boolean; planen?: boolean } = {}): PgBoss {
  return new PgBoss({
    connectionString: verbindung,
    schema: PGBOSS_SCHEMA,
    migrate: optionen.migrieren ?? false,
    schedule: optionen.planen ?? false,
    supervise: optionen.planen ?? false,
  });
}

/** Legt die Queues an (idempotent). Läuft beim Deploy als Eigentümer zusammen mit den Migrationen. */
export async function queuesAnlegen(boss: PgBoss): Promise<void> {
  // 'stately': höchstens ein wartender und ein laufender Job je singletonKey → Neuberechnungen bündeln sich
  for (const [name, policy] of [
    [JOBS.neuberechnung, "stately"],
    [JOBS.tageswechsel, "singleton"],
    [JOBS.erinnerungenVersenden, "singleton"],
    [JOBS.einladungVersenden, "standard"],
    [JOBS.marktplatzAnfrage, "standard"],
    [JOBS.loeschlauf, "singleton"],
  ] as const) {
    if (!(await boss.getQueue(name))) await boss.createQueue(name, { name, policy, retryLimit: 3, retryDelay: 30, retryBackoff: true });
  }
}

/**
 * Reiht eine Neuberechnung in derselben Transaktion ein, in der das auslösende Ereignis gespeichert wird.
 * Rollt die Transaktion zurück, verschwindet auch der Job (kein „Phantom-Job“, kein verlorenes Ereignis).
 */
export async function neuberechnungEinreihen(boss: PgBoss, tx: Tx, job: NeuberechnungsJob): Promise<void> {
  await boss.send(JOBS.neuberechnung, job, {
    singletonKey: job.unternehmenId,
    db: { executeSql: (text: string, values: unknown[]) => tx.client.query(text, values) },
  });
}

/** Einladungs-E-Mail in derselben Transaktion einreihen wie die Einladung selbst. */
export async function einladungEinreihen(boss: PgBoss, tx: Tx, job: EinladungsJob): Promise<void> {
  await boss.send(JOBS.einladungVersenden, job, {
    expireInSeconds: 3600,
    db: { executeSql: (text: string, values: unknown[]) => tx.client.query(text, values) },
  });
}

/** Marktplatz-Anfrage in derselben Transaktion einreihen wie die Anfrage selbst. */
export async function marktplatzAnfrageEinreihen(boss: PgBoss, tx: Tx, job: MarktplatzJob): Promise<void> {
  await boss.send(JOBS.marktplatzAnfrage, job, { db: { executeSql: (text: string, values: unknown[]) => tx.client.query(text, values) } });
}
