import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MARKE, markeEinsetzenTief } from "@amtlos/marke";

const hier = path.dirname(fileURLToPath(import.meta.url));
const roh = readFileSync(path.resolve(hier, "../store/de-android.json"), "utf8");
// Marke wie beim Eintragen in der Play Console eingesetzt ({{MARKE}} → packages/marke/marke.json)
type Bild = { bildschirm: string; titel: string; text: string };
const s = markeEinsetzenTief(JSON.parse(roh)) as Record<string, unknown> & { bilder: Bild[]; datensicherheit: { erhoben: { datentyp: string; zwecke: string[]; geteilt: boolean }[]; verschluesselung_bei_uebertragung: boolean }; zielgruppe: { fuer_kinder: boolean }; grafik: { titel: string; text: string } };
const ios = markeEinsetzenTief(JSON.parse(readFileSync(path.resolve(hier, "../store/de.json"), "utf8"))) as { bilder: Bild[] };

describe("Google-Play-Eintrag (E-190) hält die Grenzen der Play Console ein", () => {
  it("Titel ≤ 30, Kurzbeschreibung ≤ 80, Beschreibung ≤ 4000, Neuerungen ≤ 500 Zeichen", () => {
    expect((s.titel as string).length).toBeLessThanOrEqual(30);
    expect((s.kurzbeschreibung as string).length).toBeLessThanOrEqual(80);
    expect((s.beschreibung as string).length).toBeLessThanOrEqual(4000);
    expect((s.neu as string).length).toBeGreaterThan(0);
    expect((s.neu as string).length).toBeLessThanOrEqual(500);
  });
  it("Marke nur als Platzhalter, keine Apple-Wörter, keine Emojis oder Rang-Versprechen im Titel", () => {
    expect(roh).not.toContain(MARKE.name);
    expect(roh).not.toMatch(/Amtlos/);
    const sichtbar = [s.titel, s.kurzbeschreibung, s.beschreibung, s.neu, ...s.bilder.map((b) => `${b.titel} ${b.text}`), s.grafik.titel, s.grafik.text].join("\n");
    expect(sichtbar).not.toMatch(/iPhone|iCloud|Face ID|Touch ID|Apple-Account|AirDrop|stdeula/);
    expect(s.titel as string).not.toMatch(/[\u{1F300}-\u{1FAFF}]|beste|Nr\. ?1|#1|kostenlos|gratis/iu);
  });
  it("E-189/E-188: Pflichten-Kompass vorn, Check kostenlos ausprobieren, alles Weitere mit Pro und Testphase", () => {
    const b = s.beschreibung as string;
    expect(b.indexOf("WELCHE PFLICHTEN HAT MEIN BETRIEB?")).toBeLessThan(b.indexOf("DAZU: RECHNUNGEN, BELEGE, KASSE"));
    expect(b).toMatch(/Pflichten-Check kostenlos/);
    expect(b).toMatch(/ersten 3/);
    expect(b).toMatch(/kostenlose[rn]? Testphase/);
    for (const r of [/Rechnungen[^\n]*\(Pro\)/, /E-Rechnung \(XRechnung\)[^\n]*\(Pro\)/, /Belege[^\n]*\(Pro\)/, /Kasse und Kassenbuch[^\n]*\(Pro\)/, /Alle Pflichten[^\n]*\(Pro\)/, /Vorlagen[^\n]*\(Pro\)/, /Erinnerung[^\n]*\(Pro\)/, /Kontrollmappe[^\n]*\(Pro\)/]) expect(b).toMatch(r);
    expect(b).not.toMatch(/ohne Limit|Rechnungen kostenlos|3 Rechnungen/);
    expect(b).toMatch(/ersetzt keine Rechts- oder Steuerberatung/);
  });
  it("Abo-Angaben für Google Play: Abrechnung über das Google-Konto, Kündigen in Google Play, Käufe je Plattform", () => {
    const b = s.beschreibung as string;
    expect(b).toMatch(/über dein Google-Konto bei Google Play abgerechnet/);
    expect(b).toMatch(/verlängert sich automatisch/);
    expect(b).toMatch(/Zahlungen und Abos/);
    expect(b).toMatch(/Abo aus dem App Store gilt hier nicht/);
  });
  it("Bilder: dieselben Bildschirme wie im App Store (3 bis 8 für Google Play), Grafik mit Titel", () => {
    expect(s.bilder.length).toBeGreaterThanOrEqual(2);
    expect(s.bilder.length).toBeLessThanOrEqual(8);
    expect(s.bilder.map((b) => b.bildschirm)).toEqual(ios.bilder.map((b) => b.bildschirm));
    expect(s.grafik.titel.length).toBeGreaterThan(0);
  });
  it("Datensicherheit: nur Kaufverlauf und App-Kennung (RevenueCat), verschlüsselt übertragen, nicht für Kinder", () => {
    expect(s.datensicherheit.verschluesselung_bei_uebertragung).toBe(true);
    expect(s.datensicherheit.erhoben.map((e) => e.datentyp)).toEqual(["Kaufverlauf", "Geräte- oder andere IDs"]);
    expect(s.datensicherheit.erhoben.every((e) => !e.geteilt)).toBe(true);
    expect(s.zielgruppe.fuer_kinder).toBe(false);
    expect(s.werbung).toBe(false);
  });
});
