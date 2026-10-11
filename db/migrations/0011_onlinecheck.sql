-- =====================================================================
-- 0011 · Online-Compliance-Check (Bauabschnitt 7, Spezifikation 6.8)
-- Ergebnis je Lauf: geprüfte URL, abgerufene Seiten, Befunde (technischer Check, kein Rechtsgutachten, E-097).
-- =====================================================================
create table app.online_check (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  url             text not null,
  status          text not null check (status in ('ok', 'fehler')),
  fehler          text,                       -- Code bei status = fehler (z. B. nicht_erreichbar)
  seiten          jsonb not null default '[]',
  befunde         jsonb not null default '[]',
  erfasst_von     uuid references app.konto(id),
  erstellt_am     timestamptz not null default now()
);
create index online_check_neueste on app.online_check (unternehmen_id, erstellt_am desc);

alter table app.online_check enable row level security;
alter table app.online_check force row level security;
create policy mandant on app.online_check
  using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
  with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id));
create trigger online_check_unveraenderlich before update or delete on app.online_check for each row execute function app.nur_anhaengen();
grant select, insert on app.online_check to amtlos_app;
