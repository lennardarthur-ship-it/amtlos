/** Katalogauszug (E-121): Titel, Kurztext, Rechtsgrundlage und Quellen der Pflichten, die eine Vorlage belegt. */
import type { Vorlage } from "@amtlos/fachlogik";
import roh from "./katalog.json";

export interface KatalogPflicht {
  id: string;
  titel: string;
  kurz: string;
  rechtsgrundlage: string[];
  quellen: { titel: string; url: string }[];
  geprueft: boolean;
}

const PFLICHTEN = roh as KatalogPflicht[];

export function pflichtenFuer(v: Vorlage): KatalogPflicht[] {
  return v.pflichten.map((id) => PFLICHTEN.find((p) => p.id === id)).filter((p): p is KatalogPflicht => Boolean(p));
}

/** Rechtsgrundlagen aller belegten Pflichten, ohne Doppelungen. */
export function rechtsgrundlagen(v: Vorlage): string[] {
  return [...new Set(pflichtenFuer(v).flatMap((p) => p.rechtsgrundlage))];
}
