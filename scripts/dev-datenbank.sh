#!/usr/bin/env bash
# Lokale Entwicklungsdatenbank: Rollen, Erweiterungen, Migrationen, Katalog-Import.
# Erwartet PostgreSQL ≥ 16 mit Superuser über PGHOST/PGPORT/PGUSER/PGPASSWORD (z. B. docker compose up -d).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DEV_DB:-amtlos}
PW=${DEV_DB_PASSWORT:-amtlos}
psql -v ON_ERROR_STOP=1 -q -d postgres <<SQL
do \$\$ begin
  if not exists (select from pg_roles where rolname='amtlos_owner')  then create role amtlos_owner login; end if;
  if not exists (select from pg_roles where rolname='amtlos_app')    then create role amtlos_app nologin; end if;
  if not exists (select from pg_roles where rolname='amtlos_studio') then create role amtlos_studio nologin; end if;
  if not exists (select from pg_roles where rolname='amtlos_worker') then create role amtlos_worker nologin; end if;
  if not exists (select from pg_roles where rolname='api_user')      then create role api_user login in role amtlos_app; end if;
  if not exists (select from pg_roles where rolname='studio_user')   then create role studio_user login in role amtlos_studio; end if;
  if not exists (select from pg_roles where rolname='worker_user')   then create role worker_user login in role amtlos_worker; end if;
end \$\$;
alter role amtlos_owner password '$PW'; alter role api_user password '$PW';
alter role studio_user password '$PW'; alter role worker_user password '$PW';
SQL
psql -q -d postgres -tc "select 1 from pg_database where datname = '$DB'" | grep -q 1 || psql -q -d postgres -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "create extension if not exists pgcrypto; create extension if not exists citext; create extension if not exists btree_gist; grant create on database $DB to amtlos_owner;"
# NUR_ROLLEN=1: nur Rollen, Datenbank und Erweiterungen (Migrationen dann z. B. mit dem Werkzeug-Container)
if [[ "${NUR_ROLLEN:-}" == "1" ]]; then echo "Rollen und Datenbank $DB bereit."; exit 0; fi
H=${PGHOST:-localhost}; P=${PGPORT:-5432}
if [[ "$H" == /* ]]; then basis="localhost:$P/$DB?host=$H"; else basis="$H:$P/$DB"; fi
pnpm --filter @amtlos/server build >/dev/null
MIGRATION_DATABASE_URL="postgresql://amtlos_owner:$PW@$basis" node packages/server/dist/cli.js migrieren
STUDIO_DATABASE_URL="postgresql://studio_user:$PW@$basis" node packages/server/dist/cli.js katalog-importieren
echo "Fertig. DATABASE_URL=postgresql://api_user:$PW@$basis  WORKER_DATABASE_URL=postgresql://worker_user:$PW@$basis"
