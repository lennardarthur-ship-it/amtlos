# Amtlos

Das Bürokratie-Betriebssystem für Kleinunternehmer und Startups in Deutschland.

**Stand:** Bauabschnitte 1–10 umgesetzt, danach Launch-Fokus auf Gründer (Kernmodule sichtbar, Schnellstart, Abo, Löschen, Rechtsseiten – E-110 bis E-116) (Fundament; Profil, Pflichten, Kalender; Gründungsassistent und Kapitalgesellschaften; Finanzen light mit E-Rechnung; Personal und Arbeitsschutz; Datenschutz, IT-Sicherheit, KI; Online-Check, Handel und Produkte; Branchenmodule; Radar, Frag Amtlos, Behörden-Postfach und Experten-Marktplatz; Kanzleien, White-Label, Englisch, mobile App und Skalierung). Testberichte: [1](docs/testberichte/abschnitt-1.md), [2](docs/testberichte/abschnitt-2.md), [3](docs/testberichte/abschnitt-3.md), [4](docs/testberichte/abschnitt-4.md), [5](docs/testberichte/abschnitt-5.md), [6](docs/testberichte/abschnitt-6.md), [7](docs/testberichte/abschnitt-7.md), [8](docs/testberichte/abschnitt-8.md), [9](docs/testberichte/abschnitt-9.md), [10](docs/testberichte/abschnitt-10.md), [Launch-Fokus 1](docs/testberichte/launch-1.md), [Lasttest](docs/testberichte/lasttest.md). API: [`apps/api/openapi.yaml`](apps/api/openapi.yaml). Fachliche Inhalte: alle 226 Katalogeinträge und alle 43 Vorlagen sind fachlich freigegeben (Stand 25.10.2026, E-171 bis E-185; Register docs/freigabe-katalog/freigaben.yaml, Vorlagen-Prüfsummen packages/fachlogik/src/dokumente/geprueft.ts).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/web` | Nutzer-App (Next.js, PWA) |
| `apps/studio` | Experten-Backend: Katalog bearbeiten, prüfen, veröffentlichen |
| `apps/api` | REST-API (NestJS) |
| `apps/worker` | Neuberechnung, Tageswechsel, Erinnerungen (E-Mail, Push), Einladungen, Marktplatz-Anfragen |
| `apps/mobile` | Mobile App (Expo) für iPhone und Android (E-190): Pflichten-Check, 43 Vorlagen zum Ausfüllen, PDF auf dem Gerät (E-121 bis E-123); Store-Start: docs/11-store-start.md |
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
