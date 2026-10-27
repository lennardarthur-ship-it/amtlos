/**
 * E-223 (externer Prüfer, Befund d): zwei fehlende Pflichten als Entwurf – Preisermäßigung (§ 11 PAngV) und Werbe-E-Mails
 * (§ 7 Abs. 2 Nr. 2, Abs. 3 UWG). Die App zeigt sie mit „fachlich noch nicht geprüft“; vor dem Start prüft sie der
 * Rechtsanwalt (store-check: Startblocker, PRUEFLISTE T-313).
 */
import { describe, expect, it } from "vitest";
import { KATALOG, auswertung, type Profil } from "../src/pflichten/check";
import { T } from "../src/texte";

const SHOP: Profil = { "taetigkeit.branchen": ["onlinehandel"], rechtsform: "einzelunternehmen", gruendungsdatum: "2022-03-01", bundesland: "NW", "taetigkeit.einordnung": "gewerbe", "kunden.segmente": ["b2c"], "vertrieb.kanaele": ["onlineshop"], "produkte.arten": ["physisch"], "datenverarbeitung.arten": ["kundendaten", "newsletter"] };
const NEU = ["online.preisermaessigung", "online.werbe_email_einwilligung"];

describe("E-223: neue Einträge im Entwurf", () => {
  // E-226: vom Rechtsanwalt am 27.10.2026 in seiner Fassung (v2) freigegeben – nicht mehr Entwurf
  it("im Katalog (seit E-226 freigegeben), mit Rechtsgrundlage und Quelle bei gesetze-im-internet.de", () => {
    for (const id of NEU) {
      const p = KATALOG.pflichten.find((x) => x.id === id) as unknown as { pruefung: { status: string }; rechtsgrundlage: string[]; quellen: { url: string }[] };
      expect(p.pruefung.status, id).toBe("freigegeben");
      expect(p.rechtsgrundlage.length).toBeGreaterThan(0);
      expect(p.quellen.some((q) => q.url.startsWith("https://www.gesetze-im-internet.de/"))).toBe(true);
    }
  });
  it("Onlineshop an Verbraucher mit Newsletter: beide gelten, seit E-226 mit Prüfvermerk", () => {
    const a = auswertung(SHOP, "2026-10-27");
    for (const id of NEU) {
      const p = a.gilt.find((x) => x.id === id);
      expect(p, id).toBeDefined();
      expect(p!.geprueft).toBe(true);
      expect(p!.pruefVermerk).toMatch(/Rechtsanwalt/);
    }
    expect(T.pflichten_quelle).toMatch(/fachlich noch nicht geprüft/);
  });
  it("ohne Angabe zu Waren bzw. Newsletter „hängt ab“ – nur Dienstleistung an Unternehmen ohne Newsletter: nicht betroffen", () => {
    const { "produkte.arten": _a, "datenverarbeitung.arten": _d, ...ohne } = SHOP;
    const offen = auswertung(ohne, "2026-10-27");
    for (const id of NEU) expect(offen.unbekannt.map((p) => p.id), id).toContain(id);
    const b2b = auswertung({ ...SHOP, "kunden.segmente": ["b2b"], "produkte.arten": ["dienstleistung"], "datenverarbeitung.arten": ["kundendaten"] }, "2026-10-27");
    const ids = [...b2b.gilt, ...b2b.unbekannt].map((p) => p.id);
    for (const id of NEU) expect(ids, id).not.toContain(id);
  });
});
