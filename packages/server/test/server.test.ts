import path from "node:path";
import { StandardKalender } from "@amtlos/fristen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Datenbank,
  JOBS,
  ProtokollVersand,
  erzeugeWarteschlange,
  importiereKatalog,
  migrieren,
  neuberechnen,
  neuberechnungEinreihen,
  planeErinnerungen,
  versendeFaelligeErinnerungen,
  zeitpunktInZone,
} from "../src/index.js";
import { DB_VERFUEGBAR, WURZEL, frischeDatenbank } from "../src/testhilfen.js";

const STICHTAG = "2026-10-11";
const kalender = new StandardKalender();

describe.skipIf(!DB_VERFUEGBAR)("Server-Kern gegen PostgreSQL", () => {
  let urls: Awaited<ReturnType<typeof frischeDatenbank>>;
  let api: Datenbank;
  let worker: Datenbank;
  let studio: Datenbank;
  let kontoId: string;
  let unternehmenId: string;

  beforeAll(async () => {
    urls = await frischeDatenbank("amtlos_server_test");
    api = new Datenbank(urls.api);
    worker = new Datenbank(urls.worker);
    studio = new Datenbank(urls.studio);
  });
  afterAll(async () => {
    await Promise.all([api?.schliessen(), worker?.schliessen(), studio?.schliessen()]);
  });

  const instanzen = () =>
    api.imKontext({ kontoId, unternehmenId }, (tx) =>
      tx.abfrage<{ pflicht_id: string; periode: string; status: string; ergebnis: string; faellig_am: string | null; nicht_zutreffend_grund: string | null; fehlende_fakten: string[] }>(
        "select pflicht_id, periode, status, ergebnis, faellig_am, nicht_zutreffend_grund, fehlende_fakten from app.pflicht_instanz order by pflicht_id, periode",
      ),
    );
  const profilSetzen = (daten: Record<string, unknown>) =>
    api.imKontext({ kontoId, unternehmenId }, (tx) =>
      tx.abfrage(
        "insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values ($1, (select coalesce(max(version),0)+1 from app.profil_version where unternehmen_id = $1), $2, $3)",
        [unternehmenId, daten, kontoId],
      ),
    );

  it("Migrationen sind idempotent und erkennen nachträgliche Änderungen", async () => {
    const e = await migrieren(urls.owner, path.join(WURZEL, "db/migrations"));
    expect(e.angewendet).toEqual([]);
    expect(e.bereitsVorhanden.length).toBeGreaterThanOrEqual(2);
  });

  it("importiert den Katalog als Release und erkennt unveränderte Wiederholung", async () => {
    const e1 = await importiereKatalog(studio, path.join(WURZEL, "catalog"));
    expect(e1).toMatchObject({ release: 1, unveraendert: false });
    expect(e1.neuePflichtversionen).toBeGreaterThan(0);
    const e2 = await importiereKatalog(studio, path.join(WURZEL, "catalog"));
    expect(e2).toMatchObject({ release: null, unveraendert: true, neuePflichtversionen: 0 });
  });

  it("rechnet ohne Profil nichts und legt dann den Plan für eine Kleinunternehmerin an", async () => {
    kontoId = await api.imKontext({}, async (tx) => (await tx.eine<{ id: string }>("select app.konto_anmelden('sub-test', 'test@example.org', 'Test') as id"))!.id);
    unternehmenId = await api.imKontext({ kontoId }, async (tx) => (await tx.eine<{ id: string }>("select app.unternehmen_anlegen('Design Studio') as id"))!.id);

    expect((await neuberechnen(worker, unternehmenId, "test", { stichtag: STICHTAG, kalender })).status).toBe("kein_profil");

    await profilSetzen({ rechtsform: "freiberuf", gruendungsdatum: "2026-10-01", "taetigkeit.einordnung": "freiberuf", "ust.kleinunternehmer": true, "ust.zahllast_vorjahr": 0, "beschaeftigte.gesamt": 0, bundesland: "BE" });
    const r = await neuberechnen(worker, unternehmenId, "profil", { stichtag: STICHTAG, kalender });
    expect(r.status).toBe("berechnet");

    const i = await instanzen();
    expect(i.find((x) => x.pflicht_id === "gruendung.berufsgenossenschaft")).toMatchObject({ periode: "einmalig", status: "offen", faellig_am: "2026-10-08" });
    expect(i.find((x) => x.pflicht_id === "steuern.ust_voranmeldung")).toMatchObject({ status: "nicht_zutreffend", nicht_zutreffend_grund: "Du nutzt die Kleinunternehmerregelung nicht." });
    expect(i.find((x) => x.pflicht_id === "arbeitsschutz.gefaehrdungsbeurteilung")).toMatchObject({ status: "nicht_zutreffend" });
  });

  it("ist idempotent", async () => {
    const vorher = await instanzen();
    const r = await neuberechnen(worker, unternehmenId, "nochmal", { stichtag: STICHTAG, kalender });
    expect(r.instanzen).toMatchObject({ neu: 0, entfallen: 0 });
    expect(await instanzen()).toEqual(vorher);
  });

  it("reagiert auf Profiländerungen: Regelbesteuerung erzeugt Voranmeldungen, 'nicht zutreffend' entfällt", async () => {
    await profilSetzen({ rechtsform: "freiberuf", gruendungsdatum: "2026-10-01", "taetigkeit.einordnung": "freiberuf", "ust.kleinunternehmer": false, "ust.zahllast_vorjahr": 0, "beschaeftigte.gesamt": 0, bundesland: "BE" });
    await neuberechnen(worker, unternehmenId, "profil", { stichtag: STICHTAG, kalender });
    const ust = (await instanzen()).filter((x) => x.pflicht_id === "steuern.ust_voranmeldung");
    // Gründungsjahr → gilt; Zahllast 0 ≤ 9.000 → vierteljährlich; erste Periode Q4/2026 (Gründung 1.10.)
    expect(ust.find((x) => x.periode === "2026-Q4")).toMatchObject({ status: "offen", faellig_am: "2027-01-11" });
    expect(ust.find((x) => x.periode === "einmalig")).toMatchObject({ status: "entfallen" });
    expect(ust.some((x) => x.periode === "2026-Q3")).toBe(false); // vor Gründung
  });

  it("lässt Erledigtes unangetastet", async () => {
    await api.imKontext({ kontoId, unternehmenId }, (tx) =>
      tx.abfrage(
        `update app.pflicht_instanz set status = 'erledigt', erledigt_am = now(), erledigt_von = $1, erledigt_mit_version_id = pflicht_version_id
          where pflicht_id = 'gruendung.berufsgenossenschaft'`,
        [kontoId],
      ),
    );
    await neuberechnen(worker, unternehmenId, "test", { stichtag: STICHTAG, kalender });
    expect((await instanzen()).find((x) => x.pflicht_id === "gruendung.berufsgenossenschaft")?.status).toBe("erledigt");
  });

  it("fragt bei fehlenden Angaben statt 'nicht zutreffend' zu sagen", async () => {
    await profilSetzen({ rechtsform: "freiberuf", gruendungsdatum: "2026-10-01", bundesland: "BE" });
    await neuberechnen(worker, unternehmenId, "profil", { stichtag: STICHTAG, kalender });
    const g = (await instanzen()).find((x) => x.pflicht_id === "arbeitsschutz.gefaehrdungsbeurteilung");
    expect(g).toMatchObject({ status: "offen", ergebnis: "unbekannt", fehlende_fakten: ["profil.beschaeftigte.gesamt"] });
  });

  it("Ereignis 'erste Einstellung' terminiert die Gefährdungsbeurteilung; Storno nimmt es zurück", async () => {
    await profilSetzen({ rechtsform: "freiberuf", gruendungsdatum: "2026-10-01", "ust.kleinunternehmer": true, "beschaeftigte.gesamt": 1, bundesland: "BE" });
    const ev = await api.imKontext({ kontoId, unternehmenId }, async (tx) =>
      (await tx.eine<{ id: string }>("insert into app.ereignis (unternehmen_id, typ, eingetreten_am, quelle) values ($1, 'erste_einstellung', '2026-11-02', 'nutzer') returning id", [unternehmenId]))!.id,
    );
    await neuberechnen(worker, unternehmenId, "ereignis", { stichtag: STICHTAG, kalender });
    expect((await instanzen()).find((x) => x.pflicht_id === "arbeitsschutz.gefaehrdungsbeurteilung")).toMatchObject({ status: "offen", faellig_am: "2026-11-01" });

    await api.imKontext({ kontoId, unternehmenId }, (tx) =>
      tx.abfrage("insert into app.ereignis (unternehmen_id, typ, eingetreten_am, quelle, storniert_ereignis_id) values ($1, 'erste_einstellung', '2026-11-02', 'nutzer', $2)", [unternehmenId, ev]),
    );
    await neuberechnen(worker, unternehmenId, "storno", { stichtag: STICHTAG, kalender });
    expect((await instanzen()).find((x) => x.pflicht_id === "arbeitsschutz.gefaehrdungsbeurteilung")).toMatchObject({ status: "offen", faellig_am: null });
  });

  it("plant Erinnerungen um 8 Uhr Ortszeit und versendet fällige", async () => {
    expect(zeitpunktInZone("2026-10-20", 8).toISOString()).toBe("2026-10-20T06:00:00.000Z"); // Sommerzeit
    expect(zeitpunktInZone("2026-11-20", 8).toISOString()).toBe("2026-11-20T07:00:00.000Z"); // Winterzeit

    await profilSetzen({ rechtsform: "freiberuf", gruendungsdatum: "2026-10-01", "ust.kleinunternehmer": false, "ust.zahllast_vorjahr": 0, "beschaeftigte.gesamt": 1, bundesland: "BE" });
    await neuberechnen(worker, unternehmenId, "profil", { stichtag: STICHTAG, kalender });
    const anzahl = await worker.imKontext({ unternehmenId }, (tx) => planeErinnerungen(tx, unternehmenId, STICHTAG));
    expect(anzahl).toBeGreaterThan(0);

    // Eine Erinnerung künstlich fällig machen
    const admin = new Datenbank(urls.owner);
    await admin.imKontext({}, (tx) => tx.abfrage("alter table app.erinnerung no force row level security"));
    await admin.imKontext({}, (tx) =>
      tx.abfrage("update app.erinnerung set geplant_fuer = now() - interval '1 minute' where id = (select id from app.erinnerung order by geplant_fuer limit 1)"),
    );
    await admin.imKontext({}, (tx) => tx.abfrage("alter table app.erinnerung force row level security"));
    await admin.schliessen();

    const versand = new ProtokollVersand();
    const r = await versendeFaelligeErinnerungen(worker, versand, "https://app.amtlos.test");
    expect(r).toEqual({ gesendet: 1, fehler: 0 });
    expect(versand.gesendet[0]).toMatchObject({ an: "test@example.org" });
    expect(versand.gesendet[0]!.betreff).toMatch(/^Fällig am \d{2}\.\d{2}\.\d{4}: /);
    expect((await versendeFaelligeErinnerungen(worker, versand, "x")).gesendet).toBe(0); // nicht doppelt
  });

  it("reiht Neuberechnungen transaktional ein", async () => {
    const boss = erzeugeWarteschlange(urls.api);
    boss.on("error", () => undefined);
    await boss.start();
    try {
      await expect(
        api.imKontext({ kontoId, unternehmenId }, async (tx) => {
          await neuberechnungEinreihen(boss, tx, { unternehmenId, ausgeloestDurch: "rollback-test" });
          throw new Error("absichtlich");
        }),
      ).rejects.toThrow("absichtlich");
      expect((await boss.getQueueSize(JOBS.neuberechnung))).toBe(0);

      await api.imKontext({ kontoId, unternehmenId }, (tx) => neuberechnungEinreihen(boss, tx, { unternehmenId, ausgeloestDurch: "commit-test" }));
      expect(await boss.getQueueSize(JOBS.neuberechnung)).toBe(1);
      // stately: ein zweiter wartender Job für dasselbe Unternehmen wird gebündelt
      await api.imKontext({ kontoId, unternehmenId }, (tx) => neuberechnungEinreihen(boss, tx, { unternehmenId, ausgeloestDurch: "doppelt" }));
      expect(await boss.getQueueSize(JOBS.neuberechnung)).toBe(1);
    } finally {
      await boss.stop({ graceful: false, wait: true });
    }
  });
});
