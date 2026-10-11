import type { Katalog, Pflicht, RegelwertVersion } from "@amtlos/rules-engine";
import type { Tx } from "./datenbank.js";

export interface AktiverKatalog {
  releaseId: string;
  nummer: number;
  katalog: Katalog;
  /** pflicht_id → pflicht_version.id im Release */
  versionIds: Map<string, string>;
}

const cache = new Map<string, AktiverKatalog>();

/**
 * Lädt das zuletzt veröffentlichte Release. Releases sind unveränderlich (Trigger in 0001),
 * daher darf je Release-ID im Prozess zwischengespeichert werden.
 */
export async function ladeAktivenKatalog(tx: Tx): Promise<AktiverKatalog | undefined> {
  // Übersetzungen ändern sich ohne neues Release (E-107): ihr Stand gehört zum Cache-Schlüssel (eine Abfrage)
  const release = await tx.eine<{ id: string; nummer: number; stand: string | null }>(
    "select id, nummer, (select max(geaendert_am)::text from katalog.uebersetzung) as stand from katalog.aktives_release",
  );
  if (!release) return undefined;
  const schluessel = `${release.id}|${release.stand ?? ""}`;
  const vorhanden = cache.get(schluessel);
  if (vorhanden) return vorhanden;

  const pflichten = await tx.abfrage<{ id: string; pflicht_id: string; daten: Pflicht }>(
    `select pv.id, pv.pflicht_id, pv.daten
       from katalog.release_inhalt ri join katalog.pflicht_version_anzeige pv on pv.id = ri.objekt_id
      where ri.release_id = $1 and ri.objekt_art = 'pflicht_version'
      order by pv.pflicht_id`,
    [release.id],
  );
  const regelwerte = await tx.abfrage<{ daten: RegelwertVersion }>(
    `select rv.daten_lokal as daten
       from katalog.release_inhalt ri join katalog.regelwert_version_anzeige rv on rv.id = ri.objekt_id
      where ri.release_id = $1 and ri.objekt_art = 'regelwert_version'
      order by rv.regelwert_id, rv.version`,
    [release.id],
  );
  const aktiv: AktiverKatalog = {
    releaseId: release.id,
    nummer: release.nummer,
    katalog: { pflichten: pflichten.map((p) => p.daten), regelwerte: regelwerte.map((r) => r.daten) },
    versionIds: new Map(pflichten.map((p) => [p.pflicht_id, p.id])),
  };
  if (cache.size >= 8) cache.clear(); // alte Releases/Übersetzungsstände nicht ansammeln
  cache.set(schluessel, aktiv);
  return aktiv;
}

export function katalogCacheLeeren(): void {
  cache.clear();
}
