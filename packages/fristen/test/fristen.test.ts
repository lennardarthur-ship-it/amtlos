import { describe, expect, it } from "vitest";
import {
  StandardKalender,
  differenzTage,
  gesetzlicheFeiertage,
  ostersonntag,
  parseDauer,
  perioden,
  plusDauer,
  plusMonate,
  relativerTermin,
  rohtermin,
  verschiebe,
  wiederkehrendeTermine,
  wochentag,
  zerlege,
  type Verschiebung,
} from "../src/index.js";

const kal = new StandardKalender([{ datum: "2025-08-08", name: "Augsburger Hohes Friedensfest", bundeslaender: ["BY"], ags: "09761000" }]);
const BE = { bundesland: "BE" as const };
const BW = { bundesland: "BW" as const };
const werktag: Verschiebung = { regel: "naechster_werktag", kalender: "bundesland" };

describe("Datum", () => {
  it("erkennt ungültige Daten", () => {
    expect(() => zerlege("2026-02-29")).toThrow();
    expect(() => zerlege("2026-13-01")).toThrow();
    expect(() => zerlege("26-01-01")).toThrow();
    expect(zerlege("2028-02-29")).toEqual({ jahr: 2028, monat: 2, tag: 29 });
  });

  it("berechnet Wochentage unabhängig von der Zeitzone", () => {
    expect(wochentag("2026-10-11")).toBe(0); // Sonntag
    expect(wochentag("2026-10-10")).toBe(6); // Samstag
    expect(wochentag("1970-01-01")).toBe(4);
    expect(wochentag("1969-12-31")).toBe(3);
  });

  it("wendet die Monatsende-Regel an", () => {
    expect(plusMonate("2026-01-31", 1)).toBe("2026-02-28");
    expect(plusMonate("2028-01-31", 1)).toBe("2028-02-29");
    expect(plusMonate("2026-03-31", -1)).toBe("2026-02-28");
    expect(plusMonate("2026-12-15", 1)).toBe("2027-01-15");
    expect(plusMonate("2026-01-15", -13)).toBe("2024-12-15");
  });

  it("rechnet über Jahreswechsel und Schaltjahre", () => {
    expect(differenzTage("2027-12-31", "2028-03-01")).toBe(61);
    expect(plusDauer("2026-12-28", "P7D")).toBe("2027-01-04");
  });
});

describe("Dauer", () => {
  it("parst ISO-Dauern", () => {
    expect(parseDauer("P1Y2M3W4D")).toEqual({ negativ: false, jahre: 1, monate: 2, wochen: 3, tage: 4 });
    expect(parseDauer("-P2D").negativ).toBe(true);
    expect(() => parseDauer("P")).toThrow();
    expect(() => parseDauer("PT1H")).toThrow();
  });

  it("addiert Monate vor Tagen und ist für negative Dauern symmetrisch", () => {
    expect(plusDauer("2026-01-31", "P1M1D")).toBe("2026-03-01");
    expect(plusDauer("2026-03-01", "-P1M1D")).toBe("2026-01-28");
    expect(plusDauer("2026-11-01", "P0D")).toBe("2026-11-01");
  });
});

describe("Feiertage", () => {
  it("berechnet Ostersonntag", () => {
    expect(ostersonntag(2024)).toBe("2024-03-31");
    expect(ostersonntag(2025)).toBe("2025-04-20");
    expect(ostersonntag(2026)).toBe("2026-04-05");
    expect(ostersonntag(2027)).toBe("2027-03-28");
  });

  it("leitet bewegliche Feiertage ab", () => {
    const f = Object.fromEntries(gesetzlicheFeiertage(2026).map((x) => [x.name + (x.bundeslaender?.join() ?? ""), x.datum]));
    expect(f["Karfreitag"]).toBe("2026-04-03");
    expect(f["Christi Himmelfahrt"]).toBe("2026-05-14");
    expect(f["Pfingstmontag"]).toBe("2026-05-25");
    expect(f["FronleichnamBW,BY,HE,NW,RP,SL"]).toBe("2026-06-04");
    expect(f["Buß- und BettagSN"]).toBe("2026-11-18");
  });

  it("unterscheidet Bundesländer, Gemeinden und Stichjahre", () => {
    expect(kal.feiertag("2026-06-04", "bundesland", BW)).toBe("Fronleichnam");
    expect(kal.feiertag("2026-06-04", "bundesland", BE)).toBeUndefined();
    expect(kal.feiertag("2026-06-04", "bundeseinheitlich", BW)).toBeUndefined();
    expect(kal.feiertag("2026-03-08", "bundesland", BE)).toBe("Internationaler Frauentag");
    expect(kal.feiertag("2018-03-08", "bundesland", BE)).toBeUndefined();
    expect(kal.feiertag("2025-08-08", "gemeinde", { bundesland: "BY", ags: "09761000" })).toBe("Augsburger Hohes Friedensfest");
    expect(kal.feiertag("2025-08-08", "gemeinde", { bundesland: "BY", ags: "09162000" })).toBeUndefined();
    expect(kal.feiertag("2025-08-08", "bundesland", { bundesland: "BY", ags: "09761000" })).toBeUndefined();
  });

  it("kennt Bankarbeitstage im Sinne von § 23 SGB IV (E-192)", () => {
    expect(kal.istBankarbeitstag("2026-04-03")).toBe(false); // Karfreitag
    expect(kal.istBankarbeitstag("2026-10-10")).toBe(false); // Samstag
    // anders als im TARGET-Kalender: 24. und 31. Dezember, Christi Himmelfahrt, Pfingstmontag, 3. Oktober
    expect(kal.istBankarbeitstag("2026-12-24")).toBe(false);
    expect(kal.istBankarbeitstag("2026-12-31")).toBe(false);
    expect(kal.istBankarbeitstag("2026-05-14")).toBe(false);
    expect(kal.istBankarbeitstag("2026-05-25")).toBe(false);
    // Landesfeiertage zählen am Sitz der Krankenkasse – unbekannt, also der frühere Termin (Fronleichnam in BW, BY …)
    expect(kal.istBankarbeitstag("2026-06-04")).toBe(false);
    // kommunale Feiertage zählen nicht
    expect(kal.istBankarbeitstag("2025-08-08")).toBe(true);
    expect(kal.istBankarbeitstag("2026-12-23")).toBe(true);
  });
});

describe("Verschiebung", () => {
  it("schiebt vom Wochenende auf den nächsten Werktag", () => {
    const v = verschiebe("2026-10-10", werktag, BE, kal);
    expect(v.datum).toBe("2026-10-12");
    expect(v.uebersprungen.map((u) => u.grund)).toEqual(["Samstag", "Sonntag"]);
  });

  it("überspringt Feiertage nur im passenden Bundesland", () => {
    expect(verschiebe("2026-06-04", werktag, BW, kal).datum).toBe("2026-06-05");
    expect(verschiebe("2026-06-04", werktag, BE, kal).datum).toBe("2026-06-04");
  });

  it("überspringt Ketten aus Feiertag und Wochenende", () => {
    // Karfreitag 3.4. → Sa → So → Ostermontag 6.4. → Di 7.4.
    expect(verschiebe("2026-04-03", werktag, BE, kal).datum).toBe("2026-04-07");
  });

  it("schiebt bei 'keine' nicht und rückwärts bei 'vorheriger_werktag'", () => {
    expect(verschiebe("2026-10-10", { regel: "keine", kalender: "bundesland" }, BE, kal).datum).toBe("2026-10-10");
    expect(verschiebe("2026-10-11", { regel: "vorheriger_werktag", kalender: "bundesland" }, BE, kal).datum).toBe("2026-10-09");
  });

  it("behandelt Samstag optional als Werktag", () => {
    expect(verschiebe("2026-10-10", { ...werktag, samstag_ist_werktag: true }, BE, kal).datum).toBe("2026-10-10");
  });
});

describe("Perioden", () => {
  it("bildet Monats-, Quartals-, Halbjahres- und Jahresperioden", () => {
    expect(perioden("monatlich", "2026-10-15", "2026-11-01").map((p) => p.schluessel)).toEqual(["2026-10", "2026-11"]);
    expect(perioden("quartalsweise", "2026-08-01", "2027-01-01")).toEqual([
      { schluessel: "2026-Q3", beginn: "2026-07-01", ende: "2026-09-30" },
      { schluessel: "2026-Q4", beginn: "2026-10-01", ende: "2026-12-31" },
      { schluessel: "2027-Q1", beginn: "2027-01-01", ende: "2027-03-31" },
    ]);
    expect(perioden("halbjaehrlich", "2026-07-01", "2026-07-01")[0]?.schluessel).toBe("2026-H2");
    expect(perioden("jaehrlich", "2026-01-01", "2027-06-01").map((p) => p.schluessel)).toEqual(["2026", "2027"]);
  });

  it("findet den n-letzten Bankarbeitstag", () => {
    const okt = { schluessel: "2026-10", beginn: "2026-10-01", ende: "2026-10-31" };
    expect(rohtermin(okt, { art: "n_letzter_bankarbeitstag", n: 3 }, kal)).toBe("2026-10-28");
    const dez = { schluessel: "2026-12", beginn: "2026-12-01", ende: "2026-12-31" };
    // 31.12. ist kein Bankarbeitstag (E-192; vorher fälschlich 29.12.)
    expect(rohtermin(dez, { art: "n_letzter_bankarbeitstag", n: 3 }, kal)).toBe("2026-12-28");
    expect(rohtermin(okt, { art: "n_letzter_bankarbeitstag", n: 3, arbeitstage_vorher: 2 }, kal)).toBe("2026-10-26");
  });
});

describe("Termine", () => {
  const ustVa = (rhythmus: "monatlich" | "quartalsweise", verlaengerung?: string) =>
    wiederkehrendeTermine(
      { rhythmus, faellig: { art: "tag_nach_periodenende", monate_nach: 1, tag: 10 }, verlaengerung, verschiebung: werktag },
      "2026-10-01",
      "2026-12-31",
      BE,
      kal,
    );

  it("berechnet monatliche Termine mit Verschiebung", () => {
    const t = ustVa("monatlich");
    expect(t.map((x) => [x.periode, x.faellig_am])).toEqual([
      ["2026-09", "2026-10-12"], // 10.10. ist Samstag
      ["2026-10", "2026-11-10"],
      ["2026-11", "2026-12-10"],
    ]);
    expect(t[0]?.roh).toBe("2026-10-10");
  });

  it("berechnet vierteljährliche Termine und Verlängerung", () => {
    expect(ustVa("quartalsweise").map((x) => [x.periode, x.faellig_am])).toEqual([["2026-Q3", "2026-10-12"]]);
    const mitDfv = ustVa("quartalsweise", "P1M");
    expect(mitDfv.map((x) => [x.periode, x.roh, x.verlaengert, x.faellig_am])).toEqual([["2026-Q3", "2026-10-10", "2026-11-10", "2026-11-10"]]);
  });

  it("berechnet feste Termine", () => {
    const t = wiederkehrendeTermine(
      { rhythmus: "keiner", faellig: { art: "feste_termine", termine: ["03-10", "06-10", "09-10", "12-10"] }, verschiebung: werktag },
      "2026-01-01",
      "2026-12-31",
      BE,
      kal,
    );
    expect(t.map((x) => x.faellig_am)).toEqual(["2026-03-10", "2026-06-10", "2026-09-10", "2026-12-10"]);
    expect(t.map((x) => x.periode)).toEqual(["2026-03", "2026-06", "2026-09", "2026-12"]);
  });

  it("berechnet relative Termine", () => {
    expect(relativerTermin("2026-10-05", { versatz: "P7D", verschiebung: { regel: "keine", kalender: "bundeseinheitlich" } }, BE, kal).faellig_am).toBe("2026-10-12");
    expect(relativerTermin("2026-10-03", { versatz: "P0D", verschiebung: werktag }, BE, kal).faellig_am).toBe("2026-10-05");
  });
});

/**
 * Regression E-192: Fälligkeit der Gesamtsozialversicherungsbeiträge (drittletzter Bankarbeitstag, § 23 Abs. 1 SGB IV)
 * und Eingang des Beitragsnachweises (zwei Arbeitstage davor = fünftletzter Bankarbeitstag, 0 Uhr, § 28f Abs. 3 SGB IV)
 * für alle Monate 2026 und 2027, verglichen mit den veröffentlichten Tabellen der Einzugsstellen:
 * - 2026: AOK „Termine 2026“ https://www.aok.de/fk/fileadmin/user_upload/tools/downloads/universell/aok-kalender-faelligkeiten-sv-beitraege-2026-beitragsnachweise.pdf
 *   (gleich: BKK24 https://www.bkk24.de/fileadmin/user_upload/Inhalte/Arbeitgeber/Infoblatt-Beitragsfaelligkeit-2026-RZ.pdf
 *   und https://www.informationsportal.de/wp-content/uploads/Faelligkeitstermine-Sozialversicherung-2026.pdf), abgerufen 25.10.2026
 * - 2027: AOK „Fälligkeit der Sozialversicherungsbeiträge 2027“
 *   https://www.aok.de/fk/niedersachsen/tools/weitere-inhalte/beitraege-und-rechengroessen-der-sozialversicherung/faelligkeit-der-sozialversicherungsbeitraege/werte-2027/
 *   (abgerufen 25.10.2026). Mai 2027 hat dort zwei Zeilen: 24.05./26.05. für Krankenkassen mit Sitz in einem Land mit
 *   Fronleichnam (27.05.2027), sonst 25.05./27.05. Die App kennt die Krankenkasse nicht und nimmt den früheren Termin.
 */
describe("SV-Fälligkeiten 2026 und 2027 (amtliche Tabellen, E-192)", () => {
  const TABELLE: Record<string, [nachweis: string, faellig: string]> = {
    "2026-01": ["2026-01-26", "2026-01-28"],
    "2026-02": ["2026-02-23", "2026-02-25"],
    "2026-03": ["2026-03-25", "2026-03-27"],
    "2026-04": ["2026-04-24", "2026-04-28"],
    "2026-05": ["2026-05-22", "2026-05-27"],
    "2026-06": ["2026-06-24", "2026-06-26"],
    "2026-07": ["2026-07-27", "2026-07-29"],
    "2026-08": ["2026-08-25", "2026-08-27"],
    "2026-09": ["2026-09-24", "2026-09-28"],
    "2026-10": ["2026-10-26", "2026-10-28"],
    "2026-11": ["2026-11-24", "2026-11-26"],
    "2026-12": ["2026-12-22", "2026-12-28"],
    "2027-01": ["2027-01-25", "2027-01-27"],
    "2027-02": ["2027-02-22", "2027-02-24"],
    "2027-03": ["2027-03-23", "2027-03-25"],
    "2027-04": ["2027-04-26", "2027-04-28"],
    // Zeile mit Fußnote 2 (Sitz der Krankenkasse in einem Land mit Fronleichnam) – der frühere Termin
    "2027-05": ["2027-05-24", "2027-05-26"],
    "2027-06": ["2027-06-24", "2027-06-28"],
    "2027-07": ["2027-07-26", "2027-07-28"],
    "2027-08": ["2027-08-25", "2027-08-27"],
    "2027-09": ["2027-09-24", "2027-09-28"],
    "2027-10": ["2027-10-25", "2027-10-27"],
    "2027-11": ["2027-11-24", "2027-11-26"],
    "2027-12": ["2027-12-23", "2027-12-28"],
  };
  const ohneZusatz = new StandardKalender();
  const sv = (arbeitstage_vorher?: number) =>
    wiederkehrendeTermine(
      { rhythmus: "monatlich", faellig: { art: "n_letzter_bankarbeitstag", n: 3, ...(arbeitstage_vorher ? { arbeitstage_vorher } : {}) }, verschiebung: { regel: "keine", kalender: "bankarbeitstage" } },
      "2026-01-01",
      "2027-12-31",
      {},
      ohneZusatz,
    );
  it("Fälligkeit der Beiträge (drittletzter Bankarbeitstag) wie in der Tabelle", () => {
    expect(Object.fromEntries(sv().map((t) => [t.periode, t.faellig_am]))).toEqual(Object.fromEntries(Object.entries(TABELLE).map(([m, [, f]]) => [m, f])));
  });
  it("Beitragsnachweis (zwei Arbeitstage vor Fälligkeit) wie in der Tabelle", () => {
    expect(Object.fromEntries(sv(2).map((t) => [t.periode, t.faellig_am]))).toEqual(Object.fromEntries(Object.entries(TABELLE).map(([m, [n]]) => [m, n])));
  });
  it("hängt nicht vom Bundesland des Betriebs ab (maßgeblich ist die Krankenkasse)", () => {
    for (const bundesland of ["BE", "BY", "NW", "SN"] as const) {
      const t = wiederkehrendeTermine({ rhythmus: "monatlich", faellig: { art: "n_letzter_bankarbeitstag", n: 3 }, verschiebung: { regel: "keine", kalender: "bankarbeitstage" } }, "2027-05-01", "2027-05-31", { bundesland }, ohneZusatz);
      expect(t.map((x) => x.faellig_am)).toEqual(["2027-05-26"]);
    }
  });
});

/**
 * E-192: Umsatzsteuer-Voranmeldung und Lohnsteuer-Anmeldung (10. des Folgemonats, § 18 Abs. 1 UStG, § 41a Abs. 1 EStG)
 * rechnen nicht mit Bankarbeitstagen, sondern nach § 108 Abs. 3 AO: fällt das Fristende auf einen Samstag, Sonntag oder
 * gesetzlichen Feiertag, endet sie am nächsten Werktag – 24. und 31. Dezember sind Werktage. Vergleich mit den
 * Steuerterminen 2026 der IHK Neubrandenburg (https://www.neubrandenburg.ihk.de/fileadmin/user_upload/Recht_und_Steuern/IHK-Steuerinformationen/Steuertermine-2026.pdf,
 * abgerufen 25.10.2026); 2027 nach den Wochentagen (10.01. Sonntag, 10.04. Samstag, 10.07. Samstag, 10.10. Sonntag).
 */
describe("Steuertermine am 10. (§ 108 Abs. 3 AO, E-192)", () => {
  const zehnter = (von: string, bis: string, ort = BE) =>
    wiederkehrendeTermine({ rhythmus: "monatlich", faellig: { art: "tag_nach_periodenende", monate_nach: 1, tag: 10 }, verschiebung: werktag }, von, bis, ort, new StandardKalender()).map((t) => t.faellig_am);
  it("2026 wie in der veröffentlichten Übersicht", () => {
    expect(zehnter("2026-01-01", "2026-12-31")).toEqual(["2026-01-12", "2026-02-10", "2026-03-10", "2026-04-10", "2026-05-11", "2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10", "2026-10-12", "2026-11-10", "2026-12-10"]);
  });
  it("2027 nach Wochenenden verschoben", () => {
    expect(zehnter("2027-01-01", "2027-12-31")).toEqual(["2027-01-11", "2027-02-10", "2027-03-10", "2027-04-12", "2027-05-10", "2027-06-10", "2027-07-12", "2027-08-10", "2027-09-10", "2027-10-11", "2027-11-10", "2027-12-10"]);
  });
  it("Feiertag am 10.: Christi Himmelfahrt 10.05.2029 → Freitag 11.05.2029", () => {
    expect(zehnter("2029-05-01", "2029-05-31")).toEqual(["2029-05-11"]);
  });
  it("Silvester und Heiligabend sind für § 108 Abs. 3 AO Werktage", () => {
    expect(verschiebe("2027-12-31", werktag, BE, new StandardKalender()).datum).toBe("2027-12-31");
    expect(verschiebe("2026-12-24", werktag, BE, new StandardKalender()).datum).toBe("2026-12-24");
  });
});

