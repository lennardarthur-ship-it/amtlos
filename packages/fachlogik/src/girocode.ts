/**
 * GiroCode (EPC-QR-Code, EPC069-12 Version 002) für Rechnungen (E-130): Banking-Apps lesen daraus Empfänger, IBAN,
 * Betrag und Verwendungszweck. Reine Funktion, Ausgabe als SVG. QR-Erzeugung: qrcode-generator (MIT).
 */
import qrcode from "qrcode-generator";

/** UTF-8-Bytes als Binärstring (ein Zeichen je Byte), damit die Bibliothek die Bytes unverändert übernimmt. */
function utf8Binaer(s: string): string {
  return unescape(encodeURIComponent(s));
}

export interface GiroCodeAngaben {
  name: string;
  iban: string;
  bic?: string | null;
  /** in Cent, 1 … 99 999 999 999 */
  betragCent: number;
  /** Verwendungszweck, höchstens 140 Zeichen */
  verwendungszweck: string;
}

/** Nutzdaten nach EPC069-12 (Zeichensatz 1 = UTF-8, Zeilen mit LF). Null, wenn IBAN oder Name fehlen. */
export function giroCodeDaten(a: GiroCodeAngaben): string | null {
  const iban = a.iban.replace(/\s/g, "").toUpperCase();
  const name = a.name.trim().slice(0, 70);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || !name) return null;
  const betrag = a.betragCent >= 1 && a.betragCent <= 99_999_999_999 ? `EUR${(a.betragCent / 100).toFixed(2)}` : "";
  const zweck = a.verwendungszweck.replace(/[\r\n]+/g, " ").trim().slice(0, 140);
  return ["BCD", "002", "1", "SCT", (a.bic ?? "").replace(/\s/g, "").toUpperCase(), name, iban, betrag, "", "", zweck].join("\n");
}

/** Ruhezone um den Code in Modulen (ISO/IEC 18004: mindestens 4), weiß im SVG selbst – unabhängig vom Hintergrund. */
export const RUHEZONE = 4;

/**
 * GiroCode als SVG mit `mm` Kantenlänge (samt Ruhezone), Fehlerkorrektur M wie von der EPC vorgegeben. Null, wenn
 * Angaben fehlen.
 */
export function giroCodeSvg(a: GiroCodeAngaben, mm = 30): string | null {
  const daten = giroCodeDaten(a);
  if (!daten) return null;
  const qr = qrcode(0, "M");
  qr.addData(utf8Binaer(daten), "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const pfad: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) pfad.push(`M${c} ${r}h1v1h-1z`);
  const r = RUHEZONE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-r} ${-r} ${n + 2 * r} ${n + 2 * r}" width="${mm}mm" height="${mm}mm" shape-rendering="crispEdges" role="img" aria-label="GiroCode"><rect x="${-r}" y="${-r}" width="${n + 2 * r}" height="${n + 2 * r}" fill="#fff"/><path d="${pfad.join("")}" fill="#000"/></svg>`;
}
