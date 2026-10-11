import { datum, letzterTagImMonat, plusMonate, plusTage, tageImMonat, vergleiche, zerlege, type Datum } from "./datum.js";
import { plusDauer } from "./dauer.js";
import type { Ort } from "./feiertage.js";
import { verschiebe, type Kalender, type Verschiebung, type VerschiebungsErgebnis } from "./kalender.js";

export type Rhythmus = "monatlich" | "quartalsweise" | "halbjaehrlich" | "jaehrlich" | "keiner";

export interface Periode {
  /** 2026-10 | 2026-Q3 | 2026-H1 | 2026 (passt zur Prüfung in app.pflicht_instanz.periode) */
  schluessel: string;
  beginn: Datum;
  ende: Datum;
}

const MONATE_JE: Record<Exclude<Rhythmus, "keiner">, number> = {
  monatlich: 1,
  quartalsweise: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
};

function schluessel(rhythmus: Exclude<Rhythmus, "keiner">, jahr: number, startMonat: number): string {
  switch (rhythmus) {
    case "monatlich":
      return `${jahr}-${String(startMonat).padStart(2, "0")}`;
    case "quartalsweise":
      return `${jahr}-Q${Math.floor((startMonat - 1) / 3) + 1}`;
    case "halbjaehrlich":
      return `${jahr}-H${startMonat <= 6 ? 1 : 2}`;
    case "jaehrlich":
      return `${jahr}`;
  }
}

/** Alle Kalenderperioden des Rhythmus, die den Zeitraum [von, bis] berühren. */
export function perioden(rhythmus: Rhythmus, von: Datum, bis: Datum): Periode[] {
  if (rhythmus === "keiner") return [];
  const laenge = MONATE_JE[rhythmus];
  const { jahr, monat } = zerlege(von);
  const startMonat = Math.floor((monat - 1) / laenge) * laenge + 1;
  let beginn = datum(jahr, startMonat, 1);
  const ergebnis: Periode[] = [];
  while (vergleiche(beginn, bis) <= 0) {
    const b = zerlege(beginn);
    const endeMonat = plusMonate(beginn, laenge - 1);
    const e = zerlege(endeMonat);
    ergebnis.push({ schluessel: schluessel(rhythmus, b.jahr, b.monat), beginn, ende: letzterTagImMonat(e.jahr, e.monat) });
    beginn = plusMonate(beginn, laenge);
  }
  return ergebnis;
}

export type FaelligkeitsRegel =
  | { art: "tag_nach_periodenende"; monate_nach?: number; tag: number }
  | { art: "feste_termine"; termine: string[] }
  | { art: "n_letzter_bankarbeitstag"; n: number; arbeitstage_vorher?: number };

export interface Termin {
  periode: string;
  /** Termin vor Verlängerung und Verschiebung */
  roh: Datum;
  /** nach Verlängerung, vor Verschiebung */
  verlaengert?: Datum;
  faellig_am: Datum;
  uebersprungen: VerschiebungsErgebnis["uebersprungen"];
}

/** Rohtermin für eine Periode nach den Regeln 'tag_nach_periodenende' bzw. 'n_letzter_bankarbeitstag'. */
export function rohtermin(p: Periode, regel: Exclude<FaelligkeitsRegel, { art: "feste_termine" }>, kal: Kalender): Datum {
  if (regel.art === "tag_nach_periodenende") {
    const ende = zerlege(p.ende);
    const zielMonat = plusMonate(datum(ende.jahr, ende.monat, 1), regel.monate_nach ?? 1);
    const z = zerlege(zielMonat);
    return datum(z.jahr, z.monat, Math.min(regel.tag, tageImMonat(z.jahr, z.monat)));
  }
  // n-letzter Bankarbeitstag im Monat des Periodenendes, danach optional Arbeitstage zurück
  const ende = zerlege(p.ende);
  let d = letzterTagImMonat(ende.jahr, ende.monat);
  let gezaehlt = 0;
  for (;;) {
    if (kal.istBankarbeitstag(d)) {
      gezaehlt++;
      if (gezaehlt === regel.n) break;
    }
    d = plusTage(d, -1);
  }
  let zurueck = regel.arbeitstage_vorher ?? 0;
  while (zurueck > 0) {
    d = plusTage(d, -1);
    if (kal.istBankarbeitstag(d)) zurueck--;
  }
  return d;
}

export interface WiederkehrendeFrist {
  rhythmus: Rhythmus;
  faellig: FaelligkeitsRegel;
  /** Dauer, um die verlängert wird (z. B. Dauerfristverlängerung P1M); bereits entschieden, ob sie gilt */
  verlaengerung?: string | undefined;
  verschiebung: Verschiebung;
}

/**
 * Termine einer wiederkehrenden Frist, deren Fälligkeit in [von, bis] liegt.
 * Bei 'feste_termine' wird der Rhythmus ignoriert; Periode ist dann der Monat des Termins (YYYY-MM).
 */
export function wiederkehrendeTermine(f: WiederkehrendeFrist, von: Datum, bis: Datum, ort: Ort, kal: Kalender): Termin[] {
  const termine: Termin[] = [];
  const nimm = (periode: string, roh: Datum) => {
    const verlaengert = f.verlaengerung ? plusDauer(roh, f.verlaengerung) : undefined;
    const v = verschiebe(verlaengert ?? roh, f.verschiebung, ort, kal);
    if (vergleiche(v.datum, von) >= 0 && vergleiche(v.datum, bis) <= 0) {
      termine.push({ periode, roh, ...(verlaengert ? { verlaengert } : {}), faellig_am: v.datum, uebersprungen: v.uebersprungen });
    }
  };

  if (f.faellig.art === "feste_termine") {
    for (let jahr = zerlege(von).jahr - 1; jahr <= zerlege(bis).jahr; jahr++) {
      for (const t of f.faellig.termine) {
        const [m, d] = t.split("-").map(Number) as [number, number];
        nimm(`${jahr}-${String(m).padStart(2, "0")}`, datum(jahr, m, d));
      }
    }
  } else {
    if (f.rhythmus === "keiner") return [];
    // Perioden ab einem Jahr vor 'von', weil Fälligkeiten bis zu einige Monate nach Periodenende liegen
    const regel = f.faellig;
    for (const p of perioden(f.rhythmus, plusMonate(von, -15), bis)) nimm(p.schluessel, rohtermin(p, regel, kal));
  }
  return termine.sort((a, b) => vergleiche(a.faellig_am, b.faellig_am));
}

export interface RelativeFrist {
  versatz: string;
  verschiebung: Verschiebung;
}

/** Termin relativ zu einem Bezugsdatum (Ereignis, Datums-Fakt, erledigte Pflicht). */
export function relativerTermin(bezug: Datum, f: RelativeFrist, ort: Ort, kal: Kalender): Omit<Termin, "periode"> {
  const roh = plusDauer(bezug, f.versatz);
  const v = verschiebe(roh, f.verschiebung, ort, kal);
  return { roh, faellig_am: v.datum, uebersprungen: v.uebersprungen };
}
