# Testbericht Bauabschnitt 4 · Finanzen light

Stand: 2026-10-11 · Commits `c7a4782` bis `af7a691` · Spezifikation 12 (Abschnitt 4), 6.5, Katalog C.23, C.29–C.33

## Ergebnis in einem Satz

Rechnungen schreiben, stellen und stornieren, mit **E-Rechnung (XRechnung und ZUGFeRD), die der offizielle KoSIT-Validator in der CI akzeptiert**; Belege hochladen (auch empfangene E-Rechnungen), unveränderlich aufbewahren; die USt-Voranmeldung vorbereiten; Kassen erfassen mit Meldefrist; und der Kleinunternehmer-Wächter warnt bei 80 % und 95 % der Grenze. **389 automatisierte Tests und 37 Datenbanktests grün**, alle fünf CI-Jobs grün.

## Was neu ist

| Bereich | Umfang |
|---|---|
| Datenmodell (Migration 0007) | Rechnungssteller, Kunden, Rechnungen, Rechnungsnummern, Belege, Kassen; RLS, Audit, Worker-Lesezugriff |
| GoBD-Schutz | Dokumente unveränderlich und nicht löschbar, gestellte Rechnungen unveränderlich (nur Storno), Belege nur stornierbar – jeweils durch Datenbank-Trigger, nicht nur in der API |
| Rechnungen | Entwurf → Stellen (Nummer JJJJ-NNNN, Steuersätze aus Regelwerten, PDF mit eingebetteter Schrift, ZUGFeRD-PDF/A-3 und XRechnung für Geschäftskunden) → Storno mit Bezug (Typ 384) |
| Belege | Upload (PDF, JPG, PNG, XML bis 15 MB), Inhalt statt Dateiendung geprüft, doppelte Dateien erkannt, E-Rechnungen (CII/UBL) gelesen und vorbefüllt, keine XML-Entitäten |
| Kleinunternehmer-Wächter | Fakt `finanzen.umsatz.laufendes_jahr` aus den Rechnungen; 2 neue Katalogpflichten (80 %, 95 %), Grenze überschritten auch aus dem tatsächlichen Umsatz; 6 Grenzfall-Fixtures (79.999,99 / 80.000 / 94.999,99 / 95.000 / 100.000 / 100.000,01) |
| USt-Voranmeldung | Umsätze je Satz, Umsatzsteuer, Vorsteuer, Ergebnis je Monat/Quartal; Stornos werden saldiert |
| Kassen | Erfassen und Außerbetriebnahme lösen die Ereignisse aus; Profilangaben werden nachgezogen; Meldefrist 1 Monat (C.33) |
| Web | Navigationspunkt „Finanzen“ mit Übersicht (Grenzbalken mit 80/95-Markierung), Rechnungen, Belege, USt, Kassen, Angaben |
| Regelwerte | Aufbewahrungsfristen 8/10/6 Jahre (C.32); Steuersätze (nicht in der Spezifikation, markiert T-10) |

## Tests

| Bereich | Tests (gesamt nach Abschnitt 4) |
|---|---:|
| Regel-Engine inkl. 29 Fixture-Dateien | 243 |
| Server (Finanzen: Summen nach EN 16931, XRechnung/ZUGFeRD, Lesen, Ablage, Einladungen, Studio) | 28 |
| API (u. a. Rechnung stellen/stornieren, DB-Schutz, Belege, USt, Wächter, Kassen, OpenAPI-Abgleich) | 36 |
| Übersetzungen | 42 |
| Fristen | 21 |
| Validator | 7 |
| Studio | 5 |
| Web | 4 |
| Worker | 3 |
| **Summe** | **389** |
| Datenbank (`db/tests`) | 37 |
| KoSIT-Validator (CI) | 4 Beispielrechnungen: Regelsatz + ermäßigt, Kleinunternehmer, Storno, nur Steuernummer – alle **ACCEPTABLE** |
| E2E Web | Finanzen-Rundgang (Angaben, Kunde, Rechnung stellen, PDF abrufen, Beleg hochladen, USt, Kassen) mit axe; 0 Befunde |
| Lasttest | weiterhin < 30 min für 100.000 Unternehmen (CI, 1.000 Unternehmen) |

## Von Tests gefundene und behobene Fehler

1. **KoSIT:** Rechnungen ohne USt-IdNr. (typisch für Kleinunternehmer) wurden abgelehnt (BR-CO-26). Jetzt Steuernummer als Verkäuferkennung (T-11).
2. Schrift-Untersetzung im PDF stürzte mit der alten fontkit-Version ab – Wechsel auf `@cantoo/fontkit`.
3. Neue Umsatz-Zweige machten bei allen, die nicht in Amtlos fakturieren, „Angabe fehlt“ aus der Grenzprüfung. Jetzt mit Vorhandensein-Prüfung: ohne Rechnungen in Amtlos kein Zweig, keine Frage-Karte.
4. Genau an der Grenze (100.000 €) zeigte keine Warnung; jetzt gilt die 95-%-Warnung bis einschließlich Grenze.
5. Web: leere Antwort bei noch nicht erfassten Rechnungsangaben (null) – jetzt leeres Objekt; Tabellen-Stile fehlten in der Web-App; „1 Belege“.
6. Kassen erfasst, aber Meldepflicht blieb „Angabe fehlt“ – Profilangaben werden jetzt nachgezogen.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Fachliche Freigabe (57 Pflichten, 21 Regelwerte) | keine Prüfer (R-01) | Studio ist bereit |
| Übermittlung USt-VA/Kassenmeldung an ELSTER | wie Abschnitt 3 (T-05) | Gateway steht |
| Kennzahlen des USt-VA-Formulars, Soll-/Ist-Versteuerung | nicht in der Spezifikation (T-08) | Steuerberatung |
| Belegerkennung per Foto (OCR) | braucht das KI-Gateway (Abschnitt 9, LLM-Anbieter mit AVV) | nach Anbieterwahl |
| E-Rechnung per E-Mail empfangen; vollständige Prüfung beim Empfang | Mail-Eingang und KoSIT als Dienst (Java) fehlen | eigener Dienst |
| Bankanbindung (PSD2) | lizenzierter Partner nötig | Partnerwahl |
| DATEV-Export, Zugang für die eigene Steuerberatung | nicht umgesetzt | nächster Schritt in Finanzen |
| Steuerrücklage-Empfehlung (C.36) | Einkommensteuer-Schätzung bräuchte Tarifdaten, die nicht in der Spezifikation stehen | als Regelwerte erfassen, dann bauen |
| Kleinbetragsrechnungen (C.29) | Grenze und Erleichterungen nicht in der Spezifikation | T-09 |
| Lösch-/Freigabefristen (C.32) | Fristbeginn offen (G-21); bis dahin wird nichts gelöscht | – |
| S3 mit Object Lock statt Verzeichnis | Hosting fehlt | mit Hosting |
| PDF/A-Prüfung mit veraPDF | nicht in der CI | ergänzen |
