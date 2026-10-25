/**
 * E-193: Befunde der externen Prüfung – XRechnung „zahlbar sofort“ (BR-CO-25, Defekt 5), Storno einer Schlussrechnung
 * (Defekt 8b) und Angaben der GmbH & Co. KG auf Geschäftsbriefen und Rechnungen (Defekt 8a, §§ 125a, 177a HGB).
 * Die XML-Beispiele prüft zusätzlich der KoSIT-Validator in der CI (scripts/e-rechnung-beispiele.mjs).
 */
import { describe, expect, it } from "vitest";
import { buchungenAusRechnungen, datevExtf, type AusgangsRechnungFuerBuchung } from "../src/buchungen.js";
import { KU_HINWEIS, LEERER_BETRIEB, VORLAGEN_GEPRUEFT, dokumentHtml, eRechnungAus, fehlendeAngaben, fussSpalten, istCoKg, komplementaerAngabenFehlen, vorlageFuer, vorlagenPruefsumme, xrechnungUbl, type Betrieb, type Daten } from "../src/index.js";

const BETRIEB: Betrieb = { ...LEERER_BETRIEB, name: "Café Sonnenschein GmbH", rechtsform: "GmbH", registergericht: "Amtsgericht München", registernummer: "HRB 1", vertretung: "Maria Beispiel", strasse: "Marktplatz 3", plz: "80331", ort: "München", telefon: "+49 89 123456", email: "info@cafe.example", steuernummer: "143/123/45678", ust_idnr: "DE123456789", iban: "DE02120300000000202051", bundesland: "Bayern" };
const KUNDE = { kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example" };
const RE: Daten = { nummer: "2026-030", datum: "2026-10-12", leistung_gleich: true, ...KUNDE, positionen: [{ bezeichnung: "Catering", menge: "12", einheit: "Stück", preis: "14,50", satz: "7" }] };
const xml = (d: Daten, b = BETRIEB) => {
  const { daten, fehlt } = eRechnungAus(d, b);
  expect(fehlt).toEqual([]);
  return xrechnungUbl(daten, KU_HINWEIS);
};
const tag = (x: string, name: string) => new RegExp(`<cbc:${name}[^>]*>([^<]*)</cbc:${name}>`).exec(x)?.[1] ?? null;
/** BR-CO-25: positiver Zahlbetrag braucht Fälligkeitsdatum (BT-9) oder Zahlungsbedingungen (BT-20) */
const brCo25 = (x: string) => Number(tag(x, "PayableAmount")) <= 0 || tag(x, "DueDate") !== null || /<cac:PaymentTerms>\s*<cbc:Note>[^<]+<\/cbc:Note>/.test(x);

describe("Defekt 5: XRechnung „zahlbar sofort“ verletzte BR-CO-25", () => {
  it("sofort: BT-9 = Rechnungsdatum und BT-20 „Zahlbar sofort ohne Abzug.“ (wie auf dem PDF)", () => {
    const x = xml({ ...RE, zahlungsziel: "sofort" });
    expect(tag(x, "DueDate")).toBe("2026-10-12");
    expect(x).toContain("<cac:PaymentTerms>\n    <cbc:Note>Zahlbar sofort ohne Abzug.</cbc:Note>");
    expect(brCo25(x)).toBe(true);
    // derselbe Satz steht auf dem PDF
    expect(dokumentHtml(vorlageFuer("rechnung")!, { ...RE, zahlungsziel: "sofort" }, { ...BETRIEB, iban: "" })).toContain("Zahlbar sofort ohne Abzug.");
  });
  it("Zahlungsziel in Tagen: Fälligkeitsdatum (nächster Werktag) wie bisher, keine zusätzliche Zahlungsbedingung", () => {
    const x = xml({ ...RE, zahlungsziel: "14" });
    expect(tag(x, "DueDate")).toBe("2026-10-26");
    expect(x).not.toContain("<cac:PaymentTerms>");
    expect(brCo25(x)).toBe(true);
  });
  it("Skonto: Zahlungsbedingung nach BR-DE-18 – mit Zahlungsziel in Tagen und mit „sofort“", () => {
    for (const ziel of ["30", "sofort"]) {
      const x = xml({ ...RE, zahlungsziel: ziel, skonto: true, skonto_prozent: "2", skonto_tage: "10" });
      expect(x).toMatch(/<cbc:Note>#SKONTO#TAGE=10#PROZENT=2\.00#/);
      expect(brCo25(x)).toBe(true);
    }
  });
  it("schon bezahlt: BT-20 mit dem Satz vom PDF statt „zahlbar sofort“", () => {
    const x = xml({ ...RE, zahlungsziel: "sofort", bezahlt_am: "2026-10-12" });
    expect(x).toContain("<cbc:Note>Der Rechnungsbetrag wurde am 12.10.2026 bezahlt.</cbc:Note>");
    expect(brCo25(x)).toBe(true);
  });
  it("ohne Zahlungsziel: die App erfindet keine Bedingung – „Zahlungsziel“ fehlt für die E-Rechnung", () => {
    expect(eRechnungAus({ ...RE, zahlungsziel: "" }, BETRIEB).fehlt).toContain("Zahlungsziel");
    // Storno (negativer Betrag) braucht keine
    expect(eRechnungAus({ ...RE, zahlungsziel: "", storno_zu: "2026-029" }, BETRIEB).fehlt).toEqual([]);
  });
  it("Storno „sofort“: keine Fälligkeit und keine Zahlungsbedingung (negativer Betrag, BR-CO-25 greift nicht)", () => {
    const x = xml({ ...RE, zahlungsziel: "sofort", storno_zu: "2026-029", positionen: [{ bezeichnung: "Catering", menge: "12", einheit: "Stück", preis: "-14,50", satz: "7" }] });
    expect(tag(x, "DueDate")).toBeNull();
    expect(x).not.toContain("<cac:PaymentTerms>");
  });
});

describe("Defekt 8b: Storno einer Schlussrechnung spiegelt die Abschläge", () => {
  const ABSCHLAG = [{ nummer: "2026-010", datum: "01.08.2026", netto: "6.000,00", satz: "19" }];
  const umbau = (preis: string) => [{ bezeichnung: "Umbau", menge: "1", einheit: "Pauschale", preis, satz: "19" }];
  const SCHLUSS: Daten = { ...RE, nummer: "2026-035", zahlungsziel: "14", schluss: true, abschlaege: ABSCHLAG, positionen: umbau("10.000,00") };
  const STORNO: Daten = { ...SCHLUSS, nummer: "2026-036", datum: "2026-10-20", storno_zu: "2026-035", storno_zu_datum: "2026-10-12", storno_abschlaege: true, positionen: umbau("-10.000,00") };

  it("XRechnung: Rechnungskorrektur über −11.900, abgesetzte Abschläge −7.140 (BT-113), zu erstatten −4.760 (BT-115)", () => {
    const x = xml(STORNO);
    expect(tag(x, "InvoiceTypeCode")).toBe("384");
    expect([tag(x, "TaxInclusiveAmount"), tag(x, "PrepaidAmount"), tag(x, "PayableAmount")]).toEqual(["-11900.00", "-7140.00", "-4760.00"]);
    expect(x).toContain("<cbc:ID>2026-010</cbc:ID>");
    // die Schlussrechnung selbst unverändert
    const s = xml(SCHLUSS);
    expect([tag(s, "TaxInclusiveAmount"), tag(s, "PrepaidAmount"), tag(s, "PayableAmount")]).toEqual(["11900.00", "7140.00", "4760.00"]);
  });

  const r = (d: Daten, id: string): AusgangsRechnungFuerBuchung => {
    const { daten } = eRechnungAus(d, BETRIEB);
    return { id, nummer: daten.nummer, datum: daten.rechnungsdatum, art: daten.art === "storno" ? "storno" : "rechnung", storniert_nummer: daten.storniert_nummer ?? null, kleinunternehmer: false, kunde: daten.kunde.name, positionen: daten.positionen, ...(daten.abschlaege?.length ? { abschlaege: daten.abschlaege } : {}) };
  };
  for (const [rahmen, forderung, erloes] of [["SKR03", "1410", "8400"], ["SKR04", "1210", "4400"]] as const) {
    it(`DATEV ${rahmen}: Schlussrechnung 4.760,00 S ${forderung}/${erloes}, Storno 4.760,00 S ${forderung}/${erloes} mit Generalumkehr`, () => {
      const b = buchungenAusRechnungen([r(SCHLUSS, "s1"), r(STORNO, "st1")], rahmen);
      const z = datevExtf(b, { beraternummer: "31877", mandantennummer: "20514", wjBeginn: "2026-01-01", von: "2026-01-01", bis: "2026-12-31", kontenrahmen: rahmen, erzeugtAm: "2027-02-15T10:00:00" }).split("\r\n").slice(2, -1).map((l) => l.split(";"));
      expect(z.map((f) => [f[0], f[1], f[6], f[7], f[10], f[117]])).toEqual([
        ["4760,00", '"S"', forderung, erloes, '"2026-035"', ""],
        ["4760,00", '"S"', forderung, erloes, '"2026-036"', "1"],
      ]);
    });
  }
});

describe("Defekt 8a: GmbH & Co. KG – Angaben zur Komplementärin (§§ 125a, 177a HGB)", () => {
  const KG: Betrieb = { ...BETRIEB, name: "Holzbau Nord GmbH & Co. KG", rechtsform: "GmbH & Co. KG", registergericht: "Amtsgericht Hamburg", registernummer: "HRA 12345", vertretung: "Jana Holm, Tom Berg", ort: "Hamburg", komplementaer: "Holzbau Nord Verwaltungs-GmbH", komplementaer_rechtsform: "GmbH", komplementaer_sitz: "Hamburg", komplementaer_registergericht: "Amtsgericht Hamburg", komplementaer_registernummer: "HRB 67890" };

  it("erkennt GmbH & Co. KG und UG (haftungsbeschränkt) & Co. KG – nicht GmbH, KG oder OHG", () => {
    expect(istCoKg(KG)).toBe(true);
    expect(istCoKg({ rechtsform: "UG (haftungsbeschränkt) & Co. KG", name: "" })).toBe(true);
    expect(istCoKg({ rechtsform: "", name: "Muster UG (haftungsbeschränkt) & Co. KG" })).toBe(true);
    for (const rf of ["GmbH", "KG", "OHG", "UG (haftungsbeschränkt)"]) expect(istCoKg({ rechtsform: rf, name: "" })).toBe(false);
  });

  it("Fußzeile jeder Unterlage: KG mit Sitz und HRA, dann die Komplementärin mit Sitz, Registergericht und HRB, dann ihre Geschäftsführung", () => {
    const sp = fussSpalten(KG).at(-1)!;
    expect(sp).toEqual([
      "Steuernr. 143/123/45678",
      "USt-IdNr. DE123456789",
      "Sitz Hamburg, Amtsgericht Hamburg HRA 12345",
      "Persönlich haftende Gesellschafterin: Holzbau Nord Verwaltungs-GmbH, Sitz Hamburg, Amtsgericht Hamburg HRB 67890",
      "Geschäftsführung: Jana Holm, Tom Berg",
    ]);
    // Rechtsform nicht in der Firma: sie steht dazu
    expect(fussSpalten({ ...KG, komplementaer: "Holzbau Nord Verwaltung" }).at(-1)).toContain("Persönlich haftende Gesellschafterin: Holzbau Nord Verwaltung, GmbH, Sitz Hamburg, Amtsgericht Hamburg HRB 67890");
    // andere Rechtsformen unverändert (keine Zeile, auch wenn Felder gefüllt sind)
    expect(fussSpalten({ ...KG, name: "Holzbau Nord GmbH", rechtsform: "GmbH" }).flat().join(" ")).not.toContain("Gesellschafterin");
  });

  it("Rechnung: fehlende Angaben der KG und der Komplementärin stehen unter „Fehlt noch“; vollständig nichts", () => {
    const v = vorlageFuer("rechnung")!;
    const d: Daten = { ...RE, zahlungsziel: "14" };
    expect(fehlendeAngaben(v, d, KG)).toEqual([]);
    const leer = { ...KG, registernummer: "", komplementaer: "", komplementaer_sitz: "", komplementaer_registergericht: "", komplementaer_registernummer: "", vertretung: "" };
    expect(komplementaerAngabenFehlen(leer)).toEqual([
      "Registernummer der KG, z. B. HRA 12345 (Mein Betrieb, §§ 125a, 177a HGB)",
      "Firma der persönlich haftenden Gesellschafterin (Mein Betrieb, §§ 125a, 177a HGB)",
      "Sitz der persönlich haftenden Gesellschafterin (Mein Betrieb, §§ 125a, 177a HGB)",
      "Registergericht der persönlich haftenden Gesellschafterin (Mein Betrieb, §§ 125a, 177a HGB)",
      "Registernummer der persönlich haftenden Gesellschafterin, z. B. HRB 12345 (Mein Betrieb, §§ 125a, 177a HGB)",
      "Alle Geschäftsführerinnen und Geschäftsführer der persönlich haftenden Gesellschafterin (Mein Betrieb, §§ 125a, 177a HGB)",
    ]);
    expect(fehlendeAngaben(v, d, leer)).toEqual(expect.arrayContaining(komplementaerAngabenFehlen(leer)));
    // Rechtsform der Komplementärin: aus der Firma oder dem eigenen Feld
    expect(komplementaerAngabenFehlen({ ...KG, komplementaer: "Holzbau Verwaltung", komplementaer_rechtsform: "" })).toEqual(["Rechtsform der persönlich haftenden Gesellschafterin (Mein Betrieb, §§ 125a, 177a HGB)"]);
    // UG & Co. KG: keine § 35a-Meldungen für die KG selbst (sie ist keine UG), sondern die der KG
    const ug = { ...leer, name: "Muster UG (haftungsbeschränkt) & Co. KG", rechtsform: "UG (haftungsbeschränkt) & Co. KG" };
    expect(fehlendeAngaben(v, d, ug).some((x) => x.includes("§ 35a GmbHG"))).toBe(false);
  });

  it("Rechnungs-PDF und XRechnung (BT-33) nennen die Komplementärin", () => {
    const html = dokumentHtml(vorlageFuer("rechnung")!, { ...RE, zahlungsziel: "14" }, KG);
    expect(html).toContain("Persönlich haftende Gesellschafterin: Holzbau Nord Verwaltungs-GmbH, Sitz Hamburg, Amtsgericht Hamburg HRB 67890");
    const x = xml({ ...RE, zahlungsziel: "14" }, KG);
    expect(tag(x, "CompanyLegalForm")).toBe("GmbH &amp; Co. KG, Sitz Hamburg, Amtsgericht Hamburg HRA 12345, Persönlich haftende Gesellschafterin: Holzbau Nord Verwaltungs-GmbH, Sitz Hamburg, Amtsgericht Hamburg HRB 67890, Geschäftsführung: Jana Holm, Tom Berg");
  });

  it("E-196: die neue Fußzeile ändert die Prüfsumme der Rechnungsvorlage – der Vermerk entfällt bis zur erneuten Durchsicht (T-191)", () => {
    // freigegeben war die Fassung vor E-193 (pruefsumme = dieselbe Fassung nach der Rechnung seit E-196)
    expect(vorlagenPruefsumme(vorlageFuer("rechnung")!)).not.toBe(VORLAGEN_GEPRUEFT.rechnung!.pruefsumme);
    expect(VORLAGEN_GEPRUEFT.rechnung!.pruefsumme_alt).toBe("8c2e773d415398dea57ab58922035136df2317e273cb2e82db72f0f86a6cda9e");
  });
});
