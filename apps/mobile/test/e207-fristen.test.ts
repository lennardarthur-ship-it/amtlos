/**
 * E-207: versäumte einmalige Fristen bleiben als „überfällig“ sichtbar (Befund 4), Erinnerungen an jede Frist mit Datum,
 * die die App zeigt – auch an die, die noch von Angaben abhängen – und ein Hinweis, wenn der Plan endet (Befund 5).
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, erledigtSetzen } from "../src/unterlagen/speicher";
import { auswertung, dringlichkeit, fortschritt, istErledigt, terminStand, zaehlung, type Profil } from "../src/pflichten/check";
import { MAX_MITTEILUNGEN, erinnerungen, erinnerungsPlan, erinnerungsText } from "../src/pflichten/erinnerungsplan";
import { freiePflichten } from "../src/pro/regeln";

const betrieb = LEERER_STAND.betrieb;
const FB = "gruendung.fragebogen_steuerliche_erfassung";
const imCheck = (p: Profil, am = "2026-10-25T08:00:00.000Z") => Object.fromEntries(Object.keys(p).map((k) => [`profil:${k}`, am]));
/** Einzelunternehmen, am 01.09.2026 gestartet, Kleinunternehmer – Fragebogen fällig am 01.10.2026 (§ 138 Abs. 4 AO, ein Monat) */
const jung: Profil = { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BE", "beschaeftigte.gesamt": 0, "ust.kleinunternehmer": true, gruendungsdatum: "2026-09-01", steuerberater: false, "online.website": false };
/** typisches Einzelunternehmen nach dem Pflichten-Check (Kleinunternehmer, keine Fragen zum Vorjahr beantwortet) */
// E-231: Kleinunternehmer ohne Einkauf im EU-Ausland (Kern-Check-Frage seit E-231) – sonst „hängt ab“ die Voranmeldung nach § 18 Abs. 4a UStG mit monatlichem Termin
// E-237: C.37 steht wieder im Bündel (freigegeben) – ohne Antwort zum Einkauf im Ausland (Kern-Frage seit E-234) „hängt ab“ mit Terminen je Vierteljahr
const solo: Profil = { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", "gesellschaft.handelsregister": false, "taetigkeit.einordnung": "gewerbe", bundesland: "NW", "beschaeftigte.gesamt": 0, "ust.kleinunternehmer": true, gruendungsdatum: "2023-01-01", steuerberater: false, "online.website": false, "einkauf.eu_unternehmen": false, "einkauf.ausland_unternehmen": false };
const stand = (p: Profil, heute: string, erledigt: Record<string, string> = {}, zeiten: Record<string, string> | undefined = imCheck(p)) => {
  const a = terminStand(auswertung(p, heute), { erledigt, zeiten }, heute);
  return { a, e: { erledigt, zeiten, unterlagen: [], betrieb, heute } };
};
const finde = (a: ReturnType<typeof auswertung>, id: string) => a.gilt.find((p) => p.id === id)!;

describe("Befund 4: versäumte einmalige Fristen bleiben sichtbar (E-207)", () => {
  it("Fragebogen am 01.10. versäumt → am 26.10. überfällig, oben in „Jetzt dran“, gezählt, mit Erinnerung", () => {
    // E-212 (T-240): Check vor dem Termin – Termine vor dem ersten Check sind „zu klären“ (e212-kerncheck.test.ts)
    const { a, e } = stand(jung, "2026-10-26", {}, imCheck(jung, "2026-09-15T08:00:00.000Z"));
    const fb = finde(a, FB);
    expect(fb.naechsterTermin).toBe("2026-10-01");
    expect(fb.ueberfaellig).toEqual(["2026-10-01"]);
    expect(istErledigt(fb, e)).toBe(false);
    const d = dringlichkeit(a, e, "2026-10-26");
    expect(d.jetzt.map((p) => p.id)).toContain(FB);
    // Überfälliges steht vorn (auch die Gewerbeanzeige, fällig zum Start am 01.09.)
    const vorn = d.jetzt.slice(0, d.jetzt.findIndex((p) => p.id === FB) + 1);
    expect(vorn.every((p) => p.naechsterTermin && p.naechsterTermin < "2026-10-26")).toBe(true);
    // „N Termine in den nächsten 2 Wochen“ zählt den überfälligen Termin mit, nicht als Aufgabe ohne Termin
    expect(d.termine).toBeGreaterThanOrEqual(1);
    expect(d.jetzt.filter((p) => !p.naechsterTermin).map((p) => p.id)).not.toContain(FB);
    // ohne Pro: der überfällige Termin gehört zu den 3 freien (wie bei wiederkehrenden, E-192)
    expect(freiePflichten(a, betrieb, "2026-10-26").has(FB)).toBe(true);
    // Mitteilungen: morgen und danach wöchentlich, „Seit N Tagen überfällig“
    const ueber = erinnerungen(a, e, "2026-10-26").filter((x) => x.pflichtId === FB);
    expect(ueber.map((x) => [x.art, x.am])).toEqual([["ueberfaellig", "2026-10-27"], ["ueberfaellig", "2026-11-03"], ["ueberfaellig", "2026-11-10"]]);
    expect(erinnerungsText(ueber[0]!)).toBe("Seit 26 Tagen überfällig");
  });
  it("auch ohne Zeitpunkte der Antworten und wenn der Termin vor dem Check lag – eine einmalige Pflicht hat keinen nächsten Termin", () => {
    expect(finde(stand(jung, "2026-10-26", {}, undefined).a, FB).naechsterTermin).toBe("2026-10-01");
    expect(finde(stand(jung, "2027-01-15", {}, imCheck(jung, "2026-09-15T08:00:00.000Z")).a, FB).ueberfaellig).toEqual(["2026-10-01"]);
    // E-212 (T-240): lag der Termin vor dem ersten Check, bleibt er sichtbar, aber als „zu klären“ statt „überfällig“
    const vor = finde(stand(jung, "2027-01-15").a, FB);
    expect([vor.naechsterTermin, vor.vorCheck, vor.ueberfaellig]).toEqual(["2026-10-01", "2026-10-01", undefined]);
  });
  it("abgehakt → erledigt, nicht mehr dran, keine Erinnerung; Haken entfernen → wieder überfällig", () => {
    const erledigt = erledigtSetzen(LEERER_STAND, FB, "2026-10-26", null).erledigt;
    const { a, e } = stand(jung, "2026-10-26", erledigt);
    const fb = finde(a, FB);
    expect(istErledigt(fb, e)).toBe(true);
    expect(dringlichkeit(a, e, "2026-10-26").jetzt.map((p) => p.id)).not.toContain(FB);
    expect(erinnerungen(a, e, "2026-10-26").some((x) => x.pflichtId === FB)).toBe(false);
    expect(fortschritt(a, e).fertig).toBeGreaterThanOrEqual(1);
    const ohne = stand(jung, "2026-10-26", {});
    expect(istErledigt(finde(ohne.a, FB), ohne.e)).toBe(false);
  });
  it("noch nicht fällig: unverändert (Termin in der Zukunft, nichts überfällig)", () => {
    const fb = finde(stand(jung, "2026-09-15").a, FB);
    expect(fb.naechsterTermin).toBe("2026-10-01");
    expect(fb.ueberfaellig).toBeUndefined();
  });
  it("Bestandsbetrieb: Gründungsschritte bleiben in „Aus der Gründung“ und werden nicht überfällig", () => {
    const a = stand(solo, "2026-10-26").a;
    expect(a.gilt.some((p) => p.id === FB)).toBe(false);
    expect(a.gruendung.find((p) => p.id === FB)?.ueberfaellig).toBeUndefined();
  });
  it("Bestandsbetrieb am Tag des Checks (wie im Rundgang: Bayern, 3 Beschäftigte, Kasse seit 01.03.2024): nichts überfällig", () => {
    const p: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "personal.lohn_durch": "lohnbuero", "kasse.elektronisch": true, "kasse.angeschafft_am": "2024-03-01", "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", gruendungsdatum: "2024-03-01" };
    const { a } = stand(p, "2026-10-26", {}, imCheck(p, "2026-10-26T08:00:00.000Z"));
    expect([...a.gilt, ...a.gruendung, ...a.unbekannt, ...a.beiEinstellung].filter((x) => x.ueberfaellig).map((x) => x.id)).toEqual([]);
  });
  it("Zählung unverändert: 3 frei + N weitere = alle Pflichten", () => {
    const { a } = stand(jung, "2026-10-26");
    expect(zaehlung(a.gilt).pflichten).toBe(zaehlung(stand(jung, "2026-09-15").a.gilt).pflichten);
  });
});

describe("Befund 5: Erinnerung an jede Frist mit Datum (E-207)", () => {
  const heute = "2026-10-26";
  it("typisches Einzelunternehmen: jede Frist mit Datum, die die App zeigt, hat eine Erinnerung – nicht nur die Einkommensteuer", () => {
    const { a, e } = stand(solo, heute);
    const er = erinnerungen(a, e, heute);
    // was die App mit Datum zeigt: „Dein Jahr“/Liste (gilt) und die Pflicht-Seite der Einträge, die noch von Angaben abhängen
    const gezeigt = [...a.gilt.filter((p) => !p.lohnbuero), ...a.unbekannt].flatMap((p) => p.termine.map((t) => `${p.id}|${t}`));
    const erinnert = new Set(er.map((x) => `${x.pflichtId}|${x.termin}`));
    expect(gezeigt.filter((k) => !erinnert.has(k))).toEqual([]);
    for (const id of ["steuern.est_erklaerung", "steuern.euer", "steuern.gewst_erklaerung", "steuern.vorauszahlung_est_kst", "steuern.vorauszahlung_gewst"]) expect(er.some((x) => x.pflichtId === id)).toBe(true);
    // vorher: zwei Mitteilungen im ganzen Jahr (Einkommensteuer drei Tage vorher und am Tag)
    expect(erinnerungsPlan(a, e, heute).mitteilungen.filter((m) => !m.weiterplanen).length).toBeGreaterThan(10);
  });
  it("Einträge, die von Angaben abhängen: eine Erinnerung drei Tage vorher mit „falls es für dich gilt“, kein „überfällig“", () => {
    const { a, e } = stand(solo, heute);
    const vz = erinnerungen(a, e, heute).filter((x) => x.pflichtId === "steuern.vorauszahlung_gewst");
    expect(vz.every((x) => x.art === "vorher" && x.vielleicht)).toBe(true);
    expect(vz[0]!.am).toBe("2026-11-13");
    expect(erinnerungsText(vz[0]!)).toBe("Fällig am 16.11.2026, falls es für dich gilt – kläre es in der App");
    // gilt sie (Vorauszahlungen festgesetzt), ist es eine gewöhnliche Erinnerung (vorher und am Tag)
    const mit = stand({ ...solo, "vorauszahlung.gewst": true, "gewinn.vorjahr": 40000 }, heute);
    const vz2 = erinnerungen(mit.a, mit.e, heute).filter((x) => x.pflichtId === "steuern.vorauszahlung_gewst");
    expect(vz2.some((x) => x.art === "heute")).toBe(true);
    expect(vz2.some((x) => x.vielleicht)).toBe(false);
  });
  it("Plan endet wegen der Höchstzahl: die letzte Mitteilung sagt, dass die App geöffnet werden muss – nie mehr als 60", () => {
    const salon: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "kasse.elektronisch": true, "online.website": false, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", gruendungsdatum: "2024-03-01" };
    const { a, e } = stand(salon, heute);
    const plan = erinnerungsPlan(a, e, heute);
    expect(plan.mitteilungen.length).toBeLessThanOrEqual(MAX_MITTEILUNGEN);
    expect(plan.geplantBis).not.toBeNull();
    const letzte = plan.mitteilungen[plan.mitteilungen.length - 1]!;
    expect(letzte.weiterplanen).toBe(true);
    expect(letzte.erinnerungen).toEqual([]);
    expect(letzte.am > plan.mitteilungen[plan.mitteilungen.length - 2]!.am).toBe(true);
    expect(letzte.am <= plan.geplantBis!).toBe(false);
    expect(letzte.text).toMatch(/öffne/i);
  });
  it("Plan reicht bis zum letzten Termin: ein Hinweis vor Ablauf der zwölf Monate, damit die nächsten Fristen geplant werden", () => {
    const { a, e } = stand(solo, heute);
    const plan = erinnerungsPlan(a, e, heute);
    expect(plan.geplantBis).toBeNull();
    const letzte = plan.mitteilungen[plan.mitteilungen.length - 1]!;
    expect(letzte.weiterplanen).toBe(true);
    expect(letzte.am).toBe("2027-09-26");
    expect(plan.mitteilungen.filter((m) => m.weiterplanen)).toHaveLength(1);
  });
});
