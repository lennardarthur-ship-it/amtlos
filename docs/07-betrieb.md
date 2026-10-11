# 07 · Lokal starten und betreiben

## Lokal

```bash
pnpm install
docker compose up -d                                   # PostgreSQL 16
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres
scripts/dev-datenbank.sh                               # Rollen, Migrationen, Katalog-Import
pnpm build

# API (Port 3001), Worker, Web (Port 3000) – Werte aus .env.example
UMGEBUNG=dev AUTH_MODUS=dev DEV_JWT_SECRET=… DATABASE_URL=postgresql://api_user:amtlos@localhost:5432/amtlos node apps/api/dist/main.js
UMGEBUNG=dev WORKER_DATABASE_URL=postgresql://worker_user:amtlos@localhost:5432/amtlos node apps/worker/dist/main.js
cd apps/web && UMGEBUNG=dev AUTH_MODUS=dev DEV_JWT_SECRET=… SITZUNG_SCHLUESSEL=… API_INTERN_URL=http://localhost:3001 pnpm start

# Studio (Port 3100): erst Konten mit Plattformrolle anlegen
MIGRATION_DATABASE_URL=postgresql://amtlos_owner:amtlos@localhost:5432/amtlos \
  node packages/server/dist/cli.js plattformrolle redakteurin r@example.org "Rita" redaktion
MIGRATION_DATABASE_URL=… node packages/server/dist/cli.js plattformrolle stb s@example.org "Stefan" experte "steuerberater=StBK 4711"
cd apps/studio && STUDIO_DATABASE_URL=postgresql://studio_user:amtlos@localhost:5432/amtlos COOKIE_PRAEFIX=amtlos_studio … pnpm start
```

## Tests

| Was | Befehl |
|---|---|
| Alles ohne Datenbank | `pnpm test` |
| Katalog | `pnpm katalog:pruefen` |
| Schema, RLS, Freigaben | `db/tests/run.sh` (PG-Superuser in `PGHOST`…) |
| Integration (Server, API, Worker) | mit `PGHOST` gesetzt: `pnpm --filter @amtlos/server --filter @amtlos/api --filter @amtlos/worker test` |
| E2E + Barrierefreiheit | laufende Dienste, dann `E2E_URL=http://localhost:3000 pnpm --filter @amtlos/web e2e` |

## Container

Ein Dockerfile mit einem Ziel je Dienst (`docker/Dockerfile`, E-084):

```bash
docker build -f docker/Dockerfile --target api -t amtlos-api .      # ebenso: worker, web, studio, werkzeug
docker run --rm -e MIGRATION_DATABASE_URL=… amtlos-werkzeug migrieren
docker run --rm -e STUDIO_DATABASE_URL=… amtlos-werkzeug katalog-importieren   # nur dev/test
```

Alle Images laufen als Nutzer `node`, enthalten nur Produktionsabhängigkeiten und keinen Paketmanager. Web und Studio sind Next.js-„standalone“-Bündel. Die CI baut alle fünf Images, richtet damit eine leere Datenbank ein und startet die Dienste (Rauchtest).

## Dateiablage

Belege und Rechnungen liegen unveränderlich in `ABLAGE_VERZEICHNIS` (API). In staging/prod ist die Variable Pflicht; das Verzeichnis gehört auf ein verschlüsseltes, gesichertes Volume. Dateien werden nie überschrieben oder gelöscht (E-088). Ein S3-kompatibler Speicher mit Object Lock folgt mit dem Hosting.

## Beobachten

| Was | Wo |
|---|---|
| Zugriffslog der API | stdout, eine JSON-Zeile je Anfrage (`msg: "http"`, Anfrage-ID, Routen-Muster, Status, `dauer_ms`) |
| Worker | stdout, JSON (`neuberechnung`, `erinnerungen`, `einladung`, `tageswechsel`) – nur IDs und Zähler |
| Metriken | `GET /metriken` mit `Authorization: Bearer $METRIKEN_TOKEN` (Prometheus-Format) |
| API-Beschreibung | `GET /v1/openapi.json` (Quelle: `apps/api/openapi.yaml`, muss im Container neben `dist/` liegen) |

Wichtige Metriken: `amtlos_http_anfragen_total{status=~"5.."}`, `amtlos_http_dauer_sekunden`, `amtlos_warteschlange_wartend{queue="neuberechnung"}` (staut sich die Berechnung?), `amtlos_warteschlange_wartend{queue="einladung-versenden"}`. Alarmregeln legen wir mit dem Hosting fest (E-081).

## Deploy (Reihenfolge)

1. Rollen und Erweiterungen durch die Plattform anlegen (`amtlos_owner`, `amtlos_app`, `amtlos_worker`, `amtlos_studio`, Login-Rollen je Dienst; `pgcrypto`, `citext`, `btree_gist`).
2. `amtlos-server migrieren` als Eigentümer (bricht bei veränderten Migrationen ab).
3. `amtlos-server umgebung prod` (einmalig; E-067).
4. API, Worker, Web, Studio ausrollen. Web und Studio mit `AUTH_MODUS=oidc`; die Konfiguration verweigert `dev` in staging und prod.
5. Katalog nur über das Studio (Vier-Augen-Freigabe), nicht über `katalog-importieren`.

Infrastruktur als Code (OpenTofu, STACKIT) folgt, sobald der Hosting-Vertrag steht (E-013).

## Online-Check

Der Online-Check (E-097) ruft fremde Websites aus der API heraus ab. Dafür braucht die API ausgehendes HTTP/HTTPS (Ports 80/443). Interne Ziele sind gesperrt; `ONLINECHECK_PRIVATE_NETZE=erlaubt` ist nur für Entwicklung und Tests gedacht (lokale Testseite) und wird in staging/prod beim Start abgelehnt. `ONLINECHECK_JE_TAG` begrenzt die Checks je Unternehmen und Tag (Standard 20). Empfehlung für den Betrieb: ausgehender Verkehr der API über einen Egress-Proxy mit Sperrliste für interne Netze als zweite Schutzschicht.

## White-Label-Marken

Eine Marke (E-105) gilt für die Hostnamen, die im Studio unter „Marken“ eingetragen sind. Für jeden Host braucht es DNS (CNAME auf die Web-App) und ein TLS-Zertifikat am Ingress. Die Web-App liest den Host aus `X-Forwarded-Host` bzw. `Host`. Der Ingress muss diesen Kopf setzen und darf nur bekannte Hosts durchlassen. Einladungs- und Erinnerungslinks zeigen auf `WEB_URL`, die Amtlos-Adresse. Links unter der Markenadresse folgen mit dem Hosting.

## Übersetzungen

`katalog-importieren` übernimmt auch `catalog/uebersetzungen/en.yaml` (nur geänderte Einträge, im Studio geprüfte bleiben) und berechnet die lokalisierten Dokumente neu. Fehlende Übersetzungen nach Katalogänderungen zeigt `python3 scripts/uebersetzung_abdeckung.py` (mit `--fehlende-als-vorlage` als YAML-Gerüst); ein Test schlägt fehl, solange Texte fehlen.

## Mobile App und Push

- App: `apps/mobile` (README dort). `expo.extra.apiUrl` zeigt auf die öffentliche API. Die API erlaubt die Kopfzeilen `X-Unternehmen-Id` und `X-Sprache`.
- Push im Worker: `PUSH_ANBIETER=expo` (Standard `aus`), optional `EXPO_ZUGANGSTOKEN`. Erst einschalten, wenn T-41 geklärt ist. Ohne Push-Anbieter werden Push-Erinnerungen als verworfen markiert, E-Mail läuft weiter.
- `POST /v1/dev/token` gibt es nur mit `AUTH_MODUS=dev` in dev/test.

## Skalierung

Lasttest: `PGHOST=… node scripts/lasttest-neuberechnung.mjs 10000 8` (Ergebnisse in docs/testberichte/lasttest.md). Mehrere API- und Worker-Instanzen sind möglich (Caches je Prozess sind unkritisch). Die Ratenbegrenzung zählt je Instanz (G-23).
