-- =====================================================================
-- 0006 · Audit ohne reproduzierbare Großfelder (E-085)
--
-- Der Begründungsbaum einer Pflichtinstanz (begruendung) und die Fakten eines Berechnungslaufs lassen sich aus
-- Profilversion + Release jederzeit neu erzeugen. Im Audit stehen sie nicht mehr; Status, Fälligkeit, Erledigung,
-- wer und wann bleiben vollständig protokolliert. Der Lasttest zeigte: der Baum machte den Großteil des Audit-Volumens aus.
-- Die Hash-Kette bleibt unverändert (gehasht wird, was gespeichert wird).
-- =====================================================================
create or replace function audit.protokollieren() returns trigger language plpgsql security definer set search_path = audit, app, pg_temp as $$
declare
  alt jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'begruendung' - 'fakten' end;
  neu jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) - 'begruendung' - 'fakten' end;
  diff jsonb;
  vorher bytea;
  zeile jsonb := coalesce(neu, alt);
begin
  diff := case tg_op
    when 'UPDATE' then (select jsonb_object_agg(k, jsonb_build_array(alt->k, neu->k))
                        from jsonb_object_keys(neu) k where alt->k is distinct from neu->k)
    else coalesce(neu, alt) end;
  -- Ein Update, das nur ausgeblendete Felder ändert, hinterlässt keinen leeren Eintrag
  if tg_op = 'UPDATE' and diff is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext('audit.kette'));
  select hash into vorher from audit.ereignis order by id desc limit 1;
  insert into audit.ereignis (konto_id, unternehmen_id, aktion, objekt, objekt_id, aenderung, vorgaenger_hash, hash)
  values (app.aktuelles_konto(), nullif(zeile->>'unternehmen_id','')::uuid, lower(tg_op),
          tg_table_schema || '.' || tg_table_name, zeile->>'id', diff, vorher,
          public.digest(coalesce(vorher, '\x'::bytea) || convert_to(coalesce(diff::text,'') || tg_op || tg_table_name || coalesce(zeile->>'id',''), 'UTF8'), 'sha256'));
  return null;
end $$;
