import type { Sprache } from "./api";

/** Uhrzeit in Ortszeit des Betriebs (Europe/Berlin), z. B. „08:15“. */
export function uhrzeit(iso: string, s: Sprache): string {
  return new Intl.DateTimeFormat(s === "en" ? "en-GB" : "de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Laufende Zeit seit einem Zeitpunkt als „3:05 h“. */
export function dauerSeit(iso: string, jetzt = Date.now()): string {
  const min = Math.max(0, Math.floor((jetzt - new Date(iso).getTime()) / 60_000));
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;
}
