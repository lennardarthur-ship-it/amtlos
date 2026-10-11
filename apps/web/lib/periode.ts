import type { Sprache } from "@amtlos/i18n";

const MONATE = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** 2026-10 → „für Oktober 2026“, 2026-Q3 → „für das 3. Quartal 2026“ */
export function periodeText(p: string, s: Sprache): string {
  const m = /^(\d{4})(?:-(\d{2})|-Q(\d)|-H(\d))?$/.exec(p);
  if (!m) return p;
  const [, j, mon, q, h] = m;
  if (mon) return s === "de" ? `für ${MONATE.de[Number(mon) - 1]} ${j}` : `for ${MONATE.en[Number(mon) - 1]} ${j}`;
  if (q) return s === "de" ? `für das ${q}. Quartal ${j}` : `for Q${q} ${j}`;
  if (h) return s === "de" ? `für das ${h}. Halbjahr ${j}` : `for H${h} ${j}`;
  return s === "de" ? `für ${j}` : `for ${j}`;
}

/** Monatsname für Gruppierungen (Pflichtenliste, Kalender). */
export function monatsname(monat: number, s: Sprache): string {
  return MONATE[s][monat - 1]!;
}
