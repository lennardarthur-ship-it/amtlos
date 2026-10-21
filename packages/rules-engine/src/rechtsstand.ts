import type { Katalog, Rechtsstand } from "./typen.js";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Rechtsstand des Katalogs oder null, wenn der Katalog keinen (gültigen) trägt. */
export function rechtsstand(katalog: Pick<Katalog, "rechtsstand">): Rechtsstand | null {
  const r = katalog.rechtsstand;
  return r && /^\d{4}-\d{2}-\d{2}$/.test(r.datum) ? r : null;
}

/** Monat und Jahr des Rechtsstands, z. B. "Oktober 2026"; null ohne Rechtsstand. */
export function rechtsstandMonat(katalog: Pick<Katalog, "rechtsstand">): string | null {
  const r = rechtsstand(katalog);
  if (!r) return null;
  const [jahr, monat] = r.datum.split("-");
  return `${MONATE[Number(monat) - 1]} ${jahr}`;
}

/** Anzeigetext für die App, z. B. "Rechtsstand: Oktober 2026"; null ohne Rechtsstand. */
export function rechtsstandText(katalog: Pick<Katalog, "rechtsstand">): string | null {
  const m = rechtsstandMonat(katalog);
  return m ? `Rechtsstand: ${m}` : null;
}
