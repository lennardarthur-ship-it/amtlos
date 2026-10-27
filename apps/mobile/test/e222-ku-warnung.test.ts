/**
 * E-222 (externer Prüfer, Befund 12c): Die Kleinunternehmer-Warnungen 80 %/95 % maßen außerhalb des Gründungsjahrs nur an
 * 100.000 €. Wichtiger ist die Grenze von 25.000 €: Wer sie in diesem Jahr überschreitet, ist ab 1. Januar des nächsten
 * Jahres kein Kleinunternehmer mehr (bestätigte Regelwerte steuern.ustg19.*: Vorjahr ≤ 25.000 €, laufendes Jahr
 * ≤ 100.000 €, Gründungsjahr ≤ 25.000 €). Jetzt warnen beide Einträge auch bei 80 % bzw. 95 % von 25.000 €.
 */
import { describe, expect, it } from "vitest";
import { auswertung } from "../src/pflichten/check";
import katalog from "../src/pflichten/katalog.json";
import { umsatzFakten } from "../src/unterlagen/kuUmsatz";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, type Stand } from "../src/unterlagen/speicher";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Atelier Kim", strasse: "Weg 1", plz: "80331", ort: "München", email: "kim@example.org", telefon: "089 1", steuernummer: "143/123/12345", iban: "DE89370400440532013000" };
const PROFIL = { rechtsform: "freiberuf", gruendungsdatum: "2022-01-01", "taetigkeit.einordnung": "freiberuf", "ust.kleinunternehmer": true, "umsatz.vorjahr": 20000, bundesland: "BY", gemeinde_ags: "09162000" };
const stand = (profil: Record<string, unknown> = {}): Stand => ({ ...LEERER_STAND, betrieb: BETRIEB, profil: { ...PROFIL, ...profil } });
function rechnung(s: Stand, id: string, datum: string, preis: string, bezahlt?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: "Privatkundin", kunde_anschrift: "Allee 2\n80333 München", kunde_email: "k@example.org", kleinunternehmer: true, positionen: [{ bezeichnung: "Wandbild", preis, satz: "19", menge: "1", einheit: "" }] }, t(datum));
  const s3 = ausgeben(s2, id, t(datum));
  return bezahlt ? bezahltSetzen(s3, id, bezahlt) : s3;
}
const KU = /^steuern\.kleinunternehmer_(warnung|grenze|naechstes)/;
const ku = (s: Stand, stichtag = "2026-10-11") => {
  const a = auswertung(s.profil, stichtag, [], [], umsatzFakten(s, stichtag));
  return [...a.gilt, ...a.gruendung].map((p) => p.id).filter((id) => KU.test(id)).sort();
};
const pflicht = (id: string) => (katalog as unknown as { pflichten: { id: string; version: number; kurz: { de: string }; erklaerung: { de: string } }[] }).pflichten.find((p) => p.id === id)!;

describe("E-222: Warnung vor der Grenze von 25.000 € außerhalb des Gründungsjahrs", () => {
  it("unter 80 % von 25.000 €: keine Warnung", () => {
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "19.999,99", "2026-05-15"))).toEqual([]);
  });

  it("ab 20.000 € (80 %): Warnung 80 %", () => {
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "20.000,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_warnung_80"]);
  });

  it("ab 23.750 € (95 %) bis einschließlich 25.000 €: Warnung 95 %", () => {
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "23.750,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_warnung_95"]);
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "25.000,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_warnung_95"]);
  });

  it("über 25.000 €: „Ab 1. Januar Regelbesteuerung“ (wie bisher), keine Warnung mehr", () => {
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "25.000,01", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_naechstes_jahr"]);
  });

  it("offene Rechnung zählt für die Warnung vorsichtshalber mit (Ersatzregel)", () => {
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "21.000,00"))).toEqual(["steuern.kleinunternehmer_warnung_80"]);
  });

  it("Vorjahr über 25.000 € (Profil): keine 25.000-€-Warnung, sondern „Grenze überschritten“", () => {
    expect(ku(rechnung(stand({ "umsatz.vorjahr": 30000 }), "r1", "2026-05-01", "21.000,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_grenze_ueberschritten"]);
  });

  it("100.000 € im laufenden Jahr wie bisher: Warnung ab 80.000 € bzw. 95.000 €, darüber „Grenze überschritten“", () => {
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "85.000,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_naechstes_jahr", "steuern.kleinunternehmer_warnung_80"]);
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "96.000,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_naechstes_jahr", "steuern.kleinunternehmer_warnung_95"]);
    expect(ku(rechnung(stand(), "r1", "2026-05-01", "100.000,01", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_grenze_ueberschritten"]);
  });
});

describe("E-222: Gründungsjahr unverändert an 25.000 €", () => {
  const g = (profil = {}) => stand({ gruendungsdatum: "2026-02-01", "umsatz.vorjahr": undefined, ...profil });
  it("80 % / 95 % / überschritten", () => {
    expect(ku(rechnung(g(), "r1", "2026-05-01", "20.000,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_warnung_80"]);
    expect(ku(rechnung(g(), "r1", "2026-05-01", "24.000,00", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_warnung_95"]);
    expect(ku(rechnung(g(), "r1", "2026-05-01", "25.000,01", "2026-05-15"))).toEqual(["steuern.kleinunternehmer_grenze_ueberschritten"]);
  });
});

describe("E-222: Texte aus bestätigtem Wortlaut, neue Version ohne Vermerk", () => {
  it("Kurztext nennt beide Grenzen und die Folge; Erklärung mit den Sätzen aus „Grenze überschritten“ und „Ab 1. Januar“", () => {
    for (const id of ["steuern.kleinunternehmer_warnung_80", "steuern.kleinunternehmer_warnung_95"]) {
      const p = pflicht(id);
      // E-226: v7 vom Steuerberater bestätigt; v8 nur mit ergänzter Fundstelle (§ 19 Abs. 1 Satz 1 UStG, Abschnitt 19.1 UStAE)
      expect(p.version, id).toBe(8);
      expect(p.kurz.de, id).toContain("25.000 €");
      expect(p.kurz.de, id).toContain("100.000 €");
      // Wortlaut aus steuern.kleinunternehmer_grenze_ueberschritten v7 (kurz) und steuern.kleinunternehmer_naechstes_jahr v6
      expect(p.erklaerung.de, id).toContain("Überschreitest du im laufenden Jahr 100.000 € (im Gründungsjahr 25.000 €), ist schon der Umsatz, mit dem du die Grenze überschreitest, steuerpflichtig.");
      expect(p.erklaerung.de, id).toContain("Überschreitest du diese Grenze in diesem Jahr, ohne über 100.000 € zu kommen, gilt die Regelung bis zum Jahresende weiter, ab 1. Januar des nächsten Jahres ist die Regelbesteuerung vorgesehen.");
      expect(pflicht("steuern.kleinunternehmer_grenze_ueberschritten").kurz.de).toContain("Überschreitest du im laufenden Jahr 100.000 € (im Gründungsjahr 25.000 €), ist schon der Umsatz, mit dem du die Grenze überschreitest, steuerpflichtig.");
      expect(pflicht("steuern.kleinunternehmer_naechstes_jahr").erklaerung.de.replace(/\s+/g, " ")).toContain("Überschreitest du diese Grenze in diesem Jahr, ohne über 100.000 € zu kommen, gilt die Regelung bis zum Jahresende weiter.");
    }
  });
});
