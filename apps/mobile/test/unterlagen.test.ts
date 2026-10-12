import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { VORLAGEN, dokumentHtml, fehlendeAngaben, leereDaten, vorlageFuer } from "@amtlos/fachlogik";
import { fussAngaben, fusszeileStempeln } from "../src/unterlagen/fusszeile";
import { pflichtenFuer, rechtsgrundlagen } from "../src/unterlagen/katalog";
import { LEERER_STAND, aendern, anlegen, betriebFehlt, betriebSetzen, felderSetzen, heute, kopieren, loeschen, personLoeschen, personMerken, personSetzen, personenSortiert, sortiert, standAus } from "../src/unterlagen/speicher";

const B = { name: "Café Mond", strasse: "Markt 2", plz: "54321", ort: "Beispielstadt", verantwortlich: "Robin Beispiel", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Hessen" };
const t = (s: string) => new Date(`2026-10-12T${s}:00Z`);

describe("Unterlagen auf dem Gerät", () => {
  it("legt eine Unterlage mit Angaben aus „Mein Betrieb“ an, ändert, kopiert und löscht sie", () => {
    let s = betriebSetzen(LEERER_STAND, B);
    const [s1, u] = anlegen(s, "unterweisung", t("08:00"), "a");
    s = s1;
    expect(u.daten.durchgefuehrt_von).toBe("Robin Beispiel");
    expect(u.daten.datum).toBe("2026-10-12");
    s = aendern(s, "a", { ...u.daten, thema: "Hygiene" }, t("09:00"));
    expect(s.unterlagen[0]!.daten.thema).toBe("Hygiene");
    const [s2, k] = kopieren(s, "a", t("10:00"), "b");
    s = s2;
    expect(k!.daten.thema).toBe("Hygiene");
    expect(k!.daten).not.toBe(s.unterlagen.find((x) => x.id === "a")!.daten);
    expect(sortiert(s).map((x) => x.id)).toEqual(["b", "a"]);
    s = loeschen(s, "b");
    expect(s.unterlagen.map((x) => x.id)).toEqual(["a"]);
    expect(() => anlegen(s, "gibt_es_nicht", t("08:00"))).toThrow();
  });

  it("liest gespeicherte Stände tolerant: Unlesbares, unbekannte Vorlagen und fremde Felder fallen weg", () => {
    expect(standAus(null)).toEqual(LEERER_STAND);
    expect(standAus("{kaputt")).toEqual(LEERER_STAND);
    const s = standAus(JSON.stringify({ version: 1, betrieb: { name: "X", boese: 1, plz: 5 }, unterlagen: [{ id: "1", vorlage: "haccp", daten: {}, erstellt: "", geaendert: "" }, { id: "2", vorlage: "weg", daten: {} }, null] }));
    expect(s.betrieb).toEqual({ ...LEERER_STAND.betrieb, name: "X" });
    expect(s.mitarbeiter).toEqual([]);
    expect(standAus(JSON.stringify({ mitarbeiter: [{ id: "m", name: "Sam", taetigkeit: "Friseur/in", boese: 1 }, { name: "ohne id" }] })).mitarbeiter).toEqual([{ id: "m", name: "Sam", taetigkeit: "Friseur/in" }]);
    expect(s.unterlagen.map((u) => u.id)).toEqual(["1"]);
    expect(betriebFehlt(s.betrieb)).toBe(false);
    expect(betriebFehlt(LEERER_STAND.betrieb)).toBe(true);
  });

  it("findet zu jeder Vorlage die Pflichten im Katalogauszug mit Rechtsgrundlage", () => {
    for (const v of VORLAGEN) {
      expect(pflichtenFuer(v).length, v.id).toBe(v.pflichten.length);
      if (v.pflichten.length) expect(rechtsgrundlagen(v).length, v.id).toBeGreaterThan(0);
    }
    expect(rechtsgrundlagen(vorlageFuer("gefaehrdungsbeurteilung")!)).toContain("§ 5 ArbSchG");
  });

  it("eine neu angelegte Unterlage nennt, was fehlt – ein leerer Betrieb füllt nichts vor", () => {
    const [, u] = anlegen(LEERER_STAND, "unterweisung", t("08:00"));
    expect(u.daten.durchgefuehrt_von).toBe("");
    expect(fehlendeAngaben(vorlageFuer("unterweisung")!, u.daten)).toEqual(["Bezeichnung", "Durchgeführt von"]);
  });

  it("nimmt das Datum in deutscher Zeit", () => {
    expect(heute(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
  });

  it("setzt die Fußzeile mit Seitenzahlen auf jede Seite und liest die Angaben aus dem Dokument", async () => {
    const v = vorlageFuer("gefaehrdungsbeurteilung")!;
    const html = dokumentHtml(v, { ...leereDaten(v, B, "2026-10-12"), arbeitsbereich: "Küche" }, B);
    expect(fussAngaben(html)).toEqual({ links: "Café Mond · Gefährdungsbeurteilung", rechts: "Stand 12.10.2026" });
    const roh = await PDFDocument.create();
    roh.addPage([595, 842]);
    roh.addPage([595, 842]);
    const vorher = await roh.save();
    const nachher = await fusszeileStempeln(vorher, "Café Mond · Gefährdungsbeurteilung 🙂", "Stand 12.10.2026");
    const neu = await PDFDocument.load(nachher);
    expect(neu.getPageCount()).toBe(2);
    expect(nachher.length).toBeGreaterThan(vorher.length);
  });

  it("zählt Rechnungsnummern beim Anlegen und Kopieren weiter", () => {
    const jetzt = new Date("2026-10-12T08:00:00Z");
    const [s0, a] = anlegen(LEERER_STAND, "rechnung", jetzt, "a");
    let s = s0;
    expect(a.daten.nummer).toBe("2026-001");
    s = felderSetzen(s, "a", { nummer: "2026-041" }, jetzt);
    const [s2, b] = anlegen(s, "rechnung", jetzt, "b");
    expect(b.daten.nummer).toBe("2026-042");
    const [, k] = kopieren(s2, "a", jetzt, "k");
    expect(k!.daten.nummer).toBe("2026-043");
    // andere Vorlagen bekommen keine Nummer
    expect(anlegen(s, "kassenbuch", jetzt, "c")[1].daten.nummer).toBeUndefined();
  });

  it("setzt Felder auf Basis des aktuellen Stands, ohne andere Angaben zu verlieren", () => {
    const [s0] = anlegen(betriebSetzen(LEERER_STAND, B), "unterweisung", t("08:00"), "a");
    const s1 = felderSetzen(s0, "a", { thema: "Hygiene" }, t("09:00"));
    const s2 = felderSetzen(s1, "a", { dauer: "30 Minuten" }, t("09:01"));
    expect(s2.unterlagen[0]!.daten).toMatchObject({ thema: "Hygiene", dauer: "30 Minuten", durchgefuehrt_von: "Robin Beispiel" });
    expect(s2.unterlagen[0]!.geaendert).toBe(t("09:01").toISOString());
  });

  it("merkt sich Mitarbeiter und Kunden, ergänzt bei gleichem Namen und sortiert alphabetisch", () => {
    let s = personMerken(LEERER_STAND, "kunde", { name: "Kim Beispiel", anschrift: "Gartenweg 3" }, "k1");
    s = personMerken(s, "kunde", { name: "kim beispiel", ust_idnr: "DE1" }, "k2");
    expect(s.kunden).toEqual([{ id: "k1", name: "Kim Beispiel", anschrift: "Gartenweg 3", ust_idnr: "DE1" }]);
    s = personSetzen(s, "mitarbeiter", { id: "m2", name: "Zoe" });
    s = personSetzen(s, "mitarbeiter", { id: "m1", name: "Ali" });
    s = personSetzen(s, "mitarbeiter", { id: "m3", name: "" });
    expect(personenSortiert(s.mitarbeiter).map((p) => p.name)).toEqual(["Ali", "Zoe"]);
    s = personSetzen(s, "mitarbeiter", { id: "m1", name: "Ali Muster" });
    expect(s.mitarbeiter.find((p) => p.id === "m1")!.name).toBe("Ali Muster");
    s = personLoeschen(s, "mitarbeiter", "m2");
    expect(s.mitarbeiter.map((p) => p.id)).toEqual(["m1", "m3"]);
  });
});
