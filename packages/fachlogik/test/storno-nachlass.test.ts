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
