/**
 * E-227 (Steuerberater 27.10.2026, T-307/T-308/T-309): Tag des Erwerbs am Beleg – Zuordnung nach § 13 Abs. 1 Nr. 6 UStG
 * (Rechnungsdatum, höchstens Ende des Monats nach dem Erwerb), DATEV-Erwerbskonten als Standard, Feld 116, Feld 40 leer,
 * Vermerk „Nicht vollständig“ auf dem PDF der Voranmeldung, Summe der Erwerbe je Jahr für die Erwerbsschwelle.
 */
import { describe, expect, it } from "vitest";
import {
  belegAus,
  belegFassung,
  belegInhaltGeaendert,
  buchungenAusBelegen,
  datevExtf,
  DATEV_EU_USTID,
  DATEV_STEUERPERIODE,
  dokumentHtml,
  igErwerbOhneKonto,
  igeErwerbeImJahr,
  igeSteuerTag,
  kontenFuer,
  KONTENVORGABE_FELDER,
  LEERER_BETRIEB,
  letzterTagFolgemonat,
  steuerschuldFuer,
  ustNichtVollstaendig,
  vorlageFuer,
  vorlageGeprueft,
  type Beleg,
} from "../src/index.js";

const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-03-10", lieferant: "Fournitures SARL", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100000 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, quelle: "hand", erstellt: "2026-03-10T09:00:00Z", geaendert: "2026-03-10T09:00:00Z", steuerschuld: "ige", ...o }) as Beleg;

describe("E-227: Tag des Erwerbs (§ 13 Abs. 1 Nr. 6 UStG)", () => {
  it("letzter Tag des Folgemonats, auch über Jahres- und Schaltjahresgrenzen", () => {
    expect(letzterTagFolgemonat("2026-01-31")).toBe("2026-02-28");
    expect(letzterTagFolgemonat("2028-01-05")).toBe("2028-02-29");
    expect(letzterTagFolgemonat("2026-11-15")).toBe("2026-12-31");
    expect(letzterTagFolgemonat("2026-12-01")).toBe("2027-01-31");
  });

  it("Rechnungsdatum zählt bis zum Ende des Monats nach dem Erwerb, danach dieser Tag; ohne Erwerbstag das Belegdatum", () => {
    expect(igeSteuerTag({ datum: "2026-03-10", erwerb_datum: "2026-02-20" })).toBe("2026-03-10");
    expect(igeSteuerTag({ datum: "2026-03-31", erwerb_datum: "2026-02-20" })).toBe("2026-03-31");
    expect(igeSteuerTag({ datum: "2026-04-02", erwerb_datum: "2026-02-20" })).toBe("2026-03-31");
    expect(igeSteuerTag({ datum: "2026-05-15", erwerb_datum: "2026-02-20" })).toBe("2026-03-31");
    // Rechnung fehlt (kein gültiges Belegdatum): Monat nach dem Erwerb
    expect(igeSteuerTag({ datum: "", erwerb_datum: "2026-02-20" })).toBe("2026-03-31");
    expect(igeSteuerTag({ datum: "2026-05-15" })).toBe("2026-05-15");
  });

  it("Voranmeldung: späte Rechnung zählt im Monat nach dem Erwerb, nicht im Monat der Rechnung", () => {
    const b = beleg({ datum: "2026-05-15", erwerb_datum: "2026-02-20" });
    expect(steuerschuldFuer([b], "2026-03-01", "2026-03-31")).toMatchObject({ ige_19_netto_cent: 100000, ige_anzahl: 1, ige_ohne_erwerbsdatum: 0 });
    expect(steuerschuldFuer([b], "2026-05-01", "2026-05-31")).toMatchObject({ ige_19_netto_cent: 0, ige_anzahl: 0 });
    // rechtzeitige Rechnung: Monat der Rechnung
    expect(steuerschuldFuer([beleg({ datum: "2026-03-10", erwerb_datum: "2026-02-20" })], "2026-03-01", "2026-03-31").ige_anzahl).toBe(1);
    // ohne Erwerbstag: nach Belegdatum und gezählt (Annahme auf dem PDF)
    expect(steuerschuldFuer([beleg({ datum: "2026-05-15" })], "2026-05-01", "2026-05-31")).toMatchObject({ ige_anzahl: 1, ige_ohne_erwerbsdatum: 1 });
    // § 13b bleibt beim Belegdatum, auch mit (falsch gesetztem) Erwerbstag
    expect(steuerschuldFuer([beleg({ steuerschuld: "eu", datum: "2026-05-15", erwerb_datum: "2026-02-20" })], "2026-05-01", "2026-05-31").anzahl).toBe(1);
  });

  it("Tag des Erwerbs gehört zum Inhalt: gespeichert, in der Fassung, Änderung erkannt; ältere Fassungen unverändert", () => {
    const b = beleg({ erwerb_datum: "2026-02-20" });
    expect(belegAus({ ...b })?.erwerb_datum).toBe("2026-02-20");
    expect(belegAus({ ...b, erwerb_datum: "20.02.2026" })).not.toHaveProperty("erwerb_datum");
    expect(belegFassung(b, "x").erwerb_datum).toBe("2026-02-20");
    expect(belegInhaltGeaendert(b, { ...b, erwerb_datum: "2026-02-21" })).toBe(true);
    // ohne Erwerbstag kein Feld in der Fassung – das Protokoll älterer Belege bleibt gleich
    expect(belegFassung(beleg({}), "x")).not.toHaveProperty("erwerb_datum");
  });

  it("Summe der Erwerbe eines Jahres nach dem Tag des Erwerbs (für die Erwerbsschwelle)", () => {
    const l = [beleg({ id: "a", datum: "2026-01-10", erwerb_datum: "2025-12-20" }), beleg({ id: "b", datum: "2026-02-01", steuer: [{ satz: 7, brutto_cent: 5000 }] }), beleg({ id: "c", datum: "2026-02-02", ungueltig: "2026-02-03T00:00:00Z" }), beleg({ id: "d", steuerschuld: "eu" })];
    expect(igeErwerbeImJahr(l, "2025")).toBe(100000);
    expect(igeErwerbeImJahr(l, "2026")).toBe(5000);
  });
});

describe("E-227: DATEV-Stapel (T-307)", () => {
  it("Erwerbskonten als Standard: 3425/3420 mit, 3435/3430 ohne Vorsteuer (SKR04 5425/5420/5435/5430)", () => {
    expect(kontenFuer("SKR03").igErwerb).toEqual({ mit: { 19: "3425", 7: "3420" }, ohne: { 19: "3435", 7: "3430" } });
    expect(kontenFuer("SKR04").igErwerb).toEqual({ mit: { 19: "5425", 7: "5420" }, ohne: { 19: "5435", 7: "5430" } });
    const b = beleg({ steuer: [{ satz: 19, brutto_cent: 100000 }, { satz: 7, brutto_cent: 20000 }] });
    expect(buchungenAusBelegen([b], "SKR03").map((x) => x.gegenkonto)).toEqual(["3425", "3420"]);
    expect(buchungenAusBelegen([b], "SKR04", { kleinunternehmer: true }).map((x) => x.gegenkonto)).toEqual(["5435", "5430"]);
    expect(buchungenAusBelegen([beleg({ vorsteuer: false })], "SKR03").map((x) => [x.gegenkonto, x.bu_schluessel])).toEqual([["3435", ""]]);
    expect(igErwerbOhneKonto([b], "SKR03")).toEqual([]);
    expect(igErwerbOhneKonto([b], "SKR03", { kleinunternehmer: true })).toEqual([]);
    // weiter änderbar
    expect(buchungenAusBelegen([beleg({})], "SKR03", { vorgaben: { konten: { igErwerb19: "3999" } } })[0]?.gegenkonto).toBe("3999");
    // andere Sätze (16 % aus 2020) haben weiter kein Konto
    expect(igErwerbOhneKonto([beleg({ steuer: [{ satz: 16, brutto_cent: 1000 }] })], "SKR03").map((x) => x.satz)).toEqual([16]);
  });

  it("keine „noch nicht bestätigt“-Hinweise mehr bei den Erwerbskonten", () => {
    const t = KONTENVORGABE_FELDER.filter((f) => f.id.startsWith("igErwerb")).map((f) => f.hilfe ?? "").join(" ");
    expect(t).not.toMatch(/nicht von der Steuerberatung bestätigt|Kein Standard|fehlen diese Buchungen/);
    expect(t).toContain("3420");
    expect(t).toContain("5435");
  });

  it("Buchungsdatum = Belegdatum; Feld 116 = letzter Tag des Monats nach dem Erwerb, wenn die Rechnung später kam; Feld 40 leer", () => {
    const spaet = beleg({ id: "s", datum: "2026-05-15", erwerb_datum: "2026-02-20", lieferant_ust_idnr: "FR12345678901" });
    const recht = beleg({ id: "r", datum: "2026-05-10", erwerb_datum: "2026-04-20" });
    const z = buchungenAusBelegen([spaet, recht], "SKR03");
    expect(z.map((x) => [x.datum, x.steuerperiode ?? null])).toEqual([["2026-05-15", "2026-03-31"], ["2026-05-10", null]]);
    const csv = datevExtf(z, { wjBeginn: "2026-01-01", von: "2026-05-01", bis: "2026-05-31", kontenrahmen: "SKR03", erzeugtAm: "2026-06-01T08:00:00" }).split("\r\n");
    const felder = csv[2]!.split(";");
    expect(felder[DATEV_STEUERPERIODE]).toBe("31032026");
    expect(felder[DATEV_EU_USTID]).toBe("");
    expect(csv[3]!.split(";")[DATEV_STEUERPERIODE]).toBe("");
  });

  it("Erwerbe ohne festgestellte Erwerbsbesteuerung (igeNichtBuchen) stehen nicht im Stapel und nicht in der Liste ohne Konto", () => {
    const b = beleg({});
    expect(buchungenAusBelegen([b], "SKR03", { kleinunternehmer: true, igeNichtBuchen: new Set(["b1"]) })).toEqual([]);
    expect(igErwerbOhneKonto([beleg({ steuer: [{ satz: 16, brutto_cent: 1000 }] })], "SKR03", { igeNichtBuchen: new Set(["b1"]) })).toEqual([]);
  });
});

describe("E-227: Voranmeldung – Vermerk „Nicht vollständig“ (T-308)", () => {
  it("Wortlaut des Steuerberaters je Art", () => {
    expect(ustNichtVollstaendig(2, "ige")).toBe("Nicht vollständig: 2 Belege ohne Euro-Betrag (innergemeinschaftlicher Erwerb) fehlen");
    expect(ustNichtVollstaendig(1, "13b")).toBe("Nicht vollständig: 1 Belege ohne Euro-Betrag (§ 13b) fehlen");
  });

  it("steht sichtbar oben auf dem PDF, vor den Kennzahlen; ohne Eintrag kein Abschnitt", () => {
    const v = vorlageFuer("ust_voranmeldung")!;
    const zeile = ustNichtVollstaendig(1, "ige");
    const h = dokumentHtml(v, { versteuerung: "soll", zeitraum: "März 2026", umsatz_19: "100,00", vorsteuer: "0,00", unvollstaendig: zeile }, { ...LEERER_BETRIEB, name: "Test" });
    expect(h).toContain(`<strong>${zeile}</strong>`);
    expect(h.indexOf(zeile)).toBeLessThan(h.indexOf("Steuerpflichtige Umsätze"));
    expect(dokumentHtml(v, { versteuerung: "soll", zeitraum: "März 2026", umsatz_19: "100,00", vorsteuer: "0,00" }, { ...LEERER_BETRIEB, name: "Test" })).not.toContain("Nicht vollständig");
  });

  it("die so geänderte Vorlage ist vom Steuerberater freigegeben (Vermerk erscheint wieder)", () => {
    const f = vorlageGeprueft(vorlageFuer("ust_voranmeldung")!);
    expect(f?.rolle).toBe("steuern");
    expect(f?.stand).toBe("2026-10-27");
    expect(f?.nachweis?.umfang).toContain("Voranmeldung mit Erwerben aus Belegen und Vermerk ‚Nicht vollständig‘");
  });
});
