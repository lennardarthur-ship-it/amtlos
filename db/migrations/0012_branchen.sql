-- =====================================================================
-- 0012 · Branchenmodule (Bauabschnitt 8): Gastronomie-Werkzeuge
-- HACCP-Eigenkontrollen (Messpunkte mit vom Betrieb festgelegten Grenzwerten, Messungen nur anhängend),
-- Allergenliste je Gericht (14 Hauptallergene nach Anhang II LMIV, E-099), IfSG-Belehrung als Unterweisungsart.
-- =====================================================================

create table app.messpunkt (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  bezeichnung     text not null,                 -- „Kühlschrank Küche“
  einheit         text not null default '°C' check (einheit in ('°C', '%', 'pH', 'sonstige')),
  grenze_min      numeric(8,2),                  -- vom Betrieb festgelegt (keine Vorgaben im Code)
  grenze_max      numeric(8,2),
  aktiv           boolean not null default true,
  erstellt_am     timestamptz not null default now(),
  check (grenze_min is null or grenze_max is null or grenze_min <= grenze_max)
);

create table app.messung (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  messpunkt_id    uuid not null references app.messpunkt(id),
  gemessen_am     timestamptz not null default now(),
  wert            numeric(8,2) not null,
  in_ordnung      boolean not null,               -- gegen die Grenzwerte zum Zeitpunkt der Messung
  grenze_min      numeric(8,2),                   -- Grenzwerte zum Zeitpunkt der Messung (nachvollziehbar)
  grenze_max      numeric(8,2),
  massnahme       text,                           -- Pflicht, wenn außerhalb der Grenzen
  erfasst_von     uuid references app.konto(id),
  erfasst_am      timestamptz not null default now(),
  check (in_ordnung or massnahme is not null)
);
create index messung_zeit on app.messung (unternehmen_id, gemessen_am);
create trigger messung_unveraenderlich before update or delete on app.messung for each row execute function app.nur_anhaengen();

create table app.gericht (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  name            text not null,
  kategorie       text not null default '',
  allergene       text[] not null default '{}' check (allergene <@ array['gluten','krebstiere','eier','fische','erdnuesse','soja','milch','schalenfruechte','sellerie','senf','sesam','schwefeldioxid','lupinen','weichtiere']::text[]),
  aktiv           boolean not null default true,
  aktualisiert_am timestamptz not null default now(),
  erstellt_am     timestamptz not null default now()
);

alter table app.unterweisung drop constraint unterweisung_art_check;
alter table app.unterweisung add constraint unterweisung_art_check check (art in ('arbeitsschutz','ki_kompetenz','datenschutz','ifsg'));

do $$
declare t text;
begin
  foreach t in array array['messpunkt','messung','gericht'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
    execute format($p$create policy mandant on app.%I
                     using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
                     with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))$p$, t);
    execute format('create trigger audit after insert or update or delete on app.%I for each row execute function audit.protokollieren()', t);
  end loop;
end $$;

grant select, insert, update on app.messpunkt, app.gericht to amtlos_app;
grant select, insert on app.messung to amtlos_app;
