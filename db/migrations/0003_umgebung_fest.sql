-- =====================================================================
-- 0003 · Umgebung fest in der Datenbank (Härtung von E-038)
--
-- Bisher las katalog.umgebung() die Sitzungsvariable amtlos.umgebung. Die kann jede Verbindung selbst
-- setzen – ein kompromittierter Dienst hätte sich „dev“ geben und ungeprüfte Inhalte veröffentlichen können.
-- Jetzt steht die Umgebung in einer Tabelle, die nur der Eigentümer ändert (beim Deploy:
-- amtlos-server umgebung prod). Dienste können sie lesen, nicht ändern.
-- =====================================================================

create table katalog.plattform (
  id        boolean primary key default true check (id),
  umgebung  text not null default 'dev' check (umgebung in ('dev', 'test', 'staging', 'prod'))
);
insert into katalog.plattform default values;
grant select on katalog.plattform to amtlos_app, amtlos_studio, amtlos_worker;

create or replace function katalog.umgebung() returns text
  language sql stable as $$ select umgebung from katalog.plattform $$;

-- Studio braucht Lesezugriff auf neue Katalogtabellen künftig automatisch
alter default privileges in schema katalog grant select on tables to amtlos_app, amtlos_studio, amtlos_worker;
