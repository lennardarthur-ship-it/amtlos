/**
 * Landingpage bauen (E-132): setzt die echten Zahlen aus dem Katalog (profile.json, erzeugt aus dem Pflichten-Check)
 * in seite.html ein und schreibt dist/ zum Hochladen: index.html (alles vor `<!-- /kopf -->` kommt in den <head>),
 * impressum.html und datenschutz.html aus apps/mobile/src/rechtliches.ts (fehlende Angaben: „folgt vor dem Start“ –
 * nichts wird erfunden), Bilder, Schriften (selbst gehostet, OFL), Favicon.
 *
 * seite.json schaltet vor dem Start vorbereitete Einträge ein:
 *   url         – Adresse der Website, z. B. „https://amtlos.de“ → canonical, og:url, absolutes og:image
 *   appStoreId  – App-ID aus App Store Connect (nur Ziffern) → Smart-App-Banner (apple-itunes-app)
 *
 *   node apps/website/bauen.mjs [ausgabe]     # Standard: apps/website/dist
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.resolve(process.argv[2] ?? path.join(HIER, "dist"));
const lies = (d) => fs.readFileSync(path.join(HIER, d), "utf8");
const cfg = JSON.parse(lies("seite.json"));
const url = (cfg.url ?? "").replace(/\/+$/, "");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Rechtstexte der App lesen (nicht ändern): rechtliches.ts mit esbuild nach ESM übersetzen
async function rechtliches() {
  const pnpm = path.resolve(HIER, "../../node_modules/.pnpm");
  const ordner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
  if (!ordner) throw new Error("esbuild nicht gefunden (pnpm install)");
  const ziel = path.join(OUT, ".rechtliches.mjs");
  execFileSync(path.join(pnpm, ordner, "node_modules/esbuild/bin/esbuild"), [path.resolve(HIER, "../mobile/src/rechtliches.ts"), "--format=esm", `--outfile=${ziel}`, "--log-level=warning"]);
  const m = await import(`${ziel}?${Date.now()}`);
  fs.rmSync(ziel);
  return m;
}

fs.mkdirSync(path.join(OUT, "bilder"), { recursive: true });
const recht = await rechtliches();

// Kopf: vorbereitete Einträge nur, wenn in seite.json gesetzt
const extra = [
  url ? `<link rel="canonical" href="${esc(url)}/">\n<meta property="og:url" content="${esc(url)}/">` : "<!-- canonical und og:url: url in apps/website/seite.json eintragen -->",
  /^\d+$/.test(cfg.appStoreId ?? "") ? `<meta name="apple-itunes-app" content="app-id=${cfg.appStoreId}">` : "<!-- Smart-App-Banner: appStoreId in apps/website/seite.json eintragen -->",
].join("\n");
const ganz = lies("seite.html")
  .replace("__PROFILE__", JSON.stringify(JSON.parse(lies("profile.json"))))
  .replace("__KOPF_EXTRA__", extra)
  .replace("__OG_BILD__", `${url ? `${url}/` : ""}bilder/og.jpg`);
const [kopf, rumpf] = ganz.split("<!-- /kopf -->");
if (!rumpf) throw new Error("Marke <!-- /kopf --> fehlt in seite.html");
const dokument = (k, r) => `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${k.trim()}\n</head>\n<body>\n${r.trim()}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(OUT, "index.html"), dokument(kopf, rumpf));
fs.writeFileSync(path.join(OUT, "artifact.html"), ganz);

// Impressum und Datenschutz: gleicher Stil, Kopf ohne Seitenzahlen und Skript
const stil = kopf.slice(kopf.indexOf("<style>"));
const FOLGT = "folgt vor dem Start";
const rechtsSeite = (titel, beschreibung, inhalt) =>
  dokument(
    `<title>${titel} – Amtlos</title>\n<meta name="description" content="${esc(beschreibung)}">\n<meta name="robots" content="noindex">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n${stil}\n<style>.recht{max-width:46rem;padding-block:1.5rem 3rem}.recht h1{font-size:clamp(2rem,4vw,2.75rem)}.recht h2{font-size:1.3rem;margin-top:2rem}.recht h3{font-size:1.05rem;margin-top:1.25rem}.recht p,.recht dl{margin-top:.6rem}.recht dt{font-weight:600;margin-top:1rem;font-size:.9375rem;color:var(--tinte-2)}.recht dd{margin:0}.recht .offen{color:var(--tinte-2);font-style:italic}.hinweis{margin-top:1.25rem;padding:.9rem 1.1rem;border-radius:.6rem;background:var(--amt-hauch);color:var(--amt-tief);font-weight:600}</style>`,
    `<div class="breite">\n<header class="kopf"><a class="marke" href="./">Amtlos</a></header>\n<main class="recht">\n${inhalt}\n</main>\n<footer class="fuss"><span>© 2026 Amtlos</span><nav aria-label="Rechtliches"><a href="./">Startseite</a><a href="impressum.html">Impressum</a><a href="datenschutz.html">Datenschutz</a></nav></footer>\n</div>`,
  );
const A = recht.ANBIETER;
const wert = (w) => (w ? esc(w) : `<span class="offen">${FOLGT}</span>`);
const zeile = (t, w, pflicht = true) => (pflicht || w ? `<dt>${t}</dt><dd>${wert(w)}</dd>` : "");
const anbieterFehlt = !recht.anbieterVollstaendig();
fs.writeFileSync(
  path.join(OUT, "impressum.html"),
  rechtsSeite(
    "Impressum",
    "Impressum von Amtlos",
    `<h1>Impressum</h1>\n${anbieterFehlt ? `<p class="hinweis">Die Angaben zum Anbieter folgen vor der Veröffentlichung.</p>\n` : ""}<p>Angaben nach § 5 DDG</p>\n<dl>${zeile("Anbieter", A.name)}${zeile("Anschrift", A.anschrift)}${zeile("Vertreten durch", A.vertretung)}${zeile("E-Mail", A.email)}${zeile("Telefon", A.telefon, false)}${zeile("Register", A.register, false)}${zeile("USt-IdNr.", A.ustIdNr, false)}</dl>`,
  ),
);
const abschnitte = recht.datenschutzAbschnitte(false);
fs.writeFileSync(
  path.join(OUT, "datenschutz.html"),
  rechtsSeite(
    "Datenschutz",
    "Datenschutzhinweis der App Amtlos und dieser Website",
    `<h1>Datenschutz</h1>\n${recht.DATENSCHUTZ.freigegeben ? "" : `<p class="hinweis">Entwurf – fachlich noch nicht freigegeben.</p>\n`}<h2>Verantwortlich</h2>\n<p>${A.name ? esc([A.name, A.anschrift, A.email].filter(Boolean).join(", ")) : `<span class="offen">Die Angaben zum Anbieter folgen vor der Veröffentlichung.</span>`}</p>\n<h2>Die App Amtlos</h2>\n${abschnitte.map((a) => `<h3>${esc(a.titel)}</h3>\n<p>${esc(a.text)}</p>`).join("\n")}\n<h2>Diese Website</h2>\n<p>Diese Website setzt keine Cookies, nutzt kein Tracking und lädt keine Inhalte von fremden Servern; die Schriften liegen auf diesem Server.</p>\n<h3>Hosting und Server-Protokolle</h3>\n<p><span class="offen">Angaben zum Hosting ${FOLGT}.</span></p>`,
  ),
);

// Dateien
for (const b of fs.readdirSync(path.join(HIER, "bilder"))) fs.copyFileSync(path.join(HIER, "bilder", b), path.join(OUT, "bilder", b));
fs.cpSync(path.join(HIER, "schriften"), path.join(OUT, "schriften"), { recursive: true });
for (const d of ["favicon.svg", "apple-touch-icon.png"]) fs.copyFileSync(path.join(HIER, d), path.join(OUT, d));
console.log(`✓ ${OUT}${anbieterFehlt ? " – Anbieterangaben fehlen noch (Impressum zeigt „folgt vor dem Start“)" : ""}`);
