/** Befunde der Prüfung R10 (Oberfläche): Eingaben, Trennstellen, Jugendliche, Kontrollmappe, Rechtstexte. */
import { describe, expect, it } from "vitest";
import { vorlageFuer } from "@amtlos/fachlogik";
import { DATENSCHUTZ, DATENSCHUTZ_SYNC, datenschutzAbschnitte } from "../src/rechtliches";
import { datumLesen, minderjaehrig, nurJahr, uhrzeitLesen } from "../src/ui/datum";
import { trennen } from "../src/ui/trennen";
import { fehltInMappe, fuerKontrolle, type MappenEintrag } from "../src/unterlagen/kontrollmappe";
import { LEERER_STAND, anlegen } from "../src/unterlagen/speicher";

const ohne = (t: string) => t.replace(/\u00AD/g, "-");

describe("Eingaben (Sabine #12, #13, Mehmet #21)", () => {
  it("liest Ziffern ohne Punkte und – wo erlaubt – nur das Jahr", () => {
    expect(datumLesen("01042014").iso).toBe("2014-04-01");
    expect(datumLesen("010414").iso).toBe("2014-04-01");
    expect(datumLesen("2014").iso).toBeNull();
    expect(nurJahr("2014")).toBe(true);
    expect(datumLesen("2014", { jahrReicht: true }).iso).toBe("2014-01-01");
    expect(datumLesen("31022014").fehler).toBe("tag");
  });
  it("liest Uhrzeiten vom Ziffernblock", () => {
    expect(uhrzeitLesen("1400")).toBe("14:00");
    expect(uhrzeitLesen("930")).toBe("09:30");
    expect(uhrzeitLesen("14.30")).toBe("14:30");
    expect(uhrzeitLesen("7")).toBe("07:00");
    expect(uhrzeitLesen("2460")).toBeNull();
    expect(uhrzeitLesen("25:00")).toBeNull();
  });
});

describe("Trennstellen bei großer Schrift (Mehmet #10, #23)", () => {
  it("trennt an Fugen und in langen Teilen nach Silben", () => {
    // R12 (UX #8): TeX-Muster (hyph-de-1996) – an allen Silben, Fugen richtig
    expect(ohne(trennen("Sozialversicherungsbeiträge"))).toBe("So-zi-al-ver-si-che-rungs-bei-trä-ge");
    expect(ohne(trennen("Kleinunternehmerregelung"))).toBe("Klein-un-ter-neh-mer-re-ge-lung");
    expect(ohne(trennen("Temperaturkontrolle"))).toBe("Tem-pe-ra-tur-kon-trol-le");
    expect(ohne(trennen("Hautschutzplan"))).toBe("Haut-schutz-plan");
    // kurze Wörter, Adressen und Links bleiben, wie sie sind
    expect(trennen("Pflichten")).toBe("Pflichten");
    expect(trennen("info@salonsonnemuenchen.de")).toBe("info@salonsonnemuenchen.de");
  });
});

describe("Jugendliche in der Unterweisung (Sabine #9, Jonas #4)", () => {
  it("erkennt unter 18 am Tag der Unterweisung", () => {
    expect(minderjaehrig("2009-03-12", "2026-10-20")).toBe(true);
    expect(minderjaehrig("2008-10-20", "2026-10-20")).toBe(false);
    expect(minderjaehrig("", "2026-10-20")).toBe(false);
  });
  it("belegt „Mit Jugendlichen“ aus dem Pflichten-Check vor", () => {
    const [, mit] = anlegen({ ...LEERER_STAND, profil: { "beschaeftigte.jugendlich": 1 } }, "unterweisung", new Date("2026-10-20T10:00:00Z"));
    expect(mit.daten.jugendliche).toBe(true);
    const [, ohneJ] = anlegen({ ...LEERER_STAND, profil: { "beschaeftigte.jugendlich": 0 } }, "unterweisung", new Date("2026-10-20T10:00:00Z"));
    expect(ohneJ.daten.jugendliche).toBe(false);
  });
  it("belegt die prüfende Elektrofachkraft nur im Handwerk mit der verantwortlichen Person vor", () => {
    const b = { ...LEERER_STAND.betrieb, verantwortlich: "Jonas Becker" };
    const [, hw] = anlegen({ ...LEERER_STAND, betrieb: b, profil: { "taetigkeit.branchen": ["handwerk"] } }, "pruefprotokoll_elektro", new Date());
    const [, salon] = anlegen({ ...LEERER_STAND, betrieb: b, profil: { "taetigkeit.branchen": ["beauty_kosmetik"] } }, "pruefprotokoll_elektro", new Date());
    expect(hw.daten.pruefer).toBe("Jonas Becker");
    expect(salon.daten.pruefer).toBe("");
  });
});

describe("Kontrollmappe nach Kontrollart (Recht #16, Sabine #5, Mehmet #19)", () => {
  const e = (vorlage: string): MappenEintrag => ({ id: vorlage, vorlage, titel: vorlage, bereich: vorlageFuer(vorlage)!.bereich, datum: "2026-10-01", geteilt: true });
  it("gibt der Lebensmittelkontrolle keine Gehälter", () => {
    expect(fuerKontrolle("nachweis_arbeitsbedingungen", "hygiene")).toBe(false);
    expect(fuerKontrolle("nachweis_arbeitsbedingungen", "zoll")).toBe(true);
    expect(fuerKontrolle("haccp", "hygiene")).toBe(true);
    expect(fuerKontrolle("unterweisung", "bg")).toBe(true);
    expect(fuerKontrolle("rechnung", "alle")).toBe(false);
  });
  it("nennt offene Pflichten mit Vorlage, die in der Mappe fehlen", () => {
    const offen = [
      { id: "p1", titel: "Gefährdungsbeurteilung", vorlagen: ["gefaehrdungsbeurteilung"] },
      { id: "p2", titel: "Allergene", vorlagen: ["allergene"] },
      { id: "p3", titel: "Unterweisung", vorlagen: ["unterweisung"] },
      { id: "p4", titel: "Rechnung", vorlagen: ["rechnung"] },
    ];
    expect(fehltInMappe(offen, [e("unterweisung")], "alle").map((x) => x.vorlage)).toEqual(["gefaehrdungsbeurteilung", "allergene"]);
    expect(fehltInMappe(offen, [], "hygiene").map((x) => x.vorlage)).toEqual(["allergene"]);
  });
});

describe("Datenschutzhinweis nach Art. 13 (Recht #2, #3)", () => {
  it("nennt Rechtsgrundlagen, Empfänger, Speicherdauer, Bereitstellung und automatisierte Entscheidungen", () => {
    const titel = DATENSCHUTZ.abschnitte.map((a) => a.titel);
    for (const t of ["Rechtsgrundlagen", "Empfänger und Drittland", "Speicherdauer", "Musst du Daten angeben?", "Keine automatisierte Entscheidung", "Deine Rechte"]) expect(titel).toContain(t);
    const text = DATENSCHUTZ.abschnitte.map((a) => a.text).join(" ");
    expect(text).toContain("RevenueCat, Inc., USA");
    // Vorprüfung 21.10.2026: mit Fundstelle (Durchführungsbeschluss (EU) 2021/914, Modul 2)
    expect(text).toContain("Standardvertragsklauseln der EU-Kommission (Durchführungsbeschluss (EU) 2021/914, Modul 2), Art. 46 Abs. 2 lit. c DSGVO");
    expect(text).not.toContain("[vor Veröffentlichung eintragen]");
    expect(text).toMatch(/keine eigenen Analysen/);
    // keine erfundene Zertifizierung
    expect(text).not.toMatch(/Data Privacy Framework|zertifiziert/);
  });
  it("ersetzt mit Synchronisation die Empfänger", () => {
    expect(datenschutzAbschnitte(true).find((a) => a.titel === "Empfänger und Drittland")).toBe(DATENSCHUTZ_SYNC.empfaenger);
  });
});
