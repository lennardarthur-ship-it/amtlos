-- =====================================================================
-- 0021 · Runde 12 (Nutzertest Kfz-Werkstatt): neuer Katalogbereich „Umwelt und Abfall“
-- (Gewerbeabfall, gefährliche Abfälle, Altöl, Abscheider, Klimaanlagen-Sachkunde).
-- =====================================================================

alter type katalog.kategorie add value if not exists 'umwelt';
