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
| 6 | Kritisch | Kein Grund zum Wiederkommen | Offen | Nächster Schritt: lokale Erinnerungen ohne Server für 3–4 wiederkehrende Pflichten (spätestens Woche 5). Termine rechnet die Engine schon. |
| 7 | Kritisch | Kein Vertriebskanal belegt | Offen | Gründerseite (Kanzleien, Kammern, Verband). |
| 8 | Hoch | Nutzer muss selbst wissen, was gilt | **Erledigt (Prototyp)** | E-126: Pflichten-Check mit bis zu 10 Fragen, Katalog und Regel-Engine auf dem Gerät, „Deine Pflichten“ mit Unterlage je Pflicht. |
| 9 | Hoch | Betriebsprofil ohne Branche, Rechtsform, Mitarbeiterzahl | **Erledigt** | E-126: Profil aus dem Check, änderbar unter „Mein Betrieb“. |
| 10 | Hoch | Sicherung nicht zurückspielbar | **Erledigt** | E-125: „Sicherung wiederherstellen“ mit Passwort und Vorschau des Inhalts. |
| 11 | Hoch | App behauptet Prüfhinweis auf jedem PDF | **Erledigt** | E-124: Satz korrigiert. Der Hinweis steht in der App (Abschluss, „Wozu“), nicht im PDF. |
| 12 | Hoch | „Nicht geprüft“ auf jeder Vorlage | In Arbeit | Hinweis steht fest in der Einleitung des Checks, beim Ergebnis, bei jeder Pflicht und im Abschluss jeder Unterlage (nicht im PDF). AGB folgen; Siegel nach Prüfung. |
| 13 | Hoch | RDG/StBerG ungeklärt | Offen | Kurzgutachten einer Kanzlei; vor einem Pflichten-Check besonders wichtig. |
| 14 | Hoch | Rechnung nur als PDF | Offen | Hinweis „keine E-Rechnung“ steht in der App. XRechnung-Prüfung liegt im Fachlogik-Paket. |
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
| 28 | Mittel | Keine Tests im App-Ordner | **Kein Befund** | Die Tests liegen im Repo: Fachlogik 28, App 14, Rundgang hell/dunkel. Das Testpaket enthält sie bewusst nicht. |
| 29 | Mittel | iPad aktiv ohne Tablet-Layout | **Erledigt** | E-125: abgeschaltet. |
| 30 | Mittel | Web gibt nur HTML aus | Offen | Der Web-Export dient heute nur Tests. Vorschlag: nicht veröffentlichen. |
| 31 | Mittel | Marke und Domains | Offen | DPMA/EUIPO, Gründerseite. |
| 32 | Mittel | Nur Deutsch | Entscheidung | Englisch gab es bis E-121. |
