-- =====================================================================
-- 0009 · Arbeitsschutz-Dokumentation (Bauabschnitt 5, Katalog E.50, E.54, E.55)
--
-- Gefährdungsbeurteilung als strukturierte Daten (Gefährdung → Maßnahme → Umsetzung → Wirksamkeit) mit
-- PDF beim Abschluss; Prüfungen elektrischer Arbeitsmittel als Verzeichnis mit Prüfhistorie;
-- Gefahrstoffverzeichnis mit Sicherheitsdatenblatt. Prüffristen und Inhalte gibt der Betrieb ein –
-- Amtlos setzt keine fachlichen Werte (E-094).
-- =====================================================================

-- ---------- Gefährdungsbeurteilung ----------
create table app.gefaehrdungsbeurteilung (
  id               uuid primary key default gen_random_uuid(),
  unternehmen_id   uuid not null references app.unternehmen(id),
  arbeitsbereich   text not null,                 -- z. B. „Backstube“, „Büro“
  taetigkeiten     text not null default '',
  beurteilt_von    text not null,
  datum            date not null,
  mutterschutz     boolean not null default false, -- anlassunabhängige Beurteilung nach MuSchG mit erfasst
  abgeschlossen_am timestamptz,
  dokument_id      uuid references app.dokument(id),
  erstellt_von     uuid references app.konto(id),
  erstellt_am      timestamptz not null default now()
);

create table app.gefaehrdung (
  id                  uuid primary key default gen_random_uuid(),
  unternehmen_id      uuid not null references app.unternehmen(id),
  beurteilung_id      uuid not null references app.gefaehrdungsbeurteilung(id),
  faktor              text not null check (faktor in ('arbeitsstaette','einwirkungen','arbeitsmittel','ablaeufe_arbeitszeit','qualifikation','psychisch','sonstiges')),
  beschreibung        text not null,
  risiko              text not null check (risiko in ('gering','mittel','hoch')),
  massnahme           text not null,
  verantwortlich      text,
  umsetzen_bis        date,
  umgesetzt_am        date,
  wirksam_geprueft_am date,
  wirksamkeit_notiz   text,
  erstellt_am         timestamptz not null default now()
);
create index gefaehrdung_beurteilung on app.gefaehrdung (beurteilung_id);

-- Nach dem Abschluss: Beurteilung unveränderlich; bei Gefährdungen nur noch Umsetzung und Wirksamkeit nachtragen.
create function app.gefaehrdungsbeurteilung_schutz() returns trigger language plpgsql as $$
begin
  if old.abgeschlossen_am is not null then raise exception 'beurteilung_unveraenderlich: abgeschlossen'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger beurteilung_schutz before update or delete on app.gefaehrdungsbeurteilung for each row execute function app.gefaehrdungsbeurteilung_schutz();

create function app.gefaehrdung_schutz() returns trigger language plpgsql as $$
declare zu boolean;
begin
  select abgeschlossen_am is not null into zu from app.gefaehrdungsbeurteilung
   where id = case when tg_op = 'DELETE' then old.beurteilung_id else new.beurteilung_id end;
  if not zu then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'umgesetzt_am' - 'wirksam_geprueft_am' - 'wirksamkeit_notiz') = (to_jsonb(old) - 'umgesetzt_am' - 'wirksam_geprueft_am' - 'wirksamkeit_notiz') then
    return new;
  end if;
  raise exception 'beurteilung_unveraenderlich: nach dem Abschluss nur Umsetzung und Wirksamkeit';
end $$;
create trigger gefaehrdung_schutz before insert or update or delete on app.gefaehrdung for each row execute function app.gefaehrdung_schutz();

-- ---------- Elektrische Arbeitsmittel (DGUV Vorschrift 3) ----------
create table app.arbeitsmittel (
  id                uuid primary key default gen_random_uuid(),
  unternehmen_id    uuid not null references app.unternehmen(id),
  bezeichnung       text not null,
  standort          text,
  kennung           text,                          -- Inventar- oder Seriennummer
  pruefintervall_monate int check (pruefintervall_monate is null or pruefintervall_monate between 1 and 120), -- vom Betrieb festgelegt
  naechste_pruefung date,
  ausgesondert_am   date,
  erstellt_am       timestamptz not null default now()
);

create table app.arbeitsmittel_pruefung (
  id                uuid primary key default gen_random_uuid(),
  unternehmen_id    uuid not null references app.unternehmen(id),
  arbeitsmittel_id  uuid not null references app.arbeitsmittel(id),
  datum             date not null,
  ergebnis          text not null check (ergebnis in ('bestanden','maengel','ausgesondert')),
  pruefer           text not null,
  bemerkung         text,
  dokument_id       uuid references app.dokument(id),   -- Prüfprotokoll des Prüfers (Upload)
  erfasst_von       uuid references app.konto(id),
  erfasst_am        timestamptz not null default now()
);
create trigger arbeitsmittel_pruefung_unveraenderlich before update or delete on app.arbeitsmittel_pruefung for each row execute function app.nur_anhaengen();

-- ---------- Gefahrstoffverzeichnis (GefStoffV) ----------
create table app.gefahrstoff (
  id                uuid primary key default gen_random_uuid(),
  unternehmen_id    uuid not null references app.unternehmen(id),
  bezeichnung       text not null,
  hersteller        text,
  verwendung        text,                          -- Tätigkeit / Zweck
  arbeitsbereich    text,
  menge             text,                          -- frei: „ca. 5 l im Jahr“
  sdb_dokument_id   uuid references app.dokument(id),
  sdb_stand         date,
  entfernt_am       date,
  erstellt_am       timestamptz not null default now()
);

-- ---------- RLS, Audit, Rechte ----------
do $$
declare t text;
begin
  foreach t in array array['gefaehrdungsbeurteilung','gefaehrdung','arbeitsmittel','arbeitsmittel_pruefung','gefahrstoff'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
    execute format($p$create policy mandant on app.%I
                     using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
                     with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))$p$, t);
    execute format('create trigger audit after insert or update or delete on app.%I for each row execute function audit.protokollieren()', t);
  end loop;
end $$;

grant select, insert, update on app.gefaehrdungsbeurteilung, app.gefaehrdung, app.arbeitsmittel, app.arbeitsmittel_pruefung, app.gefahrstoff to amtlos_app;
grant delete on app.gefaehrdungsbeurteilung, app.gefaehrdung to amtlos_app; -- nur Entwürfe, der Trigger schützt den Rest
