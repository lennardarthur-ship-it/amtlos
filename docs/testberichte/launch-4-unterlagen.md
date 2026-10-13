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

## Nachtrag: Dokumente neu gesetzt (E-130)

| Prüfung | Ergebnis |
|---|---|
| Alle 33 Vorlagen plus lange Rechnung (34 Positionen, 2 Seiten) und Storno mit zwei Betrieben (Salon mit Logo und Hausfarbe, GmbH) als Vorschau-Bild und Chromium-PDF, Kontaktbögen durchgesehen | Sichtprüfung ohne Befund nach drei Korrekturrunden (NachwG-Nummerierung, Randspalte im VVT, Aushang ohne Nummern, Querformat volle Breite, Grußformel bleibt beim Dank) |
| Mehrseitige PDFs (Rechnung, Gefährdungsbeurteilung, Verfahrensdokumentation, VVT) mit gestempelter Fußzeile und Kopfzeile ab Seite 2, Tabellenköpfe wiederholt | grün |
| GiroCode: Nutzdaten (BCD/002/1/SCT, Name, IBAN, EUR-Betrag, Verwendungszweck) aus dem gerenderten PDF mit zbar dekodiert | byteweise richtig |
| Ohne IBAN: kein GiroCode, stattdessen „Zahlbar innerhalb von 14 Tagen“ | grün |
| Fachlogik-Tests (neu: gestaltung.test.ts) / App-Tests / Lint / Typecheck / volle Pipeline mit Datenbank | 32 / 38 grün, 42 Aufgaben grün |
| Rundgang hell und dunkel, alle 33 Vorlagen durchgeklickt, iOS-Bündel | ohne Befunde, ohne Seitenfehler, gebaut (5,4 MB) |

Auf dem iPhone noch zu prüfen: Druck mit den Rändern je Gestalt (expo-print), GiroCode-Scan mit einer Banking-App, Fensterkuvert (T-75).

## Nachtrag: Profi-Qualität der App (E-131)

| Prüfung | Ergebnis |
|---|---|
| Rundgang hell und dunkel mit neuer Struktur: Betrieb über Vorlagen eintragen (Bundesland auf Auswahlseite), Check, Rechnung, Mein Betrieb als Übersicht (Kopf, Gruppen, „1 Kunde“), Mitarbeiter auf eigener Seite, Ablage mit Filtern, Sichern, alles löschen, Wiederherstellen | ohne Befunde (26 Bilder je Modus) |
| Alle 33 Vorlagen durchgeklickt | ohne Seitenfehler |
| Ablage: offene Summe brutto ohne bezahlte, stornierte und Entwürfe; Filter nur, wenn sie etwas bewirken; Suche nach Name, Nummer, Kunde | grün (ablage.test.ts) |
| Version in App, app.json und package.json gleich | grün |
| App-Tests / Lint / Typecheck | 41 grün / 0 Fehler, 0 Warnungen / sauber |
| Sichtprüfung der neuen Bildschirme hell und dunkel (Start, Mein Betrieb, Mitarbeiter, Ablage, Rechnung mit kurzen Zahlungsziel-Chips) | wie geplant |

Auf dem iPhone noch zu prüfen: Kalenderbogen (Datumswähler) und „Fertig“-Leiste in Expo Go, Haptik der Meldungen, Startbild, App-Symbol auf dem Home-Bildschirm (nur im eigenen Build sichtbar).

## Nachtrag: Pro, Store-Paket, Belege und Steuerberater-Paket (E-132, E-133)

| Prüfung | Ergebnis |
|---|---|
| Bezahlschirm aus der Hausfarbe heraus (Grund, Freiumfang, Abo-Hinweis), Pro testweise einschalten, Pro-Status und „Über Amtlos“ unter „Mein Betrieb“ | grün im Rundgang |
| Freikontingent: erste Ausgaben je Monat, Stornos und erneutes Teilen frei, Briefkopf nur mit Pro | grün (pro.test.ts) |
| Store-Texte in den Grenzen, Store-Bilder 1290 × 2796 aus echtem Demo-Stand | grün (store.test.ts), Sichtprüfung |
| E-Rechnung (XRechnung) über die Dateiauswahl → Beleg mit Lieferant und Betrag 77,35 €, Original abgelegt, in der Ablage unter „Belege“ | grün im Rundgang hell und dunkel |
| Paket für die Steuerberatung „Jahr 2026“: DATEV-Stapel, Listen, Belegoriginal; fehlende E-Rechnung wegen fehlender Betriebsangaben gemeldet | grün im Rundgang |
| Sicherung mit Beleg (Version 2), Wiederherstellen bringt Beleg zurück | grün im Rundgang und in belege.test.ts |
| Vorsteuer nach Belegdatum, EÜR nach Zahlung, Paketinhalt byte-genau | grün (belege.test.ts) |
| App-Tests gesamt | 54 grün |

Auf dem iPhone noch zu prüfen: Kamera-Foto eines Belegs, ZUGFeRD-PDF aus Mail/Dateien, Teilen des ZIP, Kauf in der Sandbox.

## Nachtrag: Konto und Synchronisation (E-134)

| Prüfung | Ergebnis |
|---|---|
| Sync-Schlüssel in der Hülle: richtiges Passwort öffnet, falsches und veränderte Hülle nicht; kein Klartext im verschlüsselten Stand; Gerätegebundenes bleibt draußen | grün (sync.test.ts) |
| Zusammenführen: neuere Fassung gewinnt, Gelöschtes kommt nicht zurück (außer danach geändert), festgeschriebene Rechnung wird nie ersetzt, Zahlung wandert mit, doppelte Nummern gemeldet | grün (sync.test.ts) |
| Synchronisieren gegen Server im Speicher: Belegdatei hin und zurück, Löschen kommt an, 409 → neu zusammenführen ohne Verlust, Abbruch nach drei Konflikten | grün (sync.test.ts) |
| API: einrichten, Version/409, Dateien unveränderlich, Klartext abgelehnt, fremdes Konto sieht nichts, Beenden und Konto löschen räumen auf | grün (api.test.ts) |
| Zwei Geräte gegen die echte API (`e2e/sync.mjs`): anmelden, einrichten, falsches Passwort, verbinden, Daten beider Seiten auf beiden Geräten, Server ohne Klartext, Beenden auf B → A hört auf, Konto löschen → abgemeldet, Daten bleiben | grün |
| Rundgang ohne Server (Testpaket): nichts von Konto/Sync sichtbar | grün hell und dunkel |
| App-Tests gesamt | 66 grün |

Auf dem iPhone noch zu prüfen: Anmeldung über den Systembrowser mit dem gewählten Identity-Provider, Synchronisation großer Belegfotos über Mobilfunk, Verhalten nach Abo-Ende in der Sandbox.

## Nachtrag: Qualitätsdurchgang (E-135)

| Prüfung | Ergebnis |
|---|---|
| Storno einer Rechnung mit Rabatt hebt sie in USt und XRechnung genau auf; Preis in der XRechnung nie negativ; Menge 2,345 ungerundet | grün (storno-nachlass.test.ts) |
| Storno auf Gerät A und Zahlung auf Gerät B bleiben beide erhalten (Sync und Wiederherstellen, alle Richtungen); entfernte Zahlung und verworfener Storno-Entwurf kommen nicht zurück; Zahlung aus alter Sicherung bleibt | grün (sync.test.ts) |
| Freikontingent am Monatswechsel nach deutscher Zeit, Kopie mit heutigem Datum, doppelte Nummern nach Änderungen | grün (pruefbefunde.test.ts) |
| Rundgang hell und dunkel mit neuen Texten (gestapelte Knöpfe, kurze Zeilen, sichtbare Feldrahmen, zweizeilige Titel) | grün |
| Sync-Rundgang mit zwei Geräten | grün |
| App-Tests gesamt | 73 grün |

Auf dem iPhone noch zu prüfen: Abbrechen im Teilen-Menü (Rechnung bleibt Entwurf, Sicherung gilt nicht als erstellt), VoiceOver-Ansagen, Ladefehler-Bildschirm (nur mit absichtlich beschädigten Daten), iCloud-Sicherung mit vielen Belegfotos.

## Nachtrag: Zweiter Qualitätsdurchgang (E-136)

| Prüfung | Ergebnis |
|---|---|
| 33 Vorlagen als PDF (realistisch, Grenzfall, leer): Satzspiegel, Unterschrift allein, Aushang auf einem Blatt | grün (`werkzeuge/dokumente-pruefen.mjs`, auch in der CI) |
| Fußzeile GmbH ungekürzt, lange Anschrift ohne Überdeckung, Zahlenköpfe rechtsbündig, Bilanz-Summen auf einer Linie | grün, Sichtprüfung vorher/nachher |
| Erste Rechnung ohne Betrieb: Hinweis in Schritt 1, „Absender ergänzen“ statt Sackgasse, „Rechnung geteilt“ | grün im Rundgang |
| Pflichten-Check mit Zwischenschirm, eigenem Fortschritt der Zusatzfragen, „Überspringen“; Ergebnis mit den ersten drei Pflichten | grün im Rundgang |
| „Kurz klären“ ohne Fragen, die für die Rechtsform nicht gelten | grün (pflichten.test.ts) |
| Rechnungsliste mit Kunde, Betrag, Nummer, Datum; Belege mit Betrag | grün im Rundgang hell und dunkel |
| Rückfragen als System-Dialog (Löschen, Storno, Beenden, Konto löschen) | grün in Rundgang und Sync-Rundgang |
| Store-Texte in den Grenzen, Pro-Kennzeichnung, keine Behörden-Aussage | grün (store.test.ts, store-check ohne neue Blocker) |

Auf dem iPhone noch zu prüfen: System-Dialoge, Kundenauswahl mit vielen Kunden, Druck der Allergen-Matrix und der Fußzeile auf echtem A4.
