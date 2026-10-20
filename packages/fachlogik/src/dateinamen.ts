/**
 * Dateinamen mit unbedenklichen Zeichen (PDF einer Unterlage, Dateien im Steuerberater-Paket). Umlaute werden
 * umschrieben (ä → ae, ö → oe, ü → ue, ß → ss), andere Akzente auf den Grundbuchstaben zurückgeführt (é → e), damit
 * „Café“ nicht zu „Caf“ und „Söhne“ nicht zu „Sohne“ wird.
 */
import type { Daten, Vorlage } from "./dokumente/typen.js";

const UMSCHRIFT: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss", ẞ: "SS", æ: "ae", Æ: "Ae", œ: "oe", Œ: "Oe", ø: "o", Ø: "O", ł: "l", Ł: "L", đ: "d", Đ: "D", ð: "d", þ: "th" };

/** Umlaute und ß umschreiben, übrige diakritische Zeichen entfernen (é → e, ç → c). */
export function umschreiben(s: string): string {
  return s
    .replace(/[äöüÄÖÜßẞæÆœŒøØłŁđĐðþ]/g, (z) => UMSCHRIFT[z] ?? z)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Teil eines Dateinamens: umgeschrieben, alles außer Buchstaben, Ziffern und `erlaubt` wird zu „-“, höchstens `max`
 * Zeichen (an einem Trennzeichen gekürzt, wenn eines in der zweiten Hälfte liegt).
 */
export function dateinamenTeil(s: string, max = 80, erlaubt = "-"): string {
  const andere = new RegExp(`[^A-Za-z0-9${erlaubt.replace(/[\\\]^-]/g, "\\$&")}]+`, "g");
  const t = umschreiben(s).replace(andere, "-").replace(/^-+|-+$/g, "");
  if (t.length <= max) return t;
  const kurz = t.slice(0, max);
  const schnitt = kurz.lastIndexOf("-");
  return (schnitt > max / 2 ? kurz.slice(0, schnitt) : kurz).replace(/[-._]+$/, "");
}

/** Länge eines PDF-Namens ohne „.pdf“ */
const PDF_MAX = 80;

/**
 * Dateiname für das PDF einer Unterlage: Name (Titel und Namensfeld, wie `unterlagenName`) und Datum. Gekürzt wird nur der Name, nie das
 * Datum; steht das Datum schon im Namen (Namensfeld ist das Datum), kommt es nicht ein zweites Mal dazu.
 */
export function pdfDateiname(v: Vorlage, d: Daten, datum: string): string {
  const tag = dateinamenTeil(datum, 20);
  // Datum aus dem Namen nehmen (Namensfeld ist das Datum) – es steht genau einmal am Ende
  // wie unterlagenName (Titel und Namensfeld), aber ohne dessen Kürzung mitten im Wort – gekürzt wird unten am Trennzeichen
  const zusatz = v.namensFeld && typeof d[v.namensFeld] === "string" ? (d[v.namensFeld] as string).trim().split("\n")[0]! : "";
  // Titel der einzelnen Unterlage, z. B. „Stornorechnung“ oder „Gutschrift“ statt „Rechnung“
  const name = dateinamenTeil(`${v.titelFuer?.(d) ?? v.titel} ${zusatz}`, 400)
    .split(tag ? `-${tag}` : "\0")
    .join("");
  const teil = dateinamenTeil(name, tag ? PDF_MAX - tag.length - 1 : PDF_MAX) || "Unterlage";
  return `${tag ? `${teil}-${tag}` : teil}.pdf`;
}
