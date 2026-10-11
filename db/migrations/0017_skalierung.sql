-- =====================================================================
-- 0017 · Bauabschnitt 10: Skalierung (E-109)
--
-- Jede Mandantentabelle wird über RLS nach unternehmen_id gefiltert. Ohne Index beginnt jede Abfrage mit einem
-- vollständigen Durchlauf über alle Mandanten – bei 100.000 Unternehmen nicht tragbar. Der Lasttest fand das an
-- app.erinnerung (3 ms je Abfrage bei 2.000 Unternehmen). Ein Schematest prüft künftig, dass jede Tabelle mit
-- unternehmen_id einen Index mit dieser Spalte vorne hat.
-- =====================================================================
create index erinnerung_unternehmen on app.erinnerung (unternehmen_id, status);
create index berechnungslauf_unternehmen on app.berechnungslauf (unternehmen_id, gestartet_am desc);
create index benachrichtigung_unternehmen on app.benachrichtigung (unternehmen_id, konto_id, erstellt_am desc);
create index dokument_unternehmen on app.dokument (unternehmen_id, erstellt_am desc);
create index nachweis_unternehmen on app.nachweis (unternehmen_id);
create index einladung_unternehmen on app.einladung (unternehmen_id);
create index kalender_abo_unternehmen on app.kalender_abo (unternehmen_id);
create index kasse_unternehmen on app.kasse (unternehmen_id);
create index kunde_unternehmen on app.kunde (unternehmen_id);
create index unterweisung_unternehmen on app.unterweisung (unternehmen_id);
create index unterweisung_teilnahme_unternehmen on app.unterweisung_teilnahme (unternehmen_id);
create index gefaehrdungsbeurteilung_unternehmen on app.gefaehrdungsbeurteilung (unternehmen_id);
create index gefaehrdung_unternehmen on app.gefaehrdung (unternehmen_id);
create index arbeitsmittel_unternehmen on app.arbeitsmittel (unternehmen_id);
create index arbeitsmittel_pruefung_unternehmen on app.arbeitsmittel_pruefung (unternehmen_id);
create index gefahrstoff_unternehmen on app.gefahrstoff (unternehmen_id);
create index verarbeitung_unternehmen on app.verarbeitung (unternehmen_id);
create index tom_unternehmen on app.tom (unternehmen_id);
create index dienstleister_unternehmen on app.dienstleister (unternehmen_id);
create index betroffenenanfrage_unternehmen on app.betroffenenanfrage (unternehmen_id);
create index datenpanne_unternehmen on app.datenpanne (unternehmen_id);
create index messpunkt_unternehmen on app.messpunkt (unternehmen_id);
create index gericht_unternehmen on app.gericht (unternehmen_id);
create index marktplatz_anfrage_unternehmen on app.marktplatz_anfrage (unternehmen_id);
