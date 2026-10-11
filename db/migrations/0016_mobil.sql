-- =====================================================================
-- 0016 · Bauabschnitt 10: Mobile App – Offline-Stempel, Geräte für Push (E-108)
-- =====================================================================

-- ---------- Offline-Stempel ----------
-- Die App stempelt auch ohne Netz und überträgt später. client_id macht das Übertragen idempotent;
-- offline = true kennzeichnet Zeiten, deren Zeitpunkt vom Gerät stammt (erfasst_am zeigt den Eingang beim Server).
alter table app.zeiteintrag
  add column client_id      uuid,
  add column ende_client_id uuid,
  add column offline        boolean not null default false,
  add column ende_offline   boolean not null default false;
create unique index zeiteintrag_client on app.zeiteintrag (unternehmen_id, client_id) where client_id is not null;
create unique index zeiteintrag_ende_client on app.zeiteintrag (unternehmen_id, ende_client_id) where ende_client_id is not null;

-- Schließen eines offenen Stempels darf jetzt auch die Felder fürs Gehen setzen
create or replace function app.zeiteintrag_schutz() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'zeiteintrag_unveraenderlich: Korrektur über einen neuen Eintrag'; end if;
  if old.ende is null and new.ende is not null
     and (to_jsonb(new) - 'ende' - 'pause_minuten' - 'ende_client_id' - 'ende_offline')
       = (to_jsonb(old) - 'ende' - 'pause_minuten' - 'ende_client_id' - 'ende_offline') then
    return new;
  end if;
  raise exception 'zeiteintrag_unveraenderlich: Korrektur über einen neuen Eintrag';
end $$;

create or replace view app.zeiteintrag_gueltig with (security_invoker = true) as
  select z.* from app.zeiteintrag z
   where not z.storniert and not exists (select 1 from app.zeiteintrag n where n.ersetzt_id = z.id);

-- ---------- Geräte (Push-Benachrichtigungen) ----------
-- Gehören zum Konto, nicht zum Unternehmen. Ein Push-Token gehört genau einem Konto (Gerätewechsel: neu zuordnen).
create table app.geraet (
  id           uuid primary key default gen_random_uuid(),
  konto_id     uuid not null references app.konto(id),
  push_token   text not null unique check (length(push_token) between 10 and 300),
  plattform    text not null check (plattform in ('ios', 'android')),
  name         text not null default '' check (length(name) <= 100),
  erstellt_am  timestamptz not null default now(),
  zuletzt_am   timestamptz not null default now(),
  aktiv        boolean not null default true
);
create index geraet_konto on app.geraet (konto_id) where aktiv;
alter table app.geraet enable row level security;
alter table app.geraet force row level security;
create policy eigenes_konto on app.geraet to amtlos_app
  using (konto_id = app.aktuelles_konto()) with check (konto_id = app.aktuelles_konto());
-- Worker: Geräte der Mitglieder des Unternehmens im Kontext (für Erinnerungen); abmelden nach „Gerät unbekannt“
create policy worker on app.geraet to amtlos_worker
  using (exists (select 1 from app.mitgliedschaft m where m.konto_id = geraet.konto_id and m.unternehmen_id = app.aktuelles_unternehmen()));
create policy systemfunktion on app.geraet to amtlos_owner using (true) with check (true);
create trigger audit after insert or update or delete on app.geraet for each row execute function audit.protokollieren();
grant select, update on app.geraet to amtlos_app, amtlos_worker;

-- Registrieren: legt an oder ordnet ein vorhandenes Token dem eigenen Konto zu (das Token beweist den Gerätebesitz)
create function app.geraet_registrieren(p_token text, p_plattform text, p_name text) returns uuid
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare g uuid;
begin
  if app.aktuelles_konto() is null then raise exception 'Kein Konto im Kontext'; end if;
  insert into app.geraet (konto_id, push_token, plattform, name) values (app.aktuelles_konto(), p_token, p_plattform, coalesce(p_name, ''))
  on conflict (push_token) do update set konto_id = excluded.konto_id, plattform = excluded.plattform, name = excluded.name, aktiv = true, zuletzt_am = now()
  returning id into g;
  return g;
end $$;
revoke all on function app.geraet_registrieren(text, text, text) from public;
grant execute on function app.geraet_registrieren(text, text, text) to amtlos_app;
