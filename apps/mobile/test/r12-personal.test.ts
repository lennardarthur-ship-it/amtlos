/**
 * R12 Personal: festgeschriebene Nachweise mit Fassungen, Zeitstempel je Arbeitstag, Aufbewahrung, Migration 2 → 3,
 * Mitarbeiter (doppelte Namen, Aufenthaltstitel), Betriebsstätten (Profil, Kassenmeldung), Zoll-Mappe (Personalübersicht,
 * alle NachwG-Fassungen, Aufenthaltstitel, BG-Haken aus „Was hast du schon?“), schnelle Erfassung.
 */
import { describe, expect, it } from "vitest";
import { dokumentHtml, vorlageFuer } from "@amtlos/fachlogik";
import { syncZusammenfuehren } from "../src/konto/sync";
import { naechsterTag, wocheKopieren } from "../src/unterlagen/arbeitszeit";
import { aufenthaltEintraege, bestaetigtOhneUnterlage, bgVorhandenAm, BG_NACHWEISE, deckblattHtml, eintragZusatz, fuerKontrolle, inStaette, kontrollartenFuer, lohnkontoEintraege, mappenAuswahl, personalUebersicht } from "../src/unterlagen/kontrollmappe";
import { LEERER_STAND, MIGRATIONEN, STAND_VERSION, aendern, allesLoeschenErlaubt, anlegen, aufbewahrenBis, aufbewahrungspflichtig, aufenthaltLaeuftAb, ausgeben, dateienImStand, doppeltePerson, felderSetzen, korrigieren, kopieren, loeschen, migrieren, personSetzen, personenZusammenfuehren, staetteLoeschen, staetteSetzen, standAus, tageStempeln, unterlageStaette, unterlagenVereinen, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Hafenblick", strasse: "Kai 3", plz: "20457", ort: "Hamburg", steuernummer: "22/123/45678", verantwortlich: "Ines Hafner", bundesland: "Hamburg" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "taetigkeit.branchen": ["gastronomie_lebensmittel"], "beschaeftigte.gesamt": 3 } };
const tag = (datum: string, beginn = "10:00", ende = "15:00", pause = "0") => ({ datum, beginn, ende, pause });

/** Arbeitszeitnachweis August für Rami, am 01.09. geteilt */
function mitNachweis(): Stand {
  const [s1] = anlegen(BASIS, "arbeitszeitnachweis", t("2026-08-03"), "a1");
  let s = felderSetzen(s1, "a1", { name: "Rami Haddad", tage: [tag("2026-08-03"), tag("2026-08-04")] }, t("2026-08-04"));
  s = felderSetzen(s, "a1", { tage: [tag("2026-08-03"), tag("2026-08-04"), tag("2026-08-29")] }, t("2026-08-29"));
  return ausgeben(s, "a1", t("2026-09-01"));
}

describe("Festschreiben und Fassungen (Zoll #2)", () => {
  it("geteilter Arbeitszeitnachweis ist festgeschrieben: nicht änderbar, nicht löschbar", () => {
    const s = mitNachweis();
    const u = s.unterlagen[0]!;
    expect(u.festgeschrieben).toBe(t("2026-09-01").toISOString());
    expect(felderSetzen(s, "a1", { name: "X" }, t("2026-10-21")).unterlagen[0]!.daten.name).toBe("Rami Haddad");
    expect(aendern(s, "a1", {}, t("2026-10-21")).unterlagen[0]!.daten.name).toBe("Rami Haddad");
    expect(loeschen(s, "a1").unterlagen).toHaveLength(1);
  });
  it("Korrektur nur mit Grund: alte Fassung bleibt, neue trägt Nummer, ersetzte Fassung und Grund", () => {
    const s = mitNachweis();
    expect(korrigieren(s, "a1", "  ", t("2026-10-21"))).toBe(s);
    const k = korrigieren(s, "a1", "Beginn am 12.08. war 12:00", t("2026-10-21"));
    const u = k.unterlagen[0]!;
    expect(u.festgeschrieben).toBeUndefined();
    expect(u.ausgegeben).toBe(t("2026-09-01").toISOString());
    expect(u.fassungen).toHaveLength(1);
    expect(u.fassungen![0]!.festgeschrieben).toBe(t("2026-09-01").toISOString());
    expect(u.daten).toMatchObject({ fassung_nr: "2", fassung_ersetzt: "2026-09-01", fassung_grund: "Beginn am 12.08. war 12:00", fassung_stand: "2026-10-21" });
    // in Arbeit: nicht löschbar, aber änderbar; beim nächsten Teilen wieder festgeschrieben
    expect(loeschen(k, "a1").unterlagen).toHaveLength(1);
    const g = felderSetzen(k, "a1", { tage: [tag("2026-08-03", "12:00"), tag("2026-08-04"), tag("2026-08-29")] }, t("2026-10-21"));
    const f = ausgeben(g, "a1", t("2026-10-22"));
    expect(f.unterlagen[0]!.festgeschrieben).toBe(t("2026-10-22").toISOString());
    expect(f.unterlagen[0]!.fassungen![0]!.daten.tage).toEqual(s.unterlagen[0]!.daten.tage);
    // im PDF: „Fassung 2 vom … – ersetzt die Fassung vom 01.09.2026“
    expect(dokumentHtml(vorlageFuer("arbeitszeitnachweis")!, f.unterlagen[0]!.daten, BETRIEB).replace(/\u00a0/g, " ")).toContain("ersetzt die Fassung vom 01.09.2026");
  });
  it("Synchronisation: die Korrektur schlägt die ältere festgeschriebene Fassung, keine Fassung geht verloren", () => {
    const s = mitNachweis();
    const k = ausgeben(korrigieren(s, "a1", "Tippfehler", t("2026-10-21")), "a1", t("2026-10-22"));
    const v = unterlagenVereinen(s.unterlagen[0]!, k.unterlagen[0]!);
    expect(v.kopie).toBeUndefined();
    expect(v.u.fassungen).toHaveLength(1);
    expect(v.u.daten.fassung_nr).toBe("2");
    const sync = syncZusammenfuehren(s, k).stand;
    expect(sync.unterlagen[0]!.fassungen).toHaveLength(1);
    expect(zusammenfuehren(k, s).stand.unterlagen[0]!.daten.fassung_nr).toBe("2");
  });
  it("Kopie eines Nachweises ist eine neue erste Fassung ohne Zeitstempel", () => {
    const s = korrigieren(mitNachweis(), "a1", "Tippfehler", t("2026-10-21"));
    const [k, u] = kopieren(s, "a1", t("2026-10-21"), "a2");
    expect(u!.daten.fassung_nr).toBeUndefined();
    expect(u!.daten.fassung_grund).toBeUndefined();
    expect((u!.daten.tage as Record<string, unknown>[]).every((x) => !("erfasst_am" in x))).toBe(true);
    expect(k.unterlagen.find((x) => x.id === "a2")!.fassungen).toBeUndefined();
  });
});

describe("Zeitstempel je Arbeitstag (Zoll #3)", () => {
  it("erfasst am beim ersten Inhalt, geändert am bei späterer Änderung", () => {
    const s = mitNachweis();
    const tage = s.unterlagen[0]!.daten.tage as Record<string, string>[];
    expect(tage.map((x) => x.erfasst_am)).toEqual(["2026-08-04", "2026-08-04", "2026-08-29"]);
    expect(tage.some((x) => x.geaendert_am)).toBe(false);
    const neu = tageStempeln({ tage }, { tage: [{ ...tage[0]!, beginn: "11:00" }, tage[1]!, tage[2]!, { datum: "2026-08-30" }] }, "2026-09-02");
    const l = neu.tage as Record<string, string>[];
    expect(l[0]).toMatchObject({ erfasst_am: "2026-08-04", geaendert_am: "2026-09-02" });
    expect(l[1]!.geaendert_am).toBeUndefined();
    // nur Datum, kein Inhalt: noch kein Stempel
    expect(l[3]!.erfasst_am).toBeUndefined();
  });
});

describe("Aufbewahrung (Zoll #10)", () => {
  it("Arbeitszeitnachweise 24 Monate, NachwG und Ausweis-Hinweis während der Beschäftigung", () => {
    let s = mitNachweis();
    expect(aufbewahrenBis(s, s.unterlagen[0]!)).toBe("2028-08-29");
    expect(aufbewahrungspflichtig(s, "2026-10-21").map((x) => x.id)).toEqual(["a1"]);
    expect(aufbewahrungspflichtig(s, "2028-09-01")).toEqual([]);
    expect(allesLoeschenErlaubt(s)).toBe(false);
    s = personSetzen(s, "mitarbeiter", { id: "m1", name: "Rami Haddad", beginn: "2026-08-03" });
    const [s2] = anlegen(s, "ausweis_hinweis", t("2026-08-01"), "h1");
    s = ausgeben(felderSetzen(s2, "h1", { name: "Rami Haddad", datum: "2026-08-01" }, t("2026-08-01")), "h1", t("2026-08-01"));
    expect(aufbewahrenBis(s, s.unterlagen.find((u) => u.id === "h1")!)).toBe("9999-12-31");
    s = personSetzen(s, "mitarbeiter", { id: "m1", name: "Rami Haddad", beginn: "2026-08-03", ende: "2027-03-31" });
    expect(aufbewahrenBis(s, s.unterlagen.find((u) => u.id === "h1")!)).toBe("2029-03-31");
  });
});

describe("Migration 2 → 3", () => {
  it("schon geteilte Nachweise werden festgeschrieben, Betriebsstätten leer; Rechnungsentwürfe bleiben", () => {
    expect(STAND_VERSION).toBe(6);
    const roh = { version: 2, betrieb: BETRIEB, unterlagen: [{ id: "x", vorlage: "arbeitszeitnachweis", daten: { name: "A" }, erstellt: "2026-08-01T08:00:00.000Z", geaendert: "2026-08-02T08:00:00.000Z", ausgegeben: "2026-09-01T08:00:00.000Z" }, { id: "y", vorlage: "unterweisung", daten: {}, erstellt: "2026-08-01T08:00:00.000Z", geaendert: "2026-08-01T08:00:00.000Z", ausgegeben: "2026-08-01T08:00:00.000Z" }] };
    const m = MIGRATIONEN[2]!(roh);
    expect((m.unterlagen as Record<string, unknown>[])[0]!.festgeschrieben).toBe("2026-09-01T08:00:00.000Z");
    expect((m.unterlagen as Record<string, unknown>[])[1]!.festgeschrieben).toBeUndefined();
    expect(m.betriebsstaetten).toEqual([]);
    const s = standAus(JSON.stringify(roh));
    expect(s.version).toBe(6);
    expect(s.unterlagen[0]!.festgeschrieben).toBeTruthy();
    expect(migrieren({ version: 1 }).version).toBe(6);
  });
});

describe("Mitarbeiter (Kurier #13, Zoll #5)", () => {
  it("doppelte Namen erkennen und zusammenführen – leere Angaben werden ergänzt", () => {
    let s = personSetzen(BASIS, "mitarbeiter", { id: "m1", name: "Rami Haddad", beginn: "2026-08-03" });
    s = personSetzen(s, "mitarbeiter", { id: "m2", name: " rami  haddad ", stundenlohn: "13,90", beginn: "2026-01-01" });
    expect(doppeltePerson(s, "mitarbeiter", "m2")!.id).toBe("m1");
    const z = personenZusammenfuehren(s, "mitarbeiter", "m1", "m2");
    expect(z.mitarbeiter).toHaveLength(1);
    expect(z.mitarbeiter[0]).toMatchObject({ id: "m1", beginn: "2026-08-03", stundenlohn: "13,90" });
    expect(z.geloescht["m:m2"]).toBeTruthy();
  });
  it("Kopie des Aufenthaltstitels gehört zu den Dateien (Sicherung, Synchronisation); Ablauf auf „Heute“", () => {
    const s = personSetzen(BASIS, "mitarbeiter", { id: "m1", name: "Rami", aufenthalt_datei: "abc.jpg", aufenthalt_bis: "2026-11-30" });
    expect(dateienImStand(s)).toEqual(["abc.jpg"]);
    expect(aufenthaltLaeuftAb(s, "2026-10-21")).toEqual([{ id: "m1", name: "Rami", bis: "2026-11-30", tage: 40 }]);
    expect(aufenthaltLaeuftAb(s, "2026-08-01")).toEqual([]);
    expect(aufenthaltLaeuftAb(personSetzen(s, "mitarbeiter", { ...s.mitarbeiter[0]!, ende: "2026-09-30" }), "2026-10-21")).toEqual([]);
  });
});

describe("Betriebsstätten (Bäckerei #3, #7)", () => {
  it("Anzahl im Profil des Pflichten-Checks; Kassenmeldung mit einem Blatt je Betriebsstätte", () => {
    let s = staetteSetzen(BASIS, { id: "f1", name: "Filiale Markt", strasse: "Markt 1", plz: "20095", ort: "Hamburg" });
    expect(s.profil["betriebsstaetten.anzahl"]).toBe(2);
    const [s2, km] = anlegen(s, "kassenmeldung", t("2026-10-21"), "km");
    expect(km.daten.betriebsstaetten).toEqual([{ name: "Filiale Markt", anschrift: "Markt 1\n20095 Hamburg" }]);
    const kasse = (sn: string, st = "") => ({ art: "elektronisch", hersteller: "K", modell: "M", seriennummer: sn, anschaffung: "2026-01-01", tse_art: "Cloud-TSE", tse_seriennummer: sn, betriebsstaette: st });
    s = felderSetzen(s2, "km", { kassen: [kasse("1"), kasse("2", "Filiale Markt")] }, t("2026-10-21"));
    const h = dokumentHtml(vorlageFuer("kassenmeldung")!, s.unterlagen.find((u) => u.id === "km")!.daten, BETRIEB);
    expect(h).toContain("Betriebsstätte 2 von 2");
    expect(h).toContain("Filiale Markt, Markt 1, 20095 Hamburg");
    s = personSetzen(s, "mitarbeiter", { id: "m1", name: "Leon", betriebsstaette: "f1" });
    s = staetteLoeschen(s, "f1");
    expect(s.profil["betriebsstaetten.anzahl"]).toBe(1);
    expect(s.mitarbeiter[0]!.betriebsstaette).toBeNull();
    expect(s.geloescht["s:f1"]).toBeTruthy();
  });
  it("Kontrollmappe filtert nach Betriebsstätte – über die Person bzw. die Zuordnung der Unterlage", () => {
    let s = staetteSetzen(mitNachweis(), { id: "f1", name: "Filiale", strasse: "", plz: "", ort: "" });
    s = personSetzen(s, "mitarbeiter", { id: "m1", name: "Rami Haddad", betriebsstaette: "f1" });
    const e = mappenAuswahl(s, "2026-10-21").eintraege.find((x) => x.id === "a1")!;
    expect(e.staette).toBe("f1");
    expect(inStaette(e, "f1", s)).toBe(true);
    expect(inStaette(e, "haupt", s)).toBe(false);
    s = unterlageStaette(s, "a1", "haupt");
    expect(s.unterlagen[0]!.festgeschrieben).toBeTruthy();
    expect(inStaette(mappenAuswahl(s, "2026-10-21").eintraege.find((x) => x.id === "a1")!, "haupt", s)).toBe(true);
  });
});

describe("Zoll-Mappe (Zoll #5, #7, #8, #9, #12, UX #6)", () => {
  function zoll(): Stand {
    let s = mitNachweis();
    s = personSetzen(s, "mitarbeiter", { id: "m1", name: "Rami Haddad", geburtsdatum: "1999-02-01", beginn: "2026-08-03", art: "minijob", wochenstunden: "10", entgelt_art: "stunde", stundenlohn: "13,90", staatsangehoerigkeit: "syrisch", aufenthalt_bis: "2027-05-31", aufenthalt_datei: "titel.jpg" });
    s = { ...s, erledigt: { ...s.erledigt, "personal.sofortmeldung": "2026-08-03|2026-08-03" } };
    // NachwG: erste Fassung zum Beginn, nach Lohnerhöhung korrigiert
    const [s2] = anlegen(s, "nachweis_arbeitsbedingungen", t("2026-08-01"), "n1");
    s = ausgeben(felderSetzen(s2, "n1", { name: "Rami Haddad", beginn: "2026-08-03", ausgestellt_am: "2026-08-01" }, t("2026-08-01")), "n1", t("2026-08-01"));
    s = korrigieren(s, "n1", "Lohnerhöhung", t("2026-10-01"));
    s = ausgeben(felderSetzen(s, "n1", { ausgestellt_am: "2026-10-01" }, t("2026-10-01")), "n1", t("2026-10-01"));
    return s;
  }
  it("Aufzeichnung bis … · geteilt am …; Entwürfe „nicht abgeschlossen“", () => {
    const e = mappenAuswahl(zoll(), "2026-10-21").eintraege.find((x) => x.id === "a1")!;
    expect(e.titel).toBe("Arbeitszeitnachweis August 2026 · Rami Haddad");
    expect(eintragZusatz(e)).toBe("Aufzeichnung bis 29.08.2026 · geteilt am 01.09.2026");
    const [s] = anlegen(BASIS, "arbeitszeitnachweis", t("2026-10-05"), "a2");
    const entwurf = mappenAuswahl(felderSetzen(s, "a2", { name: "Leon", tage: [tag("2026-10-05")] }, t("2026-10-05")), "2026-10-21").eintraege[0]!;
    expect(eintragZusatz(entwurf)).toBe("Aufzeichnung bis 05.10.2026 · nicht abgeschlossen");
  });
  it("alle NachwG-Fassungen mit „gültig ab“", () => {
    const n = mappenAuswahl(zoll(), "2026-10-21").eintraege.filter((x) => x.vorlage === "nachweis_arbeitsbedingungen");
    expect(n.map((x) => x.gueltigAb)).toEqual(["2026-08-03", "2026-10-01"]);
    expect(n[0]!.daten?.ausgestellt_am).toBe("2026-08-01");
    expect(n[1]!.titel).toMatch(/gültig ab 01\.10\.2026$/);
  });
  it("Korrektur in Arbeit: in die Mappe kommt die geltende Fassung", () => {
    const s = korrigieren(mitNachweis(), "a1", "Tippfehler", t("2026-10-21"));
    const e = mappenAuswahl(s, "2026-10-21").eintraege.find((x) => x.id === "a1")!;
    expect(e.korrekturLaeuft).toBe(true);
    expect(e.daten?.fassung_nr).toBeUndefined();
    expect(e.geteiltAm).toBe("2026-09-01");
  });
  it("Personalübersicht mit Sofortmeldung aus dem Haken und Aufenthaltstitel; Kopie als Eintrag", () => {
    const s = zoll();
    expect(personalUebersicht(s, "2026-10-21")).toEqual([{ name: "Rami Haddad", geburtsdatum: "01.02.1999", beginn: "03.08.2026", art: "Minijob", wochenstunden: "10", entgelt: "13,90 € je Stunde", sofortmeldung: "03.08.2026", aufenthaltBis: "31.05.2027" }]);
    const a = aufenthaltEintraege(s, "2026-10-21");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ vorlage: "aufenthaltstitel", datei: { name: "titel.jpg" } });
    expect(fuerKontrolle("aufenthaltstitel", "zoll")).toBe(true);
    expect(fuerKontrolle("aufenthaltstitel", "hygiene")).toBe(false);
    const html = deckblattHtml("Café Hafenblick", "2026-10-21", [], "Zoll (Mindestlohn)", [], { personal: personalUebersicht(s, "2026-10-21"), dienstplan: { namen: ["Rami Haddad"], text: "10–15 Uhr" }, hinweis: "Mappe ausgedruckt im Betrieb bereithalten." });
    expect(html).toContain("Personalübersicht (1 Person)");
    expect(html).toContain("Dienstplan heute (21.10.2026)");
    expect(html).toContain("Sofortmeldung bestätigt am");
  });
  it("Lohnkonto nur in der Zoll-Mappe und nur auf Verlangen (eigene Liste)", () => {
    const [s1] = anlegen(BASIS, "lohnkonto", t("2026-10-01"), "l1");
    const s = felderSetzen(s1, "l1", { name: "Rami Haddad", jahr: "2026" }, t("2026-10-01"));
    expect(lohnkontoEintraege(s, "2026-10-21").map((x) => x.id)).toEqual(["l1"]);
    expect(mappenAuswahl(s, "2026-10-21").eintraege.some((x) => x.vorlage === "lohnkonto")).toBe(false);
    expect(fuerKontrolle("lohnkonto", "zoll")).toBe(true);
    expect(fuerKontrolle("lohnkonto", "alle")).toBe(false);
  });
  it("Haken aus „Was hast du schon?“ gelten als vorhanden; abgehakt ohne Unterlage aufs Deckblatt", () => {
    const erledigt = { "arbeitsschutz.erste_hilfe": "2026-06-01", "arbeitsschutz.hautschutz": "2026-06-02" };
    expect(bgVorhandenAm(erledigt, BG_NACHWEISE.find((n) => n.id === "ersthelfer")!)).toBe("2026-06-01");
    const b = bestaetigtOhneUnterlage([{ id: "arbeitsschutz.hautschutz", titel: "Hautschutzplan", vorlagen: ["hautschutzplan"] }], erledigt, [], "bg");
    expect(b).toEqual([{ titel: "Hautschutzplan", am: "2026-06-02" }]);
    expect(deckblattHtml("X", "2026-10-21", [], "BG", b)).toContain("Hautschutzplan – vorhanden (bestätigt am 02.06.2026)");
  });
  it("Kontrollarten nach Profil: kein Hygiene-Filter für einen Kurierdienst", () => {
    const k = kontrollartenFuer({ profil: { "taetigkeit.branchen": ["transport_logistik"], "beschaeftigte.gesamt": 9 }, mitarbeiter: [] }, new Set());
    expect(k).not.toContain("hygiene");
    expect(k).toContain("zoll");
    expect(kontrollartenFuer({ profil: { "taetigkeit.branchen": ["handwerk"] }, mitarbeiter: [] }, new Set())).toContain("umwelt");
  });
});

describe("Schnell erfassen (Kurier #11)", () => {
  it("nächster Tag mit gleichen Zeiten, Sonntag übersprungen, Monat begrenzt", () => {
    expect(naechsterTag([{ ...tag("2026-10-02", "06:00", "14:00", "30"), einsatzort: "Tour 4", erfasst_am: "2026-10-02" }])).toEqual({ datum: "2026-10-03", beginn: "06:00", ende: "14:00", pause: "30", einsatzort: "Tour 4", bemerkung: "" });
    expect(naechsterTag([tag("2026-10-03")])!.datum).toBe("2026-10-05");
    expect(naechsterTag([tag("2026-10-31")], "Oktober 2026")).toBeNull();
    expect(naechsterTag([{ datum: "2026-10-01" }])).toBeNull();
  });
  it("Woche kopieren: nur neue Tage im Monat", () => {
    const w = wocheKopieren([tag("2026-10-19"), tag("2026-10-20"), { datum: "2026-10-21", bemerkung: "Urlaub" }, tag("2026-10-23")], "Oktober 2026");
    expect(w.map((x) => x.datum)).toEqual(["2026-10-26", "2026-10-27", "2026-10-30"]);
    expect(wocheKopieren([tag("2026-10-26"), tag("2026-10-27")], "Oktober 2026")).toEqual([]);
  });
});
