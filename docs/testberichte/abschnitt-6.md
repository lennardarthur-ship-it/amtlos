# Testbericht Bauabschnitt 6 · Datenschutz, IT-Sicherheit, KI

Stand: 2026-10-11 · Spezifikation 12 (Abschnitt 6), 6.7, Katalog F (58–65)

## Ergebnis in einem Satz

Abschnitt 6 bringt den Katalog F mit 19 Pflichten, einen VVT-Assistenten, TOM nach Schutzzielen und eine Dienstleisterliste mit AVV-Ablage. Dazu kommen Betroffenenanfragen mit Fristuhr, ein Datenpannen-Notfallknopf (72-Stunden-Countdown, Meldeentwurf, unveränderliche Dokumentation), KI-Kompetenz-Schulungen mit Nachweis und die NIS2-Klärung. **503 automatisierte Tests und 55 Datenbanktests sind grün**, ebenso die E2E-Rundgänge in Web und Studio (axe, WCAG 2.2 AA, hell/dunkel, Desktop/mobil).

## Was neu ist

| Bereich | Umfang |
|---|---|
| Katalog F | VVT, TOM, AVV, Informationspflichten, Löschkonzept; Betroffenenanfrage (je Eingang, 1 Monat); Datenpanne (je Panne, 72 h); Datenschutzbeauftragter ab 20 (Zählweise offen) und Radar „Streichung § 38 BDSG“; DSFA-Prüfung; Videoüberwachung; Beschäftigtendaten; Cookie-Einwilligung (§ 25 TDDDG); NIS2 prüfen, registrieren (Nachfrist 31.7.2026), Meldepflichten; KI-Kompetenz (Art. 4), Transparenz ab 2.12.2026 (Radar), Hochrisiko verschoben (Radar). Alles ungeprüft und markiert |
| Fakten, Ereignisse, Regelwerte | `profil.datenschutz.dienstleister`, `profil.nis2.betroffen`; Ereignis `betroffenenanfrage`; Regelwert DSB-Schwelle 20; drei neue Onboarding-Fragen |
| Fixtures | 5 neue: Agentur mit KI und Dienstleistern, Solo ohne Angaben, Praxis mit Gesundheitsdaten/Video/NIS2/Panne/Anfrage, DSB-Grenzfälle 19 und 20 |
| Datenmodell (0010) | Verarbeitungen, TOM, Dienstleister, Betroffenenanfragen, Datenpannen (Entdeckung unveränderlich, „kein Risiko“ nur mit Begründung, nach Abschluss gesperrt, nicht löschbar), Unterweisungen mit Art (Arbeitsschutz, KI-Kompetenz, Datenschutz) |
| API | 26 neue Routen; Profilangabe „Dienstleister“ wird beim Erfassen gesetzt; Dokumentation (VVT + TOM + Dienstleister) als PDF; Ablage erledigt VVT/TOM/AVV, soweit vollständig |
| Web | Neuer Bereich „Datenschutz“ (die Einstellungen stehen mobil im Kopf, E-096). Notfallknopf, Live-Countdown, Meldeentwurf, Fristuhr für Anfragen, KI-Schulung mit Gliederungsvorschlag. „In Amtlos erledigen“ für alle neuen Pflichten. Zwei neue Anleitungen in der Hilfe |
| Turbo | Tests hängen jetzt auch von Katalog, Migrationen und Schema ab. Vorher konnte ein Cache-Treffer veraltete Ergebnisse zeigen |

## Tests

| Bereich | Tests (gesamt nach Abschnitt 6) |
|---|---:|
| Regel-Engine inkl. 37 Fixture-Dateien | 332 |
| Server | 28 |
| API (neu: Katalog F im Lauf, VVT/TOM/AVV und Ablage, Anfrage mit Frist und Erledigung, Datenpanne bis zum Abschluss inkl. DB-Schutz, KI-Schulung) | 50 |
| Übersetzungen | 49 |
| Fristen | 21 |
| Validator | 7 |
| Web | 8 |
| Studio | 5 |
| Worker | 3 |
| **Summe** | **503** |
| Datenbank (`db/tests`) | 55, davon 6 neu |
| E2E Web | Datenschutz-Rundgang: Notfallknopf, Countdown, Bewertung, Meldeentwurf-PDF, Meldung, Abschluss; VVT aus Vorschlag; TOM; Dienstleister; Anfrage erfassen und beantworten; Dokumentation ablegen; KI-Schulung. axe ohne Befunde, auch dunkel und mobil |

## Von Tests gefundene und behobene Fehler

1. Der Turbo-Cache meldete nach Katalogänderungen alte Engine-Ergebnisse (296 statt 332 Tests), weil der Katalog nicht als Eingabe galt. Behoben über `inputs`.
2. In der Pflichtenliste zeigt der Status „bald fällig“ statt „offen“, sobald die Frist näher als 14 Tage ist. Der Test der Datenpanne erwartet das jetzt (fachlich richtig).
3. Datums- und Uhrzeitfelder bei der Panne waren am Desktop über die volle Breite gezogen. Jetzt stehen sie kompakt nebeneinander.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Fachliche Freigabe Katalog F (19 Pflichten, 1 Regelwert) | keine Prüfer (R-01) | Studio ist bereit |
| Vorlagen (Datenschutzerklärung, Informationsblatt, AVV-Muster, TOM-Vorschlagsliste) | Rechtsinhalte, nicht in der Spezifikation (T-22, T-24) | Dokumentengenerator mit Freigabe |
| NIS2-Betroffenheitscheck mit Sektoren und Schwellen | nicht in der Spezifikation (T-26) | Zulieferung RA/BSI-Kriterien |
| Benachrichtigung der Betroffenen bei hohem Risiko (Art. 34) | eigene Pflicht noch nicht angelegt (T-23) | nach Prüfung |
| Consent-Check der eigenen Website | Teil des Online-Checks (Abschnitt 7) | Abschnitt 7 |
| Meldung direkt an die Aufsichtsbehörde | keine einheitliche Schnittstelle; Länderportale | Link je Land nach Prüfung |
