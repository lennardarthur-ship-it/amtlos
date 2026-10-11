/**
 * Gründungsassistent (Spezifikation 6.2): Reihenfolge und Abhängigkeiten aus dem Katalog (voraussetzungen),
 * nicht aus festem Code. Reine Funktionen, damit Reihenfolge und Sperren testbar sind.
 */
export interface Schritt {
  pflicht_id: string;
  periode: string;
  status: string; // Anzeige-Status der Instanz
  faellig_am: string | null;
  katalog_nr?: string;
  voraussetzungen: string[];
}

const OFFEN = new Set(["offen", "faellig_bald", "ueberfaellig", "angabe_fehlt"]);

/** „A.10“ nach „A.9“: Katalognummern natürlich sortieren. */
function nrVergleich(a = "", b = "") {
  return a.localeCompare(b, "de", { numeric: true });
}

/**
 * Sortiert topologisch nach Voraussetzungen; bei Gleichstand nach Fälligkeit (ohne Datum zuletzt), dann Katalognummer.
 * Voraussetzungen auf Pflichten außerhalb der Liste (gilt nicht / nicht im Assistenten) werden ignoriert.
 */
export function ordne<T extends Schritt>(schritte: T[]): T[] {
  const ids = new Set(schritte.map((s) => s.pflicht_id));
  const vorher = (s: T) => s.voraussetzungen.filter((v) => ids.has(v) && v !== s.pflicht_id);
  const rest = [...schritte].sort((a, b) => {
    if (a.faellig_am !== b.faellig_am) return a.faellig_am === null ? 1 : b.faellig_am === null ? -1 : a.faellig_am.localeCompare(b.faellig_am);
    return nrVergleich(a.katalog_nr, b.katalog_nr) || a.pflicht_id.localeCompare(b.pflicht_id) || a.periode.localeCompare(b.periode);
  });
  const fertig = new Set<string>();
  const ergebnis: T[] = [];
  while (rest.length) {
    // erster Schritt, dessen Voraussetzungen alle schon eingeordnet sind; Kreise (vom Validator verboten) brechen wir ab
    let i = rest.findIndex((s) => vorher(s).every((v) => fertig.has(v) || !rest.some((r) => r.pflicht_id === v && r !== s)));
    if (i < 0) i = 0;
    const [s] = rest.splice(i, 1);
    ergebnis.push(s!);
    if (!rest.some((r) => r.pflicht_id === s!.pflicht_id)) fertig.add(s!.pflicht_id);
  }
  return ergebnis;
}

/** Welche Voraussetzungen eines Schritts sind noch offen? (Pflicht mit mindestens einer offenen Instanz) */
export function offeneVoraussetzungen(s: Schritt, alle: Schritt[]): string[] {
  return s.voraussetzungen.filter((v) => alle.some((x) => x.pflicht_id === v && OFFEN.has(x.status)));
}

export function fortschritt(alle: Schritt[]) {
  const relevant = alle.filter((s) => s.status !== "nicht_zutreffend");
  const erledigt = relevant.filter((s) => s.status === "erledigt").length;
  return { erledigt, gesamt: relevant.length, fertig: relevant.length > 0 && erledigt === relevant.length };
}
