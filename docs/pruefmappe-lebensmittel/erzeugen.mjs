/**
 * Prüfmappe für die fachliche Prüfung Lebensmittelhygiene erzeugen (analog docs/pruefmappe-anwalt, -steuer und
 * -arbeitsschutz): Lebensmittel-Vorlagen als PDF (HACCP, Hygieneplan Lebensmittel, Allergenliste, Belehrung nach § 43
 * IfSG), alle vorformulierten Bausteine dieser Vorlagen mit Quelle und Markierung (Markdown und CSV), Katalogeinträge zu
 * Lebensmittelhygiene, Allergenen, Zusatzstoffen, IfSG, Registrierung und Verpackung als CSV und der Prüflisten-Auszug.
 *
 *   node docs/pruefmappe-lebensmittel/erzeugen.mjs <ziel>      # z. B. /tmp/pruefmappe-lebensmittel
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
const ZIEL = path.resolve(process.argv[2] ?? "pruefmappe-lebensmittel");
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
fs.writeFileSync(eintrag, `export * from "${path.join(DOK, "index.ts")}";\nexport { HYGIENE_GRUNDLAGE_LEBENSMITTEL } from "${path.join(DOK, "branchen.ts")}";\nexport * as BS from "${path.join(DOK, "bausteine.ts")}";\n`);
execFileSync(path.join(pnpm, esb, "node_modules/esbuild/bin/esbuild"), [eintrag, "--bundle", "--platform=node", "--format=esm", `--outfile=${gebaut}`, "--log-level=warning"]);
const F = await import(gebaut);

// 1. Vorlagen (leer, Auswahl, voll) über das vorhandene Prüfwerkzeug: Bereich „gastro“ laut VORLAGEN (Belehrung § 43
//    IfSG, Allergenliste, HACCP) und vom Hygieneplan nur die Fassungen für Lebensmittelbetriebe (`-lebensmittel`; die
//    übrigen Fassungen zeigen den Plan eines Beauty-Betriebs)
const VORLAGEN = F.VORLAGEN.filter((v) => v.bereich === "gastro" || v.id === "hygieneplan");
const passt = (v, datei) => datei.startsWith(`${v.id}-`) && datei.endsWith(".pdf") && (v.id !== "hygieneplan" || datei.includes("-lebensmittel"));
const alle = path.join(ROH, "vorlagen");
const lauf = spawnSync("node", [path.join(APP, "werkzeuge/dokumente-pruefen.mjs"), alle], { cwd: APP, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
// Exit-Code 1 heißt „Befunde zum Satzspiegel“ – die PDFs sind trotzdem da; nur die Befunde zu diesen Vorlagen melden
const befunde = (lauf.stdout ?? "").split("\n").filter((z) => VORLAGEN.some((v) => passt(v, `${z.split(":")[0]}.pdf`)));
const vorlagen = path.join(ZIEL, "vorlagen");
fs.rmSync(vorlagen, { recursive: true, force: true });
const fehlendeVorlagen = [];
for (const v of VORLAGEN) {
  const dateien = fs.existsSync(alle) ? fs.readdirSync(alle).filter((f) => passt(v, f)) : [];
  if (!dateien.length) fehlendeVorlagen.push(v.id);
  for (const f of dateien) kopiere(path.join(alle, f), path.join(vorlagen, f));
}

// 2. Bausteine: alles, was die App in diesen Vorlagen zum Antippen anbietet, mit Kurzbeleg. Beim Hygieneplan nur die
//    Vorschläge der Gruppe „Gastronomie / Café“ (Lebensmittelbetrieb), nicht die der Beauty-Betriebe.
const ausBausteinen = new Map();
for (const wert of Object.values(F.BS)) {
  const listen = Array.isArray(wert) ? [wert] : wert && typeof wert === "object" ? Object.values(wert).filter(Array.isArray) : [];
  for (const l of listen) for (const o of l) if (o && typeof o === "object" && typeof o.text === "string" && !ausBausteinen.has(o.text)) ausBausteinen.set(o.text, { quelle: o.quelle ?? "", unsicher: Boolean(o.unsicher) });
}
// dieselben Objekte wie in den Vorschlägen des Hygieneplans (Titel wie „Händewaschen“ gibt es auch bei Beauty)
// E-166: dazu die Zeilen für Bäckerei und Foodtruck / mobilen Verkauf
const LEBENSMITTEL = new Set([...F.HYGIENE_LEBENSMITTEL, ...F.HYGIENE_BAECKEREI, ...F.HYGIENE_FOODTRUCK]);
const BEAUTY = /Friseur|Kosmetik|Nagel|Fußpflege/;
const FELD = { grenzwert: "Grenzwert", haeufigkeit: "Häufigkeit", korrektur: "Korrekturmaßnahme", thema: "Themenbereich", wann: "Wann / wie oft", womit: "Womit", wie: "Wie", wer: "Wer", arten: "Art der Gefahr", gefahr: "Gefahr", lenkung: "Lenkungsmaßnahme", ccp: "CCP", begruendung: "Begründung", ueberwachung: "Überwachung: wie" };
// E-166: Felder der Gefahrenanalyse und der CCP heißen teils anders als im Hygieneplan
const FELD_HACCP = { wer: "Überwachung: wer", wann: "Überwachung: wie oft" };
const inhaltAus = (werte, titel, haccp = false) =>
  Object.entries(werte ?? {})
    .filter(([k, w]) => (Array.isArray(w) ? w.length : w) && !["punkt", "was", "thema", "schritt"].includes(k) && w !== titel)
    .map(([k, w]) => `${(haccp && FELD_HACCP[k]) || FELD[k] || k}: ${Array.isArray(w) ? w.join(", ") : String(w)}`)
    .join("\n");
function* felderVon(v) {
  for (const a of v.abschnitte) {
    for (const f of a.felder) {
      yield { f, feld: f.label, abschnitt: a.titel };
      if (f.art === "liste") for (const u of f.felder) yield { f: u, feld: `${f.label} › ${u.label}`, abschnitt: a.titel };
    }
  }
}
const bausteine = [];
for (const v of VORLAGEN) {
  for (const { f, feld, abschnitt } of felderVon(v)) {
    // E-166: in der HACCP-Vorlage gliedern die Abschnitte (Gefahrenanalyse, CCP, Verifizierung …) die Bausteine
    const neu = (x) => bausteine.push({ vorlage: v.id === "hygieneplan" ? "Hygieneplan (Lebensmittelbetrieb)" : v.titel, vorlageId: v.id, feld, ...(v.id === "haccp" ? { thema: abschnitt } : {}), ...x });
    if (f.art === "liste") for (const s of (f.vorschlaege ?? []).filter((s) => v.id !== "hygieneplan" || LEBENSMITTEL.has(s))) neu({ art: "Vorschlag (Eintrag)", gruppeApp: s.gruppe ?? "", thema: s.werte?.thema ?? (v.id === "haccp" ? ({ gefahren: "Gefahrenanalyse", ccps: "Kritische Kontrollpunkte (CCP)", punkte: "Kontrollpunkte der Eigenkontrollen" }[f.id] ?? "") : ""), titel: s.titel, inhalt: inhaltAus(s.werte, s.titel, v.id === "haccp"), quelle: s.quelle ?? "" });
    // Die 14 Allergene haben keinen Kurzbeleg je Option; konstanten.ts nennt Anhang II LMIV und „Bezeichnungen fachlich zu prüfen, E-099“
    const allergen = f.art === "mehrfach" && f.optionen.length === Object.keys(F.ALLERGENE).length;
    if (f.optionen && (f.art === "bausteine" || allergen || f.optionen.some((o) => o.quelle))) for (const o of f.optionen) neu({ art: f.art === "bausteine" ? "Textbaustein" : "Auswahl", gruppeApp: (o.gruppen ?? []).join(", "), titel: o.text, inhalt: allergen ? "Bezeichnungen fachlich zu prüfen (E-099)" : "", quelle: o.quelle ?? (allergen ? "Anhang II LMIV" : (ausBausteinen.get(o.text)?.quelle ?? "")), unsicher: Boolean(o.unsicher || ausBausteinen.get(o.text)?.unsicher) });
    if (f.art !== "liste") for (const s of (f.vorschlaege ?? []).filter((s) => !BEAUTY.test(s))) neu({ art: "Formulierung", gruppeApp: (f.vorschlagGruppen?.[s] ?? []).join(", "), titel: s, inhalt: "", quelle: ausBausteinen.get(s)?.quelle ?? "", unsicher: Boolean(ausBausteinen.get(s)?.unsicher) });
  }
}
const KENN = /(?:(?:mindestens|höchstens|max\.|min\.|unter|über|bis zu|ab|bis|<|>|≤|≥|kälter als)\s*)?[−+-]?\d+(?:[.,]\d+)?(?:\s*(?:bis|–|-)\s*(?:max\.\s*)?[−+-]?\d+(?:[.,]\d+)?)?\s*(?:°C|%|Stunde[n]?\b|Std\.|Minuten|Sekunden|Jahr(?:e|en)?\b|Monat(?:e|en)?\b|Woche[n]?\b|Tag(?:e|en)?\b|kg|ppm|mg)/g;
const kennzahlen = (b) => [...new Set(`${b.titel}\n${b.inhalt}`.match(KENN) ?? [])].map((x) => x.trim()).join("; ");
const markierung = (b) => {
  const t = `${b.quelle} ${b.titel} ${b.inhalt}`;
  const m = [];
  if (b.unsicher || /unsicher/i.test(b.quelle)) m.push("unsicher");
  if (/zu prüfen/i.test(t)) m.push("fachlich zu prüfen");
  if (/°C/.test(`${b.titel} ${b.inhalt}`)) m.push("Temperaturwert: fachlich zu prüfen (T-34, T-94)");
  if (/abweichende Behördenangabe|\(lose: |Behördenangaben unterschiedlich|teils werden/.test(t)) m.push("zwei Behördenwerte");
  if (!b.quelle) m.push(/§|Art\.|VO \(EG\)|LMIV|IfSG/.test(`${b.titel} ${b.inhalt}`) ? "ohne Quellenfeld (Fundstelle im Text)" : "ohne Quelle");
  return m.join("; ") || "Quelle genannt";
};
// Kurze Auswahllisten ohne Quelle (Bereiche, Häufigkeiten, Geräte, Kategorien …) stehen gesammelt am Ende
const kurz = (b) => b.art === "Formulierung" && !b.quelle && b.titel.length < 45;
const listen = [];
for (const b of bausteine.filter(kurz)) {
  const l = listen.find((x) => x.vorlage === b.vorlage && x.feld === b.feld) ?? listen[listen.push({ vorlage: b.vorlage, feld: b.feld, werte: [] }) - 1];
  l.werte.push(b.titel);
}
bausteine.splice(0, bausteine.length, ...bausteine.filter((b) => !kurz(b)));
for (const b of bausteine) Object.assign(b, { kennzahlen: kennzahlen(b), markierung: markierung(b) });
bausteine.forEach((b, i) => (b.nr = `L-${String(i + 1).padStart(3, "0")}`));
fs.writeFileSync(
  path.join(ZIEL, "bausteine.csv"),
  csv([["Nr", "Vorlage", "Themenbereich", "Gruppe in der App", "Feld", "Art", "Baustein", "Inhalt", "Kennzahlen im Text", "Quelle (Kurzbeleg)", "Markierung"], ...bausteine.map((b) => [b.nr, b.vorlage, b.thema ?? "", b.gruppeApp, b.feld, b.art, b.titel, b.inhalt, b.kennzahlen, b.quelle, b.markierung])]),
);
const zaehle = (re) => bausteine.filter((b) => re.test(b.markierung)).length;
const bm = [
  "# Bausteine der Lebensmittel-Vorlagen",
  "",
  `Aus dem Code erzeugt am ${new Date().toISOString().slice(0, 10)} (\`packages/fachlogik/src/dokumente/bausteine.ts\` – erzeugt von \`packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs\` aus der Recherche \`docs/recherche/2026-10-12/lebensmittel_beauty.json\`, mit Korrekturen der Druckfassung –, ergänzt in \`branchen.ts\`: Hygieneplan für Lebensmittelbetriebe, und in \`haccp.ts\` (E-166): Gefahrenanalyse, kritische Kontrollpunkte, Verifizierung, Aufzeichnungen, Hygieneplan-Zeilen für Bäckerei und Foodtruck). Es steht alles, was die App in den Vorlagen ${VORLAGEN.map((v) => `„${v.titel}“`).join(", ")} (nur Lebensmittelbetrieb) zum Antippen anbietet. Der Betrieb übernimmt einen Baustein und passt ihn an; nichts davon ist bisher fachlich freigegeben (PRUEFLISTE T-34, T-57, T-94).`,
  "",
  `**${bausteine.length} Bausteine**, davon ${zaehle(/Temperaturwert/)} mit Temperaturwert (alle „fachlich zu prüfen“), ${zaehle(/zwei Behördenwerte/)} mit zwei verschiedenen Behördenwerten, ${zaehle(/(^|; )fachlich zu prüfen/)} im Code ausdrücklich „fachlich zu prüfen“ bzw. „üblicher Richtwert, fachlich zu prüfen“, ${zaehle(/unsicher/)} „unsicher“, ${zaehle(/ohne Quelle/)} ohne Quelle. Die Nummern (L-…) sind die der CSV-Datei.`,
  "",
  "**Branchen (seit E-166):** Gefahrenanalyse und kritische Kontrollpunkte der HACCP-Vorlage sowie die Hygieneplan-Zeilen gibt es für die Gruppen „Gastronomie / Café“, „Bäckerei“ und „Foodtruck / mobiler Verkauf“ (Spalte „Gruppe in der App“). Die App zeigt die passende Gruppe zuerst: Bäckerei bei Handwerk und Lebensmitteln bzw. am Namen, Foodtruck bei Lebensmitteln mit Reisegewerbe oder Marktstand bzw. am Namen. Die Kontrollpunkte der Eigenkontrollen, Allergene und IfSG haben keine Gruppe. Eine Gruppe für Metzgereien gibt es nicht (keine eigene Branche im Pflichten-Check).",
  "",
  "Spalte „Kennzahlen“: automatisch herausgezogene Temperaturen, Zeiten und Häufigkeiten – zum schnellen Abgleich, nicht vollständig.",
  "",
];
for (const v of VORLAGEN) {
  const lv = bausteine.filter((b) => b.vorlageId === v.id);
  if (!lv.length) continue;
  bm.push(`## ${lv[0].vorlage} (${lv.length})`, "", `Rechtsgrundlage im Dokumentkopf: ${v.id === "hygieneplan" ? F.HYGIENE_GRUNDLAGE_LEBENSMITTEL : v.grundlage}`, "");
  const themen = [...new Set(lv.map((b) => b.thema ?? ""))];
  for (const t of themen) {
    if (t) bm.push(`### ${t}`, "");
    bm.push("| Nr. | Feld / Art | Baustein | Inhalt | Kennzahlen | Quelle | Markierung |", "|---|---|---|---|---|---|---|");
    for (const b of lv.filter((b) => (b.thema ?? "") === t)) bm.push(`| ${b.nr} | ${md(b.feld)} (${b.art}) | ${md(b.titel)} | ${md(b.inhalt)} | ${md(b.kennzahlen)} | ${md(b.quelle)} | ${md(b.markierung)} |`);
    bm.push("");
  }
}
bm.push("## Kurze Auswahllisten (ohne Quelle)", "");
for (const l of listen) bm.push(`- **${l.vorlage} – ${l.feld}:** ${l.werte.join(" · ")}`);
bm.push("", "## Feste Texte der Vorlagen", "");
bm.push("### Allergenliste: die 14 Hauptallergene (Anhang II LMIV) mit Erläuterung", "", "| Nr. | Bezeichnung in der App | Erläuterung auf dem Aushang (Recherche) |", "|---|---|---|", ...Object.values(F.ALLERGENE).map((a, i) => `| ${i + 1} | ${md(a)} | ${md(F.BS.ALLERGENE_UMFANG[i]?.umfasst ?? "")} |`), "");
bm.push("### Allergene bei loser Ware (Recherche, `LOSE_WARE`)", "", `Rechtsgrundlage (Fußtext des Aushangs): ${F.BS.LOSE_WARE.rechtsgrundlage}`, "", `Anforderung: ${F.BS.LOSE_WARE.anforderung}`, "", "Schriftliche Formen:", ...F.BS.LOSE_WARE.formen.map((t) => `- ${t}`), "");
bm.push("### Belehrung nach § 43 IfSG: Tätigkeitsverbote, Krankheitszeichen, Lebensmittel (Abschnitt „Tätigkeitsverbote nach § 42 Abs. 1 IfSG“)", "", "Personen (§ 42 Abs. 1 IfSG):", ...F.BS.IFSG.personen.map((t) => `- ${t}`), "", "Krankheitszeichen („Woran Sie das erkennen“):", ...F.BS.IFSG.symptome.map((t) => `- ${t}`), "", "Lebensmittel (§ 42 Abs. 2 IfSG):", ...F.BS.IFSG.lebensmittel.map((t) => `- ${t}`), "");
bm.push("### HACCP: Prozessschritte, Entscheidungshilfe für CCP, Flexibilität, Aufbewahrung (E-166)", "", `Prozessschritte auf dem leeren Blatt: ${F.PROZESSSCHRITTE.join(", ")}`, "", `Entscheidungshilfe (${F.CCP_FRAGEN_QUELLE}):`, ...F.CCP_FRAGEN.map((t, i) => `${i + 1}. ${t}`), "", `Begründungen zum Antippen: ${F.CCP_BEGRUENDUNG.join(" · ")}`, "", `Fußtext Flexibilität: ${F.HACCP_FLEXIBEL}`, "", `Aufbewahrung (Startwert): ${F.HACCP_AUFBEWAHRUNG}`, "");
bm.push("### Hygieneplan Lebensmittelbetrieb: Themenbereiche und Querverweis", "", ...F.HYGIENE_THEMEN_LEBENSMITTEL.map((t, i) => `${i + 1}. ${t}`), "", `Fußtext: ${F.HYGIENE_VERWEIS_HACCP}`, "");
fs.writeFileSync(path.join(ZIEL, "bausteine.md"), bm.join("\n"));

// 3. Katalog: alle Gastro-Pflichten außer dem Preisverzeichnis (Preisrecht) und die Verpackungspflichten – Spalten wie beim Anwalt
const katalog = JSON.parse(fs.readFileSync(path.join(APP, "src/pflichten/katalog.json"), "utf8"));
const WEITERE = ["produkte.verpackung"];
const OHNE_ID = ["branche.gastro_preisverzeichnis"];
const fehlendeIds = WEITERE.filter((id) => !katalog.pflichten.some((p) => p.id === id));
const de = (x) => (x && typeof x === "object" ? (x.de ?? "") : (x ?? ""));
const ausloeser = (a) => (a ? de(a.label) || JSON.stringify(a) : "");
const kopf = ["Nr", "ID", "Titel", "Kurz", "Kategorie", "Auslöser", "Rechtsgrundlage", "Sanktion", "Schwere", "Status Recht", "Gültig ab", "Quellen", "Prüfstatus"];
const pflichten = katalog.pflichten.filter((p) => (p.id.startsWith("branche.gastro_") && !OHNE_ID.includes(p.id)) || WEITERE.includes(p.id)).sort((a, b) => String(a.katalog_nr).localeCompare(String(b.katalog_nr), "de", { numeric: true }) || a.id.localeCompare(b.id));
const zeilen = pflichten.map((p) => [p.katalog_nr, p.id, de(p.titel), de(p.kurz), p.kategorie, ausloeser(p.ausloeser), (p.rechtsgrundlage ?? []).join("; "), de(p.sanktion?.text), p.sanktion?.schwere, p.status_recht, p.gueltig_ab ?? "", (p.quellen ?? []).map((q) => q.url).join(" "), p.pruefung?.status]);
fs.writeFileSync(path.join(ZIEL, "katalog-lebensmittel.csv"), csv([kopf, ...zeilen]));

// 4. Prüflisten-Auszug: „Wer“ nennt Lebensmittelrecht/-hygiene oder Gesundheitsamt; „Fach“ mit Lebensmittel-Bezug; zur
//    Kenntnis die übrigen Punkte mit Lebensmittel-Bezug; Anhang: offene Katalogpunkte der Einträge aus Schritt 3
const WER = /Lebensmittel|Gesundheitsamt/;
const THEMA = /HACCP|Lebensmittel|Allergen|LMIV|LMIDV|IfSG|852\/2004|LMHV|Zusatzstoff|LMZDV|Trinkwasser|Rückverfolg|Mehrweg|VerpackG|VerpackDG|PPWR|Hygieneplan|Hygieneschulung|Kühl|Heißhalt|°C|Foodtruck|Eigenkontroll/;
const pl = fs.readFileSync(path.join(ROOT, "PRUEFLISTE.md"), "utf8").split("\n");
const punkte = pl
  .filter((z) => /^\| [GTJ]-\d+ \|/.test(z))
  .map((z) => ({ z, c: z.split("|").map((x) => x.trim()) }))
  .filter(({ c }) => c.length >= 5);
const lm = punkte.filter(({ c }) => WER.test(c[3]));
const fach = punkte.filter(({ c }) => !WER.test(c[3]) && /\bFach(beirat)?\b/.test(c[3]) && THEMA.test(c[2]));
const kenntnis = punkte.filter(({ c }) => !WER.test(c[3]) && !/\bFach(beirat)?\b/.test(c[3]) && THEMA.test(c[2]));
const ids = new Set(pflichten.map((p) => p.id));
const kZeilen = pl.filter((z) => /^\| K-\d+ \|/.test(z) && ids.has(z.split("|")[2].trim().replace(/`/g, "")));
const tab = (l) => ["| Nr. | Punkt | Wer | Quelle |", "|---|---|---|---|", ...l.map(({ z }) => z)];
const auszug = [
  "# Offene Fragen für die Lebensmittelhygiene",
  "",
  "Aus `PRUEFLISTE.md` (Stand des Codes). Die Nummern bleiben die der Prüfliste, damit Antworten zugeordnet werden können. Lange Punkte sind nicht gekürzt; manche betreffen mehrere Fachrichtungen – bitte nur den lebensmittelfachlichen Teil beantworten.",
  "",
  `## Für Sie: „Wer“ nennt Lebensmittelrecht, Lebensmittelhygiene oder Gesundheitsamt (${lm.length})`,
  "",
  ...tab(lm),
  "",
  `## Für Sie: „Wer“ nennt allgemein Fachleute, Thema Lebensmittel (${fach.length})`,
  "",
  ...tab(fach),
  "",
  `## Zur Kenntnis: Lebensmittel-Bezug, Federführung bei Rechtsanwalt, Steuerberatung oder Technik (${kenntnis.length})`,
  "",
  "Nicht Ihr Auftrag; wenn Ihnen fachlich etwas auffällt, nehmen wir den Hinweis gern.",
  "",
  ...tab(kenntnis),
  "",
  `## Anhang: offene Katalogpunkte der Einträge in \`katalog-lebensmittel.csv\` (${kZeilen.length})`,
  "",
  "Automatisch aus `fachlich_zu_pruefen` im Katalog. Meist: Frist, Sanktion oder Rechtsgrundlage fachlich ergänzen.",
  "",
  "| Nr. | Objekt | Katalog-Nr. | Punkt |",
  "|---|---|---|---|",
  ...kZeilen,
  "",
];
fs.writeFileSync(path.join(ZIEL, "PRUEFLISTE-lebensmittel.md"), auszug.join("\n"));

// 5. README
kopiere(path.join(HIER, "README.md"), path.join(ZIEL, "README.md"));
fs.rmSync(ROH, { recursive: true, force: true });
const pdfs = fs.existsSync(vorlagen) ? fs.readdirSync(vorlagen).length : 0;
console.log(`✓ Prüfmappe Lebensmittelhygiene in ${ZIEL}: ${pdfs} Vorlagen-PDFs (${VORLAGEN.length} Vorlagen), ${bausteine.length} Bausteine (${zaehle(/Temperaturwert/)} mit Temperaturwert), ${zeilen.length} Pflichten, ${lm.length + fach.length} Prüflisten-Punkte (+${kenntnis.length} zur Kenntnis, ${kZeilen.length} Katalogpunkte)`);
if (befunde.length) console.log(`! Satzspiegel-Befunde des Prüfwerkzeugs zu diesen Vorlagen:\n${befunde.join("\n")}`);
if (fehlendeVorlagen.length) console.log(`! Vorlagen nicht erzeugt: ${fehlendeVorlagen.join(", ")}`);
if (fehlendeIds.length) console.log(`! Katalogeinträge nicht gefunden: ${fehlendeIds.join(", ")}`);
