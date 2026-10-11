# Testbericht Bauabschnitt 9 · Assistent, Radar, Postfach, Marktplatz

Stand: 2026-10-11 · Spezifikation 5, 6.10–6.12, 12 (Abschnitt 9)

## Ergebnis in einem Satz

Das Rechtsänderungs-Radar zeigt, was auf das Unternehmen zukommt, mit Wahrscheinlichkeit und Vorbereitung. Nach jedem Katalog-Release meldet Amtlos, was sich für jede Person ändert. „Frag Amtlos“ antwortet nur aus dem Katalog, mit Quelle und Prüfstand. Behördenbriefe kommen mit ihrer Frist in Kalender und „Heute“. Der Marktplatz vermittelt geprüfte Partner mit ausdrücklicher Einwilligung. **600 automatisierte Tests und 62 Datenbanktests sind grün**, die E2E-Rundgänge in Web und Studio ebenfalls (axe ohne Befunde).

## Was neu ist

| Bereich | Umfang |
|---|---|
| Radar (E-103) | 2 neue Radar-Pflichten (Gründungsbeschleunigung, USt-VA für Neugründer). Die vorhandenen Entwürfe (DSB-Streichung, KI-VO Hochrisiko und Transparenz, Arbeitszeit-Neuregelung, Entgelttransparenz-Bericht) haben in neuer Version Checklisten zur Vorbereitung. Das Radar zeigt außerdem in Kraft gesetzte Regeln, die in den nächsten 24 Monaten gelten werden, und neue Werte (alt → neu). Es wird bei jedem Aufruf berechnet und nicht gespeichert |
| Benachrichtigungen | Nach einer Neuberechnung durch ein Release: neue und geänderte Pflichten je Person, ab 10 Meldungen eine Sammelmeldung, keine Meldungen bei der ersten Berechnung. Restriktive RLS-Policy: jede Person sieht nur ihre eigenen Meldungen. Auf „Heute“ einzeln oder alle als gelesen markieren |
| Frag Amtlos (E-100) | Gewichtete Suche über Pflichten und Regelwerte, Bonus für geltende Pflichten, Schwelle für „weiß ich nicht sicher“, Erkennung von Beratungsfragen mit Verweis auf Partner. Kein Sprachmodell, `ki_formuliert: false`. Suchfeld auf „Heute“ |
| Behörden-Postfach (E-101) | Hochladen (Inhalt und Typ geprüft, doppelte Briefe abgewiesen), Einordnen mit der Frist aus dem Brief, Verknüpfung mit einer Pflicht, erledigen und wieder öffnen. Allgemeine Erklärung je Briefart. Fristen erscheinen auf „Heute“ (60 Tage), im Kalender und im ICS-Abo, zusammen mit den Geräteprüfungen |
| Marktplatz (E-102) | Partnerpflege im Studio (nur Admin/Redaktion, sichtbar nur mit geprüfter Zulassung). Liste mit Filter nach Qualifikation, Partner aus dem eigenen Bundesland zuerst. Anfrage mit Einwilligung: gespeichert und versendet wird genau das Gewählte. Versand über die Warteschlange. Keine Zahlung, keine Provision |
| Datenmodell (0013) | `behoerdenbrief`, `katalog.partner`, `marktplatz_anfrage` (alle mit RLS und Audit), RLS-Policy „eigenes Konto“ für Benachrichtigungen |
| API | 13 neue Routen: `termine`, `briefe` (5), `radar`, `benachrichtigungen` (2), `frage`, `partner`, `marktplatz/anfragen`, `partner/:id/anfrage` |
| Web | Seiten Radar, Frag Amtlos, Postfach mit Briefansicht, Experten mit Anfrageformular. „Heute“ zeigt Meldungen, weitere Fristen, das Suchfeld und den Radar-Link. Im Kalender stehen jetzt auch Brieffristen und Geräteprüfungen. Postfach in der Desktop-Seitenleiste, „Mehr“ auch am Desktop (E-104) |
| Studio | Seite „Marktplatz-Partner“ |

## Tests

| Bereich | Tests (gesamt nach Abschnitt 9) |
|---|---:|
| Regel-Engine inkl. 48 Fixture-Dateien (neu: Radar Bestand, Radar Gründung) | 398 |
| Server (neu: Frag Amtlos – Treffer, Beratung, Unsicherheit, Regelwert am Stichtag; Release-Benachrichtigungen; Partnerpflege) | 43 |
| API (neu: Radar, Frag Amtlos, Benachrichtigungen nur eigene, Postfach mit Fristen in Termin und ICS, Marktplatz mit Einwilligung) | 62 |
| Übersetzungen | 51 |
| Fristen | 21 |
| Validator | 7 |
| Web | 10 |
| Studio | 5 |
| Worker | 3 |
| **Summe** | **600** |
| Datenbank (`db/tests`, neu: Benachrichtigungen nur fürs eigene Konto, Partner nur übers Studio) | 62 |
| E2E Studio | Partner ohne geprüfte Zulassung lässt sich nicht sichtbar schalten; Partner mit Zulassung wird angelegt |
| E2E Web | Radar; Frage über das Suchfeld auf „Heute“ mit Antwort aus dem Katalog; Brief hochladen, einordnen, Frist auf „Heute“ und im Kalender; Anfrage an den Partner aus dem Studio-Rundgang mit Einwilligung. axe ohne Befunde, hell/dunkel, Desktop/mobil |

In CI läuft der Studio-Rundgang jetzt vor dem Web-Rundgang, damit der Partner für die Marktplatz-Anfrage existiert.

## Von Tests gefundene und behobene Fehler

1. Der Prüfstatus für „Frag Amtlos“ las eine Spalte, die es nicht gibt (`art` statt `objekt_art`). Der API-Test hat das gefunden.
2. Benachrichtigungen kamen nach jedem Release erneut, auch für schon erledigte Pflichten. Verglichen werden jetzt nur offene Instanzen.
3. Im Server-Test scheiterte das Anlegen einer Meldung an FORCE RLS, weil der Kontext fehlte. Der Test setzt den Kontext jetzt; die Policy selbst war richtig.
4. Der Kalender-Termin eines Briefs verlinkte auf die Postfach-Übersicht statt auf den Brief. Er verlinkt jetzt den Brief.
5. Zwei Fehler steckten nur in den E2E-Tests (die Anwendung war in Ordnung): Der Knopf „Hochladen“ war mehrdeutig, weil das Dateifeld ähnlich beschriftet ist, und der Test erwartete „Zulassung“ in Großschreibung.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Fachliche Freigabe der Radar-Einträge und Checklisten | keine Prüfer (R-01, T-40) | Studio ist bereit |
| Sprachmodell für Frag Amtlos | Anbieter, AVV, EU-Hosting offen | Schnittstelle `KiGateway` ist vorbereitet (E-100) |
| Texterkennung, KI-Zusammenfassung und E-Mail-Eingang im Postfach | Anbieter offen, J-2 | nach Klärung |
| Vergütung im Marktplatz, Bewertungen | J-4 | Festpreis-Listung oder Partner-Abo |
| Meldungen zusätzlich per E-Mail und Push | Benachrichtigungseinstellungen fehlen noch | mit den Einstellungen und der mobilen App (Abschnitt 10) |
| Erklärungstexte je Briefart | fachlich (T-37) | Prüfung RA/StB |
