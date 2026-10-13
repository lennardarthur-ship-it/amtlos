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
export function tabelle(kopf: string[], zeilen: string[][], o: { breiten?: string[]; leerzeilen?: number; mindestens?: number; hoch?: boolean; zahlen?: number[] } = {}): string {
  const leer = Math.max(o.leerzeilen ?? 0, (o.mindestens ?? 0) - zeilen.length);
  const alle = [...zeilen, ...Array.from({ length: leer }, () => kopf.map(() => "&nbsp;"))];
  const cols = o.breiten ? `<colgroup>${o.breiten.map((b) => `<col style="width:${b}">`).join("")}</colgroup>` : "";
  // Spalten mit Zahlen rechtsbündig mit gleich breiten Ziffern
  const z = (i: number) => (o.zahlen?.includes(i) ? ' class="zahl"' : "");
  return `<table class="liste${o.hoch ? " hoch" : ""}">${cols}<thead><tr>${kopf.map((k, i) => `<th${z(i)}>${esc(k)}</th>`).join("")}</tr></thead><tbody>${alle.map((r) => `<tr>${r.map((c, i) => `<td${z(i)}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
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
 * Gestaltung der Unterlagen (E-123, neu in E-129). Jede Vorlage hat eine Gestalt, die zu ihrem Zweck passt:
 * - brief:    Kundendokument nach DIN 5008 Form B – Briefkopf mit Logo, Anschriftfeld fürs Fensterkuvert,
 *             Informationsblock, Betreff, Fußzeile mit Anschrift, Kontakt, Bank, Steuer und Register (setzt die App).
 * - vertrag:  Vertrag bzw. Nachweis mit Unterschrift – Parteien, Paragrafen, Serifenschrift im Blocksatz.
 * - aushang:  zum Aufhängen (Hygiene-, Hautschutzplan, Allergene) – Querformat, Farbband, große Schrift.
 * - nachweis: Nachweise und Protokolle für Prüfungen – Dokumentkopf mit Stand und Rechtsgrundlage, Abschnitte.
 * - formular: Zusammenstellung zum Übertragen in ein Behördenformular – Felder wie im Formular.
 * - handbuch: längere Beschreibungen (Verfahrensdokumentation, Datenschutz) – Lesetext in Serifenschrift.
 * Schriften: „Amtlos Sans“ und „Amtlos Serif“ (Source Sans 3 / Source Serif 4, eingebettet von der App), sonst
 * Systemschriften. Hausfarbe und Logo kommen aus „Mein Betrieb“.
 */
export type Gestalt = "brief" | "vertrag" | "aushang" | "nachweis" | "formular" | "handbuch";

/** Hausfarben zur Auswahl: dunkel genug für weiße Schrift und für Schwarz-Weiß-Druck (Kontrast ≥ 7:1 zu Weiß). */
export const HAUSFARBEN: { wert: string; text: string }[] = [
  { wert: "#2f3a45", text: "Graphit" },
  { wert: "#1f3a5f", text: "Marineblau" },
  { wert: "#0f5560", text: "Petrol" },
  { wert: "#2c5a3c", text: "Tannengrün" },
  { wert: "#702434", text: "Bordeaux" },
  { wert: "#7d3b1f", text: "Rostbraun" },
  { wert: "#4a2f5c", text: "Aubergine" },
  { wert: "#5e4a12", text: "Oliv" },
];

/** Hausfarbe aus „Mein Betrieb“ (nur #rrggbb), sonst Graphit. */
export function akzent(b: Betrieb): string {
  const f = (b.farbe ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(f) ? f.toLowerCase() : HAUSFARBEN[0]!.wert;
}

/** Farbe mit Weiß gemischt (Anteil der Farbe 0..1) – für Flächen in der Hausfarbe. */
export function hauch(hex: string, anteil: number): string {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const m = (c: number) => Math.round(255 - (255 - c) * anteil).toString(16).padStart(2, "0");
  return `#${m(n(1))}${m(n(3))}${m(n(5))}`;
}

/** Ränder je Gestalt in mm (oben, rechts, unten, links) – die App druckt damit; unten Platz für die Fußzeile. */
export const RAENDER: Record<Gestalt, [number, number, number, number]> = {
  brief: [12, 20, 30, 20],
  vertrag: [16, 20, 22, 22],
  aushang: [12, 14, 16, 14],
  nachweis: [16, 18, 20, 20],
  formular: [16, 18, 20, 20],
  handbuch: [18, 22, 22, 24],
};

const SANS = `"Amtlos Sans", "Source Sans 3", "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif`;
const SERIF = `"Amtlos Serif", "Source Serif 4", Charter, "Iowan Old Style", Georgia, "DejaVu Serif", serif`;

const STIL = `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${SANS}; font-size: 9.6pt; line-height: 1.45; color: #1b2026; counter-reset: abschnitt; font-variant-numeric: lining-nums; -webkit-font-smoothing: antialiased; font-kerning: normal; hyphens: auto; -webkit-hyphens: auto; }
strong, b { font-weight: 600; }

/* Briefkopf (alle außer Brief und Aushang): Name und Anschrift links, Bereich und Logo rechts, Linie in der Hausfarbe */
.briefkopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; padding-bottom: 2.6mm; border-bottom: 1.2pt solid var(--akzent); }
.briefkopf .name { font-size: 11.5pt; font-weight: 600; color: var(--akzent); letter-spacing: 0.05pt; }
.briefkopf .adresse { font-size: 7.6pt; color: #5b6570; margin-top: 0.6mm; }
.briefkopf .rechts { display: flex; align-items: flex-end; gap: 4mm; }
.briefkopf .art { font-size: 7.6pt; color: #5b6570; text-align: right; white-space: nowrap; }
.briefkopf .logo { max-height: 11mm; max-width: 38mm; display: block; }

h1 { font-size: 21pt; line-height: 1.12; margin: 8mm 0 1.2mm; font-weight: 600; letter-spacing: -0.2pt; color: #12161b; }
.unter { font-size: 10.5pt; color: #46505a; margin: 0 0 5mm; }
.dokumentkopf { display: grid; grid-template-columns: repeat(auto-fit, minmax(38mm, 1fr)); margin: 0 0 7mm; padding: 2.2mm 0 2.2mm 3.2mm; border-left: 2pt solid var(--akzent); background: var(--akzent-hauch); }
.dokumentkopf div { padding: 0.6mm 3mm 0.6mm 0; }
.dokumentkopf dt { font-size: 6.9pt; color: #5b6570; margin: 0 0 0.3mm; letter-spacing: 0.15pt; }
.dokumentkopf dd { font-size: 8.8pt; margin: 0; font-weight: 600; color: #1b2026; }
.dokumentkopf:empty { display: none; }
h2 { font-size: 11.5pt; margin: 0 0 2.4mm; font-weight: 600; color: #12161b; padding-bottom: 1.1mm; border-bottom: 0.5pt solid #d5dade; }
section.abschnitt.ohne-nummer > h2::before { content: none; }
section.abschnitt > h2::before { counter-increment: abschnitt; content: counter(abschnitt); display: inline-block; min-width: 6mm; color: var(--akzent); font-weight: 700; }
h3 { font-size: 9.8pt; margin: 3.4mm 0 1mm; font-weight: 600; }
.abschnitt { margin-top: 6.5mm; }
p { margin: 0 0 1.9mm; orphans: 2; widows: 2; }
ul.punkte { margin: 0 0 2mm; padding-left: 4.2mm; }
ul.punkte li { margin: 0 0 0.9mm; }
ul.punkte li::marker { color: var(--akzent); }
.hinweis { color: #5b6570; font-style: italic; }
.klein { font-size: 8.3pt; color: #46505a; }
.fuellen { display: inline-block; min-width: 55mm; border-bottom: 0.5pt solid #8a949c; height: 4.2mm; vertical-align: bottom; }
.fuellen-block { margin: 0 0 2mm; }
.fuellen-block .fuellen { display: block; width: 100%; height: 7mm; }
table { border-collapse: collapse; width: 100%; }
table.angaben { font-size: 9.4pt; }
table.angaben th { text-align: left; font-weight: 400; font-size: 8.3pt; color: #5b6570; width: 34%; padding: 1.5mm 4mm 1.5mm 0; vertical-align: top; }
table.angaben td { padding: 1.3mm 0; vertical-align: top; }
table.angaben tr + tr th, table.angaben tr + tr td { border-top: 0.5pt solid #e7eaed; }
table.liste { font-size: 8.7pt; margin-top: 1mm; }
table.liste th { text-align: left; font-weight: 600; font-size: 7.6pt; color: #46505a; padding: 1.6mm 2mm 1.4mm; vertical-align: bottom; border-bottom: 1pt solid var(--akzent); }
table.liste td { border-bottom: 0.5pt solid #dde1e5; padding: 1.9mm 2mm; vertical-align: top; }
table.liste.hoch td { height: 10mm; }
td.zahl, th.zahl, table.liste th.zahl { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr, .eintrag, .unterschrift, .kasten, .summen { page-break-inside: avoid; break-inside: avoid; }
h2, h3 { page-break-after: avoid; break-after: avoid; }
thead { display: table-header-group; }
.eintrag { margin: 0 0 3.5mm; padding: 2.4mm 3mm; border: 0.5pt solid #dde1e5; border-left: 1.6pt solid var(--akzent); }
.eintrag h3 { margin-top: 0; }
.kasten { border: 1pt solid var(--akzent); margin-top: 3.2mm; }
.kasten h2 { background: var(--akzent); color: #ffffff; padding: 1.5mm 3mm; margin: 0; font-size: 9.6pt; border: 0; }
.kasten .inhalt { padding: 2.4mm 3mm 1mm; }
.summen { width: 58%; margin-left: 42%; margin-top: 3mm; font-size: 9.6pt; }
.summen td { padding: 1.2mm 0; }
.summen td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.summen tr.gesamt td { border-top: 1pt solid var(--akzent); font-weight: 700; font-size: 11pt; padding-top: 2mm; }
.unterschriften { display: flex; gap: 12mm; margin-top: 15mm; }
.unterschrift { flex: 1; font-size: 7.8pt; color: #5b6570; }
.unterschrift .linie { border-bottom: 0.6pt solid #1b2026; height: 13mm; margin-bottom: 1.4mm; }
.empfaenger { font-size: 9.6pt; line-height: 1.45; margin: 6mm 0 0; }
.empfaenger .absender { font-size: 6.8pt; color: #6b757e; text-decoration: underline; margin-bottom: 1.5mm; }

/* Fußzeile: im PDF setzt sie die App auf jede Seite; auf dem Bildschirm (Vorschau) steht sie am Blattende */
.fussleiste { display: none; }
@media screen { .g-brief .fussleiste { display: flex; } }
body.g-brief.fuss-im-fluss .fussleiste { display: flex; }
.fussleiste { gap: 5mm; margin-top: 12mm; padding-top: 2mm; border-top: 0.5pt solid #c9cfd4; font-size: 6.9pt; line-height: 1.4; color: #5b6570; }
.fussleiste div { flex: 1; }
.fussleiste b { color: #1b2026; font-weight: 600; }

/* ---------------- Brief (DIN 5008 Form B) */
body.g-brief { padding-left: 5mm; }
.g-brief .kopf { position: relative; height: 33mm; }
.g-brief .kopf .marke { position: absolute; left: 0; top: 4mm; }
.g-brief .kopf .marke .name { font-size: 17pt; line-height: 1.05; font-weight: 600; color: var(--akzent); letter-spacing: -0.15pt; }
.g-brief .kopf .marke .zusatz { font-size: 8pt; color: #5b6570; margin-top: 1.2mm; }
.g-brief .kopf .logo { position: absolute; right: 0; top: 3mm; max-height: 22mm; max-width: 60mm; }
.g-brief .fenster { position: relative; height: 45mm; }
.g-brief .anschrift { position: absolute; left: -5mm; top: 0; width: 85mm; height: 45mm; padding-left: 5mm; }
.g-brief .anschrift .ruecksendung { height: 5mm; padding-top: 1.4mm; font-size: 6.6pt; color: #5b6570; white-space: nowrap; overflow: hidden; }
.g-brief .anschrift .vermerk { height: 12.7mm; font-size: 7.6pt; color: #46505a; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 1mm; }
.g-brief .anschrift .empf { font-size: 10pt; line-height: 1.32; }
.g-brief .info { position: absolute; left: 100mm; top: 5mm; width: 75mm; font-size: 8.2pt; }
.g-brief .info table td { padding: 0.45mm 0; vertical-align: top; }
.g-brief .info table td:first-child { color: #5b6570; width: 31mm; padding-right: 2mm; }
.g-brief .info table td:last-child { font-variant-numeric: tabular-nums; }
.g-brief .betreff { margin: 8.5mm 0 6mm; font-size: 12.5pt; font-weight: 700; color: #12161b; }
.g-brief .betreff span { display: block; font-size: 9pt; font-weight: 400; color: #5b6570; margin-top: 0.8mm; }
.g-brief table.liste th { border-bottom-width: 1.2pt; }
.g-brief .zahlung { margin-top: 7mm; padding: 3mm 3.5mm; background: var(--akzent-hauch); border-left: 2pt solid var(--akzent); }
.g-brief .zahlung p:last-child { margin: 0; }
.g-brief .gruss { margin-top: 6mm; }

/* ---------------- Vertrag */
.g-vertrag { font-family: ${SERIF}; font-size: 10pt; line-height: 1.55; }
.g-vertrag p, .g-vertrag li { text-align: justify; }
.g-vertrag h1, .g-vertrag h2, .g-vertrag h3, .g-vertrag .briefkopf, .g-vertrag .dokumentkopf, .g-vertrag table.liste th, .g-vertrag .unterschrift, .g-vertrag table.angaben th, .g-vertrag .unter { font-family: ${SANS}; }
.g-vertrag h1 { text-align: center; margin-top: 10mm; font-size: 19pt; }
.g-vertrag .unter { text-align: center; }
.g-vertrag .dokumentkopf { border-left: 0; background: none; border-top: 0.5pt solid #d5dade; border-bottom: 0.5pt solid #d5dade; padding-left: 0; }
.g-vertrag section.abschnitt > h2 { border-bottom: 0; font-size: 10.5pt; margin-bottom: 1.2mm; }
.g-vertrag section.abschnitt:not(.ohne-nummer) > h2::before { content: "§ " counter(abschnitt); min-width: 11mm; }

/* ---------------- Aushang */
.g-aushang { font-size: 10.4pt; }
.g-aushang .briefkopf { background: var(--akzent); color: #ffffff; padding: 4mm 5mm; border: 0; align-items: center; }
.g-aushang .briefkopf .name, .g-aushang .briefkopf .adresse, .g-aushang .briefkopf .art { color: #ffffff; }
.g-aushang .briefkopf .logo { background: #ffffff; padding: 1.2mm 2mm; border-radius: 1mm; max-height: 13mm; }
.g-aushang h1 { font-size: 28pt; margin-top: 6mm; }
.g-aushang table.liste { font-size: 10pt; }
.g-aushang table.liste th { font-size: 8.6pt; background: var(--akzent-hauch); color: #1b2026; }
.g-aushang table.liste td { padding: 2.6mm 2.4mm; }
.g-aushang .dokumentkopf { margin-bottom: 5mm; }

/* ---------------- Formular (Zusammenstellung für ein Behördenformular) */
.g-formular table.angaben th { width: 40%; }
.g-formular table.angaben td { padding: 1mm 0; }
.g-formular table.angaben td:not(:empty) { font-weight: 600; }
.g-formular table.angaben tr + tr th, .g-formular table.angaben tr + tr td { border-top: 0.5pt dotted #c9cfd4; }
.g-formular h2 { background: var(--akzent-hauch); padding: 1.4mm 2.4mm; border: 0; font-size: 10.5pt; }

/* ---------------- Handbuch */
.g-handbuch { font-family: ${SERIF}; font-size: 10pt; line-height: 1.6; }
.g-handbuch h1, .g-handbuch h2, .g-handbuch h3, .g-handbuch .briefkopf, .g-handbuch .dokumentkopf, .g-handbuch table, .g-handbuch .unterschrift, .g-handbuch .unter { font-family: ${SANS}; }
.g-handbuch h1 { font-size: 24pt; margin-top: 12mm; }
.g-handbuch .abschnitt { margin-top: 8mm; }
.g-handbuch h2 { font-size: 12.5pt; }
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
/** Platzhalter für die Gestalt der Vorlage – dokumentHtml() setzt sie ein (ohne Vorlage: „nachweis“). */
export const GESTALT_MARKE = "amtlos-gestalt-offen";

/** Spalten der Geschäfts-Fußzeile aus „Mein Betrieb“ (leere entfallen). Zeilen mit **…** werden fett. */
export function fussSpalten(b: Betrieb): string[][] {
  const t = (x: string | undefined) => (x ?? "").trim();
  const spalten = [
    [t(b.name) ? `**${t(b.name)}**` : "", t(b.strasse), [t(b.plz), t(b.ort)].filter(Boolean).join(" "), t(b.verantwortlich) && !t(b.vertretung) ? `Inhaber/in: ${t(b.verantwortlich)}` : ""],
    [t(b.telefon) ? `Tel. ${t(b.telefon)}` : "", t(b.email), t(b.website)],
    [t(b.bank) ? `**${t(b.bank)}**` : t(b.iban) ? "**Bankverbindung**" : "", t(b.iban) ? `IBAN ${t(b.iban)}` : "", t(b.bic) ? `BIC ${t(b.bic)}` : ""],
    [
      t(b.steuernummer) ? `Steuernr. ${t(b.steuernummer)}` : "",
      t(b.ust_idnr) ? `USt-IdNr. ${t(b.ust_idnr)}` : "",
      // Gesellschaften: Sitz, Registergericht und -nummer, Geschäftsführung (§ 35a GmbHG, § 37a HGB)
      t(b.rechtsform) && t(b.registergericht) ? `Sitz ${t(b.ort)} · ${[t(b.registergericht), t(b.registernummer)].filter(Boolean).join(" ")}` : [t(b.registergericht), t(b.registernummer)].filter(Boolean).join(" "),
      t(b.vertretung) ? `Geschäftsführung: ${t(b.vertretung)}` : "",
    ],
  ];
  return spalten.map((s) => s.filter(Boolean)).filter((s) => s.length);
}

function fussHtml(b: Betrieb): string {
  const sp = fussSpalten(b);
  if (!sp.length) return "";
  const zeile = (z: string) => (z.startsWith("**") ? `<b>${esc(z.slice(2, -2))}</b>` : esc(z));
  return `<footer class="fussleiste">${sp.map((s) => `<div>${s.map(zeile).join("<br>")}</div>`).join("")}</footer>`;
}

const logoHtml = (b: Betrieb, klasse = "logo") => (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(b.logo ?? "") ? `<img class="${klasse}" src="${b.logo}" alt="">` : "");

/** Seitengröße und Ränder je Gestalt für den Druck (dieselben Werte übergibt die App an den Drucker). */
export function seiteCss(g: Gestalt, quer = false): string {
  const [o, r, u, l] = RAENDER[g];
  return `@page { size: A4${quer ? " landscape" : ""}; margin: ${o}mm ${r}mm ${u}mm ${l}mm; }`;
}
/** Platzhalter für die Seitenränder, solange die Gestalt offen ist (setzt dokumentHtml()). */
export const SEITE_MARKE = "/*amtlos-seite*/";

/** Kopf des HTML-Dokuments: Meta-Angaben für die App (Fußzeile, Ränder, Gestalt) und Stil. */
function kopf(o: { titel: string; betrieb: Betrieb; fussLinks: string; fussRechts: string; quer?: boolean; gestalt?: Gestalt }): string {
  const b = o.betrieb;
  const farbe = akzent(b);
  const seite = `<style>${o.gestalt ? seiteCss(o.gestalt, o.quer) : o.quer ? `${SEITE_MARKE}@page { size: A4 landscape; }` : SEITE_MARKE}</style>`;
  const g = o.gestalt ?? GESTALT_MARKE;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(o.titel)}</title><meta name="amtlos-gestalt" content="${g}"><meta name="amtlos-fuss-links" content="${esc(o.fussLinks)}"><meta name="amtlos-fuss-rechts" content="${esc(o.fussRechts)}"><meta name="amtlos-fuss-spalten" content="${esc(JSON.stringify(fussSpalten(b)))}"><meta name="amtlos-farbe" content="${farbe}"><style>:root{--akzent:${farbe};--akzent-hauch:${hauch(farbe, 0.08)};}${STIL}</style>${seite}</head>`;
}

/** Ganzes Dokument: Briefkopf des Betriebs, Titel, Dokumentkopf, Inhalt. Die Gestalt setzt dokumentHtml(). */
export function dokument(o: { titel: string; betrieb: Betrieb; unter?: string; meta?: string; inhalt: string; quer?: boolean; art?: string; vorTitel?: string; gestalt?: Gestalt }): string {
  const b = o.betrieb;
  const kontakt = [b.telefon, b.email].filter((x) => x.trim()).join(" · ");
  const adresse = [anschrift(b), kontakt].filter(Boolean).join(" · ");
  const kopfDaten = kopfZeilen(o.meta);
  const stand = kopfDaten.find(([k]) => /^(stand|datum|rechnungsdatum|prüfdatum|ausgestellt)/i.test(k))?.[1] ?? "";
  const fussLinks = [b.name.trim(), o.titel].filter(Boolean).join(" · ");
  const g = o.gestalt ?? GESTALT_MARKE;
  return `${kopf({ titel: o.titel, betrieb: b, fussLinks, fussRechts: stand ? `Stand ${stand}` : "", quer: o.quer, gestalt: o.gestalt })}<body class="g-${g}">
<header class="briefkopf"><div><div class="name">${b.name.trim() ? esc(b.name.trim()) : LINIE}</div>${adresse ? `<div class="adresse">${esc(adresse)}</div>` : ""}</div><div class="rechts"><div class="art">${esc(o.art ?? "")}</div>${logoHtml(b)}</div></header>
${o.vorTitel ?? ""}<h1>${esc(o.titel)}</h1>${o.unter ? `<p class="unter">${esc(o.unter)}</p>` : ""}
<dl class="dokumentkopf">${GRUNDLAGE_MARKE}${kopfDaten.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
${o.inhalt}
${fussHtml(b)}
</body></html>`;
}

/**
 * Geschäftsbrief nach DIN 5008 Form B (E-129): Briefkopf (Logo bzw. Name in der Hausfarbe), Rücksendeangabe und
 * Anschrift im Fenster (45 mm von oben, 20 mm von links, 85 × 45 mm), Informationsblock rechts daneben, Betreff,
 * Inhalt. Die Fußzeile mit Anschrift, Kontakt, Bank, Steuer und Register setzt die App auf jede Seite.
 */
export function brief(o: { titel: string; betreff: string; unterBetreff?: string; betrieb: Betrieb; empfaenger: { name: string; anschrift: string; zusatz?: string }; info: [string, string][]; inhalt: string; vermerk?: string; stand?: string }): string {
  const b = o.betrieb;
  const logo = logoHtml(b);
  const zusatz = [anschrift(b)].filter(Boolean).join("");
  const ruecksendung = [b.name.trim(), b.strasse.trim(), [b.plz.trim(), b.ort.trim()].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const empf = `${o.empfaenger.name.trim() ? `${esc(o.empfaenger.name.trim())}<br>` : LINIE}${o.empfaenger.anschrift.trim() ? esc(o.empfaenger.anschrift.trim()).replace(/\n/g, "<br>") : LINIE}${o.empfaenger.zusatz ? `<br><span style="font-size:8pt;color:#5b6570">${esc(o.empfaenger.zusatz)}</span>` : ""}`;
  const info = o.info.filter(([, w]) => w.trim());
  return `${kopf({ titel: o.titel, betrieb: b, fussLinks: [b.name.trim(), o.titel].filter(Boolean).join(" · "), fussRechts: o.stand ? `Stand ${o.stand}` : "", gestalt: "brief" })}<body class="g-brief">
<header class="kopf">${logo}<div class="marke"${logo ? ' style="right:65mm"' : ""}><div class="name">${b.name.trim() ? esc(b.name.trim()) : LINIE}</div>${zusatz ? `<div class="zusatz">${esc(zusatz)}</div>` : ""}</div></header>
<div class="fenster"><div class="anschrift"><div class="ruecksendung">${esc(ruecksendung)}</div><div class="vermerk">${o.vermerk ? esc(o.vermerk) : ""}</div><div class="empf">${empf}</div></div>
<div class="info"><table>${info.map(([k, w]) => `<tr><td>${esc(k)}</td><td>${esc(w)}</td></tr>`).join("")}</table></div></div>
<h1 class="betreff">${esc(o.betreff)}${o.unterBetreff ? `<span>${esc(o.unterBetreff)}</span>` : ""}</h1>
${o.inhalt}
${fussHtml(b)}
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
