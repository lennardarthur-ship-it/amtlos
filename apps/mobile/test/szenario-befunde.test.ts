/**
 * Befunde aus den Jahres-Szenarien Salon (GmbH, Ist) und Freiberuf (Kleinunternehmerin), Oktober 2026: Gutschriften
 * zählen nicht als Umsatz (EÜR, DATEV, Rechnungsliste, Voranmeldung), Kleinunternehmer übernehmen keine Voranmeldung
 * und starten Belege ohne Vorsteuer, LIESMICH nach Soll/Ist und Kleinunternehmer, EÜR-Warnung für Kapitalgesellschaften,
 * alle Vorlagen je Pflicht.
 */
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { EUER_KAPITALGESELLSCHAFT } from "@amtlos/fachlogik";
import { auswertung } from "../src/pflichten/check";
import { monatsSumme, offeneSumme } from "../src/unterlagen/ablage";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, leererBeleg, stornieren, type Stand } from "../src/unterlagen/speicher";
import { EUER_NICHT_ENTHALTEN, euerUebernahme, istKleinunternehmer, steuerpaket } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Mira Lindqvist – Grafikdesign", strasse: "Wiesenweg 4", plz: "79098", ort: "Freiburg", email: "hallo@mira.example", telefon: "0761 1", steuernummer: "06/123/45678", iban: "DE89370400440532013000" };
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const JAHR = { von: "2026-01-01", bis: "2026-12-31", name: "2026" };

function rechnung(s: Stand, id: string, datum: string, preis: string, o: { bezahlt?: string; ku?: boolean; gutschrift?: boolean; kunde?: string } = {}): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  let s2 = felderSetzen(s1, id, { datum, kunde_name: o.kunde ?? "Verlag Nord GmbH", kunde_anschrift: "Hafenstraße 3\n20457 Hamburg", kunde_email: "re@verlag.example", kleinunternehmer: Boolean(o.ku), hinweise: o.gutschrift ? ["gutschrift"] : [], positionen: [{ bezeichnung: "Leistung", menge: "1", einheit: "", preis, satz: "19" }] }, t(datum));
  s2 = ausgeben(s2, id, t(datum));
  return o.bezahlt ? bezahltSetzen(s2, id, o.bezahlt) : s2;
}

/** Kleinunternehmerin mit zwei Rechnungen und einer Gutschrift an einen Fotografen. */
function freiberuf(profilKu: boolean | undefined = true): Stand {
  let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, profil: profilKu === undefined ? {} : { "ust.kleinunternehmer": profilKu } };
  s = rechnung(s, "r1", "2026-03-10", "1.000,00", { bezahlt: "2026-03-20", ku: true });
  s = rechnung(s, "r2", "2026-06-10", "500,00", { bezahlt: "2026-06-25", ku: true });
  s = rechnung(s, "g1", "2026-09-03", "700,00", { bezahlt: "2026-09-10", ku: true, gutschrift: true, kunde: "Jonas Kiefer Fotografie" });
  return s;
}

describe("Gutschrift ist für den Aussteller eine Ausgabe", () => {
  it("EÜR-Übernahme: keine Einnahme, Hinweis sichtbar; nicht als unbezahlt gezählt", () => {
    let s = freiberuf();
    s = rechnung(s, "g2", "2026-10-01", "100,00", { ku: true, gutschrift: true, kunde: "Jonas Kiefer Fotografie" }); // ohne Zahlungsvermerk
    const e = euerUebernahme(s, "2026");
    expect(e.einnahmen).toEqual([{ datum: "", text: "Umsätze aus Rechnungen", kategorie: "Umsatzsteuerlicher Kleinunternehmer", betrag: "1.500,00" }]);
    expect(e.rechnungen).toBe(2);
    expect(e.gutschriften).toBe(2);
    expect(e.unbezahlt).toBe(0);
    expect(e.hinweis).toContain("Gutschriften sind Ausgaben: Mit Zahlungsvermerk übernimmt Amtlos sie");
    expect(e.hinweis).toContain(EUER_NICHT_ENTHALTEN);
    // R10: die bezahlte Gutschrift (700 €) ist eine Ausgabe „Bezogene Leistungen“, die unbezahlte fehlt noch
    expect(e.ausgaben).toContainEqual({ datum: "", text: "Gutschriften an Leistende (1 Gutschrift)", kategorie: "Bezogene Leistungen", betrag: "700,00" });
    // ohne Gutschrift: Hinweis wie bisher
    const ohne = euerUebernahme({ ...s, unterlagen: s.unterlagen.filter((u) => !u.id.startsWith("g")) }, "2026");
    expect(ohne.hinweis).toBe(EUER_NICHT_ENTHALTEN);
  });

  it("Steuerberater-Paket: eigene Liste der Gutschriften, nicht in Rechnungsliste und DATEV-Erlösen; Hinweis im LIESMICH", () => {
    const s = freiberuf();
    const p = steuerpaket(s, JAHR, SB, {}, "2027-01-20T12:00:00.000Z");
    expect(p).toMatchObject({ rechnungen: 2, gutschriften: 1 });
    const inhalt = unzipSync(p.zip);
    const re = strFromU8(inhalt["Rechnungen_2026.csv"]!);
    expect(re).toContain("2026-001;");
    expect(re).not.toContain("2026-003;");
    const gs = strFromU8(inhalt["Gutschriften_2026.csv"]!);
    expect(gs).toContain("Leistender (Empfänger der Gutschrift)");
    expect(gs).toContain("2026-003;03.09.2026;03.09.2026;;Jonas Kiefer Fotografie;;§ 19;700,00;0,00;700,00;§ 19;17.09.2026;10.09.2026;0,00;");
    const datev = strFromU8(inhalt["Buchungsliste_2026.csv"]!);
    // R10: Gutschrift als Aufwand (bezogene Leistungen), nicht als Erlös
    expect(datev).toMatch(/;700,00;S;3100;1610;;2026-003;Gutschrift 2026-003 Jonas Kiefer Fotografie;/);
    expect(datev).toContain("Verlag Nord");
    const liesmich = strFromU8(inhalt["LIESMICH.txt"]!);
    expect(liesmich).toContain("Gutschriften_2026.csv: 1 Gutschrift");
    expect(liesmich).toContain("im Buchungsstapel als Aufwand (bezogene Leistungen)");
    // die XRechnung der Gutschrift bleibt im Paket (Rechnungsart unverändert, fachlich offen)
    expect(Object.keys(inhalt).filter((k) => k.startsWith("E-Rechnungen/"))).toHaveLength(3);
    // ohne Gutschrift keine leere Liste
    const ohne = unzipSync(steuerpaket({ ...s, unterlagen: s.unterlagen.filter((u) => u.id !== "g1") }, JAHR, SB, {}, "2027-01-20T12:00:00.000Z").zip);
    expect(Object.keys(ohne)).not.toContain("Gutschriften_2026.csv");
  });

  it("Voranmeldung, Monatssumme und offene Rechnungen: Gutschriften zählen nicht", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    s = rechnung(s, "r1", "2026-10-05", "100,00");
    s = rechnung(s, "g1", "2026-10-06", "50,00", { gutschrift: true });
    const okt = umsaetzeFuer(s.unterlagen, "2026-10", s.betrieb)!;
    expect(okt.werte.umsatz_19).toBe("100,00");
    expect(okt).toMatchObject({ anzahl: 1, gutschriften: 1, kleinunternehmer: false });
    expect(monatsSumme(s.unterlagen, s.betrieb, "2026-10")).toEqual({ anzahl: 1, cent: 11900 });
    expect(offeneSumme(s.unterlagen, s.betrieb).anzahl).toBe(1);
  });
});

describe("Kleinunternehmer", () => {
  it("Voranmeldung „Aus Rechnungen übernehmen“: nichts übernommen (auch ohne Antwort im Check, wenn alle Rechnungen § 19 sind)", () => {
    const s = freiberuf();
    const q1 = umsaetzeFuer(s.unterlagen, "2026-Q1", s.betrieb, "soll", [], true)!;
    expect(q1.kleinunternehmer).toBe(true);
    expect(q1.werte).toEqual({ zeitraum: "1. Quartal 2026" });
    expect(umsaetzeFuer(s.unterlagen, "2026-Q1", s.betrieb)!.kleinunternehmer).toBe(true);
    // R10 (Lea, Befund 4): Check heute „regelbesteuert“, alle Rechnungen des Zeitraums aber § 19 – der Zeitraum zählt
    const regel = umsaetzeFuer(s.unterlagen, "2026-Q1", s.betrieb, "soll", [], false)!;
    expect(regel.kleinunternehmer).toBe(true);
    expect(regel.werte).toEqual({ zeitraum: "1. Quartal 2026" });
  });

  it("istKleinunternehmer: Antwort im Check, sonst aus den Rechnungen", () => {
    expect(istKleinunternehmer(freiberuf(true))).toBe(true);
    expect(istKleinunternehmer(freiberuf(false))).toBe(false);
    expect(istKleinunternehmer(freiberuf(undefined))).toBe(true);
    expect(istKleinunternehmer({ ...LEERER_STAND })).toBe(false);
  });

  it("neuer Beleg startet ohne Vorsteuerabzug", () => {
    expect(leererBeleg("hand", null, true).vorsteuer).toBe(false);
    expect(leererBeleg("hand", null).vorsteuer).toBe(true);
    expect(leererBeleg("foto", "a.jpg", false, t("2026-10-20"))).toMatchObject({ datum: "2026-10-20", datei: "a.jpg", quelle: "foto", vorsteuer: true });
  });

  it("LIESMICH: kein Satz zur Voranmeldung", () => {
    const liesmich = strFromU8(unzipSync(steuerpaket(freiberuf(), JAHR, SB, {}, "2027-01-20T12:00:00.000Z").zip)["LIESMICH.txt"]!);
    expect(liesmich).not.toContain("Umsatzsteuer-Voranmeldung");
  });
});

describe("Soll/Ist und Kapitalgesellschaft", () => {
  const gmbh = (versteuerung: string): Stand => {
    let s: Stand = { ...LEERER_STAND, betrieb: { ...BETRIEB, name: "Salon Sonne GmbH", rechtsform: "GmbH", vertretung: "Alex Sonnberg", versteuerung }, steuerberatung: SB };
    s = rechnung(s, "r1", "2026-05-15", "735,00", { bezahlt: "2026-05-28" });
    return s;
  };

  it("LIESMICH erklärt die Zuordnung nach „Mein Betrieb“: Ist nach Zahlungseingang, sonst Soll", () => {
    const text = (s: Stand) => strFromU8(unzipSync(steuerpaket(s, JAHR, SB, {}, "2027-01-20T12:00:00.000Z").zip)["LIESMICH.txt"]!);
    expect(text(gmbh("ist"))).toContain("nach dem Zahlungseingang zu (Ist-Versteuerung, § 20 UStG); eine Stornorechnung zählt mit der vermerkten Erstattung");
    expect(text(gmbh("ist"))).not.toContain("Soll-Versteuerung");
    expect(text(gmbh("soll"))).toMatch(/nach dem Leistungsdatum zu \(Soll-Versteuerung\)/);
    expect(text(gmbh(""))).toMatch(/nach dem Leistungsdatum zu \(Soll-Versteuerung\)/);
  });

  it("EÜR-Übernahme warnt bei Kapitalgesellschaften", () => {
    expect(euerUebernahme(gmbh("ist"), "2026").hinweis.startsWith(EUER_KAPITALGESELLSCHAFT)).toBe(true);
    expect(euerUebernahme(gmbh("ist"), "2026").hinweis).toContain("Kapitalgesellschaften erstellen eine Bilanz statt einer EÜR");
    expect(euerUebernahme({ ...gmbh("ist"), betrieb: { ...gmbh("ist").betrieb, rechtsform: "Einzelunternehmen", name: "Salon Sonne" } }, "2026").hinweis).toBe(EUER_NICHT_ENTHALTEN);
  });

  it("Storno einer Gutschrift zählt ebenfalls nicht", () => {
    let s = freiberuf(false);
    const [s2, st] = stornieren(s, "g1", t("2026-09-20"), "gst");
    s = bezahltSetzen(ausgeben(s2, st!.id, t("2026-09-20")), "gst", "2026-09-25");
    expect(euerUebernahme(s, "2026").einnahmen[0]!.betrag).toBe("1.500,00");
  });
});

describe("Pflichten-Check: alle Vorlagen je Pflicht", () => {
  it("Gefahrstoffe: Gefahrstoffverzeichnis und Betriebsanweisung", () => {
    const profil = { "taetigkeit.branchen": ["beauty"], rechtsform: "gmbh", "beschaeftigte.gesamt": 4, "arbeitsschutz.gefahrstoffe": true, gruendungsdatum: "2025-04-01" };
    const a = auswertung(profil, "2026-01-15");
    const p = [...a.gilt, ...a.unbekannt].find((x) => x.id === "arbeitsschutz.gefahrstoffe");
    expect(p, "Pflicht arbeitsschutz.gefahrstoffe").toBeDefined();
    expect(p!.vorlage).toBe("gefahrstoffverzeichnis");
    expect(p!.vorlagen).toEqual(["gefahrstoffverzeichnis", "betriebsanweisung"]);
    // Pflichten mit einer Vorlage: eine Liste mit genau dieser
    for (const x of a.gilt) expect(x.vorlagen[0] ?? null).toBe(x.vorlage);
  });
});
