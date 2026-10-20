import type PgBoss from "pg-boss";
import { z } from "zod";
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

/**
 * Empfänger prüfen, bevor nodemailer ihn sieht (M-5): Die Adresse stammt aus dem Token des Identitätsanbieters bzw. aus
 * einer Einladung. Genau eine Adresse (höchstens 254 Zeichen), ohne Zeilenumbrüche, Listen oder Gruppen.
 */
const Empfaenger = z.string().max(254).email().refine((x) => !/[\r\n,;<>"]/.test(x), "Genau eine Adresse");
export function empfaengerPruefen(an: string): string {
  const r = Empfaenger.safeParse(an);
  if (!r.success) throw new Error("Empfängeradresse ungültig");
  return r.data;
}

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

/** Kurzer, fester Grund für Logs und app.berechnung_fehler – ohne Profilwerte (z. B. das kaputte Datum selbst). */
export function fehlerGrund(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/'[^']*'/g, "'…'").replace(/"[^"]*"/g, '"…"').slice(0, 300);
}

/** Fehlversuch vermerken (H2): „Heute“ zeigt dann einen Fehlerzustand statt endlos „Einen Moment …“. */
export async function berechnungFehlerVermerken(db: Datenbank, unternehmenId: string, versuch: number, endgueltig: boolean, grund: string) {
  await db.imKontext({ unternehmenId }, (tx) =>
    tx.abfrage(
      `insert into app.berechnung_fehler (unternehmen_id, profil_version, versuch, endgueltig, grund)
       values ($1, (select max(version) from app.profil_version where unternehmen_id = $1), $2, $3, $4)`,
      [unternehmenId, versuch, endgueltig, grund],
    ),
  );
}

type JobMitMeta = { id: string; data: NeuberechnungsJob; retryCount?: number; retryLimit?: number };

/**
 * Neuberechnungen in Paketen (H2): jeder Job einzeln abgesichert. pg-boss markiert bei einer Ausnahme im Handler das
 * ganze Paket als fehlgeschlagen – ein kaputtes Unternehmen hielt so bis zu vier andere auf. Fehlgeschlagene Jobs
 * meldet der Handler einzeln mit boss.fail (Wiederholung nach der Queue-Einstellung), die übrigen schließt pg-boss ab.
 */
export async function neuberechnungsPaket(boss: Pick<PgBoss, "fail">, db: Datenbank, jobs: JobMitMeta[], log: Protokoll, rechnen = verarbeiteNeuberechnung) {
  for (const job of jobs) {
    try {
      const r = await rechnen(db, job.data);
      log.info("neuberechnung", { unternehmen: job.data.unternehmenId, grund: job.data.ausgeloestDurch, status: r.status, ...r.instanzen, erinnerungen: r.erinnerungen });
    } catch (e) {
      const versuch = job.retryCount ?? 0;
      const endgueltig = job.retryLimit !== undefined && versuch >= job.retryLimit;
      const grund = fehlerGrund(e);
      log.fehler("neuberechnung_fehler", { unternehmen: job.data.unternehmenId, grund: job.data.ausgeloestDurch, meldung: grund, versuch, endgueltig });
      await berechnungFehlerVermerken(db, job.data.unternehmenId, versuch, endgueltig, grund).catch((v: unknown) =>
        log.fehler("neuberechnung_fehler_vermerk", { unternehmen: job.data.unternehmenId, meldung: fehlerGrund(v) }),
      );
      await boss.fail(JOBS.neuberechnung, job.id, { meldung: grund });
    }
  }
}

export async function arbeiterStarten(boss: PgBoss, db: Datenbank, versand: Versand, appUrl: string, log: Protokoll) {
  await boss.work<NeuberechnungsJob>(JOBS.neuberechnung, { batchSize: 5, includeMetadata: true }, (jobs) => neuberechnungsPaket(boss, db, jobs, log));
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
