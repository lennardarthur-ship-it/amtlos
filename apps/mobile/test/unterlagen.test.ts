import { describe, expect, it } from "vitest";
import { VORLAGEN, fehlendeAngaben, vorlageFuer } from "@amtlos/fachlogik";
import { pflichtenFuer, rechtsgrundlagen } from "../src/unterlagen/katalog";
import { LEERER_STAND, aendern, anlegen, betriebFehlt, betriebSetzen, heute, kopieren, loeschen, sortiert, standAus } from "../src/unterlagen/speicher";

const B = { name: "Café Mond", strasse: "Markt 2", plz: "54321", ort: "Beispielstadt", verantwortlich: "Robin Beispiel", telefon: "", email: "" };
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
    expect(s.unterlagen.map((u) => u.id)).toEqual(["1"]);
    expect(betriebFehlt(s.betrieb)).toBe(false);
    expect(betriebFehlt(LEERER_STAND.betrieb)).toBe(true);
  });

  it("findet zu jeder Vorlage die Pflichten im Katalogauszug mit Rechtsgrundlage", () => {
    for (const v of VORLAGEN) {
      expect(pflichtenFuer(v).length, v.id).toBe(v.pflichten.length);
      expect(rechtsgrundlagen(v).length, v.id).toBeGreaterThan(0);
    }
    expect(rechtsgrundlagen(vorlageFuer("gefaehrdungsbeurteilung")!)).toContain("§ 5 ArbSchG");
  });

  it("eine neu angelegte Unterlage nennt, was fehlt – ein leerer Betrieb füllt nichts vor", () => {
    const [, u] = anlegen(LEERER_STAND, "unterweisung", t("08:00"));
    expect(u.daten.durchgefuehrt_von).toBe("");
    expect(fehlendeAngaben(vorlageFuer("unterweisung")!, u.daten)).toEqual(["Thema", "Durchgeführt von", "Inhalt der Unterweisung"]);
  });

  it("nimmt das Datum in deutscher Zeit", () => {
    expect(heute(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
  });
});
