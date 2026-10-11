import { validiereKatalog } from "@amtlos/rules-schema";
import type { Datenbank, Tx } from "./datenbank.js";
import { katalogCacheLeeren } from "./katalog.js";

export const SYSTEMKONTO_KATALOG = "00000000-0000-0000-0000-000000000001";

export interface ImportErgebnis {
  release: number | null;
  neuePflichtversionen: number;
  neueRegelwertversionen: number;
  unveraendert: boolean;
}

interface Quelle {
  titel: string;
  url: string;
  abgerufen?: string | null;
  fundstelle?: string;
}

/**
 * Importiert catalog/ (YAML) als neues Release (E-030: Startbestand und Entwicklungsumgebungen).
 * - Bestehende Versionen werden nie überschrieben; gleiche Nummer mit anderem Inhalt ist ein Fehler.
 * - Alles wird als 'entwurf' importiert. Freigaben entstehen nur im Studio (Vier-Augen, E-039).
 * - In prod verhindert der Datenbank-Trigger ein Release mit ungeprüften Inhalten.
 * Läuft als Rolle mit Schreibrecht auf katalog.* (amtlos_studio).
 */
export async function importiereKatalog(db: Datenbank, katalogDir: string): Promise<ImportErgebnis> {
  const pruefung = validiereKatalog(katalogDir);
  if (pruefung.fehler.length) throw new Error(`Katalog ungültig:\n- ${pruefung.fehler.join("\n- ")}`);

  return db.imKontext({ kontoId: SYSTEMKONTO_KATALOG }, async (tx) => {
    let neuePflichtversionen = 0;
    let neueRegelwertversionen = 0;
    const inhalt: { art: "pflicht_version" | "regelwert_version"; id: string }[] = [];

    for (const { inhalt: p } of pruefung.pflichten) {
      await tx.abfrage("insert into katalog.pflicht (id, kategorie) values ($1, $2) on conflict (id) do nothing", [p.id, p.kategorie]);
      const { id, neu } = await versionAnlegen(
        tx,
        "select id, daten from katalog.pflicht_version where pflicht_id = $1 and version = $2",
        `insert into katalog.pflicht_version (pflicht_id, version, daten, status_recht, gueltig_ab, gueltig_bis, erstellt_von)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [p.id, p.version],
        [p.id, p.version, p, p.status_recht, p.gueltig_ab ?? null, p.gueltig_bis ?? null, SYSTEMKONTO_KATALOG],
        p,
        `Pflicht ${p.id}@${p.version}`,
      );
      if (neu) {
        neuePflichtversionen++;
        await quellenVerknuepfen(tx, "pflicht_version", id, (p.quellen as Quelle[]) ?? []);
      }
      inhalt.push({ art: "pflicht_version", id });
    }

    for (const rw of pruefung.regelwerte) {
      await tx.abfrage("insert into katalog.regelwert (id, einheit, bezeichnung) values ($1, $2, $3) on conflict (id) do nothing", [
        rw.id,
        rw.einheit,
        rw.bezeichnung,
      ]);
      const { id, neu } = await versionAnlegen(
        tx,
        "select id, daten from katalog.regelwert_version where regelwert_id = $1 and version = $2",
        `insert into katalog.regelwert_version (regelwert_id, version, wert, gueltig_ab, gueltig_bis, status_recht, daten, erstellt_von)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [rw.id, rw.version],
        [rw.id, rw.version, rw.wert, rw.gueltig_ab, rw.gueltig_bis ?? null, rw.status_recht, rw, SYSTEMKONTO_KATALOG],
        rw,
        `Regelwert ${rw.id}@${rw.version}`,
      );
      if (neu) {
        neueRegelwertversionen++;
        await quellenVerknuepfen(tx, "regelwert_version", id, (rw.quellen as Quelle[]) ?? []);
      }
      inhalt.push({ art: "regelwert_version", id });
    }

    // Unverändert gegenüber dem aktiven Release? Dann kein neues Release.
    const aktiv = await tx.abfrage<{ objekt_id: string }>(
      "select ri.objekt_id from katalog.aktives_release r join katalog.release_inhalt ri on ri.release_id = r.id",
    );
    const aktivIds = new Set(aktiv.map((a) => a.objekt_id));
    if (aktiv.length === inhalt.length && inhalt.every((i) => aktivIds.has(i.id))) {
      return { release: null, neuePflichtversionen, neueRegelwertversionen, unveraendert: true };
    }

    const r = await tx.eine<{ id: string; nummer: number }>(
      `insert into katalog.release (nummer, notiz, erstellt_von)
       values ((select coalesce(max(nummer), 0) + 1 from katalog.release), 'Import aus catalog/', $1) returning id, nummer`,
      [SYSTEMKONTO_KATALOG],
    );
    for (const i of inhalt) await tx.abfrage("insert into katalog.release_inhalt values ($1, $2, $3)", [r!.id, i.art, i.id]);
    await tx.abfrage("update katalog.release set veroeffentlicht_am = now() where id = $1", [r!.id]);
    katalogCacheLeeren();
    return { release: r!.nummer, neuePflichtversionen, neueRegelwertversionen, unveraendert: false };
  });
}

async function versionAnlegen(
  tx: Tx,
  sucheSql: string,
  einfuegenSql: string,
  sucheWerte: unknown[],
  einfuegenWerte: unknown[],
  daten: unknown,
  name: string,
): Promise<{ id: string; neu: boolean }> {
  const vorhanden = await tx.eine<{ id: string; daten: unknown }>(sucheSql, sucheWerte);
  if (vorhanden) {
    if (kanonisch(vorhanden.daten) !== kanonisch(daten)) {
      throw new Error(`${name}: existiert bereits mit anderem Inhalt. Für Änderungen eine neue Version anlegen.`);
    }
    return { id: vorhanden.id, neu: false };
  }
  const neu = await tx.eine<{ id: string }>(einfuegenSql, einfuegenWerte);
  return { id: neu!.id, neu: true };
}

async function quellenVerknuepfen(tx: Tx, art: "pflicht_version" | "regelwert_version", versionId: string, quellen: Quelle[]) {
  for (const q of quellen) {
    let quelle = await tx.eine<{ id: string }>(
      "select id from katalog.quelle where url = $1 and abgerufen_am is not distinct from $2::date",
      [q.url, q.abgerufen ?? null],
    );
    quelle ??= await tx.eine<{ id: string }>("insert into katalog.quelle (titel, url, abgerufen_am) values ($1, $2, $3) returning id", [
      q.titel,
      q.url,
      q.abgerufen ?? null,
    ]);
    await tx.abfrage(
      `insert into katalog.${art}_quelle (${art}_id, quelle_id, fundstelle) values ($1, $2, $3) on conflict do nothing`,
      [versionId, quelle!.id, q.fundstelle ?? null],
    );
  }
}

/** JSON mit sortierten Schlüsseln, damit jsonb-Rundreisen (Schlüsselreihenfolge) nicht als Änderung zählen. */
export function kanonisch(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(kanonisch).join(",")}]`;
  if (x && typeof x === "object")
    return `{${Object.keys(x)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kanonisch((x as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(x);
}
