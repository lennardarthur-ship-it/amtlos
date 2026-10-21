/**
 * Runde 11: Befunde aus Rechts- und Steuerprüfung und den Nutzertests (Gründerin Foodtruck, Gebäudereinigung, Tischlerei,
 * Kosmetik) zum Pflichten-Check – Branchen nach SchwarzArbMoDiG, Gründungsschritte in Reihenfolge mit Voraussetzungen,
 * Fragen passend zum Betrieb, Kasse ab Anschaffung, Drittstaaten aus „Mitarbeiter“, unklare Pflichten als Bedingung.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND } from "../src/unterlagen/speicher";
import { auswertung, checkFragen, dringlichkeit, drittstaat, ereignisseAusStand, folgeAntworten, offeneVoraussetzungen, profilMitStand, type Profil } from "../src/pflichten/check";

const finde = (a: ReturnType<typeof auswertung>, id: string) => [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt].find((p) => p.id === id);
const ids = (l: { id: string }[]) => l.map((p) => p.id);
const leer = { erledigt: {}, unterlagen: [], betrieb: LEERER_STAND.betrieb };

describe("R11: Branchen nach dem SchwarzArbMoDiG", () => {
  const salon: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "SN", "beschaeftigte.gesamt": 2, "beschaeftigte.minijob": 0, gruendungsdatum: "2026-08-01" };
  it("ein Salon bekommt Sofortmeldung, § 17 MiLoG und den Ausweis-Hinweis allein über die Branche", () => {
    const a = auswertung(salon, "2026-10-20");
    for (const id of ["personal.sofortmeldung", "personal.arbeitszeit_milog", "personal.ausweis_hinweis"]) expect(ids(a.gilt), id).toContain(id);
    // „Warum für dich“ nennt die Branche, nicht nur Minijobs
    expect(finde(a, "personal.arbeitszeit_milog")!.grund).toContain("Friseur und Kosmetik");
  });
  it("die Sofortmelde-Frage kommt ab einer beschäftigten Person – außer bei Beauty und Gebäudereinigung", () => {
    const reinigung: Profil = { ...salon, "taetigkeit.branchen": ["sonstige"] };
    expect(checkFragen(reinigung).map((f) => f.feld)).toContain("personal.sofortmeldebranchen");
    expect(checkFragen(salon).map((f) => f.feld)).not.toContain("personal.sofortmeldebranchen");
  });
});

describe("R11: Gründerin Foodtruck", () => {
  const truck: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BW", "beschaeftigte.gesamt": 0, gruendungsdatum: "2026-12-01", "ifsg.selbst": "erstmals", "erlaubnis.gewo_paragraphen": ["55"], "erlaubnis.gaststaette": true, "erlaubnis.alkohol": false };
  it("eigene IfSG-Bescheinigung, Reisegewerbekarte und Lebensmittelregistrierung vor dem Start, keine Gaststättenerlaubnis ohne Alkohol", () => {
    const a = auswertung(truck, "2026-10-20");
    for (const id of ["branche.gastro_ifsg_bescheinigung_selbst", "gruendung.reisegewerbekarte", "branche.gastro_lebensmittelregistrierung"]) expect(finde(a, id)?.naechsterTermin, id).toBe("2026-11-30");
    expect(ids(a.gilt)).not.toContain("gruendung.erlaubnis_pruefen");
  });
  it("Gründungsschritte: ELSTER-Konto vor dem Fragebogen, Fragebogen erst nach ELSTER abhakbar", () => {
    const a = auswertung(truck, "2026-10-20");
    const reihe = ids(a.gilt);
    expect(reihe.indexOf("gruendung.elster_konto")).toBeLessThan(reihe.indexOf("gruendung.fragebogen_steuerliche_erfassung"));
    const fb = finde(a, "gruendung.fragebogen_steuerliche_erfassung")!;
    expect(ids(offeneVoraussetzungen(fb, a, leer))).toEqual(["gruendung.elster_konto"]);
    expect(offeneVoraussetzungen(fb, a, { ...leer, erledigt: { "gruendung.elster_konto": "2026-10-20" } })).toEqual([]);
    // Gewerbeanzeige ist erst mit der Bestätigung erledigt, nicht mit dem Datenblatt
    expect(finde(a, "gruendung.gewerbeanzeige")!.erledigung.art).toBe("bestaetigen");
  });
  it("vor dem Start keine Fragen zum Vorjahr; bei Gastronomie Reisegewerbe, Gaststätte und Arbeitslosengeld im Kern-Check", () => {
    const felder = checkFragen(truck, ["umsatz.vorjahr", "ust.zahllast_vorjahr", "vorauszahlung.gewst", "erlaubnis.gewo_paragraphen", "erlaubnis.alkohol", "alg1_bezug"]).map((f) => f.feld);
    expect(felder).toEqual(["erlaubnis.gewo_paragraphen", "erlaubnis.alkohol", "alg1_bezug"]);
  });
  it("Kassenmeldung erst ab der Anschaffung", () => {
    const mitKasse: Profil = { ...truck, "kasse.elektronisch": true, "kasse.angeschafft_am": "2026-11-25" };
    expect(ereignisseAusStand(mitKasse, "2026-10-20")).toContainEqual({ typ: "kasse_angeschafft", datum: "2026-11-25" });
    const p = finde(auswertung(mitKasse, "2026-10-20"), "steuern.kassenmeldung")!;
    expect(p.naechsterTermin).toBe("2026-12-28");
    expect(ids(dringlichkeit(auswertung(mitKasse, "2026-10-20"), leer, "2026-10-20").jetzt)).not.toContain("steuern.kassenmeldung");
  });
});

describe("R11: Gebäudereinigung, Tischlerei, Kosmetik", () => {
  it("Drittstaaten aus der Staatsangehörigkeit gespeicherter Mitarbeiter", () => {
    expect(drittstaat("syrisch")).toBe(true);
    expect(drittstaat("deutsch, türkisch")).toBe(false);
    expect(drittstaat("Polnisch")).toBe(false);
    expect(drittstaat("")).toBe(false);
    const p = profilMitStand({ "beschaeftigte.gesamt": 2 }, "2026-10-20", [{ name: "Amira", staatsangehoerigkeit: "syrisch" }]);
    expect(p["personal.drittstaaten"]).toBe(true);
  });
  it("Sofortmeldung bleibt „jetzt dran“, auch wenn das Lohnbüro meldet", () => {
    const reinigung: Profil = { "taetigkeit.branchen": ["gebaeudereinigung"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "NW", "beschaeftigte.gesamt": 4, "personal.lohn_durch": "lohnbuero", gruendungsdatum: "2026-10-19" };
    const a = auswertung(reinigung, "2026-10-20");
    expect(ids(dringlichkeit(a, leer, "2026-10-20").jetzt)).toContain("personal.sofortmeldung");
  });
  it("GmbH: keine Frage „Gewerbe oder freier Beruf“, unklare Pflichten als Bedingung", () => {
    expect(folgeAntworten("rechtsform", "gmbh", {})).toEqual({ "taetigkeit.einordnung": "gewerbe" });
    expect(checkFragen({ rechtsform: "gmbh" }, ["taetigkeit.einordnung"]).length).toBe(0);
    const a = auswertung({ rechtsform: "einzelunternehmen", "taetigkeit.branchen": ["handwerk"], bundesland: "BY", "beschaeftigte.gesamt": 0, gruendungsdatum: "2015-01-01" }, "2026-10-20");
    for (const p of a.unbekannt.filter((x) => x.grund)) expect(p.grund, p.id).toMatch(/^Gilt, wenn das zutrifft: /);
  });
});
