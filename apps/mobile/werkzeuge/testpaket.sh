#!/usr/bin/env bash
# Eigenständiges Testpaket für Expo Go (E-119, E-121): die Unterlagen-App ohne Monorepo, die Vorlagen
# (@amtlos/fachlogik) als gebautes JavaScript eingebettet – vorher „pnpm build“.
#   bash apps/mobile/werkzeuge/testpaket.sh <zielordner>
# Ergebnis: <zielordner>/amtlos-app und <zielordner>/amtlos-app.zip
set -euo pipefail
ZIEL="${1:?Zielordner fehlt}"
APP="$(cd "$(dirname "$0")/.." && pwd)"
PAKETE="$APP/../../packages"
P="$ZIEL/amtlos-app"
rm -rf "$P" "$ZIEL/amtlos-app.zip"
mkdir -p "$P"
cp -r "$APP/src" "$APP/assets" "$APP/index.ts" "$P/"
test -f "$PAKETE/fachlogik/dist/index.js" || { echo "packages/fachlogik/dist fehlt – erst pnpm build"; exit 1; }
mkdir -p "$P/pakete/fachlogik"
cp -r "$PAKETE/fachlogik/dist" "$P/pakete/fachlogik/"
find "$P/pakete" -name '*.map' -delete
node - "$APP" "$P" <<'JS'
const fs = require("node:fs");
const [app, p] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(`${app}/package.json`, "utf8"));
for (const k of Object.keys(pkg.dependencies)) if (k.startsWith("@amtlos/")) delete pkg.dependencies[k]; // über tsconfig-Pfade eingebunden
const expoTs = require(require.resolve("typescript/package.json", { paths: [app] })).version;
fs.writeFileSync(`${p}/package.json`, JSON.stringify({
  name: "amtlos-app", version: pkg.version, private: true, main: "index.ts",
  scripts: { start: "expo start" },
  dependencies: pkg.dependencies,
  devDependencies: { ...pkg.devDependencies, typescript: `~${expoTs}` },
}, null, 2) + "\n");
fs.copyFileSync(`${app}/app.json`, `${p}/app.json`);
fs.writeFileSync(`${p}/tsconfig.json`, JSON.stringify({
  extends: "expo/tsconfig.base",
  compilerOptions: { strict: true, skipLibCheck: true, paths: {
    "@amtlos/fachlogik": ["./pakete/fachlogik/dist/index.js"],
  } },
  include: ["index.ts", "src", "pakete"],
}, null, 2) + "\n");
JS
cat > "$P/LIESMICH.txt" <<'TXT'
Amtlos – Unterlagen für deinen Betrieb (Testversion fürs iPhone)

1. Auf dem iPhone: „Expo Go“ aus dem App Store laden.
2. Auf dem Mac: Node.js installieren (https://nodejs.org, Knopf „LTS“, Installer öffnen, durchklicken).
3. Auf dem Mac das Programm „Terminal“ öffnen und eintippen (Ordnerpfad anpassen, falls woanders):

     cd ~/Desktop/amtlos-app
     npm install
     npx expo start -c

   Wichtig: „npm install“ erst ganz durchlaufen lassen (bis „added … packages“ erscheint), dann „npx expo start -c“.

4. Es erscheint ein QR-Code. Mit der normalen Kamera-App des iPhones scannen → „In Expo Go öffnen“.
   iPhone und Mac müssen im selben WLAN sein. Fragt der Mac, ob „node“ Verbindungen annehmen darf: Erlauben.
5. In der App:
   - „Betrieb eintragen“ – einmal Name, Adresse, verantwortliche Person.
   - Unter „Unterlagen“ auswählen, was du brauchst (z. B. Gefährdungsbeurteilung), „Jetzt ausfüllen“.
   - „PDF teilen“: in Dateien sichern, per Mail schicken oder drucken.
   - Unter „Meine“ findest du alles wieder. Alles bleibt nur auf dem iPhone.

Beenden: im Terminal Ctrl + C. Nächstes Mal reichen die Befehle „cd …“ und „npx expo start“.
TXT
(cd "$ZIEL" && zip -qr amtlos-app.zip amtlos-app -x 'amtlos-app/node_modules/*' 'amtlos-app/.expo/*')
echo "✓ $P"
