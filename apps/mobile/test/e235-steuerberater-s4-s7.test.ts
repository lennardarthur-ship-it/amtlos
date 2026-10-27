/**
 * E-235 (Steuerberater 27.10.2026, Antworten S4 und S7):
 * S4 a) Abschlag auf eine innergemeinschaftliche Lieferung: Liegt bis zum Ende des Monats nach der Lieferung keine
 *       Schlussrechnung vor, ist die Lieferung trotzdem zu melden (§ 18b Satz 2 UStG) – Warnung auf „Heute“, bei
 *       Voranmeldung und ZM (Zeitraum der Meldung) und im Steuerberater-Paket; kein erfundener Betrag in Kz 41/ZM.
 *       EU-Leistungen entsprechend nach § 18b Satz 3 UStG (Zeitraum der Ausführung).
 * S4 b) Ältere Stornos ohne Grund: Auswahl auch für EU-Leistungen; „Fehler in der Rechnung“ ⇒ ZM des ursprünglichen
 *       Zeitraums berichtigen.
 * S7    Textkorrekturen (Erwerbsschwelle „nicht über“, § 1a Abs. 5 UStG, „Forderung uneinbringlich“, Anzahlung bei Soll
 *       und Ist, Überzahlung in der EÜR am Eingangstag, Überzahlung mit Skonto, OSS-Erklärung) und Prüfung der EÜR.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { LEERER_STAND, anlegen, ausgeben, euStornoSetzen, felderSetzen, guthabenVerrechnen, stornieren, zahlungVermerken, zahlungPruefen, type Stand } from "../src/unterlagen/speicher";
import { EU_STORNO_ALT_HINWEIS, EU_STORNO_ALT_HINWEIS_S, euBerichtigungen, euSchlussFehlt, euStornoHinweisListe, euStornosOhneGrund, perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { zmFuer, zmPerioden } from "../src/unterlagen/euMeldungen";
import { einnahmenAusRechnungen, euerUebernahme, steuerpaket } from "../src/unterlagen/steuerpaket";
import { T as TEXT } from "../src/texte";
import type { Daten } from "@amtlos/fachlogik";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", ust_idnr: "DE123456789", iban: "DE89370400440532013000" };
const AT = { kunde_name: "Wiener Kaffee GmbH", kunde_anschrift: "Ring 1\n1010 Wien\nÖsterreich", kunde_email: "re@wien.example", kunde_ust_idnr: "ATU69876543", zahlungsziel: "30" };
const pos = (preis: string) => [{ bezeichnung: "Kaffeeröster", menge: "1", einheit: "Stück", preis, satz: "0" }];
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "31877", mandantennummer: "20514" };
const leer = (betrieb = BETRIEB): Stand => ({ ...LEERER_STAND, betrieb, steuerberatung: SB });

function rechnung(s: Stand, id: string, datum: string, daten: Daten): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  return ausgeben(felderSetzen(s1, id, { datum, leistung_gleich: true, ...AT, ...daten }, t(datum)), id, t(datum));
}
const liesmich = (s: Stand, monat: string) => {
  const ende = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return strFromU8(unzipSync(steuerpaket(s, { von: `${monat}-01`, bis: ende, name: monat }, SB, {}, "2026-11-15T10:00:00").zip)["LIESMICH.txt"]!);
};

/** Abschlag 400 € netto am 10.07.2026 auf eine Lieferung bzw. Leistung, die für den 20.08.2026 vorgesehen ist */
const abschlag = (art: "igl" | "reverse_charge" = "igl") => rechnung(leer(), "a1", "2026-07-10", { nummer: "A-1", abschlag: true, leistung_gleich: false, leistung: "20.08.2026", hinweise: [art], positionen: pos("400,00") });
const schluss = (s: Stand, art: "igl" | "reverse_charge" = "igl", datum = "2026-10-05") => rechnung(s, "r1", datum, { nummer: "R-1", leistung_gleich: false, leistung: "20.08.2026", hinweise: [art], positionen: pos("1.000,00"), schluss: true, abschlaege: [{ nummer: "A-1", netto: "400,00", satz: "0" }] });

describe("E-235 (S4 a): Schlussrechnung fehlt – innergemeinschaftliche Lieferung trotzdem melden (§ 18b Satz 2 UStG)", () => {
  it("Warnung erst nach Ablauf des Monats nach der Lieferung; Zeitraum der Meldung = Monat nach der Lieferung", () => {
    const s = abschlag();
    expect(euSchlussFehlt(s.unterlagen, s.betrieb, "2026-09-30")).toEqual([]);
    const l = euSchlussFehlt(s.unterlagen, s.betrieb, "2026-10-01");
    expect(l).toEqual([{ abschlagId: "a1", nummer: "A-1", kunde: "Wiener Kaffee GmbH", art: "L", leistung: "2026-08-20", meldeTag: "2026-09-30", monat: "2026-09", quartal: "2026-Q3", anzahlungNetto: 40000 }]);
  });

  it("Voranmeldung und ZM September: Warnung, aber kein erfundener Betrag; der Zeitraum steht zur Auswahl; Paket nennt es", () => {
    const s = abschlag();
    expect(perioden(s.unterlagen, s.betrieb)).toContain("2026-09");
    expect(zmPerioden(s.unterlagen, s.betrieb)).toContain("2026-09");
    const va = umsaetzeFuer(s.unterlagen, "2026-09", s.betrieb)!;
    expect(va.schlussFehlt.map((x) => x.abschlagId)).toEqual(["a1"]);
    expect(va.werte.umsatz_igl).toBe("0,00");
    expect(String(va.werte.annahmen)).toContain("Abschlagsrechnung A-1: Schlussrechnung fehlt – die Lieferung (laut Abschlagsrechnung am 20.08.2026) ist trotzdem für September 2026 zu melden (§ 18b Satz 2 UStG); nicht in Kz 41 und ZM enthalten");
    const zm = zmFuer(s.unterlagen, "2026-09", s.betrieb)!;
    expect(zm.zeilen).toEqual([]);
    expect(zm.schlussFehlt.map((x) => x.abschlagId)).toEqual(["a1"]);
    expect(umsaetzeFuer(s.unterlagen, "2026-08", s.betrieb)?.schlussFehlt ?? []).toEqual([]);
    expect(liesmich(s, "2026-09")).toContain("Abschlagsrechnung A-1: Schlussrechnung fehlt – die Lieferung (laut Abschlagsrechnung am 20.08.2026) ist trotzdem für September 2026 bzw. 3. Quartal 2026 zu melden");
    expect(liesmich(s, "2026-08")).not.toContain("Schlussrechnung fehlt");
  });

  it("Text auf „Heute“ bzw. bei der Übernahme: Satz des Steuerberaters, Fundstelle, Anzahlung nur als solche", () => {
    const txt = TEXT.e235_schluss_fehlt("L", "A-1", "Wiener Kaffee GmbH", "20.08.2026", "September 2026 bzw. 3. Quartal 2026", "400,00");
    expect(txt).toContain("Schlussrechnung fehlt – Lieferung trotzdem für September 2026 bzw. 3. Quartal 2026 melden (§ 18b Satz 2 UStG)");
    expect(txt).toContain("mit dem vollen Entgelt in die Voranmeldung (Kz 41) und die Zusammenfassende Meldung");
    expect(txt).toContain("abgerechnete Anzahlung hier: 400,00 € netto");
    expect(TEXT.e235_schluss_fehlt("S", "A-1", "", "20.08.2026", "August 2026", "400,00")).toContain("Leistung trotzdem für August 2026 melden (§ 18b Satz 3 UStG: im Zeitraum der Ausführung)");
  });

  it("mit Schlussrechnung (auch nach Ablauf gestellt) keine Warnung mehr – sie zählt im September mit dem vollen Entgelt", () => {
    const s = schluss(abschlag());
    expect(euSchlussFehlt(s.unterlagen, s.betrieb, "2026-11-01")).toEqual([]);
    expect(umsaetzeFuer(s.unterlagen, "2026-09", s.betrieb)!.werte.umsatz_igl).toBe("1.000,00");
    expect(zmFuer(s.unterlagen, "2026-09", s.betrieb)!.zeilen).toEqual([{ ust_idnr: "ATU69876543", art: "L", betrag_cent: 100000 }]);
  });

  it("stornierte Abschlagsrechnung und Inlandsabschlag: keine Warnung", () => {
    const [s1] = stornieren(abschlag(), "a1", t("2026-09-01"), "st1");
    const s2 = ausgeben(s1, "st1", t("2026-09-01"));
    expect(euSchlussFehlt(s2.unterlagen, s2.betrieb, "2026-11-01")).toEqual([]);
    const inland = rechnung(leer(), "a2", "2026-07-10", { nummer: "A-2", abschlag: true, leistung_gleich: false, leistung: "20.08.2026", kunde_ust_idnr: "", kunde_anschrift: "Weg 2\n10115 Berlin", positionen: [{ bezeichnung: "Anzahlung", menge: "1", einheit: "Stück", preis: "100,00", satz: "19" }] });
    expect(euSchlussFehlt(inland.unterlagen, inland.betrieb, "2026-11-01")).toEqual([]);
  });

  it("EU-Leistung: Zeitraum der Ausführung (§ 18b Satz 3 UStG), Warnung nach dessen Ende", () => {
    const s = abschlag("reverse_charge");
    expect(euSchlussFehlt(s.unterlagen, s.betrieb, "2026-08-31")).toEqual([]);
    expect(euSchlussFehlt(s.unterlagen, s.betrieb, "2026-09-01")).toMatchObject([{ art: "S", meldeTag: "2026-08-20", monat: "2026-08" }]);
    expect(umsaetzeFuer(s.unterlagen, "2026-08", s.betrieb)!.schlussFehlt).toHaveLength(1);
    expect(umsaetzeFuer(s.unterlagen, "2026-08", s.betrieb)!.werte.umsatz_21).toBe("0,00");
  });
});

describe("E-235 (S4 b): ältere Stornos ohne Grund – auch bei EU-Leistungen", () => {
  /** EU-Leistung 300 € (Leistung 10.09.2026, Rechnung 15.09.), Storno ohne Grund am 05.11. */
  const leistungStorno = () => {
    const s = rechnung(leer(), "r1", "2026-09-15", { nummer: "R-1", leistung_gleich: false, leistung: "10.09.2026", hinweise: ["reverse_charge"], positionen: pos("300,00") });
    const [s1] = stornieren(s, "r1", t("2026-11-05"), "st1");
    return ausgeben(s1, "st1", t("2026-11-05"));
  };

  it("erscheint im Hinweis, auch wenn der Hinweis für Lieferungen vor E-235 ausgeblendet wurde", () => {
    const s = leistungStorno();
    expect(euStornosOhneGrund(s.unterlagen, s.betrieb).map((u) => u.id)).toEqual(["st1"]);
    expect(euStornoHinweisListe(s.unterlagen, s.betrieb, {}).map((u) => u.id)).toEqual(["st1"]);
    expect(euStornoHinweisListe(s.unterlagen, s.betrieb, { [EU_STORNO_ALT_HINWEIS]: "2026-10-28" }).map((u) => u.id)).toEqual(["st1"]);
    expect(euStornoHinweisListe(s.unterlagen, s.betrieb, { [EU_STORNO_ALT_HINWEIS]: "2026-10-28", [EU_STORNO_ALT_HINWEIS_S]: "2026-11-10" })).toEqual([]);
  });

  it("„Fehler in der Rechnung“ nachgetragen: ZM und Voranmeldung des ursprünglichen Zeitraums (September) sind zu berichtigen", () => {
    let s = leistungStorno();
    expect(euBerichtigungen(s.unterlagen, s.betrieb)).toEqual([]);
    s = euStornoSetzen(s, "st1", { grund: "rechnung" }, t("2026-11-10"));
    expect(euStornosOhneGrund(s.unterlagen, s.betrieb)).toEqual([]);
    expect(euBerichtigungen(s.unterlagen, s.betrieb)[0]).toMatchObject({ stornoId: "st1", art: "S", monat: "2026-09", zmFrist: "2026-12-05" });
    expect(zmFuer(s.unterlagen, "2026-09", s.betrieb)!.zeilen).toEqual([{ ust_idnr: "ATU69876543", art: "S", betrag_cent: 0 }]);
    expect(zmFuer(s.unterlagen, "2026-11", s.betrieb)?.zeilen ?? []).toEqual([]);
  });

  it("Texte: EU-Umsatz statt nur Lieferung, Berichtigung der ZM, Regel ohne Angabe", () => {
    expect(TEXT.e218_alt_grund_titel(1)).toBe("Ein älteres Storno einer Rechnung mit EU-Umsatz ohne Grund");
    expect(TEXT.e218_alt_grund_text("ST-1")).toContain("War die ursprüngliche Meldung falsch, ist die ZM des ursprünglichen Zeitraums zu berichtigen (§ 18a Abs. 10 UStG).");
    expect(TEXT.e218_alt_grund_hilfe).toContain("bei Leistungen zählt ein Storno mit unveränderter Ersatzrechnung im ursprünglichen Zeitraum");
  });
});

describe("E-235 (S7): Textkorrekturen des Steuerberaters", () => {
  it("Erwerbsschwelle: „nicht über“ (Nr. 9, 16), Fundstelle § 1a Abs. 5 UStG ohne Satz (Nr. 5)", () => {
    expect(TEXT.e227_status.verneint("12.500 €")).toBe("Deine Erwerbe aus dem EU-Ausland liegen nicht über 12.500 €, und du hast nicht verzichtet: keine Erwerbsbesteuerung (§ 1a Abs. 3 UStG).");
    expect(TEXT.e227_ige_nicht(1, false)).toContain("Deine Erwerbe liegen nicht über der Erwerbsschwelle, und du hast nicht verzichtet");
    const h = TEXT.e227_schwelle_hinweis("12.500 €");
    expect(h).toContain("Bei der Erwerbsschwelle zählen sie nicht mit (§ 1a Abs. 5 UStG):");
    expect(h).not.toContain("Abs. 5 Satz");
  });

  it("Nr. 34: Verweis auf „Forderung uneinbringlich“", () => {
    expect(TEXT.e221_nichts_erhalten).toBe("Ohne jeden Zahlungseingang lässt sich die Rechnung nicht als Skonto oder Minderung erledigen. Ist die Forderung uneinbringlich, vermerke das unter „Forderung uneinbringlich“; wurde sie erlassen oder war die Rechnung falsch, kläre das mit deiner Steuerberatung bzw. storniere die Rechnung. Bis dahin bleibt der Betrag offen.");
  });

  it("Nr. 37/60: Anzahlung – Tag des Geldeingangs bei Soll und Ist; Nr. 42/60: EÜR am Tag des Eingangs", () => {
    expect(TEXT.e229_ueberzahlung("31,00 €", "119,00 €")).toContain("ist es eine Anzahlung – dann zählt für die Umsatzsteuer schon der Tag des Geldeingangs, bei Soll- wie bei Ist-Versteuerung. Bitte eine Abschlagsrechnung stellen oder mit deiner Steuerberatung klären.");
    expect(TEXT.e229_verrechnen_hilfe).toBe("Das Geld kam schon mit der Überzahlung. Für die Umsatzsteuer bei Ist-Versteuerung zählt es ab dem Tag der Verrechnung; in der Einnahmen-Überschuss-Rechnung ist es schon am Tag des Eingangs als Einnahme erfasst.");
  });

  it("Nr. 63: Überzahlung mit Skonto widerspricht dem Guthaben nicht mehr", () => {
    const mit = TEXT.e221_ueberzahlt("10,00 €", "119,00 €", true);
    expect(mit).toContain("trag den erhaltenen Betrag ohne Skonto bzw. Minderung ein – der Teil über dem offenen Betrag bleibt dann als Guthaben des Kunden stehen");
    for (const x of [mit, TEXT.e221_ueberzahlt("10,00 €", "119,00 €", false)]) expect(x).not.toMatch(/gehört nicht zu dieser Rechnung|zurückzahlen oder/);
  });

  it("Nr. 67: OSS-Rechnung nennt die OSS-Erklärung, EU-Rechnung die ZM", () => {
    expect(TEXT.e232_uneinbringlich_eu_oss("oss")).toMatch(/^OSS-Rechnung: Die OSS-Erklärung muss womöglich berichtigt werden/);
    expect(TEXT.e232_uneinbringlich_eu_oss("zm")).toContain("Die Zusammenfassende Meldung muss womöglich berichtigt werden");
  });
});

describe("E-235 (S7 Nr. 42): EÜR – Überzahlung ist am Tag des Eingangs Einnahme, die Verrechnung keine neue", () => {
  const INLAND = { kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", kunde_ust_idnr: "" };
  const re = (s: Stand, id: string, datum: string) => {
    const [s1] = anlegen(s, "rechnung", t(datum), id);
    return ausgeben(felderSetzen(s1, id, { datum, leistung_gleich: true, ...INLAND, positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "100,00", satz: "19" }] }, t(datum)), id, t(datum));
  };
  /** r1 119 € am 20.12.2026 mit 169 € bezahlt (50 € Guthaben), r2 119 € vom 05.01.2027, Verrechnung 50 € am 15.01.2027 */
  const fall = (versteuerung: "soll" | "ist") => {
    let s = re({ ...LEERER_STAND, betrieb: { ...BETRIEB, versteuerung }, profil: { "ust.kleinunternehmer": false } }, "r1", "2026-12-01");
    s = re(s, "r2", "2027-01-05");
    expect(zahlungPruefen(s, "r1", { datum: "2026-12-20", betrag_cent: 16900 }).ueberzahlung).toBe(5000);
    s = zahlungVermerken(s, "r1", { datum: "2026-12-20", betrag_cent: 16900 }, t("2026-12-20"), "z1");
    return guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2027-01-15", 5000, t("2027-01-15"));
  };
  for (const v of ["soll", "ist"] as const)
    it(`${v === "soll" ? "Soll" : "Ist"}-Versteuerung: 2026 Rechnung und Überzahlung, 2027 keine Einnahme aus der Verrechnung`, () => {
      const s = fall(v);
      const e26 = euerUebernahme(s, "2026");
      expect(e26.einnahmen.find((z) => z.text === "Umsätze aus Rechnungen (netto)")?.betrag).toBe("100,00");
      expect(e26.einnahmen.find((z) => (z.text ?? "").startsWith("Überzahlungen von Kunden"))?.betrag).toBe("50,00");
      const e27 = euerUebernahme(s, "2027");
      expect(e27.einnahmen.filter((z) => /Umsätze aus Rechnungen|Überzahlungen|Vereinnahmte/.test(z.text ?? ""))).toEqual([]);
      expect(einnahmenAusRechnungen(s, { euer: true }).filter((x) => x.tag.startsWith("2027"))).toEqual([]);
      // Umsatzsteuer bei Ist: das Entgelt der verrechneten Rechnung zum Tag der Verrechnung (unverändert)
      if (v === "ist") expect(umsaetzeFuer(s.unterlagen, "2027-01", s.betrieb, "ist")!.werte.umsatz_19).toBe("42,02");
    });

  it("LIESMICH sagt es so: Einnahme am Tag des Eingangs, nur für die Umsatzsteuer bei Ist der Tag der Verrechnung; Anzahlung bei Soll und Ist", () => {
    const s = fall("ist");
    const ende = "2027-01-31";
    const l = strFromU8(unzipSync(steuerpaket(s, { von: "2027-01-01", bis: ende, name: "2027-01" }, SB, {}, "2027-02-02T10:00:00").zip)["LIESMICH.txt"]!);
    expect(l).toContain("EÜR (§ 11 EStG): Die Überzahlung ist schon am Tag des Eingangs Einnahme, eine Rückzahlung Ausgabe am Tag der Zahlung; die Verrechnung ist keine neue Einnahme – nur für die Umsatzsteuer bei Ist-Versteuerung zählt der Tag der Verrechnung.");
    expect(l).toContain("dann ist sie eine Anzahlung, und für die Umsatzsteuer zählt schon der Tag des Geldeingangs, bei Soll- wie bei Ist-Versteuerung");
  });
});
