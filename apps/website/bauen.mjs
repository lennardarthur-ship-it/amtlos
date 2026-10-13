/**
 * Landingpage bauen (E-132): setzt die echten Zahlen aus dem Katalog (profile.json, erzeugt aus dem Pflichten-Check)
 * in seite.html ein und schreibt dist/ zum Hochladen (index.html mit Dokumentkopf, Bilder).
 *
 *   node apps/website/bauen.mjs [ausgabe]     # Standard: apps/website/dist
 */
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.resolve(process.argv[2] ?? path.join(HIER, "dist"));
const seite = fs.readFileSync(path.join(HIER, "seite.html"), "utf8").replace("__PROFILE__", JSON.stringify(JSON.parse(fs.readFileSync(path.join(HIER, "profile.json"), "utf8"))));
fs.mkdirSync(path.join(OUT, "bilder"), { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${seite}\n</body>\n</html>\n`);
fs.writeFileSync(path.join(OUT, "artifact.html"), seite);
for (const b of fs.readdirSync(path.join(HIER, "bilder"))) fs.copyFileSync(path.join(HIER, "bilder", b), path.join(OUT, "bilder", b));
console.log(`✓ ${OUT}`);
