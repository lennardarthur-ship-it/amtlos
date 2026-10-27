/**
 * E-234 (Steuerberater 27.10.2026, S5): Voranmeldung des Kleinunternehmers nach § 18 Abs. 4a UStG (C.37, Entwurf v2).
 * (a) Voranmeldungszeitraum nach § 18 Abs. 2 UStG statt „Monate“: in der Regel das Kalendervierteljahr, der Monat bei mehr
 *     als 9.000 € Steuer im Vorjahr (Regelwert steuern.ust_va.grenze_monatlich wie C.24); Frist 10. Tag nach Ablauf. Die
 *     Neugründer-Regel klärt er noch – bis dahin auch für Neugründer vierteljährlich.
 * (b) Auslöser: Waren und Leistungen von Unternehmen im Ausland (EU und Drittländer, § 13b Abs. 1 und Abs. 2 Nr. 1 UStG).
 */
import { StandardKalender } from "@amtlos/fristen";
import { describe, expect, it } from "vitest";
import { auswerten } from "../src/index.js";
import { ladeKatalog } from "./hilfen.js";

const ID = "steuern.ust_voranmeldung_kleinunternehmer";
const katalog = ladeKatalog();
const c37 = katalog.pflichten.find((p) => p.id === ID)!;
const lauf = (fakten: Record<string, unknown>, stichtag = "2026-10-27", fenster?: { von: string; bis: string }) =>
  auswerten({
    katalog: { ...katalog, pflichten: [c37] },
    fakten: { "profil.bundesland": "BY", "profil.rechtsform": "einzelunternehmen", "profil.gruendungsdatum": "2022-01-01", "profil.ust.kleinunternehmer": true, ...fakten },
    ereignisse: [],
    stichtag,
    kalender: new StandardKalender(),
    ...(fenster ? { fenster } : {}),
  })[0]!;

describe("E-234 (a): Voranmeldungszeitraum nach § 18 Abs. 2 UStG", () => {
  it("in der Regel vierteljährlich, fällig am 10. Tag nach Ablauf des Vierteljahrs", () => {
    const r = lauf({ "profil.einkauf.ausland_unternehmen": true }, "2026-10-27", { von: "2026-10-01", bis: "2027-12-31" });
    expect(r.ergebnis).toBe("gilt");
    expect(r.termine.map((t) => [t.periode, t.faellig_am])).toEqual(expect.arrayContaining([["2026-Q3", "2026-10-12"], ["2026-Q4", "2027-01-11"], ["2027-Q1", "2027-04-12"]]));
    expect(r.termine.every((t) => /Q\d$/.test(t.periode ?? ""))).toBe(true);
  });
  it("monatlich bei mehr als 9.000 € Steuer im Vorjahr (Regelwert wie bei C.24), bis dahin nicht", () => {
    const monatlich = lauf({ "profil.einkauf.ausland_unternehmen": true, "profil.ust.zahllast_vorjahr": 9500 }, "2026-10-27", { von: "2026-11-01", bis: "2026-12-31" });
    expect(monatlich.termine.map((t) => [t.periode, t.faellig_am])).toEqual([["2026-10", "2026-11-10"], ["2026-11", "2026-12-10"]]);
    const genau = lauf({ "profil.einkauf.ausland_unternehmen": true, "profil.ust.zahllast_vorjahr": 9000 }, "2026-10-27", { von: "2026-11-01", bis: "2027-01-31" });
    expect(genau.termine.map((t) => t.periode)).toEqual(["2026-Q4"]);
  });
  it("Neugründer: bis zur Antwort des Steuerberaters vierteljährlich (kein Neugründer-Zweig wie in C.24)", () => {
    const r = lauf({ "profil.einkauf.ausland_unternehmen": true, "profil.gruendungsdatum": "2027-01-04" }, "2026-10-27", { von: "2027-01-01", bis: "2027-12-31" });
    expect(r.termine.map((t) => t.periode)).toEqual(["2027-Q1", "2027-Q2", "2027-Q3"]);
  });
});

describe("E-234 (b): Auslöser – Waren und Leistungen von Unternehmen im Ausland", () => {
  it("nur Drittland (EU-Einkauf nein): gilt", () => {
    expect(lauf({ "profil.einkauf.ausland_unternehmen": true, "profil.einkauf.eu_unternehmen": false }).ergebnis).toBe("gilt");
  });
  it("EU-Einkauf ja zählt mit (EU ist Ausland), auch ohne Antwort zum Ausland", () => {
    expect(lauf({ "profil.einkauf.eu_unternehmen": true }).ergebnis).toBe("gilt");
  });
  it("kein Einkauf im Ausland: gilt nicht; ohne Angabe „hängt ab“ (E-206)", () => {
    expect(lauf({ "profil.einkauf.ausland_unternehmen": false, "profil.einkauf.eu_unternehmen": false }).ergebnis).toBe("gilt_nicht");
    expect(lauf({ "profil.einkauf.eu_unternehmen": false }).ergebnis).toBe("unbekannt");
  });
  it("ohne Kleinunternehmerregelung nicht (dort gilt die gewöhnliche Voranmeldung)", () => {
    expect(lauf({ "profil.ust.kleinunternehmer": false, "profil.einkauf.ausland_unternehmen": true }).ergebnis).toBe("gilt_nicht");
  });
});
