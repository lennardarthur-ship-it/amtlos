/**
 * E-223 (externer Prüfer, Befund c): Rechtsform „Andere“ (AG, eG, e. V. …) blendete Pflichten aus, die an der Gruppe der
 * Rechtsform hängen (Kapitalgesellschaft, haftungsbeschränkt, eingetragene Gesellschaft). „Andere“ sagt nur, dass es keine
 * der aufgezählten Rechtsformen ist – die Gruppen bleiben unbekannt (E-033), die Pflichten „hängen ab“.
 */
import { StandardKalender } from "@amtlos/fristen";
import { describe, expect, it } from "vitest";
import { auswerten, mitAbgeleitetenFakten } from "../src/index.js";
import { ladeKatalog } from "./hilfen.js";

const GRUPPEN = ["abgeleitet.ist_kapitalgesellschaft", "abgeleitet.ist_kapitalgesellschaft_oder_co_kg", "abgeleitet.ist_eingetragene_gesellschaft"];

describe("E-223: Rechtsform „Andere“", () => {
  it("die drei Gruppen der Rechtsform bleiben unbekannt", () => {
    const f = mitAbgeleitetenFakten({ "profil.rechtsform": "sonstige" }, "2026-10-27");
    for (const g of GRUPPEN) expect(f[g], g).toBeUndefined();
  });
  it("bekannte Rechtsformen unverändert", () => {
    expect(mitAbgeleitetenFakten({ "profil.rechtsform": "gmbh" }, "2026-10-27")["abgeleitet.ist_kapitalgesellschaft"]).toBe(true);
    expect(mitAbgeleitetenFakten({ "profil.rechtsform": "einzelunternehmen" }, "2026-10-27")["abgeleitet.ist_eingetragene_gesellschaft"]).toBe(false);
  });
  it("Körperschaftsteuer, Jahresabschluss, Offenlegung, Insolvenzantrag, Transparenzregister: „hängt ab“ statt „trifft nicht zu“", () => {
    const katalog = ladeKatalog();
    const fakten = { "profil.rechtsform": "sonstige", "profil.gruendungsdatum": "2021-05-01", "profil.taetigkeit.einordnung": "gewerbe", "profil.bundesland": "SH" };
    const e = auswerten({ katalog, fakten, ereignisse: [], stichtag: "2026-10-27", kalender: new StandardKalender() });
    const ergebnis = (id: string) => e.find((x) => x.pflicht_id === id)?.ergebnis;
    for (const id of ["steuern.kst_erklaerung", "gesellschaft.jahresabschluss", "gesellschaft.offenlegung", "gesellschaft.insolvenzantragspflicht", "gesellschaft.transparenzregister", "gesellschaft.handelsregister_anmeldung"])
      expect(ergebnis(id), id).toBe("unbekannt");
    // Vergleiche mit einer bestimmten Rechtsform bleiben entschieden: „Andere“ ist keine UG
    expect(ergebnis("gesellschaft.ug_ruecklage")).toBe("gilt_nicht");
  });
});
