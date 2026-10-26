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

/**
 * E-208: Einzelpreis einer Rechnungsposition → Cent mit bis zu zwei Nachkommastellen (bis vier Nachkommastellen in Euro,
 * z. B. 0,3456 € je kWh → 34,56). Mehr Stellen: Fehler (NaN) statt Raten. Leer → null.
 */
export function preisCentAus(eingabe: FormDataEntryValue | null, s: Sprache): number | null {
  const t = String(eingabe ?? "").trim().replace(/\s|€/g, "");
  if (!t) return null;
  const norm = s === "de" ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,4})?$/.test(norm)) return Number.NaN;
  const [ganz, nach = ""] = norm.replace("-", "").split(".");
  const h = Number(ganz) * 10_000 + Number(nach.padEnd(4, "0")); // Hundertstel-Cent, ohne Gleitkomma
  return ((norm.startsWith("-") ? -1 : 1) * h) / 100;
}

/** E-208: Einzelpreis für das Eingabefeld – zwei bis vier Nachkommastellen (12,50 bzw. 0,3456). */
export function preisFeld(cent: number | null | undefined, s: Sprache): string {
  if (cent === null || cent === undefined) return "";
  const t = (cent / 100).toFixed(4).replace(/(\.\d\d\d*?)0+$/, "$1");
  return s === "de" ? t.replace(".", ",") : t;
}

/** E-208: Zeilenbetrag in Cent – Menge × Einzelpreis, einmal kaufmännisch gerundet (wie die Fachlogik). */
export const zeileCent = (menge: number, cent: number) => {
  const x = (Math.round(menge * 10_000) * Math.round(cent * 100)) / 1_000_000;
  return Math.sign(x) * Math.round(Math.abs(x));
};

/** Menge: bis drei Nachkommastellen, Komma oder Punkt je Sprache. */
export function mengeAus(eingabe: FormDataEntryValue | null, s: Sprache): number {
  const t = String(eingabe ?? "").trim();
  const norm = s === "de" ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  return Number(norm);
}
