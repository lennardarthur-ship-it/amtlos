-- =====================================================================
-- 0013 · Bauabschnitt 9: Benachrichtigungen, Behörden-Postfach, Experten-Marktplatz
-- =====================================================================

-- ---------- Benachrichtigungen: jede Person sieht nur ihre eigenen ----------
create policy eigenes_konto on app.benachrichtigung as restrictive to amtlos_app
  using (konto_id = app.aktuelles_konto())
  with check (konto_id = app.aktuelles_konto());
create index benachrichtigung_ungelesen on app.benachrichtigung (konto_id, unternehmen_id) where gelesen_am is null;

-- ---------- Behörden-Postfach (6.11) ----------
-- Briefe werden hochgeladen (Dokument unveränderlich) und von Hand eingeordnet; Erkennung per OCR/KI folgt (E-101).
create table app.behoerdenbrief (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  dokument_id     uuid not null references app.dokument(id),
  eingang_am      date not null,
  absender        text not null default '',
  art             text not null default 'sonstiges' check (art in ('bescheid', 'mahnung', 'anhoerung', 'auskunftsersuchen', 'sonstiges')),
  aktenzeichen    text not null default '',
  frist_am        date,                          -- aus dem Brief übernommen (z. B. Rechtsbehelfsbelehrung), nicht berechnet
  frist_art       text check (frist_art in ('einspruch', 'zahlung', 'antwort', 'sonstige')),
  betrag_cent     bigint check (betrag_cent is null or betrag_cent >= 0),
  pflicht_id      text references katalog.pflicht(id),
  notiz           text,
  erledigt_am     date,
  erfasst_von     uuid references app.konto(id),
  erstellt_am     timestamptz not null default now(),
  check (frist_am is null or frist_art is not null)
);
create index behoerdenbrief_frist on app.behoerdenbrief (unternehmen_id, frist_am) where erledigt_am is null;

-- ---------- Experten-Marktplatz (6.12) ----------
-- Partner pflegt die Plattform im Studio (keine Mandantendaten). Vergütungsmodell offen (J-4): keine Provision, keine Zahlung.
create table katalog.partner (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  qualifikation   text not null check (qualifikation in ('steuerberater', 'rechtsanwalt', 'fachkraft_arbeitssicherheit', 'datenschutzbeauftragter')),
  kanzlei         text not null default '',
  regionen        text[] not null default '{}',  -- Bundesländer (leer = bundesweit)
  beschreibung    text not null default '',
  pakete          jsonb not null default '[]',   -- [{ titel, umfang, preis_text }] – Festpreise des Partners
  email           citext not null,
  website         text,
  zulassung_geprueft_am date,                    -- Prüfung der Berufszulassung durch die Plattform
  aktiv           boolean not null default true,
  erstellt_am     timestamptz not null default now(),
  check (jsonb_typeof(pakete) = 'array')
);

create table app.marktplatz_anfrage (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  partner_id      uuid not null references katalog.partner(id),
  konto_id        uuid not null references app.konto(id),
  paket           text,
  nachricht       text not null,
  geteilte_daten  jsonb not null default '{}',   -- Momentaufnahme genau der Daten, denen zugestimmt wurde
  einwilligung_am timestamptz not null,
  versendet_am    timestamptz,
  erstellt_am     timestamptz not null default now()
);

alter table app.behoerdenbrief enable row level security;
alter table app.behoerdenbrief force row level security;
create policy mandant on app.behoerdenbrief
  using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
  with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id));
create trigger audit after insert or update or delete on app.behoerdenbrief for each row execute function audit.protokollieren();

alter table app.marktplatz_anfrage enable row level security;
alter table app.marktplatz_anfrage force row level security;
create policy mandant on app.marktplatz_anfrage
  using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
  with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id));
create policy worker on app.marktplatz_anfrage to amtlos_worker
  using (unternehmen_id = app.aktuelles_unternehmen())
  with check (unternehmen_id = app.aktuelles_unternehmen());
create trigger audit after insert or update or delete on app.marktplatz_anfrage for each row execute function audit.protokollieren();
create trigger audit after insert or update or delete on katalog.partner for each row execute function audit.protokollieren();

grant select, insert, update on app.behoerdenbrief to amtlos_app;
grant select, insert on app.marktplatz_anfrage to amtlos_app;
grant select, update on app.marktplatz_anfrage to amtlos_worker;
grant select on katalog.partner to amtlos_app, amtlos_worker;
grant select, insert, update on katalog.partner to amtlos_studio;
