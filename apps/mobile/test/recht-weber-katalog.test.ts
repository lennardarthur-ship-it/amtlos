/**
 * Prüfvermerk RA Dr. Ulrich Weber (22.10.2026): NIS2-Registrierung drei Monate ab Betroffenheit (neue Angabe
 * nis2.betroffen_seit), GPSR-Auslöser getrennt nach Händler, Hersteller und Fernabsatz, VSBG-Hinweis über die Website,
 * Scheinselbstständigkeit nur auf der Freelancer-Seite.
 */
import { describe, expect, it } from "vitest";
import { auswertung, checkFragen, type Profil } from "../src/pflichten/check";

const alle = (a: ReturnType<typeof auswertung>) => [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt];
const finde = (a: ReturnType<typeof auswertung>, id: string) => alle(a).find((p) => p.id === id);
const ids = (l: { id: string }[]) => l.map((p) => p.id);

const nis2: Profil = { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "gmbh", "taetigkeit.einordnung": "gewerbe", bundesland: "BW", "beschaeftigte.gesamt": 60, gruendungsdatum: "2015-01-01", "nis2.betroffen": "ja" };
const shop: Profil = { "taetigkeit.branchen": ["onlinehandel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 0, gruendungsdatum: "2024-03-01", "kunden.segmente": ["b2c"], "produkte.arten": ["physisch"] };

describe("Prüfvermerk Recht: NIS2-Registrierung ab Betroffenheit", () => {
  it("fragt den Beginn der Betroffenheit nur, wenn NIS2 gilt", () => {
    const feld = (p: Profil) => checkFragen(p, ["nis2.betroffen_seit"]).map((f) => f.feld);
    expect(feld(nis2)).toContain("nis2.betroffen_seit");
    expect(feld({ ...nis2, "nis2.betroffen": "nein" })).not.toContain("nis2.betroffen_seit");
    expect(feld({ ...nis2, "nis2.betroffen": "unklar" })).not.toContain("nis2.betroffen_seit");
  });
  it("ohne Datum kein Termin und die Frage offen; mit Datum drei Monate danach", () => {
    const ohne = finde(auswertung(nis2, "2026-10-22"), "it_sicherheit.nis2_registrierung")!;
    expect(ohne.naechsterTermin).toBeNull();
    expect(ohne.offeneFragen).toContain("nis2.betroffen_seit");
    const mit = finde(auswertung({ ...nis2, "nis2.betroffen_seit": "2026-09-15" }, "2026-10-22"), "it_sicherheit.nis2_registrierung")!;
    expect(mit.naechsterTermin).toBe("2026-12-15");
  });
});

describe("Prüfvermerk Recht: GPSR getrennt", () => {
  it("Händler im Laden: nur die Prüfpflicht; online kommen die Fernabsatzangaben dazu", () => {
    const laden = auswertung({ ...shop, "vertrieb.kanaele": ["ladengeschaeft"], "produkte.hersteller": false }, "2026-10-22");
    expect(ids(laden.gilt)).toContain("produkte.gpsr");
    expect(finde(laden, "produkte.gpsr_fernabsatz")).toBeUndefined();
    expect(finde(laden, "produkte.gpsr_hersteller")).toBeUndefined();
    const online = auswertung({ ...shop, "vertrieb.kanaele": ["onlineshop"], "produkte.hersteller": false }, "2026-10-22");
    expect(ids(online.gilt)).toEqual(expect.arrayContaining(["produkte.gpsr", "produkte.gpsr_fernabsatz"]));
  });
  it("Herstellerpflichten nur mit eigener Herstellung, Eigenmarke oder Import", () => {
    const eigen = auswertung({ ...shop, "vertrieb.kanaele": ["onlineshop"], "produkte.hersteller": true }, "2026-10-22");
    expect(ids(eigen.gilt)).toContain("produkte.gpsr_hersteller");
  });
});

describe("Prüfvermerk Recht: geänderte Auslöser", () => {
  it("VSBG-Hinweis setzt eine Website voraus", () => {
    const ohneWebsite = auswertung({ ...shop, "beschaeftigte.gesamt": 20, "online.website": false, "vertrieb.kanaele": ["ladengeschaeft"] }, "2026-10-22");
    expect(finde(ohneWebsite, "online.vsbg_hinweis")).toBeUndefined();
  });
  it("Scheinselbstständigkeit nur für Freelancer mit einem Auftraggeber, nicht für Arbeitgeber", () => {
    const agentur: Profil = { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "gmbh", "taetigkeit.einordnung": "gewerbe", bundesland: "BW", "beschaeftigte.gesamt": 5, gruendungsdatum: "2020-01-01" };
    expect(finde(auswertung(agentur, "2026-10-22"), "branche.it_scheinselbststaendigkeit")).toBeUndefined();
    const freelancer: Profil = { ...agentur, rechtsform: "einzelunternehmen", "beschaeftigte.gesamt": 0, "rentenversicherung.pflichtgruppe": ["ein_auftraggeber"] };
    expect(ids(auswertung(freelancer, "2026-10-22").gilt)).toContain("branche.it_scheinselbststaendigkeit");
  });
});
