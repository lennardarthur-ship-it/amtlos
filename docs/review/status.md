# Investor-Readiness-Review – Stand der 32 Punkte

Review von Frida Steinmeyer vom 12.10.2026. Status von Amtlos-Seite, zum gemeinsamen Abgleich beim nächsten Termin. „Erledigt“ heißt umgesetzt und getestet; „Entscheidung“ heißt, Lennard muss die Richtung festlegen, bevor gebaut wird.

Das Review wurde am Stand vor E-124 erstellt. Einige Befunde (Startseite „Wähle aus, was du brauchst“, gelber Prüfhinweis auf jeder Vorlage) waren am selben Abend schon überholt.

| # | Priorität | Befund | Status | Notiz |
|---|---|---|---|---|
| 1 | Kritisch | Vorlagen-App statt Plattform-Vision | Entscheidung | Widerspricht E-121 („keine Erinnerungen, kein Fragebogen“). Lennard entscheidet. |
| 2 | Kritisch | Keine Nutzer, kein Store-Release | Offen | Braucht Apple-Developer-Konto, EAS-Projekt, Store-Texte, Datenschutzangaben. |
| 3 | Kritisch | 0 von 43 Pflichten geprüft | Offen | Prüfpunkte für den Fachbeirat liegen vor: PRUEFLISTE T-52 bis T-66. |
| 4 | Kritisch | Kein Preis, keine Bezahlfunktion | Entscheidung | Hängt an 1 und 6. |
| 5 | Kritisch | Sicherung verschickt Personaldaten im Klartext | **Erledigt** | E-125: AES-256-GCM, Passwort ≥ 10 Zeichen, nichts im Klartext. Tests und Rundgang prüfen das. |
| 6 | Kritisch | Kein Grund zum Wiederkommen | Entscheidung | Fristen und Push = Rücknahme von E-121. |
| 7 | Kritisch | Kein Vertriebskanal belegt | Offen | Gründerseite (Kanzleien, Kammern, Verband). |
| 8 | Hoch | Nutzer muss selbst wissen, was gilt | Entscheidung | Zwischenschritt seit E-124: Anlässe auf der Startseite. Pflichten-Check hängt an 1. |
| 9 | Hoch | Betriebsprofil ohne Branche, Rechtsform, Mitarbeiterzahl | Entscheidung | Gehört zum Pflichten-Check (8). |
| 10 | Hoch | Sicherung nicht zurückspielbar | **Erledigt** | E-125: „Sicherung wiederherstellen“ mit Passwort und Vorschau des Inhalts. |
| 11 | Hoch | App behauptet Prüfhinweis auf jedem PDF | **Erledigt** | E-124: Satz korrigiert. Der Hinweis steht in der App (Abschluss, „Wozu“), nicht im PDF. |
| 12 | Hoch | „Nicht geprüft“ auf jeder Vorlage | Teilweise | Seit E-124 nicht mehr auf jeder Vorlage. Siegel erst nach Prüfung (3). |
| 13 | Hoch | RDG/StBerG ungeklärt | Offen | Kurzgutachten einer Kanzlei; vor einem Pflichten-Check besonders wichtig. |
| 14 | Hoch | Rechnung nur als PDF | Offen | Hinweis „keine E-Rechnung“ steht in der App. XRechnung-Prüfung liegt im Fachlogik-Paket. |
| 15 | Hoch | Kein Analytics, kein Crash-Reporting | Entscheidung | Verträgt sich nur datenschutzfreundlich mit „alles bleibt auf dem iPhone“; Anbieter wählen. |
| 16 | Hoch | 4 Ordnerkopien, 5 ZIPs, kein Git | **Erledigt** | Das GitHub-Repo mit CI ist die einzige Quelle; der Desktop-Ordner war nur das Testpaket. Alte Kopien liegen im Ordner „Amtlos-Archiv“; das Testpaket nennt Repo und Commit. Release-Tags: offen (lassen sich aus dieser Umgebung nicht pushen). |
| 17 | Hoch | Roter CI-Lauf | **Kein Befund** | Rote Läufe stammen vom 11.10. vormittags. Seitdem sind alle Läufe grün. |
| 18 | Hoch | Rollen Recht, Vertrieb, Technik fehlen | Offen | Gründerseite. |
| 19 | Hoch | Alle Branchen gleichzeitig | Entscheidung | Nische wählen (Gastro oder Beauty). |
| 20 | Hoch | Keine AGB, Haftungsbegrenzung, Versicherung | Offen | Anwalt, Versicherung. |
| 21 | Mittel | Branchenvorschläge starten auf „Alle“ | Offen | Kommt mit der Branche im Profil (9). |
| 22 | Mittel | Rechtsgrundlage und Kategorie im Kopf der Kundenrechnung | **Erledigt** | E-125. |
| 23 | Mittel | Schriftmix, kein Logo | Offen | |
| 24 | Mittel | Risiko und Bußgeld pro Pflicht nicht sichtbar | Entscheidung | Gehört zum Pflichten-Check; Beträge nur mit Quelle (keine erfundenen Zahlen). |
| 25 | Mittel | Kein Fortschrittswert | Entscheidung | Gehört zum Pflichten-Check. |
| 26 | Mittel | Inhalte nur per App-Update änderbar | Offen | Braucht einen Server, also eine Rücknahme von E-121. |
| 27 | Mittel | Unverschlüsselte lokale Ablage | Offen | Nächster Schritt nach 5 (Schlüssel im Schlüsselbund). |
| 28 | Mittel | Keine Tests im App-Ordner | **Kein Befund** | Die Tests liegen im Repo: Fachlogik 28, App 14, Rundgang hell/dunkel. Das Testpaket enthält sie bewusst nicht. |
| 29 | Mittel | iPad aktiv ohne Tablet-Layout | **Erledigt** | E-125: abgeschaltet. |
| 30 | Mittel | Web gibt nur HTML aus | Offen | Der Web-Export dient heute nur Tests. Vorschlag: nicht veröffentlichen. |
| 31 | Mittel | Marke und Domains | Offen | DPMA/EUIPO, Gründerseite. |
| 32 | Mittel | Nur Deutsch | Entscheidung | Englisch gab es bis E-121. |
