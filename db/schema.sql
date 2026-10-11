-- =====================================================================
-- Amtlos · Referenzschema PostgreSQL 16 · Abschnitte 1–2 (Fundament, Kern)
-- Stand 2026-10-11 · siehe docs/02-datenmodell.md
--
-- Schemas:
--   katalog  global, nicht mandantenbezogen: Pflichten, Regelwerte, Quellen,
--            Freigaben, Releases, Vorlagen, Gemeinden, Feiertage
--   app      mandantenbezogen (RLS): Unternehmen, Profil, Ereignisse,
--            Pflichtinstanzen, Dokumente, Erinnerungen
--   audit    manipulationsevidentes Protokoll (Hash-Kette)
--
-- Datenbankrollen:
--   amtlos_owner   Eigentümer, nur Migrationen
--   amtlos_app     API/Worker im Mandantenkontext, RLS greift
--   amtlos_studio  Studio: schreibt katalog.*, kein Zugriff auf app.*
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

do $$ begin
  if not exists (select from pg_roles where rolname = 'amtlos_app')    then create role amtlos_app nologin; end if;
  if not exists (select from pg_roles where rolname = 'amtlos_studio') then create role amtlos_studio nologin; end if;
end $$;

create schema katalog;
create schema app;
create schema audit;

-- ---------------------------------------------------------------------
-- Kontext: wird pro Transaktion von der API gesetzt
--   select set_config('amtlos.konto_id', '<uuid>', true);
--   select set_config('amtlos.unternehmen_id', '<uuid>', true);
--   select set_config('amtlos.umgebung', 'prod', false);   -- pro Verbindung
-- ---------------------------------------------------------------------
create function app.aktuelles_konto() returns uuid
  language sql stable as $$ select nullif(current_setting('amtlos.konto_id', true), '')::uuid $$;
create function app.aktuelles_unternehmen() returns uuid
  language sql stable as $$ select nullif(current_setting('amtlos.unternehmen_id', true), '')::uuid $$;
create function katalog.umgebung() returns text
  language sql stable as $$ select coalesce(nullif(current_setting('amtlos.umgebung', true), ''), 'dev') $$;

-- =====================================================================
-- KONTEN (global)
-- =====================================================================
create table app.konto (
  id            uuid primary key default gen_random_uuid(),
  idp_subject   text not null unique,              -- Zitadel "sub"
  email         citext not null,
  anzeigename   text not null,
  sprache       text not null default 'de' check (sprache in ('de','en')),
  erstellt_am   timestamptz not null default now(),
  geloescht_am  timestamptz
);

create type app.plattform_rolle as enum ('plattform_admin','redaktion','experte','support');
create table app.konto_plattform_rolle (
  konto_id  uuid not null references app.konto(id),
  rolle     app.plattform_rolle not null,
  primary key (konto_id, rolle)
);

create type katalog.qualifikation as enum ('steuerberater','rechtsanwalt','fachkraft_arbeitssicherheit','datenschutzbeauftragter','sonstige');
create table katalog.experte_qualifikation (
  konto_id      uuid not null references app.konto(id),
  art           katalog.qualifikation not null,
  nachweis      text not null,                      -- z. B. Kammer, Zulassungsnummer
  gueltig_bis   date,
  primary key (konto_id, art)
);

-- =====================================================================
-- KATALOG (global)
-- =====================================================================
create type katalog.status_recht as enum ('in_kraft','beschlossen','entwurf','geplant','ausgelaufen');
create type katalog.pruef_status  as enum ('entwurf','in_pruefung','freigegeben','abgelehnt','zurueckgezogen');
create type katalog.kategorie     as enum ('gruendung','gesellschaft','steuern','personal','arbeitsschutz','datenschutz','it_sicherheit','ki','online','produkte','branche');

create table katalog.quelle (
  id            uuid primary key default gen_random_uuid(),
  titel         text not null,
  url           text not null,
  herausgeber   text,
  abgerufen_am  date,                               -- null = noch nicht abgerufen
  archiv_key    text,                               -- Kopie im Objektspeicher
  sha256        bytea,
  unique (url, abgerufen_am)
);

create table katalog.pflicht (
  id          text primary key check (id ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  kategorie   katalog.kategorie not null,
  erstellt_am timestamptz not null default now()
);

create table katalog.pflicht_version (
  id              uuid primary key default gen_random_uuid(),
  pflicht_id      text not null references katalog.pflicht(id),
  version         int  not null check (version >= 1),
  daten           jsonb not null,                   -- vollständiges Dokument nach pflicht.schema.json
  schema_version  int  not null default 1,
  status_recht    katalog.status_recht not null,
  gueltig_ab      date,
  gueltig_bis     date,
  pruef_status    katalog.pruef_status not null default 'entwurf',
  erstellt_von    uuid not null references app.konto(id),
  erstellt_am     timestamptz not null default now(),
  unique (pflicht_id, version),
  check (gueltig_bis is null or gueltig_ab is null or gueltig_bis >= gueltig_ab),
  check (daten->>'id' = pflicht_id and (daten->>'version')::int = version)
);

create table katalog.regelwert (
  id           text primary key check (id ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
  einheit      text not null,
  bezeichnung  jsonb not null
);

create table katalog.regelwert_version (
  id            uuid primary key default gen_random_uuid(),
  regelwert_id  text not null references katalog.regelwert(id),
  version       int not null check (version >= 1),
  wert          numeric not null,
  gueltig_ab    date not null,
  gueltig_bis   date,
  status_recht  katalog.status_recht not null,
  daten         jsonb not null,                     -- vollständiges Dokument nach regelwert.schema.json
  pruef_status  katalog.pruef_status not null default 'entwurf',
  erstellt_von  uuid not null references app.konto(id),
  erstellt_am   timestamptz not null default now(),
  unique (regelwert_id, version),
  check (gueltig_bis is null or gueltig_bis >= gueltig_ab),
  -- E-034: freigegebene Versionen eines Regelwerts dürfen sich zeitlich nicht überlappen
  exclude using gist (
    regelwert_id with =,
    daterange(gueltig_ab, gueltig_bis, '[]') with &&
  ) where (pruef_status = 'freigegeben')
);

create table katalog.pflicht_version_quelle (
  pflicht_version_id uuid not null references katalog.pflicht_version(id) on delete cascade,
  quelle_id          uuid not null references katalog.quelle(id),
  fundstelle         text,
  primary key (pflicht_version_id, quelle_id)
);
create table katalog.regelwert_version_quelle (
  regelwert_version_id uuid not null references katalog.regelwert_version(id) on delete cascade,
  quelle_id            uuid not null references katalog.quelle(id),
  fundstelle           text,
  primary key (regelwert_version_id, quelle_id)
);

create table katalog.vorlage (
  id          text primary key,                     -- vorlage.gefaehrdungsbeurteilung.gastronomie
  kategorie   katalog.kategorie not null
);
create table katalog.vorlage_version (
  id            uuid primary key default gen_random_uuid(),
  vorlage_id    text not null references katalog.vorlage(id),
  version       int not null,
  sprache       text not null check (sprache in ('de','en')),
  format        text not null check (format in ('html','docx')),
  inhalt        text not null,                      -- Template-Quelltext
  felder        jsonb not null,                     -- benötigte Profil-/Fragefelder
  pruef_status  katalog.pruef_status not null default 'entwurf',
  erstellt_von  uuid not null references app.konto(id),
  erstellt_am   timestamptz not null default now(),
  unique (vorlage_id, version, sprache)
);

-- ---------- Vier-Augen-Freigabe (E-039) ----------
create type katalog.freigabe_objekt as enum ('pflicht_version','regelwert_version','vorlage_version');
create type katalog.entscheidung    as enum ('freigegeben','abgelehnt','aenderung_noetig');

create table katalog.freigabe (
  id             uuid primary key default gen_random_uuid(),
  objekt_art     katalog.freigabe_objekt not null,
  objekt_id      uuid not null,
  pruefer_id     uuid not null references app.konto(id),
  qualifikation  katalog.qualifikation,             -- null = Zweitprüfung ohne Fachqualifikation
  entscheidung   katalog.entscheidung not null,
  kommentar      text,
  zeitpunkt      timestamptz not null default now(),
  unique (objekt_art, objekt_id, pruefer_id)
);

-- Autor darf nicht selbst prüfen; Qualifikation muss beim Prüfer hinterlegt und gültig sein.
create function katalog.freigabe_pruefen() returns trigger language plpgsql as $$
declare autor uuid;
begin
  autor := case new.objekt_art
    when 'pflicht_version'   then (select erstellt_von from katalog.pflicht_version   where id = new.objekt_id)
    when 'regelwert_version' then (select erstellt_von from katalog.regelwert_version where id = new.objekt_id)
    when 'vorlage_version'   then (select erstellt_von from katalog.vorlage_version   where id = new.objekt_id)
  end;
  if autor is null then raise exception 'Freigabe: Objekt % % existiert nicht', new.objekt_art, new.objekt_id; end if;
  if autor = new.pruefer_id then raise exception 'Freigabe: Autor darf die eigene Version nicht prüfen'; end if;
  if new.qualifikation is not null and not exists (
       select 1 from katalog.experte_qualifikation q
       where q.konto_id = new.pruefer_id and q.art = new.qualifikation
         and (q.gueltig_bis is null or q.gueltig_bis >= current_date)) then
    raise exception 'Freigabe: Qualifikation % ist für den Prüfer nicht hinterlegt', new.qualifikation;
  end if;
  return new;
end $$;
create trigger freigabe_pruefen before insert on katalog.freigabe
  for each row execute function katalog.freigabe_pruefen();

-- Freigegeben, wenn ≥ 2 verschiedene Prüfer freigegeben haben, ≥ 1 davon qualifiziert, und keine offene Ablehnung.
-- (Welche Qualifikation zu welcher Kategorie passt, prüft die API; Zuordnung ist FACHLICH ZU PRÜFEN.)
create function katalog.ist_freigegeben(art katalog.freigabe_objekt, oid uuid) returns boolean
  language sql stable as $$
  select count(distinct pruefer_id) filter (where entscheidung = 'freigegeben') >= 2
     and count(*) filter (where entscheidung = 'freigegeben' and qualifikation is not null) >= 1
     and count(*) filter (where entscheidung <> 'freigegeben') = 0
  from katalog.freigabe where objekt_art = art and objekt_id = oid
$$;

-- pruef_status 'freigegeben' darf nur gesetzt werden, wenn die Freigaben vorliegen.
create function katalog.status_schuetzen() returns trigger language plpgsql as $$
begin
  if new.pruef_status = 'freigegeben' and old.pruef_status is distinct from 'freigegeben'
     and not katalog.ist_freigegeben(tg_argv[0]::katalog.freigabe_objekt, new.id) then
    raise exception 'Status freigegeben ohne vollständige Vier-Augen-Freigabe';
  end if;
  if old.pruef_status = 'freigegeben' and new.daten is distinct from old.daten then
    raise exception 'Freigegebene Versionen sind unveränderlich; neue Version anlegen';
  end if;
  return new;
end $$;
create trigger status_schuetzen before update on katalog.pflicht_version
  for each row execute function katalog.status_schuetzen('pflicht_version');
create trigger status_schuetzen before update on katalog.regelwert_version
  for each row execute function katalog.status_schuetzen('regelwert_version');

-- View: geprueft_von / geprueft_am wie in Spezifikation 3.2
create view katalog.pflicht_version_pruefung as
  select pv.id, pv.pflicht_id, pv.version, pv.pruef_status,
         array_agg(k.anzeigename order by f.zeitpunkt) filter (where f.entscheidung = 'freigegeben') as geprueft_von,
         (max(f.zeitpunkt) filter (where f.entscheidung = 'freigegeben'))::date                   as geprueft_am
  from katalog.pflicht_version pv
  left join katalog.freigabe f on f.objekt_art = 'pflicht_version' and f.objekt_id = pv.id
  left join app.konto k on k.id = f.pruefer_id
  group by pv.id;

-- ---------- Releases (E-030, E-038) ----------
create table katalog.release (
  id                 uuid primary key default gen_random_uuid(),
  nummer             int not null unique,
  notiz              text,
  erstellt_von       uuid not null references app.konto(id),
  erstellt_am        timestamptz not null default now(),
  veroeffentlicht_am timestamptz,
  export_commit      text                           -- Git-Commit des YAML-Exports
);
create table katalog.release_inhalt (
  release_id  uuid not null references katalog.release(id),
  objekt_art  katalog.freigabe_objekt not null,
  objekt_id   uuid not null,
  primary key (release_id, objekt_art, objekt_id)
);

create function katalog.release_inhalt_pruefen() returns trigger language plpgsql as $$
declare st katalog.pruef_status;
begin
  if (select veroeffentlicht_am from katalog.release where id = new.release_id) is not null then
    raise exception 'Release ist bereits veröffentlicht und unveränderlich';
  end if;
  if katalog.umgebung() = 'prod' then
    st := case new.objekt_art
      when 'pflicht_version'   then (select pruef_status from katalog.pflicht_version   where id = new.objekt_id)
      when 'regelwert_version' then (select pruef_status from katalog.regelwert_version where id = new.objekt_id)
      when 'vorlage_version'   then (select pruef_status from katalog.vorlage_version   where id = new.objekt_id)
    end;
    if st is distinct from 'freigegeben' then
      raise exception 'prod: % % ist nicht freigegeben (Status %)', new.objekt_art, new.objekt_id, st;
    end if;
  end if;
  return new;
end $$;
create trigger release_inhalt_pruefen before insert or update on katalog.release_inhalt
  for each row execute function katalog.release_inhalt_pruefen();

create view katalog.aktives_release as
  select * from katalog.release where veroeffentlicht_am is not null order by nummer desc limit 1;

-- ---------- Radar ----------
create table katalog.radar_eintrag (
  id                  uuid primary key default gen_random_uuid(),
  titel               jsonb not null,
  pflicht_id          text references katalog.pflicht(id),   -- betroffene/neue Pflicht, falls modelliert
  status_recht        katalog.status_recht not null check (status_recht in ('entwurf','beschlossen','geplant')),
  wahrscheinlichkeit  text not null check (wahrscheinlichkeit in ('niedrig','mittel','hoch','sicher')),
  erwartet_ab         date,
  vorbereitung        jsonb not null default '[]',
  pruef_status        katalog.pruef_status not null default 'entwurf',
  aktualisiert_am     timestamptz not null default now()
);

-- ---------- Stammdaten ----------
create table katalog.gemeinde (
  ags         char(8) primary key check (ags ~ '^[0-9]{8}$'),
  name        text not null,
  bundesland  char(2) not null check (bundesland in ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH'))
);
create table katalog.gewerbesteuer_hebesatz (
  ags       char(8) not null references katalog.gemeinde(ags),
  jahr      int not null,
  hebesatz  numeric(6,2) not null,
  quelle_id uuid references katalog.quelle(id),
  primary key (ags, jahr)
);
create table katalog.feiertag (
  datum       date not null,
  name        text not null,
  bundesland  char(2),                              -- null = bundesweit
  ags         char(8) references katalog.gemeinde(ags),  -- gesetzt = nur diese Gemeinde
  quelle_id   uuid references katalog.quelle(id),
  check (ags is null or bundesland is not null)
);
create unique index feiertag_eindeutig on katalog.feiertag (datum, coalesce(bundesland,'--'), coalesce(ags,'--------'));
create table katalog.bankarbeitstag_ausnahme (     -- TARGET2-Schließtage zusätzlich zu Wochenenden
  datum date primary key,
  name  text not null
);

-- =====================================================================
-- MANDANTEN (app, RLS)
-- =====================================================================
create type app.rolle as enum ('inhaber','mitarbeiter','steuerberater','admin');

create table app.unternehmen (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  abo_plan      text not null default 'test',       -- Preise/Pläne als Konfiguration (Spezifikation 9)
  erstellt_am   timestamptz not null default now(),
  geloescht_am  timestamptz
);

create table app.mitgliedschaft (
  unternehmen_id uuid not null references app.unternehmen(id),
  konto_id       uuid not null references app.konto(id),
  rolle          app.rolle not null,
  erstellt_am    timestamptz not null default now(),
  primary key (unternehmen_id, konto_id)
);

create table app.einladung (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  email           citext not null,
  rolle           app.rolle not null,
  token_hash      bytea not null unique,
  laeuft_ab       timestamptz not null,
  angenommen_am   timestamptz
);

-- Mitgliedschaftsprüfung als SECURITY DEFINER, damit Policies nicht rekursiv RLS auslösen.
create function app.ist_mitglied(u uuid) returns boolean
  language sql stable security definer set search_path = app, pg_temp as $$
  select exists (select 1 from app.mitgliedschaft m
                 where m.unternehmen_id = u and m.konto_id = app.aktuelles_konto())
$$;

create function app.hat_rolle(u uuid, rollen app.rolle[]) returns boolean
  language sql stable security definer set search_path = app, pg_temp as $$
  select exists (select 1 from app.mitgliedschaft m
                 where m.unternehmen_id = u and m.konto_id = app.aktuelles_konto() and m.rolle = any(rollen))
$$;

-- ---------- Profil (versioniert) ----------
create table app.profil_version (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  version         int not null,
  daten           jsonb not null,                   -- validiert durch domain/profil.ts
  schema_version  int not null default 1,
  rechtsform      text generated always as (daten->>'rechtsform') stored,
  bundesland      text generated always as (daten->>'bundesland') stored,
  gemeinde_ags    text generated always as (daten->>'gemeinde_ags') stored,
  erstellt_von    uuid not null references app.konto(id),
  erstellt_am     timestamptz not null default now(),
  unique (unternehmen_id, version)
);

-- ---------- Ereignisse (append-only, E-018) ----------
create table app.ereignis (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  typ             text not null check (typ ~ '^[a-z][a-z0-9_]*$'),   -- aus ereignisse.json
  eingetreten_am  date not null,
  payload         jsonb not null default '{}',
  quelle          text not null check (quelle in ('nutzer','system','import','geraet')),
  client_id       uuid,                              -- Idempotenz bei Offline-Upload
  storniert_ereignis_id uuid references app.ereignis(id),            -- Korrektur = neues Ereignis
  erfasst_von     uuid references app.konto(id),
  erfasst_am      timestamptz not null default now(),
  unique (unternehmen_id, client_id)
);

create function app.nur_anhaengen() returns trigger language plpgsql as $$
begin raise exception '% ist append-only; Korrektur über Storno-Eintrag', tg_table_name; end $$;
create trigger ereignis_unveraenderlich before update or delete on app.ereignis
  for each row execute function app.nur_anhaengen();

-- ---------- Berechnungsläufe (Reproduzierbarkeit) ----------
create table app.berechnungslauf (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  release_id         uuid not null references katalog.release(id),
  profil_version_id  uuid not null references app.profil_version(id),
  stichtag           date not null,
  ausgeloest_durch   text not null,                  -- ereignis:<id> | profil | release | tageswechsel
  fakten             jsonb not null,
  fakten_hash        bytea not null,
  engine_version     text not null,
  gestartet_am       timestamptz not null default now(),
  dauer_ms           int
);

-- ---------- Pflichtinstanzen (E-035, E-036) ----------
create type app.instanz_status as enum ('offen','erledigt','nicht_zutreffend','entfallen');
create type app.ergebnis       as enum ('gilt','gilt_nicht','unbekannt');

create table app.pflicht_instanz (
  id                    uuid primary key default gen_random_uuid(),
  unternehmen_id        uuid not null references app.unternehmen(id),
  pflicht_id            text not null references katalog.pflicht(id),
  pflicht_version_id    uuid not null references katalog.pflicht_version(id),
  periode               text not null check (periode ~ '^(einmalig|\d{4}(-(0[1-9]|1[0-2]|Q[1-4]|H[12]))?|aenderung-\d+)$'),
  ergebnis              app.ergebnis not null,
  status                app.instanz_status not null default 'offen',
  faellig_am            date,                         -- null bei dauerhaften Pflichten
  faellig_roh           date,                         -- vor Verschiebung, für Transparenz
  begruendung           jsonb not null,               -- Begründungsbaum der Engine
  fehlende_fakten       text[] not null default '{}',
  letzter_lauf_id       uuid not null references app.berechnungslauf(id),
  erledigt_am           timestamptz,
  erledigt_von          uuid references app.konto(id),
  erledigt_mit_version_id uuid references katalog.pflicht_version(id),
  nicht_zutreffend_grund text,
  aktualisiert_am       timestamptz not null default now(),
  unique (unternehmen_id, pflicht_id, periode),
  check ((status = 'erledigt') = (erledigt_am is not null)),
  check (status <> 'erledigt' or erledigt_mit_version_id is not null)
);
create index pflicht_instanz_faellig on app.pflicht_instanz (unternehmen_id, faellig_am) where status = 'offen';

-- Angezeigter Status wird berechnet, nicht gespeichert (E-035). Vorlauf "bald" = 14 Tage (konfigurierbar in der API).
create view app.pflicht_instanz_anzeige with (security_invoker = true) as
  select pi.*,
    case
      when pi.status <> 'offen'                         then pi.status::text
      when pi.ergebnis = 'unbekannt'                    then 'angabe_fehlt'
      when pi.faellig_am is null                        then 'offen'
      when pi.faellig_am <  current_date                then 'ueberfaellig'
      when pi.faellig_am <= current_date + 14           then 'faellig_bald'
      else 'offen'
    end as anzeige_status
  from app.pflicht_instanz pi;

-- ---------- Dokumente ----------
create table app.dokument (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  titel              text not null,
  art                text not null,                   -- nachweis | vorlage_erzeugt | beleg | behoerdenbrief | ...
  quelle             text not null check (quelle in ('upload','generiert','email','geraet')),
  objekt_key         text not null unique,
  mime               text not null,
  groesse_bytes      bigint not null check (groesse_bytes >= 0),
  sha256             bytea not null,
  vorlage_version_id uuid references katalog.vorlage_version(id),
  aufbewahrung_bis   date,                            -- gesetzt => WORM bis zu diesem Datum
  erstellt_von       uuid references app.konto(id),
  erstellt_am        timestamptz not null default now()
);

create table app.nachweis (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  pflicht_instanz_id uuid not null references app.pflicht_instanz(id),
  art                text not null check (art in ('upload','uebermittlungsprotokoll','generiertes_dokument','bestaetigung')),
  dokument_id        uuid references app.dokument(id),
  notiz              text,
  erstellt_von       uuid references app.konto(id),
  erstellt_am        timestamptz not null default now(),
  check (art = 'bestaetigung' or dokument_id is not null)
);

-- ---------- Erinnerungen und Benachrichtigungen ----------
create table app.erinnerung (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  pflicht_instanz_id uuid not null references app.pflicht_instanz(id) on delete cascade,
  konto_id           uuid not null references app.konto(id),
  kanal              text not null check (kanal in ('push','email','sms')),
  geplant_fuer       timestamptz not null,
  gesendet_am        timestamptz,
  status             text not null default 'geplant' check (status in ('geplant','gesendet','fehler','verworfen')),
  unique (pflicht_instanz_id, konto_id, kanal, geplant_fuer)
);
create index erinnerung_faellig on app.erinnerung (geplant_fuer) where status = 'geplant';

create table app.benachrichtigung (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  konto_id        uuid not null references app.konto(id),
  art             text not null,                      -- frist | rechtsaenderung | neue_pflicht | system
  titel           text not null,
  text            text not null,
  link            text,
  gelesen_am      timestamptz,
  erstellt_am     timestamptz not null default now()
);

create table app.benachrichtigung_einstellung (
  unternehmen_id  uuid not null references app.unternehmen(id),
  konto_id        uuid not null references app.konto(id),
  kanal           text not null check (kanal in ('push','email','sms')),
  aktiv           boolean not null default true,
  vorlauf         interval[] not null default array['14 days','3 days']::interval[],
  primary key (unternehmen_id, konto_id, kanal)
);

create table app.kalender_abo (                     -- ICS-Feed mit geheimem Token
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  konto_id        uuid not null references app.konto(id),
  token_hash      bytea not null unique,
  erstellt_am     timestamptz not null default now(),
  widerrufen_am   timestamptz
);

-- =====================================================================
-- RLS für alle Mandantentabellen
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['profil_version','ereignis','berechnungslauf','pflicht_instanz','dokument',
                           'nachweis','erinnerung','benachrichtigung','benachrichtigung_einstellung',
                           'kalender_abo','einladung'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
    execute format($p$create policy mandant on app.%I
                     using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
                     with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))$p$, t);
  end loop;
end $$;

-- Kein FORCE: app.unternehmen_anlegen() legt als Eigentümer an, bevor die Mitgliedschaft existiert.
alter table app.unternehmen enable row level security;
create policy mitglied on app.unternehmen using (app.ist_mitglied(id));

-- Kein FORCE auf mitgliedschaft: app.ist_mitglied() läuft als Eigentümer und muss die Tabelle ohne Policy lesen,
-- sonst entsteht eine Rekursion. amtlos_app ist nicht Eigentümer, für sie greift RLS trotzdem.
alter table app.mitgliedschaft enable row level security;
create policy lesen on app.mitgliedschaft for select
  using (konto_id = app.aktuelles_konto()
         or (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id)));
-- Schreiben nur im aktuellen Unternehmen und nur als Inhaber oder Admin.
-- (Getrennte Policies je Befehl: eine USING-Policy für ALL würde sonst als WITH CHECK
--  das Selbst-Eintragen in fremde Unternehmen erlauben – vom Schema-Test gefunden.)
create policy verwalten_insert on app.mitgliedschaft for insert
  with check (unternehmen_id = app.aktuelles_unternehmen() and app.hat_rolle(unternehmen_id, array['inhaber','admin']::app.rolle[]));
create policy verwalten_update on app.mitgliedschaft for update
  using      (unternehmen_id = app.aktuelles_unternehmen() and app.hat_rolle(unternehmen_id, array['inhaber','admin']::app.rolle[]))
  with check (unternehmen_id = app.aktuelles_unternehmen() and app.hat_rolle(unternehmen_id, array['inhaber','admin']::app.rolle[]));
create policy verwalten_delete on app.mitgliedschaft for delete
  using      (unternehmen_id = app.aktuelles_unternehmen() and app.hat_rolle(unternehmen_id, array['inhaber','admin']::app.rolle[]));

-- Konten: man sieht sich selbst und Mitglieder der Unternehmen, in denen man selbst Mitglied ist.
alter table app.konto enable row level security;
create policy sichtbar on app.konto using (
  id = app.aktuelles_konto()
  or exists (select 1 from app.mitgliedschaft m
             where m.konto_id = konto.id and app.ist_mitglied(m.unternehmen_id)));

create policy studio_liest on app.konto for select to amtlos_studio using (true);

-- Anmeldung: legt das Konto beim ersten Login an (vor gesetztem Kontext), gibt die ID zurück.
create function app.konto_anmelden(p_sub text, p_email citext, p_name text) returns uuid
  language sql volatile security definer set search_path = app, pg_temp as $$
  insert into app.konto (idp_subject, email, anzeigename) values (p_sub, p_email, p_name)
  on conflict (idp_subject) do update set email = excluded.email, anzeigename = excluded.anzeigename
  returning id
$$;

-- Neues Unternehmen anlegen: der Anlegende wird Inhaber (vorher ist er nicht Mitglied, daher SECURITY DEFINER).
create function app.unternehmen_anlegen(p_name text) returns uuid
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare neu uuid;
begin
  if app.aktuelles_konto() is null then raise exception 'Kein Konto im Kontext'; end if;
  insert into app.unternehmen (name) values (p_name) returning id into neu;
  insert into app.mitgliedschaft (unternehmen_id, konto_id, rolle) values (neu, app.aktuelles_konto(), 'inhaber');
  return neu;
end $$;

-- =====================================================================
-- AUDIT (Hash-Kette)
-- =====================================================================
create table audit.ereignis (
  id              bigint generated always as identity primary key,
  zeitpunkt       timestamptz not null default clock_timestamp(),
  konto_id        uuid,
  unternehmen_id  uuid,
  aktion          text not null,                      -- insert | update | delete | freigabe | login ...
  objekt          text not null,                      -- schema.tabelle
  objekt_id       text,
  aenderung       jsonb,                              -- nur geänderte Felder; sensible Felder maskiert
  vorgaenger_hash bytea,
  hash            bytea not null
);

create function audit.protokollieren() returns trigger language plpgsql security definer set search_path = audit, app, pg_temp as $$
declare
  alt jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  neu jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  diff jsonb;
  vorher bytea;
  zeile jsonb := coalesce(neu, alt);
begin
  diff := case tg_op
    when 'UPDATE' then (select jsonb_object_agg(k, jsonb_build_array(alt->k, neu->k))
                        from jsonb_object_keys(neu) k where alt->k is distinct from neu->k)
    else coalesce(neu, alt) end;
  perform pg_advisory_xact_lock(hashtext('audit.kette'));
  select hash into vorher from audit.ereignis order by id desc limit 1;
  insert into audit.ereignis (konto_id, unternehmen_id, aktion, objekt, objekt_id, aenderung, vorgaenger_hash, hash)
  values (app.aktuelles_konto(), nullif(zeile->>'unternehmen_id','')::uuid, lower(tg_op),
          tg_table_schema || '.' || tg_table_name, zeile->>'id', diff, vorher,
          public.digest(coalesce(vorher, '\x'::bytea) || convert_to(coalesce(diff::text,'') || tg_op || tg_table_name || coalesce(zeile->>'id',''), 'UTF8'), 'sha256'));
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['app.unternehmen','app.mitgliedschaft','app.profil_version','app.ereignis',
                           'app.pflicht_instanz','app.dokument','app.nachweis',
                           'katalog.pflicht_version','katalog.regelwert_version','katalog.vorlage_version',
                           'katalog.freigabe','katalog.release','katalog.release_inhalt'] loop
    execute format('create trigger audit after insert or update or delete on %s for each row execute function audit.protokollieren()', t);
  end loop;
end $$;

create trigger audit_unveraenderlich before update or delete on audit.ereignis
  for each row execute function app.nur_anhaengen();

-- =====================================================================
-- RECHTE
-- =====================================================================
grant usage on schema app, katalog to amtlos_app;
grant select, insert, update on all tables in schema app to amtlos_app;
grant delete on app.erinnerung, app.einladung, app.mitgliedschaft, app.benachrichtigung_einstellung to amtlos_app;
grant select on all tables in schema katalog to amtlos_app;
revoke insert, update on app.konto, app.konto_plattform_rolle from amtlos_app;
grant execute on function app.konto_anmelden(text, citext, text) to amtlos_app;
grant execute on function app.unternehmen_anlegen(text) to amtlos_app;
grant select on app.konto_plattform_rolle to amtlos_app;

grant usage on schema katalog, app to amtlos_studio;
grant select, insert, update on all tables in schema katalog to amtlos_studio;
grant select on app.konto, app.konto_plattform_rolle to amtlos_studio;   -- nur Konten, keine Mandantendaten
