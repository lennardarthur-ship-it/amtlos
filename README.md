# Amtlos

Das Bürokratie-Betriebssystem für Kleinunternehmer und Startups in Deutschland.

**Stand:** Bauabschnitte 1–10 umgesetzt, danach Launch-Fokus auf Gründer (Kernmodule sichtbar, Schnellstart, Abo, Löschen, Rechtsseiten – E-110 bis E-116) (Fundament; Profil, Pflichten, Kalender; Gründungsassistent und Kapitalgesellschaften; Finanzen light mit E-Rechnung; Personal und Arbeitsschutz; Datenschutz, IT-Sicherheit, KI; Online-Check, Handel und Produkte; Branchenmodule; Radar, Frag Amtlos, Behörden-Postfach und Experten-Marktplatz; Kanzleien, White-Label, Englisch, mobile App und Skalierung). Testberichte: im internen Repository amtlos-intern (`docs/testberichte/`). API: [`apps/api/openapi.yaml`](apps/api/openapi.yaml). Fachliche Inhalte: alle 226 Katalogeinträge und alle 43 Vorlagen sind fachlich freigegeben (Stand 25.10.2026, E-171 bis E-185; Register docs/freigabe-katalog/freigaben.yaml, Vorlagen-Prüfsummen packages/fachlogik/src/dokumente/geprueft.ts).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/web` | Nutzer-App (Next.js, PWA) |
| `apps/studio` | Experten-Backend: Katalog bearbeiten, prüfen, veröffentlichen |
| `apps/api` | REST-API (NestJS) |
| `apps/worker` | Neuberechnung, Tageswechsel, Erinnerungen (E-Mail, Push), Einladungen, Marktplatz-Anfragen |
| `apps/mobile` | Mobile App (Expo) für iPhone und Android (E-190): Pflichten-Check, 43 Vorlagen zum Ausfüllen, PDF auf dem Gerät (E-121 bis E-123); Store-Start: amtlos-intern: docs/11-store-start.md |
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
| `docs/01-architektur.md` … `docs/04-seitenstruktur.md`, `docs/06-design.md`, `docs/07-betrieb.md` | Architektur, Datenmodell, Regel-Schema, Seiten, Design, Betrieb |
| `docs/nutzungsbedingungen-entwurf.md` | Nutzungsbedingungen – Quelle für `nutzungsbedingungen.html` der Website (`apps/website/bauen.mjs`) |
| `docs/recherche/2026-10-12/` | Recherche mit Quellen – Eingabe für `packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs` (erzeugt `bausteine.ts`, CI prüft) |
| `docs/freigabe-katalog/` | Freigabe-Register: `freigaben.yaml` (je Freigabe Rolle, Datum, Umfang in unseren Worten, Art, „beim Gründer“), `offene-punkte.yaml`, `namen-sha256.json` (E-199-Namensprüfung) und `anwenden.py` (schreibt die `pruefung`-Blöcke in den Katalog; `--pruefen` prüft Katalog gegen Register). Vorlagen-Freigaben: `packages/fachlogik/src/dokumente/geprueft.ts`. Keine Unterlagen von oder für Prüfer und keine Namen im Repository (E-199) |

### Interne Notizen: privates Repository amtlos-intern

Seit 26.10.2026 (Gründerentscheidung) liegen alle internen Notizen nicht mehr hier, sondern im privaten Repository
**amtlos-intern** (GitHub, gleiche Organisation; lokal neben diesem Repository auschecken, z. B. `~/code/amtlos` und
`~/code/amtlos-intern`):

| Pfad in amtlos-intern | Inhalt |
|---|---|
| `ENTSCHEIDUNGEN.md` | Entscheidungsprotokoll (E-…) – alle Architektur- und Produktentscheidungen |
| `PRUEFLISTE.md` | offene fachliche Prüfpunkte (G-, J-, T-, K-…) |
| `docs/05-risiken.md`, `docs/08-elster-eric.md` … `docs/15-partnerkanzleien.md` | Risiken und Konzepte (iCloud, Gestaltung, Store-Start, Recht/Store, B2B, Marke, Partnerkanzleien) |
| `docs/*-entwurf.md`, `docs/play-datensicherheit.md` | Entwürfe Android-Rechtstexte, Begründungen Datensicherheit |
| `docs/testberichte/`, `docs/review/` | Testberichte, Review-Stand |
| `docs/pruefmappe-*/`, `docs/freigabe-katalog/*.py`, `docs/freigabe-vorlagen/`, `scripts/pruefpaket.py`, `scripts/pruefliste.py`, `scripts/katalog_startbestand.py` | Prüfmappen und Werkzeuge für Prüfunterlagen (lesen Katalog und Code aus amtlos; Ziel nur außerhalb beider Repositorys) |

Verweise im Code wie `(E-123)` zeigen ins Entscheidungsprotokoll, `amtlos-intern: docs/…` auf eine Datei dort.

## Schnellstart

Siehe [docs/07-betrieb.md](docs/07-betrieb.md).
