#!/usr/bin/env bash
# Legt eine frische Testdatenbank an, spielt das Schema als Nicht-Superuser ein und führt die Tests aus.
# Erwartet einen erreichbaren PostgreSQL ≥ 16 mit Superuser; Verbindung über PGHOST/PGPORT/PGUSER.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-amtlos_test}
psql -v ON_ERROR_STOP=1 -q -d postgres <<SQL
drop database if exists $DB;
create database $DB;
do \$\$ begin
  if not exists (select from pg_roles where rolname='amtlos_owner')  then create role amtlos_owner login; end if;
  if not exists (select from pg_roles where rolname='amtlos_app')    then create role amtlos_app nologin; end if;
  if not exists (select from pg_roles where rolname='amtlos_studio') then create role amtlos_studio nologin; end if;
  if not exists (select from pg_roles where rolname='api_user')      then create role api_user login in role amtlos_app; end if;
  if not exists (select from pg_roles where rolname='studio_user')   then create role studio_user login in role amtlos_studio; end if;
end \$\$;
\c $DB
create extension pgcrypto; create extension citext; create extension btree_gist;
grant create on database $DB to amtlos_owner;
grant api_user, studio_user to amtlos_owner;   -- nur Test: Owner wechselt in die Rollen
SQL
psql -v ON_ERROR_STOP=1 -q -U amtlos_owner -d "$DB" -f schema.sql 2>&1 | { grep -v 'already exists' || true; }
echo "Schema eingespielt."
psql -v ON_ERROR_STOP=1 -U amtlos_owner -d "$DB" -f tests/schema_test.sql 2>&1 | { sed -n 's/^psql:[^ ]* NOTICE:  //p; /ALLE\|FEHL\|ERROR/p'; }
