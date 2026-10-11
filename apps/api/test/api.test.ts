import "reflect-metadata";
import fs from "node:fs";
import os from "node:os";
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
      WEB_URL: "https://app.amtlos.test", API_URL: "https://api.amtlos.test", OIDC_ISSUER: undefined, OIDC_AUDIENCE: undefined, METRIKEN_TOKEN: METRIK_TOKEN, RATE_ANGEMELDET: 10_000, RATE_ANONYM: 1_000, ABLAGE_VERZEICHNIS: fs.mkdtempSync(path.join(os.tmpdir(), "ablage-")),
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

  it("Gründungsassistent: Reihenfolge aus Voraussetzungen, Sperren, Kennzahlen für die UG", async () => {
    const zoe = await token("zoe");
    const u = (await http().post("/v1/unternehmen").set("Authorization", `Bearer ${zoe}`).send({ name: "Zoes UG" }).expect(201)).body.id;
    const alsZoe = (r: request.Test) => r.set("Authorization", `Bearer ${zoe}`).set("X-Unternehmen-Id", u);
    await alsZoe(http().put("/v1/profil"))
      .send({ daten: { rechtsform: "ug", gruendungsdatum: "2026-12-01", "taetigkeit.einordnung": "gewerbe", "gesellschaft.handelsregister": "nicht_beantragt", "gesellschaft.geschaeftsjahr": "kalenderjahr", alg1_bezug: false, "beschaeftigte.gesamt": 0, gemeinde_ags: "14713000" } })
      .expect(200);
    await neuberechnen(worker, u, "test", { stichtag: "2026-10-11", kalender: new StandardKalender() });
    const g = (await alsZoe(http().get("/v1/gruendung")).expect(200)).body;
    const ids = g.schritte.map((x: { pflicht_id: string }) => x.pflicht_id);
    for (const [vor, nach] of [["gruendung.elster_konto", "gruendung.fragebogen_steuerliche_erfassung"], ["gesellschaft.gesellschaftsvertrag_notar", "gesellschaft.stammkapital_einzahlen"], ["gesellschaft.stammkapital_einzahlen", "gesellschaft.handelsregister_anmeldung"]])
      expect(ids.indexOf(vor), `${vor} vor ${nach}`).toBeLessThan(ids.indexOf(nach));
    expect(ids).not.toContain("gruendung.gruendungszuschuss"); // gilt nicht (kein ALG I) → nicht im Assistenten
    const fragebogen = g.schritte.find((x: { pflicht_id: string }) => x.pflicht_id === "gruendung.fragebogen_steuerliche_erfassung");
    expect(fragebogen.gesperrt_durch).toEqual([{ pflicht_id: "gruendung.elster_konto", titel: "ELSTER-Konto beantragen" }]);
    expect(g.kapitalgesellschaft).toBe("ug");
    expect(g.kennzahlen.map((x: { id: string }) => x.id)).toEqual(["gesellschaft.ug.ruecklage_anteil", "gesellschaft.ug.stammkapital_mindest"]);
    expect(g.kennzahlen[1]).toMatchObject({ wert: 1, einheit: "EUR", ungeprueft: true });
    expect(g.fortschritt).toMatchObject({ erledigt: 0, fertig: false });

    // ELSTER-Konto erledigen → Fragebogen entsperrt
    await alsZoe(http().post("/v1/pflichten/gruendung.elster_konto/einmalig/erledigen")).send({}).expect(201);
    const g2 = (await alsZoe(http().get("/v1/gruendung")).expect(200)).body;
    expect(g2.schritte.find((x: { pflicht_id: string }) => x.pflicht_id === "gruendung.fragebogen_steuerliche_erfassung").gesperrt_durch).toEqual([]);
    expect(g2.fortschritt.erledigt).toBe(1);
  });

  it("Fragebogen-Vorbereitung aus dem Profil; ELSTER-Übermittlung ehrlich nicht verfügbar", async () => {
    const f = (await alsAnna(http().get("/v1/gruendung/fragebogen")).expect(200)).body;
    const angaben = Object.fromEntries(f.abschnitte.flatMap((a: { angaben: { feld: string; wert: string | null }[] }) => a.angaben).map((a: { feld: string; wert: string | null }) => [a.feld, a.wert]));
    expect(angaben).toMatchObject({ name: "Annas Café", rechtsform: "Einzelunternehmen", gruendungsdatum: "1.4.2019", "ust.kleinunternehmer": "Nein, ich verzichte" });
    expect(f.fehlend).toContain("gewinn.prognose_laufendes_jahr");
    expect(f.hinweise).toEqual(["verzicht_bindet"]);
    expect(f.uebermittlung).toMatchObject({ verfuegbar: false, alternative: { url: "https://www.elster.de/" } });
    const r = await alsAnna(http().post("/v1/elster/fragebogen_steuerliche_erfassung")).send({}).expect(501);
    expect(r.body.message).toMatch(/noch nicht freigeschaltet/);
    await alsAnna(http().post("/v1/elster/gibt_es_nicht")).send({}).expect(404);
    const alsMia = (x: request.Test) => x.set("Authorization", `Bearer ${mia}`).set("X-Unternehmen-Id", firma);
    await alsMia(http().post("/v1/elster/fragebogen_steuerliche_erfassung")).send({}).expect(403);
  });

  describe("Finanzen", () => {
    const jahr = new Date().getFullYear();
    let rechnungId: string;
    let pdfId: string;
    let xmlId: string;

    it("Rechnungssteller und Kunden", async () => {
      expect((await alsAnna(http().get("/v1/rechnungssteller")).expect(200)).body).toEqual({});
      await alsAnna(http().put("/v1/rechnungssteller")).send({ name: "Annas Café", strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart", email: "kaputt" }).expect(422);
      const st = await alsAnna(http().put("/v1/rechnungssteller"))
        .send({ name: "Annas Café", strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart", email: "anna@example.org", telefon: "+49 711 123", steuernummer: "93815/08152", ust_idnr: "DE123456789", iban: "DE02 1203 0000 0000 2020 51" })
        .expect(200);
      expect(st.body.iban).toBe("DE02120300000000202051");
      const ku = await alsAnna(http().post("/v1/kunden")).send({ name: "Kunde GmbH", strasse: "Ring 5", plz: "10115", ort: "Berlin", email: "einkauf@kunde.example", kaeufer_referenz: "PO-77" }).expect(201);
      expect(ku.body.geschaeftskunde).toBe(true);
      const alsMia = (x: request.Test) => x.set("Authorization", `Bearer ${mia}`).set("X-Unternehmen-Id", firma);
      await alsMia(http().post("/v1/rechnungen")).send({}).expect(403);
      const e = await alsAnna(http().post("/v1/rechnungen"))
        .send({ kunde_id: ku.body.id, positionen: [{ bezeichnung: "Beratung", menge: 2.5, einheit: "stunde", preis_cent: 8000, ust_art: "regel" }, { bezeichnung: "Fachbuch", menge: 1, einheit: "stueck", preis_cent: 2999, ust_art: "ermaessigt" }] })
        .expect(201);
      expect(e.body).toMatchObject({ status: "entwurf", nummer: null, kleinunternehmer: false });
      rechnungId = e.body.id;
    });

    it("stellen: fehlende Angaben, Nummer, Steuersätze aus Regelwerten, PDF/ZUGFeRD und XRechnung", async () => {
      const f = await alsAnna(http().post(`/v1/rechnungen/${rechnungId}/stellen`)).expect(422);
      expect(f.body.fehlend).toEqual(["leistungsdatum"]);
      const entwurf = (await alsAnna(http().get(`/v1/rechnungen/${rechnungId}`)).expect(200)).body;
      await alsAnna(http().put(`/v1/rechnungen/${rechnungId}`)).send({ kunde_id: entwurf.kunde_id, positionen: entwurf.positionen, leistungsdatum: `${jahr}-10-01` }).expect(200);
      const r = (await alsAnna(http().post(`/v1/rechnungen/${rechnungId}/stellen`)).expect(201)).body;
      expect(r).toMatchObject({ status: "gestellt", nummer: `${jahr}-0001`, netto_cent: 22999, ust_cent: 4010, brutto_cent: 27009 });
      expect(r.regelwerte.map((x: { id: string }) => x.id).sort()).toEqual(["steuern.ust.satz_ermaessigt", "steuern.ust.satz_regel"]);
      expect(r.steller.name).toBe("Annas Café");
      pdfId = r.pdf_dokument_id;
      xmlId = r.xml_dokument_id;
      const pdf = await alsAnna(http().get(`/v1/dokumente/${pdfId}/datei`)).buffer(true).parse((res, cb) => { const t: Buffer[] = []; res.on("data", (c: Buffer) => t.push(c)); res.on("end", () => cb(null, Buffer.concat(t))); }).expect(200);
      expect(pdf.headers["content-type"]).toBe("application/pdf");
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      expect((pdf.body as Buffer).toString("latin1")).toMatch(/pdfaid:part/);
      const xml = await alsAnna(http().get(`/v1/dokumente/${xmlId}/datei`)).expect(200);
      expect(xml.text).toContain("urn:xeinkauf.de:kosit:xrechnung_3.0");
      expect(xml.text).toContain(`<ram:ID>${jahr}-0001</ram:ID>`);
    });

    it("gestellte Rechnungen sind unveränderlich; Storno mit eigener Nummer", async () => {
      await alsAnna(http().put(`/v1/rechnungen/${rechnungId}`)).send({ positionen: [] }).expect(409);
      await alsAnna(http().delete(`/v1/rechnungen/${rechnungId}`)).expect(404);
      await alsAnna(http().post(`/v1/rechnungen/${rechnungId}/stellen`)).expect(409);
      const s = (await alsAnna(http().post(`/v1/rechnungen/${rechnungId}/stornieren`)).expect(201)).body;
      expect(s).toMatchObject({ art: "storno", status: "gestellt", nummer: `${jahr}-0002`, storniert_rechnung_id: rechnungId, netto_cent: 22999 });
      expect((await alsAnna(http().get(`/v1/rechnungen/${rechnungId}`)).expect(200)).body.status).toBe("storniert");
      await alsAnna(http().post(`/v1/rechnungen/${rechnungId}/stornieren`)).expect(409);
      const liste = (await alsAnna(http().get("/v1/rechnungen")).expect(200)).body;
      expect(liste.map((x: { nummer: string }) => x.nummer)).toEqual([`${jahr}-0002`, `${jahr}-0001`]);
      // Die Datenbank schützt zusätzlich: direkter Eingriff in eine gestellte Rechnung scheitert
      const annaKonto = (await http().get("/v1/ich").set("Authorization", `Bearer ${anna}`).expect(200)).body.konto.id;
      const apiDb = new Datenbank(urls.api);
      await expect(apiDb.imKontext({ kontoId: annaKonto, unternehmenId: firma }, (tx) => tx.abfrage("update app.rechnung set netto_cent = 1, brutto_cent = 1 + ust_cent where id = $1", [rechnungId]))).rejects.toThrow(/rechnung_unveraenderlich/);
      await expect(apiDb.imKontext({ kontoId: annaKonto, unternehmenId: firma }, (tx) => tx.abfrage("delete from app.rechnung where id = $1", [rechnungId]))).rejects.toThrow(/rechnung_unveraenderlich/);
      await apiDb.schliessen();
    });

    it("Belege: Upload mit Inhaltsprüfung, E-Rechnung wird gelesen, Doppelte erkannt, Storno statt Löschen", async () => {
      const pdf = Buffer.from("%PDF-1.4\n% Testbeleg\n");
      const b = (await alsAnna(http().post("/v1/belege")).attach("datei", pdf, { filename: "tankquittung.pdf", contentType: "application/pdf" }).expect(201)).body;
      expect(b).toMatchObject({ quelle: "upload", belegdatum: null });
      await alsAnna(http().post("/v1/belege")).attach("datei", pdf, { filename: "nochmal.pdf", contentType: "application/pdf" }).expect(409);
      await alsAnna(http().post("/v1/belege")).attach("datei", Buffer.from("kein pdf"), { filename: "falsch.pdf", contentType: "application/pdf" }).expect(422);
      await alsAnna(http().post("/v1/belege")).attach("datei", Buffer.from("MZ..."), { filename: "virus.exe", contentType: "application/octet-stream" }).expect(422);
      const xml = (await alsAnna(http().get(`/v1/dokumente/${xmlId}/datei`)).expect(200)).text.replace(`${jahr}-0001`, "FREMD-1");
      const e = (await alsAnna(http().post("/v1/belege")).attach("datei", Buffer.from(xml), { filename: "eingang.xml", contentType: "application/xml" }).expect(201)).body;
      expect(e).toMatchObject({ quelle: "e_rechnung", belegnummer: "FREMD-1", lieferant: "Annas Café", brutto_cent: 27009, ust_cent: 4010 });
      const g = (await alsAnna(http().put(`/v1/belege/${b.id}`)).send({ belegdatum: `${jahr}-10-02`, lieferant: "Tankstelle", brutto_cent: 11900, ust_cent: 1900 }).expect(200)).body;
      expect(g).toMatchObject({ lieferant: "Tankstelle", ust_cent: 1900 });
      await alsAnna(http().post(`/v1/belege/${e.id}/stornieren`)).expect(201);
      await alsAnna(http().put(`/v1/belege/${e.id}`)).send({ lieferant: "x" }).expect(404);
      expect((await alsAnna(http().get("/v1/belege")).expect(200)).body).toHaveLength(2);
    });

    it("USt-Voranmeldung vorbereiten: Umsätze je Satz, Storno saldiert, Vorsteuer aus Belegen", async () => {
      const monat = `${jahr}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      await alsAnna(http().get("/v1/finanzen/ust-voranmeldung?periode=2026-13")).expect(400);
      const v = (await alsAnna(http().get(`/v1/finanzen/ust-voranmeldung?periode=${monat}`)).expect(200)).body;
      expect(v.rechnungen).toBe(2);
      expect(v.umsatzsteuer_cent).toBe(0); // Rechnung und Storno im selben Monat
      const okt = (await alsAnna(http().get(`/v1/finanzen/ust-voranmeldung?periode=${jahr}-10`)).expect(200)).body;
      expect(okt.vorsteuer_cent).toBe(1900);
      expect(okt.uebermittlung.verfuegbar).toBe(false);
    });

    it("Kleinunternehmer-Wächter: Warnung bei 80 % aus dem Umsatz der Rechnungen", async () => {
      const kim = await token("kim");
      const u = (await http().post("/v1/unternehmen").set("Authorization", `Bearer ${kim}`).send({ name: "Kims Atelier" }).expect(201)).body.id;
      const alsKim = (x: request.Test) => x.set("Authorization", `Bearer ${kim}`).set("X-Unternehmen-Id", u);
      await alsKim(http().put("/v1/profil")).send({ daten: { rechtsform: "freiberuf", gruendungsdatum: "2022-01-01", "taetigkeit.einordnung": "freiberuf", "ust.kleinunternehmer": true, "umsatz.vorjahr": 20000, gemeinde_ags: "09162000" } }).expect(200);
      await alsKim(http().put("/v1/rechnungssteller")).send({ name: "Kims Atelier", strasse: "Weg 1", plz: "80331", ort: "München", email: "kim@example.org", steuernummer: "143/123/12345" }).expect(200);
      const ku = (await alsKim(http().post("/v1/kunden")).send({ name: "Privatkundin", strasse: "Allee 2", plz: "80333", ort: "München", geschaeftskunde: false }).expect(201)).body;
      const e = (await alsKim(http().post("/v1/rechnungen")).send({ kunde_id: ku.id, leistungsdatum: `${jahr}-09-01`, positionen: [{ bezeichnung: "Wandbild", menge: 1, einheit: "stueck", preis_cent: 8_500_000, ust_art: "regel" }] }).expect(201)).body;
      expect(e.kleinunternehmer).toBe(true);
      expect(e.positionen[0].ust_art).toBeNull();
      const r = (await alsKim(http().post(`/v1/rechnungen/${e.id}/stellen`)).expect(201)).body;
      expect(r).toMatchObject({ ust_cent: 0, brutto_cent: 8_500_000, xml_dokument_id: null }); // Privatkunde: nur PDF
      const ue = (await alsKim(http().get("/v1/finanzen/uebersicht")).expect(200)).body;
      expect(ue).toMatchObject({ umsatz_eur: 85000, kleinunternehmer: true, grenze: { wert_eur: 100000, anteil: 0.85 } });
      await neuberechnen(worker, u, "test", { kalender: new StandardKalender() });
      const p = (await alsKim(http().get("/v1/pflichten")).expect(200)).body;
      expect(p.find((x: { pflicht_id: string }) => x.pflicht_id === "steuern.kleinunternehmer_warnung_80")?.ergebnis).toBe("gilt");
      expect(p.find((x: { pflicht_id: string }) => x.pflicht_id === "steuern.kleinunternehmer_warnung_95")?.ergebnis).toBe("gilt_nicht");
    });

    it("Kassen: Erfassen löst die Meldepflicht mit Frist aus", async () => {
      const k = (await alsAnna(http().post("/v1/kassen")).send({ bezeichnung: "Theke", seriennummer: "SN-1", tse_seriennummer: "TSE-9", angeschafft_am: `${jahr}-10-05` }).expect(201)).body;
      await neuberechnen(worker, firma, "test", { kalender: new StandardKalender() });
      const m = (await alsAnna(http().get("/v1/pflichten")).expect(200)).body.find((x: { pflicht_id: string }) => x.pflicht_id === "steuern.kassenmeldung");
      expect(m).toMatchObject({ ergebnis: "gilt", faellig_am: `${jahr}-11-05` });
      expect((await alsAnna(http().get("/v1/profil")).expect(200)).body.daten).toMatchObject({ "kasse.elektronisch": true, "kasse.anzahl": 1 });
      await alsAnna(http().post(`/v1/kassen/${k.id}/ausser-betrieb`)).send({ datum: `${jahr}-01-01` }).expect(422); // vor der Anschaffung
      await alsAnna(http().post(`/v1/kassen/${k.id}/ausser-betrieb`)).send({ datum: `${jahr}-12-01` }).expect(201);
      await alsAnna(http().post(`/v1/kassen/${k.id}/ausser-betrieb`)).send({ datum: `${jahr}-12-02` }).expect(404);
    });
  });

  describe("Personal und Arbeitsschutz", () => {
    let lea: string;
    let u: string;
    let person: string;
    const alsLea = (x: request.Test) => x.set("Authorization", `Bearer ${lea}`).set("X-Unternehmen-Id", u);
    const jahr = new Date().getFullYear();
    const heuteIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

    beforeAll(async () => {
      lea = await token("lea");
      u = (await http().post("/v1/unternehmen").set("Authorization", `Bearer ${lea}`).send({ name: "Leas Bäckerei" }).expect(201)).body.id;
      await alsLea(http().put("/v1/profil")).send({ daten: { rechtsform: "einzelunternehmen", gruendungsdatum: "2020-01-01", "taetigkeit.einordnung": "gewerbe", "beschaeftigte.gesamt": 0, gemeinde_ags: "09162000" } }).expect(200);
    });

    it("Einstellung: Ereignisse, Anzahlen im Profil, Checkliste aus den entstandenen Pflichten", async () => {
      await alsLea(http().post("/v1/beschaeftigte")).send({ vorname: "Tom", nachname: "Teig", art: "kellner" }).expect(422);
      const b = (await alsLea(http().post("/v1/beschaeftigte")).send({ vorname: "Tom", nachname: "Teig", art: "minijob", eintritt: `${jahr}-11-01`, wochenstunden: 8 }).expect(201)).body;
      person = b.id;
      expect(b).toMatchObject({ vorname: "Tom", art: "minijob", wochenstunden: 8, austritt: null });
      await alsLea(http().post("/v1/beschaeftigte")).send({ vorname: "Ute", nachname: "Ofen", art: "vollzeit", eintritt: `${jahr}-01-15` }).expect(201);
      const profil = (await alsLea(http().get("/v1/profil")).expect(200)).body.daten;
      expect(profil).toMatchObject({ "beschaeftigte.gesamt": 2, "beschaeftigte.minijob": 1, "beschaeftigte.vollzeit": 1 });
      const ereignisse = (await alsLea(http().get("/v1/ereignisse")).expect(200)).body.map((e: { typ: string }) => e.typ).sort();
      expect(ereignisse).toEqual(["einstellung", "einstellung", "erste_einstellung"]);
      await neuberechnen(worker, u, "test", { kalender: new StandardKalender() });
      const c = (await alsLea(http().get(`/v1/beschaeftigte/${person}/checkliste`)).expect(200)).body;
      const ids = c.schritte.map((x: { pflicht_id: string }) => x.pflicht_id);
      expect(ids).toEqual(expect.arrayContaining(["personal.sv_anmeldung", "arbeitsschutz.erstunterweisung"]));
      expect(c.schritte.every((x: { anlass: string }) => x.anlass === "einstellung")).toBe(true);
      // Schreibrechte: fremdes Konto sieht nichts
      await http().get("/v1/beschaeftigte").set("Authorization", `Bearer ${ben}`).set("X-Unternehmen-Id", u).expect(404);
    });

    it("Schwellenwert-Wächter zeigt, was bei mehr Beschäftigten hinzukäme", async () => {
      const s = (await alsLea(http().get("/v1/personal/schwellen")).expect(200)).body;
      expect(s.aktuell).toBe(2);
      expect(s.schwellen.map((x: { ab: number }) => x.ab)).toEqual(expect.arrayContaining([10, 20, 50, 150, 250]));
      expect(s.schwellen[0].ab).toBeGreaterThan(2);
      const alle = s.schwellen.flatMap((x: { neu: { pflicht_id: string }[]; zu_pruefen: { pflicht_id: string }[] }) => [...x.neu, ...x.zu_pruefen].map((p) => p.pflicht_id));
      expect(alle).toContain("personal.hinweisgeber_meldestelle");
    });

    it("Export als CSV, Austritt meldet das Ereignis", async () => {
      const csv = (await alsLea(http().get("/v1/personal/export")).expect(200)).text;
      expect(csv).toContain('"Teig";"Tom";"minijob"');
      await alsLea(http().post(`/v1/beschaeftigte/${person}/austritt`)).send({ datum: `${jahr}-10-01` }).expect(422); // vor dem Eintritt
      const a = (await alsLea(http().post(`/v1/beschaeftigte/${person}/austritt`)).send({ datum: `${jahr + 1}-03-31` }).expect(201)).body;
      expect(a.austritt).toBe(`${jahr + 1}-03-31`);
      await alsLea(http().post(`/v1/beschaeftigte/${person}/austritt`)).send({ datum: `${jahr + 1}-04-30` }).expect(404);
    });

    it("Unterweisung: Bestätigung mit eigenem Namen, Protokoll als PDF, Pflicht erledigt, danach unveränderlich", async () => {
      const w = (await alsLea(http().post("/v1/unterweisungen")).send({ thema: "Backstube", inhalt: "Ofen, Teigmaschine, Fluchtwege", datum: heuteIso, durchgefuehrt_von: "Lea" }).expect(201)).body;
      await alsLea(http().post(`/v1/unterweisungen/${w.id}/abschliessen`)).expect(422); // noch keine Bestätigung
      await alsLea(http().post(`/v1/unterweisungen/${w.id}/bestaetigen`)).send({ beschaeftigter_id: person, name: "Jemand Anders" }).expect(422);
      const t = (await alsLea(http().post(`/v1/unterweisungen/${w.id}/bestaetigen`)).send({ beschaeftigter_id: person, name: "  tom   TEIG " }).expect(201)).body;
      expect(t.name_bestaetigt).toBe("tom   TEIG");
      await alsLea(http().post(`/v1/unterweisungen/${w.id}/bestaetigen`)).send({ beschaeftigter_id: person, name: "Tom Teig" }).expect(409);
      await alsLea(http().delete(`/v1/unterweisungen/${w.id}`)).expect(409);
      const r = (await alsLea(http().post(`/v1/unterweisungen/${w.id}/abschliessen`)).expect(201)).body;
      expect(r.erledigte_pflichten).toBeGreaterThanOrEqual(1);
      const pdf = await alsLea(http().get(`/v1/dokumente/${r.dokument_id}/datei`)).expect(200);
      expect(pdf.headers["content-type"]).toContain("application/pdf");
      await alsLea(http().post(`/v1/unterweisungen/${w.id}/abschliessen`)).expect(409);
      const d = (await alsLea(http().get(`/v1/unterweisungen/${w.id}`)).expect(200)).body;
      expect(d.teilnahmen).toHaveLength(1);
      expect(d.inhalt_sha256).toMatch(/^[0-9a-f]{64}$/);
      const c = (await alsLea(http().get(`/v1/beschaeftigte/${person}/checkliste`)).expect(200)).body;
      expect(c.schritte.find((x: { pflicht_id: string }) => x.pflicht_id === "arbeitsschutz.erstunterweisung").status).toBe("erledigt");
      await neuberechnen(worker, u, "test", { kalender: new StandardKalender() });
      const p = (await alsLea(http().get("/v1/pflichten")).expect(200)).body;
      const w2 = p.find((x: { pflicht_id: string; ergebnis: string }) => x.pflicht_id === "arbeitsschutz.unterweisung_wiederholen" && x.ergebnis === "gilt");
      expect(w2).toMatchObject({ periode: `aenderung-${heuteIso.replaceAll("-", "")}`, faellig_am: `${Number(heuteIso.slice(0, 4)) + 1}${heuteIso.slice(4)}` });
      // Entwürfe ohne Bestätigung lassen sich löschen
      const e = (await alsLea(http().post("/v1/unterweisungen")).send({ thema: "Entwurf", inhalt: "x", datum: `${jahr}-11-01`, durchgefuehrt_von: "Lea" }).expect(201)).body;
      await alsLea(http().delete(`/v1/unterweisungen/${e.id}`)).expect(204);
    });

    it("Zeiterfassung: stempeln, Nachtrag, Korrektur als neuer Eintrag, Monat und CSV; Datenbank schützt den Verlauf", async () => {
      await alsLea(http().post("/v1/zeiten/gehen")).send({ beschaeftigter_id: person }).expect(404);
      await alsLea(http().post("/v1/zeiten/kommen")).send({ beschaeftigter_id: person }).expect(201);
      await alsLea(http().post("/v1/zeiten/kommen")).send({ beschaeftigter_id: person }).expect(409);
      const g = (await alsLea(http().post("/v1/zeiten/gehen")).send({ beschaeftigter_id: person, pause_minuten: 0 }).expect(201)).body;
      expect(g.ende).toBeTruthy();
      await alsLea(http().post("/v1/zeiten")).send({ beschaeftigter_id: person, beginn: `${jahr}-10-05T08:00:00+02:00`, ende: `${jahr}-10-05T12:30:00+02:00`, pause_minuten: 30 }).expect(422); // Grund fehlt
      const n = (await alsLea(http().post("/v1/zeiten")).send({ beschaeftigter_id: person, beginn: `${jahr}-10-05T08:00:00+02:00`, ende: `${jahr}-10-05T12:30:00+02:00`, pause_minuten: 30, grund: "Stempeln vergessen" }).expect(201)).body;
      const k = (await alsLea(http().post(`/v1/zeiten/${n.id}/korrigieren`)).send({ ende: `${jahr}-10-05T13:00:00+02:00`, grund: "Ende falsch" }).expect(201)).body;
      expect(k).toMatchObject({ quelle: "korrektur", ersetzt_id: n.id, pause_minuten: 30 });
      await alsLea(http().post(`/v1/zeiten/${n.id}/korrigieren`)).send({ grund: "nochmal" }).expect(404); // schon ersetzt
      await alsLea(http().get("/v1/zeiten?monat=2026-13")).expect(400);
      const m = (await alsLea(http().get(`/v1/zeiten?monat=${jahr}-10`)).expect(200)).body;
      const okt5 = m.eintraege.filter((e: { quelle: string }) => e.quelle !== "stempel");
      expect(okt5).toHaveLength(1);
      expect(okt5[0]).toMatchObject({ id: k.id, minuten: 270 });
      const csv = (await alsLea(http().get(`/v1/zeiten/export?monat=${jahr}-10`)).expect(200)).text;
      expect(csv).toContain('"Teig, Tom"');
      expect(csv).toContain('"Ende falsch"');
      const leaKonto = (await http().get("/v1/ich").set("Authorization", `Bearer ${lea}`).expect(200)).body.konto.id;
      const apiDb = new Datenbank(urls.api);
      await expect(apiDb.imKontext({ kontoId: leaKonto, unternehmenId: u }, (tx) => tx.abfrage("update app.zeiteintrag set pause_minuten = 0 where id = $1", [k.id]))).rejects.toThrow(/zeiteintrag_unveraenderlich/);
      await expect(apiDb.imKontext({ kontoId: leaKonto, unternehmenId: u }, (tx) => tx.abfrage("delete from app.zeiteintrag where id = $1", [n.id]))).rejects.toThrow(/permission denied|zeiteintrag_unveraenderlich/);
      await expect(apiDb.imKontext({ kontoId: leaKonto, unternehmenId: u }, (tx) => tx.abfrage("update app.unterweisung_teilnahme set name_bestaetigt = 'x'"))).rejects.toThrow();
      await apiDb.schliessen();
    });

    it("Gefährdungsbeurteilung: Gefährdungen mit Maßnahmen, Abschluss mit PDF erledigt die Pflichten, danach nur Umsetzung", async () => {
      const b = (await alsLea(http().post("/v1/gefaehrdungsbeurteilungen")).send({ arbeitsbereich: "Backstube", taetigkeiten: "Teig, Ofen", beurteilt_von: "Lea", datum: heuteIso, mutterschutz: true }).expect(201)).body;
      await alsLea(http().post(`/v1/gefaehrdungsbeurteilungen/${b.id}/abschliessen`)).expect(422);
      await alsLea(http().post(`/v1/gefaehrdungsbeurteilungen/${b.id}/gefaehrdungen`)).send({ faktor: "laerm", beschreibung: "x", risiko: "hoch", massnahme: "y" }).expect(422);
      const g = (await alsLea(http().post(`/v1/gefaehrdungsbeurteilungen/${b.id}/gefaehrdungen`)).send({ faktor: "einwirkungen", beschreibung: "Heiße Bleche", risiko: "mittel", massnahme: "Hitzeschutzhandschuhe", verantwortlich: "Lea", umsetzen_bis: heuteIso }).expect(201)).body;
      await alsLea(http().put(`/v1/gefaehrdungen/${g.id}`)).send({ faktor: "einwirkungen", beschreibung: "Heiße Bleche und Öfen", risiko: "hoch", massnahme: "Hitzeschutzhandschuhe", verantwortlich: "Lea" }).expect(200);
      const vorher = (await alsLea(http().get("/v1/pflichten")).expect(200)).body.filter((x: { pflicht_id: string; status: string; ergebnis: string }) =>
        ["arbeitsschutz.gefaehrdungsbeurteilung", "personal.mutterschutz_gefaehrdungsbeurteilung"].includes(x.pflicht_id) && x.status === "offen" && x.ergebnis === "gilt");
      expect(vorher.length).toBeGreaterThanOrEqual(2);
      const r = (await alsLea(http().post(`/v1/gefaehrdungsbeurteilungen/${b.id}/abschliessen`)).expect(201)).body;
      expect(r.erledigte_pflichten).toBe(vorher.length);
      const pdf = await alsLea(http().get(`/v1/dokumente/${r.dokument_id}/datei`)).expect(200);
      expect(pdf.body.subarray(0, 5).toString()).toBe("%PDF-");
      await alsLea(http().post(`/v1/gefaehrdungsbeurteilungen/${b.id}/abschliessen`)).expect(409);
      await alsLea(http().put(`/v1/gefaehrdungsbeurteilungen/${b.id}`)).send({ arbeitsbereich: "neu", beurteilt_von: "Lea", datum: heuteIso }).expect(409);
      await alsLea(http().post(`/v1/gefaehrdungsbeurteilungen/${b.id}/gefaehrdungen`)).send({ faktor: "psychisch", beschreibung: "Zeitdruck", risiko: "gering", massnahme: "Pausen" }).expect(409);
      await alsLea(http().delete(`/v1/gefaehrdungen/${g.id}`)).expect(409);
      const u = (await alsLea(http().post(`/v1/gefaehrdungen/${g.id}/umsetzung`)).send({ umgesetzt_am: heuteIso, wirksamkeit_notiz: "Handschuhe werden getragen" }).expect(201)).body;
      expect(u.umgesetzt_am).toBe(heuteIso);
      const liste = (await alsLea(http().get("/v1/gefaehrdungsbeurteilungen")).expect(200)).body;
      expect(liste[0]).toMatchObject({ gefaehrdungen: 1, offen: 0, ueberfaellig: 0 });
      expect((await alsLea(http().get("/v1/gefaehrdungsfaktoren")).expect(200)).body).toHaveLength(7);
      // Entwurf lässt sich samt Gefährdungen löschen
      const e = (await alsLea(http().post("/v1/gefaehrdungsbeurteilungen")).send({ arbeitsbereich: "Laden", beurteilt_von: "Lea", datum: heuteIso }).expect(201)).body;
      await alsLea(http().post(`/v1/gefaehrdungsbeurteilungen/${e.id}/gefaehrdungen`)).send({ faktor: "arbeitsstaette", beschreibung: "Stufe", risiko: "gering", massnahme: "Markierung" }).expect(201);
      await alsLea(http().delete(`/v1/gefaehrdungsbeurteilungen/${e.id}`)).expect(204);
    });

    it("Elektrische Arbeitsmittel: Prüfungen mit nächstem Termin aus dem Intervall, Aussonderung", async () => {
      const a = (await alsLea(http().post("/v1/arbeitsmittel")).send({ bezeichnung: "Teigmaschine", standort: "Backstube", pruefintervall_monate: 12 }).expect(201)).body;
      expect((await alsLea(http().get("/v1/profil")).expect(200)).body.daten["arbeitsschutz.elektrische_geraete"]).toBe(true);
      const p = (await alsLea(http().post(`/v1/arbeitsmittel/${a.id}/pruefungen`)).send({ datum: "2026-01-31", ergebnis: "bestanden", pruefer: "Elektro Meier" }).expect(201)).body;
      expect(p.naechste_pruefung).toBe("2027-01-31");
      const q = (await alsLea(http().post(`/v1/arbeitsmittel/${a.id}/pruefungen`)).send({ datum: "2026-03-01", ergebnis: "maengel", pruefer: "Elektro Meier", naechste_pruefung: "2026-04-01", bemerkung: "Kabel tauschen" }).expect(201)).body;
      expect(q.naechste_pruefung).toBe("2026-04-01");
      const l = (await alsLea(http().get("/v1/arbeitsmittel")).expect(200)).body;
      expect(l[0]).toMatchObject({ bezeichnung: "Teigmaschine", letzte_pruefung: "2026-03-01", letztes_ergebnis: "maengel", naechste_pruefung: "2026-04-01", ueberfaellig: heuteIso > "2026-04-01" });
      await alsLea(http().post(`/v1/arbeitsmittel/${a.id}/pruefungen`)).send({ datum: "2026-04-01", ergebnis: "ausgesondert", pruefer: "Elektro Meier" }).expect(201);
      await alsLea(http().post(`/v1/arbeitsmittel/${a.id}/pruefungen`)).send({ datum: "2026-05-01", ergebnis: "bestanden", pruefer: "x" }).expect(409);
      expect((await alsLea(http().get(`/v1/arbeitsmittel/${a.id}/pruefungen`)).expect(200)).body).toHaveLength(3);
    });

    it("Gefahrstoffe: Verzeichnis mit Sicherheitsdatenblatt, PDF, Entfernen", async () => {
      const g = (await alsLea(http().post("/v1/gefahrstoffe")).send({ bezeichnung: "Ofenreiniger", hersteller: "Putz GmbH", verwendung: "Reinigung Backofen", menge: "ca. 5 l im Jahr" }).expect(201)).body;
      expect((await alsLea(http().get("/v1/profil")).expect(200)).body.daten["arbeitsschutz.gefahrstoffe"]).toBe(true);
      await alsLea(http().post(`/v1/gefahrstoffe/${g.id}/sicherheitsdatenblatt`)).attach("datei", Buffer.from("kein pdf"), { filename: "sdb.pdf", contentType: "application/pdf" }).expect(422);
      const s = (await alsLea(http().post(`/v1/gefahrstoffe/${g.id}/sicherheitsdatenblatt`)).attach("datei", Buffer.from("%PDF-1.4\n% SDB\n"), { filename: "sdb.pdf", contentType: "application/pdf" }).expect(201)).body;
      expect(s.sdb_dokument_id).toMatch(/^[0-9a-f-]{36}$/);
      const v = await alsLea(http().get("/v1/gefahrstoffe/verzeichnis")).buffer(true).parse((res, cb) => { const t: Buffer[] = []; res.on("data", (c: Buffer) => t.push(c)); res.on("end", () => cb(null, Buffer.concat(t))); }).expect(200);
      expect(v.headers["content-type"]).toContain("application/pdf");
      expect((v.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      await alsLea(http().post(`/v1/gefahrstoffe/${g.id}/entfernen`)).send({ datum: heuteIso }).expect(201);
      await alsLea(http().put(`/v1/gefahrstoffe/${g.id}`)).send({ bezeichnung: "x" }).expect(404);
      expect((await alsLea(http().get("/v1/gefahrstoffe")).expect(200)).body[0].entfernt_am).toBe(heuteIso);
    });
  });

  describe("Datenschutz, IT-Sicherheit, KI", () => {
    let dana: string;
    let u: string;
    const alsDana = (x: request.Test) => x.set("Authorization", `Bearer ${dana}`).set("X-Unternehmen-Id", u);
    const heuteIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
    const pflicht = async (id: string, periode?: string) =>
      ((await alsDana(http().get("/v1/pflichten")).expect(200)).body as { pflicht_id: string; periode: string; ergebnis: string; status: string }[]).filter((x) => x.pflicht_id === id && (!periode || x.periode === periode));
    const binaer = (r: request.Test) => r.buffer(true).parse((res, cb) => { const t: Buffer[] = []; res.on("data", (c: Buffer) => t.push(c)); res.on("end", () => cb(null, Buffer.concat(t))); });

    beforeAll(async () => {
      dana = await token("dana");
      u = (await http().post("/v1/unternehmen").set("Authorization", `Bearer ${dana}`).send({ name: "Danas Agentur" }).expect(201)).body.id;
      await alsDana(http().put("/v1/profil")).send({ daten: {
        rechtsform: "gmbh", gruendungsdatum: "2021-01-01", "taetigkeit.einordnung": "gewerbe", "beschaeftigte.gesamt": 3, gemeinde_ags: "11000000",
        "datenverarbeitung.arten": ["kundendaten", "newsletter"], "datenschutz.dienstleister": false, "ki.nutzung": true, "ki.eigene_produkte": false, "nis2.betroffen": "nein",
      } }).expect(200);
      await neuberechnen(worker, u, "test", { kalender: new StandardKalender() });
    });

    it("Katalog F: VVT und KI-Kompetenz gelten, AVV ohne Dienstleister nicht, NIS2 geklärt", async () => {
      expect((await pflicht("datenschutz.vvt"))[0]?.ergebnis).toBe("gilt");
      expect((await pflicht("datenschutz.avv"))[0]?.ergebnis).toBe("gilt_nicht");
      expect((await pflicht("ki.kompetenz"))[0]?.ergebnis).toBe("gilt");
      expect((await pflicht("it_sicherheit.nis2_pruefen"))[0]?.ergebnis).toBe("gilt_nicht");
    });

    it("VVT mit Vorschlägen aus dem Profil, TOM nach Schutzzielen, Dienstleister mit AVV; Ablage erledigt die Pflichten", async () => {
      const v = (await alsDana(http().get("/v1/verarbeitungen/vorschlaege")).expect(200)).body;
      expect(v).toEqual(expect.arrayContaining(["Kundenverwaltung und Rechnungen", "Personalverwaltung", "Newsletter", "Einsatz von KI-Werkzeugen"]));
      await alsDana(http().post("/v1/datenschutz/dokumentation")).expect(422); // noch nichts erfasst
      const a = (await alsDana(http().post("/v1/verarbeitungen")).send({ bezeichnung: "Kundenverwaltung und Rechnungen", zweck: "Aufträge abwickeln", betroffene: "Kunden", datenarten: "Name, Adresse", loeschfrist: "nach Ablauf der Aufbewahrung" }).expect(201)).body;
      expect((await alsDana(http().get("/v1/verarbeitungen/vorschlaege")).expect(200)).body).not.toContain("Kundenverwaltung und Rechnungen");
      await alsDana(http().put(`/v1/verarbeitungen/${a.id}`)).send({ bezeichnung: "Kundenverwaltung und Rechnungen", zweck: "Aufträge abwickeln und abrechnen" }).expect(200);
      await alsDana(http().post("/v1/tom")).send({ schutzziel: "geheim", massnahme: "x" }).expect(422);
      await alsDana(http().post("/v1/tom")).send({ schutzziel: "pseudonymisierung_verschluesselung", massnahme: "Festplatten verschlüsselt", umgesetzt_am: heuteIso }).expect(201);
      const t2 = (await alsDana(http().post("/v1/tom")).send({ schutzziel: "wiederherstellung", massnahme: "Tägliche Datensicherung" }).expect(201)).body;
      await alsDana(http().delete(`/v1/tom/${t2.id}`)).expect(204);
      expect((await alsDana(http().get("/v1/tom/schutzziele")).expect(200)).body).toHaveLength(7);
      const d = (await alsDana(http().post("/v1/dienstleister")).send({ name: "Mail-Tool GmbH", leistung: "Newsletter-Versand" }).expect(201)).body;
      expect((await alsDana(http().get("/v1/profil")).expect(200)).body.daten["datenschutz.dienstleister"]).toBe(true);
      expect((await alsDana(http().get("/v1/dienstleister")).expect(200)).body[0].avv_fehlt).toBe(true);
      await alsDana(http().post(`/v1/dienstleister/${d.id}/avv`)).attach("datei", Buffer.from("kein pdf"), { filename: "avv.pdf", contentType: "application/pdf" }).expect(422);
      await alsDana(http().post(`/v1/dienstleister/${d.id}/avv`)).attach("datei", Buffer.from("%PDF-1.4\n% AVV\n"), { filename: "avv.pdf", contentType: "application/pdf" }).expect(201);
      expect((await alsDana(http().get("/v1/dienstleister")).expect(200)).body[0].avv_fehlt).toBe(false);
      await neuberechnen(worker, u, "test", { kalender: new StandardKalender() });
      expect((await pflicht("datenschutz.avv"))[0]?.ergebnis).toBe("gilt");
      const pdf = await binaer(alsDana(http().get("/v1/datenschutz/dokumentation"))).expect(200);
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      const r = (await alsDana(http().post("/v1/datenschutz/dokumentation")).expect(201)).body;
      expect(r.erledigte_pflichten).toBe(3); // VVT, TOM, AVV
      for (const id of ["datenschutz.vvt", "datenschutz.tom", "datenschutz.avv"]) expect((await pflicht(id))[0]?.status).toBe("erledigt");
    });

    it("Betroffenenanfrage: Frist ein Monat, Pflicht entsteht je Eingangstag und wird mit der Antwort erledigt", async () => {
      const morgen = new Date(Date.now() + 86_400_000 * 2).toISOString().slice(0, 10);
      await alsDana(http().post("/v1/betroffenenanfragen")).send({ eingang_am: morgen, art: "auskunft", person: "M. Muster" }).expect(422);
      const a = (await alsDana(http().post("/v1/betroffenenanfragen")).send({ eingang_am: heuteIso, art: "auskunft", person: "M. Muster" }).expect(201)).body;
      const [j, m, t] = heuteIso.split("-").map(Number) as [number, number, number];
      const frist = new Date(Date.UTC(j, m, 1));
      frist.setUTCDate(Math.min(t, new Date(Date.UTC(j, m + 1, 0)).getUTCDate()));
      expect(a.frist_am).toBe(frist.toISOString().slice(0, 10));
      expect((await alsDana(http().get("/v1/betroffenenanfragen")).expect(200)).body[0].tage_uebrig).toBeGreaterThanOrEqual(28);
      await neuberechnen(worker, u, "test", { kalender: new StandardKalender() });
      const periode = `aenderung-${heuteIso.replaceAll("-", "")}`;
      expect((await pflicht("datenschutz.betroffenenanfrage", periode))[0]).toMatchObject({ ergebnis: "gilt", status: "offen" });
      const e = (await alsDana(http().post(`/v1/betroffenenanfragen/${a.id}/erledigen`)).send({ datum: heuteIso, antwort: "Auskunft per E-Mail erteilt" }).expect(201)).body;
      expect(e.erledigte_pflichten).toBe(1);
      await alsDana(http().post(`/v1/betroffenenanfragen/${a.id}/erledigen`)).send({ datum: heuteIso, antwort: "nochmal" }).expect(409);
      expect((await pflicht("datenschutz.betroffenenanfrage", periode))[0]?.status).toBe("erledigt");
    });

    it("Datenpanne: Notfallknopf mit 72-Stunden-Frist, Bewertung, Meldung, Meldeentwurf; danach unveränderlich", async () => {
      const p = (await alsDana(http().post("/v1/datenpannen")).send({ beschreibung: "Laptop mit Kundendaten im Zug verloren" }).expect(201)).body;
      expect(new Date(p.frist_bis).getTime() - new Date(p.entdeckt_am).getTime()).toBe(72 * 3600_000);
      await alsDana(http().post(`/v1/datenpannen/${p.id}/abschliessen`)).expect(422); // Bewertung fehlt
      await alsDana(http().put(`/v1/datenpannen/${p.id}`)).send({ beschreibung: p.beschreibung, risiko: "kein_risiko" }).expect(422); // Begründung fehlt
      await alsDana(http().put(`/v1/datenpannen/${p.id}`)).send({ beschreibung: p.beschreibung, datenarten: "Name, Adresse", betroffene_anzahl: "ca. 120", risiko: "risiko", massnahmen: "Fernlöschung" }).expect(200);
      await alsDana(http().post(`/v1/datenpannen/${p.id}/abschliessen`)).expect(422); // Meldung fehlt
      const entwurf = await binaer(alsDana(http().get(`/v1/datenpannen/${p.id}/meldeentwurf`))).expect(200);
      expect((entwurf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      await alsDana(http().post(`/v1/datenpannen/${p.id}/gemeldet`)).send({ gemeldet_am: new Date().toISOString(), aktenzeichen: "LDA-123" }).expect(201);
      await neuberechnen(worker, u, "test", { kalender: new StandardKalender() });
      const pPeriode = `aenderung-${heuteIso.replaceAll("-", "")}`;
      expect((await pflicht("datenschutz.datenpanne_meldung", pPeriode))[0]).toMatchObject({ ergebnis: "gilt", status: "faellig_bald" });
      const r = (await alsDana(http().post(`/v1/datenpannen/${p.id}/abschliessen`)).expect(201)).body;
      expect(r.erledigte_pflichten).toBe(1);
      expect((await pflicht("datenschutz.datenpanne_meldung", pPeriode))[0]?.status).toBe("erledigt");
      await alsDana(http().put(`/v1/datenpannen/${p.id}`)).send({ beschreibung: "geändert" }).expect(404);
      const danaKonto = (await http().get("/v1/ich").set("Authorization", `Bearer ${dana}`).expect(200)).body.konto.id;
      const apiDb = new Datenbank(urls.api);
      await expect(apiDb.imKontext({ kontoId: danaKonto, unternehmenId: u }, (tx) => tx.abfrage("update app.datenpanne set beschreibung = 'x' where id = $1", [p.id]))).rejects.toThrow(/datenpanne_unveraenderlich/);
      await expect(apiDb.imKontext({ kontoId: danaKonto, unternehmenId: u }, (tx) => tx.abfrage("delete from app.datenpanne where id = $1", [p.id]))).rejects.toThrow(/permission denied|datenpanne_unveraenderlich/);
      await apiDb.schliessen();
    });

    it("KI-Kompetenz-Schulung über das Unterweisungsmodul erledigt die Pflicht nach Art. 4 KI-VO", async () => {
      const b = (await alsDana(http().post("/v1/beschaeftigte")).send({ vorname: "Kai", nachname: "Klug", art: "vollzeit", eintritt: "2021-02-01" }).expect(201)).body;
      const s2 = (await alsDana(http().post("/v1/unterweisungen")).send({ thema: "KI im Arbeitsalltag", inhalt: "Chancen, Grenzen, Regeln im Betrieb", datum: heuteIso, durchgefuehrt_von: "Dana", art: "ki_kompetenz" }).expect(201)).body;
      expect(s2.art).toBe("ki_kompetenz");
      await alsDana(http().post(`/v1/unterweisungen/${s2.id}/bestaetigen`)).send({ beschaeftigter_id: b.id, name: "Kai Klug" }).expect(201);
      const r = (await alsDana(http().post(`/v1/unterweisungen/${s2.id}/abschliessen`)).expect(201)).body;
      expect(r.erledigte_pflichten).toBe(1);
      expect((await pflicht("ki.kompetenz"))[0]?.status).toBe("erledigt");
      expect((await alsDana(http().get("/v1/unterweisungen?art=ki_kompetenz")).expect(200)).body).toHaveLength(1);
      expect((await alsDana(http().get("/v1/unterweisungen?art=arbeitsschutz")).expect(200)).body).toHaveLength(0);
      await alsDana(http().get("/v1/unterweisungen?art=quatsch")).expect(400);
    });
  });
});
