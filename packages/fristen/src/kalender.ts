import { jahrVon, plusTage, wochentag, type Datum } from "./datum.js";
import { bankSchliesstage, gesetzlicheFeiertage, type Feiertag, type Ort } from "./feiertage.js";

/** Welcher Feiertagskalender für eine Frist maßgeblich ist (pflicht.schema.json → verschiebung.kalender). */
export type KalenderArt = "bundeseinheitlich" | "bundesland" | "gemeinde" | "bankarbeitstage";

export type VerschiebungsRegel =
  | "keine"
  | "naechster_werktag"
  | "naechster_bankarbeitstag"
  | "vorheriger_werktag"
  | "vorheriger_bankarbeitstag";

export interface Verschiebung {
  regel: VerschiebungsRegel;
  kalender: KalenderArt;
  samstag_ist_werktag?: boolean;
}

export interface Kalender {
  /** Feiertag nach der gewählten Kalenderart am Ort? Liefert den Namen oder undefined. */
  feiertag(d: Datum, art: KalenderArt, ort: Ort): string | undefined;
  istBankarbeitstag(d: Datum): boolean;
}

/**
 * Standardkalender: Regeln aus feiertage.ts plus Zusatzdaten (kommunale und einmalige Feiertage
 * aus katalog.feiertag). Ergebnisse werden je Jahr zwischengespeichert.
 */
export class StandardKalender implements Kalender {
  private readonly cache = new Map<number, Feiertag[]>();
  private readonly bankCache = new Map<number, Set<Datum>>();

  constructor(private readonly zusatz: readonly Feiertag[] = []) {}

  private feiertageImJahr(jahr: number): Feiertag[] {
    let liste = this.cache.get(jahr);
    if (!liste) {
      liste = [...gesetzlicheFeiertage(jahr), ...this.zusatz.filter((f) => jahrVon(f.datum) === jahr)];
      this.cache.set(jahr, liste);
    }
    return liste;
  }

  feiertag(d: Datum, art: KalenderArt, ort: Ort): string | undefined {
    if (art === "bankarbeitstage") return this.istBankarbeitstag(d) ? undefined : "Bank-Schließtag";
    for (const f of this.feiertageImJahr(jahrVon(d))) {
      if (f.datum !== d) continue;
      const bundesweit = !f.bundeslaender && !f.ags;
      if (bundesweit) return f.name;
      if (art === "bundeseinheitlich") continue;
      if (f.ags) {
        if (art === "gemeinde" && ort.ags === f.ags) return f.name;
        continue;
      }
      if (ort.bundesland && f.bundeslaender?.includes(ort.bundesland)) return f.name;
    }
    return undefined;
  }

  istBankarbeitstag(d: Datum): boolean {
    const wt = wochentag(d);
    if (wt === 0 || wt === 6) return false;
    const jahr = jahrVon(d);
    let tage = this.bankCache.get(jahr);
    if (!tage) {
      tage = new Set(bankSchliesstage(jahr));
      this.bankCache.set(jahr, tage);
    }
    return !tage.has(d);
  }
}

export interface Werktagspruefung {
  werktag: boolean;
  grund?: string;
}

export function pruefeWerktag(d: Datum, v: Verschiebung, ort: Ort, kal: Kalender): Werktagspruefung {
  if (v.kalender === "bankarbeitstage" || v.regel.endsWith("bankarbeitstag")) {
    return kal.istBankarbeitstag(d) ? { werktag: true } : { werktag: false, grund: wochenendName(d) ?? "Bank-Schließtag" };
  }
  const we = wochenendName(d, v.samstag_ist_werktag ?? false);
  if (we) return { werktag: false, grund: we };
  const ft = kal.feiertag(d, v.kalender, ort);
  return ft ? { werktag: false, grund: ft } : { werktag: true };
}

function wochenendName(d: Datum, samstagIstWerktag = false): string | undefined {
  const wt = wochentag(d);
  if (wt === 0) return "Sonntag";
  if (wt === 6 && !samstagIstWerktag) return "Samstag";
  return undefined;
}

export interface VerschiebungsErgebnis {
  datum: Datum;
  /** Gründe in der Reihenfolge der übersprungenen Tage, leer = nicht verschoben */
  uebersprungen: { datum: Datum; grund: string }[];
}

/** Verschiebt ein Fristende nach der Regel; spätestens nach 14 Tagen Abbruch (Schutz gegen Datenfehler). */
export function verschiebe(d: Datum, v: Verschiebung, ort: Ort, kal: Kalender): VerschiebungsErgebnis {
  if (v.regel === "keine") return { datum: d, uebersprungen: [] };
  const schritt = v.regel.startsWith("vorheriger") ? -1 : 1;
  const uebersprungen: { datum: Datum; grund: string }[] = [];
  let aktuell = d;
  for (let i = 0; i < 14; i++) {
    const p = pruefeWerktag(aktuell, v, ort, kal);
    if (p.werktag) return { datum: aktuell, uebersprungen };
    uebersprungen.push({ datum: aktuell, grund: p.grund ?? "kein Werktag" });
    aktuell = plusTage(aktuell, schritt);
  }
  throw new Error(`Kein Werktag innerhalb von 14 Tagen ab ${d} gefunden – Kalenderdaten prüfen`);
}
