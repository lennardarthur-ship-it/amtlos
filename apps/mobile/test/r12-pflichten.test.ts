/**
 * Runde 12: Befunde aus Rechtsprüfung, Zoll-Prüfung, UX-Review und den Nutzertests (Coach, Kfz-Werkstatt, Bäckerei, Kurier)
 * zum Pflichten-Check – Gründungsschritte bei Bestandsbetrieben, Rentenversicherung im Kern-Check, Nachweise je Person
 * (§ 17 MiLoG, Ausweis-Hinweis), Fragen und Optionen passend zum Betrieb, abgeleitete Antworten, künftige Pflichten.
 */
import { describe, expect, it } from "vitest";
import { LEERER_STAND } from "../src/unterlagen/speicher";
import {
  CHECK_FELDER,
  aufzeichnungsStand,
  auswertung,
  ausweisStand,
  checkFragen,
  checkFragenAnzahl,
  dringlichkeit,
  erledigtDurch,
  inZukunft,
  istErledigt,
  profilMitStand,
  type Profil,
} from "../src/pflichten/check";

const finde = (a: ReturnType<typeof auswertung>, id: string) => [...a.gilt, ...a.gruendung, ...a.beiEinstellung, ...a.unbekannt].find((p) => p.id === id);
const ids = (l: { id: string }[]) => l.map((p) => p.id);
const felder = (p: Profil) => checkFragen(p).map((f) => f.feld);
const leer = { erledigt: {}, unterlagen: [], betrieb: LEERER_STAND.betrieb };

describe("R12: Coach – Bestandsbetrieb, Rentenversicherung, Einordnung", () => {
  const coach: Profil = { "taetigkeit.branchen": ["unterricht_sport_coaching"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "unklar", bundesland: "BW", "beschaeftigte.gesamt": 0, gruendungsdatum: "2023-03-01" };

  it("fragt im Kern-Check nach der Rentenversicherung – bei Einzelpersonen ohne versicherungspflichtige Beschäftigte", () => {
    expect(felder(coach)).toContain("rentenversicherung.pflichtgruppe");
    expect(felder({ ...coach, "beschaeftigte.gesamt": 3, "beschaeftigte.minijob": 3 })).toContain("rentenversicherung.pflichtgruppe");
    expect(felder({ ...coach, "beschaeftigte.gesamt": 3, "beschaeftigte.minijob": 1 })).not.toContain("rentenversicherung.pflichtgruppe");
    expect(felder({ ...coach, rechtsform: "gmbh" })).not.toContain("rentenversicherung.pflichtgruppe");
  });

  it("die Rentenversicherungspflicht steht bei „jetzt dran“, nicht „aus der Gründung“ – auch Jahre nach dem Start", () => {
    const a = auswertung({ ...coach, "rentenversicherung.pflichtgruppe": ["lehrende"] }, "2026-10-21");
    expect(ids(a.gilt)).toContain("gruendung.rentenversicherungspflicht");
    expect(ids(a.gruendung)).not.toContain("gruendung.rentenversicherungspflicht");
    expect(ids(dringlichkeit(a, leer, "2026-10-21").jetzt)).toContain("gruendung.rentenversicherungspflicht");
  });

  it("ohne Antwort zur Rentenversicherung bleibt sie unter „hängt ab“ (vorher verschwand sie bei Bestandsbetrieben)", () => {
    const a = auswertung(coach, "2026-10-21");
    expect(ids(a.unbekannt)).toContain("gruendung.rentenversicherungspflicht");
    // unklare Gründungsschritte mit passender Frage bleiben sichtbar, der Gründungszuschuss (nur vor dem Start) nicht
    expect(ids(a.unbekannt)).toContain("gruendung.gewerbeanzeige");
    expect(ids(a.unbekannt)).not.toContain("gruendung.gruendungszuschuss");
  });

  it("„Weiß ich nicht“ bei Gewerbe oder freiem Beruf ist „jetzt dran“, nicht „vermutlich erledigt“", () => {
    const a = auswertung(coach, "2026-10-21");
    expect(ids(a.gruendung)).not.toContain("gruendung.taetigkeit_einordnen");
    expect(ids(dringlichkeit(a, leer, "2026-10-21").jetzt)).toContain("gruendung.taetigkeit_einordnen");
  });

  it("bei 0 Beschäftigten hängen Jugendarbeitsschutz, Minijob-Grenze und Ausbildungsvergütung nicht mehr ab; Einzelperson ohne Investoren", () => {
    const a = auswertung(coach, "2026-10-21");
    for (const id of ["personal.jugendarbeitsschutz", "personal.minijob_grenze", "personal.ausbildungsverguetung", "gesellschaft.investitionspruefung_hinweis"]) expect(ids(a.unbekannt), id).not.toContain(id);
    // Freigabe Weber 22.10.2026: AWV-Meldung hängt bei Einzelpersonen nur noch an der Frage nach Auslandszahlungen über 50.000 €, nicht an Investoren
    expect(a.unbekannt.find((p) => p.id === "gesellschaft.awv_meldung")?.offeneFragen).toEqual(["auslandszahlungen.ueber_meldegrenze"]);
  });

  it("die neue Branche fragt nach Aufträgen per Messenger, Musik im Kurs und Gesundheitsdaten", () => {
    expect(felder(coach)).toEqual(expect.arrayContaining(["vertrieb.fernabsatz", "oeffentliche_wiedergabe", "datenverarbeitung.arten"]));
    const a = auswertung({ ...coach, "vertrieb.fernabsatz": true, "oeffentliche_wiedergabe": true }, "2026-10-21");
    expect(ids(a.gilt)).toEqual(expect.arrayContaining(["branche.widerruf_fernabsatz", "branche.oeffentliche_wiedergabe"]));
  });
});

describe("R12: Reihenfolge und Zuschnitt der Fragen", () => {
  it("Startdatum direkt nach der Rechtsform, Azubis direkt nach „unter 18“, Rhythmus nach der Kleinunternehmerregelung", () => {
    expect(CHECK_FELDER.indexOf("gruendungsdatum")).toBe(CHECK_FELDER.indexOf("gesellschaft.handelsregister") + 1);
    const werk = felder({ "taetigkeit.branchen": ["handwerk"], rechtsform: "gmbh", "beschaeftigte.gesamt": 6, "ust.kleinunternehmer": false });
    expect(werk.indexOf("beschaeftigte.azubi")).toBe(werk.indexOf("beschaeftigte.jugendlich") + 1);
    expect(werk.indexOf("ust.voranmeldung_rhythmus")).toBe(werk.indexOf("ust.kleinunternehmer") + 1);
    expect(felder({ "ust.kleinunternehmer": true })).not.toContain("ust.voranmeldung_rhythmus");
  });

  it("Gewerbeordnung: das Café sieht nur passende Optionen, die IT-Agentur die Frage gar nicht", () => {
    const cafe = checkFragen({ "taetigkeit.branchen": ["gastronomie_lebensmittel"] }).find((f) => f.feld === "erlaubnis.gewo_paragraphen")!;
    expect(Object.keys(cafe.optionen!).sort()).toEqual(["33c", "33d", "55", "keine"]);
    expect(felder({ "taetigkeit.branchen": ["it_agentur_freelancer"] })).not.toContain("erlaubnis.gewo_paragraphen");
    // schon gewählte Optionen bleiben sichtbar
    const mitWahl = checkFragen({ "taetigkeit.branchen": ["gastronomie_lebensmittel"], "erlaubnis.gewo_paragraphen": ["34c"] }).find((f) => f.feld === "erlaubnis.gewo_paragraphen")!;
    expect(Object.keys(mitWahl.optionen!)).toContain("34c");
  });

  it("ohne Bargeld keine Kassenfrage und keine Kassenmeldung („keine Kasse, nur Rechnungen“)", () => {
    const kurier: Profil = { "taetigkeit.branchen": ["transport_logistik"], rechtsform: "einzelunternehmen", "kasse.bargeld": false, gruendungsdatum: "2021-06-01", bundesland: "BE" };
    expect(felder(kurier)).not.toContain("kasse.elektronisch");
    expect(finde(auswertung(kurier, "2026-10-21"), "steuern.kassenmeldung")).toBeUndefined();
  });

  it("Fahrzeuge: Gesamtmasse nur mit Fahrzeugen, Ausland nur bei 2,5 bis 3,5 t", () => {
    const k: Profil = { "taetigkeit.branchen": ["transport_logistik"], "fahrzeuge.anzahl": 6 };
    expect(felder(k)).toContain("fahrzeuge.gesamtmasse");
    expect(felder({ ...k, "fahrzeuge.gesamtmasse": ["ueber_3_5t"] })).not.toContain("fahrzeuge.ausland");
    expect(felder({ ...k, "fahrzeuge.gesamtmasse": ["2_8_bis_3_5t"] })).toContain("fahrzeuge.ausland");
    expect(felder({ ...k, "fahrzeuge.anzahl": 0 })).not.toContain("fahrzeuge.gesamtmasse");
  });

  it("die Höchstzahl für den Fortschritt folgt dem Profil", () => {
    expect(checkFragenAnzahl({})).toBeLessThan(CHECK_FELDER.length);
    expect(checkFragenAnzahl({ "taetigkeit.branchen": ["transport_logistik"], "beschaeftigte.gesamt": 9 })).toBeGreaterThan(checkFragenAnzahl({}));
  });
});

describe("R12: abgeleitete Antworten und künftige Pflichten", () => {
  it("kleines Unternehmen ⇒ NIS2 nein (außer IT-Dienste); ohne Umsatz bleibt die Frage", () => {
    expect(profilMitStand({ "beschaeftigte.gesamt": 9, "umsatz.vorjahr": 600000, "taetigkeit.branchen": ["transport_logistik"] }, "2026-10-21")["nis2.betroffen"]).toBe("nein");
    expect(profilMitStand({ "beschaeftigte.gesamt": 9, "taetigkeit.branchen": ["transport_logistik"] }, "2026-10-21")["nis2.betroffen"]).toBeUndefined();
    expect(profilMitStand({ "beschaeftigte.gesamt": 9, "umsatz.vorjahr": 600000, "taetigkeit.branchen": ["it_agentur_freelancer"] }, "2026-10-21")["nis2.betroffen"]).toBeUndefined();
    expect(profilMitStand({ "beschaeftigte.gesamt": 9, "umsatz.vorjahr": 600000, "nis2.betroffen": "ja" }, "2026-10-21")["nis2.betroffen"]).toBe("ja");
  });

  it("E-Rechnungen versenden ab 2028 gilt erst in der Zukunft – nicht als „schon erledigt“ abhakbar", () => {
    // StB Busch 22.10.2026: in Kraft, gültig ab 01.01.2028 – vorher nicht unter „gilt“, in den zwölf Monaten davor als „kommend“
    const profil = { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", "kunden.segmente": ["b2b"], "ust.kleinunternehmer": false, gruendungsdatum: "2018-01-01" };
    const a = auswertung(profil, "2026-10-21");
    expect(finde(a, "steuern.e_rechnung_versand_2028")).toBeUndefined();
    const spaeter = auswertung(profil, "2027-03-01");
    const p = spaeter.kommend.find((x) => x.id === "steuern.e_rechnung_versand_2028")!;
    expect(p.giltAb).toBe("2028-01-01");
    expect(inZukunft(p, "2027-03-01")).toBe(true);
    expect(inZukunft(finde(a, "steuern.aufbewahrung") ?? { giltAb: null }, "2026-10-21")).toBe(false);
  });

  it("Rhythmus „weiß ich nicht“ ohne Vorjahressteuer ⇒ vorläufig vierteljährliche Termine", () => {
    const a = auswertung({ "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "unklar", gruendungsdatum: "2025-03-01" }, "2026-10-21");
    expect(finde(a, "steuern.ust_voranmeldung")!.termine).toContain("2027-01-11");
  });

  it("die Folgebelehrung nach § 43 IfSG füllt man mit der Vorlage der Belehrung aus", () => {
    const a = auswertung({ "taetigkeit.branchen": ["gastronomie_lebensmittel"], "beschaeftigte.gesamt": 3, "ifsg.beschaeftigte": "bescheinigung", gruendungsdatum: "2020-01-01" }, "2026-10-21");
    expect(finde(a, "branche.gastro_ifsg_folgebelehrung")?.vorlage).toBe("ifsg_belehrung");
  });
});

describe("R12: Zoll – Nachweise je Person", () => {
  const cafe: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "beschaeftigte.gesamt": 3, "beschaeftigte.minijob": 1, "personal.sofortmeldebranchen": ["gastronomie"], gruendungsdatum: "2024-01-01" };
  const team = [
    { name: "Sabine Krüger", beginn: "2024-01-01", art: "vollzeit" },
    { name: "Leon Wolf", beginn: "2025-03-01", art: "teilzeit" },
    { name: "Rami Haddad", beginn: "2026-08-03", art: "minijob" },
  ];
  const nachweis = (name: string, tage: { datum: string; beginn?: string; ende?: string; bemerkung?: string }[], ausgegeben?: string) => ({ vorlage: "arbeitszeitnachweis", daten: { name, tage }, ...(ausgegeben ? { ausgegeben } : {}) });

  it("ein Nachweis für eine Person erledigt § 17 MiLoG nicht für alle – „Für … fehlt die Aufzeichnung seit …“", () => {
    const a = auswertung(cafe, "2026-10-21", [], team);
    const p = finde(a, "personal.arbeitszeit_milog")!;
    expect(p.beschaeftigte!.map((b) => b.name)).toEqual(["Sabine Krüger", "Leon Wolf", "Rami Haddad"]);
    const e = { ...leer, heute: "2026-10-21", unterlagen: [nachweis("Rami Haddad", [{ datum: "2026-10-20", beginn: "10:00", ende: "14:00" }], "2026-10-21T08:00:00Z"), nachweis("Sabine Krüger", [{ datum: "2026-09-29", beginn: "08:00", ende: "16:00" }])] };
    const st = aufzeichnungsStand(p, e);
    expect(st.fehlend).toEqual([
      { name: "Sabine Krüger", seit: "2026-09-30" },
      { name: "Leon Wolf", seit: null },
    ]);
    expect(istErledigt(p, e)).toBe(false);
  });

  it("erledigt, sobald jede Person einen erfassten Tag der letzten sieben Tage oder des Monats hat; leere Tage zählen nicht", () => {
    const p = finde(auswertung(cafe, "2026-10-21", [], team), "personal.arbeitszeit_milog")!;
    const e = {
      ...leer,
      heute: "2026-10-21",
      unterlagen: [
        nachweis("Rami Haddad", [{ datum: "2026-10-20", beginn: "10:00", ende: "14:00" }]),
        nachweis("Sabine Krüger", [{ datum: "2026-10-02", beginn: "08:00", ende: "16:00" }]),
        nachweis("Leon Wolf", [{ datum: "2026-10-16", bemerkung: "Urlaub" }, { datum: "2026-10-21" }]),
      ],
    };
    expect(aufzeichnungsStand(p, e).fehlend).toEqual([]);
    expect(erledigtDurch(p, e)).not.toBeNull();
    const ohneLeon = { ...e, unterlagen: e.unterlagen.slice(0, 2).concat([nachweis("Leon Wolf", [{ datum: "2026-10-21" }])]) };
    expect(aufzeichnungsStand(p, ohneLeon).fehlend.map((x) => x.name)).toEqual(["Leon Wolf"]);
  });

  it("ohne § 2a-Branche nur die Minijobber; ohne Mitarbeiterliste zählt die Zahl aus dem Check", () => {
    const laden: Profil = { ...cafe, "taetigkeit.branchen": ["sonstige"], "personal.sofortmeldebranchen": ["keine"] };
    expect(finde(auswertung(laden, "2026-10-21", [], team), "personal.arbeitszeit_milog")!.beschaeftigte!.map((b) => b.name)).toEqual(["Rami Haddad"]);
    const p = finde(auswertung(cafe, "2026-10-21"), "personal.arbeitszeit_milog")!;
    expect(p.beschaeftigte).toBeNull();
    const st = aufzeichnungsStand(p, { ...leer, heute: "2026-10-21", unterlagen: [nachweis("Rami Haddad", [{ datum: "2026-10-20", beginn: "10:00", ende: "14:00" }])] });
    expect(st).toMatchObject({ abgedeckt: 1, erforderlich: 3, erledigtDurch: null });
  });

  it("Ausweis-Hinweis: je Person, bei Neueinstellung spätestens am ersten Arbeitstag", () => {
    const p = finde(auswertung(cafe, "2026-10-21", [], team), "personal.ausweis_hinweis")!;
    const hinweis = (name: string, datum: string) => ({ vorlage: "ausweis_hinweis", daten: { name, datum, beginn: "" }, ausgegeben: `${datum}T09:00:00Z` });
    // vollständig heißt: mit Namen des Betriebs (Mein Betrieb)
    const e = { ...leer, betrieb: { ...leer.betrieb, name: "Café Hafenblick" }, heute: "2026-10-21", unterlagen: [hinweis("Sabine Krüger", "2026-01-05"), hinweis("Leon Wolf", "2026-01-05"), hinweis("Rami Haddad", "2026-08-10")] };
    expect(ausweisStand(p, e).fehlend).toEqual([{ name: "Rami Haddad", grund: "nach_beginn" }]);
    expect(ausweisStand(p, { ...e, unterlagen: [...e.unterlagen.slice(0, 2), hinweis("Rami Haddad", "2026-08-03")] }).fehlend).toEqual([]);
  });
});
