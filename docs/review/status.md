# Investor-Readiness-Review – Stand der 32 Punkte

Review von Frida Steinmeyer vom 12.10.2026. Status von Amtlos-Seite, zum gemeinsamen Abgleich beim nächsten Termin. „Erledigt“ heißt umgesetzt und getestet; „Entscheidung“ heißt, Lennard muss die Richtung festlegen, bevor gebaut wird.

Das Review wurde am Stand vor E-124 erstellt. Antworten von Frida vom 12.10. (Weg b, lokale Erinnerungen, Nische im Termin) sind eingearbeitet. Einige Befunde (Startseite „Wähle aus, was du brauchst“, gelber Prüfhinweis auf jeder Vorlage) waren am selben Abend schon überholt.

| # | Priorität | Befund | Status | Notiz |
|---|---|---|---|---|
| 1 | Kritisch | Vorlagen-App statt Plattform-Vision | In Arbeit | Entschieden: Weg b (Mittelweg). Pflichten-Check gebaut (E-126); Plattform vom 11.10. als Roadmap im Pitch. |
| 2 | Kritisch | Keine Nutzer, kein Store-Release | Offen | Braucht Apple-Developer-Konto, EAS-Projekt, Store-Texte, Datenschutzangaben. |
| 3 | Kritisch | 0 von 43 Pflichten geprüft | Offen | Prüfpunkte für den Fachbeirat liegen vor: PRUEFLISTE T-52 bis T-66. |
| 4 | Kritisch | Kein Preis, keine Bezahlfunktion | Entscheidung | Hängt an 1 und 6. |
| 5 | Kritisch | Sicherung verschickt Personaldaten im Klartext | **Erledigt** | E-125: AES-256-GCM, Passwort ≥ 10 Zeichen, nichts im Klartext. Tests und Rundgang prüfen das. |
| 6 | Kritisch | Kein Grund zum Wiederkommen | **Erledigt (Prototyp)** | E-128: lokale Erinnerungen ohne Server (3 Tage vor jedem Termin offener Pflichten, 9 Uhr), „Jetzt dran / Diesen Monat“ in „Deine Pflichten“ und auf der Startseite. Auf dem iPhone noch zu testen (Expo Go: Mitteilungen erlauben). |
| 7 | Kritisch | Kein Vertriebskanal belegt | Offen | Gründerseite (Kanzleien, Kammern, Verband). |
| 8 | Hoch | Nutzer muss selbst wissen, was gilt | **Erledigt (Prototyp)** | E-126: Pflichten-Check mit bis zu 10 Fragen, Katalog und Regel-Engine auf dem Gerät, „Deine Pflichten“ mit Unterlage je Pflicht. |
| 9 | Hoch | Betriebsprofil ohne Branche, Rechtsform, Mitarbeiterzahl | **Erledigt** | E-126: Profil aus dem Check, änderbar unter „Mein Betrieb“. |
| 10 | Hoch | Sicherung nicht zurückspielbar | **Erledigt** | E-125: „Sicherung wiederherstellen“ mit Passwort und Vorschau des Inhalts. |
| 11 | Hoch | App behauptet Prüfhinweis auf jedem PDF | **Erledigt** | E-124: Satz korrigiert. Der Hinweis steht in der App (Abschluss, „Wozu“), nicht im PDF. |
| 12 | Hoch | „Nicht geprüft“ auf jeder Vorlage | In Arbeit | Hinweis steht fest in der Einleitung des Checks, beim Ergebnis, bei jeder Pflicht und im Abschluss jeder Unterlage (nicht im PDF). AGB folgen; Siegel nach Prüfung. |
| 13 | Hoch | RDG/StBerG ungeklärt | Offen | Kurzgutachten einer Kanzlei; vor einem Pflichten-Check besonders wichtig. |
| 14 | Hoch | Rechnung nur als PDF | **Erledigt (XRechnung)** | E-128: „Als E-Rechnung teilen (XRechnung)“, KoSIT-geprüft; fehlende Angaben werden genannt. ZUGFeRD fehlt; fachlich T-69. |
| 15 | Hoch | Kein Analytics, kein Crash-Reporting | Entscheidung | Verträgt sich nur datenschutzfreundlich mit „alles bleibt auf dem iPhone“; Anbieter wählen. |
| 16 | Hoch | 4 Ordnerkopien, 5 ZIPs, kein Git | **Erledigt** | Das GitHub-Repo mit CI ist die einzige Quelle; der Desktop-Ordner war nur das Testpaket. Alte Kopien liegen im Ordner „Amtlos-Archiv“; das Testpaket nennt Repo und Commit. Release-Tags: offen (lassen sich aus dieser Umgebung nicht pushen). |
| 17 | Hoch | Roter CI-Lauf | **Kein Befund** | Rote Läufe stammen vom 11.10. vormittags. Seitdem sind alle Läufe grün. |
| 18 | Hoch | Rollen Recht, Vertrieb, Technik fehlen | Offen | Gründerseite. |
| 19 | Hoch | Alle Branchen gleichzeitig | Offen | Entscheidung im Termin; Lennard bringt eine Liste mit erreichbaren Betrieben je Branche mit. |
| 20 | Hoch | Keine AGB, Haftungsbegrenzung, Versicherung | Offen | Anwalt, Versicherung. |
| 21 | Mittel | Branchenvorschläge starten auf „Alle“ | **Erledigt** | E-126: „Passend für dich“ nach der Branche aus dem Check. |
| 22 | Mittel | Rechtsgrundlage und Kategorie im Kopf der Kundenrechnung | **Erledigt** | E-125. |
| 23 | Mittel | Schriftmix, kein Logo | Offen | |
| 24 | Mittel | Risiko und Bußgeld pro Pflicht nicht sichtbar | Teilweise | Einstufung, Zuständigkeit und Termin je Pflicht sichtbar. Bußgeldbeträge fehlen im Katalog – erst nach fachlicher Erfassung (keine erfundenen Zahlen). |
| 25 | Mittel | Kein Fortschrittswert | **Erledigt** | E-126: „Deine Pflichten“ mit Prozent auf der Startseite. |
| 26 | Mittel | Inhalte nur per App-Update änderbar | Offen | Braucht einen Server, also eine Rücknahme von E-121. |
| 27 | Mittel | Unverschlüsselte lokale Ablage | Offen | Nächster Schritt nach 5 (Schlüssel im Schlüsselbund). |
| 28 | Mittel | Keine Tests im App-Ordner | **Kein Befund** | Die Tests liegen im Repo: Fachlogik 29, App 31, Rundgang hell/dunkel. Das Testpaket enthält sie bewusst nicht. |
| 29 | Mittel | iPad aktiv ohne Tablet-Layout | **Erledigt** | E-125: abgeschaltet. |
| 30 | Mittel | Web gibt nur HTML aus | Offen | Der Web-Export dient heute nur Tests. Vorschlag: nicht veröffentlichen. |
| 31 | Mittel | Marke und Domains | Offen | DPMA/EUIPO, Gründerseite. |
| 32 | Mittel | Nur Deutsch | Entscheidung | Englisch gab es bis E-121. |

## Review L. Reiche vom 12.10.2026 (acht Dealbreaker)

| # | Dealbreaker | Status | Notiz |
|---|---|---|---|
| K1 | Kein Geschäftsmodell (kein Konto, Server, Bezahlung) | Entscheidung | Widerspricht der Empfehlung von F. Steinmeyer (kein Server in den ersten drei Wochen). Gründer entscheidet. |
| K2 | Keine messbare Traktion | Offen | TestFlight braucht ein Apple-Developer-Konto (Gründer); Messung datenschutzfreundlich, Anbieter offen. |
| K3 | Inhalte ungeprüft | Offen | Prüfliste T-52 bis T-68 als Arbeitsgrundlage für den Fachbeirat. |
| K4 | Rechnung nur als PDF | **Erledigt (XRechnung)** | E-128: XRechnung 3.0 (UBL) aus der App, gleiche Zuordnung wie der Server, Beispiele inkl. Storno und Kleinunternehmer bestehen den KoSIT-Validator. ZUGFeRD offen. |
| K5 | GoBD-Risiken bei Rechnung und Kassenbuch | **Erledigt** | E-127: Festschreiben beim Teilen, Storno, keine Wiedervergabe geteilter Nummern, doppelte Nummer blockiert, nur vollständig teilen, Kassenbuch als Vorlage zum Ausdrucken gekennzeichnet. Fachlich: T-68. |
| K6 | Alles nur auf dem iPhone | Teilweise | Verschlüsselte Sicherung mit Wiederherstellen (E-125); sofort speichern beim Wechsel in den Hintergrund, kein Überschreiben unlesbarer Daten (E-127). Automatische Sicherung/Sync: Entscheidung (K1). |
| K7 | Pflichten-Check für Bestandsbetriebe | **Erledigt** | E-127: Gründungsschritte abgetrennt, Zusatzfragen, Begründung für jede Pflicht, wiederkehrende Pflichten nur bis zum Termin erledigt, Unterlagen zählen erst nach dem Teilen. Seit E-128 zusätzlich „Jetzt dran / Diesen Monat“ und lokale Erinnerungen. |
| K8 | „Amtlos“ erzeugt nur PDFs | Teilweise | E-128: Rechnungen → Umsätze der USt-Voranmeldung mit einem Tipp (Stornos negativ); E-Rechnung als Datei. ELSTER-Übermittlung offen (J-1, braucht Zertifikat/ERiC). |

## Review L. Reiche vom 13.10.2026 (nach dem Termin)

| # | Befund | Status | Notiz |
|---|---|---|---|
| R1 | Daten ungeschützt, Handy weg = Rechnungen weg, alte Sicherung überschreibt neuere | **Erledigt (Gerät)**, iCloud vorbereitet | E-129: verschlüsselte Ablage mit Schlüssel im Schlüsselbund, Face-ID-Sperre, Löschschutz bis zur Sicherung, Zusammenführen statt Überschreiben, Erinnerung an die Sicherung; iCloud-Sicherung für den eigenen Build (docs/09). Ohne eigenen Build/Server bleibt „Handy weg“ nur mit Sicherung lösbar. |
| R2 | Voranmeldung nach Rechnungsdatum, Zahlungen unbekannt | **Erledigt** | E-129: Soll nach Leistungsdatum, Ist nach Zahlungseingang; Zahlungsvermerk an der Rechnung. Fachlich T-70. |
| R3 | Nichts geht an ELSTER | Konzept | docs/08-elster-eric.md: zwei Wege, Architektur, 8–11 Wochen; braucht K1 und J-1. |
| R4 | PDFs sehen computergeneriert aus | **Erledigt (erste Fassung)** | E-129: sechs Gestalten je Zweck, Rechnung als DIN-5008-Brief mit Logo, Hausfarbe, Fußzeile in Spalten; eingebettete Schriften. Feinschliff je Vorlage geht weiter (T-75). |
| R5 | E-Rechnung nach Wien abgelehnt | **Erledigt** | Länder-Erkennung, Reverse Charge (AE), innergemeinschaftliche Lieferung (K); KoSIT 13/13. |
| R6 | Pflichten auf der Startseite versteckt | **Erledigt** | Erster Tab „Pflichten“. |
| R7 | 76 unklare Pflichten, 33 weitere Fragen | **Erledigt** | „Kurz klären“: drei wirksamste Fragen direkt beantwortbar, Rest optional; bis zu acht Zusatzfragen im Check. |
| R8 | Steuererklärungen ohne Fristen | **Erledigt** | § 149 AO mit und ohne Steuerberatung, nächster Werktag; neue Frage „Steuerberatung?“. Fachlich T-73. |

