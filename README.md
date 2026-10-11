# Amtlos

Das Bürokratie-Betriebssystem für Kleinunternehmer und Startups in Deutschland.

**Stand:** Bauabschnitte 1–5 umgesetzt (Fundament; Profil, Pflichten, Kalender; Gründungsassistent und Kapitalgesellschaften; Finanzen light mit E-Rechnung; Personal und Arbeitsschutz). Testberichte: [1](docs/testberichte/abschnitt-1.md), [2](docs/testberichte/abschnitt-2.md), [3](docs/testberichte/abschnitt-3.md), [4](docs/testberichte/abschnitt-4.md), [5](docs/testberichte/abschnitt-5.md), [Lasttest](docs/testberichte/lasttest.md). API: [`apps/api/openapi.yaml`](apps/api/openapi.yaml). Fachliche Inhalte sind ungeprüft und erscheinen in prod erst nach Freigabe (E-002).

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
