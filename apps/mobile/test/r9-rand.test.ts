/** Randfälle aus der Prüfung R9: Datumseingabe, Gruß nach Uhrzeit, Zeitzone, Trennstellen, Schreibrichtung, Kontingent. */
import { describe, expect, it } from "vitest";
import { verbraucht } from "../src/pro/regeln";
import { datumLesen, isoAus } from "../src/ui/datum";
import { isoliert, trennen } from "../src/ui/trennen";
import { stundeIn, zeitzoneAbweichend } from "../src/ui/zeit";
import { LEERER_STAND, anlegen, ausgeben, type Unterlage } from "../src/unterlagen/speicher";

describe("Datumseingabe (H2, G5)", () => {
  it("liest kurze Schreibweisen", () => {
    expect(isoAus("5.3.26")).toBe("2026-03-05");
    expect(isoAus("05.03.2026")).toBe("2026-03-05");
    expect(isoAus("5/3/2026")).toBe("2026-03-05");
    expect(isoAus("2026-03-05")).toBe("2026-03-05");
  });
  it("unterscheidet falsches Format und unmöglichen Tag", () => {
    expect(datumLesen("29.02.2026")).toEqual({ iso: null, fehler: "tag", unplausibel: false });
    expect(datumLesen("32.13.2026").fehler).toBe("tag");
    expect(datumLesen("29.02.2028").iso).toBe("2028-02-29");
    // halb getippt (Rücktaste): kein Datum, aber nur ein Formatfehler – das Feld leert sich nicht (H2, in DatumFeld)
    expect(datumLesen("20.10.202")).toEqual({ iso: null, fehler: "format", unplausibel: false });
    expect(datumLesen("abc").fehler).toBe("format");
  });
  it("markiert Jahre außerhalb 2000–2099 nur als Hinweis", () => {
    expect(datumLesen("01.01.1900")).toEqual({ iso: "1900-01-01", fehler: null, unplausibel: true });
    expect(datumLesen("31.12.2100")).toEqual({ iso: "2100-12-31", fehler: null, unplausibel: true });
    expect(datumLesen("15.06.1998").unplausibel).toBe(true);
    expect(datumLesen("15.06.2026").unplausibel).toBe(false);
  });
});

describe("Gruß nach Uhrzeit (M2)", () => {
  it("liest die Stunde in deutscher Zeit (nicht „10 Uhr“ → NaN)", () => {
    expect(stundeIn(new Date("2026-10-20T08:00:00Z"))).toBe(10);
    expect(stundeIn(new Date("2026-01-20T08:00:00Z"))).toBe(9);
    expect(stundeIn(new Date("2026-10-20T22:30:00Z"))).toBe(0);
    expect(stundeIn(new Date("2026-10-20T08:00:00Z"), "America/New_York")).toBe(4);
  });
});

describe("Hinweis auf deutsche Zeit (G10)", () => {
  const jetzt = new Date("2026-10-20T18:30:00Z");
  it("nur, wenn die Gerätezeit abweicht", () => {
    expect(zeitzoneAbweichend(jetzt, "Europe/Berlin")).toBe(false);
    expect(zeitzoneAbweichend(jetzt, "Europe/Vienna")).toBe(false);
    expect(zeitzoneAbweichend(jetzt, "America/New_York")).toBe(true);
    expect(zeitzoneAbweichend(jetzt, null)).toBe(false);
  });
});

describe("Weiche Trennstellen (G1) und Schreibrichtung (G3)", () => {
  it("trennt lange Zusammensetzungen an der Fuge", () => {
    // R12 (UX #8): Trennmuster statt Wortfugen-Liste – an jeder Silbe, die Fuge ist dabei
    expect(trennen("Rechnungsempfänger")).toBe("Rech\u00ADnungs\u00ADemp\u00ADfän\u00ADger");
    expect(trennen("Nutzungsbedingungen")).toBe("Nut\u00ADzungs\u00ADbe\u00ADdin\u00ADgun\u00ADgen");
    expect(trennen("Paket für die Steuerberatung")).toBe("Paket für die Steu\u00ADer\u00ADbe\u00ADra\u00ADtung");
    expect(trennen("Heute")).toBe("Heute");
  });
  it("isoliert rechts-nach-links-Text, lässt lateinischen unverändert", () => {
    expect(isoliert("Kim Beispiel")).toBe("Kim Beispiel");
    expect(isoliert("شركة النور GmbH")).toBe("\u2068شركة النور GmbH\u2069");
    expect(isoliert("Weg 1\nשלום")).toBe("Weg 1\n\u2068שלום\u2069");
  });
});

describe("Kontingent: Konfliktkopien zählen nicht (K1)", () => {
  it("eine geteilte Konfliktkopie verbraucht keine freie Ausgabe", () => {
    const t = new Date("2026-10-05T09:00:00Z");
    // E-156: aufs Kontingent zählen Vorlagen wie der Hygieneplan
    const [s1] = anlegen(LEERER_STAND, "hygieneplan", t, "u1");
    const s2 = ausgeben(s1, "u1", t);
    const kopie: Unterlage = { ...s2.unterlagen[0]!, id: "u1-k", konfliktKopieVon: "u1" };
    expect(verbraucht([...s2.unterlagen, kopie], t)).toBe(1);
  });
});
