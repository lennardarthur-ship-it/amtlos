/** Monate addieren, Monatsende beachten (31.1. + 1 Monat = 28./29.2.). */
export function plusMonate(datum: string, monate: number): string {
  const [j, m, t] = datum.split("-").map(Number) as [number, number, number];
  const ziel = new Date(Date.UTC(j, m - 1 + monate, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Kalendertag eines Zeitpunkts in Ortszeit (Europe/Berlin). */
export function ortsdatum(zeitpunkt: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(zeitpunkt);
}
