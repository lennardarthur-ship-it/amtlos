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
  neuePflichtversion,
  neuberechnen,
  pflichtVersionen,
  releaseVeroeffentlichen,
  studioKonto,
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
    expect(i.find((x) => x.pflicht_id === "steuern.ust_voranmeldung")).toMatchObject({ status: "nicht_zutreffend", nicht_zutreffend_grund: "Gilt erst, wenn: Du nutzt die Kleinunternehmerregelung nicht." });
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
    // Ohne (nicht stornierte) Einstellung zählt wieder das Profil (H6): 1 Beschäftigte ⇒ Einstellung zum Gründungstag
    expect((await instanzen()).find((x) => x.pflicht_id === "arbeitsschutz.gefaehrdungsbeurteilung")).toMatchObject({ status: "offen", faellig_am: "2026-09-30" });
    // Ohne Beschäftigte gilt sie nicht – mit der Begründung als Bedingung
    await profilSetzen({ rechtsform: "freiberuf", gruendungsdatum: "2026-10-01", "ust.kleinunternehmer": true, "beschaeftigte.gesamt": 0, bundesland: "BE" });
    await neuberechnen(worker, unternehmenId, "storno", { stichtag: STICHTAG, kalender });
    expect((await instanzen()).find((x) => x.pflicht_id === "arbeitsschutz.gefaehrdungsbeurteilung")).toMatchObject({
      status: "nicht_zutreffend", nicht_zutreffend_grund: "Gilt erst, wenn: Du beschäftigst mindestens eine Person.",
    });
  });

  it("H6: Beschäftigte im Profil ohne erfasste Personen – Einstellungs-Pflichten gelten (wie in der App)", async () => {
    const { ereignisseMitBestand } = await import("../src/berechnung.js");
    expect(ereignisseMitBestand([], { "beschaeftigte.gesamt": 3, gruendungsdatum: "2019-04-01" }, STICHTAG)).toEqual([
      { typ: "erste_einstellung", datum: "2019-04-01" },
      { typ: "einstellung", datum: "2019-04-01" },
    ]);
    expect(ereignisseMitBestand([], { "beschaeftigte.gesamt": 1 }, STICHTAG)).toEqual([{ typ: "erste_einstellung", datum: STICHTAG }, { typ: "einstellung", datum: STICHTAG }]);
    expect(ereignisseMitBestand([], { "beschaeftigte.gesamt": 0 }, STICHTAG)).toEqual([]);
    const echt = [{ typ: "einstellung", datum: "2026-11-02" }];
    expect(ereignisseMitBestand(echt, { "beschaeftigte.gesamt": 3 }, STICHTAG)).toBe(echt);

    await profilSetzen({ rechtsform: "freiberuf", gruendungsdatum: "2026-10-01", "ust.kleinunternehmer": true, "beschaeftigte.gesamt": 3, bundesland: "BE" });
    await neuberechnen(worker, unternehmenId, "profil", { stichtag: STICHTAG, kalender });
    const i = await instanzen();
    for (const id of ["arbeitsschutz.erstunterweisung", "personal.nachweisgesetz", "personal.sv_anmeldung"]) {
      const offen = i.filter((x) => x.pflicht_id === id && x.status !== "entfallen");
      expect(offen.length, id).toBeGreaterThan(0);
      expect(offen.every((x) => x.status === "offen"), id).toBe(true);
    }
    // Begründungen für „gilt nicht“ sind als Bedingung formuliert, nicht als Behauptung
    for (const x of i.filter((y) => y.status === "nicht_zutreffend" && y.nicht_zutreffend_grund)) expect(x.nicht_zutreffend_grund).toMatch(/^Gilt erst, wenn: /);
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

  it("M10: SMTP-Fehler – Erinnerung bleibt geplant und wird mit Abstand erneut versucht; nichts doppelt", async () => {
    const admin = new Datenbank(urls.owner);
    const alsEigentuemer = async <T>(sql: string, werte: unknown[] = []) => {
      await admin.imKontext({}, (tx) => tx.abfrage("alter table app.erinnerung no force row level security"));
      try {
        return await admin.imKontext({}, (tx) => tx.abfrage<T & Record<string, unknown>>(sql, werte));
      } finally {
        await admin.imKontext({}, (tx) => tx.abfrage("alter table app.erinnerung force row level security"));
      }
    };
    const [ziel] = await alsEigentuemer<{ id: string }>(
      "update app.erinnerung set geplant_fuer = now() - interval '1 minute' where id = (select id from app.erinnerung where status = 'geplant' order by geplant_fuer limit 1) returning id",
    );
    let versuche = 0;
    const kaputt = { email: async () => { versuche++; throw new Error("SMTP 421"); } };
    expect(await versendeFaelligeErinnerungen(worker, kaputt, "x")).toEqual({ gesendet: 0, fehler: 1 });
    const [nachFehler] = await alsEigentuemer<{ status: string; versuche: number; naechster_versuch: Date }>("select status, versuche, naechster_versuch from app.erinnerung where id = $1", [ziel!.id]);
    expect(nachFehler).toMatchObject({ status: "geplant", versuche: 1 });
    expect(nachFehler!.naechster_versuch.getTime()).toBeGreaterThan(Date.now());
    // vor dem nächsten Versuch passiert nichts; eine Neuplanung löscht die Wiederholung nicht
    expect(await versendeFaelligeErinnerungen(worker, kaputt, "x")).toEqual({ gesendet: 0, fehler: 0 });
    await worker.imKontext({ unternehmenId }, (tx) => planeErinnerungen(tx, unternehmenId, STICHTAG));
    expect(await alsEigentuemer("select 1 from app.erinnerung where id = $1", [ziel!.id])).toHaveLength(1);
    // Abstand abgelaufen: diesmal klappt es – genau eine Mail
    await alsEigentuemer("update app.erinnerung set naechster_versuch = now() - interval '1 second' where id = $1", [ziel!.id]);
    const versand = new ProtokollVersand();
    expect(await versendeFaelligeErinnerungen(worker, versand, "x")).toEqual({ gesendet: 1, fehler: 0 });
    expect(versand.gesendet).toHaveLength(1);
    expect(versuche).toBe(1);
    // Hängengebliebener Versand (Worker abgestürzt) wird nach einer Stunde erneut versucht
    await alsEigentuemer("update app.erinnerung set status = 'in_versand', versand_begonnen_am = now() - interval '2 hours' where id = $1", [ziel!.id]);
    expect((await versendeFaelligeErinnerungen(worker, versand, "x")).gesendet).toBe(1);
    await admin.schliessen();
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

  it("Release-Rollout meldet geänderte Pflichten an die Mitglieder („Was ändert sich für dich?“)", async () => {
    const owner = new Datenbank(urls.owner);
    await owner.imKontext({}, async (tx) => {
      const r = await tx.eine<{ id: string }>("select app.konto_anmelden('redaktion-test', 'red@example.org', 'Red') as id");
      await tx.abfrage("insert into app.konto_plattform_rolle values ($1, 'redaktion')", [r!.id]);
    });
    await owner.schliessen();
    const red = (await studioKonto(studio, "redaktion-test"))!;
    const meldungen = () => api.imKontext({ kontoId, unternehmenId }, (tx) => tx.abfrage<{ art: string; titel: string; link: string }>("select art, titel, link from app.benachrichtigung order by erstellt_am"));

    expect((await neuberechnen(worker, unternehmenId, "tageswechsel:2026-10-11", { stichtag: STICHTAG, kalender })).benachrichtigt).toBe(0);
    const offen = (await instanzen()).find((x) => x.status === "offen" && x.ergebnis === "gilt" && x.periode === "einmalig")!;
    const [v] = await pflichtVersionen(studio, offen.pflicht_id);
    await neuePflichtversion(studio, red, { ...v!.daten, kurz: { de: "Neu formuliert für den Test." } });
    const rel = await releaseVeroeffentlichen(studio, red, "Test-Rollout");
    const r = await neuberechnen(worker, unternehmenId, `release:${rel.nummer}`, { stichtag: STICHTAG, kalender });
    expect(r.benachrichtigt).toBeGreaterThanOrEqual(1);
    const m = await meldungen();
    expect(m).toContainEqual(expect.objectContaining({ art: "rechtsaenderung", link: `/pflichten/${offen.pflicht_id}/einmalig` }));
    expect(m.find((x) => x.link.includes(offen.pflicht_id))?.titel).toMatch(/^Geändert: /);
    // Erneuter Lauf desselben Releases meldet nichts mehr
    expect((await neuberechnen(worker, unternehmenId, `release:${rel.nummer}`, { stichtag: STICHTAG, kalender })).benachrichtigt).toBe(0);
  });
});
