import type { Tx } from "@amtlos/server";

/**
 * Profilangaben aus einem Modul nachziehen (Kassen, Beschäftigte): neue Profilversion nur bei Änderung (nie überschreiben, E-018).
 * Gibt true zurück, wenn eine neue Version entstand.
 */
export async function profilNachziehen(tx: Tx, unternehmenId: string, kontoId: string, aenderung: Record<string, unknown>): Promise<boolean> {
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
