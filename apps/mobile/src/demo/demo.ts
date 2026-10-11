/**
 * Demo-Modus (E-119, E-120): Die App läuft ohne Server und ohne Konto, startet aber leer wie die echte App –
 * Unternehmen anlegen, Fragen beantworten, dann berechnet das Gerät die Pflichten mit derselben Regel-Engine und
 * demselben Katalog wie der Server. Die übrigen Bereiche (Finanzen, Personal, Postfach, Team …) halten ihre Daten im
 * Gerät. Nichts wird erfunden: Texte, Fristen und Begründungen kommen aus dem Katalog.
 * Ohne React-Native-Abhängigkeiten, damit testbar.
 */
import type { Katalog } from "@amtlos/rules-engine";
import type { Abruf, Sprache } from "../kern/api";
import { finanzen } from "./finanzen";
import { kern } from "./kern";
import { Kontext, heuteBerlin, leererStand, type Anfrage, type Modul, type Stand } from "./kontext";
import { konto } from "./konto";
import { personal } from "./personal";
import { postfach } from "./postfach";

export { heuteBerlin };
export const DEMO_TOKEN = "demo";

/** Wo die Demo ihren Stand ablegt (in der App: AsyncStorage), damit er das Schließen der App übersteht. */
export interface DemoSpeicher {
  lesen(): Promise<string | null>;
  schreiben(wert: string): Promise<void>;
}

const MODULE: Modul[] = [kern, finanzen, personal, postfach, konto];

export function demoAbruf(katalog: Katalog, jetzt: () => Date = () => new Date(), speicher?: DemoSpeicher): Abruf {
  const k = new Kontext(katalog, leererStand(), jetzt);

  // Gespeicherten Stand einmal laden und neu rechnen – wie der tägliche Lauf auf dem Server
  const geladen = (async () => {
    const roh = await speicher?.lesen().catch(() => null);
    if (!roh) return;
    try {
      const st = JSON.parse(roh) as Partial<Stand> & { instanzen?: unknown };
      // Stand aus der ersten Demo-Fassung: instanzen als Liste von Paaren
      const instanzen = Array.isArray(st.instanzen) ? Object.fromEntries(st.instanzen as [string, never][]) : (st.instanzen ?? {});
      k.stand = { ...leererStand(), ...st, instanzen, profil: { ...leererStand().profil, ...st.profil } } as Stand;
      k.neuberechnen();
    } catch {
      // unlesbarer Stand: leer beginnen
    }
  })();
  const sichern = () => speicher?.schreiben(JSON.stringify(k.stand)).catch(() => undefined);

  return async (url, init) => {
    await geladen;
    const u = new URL(url, "http://demo");
    let roh: unknown = undefined;
    if (typeof init.body === "string") {
      try {
        roh = JSON.parse(init.body);
      } catch {
        roh = undefined;
      }
    } else if (init.body) roh = init.body;
    const a: Anfrage = {
      pfad: u.pathname,
      teile: u.pathname.split("/").filter(Boolean).map(decodeURIComponent),
      methode: init.method,
      suche: u.searchParams,
      koerper: roh && typeof roh === "object" && !Array.isArray(roh) && !(typeof FormData !== "undefined" && roh instanceof FormData) ? (roh as Record<string, unknown>) : {},
      roh,
      s: (init.headers["X-Sprache"] === "en" ? "en" : "de") as Sprache,
    };
    let r = undefined;
    for (const modul of MODULE) {
      r = await modul(a, k);
      if (r) break;
    }
    r ??= { status: 404, wert: { meldung: a.s === "en" ? "Not available in the demo" : "In der Demo nicht verfügbar" } };
    if (init.method !== "GET" && r.status < 400) await sichern();
    const { status, wert } = r;
    return { ok: status < 400, status, json: async () => wert ?? {} };
  };
}
