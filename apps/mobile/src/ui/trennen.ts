/**
 * Weiche Trennstellen (U+00AD) in langen Wortzusammensetzungen (G1): Auf schmalen Geräten (320 pt) oder mit großer
 * Schrift brächen „Rechnungsempfänger“, „Nutzungsbedingungen“ oder „Steuerberatung“ sonst mitten im Wort ohne
 * Trennstrich („Rechnungsempfänge / r“). Mit weicher Trennstelle steht der Strich an der Fuge – sonst unsichtbar.
 * Nur für die Anzeige; VoiceOver liest das Zeichen nicht.
 */
const FUGEN = /(\p{L}{3,})(beratung|bedingungen|empfänger|mappe|beurteilung|erklärung|dokumentation|anweisung|verzeichnis|nachweis|anmeldung|meldung|aufbewahrung|unterweisung|sicherung|rechnung|bescheinigung|einstellungen|angaben|pflichten|unterlagen)/gu;

export function trennen(text: string): string {
  // nur Wörter ab 12 Zeichen – kurze passen immer
  return text.replace(/\p{L}{12,}/gu, (wort) => wort.replace(FUGEN, "$1\u00AD$2"));
}

/** Arabische und hebräische Schrift (inkl. Präsentationsformen) */
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * Eingegebenen Text (Kundenname, Anschrift) als eigene Schreibrichtungs-Insel (G3): Beginnt ein Name mit arabischer
 * oder hebräischer Schrift, würde sonst der ganze Absatz rechtsbündig und umsortiert („· 2026-004“ vorn). FSI/PDI
 * (U+2068/U+2069) bestimmen die Richtung nur innerhalb des Namens; der Absatz bleibt links nach rechts. Texte ohne
 * solche Schrift bleiben unverändert.
 */
export function isoliert(text: string): string {
  // je Zeile – eine Insel endet ohnehin am Absatzende
  return text
    .split("\n")
    .map((z) => (RTL.test(z) ? `\u2068${z}\u2069` : z))
    .join("\n");
}
