-- =====================================================================
-- 0004 · Einladungen ins Team (Abschnitt 1, Nachtrag)
--
-- Inhaber oder Admins laden per E-Mail ein (Mitarbeiter, Steuerberater, Admin – nie Inhaber).
-- Der Link enthält ein geheimes Token; gespeichert wird nur sein SHA-256 (wie beim Kalender-Abo).
-- Annehmen kann nur, wer mit genau dieser E-Mail-Adresse angemeldet ist (E-079).
-- =====================================================================

alter table app.einladung
  add column erstellt_von   uuid references app.konto(id),
  add column erstellt_am    timestamptz not null default now(),
  add column widerrufen_am  timestamptz,
  add column angenommen_von uuid references app.konto(id),
  add constraint einladung_nicht_inhaber check (rolle <> 'inhaber');

-- Einladungen enthalten E-Mail-Adressen Dritter: nur Inhaber und Admins sehen und verwalten sie.
drop policy mandant on app.einladung;
create policy verwalten on app.einladung
  using      (unternehmen_id = app.aktuelles_unternehmen() and app.hat_rolle(unternehmen_id, array['inhaber','admin']::app.rolle[]))
  with check (unternehmen_id = app.aktuelles_unternehmen() and app.hat_rolle(unternehmen_id, array['inhaber','admin']::app.rolle[]));
-- Hart löschen gibt es nicht: Widerruf setzt widerrufen_am (nachvollziehbar).
revoke delete on app.einladung from amtlos_app;

create trigger audit after insert or update or delete on app.einladung
  for each row execute function audit.protokollieren();

-- Systemfunktionen laufen als Eigentümer; wegen FORCE RLS braucht er eine eigene Policy.
create policy systemfunktion on app.einladung to amtlos_owner using (true) with check (true);

-- Annehmen: vor dem Beitritt ist man nicht Mitglied, daher SECURITY DEFINER.
-- Fehlertexte sind bewusst gleich für „gibt es nicht“ und „abgelaufen/widerrufen“ (kein Ausforschen).
create function app.einladung_annehmen(p_token_hash bytea) returns uuid
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare
  e app.einladung;
  ich uuid := app.aktuelles_konto();
  meine_email public.citext;
begin
  if ich is null then raise exception 'Kein Konto im Kontext'; end if;
  select * into e from app.einladung where token_hash = p_token_hash for update;
  if not found or e.angenommen_am is not null or e.widerrufen_am is not null or e.laeuft_ab <= now() then
    raise exception 'einladung_ungueltig' using errcode = 'P0002';
  end if;
  select email into meine_email from app.konto where id = ich;
  -- lower(): der citext-Operator liegt in public, das hier nicht im search_path steht
  if lower(meine_email::text) is distinct from lower(e.email::text) then
    raise exception 'einladung_andere_email' using errcode = 'P0003';
  end if;
  -- Bestehende Mitgliedschaft bleibt unverändert (keine Hoch- oder Herabstufung über einen Link).
  insert into app.mitgliedschaft (unternehmen_id, konto_id, rolle) values (e.unternehmen_id, ich, e.rolle)
    on conflict (unternehmen_id, konto_id) do nothing;
  update app.einladung set angenommen_am = now(), angenommen_von = ich where id = e.id;
  return e.unternehmen_id;
end $$;
revoke all on function app.einladung_annehmen(bytea) from public;
grant execute on function app.einladung_annehmen(bytea) to amtlos_app;

-- Vorschau für die Annahmeseite: Unternehmensname und Rolle, ohne Mitglied zu sein. Nur gültige Einladungen.
create function app.einladung_vorschau(p_token_hash bytea)
  returns table (unternehmen text, rolle app.rolle, eingeladen_von text, laeuft_ab timestamptz)
  language sql stable security definer set search_path = app, pg_temp as $$
  select u.name, e.rolle, k.anzeigename, e.laeuft_ab
    from app.einladung e join app.unternehmen u on u.id = e.unternehmen_id
    left join app.konto k on k.id = e.erstellt_von
   where e.token_hash = p_token_hash and e.angenommen_am is null and e.widerrufen_am is null and e.laeuft_ab > now()
     and u.geloescht_am is null
$$;
revoke all on function app.einladung_vorschau(bytea) from public;
grant execute on function app.einladung_vorschau(bytea) to amtlos_app;

-- Versand durch den Worker: nur die Angaben für die E-Mail, nur solange die Einladung offen ist.
create function app.einladung_fuer_versand(p_id uuid)
  returns table (email public.citext, rolle app.rolle, unternehmen text, eingeladen_von text, laeuft_ab timestamptz)
  language sql stable security definer set search_path = app, pg_temp as $$
  select e.email, e.rolle, u.name, k.anzeigename, e.laeuft_ab
    from app.einladung e join app.unternehmen u on u.id = e.unternehmen_id
    left join app.konto k on k.id = e.erstellt_von
   where e.id = p_id and e.angenommen_am is null and e.widerrufen_am is null and e.laeuft_ab > now()
$$;
revoke all on function app.einladung_fuer_versand(uuid) from public;
grant execute on function app.einladung_fuer_versand(uuid) to amtlos_worker;

-- Mitglied entfernen: der letzte Inhaber kann nicht entfernt oder herabgestuft werden.
create function app.letzter_inhaber_schutz() returns trigger
  language plpgsql security definer set search_path = app, pg_temp as $$
begin
  if old.rolle = 'inhaber' and (tg_op = 'DELETE' or new.rolle <> 'inhaber') then
    if not exists (select 1 from app.mitgliedschaft m
                    where m.unternehmen_id = old.unternehmen_id and m.rolle = 'inhaber' and m.konto_id <> old.konto_id) then
      raise exception 'letzter_inhaber' using errcode = 'P0004';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger letzter_inhaber before update or delete on app.mitgliedschaft
  for each row execute function app.letzter_inhaber_schutz();
