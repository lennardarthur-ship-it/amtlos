/**
 * Vor dem Einreichen im App Store (E-132) und bei Google Play (E-190): listet alles, was noch fehlt – Anbieterangaben,
 * Links, EAS, Abo-Schlüssel je Plattform, Store-Texte (Längen), Rechtstexte-Freigabe, Play Console, Prüfliste. Exit 1,
 * solange etwas offen ist.
 *
 *   node werkzeuge/store-check.mjs                    # prüft das Profil „production“, beide Stores
 *   node werkzeuge/store-check.mjs --ios | --android  # nur einen Store
 *   node werkzeuge/store-check.mjs --profile preview  # anderes EAS-Profil (oder EAS_BUILD_PROFILE)
 *   node werkzeuge/store-check.mjs --texte            # nur die Store-Texte mit eingesetzter Marke ausgeben (für App Store Connect)
 *
 * Store-Texte (store/de.json) enthalten die Marke nur als Platzhalter ({{MARKE}}, {{MARKE_PRO}}); eingesetzt wird der
 * Name aus packages/marke/marke.json (docs/14-marke.md).
 */
/* global process, console, Buffer, URL */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MARKE, PLATZHALTER, markeEinsetzenTief } from "../../../packages/marke/index.js";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const lies = (p) => fs.readFileSync(path.join(APP, p), "utf8");
/** Store-Texte mit eingesetzter Marke */
const storeRoh = lies("store/de.json");
const storeJson = markeEinsetzenTief(JSON.parse(storeRoh));
if (process.argv.includes("--texte")) {
  console.log(JSON.stringify(storeJson, null, 2));
  process.exit(0);
}
const offen = [];
const ok = [];
const pruefe = (bed, text) => (bed ? ok : offen).push(text);

// Anbieter und Links aus src/rechtliches.ts (einfache Auswertung der Felder)
const recht = lies("src/rechtliches.ts");
// Werte als Zeichenkette ("…") oder aus der Marke (MARKE.email, MARKE.website …, packages/marke)
const feld = (block, name) => {
  const m = new RegExp(`export const ${block} = \\{[\\s\\S]*?\\n\\s+${name}: (?:"([^"]*)"|MARKE\\.(\\w+))`).exec(recht);
  return m ? (m[1] ?? String(MARKE[m[2]] ?? "")) : "";
};
// leere Anbieterangaben zeigt die App als „folgt“ (Impressum, Datenschutz) – ein Store-Build darf so nicht raus
for (const [n, t] of [["name", "Firma"], ["anschrift", "Anschrift"], ["vertretung", "Vertretung"], ["email", "E-Mail"]]) pruefe(feld("ANBIETER", n), `Impressum: ${t} (src/rechtliches.ts → ANBIETER.${n})`);
for (const [n, t] of [["website", "Website"], ["datenschutz", "Datenschutzerklärung im Netz (Pflicht im App Store)"], ["support", "Support-URL (Pflicht im App Store)"]]) pruefe(feld("LINKS", n), `${t} (LINKS.${n})`);
pruefe(/export const DATENSCHUTZ = \{\s*freigegeben: true/.test(recht), "Datenschutzhinweis der App fachlich freigegeben (DATENSCHUTZ.freigegeben, PRUEFLISTE T-77)");
// Eigene Nutzungsbedingungen (docs/nutzungsbedingungen-entwurf.md, gemeinsame Fassung iPhone/Android, E-205): inhaltlich
// freigegeben am 26.10.2026, in Kraft erst nach der Eintragung der UG – bis dahin gilt auf dem iPhone Apples Standard-EULA
// (LINKS.nutzung), und die App fragt beim Start nicht nach der Zustimmung (Gründer, PRUEFLISTE T-235)
const nbInKraft = /export const NUTZUNGSBEDINGUNGEN = \{[^}]*?freigegeben: true/.test(recht) && /^\d{4}-\d{2}-\d{2}$/.test(feld("NUTZUNGSBEDINGUNGEN", "fassung"));
pruefe(nbInKraft, "Eigene Nutzungsbedingungen in Kraft (inhaltlich freigegeben 26.10.2026, E-205; nach Eintragung der UG: Registerangaben und USt-IdNr. in Ziffer 1.1, ohne „i. G.“, Fassungsdatum in docs/nutzungsbedingungen-entwurf.md und NUTZUNGSBEDINGUNGEN.fassung, dann freigegeben: true – PRUEFLISTE T-235) – bis dahin gilt Apples Standard-EULA");

// EAS und Abo
const eas = JSON.parse(lies("eas.json"));
pruefe(eas.submit?.production?.ios?.ascAppId, "App Store Connect App-ID (eas.json → submit.production.ios.ascAppId)");
pruefe(eas.submit?.production?.ios?.appleTeamId, "Apple Team-ID (eas.json → submit.production.ios.appleTeamId)");
pruefe(!eas.build?.production?.env?.EXPO_PUBLIC_PRO_TESTMODUS, "Store-Build ohne Pro-Testmodus (eas.json → build.production.env ohne EXPO_PUBLIC_PRO_TESTMODUS)");
pruefe(!process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_OIDC_ISSUER, "Konto: mit Server (EXPO_PUBLIC_API_URL) auch einen Anmeldedienst setzen (EXPO_PUBLIC_OIDC_ISSUER) – sonst bietet die App kein Konto an");
// Profil: ohne Angabe „production“ (der Store-Build). Dort muss der RevenueCat-Schlüssel gesetzt sein – sonst gibt es
// im Build keinen Kauf, die App blendet den Bezahlschirm-Einstieg aus und Apple lehnt ab (App-Review B2).
const argProfil = process.argv.indexOf("--profile");
const profil = (argProfil > 0 ? process.argv[argProfil + 1] : "") || process.env.EAS_BUILD_PROFILE || "production";
const rcSchluessel = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || eas.build?.[profil]?.env?.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "";
if (profil === "production") {
  // EAS-Variablen der Umgebung „production“ sieht dieser Aufruf nur über `npx eas-cli env:exec production "node werkzeuge/store-check.mjs"`
  pruefe(rcSchluessel, "RevenueCat-Schlüssel EXPO_PUBLIC_REVENUECAT_IOS_KEY für das Profil „production“ (eas env:create --environment production …, siehe docs/11 §3; prüfen mit eas env:exec production) – ohne ihn lässt sich Pro im Store-Build nicht kaufen");
  if (rcSchluessel) pruefe(/^appl_/.test(rcSchluessel), "RevenueCat-Schlüssel ist der öffentliche iOS-Schlüssel (beginnt mit „appl_“)");
} else {
  console.log(`  · Profil „${profil}“: RevenueCat-Schlüssel ${rcSchluessel ? "gesetzt" : "nicht gesetzt (Testmodus oder kein Kauf)"}`);
}
// E-234 (Rechtsanwalt 27.10.2026, R5): Testhinweis nur in Betatest-Builds – nie im Store-Build; im Betatest-Build mit
// Testzeitraum (statt „[Datum]“), sonst sperrt die Testversion (src/betatest.ts)
pruefe(!eas.build?.production?.env?.EXPO_PUBLIC_BETATEST, "Store-Build ohne Betatest-Hinweis (eas.json → build.production.env ohne EXPO_PUBLIC_BETATEST)");
{
  const env = { ...(eas.build?.[profil]?.env ?? {}), ...Object.fromEntries(["EXPO_PUBLIC_BETATEST", "EXPO_PUBLIC_BETATEST_VON", "EXPO_PUBLIC_BETATEST_BIS"].filter((k) => process.env[k]).map((k) => [k, process.env[k]])) };
  if (env.EXPO_PUBLIC_BETATEST === "1") {
    const tag = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x ?? "") && !Number.isNaN(Date.parse(`${x}T00:00:00Z`)) && new Date(`${x}T00:00:00Z`).toISOString().slice(0, 10) === x;
    const von = (env.EXPO_PUBLIC_BETATEST_VON ?? "").trim();
    const bis = (env.EXPO_PUBLIC_BETATEST_BIS ?? "").trim();
    pruefe(tag(von) && tag(bis) && von <= bis, `Betatest: Testzeitraum für den Testhinweis gesetzt (eas.json → build.${profil}.env EXPO_PUBLIC_BETATEST_VON/EXPO_PUBLIC_BETATEST_BIS, JJJJ-MM-TT; docs/betatest-hinweis.md, PRUEFLISTE T-183)${von || bis ? ` – „${von}“ bis „${bis}“` : ""}`);
  }
}
const app = JSON.parse(lies("app.json")).expo;
pruefe(app.extra?.eas?.projectId, "EAS-Projekt verknüpft (eas init → app.json extra.eas.projectId)");
// E-240: Ziel von „Rechtsstand vom … – bitte App aktualisieren“ auf dem iPhone (Android: Paketname genügt)
pruefe(/^https:\/\/apps\.apple\.com\/\S*id\d+/.test(feld("LINKS", "appStore")), "App-Store-Link der App (src/rechtliches.ts → LINKS.appStore = https://apps.apple.com/app/id<App-ID aus App Store Connect>) – Ziel von „Rechtsstand vom … – bitte App aktualisieren“ (E-240) und von Weiterempfehlen");
// E-240: Inhalts-Updates (expo-updates, app.config.ts) rufen einen Update-Server an – nur mit freigegebenem Hinweis dazu
{
  const an = (process.env.INHALTS_UPDATES ?? eas.build?.[profil]?.env?.INHALTS_UPDATES) === "1";
  const ds = recht.slice(recht.indexOf("export const DATENSCHUTZ = {"), recht.indexOf("export const DATENSCHUTZ_SYNC"));
  pruefe(!an || /Update-Server/.test(ds), `Inhalts-Updates nur mit Datenschutzhinweis zum Update-Server (E-240, PRUEFLISTE T-366/T-367) – ${an ? "INHALTS_UPDATES=1 gesetzt, der Hinweis nennt den Update-Server nicht" : "aus (Standard)"}`);
}
pruefe(app.ios?.config?.usesNonExemptEncryption !== undefined || app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== undefined, "Export-Compliance der Verschlüsselung entschieden (ios.config.usesNonExemptEncryption, PRUEFLISTE T-77)");
if (app.ios?.config?.usesNonExemptEncryption === true) console.log("  · Verschlüsselung: in App Store Connect „Standard encryption algorithms … in addition to Apple's operating system“ angeben; Frankreich nur mit französischer Verschlüsselungserklärung, sonst bis dahin ausschließen (docs/11 §5)");
pruefe(app.ios?.privacyManifests?.NSPrivacyTracking === false, "Privacy Manifest vorhanden");
// R7: Kaufhistorie (RevenueCat) mit den Zwecken App-Funktionalität und Analysen; Konto-Daten nur mit Sync (app.config.ts)
const datenarten = app.ios?.privacyManifests?.NSPrivacyCollectedDataTypes ?? [];
const kauf = datenarten.find((d) => d.NSPrivacyCollectedDataType === "NSPrivacyCollectedDataTypePurchaseHistory");
pruefe(kauf?.NSPrivacyCollectedDataTypePurposes?.includes("NSPrivacyCollectedDataTypePurposeAnalytics") && kauf?.NSPrivacyCollectedDataTypePurposes?.includes("NSPrivacyCollectedDataTypePurposeAppFunctionality"), "Privacy Manifest: Kaufhistorie mit Zweck App-Funktionalität und Analysen (RevenueCat)");
// R10: „Analysen“ im Manifest (RevenueCat-Dashboard) und die Texte sagen dasselbe – keine eigenen Analysen, RevenueCat
// wertet Käufe für die Abo-Verwaltung aus (Store-Prüfhinweise, Datenschutzhinweis der App, Website)
const storeTexte = storeJson;
const website = fs.readFileSync(path.join(APP, "../website/seite.html"), "utf8");
pruefe(/evaluates purchases for subscription management/.test(storeTexte.pruefhinweise) && /RevenueCat[^"]*Abo-Verwaltung/.test(recht) && /RevenueCat[^<]*Abo-Verwaltung/.test(website) && !/sends no analytics/i.test(storeTexte.pruefhinweise), "Texte zu Analysen passen zum Privacy Manifest (Store-Prüfhinweise, Datenschutzhinweis, Website)");
// Platzhalter im Sync-Zusatz (Hoster, Anmeldedienst) zählen nur für Builds mit Server
const rechtOhneKonst = recht.replace(/export const PLATZHALTER_RECHT.*\n/, "");
const rechtOhneSync = process.env.EXPO_PUBLIC_API_URL ? rechtOhneKonst : rechtOhneKonst.replace(/export const DATENSCHUTZ_SYNC[\s\S]*?\n};\n/, "");
pruefe(!rechtOhneSync.includes("[vor Veröffentlichung eintragen]"), "Datenschutzhinweis ohne Platzhalter (src/rechtliches.ts; mit Server auch Hoster und Anmeldedienst im Sync-Zusatz)");
const nurSync = ["EmailAddress", "Name", "UserID"].map((x) => `NSPrivacyCollectedDataType${x}`);
pruefe(!datenarten.some((d) => nurSync.includes(d.NSPrivacyCollectedDataType)) && fs.existsSync(path.join(APP, "app.config.ts")), "Privacy Manifest: E-Mail, Name, Benutzer-ID nur in Builds mit Sync (app.config.ts, nicht fest in app.json)");

// Store-Texte
const s = storeJson;
// Marke nur als Platzhalter in store/de.json – kein fest geschriebener Name (docs/14-marke.md)
pruefe(!/Amtlos/.test(storeRoh) && !storeRoh.includes(MARKE.name) && !/\{\{[A-Z_]+\}\}/.test(JSON.stringify(s)) && PLATZHALTER.length > 0, `Store-Texte nennen die Marke nur über Platzhalter ({{MARKE}} → „${MARKE.name}“)`);
const b = (x) => Buffer.byteLength(x);
pruefe(s.name.length <= 30, `Name ≤ 30 Zeichen (${s.name.length})`);
pruefe(s.untertitel.length <= 30, `Untertitel ≤ 30 Zeichen (${s.untertitel.length})`);
pruefe(s.werbetext.length <= 170, `Werbetext ≤ 170 Zeichen (${s.werbetext.length})`);
pruefe(b(s.schluesselwoerter) <= 100, `Schlüsselwörter ≤ 100 Byte (${b(s.schluesselwoerter)})`);
pruefe(s.beschreibung.length <= 4000, `Beschreibung ≤ 4000 Zeichen (${s.beschreibung.length})`);
pruefe(/Nutzungsbedingungen: https:\/\//.test(s.beschreibung), "Beschreibung verlinkt die Nutzungsbedingungen (Pflicht bei Abos)");
pruefe(/\(Pro\)/.test(s.beschreibung), "Beschreibung kennzeichnet Pro-Funktionen (Richtlinie 2.3.2)");
// E-188 (Modell Check-Teaser): kostenlos nur der Pflichten-Check (Zahl und die ersten 3 Pflichten), alles Weitere mit Pro
// – jede Funktion als (Pro) gekennzeichnet, kein Versprechen „kostenlos ohne Limit“ oder kostenloser Rechnungen mehr
const alleTexte = [s.untertitel, s.werbetext, s.beschreibung, s.neu, ...s.bilder.map((x) => `${x.titel} ${x.text}`)].join("\n");
const proZeilen = [/Rechnungen[^\n]*\(Pro\)/, /E-Rechnung \(XRechnung\)[^\n]*\(Pro\)/, /Belege[^\n]*\(Pro\)/, /Kasse[^\n]*\(Pro\)/, /Alle Pflichten[^\n]*\(Pro\)/, /Erinnerung[^\n]*\(Pro\)/, /Rechtsgrundlage[^\n]*\(Pro\)/, /Vorlagen[^\n]*\(Pro\)/, /Kontrollmappe[^\n]*\(Pro\)/];
pruefe(proZeilen.every((r) => r.test(s.beschreibung)) && /Pflichten-Check kostenlos/.test(s.beschreibung) && /ersten 3/.test(s.beschreibung) && /kostenlose[rn]? Testphase/.test(s.beschreibung) && !/ohne Limit|Rechnungen kostenlos|3 Rechnungen|1 Vorlage als PDF/.test(alleTexte), "Beschreibung nach E-188: Pflichten-Check kostenlos (erste 3), alles Weitere mit Pro gekennzeichnet, Testphase genannt, kein „kostenlos ohne Limit“");
pruefe(/most features require the subscription/.test(s.pruefhinweise) && /Sandbox purchase/.test(s.pruefhinweise) && /Visible without a subscription/.test(s.pruefhinweise) && /first 3 obligations/.test(s.pruefhinweise) && /always|Always/.test(s.pruefhinweise) && /shared before/.test(s.pruefhinweise) && /How to see the paywall/.test(s.pruefhinweise) && /first completed obligations check/.test(s.pruefhinweise) && /Später/.test(s.pruefhinweise) && !/1 template per calendar month|3 invoices per calendar month/.test(s.pruefhinweise), "Prüfhinweise für Apple (E-188): ohne Abo nur der Check-Teaser, Testphase/Sandbox nötig, was immer sichtbar bleibt, wie man den Bezahlschirm sieht");
const webBilder = path.join(APP, "../website/bilder");
pruefe(s.bilder.every((x) => fs.existsSync(path.join(webBilder, `${x.bildschirm}.jpg`))) && fs.existsSync(path.join(webBilder, "og.jpg")), "Website-Bilder und Vorschaubild vorhanden (werkzeuge/store-bilder.mjs schreibt sie mit)");

// Phase 2.3 (E-156): kein eigener Freischaltweg (App Review 3.1.1 – keine Lizenzschlüssel, QR-Codes o. Ä.). Pro kommt nur
// aus der RevenueCat-Berechtigung (pro/kauf.ts) oder – nur im Testmodus – vom Testschalter; Partner-Codes sind reine Anzeige.
{
  const quellen = [];
  const sammeln = (dir) => {
    for (const e of fs.readdirSync(path.join(APP, dir), { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) sammeln(p);
      else if (/\.(ts|tsx)$/.test(e.name)) quellen.push([p, lies(p)]);
    }
  };
  sammeln("src");
  const befunde = [];
  const zustand = lies("src/zustand.tsx");
  if (!zustand.includes("const pro = storePro || (testmodus && stand.proTest);")) befunde.push("zustand.tsx: Pro nicht mehr nur aus Store bzw. Testmodus");
  // setStorePro nur mit Ergebnissen aus kauf.ts (proAktiv, proBeobachten) bzw. über proAktualisieren
  const erlaubtSetzen = [/^\s*setStorePro\(an\);/, /\.then\(setStorePro\)/, /proBeobachten\(setStorePro\)/, /: setStorePro\(aktiv\)\)/, /useState\(false\)/];
  for (const zeile of zustand.split("\n").filter((z) => z.includes("setStorePro") && !z.includes("const [storePro, setStorePro]"))) if (!erlaubtSetzen.some((r) => r.test(zeile))) befunde.push(`zustand.tsx: unerwartetes setStorePro – ${zeile.trim().slice(0, 80)}`);
  for (const [p, q] of quellen) {
    const rel = p.replace(/\\/g, "/");
    // Berechtigungen lesen nur die Kauf-Module
    if (/entitlements/.test(q) && !/src\/pro\/(kauf|code)\.ts$/.test(rel)) befunde.push(`${rel}: liest Berechtigungen außerhalb von pro/kauf.ts`);
    // keine Lizenzschlüssel, Freischalt- oder Aktivierungscodes
    if (/lizenzschl|license.?key|freischalt.?code|unlock.?code|aktivierungscode|activation.?code/i.test(q.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) befunde.push(`${rel}: Lizenzschlüssel/Freischaltcode im Code`);
    // Pro auf „an“ setzen nur mit einem Ergebnis aus kauf.ts (Kauf, Wiederherstellen, Code einlösen, Konto verbinden)
    if (/proAktualisieren\((true|aktiv)\)/.test(q) && !/from "\.\.\/pro\/kauf"/.test(q)) befunde.push(`${rel}: setzt Pro ohne kauf.ts`);
    if (/proTestSetzen\(true\)/.test(q) && !/if \(!testmodus\) return;\s*\/\/[^\n]*\n\s*z\.proTestSetzen\(true\)/.test(q)) befunde.push(`${rel}: Testschalter außerhalb des Testmodus`);
    // Partner-Branding berührt den Pro-Status nie
    if (/src\/partner\//.test(rel) && /\bpro\b|proTest|proAktualisieren|setStorePro|entitlements/.test(q.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) befunde.push(`${rel}: Partner-Modul berührt Pro`);
  }
  pruefe(!befunde.length, `Kein eigener Freischaltweg (App Review 3.1.1): Pro nur aus RevenueCat-Berechtigung bzw. Testmodus, Partner-Code nur Anzeige${befunde.length ? ` – ${befunde.join("; ")}` : ""}`);
}

// Fachliche Freigabe
const pl =fs.readFileSync(path.join(APP, "../../PRUEFLISTE.md"), "utf8");
// E-201 (Bedingung des Rechtsanwalts für die Rollenangabe): keine Rolle eines Prüfers in Store-Texten, Bildzeilen und Werbung –
// dort stünde sie für die ganze App. Die Rolle steht nur im Vermerk bei der bestätigten Fassung in der App.
const ROLLE_WERBUNG = /Rechtsanw|Steuerberater|Fachkraft für Arbeitssicherheit|Lebensmittelfachbeauftragt|\bSifa\b/;
pruefe(!ROLLE_WERBUNG.test(JSON.stringify(storeJson)), "Store-Texte und Bildzeilen ohne Rolle eines Prüfers (E-201: die Rolle steht nur im Vermerk bei der bestätigten Fassung)");
pruefe(!/\| T-5[2-9] \|/.test(pl) || /T-52[^\n]*erledigt/i.test(pl), "Fachliche Freigabe der Vorlagen (PRUEFLISTE T-52 ff.) – vor dem Livegang durch Fachleute");
// E-197: Prüfvermerk nur aus schriftlich bestätigten Freigaben (Bestätigung per Mail; E-198: die Mail bewahrt der Gründer auf,
// im Repository steht nur der Nachweis mit Art, Datum, Rolle und Umfang) – was noch auf Bestätigung oder Nachprüfung wartet
{
  // E-198: keine Mails im Repository – weder Mails der Prüfer noch Entwürfe unserer Mails
  const mails = [];
  const durch = (ordner) => { for (const e of fs.existsSync(ordner) ? fs.readdirSync(ordner, { withFileTypes: true }) : []) { const p = path.join(ordner, e.name); if (e.isDirectory()) durch(p); else if (/(\.eml|\.msg|\.mbox|mail[^/]*\.txt)$/i.test(e.name) || (/\.(txt|md)$/.test(e.name) && /^(Betreff|Subject):/m.test(fs.readFileSync(p, "utf8").slice(0, 2000)))) mails.push(path.relative(path.join(APP, "../.."), p)); } };
  durch(path.join(APP, "../..", "docs"));
  pruefe(!mails.length, `Keine Mails im Repository (E-198: Bestätigungen der Prüfer bewahrt der Gründer auf)${mails.length ? ` – ${mails.join(", ")}` : ""}`);
  // E-199: keine Unterlagen von oder für Prüfer (Berichte, ausgefüllte Dateien, Pakete, Blätter) und keine Namen – Namen nur als
  // SHA-256 der Wörter (docs/freigabe-katalog/namen-sha256.json), nicht im Klartext
  {
    const WURZEL = path.join(APP, "../..");
    const dateien = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: WURZEL, encoding: "utf8" })
      .split("\n")
      .filter((d) => d && !d.includes("node_modules") && fs.existsSync(path.join(WURZEL, d)) && fs.statSync(path.join(WURZEL, d)).isFile());
    const unterlagen = dateien.filter((d) => /^docs\/(pruefberichte|freigabe-katalog\/versand)/.test(d) || /\.(xlsx|xls|xlsm|pdf|eml|msg|mbox|docx?|odt|ods)$/i.test(d) || (d.startsWith("docs/") && /\.(jpe?g|png|heic|tiff?)$/i.test(d)) || (d.startsWith("docs/freigabe-vorlagen/") && !d.endsWith(".py")));
    const h = JSON.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/namen-sha256.json"), "utf8"));
    const sha = (s) => createHash("sha256").update(s).digest("hex");
    const prueftexte = ["docs/freigabe-katalog/freigaben.yaml", "docs/freigabe-katalog/offene-punkte.yaml", "packages/fachlogik/src/dokumente/geprueft.ts", "apps/mobile/src/pflichten/pruefer.ts", "docs/freigabe-katalog/freigaben-regelwerte.yaml"];
    const mitNamen = dateien.filter((d) => {
      const roh = fs.readFileSync(path.join(WURZEL, d));
      const w = (roh.subarray(0, 8000).includes(0) ? roh.toString("latin1") : roh.toString("utf8")).toLowerCase().match(/[a-zäöüß]+/g) ?? [];
      const einzeln = new Set(prueftexte.includes(d) ? [...h.einzeln, ...h.mehrdeutig] : h.einzeln);
      return [...new Set(w)].some((x) => einzeln.has(sha(x))) || w.slice(1).some((x, i) => h.paare.includes(sha(`${w[i]} ${x}`)));
    });
    pruefe(!unterlagen.length && !mitNamen.length, `Keine Prüfunterlagen und keine Namen im Repository (E-199: Unterlagen von und für Prüfer bewahrt der Gründer auf; Nachweis nur in freigaben.yaml und geprueft.ts)${unterlagen.length || mitNamen.length ? ` – ${[...unterlagen, ...mitNamen.map((d) => `${d} (Name)`)].join(", ")}` : ""}`);
  }
  // Katalog und Vorlagen – herausgelöst nach werkzeuge/freigabe-pruefungen.mjs (E-240: gilt auch vor einem Inhalts-Update)
  {
    const { freigabePruefungen } = await import("./freigabe-pruefungen.mjs");
    await freigabePruefungen(pruefe);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Google Play (E-190): Android-App in gleicher Qualität. Was im Code geht, ist erledigt; offen bleibt, was das
// Organisationskonto der UG, die Play Console oder eine fachliche Freigabe braucht (docs/11-store-start.md §10).
const okA = [];
const offenA = [];
const pruefeA = (bed, text) => (bed ? okA : offenA).push(text);
{
  const play = markeEinsetzenTief(JSON.parse(lies("store/de-android.json")));
  const k = play.konsole ?? {};
  // Konto und Zugang
  pruefeA(k.organisationskonto === true && /^\d{6,}$/.test(String(k.entwicklerkontoId ?? "")), "Google-Play-Entwicklerkonto als Organisation der UG (D-U-N-S-Nummer nötig, nach der Eintragung; store/de-android.json → konsole.organisationskonto, konsole.entwicklerkontoId) – PRUEFLISTE T-176");
  const dienstkonto = eas.submit?.production?.android?.serviceAccountKeyPath;
  pruefeA(dienstkonto && fs.existsSync(path.join(APP, dienstkonto)), `Dienstkonto-Schlüssel für eas submit (Play Console → API-Zugriff; Datei ${dienstkonto ?? "–"}, nicht einchecken)`);
  pruefeA(eas.submit?.production?.android?.track === "internal" && eas.build?.production?.android?.buildType === "app-bundle", "EAS: App-Bundle (AAB) für Google Play, Einreichen in den internen Test (eas.json)");
  const rcAndroid = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || eas.build?.[profil]?.env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";
  if (profil === "production") {
    pruefeA(rcAndroid, "RevenueCat-Schlüssel EXPO_PUBLIC_REVENUECAT_ANDROID_KEY für das Profil „production“ (RevenueCat: Google-Play-App mit Dienstkonto, Produkte amtlos_pro_jahr/amtlos_pro_monat, Berechtigung „pro“; eas env:create … --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) – ohne ihn lässt sich Pro auf Android nicht kaufen");
    if (rcAndroid) pruefeA(/^goog_/.test(rcAndroid), "RevenueCat-Schlüssel ist der öffentliche Google-Play-Schlüssel (beginnt mit „goog_“)");
  }
  // Rechtstexte
  pruefeA(/export const DATENSCHUTZ_ANDROID = \{\s*freigegeben: true/.test(recht), "Datenschutzhinweis der Android-App freigegeben (DATENSCHUTZ_ANDROID.freigegeben, Entwurf docs/datenschutz-android-entwurf.md – Rechtsanwalt, PRUEFLISTE T-177)");
  // E-205: gemeinsame Fassung für beide Apps; bis zur Inkraftsetzung verlinkt die Android-App sie als Entwurf
  pruefeA(nbInKraft, "Nutzungsbedingungen (gemeinsame Fassung iPhone/Android, inhaltlich freigegeben 26.10.2026, E-205) in Kraft – nach Eintragung der UG, PRUEFLISTE T-235; bis dahin verlinkt die Android-App sie als „Entwurf – noch nicht in Kraft“");
  // Play Console
  const ds = play.datensicherheit ?? {};
  const unsicher = [...(ds.erhoben ?? [])].filter((e) => e.pruefen).map((e) => e.datentyp);
  pruefeA(k.datensicherheitAbgesendet === true && !unsicher.length, `Formular „Datensicherheit“ ausgefüllt (docs/play-datensicherheit.md${unsicher.length ? `; noch zu bestätigen: ${unsicher.join(", ")}` : ""}) – PRUEFLISTE T-179`);
  pruefeA(k.inhaltseinstufung === true, "Inhaltseinstufung (IARC-Fragebogen) in der Play Console ausgefüllt (store/de-android.json → inhaltseinstufung)");
  pruefeA(k.zielgruppe === true, "Zielgruppe und Inhalte (18 und älter, nicht für Kinder) in der Play Console angegeben");
  pruefeA(k.finanzfunktionen === true, "Erklärung zu Finanzfunktionen in der Play Console abgegeben (Rechnungen/Kassenbuch – Einordnung prüfen, PRUEFLISTE T-179)");
  pruefeA(k.appZugriff === true, "„App-Zugriff“ in der Play Console: Hinweise für die Prüfung (store/de-android.json → app_zugriff) und Lizenztester eingetragen");
  // E-202 (Rechtsanwalt, 26.10.2026): Seine Freigabe des Android-Datenschutzhinweises setzt voraus, dass der Release-Build
  // keine Verbindung zu Google-Diensten aufbaut (Firebase aus expo-notifications) – sonst die Bibliothek entfernen oder den
  // Hinweis vor dem Start erweitern und erneut freigeben lassen. Startblocker, bis am Release-Build nachgewiesen.
  pruefeA(k.releaseOhneGoogleDienste === true, "Startblocker Firebase: Release-Build baut keine Verbindung zu Google-Diensten auf (zusammengeführtes Manifest, ./gradlew :app:dependencies, Netzwerkmitschnitt beim ersten Start – z. B. kein firebaseinstallations.googleapis.com); sonst firebase-messaging entfernen oder den Datenschutzhinweis erweitern und erneut freigeben lassen (store/de-android.json → konsole.releaseOhneGoogleDienste; Voraussetzung der Freigabe des Rechtsanwalts, PRUEFLISTE T-219, T-226)");
  // im Code erledigt – meldet nur, wenn etwas kaputtgeht
  pruefeA(app.android?.package === MARKE.technisch.bundleId, `Android-Paket ${app.android?.package} = Marke (${MARKE.technisch.bundleId})`);
  pruefeA(app.android?.allowBackup === false && app.android?.adaptiveIcon?.monochromeImage && fs.existsSync(path.join(APP, app.android.adaptiveIcon.monochromeImage)), "Android: keine Gerätesicherung (allowBackup false), adaptives Symbol mit Monochrom-Fassung");
  pruefeA(["READ_MEDIA_IMAGES", "READ_EXTERNAL_STORAGE", "SCHEDULE_EXACT_ALARM", "RECORD_AUDIO"].every((x) => (app.android?.blockedPermissions ?? []).includes(`android.permission.${x}`)), "Android: Medien-, Speicher-, Wecker- und Mikrofon-Berechtigungen gesperrt (keine Play-Erklärungen nötig)");
  pruefeA(play.titel.length <= 30 && play.kurzbeschreibung.length <= 80 && play.beschreibung.length <= 4000 && play.neu.length <= 500, `Play-Texte in den Grenzen (Titel ${play.titel.length}/30, Kurzbeschreibung ${play.kurzbeschreibung.length}/80, Beschreibung ${play.beschreibung.length}/4000)`);
  pruefeA(!/iPhone|iCloud|Face ID|Apple-Account|stdeula/.test(JSON.stringify([play.titel, play.kurzbeschreibung, play.beschreibung, play.neu, play.bilder])), "Play-Texte ohne Apple-Wörter");
  pruefeA(!ROLLE_WERBUNG.test(JSON.stringify(play)), "Play-Texte und Bildzeilen ohne Rolle eines Prüfers (E-201)");
}

const nurAndroid = process.argv.includes("--android");
const nurIos = process.argv.includes("--ios");
if (!nurAndroid) {
  console.log("App Store (iOS)");
  for (const t of ok) console.log(`  ✓ ${t}`);
  for (const t of offen) console.log(`  ✗ ${t}`);
}
if (!nurIos) {
  console.log("\nGoogle Play (Android, E-190)");
  for (const t of okA) console.log(`  ✓ ${t}`);
  for (const t of offenA) console.log(`  ✗ ${t}`);
}
const zahl = (nurAndroid ? 0 : offen.length) + (nurIos ? 0 : offenA.length);
console.log(zahl ? `\n${zahl} Punkte offen – noch nicht einreichen.${nurAndroid || nurIos ? "" : ` (App Store ${offen.length}, Google Play ${offenA.length})`}` : "\nBereit zum Einreichen.");
process.exitCode = zahl ? 1 : 0;
