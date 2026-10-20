/** Verbindung zum Server für die Synchronisation (E-134): `/v1/tresor…` mit Bearer-Token. */
import { SyncFehler, type TresorApi } from "./sync";

export interface TresorServer extends TresorApi {
  holen(): Promise<{ version: number; schluessel: string; daten: string | null; konto_id?: string } | null>;
  einrichten(schluessel: string): Promise<{ version: number; konto_id?: string }>;
  schluesselSetzen(schluessel: string): Promise<void>;
  loeschen(): Promise<void>;
  /** Konto auf dem Server löschen (mit allen Sync-Daten) */
  kontoLoeschen(): Promise<void>;
}

/** HTTP-Status → Fehlerart der Synchronisation */
export function fehlerAusStatus(status: number): SyncFehler {
  if (status === 401 || status === 403) return new SyncFehler("anmeldung");
  if (status === 402) return new SyncFehler("pro");
  if (status === 409) return new SyncFehler("konflikt");
  // 413: Speicher des Kontos voll (E-143) – nicht als Formatfehler melden
  if (status === 413) return new SyncFehler("voll");
  if (status === 400 || status === 422) return new SyncFehler("format");
  return new SyncFehler("netz");
}

export function tresorServer(basis: string, token: () => Promise<string>, abruf: typeof fetch = fetch): TresorServer {
  const anfrage = async (methode: string, pfad: string, body?: unknown, leerBei404 = false): Promise<unknown> => {
    const t = await token();
    let r: Response;
    try {
      r = await abruf(`${basis}/v1/${pfad}`, {
        method: methode,
        headers: { Authorization: `Bearer ${t}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new SyncFehler("netz");
    }
    if (r.status === 404 && leerBei404) return null;
    if (!r.ok) throw fehlerAusStatus(r.status);
    if (r.status === 204) return undefined;
    return r.json();
  };
  return {
    holen: async () => (await anfrage("GET", "tresor", undefined, true)) as Awaited<ReturnType<TresorServer["holen"]>>,
    einrichten: async (schluessel) => (await anfrage("POST", "tresor", { schluessel })) as { version: number; konto_id?: string },
    speichern: async (version, daten) => ((await anfrage("PUT", "tresor", { version, daten })) as { version: number }).version,
    schluesselSetzen: async (schluessel) => {
      await anfrage("PUT", "tresor/schluessel", { schluessel });
    },
    loeschen: async () => {
      await anfrage("DELETE", "tresor");
    },
    kontoLoeschen: async () => {
      try {
        await anfrage("POST", "ich/loeschen");
      } catch (e) {
        // 409: zum Konto gehören noch Unternehmen der Web-App
        throw e instanceof SyncFehler && e.art === "konflikt" ? new SyncFehler("konto") : e;
      }
    },
    dateien: async () => (await anfrage("GET", "tresor/dateien")) as string[],
    dateiSpeichern: async (name, daten) => {
      await anfrage("PUT", `tresor/dateien/${encodeURIComponent(name)}`, { daten });
    },
    dateiHolen: async (name) => ((await anfrage("GET", `tresor/dateien/${encodeURIComponent(name)}`, undefined, true)) as { daten: string } | null)?.daten ?? null,
  };
}
