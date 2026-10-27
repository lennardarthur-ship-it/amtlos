/**
 * E-229 (Steuerberater 27.10.2026, T-304 b und c):
 * - c) „Forderung uneinbringlich“ (§ 17 Abs. 2 Nr. 1 UStG) mit Tag und Grund: bei Soll-Versteuerung mindert der dann
 *   offene Betrag Umsatz und Steuer im Zeitraum der Uneinbringlichkeit, Geld, das danach noch eingeht, berichtigt erneut;
 *   bei Ist-Versteuerung keine Berichtigung. Vorher gab es nur den Hinweis auf die Steuerberatung (E-221).
 * - b) Skonto mindert Entgelt und Steuer anteilig je Steuersatz (§ 17 Abs. 1 UStG) – bestätigt, hier geprüft.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { syncZusammenfuehren } from "../src/konto/sync";
import { offenesArchiv } from "../src/unterlagen/archiv";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, offenAmTag, standAus, stornieren, uneinbringlichMoeglich, uneinbringlichSetzen, unterlageVereinen, zahlungVermerken, type Stand } from "../src/unterlagen/speicher";
import { steuerpaket } from "../src/unterlagen/steuerpaket";
import { offeneRechnungen, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000", versteuerung: "soll" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "ust.kleinunternehmer": false } };
const datei = (p: { zip: Uint8Array }, n: string) => strFromU8(unzipSync(p.zip)[n]!);

/** Rechnung vom 10.02.2026 über 226,00 € (100 € + 19 %, 100 € + 7 %), Leistung am Rechnungsdatum */
function re(versteuerung = "soll", skonto = false): Stand {
  const [s1] = anlegen({ ...BASIS, betrieb: { ...BETRIEB, versteuerung } }, "rechnung", t("2026-02-10"), "r1");
  const s2 = felderSetzen(s1, "r1", { datum: "2026-02-10", leistung_gleich: true, kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "100,00", satz: "19" }, { bezeichnung: "Speisen", menge: "1", einheit: "", preis: "100,00", satz: "7" }], ...(skonto ? { skonto: true, skonto_prozent: "3", skonto_tage: "10" } : {}) }, t("2026-02-10"));
  return ausgeben(s2, "r1", t("2026-02-10"));
}
const u1 = (s: Stand) => s.unterlagen.find((u) => u.id === "r1")!;
const va = (s: Stand, p: string) => umsaetzeFuer(s.unterlagen, p, s.betrieb, s.betrieb.versteuerung === "ist" ? "ist" : "soll")!;

describe("E-229 (T-304 c): Forderung uneinbringlich", () => {
  it("vermerken: Tag (nicht vor der Rechnung, nicht in der Zukunft) und Grund (bei „anderer Grund“ mit Erläuterung); am Tag muss etwas offen sein", () => {
    const s = re();
    const jetzt = t("2026-06-30");
    expect(uneinbringlichMoeglich(s, u1(s))).toBe(true);
    expect(uneinbringlichSetzen(s, "r1", { datum: "2026-02-01", grund: "insolvenz" }, jetzt)).toBe(s);
    expect(uneinbringlichSetzen(s, "r1", { datum: "2026-07-01", grund: "insolvenz" }, jetzt)).toBe(s);
    expect(uneinbringlichSetzen(s, "r1", { datum: "2026-05-15", grund: "sonstiges", text: "weg" }, jetzt)).toBe(s);
    const v = uneinbringlichSetzen(s, "r1", { datum: "2026-05-15", grund: "insolvenz", text: "Insolvenzverfahren eröffnet, AG Leipzig" }, jetzt);
    expect(u1(v).uneinbringlich).toEqual({ datum: "2026-05-15", grund: "insolvenz", text: "Insolvenzverfahren eröffnet, AG Leipzig", geaendert: "2026-06-30T09:00:00.000Z" });
    // ganz bezahlt: nichts offen – kein Vermerk
    const bezahlt = zahlungVermerken(s, "r1", { datum: "2026-03-01", betrag_cent: 22600 });
    expect(uneinbringlichSetzen(bezahlt, "r1", { datum: "2026-05-15", grund: "bestritten" }, jetzt)).toBe(bezahlt);
    // nicht mehr offen in Listen und Erinnerungen, Storno erst nach dem Zurücknehmen
    expect(offeneRechnungen(s.unterlagen).map((u) => u.id)).toEqual(["r1"]);
    expect(offeneRechnungen(v.unterlagen)).toEqual([]);
    expect(stornieren(v, "r1", t("2026-07-01"))[1]).toBeNull();
    const zurueck = uneinbringlichSetzen(v, "r1", null, t("2026-07-02"));
    expect(u1(zurueck).uneinbringlich).toEqual({ geaendert: "2026-07-02T09:00:00.000Z" });
    expect(stornieren(zurueck, "r1", t("2026-07-03"))[1]).not.toBeNull();
  });

  it("Soll: im Zeitraum der Uneinbringlichkeit mindert der offene Betrag je Steuersatz – nach einer Teilzahlung genau der Rest", () => {
    let s = zahlungVermerken(re(), "r1", { datum: "2026-03-05", betrag_cent: 11300 }); // die Hälfte
    expect(offenAmTag(s, u1(s), "2026-05-15")).toBe(11300);
    s = uneinbringlichSetzen(s, "r1", { datum: "2026-05-15", grund: "vollstreckung" }, t("2026-06-01"));
    expect(va(s, "2026-02").werte).toMatchObject({ umsatz_19: "100,00", umsatz_7: "100,00" });
    const mai = va(s, "2026-05");
    expect(mai.werte).toMatchObject({ umsatz_19: "-50,00", umsatz_7: "-50,00" });
    expect(mai.uneinbringlich).toEqual([{ nummer: "2026-001", netto_cent: -10000, tag: "2026-05-15" }]);
    expect(mai.werte.annahmen).toContain("Rechnung 2026-001: Forderung seit 15.05.2026 uneinbringlich – Umsatz um 100,00 € (netto) und die Steuer darauf gemindert (§ 17 Abs. 2 Nr. 1 UStG).");
    // später doch Geld: im Zeitraum der Zahlung erneut berichtigt
    s = zahlungVermerken(s, "r1", { datum: "2026-09-10", betrag_cent: 5650 });
    const sep = va(s, "2026-09");
    expect(sep.werte).toMatchObject({ umsatz_19: "25,00", umsatz_7: "25,00" });
    expect(sep.werte.annahmen).toContain("am 10.09.2026 nach der Uneinbringlichkeit noch eingegangen");
    expect(va(s, "2026-05").werte).toMatchObject({ umsatz_19: "-50,00", umsatz_7: "-50,00" });
  });

  it("Ist: keine Berichtigung (die Steuer entsteht erst mit der Zahlung)", () => {
    let s = zahlungVermerken(re("ist"), "r1", { datum: "2026-03-05", betrag_cent: 11300 });
    s = uneinbringlichSetzen(s, "r1", { datum: "2026-05-15", grund: "insolvenz" }, t("2026-06-01"));
    expect(va(s, "2026-05").werte).toMatchObject({ umsatz_19: "0,00", umsatz_7: "0,00" });
    expect(va(s, "2026-05").uneinbringlich).toEqual([]);
    s = zahlungVermerken(s, "r1", { datum: "2026-09-10", betrag_cent: 5650 });
    expect(va(s, "2026-09").werte).toMatchObject({ umsatz_19: "25,00", umsatz_7: "25,00" });
  });

  it("Zusammenführen: die zuletzt geänderte Angabe gilt (auch das Zurücknehmen), symmetrisch; Sicherung behält sie", () => {
    const s = uneinbringlichSetzen(re(), "r1", { datum: "2026-05-15", grund: "bestritten" }, t("2026-06-01"));
    const zurueck = uneinbringlichSetzen(s, "r1", null, t("2026-06-02"));
    expect(unterlageVereinen(u1(s), u1(zurueck)).uneinbringlich).toEqual({ geaendert: "2026-06-02T09:00:00.000Z" });
    expect(unterlageVereinen(u1(zurueck), u1(s)).uneinbringlich).toEqual({ geaendert: "2026-06-02T09:00:00.000Z" });
    expect(u1(syncZusammenfuehren(re(), s).stand).uneinbringlich?.datum).toBe("2026-05-15");
    expect(u1(standAus(JSON.stringify(s))).uneinbringlich).toEqual(u1(s).uneinbringlich);
    // der Vermerk ist nicht Inhalt: Daten und Festschreibung der Rechnung unverändert
    expect(u1(s).daten).toEqual(u1(re()).daten);
    expect(u1(s).festgeschrieben).toBe(u1(re()).festgeschrieben);
  });

  it("Steuerberater-Paket (EÜR): Liste und LIESMICH – keine Ausbuchung, Berichtigung nur in der Liste (E-232: Bilanz siehe e232-steuerberater)", () => {
    const s = uneinbringlichSetzen(re(), "r1", { datum: "2026-05-15", grund: "insolvenz" }, t("2026-06-01"));
    const p = steuerpaket(s, { von: "2026-05-01", bis: "2026-05-31", name: "2026-05" }, SB, {}, "2026-06-02T10:00:00.000Z");
    expect(datei(p, "Uneinbringlich_2026-05.csv")).toContain("2026-001;Muster GmbH;10.02.2026;15.05.2026;Insolvenz des Kunden;;226,00;26,00;");
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Forderungen uneinbringlich (§ 17 Abs. 2 Nr. 1 UStG, Uneinbringlich_2026-05.csv): RE 2026-001 (Muster GmbH) seit 15.05.2026, Insolvenz des Kunden, offen 226,00 € brutto, davon Umsatzsteuer 26,00 €");
    expect(l).toContain("Einnahmen-Überschuss-Rechnung: keine Ausbuchung (es ist nichts zugeflossen) – die Umsatzsteuerberichtigung steht nicht im Stapel, sondern nur in dieser Liste; bitte von Hand buchen.");
    expect(datei(p, "Buchungsliste_2026-05.csv").split("\r\n").length).toBeLessThanOrEqual(2);
    expect(datei(offenesArchiv(s, {}, "2026-06-02T10:00:00.000Z"), "Uneinbringlich.csv")).toContain("15.05.2026;Insolvenz des Kunden");
  });

  it("Oberfläche: Aktion an der Rechnung, Storno-Sperre mit Meldung", () => {
    const a = lies("seiten/Abschluss.tsx");
    expect(a).toContain("uneinbringlichMoeglich(z.stand, u) ? <Uneinbringlich id={id} />");
    expect(a).toContain("z.uneinbringlichSetzen(id, { datum, grund,");
    expect(a).toContain("melden(TEXT.e229_uneinbringlich_storno");
  });
});

describe("E-229 (T-304 b): Skonto mindert Entgelt und Steuer anteilig je Steuersatz (§ 17 Abs. 1 UStG)", () => {
  it("3 % Skonto auf 226 € (119 € zu 19 %, 107 € zu 7 %): 3,57 € und 3,21 € brutto – je Satz Netto und Steuer gemindert", () => {
    const s = zahlungVermerken(re("soll", true), "r1", { datum: "2026-02-15", betrag_cent: 21922, minderung_cent: 678, art: "skonto" });
    const feb = va(s, "2026-02");
    // 100,00 − 3,00 (3,57 brutto / 1,19) und 100,00 − 3,00 (3,21 brutto / 1,07)
    expect(feb.werte).toMatchObject({ umsatz_19: "97,00", umsatz_7: "97,00" });
    expect(feb.minderungen).toBe(1);
  });
});
