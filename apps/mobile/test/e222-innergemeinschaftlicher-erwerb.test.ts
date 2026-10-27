/**
 * E-222 (externer Prüfer, Befund 10): Die Voranmeldung übernimmt innergemeinschaftliche Erwerbe aus den Belegen (Kz 89/93
 * mit Steuer, Vorsteuer Kz 61); Kleinunternehmer nicht (Erwerbsschwelle, § 1a Abs. 3 UStG – PRUEFLISTE T-309); der
 * DATEV-Stapel bucht sie auf Erwerbskonten, LIESMICH nennt fehlende Konten. Der geänderte Hinweis der Vorlage lässt den
 * Vermerk der Voranmeldung entfallen (T-308).
 */
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { UST_OHNE_IGE, dokumentHtml, vorlageFuer, vorlageGeprueft, type Beleg } from "@amtlos/fachlogik";
import { LEERER_STAND, type Stand } from "../src/unterlagen/speicher";
import { steuerpaket } from "../src/unterlagen/steuerpaket";
import { IGE_ANNAHME, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", iban: "DE89370400440532013000" };
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const stand = (o: Partial<Stand> = {}): Stand => ({ ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, ...o });
const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-03-10", lieferant: "Fournitures SARL", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100000 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, quelle: "hand", erstellt: "2026-03-10T09:00:00Z", geaendert: "2026-03-10T09:00:00Z", ...o }) as Beleg;
const belege = [
  beleg({ id: "ige", steuerschuld: "ige", lieferant_ust_idnr: "FR12345678901", steuer: [{ satz: 19, brutto_cent: 100000 }, { satz: 7, brutto_cent: 20000 }] }),
  beleg({ id: "inland", lieferant: "Großhandel GmbH", nummer: "G-1", steuer: [{ satz: 19, brutto_cent: 11900 }] }),
];

describe("E-222: Voranmeldung aus Belegen mit innergemeinschaftlichem Erwerb", () => {
  it("Kz 89/93 Bemessungsgrundlage, Kz 61 Vorsteuer; Kz 66 nur aus dem Inlandsbeleg; Annahme zum Zeitpunkt", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", belege, false)!;
    expect(r.werte).toMatchObject({ ige_19: "1.000,00", ige_7: "200,00", vorsteuer_ige: "204,00", vorsteuer: "19,00" });
    expect(r.igeBelege).toBe(1);
    expect(r.steuerschuldBelege).toBe(0);
    expect(r.werte.annahmen).toContain(IGE_ANNAHME(1));
    expect(r.werte.annahmen).toContain("§ 13 Abs. 1 Nr. 6 UStG");
    // Ist-Versteuerung ändert nichts (der Erwerb hängt nicht an Zahlungen)
    expect(umsaetzeFuer([], "2026-03", BETRIEB, "ist", belege, false)!.werte).toMatchObject({ ige_19: "1.000,00", vorsteuer_ige: "204,00" });
  });

  it("PDF der Voranmeldung: Kz 89/93 mit Steuer, Kz 61, Zahllast; ohne den Hinweis „nicht enthalten“", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", belege, false)!;
    const h = dokumentHtml(vorlageFuer("ust_voranmeldung")!, { versteuerung: "soll", ...r.werte }, BETRIEB);
    expect(h).toMatch(/<span>89<\/span><\/td><th>Steuerpflichtige innergemeinschaftliche Erwerbe zum Steuersatz 19(&nbsp;| )%/);
    expect(h).toMatch(/<span>93<\/span><\/td><th>Steuerpflichtige innergemeinschaftliche Erwerbe zum Steuersatz 7(&nbsp;| )%/);
    expect(h).toMatch(/<span>61<\/span><\/td><th>Vorsteuerbeträge aus dem innergemeinschaftlichen Erwerb/);
    expect(h).toMatch(/190,00\s€/); // 19 % aus 1.000 €
    expect(h).toMatch(/14,00\s€/); // 7 % aus 200 €
    expect(h).not.toContain(UST_OHNE_IGE);
    // Erwerbsteuer 204,00 € und Vorsteuer 204,00 + 19,00 €: Erstattung 19,00 €
    expect(h).toContain("Verbleibender Überschuss (Erstattung)");
  });

  it("ohne Vorsteuerabzug: Steuer ja, Kz 61 leer", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [beleg({ steuerschuld: "ige", vorsteuer: false })], false)!;
    expect(r.werte).toMatchObject({ ige_19: "1.000,00", ige_7: "0,00", vorsteuer_ige: "" });
  });

  it("ohne Erwerbsbelege bleiben von Hand eingetragene Erwerbe stehen (keine Felder gesetzt)", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [belege[1]!], false)!;
    expect(r.werte).not.toHaveProperty("ige_19");
    expect(r.werte).not.toHaveProperty("vorsteuer_ige");
    expect(r.igeBelege).toBe(0);
  });

  it("Kleinunternehmer: nicht übernommen, Hinweis auf die Erwerbsschwelle (§ 1a Abs. 3 UStG)", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", belege, true)!;
    expect(r.kleinunternehmer).toBe(true);
    expect(r.werte).not.toHaveProperty("ige_19");
    expect(r.igeKu).toBe(1);
  });

  it("Hinweis der Vorlage ohne Erwerbe: übernimmt aus Belegen mit der Art „innergemeinschaftlicher Erwerb“", () => {
    expect(UST_OHNE_IGE).not.toContain("übernimmt sie nicht aus den Belegen");
    expect(UST_OHNE_IGE).toContain("Waren aus dem EU-Ausland (innergemeinschaftlicher Erwerb)");
  });

  it("Vermerk der Voranmeldung entfiel bis zur Bestätigung des geänderten Textes (T-308) – E-227: bestätigt am 27.10.2026", () => {
    expect(vorlageGeprueft(vorlageFuer("ust_voranmeldung")!)?.stand).toBe("2026-10-27");
  });
});

describe("E-222: Steuerberater-Paket", () => {
  const datei = (p: ReturnType<typeof steuerpaket>, name: string) => strFromU8(unzipSync(p.zip)[name]!);
  const zeitraum = { von: "2026-03-01", bis: "2026-03-31", name: "2026-03" };

  it("Stapel: 19 % auf 3425 ohne BU; 7 % (E-227: Standard 3420); Belegliste und Fragen nennen den Erwerb", () => {
    const p = steuerpaket(stand({ belege }), zeitraum, SB, {}, "2026-04-10T08:00:00");
    const stapel = datei(p, "Buchungsliste_2026-03.csv");
    expect(stapel).toMatch(/1000,00;H;1610;3425;;/);
    expect(stapel).toMatch(/200,00;H;1610;3420;;/);
    const lies = datei(p, "LIESMICH.txt");
    expect(lies).toContain("1 Beleg mit innergemeinschaftlichem Erwerb (Kz 89/93, Vorsteuer Kz 61)");
    expect(lies).not.toContain("FEHLEN sie im Stapel");
    expect(datei(p, "Belege_2026-03.csv")).toContain("innergemeinschaftlicher Erwerb, Steuer 204,00, USt-IdNr. Lieferant FR12345678901");
    expect(datei(p, "Fragen_2026-03.txt")).toContain("Belege mit innergemeinschaftlichem Erwerb (Waren aus dem EU-Ausland) – Kz 89 bzw. 93, Vorsteuer Kz 61");
  });

  it("mit Kontenvorgabe für 7 % gebucht, LIESMICH ohne „FEHLEN“", () => {
    const sb = { ...SB, kontenvorgaben: { konten: { igErwerb7: "3999" } } };
    const p = steuerpaket(stand({ belege, steuerberatung: sb }), zeitraum, sb, {}, "2026-04-10T08:00:00");
    expect(datei(p, "Buchungsliste_2026-03.csv")).toMatch(/;200,00;H;1610;3999;;/);
    expect(datei(p, "LIESMICH.txt")).not.toContain("FEHLEN sie im Stapel");
  });
});
