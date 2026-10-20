/** Randfälle aus der Prüfung R9 (Nummernkreise, Positionen, Plausibilität, eingefügte Anschriften). */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, betragUnplausibel, dokumentHtml, fehlendeAngaben, mengeUngueltig, naechsteNummer, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";
import { RECHNUNG_MENGE } from "../src/dokumente/buchhaltung.js";

describe("naechsteNummer: Jahreszahl am Ende (H3)", () => {
  it("zählt bei „NN/JJJJ“ die Nummer hoch, nicht das Jahr", () => {
    expect(naechsteNummer(["12/2026"], "2026")).toBe("13/2026");
    expect(naechsteNummer(["001/2026", "002/2026"], "2026")).toBe("003/2026");
    expect(naechsteNummer(["001/2026", "001/2027"], "2027")).toBe("002/2027");
    expect(naechsteNummer(["RE 7-2026"], "2026")).toBe("RE 8-2026");
  });
  it("beginnt im neuen Jahr im gleichen Schema bei 1", () => {
    expect(naechsteNummer(["12/2026"], "2027")).toBe("01/2027");
    expect(naechsteNummer(["009/2026", "010/2026"], "2027")).toBe("001/2027");
  });
  it("lässt die bisherigen Schemata unverändert", () => {
    expect(naechsteNummer([], "2026")).toBe("2026-001");
    expect(naechsteNummer(["2026-014", "2026-009", "2025-120"], "2026")).toBe("2026-015");
    expect(naechsteNummer(["RE-2026-0099"], "2026")).toBe("RE-2026-0100");
    expect(naechsteNummer(["17", "R18", ""], "2026")).toBe("R19");
    // Jahr vorn, letzte Zahl sieht wie ein Jahr aus: trotzdem die laufende Nummer
    expect(naechsteNummer(["RE-2026-2001"], "2026")).toBe("RE-2026-2002");
  });
});

describe("naechsteNummer: Präfix beim Jahreswechsel (M1)", () => {
  it("behält Präfix und Stellenzahl", () => {
    expect(naechsteNummer(["RE-2026-0099"], "2027")).toBe("RE-2027-0001");
    expect(naechsteNummer(["2025-120"], "2026")).toBe("2026-001");
    expect(naechsteNummer(["AR2026/17"], "2027")).toBe("AR2027/01");
  });
  it("nimmt das jüngste Vorjahr als Vorlage", () => {
    expect(naechsteNummer(["R-2024-0005", "RE-2025-0042"], "2026")).toBe("RE-2026-0001");
  });
  it("setzt einen Monat direkt nach dem Jahr auf Januar", () => {
    expect(naechsteNummer(["2026-12-007"], "2027")).toBe("2027-01-001");
  });
});

const BETRIEB: Betrieb = { ...LEERER_BETRIEB, name: "Muster GmbH", strasse: "Hauptstr. 1", plz: "10115", ort: "Berlin", steuernummer: "12/345/67890" };
const rechnung = (positionen: Record<string, string>[], mehr: Daten = {}): Daten => ({
  nummer: "2026-001",
  datum: "2026-10-20",
  leistung_gleich: true,
  zahlungsziel: "14",
  kunde_name: "Kim Beispiel",
  kunde_anschrift: "Gartenweg 3\n80333 München",
  positionen,
  ...mehr,
});

describe("Positionen mit Menge 0 (M6)", () => {
  const v = vorlageFuer("rechnung")!;
  it("mengeUngueltig wie die E-Rechnung", () => {
    expect(mengeUngueltig(0)).toBe(true);
    expect(mengeUngueltig(-1)).toBe(true);
    expect(mengeUngueltig(0.5)).toBe(false);
  });
  it("meldet Menge 0 im Abschluss – auch wenn eine andere Position den Betrag trägt", () => {
    const d = rechnung([
      { bezeichnung: "Beratung", menge: "2", einheit: "Stunde", preis: "90", satz: "19" },
      { bezeichnung: "Anfahrt", menge: "0", einheit: "Stück", preis: "15,05", satz: "19" },
    ]);
    expect(fehlendeAngaben(v, d, BETRIEB)).toContain(RECHNUNG_MENGE);
    expect(v.pruefenZu?.[RECHNUNG_MENGE]).toBe("positionen");
  });
  it("leere Menge zählt als 1", () => {
    const d = rechnung([{ bezeichnung: "Beratung", menge: "", einheit: "Stunde", preis: "90", satz: "19" }]);
    expect(fehlendeAngaben(v, d, BETRIEB)).not.toContain(RECHNUNG_MENGE);
  });
});

describe("Plausibilität großer Beträge (G6)", () => {
  it("warnt erst über 10 Mio. €", () => {
    expect(betragUnplausibel(1_000_000_000)).toBe(false);
    expect(betragUnplausibel(1_000_000_001)).toBe(true);
    expect(betragUnplausibel(-2_000_000_000)).toBe(true);
  });
});

describe("Eingefügte Anschrift im PDF (G4)", () => {
  it("entfernt Leerzeilen und Tabs", () => {
    const v = vorlageFuer("rechnung")!;
    const html = dokumentHtml(v, rechnung([{ bezeichnung: "Montage\tKüche", menge: "1", einheit: "Stück", preis: "100", satz: "19" }], { kunde_anschrift: "Gartenweg\t3\n\n  \n80333   München" }), BETRIEB);
    const empf = /<div class="empf[^"]*">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    expect(empf).toContain("Gartenweg 3<br>80333 München");
    expect(empf).not.toContain("<br><br>");
    expect(html).not.toContain("\t");
    expect(html).toContain("Montage Küche");
  });
});
