/**
 * Fachlich durchgesehene Vorlagen (Nachkontrolle T. Baum, 23.10.2026,
 * docs/pruefberichte/2026-10-23-lebensmittel-nachkontrolle-baum.md): Statt „Die Vorlagen sind noch nicht von Fachleuten
 * geprüft …“ zeigt die App bei diesen Vorlagen den Vermerk „Vorlagen fachlich durchgesehen (Stand …)“ – ohne Namen, wie
 * vom Prüfer gewünscht.
 *
 * Der Vermerk gilt nur für den Stand, den der Prüfer gesehen hat: Je Vorlage steht die Prüfsumme ihrer Bausteine und
 * Texte zum Freigabezeitpunkt (`vorlagenPruefsumme` in index.ts). Ändert sich ein Text, ein Baustein oder ein Hilfetext,
 * passt die Prüfsumme nicht mehr, und die App zeigt wieder den allgemeinen Hinweis. Die Prüfsumme darf nur nach einer
 * erneuten fachlichen Durchsicht neu eingetragen werden.
 */
import type { Daten } from "./typen.js";

export interface VorlagenFreigabe {
  /** Stand der Durchsicht (ISO-Datum) – erscheint im Vermerk */
  stand: string;
  /** Beleg der Freigabe (nur intern, nicht in der App) */
  bezug: string;
  /** SHA-256 (hex) der Bausteine und Texte zum Freigabezeitpunkt */
  pruefsumme: string;
  /**
   * Freigabe nur für eine Fassung der Vorlage (Hygieneplan: nur Lebensmittelbetrieb): Der Vermerk erscheint nur, wenn
   * das Feld diesen Wert hat; die Prüfsumme wird mit diesem Wert gebildet.
   */
  fassung?: { feld: string; wert: string };
  /** Nur Vorschläge dieser Gruppen gehören zur Freigabe (und zur Prüfsumme) – die übrigen hat der Prüfer nicht gesehen */
  gruppen?: string[];
}

const BAUM = "Nachkontrolle T. Baum 23.10.2026";
const BUSCH = "Durchsicht StB Busch 23.10.2026 (Bestätigung unterschrieben, docs/pruefberichte/2026-10-23-vorlagen-busch.xlsx)";
const KOCH = "Durchsicht T. Koch 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-koch.xlsx)";
const WEBER = "Durchsicht RA Dr. Weber 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-weber.xlsx)";

/** Zentrale Liste der fachlich durchgesehenen Vorlagen. */
export const VORLAGEN_GEPRUEFT: Readonly<Record<string, VorlagenFreigabe>> = {
  haccp: { stand: "2026-10-23", bezug: BAUM, pruefsumme: "bf971591cc3e7ab66b744bc12d6b6bfa75793eddb63eaea4b5b2bda5b423db0f" },
  hygieneplan: { stand: "2026-10-23", bezug: BAUM, pruefsumme: "941cde2f8ec04fc0ad7eb4ddcb08dc047d36416cadefbff5788f667da7133dd8", fassung: { feld: "art", wert: "lebensmittel" }, gruppen: ["Gastronomie / Café", "Bäckerei", "Foodtruck / mobiler Verkauf"] },
  allergene: { stand: "2026-10-23", bezug: BAUM, pruefsumme: "8d6b015f6491872e3ca492ee2c1b9245890e84428cacecfe914beb90ea85144c" },
  ifsg_belehrung: { stand: "2026-10-23", bezug: BAUM, pruefsumme: "2e35d889d03764df32a310aeacc999e2b6151e83afd38520da0c6c36d541ebec" },
  rechnung: { stand: "2026-10-23", bezug: BUSCH, pruefsumme: "8c2e773d415398dea57ab58922035136df2317e273cb2e82db72f0f86a6cda9e" },
  euer: { stand: "2026-10-23", bezug: BUSCH, pruefsumme: "d669212fbf4abf8bfcff24ad65388185ca46f47d513de53cf93e5286010130d2" },
  verfahrensdokumentation: { stand: "2026-10-23", bezug: BUSCH, pruefsumme: "9d23a5d3f01831910bcec4e93e563d8503a3736b68a73deaaf09d14435fec48b" },
  kassenmeldung: { stand: "2026-10-23", bezug: BUSCH, pruefsumme: "d9ac127520bab87ef105e7da71c3c9cebbc7549993ffcb8740ef243dcaa0ee65" },
  lohnkonto: { stand: "2026-10-23", bezug: BUSCH, pruefsumme: "7210085d37a2e3866d4d15108172b76d61339ee16cce5d3169bd8702393f9428" },
  // gefaehrdungsbeurteilung (Prüfsumme ea0f369a…, Durchsicht T. Koch 23.10.2026): Vermerk entfallen – Koch hat in derselben
  // Durchsicht Bausteine der Vorlage korrigiert (B-054, B-200, B-218, B-226, B-231, B-233, B-236, B-238); erneut vorlegen
  unterweisung: { stand: "2026-10-23", bezug: KOCH, pruefsumme: "73c536207bb588fba5cf502a2f83323e56c2fdd6c8b5c2a8b7ada82c4a91e8df" },
  gefahrstoffverzeichnis: { stand: "2026-10-23", bezug: KOCH, pruefsumme: "e1f81534e968125c84bbece65d414b87460da5c4748a820f243fb09d27e420a6" },
  betriebsanweisung_maschine: { stand: "2026-10-23", bezug: KOCH, pruefsumme: "f041a0b042843e6b29e05171e90e4669fefafde1ce37aeb4445f2dd58af1268e" },
  pruefprotokoll_elektro: { stand: "2026-10-23", bezug: KOCH, pruefsumme: "599f83aa64055153e81be987c85ffabc90b5aa02f16e293412b66782161c27c3" },
  datenschutz_dokumentation: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "524dfef7fee994656e460147adcac2fa4a2928dff076141e881ae90912499d28" },
  datenschutzerklaerung_website: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "1b191e90779472b36e0ff8582d5dbb4a73bc40d394d9663d62291aa387db5768" },
  avv: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "d4a5c48088053795e457ead7dea54f83e15d58a24134484a0c3938c029182811" },
  datenschutzinformation: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "5f243298c3669fefcf8e3f435e4b813f416a3ab04e1cba91deb88d75eef665c8" },
  datenpanne: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "e907682096eabf02baa57c257de08ffde433d31c3ccaba58640119663ddec962" },
  video_hinweisschild: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "9d1a06fbb30f998d3d4561780c495a56403a9bc96fca8c1242c584ce6fd48c75" },
  anamnese_einwilligung: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "16515a705e3114af069241bdcc4d604055373688dfa43d056c33efd62247bcac" },
  arbeitszeitnachweis: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "62df8ed29e691294c9e9cb06471cef68b385714e7c79360c0b3cb7ccf1a31a39" },
  nachweis_arbeitsbedingungen: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "c37a8792a9983556a308cf82a8f62e7af408d939f39a9bff617d8df72ae8b40b" },
  ki_kompetenz: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "2353e20c509afdfa922e841ecb2042d6bff6d9b40fa8317e86087bb1502218a4" },
  ausweis_hinweis: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "235a5366934919f9c449f9223d23317360e3f502a9fb4ec8cbbb3d76b9028c27" },
  schluesselquittung: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "2399c8cf81e2fee1fc294ea8de923f6d9c5c4ae05c633a95c3ca78215cffac8f" },
  impressum: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "9e79f203766117dd6c5e67a7d2aa51c100bb828689625dbfa15cf077cee9328f" },
  gewerbeanmeldung: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "8324d37f947181f884e29330c41f50c757b5486398ca864c3b2d11ccb610e110" },
  transparenzregister: { stand: "2026-10-23", bezug: WEBER, pruefsumme: "01473dc8aef549c590384275e82fbf08740a1da053f021709174242d73d84116" },
  hygieneschulung: { stand: "2026-10-23", bezug: BAUM, pruefsumme: "1f3bb870b0decd354c4cee8a7ab39bc1465e926e11549c8028c222418549f50e" },
};

/** Vermerk in der App (ohne Namen, Wortlaut des Prüfers). */
export const geprueftVermerk = (stand: string) => `Vorlagen fachlich durchgesehen (Stand ${stand.slice(0, 10).split("-").reverse().join(".")})`;

/** Fassung passt (ohne Angabe: immer). Ohne Daten (Info-Seite einer Vorlage mit Fassungen) gilt die Freigabe nicht. */
export function fassungPasst(f: VorlagenFreigabe, d?: Daten): boolean {
  if (!f.fassung) return true;
  return d !== undefined && d[f.fassung.feld] === f.fassung.wert;
}

/** JSON mit sortierten Schlüsseln; Funktionen und `undefined` entfallen (wie bei JSON.stringify). */
export function kanonisch(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  if (Array.isArray(x)) return `[${x.map((e) => (e === undefined || typeof e === "function" ? "null" : kanonisch(e))).join(",")}]`;
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined && typeof o[k] !== "function")
    .sort()
    .map((k) => `${JSON.stringify(k)}:${kanonisch(o[k])}`)
    .join(",")}}`;
}

/** Sichtbarer Text eines HTML-Dokuments: ohne <style>/<script>, ohne Tags und Attribute, Leerraum zusammengefasst. */
export function sichtbarerText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function utf8(s: string): number[] {
  const b: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) b.push(c);
    else if (c < 0x800) b.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) b.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else b.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return b;
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** SHA-256 (FIPS 180-4) eines Textes in UTF-8, hexadezimal – ohne Node- oder Browser-APIs (läuft auch in der App). */
export function sha256(text: string): string {
  const b = utf8(text);
  const laenge = b.length * 8;
  b.push(0x80);
  while (b.length % 64 !== 56) b.push(0);
  // Länge in Bit als 64-Bit-Zahl (Big Endian); Texte hier sind weit unter 2^32 Bit
  b.push(0, 0, 0, 0, (laenge >>> 24) & 255, (laenge >>> 16) & 255, (laenge >>> 8) & 255, laenge & 255);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < b.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = (b[i + 4 * t]! << 24) | (b[i + 4 * t + 1]! << 16) | (b[i + 4 * t + 2]! << 8) | b[i + 4 * t + 3]!;
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15]!, 7) ^ rotr(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
      const s1 = rotr(w[t - 2]!, 17) ^ rotr(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) | 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t]! + w[t]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0]! + a) | 0;
    h[1] = (h[1]! + bb) | 0;
    h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0;
    h[5] = (h[5]! + f) | 0;
    h[6] = (h[6]! + g) | 0;
    h[7] = (h[7]! + hh) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
