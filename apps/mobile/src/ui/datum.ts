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

export function datumLesen(text: string, o: { jahrReicht?: boolean } = {}): DatumGelesen {
  // nur das Jahr („2014“), wo der Tag nicht zählt (z. B. „läuft seit“): 1. Januar des Jahres (R10)
  const jahr = o.jahrReicht ? /^\s*(\d{4})\s*$/.exec(text) : null;
  if (jahr) {
    const j = Number(jahr[1]);
    return { iso: `${jahr[1]}-01-01`, fehler: null, unplausibel: j < 2000 || j > 2099 };
  }
  // Ziffern ohne Punkte (R10): „01042014“ bzw. „010414“ – wie auf dem Ziffernblock getippt
  const ziffern = /^\s*(\d{2})(\d{2})(\d{4}|\d{2})\s*$/.exec(text);
  const de = /^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\s*$/.exec(text) ?? ziffern;
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

/** Nur ein Jahr eingetippt („2014“) – dann fragt das Feld nach dem ganzen Datum. */
export const nurJahr = (text: string) => /^\s*\d{4}\s*$/.test(text);

/**
 * Uhrzeit lesen (R10): „14:00“, „9:30“, auch „14.00“, „14,00“ und Ziffern ohne Trennzeichen („1400“, „930“) – liefert
 * „HH:MM“ oder null.
 */
export function uhrzeitLesen(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{1,2})[:.,h](\d{2})$/.exec(t) ?? /^(\d{1,2})(\d{2})$/.exec(t) ?? (/^\d{1,2}$/.test(t) ? [t, t, "00"] : null);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Ist eine Person am Stichtag noch keine 18 (Geburtsdatum ISO, z. B. aus „Mitarbeiter“)? */
export function minderjaehrig(geburtsdatum: unknown, stichtag: string): boolean {
  if (typeof geburtsdatum !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(geburtsdatum)) return false;
  const volljaehrig = `${Number(geburtsdatum.slice(0, 4)) + 18}${geburtsdatum.slice(4)}`;
  return stichtag < volljaehrig;
}
