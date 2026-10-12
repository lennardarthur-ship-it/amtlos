import { describe, expect, it } from "vitest";
import { periodeText, perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, stornieren } from "../src/unterlagen/speicher";

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
    expect(perioden(s.unterlagen)).toEqual(["2026-Q4", "2026-Q3", "2026-10", "2026-09"].sort((a, b) => b.localeCompare(a) || (a.includes("Q") ? 1 : -1)));
    const okt = umsaetzeFuer(s.unterlagen, "2026-10", LEERER_STAND.betrieb)!;
    expect(okt.anzahl).toBe(3);
    expect(okt.werte).toEqual({ zeitraum: "Oktober 2026", umsatz_19: "100,00", umsatz_7: "30,00", umsatz_frei: "0,00" });
    const q3 = umsaetzeFuer(s.unterlagen, "2026-Q3", LEERER_STAND.betrieb)!;
    expect(q3.werte.umsatz_19).toBe("40,00");
    expect(periodeText("2026-Q4")).toBe("4. Quartal 2026");
    expect(umsaetzeFuer(s.unterlagen, "Oktober", LEERER_STAND.betrieb)).toBeNull();
  });
});
