import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Datenbank, StudioFehler, importiereKatalog, kontrast, uebersetzungListe, uebersetzungSpeichern, markeSpeichern, markenListe, pruefeMarke, partnerListe, partnerSpeichern, pflichtUebersicht, pflichtVersionen, pruefentscheidung, releaseVeroeffentlichen, studioKonto, testlauf, type StudioKonto } from "../src/index.js";
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
    await konto("admin", "plattform_admin");
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
  let neueVersion: number;
  it("legt neue Versionen nur gültig und mit fortlaufender Nummer an", async () => {
    const [v1] = await pflichtVersionen(studio, "steuern.ust_voranmeldung");
    await expect(neuePflichtversionImport({ ...v1!.daten, kurz: { de: "" } })).rejects.toThrow(StudioFehler);
    await expect(neuePflichtversionImport({ ...v1!.daten, ausloeser: { feld: "profil.gibt_es_nicht", op: "==", wert: true } })).rejects.toThrow(/unbekannter Fakt/);
    await expect(neuePflichtversionAls(k.stb!, { ...v1!.daten })).rejects.toThrow(/Redaktion/);
    const r = await neuePflichtversionImport({ ...v1!.daten, version: 99, kurz: { de: "Neu formuliert." } });
    // fortlaufend nach der importierten Katalogversion (R10: Katalog steht bei Version 2)
    neueVersion = v1!.version + 1;
    expect(r.version).toBe(neueVersion);
    neueId = r.id;
    // die importierte Version (Entwurf) ist damit überholt
    expect((await pflichtVersionen(studio, "steuern.ust_voranmeldung")).map((v) => [v.version, v.pruef_status])).toEqual([
      [neueVersion, "in_pruefung"],
      [v1!.version, "zurueckgezogen"],
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
    expect(ueb).toMatchObject({ version: neueVersion, pruef_status: "freigegeben", freigaben: 2, im_release: false });
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
      // R10: die Voranmeldung nutzt auch die Kleinunternehmergrenzen (Pflicht über der Grenze ohne bekannte Zahllast)
      tx.abfrage<{ id: string }>("select id from katalog.regelwert_version where regelwert_id in ('steuern.ust_va.grenze_befreiung', 'steuern.ust_va.grenze_monatlich', 'steuern.ustg19.grenze_vorjahr', 'steuern.ustg19.grenze_laufendes_jahr')"),
    );
    for (const { id } of rw) {
      await pruefentscheidung(studio, k.pruefer!, id, { entscheidung: "freigegeben", qualifikation: null }, "regelwert_version");
      expect(await pruefentscheidung(studio, k.stb!, id, { entscheidung: "freigegeben", qualifikation: "steuerberater" }, "regelwert_version")).toEqual({ status: "freigegeben" });
    }
    const p = await releaseVeroeffentlichen(studio, k.redakteurin!, "prod-Release");
    expect(p.inhalte).toBe(1 + rw.length); // USt-Version + die freigegebenen Regelwerte, nichts Ungeprüftes
    await owner.imKontext({}, (tx) => tx.abfrage("update katalog.plattform set umgebung = 'dev'"));
  });

  it("legt Regelwertversionen nur gültig an; Einheit fest, Überholtes zurückgezogen", async () => {
    const { neueRegelwertversion, regelwertVersionen } = await import("../src/studio.js");
    // ein Regelwert, den der Release-Test oben nicht freigibt (R10: die Voranmeldung nutzt die Vorjahresgrenze)
    const [v1] = await regelwertVersionen(studio, "steuern.ustg19.grenze_gruendungsjahr");
    const basis = { ...(v1!.daten as Record<string, unknown>) };
    await expect(neueRegelwertversion(studio, k.redakteurin!, { ...basis, quellen: [] })).rejects.toThrow(/Quellen: braucht mindestens 1 Eintrag/);
    await expect(neueRegelwertversion(studio, k.redakteurin!, { ...basis, einheit: "anzahl" })).rejects.toThrow(/Einheit/);
    await expect(neueRegelwertversion(studio, k.redakteurin!, { ...basis, gueltig_bis: "2020-01-01" })).rejects.toThrow(/liegt vor/);
    await expect(neueRegelwertversion(studio, k.stb!, basis)).rejects.toThrow(/Redaktion/);
    const r = await neueRegelwertversion(studio, k.redakteurin!, { ...basis, version: 42, fachlich_zu_pruefen: ["Test"] });
    expect(r.version).toBe(2);
    expect((await regelwertVersionen(studio, "steuern.ustg19.grenze_gruendungsjahr")).map((v) => [v.version, v.pruef_status])).toEqual([
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

  it("pflegt Marktplatz-Partner: nur Redaktion/Admin, sichtbar nur mit geprüfter Zulassung, Daten geprüft", async () => {
    const basis = { name: "Kanzlei Test", qualifikation: "steuerberater", email: "info@kanzlei.example", regionen: ["BE"], pakete: [{ titel: "Gründung", preis_text: "Festpreis" }] };
    await expect(partnerSpeichern(studio, k.stb!, basis)).rejects.toThrow(/Redaktion/);
    await expect(partnerSpeichern(studio, k.redakteurin!, basis)).rejects.toThrow(/geprüfter Berufszulassung/);
    await expect(partnerSpeichern(studio, k.redakteurin!, { ...basis, email: "kaputt", regionen: ["XX"], zulassung_geprueft_am: "2026-09-01" })).rejects.toThrow(/E-Mail.*Bundesland unbekannt: XX/);
    const p = (await partnerSpeichern(studio, k.redakteurin!, { ...basis, zulassung_geprueft_am: "2026-09-01" })) as { id: string };
    await partnerSpeichern(studio, k.redakteurin!, { ...basis, name: "Kanzlei Test & Partner", aktiv: false }, p.id);
    expect((await partnerListe(studio)).find((x) => x.id === p.id)).toMatchObject({ name: "Kanzlei Test & Partner", aktiv: false });
  });

  it("pflegt White-Label-Marken: nur Admin, Farben mit ausreichendem Kontrast, Hosts eindeutig", async () => {
    const basis = { schluessel: "kanzlei-test", name: "Kanzlei Test", hosts: ["Pflichten.Kanzlei-Test.example"], farbe_hell: "#1f4e8c", farbe_dunkel: "#8fb8ff" };
    await expect(markeSpeichern(studio, k.redakteurin!, basis)).rejects.toThrow(/Plattform-Admin/);
    await expect(markeSpeichern(studio, k.admin!, { ...basis, farbe_hell: "#7fd1ff" })).rejects.toThrow(/Farbe hell: Kontrast 1,[0-9]+ : 1/);
    const m = (await markeSpeichern(studio, k.admin!, basis)) as { id: string; hosts: string[] };
    expect(m.hosts).toEqual(["pflichten.kanzlei-test.example"]);
    await expect(markeSpeichern(studio, k.admin!, { ...basis, schluessel: "andere" })).rejects.toThrow(/Host ist schon/);
    expect((await markenListe(studio)).find((x) => x.id === m.id)).toMatchObject({ name: "Kanzlei Test", unternehmen: 0 });
  });
});

describe.skipIf(!DB_VERFUEGBAR)("Studio: Übersetzungen prüfen", () => {
  let urls: Awaited<ReturnType<typeof frischeDatenbank>>;
  let owner: Datenbank;
  let studio: Datenbank;
  beforeAll(async () => {
    urls = await frischeDatenbank("amtlos_studio_ue_test");
    owner = new Datenbank(urls.owner);
    studio = new Datenbank(urls.studio);
    await importiereKatalog(studio, path.join(WURZEL, "catalog"));
  });
  afterAll(async () => {
    await owner?.schliessen();
    await studio?.schliessen();
  });

  it("importiert, lokalisiert, prüft; erneuter Import lässt Geprüftes stehen", async () => {
    const l = await uebersetzungListe(studio, { suche: "Umsatzsteuer-Voranmeldung abgeben" });
    expect(l.gesamt).toBeGreaterThan(700);
    const z = l.zeilen.find((x) => x.de === "Umsatzsteuer-Voranmeldung abgeben")!;
    expect(z).toMatchObject({ status: "maschinell", benutzt: true });
    const konto = await owner.imKontext({}, async (tx) => {
      const r = await tx.eine<{ id: string }>("select app.konto_anmelden('red', 'red@example.org', 'Red') as id");
      await tx.abfrage("insert into app.konto_plattform_rolle values ($1, 'redaktion')", [r!.id]);
      return { id: r!.id, sub: "red", rollen: ["redaktion"] } as unknown as StudioKonto;
    });
    await expect(uebersetzungSpeichern(studio, { ...konto, rollen: ["experte"] } as StudioKonto, z.schluessel, "x", true)).rejects.toThrow(/Redaktion/);
    await uebersetzungSpeichern(studio, konto, z.schluessel, "Submit the advance VAT return (UStVA)", true);
    const titel = await owner.imKontext({}, (tx) =>
      tx.eine<{ en: string }>("select daten->'titel'->>'en' as en from katalog.pflicht_version_anzeige where pflicht_id = 'steuern.ust_voranmeldung' order by version desc limit 1"),
    );
    expect(titel!.en).toBe("Submit the advance VAT return (UStVA)");
    const r = await importiereKatalog(studio, path.join(WURZEL, "catalog"));
    expect(r.uebersetzungen).toBe(0); // Geprüftes aus dem Studio gewinnt gegen die Datei (E-030)
    expect((await uebersetzungListe(studio, { suche: "Umsatzsteuer-Voranmeldung abgeben" })).zeilen.find((x) => x.de === z.de)).toMatchObject({ status: "geprueft", text: "Submit the advance VAT return (UStVA)" });
  });
});

describe("Markenfarben: Kontrast nach WCAG", () => {
  it("berechnet das Kontrastverhältnis", () => {
    expect(kontrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(kontrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
  it("die Amtlos-Farben selbst bestehen die Prüfung", () => {
    expect(pruefeMarke({ schluessel: "amtlos", name: "Amtlos", farbe_hell: "#136f5b", farbe_dunkel: "#5cc2a6" })).toEqual([]);
  });
  it("lehnt zu helle oder zu dunkle Farben und unsichere Logos ab", () => {
    const f = pruefeMarke({ schluessel: "X", name: "A", farbe_hell: "#ffcc00", farbe_dunkel: "#203040", logo_url: "javascript:alert(1)" });
    expect(f.join(" | ")).toMatch(/Schlüssel.*Name.*Farbe hell.*Farbe dunkel.*Logo/);
  });
});
