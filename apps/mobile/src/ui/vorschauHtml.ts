/**
 * HTML für die Vorschau in der App (E-124, E-129): dasselbe Dokument wie im PDF – mit denselben Schriften und Rändern
 * je Gestalt – als A4-Blatt. Die Geschäfts-Fußzeile, die im PDF die App aufstempelt, steht hier am Blattende.
 */
import { RAENDER, type Gestalt } from "@amtlos/fachlogik";
import { mitSchriften } from "../unterlagen/schriften";

/** A4 in CSS-Pixeln (96 dpi): 210 × 297 mm. */
export const BLATT_BREITE = 794;
export const BLATT_BREITE_QUER = 1123;

export function vorschauHtml(html: string, quer = false): string {
  const breite = quer ? BLATT_BREITE_QUER : BLATT_BREITE;
  const hoehe = quer ? 794 : 1123;
  const g = /<meta name="amtlos-gestalt" content="([^"]*)">/.exec(html)?.[1] ?? "nachweis";
  const [oben, rechts, unten, links] = RAENDER[(g in RAENDER ? g : "nachweis") as Gestalt];
  const zusatz = g === "brief" ? 5 : 0;
  const blatt = `<meta name="viewport" content="width=${breite}"><style>html{background:#ffffff}html body{box-sizing:border-box;width:${breite}px;min-height:${hoehe}px;margin:0 auto;padding:${oben}mm ${rechts}mm ${Math.max(8, unten - 18)}mm ${links + zusatz}mm;display:flex;flex-direction:column}html body > *{flex-shrink:0}html body .fussleiste{margin-top:auto}</style>`;
  return mitSchriften(html).replace("</head>", `${blatt}</head>`);
}
