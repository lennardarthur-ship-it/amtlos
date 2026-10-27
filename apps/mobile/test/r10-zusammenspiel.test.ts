/**
 * Zusammenspiel der Änderungen E-227 (Erwerbsschwelle, Kleinunternehmer mit Erwerbsbesteuerung, „Nicht vollständig“),
 * E-228 (aufbewahrtes Original-PDF), E-229 (Guthaben aus Überzahlungen, gezahlter Euro-Betrag bei fremder Währung,
 * Forderung uneinbringlich) – dieselben Daten in einem Zeitraum bzw. einem Stand, durch Voranmeldung, EÜR,
 * Steuerberater-Paket, offenes Archiv, Sicherung und Synchronisation. Neue Fachaussagen enthält dieser Test nicht: Er
 * prüft, dass die einzeln getesteten Regeln nebeneinander gelten und die Texte zur Rechnung der App passen.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { dokumentHtml, vorlageFuer, type Beleg } from "@amtlos/fachlogik";
import { syncZusammenfuehren } from "../src/konto/sync";
import { offenesArchiv } from "../src/unterlagen/archiv";
import { VERZICHT_FELD } from "../src/unterlagen/erwerbsschwelle";
import { ausgabePdf, pdfOriginalFuer } from "../src/unterlagen/pdfOriginal";
import { pruefexport } from "../src/unterlagen/pruefexport";
import { schluesselAusPasswort } from "../src/unterlagen/sicherung";
import { containerOeffnen, containerSchreiben, type Leser } from "../src/unterlagen/sicherungContainer";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, dateienImStand, felderSetzen, guthabenRest, guthabenVerrechnen, standAus, uneinbringlichSetzen, zahlungVermerken, type Stand } from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket } from "../src/unterlagen/steuerpaket";
import { perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", rechtsform: "Einzelunternehmen", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000", versteuerung: "soll" };
const SCHWELLE = 12500;
const datei = (p: { zip: Uint8Array }, n: string) => strFromU8(unzipSync(p.zip)[n]!);
const enc = new TextEncoder();
const pdf = (inhalt: string) => enc.encode(`%PDF-1.7\n${inhalt}\n%%EOF`);
const zufall = (n: number) => new Uint8Array(randomBytes(n));

/** Rechnung an `kunde` über `preis` netto zu `satz` %, Leistung am Rechnungsdatum; `ku`: Kleinunternehmer-Rechnung */
function re(s: Stand, id: string, datum: string, o: { kunde?: string; preis?: string; satz?: string; ku?: boolean; nummer?: string } = {}): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  const s2 = felderSetzen(s1, id, { ...(o.nummer ? { nummer: o.nummer } : {}), datum, leistung_gleich: true, kunde_name: o.kunde ?? "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", ...(o.ku ? { kleinunternehmer: true } : {}), positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: o.preis ?? "100,00", satz: o.ku ? "0" : (o.satz ?? "19") }] }, t(datum));
  return ausgeben(s2, id, t(datum));
}
const u = (s: Stand, id: string) => s.unterlagen.find((x) => x.id === id)!;

/** Erwerb aus Frankreich (Waren, 1.000 € netto zu 19 %), Belegdatum `datum` */
const erwerb = (o: Partial<Beleg> = {}): Beleg =>
  ({ id: "ige1", datum: "2026-05-12", lieferant: "Fournitures SARL", nummer: "F-77", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100000 }], vorsteuer: true, zahlung: "bank", bezahlt: "2026-05-20", notiz: null, quelle: "hand", erstellt: "2026-05-12T09:00:00.000Z", geaendert: "2026-05-12T09:00:00.000Z", steuerschuld: "ige", lieferant_ust_idnr: "FR12345678901", ...o }) as Beleg;

const va = (s: Stand, p: string) => umsaetzeFuer(s.unterlagen, p, s.betrieb, s.betrieb.versteuerung === "ist" ? "ist" : "soll", s.belege, typeof s.profil["ust.kleinunternehmer"] === "boolean" ? (s.profil["ust.kleinunternehmer"] as boolean) : undefined, undefined, { profil: s.profil, schwelleEuro: SCHWELLE })!;

describe("Kleinunternehmer mit Erwerbsbesteuerung und uneinbringlicher Forderung im selben Zeitraum", () => {
  /** Kleinunternehmer mit Verzicht auf die Erwerbsschwelle: Erwerb im Mai, eigene Rechnung (ohne Steuer) im März, im Mai uneinbringlich */
  function kuFall(): Stand {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, profil: { "ust.kleinunternehmer": true, [VERZICHT_FELD]: true } };
    s = re(s, "k1", "2026-03-10", { ku: true, preis: "500,00" });
    s = zahlungVermerken(s, "k1", { datum: "2026-04-01", betrag_cent: 20000 }, t("2026-04-01"), "zk");
    s = uneinbringlichSetzen(s, "k1", { datum: "2026-05-15", grund: "insolvenz" }, t("2026-05-16"));
    return belegSetzen(s, erwerb(), t("2026-05-12"));
  }

  it("Voranmeldung Mai: Erwerb in Kz 89 ohne Kz 61 (Voranmeldung nach § 18 Abs. 4a UStG), keine Berichtigung der Kleinunternehmer-Rechnung", () => {
    const s = kuFall();
    expect(perioden(s.unterlagen, s.betrieb, "soll", s.belege)).toContain("2026-05");
    const r = va(s, "2026-05");
    expect(r.kleinunternehmer).toBe(true);
    expect(r.kuVoranmeldungPflicht).toBe(true);
    expect(r.werte).toMatchObject({ ige_19: "1.000,00", vorsteuer_ige: "" });
    expect(r.uneinbringlich).toEqual([]);
    expect(r.werte.annahmen ?? "").not.toContain("uneinbringlich");
    const h = dokumentHtml(vorlageFuer("ust_voranmeldung")!, { versteuerung: "soll", ...r.werte }, s.betrieb);
    expect(h).toMatch(/<span>89<\/span>/);
    expect(h).not.toMatch(/<span>61<\/span>/);
  });

  it("Steuerberater-Paket Mai: Erwerb mit Steuer ohne Vorsteuer im Stapel; uneinbringliche Kleinunternehmer-Forderung mit dem am Tag offenen Betrag, ohne Umsatzsteuer und ohne Satz über eine Berichtigung", () => {
    const s = kuFall();
    const p = steuerpaket(s, { von: "2026-05-01", bis: "2026-05-31", name: "2026-05" }, SB, {}, "2026-06-10T08:00:00.000Z");
    expect(datei(p, "Buchungsliste_2026-05.csv")).toMatch(/1000,00;H;1610;3435;;/);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("§ 18 Abs. 4a UStG");
    // offen am 15.05.: 500 € − 200 € Teilzahlung
    const csv = datei(p, "Uneinbringlich_2026-05.csv");
    expect(csv).toContain(";300,00;0,00;");
    expect(l).toContain("RE 2026-001 (Muster GmbH) seit 15.05.2026, Insolvenz des Kunden, offen 300,00 € brutto, davon Umsatzsteuer 0,00 €");
    // die Voranmeldung der App berichtigt hier nichts – der Text darf nichts anderes sagen
    expect(l).not.toContain("Die Voranmeldung der App mindert Umsatz und Steuer");
    expect(l).toContain("Ohne Umsatzsteuerberichtigung in der Voranmeldung der App: RE 2026-001 (Kleinunternehmer-Rechnung).");
    // E-232 (T-333): EÜR – keine Ausbuchung im Stapel (nur die Liste), ohne Satz über eine Umsatzsteuerberichtigung
    expect(l).toContain("Einnahmen-Überschuss-Rechnung: keine Ausbuchung (es ist nichts zugeflossen).");
  });

  it("Rechnung mit Umsatzsteuer aus der Zeit vor dem Wechsel, im Kleinunternehmer-Zeitraum uneinbringlich: nicht still übergangen", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, profil: { "ust.kleinunternehmer": false } };
    s = re(s, "r0", "2025-11-20", { preis: "1.000,00" });
    s = { ...s, profil: { "ust.kleinunternehmer": true, [VERZICHT_FELD]: true } };
    s = uneinbringlichSetzen(s, "r0", { datum: "2026-05-15", grund: "insolvenz" }, t("2026-05-16"));
    s = belegSetzen(s, erwerb(), t("2026-05-12"));
    const r = va(s, "2026-05");
    expect(r.kleinunternehmer).toBe(true);
    expect(r.werte).toMatchObject({ ige_19: "1.000,00" });
    // die App berichtigt in einem Kleinunternehmer-Zeitraum nicht (E-229) – sagt es aber auf der Voranmeldung
    expect(r.uneinbringlich).toEqual([]);
    expect(r.uneinbringlichNicht).toEqual([{ nummer: "2025-001", netto_cent: 100000, tag: "2026-05-15" }]);
    expect(r.werte.annahmen).toContain("Rechnung 2025-001 (mit Umsatzsteuer gestellt): Forderung seit 15.05.2026 uneinbringlich, offen 1.000,00 € netto – in diesem Kleinunternehmer-Zeitraum");
    const p = steuerpaket(s, { von: "2026-05-01", bis: "2026-05-31", name: "2026-05" }, SB, {}, "2026-06-10T08:00:00.000Z");
    const l = datei(p, "LIESMICH.txt");
    expect(l).not.toContain("Die Voranmeldung der App mindert Umsatz und Steuer");
    expect(l).toContain("offen 1.190,00 € brutto, davon Umsatzsteuer 190,00 €");
    expect(l).toContain("Ohne Umsatzsteuerberichtigung in der Voranmeldung der App: RE 2025-001 (Kleinunternehmer-Zeitraum");
    // in der Oberfläche als Warnung
    const ablauf = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/seiten/Ablauf.tsx"), "utf8");
    expect(ablauf).toContain("r.uneinbringlichNicht.length ? <Hinweis art=\"warnung\" text={TEXT.e229_uneinbringlich_ku(r.uneinbringlichNicht.length)} />");
    // ohne Erwerb: der Zeitraum steht trotzdem zur Auswahl, der Hinweis auf der Voranmeldung ebenso
    const ohneErwerb: Stand = { ...s, belege: [] };
    expect(perioden(ohneErwerb.unterlagen, ohneErwerb.betrieb, "soll", [])).toContain("2026-05");
    const r2 = va(ohneErwerb, "2026-05");
    expect(r2.kuVoranmeldungPflicht).toBe(false);
    expect(r2.uneinbringlichNicht).toHaveLength(1);
    expect(r2.werte.annahmen).toContain("Rechnung 2025-001 (mit Umsatzsteuer gestellt)");
    expect(r2.werte).not.toHaveProperty("ige_19");
  });

  it("Regelbesteuerung: ein Zeitraum nur mit der Uneinbringlichkeit (ohne weitere Rechnungen und Belege) lässt sich übernehmen; Ist nicht", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, profil: { "ust.kleinunternehmer": false } };
    s = re(s, "r0", "2026-01-20", { preis: "1.000,00" });
    s = uneinbringlichSetzen(s, "r0", { datum: "2026-08-15", grund: "insolvenz" }, t("2026-08-16"));
    expect(perioden(s.unterlagen, s.betrieb, "soll")).toEqual(expect.arrayContaining(["2026-08", "2026-Q3"]));
    expect(va(s, "2026-08").werte.umsatz_19).toBe("-1.000,00");
    expect(perioden(s.unterlagen, s.betrieb, "ist")).not.toContain("2026-08");
  });
});

describe("Regelbesteuerung: Erwerb in fremder Währung, Überzahlung und uneinbringliche Forderung im selben Zeitraum", () => {
  /** Juni: Erwerb in USD (umgerechnet 920,00 €, gezahlt 935,40 €), zweiter Erwerb ohne Kurs; r1 überzahlt, r2 mit dem Guthaben verrechnet, r3 uneinbringlich */
  function fall(versteuerung = "soll"): Stand {
    let s: Stand = { ...LEERER_STAND, betrieb: { ...BETRIEB, versteuerung }, steuerberatung: SB, profil: { "ust.kleinunternehmer": false } };
    s = re(s, "r1", "2026-06-02");
    s = re(s, "r2", "2026-06-05");
    s = re(s, "r3", "2026-06-08", { kunde: "Pleite AG", preis: "400,00" });
    s = zahlungVermerken(s, "r1", { datum: "2026-06-10", betrag_cent: 15000 }, t("2026-06-10"), "z1");
    s = guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-06-20", 3100, t("2026-06-20"), "v1");
    s = uneinbringlichSetzen(s, "r3", { datum: "2026-06-25", grund: "vollstreckung" }, t("2026-06-26"));
    s = belegSetzen(s, erwerb({ id: "usd", datum: "2026-06-03", bezahlt: "2026-06-15", steuer: [{ satz: 19, brutto_cent: 92000 }], fremd: { waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 100000 }], ust: 0, kurs: 1.087, kurs_datum: "2026-06-01", gezahlt_eur_cent: 93540 } }), t("2026-06-03"));
    s = belegSetzen(s, erwerb({ id: "chf", nummer: "CH-9", datum: "2026-06-04", bezahlt: "2026-06-16", steuer: [], lieferant_ust_idnr: "IT12345678901", fremd: { waehrung: "SEK", steuer: [{ satz: 19, brutto_cent: 500000 }], ust: 0, kurs: null, kurs_datum: null, gezahlt_eur_cent: 44000 } }), t("2026-06-04"));
    return s;
  }

  it("Voranmeldung (Soll): Erwerb umgerechnet in Kz 89/61, „Nicht vollständig“ für den Erwerb ohne Euro-Betrag, Überzahlung kein Umsatz, r3 gemindert", () => {
    const s = fall();
    const r = va(s, "2026-06");
    // r1 + r2 + r3 (100 + 100 + 400) − r3 uneinbringlich (400): die Überzahlung zählt nicht
    expect(r.werte.umsatz_19).toBe("200,00");
    expect(r.werte).toMatchObject({ ige_19: "920,00", vorsteuer_ige: "174,80" });
    expect(r.igeOhneEuro).toBe(1);
    expect(r.werte.unvollstaendig).toContain("Nicht vollständig");
    expect(r.uneinbringlich).toEqual([{ nummer: "2026-003", netto_cent: -40000, tag: "2026-06-25" }]);
    expect(r.werte.annahmen).toContain("Rechnung 2026-003: Forderung seit 25.06.2026 uneinbringlich – Umsatz um 400,00 €");
  });

  it("Voranmeldung (Ist): r1 mit dem offenen Betrag, r2 mit der Verrechnung, keine Berichtigung für r3", () => {
    const s = fall("ist");
    const r = va(s, "2026-06");
    // r1 119 € → 100 € netto; r2 31 € verrechnet → 26,05 € netto
    expect(r.werte.umsatz_19).toBe("126,05");
    expect(r.uneinbringlich).toEqual([]);
    expect(r.werte).toMatchObject({ ige_19: "920,00" });
  });

  it("EÜR: Erwerb mit dem gezahlten Euro-Betrag (ohne Abzug – die Erwerbsteuer ist nicht gezahlt), Vorsteuer aus dem Erwerb nur als Zeile; Einnahmen ohne Überzahlung", () => {
    const s = fall("ist");
    const e = euerUebernahme(s, "2026");
    // Waren: 935,40 € + 440,00 € (Erwerb ohne Kurs, gezahlt laut Kontoauszug)
    expect(e.ausgaben.find((z) => /Waren/.test(z.text ?? ""))!.betrag).toBe("1.375,40");
    // E-232 (Steuerberater 27.10.2026, T-332): Einnahmen 119 € von r1 (100 € netto) und die Überzahlung 31 € am Tag des
    // Geldeingangs; die Verrechnung an r2 ist kein neuer Zufluss (vorher 126,05 € netto mit der Verrechnung)
    expect(e.einnahmen.find((z) => z.text === "Umsätze aus Rechnungen (netto)")!.betrag).toBe("100,00");
    expect(e.einnahmen.find((z) => (z.text ?? "").startsWith("Überzahlungen von Kunden"))!.betrag).toBe("31,00");
  });

  it("Steuerberater-Paket: Erwerbskonten, Kursdifferenz des Erwerbs, Guthaben- und Uneinbringlich-Liste nebeneinander", () => {
    const s = fall();
    const p = steuerpaket(s, { von: "2026-06-01", bis: "2026-06-30", name: "2026-06" }, SB, {}, "2026-07-10T08:00:00.000Z");
    const l = datei(p, "LIESMICH.txt");
    expect(datei(p, "Buchungsliste_2026-06.csv")).toMatch(/920,00;H;1610;3425;;/);
    // E-232 (T-331): Kursdifferenz als eigene Zeile zum Zahltag
    expect(l).toContain("F-77: umgerechnet 920,00 €, gezahlt 935,40 € am 15.06.2026, Differenz 15,40 €");
    expect(datei(p, "Buchungsliste_2026-06.csv")).toMatch(/15\.06\.2026;15,40;H;1610;2150;;F-77;/);
    expect(l).toContain("Guthaben_2026-06.csv");
    expect(l).toContain("Uneinbringlich_2026-06.csv");
    expect(l).toContain("Die Voranmeldung der App mindert Umsatz und Steuer");
    expect(datei(p, "Guthaben_2026-06.csv")).toContain("Verrechnung (Zahlung der anderen Rechnung)");
    expect(datei(p, "Uneinbringlich_2026-06.csv")).toContain("2026-003;Pleite AG;08.06.2026;25.06.2026;Vollstreckung erfolglos;;476,00;76,00;");
  });
});

describe("Archiv, Prüfexport, Sicherung und Synchronisation tragen Original-PDFs, Guthaben und Uneinbringlichkeit zusammen", () => {
  /** r1 überzahlt (Guthaben an r2 verrechnet), r3 uneinbringlich – alle drei mit aufbewahrtem Original-PDF */
  async function stand(): Promise<{ s: Stand; ordner: Map<string, Uint8Array> }> {
    const ordner = new Map<string, Uint8Array>();
    let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, profil: { "ust.kleinunternehmer": false } };
    for (const [id, datum, kunde] of [["r1", "2026-06-02", "Muster GmbH"], ["r2", "2026-06-05", "Muster GmbH"], ["r3", "2026-06-08", "Pleite AG"]] as const) {
      const [s1] = anlegen(s, "rechnung", t(datum), id);
      s = felderSetzen(s1, id, { datum, leistung_gleich: true, kunde_name: kunde, kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "100,00", satz: "19" }] }, t(datum));
      const bytes = pdf(`Original ${id}`);
      const o = pdfOriginalFuer(`${id}pdf0001.pdf`, bytes, `${datum}T09:00:00.000Z`);
      ordner.set(o.datei, bytes);
      s = ausgeben(s, id, t(datum), undefined, o.sha256, undefined, false, undefined, o);
    }
    s = zahlungVermerken(s, "r1", { datum: "2026-06-10", betrag_cent: 15000 }, t("2026-06-10"), "z1");
    s = guthabenVerrechnen(s, "r1", "z1-ue", "r2", "2026-06-20", 3100, t("2026-06-20"), "v1");
    s = uneinbringlichSetzen(s, "r3", { datum: "2026-06-25", grund: "bestritten" }, t("2026-06-26"));
    return { s, ordner };
  }

  it("offenes Archiv und Steuerberater-Paket: die Originale (byte-genau) neben Guthaben.csv und Uneinbringlich.csv", async () => {
    const { s, ordner } = await stand();
    expect(s.unterlagen.every((x) => x.pdf)).toBe(true);
    const dateien = Object.fromEntries(dateienImStand(s).map((n) => [n, ordner.get(n)!]));
    const a = unzipSync(offenesArchiv(s, dateien, "2026-07-01T10:00:00.000Z", { rechnungsPdfs: { r1: pdf("neu"), r2: pdf("neu"), r3: pdf("neu") } }).zip);
    const rechnungen = Object.keys(a).filter((k) => k.startsWith("Rechnungen/")).sort();
    expect(rechnungen).toHaveLength(3);
    expect(rechnungen.map((k) => strFromU8(a[k]!))).toEqual(["r1", "r2", "r3"].map((id) => strFromU8(pdf(`Original ${id}`))));
    expect(strFromU8(a["Guthaben.csv"]!)).toContain("Überzahlung (Geldeingang, kein Umsatz)");
    expect(strFromU8(a["Uneinbringlich.csv"]!)).toContain("Forderung bestritten");
    expect(strFromU8(a["LIESMICH.txt"]!)).toContain("3 Original-PDF(s)");
    const stand2 = standAus(strFromU8(a["daten/stand.json"]!));
    expect(u(stand2, "r1").guthaben).toEqual(u(s, "r1").guthaben);
    expect(u(stand2, "r3").uneinbringlich).toEqual(u(s, "r3").uneinbringlich);
    expect(u(stand2, "r2").pdf).toEqual(u(s, "r2").pdf);
    // Steuerberater-Paket mit den PDFs, wie Steuerberatung.tsx sie über ausgabePdf holt
    const pdfs: Record<string, Uint8Array> = {};
    for (const x of s.unterlagen) pdfs[x.id] = (await ausgabePdf(x, async (n) => ordner.get(n) ?? null, async () => pdf("neu erzeugt"))).bytes!;
    const p = unzipSync(steuerpaket(s, { von: "2026-06-01", bis: "2026-06-30", name: "2026-06" }, SB, {}, "2026-07-10T08:00:00.000Z", { rechnungsPdfs: pdfs }).zip);
    const imPaket = Object.keys(p).filter((k) => k.startsWith("Rechnungen/")).sort();
    expect(imPaket.map((k) => strFromU8(p[k]!))).toEqual(["r1", "r2", "r3"].map((id) => strFromU8(pdf(`Original ${id}`))));
    expect(Object.keys(p)).toEqual(expect.arrayContaining(["Guthaben_2026-06.csv", "Uneinbringlich_2026-06.csv"]));
    // Prüfexport
    const px = unzipSync(pruefexport(s, {}, "2026-07-10T08:00:00.000Z").zip);
    expect(Object.keys(px)).toEqual(expect.arrayContaining(["Guthaben.csv", "Uneinbringlich.csv"]));
  });

  it("Sicherung (Container): Stand mit Guthaben, Verrechnung, Uneinbringlichkeit und allen drei PDFs; beim Einspielen abgelegt", async () => {
    const { s, ordner } = await stand();
    const K = schluesselAusPasswort("sonnenschein-2026", zufall, 1000);
    const stuecke: Uint8Array[] = [];
    const { fehlend } = await containerSchreiben({ schreiben: async (b) => void stuecke.push(b.slice()) }, s, K, zufall, { namen: dateienImStand(s), lesen: async (n) => ordner.get(n) ?? null }, new Date());
    expect(fehlend).toEqual([]);
    const bytes = Uint8Array.from(Buffer.concat(stuecke));
    const leser = async (): Promise<Leser> => {
      let pos = 0;
      return { lesen: async (n) => bytes.subarray(pos, (pos = Math.min(bytes.length, pos + n))) };
    };
    const g = await containerOeffnen(leser, "sonnenschein-2026");
    expect(u(g.stand, "r1").guthaben).toEqual(u(s, "r1").guthaben);
    expect(u(g.stand, "r2").zahlungen).toEqual(u(s, "r2").zahlungen);
    expect(u(g.stand, "r3").uneinbringlich).toEqual(u(s, "r3").uneinbringlich);
    expect(guthabenRest(g.stand, "r1", "z1-ue")).toBe(0);
    const abgelegt = new Map<string, Uint8Array>();
    expect((await g.dateien(async () => true, async (n, b) => void abgelegt.set(n, b))).fehler).toBe(0);
    expect([...abgelegt.keys()].sort()).toEqual(["r1pdf0001.pdf", "r2pdf0001.pdf", "r3pdf0001.pdf"]);
  });

  it("Synchronisation: Gerät A vermerkt Überzahlung und Verrechnung, Gerät B die Uneinbringlichkeit – zusammengeführt bleibt alles, auch die PDFs", async () => {
    const { s: basis } = await stand();
    // Ausgangsstand ohne Zahlungs- und Uneinbringlich-Vermerke auf beiden Geräten
    const ohne: Stand = { ...basis, unterlagen: basis.unterlagen.map((x) => { const { zahlungen: _z, bezahlt: _b, bezahltGeaendert: _g, guthaben: _gh, uneinbringlich: _ue, ...rest } = x; return rest; }) };
    let a = zahlungVermerken(ohne, "r1", { datum: "2026-06-10", betrag_cent: 15000 }, t("2026-06-10"), "z1");
    a = guthabenVerrechnen(a, "r1", "z1-ue", "r2", "2026-06-20", 3100, t("2026-06-20"), "v1");
    // Gerät B (ältere App-Version ohne PDF-Feld an r3) vermerkt r3 als uneinbringlich
    const bRoh = uneinbringlichSetzen(ohne, "r3", { datum: "2026-06-25", grund: "bestritten" }, t("2026-06-26"));
    const b: Stand = { ...bRoh, unterlagen: bRoh.unterlagen.map((x) => (x.id === "r3" ? (({ pdf: _p, ...rest }) => rest)(x) : x)) };
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const z = syncZusammenfuehren(x, y, t("2026-06-27")).stand;
      expect(u(z, "r1").guthaben).toEqual(u(a, "r1").guthaben);
      expect(u(z, "r2").zahlungen).toEqual(u(a, "r2").zahlungen);
      expect(u(z, "r3").uneinbringlich).toEqual(u(b, "r3").uneinbringlich);
      expect(z.unterlagen.map((x2) => x2.pdf?.datei).sort()).toEqual(["r1pdf0001.pdf", "r2pdf0001.pdf", "r3pdf0001.pdf"]);
      expect(dateienImStand(z).filter((n) => n.endsWith(".pdf")).sort()).toEqual(["r1pdf0001.pdf", "r2pdf0001.pdf", "r3pdf0001.pdf"]);
      expect(z.unterlagen.some((x2) => x2.konfliktKopieVon)).toBe(false);
      // Voranmeldung nach dem Zusammenführen wie auf einem Gerät mit allen Vermerken
      expect(va(z, "2026-06").werte.umsatz_19).toBe(va(basis, "2026-06").werte.umsatz_19);
    }
  });
});
