/**
 * Bausteine für die HTML-Dokumente (A4, druckfertig). Alle Eingaben werden maskiert.
 *
 * Gestaltung (E-130, docs/10-dokumente-gestaltung.md): Jede Vorlage hat eine Gestalt, die zu Leser und Zweck passt –
 * Brief (DIN 5008), Vertrag, Aushang, Nachweis, Formular, Handbuch. Das eine prägende Element ist die Randspalte:
 * Abschnittsnummer und Rechtsgrundlage stehen links neben dem Text wie Randnummern in einem Gesetzeskommentar.
 */
import type { Betrieb, Daten, Eintrag } from "./typen.js";
import { rundeCent } from "../rechnung.js";

/**
 * Hinweis zur fachlichen Abnahme (PRUEFLISTE T-52 ff.). Steht in der App vor dem Erstellen, nicht im Dokument: Die
 * Unterlage ist das Dokument des Betriebs und muss bei einer Prüfung vorzeigbar sein.
 */
export const PRUEFHINWEIS = "Die Vorlagen sind noch nicht von Fachleuten geprüft. Prüfe die Inhalte, bevor du sie verwendest.";
/** Platzhalter für Text-Ausgaben (z. B. Website-Text); im Dokument stehen stattdessen Linien zum Ausfüllen. */
export const LEER = "(noch nicht angegeben)";
/** Leere Angabe im Dokument: eine Linie zum Ausfüllen von Hand. */
export const LINIE = '<span class="fuellen"></span>';
/**
 * Wert in der Kennungsleiste (`meta`), der als Linie zum Ausfüllen erscheint – für Angaben, die auf dem leeren Blatt
 * von Hand einzutragen sind (Zeitraum, Jahr, Stichtag). Leere Werte entfallen sonst in der Leiste.
 */
export const KOPF_LINIE = "\u0001";

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
/** Randangabe maskiert; Bereiche wie „lit. b–g“ oder „§§ 145–147“ werden nicht am Strich umbrochen. */
const randText = (t: string) =>
  esc(t)
    .replace(/((?:lit\.\s)?\S+–\S+)/g, '<span class="nb">$1</span>')
    // „lit. a, b“: Einzelbuchstabe nach Komma nicht allein an den Zeilenanfang
    .replace(/, (?=[a-z](?![\wäöüß]))/g, ",&nbsp;");

/**
 * Kurzer Abschnitt (keine Listentabelle, geschätzt höchstens ein gutes Drittel einer Seite): bleibt samt Überschrift
 * auf einer Seite. Längere Abschnitte dürfen umbrechen, sonst blieben große Lücken am Seitenende.
 */
function kurzerAbschnitt(inhalt: string): "" | "kurz" | "kurz-ausser-handbuch" {
  if (inhalt.includes('class="liste')) return "";
  const anzahl = (s: string) => inhalt.split(s).length - 1;
  const zeichen = inhalt.replace(/<[^>]*>/g, "").length;
  // grobe Höhe in mm: Textzeilen, Tabellenzeilen, Linienblöcke, Unterüberschriften, Absätze
  const rest = anzahl("<tr") * 7 + anzahl("fuellen-block") * 16 + anzahl("<h3") * 8 + anzahl("<p") * 2 + anzahl("<li") * 1.5;
  // Standardsatz: ca. 90 Zeichen zu 4,6 mm je Zeile
  if ((zeichen / 90) * 4.6 + rest >= 75) return "";
  // Handbuch (Serif 10 pt, Zeilenabstand 1,6, Text höchstens 150 mm breit): gemessen ca. 67 Zeichen zu 5,6 mm je Zeile.
  // Dort nur Abschnitte unter ca. 45 mm zusammenhalten – sonst rückt ein langer Absatzblock ganz auf die nächste Seite
  // und lässt eine halb leere Seite zurück (Datenschutzerklärung, Datenschutzinformation).
  return (zeichen / 67) * 5.6 + rest < 45 ? "kurz" : "kurz-ausser-handbuch";
}

export function abschnitt(titel: string, inhalt: string, o: string | AbschnittOptionen = ""): string {
  const opt: AbschnittOptionen = typeof o === "string" ? { klasse: o, ohneNummer: o.includes("ohne-nummer") } : o;
  const kurz = kurzerAbschnitt(inhalt);
  const klassen = ["abschnitt", opt.klasse ?? "", opt.ohneNummer ? "ohne-nummer" : "", kurz ? "zusammen" : "", kurz === "kurz-ausser-handbuch" ? "lang-im-handbuch" : ""].filter(Boolean).join(" ");
  const rand = opt.rand ? `<span class="rand">${randText(opt.rand)}</span>` : "";
  return `<section class="${klassen}"><h2>${rand}${esc(titel)}</h2>${inhalt}</section>`;
}

/** Überschrift samt kurzem Inhalt als Einheit, die nicht über einen Seitenumbruch getrennt wird (CSS-Klasse „zusammen“). */
export const zusammen = (inhalt: string) => `<div class="zusammen">${inhalt}</div>`;

/** Einzelner Eintrag innerhalb eines Abschnitts (z. B. eine Verarbeitungstätigkeit): Nummer in der Randspalte. */
export function eintrag(titel: string, inhalt: string, o: { nummer?: string; rand?: string } = {}): string {
  const nr = o.nummer ? `<span class="nr">${esc(o.nummer)}</span>` : "";
  const rand = o.rand ? `<span class="rand">${randText(o.rand)}</span>` : "";
  return `<div class="eintrag"><h3>${nr}${rand}${esc(titel)}</h3>${inhalt}</div>`;
}

/**
 * Tabelle. Zellen sind bereits maskiertes HTML (mit `zelle` erzeugen). `leerzeilen` hängt leere Zeilen zum
 * Ausfüllen von Hand an; `mindestens` füllt bis zu dieser Zeilenzahl auf; `zahlen` nennt rechtsbündige Spalten;
 * `summe` ist eine abgesetzte Schlusszeile; mit `summeSpanne` reicht ihre erste Zelle über so viele Spalten (für eine
 * längere Bezeichnung), die übrigen Zellen schließen rechts an. `schluss` hält die letzten so vielen Zeilen als eigene
 * Zeilengruppe zusammen (z. B. letzter Name samt Leerzeilen), damit auf einer neuen Seite nicht nur Leerzeilen stehen.
 */
export function tabelle(kopf: string[], zeilen: string[][], o: { breiten?: string[]; leerzeilen?: number; mindestens?: number; hoch?: boolean; zahlen?: number[]; summe?: string[]; summeSpanne?: number; klasse?: string; schluss?: number } = {}): string {
  const leer = Math.max(o.leerzeilen ?? 0, (o.mindestens ?? 0) - zeilen.length);
  const alle = [...zeilen, ...Array.from({ length: leer }, () => kopf.map(() => "&nbsp;"))];
  const cols = o.breiten ? `<colgroup>${o.breiten.map((b) => `<col style="width:${b}">`).join("")}</colgroup>` : "";
  const z = (i: number) => (o.zahlen?.includes(i) ? ' class="zahl"' : "");
  const spanne = Math.max(1, o.summeSpanne ?? 1);
  const fuss = o.summe ? `<tfoot><tr class="summe">${o.summe.map((c, i) => (i === 0 && spanne > 1 ? `<td colspan="${spanne}">${c}</td>` : `<td${z(i + spanne - 1)}>${c}</td>`)).join("")}</tr></tfoot>` : "";
  const zeile = (r: string[]) => `<tr>${r.map((c, i) => `<td${z(i)}>${c}</td>`).join("")}</tr>`;
  // mindestens eine Zeile bleibt vor der Schlussgruppe, sonst wäre die ganze Tabelle eine Gruppe
  const ab = o.schluss && alle.length > o.schluss ? alle.length - o.schluss : alle.length;
  const rumpf = `<tbody>${alle.slice(0, ab).map(zeile).join("")}</tbody>${ab < alle.length ? `<tbody class="schluss">${alle.slice(ab).map(zeile).join("")}</tbody>` : ""}`;
  return `<table class="liste${o.hoch ? " hoch" : ""}${o.klasse ? ` ${o.klasse}` : ""}">${cols}<thead><tr>${kopf.map((k, i) => `<th${z(i)}>${esc(k)}</th>`).join("")}</tr></thead>${rumpf}${fuss}</table>`;
}
export const zelle = (t: string) => esc(t).replace(/\n/g, "<br>");

/**
 * Unterschriften nebeneinander. Mit `ortDatum` bekommt jeder Block zusätzlich eine Zeile für Ort und Datum (Verträge,
 * Nachweise); ohne steht nur die Unterschriftslinie mit Beschriftung.
 */
export function unterschriften(wer: string[], o: { ortDatum?: boolean; orte?: string[] } = {}): string {
  return `<div class="unterschriften${o.ortDatum ? " mit-ort" : ""}">${wer
    .map((w, i) => {
      // vorbelegter Ort (z. B. aus dem Formular) vor der Linie „Ort, Datum“
      const ort = (o.orte?.[i] ?? "").trim();
      return `<div class="unterschrift">${o.ortDatum ? `<div class="linie klein-linie">${ort ? `<b>${esc(ort)},</b>` : ""}</div><span>Ort, Datum</span>` : ""}<div class="linie"></div><span>${esc(w)}</span></div>`;
    })
    .join("")}</div>`;
}

/** Leere Tabellenzelle mit Linie zum Ausfüllen. */
export const ZELLE_LINIE = '<span class="zelle-linie"></span>';

/** IBAN in Vierergruppen (DIN 5008), z. B. „DE89 3704 0044 0532 0130 00“; anderes bleibt unverändert. */
export function ibanText(iban: string): string {
  const roh = iban.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(roh) ? roh.replace(/(.{4})(?=.)/g, "$1 ") : iban.trim();
}

export function anschrift(b: Betrieb): string {
  return [b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter((x) => x.trim()).join(", ");
}

/** Vertragsparteien in zwei Spalten („zwischen … und …“). Ohne Name und Anschrift: Linien für beides. */
export function parteien(a: { rolle: string; name: string; anschrift?: string; zusatz?: string }, b: { rolle: string; name: string; anschrift?: string; zusatz?: string }): string {
  const block = (p: typeof a, wort: string) =>
    `<div class="partei"><div class="wort">${esc(wort)}</div><div class="name">${p.name.trim() ? esc(p.name.trim()) : LINIE}</div>${p.anschrift?.trim() ? `<div class="adresse">${esc(p.anschrift.trim()).replace(/\n/g, "<br>")}</div>` : !p.name.trim() ? `<div class="adresse">${LINIE}</div>` : ""}${p.zusatz ? `<div class="zusatz">${esc(p.zusatz)}</div>` : ""}<div class="rolle">– ${esc(p.rolle)} –</div></div>`;
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
  // Brief: rechts 10 mm, damit der Informationsblock nach DIN 5008 bis 200 mm reicht (der Text endet über das Padding bei 190 mm)
  brief: [12, 10, 30, 20],
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
tr, .unterschrift, .kasten, .summen, .zahlung, .parteien, .schlussblock { page-break-inside: avoid; break-inside: avoid; }
h2, h3 { page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }
/* Unterschriften bleiben beim Text davor (dokument() fasst sie mit dem letzten kurzen Block zum Schlussblock zusammen) */
.unterschriften { page-break-before: avoid; break-before: avoid; }
.nb { white-space: nowrap; }
table.liste.fortsetzung { margin-top: 0; }
.schlussblock > table + .unterschriften, .schlussblock.nach-tabelle > .unterschriften:first-child { margin-top: 7mm; }
/* oben bündig: die kürzere Spalte wird nicht auf die Höhe der längeren gestreckt */
.spalten2 { display: flex; gap: 10mm; align-items: flex-start; }
.spalten2 > * { flex: 1; }
/* zwei Angaben-Spalten nebeneinander: gleiche Zeilenhöhe, auch wenn links Text und rechts eine Ausfülllinie steht */
.spalten2 table.angaben th, .spalten2 table.angaben td { height: 7mm; vertical-align: bottom; }
.zelle-linie { display: block; border-bottom: 0.5pt solid #8a949c; height: 4.2mm; }
ol.nummern { margin: 0 0 2mm; padding-left: 6mm; }
ol.nummern li { margin: 0 0 0.9mm; padding-left: 0.6mm; }
ol.nummern li::marker { color: var(--akzent); }
thead { display: table-header-group; }
tfoot { display: table-row-group; }
/* Tabellen: keine einzelne Zeile unter der Überschrift oder allein auf der neuen Seite, Summenzeile nicht ohne die
   letzte Zeile (Chromium beachtet „avoid“ an Zeilen- und Zeilengruppengrenzen; der Tabellenkopf wiederholt sich) */
table > tbody > tr:nth-child(2), table > tbody > tr:last-child, tfoot, tfoot tr { page-break-before: avoid; break-before: avoid; }
table.liste tbody.schluss { page-break-inside: avoid; break-inside: avoid; }
.schlussblock.nach-tabelle { page-break-before: avoid; break-before: avoid; }
.fuellen-block, .uebertragung { page-break-inside: avoid; break-inside: avoid; }
/* „zusammen“: Überschrift samt kurzem Inhalt (Feldblock, Linien, kurze Tabelle) nicht über einen Seitenumbruch
   trennen – in Vorlagen als <div class="zusammen">…</div> (oder zusammen()); abschnitt() setzt die Klasse bei kurzen
   Abschnitten selbst. Nur für Blöcke deutlich kürzer als eine Seite, sonst bricht Chromium trotzdem um. */
.zusammen { page-break-inside: avoid; break-inside: avoid; }
/* eigenes Blatt (z. B. Messprotokoll zum Aushängen) */
.neue-seite { page-break-before: always; break-before: page; }

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
.kennung dd .fuellen { min-width: 0; width: 100%; max-width: 45mm; height: 4.6mm; }
/* kurze Linie im Text, z. B. für einen Steuersatz „Umsatzsteuer ___ %“ */
.fuellen.kurz { min-width: 10mm; width: 10mm; }

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
table.liste th.zahl, table.liste td.zahl { text-align: right; }
table.liste th.zahl { white-space: normal; }
table.liste td { border-bottom: 0.5pt solid #dde1e5; padding: 1.8mm 2mm; vertical-align: top; }
table.liste td:first-child, table.liste th:first-child { padding-left: 0; }
table.liste td:last-child, table.liste th:last-child { padding-right: 0; }
table.liste.hoch td { height: 8mm; }
table.liste tr.summe td { border-bottom: 0; border-top: 1pt solid var(--akzent); font-weight: 600; padding-top: 1.8mm; }
table.liste.doppelt tr.summe td.zahl { border-bottom: 2.2pt double var(--akzent); }
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
.unterschriften { display: flex; gap: 12mm; margin-top: 10mm; }
.unterschrift { flex: 1; font-size: 7.6pt; color: #4a535c; }
.unterschrift .linie { border-bottom: 0.6pt solid #1a1f24; height: 11mm; margin-bottom: 1.2mm; }
.unterschrift .linie.klein-linie { height: 8mm; display: flex; align-items: flex-end; }
.unterschrift .linie.klein-linie b { font-weight: 400; font-size: 9.4pt; color: #1a1f24; padding: 0 0 0.6mm; }
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
table.felder { font-size: 9.4pt; table-layout: fixed; }
table.felder td.wert { overflow-wrap: anywhere; }
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
${MIT_RAND.split(", ").map((g) => `${g}:not(.quer) main:has(section.abschnitt) .unterschriften`).join(", ")} { margin-left: -${RANDSPALTE}mm; }
${MIT_RAND.split(", ").map((g) => `${g}:not(.quer) main:has(section.abschnitt) .inhalt-uebersicht`).join(", ")} { margin-left: -${RANDSPALTE}mm; }
/* Querformat (Verzeichnisse, Protokolle) und Dokumente ohne Abschnitte: volle Breite, Nummern im Text */
${r("main:not(:has(section.abschnitt))")}, .quer main { padding-left: 0; }
.quer section.abschnitt > h2::before { position: static; display: inline-block; min-width: 7mm; width: auto; }
.quer h2 .rand, .quer h3 .nr, .quer h3 .rand { display: none; }
.quer .unterschriften, .quer .inhalt-uebersicht { margin-left: 0; }

/* ---------------- Brief (DIN 5008 Form B) */
body.g-brief { padding-left: 5mm; padding-right: 10mm; }
.g-brief .kopf { position: relative; height: 33mm; }
.g-brief .kopf .marke { position: absolute; left: 0; top: 4mm; }
.g-brief .kopf .marke .name { font-size: 17pt; line-height: 1.05; font-weight: 600; color: var(--akzent); letter-spacing: -0.15pt; }
.g-brief .kopf .marke .zusatz { font-size: 8pt; color: #4a535c; margin-top: 1.2mm; }
.g-brief .kopf .logo { position: absolute; right: 0; top: 3mm; max-height: 22mm; max-width: 60mm; }
.g-brief .fenster { position: relative; min-height: 45mm; display: flex; align-items: flex-start; }
/* Anschriftfeld 85 × 45 mm; eine zu lange Anschrift schiebt den Betreff nach unten statt ihn zu überdecken */
.g-brief .anschrift { position: relative; left: -5mm; flex: none; width: 85mm; min-height: 45mm; padding-left: 5mm; }
.g-brief .anschrift .ruecksendung { height: 5mm; padding-top: 1.4mm; font-size: 6.6pt; color: #4a535c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-brief .anschrift .vermerk { height: 12.7mm; font-size: 7.6pt; color: #4a535c; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 1mm; }
.g-brief .anschrift .empf { font-size: 10pt; line-height: 1.25; }
.g-brief .anschrift .empf.eng { font-size: 9pt; line-height: 1.2; }
.g-brief .anschrift .empf.enger { font-size: 8pt; line-height: 1.18; }
/* Informationsblock 125–200 mm vom linken Blattrand; im Fluss, damit ein langer Block den Betreff nach unten schiebt */
.g-brief .info { flex: none; margin: 5mm 0 0 15mm; width: 75mm; font-size: 8.2pt; }
.g-brief .info table td { padding: 0.3mm 0; line-height: 1.3; vertical-align: top; overflow-wrap: anywhere; }
.g-brief .info .fuellen { min-width: 0; width: 38mm; }
.g-brief .info table td:first-child { color: #4a535c; width: 31mm; padding-right: 2mm; }
.g-brief .betreff { margin: 6mm 0 4.5mm; font-size: 12.5pt; font-weight: 700; color: #12161b; }
.g-brief .betreff span { display: block; font-size: 9pt; font-weight: 400; color: #4a535c; margin-top: 0.8mm; }
.g-brief .anrede { margin: 0 0 3.5mm; }
.g-brief table.liste th { border-bottom-width: 1.2pt; }
.g-brief table.liste td { padding-top: 1.6mm; padding-bottom: 1.6mm; }
.g-brief .zahlung { margin-top: 5mm; display: flex; gap: 5mm; align-items: stretch; background: var(--akzent-hauch); border-left: 2pt solid var(--akzent); padding: 3mm 3.5mm; }
.g-brief .zahlung .qr { flex: 0 0 auto; background: #fff; padding: 1.5mm; align-self: flex-start; }
.g-brief .zahlung .qr svg { display: block; }
.g-brief .zahlung .qr small { display: block; text-align: center; font-size: 6.4pt; color: #4a535c; margin-top: 1mm; }
.g-brief .zahlung .text { flex: 1; }
.g-brief .zahlung p:last-child { margin: 0; }
.g-brief .schluss { page-break-inside: avoid; break-inside: avoid; }
.g-brief .gruss { margin-top: 4.5mm; }
.g-brief .gruss p { margin-bottom: 1.4mm; }

/* ---------------- Vertrag */
.g-vertrag { font-family: ${SERIF}; font-size: 10pt; line-height: 1.55; }
/* Flattersatz: Chromium trennt ohne Wörterbuch nicht deutsch, Blocksatz risse große Lücken */
.g-vertrag p, .g-vertrag li { text-align: left; }
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
.g-aushang.ba .unterschriften { margin-top: 4mm; }
.g-aushang.ba .unterschrift .linie { height: 9mm; }
.g-aushang.ba .notruf .fuellen { min-width: 70mm; }
/* Betriebsanweisung mit viel Text: kleinerer Satz, damit sie auf ein Blatt passt */
.g-aushang.ba.kompakt { line-height: 1.3; }
.g-aushang.ba.kompakt .titelband { margin-top: 3.5mm; }
.g-aushang.ba.kompakt .titelband .t { font-size: 16pt; padding: 1.8mm 4mm; }
.g-aushang.ba.kompakt .kasten { margin-top: 1.8mm; }
.g-aushang.ba.kompakt .kasten h2 { font-size: 9.8pt; padding: 1.2mm 3.5mm; }
.g-aushang.ba.kompakt .kasten .inhalt { font-size: 9.2pt; padding: 1.8mm 3.5mm 0.6mm; }
.g-aushang.ba.kompakt .kasten .inhalt p { margin-bottom: 1.2mm; }
.g-aushang.ba.kompakt .kasten .inhalt ul.punkte { margin-bottom: 1.2mm; }
.g-aushang.ba.kompakt .kasten .inhalt ul.punkte li { margin-bottom: 0.5mm; }
.g-aushang.ba.kompakt .kasten.stoff .inhalt dd { font-size: 10pt; }
.g-aushang.ba.kompakt .notruf { font-size: 10pt; padding: 1.6mm 3.5mm; }
.g-aushang.ba.kompakt .unterschriften { margin-top: 3mm; }
.g-aushang.ba.kompakt .unterschrift .linie { height: 8mm; }
/* Aushang mit viel Text: kompakter Satz, damit er auf möglichst wenige Blätter passt */
.g-aushang.kompakt table.liste { font-size: 8.8pt; line-height: 1.32; }
.g-aushang.kompakt table.liste th { font-size: 7.8pt; padding: 1.6mm 2mm 1.4mm; }
.g-aushang.kompakt table.liste td { padding: 1.7mm 2mm; }
.g-aushang.kompakt h1 { font-size: 22pt; margin-top: 4mm; }
.g-aushang.kompakt .unter { font-size: 11pt; margin-bottom: 3mm; }
.g-aushang.kompakt .kennung { margin-bottom: 3.5mm; }
/* Lohnkonto: viele Betragsspalten im Querformat */
table.liste.eng { font-size: 7.8pt; }
table.liste.eng th, table.liste.eng td { padding-left: 1.2mm; padding-right: 1.2mm; }
/* Allergen-Matrix: eine Zeile je Speise, eine Spalte je Allergen (Bezeichnung senkrecht) */
.g-aushang table.liste.matrix th.dreh { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; text-align: left; vertical-align: middle; padding: 2mm 0.6mm; font-size: 7.6pt; line-height: 1.1; }
.g-aushang table.liste.matrix td.x { text-align: center; font-weight: 700; padding-left: 0; padding-right: 0; }
.g-aushang table.liste.matrix td.x, .g-aushang table.liste.matrix th.dreh { border-left: 0.5pt solid #dde1e5; }
.g-aushang table.liste.matrix tr.gruppe td { background: var(--akzent-hauch); padding-top: 1.6mm; padding-bottom: 1.4mm; }
/* Kategorie nicht allein am Seitenende: je Kategorie eine Zeilengruppe, die möglichst nicht umbricht */
.matrix tr.gruppe { page-break-after: avoid; break-after: avoid; }
.matrix tbody.gruppe-block { page-break-inside: avoid; break-inside: avoid; }
.g-aushang .nachsatz { font-size: 9pt; }
.g-aushang table.liste.legende { font-size: 8.6pt; }
.g-aushang table.liste.legende th { font-size: 7.6pt; }
.g-aushang table.liste.legende td { padding: 1.6mm 2.4mm; }

/* ---------------- Formular (Zusammenstellung für ein amtliches Formular) */
.g-formular h2 { background: var(--akzent-hauch); padding: 1.6mm 2.6mm; border: 0; font-size: 10.8pt; margin-top: 1mm; }
.g-formular section.abschnitt > h2::before { min-width: 7mm; }
.g-formular .abschnitt { margin-top: 5.5mm; }
.g-formular .bilanz { display: flex; gap: 8mm; page-break-inside: avoid; break-inside: avoid; }
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
/* im Handbuchsatz zu lang zum Zusammenhalten (siehe kurzerAbschnitt): darf umbrechen, die Überschrift bleibt beim Text */
.g-handbuch section.abschnitt.zusammen.lang-im-handbuch { page-break-inside: auto; break-inside: auto; }
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
    [t(b.bank) ? `**${t(b.bank)}**` : t(b.iban) ? "**Bankverbindung**" : "", t(b.iban) ? `IBAN ${ibanText(t(b.iban))}` : "", t(b.bic) ? `BIC ${t(b.bic)}` : ""],
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

const LEERE_TAGS = new Set(["br", "img", "col", "hr", "meta", "input", "wbr"]);

/** Oberste Elemente eines HTML-Abschnitts als [Anfang, Ende] (für den selbst erzeugten, wohlgeformten Inhalt). */
function obersteElemente(html: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*?(\/?)>/g;
  let tiefe = 0;
  let start = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const name = m[2]!.toLowerCase();
    if (LEERE_TAGS.has(name) || m[3]) {
      if (tiefe === 0) out.push([m.index, re.lastIndex]);
      continue;
    }
    if (m[1]) {
      tiefe--;
      if (tiefe === 0 && start >= 0) out.push([start, re.lastIndex]);
    } else {
      if (tiefe === 0) start = m.index;
      tiefe++;
    }
  }
  return out;
}

/**
 * Unterschriften nicht allein auf eine neue Seite: Der Unterschriftsblock wird mit dem kurzen Text davor (Erklärung,
 * Hinweis, Notruf, letzter Abschnitt ohne Listentabelle) zu einem Schlussblock zusammengefasst, der nicht umbricht.
 */
export function schlussZusammen(inhalt: string): string {
  const i = inhalt.lastIndexOf('<div class="unterschriften');
  if (i < 0) return inhalt;
  const davor = inhalt.slice(0, i);
  const teile = obersteElemente(davor);
  let ab = i;
  for (let k = teile.length - 1, genommen = 0; k >= 0 && genommen < 2; k--) {
    const [a, e] = teile[k]!;
    if (inhalt.slice(e, ab).trim()) break;
    const el = davor.slice(a, e);
    const kurz = /^<(p|div class="notruf)/.test(el) && el.length < 1500;
    const abschnittOhneListe = /^<section class="abschnitt/.test(el) && (!el.includes('class="liste') || el.includes('class="bilanz"')) && el.length < 6000;
    // ein kurzer Absatz reicht als Zusammenhang; ein ganzer Abschnitt nur, wenn direkt davor nichts Kurzes steht
    if (!kurz && !(abschnittOhneListe && genommen === 0)) break;
    ab = a;
    genommen++;
    if (abschnittOhneListe) break;
  }
  const rest = inhalt.slice(i);
  const ende = obersteElemente(rest)[0]?.[1] ?? rest.length;
  let vorne = inhalt.slice(0, ab);
  const mit = inhalt.slice(ab, i);
  let klasse = "schlussblock";
  // Endet der Text davor mit einer Listentabelle (Teilnahme, Plan, Kassenbuch mit Summenzeile), bleibt deren letzte
  // Zeile samt Summenzeile (tfoot) beim Schlussblock: Sie kommt in eine eigene Zeilengruppe derselben Tabelle, die nicht
  // umbricht, und der Schlussblock schließt ohne Umbruch an. So wiederholt sich auf der neuen Seite der Tabellenkopf
  // (Spalten bleiben beschriftet), ohne dass er auf derselben Seite doppelt erscheint.
  if (!mit.trim()) {
    const start = vorne.lastIndexOf('<table class="liste');
    const fuss = start >= 0 ? /<\/tbody>(<tfoot>(?:(?!<\/?table)[\s\S])*?<\/tfoot>)?<\/table>(<\/section>)?\s*$/.exec(vorne) : null;
    const tbodyEnde = fuss && fuss.index > start ? fuss.index : -1;
    const tbodyTag = tbodyEnde >= 0 ? vorne.lastIndexOf("<tbody", tbodyEnde) : -1;
    const tbodyAnfang = tbodyTag >= 0 ? vorne.indexOf(">", tbodyTag) + 1 : -1;
    // die Tabelle hat schon eine Schlussgruppe (tabelle(…, { schluss })): die bleibt so beim Schlussblock
    if (tbodyTag > start && vorne.startsWith('<tbody class="schluss">', tbodyTag)) return `${vorne}<div class="${klasse} nach-tabelle">${rest.slice(0, ende)}</div>${rest.slice(ende)}`;
    // letzte Zeile mit Inhalt samt den leeren Zeilen danach (höchstens drei Zeilen); davor bleibt mindestens eine Zeile
    let letzte = tbodyAnfang > start ? vorne.lastIndexOf("<tr>", tbodyEnde) : -1;
    for (let n = 1; letzte > tbodyAnfang && n < 3 && !vorne.slice(letzte, tbodyEnde).replace(/<[^>]*>|&nbsp;|\s/g, ""); n++) letzte = vorne.lastIndexOf("<tr>", letzte - 1);
    if (letzte > tbodyAnfang) {
      vorne = `${vorne.slice(0, letzte)}</tbody><tbody class="schluss">${vorne.slice(letzte)}`;
      klasse += " nach-tabelle";
    } else if (tbodyEnde >= 0) klasse += " nach-tabelle";
  }
  return `${vorne}<div class="${klasse}">${mit}${rest.slice(0, ende)}</div>${rest.slice(ende)}`;
}

/** Gesetzeskürzel, die nicht von der Nummer davor getrennt werden („Art. 32 DSGVO“, „§ 147 AO“). */
const GESETZE = "DSGVO|BDSG|AO|HGB|BGB|EStG|UStG|GewO|ArbSchG|ArbZG|MuSchG|GefStoffV|BetrSichV|TDDDG|LMIV|LMIDV|IfSG|SGB|NachwG|MiLoG|GmbHG|KassenSichV";
const FEST: [RegExp, string][] = [
  // Zahl und Einheit: „19 %“, „12,50 €“, „121 °C“
  [/(\d) (%|€|°C)/g, "$1&nbsp;$2"],
  // Verweiszeichen vor Nummer, römischer Zahl oder Buchstabe: „§ 43“, „§§ 5“, „Art. 32“, „Abs. 2“, „Nr. 1“, „lit. g“, „UAbs. 1“
  [/(§§?|\bArt\.|\bAbs\.|\bUAbs\.|\bNr\.|\blit\.|\bSatz) (?=\d|[IVXLC]+(?![\wäöüÄÖÜß])|[a-z](?![\wäöüß]))/g, "$1&nbsp;"],
  // Nummer bzw. Buchstabe und Gesetz: „32 DSGVO“, „lit. b DSGVO“; „SGB IV“
  [new RegExp(`(\\d[a-z]?|\\b[a-z]) (${GESETZE})(?![\\wäöüß])`, "g"), "$1&nbsp;$2"],
  [/\bSGB (?=[IVX]+(?![\wäöüß]))/g, "SGB&nbsp;"],
  // Regelwerke mit Nummer: „DGUV Vorschrift 1“, „DGUV Information 211-010“, „TRGS 555“
  [/\bDGUV (Vorschrift|Information|Regel) (?=\d)/g, "DGUV&nbsp;$1&nbsp;"],
  [/\b(Vorschrift|TRGS|TRBS|DIN|VDE) (?=\d)/g, "$1&nbsp;"],
];
/**
 * Feste Leerzeichen, wo ein Zeilenumbruch den Bezug zerreißt (Zahl und Einheit, Paragraf und Nummer, Nummer und
 * Gesetz) – nur im Text, nie in Tags.
 */
export function festeLeerzeichen(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((teil, i) => (i % 2 ? teil : FEST.reduce((t, [re, ers]) => t.replace(re, ers), teil)))
    .join("");
}

/** Ganzes Dokument: Kopfzeile des Betriebs, Titel, Kennungsleiste, Inhalt. Die Gestalt setzt dokumentHtml(). */
export function dokument(o: DokumentOptionen): string {
  const b = o.betrieb;
  const kontakt = [b.telefon, b.email].filter((x) => x.trim()).join(" · ");
  const adresse = [anschrift(b), kontakt].filter(Boolean).join(" · ");
  const kopfDaten = kopfZeilen(o.meta);
  const stand = kopfDaten.find(([k, v]) => v !== KOPF_LINIE && /^(stand|datum|rechnungsdatum|prüfdatum|ausgestellt|bekannt seit)/i.test(k))?.[1] ?? "";
  const fussLinks = [b.name.trim(), o.titel].filter(Boolean).join(" · ");
  const g = o.gestalt ?? GESTALT_MARKE;
  const klassen = [`g-${g}`, o.quer ? "quer" : "", o.nummerierung === "zahl" ? "nummern-zahl" : "", o.klasse ?? ""].filter(Boolean).join(" ");
  return `${kopf({ titel: o.titel, betrieb: b, fussLinks, fussRechts: stand ? `Stand ${stand}` : "", quer: o.quer, gestalt: o.gestalt, band: o.band })}<body class="${klassen}">
<header class="kopfzeile"><div><div class="name">${b.name.trim() ? esc(b.name.trim()) : LINIE}</div>${adresse ? `<div class="adresse">${esc(adresse)}</div>` : ""}</div><div class="rechts"><div class="art">${esc(o.art ?? "")}</div>${logoHtml(b)}</div></header>
${o.vorTitel ?? ""}${festeLeerzeichen(`<h1>${esc(o.titel)}</h1>${o.unter ? `<p class="unter">${esc(o.unter)}</p>` : ""}`)}
<dl class="kennung">${GRUNDLAGE_MARKE}${festeLeerzeichen(kopfDaten.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === KOPF_LINIE ? LINIE : esc(v)}</dd></div>`).join(""))}</dl>
<main>${festeLeerzeichen(schlussZusammen(o.inhalt))}</main>
${fussHtml(b)}
</body></html>`;
}

/** Zeilen der Empfängeranschrift, wie sie im Fenster umbrechen (ca. 44 Zeichen je Zeile bei 10 pt). */
function anschriftZeilen(t: string[], proZeile: number): number {
  return t.reduce((n, z) => n + Math.max(1, Math.ceil(z.length / proZeile)), 0);
}

/**
 * Geschäftsbrief nach DIN 5008 Form B (E-129/E-130): Briefkopf (Logo bzw. Name in der Hausfarbe), Rücksendeangabe und
 * Anschrift im Fenster (45 mm von oben, 20 mm von links, 85 × 45 mm), Informationsblock rechts daneben, Betreff,
 * Inhalt. Die Fußzeile mit Anschrift, Kontakt, Bank, Steuer und Register setzt die App auf jede Seite.
 */
export function brief(o: { titel: string; betreff: string; unterBetreff?: string; betrieb: Betrieb; empfaenger: { name: string; anschrift: string; zusatz?: string }; info: [string, string, boolean?][]; anrede?: string; inhalt: string; vermerk?: string; stand?: string }): string {
  const b = o.betrieb;
  const logo = logoHtml(b);
  const zusatz = [anschrift(b)].filter(Boolean).join("");
  // Rücksendeangabe: eine Zeile im 5-mm-Feld; ist sie zu lang, nur Name und Ort
  const ortZeile = [b.plz.trim(), b.ort.trim()].filter(Boolean).join(" ");
  const voll = [b.name.trim(), b.strasse.trim(), ortZeile].filter(Boolean).join(" · ");
  const ruecksendung = voll.length <= 72 ? voll : [b.name.trim(), b.ort.trim()].filter(Boolean).join(" · ");
  const zeilenEmpf = [o.empfaenger.name.trim(), ...o.empfaenger.anschrift.trim().split("\n"), o.empfaenger.zusatz ?? ""].map((z) => z.trim()).filter(Boolean);
  // DIN 5008: Anschriftzone 27,3 mm – bis 6 Zeilen in 10 pt, sonst kleiner; die Anschrift wird nie gekürzt
  const eng = anschriftZeilen(zeilenEmpf, 44) <= 6 ? "" : anschriftZeilen(zeilenEmpf, 49) <= 7 ? " eng" : " enger";
  const empf = `${o.empfaenger.name.trim() ? `${esc(o.empfaenger.name.trim())}<br>` : LINIE}${o.empfaenger.anschrift.trim() ? esc(o.empfaenger.anschrift.trim()).replace(/\n/g, "<br>") : LINIE}${o.empfaenger.zusatz ? `<br><span style="font-size:8pt;color:#4a535c">${esc(o.empfaenger.zusatz)}</span>` : ""}`;
  // leere Angaben entfallen; mit drittem Eintrag `true` bleibt eine Linie zum Ausfüllen (z. B. Rechnungsnummer)
  const info = o.info.filter(([, w, linie]) => w.trim() || linie);
  return `${kopf({ titel: o.titel, betrieb: b, fussLinks: [b.name.trim(), o.titel].filter(Boolean).join(" · "), fussRechts: o.stand ? `Stand ${o.stand}` : "", gestalt: "brief" })}<body class="g-brief">
<header class="kopf">${logo}<div class="marke"${logo ? ' style="right:65mm"' : ""}><div class="name">${b.name.trim() ? esc(b.name.trim()) : LINIE}</div>${zusatz ? `<div class="zusatz">${esc(zusatz)}</div>` : ""}</div></header>
<div class="fenster"><div class="anschrift"><div class="ruecksendung">${esc(ruecksendung)}</div><div class="vermerk">${o.vermerk ? esc(o.vermerk) : ""}</div><div class="empf${eng}">${empf}</div></div>
<div class="info"><table>${info.map(([k, w]) => `<tr><td>${esc(k)}</td><td>${w.trim() ? esc(w) : LINIE}</td></tr>`).join("")}</table></div></div>
<h1 class="betreff">${esc(o.betreff)}${o.unterBetreff ? `<span>${esc(o.unterBetreff)}</span>` : ""}</h1>
${o.anrede ? `<p class="anrede">${esc(o.anrede)}</p>` : ""}<main>${festeLeerzeichen(o.inhalt)}</main>
${fussHtml(b)}
</body></html>`;
}

// ---------------------------------------------------------------- Geld und Zahlen

/** „1.234,56“ / „1234.56“ / „12“ → Zahl; leer oder unlesbar → null. */
function lesen(t: string | null | undefined): number | null {
  if (typeof t !== "string") return null;
  let s = t.replace(/\s|€/g, "");
  if (s === "") return null;
  if (/,\d{1,2}$/.test(s) || s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // auch „-1.500“ (Storno, Nachlass)
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
/** „1.234,56“ / „1234.56“ / „12“ → Cent; leer oder unlesbar → null. */
export function cent(t: string | null | undefined): number | null {
  const n = lesen(t);
  // erst auf Zehntel-Cent glätten (Gleitkomma: 1,005 × 100 = 100,4999…), dann kaufmännisch und für negative Beträge spiegelbildlich runden
  return n === null ? null : rundeCent(Math.round(n * 10_000) / 100);
}
/** Zahl wie „1,5“ oder „2,345“ (Menge in kg) → 1.5 bzw. 2.345 – bis vier Nachkommastellen; leer oder unlesbar → null. */
export function zahl(t: string | null | undefined): number | null {
  const n = lesen(t);
  return n === null ? null : Math.round(n * 10_000) / 10_000;
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
