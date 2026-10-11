import { describe, expect, it } from "vitest";
import { ApiFehler, ApiKlient, NetzFehler, type Abruf } from "../src/kern/api";
import { StempelWarteschlange, uuidAus, type Speicher } from "../src/kern/warteschlange";
import { dauerSeit, uhrzeit } from "../src/kern/zeit";

const speicher = (): Speicher & { daten: Record<string, string> } => {
  const daten: Record<string, string> = {};
  return { daten, lesen: async (k) => daten[k] ?? null, schreiben: async (k, v) => void (daten[k] = v) };
};

describe("API-Client der App", () => {
  it("schickt Token, Unternehmen und Sprache; meldet API- und Netzfehler unterscheidbar", async () => {
    const aufrufe: { url: string; kopf: Record<string, string>; body?: unknown }[] = [];
    const abruf: Abruf = async (url, init) => {
      aufrufe.push({ url, kopf: init.headers, body: init.body });
      if (url.endsWith("/v1/heute")) return { ok: true, status: 200, json: async () => ({ als_naechstes: [] }) };
      if (url.endsWith("/v1/zeiten/kommen")) return { ok: false, status: 422, json: async () => ({ meldung: "x", fehler: [{ feld: "zeitpunkt", meldung: "zu alt" }] }) };
      throw new TypeError("Network request failed");
    };
    const k = new ApiKlient({ basis: "https://api.example", token: async () => "T", unternehmen: () => "U", sprache: () => "en", abruf });
    await k.heute();
    expect(aufrufe[0]).toMatchObject({ url: "https://api.example/v1/heute", kopf: { Authorization: "Bearer T", "X-Unternehmen-Id": "U", "X-Sprache": "en" } });
    await k.ich().catch(() => undefined);
    expect(aufrufe[1]!.kopf["X-Unternehmen-Id"]).toBeUndefined(); // /v1/ich ohne Unternehmen
    await expect(k.kommen({ beschaeftigter_id: "b", client_id: "c" })).rejects.toEqual(new ApiFehler(422, "zu alt"));
    await expect(k.pflichten()).rejects.toBeInstanceOf(NetzFehler);
  });
});

describe("Offline-Warteschlange für Stempel", () => {
  const st = (n: number, art: "kommen" | "gehen" = "kommen") => ({ client_id: `id-${n}`, art, unternehmen_id: "u", beschaeftigter_id: "b", zeitpunkt: `2026-10-11T08:0${n}:00Z` });

  it("überträgt der Reihe nach, hält bei Netzfehler an und macht später weiter", async () => {
    const q = new StempelWarteschlange(speicher(), () => Date.parse("2026-10-11T12:00:00Z"));
    await q.hinzufuegen(st(1));
    await q.hinzufuegen(st(2, "gehen"));
    await q.hinzufuegen(st(2, "gehen")); // doppelt getippt: nur einmal
    let netz = false;
    const gesendet: string[] = [];
    const klient = {
      kommen: async (d: { client_id: string; zeitpunkt?: string }, u?: string) => {
        if (!netz) throw new NetzFehler("offline");
        gesendet.push(d.client_id);
        expect(u).toBe("u"); // Unternehmen des Stempels, nicht das gerade gewählte
        expect(d.zeitpunkt).toBe("2026-10-11T08:01:00Z"); // alt: Gerätezeit
        return {} as never;
      },
      gehen: async (d: { client_id: string }) => {
        gesendet.push(d.client_id);
        return {} as never;
      },
    };
    expect(await q.abarbeiten(klient)).toEqual({ gesendet: 0, offen: 2 });
    netz = true;
    expect(await q.abarbeiten(klient)).toEqual({ gesendet: 2, offen: 0 });
    expect(gesendet).toEqual(["id-1", "id-2"]);
  });

  it("abgelehnte Stempel werden gezeigt, nicht verworfen; Serverfehler werden wiederholt", async () => {
    const q = new StempelWarteschlange(speicher());
    await q.hinzufuegen(st(1));
    await q.hinzufuegen(st(2));
    let aufruf = 0;
    const klient = {
      kommen: async () => {
        aufruf++;
        if (aufruf === 1) throw new ApiFehler(503, "wartung");
        if (aufruf === 2) throw new ApiFehler(422, "Offline-Stempel älter als 72 Stunden");
        return {} as never;
      },
      gehen: async () => ({}) as never,
    };
    expect(await q.abarbeiten(klient)).toEqual({ gesendet: 0, offen: 2 });
    expect(await q.abarbeiten(klient)).toEqual({ gesendet: 1, offen: 0 });
    const s = await q.stand();
    expect(s.fehlgeschlagen).toEqual([{ ...st(1), meldung: "Offline-Stempel älter als 72 Stunden" }]);
    await q.fehlgeschlageneVerwerfen();
    expect((await q.stand()).fehlgeschlagen).toEqual([]);
  });

  it("übersteht kaputte Speicherinhalte und läuft nie doppelt", async () => {
    const sp = speicher();
    sp.daten["amtlos.stempel.v1"] = "{kaputt";
    const q = new StempelWarteschlange(sp);
    expect(await q.stand()).toEqual({ offen: [], fehlgeschlagen: [] });
    await q.hinzufuegen(st(1));
    let gleichzeitig = 0;
    let max = 0;
    const klient = {
      kommen: async () => {
        gleichzeitig++;
        max = Math.max(max, gleichzeitig);
        await new Promise((r) => setTimeout(r, 5));
        gleichzeitig--;
        return {} as never;
      },
      gehen: async () => ({}) as never,
    };
    await Promise.all([q.abarbeiten(klient), q.abarbeiten(klient)]);
    expect(max).toBe(1);
  });

  it("frische Stempel werden ohne Gerätezeit gesendet (Serverzeit)", async () => {
    const jetzt = Date.parse("2026-10-11T08:01:30Z");
    const q = new StempelWarteschlange(speicher(), () => jetzt);
    await q.hinzufuegen(st(1));
    let zeit: string | undefined = "nicht gesetzt";
    await q.abarbeiten({ kommen: async (d: { zeitpunkt?: string }) => ((zeit = d.zeitpunkt), {} as never), gehen: async () => ({}) as never });
    expect(zeit).toBeUndefined();
  });

  it("erzeugt gültige UUIDs v4", () => {
    const u = uuidAus(new Uint8Array(16).fill(255));
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("Zeitanzeige", () => {
  it("Ortszeit Berlin und laufende Dauer", () => {
    expect(uhrzeit("2026-10-11T06:15:00Z", "de")).toBe("08:15");
    expect(dauerSeit("2026-10-11T06:15:00Z", Date.parse("2026-10-11T09:20:30Z"))).toBe("3:05 h");
  });
});

describe("Gruppen nach Zeithorizont", () => {
  it("teilt in überfällig, Woche, Monat, später, laufend", async () => {
    const { gruppiere } = await import("../src/kern/gruppen");
    const k = (id: string, faellig_am: string | null, status = "offen") => ({ pflicht_id: id, periode: "x", titel: id, kurz: "", status, faellig_am });
    const g = gruppiere([k("a", "2026-10-05", "ueberfaellig"), k("b", "2026-10-15"), k("c", "2026-11-05"), k("d", "2027-01-01"), k("e", null), k("f", "2026-10-12")], "2026-10-11");
    expect(Object.fromEntries(Object.entries(g).map(([n, l]) => [n, l.map((x) => x.pflicht_id)]))).toEqual({ ueberfaellig: ["a"], woche: ["f", "b"], monat: ["c"], spaeter: ["d"], laufend: ["e"] });
  });
});
