-- =====================================================================
-- 0018 · Launch: Abo (Stripe) und Löschen (DSGVO) – E-113, E-114
-- =====================================================================

-- ---------- Abo je Unternehmen ----------
-- Preise und Pläne sind Konfiguration (Spezifikation 9). Jedes Unternehmen beginnt mit einer Testphase.
create table app.abo (
  unternehmen_id   uuid primary key references app.unternehmen(id),
  plan             text not null default 'start',
  status           text not null default 'test' check (status in ('test', 'aktiv', 'gekuendigt', 'ueberfaellig', 'abgelaufen')),
  test_bis         date not null,
  laeuft_bis       date,                         -- Ende der bezahlten Periode (aus Stripe)
  stripe_kunde_id  text unique,
  stripe_abo_id    text unique,
  aktualisiert_am  timestamptz not null default now()
);
-- Mitglieder lesen; schreiben nur Systemfunktionen (Webhook, Testphase) – nie direkt die App
alter table app.abo enable row level security;
alter table app.abo force row level security;
create policy mandant on app.abo for select using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id));
create policy systemfunktion on app.abo to amtlos_owner using (true) with check (true);
create trigger audit after insert or update or delete on app.abo for each row execute function audit.protokollieren();
grant select on app.abo to amtlos_app, amtlos_worker;

-- Stripe-Ereignisse: jedes genau einmal verarbeiten (Webhooks kommen auch doppelt)
create table app.abrechnungsereignis (
  id             text primary key,               -- Stripe event id
  typ            text not null,
  payload        jsonb not null,
  verarbeitet_am timestamptz not null default now()
);
-- Keine Mandanten-Policy: nur über die Systemfunktion erreichbar
alter table app.abrechnungsereignis enable row level security;
alter table app.abrechnungsereignis force row level security;
create policy systemfunktion on app.abrechnungsereignis to amtlos_owner using (true) with check (true);

-- Testphase beim Anlegen eines Unternehmens (Trigger, damit jedes Unternehmen genau ein Abo hat)
create function app.abo_testphase() returns trigger
  language plpgsql security definer set search_path = app, pg_temp as $$
begin
  insert into app.abo (unternehmen_id, test_bis)
    values (new.id, current_date + coalesce(nullif(current_setting('amtlos.testtage', true), '')::int, 14))
    on conflict do nothing;
  return new;
end $$;
create trigger abo_testphase after insert on app.unternehmen for each row execute function app.abo_testphase();
-- Bestehende Unternehmen bekommen die Testphase ab heute
insert into app.abo (unternehmen_id, test_bis) select id, current_date + 14 from app.unternehmen where geloescht_am is null on conflict do nothing;

-- Ist das Unternehmen schreibberechtigt (Test läuft oder bezahlt)? Für den Abo-Guard der API.
create function app.abo_stand(p_unternehmen uuid)
  returns table (status text, test_bis date, laeuft_bis date, schreibbar boolean)
  language sql stable security definer set search_path = app, pg_temp as $$
  select a.status, a.test_bis, a.laeuft_bis,
         (a.status in ('aktiv', 'gekuendigt') and (a.laeuft_bis is null or a.laeuft_bis >= current_date))
         or (a.status = 'test' and a.test_bis >= current_date)
         or (a.status = 'ueberfaellig' and coalesce(a.laeuft_bis, current_date) + 14 >= current_date) -- Kulanz bei Zahlungsproblemen
    from app.abo a where a.unternehmen_id = p_unternehmen
$$;
revoke all on function app.abo_stand(uuid) from public;
grant execute on function app.abo_stand(uuid) to amtlos_app, amtlos_worker;

-- Webhook: Stripe-Kunde dem Unternehmen zuordnen und Status setzen; idempotent über die Ereignis-ID.
-- Rückgabe false = Ereignis war schon verarbeitet.
create function app.abo_webhook(p_ereignis_id text, p_typ text, p_payload jsonb, p_unternehmen uuid, p_status text, p_laeuft_bis date, p_kunde text, p_abo text, p_plan text)
  returns boolean
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
begin
  insert into app.abrechnungsereignis (id, typ, payload) values (p_ereignis_id, p_typ, p_payload) on conflict do nothing;
  if not found then return false; end if;
  if p_unternehmen is not null then
    update app.abo set status = coalesce(p_status, status), laeuft_bis = coalesce(p_laeuft_bis, laeuft_bis),
           stripe_kunde_id = coalesce(p_kunde, stripe_kunde_id), stripe_abo_id = coalesce(p_abo, stripe_abo_id),
           plan = coalesce(p_plan, plan), aktualisiert_am = now()
     where unternehmen_id = p_unternehmen;
  end if;
  return true;
end $$;
revoke all on function app.abo_webhook(text, text, jsonb, uuid, text, date, text, text, text) from public;
grant execute on function app.abo_webhook(text, text, jsonb, uuid, text, date, text, text, text) to amtlos_app;

-- Stripe-Kunde beim Start des Bezahlvorgangs merken (nur Inhaber/Admin über die API)
create function app.abo_kunde_setzen(p_unternehmen uuid, p_kunde text) returns void
  language sql volatile security definer set search_path = app, pg_temp as $$
  update app.abo set stripe_kunde_id = coalesce(stripe_kunde_id, p_kunde), aktualisiert_am = now()
   where unternehmen_id = p_unternehmen and app.ist_mitglied(p_unternehmen)
$$;
revoke all on function app.abo_kunde_setzen(uuid, text) from public;
grant execute on function app.abo_kunde_setzen(uuid, text) to amtlos_app;
-- Unternehmen zu einem Stripe-Kunden (für Webhooks ohne Metadaten)
create function app.abo_unternehmen_zu_kunde(p_kunde text) returns uuid
  language sql stable security definer set search_path = app, pg_temp as $$
  select unternehmen_id from app.abo where stripe_kunde_id = p_kunde
$$;
revoke all on function app.abo_unternehmen_zu_kunde(text) from public;
grant execute on function app.abo_unternehmen_zu_kunde(text) to amtlos_app;

-- ---------- Löschen (DSGVO Art. 17) ----------
-- Unternehmen: Inhaber setzt geloescht_am (sofort unsichtbar); endgültiges Löschen nach 30 Tagen durch den Worker,
-- Belege und Rechnungen bleiben wegen der Aufbewahrungspflicht (G-09) im Archivschema – bis zur Klärung: nur Sperre.
create function app.unternehmen_loeschen(p_unternehmen uuid) returns void
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
begin
  if not app.hat_rolle(p_unternehmen, array['inhaber']::app.rolle[]) then raise exception 'Nur Inhaber löschen das Unternehmen' using errcode = '42501'; end if;
  update app.unternehmen set geloescht_am = now() where id = p_unternehmen and geloescht_am is null;
  delete from app.erinnerung where unternehmen_id = p_unternehmen and status = 'geplant';
  update app.abo set status = 'abgelaufen', aktualisiert_am = now() where unternehmen_id = p_unternehmen;
end $$;
revoke all on function app.unternehmen_loeschen(uuid) from public;
grant execute on function app.unternehmen_loeschen(uuid) to amtlos_app;

-- Gelöschte Unternehmen sind für niemanden mehr sichtbar (auch nicht für Mitglieder)
drop policy mitglied on app.unternehmen;
create policy mitglied on app.unternehmen using (app.ist_mitglied(id) and geloescht_am is null);

-- Konto: nur ohne aktive Mitgliedschaft in einem nicht gelöschten Unternehmen; personenbezogene Felder werden unkenntlich
create function app.konto_loeschen() returns void
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare ich uuid := app.aktuelles_konto();
begin
  if ich is null then raise exception 'Kein Konto im Kontext'; end if;
  if exists (select 1 from app.mitgliedschaft m join app.unternehmen u on u.id = m.unternehmen_id where m.konto_id = ich and u.geloescht_am is null) then
    raise exception 'konto_hat_unternehmen' using errcode = 'P0005';
  end if;
  update app.konto set email = 'geloescht-' || ich::text || '@amtlos.invalid', anzeigename = 'Gelöschtes Konto',
         idp_subject = 'geloescht-' || ich::text, geloescht_am = now() where id = ich;
  update app.geraet set aktiv = false where konto_id = ich;
  delete from app.benachrichtigung where konto_id = ich;
  delete from app.benachrichtigung_einstellung where konto_id = ich;
end $$;
revoke all on function app.konto_loeschen() from public;
grant execute on function app.konto_loeschen() to amtlos_app;

-- Endgültiges Löschen nach Frist (Worker, täglich): personenbezogene Daten ohne Aufbewahrungspflicht werden gelöscht
-- oder unkenntlich gemacht. Unveränderliche Nachweise (Zeiten, Unterweisungen, Belege, Rechnungen, Pflichtinstanzen)
-- bleiben bis zur Klärung der Aufbewahrungsfristen (G-09) – sie sind ohne Unternehmen und Namen nicht mehr zuordenbar.
create function app.endgueltig_loeschen(p_frist interval default interval '30 days') returns int
  language plpgsql volatile security definer set search_path = app, pg_temp as $$
declare n int := 0; u uuid;
begin
  for u in select id from app.unternehmen where geloescht_am is not null and geloescht_am < now() - p_frist and name <> '' loop
    delete from app.erinnerung where unternehmen_id = u;
    delete from app.benachrichtigung where unternehmen_id = u;
    delete from app.benachrichtigung_einstellung where unternehmen_id = u;
    delete from app.kalender_abo where unternehmen_id = u;
    delete from app.einladung where unternehmen_id = u and angenommen_am is null;
    delete from app.marktplatz_anfrage where unternehmen_id = u;
    update app.beschaeftigter set vorname = 'Gelöscht', nachname = 'Gelöscht' where unternehmen_id = u;
    update app.behoerdenbrief set absender = '', aktenzeichen = '', notiz = null where unternehmen_id = u;
    update app.unternehmen set name = '' where id = u;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function app.endgueltig_loeschen(interval) from public;
grant execute on function app.endgueltig_loeschen(interval) to amtlos_worker;
