-- =====================================================================
-- 0014 · Bauabschnitt 10: Kanzleien (Mandanten anlegen) und White-Label-Marken
-- =====================================================================

-- ---------- Marken (White-Label, E-105) ----------
-- Pflege im Studio. Farben werden beim Speichern auf Kontrast geprüft (WCAG 2.2 AA, im Studio-Kern).
-- Kein Logo-Upload und kein freies HTML/CSS: nur Name, zwei geprüfte Farben, Logo als https-Bild-URL.
create table katalog.marke (
  id              uuid primary key default gen_random_uuid(),
  schluessel      text not null unique check (schluessel ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name            text not null check (length(name) between 2 and 80),
  hosts           text[] not null default '{}',     -- Hostnamen in Kleinschreibung, z. B. pflichten.kanzlei-beispiel.de
  farbe_hell      text not null check (farbe_hell ~ '^#[0-9a-f]{6}$'),
  farbe_dunkel    text not null check (farbe_dunkel ~ '^#[0-9a-f]{6}$'),
  logo_url        text check (logo_url is null or logo_url ~ '^https://'),
  support_email   citext,
  aktiv           boolean not null default true,
  erstellt_am     timestamptz not null default now()
);
-- Ein Host gehört höchstens einer aktiven Marke
create function katalog.marke_hosts_eindeutig() returns trigger language plpgsql as $$
begin
  if new.aktiv and exists (select 1 from katalog.marke m where m.id <> new.id and m.aktiv and m.hosts && new.hosts) then
    raise exception 'Host ist schon einer anderen Marke zugeordnet' using errcode = '23505';
  end if;
  if exists (select 1 from unnest(new.hosts) h where h !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') then
    raise exception 'Hostname ungültig' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger hosts_eindeutig before insert or update on katalog.marke for each row execute function katalog.marke_hosts_eindeutig();
create trigger audit after insert or update or delete on katalog.marke for each row execute function audit.protokollieren();
grant select on katalog.marke to amtlos_app, amtlos_worker;
grant select, insert, update on katalog.marke to amtlos_studio;

-- Unternehmen merken sich, unter welcher Marke sie angelegt wurden (Lizenzbericht je Partner)
alter table app.unternehmen add column marke_id uuid references katalog.marke(id);
create index unternehmen_marke on app.unternehmen (marke_id) where marke_id is not null;

-- Anlegen mit Marke: ersetzt die bisherige Funktion (gleiche Rechte), Marke nur, wenn aktiv
create function app.unternehmen_anlegen(p_name text, p_marke uuid) returns uuid
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare neu uuid;
begin
  if app.aktuelles_konto() is null then raise exception 'Kein Konto im Kontext'; end if;
  if p_marke is not null and not exists (select 1 from katalog.marke where id = p_marke and aktiv) then
    raise exception 'Marke unbekannt' using errcode = '23503';
  end if;
  insert into app.unternehmen (name, marke_id) values (p_name, p_marke) returning id into neu;
  insert into app.mitgliedschaft (unternehmen_id, konto_id, rolle) values (neu, app.aktuelles_konto(), 'inhaber');
  return neu;
end $$;
revoke all on function app.unternehmen_anlegen(text, uuid) from public;
grant execute on function app.unternehmen_anlegen(text, uuid) to amtlos_app;

-- ---------- Kanzlei legt Mandanten an (E-106) ----------
-- Die Kanzlei wird Mitglied mit Rolle „steuerberater“; der Mandant erhält eine Einladung als Inhaber.
-- Inhaber-Einladungen gibt es nur auf diesem Weg (normale Einladungen bleiben ohne Inhaber-Rolle).
alter table app.einladung drop constraint einladung_nicht_inhaber;
alter table app.einladung add column mandant_anlage boolean not null default false,
  add constraint einladung_nicht_inhaber check (rolle <> 'inhaber' or mandant_anlage);

create function app.mandant_anlegen(p_name text, p_marke uuid, p_email text, p_token_hash bytea, p_tage int, p_sprache text)
  returns table (unternehmen_id uuid, einladung_id uuid, laeuft_ab timestamptz)
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare neu uuid; e uuid; ab timestamptz;
begin
  if app.aktuelles_konto() is null then raise exception 'Kein Konto im Kontext'; end if;
  if p_marke is not null and not exists (select 1 from katalog.marke where id = p_marke and aktiv) then
    raise exception 'Marke unbekannt' using errcode = '23503';
  end if;
  insert into app.unternehmen (name, marke_id) values (p_name, p_marke) returning id into neu;
  insert into app.mitgliedschaft (unternehmen_id, konto_id, rolle) values (neu, app.aktuelles_konto(), 'steuerberater');
  insert into app.einladung (unternehmen_id, email, rolle, token_hash, laeuft_ab, erstellt_von, sprache, mandant_anlage)
    values (neu, p_email, 'inhaber', p_token_hash, now() + make_interval(days => p_tage), app.aktuelles_konto(), p_sprache, true)
    returning id, einladung.laeuft_ab into e, ab;
  return query select neu, e, ab;
end $$;
revoke all on function app.mandant_anlegen(text, uuid, text, bytea, int, text) from public;
grant execute on function app.mandant_anlegen(text, uuid, text, bytea, int, text) to amtlos_app;

-- Lizenzbericht fürs Studio: nur Anzahl Unternehmen je Marke, keine Mandantendaten
create function katalog.marken_nutzung() returns table (marke_id uuid, unternehmen bigint)
  language sql stable security definer set search_path = app, pg_temp as $$
  select marke_id, count(*) from app.unternehmen where marke_id is not null and geloescht_am is null group by marke_id
$$;
revoke all on function katalog.marken_nutzung() from public;
grant execute on function katalog.marken_nutzung() to amtlos_studio;
