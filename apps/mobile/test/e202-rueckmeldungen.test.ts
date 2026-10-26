/**
 * E-202: zweite Antworten der Prüfer vom 26.10.2026 – App.
 * - Steuerberater: Kassenstürze und Sachentnahmen als eigene Listen im Export für die Betriebsprüfung (§ 147 Abs. 1 AO),
 *   je mit Feldbeschreibung.
 * - Rechtsanwalt: Künstlersozialabgabe v3 (Punkt statt Semikolon, vorab freigegeben), Android-Datenschutzhinweis zweite
 *   Bestätigung mit Voraussetzung Firebase – Startblocker in store-check (Google Play), Hygieneplan: die App bietet in der
 *   Fassung Friseur/Kosmetik nur passende Vorschläge an, das Beispielwerkzeug bleibt in dieser Fassung.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Kassensturz, Sachentnahme } from "@amtlos/fachlogik";
import { DATENSCHUTZ_ANDROID_PRUEFSUMME, DATENSCHUTZ_ANDROID_ZWEITE_BESTAETIGUNG } from "../src/rechtliches";
import { PRUEFEXPORT, kassenstuerzeCsv, pruefexport, sachentnahmenCsv } from "../src/unterlagen/pruefexport";
import { LEERER_STAND, type Stand } from "../src/unterlagen/speicher";
import { KASSENSTURZ_SPALTEN, SACHENTNAHME_SPALTEN } from "../src/unterlagen/steuerpaket";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "../../..");
const lies = (datei: string) => readFileSync(path.join(WURZEL, datei), "utf8");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Linde", strasse: "Marktplatz 3", plz: "72764", ort: "Reutlingen", steuernummer: "68/123/45678" };
const kopf = (csv: string) => csv.replace(/^\uFEFF/, "").split("\r\n")[0]!;
const zeilen = (csv: string) => csv.replace(/^\uFEFF/, "").split("\r\n").filter(Boolean).slice(1).map((z) => z.split(";"));

const STUERZE: Kassensturz[] = [
  { id: "ks2", zeitpunkt: "2026-10-20T15:30:00.000Z", gezaehlt_cent: 23450, stueckelung: { "5000": 3, "2000": 4, "50": 9 }, vortag_cent: 21000, anwesend: "Mara Linde, Amtsträgerin bei der Kassennachschau", notiz: "Kassennachschau" },
  { id: "ks1", zeitpunkt: "2026-10-01T06:45:00.000Z", gezaehlt_cent: 15000, standort: "Café", anwesend: "Mara Linde" },
];
const ENTNAHMEN: Sachentnahme[] = [
  { id: "se2", datum: "2026-12-31", netto7_cent: 12345, netto19_cent: 6789, text: "Pauschbetrag 2026, 1 Person, Café und Konditorei", erstellt: "2027-01-05T09:00:00.000Z" },
  { id: "se1", datum: "2026-06-30", netto7_cent: 10000, netto19_cent: 0, erstellt: "2026-07-01T09:00:00.000Z" },
];

describe("E-202 (Steuerberater): Kassenstürze und Sachentnahmen im Export für die Betriebsprüfung", () => {
  const s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, kassenstuerze: STUERZE, sachentnahmen: ENTNAHMEN };
  const e = pruefexport(s, {}, "2027-01-10T10:00:00.000Z");
  const zip = unzipSync(e.zip);

  it("ZIP enthält Kassenstuerze.csv und Sachentnahmen.csv – nur, wenn es welche gibt", () => {
    expect(e.inhalt).toContain(PRUEFEXPORT.kassenstuerze);
    expect(e.inhalt).toContain(PRUEFEXPORT.sachentnahmen);
    expect(e).toMatchObject({ kassenstuerze: 2, sachentnahmen: 2 });
    const leer = pruefexport({ ...LEERER_STAND, betrieb: BETRIEB }, {}, "2027-01-10T10:00:00.000Z");
    expect(leer.inhalt).not.toContain(PRUEFEXPORT.kassenstuerze);
    expect(leer.inhalt).not.toContain(PRUEFEXPORT.sachentnahmen);
    expect(strFromU8(unzipSync(leer.zip)[PRUEFEXPORT.feldbeschreibung]!)).not.toMatch(/Kassenstuerze\.csv|Sachentnahmen\.csv/);
  });

  it("Feldbeschreibung: beide Listen mit Zweck und jeder Spalte (aus denselben Definitionen wie die Kopfzeilen)", () => {
    const fb = strFromU8(zip[PRUEFEXPORT.feldbeschreibung]!);
    expect(fb).toMatch(/Kassenstuerze\.csv: 2 Kassenstürze \(Zählprotokolle des Bargeldbestands\)/);
    expect(fb).toMatch(/Sachentnahmen\.csv: 2 Sachentnahmen \(unentgeltliche Wertabgaben/);
    expect(fb).toContain("Rechnungen, Belege, Kassenabschlüsse, Kassenstürze und Sachentnahmen");
    for (const [datei, spalten] of [[PRUEFEXPORT.kassenstuerze, KASSENSTURZ_SPALTEN], [PRUEFEXPORT.sachentnahmen, SACHENTNAHME_SPALTEN]] as const) {
      expect(kopf(strFromU8(zip[datei]!))).toBe(spalten.map((x) => x.name).join(";"));
      const abschnitt = fb.split(`\r\n${datei}\r\n`)[1];
      expect(abschnitt, datei).toBeDefined();
      spalten.forEach((sp, i) => expect(abschnitt, `${datei}: ${sp.name}`).toContain(`${String(i + 1).padStart(2, " ")}. ${sp.name}: ${sp.beschreibung}`));
    }
  });

  it("Kassenstürze nach Zeitpunkt, deutsche Zeit, Stückelung lesbar, Endbestand des letzten Abschlusses zur Erläuterung", () => {
    const z = zeilen(kassenstuerzeCsv(STUERZE));
    expect(z.map((x) => x[0])).toEqual(["1", "2"]);
    expect(z[0]!.slice(1, 4)).toEqual(["01.10.2026, 08:45", "Café", "150,00"]);
    expect(z[1]!.slice(1, 6)).toEqual(["20.10.2026, 17:30", "", "234,50", "50 €: 3 · 20 €: 4 · 0,50 €: 9", "210,00"]);
    expect(z[1]![6]).toContain("Amtsträgerin");
    // die Stückelung ergibt den gezählten Bestand
    expect(3 * 5000 + 4 * 2000 + 9 * 50).toBe(23450);
  });

  it("Sachentnahmen nach Datum mit Umsatzsteuer je Satz und Summenzeile", () => {
    const z = zeilen(sachentnahmenCsv(ENTNAHMEN));
    expect(z[0]).toEqual(["30.06.2026", "100,00", "7,00", "0,00", "0,00", "", "01.07.2026, 11:00"]);
    expect(z[1]!.slice(0, 6)).toEqual(["31.12.2026", "123,45", "8,64", "67,89", "12,90", "Pauschbetrag 2026, 1 Person, Café und Konditorei"]);
    expect(z[2]).toEqual(["Summe (2 Sachentnahmen)", "223,45", "15,64", "67,89", "12,90", "", ""]);
  });

  it("Text der Seite nennt beide Listen", () => {
    expect(lies("apps/mobile/src/texte.ts")).toContain("Listen deiner Rechnungen, Belege, Kassenabschlüsse, Kassenstürze und Sachentnahmen (CSV)");
    // Rundgang prüft den Kassensturz im ZIP
    expect(lies("apps/mobile/e2e/rundgang.mjs")).toContain('"Kassenstuerze.csv"');
  });
});

describe("E-202 (Rechtsanwalt): Künstlersozialabgabe v3, Android-Datenschutz, Firebase als Startblocker", () => {
  it("Künstlersozialabgabe v3: nur der Punkt nach „(§ 26 KSVG)“ geändert, freigegeben von recht am 26.10.2026, Übersetzung vorhanden", () => {
    const k = YAML.parse(lies("catalog/pflichten/personal.kuenstlersozialabgabe.yaml")) as { version: number; erklaerung: { de: string }; pruefung: { status: string; geprueft_von: string[]; geprueft_version: number; geprueft_am: string } };
    expect(k.version).toBe(3);
    expect(k.erklaerung.de).toContain("(§ 26 KSVG). Er gilt jeweils für ein Kalenderjahr; den aktuellen Satz veröffentlicht die Künstlersozialkasse.");
    expect(k.erklaerung.de).not.toContain("(§ 26 KSVG); Er gilt");
    expect(k.pruefung).toMatchObject({ status: "freigegeben", geprueft_von: ["recht"], geprueft_version: 3, geprueft_am: "2026-10-26" });
    const en = YAML.parse(lies("catalog/uebersetzungen/en.yaml")) as { eintraege: { de: string; en: string }[] };
    expect(en.eintraege.find((x) => x.de === k.erklaerung.de)?.en).toContain("(§ 26 KSVG). It applies for one calendar year at a time");
  });

  it("Android-Datenschutzhinweis: zweite Bestätigung für dieselbe Prüfsumme, unter der Voraussetzung ohne Google-Dienste", () => {
    expect(DATENSCHUTZ_ANDROID_ZWEITE_BESTAETIGUNG).toMatchObject({ datum: "2026-10-26", rolle: "recht", pruefsumme: DATENSCHUTZ_ANDROID_PRUEFSUMME, aufbewahrung: "beim Gründer" });
    expect(DATENSCHUTZ_ANDROID_ZWEITE_BESTAETIGUNG.voraussetzung).toMatch(/Google-Diensten/);
  });

  it("store-check: Startblocker Firebase im Abschnitt Google Play, bis der Release-Build ohne Verbindung zu Google-Diensten nachgewiesen ist", () => {
    const sc = lies("apps/mobile/werkzeuge/store-check.mjs");
    const play = sc.slice(sc.indexOf("// Google Play (E-190)"));
    expect(play).toContain("pruefeA(k.releaseOhneGoogleDienste === true");
    expect(play).toMatch(/Startblocker Firebase/);
    const konsole = (JSON.parse(lies("apps/mobile/store/de-android.json")) as { konsole: Record<string, unknown> }).konsole;
    expect(konsole.releaseOhneGoogleDienste).toBe(false);
  });

  it("Hygieneplan: die Vorschlagsliste der App nimmt nur passende Vorschläge; das Beispielwerkzeug schaltet die Fassung nicht mehr um", () => {
    const liste = lies("apps/mobile/src/seiten/Liste.tsx");
    expect(liste).toContain("passendeVorschlaege(vorlageFuer(u.vorlage), feld, u.daten)");
    expect(liste).toContain("passendeVorschlaege(vorlageFuer(unterlage.vorlage), feld, unterlage.daten).length");
    const werkzeug = lies("apps/mobile/werkzeuge/dokumente-pruefen.mjs");
    expect(werkzeug).toContain('if (v.id === "hygieneplan" && f.id === "art") continue;');
    expect(werkzeug).toContain('"auswahl-lebensmittel"');
  });
});
