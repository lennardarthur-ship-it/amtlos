import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Datenbank, ProtokollVersand, einladungsText, versendeEinladung } from "../src/index.js";
import { DB_VERFUEGBAR, frischeDatenbank } from "../src/testhilfen.js";
import { MARKE } from "@amtlos/marke";

const h = (t: string) => createHash("sha256").update(t).digest();

describe("Einladungstext", () => {
  it("nennt Unternehmen, Rolle, Link, Ablauf und den E-Mail-Vorbehalt", () => {
    const r = einladungsText({ unternehmen: "Café Morgenrot", rolle: "steuerberater", eingeladen_von: "Anna", laeuft_ab: new Date("2026-10-18T10:00:00Z") }, "https://x/einladung/abc");
    expect(r.betreff).toBe(`Einladung zu Café Morgenrot bei ${MARKE.name}`);
    expect(r.text).toContain(`Anna lädt dich ein, bei Café Morgenrot in ${MARKE.name} mitzuarbeiten (Rolle: Steuerberatung)`);
    expect(r.text).toContain("https://x/einladung/abc");
    expect(r.text).toContain("18. Oktober 2026");
    expect(r.text).toContain("nur, wenn du dich mit dieser E-Mail-Adresse anmeldest");
    expect(einladungsText({ unternehmen: "U", rolle: "admin", eingeladen_von: null, laeuft_ab: new Date() }, "l").text).toMatch(/^Du bist eingeladen, bei U/);
    const en = einladungsText({ unternehmen: "U", rolle: "steuerberater", eingeladen_von: "Anna", laeuft_ab: new Date("2026-10-18T10:00:00Z"), sprache: "en" }, "l");
    expect(en.betreff).toBe(`Invitation to U on ${MARKE.name}`);
    expect(en.text).toContain(`Anna invites you to work on U in ${MARKE.name} (role: Tax adviser)`);
    expect(en.text).toContain("18 October 2026");
  });
});

describe.skipIf(!DB_VERFUEGBAR)("Einladungen in der Datenbank", () => {
  let urls: Awaited<ReturnType<typeof frischeDatenbank>>;
  let api: Datenbank;
  let worker: Datenbank;
  let anna: string;
  let mia: string;
  let firma: string;

  beforeAll(async () => {
    urls = await frischeDatenbank("amtlos_einladung_test");
    api = new Datenbank(urls.api);
    worker = new Datenbank(urls.worker);
    const anmelden = (sub: string) =>
      api.imKontext({}, async (tx) => (await tx.eine<{ id: string }>("select app.konto_anmelden($1, $2, $3) as id", [sub, `${sub}@example.org`, sub]))!.id);
    [anna, mia] = [await anmelden("anna"), await anmelden("mia")];
    firma = await api.imKontext({ kontoId: anna }, async (tx) => (await tx.eine<{ id: string }>("select app.unternehmen_anlegen('Annas Café') as id"))!.id);
    await api.imKontext({ kontoId: anna, unternehmenId: firma }, (tx) => tx.abfrage("insert into app.mitgliedschaft values ($1, $2, 'mitarbeiter')", [firma, mia]));
  });
  afterAll(async () => {
    await api?.schliessen();
    await worker?.schliessen();
  });

  const einladen = (konto: string, email: string, token: string, rolle = "mitarbeiter", tage = 7) =>
    api.imKontext({ kontoId: konto, unternehmenId: firma }, async (tx) =>
      (await tx.eine<{ id: string }>(
        `insert into app.einladung (unternehmen_id, email, rolle, token_hash, laeuft_ab, erstellt_von)
         values ($1, $2, $3, $4, now() + make_interval(days => $5), $6) returning id`,
        [firma, email, rolle, h(token), tage, konto],
      ))!.id,
    );

  it("nur Inhaber/Admin dürfen einladen und Einladungen sehen; Inhaber-Rolle ist ausgeschlossen", async () => {
    await expect(einladen(mia, "x@example.org", "t-mia")).rejects.toThrow(/row-level security/);
    await expect(einladen(anna, "x@example.org", "t-inh", "inhaber")).rejects.toThrow(/einladung_nicht_inhaber/);
    await einladen(anna, "lena@example.org", "t1");
    const sieht = (konto: string) => api.imKontext({ kontoId: konto, unternehmenId: firma }, (tx) => tx.abfrage("select email from app.einladung"));
    expect(await sieht(anna)).toHaveLength(1);
    expect(await sieht(mia)).toHaveLength(0);
    await expect(api.imKontext({ kontoId: anna, unternehmenId: firma }, (tx) => tx.abfrage("delete from app.einladung"))).rejects.toThrow(/permission denied/);
  });

  it("Worker versendet offene Einladungen und überspringt abgelaufene", async () => {
    const offen = await einladen(anna, "ole@example.org", "t2");
    const versand = new ProtokollVersand();
    expect(await versendeEinladung(worker, versand, "https://app.amtlos.test", { einladungId: offen, token: "t2" })).toBe("gesendet");
    expect(versand.gesendet[0]).toMatchObject({ an: "ole@example.org", betreff: `Einladung zu Annas Café bei ${MARKE.name}` });
    expect(versand.gesendet[0]!.text).toContain("https://app.amtlos.test/einladung/t2");
    const abgelaufen = await einladen(anna, "alt@example.org", "t3", "mitarbeiter", -1);
    expect(await versendeEinladung(worker, versand, "x", { einladungId: abgelaufen, token: "t3" })).toBe("uebersprungen");
    // Der Worker kommt an die Tabelle selbst nicht heran
    await expect(worker.imKontext({ unternehmenId: firma }, (tx) => tx.abfrage("select * from app.einladung"))).rejects.toThrow(/permission denied/);
  });

  it("Annehmen prüft E-Mail, Ablauf und Einmaligkeit; der letzte Inhaber bleibt", async () => {
    const lena = await api.imKontext({}, async (tx) => (await tx.eine<{ id: string }>("select app.konto_anmelden('lena', 'LENA@example.org', 'Lena') as id"))!.id);
    await expect(api.imKontext({ kontoId: mia }, (tx) => tx.eine("select app.einladung_annehmen($1)", [h("t1")]))).rejects.toThrow(/einladung_andere_email/);
    await expect(api.imKontext({ kontoId: lena }, (tx) => tx.eine("select app.einladung_annehmen($1)", [h("falsch")]))).rejects.toThrow(/einladung_ungueltig/);
    const u = await api.imKontext({ kontoId: lena }, async (tx) => (await tx.eine<{ id: string }>("select app.einladung_annehmen($1) as id", [h("t1")]))!.id);
    expect(u).toBe(firma);
    await expect(api.imKontext({ kontoId: lena }, (tx) => tx.eine("select app.einladung_annehmen($1)", [h("t1")]))).rejects.toThrow(/einladung_ungueltig/);
    expect(await api.imKontext({ kontoId: lena, unternehmenId: firma }, (tx) => tx.eine("select rolle from app.mitgliedschaft where konto_id = $1", [lena]))).toEqual({ rolle: "mitarbeiter" });
    await expect(
      api.imKontext({ kontoId: anna, unternehmenId: firma }, (tx) => tx.abfrage("delete from app.mitgliedschaft where konto_id = $1", [anna])),
    ).rejects.toThrow(/letzter_inhaber/);
  });
});
