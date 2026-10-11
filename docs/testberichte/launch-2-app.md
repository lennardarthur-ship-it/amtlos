# Testbericht Launch-Fokus 2 · App für iPhone

Stand: 2026-10-11 · Ziel: die App so ruhig und klar wie möglich, zuerst für iOS (E-117)

## Ergebnis in einem Satz

Die App ist neu gestaltet: Fristblatt in jeder Zeile, eine klare nächste Handlung auf „Heute“, Pflicht-Karte mit Erledigen und Stempel-Moment, Schnellstart und Nachfragen direkt in der App – alles im Designsystem des Webs, in Hell und Dunkel geprüft. **Typprüfung, Lint, 8 Kerntests, iOS- und Android-Bündel grün.**

## Was sich geändert hat

| Bereich | Umfang |
|---|---|
| Designsystem in der App | Farben wie `designsystem.css` (hell/dunkel), Atkinson Hyperlegible, Typskala, Bausteine (`T`, `Symbol`, `Fristblatt`, `Knopf`, `Abschnitt`, `Zeile`, `Hinweis`, `Status`, `Stempel`) |
| Anmelden | ruhiger Einstieg mit Marke, Kennung, Rechtsseiten |
| Heute | Datum als Unterzeile, „Jetzt dran“ als Karte mit Fristblatt und Knopf, „Danach“, Fortschritt, Nachfragen-Runde als Blatt von unten, Willkommen nach dem Schnellstart |
| Pflichten | Gruppen Überfällig · Diese Woche · Diesen Monat · Später · Laufend (`gruppen.ts`, getestet) |
| Pflicht-Karte | Blatt von unten: Fristblatt groß, Status, Erledigen (Feder-Stempel, Haptik), Wieder öffnen, Warum, Was sonst, Mehr, Quellen; „zu klären“ verweist auf den Computer |
| Schnellstart | Unternehmen anlegen und fünf Schritte in der App, dieselben Fragen wie im Web (E-111); Nachfragen in Runden von „Heute“ aus |
| Stempeln | Person als Chip, eine große Karte mit laufender Dauer, Pause, ein Knopf |
| Beleg | Kamera als Fläche, Fotos als zweiter Weg |
| Mehr | Konto mit Abo-Stand (nur Hinweis, kein Kauf – T-49), Push, Sprache, Unternehmen, Rechtsseiten, Abmelden |
| Technik | SF Symbols (`expo-symbols`) mit Ionicons-Ersatz, Tableiste mit Unschärfe, Haptik, Schriften über `expo-font`, Splash; SecureStore mit AsyncStorage-Ersatz im Web-Export |

## Tests

| Prüfung | Ergebnis |
|---|---|
| `tsc --noEmit` | grün |
| `eslint src test` | grün |
| Vitest (API-Client, Warteschlange, Zeit, Gruppen) | 8 grün |
| `expo export --platform ios` / `android` | Bündel gebaut |
| Bildschirmfotos (Web-Export, 393×852, hell und dunkel) | Anmelden, Heute, Pflichten, Pflicht-Karte, Nachfragen, Stempeln, Beleg, Mehr gesichtet |

## Beim Prüfen gefunden und behoben

1. Der `fetch`-Aufruf im API-Client war ungebunden und scheiterte im Browser – jetzt als Pfeilfunktion gebunden.
2. SecureStore gibt es im Web-Export nicht – Ersatz über AsyncStorage, Start der App schlägt nicht mehr fehl.
3. Die untere Zeile der „Jetzt dran“-Karte lief bei langen Status-Texten über – Status und Knopf stehen jetzt untereinander.
4. Ein Nutzer mit mehreren Unternehmen sah den Schnellstart, weil das erste Unternehmen kein Profil hatte – erwartetes Verhalten, in den Fotos mit einem Ein-Unternehmen-Konto geprüft.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Echte iOS-Darstellung | nur über den Web-Export gesichtet; SF Symbols, Unschärfe und Haptik laufen nur auf dem Gerät | Development Build auf iPhone, VoiceOver-Rundgang |
| Abo-Hinweis in der App | Store-Regeln (T-49) | vor der Einreichung klären |
| Android | läuft, aber nicht gestaltet | nach iOS-Launch |
