/**
 * Unterlagen und Betrieb – nur auf dem Gerät (E-121). Reine Funktionen über einem unveränderlichen Stand, damit sie
 * ohne Gerät testbar sind; zustand.tsx speichert den Stand in AsyncStorage.
 */
import { LEERER_BETRIEB, belegAus, leereDaten, type Beleg, naechsteNummer, personMerken as merken, vorlageFuer, type Betrieb, type Daten, type Person, type PersonAngaben, type PersonenArt } from "@amtlos/fachlogik";

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
  /** wann die Zahlung zuletzt vermerkt oder entfernt wurde (ISO) – entscheidet beim Zusammenführen zweier Fassungen */
  bezahltGeaendert?: string;
}

export interface Stand {
  version: 1;
  betrieb: Betrieb;
  unterlagen: Unterlage[];
  /** Belege und Eingangsrechnungen (E-133); Dateien liegen verschlüsselt daneben (unterlagen/dateien.ts) */
  belege: Beleg[];
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
  /** Angaben für das Steuerberater-Paket (E-133) */
  steuerberatung: { kontenrahmen: "SKR03" | "SKR04"; beraternummer: string; mandantennummer: string };
  /**
   * Synchronisation (E-134): Löschvermerke („u:“ Unterlage, „b:“ Beleg, „m:“/„k:“ Person → ISO-Zeitpunkt), damit
   * Gelöschtes nicht von einem anderen Gerät zurückkommt; Zeitpunkte der letzten Änderung je Bereich (betrieb, profil,
   * erledigt, steuerberatung), damit die neuere Fassung gewinnt.
   */
  geloescht: Record<string, string>;
  zeiten: Record<string, string>;
  /** Bitte um eine Bewertung (E-132): Erfolgsmomente gezählt, zuletzt gefragt am (ISO) */
  bewertung: { erfolge: number; gefragt?: string };
}

export const LEERER_STAND: Stand = { version: 1, betrieb: LEERER_BETRIEB, unterlagen: [], belege: [], mitarbeiter: [], kunden: [], profil: {}, erledigt: {}, erinnerungen: false, appSperre: false, cloudSicherung: false, proTest: false, bewertung: { erfolge: 0 }, steuerberatung: { kontenrahmen: "SKR03", beraternummer: "", mandantennummer: "" }, geloescht: {}, zeiten: {} };

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

/** Karte Schlüssel → ISO-Zeitpunkt (Löschvermerke, Zeiten); Unlesbares fällt weg. */
function isoKarte(roh: unknown): Record<string, string> {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(Object.entries(roh as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(e[1])));
}

/** Zeitpunkt der letzten Änderung eines Bereichs setzen (Synchronisation, E-134). */
const mitZeit = (s: Stand, bereich: string, jetzt = new Date()): Stand => ({ ...s, zeiten: { ...s.zeiten, [bereich]: jetzt.toISOString() } });
/** Löschvermerk setzen. */
const vermerken = (s: Stand, schluessel: string, jetzt = new Date()): Stand => ({ ...s, geloescht: { ...s.geloescht, [schluessel]: jetzt.toISOString() } });

function steuerberatungAus(roh: unknown): Stand["steuerberatung"] {
  const b = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  const ziffern = (w: unknown) => (typeof w === "string" ? w.replace(/\D/g, "").slice(0, 7) : "");
  return { kontenrahmen: b.kontenrahmen === "SKR04" ? "SKR04" : "SKR03", beraternummer: ziffern(b.beraternummer), mandantennummer: ziffern(b.mandantennummer) };
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
      belege: (Array.isArray(r.belege) ? r.belege : []).map(belegAus).filter((b): b is Beleg => b !== null),
      mitarbeiter: personenAus(r.mitarbeiter),
      kunden: personenAus(r.kunden),
      profil: profilAus(r.profil),
      erledigt: erledigtAus(r.erledigt),
      erinnerungen: r.erinnerungen === true,
      appSperre: r.appSperre === true,
      cloudSicherung: r.cloudSicherung === true,
      proTest: r.proTest === true,
      bewertung: bewertungAus(r.bewertung),
      steuerberatung: steuerberatungAus(r.steuerberatung),
      geloescht: isoKarte(r.geloescht),
      zeiten: isoKarte(r.zeiten),
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

const nummerVon = (u: Unterlage) => {
  const v = vorlageFuer(u.vorlage);
  return v?.fortlaufend && typeof u.daten[v.fortlaufend] === "string" ? (u.daten[v.fortlaufend] as string).trim() : "";
};
// Häufigkeit je „Vorlage|Nummer“, einmal je Liste berechnet – Listen fragen das für jede Zeile ab
const nummernZaehler = new WeakMap<Unterlage[], Map<string, number>>();

/** Gibt es dieselbe Nummer schon in einer anderen Unterlage derselben Vorlage? */
export function nummerDoppelt(s: Stand, u: Unterlage): boolean {
  const n = nummerVon(u);
  if (!n) return false;
  let z = nummernZaehler.get(s.unterlagen);
  if (!z) {
    z = new Map();
    for (const x of s.unterlagen) {
      const nx = nummerVon(x);
      if (nx) z.set(`${x.vorlage}|${nx}`, (z.get(`${x.vorlage}|${nx}`) ?? 0) + 1);
    }
    nummernZaehler.set(s.unterlagen, z);
  }
  const anzahl = z.get(`${u.vorlage}|${n}`) ?? 0;
  // u selbst zählt mit, wenn es mit derselben Nummer in der Liste steht
  return anzahl - (s.unterlagen.some((x) => x.id === u.id && x.vorlage === u.vorlage && nummerVon(x) === n) ? 1 : 0) > 0;
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
      if (u.ausgegeben && (!fest || u.festgeschrieben)) return u;
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
  // fortlaufend nummerierte Unterlagen (Rechnung) bekommen das heutige Datum – sonst passt die Nummernfolge nicht
  if (v?.fortlaufend && typeof daten.datum === "string") daten.datum = heute(jetzt);
  const u: Unterlage = { id: neu, vorlage: alt.vorlage, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

/** Löschen – außer festgeschriebene Unterlagen (Korrektur nur per Storno). */
export function loeschen(s: Stand, id: string): Stand {
  const weg = s.unterlagen.find((u) => u.id === id && !u.festgeschrieben);
  if (!weg) return s;
  // ein verworfener Storno-Entwurf gibt die ursprüngliche Rechnung wieder frei
  return { ...vermerken(s, `u:${id}`), unterlagen: s.unterlagen.filter((u) => u.id !== id).map((u) => (u.storniertDurch === id ? (({ storniertDurch: _weg, ...rest }) => rest)(u) : u)) };
}

/** Person aus einer Unterlage merken (gleicher Name ergänzt den vorhandenen Eintrag). */
export function personMerken(s: Stand, art: PersonenArt, angaben: PersonAngaben, id = neueId(), jetzt = new Date()): Stand {
  const k = PERSONEN_LISTE[art];
  const vorher = new Map(s[k].map((p) => [p.id, JSON.stringify(p)]));
  // geänderte oder neue Einträge bekommen einen Zeitstempel – sonst käme eine neue Anschrift beim Synchronisieren nicht an
  const liste = merken(s[k], angaben, id).map((p) => (vorher.get(p.id) === JSON.stringify(p) ? p : { ...p, geaendert: jetzt.toISOString() }));
  return { ...s, [k]: liste };
}

/** Person anlegen oder ändern (Bearbeiten unter „Mein Betrieb“). */
export function personSetzen(s: Stand, art: PersonenArt, p: Person, jetzt = new Date()): Stand {
  const k = PERSONEN_LISTE[art];
  const neu = { ...p, geaendert: jetzt.toISOString() };
  return { ...s, [k]: s[k].some((x) => x.id === p.id) ? s[k].map((x) => (x.id === p.id ? neu : x)) : [...s[k], neu] };
}

export function personLoeschen(s: Stand, art: PersonenArt, id: string): Stand {
  const k = PERSONEN_LISTE[art];
  return { ...vermerken(s, `${art === "mitarbeiter" ? "m" : "k"}:${id}`), [k]: s[k].filter((x) => x.id !== id) };
}

/** Personen alphabetisch. */
export const personenSortiert = (l: Person[]) => [...l].filter((p) => p.name.trim()).sort((a, b) => a.name.localeCompare(b.name, "de"));

/** Antworten im Pflichten-Check setzen. Das Bundesland übernimmt „Mein Betrieb“, solange dort keins steht. */
export function profilSetzen(s: Stand, werte: Stand["profil"], bundeslandName?: string): Stand {
  const betrieb = bundeslandName && !s.betrieb.bundesland ? { ...s.betrieb, bundesland: bundeslandName } : s.betrieb;
  const mit = mitZeit(betrieb === s.betrieb ? s : mitZeit(s, "betrieb"), "profil");
  return { ...mit, betrieb, profil: { ...s.profil, ...werte } };
}

/** Pflicht abhaken bzw. den Haken entfernen. Wiederkehrende Pflichten gelten nur für einen Termin („Datum|Termin“). */
export function erledigtSetzen(s: Stand, pflichtId: string, datum: string | null, termin?: string | null): Stand {
  const erledigt = { ...s.erledigt };
  if (datum) erledigt[pflichtId] = termin ? `${datum}|${termin}` : datum;
  else delete erledigt[pflichtId];
  return { ...mitZeit(s, "erledigt"), erledigt };
}

export function betriebSetzen(s: Stand, b: Betrieb): Stand {
  return { ...mitZeit(s, "betrieb"), betrieb: b };
}

export const steuerberatungSetzen = (s: Stand, sb: Stand["steuerberatung"]): Stand => ({ ...mitZeit(s, "steuerberatung"), steuerberatung: sb });

/** Zuletzt bearbeitete zuerst. */
export const sortiert = (s: Stand) => [...s.unterlagen].sort((a, b) => b.geaendert.localeCompare(a.geaendert));

export const betriebFehlt = (b: Betrieb) => !b.name.trim();

/** Zahlungseingang einer Rechnung setzen bzw. entfernen (E-129). */
export function bezahltSetzen(s: Stand, id: string, datum: string | null, jetzt = new Date()): Stand {
  // eigener Zeitstempel: beim Zusammenführen gewinnt so auch das Entfernen einer Zahlung
  const g = jetzt.toISOString();
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id ? (datum ? { ...u, bezahlt: datum, bezahltGeaendert: g } : (({ bezahlt: _weg, ...rest }) => ({ ...rest, bezahltGeaendert: g }))(u)) : u)) };
}

/** Unterlagen, die aufbewahrt werden müssen: festgeschriebene (Rechnungen, Kassenbuch) und Belege. */
export const aufbewahrungspflichtig = (s: Stand): { id: string }[] => [...s.unterlagen.filter((u) => u.festgeschrieben), ...s.belege];

/** Beleg anlegen oder ändern (E-133). */
export function belegSetzen(s: Stand, b: Beleg, jetzt: Date): Stand {
  const neu = { ...b, geaendert: jetzt.toISOString() };
  return { ...s, belege: s.belege.some((x) => x.id === b.id) ? s.belege.map((x) => (x.id === b.id ? neu : x)) : [neu, ...s.belege] };
}

export const belegLoeschen = (s: Stand, id: string): Stand => ({ ...vermerken(s, `b:${id}`), belege: s.belege.filter((b) => b.id !== id) });

/** Belege nach Belegdatum, neueste zuerst. */
export const belegeSortiert = (s: Stand) => [...s.belege].sort((a, b) => b.datum.localeCompare(a.datum) || b.geaendert.localeCompare(a.geaendert));

/** Seit der letzten Datensicherung geändert (oder nie gesichert)? */
export function ungesichert(s: Stand): boolean {
  if (!s.letzteSicherung) return s.unterlagen.length > 0 || s.belege.length > 0 || s.mitarbeiter.length > 0 || s.kunden.length > 0;
  return Boolean(s.geaendert && s.geaendert > s.letzteSicherung);
}

/**
 * „Alle Daten löschen“ (E-129): Liegen aufbewahrungspflichtige Unterlagen auf dem Gerät, nur mit einer Sicherung,
 * die nach der letzten Änderung erstellt wurde – sonst wären Rechnungen weg, die Jahre aufbewahrt werden müssen.
 */
export const allesLoeschenErlaubt = (s: Stand) => aufbewahrungspflichtig(s).length === 0 || !ungesichert(s);

/** Tage seit der letzten Sicherung, wenn eine fällig ist (ungesicherte Änderungen, älter als `nach` Tage), sonst null. */
export function sicherungFaellig(s: Stand, jetzt: Date, nach = 7): { tage: number | null } | null {
  if (!ungesichert(s) || (s.unterlagen.length === 0 && s.belege.length === 0)) return null;
  if (!s.letzteSicherung) return { tage: null };
  const tage = Math.floor((jetzt.getTime() - Date.parse(s.letzteSicherung)) / 864e5);
  return tage >= nach ? { tage } : null;
}

/**
 * Storno-Verweise abgleichen: Verweise auf eine Stornorechnung, die es nicht (mehr) gibt, entfernen – sonst ließe
 * sich die Rechnung nie mehr korrigieren; fehlende Verweise aus `storno_zu` der vorhandenen Stornorechnungen ergänzen.
 */
export function stornoVerweisePruefen(l: Unterlage[]): Unterlage[] {
  const ids = new Set(l.map((u) => u.id));
  const stornoFuer = new Map<string, string>();
  for (const x of l) {
    const zu = typeof x.daten.storno_zu === "string" ? x.daten.storno_zu.trim() : "";
    if (zu) stornoFuer.set(`${x.vorlage}|${zu}`, x.id);
  }
  return l.map((u) => {
    if (u.storniertDurch && !ids.has(u.storniertDurch)) return (({ storniertDurch: _weg, ...rest }) => rest)(u);
    const st = !u.storniertDurch && !u.daten.storno_zu ? stornoFuer.get(`${u.vorlage}|${nummerVon(u)}`) : undefined;
    return st && st !== u.id && nummerVon(u) ? { ...u, storniertDurch: st } : u;
  });
}

const frueher = (x?: string, y?: string) => (x && y ? (x < y ? x : y) : (x ?? y));

/**
 * Zwei Fassungen derselben Unterlage vereinen (Synchronisation und Wiederherstellen). Festgeschrieben schlägt
 * Entwurf, sonst gewinnt die zuletzt geänderte Fassung. Vermerke werden feldweise vereint: erste Ausgabe und
 * Festschreibung nach dem früheren Datum, ein Storno-Verweis aus jeder Fassung, die Zahlung nach dem Zeitpunkt
 * ihrer letzten Änderung (ohne Zeitpunkt – ältere Daten – bleibt eine vorhandene Zahlung erhalten).
 */
export function unterlageVereinen(lokal: Unterlage, andere: Unterlage): Unterlage {
  const fl = Boolean(lokal.festgeschrieben);
  const fa = Boolean(andere.festgeschrieben);
  const basis = fl !== fa ? (fl ? lokal : andere) : lokal.geaendert >= andere.geaendert ? lokal : andere;
  const zweite = basis === lokal ? andere : lokal;
  const r: Unterlage = { ...basis };
  const ausgegeben = frueher(lokal.ausgegeben, andere.ausgegeben);
  if (ausgegeben) r.ausgegeben = ausgegeben;
  if (fl && fa) r.festgeschrieben = frueher(lokal.festgeschrieben, andere.festgeschrieben);
  const storno = basis.storniertDurch ?? zweite.storniertDurch;
  if (storno) r.storniertDurch = storno;
  const zl = lokal.bezahltGeaendert ?? "";
  const za = andere.bezahltGeaendert ?? "";
  const quelle = zl || za ? (zl >= za ? lokal : andere) : lokal.bezahlt ? lokal : andere;
  delete r.bezahlt;
  delete r.bezahltGeaendert;
  if (quelle.bezahlt) r.bezahlt = quelle.bezahlt;
  if (quelle.bezahltGeaendert) r.bezahltGeaendert = quelle.bezahltGeaendert;
  return r;
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
    } else {
      const v = unterlageVereinen(a, g);
      nachId.set(a.id, v);
      if (JSON.stringify(v) === JSON.stringify(a)) behalten++;
      else aktualisiert++;
    }
  }
  const personen = (a: Person[], g: Person[]) => [...a, ...g.filter((p) => !a.some((x) => x.id === p.id))];
  // Belege: nach ID, die zuletzt geänderte Fassung gewinnt; nur auf dem Gerät Vorhandenes bleibt
  const belegNachId = new Map(aktuell.belege.map((b) => [b.id, b]));
  for (const g of gesichert.belege) {
    const a = belegNachId.get(g.id);
    if (!a) {
      belegNachId.set(g.id, g);
      neu++;
    } else if (a.geaendert < g.geaendert) {
      belegNachId.set(g.id, g);
      aktualisiert++;
    } else behalten++;
  }
  const erledigt = { ...gesichert.erledigt, ...aktuell.erledigt };
  const stand: Stand = {
    ...aktuell,
    betrieb: betriebFehlt(aktuell.betrieb) ? gesichert.betrieb : aktuell.betrieb,
    unterlagen: stornoVerweisePruefen([...nachId.values()]),
    belege: [...belegNachId.values()],
    mitarbeiter: personen(aktuell.mitarbeiter, gesichert.mitarbeiter),
    kunden: personen(aktuell.kunden, gesichert.kunden),
    profil: { ...gesichert.profil, ...aktuell.profil },
    erledigt,
  };
  const nummernKonflikte = [...new Set(stand.unterlagen.filter((u) => nummerDoppelt(stand, u)).map((u) => String(u.daten[vorlageFuer(u.vorlage)!.fortlaufend!]).trim()))].sort();
  return { stand, neu, behalten, aktualisiert, nummernKonflikte };
}
