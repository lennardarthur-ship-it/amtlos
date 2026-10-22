/**
 * Fußzeile und Seitenzahlen (E-123, neu gestaltet in E-129): Die Druckausgabe von iOS kennt keine Seitenzahlen in
 * HTML; deshalb setzt die App nach dem Drucken auf jede Seite
 * - bei Briefen (DIN 5008): die Geschäftsangaben in Spalten (Anschrift, Kontakt, Bank, Steuer/Register), Falz- und
 *   Lochmarken auf der ersten Seite und ab zwei Seiten „Seite x von y“. Die Spalten werden nie gekürzt (Pflichtangaben
 *   nach § 35a GmbHG, § 37a HGB): sie brechen um, die Spaltenbreiten richten sich nach dem Inhalt;
 * - sonst: „Betrieb · Dokument“ links und „Stand … · Seite x von y“ rechts, bündig mit dem Satzspiegel der Gestalt
 *   (linker und rechter Seitenrand aus der Meta-Angabe „amtlos-raender“, z. B. Aushang 14 mm, Nachweis 18 mm);
 * - ab Seite 2 immer eine kleine Kopfzeile mit dem Dokumentnamen, damit lose Blätter zuzuordnen sind.
 * Schrift: Amtlos Sans (wie im Dokument), notfalls Helvetica.
 */
// CommonJS-Build: die ESM-Variante von pdf-lib bindet tslib so ein, dass Metro es nicht auflösen kann
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib/cjs/index";
import fontkit from "@pdf-lib/fontkit";
import { schriftBytes } from "./schriften";

const MM = 72 / 25.4;

export interface FussAngaben {
  gestalt: string;
  links: string;
  rechts: string;
  spalten: string[][];
  farbe: string;
  /** Seitenränder der Gestalt in mm (oben, rechts, unten, links) – fehlen sie, gelten 20 mm links und rechts */
  raender?: [number, number, number, number];
}

const entity = (t: string) => t.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Angaben für die Fußzeile aus den Meta-Tags des Dokuments (gesetzt von dokument()/brief() in @amtlos/fachlogik). */
export function fussAngaben(html: string): FussAngaben {
  const meta = (name: string) => entity(new RegExp(`<meta name="${name}" content="([^"]*)">`).exec(html)?.[1] ?? "");
  let spalten: string[][] = [];
  try {
    const roh = JSON.parse(meta("amtlos-fuss-spalten") || "[]") as unknown;
    if (Array.isArray(roh)) spalten = roh.filter(Array.isArray).map((s) => (s as unknown[]).filter((x): x is string => typeof x === "string"));
  } catch {
    spalten = [];
  }
  const r = meta("amtlos-raender").split(",").map(Number);
  const raender = r.length === 4 && r.every((x) => Number.isFinite(x) && x >= 0 && x < 60) ? (r as [number, number, number, number]) : undefined;
  return { gestalt: meta("amtlos-gestalt") || "nachweis", links: meta("amtlos-fuss-links"), rechts: meta("amtlos-fuss-rechts"), spalten, farbe: meta("amtlos-farbe") || "#3b30c4", ...(raender ? { raender } : {}) };
}

/** Zeichen, die die Schrift darstellen kann (Latin-1, Latin Extended-A und Satzzeichen; Helvetica nur WinAnsi). */
const darstellbar = (t: string, eigen: boolean) =>
  eigen ? t.replace(/[^\x20-\x7E\u00A0-\u017F\u2010-\u2027\u20AC]/g, "") : t.replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u201E\u2022\u2026\u20AC]/g, "");

function farbeAus(hex: string) {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return /^#[0-9a-f]{6}$/i.test(hex) ? rgb(n(1), n(3), n(5)) : rgb(0.18, 0.23, 0.27);
}

/** Text in Zeilen bis `max` Breite; zu lange Wörter (E-Mail, Website) werden nach Satzzeichen bzw. zeichenweise geteilt. */
export function umbrechen(t: string, schrift: PDFFont, groesse: number, max: number): string[] {
  const breite = (x: string) => schrift.widthOfTextAtSize(x, groesse);
  const teile: string[] = [];
  for (const wort of t.split(" ")) {
    if (breite(wort) <= max) {
      teile.push(wort);
      continue;
    }
    let rest = wort;
    while (rest && breite(rest) > max) {
      let n = rest.length - 1;
      while (n > 1 && breite(rest.slice(0, n)) > max) n--;
      const satz = Math.max(rest.lastIndexOf(".", n - 1), rest.lastIndexOf("@", n - 1), rest.lastIndexOf("-", n - 1), rest.lastIndexOf("/", n - 1));
      const schnitt = satz > n / 2 ? satz + 1 : n;
      teile.push(`${rest.slice(0, schnitt)}\u0000`);
      rest = rest.slice(schnitt);
    }
    if (rest) teile.push(rest);
  }
  const zeilen: string[] = [];
  let zeile = "";
  for (const teil of teile) {
    const angehaengt = teil.endsWith("\u0000");
    const w = teil.replace("\u0000", "");
    const versuch = zeile ? `${zeile}${zeile.endsWith("\u0001") ? "" : " "}${w}`.replace("\u0001", "") : w;
    if (zeile && breite(versuch) > max) {
      zeilen.push(zeile.replace("\u0001", ""));
      zeile = w + (angehaengt ? "\u0001" : "");
    } else zeile = versuch + (angehaengt ? "\u0001" : "");
  }
  if (zeile) zeilen.push(zeile.replace("\u0001", ""));
  return zeilen;
}

/** Spaltenbreiten nach Inhalt: jede Spalte mindestens 60 % des gleichen Anteils, der Rest nach Bedarf. */
function spaltenBreiten(natuerlich: number[], verfuegbar: number): number[] {
  const n = natuerlich.length;
  const minimum = (verfuegbar / n) * 0.6;
  const summe = natuerlich.reduce((a, b) => a + b, 0);
  if (summe <= verfuegbar) {
    const rest = (verfuegbar - summe) / n;
    return natuerlich.map((w) => w + rest);
  }
  const roh = natuerlich.map((w) => Math.max(minimum, (verfuegbar * w) / summe));
  const faktor = verfuegbar / roh.reduce((a, b) => a + b, 0);
  return roh.map((w) => w * faktor);
}

function kuerzen(t: string, schrift: PDFFont, groesse: number, max: number): string {
  let s = t;
  while (s.length > 4 && schrift.widthOfTextAtSize(s, groesse) > max) s = `${s.slice(0, -2).trimEnd()}…`;
  return s;
}

/** Geschäftsangaben gesetzt: Spaltenbreiten, Zeilen (umbrochen, nie gekürzt), Schriftgröße (7,2 pt, bei mehr als fünf Zeilen kleiner). */
function briefSpalten(spalten: string[][], verfuegbar: number, normal: PDFFont, fett: PDFFont, eigen: boolean) {
  const abstandSpalten = 8;
  for (const groesse of [7.2, 6.8, 6.4]) {
    const zeilenRoh = spalten.map((s) => s.map((z) => ({ fett: z.startsWith("**") && z.endsWith("**"), text: darstellbar(z.startsWith("**") && z.endsWith("**") ? z.slice(2, -2) : z, eigen) })));
    const natuerlich = zeilenRoh.map((s) => Math.max(...s.map((z) => (z.fett ? fett : normal).widthOfTextAtSize(z.text, groesse))) + abstandSpalten);
    const breiten = spaltenBreiten(natuerlich, verfuegbar);
    const gesetzt = zeilenRoh.map((s, i) => s.flatMap((z) => umbrechen(z.text, z.fett ? fett : normal, groesse, breiten[i]! - abstandSpalten).map((t) => ({ fett: z.fett, text: t }))));
    const abstand = groesse * 1.27;
    if (Math.max(...gesetzt.map((s) => s.length)) <= 5 || groesse === 6.4) return { spalten: gesetzt, breiten, groesse, abstand };
  }
  throw new Error("unerreichbar");
}

export async function fusszeileStempeln(pdf: string | Uint8Array, f: FussAngaben): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  let normal: PDFFont;
  let fett: PDFFont;
  let eigen = true;
  try {
    doc.registerFontkit(fontkit);
    normal = await doc.embedFont(schriftBytes("Amtlos Sans", 400), { subset: true });
    fett = await doc.embedFont(schriftBytes("Amtlos Sans", 600), { subset: true });
  } catch {
    eigen = false;
    normal = await doc.embedFont(StandardFonts.Helvetica);
    fett = await doc.embedFont(StandardFonts.HelveticaBold);
  }
  const seiten = doc.getPages();
  const grau = rgb(0.36, 0.4, 0.44);
  const tinte = rgb(0.11, 0.13, 0.15);
  const linie = rgb(0.79, 0.81, 0.83);
  const akzent = farbeAus(f.farbe);
  const brief = f.gestalt === "brief";
  seiten.forEach((seite, i) => {
    const { width, height } = seite.getSize();
    if (brief) {
      const links = 25 * MM;
      const rechts = width - 20 * MM;
      let seitenzahlY = 26 * MM;
      if (f.spalten.length) {
        const satz = briefSpalten(f.spalten, rechts - links, normal, fett, eigen);
        // die letzte Zeile mindestens 9 mm über der Blattkante; bei vielen Zeilen rückt der Block nach oben
        const zeilen = Math.max(...satz.spalten.map((s) => s.length));
        const ersteZeile = Math.max(22 * MM - 6, 9 * MM + (zeilen - 1) * satz.abstand);
        const linieY = ersteZeile + 10;
        seite.drawLine({ start: { x: links, y: linieY }, end: { x: rechts, y: linieY }, thickness: 0.5, color: linie });
        seitenzahlY = linieY + 7.3;
        let x = links;
        satz.spalten.forEach((spalte, s) => {
          spalte.forEach((z, k) => seite.drawText(z.text, { x, y: ersteZeile - k * satz.abstand, size: satz.groesse, font: z.fett ? fett : normal, color: z.fett ? tinte : grau }));
          x += satz.breiten[s]!;
        });
      }
      if (i === 0) {
        // Falzmarken (105 mm, 210 mm) und Lochmarke (148,5 mm) nach DIN 5008 Form B
        for (const [y, laenge] of [[105, 5], [148.5, 7], [210, 5]] as const) seite.drawLine({ start: { x: 4 * MM, y: height - y * MM }, end: { x: (4 + laenge) * MM, y: height - y * MM }, thickness: 0.4, color: rgb(0.6, 0.63, 0.66) });
      }
      if (seiten.length > 1) {
        const t = `Seite ${i + 1} von ${seiten.length}`;
        // passt die Seitenzahl nicht mehr unter den Satzspiegel (unterer Rand 30 mm), steht sie oben rechts
        const unten = seitenzahlY + 5.5 < 29.5 * MM;
        seite.drawText(t, { x: rechts - normal.widthOfTextAtSize(t, 7.2), y: unten ? seitenzahlY : height - 9 * MM + (i > 0 ? 9 : 0), size: 7.2, font: normal, color: grau });
        // Folgeseiten: Dokumentname oben rechts, damit lose Blätter zuzuordnen sind
        if (i > 0) {
          const kopf = kuerzen(darstellbar(f.links.split(" · ").slice(1).join(" · ") || f.links, eigen), normal, 7.2, (rechts - links) * 0.6);
          seite.drawText(kopf, { x: rechts - normal.widthOfTextAtSize(kopf, 7.2), y: height - 9 * MM, size: 7.2, font: normal, color: grau });
        }
      }
      return;
    }
    // bündig mit dem Satzspiegel: linker bzw. rechter Seitenrand der Gestalt
    const randL = (f.raender?.[3] ?? 20) * MM;
    const randR = (f.raender?.[1] ?? 20) * MM;
    // Aushang: unterer Rand nur 16 mm – die Fußzeile steht tiefer
    const y = (f.gestalt === "aushang" ? 7 : 9) * MM;
    const groesse = 7.2;
    const r = darstellbar([f.rechts, `Seite ${i + 1} von ${seiten.length}`].filter(Boolean).join(" · "), eigen);
    const rBreite = normal.widthOfTextAtSize(r, groesse);
    const l = kuerzen(darstellbar(f.links, eigen), normal, groesse, width - randL - randR - rBreite - 16);
    seite.drawLine({ start: { x: randL, y: y + 10 }, end: { x: randL + 14, y: y + 10 }, thickness: 1.2, color: akzent });
    seite.drawLine({ start: { x: randL + 14, y: y + 10 }, end: { x: width - randR, y: y + 10 }, thickness: 0.4, color: linie });
    seite.drawText(l, { x: randL, y, size: groesse, font: normal, color: grau });
    seite.drawText(r, { x: width - randR - rBreite, y, size: groesse, font: normal, color: grau });
    // Folgeseiten: Dokumentname oben rechts
    if (i > 0) {
      const kopf = kuerzen(darstellbar(f.links.split(" · ").slice(1).join(" · ") || f.links, eigen), normal, groesse, (width - randL - randR) * 0.6);
      seite.drawText(kopf, { x: width - randR - normal.widthOfTextAtSize(kopf, groesse), y: height - 7.5 * MM, size: groesse, font: normal, color: grau });
    }
  });
  return doc.save();
}
