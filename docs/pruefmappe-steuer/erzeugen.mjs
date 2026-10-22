/**
 * Prüfmappe für die steuerliche Prüfung erzeugen (analog docs/pruefmappe-anwalt): steuerliche Vorlagen als PDF, die sechs
 * Jahresszenarien mit Erwartungswerten und Steuerberater-Paketen, Katalog und Regelwerte der Bereiche Steuern/Lohn als CSV,
 * Prüflisten-Auszug (Zeilen mit StB) nach Thema und die DATEV-Konten der App (SKR03/SKR04) aus dem Code.
 *
 *   node docs/pruefmappe-steuer/erzeugen.mjs <ziel>      # z. B. /tmp/pruefmappe-steuer
 *   KOSIT=<ordner>   optional: XRechnungen der Szenarien mit dem KoSIT-Validator prüfen (wie werkzeuge/jahr-szenario.mjs)
 *
 * Voraussetzung: `pnpm install`, Chromium (wie werkzeuge/dokumente-pruefen.mjs), pdftotext. Die Fachlogik wird hier gebaut.
 * Laufzeit: einige Minuten (sechs Szenarien). Schreibt nichts ins Repository.
 */
/* global process, console, URL */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HIER, "../..");
const APP = path.join(ROOT, "apps/mobile");
const FACH = path.join(ROOT, "packages/fachlogik");
const ZIEL = path.resolve(process.argv[2] ?? "pruefmappe-steuer");
const ROH = path.join(ZIEL, ".roh");
fs.mkdirSync(ROH, { recursive: true });
const kopiere = (von, nach) => {
  fs.mkdirSync(path.dirname(nach), { recursive: true });
  fs.copyFileSync(von, nach);
};
const zelle = (t) => `"${String(t ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const csv = (zeilen) => "﻿" + zeilen.map((z) => z.map(zelle).join(";")).join("\n") + "\n";
const md = (t) => String(t ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

// 0. Fachlogik bauen (die Szenarien lesen dist/)
execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { cwd: FACH, stdio: "inherit" });

// 1. Steuerliche Vorlagen (leer, Auswahl, voll) über das vorhandene Prüfwerkzeug, nur die relevanten übernehmen
const VORLAGEN = ["rechnung", "euer", "bilanz_guv", "ust_voranmeldung", "steuererklaerung", "verfahrensdokumentation", "kassenbuch", "kassenmeldung", "aufbewahrung", "lohnkonto", "sv_meldedaten"];
const alle = path.join(ROH, "vorlagen");
execFileSync("node", [path.join(APP, "werkzeuge/dokumente-pruefen.mjs"), alle], { cwd: APP, stdio: "inherit" });
const vorlagen = path.join(ZIEL, "vorlagen");
fs.rmSync(vorlagen, { recursive: true, force: true });
const fehlendeVorlagen = [];
for (const id of VORLAGEN) {
  const dateien = fs.readdirSync(alle).filter((f) => f.startsWith(`${id}-`) && f.endsWith(".pdf"));
  if (!dateien.length) fehlendeVorlagen.push(id);
  for (const f of dateien) kopiere(path.join(alle, f), path.join(vorlagen, f));
}

// 2. Sechs Jahresszenarien
const SZENARIEN = [
  { ordner: "1-cafe", skript: "jahr-szenario.mjs", titel: "Café Morgenrot (Einzelunternehmen, Kasse mit TSE)" },
  { ordner: "2-salon-gmbh", skript: "jahr-szenario-salon.mjs", titel: "Salon Sonne GmbH (Kapitalgesellschaft, Bilanz)" },
  { ordner: "3-freiberuf", skript: "jahr-szenario-freiberuf.mjs", titel: "Mira Lindqvist Grafikdesign (Kleinunternehmerin, freier Beruf)" },
  { ordner: "4-shop", skript: "jahr-szenario-shop.mjs", titel: "Kerzenwerk Lina Hoff (Onlineshop, OSS, igL)" },
  { ordner: "5-praxis", skript: "jahr-szenario-praxis.mjs", titel: "Physiotherapie am Markt (steuerfreie Umsätze, Vorsteueraufteilung)" },
  { ordner: "6-elektro", skript: "jahr-szenario-elektro.mjs", titel: "Elektro Brandt (Handwerk, Skonto, § 13b)" },
];
// Unterlagen, die eine Kanzlei bekäme bzw. für die steuerliche Prüfung braucht (ohne Arbeitsschutz, Datenschutz, PNG)
const STEUER_PDF = /Umsatzsteuer-Voranmeldung|OSS-Erklaerung|Zusammenfassende-Meldung|Einnahmen-Ueberschuss|Bilanz|Unterlagen-zur-Steuererklaerung|Kassenbuch|Kassenmeldung|Lohnkonto|Personalfragebogen|Verfahrensdokumentation|Aufbewahrungsplan/;
const szenarien = path.join(ZIEL, "szenarien");
fs.rmSync(szenarien, { recursive: true, force: true });
const uebersicht = [];
const beispiele = { storno: null, gutschrift: null, abschlag: null };
for (const s of SZENARIEN) {
  const roh = path.join(ROH, s.ordner);
  console.log(`… Szenario ${s.ordner}`);
  execFileSync("node", [path.join(APP, "werkzeuge", s.skript), roh], { cwd: APP, stdio: ["ignore", "ignore", "inherit"], env: process.env });
  const aus = path.join(szenarien, s.ordner);
  kopiere(path.join(roh, "SZENARIO.md"), path.join(aus, "SZENARIO.md"));
  for (const f of fs.readdirSync(roh).filter((f) => f.endsWith(".zip"))) kopiere(path.join(roh, f), path.join(aus, "steuerberater-pakete", f));
  for (const f of fs.readdirSync(path.join(roh, "pdf")).filter((f) => STEUER_PDF.test(f))) kopiere(path.join(roh, "pdf", f), path.join(aus, "pdf", f));
  for (const f of fs.readdirSync(path.join(roh, "rechnungen"))) {
    kopiere(path.join(roh, "rechnungen", f), path.join(aus, "rechnungen", f));
    for (const [art, muster] of [["storno", /Stornorechnung.*\.pdf$/], ["gutschrift", /Gutschrift.*\.pdf$/], ["abschlag", /Abschlagsrechnung.*\.pdf$/]]) if (!beispiele[art] && muster.test(f)) beispiele[art] = { datei: path.join(roh, "rechnungen", f), szenario: s.ordner };
  }
  // Ergebnis und Abweichungen aus SZENARIO.md
  const text = fs.readFileSync(path.join(roh, "SZENARIO.md"), "utf8");
  const ergebnis = text.match(/^(\d+) von (\d+) Prüfungen stimmen/m);
  const abweichungen = text.split("\n").filter((z) => z.startsWith("| ✗"));
  // KoSIT prüfen nur Café, Freiberuf und Praxis (mit KOSIT=…); Zeile „- KoSIT-Validator (…): datei: akzeptiert; …“
  const kz = text.match(/^- KoSIT-Validator \([^\n]*/m)?.[0];
  const kosit = kz ? `${(kz.match(/: akzeptiert/g) ?? []).length} XRechnungen akzeptiert, ${(kz.match(/ABGELEHNT/g) ?? []).length} abgelehnt` : "nicht geprüft";
  uebersicht.push({ ...s, ergebnis: ergebnis ? `${ergebnis[1]} von ${ergebnis[2]}` : "?", abweichungen, kosit });
}
for (const [art, b] of Object.entries(beispiele)) if (b) kopiere(b.datei, path.join(vorlagen, `rechnung-beispiel-${art}-aus-szenario-${b.szenario}.pdf`));
const ue = ["# Szenarien – Ergebnis dieses Laufs", "", `Erzeugt am ${new Date().toISOString().slice(0, 10)} mit dem aktuellen Code. Jede Zahl der App wird gegen eine unabhängige Rechnung (werkzeuge/jahr-szenario-*-daten.ts, ohne App-Funktionen) verglichen; Einzelheiten in \`<szenario>/SZENARIO.md\`.`, "", "| Szenario | Prüfungen stimmen | KoSIT |", "|---|---|---|"];
for (const u of uebersicht) ue.push(`| ${u.ordner} – ${u.titel} | ${u.ergebnis} | ${md(u.kosit || "–")} |`);
ue.push("", "## Abweichungen (✗) im Wortlaut", "");
for (const u of uebersicht) {
  ue.push(`### ${u.ordner}`, "");
  ue.push(...(u.abweichungen.length ? ["| | Bereich | Prüfung | App | erwartet |", "|---|---|---|---|---|", ...u.abweichungen] : ["Keine."]), "");
  if (u.kosit.includes("abgelehnt") && !u.kosit.includes(" 0 abgelehnt")) ue.push("KoSIT-Ablehnungen: siehe „Auffälligkeiten“ in SZENARIO.md.", "");
}
fs.writeFileSync(path.join(szenarien, "UEBERSICHT.md"), ue.join("\n"));

// 3. Katalog (Steuern, Lohn/Sozialversicherung, steuerliche Gründungs- und Abschlusspflichten) als CSV wie beim Anwalt
const katalog = JSON.parse(fs.readFileSync(path.join(APP, "src/pflichten/katalog.json"), "utf8"));
const LOHN = ["anmeldezeitraum_angeben", "lohnsteuer_anmeldung", "lohnabrechnung", "beitragsnachweis", "sv_beitraege", "umlagen_eau", "betriebsnummer", "sofortmeldung", "sv_anmeldung", "sv_abmeldung", "sv_jahresmeldung", "minijob_grenze", "mindestlohn", "arbeitszeit_milog", "lohnnachweis_bg"].map((x) => `personal.${x}`);
const WEITERE = ["gruendung.taetigkeit_einordnen", "gruendung.elster_konto", "gruendung.fragebogen_steuerliche_erfassung", "gruendung.ust_idnr", "gesellschaft.jahresabschluss", "gesellschaft.offenlegung", "gesellschaft.offenlegung_abweichendes_gj"];
const steuerlich = (id) => id.startsWith("steuern.") || LOHN.includes(id) || WEITERE.includes(id);
const de = (x) => (x && typeof x === "object" ? (x.de ?? "") : (x ?? ""));
const ausloeser = (a) => (a ? de(a.label) || JSON.stringify(a) : "");
const kopf = ["Nr", "ID", "Titel", "Kurz", "Kategorie", "Auslöser", "Rechtsgrundlage", "Sanktion", "Schwere", "Status Recht", "Gültig ab", "Quellen", "Prüfstatus"];
const pflichten = katalog.pflichten.filter((p) => steuerlich(p.id)).sort((a, b) => String(a.katalog_nr).localeCompare(String(b.katalog_nr), "de", { numeric: true }) || a.id.localeCompare(b.id));
const zeilen = pflichten.map((p) => [p.katalog_nr, p.id, de(p.titel), de(p.kurz), p.kategorie, ausloeser(p.ausloeser), (p.rechtsgrundlage ?? []).join("; "), de(p.sanktion?.text), p.sanktion?.schwere, p.status_recht, p.gueltig_ab ?? "", (p.quellen ?? []).map((q) => q.url).join(" "), p.pruefung?.status]);
fs.writeFileSync(path.join(ZIEL, "katalog-steuer.csv"), csv([kopf, ...zeilen]));
// Regelwerte (Grenzen, Sätze, Fristen) der Bereiche Steuern und Personal
const werte = (katalog.regelwerte ?? []).filter((r) => /^(steuern|personal|lohn|sv)\./.test(r.id));
fs.writeFileSync(path.join(ZIEL, "regelwerte-steuer.csv"), csv([["Nr", "ID", "Bezeichnung", "Wert", "Einheit", "Gültig ab", "Gültig bis", "Rechtsgrundlage", "Offene Punkte", "Prüfstatus"], ...werte.map((r) => [r.katalog_nr, r.id, de(r.bezeichnung), typeof r.wert === "object" ? JSON.stringify(r.wert) : r.wert, r.einheit, r.gueltig_ab ?? "", r.gueltig_bis ?? "", (r.rechtsgrundlage ?? []).join("; "), (r.fachlich_zu_pruefen ?? []).join(" / "), r.pruefung?.status])]));

// 4. Prüflisten-Auszug: alle Zeilen, deren Spalte „Wer“ StB enthält, nach Thema
const THEMEN = [
  ["datev", "DATEV-Konten, Buchungsstapel und Steuerberater-Paket"],
  ["kasse", "Kasse und GoBD"],
  ["ust", "Umsatzsteuer (Rechnung, E-Rechnung, Voranmeldung, Skonto, § 13b, igL/OSS, Kleinunternehmer)"],
  ["euer", "EÜR, Bilanz, Jahreserklärungen und ihre Fristen"],
  ["lohn", "Lohn und Sozialversicherung"],
  ["aufbewahrung", "Aufbewahrung und Verfahrensdokumentation"],
  ["sonst", "Sonstiges (Katalog allgemein, Gründung, ELSTER/StBerG, Vorlagen bereichsübergreifend)"],
];
const ZUORDNUNG = {
  datev: ["T-79", "T-100", "T-102", "T-113", "T-115", "T-117", "T-118"],
  kasse: ["T-68", "T-98"],
  ust: ["G-06", "T-06", "T-07", "T-08", "T-09", "T-10", "T-11", "T-47", "T-69", "T-70", "T-72", "T-76", "T-81", "T-87", "T-88", "T-89", "T-95", "T-97", "T-101", "T-104", "T-109", "T-110", "T-111"],
  euer: ["G-18", "T-58", "T-73", "T-93"],
  lohn: ["T-12", "T-14", "T-15", "T-50", "T-51", "T-61", "T-96"],
  aufbewahrung: ["G-09", "G-21", "T-54", "T-74"],
};
// Neue Zeilen ohne feste Zuordnung: nach Stichworten (erste Übereinstimmung)
const STICHWORTE = [
  ["datev", /DATEV|Buchungsstapel|\bBU\b|SKR0[34]|Steuerberater-Paket/],
  ["kasse", /Kasse|GoBD|TSE|Z-Bon|Kassenbuch/],
  ["lohn", /Lohn|Sofortmeldung|Sozialversicherung|\bSV\b|Minijob|DEÜV/],
  ["aufbewahrung", /Aufbewahrung|Verfahrensdoku|Löschfrist/],
  ["ust", /USt|Umsatzsteuer|Voranmeldung|§ 13b|OSS|Kleinunternehm|Rechnung|Skonto|igL|§ 14\b/],
  ["euer", /EÜR|Bilanz|GuV|Jahresabschluss|Steuererklärung/],
];
const thema = (nr, punkt) => Object.entries(ZUORDNUNG).find(([, l]) => l.includes(nr))?.[0] ?? STICHWORTE.find(([, re]) => re.test(punkt))?.[0] ?? "sonst";
const pl = fs.readFileSync(path.join(ROOT, "PRUEFLISTE.md"), "utf8").split("\n");
const stb = pl
  .filter((z) => z.startsWith("| ") && !z.startsWith("| Nr."))
  .map((z) => ({ z, c: z.split("|").map((x) => x.trim()) }))
  .filter(({ c }) => c.length >= 5 && /\bStB\b/.test(c[3]));
const gruppen = Object.fromEntries(THEMEN.map(([k]) => [k, []]));
for (const { z, c } of stb) gruppen[thema(c[1], c[2])].push(z);
// Katalogpunkte (K-…) der Pflichten und Regelwerte aus katalog-steuer.csv bzw. regelwerte-steuer.csv
const ids = new Set([...pflichten.map((p) => p.id), ...werte.map((r) => r.id)]);
const kZeilen = pl.filter((z) => /^\| K-\d+ \|/.test(z) && ids.has(z.split("|")[2].trim().replace(/`/g, "")));
const auszug = ["# Offene Fragen für die Steuerberatung", "", `Alle Zeilen aus \`PRUEFLISTE.md\`, in deren Spalte „Wer“ StB steht (auch StB/RA, RA/StB, StB/Tech …), nach Thema – ${stb.length} Punkte. Die Nummern bleiben die der Prüfliste, damit Antworten zugeordnet werden können. Lange Punkte sind in der Prüfliste nicht gekürzt.`, ""];
for (const [k, titel] of THEMEN) {
  if (!gruppen[k].length) continue;
  auszug.push(`## ${titel}`, "", "| Nr. | Punkt | Wer | Quelle |", "|---|---|---|---|", ...gruppen[k], "");
}
auszug.push("## Anhang: offene Katalogpunkte der steuerlichen Pflichten und Regelwerte", "", `Automatisch aus \`fachlich_zu_pruefen\` im Katalog (${kZeilen.length} Punkte zu den Einträgen in \`katalog-steuer.csv\` und \`regelwerte-steuer.csv\`). Meist: Frist, Sanktion oder Rechtsgrundlage fachlich ergänzen.`, "", "| Nr. | Objekt | Katalog-Nr. | Punkt |", "|---|---|---|---|", ...kZeilen, "");
fs.writeFileSync(path.join(ZIEL, "PRUEFLISTE-steuer.md"), auszug.join("\n"));

// 5. DATEV-Konten und BU-Schlüssel der App aus dem Code (gebaute Fachlogik)
const F = await import(path.join(FACH, "dist/index.js"));
const QUELLEN = ["buchungen.ts", "kasse.ts", "skonto.ts", "sachentnahmen.ts", "belege.ts"];
// Konten, die in einer Kommentarzeile mit „UNSICHER“ stehen
const unsicher = new Set();
for (const q of QUELLEN) {
  for (const z of fs.readFileSync(path.join(FACH, "src", q), "utf8").split("\n")) if (/^\s*(\*|\/\/)/.test(z) && /UNSICHER/.test(z)) for (const n of z.match(/\b\d{4}\b/g) ?? []) unsicher.add(n);
}
const K3 = F.BUCHUNGSKONTEN.SKR03;
const K4 = F.BUCHUNGSKONTEN.SKR04;
const auto = (k, r) => F.AUTOMATIKKONTEN[r].includes(k);
const SACH = [
  ["Forderungen aus L+L ohne Kontokorrent (Ausgangsrechnungen, Skonto, auf Rechnung an der Kasse)", K3.forderungen, K4.forderungen, "–", "buchungen.ts BUCHUNGSKONTEN"],
  ["Verbindlichkeiten aus L+L ohne Kontokorrent (Belege mit Zahlungsweg Bank, Gutschriften)", K3.verbindlichkeiten, K4.verbindlichkeiten, "–", "buchungen.ts"],
  ["Kasse (Bargeld laut Tagesabschluss, Barbelege ab dem ersten Kassenabschluss)", K3.kasse, K4.kasse, "–", "buchungen.ts, kasse.ts"],
  ["Geldtransit (Karten-/App-Zahlungen der Kasse, Bargeld zur Bank, Kartentrinkgeld)", K3.geldtransit, K4.geldtransit, "–", "kasse.ts"],
  ["Privateinlagen (privat bezahlte Belege, Einlagen in die Kasse, Barbelege vor dem ersten Kassenabschluss) – nicht bei Kapitalgesellschaften", K3.privateinlagen, K4.privateinlagen, "–", "buchungen.ts belegGegenkonto, kasse.ts"],
  ["StB-Prüfung B-6: Verrechnungskonto Gesellschafter einer Kapitalgesellschaft (privat ausgelegte Belege, Barbelege vor dem ersten Kassenabschluss, Einlagen/Entnahmen der Kasse) – SKR03 0731 „Verbindlichkeiten gegenüber Gesellschaftern – Restlaufzeit bis 1 Jahr“ (korrigierter Bericht vom 22.10.2026, nicht 0755); SKR04 3560 UNSICHER – SKR04-Gegenstück zu 0731 laut Kanzlei folgt; kanzleiabhängig", K3.verrechnungGesellschafter, K4.verrechnungGesellschafter, "–", "buchungen.ts belegGegenkonto, kasse.ts, Kontenvorgaben"],
  ["StB-Prüfung A-4/B-6: Bank – Zahlungseingänge bilanzierender Betriebe (Bank an Forderungen), mit Kontenvorgabe „Belege gegen Bank“ auch Belege", K3.bank, K4.bank, "–", "buchungen.ts zahlungsBuchungenRechnung, Kontenvorgaben"],
  ["Privatentnahmen (Bargeld aus der Kasse, Gegenkonto der Sachentnahmen)", K3.privatentnahmen, K4.privatentnahmen, "–", "kasse.ts, sachentnahmen.ts"],
  ["Erlöse 19 % (auch Kassenüberschuss laut Zählung, Einlösung Mehrzweck-Gutschein)", K3.erloese[19], K4.erloese[19], "kein BU (Automatik vorausgesetzt)", "buchungen.ts erloeskonto, kasse.ts"],
  ["Erlöse 7 %", K3.erloese[7], K4.erloese[7], "kein BU (Automatik vorausgesetzt)", "buchungen.ts erloeskonto"],
  ["Erlöse ohne USt: steuerfreie Umsätze (§ 4 Nr. 8 ff., z. B. Heilbehandlung § 4 Nr. 14), Kz 48", K3.erloese[0], K4.erloese[0], "–", "buchungen.ts erloeskonto"],
  ["StB-Prüfung B-2: Erlöse Nullsteuersatz (§ 12 Abs. 3 UStG, Photovoltaik), Kz 87 – Nummer im Bericht offen („in Rewe nach Nullsteuersatz suchen“), Standard 8290/4290 laut Herstellerangaben", K3.erloese.nullsatz, K4.erloese.nullsatz, "kein BU (Automatik vorausgesetzt)", "buchungen.ts erloeskonto, Kontenvorgaben"],
  ["OSS: Erlöse mit der Umsatzsteuer des Bestimmungslands (§ 18j UStG) – Land in Feld 40 (bei Privatpersonen nur das Länderkennzeichen), Satz in Feld 41; Kontenbereich von der Kanzlei bestätigt (Nachtrag 22.10.2026)", K3.erloese.oss, K4.erloese.oss, "kein BU (Steuerschlüssel zu klären)", "buchungen.ts erloeskonto, Kontenvorgaben"],
  ["Erlöse Kleinunternehmer (§ 19 UStG)", K3.erloese.ku, K4.erloese.ku, "–", "buchungen.ts erloeskonto"],
  ["Erlöse steuerfreie innergemeinschaftliche Lieferung (mit USt-IdNr. in Feld „EU-Land u. UStID“)", K3.erloese.igl, K4.erloese.igl, "–", "buchungen.ts erloeskonto"],
  ["Erlöse § 13b im Inland (Leistungsempfänger schuldet die Steuer)", K3.erloese.rc13b, K4.erloese.rc13b, "–", "buchungen.ts erloeskonto"],
  ["Erlöse sonstige Leistung an Unternehmen im übrigen Gemeinschaftsgebiet (Kz 21) – simulierte StB nannte 8338", K3.erloese.eu, K4.erloese.eu, "–", "buchungen.ts erloeskonto"],
  ["Erlöse im Drittland steuerbare Leistung (im Inland nicht steuerbar)", K3.erloese.drittland, K4.erloese.drittland, "–", "buchungen.ts erloeskonto"],
  ["Gewährte Skonti 19 % (§ 17 UStG, zum Zahltag)", K3.skontiGewaehrt[19], K4.skontiGewaehrt[19], "kein BU (Automatik)", "buchungen.ts skontoBuchungenRechnung"],
  ["Gewährte Skonti 7 %", K3.skontiGewaehrt[7], K4.skontiGewaehrt[7], "kein BU (Automatik)", "buchungen.ts"],
  ["Gewährte Skonti ohne USt (Kleinunternehmer, 0 %)", K3.skontiGewaehrt[0], K4.skontiGewaehrt[0], "–", "buchungen.ts"],
  ["Gewährte Skonti auf innergemeinschaftliche Lieferungen (mit USt-IdNr.)", K3.skontiGewaehrtIgl, K4.skontiGewaehrtIgl, "–", "buchungen.ts"],
  ["Gewährte Skonti auf Umsätze mit Steuerschuld des Empfängers (§ 13b, EU-Leistung)", K3.skontiGewaehrtRc, K4.skontiGewaehrtRc, "–", "buchungen.ts"],
  ["Erhaltene Skonti 19 % Vorsteuer (nur Kategorie „Waren und Material“; sonst mindert das Skonto das Aufwandskonto mit dem BU des Belegs)", K3.skontiErhalten[19], K4.skontiErhalten[19], "kein BU (Automatik)", "buchungen.ts skontoBuchungenBelege"],
  ["Erhaltene Skonti 7 % Vorsteuer", K3.skontiErhalten[7], K4.skontiErhalten[7], "kein BU (Automatik)", "buchungen.ts"],
  ["Erhaltene Skonti ohne Vorsteuer", K3.skontiErhalten[0], K4.skontiErhalten[0], "–", "buchungen.ts"],
  ["Gutschrift (§ 14 Abs. 2 Satz 2 UStG) als Aufwand „bezogene Leistungen“", K3.gutschrift, K4.gutschrift, "BU 9/8 bei ausgewiesener Steuer", "buchungen.ts gutschriftBuchungen"],
  ["Verkaufte, nicht eingelöste Mehrzweck-Gutscheine (§ 3 Abs. 15 UStG) – sonstige Verbindlichkeiten", K3.gutscheinVerbindlichkeit, K4.gutscheinVerbindlichkeit, "–", "kasse.ts"],
  ["Kassendifferenz Fehlbetrag laut Zählung (sonstiger Aufwand, ohne Vorsteuer; Überschuss: Erlöse 19 % oder per Kontenvorgabe z. B. 2700/4830 ohne USt)", K3.kassendifferenzAufwand, K4.kassendifferenzAufwand, "–", "kasse.ts, Kontenvorgaben"],
  ["StB-Prüfung B-10: Anlagen – Maschinen", K3.anlagen.maschinen, K4.anlagen.maschinen, "BU 9/8 bei Vorsteuer", "buchungen.ts belegSachkonto, Kontenvorgaben"],
  ["StB-Prüfung B-10: Anlagen – Betriebs- und Geschäftsausstattung (Standard der Kategorie „Anschaffung über 800 €“)", K3.anlagen.bga, K4.anlagen.bga, "BU 9/8 bei Vorsteuer", "buchungen.ts belegSachkonto"],
  ["StB-Prüfung B-10: Anlagen – Fahrzeuge", K3.anlagen.kfz, K4.anlagen.kfz, "BU 9/8 bei Vorsteuer", "buchungen.ts belegSachkonto"],
  ["StB-Prüfung B-10: Anlagen – Software", K3.anlagen.software, K4.anlagen.software, "BU 9/8 bei Vorsteuer", "buchungen.ts belegSachkonto"],
  ["Sachentnahme Waren 19 % (unentgeltliche Wertabgabe § 3 Abs. 1b UStG, brutto)", K3.sachentnahme[19], K4.sachentnahme[19], "kein BU (Automatik)", "sachentnahmen.ts"],
  ["Sachentnahme Waren 7 %", K3.sachentnahme[7], K4.sachentnahme[7], "kein BU (Automatik)", "sachentnahmen.ts"],
  ["§ 13b-Eingangsleistung: Bauleistung eines inländischen Unternehmers, mit Vorsteuerabzug", F.KONTEN_13B.SKR03.mit.bau, F.KONTEN_13B.SKR04.mit.bau, "kein BU (Automatik USt und VSt 19 %)", "buchungen.ts KONTEN_13B"],
  ["§ 13b-Eingangsleistung: sonstige Leistung aus dem übrigen Gemeinschaftsgebiet, mit Vorsteuerabzug", F.KONTEN_13B.SKR03.mit.eu, F.KONTEN_13B.SKR04.mit.eu, "kein BU (Automatik USt und VSt 19 %)", "buchungen.ts KONTEN_13B"],
  ["§ 13b-Eingangsleistung: Bauleistung, ohne Vorsteuerabzug (Kleinunternehmer, steuerfreie Umsätze)", F.KONTEN_13B.SKR03.ohne.bau, F.KONTEN_13B.SKR04.ohne.bau, "kein BU (Automatik USt 19 %)", "buchungen.ts KONTEN_13B"],
  ["§ 13b-Eingangsleistung: sonstige Leistung aus dem übrigen Gemeinschaftsgebiet, ohne Vorsteuerabzug", F.KONTEN_13B.SKR03.ohne.eu, F.KONTEN_13B.SKR04.ohne.eu, "kein BU (Automatik USt 19 %)", "buchungen.ts KONTEN_13B"],
];
const HINWEIS = {
  homeoffice: "StB-Prüfung B-11: 4288/6348 „Aufwendungen für ein häusliches Arbeitszimmer“ (Nummer in Rewe prüfen), per Kontenvorgabe änderbar",
  personal: "nur in der Belegliste, nicht im Stapel (Lohn bucht die Lohnbuchhaltung)",
  anlage: "Anlagegut; Konto nach Art (B-10: Maschinen, BGA, Kfz, Software – siehe oben); AfA bucht die App nicht",
  bewirtung: "Aufteilung 70/30 (4650/4654) bucht die Kanzlei; die EÜR-Übernahme stellt nur 70 % als Ausgabe ein (E-3)",
  waren: "Kleinunternehmer: 3200/5200 ohne BU statt 3400/5400 mit BU 40 (StB-Prüfung A-2)",
};
const markierung = (a, b) => ([a, b].some((k) => unsicher.has(k)) ? "**UNSICHER**" : "fachlich zu prüfen");
const kt = ["# DATEV-Konten und BU-Schlüssel der App", "", "Aus dem Code erzeugt (`packages/fachlogik/src/buchungen.ts`, `belege.ts`, `kasse.ts`, `skonto.ts`, `sachentnahmen.ts`). Spalte „Markierung“: **UNSICHER** = im Code ausdrücklich als unsicher markiert (Kommentar mit „UNSICHER (PRUEFLISTE)“); „fachlich zu prüfen“ = im Code als zu prüfen vermerkt, aber nicht als unsicher. Kein Konto ist bisher von einer Steuerberatung bestätigt. Die Kontonummern stammen zum Teil von simulierten Steuerberater-Durchsichten („nach meinem Stand“).", "", "Die App bucht Bruttobeträge; ob ein Konto Automatikkonto ist, entscheidet über den BU-Schlüssel (siehe unten). Der Kontenrahmen (SKR03/SKR04) sowie Berater- und Mandantennummer stellt der Nutzer in der App ein.", "", "## Sachkonten, Erlöse, Skonto, Kasse, § 13b", "", "| Zweck | SKR03 | SKR04 | BU im Export | Quelle | Markierung |", "|---|---|---|---|---|---|"];
for (const [zweck, a, b, bu, q] of SACH) kt.push(`| ${md(zweck)} | ${a} | ${b} | ${md(bu)} | ${q} | ${markierung(a, b)} |`);
kt.push("", "## Aufwandskonten der Belegkategorien", "", "Der Nutzer wählt je Beleg eine Kategorie in Alltagssprache; daraus folgen Konto und Zeile der Anlage EÜR (`belege.ts` KATEGORIEN). Automatikkonten laut `AUTOMATIKKONTEN`; alle anderen gelten als Konten ohne Steuerautomatik.", "", "| Kategorie | SKR03 | SKR04 | Automatik | BU im Export | Zeile Anlage EÜR (Wortlaut der App) | Markierung / Hinweis |", "|---|---|---|---|---|---|---|");
for (const k of F.KATEGORIEN) {
  const saetze = [...new Set([...Object.keys(k.skr03), ...Object.keys(k.skr04)])].sort((x, y) => Number(y) - Number(x));
  const verschieden = new Set(saetze.map((s) => k.skr03[s])).size > 1;
  for (const s of verschieden ? saetze : ["19"]) {
    const a = k.skr03[s];
    const b = k.skr04[s];
    const automatik = auto(a, "SKR03") || auto(b, "SKR04");
    const bu = s === "0" && verschieden ? "kein BU (ohne Steuer)" : automatik ? "kein BU; ohne Vorsteuerabzug BU 40" : "BU 9 (19 %) / 8 (7 %) bei Vorsteuer, sonst keiner";
    const hinweis = [markierung(a, b), HINWEIS[k.id], k.hinweis].filter(Boolean).join("; ");
    kt.push(`| ${md(k.titel)}${verschieden ? ` (${s} %)` : ""} | ${a} | ${b} | ${automatik ? "ja" : "nein"} | ${bu} | ${md(k.euer)} | ${md(hinweis)} |`);
  }
}
kt.push("", "## BU-Schlüssel", "", "| BU | Bedeutung in der App | Wann gesetzt | Markierung |", "|---|---|---|---|");
kt.push(`| ${F.BU_VORSTEUER[19]} | Vorsteuer 19 % | Aufwandskonto ohne Automatik, Beleg mit Vorsteuerabzug (auch Skonto auf solche Belege, Gutschriften) | fachlich zu prüfen |`);
kt.push(`| ${F.BU_VORSTEUER[7]} | Vorsteuer 7 % | wie oben, 7 % | fachlich zu prüfen |`);
kt.push(`| ${F.BU_OHNE_STEUER} | Aufhebung der Automatik („keine Steuer“) | Automatikkonto, Beleg ohne Vorsteuerabzug (z. B. Kleinunternehmer) | fachlich zu prüfen (Fehler oder Warnung auf Nicht-Automatikkonten? T-113) |`);
kt.push("| – | kein Schlüssel | Erlöse, Skonto- und § 13b-Konten (Automatik vorausgesetzt), Sätze 16 % / 5 % (2020) | fachlich zu prüfen |");
kt.push("", "Automatikkonten laut Code: SKR03 " + F.AUTOMATIKKONTEN.SKR03.join(", ") + "; SKR04 " + F.AUTOMATIKKONTEN.SKR04.join(", ") + ".", "", "StB-Prüfung A-1: Bei Belegbuchungen steht das Zahlungskonto (Verbindlichkeiten, Kasse, Bank, Privat bzw. Verrechnungskonto) in Feld 7 „Konto“ im Haben, das Sachkonto mit BU-Schlüssel in Feld 8 „Gegenkonto“. Nicht gebucht werden: Zahlungen vom Bankkonto (Ausnahme: Zahlungseingänge auf Rechnungen bilanzierender Betriebe), USt-Vorauszahlungen, AfA, Löhne. Abweichende Konten der Kanzlei: Kontenvorgaben (kontenvorgaben.md).", "", "## Prüfpunkte, die der Code selbst nennt (`pruefpunkteBuchungen()`)", "");
F.pruefpunkteBuchungen().forEach((p, i) => kt.push(`${i + 1}. ${p}`));
kt.push("");
fs.writeFileSync(path.join(ZIEL, "konten.md"), kt.join("\n"));

// 6. README
kopiere(path.join(HIER, "README.md"), path.join(ZIEL, "README.md"));
kopiere(path.join(HIER, "kontenvorgaben.md"), path.join(ZIEL, "kontenvorgaben.md"));
// Umsetzung des Prüfberichts Heckler und Busch (mit Nachtrag vom 22.10.2026)
kopiere(path.join(HIER, "umsetzung-2026-10-22.md"), path.join(ZIEL, "UMSETZUNG.md"));
fs.rmSync(ROH, { recursive: true, force: true });
const anzahl = (d) => fs.readdirSync(d, { recursive: true }).filter((f) => fs.statSync(path.join(d, f)).isFile()).length;
console.log(`✓ Prüfmappe Steuer in ${ZIEL}: ${anzahl(vorlagen)} Vorlagen-PDFs, ${SZENARIEN.length} Szenarien (${anzahl(szenarien)} Dateien), ${zeilen.length} Pflichten, ${werte.length} Regelwerte, ${stb.length} Prüflisten-Punkte, ${SACH.length + F.KATEGORIEN.length} Kontenzeilen`);
if (fehlendeVorlagen.length) console.log(`! Vorlagen nicht erzeugt: ${fehlendeVorlagen.join(", ")}`);
for (const [art, b] of Object.entries(beispiele)) if (!b) console.log(`! Kein Beispiel „${art}“ in den Szenarien gefunden`);
