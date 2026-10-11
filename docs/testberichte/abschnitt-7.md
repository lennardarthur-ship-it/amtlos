# Testbericht Bauabschnitt 7 · Online-Compliance-Check, Handel und Produkte

Stand: 2026-10-11 · Spezifikation 12 (Abschnitt 7), 6.8, Katalog G (66–75)

## Ergebnis in einem Satz

Katalog G mit 18 Pflichten (Impressum bis Geldwäsche) und ein Online-Check, der eine Website technisch prüft: Impressum, Datenschutzerklärung, Tracking vor der Einwilligung, Banner, Cookies, Kündigungs- und Widerrufsbutton, Preisangaben, OS-Link, Barrierefreiheits-Basistests. Das Ergebnis ist eine priorisierte Liste mit Handlungshinweisen, geschützt gegen Anfragen ins interne Netz. **553 automatisierte Tests und 56 Datenbanktests sind grün**, die E2E-Rundgänge laufen ohne axe-Befunde.

## Was neu ist

| Bereich | Umfang |
|---|---|
| Katalog G | Impressum, Datenschutzerklärung, Preisangaben, Widerrufsbelehrung, Button-Lösung, Kündigungsbutton, Widerrufsbutton (seit 19.6.2026), VSBG-Hinweis (> 10), OS-Link prüfen, BFSG für Dienstleistungen (Kleinstunternehmen-Ausnahme) und Produkte, Verpackung (LUCID), Elektrogeräte (ear), Batterien, GPSR, Marktplatz-Angaben, DAC7, Geldwäsche für Güterhändler. Alles ungeprüft und markiert |
| Fakten, Regelwerte | `profil.online.website`, `profil.handel.hohe_bargeschaefte`; VSBG-Schwelle 10, BFSG-Kleinstunternehmen 10 Beschäftigte / 2 Mio. € |
| Fixtures | 6 neue: kleiner Onlineshop, B2B-Agentur mit Website, Abo/Elektro/Marktplatz, BFSG-Grenze genau 2 Mio. € und 2.000.000,01 €, VSBG genau 10 |
| Online-Check | `packages/server/src/onlinecheck.ts`: sicherer Abruf (DNS-Prüfung bei jeder Verbindung, IP-Literale, Ports, Weiterleitungen, Typ, Größe, Zeit) und reine Prüffunktion. API `POST/GET /v1/onlinecheck` mit Tageslimit; Ergebnisse unveränderlich (Migration 0011) |
| Web | Seite „Online“ mit Ergebnisliste (fehlt → prüfen → nicht prüfbar → ok), Handlungshinweis und Link zur Pflicht, Verlauf. Mobile Navigation mit „Mehr“ (E-098). Notfallknopf zusätzlich auf „Heute“ und „Änderung melden“ |

## Tests

| Bereich | Tests (gesamt nach Abschnitt 7) |
|---|---:|
| Regel-Engine inkl. 43 Fixture-Dateien | 370 |
| Server (neu: Netzschutz, Abruf gegen lokalen Testserver, Prüfregeln) | 36 |
| API (neu: Online-Check nach Profil, Fehlerfall, Tageslimit) | 52 |
| Übersetzungen | 51 |
| Fristen | 21 |
| Validator | 7 |
| Web | 8 |
| Studio | 5 |
| Worker | 3 |
| **Summe** | **553** |
| Datenbank (`db/tests`) | 56 |
| E2E Web | Online-Check gegen eine lokale Testseite (Tracker, fehlende Datenschutzerklärung erkannt), „Mehr“ mobil. axe ohne Befunde |

## Von Tests gefundene und behobene Fehler

1. Preise wie „12,90 €“ wurden nicht erkannt: Nach dem Eurozeichen gibt es keine Wortgrenze. Der Ausdruck ist korrigiert.
2. Der Testserver lieferte für jede Unterseite die Startseite aus. Dadurch galt eine fehlende Datenschutzerklärung als vorhanden. Der Test liefert jetzt 404, und der Check wertet nur erreichbare Seiten.

## Sicherheit (Review)

- Interne Ziele (Loopback, private Netze, Link-Local inkl. Cloud-Metadaten 169.254.169.254, IPv6 ULA/Link-Local, IPv4-mapped) werden abgelehnt. Das gilt vor der Verbindung und für jede aufgelöste Adresse, also auch bei DNS-Rebinding und Weiterleitungen.
- Nur Ports 80/443, keine Zugangsdaten in URLs, Größen- und Zeitlimit, nur HTML.
- In staging/prod lässt sich das Erlauben privater Netze nicht einschalten (Konfigurationsprüfung). Empfehlung: zusätzlich ein Egress-Proxy (docs/07-betrieb.md).

## Offen (ehrlich)

| Punkt | Warum | Vorschlag |
|---|---|---|
| Fachliche Freigabe Katalog G (18 Pflichten, 3 Regelwerte) | keine Prüfer (R-01) | Studio ist bereit |
| Cookie-Banner-Verhalten im echten Browser (Klick auf „Ablehnen“), vollständige WCAG-Prüfung (axe) | braucht einen isolierten Headless-Browser als Dienst | Worker mit Chromium in eigener Sandbox |
| GPSR-Angaben auf Produktseiten | Produktseiten müssten gecrawlt und erkannt werden | tieferes Crawling (Worker) |
| Korrekturvorlagen als Text (Impressum, Button-Beschriftungen) | Rechtsinhalte (T-28, T-29) | nach Freigabe als Vorlagen |
| Geldwäsche-Schwelle, Immobilien/Finanzbranche | nicht in der Spezifikation (T-31) | Regelwert, Branchenmodul H |
