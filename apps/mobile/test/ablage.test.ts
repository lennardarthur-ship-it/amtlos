import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { euroText, faelligAm, filterVerfuegbar, filtern, monatsSumme, offeneIds, offeneSumme, tageUeberfaellig } from "../src/unterlagen/ablage";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, stornieren } from "../src/unterlagen/speicher";
import { APP_VERSION } from "../src/version";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
function rechnung(s: typeof LEERER_STAND, id: string, datum: string, preis: string, kunde = "Kunde", teilen = true) {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  let s2 = felderSetzen(s1, id, { datum, kunde_name: kunde, kunde_anschrift: "Weg 1\n12345 Ort", positionen: [{ bezeichnung: "X", menge: "1", einheit: "", preis, satz: "19" }] }, t(datum));
  if (teilen) s2 = ausgeben(s2, id, t(datum));
  return s2;
}

describe("Meine Unterlagen (E-131): Filter, Suche, offene Rechnungen", () => {
  it("zählt offene Rechnungen brutto – bezahlte, stornierte und Entwürfe nicht", () => {
    let s = rechnung(LEERER_STAND, "a", "2026-10-05", "100,00", "Kim Beispiel"); // offen: 119,00
    s = rechnung(s, "b", "2026-10-06", "50,00"); // bezahlt
    s = bezahltSetzen(s, "b", "2026-10-10");
    s = rechnung(s, "c", "2026-10-07", "999,00", "Kunde", false); // Entwurf
    s = rechnung(s, "d", "2026-10-08", "30,00"); // storniert
    const [s2, st] = stornieren(s, "d", t("2026-10-09"), "st");
    s = ausgeben(s2, st!.id, t("2026-10-09"));
    const o = offeneSumme(s.unterlagen, s.betrieb);
    expect(o).toEqual({ anzahl: 1, cent: 11900, ueberfaellig: 0 });
    expect(euroText(o.cent)).toBe("119,00 €");
    expect(filterVerfuegbar(s.unterlagen)).toEqual(["alle", "rechnungen", "offen", "entwuerfe"]);
    expect(filtern(s.unterlagen, "offen").map((u) => u.id)).toEqual(["a"]);
    expect(filtern(s.unterlagen, "entwuerfe").map((u) => u.id)).toEqual(["c"]);
    expect(filtern(s.unterlagen, "rechnungen")).toHaveLength(5);
    expect(filtern(s.unterlagen, "alle", "kim").map((u) => u.id)).toEqual(["a"]);
    expect(filtern(s.unterlagen, "alle", "2026-00")).toHaveLength(5);
    expect(filtern(s.unterlagen, "alle", "2026-003").map((u) => u.id)).toEqual(["c"]);
  });

  it("Monatssumme (Startseite): geteilte Rechnungen des Monats brutto, Storno zieht ab, Entwürfe und andere Monate nicht", () => {
    let s = rechnung(LEERER_STAND, "a", "2026-10-05", "100,00"); // 119,00
    s = rechnung(s, "b", "2026-09-30", "50,00"); // anderer Monat
    s = rechnung(s, "c", "2026-10-07", "999,00", "Kunde", false); // Entwurf
    s = rechnung(s, "d", "2026-10-08", "30,00"); // 35,70 – storniert
    const [s2, st] = stornieren(s, "d", t("2026-10-09"), "st");
    s = ausgeben(s2, st!.id, t("2026-10-09"));
    expect(monatsSumme(s.unterlagen, s.betrieb, "2026-10")).toEqual({ anzahl: 2, cent: 11900 });
    expect(monatsSumme(s.unterlagen, s.betrieb, "2026-09")).toEqual({ anzahl: 1, cent: 5950 });
    expect(monatsSumme(s.unterlagen, s.betrieb, "2026-08")).toEqual({ anzahl: 0, cent: 0 });
  });

  it("Fälligkeit nach Zahlungsziel; überfällig nur offene Rechnungen nach dem Ziel", () => {
    let s = rechnung(LEERER_STAND, "a", "2026-10-01", "100,00", "Kunde", false); // Ziel 14 Tage → 15.10.
    s = ausgeben(felderSetzen(s, "a", { zahlungsziel: "14" }, t("2026-10-01")), "a", t("2026-10-01"));
    s = rechnung(s, "b", "2026-10-01", "10,00", "Kunde", false);
    s = ausgeben(felderSetzen(s, "b", { zahlungsziel: "sofort" }, t("2026-10-01")), "b", t("2026-10-01"));
    s = bezahltSetzen(s, "b", "2026-10-02");
    const a = s.unterlagen.find((u) => u.id === "a")!;
    const b = s.unterlagen.find((u) => u.id === "b")!;
    expect(faelligAm(a)).toBe("2026-10-15");
    expect(faelligAm(b)).toBe("2026-10-01");
    const ids = offeneIds(s.unterlagen);
    expect(tageUeberfaellig(a, "2026-10-15", ids)).toBe(0);
    expect(tageUeberfaellig(a, "2026-10-18", ids)).toBe(3);
    expect(tageUeberfaellig(b, "2026-10-18", ids)).toBe(0); // bezahlt
    expect(offeneSumme(s.unterlagen, s.betrieb, "2026-10-18").ueberfaellig).toBe(1);
  });

  it("bietet nur Filter an, die etwas bewirken", () => {
    const [s] = anlegen(LEERER_STAND, "hygieneplan", t("2026-10-01"), "h");
    expect(filterVerfuegbar(s.unterlagen)).toEqual(["alle", "entwuerfe"]);
    expect(offeneSumme(s.unterlagen, s.betrieb)).toEqual({ anzahl: 0, cent: 0, ueberfaellig: 0 });
  });

  it("Version in der App ist dieselbe wie in app.json und package.json", () => {
    const app = JSON.parse(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app.json"), "utf8")) as { expo: { version: string } };
    const pkg = JSON.parse(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")) as { version: string };
    expect(app.expo.version).toBe(APP_VERSION);
    expect(pkg.version).toBe(APP_VERSION);
  });
});
