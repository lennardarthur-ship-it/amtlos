/**
 * Weiche Trennstellen (U+00AD) in langen Wortzusammensetzungen (G1): Auf schmalen Geräten (320 pt) oder mit großer
 * Schrift brächen „Rechnungsempfänger“, „Nutzungsbedingungen“ oder „Steuerberatung“ sonst mitten im Wort ohne
 * Trennstrich („Rechnungsempfänge / r“). Mit weicher Trennstelle steht der Strich an der Fuge – sonst unsichtbar.
 * Nur für die Anzeige; VoiceOver liest das Zeichen nicht.
 *
 * R10: zuerst an bekannten Wortfugen („…beiträge“, „…kontrolle“), dann in noch langen Teilen nach Silben (einfache
 * Regel: vor dem letzten Mitlaut zwischen zwei Selbstlauten; „ch“, „ck“, „sch“, „ph“, „qu“ und Mitlaut + l/r bleiben
 * zusammen). Lieber eine Trennung an einer Silbe als ein Bruch mitten im Buchstaben ohne Strich.
 */
const SUFFIXE = "beratung|bedingungen|empfänger|mappe|beurteilung|erklärung|dokumentation|anweisung|verzeichnis|nachweis|anmeldung|meldung|aufbewahrung|unterweisung|sicherung|rechnung|bescheinigung|einstellungen|angaben|pflichten|unterlagen|versicherung|beiträge|beitrag|kontrolle|kontrollen|erzeugnisse|regelung|unternehmer|voranmeldung|verordnung|vorschrift|protokoll|verarbeitung|tätigkeiten|information|schutz|plan|liste|stelle|zeitraum|gesetz|steuer|pflicht|belehrung|arbeit|zeiten|zentrale|leistung|umsätze|schulung|prüfung|behörde|gewerbe|betrieb|lohn|daten|stoffe|stoff|mittel|geräte|gerät";
/** letzte Wortfuge eines Wortteils: Vorderteil (≥ 3 Buchstaben), bekannter Wortteil, Rest (leer oder ≥ 3 Buchstaben) */
const FUGE = new RegExp(`^(\\p{L}{3,})(${SUFFIXE})(\\p{L}{3,}|)$`, "u");

/** Alle bekannten Wortfugen von hinten nach vorn: „Kleinunternehmerregelung“ → „Klein·unternehmer·regelung“. */
function fugen(wort: string): { t: string; bekannt: boolean }[] {
  const m = FUGE.exec(wort);
  return m ? [...fugen(m[1]!), { t: m[2]! + m[3]!, bekannt: !m[3] }] : [{ t: wort, bekannt: false }];
}

const VOKAL = "aeiouyäöüAEIOUYÄÖÜ";
const istVokal = (c: string) => VOKAL.includes(c);
/** Mitlautgruppen, die am Silbenanfang zusammenbleiben (Trennung davor) */
const ANFANG = /^(sch|ch|ck|ph|qu|th|[bdfgkp][lr]|tr)$/i;

/** Silbentrennung eines Wortteils ohne Fugen: weiche Trennstellen, mindestens drei Buchstaben vorn und hinten. */
function silben(teil: string): string {
  if (teil.length < 9) return teil;
  const z = [...teil];
  const stellen: number[] = [];
  let i = 0;
  while (i < z.length) {
    // nächster Selbstlaut, dann die Mitlaute bis zum folgenden Selbstlaut
    while (i < z.length && !istVokal(z[i]!)) i++;
    while (i < z.length && istVokal(z[i]!)) i++;
    const a = i;
    while (i < z.length && !istVokal(z[i]!)) i++;
    if (i >= z.length) break;
    const mitlaute = z.slice(a, i).join("");
    if (!mitlaute) continue;
    // Trennung vor dem letzten Mitlaut – außer die letzten zwei bzw. drei gehören zusammen
    let vor = mitlaute.length - 1;
    for (const n of [3, 2])
      if (mitlaute.length >= n && ANFANG.test(mitlaute.slice(-n))) {
        vor = mitlaute.length - n;
        break;
      }
    stellen.push(a + vor);
  }
  let out = "";
  z.forEach((c, k) => {
    if (stellen.includes(k) && k >= 3 && z.length - k >= 3) out += "\u00AD";
    out += c;
  });
  return out;
}

export function trennen(text: string): string {
  // nur Wörter ab 12 Zeichen – kurze passen immer; Adressen und Links bleiben unverändert
  if (/@|:\/\/|www\./.test(text)) return text;
  return text.replace(/\p{L}{12,}/gu, (wort) =>
    fugen(wort)
      // bekannte Wortteile („bedingungen“) bleiben ganz – getrennt wird nur, was sonst zu lang bliebe
      .map(({ t, bekannt }) => (!bekannt && t.length >= 10 ? silben(t) : t))
      .join("\u00AD"),
  );
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
