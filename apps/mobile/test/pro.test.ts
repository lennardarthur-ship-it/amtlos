import { describe, expect, it } from "vitest";
import { sollFragen } from "../src/pro/bewertung";
import { FREI_JE_MONAT, ausgabeErlaubt, betriebFuerDokument, uebrig, verbraucht } from "../src/pro/regeln";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, standAus, stornieren, type Stand } from "../src/unterlagen/speicher";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
function geteilt(s: Stand, id: string, tag: string, vorlage = "rechnung"): Stand {
  const [s1] = anlegen(s, vorlage, t(tag), id);
  return ausgeben(s1, id, t(tag));
}

describe("Amtlos Pro (E-132): Freikontingent", () => {
  it("zählt nur erste Ausgaben im laufenden Monat; Stornos zählen nie", () => {
    let s = LEERER_STAND;
    for (let i = 0; i < FREI_JE_MONAT; i++) s = geteilt(s, `u${i}`, "2026-10-0" + (i + 1));
    s = geteilt(s, "alt", "2026-09-30");
    expect(verbraucht(s.unterlagen, t("2026-10-20"))).toBe(FREI_JE_MONAT);
    expect(uebrig(s.unterlagen, t("2026-10-20"))).toBe(0);
    expect(uebrig(s.unterlagen, t("2026-11-01"))).toBe(FREI_JE_MONAT);
    // erneutes Teilen zählt nicht: ausgegeben bleibt beim ersten Mal
    s = ausgeben(s, "u0", t("2026-10-25"));
    expect(verbraucht(s.unterlagen, t("2026-10-25"))).toBe(FREI_JE_MONAT);
  });

  it("sperrt nie ein erneutes Teilen, nie ein Storno, und mit Pro nie etwas", () => {
    let s = LEERER_STAND;
    const [s1] = anlegen(s, "rechnung", t("2026-10-01"), "r");
    s = felderSetzen(s1, "r", { kunde_name: "K", kunde_anschrift: "Weg 1\n12345 Ort", positionen: [{ bezeichnung: "X", menge: "1", einheit: "", preis: "10", satz: "19" }] }, t("2026-10-01"));
    s = ausgeben(s, "r", t("2026-10-01"));
    for (let i = 0; i < FREI_JE_MONAT; i++) s = geteilt(s, `u${i}`, "2026-10-02");
    const [s2, st] = stornieren(s, "r", t("2026-10-03"), "st");
    const [s3a, neu] = anlegen(s2, "rechnung", t("2026-10-03"), "neu");
    const [s3, hyg] = anlegen(s3a, "hygieneplan", t("2026-10-03"), "hyg");
    const jetzt = t("2026-10-03");
    // Pflicht-Nachweise zählen nie aufs Kontingent und sind immer frei (E-154)
    expect(ausgabeErlaubt(s3.unterlagen, hyg, false, jetzt)).toBe(true);
    expect(ausgabeErlaubt(s3.unterlagen, s3.unterlagen.find((u) => u.id === "u0")!, false, jetzt)).toBe(true);
    expect(ausgabeErlaubt(s3.unterlagen, st!, false, jetzt)).toBe(true);
    expect(ausgabeErlaubt(s3.unterlagen, neu, false, jetzt)).toBe(false);
    expect(ausgabeErlaubt(s3.unterlagen, neu, true, jetzt)).toBe(true);
  });

  it("Pflicht-Nachweise verbrauchen nichts vom Kontingent (E-154)", () => {
    let s = LEERER_STAND;
    for (let i = 0; i < 8; i++) s = geteilt(s, `h${i}`, "2026-10-02", i % 2 ? "unterweisung" : "hygieneplan");
    expect(verbraucht(s.unterlagen, t("2026-10-20"))).toBe(0);
    expect(uebrig(s.unterlagen, t("2026-10-20"))).toBe(FREI_JE_MONAT);
  });

  it("Briefkopf (Logo, Hausfarbe) nur mit Pro im Dokument – gespeichert bleibt er", () => {
    const b = { ...LEERER_STAND.betrieb, name: "Salon", logo: "data:image/png;base64,AA", farbe: "#702434" };
    expect(betriebFuerDokument(b, true)).toBe(b);
    expect(betriebFuerDokument(b, false)).toMatchObject({ name: "Salon", logo: "", farbe: "" });
  });

  it("liest Pro-Test und Bewertungsstand, auch aus älteren Daten ohne diese Felder", () => {
    expect(standAus(JSON.stringify({ version: 1 }))).toMatchObject({ proTest: false, bewertung: { erfolge: 0 } });
    expect(standAus(JSON.stringify({ version: 1, proTest: true, bewertung: { erfolge: 4, gefragt: "2026-10-01T00:00:00Z" } }))).toMatchObject({ proTest: true, bewertung: { erfolge: 4, gefragt: "2026-10-01T00:00:00Z" } });
    expect(standAus(JSON.stringify({ version: 1, bewertung: { erfolge: "viele" } })).bewertung).toEqual({ erfolge: 0 });
  });
});

describe("Bitte um Bewertung (E-132)", () => {
  it("frühestens nach drei Erfolgen, danach höchstens alle 120 Tage", () => {
    const jetzt = t("2026-10-13");
    expect(sollFragen({ erfolge: 2 }, jetzt)).toBe(false);
    expect(sollFragen({ erfolge: 3 }, jetzt)).toBe(true);
    expect(sollFragen({ erfolge: 9, gefragt: "2026-08-01T00:00:00Z" }, jetzt)).toBe(false);
    expect(sollFragen({ erfolge: 9, gefragt: "2026-06-01T00:00:00Z" }, jetzt)).toBe(true);
  });
});
