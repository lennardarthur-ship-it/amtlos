-- =====================================================================
-- 0015 · Bauabschnitt 10: Englische Katalogtexte als Übersetzungsschicht (E-107)
--
-- Versionen bleiben unveränderlich. Übersetzungen hängen am deutschen Text (nicht an der Version):
-- ändert sich der deutsche Text, fehlt die Übersetzung und es erscheint Deutsch. Verbindlich ist immer Deutsch.
-- Für jede Version wird ein lokalisiertes Dokument vorberechnet (beim Import der Übersetzungen und beim
-- Anlegen neuer Versionen), damit Lesezugriffe nur einen Join brauchen.
-- =====================================================================

create table katalog.uebersetzung (
  sprache       text not null check (sprache in ('en')),
  de            text not null,
  de_hash       bytea generated always as (decode(md5(de), 'hex')) stored,
  text          text not null check (length(text) > 0),
  status        text not null default 'maschinell' check (status in ('maschinell', 'geprueft')),
  geprueft_von  uuid references app.konto(id),
  geprueft_am   date,
  geaendert_am  timestamptz not null default now(),
  primary key (sprache, de_hash)
);
create trigger audit after insert or update or delete on katalog.uebersetzung for each row execute function audit.protokollieren();

-- Ersetzt jedes Textobjekt {"de": …} durch {"de": …, "en": …}, wenn es eine Übersetzung gibt. Vorhandenes "en" bleibt.
create function katalog.lokalisiere(d jsonb) returns jsonb
  language plpgsql stable set search_path = katalog, pg_temp as $$
declare e text; erg jsonb;
begin
  if d is null then return null; end if;
  case jsonb_typeof(d)
  when 'object' then
    if jsonb_typeof(d->'de') = 'string' and not exists (select 1 from jsonb_object_keys(d) x where x not in ('de', 'en')) then
      if d ? 'en' then return d; end if;
      select u.text into e from katalog.uebersetzung u where u.sprache = 'en' and u.de_hash = decode(md5(d->>'de'), 'hex');
      return case when e is null then d else d || jsonb_build_object('en', e) end;
    end if;
    select coalesce(jsonb_object_agg(key, katalog.lokalisiere(value)), '{}'::jsonb) into erg from jsonb_each(d);
    return erg;
  when 'array' then
    select coalesce(jsonb_agg(katalog.lokalisiere(value) order by nr), '[]'::jsonb) into erg from jsonb_array_elements(d) with ordinality a(value, nr);
    return erg;
  else
    return d;
  end case;
end $$;

create table katalog.pflicht_version_lokal (
  pflicht_version_id uuid primary key references katalog.pflicht_version(id) on delete cascade,
  daten              jsonb not null
);
create table katalog.regelwert_version_lokal (
  regelwert_version_id uuid primary key references katalog.regelwert_version(id) on delete cascade,
  daten                jsonb not null
);

-- Alle lokalisierten Dokumente neu berechnen (nach dem Import von Übersetzungen); läuft als Eigentümer.
create function katalog.lokal_auffrischen() returns int
  language plpgsql volatile security definer set search_path = katalog, pg_temp as $$
declare n int;
begin
  insert into katalog.pflicht_version_lokal (pflicht_version_id, daten)
    select id, katalog.lokalisiere(daten) from katalog.pflicht_version
  on conflict (pflicht_version_id) do update set daten = excluded.daten;
  get diagnostics n = row_count;
  insert into katalog.regelwert_version_lokal (regelwert_version_id, daten)
    select id, katalog.lokalisiere(daten) from katalog.regelwert_version
  on conflict (regelwert_version_id) do update set daten = excluded.daten;
  return n;
end $$;
revoke all on function katalog.lokal_auffrischen() from public;
grant execute on function katalog.lokal_auffrischen() to amtlos_studio;

-- Neue Versionen (Studio oder Import) bekommen sofort ihr lokalisiertes Dokument
create function katalog.lokal_neu() returns trigger
  language plpgsql security definer set search_path = katalog, pg_temp as $$
begin
  if tg_table_name = 'pflicht_version' then
    insert into katalog.pflicht_version_lokal values (new.id, katalog.lokalisiere(new.daten)) on conflict do nothing;
  else
    insert into katalog.regelwert_version_lokal values (new.id, katalog.lokalisiere(new.daten)) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger lokal_neu after insert on katalog.pflicht_version for each row execute function katalog.lokal_neu();
create trigger lokal_neu after insert on katalog.regelwert_version for each row execute function katalog.lokal_neu();

-- Anzeige-Sichten: wie die Versionstabellen, aber mit lokalisiertem Dokument (sonst das Original)
create view katalog.pflicht_version_anzeige as
  select pv.id, pv.pflicht_id, pv.version, coalesce(l.daten, pv.daten) as daten, pv.schema_version, pv.status_recht,
         pv.gueltig_ab, pv.gueltig_bis, pv.pruef_status, pv.erstellt_von, pv.erstellt_am
    from katalog.pflicht_version pv left join katalog.pflicht_version_lokal l on l.pflicht_version_id = pv.id;
create view katalog.regelwert_version_anzeige as
  select rv.*, coalesce(l.daten, rv.daten) as daten_lokal
    from katalog.regelwert_version rv left join katalog.regelwert_version_lokal l on l.regelwert_version_id = rv.id;

grant select on katalog.uebersetzung, katalog.pflicht_version_lokal, katalog.regelwert_version_lokal, katalog.pflicht_version_anzeige, katalog.regelwert_version_anzeige to amtlos_app, amtlos_worker, amtlos_studio;
grant insert, update on katalog.uebersetzung to amtlos_studio;

-- Bestehende Versionen einmal lokalisieren (noch ohne Übersetzungen: Kopie des Originals)
select katalog.lokal_auffrischen();

-- Sprache des eigenen Kontos (für E-Mails und Benachrichtigungen); die Oberfläche schickt ihre Sprache je Anfrage mit.
create function app.konto_sprache_setzen(p_sprache text) returns void
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
begin
  if app.aktuelles_konto() is null then raise exception 'Kein Konto im Kontext'; end if;
  if p_sprache not in ('de', 'en') then raise exception 'Sprache unbekannt' using errcode = '22023'; end if;
  update app.konto set sprache = p_sprache where id = app.aktuelles_konto();
end $$;
revoke all on function app.konto_sprache_setzen(text) from public;
grant execute on function app.konto_sprache_setzen(text) to amtlos_app;
