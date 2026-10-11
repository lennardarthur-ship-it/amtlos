# Testbericht Bauabschnitt 10 · Mobile Apps, Englisch, Partner/White-Label, Skalierung

Stand: 2026-10-11 · Spezifikation 12 (Abschnitt 10), 6.6, 8, 10, 11

## Ergebnis in einem Satz

Steuerberatungen sehen alle Mandanten auf einen Blick und legen neue an. Partner können Amtlos unter eigener Marke anbieten, die Barrierefreiheit bleibt dabei garantiert. Alle 732 Katalogtexte gibt es auf Englisch, als ungeprüfte KI-Übersetzung ehrlich gekennzeichnet. Die mobile App (Expo) stempelt auch offline und erinnert per Push. Ein Lasttest mit 10.000 Unternehmen hat zwei Skalierungsfehler gefunden, beide sind behoben. **626 automatisierte Tests und 71 Datenbanktests sind grün**, die E2E-Rundgänge in Web und Studio ebenfalls (axe ohne Befunde), dazu die Bündelung der App für Android und iOS.

## Was neu ist

| Bereich | Umfang |
|---|---|
| Kanzlei (E-106) | `/kanzlei`: alle eigenen Unternehmen mit Ampel, Zählern und dringendster Pflicht, Überfälliges zuerst. Mandant anlegen: Die Kanzlei wird Steuerberatung, die Mandantin erhält eine Einladung als Inhaberin. Inhaber-Einladungen sind nur auf diesem Weg möglich (Datenbankregel). Rollentext für Inhaber in Einladung und E-Mail |
| White-Label (E-105) | Marken im Studio (nur Admin): Name, Hosts, Farben hell/dunkel mit Kontrastprüfung ≥ 4,5 : 1, https-Logo. Web erkennt die Marke am Host: Name „… mit Amtlos“, Farben, Seitentitel. Neue Unternehmen merken sich die Marke (Lizenzbericht als Anzahl) |
| Englisch (E-107) | Übersetzungsschicht am deutschen Text, vorberechnete lokalisierte Dokumente, Sichten für alle lesenden Stellen. 732 Texte (KI, Status „maschinell“), Prüfung im Studio, geprüfte gewinnen beim Import. Sprache der Oberfläche je Anfrage (`X-Sprache`), Kontosprache für E-Mails/Push. Hinweis „deutsche Fassung verbindlich“ in der englischen Oberfläche |
| Mobile App (E-108) | `apps/mobile` (Expo SDK 54): Anmelden (OIDC/PKCE, in dev mit Kennung), Heute, Pflichten, Stempeln mit Offline-Warteschlange, Beleg-Foto, Push einschalten, Unternehmen und Sprache. Farben und Tippziele nach Designsystem, Screenreader-Rollen |
| Offline-Stempel | `client_id` (idempotent), Gerätezeitpunkt höchstens 72 Stunden alt und nicht in der Zukunft, Kennzeichnung `offline`. Sofort gesendete Stempel nutzen die Serverzeit, abgelehnte werden angezeigt |
| Push | Geräte je Konto (RLS), Registrierung über Funktion (Token-Wechsel), Push-Kanal in der Erinnerungsplanung, Expo-Push im Worker (Standard aus), ungültige Tokens werden abgemeldet |
| Erinnerungseinstellungen | E-Mail/Push und Tage vorher je Person und Unternehmen (API und Einstellungen in der Web-App) |
| Skalierung (E-109) | 24 fehlende Indizes für den RLS-Filter (0017) plus Schematest, der die Regel erzwingt. Erinnerungen werden nur als Differenz geschrieben, Katalog-Stand in einer Abfrage |
| Datenmodell | 0014 (Marken, Mandantenanlage), 0015 (Übersetzungen, Kontosprache), 0016 (Offline-Stempel, Geräte), 0017 (Indizes) |
| API | 11 neue Routen: `mandanten` (2), `marke`, `ich/sprache`, `geraete` (3), `benachrichtigungen/einstellungen` (2), `dev/token`, plus Offline-Felder an `zeiten/kommen` und `zeiten/gehen` |
| Hilfe | Anleitungen „Mandanten verwalten“ und „App und Erinnerungen“ |

## Tests

| Bereich | Tests (gesamt nach Abschnitt 10) |
|---|---:|
| Regel-Engine inkl. 48 Fixture-Dateien | 398 |
| Server (neu: Marken und Kontrast, Übersetzungen prüfen und importieren, Abdeckung aller Katalogtexte, Zahlen in Übersetzungen, Expo-Push) | 54 |
| API (neu: Marke zum Host, Mandant anlegen bis Inhaberin, Unternehmen unter Marke, englische Katalogtexte und Frag Amtlos auf Englisch, Offline-Stempel, Dev-Token, Geräte, Push-Erinnerung mit Abmeldung ungültiger Tokens) | 70 |
| Übersetzungen (Oberfläche) | 51 |
| Fristen | 21 |
| Validator | 7 |
| Web | 10 |
| Studio | 5 |
| Worker | 3 |
| Mobile (API-Client, Offline-Warteschlange, Zeit) | 7 |
| **Summe** | **626** |
| Datenbank (`db/tests`, neu: Inhaber-Einladung, Marken, Geräte, Index-Regel) | 71 |
| E2E Studio | Übersetzung als geprüft markieren. Redaktion darf keine Marken pflegen. Admin legt eine Marke an, ein zu helles Gelb wird abgewiesen |
| E2E Web | Mandant anlegen mit einmaligem Link. Englische Oberfläche mit englischen Katalogtexten, Hinweis und `lang="en"`. Markenadresse in hell und dunkel mit Name, Titel und Farbe, axe prüft dort auch den Kontrast der Markenfarbe |
| Mobile | Typprüfung und Metro-Bündel für Android und iOS (auch in CI) |
| Lasttest | 10.000 Unternehmen: Tageswechsel hochgerechnet 14,8 min für 100.000 (vorher 24,3) |

## Von Tests gefundene und behobene Fehler

1. **Lasttest:** 24 Mandantentabellen hatten keinen Index für den RLS-Filter. Jede Abfrage durchlief alle Mandanten. Behoben mit 0017 und einer Schemaregel.
2. **Lasttest:** Erinnerungen wurden täglich komplett gelöscht und neu geschrieben. Jetzt nur noch Unterschiede. Ein Worker-Test hat dabei verhindert, dass Sofort-Erinnerungen um bis zu 15 Minuten verschoben werden.
3. Die Sprache der Web-Oberfläche kam nie bei der API an, weil nur ein Cookie gesetzt wurde. Katalogtexte wären auch auf Englisch deutsch geblieben. Jetzt geht die Sprache als `X-Sprache` mit, Einstellungen speichern sie auch fürs Konto.
4. Die Spalte für den Übersetzungsschlüssel war mit `sha256(convert_to(…))` nicht als generierte Spalte erlaubt (nicht immutable). Jetzt MD5 über den Text, nur als Suchschlüssel.
5. Die App hätte offline gestempelte Zeiten unter dem gerade gewählten statt dem ursprünglichen Unternehmen übertragen. Jeder Stempel trägt jetzt sein Unternehmen.
6. Die Einladungs-E-Mail kannte die Rolle „Inhaber“ nicht. Mandanten-Einladungen hätten die Rolle leer gezeigt.
7. Fehler nur in Tests: Groß- und Kleinschreibung („Berufszulassung“), Zeitpunkte, die zu verschiedenen Momenten berechnet wurden.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Store-Veröffentlichung der App | Identity-Provider (E-061), EAS-Projekt, Signierschlüssel, Store-Datenschutzangaben, Test auf echten Geräten mit VoiceOver/TalkBack | nach Hosting- und IdP-Entscheidung |
| Push einschalten | Drittland über APNs/FCM (T-41) | AVV und Hinweis, dann `PUSH_ANBIETER=expo` |
| Englische Texte prüfen | 732 KI-Übersetzungen (T-42), prod-Release-Bedingung (G-24) | Prüfung im Studio |
| White-Label rechtlich | Impressum, Verantwortlichkeit, Vertrag (T-43). Links in E-Mails zeigen noch auf die Amtlos-Adresse | mit Hosting und Partnervertrag |
| Kanzlei: Vollmacht/AVV | T-45 | Muster nach Klärung |
| Offline-Stempel rechtlich | T-44 | |
| Erstberechnung nach großem Release | ≈ 35 min für 100.000 auf 2 Kernen, Grund ist das Audit je Instanz (G-22) | eigener DB-Server; ggf. gebündeltes Audit |
| Ratenbegrenzung bei mehreren Instanzen | G-23 | Ingress |
| PWA offline (Web) | Die App deckt das mobile Offline-Stempeln ab; die Web-App ist installierbar, aber nicht offline | nur bei Bedarf |
