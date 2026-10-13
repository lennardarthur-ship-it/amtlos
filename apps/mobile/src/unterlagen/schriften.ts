/**
 * Eingebettete Schriften der Dokumente (E-129): gleiche Schrift auf dem iPhone, im Web und im PDF – nicht die
 * Systemschrift, die nach „Computer“ aussieht. Die CSS-Regeln setzt die App vor dem Drucken und in der Vorschau ein.
 */
import { ausBase64 } from "./sicherung";
import { SCHNITTE } from "./schriftenDaten";

let css: string | null = null;

export function schriftCss(): string {
  css ??= SCHNITTE.map((s) => `@font-face{font-family:"${s.familie}";font-weight:${s.gewicht};font-style:${s.stil};src:url(data:font/ttf;base64,${s.daten}) format("truetype");}`).join("");
  return css;
}

/** Dokument-HTML mit eingebetteten Schriften. */
export function mitSchriften(html: string): string {
  return html.includes("amtlos-schriften") ? html : html.replace("<head>", `<head><style id="amtlos-schriften">${schriftCss()}</style>`);
}

/** Schriftdatei als Bytes (für pdf-lib). */
export function schriftBytes(familie: "Amtlos Sans" | "Amtlos Serif", gewicht = 400): Uint8Array {
  const s = SCHNITTE.find((x) => x.familie === familie && x.gewicht === gewicht && x.stil === "normal") ?? SCHNITTE[0]!;
  return ausBase64(s.daten);
}
