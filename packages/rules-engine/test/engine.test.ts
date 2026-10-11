import { StandardKalender } from "@amtlos/fristen";
import { describe, expect, it } from "vitest";
import {
  Regelwerte,
  auswerten,
  entscheidendeSaetze,
  nicht,
  oder,
  und,
  werteAus,
  type Bedingung,
  type Ergebnis,
  type Pflicht,
} from "../src/index.js";

const ALLE: Ergebnis[] = ["gilt", "gilt_nicht", "unbekannt"];

describe("Dreiwertige Logik", () => {
  it("und/oder/nicht nach Kleene", () => {
    const tabelleUnd: Record<string, Ergebnis> = {
      "gilt,gilt": "gilt", "gilt,gilt_nicht": "gilt_nicht", "gilt,unbekannt": "unbekannt",
      "gilt_nicht,gilt_nicht": "gilt_nicht", "gilt_nicht,unbekannt": "gilt_nicht", "unbekannt,unbekannt": "unbekannt",
    };
    const tabelleOder: Record<string, Ergebnis> = {
      "gilt,gilt": "gilt", "gilt,gilt_nicht": "gilt", "gilt,unbekannt": "gilt",
      "gilt_nicht,gilt_nicht": "gilt_nicht", "gilt_nicht,unbekannt": "unbekannt", "unbekannt,unbekannt": "unbekannt",
    };
    for (const a of ALLE)
      for (const b of ALLE) {
        const key = [a, b].sort((x, y) => ALLE.indexOf(x) - ALLE.indexOf(y)).join(",");
        expect(und([a, b])).toBe(tabelleUnd[key]);
        expect(oder([a, b])).toBe(tabelleOder[key]);
      }
    expect(ALLE.map(nicht)).toEqual(["gilt_nicht", "gilt", "unbekannt"]);
    expect(und([])).toBe("gilt");
    expect(oder([])).toBe("gilt_nicht");
  });
});

const regelwerte = new Regelwerte([
  { id: "test.grenze", version: 1, wert: 100, gueltig_ab: "2026-01-01", gueltig_bis: "2026-12-31" },
  { id: "test.grenze", version: 2, wert: 120, gueltig_ab: "2027-01-01", gueltig_bis: null },
]);
const ctx = (fakten: Record<string, unknown>, stichtag = "2026-10-11", ereignisse: { typ: string; datum: string; storniert?: boolean }[] = []) => ({
  fakten,
  ereignisse,
  stichtag,
  regelwerte,
});
const e = (b: Bedingung, f: Record<string, unknown>, stichtag?: string, ev?: { typ: string; datum: string; storniert?: boolean }[]) =>
  werteAus(b, ctx(f, stichtag, ev)).ergebnis;

describe("Vergleiche", () => {
  it("vergleicht Zahlen, Texte, Datumswerte und Listen", () => {
    expect(e({ feld: "profil.x", op: ">", wert: 5 }, { "profil.x": 6 })).toBe("gilt");
    expect(e({ feld: "profil.x", op: ">", wert: 5 }, { "profil.x": 5 })).toBe("gilt_nicht");
    expect(e({ feld: "profil.x", op: ">=", wert: 5 }, { "profil.x": 5 })).toBe("gilt");
    expect(e({ feld: "profil.d", op: "<", wert: "2026-01-01" }, { "profil.d": "2025-12-31" })).toBe("gilt");
    expect(e({ feld: "profil.r", op: "in", wert: ["ug", "gmbh"] }, { "profil.r": "ug" })).toBe("gilt");
    expect(e({ feld: "profil.r", op: "nicht_in", wert: ["ug", "gmbh"] }, { "profil.r": "ug" })).toBe("gilt_nicht");
    expect(e({ feld: "profil.l", op: "enthaelt", wert: "b2c" }, { "profil.l": ["b2b", "b2c"] })).toBe("gilt");
    expect(e({ feld: "profil.l", op: "enthaelt_eines", wert: ["eu", "drittland"] }, { "profil.l": ["inland"] })).toBe("gilt_nicht");
    expect(e({ feld: "profil.b", op: "==", wert: false }, { "profil.b": false })).toBe("gilt");
  });

  it("liefert unbekannt bei fehlendem Fakt, null oder falschem Typ – nie gilt_nicht", () => {
    expect(e({ feld: "profil.x", op: ">", wert: 5 }, {})).toBe("unbekannt");
    expect(e({ feld: "profil.x", op: "==", wert: false }, { "profil.x": null })).toBe("unbekannt");
    expect(e({ feld: "profil.x", op: ">", wert: 5 }, { "profil.x": "viel" })).toBe("unbekannt");
    expect(e({ feld: "profil.l", op: "enthaelt", wert: "b2c" }, { "profil.l": "b2c" })).toBe("unbekannt");
    expect(e({ not: { feld: "profil.x", op: ">", wert: 5 } }, {})).toBe("unbekannt");
  });

  it("vorhanden/nicht_vorhanden sind nie unbekannt", () => {
    expect(e({ feld: "profil.x", op: "vorhanden" }, {})).toBe("gilt_nicht");
    expect(e({ feld: "profil.x", op: "nicht_vorhanden" }, { "profil.x": null })).toBe("gilt");
    expect(e({ feld: "profil.x", op: "vorhanden" }, { "profil.x": 0 })).toBe("gilt");
  });

  it("löst Regelwerte zum Stichtag auf, inklusive Faktor", () => {
    const b: Bedingung = { feld: "profil.x", op: ">", wert: { regelwert: "test.grenze" } };
    expect(e(b, { "profil.x": 110 }, "2026-12-31")).toBe("gilt");
    expect(e(b, { "profil.x": 110 }, "2027-01-01")).toBe("gilt_nicht");
    expect(e(b, { "profil.x": 110 }, "2025-06-01")).toBe("unbekannt"); // keine Version gültig
    expect(e({ feld: "profil.x", op: ">=", wert: { regelwert: "test.grenze", faktor: 0.8 } }, { "profil.x": 80 })).toBe("gilt");
    const k = werteAus(b, ctx({ "profil.x": 110 }, "2027-03-01"));
    expect(k).toMatchObject({ art: "vergleich", regelwert: { id: "test.grenze", version: 2, wert: 120 }, soll: 120 });
  });

  it("bricht ab, wenn zwei Regelwert-Versionen gleichzeitig gelten", () => {
    const kaputt = new Regelwerte([
      { id: "x.y", version: 1, wert: 1, gueltig_ab: "2026-01-01" },
      { id: "x.y", version: 2, wert: 2, gueltig_ab: "2026-06-01" },
    ]);
    expect(() => kaputt.zumStichtag("x.y", "2026-07-01")).toThrow(/gleichzeitig/);
  });
});

describe("Ereignistests", () => {
  const ev = [
    { typ: "einstellung", datum: "2026-03-01" },
    { typ: "einstellung", datum: "2026-12-01" },
    { typ: "datenpanne", datum: "2026-10-01", storniert: true },
  ];
  it("unterscheidet vergangen, geplant, Zeitraum und Storno", () => {
    expect(e({ ereignis: "einstellung", op: "eingetreten" }, {}, "2026-10-11", ev)).toBe("gilt");
    expect(e({ ereignis: "einstellung", op: "eingetreten", innerhalb: "P3M" }, {}, "2026-10-11", ev)).toBe("gilt_nicht");
    expect(e({ ereignis: "einstellung", op: "geplant" }, {}, "2026-10-11", ev)).toBe("gilt");
    expect(e({ ereignis: "datenpanne", op: "eingetreten" }, {}, "2026-10-11", ev)).toBe("gilt_nicht");
    expect(e({ ereignis: "datenpanne", op: "nicht_eingetreten" }, {}, "2026-10-11", ev)).toBe("gilt");
  });
});

describe("Erklärung", () => {
  const b: Bedingung = {
    all: [
      { feld: "profil.a", op: "==", wert: true, label: { de: "A ist wahr.", en: "A is true." } },
      { any: [
        { feld: "profil.b", op: ">", wert: 1, label: { de: "B ist groß." } },
        { feld: "profil.c", op: "==", wert: true, label: { de: "C ist wahr." } },
      ] },
    ],
  };
  it("nennt die tragenden Sätze", () => {
    expect(entscheidendeSaetze(werteAus(b, ctx({ "profil.a": true, "profil.b": 5, "profil.c": true })))).toEqual(["A ist wahr.", "B ist groß."]);
    expect(entscheidendeSaetze(werteAus(b, ctx({ "profil.a": true, "profil.b": 5 })), "en")).toEqual(["A is true.", "B ist groß."]);
    expect(entscheidendeSaetze(werteAus(b, ctx({ "profil.a": false, "profil.b": 5 })))).toEqual(["A ist wahr."]);
    expect(entscheidendeSaetze(werteAus(b, ctx({ "profil.a": true, "profil.b": 0 })))).toEqual(["C ist wahr."]);
  });
});

describe("Gültigkeit und Radar", () => {
  const basis: Omit<Pflicht, "id" | "status_recht" | "gueltig_ab"> = {
    schema_version: 1,
    version: 1,
    titel: { de: "T" },
    kurz: { de: "K" },
    erklaerung: { de: "E" },
    rechtsgrundlage: ["§ 1"],
    kategorie: "steuern",
    ausloeser: { immer: true },
    frist: { typ: "dauerhaft" },
    wiederholung: { art: "dauerhaft" },
    sanktion: { text: { de: "S" }, schwere: "niedrig" },
  };
  const katalog = {
    regelwerte: [],
    pflichten: [
      { ...basis, id: "a.in_kraft", status_recht: "in_kraft", gueltig_ab: "2020-01-01" },
      { ...basis, id: "a.zukunft", status_recht: "in_kraft", gueltig_ab: "2027-01-01" },
      { ...basis, id: "a.ausgelaufen", status_recht: "in_kraft", gueltig_ab: "2020-01-01", gueltig_bis: "2025-12-31" },
      { ...basis, id: "a.entwurf", status_recht: "entwurf", gueltig_ab: "2027-01-01" },
    ] as Pflicht[],
  };
  it("nimmt nur geltende Pflichten auf und markiert Entwürfe als Radar", () => {
    const r = auswerten({ katalog, fakten: {}, ereignisse: [], stichtag: "2026-10-11", kalender: new StandardKalender() });
    expect(r.map((x) => [x.pflicht_id, x.radar])).toEqual([
      ["a.in_kraft", false],
      ["a.entwurf", true],
    ]);
  });
});

describe("Termine", () => {
  it("keine Perioden vor der Gründung", () => {
    const p = {
      schema_version: 1, id: "t.monatlich", version: 1, titel: { de: "T" }, kurz: { de: "K" }, erklaerung: { de: "E" },
      rechtsgrundlage: ["§ 1"], kategorie: "steuern", ausloeser: { immer: true },
      frist: { typ: "wiederkehrend", rhythmus: "monatlich", faellig: { art: "tag_nach_periodenende", tag: 10 }, verschiebung: { regel: "keine", kalender: "bundeseinheitlich" } },
      wiederholung: { art: "periodisch" }, sanktion: { text: { de: "S" }, schwere: "mittel" }, status_recht: "in_kraft", gueltig_ab: null,
    } as Pflicht;
    const r = auswerten({
      katalog: { pflichten: [p], regelwerte: [] },
      fakten: { "profil.gruendungsdatum": "2026-09-15" },
      ereignisse: [],
      stichtag: "2026-10-11",
      kalender: new StandardKalender(),
      fenster: { von: "2026-01-01", bis: "2026-12-31" },
    });
    expect(r[0]!.termine.map((t) => t.periode)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(r[0]!.termine.every((t) => !t.vorlaeufig)).toBe(true);
  });
});

describe("Eine Instanz je Ereignis (je_ereignis)", () => {
  const p = {
    schema_version: 1, id: "test.je_ereignis", version: 1, titel: { de: "T" }, kurz: { de: "K" }, erklaerung: { de: "E" }, rechtsgrundlage: ["x"], kategorie: "personal",
    ausloeser: { ereignis: "einstellung", op: "eingetreten" },
    frist: { typ: "relativ", bezug: { ereignis: "einstellung" }, versatz: "P3D", je_ereignis: true, verschiebung: { regel: "keine", kalender: "bundeseinheitlich" } },
    wiederholung: { art: "einmalig" }, stelle: { de: "S" }, kanal: "post", kosten: null, sanktion: { text: { de: "S" }, schwere: "mittel" }, automatisierung: "hinweis",
    status_recht: "in_kraft", gueltig_ab: null, gueltig_bis: null, quellen: [], fachlich_zu_pruefen: [],
  } as unknown as Pflicht;
  const lauf = (ereignisse: { typ: string; datum: string; storniert?: boolean }[]) =>
    auswerten({ katalog: { pflichten: [p], regelwerte: [] }, fakten: { "profil.bundesland": "BE" }, ereignisse, stichtag: "2026-10-11", kalender: new StandardKalender() })[0]!;

  it("erzeugt je Ereignis einen Termin, stornierte und doppelte Tage zählen nicht", () => {
    const r = lauf([
      { typ: "einstellung", datum: "2026-09-01" },
      { typ: "einstellung", datum: "2026-09-01" },
      { typ: "einstellung", datum: "2026-10-01", storniert: true },
      { typ: "einstellung", datum: "2026-11-02" },
    ]);
    expect(r.termine.map((t) => [t.periode, t.faellig_am])).toEqual([["aenderung-20260901", "2026-09-04"], ["aenderung-20261102", "2026-11-05"]]);
  });

  it("ohne Ereignis: kein Termin und ein Hinweis", () => {
    const r = lauf([]);
    expect(r.termine).toEqual([]);
  });
});
