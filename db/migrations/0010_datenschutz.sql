-- =====================================================================
-- 0010 · Datenschutz, IT-Sicherheit, KI (Bauabschnitt 6, Spezifikation 6.7, Katalog F)
--
-- VVT, TOM, Dienstleister mit AVV, Betroffenenanfragen mit Fristuhr, Datenpannen mit 72-Stunden-Countdown
-- und Dokumentation (auch nicht meldepflichtige Pannen), Schulungen (KI-Kompetenz) über das Unterweisungsmodul.
-- Inhalte (Zwecke, Rechtsgrundlagen, Maßnahmen) trägt der Betrieb ein; Amtlos gibt die Struktur vor (E-095).
-- =====================================================================

-- ---------- Verzeichnis der Verarbeitungstätigkeiten (Art. 30) ----------
create table app.verarbeitung (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  bezeichnung        text not null,
  zweck              text not null default '',
  rechtsgrundlage    text not null default '',
  betroffene         text not null default '',   -- Kategorien betroffener Personen
  datenarten         text not null default '',   -- Kategorien personenbezogener Daten
  empfaenger         text not null default '',
  drittland          text not null default '',   -- leer = keine Übermittlung
  loeschfrist        text not null default '',
  tom_hinweis        text not null default '',   -- Verweis auf die TOM
  aktiv              boolean not null default true,
  aktualisiert_am    timestamptz not null default now(),
  erstellt_am        timestamptz not null default now()
);

-- ---------- Technische und organisatorische Maßnahmen (Art. 32) ----------
create table app.tom (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  schutzziel         text not null check (schutzziel in ('pseudonymisierung_verschluesselung','vertraulichkeit','integritaet','verfuegbarkeit_belastbarkeit','wiederherstellung','ueberpruefung','sonstiges')),
  massnahme          text not null,
  umgesetzt_am       date,
  verantwortlich     text,
  erstellt_am        timestamptz not null default now()
);

-- ---------- Dienstleister und Auftragsverarbeitungsverträge (Art. 28) ----------
create table app.dienstleister (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  name               text not null,
  leistung           text not null default '',
  auftragsverarbeitung boolean not null default true,  -- false: eigene Verantwortung (z. B. Steuerberatung)
  avv_datum          date,
  avv_dokument_id    uuid references app.dokument(id),
  drittland          text not null default '',
  beendet_am         date,
  erstellt_am        timestamptz not null default now()
);

-- ---------- Betroffenenanfragen (Art. 12, 15–22) ----------
create table app.betroffenenanfrage (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  eingang_am         date not null,
  art                text not null check (art in ('auskunft','berichtigung','loeschung','einschraenkung','uebertragbarkeit','widerspruch','sonstiges')),
  person             text not null,                -- nur so viel, wie zur Bearbeitung nötig (Name/Kontakt)
  frist_am           date not null,                -- Eingang + 1 Monat (Spezifikation F.59)
  notiz              text,
  erledigt_am        date,
  antwort            text,                         -- kurze Beschreibung der Antwort
  ereignis_id        uuid references app.ereignis(id),
  erfasst_von        uuid references app.konto(id),
  erstellt_am        timestamptz not null default now(),
  check (erledigt_am is null or erledigt_am >= eingang_am)
);

-- ---------- Datenpannen (Art. 33) ----------
create table app.datenpanne (
  id                 uuid primary key default gen_random_uuid(),
  unternehmen_id     uuid not null references app.unternehmen(id),
  entdeckt_am        timestamptz not null,
  beschreibung       text not null,
  datenarten         text not null default '',
  betroffene_anzahl  text not null default '',     -- „ca. 120 Kundinnen und Kunden“
  folgen             text not null default '',     -- wahrscheinliche Folgen
  massnahmen         text not null default '',
  risiko             text check (risiko in ('kein_risiko','risiko','hohes_risiko')), -- Bewertung, null = noch offen
  begruendung        text,                         -- Pflicht bei „kein_risiko“ (Dokumentation statt Meldung)
  gemeldet_am        timestamptz,
  aktenzeichen       text,
  abgeschlossen_am   timestamptz,
  ereignis_id        uuid references app.ereignis(id),
  erfasst_von        uuid references app.konto(id),
  erstellt_am        timestamptz not null default now(),
  check (risiko is distinct from 'kein_risiko' or begruendung is not null)
);

-- Dokumentationspflicht: Pannen werden nicht gelöscht; nach dem Abschluss unveränderlich.
create function app.datenpanne_schutz() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'datenpanne_unveraenderlich: Pannen werden dokumentiert, nicht gelöscht'; end if;
  if old.abgeschlossen_am is not null then raise exception 'datenpanne_unveraenderlich: abgeschlossen'; end if;
  if new.entdeckt_am <> old.entdeckt_am then raise exception 'datenpanne_unveraenderlich: Zeitpunkt der Entdeckung'; end if;
  return new;
end $$;
create trigger datenpanne_schutz before update or delete on app.datenpanne for each row execute function app.datenpanne_schutz();

-- ---------- Schulungen: Unterweisungen bekommen eine Art ----------
alter table app.unterweisung add column art text not null default 'arbeitsschutz' check (art in ('arbeitsschutz','ki_kompetenz','datenschutz'));

-- ---------- RLS, Audit, Rechte ----------
do $$
declare t text;
begin
  foreach t in array array['verarbeitung','tom','dienstleister','betroffenenanfrage','datenpanne'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('alter table app.%I force row level security', t);
    execute format($p$create policy mandant on app.%I
                     using (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))
                     with check (unternehmen_id = app.aktuelles_unternehmen() and app.ist_mitglied(unternehmen_id))$p$, t);
    execute format('create trigger audit after insert or update or delete on app.%I for each row execute function audit.protokollieren()', t);
  end loop;
end $$;

grant select, insert, update on app.verarbeitung, app.tom, app.dienstleister, app.betroffenenanfrage, app.datenpanne to amtlos_app;
grant delete on app.tom to amtlos_app;
