import { describe, expect, it } from "vitest";
import { RECHNUNG_NULL, RECHNUNG_PLZ_FEHLT } from "@amtlos/fachlogik";
import { fehltFuer } from "../src/unterlagen/pruefung";
import { LEERER_STAND, anlegen, betriebSetzen, felderSetzen } from "../src/unterlagen/speicher";

const B = { name: "Salon Sonne", strasse: "Hauptstr. 1", plz: "12345", ort: "Musterstadt", verantwortlich: "Alex Muster", telefon: "", email: "info@salon-sonne.de", steuernummer: "12/345/67890", ust_idnr: "", iban: "", bundesland: "Bayern" };
const t = new Date("2026-10-12T08:00:00Z");

describe("Rechnung: nur teilbar, wenn die Beträge stimmen", () => {
  it("„45 Euro“ als Preis: nicht teilbar (Preis nicht lesbar, Betrag 0,00 €); „45,-“ geht", () => {
    let s = betriebSetzen(LEERER_STAND, B);
    const [s1, u] = anlegen(s, "rechnung", t, "r");
    s = felderSetzen(s1, "r", { kunde_name: "Kim Muster", kunde_anschrift: "Weg 1\n12345 Musterstadt", positionen: [{ ...(u.daten.positionen as Record<string, string>[])[0]!, bezeichnung: "Haarschnitt", preis: "45 Euro" }] }, t);
    const fehlt = fehltFuer(s, s.unterlagen[0]!);
    expect(fehlt).toContain("Position: Preis nicht lesbar (z. B. 45,00)");
    expect(fehlt).toContain(RECHNUNG_NULL);
    s = felderSetzen(s, "r", { positionen: [{ ...(u.daten.positionen as Record<string, string>[])[0]!, bezeichnung: "Haarschnitt", preis: "45,-" }] }, t);
    expect(fehltFuer(s, s.unterlagen[0]!)).toEqual([]);
    // Einheit „Stück“ ist vorbelegt
    expect((s.unterlagen[0]!.daten.positionen as Record<string, string>[])[0]!.einheit).toBe("Stück");
  });
  it("Anschrift ohne PLZ und Ort: nicht teilbar", () => {
    const [s1] = anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t, "r");
    const s = felderSetzen(s1, "r", { kunde_name: "Kim Muster", kunde_anschrift: "Weg 1", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis: "45,00", satz: "19" }] }, t);
    expect(fehltFuer(s, s.unterlagen[0]!)).toEqual([RECHNUNG_PLZ_FEHLT]);
  });
});
