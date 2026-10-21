/**
 * Minimalbeispiel @amtlos/fachlogik: Rechnungssummen je Steuersatz (in Cent, kaufmännisch gerundet), GiroCode für die
 * Überweisung und eine Vorlage als druckfertiges HTML.
 *
 *   node beispiel/beispiel.mjs       (nach `pnpm build` im Paket bzw. nach Installation der Pakete)
 */
/* global console */
/* eslint-disable no-console -- Beispiel für die Kommandozeile */
import assert from "node:assert/strict";
import { LEERER_BETRIEB, VORLAGEN, dokumentHtml, giroCodeDaten, ibanGueltig, leereDaten, summen, vorlageFuer } from "@amtlos/fachlogik";

const s = summen(
  [
    { bezeichnung: "Haarschnitt", menge: 1, einheit: "stueck", preis_cent: 2500, ust_satz: 19 },
    { bezeichnung: "Pflegeprodukt", menge: 2, einheit: "stueck", preis_cent: 899, ust_satz: 19 },
    { bezeichnung: "Fachbuch", menge: 1, einheit: "stueck", preis_cent: 2000, ust_satz: 7 },
  ],
  false,
);
console.log(`netto ${s.netto_cent} ct, USt ${s.ust_cent} ct, brutto ${s.brutto_cent} ct`);
for (const g of s.gruppen) console.log(`  ${g.satz} %: netto ${g.netto_cent} ct, USt ${g.ust_cent} ct`);
assert.equal(s.netto_cent, 2500 + 1798 + 2000);
assert.equal(s.brutto_cent, s.netto_cent + s.ust_cent);

const iban = "DE89 3704 0044 0532 0130 00";
assert.ok(ibanGueltig(iban));
const giro = giroCodeDaten({ name: "Salon Sonne", iban, betragCent: s.brutto_cent, verwendungszweck: "Rechnung 2026-001" });
console.log(`GiroCode: ${giro.split("\n").length} Zeilen (EPC069-12)`);
assert.ok(giro.startsWith("BCD\n"));

const v = vorlageFuer("hygieneplan") ?? VORLAGEN[0];
const betrieb = { ...LEERER_BETRIEB, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München" };
const html = dokumentHtml(v, leereDaten(v, betrieb, "2026-10-21"), betrieb);
console.log(`Vorlage „${v.titel}“ als HTML: ${html.length} Zeichen; ${VORLAGEN.length} Vorlagen insgesamt`);
assert.match(html, /Salon Sonne/);
console.log("ok");
