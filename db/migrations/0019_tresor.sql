-- =====================================================================
-- 0019 · Ende-zu-Ende-verschlüsselte Synchronisation der iPhone-App (E-134)
-- =====================================================================
-- Der Server speichert nur Chiffretext: den Stand der App, verschlüsselt mit einem zufälligen Sync-Schlüssel, und den
-- Sync-Schlüssel selbst, verschlüsselt mit einem Schlüssel aus dem Sync-Passwort (PBKDF2). Das Passwort kennt nur die
-- Nutzerin. Ohne Passwort lässt sich nichts entschlüsseln – auch nicht von Amtlos.
-- Kein Audit-Trigger: der Inhalt ist verschlüsselt und groß; protokolliert würde nur Chiffretext.

create table app.tresor (
  konto_id     uuid primary key references app.konto(id),
  version      bigint not null default 0 check (version >= 0),
  -- Sync-Schlüssel, mit dem Passwort verschlüsselt (JSON: kdf, Salz, Nonce, Chiffre)
  schluessel   text not null check (length(schluessel) between 20 and 4000),
  -- Stand der App, mit dem Sync-Schlüssel verschlüsselt; null bis zum ersten Hochladen
  daten        text check (daten is null or length(daten) <= 30000000),
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
alter table app.tresor enable row level security;
alter table app.tresor force row level security;
create policy eigenes_konto on app.tresor to amtlos_app
  using (konto_id = app.aktuelles_konto()) with check (konto_id = app.aktuelles_konto());
create policy systemfunktion on app.tresor to amtlos_owner using (true) with check (true);
grant select, insert, update, delete on app.tresor to amtlos_app;

-- Dateien zu Belegen (Fotos, PDFs, E-Rechnungen), je einzeln verschlüsselt; der Name ist zufällig und unveränderlich
create table app.tresor_datei (
  konto_id     uuid not null references app.konto(id),
  name         text not null check (name ~ '^[A-Za-z0-9_-]{4,64}\.[a-z0-9]{1,8}$'),
  daten        text not null check (length(daten) <= 15000000),
  erstellt_am  timestamptz not null default now(),
  primary key (konto_id, name)
);
alter table app.tresor_datei enable row level security;
alter table app.tresor_datei force row level security;
create policy eigenes_konto on app.tresor_datei to amtlos_app
  using (konto_id = app.aktuelles_konto()) with check (konto_id = app.aktuelles_konto());
create policy systemfunktion on app.tresor_datei to amtlos_owner using (true) with check (true);
grant select, insert, delete on app.tresor_datei to amtlos_app;

-- Konto löschen entfernt auch die synchronisierten Daten (verschlüsselt, ohne Aufbewahrungspflicht beim Server –
-- die Aufbewahrung liegt beim Betrieb auf dem Gerät)
create or replace function app.konto_loeschen() returns void
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
  delete from app.tresor_datei where konto_id = ich;
  delete from app.tresor where konto_id = ich;
end $$;
revoke all on function app.konto_loeschen() from public;
grant execute on function app.konto_loeschen() to amtlos_app;
