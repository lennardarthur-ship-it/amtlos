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
 *
 * R12 GoBD (interne Prüfrunde Steuern und Betriebsprüfung – nicht von der Steuerberatung bestätigt, PRUEFLISTE T-118):
 * - Kartentrinkgeld (`trinkgeld_cent`): im Kartenbetrag enthalten, an das Personal bar ausgezahlt – durchlaufend, kein
 *   Umsatz, keine Umsatzsteuer (§ 3 Nr. 51 EStG beim Personal). Die Kasse verliert den Betrag, die Bank bekommt ihn.
 * - Zahlungsarten getrennt: Karte und App (Geldtransit), „auf Rechnung“ (Forderungen), Gutscheine (Einzweck: Umsatz beim
 *   Verkauf, § 3 Abs. 14 UStG – die Einlösung ist kein zweiter Umsatz; Mehrzweck: Verkauf kein Umsatz, sondern
 *   Verbindlichkeit, Umsatz erst bei der Einlösung, § 3 Abs. 15 UStG). `sonstige_cent` nur noch aus älteren Daten.
 * - Im Stapel geht nur Bargeld über die Kasse: der Kartenanteil steht direkt „Geldtransit an Erlöse“ (BMF 29.06.2018),
 *   je Steuersatz im Verhältnis der Umsätze aufgeteilt (PRUEFLISTE).
 * - Kassendifferenzen werden gebucht (Überschuss als Erlös 19 %, Fehlbetrag als sonstiger Aufwand – mit der Kanzlei
 *   abstimmen), damit Kassenbuch und Kassenkonto übereinstimmen.
 * - Bewegungen (Bank, Entnahme, Einlage) tragen eine fortlaufende Eigenbeleg-Nummer („EB2026-001“) und optional ein Foto.
 * Fachlich zu prüfen: PRUEFLISTE (R12).
 */
import { belegGezahlt, belegKennung, istBelegDateiname, kategorieFuer, zahltag, type Beleg, type BelegSteuer } from "./belege.js";
import { belegfeld1Aus, buchungsGuid, erloeskonto, kontenFuer, type Buchung, type BuchungsOptionen, type Kontenrahmen } from "./buchungen.js";
import { aufteilen, nettoAusBrutto } from "./skonto.js";

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
  /** R12 GoBD: fortlaufende Eigenbeleg-Nummer („EB2026-001“), beim Speichern vergeben und danach nie geändert */
  beleg_nr?: string | null;
  /** R12 GoBD: Foto der Einzahlungsquittung bzw. des Eigenbelegs (Dateiname wie bei Belegen) */
  datei?: string | null;
}

/** R12 GoBD: Gutschein an der Kasse – Einzweck (Umsatz beim Verkauf) oder Mehrzweck (Umsatz bei der Einlösung). */
export type GutscheinArt = "einzweck" | "mehrzweck";
export interface KassenGutschein {
  vorgang: "verkauf" | "einloesung";
  art: GutscheinArt;
  /** Steuersatz eines Einzweck-Gutscheins (steht beim Verkauf fest); bei Mehrzweck ohne Bedeutung */
  satz?: number | null;
  betrag_cent: number;
}

/** R12 GoBD: bar bezahlte, schon in Amtlos geschriebene Rechnung (statt eines freien Betrags). */
export interface BarRechnung {
  id: string;
  nummer: string;
  betrag_cent: number;
}

/** Mindestlänge eines Grunds (Korrektur, Nacherfassung) – „x“ genügt nicht (Betriebsprüfung R12). */
export const GRUND_MIN = 10;
/** Ab so vielen Tagen zwischen Geschäftstag und Erfassung gilt ein Abschluss als nacherfasst (§ 146 Abs. 1 Satz 2 AO). */
export const NACHERFASST_AB_TAGEN = 2;

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
  /** davon mit sonstigen Zahlungsarten – nur noch aus älteren Daten (seit R12 GoBD getrennt: App, auf Rechnung, Gutschein) */
  sonstige_cent: number;
  /** R12 GoBD: im Kartenbetrag enthaltenes Trinkgeld, an das Personal bar ausgezahlt (durchlaufend, kein Umsatz) */
  trinkgeld_cent?: number | null;
  /** R12 GoBD: per App bzw. online bezahlt (wie Karte über Geldtransit) */
  app_cent?: number | null;
  /** R12 GoBD: „auf Rechnung“ verkauft, ohne Rechnung in Amtlos (Forderung) */
  aufrechnung_cent?: number | null;
  /** R12 GoBD: Gutscheine verkauft bzw. eingelöst */
  gutscheine?: KassenGutschein[];
  /** R12 GoBD: bar kassierte Rechnungen aus Amtlos (Nummer und Betrag); `rechnungen_cent` ist ihre Summe */
  rechnungen_bar?: BarRechnung[];
  /** R12 GoBD: Grund einer Nacherfassung (Erfassung mehr als einen Tag nach dem Geschäftstag) */
  nacherfasst_grund?: string | null;
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
        .map((x): KassenBewegung => bewegungSauber({ art: x.art as KassenBewegungsArt, betrag_cent: x.betrag_cent as number, text: x.text as string, beleg_nr: x.beleg_nr as string, datei: x.datei as string }))
    : [];
  const gutscheine = Array.isArray(r.gutscheine)
    ? (r.gutscheine as unknown[])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .filter((x) => (x.vorgang === "verkauf" || x.vorgang === "einloesung") && (x.art === "einzweck" || x.art === "mehrzweck") && ganz(x.betrag_cent, 1) !== null)
        .map((x): KassenGutschein => ({ vorgang: x.vorgang as KassenGutschein["vorgang"], art: x.art as GutscheinArt, betrag_cent: x.betrag_cent as number, ...(x.art === "einzweck" ? { satz: (KASSE_SAETZE as readonly number[]).includes(Number(x.satz)) ? Number(x.satz) : 19 } : {}) }))
    : [];
  const rechnungenBar = Array.isArray(r.rechnungen_bar)
    ? (r.rechnungen_bar as unknown[])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
        .filter((x) => typeof x.id === "string" && x.id && ganz(x.betrag_cent, 1) !== null)
        .map((x): BarRechnung => ({ id: x.id as string, nummer: textOderNull(x.nummer, 40) ?? "", betrag_cent: x.betrag_cent as number }))
    : [];
  return {
    datum: r.datum,
    ...(r.geschlossen === true ? { geschlossen: true } : {}),
    zbon: textOderNull(r.zbon, 40),
    umsatz,
    karte_cent: ganz(r.karte_cent) ?? 0,
    sonstige_cent: ganz(r.sonstige_cent) ?? 0,
    ...(ganz(r.trinkgeld_cent, 1) ? { trinkgeld_cent: ganz(r.trinkgeld_cent, 1) } : {}),
    ...(ganz(r.app_cent, 1) ? { app_cent: ganz(r.app_cent, 1) } : {}),
    ...(ganz(r.aufrechnung_cent, 1) ? { aufrechnung_cent: ganz(r.aufrechnung_cent, 1) } : {}),
    ...(gutscheine.length ? { gutscheine } : {}),
    ...(rechnungenBar.length ? { rechnungen_bar: rechnungenBar } : {}),
    // bar kassierte Rechnungen: die Summe der einzelnen Rechnungen, sonst der frei eingetragene Betrag (ältere Daten)
    ...(rechnungenBar.length ? { rechnungen_cent: rechnungenBar.reduce((a, x) => a + x.betrag_cent, 0) } : ganz(r.rechnungen_cent, 1) ? { rechnungen_cent: ganz(r.rechnungen_cent, 1) } : {}),
    ...(textOderNull(r.nacherfasst_grund, 300) ? { nacherfasst_grund: textOderNull(r.nacherfasst_grund, 300) } : {}),
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

/** Bewegung bereinigen: Text höchstens 90 Zeichen, Eigenbeleg-Nummer höchstens 20, Datei nur als Name aus der App. */
function bewegungSauber(b: KassenBewegung): KassenBewegung {
  const text = textOderNull(b.text, 90);
  const nr = textOderNull(b.beleg_nr, 20);
  return { art: b.art, betrag_cent: b.betrag_cent, ...(text ? { text } : {}), ...(nr ? { beleg_nr: nr } : {}), ...(istBelegDateiname(b.datei) ? { datei: b.datei } : {}) };
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
    ...(k.trinkgeld_cent ? { trinkgeld_cent: k.trinkgeld_cent } : {}),
    ...(k.app_cent ? { app_cent: k.app_cent } : {}),
    ...(k.aufrechnung_cent ? { aufrechnung_cent: k.aufrechnung_cent } : {}),
    ...(k.gutscheine?.length ? { gutscheine: k.gutscheine.map((g) => ({ vorgang: g.vorgang, art: g.art, betrag_cent: g.betrag_cent, ...(g.art === "einzweck" ? { satz: g.satz ?? 19 } : {}) })) } : {}),
    ...(k.rechnungen_bar?.length ? { rechnungen_bar: k.rechnungen_bar.map((x) => ({ id: x.id, nummer: x.nummer, betrag_cent: x.betrag_cent })) } : {}),
    ...(k.rechnungen_bar?.length ? { rechnungen_cent: k.rechnungen_bar.reduce((a, x) => a + x.betrag_cent, 0) } : k.rechnungen_cent ? { rechnungen_cent: k.rechnungen_cent } : {}),
    ...(k.nacherfasst_grund ? { nacherfasst_grund: k.nacherfasst_grund } : {}),
    bewegungen: k.bewegungen.map(bewegungSauber),
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

export interface KassenSummen {
  /** Umsatz laut Z-Bon (brutto, alle Sätze) – ohne Gutscheinverkäufe */
  brutto: number;
  /** Kartenbetrag laut Terminal, mit Trinkgeld */
  karte: number;
  /** davon Trinkgeld, an das Personal bar ausgezahlt */
  trinkgeld: number;
  app: number;
  aufrechnung: number;
  /** ältere Daten: sonstige Zahlungsarten */
  sonstige: number;
  /** Gutscheine verkauft (Einzweck, Mehrzweck) und eingelöst (Einzweck, Mehrzweck) */
  gsVerkaufEz: number;
  gsVerkaufMz: number;
  gsEinlEz: number;
  gsEinlMz: number;
  /** bar eingenommen aus Umsatz und Gutscheinverkauf (ohne bar kassierte Rechnungen) */
  bar: number;
  rechnungen: number;
  einlagen: number;
  entnahmen: number;
  transit: number;
}

/** Gutscheinsumme eines Abschlusses je Vorgang und Art (bei Einzweck optional nur ein Steuersatz). */
export const gutscheinSumme = (k: Pick<KassenInhalt, "gutscheine" | "geschlossen">, vorgang: KassenGutschein["vorgang"], art: GutscheinArt, satz?: number) => (k.geschlossen ? 0 : (k.gutscheine ?? []).filter((g) => g.vorgang === vorgang && g.art === art && (satz === undefined || (g.satz ?? 19) === satz)).reduce((a, g) => a + g.betrag_cent, 0));

/**
 * Summen eines Abschlusses. Bar (Umsatz) = Umsatz + Gutscheinverkäufe − (Karte − Trinkgeld) − App − auf Rechnung −
 * sonstige − eingelöste Gutscheine. Das Trinkgeld verlässt die Kasse eigens (an das Personal).
 */
export function kassenSummen(k: KassenInhalt): KassenSummen {
  const zu = k.geschlossen;
  const brutto = zu ? 0 : k.umsatz.reduce((a, x) => a + x.brutto_cent, 0);
  const karte = zu ? 0 : k.karte_cent;
  const trinkgeld = zu ? 0 : (k.trinkgeld_cent ?? 0);
  const app = zu ? 0 : (k.app_cent ?? 0);
  const aufrechnung = zu ? 0 : (k.aufrechnung_cent ?? 0);
  const sonstige = zu ? 0 : k.sonstige_cent;
  const gsVerkaufEz = gutscheinSumme(k, "verkauf", "einzweck");
  const gsVerkaufMz = gutscheinSumme(k, "verkauf", "mehrzweck");
  const gsEinlEz = gutscheinSumme(k, "einloesung", "einzweck");
  const gsEinlMz = gutscheinSumme(k, "einloesung", "mehrzweck");
  const je = (art: KassenBewegungsArt) => k.bewegungen.filter((b) => b.art === art).reduce((a, b) => a + b.betrag_cent, 0);
  const bar = brutto + gsVerkaufEz + gsVerkaufMz - (karte - trinkgeld) - app - aufrechnung - sonstige - gsEinlEz - gsEinlMz;
  return { brutto, karte, trinkgeld, app, aufrechnung, sonstige, gsVerkaufEz, gsVerkaufMz, gsEinlEz, gsEinlMz, bar, rechnungen: k.rechnungen_cent ?? 0, einlagen: je("einlage"), entnahmen: je("entnahme"), transit: je("transit") };
}

/**
 * Steuerbarer Kassenumsatz je Steuersatz (brutto): Umsatz laut Z-Bon minus eingelöste Einzweck-Gutscheine (schon beim
 * Verkauf versteuert, § 3 Abs. 14 UStG) plus verkaufte Einzweck-Gutscheine. Mehrzweck-Gutscheine: Verkauf kein Umsatz,
 * die Einlösung steht im Umsatz laut Z-Bon (§ 3 Abs. 15 UStG).
 */
export function kassenUmsatzJeSatz(k: KassenInhalt): Record<number, number> {
  const aus: Record<number, number> = {};
  if (k.geschlossen) return aus;
  for (const u of k.umsatz) aus[u.satz] = (aus[u.satz] ?? 0) + u.brutto_cent;
  for (const g of k.gutscheine ?? []) {
    if (g.art !== "einzweck") continue;
    const satz = g.satz ?? 19;
    aus[satz] = (aus[satz] ?? 0) + (g.vorgang === "verkauf" ? g.betrag_cent : -g.betrag_cent);
  }
  return aus;
}

/**
 * Was an einem Abschluss nicht stimmt (vor dem Speichern) – als kurze Schlüssel; leer = in Ordnung. Mit `heute`
 * (YYYY-MM-DD) ist ein Tag in der Zukunft ein Fehler (§ 146 Abs. 1 Satz 2 AO: Aufzeichnungen nach dem Geschäftsvorfall).
 */
export function kassenFehler(k: KassenInhalt, heute?: string): string[] {
  const f: string[] = [];
  if (!ISO_TAG.test(k.datum)) f.push("datum");
  if (heute && k.datum > heute) f.push("zukunft");
  const s = kassenSummen(k);
  if (!k.geschlossen && k.umsatz.some((x) => x.brutto_cent < 0)) f.push("umsatz_negativ");
  if (s.trinkgeld > s.karte) f.push("trinkgeld_zu_hoch");
  if (!k.geschlossen && s.karte - s.trinkgeld + s.app + s.aufrechnung + s.sonstige + s.gsEinlEz + s.gsEinlMz > s.brutto + s.gsVerkaufEz + s.gsVerkaufMz) f.push("unbar_zu_hoch");
  // eingelöste Einzweck-Gutscheine stecken im Umsatz laut Z-Bon – mehr als dort je Satz steht, geht nicht
  if (!k.geschlossen && Object.values(kassenUmsatzJeSatz(k)).some((x) => x < 0)) f.push("gutschein_zu_hoch");
  return f;
}

/** Tag (YYYY-MM-DD) eines ISO-Zeitpunkts in Deutschland. */
const BERLIN = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
export const berlinTag = (iso: string) => BERLIN.format(new Date(iso));
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);

/**
 * Nacherfasst: Tage zwischen Geschäftstag und Erfassung, wenn es mindestens `NACHERFASST_AB_TAGEN` sind (sonst 0).
 * `erfasst` als ISO-Zeitpunkt (Erfassung) oder YYYY-MM-DD (heute, beim Erfassen).
 */
export function nacherfasstTage(datum: string, erfasst: string): number {
  const t = tageZwischen(datum, erfasst.length > 10 ? berlinTag(erfasst) : erfasst);
  return t >= NACHERFASST_AB_TAGEN ? t : 0;
}

/** Grund lang genug (Korrektur, Nacherfassung)? */
export const grundGenuegt = (grund: string | null | undefined) => (grund ?? "").trim().length >= GRUND_MIN;

/**
 * R12 GoBD: Eigenbeleg-Nummern für neue Bewegungen vergeben – fortlaufend je Jahr („EB2026-001“), nach der höchsten
 * schon vergebenen Nummer aller Abschlüsse (auch aus der Historie). Vorhandene Nummern bleiben, wie sie sind.
 */
export function eigenbelegeVergeben(inhalt: KassenInhalt, alle: readonly Kassenabschluss[]): KassenInhalt {
  if (!inhalt.bewegungen.some((b) => !b.beleg_nr)) return inhalt;
  const jahr = inhalt.datum.slice(0, 4);
  const muster = new RegExp(`^EB${jahr}-(\\d+)$`);
  let max = 0;
  const nummern = (k: KassenInhalt) => k.bewegungen.map((b) => b.beleg_nr ?? "");
  for (const k of alle) for (const n of [...nummern(k), ...(k.historie ?? []).flatMap(nummern)]) max = Math.max(max, Number(muster.exec(n)?.[1] ?? 0));
  for (const n of nummern(inhalt)) max = Math.max(max, Number(muster.exec(n)?.[1] ?? 0));
  return { ...inhalt, bewegungen: inhalt.bewegungen.map((b) => (b.beleg_nr ? b : { ...b, beleg_nr: `EB${jahr}-${String(++max).padStart(3, "0")}` })) };
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
  /** R12 GoBD: Kartentrinkgeld, bar an das Personal ausgezahlt */
  trinkgeld: number;
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
    const trinkgeld = summe((x) => x.trinkgeld);
    const soll = anfang + einlagen + einnahmenBar - ausgabenBar - entnahmen - transit - trinkgeld;
    // gezählt: der letzte Abschluss des Tages mit Zählung
    const gz = [...ks].reverse().find((k) => typeof k.gezaehlt_cent === "number")?.gezaehlt_cent ?? null;
    const differenz = gz === null ? null : gz - soll;
    if (soll < 0) negativ.push(datum);
    if (differenz) differenzen.push({ datum, cent: differenz });
    bestand = gz ?? soll;
    tage.push({ datum, abschluesse: ks, anfang, einlagen, einnahmenBar, barausgaben: bs, ausgabenBar, entnahmen, transit, trinkgeld, soll, gezaehlt: gz, differenz, ende: bestand });
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
export function kassenUmsatz(abschluesse: readonly Kassenabschluss[], von: string, bis: string, ku = false, o: { ueberschuesse?: readonly { datum: string; cent: number }[] } = {}): KassenUmsatz {
  const je: KassenUmsatz["je"] = { 19: { brutto: 0, netto: 0, ust: 0 }, 7: { brutto: 0, netto: 0, ust: 0 }, 0: { brutto: 0, netto: 0, ust: 0 } };
  const monate = new Map<string, Record<number, number>>();
  let tage = 0;
  for (const k of abschluesse) {
    if (k.geschlossen || k.datum < von || k.datum > bis) continue;
    const m = monate.get(k.datum.slice(0, 7)) ?? {};
    let mit = false;
    // R12 GoBD: steuerbarer Umsatz – eingelöste Einzweck-Gutscheine heraus, verkaufte hinein
    for (const [s, b] of Object.entries(kassenUmsatzJeSatz(k))) {
      if (!b) continue;
      const satz = ku ? 0 : Number(s);
      m[satz] = (m[satz] ?? 0) + b;
      mit = true;
    }
    monate.set(k.datum.slice(0, 7), m);
    if (mit) tage++;
  }
  // R12 GoBD: Kassenüberschüsse laut Zählung wie im Stapel als Erlös zum Regelsatz (PRUEFLISTE – mit der Kanzlei abstimmen)
  for (const d of o.ueberschuesse ?? []) {
    if (d.cent <= 0 || d.datum < von || d.datum > bis) continue;
    const m = monate.get(d.datum.slice(0, 7)) ?? {};
    const satz = ku ? 0 : 19;
    m[satz] = (m[satz] ?? 0) + d.cent;
    monate.set(d.datum.slice(0, 7), m);
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

const ZEIT_BERLIN = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** Zeitpunkt in Deutschland: „21.10.2026, 22:14“ */
export const zeitDe = (iso: string) => ZEIT_BERLIN.format(new Date(iso));

/**
 * R12 GoBD: Vermerk zu einem Abschluss für Kassenbuch und Listen – „erfasst am …“, „festgeschrieben am …“ (wenn
 * abweichend), „nacherfasst (n Tage): Grund“, „korrigiert am …: Grund“.
 */
export function kassenVermerk(k: Kassenabschluss): string {
  const teile = [`erfasst ${zeitDe(k.erstellt)}`];
  if (k.festgeschrieben && k.festgeschrieben.slice(0, 16) !== k.erstellt.slice(0, 16)) teile.push(`festgeschrieben ${zeitDe(k.festgeschrieben)}`);
  const n = nacherfasstTage(k.datum, k.erstellt);
  if (n) teile.push(`nacherfasst (${n} Tage nach dem Geschäftstag)${k.nacherfasst_grund ? `: ${k.nacherfasst_grund}` : ""}`);
  for (const h of k.historie ?? []) teile.push(`korrigiert am ${zeitDe(h.bis)}: ${h.grund}`);
  return teile.join(" · ");
}

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
  const bewegungZeile = (datum: string, b: KassenBewegung) => zeile(datum, b.beleg_nr ?? "", `${b.text ? `${bewegungText[b.art]}: ${b.text}` : bewegungText[b.art]}${b.datei ? " (Beleg als Foto)" : ""}`, b.art === "einlage" ? b.betrag_cent : 0, b.art === "einlage" ? 0 : b.betrag_cent);
  for (const t of tage) {
    for (const k of t.abschluesse) for (const b of k.bewegungen.filter((x) => x.art === "einlage")) bewegungZeile(t.datum, b);
    for (const k of t.abschluesse) {
      const s = kassenSummen(k);
      // R12 GoBD: Erfassung, Festschreibung, Nacherfassung und Korrekturen stehen im Kassenbuch (nicht nur in der CSV)
      const vermerk = kassenVermerk(k);
      if (k.geschlossen) {
        if (vermerk.includes("korrigiert") || vermerk.includes("nacherfasst")) zeile(t.datum, "", `Geschlossen (kein Umsatz) · ${vermerk}`, 0, 0);
        continue;
      }
      if (s.bar || vermerk) zeile(t.datum, k.zbon ? `Z ${k.zbon}` : "", `${k.zbon ? `Tageseinnahmen bar lt. Z-Bon Nr. ${k.zbon}` : k.kassenbericht ? "Tageseinnahmen bar (Kassenbericht)" : "Tageseinnahmen bar (Kassenabschluss)"} · ${vermerk}`, s.bar > 0 ? s.bar : 0, s.bar < 0 ? -s.bar : 0);
      if (k.rechnungen_bar?.length) for (const r of k.rechnungen_bar) zeile(t.datum, r.nummer ? `RE ${r.nummer}` : "", `Barzahlung auf Rechnung ${r.nummer} (Zahlungseingang, kein Kassenumsatz)`, r.betrag_cent, 0);
      else if (s.rechnungen) zeile(t.datum, "", "Barzahlungen auf Rechnungen (Zahlungseingang, kein Kassenumsatz)", s.rechnungen, 0);
      if (s.trinkgeld) zeile(t.datum, k.zbon ? `Z ${k.zbon}` : "", "Kartentrinkgeld bar an das Personal ausgezahlt (durchlaufend)", 0, s.trinkgeld);
    }
    for (const b of t.barausgaben) zeile(t.datum, belegKennung(b, nummern.get(b.id) ?? ""), `${b.lieferant.trim() || "Barbeleg"}: ${kategorieFuer(b.kategorie).titel}`.slice(0, 90), 0, belegGezahlt(b));
    for (const art of ["entnahme", "transit"] as const) for (const k of t.abschluesse) for (const b of k.bewegungen.filter((x) => x.art === art)) bewegungZeile(t.datum, b);
    if (t.differenz) zeile(t.datum, "", t.differenz > 0 ? "Kassendifferenz laut Zählung: Überschuss (gebucht als Erlös)" : "Kassendifferenz laut Zählung: Fehlbetrag (gebucht als Aufwand)", t.differenz > 0 ? t.differenz : 0, t.differenz < 0 ? -t.differenz : 0);
  }
  return { zeitraum: `${monatsName(monat)}${standort ? ` · ${standort}` : ""}`, anfang: feldBetrag(tage[0]!.anfang), eintraege };
}

// ---------------------------------------------------------------- Buchungen (DATEV-Stapel)

/** Kostenstelle (KOST1) aus dem Standort: Buchstaben und Ziffern, höchstens 8 Zeichen (PRUEFLISTE: mit der Kanzlei abstimmen). */
export const kostenstelle = (standort: string) => belegfeld1Aus(standort).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);

/**
 * Buchungen der Kassenabschlüsse (R12 GoBD: nur Bargeld läuft über die Kasse):
 * - Erlöse je Steuersatz (steuerbarer Umsatz, `kassenUmsatzJeSatz`) und verkaufte Mehrzweck-Gutscheine (Verbindlichkeit)
 *   sind die Ziele; bezahlt werden sie mit Karte/App (Geldtransit), „auf Rechnung“ (Forderungen), eingelösten
 *   Mehrzweck-Gutscheinen (Verbindlichkeit) und bar (Kasse). Jede unbare Zahlungsart wird im Verhältnis der noch offenen
 *   Ziele aufgeteilt (größter Rest); was bleibt, ist bar. So steht der Kartenanteil direkt „Geldtransit an Erlöse“.
 * - Kartentrinkgeld: Geldtransit an Kasse (durchlaufend, ohne Steuer). Bar kassierte Rechnungen: Kasse an Forderungen.
 * - Bewegungen mit Eigenbeleg-Nummer in Belegfeld 1: Geldtransit an Kasse, Privatentnahme an Kasse, Kasse an Privateinlage.
 * Leistungsdatum und „Datum Zuord. Steuerperiode“ = Tag des Abschlusses. Kassendifferenzen: `kassenDifferenzBuchungen`.
 * StB-Prüfung (A-1): Kasse bzw. Geldtransit in Feld 7, Erlöskonto in Feld 8 – richtig. B-6: Einlagen und Entnahmen
 * einer Kapitalgesellschaft über das Verrechnungskonto Gesellschafter statt Privatkonten; Konten nach Kontenvorgaben.
 */
export function kassenBuchungen(abschluesse: readonly Kassenabschluss[], kontenrahmen: Kontenrahmen, o: BuchungsOptionen & { kleinunternehmer?: boolean; kapitalgesellschaft?: boolean } = {}): Buchung[] {
  const k = kontenFuer(kontenrahmen, o.vorgaben);
  const privatEin = o.kapitalgesellschaft ? k.verrechnungGesellschafter : k.privateinlagen;
  const privatAus = o.kapitalgesellschaft ? k.verrechnungGesellschafter : k.privatentnahmen;
  const aus: Buchung[] = [];
  for (const a of kassenSortiert(abschluesse)) {
    if (a.geschlossen && !a.bewegungen.length) continue;
    const beleg = belegfeld1Aus(a.zbon ? `Z${a.zbon}` : `KA${a.datum.replace(/-/g, "")}`);
    const kost1 = standortVon(a) ? kostenstelle(standortVon(a)) : undefined;
    const basis = { datum: a.datum, bu_schluessel: "", belegfeld1: beleg, quelle_id: a.id, leistungsdatum: a.datum, steuerperiode: a.datum, ...(kost1 ? { kost1 } : {}) };
    const zb = a.zbon ? ` Z-Bon ${a.zbon}` : "";
    const s = kassenSummen(a);
    if (!a.geschlossen) {
      // Ziele: Erlöse je Satz (Kleinunternehmer: ein Konto) und Mehrzweck-Gutscheine als Verbindlichkeit
      const jeSatz = kassenUmsatzJeSatz(a);
      const ziele: { schluessel: string; konto: string; satz: number | null; betrag: number; text: string; art: Buchung["art"] }[] = [];
      for (const satzRoh of KASSE_SAETZE) {
        const b = jeSatz[satzRoh] ?? 0;
        if (!b) continue;
        const satz = o.kleinunternehmer ? null : satzRoh;
        const vorhanden = ziele.find((z) => z.satz === satz && z.konto === erloeskonto(k, satz));
        if (vorhanden) vorhanden.betrag += b;
        else ziele.push({ schluessel: String(satz === null ? "ku" : satz), konto: erloeskonto(k, satz), satz, betrag: b, text: `Tageseinnahmen ${satz === null ? "§ 19" : `${satz} %`}`, art: "einnahme" });
      }
      if (s.gsVerkaufMz) ziele.push({ schluessel: "gsmz", konto: k.gutscheinVerbindlichkeit, satz: null, betrag: s.gsVerkaufMz, text: "Mehrzweck-Gutscheine verkauft", art: "umbuchung" });
      // negative Ziele (Rückgabe, Storno am Tag): wie bisher Erlöse an Kasse, nicht aufgeteilt
      for (const z of ziele.filter((x) => x.betrag < 0)) aus.push({ ...basis, betrag_cent: -z.betrag, soll_haben: "H", konto: k.kasse, gegenkonto: z.konto, buchungstext: `${z.text}${zb}`.slice(0, 60), ust_satz: z.satz, art: z.art, guid: buchungsGuid(`${a.id}|umsatz`, z.satz) });
      const offen = ziele.map((z) => Math.max(0, z.betrag));
      const quellen = [
        { schluessel: "karte", konto: k.geldtransit, betrag: s.karte - s.trinkgeld + s.app + s.sonstige, text: s.app || s.sonstige ? "Karte/App" : "Karte" },
        { schluessel: "aufrechnung", konto: k.forderungen, betrag: s.aufrechnung, text: "auf Rechnung" },
        { schluessel: "gsmz", konto: k.gutscheinVerbindlichkeit, betrag: s.gsEinlMz, text: "Mehrzweck-Gutschein eingelöst" },
      ];
      for (const q of quellen) {
        if (q.betrag <= 0 || !offen.some((x) => x > 0)) continue;
        const teile = aufteilen(Math.min(q.betrag, offen.reduce((x, y) => x + y, 0)), offen);
        teile.forEach((t, i) => {
          if (!t) return;
          const z = ziele[i]!;
          offen[i]! -= t;
          aus.push({ ...basis, betrag_cent: t, soll_haben: "S", konto: q.konto, gegenkonto: z.konto, buchungstext: `${z.text} ${q.text}${zb}`.slice(0, 60), ust_satz: z.satz, art: z.art, guid: buchungsGuid(`${a.id}|${q.schluessel}|${z.schluessel}`, z.satz) });
        });
      }
      // Rest bar: Kasse an Erlöse (dieselbe GUID wie vor R12 GoBD, damit die Barbuchung gleich bleibt)
      offen.forEach((t, i) => {
        if (t <= 0) return;
        const z = ziele[i]!;
        aus.push({ ...basis, betrag_cent: t, soll_haben: "S", konto: k.kasse, gegenkonto: z.konto, buchungstext: `${z.text}${z.art === "einnahme" ? " bar" : ""}${zb}`.slice(0, 60), ust_satz: z.satz, art: z.art, guid: buchungsGuid(z.schluessel === "gsmz" ? `${a.id}|gsmz` : `${a.id}|umsatz`, z.satz) });
      });
      if (s.trinkgeld) aus.push({ ...basis, betrag_cent: s.trinkgeld, soll_haben: "S", konto: k.geldtransit, gegenkonto: k.kasse, buchungstext: `Kartentrinkgeld an Personal${zb}`.slice(0, 60), ust_satz: null, art: "umbuchung", guid: buchungsGuid(`${a.id}|trinkgeld`, null), leistungsdatum: null, steuerperiode: null });
    }
    // bar kassierte Rechnungen: Kasse an Forderungen (der Umsatz steht schon mit der Rechnung im Stapel)
    if (s.rechnungen) {
      const l = a.rechnungen_bar?.length ? a.rechnungen_bar : [{ id: "", nummer: "", betrag_cent: s.rechnungen }];
      l.forEach((r, i) => aus.push({ ...basis, betrag_cent: r.betrag_cent, soll_haben: "S", konto: k.kasse, gegenkonto: k.forderungen, ...(r.nummer ? { belegfeld1: belegfeld1Aus(r.nummer) } : {}), buchungstext: (r.nummer ? `Barzahlung RE ${r.nummer}${zb}` : `Barzahlungen auf Rechnungen${zb}`).slice(0, 60), ust_satz: null, art: "umbuchung", guid: buchungsGuid(i ? `${a.id}|rechnungen|${i}` : `${a.id}|rechnungen`, null), leistungsdatum: null, steuerperiode: null }));
    }
    a.bewegungen.forEach((b, i) => {
      const [konto, gegen, text] = b.art === "entnahme" ? [privatAus, k.kasse, o.kapitalgesellschaft ? "Entnahme Kasse Gesellschafter" : "Privatentnahme Kasse"] : b.art === "einlage" ? [k.kasse, privatEin, o.kapitalgesellschaft ? "Einlage Kasse Gesellschafter" : "Privateinlage Kasse"] : [k.geldtransit, k.kasse, "Geldtransit Kasse an Bank"];
      aus.push({ ...basis, betrag_cent: b.betrag_cent, soll_haben: "S", konto, gegenkonto: gegen, ...(b.beleg_nr ? { belegfeld1: belegfeld1Aus(b.beleg_nr) } : {}), buchungstext: text, ust_satz: null, art: "umbuchung", guid: buchungsGuid(`${a.id}|bewegung|${i}`, null), leistungsdatum: null, steuerperiode: null });
    });
  }
  return aus;
}

/**
 * R12 GoBD: Kassendifferenzen laut Zählung buchen, damit das Kassenkonto dem Kassenbuch entspricht – Überschuss Kasse an
 * Erlöse 19 % (Kleinunternehmer: Konto § 19), Fehlbetrag Kasse (Feld 7, Haben) an sonstigen Aufwand (ohne Vorsteuer,
 * StB-Prüfung A-1: Sachkonto als Gegenkonto). StB-Prüfung (A-9/B-9): Überschuss mit Kontenvorgabe auf ein Ertragskonto
 * ohne Umsatzsteuer (z. B. 2700/4830), Fehlbetrag auf das vorgegebene Konto.
 */
export function kassenDifferenzBuchungen(differenzen: readonly { datum: string; cent: number; standort?: string }[], kontenrahmen: Kontenrahmen, o: BuchungsOptionen & { kleinunternehmer?: boolean } = {}): Buchung[] {
  const k = kontenFuer(kontenrahmen, o.vorgaben);
  return differenzen
    .filter((d) => d.cent)
    .map((d): Buchung => {
      const kost1 = d.standort ? kostenstelle(d.standort) : undefined;
      const satz = o.kleinunternehmer ? null : 19;
      const basis = { datum: d.datum, betrag_cent: Math.abs(d.cent), bu_schluessel: "", belegfeld1: belegfeld1Aus(`KD${d.datum.replace(/-/g, "")}`), quelle_id: `kassendifferenz|${d.standort ?? ""}|${d.datum}`, ...(kost1 ? { kost1 } : {}) };
      if (d.cent < 0) return { ...basis, soll_haben: "H", konto: k.kasse, gegenkonto: k.kassendifferenzAufwand, buchungstext: "Kassendifferenz Fehlbetrag lt. Zählung", ust_satz: null, art: "ausgabe", guid: buchungsGuid(`kassendifferenz|${d.standort ?? ""}|${d.datum}`, null) };
      // Überschuss auf ein Ertragskonto ohne Umsatzsteuer (Hausregel der Kanzlei) – sonst Erlöse 19 % (GUID wie bisher)
      if (k.kassendifferenzErtrag) return { ...basis, soll_haben: "S", konto: k.kasse, gegenkonto: k.kassendifferenzErtrag, buchungstext: "Kassendifferenz Überschuss lt. Zählung", ust_satz: null, art: "einnahme", guid: buchungsGuid(`kassendifferenz|${d.standort ?? ""}|${d.datum}`, null) };
      return { ...basis, soll_haben: "S", konto: k.kasse, gegenkonto: erloeskonto(k, satz), buchungstext: "Kassendifferenz Überschuss lt. Zählung", ust_satz: satz, art: "einnahme", guid: buchungsGuid(`kassendifferenz|${d.standort ?? ""}|${d.datum}`, satz), leistungsdatum: d.datum, steuerperiode: d.datum };
    });
}

// ---------------------------------------------------------------- Kassensturz (Kassennachschau)

/** Stückelung für das Zählprotokoll (Cent je Schein bzw. Münze). */
export const STUECKELUNG = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

/**
 * R12 GoBD: Kassensturz (z. B. bei einer Kassennachschau, § 146b AO) – gezählter Bestand mit Zeitpunkt, optional mit
 * Stückelung; einmal gespeichert unveränderlich. `vortag_cent`: Endbestand des letzten Abschlusses davor (Bezugsgröße –
 * die Umsätze des laufenden Tages sind noch nicht abgeschlossen).
 */
export interface Kassensturz {
  id: string;
  zeitpunkt: string;
  standort?: string | null;
  gezaehlt_cent: number;
  /** Anzahl je Schein/Münze (Schlüssel: Cent als Text) */
  stueckelung?: Record<string, number> | null;
  vortag_cent?: number | null;
  /** Barbelege und Bewegungen seit dem letzten Abschluss sind darin nicht berücksichtigt – nur zur Erläuterung */
  notiz?: string | null;
  /** wer gezählt hat bzw. wer anwesend war (z. B. Amtsträgerin) */
  anwesend?: string | null;
}

/** Summe einer Stückelung in Cent. */
export const stueckelungSumme = (st: Record<string, number> | null | undefined) => Object.entries(st ?? {}).reduce((a, [w, n]) => a + Number(w) * (Number.isInteger(n) && n > 0 ? n : 0), 0);

/** Gespeicherten Kassensturz prüfen; null bei Unlesbarem. */
export function kassensturzAus(roh: unknown): Kassensturz | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  const r = roh as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || typeof r.zeitpunkt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(r.zeitpunkt) || ganz(r.gezaehlt_cent) === null) return null;
  const st = r.stueckelung && typeof r.stueckelung === "object" && !Array.isArray(r.stueckelung) ? Object.fromEntries(Object.entries(r.stueckelung as Record<string, unknown>).filter(([w, n]) => (STUECKELUNG as readonly number[]).includes(Number(w)) && Number.isInteger(n) && (n as number) > 0)) : null;
  return {
    id: r.id,
    zeitpunkt: r.zeitpunkt,
    gezaehlt_cent: r.gezaehlt_cent as number,
    ...(textOderNull(r.standort, 120) ? { standort: textOderNull(r.standort, 120) } : {}),
    ...(st && Object.keys(st).length ? { stueckelung: st as Record<string, number> } : {}),
    ...(ganz(r.vortag_cent) !== null ? { vortag_cent: ganz(r.vortag_cent) } : {}),
    ...(textOderNull(r.notiz, 500) ? { notiz: textOderNull(r.notiz, 500) } : {}),
    ...(textOderNull(r.anwesend, 200) ? { anwesend: textOderNull(r.anwesend, 200) } : {}),
  };
}

/** Kassenstürze zweier Stände nach ID vereinen – unveränderlich, nie etwas verlieren. */
export function kassenstuerzeVereinen(a: readonly Kassensturz[], b: readonly Kassensturz[]): Kassensturz[] {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const x of b) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()].sort((x, y) => x.zeitpunkt.localeCompare(y.zeitpunkt) || x.id.localeCompare(y.id));
}
