/**
 * E-206 (externer Prüfer, Befund 1): Hängt die Frist einer Pflicht an einem Ereignis (Sofortmeldung am ersten Arbeitstag,
 * Unterweisung vor Arbeitsbeginn), zählt beim Auslöser „eingetreten“ auch das geplante Ereignis – sonst sah ein Betrieb,
 * der erst noch startet, genau die Pflichten nicht, die spätestens am ersten Arbeitstag fällig sind.
 */
import { StandardKalender } from "@amtlos/fristen";
import { describe, expect, it } from "vitest";
import { auswerten, type Bedingung, type Pflicht } from "../src/index.js";
import { ladeKatalog } from "./hilfen.js";

const pflicht = (ausloeser: Bedingung, bezug: { ereignis: string } | { fakt: string }) =>
  ({
    schema_version: 1, id: "test.e206", version: 1, titel: { de: "T" }, kurz: { de: "K" }, erklaerung: { de: "E" }, rechtsgrundlage: ["x"], kategorie: "personal",
    ausloeser,
    frist: { typ: "relativ", bezug, versatz: "P0D", zeitpunkt: "spaetestens", je_ereignis: "ereignis" in bezug, verschiebung: { regel: "keine", kalender: "bundeseinheitlich" } },
    wiederholung: { art: "einmalig" }, stelle: { de: "S" }, kanal: "post", kosten: null, sanktion: { text: { de: "S" }, schwere: "mittel" }, automatisierung: "hinweis",
    status_recht: "in_kraft", gueltig_ab: null, gueltig_bis: null, quellen: [], fachlich_zu_pruefen: [],
  }) as unknown as Pflicht;
const lauf = (p: Pflicht, ereignisse: { typ: string; datum: string; storniert?: boolean }[]) =>
  auswerten({ katalog: { pflichten: [p], regelwerte: [] }, fakten: { "profil.bundesland": "SN", "profil.datum": "2026-12-01" }, ereignisse, stichtag: "2026-10-26", kalender: new StandardKalender() })[0]!;
const GEPLANT = [{ typ: "einstellung", datum: "2026-12-01" }];

describe("E-206: geplantes Ereignis beim Auslöser", () => {
  it("Frist hängt am Ereignis: geplante Einstellung ⇒ gilt, Termin am geplanten Tag, Begründung als geplant markiert", () => {
    const r = lauf(pflicht({ ereignis: "einstellung", op: "eingetreten" }, { ereignis: "einstellung" }), GEPLANT);
    expect(r.ergebnis).toBe("gilt");
    expect(r.termine.map((t) => t.faellig_am)).toEqual(["2026-12-01"]);
    expect(r.begruendung).toMatchObject({ art: "ereignis", geplant: true, gefunden: "2026-12-01" });
  });
  it("Frist hängt nicht am Ereignis: geplant zählt nicht als eingetreten", () => {
    expect(lauf(pflicht({ ereignis: "einstellung", op: "eingetreten" }, { fakt: "profil.datum" }), GEPLANT).ergebnis).toBe("gilt_nicht");
  });
  it("„innerhalb“, „nicht eingetreten“, stornierte und andere Ereignisse bleiben unverändert", () => {
    const bezug = { ereignis: "einstellung" };
    expect(lauf(pflicht({ ereignis: "einstellung", op: "eingetreten", innerhalb: "P3M" }, bezug), GEPLANT).ergebnis).toBe("gilt_nicht");
    expect(lauf(pflicht({ ereignis: "einstellung", op: "nicht_eingetreten" }, bezug), GEPLANT).ergebnis).toBe("gilt");
    expect(lauf(pflicht({ ereignis: "einstellung", op: "eingetreten" }, bezug), [{ ...GEPLANT[0]!, storniert: true }]).ergebnis).toBe("gilt_nicht");
    expect(lauf(pflicht({ ereignis: "einstellung", op: "eingetreten" }, bezug), []).ergebnis).toBe("gilt_nicht");
    expect(lauf(pflicht({ ereignis: "arbeitsunfall", op: "eingetreten" }, bezug), GEPLANT).ergebnis).toBe("gilt_nicht");
  });
  it("vergangene Einstellung: Begründung ohne „geplant“ (Verhalten wie bisher)", () => {
    const r = lauf(pflicht({ ereignis: "einstellung", op: "eingetreten" }, { ereignis: "einstellung" }), [{ typ: "einstellung", datum: "2026-03-01" }, ...GEPLANT]);
    expect(r.ergebnis).toBe("gilt");
    expect(r.begruendung).not.toHaveProperty("geplant");
    expect(r.termine.map((t) => t.faellig_am)).toEqual(["2026-03-01", "2026-12-01"]);
  });
  it("Katalog: Café vor dem Start mit geplanter Einstellung – Sofortmeldung, SV-Anmeldung, Erstunterweisung, IfSG-Belehrung gelten", () => {
    const fakten = {
      "profil.taetigkeit.branchen": ["gastronomie_lebensmittel"], "profil.personal.sofortmeldebranchen": ["gastronomie"], "profil.ifsg.beschaeftigte": "erstmals",
      "profil.beschaeftigte.gesamt": 12, "profil.gruendungsdatum": "2026-12-01", "profil.bundesland": "SN", "profil.rechtsform": "einzelunternehmen",
    };
    const ereignisse = [{ typ: "erste_einstellung", datum: "2026-12-01" }, { typ: "einstellung", datum: "2026-12-01" }];
    const r = auswerten({ katalog: ladeKatalog(), fakten, ereignisse, stichtag: "2026-10-26", kalender: new StandardKalender() });
    const termin = (id: string) => r.find((x) => x.pflicht_id === id)!;
    for (const [id, tag] of [["personal.sofortmeldung", "2026-12-01"], ["personal.sv_anmeldung", "2027-01-12"], ["arbeitsschutz.erstunterweisung", "2026-12-01"], ["branche.gastro_ifsg_belehrung", "2026-12-01"], ["branche.gastro_ifsg_bescheinigung", "2026-11-30"]] as const) {
      expect(termin(id).ergebnis, id).toBe("gilt");
      expect(termin(id).termine.map((t) => t.faellig_am), id).toEqual([tag]);
    }
  });
});

/*
 * E-206 / T-238: Neugründer ab 2027 geben im Gründungs- und Folgejahr monatlich ab (§ 18 Abs. 2 Satz 4 UStG, C.21) – je
 * Kalenderjahr gewählt (`rhythmus.je_jahr`), auch gegen die Angabe „vierteljährlich“ und eine Vorjahressteuer bis 9.000 €.
 */
describe("E-206: Rhythmus der Voranmeldung je Kalenderjahr (Neugründer ab 2027)", () => {
  const katalog = ladeKatalog();
  const va = (fakten: Record<string, unknown>, stichtag: string, fenster?: { von: string; bis: string }) =>
    auswerten({
      katalog: { ...katalog, pflichten: katalog.pflichten.filter((p) => p.id === "steuern.ust_voranmeldung") },
      fakten: { "profil.bundesland": "SN", "profil.ust.kleinunternehmer": false, ...fakten },
      ereignisse: [],
      stichtag,
      kalender: new StandardKalender(),
      ...(fenster ? { fenster } : {}),
    })[0]!;
  const perioden = (r: ReturnType<typeof va>) => r.termine.map((t) => t.periode);
  const monate = (jahr: number) => Array.from({ length: 12 }, (_, i) => `${jahr}-${String(i + 1).padStart(2, "0")}`);

  it("Gründung 01/2027 mit Angabe „vierteljährlich“: monatlich 2027 und 2028, ab 2029 vierteljährlich – mit Hinweis", () => {
    const r = va({ "profil.gruendungsdatum": "2027-01-04", "profil.ust.voranmeldung_rhythmus": "quartalsweise" }, "2026-10-26", { von: "2027-01-01", bis: "2029-12-31" });
    expect(r.ergebnis).toBe("gilt");
    expect(r.termine[0]).toMatchObject({ periode: "2027-01", faellig_am: "2027-02-10" });
    expect(perioden(r)).toEqual([...monate(2027), ...monate(2028), "2029-Q1", "2029-Q2", "2029-Q3"]);
    expect(r.termine.find((t) => t.periode === "2028-12")!.faellig_am).toBe("2029-01-10");
    expect(r.termine.find((t) => t.periode === "2029-Q1")!.faellig_am).toBe("2029-04-10");
    expect(r.hinweis_texte).toEqual([{ de: "Hast du 2026 oder später gegründet, gibst du ab 2027 im Gründungsjahr und im Folgejahr monatlich ab (§ 18 Abs. 2 Satz 4 UStG)." }]);
  });
  it("Hinweis nur, solange ein Termin aus dem Gründungs- oder Folgejahr im Fenster liegt", () => {
    const r = va({ "profil.gruendungsdatum": "2027-01-04", "profil.ust.voranmeldung_rhythmus": "quartalsweise" }, "2029-06-01", { von: "2029-02-01", bis: "2029-12-31" });
    expect(perioden(r)).toEqual(["2029-Q1", "2029-Q2", "2029-Q3"]);
    expect(r.hinweis_texte).toBeUndefined();
  });
  it("Gründung 2026, Angabe „vierteljährlich“: 2026 vierteljährlich, 2027 monatlich (Folgejahr), 2028 wieder vierteljährlich", () => {
    const r = va({ "profil.gruendungsdatum": "2026-03-01", "profil.ust.voranmeldung_rhythmus": "quartalsweise" }, "2026-10-26", { von: "2026-04-01", bis: "2028-12-31" });
    expect(perioden(r)).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", ...monate(2027), "2028-Q1", "2028-Q2", "2028-Q3"]);
    expect(r.termine.find((t) => t.periode === "2027-01")!.faellig_am).toBe("2027-02-10");
  });
  it("Gründung 2026, Vorjahressteuer 4.000 € (sonst vierteljährlich): 2027 monatlich, ohne Hinweis", () => {
    const r = va({ "profil.gruendungsdatum": "2026-03-01", "profil.ust.zahllast_vorjahr": 4000 }, "2027-03-01", { von: "2027-01-01", bis: "2028-12-31" });
    expect(perioden(r)).toEqual(["2026-Q4", ...monate(2027), "2028-Q1", "2028-Q2", "2028-Q3"]);
    expect(r.hinweis_texte).toBeUndefined();
  });
  it("Gründung 2025: Folgejahr 2026 liegt vor 2027 – die Angabe „vierteljährlich“ gilt", () => {
    const r = va({ "profil.gruendungsdatum": "2025-02-01", "profil.ust.voranmeldung_rhythmus": "quartalsweise" }, "2026-10-26", { von: "2026-01-01", bis: "2027-12-31" });
    expect(perioden(r)).toEqual(["2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3"]);
  });
  it("ohne Startdatum: keine Neugründer-Regel, keine Rückfrage – Rhythmus wie angegeben", () => {
    const r = va({ "profil.ust.voranmeldung_rhythmus": "quartalsweise" }, "2026-10-26");
    expect(r.hinweise).not.toContain("rhythmus_unbekannt");
    expect(perioden(r)[0]).toMatch(/-Q\d$/);
  });
});
