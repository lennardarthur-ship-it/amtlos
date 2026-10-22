/**
 * Prüfbericht Lebensmittelhygiene (Tim Baum, 22.10.2026), Abschnitt E: Katalog – Wassertank im Check mit Frist ab der
 * Inbetriebnahme, abgepackte Ware, Rückverfolgbarkeit auch im Onlinehandel mit Lebensmitteln, neue Hinweise
 * (Kontaktmaterialien, Acrylamid), Schulungsnachweis und Zusatzstoffe im Text.
 */
import { describe, expect, it } from "vitest";
import { KATALOG, auswertung, checkFragen, type Profil } from "../src/pflichten/check";

const alle = (a: ReturnType<typeof auswertung>) => [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt];
const finde = (a: ReturnType<typeof auswertung>, id: string) => alle(a).find((p) => p.id === id);
const ids = (l: { id: string }[]) => l.map((p) => p.id);
const felder = (p: Profil) => checkFragen(p).map((f) => f.feld);
const pflicht = (id: string) => KATALOG.pflichten.find((p) => p.id === id) as unknown as { erklaerung: unknown; einordnung?: string; pruefung: { status: string } };
const text = (t: unknown) => (typeof t === "string" ? t : ((t as { de?: string })?.de ?? ""));

const foodtruck: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BW", "beschaeftigte.gesamt": 0, "erlaubnis.gewo_paragraphen": ["55"], gruendungsdatum: "2026-12-01" };
const cafe: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "SN", "beschaeftigte.gesamt": 2, "vertrieb.kanaele": ["ladengeschaeft"], "erlaubnis.gewo_paragraphen": [], gruendungsdatum: "2022-03-01" };
const feinkost: Profil = { "taetigkeit.branchen": ["onlinehandel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 0, "produkte.arten": ["physisch", "lebensmittel"], gruendungsdatum: "2024-03-01" };

describe("Prüfbericht Lebensmittelhygiene: Wassertank im Check", () => {
  it("fragt den Wassertank nur beim mobilen Verkauf, die Inbetriebnahme nur mit Tank", () => {
    expect(felder(foodtruck)).toContain("gastro.wassertank");
    expect(felder(foodtruck)).not.toContain("gastro.wassertank_ab");
    expect(felder({ ...foodtruck, "gastro.wassertank": true })).toContain("gastro.wassertank_ab");
    expect(felder({ ...foodtruck, "erlaubnis.gewo_paragraphen": [], "vertrieb.kanaele": ["marktstand"] })).toContain("gastro.wassertank");
    expect(felder(cafe)).not.toContain("gastro.wassertank");
    expect(felder(feinkost)).not.toContain("gastro.wassertank");
  });
  it("ohne Antwort zum Tank: „hängt ab“ mit der Frage; ohne Tank: keine Anzeige", () => {
    const a = auswertung(foodtruck, "2026-10-22");
    expect(ids(a.unbekannt)).toContain("branche.gastro_trinkwasser_mobil");
    expect(finde(a, "branche.gastro_trinkwasser_mobil")!.offeneFragen).toContain("gastro.wassertank");
    expect(finde(auswertung({ ...foodtruck, "gastro.wassertank": false }, "2026-10-22"), "branche.gastro_trinkwasser_mobil")).toBeUndefined();
  });
  it("Frist vier Wochen vor der Inbetriebnahme des Tanks, nicht vor der Gründung", () => {
    const a = auswertung({ ...foodtruck, "gastro.wassertank": true, "gastro.wassertank_ab": "2027-03-01" }, "2026-10-22");
    expect(ids(a.gilt)).toContain("branche.gastro_trinkwasser_mobil");
    expect(finde(a, "branche.gastro_trinkwasser_mobil")!.naechsterTermin).toBe("2027-02-01");
  });
});

describe("Prüfbericht Lebensmittelhygiene: neue und geänderte Katalogeinträge", () => {
  it("abgepackte Ware: Frage im Check der Lebensmittelbranche, Kennzeichnung nur bei Ja", () => {
    expect(felder(cafe)).toContain("gastro.vorverpackt");
    expect(felder(feinkost)).not.toContain("gastro.vorverpackt");
    expect(finde(auswertung(cafe, "2026-10-22"), "branche.gastro_kennzeichnung_vorverpackt")!.offeneFragen).toContain("gastro.vorverpackt");
    expect(ids(auswertung({ ...cafe, "gastro.vorverpackt": true }, "2026-10-22").gilt)).toContain("branche.gastro_kennzeichnung_vorverpackt");
    expect(finde(auswertung({ ...cafe, "gastro.vorverpackt": false }, "2026-10-22"), "branche.gastro_kennzeichnung_vorverpackt")).toBeUndefined();
  });
  it("Rückverfolgbarkeit auch im Onlinehandel mit Lebensmitteln, nicht ohne Lebensmittel", () => {
    expect(ids(auswertung(feinkost, "2026-10-22").gilt)).toContain("branche.gastro_rueckverfolgbarkeit");
    expect(finde(auswertung({ ...feinkost, "produkte.arten": ["physisch"] }, "2026-10-22"), "branche.gastro_rueckverfolgbarkeit")).toBeUndefined();
    expect(text(pflicht("branche.gastro_rueckverfolgbarkeit").erklaerung)).toMatch(/Ware sperren, Lebensmittelüberwachung informieren \(Art\. 19 VO \(EG\) Nr\. 178\/2002\)/);
  });
  it("Kontaktmaterialien und Acrylamid als Hinweis für Lebensmittelbetriebe, alle als Entwurf", () => {
    const a = auswertung(cafe, "2026-10-22");
    for (const id of ["branche.gastro_kontaktmaterialien", "branche.gastro_acrylamid"]) {
      expect(ids(a.gilt)).toContain(id);
      expect(finde(a, id)!.einordnung).toBe("hinweis");
    }
    expect(ids(auswertung(feinkost, "2026-10-22").gilt)).not.toEqual(expect.arrayContaining(["branche.gastro_kontaktmaterialien"]));
    for (const id of ["branche.gastro_kennzeichnung_vorverpackt", "branche.gastro_kontaktmaterialien", "branche.gastro_acrylamid", "branche.gastro_hygieneschulung", "branche.gastro_trinkwasser_mobil"]) expect(pflicht(id).pruefung.status).toBe("entwurf");
  });
  it("Hygieneschulung: Nachweis, jährliche Wiederholung, Abgrenzung zur IfSG-Belehrung, Ausnahme Berufsausbildung", () => {
    const t = text(pflicht("branche.gastro_hygieneschulung").erklaerung);
    expect(t).toMatch(/§ 4 Abs\. 1 Satz 2 LMHV/);
    expect(t).toMatch(/einmal im Jahr \(DIN 10514\)/);
    expect(t).toMatch(/eigene Unterschriftsliste/);
    expect(t).toMatch(/§ 4 Abs\. 2 LMHV/);
    expect(finde(auswertung(cafe, "2026-10-22"), "branche.gastro_hygieneschulung")!.erledigung).toEqual({ art: "laufend", zeitraum: "jahr" });
  });
  it("Zusatzstoffe: koffeinhaltig und chininhaltig nach LMIV, nicht LMZDV; Registrierung: Foodtruck am Betriebssitz", () => {
    expect(text(pflicht("branche.gastro_zusatzstoffe").erklaerung)).toMatch(/„koffeinhaltig“ und „chininhaltig“[^.]*Anhang III Nr\. 4 LMIV in Verbindung mit § 2 LMIDV/);
    expect(text(pflicht("branche.gastro_lebensmittelregistrierung").erklaerung)).toMatch(/Betriebssitz – dort, wo das Fahrzeug steht bzw. wo du wohnst –, nicht bei der am Verkaufsplatz/);
  });
});
