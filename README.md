# Amtlos

Das Bürokratie-Betriebssystem für Kleinunternehmer und Startups in Deutschland.

**Stand:** Architekturpaket (Spezifikation Abschnitt 14, Schritt 2) – wartet auf Freigabe durch den Product Owner. Noch kein Anwendungscode.

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
| `db/schema.sql` | PostgreSQL-Referenzschema Abschnitt 1–2 inkl. RLS |
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
