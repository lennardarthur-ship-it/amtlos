/**
 * Unterlagen und Betrieb – nur auf dem Gerät (E-121). Reine Funktionen über einem unveränderlichen Stand, damit sie
 * ohne Gerät testbar sind; zustand.tsx speichert den Stand in AsyncStorage.
 */
import { LEERER_BETRIEB, leereDaten, naechsteNummer, personMerken as merken, vorlageFuer, type Betrieb, type Daten, type Person, type PersonAngaben, type PersonenArt } from "@amtlos/fachlogik";

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
  /** gespeicherte Personen, die Vorlagen vorausfüllen (E-124) */
  mitarbeiter: Person[];
  kunden: Person[];
  /** Antworten im Pflichten-Check (E-126), Schlüssel wie im Server-Profil ohne „profil.“ */
  profil: Record<string, string | number | boolean | string[] | null>;
  /** abgehakte Pflichten: Pflicht-ID → Datum */
  erledigt: Record<string, string>;
}

export const LEERER_STAND: Stand = { version: 1, betrieb: LEERER_BETRIEB, unterlagen: [], mitarbeiter: [], kunden: [], profil: {}, erledigt: {} };

function profilAus(roh: unknown): Stand["profil"] {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(
    Object.entries(roh as Record<string, unknown>).filter(([, w]) => w === null || ["string", "number", "boolean"].includes(typeof w) || (Array.isArray(w) && w.every((x) => typeof x === "string"))),
  ) as Stand["profil"];
}
function erledigtAus(roh: unknown): Record<string, string> {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(Object.entries(roh as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Liste der Personen einer Art im Stand. */
export const PERSONEN_LISTE: Record<PersonenArt, "mitarbeiter" | "kunden"> = { mitarbeiter: "mitarbeiter", kunde: "kunden" };

function personenAus(roh: unknown): Person[] {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === "object" && typeof (p as Person).id === "string" && typeof (p as Person).name === "string"))
    .map((p) => Object.fromEntries(Object.entries(p).filter(([, w]) => typeof w === "string" || w === null)) as Person);
}

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
    const r = roh as Record<string, unknown>;
    return { version: 1, betrieb, unterlagen, mitarbeiter: personenAus(r.mitarbeiter), kunden: personenAus(r.kunden), profil: profilAus(r.profil), erledigt: erledigtAus(r.erledigt) };
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
  const daten = leereDaten(v, s.betrieb, heute(jetzt));
  // fortlaufende Nummer (Rechnung): aus den vorhandenen Unterlagen derselben Vorlage weiterzählen
  if (v.fortlaufend) {
    const vorhanden = s.unterlagen.filter((u) => u.vorlage === v.id).map((u) => u.daten[v.fortlaufend!]).filter((n): n is string => typeof n === "string");
    daten[v.fortlaufend] = naechsteNummer(vorhanden, heute(jetzt).slice(0, 4));
  }
  const u: Unterlage = { id, vorlage: v.id, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

export function aendern(s: Stand, id: string, daten: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id ? { ...u, daten, geaendert: jetzt.toISOString() } : u)) };
}

/** Ein Feld setzen (bzw. mehrere) – liest den aktuellen Stand, damit schnelles Tippen nichts verliert. */
export function felderSetzen(s: Stand, id: string, werte: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id ? { ...u, daten: { ...u.daten, ...werte }, geaendert: jetzt.toISOString() } : u)) };
}

/** Kopie, z. B. für den nächsten Monat oder einen weiteren Arbeitsbereich. */
export function kopieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const alt = s.unterlagen.find((u) => u.id === id);
  if (!alt) return [s, null];
  const daten = JSON.parse(JSON.stringify(alt.daten)) as Daten;
  const v = vorlageFuer(alt.vorlage);
  // eine kopierte Rechnung bekommt die nächste Nummer – Nummern dürfen nur einmal vorkommen
  if (v?.fortlaufend) {
    const vorhanden = s.unterlagen.filter((u) => u.vorlage === v.id).map((u) => u.daten[v.fortlaufend!]).filter((n): n is string => typeof n === "string");
    daten[v.fortlaufend] = naechsteNummer(vorhanden, heute(jetzt).slice(0, 4));
  }
  const u: Unterlage = { ...alt, id: neu, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

export function loeschen(s: Stand, id: string): Stand {
  return { ...s, unterlagen: s.unterlagen.filter((u) => u.id !== id) };
}

/** Person aus einer Unterlage merken (gleicher Name ergänzt den vorhandenen Eintrag). */
export function personMerken(s: Stand, art: PersonenArt, angaben: PersonAngaben, id = neueId()): Stand {
  const k = PERSONEN_LISTE[art];
  return { ...s, [k]: merken(s[k], angaben, id) };
}

/** Person anlegen oder ändern (Bearbeiten unter „Mein Betrieb“). */
export function personSetzen(s: Stand, art: PersonenArt, p: Person): Stand {
  const k = PERSONEN_LISTE[art];
  return { ...s, [k]: s[k].some((x) => x.id === p.id) ? s[k].map((x) => (x.id === p.id ? p : x)) : [...s[k], p] };
}

export function personLoeschen(s: Stand, art: PersonenArt, id: string): Stand {
  const k = PERSONEN_LISTE[art];
  return { ...s, [k]: s[k].filter((x) => x.id !== id) };
}

/** Personen alphabetisch. */
export const personenSortiert = (l: Person[]) => [...l].filter((p) => p.name.trim()).sort((a, b) => a.name.localeCompare(b.name, "de"));

/** Antworten im Pflichten-Check setzen. Das Bundesland übernimmt „Mein Betrieb“, solange dort keins steht. */
export function profilSetzen(s: Stand, werte: Stand["profil"], bundeslandName?: string): Stand {
  const betrieb = bundeslandName && !s.betrieb.bundesland ? { ...s.betrieb, bundesland: bundeslandName } : s.betrieb;
  return { ...s, betrieb, profil: { ...s.profil, ...werte } };
}

/** Pflicht abhaken bzw. den Haken entfernen. */
export function erledigtSetzen(s: Stand, pflichtId: string, datum: string | null): Stand {
  const erledigt = { ...s.erledigt };
  if (datum) erledigt[pflichtId] = datum;
  else delete erledigt[pflichtId];
  return { ...s, erledigt };
}

export function betriebSetzen(s: Stand, b: Betrieb): Stand {
  return { ...s, betrieb: b };
}

/** Zuletzt bearbeitete zuerst. */
export const sortiert = (s: Stand) => [...s.unterlagen].sort((a, b) => b.geaendert.localeCompare(a.geaendert));

export const betriebFehlt = (b: Betrieb) => !b.name.trim();
