# Testbericht Bauabschnitt 3 · Gründungsassistent, ELSTER-Fragebogen, Kapitalgesellschaften

Stand: 2026-10-11 · Commit `b5c369f` und folgende · Spezifikation 12 (Abschnitt 3), 6.2, Katalog B

## Ergebnis in einem Satz

Gründerinnen und Gründer sehen alle Gründungsschritte in der richtigen Reihenfolge, mit Sperren („Erst erledigen: ELSTER-Konto beantragen“), Fortschritt und – bei UG/GmbH – den Eckdaten aus den Regelwerten. Der Fragebogen zur steuerlichen Erfassung wird aus dem Profil vorbereitet. **Die direkte Übermittlung an ELSTER ist nicht gebaut**, sondern hinter einer Schnittstelle vorbereitet, die heute ehrlich „noch nicht möglich“ sagt (fehlende Herstellerregistrierung, juristische Frage J-1).

## Was neu ist

| Bereich | Umfang |
|---|---|
| Katalog B (B.14–B.22) | 19 Pflichten aus der Spezifikation: Notar und Gesellschaftsvertrag, Stammkapital, Handelsregister, Gesellschafterliste, Transparenzregister, Geschäftsführung (Status, Pflichten, § 15a InsO), Jahresabschluss, E-Bilanz, Offenlegung (Kalenderjahr und abweichendes Geschäftsjahr), UG-Rücklage, Körperschaftsteuer, Mitarbeiterbeteiligung, AWV, Investitionsprüfung, Förderprogramme |
| Regelwerte | Mindeststammkapital GmbH/UG, Mindesteinzahlung, UG-Rücklage (B.14) |
| Fixtures | Startup-GmbH erweitert (Offenlegung 2025 → 31.12.2026), UG in Gründung, UG mit Gesellschafterwechsel und fehlenden Angaben |
| Onboarding | Schritt „Gesellschaft“ nur für UG/GmbH; Gewinnprognose (auch negativ); Beträge je Sprache gelesen |
| Gründungsassistent | `GET /v1/gruendung`, Seite `/gruendung`, Karte auf „Heute“; Reihenfolge aus `voraussetzungen` im Katalog |
| Fragebogen | `GET /v1/gruendung/fragebogen`, Seite mit fehlenden Angaben, Hinweis „Verzicht bindet fünf Jahre“ (C.23), Drucken |
| ELSTER | `ElsterGateway` mit begründeter Absage (`POST /v1/elster/:vorgang` → 501, `GET /v1/elster/status`) |
| Validator | Kreise in `voraussetzungen` werden gemeldet |

## Tests

- Regel-Engine: 231 → mit Abschnitt 4: 243 Tests, darunter alle neuen Fixtures.
- API: Reihenfolge (ELSTER vor Fragebogen, Notar → Stammkapital → Handelsregister), Sperre und Entsperren nach Erledigung, Kennzahlen der UG, Fragebogen-Vorbereitung, 501 von ELSTER, 403 für Mitarbeiter.
- Einheitentest der Sortierung (Voraussetzungen, Frist, Katalognummer, Kreise).
- E2E: `/gruendung` und `/gruendung/fragebogen` mit axe in beiden Durchläufen; zusätzlicher UG-Rundgang mit Bildschirmfotos.

## Gefunden und behoben

1. Gesperrte Schritte waren mit Deckkraft 80 % dargestellt – axe meldete zu wenig Kontrast. Jetzt volle Deckkraft mit Text „Erst erledigen: …“.
2. Gewinnangaben konnten nicht negativ sein (Startups mit Verlust). Jetzt erlaubt, mit Hinweis im Formular.
3. Englische Nutzer: „5,000“ wurde als 5 gelesen. Beträge werden jetzt je Sprache gelesen.

## Offen

| Punkt | Warum |
|---|---|
| Direkte ELSTER-Übermittlung (Fragebogen, später USt-VA, ZM, Kassenmeldung) | Herstellerregistrierung bei ELSTER und Klärung J-1 fehlen (T-05) |
| Reihenfolge für UG/GmbH über die Katalog-Voraussetzungen hinaus (z. B. Notar vor Gewerbeanzeige) | steht nicht in der Spezifikation (T-04) |
| Fristen in Katalog B (Transparenzregister, Gesellschafterliste, § 15a InsO, AWV-Meldegrenze, Jahresabschluss) | nicht in der Spezifikation (G-20) |
| Cap Table, Beschlussvorlagen, VSOP-Verwaltung, Fördermittel-Matching (6.9) | Modul „Gesellschaft und Startup“ folgt mit dem Dokumentengenerator |
| Formular-Felder des amtlichen Fragebogens | nicht in der Spezifikation (T-03) |
