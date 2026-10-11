# Testbericht Bauabschnitt 1 · Fundament

Stand: 2026-10-11 · Commit: siehe `git log` · Spezifikation 12 (Abschnitt 1) und 14.3

## Ergebnis in einem Satz

Der Kern läuft durchgängig: Profil anlegen → Regel-Engine berechnet Pflichten mit Begründung und Fristen → Web-App zeigt sie an → Erledigen, Erinnern, Kalender-Abo; im Studio werden Katalogversionen angelegt, im Vier-Augen-Prinzip freigegeben und als Release ausgerollt. **153 automatisierte Tests grün**, dazu der E2E-Rundgang mit Barrierefreiheitsprüfung ohne Befund.

## Automatisierte Tests

| Bereich | Tests | Was sie absichern |
|---|---:|---|
| Datenbank (`db/tests`) | 37 | Mandantentrennung (RLS) für App, Worker und Studio; Rollen (Mitarbeiter kann nicht einladen, sich nicht hochstufen); Vier-Augen-Freigabe (Autor ≠ Prüfer, Qualifikation hinterlegt, zwei Freigaben); unveränderliche freigegebene Versionen; keine überlappenden Regelwerte; prod-Gate auch gegen manipulierte Umgebungsvariable; Ereignisse und Audit append-only; Hash-Kette |
| Fristberechnung (`packages/fristen`) | 21 | Ostern und Feiertage je Land/Gemeinde, Stichjahre, Monatsende-Regel, Schaltjahre, Verschiebung über Feiertagsketten, Bankarbeitstage, Perioden, Termine; grün in UTC+14 und UTC−8 |
| Regel-Engine (`packages/rules-engine`) | 31 | Kleene-Logik vollständig, alle Operatoren, „unbekannt“ statt „gilt nicht“ bei fehlenden/fehlerhaften Angaben, Regelwerte zum Stichtag, Erklärungen, Gültigkeit/Radar, Determinismus; **alle Fixtures** inkl. Grenzfällen 2.000 € / 2.000,01 € / 9.000 € und „Angaben fehlen“ |
| Server-Kern (`packages/server`) | 15 | Migrationen idempotent mit Prüfsumme; Katalog-Import; Neuberechnung (neu/aktualisiert/entfallen/nicht zutreffend, idempotent, Erledigtes bleibt); Storno; Erinnerungen um 8 Uhr Ortszeit (Sommer-/Winterzeit), Versand ohne Doppelversand; transaktionales Einreihen; Studio: Versionen, Qualifikationsprüfung, Releases nur konsistent |
| API (`apps/api`) | 18 | Token-Prüfung, Konto beim ersten Login, Mandanten-Header, 404 statt Existenzauskunft, Profil-Validierung, Rollen (403), Karten mit Begründung/Quellen/Prüfstatus, Heute, Erledigen mit Nachweis, Sammelbestätigung, idempotente Ereignisse, ICS nur mit Token |
| Worker (`apps/worker`) | 3 | Berechnung + Erinnerungsplanung in einer Transaktion, Sofort-Erinnerung genau einmal, Jobs über die Warteschlange mit Worker-Rolle |
| Übersetzungen (`packages/i18n`) | 27 | DE/EN gleiche Schlüssel und Platzhalter, jedes Ereignis übersetzt, Onboarding-Fragen passen zu Typen und Werten im Fakten-Katalog |
| Web (`apps/web`) | 1 | Periodentexte |
| **Summe** | **153** | |
| Katalog-Validator | – | Schema, Fakten, Operatoren, Enum-Werte, Regelwerte, Ereignisse, Überlappungen, Fixtures; Gegenprobe mit absichtlich fehlerhaftem Katalog (alle 5 Fehler erkannt) |
| E2E-Rundgang | 2 Durchläufe | Anmelden → Unternehmen → Onboarding → Heute → Sammelbestätigung → Pflicht erledigen → Kalender, Melden, Einstellungen; hell/Desktop und dunkel/mobil; **axe WCAG 2.2 AA auf 18 Seiten: 0 Befunde** (Gegenprobe: axe erkennt eingebaute Fehler) |

Zusätzlich manuell im Browser geprüft (Bildschirmfotos): Layout Desktop/mobil/dunkel; Studio-Ablauf Redaktion → Prüfung → „Kein Zugang“ für Kundenkonten.

## Von Tests gefundene und behobene Fehler

1. **Sicherheitslücke:** Jedes Konto konnte sich selbst in fremde Unternehmen eintragen (RLS-Policy für ALL wirkte als WITH CHECK). Behoben, Test bleibt.
2. **Umgehbares prod-Gate:** Dienste hätten per Sitzungsvariable „dev“ setzen und Ungeprüftes veröffentlichen können. Behoben mit Migration 0003 (E-067).
3. **Inkonsistentes Release:** Freigegebene Pflicht mit ungeprüften Regelwerten hätte für alle Nutzer „unbekannt“ geliefert. Behoben (E-069).
4. Erinnerungen: falsches Datumsformat im Betreff; fehlende Erinnerung bei sehr nahen Fristen (E-063).
5. UI: Statuszeichen fehlte in der Schrift, Fristblatt mobil gestreckt, Beschriftung abgeschnitten, Überflutung mit Altfristen (E-072), Ampel grün trotz offener Pflicht (E-074).
6. Studio: veraltete Versionen blieben „In Prüfung“ (E-070).

## Was zu „produktionsreif“ für Abschnitt 1 noch fehlt

Ehrliche Liste; nichts davon ist begonnen und als fertig dargestellt.

| Punkt | Warum offen | Vorschlag |
|---|---|---|
| OIDC-Anmeldung gegen Zitadel | Code steht (PKCE, Abmeldung), aber ohne Zitadel-Instanz nicht getestet | Zitadel in staging aufsetzen, E2E mit echtem Login |
| CI auf GitHub beobachten | Workflows gepusht; Statusabfrage der Actions ist mir aus dieser Umgebung nicht möglich | Bitte einmal den Reiter „Actions“ prüfen |
| Container-Images, Infrastruktur als Code, Deploy | Hosting-Vertrag (E-013) fehlt | Dockerfiles + OpenTofu für STACKIT |
| Studio: Formular-Editor | Jetzt JSON-Editor mit voller Validierung | Formular je Abschnitt des Schemas |
| Studio: Regelwerte anlegen, Fixtures in der Datenbank, YAML-Export als Pull Request (E-030) | nicht umgesetzt | nächste Iteration |
| Einladungen ins Unternehmen (Tabelle existiert, API fehlt) | nicht umgesetzt | Abschnitt 1b |
| OpenAPI-Beschreibung, Ratenbegrenzung, Beobachtbarkeit (OpenTelemetry) | nicht umgesetzt | Abschnitt 1b |
| Expo-Gerüst (E-019) | nicht angelegt | Abschnitt 1b |
| Lasttest Neuberechnung (Ziel 100.000 Unternehmen < 30 min) | nicht durchgeführt | nach Container-Setup |

## Offene fachliche Prüfpunkte

Vollständig in `PRUEFLISTE.md` (G-01 bis G-15, J-1 bis J-4, K-01 bis K-20) und im Studio unter „Prüfliste“. Neu in diesem Abschnitt: G-12 Feiertagsregeln, G-13 Bankarbeitstag, G-14 „vor Arbeitsbeginn“, G-15 Wortlaut Sammelbestätigung.

**Blockierend für jeden Livegang bleibt R-01:** Ohne qualifizierte Prüferinnen und Prüfer gibt es keine freigegebenen Inhalte, und in prod erscheint dann nichts.
