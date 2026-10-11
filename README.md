# Amtlos

Das Bürokratie-Betriebssystem für Kleinunternehmer und Startups in Deutschland.

**Stand:** Bauabschnitt 1 (Fundament) umgesetzt, siehe [Testbericht](docs/testberichte/abschnitt-1.md). Fachliche Inhalte sind ungeprüft und erscheinen in prod erst nach Freigabe (E-002).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/web` | Nutzer-App (Next.js, PWA) |
| `apps/studio` | Experten-Backend: Katalog bearbeiten, prüfen, veröffentlichen |
| `apps/api` | REST-API (NestJS) |
| `apps/worker` | Neuberechnung, Tageswechsel, Erinnerungen |
| `packages/rules-engine` | Regel-Engine (rein, deterministisch, dreiwertig) |
| `packages/fristen` | Fristen, Feiertage, Perioden |
| `packages/rules-schema` | JSON-Schemas, Fakten- und Ereignis-Katalog, Validator |
| `packages/server` | Datenbankzugriff, Neuberechnung, Erinnerungen, Studio-Logik, Migrationen, CLI |
| `packages/i18n` | Texte Deutsch/Englisch, Onboarding-Fragen |
| `packages/web-kern` | Sitzung, Anmeldung, Designsystem für Web und Studio |
| `catalog/` | Pflichten, Regelwerte, Fixtures (YAML) |
| `db/` | Migrationen und Schema-Tests |

## Dokumentation

| Datei | Inhalt |
|---|---|
| `ENTSCHEIDUNGEN.md` | alle Architektur- und Produktentscheidungen |
| `PRUEFLISTE.md` | offene fachliche Prüfpunkte |
| `docs/01-architektur.md` … `docs/07-betrieb.md` | Architektur, Datenmodell, Regel-Schema, Seiten, Risiken, Design, Betrieb |
| `docs/testberichte/` | Testberichte je Bauabschnitt |

## Schnellstart

Siehe [docs/07-betrieb.md](docs/07-betrieb.md).
