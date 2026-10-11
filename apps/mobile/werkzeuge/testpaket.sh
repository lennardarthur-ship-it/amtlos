#!/usr/bin/env bash
# Eigenständiges Testpaket für Expo Go (E-119): die App ohne Monorepo, Übersetzungen, Regel-Engine und Fristen
# eingebettet (Engine und Fristen als gebautes JavaScript – vorher „pnpm build“), nur Demo-Anmeldung.
#   bash apps/mobile/werkzeuge/testpaket.sh <zielordner>
# Ergebnis: <zielordner>/amtlos-app und <zielordner>/amtlos-app.zip
set -euo pipefail
ZIEL="${1:?Zielordner fehlt}"
APP="$(cd "$(dirname "$0")/.." && pwd)"
PAKETE="$APP/../../packages"
I18N="$PAKETE/i18n"
P="$ZIEL/amtlos-app"
rm -rf "$P" "$ZIEL/amtlos-app.zip"
mkdir -p "$P/pakete/i18n"
cp -r "$APP/src" "$APP/assets" "$APP/index.ts" "$P/"
cp -r "$I18N/src" "$P/pakete/i18n/"
find "$P/pakete/i18n/src" -name '*.test.ts' -delete
for paket in rules-engine fristen fachlogik; do
  test -f "$PAKETE/$paket/dist/index.js" || { echo "packages/$paket/dist fehlt – erst pnpm build"; exit 1; }
  mkdir -p "$P/pakete/$paket/dist"
  cp "$PAKETE/$paket/dist/"*.js "$P/pakete/$paket/dist/"
done
node - "$APP" "$P" <<'JS'
const fs = require("node:fs");
const [app, p] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(`${app}/package.json`, "utf8"));
for (const k of ["@amtlos/i18n", "@amtlos/rules-engine", "@amtlos/fristen", "@amtlos/fachlogik"]) delete pkg.dependencies[k]; // über tsconfig-Pfade eingebunden
const expoTs = require(require.resolve("typescript/package.json", { paths: [app] })).version;
fs.writeFileSync(`${p}/package.json`, JSON.stringify({
  name: "amtlos-app", version: pkg.version, private: true, main: "index.ts",
  scripts: { start: "expo start" },
  dependencies: pkg.dependencies,
  devDependencies: { ...pkg.devDependencies, typescript: `~${expoTs}` },
}, null, 2) + "\n");
const conf = JSON.parse(fs.readFileSync(`${app}/app.json`, "utf8"));
conf.expo.extra.authModus = "demo";
fs.writeFileSync(`${p}/app.json`, JSON.stringify(conf, null, 2) + "\n");
fs.writeFileSync(`${p}/tsconfig.json`, JSON.stringify({
  extends: "expo/tsconfig.base",
  compilerOptions: { strict: true, skipLibCheck: true, paths: {
    "@amtlos/i18n": ["./pakete/i18n/src/index.ts"],
    "@amtlos/rules-engine": ["./pakete/rules-engine/dist/index.js"],
    "@amtlos/fristen": ["./pakete/fristen/dist/index.js"],
    "@amtlos/fachlogik": ["./pakete/fachlogik/dist/index.js"],
  } },
  include: ["index.ts", "src", "pakete"],
}, null, 2) + "\n");
JS
cat > "$P/LIESMICH.txt" <<'TXT'
Amtlos – Testversion für das iPhone (Demo mit Beispieldaten)

1. Auf dem iPhone: „Expo Go“ aus dem App Store laden.
2. Auf dem Mac: Node.js installieren (https://nodejs.org, Knopf „LTS“, Installer öffnen, durchklicken).
3. Auf dem Mac das Programm „Terminal“ öffnen und eintippen (Ordnerpfad anpassen, falls woanders):

     cd ~/Desktop/amtlos-app
     npm install
     npx expo start

   Wichtig: „npm install“ erst ganz durchlaufen lassen (bis „added … packages“ erscheint), dann „npx expo start“.

4. Es erscheint ein QR-Code. Mit der normalen Kamera-App des iPhones scannen → „In Expo Go öffnen“.
   iPhone und Mac müssen im selben WLAN sein. Fragt der Mac, ob „node“ Verbindungen annehmen darf: Erlauben.
5. In der App: „Ohne Konto ausprobieren“ – dann dein Unternehmen anlegen und die Fragen beantworten.
   Unten fünf Bereiche: Heute, Pflichten, Finanzen (Belege, Rechnungen, Umsatzsteuer), Personal (Team,
   Stempeln, Unterweisungen) und Mehr (Gründung, Behördenbriefe, Kalender, Team, Einstellungen).
   Die Pflichten rechnet die App selbst aus (gleiche Regeln wie der Server). Alles bleibt nur auf dem iPhone.

Beenden: im Terminal Ctrl + C. Nächstes Mal reichen die Befehle „cd …“ und „npx expo start“.
TXT
(cd "$ZIEL" && zip -qr amtlos-app.zip amtlos-app -x 'amtlos-app/node_modules/*' 'amtlos-app/.expo/*')
echo "✓ $P"
