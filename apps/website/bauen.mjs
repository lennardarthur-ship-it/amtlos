/**
 * Landingpage bauen (E-132): setzt die echten Zahlen aus dem Katalog (profile.json, erzeugt aus dem Pflichten-Check)
 * in seite.html ein und schreibt dist/ zum Hochladen: index.html (alles vor `<!-- /kopf -->` kommt in den <head>),
 * impressum.html, datenschutz.html und hilfe.html aus apps/mobile/src/rechtliches.ts (fehlende Angaben: „folgt vor dem
 * Start“ – nichts wird erfunden), nutzungsbedingungen.html aus docs/nutzungsbedingungen-entwurf.md (ohne die Arbeitsnotizen
 * mit „>“; solange NUTZUNGSBEDINGUNGEN.freigegeben false ist, als „Entwurf – noch nicht in Kraft“, noindex und nicht
 * verlinkt), 404.html, robots.txt, sitemap.xml, Bilder, Schriften (selbst gehostet, OFL), Favicon.
 *
 * Adresse der Website (eine Stelle): seite.json → url, sonst LINKS.website aus rechtliches.ts. Daraus canonical,
 * og:url, absolutes og:image, JSON-LD url/image, robots.txt und sitemap.xml. Ohne Adresse entstehen relative Verweise
 * und keine sitemap.xml – der Build listet das als offen.
 *
 * seite.json schaltet vor dem Start vorbereitete Einträge ein:
 *   url         – Adresse der Website, z. B. „https://www.beispiel.de“ (ohne Schrägstrich am Ende)
 *   appStoreId  – App-ID aus App Store Connect (nur Ziffern) → Smart-App-Banner (apple-itunes-app) und im JSON-LD
 *                 downloadUrl und offers (Gratis-Download mit In-App-Käufen; ohne veröffentlichte App kein Angebot)
 *
 * Hilfe und Kontakt (Support-URL im App Store): hilfe.html zeigt ANBIETER.email aus rechtliches.ts – dieselbe Quelle wie
 * die App. Solange sie leer ist, steht dort „folgt vor dem Start“.
 *
 * Marke (docs/14-marke.md): seite.html und die Texte hier nennen den Namen nur als Platzhalter ({{MARKE}}, {{MARKE_PRO}},
 * {{DOMAIN}}, {{EMAIL}}); eingesetzt wird packages/marke/marke.json in jede geschriebene Seite. Bleibt ein Platzhalter
 * oder der alte Name „Amtlos“ stehen, bricht der Build ab.
 *
 * Wie werkzeuge/store-check.mjs: Am Ende listet der Build, was vor dem Hochladen noch fehlt, und endet dann mit Exit 1.
 * `--entwurf` baut trotzdem mit Exit 0 (Vorschau). `--artifact <datei>` schreibt zusätzlich die Seite ohne Dokumentrahmen
 * für eine Vorschau (nie nach dist/).
 *
 *   node apps/website/bauen.mjs [ausgabe] [--entwurf] [--artifact <datei>]     # Standard: apps/website/dist
 */
/* global process, console, URL */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MARKE, markeEinsetzen } from "../../packages/marke/index.js";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const ENTWURF = args.includes("--entwurf");
const iArtifact = args.indexOf("--artifact");
const ARTIFACT = iArtifact >= 0 ? path.resolve(args[iArtifact + 1] ?? "") : null;
const pfadArg = args.find((a, i) => !a.startsWith("--") && (iArtifact < 0 || i !== iArtifact + 1));
const OUT = path.resolve(pfadArg ?? path.join(HIER, "dist"));
const lies = (d) => fs.readFileSync(path.join(HIER, d), "utf8");
const cfg = JSON.parse(lies("seite.json"));
const offen = [];

// Die Seite verspricht „ohne Konto“ (Kopf, JSON-LD, Daten-Abschnitt, Fragen) – stimmt nur für Builds ohne Synchronisation
if (process.env.EXPO_PUBLIC_API_URL) throw new Error("EXPO_PUBLIC_API_URL ist gesetzt (Build mit Konto/Synchronisation): seite.html sagt „ohne Konto“ – erst die Texte anpassen");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Rechtstexte der App lesen (nicht ändern): rechtliches.ts mit esbuild nach ESM übersetzen
async function rechtliches() {
  const pnpm = path.resolve(HIER, "../../node_modules/.pnpm");
  const ordner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
  if (!ordner) throw new Error("esbuild nicht gefunden (pnpm install)");
  const ziel = path.join(OUT, ".rechtliches.mjs");
  execFileSync(path.join(pnpm, ordner, "node_modules/esbuild/bin/esbuild"), [path.resolve(HIER, "../mobile/src/rechtliches.ts"), "--bundle", "--format=esm", `--outfile=${ziel}`, "--log-level=warning"]);
  const m = await import(`${ziel}?${Date.now()}`);
  fs.rmSync(ziel);
  return m;
}

// Rechtsstand aus dem gebündelten Pflichten-Katalog – dieselbe Quelle wie die App (src/pflichten/rechtsstand.ts)
async function rechtsstand() {
  const pnpm = path.resolve(HIER, "../../node_modules/.pnpm");
  const ordner = fs.readdirSync(pnpm).filter((d) => d.startsWith("esbuild@")).sort().at(-1);
  const ziel = path.join(OUT, ".rechtsstand.mjs");
  execFileSync(path.join(pnpm, ordner, "node_modules/esbuild/bin/esbuild"), [path.resolve(HIER, "../mobile/src/pflichten/rechtsstand.ts"), "--bundle", "--format=esm", `--outfile=${ziel}`, "--log-level=warning"]);
  const m = await import(`${ziel}?${Date.now()}`);
  fs.rmSync(ziel);
  return m.rechtsstandText();
}

fs.mkdirSync(path.join(OUT, "bilder"), { recursive: true });
/** Seite mit eingesetzter Marke schreiben – ohne übrig gebliebene Platzhalter und ohne den alten Namen */
const schreibe = (datei, html) => {
  const fertig = markeEinsetzen(html);
  const rest = /\{\{[A-Z_]+\}\}|\bAmtlos\b/.exec(fertig.replace(/(?:Amtlos (?:Sans|Serif))/g, ""));
  if (rest) throw new Error(`${datei}: „${rest[0]}“ übrig – Marke über {{MARKE}} usw. einsetzen (docs/14-marke.md)`);
  fs.writeFileSync(path.join(OUT, datei), fertig);
};
const recht = await rechtliches();
const RECHTSSTAND = await rechtsstand();
// Phase 1 (RDG): Hinweis in der Fußzeile jeder Seite
const FUSS_HINWEIS = `Allgemeine Informationen und Vorlagen – keine Rechts- oder Steuerberatung. ${esc(RECHTSSTAND)}.`;
const url = (cfg.url || recht.LINKS.website || "").replace(/\/+$/, "");
if (url && !/^https:\/\/[^/\s]+\.[^/\s]+$/.test(url)) throw new Error(`Adresse der Website ungültig: „${url}“ (https://…, ohne Pfad)`);
if (!url) offen.push("Adresse der Website (apps/website/seite.json → url oder LINKS.website in apps/mobile/src/rechtliches.ts) – ohne sie fehlen canonical, og:url, absolutes og:image und sitemap.xml");
const appStoreId = /^\d+$/.test(cfg.appStoreId ?? "") ? cfg.appStoreId : "";
const appStoreUrl = recht.LINKS.appStore || (appStoreId ? `https://apps.apple.com/de/app/id${appStoreId}` : "");

// Strukturierte Daten: nur, was feststeht – Preis nur über den Store (Gratis-Download, sobald die App veröffentlicht ist)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: MARKE.name,
  operatingSystem: "iOS",
  applicationCategory: "BusinessApplication",
  inLanguage: "de",
  description: "Welche Pflichten hat dein Betrieb – und hast du alles erledigt? Pflichten-Check mit Terminen, Erinnerung, 43 Vorlagen und Kontrollmappe für kleine Betriebe in Deutschland; dazu Rechnungen und Kasse. Daten verschlüsselt auf dem iPhone, ohne Konto.",
  ...(url ? { url: `${url}/`, image: `${url}/bilder/og.jpg` } : {}),
  ...(appStoreId ? { downloadUrl: appStoreUrl, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", url: appStoreUrl } } : {}),
};

// Kopf: vorbereitete Einträge nur, wenn in seite.json gesetzt
const extra = [
  url ? `<link rel="canonical" href="${esc(url)}/">\n<meta property="og:url" content="${esc(url)}/">` : "<!-- canonical und og:url: url in apps/website/seite.json eintragen -->",
  /^\d+$/.test(cfg.appStoreId ?? "") ? `<meta name="apple-itunes-app" content="app-id=${cfg.appStoreId}">` : "<!-- Smart-App-Banner: appStoreId in apps/website/seite.json eintragen -->",
].join("\n");
const ganz = lies("seite.html")
  .replace("__PROFILE__", JSON.stringify(JSON.parse(lies("profile.json"))))
  .replace("__KOPF_EXTRA__", extra)
  .replace("__RECHTSSTAND__", esc(RECHTSSTAND))
  .replace("__FUSS_HINWEIS__", FUSS_HINWEIS)
  .replace("__OG_BILD__", `${url ? `${url}/` : ""}bilder/og.jpg`)
  .replace("__JSON_LD__", JSON.stringify(jsonLd).replace(/</g, "\\u003c"));
const [kopf, rumpf] = ganz.split("<!-- /kopf -->");
if (!rumpf) throw new Error("Marke <!-- /kopf --> fehlt in seite.html");
const dokument = (k, r) => `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${k.trim()}\n</head>\n<body>\n${r.trim()}\n</body>\n</html>\n`;
schreibe("index.html", dokument(kopf, rumpf));
// Vorschau ohne Dokumentrahmen nur auf Wunsch und nie in dist/ (wäre nach dem Hochladen ein Duplikat der Startseite)
fs.rmSync(path.join(OUT, "artifact.html"), { force: true });
if (ARTIFACT) {
  if (ARTIFACT.startsWith(OUT + path.sep)) throw new Error("--artifact nicht in den Ausgabeordner schreiben");
  fs.writeFileSync(ARTIFACT, markeEinsetzen(ganz));
}

// Impressum und Datenschutz: gleicher Stil, Kopf ohne Seitenzahlen und Skript
const stil = kopf.slice(kopf.indexOf("<style>"));
const FOLGT = "folgt vor dem Start";
const marke = /<a class="marke"[\s\S]*?<\/a>/.exec(rumpf)?.[0];
if (!marke) throw new Error("Logo (<a class=\"marke\">) fehlt in seite.html");
const NB = recht.NUTZUNGSBEDINGUNGEN;
// eigene Nutzungsbedingungen erst nach der Freigabe verlinken – bis dahin gilt Apples Standard-EULA
const fussNav = `<nav aria-label="Rechtliches"><a href="./">Startseite</a><a href="hilfe.html">Hilfe und Kontakt</a><a href="impressum.html">Impressum</a><a href="datenschutz.html">Datenschutz</a>${NB.freigegeben ? `<a href="nutzungsbedingungen.html">Nutzungsbedingungen</a>` : ""}</nav>`;
// Unterseiten im Stil der Startseite: Logo im Kopf, gleiche Fußzeile; `wurzel` = "/" für 404.html (an jeder Adresse)
const rechtsSeite = (titel, beschreibung, inhalt, { index = false, pfad = "", wurzel = "" } = {}) =>
  dokument(
    `<title>${titel} – {{MARKE}}</title>\n<meta name="description" content="${esc(beschreibung)}">\n${index ? (url ? `<link rel="canonical" href="${esc(url)}/${pfad}">` : "") : `<meta name="robots" content="noindex">`}\n<link rel="icon" href="${wurzel}favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="${wurzel}apple-touch-icon.png">\n${wurzel ? stil.replace(/url\(schriften\//g, `url(${wurzel}schriften/`) : stil}\n<style>.recht{max-width:46rem;padding-block:1.5rem 3rem}.recht h1{font-size:clamp(2rem,4vw,2.75rem)}.recht h2{font-size:1.3rem;margin-top:2rem}.recht h3{font-size:1.05rem;margin-top:1.25rem}.recht p,.recht dl{margin-top:.6rem}.recht dt{font-weight:600;margin-top:1rem;font-size:.9375rem;color:var(--tinte-2)}.recht dd{margin:0}.recht .offen{color:var(--tinte-2);font-style:italic}.hinweis{margin-top:1.25rem;padding:.9rem 1.1rem;border-radius:.6rem;background:var(--amt-hauch);color:var(--amt-tief);font-weight:600}</style>`,
    `<a class="springen" href="#inhalt">Zum Inhalt springen</a>\n<div class="breite">\n<header class="kopf">${marke.replace('href="./"', `href="${wurzel || "./"}"`)}</header>\n<main class="recht" id="inhalt">\n${inhalt}\n</main>\n<footer class="fuss"><p class="fuss-hinweis">${FUSS_HINWEIS}</p><span>© 2026 {{MARKE}}</span>${wurzel ? fussNav.replace(/href="(?:\.\/)?/g, `href="${wurzel}`) : fussNav}</footer>\n</div>`,
  );
const A = recht.ANBIETER;
const wert = (w) => (w ? esc(w) : `<span class="offen">${FOLGT}</span>`);
const zeile = (t, w, pflicht = true) => (pflicht || w ? `<dt>${t}</dt><dd>${wert(w)}</dd>` : "");
const anbieterFehlt = !recht.anbieterVollstaendig();
schreibe(
  "impressum.html",
  rechtsSeite(
    "Impressum",
    "Impressum von {{MARKE}}",
    `<h1>Impressum</h1>\n${anbieterFehlt ? `<p class="hinweis">Die Angaben zum Anbieter folgen vor der Veröffentlichung.</p>\n` : ""}<p>Angaben nach § 5 DDG</p>\n<dl>${zeile("Anbieter", A.name)}${zeile("Rechtsform", A.rechtsform, false)}${zeile("Anschrift", A.anschrift)}${zeile("Vertreten durch", A.vertretung)}${zeile("E-Mail", A.email)}${zeile("Telefon", A.telefon, false)}${zeile("Registergericht und Registernummer", A.register, Boolean(A.rechtsform))}${zeile("USt-IdNr.", A.ustIdNr, false)}</dl>`,
  ),
);
const abschnitte = recht.datenschutzAbschnitte(false);
schreibe(
  "datenschutz.html",
  rechtsSeite(
    "Datenschutz",
    "Datenschutzhinweis der App {{MARKE}} und dieser Website",
    `<h1>Datenschutz</h1>\n${recht.DATENSCHUTZ.freigegeben ? "" : `<p class="hinweis">Entwurf – fachlich noch nicht freigegeben.</p>\n`}<h2>Verantwortlich</h2>\n<p>${A.name ? `${esc([A.name, A.anschrift, A.email].filter(Boolean).join(", "))}${A.vertretung ? `<br>Vertreten durch ${esc(A.vertretung)}` : ""}` : `<span class="offen">Die Angaben zum Anbieter folgen vor der Veröffentlichung.</span>`}</p>\n<h2>Die App {{MARKE}}</h2>\n${abschnitte.map((a) => `<h3>${esc(a.titel)}</h3>\n<p>${esc(a.text)}</p>`).join("\n")}\n<h2>Diese Website</h2>\n<p>Diese Website setzt keine Cookies, nutzt kein Tracking und lädt keine Inhalte von fremden Servern.</p>\n<h3>Kurz-Check auf der Startseite</h3>\n<p>Der Kurz-Check rechnet nur in deinem Browser: Die Beispielzahlen sind in der Seite enthalten, deine Auswahl (Branche, Team) wird weder an einen Server gesendet noch gespeichert.</p>\n<h3>Schriftarten</h3>\n<p>Die Schrift Onest liegt auf diesem Server und wird nicht von einem fremden Anbieter (z. B. Google Fonts) geladen.</p>\n<h3>Hosting und Server-Protokolle</h3>\n<p><span class="offen">Angaben zum Hosting (Anbieter, Server-Protokolle, Speicherdauer, Auftragsverarbeitung) folgen, sobald der Hoster feststeht.</span></p>`,
  ),
);

// Nutzungsbedingungen aus docs/nutzungsbedingungen-entwurf.md: Überschrift 1 und Arbeitsnotizen („>“) entfallen,
// „## …“ wird h2, jeder Absatz ein <p>, **fett** wird <strong>. Vor der Freigabe als Entwurf gekennzeichnet und noindex.
{
  const md = fs.readFileSync(path.resolve(HIER, "../../docs/nutzungsbedingungen-entwurf.md"), "utf8");
  const absaetze = md.split(/\n\s*\n/).map((a) => a.trim()).filter((a) => a && !a.startsWith("# ") && !a.startsWith(">"));
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const html = absaetze.map((a) => (a.startsWith("## ") ? `<h2>${inline(a.slice(3))}</h2>` : `<p>${inline(a.replace(/\s*\n\s*/g, " "))}</p>`)).join("\n");
  const fassung = /Fassung vom (\d{2})\.(\d{2})\.(\d{4})/.exec(md);
  if (!fassung || `${fassung[3]}-${fassung[2]}-${fassung[1]}` !== NB.fassung) throw new Error(`docs/nutzungsbedingungen-entwurf.md: „Fassung vom …“ passt nicht zu NUTZUNGSBEDINGUNGEN.fassung (${NB.fassung})`);
  if (A.name && !md.includes(A.name)) throw new Error("docs/nutzungsbedingungen-entwurf.md: Ziffer 1.1 nennt nicht ANBIETER.name aus rechtliches.ts");
  schreibe(
    "nutzungsbedingungen.html",
    rechtsSeite(
      "Nutzungsbedingungen",
      "Nutzungsbedingungen der App {{MARKE}}",
      `<h1>Nutzungsbedingungen</h1>\n${NB.freigegeben ? "" : `<p class="hinweis">Entwurf – noch nicht in Kraft. Bis zur Freigabe gilt für die App der <a href="${esc(recht.LINKS.nutzung)}">Standard-Lizenzvertrag von Apple</a>.</p>\n`}${html}`,
      NB.freigegeben ? { index: true, pfad: "nutzungsbedingungen.html" } : {},
    ),
  );
}

// Hilfe und Kontakt (Support-URL im App Store): Kontakt aus ANBIETER (rechtliches.ts) wie in der App, dazu die Fragen
const fragen = /<!-- fragen -->([\s\S]*?)<!-- \/fragen -->/.exec(rumpf)?.[1];
if (!fragen) throw new Error("Marken <!-- fragen --> … <!-- /fragen --> fehlen in seite.html");
if (!A.email) offen.push("Kontakt auf hilfe.html: ANBIETER.email in apps/mobile/src/rechtliches.ts (Support-Seite ist im App Store Pflicht)");
schreibe(
  "hilfe.html",
  rechtsSeite(
    "Hilfe und Kontakt",
    "Hilfe zu {{MARKE}}: Kontakt und häufige Fragen zur App",
    `<h1>Hilfe und Kontakt</h1>\n<h2>Kontakt</h2>\n${
      A.email
        ? `<p>Fragen zu {{MARKE}}? Schreib uns an <a href="mailto:${esc(A.email)}">${esc(A.email)}</a>.</p>${A.name ? `\n<p class="leise">${esc([A.name, A.anschrift].filter(Boolean).join(", "))}</p>` : ""}`
        : `<p class="hinweis">Die Kontaktadresse folgt vor der Veröffentlichung.</p>`
    }\n<h2>Häufige Fragen</h2>\n<div>${fragen.trim()}</div>\n<h2>Abo verwalten</h2>\n<p>{{MARKE_PRO}} kündigst oder änderst du in den Einstellungen deines Apple-Accounts unter Abonnements. Einen Kauf auf einem neuen iPhone holst du in der App unter „Mein Betrieb“ → „{{MARKE_PRO}}“ → „Käufe wiederherstellen“ zurück.</p>\n<p>Endet {{MARKE_PRO}}, bleibt alles erhalten: Geteilte Rechnungen und Unterlagen teilst und druckst du weiter, Stornos gehen immer, Entwürfe bleiben, und deine erfassten Kassentage samt Kassenbuch kannst du weiter ansehen, teilen und drucken. Den Pflichten-Check (die Zahl deiner Pflichten und die ersten drei) kannst du ohne Abo weiter nutzen; neue Rechnungen, Belege, Kassentage und Unterlagen gibt es mit {{MARKE_PRO}}.</p>`,
    { index: true, pfad: "hilfe.html" },
  ),
);

// 404: an jeder Adresse ausgeliefert – Verweise daher ab der Wurzel
schreibe(
  "404.html",
  rechtsSeite("Seite nicht gefunden", "Diese Seite gibt es nicht.", `<h1>Seite nicht gefunden</h1>\n<p>Diese Adresse gibt es auf dieser Website nicht (mehr).</p>\n<p style="margin-top:1rem"><a href="/">Zur Startseite</a> · <a href="/hilfe.html">Hilfe und Kontakt</a></p>`, { wurzel: "/" }),
);

// Suchmaschinen: alles erlaubt; Sitemap nur mit Adresse (absolute URLs) – Impressum und Datenschutz sind noindex
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n${url ? `Sitemap: ${url}/sitemap.xml\n` : ""}`);
fs.rmSync(path.join(OUT, "sitemap.xml"), { force: true });
if (url)
  fs.writeFileSync(
    path.join(OUT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["", "hilfe.html", ...(NB.freigegeben ? ["nutzungsbedingungen.html"] : [])].map((p) => `  <url><loc>${esc(url)}/${p}</loc></url>`).join("\n")}\n</urlset>\n`,
  );

// Dateien
for (const b of fs.readdirSync(path.join(HIER, "bilder"))) fs.copyFileSync(path.join(HIER, "bilder", b), path.join(OUT, "bilder", b));
fs.cpSync(path.join(HIER, "schriften"), path.join(OUT, "schriften"), { recursive: true });
for (const d of ["favicon.svg", "apple-touch-icon.png"]) fs.copyFileSync(path.join(HIER, d), path.join(OUT, d));
if (anbieterFehlt) offen.push("Anbieterangaben für das Impressum (ANBIETER in apps/mobile/src/rechtliches.ts, § 5 DDG) – Impressum zeigt „folgt vor dem Start“");
if (!recht.DATENSCHUTZ.freigegeben) offen.push("Datenschutz fachlich freigeben (DATENSCHUTZ.freigegeben) und Angaben zum Hosting ergänzen");
if (!NB.freigegeben) offen.push("Nutzungsbedingungen anwaltlich freigeben (NUTZUNGSBEDINGUNGEN.freigegeben) – nutzungsbedingungen.html zeigt „Entwurf – noch nicht in Kraft“");
if (A.rechtsform && !A.register) offen.push("Registergericht und Registernummer (ANBIETER.register) nach der Eintragung – Impressum zeigt „folgt vor dem Start“");
console.log(`✓ ${OUT}`);
if (!appStoreId) console.log("  · Ohne App-ID (seite.json → appStoreId): kein Smart-App-Banner, im JSON-LD kein downloadUrl und kein Angebot");
if (offen.length) {
  console.log(`\nVor dem Hochladen noch offen:\n${offen.map((t) => `  ✗ ${t}`).join("\n")}`);
  if (!ENTWURF) {
    console.log("\nNoch nicht hochladen (--entwurf baut als Vorschau ohne Fehler).");
    process.exitCode = 1;
  }
}
