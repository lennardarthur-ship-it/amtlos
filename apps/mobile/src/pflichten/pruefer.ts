/**
 * E-171: Fachliche Freigabe je Katalogeintrag. Ein Eintrag gilt als geprüft, wenn `pruefung.status` „freigegeben“ ist und
 * die geprüfte Version (`pruefung.geprueft_version`) der aktuellen entspricht – jede inhaltliche Änderung (neue Version)
 * hebt die Kennzeichnung auf, bis erneut geprüft ist (Bedingung (2) im Prüfvermerk Dr. Weber vom 22.10.2026).
 *
 * Die Nennung des Prüfers mit Namen steht nur dort, wo der Prüfer den Wortlaut freigegeben hat UND `nennung` an ist
 * (unterschriebener Prüfvermerk, bei Dr. Weber zusätzlich die Vereinbarung zu Pflege und Widerruf). Sonst steht ein
 * neutraler Vermerk „Inhalt fachlich geprüft, Stand …“. Nie „rechtssicher“, „garantiert“ oder „freigegeben“ (Bedingung (3)).
 */
const datumDe = (iso: string) => iso.split("-").reverse().join(".");

const VERMERK_NEUTRAL_TEXT = "Inhalt fachlich geprüft, Stand {stand}. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.";
/** Neutraler Vermerk, solange der Name nicht genannt werden darf. */
export const VERMERK_NEUTRAL = VERMERK_NEUTRAL_TEXT;

interface Pruefer {
  /** Wortlaut, den der Prüfer freigegeben hat; {stand} = Datum der Prüfung (TT.MM.JJJJ) */
  wortlaut: string;
  /** Name darf erscheinen (unterschriebener Prüfvermerk liegt vor, ggf. Vereinbarung) */
  nennung: boolean;
}

/** Schlüssel = Eintrag in `pruefung.geprueft_von`. */
export const PRUEFER: Record<string, Pruefer> = {
  "RA Dr. Ulrich Weber": {
    wortlaut: "Inhalt geprüft von Rechtsanwalt Dr. Ulrich Weber (Weber & Merz, Reutlingen), Stand {stand}. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.",
    // Prüfvermerk vom 22.10.2026 noch ohne Unterschrift; Pflege und Widerruf „in einer gesonderten Vereinbarung“ (offen, T-160)
    nennung: false,
  },
  "Thomas Koch (Fachkraft für Arbeitssicherheit)": {
    // 22.10.2026: ausdrücklich ohne Namen – nur „Inhalt fachlich geprüft, Stand …“ (neutraler Vermerk)
    wortlaut: VERMERK_NEUTRAL_TEXT,
    nennung: false,
  },
  "Tim Baum (Lebensmittelfachbeauftragter)": {
    // 22.10.2026: ohne Namen – nur „fachlich geprüft (Stand …)“ (neutraler Vermerk)
    wortlaut: VERMERK_NEUTRAL_TEXT,
    nennung: false,
  },
  "StB Lutz Busch": {
    wortlaut: "Fachlich durchgesehen von StB Lutz Busch, Kanzlei Heckler und Busch (Stand {stand}) – ohne Gewähr für den Einzelfall.",
    // Bestätigung (Teil A, 19 Einträge in der genannten Fassung) unterschrieben Stuttgart 23.10.2026 – Name nur bei diesen,
    // weil nur sie `freigegeben` mit passender Version sind (docs/freigabe-katalog/freigaben.yaml, E-173)
    nennung: true,
  },
};



export interface PruefungRoh {
  status?: string;
  geprueft_von?: string[] | null;
  geprueft_am?: string | null;
  geprueft_version?: number | null;
}

/** Gilt der Eintrag in seiner aktuellen Version als fachlich geprüft? */
export function istGeprueft(version: number, pruefung: PruefungRoh | undefined | null): boolean {
  return pruefung?.status === "freigegeben" && typeof pruefung.geprueft_version === "number" && pruefung.geprueft_version === version && Boolean(pruefung.geprueft_am);
}

/** Vermerk für die Pflicht-Details, oder null, wenn der Eintrag (in dieser Version) nicht geprüft ist. */
export function pruefVermerk(version: number, pruefung: PruefungRoh | undefined | null): string | null {
  if (!istGeprueft(version, pruefung)) return null;
  const stand = datumDe(pruefung!.geprueft_am!);
  const p = PRUEFER[pruefung!.geprueft_von?.[0] ?? ""];
  return (p?.nennung ? p.wortlaut : VERMERK_NEUTRAL).replace("{stand}", stand);
}
