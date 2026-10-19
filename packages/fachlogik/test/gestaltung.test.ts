import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, VORLAGEN, dokumentHtml, giroCodeDaten, giroCodeSvg, leereDaten, vorlageFuer, type Betrieb } from "../src/index.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Café Mond GmbH", strasse: "Mondstraße 12", plz: "50667", ort: "Köln", verantwortlich: "Lea Mondt", telefon: "0221 9876543", email: "post@cafe-mond.de", steuernummer: "215/5812/0987", iban: "DE02 1203 0000 0000 2020 51", bic: "BYLADEM1001", bank: "DKB", bundesland: "Nordrhein-Westfalen", farbe: "#702434" };

describe("Gestaltung der Dokumente (E-130)", () => {
  it("GiroCode: EPC-Nutzdaten nach EPC069-12, SVG, und null ohne gültige IBAN", () => {
    const a = { name: "Café Mond GmbH", iban: "DE02 1203 0000 0000 2020 51", bic: "BYLADEM1001", betragCent: 178986, verwendungszweck: "Rechnung 2026-0231" };
    expect(giroCodeDaten(a)).toBe("BCD\n002\n1\nSCT\nBYLADEM1001\nCafé Mond GmbH\nDE02120300000000202051\nEUR1789.86\n\n\nRechnung 2026-0231");
    expect(giroCodeDaten({ ...a, bic: null, betragCent: 0 })).toBe("BCD\n002\n1\nSCT\n\nCafé Mond GmbH\nDE02120300000000202051\n\n\n\nRechnung 2026-0231");
    expect(giroCodeDaten({ ...a, iban: "DE02" })).toBeNull();
    expect(giroCodeDaten({ ...a, name: " " })).toBeNull();
    const svg = giroCodeSvg(a, 28)!;
    expect(svg).toMatch(/^<svg [^>]*width="28mm" height="28mm"/);
    expect(svg).toContain('<path d="M');
    expect(giroCodeSvg({ ...a, iban: "" })).toBeNull();
  });

  it("jede Vorlage hat eine Gestalt; Randspalten-Familien setzen Nummern und Rechtsgrundlagen, Formulare Feldnummern, der Brief den GiroCode", () => {
    for (const v of VORLAGEN) {
      const html = dokumentHtml(v, leereDaten(v, B, "2026-10-13"), B);
      const g = /<meta name="amtlos-gestalt" content="([a-z]+)">/.exec(html)?.[1];
      expect(["brief", "vertrag", "aushang", "nachweis", "formular", "handbuch"], v.id).toContain(g);
      expect(html, v.id).toContain(`<body class="g-${g}`);
      expect(html, v.id).toContain("--akzent:#702434");
      if (g === "formular") expect(html, v.id).toMatch(/class="felder"|class="kennzahlen"/);
      if (g === "handbuch" || g === "vertrag" || g === "nachweis") expect(html, v.id).toContain("<main>");
    }
    const r = vorlageFuer("rechnung")!;
    const voll = dokumentHtml(r, { ...leereDaten(r, B, "2026-10-13"), nummer: "2026-1", kunde_name: "Kim", kunde_anschrift: "Weg 1\n50667 Köln", positionen: [{ bezeichnung: "Kaffee", menge: "2", einheit: "Stück", preis: "3,00", satz: "7" }] }, B);
    expect(voll).toContain('class="anschrift"');
    expect(voll).toContain('class="qr"');
    expect(voll).toContain("Verwendungszweck: Rechnung 2026-1");
    expect(voll).toContain("Mit freundlichen Grüßen");
    // ohne IBAN keine Zahlungsaufforderung und kein GiroCode, aber das Zahlungsziel als Satz
    const ohne = dokumentHtml(r, { ...leereDaten(r, B, "2026-10-13"), nummer: "2026-1", zahlungsziel: "14", positionen: [{ bezeichnung: "Kaffee", menge: "1", einheit: "", preis: "3,00", satz: "7" }] }, { ...B, iban: "" });
    expect(ohne).not.toContain('class="qr"');
    expect(ohne).toContain("Zahlbar innerhalb von 14 Tagen");
    const ust = vorlageFuer("ust_voranmeldung")!;
    const u = dokumentHtml(ust, { ...leereDaten(ust, B, "2026-10-13"), zeitraum: "September 2026", umsatz_19: "1.000,00", vorsteuer: "50,00" }, B);
    for (const kz of ["81", "86", "66", "83"]) expect(u).toContain(`<span>${kz}</span>`);
    const vd = vorlageFuer("verfahrensdokumentation")!;
    expect(dokumentHtml(vd, leereDaten(vd, B, "2026-10-13"), B)).toContain('class="inhalt-uebersicht"');
    const ba = vorlageFuer("betriebsanweisung")!;
    const bah = dokumentHtml(ba, leereDaten(ba, B, "2026-10-13"), B);
    // leeres Blatt: kompakter Satz, damit die Linien zum Ausfüllen auf ein Blatt passen
    expect(bah).toContain('class="g-aushang ba kompakt"');
    expect(dokumentHtml(ba, { ...leereDaten(ba, B, "2026-10-13"), gefahren: "Reizt die Augen." }, B)).toContain('class="g-aushang ba"');
    expect(bah).toContain("--band:#e0640c");
  });
});
