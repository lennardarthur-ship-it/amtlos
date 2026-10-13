/**
 * Fußzeile und Seitenzahlen (E-123, neu gestaltet in E-129): Die Druckausgabe von iOS kennt keine Seitenzahlen in
 * HTML; deshalb setzt die App nach dem Drucken auf jede Seite
 * - bei Briefen (DIN 5008): die Geschäftsangaben in Spalten (Anschrift, Kontakt, Bank, Steuer/Register), Falz- und
 *   Lochmarken auf der ersten Seite und ab zwei Seiten „Seite x von y“;
 * - sonst: „Betrieb · Dokument“ links und „Stand … · Seite x von y“ rechts.
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
  return { gestalt: meta("amtlos-gestalt") || "nachweis", links: meta("amtlos-fuss-links"), rechts: meta("amtlos-fuss-rechts"), spalten, farbe: meta("amtlos-farbe") || "#2f3a45" };
}

/** Zeichen, die die Schrift darstellen kann (Latin-1, Latin Extended-A und Satzzeichen; Helvetica nur WinAnsi). */
const darstellbar = (t: string, eigen: boolean) =>
  eigen ? t.replace(/[^\x20-\x7E\u00A0-\u017F\u2010-\u2027\u20AC]/g, "") : t.replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u201E\u2022\u2026\u20AC]/g, "");

function farbeAus(hex: string) {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  return /^#[0-9a-f]{6}$/i.test(hex) ? rgb(n(1), n(3), n(5)) : rgb(0.18, 0.23, 0.27);
}

function kuerzen(t: string, schrift: PDFFont, groesse: number, max: number): string {
  let s = t;
  while (s.length > 4 && schrift.widthOfTextAtSize(s, groesse) > max) s = `${s.slice(0, -2).trimEnd()}…`;
  return s;
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
      if (f.spalten.length) {
        const oben = 22 * MM;
        seite.drawLine({ start: { x: links, y: oben + 4 }, end: { x: rechts, y: oben + 4 }, thickness: 0.5, color: linie });
        const breite = (rechts - links) / f.spalten.length;
        const groesse = 6.8;
        f.spalten.forEach((spalte, s) => {
          spalte.slice(0, 4).forEach((z, k) => {
            const istFett = z.startsWith("**") && z.endsWith("**");
            const schrift = istFett ? fett : normal;
            const text = kuerzen(darstellbar(istFett ? z.slice(2, -2) : z, eigen), schrift, groesse, breite - 8);
            seite.drawText(text, { x: links + s * breite, y: oben - 6 - k * 8.6, size: groesse, font: schrift, color: istFett ? tinte : grau });
          });
        });
      }
      if (i === 0) {
        // Falzmarken (105 mm, 210 mm) und Lochmarke (148,5 mm) nach DIN 5008 Form B
        for (const [y, laenge] of [[105, 5], [148.5, 7], [210, 5]] as const) seite.drawLine({ start: { x: 4 * MM, y: height - y * MM }, end: { x: (4 + laenge) * MM, y: height - y * MM }, thickness: 0.4, color: rgb(0.6, 0.63, 0.66) });
      }
      if (seiten.length > 1) {
        const t = `Seite ${i + 1} von ${seiten.length}`;
        seite.drawText(t, { x: rechts - normal.widthOfTextAtSize(t, 7.2), y: 26 * MM, size: 7.2, font: normal, color: grau });
        // Folgeseiten: Dokumentname oben rechts, damit lose Blätter zuzuordnen sind
        if (i > 0) {
          const kopf = kuerzen(darstellbar(f.links.split(" · ").slice(1).join(" · ") || f.links, eigen), normal, 7.2, (rechts - links) * 0.6);
          seite.drawText(kopf, { x: rechts - normal.widthOfTextAtSize(kopf, 7.2), y: height - 9 * MM, size: 7.2, font: normal, color: grau });
        }
      }
      return;
    }
    const rand = 20 * MM;
    const y = 9 * MM;
    const groesse = 7.2;
    const r = darstellbar([f.rechts, `Seite ${i + 1} von ${seiten.length}`].filter(Boolean).join(" · "), eigen);
    const rBreite = normal.widthOfTextAtSize(r, groesse);
    const l = kuerzen(darstellbar(f.links, eigen), normal, groesse, width - 2 * rand - rBreite - 16);
    seite.drawLine({ start: { x: rand, y: y + 10 }, end: { x: rand + 14, y: y + 10 }, thickness: 1.2, color: akzent });
    seite.drawLine({ start: { x: rand + 14, y: y + 10 }, end: { x: width - rand, y: y + 10 }, thickness: 0.4, color: linie });
    seite.drawText(l, { x: rand, y, size: groesse, font: normal, color: grau });
    seite.drawText(r, { x: width - rand - rBreite, y, size: groesse, font: normal, color: grau });
  });
  return doc.save();
}
