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
