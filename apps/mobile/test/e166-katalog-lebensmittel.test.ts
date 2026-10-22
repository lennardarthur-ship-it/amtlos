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
    // Rückmeldung T. Baum 22.10.2026: Onlinehändler mit Lebensmitteln werden ebenfalls gefragt, ohne Lebensmittel nicht
    expect(felder(feinkost)).toContain("gastro.vorverpackt");
    expect(felder({ ...feinkost, "produkte.arten": ["physisch"] })).not.toContain("gastro.vorverpackt");
    expect(finde(auswertung(cafe, "2026-10-22"), "branche.gastro_kennzeichnung_vorverpackt")!.offeneFragen).toContain("gastro.vorverpackt");
    expect(ids(auswertung({ ...cafe, "gastro.vorverpackt": true }, "2026-10-22").gilt)).toContain("branche.gastro_kennzeichnung_vorverpackt");
    expect(finde(auswertung({ ...cafe, "gastro.vorverpackt": false }, "2026-10-22"), "branche.gastro_kennzeichnung_vorverpackt")).toBeUndefined();
  });
  it("abgepackte Ware im Onlinehandel mit Lebensmitteln (Rückmeldung T. Baum): Kennzeichnung bei Ja, Abgrenzung zu loser Ware im Text", () => {
    expect(finde(auswertung(feinkost, "2026-10-22"), "branche.gastro_kennzeichnung_vorverpackt")!.offeneFragen).toContain("gastro.vorverpackt");
    expect(ids(auswertung({ ...feinkost, "gastro.vorverpackt": true }, "2026-10-22").gilt)).toContain("branche.gastro_kennzeichnung_vorverpackt");
    expect(finde(auswertung({ ...feinkost, "gastro.vorverpackt": true, "produkte.arten": ["physisch"] }, "2026-10-22"), "branche.gastro_kennzeichnung_vorverpackt")).toBeUndefined();
    const t = text(pflicht("branche.gastro_kennzeichnung_vorverpackt").erklaerung);
    expect(t).toMatch(/gilt als lose Ware\s+\(Art\. 44 Abs\. 1 LMIV\)/);
    expect(t).toMatch(/Selbstbedienung[^.]*\(§ 4 Abs\. 1 LMIDV\)/);
  });
  it("Rückverfolgbarkeit auch im Onlinehandel mit Lebensmitteln, nicht ohne Lebensmittel", () => {
    expect(ids(auswertung(feinkost, "2026-10-22").gilt)).toContain("branche.gastro_rueckverfolgbarkeit");
    expect(finde(auswertung({ ...feinkost, "produkte.arten": ["physisch"] }, "2026-10-22"), "branche.gastro_rueckverfolgbarkeit")).toBeUndefined();
    expect(text(pflicht("branche.gastro_rueckverfolgbarkeit").erklaerung)).toMatch(/Ware sperren, Lebensmittelüberwachung informieren \(Art\. 19 VO \(EG\) Nr\. 178\/2002\)/);
  });
  it("Acrylamid nur, wer selbst backt oder frittiert (Rückmeldung T. Baum): Frage nur in der Lebensmittelbranche", () => {
    expect(felder(cafe)).toContain("gastro.backen_frittieren");
    expect(felder(feinkost)).not.toContain("gastro.backen_frittieren");
    expect(finde(auswertung(cafe, "2026-10-22"), "branche.gastro_acrylamid")!.offeneFragen).toContain("gastro.backen_frittieren");
    expect(finde(auswertung({ ...cafe, "gastro.backen_frittieren": false }, "2026-10-22"), "branche.gastro_acrylamid")).toBeUndefined();
  });
  it("Kontaktmaterialien und Acrylamid als Hinweis für Lebensmittelbetriebe, alle als Entwurf", () => {
    const a = auswertung({ ...cafe, "gastro.backen_frittieren": true }, "2026-10-22");
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
    expect(t).toMatch(/Wiederholung einmal im Jahr \(DIN 10514\) – eine gesetzliche Frist dafür gibt es nicht/);
    expect(t).toMatch(/eigene Unterschriftsliste/);
    expect(t).toMatch(/§ 4 Abs\. 2 LMHV/);
    expect(finde(auswertung(cafe, "2026-10-22"), "branche.gastro_hygieneschulung")!.erledigung).toEqual({ art: "laufend", zeitraum: "jahr" });
  });
  it("Zusatzstoffe (berichtigter Prüfbericht): Azofarbstoffe, chininhaltig nach AromenDV, Koffeinhinweis nach FrSaftErfrischGetrV; Registrierung: Foodtruck am Betriebssitz", () => {
    const z = text(pflicht("branche.gastro_zusatzstoffe").erklaerung);
    expect(z).toMatch(/E 102, E 104, E 110, E 122, E 124 oder E 129[^.]*„Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen“ \(Art\. 24 in Verbindung mit Anhang V Verordnung \(EG\) Nr\. 1333\/2008/);
    expect(z).toMatch(/„chininhaltig“ bei nicht vorverpackten Getränken mit Chinin bis 1,2 % vol \(§ 5 Abs\. 1 AromenDV\)/);
    expect(z).toMatch(/mehr als 150 mg Koffein je Liter der Hinweis „Erhöhter Koffeingehalt\. Für Kinder und schwangere oder stillende Frauen nicht empfohlen“ mit dem Koffeingehalt in mg\/100 ml – nicht bei Kaffee und Tee \(§ 6 FrSaftErfrischGetrV in Verbindung mit Anhang III Nr\. 4\.1 LMIV\)/);
    expect(z).not.toMatch(/LMIDV|koffeinhaltig/);
    // Acrylamid: kleine Betriebe Anhang II Teil A, Teil B nur zusätzlich für Filial- und Franchisebetriebe
    expect(text(pflicht("branche.gastro_acrylamid").erklaerung)).toMatch(/Anhang II Teil A \(Art\. 2 Abs\. 2\); die Maßnahmen nach Anhang II Teil B kommen nur für zentral gesteuerte Filial- und Franchisebetriebe hinzu \(Art\. 2 Abs\. 3\)/);
    expect(text(pflicht("branche.gastro_lebensmittelregistrierung").erklaerung)).toMatch(/Betriebssitz – dort, wo das Fahrzeug steht bzw. wo du wohnst –, nicht bei der am Verkaufsplatz/);
  });
});
