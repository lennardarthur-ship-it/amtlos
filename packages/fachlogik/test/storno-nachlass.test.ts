import { describe, expect, it } from "vitest";
import { eRechnungAus, xrechnungUbl, eRechnungLesen, umsaetzeNachSatz, summen, KU_HINWEIS } from "../src/index.js";
import { zahl } from "../src/dokumente/html.js";

const B = { name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", email: "info@salon.example", telefon: "089 1", steuernummer: "143/123/45678", ust_idnr: "", iban: "DE89370400440532013000" } as never;
const basis = { nummer: "2026-001", datum: "2026-10-01", leistung_gleich: true, kunde_name: "Kim GmbH", kunde_anschrift: "Gartenweg 3\n80333 München", kunde_email: "kim@example.org" };
const mit = (positionen: Record<string, string>[], extra: Record<string, unknown> = {}) => ({ ...basis, positionen, ...extra }) as never;

describe("Storno und Nachlass (Prüfbefund 2026-10-13)", () => {
  it("Storno einer Rechnung mit Rabatt hebt sie genau auf – USt und XRechnung", () => {
    const re = eRechnungAus(mit([{ bezeichnung: "Haarschnitt", menge: "1", preis: "100", satz: "19" }, { bezeichnung: "Rabatt", menge: "1", preis: "-10", satz: "19" }]), B).daten;
    // die App dreht beim Storno jedes Vorzeichen um
    const st = eRechnungAus(mit([{ bezeichnung: "Haarschnitt", menge: "1", preis: "-100", satz: "19" }, { bezeichnung: "Rabatt", menge: "1", preis: "10", satz: "19" }], { nummer: "2026-002", storno_zu: "2026-001" }), B).daten;
    expect(summen(re.positionen, false).netto_cent).toBe(9000);
    const u = umsaetzeNachSatz([re, st].map((r) => ({ art: r.art ?? "rechnung", kleinunternehmer: false, positionen: r.positionen })));
    expect(u).toEqual([{ satz: 19, netto_cent: 0, ust_cent: 0 }]);
    const gelesen = eRechnungLesen(xrechnungUbl(st, KU_HINWEIS))!;
    expect(gelesen.summen.netto_cent).toBe(-9000);
    expect(gelesen.summen.brutto_cent).toBe(-10710);
  });
  it("Nachlass-Zeile: Preis in der XRechnung nie negativ (BR-27), Menge negativ", () => {
    const re = eRechnungAus(mit([{ bezeichnung: "Haarschnitt", menge: "1", preis: "100", satz: "19" }, { bezeichnung: "Rabatt", menge: "1", preis: "-10", satz: "19" }]), B).daten;
    const xml = xrechnungUbl(re, KU_HINWEIS);
    expect(xml).not.toMatch(/<cbc:PriceAmount[^>]*>-/);
    expect(eRechnungLesen(xml)!.summen.netto_cent).toBe(9000);
  });
  it("Mengen mit drei Nachkommastellen werden nicht gerundet", () => {
    expect(zahl("2,345")).toBe(2.345);
    const re = eRechnungAus(mit([{ bezeichnung: "Farbe", menge: "2,345", preis: "10", satz: "19" }]), B).daten;
    expect(summen(re.positionen, false).netto_cent).toBe(2345);
  });
});

describe("Beträge und Exporte (Prüfbefund 2026-10-19)", () => {
  it("liest „-1.500“ als −1.500 € – Storno einer Rechnung mit Tausenderpunkt", () => {
    const re = eRechnungAus(mit([{ bezeichnung: "Küche", menge: "1", preis: "1.500", satz: "19" }]), B).daten;
    const st = eRechnungAus(mit([{ bezeichnung: "Küche", menge: "1", preis: "-1.500", satz: "19" }], { nummer: "2026-002", storno_zu: "2026-001" }), B).daten;
    expect(summen(re.positionen, false).brutto_cent).toBe(178500);
    const u = umsaetzeNachSatz([re, st].map((r) => ({ art: r.art ?? "rechnung", kleinunternehmer: false, positionen: r.positionen })));
    expect(u).toEqual([{ satz: 19, netto_cent: 0, ust_cent: 0 }]);
  });
  it("rundet Menge × Preis und Bruchteile eines Cents kaufmännisch und für Storno spiegelbildlich", () => {
    const zeile = (menge: number, preis_cent: number) => summen([{ bezeichnung: "x", menge, einheit: "stueck", preis_cent, ust_satz: 19 } as never], false).zeilen[0];
    expect(zeile(0.57, 150)).toBe(86);
    expect(zeile(0.145, 100)).toBe(15);
    expect(zeile(1.005, 100)).toBe(101);
    expect(zeile(0.57, -150)).toBe(-86);
    const re = eRechnungAus(mit([{ bezeichnung: "x", menge: "1", preis: "0,335", satz: "19" }]), B).daten;
    const st = eRechnungAus(mit([{ bezeichnung: "x", menge: "1", preis: "-0,335", satz: "19" }], { nummer: "2026-002", storno_zu: "2026-001" }), B).daten;
    expect(re.positionen[0]!.preis_cent).toBe(34);
    expect(st.positionen[0]!.preis_cent).toBe(34); // Storno dreht das Vorzeichen für die USt zurück
  });
  it("E-Rechnung ohne verbotene Steuerzeichen und ohne Zahlungshinweis im Storno", () => {
    const re = eRechnungAus(mit([{ bezeichnung: "Erste\u000bZeile", menge: "1", preis: "10", satz: "19" }], { hinweis: "Bitte geben Sie bei der Zahlung die Rechnungsnummer an." }), B).daten;
    expect(xrechnungUbl(re, KU_HINWEIS)).not.toMatch(/\u000b/);
    const st = eRechnungAus(mit([{ bezeichnung: "x", menge: "1", preis: "-10", satz: "19" }], { nummer: "2026-002", storno_zu: "2026-001", hinweis: "Bitte geben Sie bei der Zahlung die Rechnungsnummer an." }), B).daten;
    expect(xrechnungUbl(st, KU_HINWEIS)).not.toContain("Rechnungsnummer an");
  });
});
