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
