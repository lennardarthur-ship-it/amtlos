/**
 * E-224: Beleg mit innergemeinschaftlichem Erwerb (E-222) bzw. § 13b in fremder Währung (E-221) ohne eingetragenen
 * Euro-Betrag hat 0 € – er darf nicht als „übernommen“ zählen, sondern wird getrennt gezählt (Warnung in der Voranmeldung).
 */
import { describe, expect, it } from "vitest";
import { steuerschuldFuer, type Beleg } from "../src/index.js";

const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-03-10", lieferant: "Supplier Ltd", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100000 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, quelle: "erechnung", erstellt: "2026-03-10T09:00:00Z", geaendert: "2026-03-10T09:00:00Z", ...o }) as Beleg;
const fremd = { waehrung: "SEK", steuer: [{ satz: 19, brutto_cent: 1000000 }] };
const VON = "2026-03-01";
const BIS = "2026-03-31";

describe("E-224: Steuerschuld-Belege ohne Euro-Betrag", () => {
  it("innergemeinschaftlicher Erwerb in fremder Währung ohne Euro-Betrag: nicht übernommen, getrennt gezählt", () => {
    const r = steuerschuldFuer([beleg({ id: "a", steuerschuld: "ige", fremd, steuer: [{ satz: 19, brutto_cent: 0 }] }), beleg({ id: "b", steuerschuld: "ige" })], VON, BIS);
    expect(r).toMatchObject({ ige_anzahl: 1, ige_ohne_euro: 1, ige_19_netto_cent: 100000, anzahl: 0, ohne_euro: 0 });
  });

  it("§ 13b (EU-Leistung und Bau) ohne Euro-Betrag: getrennt gezählt, nicht in Kz 46/47, 84/85", () => {
    const r = steuerschuldFuer([beleg({ id: "a", steuerschuld: "eu", fremd, steuer: [{ satz: 0, brutto_cent: 0 }] }), beleg({ id: "c", steuerschuld: "bau", steuer: [] })], VON, BIS);
    expect(r).toMatchObject({ anzahl: 0, ohne_euro: 2, eu_netto_cent: 0, bau_netto_cent: 0, ige_ohne_euro: 0 });
  });

  it("mit eingetragenem Euro-Betrag zählt der Beleg wie bisher; andere Zeiträume und ungültige Belege nicht", () => {
    const r = steuerschuldFuer([
      beleg({ id: "a", steuerschuld: "ige", fremd: { ...fremd, kurs: 11.5 }, steuer: [{ satz: 19, brutto_cent: 86957 }] }),
      beleg({ id: "b", steuerschuld: "ige", fremd, steuer: [{ satz: 19, brutto_cent: 0 }], datum: "2026-04-02" }),
      beleg({ id: "c", steuerschuld: "eu", fremd, steuer: [{ satz: 0, brutto_cent: 0 }], ungueltig: "2026-03-20T00:00:00Z" } as Partial<Beleg>),
    ], VON, BIS);
    expect(r).toMatchObject({ ige_anzahl: 1, ige_ohne_euro: 0, ohne_euro: 0, ige_19_netto_cent: 86957 });
  });
});
