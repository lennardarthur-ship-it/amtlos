/**
 * Datumseingabe lesen (G5): TT.MM.JJJJ, auch kurz („5.3.26“ → 05.03.2026) und mit / oder - getrennt, außerdem ISO.
 * Unterscheidet ein falsches Format von einem Tag, den es nicht gibt (29.02.2026), und markiert unplausible Jahre
 * (vor 2000 oder nach 2099) – als Hinweis, nicht als Sperre (Gründungsdatum 1998 ist möglich).
 */
export interface DatumGelesen {
  /** ISO-Datum JJJJ-MM-TT oder null */
  iso: string | null;
  /** „format“: nicht als Datum lesbar; „tag“: Format stimmt, den Tag gibt es aber nicht */
  fehler: "format" | "tag" | null;
  /** gültig, aber außerhalb 2000–2099 – nachfragen */
  unplausibel: boolean;
}

export function datumLesen(text: string): DatumGelesen {
  const de = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\s*$/.exec(text);
  const iso = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(text);
  if (!de && !iso) return { iso: null, fehler: "format", unplausibel: false };
  const t = Number(de ? de[1] : iso![3]);
  const mo = Number(de ? de[2] : iso![2]);
  // zweistellige Jahre: 26 → 2026 (Rechnungen, Belege und Fristen liegen in diesem Jahrhundert)
  const j = de ? (de[3]!.length === 2 ? 2000 + Number(de[3]) : Number(de[3])) : Number(iso![1]);
  // nur Tage, die es gibt (kein 31.02.) – zurückgerechnet geprüft
  const d = new Date(Date.UTC(j, mo - 1, t));
  d.setUTCFullYear(j);
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return { iso: null, fehler: "tag", unplausibel: false };
  return { iso: `${String(j).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(t).padStart(2, "0")}`, fehler: null, unplausibel: j < 2000 || j > 2099 };
}

/** ISO-Datum aus der Eingabe oder null. */
export const isoAus = (text: string): string | null => datumLesen(text).iso;
