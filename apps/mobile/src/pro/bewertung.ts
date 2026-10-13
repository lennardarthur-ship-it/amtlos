/**
 * Bitte um eine App-Store-Bewertung (E-132) – nur nach Erfolgsmomenten (Rechnung geteilt, Check fertig, Zahlung
 * vermerkt), frühestens nach dem dritten und höchstens alle 120 Tage. Apple zeigt den Dialog ohnehin höchstens dreimal
 * im Jahr; die App fragt nie mitten in einer Eingabe und nie mit eigenem Dialog davor.
 */
export const ERFOLGE_BIS_FRAGE = 3;
export const TAGE_ZWISCHEN_FRAGEN = 120;

export function sollFragen(b: { erfolge: number; gefragt?: string }, jetzt: Date): boolean {
  if (b.erfolge < ERFOLGE_BIS_FRAGE) return false;
  if (!b.gefragt) return true;
  return (jetzt.getTime() - Date.parse(b.gefragt)) / 864e5 >= TAGE_ZWISCHEN_FRAGEN;
}
