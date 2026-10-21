import { describe, expect, it } from "vitest";
import { dringlichkeit, heuteUebersicht, type Aufgabe } from "../src/heute.js";
import { erzeugeIcs, falten } from "../src/ics.js";
import { ladeKonfiguration } from "../src/konfiguration.js";
import { ProfilSchema } from "../src/profil-schema.js";

describe("Konfiguration", () => {
  const basis = { DATABASE_URL: "postgres://x" };
  it("verbietet Entwicklungs-Login in staging und prod", () => {
    expect(() => ladeKonfiguration({ ...basis, AUTH_MODUS: "dev", DEV_JWT_SECRET: "x".repeat(32), UMGEBUNG: "prod" })).toThrow(/verboten/);
    expect(() => ladeKonfiguration({ ...basis, AUTH_MODUS: "dev", DEV_JWT_SECRET: "x".repeat(32), UMGEBUNG: "staging" })).toThrow(/verboten/);
    expect(ladeKonfiguration({ ...basis, AUTH_MODUS: "dev", DEV_JWT_SECRET: "x".repeat(32), UMGEBUNG: "dev" }).AUTH_MODUS).toBe("dev");
  });
  it("verlangt OIDC-Angaben", () => {
    expect(() => ladeKonfiguration(basis)).toThrow(/OIDC_ISSUER/);
  });
});

describe("Profil-Validierung", () => {
  it("akzeptiert gültige Angaben und leitet das Land aus dem Gemeindeschlüssel ab", () => {
    const p = ProfilSchema.parse({ rechtsform: "gmbh", "ust.kleinunternehmer": false, "kunden.segmente": ["b2b"], gemeinde_ags: "11000000" });
    expect(p).toEqual({ rechtsform: "gmbh", "ust.kleinunternehmer": false, "kunden.segmente": ["b2b"], gemeinde_ags: "11000000", bundesland: "BE" });
  });
  it("lehnt unbekannte Felder, falsche Typen und Widersprüche ab", () => {
    expect(ProfilSchema.safeParse({ rechtsfrom: "gmbh" }).success).toBe(false);
    expect(ProfilSchema.safeParse({ rechtsform: "aktiengesellschaft" }).success).toBe(false);
    expect(ProfilSchema.safeParse({ "beschaeftigte.gesamt": -1 }).success).toBe(false);
    expect(ProfilSchema.safeParse({ "beschaeftigte.gesamt": 1.5 }).success).toBe(false);
    expect(ProfilSchema.safeParse({ gruendungsdatum: "1.10.2026" }).success).toBe(false);
    expect(ProfilSchema.safeParse({ "kunden.segmente": ["b2b", "b2b"] }).success).toBe(false);
    // Der Gemeindeschlüssel bestimmt das Bundesland (E-111): ein widersprüchliches Bundesland wird überschrieben
    expect(ProfilSchema.parse({ gemeinde_ags: "11000000", bundesland: "BY" })).toMatchObject({ bundesland: "BE" });
  });
  it("entfernt null-Werte (Angabe gelöscht → unbekannt)", () => {
    expect(ProfilSchema.parse({ rechtsform: null, erwerb: "haupt" })).toEqual({ erwerb: "haupt" });
  });
});

describe("Heute", () => {
  const a = (x: Partial<Aufgabe>): Aufgabe => ({ pflicht_id: "p", periode: "einmalig", kategorie: "steuern", anzeige_status: "offen", faellig_am: null, schwere: "mittel", ...x });
  it("priorisiert Überfälliges und nahe Fristen nach Schwere; fehlende Angaben danach", () => {
    const heute = "2026-10-11";
    const liste = [
      a({ pflicht_id: "fern", faellig_am: "2026-12-01", anzeige_status: "offen" }),
      a({ pflicht_id: "ueber", faellig_am: "2026-10-01", anzeige_status: "ueberfaellig" }),
      a({ pflicht_id: "angabe", anzeige_status: "angabe_fehlt", schwere: "hoch" }),
      a({ pflicht_id: "bald-niedrig", faellig_am: "2026-10-14", anzeige_status: "faellig_bald", schwere: "niedrig" }),
      a({ pflicht_id: "erledigt", anzeige_status: "erledigt" }),
    ];
    const u = heuteUebersicht(liste, heute);
    expect(u.als_naechstes.map((x) => x.pflicht_id)).toEqual(["ueber", "bald-niedrig", "fern"]); // Angaben werden gebündelt nachgefragt (E-111)
    expect(u.ampel.steuern).toBe("rot");
    expect(u.ampel.personal).toBe("gruen");
    expect(heuteUebersicht([a({ kategorie: "arbeitsschutz", anzeige_status: "offen", faellig_am: null })], heute).ampel.arbeitsschutz).toBe("gelb");
    expect(heuteUebersicht([a({ kategorie: "arbeitsschutz", anzeige_status: "offen", faellig_am: "2027-06-01" })], heute).ampel.arbeitsschutz).toBe("gruen");
    expect(u.zaehler).toEqual({ offen: 4, ueberfaellig: 1, angabe_fehlt: 1, erledigt: 1, klar: 3, naechste_90: 3 });
    expect(dringlichkeit(a({ faellig_am: "2026-10-21", schwere: "hoch" }), heute)).toBeLessThan(dringlichkeit(a({ faellig_am: "2026-10-21", schwere: "niedrig" }), heute));
    // Katalog dringend_ohne_termin: gewichtet wie „hoch“, auch wenn die angezeigte Schwere „mittel“ ist
    expect(dringlichkeit(a({ faellig_am: null, schwere: "mittel", dringend_ohne_termin: true }), heute)).toBe(dringlichkeit(a({ faellig_am: null, schwere: "hoch" }), heute));
    expect(dringlichkeit(a({ faellig_am: null, schwere: "mittel", dringend_ohne_termin: true }), heute)).toBeLessThan(dringlichkeit(a({ faellig_am: null, schwere: "mittel" }), heute));
  });
});

describe("ICS", () => {
  it("erzeugt ganztägige Termine mit maskiertem Text", () => {
    const ics = erzeugeIcs("Test", [{ uid: "1@amtlos", datum: "2026-12-31", titel: "Umsatzsteuer; Voranmeldung, Q4", url: "https://x" }], new Date("2026-10-11T10:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101\r\n");
    expect(ics).toContain("SUMMARY:Umsatzsteuer\\; Voranmeldung\\, Q4\r\n");
    expect(ics).toContain("DTSTAMP:20261011T100000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("faltet lange Zeilen ohne Umlaute zu zerschneiden", () => {
    const zeile = "SUMMARY:" + "ä".repeat(60);
    const gefaltet = falten(zeile);
    for (const teil of gefaltet.split("\r\n")) expect(Buffer.byteLength(teil)).toBeLessThanOrEqual(75);
    expect(gefaltet.split("\r\n").map((x, i) => (i ? x.slice(1) : x)).join("")).toBe(zeile);
  });
});

describe("Ratenbegrenzung", () => {
  const aufbau = async (angemeldet = 3, anonym = 1) => {
    const { Ratenbegrenzer, erzeugeMetriken } = await import("../src/betrieb.js");
    const uhr = { t: 0 };
    const r = new Ratenbegrenzer({ angemeldet, anonym, fensterMs: 60_000 }, () => uhr.t);
    const mw = r.middleware(erzeugeMetriken());
    /** gueltig: das Token hat der Vorfilter geprüft (req.amtlosClaims) */
    const aufruf = (pfad: string, auth?: string, gueltig = true, ip = "10.0.0.1") => {
      const kopf: Record<string, string> = {};
      const res = { setHeader: (k: string, v: string) => { kopf[k] = v; }, status: () => res, json: () => res };
      let durch = false;
      mw({ path: pfad, headers: auth ? { authorization: `Bearer ${auth}` } : {}, ip, amtlosClaims: auth && gueltig ? { sub: auth } : undefined } as never, res as never, () => { durch = true; });
      return { durch, kopf };
    };
    return { uhr, aufruf };
  };

  it("lässt bis zur Grenze durch, dann 429 mit Retry-After, neues Fenster gibt frei", async () => {
    const { uhr, aufruf } = await aufbau();
    expect([1, 2, 3].map(() => aufruf("/v1/heute", "tok").durch)).toEqual([true, true, true]);
    const viert = aufruf("/v1/heute", "tok");
    expect(viert.durch).toBe(false);
    expect(viert.kopf["Retry-After"]).toBe("60");
    expect(aufruf("/v1/heute", "anderes").durch).toBe(true); // je Token getrennt
    expect(aufruf("/v1/einladungen/annehmen", "tok2").durch).toBe(true);
    expect(aufruf("/v1/einladungen/annehmen", "tok2").durch).toBe(false); // streng: 1
    expect(aufruf("/v1/gesundheit").durch).toBe(true);
    expect(aufruf("/v1/gesundheit").durch).toBe(true); // nie begrenzt
    uhr.t = 60_000;
    expect(aufruf("/v1/heute", "tok").durch).toBe(true);
  });

  it("M7: wechselnde ungültige Tokens zählen wie anonyme Anfragen derselben IP", async () => {
    const { aufruf } = await aufbau(600, 2);
    const ergebnis = Array.from({ length: 5 }, (_, i) => aufruf("/v1/marke", `erfunden-${i}`, false).durch);
    expect(ergebnis).toEqual([true, true, false, false, false]);
    expect(aufruf("/v1/marke", "erfunden-x", false, "10.0.0.2").durch).toBe(true); // andere IP
  });

  it("M8: Kalender-Feeds werden je Token begrenzt, nicht je IP (Google ruft viele Feeds von einer IP ab)", async () => {
    const { aufruf } = await aufbau(600, 2);
    const feeds = Array.from({ length: 10 }, (_, i) => `/v1/kalender/${String(i).padStart(43, "a")}.ics`);
    expect(feeds.map((f) => aufruf(f).durch)).toEqual(feeds.map(() => true));
    expect([1, 2, 3].map(() => aufruf(feeds[0]!).durch)).toEqual([true, false, false]); // derselbe Feed: Grenze anonym (2)
  });
});

describe("Große Uploads (M-2)", () => {
  const aufruf = async (mw: ReturnType<Awaited<typeof import("../src/betrieb.js")>["grosserUpload"]>, req: Record<string, unknown>) => {
    let status = 0;
    let durch = false;
    const res = { setHeader: () => undefined, status: (s: number) => { status = s; return res; }, json: () => res, on: () => res };
    mw({ method: "PUT", headers: {}, ip: "10.0.0.1", ...req } as never, res as never, () => { durch = true; });
    return { status, durch };
  };
  it("ohne geprüftes Token 401, zu großer Content-Length sofort 413, sonst weiter; Lesen unberührt", async () => {
    const { grosserUpload } = await import("../src/betrieb.js");
    const mw = grosserUpload(1000, 2);
    expect(await aufruf(mw, { headers: { authorization: "Bearer erfunden-aber-lang-genug-12345" } })).toEqual({ status: 401, durch: false });
    expect(await aufruf(mw, { amtlosClaims: { sub: "a" }, headers: { "content-length": "1001" } })).toEqual({ status: 413, durch: false });
    expect(await aufruf(mw, { amtlosClaims: { sub: "a" }, headers: { "content-length": "1000" } })).toEqual({ status: 0, durch: true });
    expect(await aufruf(mw, { method: "GET" })).toEqual({ status: 0, durch: true });
    // gleichzeitige Uploads je IP (höchstens 2): einer läuft schon, der zweite darf, der dritte wartet
    expect((await aufruf(mw, { amtlosClaims: { sub: "a" } })).durch).toBe(true);
    expect((await aufruf(mw, { amtlosClaims: { sub: "a" } })).status).toBe(429);
    expect((await aufruf(mw, { amtlosClaims: { sub: "a" }, ip: "10.0.0.2" })).durch).toBe(true);
  });
});

describe("Datumsprüfung (H1)", () => {
  it("nimmt nur echte Kalendertage an", async () => {
    const { DATUM, istKalendertag } = await import("../src/hilfen.js");
    for (const gut of ["2026-02-28", "2028-02-29", "1900-01-01", "2026-12-31"]) expect(istKalendertag(gut)).toBe(true);
    for (const schlecht of ["2026-02-31", "2026-02-29", "2026-02-30", "0000-00-00", "2026-13-01", "2026-00-10", "1899-12-31", "2026-1-01"]) expect(istKalendertag(schlecht)).toBe(false);
    expect(DATUM.safeParse("2026-02-31").success).toBe(false);
    expect(ProfilSchema.safeParse({ gruendungsdatum: "0000-00-00" }).success).toBe(false);
    expect(ProfilSchema.safeParse({ gruendungsdatum: "2026-02-28" }).success).toBe(true);
  });
  it("Fehlertexte sind deutsch (G3)", async () => {
    const { pruefe } = await import("../src/hilfen.js");
    const { z } = await import("zod");
    try {
      pruefe(z.object({ a: z.number() }).strict(), { a: "x", b: 1 });
      expect.unreachable();
    } catch (e) {
      const fehler = (e as { getResponse(): { fehler: { meldung: string }[] } }).getResponse().fehler.map((f) => f.meldung);
      expect(fehler).toEqual(["Erwartet: Zahl, erhalten: Text", "Unbekanntes Feld: b"]);
    }
  });
});

describe("Sicherheit: Konfiguration und OIDC", () => {
  const basis = { DATABASE_URL: "postgres://x", OIDC_ISSUER: "https://login.example.org/realms/amtlos", OIDC_AUDIENCE: "amtlos", ABLAGE_VERZEICHNIS: "/daten", STRIPE_SECRET_KEY: "sk_" + "x".repeat(20), STRIPE_WEBHOOK_SECRET: "whsec_" + "x".repeat(20), STRIPE_PREIS_ID: "price_1" };
  it("M-4: REVENUECAT_SECRET_KEY ist in staging/prod Pflicht", () => {
    expect(() => ladeKonfiguration({ ...basis, UMGEBUNG: "prod" })).toThrow(/REVENUECAT_SECRET_KEY/);
    expect(ladeKonfiguration({ ...basis, UMGEBUNG: "prod", REVENUECAT_SECRET_KEY: "sk_rc_1234567890" }).UMGEBUNG).toBe("prod");
  });
  it("G-9: TRUST_PROXY als Hops, Schalter oder Netze", async () => {
    const { vertrauenswuerdigeProxys } = await import("../src/konfiguration.js");
    expect(vertrauenswuerdigeProxys("1")).toBe(1);
    expect(vertrauenswuerdigeProxys("false")).toBe(false);
    expect(vertrauenswuerdigeProxys("10.0.0.0/8")).toBe("10.0.0.0/8");
    expect(ladeKonfiguration({ ...basis, AUTH_MODUS: "oidc" }).TRUST_PROXY).toBe("loopback, linklocal, uniquelocal");
  });
  it("G-8: Discovery behält den Pfad des Issuers", async () => {
    const { discoveryUrl } = await import("../src/auth.js");
    expect(discoveryUrl("https://login.example.org/realms/amtlos").href).toBe("https://login.example.org/realms/amtlos/.well-known/openid-configuration");
    expect(discoveryUrl("https://login.example.org/").href).toBe("https://login.example.org/.well-known/openid-configuration");
  });
});

describe("Gründungsassistent: Reihenfolge", () => {
  it("ordnet nach Voraussetzungen, dann Frist, dann Katalognummer; sperrt bis zur Erledigung", async () => {
    const { ordne, offeneVoraussetzungen, fortschritt } = await import("@amtlos/fachlogik");
    const s = (pflicht_id: string, katalog_nr: string, voraussetzungen: string[] = [], faellig_am: string | null = null, status = "offen") =>
      ({ pflicht_id, periode: "einmalig", status, faellig_am, katalog_nr, voraussetzungen });
    const liste = [
      s("fragebogen", "A.5", ["elster"], "2026-11-01"),
      s("gewerbe", "A.2", [], "2026-10-01"),
      s("hr", "B.15", ["kapital"]),
      s("elster", "A.5"),
      s("kapital", "B.14", ["notar"]),
      s("notar", "B.14"),
      s("ihk", "A.7", ["fehlt_im_katalog"]),
      s("rundfunk", "A.10"),
      s("rv", "A.9"),
    ];
    expect(ordne(liste).map((x) => x.pflicht_id)).toEqual(["gewerbe", "elster", "fragebogen", "ihk", "rv", "rundfunk", "notar", "kapital", "hr"]);
    expect(offeneVoraussetzungen(liste[0]!, liste)).toEqual(["elster"]);
    const nachElster = liste.map((x) => (x.pflicht_id === "elster" ? { ...x, status: "erledigt" } : x));
    expect(offeneVoraussetzungen(nachElster[0]!, nachElster)).toEqual([]);
    expect(fortschritt([...nachElster, s("x", "A.1", [], null, "nicht_zutreffend")])).toEqual({ erledigt: 1, gesamt: 9, fertig: false });
  });
});

describe("Monate addieren (Prüftermine)", async () => {
  const { plusMonate } = await import("../src/arbeitsschutz.controller.js");
  it("beachtet Monatsende und Schaltjahr", () => {
    expect(plusMonate("2026-01-31", 1)).toBe("2026-02-28");
    expect(plusMonate("2028-01-31", 1)).toBe("2028-02-29");
    expect(plusMonate("2026-01-31", 12)).toBe("2027-01-31");
    expect(plusMonate("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("Eigenkontrollen: Grenzwerte", async () => {
  const { innerhalb } = await import("../src/branchen.controller.js");
  it("prüft offene und geschlossene Grenzen einschließlich der Grenzwerte selbst", () => {
    expect(innerhalb(7, null, 7)).toBe(true);
    expect(innerhalb(7.01, null, 7)).toBe(false);
    expect(innerhalb(-18, null, -18)).toBe(true);
    expect(innerhalb(-17.5, null, -18)).toBe(false);
    expect(innerhalb(65, 60, null)).toBe(true);
    expect(innerhalb(59.9, 60, null)).toBe(false);
    expect(innerhalb(3, null, null)).toBe(true);
  });
});
