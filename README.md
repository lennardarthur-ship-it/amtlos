# Amtlos

Das Bürokratie-Betriebssystem für Kleinunternehmer und Startups in Deutschland.

**Stand:** Architekturpaket freigegeben (2026-10-11). Bauabschnitt 1 (Fundament) in Arbeit.

## Inhalt

| Datei | Inhalt |
|---|---|
| `ENTSCHEIDUNGEN.md` | alle Architektur- und Produktentscheidungen mit Status |
| `PRUEFLISTE.md` | zentrale Liste aller fachlich zu prüfenden Punkte |
| `docs/01-architektur.md` | Systemarchitektur, Diagramme, Komponenten, Monorepo |
| `docs/02-datenmodell.md` | Datenmodell: Kern physisch, Fachmodule logisch |
| `docs/03-regel-schema.md` | Regel-DSL, Fristen, Engine-Ausgabe, Fixtures |
| `docs/04-seitenstruktur.md` | Routen der Nutzer-App und des Studios |
| `docs/05-risiken.md` | Risikoregister |
| `db/migrations/` | PostgreSQL-Migrationen (0001 = Referenzschema Abschnitt 1–2 inkl. RLS) |
| `db/tests/` | Schema-Tests (30 Prüfungen) |
| `packages/rules-schema/` | JSON-Schemas, Fakten- und Ereignis-Katalog, Katalog-Validator |
| `catalog/` | Beispiel-Pflichten, Regelwerte, Fixture |

## Prüfen

```bash
# Katalog validieren
cd packages/rules-schema && npm install && npm run validate

# Schema-Tests (PostgreSQL ≥ 16 mit Superuser, PGHOST/PGPORT/PGUSER gesetzt)
db/tests/run.sh
```
