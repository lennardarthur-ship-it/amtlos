/**
 * Befunde „(a) jetzt behebbar“ aus den Jahres-Szenarien Shop, Praxis und Elektro (Runde 9).
 */
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, dokumentHtml, eRechnungAus, einheitCode, einheitFuerMenge, faelligAm, fehlendeAngaben, kennzahlBefreiung, leistungszeitraumAus, unterlagenName, vorlageFuer, xrechnungUbl, type Betrieb, type Daten } from "../src/index.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Elektro Brandt", strasse: "Wittbräucker Straße 214", plz: "44287", ort: "Dortmund", verantwortlich: "Jens Brandt", email: "info@elektro.example", telefon: "0231 1", steuernummer: "317/5048/2193", ust_idnr: "DE297641853", iban: "DE75440501991128830456", bundesland: "NW" };
const html = (id: string, d: Daten, b: Betrieb = B) => dokumentHtml(vorlageFuer(id)!, d, b).replace(/&nbsp;|\u00a0/g, " ");
const RE: Daten = { nummer: "2026-003", datum: "2026-02-12", zahlungsziel: "14", kunde_name: "Hochbau Kemper GmbH", kunde_anschrift: "Hafenweg 1\n44147 Dortmund", kunde_email: "rechnung@kemper.example", positionen: [{ bezeichnung: "Elektroinstallation", menge: "12,5", einheit: "Std.", preis: "68", satz: "19" }] };

describe("Leistungszeitraum und E-Rechnung (Szenario Elektro)", () => {
  it("erkennt Zeiträume und Kalendermonate", () => {
    expect(leistungszeitraumAus("12.01.–11.02.2026")).toEqual({ von: "2026-01-12", bis: "2026-02-11" });
    expect(leistungszeitraumAus("02.03.2026 – 27.03.2026")).toEqual({ von: "2026-03-02", bis: "2026-03-27" });
    expect(leistungszeitraumAus("15.12. bis 15.01.2027")).toEqual({ von: "2026-12-15", bis: "2027-01-15" });
    expect(leistungszeitraumAus("Oktober 2026")).toEqual({ von: "2026-10-01", bis: "2026-10-31" });
    expect(leistungszeitraumAus("Februar 2028")).toEqual({ von: "2028-02-01", bis: "2028-02-29" });
    expect(leistungszeitraumAus("30.02.–01.03.2026")).toBeNull();
    expect(leistungszeitraumAus("nach Absprache")).toBeNull();
  });
  it("überträgt den Zeitraum als BT-73/74 statt die E-Rechnung zu verweigern", () => {
    const { daten, fehlt } = eRechnungAus({ ...RE, leistung_gleich: false, leistung: "12.01.–11.02.2026" }, B);
    expect(fehlt).toEqual([]);
    expect(daten.leistungsdatum).toBeNull();
    const xml = xrechnungUbl(daten, "");
    expect(xml).toMatch(/<cac:InvoicePeriod>\s*<cbc:StartDate>2026-01-12<\/cbc:StartDate>\s*<cbc:EndDate>2026-02-11<\/cbc:EndDate>/);
    expect(xml.indexOf("<cac:InvoicePeriod>")).toBeLessThan(xml.indexOf("<cac:AccountingSupplierParty>"));
    // mit Leistungsdatum bleibt es beim Lieferdatum
    expect(xrechnungUbl(eRechnungAus({ ...RE, leistung_gleich: true }, B).daten, "")).not.toContain("InvoicePeriod");
  });
  it("Einheiten: Kurzformen und Mehrzahl für die E-Rechnung, Mehrzahl auf der Rechnung", () => {
    expect(einheitCode("m")).toBe("MTR");
    expect(einheitCode("Std.")).toBe("HUR");
    expect(einheitCode("Stunden")).toBe("HUR");
    expect(einheitCode("Stk.")).toBe("C62");
    expect(einheitCode("m²")).toBe("MTK");
    expect(einheitFuerMenge("Behandlung", 6)).toBe("Behandlungen");
    expect(einheitFuerMenge("Besuch", 8)).toBe("Besuche");
    expect(einheitFuerMenge("Behandlung", 1)).toBe("Behandlung");
  });
  it("Fälligkeit am Feiertag oder Wochenende: nächster Werktag (§ 193 BGB)", () => {
    // 18.12.2026 + 14 Tage = Freitag 01.01.2027 (Neujahr) → Montag 04.01.2027
    expect(faelligAm("2026-12-18", 14, "NW")).toBe("2027-01-04");
    expect(faelligAm("2026-10-01", 14, "NW")).toBe("2026-10-15");
    // Fronleichnam 2026 (04.06.) nur in einigen Ländern
    expect(faelligAm("2026-05-21", 14, "NW")).toBe("2026-06-05");
    expect(faelligAm("2026-05-21", 14, "HH")).toBe("2026-06-04");
    expect(eRechnungAus({ ...RE, datum: "2026-12-18" }, B).daten.faellig_am).toBe("2027-01-04");
    expect(html("rechnung", { ...RE, datum: "2026-12-18" })).toContain("bis zum <strong>04.01.2027</strong>");
  });
});

describe("Rechnung: Pflichthinweise, Befreiung, schon bezahlt (Szenarien Shop, Praxis, Elektro)", () => {
  it("Pflichthinweis steht direkt unter den Summen, vor der Zahlungsaufforderung", () => {
    const h = html("rechnung", { ...RE, kunde_ust_idnr: "DE123456789", hinweise: ["reverse_charge"], positionen: [{ bezeichnung: "Installation", menge: "1", preis: "100", satz: "0" }] });
    expect(h).toMatch(/<\/table><div class="pflichthinweise"><p>[^<]*Steuerschuldnerschaft[^<]*<\/p><\/div><div class="abschluss"><div class="zahlung">/);
    expect(h).toContain(".g-brief .pflichthinweise { margin-top: 3mm; page-break-before: avoid;");
  });
  it("kurzer Befreiungsgrund steht in der Summenzeile, nicht noch einmal unter den Hinweisen", () => {
    const befreiung = "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG";
    const h = html("rechnung", { ...RE, befreiung, positionen: [{ bezeichnung: "Krankengymnastik", menge: "6", einheit: "Behandlung", preis: "25", satz: "0" }, { bezeichnung: "Theraband", menge: "1", preis: "10", satz: "19" }] });
    expect(h).toContain(`Umsatzsteuer 0 % (${befreiung}) auf 150,00 €`);
    expect(h.split(befreiung).length - 1).toBe(1);
    expect(h).toContain("6 Behandlungen");
    expect(h).not.toContain("siehe Hinweis");
  });
  it("schon bezahlt am oder vor dem Rechnungsdatum: keine Zahlungsaufforderung", () => {
    const bezahlt = html("rechnung", { ...RE, zahlungsziel: "sofort", bezahlt_am: "2026-02-10" });
    expect(bezahlt).not.toContain("Bitte überweisen Sie");
    expect(bezahlt).not.toContain("GiroCode");
    expect(bezahlt).toContain("Der Rechnungsbetrag wurde am 10.02.2026 bezahlt.");
    // später bezahlt: die Rechnung fordert weiter zur Zahlung auf
    expect(html("rechnung", { ...RE, bezahlt_am: "2026-02-20" })).toContain("Bitte überweisen Sie");
  });
  it("Auswahltext „Gutschrift“ erklärt die Abrechnung durch den Leistungsempfänger", () => {
    const f = vorlageFuer("rechnung")!.abschnitte.flatMap((a) => a.felder).find((x) => x.id === "hinweise")!;
    const o = (f as { optionen: { wert: string; text: string }[] }).optionen.find((x) => x.wert === "gutschrift")!;
    expect(o.text).toMatch(/^Gutschrift – Abrechnung durch den Leistungsempfänger \(§ 14 Abs\. 2 Satz 2 UStG\), keine Rechnungskorrektur/);
  });
});

describe("Voranmeldung: Kennzahlen ohne Umsatzsteuer (Szenarien Shop, Praxis, Elektro)", () => {
  it("Kz 41, 48 und 60 als eigene Zeilen, der Rest mit Hinweis auf 43/21/45/87", () => {
    const h = html("ust_voranmeldung", { zeitraum: "März 2026", umsatz_19: "100", umsatz_igl: "1303,80", umsatz_48: "40503,50", umsatz_13b: "500", umsatz_frei: "20", vorsteuer: "10" });
    for (const kz of ["41", "48", "60"]) expect(h).toContain(`<td class="kz"><span>${kz}</span></td>`);
    expect(h).toContain("87 Umsätze zum Nullsteuersatz");
    expect(h).toContain("Vorsteuer aus Eingangsleistungen, die diesen Umsätzen dienen, ist nicht abziehbar (§ 15 Abs. 2 UStG)");
    expect(html("ust_voranmeldung", { zeitraum: "März 2026", umsatz_19: "100", vorsteuer: "10" })).not.toContain("§ 15 Abs. 2");
  });
  it("Kz 48 nur bei Befreiungen nach § 4 Nr. 8 bis 29 UStG", () => {
    expect(kennzahlBefreiung("Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG")).toBe("48");
    expect(kennzahlBefreiung("steuerfrei nach § 4 Nr. 1 Buchst. a UStG (Ausfuhr)")).toBeNull();
    expect(kennzahlBefreiung("Nullsteuersatz nach § 12 Abs. 3 UStG")).toBeNull();
  });
});

describe("Weitere Vorlagen (Szenarien Shop, Praxis, Elektro)", () => {
  it("Impressum ohne leere Kammer-Zeile", () => {
    const h = html("impressum", { reglementiert: true, berufsbezeichnung: "Physiotherapeutin", regelungen: "MPhG" });
    expect(h).not.toContain("Kammer:");
    expect(html("impressum", { reglementiert: true, kammer: "Handwerkskammer Dortmund", berufsbezeichnung: "Elektrotechnikermeister", regelungen: "HwO" })).toContain("Kammer: Handwerkskammer Dortmund");
  });
  it("Datenschutzerklärung: Pflicht zur Bereitstellung mit Vertragsangaben (Art. 13 Abs. 2 lit. e DSGVO)", () => {
    expect(html("datenschutzerklaerung_website", { module: ["hosting"] })).toContain("sind diese für den Abschluss und die Erfüllung des Vertrags erforderlich");
  });
  it("Lohnkonto: pauschal versteuerter Minijob ohne Steuerklasse", () => {
    const v = vorlageFuer("lohnkonto")!;
    const d: Daten = { name: "Paula Krüger", jahr: "2026", geburtsdatum: "2001-02-03", anschrift: "x", steuer_id: "1", sv_nummer: "1", krankenkasse: "AOK", eintritt: "2025-09-01", pauschal: true };
    expect(fehlendeAngaben(v, d, B)).not.toContain("Steuerklasse");
    expect(fehlendeAngaben(v, { ...d, pauschal: false }, B)).toContain("Steuerklasse");
    expect(html("lohnkonto", d)).toContain("keine – Lohnsteuer pauschal (§ 40a EStG)");
  });
  it("Unterweisung mit Jugendlichen: halbjährlich (§ 29 Abs. 2 JArbSchG)", () => {
    const h = html("unterweisung", { thema: "Azubi", datum: "2026-07-20", jugendliche: true });
    expect(h).toContain("mindestens halbjährlich zu wiederholen (§ 29 Abs. 2 JArbSchG), nächster Termin spätestens am 20.01.2027");
    expect(html("unterweisung", { thema: "Alle", datum: "2026-07-20" })).toContain("nächster Termin spätestens am 20.07.2027");
  });
  it("Name der Unterlage: am Wortende gekürzt, Datum deutsch", () => {
    const v = vorlageFuer("avv")!;
    const name = unterlagenName(v, { [v.namensFeld!]: "Datenschutzinformation für Kundinnen und Kunden (Großhandel, Marktstand)" });
    expect(name).toMatch(/…$/);
    expect(name).not.toMatch(/Markts…|Gro…/);
    expect(unterlagenName(vorlageFuer("pruefprotokoll_elektro")!, { datum: "2026-03-01" })).toMatch(/ · 01\.03\.2026$/);
  });
});
