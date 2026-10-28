/**
 * E-237 (Steuerberater, Nachtrag 28.10.2026 zu S5 a): Voranmeldung des Kleinunternehmers nach § 18 Abs. 4a UStG (C.37, v3).
 * Die Neugründer-Regel (§ 18 Abs. 2 Satz 4 UStG) gilt für Kleinunternehmer nicht (Abschnitt 18.7 Abs. 1 Satz 4 UStAE):
 * Kalendervierteljahr (§ 18 Abs. 4a Satz 2 i. V. m. Abs. 2 Satz 1 UStG) auch im Gründungs- und Folgejahr; der Kalendermonat
 * nur bei mehr als 9.000 € Steuer im Vorjahr (§ 18 Abs. 2 Satz 2 UStG, Regelwert); keine freiwillige monatliche Abgabe
 * (§ 18 Abs. 4a Satz 3 UStG) – die Angabe „monatlich“ zum Rhythmus zählt hier nicht. Fällig am 10. Tag nach Ablauf.
 */
import { StandardKalender } from "@amtlos/fristen";
import { describe, expect, it } from "vitest";
import { auswerten } from "../src/index.js";
import { ladeKatalog } from "./hilfen.js";

const ID = "steuern.ust_voranmeldung_kleinunternehmer";
const katalog = ladeKatalog();
const c37 = katalog.pflichten.find((p) => p.id === ID)!;
const lauf = (fakten: Record<string, unknown>, fenster: { von: string; bis: string }) =>
  auswerten({
    katalog: { ...katalog, pflichten: [c37] },
    fakten: { "profil.bundesland": "BY", "profil.rechtsform": "einzelunternehmen", "profil.gruendungsdatum": "2022-01-01", "profil.ust.kleinunternehmer": true, "profil.einkauf.ausland_unternehmen": true, "profil.einkauf.eu_unternehmen": true, ...fakten },
    ereignisse: [],
    stichtag: fenster.von,
    kalender: new StandardKalender(),
    fenster,
  })[0]!;
const perioden = (r: ReturnType<typeof lauf>) => r.termine.map((t) => [t.periode, t.faellig_am]);

describe("E-237: C.37 v3 – keine Neugründer-Regel, keine freiwillige monatliche Abgabe", () => {
  it("v3, freigegeben, nicht zurückgehalten", () => {
    expect(c37.version).toBe(3);
    expect((c37 as { nicht_vor_freigabe?: boolean }).nicht_vor_freigabe).toBeUndefined();
    expect((c37 as { pruefung?: { status: string } }).pruefung?.status).toBe("freigegeben");
  });
  it("Gründungsjahr und Folgejahr: Kalendervierteljahr, fällig am 10. Tag nach Ablauf (kein Neugründer-Zweig wie in C.24)", () => {
    const r = lauf({ "profil.gruendungsdatum": "2026-03-01" }, { von: "2026-03-01", bis: "2027-12-31" });
    expect(r.ergebnis).toBe("gilt");
    expect(perioden(r)).toEqual([["2026-Q1", "2026-04-10"], ["2026-Q2", "2026-07-10"], ["2026-Q3", "2026-10-12"], ["2026-Q4", "2027-01-11"], ["2027-Q1", "2027-04-12"], ["2027-Q2", "2027-07-12"], ["2027-Q3", "2027-10-11"]]);
  });
  it("Angabe „monatlich“ zum Rhythmus zählt nicht (§ 18 Abs. 4a Satz 3 UStG) – weiter vierteljährlich", () => {
    for (const rhythmus of ["monatlich", "vierteljaehrlich", "unklar"]) {
      const r = lauf({ "profil.ust.voranmeldung_rhythmus": rhythmus }, { von: "2026-11-01", bis: "2027-04-30" });
      expect(perioden(r), rhythmus).toEqual([["2026-Q4", "2027-01-11"], ["2027-Q1", "2027-04-12"]]);
    }
  });
  it("Kalendermonat nur bei mehr als 9.000 € Steuer im Vorjahr – auch wenn „vierteljährlich“ angegeben ist", () => {
    const r = lauf({ "profil.ust.zahllast_vorjahr": 9000.01, "profil.ust.voranmeldung_rhythmus": "vierteljaehrlich" }, { von: "2026-11-01", bis: "2026-12-31" });
    expect(perioden(r)).toEqual([["2026-10", "2026-11-10"], ["2026-11", "2026-12-10"]]);
    expect(perioden(lauf({ "profil.ust.zahllast_vorjahr": 9000 }, { von: "2026-11-01", bis: "2027-01-31" }))).toEqual([["2026-Q4", "2027-01-11"]]);
  });
});
