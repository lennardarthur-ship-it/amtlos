/**
 * Fußzeile mit Seitenzahlen (E-123): Die Druckausgabe von iOS kennt keine Seitenzahlen in HTML; deshalb setzt die App
 * nach dem Drucken auf jede Seite „Betrieb · Dokument“ links und „Stand … · Seite x von y“ rechts.
 */
// CommonJS-Build: die ESM-Variante von pdf-lib bindet tslib so ein, dass Metro es nicht auflösen kann
import { PDFDocument, StandardFonts, rgb } from "pdf-lib/cjs/index";

/** Angaben für die Fußzeile aus den Meta-Tags des Dokuments (gesetzt von dokument() in @amtlos/fachlogik). */
export function fussAngaben(html: string): { links: string; rechts: string } {
  const meta = (name: string) => {
    const m = new RegExp(`<meta name="${name}" content="([^"]*)">`).exec(html);
    return (m?.[1] ?? "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  };
  return { links: meta("amtlos-fuss-links"), rechts: meta("amtlos-fuss-rechts") };
}

/** Nur Zeichen, die die PDF-Standardschrift (WinAnsi) darstellen kann. */
const darstellbar = (t: string) => t.replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u201E\u2022\u2026\u20AC]/g, "");

export async function fusszeileStempeln(pdf: string | Uint8Array, links: string, rechts: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  const seiten = doc.getPages();
  const grau = rgb(0.42, 0.46, 0.5);
  const groesse = 7.5;
  seiten.forEach((seite, i) => {
    const { width } = seite.getSize();
    const rand = 42;
    const y = 24;
    const r = darstellbar([rechts, `Seite ${i + 1} von ${seiten.length}`].filter(Boolean).join(" · "));
    const rBreite = schrift.widthOfTextAtSize(r, groesse);
    let l = darstellbar(links);
    while (l.length > 4 && schrift.widthOfTextAtSize(l, groesse) > width - 2 * rand - rBreite - 16) l = `${l.slice(0, -2).trimEnd()}…`;
    seite.drawLine({ start: { x: rand, y: y + 10 }, end: { x: width - rand, y: y + 10 }, thickness: 0.4, color: rgb(0.78, 0.8, 0.82) });
    seite.drawText(l, { x: rand, y, size: groesse, font: schrift, color: grau });
    seite.drawText(r, { x: width - rand - rBreite, y, size: groesse, font: schrift, color: grau });
  });
  return doc.save();
}
