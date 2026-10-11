/** Zeiten in der Ortszeit des Betriebs (Europe/Berlin), unabhängig von der Serverzeitzone. */
export const ZONE = "Europe/Berlin";

function versatzMinuten(d: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, timeZoneName: "longOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** „2026-10-05“ + „08:30“ (Ortszeit) → ISO-Zeitpunkt in UTC; null bei ungültiger Eingabe. */
export function ortszeitZuIso(datum: string, uhrzeit: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}$/.test(uhrzeit)) return null;
  const naiv = new Date(`${datum}T${uhrzeit}:00Z`);
  if (Number.isNaN(naiv.getTime())) return null;
  // zweimal angleichen, damit auch Zeiten nahe der Umstellung stimmen
  let t = naiv.getTime() - versatzMinuten(naiv) * 60000;
  t = naiv.getTime() - versatzMinuten(new Date(t)) * 60000;
  return new Date(t).toISOString();
}

/** ISO-Zeitpunkt → { datum: JJJJ-MM-TT, uhrzeit: HH:MM } in Ortszeit. */
export function isoZuOrtszeit(iso: string): { datum: string; uhrzeit: string } {
  const d = new Date(iso);
  const datum = new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(d);
  const uhrzeit = new Intl.DateTimeFormat("de-DE", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { datum, uhrzeit };
}

/** Aktueller Monat (JJJJ-MM) in Ortszeit. */
export function aktuellerMonat(jetzt = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(jetzt).slice(0, 7);
}

export function nachbarMonat(monat: string, schritt: number): string {
  const [j, m] = monat.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(j, m - 1 + schritt, 1));
  return d.toISOString().slice(0, 7);
}
