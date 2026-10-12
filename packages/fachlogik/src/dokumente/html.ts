/** Bausteine für die HTML-Dokumente (A4, druckfertig). Alle Eingaben werden maskiert. */
import type { Betrieb, Daten, Eintrag } from "./typen.js";

/** Steht auf jedem Dokument, bis die Vorlage fachlich freigegeben ist (PRUEFLISTE T-52). */
export const PRUEFHINWEIS = "Vorlage noch nicht fachlich geprüft. Bitte Inhalte vor Verwendung selbst prüfen.";
export const LEER = "– (noch nicht angegeben)";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ISO-Datum (YYYY-MM-DD) → TT.MM.JJJJ; leer bleibt leer. */
export const datumDe = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join(".") : "");

export function text(d: Daten | Eintrag, k: string): string {
  const w = d[k];
  return typeof w === "string" ? w.trim() : "";
}
export const ja = (d: Daten | Eintrag, k: string) => d[k] === true;
export function liste(d: Daten, k: string): Eintrag[] {
  const w = d[k];
  return Array.isArray(w) ? (w.filter((x) => x && typeof x === "object") as Eintrag[]) : [];
}
export function auswahl(d: Daten | Eintrag, k: string): string[] {
  const w = d[k];
  return Array.isArray(w) ? w.filter((x): x is string => typeof x === "string") : [];
}

/** Mehrzeiliger Text als Absätze; leer → Platzhalter (oder nichts, wenn `leer` null ist). */
export function absatz(t: string, leer: string | null = LEER): string {
  if (!t.trim()) return leer === null ? "" : `<p class="leer">${esc(leer)}</p>`;
  return t
    .trim()
    .split(/\n\s*\n/)
    .map((a) => `<p>${esc(a).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Zweispaltige Angaben (Bezeichnung – Wert). Zeilen mit `null` entfallen, leere Strings zeigen den Platzhalter. */
export function angaben(zeilen: [string, string | null][]): string {
  const z = zeilen.filter((x): x is [string, string] => x[1] !== null);
  if (!z.length) return "";
  return `<table class="angaben">${z.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v.trim() ? esc(v).replace(/\n/g, "<br>") : `<span class="leer">${esc(LEER)}</span>`}</td></tr>`).join("")}</table>`;
}

export function abschnitt(titel: string, inhalt: string, klasse = ""): string {
  return `<section class="abschnitt ${klasse}"><h2>${esc(titel)}</h2>${inhalt}</section>`;
}

/**
 * Tabelle. Zellen sind bereits maskiertes HTML (mit `zelle` erzeugen). `leerzeilen` hängt leere Zeilen zum
 * Ausfüllen von Hand an; `mindestens` füllt bis zu dieser Zeilenzahl auf.
 */
export function tabelle(kopf: string[], zeilen: string[][], o: { breiten?: string[]; leerzeilen?: number; mindestens?: number; hoch?: boolean } = {}): string {
  const leer = Math.max(o.leerzeilen ?? 0, (o.mindestens ?? 0) - zeilen.length);
  const alle = [...zeilen, ...Array.from({ length: leer }, () => kopf.map(() => "&nbsp;"))];
  const cols = o.breiten ? `<colgroup>${o.breiten.map((b) => `<col style="width:${b}">`).join("")}</colgroup>` : "";
  return `<table class="liste${o.hoch ? " hoch" : ""}">${cols}<thead><tr>${kopf.map((k) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${alle.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
export const zelle = (t: string) => esc(t).replace(/\n/g, "<br>");

/** Unterschriftsfelder nebeneinander. */
export function unterschriften(wer: string[]): string {
  return `<div class="unterschriften">${wer.map((w) => `<div class="unterschrift"><div class="linie"></div><span>${esc(w)}</span></div>`).join("")}</div>`;
}

export function anschrift(b: Betrieb): string {
  return [b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter((x) => x.trim()).join(", ");
}

const STIL = `
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.45; color: #1b2a3a; }
.kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; padding-bottom: 4mm; border-bottom: 1.2pt solid #136f5b; }
.betrieb { font-size: 9pt; line-height: 1.35; }
.betrieb strong { font-size: 10.5pt; }
.meta { font-size: 9pt; text-align: right; white-space: nowrap; color: #4a5868; }
h1 { font-size: 19pt; line-height: 1.2; margin: 7mm 0 1mm; font-weight: 700; letter-spacing: -0.2pt; }
.unter { color: #4a5868; margin: 0 0 5mm; }
h2 { font-size: 11.5pt; margin: 0 0 2mm; font-weight: 700; }
h3 { font-size: 10pt; margin: 3mm 0 1mm; font-weight: 700; }
.abschnitt { margin-top: 6mm; }
p { margin: 0 0 2mm; }
.leer { color: #8a96a3; font-style: italic; }
table { border-collapse: collapse; width: 100%; }
table.angaben th { text-align: left; font-weight: 400; color: #4a5868; width: 38%; padding: 1.2mm 4mm 1.2mm 0; vertical-align: top; }
table.angaben td { padding: 1.2mm 0; vertical-align: top; }
table.angaben tr + tr th, table.angaben tr + tr td { border-top: 0.5pt solid #e1e5df; }
table.liste { font-size: 9pt; margin-top: 1mm; }
table.liste th { text-align: left; font-weight: 700; border-bottom: 1pt solid #1b2a3a; padding: 1.5mm 2mm 1.5mm 0; vertical-align: bottom; }
table.liste td { border-bottom: 0.5pt solid #c9cfc6; padding: 1.8mm 2mm 1.8mm 0; vertical-align: top; }
table.liste.hoch td { height: 10mm; }
tr, .eintrag, .unterschrift, .kasten { page-break-inside: avoid; break-inside: avoid; }
thead { display: table-header-group; }
.eintrag { margin: 0 0 4mm; padding-left: 3mm; border-left: 1.5pt solid #c9cfc6; }
.eintrag h3 { margin-top: 0; }
.kasten { border: 1.2pt solid #1b2a3a; margin-top: 4mm; }
.kasten h2 { background: #1b2a3a; color: #ffffff; padding: 1.5mm 3mm; margin: 0; font-size: 10.5pt; }
.kasten .inhalt { padding: 2.5mm 3mm 1mm; }
.unterschriften { display: flex; gap: 10mm; margin-top: 14mm; }
.unterschrift { flex: 1; font-size: 8.5pt; color: #4a5868; }
.unterschrift .linie { border-bottom: 0.8pt solid #1b2a3a; height: 12mm; margin-bottom: 1.5mm; }
.marken { margin: 0; padding: 0; list-style: none; }
.pruef { margin-top: 10mm; padding-top: 2.5mm; border-top: 0.5pt solid #c9cfc6; font-size: 7.5pt; color: #6b7785; }
`;

/** Ganzes Dokument: Kopf mit Betrieb, Titel, Inhalt, Prüfhinweis am Ende. */
export function dokument(o: { titel: string; betrieb: Betrieb; unter?: string; meta?: string; inhalt: string; quer?: boolean }): string {
  const b = o.betrieb;
  const kontakt = [b.telefon, b.email].filter((x) => x.trim()).join(" · ");
  const seite = o.quer ? `<style>@page { size: A4 landscape; }</style>` : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(o.titel)}</title><style>${STIL}</style>${seite}</head><body>
<header class="kopf"><div class="betrieb"><strong>${esc(b.name.trim() || "Betrieb (noch nicht angegeben)")}</strong>${anschrift(b) ? `<br>${esc(anschrift(b))}` : ""}${kontakt ? `<br>${esc(kontakt)}` : ""}</div>${o.meta ? `<div class="meta">${esc(o.meta).replace(/\n/g, "<br>")}</div>` : ""}</header>
<h1>${esc(o.titel)}</h1>${o.unter ? `<p class="unter">${esc(o.unter)}</p>` : ""}
${o.inhalt}
<footer class="pruef">${esc(PRUEFHINWEIS)} Erstellt mit Amtlos.</footer>
</body></html>`;
}
