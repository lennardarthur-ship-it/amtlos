# Amtlos – iPhone-App: Unterlagen (Expo)

**Welche Unterlage brauchst du? → Schritt für Schritt ausfüllen → fertiges PDF.** Keine Erinnerungen, kein Fragebogen, kein Konto (E-121, E-124).

- **Unterlagen:** „Rechnung schreiben“, zuletzt bearbeitete, Anlässe („Ich stelle jemanden ein“ …), alle 33 Vorlagen
  mit Suche. Antippen startet den geführten Ablauf (ein Abschnitt je Bildschirm, Abschluss mit Vorschau und PDF).
  „Wozu brauche ich das?“ zeigt Zweck, Rechtsgrundlage und Quellen aus dem Katalog.
- **Meine:** angelegte Unterlagen – öffnen beim Abschluss (Vorschau, teilen, drucken, kopieren, löschen).
- **Mein Betrieb:** Betrieb (steht im Kopf jeder Unterlage), Mitarbeiter und Kunden (füllen Unterlagen vor und werden
  beim Ausfüllen gemerkt), Datensicherung.

Alles bleibt auf dem Gerät (AsyncStorage). Die Vorlagen (Formular und HTML-Dokument) liegen in
`@amtlos/fachlogik` (`src/dokumente`), vorformulierte Inhalte in `bausteine.ts` (erzeugt aus
`docs/recherche/2026-10-12`, E-123). PDF mit expo-print, Fußzeile mit Seitenzahlen per pdf-lib, Teilen mit expo-sharing,
Vorschau mit react-native-webview (Web: iframe). Ablauf: `src/seiten/Ablauf.tsx`, Abschluss, Listen und Vorschläge daneben.
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
