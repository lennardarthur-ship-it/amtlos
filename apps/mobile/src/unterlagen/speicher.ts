/**
 * Unterlagen und Betrieb – nur auf dem Gerät (E-121). Reine Funktionen über einem unveränderlichen Stand, damit sie
 * ohne Gerät testbar sind; zustand.tsx speichert den Stand in AsyncStorage.
 */
import { LEERER_BETRIEB, leereDaten, vorlageFuer, type Betrieb, type Daten } from "@amtlos/fachlogik";

export interface Unterlage {
  id: string;
  vorlage: string;
  daten: Daten;
  erstellt: string;
  geaendert: string;
}

export interface Stand {
  version: 1;
  betrieb: Betrieb;
  unterlagen: Unterlage[];
}

export const LEERER_STAND: Stand = { version: 1, betrieb: LEERER_BETRIEB, unterlagen: [] };

/** Gespeicherten Stand lesen; Unlesbares oder Unbekanntes führt zu einem leeren bzw. bereinigten Stand. */
export function standAus(json: string | null): Stand {
  if (!json) return LEERER_STAND;
  try {
    const roh = JSON.parse(json) as Partial<Stand>;
    const betrieb = { ...LEERER_BETRIEB };
    for (const k of Object.keys(LEERER_BETRIEB) as (keyof Betrieb)[]) {
      const w = (roh.betrieb as Record<string, unknown> | undefined)?.[k];
      if (typeof w === "string") betrieb[k] = w;
    }
    const unterlagen = (Array.isArray(roh.unterlagen) ? roh.unterlagen : []).filter(
      (u): u is Unterlage => Boolean(u && typeof u.id === "string" && typeof u.vorlage === "string" && vorlageFuer(u.vorlage) && u.daten && typeof u.daten === "object"),
    );
    return { version: 1, betrieb, unterlagen };
  } catch {
    return LEERER_STAND;
  }
}

/** Heutiges Datum in Deutschland als YYYY-MM-DD. */
export const heute = (jetzt = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(jetzt);

export const neueId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function anlegen(s: Stand, vorlageId: string, jetzt: Date, id = neueId()): [Stand, Unterlage] {
  const v = vorlageFuer(vorlageId);
  if (!v) throw new Error(`Unbekannte Vorlage: ${vorlageId}`);
  const u: Unterlage = { id, vorlage: v.id, daten: leereDaten(v, s.betrieb, heute(jetzt)), erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

export function aendern(s: Stand, id: string, daten: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id ? { ...u, daten, geaendert: jetzt.toISOString() } : u)) };
}

/** Kopie, z. B. für den nächsten Monat oder einen weiteren Arbeitsbereich. */
export function kopieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const alt = s.unterlagen.find((u) => u.id === id);
  if (!alt) return [s, null];
  const u: Unterlage = { ...alt, id: neu, daten: JSON.parse(JSON.stringify(alt.daten)) as Daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

export function loeschen(s: Stand, id: string): Stand {
  return { ...s, unterlagen: s.unterlagen.filter((u) => u.id !== id) };
}

export function betriebSetzen(s: Stand, b: Betrieb): Stand {
  return { ...s, betrieb: b };
}

/** Zuletzt bearbeitete zuerst. */
export const sortiert = (s: Stand) => [...s.unterlagen].sort((a, b) => b.geaendert.localeCompare(a.geaendert));

export const betriebFehlt = (b: Betrieb) => !b.name.trim();
