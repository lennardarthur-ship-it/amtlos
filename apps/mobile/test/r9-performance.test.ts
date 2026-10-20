/**
 * R9 Performance: native Kodierung byte-gleich zur JavaScript-Fassung, Binärformat der Belegdateien, O(1)-Prüfung
 * doppelter Nummern, Vergleich ohne JSON.stringify, Sync ohne unnötiges Lesen, ZIP mit Level 0 für Fotos.
 */
import { createCipheriv, randomBytes } from "node:crypto";
import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { synchronisieren, syncZusammenfuehren, zufallsSchluessel, type SyncUmgebung, type TresorApi } from "../src/konto/sync";
import { fehltFuer } from "../src/unterlagen/pruefung";
import { fehltAnzahl, fehltJeBerechnen } from "../src/unterlagen/ablage";
import { ausBase64, ausBase64Js, ausUtf8, ausUtf8Js, base64, base64Js, kodierungNativ, utf8, utf8Js } from "../src/unterlagen/sicherung";
import { LEERER_STAND, anlegen, belegSetzen, felderSetzen, gleicherInhalt, heute, nummerDoppelt, sortiert, standGleich, type Stand } from "../src/unterlagen/speicher";
import { paketZippen, steuerpaket, zeitraeume } from "../src/unterlagen/steuerpaket";
import { BINAER_KENNUNG, istBinaerTresor, tresorBytesOeffnen, tresorBytesSchliessen, tresorOeffnen, tresorSchliessen } from "../src/unterlagen/tresor";

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const t = (d: string) => new Date(`${d}T09:00:00Z`);

describe("Kodierung: nativ, wo vorhanden – byte-gleich zur JavaScript-Fassung", () => {
  it("nutzt in Node die nativen Funktionen", () => {
    expect(kodierungNativ.utf8).toBe(true);
    expect(kodierungNativ.ausUtf8).toBe(true);
    expect(kodierungNativ.base64).toBe(true);
    expect(kodierungNativ.ausBase64).not.toBeNull();
  });

  it("ohne native Funktionen (oder mit abweichenden) gilt die JavaScript-Fassung", async () => {
    const g = globalThis as Record<string, unknown>;
    const vorher = { TextEncoder: g.TextEncoder, TextDecoder: g.TextDecoder, atob: g.atob, btoa: g.btoa };
    // TextDecoder ohne „fatal“ und mit verschlucktem BOM – wie ein nicht spezifikationsgetreuer Ersatz
    class Lax {
      decode(b: Uint8Array) {
        return new (vorher.TextDecoder as typeof TextDecoder)().decode(b);
      }
    }
    Object.assign(g, { TextEncoder: undefined, TextDecoder: Lax, atob: undefined, btoa: undefined });
    try {
      vi.resetModules();
      const m = await import("../src/unterlagen/sicherung");
      expect(m.kodierungNativ).toEqual({ utf8: false, ausUtf8: false, base64: false, ausBase64: null });
      const b = zufall(1000);
      expect(m.base64(b)).toBe(base64Js(b));
      expect(m.ausUtf8(utf8Js("\u{feff}ä"))).toBe("\u{feff}ä");
      expect(() => m.ausUtf8(new Uint8Array([0xc3]))).toThrow();
    } finally {
      Object.assign(g, vorher);
      vi.resetModules();
    }
  });

  it("utf8 und ausUtf8 gleich – auch mit BOM, Emoji, Umlauten und langen Texten", () => {
    for (const s of ["", "a", "Grüße – 1 € 😀", "\u{feff}mit BOM", "x".repeat(70_000) + "ä".repeat(40_000), JSON.stringify({ a: "ß\n\t\"" })]) {
      expect(utf8(s)).toEqual(utf8Js(s));
      expect(ausUtf8(utf8Js(s))).toBe(ausUtf8Js(utf8Js(s)));
      expect(ausUtf8(utf8(s))).toBe(s);
    }
  });

  it("ungültiges UTF-8 wirft wie bisher", () => {
    const kaputt = new Uint8Array([0x41, 0xc3]);
    expect(() => ausUtf8Js(kaputt)).toThrow();
    expect(() => ausUtf8(kaputt)).toThrow();
  });

  it("base64 gleich für alle Restlängen und Zufallsdaten", () => {
    for (let n = 0; n < 70; n++) {
      const b = zufall(n);
      expect(base64(b)).toBe(base64Js(b));
      expect(ausBase64(base64Js(b))).toEqual(ausBase64Js(base64Js(b)));
    }
    const gross = zufall(300_001);
    expect(base64(gross)).toBe(base64Js(gross));
    expect(ausBase64(base64(gross))).toEqual(gross);
  });

  it("ausBase64 bleibt großzügig wie bisher: ohne Polsterung, mit Zeilenumbrüchen, fremden Zeichen, Rest 1", () => {
    const b64 = base64Js(zufall(100));
    for (const s of [b64.replace(/=+$/, ""), b64.replace(/(.{20})/g, "$1\n"), `  ${b64}  `, b64.replace(/\+/g, "-"), "QUJD=RA==", "QUJDR", "A", "", "====", "QU JD"]) {
      expect(ausBase64(s)).toEqual(ausBase64Js(s));
    }
  });

  it("Tresor Format 1 und 2 bleiben byte-gleich (fester Schlüssel und Nonce)", () => {
    const k = new Uint8Array(32).fill(7);
    const n = new Uint8Array(12).fill(3);
    const text = JSON.stringify({ name: "Salon Sonne", iban: "DE89 3704 0044 0532 0130 00", ä: "ö" });
    const t1 = tresorSchliessen(text, k, n);
    const t2 = tresorSchliessen(text, k, n, "datei:abcd.jpg");
    expect(JSON.parse(t1).nonce).toBe(base64Js(n));
    expect(tresorOeffnen(t1, k)).toBe(text);
    expect(tresorOeffnen(t2, k, "datei:abcd.jpg")).toBe(text);
    // unabhängig mit Node-Krypto gebaut: genau derselbe Text wie vor der Umstellung
    const erwartet = (zusatz: string, version: number) => {
      const c = createCipheriv("aes-256-gcm", k, n);
      c.setAAD(Buffer.from(zusatz));
      const daten = Buffer.concat([c.update(Buffer.from(text, "utf8")), c.final(), c.getAuthTag()]).toString("base64");
      return JSON.stringify({ format: "amtlos-tresor", version, nonce: Buffer.from(n).toString("base64"), daten });
    };
    expect(t1).toBe(erwartet("amtlos-tresor:1", 1));
    expect(t2).toBe(erwartet("amtlos-tresor:2:datei:abcd.jpg", 2));
  });
});

describe("Belegdateien im Binärformat (Format 3)", () => {
  it("verschlüsselt ohne Base64, gebunden an den Dateinamen; ältere Textdateien erkennt es nicht als binär", () => {
    const k = zufallsSchluessel(zufall);
    const foto = zufall(200_000);
    const b = tresorBytesSchliessen(foto, k, zufall(12), "datei:abcd1234.jpg");
    expect(istBinaerTresor(b)).toBe(true);
    expect(b.length).toBe(foto.length + BINAER_KENNUNG.length + 12 + 16);
    expect(tresorBytesOeffnen(b, k, "datei:abcd1234.jpg")).toEqual(foto);
    expect(() => tresorBytesOeffnen(b, k, "datei:anders12.jpg")).toThrow();
    expect(() => tresorBytesOeffnen(b, zufallsSchluessel(zufall), "datei:abcd1234.jpg")).toThrow();
    const kaputt = b.slice();
    kaputt[kaputt.length - 1]! ^= 1;
    expect(() => tresorBytesOeffnen(kaputt, k, "datei:abcd1234.jpg")).toThrow();
    // altes Format: Tresor-JSON als Text – beginnt mit „{“
    const alt = utf8(tresorSchliessen(base64(foto), k, zufall(12), "datei:abcd1234.jpg"));
    expect(istBinaerTresor(alt)).toBe(false);
  });
});

describe("Listen und Vergleiche ohne quadratischen Aufwand", () => {
  const mitRechnungen = () => {
    let s: Stand = LEERER_STAND;
    for (let i = 0; i < 4; i++) s = anlegen(s, "rechnung", t("2026-10-01"), `r${i}`)[0];
    // r3 bekommt die Nummer von r0
    return felderSetzen(s, "r3", { nummer: String(s.unterlagen.find((u) => u.id === "r0")!.daten.nummer) }, t("2026-10-02"));
  };

  it("nummerDoppelt: dieselben Ergebnisse wie vorher (sich selbst nicht mitgezählt)", () => {
    const s = mitRechnungen();
    const doppelt = s.unterlagen.filter((u) => nummerDoppelt(s, u)).map((u) => u.id).sort();
    expect(doppelt).toEqual(["r0", "r3"]);
    // eine Unterlage, die (noch) nicht in der Liste steht, aber dieselbe Nummer trägt
    const fremd = { ...s.unterlagen.find((u) => u.id === "r1")!, id: "neu" };
    expect(nummerDoppelt(s, fremd)).toBe(true);
  });

  it("fehlende Angaben pro Unterlage wie fehltFuer", () => {
    const s = mitRechnungen();
    const je = fehltJeBerechnen(s);
    for (const u of s.unterlagen) expect(je.get(u.id)).toBe(fehltFuer(s, u).length);
    // gleiche Liste, gleicher Betrieb: aus dem Zwischenspeicher; nach einer Eingabe neu, aber nur die Geänderte gerechnet
    expect(fehltJeBerechnen(s)).toBe(je);
    const s2 = felderSetzen(s, "r1", { kunde_name: "" }, t("2026-10-05"));
    for (const u of s2.unterlagen) expect(fehltAnzahl(s2, u)).toBe(fehltFuer(s2, u).length);
    expect(fehltJeBerechnen(s2)).not.toBe(je);
  });

  it("sortiert: je Liste einmal, gleiche Reihenfolge", () => {
    const s = mitRechnungen();
    expect(sortiert(s)).toBe(sortiert(s));
    expect(sortiert(s).map((u) => u.id)).toEqual([...s.unterlagen].sort((a, b) => b.geaendert.localeCompare(a.geaendert)).map((u) => u.id));
  });

  it("heute: ohne Argument zwischengespeichert, mit Datum wie bisher", () => {
    expect(heute(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(heute()).toBe(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()));
  });

  it("gleicherInhalt verhält sich wie der Vergleich zweier JSON-Texte", () => {
    const paare: [unknown, unknown, boolean][] = [
      [{ a: 1, b: undefined }, { a: 1 }, true],
      [{ a: 1, b: 2 }, { b: 2, a: 1 }, true],
      [[1, undefined], [1, null], true],
      [{ a: [1, 2] }, { a: [2, 1] }, false],
      [{ a: "1" }, { a: 1 }, false],
      [{ a: null }, { a: undefined }, false],
      [{ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }, false],
    ];
    for (const [a, b, gleich] of paare) expect(gleicherInhalt(a, b)).toBe(gleich);
    const s = mitRechnungen();
    expect(standGleich(syncZusammenfuehren(s, s).stand, s)).toBe(true);
    const anders = felderSetzen(s, "r1", { kunde_name: "Neu" }, t("2026-10-03"));
    expect(standGleich(anders, s)).toBe(false);
    expect(standGleich({ ...s, geaendert: "2026-10-09T00:00:00Z" }, { ...s, geaendert: "2026-10-01T00:00:00Z" })).toBe(true);
  });
});

describe("Sync: lokal vorhandene Dateien weder lesen noch entschlüsseln", () => {
  it("liest nur, was hochgeladen werden muss", async () => {
    const dateien = new Map<string, string>([["schonda1.jpg", "x"]]);
    const api: TresorApi = { holen: async () => ({ version: 0, schluessel: "", daten: null }), speichern: async () => 1, dateien: async () => [...dateien.keys()], dateiSpeichern: async (n, d) => void dateien.set(n, d), dateiHolen: async (n) => dateien.get(n) ?? null };
    let s: Stand = LEERER_STAND;
    for (const [id, datei] of [["b1", "schonda1.jpg"], ["b2", "neuhoch1.jpg"]] as const) s = belegSetzen(s, { id, datum: "2026-10-02", lieferant: "X", nummer: null, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei, quelle: "foto", erstellt: "2026-10-02T08:00:00Z", geaendert: "2026-10-02T08:00:00Z" }, t("2026-10-02"));
    const gelesen: string[] = [];
    const u: SyncUmgebung = {
      api,
      sync: zufallsSchluessel(zufall),
      zufall,
      lokal: () => s,
      uebernehmen: () => undefined,
      dateiVorhanden: () => true,
      dateiLokal: async (n) => {
        gelesen.push(n);
        return new Uint8Array([1, 2, 3]);
      },
      dateiAblegen: async () => undefined,
    };
    const r = await synchronisieren(u);
    expect(r.hochgeladen).toBe(1);
    expect(gelesen).toEqual(["neuhoch1.jpg"]);
  });
});

describe("Steuerberater-Paket: Fotos und PDFs ohne Komprimierung", () => {
  it("legt jpg/png/pdf mit Level 0 ab, Texte komprimiert – Inhalt unverändert", () => {
    const foto = zufall(100_000);
    const csv = new TextEncoder().encode("a;b;c\r\n".repeat(5000));
    const zip = paketZippen({ "Belege/B1.jpg": foto, "Rechnungen/R1.pdf": foto, "Belege.csv": csv });
    const aus = unzipSync(zip);
    expect(aus["Belege/B1.jpg"]).toEqual(foto);
    expect(aus["Belege.csv"]).toEqual(csv);
    // zwei unkomprimierte Fotos + stark komprimierte CSV
    expect(zip.length).toBeGreaterThan(2 * foto.length);
    expect(zip.length).toBeLessThan(2 * foto.length + 5000);
  });
});

describe("Steuerberater-Paket: LIESMICH ohne Kassenzeile, wenn der Betrieb keine Kasse hat", () => {
  const liesmich = (profil: Stand["profil"]) => {
    const z = zeitraeume("2026-10-20").find((x) => x.name === "2026")!;
    const p = steuerpaket({ ...LEERER_STAND, profil }, z, LEERER_STAND.steuerberatung, {}, "2026-10-20T10:00:00Z");
    return new TextDecoder().decode(unzipSync(p.zip)["LIESMICH.txt"]);
  };
  it("Zeile „Kassenumsätze“ nur mit Kasse oder ohne Antwort", () => {
    // R10: einmal unter „Wichtig“
    expect(liesmich({ "kasse.elektronisch": false })).not.toContain("Kassenumsätze");
    expect(liesmich({ "kasse.elektronisch": true })).toContain("- Betrieb mit Kasse: Kassenumsätze fehlen");
    expect(liesmich({})).toContain("- Falls der Betrieb eine Kasse nutzt: Kassenumsätze fehlen");
  });
});
