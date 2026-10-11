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
    expect(ProfilSchema.safeParse({ gemeinde_ags: "11000000", bundesland: "BY" }).success).toBe(false);
  });
  it("entfernt null-Werte (Angabe gelöscht → unbekannt)", () => {
    expect(ProfilSchema.parse({ rechtsform: null, erwerb: "haupt" })).toEqual({ erwerb: "haupt" });
  });
});

describe("Heute", () => {
  const a = (x: Partial<Aufgabe>): Aufgabe => ({ pflicht_id: "p", periode: "einmalig", kategorie: "steuern", anzeige_status: "offen", faellig_am: null, schwere: "mittel", ...x });
  it("priorisiert Überfälliges, dann fehlende Angaben und nahe Fristen nach Schwere", () => {
    const heute = "2026-10-11";
    const liste = [
      a({ pflicht_id: "fern", faellig_am: "2026-12-01", anzeige_status: "offen" }),
      a({ pflicht_id: "ueber", faellig_am: "2026-10-01", anzeige_status: "ueberfaellig" }),
      a({ pflicht_id: "angabe", anzeige_status: "angabe_fehlt", schwere: "hoch" }),
      a({ pflicht_id: "bald-niedrig", faellig_am: "2026-10-14", anzeige_status: "faellig_bald", schwere: "niedrig" }),
      a({ pflicht_id: "erledigt", anzeige_status: "erledigt" }),
    ];
    const u = heuteUebersicht(liste, heute);
    expect(u.als_naechstes.map((x) => x.pflicht_id)).toEqual(["ueber", "bald-niedrig", "angabe"]);
    expect(u.ampel.steuern).toBe("rot");
    expect(u.ampel.personal).toBe("gruen");
    expect(heuteUebersicht([a({ kategorie: "arbeitsschutz", anzeige_status: "offen", faellig_am: null })], heute).ampel.arbeitsschutz).toBe("gelb");
    expect(heuteUebersicht([a({ kategorie: "arbeitsschutz", anzeige_status: "offen", faellig_am: "2027-06-01" })], heute).ampel.arbeitsschutz).toBe("gruen");
    expect(u.zaehler).toEqual({ offen: 4, ueberfaellig: 1, angabe_fehlt: 1, erledigt: 1 });
    expect(dringlichkeit(a({ faellig_am: "2026-10-21", schwere: "hoch" }), heute)).toBeLessThan(dringlichkeit(a({ faellig_am: "2026-10-21", schwere: "niedrig" }), heute));
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
  it("lässt bis zur Grenze durch, dann 429 mit Retry-After, neues Fenster gibt frei", async () => {
    const { Ratenbegrenzer, erzeugeMetriken } = await import("../src/betrieb.js");
    let t = 0;
    const r = new Ratenbegrenzer({ angemeldet: 3, anonym: 1, fensterMs: 60_000 }, () => t);
    const mw = r.middleware(erzeugeMetriken());
    const aufruf = (pfad: string, auth?: string) => {
      const kopf: Record<string, string> = {};
      const res = { setHeader: (k: string, v: string) => { kopf[k] = v; }, status: () => res, json: () => res };
      let durch = false;
      mw({ path: pfad, headers: auth ? { authorization: `Bearer ${auth}` } : {}, ip: "10.0.0.1" } as never, res as never, () => { durch = true; });
      return { durch, kopf };
    };
    expect([1, 2, 3].map(() => aufruf("/v1/heute", "tok").durch)).toEqual([true, true, true]);
    const viert = aufruf("/v1/heute", "tok");
    expect(viert.durch).toBe(false);
    expect(viert.kopf["Retry-After"]).toBe("60");
    expect(aufruf("/v1/heute", "anderes").durch).toBe(true); // je Token getrennt
    expect(aufruf("/v1/einladungen/annehmen", "tok2").durch).toBe(true);
    expect(aufruf("/v1/einladungen/annehmen", "tok2").durch).toBe(false); // streng: 1
    expect(aufruf("/v1/gesundheit").durch).toBe(true);
    expect(aufruf("/v1/gesundheit").durch).toBe(true); // nie begrenzt
    t = 60_000;
    expect(aufruf("/v1/heute", "tok").durch).toBe(true);
  });
});

describe("Gründungsassistent: Reihenfolge", () => {
  it("ordnet nach Voraussetzungen, dann Frist, dann Katalognummer; sperrt bis zur Erledigung", async () => {
    const { ordne, offeneVoraussetzungen, fortschritt } = await import("../src/gruendung.js");
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
