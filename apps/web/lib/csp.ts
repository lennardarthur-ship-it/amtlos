/**
 * Content-Security-Policy mit Nonce je Anfrage (Sicherheit G-10). Next.js liest die Nonce aus dem CSP-Kopf der Anfrage
 * und setzt sie an seine eigenen Inline-Skripte; alle Seiten werden dynamisch gerendert (Sprache und Marke aus Cookie
 * bzw. Host), deshalb passt die Nonce immer. Styles: 'unsafe-inline' für style-Attribute und die Markenfarben.
 * Bilder: auch https (Logos von White-Label-Marken), data: und blob: (Vorschau hochgeladener Belege).
 */
export function csp(nonce: string, entwicklung = process.env.NODE_ENV !== "production"): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${entwicklung ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${entwicklung ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
