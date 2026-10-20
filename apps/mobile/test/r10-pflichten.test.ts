/**
 * Runde 10: Befunde aus Rechts- und Steuerprüfung und den Nutzertests zum Pflichten-Check – Erledigung laufender
 * Pflichten, Bestätigung statt PDF, Alter aus „Mitarbeiter“, Einstellungs-Pflichten, Lohnbüro, getrennte Zählung.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, erledigtSetzen } from "../src/unterlagen/speicher";
import { auswertung, dringlichkeit, erinnerungsPlan, gueltigBis, istErledigt, offeneFragenNachWirkung, profilMitStand, zaehlung, type Profil } from "../src/pflichten/check";

const betrieb = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", strasse: "Venloer Str. 1", plz: "50823", ort: "Köln", verantwortlich: "Mehmet Yıldız" };
const cafe: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "NW", "beschaeftigte.gesamt": 6, "beschaeftigte.minijob": 6, "kasse.elektronisch": true, "online.website": true, "ust.kleinunternehmer": false, gruendungsdatum: "2019-03-01" };
const salon: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "kasse.elektronisch": true, "online.website": false, "ust.kleinunternehmer": false, gruendungsdatum: "2014-04-01" };
const finde = (a: ReturnType<typeof auswertung>, id: string) => [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt].find((p) => p.id === id);

describe("R10 Pflichten-Check", () => {
  it("Kassenmeldung: ein geteiltes Datenblatt erledigt nichts, nur die Bestätigung „In ELSTER gemeldet“", () => {
    const a = auswertung(cafe, "2026-10-20");
    const p = finde(a, "steuern.kassenmeldung")!;
    expect(p.erledigung).toEqual({ art: "bestaetigen", bestaetigung: "In ELSTER gemeldet" });
    const pdf = { vorlage: "kassenmeldung", daten: {}, ausgegeben: "2026-10-01T10:00:00Z" };
    expect(istErledigt(p, { erledigt: {}, unterlagen: [pdf], betrieb })).toBe(false);
    expect(istErledigt(p, { ...erledigtSetzen(LEERER_STAND, p.id, "2026-10-20"), unterlagen: [], betrieb })).toBe(true);
  });

  it("HACCP und Arbeitszeit: laufend – ein Haken gilt nur für seinen Monat", () => {
    const a = auswertung(cafe, "2026-10-20");
    for (const id of ["branche.gastro_haccp", "personal.arbeitszeit_milog"]) {
      const p = finde(a, id)!;
      expect(p.erledigung, id).toEqual({ art: "laufend", zeitraum: "monat" });
      const s = { ...erledigtSetzen(LEERER_STAND, id, "2026-10-05"), unterlagen: [], betrieb };
      expect(istErledigt(p, { ...s, heute: "2026-10-31" }), id).toBe(true);
      expect(istErledigt(p, { ...s, heute: "2026-11-01" }), id).toBe(false);
    }
  });

  it("Prüfung elektrischer Geräte: erledigt bis zur nächsten Prüfung aus dem Protokoll", () => {
    const a = auswertung({ ...salon, "arbeitsschutz.elektrische_geraete": true }, "2026-10-20");
    const p = finde(a, "arbeitsschutz.dguv_v3")!;
    expect(p.erledigung.naechsterTerminAus).toBe("geraete.naechste");
    const u = { vorlage: "pruefprotokoll_elektro", daten: { datum: "2026-07-20", geraete: [{ bezeichnung: "Föhn", naechste: "2027-01-20" }, { bezeichnung: "Glätteisen", naechste: "2027-07-20" }] }, ausgegeben: "2026-07-20T10:00:00Z" };
    expect(gueltigBis(u, "geraete.naechste")).toBe("2027-01-20");
    // ohne Datum: Richtwert der gewählten Einsatzbedingungen (Baustellen: 3 Monate)
    expect(gueltigBis({ ...u, daten: { datum: "2026-07-20", einsatz: "baustellen", geraete: [{ bezeichnung: "Bohrmaschine" }] } }, "geraete.naechste")).toBe("2026-10-20");
  });

  it("Jugendarbeitsschutz: „unter 18“ aus dem Geburtsdatum der Mitarbeiter (Nutzertest Sabine)", () => {
    const lena = { name: "Lena", geburtsdatum: "2009-03-12", beginn: "2025-09-01" };
    expect(profilMitStand(salon, "2026-10-20", [lena])["beschaeftigte.jugendlich"]).toBe(1);
    expect(profilMitStand(salon, "2027-03-12", [lena])["beschaeftigte.jugendlich"]).toBeUndefined();
    expect(auswertung(salon, "2026-10-20", [], [lena]).gilt.map((p) => p.id)).toContain("personal.jugendarbeitsschutz");
    expect(finde(auswertung(salon, "2026-10-20"), "personal.jugendarbeitsschutz")).toBeDefined();
    expect(auswertung(salon, "2026-10-20").gilt.map((p) => p.id)).not.toContain("personal.jugendarbeitsschutz");
  });

  it("Lohnbüro: Lohn-Termine stehen nicht bei „Jetzt dran“ und nicht in den Erinnerungen", () => {
    const mit = { ...salon, "personal.lohn_durch": "lohnbuero" };
    const heute = "2026-10-20";
    const a = auswertung(mit, heute);
    const nachweis = a.gilt.find((p) => p.id === "personal.beitragsnachweis")!;
    expect(nachweis.lohnbuero).toBe(true);
    const leer = { erledigt: {}, unterlagen: [], betrieb };
    expect(dringlichkeit(a, leer, heute).jetzt.map((p) => p.id)).not.toContain("personal.beitragsnachweis");
    expect(erinnerungsPlan(a, leer, heute).map((e) => e.pflichtId)).not.toContain("personal.beitragsnachweis");
    expect(auswertung(salon, heute).gilt.find((p) => p.id === "personal.beitragsnachweis")!.lohnbuero).toBe(false);
  });

  it("zählt Pflichten, Hinweise und Optionen getrennt; die Überschrift zählt nur Termine", () => {
    const gruender: Profil = { ...salon, gruendungsdatum: "2026-09-01", alg1_bezug: true, rechtsform: "gmbh" };
    const a = auswertung(gruender, "2026-10-20");
    const z = zaehlung(a.gilt);
    expect(z.pflichten + z.hinweise + z.optionen).toBe(a.gilt.length);
    expect(z.hinweise).toBeGreaterThan(0);
    expect(a.gilt.find((p) => p.id === "gesellschaft.insolvenzantragspflicht")?.einordnung).toBe("hinweis");
    const d = dringlichkeit(a, { erledigt: {}, unterlagen: [], betrieb }, "2026-10-20");
    expect(d.termine + d.ohneTermin).toBe(d.jetzt.length);
    for (const p of d.jetzt.filter((x) => !x.naechsterTermin)) expect(p.einordnung, p.id).toBe("pflicht");
  });

  it("Umsatzsteuer-Voranmeldung: über der Kleinunternehmergrenze gilt sie, gefragt wird nach dem Rhythmus", () => {
    const p = { ...salon, "umsatz.vorjahr": 210000 };
    const a = auswertung(p, "2026-10-20");
    const va = a.gilt.find((x) => x.id === "steuern.ust_voranmeldung");
    expect(va).toBeDefined();
    expect(va!.termine).toEqual([]);
    expect(offeneFragenNachWirkung(a, p).map((o) => o.feld)).toContain("ust.voranmeldung_rhythmus");
    const monatlich = auswertung({ ...p, "ust.voranmeldung_rhythmus": "monatlich" }, "2026-10-20").gilt.find((x) => x.id === "steuern.ust_voranmeldung");
    expect(monatlich!.naechsterTermin).toBe("2026-11-10");
  });

  it("Unterweisung vor Arbeitsbeginn je neu eingestellter Person (Nutzertest Jonas)", () => {
    const team = [{ name: "Leon Hagedorn", beginn: "2026-09-01" }, { name: "Dennis K.", beginn: "2026-09-15" }, { name: "Tobias R.", beginn: "2021-03-01" }];
    const a = auswertung({ ...salon, "taetigkeit.branchen": ["handwerk"] }, "2026-10-20", [], team);
    const p = a.gilt.find((x) => x.id === "arbeitsschutz.erstunterweisung")!;
    expect(p.personen).toEqual(["Leon Hagedorn", "Dennis K."]);
    const u = (namen: string[]) => ({ vorlage: "unterweisung", ausgegeben: "2026-09-01T08:00:00Z", daten: { thema: "Erstunterweisung", anlass: "erstunterweisung", datum: "2026-09-01", durchgefuehrt_von: "Jonas Becker", themen: ["a"], teilnehmer: namen.map((name) => ({ name })) } });
    const nur = { erledigt: {}, unterlagen: [u(["Leon Hagedorn"])], betrieb, heute: "2026-10-20" };
    expect(istErledigt(p, nur)).toBe(false);
    expect(istErledigt(p, { ...nur, unterlagen: [u(["Leon Hagedorn"]), u(["dennis k."])] })).toBe(true);
  });

  it("Elektrogeräte und Batterien erst, wenn sie selbst erstmals in Deutschland in Verkehr gebracht werden", () => {
    const elektro: Profil = { ...salon, "taetigkeit.branchen": ["handwerk"], "produkte.arten": ["elektrogeraete", "batterien"] };
    const ids = (pr: Profil) => auswertung(pr, "2026-10-20").gilt.map((p) => p.id);
    expect(ids({ ...elektro, "produkte.erstinverkehrbringer": false })).not.toEqual(expect.arrayContaining(["produkte.elektrogeraete"]));
    expect(ids({ ...elektro, "produkte.erstinverkehrbringer": true })).toEqual(expect.arrayContaining(["produkte.elektrogeraete", "produkte.batterien"]));
  });
});
