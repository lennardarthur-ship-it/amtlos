-- =====================================================================
-- 0008 · Personal und Arbeitsschutz (Bauabschnitt 5, Spezifikation 6.6)
--
-- Datensparsam (E-090): nur Name, Beschäftigungsart, Eintritt/Austritt, Wochenstunden. Keine Geburtsdaten,
-- keine Angaben zu Schwangerschaft oder Schwerbehinderung je Person (das Profil führt nur Anzahlen).
-- Unterweisungs-Bestätigungen und Zeiteinträge sind manipulationsgeschützt: nur anhängen, Korrektur als neuer Eintrag.
-- =====================================================================

create type app.beschaeftigungsart as enum ('vollzeit', 'teilzeit', 'minijob', 'azubi', 'werkstudent');

create table app.beschaeftigter (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  vorname         text not null,
  nachname        text not null,
  art             app.beschaeftigungsart not null,
  eintritt        date not null,
  austritt        date,
  wochenstunden   numeric(5,2) check (wochenstunden is null or (wochenstunden > 0 and wochenstunden <= 80)),
  erstellt_am     timestamptz not null default now(),
  check (austritt is null or austritt >= eintritt)
);
create index beschaeftigter_aktiv on app.beschaeftigter (unternehmen_id) where austritt is null;

-- ---------- Unterweisungen ----------
create table app.unterweisung (
  id               uuid primary key default gen_random_uuid(),
  unternehmen_id   uuid not null references app.unternehmen(id),
  thema            text not null,
  inhalt           text not null,
  datum            date not null,
  durchgefuehrt_von text not null,
  inhalt_sha256    bytea not null,                   -- Hash von Thema + Inhalt: belegt, was bestätigt wurde
  abgeschlossen_am timestamptz,
  dokument_id      uuid references app.dokument(id), -- Protokoll (PDF)
  erstellt_von     uuid references app.konto(id),
  erstellt_am      timestamptz not null default now()
);

-- Nach dem Abschließen ist eine Unterweisung unveränderlich; vorher nur Thema/Inhalt/Datum änderbar.
create function app.unterweisung_schutz() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.abgeschlossen_am is not null or exists (select 1 from app.unterweisung_teilnahme t where t.unterweisung_id = old.id) then
      raise exception 'unterweisung_unveraenderlich: bestätigte oder abgeschlossene Unterweisungen werden nicht gelöscht';
    end if;
    return old;
  end if;
  if old.abgeschlossen_am is not null then raise exception 'unterweisung_unveraenderlich: abgeschlossen'; end if;
  if new.inhalt_sha256 <> old.inhalt_sha256 and exists (select 1 from app.unterweisung_teilnahme t where t.unterweisung_id = old.id) then
    raise exception 'unterweisung_unveraenderlich: Inhalt bereits bestätigt';
  end if;
  return new;
end $$;

create table app.unterweisung_teilnahme (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  unterweisung_id    uuid not null references app.unterweisung(id),
  beschaeftigter_id  uuid not null references app.beschaeftigter(id),
  bestaetigt_am      timestamptz not null default now(),
  name_bestaetigt    text not null,                    -- einfache elektronische Signatur (Spezifikation 7)
  inhalt_sha256      bytea not null,
  erfasst_von        uuid references app.konto(id),
  unique (unterweisung_id, beschaeftigter_id)
);
create trigger unterweisung_schutz before update or delete on app.unterweisung for each row execute function app.unterweisung_schutz();
create trigger teilnahme_unveraenderlich before update or delete on app.unterweisung_teilnahme for each row execute function app.nur_anhaengen();

-- ---------- Zeiterfassung ----------
create table app.zeiteintrag (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  beschaeftigter_id  uuid not null references app.beschaeftigter(id),
  beginn             timestamptz not null,
  ende               timestamptz,
  pause_minuten      int not null default 0 check (pause_minuten between 0 and 1440),
  quelle             text not null check (quelle in ('stempel', 'nachtrag', 'korrektur')),
  ersetzt_id         uuid references app.zeiteintrag(id), -- Korrektur: verweist auf den ersetzten Eintrag
  grund              text,                                -- Pflicht bei Nachtrag/Korrektur
  storniert          boolean not null default false,      -- Korrektur „Eintrag war falsch“ (ohne Ersatz)
  erfasst_von        uuid references app.konto(id),
  erfasst_am         timestamptz not null default now(),
  check (ende is null or ende > beginn),
  check (ende is null or ende - beginn <= interval '24 hours'),
  check (quelle = 'stempel' or grund is not null)
);
create index zeiteintrag_zeit on app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn);
-- höchstens ein offener Stempel je Person
create unique index zeiteintrag_offen on app.zeiteintrag (beschaeftigter_id) where ende is null and not storniert;

-- Nur anhängen; einzige erlaubte Änderung: einen offenen Stempel einmal schließen (ende und Pause setzen).
create function app.zeiteintrag_schutz() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'zeiteintrag_unveraenderlich: Korrektur über einen neuen Eintrag'; end if;
  if old.ende is null and new.ende is not null
     and (to_jsonb(new) - 'ende' - 'pause_minuten') = (to_jsonb(old) - 'ende' - 'pause_minuten') then
    return new;
  end if;
  raise exception 'zeiteintrag_unveraenderlich: Korrektur über einen neuen Eintrag';
end $$;
create trigger zeiteintrag_schutz before update or delete on app.zeiteintrag for each row execute function app.zeiteintrag_schutz();

-- Gültige Einträge: nicht ersetzt, nicht storniert
create view app.zeiteintrag_gueltig with (security_invoker = true) as
  select z.* from app.zeiteintrag z
   where not z.storniert and not exists (select 1 from app.zeiteintrag n where n.ersetzt_id = z.id);

-- ---------- RLS, Audit, Rechte ----------
do $$
declare t text;
begin
  foreach t in array array['beschaeftigter','unterweisung','unterweisung_teilnahme','zeiteintrag'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
    execute format($p$create policy mandant on app.%I
                     using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
                     with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))$p$, t);
    execute format('create trigger audit after insert or update or delete on app.%I for each row execute function audit.protokollieren()', t);
  end loop;
end $$;

grant select, insert, update on app.beschaeftigter, app.unterweisung, app.unterweisung_teilnahme, app.zeiteintrag to amtlos_app;
grant select on app.zeiteintrag_gueltig to amtlos_app;
grant delete on app.unterweisung to amtlos_app; -- Entwürfe ohne Bestätigung; der Trigger schützt den Rest
