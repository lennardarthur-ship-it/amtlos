import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Beleg } from "@amtlos/fachlogik";
import { SyncFehler, huelleErstellen, huelleOeffnen, standEntschluesseln, standVerschluesseln, syncInhalt, syncZusammenfuehren, synchronisieren, zufallsSchluessel, type SyncUmgebung, type TresorApi } from "../src/konto/sync";
import { fehlerAusStatus, tresorServer } from "../src/konto/api";
import { DATENSCHUTZ, datenschutzAbschnitte } from "../src/rechtliches";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, stornieren, zusammenfuehren, belegLoeschen, belegSetzen, betriebSetzen, felderSetzen, loeschen, personLoeschen, personSetzen, standAus, type Stand } from "../src/unterlagen/speicher";

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const IT = 1000;
const t = (d: string) => new Date(`${d}T09:00:00Z`);
const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne", steuernummer: "143/123/45678" };
const beleg = (id: string, o: Partial<Beleg> = {}): Beleg => ({ id, datum: "2026-10-02", lieferant: "Friseurbedarf Müller", nummer: `L-${id}`, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: "2026-10-02T08:00:00Z", geaendert: "2026-10-02T08:00:00Z", ...o });

const fehlerArt = async (f: () => unknown) => {
  try {
    await f();
  } catch (e) {
    return e instanceof SyncFehler ? e.art : "anderer Fehler";
  }
  return "kein Fehler";
};

describe("Sync-Schlüssel in der Hülle (E-134)", () => {
  it("öffnet die Hülle nur mit dem richtigen Passwort", async () => {
    const k = zufallsSchluessel(zufall);
    const h = huelleErstellen(k, "richtig-langes-passwort", zufall, IT);
    expect(JSON.parse(h)).toMatchObject({ format: "amtlos-schluessel", version: 1, kdf: "PBKDF2-SHA256", iterationen: IT });
    expect(h).not.toContain(Buffer.from(k).toString("base64"));
    expect(huelleOeffnen(h, "richtig-langes-passwort")).toEqual(k);
    expect(await fehlerArt(() => huelleOeffnen(h, "falsches-langes-passwort"))).toBe("passwort");
    expect(await fehlerArt(() => huelleOeffnen(h.replace(/"daten":"(.)/, (_, c: string) => `"daten":"${c === "A" ? "B" : "A"}`), "richtig-langes-passwort"))).toBe("passwort");
    expect(await fehlerArt(() => huelleOeffnen("kein json", "x"))).toBe("format");
    expect(await fehlerArt(() => huelleErstellen(k, "kurz", zufall, IT))).toBe("passwort");
  });

  it("verschlüsselt den Stand ohne Klartext und lässt Gerätegebundenes weg", () => {
    const k = zufallsSchluessel(zufall);
    const s: Stand = { ...betriebSetzen(LEERER_STAND, B), appSperre: true, erinnerungen: true, proTest: true, cloudSicherung: true, letzteSicherung: "2026-10-01T00:00:00Z" };
    const text = standVerschluesseln(s, k, zufall(12));
    expect(text).toMatch(/^\{"format":"amtlos-tresor"/);
    for (const geheim of ["Salon Sonne", "143/123"]) expect(text).not.toContain(geheim);
    const zurueck = standEntschluesseln(text, k);
    expect(zurueck.betrieb.name).toBe("Salon Sonne");
    expect(zurueck).toMatchObject({ appSperre: false, erinnerungen: false, proTest: false, cloudSicherung: false });
    expect(zurueck.letzteSicherung).toBeUndefined();
    expect(syncInhalt(s).appSperre).toBe(false);
    expect(() => standEntschluesseln(text, zufallsSchluessel(zufall))).toThrow(SyncFehler);
  });
});

describe("Zusammenführen zweier Geräte (E-134)", () => {
  it("neuere Fassung gewinnt je Unterlage, Beleg und Person; Neues von beiden Seiten bleibt", () => {
    const basis = anlegen(betriebSetzen(LEERER_STAND, B), "unterweisung", t("2026-10-01"), "u1")[0];
    const a = belegSetzen(felderSetzen(basis, "u1", { thema: "A" }, t("2026-10-03")), beleg("ba"), t("2026-10-03"));
    const b = personSetzen(felderSetzen(basis, "u1", { thema: "B" }, t("2026-10-04")), "mitarbeiter", { id: "m1", name: "Sam" }, t("2026-10-04"));
    const z = syncZusammenfuehren(a, b).stand;
    expect(z.unterlagen.find((u) => u.id === "u1")?.daten.thema).toBe("B");
    expect(z.belege.map((x) => x.id)).toEqual(["ba"]);
    expect(z.mitarbeiter.map((x) => x.id)).toEqual(["m1"]);
    // symmetrisch
    expect(syncZusammenfuehren(b, a).stand.unterlagen.find((u) => u.id === "u1")?.daten.thema).toBe("B");
  });

  it("Gelöschtes kommt nicht zurück – außer es wurde danach woanders geändert", () => {
    let basis = belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-01"));
    basis = belegSetzen(basis, beleg("b2"), t("2026-10-01"));
    basis = personSetzen(basis, "kunde", { id: "k1", name: "Kim" }, t("2026-10-01"));
    basis = anlegen(basis, "unterweisung", t("2026-10-01"), "u1")[0];
    const a = loeschen(personLoeschen(belegLoeschen(basis, "b1", t("2026-10-02")), "kunde", "k1"), "u1");
    const spaeter = new Date(Date.now() + 60_000);
    const b = belegSetzen(basis, beleg("b2", { lieferant: "Später geändert" }), spaeter);
    const z = syncZusammenfuehren(b, a).stand;
    expect(z.belege.map((x) => x.id)).toEqual(["b2"]);
    expect(z.kunden).toEqual([]);
    expect(z.unterlagen).toEqual([]);
    expect(Object.keys(z.geloescht).sort()).toEqual(["b:b1", "k:k1", "u:u1"]);
    // nach dem Löschen woanders geändert: bleibt
    const c = syncZusammenfuehren(belegSetzen(basis, beleg("b1", { notiz: "neu" }), spaeter), a).stand;
    expect(c.belege.find((x) => x.id === "b1")?.notiz).toBe("neu");
  });

  it("festgeschriebene Unterlagen werden nie ersetzt; Zahlung und Storno werden übernommen", () => {
    const basis = anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "r1")[0];
    const fest = ausgeben(basis, "r1", t("2026-10-02"));
    expect(fest.unterlagen[0]?.festgeschrieben).toBeTruthy();
    const entwurfSpaeter = felderSetzen(basis, "r1", { kunde_name: "Anders" }, t("2026-10-05"));
    const z = syncZusammenfuehren(entwurfSpaeter, fest).stand;
    expect(z.unterlagen[0]?.festgeschrieben).toBeTruthy();
    expect(z.unterlagen[0]?.daten.kunde_name).not.toBe("Anders");
    const bezahlt = bezahltSetzen(fest, "r1", "2026-10-06", t("2026-10-06"));
    expect(syncZusammenfuehren(fest, bezahlt).stand.unterlagen[0]?.bezahlt).toBe("2026-10-06");
    expect(syncZusammenfuehren(bezahlt, fest).stand.unterlagen[0]?.bezahlt).toBe("2026-10-06");
  });

  it("entfernte Zahlung und verworfener Storno-Entwurf kommen nicht zurück", () => {
    let s = ausgeben(anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "r1")[0], "r1", t("2026-10-02"));
    s = bezahltSetzen(s, "r1", "2026-10-03", t("2026-10-03"));
    s = stornieren(s, "r1", t("2026-10-04"), "st")[0];
    const server = s;
    // auf dem Gerät: Storno-Entwurf verwerfen, Zahlung entfernen
    let lokal = loeschen(s, "st");
    lokal = bezahltSetzen(lokal, "r1", null, new Date(Date.now() + 1000));
    for (const z of [syncZusammenfuehren(lokal, server).stand, syncZusammenfuehren(server, lokal).stand]) {
      const r = z.unterlagen.find((u) => u.id === "r1")!;
      expect(r.bezahlt).toBeUndefined();
      expect(r.storniertDurch).toBeUndefined();
      expect(z.unterlagen.some((u) => u.id === "st")).toBe(false);
    }
    // Wiederherstellen einer älteren Sicherung bringt sie ebenfalls nicht zurück
    const w = zusammenfuehren(lokal, server).stand.unterlagen.find((u) => u.id === "r1")!;
    expect(w.bezahlt).toBeUndefined();
  });

  it("Storno auf einem Gerät, Zahlung auf dem anderen: beides bleibt erhalten – in jeder Richtung", () => {
    const basis = ausgeben(anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "r1")[0], "r1", t("2026-10-02"));
    let a = stornieren(basis, "r1", t("2026-10-05"), "st")[0];
    a = ausgeben(a, "st", t("2026-10-05"));
    const b = bezahltSetzen(basis, "r1", "2026-10-06", t("2026-10-06"));
    for (const z of [syncZusammenfuehren(a, b).stand, syncZusammenfuehren(b, a).stand, zusammenfuehren(a, b).stand, zusammenfuehren(b, a).stand]) {
      const r = z.unterlagen.find((u) => u.id === "r1")!;
      expect(r.storniertDurch).toBe("st");
      expect(r.bezahlt).toBe("2026-10-06");
      expect(z.unterlagen.find((u) => u.id === "st")?.festgeschrieben).toBeTruthy();
    }
  });

  it("Zahlung aus einer älteren Sicherung ohne Zeitstempel geht nicht verloren", () => {
    const fest = ausgeben(anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "r1")[0], "r1", t("2026-10-02"));
    const alt = { ...fest, unterlagen: fest.unterlagen.map((u) => ({ ...u, bezahlt: "2026-10-04" })) };
    expect(zusammenfuehren(fest, alt).stand.unterlagen[0]?.bezahlt).toBe("2026-10-04");
    expect(syncZusammenfuehren(fest, alt).stand.unterlagen[0]?.bezahlt).toBe("2026-10-04");
  });

  it("Wiederherstellen: festgeschriebene Fassung aus der Sicherung schlägt den Entwurf auf dem Gerät", () => {
    const entwurf = anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "r1")[0];
    const fest = ausgeben(entwurf, "r1", t("2026-10-02"));
    expect(zusammenfuehren(entwurf, fest).stand.unterlagen[0]?.festgeschrieben).toBeTruthy();
    expect(zusammenfuehren(fest, entwurf).stand.unterlagen[0]?.festgeschrieben).toBeTruthy();
  });

  it("Betrieb geht nach der letzten Änderung; Gerätegebundenes bleibt lokal; doppelte Nummern werden gemeldet", () => {
    const a: Stand = { ...betriebSetzen(LEERER_STAND, { ...B, name: "Alt" }), appSperre: true };
    a.zeiten = { betrieb: "2026-10-01T00:00:00.000Z" };
    const b = { ...betriebSetzen(LEERER_STAND, { ...B, name: "Neu" }), zeiten: { betrieb: "2026-10-02T00:00:00.000Z" } };
    const z = syncZusammenfuehren(a, b).stand;
    expect(z.betrieb.name).toBe("Neu");
    expect(z.appSperre).toBe(true);
    // zwei Geräte vergeben offline dieselbe Rechnungsnummer
    const r1 = anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "x1")[0];
    const r2 = anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "x2")[0];
    const k = syncZusammenfuehren(r1, r2);
    expect(k.stand.unterlagen).toHaveLength(2);
    expect(k.nummernKonflikte).toHaveLength(1);
  });

  it("übersteht den Weg durch JSON (standAus behält Löschvermerke und Zeiten)", () => {
    const s: Stand = { ...betriebSetzen(LEERER_STAND, B), geloescht: { "b:weg": "2026-10-02T09:00:00.000Z" } };
    const r = standAus(JSON.stringify(s));
    expect(r.geloescht["b:weg"]).toBeTruthy();
    expect(r.zeiten.betrieb).toBeTruthy();
    expect(standAus(JSON.stringify({ version: 1, geloescht: { a: 1, b: "kein Datum" } })).geloescht).toEqual({});
  });
});

/** Server im Arbeitsspeicher – mit denselben Regeln wie die API (Version, 409, unveränderliche Dateien). */
function speicherServer() {
  const s: { version: number; schluessel: string; daten: string | null; dateien: Map<string, string>; schreibvorgaenge: number } = { version: 0, schluessel: "", daten: null, dateien: new Map(), schreibvorgaenge: 0 };
  const api = (vorher?: () => void): TresorApi => ({
    holen: async () => ({ version: s.version, schluessel: s.schluessel, daten: s.daten }),
    speichern: async (version, daten) => {
      vorher?.();
      if (version !== s.version) throw new SyncFehler("konflikt");
      s.version++;
      s.daten = daten;
      s.schreibvorgaenge++;
      return s.version;
    },
    dateien: async () => [...s.dateien.keys()],
    dateiSpeichern: async (name, daten) => {
      if (!s.dateien.has(name)) s.dateien.set(name, daten);
    },
    dateiHolen: async (name) => s.dateien.get(name) ?? null,
  });
  return { s, api };
}

function geraet(api: TresorApi, sync: Uint8Array, start: Stand) {
  const g = { stand: start, dateien: new Map<string, Uint8Array>() };
  const u: SyncUmgebung = {
    api,
    sync,
    zufall,
    lokal: () => g.stand,
    uebernehmen: (s) => {
      g.stand = syncZusammenfuehren(g.stand, s).stand;
    },
    dateiLokal: async (n) => g.dateien.get(n) ?? null,
    dateiAblegen: async (n, b) => {
      g.dateien.set(n, b);
    },
  };
  return { g, u };
}

describe("Synchronisieren gegen einen Server (E-134)", () => {
  it("überträgt Stand und Belegdateien verschlüsselt vom iPhone auf ein zweites Gerät", async () => {
    const { s, api } = speicherServer();
    const sync = zufallsSchluessel(zufall);
    s.schluessel = huelleErstellen(sync, "richtig-langes-passwort", zufall, IT);
    const a = geraet(api(), sync, belegSetzen(betriebSetzen(LEERER_STAND, B), beleg("b1", { datei: "b1abc.jpg" }), t("2026-10-02")));
    a.g.dateien.set("b1abc.jpg", new Uint8Array([1, 2, 3, 4]));
    const r1 = await synchronisieren(a.u);
    expect(r1).toMatchObject({ version: 1, hochgeladen: 1, heruntergeladen: 0 });
    expect(s.daten).not.toContain("Salon Sonne");
    expect(s.dateien.get("b1abc.jpg")).toMatch(/^\{"format":"amtlos-tresor"/);

    // zweites Gerät: Passwort öffnet die Hülle
    const b = geraet(api(), huelleOeffnen(s.schluessel, "richtig-langes-passwort"), LEERER_STAND);
    const r2 = await synchronisieren(b.u);
    expect(r2).toMatchObject({ version: 2, hochgeladen: 0, heruntergeladen: 1 });
    expect(b.g.stand.betrieb.name).toBe("Salon Sonne");
    expect(b.g.stand.belege.map((x) => x.id)).toEqual(["b1"]);
    expect([...b.g.dateien.get("b1abc.jpg")!]).toEqual([1, 2, 3, 4]);

    // Löschen auf B kommt auf A an
    b.g.stand = belegLoeschen(b.g.stand, "b1", t("2026-10-02"));
    await synchronisieren(b.u);
    await synchronisieren(a.u);
    expect(a.g.stand.belege).toEqual([]);
  });

  it("beginnt bei 409 von vorn und verliert dabei nichts", async () => {
    const { s, api } = speicherServer();
    const sync = zufallsSchluessel(zufall);
    const b = geraet(api(), sync, personSetzen(LEERER_STAND, "kunde", { id: "k2", name: "Von B" }, t("2026-10-02")));
    let einmal = true;
    // während A speichert, kommt B dazwischen
    const a = geraet(
      api(() => {
        if (!einmal) return;
        einmal = false;
        s.version++;
        s.daten = standVerschluesseln(b.g.stand, sync, zufall(12));
      }),
      sync,
      personSetzen(LEERER_STAND, "kunde", { id: "k1", name: "Von A" }, t("2026-10-02")),
    );
    const r = await synchronisieren(a.u);
    expect(r.version).toBe(2);
    expect(a.g.stand.kunden.map((k) => k.id).sort()).toEqual(["k1", "k2"]);
    expect(standEntschluesseln(s.daten!, sync).kunden.map((k) => k.id).sort()).toEqual(["k1", "k2"]);
  });

  it("gibt nach drei Konflikten auf, und ohne eingerichteten Tresor mit einem Fehler", async () => {
    const sync = zufallsSchluessel(zufall);
    const immer: TresorApi = { holen: async () => ({ version: 0, schluessel: "", daten: null }), speichern: async () => Promise.reject(new SyncFehler("konflikt")), dateien: async () => [], dateiSpeichern: async () => {}, dateiHolen: async () => null };
    expect(await fehlerArt(() => synchronisieren(geraet(immer, sync, LEERER_STAND).u))).toBe("konflikt");
    expect(await fehlerArt(() => synchronisieren(geraet({ ...immer, holen: async () => null }, sync, LEERER_STAND).u))).toBe("format");
  });
});

describe("Verbindung zum Server (E-134)", () => {
  it("schickt das Token mit und übersetzt HTTP-Status in Fehlerarten", async () => {
    const aufrufe: { url: string; init: RequestInit }[] = [];
    const antworten: Record<string, () => Response> = {
      "GET /v1/tresor": () => new Response(null, { status: 404 }),
      "POST /v1/tresor": () => Response.json({ version: 0, konto_id: "k-1" }, { status: 201 }),
      "PUT /v1/tresor": () => Response.json({ version: 3 }, { status: 409 }),
      "PUT /v1/tresor/dateien/a1b2.jpg": () => new Response(null, { status: 402 }),
      "GET /v1/tresor/dateien/a1b2.jpg": () => new Response(null, { status: 404 }),
      "GET /v1/tresor/dateien": () => new Response(null, { status: 401 }),
      "POST /v1/ich/loeschen": () => new Response(null, { status: 409 }),
      "DELETE /v1/tresor": () => new Response(null, { status: 204 }),
    };
    const abruf = (async (url: string, init: RequestInit) => {
      aufrufe.push({ url, init });
      const pfad = new URL(url).pathname;
      return antworten[`${init.method} ${pfad}`]!();
    }) as unknown as typeof fetch;
    const s = tresorServer("https://api.example.org", async () => "TOKEN", abruf);
    expect(await s.holen()).toBeNull();
    expect(await s.einrichten('{"format":"amtlos-schluessel"}')).toEqual({ version: 0, konto_id: "k-1" });
    expect(await fehlerArt(() => s.speichern(1, "x"))).toBe("konflikt");
    expect(await fehlerArt(() => s.dateiSpeichern("a1b2.jpg", "x"))).toBe("pro");
    expect(await s.dateiHolen("a1b2.jpg")).toBeNull();
    expect(await fehlerArt(() => s.dateien())).toBe("anmeldung");
    expect(await fehlerArt(() => s.kontoLoeschen())).toBe("konto");
    await s.loeschen();
    expect(aufrufe.every((a) => (a.init.headers as Record<string, string>).Authorization === "Bearer TOKEN")).toBe(true);
    expect(fehlerAusStatus(500).art).toBe("netz");
    const offline = tresorServer("https://api.example.org", async () => "T", (async () => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch);
    expect(await fehlerArt(() => offline.holen())).toBe("netz");
  });

  it("ergänzt den Datenschutzhinweis nur in Builds mit Synchronisation", () => {
    expect(datenschutzAbschnitte(false)).toBe(DATENSCHUTZ.abschnitte);
    const mit = datenschutzAbschnitte(true).map((a) => a.titel);
    expect(mit).toContain("Konto und Synchronisation");
    expect(mit.indexOf("Konto und Synchronisation")).toBe(mit.indexOf("Sicherungen") + 1);
    expect(datenschutzAbschnitte(true)[0]!.text).toContain("Ende-zu-Ende");
  });
});
