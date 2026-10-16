/**
 * Vor dem Einreichen im App Store (E-132): listet alles, was noch fehlt – Anbieterangaben, Links, EAS, Abo-Schlüssel,
 * Store-Texte (Längen), Rechtstexte-Freigabe, Prüfliste. Exit 1, solange etwas offen ist.
 *
 *   node werkzeuge/store-check.mjs
 */
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
for (const [n, t] of [["name", "Firma"], ["anschrift", "Anschrift"], ["vertretung", "Vertretung"], ["email", "E-Mail"]]) pruefe(feld("ANBIETER", n), `Impressum: ${t} (src/rechtliches.ts → ANBIETER.${n})`);
for (const [n, t] of [["website", "Website"], ["datenschutz", "Datenschutzerklärung im Netz (Pflicht im App Store)"], ["support", "Support-URL (Pflicht im App Store)"]]) pruefe(feld("LINKS", n), `${t} (LINKS.${n})`);
pruefe(/freigegeben: true/.test(recht), "Datenschutzhinweis der App fachlich freigegeben (DATENSCHUTZ.freigegeben, PRUEFLISTE T-77)");

// EAS und Abo
const eas = JSON.parse(lies("eas.json"));
pruefe(eas.submit?.production?.ios?.ascAppId, "App Store Connect App-ID (eas.json → submit.production.ios.ascAppId)");
pruefe(eas.submit?.production?.ios?.appleTeamId, "Apple Team-ID (eas.json → submit.production.ios.appleTeamId)");
pruefe(!eas.build?.production?.env?.EXPO_PUBLIC_PRO_TESTMODUS, "Store-Build ohne Pro-Testmodus (eas.json → build.production.env ohne EXPO_PUBLIC_PRO_TESTMODUS)");
pruefe(!process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_OIDC_ISSUER, "Konto: mit Server (EXPO_PUBLIC_API_URL) auch einen Anmeldedienst setzen (EXPO_PUBLIC_OIDC_ISSUER) – sonst bietet die App kein Konto an");
pruefe(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, "RevenueCat-Schlüssel als EAS-Secret EXPO_PUBLIC_REVENUECAT_IOS_KEY (ohne ihn lässt sich Pro im Store-Build nicht kaufen)");
const app = JSON.parse(lies("app.json")).expo;
pruefe(app.extra?.eas?.projectId, "EAS-Projekt verknüpft (eas init → app.json extra.eas.projectId)");
pruefe(app.ios?.config?.usesNonExemptEncryption !== undefined || app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== undefined, "Export-Compliance der Verschlüsselung entschieden (ios.config.usesNonExemptEncryption, PRUEFLISTE T-77)");
pruefe(app.ios?.privacyManifests?.NSPrivacyTracking === false, "Privacy Manifest vorhanden");

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
