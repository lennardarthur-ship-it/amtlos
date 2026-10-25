/**
 * E-192: richtige SV-Fälligkeiten in der App, versäumte Termine bleiben sichtbar, Erinnerungen vor jeder Frist,
 * einheitliche Zählung „3 frei + N weitere = alle Pflichten“.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, erledigtSetzen, profilSetzen } from "../src/unterlagen/speicher";
import { auswertung, begleitetSeit, dringlichkeit, hakenOhne, istErledigt, terminStand, zaehlung, type Profil } from "../src/pflichten/check";
import { MAX_MITTEILUNGEN, erinnerungen, erinnerungsPlan, erinnerungsText } from "../src/pflichten/erinnerungsplan";
import { PFLICHTEN_FREI, freiePflichten, weiterePflichten } from "../src/pro/regeln";

const betrieb = LEERER_STAND.betrieb;
const VA = "steuern.ust_voranmeldung";
/** Agentur in Berlin, ohne Beschäftigte, Voranmeldung monatlich */
const agentur: Profil = { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BE", "beschaeftigte.gesamt": 0, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", "ust.dauerfristverlaengerung": false, gruendungsdatum: "2024-01-01", steuerberater: false, "online.website": true };
/** Salon in Bayern mit drei Beschäftigten */
const salon: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "kasse.elektronisch": true, "online.website": false, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", gruendungsdatum: "2024-03-01" };
/** Zeitpunkte der Antworten wie nach einem Check am 25.10.2026 */
const imCheck = (p: Profil, am = "2026-10-25T08:00:00.000Z") => Object.fromEntries(Object.keys(p).map((k) => [`profil:${k}`, am]));
const finde = (a: ReturnType<typeof auswertung>, id: string) => a.gilt.find((p) => p.id === id)!;
const stand = (heute: string, erledigt: Record<string, string> = {}, zeiten: Record<string, string> = imCheck(agentur)) => {
  const a = terminStand(auswertung(agentur, heute), { erledigt, zeiten }, heute);
  return { a, e: { erledigt, zeiten, unterlagen: [], betrieb, heute } };
};

describe("SV-Termine in der App (E-192)", () => {
  it("Fälligkeit und Beitragsnachweis wie in den amtlichen Tabellen – Dezember und Mai nicht mehr zu spät", () => {
    const a = auswertung(salon, "2026-10-25");
    const sv = finde(a, "personal.sv_beitraege").termine;
    const bn = finde(a, "personal.beitragsnachweis").termine;
    expect(sv.slice(0, 3)).toEqual(["2026-10-28", "2026-11-26", "2026-12-28"]);
    expect(bn.slice(0, 3)).toEqual(["2026-10-26", "2026-11-24", "2026-12-22"]);
    // Mai 2027: Fronleichnam (27.05.) in Ländern wie BY, NW – der frühere Termin, egal wo der Betrieb sitzt
    expect(sv).toContain("2027-05-26");
    expect(bn).toContain("2027-05-24");
    expect(finde(auswertung({ ...salon, bundesland: "BE" }, "2026-10-25"), "personal.sv_beitraege").termine).toContain("2027-05-26");
  });
  it("Voranmeldung am 10. mit Verschiebung nach § 108 Abs. 3 AO (nicht nach Bankarbeitstagen)", () => {
    expect(finde(auswertung(agentur, "2026-10-25"), VA).termine.slice(0, 4)).toEqual(["2026-11-10", "2026-12-10", "2027-01-11", "2027-02-10"]);
  });
});

describe("Versäumte Termine bleiben sichtbar (E-192)", () => {
  it("VA 10.11. nicht abgehakt → am 11.11. überfällig, oben in „Jetzt dran“; abgehakt am 12.11. → nächster Termin 10.12.", () => {
    const { a, e } = stand("2026-11-11");
    const va = finde(a, VA);
    expect(va.naechsterTermin).toBe("2026-11-10");
    expect(va.ueberfaellig).toEqual(["2026-11-10"]);
    expect(istErledigt(va, e)).toBe(false);
    const d = dringlichkeit(a, e, "2026-11-11");
    expect(d.jetzt[0]!.naechsterTermin! < "2026-11-11").toBe(true);
    expect(d.jetzt.map((p) => p.id)).toContain(VA);
    // abhaken wie in der App: Haken für den angezeigten (überfälligen) Termin
    const erledigt = erledigtSetzen(LEERER_STAND, VA, "2026-11-12", va.naechsterTermin).erledigt;
    const danach = stand("2026-11-12", erledigt);
    const va2 = finde(danach.a, VA);
    expect(va2.naechsterTermin).toBe("2026-12-10");
    expect(va2.ueberfaellig).toBeUndefined();
    expect(istErledigt(va2, danach.e)).toBe(false);
  });
  it("zwei versäumte Termine: erst der ältere, nach dem Haken der nächste", () => {
    const { a } = stand("2026-12-15");
    expect(finde(a, VA).ueberfaellig).toEqual(["2026-11-10", "2026-12-10"]);
    expect(finde(a, VA).naechsterTermin).toBe("2026-11-10");
    const nach = stand("2026-12-15", erledigtSetzen(LEERER_STAND, VA, "2026-12-15", "2026-11-10").erledigt);
    expect(finde(nach.a, VA).naechsterTermin).toBe("2026-12-10");
  });
  it("im Voraus abgehakt bleibt erledigt bis zum Termin, danach kommt der nächste", () => {
    const erledigt = erledigtSetzen(LEERER_STAND, VA, "2026-11-02", "2026-11-10").erledigt;
    const vorher = stand("2026-11-05", erledigt);
    expect(istErledigt(finde(vorher.a, VA), vorher.e)).toBe(true);
    const nachher = stand("2026-11-11", erledigt);
    expect(finde(nachher.a, VA).naechsterTermin).toBe("2026-12-10");
    expect(finde(nachher.a, VA).ueberfaellig).toBeUndefined();
  });
  it("Termine vor dem Check gelten nicht als versäumt – auch nicht ohne Haken", () => {
    // Check am 25.10.: der Termin 12.10. lag davor
    expect(finde(stand("2026-10-25").a, VA).ueberfaellig).toBeUndefined();
    expect(finde(stand("2026-10-25").a, VA).naechsterTermin).toBe("2026-11-10");
    // ohne Zeitpunkte (ältere Daten) und ohne Haken: nichts Überfälliges erfinden
    expect(finde(stand("2026-11-11", {}, {}).a, VA).ueberfaellig).toBeUndefined();
  });
  it("später geänderte Angabe, auf der die Pflicht beruht, verschiebt den Beginn (z. B. Rhythmus erst am 15.11. angegeben)", () => {
    const zeiten = { ...imCheck(agentur), "profil:ust.voranmeldung_rhythmus": "2026-11-15T10:00:00.000Z" };
    const va = finde(auswertung(agentur, "2026-11-20"), VA);
    expect(va.ausloeserFelder).toContain("ust.voranmeldung_rhythmus");
    expect(begleitetSeit(va, zeiten)).toBe("2026-11-15");
    expect(finde(terminStand(auswertung(agentur, "2026-11-20"), { erledigt: {}, zeiten }, "2026-11-20"), VA).ueberfaellig).toBeUndefined();
    // eine andere Angabe (Website) verschiebt nichts
    const andere = { ...imCheck(agentur), "profil:online.website": "2026-11-15T10:00:00.000Z" };
    expect(begleitetSeit(va, andere)).toBe("2026-10-25");
  });
  it("Zeitpunkte aus profilSetzen zählen in deutscher Zeit", () => {
    const s = profilSetzen(LEERER_STAND, agentur);
    const tag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    expect(begleitetSeit({ ausloeserFelder: [] }, s.zeiten)).toBe(tag);
  });
  it("Haken entfernen: der Termin davor gilt als erledigt – Älteres kehrt nicht als „überfällig“ zurück", () => {
    const erledigt = erledigtSetzen(LEERER_STAND, VA, "2026-11-12", "2026-11-10").erledigt;
    const { a } = stand("2026-11-12", erledigt);
    const ohne = hakenOhne(finde(a, VA), erledigt[VA]);
    expect(ohne).toEqual({ datum: "2026-11-12", termin: "2026-10-12" });
    const zurueck = stand("2026-11-12", erledigtSetzen(LEERER_STAND, VA, ohne!.datum, ohne!.termin).erledigt);
    expect(finde(zurueck.a, VA).naechsterTermin).toBe("2026-11-10");
    // einen im Voraus gesetzten Haken entfernen: wieder offen, nichts überfällig
    const voraus = erledigtSetzen(LEERER_STAND, VA, "2026-12-01", "2026-12-10").erledigt;
    const s2 = stand("2026-12-01", { ...voraus });
    const ohne2 = hakenOhne(finde(s2.a, VA), voraus[VA]);
    expect(ohne2?.termin).toBe("2026-11-10");
    const s3 = stand("2026-12-01", erledigtSetzen(LEERER_STAND, VA, ohne2!.datum, ohne2!.termin).erledigt);
    expect(finde(s3.a, VA).naechsterTermin).toBe("2026-12-10");
    expect(istErledigt(finde(s3.a, VA), s3.e)).toBe(false);
  });
  it("Freie Pflichten ohne Pro: ein überfälliger Termin zählt als dringendster", () => {
    const heute = "2026-11-25";
    const zeiten = imCheck(salon);
    const roh = auswertung(salon, heute);
    const ohne = freiePflichten(roh, betrieb, heute);
    const a = terminStand(roh, { erledigt: {}, zeiten }, heute);
    const frei = freiePflichten(a, betrieb, heute);
    const ueber = a.gilt.filter((p) => p.ueberfaellig && !p.lohnbuero && p.einordnung === "pflicht").map((p) => p.id);
    expect(ueber).toContain(VA);
    expect(ohne.has(VA)).toBe(false);
    expect(frei.has(VA)).toBe(true);
  });
});

describe("Zählung: 3 frei + N weitere = alle Pflichten (E-192)", () => {
  const profile: Profil[] = [
    agentur,
    salon,
    { ...salon, rechtsform: "gmbh", gruendungsdatum: "2026-09-01", alg1_bezug: true },
    { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "SN", "beschaeftigte.gesamt": 2, "kasse.elektronisch": true, "online.website": true, "ust.kleinunternehmer": false, steuerberater: true, gruendungsdatum: "2022-03-01" },
  ];
  it.each(profile.map((p, i) => [i, p] as const))("Profil %i", (_, p) => {
    const heute = "2026-10-25";
    const a = terminStand(auswertung(p, heute), { erledigt: {}, zeiten: imCheck(p) }, heute);
    const frei = freiePflichten(a, betrieb, heute);
    const gesamt = zaehlung(a.gilt).pflichten;
    expect(frei.size).toBe(Math.min(PFLICHTEN_FREI, gesamt));
    // nur echte Pflichten sind frei – Hinweise und Optionen zählen nirgends als „Pflicht“
    for (const id of frei) expect(a.gilt.find((x) => x.id === id)!.einordnung).toBe("pflicht");
    expect(frei.size + weiterePflichten(a, frei)).toBe(gesamt);
    // Hinweise/Optionen gibt es – sie dürfen „… und N weitere Pflichten“ nicht aufblähen
    expect(weiterePflichten(a, frei)).toBeLessThanOrEqual(a.gilt.length - frei.size);
  });
});

describe("Erinnerungen vor jeder Frist (E-192)", () => {
  it("plant alle Termine der nächsten Monate, nicht nur den nächsten – 3 Tage vorher und am Tag", () => {
    const { a, e } = stand("2026-10-25");
    const va = erinnerungen(a, e, "2026-10-25").filter((x) => x.pflichtId === VA);
    expect(va.filter((x) => x.art === "heute").map((x) => x.termin).slice(0, 4)).toEqual(["2026-11-10", "2026-12-10", "2027-01-11", "2027-02-10"]);
    expect(va.find((x) => x.termin === "2026-12-10" && x.art === "vorher")!.am).toBe("2026-12-07");
    expect(va.find((x) => x.termin === "2026-12-10" && x.art === "heute")!.am).toBe("2026-12-10");
    // ohne Erinnerung am Tag selbst nur die Vorab-Erinnerung
    expect(erinnerungen(a, e, "2026-10-25", { amTag: false }).filter((x) => x.pflichtId === VA).every((x) => x.art === "vorher")).toBe(true);
  });
  it("abgehakt: der aktuelle Termin entfällt, die späteren bleiben", () => {
    const erledigt = erledigtSetzen(LEERER_STAND, VA, "2026-11-02", "2026-11-10").erledigt;
    const { a, e } = stand("2026-11-02", erledigt);
    const va = erinnerungen(a, e, "2026-11-02").filter((x) => x.pflichtId === VA);
    expect(va.some((x) => x.termin === "2026-11-10")).toBe(false);
    expect(va.some((x) => x.termin === "2026-12-10")).toBe(true);
  });
  it("versäumt: morgen und danach wöchentlich, mit „Seit N Tagen überfällig“; nach dem Haken nicht mehr", () => {
    const { a, e } = stand("2026-11-11");
    const ueber = erinnerungen(a, e, "2026-11-11").filter((x) => x.art === "ueberfaellig" && x.pflichtId === VA);
    expect(ueber.map((x) => x.am)).toEqual(["2026-11-12", "2026-11-19", "2026-11-26"]);
    expect(erinnerungsText(ueber[0]!)).toBe("Seit 2 Tagen überfällig");
    expect(erinnerungsText(ueber[1]!)).toBe("Seit 9 Tagen überfällig");
    const nach = stand("2026-11-12", erledigtSetzen(LEERER_STAND, VA, "2026-11-12", "2026-11-10").erledigt);
    expect(erinnerungen(nach.a, nach.e, "2026-11-12").some((x) => x.art === "ueberfaellig" && x.pflichtId === VA)).toBe(false);
  });
  it("eine Mitteilung je Tag, höchstens 60 (iOS: 64), mit ehrlichem „geplant bis“, wenn der Plan früher endet", () => {
    const heute = "2026-10-25";
    const a = terminStand(auswertung(salon, heute), { erledigt: {}, zeiten: imCheck(salon) }, heute);
    const e = { erledigt: {}, unterlagen: [], betrieb };
    const alle = erinnerungsPlan(a, e, heute, { max: 1000 });
    const tage = alle.mitteilungen.map((m) => m.am);
    expect(new Set(tage).size).toBe(tage.length);
    expect(tage).toEqual([...tage].sort());
    expect(alle.geplantBis).toBeNull();
    // Termine am selben Tag teilen sich eine Mitteilung
    const mehrere = alle.mitteilungen.find((m) => m.erinnerungen.length > 1)!;
    expect(mehrere.titel).toBe(`${mehrere.erinnerungen.length} Fristen`);
    expect(mehrere.text.split("\n")).toHaveLength(mehrere.erinnerungen.length);
    const plan = erinnerungsPlan(a, e, heute);
    expect(plan.mitteilungen.length).toBeLessThanOrEqual(MAX_MITTEILUNGEN);
    expect(MAX_MITTEILUNGEN).toBeLessThan(64);
    if (alle.mitteilungen.length > MAX_MITTEILUNGEN) expect(plan.geplantBis).toBe(plan.mitteilungen[MAX_MITTEILUNGEN - 1]!.am);
    const knapp = erinnerungsPlan(a, e, heute, { max: 5 });
    expect(knapp.mitteilungen).toHaveLength(5);
    expect(knapp.geplantBis).toBe(knapp.mitteilungen[4]!.am);
    // nichts in der Vergangenheit, nichts nach dem letzten Termin des Jahres
    expect(tage.every((t) => t >= heute)).toBe(true);
  });
  it("Lohnbüro: Lohntermine melden sich nicht", () => {
    const mit = { ...salon, "personal.lohn_durch": "lohnbuero" };
    const a = auswertung(mit, "2026-10-25");
    expect(erinnerungen(a, { erledigt: {}, unterlagen: [], betrieb }, "2026-10-25").some((x) => x.pflichtId === "personal.beitragsnachweis")).toBe(false);
  });
});
