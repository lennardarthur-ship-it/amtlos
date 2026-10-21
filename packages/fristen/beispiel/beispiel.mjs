/**
 * Minimalbeispiel @amtlos/fristen: Termine der monatlichen Umsatzsteuer-Voranmeldung (10. des Folgemonats, auf den
 * nächsten Werktag verschoben) in Bayern, dazu ein relativer Termin und die Feiertage eines Jahres.
 *
 *   node beispiel/beispiel.mjs       (nach `pnpm build` im Paket bzw. nach Installation des Pakets)
 */
/* global console */
/* eslint-disable no-console -- Beispiel für die Kommandozeile */
import assert from "node:assert/strict";
import { StandardKalender, gesetzlicheFeiertage, relativerTermin, wiederkehrendeTermine } from "@amtlos/fristen";

const kalender = new StandardKalender();
const ort = { bundesland: "BY" };

const termine = wiederkehrendeTermine(
  { rhythmus: "monatlich", faellig: { art: "tag_nach_periodenende", tag: 10 }, verschiebung: { regel: "naechster_werktag", kalender: "bundesland" } },
  "2026-10-01",
  "2026-12-31",
  ort,
  kalender,
);
for (const t of termine) console.log(`USt-VA ${t.periode}: fällig am ${t.faellig_am}${t.uebersprungen.length ? ` (verschoben von ${t.roh})` : ""}`);
// 10.10.2026 ist ein Samstag → Montag, 12.10.2026
assert.equal(termine.find((t) => t.periode === "2026-09")?.faellig_am, "2026-10-12");

// zwei Wochen nach einem Ereignis (z. B. Anmeldung eines Beschäftigten), nächster Werktag
const r = relativerTermin("2026-12-18", { versatz: "P14D", verschiebung: { regel: "naechster_werktag", kalender: "bundesland" } }, ort, kalender);
console.log(`Relativ: ${r.roh} → ${r.faellig_am}`);
assert.equal(r.faellig_am, "2027-01-04"); // 1.1. Neujahr (Fr), Wochenende → Montag, 4.1.

const feiertage = gesetzlicheFeiertage(2026).filter((f) => !f.bundeslaender || f.bundeslaender.includes("BY"));
console.log(`Feiertage 2026 in Bayern: ${feiertage.length}`);
console.log("ok");
