import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PASSWORT_MINDESTLAENGE, SicherungsFehler, ausBase64, base64, sicherungErstellen, sicherungLesen, sicherungsName } from "../src/unterlagen/sicherung";
import { LEERER_STAND, anlegen, betriebSetzen, personSetzen } from "../src/unterlagen/speicher";

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
    expect(sicherungsName("2026-10-12")).toBe("Amtlos-Sicherung-2026-10-12.amtlos");
  });

  it("kodiert Base64 verlustfrei in allen Längen", () => {
    for (let n = 0; n < 20; n++) {
      const b = zufall(n);
      expect(Array.from(ausBase64(base64(b)))).toEqual(Array.from(b));
      expect(base64(b)).toBe(Buffer.from(b).toString("base64"));
    }
  });
});
