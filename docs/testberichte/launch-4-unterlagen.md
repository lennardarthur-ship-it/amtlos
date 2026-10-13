# Testbericht Launch-Fokus 4 · Die iPhone-App als Unterlagen-Werkzeug

Stand: 2026-10-12 · Auftrag: „Die App soll an nichts erinnern, sondern bürokratische Aufgaben übernehmen – ohne Fragebogen, der Nutzer wählt selbst, welche Unterlage er braucht“ (E-121)

## Ergebnis in einem Satz

Die App ist jetzt ein Werkzeug für Pflichtunterlagen: Vorlage wählen, ausfüllen, PDF teilen – 15 Vorlagen für alle 18 Katalogpflichten mit Dokument-Generator, alles nur auf dem iPhone, ohne Konto. **Vorlagen-Tests, App-Tests, alle 42 Monorepo-Aufgaben, die Datenbanktests und der Rundgang (hell und dunkel) sind grün.**

## Was die App kann

| Tab | Funktionen |
|---|---|
| Unterlagen | alle Vorlagen nach Bereich (Arbeitsschutz, Datenschutz, Personal, Steuern, Gastronomie, Beauty); je Vorlage: was drinsteht, wozu (Katalogpflichten), Rechtsgrundlage, Quellen, „Jetzt ausfüllen“; Hinweis „Betrieb eintragen“, solange der Betrieb fehlt |
| Formular | speichert bei jeder Eingabe; Listen (Gefährdungen, Stoffe, Teilnehmende …) aufklappbar mit Hinzufügen/Entfernen; Felder erscheinen nur, wenn sie zutreffen (z. B. Begründung bei „kein Risiko“); „Fehlt noch“ nennt fehlende Pflichtangaben, ohne das PDF zu sperren; PDF teilen (Dateien, Mail, AirDrop), Drucken, Kopie anlegen, Löschen |
| Meine | alle angelegten Unterlagen, zuletzt bearbeitete zuerst, mit Stand „vollständig“ oder „n Angaben fehlen“ |
| Mein Betrieb | Name, Adresse, verantwortliche Person, Kontakt – steht im Kopf jeder Unterlage und füllt „Beurteilt von“, „Durchgeführt von“, Kontakt vor; Daten sichern; alles löschen |

Die PDFs: A4 (Tabellen und Aushänge quer), Betrieb im Kopf, Unterschriftsfelder, leere Zeilen zum Nachtragen von Hand (Teilnahmelisten, HACCP-Blatt), am Ende „Vorlage noch nicht fachlich geprüft“.

## Tests

| Prüfung | Ergebnis |
|---|---|
| Vorlagen (`@amtlos/fachlogik`): jede Katalogpflicht mit Dokument-Generator ist abgedeckt; IDs, Titel- und Namensfelder, Bedingungen stimmig; leere und volle Eingaben ergeben ein Dokument mit Prüfhinweis und maskierten Eingaben; Vorbelegung aus dem Betrieb; fehlende Angaben auch in Listen; 72-Stunden-Frist in Berliner Zeit über die Zeitumstellung; Dateinamen; Allergene, Unterschriftszeilen, HACCP-Leerzeilen; Quer-/Hochformat | 8 neu, alle grün |
| App: anlegen/ändern/kopieren/löschen, tolerantes Lesen gespeicherter Stände, Katalogauszug je Vorlage, Datum in deutscher Zeit | 5 |
| Monorepo (lint, typecheck, test) | 42/42 |
| Server und API gegen PostgreSQL (Bezeichnungen jetzt aus der Fachlogik) | 54 / 72 |
| Rundgang (Web-Export, iPhone-Format, hell und dunkel): Betrieb eintragen → Vorlage → ausfüllen → vollständig → PDF-Inhalt → Meine → Allergene (Mehrfachauswahl) → Neustart, Daten bleiben → Kopie und Löschen → alles löschen | ohne Befunde |
| Alle 15 Vorlagen als PDF in Chromium gesetzt und angesehen | lesbar, keine Überläufe |
| iOS-Bündel (Monorepo und Testpaket nach frischer Installation), Typprüfung Testpaket | grün |

## Beim Prüfen gefunden und behoben

1. Im Web lagen ausgeblendete Tabs unsichtbar über dem aktiven und schluckten Tipps – im Web jetzt ganz ausgeblendet (auf dem iPhone wirkte `pointerEvents` schon richtig).
2. Auswahl-Chips meldeten ihren Zustand im Web nicht an Screenreader (`aria-checked` fehlte) – ergänzt für Auswahl, Liste und Mehrfachauswahl.
3. Bei einer Gefährdung stand die lange Liste der Gefährdungsarten vor der eigentlichen Beschreibung – jetzt zuerst Gefährdung und Maßnahme, dann Risiko und Art.
4. Ungültige Daten (z. B. 13. Monat) wurden bei der Fristberechnung still verschoben – jetzt erkannt.

## Fachlich zu prüfen (Prüfliste)

T-52 alle Vorlagen · T-53 Nachweisgesetz (Liste, Form) · T-54 Verfahrensdokumentation (Gliederung) · T-55 Datenschutzinformation (Pflicht- und Kann-Abschnitte) · T-56 Betriebsanweisung, Gefahrstoffverzeichnis · T-57 Hautschutz-, Hygieneplan, HACCP, IfSG-Folgebelehrung.

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Auf echtem iPhone gesehen | bisher Web-Export, iOS-Bündel und Chromium-PDFs | du testest im Testpaket; besonders PDF-Ränder und Querformat aus expo-print |
| Inhalte | die App gibt Gliederung und Beispiele, schreibt aber keine Rechtstexte – der Nutzer füllt aus | nach Freigabe (T-52 ff.) fachlich geprüfte Textbausteine je Branche anbieten |
| Datensicherung | „Daten sichern“ exportiert, Wiederherstellen fehlt | mit dem nächsten Schritt (Datei importieren) |
| Web-App und Server | unverändert – zeigen weiter Pflichtenplan und Erinnerungen | entscheiden, ob die Web-App denselben Weg geht |

## Nachtrag: alle Unterlagen zum Auswählen (E-122)

18 weitere Vorlagen, zusammen 33, mit Suche. Neu: Rechnung, EÜR, Bilanz und GuV, Umsatzsteuer-Voranmeldung, Unterlagen zur Steuererklärung, Kassenbuch, Kassenmeldung, Aufbewahrungsplan, Datenschutzerklärung für die Website, AV-Vertrag, Arbeitszeitnachweis, Personalfragebogen, Lohnkonto, Prüfprotokoll elektrische Geräte, Impressum, Gewerbeanmeldung, Handelsregister, Transparenzregister. Die App zeigt Ergebnisse direkt an (Rechnungsbetrag, Zahllast, Überschuss, Kassenbestand, Arbeitsstunden); Impressum und Datenschutzerklärung lassen sich als Text für die Website teilen.

| Prüfung | Ergebnis |
|---|---|
| Vorlagen-Tests (neu: Beträge lesen, Rechnungssummen je Steuersatz und Kleinunternehmer, Steuernummer aus „Mein Betrieb“, USt-Zahllast und Erstattung, EÜR, Kassenbestand inkl. negativ, Arbeitszeit über Mitternacht, Aufbewahrungsende, Text für Impressum/Datenschutzerklärung) | 15 grün |
| Monorepo / Server und API mit Datenbank | 42/42 · 54 / 72 |
| Rundgang hell und dunkel (neu: Suche, Rechnung mit gerechnetem Betrag 59,50 €, Neustart mit drei Unterlagen) | ohne Befunde |
| Neue PDFs in Chromium angesehen (Rechnung, Voranmeldung, Kassenbuch, Arbeitszeit, Impressum, Lohnkonto) | lesbar |

Fachlich zu prüfen: T-58 bis T-61. Grenze: Was elektronisch übermittelt werden muss, überträgt der Nutzer weiter selbst (ELSTER, sv.net, Portale).

## Nachtrag: Produktqualität und Auswahl statt Freitext (E-123)

Neue Gestaltung (Briefkopf, Kopfzeile mit Rechtsgrundlage, nummerierte Abschnitte, Linien zum Ausfüllen, Fußzeile mit Seitenzahlen) und vorformulierte Inhalte aus vier Recherchen und einem Prüfbericht. In der App: Vorschläge mit Filter übernehmen, Chips und Bausteine statt Freitext, Prüfungen gegen Mindestlohn, Mindesturlaub, Minijob-Grenze, Befreiungshinweis bei 0 % und berechtigte Interessen (lit. f).

| Prüfung | Ergebnis |
|---|---|
| Vorlagen-Tests (neu: Mindestlohn/-urlaub, Minijob, Vorschlag als Eintrag, „nicht“-Bedingung und Mehrfachauswahl, Bausteine mit Platzhaltern, AVV lit. a–h, lit. f in der Datenschutzinformation, 0 % ohne Befreiungshinweis) | 23 grün |
| App-Tests (inkl. Fußzeile mit Seitenzahlen) | 6 grün |
| Monorepo mit Datenbank | 42/42 |
| Rundgang hell und dunkel (Bundesland, Vorschläge-Auswahl Friseur, Mutterschutz, Rechnung 59,50 €) | ohne Befunde |
| Alle 33 PDFs in Chromium erzeugt, u. a. Gefährdungsbeurteilung, Rechnung, Datenschutzinformation, Prüfprotokoll und Lohnkonto (Querformat) angesehen | lesbar, Fußzeile auf jeder Seite |

Fachlich zu prüfen: T-62 bis T-65. Auf dem iPhone noch anzusehen: Ränder und Fußzeile aus expo-print.

## Nachtrag: geführter Ablauf und neue Startseite (E-124)

Jede Unterlage läuft Schritt für Schritt mit einem Hauptknopf und endet bei einem Abschluss mit Vorschau und „PDF teilen“. Startseite nach Anlässen, Rechnung oben, zuletzt bearbeitete Unterlagen. Mitarbeiter und Kunden werden gemerkt und wieder angeboten, Rechnungsnummern zählen hoch.

| Prüfung | Ergebnis |
|---|---|
| Vorlagen-Tests (neu: jede Vorlage in einem Anlass und mit Kurzbeschreibung ohne Paragrafen, jeder Schritt mit Titel, seltene Felder nie Pflicht, Personen-Zuordnung, Rechnungsnummern, Kurztitel) | 28 grün |
| App-Tests (neu: Nummer beim Anlegen und Kopieren, Felder setzen, Mitarbeiter/Kunden merken und sortieren, tolerant lesen) | 9 grün |
| Monorepo mit Datenbank | 42/42 |
| Rundgang hell und dunkel neu: Betrieb, Rechnung im Ablauf (2026-001, 59,50 €, PDF-Inhalt), Vorschau, zweite Rechnung (2026-002, Kunde gewählt), leere dritte verworfen, Anlass „Sicherheit“ mit Vorschlägen und Details, leerer Eintrag verworfen, Mitarbeiter anlegen und in Unterweisung übernehmen, Allergene, Neustart, Kopie und Löschen, alles löschen | ohne Befunde |
| Alle 33 Vorlagen einmal durch alle Schritte bis zum Abschluss (inkl. „Weitere Angaben“) | ohne Seitenfehler |
| iOS-Bündel mit react-native-webview | gebaut |

Fachlich zu prüfen: T-66. Auf dem iPhone noch anzusehen: Vorschau (WebView), Tastatur über dem „Weiter“-Knopf.

## Nachtrag: Datensicherung und Pflichten-Check (E-125, E-126)

| Prüfung | Ergebnis |
|---|---|
| Sicherung (neu): Wiederherstellen mit Umlauten und Personaldaten, kein Klartext in der Datei, falsches Passwort, veränderte Datei und fremde Datei abgelehnt, neues Salz je Sicherung, Base64 | 5 grün |
| Pflichten-Check (neu): Fragen aus dem Fragebogen, Bedingung UG/GmbH, Ergebnis je Branche/Beschäftigte/Website, keine Radar-Pflichten, Abgleich mit allen Katalog-Fixtures ohne Ereignisse, Fortschritt durch Haken und vollständige Unterlage, Profil tolerant lesen | 5 grün |
| App-Tests gesamt / Vorlagen-Tests | 19 / 28 grün |
| Monorepo mit Datenbank | 42/42 |
| Rundgang hell und dunkel: zusätzlich Pflichten-Check (Salon, 3 Beschäftigte, Kasse, keine Website) mit Ergebnis, Pflichten, Unterlage zur Pflicht, Abhaken; Sichern mit Passwort, alles löschen, falsches Passwort, Wiederherstellen | ohne Befunde |
| Alle 33 Vorlagen einmal durchgeklickt | ohne Seitenfehler |
| iOS-Bündel mit Katalog und Regel-Engine | gebaut (3,6 MB) |

Auf dem iPhone noch zu messen: Dauer der Verschlüsselung (PBKDF2 in JavaScript) und der Auswertung des Katalogs.

## Nachtrag: GoBD und genauerer Check (E-127)

| Prüfung | Ergebnis |
|---|---|
| GoBD (neu): Festschreiben beim Teilen, kein Ändern/Löschen danach, keine Wiedervergabe geteilter Nummern, Storno mit neuer Nummer und negativen Beträgen, Verweis im PDF, verworfener Storno-Entwurf gibt frei, Angaben der Gesellschaft auf der Rechnung, doppelte Nummer, Kleinunternehmer aus dem Check, Kopie als Entwurf, unlesbare Daten nicht überschreiben | 7 grün |
| Check (neu): Haken für wiederkehrende Pflichten nur bis zum Termin, Gründungsschritte bei Bestandsbetrieben abgetrennt, Grund für jede Pflicht, Zusatzfragen klären unklare Pflichten | 4 grün |
| App-Tests gesamt / Vorlagen-Tests | 29 / 28 grün |
| Monorepo mit Datenbank (ohne Cache) | 42/42 |
| Rundgang hell und dunkel: zusätzlich Zusatzfragen, „Weiter“ ohne Antwort gesperrt, „Aus der Gründung“, Rechnung nach dem Teilen festgeschrieben mit „Stornieren“ statt „Löschen“ | ohne Befunde |
| Alle 33 Vorlagen durchgeklickt, iOS-Bündel | ohne Seitenfehler, gebaut |

## Nachtrag: E-Rechnung, Voranmeldung aus Rechnungen, Erinnerungen (E-128)

| Prüfung | Ergebnis |
|---|---|
| KoSIT-Validator 1.6.3, XRechnung-3.0.2-Konfiguration: 8 Server-Beispiele + 3 App-Fälle (Rechnung, Storno, Kleinunternehmer) | 11/11 gültig |
| Fachlogik: Rechnung aus der App → UBL, fehlende Angaben auf Deutsch | 29 grün |
| App: „Jetzt dran“ (14/45 Tage, jede offene Pflicht genau einmal), Erinnerungsplan (nie vor heute, 3 Tage vorher, sortiert, begrenzt, abgehakt fällt heraus), Umsätze je Steuersatz aus festgeschriebenen Rechnungen mit Storno | 31 grün |
| Monorepo mit Datenbank | 42/42 |
| Rundgang hell und dunkel: zusätzlich „Jetzt dran“ auf der Startseite, E-Rechnung nennt fehlende Angaben (E-Mail, Telefon, IBAN) | ohne Befunde |
| Alle 33 Vorlagen durchgeklickt, iOS-Bündel mit expo-notifications | ohne Seitenfehler, gebaut (3,7 MB) |

Auf dem iPhone noch zu prüfen: Erlaubnisdialog und Zustellung der Erinnerungen in Expo Go; Teilen der XML-Datei (Mail, Dateien).

## Nachtrag: Datenschutz, Voranmeldung, Gestaltung, Fristen (E-129)

| Prüfung | Ergebnis |
|---|---|
| Verschlüsselte Ablage: kein Klartext (Name, SV-Nummer, Steuer-ID, IBAN), falscher Schlüssel und veränderte Daten werden erkannt | grün |
| Zusammenführen: festgeschriebene Rechnung bleibt, neuere Fassung gewinnt, fehlende kommt dazu, doppelte Nummer gemeldet | grün |
| Löschschutz und Sicherungs-Erinnerung (ungesichert / gesichert / danach geändert), automatische Sicherung im selben Format, mit Passwort lesbar | grün |
| Voranmeldung: Soll nach Leistungsdatum (Leistung September, Rechnung Oktober → September), Storno im Monat des Stornos, Leistungszeitraum als Ersatz gemeldet; Ist nach Zahlungseingang, unbezahlte zählen nicht | grün |
| E-Rechnung Wien (AE), Niederlande (K), Länder aus Präfix/USt-IdNr., fehlendes Land wird erfragt | grün; KoSIT 13/13 gültig |
| Fristen: Einzelunternehmen ohne Beratung 02.08.2027, mit Beratung 01.03.2027 (ESt, GewSt, USt-Jahreserklärung), GmbH KSt 01.03.2027 | wie Übersicht der Finanzverwaltung |
| Rechnung als DIN-5008-Brief: Gestalt „brief“, Hausfarbe, Fußzeilen-Spalten mit Bank, PDF mit gestempelter Fußzeile, Falz- und Lochmarken | grün, Sichtprüfung als PDF |
| Alle 33 Vorlagen in neuer Gestalt gerendert (Vorschau und Druck) | Sichtprüfung ohne Fehler |
| App-Tests / Fachlogik-Tests | 38 / 30 grün |
| Rundgang hell und dunkel: Start auf „Pflichten“, Hausfarbe, Check mit Steuerberatungs-Frage, „Jetzt dran“ und „Kurz klären“, Rechnung als Brief, Zahlung vermerken, Löschen gesperrt bis zur Sicherung, Zusammenführen erklärt | ohne Befunde |
| Alle 33 Vorlagen durchgeklickt, iOS-Bündel | ohne Seitenfehler, gebaut (5,4 MB inkl. Schriften) |

Auf dem iPhone noch zu prüfen: Face ID in Expo Go, Logo aus den Fotos, PDF-Druck mit den Rändern je Gestalt (expo-print), Verschlüsselung beim ersten Start mit vorhandenen Daten.
