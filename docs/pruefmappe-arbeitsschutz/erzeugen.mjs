/**
 * Prüfmappe für die Prüfung durch eine Fachkraft für Arbeitssicherheit bzw. Betriebsärztin/Betriebsarzt erzeugen (analog
 * docs/pruefmappe-anwalt und docs/pruefmappe-steuer): Arbeitsschutz-Vorlagen als PDF, alle vorformulierten Bausteine der
 * Arbeitsschutz-Vorlagen je Branchengruppe mit Quelle und Markierung (Markdown und CSV), Katalogeinträge zum Arbeitsschutz
 * als CSV und der Prüflisten-Auszug.
 *
 *   node docs/pruefmappe-arbeitsschutz/erzeugen.mjs <ziel>      # z. B. /tmp/pruefmappe-arbeitsschutz
 *
 * Voraussetzung: `pnpm install`, Chromium (wie werkzeuge/dokumente-pruefen.mjs), pdftotext optional. Die Fachlogik wird
 * mit esbuild aus den Quellen gebündelt (ohne Typprüfung, ohne dist/). Schreibt nichts ins Repository.
 */
/* global process, console, URL */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HIER, "../..");
const APP = path.join(ROOT, "apps/mobile");
const DOK = path.join(ROOT, "packages/fachlogik/src/dokumente");
const ZIEL = path.resolve(process.argv[2] ?? "pruefmappe-arbeitsschutz");
const ROH = path.join(ZIEL, ".roh");
fs.mkdirSync(ROH, { recursive: true });
const kopiere = (von, nach) => {
  fs.mkdirSync(path.dirname(nach), { recursive: true });
  fs.copyFileSync(von, nach);
};
const zelle = (t) => `"${String(t ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const csv = (zeilen) => "﻿" + zeilen.map((z) => z.map(zelle).join(";")).join("\n") + "\n";
const md = (t) => String(t ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

// 0. Fachlogik (Vorlagen und Bausteine) aus den Quellen bündeln – wie werkzeuge/dokumente-pruefen.mjs
const pnpm = path.join(ROOT, "node_modules/.pnpm");
const esb = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
const eintrag = path.join(ROH, "eintrag.ts");
const gebaut = path.join(ROH, "fachlogik.mjs");
fs.writeFileSync(eintrag, `export * from "${path.join(DOK, "index.ts")}";\nexport * as BS from "${path.join(DOK, "bausteine.ts")}";\n`);
execFileSync(path.join(pnpm, esb, "node_modules/esbuild/bin/esbuild"), [eintrag, "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const F = await import(gebaut);

// 1. Vorlagen (leer, Auswahl, voll) über das vorhandene Prüfwerkzeug; Bereich „arbeitsschutz“ laut VORLAGEN und der
//    Hautschutzplan (Bereich „beauty“, fachlich Arbeitsschutz: TRGS 401)
const VORLAGEN = F.VORLAGEN.filter((v) => v.bereich === "arbeitsschutz" || v.id === "hautschutzplan");
const alle = path.join(ROH, "vorlagen");
const lauf = spawnSync("node", [path.join(APP, "werkzeuge/dokumente-pruefen.mjs"), alle], { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
// Exit-Code 1 heißt „Befunde zum Satzspiegel“ – die PDFs sind trotzdem da; nur die Befunde zu diesen Vorlagen melden
const befunde = (lauf.stdout ?? "").split("\n").filter((z) => VORLAGEN.some((v) => z.startsWith(`${v.id}-`)));
const vorlagen = path.join(ZIEL, "vorlagen");
fs.rmSync(vorlagen, { recursive: true, force: true });
const fehlendeVorlagen = [];
for (const v of VORLAGEN) {
  const dateien = fs.existsSync(alle) ? fs.readdirSync(alle).filter((f) => f.startsWith(`${v.id}-`) && f.endsWith(".pdf")) : [];
  if (!dateien.length) fehlendeVorlagen.push(v.id);
  for (const f of dateien) kopiere(path.join(alle, f), path.join(vorlagen, f));
}

// 2. Bausteine: alles, was die App in diesen Vorlagen zum Antippen anbietet (Vorschläge für Listeneinträge, Textbausteine,
//    Formulierungen), mit Kurzbeleg. Wo die Vorlage nur den Text übernimmt (Betriebsanweisung, Prüffristen), kommen Quelle
//    und „unsicher“ aus bausteine.ts.
const ausBausteinen = new Map();
for (const wert of Object.values(F.BS)) {
  const listen = Array.isArray(wert) ? [wert] : wert && typeof wert === "object" ? Object.values(wert).filter(Array.isArray) : [];
  for (const l of listen) for (const o of l) if (o && typeof o === "object" && typeof o.text === "string" && !ausBausteinen.has(o.text)) ausBausteinen.set(o.text, { quelle: o.quelle ?? "", unsicher: Boolean(o.unsicher) });
}
const FELD = { beschreibung: "Gefährdung", massnahme: "Maßnahmen", faktor: "Faktor", unterpunkt: "Unterpunkt", risiko: "Risiko (vorbelegt)", schwere: "Schwere (Vorschlag)", anlass: "Tätigkeit", schutz: "Hautschutz", handschuhe: "Handschuhe", handschuh_norm: "Material/Norm", desinfektion: "Händedesinfektion", reinigung: "Reinigung", pflege: "Pflege", arbeitsmittel: "Arbeitsmittel", pruefart: "Prüfart", frist: "Frist", befaehigt: "Befähigte Person" };
const inhaltAus = (werte, titel) =>
  Object.entries(werte ?? {})
    .filter(([k, w]) => w && !(k === "beschreibung" && w === titel) && k !== "anlass")
    .filter(([k]) => k !== "arbeitsmittel")
    .map(([k, w]) => `${FELD[k] ?? k}: ${k === "faktor" ? (F.GEFAEHRDUNGSFAKTOREN[w] ?? w) : k === "unterpunkt" ? (F.SONSTIGE_UNTERPUNKTE[w] ?? w) : String(w)}`)
    .join("\n");
function* felderVon(v) {
  for (const a of v.abschnitte) {
    for (const f of a.felder) {
      yield { f, feld: f.label };
      if (f.art === "liste") for (const u of f.felder) yield { f: u, feld: `${f.label} › ${u.label}` };
    }
  }
}
const bausteine = [];
for (const v of VORLAGEN) {
  for (const { f, feld } of felderVon(v)) {
    const neu = (x) => bausteine.push({ vorlage: v.titel, vorlageId: v.id, feld, ...x });
    if (f.art === "liste") for (const s of f.vorschlaege ?? []) neu({ art: "Vorschlag (Eintrag)", gruppeApp: s.gruppe ?? "", titel: s.titel, inhalt: inhaltAus(s.werte, s.titel), quelle: s.quelle ?? "" });
    if (f.optionen && (f.art === "bausteine" || f.optionen.some((o) => o.quelle))) for (const o of f.optionen) neu({ art: f.art === "bausteine" ? "Textbaustein" : "Auswahl", gruppeApp: (o.gruppen ?? []).join(", "), titel: o.text, inhalt: "", quelle: o.quelle ?? ausBausteinen.get(o.text)?.quelle ?? "", unsicher: Boolean(o.unsicher || ausBausteinen.get(o.text)?.unsicher) });
    if (f.art !== "liste") for (const s of f.vorschlaege ?? []) neu({ art: "Formulierung", gruppeApp: (f.vorschlagGruppen?.[s] ?? []).join(", "), titel: s, inhalt: "", quelle: ausBausteinen.get(s)?.quelle ?? "", unsicher: Boolean(ausBausteinen.get(s)?.unsicher) });
  }
}
// Branchengruppe aus der Gruppe des Vorschlags (Anzeigename) bzw. den Gruppen-Kennungen der Option (BRANCHEN_GRUPPEN)
const GRUPPEN = [
  ["Gastronomie / Café", /Gastronomie|gastro_cafe/],
  ["Bäckerei", /Bäckerei|baeckerei/],
  ["Friseur", /Friseur|friseur/],
  ["Kosmetik", /Kosmetik|kosmetik/],
  ["Handwerk / Bau (inkl. Holz / Tischlerei)", /Handwerk|handwerk_allgemein|Holz|Tischlerei/],
  ["Kfz-Werkstatt", /Kfz|kfz_werkstatt/],
  ["Transport / Kurier", /Transport|transport/],
  ["Gebäudereinigung", /Gebäudereinigung|gebaeudereinigung/],
  ["Büro / Laden", /Büro|buero_laden/],
  ["Unterricht / Sport / Coaching", /unterricht/],
  // E-166: Praxen (Gesundheit und Pflege)
  ["Praxis / Gesundheit", /Praxis|praxis/],
];
const OHNE = "Alle Branchen (ohne Gruppe)";
const gruppenVon = (b) => {
  const g = GRUPPEN.filter(([, re]) => re.test(b.gruppeApp)).map(([n]) => n);
  return g.length && !/\balle\b/.test(b.gruppeApp) ? g : [OHNE];
};
// Zahlenwerte mit Einheit, Rutschhemmung (R 9), Prüffristen – damit Kennzahlen und Grenzwerte auf einen Blick prüfbar sind
const KENN = /(?:(?:mindestens|höchstens|max\.|min\.|unter|über|bis zu|ab|bis|<|>|≤|≥)\s*)?[−+-]?\d+(?:[.,]\d+)?(?:\s*(?:bis|–|-)\s*[−+-]?\d+(?:[.,]\d+)?)?\s*(?:°C|m³(?:\/h| pro Stunde)?|m²|m\b|cm|mm|dB\(A\)|dB|lx|Lux|%|Stunde[n]?\b|Std\.|Minuten|Sekunden|Jahr(?:e|en)?\b|Monat(?:e|en)?\b|Woche[n]?\b|Tag(?:e|en)?\b|kg|Liter|l\b|Volt|V\b|mA|Löschmitteleinheiten)|\bR\s?\d{1,2}\b|\bTyp [A-Z]\b/g;
const kennzahlen = (b) => [...new Set(`${b.titel}\n${b.inhalt}`.match(KENN) ?? [])].map((x) => x.trim()).join("; ");
const markierung = (b) => {
  const m = [];
  if (b.unsicher || /unsicher/i.test(b.quelle)) m.push("unsicher");
  if (/zu prüfen/i.test(`${b.quelle} ${b.titel} ${b.inhalt}`)) m.push("fachlich zu prüfen");
  if (/^Nutzertest/.test(b.quelle)) m.push("Quelle: Nutzertest, keine Fachquelle");
  if (!b.quelle) m.push(/§|DGUV|TRGS|ASR|DIN/.test(`${b.titel} ${b.inhalt}`) ? "ohne Quellenfeld (Fundstelle im Text)" : "ohne Quelle");
  return m.join("; ") || "Quelle genannt";
};
// Kurze Auswahllisten ohne Quelle (Arbeitsbereiche, Sprachen, Dauer, Gerätenamen …) stehen gesammelt am Ende, nicht als Baustein
const kurz = (b) => b.art === "Formulierung" && !b.quelle && b.titel.length < 45;
const listen = [];
for (const b of bausteine.filter(kurz)) {
  const l = listen.find((x) => x.vorlage === b.vorlage && x.feld === b.feld) ?? listen[listen.push({ vorlage: b.vorlage, feld: b.feld, werte: [] }) - 1];
  l.werte.push(b.gruppeApp ? `${b.titel} (${b.gruppeApp})` : b.titel);
}
bausteine.splice(0, bausteine.length, ...bausteine.filter((b) => !kurz(b)));
for (const b of bausteine) Object.assign(b, { gruppen: gruppenVon(b), kennzahlen: kennzahlen(b), markierung: markierung(b) });
// E-167: Nummern der Durchsicht vom 22.10.2026 bleiben erhalten (src/dokumente/sifa.ts); neue Bausteine zählen ab B-198
// weiter, geteilte (B-036 Fettbrand) bekommen Buchstaben
const SIFA = new Map(F.SIFA_PRUEFUNG.map((e) => [`${e.vorlage}|${e.feld}|${e.titel}`, e]));
const vergeben = new Map();
let naechsteNr = Math.max(...F.SIFA_PRUEFUNG.map((e) => Number(e.nr.slice(2)))) + 1;
for (const b of bausteine) {
  const e = SIFA.get(`${b.vorlageId}|${b.feld}|${b.titel}`);
  if (e) {
    const n = vergeben.get(e.nr) ?? 0;
    vergeben.set(e.nr, n + 1);
    Object.assign(b, { nr: n ? `${e.nr}${"abcdefgh"[n]}` : e.nr, pruefung: `${e.ergebnis} · ${e.pruefstand}${e.grund ? ` (${e.grund})` : ""}` });
  } else Object.assign(b, { nr: `B-${String(naechsteNr++).padStart(3, "0")}`, pruefung: "neu nach der Durchsicht vom 22.10.2026 – noch nicht geprüft" });
}
const fehlendeNr = F.SIFA_PRUEFUNG.filter((e) => !bausteine.some((b) => b.nr === e.nr));
bausteine.sort((a, b) => a.nr.localeCompare(b.nr, "de", { numeric: true }));
fs.writeFileSync(
  path.join(ZIEL, "bausteine.csv"),
  csv([["Nr", "Branchengruppe", "Gruppe in der App", "Vorlage", "Feld", "Art", "Baustein", "Inhalt", "Kennzahlen im Text", "Quelle (Kurzbeleg)", "Markierung", "Durchsicht 22.10.2026 (Ergebnis · Prüfstand)"], ...bausteine.map((b) => [b.nr, b.gruppen.join(", "), b.gruppeApp, b.vorlage, b.feld, b.art, b.titel, b.inhalt, b.kennzahlen, b.quelle, b.markierung, b.pruefung])]),
);
const zaehle = (re) => bausteine.filter((b) => re.test(b.markierung)).length;
const bm = [
  "# Bausteine der Arbeitsschutz-Vorlagen",
  "",
  `Aus dem Code erzeugt am ${new Date().toISOString().slice(0, 10)} (\`packages/fachlogik/src/dokumente/bausteine.ts\` – erzeugt von \`packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs\` aus der Recherche \`docs/recherche/2026-10-12\` –, ergänzt in \`arbeitsschutz.ts\` und \`branchen.ts\`). Es steht alles, was die App in den Vorlagen ${VORLAGEN.map((v) => `„${v.titel}“`).join(", ")} zum Antippen anbietet. Der Betrieb übernimmt einen Baustein und passt ihn an; nichts davon ist bisher fachlich freigegeben (PRUEFLISTE T-62).`,
  "",
  `Stand nach der fachlichen Durchsicht vom 22.10.2026 (E-167): Die Nummern B-001 bis B-197 sind die der Durchsicht (Zuordnung in \`packages/fachlogik/src/dokumente/sifa.ts\`), neue Bausteine folgen ab B-198. Spalte „Durchsicht“: Ergebnis und Prüfstand der Durchsicht bzw. „neu“.`,
  "",
  `**${bausteine.length} Bausteine**, davon ${zaehle(/fachlich zu prüfen/)} im Code „fachlich zu prüfen“, ${zaehle(/unsicher/)} „unsicher“ (nicht wörtlich an der Primärquelle geprüft), ${zaehle(/Nutzertest/)} mit Quelle „Nutzertest“ (aus simulierten Nutzertests, Maßnahmen sind allgemeine Grundsätze), ${zaehle(/ohne Quelle/)} ohne Quelle. Die Nummern (B-…) sind die der CSV-Datei, damit Antworten zugeordnet werden können.`,
  "",
  "**Wie die App filtert:** Vorschläge mit einer Gruppe zeigt die App Betrieben dieser Branchengruppe zuerst, die übrigen unter „Weitere“; Bausteine ohne Gruppe gelten für alle. Die Branchengruppe folgt aus den Branchen im Pflichten-Check (`BRANCHEN_GRUPPEN`); Kfz-Werkstatt und Bäckerei erkennt die App zusätzlich am Namen des Betriebs, Transport an der Branche „Transport und Logistik“, Praxen an der Branche „Gesundheit und Pflege“ (`gruppenFuerBetrieb`; Gruppe „Praxis / Gesundheit“ seit E-166). Bausteine für mehrere Gruppen stehen unten in jeder dieser Gruppen.",
  "",
  "Spalte „Kennzahlen“: automatisch herausgezogene Zahlenwerte (Grenzwerte, Häufigkeiten, Prüffristen, Bewertungsgruppen) – zum schnellen Abgleich, nicht vollständig. Spalte „Markierung“: wie im Code bzw. in der Quelle vermerkt.",
  "",
];
for (const g of [...GRUPPEN.map(([n]) => n), OHNE]) {
  const l = bausteine.filter((b) => b.gruppen.includes(g));
  if (!l.length) continue;
  bm.push(`## ${g} (${l.length})`, "");
  for (const v of VORLAGEN) {
    const lv = l.filter((b) => b.vorlageId === v.id);
    if (!lv.length) continue;
    bm.push(`### ${v.titel}`, "", "| Nr. | Feld / Art | Baustein | Inhalt | Kennzahlen | Quelle | Markierung | Durchsicht 22.10.2026 |", "|---|---|---|---|---|---|---|---|");
    for (const b of lv) bm.push(`| ${b.nr} | ${md(b.feld)} (${b.art}) | ${md(b.titel)} | ${md(b.inhalt)} | ${md(b.kennzahlen)} | ${md(b.quelle)} | ${md(b.markierung)} | ${md(b.pruefung)} |`);
    bm.push("");
  }
}
// Feste Texte, die die Vorlagen drucken (keine Auswahl, aber ebenfalls fachlich zu prüfen)
bm.push("## Kurze Auswahllisten (ohne Quelle)", "", "Antippbare Kurzangaben der Vorlagen; Gruppen in Klammern (Kennungen aus `BRANCHEN_GRUPPEN`).", "");
for (const l of listen) bm.push(`- **${l.vorlage} – ${l.feld}:** ${l.werte.join(" · ")}`);
bm.push("", "## Feste Texte und Skalen der Vorlagen", "");
bm.push("### Risikoskala der Gefährdungsbeurteilung (`RISIKO_SKALA`, `RISIKO_MATRIX` – Vorschlag der Durchsicht, Blatt „D Risikoskala“)", "", F.RISIKO_SKALA, "", "| Schwere \\ Wahrscheinlichkeit | " + Object.values(F.WAHRSCHEINLICHKEIT).join(" | ") + " |", "|---|---|---|---|", ...Object.entries(F.SCHWERE).map(([s, t]) => `| ${t} | ${Object.keys(F.WAHRSCHEINLICHKEIT).map((w) => F.RISIKO_MATRIX[s][w]).join(" | ")} |`), "");
bm.push("### Gefährdungsfaktoren (Abschnitte der Gefährdungsbeurteilung, § 5 Abs. 3 ArbSchG, „sonstige“ ergänzt)", "", ...Object.values(F.GEFAEHRDUNGSFAKTOREN).map((t, i) => `${i + 1}. ${t}`), "");
bm.push("### Pflichtangaben im Gefahrstoffverzeichnis (Fußtext, § 6 Abs. 12 GefStoffV)", "", ...F.BS.GEFAHRSTOFF_ANGABEN.map((t) => `- ${t}`), "");
bm.push("### Gliederung der Betriebsanweisung (Recherche, TRGS 555)", "", "| Nr. | Abschnitt | Inhalt |", "|---|---|---|", ...F.BS.BA_GLIEDERUNG.map((g) => `| ${g.nr} | ${md(g.abschnitt)} | ${md(g.inhalt)} |`), "");
bm.push("### Prüffristen elektrischer Geräte (`ELEKTRO_FRISTEN`; die Vorlage bietet die ersten vier als Einsatzbedingung an)", "", "| Richtwert | Quelle | Markierung |", "|---|---|---|", ...F.BS.ELEKTRO_FRISTEN.map((o) => `| ${md(o.text)} | ${md(o.quelle)} | ${o.unsicher ? "unsicher" : "Quelle genannt"} |`), "");
fs.writeFileSync(path.join(ZIEL, "bausteine.md"), bm.join("\n"));

// 3. Katalog: Kategorie „arbeitsschutz“ und die Arbeitsschutz-Einträge aus Personal und Branchen – Spalten wie beim Anwalt
const katalog = JSON.parse(fs.readFileSync(path.join(APP, "src/pflichten/katalog.json"), "utf8"));
const WEITERE = [
  "personal.jugendarbeitsschutz", "personal.jugend_nachuntersuchung", "personal.mutterschutz_gefaehrdungsbeurteilung", "personal.schwangerschaft_mitteilung",
  "personal.nachtarbeit", "personal.arbeitszeit_aufzeichnung", "personal.arbeitszeit_neuregelung", "personal.aushangpflichtige_gesetze", "personal.fuehrerscheinkontrolle",
  "branche.beauty_hautschutzplan", "branche.handwerk_gefaehrdung_gewerk", "branche.bau_baustellenverordnung", "branche.transport_lenkzeiten", "branche.transport_lenkzeiten_national",
];
const fehlendeIds = WEITERE.filter((id) => !katalog.pflichten.some((p) => p.id === id));
const de = (x) => (x && typeof x === "object" ? (x.de ?? "") : (x ?? ""));
const ausloeser = (a) => (a ? de(a.label) || JSON.stringify(a) : "");
const kopf = ["Nr", "ID", "Titel", "Kurz", "Kategorie", "Auslöser", "Rechtsgrundlage", "Sanktion", "Schwere", "Status Recht", "Gültig ab", "Quellen", "Prüfstatus"];
const pflichten = katalog.pflichten.filter((p) => p.kategorie === "arbeitsschutz" || WEITERE.includes(p.id)).sort((a, b) => String(a.katalog_nr).localeCompare(String(b.katalog_nr), "de", { numeric: true }) || a.id.localeCompare(b.id));
const zeilen = pflichten.map((p) => [p.katalog_nr, p.id, de(p.titel), de(p.kurz), p.kategorie, ausloeser(p.ausloeser), (p.rechtsgrundlage ?? []).join("; "), de(p.sanktion?.text), p.sanktion?.schwere, p.status_recht, p.gueltig_ab ?? "", (p.quellen ?? []).map((q) => q.url).join(" "), p.pruefung?.status]);
fs.writeFileSync(path.join(ZIEL, "katalog-arbeitsschutz.csv"), csv([kopf, ...zeilen]));
const werte = (katalog.regelwerte ?? []).filter((r) => r.id.startsWith("arbeitsschutz."));
fs.writeFileSync(path.join(ZIEL, "regelwerte-arbeitsschutz.csv"), csv([["Nr", "ID", "Bezeichnung", "Wert", "Einheit", "Gültig ab", "Gültig bis", "Rechtsgrundlage", "Offene Punkte", "Prüfstatus"], ...werte.map((r) => [r.katalog_nr, r.id, de(r.bezeichnung), typeof r.wert === "object" ? JSON.stringify(r.wert) : r.wert, r.einheit, r.gueltig_ab ?? "", r.gueltig_bis ?? "", (r.rechtsgrundlage ?? []).join("; "), (r.fachlich_zu_pruefen ?? []).join(" / "), r.pruefung?.status])]));

// 4. Prüflisten-Auszug: „Wer“ nennt die Sifa (auch FaSi, BG, Elektrofachkraft); „Fach“ mit Arbeitsschutz-Bezug; zur
//    Kenntnis die übrigen Punkte mit Arbeitsschutz-Bezug; Anhang: offene Katalogpunkte der Einträge aus Schritt 3
const WER = /Sifa|FaSi|Arbeitssicherheit|\bBG\b|Elektrofachkraft/;
const THEMA = /Gefährdung|Unterweis|Betriebsanweisung|Gefahrstoff|Hautschutz|DGUV|TRGS|ArbSchG|JArbSchG|MuSchG|Mutterschutz|Erste Hilfe|Ersthelfer|Brandschutz|Feuerlösch|ArbMedVV|Vorsorge|\bASR\b|Lärm|Prüfprotokoll|elektrische Geräte|Sifa|Betriebsarzt|ArbZG|Unfallanzeige|Verbandbuch|Nachtarbeit|Lastenhandhab|Hebebühne|Mehlstaub/;
const pl = fs.readFileSync(path.join(ROOT, "PRUEFLISTE.md"), "utf8").split("\n");
const punkte = pl
  .filter((z) => /^\| [GTJ]-\d+ \|/.test(z))
  .map((z) => ({ z, c: z.split("|").map((x) => x.trim()) }))
  .filter(({ c }) => c.length >= 5);
const sifa = punkte.filter(({ c }) => WER.test(c[3]));
const fach = punkte.filter(({ c }) => !WER.test(c[3]) && /\bFach(beirat)?\b/.test(c[3]) && THEMA.test(c[2]));
const kenntnis = punkte.filter(({ c }) => !WER.test(c[3]) && !/\bFach(beirat)?\b/.test(c[3]) && THEMA.test(c[2]));
const ids = new Set([...pflichten.map((p) => p.id), ...werte.map((r) => r.id)]);
const kZeilen = pl.filter((z) => /^\| K-\d+ \|/.test(z) && ids.has(z.split("|")[2].trim().replace(/`/g, "")));
const tab = (l) => ["| Nr. | Punkt | Wer | Quelle |", "|---|---|---|---|", ...l.map(({ z }) => z)];
const auszug = [
  "# Offene Fragen für die Fachkraft für Arbeitssicherheit und die Betriebsärztin / den Betriebsarzt",
  "",
  `Aus \`PRUEFLISTE.md\` (Stand des Codes). Die Nummern bleiben die der Prüfliste, damit Antworten zugeordnet werden können. Lange Punkte sind nicht gekürzt; manche betreffen mehrere Fachrichtungen – bitte nur den Arbeitsschutz-Teil beantworten.`,
  "",
  `## Für Sie: „Wer“ nennt Sifa, Fachkraft für Arbeitssicherheit, BG oder Elektrofachkraft (${sifa.length})`,
  "",
  ...tab(sifa),
  "",
  `## Für Sie: „Wer“ nennt allgemein Fachleute, Thema Arbeitsschutz (${fach.length})`,
  "",
  ...tab(fach),
  "",
  `## Zur Kenntnis: Arbeitsschutz-Bezug, Federführung bei Rechtsanwalt, Steuerberatung oder Technik (${kenntnis.length})`,
  "",
  "Nicht Ihr Auftrag; wenn Ihnen fachlich etwas auffällt, nehmen wir den Hinweis gern.",
  "",
  ...tab(kenntnis),
  "",
  `## Anhang: offene Katalogpunkte der Einträge in \`katalog-arbeitsschutz.csv\` und \`regelwerte-arbeitsschutz.csv\` (${kZeilen.length})`,
  "",
  "Automatisch aus `fachlich_zu_pruefen` im Katalog. Meist: Frist, Sanktion oder Rechtsgrundlage fachlich ergänzen.",
  "",
  "| Nr. | Objekt | Katalog-Nr. | Punkt |",
  "|---|---|---|---|",
  ...kZeilen,
  "",
];
fs.writeFileSync(path.join(ZIEL, "PRUEFLISTE-arbeitsschutz.md"), auszug.join("\n"));

// 5. README
kopiere(path.join(HIER, "README.md"), path.join(ZIEL, "README.md"));
fs.rmSync(ROH, { recursive: true, force: true });
const pdfs = fs.existsSync(vorlagen) ? fs.readdirSync(vorlagen).length : 0;
console.log(`✓ Prüfmappe Arbeitsschutz in ${ZIEL}: ${pdfs} Vorlagen-PDFs (${VORLAGEN.length} Vorlagen), ${bausteine.length} Bausteine (${zaehle(/fachlich zu prüfen/)} fachlich zu prüfen, ${zaehle(/unsicher/)} unsicher), ${zeilen.length} Pflichten, ${werte.length} Regelwerte, ${sifa.length + fach.length} Prüflisten-Punkte (+${kenntnis.length} zur Kenntnis, ${kZeilen.length} Katalogpunkte)`);
if (befunde.length) console.log(`! Satzspiegel-Befunde des Prüfwerkzeugs zu diesen Vorlagen:\n${befunde.join("\n")}`);
if (fehlendeNr.length) console.log(`! Bausteine der Durchsicht nicht mehr gefunden: ${fehlendeNr.map((e) => e.nr).join(", ")}`);
if (fehlendeVorlagen.length) console.log(`! Vorlagen nicht erzeugt: ${fehlendeVorlagen.join(", ")}`);
if (fehlendeIds.length) console.log(`! Katalogeinträge nicht gefunden: ${fehlendeIds.join(", ")}`);
