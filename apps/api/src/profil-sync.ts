import type { Tx } from "@amtlos/server";

/**
 * Profilversionen eines Unternehmens nacheinander vergeben (M1): Sperre bis zum Ende der Transaktion. Ohne sie
 * scheitern parallele Speichervorgänge an unique (unternehmen_id, version) mit einem irreführenden „Existiert bereits“.
 */
export async function profilSperren(tx: Tx, unternehmenId: string): Promise<void> {
  await tx.abfrage("select pg_advisory_xact_lock(hashtext('profil:' || $1))", [unternehmenId]);
}

/**
 * Profilangaben aus einem Modul nachziehen (Kassen, Beschäftigte): neue Profilversion nur bei Änderung (nie überschreiben, E-018).
 * Gibt true zurück, wenn eine neue Version entstand.
 */
export async function profilNachziehen(tx: Tx, unternehmenId: string, kontoId: string, aenderung: Record<string, unknown>): Promise<boolean> {
  await profilSperren(tx, unternehmenId);
  const p = await tx.eine<{ version: number; daten: Record<string, unknown> }>(
    "select version, daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1",
    [unternehmenId],
  );
  const alt = p?.daten ?? {};
  if (Object.entries(aenderung).every(([k, v]) => alt[k] === v)) return false;
  await tx.abfrage("insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values ($1, $2, $3, $4)", [
    unternehmenId, (p?.version ?? 0) + 1, { ...alt, ...aenderung }, kontoId,
  ]);
  return true;
}
