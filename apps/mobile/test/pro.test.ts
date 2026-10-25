import { describe, expect, it } from "vitest";
import { sollFragen } from "../src/pro/bewertung";
import { ausgabeErlaubt, ausgabeGrund, betriebFuerDokument, erstellenErlaubt } from "../src/pro/regeln";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, standAus, stornieren, type Stand } from "../src/unterlagen/speicher";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
function geteilt(s: Stand, id: string, tag: string, vorlage = "rechnung"): Stand {
  const [s1] = anlegen(s, vorlage, t(tag), id);
  return ausgeben(s1, id, t(tag));
}

describe("Amtlos Pro (E-188, Modell Check-Teaser): Neues nur mit Pro, Eigenes immer", () => {
  it("neue Unterlagen, Belege und Kassendaten anlegen gehört zu Pro", () => {
    expect(erstellenErlaubt(false)).toBe(false);
    expect(erstellenErlaubt(true)).toBe(true);
  });

  it("ohne Pro: erneut teilen, Storno und Kassenbuch immer – eine noch nie ausgegebene Rechnung oder Vorlage nie; mit Pro alles", () => {
    let s = LEERER_STAND;
    const [s1] = anlegen(s, "rechnung", t("2026-10-01"), "r");
    s = felderSetzen(s1, "r", { kunde_name: "K", kunde_anschrift: "Weg 1\n12345 Ort", positionen: [{ bezeichnung: "X", menge: "1", einheit: "", preis: "10", satz: "19" }] }, t("2026-10-01"));
    s = ausgeben(s, "r", t("2026-10-01"));
    s = geteilt(s, "r2", "2026-10-02");
    const [s2, st] = stornieren(s, "r", t("2026-10-03"), "st");
    const [s3a, neu] = anlegen(s2, "rechnung", t("2026-10-03"), "neu");
    const [s3b, hyg] = anlegen(s3a, "unterweisung", t("2026-10-03"), "hyg");
    const [s3, kb] = anlegen(s3b, "kassenbuch", t("2026-10-03"), "kb");
    expect(ausgabeErlaubt(neu, false)).toBe(false);
    expect(ausgabeGrund(neu)).toBe("rechnungen");
    expect(ausgabeErlaubt(neu, true)).toBe(true);
    expect(ausgabeErlaubt(st!, false)).toBe(true);
    expect(ausgabeErlaubt(s3.unterlagen.find((u) => u.id === "r2")!, false)).toBe(true);
    expect(ausgabeErlaubt(hyg, false)).toBe(false);
    expect(ausgabeGrund(hyg)).toBe("pdf");
    expect(ausgabeErlaubt(hyg, true)).toBe(true);
    expect(ausgabeErlaubt(kb, false)).toBe(true);
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
