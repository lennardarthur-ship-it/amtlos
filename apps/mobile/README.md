# Amtlos – iPhone-App (Expo)

**Welche Pflichten gelten für meinen Betrieb? Welche Unterlage brauche ich? → Schritt für Schritt ausfüllen → fertiges PDF.**
Kein Konto, kein Server: alles liegt verschlüsselt auf dem iPhone (E-121, E-129).

Vier Tabs (E-131):

- **Pflichten:** vor dem Check die Einladung und „So hilft dir Amtlos“; danach „Jetzt dran“, „Diesen Monat“, „Kurz klären“
  (die wirksamsten offenen Fragen), alle Pflichten nach Bereich, Gründungsschritte, lokale Erinnerungen (E-126 bis E-129).
- **Vorlagen:** „Rechnung schreiben“, zuletzt bearbeitete Unterlagen, Anlässe („Ich stelle jemanden ein“ …), alle 33 Vorlagen
  mit Suche. Antippen startet den geführten Ablauf (ein Abschnitt je Bildschirm, Abschluss mit Vorschau und PDF).
  „Wozu brauche ich das?“ zeigt Zweck, Rechtsgrundlage und Quellen aus dem Katalog.
- **Unterlagen:** alle angelegten Unterlagen mit Summe der offenen Rechnungen, Filter (Alle · Rechnungen · Offen · Entwürfe)
  und Suche; öffnen beim Abschluss (Vorschau, teilen, drucken, E-Rechnung, Zahlung vermerken, stornieren, kopieren, löschen).
- **Mein Betrieb:** Übersicht wie in den iOS-Einstellungen – Angaben, Steuer und Bank, Briefkopf (Logo, Hausfarbe), Gesellschaft,
  Pflichten-Check-Antworten, Mitarbeiter und Kunden, verschlüsselte Sicherung (Datei, iCloud vorbereitet), Face-ID-Sperre.

Rechnungen sind fortlaufend nummeriert, werden beim Teilen festgeschrieben (GoBD, E-127), lassen sich als XRechnung teilen
(E-128) und speisen die Umsatzsteuer-Voranmeldung nach Soll oder Ist (E-129). Dokumente haben je Zweck eine eigene Gestalt
(Brief, Vertrag, Aushang, Nachweis, Vordruck, Handbuch – docs/10, E-130) mit eingebetteten Schriften.

## Aufbau

- `src/App.tsx` Tabs, Sperre, Tastaturleiste, Meldungen · `src/zustand.tsx` Stand (verschlüsselt in AsyncStorage) ·
  `src/texte.ts` alle Texte der App.
- `src/seiten/` ein Modul je Seite: `Pflichten`, `Check`, `Unterlagen` (Vorlagen), `Meine`, `Betrieb`, `Ablauf`, `Abschluss`,
  `Liste` (Einträge und Vorschläge), `Sicherung`, `InfoSeite`.
- `src/ui/` Bausteine (`bausteine.tsx`), Stapel-Navigation ohne Zusatzpaket (`navigation.tsx`), Auswahlseite, Datumswähler
  (`datumwahl.tsx`, Web: Textfeld), Meldungen (`meldung.tsx`), Farben und Skala (`thema.ts`).
- `src/unterlagen/` reine Funktionen über dem Stand (`speicher.ts`, `ablage.ts`, `ustAusRechnungen.ts`), Verschlüsselung
  (`tresor.ts`, `schluesselbund.ts`), Sicherung (`sicherung.ts`, `cloud.ts`), PDF (`pdf.ts`, `fusszeile.ts`, Schriften).
- `src/pflichten/` Katalogauszug (`katalog.json`, erzeugt), Auswertung auf dem Gerät (`check.ts`), Erinnerungen.
- Vorlagen (Formular und HTML-Dokument) liegen in `@amtlos/fachlogik` (`src/dokumente`), vorformulierte Inhalte in
  `bausteine.ts` (erzeugt aus `docs/recherche/2026-10-12`, E-123).

Den Hinweis, Inhalte vor Gebrauch zu prüfen, zeigt die App am Formular (fachliche Freigabe: PRUEFLISTE T-52 ff.).

```bash
pnpm --filter @amtlos/mobile start          # Expo Dev Server (Expo Go)
pnpm --filter @amtlos/mobile test           # Speicher, Ablage, Sicherung, USt, Katalogauszug, Version
pnpm --filter @amtlos/fachlogik test        # Vorlagen: Katalogabdeckung, Pflichtangaben, Dokumente, Gestaltung
pnpm --filter @amtlos/mobile typecheck && pnpm --filter @amtlos/mobile lint
cd apps/mobile && npx expo export --platform ios                                # Bündel prüfen
cd apps/mobile && node e2e/rundgang.mjs <web-export> <bilder>                   # Rundgang (DUNKEL=1), siehe Kopf der Datei
node werkzeuge/katalog-buendel.mjs          # nach Katalogänderungen: Katalogauszug neu schreiben
node werkzeuge/schriften.mjs                # nach Schriftänderungen: eingebettete Schriften neu schreiben
```

**Auf dem iPhone testen:** `bash werkzeuge/testpaket.sh <ordner>` (vorher `pnpm build`) baut ein eigenständiges Paket
mit Anleitung (`LIESMICH.txt`): Node installieren, `npm install`, `npx expo start`, QR-Code mit Expo Go öffnen.

**Version:** `src/version.ts`, `app.json` und `package.json` tragen dieselbe Nummer (ein Test prüft das).

**Offen vor Store-Veröffentlichung:** fachliche Freigabe der Vorlagen (T-52 ff.), EAS-Projekt und Signierschlüssel,
Store-Texte und Datenschutzangaben (App Privacy, Export-Compliance: T-77), Test auf echten Geräten (PDF-Ränder, Querformat,
Datumswähler, VoiceOver), Fensterkuvert- und GiroCode-Probe (T-75, T-76).
