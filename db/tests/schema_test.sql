-- Schema-Tests: Mandantentrennung, Unveränderlichkeit, Vier-Augen-Freigabe, prod-Gate, Audit.
-- Ausführung: db/tests/run.sh (frische Datenbank, Schema als Nicht-Superuser-Eigentümer).
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function pg_temp.erwarte_fehler(sql text, muster text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ERWARTETER FEHLER BLIEB AUS: %', sql;
exception when others then
  if sqlerrm like 'ERWARTETER FEHLER BLIEB AUS%' then raise; end if;
  if sqlerrm not ilike '%' || muster || '%' then raise exception 'Falscher Fehler für %: %', sql, sqlerrm; end if;
end $$;
create or replace function pg_temp.ok(bedingung boolean, name text) returns void language plpgsql as $$
begin
  if not bedingung then raise exception 'TEST FEHLGESCHLAGEN: %', name; end if;
  raise notice 'ok  %', name;
end $$;

-- ---------- Setup: Katalog (als Studio) ----------
-- Konten werden über die Anmeldefunktion angelegt (wie im Login-Flow)
set role api_user;
select app.konto_anmelden('sub-anna',  'anna@example.org',  'Anna')  \gset anna_
select app.konto_anmelden('sub-ben',   'ben@example.org',   'Ben')   \gset ben_
select app.konto_anmelden('sub-pia',   'pia@example.org',   'Pia (StB)')   \gset pia_
select app.konto_anmelden('sub-ralf',  'ralf@example.org',  'Ralf')  \gset ralf_
reset role;

-- Qualifikation nur für Pia (Steuerberaterin); Anlage als Eigentümer (Plattform-Admin-Prozess)
insert into katalog.experte_qualifikation values (:'pia_konto_anmelden', 'steuerberater', 'StBK Test 123', null);

set role studio_user;
insert into katalog.pflicht values ('steuern.ust_voranmeldung', 'steuern');
insert into katalog.pflicht_version (pflicht_id, version, daten, status_recht, erstellt_von)
  values ('steuern.ust_voranmeldung', 1, '{"id":"steuern.ust_voranmeldung","version":1}', 'in_kraft', :'anna_konto_anmelden')
  returning id as pv_id \gset
insert into katalog.regelwert values ('steuern.ust_va.grenze_monatlich', 'EUR', '{"de":"Grenze"}');
insert into katalog.regelwert_version (regelwert_id, version, wert, gueltig_ab, gueltig_bis, status_recht, daten, erstellt_von)
  values ('steuern.ust_va.grenze_monatlich', 1, 9000, '2026-01-01', null, 'in_kraft', '{}', :'anna_konto_anmelden'),
         ('steuern.ust_va.grenze_monatlich', 2, 9500, '2026-06-01', null, 'entwurf',  '{}', :'anna_konto_anmelden');

-- Freigabe: Autorin darf nicht selbst prüfen
select pg_temp.erwarte_fehler(format($$insert into katalog.freigabe (objekt_art, objekt_id, pruefer_id, entscheidung) values ('pflicht_version', %L, %L, 'freigegeben')$$, :'pv_id', :'anna_konto_anmelden'), 'eigene Version');
select pg_temp.ok(true, 'Autor kann eigene Version nicht freigeben');
-- Qualifikation muss hinterlegt sein
select pg_temp.erwarte_fehler(format($$insert into katalog.freigabe (objekt_art, objekt_id, pruefer_id, qualifikation, entscheidung) values ('pflicht_version', %L, %L, 'steuerberater', 'freigegeben')$$, :'pv_id', :'ralf_konto_anmelden'), 'nicht hinterlegt');
select pg_temp.ok(true, 'Nicht hinterlegte Qualifikation wird abgelehnt');
-- Status freigegeben ohne Freigaben
select pg_temp.erwarte_fehler(format($$update katalog.pflicht_version set pruef_status='freigegeben' where id=%L$$, :'pv_id'), 'Vier-Augen');
select pg_temp.ok(true, 'Status freigegeben ohne Freigaben wird abgelehnt');
-- Eine Freigabe reicht nicht
insert into katalog.freigabe (objekt_art, objekt_id, pruefer_id, qualifikation, entscheidung) values ('pflicht_version', :'pv_id', :'pia_konto_anmelden', 'steuerberater', 'freigegeben');
select pg_temp.erwarte_fehler(format($$update katalog.pflicht_version set pruef_status='freigegeben' where id=%L$$, :'pv_id'), 'Vier-Augen');
select pg_temp.ok(true, 'Eine Freigabe reicht nicht');
insert into katalog.freigabe (objekt_art, objekt_id, pruefer_id, entscheidung) values ('pflicht_version', :'pv_id', :'ralf_konto_anmelden', 'freigegeben');
update katalog.pflicht_version set pruef_status='freigegeben' where id = :'pv_id';
select pg_temp.ok((select pruef_status = 'freigegeben' from katalog.pflicht_version where id = :'pv_id'), 'Zwei Freigaben, eine qualifiziert → freigegeben');
select pg_temp.ok((select geprueft_von = array['Pia (StB)','Ralf'] and geprueft_am is not null from katalog.pflicht_version_pruefung where id = :'pv_id'), 'geprueft_von/geprueft_am abgeleitet');
select pg_temp.erwarte_fehler(format($$update katalog.pflicht_version set daten='{"id":"steuern.ust_voranmeldung","version":1,"x":1}' where id=%L$$, :'pv_id'), 'unveränderlich');
select pg_temp.ok(true, 'Freigegebene Version ist unveränderlich');

-- Regelwert-Überlappung bei freigegebenen Versionen
select id as rw1 from katalog.regelwert_version where regelwert_id='steuern.ust_va.grenze_monatlich' and version=1 \gset
select id as rw2 from katalog.regelwert_version where regelwert_id='steuern.ust_va.grenze_monatlich' and version=2 \gset
insert into katalog.freigabe (objekt_art, objekt_id, pruefer_id, qualifikation, entscheidung) values
  ('regelwert_version', :'rw1', :'pia_konto_anmelden', 'steuerberater', 'freigegeben'),
  ('regelwert_version', :'rw1', :'ralf_konto_anmelden', null, 'freigegeben'),
  ('regelwert_version', :'rw2', :'pia_konto_anmelden', 'steuerberater', 'freigegeben'),
  ('regelwert_version', :'rw2', :'ralf_konto_anmelden', null, 'freigegeben');
update katalog.regelwert_version set pruef_status='freigegeben' where id = :'rw1';
select pg_temp.erwarte_fehler(format($$update katalog.regelwert_version set pruef_status='freigegeben' where id=%L$$, :'rw2'), 'exclusion');
select pg_temp.ok(true, 'Überlappende freigegebene Regelwerte werden abgelehnt');

-- prod-Gate für Releases
insert into katalog.release (nummer, erstellt_von) values (1, :'anna_konto_anmelden') returning id as rel_id \gset
reset role;
update katalog.plattform set umgebung = 'prod';
set role studio_user;
select pg_temp.erwarte_fehler(format($$insert into katalog.release_inhalt values (%L, 'regelwert_version', %L)$$, :'rel_id', :'rw2'), 'nicht freigegeben');
select pg_temp.ok(true, 'prod: ungeprüfter Inhalt kann nicht ins Release');
-- Dienst kann die Umgebung weder per Sitzungsvariable noch per Update umgehen (0003)
select set_config('amtlos.umgebung', 'dev', false);
select pg_temp.erwarte_fehler(format($$insert into katalog.release_inhalt values (%L, 'regelwert_version', %L)$$, :'rel_id', :'rw2'), 'nicht freigegeben');
select pg_temp.erwarte_fehler($$update katalog.plattform set umgebung = 'dev'$$, 'permission denied');
select pg_temp.ok(true, 'Umgebung lässt sich von Diensten nicht umstellen');
insert into katalog.release_inhalt values (:'rel_id', 'pflicht_version', :'pv_id');
reset role;
update katalog.plattform set umgebung = 'dev';
set role studio_user;
insert into katalog.release_inhalt values (:'rel_id', 'regelwert_version', :'rw2');
select pg_temp.ok(true, 'dev: ungeprüfter Inhalt erlaubt (E-038)');
update katalog.release set veroeffentlicht_am = now() where id = :'rel_id';

-- Studio sieht keine Mandantendaten
select pg_temp.erwarte_fehler('select count(*) from app.profil_version', 'permission denied');
select pg_temp.ok(true, 'Studio-Rolle hat keinen Zugriff auf Mandantendaten');
reset role;

-- ---------- Mandanten ----------
set role api_user;
select set_config('amtlos.konto_id', :'anna_konto_anmelden', false);
select app.unternehmen_anlegen('Anna Design') as u1 \gset
select set_config('amtlos.unternehmen_id', :'u1', false);
insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values (:'u1', 1, '{"rechtsform":"freiberuf","bundesland":"BE"}', :'anna_konto_anmelden') returning id as pv1 \gset
insert into app.ereignis (unternehmen_id, typ, eingetreten_am, quelle, erfasst_von) values (:'u1', 'gruendung', '2025-03-01', 'nutzer', :'anna_konto_anmelden') returning id as ev1 \gset
insert into app.berechnungslauf (unternehmen_id, release_id, profil_version_id, stichtag, ausgeloest_durch, fakten, fakten_hash, engine_version)
  values (:'u1', :'rel_id', :'pv1', current_date, 'profil', '{}', '\x00', '0.0.0') returning id as lauf1 \gset
insert into app.pflicht_instanz (unternehmen_id, pflicht_id, pflicht_version_id, periode, ergebnis, faellig_am, begruendung, letzter_lauf_id) values
  (:'u1', 'steuern.ust_voranmeldung', :'pv_id', '2026-08', 'gilt', current_date - 1,  '{}', :'lauf1'),
  (:'u1', 'steuern.ust_voranmeldung', :'pv_id', '2026-09', 'gilt', current_date + 5,  '{}', :'lauf1'),
  (:'u1', 'steuern.ust_voranmeldung', :'pv_id', '2026-10', 'gilt', current_date + 40, '{}', :'lauf1'),
  (:'u1', 'steuern.ust_voranmeldung', :'pv_id', '2026-11', 'unbekannt', current_date + 70, '{}', :'lauf1');
select pg_temp.ok((select array_agg(anzeige_status order by periode) = array['ueberfaellig','faellig_bald','offen','angabe_fehlt'] from app.pflicht_instanz_anzeige), 'Anzeigestatus berechnet (überfällig, bald, offen, Angabe fehlt)');
select pg_temp.erwarte_fehler($$insert into app.pflicht_instanz (unternehmen_id, pflicht_id, pflicht_version_id, periode, ergebnis, begruendung, letzter_lauf_id) values (current_setting('amtlos.unternehmen_id')::uuid, 'steuern.ust_voranmeldung', (select id from katalog.pflicht_version limit 1), '2026-13', 'gilt', '{}', (select id from app.berechnungslauf limit 1))$$, 'check');
select pg_temp.ok(true, 'Ungültige Periode wird abgelehnt');
select pg_temp.erwarte_fehler(format($$update app.pflicht_instanz set status='erledigt' where periode='2026-08'$$), 'check');
select pg_temp.ok(true, 'Erledigt ohne Zeitpunkt/Version wird abgelehnt');
update app.pflicht_instanz set status='erledigt', erledigt_am=now(), erledigt_von=:'anna_konto_anmelden', erledigt_mit_version_id=:'pv_id' where periode='2026-08';

-- Ereignisse sind append-only
select pg_temp.erwarte_fehler(format($$update app.ereignis set typ='x' where id=%L$$, :'ev1'), 'append-only');
select pg_temp.erwarte_fehler(format($$delete from app.ereignis where id=%L$$, :'ev1'), 'permission denied');  -- App-Rolle hat gar kein DELETE; Trigger greift zusätzlich
select pg_temp.ok(true, 'Ereignisse unveränderlich');

-- Ben, zweites Unternehmen
select set_config('amtlos.konto_id', :'ben_konto_anmelden', false);
select set_config('amtlos.unternehmen_id', '', false);
select app.unternehmen_anlegen('Ben Bau GmbH') as u2 \gset
select set_config('amtlos.unternehmen_id', :'u2', false);
insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values (:'u2', 1, '{"rechtsform":"gmbh"}', :'ben_konto_anmelden');
select pg_temp.ok((select count(*) = 1 from app.profil_version), 'Ben sieht nur sein Profil');
select pg_temp.ok((select count(*) = 0 from app.pflicht_instanz), 'Ben sieht keine Pflichten von Anna');
select pg_temp.ok((select count(*) = 1 from app.unternehmen), 'Ben sieht nur sein Unternehmen');
select pg_temp.ok((select count(*) = 1 from app.konto), 'Ben sieht nur sein eigenes Konto');

-- Ben setzt fremde Unternehmens-ID in den Kontext
select set_config('amtlos.unternehmen_id', :'u1', false);
select pg_temp.ok((select count(*) = 0 from app.profil_version), 'Fremde Unternehmens-ID im Kontext liefert nichts');
select pg_temp.erwarte_fehler(format($$insert into app.ereignis (unternehmen_id, typ, eingetreten_am, quelle) values (%L, 'gruendung', '2026-01-01', 'nutzer')$$, :'u1'), 'row-level security');
select pg_temp.ok(true, 'Schreiben in fremdes Unternehmen blockiert');
select pg_temp.erwarte_fehler(format($$insert into app.mitgliedschaft values (%L, %L, 'admin')$$, :'u1', :'ben_konto_anmelden'), 'row-level security');
select pg_temp.ok(true, 'Selbst-Einladung in fremdes Unternehmen blockiert');
-- Mitarbeiter darf keine Mitglieder verwalten
select set_config('amtlos.unternehmen_id', :'u2', false);
select set_config('amtlos.konto_id', :'ralf_konto_anmelden', false);
reset role; insert into app.mitgliedschaft values (:'u2', :'ralf_konto_anmelden', 'mitarbeiter'); set role api_user;
select pg_temp.erwarte_fehler(format($$insert into app.mitgliedschaft values (%L, %L, 'admin')$$, :'u2', :'pia_konto_anmelden'), 'row-level security');
update app.mitgliedschaft set rolle='inhaber' where konto_id = :'ralf_konto_anmelden';   -- RLS: wirkt auf 0 Zeilen
select pg_temp.ok((select rolle = 'mitarbeiter' from app.mitgliedschaft where konto_id = :'ralf_konto_anmelden'), 'Mitarbeiter kann weder einladen noch sich hochstufen');
select set_config('amtlos.konto_id', :'ben_konto_anmelden', false);

-- Ohne Kontext sieht man nichts
select set_config('amtlos.konto_id', '', false);
select set_config('amtlos.unternehmen_id', '', false);
select pg_temp.ok((select count(*) = 0 from app.profil_version) and (select count(*) = 0 from app.konto), 'Ohne Kontext keine Daten');

-- Anna lädt Ben als Steuerberater ein → Ben sieht dann auch Annas Konto
select set_config('amtlos.konto_id', :'anna_konto_anmelden', false);
select set_config('amtlos.unternehmen_id', :'u1', false);
insert into app.mitgliedschaft values (:'u1', :'ben_konto_anmelden', 'steuerberater');
select set_config('amtlos.konto_id', :'ben_konto_anmelden', false);
select pg_temp.ok((select count(*) = 1 from app.profil_version), 'Nach Einladung sieht Ben Annas Profil (im Kontext U1)');
select pg_temp.ok((select count(*) = 2 from app.konto), 'Ben sieht Konten des aktuellen Unternehmens (kontextbezogen)');
select pg_temp.erwarte_fehler('select count(*) from audit.ereignis', 'permission denied');
select pg_temp.ok(true, 'App-Rolle kann Audit nicht lesen');
reset role;

-- ---------- Worker (0002) ----------
set role worker_user;
select set_config('amtlos.konto_id', '', false);
select set_config('amtlos.unternehmen_id', '', false);
select pg_temp.ok((select count(*) = 0 from app.profil_version) and (select count(*) = 0 from app.unternehmen), 'Worker ohne Kontext sieht nichts');
select pg_temp.ok((select count(*) = 2 from app.aktive_unternehmen_ids()), 'Worker kennt die Unternehmens-IDs');
select set_config('amtlos.unternehmen_id', :'u1', false);
select pg_temp.ok((select count(*) = 1 from app.profil_version) and (select bool_and(unternehmen_id = :'u1') from app.pflicht_instanz), 'Worker sieht genau das Unternehmen im Kontext');
select pg_temp.ok((select count(*) = 2 from app.konto), 'Worker sieht nur Konten der Mitglieder dieses Unternehmens');
select pg_temp.erwarte_fehler(format($$insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values (%L, 9, '{}', %L)$$, :'u1', :'anna_konto_anmelden'), 'permission denied');
select pg_temp.ok(true, 'Worker kann Profile nicht ändern');
select pg_temp.erwarte_fehler(format($$insert into app.pflicht_instanz (unternehmen_id, pflicht_id, pflicht_version_id, periode, ergebnis, begruendung, letzter_lauf_id) values (%L, 'steuern.ust_voranmeldung', %L, '2027-01', 'gilt', '{}', %L)$$, :'u2', :'pv_id', :'lauf1'), 'row-level security');
select pg_temp.ok(true, 'Worker kann nicht in fremdes Unternehmen schreiben');
reset role;

-- ---------- Personal (0008) ----------
set role api_user;
select set_config('amtlos.konto_id', :'anna_konto_anmelden', false);
select set_config('amtlos.unternehmen_id', :'u1', false);
insert into app.beschaeftigter (unternehmen_id, vorname, nachname, art, eintritt) values (:'u1', 'Tom', 'Teig', 'minijob', '2026-11-01') returning id as b1 \gset
insert into app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn, quelle) values (:'u1', :'b1', '2026-11-02 08:00+01', 'stempel') returning id as z1 \gset
select pg_temp.erwarte_fehler(format($$insert into app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn, quelle) values (%L, %L, now(), 'stempel')$$, :'u1', :'b1'), 'zeiteintrag_offen');
select pg_temp.ok(true, 'Höchstens ein offener Stempel je Person');
update app.zeiteintrag set ende = '2026-11-02 12:00+01', pause_minuten = 15 where id = :'z1';
select pg_temp.ok((select ende is not null from app.zeiteintrag where id = :'z1'), 'Offenen Stempel einmal schließen ist erlaubt');
select pg_temp.erwarte_fehler(format($$update app.zeiteintrag set pause_minuten = 0 where id = %L$$, :'z1'), 'zeiteintrag_unveraenderlich');
select pg_temp.erwarte_fehler(format($$update app.zeiteintrag set beginn = beginn - interval '1 hour', ende = null where id = %L$$, :'z1'), 'zeiteintrag_unveraenderlich');
select pg_temp.erwarte_fehler(format($$delete from app.zeiteintrag where id = %L$$, :'z1'), 'permission denied');
select pg_temp.ok(true, 'Geschlossene Zeiteinträge sind unveränderlich und nicht löschbar');
select pg_temp.erwarte_fehler(format($$insert into app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn, ende, quelle) values (%L, %L, now() - interval '1 hour', now(), 'nachtrag')$$, :'u1', :'b1'), 'check constraint');
select pg_temp.ok(true, 'Nachtrag ohne Grund abgelehnt');
insert into app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn, ende, quelle, ersetzt_id, grund) values (:'u1', :'b1', '2026-11-02 08:00+01', '2026-11-02 12:30+01', 'korrektur', :'z1', 'Ende falsch');
select pg_temp.ok((select count(*) = 1 from app.zeiteintrag_gueltig) and (select count(*) = 2 from app.zeiteintrag), 'Korrektur ersetzt in der Sicht, Verlauf bleibt');
insert into app.unterweisung (unternehmen_id, thema, inhalt, datum, durchgefuehrt_von, inhalt_sha256) values (:'u1', 'Backstube', 'Ofen', '2026-11-01', 'Anna', sha256(convert_to('Backstube' || chr(10) || 'Ofen', 'UTF8'))) returning id as w1 \gset
update app.unterweisung set inhalt = 'Ofen und Fluchtwege', inhalt_sha256 = sha256('\x78'::bytea) where id = :'w1';
select pg_temp.ok(true, 'Unbestätigte Unterweisung ist änderbar');
insert into app.unterweisung_teilnahme (unternehmen_id, unterweisung_id, beschaeftigter_id, name_bestaetigt, inhalt_sha256) values (:'u1', :'w1', :'b1', 'Tom Teig', sha256('\x78'::bytea));
select pg_temp.erwarte_fehler(format($$update app.unterweisung set inhalt_sha256 = sha256('\x79'::bytea) where id = %L$$, :'w1'), 'Inhalt bereits bestätigt');
select pg_temp.erwarte_fehler(format($$delete from app.unterweisung where id = %L$$, :'w1'), 'unterweisung_unveraenderlich');
select pg_temp.erwarte_fehler('update app.unterweisung_teilnahme set name_bestaetigt = $$x$$', 'append-only');
update app.unterweisung set abgeschlossen_am = now() where id = :'w1';
select pg_temp.erwarte_fehler(format($$update app.unterweisung set thema = 'neu' where id = %L$$, :'w1'), 'unterweisung_unveraenderlich');
select pg_temp.ok(true, 'Bestätigte/abgeschlossene Unterweisungen und Bestätigungen sind geschützt');
select set_config('amtlos.konto_id', :'ben_konto_anmelden', false);
select set_config('amtlos.unternehmen_id', :'u2', false);
select pg_temp.ok((select count(*) = 0 from app.beschaeftigter) and (select count(*) = 0 from app.zeiteintrag) and (select count(*) = 0 from app.unterweisung), 'Personaldaten sind mandantengetrennt');
reset role;

-- ---------- Audit ----------
select pg_temp.ok((select count(*) > 10 from audit.ereignis), 'Audit protokolliert Änderungen');
select pg_temp.ok((select bool_and(vorgaenger_hash is not null) from audit.ereignis where id > (select min(id) from audit.ereignis)), 'Hash-Kette lückenlos');
select pg_temp.erwarte_fehler('update audit.ereignis set aktion = $$x$$', 'append-only');
select pg_temp.ok(true, 'Audit unveränderlich');

\echo 'ALLE SCHEMA-TESTS BESTANDEN'
