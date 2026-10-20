/**
 * Lektorat r9: Monatsende-Regel der Folgetermine, feste Leerzeichen bei Gesetzen und Einheiten, neu gefasste
 * Auswahltexte mit gleichbleibendem gespeicherten Wert (bestehende Auswahlen bleiben gültig).
 */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, dokumentHtml, leereDaten, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";
import { FRUEHERE_TEXTE, GOBD, IFSG, KASSEN_ARTEN } from "../src/dokumente/bausteine.js";
import { festeLeerzeichen, neufassung, plusMonate, stabileOption } from "../src/dokumente/html.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", verantwortlich: "Alex Sonnberg" };
const html = (id: string, d: Daten = {}) => {
  const v = vorlageFuer(id)!;
  return dokumentHtml(v, { ...leereDaten(v, B, "2026-10-13"), ...d }, B);
};

describe("plusMonate (Folgetermine in Dokumenten)", () => {
  it("nimmt den letzten Tag des Zielmonats, wenn es den Tag dort nicht gibt", () => {
    expect(plusMonate("2027-01-31", 1)).toBe("28.02.2027");
    expect(plusMonate("2028-01-31", 1)).toBe("29.02.2028");
    expect(plusMonate("2028-02-29", 12)).toBe("28.02.2029");
    expect(plusMonate("2028-02-29", 24)).toBe("28.02.2030");
    expect(plusMonate("2026-10-13", 24)).toBe("13.10.2028");
  });
  it("leer bei fehlendem oder ungültigem Datum", () => {
    expect(plusMonate("", 12)).toBe("");
    expect(plusMonate("2026-02-30", 12)).toBe("");
  });
});

describe("feste Leerzeichen bei weiteren Gesetzen und Maßeinheiten", () => {
  it("bindet Nummer und Gesetz bzw. Zahl und Einheit", () => {
    expect(festeLeerzeichen("§ 15 Abs. 4 AGG, § 4 KSchG, § 5 DDG, § 2a SchwarzArbG")).toBe("§&nbsp;15&nbsp;Abs.&nbsp;4&nbsp;AGG, §&nbsp;4&nbsp;KSchG, §&nbsp;5&nbsp;DDG, §&nbsp;2a&nbsp;SchwarzArbG");
    expect(festeLeerzeichen("100 m³, 750 Lux, 80 dB(A), 30 mA, 3–5 ml, 6 LE, 24 h, 2 m")).toBe("100&nbsp;m³, 750&nbsp;Lux, 80&nbsp;dB(A), 30&nbsp;mA, 3–5&nbsp;ml, 6&nbsp;LE, 24&nbsp;h, 2&nbsp;m");
  });
  it("nicht in Wörtern, Tags, Adressen oder Daten", () => {
    for (const t of ["3 mal täglich", "2 Minuten", "1 Liter", "5 hygienisch", "10 Arbeitstage", "am 13.10.2026 um 9 Uhr", "4 AGB", "3 Monate"]) expect(festeLeerzeichen(t)).toBe(t);
    expect(festeLeerzeichen('<a href="https://example.org/a 3 m">x</a>')).toBe('<a href="https://example.org/a 3 m">x</a>');
  });
});

describe("neu gefasste Auswahltexte (gespeicherter Wert bleibt)", () => {
  it("Optionen speichern den früheren Text, zeigen die Neufassung", () => {
    const o = stabileOption(GOBD.belegart[0]!);
    expect(o.text).toBe("Papierbeleg, wird in Papier abgelegt");
    expect(o.wert).toBe("originär Papier, Ablage in Papier (Muster 4.1)");
    expect(neufassung(o.wert)).toBe(o.text);
    expect(neufassung("eigene Angabe")).toBe("eigene Angabe");
    expect(stabileOption("Cloud-Backup")).toEqual({ wert: "Cloud-Backup", text: "Cloud-Backup" });
    // jede Neufassung steht in ihrer Liste, kein früherer Text mehr
    const alle = [...Object.values(GOBD).flat(), ...IFSG.inhalte, ...KASSEN_ARTEN];
    for (const [neu, alt] of Object.entries(FRUEHERE_TEXTE)) {
      expect(alle).toContain(neu);
      expect(alle).not.toContain(alt);
    }
  });
  it("früher gespeicherte Auswahlen werden in der Neufassung gedruckt", () => {
    const g = html("verfahrensdokumentation", { belegart: ["originär digital (Muster 4.3)"], sicherung_ort: ["durch Steuerberater"] });
    expect(g).toContain("elektronischer Beleg (originär digital)");
    expect(g).toContain("bei der Steuerberatung");
    expect(g).not.toContain("Muster 4.3");
    const i = html("ifsg_belehrung", { inhalte: ["bei Krankheitszeichen ärztlichen Rat einholen und mitteilen, dass man mit Lebensmitteln arbeitet (Merkblatt Gesundheitsamt)"] });
    expect(i).toContain("Bei Krankheitszeichen ärztlichen Rat einholen");
    expect(i).not.toContain("Merkblatt Gesundheitsamt");
    const k = html("ki_kompetenz", { themen: ["Ergebnisse von KI-Werkzeugen vor der Verwendung prüfen"] });
    expect(k).toContain("Prüfung von KI-Ergebnissen vor der Verwendung");
  });
  it("Vorbelegung verwendet die gespeicherten Werte der Optionen", () => {
    for (const [id, feld] of [["ifsg_belehrung", "inhalte"], ["ki_kompetenz", "themen"]] as const) {
      const f = vorlageFuer(id)!.abschnitte.flatMap((a) => a.felder).find((x) => x.id === feld)!;
      if (f.art !== "bausteine") throw new Error(feld);
      const werte = f.optionen.map((o) => o.wert);
      for (const w of f.vorbelegung ?? []) expect(werte).toContain(w);
    }
  });
});
