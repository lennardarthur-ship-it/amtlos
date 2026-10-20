/**
 * Kontrollmappe: die aktuellen Nachweise für eine Kontrolle (Arbeitsschutz, Hygiene, Lebensmittel, Datenschutz,
 * Personal-Nachweise) in einem PDF – Deckblatt mit Inhaltsverzeichnis, danach die Unterlagen. Reine Funktionen (Auswahl,
 * Deckblatt, Zusammenfügen mit pdf-lib); die einzelnen PDFs erzeugt der Aufrufer auf dem Gerät.
 * Nicht in der Mappe: Rechnungen, Belege, Steuer- und Buchhaltungsunterlagen, Register- und Website-Texte.
 */
// CommonJS-Build wie in fusszeile.ts: die ESM-Variante von pdf-lib lässt sich von Metro nicht auflösen
import { PDFDocument } from "pdf-lib/cjs/index";
import { BEREICHE, dateinamenTeil, unterlagenName, vorlageFuer, type Bereich, type Vorlage } from "@amtlos/fachlogik";
import { fehltFuer } from "./pruefung";
import { nichtZaehlend, type Stand, type Unterlage } from "./speicher";

/** Bereiche, deren Unterlagen bei Kontrollen (Gewerbeaufsicht, BG, Lebensmittelüberwachung, Datenschutz) vorzulegen sind */
const MAPPE_BEREICHE: Bereich[] = ["arbeitsschutz", "beauty", "gastro", "personal", "datenschutz"];
/** aus „Personal“ nur die Nachweise – Lohnkonto und Personalfragebogen sind Lohn- bzw. Meldedaten, keine Kontrollnachweise */
const PERSONAL_NACHWEISE = new Set(["arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ki_kompetenz"]);
/** Text für die eigene Website, kein Nachweis */
const NICHT_IN_MAPPE = new Set(["datenschutzerklaerung_website"]);
/** Namensfelder, die nur den Zeitraum bzw. Tag benennen: dann zählt nur die neueste Fassung (z. B. HACCP je Monat) */
const ZEIT_FELDER = new Set(["zeitraum", "datum", "jahr", "stichtag"]);
/** Datum, das eine Unterlage trägt („Stand“, „Datum“) – in dieser Reihenfolge */
const DATUM_FELDER = ["stand", "datum", "ausgestellt_am", "entdeckt_am"];

/** Gehört eine Vorlage in die Kontrollmappe? Nach Bereich; Kundendokumente und Festgeschriebenes (Rechnung, Kassenbuch) nie. */
export function gehoertInMappe(v: Vorlage): boolean {
  if (v.kundendokument || v.festschreiben || NICHT_IN_MAPPE.has(v.id)) return false;
  if (v.bereich === "personal") return PERSONAL_NACHWEISE.has(v.id);
  return MAPPE_BEREICHE.includes(v.bereich);
}

export interface MappenEintrag {
  id: string;
  vorlage: string;
  titel: string;
  bereich: Bereich;
  /** Datum der Unterlage (YYYY-MM-DD): Stand bzw. Datum im Dokument, sonst wann geteilt bzw. zuletzt geändert */
  datum: string;
  /** schon geteilt oder gedruckt (sonst: vollständig, aber noch nicht ausgegeben) */
  geteilt: boolean;
}

export interface MappenAuswahl {
  eintraege: MappenEintrag[];
  /** Unterlagen passender Vorlagen, die weder geteilt noch vollständig sind – sie fehlen in der Mappe */
  unvollstaendig: number;
}

const istDatum = (w: unknown): w is string => typeof w === "string" && /^\d{4}-\d{2}-\d{2}/.test(w);

function datumVon(u: Unterlage): string {
  for (const k of DATUM_FELDER) if (istDatum(u.daten[k])) return (u.daten[k] as string).slice(0, 10);
  return (u.ausgegeben ?? u.geaendert).slice(0, 10);
}

/**
 * Weiteres Feld, das bei Vorlagen mit Zeitangabe als Namensfeld eigene Fassungen trennt: Prüfprotokolle je
 * Einsatzbereich (z. B. Werkstatt und Baustelle) – sonst stünde nur das neueste Protokoll in der Mappe.
 */
const GRUPPE_ZUSATZ: Record<string, string> = { pruefprotokoll_elektro: "einsatz" };

/** Gruppe einer Unterlage: Vorlage plus Namensfeld (Arbeitsbereich, Thema, Person …) – Zeitangaben fassen zusammen. */
function gruppe(v: Vorlage, u: Unterlage): string {
  const feld = v.namensFeld && !ZEIT_FELDER.has(v.namensFeld) ? u.daten[v.namensFeld] : null;
  const name = typeof feld === "string" ? feld.trim().split("\n")[0]!.toLocaleLowerCase("de") : "";
  const z = GRUPPE_ZUSATZ[v.id] ? u.daten[GRUPPE_ZUSATZ[v.id]!] : null;
  return `${v.id}\u0000${name}${typeof z === "string" && z.trim() ? `\u0000${z.trim().toLocaleLowerCase("de")}` : ""}`;
}

/**
 * Je Vorlage (und Namensfeld) die neueste geteilte Unterlage; ist keine geteilt, die neueste vollständige. Sortiert nach
 * Bereich (Reihenfolge wie in „Vorlagen“) und Titel.
 */
export function mappenAuswahl(s: Stand): MappenAuswahl {
  const beste = new Map<string, { u: Unterlage; v: Vorlage; geteilt: boolean; zeit: string }>();
  const ohne = new Set<string>();
  // Konfliktkopien (K1) gelten nicht – in die Mappe kommt nur die gültige Fassung
  const aus = nichtZaehlend(s.unterlagen);
  for (const u of s.unterlagen) {
    if (aus.has(u.id)) continue;
    const v = vorlageFuer(u.vorlage);
    if (!v || !gehoertInMappe(v)) continue;
    const geteilt = Boolean(u.ausgegeben || u.festgeschrieben);
    const g = gruppe(v, u);
    if (!geteilt && fehltFuer(s, u).length) {
      ohne.add(u.id);
      continue;
    }
    const zeit = geteilt ? (u.ausgegeben ?? u.festgeschrieben)! : u.geaendert;
    const bisher = beste.get(g);
    // geteilt schlägt vollständig; sonst die jüngere
    if (!bisher || (geteilt && !bisher.geteilt) || (geteilt === bisher.geteilt && zeit > bisher.zeit)) beste.set(g, { u, v, geteilt, zeit });
  }
  const rang = (b: Bereich) => BEREICHE.findIndex((x) => x.id === b);
  const eintraege = [...beste.values()]
    .map(({ u, v, geteilt }) => ({ id: u.id, vorlage: v.id, titel: unterlagenName(v, u.daten), bereich: v.bereich, datum: datumVon(u), geteilt }))
    .sort((a, b) => rang(a.bereich) - rang(b.bereich) || a.titel.localeCompare(b.titel, "de") || b.datum.localeCompare(a.datum));
  // eine unvollständige Unterlage zählt nicht als fehlend, wenn ihre Gruppe schon eine bessere Fassung hat
  const vertreten = new Set([...beste.keys()]);
  let unvollstaendig = 0;
  for (const id of ohne) {
    const u = s.unterlagen.find((x) => x.id === id)!;
    if (!vertreten.has(gruppe(vorlageFuer(u.vorlage)!, u))) unvollstaendig++;
  }
  return { eintraege, unvollstaendig };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const bereichTitel = (b: Bereich) => BEREICHE.find((x) => x.id === b)?.titel ?? "";

/**
 * Deckblatt: Betrieb, Datum, Inhaltsverzeichnis mit Titel, Datum und – wenn bekannt – Seite in der Mappe. Die Meta-Tags
 * geben der Fußzeile (fusszeile.ts) Betrieb und Stand.
 */
export function deckblattHtml(betrieb: string, heute: string, eintraege: (MappenEintrag & { seite?: number })[]): string {
  const name = betrieb.trim() || "Betrieb";
  // viele Einträge: engere Zeilen, damit das Inhaltsverzeichnis nicht mit wenigen Zeilen auf eine zweite Seite läuft
  const eng = eintraege.length > 9;
  const zeilen = eintraege
    .map((e, i) => `<tr><td class="nr">${i + 1}</td><td><div class="t">${esc(e.titel)}</div><div class="b">${esc(bereichTitel(e.bereich))}</div></td><td class="d">${datumDe(e.datum)}</td><td class="s">${e.seite ?? ""}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Kontrollmappe</title>
<meta name="amtlos-gestalt" content="nachweis"><meta name="amtlos-fuss-links" content="${esc(`${name} · Kontrollmappe`)}"><meta name="amtlos-fuss-rechts" content="${esc(`Stand ${datumDe(heute)}`)}">
<style>
body{font-family:"Amtlos Sans",Helvetica,Arial,sans-serif;color:#1f2a33;font-size:10.5pt;margin:0}
.art{font-size:9pt;letter-spacing:.08em;text-transform:uppercase;color:#5b6670}
h1{font-family:"Amtlos Serif",Georgia,serif;font-size:26pt;margin:6mm 0 2mm}
.betrieb{font-size:14pt;font-weight:600;margin:0}
.stand{color:#5b6670;margin:1mm 0 10mm}
h2{font-size:11pt;margin:0 0 3mm;text-transform:uppercase;letter-spacing:.06em;color:#5b6670}
table{width:100%;border-collapse:collapse}
td{padding:2.4mm 2mm;border-bottom:.3mm solid #d6dbe0;vertical-align:top}
td.nr{width:8mm;color:#5b6670}td.d{width:24mm;white-space:nowrap}td.s{width:14mm;text-align:right;white-space:nowrap}
th{font-size:8.5pt;font-weight:600;text-align:left;color:#5b6670;padding:0 2mm 1.5mm;border-bottom:.4mm solid #1f2a33}
th.s{text-align:right}
.t{font-weight:600}.b{font-size:8.5pt;color:#5b6670;margin-top:.5mm}
.hinweis{margin-top:8mm;font-size:8.5pt;color:#5b6670}
body.eng h1{margin:3mm 0 1mm;font-size:22pt}body.eng .stand{margin-bottom:6mm}body.eng td{padding:1.5mm 2mm}body.eng .hinweis{margin-top:5mm}
</style></head><body class="g-nachweis${eng ? " eng" : ""}">
<div class="art">Kontrollmappe</div>
<h1>Nachweise des Betriebs</h1>
<p class="betrieb">${esc(name)}</p>
<p class="stand">Zusammengestellt am ${datumDe(heute)} · ${eintraege.length} ${eintraege.length === 1 ? "Unterlage" : "Unterlagen"}</p>
<h2>Inhalt</h2>
<table><thead><tr><th></th><th>Unterlage</th><th>Datum</th><th class="s">Seite</th></tr></thead><tbody>${zeilen}</tbody></table>
<p class="hinweis">Jede Unterlage folgt mit eigener Fußzeile und eigenen Seitenzahlen; die Seite im Inhalt zählt die Mappe von vorn.</p>
</body></html>`;
}

/** Seitenzahl eines PDFs. */
export async function seitenzahl(pdf: Uint8Array): Promise<number> {
  return (await PDFDocument.load(pdf)).getPageCount();
}

/** Seite, auf der jede Unterlage in der Mappe beginnt (1-basiert), nach einem Deckblatt mit `deckblatt` Seiten. */
export function startSeiten(deckblatt: number, seiten: number[]): number[] {
  let n = deckblatt + 1;
  return seiten.map((x) => {
    const s = n;
    n += x;
    return s;
  });
}

/** Fügt die PDFs in dieser Reihenfolge zu einem zusammen. */
export async function mappeZusammenfuegen(teile: Uint8Array[], titel = "Kontrollmappe"): Promise<Uint8Array> {
  const ziel = await PDFDocument.create();
  for (const t of teile) {
    const quelle = await PDFDocument.load(t);
    const seiten = await ziel.copyPages(quelle, quelle.getPageIndices());
    for (const s of seiten) ziel.addPage(s);
  }
  ziel.setTitle(titel);
  ziel.setCreator("Amtlos");
  return ziel.save();
}

/** Dateiname der Mappe: Kontrollmappe_<Betrieb>_<Datum>.pdf */
export const mappeDateiname = (betrieb: string, heute: string) => `Kontrollmappe_${dateinamenTeil(betrieb, 40, "._-") || "Betrieb"}_${heute}.pdf`;
