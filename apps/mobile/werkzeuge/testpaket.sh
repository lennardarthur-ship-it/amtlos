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
mkdir -p "$P/pakete/i18n" "$P/pakete/marke"
cp -r "$PAKETE/i18n/src" "$P/pakete/i18n/"
# Marke (docs/14-marke.md): Name, Domain, Kontakt aus packages/marke/marke.json
cp "$PAKETE/marke/index.js" "$PAKETE/marke/index.d.ts" "$PAKETE/marke/marke.json" "$P/pakete/marke/"
find "$P/pakete/i18n/src" -name '*.test.ts' -delete
find "$P/pakete" -name '*.map' -delete
node --input-type=module - "$APP" "$P" <<'JS'
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
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
// app.json mit eingesetzter Marke (im Repo setzt app.config.ts sie ein – das Testpaket hat kein app.config.ts)
const marke = await import(`${app}/../../packages/marke/index.js`);
const appJson = marke.markeEinsetzenTief(JSON.parse(fs.readFileSync(`${app}/app.json`, "utf8")));
appJson.expo.name = marke.MARKE.name;
appJson.expo.ios = { ...appJson.expo.ios, infoPlist: { ...appJson.expo.ios?.infoPlist, CFBundleDisplayName: marke.MARKE.name } };
fs.writeFileSync(`${p}/app.json`, JSON.stringify(appJson, null, 2) + "\n");
fs.writeFileSync(`${p}/tsconfig.json`, JSON.stringify({
  extends: "expo/tsconfig.base",
  compilerOptions: { strict: true, skipLibCheck: true, paths: {
    "@amtlos/fachlogik": ["./pakete/fachlogik/dist/index.js"],
    "@amtlos/rules-engine": ["./pakete/rules-engine/dist/index.js"],
    "@amtlos/fristen": ["./pakete/fristen/dist/index.js"],
    "@amtlos/i18n": ["./pakete/i18n/src/index.ts"],
    "@amtlos/marke": ["./pakete/marke/index.js"],
  } },
  include: ["index.ts", "src", "pakete"],
}, null, 2) + "\n");
JS
cat > "$P/LIESMICH.txt" <<'TXT'
{{MARKE}} – Testversion für iPhone und Android (Expo Go)

Stand: Commit STAND_COMMIT · Expo SDK 58 · Quellcode, Tests und Entscheidungen im Git-Repository
(GitHub: lennardarthur-ship-it/amtlos). Dieser Ordner ist nur ein Testpaket zum Ausprobieren, nicht der Quellcode.


EINRICHTEN

1. iPhone: „Expo Go“ aus dem App Store laden bzw. aktualisieren.
   Android-Smartphone: „Expo Go“ aus Google Play laden bzw. aktualisieren.
   Das Testpaket braucht die Expo-Go-Version für SDK 58. Meldet Expo Go „Project is incompatible with this version
   of Expo Go“, ist entweder Expo Go oder das Testpaket nicht aktuell.
2. Mac: Node.js installieren (https://nodejs.org, Knopf „LTS“, Installer öffnen, durchklicken).
3. Mac: Programm „Terminal“ öffnen und eintippen (Ordnerpfad anpassen, falls woanders):

     cd ~/Desktop/amtlos-app
     npm install
     npx expo start -c

   „npm install“ erst ganz durchlaufen lassen (bis „added … packages“ erscheint). Nach einem neuen Testpaket mit
   anderen Bibliotheken (z. B. neues Expo SDK) „npm install“ wieder ausführen; sonst reicht „npx expo start -c“.
4. Es erscheint ein QR-Code.
   iPhone: mit der Kamera-App scannen → „In Expo Go öffnen“.
   Android: Expo Go öffnen → „Scan QR code“ und den Code scannen (die Kamera-App von Android öffnet ihn nicht immer
   in Expo Go).
   Smartphone und Mac müssen im selben WLAN sein. Fragt der Mac, ob „node“ Verbindungen annehmen darf: Erlauben.
   Klappt die Verbindung nicht (z. B. Firmen- oder Gäste-WLAN): „npx expo start -c --tunnel“.
5. Beenden: im Terminal Ctrl + C.

Hakt etwas: Expo Go auf dem Smartphone ganz schließen, im Terminal Ctrl + C, dann „npx expo start -c“ und den
QR-Code neu scannen. Hilft das nicht: Ordner „node_modules“ löschen und „npm install“ wiederholen.


RUNDGANG DURCH DIE APP

Unten vier Tabs – Heute · Pflichten · Unterlagen · Mein Betrieb – und rechts der Knopf „+“ für alles Neue.

- Pflichten-Check (Tab „Pflichten“): ein paar Fragen zum Betrieb – Rechtsform (auch OHG und KG), Branche,
  Beschäftigte, Kasse, Website … –, dann zeigt die App, welche Pflichten nach deinen Angaben in Frage kommen,
  mit Termin, Kurztext und Abhaken. „Erinnerungen“ einschalten (Mitteilungen erlauben): Die App erinnert 3 Tage vor
  jedem Termin, ganz ohne Server.
- Heute: der Pflichten-Kompass – wie viele Pflichten jetzt dran sind und wie viele schon erledigt; darunter was als Nächstes dran ist, die Kontrollmappe, offene Rechnungen, die Kasse des Tages, Belege.
- „+“: „Rechnung“, „Beleg“ oder unter „Wofür brauchst du eine Unterlage?“ den Anlass wählen (z. B. „Ich stelle
  jemanden ein“). Schritt für Schritt ausfüllen, unten „Weiter“; am Ende das Dokument ansehen und „PDF teilen“.
  Jede Unterlage hat ihren eigenen Aufbau (Brief, Vertrag, Aushang, Nachweis, Vordruck, Handbuch).
- Rechnungen: Pflichtangaben, Storno, Gutschrift, Abschlag, GiroCode zum Scannen mit der Banking-App; an Firmen
  auch als E-Rechnung (XRechnung). Nach dem Teilen „Zahlung eingegangen“ vermerken.
- Belege: Foto, Datei oder E-Rechnung (XRechnung/ZUGFeRD aus der Dateien-App) – E-Rechnungen füllen sich selbst aus.
- Kasse: Tagesabschluss aus dem Z-Bon, Kassenbuch, Kassensturz mit Zählprotokoll.
- Steuern: Umsatzsteuer-Voranmeldung und EÜR übernehmen die Werte aus Rechnungen, Belegen und Kasse („Aus Rechnungen
  und Belegen übernehmen“); „Mein Betrieb → Paket für die Steuerberatung“ erzeugt ein ZIP mit DATEV-Buchungsstapel,
  Listen und Belegen. Die Werte trägst du selbst in ELSTER ein.
- Unterlagen: alles, was du angelegt hast – mit Summe der offenen Rechnungen, Filtern und Suche.
- Mein Betrieb: Betrieb (Name, Adresse, Rechtsform, verantwortliche Person), Steuer und Bank, Briefkopf (Logo und
  Hausfarbe), Mitarbeiter, Kunden, Betriebsstätten; „Kontrollmappe“ bündelt die Nachweise für eine Kontrolle.
- Deine Daten (Mein Betrieb): alles liegt verschlüsselt nur auf dem Smartphone, auf Wunsch mit Face ID bzw.
  Fingerabdruck gesperrt. „Daten sichern“ erstellt eine mit deinem Passwort verschlüsselte Datei, „Sicherung
  wiederherstellen“ spielt sie zurück. Android: „Automatisch in einen Ordner sichern“ (Pro) – einmal einen Ordner
  wählen (auf dem Smartphone, Google Drive, Nextcloud …), danach sichert die App nach jeder Änderung von selbst dorthin.


KOSTENLOS UND PRO

Kostenlos ist nur das Ausprobieren des Pflichten-Checks: alle Fragen, die Zahl der Pflichten, die nach deinen Angaben
in Frage kommen, und die ersten 3 mit Kurztext, Termin und Abhaken; die übrigen stehen nur als Zahl da. Im Katalog
lassen sich die Vorlagen ansehen.
{{MARKE_PRO}} (mit kostenloser Testphase): alles Weitere – Rechnungen und E-Rechnung, Belege (auch E-Rechnungen
empfangen) und Kasse, alle Pflichten mit Erinnerungen, Paket für die Steuerberatung und Werte per Tipp, Vorlagen
ausfüllen und als PDF, Kontrollmappe, Erklärung jeder Pflicht, Briefkopf, automatische Sicherung (iPhone: iCloud,
Android: ein Ordner deiner Wahl), Synchronisation.
Pro sperrt nie den Zugriff auf eigene Daten: Vorhandenes bleibt sichtbar, Geteiltes lässt sich immer wieder teilen und
drucken, Rechnungen lassen sich immer stornieren, vorhandene Entwürfe bearbeiten, Belege und das Kassenbuch erfasster
Tage ansehen und exportieren; Sicherung, Wiederherstellen, Datenexport und Löschen gehen immer.
Nach dem ersten Pflichten-Check öffnet sich der Bezahlschirm einmal von selbst über dem Ergebnis – „Später“ schließt ihn.
In dieser Testversion gibt es keinen Kauf: „{{MARKE_PRO}}“ (Mein Betrieb) → „Pro testweise einschalten“ zeigt alles.
Im Store-Build gibt es diesen Knopf nicht.


FACHLICHE PRÜFUNG

Den Katalog und die Vorlagen haben Fachleute durchgesehen (Rechtsanwalt, Steuerberater, Fachkraft für
Arbeitssicherheit, Lebensmittelfachbeauftragter). Die App zeigt einen Prüfvermerk nur, wo eine schriftliche Bestätigung
des Prüfers genau diese Fassung abdeckt (Stand 25.10.2026: 226 der 228 Pflichten; zwei neue Einträge warten
auf die Prüfung) – mit der Rolle, nie mit Namen, z. B. „Inhalt fachlich geprüft von einem Rechtsanwalt, Stand …“;
Einschränkungen stehen dabei („ohne arbeitsmedizinische Angaben“), offene Punkte als „teilweise geprüft“.
Alle 43 Vorlagen sind schriftlich bestätigt. Keinen Vermerk zeigen zurzeit die Bilanz (Hilfetext seit der Prüfung
geändert), die Rechnung für GmbH & Co. KG / UG & Co. KG und beim Storno einer Schlussrechnung mit Abschlägen (seit der
Prüfung geändert) sowie die Handelsregister-Vorlage außer für GmbH, OHG und KG (nur diese geprüft).
Der Vermerk gilt je Variante (Rechtsform, Land, Rechnungsart): Jede Änderung hebt ihn für die betroffene Variante auf,
bis erneut geprüft ist. Rechtsberatung im Einzelfall ist die App nicht.


RECHTLICHES IN DER APP („Über {{MARKE}}“)

- Impressum: Anbieter, Anschrift, Vertretung, E-Mail; Handelsregister und USt-IdNr. folgen nach der Eintragung der UG.
- Datenschutzhinweis: auf dem iPhone vom Rechtsanwalt freigegeben (Fassung ohne Synchronisation). Auf Android steht
  eine eigene Fassung (Google Play, Sicherung in einen Ordner) – noch ein Entwurf, als solcher gekennzeichnet.
- Nutzungsbedingungen: inhaltlich freigegeben, in Kraft erst nach der Eintragung der UG – bis dahin als Entwurf
  gekennzeichnet; auf dem iPhone gilt Apples Standard-Lizenzvertrag, Android zeigt bis dahin keinen Link.


WAS IN DER TESTVERSION FEHLT

- Kein Kauf (siehe oben), keine iCloud-Sicherung und keine Synchronisation: Die Synchronisation braucht einen
  laufenden {{MARKE}}-Server und einen Anmeldedienst; ohne Server bleibt alles auf dem Smartphone.
- Expo Go ist eine Test-Umgebung: Aussehen und Tempo können leicht von der späteren App aus dem App Store bzw. von
  Google Play abweichen.

Android in Expo Go – was sich prüfen lässt und was nicht:
- Prüfbar: alle Seiten und Abläufe, Zurück-Taste bzw. Zurück-Geste (schließt Unterseiten und Blätter), Tastatur über
  Eingabefeldern, Kalender (Dialog von Android), Kamera und Fotoauswahl für Belege, PDF teilen und drucken, Erinnerungen
  (Benachrichtigungen erlauben, ab Android 13 fragt das System), App-Sperre mit Fingerabdruck/Gesichtserkennung,
  „Automatisch in einen Ordner sichern“ samt Wiederherstellen aus dem Ordner.
- Nicht prüfbar: Kauf über Google Play (gibt es nur im eigenen Build mit RevenueCat-Schlüssel), App-Symbol und
  Startbild, die gesperrten Berechtigungen und „keine Gerätesicherung“ (gelten erst im eigenen Build), Name der App
  auf dem Startbildschirm.
TXT
STAND="$(git -C "$APP" rev-parse --short HEAD 2>/dev/null || echo unbekannt)"
sed -i.bak "s/STAND_COMMIT/$STAND/" "$P/LIESMICH.txt" && rm -f "$P/LIESMICH.txt.bak"
node --input-type=module -e 'import fs from "node:fs"; const { markeEinsetzen } = await import(process.argv[1]); fs.writeFileSync(process.argv[2], markeEinsetzen(fs.readFileSync(process.argv[2], "utf8")));' "$PAKETE/marke/index.js" "$P/LIESMICH.txt"
(cd "$ZIEL" && zip -qr amtlos-app.zip amtlos-app -x 'amtlos-app/node_modules/*' 'amtlos-app/.expo/*')
echo "✓ $P"
