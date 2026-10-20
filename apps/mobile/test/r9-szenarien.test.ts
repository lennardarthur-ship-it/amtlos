/**
 * Befunde „(a) jetzt behebbar“ aus den Jahres-Szenarien Shop, Praxis und Elektro (Runde 9): USt-Zuordnung, Kennzahlen,
 * Shop-Hinweise, Fragen im Paket, Zahlungserinnerung, Kontrollmappe und Pflichten-Check.
 */
import { describe, expect, it } from "vitest";
import { VORSTEUER_AUFTEILEN, type Beleg } from "@amtlos/fachlogik";
import { auswertung, type Profil } from "../src/pflichten/check";
import { mappenAuswahl } from "../src/unterlagen/kontrollmappe";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, felderSetzen, type Stand } from "../src/unterlagen/speicher";
import { EUER_NICHT_ENTHALTEN, EUER_SHOP_NICHT_ENTHALTEN, euerUebernahme, fragenText, kassenHinweis, kassenLage, kassenSatzPaket } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";
import { T as TEXT } from "../src/texte";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const B = { ...LEERER_STAND.betrieb, name: "Kerzenwerk", strasse: "Weg 1", plz: "20095", ort: "Hamburg", email: "a@b.example", steuernummer: "1", ust_idnr: "DE123456789", iban: "DE89370400440532013000" };
function rechnung(s: Stand, id: string, datum: string, felder: Record<string, unknown>, bezahlt?: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  let s2 = felderSetzen(s1, id, { datum, nummer: id, kunde_name: "Kundin", kunde_anschrift: "Weg 2\n20095 Hamburg", positionen: [{ bezeichnung: "X", menge: "1", preis: "100,00", satz: "19" }], ...felder }, t(datum));
  s2 = ausgeben(s2, id, t(datum));
  return bezahlt ? bezahltSetzen(s2, id, bezahlt) : s2;
}
const beleg = (id: string, datum: string, o: Partial<Beleg>): Beleg => ({ id, datum, lieferant: "Lieferant", nummer: id, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: `${datum}T08:00:00Z`, geaendert: `${datum}T08:00:00Z`, ...o });

describe("Umsatzsteuer aus Rechnungen (Szenarien Shop, Elektro, Praxis)", () => {
  it("Soll: Zahlung vor der Leistung zählt im Monat der Zahlung, Stornos nicht", () => {
    const s = rechnung({ ...LEERER_STAND, betrieb: B }, "r15", "2026-10-20", { leistung_gleich: false, leistung: "16.11.2026" }, "2026-10-30");
    expect(umsaetzeFuer(s.unterlagen, "2026-10", B, "soll")!.werte.umsatz_19).toBe("100,00");
    expect(umsaetzeFuer(s.unterlagen, "2026-11", B, "soll")!.werte.umsatz_19).toBe("0,00");
    // bezahlt nach der Leistung: Leistungsmonat
    const s2 = rechnung({ ...LEERER_STAND, betrieb: B }, "r16", "2026-10-20", { leistung_gleich: false, leistung: "16.11.2026" }, "2026-11-30");
    expect(umsaetzeFuer(s2.unterlagen, "2026-11", B, "soll")!.werte.umsatz_19).toBe("100,00");
  });
  it("Soll: Leistungszeitraum zählt mit seinem Ende", () => {
    const s = rechnung({ ...LEERER_STAND, betrieb: B }, "r9", "2026-07-03", { leistung_gleich: false, leistung: "01.06.–30.06.2026" });
    const q2 = umsaetzeFuer(s.unterlagen, "2026-Q2", B, "soll")!;
    expect(q2.werte.umsatz_19).toBe("100,00");
    expect(q2.ersatz).toBe(0);
  });
  it("0 % nach Kennzahl: igL → Kz 41, § 13b → Kz 60, § 4 Nr. 14 → Kz 48; Vorsteuer prüfen bei Kz 48", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    const null0 = [{ bezeichnung: "X", menge: "1", preis: "100,00", satz: "0" }];
    s = rechnung(s, "a", "2026-03-02", { hinweise: ["igl"], kunde_ust_idnr: "ATU1", positionen: null0 });
    s = rechnung(s, "b", "2026-03-03", { hinweise: ["reverse_charge"], kunde_ust_idnr: "DE2", positionen: [{ ...null0[0], preis: "200,00" }] });
    s = rechnung(s, "c", "2026-03-04", { befreiung: "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG", positionen: [{ ...null0[0], preis: "300,00" }] });
    s = rechnung(s, "d", "2026-03-05", { befreiung: "Nullsteuersatz nach § 12 Abs. 3 UStG", positionen: [{ ...null0[0], preis: "400,00" }] });
    const u = umsaetzeFuer(s.unterlagen, "2026-03", B, "soll", [beleg("b1", "2026-03-10", {})])!;
    expect(u.werte).toMatchObject({ umsatz_igl: "100,00", umsatz_13b: "200,00", umsatz_48: "300,00", umsatz_frei: "400,00" });
    expect(u.vorsteuerPruefen).toBe(true);
    // Fragen im Paket: Vorsteuer bei steuerfreien Umsätzen
    const f = fragenText({ ...s, belege: [beleg("b1", "2026-03-10", {})] }, { von: "2026-03-01", bis: "2026-03-31", name: "2026-03" });
    expect(f.text).toContain(VORSTEUER_AUFTEILEN);
  });
  it("Fragen im Paket: Beleg ohne Umsatzsteuer für Fremdleistung ⇒ Frage nach § 13b", () => {
    const s = { ...LEERER_STAND, betrieb: B, belege: [beleg("sub", "2026-09-10", { kategorie: "fremdleistungen", steuer: [{ satz: 0, brutto_cent: 50000 }], vorsteuer: false, bezahlt: "2026-09-12" }), beleg("vers", "2026-09-11", { kategorie: "versicherungen", steuer: [{ satz: 0, brutto_cent: 10000 }], vorsteuer: false, bezahlt: "2026-09-12" })] };
    const f = fragenText(s, { von: "2026-09-01", bis: "2026-09-30", name: "2026-09" }).text;
    expect(f).toContain("§ 13b UStG");
    expect(f).toContain("500,00 € brutto");
    expect(f).not.toContain("100,00 € brutto");
  });
});

describe("Shop und Marktstand ohne Kasse (Szenario Shop)", () => {
  it("Verkaufswege laut Check lösen die Warnung aus", () => {
    expect(kassenLage({ "vertrieb.kanaele": ["onlineshop"], "kasse.elektronisch": false })).toBe("shop");
    expect(kassenLage({ "vertrieb.kanaele": ["marktstand"], "kasse.elektronisch": true })).toBe("kasse_shop");
    expect(kassenLage({ "vertrieb.kanaele": ["vor_ort_beim_kunden"], "kasse.elektronisch": false })).toBe("keine");
    expect(kassenHinweis("shop", "ust")).toEqual({ text: TEXT.shop_ust, warnung: true });
    expect(kassenHinweis("kasse_shop", "euer")!.text).toMatch(/Kasseneinnahmen und die Einnahmen aus Onlineshop/);
    expect(kassenSatzPaket("shop")).toMatch(/Shop-, Plattform- und Zahlungsberichte/);
    const s = rechnung({ ...LEERER_STAND, betrieb: B, profil: { "vertrieb.kanaele": ["onlineshop"] } }, "r1", "2026-03-02", {}, "2026-03-05");
    expect(euerUebernahme(s, "2026").hinweis).toBe(`${EUER_NICHT_ENTHALTEN} ${EUER_SHOP_NICHT_ENTHALTEN}`);
  });
});

describe("Zahlungserinnerung (Szenario Elektro)", () => {
  const o = { nummer: "2026-023", betrag: "1.234,00 €", faellig: "17.11.2026", iban: "DE75440501991128830456", absender: "Jens Brandt" };
  it("IBAN in Vierergruppen, Verwendungszweck „Rechnung …“, Anrede nach Empfänger", () => {
    const firma = TEXT.erinnerung_text({ ...o, kunde: "Hausverwaltung Rüdiger Lenz" });
    expect(firma).toContain("IBAN DE75 4405 0199 1128 8304 56, Verwendungszweck: Rechnung 2026-023");
    expect(firma).toContain("Sehr geehrte Damen und Herren,");
    expect(TEXT.erinnerung_text({ ...o, kunde: "Hochbau Kemper GmbH" })).toContain("Sehr geehrte Damen und Herren,");
    expect(TEXT.erinnerung_text({ ...o, kunde: "Sabine Kowalski" })).toContain("Guten Tag Sabine Kowalski,");
  });
});

describe("Kontrollmappe: Prüfprotokolle je Einsatzbereich (Szenario Elektro)", () => {
  it("nimmt das neueste Protokoll je Einsatzbereich", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    for (const [id, datum, einsatz] of [["p1", "2026-02-01", "baustellen"], ["p2", "2026-03-01", "werkstatt"], ["p3", "2026-04-01", "baustellen"]] as const) {
      const [s1] = anlegen(s, "pruefprotokoll_elektro", t(datum), id);
      s = ausgeben(felderSetzen(s1, id, { datum, einsatz, pruefer: "X" }, t(datum)), id, t(datum));
    }
    expect(mappenAuswahl(s).eintraege.map((e) => e.id).sort()).toEqual(["p2", "p3"]);
  });
});

describe("Pflichten-Check (Szenarien Shop, Praxis, Elektro)", () => {
  const basis: Profil = { rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "HH", gruendungsdatum: "2020-01-01", "beschaeftigte.gesamt": 1, "beschaeftigte.minijob": 1 };
  const gilt = (p: Profil, tag = "2026-01-15") => auswertung(p, tag).gilt.map((x) => x.id);
  it("Lohnsteuer-Anmeldung entfällt bei „keine“ (nur Minijob mit Pauschsteuer)", () => {
    expect(gilt({ ...basis, "personal.lohnsteuer_anmeldezeitraum": "monatlich" })).toContain("personal.lohnsteuer_anmeldung");
    expect(gilt({ ...basis, "personal.lohnsteuer_anmeldezeitraum": "keine" })).not.toContain("personal.lohnsteuer_anmeldung");
    expect(gilt({ ...basis, "personal.lohnsteuer_anmeldezeitraum": "keine" })).not.toContain("personal.anmeldezeitraum_angeben");
  });
  it("Bauabzugsteuer im Handwerk nur mit Bauleistungen für Unternehmen", () => {
    const hw = { ...basis, "taetigkeit.branchen": ["handwerk"] };
    expect(gilt({ ...hw, "bauleistungen.fuer_unternehmen": true })).toContain("steuern.bauabzugsteuer_freistellung");
    expect(gilt({ ...hw, "bauleistungen.fuer_unternehmen": false })).not.toContain("steuern.bauabzugsteuer_freistellung");
  });
  it("Freiberufler über den Grenzen des § 141 AO: EÜR statt doppelter Buchführung", () => {
    const p = { ...basis, "taetigkeit.einordnung": "freiberuf", "umsatz.vorjahr": 900000, "gewinn.vorjahr": 120000 };
    expect(gilt(p)).toContain("steuern.euer");
    expect(gilt(p)).not.toContain("steuern.buchfuehrungspflicht");
  });
  it("kommende Pflichten im 12-Monats-Blick (Widerrufsbutton ab 19.06.2026)", () => {
    const shop = { ...basis, "kunden.segmente": ["b2c"], "vertrieb.kanaele": ["onlineshop"] };
    const a = auswertung(shop, "2026-01-15");
    expect(a.gilt.map((x) => x.id)).not.toContain("online.widerrufsbutton");
    expect(a.kommend.find((x) => x.id === "online.widerrufsbutton")?.naechsterTermin).toBe("2026-06-19");
  });
});
