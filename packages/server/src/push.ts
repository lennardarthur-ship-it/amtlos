import type { PushNachricht } from "./erinnerungen.js";

type Abruf = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface Ticket { status: "ok" | "error"; details?: { error?: string } }

/**
 * Push über den Expo-Push-Dienst (E-108). Sendet nur Titel, kurzen Text und den App-Pfad – keine Unternehmensdaten.
 * Tokens, die Expo als „DeviceNotRegistered“ meldet, werden als ungültig zurückgegeben und abgemeldet.
 * Hinweis: Expo leitet an APNs/FCM weiter (Drittland, AVV und Datenschutzhinweis nötig – T-41).
 */
export class ExpoPush {
  constructor(
    private readonly zugangstoken?: string,
    private readonly abruf: Abruf = fetch as unknown as Abruf,
    private readonly url = "https://exp.host/--/api/v2/push/send",
  ) {}

  async senden(n: PushNachricht): Promise<{ ungueltig: string[] }> {
    const ungueltig: string[] = [];
    for (let i = 0; i < n.tokens.length; i += 100) {
      const teil = n.tokens.slice(i, i + 100);
      const r = await this.abruf(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(this.zugangstoken ? { Authorization: `Bearer ${this.zugangstoken}` } : {}) },
        body: JSON.stringify(teil.map((to) => ({ to, title: n.titel, body: n.text, data: { link: n.link }, sound: "default", priority: "normal" }))),
      });
      if (!r.ok) throw new Error(`Expo-Push: HTTP ${r.status}`);
      const tickets = ((await r.json()) as { data?: Ticket[] }).data ?? [];
      tickets.forEach((t, j) => {
        if (t.status === "error" && t.details?.error === "DeviceNotRegistered") ungueltig.push(teil[j]!);
      });
    }
    return { ungueltig };
  }
}
