import type PgBoss from "pg-boss";
import {
  JOBS,
  heute,
  neuberechnenInTx,
  planeErinnerungen,
  versendeFaelligeErinnerungen,
  versendeEinladung,
  versendeMarktplatzAnfrage,
  type Datenbank,
  type EinladungsJob,
  type MarktplatzJob,
  type NeuberechnungsJob,
  type Versand,
} from "@amtlos/server";

export interface Protokoll {
  info(msg: string, daten?: Record<string, unknown>): void;
  fehler(msg: string, daten?: Record<string, unknown>): void;
}

/** Neuberechnung und Erinnerungsplanung in einer Transaktion: Plan und Erinnerungen passen immer zusammen. */
export async function verarbeiteNeuberechnung(db: Datenbank, job: NeuberechnungsJob, stichtag = heute()) {
  return db.imKontext({ unternehmenId: job.unternehmenId }, async (tx) => {
    const r = await neuberechnenInTx(tx, job.unternehmenId, job.ausgeloestDurch, { stichtag });
    const erinnerungen = r.status === "berechnet" ? await planeErinnerungen(tx, job.unternehmenId, stichtag) : 0;
    return { ...r, erinnerungen };
  });
}

/** Tageswechsel und Release-Rollout: für jedes aktive Unternehmen eine Neuberechnung einreihen (gebündelt je Unternehmen). */
export async function verteileNeuberechnungen(db: Datenbank, boss: PgBoss, grund: string): Promise<number> {
  const ids = await db.imKontext({}, (tx) => tx.abfrage<{ id: string }>("select app.aktive_unternehmen_ids() as id"));
  for (const { id } of ids) await boss.send(JOBS.neuberechnung, { unternehmenId: id, ausgeloestDurch: grund } satisfies NeuberechnungsJob, { singletonKey: id });
  return ids.length;
}

export async function arbeiterStarten(boss: PgBoss, db: Datenbank, versand: Versand, appUrl: string, log: Protokoll) {
  await boss.work<NeuberechnungsJob>(JOBS.neuberechnung, { batchSize: 5 }, async (jobs) => {
    for (const job of jobs) {
      const r = await verarbeiteNeuberechnung(db, job.data);
      log.info("neuberechnung", { unternehmen: job.data.unternehmenId, grund: job.data.ausgeloestDurch, status: r.status, ...r.instanzen, erinnerungen: r.erinnerungen });
    }
  });
  await boss.work<{ grund?: string }>(JOBS.tageswechsel, async ([job]) => {
    const n = await verteileNeuberechnungen(db, boss, job?.data.grund ?? `tageswechsel:${heute()}`);
    log.info("tageswechsel", { unternehmen: n });
  });
  await boss.work(JOBS.erinnerungenVersenden, async () => {
    const r = await versendeFaelligeErinnerungen(db, versand, appUrl);
    if (r.gesendet || r.fehler) log.info("erinnerungen", r);
    if (r.fehler) log.fehler("erinnerungen_fehler", r);
  });
  await boss.work<EinladungsJob>(JOBS.einladungVersenden, async (jobs) => {
    for (const job of jobs) {
      const r = await versendeEinladung(db, versand, appUrl, job.data);
      log.info("einladung", { einladung: job.data.einladungId, ergebnis: r }); // kein Token, keine Adresse im Log
    }
  });
  await boss.work<MarktplatzJob>(JOBS.marktplatzAnfrage, async (jobs) => {
    for (const job of jobs) {
      const r = await versendeMarktplatzAnfrage(db, versand, job.data);
      log.info("marktplatz_anfrage", { anfrage: job.data.anfrageId, ergebnis: r }); // keine Inhalte im Log
    }
  });
  await boss.work(JOBS.loeschlauf, async () => {
    const r = await db.imKontext({}, (tx) => tx.eine<{ n: number }>("select app.endgueltig_loeschen() as n"));
    if (r?.n) log.info("loeschlauf", { unternehmen: r.n });
  });
  // Zeitpläne (Europe/Berlin): Tageswechsel kurz nach Mitternacht, Erinnerungen alle 15 Minuten
  await boss.schedule(JOBS.tageswechsel, "5 0 * * *", {}, { tz: "Europe/Berlin" });
  await boss.schedule(JOBS.loeschlauf, "30 3 * * *", {}, { tz: "Europe/Berlin" });
  await boss.schedule(JOBS.erinnerungenVersenden, "*/15 * * * *", {}, { tz: "Europe/Berlin" });
}
