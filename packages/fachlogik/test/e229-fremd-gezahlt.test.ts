/**
 * E-229 (Steuerberater 27.10.2026, T-303): Rechnung in fremder Währung – bei der Einnahmen-Überschuss-Rechnung ist die
 * Betriebsausgabe der tatsächlich gezahlte Euro-Betrag laut Kontoauszug (§ 11 Abs. 2 EStG), nicht der umgerechnete
 * Rechnungsbetrag; die Vorsteuer bleibt der umgerechnete Betrag (§ 16 Abs. 6 UStG). Vorher zählte immer der
 * umgerechnete Betrag. Dazu: Überzahlung bzw. Rückzahlung eines Guthabens im Stapel (Bank an Forderungen) und die
 * Verrechnung als Zahlung mit Verweis, die beim Lesen erhalten bleibt.
 */
import { describe, expect, it } from "vitest";
import { ausgabenFuer, belegAus, belegFassung, belegGezahlt, euerFuer, fremdAus, fremdGezahlt, fremdKursdifferenz, vorsteuerFuer, type Beleg } from "../src/belege.js";
import { guthabenBuchungenRechnung } from "../src/buchungen.js";
import { zahlungenAus } from "../src/skonto.js";

const USD: Beleg = {
  id: "bu",
  datum: "2026-10-05",
  lieferant: "Cloud Tools Inc.",
  kategorie: "buero",
  // 119 USD zum Kurs 1,0812 → 110,06 € (darin 17,57 € Vorsteuer)
  steuer: [{ satz: 19, brutto_cent: 11006 }],
  vorsteuer: true,
  zahlung: "bank",
  bezahlt: "2026-10-12",
  erstellt: "2026-10-06T08:00:00.000Z",
  geaendert: "2026-10-06T08:00:00.000Z",
  fremd: { waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 11900 }], ust: 1900, kurs: 1.0812, kurs_datum: "2026-10-01" },
};

describe("E-229 (T-303): gezahlter Euro-Betrag bei fremder Währung", () => {
  it("EÜR: Betriebsausgabe = gezahlter Euro-Betrag abzüglich (umgerechneter) Vorsteuer; Vorsteuer unverändert", () => {
    const ohne = ausgabenFuer([USD], "2026");
    expect(ohne.zeilen[0]!.netto_cent).toBe(9249);
    expect(ohne.vorsteuer_cent).toBe(1757);
    // laut Kontoauszug 111,80 € abgebucht (Kurs der Bank plus Gebühr): Ausgabe 111,80 € − 17,57 € Vorsteuer
    const b = { ...USD, fremd: { ...USD.fremd!, gezahlt_eur_cent: 11180 } };
    const mit = ausgabenFuer([b], "2026");
    expect(mit.zeilen[0]!.netto_cent).toBe(11180 - 1757);
    expect(mit.vorsteuer_cent).toBe(1757);
    expect(euerFuer([], [b], "2026").summe_ausgaben_cent).toBe(11180);
    // Vorsteuer der Voranmeldung bleibt der umgerechnete Betrag
    expect(vorsteuerFuer([b], "2026-10-01", "2026-10-31").cent).toBe(1757);
    expect(belegGezahlt(b)).toBe(11180);
    expect(fremdGezahlt(b)).toBe(11180);
    expect(fremdKursdifferenz(b)).toBe(174);
    expect(fremdKursdifferenz(USD)).toBeNull();
  });

  it("ohne Vorsteuerabzug: die ganze Zahlung ist Ausgabe; mit Skonto zählt der gezahlte Betrag (kein doppelter Abzug)", () => {
    const b = { ...USD, vorsteuer: false, skonto_cent: 200, fremd: { ...USD.fremd!, gezahlt_eur_cent: 10900 } };
    expect(ausgabenFuer([b], "2026").zeilen[0]!.netto_cent).toBe(10900);
    expect(belegGezahlt(b)).toBe(10900);
  });

  it("Feld gehört zum Inhalt (Fassung, Lesen); Unlesbares fällt weg", () => {
    const b = { ...USD, fremd: { ...USD.fremd!, gezahlt_eur_cent: 11180 } };
    expect(fremdAus(b.fremd)!.gezahlt_eur_cent).toBe(11180);
    expect(fremdAus({ ...b.fremd, gezahlt_eur_cent: -5 })!.gezahlt_eur_cent).toBeUndefined();
    expect(fremdAus({ ...b.fremd, gezahlt_eur_cent: 1.5 })!.gezahlt_eur_cent).toBeUndefined();
    expect(belegAus(JSON.parse(JSON.stringify(b)))!.fremd!.gezahlt_eur_cent).toBe(11180);
    expect(belegFassung(b, "2026-10-20T10:00:00.000Z").fremd!.gezahlt_eur_cent).toBe(11180);
  });
});

describe("E-229 (T-304 a): Guthaben im Stapel und Verrechnung als Zahlung", () => {
  it("Überzahlung Bank an Forderungen, Rückzahlung Bank im Haben – ohne Steuer, GUID je Eintrag", () => {
    const b = guthabenBuchungenRechnung({ id: "r1", nummer: "2026-001", kunde: "Muster GmbH" }, [
      { id: "z1-ue", art: "ueberzahlung", datum: "2026-04-02", betrag_cent: 2400 },
      { id: "rz", art: "rueckzahlung", datum: "2026-04-20", betrag_cent: 1000 },
    ], "SKR03");
    expect(b.map((x) => [x.datum, x.betrag_cent, x.soll_haben, x.konto, x.gegenkonto, x.bu_schluessel, x.ust_satz])).toEqual([
      ["2026-04-02", 2400, "S", "1200", "1410", "", null],
      ["2026-04-20", 1000, "H", "1200", "1410", "", null],
    ]);
    expect(b[0]!.buchungstext).toBe("Überzahlung RE 2026-001 Muster GmbH");
    expect(new Set(b.map((x) => x.guid)).size).toBe(2);
    expect(guthabenBuchungenRechnung({ id: "r1", nummer: "1", kunde: "K", personenkonto: "10001" }, [{ id: "x", art: "ueberzahlung", datum: "2026-04-02", betrag_cent: 1 }], "SKR04")[0]).toMatchObject({ konto: "1800", gegenkonto: "10001" });
  });

  it("Zahlung mit Verweis auf das Guthaben bleibt beim Lesen erhalten (vorher verworfen)", () => {
    const z = zahlungenAus([{ id: "v1", datum: "2026-05-02", betrag_cent: 2400, guthaben: { rechnung: "r1", eintrag: "z1-ue" } }, { id: "v2", datum: "2026-05-03", betrag_cent: 1, guthaben: { rechnung: "", eintrag: 3 } }]);
    expect(z[0]!.guthaben).toEqual({ rechnung: "r1", eintrag: "z1-ue" });
    expect(z[1]!.guthaben).toBeUndefined();
  });
});
