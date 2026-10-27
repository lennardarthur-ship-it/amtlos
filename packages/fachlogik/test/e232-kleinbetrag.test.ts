/**
 * E-232 (T-327, Steuerberater 27.10.2026): Kleinbetragsrechnung an Privatpersonen im EU-Ausland.
 * (a) Kleinunternehmer: richtig, wenn der Ort der Leistung in Deutschland liegt; der Hinweis auf die
 *     Kleinunternehmerregelung muss auch auf der Kleinbetragsrechnung stehen.
 * (b) 0-%-Position mit Befreiung im Inland (z. B. § 4 Nr. 14 UStG): Vereinfachung erlaubt; nach § 33 Satz 1 Nr. 4 UStDV
 *     steht statt des Steuersatzes der Hinweis auf die Befreiung auf der Rechnung. Ohne einen solchen Hinweis volle Angaben.
 */
import { describe, expect, it } from "vitest";
import { KU_HINWEIS, LEERER_BETRIEB, dokumentHtml, kleinbetrag, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";

const BETRIEB: Betrieb = { ...LEERER_BETRIEB, name: "Praxis Nord", strasse: "Hafen 1", plz: "20457", ort: "Hamburg", steuernummer: "12/345/67890", ust_idnr: "DE123456789", bundesland: "Hamburg" };
const v = vorlageFuer("rechnung")!;
const pos = [{ bezeichnung: "Behandlung", menge: "1", preis: "100", satz: "0" }];
const NL: Daten = { nummer: "2026-101", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", positionen: pos, kunde_name: "Jan de Vries", kunde_anschrift: "Dam 1\n1012 Amsterdam\nNiederlande" };
const html = (d: Daten) => dokumentHtml(v, d, BETRIEB).replace(/\u00a0|&nbsp;/g, " ");
const HEIL = "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG";

describe("E-232 (T-327): Kleinbetragsrechnung an Privatpersonen im EU-Ausland", () => {
  it("(a) Kleinunternehmer: Vereinfachung und der Hinweis auf § 19 UStG steht auf der Rechnung", () => {
    const d: Daten = { ...NL, kleinunternehmer: true, positionen: [{ ...pos[0]!, satz: "19" }] };
    expect(kleinbetrag(d)).toBe(true);
    const h = html(d);
    expect(h).toContain(KU_HINWEIS);
    expect(h).not.toContain("Leistungsdatum");
    // auch im Inland
    expect(html({ ...d, kunde_anschrift: "Elbe 2\n20095 Hamburg" })).toContain(KU_HINWEIS);
  });

  it("(b) 0 % mit Befreiung im Inland (§ 4 Nr. 14 UStG): Vereinfachung, Befreiungshinweis gedruckt", () => {
    const d: Daten = { ...NL, befreiung: HEIL };
    expect(kleinbetrag(d)).toBe(true);
    const h = html(d);
    expect(h).toContain(HEIL);
    expect(h).not.toContain("Leistungsdatum");
    // gemischt mit 19 %: ebenfalls, der Befreiungshinweis steht für die 0-%-Position
    const g: Daten = { ...d, positionen: [pos[0]!, { bezeichnung: "Pflegeprodukt", menge: "1", preis: "20", satz: "19" }] };
    expect(kleinbetrag(g)).toBe(true);
    expect(html(g)).toContain(HEIL);
    // langer Hinweis (unter „Hinweise“ statt in der Summenzeile) wird ebenfalls gedruckt
    const lang = `${HEIL}. Die Leistung ist eine Heilbehandlung im Bereich der Humanmedizin, erbracht in Hamburg.`;
    expect(kleinbetrag({ ...d, befreiung: lang })).toBe(true);
    expect(html({ ...d, befreiung: lang })).toContain(lang);
  });

  it("(b) ohne Befreiungshinweis im Inland: volle Angaben", () => {
    expect(kleinbetrag(NL)).toBe(false);
    expect(kleinbetrag({ ...NL, befreiung: "Nicht im Inland steuerbare Leistung" })).toBe(false);
    expect(html({ ...NL, befreiung: "Nicht im Inland steuerbare Leistung" })).toContain("Leistungsdatum");
    // Nullsteuersatz (§ 12 Abs. 3 UStG) ist keine Befreiung – unverändert volle Angaben
    expect(kleinbetrag({ ...NL, positionen: [{ ...pos[0]!, satz: "nullsatz" }] })).toBe(false);
    // § 13b, igL, OSS bleiben ohne Vereinfachung
    expect(kleinbetrag({ ...NL, befreiung: HEIL, hinweise: ["igl"] })).toBe(false);
    expect(kleinbetrag({ ...NL, befreiung: "Steuerschuldnerschaft (§ 13b UStG)" })).toBe(false);
    expect(kleinbetrag({ ...NL, befreiung: HEIL, oss: true, oss_satz: "21" })).toBe(false);
  });
});
