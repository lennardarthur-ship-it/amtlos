/** Protokolle als PDF (Unterweisungen). Eingebettete Schrift wie bei Rechnungen. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fontkit from "@cantoo/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";

const SCHRIFTEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schriften");
const datumDe = (d: string) => d.slice(0, 10).split("-").reverse().join(".");
const zeitDe = (iso: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(iso));

export interface UnterweisungsProtokoll {
  unternehmen: string;
  thema: string;
  inhalt: string;
  datum: string;
  durchgefuehrt_von: string;
  inhalt_sha256: string;
  teilnahmen: { name: string; bestaetigt_am: string; name_bestaetigt: string }[];
}

function umbrechen(text: string, font: PDFFont, groesse: number, breite: number): string[] {
  const zeilen: string[] = [];
  for (const absatz of text.split(/\r?\n/)) {
    let zeile = "";
    for (const wort of absatz.split(/\s+/)) {
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (font.widthOfTextAtSize(probe, groesse) <= breite) zeile = probe;
      else {
        if (zeile) zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

export async function unterweisungsprotokollPdf(p: UnterweisungsProtokoll): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const normal = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans.ttf")), { subset: true });
  const fett = await doc.embedFont(fs.readFileSync(path.join(SCHRIFTEN, "DejaVuSans-Bold.ttf")), { subset: true });
  doc.setTitle(`Unterweisung: ${p.thema}`);
  doc.setAuthor(p.unternehmen);
  doc.setProducer("Amtlos");
  let seite: PDFPage = doc.addPage([595.28, 841.89]);
  let y = 790;
  const text = (t: string, x: number, g = 10, f: PDFFont = normal) => seite.drawText(t, { x, y, size: g, font: f, color: rgb(0.1, 0.12, 0.15) });
  const zeile = (a = 14) => {
    y -= a;
    if (y < 70) {
      seite = doc.addPage([595.28, 841.89]);
      y = 790;
    }
  };
  text(p.unternehmen, 50, 9, fett);
  zeile(30);
  text("Unterweisungsprotokoll", 50, 16, fett);
  zeile(24);
  for (const [k, v] of [["Thema", p.thema], ["Datum", datumDe(p.datum)], ["Durchgeführt von", p.durchgefuehrt_von]]) {
    text(k!, 50);
    text(v!, 170);
    zeile();
  }
  zeile(10);
  text("Inhalt", 50, 11, fett);
  zeile(16);
  for (const z of umbrechen(p.inhalt, normal, 10, 495)) {
    text(z, 50);
    zeile();
  }
  zeile(10);
  text("Bestätigungen", 50, 11, fett);
  zeile(16);
  text("Name", 50, 9, fett); text("bestätigt als", 230, 9, fett); text("am", 420, 9, fett);
  zeile(14);
  for (const t of p.teilnahmen) {
    text(t.name, 50, 9); text(t.name_bestaetigt, 230, 9); text(zeitDe(t.bestaetigt_am), 420, 9);
    zeile();
  }
  if (!p.teilnahmen.length) {
    text("Keine Bestätigungen.", 50, 9);
    zeile();
  }
  zeile(16);
  for (const z of umbrechen(`Bestätigt wurde der Inhalt mit der Prüfsumme SHA-256 ${p.inhalt_sha256}. Die Bestätigung ist eine einfache elektronische Signatur (Name, Zeitpunkt, Inhalt).`, normal, 8, 495)) {
    text(z, 50, 8);
    zeile(11);
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
