-- =====================================================================
-- 0007 · Finanzen light (Bauabschnitt 4, Spezifikation 6.5)
--
-- Belege (Eingang), Rechnungen (Ausgang) mit E-Rechnung, Rechnungsstellerdaten, Kunden, Kassen.
-- GoBD-Grundsätze (E-088): Dateien unveränderlich (Hash, WORM in der Ablage), gestellte Rechnungen
-- unveränderlich (Korrektur nur über Storno), Belege nicht löschbar, jede Änderung im Audit.
-- Beträge in Cent (bigint), nie als Gleitkomma.
-- =====================================================================

-- Dateien: gesetzte Dokumente sind unveränderlich (Inhalt und Speicherort); löschen ist nicht vorgesehen.
create function app.dokument_unveraenderlich() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'dokument_unveraenderlich: Dokumente werden nicht gelöscht (GoBD)'; end if;
  if new.sha256 <> old.sha256 or new.objekt_key <> old.objekt_key or new.groesse_bytes <> old.groesse_bytes or new.mime <> old.mime then
    raise exception 'dokument_unveraenderlich: Inhalt eines Dokuments kann nicht geändert werden';
  end if;
  return new;
end $$;
create trigger dokument_unveraenderlich before update or delete on app.dokument
  for each row execute function app.dokument_unveraenderlich();

-- ---------- Rechnungssteller (eigene Angaben auf Rechnungen) ----------
create table app.rechnungssteller (
  unternehmen_id  uuid primary key references app.unternehmen(id),
  name            text not null,
  strasse         text not null,
  plz             text not null,
  ort             text not null,
  land            char(2) not null default 'DE',
  email           text not null,
  telefon         text,
  steuernummer    text,
  ust_idnr        text,
  iban            text,
  bic             text,
  aktualisiert_am timestamptz not null default now()
);

-- ---------- Kunden ----------
create table app.kunde (
  id              uuid primary key default gen_random_uuid(),
  unternehmen_id  uuid not null references app.unternehmen(id),
  name            text not null,
  strasse         text,
  plz             text,
  ort             text,
  land            char(2) not null default 'DE',
  email           text,
  ust_idnr        text,
  kaeufer_referenz text,                              -- z. B. Leitweg-ID oder Bestellnummer (XRechnung BT-10)
  geschaeftskunde boolean not null default true,
  erstellt_am     timestamptz not null default now()
);

-- ---------- Rechnungen (Ausgang) ----------
create type app.rechnung_status as enum ('entwurf', 'gestellt', 'storniert');

create table app.rechnung (
  id               uuid primary key default gen_random_uuid(),
  unternehmen_id   uuid not null references app.unternehmen(id),
  nummer           text,                              -- vergeben beim Stellen, fortlaufend je Unternehmen
  status           app.rechnung_status not null default 'entwurf',
  art              text not null default 'rechnung' check (art in ('rechnung', 'storno')),
  storniert_rechnung_id uuid references app.rechnung(id),
  rechnungsdatum   date,
  leistungsdatum   date,
  faellig_am       date,
  kunde_id         uuid references app.kunde(id),
  kunde            jsonb,                             -- Momentaufnahme beim Stellen
  steller          jsonb,                             -- Momentaufnahme beim Stellen
  positionen       jsonb not null default '[]',       -- [{bezeichnung, menge, einheit, preis_cent, ust_satz}]
  kleinunternehmer boolean not null default false,
  hinweis          text,
  netto_cent       bigint not null default 0,
  ust_cent         bigint not null default 0,
  brutto_cent      bigint not null default 0,
  regelwerte       jsonb,                             -- genutzte Steuersätze (Regelwert-ID und Version)
  xml_dokument_id  uuid references app.dokument(id),  -- XRechnung (CII)
  pdf_dokument_id  uuid references app.dokument(id),  -- PDF bzw. ZUGFeRD
  erstellt_von     uuid references app.konto(id),
  erstellt_am      timestamptz not null default now(),
  gestellt_am      timestamptz,
  unique (unternehmen_id, nummer),
  check (brutto_cent = netto_cent + ust_cent),
  check (status = 'entwurf' or (nummer is not null and rechnungsdatum is not null and gestellt_am is not null))
);
create index rechnung_jahr on app.rechnung (unternehmen_id, rechnungsdatum) where status <> 'entwurf';

-- Gestellte Rechnungen sind unveränderlich; erlaubt ist nur der Übergang gestellt → storniert. Entwürfe dürfen gelöscht werden.
create function app.rechnung_schutz() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'entwurf' then raise exception 'rechnung_unveraenderlich: gestellte Rechnungen werden nicht gelöscht, sondern storniert'; end if;
    return old;
  end if;
  if old.status = 'entwurf' then return new; end if;
  if old.status = 'gestellt' and new.status = 'storniert'
     and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then return new; end if;
  raise exception 'rechnung_unveraenderlich: gestellte Rechnungen können nicht geändert werden (Korrektur über Storno)';
end $$;
create trigger rechnung_schutz before update or delete on app.rechnung
  for each row execute function app.rechnung_schutz();

-- Fortlaufende Nummern je Unternehmen und Jahr, ohne Lücken durch abgebrochene Transaktionen
create table app.rechnungsnummer (
  unternehmen_id uuid not null references app.unternehmen(id),
  jahr           int not null,
  letzte         int not null default 0,
  primary key (unternehmen_id, jahr)
);

-- ---------- Belege (Eingang) ----------
create table app.beleg (
  id               uuid primary key default gen_random_uuid(),
  unternehmen_id   uuid not null references app.unternehmen(id),
  dokument_id      uuid not null references app.dokument(id),
  belegdatum       date,
  lieferant        text,
  belegnummer      text,
  brutto_cent      bigint,
  ust_cent         bigint,                            -- Vorsteuer laut Beleg (Angabe des Nutzers bzw. aus der E-Rechnung)
  kategorie        text,
  notiz            text,
  quelle           text not null check (quelle in ('upload', 'e_rechnung', 'email', 'foto')),
  e_rechnung       jsonb,                             -- gelesene Kerndaten einer empfangenen E-Rechnung
  storniert        boolean not null default false,    -- statt Löschen (GoBD)
  erfasst_von      uuid references app.konto(id),
  erfasst_am       timestamptz not null default now(),
  check (ust_cent is null or brutto_cent is null or abs(ust_cent) <= abs(brutto_cent))
);
create index beleg_datum on app.beleg (unternehmen_id, belegdatum);
create trigger beleg_kein_loeschen before delete on app.beleg for each row execute function app.nur_anhaengen();

-- ---------- Kassen ----------
create table app.kasse (
  id                uuid primary key default gen_random_uuid(),
  unternehmen_id    uuid not null references app.unternehmen(id),
  bezeichnung       text not null,
  art               text,
  hersteller        text,
  modell            text,
  seriennummer      text,
  tse_seriennummer  text,
  betriebsstaette   text,
  angeschafft_am    date not null,
  ausser_betrieb_am date,
  erstellt_am       timestamptz not null default now(),
  check (ausser_betrieb_am is null or ausser_betrieb_am >= angeschafft_am)
);

-- ---------- RLS, Audit, Rechte ----------
do $$
declare t text;
begin
  foreach t in array array['rechnungssteller','kunde','rechnung','rechnungsnummer','beleg','kasse'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
    execute format($p$create policy mandant on app.%I
                     using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
                     with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))$p$, t);
  end loop;
  foreach t in array array['app.rechnungssteller','app.kunde','app.rechnung','app.beleg','app.kasse'] loop
    execute format('create trigger audit after insert or update or delete on %s for each row execute function audit.protokollieren()', t);
  end loop;
end $$;

grant select, insert, update on app.rechnungssteller, app.kunde, app.rechnung, app.rechnungsnummer, app.beleg, app.kasse to amtlos_app;
grant delete on app.rechnung, app.kunde to amtlos_app;   -- Entwürfe; der Trigger schützt Gestelltes
-- Worker liest Rechnungen und Belege für Fakten (Umsatz laufendes Jahr) und Erinnerungen
grant select on app.rechnung, app.beleg, app.kasse to amtlos_worker;
do $$
declare t text;
begin
  foreach t in array array['rechnung','beleg','kasse'] loop
    execute format($p$create policy worker on app.%I to amtlos_worker using (unternehmen_id = app.aktuelles_unternehmen())$p$, t);
  end loop;
end $$;
