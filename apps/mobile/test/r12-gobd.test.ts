/**
 * R12 GoBD (Betriebsprüfung, Steuerberatung) in der App: feste Belegnummern (Migration 3 → 4), Festschreibung der
 * Belege nach Paket bzw. Voranmeldung, Löschen nur 24 h und vor der Weitergabe, Protokoll; Absender und XRechnung mit
 * der Rechnung festgehalten; Kasse (Eigenbelege, Grund, Kassenbuch nur lesbar und festgeschrieben, Kassensturz,
 * Kassennachschau); Sachentnahmen; Kassendifferenzen; offenes Archiv; Synchronisation.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { KU_HINWEIS, eRechnungAus, xrechnungUbl, type Beleg, type KassenInhalt } from "@amtlos/fachlogik";
import { syncZusammenfuehren } from "../src/konto/sync";
import { offenesArchiv } from "../src/unterlagen/archiv";
import { kasseFuerUst, kasseSichtbar, offeneLadenkasse } from "../src/unterlagen/kasse";
import { kassenMappe } from "../src/unterlagen/kontrollmappe";
import {
  LEERER_STAND,
  absenderFuer,
  anlegen,
  ausgeben,
  aufbewahrenBis,
  belegEndgueltigLoeschbar,
  belegLoeschen,
  belegSetzen,
  belegeFestschreiben,
  betriebSetzen,
  felderSetzen,
  kasseKorrigieren,
  kasseSpeichern,
  kassenbuchFest,
  kassenbuchFestschreiben,
  kassensturzSpeichern,
  migrieren,
  sachentnahmeLoeschen,
  sachentnahmeSpeichern,
  standAus,
  vaAbgegebenFuer,
  zeitraumAusText,
  zusammenfuehren,
  type Stand,
} from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { MARKE } from "@amtlos/marke";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000", verantwortlich: "Jana Weber" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "kasse.elektronisch": true, "ust.kleinunternehmer": false } };
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const tag = (datum: string, o: Partial<KassenInhalt> = {}): KassenInhalt => ({ datum, zbon: null, umsatz: [{ satz: 19, brutto_cent: 11900 }, { satz: 7, brutto_cent: 10700 }], karte_cent: 10000, sonstige_cent: 0, bewegungen: [], ...o });
const beleg = (id: string, datum: string, o: Partial<Beleg> = {}): Beleg => ({ id, datum, lieferant: "Großmarkt", nummer: null, kategorie: "waren", steuer: [{ satz: 7, brutto_cent: 1070 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: `${datum}T08:00:00.000Z`, geaendert: `${datum}T08:00:00.000Z`, ...o });
const datei = (zip: Uint8Array, name: string) => strFromU8(unzipSync(zip)[name]!).replace(/^\uFEFF/, "");

function rechnung(s: Stand, id: string, datum: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "100,00", satz: "19" }] }, t(datum));
  return ausgeben(s2, id, t(datum));
}

describe("Belege: feste Nummern, Festschreibung, Löschen, Protokoll", () => {
  it("Migration 3 → 4 speichert die bisher berechneten Nummern fest (auch ungültige); neue Belege bekommen die nächste", () => {
    const roh = { version: 3, betrieb: BETRIEB, belege: [beleg("b2", "2026-02-01", { erstellt: "2026-02-01T08:00:00Z" }), beleg("b1", "2026-01-05", { erstellt: "2026-01-05T08:00:00Z" })], belegArchiv: [{ ...beleg("b0", "2026-01-02", { erstellt: "2026-01-02T08:00:00Z" }), ungueltig: "2026-01-03T08:00:00Z", ungueltig_grund: "doppelt" }] };
    const m = migrieren(roh) as { belege: Beleg[]; belegArchiv: Beleg[]; version: number };
    expect(m.version).toBe(8);
    expect(m.belegArchiv[0]!.nr).toBe("B2026-001");
    expect(m.belege.map((b) => b.nr)).toEqual(["B2026-003", "B2026-002"]);
    const s = standAus(JSON.stringify(roh));
    const s2 = belegSetzen(s, beleg("b3", "2026-03-01"), t("2026-03-01"));
    expect(s2.belege.find((b) => b.id === "b3")!.nr).toBe("B2026-004");
    // Datum ändern verschiebt die Nummer nicht
    expect(belegSetzen(s2, { ...s2.belege.find((b) => b.id === "b3")!, datum: "2025-12-30" }, t("2026-03-01", 10)).belege.find((b) => b.id === "b3")!.nr).toBe("B2026-004");
  });
  it("Löschen nur innerhalb von 24 Stunden und vor der Weitergabe – protokolliert, die Nummer wird nicht wieder vergeben", () => {
    let s = belegSetzen(BASIS, beleg("b1", "2026-05-02", { erstellt: "2026-05-02T08:00:00.000Z" }), t("2026-05-02", 8));
    expect(belegEndgueltigLoeschbar(s.belege[0]!, t("2026-05-02", 12))).toBe(true);
    const fest = belegeFestschreiben(s, ["b1"], t("2026-05-02", 10));
    expect(belegEndgueltigLoeschbar(fest.belege[0]!, t("2026-05-02", 12))).toBe(false);
    s = belegLoeschen(s, "b1", t("2026-05-02", 12));
    expect(s.belege).toHaveLength(0);
    expect(s.protokoll).toMatchObject([{ art: "beleg_geloescht", bezug: "b1", nr: "B2026-001" }]);
    s = belegSetzen(s, beleg("b2", "2026-05-03"), t("2026-05-03"));
    expect(s.belege[0]!.nr).toBe("B2026-002");
    // nach der Festschreibung: ungültig mit eigenem Grund, auch protokolliert
    const u = belegLoeschen(belegeFestschreiben(s, ["b2"], t("2026-05-03", 10)), "b2", t("2026-05-03", 11), "Lieferant hat storniert");
    expect(u.belegArchiv[0]).toMatchObject({ ungueltig_grund: "Lieferant hat storniert", nr: "B2026-002" });
    expect(u.protokoll.at(-1)).toMatchObject({ art: "beleg_ungueltig" });
  });
  it("festgeschriebener Beleg ändert sich nur mit Grund; die Fassung kommt mit Grund ins Änderungsprotokoll des Pakets", () => {
    let s = belegSetzen(BASIS, beleg("b1", "2026-05-02"), t("2026-05-02"));
    const p = steuerpaket(s, { von: "2026-05-01", bis: "2026-05-31", name: "2026-05" }, SB, {}, "2026-06-02T08:00:00.000Z");
    expect(p.belege).toBe(1);
    s = belegeFestschreiben(s, ["b1"], t("2026-06-02"));
    const neu = { ...s.belege[0]!, steuer: [{ satz: 19, brutto_cent: 1190 }] };
    expect(belegSetzen(s, neu, t("2026-06-03"))).toBe(s);
    expect(belegSetzen(s, neu, t("2026-06-03"), "kurz")).toBe(s);
    s = belegSetzen(s, neu, t("2026-06-03"), "Steuersatz falsch erfasst");
    expect(s.belege[0]!.steuer[0]!.satz).toBe(19);
    expect(s.belege[0]!.festgeschrieben).toBe(t("2026-06-02").toISOString());
    expect(s.belege[0]!.historie).toMatchObject([{ grund: "Steuersatz falsch erfasst", steuer: [{ satz: 7 }] }]);
    const q = steuerpaket(belegLoeschen(belegSetzen(s, beleg("b9", "2026-05-09"), t("2026-05-09")), "b9", t("2026-05-09", 10)), { von: "2026-05-01", bis: "2026-05-31", name: "2026-05" }, SB, {}, "2026-06-04T08:00:00.000Z");
    const prot = datei(q.zip, "Aenderungsprotokoll_2026-05.csv");
    expect(prot).toContain("Steuersatz falsch erfasst");
    expect(prot).toContain("endgültig gelöscht");
    expect(datei(q.zip, "LIESMICH.txt")).toContain(`Lücken in den ${MARKE.name}-Belegnummern`);
  });
  it("abgegebene (geteilte) Voranmeldung schreibt die Belege ihres Zeitraums fest", () => {
    expect(zeitraumAusText("2. Quartal 2026")).toMatchObject({ von: "2026-04-01", bis: "2026-06-30" });
    expect(zeitraumAusText("Oktober 2026")).toMatchObject({ von: "2026-10-01", bis: "2026-10-31" });
    expect(zeitraumAusText("irgendwann")).toBeNull();
    let s = belegSetzen(BASIS, beleg("b1", "2026-05-02"), t("2026-05-02"));
    s = belegSetzen(s, beleg("b2", "2026-07-02"), t("2026-07-02"));
    const [s1] = anlegen(s, "ust_voranmeldung", t("2026-07-05"), "va");
    s = felderSetzen(s1, "va", { zeitraum: "2. Quartal 2026", vorsteuer: "0,70" }, t("2026-07-05"));
    s = ausgeben(s, "va", t("2026-07-06"));
    expect(s.belege.find((b) => b.id === "b1")!.festgeschrieben).toBeTruthy();
    expect(s.belege.find((b) => b.id === "b2")!.festgeschrieben).toBeFalsy();
    expect(vaAbgegebenFuer(s, "2026-05-10")).toBe("2. Quartal 2026");
    expect(vaAbgegebenFuer(s, "2026-07-10")).toBeNull();
  });
});

describe("Rechnungen: Absender und XRechnung mit der Festschreibung", () => {
  it("eine spätere Änderung in „Mein Betrieb“ ändert die festgeschriebene Rechnung nicht; das Paket nimmt das Original", () => {
    let s = rechnung(BASIS, "r1", "2026-01-22");
    const u = s.unterlagen[0]!;
    expect(u.absender?.strasse).toBe("Karl-Heine-Str. 1");
    expect(u.xml).toBe(xrechnungUbl(eRechnungAus(u.daten, BETRIEB).daten, KU_HINWEIS));
    s = betriebSetzen(s, { ...s.betrieb, strasse: "Neue Allee 1" });
    expect(absenderFuer(s, s.unterlagen[0]!).strasse).toBe("Karl-Heine-Str. 1");
    const p = steuerpaket(s, { von: "2026-01-01", bis: "2026-03-31", name: "2026-Q1" }, SB, {}, "2026-04-02T08:00:00.000Z");
    const xml = datei(p.zip, "E-Rechnungen/2026-001.xml");
    expect(xml).toBe(u.xml);
    expect(xml).not.toContain("Neue Allee");
    // Migration 3 → 4: ältere festgeschriebene Rechnungen bekommen die heutigen Absenderdaten
    const m = migrieren({ version: 3, betrieb: BETRIEB, unterlagen: [{ ...u, absender: undefined, xml: undefined }] }) as { unterlagen: { absender?: { name: string } }[] };
    expect(m.unterlagen[0]!.absender?.name).toBe("Café Morgenrot");
  });
  it("Verfahrensdokumentation: festgeschrieben und versioniert, 10 Jahre aufzubewahren", () => {
    const [s1] = anlegen(BASIS, "verfahrensdokumentation", t("2026-01-15"), "vd");
    const s = ausgeben(s1, "vd", t("2026-01-16"));
    expect(s.unterlagen[0]!.festgeschrieben).toBeTruthy();
    expect(aufbewahrenBis(s, s.unterlagen[0]!)).toBe("9999-12-31");
  });
});

describe("Kasse: Eigenbelege, Grund, Kassenbuch, Kassensturz, Nachschau", () => {
  it("Bewegungen bekommen beim Speichern eine Eigenbeleg-Nummer; Korrektur braucht mindestens 10 Zeichen Grund", () => {
    const [s, k] = kasseSpeichern(BASIS, tag("2026-04-01", { anfang_cent: 20000, bewegungen: [{ art: "transit", betrag_cent: 5000 }, { art: "entnahme", betrag_cent: 1000, datei: "quit1234.jpg" }] }), t("2026-04-01", 20), "k0");
    expect(k.bewegungen.map((b) => b.beleg_nr)).toEqual(["EB2026-001", "EB2026-002"]);
    expect(kasseKorrigieren(s, "k0", { ...k, karte_cent: 9000 }, "x", t("2026-04-02"))).toBe(s);
    const s2 = kasseKorrigieren(s, "k0", { ...k, karte_cent: 9000, bewegungen: [...k.bewegungen, { art: "einlage", betrag_cent: 500 }] }, "Kartenumsatz laut Abrechnung", t("2026-04-02"));
    expect(s2.kasse[0]!.bewegungen.map((b) => b.beleg_nr)).toEqual(["EB2026-001", "EB2026-002", "EB2026-003"]);
    // das Foto der Quittung gehört in Sicherung und Synchronisation
    expect(standAus(JSON.stringify(s2)).kasse[0]!.bewegungen[1]!.datei).toBe("quit1234.jpg");
  });
  it("Kassenbuch: festgeschrieben beim ersten Teilen; nach einer Korrektur neue Fassung, die alte bleibt", () => {
    let s = BASIS;
    [s] = kasseSpeichern(s, tag("2026-04-01", { anfang_cent: 20000 }), t("2026-04-01", 20), "k0");
    s = kassenbuchFestschreiben(s, "2026-04", "", { zeitraum: "April 2026", anfang: "200,00", eintraege: [] }, "abc", t("2026-04-02"));
    expect(kassenbuchFest(s, "2026-04", "")!.inhaltSha256).toBe("abc");
    expect(kassenbuchFestschreiben(s, "2026-04", "", { zeitraum: "April 2026", anfang: "200,00", eintraege: [] }, "abc", t("2026-04-03"))).toBe(s);
    s = kassenbuchFestschreiben(s, "2026-04", "", { zeitraum: "April 2026", anfang: "210,00", eintraege: [] }, "def", t("2026-04-04"));
    const u = kassenbuchFest(s, "2026-04", "")!;
    expect(u.fassungen).toHaveLength(1);
    expect(u.fassungen![0]!.daten.anfang).toBe("200,00");
    expect(s.unterlagen.filter((x) => x.vorlage === "kassenbuch")).toHaveLength(1);
  });
  it("Kassennachschau: letzter Kassensturz mit Zählprotokoll und Tagesabschlüsse; keine Monate nach heute", () => {
    let s = BASIS;
    [s] = kasseSpeichern(s, tag("2026-04-01", { anfang_cent: 20000, zbon: "100" }), t("2026-04-01", 20), "k0");
    [s] = kasseSpeichern(s, tag("2026-12-01"), t("2026-12-01", 20), "kz");
    [s] = kassensturzSpeichern(s, { gezaehlt_cent: 31234, stueckelung: { "10000": 3, "1000": 1, "200": 1, "20": 1, "10": 1, "2": 2 } as Record<string, number> }, t("2026-04-02", 10), "s1");
    const m = kassenMappe(s, "2026-04-15");
    expect(m.map((e) => e.vorlage)).toEqual(["kassensturz", "tagesabschluesse", "kassenbuch"]);
    expect(m[0]!.html).toContain("Zählprotokoll");
    expect(m[1]!.html).toContain("erfasst 01.04.2026, 22:00");
    expect(m.some((e) => e.titel.includes("Dezember"))).toBe(false);
  });
  it("Kasse anbieten auch bei offener Ladenkasse bzw. Marktstand; Kassenbericht nur bei offener Ladenkasse", () => {
    expect(kasseSichtbar({ profil: { "vertrieb.kanaele": ["marktstand"] }, kasse: [] })).toBe(true);
    expect(kasseSichtbar({ profil: { "kasse.elektronisch": false, "kasse.bargeld": true }, kasse: [] })).toBe(true);
    expect(kasseSichtbar({ profil: { "kasse.elektronisch": false, "kasse.bargeld": false }, kasse: [] })).toBe(false);
    expect(offeneLadenkasse({ "kasse.elektronisch": true })).toBe(false);
    expect(offeneLadenkasse({ "kasse.elektronisch": false, "kasse.bargeld": false })).toBe(false);
  });
});

describe("Voranmeldung, EÜR und Stapel: Kassendifferenz, Trinkgeld, Gutschein, Sachentnahmen", () => {
  function cafe(): Stand {
    let s = BASIS;
    [s] = kasseSpeichern(s, tag("2026-04-01", { anfang_cent: 20000, karte_cent: 11000, trinkgeld_cent: 1000, gezaehlt_cent: 32700 }), t("2026-04-01", 20), "k0");
    [s] = kasseSpeichern(s, tag("2026-04-02", { gutscheine: [{ vorgang: "verkauf", art: "mehrzweck", betrag_cent: 5000 }, { vorgang: "einloesung", art: "einzweck", satz: 7, betrag_cent: 2140 }] }), t("2026-04-02", 20), "k1");
    return sachentnahmeSpeichern(s, { datum: "2026-04-30", netto7_cent: 13400, netto19_cent: 5000 }, t("2026-04-30"));
  }
  it("Überschuss als Umsatz 19 %, Einzweck-Einlösung nicht doppelt, Mehrzweck-Verkauf kein Umsatz, Sachentnahmen in Kz 86/81", () => {
    const s = cafe();
    // 01.04.: bar 226 − (110 − 10) = 126, Trinkgeld 10 raus: Soll 200 + 126 − 10 = 316 → gezählt 327: Überschuss 11,00
    const u = umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "soll", s.belege, false, kasseFuerUst(s, "2026-05-01"))!;
    // 19 %: 2 × 119 + 11 Überschuss = 249 brutto → 209,24 netto; + 50 Sachentnahme
    expect(u.werte.umsatz_19).toBe("259,24");
    // 7 %: 107 + 107 − 21,40 = 192,60 brutto → 180,00 netto; + 134 Sachentnahme
    expect(u.werte.umsatz_7).toBe("314,00");
  });
  it("EÜR mit Sachentnahmen und Kassenüberschuss; Stapel bucht Differenz, Trinkgeld, Gutschein und Sachentnahme", () => {
    const s = cafe();
    const e = euerUebernahme(s, "2026");
    expect(e.einnahmen.find((x) => x.kategorie === "Sonstige Sach-, Nutzungs- und Leistungsentnahmen")!.betrag).toBe("184,00");
    const p = steuerpaket(s, { von: "2026-04-01", bis: "2026-04-30", name: "2026-04" }, SB, {}, "2026-05-02T08:00:00.000Z");
    const liste = datei(p.zip, "Buchungsliste_2026-04.csv");
    expect(liste).toContain("01.04.2026;11,00;S;1000;8400");
    expect(liste).toMatch(/01\.04\.2026;10,00;S;1360;1000;;[^;]*;Kartentrinkgeld/);
    expect(liste).toContain(";S;1000;1700;");
    expect(liste).toContain("30.04.2026;143,38;S;1800;8915");
    expect(liste).toContain("30.04.2026;59,50;S;1800;8910");
    const l = datei(p.zip, "LIESMICH.txt");
    expect(l).toContain("gebucht, damit Kassenbuch und Kassenkonto übereinstimmen");
    expect(l).toContain("Sachentnahmen (unentgeltliche Wertabgaben");
    const csv = datei(p.zip, "Kassenabschluesse_2026-04.csv").split("\r\n");
    expect(csv[0]).toContain("Anfangsbestand;Barausgaben (Belege)");
    expect(csv[0]).toContain("Erfasst am;Festgeschrieben am;Nacherfasst;Korrigiert (Anzahl)");
    expect(csv[1]).toContain("200,00");
    expect(csv[0]!.split(";").length).toBe(csv[3]!.split(";").length);
    // Sachentnahme löschen: protokolliert
    expect(sachentnahmeLoeschen(s, s.sachentnahmen[0]!.id).protokoll.at(-1)).toMatchObject({ art: "sachentnahme_geloescht" });
  });
});

describe("Offenes Archiv, Sicherung und Synchronisation", () => {
  it("Archiv: CSV, JSON, XML, Dateien und eine Beschreibung des Formats", () => {
    let s = rechnung(BASIS, "r1", "2026-01-22");
    s = belegSetzen(s, beleg("b1", "2026-01-23", { datei: "foto1234.jpg" }), t("2026-01-23"));
    [s] = kasseSpeichern(s, tag("2026-01-24", { anfang_cent: 1000 }), t("2026-01-24", 20), "k0");
    const a = offenesArchiv(s, { "foto1234.jpg": new Uint8Array([1, 2]) }, "2026-02-01T10:00:00.000Z");
    const namen = Object.keys(unzipSync(a.zip)).sort();
    expect(namen).toEqual(expect.arrayContaining(["LIESMICH.txt", "daten/stand.json", "Rechnungen.csv", "Belege.csv", "Kassenabschluesse.csv", "E-Rechnungen/2026-001_Muster-GmbH.xml", "Belege/B2026-001_2026-01-23_Grossmarkt.jpg"]));
    expect(datei(a.zip, "LIESMICH.txt")).toContain("Semikolon als Trenner, UTF-8");
    expect(JSON.parse(datei(a.zip, "daten/stand.json")).kasse).toHaveLength(1);
  });
  it("Kassenstürze, Sachentnahmen und Protokoll gehen bei Sync und Wiederherstellen nicht verloren", () => {
    const [a] = kassensturzSpeichern(BASIS, { gezaehlt_cent: 100 }, t("2026-04-02"), "s1");
    const b = sachentnahmeSpeichern(belegLoeschen(belegSetzen(BASIS, beleg("bx", "2026-04-02"), t("2026-04-02")), "bx", t("2026-04-02", 10)), { datum: "2026-04-30", netto7_cent: 100, netto19_cent: 0 }, t("2026-04-30"), "e1");
    const ab = syncZusammenfuehren(a, b).stand;
    expect(ab.kassenstuerze).toHaveLength(1);
    expect(ab.sachentnahmen).toHaveLength(1);
    expect(ab.protokoll).toHaveLength(1);
    const z = zusammenfuehren(BASIS, standAus(JSON.stringify(ab))).stand;
    expect([z.kassenstuerze.length, z.sachentnahmen.length, z.protokoll.length]).toEqual([1, 1, 1]);
    // gelöschte Sachentnahme kommt nicht zurück
    const geloescht = sachentnahmeLoeschen(ab, "e1", t("2026-05-01"));
    expect(syncZusammenfuehren(geloescht, ab).stand.sachentnahmen).toHaveLength(0);
  });
  it("doppelte Belegnummern zweier Geräte: der später erfasste, nicht festgeschriebene Beleg bekommt die nächste", () => {
    const a = belegSetzen(BASIS, beleg("ba", "2026-04-02", { erstellt: "2026-04-02T08:00:00.000Z" }), t("2026-04-02", 8));
    const b = belegSetzen(BASIS, beleg("bb", "2026-04-02", { erstellt: "2026-04-02T09:00:00.000Z" }), t("2026-04-02", 9));
    const ab = syncZusammenfuehren(a, b).stand;
    expect(Object.fromEntries(ab.belege.map((x) => [x.id, x.nr]))).toEqual({ ba: "B2026-001", bb: "B2026-002" });
  });
});
