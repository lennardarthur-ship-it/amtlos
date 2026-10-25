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
  /**
   * Nennung nur so viele Monate nach dem Prüfdatum, danach der neutrale Vermerk (Vereinbarung RA Dr. Weber § 4 Abs. 3).
   * Die App vergleicht dafür das Prüfdatum mit dem Datum des Geräts – ohne Server.
   */
  nennungMonate?: number;
}

/** Schlüssel = Eintrag in `pruefung.geprueft_von`. */
export const PRUEFER: Record<string, Pruefer> = {
  "RA Dr. Ulrich Weber": {
    wortlaut: "Inhalt geprüft von Rechtsanwalt Dr. Ulrich Weber (Weber & Merz, Reutlingen), Stand {stand}. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.",
    // Bestätigungsblatt unterschrieben 23.10.2026 (ohne Namensnennung); Name erst mit der gesonderten Vereinbarung zu Pflege
    // und Widerruf (offen, T-160)
    nennung: false,
    nennungMonate: 12,
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
    // Bestätigung vom 23.10.2026 (30 Einträge, alle Felder; ersetzt Teil A vom 22.10.) unterschrieben – Name nur bei Einträgen,
    // die `freigegeben` mit passender Version sind (docs/freigabe-katalog/freigaben.yaml, E-173). Das Blatt verweist auf die
    // Auftragsvereinbarung – unterschrieben an StB Busch senden (T-161)
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
export function pruefVermerk(version: number, pruefung: PruefungRoh | undefined | null, heute: Date = new Date()): string | null {
  if (!istGeprueft(version, pruefung)) return null;
  const stand = datumDe(pruefung!.geprueft_am!);
  const p = PRUEFER[pruefung!.geprueft_von?.[0] ?? ""];
  return (p?.nennung && nennungGilt(pruefung!.geprueft_am!, p.nennungMonate, heute) ? p.wortlaut : VERMERK_NEUTRAL).replace("{stand}", stand);
}

/** Liegt das Prüfdatum höchstens `monate` Monate zurück (ohne Angabe: unbegrenzt)? */
export function nennungGilt(geprueftAm: string, monate: number | undefined, heute: Date = new Date()): boolean {
  if (monate === undefined) return true;
  const [j, m, t] = geprueftAm.slice(0, 10).split("-").map(Number);
  const grenze = new Date(j!, m! - 1 + monate, t!);
  return heute < grenze;
}
