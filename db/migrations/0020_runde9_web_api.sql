-- =====================================================================
-- 0020 · Runde 9 (Web/API-Durchsicht): Löschen widerruft Zugänge, ein Storno je Ereignis, Erinnerungen mit
-- Wiederholung, Kunden nur aus dem eigenen Unternehmen, Kanzlei-Übersicht in einer Abfrage, Grenzen für Mandanten.
-- =====================================================================

-- ---------- H5: gelöschte Unternehmen liefern keinen Kalender und nehmen keine Einladungen mehr an ----------
-- Systemfunktionen laufen als Eigentümer; wegen FORCE RLS braucht er Policies zum Widerrufen und endgültigen Löschen.
create policy systemfunktion_schreiben on app.kalender_abo for update to amtlos_owner using (true) with check (true);
create policy systemfunktion_loeschen on app.kalender_abo for delete to amtlos_owner using (true);

create or replace function app.kalender_abo_aufloesen(p_token_hash bytea)
  returns table (konto_id uuid, unternehmen_id uuid)
  language sql stable security definer set search_path = app, pg_temp as $$
  select a.konto_id, a.unternehmen_id from app.kalender_abo a
    join app.unternehmen u on u.id = a.unternehmen_id and u.geloescht_am is null
   where a.token_hash = p_token_hash and a.widerrufen_am is null
     and exists (select 1 from app.mitgliedschaft m where m.konto_id = a.konto_id and m.unternehmen_id = a.unternehmen_id)
$$;

create or replace function app.einladung_annehmen(p_token_hash bytea) returns uuid
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare
  e app.einladung;
  ich uuid := app.aktuelles_konto();
  meine_email public.citext;
begin
  if ich is null then raise exception 'Kein Konto im Kontext'; end if;
  select * into e from app.einladung where token_hash = p_token_hash for update;
  if not found or e.angenommen_am is not null or e.widerrufen_am is not null or e.laeuft_ab <= now()
     or not exists (select 1 from app.unternehmen u where u.id = e.unternehmen_id and u.geloescht_am is null) then
    raise exception 'einladung_ungueltig' using errcode = 'P0002';
  end if;
  select email into meine_email from app.konto where id = ich;
  if lower(meine_email::text) is distinct from lower(e.email::text) then
    raise exception 'einladung_andere_email' using errcode = 'P0003';
  end if;
  insert into app.mitgliedschaft (unternehmen_id, konto_id, rolle) values (e.unternehmen_id, ich, e.rolle)
    on conflict (unternehmen_id, konto_id) do nothing;
  update app.einladung set angenommen_am = now(), angenommen_von = ich where id = e.id;
  return e.unternehmen_id;
end $$;

create or replace function app.unternehmen_loeschen(p_unternehmen uuid) returns void
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
begin
  if not app.hat_rolle(p_unternehmen, array['inhaber']::app.rolle[]) then raise exception 'Nur Inhaber löschen das Unternehmen' using errcode = '42501'; end if;
  update app.unternehmen set geloescht_am = now() where id = p_unternehmen and geloescht_am is null;
  delete from app.erinnerung where unternehmen_id = p_unternehmen and status = 'geplant';
  update app.abo set status = 'abgelaufen', aktualisiert_am = now() where unternehmen_id = p_unternehmen;
  -- Zugänge ohne Login sofort beenden: Kalender-Feeds und offene Einladungen
  update app.kalender_abo set widerrufen_am = now() where unternehmen_id = p_unternehmen and widerrufen_am is null;
  update app.einladung set widerrufen_am = now() where unternehmen_id = p_unternehmen and angenommen_am is null and widerrufen_am is null;
end $$;

-- Bereits gelöschte Unternehmen nachziehen
update app.kalender_abo a set widerrufen_am = u.geloescht_am
  from app.unternehmen u where u.id = a.unternehmen_id and u.geloescht_am is not null and a.widerrufen_am is null;
update app.einladung e set widerrufen_am = u.geloescht_am
  from app.unternehmen u where u.id = e.unternehmen_id and u.geloescht_am is not null and e.angenommen_am is null and e.widerrufen_am is null;

-- ---------- M3: höchstens ein Storno je Ereignis ----------
-- Doppelte Stornos aus parallelen Anfragen entfernen (fachlich wirkungslos: ein Ereignis ist storniert oder nicht);
-- app.ereignis ist sonst nur anhängbar, deshalb Trigger und FORCE RLS nur für diese Bereinigung aussetzen.
alter table app.ereignis disable trigger ereignis_unveraenderlich;
alter table app.ereignis no force row level security;
delete from app.ereignis e
 where e.storniert_ereignis_id is not null
   and exists (select 1 from app.ereignis f
                where f.storniert_ereignis_id = e.storniert_ereignis_id
                  and (f.erfasst_am, f.id) < (e.erfasst_am, e.id));
alter table app.ereignis force row level security;
alter table app.ereignis enable trigger ereignis_unveraenderlich;
create unique index ereignis_ein_storno on app.ereignis (storniert_ereignis_id) where storniert_ereignis_id is not null;

-- ---------- M10: Erinnerungen erst vormerken, dann senden; Wiederholung mit Abstand ----------
alter table app.erinnerung drop constraint erinnerung_status_check;
alter table app.erinnerung add constraint erinnerung_status_check check (status in ('geplant','in_versand','gesendet','fehler','verworfen'));
alter table app.erinnerung
  add column versuche            int not null default 0 check (versuche >= 0),
  add column naechster_versuch   timestamptz,
  add column versand_begonnen_am timestamptz;
create index erinnerung_im_versand on app.erinnerung (versand_begonnen_am) where status = 'in_versand';

-- Fällig: geplant und Zeitpunkt (bzw. nächster Versuch) erreicht – oder seit einer Stunde „im Versand“ hängengeblieben
-- (Worker während des Sendens abgebrochen): dann noch einmal versuchen.
create or replace function app.faellige_erinnerungen(grenze int default 500)
  returns table (erinnerung_id uuid, unternehmen_id uuid)
  language sql stable security definer set search_path = app, pg_temp as $$
  select id, unternehmen_id from app.erinnerung
   where (status = 'geplant' and geplant_fuer <= now() and (naechster_versuch is null or naechster_versuch <= now()))
      or (status = 'in_versand' and versand_begonnen_am < now() - interval '1 hour')
   order by geplant_fuer limit grenze
$$;

-- ---------- G2: Rechnungen verweisen nur auf Kunden desselben Unternehmens ----------
alter table app.kunde add constraint kunde_unternehmen_id_eindeutig unique (unternehmen_id, id);
alter table app.rechnung add constraint rechnung_kunde_desselben_unternehmens
  foreign key (unternehmen_id, kunde_id) references app.kunde (unternehmen_id, id) not valid;
do $$ begin
  alter table app.rechnung validate constraint rechnung_kunde_desselben_unternehmens;
exception when foreign_key_violation then
  -- Altbestand mit fremder Kunden-ID: die Prüfung gilt für alles Neue; der Altbestand bleibt sichtbar im Betrieb zu klären
  raise warning 'rechnung_kunde_desselben_unternehmens: Altbestand verweist auf fremde Kunden (Constraint bleibt NOT VALID)';
end $$;

-- ---------- M6/M9: Kanzlei-Übersicht ohne Abfrage je Unternehmen ----------
-- Lesende Systemfunktionen über mehrere Unternehmen; sie liefern nur Unternehmen, in denen die Person Mitglied ist.
create policy systemfunktion on app.pflicht_instanz for select to amtlos_owner using (true);
create policy systemfunktion on app.profil_version for select to amtlos_owner using (true);

create function app.mandanten_stand()
  returns table (id uuid, name text, rolle app.rolle, marke text, profil_vorhanden boolean, hat_inhaber boolean,
                 einladung_email public.citext, einladung_laeuft_ab timestamptz, einladung_status text)
  language sql stable security definer set search_path = app, katalog, pg_temp as $$
  select u.id, u.name, m.rolle, mk.name,
         exists (select 1 from app.profil_version p where p.unternehmen_id = u.id),
         exists (select 1 from app.mitgliedschaft i where i.unternehmen_id = u.id and i.rolle = 'inhaber'),
         e.email, e.laeuft_ab,
         case when e.id is null then null
              when e.angenommen_am is not null then 'angenommen'
              when e.widerrufen_am is not null then 'widerrufen'
              when e.laeuft_ab <= now() then 'abgelaufen'
              else 'offen' end
    from app.mitgliedschaft m
    join app.unternehmen u on u.id = m.unternehmen_id and u.geloescht_am is null
    left join katalog.marke mk on mk.id = u.marke_id
    -- Einladungsstand nur für die Kanzlei (die Adresse hat sie selbst eingegeben)
    left join lateral (select x.* from app.einladung x
                        where x.unternehmen_id = u.id and x.mandant_anlage and m.rolle = 'steuerberater'
                        order by x.erstellt_am desc limit 1) e on true
   where m.konto_id = app.aktuelles_konto()
   order by u.name
$$;
revoke all on function app.mandanten_stand() from public;
grant execute on function app.mandanten_stand() to amtlos_app;

create function app.mandanten_aufgaben(p_ids uuid[])
  returns table (unternehmen_id uuid, pflicht_id text, periode text, kategorie text, anzeige_status text, faellig_am text, schwere text, titel jsonb)
  language sql stable security definer set search_path = app, katalog, pg_temp as $$
  select pi.unternehmen_id, pi.pflicht_id, pi.periode, pv.daten->>'kategorie', pi.anzeige_status, pi.faellig_am::text,
         pv.daten->'sanktion'->>'schwere', pv.daten->'titel'
    from app.pflicht_instanz_anzeige pi
    join katalog.pflicht_version_anzeige pv on pv.id = pi.pflicht_version_id
    join app.unternehmen u on u.id = pi.unternehmen_id and u.geloescht_am is null
   where pi.unternehmen_id = any(p_ids) and pi.status <> 'entfallen'
     and exists (select 1 from app.mitgliedschaft m where m.unternehmen_id = pi.unternehmen_id and m.konto_id = app.aktuelles_konto())
$$;
revoke all on function app.mandanten_aufgaben(uuid[]) from public;
grant execute on function app.mandanten_aufgaben(uuid[]) to amtlos_app;

-- ---------- M12: Grenze für Mandanten je Konto und Tag ----------
drop function app.mandant_anlegen(text, uuid, text, bytea, int, text);
create function app.mandant_anlegen(p_name text, p_marke uuid, p_email text, p_token_hash bytea, p_tage int, p_sprache text, p_grenze int)
  returns table (unternehmen_id uuid, einladung_id uuid, laeuft_ab timestamptz)
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare neu uuid; e uuid; ab timestamptz; ich uuid := app.aktuelles_konto();
begin
  if ich is null then raise exception 'Kein Konto im Kontext'; end if;
  if (select count(*) from app.einladung x where x.erstellt_von = ich and x.mandant_anlage and x.erstellt_am > now() - interval '1 day') >= p_grenze then
    raise exception 'mandanten_grenze' using errcode = 'P0006';
  end if;
  if p_marke is not null and not exists (select 1 from katalog.marke where id = p_marke and aktiv) then
    raise exception 'Marke unbekannt' using errcode = '23503';
  end if;
  insert into app.unternehmen (name, marke_id) values (p_name, p_marke) returning id into neu;
  insert into app.mitgliedschaft (unternehmen_id, konto_id, rolle) values (neu, ich, 'steuerberater');
  insert into app.einladung (unternehmen_id, email, rolle, token_hash, laeuft_ab, erstellt_von, sprache, mandant_anlage)
    values (neu, p_email, 'inhaber', p_token_hash, now() + make_interval(days => p_tage), ich, p_sprache, true)
    returning id, einladung.laeuft_ab into e, ab;
  return query select neu, e, ab;
end $$;
revoke all on function app.mandant_anlegen(text, uuid, text, bytea, int, text, int) from public;
grant execute on function app.mandant_anlegen(text, uuid, text, bytea, int, text, int) to amtlos_app;

-- ---------- M6: Kanzlei erneuert die Inhaber-Einladung, solange es keinen Inhaber gibt ----------
create function app.mandant_einladung_erneuern(p_unternehmen uuid, p_email text, p_token_hash bytea, p_tage int, p_sprache text, p_grenze int)
  returns table (einladung_id uuid, email public.citext, laeuft_ab timestamptz)
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare ich uuid := app.aktuelles_konto(); adresse public.citext; e uuid; ab timestamptz;
begin
  if ich is null then raise exception 'Kein Konto im Kontext'; end if;
  if not app.hat_rolle(p_unternehmen, array['steuerberater']::app.rolle[])
     or not exists (select 1 from app.unternehmen u where u.id = p_unternehmen and u.geloescht_am is null) then
    raise exception 'nicht_gefunden' using errcode = 'P0002';
  end if;
  if exists (select 1 from app.mitgliedschaft m where m.unternehmen_id = p_unternehmen and m.rolle = 'inhaber') then
    raise exception 'hat_inhaber' using errcode = 'P0007';
  end if;
  if (select count(*) from app.einladung x where x.erstellt_von = ich and x.mandant_anlage and x.erstellt_am > now() - interval '1 day') >= p_grenze then
    raise exception 'mandanten_grenze' using errcode = 'P0006';
  end if;
  adresse := coalesce(p_email::public.citext,
    (select x.email from app.einladung x where x.unternehmen_id = p_unternehmen and x.mandant_anlage order by x.erstellt_am desc limit 1));
  if adresse is null then raise exception 'keine_adresse' using errcode = 'P0002'; end if;
  update app.einladung set widerrufen_am = now()
   where unternehmen_id = p_unternehmen and mandant_anlage and angenommen_am is null and widerrufen_am is null;
  insert into app.einladung (unternehmen_id, email, rolle, token_hash, laeuft_ab, erstellt_von, sprache, mandant_anlage)
    values (p_unternehmen, adresse, 'inhaber', p_token_hash, now() + make_interval(days => p_tage), ich, p_sprache, true)
    returning id, einladung.laeuft_ab into e, ab;
  return query select e, adresse, ab;
end $$;
revoke all on function app.mandant_einladung_erneuern(uuid, text, bytea, int, text, int) from public;
grant execute on function app.mandant_einladung_erneuern(uuid, text, bytea, int, text, int) to amtlos_app;

-- ---------- G-7 (Sicherheit): kein Tresor für gelöschte Konten ----------
drop policy eigenes_konto on app.tresor;
create policy eigenes_konto on app.tresor to amtlos_app
  using (konto_id = app.aktuelles_konto())
  with check (konto_id = app.aktuelles_konto() and exists (select 1 from app.konto k where k.id = konto_id and k.geloescht_am is null));
drop policy eigenes_konto on app.tresor_datei;
create policy eigenes_konto on app.tresor_datei to amtlos_app
  using (konto_id = app.aktuelles_konto())
  with check (konto_id = app.aktuelles_konto() and exists (select 1 from app.konto k where k.id = konto_id and k.geloescht_am is null));

-- ---------- H2: fehlgeschlagene Neuberechnungen sichtbar machen ----------
-- Der Worker vermerkt jeden Fehlversuch (ohne Inhalte, nur ein kurzer Grund); „Heute“ zeigt dann einen Fehlerzustand
-- statt endlos „Einen Moment …“.
create table app.berechnung_fehler (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  profil_version  int,
  versuch         int not null default 0,
  endgueltig      boolean not null default false,
  grund           text not null check (length(grund) <= 300),
  erstellt_am     timestamptz not null default now()
);
create index berechnung_fehler_unternehmen on app.berechnung_fehler (unternehmen_id, erstellt_am desc);
alter table app.berechnung_fehler enable row level security;
alter table app.berechnung_fehler force row level security;
create policy mandant on app.berechnung_fehler
  using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
  with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id));
create policy worker on app.berechnung_fehler to amtlos_worker
  using (unternehmen_id = app.aktuelles_unternehmen()) with check (unternehmen_id = app.aktuelles_unternehmen());
create policy systemfunktion on app.berechnung_fehler for delete to amtlos_owner using (true);
grant select on app.berechnung_fehler to amtlos_app;
grant select, insert on app.berechnung_fehler to amtlos_worker;
