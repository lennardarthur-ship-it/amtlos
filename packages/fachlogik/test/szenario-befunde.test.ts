/**
 * Befunde aus den Jahres-Szenarien Salon (GmbH, Ist) und Freiberuf (Kleinunternehmerin), Oktober 2026: Gutschrift nicht
 * als Erlös, Kleinunternehmer ohne Vorsteuer und ohne „netto“, EÜR-Warnung für Kapitalgesellschaften, gebeugte
 * Einheiten, Dateinamen für Storno und Gutschrift, „vertreten durch“, Seitenumbrüche, Kassenmeldung, Kontaktformular.
 */
import { describe, expect, it } from "vitest";
import {
  EUER_KAPITALGESELLSCHAFT,
  KU_HINWEIS,
  LEERER_BETRIEB,
  belegAusERechnung,
  buchungenAusRechnungen,
  dokumentHtml,
  einheitFuerMenge,
  eRechnungAus,
  eRechnungLesen,
  fehlendeAngaben,
  istKapitalgesellschaft,
  mitVertretung,
  pdfDateiname,
  rechnungsTitel,
  unterlagenName,
  vorlageFuer,
  xrechnungUbl,
  type AusgangsRechnungFuerBuchung,
  type Betrieb,
  type Daten,
} from "../src/index.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "20259", ort: "Hamburg", verantwortlich: "Alex Sonnberg", telefon: "040 123", email: "hallo@salon-sonne.example", steuernummer: "41/724/03619", iban: "DE89370400440532013000", bundesland: "Hamburg" };
const GMBH: Betrieb = { ...B, name: "Salon Sonne GmbH", rechtsform: "GmbH", registergericht: "Amtsgericht Hamburg", registernummer: "HRB 178432", vertretung: "Alex Sonnberg, Chris Sonnberg" };
const html = (id: string, d: Daten = {}, b = B) => dokumentHtml(vorlageFuer(id)!, d, b).replace(/\u00a0/g, " ").replace(/&nbsp;/g, " ");
const RECHNUNG: Daten = { nummer: "2026-007", datum: "2026-05-15", leistung_gleich: true, kunde_name: "Elbstudio Fotografie GmbH", kunde_anschrift: "Große Elbstraße 1\n22767 Hamburg", positionen: [{ bezeichnung: "Hair & Make-up", menge: "9", einheit: "Stunde", preis: "75", satz: "19" }, { bezeichnung: "Material", menge: "1", einheit: "Pauschale", preis: "60", satz: "19" }, { bezeichnung: "Anfahrt", menge: "2", einheit: "Pauschale", preis: "20", satz: "19" }] };

describe("Einheit passend zur Menge", () => {
  it("Mehrzahl gängiger Zähleinheiten bei Menge ≠ 1, Maßeinheiten und „Stück“ bleiben", () => {
    expect(einheitFuerMenge("Stunde", 9)).toBe("Stunden");
    expect(einheitFuerMenge("Stunde", 1)).toBe("Stunde");
    expect(einheitFuerMenge("Stunde", 1.5)).toBe("Stunden");
    expect(einheitFuerMenge("Pauschale", 2)).toBe("Pauschalen");
    expect(einheitFuerMenge("Tag", 3)).toBe("Tage");
    expect(einheitFuerMenge("Woche", 2)).toBe("Wochen");
    expect(einheitFuerMenge("Monat", 12)).toBe("Monate");
    expect(einheitFuerMenge("Person", 4)).toBe("Personen");
    expect(einheitFuerMenge("stunde", 2)).toBe("stunden");
    expect(einheitFuerMenge("Stück", 12)).toBe("Stück");
    for (const e of ["kg", "m", "l", "Kilogramm", "Std.", "Satz/Set"]) expect(einheitFuerMenge(e, 5)).toBe(e);
    // Storno: negative Menge −1 bleibt Einzahl
    expect(einheitFuerMenge("Pauschale", -1)).toBe("Pauschale");
  });

  it("Rechnung: „9 Stunden“, „1 Pauschale“, „2 Pauschalen“", () => {
    const h = html("rechnung", RECHNUNG);
    expect(h).toContain("9 Stunden");
    expect(h).toContain("1 Pauschale<");
    expect(h).toContain("2 Pauschalen");
    expect(h).not.toContain("9 Stunde<");
  });
});

describe("Rechnung: Beschriftungen", () => {
  it("Kleinunternehmer: „Summe“ statt „Summe netto“", () => {
    expect(html("rechnung", { ...RECHNUNG, kleinunternehmer: true })).toContain("<tr><td>Summe</td>");
    expect(html("rechnung", { ...RECHNUNG, kleinunternehmer: true })).not.toContain("Summe netto");
    expect(html("rechnung", RECHNUNG)).toContain("<tr><td>Summe netto</td>");
  });

  it("Infoblock: E-Mail-Wert darf umbrechen (Wertspalte), die Beschriftung nicht", () => {
    const h = html("rechnung", RECHNUNG);
    expect(h).toContain(".g-brief .info table td { padding: 0.3mm 0; line-height: 1.3; vertical-align: top; overflow-wrap: anywhere; }");
    expect(h).toContain(".g-brief .info table td:first-child { color: #4a535c; width: 31mm; padding-right: 2mm; white-space: nowrap; }");
  });
});

describe("Dateinamen und Namen: Stornorechnung und Gutschrift", () => {
  const v = vorlageFuer("rechnung")!;
  it("rechnungsTitel aus den Daten", () => {
    expect(rechnungsTitel({ nummer: "1" })).toBe("Rechnung");
    expect(rechnungsTitel({ storno_zu: "2026-007" })).toBe("Stornorechnung");
    expect(rechnungsTitel({ hinweise: ["gutschrift"] })).toBe("Gutschrift");
    // Storno einer Gutschrift ist eine Stornorechnung
    expect(rechnungsTitel({ hinweise: ["gutschrift"], storno_zu: "2026-011" })).toBe("Stornorechnung");
  });

  it("PDF-Name und Name in der Übersicht", () => {
    expect(pdfDateiname(v, { nummer: "2026-007" }, "2026-05-15")).toBe("Rechnung-2026-007-2026-05-15.pdf");
    expect(pdfDateiname(v, { nummer: "2026-008", storno_zu: "2026-007" }, "2026-06-09")).toBe("Stornorechnung-2026-008-2026-06-09.pdf");
    expect(pdfDateiname(v, { nummer: "2026-011", hinweise: ["gutschrift"] }, "2026-09-03")).toBe("Gutschrift-2026-011-2026-09-03.pdf");
    expect(unterlagenName(v, { nummer: "2026-008", storno_zu: "2026-007" })).toBe("Stornorechnung · 2026-008");
    expect(unterlagenName(v, { nummer: "2026-011", hinweise: ["gutschrift"] })).toBe("Gutschrift · 2026-011");
    // andere Vorlagen unverändert
    expect(pdfDateiname(vorlageFuer("hygieneplan")!, { bereich: "Salon" }, "2026-02-03")).toBe("Hygieneplan-Salon-2026-02-03.pdf");
  });
});

describe("Gutschrift ist kein Erlös", () => {
  it("buchungenAusRechnungen überspringt Gutschriften (auch deren Storno)", () => {
    const re: AusgangsRechnungFuerBuchung = { id: "r1", nummer: "2026-010", datum: "2026-09-01", art: "rechnung", kleinunternehmer: true, kunde: "Kunde", positionen: [{ bezeichnung: "Design", menge: 1, einheit: "stueck", preis_cent: 10000, ust_satz: null }] };
    const gs: AusgangsRechnungFuerBuchung = { ...re, id: "g1", nummer: "2026-011", kunde: "Fotograf", gutschrift: true };
    const b = buchungenAusRechnungen([re, gs, { ...gs, id: "g2", art: "storno" }], "SKR03");
    expect(b.map((x) => x.quelle_id)).toEqual(["r1"]);
  });
});

describe("Kleinunternehmer: Vorsteuer-Schalter beim Einlesen einer E-Rechnung", () => {
  it("Rechnung mit Umsatzsteuer: Regelbesteuerung an, Kleinunternehmer aus", () => {
    // XRechnung mit 19 %, wie die App sie selbst erzeugt
    const { daten } = eRechnungAus({ ...RECHNUNG, kunde_email: "rechnung@elbstudio.example" }, { ...B, ust_idnr: "DE361847295" });
    const r = eRechnungLesen(xrechnungUbl(daten, KU_HINWEIS))!;
    expect(r.summen.ust_cent).toBeGreaterThan(0);
    expect(belegAusERechnung(r, "b1", "2026-10-13T09:15:00.000Z").vorsteuer).toBe(true);
    expect(belegAusERechnung(r, "b2", "2026-10-13T09:15:00.000Z", { kleinunternehmer: true }).vorsteuer).toBe(false);
  });
});

describe("Kapitalgesellschaft: EÜR-Warnung und „vertreten durch“", () => {
  it("istKapitalgesellschaft: GmbH, UG, AG – nicht GmbH & Co. KG, nicht Einzelunternehmen; ohne Rechtsform nach dem Namen", () => {
    expect(istKapitalgesellschaft("GmbH")).toBe(true);
    expect(istKapitalgesellschaft("UG (haftungsbeschränkt)")).toBe(true);
    expect(istKapitalgesellschaft("UG")).toBe(true);
    expect(istKapitalgesellschaft("AG")).toBe(true);
    expect(istKapitalgesellschaft("GmbH & Co. KG")).toBe(false);
    expect(istKapitalgesellschaft("Einzelunternehmen")).toBe(false);
    expect(istKapitalgesellschaft("e. K.")).toBe(false);
    expect(istKapitalgesellschaft("", "Salon Sonne GmbH")).toBe(true);
    expect(istKapitalgesellschaft("", "Salon Sonne")).toBe(false);
    // die Rechtsform aus „Mein Betrieb“ geht dem Namen vor
    expect(istKapitalgesellschaft("Einzelunternehmen", "Alte Schmiede GmbH Nachf.")).toBe(false);
  });

  it("mitVertretung: nur bei Kapitalgesellschaft mit Geschäftsführung", () => {
    expect(mitVertretung(GMBH)).toBe("Salon Sonne GmbH, vertreten durch Alex Sonnberg, Chris Sonnberg");
    expect(mitVertretung({ ...GMBH, vertretung: "" })).toBe("Salon Sonne GmbH");
    expect(mitVertretung({ ...B, vertretung: "Alex Sonnberg" })).toBe("Salon Sonne");
  });

  it("EÜR: Hinweis in der Prüfung bei GmbH/UG, die Vorlage bleibt nutzbar", () => {
    const v = vorlageFuer("euer")!;
    const d = { jahr: "2026", einnahmen: [{ text: "Umsatz", betrag: "100" }] };
    expect(fehlendeAngaben(v, d, GMBH)).toContain(EUER_KAPITALGESELLSCHAFT);
    expect(fehlendeAngaben(v, d, { ...B, rechtsform: "UG (haftungsbeschränkt)" })).toContain(EUER_KAPITALGESELLSCHAFT);
    expect(fehlendeAngaben(v, d, B)).not.toContain(EUER_KAPITALGESELLSCHAFT);
    expect(EUER_KAPITALGESELLSCHAFT).toContain("Kapitalgesellschaften erstellen eine Bilanz statt einer EÜR");
    expect(html("euer", d, GMBH)).toContain("Einnahmen-Überschuss-Rechnung");
  });

  it("AVV: „vertreten durch“ bei der Partei und der Unterschrift des Betriebs, halbe Anführungszeichen im Hauptvertrag", () => {
    const d = { partner: "TerminFix GmbH", partner_anschrift: "Am Markt 1\n10115 Berlin", hauptvertrag: "Nutzungsvertrag „Salon M“ vom 20.03.2025", tom: "Verschlüsselung" };
    const h = html("avv", d, GMBH);
    expect(h).toContain('<div class="name">Salon Sonne GmbH</div><div class="adresse">Hauptstraße 1, 20259 Hamburg</div><div class="zusatz">vertreten durch Alex Sonnberg, Chris Sonnberg</div><div class="rolle">– Verantwortlicher, Auftraggeber –</div>');
    expect(h).toContain("<span>Auftraggeber (Salon Sonne GmbH, vertreten durch Alex Sonnberg, Chris Sonnberg)</span>");
    expect(h).toContain("<span>Auftragnehmer (TerminFix GmbH)</span>");
    expect(h).toContain("ergänzt den Vertrag „Nutzungsvertrag ‚Salon M‘ vom 20.03.2025“ (Hauptvertrag)");
    // Rolle getauscht: der Betrieb ist Auftragnehmer
    const dl = html("avv", { ...d, rolle: "dienstleister" }, GMBH);
    expect(dl).toContain("<span>Auftragnehmer (Salon Sonne GmbH, vertreten durch Alex Sonnberg, Chris Sonnberg)</span>");
    // Einzelunternehmen: kein „vertreten durch“
    expect(html("avv", d, B)).not.toContain("vertreten durch");
    // ohne Anführungszeichen in der Eingabe wie bisher
    expect(html("avv", { ...d, hauptvertrag: "Vertrag über Online-Terminbuchung vom 20.03.2025" }, B)).toContain("ergänzt den Vertrag „Vertrag über Online-Terminbuchung vom 20.03.2025“ (Hauptvertrag)");
  });

  it("Nachweis der Arbeitsbedingungen und Verfahrensdokumentation: „vertreten durch“ bei der GmbH", () => {
    const nw = html("nachweis_arbeitsbedingungen", { name: "Mia Petersen", anschrift: "Fruchtallee 88\n20259 Hamburg" }, GMBH);
    expect(nw).toContain('<div class="zusatz">vertreten durch Alex Sonnberg, Chris Sonnberg</div><div class="rolle">– Arbeitgeber –</div>');
    expect(nw).toContain("<span>Arbeitgeber/in, vertreten durch Alex Sonnberg, Chris Sonnberg</span>");
    expect(html("nachweis_arbeitsbedingungen", { name: "Mia Petersen" }, B)).toContain("<span>Arbeitgeber/in</span>");
    const vd = html("verfahrensdokumentation", { organisation: "Friseursalon" }, GMBH);
    expect(vd).toContain("Salon Sonne GmbH, vertreten durch Alex Sonnberg, Chris Sonnberg");
    expect(vd).toContain("<span>Unterschrift (Salon Sonne GmbH, vertreten durch Alex Sonnberg, Chris Sonnberg)</span>");
    expect(html("verfahrensdokumentation", { organisation: "Friseursalon" }, B)).toContain("<span>Unterschrift</span>");
  });
});

describe("Kassenmeldung und Datenschutzerklärung", () => {
  it("Kassenmeldung: „Hersteller, Modell“ mit Komma getrennt", () => {
    const h = html("kassenmeldung", { kassen: [{ art: "elektronisch", hersteller: "SalonKasse Systems GmbH", modell: "SalonKasse Pro", seriennummer: "SK-1" }] });
    expect(h).toContain("SalonKasse Systems GmbH, SalonKasse Pro");
  });

  it("Kontaktformular nur, wenn ausgewählt; ältere Erklärungen ohne Schalter behalten den Text", () => {
    const d = { module: ["kontakt"] };
    const ohne = html("datenschutzerklaerung_website", { ...d, kontaktformular: false });
    expect(ohne).not.toContain("Kontaktformular");
    expect(ohne).toContain("Kontakt per E-Mail oder Telefon");
    expect(ohne).toContain("Wenn Sie uns per E-Mail oder telefonisch kontaktieren");
    expect(html("datenschutzerklaerung_website", { ...d, kontaktformular: true })).toContain("über das Kontaktformular");
    expect(html("datenschutzerklaerung_website", d)).toContain("über das Kontaktformular");
    // neue Erklärung: Schalter startet aus
    const v = vorlageFuer("datenschutzerklaerung_website")!;
    const f = v.abschnitte.flatMap((a) => a.felder).find((x) => x.id === "kontaktformular");
    expect(f?.art === "schalter" && f.wenn).toEqual({ feld: "module", ist: "kontakt" });
    const alsText = v.alsText!({ ...d, kontaktformular: false }, B);
    expect(alsText).not.toContain("Kontaktformular");
  });
});

describe("Seitenumbrüche", () => {
  it("Teilnahmeliste: Einleitungssatz bleibt bei der Liste (Unterweisung, Belehrung, KI-Schulung)", () => {
    const t = [{ name: "Mia Petersen" }, { name: "Leonie Brandt" }];
    expect(html("unterweisung", { teilnehmer: t })).toMatch(/<h2>Teilnahme<\/h2><p class="vor-tabelle">Mit meiner Unterschrift/);
    expect(html("ifsg_belehrung", { teilnehmer: t })).toMatch(/<h2>Teilnahme<\/h2><p class="vor-tabelle">Mit meiner Unterschrift/);
    expect(html("ki_kompetenz", { teilnehmer: t })).toMatch(/<h2>Teilnahme<\/h2><p class="vor-tabelle">Mit meiner Unterschrift/);
    expect(html("unterweisung")).toContain(".vor-tabelle { page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }");
  });

  it("Personalfragebogen: nur das letzte Feld bleibt mit Erklärung und Unterschrift zusammen", () => {
    const h = html("sv_meldedaten", { name: "Aylin Demir", beginn: "2025-10-01" });
    const block = h.slice(h.lastIndexOf('<div class="zusammen">'));
    expect(block).toContain("Weitere Beschäftigungen");
    expect(block).not.toContain("Berufsabschluss");
    expect(block).toContain("Ich versichere");
  });
});
