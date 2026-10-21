/** Befunde R12 (UX und Nutzertests): Silbentrennung, „Was hast du schon?“, Mehrfachauswahl, Rechnungshinweise, Bezahlschirm. */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB } from "@amtlos/fachlogik";
import { T as TEXT } from "../src/texte";
import { schuetzen, trennen } from "../src/ui/trennen";
import { exklusiv, mehrfachUmschalten } from "../src/ui/mehrfach";
import { KATALOG, auswertung } from "../src/pflichten/check";
import { bestaetigungFuer, inZukunft, langBestehend, schonDaGruppen, schonDaKandidaten } from "../src/seiten/schonDa";
import { handwerkLaut, ohneZahlungsweg } from "../src/seiten/rechnungHinweise";
import { ersparnis, naechsterMonat } from "../src/pro/bezahltext";

const ohne = (t: string) => t.replace(/­/g, "-");

/** alle Texte aus texte.ts (auch in Objekten), Funktionen ohne Platzhalter nicht */
function texte(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (o && typeof o === "object") return Object.values(o).flatMap(texte);
  return [];
}

describe("Silbentrennung mit TeX-Mustern (UX #8)", () => {
  it("trennt die Wörter aus dem Befund richtig – an der Wortfuge, nicht „Freis-tel-lung“", () => {
    const erwartet: Record<string, string> = {
      Freistellungsauftrag: "Frei-stel-lungs-auf-trag",
      sicherstellen: "si-cher-stel-len",
      Videoüberwachung: "Vi-deo-über-wa-chung",
      Lebensmittelüberwachung: "Le-bens-mit-tel-über-wa-chung",
      Jugendarbeitsschutz: "Ju-gend-ar-beits-schutz",
      Selbstständigkeit: "Selbst-stän-dig-keit",
      Bestellbutton: "Be-stell-but-ton",
      überschritten: "über-schrit-ten",
      Aufenthaltstitel: "Auf-ent-halts-ti-tel",
      Ausgleichsabgabe: "Aus-gleichs-ab-ga-be",
    };
    for (const [w, t] of Object.entries(erwartet)) expect(ohne(trennen(w)), w).toBe(t);
  });
  it("über alle Katalogtitel und Texte: nur weiche Trennstellen, nie ein einzelner Buchstabe, keine bekannten Fehlgriffe", () => {
    const quellen = [...KATALOG.pflichten.map((p) => p.titel.de), ...texte(TEXT)];
    const woerter = [...new Set(quellen.flatMap((t) => t.match(/\p{L}{12,}/gu) ?? []))];
    expect(woerter.length).toBeGreaterThan(150);
    const falsch = /Freis-t|sichers-t|Videoü-|Jugen-d|Selbsts-t|Bes-tell|übersch-r|Aufen-t|Beruf-s|Baus-t|gleich-s/;
    for (const w of woerter) {
      const t = trennen(w);
      expect(t.replace(/­/g, ""), w).toBe(w);
      expect(t.split("­").every((teil) => teil.length >= 2), ohne(t)).toBe(true);
      expect(ohne(t), w).not.toMatch(falsch);
    }
  });
  it("Ausnahmen bleiben; Adressen und kurze Wörter unverändert", () => {
    expect(ohne(trennen("Kontrollmappe"))).toBe("Kon-troll-map-pe");
    expect(trennen("info@salonsonnemuenchen.de")).toBe("info@salonsonnemuenchen.de");
    expect(trennen("Pflichten")).toBe("Pflichten");
  });
  it("geschütztes Leerzeichen nach „§“, kein Umbruch vor „?“ nach langem Wort (UX #18)", () => {
    expect(schuetzen("Arbeitszeit nach § 16 ArbZG")).toBe("Arbeitszeit nach § 16 ArbZG");
    expect(schuetzen("§§ 634, 634a BGB")).toBe("§§ 634, 634a BGB");
    expect(schuetzen("Nutzt du die Kleinunternehmerregelung?")).toBe("Nutzt du die Kleinunternehmerregelung⁠?");
    expect(schuetzen("Hast du Personal?")).toBe("Hast du Personal?");
  });
});

describe("„Was hast du schon?“ (UX #1, #2, #19; Kfz #13)", () => {
  const profil = { "taetigkeit.branchen": ["handwerk"], rechtsform: "gmbh", "taetigkeit.einordnung": "gewerbe", bundesland: "NW", "beschaeftigte.gesamt": 6, "personal.lohn_durch": "steuerberatung", "kasse.elektronisch": true, "ust.kleinunternehmer": false, "kunden.segmente": ["b2b", "b2c"], "online.social_media": true, "online.website": false, gruendungsdatum: "2026-06-01" };
  it("ab vier Wochen Betrieb, ohne Pflichten, die erst in Zukunft gelten", () => {
    expect(langBestehend(profil, "2026-10-21")).toBe(true);
    expect(inZukunft("steuern.e_rechnung_versand_2028", "2026-10-21")).toBe(true);
    expect(inZukunft("steuern.kassenmeldung", "2026-10-21")).toBe(false);
    const a = auswertung(profil, "2026-10-21");
    const l = schonDaKandidaten(a, { erledigt: {}, unterlagen: [], betrieb: LEERER_BETRIEB }, "2026-10-21");
    expect(l.length).toBeGreaterThan(3);
    expect(l.some((p) => p.id.startsWith("steuern.e_rechnung_versand"))).toBe(false);
  });
  it("nach Bereichen gegliedert, Gründung zuerst; Impressum ohne Website: auf den Profilen", () => {
    const a = auswertung(profil, "2026-10-21");
    const g = schonDaGruppen(schonDaKandidaten(a, { erledigt: {}, unterlagen: [], betrieb: LEERER_BETRIEB }, "2026-10-21"));
    expect(g.length).toBeGreaterThan(1);
    expect(new Set(g.map((x) => x.bereich)).size).toBe(g.length);
    const imp = a.gilt.find((p) => p.id === "online.impressum");
    if (imp) {
      expect(bestaetigungFuer(imp, profil)).toMatch(/Profilen/);
      expect(bestaetigungFuer(imp, { ...profil, "online.website": true })).toBe("Auf der Website veröffentlicht");
    }
  });
});

describe("Mehrfachauswahl: „Keine davon“ schließt aus (Bäckerei #1)", () => {
  const o = [{ wert: "keine", text: "Keine davon" }, { wert: "gastronomie", text: "Gaststätten" }, { wert: "bau", text: "Baugewerbe" }];
  it("in beide Richtungen", () => {
    expect(exklusiv(o[0]!)).toBe(true);
    expect(mehrfachUmschalten(["gastronomie"], "keine", o)).toEqual(["keine"]);
    expect(mehrfachUmschalten(["keine"], "bau", o)).toEqual(["bau"]);
    expect(mehrfachUmschalten(["gastronomie"], "bau", o)).toEqual(["gastronomie", "bau"]);
    expect(mehrfachUmschalten(["gastronomie", "bau"], "bau", o)).toEqual(["gastronomie"]);
    expect(exklusiv({ wert: "Keine Mängel festgestellt", text: "Keine Mängel festgestellt" })).toBe(false);
  });
});

describe("Rechnungsabschluss (UX #4, Kfz #11, Bäckerei #14)", () => {
  it("gelbe Zeile nur mit Zahlungsziel und ohne IBAN", () => {
    expect(ohneZahlungsweg({ zahlungsziel: "14" }, "")).toBe(true);
    expect(ohneZahlungsweg({ zahlungsziel: "14" }, "DE02120300000000202051")).toBe(false);
    expect(ohneZahlungsweg({ zahlungsziel: "sofort" }, "")).toBe(false);
    expect(ohneZahlungsweg({ zahlungsziel: "14", bezahlt_am: "2026-10-21" }, "")).toBe(false);
    expect(ohneZahlungsweg({ zahlungsziel: "14", hinweise: ["gutschrift"] }, "")).toBe(false);
  });
  it("Grundstücks-Hinweis: Bau und Handwerk, nicht Lebensmittelhandwerk", () => {
    expect(handwerkLaut({ "taetigkeit.branchen": ["bau"] })).toBe(true);
    expect(handwerkLaut({ "taetigkeit.branchen": ["handwerk"] })).toBe(true);
    expect(handwerkLaut({ "taetigkeit.branchen": ["handwerk", "gastronomie_lebensmittel"] })).toBe(false);
    expect(handwerkLaut({ "taetigkeit.branchen": ["beauty_kosmetik"] })).toBe(false);
  });
});

describe("Bezahlschirm (UX #12)", () => {
  it("Überschrift aus dem Anlass, Ausweg mit Monat, Ersparnis nur aus Store-Preisen", () => {
    // E-156: der Anlass ist die zweite Vorlage im Monat
    expect(TEXT.r12_pro_anlass.pdf(1)).toBe("Vorlage 2 diesen Monat – mit Pro ohne Limit");
    expect(naechsterMonat(new Date("2026-10-21T10:00:00Z"))).toBe("November");
    expect(naechsterMonat(new Date("2026-12-31T10:00:00Z"))).toBe("Januar");
    expect(TEXT.r12_pro_entwurf("November", 1)).toBe("Als Entwurf behalten – am 1. November wieder 1 Vorlage frei");
    expect(ersparnis([{ zeitraum: "jährlich", betrag: 59.99 }, { zeitraum: "monatlich", betrag: 7.99 }])).toBe(37);
    expect(ersparnis([{ zeitraum: "jährlich" }, { zeitraum: "monatlich", betrag: 7.99 }])).toBeNull();
  });
});
