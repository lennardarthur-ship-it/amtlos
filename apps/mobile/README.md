# Amtlos – iPhone-App: Unterlagen (Expo)

**Welche Unterlage brauchst du? → ausfüllen → fertiges PDF.** Keine Erinnerungen, kein Fragebogen, kein Konto (E-121).

- **Unterlagen:** 33 Vorlagen (E-121 bis E-123) – Steuern und Buchhaltung, Datenschutz, Personal, Arbeitsschutz,
  Betrieb/Register/Website, Gastronomie, Beauty – mit Suche. Je Vorlage: wozu, Rechtsgrundlage und Quellen aus dem
  Katalog. Was elektronisch ans Amt geht, erstellt die App ausgefüllt bzw. ausgerechnet zum Übertragen.
- **Meine:** angelegte Unterlagen bearbeiten, als PDF teilen oder drucken, kopieren (z. B. nächster Monat), löschen.
- **Mein Betrieb:** einmal eintragen – steht im Kopf jeder Unterlage und füllt Namen und Kontakt vor.

Alles bleibt auf dem Gerät (AsyncStorage). Die Vorlagen (Formular und HTML-Dokument) liegen in
`@amtlos/fachlogik` (`src/dokumente`), vorformulierte Inhalte in `bausteine.ts` (erzeugt aus
`docs/recherche/2026-10-12`, E-123). PDF mit expo-print, Fußzeile mit Seitenzahlen per pdf-lib, Teilen mit expo-sharing.
Den Hinweis, Inhalte vor Gebrauch zu prüfen, zeigt die App am Formular (fachliche Freigabe: PRUEFLISTE T-52 bis T-65).

```bash
pnpm --filter @amtlos/mobile start          # Expo Dev Server (Expo Go)
pnpm --filter @amtlos/mobile test           # Speicher, Katalogauszug
pnpm --filter @amtlos/fachlogik test        # Vorlagen: Katalogabdeckung, Pflichtangaben, Dokumente, 72-h-Frist
pnpm --filter @amtlos/mobile typecheck
cd apps/mobile && npx expo export --platform ios                                # Bündel prüfen
cd apps/mobile && node e2e/rundgang.mjs <web-export> <bilder>                   # Rundgang, siehe Kopf der Datei
node werkzeuge/katalog-buendel.mjs          # nach Katalogänderungen: Katalogauszug neu schreiben
```

**Auf dem iPhone testen:** `bash werkzeuge/testpaket.sh <ordner>` (vorher `pnpm build`) baut ein eigenständiges Paket
mit Anleitung (`LIESMICH.txt`): Node installieren, `npm install`, `npx expo start`, QR-Code mit Expo Go öffnen.

**Offen vor Store-Veröffentlichung:** fachliche Freigabe der Vorlagen (T-52 ff.), EAS-Projekt und Signierschlüssel,
Store-Texte und Datenschutzangaben, Test auf echten Geräten (PDF-Ränder und Querformat, VoiceOver), Datensicherung
wiederherstellen (bisher nur exportieren).
