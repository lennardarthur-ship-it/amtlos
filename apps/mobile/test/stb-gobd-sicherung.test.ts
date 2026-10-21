/**
 * StB GoBD (Prüfbericht Heckler und Busch, D-1/D-9/D-11): Vollsicherung außerhalb des Geräts mit Erinnerung und Nachweis;
 * Kassenbuch aus den Tagesabschlüssen mit Fassung, Erstellungszeitpunkt und Kassensystem.
 */
import { describe, expect, it } from "vitest";
import { dokumentHtml, vorlageFuer, type Daten } from "@amtlos/fachlogik";
import { syncInhalt } from "../src/konto/sync";
import { kassenbuchAnzeige, kassensystemText } from "../src/unterlagen/kassenbuchAnzeige";
import { NACHWEISE_HOECHSTENS, VOLLSICHERUNG_TAGE, letzteVollsicherung, nachweisAnhaengen, nachweisText, nachweiseAus, vollsicherungFaellig, type SicherungsNachweis } from "../src/unterlagen/sicherungNachweis";
import { LEERER_STAND, anlegen, standAus, type Stand, type Unterlage } from "../src/unterlagen/speicher";
import { T as TEXT } from "../src/texte";

const tag = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("StB GoBD (D-11): Vollsicherung außerhalb des Geräts", () => {
  it("erinnert erst, wenn es Aufbewahrungspflichtiges gibt – nie bei Nutzern ohne Daten", () => {
    expect(vollsicherungFaellig({}, tag("2026-10-21"), false)).toBeNull();
    expect(vollsicherungFaellig({ geaendert: "2026-10-20T10:00:00Z" }, tag("2026-10-21"), true)).toEqual({ tage: null });
  });

  it("monatlich: fällig ab 30 Tagen nach der letzten Vollsicherung, wenn sich seitdem etwas geändert hat", () => {
    const n: SicherungsNachweis[] = [{ am: "2026-09-15T08:00:00Z", ziel: "datei" }];
    expect(VOLLSICHERUNG_TAGE).toBe(30);
    expect(vollsicherungFaellig({ sicherungsNachweis: n, geaendert: "2026-10-01T08:00:00Z" }, tag("2026-10-10"), true)).toBeNull();
    expect(vollsicherungFaellig({ sicherungsNachweis: n, geaendert: "2026-10-01T08:00:00Z" }, tag("2026-10-21"), true)).toEqual({ tage: 36 });
    // nichts geändert seit der Sicherung: sie ist noch vollständig
    expect(vollsicherungFaellig({ sicherungsNachweis: n, geaendert: "2026-09-14T08:00:00Z" }, tag("2026-12-21"), true)).toBeNull();
  });

  it("Nachweis: Datum und Art, höchstens zwölf, neueste zuletzt; Unlesbares fällt beim Laden weg", () => {
    let l: SicherungsNachweis[] = [];
    for (let i = 1; i <= 14; i++) l = nachweisAnhaengen(l, { am: `2026-${String(Math.min(i, 12)).padStart(2, "0")}-0${(i % 9) + 1}T08:00:00Z`, ziel: i % 2 ? "datei" : "archiv" });
    expect(l).toHaveLength(NACHWEISE_HOECHSTENS);
    expect(nachweisText({ am: "2026-10-15T08:00:00Z", ziel: "datei" })).toBe("15.10.2026, verschlüsselte Sicherungsdatei");
    expect(nachweisText({ am: "2026-10-15T08:00:00Z", ziel: "archiv" })).toBe("15.10.2026, offenes Archiv (CSV, PDF, XML)");
    expect(nachweiseAus([{ am: "2026-10-02T08:00:00Z", ziel: "archiv" }, { am: "kaputt", ziel: "datei" }, { am: "2026-10-01T08:00:00Z", ziel: "usb" }, { am: "2026-09-01T08:00:00Z", ziel: "datei" }])).toEqual([{ am: "2026-09-01T08:00:00Z", ziel: "datei" }, { am: "2026-10-02T08:00:00Z", ziel: "archiv" }]);
    expect(letzteVollsicherung(undefined)).toBeUndefined();
  });

  it("bleibt beim Speichern erhalten, wird aber nicht synchronisiert (gerätegebunden)", () => {
    const s: Stand = { ...LEERER_STAND, sicherungsNachweis: [{ am: "2026-10-15T08:00:00Z", ziel: "datei" }] };
    expect(standAus(JSON.stringify(s)).sicherungsNachweis).toEqual(s.sicherungsNachweis);
    expect(standAus(JSON.stringify(LEERER_STAND)).sicherungsNachweis).toBeUndefined();
    expect(syncInhalt(s).sicherungsNachweis).toBeUndefined();
  });

  it("eine neue Verfahrensdokumentation übernimmt den Nachweis der letzten Sicherung", () => {
    const s: Stand = { ...LEERER_STAND, sicherungsNachweis: [{ am: "2026-09-01T08:00:00Z", ziel: "archiv" }, { am: "2026-10-15T08:00:00Z", ziel: "datei" }] };
    const [, u] = anlegen(s, "verfahrensdokumentation", tag("2026-10-21"));
    expect(u.daten.sicherung_nachweis).toBe("15.10.2026, verschlüsselte Sicherungsdatei");
    expect(anlegen(LEERER_STAND, "verfahrensdokumentation", tag("2026-10-21"))[1].daten.sicherung_nachweis ?? "").toBe("");
  });

  it("Texte: Erinnerung auf „Heute“ und Nachweis auf der Sicherungsseite", () => {
    expect(TEXT.stb_vollsicherung_faellig(36)).toContain("36 Tage");
    expect(TEXT.stb_vollsicherung_faellig(null)).toContain("einmal im Monat");
    expect(TEXT.stb_letzte_vollsicherung("15.10.2026, verschlüsselte Sicherungsdatei")).toBe("Letzte Sicherung außerhalb des Geräts: 15.10.2026, verschlüsselte Sicherungsdatei");
    expect(TEXT.stb_vollsicherung_hinweis).toContain("iCloud-Backup des iPhones allein genügt nicht");
  });
});

describe("StB GoBD (D-1, D-9): Kassenbuch aus den Tagesabschlüssen", () => {
  const meldung: Unterlage = { id: "km", vorlage: "kassenmeldung", erstellt: "2025-06-20T08:00:00Z", geaendert: "2025-06-20T08:00:00Z", daten: { kassen: [{ hersteller: "KassaVista", modell: "Tablet-Kasse", tse_seriennummer: "3f9a77", betriebsstaette: "" }, { hersteller: "Alt", modell: "Kasse", ausser_betrieb: "2025-01-01" }] } };
  const daten: Daten = { zeitraum: "Mai 2026", anfang: "150,00", eintraege: [{ datum: "2026-05-02", beleg: "Z 120", text: "Tageseinnahmen bar lt. Z-Bon Nr. 120", einnahme: "812,40", ausgabe: "" }] };

  it("Kassensystem aus der Kassenmeldung (ohne außer Betrieb genommene), sonst aus der Verfahrensdokumentation", () => {
    expect(kassensystemText({ unterlagen: [meldung] })).toBe("KassaVista Tablet-Kasse, TSE 3f9a77");
    const vd: Unterlage = { id: "vd", vorlage: "verfahrensdokumentation", erstellt: "2026-01-01T08:00:00Z", geaendert: "2026-01-01T08:00:00Z", daten: { kasse_system: "SumUp POS", kasse_tse: "Cloud-TSE 12" } };
    expect(kassensystemText({ unterlagen: [vd] })).toBe("SumUp POS, TSE Cloud-TSE 12");
    expect(kassensystemText({ unterlagen: [] })).toBe("");
  });

  it("Fassung 1 vor dem ersten Teilen, gleiche Fassung bei gleichem Inhalt, nächste Fassung nach einer Korrektur – nur in der Anzeige", () => {
    const jetzt = new Date("2026-10-21T12:05:00Z");
    const a = kassenbuchAnzeige({ unterlagen: [meldung] }, daten, undefined, "", jetzt);
    expect(a).toMatchObject({ quelle: "tagesabschluesse", kb_fassung: "1", kb_einzel: "KassaVista Tablet-Kasse, TSE 3f9a77" });
    expect(a.kb_erstellt).toContain("21.10.2026");
    const fest: Unterlage = { id: "kb", vorlage: "kassenbuch", erstellt: "2026-06-01T08:00:00Z", geaendert: "2026-06-01T08:00:00Z", festgeschrieben: "2026-06-01T08:00:00Z", daten, kassenbuch: { monat: "2026-05", standort: "" }, fassungen: [{ daten: {}, festgeschrieben: "2026-05-31T20:00:00Z", grund: "x", ersetzt: "2026-06-01T08:00:00Z" }] };
    expect(kassenbuchAnzeige({ unterlagen: [] }, daten, fest, "", jetzt)).toMatchObject({ kb_fassung: "2", kb_erstellt: expect.stringContaining("01.06.2026") });
    expect(kassenbuchAnzeige({ unterlagen: [] }, { ...daten, anfang: "160,00" }, fest, "", jetzt).kb_fassung).toBe("3");
    // die Daten selbst bleiben unverändert (Vergleich mit dem festgeschriebenen Inhalt)
    expect(daten).not.toHaveProperty("quelle");
    const html = dokumentHtml(vorlageFuer("kassenbuch")!, a, LEERER_STAND.betrieb);
    expect(html).toContain("aus den Tagesabschlüssen, nur lesbar");
    expect(html).toMatch(/amtlos-fuss-rechts" content="Fassung 1 · erstellt 21\.10\.2026/);
    expect(html).toContain("Einzelaufzeichnungen: Kassensystem KassaVista Tablet-Kasse, TSE 3f9a77");
  });
});
