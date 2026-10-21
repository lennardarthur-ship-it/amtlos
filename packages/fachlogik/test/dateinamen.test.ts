import { describe, expect, it } from "vitest";
import { dateinamenTeil, pdfDateiname, umschreiben, vorlageFuer } from "../src/index.js";

describe("Dateinamen", () => {
  it("schreibt Umlaute um (ä → ae, ß → ss) und führt Akzente auf den Grundbuchstaben zurück (é → e)", () => {
    expect(umschreiben("Café Müller & Söhne, Straße, Ærø, Łódź")).toBe("Cafe Mueller & Soehne, Strasse, Aero, Lodz");
    expect(dateinamenTeil("Krause & Söhne")).toBe("Krause-Soehne");
    expect(dateinamenTeil("Lohnbüro Weiß GmbH", 60, "._-")).toBe("Lohnbuero-Weiss-GmbH");
    expect(dateinamenTeil("Rechnung 2026/001.pdf", 60, "._-")).toBe("Rechnung-2026-001.pdf");
  });

  it("PDF-Name: „é“ bleibt als „e“, das Datum steht vollständig am Ende", () => {
    expect(pdfDateiname(vorlageFuer("hygieneplan")!, { bereich: "Café Morgenrot" }, "2026-02-10")).toBe("Hygieneplan-Cafe-Morgenrot-2026-02-10.pdf");
    expect(pdfDateiname(vorlageFuer("gefaehrdungsbeurteilung")!, { arbeitsbereich: "Küche & Lager" }, "2026-10-12")).toBe("Gefaehrdungsbeurteilung-Kueche-Lager-2026-10-12.pdf");
  });

  it("PDF-Name: bei langen Namen wird der Name gekürzt, nicht das Datum", () => {
    const n = pdfDateiname(vorlageFuer("ki_kompetenz")!, { thema: "Sicherer Umgang mit KI-Assistenten im Betrieb" }, "2026-02-10");
    expect(n.endsWith("-2026-02-10.pdf")).toBe(true);
    expect(n.length).toBeLessThanOrEqual(84);
    expect(n).toMatch(/^Dokumentation-KI-Schulung-Sicherer-Umgang-mit-KI-[A-Za-z-]*-2026-02-10\.pdf$/);
    expect(n).not.toMatch(/--/);
    // nicht mitten im Wort gekürzt
    expect(pdfDateiname(vorlageFuer("hygieneplan")!, { bereich: "Café Morgenrot – Küche, Theke und Gastraum" }, "2026-02-05")).toBe("Hygieneplan-Cafe-Morgenrot-Kueche-Theke-und-Gastraum-2026-02-05.pdf");
  });

  it("PDF-Name: ist das Namensfeld das Datum, steht es nur einmal da", () => {
    expect(pdfDateiname(vorlageFuer("pruefprotokoll_elektro")!, { datum: "2026-08-12" }, "2026-08-12")).toBe("Pruefprotokoll-elektrische-Geraete-DGUV-V3-2026-08-12.pdf");
    // anderes Datum beim Teilen: beide bleiben (Prüftag und Ausgabetag)
    expect(pdfDateiname(vorlageFuer("pruefprotokoll_elektro")!, { datum: "2026-08-12" }, "2026-10-20")).toBe("Pruefprotokoll-elektrische-Geraete-DGUV-V3-2026-08-12-2026-10-20.pdf");
  });
});
