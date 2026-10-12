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
# Pflichten-Check (E-126): Regel-Engine und Fristen gebaut, Fragen (i18n) als Quelltext
for paket in rules-engine fristen; do
  test -f "$PAKETE/$paket/dist/index.js" || { echo "packages/$paket/dist fehlt – erst pnpm build"; exit 1; }
  mkdir -p "$P/pakete/$paket"
  cp -r "$PAKETE/$paket/dist" "$P/pakete/$paket/"
done
mkdir -p "$P/pakete/i18n"
cp -r "$PAKETE/i18n/src" "$P/pakete/i18n/"
find "$P/pakete/i18n/src" -name '*.test.ts' -delete
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
    "@amtlos/rules-engine": ["./pakete/rules-engine/dist/index.js"],
    "@amtlos/fristen": ["./pakete/fristen/dist/index.js"],
    "@amtlos/i18n": ["./pakete/i18n/src/index.ts"],
  } },
  include: ["index.ts", "src", "pakete"],
}, null, 2) + "\n");
JS
cat > "$P/LIESMICH.txt" <<'TXT'
Amtlos – Unterlagen für deinen Betrieb (Testversion fürs iPhone)

Dies ist nur ein Testpaket zum Ausprobieren in Expo Go – nicht der Quellcode. Quellcode, Tests, CI und
Entscheidungen liegen im Git-Repository (GitHub: lennardarthur-ship-it/amtlos). Stand: Commit STAND_COMMIT.

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
   - „Pflichten-Check starten“ – ein paar Fragen, dann zeigt die App, welche Pflichten für deinen Betrieb gelten.
   - „Betrieb eintragen“ – einmal Name, Adresse, verantwortliche Person.
   - „Rechnung schreiben“ oder unter „Wofür brauchst du etwas?“ den Anlass wählen (z. B. „Ich stelle jemanden ein“).
   - Schritt für Schritt ausfüllen, unten „Weiter“. Am Ende siehst du das Dokument und tippst „PDF teilen“.
   - Unter „Meine“ findest du alles wieder; unter „Mein Betrieb“ stehen Mitarbeiter und Kunden.
     Alles bleibt nur auf dem iPhone. „Daten sichern“ erstellt eine mit deinem Passwort verschlüsselte Datei,
     „Sicherung wiederherstellen“ spielt sie zurück.
   - „Deine Pflichten“ zeigt oben, was jetzt dran ist. Dort „Erinnerungen“ einschalten (Mitteilungen erlauben):
     Die App erinnert 3 Tage vor jedem Termin – ganz ohne Server.
   - Rechnung an eine Firma: im Abschluss „Als E-Rechnung teilen (XRechnung)“. Fehlt dafür etwas, sagt die App was.
   - „Umsatzsteuer-Voranmeldung“: übernimmt die Umsätze aus deinen geteilten Rechnungen mit einem Tipp.

Beenden: im Terminal Ctrl + C. Nächstes Mal reichen die Befehle „cd …“ und „npx expo start“.
TXT
STAND="$(git -C "$APP" rev-parse --short HEAD 2>/dev/null || echo unbekannt)"
sed -i.bak "s/STAND_COMMIT/$STAND/" "$P/LIESMICH.txt" && rm -f "$P/LIESMICH.txt.bak"
(cd "$ZIEL" && zip -qr amtlos-app.zip amtlos-app -x 'amtlos-app/node_modules/*' 'amtlos-app/.expo/*')
echo "✓ $P"
