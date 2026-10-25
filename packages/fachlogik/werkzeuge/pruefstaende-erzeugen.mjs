#!/usr/bin/env node
/**
 * E-196: schreibt src/dokumente/pruefstaende.ts – je Freigabe in geprueft.ts den heutigen Prüfstand der Vorlage
 * (Prüfsumme über alle Ausprägungen und Zahl der Stellen mit „fachlich zu prüfen“). Die App liest ihn statt zu rechnen;
 * test/e196-vorlagen-pruefstand.test.ts prüft, dass die Liste zur Rechnung passt. Nach jeder Änderung an Vorlagen:
 *
 *   pnpm --filter @amtlos/fachlogik build && node packages/fachlogik/werkzeuge/pruefstaende-erzeugen.mjs && pnpm --filter @amtlos/fachlogik build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const F = await import(path.join(hier, "../dist/index.js"));
const zeilen = [];
for (const id of Object.keys(F.VORLAGEN_GEPRUEFT)) {
  const v = F.vorlageFuer(id);
  F.freigabenFuer(id).forEach((f, i) => {
    const s = F.vorlagenPruefstand(v, f);
    zeilen.push(`  ${JSON.stringify(i ? `${id}#${i}` : id)}: { summe: "${s.summe}", offen: ${s.offen} },`);
  });
}
const text = `/**
 * Erzeugt von werkzeuge/pruefstaende-erzeugen.mjs (E-196) – nicht von Hand ändern. Heutiger Prüfstand je Freigabe in
 * geprueft.ts (Schlüssel: Vorlage, weitere Freigaben mit „#1“ usw.): Prüfsumme über alle Ausprägungen und Zahl der Stellen
 * mit „fachlich zu prüfen“. Der Test e196-vorlagen-pruefstand prüft, dass die Werte zur Rechnung passen.
 */
export const PRUEFSTAENDE: Readonly<Record<string, { summe: string; offen: number }>> = {
${zeilen.join("\n")}
};
`;
fs.writeFileSync(path.join(hier, "../src/dokumente/pruefstaende.ts"), text);
console.log(`✓ ${zeilen.length} Prüfstände → src/dokumente/pruefstaende.ts`);
