import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Datenbank, StudioFehler, importiereKatalog, pflichtUebersicht, pflichtVersionen, pruefentscheidung, releaseVeroeffentlichen, studioKonto, testlauf, type StudioKonto } from "../src/index.js";
import { DB_VERFUEGBAR, WURZEL, frischeDatenbank } from "../src/testhilfen.js";

describe.skipIf(!DB_VERFUEGBAR)("Studio: Versionen, Vier-Augen-Freigabe, Releases", () => {
  let urls: Awaited<ReturnType<typeof frischeDatenbank>>;
  let owner: Datenbank;
  let studio: Datenbank;
  const k: Record<string, StudioKonto> = {};

  async function konto(sub: string, rolle: string, qual?: string) {
    await owner.imKontext({}, async (tx) => {
      const r = await tx.eine<{ id: string }>("select app.konto_anmelden($1, $2, $3) as id", [sub, `${sub}@example.org`, sub]);
      await tx.abfrage("insert into app.konto_plattform_rolle values ($1, $2)", [r!.id, rolle]);
      if (qual) await tx.abfrage("insert into katalog.experte_qualifikation (konto_id, art, nachweis) values ($1, $2, 'Test')", [r!.id, qual]);
    });
    k[sub] = (await studioKonto(studio, sub))!;
  }

  beforeAll(async () => {
    urls = await frischeDatenbank("amtlos_studio_test");
    owner = new Datenbank(urls.owner);
    studio = new Datenbank(urls.studio);
    await importiereKatalog(studio, path.join(WURZEL, "catalog"));
    await konto("redakteurin", "redaktion");
    await konto("stb", "experte", "steuerberater");
    await konto("ra", "experte", "rechtsanwalt");
    await konto("pruefer", "experte");
  });
  afterAll(async () => {
    await owner?.schliessen();
    await studio?.schliessen();
  });

  it("erkennt Studio-Konten nur mit Plattformrolle", async () => {
    expect(k.stb).toMatchObject({ rollen: ["experte"], qualifikationen: ["steuerberater"] });
    await owner.imKontext({}, (tx) => tx.abfrage("select app.konto_anmelden('kunde', 'k@example.org', 'Kunde')"));
    expect(await studioKonto(studio, "kunde")).toBeUndefined();
  });

  let neueId: string;
  it("legt neue Versionen nur gültig und mit fortlaufender Nummer an", async () => {
    const [v1] = await pflichtVersionen(studio, "steuern.ust_voranmeldung");
    await expect(neuePflichtversionImport({ ...v1!.daten, kurz: { de: "" } })).rejects.toThrow(StudioFehler);
    await expect(neuePflichtversionImport({ ...v1!.daten, ausloeser: { feld: "profil.gibt_es_nicht", op: "==", wert: true } })).rejects.toThrow(/unbekannter Fakt/);
    await expect(neuePflichtversionAls(k.stb!, { ...v1!.daten })).rejects.toThrow(/Redaktion/);
    const r = await neuePflichtversionImport({ ...v1!.daten, version: 99, kurz: { de: "Neu formuliert." } });
    expect(r.version).toBe(2);
    neueId = r.id;
    // Version 1 (importierter Entwurf) ist damit überholt
    expect((await pflichtVersionen(studio, "steuern.ust_voranmeldung")).map((v) => [v.version, v.pruef_status])).toEqual([
      [2, "in_pruefung"],
      [1, "zurueckgezogen"],
    ]);
  });

  it("Vier-Augen-Freigabe mit passender Qualifikation", async () => {
    await expect(pruefentscheidung(studio, k.redakteurin!, neueId, { entscheidung: "freigegeben", qualifikation: null })).rejects.toThrow(/Expert/);
    await expect(pruefentscheidung(studio, k.ra!, neueId, { entscheidung: "freigegeben", qualifikation: "rechtsanwalt" })).rejects.toThrow(/passt nicht/);
    await expect(pruefentscheidung(studio, k.pruefer!, neueId, { entscheidung: "aenderung_noetig", qualifikation: null })).rejects.toThrow(/begründen/);
    expect(await pruefentscheidung(studio, k.pruefer!, neueId, { entscheidung: "freigegeben", qualifikation: null })).toEqual({ status: "in_pruefung" });
    expect(await pruefentscheidung(studio, k.stb!, neueId, { entscheidung: "freigegeben", qualifikation: "steuerberater" })).toEqual({ status: "freigegeben" });
    await expect(pruefentscheidung(studio, k.ra!, neueId, { entscheidung: "freigegeben", qualifikation: null })).rejects.toThrow(/nicht in Prüfung/);
    const ueb = (await pflichtUebersicht(studio)).find((p) => p.pflicht_id === "steuern.ust_voranmeldung");
    expect(ueb).toMatchObject({ version: 2, pruef_status: "freigegeben", freigaben: 2, im_release: false });
  });

  it("Testlauf zeigt die Wirkung einer Änderung auf die Fixtures", async () => {
    const [v2] = await pflichtVersionen(studio, "steuern.ust_voranmeldung");
    const unveraendert = await testlauf(studio, v2!.daten, path.join(WURZEL, "catalog/fixtures"));
    expect(unveraendert.every((f) => f.vorher === f.nachher)).toBe(true);
    const geaendert = await testlauf(studio, { ...v2!.daten, ausloeser: { immer: true } }, path.join(WURZEL, "catalog/fixtures"));
    expect(geaendert.find((f) => f.datei === "solo-freiberufler-kleinunternehmer.yaml")).toMatchObject({ vorher: "gilt_nicht", nachher: "gilt", erwartet: "gilt_nicht" });
  });

  it("veröffentlicht Releases; in prod nur mit freigegebenen Inhalten", async () => {
    let rollout = 0;
    const r = await releaseVeroeffentlichen(studio, k.redakteurin!, "dev-Release", async () => { rollout++; });
    expect(r.nummer).toBe(2);
    expect(rollout).toBe(1);
    expect((await pflichtUebersicht(studio)).find((p) => p.pflicht_id === "steuern.ust_voranmeldung")?.im_release).toBe(true);

    await owner.imKontext({}, (tx) => tx.abfrage("update katalog.plattform set umgebung = 'prod'"));
    // Die freigegebene USt-Version verweist auf noch ungeprüfte Regelwerte → kein Release
    await expect(releaseVeroeffentlichen(studio, k.redakteurin!, "prod-Release")).rejects.toThrow(/Regelwerte fehlen.*grenze_befreiung/);
    const rw = await studio.imKontext({}, (tx) =>
      tx.abfrage<{ id: string }>("select id from katalog.regelwert_version where regelwert_id in ('steuern.ust_va.grenze_befreiung', 'steuern.ust_va.grenze_monatlich')"),
    );
    for (const { id } of rw) {
      await pruefentscheidung(studio, k.pruefer!, id, { entscheidung: "freigegeben", qualifikation: null }, "regelwert_version");
      expect(await pruefentscheidung(studio, k.stb!, id, { entscheidung: "freigegeben", qualifikation: "steuerberater" }, "regelwert_version")).toEqual({ status: "freigegeben" });
    }
    const p = await releaseVeroeffentlichen(studio, k.redakteurin!, "prod-Release");
    expect(p.inhalte).toBe(3); // USt-Version + zwei freigegebene Regelwerte, nichts Ungeprüftes
    await owner.imKontext({}, (tx) => tx.abfrage("update katalog.plattform set umgebung = 'dev'"));
  });

  it("legt Regelwertversionen nur gültig an; Einheit fest, Überholtes zurückgezogen", async () => {
    const { neueRegelwertversion, regelwertVersionen } = await import("../src/studio.js");
    const [v1] = await regelwertVersionen(studio, "steuern.ustg19.grenze_vorjahr");
    const basis = { ...(v1!.daten as Record<string, unknown>) };
    await expect(neueRegelwertversion(studio, k.redakteurin!, { ...basis, quellen: [] })).rejects.toThrow(/Quellen: braucht mindestens 1 Eintrag/);
    await expect(neueRegelwertversion(studio, k.redakteurin!, { ...basis, einheit: "anzahl" })).rejects.toThrow(/Einheit/);
    await expect(neueRegelwertversion(studio, k.redakteurin!, { ...basis, gueltig_bis: "2020-01-01" })).rejects.toThrow(/liegt vor/);
    await expect(neueRegelwertversion(studio, k.stb!, basis)).rejects.toThrow(/Redaktion/);
    const r = await neueRegelwertversion(studio, k.redakteurin!, { ...basis, version: 42, fachlich_zu_pruefen: ["Test"] });
    expect(r.version).toBe(2);
    expect((await regelwertVersionen(studio, "steuern.ustg19.grenze_vorjahr")).map((v) => [v.version, v.pruef_status])).toEqual([
      [2, "in_pruefung"],
      [1, "zurueckgezogen"],
    ]);
    // Neuer Regelwert mit eigener Einheit
    const n = await neueRegelwertversion(studio, k.redakteurin!, { ...basis, id: "test.neuer_wert", einheit: "anzahl", wert: 10, bezeichnung: { de: "Test" } });
    expect(n.version).toBe(1);
  });

  // Hilfen
  async function neuePflichtversionImport(daten: Record<string, unknown>) {
    return neuePflichtversionAls(k.redakteurin!, daten);
  }
  async function neuePflichtversionAls(wer: StudioKonto, daten: Record<string, unknown>) {
    const { neuePflichtversion } = await import("../src/studio.js");
    return neuePflichtversion(studio, wer, daten);
  }
});
