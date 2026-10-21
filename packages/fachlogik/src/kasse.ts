/**
 * Kassenabschluss (R12): Tagesumsätze laut Z-Bon bzw. Kassenbericht – reine Funktionen ohne Gerät.
 *
 * - Bar kassierte Zahlungen auf geschriebene Rechnungen stehen getrennt (`rechnungen_cent`): Bestand ja, Umsatz nein – sonst
 *   zählte derselbe Umsatz doppelt (Rechnung und Kasse).
 * - Je Tag (bei zwei Kassen auch zwei Abschlüsse am selben Tag): Umsatz brutto je Steuersatz wie auf dem Z-Bon, davon
 *   Karte und sonstige Zahlungsarten (bar ist der Rest), Bewegungen der Bargeldkasse (Privatentnahme, Privateinlage,
 *   Geldtransit zur Bank), optional Anfangsbestand (erster Tag), gezählter Endbestand, Z-Bon-Nummer und -Foto.
 * - Ein gespeicherter Abschluss ist festgeschrieben (GoBD: unveränderbar); geändert wird nur per Korrektur mit Grund –
 *   die vorige Fassung bleibt in `historie` erhalten.
 * - Bargeldbestand: Anfangsbestand + Bareinnahmen + Einlagen − Barausgaben (Belege mit Zahlungsweg „bar“ ab dem ersten
 *   Abschluss) − Entnahmen − Geldtransit. Ein negativer Bestand ist nicht möglich (§ 146 Abs. 1 Satz 2 AO,
 *   Kassensturzfähigkeit) – die App warnt. Mit gezähltem Endbestand beginnt der nächste Tag mit dem gezählten Betrag; die
 *   Differenz steht als Kassendifferenz da (gebucht wird sie nicht – PRUEFLISTE).
 * - Umsatzsteuer: Netto je Steuersatz aus der Summe der Bruttobeträge je Kalendermonat herausgerechnet.
 * Fachlich zu prüfen: PRUEFLISTE (R12).
 */
import { belegGezahlt, belegKennung, istBelegDateiname, kategorieFuer, zahltag, type Beleg, type BelegSteuer } from "./belege.js";
import { BUCHUNGSKONTEN, belegfeld1Aus, buchungsGuid, erloeskonto, type Buchung, type Kontenrahmen } from "./buchungen.js";
import { nettoAusBrutto } from "./skonto.js";

/** Steuersätze an der Kasse */
export const KASSE_SAETZE = [19, 7, 0] as const;

export type KassenBewegungsArt = "entnahme" | "einlage" | "transit";
export const KASSEN_BEWEGUNGEN: { wert: KassenBewegungsArt; text: string }[] = [
  { wert: "transit", text: "Geld zur Bank gebracht" },
  { wert: "entnahme", text: "Privatentnahme" },
  { wert: "einlage", text: "Privateinlage (z. B. Wechselgeld)" },
];

export interface KassenBewegung {
  art: KassenBewegungsArt;
  betrag_cent: number;
  text?: string | null;
}

/** Inhalt eines Kassenabschlusses – was festgeschrieben und bei einer Korrektur aufbewahrt wird. */
export interface KassenInhalt {
  /** Tag des Abschlusses (ISO) */
  datum: string;
  /** an diesem Tag geschlossen (kein Umsatz) – zählt als erfasster Tag */
  geschlossen?: boolean;
  /** Nummer des Z-Bons bzw. Tagesabschlusses */
  zbon?: string | null;
  /** Umsatz brutto je Steuersatz wie auf dem Z-Bon */
  umsatz: BelegSteuer[];
  /** davon mit Karte bezahlt (brutto) */
  karte_cent: number;
  /** davon mit sonstigen Zahlungsarten (Gutschein, Rechnung, App) – brutto */
  sonstige_cent: number;
  /**
   * Bar kassierte Zahlungen auf schon geschriebene Rechnungen (brutto) – kein Kassenumsatz (die Rechnung ist der Umsatz),
   * nur ein Zahlungseingang in die Bargeldkasse. Gehört nicht in den Umsatz laut Z-Bon.
   */
  rechnungen_cent?: number | null;
  bewegungen: KassenBewegung[];
  /** Bargeld zu Beginn – nur am ersten Tag nötig, später übernimmt die App den Endbestand des Vortags */
  anfang_cent?: number | null;
  /** gezählter Bargeldbestand am Ende des Tages (Kassensturz) */
  gezaehlt_cent?: number | null;
  /** Foto oder Datei des Z-Bons (Dateiname wie bei Belegen) */
  datei?: string | null;
  notiz?: string | null;
  /** offene Ladenkasse: Tageseinnahmen retrograd aus dem gezählten Bestand ermittelt (Kassenbericht) */
  kassenbericht?: boolean;
  /** TSE-Angaben vom Z-Bon (optional): Seriennummer, erste und letzte Transaktionsnummer */
  tse_seriennr?: string | null;
  tse_von?: string | null;
  tse_bis?: string | null;
  /** Kassenbediener (optional) – zum Abgleich mit den Arbeitszeiten */
  bediener?: string | null;
  /**
   * Betriebsstätte bzw. Filiale (Freitext, später kompatibel mit Betriebsstätten) – jede Filiale hat ihre eigene
   * Bargeldkasse; Bestand und fehlende Tage gelten je Standort. Im DATEV-Stapel als Kostenstelle (KOST1).
   */
  standort?: string | null;
  /** Bezeichnung der Kasse (bei mehreren Kassen je Standort), z. B. „Kasse 2“ */
  kasse_bez?: string | null;
}

/** Frühere Fassung (Korrektur): Inhalt bis `bis`, ersetzt mit Grund. */
export interface KassenFassung extends KassenInhalt {
  bis: string;
  grund: string;
}

export interface Kassenabschluss extends KassenInhalt {
  id: string;
  erstellt: string;
  geaendert: string;
  /** festgeschrieben am (ISO) – danach nur Korrektur mit Grund */
  festgeschrieben?: string;
  historie?: KassenFassung[];
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
const ganz = (w: unknown, min = 0): number | null => (typeof w === "number" && Number.isInteger(w) && w >= min ? w : null);
const textOderNull = (w: unknown, n = 200): string | null => (typeof w === "string" && w.trim() ? w.trim().slice(0, n) : null);

function inhaltAus(r: Record<string, unknown>): KassenInhalt | null {
  if (typeof r.datum !== "string" || !ISO_TAG.test(r.datum)) return null;
  const umsatz = Array.isArray(r.umsatz)
    ? (r.umsatz as unknown[])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .map((x) => ({ satz: Number(x.satz), brutto_cent: Number(x.brutto_cent) }))
        .filter((x) => (KASSE_SAETZE as readonly number[]).includes(x.satz) && Number.isInteger(x.brutto_cent))
    : [];
  const bewegungen = Array.isArray(r.bewegungen)
    ? (r.bewegungen as unknown[])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .filter((x) => KASSEN_BEWEGUNGEN.some((b) => b.wert === x.art) && ganz(x.betrag_cent, 1) !== null)
        .map((x) => ({ art: x.art as KassenBewegungsArt, betrag_cent: x.betrag_cent as number, ...(textOderNull(x.text, 90) ? { text: textOderNull(x.text, 90) } : {}) }))
    : [];
  return {
    datum: r.datum,
    ...(r.geschlossen === true ? { geschlossen: true } : {}),
    zbon: textOderNull(r.zbon, 40),
    umsatz,
    karte_cent: ganz(r.karte_cent) ?? 0,
    sonstige_cent: ganz(r.sonstige_cent) ?? 0,
    ...(ganz(r.rechnungen_cent, 1) ? { rechnungen_cent: ganz(r.rechnungen_cent, 1) } : {}),
    bewegungen,
    anfang_cent: ganz(r.anfang_cent),
    gezaehlt_cent: ganz(r.gezaehlt_cent),
    // nur Namen, wie die App sie vergibt – nie Pfade (wie bei Belegen)
    datei: istBelegDateiname(r.datei) ? r.datei : null,
    notiz: textOderNull(r.notiz, 500),
    ...(r.kassenbericht === true ? { kassenbericht: true } : {}),
    ...zusatzAus(r),
  };
}

const ZUSATZ = ["tse_seriennr", "tse_von", "tse_bis", "bediener", "standort", "kasse_bez"] as const;
function zusatzAus(r: Record<string, unknown>): Partial<KassenInhalt> {
  const o: Partial<Record<(typeof ZUSATZ)[number], string>> = {};
  for (const k of ZUSATZ) {
    const w = textOderNull(r[k], 120);
    if (w) o[k] = w;
  }
  return o;
}

/** Gespeicherten Kassenabschluss prüfen und bereinigen; null, wenn Kernangaben (ID, Datum) fehlen. */
export function kassenabschlussAus(roh: unknown): Kassenabschluss | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  const r = roh as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  const inhalt = inhaltAus(r);
  if (!inhalt) return null;
  const iso = (w: unknown) => (typeof w === "string" && /^\d{4}-\d{2}-\d{2}T/.test(w) ? w : null);
  const erstellt = iso(r.erstellt) ?? iso(r.geaendert) ?? `${inhalt.datum}T00:00:00.000Z`;
  const historie = Array.isArray(r.historie)
    ? (r.historie as unknown[])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .map((x) => {
          const i = inhaltAus(x);
          return i && iso(x.bis) ? { ...i, bis: iso(x.bis)!, grund: textOderNull(x.grund, 300) ?? "ohne Grund" } : null;
        })
        .filter((x): x is KassenFassung => x !== null)
    : [];
  return {
    id: r.id,
    ...inhalt,
    erstellt,
    geaendert: iso(r.geaendert) ?? erstellt,
    // eine Festschreibung geht nie verloren: unlesbarer Zeitpunkt → Zeitpunkt der Erfassung
    ...(r.festgeschrieben ? { festgeschrieben: iso(r.festgeschrieben) ?? erstellt } : {}),
    ...(historie.length ? { historie } : {}),
  };
}

/** Nur der Inhalt (für Vergleich und Historie). */
export function kassenInhalt(k: KassenInhalt): KassenInhalt {
  return {
    datum: k.datum,
    ...(k.geschlossen ? { geschlossen: true } : {}),
    zbon: k.zbon ?? null,
    umsatz: k.umsatz.map((x) => ({ satz: x.satz, brutto_cent: x.brutto_cent })),
    karte_cent: k.karte_cent,
    sonstige_cent: k.sonstige_cent,
    ...(k.rechnungen_cent ? { rechnungen_cent: k.rechnungen_cent } : {}),
    bewegungen: k.bewegungen.map((b) => ({ art: b.art, betrag_cent: b.betrag_cent, ...(b.text ? { text: b.text } : {}) })),
    anfang_cent: k.anfang_cent ?? null,
    gezaehlt_cent: k.gezaehlt_cent ?? null,
    datei: k.datei ?? null,
    notiz: k.notiz ?? null,
    ...(k.kassenbericht ? { kassenbericht: true } : {}),
    ...zusatzAus(k as unknown as Record<string, unknown>),
  };
}
const inhaltText = (k: KassenInhalt) => JSON.stringify(kassenInhalt(k));
export const kassenInhaltGeaendert = (a: KassenInhalt, b: KassenInhalt) => inhaltText(a) !== inhaltText(b);

/** Summen eines Abschlusses: Umsatz brutto, bar, unbar und Bewegungen. */
export function kassenSummen(k: KassenInhalt): { brutto: number; karte: number; sonstige: number; bar: number; rechnungen: number; einlagen: number; entnahmen: number; transit: number } {
  const brutto = k.geschlossen ? 0 : k.umsatz.reduce((a, x) => a + x.brutto_cent, 0);
  const karte = k.geschlossen ? 0 : k.karte_cent;
  const sonstige = k.geschlossen ? 0 : k.sonstige_cent;
  const je = (art: KassenBewegungsArt) => k.bewegungen.filter((b) => b.art === art).reduce((a, b) => a + b.betrag_cent, 0);
  return { brutto, karte, sonstige, bar: brutto - karte - sonstige, rechnungen: k.rechnungen_cent ?? 0, einlagen: je("einlage"), entnahmen: je("entnahme"), transit: je("transit") };
}

/** Was an einem Abschluss nicht stimmt (vor dem Speichern) – als kurze Texte; leer = in Ordnung. */
export function kassenFehler(k: KassenInhalt): string[] {
  const f: string[] = [];
  if (!ISO_TAG.test(k.datum)) f.push("datum");
  const s = kassenSummen(k);
  if (!k.geschlossen && k.umsatz.some((x) => x.brutto_cent < 0)) f.push("umsatz_negativ");
  if (!k.geschlossen && s.karte + s.sonstige > s.brutto) f.push("unbar_zu_hoch");
  return f;
}

/** Korrektur eines festgeschriebenen Abschlusses: der bisherige Inhalt kommt mit Grund in die Historie (GoBD). */
export function kassenKorrektur(k: Kassenabschluss, neu: KassenInhalt, grund: string, jetzt: string): Kassenabschluss {
  if (!kassenInhaltGeaendert(k, neu)) return k;
  const historie = [...(k.historie ?? []), { ...kassenInhalt(k), bis: jetzt, grund: grund.trim().slice(0, 300) || "ohne Grund" }];
  return { ...k, ...kassenInhalt(neu), geaendert: jetzt, historie };
}

const frueher = (x?: string, y?: string) => (x && y ? (x < y ? x : y) : (x ?? y));

/**
 * Zwei Fassungen desselben Abschlusses vereinen (Synchronisation, Sicherung): festgeschrieben schlägt Entwurf; sonst
 * gewinnt die zuletzt geänderte Fassung. Die Historie beider Seiten bleibt vollständig; weicht die unterlegene Fassung
 * ab und steht nicht in der Historie, kommt sie dorthin – so geht keine festgeschriebene Fassung verloren.
 */
export function kassenabschlussVereinen(a: Kassenabschluss, b: Kassenabschluss): Kassenabschluss {
  const fa = Boolean(a.festgeschrieben);
  const fb = Boolean(b.festgeschrieben);
  if (fa !== fb) return fa ? a : b;
  const ta = inhaltText(a);
  const tb = inhaltText(b);
  const [neu, alt] = a.geaendert > b.geaendert || (a.geaendert === b.geaendert && ta >= tb) ? [a, b] : [b, a];
  const schluessel = (h: KassenFassung) => `${h.bis}|${h.grund}|${inhaltText(h)}`;
  const m = new Map<string, KassenFassung>();
  for (const h of [...(alt.historie ?? []), ...(neu.historie ?? [])]) m.set(schluessel(h), h);
  if (fa && fb && ta !== tb && ![...m.values()].some((h) => inhaltText(h) === inhaltText(alt))) {
    const h: KassenFassung = { ...kassenInhalt(alt), bis: neu.geaendert, grund: "Abweichende Fassung von einem anderen Gerät (Synchronisation)" };
    m.set(schluessel(h), h);
  }
  const historie = [...m.values()].sort((x, y) => x.bis.localeCompare(y.bis));
  const fest = frueher(a.festgeschrieben, b.festgeschrieben);
  return { ...neu, ...(fest ? { festgeschrieben: fest } : {}), ...(historie.length ? { historie } : {}) };
}

/** Abschlüsse zweier Stände nach ID vereinen – nie etwas verlieren (Aufbewahrungspflicht). */
export function kassenVereinen(a: readonly Kassenabschluss[], b: readonly Kassenabschluss[]): Kassenabschluss[] {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const l = m.get(x.id);
    m.set(x.id, l ? kassenabschlussVereinen(l, x) : x);
  }
  return kassenSortiert([...m.values()]);
}

/** Nach Tag, dann Erfassung. */
export const kassenSortiert = (l: readonly Kassenabschluss[]) => [...l].sort((x, y) => x.datum.localeCompare(y.datum) || x.erstellt.localeCompare(y.erstellt) || x.id.localeCompare(y.id));

/**
 * Offene Ladenkasse (Kassenbericht, retrograde Ermittlung): Bareinnahmen = gezählter Endbestand − Anfangsbestand
 * + Barausgaben + Privatentnahmen + Geldtransit − Privateinlagen.
 */
export function retrogradeBareinnahmen(o: { anfang: number; gezaehlt: number; ausgaben: number; entnahmen: number; transit: number; einlagen: number }): number {
  return o.gezaehlt - o.anfang + o.ausgaben + o.entnahmen + o.transit - o.einlagen;
}

/**
 * Lücken in der Nummernfolge der Z-Bons (Zoll/Kassennachschau: Nummern sollen lückenlos sein) – nur rein numerische
 * Nummern, in der Reihenfolge der Tage. Liefert die fehlenden Nummern (höchstens 50).
 */
export function zbonLuecken(abschluesse: readonly Kassenabschluss[]): string[] {
  const n = kassenSortiert(abschluesse).map((k) => (k.zbon && /^\d{1,9}$/.test(k.zbon) ? Number(k.zbon) : null)).filter((x): x is number => x !== null);
  const aus: string[] = [];
  const set = new Set(n);
  for (let i = 1; i < n.length; i++) {
    if (n[i]! <= n[i - 1]! || n[i]! - n[i - 1]! > 1000) continue;
    for (let x = n[i - 1]! + 1; x < n[i]! && aus.length < 50; x++) if (!set.has(x)) aus.push(String(x));
  }
  return aus;
}

// ---------------------------------------------------------------- Bargeldbestand

export interface KassenTag {
  datum: string;
  abschluesse: Kassenabschluss[];
  anfang: number;
  einlagen: number;
  einnahmenBar: number;
  barausgaben: Beleg[];
  ausgabenBar: number;
  entnahmen: number;
  transit: number;
  /** rechnerischer Endbestand */
  soll: number;
  gezaehlt: number | null;
  /** gezählt − rechnerisch */
  differenz: number | null;
  /** Bestand, mit dem der nächste Tag beginnt (gezählt, sonst rechnerisch) */
  ende: number;
}

export interface KassenVerlauf {
  tage: KassenTag[];
  /** erster Tag, ab dem Amtlos die Bargeldkasse führt (erster Abschluss) – null ohne Abschluss */
  ab: string | null;
  /** Tage mit negativem rechnerischem Bestand */
  negativ: string[];
  differenzen: { datum: string; cent: number }[];
}

/** Standort eines Abschlusses („“ = Hauptbetrieb ohne Angabe). */
export const standortVon = (k: Pick<KassenInhalt, "standort">) => (k.standort ?? "").trim();
/** Standorte mit Abschlüssen („“ zuerst). */
export const kassenStandorte = (abschluesse: readonly Kassenabschluss[]) => [...new Set(abschluesse.map(standortVon))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "de")));

/** Barbelege, die in der Kasse laufen: gültig, Zahlungsweg bar, Zahltag ab dem ersten Abschluss. */
export const barbelegeInKasse = (belege: readonly Beleg[], ab: string | null) => (ab ? belege.filter((b) => !b.ungueltig && b.zahlung === "bar" && zahltag(b) >= ab) : []);

/** Erster Tag mit einem Kassenabschluss (ab dann führt Amtlos die Kasse) – null ohne Abschluss. */
export const kasseAb = (abschluesse: readonly Kassenabschluss[]) => (abschluesse.length ? abschluesse.reduce((m, k) => (k.datum < m ? k.datum : m), abschluesse[0]!.datum) : null);

/**
 * Bargeldbestand Tag für Tag: Anfangsbestand des ersten Tags (sonst 0) + Einlagen + Bareinnahmen − Barausgaben −
 * Entnahmen − Geldtransit. Tage nur mit Barbelegen (z. B. Einkauf am Ruhetag) zählen mit.
 */
export function kassenVerlauf(alleAbschluesse: readonly Kassenabschluss[], belege: readonly Beleg[] = [], standort = ""): KassenVerlauf {
  // je Standort eine eigene Bargeldkasse; Barbelege (ohne Standort) laufen über die Kasse des Hauptbetriebs
  const abschluesse = alleAbschluesse.filter((k) => standortVon(k) === standort);
  const ab = kasseAb(abschluesse);
  const sortiert = kassenSortiert(abschluesse);
  const bar = standort ? [] : barbelegeInKasse(belege, ab);
  const tageSet = new Set([...sortiert.map((k) => k.datum), ...bar.map(zahltag)]);
  const ersterAnfang = sortiert.find((k) => k.datum === ab && typeof k.anfang_cent === "number")?.anfang_cent ?? 0;
  let bestand = ersterAnfang;
  const tage: KassenTag[] = [];
  const negativ: string[] = [];
  const differenzen: { datum: string; cent: number }[] = [];
  for (const datum of [...tageSet].sort()) {
    const ks = sortiert.filter((k) => k.datum === datum);
    const bs = bar.filter((b) => zahltag(b) === datum);
    const s = ks.map(kassenSummen);
    const summe = (f: (x: ReturnType<typeof kassenSummen>) => number) => s.reduce((a, x) => a + f(x), 0);
    const anfang = bestand;
    const einlagen = summe((x) => x.einlagen);
    // bar kassierte Rechnungen erhöhen den Bestand, sind aber kein Kassenumsatz
    const einnahmenBar = summe((x) => x.bar + x.rechnungen);
    const ausgabenBar = bs.reduce((a, b) => a + belegGezahlt(b), 0);
    const entnahmen = summe((x) => x.entnahmen);
    const transit = summe((x) => x.transit);
    const soll = anfang + einlagen + einnahmenBar - ausgabenBar - entnahmen - transit;
    // gezählt: der letzte Abschluss des Tages mit Zählung
    const gz = [...ks].reverse().find((k) => typeof k.gezaehlt_cent === "number")?.gezaehlt_cent ?? null;
    const differenz = gz === null ? null : gz - soll;
    if (soll < 0) negativ.push(datum);
    if (differenz) differenzen.push({ datum, cent: differenz });
    bestand = gz ?? soll;
    tage.push({ datum, abschluesse: ks, anfang, einlagen, einnahmenBar, barausgaben: bs, ausgabenBar, entnahmen, transit, soll, gezaehlt: gz, differenz, ende: bestand });
  }
  return { tage, ab, negativ, differenzen };
}

/** Negative Bestände und Differenzen aller Standorte (Datum ggf. mit Standort). */
export function kassenWarnungen(abschluesse: readonly Kassenabschluss[], belege: readonly Beleg[] = []): { negativ: { datum: string; standort: string }[]; differenzen: { datum: string; cent: number; standort: string }[] } {
  const negativ: { datum: string; standort: string }[] = [];
  const differenzen: { datum: string; cent: number; standort: string }[] = [];
  for (const st of kassenStandorte(abschluesse)) {
    const v = kassenVerlauf(abschluesse, belege, st);
    negativ.push(...v.negativ.map((datum) => ({ datum, standort: st })));
    differenzen.push(...v.differenzen.map((d) => ({ ...d, standort: st })));
  }
  return { negativ: negativ.sort((a, b) => a.datum.localeCompare(b.datum)), differenzen: differenzen.sort((a, b) => a.datum.localeCompare(b.datum)) };
}

/** Bargeld zu Beginn eines Tages (Endbestand des letzten Tags davor, bzw. Anfangsbestand) – null, solange es keinen Abschluss gibt. */
export function bestandVor(v: KassenVerlauf, datum: string): number | null {
  if (!v.ab) return null;
  const vorher = v.tage.filter((t) => t.datum < datum);
  return vorher.length ? vorher[vorher.length - 1]!.ende : (v.tage[0]?.anfang ?? 0);
}

// ---------------------------------------------------------------- fehlende Tage

const tagPlus = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const wochentag = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/**
 * Tage ohne Kassenabschluss zwischen `von` und `bis` (jeweils einschließlich), nur vor `heute` (der laufende Tag ist
 * noch nicht abgeschlossen). Ruhetage (Wochentage 0 = Sonntag … 6 = Samstag) und als geschlossen erfasste Tage zählen als erfasst.
 */
export function fehlendeTage(abschluesse: readonly Kassenabschluss[], von: string, bis: string, ruhetage: readonly number[] = [], heute?: string): string[] {
  // mehrere Filialen: ein Tag fehlt, sobald er bei einem Standort fehlt (dessen Umsatz fehlt dann)
  const standorte = abschluesse.length ? kassenStandorte(abschluesse) : [""];
  const da = standorte.map((st) => new Set(abschluesse.filter((k) => standortVon(k) === st).map((k) => k.datum)));
  const aus: string[] = [];
  const ende = heute && tagPlus(heute, -1) < bis ? tagPlus(heute, -1) : bis;
  for (let d = von; d <= ende; d = tagPlus(d, 1)) if (!ruhetage.includes(wochentag(d)) && da.some((x) => !x.has(d))) aus.push(d);
  return aus;
}

const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const dmj = (iso: string) => `${dm(iso)}${iso.slice(0, 4)}`;

/** Tage zusammengefasst: „03.05.–05.05.2026, 12.05.2026“; mehr als `max` Abschnitte: „… und n weitere Tage“. */
export function tageText(tage: readonly string[], max = 6): string {
  const s = [...new Set(tage)].sort();
  const abschnitte: [string, string][] = [];
  for (const d of s) {
    const letzter = abschnitte[abschnitte.length - 1];
    if (letzter && tagPlus(letzter[1], 1) === d) letzter[1] = d;
    else abschnitte.push([d, d]);
  }
  const text = abschnitte.slice(0, max).map(([a, b]) => (a === b ? dmj(a) : `${a.slice(0, 4) === b.slice(0, 4) ? dm(a) : dmj(a)}–${dmj(b)}`));
  const rest = abschnitte.slice(max).reduce((n, [a, b]) => n + Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1, 0);
  return `${text.join(", ")}${rest ? ` und ${rest} ${rest === 1 ? "weiterer Tag" : "weitere Tage"}` : ""}`;
}

// ---------------------------------------------------------------- Umsatzsteuer und EÜR

export interface KassenUmsatz {
  /** je Steuersatz: brutto, netto, Steuer (Kleinunternehmer: alles unter 0 %, ohne Steuer) */
  je: Record<19 | 7 | 0, { brutto: number; netto: number; ust: number }>;
  /** Abschlüsse mit Umsatz im Zeitraum */
  tage: number;
}

/**
 * Kassenumsätze eines Zeitraums nach Tag des Abschlusses: Brutto je Steuersatz und Kalendermonat summiert, Netto daraus
 * herausgerechnet (der Z-Bon weist brutto aus). `ku`: Kleinunternehmer – keine Umsatzsteuer, alles unter 0 %.
 */
export function kassenUmsatz(abschluesse: readonly Kassenabschluss[], von: string, bis: string, ku = false): KassenUmsatz {
  const je: KassenUmsatz["je"] = { 19: { brutto: 0, netto: 0, ust: 0 }, 7: { brutto: 0, netto: 0, ust: 0 }, 0: { brutto: 0, netto: 0, ust: 0 } };
  const monate = new Map<string, Record<number, number>>();
  let tage = 0;
  for (const k of abschluesse) {
    if (k.geschlossen || k.datum < von || k.datum > bis) continue;
    const m = monate.get(k.datum.slice(0, 7)) ?? {};
    let mit = false;
    for (const u of k.umsatz) {
      if (!u.brutto_cent) continue;
      const satz = ku ? 0 : u.satz;
      m[satz] = (m[satz] ?? 0) + u.brutto_cent;
      mit = true;
    }
    monate.set(k.datum.slice(0, 7), m);
    if (mit) tage++;
  }
  for (const m of monate.values())
    for (const satz of KASSE_SAETZE) {
      const b = m[satz] ?? 0;
      if (!b) continue;
      const n = nettoAusBrutto(b, satz);
      je[satz].brutto += b;
      je[satz].netto += n;
      je[satz].ust += b - n;
    }
  return { je, tage };
}

// ---------------------------------------------------------------- Kassenbuch (Vorlage „kassenbuch“)

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const monatsName = (monat: string) => `${MONATE[Number(monat.slice(5, 7)) - 1] ?? ""} ${monat.slice(0, 4)}`;
/** Betrag für Formularfelder: „1234,56“ (ohne Tausenderpunkt, wie die Eingabe) */
const feldBetrag = (c: number) => `${c < 0 ? "-" : ""}${Math.floor(Math.abs(c) / 100)},${String(Math.abs(c) % 100).padStart(2, "0")}`;

/**
 * Daten für die Vorlage „Kassenbuch“ eines Monats (JJJJ-MM) aus den Abschlüssen und Barbelegen: Anfangsbestand und je
 * Tag Einlagen, Bareinnahmen laut Z-Bon, Barausgaben (Belege), Entnahmen, Geldtransit und Kassendifferenz.
 */
export function kassenbuchDaten(abschluesse: readonly Kassenabschluss[], belege: readonly Beleg[], monat: string, nummern: Map<string, string> = new Map(), standort = ""): { zeitraum: string; anfang: string; eintraege: Record<string, string>[] } | null {
  const v = kassenVerlauf(abschluesse, belege, standort);
  const tage = v.tage.filter((t) => t.datum.startsWith(`${monat}-`));
  if (!tage.length) return null;
  const eintraege: Record<string, string>[] = [];
  const zeile = (datum: string, beleg: string, text: string, ein: number, aus: number) => eintraege.push({ datum, beleg, text, einnahme: ein ? feldBetrag(ein) : "", ausgabe: aus ? feldBetrag(aus) : "" });
  const bewegungText = { einlage: "Privateinlage", entnahme: "Privatentnahme", transit: "Geldtransit zur Bank" } as const;
  for (const t of tage) {
    for (const k of t.abschluesse) for (const b of k.bewegungen.filter((x) => x.art === "einlage")) zeile(t.datum, "", b.text ? `${bewegungText.einlage}: ${b.text}` : bewegungText.einlage, b.betrag_cent, 0);
    for (const k of t.abschluesse) {
      const s = kassenSummen(k);
      if (k.geschlossen) continue;
      if (s.bar) zeile(t.datum, k.zbon ? `Z ${k.zbon}` : "", k.zbon ? `Tageseinnahmen bar lt. Z-Bon Nr. ${k.zbon}` : "Tageseinnahmen bar (Kassenabschluss)", s.bar > 0 ? s.bar : 0, s.bar < 0 ? -s.bar : 0);
      if (s.rechnungen) zeile(t.datum, "", "Barzahlungen auf Rechnungen (Zahlungseingang, kein Kassenumsatz)", s.rechnungen, 0);
    }
    for (const b of t.barausgaben) zeile(t.datum, belegKennung(b, nummern.get(b.id) ?? ""), `${b.lieferant.trim() || "Barbeleg"}: ${kategorieFuer(b.kategorie).titel}`.slice(0, 90), 0, belegGezahlt(b));
    for (const art of ["entnahme", "transit"] as const) for (const k of t.abschluesse) for (const b of k.bewegungen.filter((x) => x.art === art)) zeile(t.datum, "", b.text ? `${bewegungText[art]}: ${b.text}` : bewegungText[art], 0, b.betrag_cent);
    if (t.differenz) zeile(t.datum, "", "Kassendifferenz laut Zählung", t.differenz > 0 ? t.differenz : 0, t.differenz < 0 ? -t.differenz : 0);
  }
  return { zeitraum: `${monatsName(monat)}${standort ? ` · ${standort}` : ""}`, anfang: feldBetrag(tage[0]!.anfang), eintraege };
}

// ---------------------------------------------------------------- Buchungen (DATEV-Stapel)

/** Kostenstelle (KOST1) aus dem Standort: Buchstaben und Ziffern, höchstens 8 Zeichen (PRUEFLISTE: mit der Kanzlei abstimmen). */
export const kostenstelle = (standort: string) => belegfeld1Aus(standort).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);

/**
 * Buchungen der Kassenabschlüsse: je Tag und Steuersatz Kasse an Erlöse (brutto, Automatik), der Kartenanteil und
 * sonstige Zahlungsarten Geldtransit an Kasse, Bargeld zur Bank Geldtransit an Kasse, Privatentnahme an Kasse, Kasse an
 * Privateinlage. Leistungsdatum und „Datum Zuord. Steuerperiode“ = Tag des Abschlusses. Kassendifferenzen werden nicht
 * gebucht (PRUEFLISTE).
 */
export function kassenBuchungen(abschluesse: readonly Kassenabschluss[], kontenrahmen: Kontenrahmen, o: { kleinunternehmer?: boolean } = {}): Buchung[] {
  const k = BUCHUNGSKONTEN[kontenrahmen];
  const aus: Buchung[] = [];
  for (const a of kassenSortiert(abschluesse)) {
    if (a.geschlossen && !a.bewegungen.length) continue;
    const beleg = belegfeld1Aus(a.zbon ? `Z${a.zbon}` : `KA${a.datum.replace(/-/g, "")}`);
    const kost1 = standortVon(a) ? kostenstelle(standortVon(a)) : undefined;
    const basis = { datum: a.datum, bu_schluessel: "", belegfeld1: beleg, quelle_id: a.id, leistungsdatum: a.datum, steuerperiode: a.datum, ...(kost1 ? { kost1 } : {}) };
    const zb = a.zbon ? ` Z-Bon ${a.zbon}` : "";
    if (!a.geschlossen)
      for (const u of a.umsatz) {
        if (!u.brutto_cent) continue;
        const satz = o.kleinunternehmer ? null : u.satz;
        aus.push({ ...basis, betrag_cent: Math.abs(u.brutto_cent), soll_haben: u.brutto_cent < 0 ? "H" : "S", konto: k.kasse, gegenkonto: erloeskonto(k, satz), buchungstext: `Tageseinnahmen ${satz === null ? "§ 19" : `${satz} %`}${zb}`.slice(0, 60), ust_satz: satz, art: "einnahme", guid: buchungsGuid(`${a.id}|umsatz`, satz) });
      }
    const s = kassenSummen(a);
    const unbar = s.karte + s.sonstige;
    // bar kassierte Rechnungen: Kasse an Forderungen (der Umsatz steht schon mit der Rechnung im Stapel)
    if (s.rechnungen) aus.push({ ...basis, betrag_cent: s.rechnungen, soll_haben: "S", konto: k.kasse, gegenkonto: k.forderungen, buchungstext: `Barzahlungen auf Rechnungen${zb}`.slice(0, 60), ust_satz: null, art: "umbuchung", guid: buchungsGuid(`${a.id}|rechnungen`, null), leistungsdatum: null, steuerperiode: null });
    if (unbar) aus.push({ ...basis, betrag_cent: unbar, soll_haben: "S", konto: k.geldtransit, gegenkonto: k.kasse, buchungstext: `Kartenzahlungen u. a.${zb}`.slice(0, 60), ust_satz: null, art: "umbuchung", guid: buchungsGuid(`${a.id}|unbar`, null) });
    a.bewegungen.forEach((b, i) => {
      const [konto, gegen, text] = b.art === "entnahme" ? [k.privatentnahmen, k.kasse, "Privatentnahme Kasse"] : b.art === "einlage" ? [k.kasse, k.privateinlagen, "Privateinlage Kasse"] : [k.geldtransit, k.kasse, "Geldtransit Kasse an Bank"];
      aus.push({ ...basis, betrag_cent: b.betrag_cent, soll_haben: "S", konto, gegenkonto: gegen, buchungstext: text, ust_satz: null, art: "umbuchung", guid: buchungsGuid(`${a.id}|bewegung|${i}`, null), leistungsdatum: null, steuerperiode: null });
    });
  }
  return aus;
}
