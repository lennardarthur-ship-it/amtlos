/**
 * E-176 (23.10.2026): OHG und KG als eigene Rechtsform statt „Andere“ – Fragen im Check, Pflichten und Rechtsform-Text
 * für „Mein Betrieb“ bzw. Gewerbeanmeldung.
 */
import { bilanzierend, LEERER_BETRIEB } from "@amtlos/fachlogik";
import { describe, expect, it } from "vitest";
import { rechtsformFuer } from "../src/gewerbe/felder";
import { auswertung, checkFragen, CHECK_FELDER, type Profil } from "../src/pflichten/check";

const alle = (a: ReturnType<typeof auswertung>) => [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt];
const ids = (a: ReturnType<typeof auswertung>) => alle(a).map((p) => p.id);
const felder = (p: Profil) => checkFragen(p, CHECK_FELDER).map((x) => x.feld);

const ohg: Profil = { "taetigkeit.branchen": ["onlinehandel"], rechtsform: "ohg", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 0, gruendungsdatum: "2024-03-01", "gesellschaft.handelsregister": "eingetragen" };

describe("E-176: OHG und KG", () => {
  it("fragt nach dem Register und weiter nach Gewerbe oder freiem Beruf (nicht kraft Rechtsform gewerblich)", () => {
    for (const rechtsform of ["ohg", "kg"]) {
      const f = felder({ "taetigkeit.branchen": ["handwerk"], rechtsform });
      expect(f).toContain("gesellschaft.handelsregister");
      expect(f).toContain("taetigkeit.einordnung");
    }
  });

  it("Buchführung, E-Bilanz, Feststellung und Transparenzregister – keine EÜR, keine Pflichten der GmbH & Co. KG", () => {
    for (const rechtsform of ["ohg", "kg"]) {
      const a = ids(auswertung({ ...ohg, rechtsform }, "2026-10-23"));
      for (const id of ["steuern.buchfuehrungspflicht", "steuern.e_bilanz", "steuern.feststellungserklaerung", "gesellschaft.transparenzregister"]) expect(a, `${rechtsform}: ${id}`).toContain(id);
      for (const id of ["steuern.euer", "steuern.est_erklaerung", "steuern.kst_erklaerung", "gesellschaft.offenlegung", "gesellschaft.insolvenzantragspflicht", "gesellschaft.handelsregister_anmeldung"]) expect(a, `${rechtsform}: ${id}`).not.toContain(id);
    }
  });

  it("noch nicht eingetragen: Handelsregisteranmeldung", () => {
    expect(ids(auswertung({ ...ohg, rechtsform: "kg", "gesellschaft.handelsregister": "beantragt" }, "2026-10-23"))).toContain("gesellschaft.handelsregister_anmeldung");
  });

  it("„Andere“ löst die Buchführungspflicht nicht mehr aus", () => {
    const a = auswertung({ ...ohg, rechtsform: "sonstige" }, "2026-10-23");
    expect(a.gilt.map((p) => p.id)).not.toContain("steuern.buchfuehrungspflicht");
  });

  it("Rechtsform aus dem Check für die Gewerbeanmeldung und die Gewinnermittlung (Bilanz)", () => {
    expect(rechtsformFuer(undefined, LEERER_BETRIEB, { rechtsform: "ohg" })).toBe("OHG");
    expect(rechtsformFuer(undefined, LEERER_BETRIEB, { rechtsform: "kg" })).toBe("KG");
    expect(bilanzierend({ rechtsform: rechtsformFuer(undefined, LEERER_BETRIEB, { rechtsform: "kg" }) })).toBe(true);
  });
});
