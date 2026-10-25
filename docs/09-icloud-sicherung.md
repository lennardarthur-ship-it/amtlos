# iCloud-Sicherung – Einrichtung für den eigenen App-Build (E-129)

**Status:** Code und Konfiguration sind vorbereitet. In Expo Go fehlt das native Modul, deshalb blendet die App die Funktion dort aus. Getestet werden kann sie erst mit einem eigenen Build.

**Android (E-190):** Gegenstück ist „Automatisch in einen Ordner sichern“ – der Nutzer wählt einmal einen Ordner über die Ordnerauswahl von Android (auf dem Gerät, Google Drive, Nextcloud …), die App schreibt dort dieselben Dateien nach demselben Ablauf (aktuell, Tag, Woche, Belegordner; `src/unterlagen/cloudLogik.ts`, `cloud.android.ts`). Keine Einrichtung im Build nötig, funktioniert auch in Expo Go. Fehlt der Zugriff später, zeigen „Deine Daten“ und die Sicherungs-Erinnerung „Automatische Sicherung unterbrochen“ mit „Ordner neu wählen“.

## Was die App tut

- Unter „Mein Betrieb → Deine Daten“ steht der Schalter „Automatisch in iCloud sichern“. Er erscheint nur, wenn iCloud verfügbar ist.
- **Einschalten:** Man gibt einmal ein Passwort ein. Daraus wird per PBKDF2-SHA256 (150 000 Runden) ein Schlüssel abgeleitet und im Schlüsselbund gespeichert: nur dieses Gerät, nur entsperrt. Anschließend erstellt die App sofort die erste Sicherung.
- **Danach:** 20 Sekunden nach jeder Änderung schreibt die App eine verschlüsselte Sicherung (AES-256-GCM) nach iCloud Drive. Die Datei hat dasselbe Format wie die Sicherung von Hand, ein neues iPhone öffnet sie also mit dem Passwort.
  - Ordner „Amtlos“: `Amtlos-Sicherung-aktuell.amtlos` und eine Datei je Kalenderwoche (`Amtlos-Sicherung-2026-KW42.amtlos`).
- **Wiederherstellen** auf einem neuen iPhone: „Sicherung wiederherstellen → Letzte Sicherung aus iCloud laden“, dann das Passwort eingeben. Die App führt die Sicherung mit den vorhandenen Daten zusammen, statt sie zu überschreiben.

## Bibliothek und Konfiguration

- **Bibliothek:** `react-native-cloud-storage` 3.2.0 (iCloud Documents, New Architecture, Config-Plugin).
- **Eintrag in `app.json`:** `["react-native-cloud-storage", { "iCloudContainerEnvironment": "Production" }]`.
- **Was das Plugin setzt** (geprüft mit `npx expo config --type introspect`):
  - Container `iCloud.de.amtlos.app`
  - Entitlements `icloud-container-identifiers`, `ubiquity-container-identifiers`, `icloud-services: CloudDocuments`
  - `NSUbiquitousContainers`, im Dateien-App sichtbar unter dem Namen „amtlos“.

## Schritte für den Gründer (Apple-Developer-Konto nötig)

1. Im Apple Developer Portal unter Identifiers den iCloud-Container `iCloud.de.amtlos.app` anlegen.
2. Die App-ID `de.amtlos.app` anlegen und darin iCloud mit „iCloud Documents“ aktivieren. Den Container zuordnen.
3. Einen eigenen Build erstellen: `npx expo prebuild` und Xcode, oder EAS Build (`eas build -p ios --profile development`). Anschließend auf einem iPhone testen, das in iCloud angemeldet ist und iCloud Drive eingeschaltet hat.
4. Für TestFlight: dasselbe mit dem Produktionsprofil.

## Offene Punkte (PRUEFLISTE T-74)

- Den Namen im Dateien-App („amtlos“, aus dem Slug) eventuell auf „Amtlos“ ändern.
- Ob alte Wochensicherungen gelöscht werden sollen, ist offen (Aufbewahrung gegenüber Speicherplatz). Heute bleiben sie liegen.
