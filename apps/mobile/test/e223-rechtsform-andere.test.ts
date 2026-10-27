/**
 * E-223 (externer Prüfer, Befund c): Rechtsform „Andere“ (AG, eG, e. V. …) blendete im Pflichten-Check Pflichten aus, die
 * für Kapitalgesellschaften bzw. juristische Personen gelten (Körperschaftsteuer, Jahresabschluss, Offenlegung,
 * Insolvenzantragspflicht, Transparenzregister, Handelsregister …). Nachgestellt über `auswertung` wie in der App.
 */
import { describe, expect, it } from "vitest";
import { auswertung, type Profil } from "../src/pflichten/check";

const STICHTAG = "2026-10-27";
const ANDERE: Profil = { "taetigkeit.branchen": ["onlinehandel"], rechtsform: "sonstige", gruendungsdatum: "2021-05-01", bundesland: "SH", "beschaeftigte.gesamt": 5, "taetigkeit.einordnung": "gewerbe" };
const alle = (a: ReturnType<typeof auswertung>) => [...a.gilt, ...a.gruendung, ...a.unbekannt, ...a.beiEinstellung];

/** gelten für eine UG/GmbH – bei „Andere“ ist offen, ob die Rechtsform dazugehört */
const GRUPPE = ["steuern.kst_erklaerung", "gesellschaft.jahresabschluss", "gesellschaft.offenlegung", "gesellschaft.insolvenzantragspflicht", "gesellschaft.transparenzregister", "gesellschaft.handelsregister_anmeldung", "gesellschaft.gf_pflichten_haftung"];

describe("E-223: Rechtsform „Andere“ blendet keine Pflicht der Kapitalgesellschaften aus", () => {
  const a = auswertung(ANDERE, STICHTAG);
  it.each(GRUPPE)("%s steht unter „hängt ab“", (id) => {
    expect(a.unbekannt.map((p) => p.id)).toContain(id);
  });
  it("Begründung nennt die Rechtsform, nicht die Bedingung „UG oder GmbH“, die für „Andere“ nie zuträfe", () => {
    const kst = a.unbekannt.find((p) => p.id === "steuern.kst_erklaerung")!;
    expect(kst.grund).toContain("„Andere“");
    expect(kst.grund).not.toMatch(/UG oder GmbH/);
    // Buchführungspflicht: weitere offene Bedingungen bleiben genannt
    const buch = a.unbekannt.find((p) => p.id === "steuern.buchfuehrungspflicht")!;
    expect(buch.grund).toContain("„Andere“");
    expect(buch.grund).not.toMatch(/Kapitalgesellschaft/);
  });
  it("die schon beantwortete Rechtsfrage wird nicht noch einmal gestellt", () => {
    for (const p of alle(a)) expect(p.offeneFragen, p.id).not.toContain("rechtsform");
  });
  it("Pflichten einer bestimmten anderen Rechtsform bleiben ausgeblendet (UG-Rücklage, eGbR, PartG mbB, Einzelunternehmen)", () => {
    const ids = alle(a).map((p) => p.id);
    for (const id of ["gesellschaft.ug_ruecklage", "gesellschaft.egbr_hinweis", "gesellschaft.partg_mbb_haftpflicht", "gesellschaft.gesellschaftsvertrag_ohg_kg", "steuern.est_erklaerung"]) expect(ids, id).not.toContain(id);
  });
  it("GmbH und Einzelunternehmen unverändert", () => {
    const gmbh = auswertung({ ...ANDERE, rechtsform: "gmbh" }, STICHTAG);
    expect(gmbh.gilt.map((p) => p.id)).toContain("steuern.kst_erklaerung");
    const eu = auswertung({ ...ANDERE, rechtsform: "einzelunternehmen" }, STICHTAG);
    expect(alle(eu).map((p) => p.id)).not.toContain("steuern.kst_erklaerung");
    expect(alle(eu).map((p) => p.id)).toContain("steuern.est_erklaerung");
  });
});
