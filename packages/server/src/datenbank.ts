import pg from "pg";

// date-Spalten als ISO-String (YYYY-MM-DD) statt JS-Date: Fristen sind Kalendertage ohne Zeitzone.
pg.types.setTypeParser(1082, (v) => v);
// numeric als Zahl (Beträge sind numeric(14,2); Rundungsfehler unkritisch für Anzeige, Rechnen in Cent später in Finanzen)
pg.types.setTypeParser(1700, (v) => Number(v));

export interface Kontext {
  kontoId?: string | null;
  unternehmenId?: string | null;
}

export interface Tx {
  abfrage<T = Record<string, unknown>>(sql: string, werte?: unknown[]): Promise<T[]>;
  eine<T = Record<string, unknown>>(sql: string, werte?: unknown[]): Promise<T | undefined>;
  readonly client: pg.PoolClient;
}

/**
 * Zugriff auf PostgreSQL ausschließlich über Transaktionen mit gesetztem Mandantenkontext.
 * Der Kontext gilt nur innerhalb der Transaktion (set_config(..., true)), damit er beim
 * Zurückgeben der Verbindung an den Pool nicht an den nächsten Request „durchsickert“.
 */
export class Datenbank {
  readonly pool: pg.Pool;

  constructor(verbindung: string | pg.PoolConfig) {
    this.pool = new pg.Pool(typeof verbindung === "string" ? { connectionString: verbindung } : verbindung);
  }

  async imKontext<T>(k: Kontext, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('amtlos.konto_id', $1, true), set_config('amtlos.unternehmen_id', $2, true)", [
        k.kontoId ?? "",
        k.unternehmenId ?? "",
      ]);
      const tx: Tx = {
        client,
        abfrage: async <R>(sql: string, werte: unknown[] = []) => (await client.query(sql, werte)).rows as R[],
        eine: async <R>(sql: string, werte: unknown[] = []) => (await client.query(sql, werte)).rows[0] as R | undefined,
      };
      const ergebnis = await fn(tx);
      await client.query("commit");
      return ergebnis;
    } catch (fehler) {
      await client.query("rollback").catch(() => undefined);
      throw fehler;
    } finally {
      client.release();
    }
  }

  async schliessen(): Promise<void> {
    await this.pool.end();
  }
}

/** Fehlercodes von PostgreSQL, die die API in fachliche Antworten übersetzt. */
export const PG_FEHLER = {
  eindeutig: "23505",
  pruefung: "23514",
  fremdschluessel: "23503",
  rls: "42501",
} as const;

export function pgFehlercode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
}
