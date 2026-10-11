-- =====================================================================
-- 0002 · Worker-Rolle, Systemkonto, Katalog-Import (E-060)
--
-- Der Worker arbeitet jeden Job im Kontext genau eines Unternehmens (amtlos.unternehmen_id),
-- braucht dafür aber keine Mitgliedschaft. Er sieht nur, was für Neuberechnung und Erinnerungen
-- nötig ist, und kann ohne Unternehmenskontext keine Mandantendaten lesen.
-- =====================================================================

do $$ begin
  if not exists (select from pg_roles where rolname = 'amtlos_worker') then create role amtlos_worker nologin; end if;
end $$;

grant usage on schema app, katalog to amtlos_worker;
grant select on all tables in schema katalog to amtlos_worker;
grant select on app.unternehmen, app.mitgliedschaft, app.konto, app.profil_version, app.ereignis,
                app.benachrichtigung_einstellung to amtlos_worker;
grant select, insert, update on app.berechnungslauf, app.pflicht_instanz, app.erinnerung, app.benachrichtigung to amtlos_worker;
grant delete on app.erinnerung to amtlos_worker;

do $$
declare t text;
begin
  foreach t in array array['profil_version','ereignis','berechnungslauf','pflicht_instanz','erinnerung',
                           'benachrichtigung','benachrichtigung_einstellung','mitgliedschaft'] loop
    execute format($p$create policy worker on app.%I to amtlos_worker
                     using (unternehmen_id = app.aktuelles_unternehmen())
                     with check (unternehmen_id = app.aktuelles_unternehmen())$p$, t);
  end loop;
end $$;
create policy worker on app.unternehmen to amtlos_worker using (id = app.aktuelles_unternehmen());
create policy worker on app.konto for select to amtlos_worker using (
  exists (select 1 from app.mitgliedschaft m where m.konto_id = konto.id and m.unternehmen_id = app.aktuelles_unternehmen()));

-- Für Jobs über alle Unternehmen (Tageswechsel, Release-Rollout): nur IDs, keine Inhalte.
create function app.aktive_unternehmen_ids() returns setof uuid
  language sql stable security definer set search_path = app, pg_temp as $$
  select id from app.unternehmen where geloescht_am is null order by id
$$;
revoke all on function app.aktive_unternehmen_ids() from public;
grant execute on function app.aktive_unternehmen_ids() to amtlos_worker;

-- Unternehmen, die von einem Release betroffen sein können, sind alle aktiven; die Engine entscheidet.

-- ---------------------------------------------------------------------
-- Systemkonto für automatisch erzeugte Katalog-Inhalte (Import aus catalog/)
-- ---------------------------------------------------------------------
insert into app.konto (id, idp_subject, email, anzeigename)
values ('00000000-0000-0000-0000-000000000001', 'system:katalog-import', 'katalog-import@amtlos.invalid', 'Katalog-Import (System)')
on conflict (idp_subject) do nothing;

-- Pflichtinstanzen, deren Pflicht im aktuellen Release nicht mehr gilt, werden auf 'entfallen' gesetzt,
-- nicht gelöscht (Nachvollziehbarkeit). Dafür braucht der Worker keine Lösch-Rechte.

-- Fällige Erinnerungen über alle Unternehmen finden (nur IDs; Versand dann im Kontext des Unternehmens).
-- Die Funktion läuft als Eigentümer; wegen FORCE ROW LEVEL SECURITY braucht der Eigentümer dafür eine
-- eigene, nur lesende Policy. Der Eigentümer wird von keinem Dienst zur Laufzeit benutzt.
create policy systemfunktion on app.erinnerung for select to amtlos_owner using (true);
create function app.faellige_erinnerungen(grenze int default 500)
  returns table (erinnerung_id uuid, unternehmen_id uuid)
  language sql stable security definer set search_path = app, pg_temp as $$
  select id, unternehmen_id from app.erinnerung
   where status = 'geplant' and geplant_fuer <= now()
   order by geplant_fuer limit grenze
$$;
revoke all on function app.faellige_erinnerungen(int) from public;
grant execute on function app.faellige_erinnerungen(int) to amtlos_worker;

-- Kalender-Abo (ICS): Kalender-Apps senden kein Login, nur das geheime Token in der URL.
-- Die Funktion löst das Token (als SHA-256) auf Konto und Unternehmen auf; der Abruf läuft danach
-- normal im Kontext dieses Kontos (RLS greift). Widerrufene Tokens liefern nichts.
create policy systemfunktion on app.kalender_abo for select to amtlos_owner using (true);
create function app.kalender_abo_aufloesen(p_token_hash bytea)
  returns table (konto_id uuid, unternehmen_id uuid)
  language sql stable security definer set search_path = app, pg_temp as $$
  select a.konto_id, a.unternehmen_id from app.kalender_abo a
   where a.token_hash = p_token_hash and a.widerrufen_am is null
     and exists (select 1 from app.mitgliedschaft m where m.konto_id = a.konto_id and m.unternehmen_id = a.unternehmen_id)
$$;
revoke all on function app.kalender_abo_aufloesen(bytea) from public;
grant execute on function app.kalender_abo_aufloesen(bytea) to amtlos_app;
