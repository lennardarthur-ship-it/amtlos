/**
 * E-238: Staatsangehörigkeit – Erkenner für ältere Freitexte und Auswahl (Gründerbefund 29.10.2026: „deutsche“ galt als
 * Drittstaat). Zuordnungstabelle: Adjektive in allen Endungen, Länder, ISO-Codes, englisch, mehrere Angaben, Tippfehler.
 */
import { describe, expect, it } from "vitest";
import {
  FREIE_STAATEN,
  PERSONEN_FELDER,
  STAAT_OPTIONEN,
  personMerken,
  staatAuswahl,
  staatsangehoerigkeitArt,
  staatsangehoerigkeitErkennen,
  staatsangehoerigkeitText,
  type Person,
} from "../src/index.js";

/** Eingabe → [Einordnung, Auswahl] */
const TABELLE: [string | null, "frei" | "drittstaat" | "unbekannt" | "leer", string | null][] = [
  ["deutsch", "frei", "DE"],
  ["deutsche", "frei", "DE"],
  ["Deutsche", "frei", "DE"],
  ["deutscher", "frei", "DE"],
  ["deutschen", "frei", "DE"],
  ["Deutsch", "frei", "DE"],
  ["DEUTSCH", "frei", "DE"],
  ["Deutschland", "frei", "DE"],
  ["DE", "frei", "DE"],
  ["D", "frei", "DE"],
  ["DEU", "frei", "DE"],
  ["german", "frei", "DE"],
  ["German", "frei", "DE"],
  ["Bundesrepublik Deutschland", "frei", "DE"],
  ["deutsche Staatsangehörigkeit", "frei", "DE"],
  ["Staatsangehörigkeit: deutsch", "frei", "DE"],
  ["Deutsch (DE)", "frei", "DE"],
  ["  deutsch  ", "frei", "DE"],
  ["deutsch/türkisch", "frei", "mehrere_frei"],
  ["deutsch, türkisch", "frei", "mehrere_frei"],
  ["Deutschland und Türkei", "frei", "mehrere_frei"],
  ["doppelte Staatsangehörigkeit deutsch-türkisch", "frei", "mehrere_frei"],
  ["deutsch, polnisch", "frei", "mehrere_frei"],
  ["österreichisch", "frei", "AT"],
  ["Österreicherin", "frei", "AT"],
  ["Österreich", "frei", "AT"],
  ["oesterreichisch", "frei", "AT"],
  ["AT", "frei", "AT"],
  ["französisch", "frei", "FR"],
  ["Französin", "frei", "FR"],
  ["Polin", "frei", "PL"],
  ["polnisch", "frei", "PL"],
  ["Pole", "frei", "PL"],
  ["italienische", "frei", "IT"],
  ["Italienerin", "frei", "IT"],
  ["schweizerisch", "frei", "CH"],
  ["Schweizer", "frei", "CH"],
  ["Schweiz", "frei", "CH"],
  ["CH", "frei", "CH"],
  ["swiss", "frei", "CH"],
  ["norwegisch", "frei", "NO"],
  ["Liechtenstein", "frei", "LI"],
  ["Island", "frei", "IS"],
  ["isländisch", "frei", "IS"],
  ["niederländisch", "frei", "NL"],
  ["holländisch", "frei", "NL"],
  ["Dutch", "frei", "NL"],
  ["rumänisch", "frei", "RO"],
  ["griechische", "frei", "GR"],
  ["kroatisch", "frei", "HR"],
  ["EU", "frei", null],
  ["EU-Bürgerin", "frei", null],
  ["türkisch", "drittstaat", "andere"],
  ["Türkin", "drittstaat", "andere"],
  ["TR", "drittstaat", "andere"],
  ["ukrainisch", "drittstaat", "andere"],
  ["ukrainische", "drittstaat", "andere"],
  ["syrisch", "drittstaat", "andere"],
  ["US-amerikanisch", "drittstaat", "andere"],
  ["britisch", "drittstaat", "andere"],
  ["serbisch, bosnisch", "drittstaat", "andere"],
  ["staatenlos", "drittstaat", "staatenlos"],
  ["Staatenlose", "drittstaat", "staatenlos"],
  ["", "leer", null],
  ["   ", "leer", null],
  [null, "leer", null],
  ["deustch", "unbekannt", null],
  ["Deutchland", "unbekannt", null],
  ["polnsich", "unbekannt", null],
  ["xyz", "unbekannt", null],
  ["ungeklärt", "unbekannt", null],
  ["unbekannt", "unbekannt", null],
  ["?", "unbekannt", null],
  ["nicht deutsch", "unbekannt", null],
  ["früher polnisch", "unbekannt", null],
  ["deutsch oder türkisch", "unbekannt", null],
  ["anderer Staat", "unbekannt", null],
  ["deutsch beantragt", "unbekannt", null],
];

describe("Zuordnungstabelle (E-238)", () => {
  for (const [ein, art, wahl] of TABELLE)
    it(`${JSON.stringify(ein)} → ${art}${wahl ? ` (${wahl})` : ""}`, () => {
      expect(staatsangehoerigkeitErkennen(ein).art).toBe(art);
      expect(staatsangehoerigkeitArt({ staatsangehoerigkeit: ein })).toBe(art);
      expect(staatAuswahl({ staatsangehoerigkeit: ein })).toBe(wahl);
    });
  it("Tippfehler: unbekannt, aber mit Vorschlag zum Antippen", () => {
    expect(staatsangehoerigkeitErkennen("deustch").vorschlag).toBe("DE");
    expect(staatsangehoerigkeitErkennen("Deutchland").vorschlag).toBe("DE");
    expect(staatsangehoerigkeitErkennen("polnsich").vorschlag).toBe("PL");
    expect(staatsangehoerigkeitErkennen("xyz").vorschlag).toBeUndefined();
    expect(staatsangehoerigkeitErkennen("deustch").unbekannt).toEqual(["deustch"]);
  });
  it("jeder Staat der EU, des EWR und die Schweiz: Name, Adjektiv in allen Endungen und Code werden erkannt", () => {
    expect(FREIE_STAATEN.filter((s) => s.gruppe === "eu")).toHaveLength(27);
    expect(FREIE_STAATEN.filter((s) => s.gruppe === "ewr").map((s) => s.name)).toEqual(["Island", "Liechtenstein", "Norwegen"]);
    expect(FREIE_STAATEN.filter((s) => s.gruppe === "ch").map((s) => s.name)).toEqual(["Schweiz"]);
    for (const s of FREIE_STAATEN) {
      expect(staatAuswahl({ staatsangehoerigkeit: s.name })).toBe(s.code);
      expect(staatAuswahl({ staatsangehoerigkeit: s.code })).toBe(s.code);
      for (const e of ["", "e", "er", "es", "en", "em"]) expect(staatAuswahl({ staatsangehoerigkeit: s.adjektive[0] + e })).toBe(s.code);
    }
  });
});

describe("Auswahl statt Freitext (E-238)", () => {
  it("Liste: Deutschland zuerst, alle EU-Staaten, EWR, Schweiz, mehrere, anderer Staat, staatenlos, ungeklärt", () => {
    expect(STAAT_OPTIONEN[0]).toEqual({ wert: "DE", text: "Deutschland" });
    expect(STAAT_OPTIONEN.map((o) => o.text)).toEqual(expect.arrayContaining(["Island (EWR)", "Liechtenstein (EWR)", "Norwegen (EWR)", "Schweiz", "Mehrere – darunter EU, EWR oder Schweiz", "Staatenlos", "Ungeklärt"]));
    expect(STAAT_OPTIONEN.slice(-4).map((o) => o.wert)).toEqual(["mehrere_frei", "andere", "staatenlos", "ungeklaert"]);
    expect(new Set(STAAT_OPTIONEN.map((o) => o.wert)).size).toBe(STAAT_OPTIONEN.length);
  });
  it("gespeicherte Wahl geht vor dem Text; „ungeklärt“ ist zu prüfen, „staatenlos“ und „anderer Staat“ wie Drittstaat", () => {
    expect(staatsangehoerigkeitArt({ staat: "DE", staatsangehoerigkeit: "xyz" })).toBe("frei");
    expect(staatsangehoerigkeitArt({ staat: "mehrere_frei", staatsangehoerigkeit: "deutsch, türkisch" })).toBe("frei");
    expect(staatsangehoerigkeitArt({ staat: "andere", staatsangehoerigkeit: "vietnamesisch" })).toBe("drittstaat");
    expect(staatsangehoerigkeitArt({ staat: "staatenlos" })).toBe("drittstaat");
    expect(staatsangehoerigkeitArt({ staat: "ungeklaert" })).toBe("unbekannt");
    // unbekannter Wert der Auswahl (z. B. aus einer neueren Fassung): der Text entscheidet
    expect(staatsangehoerigkeitArt({ staat: "XX", staatsangehoerigkeit: "deutsch" })).toBe("frei");
  });
  it("Text für die Unterlagen: passender älterer Text bleibt gleich (Druck unverändert), sonst der Name des Staats", () => {
    expect(staatsangehoerigkeitText("DE", "deutsch")).toBe("deutsch");
    expect(staatsangehoerigkeitText("DE", "deutsche")).toBe("deutsche");
    expect(staatsangehoerigkeitText("DE", "deustch")).toBe("Deutschland");
    expect(staatsangehoerigkeitText("DE", "")).toBe("Deutschland");
    expect(staatsangehoerigkeitText("PL", "deutsch")).toBe("Polen");
    expect(staatsangehoerigkeitText("andere", "türkisch")).toBe("türkisch");
    expect(staatsangehoerigkeitText("andere", "deutsch")).toBe("");
    expect(staatsangehoerigkeitText("mehrere_frei", "deutsch/türkisch")).toBe("deutsch/türkisch");
    expect(staatsangehoerigkeitText("staatenlos", "")).toBe("staatenlos");
    expect(staatsangehoerigkeitText("ungeklaert", "deustch")).toBe("deustch");
  });
  it("Feld der Mitarbeiter: Auswahl mit allen Möglichkeiten; Text nur bei „mehrere“/„anderer Staat“; Aufenthaltstitel nur außerhalb", () => {
    const f = PERSONEN_FELDER.mitarbeiter;
    const staat = f.find((x) => x.id === "staat")!;
    expect(staat.art).toBe("wahl");
    expect(staat.art === "wahl" && staat.optionen.map((o) => o.wert)).toEqual(STAAT_OPTIONEN.map((o) => o.wert));
    expect(f.findIndex((x) => x.id === "staat")).toBeLessThan(f.findIndex((x) => x.id === "staatsangehoerigkeit"));
    expect(f.find((x) => x.id === "staatsangehoerigkeit")!.wenn).toEqual({ feld: "staat", ist: ["mehrere_frei", "andere"] });
    for (const id of ["aufenthalt_art", "aufenthalt_bis"]) expect(f.find((x) => x.id === id)!.wenn).toEqual({ feld: "staat", ist: ["andere", "staatenlos"] });
  });
  it("Unterlage mit anderer Staatsangehörigkeit als zur Wahl passt: die alte Wahl entfällt, der Text gilt", () => {
    const liste: Person[] = [{ id: "m1", name: "Ana Petrović", staat: "HR", staatsangehoerigkeit: "Kroatien" }];
    const gleich = personMerken(liste, { name: "Ana Petrović", staatsangehoerigkeit: "kroatisch" }, "x");
    expect(gleich[0]!.staat).toBe("HR");
    const anders = personMerken(liste, { name: "Ana Petrović", staatsangehoerigkeit: "serbisch" }, "x");
    expect(anders[0]!.staat).toBeNull();
    expect(staatsangehoerigkeitArt(anders[0]!)).toBe("drittstaat");
    // ohne Staatsangehörigkeit in der Unterlage bleibt alles, wie es war
    expect(personMerken(liste, { name: "Ana Petrović", anschrift: "Weg 1" }, "x")[0]!.staat).toBe("HR");
  });
});
