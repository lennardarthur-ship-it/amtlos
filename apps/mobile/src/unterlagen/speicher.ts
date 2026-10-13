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
  /** zuerst als PDF geteilt oder gedruckt (E-127) – erst dann zählt die Unterlage für eine Pflicht */
  ausgegeben?: string;
  /** festgeschrieben (Vorlagen mit `festschreiben`, z. B. Rechnung): nicht mehr änderbar oder löschbar */
  festgeschrieben?: string;
  /** storniert durch diese Unterlage (Stornorechnung) */
  storniertDurch?: string;
  /** Zahlung eingegangen am (YYYY-MM-DD, E-129) – gehört nicht zum Inhalt, ändert also keine festgeschriebene Rechnung */
  bezahlt?: string;
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
  /** lokale Erinnerungen an Fristen eingeschaltet (E-128) */
  erinnerungen: boolean;
  /** App nur nach Face ID / Code öffnen (E-129) */
  appSperre: boolean;
  /** letzte Änderung am Stand (ISO) */
  geaendert?: string;
  /** letzte erstellte Datensicherung (ISO, E-129) – von Hand oder automatisch in iCloud */
  letzteSicherung?: string;
  /** automatisch in iCloud sichern (nur im eigenen App-Build, E-129) */
  cloudSicherung: boolean;
  /** Pro testweise eingeschaltet – nur im Testmodus ohne App-Store-Anbindung (E-132) */
  proTest: boolean;
  /** Bitte um eine Bewertung (E-132): Erfolgsmomente gezählt, zuletzt gefragt am (ISO) */
  bewertung: { erfolge: number; gefragt?: string };
}

export const LEERER_STAND: Stand = { version: 1, betrieb: LEERER_BETRIEB, unterlagen: [], mitarbeiter: [], kunden: [], profil: {}, erledigt: {}, erinnerungen: false, appSperre: false, cloudSicherung: false, proTest: false, bewertung: { erfolge: 0 } };

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

function bewertungAus(roh: unknown): Stand["bewertung"] {
  const b = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  const erfolge = typeof b.erfolge === "number" && Number.isFinite(b.erfolge) ? Math.max(0, Math.floor(b.erfolge)) : 0;
  return typeof b.gefragt === "string" && b.gefragt ? { erfolge, gefragt: b.gefragt } : { erfolge };
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
    const iso = (w: unknown) => (typeof w === "string" && w ? w : undefined);
    return {
      version: 1,
      betrieb,
      unterlagen,
      mitarbeiter: personenAus(r.mitarbeiter),
      kunden: personenAus(r.kunden),
      profil: profilAus(r.profil),
      erledigt: erledigtAus(r.erledigt),
      erinnerungen: r.erinnerungen === true,
      appSperre: r.appSperre === true,
      cloudSicherung: r.cloudSicherung === true,
      proTest: r.proTest === true,
      bewertung: bewertungAus(r.bewertung),
      ...(iso(r.geaendert) ? { geaendert: iso(r.geaendert) } : {}),
      ...(iso(r.letzteSicherung) ? { letzteSicherung: iso(r.letzteSicherung) } : {}),
    };
  } catch {
    return LEERER_STAND;
  }
}

/** Heutiges Datum in Deutschland als YYYY-MM-DD. */
export const heute = (jetzt = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(jetzt);

export const neueId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Ist der gespeicherte Text lesbar? Unlesbares darf nicht durch einen leeren Stand überschrieben werden. */
export function istLesbar(json: string | null): boolean {
  if (!json) return true;
  try {
    const roh = JSON.parse(json) as unknown;
    return Boolean(roh && typeof roh === "object");
  } catch {
    return false;
  }
}

/** Nächste fortlaufende Nummer einer Vorlage aus allen vorhandenen Unterlagen (festgeschriebene lassen sich nicht löschen). */
function naechste(s: Stand, vorlageId: string, feld: string, jetzt: Date): string {
  const vorhanden = s.unterlagen.filter((u) => u.vorlage === vorlageId).map((u) => u.daten[feld]).filter((n): n is string => typeof n === "string");
  return naechsteNummer(vorhanden, heute(jetzt).slice(0, 4));
}

/** Gibt es dieselbe Nummer schon in einer anderen Unterlage derselben Vorlage? */
export function nummerDoppelt(s: Stand, u: Unterlage): boolean {
  const v = vorlageFuer(u.vorlage);
  const n = v?.fortlaufend && typeof u.daten[v.fortlaufend] === "string" ? (u.daten[v.fortlaufend] as string).trim() : "";
  return Boolean(n) && s.unterlagen.some((x) => x.id !== u.id && x.vorlage === u.vorlage && typeof x.daten[v!.fortlaufend!] === "string" && (x.daten[v!.fortlaufend!] as string).trim() === n);
}

export const istFest = (u: Unterlage | undefined) => Boolean(u?.festgeschrieben);

export function anlegen(s: Stand, vorlageId: string, jetzt: Date, id = neueId()): [Stand, Unterlage] {
  const v = vorlageFuer(vorlageId);
  if (!v) throw new Error(`Unbekannte Vorlage: ${vorlageId}`);
  const daten = leereDaten(v, s.betrieb, heute(jetzt));
  // fortlaufende Nummer (Rechnung): aus den vorhandenen Unterlagen derselben Vorlage weiterzählen
  if (v.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  // Startwerte aus dem Pflichten-Check (z. B. Kleinunternehmer), pro Unterlage überschreibbar
  for (const [feld, profilFeld] of Object.entries(v.ausProfil ?? {})) {
    const w = s.profil[profilFeld];
    if (w !== undefined && w !== null && !Array.isArray(w)) daten[feld] = typeof w === "number" ? String(w) : w;
  }
  // Startwerte aus „Mein Betrieb“ (z. B. Soll-/Ist-Versteuerung)
  for (const [feld, betriebsFeld] of Object.entries(v.ausBetrieb ?? {})) {
    const w = s.betrieb[betriebsFeld];
    if (typeof w === "string" && w.trim()) daten[feld] = w;
  }
  const u: Unterlage = { id, vorlage: v.id, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

/** Festgeschriebene Unterlagen bleiben, wie sie sind (GoBD, E-127). */
export function aendern(s: Stand, id: string, daten: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id && !u.festgeschrieben ? { ...u, daten, geaendert: jetzt.toISOString() } : u)) };
}

/** Ein Feld setzen (bzw. mehrere) – liest den aktuellen Stand, damit schnelles Tippen nichts verliert. */
export function felderSetzen(s: Stand, id: string, werte: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id && !u.festgeschrieben ? { ...u, daten: { ...u.daten, ...werte }, geaendert: jetzt.toISOString() } : u)) };
}

/** Als PDF geteilt oder gedruckt: merken, und Vorlagen mit `festschreiben` festschreiben. */
export function ausgeben(s: Stand, id: string, jetzt: Date): Stand {
  return {
    ...s,
    unterlagen: s.unterlagen.map((u) => {
      if (u.id !== id) return u;
      const fest = vorlageFuer(u.vorlage)?.festschreiben;
      return { ...u, ausgegeben: u.ausgegeben ?? jetzt.toISOString(), ...(fest && !u.festgeschrieben ? { festgeschrieben: jetzt.toISOString() } : {}) };
    }),
  };
}

/**
 * Storno (E-127): eine festgeschriebene Rechnung wird nicht geändert, sondern durch eine Stornorechnung mit neuer
 * Nummer und negativen Beträgen aufgehoben; die Stornorechnung verweist auf Nummer und Datum der ursprünglichen.
 */
export function stornieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const alt = s.unterlagen.find((u) => u.id === id);
  const v = alt ? vorlageFuer(alt.vorlage) : undefined;
  if (!alt || !v?.storno || !alt.festgeschrieben || alt.storniertDurch || alt.daten.storno_zu) return [s, null];
  const daten = JSON.parse(JSON.stringify(alt.daten)) as Daten;
  const negativ = (p: unknown) => (typeof p === "string" && p.trim() ? (p.trim().startsWith("-") ? p.trim().slice(1) : `-${p.trim()}`) : p);
  if (Array.isArray(daten.positionen)) daten.positionen = (daten.positionen as Record<string, unknown>[]).map((e) => ({ ...e, preis: negativ(e.preis) })) as Daten[string];
  daten.storno_zu = typeof alt.daten.nummer === "string" ? alt.daten.nummer : "";
  daten.storno_zu_datum = typeof alt.daten.datum === "string" ? alt.daten.datum : null;
  daten.datum = heute(jetzt);
  if (v.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  const u: Unterlage = { id: neu, vorlage: v.id, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen.map((x) => (x.id === id ? { ...x, storniertDurch: neu } : x))] }, u];
}

/** Kopie, z. B. für den nächsten Monat oder einen weiteren Arbeitsbereich. */
export function kopieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const alt = s.unterlagen.find((u) => u.id === id);
  if (!alt) return [s, null];
  const daten = JSON.parse(JSON.stringify(alt.daten)) as Daten;
  const v = vorlageFuer(alt.vorlage);
  // eine kopierte Rechnung bekommt die nächste Nummer – Nummern dürfen nur einmal vorkommen
  if (v?.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  // die Kopie ist ein neuer Entwurf: kein Storno-Bezug, nicht ausgegeben, nicht festgeschrieben
  delete daten.storno_zu;
  delete daten.storno_zu_datum;
  const u: Unterlage = { id: neu, vorlage: alt.vorlage, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

/** Löschen – außer festgeschriebene Unterlagen (Korrektur nur per Storno). */
export function loeschen(s: Stand, id: string): Stand {
  const weg = s.unterlagen.find((u) => u.id === id && !u.festgeschrieben);
  if (!weg) return s;
  // ein verworfener Storno-Entwurf gibt die ursprüngliche Rechnung wieder frei
  return { ...s, unterlagen: s.unterlagen.filter((u) => u.id !== id).map((u) => (u.storniertDurch === id ? { ...u, storniertDurch: undefined } : u)) };
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

/** Pflicht abhaken bzw. den Haken entfernen. Wiederkehrende Pflichten gelten nur für einen Termin („Datum|Termin“). */
export function erledigtSetzen(s: Stand, pflichtId: string, datum: string | null, termin?: string | null): Stand {
  const erledigt = { ...s.erledigt };
  if (datum) erledigt[pflichtId] = termin ? `${datum}|${termin}` : datum;
  else delete erledigt[pflichtId];
  return { ...s, erledigt };
}

export function betriebSetzen(s: Stand, b: Betrieb): Stand {
  return { ...s, betrieb: b };
}

/** Zuletzt bearbeitete zuerst. */
export const sortiert = (s: Stand) => [...s.unterlagen].sort((a, b) => b.geaendert.localeCompare(a.geaendert));

export const betriebFehlt = (b: Betrieb) => !b.name.trim();

/** Zahlungseingang einer Rechnung setzen bzw. entfernen (E-129). */
export function bezahltSetzen(s: Stand, id: string, datum: string | null): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id ? (datum ? { ...u, bezahlt: datum } : (({ bezahlt: _weg, ...rest }) => rest)(u)) : u)) };
}

/** Unterlagen, die aufbewahrt werden müssen: festgeschriebene (Rechnungen, Kassenbuch). */
export const aufbewahrungspflichtig = (s: Stand) => s.unterlagen.filter((u) => u.festgeschrieben);

/** Seit der letzten Datensicherung geändert (oder nie gesichert)? */
export function ungesichert(s: Stand): boolean {
  if (!s.letzteSicherung) return s.unterlagen.length > 0 || s.mitarbeiter.length > 0 || s.kunden.length > 0;
  return Boolean(s.geaendert && s.geaendert > s.letzteSicherung);
}

/**
 * „Alle Daten löschen“ (E-129): Liegen aufbewahrungspflichtige Unterlagen auf dem Gerät, nur mit einer Sicherung,
 * die nach der letzten Änderung erstellt wurde – sonst wären Rechnungen weg, die Jahre aufbewahrt werden müssen.
 */
export const allesLoeschenErlaubt = (s: Stand) => aufbewahrungspflichtig(s).length === 0 || !ungesichert(s);

/** Tage seit der letzten Sicherung, wenn eine fällig ist (ungesicherte Änderungen, älter als `nach` Tage), sonst null. */
export function sicherungFaellig(s: Stand, jetzt: Date, nach = 7): { tage: number | null } | null {
  if (!ungesichert(s) || s.unterlagen.length === 0) return null;
  if (!s.letzteSicherung) return { tage: null };
  const tage = Math.floor((jetzt.getTime() - Date.parse(s.letzteSicherung)) / 864e5);
  return tage >= nach ? { tage } : null;
}

export interface Zusammenfuehrung {
  stand: Stand;
  neu: number;
  behalten: number;
  aktualisiert: number;
  /** gleiche Nummer in zwei verschiedenen Unterlagen derselben Vorlage */
  nummernKonflikte: string[];
}

/**
 * Sicherung zurückspielen, ohne Neueres zu verlieren (E-129): Unterlagen werden nach ID zusammengeführt. Eine
 * festgeschriebene Unterlage wird nie ersetzt; sonst gewinnt die zuletzt geänderte Fassung. Was nur auf dem Gerät
 * existiert, bleibt. Personen, Antworten und Haken werden ergänzt; „Mein Betrieb“ nur übernommen, wenn er leer ist.
 */
export function zusammenfuehren(aktuell: Stand, gesichert: Stand): Zusammenfuehrung {
  const nachId = new Map(aktuell.unterlagen.map((u) => [u.id, u]));
  let neu = 0;
  let behalten = 0;
  let aktualisiert = 0;
  for (const g of gesichert.unterlagen) {
    const a = nachId.get(g.id);
    if (!a) {
      nachId.set(g.id, g);
      neu++;
    } else if (a.festgeschrieben || a.geaendert >= g.geaendert) {
      // Zahlung oder Storno aus der Sicherung übernehmen, wenn auf dem Gerät noch nicht vermerkt
      const erg = { ...a, ...(g.bezahlt && !a.bezahlt ? { bezahlt: g.bezahlt } : {}), ...(g.storniertDurch && !a.storniertDurch ? { storniertDurch: g.storniertDurch } : {}) };
      nachId.set(a.id, erg);
      behalten++;
    } else {
      nachId.set(g.id, g);
      aktualisiert++;
    }
  }
  const personen = (a: Person[], g: Person[]) => [...a, ...g.filter((p) => !a.some((x) => x.id === p.id))];
  const erledigt = { ...gesichert.erledigt, ...aktuell.erledigt };
  const stand: Stand = {
    ...aktuell,
    betrieb: betriebFehlt(aktuell.betrieb) ? gesichert.betrieb : aktuell.betrieb,
    unterlagen: [...nachId.values()],
    mitarbeiter: personen(aktuell.mitarbeiter, gesichert.mitarbeiter),
    kunden: personen(aktuell.kunden, gesichert.kunden),
    profil: { ...gesichert.profil, ...aktuell.profil },
    erledigt,
  };
  const nummernKonflikte = [...new Set(stand.unterlagen.filter((u) => nummerDoppelt(stand, u)).map((u) => String(u.daten[vorlageFuer(u.vorlage)!.fortlaufend!]).trim()))].sort();
  return { stand, neu, behalten, aktualisiert, nummernKonflikte };
}
