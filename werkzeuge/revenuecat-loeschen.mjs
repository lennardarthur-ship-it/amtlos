/**
 * Löschfrist bei RevenueCat einhalten (E-159): Daten zu App-Kennungen, deren Abo seit mehr als 90 Tagen beendet ist,
 * bei RevenueCat löschen lassen. Monatlich ausführen – so gilt das Versprechen im Datenschutzhinweis „spätestens vier
 * Monate nach Ende deines Abos“ (90 Tage + höchstens ein Monat bis zum nächsten Lauf).
 *
 * Eingabe: CSV aus den „Scheduled Data Exports“ von RevenueCat (Version 3; Felder rc_original_app_user_id,
 * effective_end_time). Ohne --ausfuehren wird nur aufgelistet (Probelauf).
 *
 *   node werkzeuge/revenuecat-loeschen.mjs <export.csv>                     # Probelauf: wer wäre fällig?
 *   REVENUECAT_SECRET_KEY=sk_… node werkzeuge/revenuecat-loeschen.mjs <export.csv> --ausfuehren
 *
 * Löschen: DELETE https://api.revenuecat.com/v1/subscribers/{app_user_id} (endgültig, läuft bei RevenueCat asynchron).
 * Den geheimen Schlüssel nie ins Repository legen.
 */
/* global process, console, fetch */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const FRIST_TAGE = 90;

/** CSV mit Anführungszeichen (RFC 4180) in Zeilen-Objekte. */
export function csvLesen(text) {
  const zeilen = [];
  let feld = "";
  let zeile = [];
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQuote = false;
      else feld += c;
    } else if (c === '"') inQuote = true;
    else if (c === ",") { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      zeile.push(feld); feld = "";
      if (zeile.some((f) => f !== "")) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  if (feld !== "" || zeile.length) { zeile.push(feld); if (zeile.some((f) => f !== "")) zeilen.push(zeile); }
  const [kopf = [], ...rest] = zeilen;
  return rest.map((z) => Object.fromEntries(kopf.map((k, i) => [k.trim(), z[i] ?? ""])));
}

/**
 * App-Kennungen, deren letztes Abo-Ende (effective_end_time) mehr als FRIST_TAGE zurückliegt. Eine Kennung mit
 * einer Zeile ohne Ende (läuft noch) oder mit einem Ende in der Zukunft wird nie gelöscht.
 */
export function faellig(zeilen, jetzt = new Date(), fristTage = FRIST_TAGE) {
  const grenze = jetzt.getTime() - fristTage * 86_400_000;
  const letzte = new Map();
  for (const z of zeilen) {
    const id = (z.rc_original_app_user_id ?? "").trim();
    if (!id) continue;
    const ende = z.effective_end_time ? Date.parse(z.effective_end_time) : NaN;
    const bisher = letzte.get(id);
    if (Number.isNaN(ende)) letzte.set(id, Infinity);
    else if (bisher === undefined || ende > bisher) letzte.set(id, ende);
  }
  return [...letzte].filter(([, ende]) => ende !== Infinity && ende < grenze).map(([id]) => id).sort();
}

async function main() {
  const [datei, ...flags] = process.argv.slice(2);
  if (!datei) { console.error("Aufruf: node werkzeuge/revenuecat-loeschen.mjs <export.csv> [--ausfuehren]"); process.exit(2); }
  const ids = faellig(csvLesen(fs.readFileSync(datei, "utf8")));
  console.log(`${ids.length} App-Kennung(en) mit Abo-Ende vor mehr als ${FRIST_TAGE} Tagen.`);
  if (!flags.includes("--ausfuehren")) { for (const id of ids) console.log(`  ${id}`); console.log("Probelauf – nichts gelöscht. Mit --ausfuehren löschen."); return; }
  const schluessel = process.env.REVENUECAT_SECRET_KEY;
  if (!schluessel) { console.error("REVENUECAT_SECRET_KEY fehlt (geheimer API-Schlüssel, nicht der öffentliche appl_…)"); process.exit(2); }
  let fehler = 0;
  for (const id of ids) {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${schluessel}` } });
    if (r.ok) console.log(`  ✓ ${id}`);
    else { fehler++; console.log(`  ✗ ${id}: HTTP ${r.status}`); }
  }
  console.log(fehler ? `${fehler} Fehler – erneut ausführen.` : "Fertig.");
  if (fehler) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
