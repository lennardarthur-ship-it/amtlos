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
  "app-kleinunternehmer": { nummer: "2026-003", datum: "2026-10-12", leistung_gleich: false, leistung: "01.10.2026", kleinunternehmer: true, zahlungsziel: "30", kunde_name: "Praxis Dr. Muster", kunde_anschrift: "Am Park 1\n50667 Köln", kunde_email: "praxis@example.org", positionen: [{ bezeichnung: "Fotoshooting", menge: "3", einheit: "Stunde", preis: "90,00", satz: "19" }] },
};
for (const [name, d] of Object.entries(appFaelle)) {
  const { daten, fehlt } = eRechnungAus(d, { ...betrieb, ...(name === "app-kleinunternehmer" ? { ust_idnr: "" } : {}) });
  if (fehlt.length) throw new Error(`${name}: ${fehlt.join(", ")}`);
  fs.writeFileSync(path.join(ziel, `${name}-ubl.xml`), xrechnungUbl(daten, KU_HINWEIS));
  console.log(`${name}: UBL aus der App`);
}
