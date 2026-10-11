#!/usr/bin/env node
/**
 * Erzeugt Beispiel-E-Rechnungen (XRechnung CII und ZUGFeRD-PDF) für die Prüfung mit dem KoSIT-Validator in der CI.
 *   node scripts/e-rechnung-beispiele.mjs <zielverzeichnis>
 * Fälle: Regelsteuersatz + ermäßigt, Kleinunternehmer, Storno, Rechnung ohne USt-IdNr. (nur Steuernummer).
 * Die Steuersätze hier sind Testdaten, keine Regelwerte.
 */
import fs from "node:fs";
import path from "node:path";
import { rechnungPdf, xrechnungXml, zugferdPdf } from "@amtlos/server";

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
  console.log(`${name}: ${xml.length} Byte XML, ${pdf.length} Byte PDF`);
}
