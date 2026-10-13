/**
 * Bausteine für die HTML-Dokumente (A4, druckfertig). Alle Eingaben werden maskiert.
 *
 * Gestaltung (E-130, docs/10-dokumente-gestaltung.md): Jede Vorlage hat eine Gestalt, die zu Leser und Zweck passt –
 * Brief (DIN 5008), Vertrag, Aushang, Nachweis, Formular, Handbuch. Das eine prägende Element ist die Randspalte:
 * Abschnittsnummer und Rechtsgrundlage stehen links neben dem Text wie Randnummern in einem Gesetzeskommentar.
 */
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

// ---------------------------------------------------------------- Textbausteine

/** Mehrzeiliger Text als Absätze; leer → Platzhalter (oder nichts, wenn `leer` null ist). */
export function absatz(t: string, leer: string | null = ""): string {
  if (!t.trim()) return leer === null ? "" : leer ? `<p class="hinweis">${esc(leer)}</p>` : `<p class="fuellen-block">${LINIE}${LINIE}</p>`;
  return t
    .trim()
    .split(/\n\s*\n/)
    .map((a) => `<p>${esc(a).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Aufzählung als Liste. */
export const punkte = (l: string[]) => (l.length ? `<ul class="punkte">${l.map((x) => `<li>${esc(x).replace(/\n/g, "<br>")}</li>`).join("")}</ul>` : "");

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

/** Zweispaltige Angaben (Bezeichnung – Wert). Zeilen mit `null` entfallen, leere Strings zeigen die Linie. */
export function angaben(zeilen: [string, string | null][]): string {
  const z = zeilen.filter((x): x is [string, string] => x[1] !== null);
  if (!z.length) return "";
  return `<table class="angaben">${z.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v.trim() ? esc(v).replace(/\n/g, "<br>") : LINIE}</td></tr>`).join("")}</table>`;
}

export interface AbschnittOptionen {
  /** zusätzliche Klasse */
  klasse?: string;
  /** Rechtsgrundlage o. Ä. in der Randspalte unter der Nummer, z. B. „§ 10 MuSchG“ */
  rand?: string;
  /** ohne laufende Nummer */
  ohneNummer?: boolean;
}

/** Abschnitt mit Überschrift; in Nachweis, Vertrag und Handbuch stehen Nummer und `rand` in der Randspalte. */
export function abschnitt(titel: string, inhalt: string, o: string | AbschnittOptionen = ""): string {
  const opt: AbschnittOptionen = typeof o === "string" ? { klasse: o, ohneNummer: o.includes("ohne-nummer") } : o;
  const klassen = ["abschnitt", opt.klasse ?? "", opt.ohneNummer ? "ohne-nummer" : ""].filter(Boolean).join(" ");
  const rand = opt.rand ? `<span class="rand">${esc(opt.rand)}</span>` : "";
  return `<section class="${klassen}"><h2>${rand}${esc(titel)}</h2>${inhalt}</section>`;
}

/** Einzelner Eintrag innerhalb eines Abschnitts (z. B. eine Verarbeitungstätigkeit): Nummer in der Randspalte. */
export function eintrag(titel: string, inhalt: string, o: { nummer?: string; rand?: string } = {}): string {
  const nr = o.nummer ? `<span class="nr">${esc(o.nummer)}</span>` : "";
  const rand = o.rand ? `<span class="rand">${esc(o.rand)}</span>` : "";
  return `<div class="eintrag"><h3>${nr}${rand}${esc(titel)}</h3>${inhalt}</div>`;
}

/**
 * Tabelle. Zellen sind bereits maskiertes HTML (mit `zelle` erzeugen). `leerzeilen` hängt leere Zeilen zum
 * Ausfüllen von Hand an; `mindestens` füllt bis zu dieser Zeilenzahl auf; `zahlen` nennt rechtsbündige Spalten;
 * `summe` ist eine abgesetzte Schlusszeile.
 */
export function tabelle(kopf: string[], zeilen: string[][], o: { breiten?: string[]; leerzeilen?: number; mindestens?: number; hoch?: boolean; zahlen?: number[]; summe?: string[]; klasse?: string } = {}): string {
  const leer = Math.max(o.leerzeilen ?? 0, (o.mindestens ?? 0) - zeilen.length);
  const alle = [...zeilen, ...Array.from({ length: leer }, () => kopf.map(() => "&nbsp;"))];
  const cols = o.breiten ? `<colgroup>${o.breiten.map((b) => `<col style="width:${b}">`).join("")}</colgroup>` : "";
  const z = (i: number) => (o.zahlen?.includes(i) ? ' class="zahl"' : "");
  const fuss = o.summe ? `<tfoot><tr class="summe">${o.summe.map((c, i) => `<td${z(i)}>${c}</td>`).join("")}</tr></tfoot>` : "";
  return `<table class="liste${o.hoch ? " hoch" : ""}${o.klasse ? ` ${o.klasse}` : ""}">${cols}<thead><tr>${kopf.map((k, i) => `<th${z(i)}>${esc(k)}</th>`).join("")}</tr></thead><tbody>${alle.map((r) => `<tr>${r.map((c, i) => `<td${z(i)}>${c}</td>`).join("")}</tr>`).join("")}</tbody>${fuss}</table>`;
}
export const zelle = (t: string) => esc(t).replace(/\n/g, "<br>");

/**
 * Unterschriften nebeneinander. Mit `ortDatum` bekommt jeder Block zusätzlich eine Zeile für Ort und Datum (Verträge,
 * Nachweise); ohne steht nur die Unterschriftslinie mit Beschriftung.
 */
export function unterschriften(wer: string[], o: { ortDatum?: boolean } = {}): string {
  return `<div class="unterschriften${o.ortDatum ? " mit-ort" : ""}">${wer
    .map((w) => `<div class="unterschrift">${o.ortDatum ? `<div class="linie klein-linie"></div><span>Ort, Datum</span>` : ""}<div class="linie"></div><span>${esc(w)}</span></div>`)
    .join("")}</div>`;
}

export function anschrift(b: Betrieb): string {
  return [b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter((x) => x.trim()).join(", ");
}

/** Vertragsparteien in zwei Spalten („zwischen … und …“). */
export function parteien(a: { rolle: string; name: string; anschrift?: string; zusatz?: string }, b: { rolle: string; name: string; anschrift?: string; zusatz?: string }): string {
  const block = (p: typeof a, wort: string) =>
    `<div class="partei"><div class="wort">${esc(wort)}</div><div class="name">${p.name.trim() ? esc(p.name.trim()) : LINIE}</div>${p.anschrift?.trim() ? `<div class="adresse">${esc(p.anschrift.trim()).replace(/\n/g, "<br>")}</div>` : ""}${p.zusatz ? `<div class="zusatz">${esc(p.zusatz)}</div>` : ""}<div class="rolle">– ${esc(p.rolle)} –</div></div>`;
  return `<div class="parteien">${block(a, "zwischen")}${block(b, "und")}</div>`;
}

/**
 * Formular-Feldraster (Gestalt Formular): Feldnummer, Bezeichnung, Wert im Kasten – zum Übertragen in ein amtliches
 * Formular. Zeilen mit `null` entfallen. Nummern laufen je Dokument durch (`start`).
 */
export function felder(zeilen: [string, string | null][], o: { start?: number; nummern?: boolean } = {}): string {
  const z = zeilen.filter((x): x is [string, string] => x[1] !== null);
  if (!z.length) return "";
  let n = o.start ?? 1;
  return `<table class="felder">${z
    .map(([k, v]) => `<tr>${o.nummern === false ? "" : `<td class="nr">${String(n++).padStart(2, "0")}</td>`}<th>${esc(k)}</th><td class="wert">${v.trim() ? esc(v).replace(/\n/g, "<br>") : "&nbsp;"}</td></tr>`)
    .join("")}</table>`;
}

/** Kennzahlen-Tabelle wie im amtlichen Vordruck (USt-Voranmeldung): Kennzahl im Kasten, Bezeichnung, Betrag. */
export function kennzahlen(zeilen: { kz?: string; text: string; betrag: string; fett?: boolean; hinweis?: string }[]): string {
  return `<table class="kennzahlen">${zeilen
    .map((z) => `<tr${z.fett ? ' class="gesamt"' : ""}><td class="kz">${z.kz ? `<span>${esc(z.kz)}</span>` : ""}</td><th>${esc(z.text)}${z.hinweis ? `<small>${esc(z.hinweis)}</small>` : ""}</th><td class="zahl">${z.betrag}</td></tr>`)
    .join("")}</table>`;
}

/** Inhaltsübersicht (Handbuch) aus Abschnittstiteln – ohne Seitenzahlen, die kennt das HTML nicht. */
export function inhaltsuebersicht(titel: string[]): string {
  if (titel.length < 5) return "";
  return `<nav class="inhalt-uebersicht"><h2 class="ohne">Inhalt</h2><ol>${titel.map((t) => `<li>${esc(t)}</li>`).join("")}</ol></nav>`;
}

/** Mehrere Abschnitte hintereinander, bei fünf oder mehr mit Inhaltsübersicht davor (Handbuch). */
export function abschnitte(l: { titel: string; inhalt: string; rand?: string }[]): string {
  return inhaltsuebersicht(l.map((a) => a.titel)) + l.map((a) => abschnitt(a.titel, a.inhalt, { rand: a.rand })).join("");
}

/** Vermerk am Ende eines Formulars: Linien für „Übertragen am“ und „über“. */
export function uebertragung(felderNamen: string[]): string {
  return `<div class="uebertragung">${felderNamen.map((f) => `<div><div class="linie"></div>${esc(f)}</div>`).join("")}</div>`;
}

/** Hinweis am Dokumentende (Gesetzestext, Wiederholungsfrist) – klein, abgesetzt, kein Kasten. */
export const nachsatz = (t: string) => `<p class="nachsatz">${esc(t)}</p>`;

// ---------------------------------------------------------------- Gestalt, Farbe, Seite

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
  vertrag: [16, 20, 22, 20],
  aushang: [12, 14, 16, 14],
  nachweis: [14, 18, 20, 18],
  formular: [14, 18, 20, 18],
  handbuch: [16, 20, 22, 18],
};

/** Seitengröße und Ränder je Gestalt für den Druck (dieselben Werte übergibt die App an den Drucker). */
export function seiteCss(g: Gestalt, quer = false): string {
  const [o, r, u, l] = RAENDER[g];
  return `@page { size: A4${quer ? " landscape" : ""}; margin: ${o}mm ${r}mm ${u}mm ${l}mm; }`;
}
/** Platzhalter für die Seitenränder, solange die Gestalt offen ist (setzt dokumentHtml()). */
export const SEITE_MARKE = "/*amtlos-seite*/";
/** Markierung, an der dokumentHtml() die Rechtsgrundlage der Vorlage in die Kennungsleiste setzt. */
export const GRUNDLAGE_MARKE = "<!--amtlos-grundlage-->";
/** Platzhalter für die Gestalt der Vorlage – dokumentHtml() setzt sie ein (ohne Vorlage: „nachweis“). */
export const GESTALT_MARKE = "amtlos-gestalt-offen";

const SANS = `"Amtlos Sans", "Source Sans 3", "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif`;
const SERIF = `"Amtlos Serif", "Source Serif 4", Charter, "Iowan Old Style", Georgia, "DejaVu Serif", serif`;
/** Breite der Randspalte (Nachweis, Vertrag, Handbuch) in mm. */
const RANDSPALTE = 24;
const MIT_RAND = ".g-nachweis, .g-vertrag, .g-handbuch";
const r = (sel: string) => MIT_RAND.split(", ").map((g) => `${g} ${sel}`).join(", ");

const STIL = `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${SANS}; font-size: 9.6pt; line-height: 1.45; color: #1a1f24; counter-reset: abschnitt; font-variant-numeric: lining-nums; -webkit-font-smoothing: antialiased; font-kerning: normal; hyphens: auto; -webkit-hyphens: auto; }
strong, b { font-weight: 600; }
p { margin: 0 0 1.9mm; orphans: 2; widows: 2; }
ul.punkte { margin: 0 0 2mm; padding-left: 4.2mm; }
ul.punkte li { margin: 0 0 0.9mm; padding-left: 0.6mm; }
ul.punkte li::marker { color: var(--akzent); }
.hinweis { color: #4a535c; font-style: italic; }
.klein { font-size: 8.3pt; color: #4a535c; }
.nachsatz { margin-top: 5mm; font-size: 8.3pt; line-height: 1.4; color: #4a535c; }
.fuellen { display: inline-block; min-width: 55mm; border-bottom: 0.5pt solid #8a949c; height: 4.2mm; vertical-align: bottom; }
.fuellen-block { margin: 0 0 2mm; }
.fuellen-block .fuellen { display: block; width: 100%; height: 7mm; }
table { border-collapse: collapse; width: 100%; }
td, th { font-variant-numeric: lining-nums tabular-nums; }
td.zahl, th.zahl { text-align: right; white-space: nowrap; }
tr, .unterschrift, .kasten, .summen, .zahlung, .eintrag, .parteien { page-break-inside: avoid; break-inside: avoid; }
h2, h3 { page-break-after: avoid; break-after: avoid; }
thead { display: table-header-group; }
tfoot { display: table-row-group; }

/* Kopfzeile: Betrieb links, Bereich und Logo rechts, Linie in der Hausfarbe */
.kopfzeile { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; padding-bottom: 2.4mm; border-bottom: 1.1pt solid var(--akzent); }
.kopfzeile .name { font-size: 11pt; font-weight: 600; color: var(--akzent); letter-spacing: 0.05pt; }
.kopfzeile .adresse { font-size: 7.4pt; color: #4a535c; margin-top: 0.5mm; }
.kopfzeile .rechts { display: flex; align-items: flex-end; gap: 4mm; }
.kopfzeile .art { font-size: 7.4pt; color: #4a535c; text-align: right; white-space: nowrap; }
.kopfzeile .logo { max-height: 11mm; max-width: 38mm; display: block; }

/* Titel und Kennungsleiste */
h1 { font-size: 20pt; line-height: 1.12; margin: 7mm 0 1mm; font-weight: 600; letter-spacing: -0.2pt; color: #12161b; }
.unter { font-size: 11pt; color: #4a535c; margin: 0 0 4.5mm; line-height: 1.35; }
.kennung { display: grid; grid-template-columns: repeat(auto-fit, minmax(34mm, 1fr)); margin: 0 0 6mm; padding: 2mm 0 2mm 3mm; border-left: 2pt solid var(--akzent); background: var(--akzent-hauch); }
.kennung div { padding: 0.5mm 3mm 0.5mm 0; }
.kennung dt { font-size: 6.9pt; color: #4a535c; margin: 0 0 0.3mm; letter-spacing: 0.15pt; }
.kennung dd { font-size: 8.8pt; margin: 0; font-weight: 600; color: #1a1f24; }
.kennung:empty { display: none; }

/* Abschnitte */
h2 { font-size: 12.5pt; margin: 0 0 2.4mm; font-weight: 600; color: #12161b; padding-bottom: 1.1mm; border-bottom: 0.5pt solid #c9d0d6; position: relative; }
h2 .rand { display: none; }
section.abschnitt > h2::before { counter-increment: abschnitt; content: counter(abschnitt); display: inline-block; min-width: 6mm; color: var(--akzent); font-weight: 700; }
section.abschnitt.ohne-nummer > h2::before, h2.ohne::before { content: none; }
h3 { font-size: 10.4pt; margin: 3.4mm 0 1.2mm; font-weight: 600; position: relative; }
h3 .nr, h3 .rand { display: none; }
.abschnitt { margin-top: 6.5mm; }
.eintrag { margin: 0 0 3mm; padding: 0 0 2.4mm; border-bottom: 0.5pt solid #e4e8eb; }
.eintrag:last-child { border-bottom: 0; }
.eintrag h3 { margin-top: 0; }

/* Angaben (Bezeichnung – Wert) */
table.angaben { font-size: 9.4pt; }
table.angaben th { text-align: left; font-weight: 400; font-size: 8.3pt; color: #4a535c; width: 34%; padding: 1.5mm 4mm 1.5mm 0; vertical-align: top; }
table.angaben td { padding: 1.3mm 0; vertical-align: top; }
table.angaben tr + tr th, table.angaben tr + tr td { border-top: 0.5pt solid #e4e8eb; }

/* Listen-Tabellen */
table.liste { font-size: 8.6pt; margin-top: 1mm; }
table.liste th { text-align: left; font-weight: 600; font-size: 7.6pt; color: #4a535c; padding: 1.6mm 2mm 1.3mm; vertical-align: bottom; border-bottom: 1pt solid var(--akzent); }
table.liste td { border-bottom: 0.5pt solid #dde1e5; padding: 1.8mm 2mm; vertical-align: top; }
table.liste td:first-child, table.liste th:first-child { padding-left: 0; }
table.liste td:last-child, table.liste th:last-child { padding-right: 0; }
table.liste.hoch td { height: 9.5mm; }
table.liste tr.summe td { border-bottom: 0; border-top: 1pt solid var(--akzent); font-weight: 600; padding-top: 1.8mm; }
table.liste ul.punkte { margin: 0; padding-left: 3.6mm; }

/* Kasten (Betriebsanweisung) */
.kasten { border: 1pt solid var(--band, var(--akzent)); margin-top: 3mm; }
.kasten h2 { background: var(--band, var(--akzent)); color: #ffffff; padding: 1.5mm 3mm; margin: 0; font-size: 9.8pt; border: 0; }
.kasten .inhalt { padding: 2.4mm 3mm 1mm; }

/* Summen (Rechnung, Kassenbuch) */
.summen { width: 58%; margin-left: 42%; margin-top: 3mm; font-size: 9.6pt; }
.summen td { padding: 1.2mm 0; }
.summen td:last-child { text-align: right; white-space: nowrap; }
.summen tr.gesamt td { border-top: 1pt solid var(--akzent); font-weight: 700; font-size: 11pt; padding-top: 2mm; }

/* Unterschriften */
.unterschriften { display: flex; gap: 12mm; margin-top: 14mm; }
.unterschrift { flex: 1; font-size: 7.6pt; color: #4a535c; }
.unterschrift .linie { border-bottom: 0.6pt solid #1a1f24; height: 12mm; margin-bottom: 1.2mm; }
.unterschrift .linie.klein-linie { height: 8mm; }
.unterschrift span { display: block; margin-bottom: 3mm; }
.unterschrift span:last-child { margin-bottom: 0; }
.unterschrift:only-child { max-width: 50%; }

/* Parteien (Vertrag) */
.parteien { display: flex; gap: 10mm; margin: 2mm 0 5mm; }
.partei { flex: 1; }
.partei .wort { font-family: ${SANS}; font-size: 8.3pt; color: #4a535c; margin-bottom: 1.2mm; }
.partei .name { font-weight: 600; font-size: 10.5pt; }
.partei .adresse, .partei .zusatz { font-size: 9.4pt; }
.partei .rolle { font-family: ${SANS}; font-size: 8.3pt; color: #4a535c; margin-top: 1.2mm; }

/* Formular-Feldraster */
table.felder { font-size: 9.4pt; }
table.felder td.nr { width: 7mm; font-size: 6.8pt; color: #7a838c; vertical-align: top; padding: 1.8mm 0 1.2mm; }
table.felder th { text-align: left; font-weight: 400; font-size: 8.3pt; color: #4a535c; width: 38%; padding: 1.8mm 4mm 1.2mm 0; vertical-align: top; }
table.felder td.wert { padding: 1.2mm 2mm 1.2mm 2mm; vertical-align: top; font-weight: 600; border-bottom: 0.6pt solid #8a949c; }
table.felder tr + tr td.nr, table.felder tr + tr th { border-top: 0.5pt dotted #c9d0d6; }
table.kennzahlen { font-size: 9.6pt; }
table.kennzahlen td.kz { width: 14mm; padding: 1.4mm 2mm 1.4mm 0; vertical-align: middle; }
table.kennzahlen td.kz span { display: inline-block; min-width: 9mm; padding: 0.6mm 1.2mm; border: 0.6pt solid #1a1f24; font-size: 8.3pt; text-align: center; }
table.kennzahlen th { text-align: left; font-weight: 400; padding: 1.4mm 3mm 1.4mm 0; vertical-align: middle; }
table.kennzahlen th small { display: block; font-size: 7.4pt; color: #4a535c; }
table.kennzahlen td.zahl { width: 34mm; padding: 1.4mm 2mm; border: 0.6pt solid #8a949c; background: #ffffff; vertical-align: middle; }
table.kennzahlen tr + tr td, table.kennzahlen tr + tr th { border-top: 0.5pt solid #e4e8eb; }
table.kennzahlen tr + tr td.zahl { border-top: 0.6pt solid #8a949c; }
table.kennzahlen tr.gesamt th, table.kennzahlen tr.gesamt td.zahl { font-weight: 700; }
table.kennzahlen tr.gesamt td.zahl { border-width: 1pt; }

/* Inhaltsübersicht */
.inhalt-uebersicht { margin: 0 0 7mm; padding: 2.6mm 0 2mm; border-top: 0.5pt solid #c9d0d6; border-bottom: 0.5pt solid #c9d0d6; font-family: ${SANS}; }
.inhalt-uebersicht h2 { border: 0; font-size: 8.3pt; color: #4a535c; margin: 0 0 1.2mm; padding: 0; font-weight: 600; }
.inhalt-uebersicht ol { margin: 0; padding: 0; columns: 2; column-gap: 8mm; font-size: 8.8pt; list-style: none; counter-reset: ue; }
.inhalt-uebersicht li { counter-increment: ue; padding-left: 7mm; position: relative; margin: 0 0 0.6mm; break-inside: avoid; }
.inhalt-uebersicht li::before { content: counter(ue); position: absolute; left: 0; color: var(--akzent); font-weight: 700; }

/* Fußleiste: im PDF setzt sie die App auf jede Seite; auf dem Bildschirm (Vorschau) steht sie am Blattende */
.fussleiste { display: none; }
@media screen { .g-brief .fussleiste { display: flex; } }
body.g-brief.fuss-im-fluss .fussleiste { display: flex; }
.fussleiste { gap: 5mm; margin-top: 12mm; padding-top: 2mm; border-top: 0.5pt solid #c9d0d6; font-size: 6.9pt; line-height: 1.4; color: #4a535c; }
.fussleiste div { flex: 1; }
.fussleiste b { color: #1a1f24; font-weight: 600; }

/* ---------------- Randspalte (Nachweis, Vertrag, Handbuch): Nummern und Gesetzesangaben links neben dem Text */
${r("main")} { padding-left: ${RANDSPALTE}mm; }
${r("section.abschnitt > h2::before")} { position: absolute; left: -${RANDSPALTE}mm; top: 0; width: ${RANDSPALTE - 4}mm; min-width: 0; text-align: left; }
${r("h2 .rand")} { display: block; position: absolute; left: -${RANDSPALTE}mm; top: 6.2mm; width: ${RANDSPALTE - 4}mm; font-size: 6.8pt; line-height: 1.3; font-weight: 400; color: #7a838c; font-family: ${SANS}; hyphens: manual; }
${r("h3 .nr")} { display: block; position: absolute; left: -${RANDSPALTE}mm; top: 0; width: ${RANDSPALTE - 4}mm; color: var(--akzent); font-weight: 700; font-family: ${SANS}; }
${r("h3 .rand")} { display: block; position: absolute; left: -${RANDSPALTE}mm; top: 0; width: ${RANDSPALTE - 4}mm; font-size: 6.8pt; line-height: 1.3; font-weight: 400; color: #7a838c; font-family: ${SANS}; }
${r("h3 .nr ~ .rand")} { top: 5.2mm; }
${r("section.abschnitt > h2 + .eintrag")} { margin-top: 7mm; }
${r("main:has(section.abschnitt) .unterschriften")} { margin-left: -${RANDSPALTE}mm; }
${r("main:has(section.abschnitt) .inhalt-uebersicht")} { margin-left: -${RANDSPALTE}mm; }
/* Querformat (Verzeichnisse, Protokolle) und Dokumente ohne Abschnitte: volle Breite, Nummern im Text */
${r("main:not(:has(section.abschnitt))")}, .quer main { padding-left: 0; }
.quer section.abschnitt > h2::before { position: static; display: inline-block; min-width: 7mm; width: auto; }
.quer h2 .rand, .quer h3 .nr, .quer h3 .rand { display: none; }
.quer .unterschriften, .quer .inhalt-uebersicht { margin-left: 0; }

/* ---------------- Brief (DIN 5008 Form B) */
body.g-brief { padding-left: 5mm; }
.g-brief .kopf { position: relative; height: 33mm; }
.g-brief .kopf .marke { position: absolute; left: 0; top: 4mm; }
.g-brief .kopf .marke .name { font-size: 17pt; line-height: 1.05; font-weight: 600; color: var(--akzent); letter-spacing: -0.15pt; }
.g-brief .kopf .marke .zusatz { font-size: 8pt; color: #4a535c; margin-top: 1.2mm; }
.g-brief .kopf .logo { position: absolute; right: 0; top: 3mm; max-height: 22mm; max-width: 60mm; }
.g-brief .fenster { position: relative; height: 45mm; }
.g-brief .anschrift { position: absolute; left: -5mm; top: 0; width: 85mm; height: 45mm; padding-left: 5mm; }
.g-brief .anschrift .ruecksendung { height: 5mm; padding-top: 1.4mm; font-size: 6.6pt; color: #4a535c; white-space: nowrap; overflow: hidden; }
.g-brief .anschrift .vermerk { height: 12.7mm; font-size: 7.6pt; color: #4a535c; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 1mm; }
.g-brief .anschrift .empf { font-size: 10pt; line-height: 1.32; }
.g-brief .info { position: absolute; left: 100mm; top: 5mm; width: 75mm; font-size: 8.2pt; }
.g-brief .info table td { padding: 0.45mm 0; vertical-align: top; }
.g-brief .info table td:first-child { color: #4a535c; width: 31mm; padding-right: 2mm; }
.g-brief .betreff { margin: 8.5mm 0 5.5mm; font-size: 12.5pt; font-weight: 700; color: #12161b; }
.g-brief .betreff span { display: block; font-size: 9pt; font-weight: 400; color: #4a535c; margin-top: 0.8mm; }
.g-brief .anrede { margin: 0 0 3.5mm; }
.g-brief table.liste th { border-bottom-width: 1.2pt; }
.g-brief table.liste td { padding-top: 2mm; padding-bottom: 2mm; }
.g-brief .zahlung { margin-top: 6.5mm; display: flex; gap: 5mm; align-items: stretch; background: var(--akzent-hauch); border-left: 2pt solid var(--akzent); padding: 3mm 3.5mm; }
.g-brief .zahlung .qr { flex: 0 0 auto; background: #fff; padding: 1.5mm; align-self: flex-start; }
.g-brief .zahlung .qr svg { display: block; }
.g-brief .zahlung .qr small { display: block; text-align: center; font-size: 6.4pt; color: #4a535c; margin-top: 1mm; }
.g-brief .zahlung .text { flex: 1; }
.g-brief .zahlung p:last-child { margin: 0; }
.g-brief .schluss { page-break-inside: avoid; break-inside: avoid; }
.g-brief .gruss { margin-top: 5.5mm; }
.g-brief .gruss p { margin-bottom: 1.4mm; }

/* ---------------- Vertrag */
.g-vertrag { font-family: ${SERIF}; font-size: 10pt; line-height: 1.55; }
.g-vertrag p, .g-vertrag li, .g-vertrag table.angaben td { text-align: justify; }
.g-vertrag h1, .g-vertrag h2, .g-vertrag h3, .g-vertrag .kopfzeile, .g-vertrag .kennung, .g-vertrag table.liste, .g-vertrag .unterschrift, .g-vertrag table.angaben th, .g-vertrag .unter, .g-vertrag .nachsatz, .g-vertrag .klein { font-family: ${SANS}; }
.g-vertrag h1 { text-align: center; margin-top: 9mm; font-size: 18pt; }
.g-vertrag .unter { text-align: center; }
.g-vertrag .kennung { border-left: 0; background: none; border-top: 0.5pt solid #c9d0d6; border-bottom: 0.5pt solid #c9d0d6; padding-left: 0; }
.g-vertrag section.abschnitt > h2 { border-bottom: 0; font-size: 10.8pt; margin-bottom: 1.4mm; padding-bottom: 0; }
.g-vertrag section.abschnitt:not(.ohne-nummer) > h2::before { content: "§ " counter(abschnitt); }
.g-vertrag.nummern-zahl section.abschnitt:not(.ohne-nummer) > h2::before { content: counter(abschnitt) "."; }
.g-vertrag.nummern-zahl .abschnitt { margin-top: 4.2mm; }
.g-vertrag.nummern-zahl .parteien { margin-top: 1mm; margin-bottom: 1mm; }
.g-vertrag table.angaben th { width: 30%; font-size: 8.3pt; }
.g-vertrag table.angaben td { font-size: 9.8pt; }

/* ---------------- Aushang */
.g-aushang { font-size: 10.4pt; line-height: 1.4; }
.g-aushang .kopfzeile { background: var(--akzent); color: #ffffff; padding: 3.5mm 5mm; border: 0; align-items: center; }
.g-aushang .kopfzeile .name, .g-aushang .kopfzeile .adresse, .g-aushang .kopfzeile .art { color: #ffffff; }
.g-aushang .kopfzeile .logo { background: #ffffff; padding: 1.2mm 2mm; border-radius: 1mm; max-height: 13mm; }
.g-aushang h1 { font-size: 26pt; margin-top: 6mm; }
.g-aushang .unter { font-size: 13pt; }
.g-aushang .kennung { margin-bottom: 5mm; }
.g-aushang table.liste { font-size: 10pt; }
.g-aushang table.liste th { font-size: 8.6pt; padding: 2.2mm 2.4mm 1.8mm; background: var(--akzent-hauch); color: #1a1f24; border-bottom-width: 1.2pt; }
.g-aushang table.liste td { padding: 2.6mm 2.4mm; }
.g-aushang table.liste td:first-child, .g-aushang table.liste th:first-child { padding-left: 2.4mm; }
.g-aushang table.liste td:last-child, .g-aushang table.liste th:last-child { padding-right: 2.4mm; }
.g-aushang h2 { font-size: 13.5pt; }
.g-aushang section.abschnitt > h2::before { content: none; }
/* Betriebsanweisung nach dem Muster der DGUV Information 211-010: Kopf schlicht, Kästen in der Kennfarbe (Gefahrstoffe orange) */
.g-aushang.ba .kopfzeile { background: none; color: #1a1f24; padding: 0 0 2.4mm; border-bottom: 1.1pt solid var(--akzent); align-items: flex-end; }
.g-aushang.ba .kopfzeile .name { color: var(--akzent); }
.g-aushang.ba .kopfzeile .adresse, .g-aushang.ba .kopfzeile .art { color: #4a535c; }
.g-aushang.ba .kopfzeile .logo { background: none; padding: 0; }
.g-aushang.ba h1, .g-aushang.ba .kennung { display: none; }
.g-aushang.ba .titelband { display: flex; align-items: stretch; margin-top: 5mm; border: 1.2pt solid var(--band); }
.g-aushang.ba .titelband .t { flex: 1; padding: 2.4mm 4mm; background: var(--band); color: #fff; font-size: 19pt; font-weight: 700; line-height: 1.15; }
.g-aushang.ba .titelband .t small { display: block; font-size: 9pt; font-weight: 400; }
.g-aushang.ba .titelband .n { flex: 0 0 34mm; padding: 2.4mm 3mm; font-size: 8.6pt; color: #4a535c; display: flex; flex-direction: column; justify-content: center; gap: 1mm; }
.g-aushang.ba .titelband .n b { display: block; font-size: 12pt; color: #1a1f24; }
.g-aushang.ba .kasten { margin-top: 2.4mm; }
.g-aushang.ba .kasten h2 { font-size: 11pt; padding: 1.8mm 4mm; }
.g-aushang.ba .kasten .inhalt { padding: 2.6mm 4mm 1.2mm; font-size: 10.4pt; }
.g-aushang.ba .kasten.stoff .inhalt { display: flex; gap: 6mm; }
.g-aushang.ba .kasten.stoff .inhalt > div { flex: 1; }
.g-aushang.ba .kasten.stoff .inhalt dt { font-size: 7.6pt; color: #4a535c; margin-bottom: 0.6mm; }
.g-aushang.ba .kasten.stoff .inhalt dd { margin: 0; font-weight: 600; font-size: 11pt; }
.g-aushang.ba .notruf { margin-top: 2mm; padding: 2mm 4mm; border: 1.2pt solid #1a1f24; font-weight: 700; font-size: 11pt; }
.g-aushang .unterschriften { margin-top: 10mm; }
.g-aushang .nachsatz { font-size: 9pt; }
.g-aushang table.liste.legende { font-size: 8.6pt; }
.g-aushang table.liste.legende th { font-size: 7.6pt; }
.g-aushang table.liste.legende td { padding: 1.6mm 2.4mm; }

/* ---------------- Formular (Zusammenstellung für ein amtliches Formular) */
.g-formular h2 { background: var(--akzent-hauch); padding: 1.6mm 2.6mm; border: 0; font-size: 10.8pt; margin-top: 1mm; }
.g-formular section.abschnitt > h2::before { min-width: 7mm; }
.g-formular .abschnitt { margin-top: 5.5mm; }
.g-formular .bilanz { display: flex; gap: 8mm; }
.g-formular .bilanz > div { flex: 1; }
.g-formular .uebertragung { margin-top: 8mm; padding-top: 2.5mm; border-top: 0.5pt solid #c9d0d6; font-size: 8.3pt; color: #4a535c; display: flex; gap: 10mm; }
.g-formular .uebertragung div { flex: 1; }
.g-formular .uebertragung .linie { border-bottom: 0.5pt solid #8a949c; height: 6mm; margin-bottom: 1mm; }

/* ---------------- Handbuch */
.g-handbuch { font-family: ${SERIF}; font-size: 10pt; line-height: 1.6; }
.g-handbuch h1, .g-handbuch h2, .g-handbuch h3, .g-handbuch .kopfzeile, .g-handbuch .kennung, .g-handbuch table, .g-handbuch .unterschrift, .g-handbuch .unter, .g-handbuch .nachsatz, .g-handbuch .klein, .g-handbuch .inhalt-uebersicht { font-family: ${SANS}; }
.g-handbuch h1 { font-size: 22pt; margin-top: 10mm; }
.g-handbuch .abschnitt { margin-top: 7.5mm; }
.g-handbuch h2 { font-size: 12.5pt; }
.g-handbuch table.angaben td { font-family: ${SERIF}; }
.g-handbuch p { max-width: 150mm; }
`;

/** Felder der Kennungsleiste aus „Bezeichnung: Wert“-Zeilen. */
function kopfZeilen(meta: string | undefined): [string, string][] {
  return (meta ?? "")
    .split("\n")
    .map((z) => z.split(/:\s(.+)/))
    .filter((t) => t.length >= 2 && t[0]!.trim() && (t[1] ?? "").trim())
    .map((t) => [t[0]!.trim(), t[1]!.trim()]);
}

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
      t(b.rechtsform) && t(b.registergericht) ? `Sitz ${t(b.ort)}, ${[t(b.registergericht), t(b.registernummer)].filter(Boolean).join(" ")}` : [t(b.registergericht), t(b.registernummer)].filter(Boolean).join(" "),
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

/** Kopf des HTML-Dokuments: Meta-Angaben für die App (Fußzeile, Ränder, Gestalt) und Stil. */
function kopf(o: { titel: string; betrieb: Betrieb; fussLinks: string; fussRechts: string; quer?: boolean; gestalt?: Gestalt; band?: string }): string {
  const b = o.betrieb;
  const farbe = akzent(b);
  const seite = `<style>${o.gestalt ? seiteCss(o.gestalt, o.quer) : o.quer ? `${SEITE_MARKE}@page { size: A4 landscape; }` : SEITE_MARKE}</style>`;
  const g = o.gestalt ?? GESTALT_MARKE;
  const band = o.band ? `--band:${o.band};` : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(o.titel)}</title><meta name="amtlos-gestalt" content="${g}"><meta name="amtlos-fuss-links" content="${esc(o.fussLinks)}"><meta name="amtlos-fuss-rechts" content="${esc(o.fussRechts)}"><meta name="amtlos-fuss-spalten" content="${esc(JSON.stringify(fussSpalten(b)))}"><meta name="amtlos-farbe" content="${farbe}"><style>:root{--akzent:${farbe};--akzent-hauch:${hauch(farbe, 0.08)};${band}}${STIL}</style>${seite}</head>`;
}

export interface DokumentOptionen {
  titel: string;
  betrieb: Betrieb;
  /** Unterzeile unter dem Titel (z. B. Arbeitsbereich, Person, Zeitraum) */
  unter?: string;
  /** Kennungsleiste: „Bezeichnung: Wert“ je Zeile */
  meta?: string;
  inhalt: string;
  quer?: boolean;
  /** Bereich rechts in der Kopfzeile (setzt dokumentHtml) */
  art?: string;
  /** Inhalt vor dem Titel */
  vorTitel?: string;
  gestalt?: Gestalt;
  /** Vertrag: Abschnitte mit „1.“ statt „§ 1“ */
  nummerierung?: "paragraph" | "zahl";
  /** Betriebsanweisung: Kennfarbe der Kästen (sonst Hausfarbe) */
  band?: string;
  /** zusätzliche Klasse am body (z. B. „ba“ für die Betriebsanweisung) */
  klasse?: string;
}

/** Ganzes Dokument: Kopfzeile des Betriebs, Titel, Kennungsleiste, Inhalt. Die Gestalt setzt dokumentHtml(). */
export function dokument(o: DokumentOptionen): string {
  const b = o.betrieb;
  const kontakt = [b.telefon, b.email].filter((x) => x.trim()).join(" · ");
  const adresse = [anschrift(b), kontakt].filter(Boolean).join(" · ");
  const kopfDaten = kopfZeilen(o.meta);
  const stand = kopfDaten.find(([k]) => /^(stand|datum|rechnungsdatum|prüfdatum|ausgestellt|bekannt seit)/i.test(k))?.[1] ?? "";
  const fussLinks = [b.name.trim(), o.titel].filter(Boolean).join(" · ");
  const g = o.gestalt ?? GESTALT_MARKE;
  const klassen = [`g-${g}`, o.quer ? "quer" : "", o.nummerierung === "zahl" ? "nummern-zahl" : "", o.klasse ?? ""].filter(Boolean).join(" ");
  return `${kopf({ titel: o.titel, betrieb: b, fussLinks, fussRechts: stand ? `Stand ${stand}` : "", quer: o.quer, gestalt: o.gestalt, band: o.band })}<body class="${klassen}">
<header class="kopfzeile"><div><div class="name">${b.name.trim() ? esc(b.name.trim()) : LINIE}</div>${adresse ? `<div class="adresse">${esc(adresse)}</div>` : ""}</div><div class="rechts"><div class="art">${esc(o.art ?? "")}</div>${logoHtml(b)}</div></header>
${o.vorTitel ?? ""}<h1>${esc(o.titel)}</h1>${o.unter ? `<p class="unter">${esc(o.unter)}</p>` : ""}
<dl class="kennung">${GRUNDLAGE_MARKE}${kopfDaten.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
<main>${o.inhalt}</main>
${fussHtml(b)}
</body></html>`;
}

/**
 * Geschäftsbrief nach DIN 5008 Form B (E-129/E-130): Briefkopf (Logo bzw. Name in der Hausfarbe), Rücksendeangabe und
 * Anschrift im Fenster (45 mm von oben, 20 mm von links, 85 × 45 mm), Informationsblock rechts daneben, Betreff,
 * Inhalt. Die Fußzeile mit Anschrift, Kontakt, Bank, Steuer und Register setzt die App auf jede Seite.
 */
export function brief(o: { titel: string; betreff: string; unterBetreff?: string; betrieb: Betrieb; empfaenger: { name: string; anschrift: string; zusatz?: string }; info: [string, string][]; anrede?: string; inhalt: string; vermerk?: string; stand?: string }): string {
  const b = o.betrieb;
  const logo = logoHtml(b);
  const zusatz = [anschrift(b)].filter(Boolean).join("");
  const ruecksendung = [b.name.trim(), b.strasse.trim(), [b.plz.trim(), b.ort.trim()].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  const empf = `${o.empfaenger.name.trim() ? `${esc(o.empfaenger.name.trim())}<br>` : LINIE}${o.empfaenger.anschrift.trim() ? esc(o.empfaenger.anschrift.trim()).replace(/\n/g, "<br>") : LINIE}${o.empfaenger.zusatz ? `<br><span style="font-size:8pt;color:#4a535c">${esc(o.empfaenger.zusatz)}</span>` : ""}`;
  const info = o.info.filter(([, w]) => w.trim());
  return `${kopf({ titel: o.titel, betrieb: b, fussLinks: [b.name.trim(), o.titel].filter(Boolean).join(" · "), fussRechts: o.stand ? `Stand ${o.stand}` : "", gestalt: "brief" })}<body class="g-brief">
<header class="kopf">${logo}<div class="marke"${logo ? ' style="right:65mm"' : ""}><div class="name">${b.name.trim() ? esc(b.name.trim()) : LINIE}</div>${zusatz ? `<div class="zusatz">${esc(zusatz)}</div>` : ""}</div></header>
<div class="fenster"><div class="anschrift"><div class="ruecksendung">${esc(ruecksendung)}</div><div class="vermerk">${o.vermerk ? esc(o.vermerk) : ""}</div><div class="empf">${empf}</div></div>
<div class="info"><table>${info.map(([k, w]) => `<tr><td>${esc(k)}</td><td>${esc(w)}</td></tr>`).join("")}</table></div></div>
<h1 class="betreff">${esc(o.betreff)}${o.unterBetreff ? `<span>${esc(o.unterBetreff)}</span>` : ""}</h1>
${o.anrede ? `<p class="anrede">${esc(o.anrede)}</p>` : ""}<main>${o.inhalt}</main>
${fussHtml(b)}
</body></html>`;
}

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

/** ISO-Datum plus Monate (für Folgetermine), als TT.MM.JJJJ. */
export function plusMonate(iso: string, monate: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + monate, Number(m[3])));
  return datumDe(d.toISOString().slice(0, 10));
}
