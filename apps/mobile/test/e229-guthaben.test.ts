/**
 * E-229 (Steuerberater 27.10.2026, T-304 a): Überzahlungen nicht ablehnen (sonst stimmt die App nicht mehr mit dem
 * Bankkonto) – der offene Betrag gilt als bezahlt, der Rest bleibt Guthaben des Kunden mit der Wahl „zurücküberweisen“
 * oder „mit nächster Rechnung verrechnen“. Eine Überzahlung ist kein Umsatz und ändert die Umsatzsteuer nicht.
 * Vorher (E-221): Überzahlung abgelehnt. Guthaben gehen mit in Synchronisation, Sicherung, Archiv, Prüfexport und
 * Steuerberater-Paket; im Stapel nur mit „Zahlungseingänge buchen“ (Bank an Forderungen), keine neuen Konten.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { syncZusammenfuehren } from "../src/konto/sync";
import { offenesArchiv } from "../src/unterlagen/archiv";
import { pruefexport } from "../src/unterlagen/pruefexport";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, guthabenKonten, guthabenRest, guthabenVerrechnen, guthabenVerwendet, guthabenZurueckzahlen, offenerBetrag, standAus, unterlageVereinen, verrechenbareRechnungen, zahlungPruefen, zahlungVermerken, type Stand } from "../src/unterlagen/speicher";
import { einnahmenAusRechnungen, steuerpaket } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000", versteuerung: "ist" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "ust.kleinunternehmer": false } };
const datei = (p: { zip: Uint8Array }, n: string) => strFromU8(unzipSync(p.zip)[n]!);

/** Rechnung über 119,00 € (100 € + 19 %) an `kunde` */
function re(s: Stand, id: string, datum: string, kunde = "Muster GmbH", preis = "100,00"): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: kunde, kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis, satz: "19" }] }, t(datum));
  return ausgeben(s2, id, t(datum));
}

const r1 = (s: Stand) => s.unterlagen.find((u) => u.id === "r1")!;

/** r1 (119 €) mit 150 € bezahlt am 02.04., r2 (119 €) desselben Kunden am 20.04., r3 eines anderen Kunden */
function fall(): Stand {
  let s = re(BASIS, "r1", "2026-03-25");
  s = re(s, "r2", "2026-04-20");
  s = re(s, "r3", "2026-04-21", "Andere AG");
  return zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 15000 }, t("2026-04-02"), "z1");
}

describe("E-229 (T-304 a): Überzahlung wird Guthaben des Kunden", () => {
  it("150 € auf 119 €: nicht mehr abgelehnt – 119 € bezahlt, 31 € Guthaben; Meldung und Speicher stimmen überein", () => {
    let s = re(BASIS, "r1", "2026-03-25");
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 15000 })).toMatchObject({ fehler: null, offen: 11900, ueberzahlung: 3100 });
    s = zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 15000 }, t("2026-04-02"), "z1");
    const u = s.unterlagen[0]!;
    expect(u.zahlungen).toEqual([{ id: "z1", datum: "2026-04-02", betrag_cent: 11900 }]);
    expect(u.bezahlt).toBe("2026-04-02");
    expect(u.guthaben).toEqual([{ id: "z1-ue", art: "ueberzahlung", datum: "2026-04-02", betrag_cent: 3100, zahlung: "z1", erfasst: "2026-04-02T09:00:00.000Z" }]);
    expect(offenerBetrag(s, u)).toBe(0);
    expect(guthabenRest(s, "r1", "z1-ue")).toBe(3100);
    // Skonto zusammen mit mehr als offen bleibt ein Fehler (kein Guthaben aus einem Abzug)
    expect(zahlungPruefen(re(BASIS, "r9", "2026-03-25"), "r9", { datum: "2026-04-02", betrag_cent: 11900, minderung_cent: 200, art: "skonto" }).fehler).toBe("ueberzahlt");
  });

  it("doppelt überwiesen: Rechnung schon bezahlt (auch „als bezahlt markiert“ ohne Liste) – der ganze Betrag wird Guthaben", () => {
    let s = bezahltSetzen(re(BASIS, "r1", "2026-03-25"), "r1", "2026-04-01", t("2026-04-01"));
    s = zahlungVermerken(s, "r1", { datum: "2026-04-05", betrag_cent: 11900 }, t("2026-04-05"), "z2");
    const u = s.unterlagen[0]!;
    expect(u.bezahlt).toBe("2026-04-01");
    expect(u.zahlungen).toEqual([{ id: "r1-voll", datum: "2026-04-01", betrag_cent: 11900 }]);
    expect(u.guthaben).toEqual([expect.objectContaining({ art: "ueberzahlung", datum: "2026-04-05", betrag_cent: 11900 })]);
    expect(u.guthaben![0]!.zahlung).toBeUndefined();
  });

  it("Überzahlung ist kein Umsatz: Ist-Voranmeldung und EÜR zählen nur 119 €", () => {
    const s = fall();
    expect(umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "ist")!.werte.umsatz_19).toBe("100,00");
    expect(einnahmenAusRechnungen(s).filter((e) => e.tag.startsWith("2026-04")).reduce((a, e) => a + e.netto_cent + e.ust_cent, 0)).toBe(11900);
  });

  it("zurücküberweisen: Rückzahlung mit Tag, höchstens der Rest, nicht vor der Überzahlung", () => {
    let s = fall();
    expect(guthabenZurueckzahlen(s, "r1", "z1-ue", "2026-04-01", 1000)).toBe(s);
    expect(guthabenZurueckzahlen(s, "r1", "z1-ue", "2026-04-10", 3200)).toBe(s);
    s = guthabenZurueckzahlen(s, "r1", "z1-ue", "2026-04-10", 1000, t("2026-04-10"), "rz1");
    expect(r1(s).guthaben![1]).toEqual({ id: "rz1", art: "rueckzahlung", datum: "2026-04-10", betrag_cent: 1000, bezug: "z1-ue", erfasst: "2026-04-10T09:00:00.000Z" });
    expect(guthabenRest(s, "r1", "z1-ue")).toBe(2100);
    expect(guthabenVerwendet(s, "r1")).toBe(true);
  });

  it("mit nächster Rechnung desselben Kunden verrechnen: Zahlung an r2 zum Tag der Verrechnung mit Verweis; anderer Kunde nicht", () => {
    let s = fall();
    expect(verrechenbareRechnungen(s, "r1").map((u) => u.id)).toEqual(["r2"]);
    expect(guthabenVerrechnen(s, "r1", "z1-ue", "r3", "2026-04-25", 3100)).toBe(s);
    expect(guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-04-01", 3100)).toBe(s);
    expect(guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-04-25", 3200)).toBe(s);
    s = guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-05-04", 3100, t("2026-05-04"), "v1");
    const r2 = s.unterlagen.find((u) => u.id === "r2")!;
    expect(r2.zahlungen).toEqual([{ id: "v1", datum: "2026-05-04", betrag_cent: 3100, guthaben: { rechnung: "r1", eintrag: "z1-ue" } }]);
    expect(offenerBetrag(s, r2)).toBe(8800);
    expect(guthabenRest(s, "r1", "z1-ue")).toBe(0);
    // aufgebraucht: kein zweites Mal
    expect(guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-05-05", 1)).toBe(s);
    // Ist-Versteuerung und EÜR: Entgelt von r2 ab dem Tag der Verrechnung (Mai), nicht im April
    expect(umsaetzeFuer(s.unterlagen, "2026-05", s.betrieb, "ist")!.werte.umsatz_19).toBe("26,05");
    expect(umsaetzeFuer(s.unterlagen, "2026-04", s.betrieb, "ist")!.werte.umsatz_19).toBe("100,00");
    // Konto des Kunden
    const k = guthabenKonten(s);
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ kunde: "muster gmbh", name: "Muster GmbH", rest: 0 });
    expect(k[0]!.posten[0]!.verrechnungen.map((x) => x.u.id)).toEqual(["r2"]);
    expect(guthabenKonten(s, true)).toEqual([]);
  });

  it("Zahlungsvermerke entfernen: gesperrt, solange vom Guthaben etwas verwendet ist; Verrechnung entfernen gibt das Guthaben zurück", () => {
    let s = guthabenVerrechnen(fall(), "r1", "z1-ue", "r2", "2026-05-04", 3100, t("2026-05-04"), "v1");
    expect(bezahltSetzen(s, "r1", null, t("2026-05-05"))).toBe(s);
    s = bezahltSetzen(s, "r2", null, t("2026-05-05"));
    expect(guthabenRest(s, "r1", "z1-ue")).toBe(3100);
    s = bezahltSetzen(s, "r1", null, t("2026-05-06"));
    expect(r1(s).guthaben).toBeUndefined();
    expect(r1(s).zahlungen).toBeUndefined();
  });

  it("Sicherung, Synchronisation und Zusammenführen behalten Guthaben und Verweis (aus derselben Fassung wie die Zahlungen)", () => {
    const s = guthabenZurueckzahlen(guthabenVerrechnen(fall(), "r1", "z1-ue", "r2", "2026-05-04", 2000, t("2026-05-04"), "v1"), "r1", "z1-ue", "2026-05-06", 1100, t("2026-05-06"), "rz");
    const geladen = standAus(JSON.stringify(s));
    expect(r1(geladen).guthaben).toEqual(r1(s).guthaben);
    expect(r1(s).guthaben).toHaveLength(2);
    expect(geladen.unterlagen.find((u) => u.id === "r2")!.zahlungen).toEqual(s.unterlagen.find((u) => u.id === "r2")!.zahlungen);
    const alt = fall();
    const z = syncZusammenfuehren(alt, geladen).stand;
    expect(z.unterlagen.find((u) => u.id === "r1")!.guthaben).toHaveLength(2);
    expect(guthabenRest(z, "r1", "z1-ue")).toBe(0);
    // symmetrisch
    expect(unterlageVereinen(r1(alt), r1(s)).guthaben).toEqual(unterlageVereinen(r1(s), r1(alt)).guthaben);
    expect(unterlageVereinen(r1(alt), r1(s)).guthaben).toHaveLength(2);
  });

  it("Steuerberater-Paket: Guthaben-Liste, LIESMICH; ohne „Zahlungseingänge buchen“ keine eigene Buchung", () => {
    const s = guthabenVerrechnen(fall(), "r1", "z1-ue", "r2", "2026-04-25", 3100, t("2026-04-25"), "v1");
    const p = steuerpaket(s, { von: "2026-04-01", bis: "2026-04-30", name: "2026-04" }, SB, {}, "2026-05-02T10:00:00.000Z");
    const g = datei(p, "Guthaben_2026-04.csv");
    expect(g).toContain("Kunde;Rechnung mit Überzahlung;Vorgang;Datum;Betrag;Verrechnet mit Rechnung;Rest der Überzahlung");
    expect(g).toContain("Muster GmbH;2026-001;Überzahlung (Geldeingang, kein Umsatz);02.04.2026;31,00;;0,00");
    expect(g).toContain("Muster GmbH;2026-001;Verrechnung (Zahlung der anderen Rechnung);25.04.2026;-31,00;2026-002");
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Überzahlungen von Kunden (Guthaben_2026-04.csv)");
    expect(l).toContain("Im Stapel keine eigene Buchung");
    expect(l).toContain("- Guthaben_2026-04.csv:");
    const liste = datei(p, "Buchungsliste_2026-04.csv");
    expect(liste).not.toContain("Überzahlung");
    // Ist-EÜR: r2 mit der Verrechnung als Zahlung im Stapel (Forderung an Erlös zum Tag der Verrechnung)
    expect(liste).toMatch(/25\.04\.2026;31,00;S;1410;8400;/);
  });

  it("Bilanz mit „Zahlungseingänge buchen“: Überzahlung Bank an Forderungen, Rückzahlung Bank im Haben, Verrechnung ohne Bankbuchung", () => {
    const sb = { ...SB, kontenvorgaben: { zahlungenBuchen: true, gewinnermittlung: "bilanz" as const } };
    let s: Stand = { ...fall(), steuerberatung: sb, betrieb: { ...BETRIEB, versteuerung: "soll" } };
    s = guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-04-25", 2000, t("2026-04-25"), "v1");
    s = guthabenZurueckzahlen(s, "r1", "z1-ue", "2026-04-28", 1100, t("2026-04-28"), "rz");
    const p = steuerpaket(s, { von: "2026-04-01", bis: "2026-04-30", name: "2026-04" }, sb, {}, "2026-05-02T10:00:00.000Z");
    const bank = datei(p, "Buchungsliste_2026-04.csv").split("\r\n").filter((x) => x.includes(";1200;1410;"));
    expect(bank.map((x) => x.split(";").slice(0, 3).concat(x.split(";")[7]!))).toEqual([
      ["02.04.2026", "119,00", "S", "Zahlung RE 2026-001 Muster GmbH"],
      ["02.04.2026", "31,00", "S", "Überzahlung RE 2026-001 Muster GmbH"],
      ["28.04.2026", "11,00", "H", "Rückzahl. Guthaben RE 2026-001 Muster GmbH"],
    ]);
    expect(datei(p, "LIESMICH.txt")).toContain("das Guthaben steht bis dahin im Haben des Forderungs- bzw. Debitorenkontos");
  });

  it("offenes Archiv und Prüfexport enthalten die Guthaben-Liste", () => {
    const s = guthabenZurueckzahlen(fall(), "r1", "z1-ue", "2026-04-10", 3100, t("2026-04-10"), "rz");
    const a = offenesArchiv(s, {}, "2026-05-02T10:00:00.000Z");
    expect(datei(a, "Guthaben.csv")).toContain("Rückzahlung an den Kunden;10.04.2026;-31,00");
    expect(datei(a, "LIESMICH.txt")).toContain("guthaben[] (Überzahlungen und Rückzahlungen, auch in Guthaben.csv)");
    const e = pruefexport(s, {}, "2026-05-02T10:00:00.000Z");
    expect(datei(e, "Guthaben.csv")).toContain("Überzahlung (Geldeingang, kein Umsatz);02.04.2026;31,00");
    expect(datei(e, "Feldbeschreibung.txt")).toContain("Guthaben.csv");
    // ohne Guthaben keine Datei (bestehende Exporte unverändert)
    expect(unzipSync(offenesArchiv(re(BASIS, "r1", "2026-03-25"), {}, "2026-05-02T10:00:00.000Z").zip)["Guthaben.csv"]).toBeUndefined();
  });

  it("Oberfläche: Überzahlung als Hinweis statt Fehler, Guthaben an der Rechnung und beim Kunden, Weiteres Geld nach „bezahlt“", () => {
    const a = lies("seiten/Abschluss.tsx");
    expect(a).toContain("TEXT.e229_ueberzahlung(");
    expect(a).toContain("<GuthabenAbschnitt id={id} />");
    expect(a).toContain("z.guthabenZurueckzahlen(id, eintrag.id, datum, betrag);");
    expect(a).toContain("z.guthabenVerrechnen(id, eintrag.id, zielU.id, datum, betrag);");
    expect(a).toContain("TEXT.e229_nochmal_erhalten");
    expect(a).not.toContain("betrag > offen ? TEXT.r12_ueberzahlt");
    expect(lies("seiten/Betrieb.tsx")).toContain("guthabenKonten(z.stand, true)");
  });
});
