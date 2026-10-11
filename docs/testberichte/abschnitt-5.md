# Testbericht Bauabschnitt 5 · Personal und Arbeitsschutz

Stand: 2026-10-11 · Commits ab `51939f6` · Spezifikation 12 (Abschnitt 5), 6.6, Katalog D (37–49) und E (50–57)

## Ergebnis in einem Satz

Einstellen und Austritt mit automatischer Checkliste, Schwellenwert-Wächter, digitale Unterweisungen mit Bestätigung und PDF-Protokoll, manipulationsgeschützte Zeiterfassung sowie Gefährdungsbeurteilung, Geräteprüfung und Gefahrstoffverzeichnis. Dazu kommen die Kataloge D und E. **459 automatisierte Tests und 49 Datenbanktests sind grün**, ebenso die E2E-Rundgänge in Web und Studio (axe, WCAG 2.2 AA, hell/dunkel, Desktop/mobil).

## Was neu ist

| Bereich | Umfang |
|---|---|
| Katalog | 33 Pflichten in D (Personal) und E (Arbeitsschutz), alle ungeprüft und markiert. Insgesamt 89 Pflichten, 25 Regelwerte (u. a. Mindestlohn 2026/2027, Minijob-Grenze 2026/2027, Schwellen 20/50/150, Ersthelfer 2). 3 neue Fixtures (Gastro-Team, Mittelbetrieb an den Schwellen, Zählweise offen) |
| Engine | Fristoption `je_ereignis`: eine Instanz je Einstellung, Unfall oder Unterweisung (E-091) |
| Datenmodell (0008, 0009) | Beschäftigte (datensparsam, E-090), Unterweisungen und Bestätigungen, Zeiteinträge (nur anhängen, Korrektur als neuer Eintrag), Gefährdungsbeurteilung und Gefährdungen, Arbeitsmittel mit Prüfhistorie, Gefahrstoffe. Alles mit RLS, Audit und Schutz-Triggern |
| Personal | Einstellen (Ereignisse `einstellung`/`erste_einstellung`, Profilanzahlen werden nachgezogen), Austritt, Checkliste je Person aus den entstandenen Pflichten, CSV-Export für das Lohnbüro |
| Schwellenwert-Wächter | Für 10, 20, 50, 150, 250 Beschäftigte und „eine Person mehr“ rechnet die Engine, was neu hinzukäme. Ist die Zählweise offen, steht „zu prüfen“ (E-093) |
| Unterweisungen | Inhalt gehasht. Bestätigung mit eigenem Namen als einfache elektronische Signatur. Abschluss: PDF-Protokoll, Ereignis, Wiedervorlage nach einem Jahr, Pflichten erledigt mit Nachweis (E-092) |
| Zeiterfassung | Kommen/Gehen für jede Person, Nachtrag mit Grund, Korrektur oder Storno (der alte Eintrag bleibt sichtbar), Monatsübersicht, CSV. Mobil bedienbar |
| Arbeitsschutz | Gefährdungsbeurteilung nach Faktoren mit Maßnahmen, Umsetzung und Wirksamkeit, PDF beim Abschluss (erledigt die Pflicht, optional auch Mutterschutz). Elektrische Geräte mit vom Betrieb gesetztem Prüfintervall. Gefahrstoffverzeichnis mit Sicherheitsdatenblatt und PDF (E-094) |
| Web | Navigationspunkt „Personal“ ersetzt „Melden“ („Änderung melden“ steht jetzt auf „Heute“). 9 neue Seiten. „In Amtlos erledigen“ auf Pflicht-Details. Anleitungen in der Hilfe (DE/EN) |

## Tests

| Bereich | Tests (gesamt nach Abschnitt 5) |
|---|---:|
| Regel-Engine inkl. 32 Fixture-Dateien und `je_ereignis` | 296 |
| Server | 28 |
| API: Personal, Checkliste, Schwellen, Unterweisung, Zeiten, Gefährdungsbeurteilung, Geräte, Gefahrstoffe, DB-Schutz, OpenAPI-Abgleich | 45 |
| Übersetzungen (DE/EN vollständig) | 46 |
| Fristen | 21 |
| Validator | 7 |
| Web (u. a. Ortszeit/Sommerzeit, Ziele) | 8 |
| Studio | 5 |
| Worker | 3 |
| **Summe** | **459** |
| Datenbank (`db/tests`) | 49, davon 12 neu: offener Stempel einmalig, Zeiteinträge unveränderlich, Korrektur-Sicht, Unterweisung gesperrt nach Bestätigung, Beurteilung gesperrt nach Abschluss (nur Umsetzung nachtragbar), Prüfprotokolle unveränderlich, Mandantentrennung |
| E2E Web | Personal-Rundgang: einstellen, Checkliste, Unterweisung bestätigen und abschließen (PDF), stempeln, nachtragen, korrigieren (Dauer geprüft), Gefährdungsbeurteilung abschließen, Geräteprüfung, Gefahrstoff mit Sicherheitsdatenblatt und Verzeichnis-PDF. axe ohne Befunde |

## Von Tests gefundene und behobene Fehler

1. Das Textfeld „Inhalt“ der Unterweisung hatte dieselbe ID wie der Hauptbereich (`#inhalt`, Sprunglink). Dadurch war das Formularlabel falsch zugeordnet. Das Feld hat jetzt eine eigene ID.
2. Der Schwellenwert-Wächter listete eine Pflicht bei jeder höheren Stufe erneut. Jetzt steht je Stufe nur, was neu dazukommt, plus die Stufe „eine Person mehr“. So erscheinen niedrige Schwellen wie Ersthelfer nicht erst „ab 10“.
3. Eine in der Zukunft datierte Unterweisung löst noch keine Wiederholungspflicht aus (das Ereignis ist noch nicht eingetreten). Der Test nutzt jetzt das heutige Datum, das Verhalten ist so gewollt.
4. Eine Einstellung oder ein Austritt, frei über „Melden“ erfasst, hätte ein Ereignis ohne Person erzeugt. Beides läuft jetzt nur noch über „Personal“.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Fachliche Freigabe der Kataloge D/E (33 Pflichten) | keine Prüfer (R-01) | Studio ist bereit |
| Lohn-Partner-Integration | Partnerwahl und Vertrag (T-12). SV-Meldungen brauchen zertifizierte Software | bis dahin CSV-Export |
| Branchenvorlagen für die Gefährdungsbeurteilung | fachlicher Inhalt (T-20) | Sifa/BG-Handlungshilfen |
| Vorlage „Nachweis der Arbeitsbedingungen“ (NachwG) | Vorlagentext braucht juristische Freigabe | Dokumentengenerator mit Prüfung |
| Verbandbuch, Ersthelfer, Unfallanzeige erst ab > 3 Tagen AU | Bedingung auf Ereignis-Daten fehlt in der Engine (T-21) | Ereignis-Payload in Bedingungen |
| Zeiterfassung offline (App) und Neuregelung 2027 | Mobile App ist Abschnitt 10, Gesetz noch im Entwurf (Radar) | für Offline-Stempel fehlt noch eine Client-ID (Idempotenz wie bei Ereignissen) |
| Prüftermine der Geräte im Kalender und als Erinnerung | bisher nur in der Geräteliste | mit dem Erinnerungsdienst |
| DOCX-Export, Prüfungsmappe | 6.4, noch nicht gebaut | eigener Schritt |
