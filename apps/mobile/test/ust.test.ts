import { describe, expect, it } from "vitest";
import { offeneRechnungen, periodeText, perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, stornieren } from "../src/unterlagen/speicher";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
function rechnung(s: typeof LEERER_STAND, id: string, datum: string, pos: { preis: string; satz: string; menge?: string }[], teilen = true) {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  let s2 = felderSetzen(s1, id, { datum, kunde_name: "Kunde", kunde_anschrift: "Weg 1\n12345 Ort", positionen: pos.map((p) => ({ bezeichnung: "X", menge: p.menge ?? "1", einheit: "", preis: p.preis, satz: p.satz })) }, t(datum));
  if (teilen) s2 = ausgeben(s2, id, t(datum));
  return s2;
}

describe("Rechnungen speisen die Umsatzsteuer-Voranmeldung (E-128)", () => {
  it("summiert festgeschriebene Rechnungen je Steuersatz, Stornos negativ, Entwürfe nicht", () => {
    let s = rechnung(LEERER_STAND, "a", "2026-10-05", [{ preis: "100,00", satz: "19" }, { preis: "10,00", satz: "7", menge: "3" }]);
    s = rechnung(s, "b", "2026-10-20", [{ preis: "50,00", satz: "19" }]);
    s = rechnung(s, "c", "2026-10-21", [{ preis: "999,00", satz: "19" }], false); // Entwurf
    s = rechnung(s, "d", "2026-09-30", [{ preis: "40,00", satz: "19" }]);
    const [s2, st] = stornieren(s, "b", t("2026-10-22"), "st");
    s = ausgeben(s2, st!.id, t("2026-10-22"));
    expect(perioden(s.unterlagen, LEERER_STAND.betrieb)).toEqual(["2026-Q4", "2026-Q3", "2026-10", "2026-09"].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1)));
    const okt = umsaetzeFuer(s.unterlagen, "2026-10", LEERER_STAND.betrieb)!;
    expect(okt.anzahl).toBe(3);
    expect(okt.werte).toEqual({ zeitraum: "Oktober 2026", umsatz_19: "100,00", umsatz_7: "30,00", umsatz_igl: "0,00", umsatz_48: "0,00", umsatz_13b: "0,00", umsatz_21: "0,00", umsatz_45: "0,00", umsatz_87: "0,00", umsatz_43: "0,00", umsatz_frei: "0,00", nach_rechnungsdatum: "", annahmen: "" });
    const q3 = umsaetzeFuer(s.unterlagen, "2026-Q3", LEERER_STAND.betrieb)!;
    expect(q3.werte.umsatz_19).toBe("40,00");
    expect(periodeText("2026-Q4")).toBe("4. Quartal 2026");
    expect(umsaetzeFuer(s.unterlagen, "Oktober", LEERER_STAND.betrieb)).toBeNull();
  });

  it("ordnet bei Soll nach Leistungsdatum zu, Stornos im Monat des Stornos (§ 13 Abs. 1 Nr. 1 a, § 17 UStG)", () => {
    // Leistung im September, Rechnung erst im Oktober geschrieben
    let s = rechnung(LEERER_STAND, "a", "2026-10-02", [{ preis: "100,00", satz: "19" }]);
    s = felderSetzen({ ...s, unterlagen: s.unterlagen.map((u) => ({ ...u, festgeschrieben: undefined })) }, "a", { leistung_gleich: false, leistung: "28.09.2026" }, t("2026-10-02"));
    s = ausgeben(s, "a", t("2026-10-02"));
    expect(umsaetzeFuer(s.unterlagen, "2026-09", LEERER_STAND.betrieb)!.werte.umsatz_19).toBe("100,00");
    expect(umsaetzeFuer(s.unterlagen, "2026-10", LEERER_STAND.betrieb)!.werte.umsatz_19).toBe("0,00");
    // Storno im November mindert den November, nicht den September
    const [s2, st] = stornieren(s, "a", t("2026-11-03"), "st");
    s = ausgeben(s2, st!.id, t("2026-11-03"));
    expect(umsaetzeFuer(s.unterlagen, "2026-11", LEERER_STAND.betrieb)!.werte.umsatz_19).toBe("-100,00");
    expect(umsaetzeFuer(s.unterlagen, "2026-09", LEERER_STAND.betrieb)!.werte.umsatz_19).toBe("100,00");
    // Leistungszeitraum statt Tag: nach Rechnungsdatum, als Ersatz gemeldet
    let s3 = rechnung(LEERER_STAND, "b", "2026-10-15", [{ preis: "50,00", satz: "19" }]);
    s3 = felderSetzen({ ...s3, unterlagen: s3.unterlagen.map((u) => ({ ...u, festgeschrieben: undefined })) }, "b", { leistung_gleich: false, leistung: "September bis Oktober 2026" }, t("2026-10-15"));
    s3 = ausgeben(s3, "b", t("2026-10-15"));
    expect(umsaetzeFuer(s3.unterlagen, "2026-10", LEERER_STAND.betrieb)).toMatchObject({ anzahl: 1, ersatz: 1 });
  });

  it("ordnet bei Ist nach Zahlungseingang zu; unbezahlte zählen nicht (§ 13 Abs. 1 Nr. 1 b, § 20 UStG)", () => {
    let s = rechnung(LEERER_STAND, "a", "2026-10-05", [{ preis: "100,00", satz: "19" }]);
    s = rechnung(s, "b", "2026-10-06", [{ preis: "20,00", satz: "7" }]);
    expect(perioden(s.unterlagen, LEERER_STAND.betrieb, "ist")).toEqual([]);
    expect(offeneRechnungen(s.unterlagen)).toHaveLength(2);
    s = bezahltSetzen(s, "a", "2026-11-02");
    const nov = umsaetzeFuer(s.unterlagen, "2026-11", LEERER_STAND.betrieb, "ist")!;
    expect(nov).toMatchObject({ anzahl: 1, offen: 1 });
    expect(nov.werte.umsatz_19).toBe("100,00");
    expect(umsaetzeFuer(s.unterlagen, "2026-10", LEERER_STAND.betrieb, "ist")!.werte.umsatz_19).toBe("0,00");
    // Zahlungsvermerk ändert die festgeschriebene Rechnung nicht und lässt sich entfernen
    const a = s.unterlagen.find((u) => u.id === "a")!;
    expect(a.festgeschrieben).toBeTruthy();
    expect(bezahltSetzen(s, "a", null).unterlagen.find((u) => u.id === "a")!.bezahlt).toBeUndefined();
  });
});
