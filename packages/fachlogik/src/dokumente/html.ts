/** Bausteine für die HTML-Dokumente (A4, druckfertig). Alle Eingaben werden maskiert. */
import type { Betrieb, Daten, Eintrag } from "./typen.js";

/**
 * Hinweis zur fachlichen Abnahme (PRUEFLISTE T-52 ff.). Steht in der App vor dem Erstellen, nicht im Dokument: Die
 * Unterlage ist das Dokument des Betriebs und muss bei einer Prüfung vorzeigbar sein.
 */
export const PRUEFHINWEIS = "Die Vorlagen sind noch nicht von Fachleuten abgenommen. Prüfe die Inhalte, bevor du sie verwendest.";
/** Platzhalter für Text-Ausgaben (z. B. Website-Text); im Dokument stehen stattdessen Linien zum Ausfüllen. */
export const LEER = "(noch nicht angegeben)";
/** Leere Angabe im Dokument: eine Linie zum Ausfüllen von Hand. */
export const LINIE = '<span class="fuellen"></span>';

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
export function absatz(t: string, leer: string | null = ""): string {
  if (!t.trim()) return leer === null ? "" : leer ? `<p class="hinweis">${esc(leer)}</p>` : `<p class="fuellen-block">${LINIE}${LINIE}</p>`;
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
  return `<table class="angaben">${z.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v.trim() ? esc(v).replace(/\n/g, "<br>") : LINIE}</td></tr>`).join("")}</table>`;
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

/**
 * Gestaltung der Unterlagen (E-123): wie ein Dokument aus einer Kanzlei – Briefkopf des Betriebs, Dokumentkopf mit
 * Rechtsgrundlage und Stand, nummerierte Abschnitte, ruhige Tabellen, Linien zum Ausfüllen. Schrift: Charter (auf
 * iPhone vorhanden) für den Text, Helvetica Neue für Beschriftungen. Die Fußzeile mit Seitenzahlen setzt die App
 * nach dem Drucken ins PDF (Angaben aus den Meta-Tags „amtlos-fuss-*“).
 */
const SERIF = `Charter, "Bitstream Charter", "Iowan Old Style", Georgia, "DejaVu Serif", serif`;
const SANS = `"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif`;
const STIL = `
@page { size: A4; margin: 20mm 18mm 22mm 20mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${SERIF}; font-size: 10pt; line-height: 1.5; color: #1d2328; counter-reset: abschnitt; }
.briefkopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; padding-bottom: 3mm; border-bottom: 0.75pt solid #1d2328; font-family: ${SANS}; }
.briefkopf .name { font-size: 12pt; font-weight: 600; letter-spacing: 0.1pt; }
.briefkopf .adresse { font-size: 8pt; color: #59636c; margin-top: 0.8mm; }
.briefkopf .art { font-size: 8pt; color: #59636c; text-align: right; white-space: nowrap; }
h1 { font-family: ${SANS}; font-size: 20pt; line-height: 1.15; margin: 9mm 0 1.5mm; font-weight: 600; letter-spacing: -0.3pt; }
.unter { font-family: ${SANS}; font-size: 10.5pt; color: #3f4a53; margin: 0 0 6mm; }
.dokumentkopf { display: grid; grid-template-columns: repeat(auto-fit, minmax(42mm, 1fr)); gap: 0; margin: 0 0 7mm; border-top: 0.5pt solid #b9c0c6; border-bottom: 0.5pt solid #b9c0c6; font-family: ${SANS}; }
.dokumentkopf div { padding: 2mm 3mm 2mm 0; }
.dokumentkopf div + div { padding-left: 3mm; border-left: 0.5pt solid #dde1e4; }
.dokumentkopf dt { font-size: 6.8pt; color: #6b757e; text-transform: none; letter-spacing: 0.2pt; margin: 0 0 0.6mm; }
.dokumentkopf dd { font-size: 8.8pt; margin: 0; font-weight: 500; }
h2 { font-family: ${SANS}; font-size: 11pt; margin: 0 0 2.5mm; font-weight: 600; padding-bottom: 1.2mm; border-bottom: 0.5pt solid #dde1e4; }
section.abschnitt > h2::before { counter-increment: abschnitt; content: counter(abschnitt) "\\00a0\\00a0"; color: #6b757e; font-weight: 500; }
h3 { font-family: ${SANS}; font-size: 9.5pt; margin: 3.5mm 0 1mm; font-weight: 600; }
.abschnitt { margin-top: 7mm; }
p { margin: 0 0 2mm; }
ul.punkte { margin: 0 0 2mm; padding-left: 4.5mm; }
ul.punkte li { margin: 0 0 1mm; }
.hinweis { color: #59636c; font-style: italic; }
.klein { font-size: 8.5pt; color: #3f4a53; }
.fuellen { display: inline-block; min-width: 55mm; border-bottom: 0.5pt solid #8a949c; height: 4.2mm; vertical-align: bottom; }
.fuellen-block { margin: 0 0 2mm; }
.fuellen-block .fuellen { display: block; width: 100%; height: 7mm; }
table { border-collapse: collapse; width: 100%; }
table.angaben { font-size: 9.5pt; }
table.angaben th { text-align: left; font-family: ${SANS}; font-weight: 400; font-size: 8.5pt; color: #59636c; width: 36%; padding: 1.6mm 4mm 1.6mm 0; vertical-align: top; }
table.angaben td { padding: 1.4mm 0; vertical-align: top; }
table.angaben tr + tr th, table.angaben tr + tr td { border-top: 0.5pt solid #e6e9eb; }
table.liste { font-size: 8.8pt; margin-top: 1mm; }
table.liste th { text-align: left; font-family: ${SANS}; font-weight: 600; font-size: 7.8pt; color: #3f4a53; background: #f1f3f4; padding: 1.8mm 2mm; vertical-align: bottom; border-bottom: 0.75pt solid #1d2328; }
table.liste td { border-bottom: 0.5pt solid #d3d8dc; padding: 2mm; vertical-align: top; }
table.liste.hoch td { height: 10mm; }
td.zahl, th.zahl { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr, .eintrag, .unterschrift, .kasten { page-break-inside: avoid; break-inside: avoid; }
h2, h3 { page-break-after: avoid; break-after: avoid; }
thead { display: table-header-group; }
.eintrag { margin: 0 0 4mm; padding: 2.5mm 3mm; border: 0.5pt solid #dde1e4; border-radius: 1.2mm; }
.eintrag h3 { margin-top: 0; }
.kasten { border: 0.9pt solid #1d2328; margin-top: 3.5mm; }
.kasten h2 { background: #1d2328; color: #ffffff; padding: 1.6mm 3mm; margin: 0; font-size: 9.5pt; border: 0; }
.kasten .inhalt { padding: 2.5mm 3mm 1mm; }
.summen { width: 62%; margin-left: 38%; margin-top: 3mm; font-size: 9.5pt; }
.summen td { padding: 1.3mm 0; }
.summen td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.summen tr.gesamt td { border-top: 0.75pt solid #1d2328; font-weight: 700; padding-top: 2mm; }
.unterschriften { display: flex; gap: 12mm; margin-top: 16mm; font-family: ${SANS}; }
.unterschrift { flex: 1; font-size: 7.8pt; color: #59636c; }
.unterschrift .linie { border-bottom: 0.6pt solid #1d2328; height: 13mm; margin-bottom: 1.5mm; }
.empfaenger { font-family: ${SANS}; font-size: 9.5pt; line-height: 1.45; margin: 6mm 0 0; }
.empfaenger .absender { font-size: 6.8pt; color: #6b757e; text-decoration: underline; margin-bottom: 1.5mm; }
`;

/** Felder des Dokumentkopfs aus „Bezeichnung: Wert“-Zeilen. */
function kopfZeilen(meta: string | undefined): [string, string][] {
  return (meta ?? "")
    .split("\n")
    .map((z) => z.split(/:\s(.+)/))
    .filter((t) => t.length >= 2 && t[0]!.trim() && (t[1] ?? "").trim())
    .map((t) => [t[0]!.trim(), t[1]!.trim()]);
}

/** Markierung, an der dokumentHtml() die Rechtsgrundlage der Vorlage in den Dokumentkopf setzt. */
export const GRUNDLAGE_MARKE = "<!--amtlos-grundlage-->";

/** Ganzes Dokument: Briefkopf des Betriebs, Titel, Dokumentkopf, Inhalt. */
export function dokument(o: { titel: string; betrieb: Betrieb; unter?: string; meta?: string; inhalt: string; quer?: boolean; art?: string; vorTitel?: string }): string {
  const b = o.betrieb;
  const kontakt = [b.telefon, b.email].filter((x) => x.trim()).join(" · ");
  const adresse = [anschrift(b), kontakt].filter(Boolean).join(" · ");
  const seite = o.quer ? `<style>@page { size: A4 landscape; }</style>` : "";
  const kopf = kopfZeilen(o.meta);
  const stand = kopf.find(([k]) => /^(stand|datum|rechnungsdatum|prüfdatum|ausgestellt)/i.test(k))?.[1] ?? "";
  const fussLinks = [b.name.trim(), o.titel].filter(Boolean).join(" · ");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(o.titel)}</title><meta name="amtlos-fuss-links" content="${esc(fussLinks)}"><meta name="amtlos-fuss-rechts" content="${esc(stand ? `Stand ${stand}` : "")}"><style>${STIL}</style>${seite}</head><body>
<header class="briefkopf"><div><div class="name">${b.name.trim() ? esc(b.name.trim()) : LINIE}</div>${adresse ? `<div class="adresse">${esc(adresse)}</div>` : ""}</div><div class="art">${esc(o.art ?? "")}</div></header>
${o.vorTitel ?? ""}<h1>${esc(o.titel)}</h1>${o.unter ? `<p class="unter">${esc(o.unter)}</p>` : ""}
<dl class="dokumentkopf">${GRUNDLAGE_MARKE}${kopf.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
${o.inhalt}
</body></html>`;
}

/** Aufzählung als Liste. */
export const punkte = (l: string[]) => (l.length ? `<ul class="punkte">${l.map((x) => `<li>${esc(x).replace(/\n/g, "<br>")}</li>`).join("")}</ul>` : "");

// ---------------------------------------------------------------- Geld und Zahlen

/** „1.234,56“ / „1234.56“ / „12“ → Cent; leer oder unlesbar → null. */
export function cent(t: string | null | undefined): number | null {
  if (typeof t !== "string") return null;
  let s = t.replace(/\s|€/g, "");
  if (s === "") return null;
  if (/,\d{1,2}$/.test(s) || s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
/** Zahl wie „1,5“ → 1.5; leer oder unlesbar → null. */
export function zahl(t: string | null | undefined): number | null {
  const c = cent(t);
  return c === null ? null : c / 100;
}
export const euro = (c: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
export const zahlText = (n: number, stellen = 2) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: stellen }).format(n);
/** Summe eines Betragsfelds über Listeneinträge (Cent). */
export const summe = (l: Eintrag[], k: string) => l.reduce((a, e) => a + (cent(text(e, k)) ?? 0), 0);

/** Mehrzeiliger Text als Aufzählung (eine Zeile = ein Punkt); leer → Linien zum Ausfüllen. */
export function zeilen(t: string): string {
  const l = t.split("\n").map((z) => z.replace(/^[•\-–]\s*/, "").trim()).filter(Boolean);
  if (!l.length) return absatz("");
  return l.length === 1 ? `<p>${esc(l[0]!)}</p>` : punkte(l);
}
/** Zelleninhalt mit Zeilen als Aufzählung (für Tabellen). */
export function zellePunkte(t: string): string {
  const l = t.split("\n").map((z) => z.replace(/^[•\-–]\s*/, "").trim()).filter(Boolean);
  return l.length > 1 ? `<ul class="punkte">${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : esc(l[0] ?? "");
}
/** ISO-Datum plus Monate (für Folgetermine), als TT.MM.JJJJ. */
export function plusMonate(iso: string, monate: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + monate, Number(m[3])));
  return datumDe(d.toISOString().slice(0, 10));
}
