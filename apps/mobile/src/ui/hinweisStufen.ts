/**
 * E-239 (externe Rückmeldung 29.10.2026, „zu viele Warnungen“): Stufen für Warnungen und Hinweise in Beleg,
 * Umsatzsteuer und Abschluss. Am Wortlaut ändert sich nichts – nur, wie und wo ein Text steht:
 * - `blocker`: rechtlich erheblich, vor dem Teilen bzw. Melden zu erledigen – sichtbar, höchstens ein Kasten (mehrere als Liste);
 * - `hinweis`: in einer ruhigen Zeile „N Hinweise“ zusammengefasst, zum Aufklappen;
 * - `info`: Erklärung – erst nach „Mehr erfahren“.
 * Doppelte Texte erscheinen einmal (mit der höchsten Stufe).
 */
export type Stufe = "blocker" | "hinweis" | "info";

export interface Meldung {
  text: string;
  stufe: Stufe;
  /** Symbol im Kasten (z. B. „banknote“ bei Kassenhinweisen) */
  symbol?: string;
  /** Knopf unter dem Text (z. B. „IBAN eintragen“) */
  aktion?: { text: string; symbol?: string; onPress: () => void };
}

export interface Geordnet {
  blocker: Meldung[];
  hinweise: Meldung[];
  info: Meldung[];
}

const RANG: Record<Stufe, number> = { blocker: 0, hinweis: 1, info: 2 };

/** Ordnen und doppelte Texte zusammenfassen; leere Einträge (null, false, "") fallen weg. Reihenfolge bleibt. */
export function ordnen(l: readonly (Meldung | null | undefined | false)[]): Geordnet {
  const je = new Map<string, Meldung>();
  for (const m of l) {
    if (!m || !m.text.trim()) continue;
    const da = je.get(m.text);
    if (!da || RANG[m.stufe] < RANG[da.stufe]) je.set(m.text, da ? { ...m, aktion: m.aktion ?? da.aktion } : m);
  }
  const alle = [...je.values()];
  return { blocker: alle.filter((m) => m.stufe === "blocker"), hinweise: alle.filter((m) => m.stufe === "hinweis"), info: alle.filter((m) => m.stufe === "info") };
}

/**
 * Wie viele Elemente ohne Antippen sichtbar sind: ein Kasten für alle Blocker, eine Zeile für Hinweise bzw. „Mehr
 * erfahren“ (zugeklappt). Zum Messen (E-239) und für Tests.
 */
export function immerSichtbar(g: Geordnet): number {
  return (g.blocker.length ? 1 : 0) + (g.hinweise.length || g.info.length ? 1 : 0);
}

/** Kurzform für Meldungen in einer Liste. */
export const blocker = (text: string | null | undefined | false, extra: Partial<Meldung> = {}): Meldung | null => (text ? { text, stufe: "blocker", ...extra } : null);
export const hinweis = (text: string | null | undefined | false, extra: Partial<Meldung> = {}): Meldung | null => (text ? { text, stufe: "hinweis", ...extra } : null);
export const info = (text: string | null | undefined | false, extra: Partial<Meldung> = {}): Meldung | null => (text ? { text, stufe: "info", ...extra } : null);
