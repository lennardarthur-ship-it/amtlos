import { describe, expect, it } from "vitest";
import { dokumentHtml, vorlageFuer } from "@amtlos/fachlogik";
import { fehltFuer, NUMMER_DOPPELT } from "../src/unterlagen/pruefung";
import { LEERER_STAND, anlegen, ausgeben, betriebSetzen, felderSetzen, istLesbar, kopieren, loeschen, nummerDoppelt, profilSetzen, stornieren } from "../src/unterlagen/speicher";

const B = { ...LEERER_STAND.betrieb, name: "Café Mond GmbH", strasse: "Markt 2", plz: "80331", ort: "München", steuernummer: "143/123/45678", rechtsform: "GmbH", registergericht: "Amtsgericht München", registernummer: "HRB 123456", vertretung: "Robin Beispiel" };
const t = (h: string) => new Date(`2026-10-12T${h}:00Z`);

function rechnung() {
  const [s0, u] = anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("08:00"), "r1");
  return felderSetzen(s0, u.id, { kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3\n80333 München", positionen: [{ bezeichnung: "Kaffee", menge: "2", einheit: "", preis: "10,00", satz: "19" }] }, t("08:01"));
}

describe("Rechnungen nach GoBD (E-127)", () => {
  it("schreibt beim Teilen fest: danach weder ändern noch löschen", () => {
    let s = rechnung();
    expect(fehltFuer(s, s.unterlagen[0]!)).toEqual([]);
    s = ausgeben(s, "r1", t("09:00"));
    const u = s.unterlagen[0]!;
    expect(u.festgeschrieben).toBe(t("09:00").toISOString());
    expect(u.ausgegeben).toBe(t("09:00").toISOString());
    s = felderSetzen(s, "r1", { kunde_name: "Jemand anders" }, t("10:00"));
    expect(s.unterlagen[0]!.daten.kunde_name).toBe("Kim Beispiel");
    s = loeschen(s, "r1");
    expect(s.unterlagen.map((x) => x.id)).toEqual(["r1"]);
    // erneutes Teilen ändert den Zeitpunkt nicht
    expect(ausgeben(s, "r1", t("11:00")).unterlagen[0]!.festgeschrieben).toBe(t("09:00").toISOString());
  });

  it("vergibt eine geteilte Nummer nie wieder – auch nicht nach einem Löschversuch", () => {
    let s = ausgeben(rechnung(), "r1", t("09:00"));
    s = loeschen(s, "r1");
    const [, neu] = anlegen(s, "rechnung", t("12:00"), "r2");
    expect(neu.daten.nummer).toBe("2026-002");
    // ein nie geteilter Entwurf darf gelöscht werden; seine Nummer war nie draußen
    const [s3] = anlegen(s, "rechnung", t("12:00"), "r2");
    expect(loeschen(s3, "r2").unterlagen.map((x) => x.id)).toEqual(["r1"]);
  });

  it("korrigiert nur per Stornorechnung mit neuer Nummer und negativen Beträgen", () => {
    let s = ausgeben(rechnung(), "r1", t("09:00"));
    expect(stornieren(rechnung(), "r1", t("10:00"))[1]).toBeNull(); // nicht festgeschrieben: kein Storno nötig
    const [s2, st] = stornieren(s, "r1", t("10:00"), "st");
    s = s2;
    expect(st!.daten.nummer).toBe("2026-002");
    expect(st!.daten.storno_zu).toBe("2026-001");
    expect((st!.daten.positionen as { preis: string }[])[0]!.preis).toBe("-10,00");
    expect(s.unterlagen.find((x) => x.id === "r1")!.storniertDurch).toBe("st");
    expect(stornieren(s, "r1", t("11:00"))[1]).toBeNull(); // nur einmal
    const html = dokumentHtml(vorlageFuer("rechnung")!, st!.daten, B).replace(/\u00a0|\u202f/g, " ");
    expect(html).toContain("Stornorechnung 2026-002");
    expect(html).toContain("storniert die Rechnung Nr. 2026-001");
    expect(html).toContain("-23,80 €");
    // ein verworfener Storno-Entwurf gibt die Rechnung wieder frei
    expect(loeschen(s, "st").unterlagen.find((x) => x.id === "r1")!.storniertDurch).toBeUndefined();
  });

  it("setzt die Angaben der Gesellschaft auf die Rechnung und schreibt das Leistungsdatum aus", () => {
    const s = rechnung();
    const html = dokumentHtml(vorlageFuer("rechnung")!, s.unterlagen[0]!.daten, B);
    expect(html).toContain("Sitz München · Amtsgericht München HRB 123456 · Geschäftsführung: Robin Beispiel");
    expect(html).toContain("Leistungsdatum");
    expect(html).not.toContain("= Rechnungsdatum");
  });

  it("erkennt doppelte Nummern und nimmt die Kleinunternehmer-Angabe aus dem Check", () => {
    let s = rechnung();
    const [s2] = anlegen(s, "rechnung", t("12:00"), "r2");
    s = felderSetzen(s2, "r2", { nummer: "2026-001" }, t("12:01"));
    expect(nummerDoppelt(s, s.unterlagen.find((x) => x.id === "r2")!)).toBe(true);
    expect(fehltFuer(s, s.unterlagen.find((x) => x.id === "r2")!)).toContain(NUMMER_DOPPELT);
    const ku = profilSetzen(LEERER_STAND, { "ust.kleinunternehmer": true });
    expect(anlegen(ku, "rechnung", t("08:00"))[1].daten.kleinunternehmer).toBe(true);
    expect(anlegen(LEERER_STAND, "rechnung", t("08:00"))[1].daten.kleinunternehmer).toBe(false);
  });

  it("kopiert festgeschriebene Rechnungen als neuen Entwurf", () => {
    const s = ausgeben(rechnung(), "r1", t("09:00"));
    const [, k] = kopieren(s, "r1", t("10:00"), "k");
    expect(k!.festgeschrieben).toBeUndefined();
    expect(k!.ausgegeben).toBeUndefined();
    expect(k!.daten.nummer).toBe("2026-002");
  });

  it("überschreibt unlesbare gespeicherte Daten nicht", () => {
    expect(istLesbar(null)).toBe(true);
    expect(istLesbar('{"version":1}')).toBe(true);
    expect(istLesbar("{kaputt")).toBe(false);
    expect(istLesbar('"text"')).toBe(false);
  });
});
