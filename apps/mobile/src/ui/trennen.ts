/**
 * Weiche Trennstellen (U+00AD) in langen Wörtern (G1): Auf schmalen Geräten (320 pt) oder mit großer Schrift brächen
 * „Rechnungsempfänger“, „Nutzungsbedingungen“ oder „Steuerberatung“ sonst mitten im Wort ohne Trennstrich
 * („Rechnungsempfänge / r“). Mit weicher Trennstelle steht der Strich an einer Silbe – sonst unsichtbar. Nur für die
 * Anzeige; VoiceOver liest das Zeichen nicht.
 *
 * R12 (UX #8): echte deutsche Trennmuster (Liang/TeX, „hyph-de-1996“ der Trennmustermannschaft, Paket `hyphen`) statt
 * eigener Faustregeln – die trennten „Freis-tel-lung“, „Videoü-ber-wa-chung“ und „Jugen-dar-beits-schutz“. Die
 * Ausnahmeliste bleibt für Wörter, an denen auch die Muster zweifeln.
 */
import erzeugen from "hyphen";
import muster from "hyphen/patterns/de-1996";

const WEICH = "\u00AD";
let silbenTrenner: ((wort: string) => string) | null = null;
const merker = new Map<string, string>();

/**
 * Feste Trennstellen nach Duden (R11 UX #11, R12) – Vorrang vor den Mustern. Schlüssel klein geschrieben, „·“ markiert
 * die Trennstelle.
 */
const AUSNAHMEN: Record<string, string> = Object.fromEntries(
  ["wie·der·her·stel·len", "wei·ter·emp·feh·len", "Jah·res·ab·schluss", "Be·triebs·arzt", "Be·triebs·ärz·tin", "Fach·kraft", "Kon·troll·map·pe", "Ar·beits·zeit·nach·weis", "Schlüs·sel·quit·tung", "Ur·instinkt", "be·inhal·tet"].map((w) => [w.replace(/·/g, "").toLowerCase(), w]),
);

/** Ein Wort nach den Mustern trennen – mindestens zwei Buchstaben vorn und hinten (wie TeX für Deutsch). */
function wortTrennen(wort: string): string {
  const fest = AUSNAHMEN[wort.toLowerCase()];
  if (fest) {
    // Groß- und Kleinschreibung des Originals behalten
    let i = 0;
    return [...fest].map((c) => (c === "·" ? WEICH : wort[i++]!)).join("");
  }
  const da = merker.get(wort);
  if (da !== undefined) return da;
  silbenTrenner ??= erzeugen(muster, { hyphenChar: WEICH });
  const roh = silbenTrenner(wort);
  // keine Trennstelle nach nur einem Buchstaben am Anfang bzw. vor nur einem am Ende
  const teile = roh.split(WEICH);
  const zusammen: string[] = [];
  for (const t of teile) {
    if (zusammen.length && (zusammen[zusammen.length - 1]!.length < 2 || t.length < 2)) zusammen[zusammen.length - 1] += t;
    else zusammen.push(t);
  }
  const ergebnis = zusammen.join(WEICH);
  if (merker.size < 5000) merker.set(wort, ergebnis);
  return ergebnis;
}

export function trennen(text: string): string {
  // nur Wörter ab 12 Zeichen – kurze passen immer; Adressen und Links bleiben unverändert
  if (/@|:\/\/|www\./.test(text)) return text;
  return text.replace(/\p{L}{12,}/gu, wortTrennen);
}

/**
 * R12 (UX #18): keine verwaisten Zeichen am Zeilenumbruch – geschütztes Leerzeichen nach „§“, „§§“, „Art.“, „Abs.“ und
 * „Nr.“ vor der Zahl; nach einem langen Wort (das notfalls mitten im Wort umbricht) kein Umbruch vor „?“ bzw. „!“
 * (Wortverbinder U+2060). Nur für die Anzeige.
 */
export function schuetzen(text: string): string {
  return text.replace(/(§§?|Art\.|Abs\.|Nr\.) (?=[\dIVX])/g, "$1\u00A0").replace(/(\p{L}{12,})([?!])/gu, "$1\u2060$2");
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
