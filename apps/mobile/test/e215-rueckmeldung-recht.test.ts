/**
 * E-215: Antwort des Rechtsanwalts vom 26.10.2026 zu T-239 (2), T-263 und zur Lohnsteuer-Anmeldung.
 * (1) „Ohne Angabe nicht betroffen“ nur noch außerhalb der typischen Branchen: Datenschutzbeauftragter in Gesundheit, Pflege
 *     und Kosmetik (§ 38 Abs. 1 Satz 2 BDSG – Datenschutz-Folgenabschätzung, unabhängig von der Zahl), NIS2 in den Branchen,
 *     die der Katalog NIS2 zuordnet (unter 50 Beschäftigten erfasst, wenn Jahresumsatz und Jahresbilanzsumme je über 10 Mio. €).
 * (2) Hilfetext zum Anmeldezeitraum der Lohnsteuer: wann „keine“ gilt.
 * (3) Summe „Die Pflichten sind fachlich geprüft, einzelne Schwellenwerte noch nicht bestätigt.“
 * (4) SV-Anmeldung: Termin ist die Katalogfrist (sechs Wochen nach Beschäftigungsbeginn), nicht der erste Arbeitstag.
 */
import { describe, expect, it } from "vitest";
import { SCHRITTE } from "@amtlos/i18n";
import { auswertung, type Profil } from "../src/pflichten/check";
import { T } from "../src/texte";

const STICHTAG = "2026-10-26";
type A = ReturnType<typeof auswertung>;
const sichtbar = (a: A, id: string) => [...a.gilt, ...a.gruendung, ...a.unbekannt, ...a.beiEinstellung].find((p) => p.id === id);
const haengtAb = (a: A, id: string) => a.unbekannt.find((p) => p.id === id);
const basis = (branche: string, beschaeftigte: number): Profil => ({ "taetigkeit.branchen": [branche], rechtsform: "einzelunternehmen", gruendungsdatum: "2021-03-01", bundesland: "NI", "beschaeftigte.gesamt": beschaeftigte });

describe("E-215 (1a): Datenschutzbeauftragter ohne Angaben zur Datenverarbeitung", () => {
  it.each([["beauty_kosmetik"], ["gesundheit_pflege"]])("%s: „hängt ab“ mit Rückfrage nach den Daten bzw. den Fällen des § 38 Abs. 1 Satz 2 BDSG", (branche) => {
    const p = haengtAb(auswertung(basis(branche, 2), STICHTAG), "datenschutz.dsb");
    expect(p, branche).toBeDefined();
    expect(p!.offeneFragen).toEqual(expect.arrayContaining(["datenverarbeitung.arten", "datenschutz.dsb_gruende"]));
  });
  it.each([["handwerk"], ["gastronomie_lebensmittel"], ["it_agentur_freelancer"], ["unterricht_sport_coaching"]])("%s: bleibt ohne Angabe „nicht betroffen“", (branche) => {
    expect(sichtbar(auswertung(basis(branche, 2), STICHTAG), "datenschutz.dsb")).toBeUndefined();
  });
  it("mit Angaben entscheidet die Angabe: Kosmetik ohne Gesundheitsdaten, Video und Ortung bzw. „Nichts davon“ → nicht betroffen", () => {
    expect(sichtbar(auswertung({ ...basis("beauty_kosmetik", 2), "datenverarbeitung.arten": ["kundendaten"] }, STICHTAG), "datenschutz.dsb")).toBeUndefined();
    expect(sichtbar(auswertung({ ...basis("beauty_kosmetik", 2), "datenschutz.dsb_gruende": ["keine"] }, STICHTAG), "datenschutz.dsb")).toBeUndefined();
    expect(haengtAb(auswertung({ ...basis("beauty_kosmetik", 2), "datenverarbeitung.arten": ["gesundheitsdaten"] }, STICHTAG), "datenschutz.dsb")).toBeDefined();
    expect(auswertung({ ...basis("gesundheit_pflege", 2), "datenschutz.dsb_gruende": ["dsfa_pflichtig"] }, STICHTAG).gilt.some((p) => p.id === "datenschutz.dsb")).toBe(true);
  });
});

describe("E-215 (1b): NIS2 unter 50 Beschäftigten ohne Umsatzangabe", () => {
  it("„Andere“ (vom Katalog NIS2 zugeordnet), 5 Beschäftigte, ohne Umsatz: Registrierung und Meldepflichten „hängt ab“ mit Frage nach dem Umsatz", () => {
    const a = auswertung(basis("sonstige", 5), STICHTAG);
    for (const id of ["it_sicherheit.nis2_registrierung", "it_sicherheit.nis2_meldepflichten"]) {
      const p = haengtAb(a, id);
      expect(p, id).toBeDefined();
      expect(p!.offeneFragen, id).toEqual(expect.arrayContaining(["nis2.betroffen", "umsatz.vorjahr"]));
    }
    expect(sichtbar(a, "it_sicherheit.nis2_pruefen")).toBeDefined();
  });
  it("„Andere“ mit Umsatz bis 10 Mio. €: nicht betroffen (wie bisher)", () => {
    const a = auswertung({ ...basis("sonstige", 5), "umsatz.vorjahr": 400000 }, STICHTAG);
    for (const id of ["it_sicherheit.nis2_pruefen", "it_sicherheit.nis2_registrierung", "it_sicherheit.nis2_meldepflichten"]) expect(sichtbar(a, id), id).toBeUndefined();
  });
  it("außerhalb dieser Branchen bleibt es ohne Umsatz bei „nicht betroffen“ (Handwerk 5, Café 12)", () => {
    for (const p of [basis("handwerk", 5), basis("gastronomie_lebensmittel", 12)])
      for (const id of ["it_sicherheit.nis2_pruefen", "it_sicherheit.nis2_registrierung", "it_sicherheit.nis2_meldepflichten"]) {
        const e = sichtbar(auswertung(p, STICHTAG), id);
        // Café mit 12: Registrierung/Meldepflichten folgen wie bisher nur auf „ja“ (ohne Angabe „hängt ab“, kein Kleinstbetrieb)
        if (p["beschaeftigte.gesamt"] === 12 && id !== "it_sicherheit.nis2_pruefen") continue;
        expect(e, `${p["taetigkeit.branchen"]} ${id}`).toBeUndefined();
      }
  });
});

describe("E-215 (2): Anmeldezeitraum der Lohnsteuer – wann „keine“ gilt", () => {
  const frage = SCHRITTE.flatMap((s) => s.fragen).find((f) => f.feld === "personal.lohnsteuer_anmeldezeitraum")!;
  it("Hilfetext erklärt „keine“ mit dem Beispiel des Rechtsanwalts", () => {
    expect(frage.hilfe!.de).toMatch(/„Keine“ gilt zum Beispiel, wenn du nur Minijobber beschäftigst, deren Lohnsteuer pauschal über die Minijob-Zentrale abgeführt wird\./);
    expect(frage.hilfe!.en).toMatch(/“None” applies, for example, if you only employ mini-jobbers whose wage tax is paid as a flat rate via the Minijob-Zentrale\./);
  });
});

describe("E-215 (3): Summe bei offenen Schwellenwerten (T-263)", () => {
  it("Wortlaut des Rechtsanwalts", () => {
    expect(T.check_hinweis_werte).toContain("Die Pflichten sind fachlich geprüft, einzelne Schwellenwerte noch nicht bestätigt.");
    expect(T.hinweis_pflichten_werte).toContain("Die Pflichten sind fachlich geprüft, einzelne Schwellenwerte noch nicht bestätigt.");
  });
});

describe("E-215 (4): SV-Anmeldung bei geplanter Einstellung", () => {
  it("Termin sechs Wochen nach dem Start (§ 6 DEÜV, Katalogfrist), nicht der erste Arbeitstag", () => {
    const a = auswertung({ ...basis("gastronomie_lebensmittel", 12), gruendungsdatum: "2026-12-01", "personal.sofortmeldebranchen": ["gastronomie"] }, STICHTAG);
    expect(a.gilt.find((p) => p.id === "personal.sv_anmeldung")!.naechsterTermin).toBe("2027-01-12");
    expect(a.gilt.find((p) => p.id === "personal.sofortmeldung")!.naechsterTermin).toBe("2026-12-01");
  });
});
