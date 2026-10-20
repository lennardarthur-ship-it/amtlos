/**
 * Vor dem Einreichen im App Store (E-132): listet alles, was noch fehlt – Anbieterangaben, Links, EAS, Abo-Schlüssel,
 * Store-Texte (Längen), Rechtstexte-Freigabe, Prüfliste. Exit 1, solange etwas offen ist.
 *
 *   node werkzeuge/store-check.mjs                    # prüft das Profil „production“
 *   node werkzeuge/store-check.mjs --profile preview  # anderes EAS-Profil (oder EAS_BUILD_PROFILE)
 */
/* global process, console, Buffer, URL */
/* eslint-disable no-console -- Kommandozeilenwerkzeug */
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const lies = (p) => fs.readFileSync(path.join(APP, p), "utf8");
const offen = [];
const ok = [];
const pruefe = (bed, text) => (bed ? ok : offen).push(text);

// Anbieter und Links aus src/rechtliches.ts (einfache Auswertung der Felder)
const recht = lies("src/rechtliches.ts");
const feld = (block, name) => new RegExp(`export const ${block} = \\{[\\s\\S]*?\\n\\s+${name}: "([^"]*)"`).exec(recht)?.[1] ?? "";
// leere Anbieterangaben zeigt die App als „folgt“ (Impressum, Datenschutz) – ein Store-Build darf so nicht raus
for (const [n, t] of [["name", "Firma"], ["anschrift", "Anschrift"], ["vertretung", "Vertretung"], ["email", "E-Mail"]]) pruefe(feld("ANBIETER", n), `Impressum: ${t} (src/rechtliches.ts → ANBIETER.${n})`);
for (const [n, t] of [["website", "Website"], ["datenschutz", "Datenschutzerklärung im Netz (Pflicht im App Store)"], ["support", "Support-URL (Pflicht im App Store)"]]) pruefe(feld("LINKS", n), `${t} (LINKS.${n})`);
pruefe(/freigegeben: true/.test(recht), "Datenschutzhinweis der App fachlich freigegeben (DATENSCHUTZ.freigegeben, PRUEFLISTE T-77)");

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
const app = JSON.parse(lies("app.json")).expo;
pruefe(app.extra?.eas?.projectId, "EAS-Projekt verknüpft (eas init → app.json extra.eas.projectId)");
pruefe(app.ios?.config?.usesNonExemptEncryption !== undefined || app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== undefined, "Export-Compliance der Verschlüsselung entschieden (ios.config.usesNonExemptEncryption, PRUEFLISTE T-77)");
if (app.ios?.config?.usesNonExemptEncryption === true) console.log("  · Verschlüsselung: in App Store Connect „Standard encryption algorithms … in addition to Apple's operating system“ angeben; Frankreich nur mit französischer Verschlüsselungserklärung, sonst bis dahin ausschließen (docs/11 §5)");
pruefe(app.ios?.privacyManifests?.NSPrivacyTracking === false, "Privacy Manifest vorhanden");
// R7: Kaufhistorie (RevenueCat) mit den Zwecken App-Funktionalität und Analysen; Konto-Daten nur mit Sync (app.config.ts)
const datenarten = app.ios?.privacyManifests?.NSPrivacyCollectedDataTypes ?? [];
const kauf = datenarten.find((d) => d.NSPrivacyCollectedDataType === "NSPrivacyCollectedDataTypePurchaseHistory");
pruefe(kauf?.NSPrivacyCollectedDataTypePurposes?.includes("NSPrivacyCollectedDataTypePurposeAnalytics") && kauf?.NSPrivacyCollectedDataTypePurposes?.includes("NSPrivacyCollectedDataTypePurposeAppFunctionality"), "Privacy Manifest: Kaufhistorie mit Zweck App-Funktionalität und Analysen (RevenueCat)");
const nurSync = ["EmailAddress", "Name", "UserID"].map((x) => `NSPrivacyCollectedDataType${x}`);
pruefe(!datenarten.some((d) => nurSync.includes(d.NSPrivacyCollectedDataType)) && fs.existsSync(path.join(APP, "app.config.ts")), "Privacy Manifest: E-Mail, Name, Benutzer-ID nur in Builds mit Sync (app.config.ts, nicht fest in app.json)");

// Store-Texte
const s = JSON.parse(lies("store/de.json"));
const b = (x) => Buffer.byteLength(x);
pruefe(s.name.length <= 30, `Name ≤ 30 Zeichen (${s.name.length})`);
pruefe(s.untertitel.length <= 30, `Untertitel ≤ 30 Zeichen (${s.untertitel.length})`);
pruefe(s.werbetext.length <= 170, `Werbetext ≤ 170 Zeichen (${s.werbetext.length})`);
pruefe(b(s.schluesselwoerter) <= 100, `Schlüsselwörter ≤ 100 Byte (${b(s.schluesselwoerter)})`);
pruefe(s.beschreibung.length <= 4000, `Beschreibung ≤ 4000 Zeichen (${s.beschreibung.length})`);
pruefe(/Nutzungsbedingungen: https:\/\//.test(s.beschreibung), "Beschreibung verlinkt die Nutzungsbedingungen (Pflicht bei Abos)");
pruefe(/\(Pro\)/.test(s.beschreibung), "Beschreibung kennzeichnet Pro-Funktionen (Richtlinie 2.3.2)");
const webBilder = path.join(APP, "../website/bilder");
pruefe(s.bilder.every((x) => fs.existsSync(path.join(webBilder, `${x.bildschirm}.jpg`))) && fs.existsSync(path.join(webBilder, "og.jpg")), "Website-Bilder und Vorschaubild vorhanden (werkzeuge/store-bilder.mjs schreibt sie mit)");

// Fachliche Freigabe
const pl = fs.readFileSync(path.join(APP, "../../PRUEFLISTE.md"), "utf8");
pruefe(!/\| T-5[2-9] \|/.test(pl) || /T-52[^\n]*erledigt/i.test(pl), "Fachliche Freigabe der Vorlagen (PRUEFLISTE T-52 ff.) – vor dem Livegang durch Fachleute");

for (const t of ok) console.log(`  ✓ ${t}`);
for (const t of offen) console.log(`  ✗ ${t}`);
console.log(offen.length ? `\n${offen.length} Punkte offen – noch nicht einreichen.` : "\nBereit zum Einreichen.");
process.exitCode = offen.length ? 1 : 0;
