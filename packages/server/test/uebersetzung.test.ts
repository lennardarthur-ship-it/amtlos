import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { pruefeUebersetzungen } from "../src/katalog-import.js";
import { WURZEL } from "../src/testhilfen.js";

/** Alle deutschen Textobjekte {de} im Katalog (wie katalog.lokalisiere in 0015). */
function deutscheTexte(o: unknown, aus: Set<string>) {
  if (Array.isArray(o)) for (const x of o) deutscheTexte(x, aus);
  else if (o && typeof o === "object") {
    const r = o as Record<string, unknown>;
    if (typeof r.de === "string" && Object.keys(r).every((k) => k === "de" || k === "en")) aus.add(r.de);
    else for (const v of Object.values(r)) deutscheTexte(v, aus);
  }
  return aus;
}

describe("Englische Katalogtexte (E-107)", () => {
  const katalog = path.join(WURZEL, "catalog");
  const datei = parse(fs.readFileSync(path.join(katalog, "uebersetzungen/en.yaml"), "utf8")) as { sprache: string; eintraege: { de: string; en: string }[] };
  const texte = new Set<string>();
  for (const ordner of ["pflichten", "regelwerte"])
    for (const n of fs.readdirSync(path.join(katalog, ordner)).filter((x) => x.endsWith(".yaml"))) deutscheTexte(parse(fs.readFileSync(path.join(katalog, ordner, n), "utf8")), texte);

  it("die Datei ist gültig", () => {
    expect(pruefeUebersetzungen(datei, "en.yaml")).toEqual([]);
  });

  it("jeder deutsche Text im Katalog hat eine Übersetzung", () => {
    const vorhanden = new Set(datei.eintraege.map((e) => e.de));
    const fehlend = [...texte].filter((x) => !vorhanden.has(x));
    expect(fehlend, "fehlende Übersetzungen – scripts/uebersetzung_abdeckung.py").toEqual([]);
  });

  it("Zahlen bleiben erhalten (Beträge, Fristen, Paragrafen)", () => {
    // Tausendertrennzeichen vereinheitlichen (25.000 € ↔ €25,000), Reihenfolge darf sich ändern
    const zahlen = (x: string, trenner: string) =>
      (x.replace(new RegExp(`(\\d)\\${trenner}(\\d{3})(?!\\d)`, "g"), "$1$2").match(/\d+/g) ?? []).sort().join(" ");
    const abweichend = datei.eintraege.filter((e) => zahlen(e.de, ".") !== zahlen(e.en, ","));
    expect(abweichend.map((e) => `${e.de} → ${e.en}`)).toEqual([]);
  });

  it("prüft Fehler in Übersetzungsdateien", () => {
    expect(pruefeUebersetzungen({ sprache: "fr", eintraege: [{ de: "a", en: "" }, { de: "b", en: "B" }, { de: "b", en: "B" }] }, "x.yaml")).toEqual([
      'x.yaml: sprache muss "en" sein',
      "x.yaml: Eintrag 1 braucht de und en",
      "x.yaml: doppelter deutscher Text in Eintrag 3",
    ]);
  });
});
