import { ApiFehler, NetzFehler, type ApiKlient } from "./api";

/**
 * Offline-Warteschlange für Stempel (E-108). Jeder Stempel bekommt beim Tippen eine client_id und den Zeitpunkt
 * vom Gerät. Übertragen wird der Reihe nach; die API ist über client_id idempotent, doppeltes Senden schadet nicht.
 * Netzfehler: anhalten und später erneut versuchen. Abgelehnte Stempel (z. B. älter als 72 Stunden) landen in
 * „fehlgeschlagen“ und werden der Nutzerin gezeigt – nie stillschweigend verworfen.
 */
export interface Stempel {
  client_id: string;
  art: "kommen" | "gehen";
  unternehmen_id: string;
  beschaeftigter_id: string;
  zeitpunkt: string;
  pause_minuten?: number;
}
export interface Fehlgeschlagen extends Stempel {
  meldung: string;
}
interface Stand {
  offen: Stempel[];
  fehlgeschlagen: Fehlgeschlagen[];
}

/** Dauerhafter Speicher (in der App AsyncStorage, im Test ein Objekt). */
export interface Speicher {
  lesen(schluessel: string): Promise<string | null>;
  schreiben(schluessel: string, wert: string): Promise<void>;
}

const SCHLUESSEL = "amtlos.stempel.v1";
/** Bis zu diesem Alter gilt ein Stempel als „sofort gesendet“ (Serverzeit statt Gerätezeit). */
const FRISCH_MS = 60_000;

export class StempelWarteschlange {
  private laeuft: Promise<{ gesendet: number; offen: number }> | null = null;
  constructor(
    private readonly speicher: Speicher,
    private readonly jetzt: () => number = Date.now,
  ) {}

  async stand(): Promise<Stand> {
    try {
      const roh = await this.speicher.lesen(SCHLUESSEL);
      const s = roh ? (JSON.parse(roh) as Partial<Stand>) : {};
      return { offen: s.offen ?? [], fehlgeschlagen: s.fehlgeschlagen ?? [] };
    } catch {
      return { offen: [], fehlgeschlagen: [] };
    }
  }

  private async speichern(s: Stand) {
    await this.speicher.schreiben(SCHLUESSEL, JSON.stringify(s));
  }

  async hinzufuegen(st: Stempel): Promise<void> {
    const s = await this.stand();
    if (!s.offen.some((x) => x.client_id === st.client_id)) s.offen.push(st);
    await this.speichern(s);
  }

  async fehlgeschlageneVerwerfen(): Promise<void> {
    const s = await this.stand();
    await this.speichern({ ...s, fehlgeschlagen: [] });
  }

  /** Überträgt alle offenen Stempel; nur ein Lauf gleichzeitig. */
  abarbeiten(klient: Pick<ApiKlient, "kommen" | "gehen">): Promise<{ gesendet: number; offen: number }> {
    this.laeuft ??= this.lauf(klient).finally(() => {
      this.laeuft = null;
    });
    return this.laeuft;
  }

  private async lauf(klient: Pick<ApiKlient, "kommen" | "gehen">) {
    let gesendet = 0;
    for (;;) {
      const s = await this.stand();
      const st = s.offen[0];
      if (!st) return { gesendet, offen: 0 };
      // Gerade getippt und gleich gesendet: Serverzeit (kein Offline-Kennzeichen); sonst Zeitpunkt vom Gerät
      const zeitpunkt = this.jetzt() - Date.parse(st.zeitpunkt) < FRISCH_MS ? undefined : st.zeitpunkt;
      try {
        if (st.art === "kommen") await klient.kommen({ beschaeftigter_id: st.beschaeftigter_id, client_id: st.client_id, zeitpunkt }, st.unternehmen_id);
        else await klient.gehen({ beschaeftigter_id: st.beschaeftigter_id, client_id: st.client_id, zeitpunkt, pause_minuten: st.pause_minuten ?? 0 }, st.unternehmen_id);
        gesendet++;
        await this.speichern({ ...s, offen: s.offen.slice(1) });
      } catch (e) {
        if (e instanceof NetzFehler || (e instanceof ApiFehler && (e.status >= 500 || e.status === 401 || e.status === 429))) return { gesendet, offen: s.offen.length };
        const meldung = e instanceof ApiFehler ? e.message : String(e);
        await this.speichern({ offen: s.offen.slice(1), fehlgeschlagen: [...s.fehlgeschlagen, { ...st, meldung }] });
      }
    }
  }
}

/** RFC-4122-UUID v4 aus 16 Zufallsbytes (in der App von expo-crypto). */
export function uuidAus(bytes: Uint8Array): string {
  const b = Array.from(bytes.slice(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
