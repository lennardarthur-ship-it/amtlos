# Testbericht Launch-Fokus 1 · Kern für Gründer, Schnellstart, Heute, Abo, Löschen

Stand: 2026-10-11 · Ziel: in zehn Wochen launchfertig für Gründer und Solo-Selbstständige, Nutzererlebnis zuerst

## Ergebnis in einem Satz

Die Oberfläche ist auf den Kern gekürzt, der Einstieg dauert zwei Minuten und endet mit einer Willkommenskarte, „Heute“ zeigt eine klare nächste Handlung, und die Teile, ohne die kein Launch geht, sind da: Testphase und Abo über Stripe, Datenexport, Löschen von Unternehmen und Konto, Rechtsseiten. **628 automatisierte Tests, 74 Datenbanktests, drei E2E-Rundgänge grün**, Kernseiten antworten in unter 150 ms.

## Was sich geändert hat

| Bereich | Umfang |
|---|---|
| Umfang (E-110) | `AMTLOS_UMFANG`: Standard nur Kernmodule; versteckte Seiten 404; Navigation, „Mehr“, Hilfe-Anleitungen, Links aus Pflichten folgen dem Schalter. CI prüft beide Umfänge |
| Schnellstart (E-111) | 5 Schritte, 7 Fragen; Bundesland statt Gemeindeschlüssel; Nachfragen in Runden von „Heute“ aus; Auto-Aktualisierung bis zur ersten Berechnung; Willkommenskarte mit geltenden Pflichten und Fristen in 90 Tagen |
| Heute (E-112) | „Jetzt dran“ als eine Karte mit Knopf, „Danach“, Fortschritt in Prozent, Nachfragen-Runde, Fristen vor dem Start leise; Erledigen führt zurück auf „Heute“ mit Bestätigung; Fehlerseite in der App; „Angabe fehlt“ nicht mehr in den nächsten Aufgaben |
| Abo (E-113) | `app.abo` mit Testphase je Unternehmen; 402 beim Schreiben nach Ablauf, Lesen bleibt; Stripe Checkout, Kundenportal, Webhook mit Signatur und Idempotenz; Abo-Seite, Hinweis sieben Tage vor Ende, Weiterleitung bei 402 |
| Löschen und Export (E-114) | JSON-Export aller Tabellen; Unternehmen löschen mit Namensbestätigung; Konto löschen; täglicher Löschlauf nach 30 Tagen |
| Rechtsseiten (E-115) | Impressum, Datenschutzerklärung, Nutzungsbedingungen aus Konfiguration mit Entwurfshinweis; Fußzeile überall |
| Identität | Zitadel als Compose-Profil (`--profile auth`) mit Passkeys; Einrichtung in docs/07 |
| Leistung (E-116) | Budget in der E2E-Prüfung; gemessen lokal: Heute 81 ms, Pflichten 51 ms, Kalender 57 ms (Serverantwort) |

## Tests

| Bereich | Tests |
|---|---:|
| Regel-Engine | 398 |
| Server | 54 |
| API (neu: Testphase und 402, Webhook-Signatur und Idempotenz, Zuordnung über Kundennummer, Export, Löschen mit Namensbestätigung, Konto löschen, Löschlauf) | 72 |
| Übersetzungen (neu: Rechtstexte in beiden Sprachen) | 52 |
| Fristen | 21 |
| Validator | 7 |
| Web (neu: Umfang, Ziele versteckter Module) | 13 |
| Studio | 5 |
| Worker | 3 |
| Mobile | 7 |
| **Summe** | **632** |
| Datenbank (neu: Abo je Unternehmen, Status nur über Systemfunktion, Konto löschen nur ohne Unternehmen) | 74 |
| E2E Web (voller Umfang) | Schnellstart mit höchstens 6 Schritten, Willkommenskarte, Nachfragen zeigen nur Offenes, Erledigen mit Bestätigung auf Heute, Abo-Seite, Rechtsseiten, Datenexport, Unternehmen und Konto löschen, Leistungsbudget |
| E2E Web (Kern) | Navigation nur Kern, versteckte Seiten 404, kein Frag-Feld, keine Arbeitsschutz-Werkzeuge |
| E2E Studio | unverändert grün |

## Von Tests gefundene und behobene Fehler

1. Der neue Löschlauf-Job hatte keine Queue – der Worker startete nicht mehr, und ohne Worker gab es keine erste Berechnung. Die Queue wird jetzt mit den anderen angelegt.
2. Ein Lade-Skelett ließ die Seite „fertig“ melden, bevor Inhalte da waren. Entfernt (E-112).
3. Nach dem Löschen blieb ein Unternehmen über die Mitgliedschaft erreichbar. Der Auth-Guard prüft jetzt über die Unternehmens-Policy.
4. Der E2E-Rundgang lief mit den zusätzlichen Abfragen je Seite in die Ratenbegrenzung (600/min je Token). Für Tests ist sie höher; für Menschen reichen 600.
5. Bundesland und Gemeindeschlüssel konnten sich widersprechen; jetzt bestimmt der Schlüssel das Land.

## Was in den nächsten Wochen zu tun ist (Reihenfolge nach Wirkung)

| Woche | Thema | Wer |
|---|---|---|
| 1 | Steuerberater und Anwalt beauftragen: Freigabe der Kern-Pflichten (A, C, I, B), Rechtsseiten (T-46), Abo-Fragen (T-47) | Gründer |
| 1 | Hosting-Vertrag (DE), Zitadel aufsetzen, Stripe-Konto mit Preis, E-Mail-Versand (SMTP mit AVV) | Gründer + Tech |
| 2–3 | Katalog-Freigaben im Studio einpflegen; prod-Release nur mit Freigaben (E-038) | Prüfer |
| 2–4 | Nutzertests mit fünf echten Gründern: Schnellstart, Heute, erste Erledigung; Texte nach Beobachtung schärfen | Produkt |
| 3–5 | Infrastruktur als Code, Backups mit Wiederherstellungstest, Monitoring und Fehler-Tracking, Statusseite | Tech |
| 4–6 | Gründungsassistent mit echter ELSTER-Übermittlung (nach Registrierung, J-1) oder sauberer Vorbefüllung | Tech + StB |
| 6–8 | App in die Stores (IdP, Push-AVV, Store-Texte, Gerätetests) | Tech |
| 8–10 | Lasttest gegen prod-Infrastruktur, Penetrationstest, Datenschutz-Review, Livegang mit Warteliste | Alle |

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Fachliche Freigabe | ohne sie kein prod-Release; das ist der kritische Pfad (E-002) | Woche 1 beauftragen |
| Stripe nur mit Fake getestet | keine Netzverbindung aus der Entwicklungsumgebung | Testmodus-Webhook in staging |
| AVV für Beschäftigtendaten | Text fehlt (T-46) | Muster vom Anwalt |
| Aufbewahrung nach Löschung | G-09, T-48 | bis dahin Anonymisierung |
| Nutzertests | noch keine echten Nutzer gesehen | fünf Gründer in Woche 2 |
