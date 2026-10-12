/**
 * HTML für die Vorschau in der App (E-124): dasselbe Dokument wie im PDF, auf A4-Breite gesetzt und mit Seitenrand,
 * damit es auf dem Bildschirm wie ein Blatt aussieht. Die Breite steuert, wie stark das Gerät verkleinert.
 */
export const BLATT_BREITE = 820;
export const BLATT_BREITE_QUER = 1160;

export function vorschauHtml(html: string, quer = false): string {
  const breite = quer ? BLATT_BREITE_QUER : BLATT_BREITE;
  const kopf = `<meta name="viewport" content="width=${breite}"><style>html{background:#ffffff}body{box-sizing:border-box;width:${breite}px;padding:56px 60px 64px;margin:0 auto}</style>`;
  return html.replace("<head>", `<head>${kopf}`);
}
