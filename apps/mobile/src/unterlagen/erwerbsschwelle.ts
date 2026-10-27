/**
 * E-227 (Steuerberater 27.10.2026, T-309): Erwerbsschwelle (§ 1a Abs. 3 Nr. 2 UStG, Regelwert `steuern.ust.erwerbsschwelle`,
 * 12.500 €). Kleinunternehmer und Betriebe mit nur steuerfreien Umsätzen ohne Vorsteuerabzug versteuern
 * innergemeinschaftliche Erwerbe nicht, wenn die Erwerbe im Vorjahr die Schwelle nicht überstiegen haben UND im laufenden
 * Jahr voraussichtlich nicht übersteigen; übersteigen sie sie („>“), werden sie versteuert. Verzicht (§ 1a Abs. 4 UStG,
 * bindet mindestens zwei Kalenderjahre; als Verzicht gilt auch, dem Lieferanten die eigene USt-IdNr. anzugeben) → immer
 * Erwerbsbesteuerung. Neue Fahrzeuge und verbrauchsteuerpflichtige Waren unterliegen ihr immer (§ 1a Abs. 5 UStG) – nur
 * Hinweis. Reine Funktionen, ohne Gerät testbar.
 */
import { igeErwerbeImJahr, type Beleg } from "@amtlos/fachlogik";

/** Regelwert im Katalog (catalog/regelwerte/steuern.yaml) */
export const ERWERBSSCHWELLE_REGELWERT = "steuern.ust.erwerbsschwelle";
/** Antwort auf die Frage des Steuerberaters zum Verzicht (Profil, Ja/Nein) */
export const VERZICHT_FELD = "ust.erwerbsschwelle_verzicht";
/** Antwort je Kalenderjahr: Erwerbe im Vorjahr über der Schwelle oder im Jahr voraussichtlich darüber (Profil, Ja/Nein) */
export const ueberFeld = (jahr: string) => `ust.erwerbsschwelle_ueber_${jahr}`;

type Profil = Record<string, string | number | boolean | string[] | null>;

/** Wer die Erwerbsschwelle anwenden darf – nur die Fälle, die die App kennt (§ 1a Abs. 3 Nr. 1 UStG nennt weitere). */
export type Schwellenerwerber = "ku" | "steuerfrei";

export interface ErwerbsschwelleLage {
  /** „ja“: Erwerbe sind zu versteuern; „nein“: unter der Schwelle ohne Verzicht; „offen“: Angaben fehlen */
  status: "ja" | "nein" | "offen";
  /** Warum: Verzicht, Vorjahr laut Belegen über der Schwelle, Angabe des Betriebs, beides verneint, offen */
  grund: "verzicht" | "vorjahr" | "angabe" | "verneint" | "offen";
  jahr: string;
  /** Erwerbe laut Belegen (ohne Umsatzsteuer, Cent) im Vorjahr und im Jahr */
  vorjahr_cent: number;
  jahr_cent: number;
  /** Schwelle in Cent – null, wenn der Regelwert fehlt */
  schwelle_cent: number | null;
  verzicht: boolean | null;
  ueber: boolean | null;
}

const jaNein = (w: unknown): boolean | null => (typeof w === "boolean" ? w : null);

/**
 * Lage für ein Kalenderjahr: Verzicht → ja; Erwerbe im Vorjahr laut Belegen über der Schwelle → ja; Angabe „über der
 * Schwelle“ (Vorjahr oder voraussichtlich im Jahr) → ja; Verzicht verneint und Angabe verneint → nein; sonst offen.
 */
export function erwerbsschwelleLage(profil: Profil, belege: Beleg[], jahr: string, schwelleEuro: number | null): ErwerbsschwelleLage {
  const schwelle_cent = typeof schwelleEuro === "number" && Number.isFinite(schwelleEuro) ? Math.round(schwelleEuro * 100) : null;
  const vorjahr_cent = igeErwerbeImJahr(belege, String(Number(jahr) - 1));
  const jahr_cent = igeErwerbeImJahr(belege, jahr);
  const verzicht = jaNein(profil[VERZICHT_FELD]);
  const ueber = jaNein(profil[ueberFeld(jahr)]);
  const lage = { jahr, vorjahr_cent, jahr_cent, schwelle_cent, verzicht, ueber };
  if (verzicht === true) return { ...lage, status: "ja", grund: "verzicht" };
  if (schwelle_cent !== null && vorjahr_cent > schwelle_cent) return { ...lage, status: "ja", grund: "vorjahr" };
  if (ueber === true) return { ...lage, status: "ja", grund: "angabe" };
  if (verzicht === false && ueber === false && schwelle_cent !== null) return { ...lage, status: "nein", grund: "verneint" };
  return { ...lage, status: "offen", grund: "offen" };
}

/** Jahr des Erwerbs eines Belegs (Tag des Erwerbs, sonst Belegdatum). */
export const erwerbsJahr = (b: Pick<Beleg, "datum" | "erwerb_datum">) => (b.erwerb_datum || b.datum).slice(0, 4);

/**
 * Belege mit innergemeinschaftlichem Erwerb, die ein Schwellenerwerber nicht mit Erwerbsteuer buchen darf, weil die
 * Erwerbsbesteuerung für ihr Jahr nicht festgestellt ist (DATEV-Stapel, `igeNichtBuchen`).
 */
export function igeOhneErwerbsbesteuerung(zuPruefen: Beleg[], alle: Beleg[], profil: Profil, schwelleEuro: number | null): Beleg[] {
  const je = new Map<string, ErwerbsschwelleLage>();
  return zuPruefen.filter((b) => {
    if (b.ungueltig || b.steuerschuld !== "ige") return false;
    const j = erwerbsJahr(b);
    if (!je.has(j)) je.set(j, erwerbsschwelleLage(profil, alle, j, schwelleEuro));
    return je.get(j)!.status !== "ja";
  });
}
