import { datum, plusTage, wochentag, type Datum } from "./datum.js";

/**
 * Gesetzliche Feiertage.
 *
 * [FACHLICH ZU PRÜFEN] (PRUEFLISTE G-04, Risiko R-08): Die folgenden Regeln sind der Startbestand
 * nach allgemein bekanntem Stand. Sie werden vor Livegang gegen die Feiertagsgesetze der Länder
 * geprüft und in katalog.feiertag mit Quelle abgelegt. Kommunale Feiertage und einmalige Feiertage
 * kommen ausschließlich als Daten (ZusatzFeiertag), nicht als Code.
 */

export const BUNDESLAENDER = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"] as const;
export type Bundesland = (typeof BUNDESLAENDER)[number];

export interface Ort {
  bundesland?: Bundesland | undefined;
  /** Amtlicher Gemeindeschlüssel (8-stellig) */
  ags?: string | undefined;
}

export interface Feiertag {
  datum: Datum;
  name: string;
  /** undefined = bundesweit */
  bundeslaender?: readonly Bundesland[];
  /** gesetzt = nur in dieser Gemeinde */
  ags?: string;
}

/** Ostersonntag nach dem gregorianischen Kalender (Algorithmus von Meeus/Jones/Butcher). */
export function ostersonntag(jahr: number): Datum {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return datum(jahr, monat, tag);
}

/** Buß- und Bettag: Mittwoch vor dem 23. November. */
function bussUndBettag(jahr: number): Datum {
  let d = datum(jahr, 11, 22);
  while (wochentag(d) !== 3) d = plusTage(d, -1);
  return d;
}

interface Regel {
  name: string;
  laender?: readonly Bundesland[];
  ab?: number; // erstes Jahr, in dem die Regel gilt
  datum: (jahr: number, ostern: Datum) => Datum;
}

const fest = (monat: number, tag: number) => (jahr: number) => datum(jahr, monat, tag);
const oster = (versatz: number) => (_: number, ostern: Datum) => plusTage(ostern, versatz);

const REGELN: readonly Regel[] = [
  { name: "Neujahr", datum: fest(1, 1) },
  { name: "Heilige Drei Könige", laender: ["BW", "BY", "ST"], datum: fest(1, 6) },
  { name: "Internationaler Frauentag", laender: ["BE"], ab: 2019, datum: fest(3, 8) },
  { name: "Internationaler Frauentag", laender: ["MV"], ab: 2023, datum: fest(3, 8) },
  { name: "Karfreitag", datum: oster(-2) },
  { name: "Ostermontag", datum: oster(1) },
  { name: "Tag der Arbeit", datum: fest(5, 1) },
  { name: "Christi Himmelfahrt", datum: oster(39) },
  { name: "Pfingstmontag", datum: oster(50) },
  { name: "Fronleichnam", laender: ["BW", "BY", "HE", "NW", "RP", "SL"], datum: oster(60) },
  { name: "Mariä Himmelfahrt", laender: ["SL"], datum: fest(8, 15) },
  { name: "Weltkindertag", laender: ["TH"], ab: 2019, datum: fest(9, 20) },
  { name: "Tag der Deutschen Einheit", datum: fest(10, 3) },
  { name: "Reformationstag", laender: ["BB", "MV", "SN", "ST", "TH"], datum: fest(10, 31) },
  { name: "Reformationstag", laender: ["HB", "HH", "NI", "SH"], ab: 2018, datum: fest(10, 31) },
  { name: "Allerheiligen", laender: ["BW", "BY", "NW", "RP", "SL"], datum: fest(11, 1) },
  { name: "Buß- und Bettag", laender: ["SN"], datum: (j) => bussUndBettag(j) },
  { name: "1. Weihnachtstag", datum: fest(12, 25) },
  { name: "2. Weihnachtstag", datum: fest(12, 26) },
];

/** Alle Feiertage eines Jahres nach den Regeln oben (ohne kommunale/einmalige). */
export function gesetzlicheFeiertage(jahr: number): Feiertag[] {
  const ostern = ostersonntag(jahr);
  return REGELN.filter((r) => r.ab === undefined || jahr >= r.ab).map((r) => ({
    datum: r.datum(jahr, ostern),
    name: r.name,
    ...(r.laender ? { bundeslaender: r.laender } : {}),
  }));
}

/**
 * Schließtage des Zahlungsverkehrssystems TARGET (EZB), zusätzlich zu Samstag und Sonntag – nur zur Information.
 * Für Fristen gilt `keineBankarbeitstage` (E-192): Der TARGET-Kalender kennt weder den 24. und 31. Dezember noch
 * Christi Himmelfahrt, Pfingstmontag oder den Tag der Deutschen Einheit; mit ihm lagen SV-Fälligkeiten im Dezember
 * und Beitragsnachweise im Mai bis zu drei Tage zu spät.
 */
export function bankSchliesstage(jahr: number): Datum[] {
  const ostern = ostersonntag(jahr);
  return [datum(jahr, 1, 1), plusTage(ostern, -2), plusTage(ostern, 1), datum(jahr, 5, 1), datum(jahr, 12, 25), datum(jahr, 12, 26)];
}

/**
 * Werktage (Montag bis Freitag), die keine Bankarbeitstage im Sinne der Fälligkeit der Gesamtsozialversicherungsbeiträge
 * sind (§ 23 Abs. 1 SGB IV: drittletzter Bankarbeitstag; Beitragsnachweis zwei Arbeitstage davor, § 28f Abs. 3 SGB IV),
 * E-192. Nach den Fälligkeitstabellen der Einzugsstellen (AOK, BKK24, IKK/BKK über informationsportal.de) sind keine
 * Bankarbeitstage: Samstage, Sonntage, gesetzliche Feiertage sowie der 24. und 31. Dezember. Landesfeiertage zählen
 * nach dem Sitz der Krankenkasse (AOK 2027, Fußnote zu Fronleichnam). Die App kennt die Krankenkassen nicht (bei
 * mehreren Beschäftigten oft mehrere) – deshalb zählt jeder Landesfeiertag, der in mindestens einem Land gilt: Das
 * ergibt den frühesten der möglichen Termine, nie einen zu späten (PRUEFLISTE T-184).
 */
export function keineBankarbeitstage(jahr: number, zusatz: readonly Feiertag[] = []): Feiertag[] {
  return [
    ...gesetzlicheFeiertage(jahr),
    // kommunale Feiertage (ags) bleiben außen vor – sie gelten am Sitz keiner Krankenkasse landesweit
    ...zusatz.filter((f) => !f.ags && f.datum.startsWith(`${String(jahr).padStart(4, "0")}-`)),
    { datum: datum(jahr, 12, 24), name: "Heiligabend (kein Bankarbeitstag)" },
    { datum: datum(jahr, 12, 31), name: "Silvester (kein Bankarbeitstag)" },
  ];
}
