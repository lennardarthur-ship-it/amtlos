# Testbericht Bauabschnitt 2 · Katalog Gründung und Steuern, Jahreskalender (mit Nachträgen zu Abschnitt 1)

Stand: 2026-10-11 · Commits `057c4c8` bis `31a2e33` · Spezifikation 12 (Abschnitt 2), Katalog A, C, I

## Ergebnis in einem Satz

Der Katalog umfasst jetzt **37 Pflichten** (alle Punkte aus A und C der Spezifikation plus die bisherigen), jede Persona hat Fixtures, Schwellen sind auf den Cent getestet, und die Web-App zeigt einen Jahreskalender und ein Glossar. Die Redaktion bearbeitet Pflichten im Studio in Formularen statt in JSON. Nachgereicht aus Abschnitt 1: Einladungen ins Team, API-Beschreibung (OpenAPI) und Betriebsmetriken. **306 automatisierte Tests und 37 Datenbanktests grün**, beide E2E-Rundgänge (Web, Studio) ohne Barrierefreiheitsbefund.

**Wichtig:** Kein Inhalt ist fachlich freigegeben. Wo die Spezifikation keine Frist oder keine Folgen nennt, steht das sichtbar in der App und in der Prüfliste. Nichts davon ist erfunden (E-075).

## Automatisierte Tests

| Bereich | Tests | Was sie absichern (neu in diesem Abschnitt fett) |
|---|---:|---|
| Datenbank (`db/tests`) | 37 | wie Abschnitt 1; läuft mit Migration 0004 unverändert grün |
| Regel-Engine inkl. Fixtures (`packages/rules-engine`) | 190 | **21 Fixture-Dateien: 6 Personas** (Solo-Freiberufler, Betrieb mit erster Einstellung, Onlinehandel, Start-up-GmbH, Nebenberuf, internationale Gründerin) **und Grenzfälle**: Kleinunternehmer Vorjahr genau 25.000 € / 25.000,01 €, laufendes Jahr +0,01 €, Gründungsjahr; Buchführungspflicht Gewinn 80.000 € / +0,01 €, Umsatz +0,01 €; E-Rechnung 800.000 € / +0,01 € / Kleinunternehmer; **Klartext der Bedingungen**, **abgeleiteter Fakt „noch nicht gestartet“** |
| Server-Kern (`packages/server`) | 19 | **Einladungen in der Datenbank:** nur Inhaber/Admin, nie Rolle Inhaber, Worker sieht die Tabelle nicht, Annehmen nur mit passender E-Mail, einmalig, abgelaufen ⇒ übersprungen, letzter Inhaber bleibt; **Einladungstext** |
| API (`apps/api`) | 25 | **Glossar** (dedupliziert, sortiert); **Einladen/Vorschau/Annehmen/Widerrufen/Entfernen** mit allen Fehlerfällen (403, 404, 409, 422); **OpenAPI-Abgleich:** jede Route beschrieben, gleiche Rollen, gleicher Mandanten-Header, keine erfundene Route; **Betrieb:** Request-ID, Metriken nur mit Token, keine Tokens in Labels |
| Studio (`apps/studio`) | 3 | **Editor-Hilfen:** Startwerte je Typ, Dauern, Bereinigen vor dem Speichern |
| Katalog-Validator (`packages/rules-schema`) | 5 + Lauf | **verständliche deutsche Meldungen** statt Ajv-Rohtext, bei Varianten nur die gemeinte; Katalog gültig: 37 Pflichten, 12 Regelwerte, 21 Fixtures, 56 Fakten, 17 Ereignistypen |
| Fristen, Übersetzungen, Worker, Web | 21 + 37 + 3 + 3 | **neue Onboarding-Fragen** (Erlaubnisse, Steuern) passen zum Fakten-Katalog; **Rücksprungziel nach Anmeldung** lässt keine fremden Adressen zu |
| **Summe** | **306** | (Abschnitt 1: 153) |
| E2E Web | 2 Durchläufe | wie bisher plus **Hilfe, Team: einladen → Eingeladene meldet sich über den Link an → nimmt an → ist Mitglied**; hell/Desktop und dunkel/mobil; **axe WCAG 2.2 AA auf 30 Seitenaufrufen (15 je Durchlauf): 0 Befunde** |
| E2E Studio | 1 Durchlauf | **Formular-Editor:** bearbeiten, Bedingung ergänzen, speichern; leerer Titel ⇒ deutsche Fehlermeldung; neue Pflicht anlegen; axe ohne Befund |

**Gegenproben (Mutation):** Kleinunternehmergrenze im Regelwerte-Katalog absichtlich um einen Cent verschoben ⇒ die Grenzfall-Fixture schlägt fehl. Rolle aus der OpenAPI-Datei entfernt ⇒ Abgleichtest schlägt fehl und nennt die Route.

## Von Tests und Durchsicht gefundene und behobene Fehler

1. **Gründungszuschuss** wurde auch bereits gestarteten Unternehmen angezeigt ⇒ neuer Fakt `noch_nicht_gestartet` (E-076).
2. **Dauerhaft „Angabe fehlt“** für Vorjahreswerte vor dem Start und im Gründungsjahr ⇒ Vorjahresgrenzen gelten erst mit Vorjahr (E-076).
3. **Viele Frage-Karten** für eine unklare wiederkehrende Pflicht (eine je Termin) ⇒ eine Karte (E-077).
4. **Gewerbesteuer-Vorauszahlungen bei Freiberuflern** ⇒ Bedingung Gewerbe oder Kapitalgesellschaft ergänzt.
5. **Erlaubnisfrage ohne „keine“** ⇒ Option ergänzt.
6. **Zwei Sanktionstexte ohne Beleg** im alten Bestand (USt-Voranmeldung, Berufsgenossenschaft) ⇒ durch Platzhalter und Prüfpunkt ersetzt.
7. Pflichtenliste zeigte erledigte Pflichten von 2019 als Standard ⇒ Standard „Alles Offene“ (90 Tage).
8. Glossar-Text behauptete „aus deinen Pflichten“, zeigt aber den ganzen Katalog ⇒ korrigiert.
9. Studio: Beschriftungen nicht eindeutig mit Feldern verbunden (axe `select-name`) ⇒ explizite Labels.
10. Einladungen: E-Mail-Vergleich war in der Datenbankfunktion doch groß-/kleinschreibungsabhängig (citext-Operator außerhalb des Suchpfads) ⇒ behoben, Test bleibt.

## Was noch fehlt

Ehrliche Liste; nichts davon ist als fertig dargestellt.

| Punkt | Stand | Vorschlag |
|---|---|---|
| **Fachliche Freigabe aller 37 Pflichten** | 0 freigegeben; in prod erscheint daher nichts (R-01) | Prüferinnen/Prüfer gewinnen; Studio ist bereit |
| Abgabefristen der Jahreserklärungen (ESt, USt, GewSt, EÜR) | stehen nicht in der Spezifikation ⇒ „laufend ohne Termin“, nicht im Jahreskalender | als Regelwerte mit Quelle erfassen (G-18) |
| Folgen bei Nichterfüllung | fast überall Platzhalter | Redaktion (G-16) |
| Katalog B, D–H (Personal, Datenschutz, Branchen …) | spätere Abschnitte | laut Bauplan |
| OIDC gegen echtes Zitadel | Code steht, nicht gegen eine Instanz getestet | staging |
| Container-Images, Infrastruktur als Code | Hosting-Vertrag fehlt (E-013) | Dockerfiles + OpenTofu |
| OpenTelemetry-Tracing, Alarmregeln | bewusst später (E-081); Logs und Metriken stehen | mit Hosting |
| Ratenbegrenzung der API | nicht umgesetzt | vor öffentlichem Test |
| Expo-Gerüst (Mobile) | nicht angelegt | eigener Schritt |
| Studio: Regelwerte im Formular, Fixtures in der DB, YAML-Export als Pull Request | nicht umgesetzt | nächste Studio-Iteration |
| Team: Rolle ändern, selbst austreten, E-Mail auf Englisch | nicht umgesetzt (Einladungs-E-Mail nur Deutsch) | klein, bei Bedarf |
| Lasttest Neuberechnung | nicht durchgeführt | nach Container-Setup |

## Offene Prüfpunkte

Vollständig in `PRUEFLISTE.md` (147 Punkte aus dem Katalog, dazu G-01 bis G-19, T-01/T-02, J-1 bis J-4) und im Studio unter „Prüfliste“. Neu: G-16 bis G-19 (Startbestand), T-01 (bestätigte E-Mail-Adressen beim Identity-Provider), T-02 (Wortlaut Einladungs-E-Mail).
