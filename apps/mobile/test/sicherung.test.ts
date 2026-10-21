import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PASSWORT_MINDESTLAENGE, SicherungsFehler, ausBase64, base64, schluesselAusPasswort, sicherungErstellen, sicherungLesen, sicherungMitSchluessel, sicherungsName } from "../src/unterlagen/sicherung";
import { LEERER_STAND, allesLoeschenErlaubt, anlegen, aufbewahrungspflichtig, ausgeben, betriebSetzen, felderSetzen, personSetzen, sicherungFaellig, standAus, zusammenfuehren } from "../src/unterlagen/speicher";
import { istTresor, tresorOeffnen, tresorSchliessen } from "../src/unterlagen/tresor";
import { MARKE } from "@amtlos/marke";

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne", iban: "DE12 3456 7890 1234 5678 90", steuernummer: "143/123/45678" };
// wenige Iterationen, damit der Test schnell bleibt – das Verfahren ist dasselbe
const IT = 1000;

function beispiel() {
  let s = betriebSetzen(LEERER_STAND, B);
  s = personSetzen(s, "mitarbeiter", { id: "m", name: "Sam Müller", sv_nummer: "12 150380 M 123", steuer_id: "12345678901", iban: "DE89 3704 0044 0532 0130 00" });
  s = anlegen(s, "unterweisung", new Date("2026-10-12T08:00:00Z"), "u")[0];
  return s;
}

describe("Verschlüsselte Datensicherung", () => {
  it("stellt alles wieder her – mit Umlauten, Mitarbeitern und Unterlagen", () => {
    const s = beispiel();
    const datei = sicherungErstellen(s, "richtig-langes-passwort", zufall, new Date(), IT);
    expect(sicherungLesen(datei, "richtig-langes-passwort")).toEqual(s);
  });

  it("enthält keine Daten im Klartext", () => {
    const datei = sicherungErstellen(beispiel(), "richtig-langes-passwort", zufall, new Date(), IT);
    for (const geheim of ["Salon Sonne", "Sam M", "12 150380", "12345678901", "DE89", "DE12", "143/123", "unterweisung"]) expect(datei).not.toContain(geheim);
    expect(JSON.parse(datei)).toMatchObject({ format: "amtlos-sicherung", version: 1, kdf: { name: "PBKDF2-SHA256", iterationen: IT }, chiffre: { name: "AES-256-GCM" } });
  });

  it("lehnt Dateien mit überhöhter Iterationszahl ab, statt die App zu blockieren (E-143)", () => {
    const d = JSON.parse(sicherungErstellen(beispiel(), "richtig-langes-passwort", zufall, new Date(), IT)) as { kdf: { iterationen: number } };
    d.kdf.iterationen = 50_000_000;
    expect(() => sicherungLesen(JSON.stringify(d), "richtig-langes-passwort")).toThrow(SicherungsFehler);
  });

  it("lehnt falsche Passwörter, veränderte Dateien und fremde Dateien ab", () => {
    const datei = sicherungErstellen(beispiel(), "richtig-langes-passwort", zufall, new Date(), IT);
    const fehlerArt = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return e instanceof SicherungsFehler ? e.art : "anderer Fehler";
      }
      return "kein Fehler";
    };
    expect(fehlerArt(() => sicherungLesen(datei, "falsches-passwort!"))).toBe("passwort");
    const d = JSON.parse(datei) as { daten: string; kdf: { iterationen: number } };
    const bytes = ausBase64(d.daten);
    bytes[5] = bytes[5]! ^ 1;
    expect(fehlerArt(() => sicherungLesen(JSON.stringify({ ...d, daten: base64(bytes) }), "richtig-langes-passwort"))).toBe("passwort");
    expect(fehlerArt(() => sicherungLesen(JSON.stringify({ ...d, kdf: { ...d.kdf, iterationen: IT + 1 } }), "richtig-langes-passwort"))).toBe("passwort");
    expect(fehlerArt(() => sicherungLesen("kein json", "x"))).toBe("format");
    expect(fehlerArt(() => sicherungLesen(JSON.stringify(LEERER_STAND), "x"))).toBe("format");
  });

  it("verlangt ein Passwort mit Mindestlänge und nimmt jedes Mal neues Salz", () => {
    expect(() => sicherungErstellen(beispiel(), "kurz", zufall, new Date(), IT)).toThrow();
    expect(PASSWORT_MINDESTLAENGE).toBeGreaterThanOrEqual(10);
    const a = JSON.parse(sicherungErstellen(LEERER_STAND, "richtig-langes-passwort", zufall, new Date(), IT));
    const b = JSON.parse(sicherungErstellen(LEERER_STAND, "richtig-langes-passwort", zufall, new Date(), IT));
    expect(a.kdf.salz).not.toBe(b.kdf.salz);
    expect(a.daten).not.toBe(b.daten);
    expect(sicherungsName("2026-10-12")).toBe(`${MARKE.name}-Sicherung-2026-10-12.amtlos`);
  });

  it("kodiert Base64 verlustfrei in allen Längen", () => {
    for (let n = 0; n < 20; n++) {
      const b = zufall(n);
      expect(Array.from(ausBase64(base64(b)))).toEqual(Array.from(b));
      expect(base64(b)).toBe(Buffer.from(b).toString("base64"));
    }
  });
});

describe("Verschlüsselte Ablage und sicheres Zurückspielen (E-129)", () => {
  it("speichert den Stand nur verschlüsselt und erkennt Manipulation oder falschen Schlüssel", () => {
    const s = beispiel();
    const k = zufall(32);
    const t = tresorSchliessen(JSON.stringify(s), k, zufall(12));
    expect(istTresor(t)).toBe(true);
    expect(istTresor(JSON.stringify(s))).toBe(false);
    for (const geheim of ["Salon Sonne", "12 150380", "12345678901", "DE89", "143/123"]) expect(t).not.toContain(geheim);
    expect(JSON.parse(tresorOeffnen(t, k))).toEqual(s);
    expect(() => tresorOeffnen(t, zufall(32))).toThrow();
    const roh = JSON.parse(t) as { daten: string };
    const kaputt = JSON.stringify({ ...JSON.parse(t), daten: roh.daten.slice(0, -4) + (roh.daten.endsWith("AAAA") ? "BBBB" : "AAAA") });
    expect(() => tresorOeffnen(kaputt, k)).toThrow();
  });

  it("führt eine alte Sicherung zusammen, ohne Neueres oder Festgeschriebenes zu überschreiben", () => {
    const t0 = new Date("2026-10-01T08:00:00Z");
    let alt = betriebSetzen(LEERER_STAND, B);
    alt = anlegen(alt, "rechnung", t0, "r1")[0];
    alt = anlegen(alt, "unterweisung", t0, "u1")[0];
    // auf dem Gerät: r1 inzwischen festgeschrieben, u1 neuer bearbeitet, r2 neu
    let jetzt = ausgeben(alt, "r1", new Date("2026-10-05T08:00:00Z"));
    jetzt = felderSetzen(jetzt, "u1", { thema: "Neu" }, new Date("2026-10-06T08:00:00Z"));
    jetzt = anlegen(jetzt, "rechnung", new Date("2026-10-07T08:00:00Z"), "r2")[0];
    // in der alten Sicherung: r1 noch als Entwurf geändert, eine Rechnung r0, die auf dem Gerät fehlt
    const gesichert = { ...felderSetzen(alt, "r1", { kunde_name: "Alt" }, new Date("2026-10-09T08:00:00Z")), unterlagen: [...felderSetzen(alt, "r1", { kunde_name: "Alt" }, new Date("2026-10-09T08:00:00Z")).unterlagen, { ...alt.unterlagen[0]!, id: "r0", daten: { ...alt.unterlagen[0]!.daten, nummer: "2025-007" } }] };
    const z = zusammenfuehren(jetzt, gesichert);
    const nach = (id: string) => z.stand.unterlagen.find((u) => u.id === id)!;
    expect(nach("r1").festgeschrieben).toBeTruthy();
    expect(nach("r1").daten.kunde_name).not.toBe("Alt");
    expect(nach("u1").daten.thema).toBe("Neu");
    expect(nach("r2")).toBeTruthy();
    expect(nach("r0").daten.nummer).toBe("2025-007");
    expect(z.neu).toBe(1);
    expect(z.stand.betrieb.name).toBe("Salon Sonne");
    // gleiche Nummer in zwei verschiedenen Rechnungen wird gemeldet
    const doppelt = { ...gesichert, unterlagen: [{ ...nach("r2"), id: "r9" }] };
    expect(zusammenfuehren(jetzt, doppelt).nummernKonflikte).toEqual([String(nach("r2").daten.nummer)]);
  });

  it("verweigert „Alle Daten löschen“ bei ungesicherten Rechnungen und erinnert an die Sicherung", () => {
    let s = betriebSetzen(LEERER_STAND, B);
    expect(allesLoeschenErlaubt(s)).toBe(true);
    s = anlegen(s, "rechnung", new Date("2026-10-01T08:00:00Z"), "r1")[0];
    s = { ...ausgeben(s, "r1", new Date("2026-10-01T09:00:00Z")), geaendert: "2026-10-01T09:00:00.000Z" };
    expect(aufbewahrungspflichtig(s)).toHaveLength(1);
    expect(allesLoeschenErlaubt(s)).toBe(false);
    expect(sicherungFaellig(s, new Date("2026-10-02T08:00:00Z"))).toEqual({ tage: null });
    s = { ...s, letzteSicherung: "2026-10-01T10:00:00.000Z" };
    expect(allesLoeschenErlaubt(s)).toBe(true);
    expect(sicherungFaellig(s, new Date("2026-10-20T08:00:00Z"))).toBeNull();
    s = { ...s, geaendert: "2026-10-02T08:00:00.000Z" };
    expect(allesLoeschenErlaubt(s)).toBe(false);
    expect(sicherungFaellig(s, new Date("2026-10-05T08:00:00Z"))).toBeNull();
    expect(sicherungFaellig(s, new Date("2026-10-10T08:00:00Z"))).toEqual({ tage: 8 });
    // die Felder überstehen Speichern und Laden
    expect(standAus(JSON.stringify({ ...s, appSperre: true }))).toMatchObject({ letzteSicherung: s.letzteSicherung, geaendert: s.geaendert, appSperre: true });
  });
});

describe("Automatische Sicherung mit abgeleitetem Schlüssel (iCloud, E-129)", () => {
  it("erzeugt dasselbe Format – mit dem Passwort wiederherstellbar, ohne Klartext", () => {
    const s = beispiel();
    const k = schluesselAusPasswort("richtig-langes-passwort", zufall, IT);
    const a = sicherungMitSchluessel(s, k, zufall);
    const b = sicherungMitSchluessel(s, k, zufall);
    expect(a).not.toBe(b); // neue Nonce je Sicherung
    expect(sicherungLesen(a, "richtig-langes-passwort")).toEqual(s);
    expect(() => sicherungLesen(a, "falsches-passwort-123")).toThrow(SicherungsFehler);
    for (const geheim of ["Salon Sonne", "12345678901", "DE89"]) expect(a).not.toContain(geheim);
    expect(() => schluesselAusPasswort("kurz", zufall, IT)).toThrow();
  });
});
