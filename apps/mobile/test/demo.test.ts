import { describe, expect, it } from "vitest";
import { ApiKlient } from "../src/kern/api";
import { demoAbruf, type DemoDaten } from "../src/demo/demo";
import daten from "../src/demo/daten.json";

const D = daten as unknown as DemoDaten;
const klient = (jetzt: Date, sprache: "de" | "en" = "de") =>
  new ApiKlient({ basis: "https://demo", token: async () => "demo", unternehmen: () => "demo-unternehmen", sprache: () => sprache, abruf: demoAbruf(D, () => jetzt) });

describe("Demo-Modus", () => {
  it("verschiebt Fristen auf das heutige Datum und hält die Status stimmig", async () => {
    const spaeter = new Date(Date.parse(`${D.stand}T10:00:00Z`) + 40 * 86_400_000);
    const k = klient(spaeter);
    const vorher = (await klient(new Date(`${D.stand}T10:00:00Z`)).heute()).als_naechstes[0]!;
    const h = await k.heute();
    const erste = h.als_naechstes[0]!;
    expect(erste.pflicht_id).toBe(vorher.pflicht_id);
    expect(Date.parse(erste.faellig_am!) - Date.parse(vorher.faellig_am!)).toBe(40 * 86_400_000);
    const heute = spaeter.toISOString().slice(0, 10);
    for (const karte of await k.pflichten()) {
      if (karte.status === "ueberfaellig") expect(karte.faellig_am! < heute).toBe(true);
      if (karte.status === "faellig_bald") expect(karte.faellig_am! >= heute).toBe(true);
    }
  });

  it("Erledigen wirkt auf Heute, Liste und Karte; Wieder öffnen nimmt es zurück", async () => {
    const k = klient(new Date(`${D.stand}T10:00:00Z`));
    const h = await k.heute();
    const ziel = h.als_naechstes[0]!;
    await k.erledigen(ziel.pflicht_id, ziel.periode);
    const danach = await k.heute();
    expect(danach.als_naechstes.some((x) => x.pflicht_id === ziel.pflicht_id && x.periode === ziel.periode)).toBe(false);
    expect(danach.zaehler.erledigt).toBe(h.zaehler.erledigt + 1);
    expect((await k.pflicht(ziel.pflicht_id, ziel.periode)).status).toBe("erledigt");
    await k.wiederOeffnen(ziel.pflicht_id, ziel.periode);
    expect((await k.pflicht(ziel.pflicht_id, ziel.periode)).status).toBe(ziel.status);
  });

  it("Stempeln, Profil und Sprache laufen ohne Server", async () => {
    const k = klient(new Date(`${D.stand}T10:00:00Z`), "en");
    const [person] = await k.beschaeftigte();
    await k.kommen({ beschaeftigter_id: person!.id, client_id: "c1" });
    expect((await k.laufend("x")).map((l) => l.beschaeftigter_id)).toEqual([person!.id]);
    await k.gehen({ beschaeftigter_id: person!.id, client_id: "c2", pause_minuten: 0 });
    expect(await k.laufend("x")).toEqual([]);
    const p = await k.profilSpeichern({ test_feld: true });
    expect(p.daten.test_feld).toBe(true);
    expect((await k.ich()).unternehmen[0]!.name).toBe("Demo company");
    expect((await k.pflichten())[0]!.titel).toBe(D.sprachen.en.pflichten[0]!.titel);
  });
});
