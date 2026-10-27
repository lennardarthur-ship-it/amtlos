/**
 * E-219 (externer Prüfer, Befund 2): Die Website klang, als seien Rechnungen kostenlos („Rechnung als Brief – DIN 5008
 * und GiroCode – mit Pro in deiner Hausfarbe“, Punkte zu GiroCode und Festschreibung ohne Pro-Kennzeichen). Tatsächlich
 * ist nach E-188 jede neue Rechnung Pro. Risiko für App Review (3.1.2, 2.3.x Genauigkeit) und Bewertungen.
 *
 * Dieser Test hält Website, Store-Texte (iPhone und Android), Startpunkte der App und LIESMICH des Testpakets an die
 * Regeln in `src/pro/regeln.ts`:
 * 1. Wo „kostenlos“, „gratis“ oder „ohne Abo/Pro“ neben einer Pro-Funktion steht, steht auch Pro dabei – oder es geht um
 *    das, was immer frei bleibt (ansehen, erneut teilen, stornieren, exportieren …).
 * 2. Jede Funktionsangabe (Listenpunkt, Bildunterschrift, Store-Punkt, Bildtext, Startpunkt) mit einer Pro-Funktion ist
 *    als Pro gekennzeichnet oder nennt ausdrücklich, was immer frei bleibt.
 * 3. „die ersten N“ Pflichten: N ist `PFLICHTEN_FREI`.
 * 4. Die Pro-Listen nennen jede Funktion aus `PRO_VORTEILE`.
 * 5. Keine der Formulierungen, die zum Befund geführt haben.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PFLICHTEN_FREI, PRO_VORTEILE, type ProFunktion } from "../src/pro/regeln";
import { T as TEXT } from "../src/texte";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.resolve(hier, "..", p), "utf8");
const html = lies("../website/seite.html");
const bauen = lies("../website/bauen.mjs");
const ios = JSON.parse(lies("store/de.json")) as Record<string, string> & { bilder: { titel: string; text: string }[] };
const play = JSON.parse(lies("store/de-android.json")) as Record<string, string> & { bilder: { titel: string; text: string }[] };
const liesmich = (/cat > "\$P\/LIESMICH\.txt" <<'TXT'\n([\s\S]*?)\nTXT/.exec(lies("werkzeuge/testpaket.sh")) ?? [])[1] ?? "";

/** Pro-Funktionen, wie sie in Texten heißen (Wortanfang und -ende: „Kleinbetragsrechnungen“, „Zahlungserinnerung“ zählen nicht als „Rechnung“, „Erinnerung“) */
const PRO_WORT = /(?<![\p{L}\d-])(Rechnung(en)?|E[-‑]Rechnung(en)?|XRechnung(en)?|Gutschrift(en)?|Belege?|Kasse|Kassenbuch|Tagesabschl\p{L}*|Kassensturz|GiroCode|Kontrollmappe|Erinnerung(en)?|PDF|Steuerberatung|DATEV\p{L}*|Briefkopf)(?![\p{L}\d])/u;
const FREI_WORT = /kostenlos|gratis|ohne Abo|ohne Pro/i;
const PRO_MARKE = /(?<![\p{L}])Pro(?![\p{L}])|\{\{MARKE_PRO\}\}/u;
/** was nach E-188 immer frei bleibt: Vorhandenes ansehen, erneut teilen, stornieren, exportieren, Kassenbuch erfasster Tage */
const IMMER_FREI = /stornier|Storno|erneut|exportier|ansehen|immer|Immer|bleib|nach dem Abo|im Katalog/;

const ohneTags = (s: string) => s.replace(/<span class="pro-marke">Pro<\/span>/g, "Pro").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const saetze = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„{])/).map((x) => x.trim()).filter(Boolean);

// Website: Pro-Paket gesondert (dort ist jeder Punkt Pro), sonst Listenpunkte und Bildunterschriften als Funktionsangaben
const proPaket = (/<div class="paket pro">([\s\S]*?)<\/div>/.exec(html) ?? [])[1] ?? "";
const freiPaket = (/<div class="paket">([\s\S]*?)<\/div>/.exec(html) ?? [])[1] ?? "";
const htmlOhnePro = html.replace(proPaket, "").replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
const htmlAngaben = [...htmlOhnePro.matchAll(/<(li|figcaption)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ohneTags(m[2]!));
const htmlBloecke = [...htmlOhnePro.matchAll(/content="([^"]*)"/g)].map((m) => m[1]!).concat(htmlOhnePro.split(/<\/?(?:li|p|figcaption|h1|h2|h3|summary|details|div|ul)[^>]*>/).map(ohneTags));
const jsonLd = (/description: "([^"]*)"/.exec(bauen) ?? [])[1] ?? "";

// Store: jede Zeile, Punkte („•“) und Bildtexte als Funktionsangaben
const storeTexte = (s: Record<string, string> & { bilder: { titel: string; text: string }[] }, felder: string[]) => felder.flatMap((f) => (s[f] ?? "").split("\n"));
const storeAngaben = (s: Record<string, string> & { bilder: { titel: string; text: string }[] }) => [...(s.beschreibung ?? "").split("\n").filter((z) => z.startsWith("•")), ...s.bilder.map((b) => `${b.titel}: ${b.text}`)];

// LIESMICH: Punkte des Rundgangs („- “ mit eingerückten Folgezeilen) – die Prüfliste für Android danach beschreibt Tests, keine Funktionen
const rundgang = (/RUNDGANG DURCH DIE APP\n([\s\S]*?)\n\n\n/.exec(liesmich) ?? [])[1] ?? "";
const liesmichPunkte = rundgang.split(/\n(?=- |\S)/).filter((p) => p.startsWith("- ")).map((p) => p.replace(/\s+/g, " "));

const appAngaben = TEXT.start_punkte.map((p) => `${p.titel}: ${p.text}`);
const appTexte = [TEXT.pro_check_text, TEXT.pro_zeile_frei, TEXT.pro_frei_bleibt, TEXT.pro_wert_text, TEXT.pro_unter, ...Object.values(TEXT.pro_grund).map((f) => f(0))];

const QUELLEN: [string, string[]][] = [
  ["Website", [...htmlBloecke, jsonLd]],
  ["Store iPhone", storeTexte(ios, ["untertitel", "werbetext", "beschreibung", "neu"]).concat(ios.bilder.map((b) => `${b.titel}: ${b.text}`))],
  ["Store Android", storeTexte(play, ["titel", "kurzbeschreibung", "beschreibung", "neu"]).concat(play.bilder.map((b) => `${b.titel}: ${b.text}`))],
  ["App", [...appAngaben, ...appTexte]],
  ["LIESMICH", liesmich.split(/\n\n+/).map((a) => a.replace(/\s+/g, " "))],
];
const ANGABEN: [string, string[]][] = [
  ["Website", htmlAngaben],
  ["Store iPhone", storeAngaben(ios)],
  ["Store Android", storeAngaben(play)],
  ["App", appAngaben],
  ["LIESMICH", liesmichPunkte],
];

describe("E-219: Werbetexte versprechen nicht mehr, als ohne Pro geht (regeln.ts)", () => {
  it("die Texte sind gefunden (Website, Store, App, LIESMICH)", () => {
    expect(htmlAngaben.length).toBeGreaterThan(20);
    expect(proPaket).toMatch(/Rechnungen/);
    expect(freiPaket).toMatch(/Pflichten-Check/);
    expect(jsonLd).toMatch(/Pflichten/);
    expect(liesmichPunkte.length).toBeGreaterThan(8);
  });

  it("1. „kostenlos“ neben einer Pro-Funktion nur mit Pro-Kennzeichen oder für das, was immer frei bleibt", () => {
    const fehler: string[] = [];
    for (const [q, texte] of QUELLEN) for (const t of texte) for (const s of saetze(t)) if (FREI_WORT.test(s) && PRO_WORT.test(s) && !PRO_MARKE.test(s) && !IMMER_FREI.test(s)) fehler.push(`${q}: ${s}`);
    expect(fehler).toEqual([]);
  });

  it("2. jede Funktionsangabe mit einer Pro-Funktion ist als Pro gekennzeichnet (oder nennt, was immer frei bleibt)", () => {
    const fehler: string[] = [];
    for (const [q, angaben] of ANGABEN) for (const a of angaben) if (PRO_WORT.test(a) && !PRO_MARKE.test(a) && !IMMER_FREI.test(a)) fehler.push(`${q}: ${a}`);
    expect(fehler).toEqual([]);
  });

  it("2b. das Kostenlos-Paket der Website nennt nur, was regeln.ts frei lässt", () => {
    const punkte = [...freiPaket.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => ohneTags(m[1]!));
    expect(punkte.length).toBeGreaterThan(0);
    for (const p of punkte) if (PRO_WORT.test(p)) expect(p, p).toMatch(IMMER_FREI);
    expect(punkte.join(" ")).toMatch(new RegExp(`ersten ${PFLICHTEN_FREI}\\b`));
  });

  it("3. „die ersten N Pflichten“ – N ist PFLICHTEN_FREI, überall", () => {
    const zahl: Record<string, number> = { eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5 };
    const alle = [...QUELLEN.flatMap(([, t]) => t), ios.pruefhinweise ?? "", play.app_zugriff ?? ""].join("\n");
    const gefunden = [...alle.matchAll(/ersten (\d+|eins|zwei|drei|vier|fünf)\b/g), ...alle.matchAll(/first (\d+) (?:obligations|with)/g)].map((m) => zahl[m[1]!] ?? Number(m[1]));
    expect(gefunden.length).toBeGreaterThan(5);
    expect(new Set(gefunden)).toEqual(new Set([PFLICHTEN_FREI]));
  });

  it("4. die Pro-Listen nennen jede Funktion aus PRO_VORTEILE", () => {
    const WORT: Record<ProFunktion, RegExp> = {
      pflichten: /[Aa]lle Pflichten/, erinnerungen: /Erinnerung/, pflicht_details: /erklärt|Erklärung/, kontrollmappe: /Kontrollmappe/, pdf: /Vorlagen/, rechnungen: /Rechnungen/, e_rechnung: /E-Rechnung|XRechnung/, belege: /Belege/, kasse: /Kasse/, steuerberater: /Steuerberatung/, briefkopf: /Briefkopf/, icloud: /Sicherung/, sync: /Synchronisation/, ust_uebernahme: /per Tipp/,
    };
    const proZeile = (b: string) => b.split("\n").find((z) => z.startsWith("{{MARKE_PRO}}: alles Weitere")) ?? "";
    const listen: [string, string, boolean][] = [
      // Store-Builds ohne Synchronisation (de-android.json → datensicherheit: Build ohne EXPO_PUBLIC_API_URL) – dort nicht beworben
      ["Website Pro-Paket", ohneTags(proPaket), false],
      ["Store iPhone", proZeile(ios.beschreibung ?? ""), false],
      ["Store Android", proZeile(play.beschreibung ?? ""), false],
      ["LIESMICH", (/\{\{MARKE_PRO\}\} \(mit kostenloser Testphase\): alles Weitere[\s\S]*?\n(?=Pro sperrt)/.exec(liesmich) ?? [""])[0], true],
    ];
    for (const [name, text, mitSync] of listen) {
      expect(text.length, name).toBeGreaterThan(50);
      for (const f of PRO_VORTEILE) if (f !== "sync" || mitSync) expect(text, `${name}: ${f}`).toMatch(WORT[f]);
    }
  });

  it("5. keine Formulierung, nach der Rechnungen kostenlos wären (Befund)", () => {
    const alles = [...QUELLEN.flatMap(([, t]) => t), ...htmlAngaben].join("\n");
    expect(alles).not.toMatch(/mit Pro in deiner Hausfarbe/);
    expect(alles).not.toMatch(/Rechnungen, auch als E-Rechnung \(Pro\)/);
    expect(alles).not.toMatch(/Rechnungen kostenlos|kostenlose Rechnung|Rechnungen gratis|ohne Limit|unbegrenzt/i);
    // die Bildunterschrift der Rechnung trägt Pro für die Rechnung selbst
    expect(htmlAngaben.find((a) => /DIN 5008/.test(a))).toMatch(/GiroCode – mit Pro\./);
    // E-189: der Kompass zuerst – Website-Titel, Store-Werbetext und Store-Beschreibung beginnen mit der Leitfrage
    expect(html).toMatch(/<title>\{\{MARKE\}\} – Welche Pflichten hat dein Betrieb\?<\/title>/);
    for (const t of [ios.werbetext, ios.beschreibung, play.beschreibung]) expect(t).toMatch(/^Welche Pflichten hat dein Betrieb/);
  });
});
