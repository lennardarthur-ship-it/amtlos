import type { Sprache } from "@amtlos/i18n";

/** Cent → „1.234,56 €“ (de) bzw. „€1,234.56“ (en). */
export function euroText(cent: number, s: Sprache): string {
  return new Intl.NumberFormat(s === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR" }).format(cent / 100);
}

/** Zahl ohne Währung für Eingabefelder: 1234,56 (de) bzw. 1234.56 (en). */
export function euroFeld(cent: number | null | undefined, s: Sprache): string {
  if (cent === null || cent === undefined) return "";
  const t = (cent / 100).toFixed(2);
  return s === "de" ? t.replace(".", ",") : t;
}

/** Eingabe → Cent. Deutsch: 1.234,56 · Englisch: 1,234.56. Leer → null, Unsinn → NaN. */
export function centAus(eingabe: FormDataEntryValue | null, s: Sprache): number | null {
  const t = String(eingabe ?? "").trim().replace(/\s|€/g, "");
  if (!t) return null;
  const norm = s === "de" ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(norm)) return Number.NaN;
  return Math.round(Number(norm) * 100);
}

/** Menge: bis drei Nachkommastellen, Komma oder Punkt je Sprache. */
export function mengeAus(eingabe: FormDataEntryValue | null, s: Sprache): number {
  const t = String(eingabe ?? "").trim();
  const norm = s === "de" ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  return Number(norm);
}
