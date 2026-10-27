/**
 * E-193: Befunde der externen Prüfung zu Rechnungen in der App – Storno einer Schlussrechnung im DATEV-Stapel, in der
 * Voranmeldung und der EÜR (8b), Steuerberatung nach dem Wiederherstellen (8c), Android-Teilen ohne Ergebnis (4).
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { STORNO_ABSCHLAEGE, dokumentHtml, eRechnungAus, vorlageFuer, type Daten } from "@amtlos/fachlogik";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, geteiltOffenLetzte, fassungHash, geteilteFassungFestschreiben, loeschen, standAus, steuerberatungSetzen, steuerberatungVereinen, stornieren, teilenOffenVermerken, unterlagenVereinen, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { einnahmenAusRechnungen, steuerpaket } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { rechnungBrutto } from "../src/unterlagen/ablage";
import { sicherungErstellen, sicherungLesen } from "../src/unterlagen/sicherung";

/** sichtbarer Text eines Dokuments (ohne Stil und Tags, Leerraum zusammengefasst) */
const sichtbarerText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const t = (d: string) => new Date(`${d}T09:00:00Z`);
const JAHR = { von: "2026-01-01", bis: "2026-12-31", name: "2026" };
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Holzbau Nord GmbH", rechtsform: "GmbH", registergericht: "Amtsgericht Hamburg", registernummer: "HRB 123456", vertretung: "Jana Holm", strasse: "Werftweg 2", plz: "20457", ort: "Hamburg", email: "info@holzbau.example", telefon: "040 1", steuernummer: "41/724/03619", ust_idnr: "DE123456789", iban: "DE89370400440532013000", versteuerung: "soll" };
const KUNDE = { kunde_name: "Elbstudio GmbH", kunde_anschrift: "Hafenstraße 3\n20457 Hamburg", kunde_email: "re@elbstudio.example" };
const pos = (preis: string) => [{ bezeichnung: "Umbau Ladenlokal", menge: "1", einheit: "Pauschale", preis, satz: "19" }];
const ABSCHLAG = [{ nummer: "2026-010", datum: "01.08.2026", netto: "6.000,00", satz: "19" }];

function rechnung(s: Stand, id: string, datum: string, daten: Daten): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  return ausgeben(felderSetzen(s1, id, { datum, leistung_gleich: true, zahlungsziel: "14", ...KUNDE, ...daten }, t(datum)), id, t(datum));
}

/** Abschlag 6.000 € netto (bezahlt), Schlussrechnung über 10.000 € netto mit diesem Abschlag, dann ihr Storno. */
function bau(): Stand {
  let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
  s = rechnung(s, "a1", "2026-08-01", { nummer: "2026-010", abschlag: true, leistung_gleich: false, leistung: "August 2026", positionen: pos("6.000,00") });
  s = bezahltSetzen(s, "a1", "2026-08-10");
  s = rechnung(s, "s1", "2026-10-12", { nummer: "2026-011", schluss: true, abschlaege: ABSCHLAG, positionen: pos("10.000,00") });
  const [s2, storno] = stornieren(s, "s1", t("2026-10-20"), "st1");
  return ausgeben(s2, storno!.id, t("2026-10-20"));
}

const zeilenAus = (p: { zip: Uint8Array }) => Buffer.from(unzipSync(p.zip)["EXTF_Buchungsstapel_2026.csv"]!).toString("latin1").split("\r\n").slice(2, -1).map((x) => x.split(";"));
/** Betrag, Soll/Haben, Konto, Gegenkonto, Belegfeld 1, Generalumkehr (Feld 118) */
const kurz = (f: string[]) => [f[0], f[1], f[6], f[7], f[10], f[117]];

describe("8b: Storno einer Schlussrechnung spiegelt die Buchung des Rests", () => {
  it("Storno trägt den Merker und spiegelt die Abschläge; PDF: Gutschrift nur über den Rest", () => {
    const s = bau();
    const st = s.unterlagen.find((u) => u.id === "st1")!;
    expect(st.daten[STORNO_ABSCHLAEGE]).toBe(true);
    expect(st.festgeschrieben).toBeTruthy();
    // Rechnungsbetrag des Stornos = −(Rest der Schlussrechnung)
    expect(rechnungBrutto(s.unterlagen.find((u) => u.id === "s1")!, s.betrieb)).toBe(476000);
    expect(rechnungBrutto(st, s.betrieb)).toBe(-476000);
    const text = sichtbarerText(dokumentHtml(vorlageFuer("rechnung")!, st.daten, s.betrieb));
    expect(text).toContain("Gesamtbetrag der Leistung −11.900,00 €");
    // E-200: Vorzeichen gespiegelt – die Abschläge stehen als „zuzüglich … (bleibt bestehen)“ mit positivem Betrag da,
    // sodass jede Zeile so rechnet, wie sie dasteht (−11.900 + 6.000 + 1.140 = −4.760)
    expect(text).toContain("zuzüglich Abschlagsrechnung Nr. 2026-010 vom 01.08.2026 (bleibt bestehen): Entgelt 6.000,00 €");
    expect(text).toContain("zuzüglich darauf entfallende Umsatzsteuer 19 % 1.140,00 €");
    expect(text).toContain("Storniertes Entgelt −4.000,00 €, darauf Umsatzsteuer −760,00 €");
    expect(text).toContain("Stornobetrag −4.760,00 €");
    expect(text).toContain("Storniert wird nur der Restbetrag der Schlussrechnung Nr. 2026-011. Die Abschlagsrechnung Nr. 2026-010 vom 01.08.2026 über 7.140,00 € bleibt bestehen.");
    expect(text).not.toMatch(/abzüglich|Noch zu zahlen/);
    // XRechnung: Abschläge mit umgekehrtem Vorzeichen, sodass die Rechnungskorrektur nur den Rest erstattet
    const { daten } = eRechnungAus(st.daten, s.betrieb);
    expect(daten.art).toBe("storno");
    expect(daten.abschlaege).toEqual([{ nummer: "2026-010", datum: "2026-08-01", satz: 19, netto_cent: 600000, ust_cent: 114000 }]);
  });

  for (const [rahmen, forderung, erloes] of [["SKR03", "1410", "8400"], ["SKR04", "1210", "4400"]] as const) {
    it(`DATEV-Stapel ${rahmen}: Abschlag 7.140,00 €, Schlussrechnung 4.760,00 €, Storno 4.760,00 € mit Generalumkehr (vorher 11.900,00 €)`, () => {
      const sb = { kontenrahmen: rahmen, beraternummer: "31877", mandantennummer: "20514" };
      const z = zeilenAus(steuerpaket(bau(), JAHR, sb, {}, "2027-02-15T10:00:00"));
      expect(z.map(kurz)).toEqual([
        ["7140,00", '"S"', forderung, erloes, '"2026-010"', ""],
        ["4760,00", '"S"', forderung, erloes, '"2026-011"', ""],
        ["4760,00", '"S"', forderung, erloes, '"2026-012"', "1"],
      ]);
      // Saldo der Forderungen: nur der bezahlte Abschlag bleibt (Zahlungen bucht die Kanzlei) – Schluss und Storno heben sich auf
      const saldo = z.reduce((a, f) => a + (f[6] === forderung ? 1 : 0) * (f[1] === '"S"' ? 1 : -1) * (f[117] === "1" ? -1 : 1) * Number(f[0]!.replace(",", ".")), 0);
      expect(saldo).toBe(7140);
    });
  }

  it("Voranmeldung: Abschlag in Q3, in Q4 heben sich Schlussrechnung (+4.000) und Storno (−4.000) auf", () => {
    const s = bau();
    expect(umsaetzeFuer(s.unterlagen, "2026-Q3", s.betrieb)!.werte.umsatz_19).toBe("6.000,00");
    expect(umsaetzeFuer(s.unterlagen, "2026-Q4", s.betrieb)!.werte.umsatz_19).toBe("0,00");
  });

  it("EÜR (Ist): Zahlung der Schlussrechnung (Rest 4.000 € netto) und Erstattung durch das Storno heben sich auf", () => {
    let s = bau();
    s = { ...s, betrieb: { ...s.betrieb, name: "Holzbau Nord", rechtsform: "", registergericht: "", registernummer: "", versteuerung: "ist" } };
    s = bezahltSetzen(s, "s1", "2026-10-15");
    s = bezahltSetzen(s, "st1", "2026-10-25");
    const e = einnahmenAusRechnungen(s).map((x) => [x.tag, x.netto_cent, x.ust_cent]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(e).toEqual([["2026-08-10", 600000, 114000], ["2026-10-15", 400000, 76000], ["2026-10-25", -400000, -76000]]);
  });

  it("Storno aus früheren Versionen (ohne Merker) bleibt beim ganzen Betrag – wie das damals geteilte PDF", () => {
    const s = bau();
    const st = s.unterlagen.find((u) => u.id === "st1")!;
    const { [STORNO_ABSCHLAEGE]: _m, ...alt } = st.daten;
    const u = { ...st, daten: alt };
    expect(rechnungBrutto(u, s.betrieb)).toBe(-1190000);
    expect(sichtbarerText(dokumentHtml(vorlageFuer("rechnung")!, alt, s.betrieb))).not.toContain("Abschlagsrechnung Nr.");
  });
});

describe("8c: Wiederherstellen behält Kontenrahmen, Berater- und Mandantennummer", () => {
  const zufall = (n: number) => new Uint8Array(randomBytes(n));
  const SB = { kontenrahmen: "SKR04" as const, beraternummer: "31877", mandantennummer: "20514" };

  it("Sicherung → neues Gerät → Wiederherstellen: SKR04 und Nummern bleiben (vorher: SKR03, leer)", () => {
    const alt = steuerberatungSetzen(bau(), SB, t("2026-10-21"));
    const datei = sicherungErstellen(alt, "richtig-langes-passwort", zufall, new Date(), 1000);
    const gelesen = sicherungLesen(datei, "richtig-langes-passwort");
    expect(gelesen.steuerberatung).toEqual(SB);
    const z = zusammenfuehren(LEERER_STAND, gelesen);
    expect(z.stand.steuerberatung).toEqual(SB);
    expect(z.stand.zeiten.steuerberatung).toBe(alt.zeiten.steuerberatung);
  });

  it("auch nach einem Ladefehler bzw. wenn auf dem neuen Gerät schon der Pflichten-Check lief", () => {
    const alt = steuerberatungSetzen(LEERER_STAND, SB, t("2026-10-21"));
    const neu = { ...LEERER_STAND, profil: { rechtsform: "gmbh" }, zeiten: { "profil:rechtsform": "2026-10-25T08:00:00.000Z" } };
    expect(zusammenfuehren(neu, alt).stand.steuerberatung).toEqual(SB);
  });

  it("auf dem Gerät später geänderte Angaben gewinnen; ältere Sicherung ohne Zeitpunkt überschreibt keine gesetzten Angaben", () => {
    const gesichert = steuerberatungSetzen(LEERER_STAND, SB, t("2026-10-01"));
    const geraet = steuerberatungSetzen(LEERER_STAND, { kontenrahmen: "SKR03", beraternummer: "11111", mandantennummer: "2" }, t("2026-10-20"));
    expect(zusammenfuehren(geraet, gesichert).stand.steuerberatung.beraternummer).toBe("11111");
    expect(zusammenfuehren(gesichert, geraet).stand.steuerberatung.beraternummer).toBe("11111");
    // ältere Daten ohne Zeitpunkte: was gesetzt ist, bleibt; leere Angaben auf dem Gerät weichen der Sicherung
    expect(steuerberatungVereinen({ steuerberatung: SB, zeiten: {} }, { steuerberatung: LEERER_STAND.steuerberatung, zeiten: {} })).toEqual(SB);
    expect(steuerberatungVereinen({ steuerberatung: LEERER_STAND.steuerberatung, zeiten: {} }, { steuerberatung: SB, zeiten: {} })).toEqual(SB);
  });

  it("Kontenvorgaben der Kanzlei und Nachweise der Vollsicherung gehen beim Wiederherstellen nicht verloren", () => {
    const mit = steuerberatungSetzen(LEERER_STAND, { ...SB, kontenvorgaben: { kanzlei: "Steuerberatungskanzlei", personenkonten: true } }, t("2026-10-21"));
    const gesichert: Stand = { ...mit, sicherungsNachweis: [{ am: "2026-10-21T10:00:00.000Z", ziel: "datei" }] };
    const z = zusammenfuehren(LEERER_STAND, gesichert).stand;
    expect(z.steuerberatung.kontenvorgaben).toMatchObject({ kanzlei: "Steuerberatungskanzlei", personenkonten: true });
    expect(z.sicherungsNachweis).toEqual([{ am: "2026-10-21T10:00:00.000Z", ziel: "datei" }]);
  });
});

describe("4: Android – Teilen abgebrochen zählt nicht als verschickt", () => {
  const lies = (datei: string) => readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src", datei), "utf8");
  /** Rechnungsentwurf, auf Android geteilt, Frage mit „Nein, noch nicht“ beantwortet */
  function nein(): Stand {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
    const [s1] = anlegen(s, "rechnung", t("2026-10-12"), "r1");
    s = felderSetzen(s1, "r1", { datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", ...KUNDE, positionen: pos("1.000,00") }, t("2026-10-12"));
    const daten = s.unterlagen[0]!.daten;
    return teilenOffenVermerken(s, "r1", t("2026-10-12"), { art: "pdf", daten, pdfSha256: "ab12", absender: BETRIEB });
  }

  it("„Nein, noch nicht“: Entwurf bleibt (nicht festgeschrieben, nicht ausgegeben), die geteilte Fassung ist vermerkt", () => {
    const u = nein().unterlagen[0]!;
    expect(u.festgeschrieben).toBeUndefined();
    expect(u.ausgegeben).toBeUndefined();
    // E-200: mit Prüfwert über Inhalt und Absender
    expect(u.geteiltOffen).toEqual([{ am: "2026-10-12T09:00:00.000Z", art: "pdf", daten: u.daten, pdfSha256: "ab12", absender: BETRIEB, inhaltSha256: fassungHash({ daten: u.daten, absender: BETRIEB }) }]);
    expect(u.geteiltOffen![0]!.inhaltSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(geteiltOffenLetzte(u)).toMatchObject({ geaendert: false });
  });

  it("später „Doch verschickt – festschreiben“: genau die geteilte Fassung, mit PDF-Hash und Absender; Änderungen danach verworfen", () => {
    let s = nein();
    const geteilt = s.unterlagen[0]!.daten;
    s = felderSetzen(s, "r1", { positionen: pos("2.000,00") }, t("2026-10-13"));
    expect(geteiltOffenLetzte(s.unterlagen[0]!)!.geaendert).toBe(true);
    s = geteilteFassungFestschreiben(s, "r1", t("2026-10-14"));
    const u = s.unterlagen[0]!;
    expect(u.daten).toEqual(geteilt);
    expect(u.festgeschrieben).toBe("2026-10-14T09:00:00.000Z");
    // erste Ausgabe ist das Teilen, nicht die Bestätigung
    expect(u.ausgegeben).toBe("2026-10-12T09:00:00.000Z");
    expect(u.pdfSha256).toBe("ab12");
    expect(u.absender?.name).toBe(BETRIEB.name);
    expect(u.xml).toContain('<cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>');
    // danach ändert nichts mehr den Inhalt, und es gibt nichts mehr festzuschreiben
    expect(felderSetzen(s, "r1", { positionen: pos("5,00") }, t("2026-10-15")).unterlagen[0]!.daten).toEqual(geteilt);
    expect(geteiltOffenLetzte(u)).toBeNull();
  });

  it("geteilte E-Rechnung (XML) wird beim späteren Festschreiben als geteilt vermerkt; ohne Vermerk nichts festzuschreiben", () => {
    let s = nein();
    s = teilenOffenVermerken(s, "r1", t("2026-10-13"), { art: "xml", daten: s.unterlagen[0]!.daten, absender: BETRIEB });
    s = geteilteFassungFestschreiben(s, "r1", t("2026-10-14"));
    expect(s.unterlagen[0]!.eRechnungGeteilt).toBe("2026-10-14T09:00:00.000Z");
    const ohne: Stand = { ...LEERER_STAND, betrieb: BETRIEB, unterlagen: [{ ...nein().unterlagen[0]!, geteiltOffen: undefined }] };
    expect(geteilteFassungFestschreiben(ohne, "r1", t("2026-10-14"))).toBe(ohne);
  });

  it("Vermerk übersteht Speichern und Zusammenführen zweier Geräte; festgeschriebene Unterlagen bekommen keinen", () => {
    const s = nein();
    const gelesen = standAus(JSON.stringify(s));
    expect(gelesen.unterlagen[0]!.geteiltOffen).toEqual(s.unterlagen[0]!.geteiltOffen);
    const zweites = teilenOffenVermerken(s, "r1", t("2026-10-13"), { art: "druck", daten: s.unterlagen[0]!.daten });
    const v = unterlagenVereinen(s.unterlagen[0]!, zweites.unterlagen[0]!).u;
    expect(v.geteiltOffen!.map((g) => [g.am, g.art])).toEqual([["2026-10-12T09:00:00.000Z", "pdf"], ["2026-10-13T09:00:00.000Z", "druck"]]);
    const fest = ausgeben(s, "r1", t("2026-10-13"));
    expect(teilenOffenVermerken(fest, "r1", t("2026-10-14"), { art: "pdf", daten: {} }).unterlagen[0]!.geteiltOffen).toHaveLength(1);
  });

  it("Löschen eines geteilten Entwurfs nur mit Grund (E-200) – protokolliert, die Nummer bleibt vergeben", () => {
    expect(loeschen(nein(), "r1").unterlagen).toHaveLength(1);
    const weg = loeschen(nein(), "r1", t("2026-10-13"), "nicht verschickt");
    expect(weg.unterlagen).toEqual([]);
    expect(weg.protokoll.at(-1)).toMatchObject({ art: "entwurf_geloescht", nr: "2026-001", vorlage: "rechnung" });
    expect(lies("seiten/Abschluss.tsx")).toContain("TEXT.fs_loeschen_text(datumDe(offen.fassung.am))");
  });

  it("App: Frage nur auf Android und nur vor der ersten Festschreibung – PDF, Druck, E-Rechnung und Kassenbuch; iPhone unverändert", () => {
    // E-221: dazwischen die Frage vor der ersten Ausgabe der Voranmeldung (schreibt Belege fest) – sonst unverändert
    expect(lies("seiten/versand.ts")).toContain("if (!android) return true;");
    expect(lies("seiten/versand.ts")).toContain("if (!v.festschreiben || u.festgeschrieben) return true;");
    const a = lies("seiten/Abschluss.tsx");
    expect(a).toContain('if (!(await versandBestaetigt(u, v, art === "drucken"))) return z.teilenOffen(id, { daten: pdfDaten, art: art === "drucken" ? "druck" : "pdf"');
    // E-220 (8b): mit dem gedruckten Dokument (festgehalten, falls die Fassung später festgeschrieben wird)
    expect(a).toContain('if (!(await versandBestaetigt(u, v, false))) return z.teilenOffen(id, { daten: xmlDaten, art: "xml", absender, ...(html ? { druck: druckFesthalten(html, absender.logo, new Date().toISOString()) } : {}) });');
    expect(a).toContain("z.geteiltFestschreiben(id)");
    expect(lies("seiten/Kasse.tsx")).toContain("versandBestaetigt(");
    // iPhone: das Teilen-Menü von React Native meldet den Abbruch (E-127) – unverändert
    expect(lies("unterlagen/teilen.ts")).toContain("return r.action !== Share.dismissedAction;");
  });
});

describe("PDF wird vor dem Teilen vollständig geschrieben (Expo SDK 58: File.write ist asynchron)", () => {
  it("pdf.ts wartet jedes File.write ab", () => {
    const quelle = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/unterlagen/pdf.ts"), "utf8");
    const aufrufe = quelle.split("\n").filter((z) => /\.write\(/.test(z) && !/document\.write/.test(z));
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const z of aufrufe) expect(z, z.trim()).toMatch(/await\s+\w+\.write\(/);
  });
});
