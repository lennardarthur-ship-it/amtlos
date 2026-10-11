-- =====================================================================
-- 0005 · Team: selbst austreten, Sprache der Einladungs-E-Mail
-- =====================================================================

-- Austreten: jedes Mitglied darf die eigene Mitgliedschaft im aktuellen Unternehmen beenden.
-- (Die Lösch-Policy erlaubt sonst nur Inhabern/Admins das Löschen.) Der letzte Inhaber bleibt (Trigger aus 0004).
create function app.team_verlassen() returns void
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
begin
  if app.aktuelles_konto() is null or app.aktuelles_unternehmen() is null then raise exception 'Kein Kontext'; end if;
  delete from app.mitgliedschaft where unternehmen_id = app.aktuelles_unternehmen() and konto_id = app.aktuelles_konto();
  if not found then raise exception 'kein_mitglied' using errcode = 'P0002'; end if;
end $$;
revoke all on function app.team_verlassen() from public;
grant execute on function app.team_verlassen() to amtlos_app;

-- Einladungs-E-Mail in der Sprache des Einladenden (die Sprache der eingeladenen Person kennen wir nicht).
alter table app.einladung add column sprache text not null default 'de' check (sprache in ('de', 'en'));

drop function app.einladung_fuer_versand(uuid);
create function app.einladung_fuer_versand(p_id uuid)
  returns table (email public.citext, rolle app.rolle, unternehmen text, eingeladen_von text, laeuft_ab timestamptz, sprache text)
  language sql stable security definer set search_path = app, pg_temp as $$
  select e.email, e.rolle, u.name, k.anzeigename, e.laeuft_ab, e.sprache
    from app.einladung e join app.unternehmen u on u.id = e.unternehmen_id
    left join app.konto k on k.id = e.erstellt_von
   where e.id = p_id and e.angenommen_am is null and e.widerrufen_am is null and e.laeuft_ab > now()
$$;
revoke all on function app.einladung_fuer_versand(uuid) from public;
grant execute on function app.einladung_fuer_versand(uuid) to amtlos_worker;
