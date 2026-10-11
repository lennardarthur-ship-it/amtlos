/**
 * Umfang der Oberfläche (E-110): Für den Start sind nur die Kernmodule für Gründer und Solo-Selbstständige sichtbar.
 * Der Code der übrigen Module bleibt im Repo und wird mit AMTLOS_UMFANG=alles wieder eingeblendet.
 * Versteckte Module: keine Navigation, keine Links, Seiten antworten mit 404 (proxy.ts).
 */
export type Modul = "datenschutz" | "arbeitsschutz" | "online" | "branche" | "experten" | "frag" | "radar" | "kanzlei";

export const ALLE_MODULE: Modul[] = ["datenschutz", "arbeitsschutz", "online", "branche", "experten", "frag", "radar", "kanzlei"];

/** Pfadpräfix → Modul. Alles, was hier nicht steht, gehört zum Kern. */
export const MODUL_PFADE: [string, Modul][] = [
  ["/datenschutz", "datenschutz"],
  ["/personal/gefaehrdungsbeurteilungen", "arbeitsschutz"],
  ["/personal/arbeitsmittel", "arbeitsschutz"],
  ["/personal/gefahrstoffe", "arbeitsschutz"],
  ["/online", "online"],
  ["/branche", "branche"],
  ["/experten", "experten"],
  ["/frag", "frag"],
  ["/radar", "radar"],
  ["/kanzlei", "kanzlei"],
];

function aktiveModule(wert = process.env.AMTLOS_UMFANG): Set<Modul> {
  if (!wert || wert === "kern") return new Set();
  if (wert === "alles") return new Set(ALLE_MODULE);
  return new Set(wert.split(/[\s,]+/).filter((m): m is Modul => (ALLE_MODULE as string[]).includes(m)));
}

export function sichtbar(modul: Modul, wert?: string): boolean {
  return aktiveModule(wert).has(modul);
}

/** Modul zu einem Pfad, oder null für den Kern. */
export function modulZuPfad(pfad: string): Modul | null {
  return MODUL_PFADE.find(([p]) => pfad === p || pfad.startsWith(`${p}/`))?.[1] ?? null;
}

/** Darf dieser Pfad angezeigt werden? (Links, Weiterleitungen, Seiten) */
export function pfadSichtbar(pfad: string, wert?: string): boolean {
  const m = modulZuPfad(pfad.split("?")[0]!);
  return m === null || sichtbar(m, wert);
}
