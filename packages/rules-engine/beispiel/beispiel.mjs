/**
 * Minimalbeispiel @amtlos/rules-engine: ein Katalog mit einer Pflicht (monatliche USt-Voranmeldung, wenn der Betrieb
 * nicht Kleinunternehmer ist), ausgewertet für zwei Profile. Fehlt ein Fakt, ist das Ergebnis „unbekannt“ – nie
 * „gilt nicht“. Der Kalender kommt aus @amtlos/fristen.
 *
 *   node beispiel/beispiel.mjs       (nach `pnpm build` im Paket bzw. nach Installation der Pakete)
 */
/* global console */
/* eslint-disable no-console -- Beispiel für die Kommandozeile */
import assert from "node:assert/strict";
import { StandardKalender } from "@amtlos/fristen";
import { auswerten, fristAlsText } from "@amtlos/rules-engine";

const ustVa = {
  schema_version: 1,
  id: "beispiel.ust_voranmeldung",
  version: 1,
  titel: { de: "Umsatzsteuer-Voranmeldung" },
  kurz: { de: "Monatlich ans Finanzamt" },
  erklaerung: { de: "Beispiel – kein geprüfter Katalogeintrag." },
  rechtsgrundlage: ["§ 18 UStG"],
  kategorie: "steuern",
  ausloeser: { feld: "profil.kleinunternehmer", op: "==", wert: false },
  frist: { typ: "wiederkehrend", rhythmus: "monatlich", faellig: { art: "tag_nach_periodenende", tag: 10 }, verschiebung: { regel: "naechster_werktag", kalender: "bundesland" } },
  wiederholung: { art: "periodisch" },
  sanktion: { text: { de: "Verspätungszuschlag möglich" }, schwere: "mittel" },
  status_recht: "in_kraft",
  gueltig_ab: null,
};
const katalog = { pflichten: [ustVa], regelwerte: [] };
const lauf = (fakten) => auswerten({ katalog, fakten, ereignisse: [], stichtag: "2026-10-21", kalender: new StandardKalender(), fenster: { von: "2026-10-01", bis: "2026-12-31" } })[0];

const regel = lauf({ "profil.kleinunternehmer": false, "profil.bundesland": "BY", "profil.gruendungsdatum": "2020-01-01" });
console.log(`${ustVa.titel.de}: ${regel.ergebnis} – ${fristAlsText(ustVa.frist)}`);
for (const t of regel.termine) console.log(`  ${t.periode}: ${t.faellig_am}`);
assert.equal(regel.ergebnis, "gilt");
assert.ok(regel.termine.some((t) => t.faellig_am === "2026-10-12"));

const offen = lauf({ "profil.bundesland": "BY" });
console.log(`ohne Angabe zur Kleinunternehmerregelung: ${offen.ergebnis}, es fehlt: ${offen.fehlende_fakten.join(", ")}`);
assert.equal(offen.ergebnis, "unbekannt");
assert.deepEqual(offen.fehlende_fakten, ["profil.kleinunternehmer"]);
console.log("ok");
