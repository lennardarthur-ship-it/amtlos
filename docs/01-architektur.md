# 01 · Systemarchitektur

Stand: 2026-10-11 · Entscheidungen dazu: `ENTSCHEIDUNGEN.md` (E-010 bis E-020)

## Überblick

Amtlos ist ein **modularer Monolith** (NestJS) mit einem Web-Frontend für Nutzer, einem internen Studio für Experten und wenigen isolierten Diensten für riskante Aufgaben (native ELSTER-Bibliothek, fremde Websites, LLM-Aufrufe). Alles läuft in Deutschland.

```mermaid
flowchart LR
  subgraph Clients
    WEB["Web-App / PWA<br/>Next.js · apps/web"]
    MOB["Mobile App<br/>Expo · apps/mobile<br/>(Store ab Abschnitt 10)"]
    STU["Studio (Experten-Backend)<br/>Next.js · apps/studio"]
  end

  subgraph Geteilte Pakete
    ENG["rules-engine<br/>Auswertung + Erklärung"]
    FRI["fristen<br/>Kalender, Feiertage, Verschiebung"]
    DOM["domain<br/>Typen, zod-Schemas"]
  end

  IDP["Zitadel<br/>OIDC, Passkeys, 2FA"]

  subgraph Kern["Kern (Kubernetes, DE)"]
    API["API · NestJS<br/>modularer Monolith"]
    WRK["Worker · NestJS<br/>pg-boss Jobs"]
    PDF["Dokument-Renderer<br/>HTML→PDF, DOCX"]
  end

  subgraph Isoliert["Isolierte Dienste"]
    ERIC["ERiC-Gateway<br/>(Abschnitt 3)"]
    CRAWL["Crawler<br/>(Abschnitt 7)"]
    KI["KI-Gateway<br/>(Abschnitt 4)"]
  end

  PG[("PostgreSQL 16<br/>RLS je Unternehmen<br/>+ pg-boss Queue")]
  S3[("Objektspeicher<br/>verschlüsselt, WORM")]

  subgraph Extern
    ELSTER["ELSTER"]
    LLM["LLM-Anbieter<br/>EU, AVV"]
    MAIL["E-Mail / Push / SMS"]
    PART["Partner<br/>Lohn, Banking, Signatur, Stripe"]
    SITE["Website des Nutzers"]
  end

  WEB -- OIDC --> IDP
  MOB -- OIDC --> IDP
  STU -- OIDC --> IDP
  WEB & MOB & STU -- HTTPS/JSON --> API
  ENG -. "gleiche Logik offline" .- WEB
  ENG -.- MOB
  ENG -.- API
  FRI -.- ENG

  API --> PG
  WRK --> PG
  API --> S3
  WRK --> PDF
  WRK --> MAIL
  WRK --> ERIC --> ELSTER
  WRK --> CRAWL --> SITE
  API --> KI --> LLM
  WRK --> PART
```

## Komponenten

| Komponente | Aufgabe | ab Abschnitt |
|---|---|---|
| `apps/web` | Nutzer-App: Onboarding, Heute, Pflichten, Kalender, Dokumente, später alle Module. PWA mit Offline-Speicher. | 1 |
| `apps/studio` | Experten-Backend: Regel-Editor, Fixtures-Testlauf, Freigaben, Releases, Radar, Vorlagen, Mitteilungen. Eigene Domain, nur Plattformrollen. | 1 |
| `apps/api` | REST-API (OpenAPI-Spezifikation generiert), Auth-Prüfung, Mandantenkontext, Fachmodule. | 1 |
| `apps/worker` | Jobs: Neuberechnung, Erinnerungen, Benachrichtigungen, Dokument-Erzeugung, Release-Rollout, ICS. | 1 |
| `apps/mobile` | Expo-App, geteilte Pakete. | Gerüst 1, Store 10 |
| `services/renderer` | HTML→PDF (Chromium-basiert, ohne Netz), DOCX-Erzeugung. | 1 |
| `services/eric-gateway` | Kapselt die ERiC-Bibliothek; einziger Weg zu ELSTER. | 3 |
| `services/crawler` | Headless-Browser für Online-Check, eigenes Netzsegment, keine Datenbankrechte. | 7 |
| `services/ki-gateway` | Einziger Ausgang zum LLM; Protokoll, PII-Maskierung, Quellenbindung, Validierung. | 4 |

## Fachmodule in der API

Jedes Modul besitzt seine Tabellen und spricht mit anderen Modulen nur über deren öffentliche Services. Abhängigkeiten zeigen nur nach unten.

```mermaid
flowchart TB
  subgraph Plattform
    AUTH[auth / mandant]
    AUDIT[audit]
    DOK[dokumente]
    NOTIF[benachrichtigung]
  end
  subgraph Katalog
    KAT[katalog<br/>Pflichten, Regelwerte, Quellen, Releases]
    FREI[freigabe]
  end
  subgraph Kern
    PROF[profil + ereignisse]
    PLAN[pflichtenplan<br/>Berechnung, Instanzen]
    KAL[kalender / erinnerungen]
  end
  subgraph Fachmodule
    GRU[gruendung · 3]
    FIN[finanzen · 4]
    PERS[personal / arbeitsschutz · 5]
    DS[datenschutz / it / ki · 6]
    ONL[online-check · 7]
    GES[gesellschaft · 3/9]
    FRAG[frag-amtlos · 9]
    POST[behoerden-postfach · 9]
    MARKT[marktplatz · 9]
    RADAR[radar · 9]
  end
  Fachmodule --> Kern
  Kern --> Katalog
  Kern --> Plattform
  Katalog --> Plattform
```

## Kernablauf: vom Ereignis zur Pflicht

```mermaid
sequenceDiagram
  autonumber
  actor U as Nutzer
  participant API
  participant DB as PostgreSQL
  participant W as Worker
  participant E as rules-engine
  U->>API: „Erste Mitarbeiterin eingestellt am 1.11.“
  API->>DB: Ereignis anhängen + Job „neu berechnen“ (eine Transaktion)
  W->>DB: Profil, Ereignisse, aktives Katalog-Release laden
  W->>E: Fakten bilden → auswerten(Stichtag)
  E-->>W: je Pflicht: gilt / gilt nicht / unbekannt + Begründungsbaum + Termine
  W->>DB: Instanzen anlegen/aktualisieren, Berechnungslauf speichern
  W->>DB: Erinnerungen planen
  W-->>U: Push/E-Mail „3 neue Pflichten, erste fällig vor Arbeitsbeginn“
```

Neuberechnung wird ausgelöst durch: neues Ereignis, neue Profilversion, neues Katalog-Release, Tageswechsel (nur Periodenfortschreibung, keine Neuauswertung der Bedingungen), Schwellenüberschreitung aus Finanzdaten (ab Abschnitt 4).

Jeder Lauf ist **reproduzierbar**: Gespeichert werden Release-Nummer, Profilversion, Stichtag und Fakten-Hash. Damit lässt sich später nachweisen, warum Amtlos an einem Tag eine bestimmte Aussage gemacht hat.

## Katalog-Lebenszyklus

```mermaid
flowchart LR
  A[Experte bearbeitet<br/>Pflichtversion im Studio] --> B[Schema-Prüfung +<br/>Fixture-Testlauf]
  B --> C[Prüfer 1<br/>qualifiziert]
  C --> D[Prüfer 2]
  D --> E[Release zusammenstellen]
  E --> F{Umgebung prod?}
  F -- ja --> G[DB-Trigger: nur freigegeben]
  G --> H[Release aktiv]
  F -- nein --> H
  H --> I[Neuberechnung aller<br/>betroffenen Unternehmen]
  H --> J[YAML-Export → PR ins Repo]
  I --> K[Mitteilung<br/>„Was ändert sich für dich?“]
```

## Monorepo-Struktur

```
amtlos/
├─ apps/
│  ├─ web/            Next.js App Router, Nutzer-App, PWA
│  ├─ studio/         Next.js, Experten-Backend
│  ├─ api/            NestJS
│  ├─ worker/         NestJS standalone, pg-boss
│  └─ mobile/         Expo
├─ services/
│  ├─ renderer/
│  ├─ eric-gateway/
│  ├─ crawler/
│  └─ ki-gateway/
├─ packages/
│  ├─ rules-schema/   JSON-Schemas: Pflicht, Regelwert, Fakten-Katalog
│  ├─ rules-engine/   Auswertung, Erklärung, Fakten-Herleitung
│  ├─ fristen/        Termin- und Periodenberechnung, Feiertage, Bankarbeitstage
│  ├─ domain/         zod-Typen, API-Verträge
│  ├─ ui/             Designsystem (Tailwind, Radix-Primitives), WCAG 2.2 AA
│  ├─ i18n/           Übersetzungsdateien DE/EN
│  └─ config/         eslint, tsconfig, tailwind preset
├─ catalog/
│  ├─ pflichten/      YAML je Pflicht (Export aus Studio, Startbestand)
│  ├─ regelwerte/
│  ├─ fixtures/       Profil-Fixtures je Persona und Grenzfall
│  └─ quellen.yaml
├─ db/
│  ├─ migrations/     SQL-Migrationen, 0001 = Referenzschema (siehe 02-datenmodell)
│  ├─ migrieren.mjs   Migrations-Runner mit Prüfsummen
│  └─ tests/
├─ infra/             OpenTofu, Helm-Charts
├─ docs/
├─ ENTSCHEIDUNGEN.md
└─ PRUEFLISTE.md
```

## Sicherheit (Querschnitt)

- **Transport/Ruhe:** TLS 1.3 überall, Datenbank- und Objektspeicher-Verschlüsselung; besonders schützenswerte Felder (Steuer-ID, Gesundheitsdaten im Datenschutzmodul, Bankdaten) zusätzlich anwendungsseitig verschlüsselt (Envelope Encryption, Schlüssel im KMS des Anbieters).
- **Mandantentrennung:** RLS (siehe 02), App-Rolle ohne Eigentümerrechte, Integrationstests „Mandant A sieht nichts von B“ für jede Tabelle als CI-Pflicht.
- **Audit:** jede schreibende Aktion in `audit.ereignis` mit Hash-Kette (manipulationsevident).
- **Rollen:** Plattformrollen erhalten keinen Mandantenzugriff. Support-Zugriff nur über zeitlich begrenzte, vom Inhaber freigegebene Sitzung, im Audit-Log sichtbar.
- **Isolation:** Crawler und Renderer ohne Datenbank-Zugangsdaten; ERiC-Gateway ohne allgemeinen Internetzugang.
- **Lieferkette:** Lockfiles, Renovate, SBOM pro Build, Container-Signaturen.

## Qualität und Betrieb

- **Tests:** Engine und Fristen mit Fixtures je Persona und Grenzfall (Umsatz exakt an Schwelle, Fristende am Feiertag, Schaltjahr, Jahreswechsel); RLS-Tests; E2E (Playwright) der Kernflüsse; axe-Tests je Seite; Lasttest der Neuberechnung (Ziel: Release-Rollout für 100.000 Unternehmen < 30 min).
- **CI/CD:** GitHub Actions → Container-Registry in DE → staging automatisch, prod nach Freigabe.
- **Betrieb:** 99,9 % Uptime-Ziel, tägliche Backups plus Point-in-Time-Recovery, monatlicher Wiederherstellungstest.
