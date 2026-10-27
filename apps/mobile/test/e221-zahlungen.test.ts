/**
 * E-221 Befund 5: Teilzahlungen wurden still gekürzt – bei einer Überzahlung meldete die App den vollen Betrag als
 * vermerkt, gespeichert war weniger (`Math.min(betrag, offen)`); eine Rechnung ließ sich mit 0 € Zahlung und 100 %
 * „Skonto“ ausbuchen. Jetzt: Überzahlung abgelehnt (mit „Nur den offenen Betrag vermerken“), Skonto nur mit Zahlung und
 * höchstens wie vereinbart, „nichts erhalten, alles gemindert“ nie – auch nicht über die Kasse.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, offenerBetrag, zahlungPruefen, zahlungVermerken, type Stand } from "../src/unterlagen/speicher";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Morgenrot", strasse: "Karl-Heine-Str. 1", plz: "04229", ort: "Leipzig", email: "info@cafe.example", telefon: "0341 1", steuernummer: "231/100/40001", iban: "DE89370400440532013000" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: BETRIEB, profil: { "ust.kleinunternehmer": false } };

/** Rechnung über 226,00 € (100 € + 19 %, 100 € + 7 %), auf Wunsch mit 2 % Skonto in 10 Tagen */
function re(skonto = true): Stand {
  const [s1] = anlegen(BASIS, "rechnung", t("2026-03-25"), "r1");
  const s2 = felderSetzen(s1, "r1", { datum: "2026-03-25", kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "100,00", satz: "19" }, { bezeichnung: "Catering", menge: "1", einheit: "", preis: "100,00", satz: "7" }], ...(skonto ? { skonto: true, skonto_prozent: "2", skonto_tage: "10" } : {}) }, t("2026-03-25"));
  return ausgeben(s2, "r1", t("2026-03-25"));
}

describe("E-221 Befund 5: Zahlungseingang nie still kürzen", () => {
  it("Überzahlung: abgelehnt, nichts gespeichert (vorher still auf den offenen Betrag gekürzt)", () => {
    const s = re();
    expect(offenerBetrag(s, s.unterlagen[0]!)).toBe(22600);
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 25000 })).toMatchObject({ fehler: "ueberzahlt", offen: 22600 });
    expect(zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 25000 })).toBe(s);
    // genau der offene Betrag geht – gespeichert wird, was gemeldet wird
    const voll = zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 22600 });
    expect(voll.unterlagen[0]!.zahlungen).toEqual([expect.objectContaining({ betrag_cent: 22600 })]);
    expect(voll.unterlagen[0]!.bezahlt).toBe("2026-04-02");
    // nach einer Teilzahlung zählt der Rest
    const teil = zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 20000 });
    expect(zahlungPruefen(teil, "r1", { datum: "2026-04-10", betrag_cent: 2700 }).fehler).toBe("ueberzahlt");
    expect(zahlungPruefen(teil, "r1", { datum: "2026-04-10", betrag_cent: 2600 }).fehler).toBeNull();
  });

  it("0 € Zahlung und 100 % „Skonto“: abgelehnt (vorher ausgebucht)", () => {
    const s = re();
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 0, minderung_cent: 22600, art: "skonto" }).fehler).toBe("skonto_ohne_zahlung");
    expect(zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 0, minderung_cent: 22600, art: "skonto" })).toBe(s);
    // auch als „Minderung“ nicht: ohne jeden Zahlungseingang ist das Uneinbringlichkeit/Erlass bzw. ein Storno
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 0, minderung_cent: 22600, art: "minderung" }).fehler).toBe("nichts_erhalten");
    expect(zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 0, minderung_cent: 22600, art: "minderung" })).toBe(s);
    // eine Minderung des Rests nach einer echten Teilzahlung bleibt möglich
    const teil = zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 20000 });
    expect(zahlungPruefen(teil, "r1", { datum: "2026-04-20", betrag_cent: 0, minderung_cent: 2600, art: "minderung" }).fehler).toBeNull();
    const rest = zahlungVermerken(teil, "r1", { datum: "2026-04-20", betrag_cent: 0, minderung_cent: 2600, art: "minderung" });
    expect(offenerBetrag(rest, rest.unterlagen[0]!)).toBe(0);
  });

  it("Skonto höchstens wie auf der Rechnung vereinbart (2 % von 226 € = 4,52 €), darüber nur als Minderung", () => {
    const s = re();
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 22148, minderung_cent: 452, art: "skonto" })).toMatchObject({ fehler: null, skontoHoechstens: 452, ohneVereinbarung: false });
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 22000, minderung_cent: 600, art: "skonto" }).fehler).toBe("skonto_zu_hoch");
    expect(zahlungVermerken(s, "r1", { datum: "2026-04-02", betrag_cent: 22000, minderung_cent: 600, art: "skonto" })).toBe(s);
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 22000, minderung_cent: 600, art: "minderung" }).fehler).toBeNull();
    // Skonto auf die Restzahlung nach einer Teilzahlung: das schon vermerkte Skonto zählt mit
    const teil = zahlungVermerken(s, "r1", { datum: "2026-04-01", betrag_cent: 10000, minderung_cent: 300, art: "skonto" });
    expect(zahlungPruefen(teil, "r1", { datum: "2026-04-03", betrag_cent: 12100, minderung_cent: 200, art: "skonto" }).fehler).toBe("skonto_zu_hoch");
    expect(zahlungPruefen(teil, "r1", { datum: "2026-04-03", betrag_cent: 12148, minderung_cent: 152, art: "skonto" }).fehler).toBeNull();
  });

  it("Skonto ohne Vereinbarung: kein Fehler, aber ausdrückliche Nachfrage (keine erfundene Obergrenze)", () => {
    const s = re(false);
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 22148, minderung_cent: 452, art: "skonto" })).toMatchObject({ fehler: null, skontoHoechstens: null, ohneVereinbarung: true });
    expect(zahlungPruefen(s, "r1", { datum: "2026-04-02", betrag_cent: 22148, minderung_cent: 452, art: "minderung" }).ohneVereinbarung).toBe(false);
  });

  it("Oberfläche: kein Math.min mehr, Meldung = gespeicherter Betrag, Fehler sichtbar, Nachfrage ohne Vereinbarung; Kasse prüft bar kassierte Rechnungen", () => {
    const a = lies("seiten/Abschluss.tsx");
    expect(a).not.toContain("Math.min(betrag, offen)");
    expect(a).toContain("const pruefung = betrag === null ? null : zahlungPruefen(z.stand, id, zahlung);");
    expect(a).toContain("z.zahlungVermerken(id, zahlung);");
    expect(a).toContain("deaktiviert={betrag === null || Boolean(pruefung?.fehler)}");
    expect(a).toContain("pruefung.ohneVereinbarung && !(await bestaetigen(");
    expect(a).toContain("TEXT.e221_nur_offen(");
    const k = lies("seiten/Kasse.tsx");
    expect(k).toContain('zahlungPruefen(z.stand, r.id, { datum: tag, betrag_cent: r.betrag_cent }).fehler === "ueberzahlt"');
  });
});
