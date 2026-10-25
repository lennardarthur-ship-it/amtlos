import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { markeEinsetzenTief } from "@amtlos/marke";

const hier = path.dirname(fileURLToPath(import.meta.url));
// Marke wie beim Einreichen eingesetzt ({{MARKE}} → packages/marke/marke.json)
const s = markeEinsetzenTief(JSON.parse(readFileSync(path.resolve(hier, "../store/de.json"), "utf8"))) as Record<string, unknown> & { bilder: { bildschirm: string; titel: string }[] };

describe("Store-Texte (E-132) halten die Grenzen des App Store ein", () => {
  it("Längen von Name, Untertitel, Werbetext, Schlüsselwörtern und Beschreibung", () => {
    expect((s.name as string).length).toBeLessThanOrEqual(30);
    expect((s.untertitel as string).length).toBeLessThanOrEqual(30);
    expect((s.werbetext as string).length).toBeLessThanOrEqual(170);
    expect(Buffer.byteLength(s.schluesselwoerter as string)).toBeLessThanOrEqual(100);
    expect((s.beschreibung as string).length).toBeLessThanOrEqual(4000);
    expect((s.neu as string).length).toBeLessThanOrEqual(4000);
  });
  it("Abo-Pflichtangaben stehen in der Beschreibung, und es gibt 3 bis 10 Bilder", () => {
    expect(s.beschreibung).toMatch(/verlängert sich automatisch/);
    expect(s.beschreibung).toMatch(/ersetzt keine Rechts- oder Steuerberatung/);
    expect(s.bilder.length).toBeGreaterThanOrEqual(3);
    expect(s.bilder.length).toBeLessThanOrEqual(10);
  });
  it("Link zu den Nutzungsbedingungen (Apple, Abos) und Kennzeichnung der Pro-Funktionen (Richtlinie 2.3.2)", () => {
    expect(s.beschreibung).toMatch(/Nutzungsbedingungen: https:\/\/www\.apple\.com\/legal\/internet-services\/itunes\/dev\/stdeula\//);
    expect(s.beschreibung).toMatch(/E-Rechnung \(XRechnung\)[^\n]*\(Pro\)/);
    expect(s.beschreibung).toMatch(/Steuerberatung[^\n]*\(Pro\)/);
    // E-188 (Modell Check-Teaser): Pflichten-Check kostenlos ausprobieren, alles Weitere mit Pro und Testphase; kein
    // „kostenlos ohne Limit“; Prüfhinweise sagen, dass die Prüfung ein Probeabo braucht und was ohne Abo sichtbar ist
    expect(s.beschreibung).toMatch(/Pflichten-Check kostenlos/);
    expect(s.beschreibung).toMatch(/ersten 3/);
    expect(s.beschreibung).toMatch(/kostenlose[rn]? Testphase/);
    for (const r of [/Rechnungen[^\n]*\(Pro\)/, /Belege[^\n]*\(Pro\)/, /Kasse und Kassenbuch[^\n]*\(Pro\)/, /Alle Pflichten[^\n]*\(Pro\)/, /Vorlagen[^\n]*\(Pro\)/, /Erinnerung[^\n]*\(Pro\)/, /Kontrollmappe[^\n]*\(Pro\)/]) expect(s.beschreibung).toMatch(r);
    expect(JSON.stringify([s.untertitel, s.werbetext, s.beschreibung, s.neu, s.bilder])).not.toMatch(/ohne Limit|Rechnungen kostenlos|3 Rechnungen|1 Vorlage als PDF/);
    expect(s.pruefhinweise).toMatch(/most features require the subscription/);
    expect(s.pruefhinweise).toMatch(/free trial \/ a Sandbox purchase/);
    expect(s.pruefhinweise).toMatch(/Visible without a subscription[\s\S]*first 3 obligations/);
    expect(s.pruefhinweise).not.toMatch(/1 template per calendar month|3 invoices per calendar month/);
    expect(s.pruefhinweise).toMatch(/How to see the paywall/);
    expect(s.pruefhinweise).toMatch(/first completed obligations check[^\n]*Später/);
    for (const anlass of [/"Rechnung" \(new invoice\)/, /"Beleg" \(new receipt\)/, /any template/, /Tagesabschluss erfassen/, /weitere Pflichten/, /An Fristen erinnern/, /Kontrollmappe/, /Mit Pro ansehen/, /tax-advisor package/, /E-Rechnung/]) expect(s.pruefhinweise).toMatch(anlass);
    expect(s.pruefhinweise).toMatch(/cancelling \(Storno\) an issued invoice/);
    expect(s.pruefhinweise).toMatch(/sharing\/printing their cash book/);
    // XRechnung an Behörden braucht die Leitweg-ID – die App fragt sie nicht ab, also kein Versprechen
    expect(JSON.stringify(s)).not.toMatch(/Behörde/);
    expect((s.neu as string).length).toBeGreaterThan(0);
  });
  it("Lupen-Ausschnitte der Bilder liegen im Bildschirm", () => {
    for (const b of s.bilder as { lupe?: { x: number; y: number; b: number; h: number } }[]) {
      if (!b.lupe) continue;
      const { x, y, b: br, h } = b.lupe;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + br).toBeLessThanOrEqual(1);
      expect(y + h).toBeLessThanOrEqual(1);
    }
  });
});
