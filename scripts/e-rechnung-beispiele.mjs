#!/usr/bin/env node
/**
 * Erzeugt Beispiel-E-Rechnungen (XRechnung CII und ZUGFeRD-PDF) für die Prüfung mit dem KoSIT-Validator in der CI.
 *   node scripts/e-rechnung-beispiele.mjs <zielverzeichnis>
 * Dazu je Fall die XRechnung in UBL-Syntax, wie die App sie erzeugt (*-app-ubl.xml).
 * Fälle: Regelsteuersatz + ermäßigt, Kleinunternehmer, Storno, Rechnung ohne USt-IdNr. (nur Steuernummer).
 * Die Steuersätze hier sind Testdaten, keine Regelwerte.
 */
import fs from "node:fs";
import path from "node:path";
import { rechnungPdf, xrechnungXml, zugferdPdf } from "@amtlos/server";
import { KU_HINWEIS, eRechnungAus, xrechnungUbl } from "@amtlos/fachlogik";

const ziel = process.argv[2] ?? "e-rechnungen";
fs.mkdirSync(ziel, { recursive: true });
const KU = "Kein Ausweis von Umsatzsteuer (Kleinunternehmer) – Wortlaut fachlich zu prüfen";
const basis = {
  nummer: "2026-0001", rechnungsdatum: "2026-10-11", leistungsdatum: "2026-10-01", faellig_am: "2026-10-25",
  steller: { name: "Annas Café", strasse: "Hauptstr. 1", plz: "70173", ort: "Stuttgart", land: "DE", email: "anna@example.org", telefon: "+49 711 123", steuernummer: "93815/08152", ust_idnr: "DE123456789", iban: "DE02120300000000202051", bic: "BYLADEM1001" },
  kunde: { name: "Kunde GmbH", strasse: "Ring 5", plz: "10115", ort: "Berlin", land: "DE", email: "einkauf@kunde.example", kaeufer_referenz: "PO-77", geschaeftskunde: true },
  positionen: [
    { bezeichnung: "Beratung", menge: 2.5, einheit: "stunde", preis_cent: 8000, ust_satz: 19 },
    { bezeichnung: "Fachbuch", menge: 1, einheit: "stueck", preis_cent: 2999, ust_satz: 7 },
  ],
  kleinunternehmer: false,
};
const faelle = {
  regel: basis,
  kleinunternehmer: { ...basis, nummer: "2026-0002", steller: { ...basis.steller, ust_idnr: null }, kleinunternehmer: true, positionen: basis.positionen.map((p) => ({ ...p, ust_satz: null })) },
  storno: { ...basis, nummer: "2026-0003", art: "storno", storniert_nummer: "2026-0001" },
  nur_steuernummer: { ...basis, nummer: "2026-0004", steller: { ...basis.steller, ust_idnr: null }, kunde: { ...basis.kunde, kaeufer_referenz: null } },
};
for (const [name, r] of Object.entries(faelle)) {
  const xml = await xrechnungXml(r, KU);
  fs.writeFileSync(path.join(ziel, `${name}.xml`), xml);
  const pdf = await zugferdPdf(r, KU, await rechnungPdf(r, KU));
  fs.writeFileSync(path.join(ziel, `${name}.pdf`), pdf);
  // App (E-128): dieselbe Rechnung als XRechnung in UBL-Syntax, ohne Bibliothek erzeugt
  fs.writeFileSync(path.join(ziel, `${name}-app-ubl.xml`), xrechnungUbl(r, KU));
  console.log(`${name}: ${xml.length} Byte XML, ${pdf.length} Byte PDF`);
}

// App (E-128): Rechnung, wie sie in der App ausgefüllt wird (Freitext-Anschrift, Einheiten als Text), über eRechnungAus
const betrieb = { name: "Café Sonnenschein GmbH", strasse: "Marktplatz 3", plz: "80331", ort: "München", verantwortlich: "Maria Beispiel", telefon: "+49 89 123456", email: "info@cafe-sonnenschein.example", steuernummer: "143/123/45678", ust_idnr: "DE123456789", iban: "DE02120300000000202051", bundesland: "Bayern" };
const appFaelle = {
  "app-rechnung": { nummer: "2026-014", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Catering Teamfrühstück", menge: "12", einheit: "Stück", preis: "14,50", satz: "7" }, { bezeichnung: "Lieferung", menge: "1", einheit: "Pauschale", preis: "25,00", satz: "19" }], hinweis: "Vielen Dank für Ihren Auftrag." },
  "app-storno": { nummer: "2026-015", datum: "2026-10-13", leistung_gleich: true, zahlungsziel: "sofort", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", storno_zu: "2026-014", positionen: [{ bezeichnung: "Catering Teamfrühstück", menge: "12", einheit: "Stück", preis: "-14,50", satz: "7" }] },
  "app-wien-reverse-charge": { nummer: "2026-020", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Studio Wien GmbH", kunde_anschrift: "Mariahilfer Straße 1\n1060 Wien\nÖsterreich", kunde_email: "office@studio-wien.example", kunde_ust_idnr: "ATU12345678", hinweise: ["reverse_charge"], positionen: [{ bezeichnung: "Konzept Frühstücksbuffet", menge: "4", einheit: "Stunde", preis: "90,00", satz: "0" }] },
  "app-niederlande-igl": { nummer: "2026-021", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "30", kunde_name: "Winkel BV", kunde_anschrift: "Damrak 1\n1012 LG Amsterdam\nNiederlande", kunde_email: "inkoop@winkel.example", kunde_ust_idnr: "NL123456789B01", hinweise: ["igl"], positionen: [{ bezeichnung: "Kaffeebohnen, Sack 5 kg", menge: "10", einheit: "Stück", preis: "40,00", satz: "0" }] },
  "app-kleinunternehmer": { nummer: "2026-003", datum: "2026-10-12", leistung_gleich: false, leistung: "01.10.2026", kleinunternehmer: true, zahlungsziel: "30", kunde_name: "Praxis Dr. Muster", kunde_anschrift: "Am Park 1\n50667 Köln", kunde_email: "praxis@example.org", positionen: [{ bezeichnung: "Fotoshooting", menge: "3", einheit: "Stunde", preis: "90,00", satz: "19" }] },
  // E-193 (5): Zahlungsbedingungen – „zahlbar sofort“ verletzte BR-CO-25 (weder BT-9 noch BT-20), dazu Skonto und schon bezahlt
  "app-zahlbar-sofort": { nummer: "2026-040", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "sofort", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Catering", menge: "12", einheit: "Stück", preis: "14,50", satz: "7" }] },
  "app-skonto": { nummer: "2026-041", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "30", skonto: true, skonto_prozent: "2", skonto_tage: "10", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Catering", menge: "12", einheit: "Stück", preis: "14,50", satz: "7" }] },
  "app-schon-bezahlt": { nummer: "2026-042", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "sofort", bezahlt_am: "2026-10-12", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Catering", menge: "12", einheit: "Stück", preis: "14,50", satz: "7" }] },
  // E-193 (8b): Schlussrechnung „sofort“ und ihr Storno, das die Abschläge spiegelt (BT-113 negativ, zu erstatten nur der Rest)
  "app-schlussrechnung": { nummer: "2026-043", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "sofort", schluss: true, abschlaege: [{ nummer: "2026-010", datum: "01.08.2026", netto: "6.000,00", satz: "19" }], kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Umbau", menge: "1", einheit: "Pauschale", preis: "10.000,00", satz: "19" }] },
  // E-200: schon bezahlte Schlussrechnung – BT-113 = ganzer Betrag (Abschläge + Rest), BT-115 = 0,00
  "app-schlussrechnung-bezahlt": { nummer: "2026-045", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "sofort", bezahlt_am: "2026-10-12", schluss: true, abschlaege: [{ nummer: "2026-010", datum: "01.08.2026", netto: "6.000,00", satz: "19" }], kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Umbau", menge: "1", einheit: "Pauschale", preis: "10.000,00", satz: "19" }] },
  "app-schlussrechnung-storno": { nummer: "2026-044", datum: "2026-10-20", leistung_gleich: true, zahlungsziel: "sofort", schluss: true, storno_abschlaege: true, storno_zu: "2026-043", storno_zu_datum: "2026-10-12", abschlaege: [{ nummer: "2026-010", datum: "01.08.2026", netto: "6.000,00", satz: "19" }], kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Umbau", menge: "1", einheit: "Pauschale", preis: "-10.000,00", satz: "19" }] },
  // E-202: Storno einer Schlussrechnung mit zwei Abschlägen (Beispiel des Steuerberaters) – BT-22 mit den Sätzen vom PDF,
  // Verweis auf die stornierte Rechnung mit Datum (BT-26), BT-113 negativ
  "app-schlussrechnung-storno-zwei-abschlaege": { nummer: "2026-046", datum: "2026-10-20", leistung_gleich: false, leistung: "03.08.2026 – 30.09.2026", zahlungsziel: "14", schluss: true, storno_abschlaege: true, storno_zu: "2026-035", storno_zu_datum: "2026-10-12", abschlaege: [{ nummer: "2026-010", datum: "01.08.2026", netto: "4.000,00", satz: "19" }, { nummer: "2026-021", datum: "01.09.2026", netto: "2.000,00", satz: "19" }], kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example", positionen: [{ bezeichnung: "Innenausbau Büroetage", menge: "1", einheit: "Pauschale", preis: "-8.500,00", satz: "19" }, { bezeichnung: "Einbauschränke Empfang", menge: "1", einheit: "Pauschale", preis: "-1.500,00", satz: "19" }] },
};
for (const [name, d] of Object.entries(appFaelle)) {
  const { daten, fehlt } = eRechnungAus(d, { ...betrieb, ...(name === "app-kleinunternehmer" ? { ust_idnr: "" } : {}) });
  if (fehlt.length) throw new Error(`${name}: ${fehlt.join(", ")}`);
  fs.writeFileSync(path.join(ziel, `${name}-ubl.xml`), xrechnungUbl(daten, KU_HINWEIS));
  console.log(`${name}: UBL aus der App`);
}
