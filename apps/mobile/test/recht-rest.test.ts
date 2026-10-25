/**
 * Offene Punkte aus der Freigabe Rechtsanwalt (22.10.2026): eGbR über die Registerfrage, Datenpanne (72 Stunden,
 * Benachrichtigung der Betroffenen), Verpackung ab dem ersten Inverkehrbringen, BFSG-Produktliste als Auswahl,
 * Werkverkehr und Personenbeförderung, neue Einträge zu Gerätebatterien und Bargeldobergrenze.
 */
import { describe, expect, it } from "vitest";
import { auswertung, checkFragen, CHECK_FELDER, type Profil } from "../src/pflichten/check";

const alle = (a: ReturnType<typeof auswertung>) => [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt];
const finde = (a: ReturnType<typeof auswertung>, id: string) => alle(a).find((p) => p.id === id);
const felder = (p: Profil, f: readonly string[] = CHECK_FELDER) => checkFragen(p, f).map((x) => x.feld);

const gbr: Profil = { "taetigkeit.branchen": ["handwerk"], rechtsform: "gbr", "taetigkeit.einordnung": "gewerbe", bundesland: "BW", "beschaeftigte.gesamt": 0, gruendungsdatum: "2022-03-01" };

describe("Freigabe Rechtsanwalt: eGbR", () => {
  it("fragt die GbR nach dem Register, Einzelunternehmen nicht", () => {
    expect(felder(gbr)).toContain("gesellschaft.handelsregister");
    expect(felder({ ...gbr, rechtsform: "einzelunternehmen" })).not.toContain("gesellschaft.handelsregister");
  });
  it("eingetragene GbR: Transparenzregister, kein Hinweis zur Eintragung, keine Handelsregisteranmeldung", () => {
    const a = auswertung({ ...gbr, "gesellschaft.handelsregister": "eingetragen" }, "2026-10-22");
    expect(a.gilt.map((p) => p.id)).toContain("gesellschaft.transparenzregister");
    expect(finde(a, "gesellschaft.egbr_hinweis")).toBeUndefined();
    expect(finde(a, "gesellschaft.handelsregister_anmeldung")).toBeUndefined();
  });
  it("GbR ohne Angabe: Transparenzregister unklar, gefragt wird nur nach dem Register", () => {
    const t = finde(auswertung(gbr, "2026-10-22"), "gesellschaft.transparenzregister")!;
    expect(t.offeneFragen).toEqual(["gesellschaft.handelsregister"]);
  });
  it("nicht eingetragene GbR: kein Transparenzregister, Hinweis zur Eintragung bleibt", () => {
    const a = auswertung({ ...gbr, "gesellschaft.handelsregister": "nicht_beantragt" }, "2026-10-22");
    expect(finde(a, "gesellschaft.transparenzregister")).toBeUndefined();
    expect(finde(a, "gesellschaft.egbr_hinweis")).toBeDefined();
  });
});

describe("Freigabe Rechtsanwalt: Transport", () => {
  const kurier: Profil = { "taetigkeit.branchen": ["transport_logistik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 0, gruendungsdatum: "2020-01-01", "fahrzeuge.anzahl": 1, "fahrzeuge.gesamtmasse": ["ueber_3_5t"] };
  it("fragt, was befördert wird – nur mit Firmenfahrzeugen", () => {
    expect(felder(kurier)).toContain("fahrzeuge.befoerderung");
    expect(felder({ ...kurier, "fahrzeuge.anzahl": 0 })).not.toContain("fahrzeuge.befoerderung");
  });
  it("Werkverkehr ohne Erlaubnis, Güter für andere mit Erlaubnis, Personen mit PBefG-Genehmigung", () => {
    const werk = auswertung({ ...kurier, "fahrzeuge.befoerderung": ["eigene_gueter"] }, "2026-10-22");
    expect(finde(werk, "branche.transport_erlaubnis")).toBeUndefined();
    const fremd = auswertung({ ...kurier, "fahrzeuge.befoerderung": ["fremde_gueter"] }, "2026-10-22");
    expect(finde(fremd, "branche.transport_erlaubnis")).toBeDefined();
    const taxi = auswertung({ ...kurier, "fahrzeuge.befoerderung": ["personen"] }, "2026-10-22");
    expect(finde(taxi, "branche.personenbefoerderung_genehmigung")).toBeDefined();
  });
});

describe("Freigabe Rechtsanwalt: Produkte", () => {
  const shop: Profil = { "taetigkeit.branchen": ["onlinehandel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "HE", "beschaeftigte.gesamt": 0, gruendungsdatum: "2024-03-01", "kunden.segmente": ["b2c"], "produkte.arten": ["verpackung", "elektrogeraete"] };
  it("Verpackung: ohne Startdatum kein Termin (Bestand), mit Startdatum am Vortag", () => {
    expect(finde(auswertung(shop, "2026-10-22"), "produkte.verpackung")!.naechsterTermin).toBeNull();
    expect(finde(auswertung({ ...shop, "produkte.verpackung_ab": "2027-02-15" }, "2026-10-22"), "produkte.verpackung")!.naechsterTermin).toBe("2027-02-14");
  });
  it("Startdatum und BFSG-Liste nur, wenn sie passen", () => {
    const f = ["produkte.verpackung_ab", "produkte.bfsg_produkte"];
    expect(felder(shop, f)).toEqual(f);
    expect(felder({ ...shop, "produkte.arten": ["physisch"] }, f)).toEqual([]);
  });
  it("BFSG nur mit einem Produkt der Liste", () => {
    expect(finde(auswertung({ ...shop, "produkte.bfsg_produkte": ["keine"] }, "2026-10-22"), "produkte.barrierefreiheit")).toBeUndefined();
    expect(finde(auswertung({ ...shop, "produkte.bfsg_produkte": ["ebook_reader"] }, "2026-10-22"), "produkte.barrierefreiheit")).toBeDefined();
  });
});
