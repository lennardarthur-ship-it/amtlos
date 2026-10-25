/**
 * Kompakte Schreibweise des Stands (E-194): Große Texte stehen nur einmal darin.
 *
 * Jede festgeschriebene E-Rechnung hält die Absenderdaten fest (R12 GoBD, `Unterlage.absender`) – samt Logo als
 * Data-URL (`data:image/png;base64,…`, bis einige hundert KB). Bei hunderten Rechnungen stand dasselbe Logo hunderte Male
 * im gespeicherten Stand, in jeder Sicherung und in jeder automatischen Sicherung. Inhaltlich bleibt alles gleich
 * (jede Rechnung behält ihren Schnappschuss, byte-genau); nur die Schreibweise legt jeden großen Text einmal ab und
 * verweist darauf.
 *
 * Format: `{"format":"amtlos-kompakt","version":99,"texte":[…],"stand":{…}}`. Im Stand steht statt eines großen Texts
 * „\u0000t<Nr>“; ein echter Text, der mit „\u0000“ beginnt, bekommt ein weiteres „\u0000“ davor (nie verwechselbar).
 * `version: 99` sorgt dafür, dass eine ältere App die Datei als „aus einer neueren Version“ ablehnt, statt sie für einen
 * leeren Stand zu halten. Ohne große Texte bleibt es beim gewohnten JSON des Stands.
 */
export const KOMPAKT_FORMAT = "amtlos-kompakt";
/** ab so vielen Zeichen wird ein Text ausgelagert */
export const KOMPAKT_AB = 2048;
const NUL = "\u0000";

/** Stand (oder ein beliebiges Objekt) als JSON – große Texte nur einmal. */
export function kompaktJson(wert: unknown): string {
  const nummer = new Map<string, number>();
  const texte: string[] = [];
  let geaendert = false;
  const json = JSON.stringify(wert, (_k, w: unknown) => {
    if (typeof w !== "string") return w;
    if (w.length >= KOMPAKT_AB) {
      let n = nummer.get(w);
      if (n === undefined) {
        n = texte.length;
        nummer.set(w, n);
        texte.push(w);
      }
      geaendert = true;
      return `${NUL}t${n}`;
    }
    if (w.charCodeAt(0) === 0) {
      geaendert = true;
      return NUL + w;
    }
    return w;
  });
  if (!geaendert) return json;
  // die ausgelagerten Texte selbst stehen unverändert (sie beginnen nie mit „\u0000“ – sonst würden sie maskiert)
  return `{"format":"${KOMPAKT_FORMAT}","version":99,"texte":${JSON.stringify(texte.map((t) => (t.charCodeAt(0) === 0 ? NUL + t : t)))},"stand":${json}}`;
}

/** Ist das geparste Objekt die kompakte Schreibweise? */
export function istKompakt(w: unknown): w is { format: typeof KOMPAKT_FORMAT; texte: unknown; stand: unknown } {
  return Boolean(w && typeof w === "object" && !Array.isArray(w) && (w as { format?: unknown }).format === KOMPAKT_FORMAT);
}

/**
 * Kompakte Schreibweise auflösen: liefert den Stand mit allen Texten zurück (gleicher Text = dasselbe Objekt im
 * Speicher, so belegen hundert Logos auch im Arbeitsspeicher nur einmal Platz). Wirft bei unbekannten Verweisen.
 */
export function kompaktAufloesen(w: { texte: unknown; stand: unknown }): unknown {
  if (!Array.isArray(w.texte) || !w.texte.every((t) => typeof t === "string")) throw new Error("Kompakt: Texte fehlen");
  const texte = (w.texte as string[]).map((t) => (t.charCodeAt(0) === 0 ? t.slice(1) : t));
  const text = (s: string): string => {
    if (s.charCodeAt(0) !== 0) return s;
    if (s.charCodeAt(1) === 0) return s.slice(1);
    const nr = s.charCodeAt(1) === 116 /* „t“ */ && /^\d+$/.test(s.slice(2)) ? Number(s.slice(2)) : -1;
    const t = nr >= 0 ? texte[nr] : undefined;
    if (t === undefined) throw new Error("Kompakt: unbekannter Verweis");
    return t;
  };
  const gehen = (x: unknown): unknown => {
    if (typeof x === "string") return text(x);
    if (Array.isArray(x)) {
      for (let i = 0; i < x.length; i++) x[i] = gehen(x[i]);
      return x;
    }
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      for (const k of Object.keys(o)) o[k] = gehen(o[k]);
      return o;
    }
    return x;
  };
  return gehen(w.stand);
}
