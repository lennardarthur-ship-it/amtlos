/**
 * E-212 (Gründerentscheidungen vom 26.10.2026 zu T-240 und T-241):
 * 1. Einmalige Fristen, die schon vor dem ersten Pflichten-Check abgelaufen waren, stehen ruhig da („Frist war am … –
 *    schon erledigt?“, „Ja, erledigt“), zählen als „zu klären“ statt als Termin und melden sich nicht als „überfällig“.
 *    Fristen, die erst nach dem Check ablaufen, bleiben rot mit Erinnerungen (E-207).
 * 2. Der Kern-Check fragt nach Kunden in anderen EU-Ländern (bestehende Frage `kunden.regionen`, bei „Andere EU-Länder“
 *    die bestehenden Folgefragen) und bei Betrieben mit Vorjahr nach den Angaben, die EÜR, Gewerbesteuer und
 *    Vorauszahlungen einen Termin geben. „Weiß ich nicht“ blendet nichts aus; „falls es für dich gilt“ bleibt der Rückfall.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND, erledigtSetzen } from "../src/unterlagen/speicher";
import { WEISS_NICHT_FELDER, auswertung, beantwortet, checkFragen, dringlichkeit, istErledigt, terminStand, type Profil } from "../src/pflichten/check";
import { erinnerungen } from "../src/pflichten/erinnerungsplan";
import { freiePflichten, weiterePflichten } from "../src/pro/regeln";
import { T as TEXT } from "../src/texte";

const betrieb = LEERER_STAND.betrieb;
const FB = "gruendung.fragebogen_steuerliche_erfassung";
const GA = "gruendung.gewerbeanzeige";
const BG = "gruendung.berufsgenossenschaft";
const heute = "2026-10-26";
const zeitenAm = (p: Profil, am: string) => Object.fromEntries(Object.keys(p).map((k) => [`profil:${k}`, am]));
/** Einzelunternehmen, gestartet am 01.09.2026 – Gewerbeanzeige zum Start, Fragebogen am 01.10.2026 fällig */
const jung: Profil = { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BE", "beschaeftigte.gesamt": 0, "ust.kleinunternehmer": true, gruendungsdatum: "2026-09-01", steuerberater: false, "online.website": false };
const stand = (p: Profil, zeiten: Record<string, string> | undefined, erledigt: Record<string, string> = {}, tag = heute) => {
  const a = terminStand(auswertung(p, tag), { erledigt, zeiten }, tag);
  return { a, e: { erledigt, zeiten, unterlagen: [], betrieb, heute: tag } };
};
const finde = (a: ReturnType<typeof auswertung>, id: string) => a.gilt.find((p) => p.id === id)!;

describe("T-240: einmalige Fristen vor dem ersten Check – ruhig, „zu klären“, ohne Mitteilung", () => {
  it("erster Check am 25.10.: Fragebogen (01.10.), Gewerbeanzeige und Berufsgenossenschaft stehen mit „Frist war am …“, nicht als überfällig", () => {
    const { a, e } = stand(jung, zeitenAm(jung, "2026-10-25T08:00:00.000Z"));
    for (const id of [FB, GA, BG]) {
      const p = finde(a, id);
      expect(p.vorCheck).toBe(p.naechsterTermin);
      expect(p.ueberfaellig).toBeUndefined();
      expect(istErledigt(p, e)).toBe(false);
    }
    expect(finde(a, FB).vorCheck).toBe("2026-10-01");
    // sichtbar: vorn bei „Jetzt dran“ und unter den 3 freien Pflichten ohne Pro (dort abhakbar)
    const d = dringlichkeit(a, e, heute);
    expect(d.jetzt.map((p) => p.id)).toEqual(expect.arrayContaining([FB, GA]));
    expect(freiePflichten(a, betrieb, heute).has(FB)).toBe(true);
    // gezählt als „zu klären“, nicht als Termin
    expect(d.zuKlaeren).toBe(3);
    expect(d.jetzt.filter((p) => p.naechsterTermin && !p.vorCheck && p.naechsterTermin <= "2026-11-09").length).toBe(d.termine);
    // keine Erinnerung „überfällig“ (und auch sonst keine – der Termin ist vorbei)
    expect(erinnerungen(a, e, heute).filter((x) => x.pflichtId === FB || x.pflichtId === GA)).toEqual([]);
  });
  it("Texte: ruhiger Status und die schnelle Antwort", () => {
    expect(TEXT.e212_frist_war("01.10.2026")).toBe("Frist war am 01.10.2026 – schon erledigt?");
    expect(TEXT.e212_ja_erledigt).toBe("Ja, erledigt");
    expect(TEXT.r10_ergebnis_bald(1, 0, 2)).toBe("Nach deinen Angaben: 1 Termin in den nächsten 2 Wochen, dazu 2 Fristen zu klären");
    expect(TEXT.r10_ergebnis_bald(0, 0, 1)).toBe("Nach deinen Angaben: keine Termine in den nächsten 2 Wochen, 1 Frist zu klären");
    expect(TEXT.r10_ergebnis_bald(0, 0)).toBe("Nach deinen Angaben: in den nächsten 2 Wochen nichts Dringendes");
  });
  it("„Ja, erledigt“ (Haken) erledigt sie; ohne Haken bleibt sie „zu klären“", () => {
    const zeiten = zeitenAm(jung, "2026-10-25T08:00:00.000Z");
    const erledigt = erledigtSetzen(LEERER_STAND, FB, heute, null).erledigt;
    const { a, e } = stand(jung, zeiten, erledigt);
    expect(istErledigt(finde(a, FB), e)).toBe(true);
    expect(dringlichkeit(a, e, heute).jetzt.map((p) => p.id)).not.toContain(FB);
    expect(dringlichkeit(a, e, heute).zuKlaeren).toBe(2);
  });
  it("Check vor dem Termin (15.09.): Fragebogen läuft danach ab → rot „überfällig“ mit Erinnerungen wie bisher (E-207)", () => {
    const { a, e } = stand(jung, zeitenAm(jung, "2026-09-15T08:00:00.000Z"));
    const fb = finde(a, FB);
    expect(fb.ueberfaellig).toEqual(["2026-10-01"]);
    expect(fb.vorCheck).toBeUndefined();
    expect(erinnerungen(a, e, heute).filter((x) => x.pflichtId === FB).map((x) => x.art)).toEqual(["ueberfaellig", "ueberfaellig", "ueberfaellig"]);
    // Gewerbeanzeige (01.09.) und Berufsgenossenschaft (08.09.) lagen vor diesem Check
    expect(finde(a, GA).vorCheck).toBe("2026-09-01");
    expect(finde(a, BG).vorCheck).toBe("2026-09-08");
    const d = dringlichkeit(a, e, heute);
    expect(d.zuKlaeren).toBe(2);
    // die echte Versäumnis steht vor der ruhigen
    expect(d.jetzt.findIndex((p) => p.id === FB)).toBeLessThan(d.jetzt.findIndex((p) => p.id === GA));
  });
  it("Startdatum erst nach dem Termin eingetragen: die App kannte die Pflicht vorher nicht – ebenfalls „zu klären“", () => {
    const zeiten = { ...zeitenAm(jung, "2026-08-20T08:00:00.000Z"), "profil:gruendungsdatum": "2026-10-20T08:00:00.000Z" };
    expect(finde(stand(jung, zeiten).a, FB).vorCheck).toBe("2026-10-01");
  });
  it("ohne Zeitpunkte der Antworten (ältere Daten): wie bisher überfällig – nichts wird still entschärft", () => {
    const fb = finde(stand(jung, undefined).a, FB);
    expect(fb.ueberfaellig).toEqual(["2026-10-01"]);
    expect(fb.vorCheck).toBeUndefined();
  });
});

/** Kern-Check durchlaufen wie in der App: jede gestellte Frage mit der Vorgabe, sonst Nein / 0 / „keine“ / erste Option. */
function durchlaufen(vorgabe: Profil): Profil {
  let p: Profil = {};
  for (let runde = 0; runde < 12; runde++) {
    let neu = false;
    for (const f of checkFragen(p)) {
      if (f.feld in p) continue;
      const opt = Object.keys(f.optionen ?? {});
      const keine = opt.find((o) => o.startsWith("keine"));
      p = { ...p, [f.feld]: f.feld in vorgabe ? vorgabe[f.feld]! : f.art === "janein" ? false : f.art === "zahl" || f.art === "betrag" ? 0 : f.art === "mehrfach" ? [keine ?? opt[0]!] : f.art === "auswahl" ? opt[0]! : null };
      neu = true;
    }
    if (!neu) break;
  }
  return p;
}
const felder = (p: Profil) => checkFragen(p).map((f) => f.feld);
const datiertOffen = (p: Profil) => auswertung(p, heute).unbekannt.filter((x) => x.termine.length).map((x) => x.id);

/** typisches Einzelunternehmen (Handwerk, Kleinunternehmer, seit 2023) */
const solo: Profil = { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "NW", gruendungsdatum: "2023-01-01", "beschaeftigte.gesamt": 0, "betriebsstaetten.anzahl": 1, "fahrzeuge.anzahl": 1, "ust.kleinunternehmer": true, "kunden.regionen": ["inland"], "gewinn.vorjahr": 18000 };

describe("T-241: Kern-Check gibt OSS, EÜR, Gewerbesteuer und Vorauszahlungen echte Termine", () => {
  it("bestehendes Einzelunternehmen: Kunden-Regionen und die Vorjahresangaben stehen im Kern-Check", () => {
    const f = felder(durchlaufen(solo));
    for (const x of ["kunden.regionen", "gewinn.vorjahr", "steuern.buchfuehrung_mitteilung", "vorauszahlung.est_kst", "vorauszahlung.gewst"]) expect(f).toContain(x);
    // nur Kunden im Inland: keine Folgefragen
    expect(f).not.toContain("kunden.segmente");
    expect(f).not.toContain("vertrieb.kanaele");
    // die Steuer des Vorjahres bestimmt nur den Rhythmus der Voranmeldung, nach dem der Check direkt fragt
    expect(f).not.toContain("ust.zahllast_vorjahr");
    expect(f).not.toContain("umsatz.vorjahr");
  });
  it("Gründung im laufenden Jahr: keine Fragen zum Vorjahr, aber die Kunden-Regionen", () => {
    const f = felder(durchlaufen({ ...solo, gruendungsdatum: "2026-08-01" }));
    expect(f).toContain("kunden.regionen");
    for (const x of ["gewinn.vorjahr", "steuern.buchfuehrung_mitteilung", "vorauszahlung.est_kst", "vorauszahlung.gewst"]) expect(f).not.toContain(x);
  });
  it("Freiberufler: keine Fragen zu Gewerbesteuer und Buchführungs-Mitteilung (beides betrifft nur Gewerbe)", () => {
    const f = felder(durchlaufen({ ...solo, "taetigkeit.branchen": ["unterricht_sport_coaching"], rechtsform: "freiberuf", "taetigkeit.einordnung": "freiberuf" }));
    expect(f).toContain("vorauszahlung.est_kst");
    for (const x of ["vorauszahlung.gewst", "steuern.buchfuehrung_mitteilung", "gewinn.vorjahr"]) expect(f).not.toContain(x);
  });
  it("GmbH: Vorauszahlungen ja, Gewinn und Buchführungs-Mitteilung nicht (Erklärungen gelten kraft Rechtsform)", () => {
    const f = felder(durchlaufen({ ...solo, rechtsform: "gmbh", "gesellschaft.handelsregister": "eingetragen" }));
    expect(f).toEqual(expect.arrayContaining(["vorauszahlung.est_kst", "vorauszahlung.gewst"]));
    for (const x of ["gewinn.vorjahr", "steuern.buchfuehrung_mitteilung"]) expect(f).not.toContain(x);
  });
  it("typisches Einzelunternehmen: nach dem Kern-Check hängt nur noch die Gewerbesteuererklärung bei kleinem Gewinn von Angaben ab", () => {
    const p = durchlaufen(solo);
    // Gewinn im Vorjahr unter dem Freibetrag: es entscheidet noch der erwartete Gewinn dieses Jahres (Zusatzfrage) – bis
    // dahin einmal im Jahr „falls es für dich gilt“ (Rückfall, E-207); OSS, EÜR, E-Bilanz und Vorauszahlungen sind geklärt
    expect(datiertOffen(p)).toEqual(["steuern.gewst_erklaerung"]);
    const zeiten = zeitenAm(p, "2026-10-25T08:00:00.000Z");
    const { a, e } = stand(p, zeiten);
    expect(erinnerungen(a, e, heute).filter((x) => x.vielleicht).map((x) => x.pflichtId)).toEqual(["steuern.gewst_erklaerung"]);
    expect(a.gilt.map((x) => x.id)).toContain("steuern.euer");
    // Vorauszahlungen festgesetzt, Gewinn über dem Freibetrag: echte Termine statt „falls es für dich gilt“
    const mit = stand(durchlaufen({ ...solo, "gewinn.vorjahr": 40000, "vorauszahlung.est_kst": true, "vorauszahlung.gewst": true }), zeiten);
    for (const id of ["steuern.vorauszahlung_est_kst", "steuern.vorauszahlung_gewst", "steuern.gewst_erklaerung", "steuern.euer"]) expect(mit.a.gilt.find((x) => x.id === id)?.termine.length).toBeGreaterThan(0);
  });
  it("Kunden in anderen EU-Ländern: Folgefragen nach Kundschaft und Vertriebsweg – Onlineshop an Privatkunden ergibt OSS-Termine", () => {
    const eu = { ...solo, "kunden.regionen": ["inland", "eu"] };
    expect(felder(durchlaufen(eu))).toContain("kunden.segmente");
    expect(felder(durchlaufen({ ...eu, "kunden.segmente": ["b2b"] }))).not.toContain("vertrieb.kanaele");
    const b2c = { ...eu, "kunden.segmente": ["b2c"] };
    expect(felder(durchlaufen(b2c))).toContain("vertrieb.kanaele");
    // wer Aufträge per Telefon/E-Mail annimmt, erfüllt die Bedingung schon – keine Frage nach dem Vertriebsweg
    expect(felder(durchlaufen({ ...b2c, "vertrieb.fernabsatz": true }))).not.toContain("vertrieb.kanaele");
    const shop = auswertung(durchlaufen({ ...b2c, "vertrieb.kanaele": ["onlineshop"] }), heute);
    expect(shop.gilt.find((x) => x.id === "steuern.oss_erklaerung")?.termine.length).toBe(4);
    // nur Deutschland: OSS gilt nicht, keine Erinnerung „falls es für dich gilt“
    const inland = auswertung(durchlaufen(solo), heute);
    expect([...inland.gilt, ...inland.unbekannt].some((x) => x.id === "steuern.oss_erklaerung")).toBe(false);
  });
  it("„Weiß ich nicht“: bei den neuen Ja/Nein-Fragen angeboten; übersprungen bleibt alles sichtbar, mit „falls es für dich gilt“", () => {
    for (const x of ["vorauszahlung.est_kst", "vorauszahlung.gewst", "steuern.buchfuehrung_mitteilung"]) expect(WEISS_NICHT_FELDER).toContain(x);
    // „Weiß ich nicht“ lässt die Angabe offen (null) – wie Überspringen bei Zahl und Mehrfachauswahl
    const offen = durchlaufen({ ...solo, "kunden.regionen": null, "gewinn.vorjahr": null, "vorauszahlung.est_kst": null, "vorauszahlung.gewst": null, "steuern.buchfuehrung_mitteilung": null });
    for (const x of ["kunden.regionen", "gewinn.vorjahr", "vorauszahlung.est_kst"]) expect(beantwortet(offen, x)).toBe(false);
    const ids = datiertOffen(offen);
    expect(ids).toEqual(expect.arrayContaining(["steuern.oss_erklaerung", "steuern.vorauszahlung_est_kst", "steuern.vorauszahlung_gewst", "steuern.euer", "steuern.gewst_erklaerung"]));
    const { a, e } = stand(offen, zeitenAm(offen, "2026-10-25T08:00:00.000Z"));
    expect(erinnerungen(a, e, heute).filter((x) => x.vielleicht && x.pflichtId === "steuern.vorauszahlung_est_kst").length).toBeGreaterThan(0);
  });
  it("Bezahlschirm-Teaser (E-188) unverändert: 3 freie Pflichten, „3 + N weitere“ = alle", () => {
    const p = durchlaufen({ ...solo, "gewinn.vorjahr": 40000, "vorauszahlung.est_kst": true, "vorauszahlung.gewst": true });
    const { a } = stand(p, zeitenAm(p, "2026-10-25T08:00:00.000Z"));
    const frei = freiePflichten(a, betrieb, heute);
    expect(frei.size).toBe(3);
    expect(frei.size + weiterePflichten(a, frei)).toBe(a.gilt.filter((x) => x.einordnung === "pflicht").length);
  });
});
