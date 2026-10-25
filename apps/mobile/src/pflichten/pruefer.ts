/**
 * E-171: Fachliche Freigabe je Katalogeintrag. Ein Eintrag gilt als geprüft, wenn `pruefung.status` „freigegeben“ ist und
 * die geprüfte Version (`pruefung.geprueft_version`) der aktuellen entspricht – jede inhaltliche Änderung (neue Version)
 * hebt die Kennzeichnung auf, bis erneut geprüft ist (Bedingung (2) im Prüfvermerk des Rechtsanwalts vom 22.10.2026).
 *
 * E-196: Der Vermerk nennt nie eine Person, nur die Rolle („von einem Rechtsanwalt“). E-197: `pruefung` entsteht nur aus
 * schriftlich bestätigten Freigaben (Mail des Prüfers, ausgefüllte Freigabe-Datei oder ein inzwischen entferntes
 * unterschriebenes Blatt; docs/freigabe-katalog/anwenden.py, `bestaetigt_am`); der Stand liegt nie nach der Bestätigung.
 * Eine Einschränkung des Prüfers steht im Vermerk („ohne arbeitsmedizinische Angaben“), offene Prüfpunkte machen ihn
 * zu „teilweise geprüft“ mit dem offenen Punkt. Nie „rechtssicher“, „garantiert“ oder „freigegeben“ (Bedingung (3)).
 */
const datumDe = (iso: string) => iso.split("-").reverse().join(".");

const VERMERK_NEUTRAL_TEXT = "Inhalt fachlich geprüft, Stand {stand}. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.";
/** Neutraler Vermerk (ohne Rolle), wenn die Rolle nicht genannt werden soll oder die Nennungsfrist abgelaufen ist. */
export const VERMERK_NEUTRAL = VERMERK_NEUTRAL_TEXT;

export interface Rolle {
  /** Bezeichnung der Rolle (nie ein Name) */
  bezeichnung: string;
  /** „von einem Rechtsanwalt“ – steht im Vermerk */
  von: string;
  /**
   * Satzbau des Vermerks; {stand} = Datum (TT.MM.JJJJ), {pruefer} = „von einem …“ samt Einschränkung, {teilweise} bzw.
   * {Fachlich} = „teilweise “ bzw. „Teilweise fachlich“ bei offenen Prüfpunkten, {offen} = „; noch offen: …“
   */
  wortlaut: string;
  /** Rolle darf im Vermerk stehen */
  nennung: boolean;
  /**
   * Rolle nur so viele Monate nach dem Prüfdatum, danach der neutrale Vermerk (Vereinbarung mit dem Rechtsanwalt § 4 Abs. 3).
   * Die App vergleicht dafür das Prüfdatum mit dem Datum des Geräts – ohne Server.
   */
  nennungMonate?: number;
}

const ALLGEMEIN = "Inhalt {teilweise}fachlich geprüft {pruefer}, Stand {stand}{offen}. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.";

/** Schlüssel = Eintrag in `pruefung.geprueft_von` (Rollen-ID wie in docs/freigabe-katalog/freigaben.yaml). */
export const ROLLEN: Record<string, Rolle> = {
  recht: { bezeichnung: "Rechtsanwalt", von: "von einem Rechtsanwalt", wortlaut: ALLGEMEIN, nennung: true, nennungMonate: 12 },
  // Wortlaut des Steuerberaters (Bestätigung 23.10.2026) ohne Namen und Kanzlei
  steuern: { bezeichnung: "Steuerberater", von: "von einem Steuerberater", wortlaut: "{Fachlich} durchgesehen {pruefer} (Stand {stand}{offen}) – ohne Gewähr für den Einzelfall.", nennung: true },
  arbeitsschutz: { bezeichnung: "Fachkraft für Arbeitssicherheit", von: "von einer Fachkraft für Arbeitssicherheit", wortlaut: ALLGEMEIN, nennung: true },
  hygiene: { bezeichnung: "Lebensmittelfachbeauftragter", von: "von einem Lebensmittelfachbeauftragten", wortlaut: ALLGEMEIN, nennung: true },
};
/** Früherer Name der Liste (E-171) */
export const PRUEFER = ROLLEN;

export interface PruefungRoh {
  status?: string;
  geprueft_von?: string[] | null;
  geprueft_am?: string | null;
  geprueft_version?: number | null;
  bestaetigt_am?: string | null;
  einschraenkung?: string | null;
  offen?: string[] | null;
}

/** Gilt der Eintrag in seiner aktuellen Version als fachlich geprüft (schriftlich bestätigt, Stand nicht nach der Bestätigung)? */
export function istGeprueft(version: number, pruefung: PruefungRoh | undefined | null): boolean {
  return (
    pruefung?.status === "freigegeben" &&
    typeof pruefung.geprueft_version === "number" &&
    pruefung.geprueft_version === version &&
    Boolean(pruefung.geprueft_am) &&
    Boolean(pruefung.bestaetigt_am) &&
    pruefung.geprueft_am! <= pruefung.bestaetigt_am!
  );
}

/** Ganz geprüft: geprüft, ohne Einschränkung und ohne offene Prüfpunkte (für „Pflichten sind fachlich geprüft“). */
export function istGanzGeprueft(version: number, pruefung: PruefungRoh | undefined | null): boolean {
  return istGeprueft(version, pruefung) && !pruefung!.einschraenkung && !(pruefung!.offen ?? []).length;
}

/** Vermerk für die Pflicht-Details, oder null, wenn der Eintrag (in dieser Version) nicht geprüft ist. */
export function pruefVermerk(version: number, pruefung: PruefungRoh | undefined | null, heute: Date = new Date()): string | null {
  if (!istGeprueft(version, pruefung)) return null;
  const p = pruefung!;
  const stand = datumDe(p.geprueft_am!);
  const offen = (p.offen ?? []).filter(Boolean);
  const einschr = p.einschraenkung ? ` (${p.einschraenkung})` : "";
  const rollen = (p.geprueft_von ?? []).map((r) => ROLLEN[r]).filter((r): r is Rolle => Boolean(r));
  const nennen = rollen.length > 0 && rollen.every((r) => r.nennung && nennungGilt(p.geprueft_am!, r.nennungMonate, heute));
  // Geteilte Prüfung (Lebensmittel): beide Rollen mit ihrem Umfang – nie der Eindruck, eine Rolle habe alle Felder geprüft
  let pruefer: string;
  let satz = ALLGEMEIN;
  if (!nennen) pruefer = "";
  else if (rollen.length === 2 && p.geprueft_von![0] === "hygiene" && p.geprueft_von![1] === "recht")
    pruefer = `${rollen[0]!.von}${einschr}, die Folgen bei Verstoß ${rollen[1]!.von}`;
  else if (rollen.length === 1) {
    pruefer = `${rollen[0]!.von}${einschr}`;
    satz = rollen[0]!.wortlaut;
  } else pruefer = "";
  if (!pruefer) {
    // ohne Rolle: neutraler Vermerk, Einschränkung und offene Punkte bleiben sichtbar
    satz = ALLGEMEIN;
    pruefer = einschr.trim();
  }
  const teilweise = offen.length > 0;
  return satz
    .replace("{Fachlich}", teilweise ? "Teilweise fachlich" : "Fachlich")
    .replace("{teilweise}", teilweise ? "teilweise " : "")
    .replace(" {pruefer}", pruefer ? ` ${pruefer}` : "")
    .replace("{stand}", stand)
    .replace("{offen}", teilweise ? `; noch offen: ${offen.join("; ")}` : "");
}

/** Liegt das Prüfdatum höchstens `monate` Monate zurück (ohne Angabe: unbegrenzt)? */
export function nennungGilt(geprueftAm: string, monate: number | undefined, heute: Date = new Date()): boolean {
  if (monate === undefined) return true;
  const [j, m, t] = geprueftAm.slice(0, 10).split("-").map(Number);
  const grenze = new Date(j!, m! - 1 + monate, t!);
  return heute < grenze;
}
