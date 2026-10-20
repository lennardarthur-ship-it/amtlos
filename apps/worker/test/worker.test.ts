import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Datenbank, JOBS, ProtokollVersand, erzeugeWarteschlange, heute, importiereKatalog } from "@amtlos/server";
import { DB_VERFUEGBAR, WURZEL, frischeDatenbank } from "@amtlos/server/testhilfen";
import type PgBoss from "pg-boss";
import { arbeiterStarten, empfaengerPruefen, fehlerGrund, neuberechnungsPaket, verarbeiteNeuberechnung } from "../src/arbeit.js";

const still = { info: () => undefined, fehler: () => undefined };

describe.skipIf(!DB_VERFUEGBAR)("Worker", () => {
  let urls: Awaited<ReturnType<typeof frischeDatenbank>>;
  let api: Datenbank;
  let worker: Datenbank;
  let boss: PgBoss;
  let unternehmenId: string;

  beforeAll(async () => {
    urls = await frischeDatenbank("amtlos_worker_test");
    const studio = new Datenbank(urls.studio);
    await importiereKatalog(studio, path.join(WURZEL, "catalog"));
    await studio.schliessen();
    api = new Datenbank(urls.api);
    worker = new Datenbank(urls.worker);
    const kontoId = await api.imKontext({}, async (tx) => (await tx.eine<{ id: string }>("select app.konto_anmelden('w', 'w@example.org', 'W') as id"))!.id);
    unternehmenId = await api.imKontext({ kontoId }, async (tx) => (await tx.eine<{ id: string }>("select app.unternehmen_anlegen('W GmbH') as id"))!.id);
    await api.imKontext({ kontoId, unternehmenId }, (tx) =>
      tx.abfrage("insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values ($1, 1, $2, $3)", [
        unternehmenId,
        { rechtsform: "gmbh", gruendungsdatum: "2018-01-01", "ust.kleinunternehmer": false, "ust.zahllast_vorjahr": 20000, "ust.dauerfristverlaengerung": false, bundesland: "HH" },
        kontoId,
      ]),
    );
  });
  afterAll(async () => {
    await boss?.stop({ graceful: false, wait: true });
    await Promise.all([api?.schliessen(), worker?.schliessen()]);
  });

  it("H2: ein kaputtes Unternehmen hält die anderen im Paket nicht auf; Fehler wird geloggt, vermerkt und einzeln gemeldet", async () => {
    const fehlerLog: Record<string, unknown>[] = [];
    const log = { info: () => undefined, fehler: (msg: string, d?: Record<string, unknown>) => void fehlerLog.push({ msg, ...d }) };
    const gemeldet: string[] = [];
    const bossAttrappe = { fail: async (_name: string, id: string) => void gemeldet.push(id) } as unknown as Pick<PgBoss, "fail">;
    const fertig: string[] = [];
    const rechnen = async (_db: Datenbank, job: { unternehmenId: string }) => {
      if (job.unternehmenId === unternehmenId) throw new Error("Ungültiges Datum: '0000-00-00'");
      fertig.push(job.unternehmenId);
      return { status: "berechnet" as const, erinnerungen: 0 };
    };
    const andere = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const jobs = [
      { id: "a", data: { unternehmenId: andere[0]!, ausgeloestDurch: "t" } },
      { id: "kaputt", data: { unternehmenId, ausgeloestDurch: "t" }, retryCount: 3, retryLimit: 3 },
      { id: "b", data: { unternehmenId: andere[1]!, ausgeloestDurch: "t" } },
    ];
    await neuberechnungsPaket(bossAttrappe, worker, jobs, log, rechnen);
    expect(fertig).toEqual(andere);
    expect(gemeldet).toEqual(["kaputt"]);
    expect(fehlerLog[0]).toMatchObject({ msg: "neuberechnung_fehler", unternehmen: unternehmenId, meldung: "Ungültiges Datum: '…'", endgueltig: true });
    const vermerk = await api.imKontext({ kontoId: (await api.imKontext({}, async (tx) => (await tx.eine<{ id: string }>("select app.konto_anmelden('w', 'w@example.org', 'W') as id"))!.id)), unternehmenId }, (tx) =>
      tx.abfrage<{ profil_version: number; endgueltig: boolean; grund: string }>("select profil_version, endgueltig, grund from app.berechnung_fehler where unternehmen_id = $1", [unternehmenId]),
    );
    expect(vermerk).toEqual([{ profil_version: 1, endgueltig: true, grund: "Ungültiges Datum: '…'" }]);
    expect(fehlerGrund(new Error('Wert "geheim" ungültig'))).toBe('Wert "…" ungültig');
  });

  it("M-5: E-Mails nur an genau eine gültige Adresse", () => {
    expect(empfaengerPruefen("anna@example.org")).toBe("anna@example.org");
    for (const boese of ["a@example.org\r\nBcc: x@example.org", "a@example.org, b@example.org", "Gruppe: a@example.org;", `${"a".repeat(250)}@example.org`, "keine-adresse"])
      expect(() => empfaengerPruefen(boese), boese).toThrow("Empfängeradresse ungültig");
  });

  it("berechnet und plant Erinnerungen in einer Transaktion", async () => {
    const r = await verarbeiteNeuberechnung(worker, { unternehmenId, ausgeloestDurch: "test" }, "2026-10-11");
    expect(r.status).toBe("berechnet");
    expect(r.erinnerungen).toBeGreaterThan(0);
  });

  it("erinnert bei sehr nahen Fristen sofort – aber nur einmal", async () => {
    const heuteDatum = heute();
    const vor7 = new Date(`${heuteDatum}T12:00:00Z`);
    vor7.setUTCDate(vor7.getUTCDate() - 7);
    const kontoId = await api.imKontext({}, async (tx) => (await tx.eine<{ id: string }>("select app.konto_anmelden('nah', 'nah@example.org', 'Nah') as id"))!.id);
    const u = await api.imKontext({ kontoId }, async (tx) => (await tx.eine<{ id: string }>("select app.unternehmen_anlegen('Nah GmbH') as id"))!.id);
    await api.imKontext({ kontoId, unternehmenId: u }, (tx) =>
      tx.abfrage("insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values ($1, 1, $2, $3)", [
        u, { rechtsform: "gmbh", gruendungsdatum: vor7.toISOString().slice(0, 10), "ust.kleinunternehmer": true, "beschaeftigte.gesamt": 0, bundesland: "HH" }, kontoId,
      ]),
    );
    const bg = () =>
      worker.imKontext({ unternehmenId: u }, (tx) =>
        tx.abfrage<{ status: string; geplant_fuer: Date }>(
          `select e.status, e.geplant_fuer from app.erinnerung e join app.pflicht_instanz pi on pi.id = e.pflicht_instanz_id
            where pi.pflicht_id = 'gruendung.berufsgenossenschaft'`,
        ),
      );
    await verarbeiteNeuberechnung(worker, { unternehmenId: u, ausgeloestDurch: "nah" }, heuteDatum);
    const e1 = await bg();
    expect(e1).toHaveLength(1);
    expect(e1[0]!.geplant_fuer.getTime() - Date.now()).toBeLessThan(120_000);

    const owner = new Datenbank(urls.owner);
    await owner.imKontext({}, async (tx) => {
      await tx.abfrage("alter table app.erinnerung no force row level security");
      await tx.abfrage("update app.erinnerung set status = 'gesendet', gesendet_am = now() where unternehmen_id = $1", [u]);
      await tx.abfrage("alter table app.erinnerung force row level security");
    });
    await owner.schliessen();
    await verarbeiteNeuberechnung(worker, { unternehmenId: u, ausgeloestDurch: "nah2" }, heuteDatum);
    expect((await bg()).map((x) => x.status)).toEqual(["gesendet"]);
  });

  it("verarbeitet Jobs aus der Warteschlange über die Worker-Rolle", async () => {
    boss = erzeugeWarteschlange(urls.worker);
    boss.on("error", () => undefined);
    await boss.start();
    await arbeiterStarten(boss, worker, new ProtokollVersand(), "https://app", still);
    await boss.send(JOBS.tageswechsel, { grund: "test" });
    // warten, bis Tageswechsel verteilt und die Neuberechnung gelaufen ist
    const ende = Date.now() + 20_000;
    let laeufe = 0;
    while (Date.now() < ende) {
      laeufe = Number((await worker.imKontext({ unternehmenId }, (tx) => tx.eine<{ n: string }>("select count(*) as n from app.berechnungslauf where ausgeloest_durch = 'test'")))!.n);
      if (laeufe >= 2) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(laeufe).toBe(2); // einer aus dem ersten Test, einer über die Warteschlange (Tageswechsel)
  });
});
