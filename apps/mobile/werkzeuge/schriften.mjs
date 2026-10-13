#!/usr/bin/env node
/**
 * Schriften für die Dokumente (E-129) als Modul: Die Teilmengen in assets/schriften (Amtlos Sans/Serif, aus Source
 * Sans 3 / Source Serif 4, OFL 1.1) werden base64-kodiert in src/unterlagen/schriftenDaten.ts geschrieben. So sind sie
 * ohne Ladezeit in Vorschau, PDF (expo-print) und pdf-lib verfügbar – auch im Web und in Tests.
 * Aufruf: node werkzeuge/schriften.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ordner = path.join(app, "assets/schriften");
const SCHNITTE = [
  ["AmtlosSans_400Regular.ttf", "Amtlos Sans", 400, "normal"],
  ["AmtlosSans_400Regular_Italic.ttf", "Amtlos Sans", 400, "italic"],
  ["AmtlosSans_600SemiBold.ttf", "Amtlos Sans", 600, "normal"],
  ["AmtlosSans_700Bold.ttf", "Amtlos Sans", 700, "normal"],
  ["AmtlosSerif_400Regular.ttf", "Amtlos Serif", 400, "normal"],
  ["AmtlosSerif_400Regular_Italic.ttf", "Amtlos Serif", 400, "italic"],
  ["AmtlosSerif_600SemiBold.ttf", "Amtlos Serif", 600, "normal"],
];
const zeilen = SCHNITTE.map(([datei, familie, gewicht, stil]) => `  { familie: ${JSON.stringify(familie)}, gewicht: ${gewicht}, stil: ${JSON.stringify(stil)}, daten: "${fs.readFileSync(path.join(ordner, datei)).toString("base64")}" },`);
const ts = `// Erzeugt von werkzeuge/schriften.mjs – nicht von Hand ändern. Schriften: SIL Open Font License 1.1, siehe assets/schriften/LIZENZ.txt
export interface Schnitt {
  familie: "Amtlos Sans" | "Amtlos Serif";
  gewicht: number;
  stil: "normal" | "italic";
  /** TrueType, base64 */
  daten: string;
}
export const SCHNITTE: Schnitt[] = [
${zeilen.join("\n")}
];
`;
fs.writeFileSync(path.join(app, "src/unterlagen/schriftenDaten.ts"), ts);
console.log("✓ schriftenDaten.ts", Math.round(ts.length / 1024), "KB");
