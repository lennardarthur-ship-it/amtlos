/**
 * StB-Prüfung Steuerberatungskanzlei (21.10.2026, C-3, C-13): Art des Rechnungsempfängers – am Kunden gemerkt und in der
 * Rechnung ausgewertet (Aufbewahrungshinweis bei Privatpersonen, Leitweg-ID bei öffentlichen Stellen).
 */
import type { Option } from "./typen.js";

export const KUNDEN_ARTEN: Option[] = [
  { wert: "unternehmen", text: "Unternehmen" },
  { wert: "privat", text: "Privatperson" },
  { wert: "oeffentlich", text: "Öffentliche Stelle (Behörde, Kommune)" },
];
