import "reflect-metadata";
import path from "node:path";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StandardKalender } from "@amtlos/fristen";
import { Datenbank, JOBS, erzeugeWarteschlange, importiereKatalog, neuberechnen } from "@amtlos/server";
import { DB_VERFUEGBAR, WURZEL, frischeDatenbank } from "@amtlos/server/testhilfen";
import { erzeugeApp } from "../src/main.js";

const GEHEIM = "test-geheimnis-mindestens-32-zeichen-lang";
const METRIK_TOKEN = "metriken-token-mindestens-32-zeichen-lang";
const token = (sub: string, email = `${sub}@example.org`) =>
  new SignJWT({ email, name: sub }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuer("amtlos-dev").setExpirationTime("10m").sign(new TextEncoder().encode(GEHEIM));

describe.skipIf(!DB_VERFUEGBAR)("API (End-to-End gegen PostgreSQL)", () => {
  let app: NestExpressApplication;
  let urls: Awaited<ReturnType<typeof frischeDatenbank>>;
  let worker: Datenbank;
  let anna: string;
  let ben: string;
  let mia: string;
  let firma: string;

  const http = () => request(app.getHttpServer());
  const alsAnna = (r: request.Test) => r.set("Authorization", `Bearer ${anna}`).set("X-Unternehmen-Id", firma);

  beforeAll(async () => {
    urls = await frischeDatenbank("amtlos_api_test");
    const studio = new Datenbank(urls.studio);
    await importiereKatalog(studio, path.join(WURZEL, "catalog"));
    await studio.schliessen();
    worker = new Datenbank(urls.worker);
    app = await erzeugeApp({
      UMGEBUNG: "test", PORT: 0, DATABASE_URL: urls.api, AUTH_MODUS: "dev", DEV_JWT_SECRET: GEHEIM,
      WEB_URL: "https://app.amtlos.test", API_URL: "https://api.amtlos.test", OIDC_ISSUER: undefined, OIDC_AUDIENCE: undefined, METRIKEN_TOKEN: METRIK_TOKEN, RATE_ANGEMELDET: 10_000, RATE_ANONYM: 1_000,
    });
    await app.init();
    [anna, ben, mia] = await Promise.all([token("anna"), token("ben"), token("mia")]);
  });
  afterAll(async () => {
    await app?.close();
    await worker?.schliessen();
  });

  it("Gesundheit ist öffentlich, alles andere braucht ein gültiges Token", async () => {
    await http().get("/v1/gesundheit").expect(200, { status: "ok" });
    await http().get("/v1/ich").expect(401);
    await http().get("/v1/ich").set("Authorization", "Bearer kaputt").expect(401);
    const fremd = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("x").setIssuer("amtlos-dev").sign(new TextEncoder().encode("falsches-geheimnis-falsches-geheimnis"));
    await http().get("/v1/ich").set("Authorization", `Bearer ${fremd}`).expect(401);
  });

  it("legt beim ersten Login das Konto an und ein Unternehmen mit Inhaberrolle", async () => {
    const r = await http().post("/v1/unternehmen").set("Authorization", `Bearer ${anna}`).send({ name: "Annas Café" }).expect(201);
    firma = r.body.id;
    const ich = await http().get("/v1/ich").set("Authorization", `Bearer ${anna}`).expect(200);
    expect(ich.body.konto.email).toBe("anna@example.org");
    expect(ich.body.unternehmen).toEqual([{ id: firma, name: "Annas Café", rolle: "inhaber" }]);
  });

  it("trennt Mandanten: fremdes oder fehlendes Unternehmen", async () => {
    await http().get("/v1/profil").set("Authorization", `Bearer ${anna}`).expect(400);
    await http().get("/v1/profil").set("Authorization", `Bearer ${ben}`).set("X-Unternehmen-Id", firma).expect(404);
    await http().get("/v1/pflichten").set("Authorization", `Bearer ${ben}`).set("X-Unternehmen-Id", firma).expect(404);
  });

  it("validiert das Profil und speichert Versionen; die Neuberechnung wird eingereiht", async () => {
    const falsch = await alsAnna(http().put("/v1/profil")).send({ daten: { rechtsfrom: "gmbh" } }).expect(422);
    expect(falsch.body.fehler[0].meldung).toMatch(/Unrecognized key/);
    const r = await alsAnna(http().put("/v1/profil"))
      .send({ daten: { rechtsform: "einzelunternehmen", gruendungsdatum: "2019-04-01", "taetigkeit.einordnung": "gewerbe", "ust.kleinunternehmer": false, "ust.zahllast_vorjahr": 12400, "ust.dauerfristverlaengerung": true, "beschaeftigte.gesamt": 1, gemeinde_ags: "08111000" } })
      .expect(200);
    expect(r.body).toMatchObject({ version: 1, daten: { bundesland: "BW" } });
    const p = await alsAnna(http().get("/v1/profil")).expect(200);
    expect(p.body.version).toBe(1);

    const boss = erzeugeWarteschlange(urls.api);
    boss.on("error", () => undefined);
    await boss.start();
    expect(await boss.getQueueSize(JOBS.neuberechnung)).toBe(1);
    await boss.stop({ graceful: false, wait: true });
  });

  it("zeigt nach der Berechnung Pflicht-Karten mit Begründung, Quellen und Prüfstatus", async () => {
    await neuberechnen(worker, firma, "test", { stichtag: "2026-10-11", kalender: new StandardKalender() });
    const r = await alsAnna(http().get("/v1/pflichten")).expect(200);
    const ust = r.body.find((k: { pflicht_id: string; periode: string }) => k.pflicht_id === "steuern.ust_voranmeldung" && k.periode === "2026-09");
    expect(ust).toMatchObject({
      faellig_am: "2026-11-10",
      titel: "Umsatzsteuer-Voranmeldung abgeben",
      bereich: "steuern",
      warum: ["Du nutzt die Kleinunternehmerregelung nicht.", "Deine Umsatzsteuer im Vorjahr lag über der Grenze für eine Befreiung."],
      ungeprueft: true,
      pruefung: { status: "entwurf", geprueft_von: null },
    });
    const d = await alsAnna(http().get("/v1/pflichten/steuern.ust_voranmeldung/2026-09")).expect(200);
    expect(d.body.quellen[0].url).toContain("ustg_1980/__18");
    expect(d.body.regelwerte).toContainEqual({ id: "steuern.ust_va.grenze_befreiung", version: 1 });
    await alsAnna(http().get("/v1/pflichten/steuern.ust_voranmeldung/2026-99")).expect(404);
  });

  it("Heute liefert Ampel und höchstens drei nächste Aufgaben", async () => {
    const r = await alsAnna(http().get("/v1/heute")).expect(200);
    expect(Object.keys(r.body.ampel).sort()).toEqual(["arbeitsschutz", "datenschutz", "gesellschaft", "online", "personal", "steuern"]);
    expect(r.body.als_naechstes.length).toBeLessThanOrEqual(3);
    expect(r.body.als_naechstes[0]).toHaveProperty("titel");
  });

  it("bietet Fristen vor dem Start zur Sammelbestätigung an", async () => {
    // Profil künstlich in die Vergangenheit legen: erstes Profil am 1.10.2026, Stichtag 11.10.
    const owner = new Datenbank(urls.owner);
    await owner.imKontext({}, async (tx) => {
      await tx.abfrage("alter table app.profil_version no force row level security");
      await tx.abfrage("update app.profil_version set erstellt_am = '2026-10-01' where unternehmen_id = $1", [firma]);
      await tx.abfrage("alter table app.profil_version force row level security");
    });
    await owner.schliessen();
    const h = await alsAnna(http().get("/v1/heute")).expect(200);
    // Fällig vor dem 1.10.: u. a. USt-VA Juni (10.8.) und Juli (10.9.) sowie Anmeldungen aus dem Gründungsjahr 2019
    expect(h.body.vor_start.seit).toBe("2026-10-01");
    const n = h.body.vor_start.anzahl as number;
    expect(n).toBeGreaterThanOrEqual(3);
    const r = await alsAnna(http().post("/v1/pflichten/vor-start-erledigt")).expect(201);
    expect(r.body).toEqual({ erledigt: n });
    expect((await alsAnna(http().get("/v1/heute")).expect(200)).body.vor_start.anzahl).toBe(0);
    const juli = await alsAnna(http().get("/v1/pflichten/steuern.ust_voranmeldung/2026-07")).expect(200);
    expect(juli.body.nachweise[0].notiz).toMatch(/Sammelbestätigung/);
  });

  it("Erledigen mit Nachweis, wieder öffnen, Rollenprüfung", async () => {
    await alsAnna(http().post("/v1/pflichten/steuern.ust_voranmeldung/2026-09/erledigen")).send({ notiz: "über ELSTER übermittelt" }).expect(201);
    await alsAnna(http().post("/v1/pflichten/steuern.ust_voranmeldung/2026-09/erledigen")).send({}).expect(404);
    const d = await alsAnna(http().get("/v1/pflichten/steuern.ust_voranmeldung/2026-09")).expect(200);
    expect(d.body.status).toBe("erledigt");
    expect(d.body.nachweise[0]).toMatchObject({ art: "bestaetigung", notiz: "über ELSTER übermittelt" });
    await alsAnna(http().post("/v1/pflichten/steuern.ust_voranmeldung/2026-09/wieder-oeffnen")).expect(201);

    // Mia als Mitarbeiterin: darf erledigen, aber kein Profil ändern
    const miaKonto = (await http().get("/v1/ich").set("Authorization", `Bearer ${mia}`).expect(200)).body.konto.id;
    const owner = new Datenbank(urls.owner);
    await owner.imKontext({}, (tx) => tx.abfrage("insert into app.mitgliedschaft values ($1, $2, 'mitarbeiter')", [firma, miaKonto]));
    await owner.schliessen();
    const alsMia = (r: request.Test) => r.set("Authorization", `Bearer ${mia}`).set("X-Unternehmen-Id", firma);
    await alsMia(http().put("/v1/profil")).send({ daten: { rechtsform: "gmbh" } }).expect(403);
    await alsMia(http().post("/v1/pflichten/steuern.ust_voranmeldung/2026-09/erledigen")).send({}).expect(201);
  });

  it("Ereignisse sind idempotent über client_id und stornierbar", async () => {
    const clientId = "7d5b2f8e-6a1c-4e0b-9f3a-2c1d0e9b8a7f";
    const e1 = await alsAnna(http().post("/v1/ereignisse")).send({ typ: "erste_einstellung", datum: "2026-11-02", client_id: clientId }).expect(201);
    const e2 = await alsAnna(http().post("/v1/ereignisse")).send({ typ: "erste_einstellung", datum: "2026-11-02", client_id: clientId }).expect(201);
    expect(e2.body).toMatchObject({ id: e1.body.id, wiederholt: true });
    await alsAnna(http().post("/v1/ereignisse")).send({ typ: "erfundenes_ereignis", datum: "2026-11-02" }).expect(422);
    await alsAnna(http().post(`/v1/ereignisse/${e1.body.id}/storno`)).expect(201);
    const liste = await alsAnna(http().get("/v1/ereignisse")).expect(200);
    expect(liste.body.find((e: { id: string }) => e.id === e1.body.id).storniert).toBe(true);
  });

  it("Glossar sammelt Fachbegriffe aus dem Katalog, ohne Doppelte", async () => {
    const r = await alsAnna(http().get("/v1/glossar")).expect(200);
    const kl = r.body.filter((b: { begriff: string }) => b.begriff === "Kleinunternehmerregelung");
    expect(kl).toHaveLength(1);
    expect(kl[0].pflichten.length).toBeGreaterThanOrEqual(2);
    const namen = r.body.map((b: { begriff: string }) => b.begriff);
    expect(namen).toEqual([...namen].sort((a: string, b: string) => a.localeCompare(b, "de")));
  });

  it("Kalender-Abo liefert ICS nur mit gültigem Token", async () => {
    const r = await alsAnna(http().post("/v1/kalender/abo")).expect(201);
    const pfad = new URL(r.body.url).pathname;
    const ics = await http().get(pfad).expect(200);
    expect(ics.headers["content-type"]).toMatch(/text\/calendar/);
    expect(ics.text).toContain("BEGIN:VEVENT");
    expect(ics.text).toContain("SUMMARY:Umsatzsteuer-Voranmeldung abgeben");
    await http().get("/v1/kalender/" + "A".repeat(43) + ".ics").expect(404);
  });

  it("Einladungen: einladen, Vorschau, nur mit passender E-Mail annehmen, einmalig, widerrufbar", async () => {
    const alsMia = (r: request.Test) => r.set("Authorization", `Bearer ${mia}`).set("X-Unternehmen-Id", firma);
    const [lena, fremd] = await Promise.all([token("lena"), token("fremd")]);
    await alsMia(http().post("/v1/einladungen")).send({ email: "lena@example.org", rolle: "mitarbeiter" }).expect(403);
    await alsAnna(http().post("/v1/einladungen")).send({ email: "keine-adresse", rolle: "mitarbeiter" }).expect(422);
    await alsAnna(http().post("/v1/einladungen")).send({ email: "lena@example.org", rolle: "inhaber" }).expect(422);
    await alsAnna(http().post("/v1/einladungen")).send({ email: "mia@example.org", rolle: "admin" }).expect(409);

    const alt = await alsAnna(http().post("/v1/einladungen")).send({ email: "Lena@Example.org", rolle: "steuerberater" }).expect(201);
    const e = await alsAnna(http().post("/v1/einladungen")).send({ email: "lena@example.org", rolle: "mitarbeiter" }).expect(201);
    expect(e.body.link).toMatch(/^https:\/\/app\.amtlos\.test\/einladung\/[A-Za-z0-9_-]{43}$/);
    const tok = e.body.link.split("/").pop();
    const altTok = alt.body.link.split("/").pop();

    // Die E-Mail ist eingereiht (mit Token), der Text kommt aus dem Server-Paket
    const boss = erzeugeWarteschlange(urls.api);
    boss.on("error", () => undefined);
    await boss.start();
    expect(await boss.getQueueSize(JOBS.einladungVersenden)).toBe(2);
    await boss.stop({ graceful: false, wait: true });

    // Team-Ansicht: Einladungen nur für Inhaber/Admin
    const team = await alsAnna(http().get("/v1/team")).expect(200);
    expect(team.body.einladungen.map((x: { email: string }) => x.email)).toEqual(["lena@example.org"]); // die erste wurde ersetzt
    expect((await alsMia(http().get("/v1/team")).expect(200)).body.einladungen).toEqual([]);

    const mitLena = (r: request.Test) => r.set("Authorization", `Bearer ${lena}`);
    await mitLena(http().post("/v1/einladungen/vorschau")).send({ token: altTok }).expect(404);
    const v = await mitLena(http().post("/v1/einladungen/vorschau")).send({ token: tok }).expect(200);
    expect(v.body).toMatchObject({ unternehmen: "Annas Café", rolle: "mitarbeiter", eingeladen_von: "anna" });
    await http().post("/v1/einladungen/annehmen").set("Authorization", `Bearer ${fremd}`).send({ token: tok }).expect(403);
    await mitLena(http().post("/v1/einladungen/annehmen")).send({ token: altTok }).expect(404);
    const an = await mitLena(http().post("/v1/einladungen/annehmen")).send({ token: tok }).expect(200);
    expect(an.body.unternehmen_id).toBe(firma);
    await mitLena(http().post("/v1/einladungen/annehmen")).send({ token: tok }).expect(404); // nur einmal
    const ich = await mitLena(http().get("/v1/ich")).expect(200);
    expect(ich.body.unternehmen).toEqual([{ id: firma, name: "Annas Café", rolle: "mitarbeiter" }]);

    // Widerruf
    const w = await alsAnna(http().post("/v1/einladungen")).send({ email: "pia@example.org", rolle: "admin" }).expect(201);
    await alsAnna(http().delete(`/v1/einladungen/${w.body.id}`)).expect(204);
    await alsAnna(http().delete(`/v1/einladungen/${w.body.id}`)).expect(404);
    const pia = await token("pia");
    await http().post("/v1/einladungen/annehmen").set("Authorization", `Bearer ${pia}`).send({ token: w.body.link.split("/").pop() }).expect(404);
  });

  it("Mitglieder entfernen: nur Inhaber/Admin, letzter Inhaber bleibt", async () => {
    const team = (await alsAnna(http().get("/v1/team")).expect(200)).body.mitglieder as { konto_id: string; email: string; rolle: string; ich: boolean }[];
    const lena = team.find((m) => m.email === "lena@example.org")!;
    const ich = team.find((m) => m.ich)!;
    expect(ich.rolle).toBe("inhaber");
    const alsMia = (r: request.Test) => r.set("Authorization", `Bearer ${mia}`).set("X-Unternehmen-Id", firma);
    await alsMia(http().delete(`/v1/team/${lena.konto_id}`)).expect(403);
    await alsAnna(http().delete(`/v1/team/${ich.konto_id}`)).expect(409);
    // Rolle ändern: Mia darf nicht, Anna schon; letzter Inhaber kann sich nicht herabstufen
    await alsMia(http().put(`/v1/team/${lena.konto_id}`)).send({ rolle: "admin" }).expect(403);
    await alsAnna(http().put(`/v1/team/${lena.konto_id}`)).send({ rolle: "admin" }).expect(200, { konto_id: lena.konto_id, rolle: "admin" });
    await alsAnna(http().put(`/v1/team/${ich.konto_id}`)).send({ rolle: "admin" }).expect(409);
    // Lena (jetzt Admin) darf niemanden zum Inhaber machen und Anna nicht herabstufen
    const lenaAdmin = await token("lena");
    const alsLena = (r: request.Test) => r.set("Authorization", `Bearer ${lenaAdmin}`).set("X-Unternehmen-Id", firma);
    await alsLena(http().put(`/v1/team/${lena.konto_id}`)).send({ rolle: "inhaber" }).expect(403);
    await alsLena(http().put(`/v1/team/${ich.konto_id}`)).send({ rolle: "mitarbeiter" }).expect(403);
    await alsAnna(http().delete(`/v1/team/${lena.konto_id}`)).expect(204);
    await alsAnna(http().delete(`/v1/team/${lena.konto_id}`)).expect(404);
    const lenaTok = await token("lena");
    await http().get("/v1/profil").set("Authorization", `Bearer ${lenaTok}`).set("X-Unternehmen-Id", firma).expect(404);

    // Austreten: Mia (Mitarbeiterin) darf, Anna als letzte Inhaberin nicht
    await alsAnna(http().post("/v1/team/verlassen")).expect(409);
    await alsMia(http().post("/v1/team/verlassen")).expect(204);
    await alsMia(http().get("/v1/heute")).expect(404);
    // Für die folgenden Tests wieder aufnehmen
    const owner = new Datenbank(urls.owner);
    const miaKonto = (await http().get("/v1/ich").set("Authorization", `Bearer ${mia}`).expect(200)).body.konto.id;
    await owner.imKontext({}, (tx) => tx.abfrage("insert into app.mitgliedschaft values ($1, $2, 'mitarbeiter')", [firma, miaKonto]));
    await owner.schliessen();
  });

  it("Betrieb: OpenAPI öffentlich, Request-ID, Metriken nur mit Token und ohne Geheimnisse in Labels", async () => {
    const o = await http().get("/v1/openapi.json").expect(200);
    expect(o.body.openapi).toBe("3.1.0");
    const g = await http().get("/v1/gesundheit").set("X-Request-Id", "abc12345-test").expect(200);
    expect(g.headers["x-request-id"]).toBe("abc12345-test");
    expect((await http().get("/v1/gesundheit").set("X-Request-Id", "<böse>")).headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    await http().get("/metriken").expect(404);
    await http().get("/metriken").set("Authorization", "Bearer falsch").expect(404);
    const m = await http().get("/metriken").set("Authorization", `Bearer ${METRIK_TOKEN}`).expect(200);
    expect(m.text).toContain('amtlos_http_anfragen_total{methode="GET",route="/v1/kalender/:datei",status="200"}');
    expect(m.text).toContain('amtlos_warteschlange_wartend{queue="einladung-versenden"}');
    expect(m.text).not.toMatch(/[A-Za-z0-9_-]{43}\.ics/);
  });
});
