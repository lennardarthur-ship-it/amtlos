/**
 * E-231 (Antwort des Steuerberaters vom 27.10.2026 zu T-323, T-324, T-325, T-335):
 * - Erwerbsschwelle: Frage und Überschreiten laut Vorjahresbelegen bestätigt; laufendes Jahr laut Belegen über der Schwelle
 *   nach „Nein“ → noch einmal fragen; neue Fahrzeuge und verbrauchsteuerpflichtige Waren zählen nicht (Satz im Hinweis);
 *   Erwerbe ohne Erwerbsbesteuerung = gewöhnlicher Einkauf im DATEV-Stapel (brutto, ohne Steuerschlüssel, Aufwandskonto).
 * - Voranmeldung des Kleinunternehmers nach § 18 Abs. 4a UStG als Katalogeintrag im Entwurf.
 * - „1 Beleg … fehlt“ auf der Voranmeldung; Kleinunternehmer-Zeitraum uneinbringlich: sein Satz wörtlich.
 */
import fs, { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Beleg } from "@amtlos/fachlogik";
import { KATALOG, auswertung, checkFragen, type Profil } from "../src/pflichten/check";
import { T as TEXT } from "../src/texte";
import { VERZICHT_FELD, erneutFeld, erwerbsschwelleLage, igeUnterSchwelle, ueberFeld } from "../src/unterlagen/erwerbsschwelle";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, felderSetzen, uneinbringlichSetzen, type Stand } from "../src/unterlagen/speicher";
import { steuerpaket } from "../src/unterlagen/steuerpaket";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const hier = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(hier, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");
const t = (d: string) => new Date(`${d}T09:00:00Z`);
const SCHWELLE = 12500;
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", rechtsform: "Einzelunternehmen", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", iban: "DE89370400440532013000", versteuerung: "soll" as const };
const stand = (o: Partial<Stand> = {}): Stand => ({ ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, ...o });
const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-05-15", lieferant: "Fournitures SARL", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 119000 }], vorsteuer: false, zahlung: "bank", bezahlt: null, notiz: null, quelle: "hand", erstellt: "2026-05-15T09:00:00Z", geaendert: "2026-05-15T09:00:00Z", steuerschuld: "ige", lieferant_ust_idnr: "FR12345678901", ...o }) as Beleg;
const datei = (p: ReturnType<typeof steuerpaket>, name: string) => strFromU8(unzipSync(p.zip)[name]!);
const MAI = { von: "2026-05-01", bis: "2026-05-31", name: "2026-05" };

describe("E-231: Erwerbsschwelle im laufenden Jahr überschritten (T-323)", () => {
  const gross = [beleg({ id: "g", datum: "2026-04-01", steuer: [{ satz: 19, brutto_cent: 1300000 }] })];
  const nein = { [VERZICHT_FELD]: false, [ueberFeld("2026")]: false };

  it("nach „Nein“ und Erwerben des Jahres über 12.500 € laut Belegen: offen, noch einmal fragen", () => {
    expect(erwerbsschwelleLage(nein, gross, "2026", SCHWELLE)).toMatchObject({ status: "offen", grund: "erneut", jahr_ueber: true, jahr_cent: 1300000 });
    expect(erwerbsschwelleLage({ ...nein, [erneutFeld("2026")]: true }, gross, "2026", SCHWELLE)).toMatchObject({ status: "ja", grund: "angabe" });
    // erneut verneint (z. B. weil neue Fahrzeuge dabei sind, die nicht zählen) → keine Erwerbsbesteuerung
    expect(erwerbsschwelleLage({ ...nein, [erneutFeld("2026")]: false }, gross, "2026", SCHWELLE)).toMatchObject({ status: "nein", grund: "verneint" });
    // genau 12.500 €: nicht überstiegen, das „Nein“ gilt
    const genau = [beleg({ id: "g", datum: "2026-04-01", steuer: [{ satz: 19, brutto_cent: 1250000 }] })];
    expect(erwerbsschwelleLage(nein, genau, "2026", SCHWELLE)).toMatchObject({ status: "nein", jahr_ueber: false });
    // Verzicht und Vorjahr entscheiden weiter vorher; die erneute Antwort gilt nur für ihr Jahr
    expect(erwerbsschwelleLage({ ...nein, [VERZICHT_FELD]: true }, gross, "2026", SCHWELLE)).toMatchObject({ status: "ja", grund: "verzicht" });
    expect(erwerbsschwelleLage({ ...nein, [erneutFeld("2025")]: false }, gross, "2026", SCHWELLE)).toMatchObject({ grund: "erneut" });
  });

  it("Texte: Lage, erneute Frage, Satz zu neuen Fahrzeugen und verbrauchsteuerpflichtigen Waren", () => {
    expect(TEXT.e231_status_erneut("2026", "12.500 €")).toBe("Deine Erwerbe aus dem EU-Ausland liegen 2026 laut deinen Belegen schon über 12.500 € – bitte die Frage noch einmal beantworten.");
    expect(TEXT.e231_jahr_ueber("2026", "13.000,00 €", "12.500 €")).toContain("Bitte beantworte die Frage noch einmal.");
    expect(TEXT.e227_schwelle_hinweis("12.500 €")).toContain("Bei der Erwerbsschwelle zählen sie nicht mit (§ 1a Abs. 5 Satz 1 UStG): Die App erkennt sie an den Belegen nicht und zählt alle Erwerbe mit – zieh sie bei deiner Antwort ab.");
    const ui = lies("seiten/Erwerbsschwelle.tsx");
    expect(ui).toContain("TEXT.e231_jahr_ueber(jahr, euro(l.jahr_cent), schwelle)");
    expect(ui).toContain("[erneutFeld(jahr)]: w === \"ja\"");
    expect(ui).toContain("TEXT.e231_status_erneut(l.jahr, s)");
  });

  it("igeUnterSchwelle: nur Lage „nein“ (nicht „offen“, nicht „ja“)", () => {
    const b = beleg({});
    expect(igeUnterSchwelle([b], [b], nein, SCHWELLE).map((x) => x.id)).toEqual(["b1"]);
    expect(igeUnterSchwelle([b], [b], {}, SCHWELLE)).toEqual([]);
    expect(igeUnterSchwelle([b], [b], { [VERZICHT_FELD]: true }, SCHWELLE)).toEqual([]);
  });
});

describe("E-231: DATEV-Stapel – Erwerb ohne Erwerbsbesteuerung als gewöhnlicher Einkauf (T-323)", () => {
  const ku = { "ust.kleinunternehmer": true };

  it("Kleinunternehmer unter der Schwelle: brutto ohne Steuerschlüssel auf 3200, LIESMICH und Belegliste sagen es", () => {
    const p = steuerpaket(stand({ belege: [beleg({ erwerb_datum: "2026-02-20" })], profil: { ...ku, [VERZICHT_FELD]: false, [ueberFeld("2026")]: false } }), MAI, SB, {}, "2026-06-10T08:00:00");
    const liste = datei(p, "Buchungsliste_2026-05.csv");
    expect(liste).toMatch(/1190,00;H;1610;3200;;/);
    expect(liste).not.toMatch(/;343[05];/);
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("Unter der Erwerbsschwelle ohne Verzicht (§ 1a Abs. 3 UStG) – keine Erwerbsbesteuerung: Dieser Erwerb ist ein gewöhnlicher Einkauf, die ausländische Umsatzsteuer ist nicht abziehbar; im Stapel mit dem Bruttobetrag ohne Steuerschlüssel auf dem Aufwandskonto des Belegs: Fournitures SARL am 15.05.2026 über 1.190,00 € auf 3200.");
    expect(l).not.toContain("FEHLEN sie im Stapel");
    expect(l).not.toContain("Feld 116");
    expect(l).not.toContain("§ 18 Abs. 4a UStG");
    const belege = datei(p, "Belege_2026-05.csv");
    expect(belege).toContain("ja – gewöhnlicher Einkauf (unter der Erwerbsschwelle)");
    expect(belege).toContain("keine Erwerbsbesteuerung (unter der Erwerbsschwelle) – gewöhnlicher Einkauf");
  });

  it("ohne Antworten (offen) fehlt der Erwerb weiter im Stapel; nach Überschreiten im Jahr ebenso, bis erneut geantwortet", () => {
    const ohne = steuerpaket(stand({ belege: [beleg({})], profil: ku }), MAI, SB, {}, "2026-06-10T08:00:00");
    expect(datei(ohne, "Buchungsliste_2026-05.csv")).not.toMatch(/;3200;/);
    expect(datei(ohne, "LIESMICH.txt")).toContain("deshalb FEHLEN sie im Stapel");
    expect(datei(ohne, "Belege_2026-05.csv")).toContain("nein – Erwerbsschwelle");
    const viel = [beleg({ steuer: [{ satz: 19, brutto_cent: 1300000 }] })];
    const erneut = steuerpaket(stand({ belege: viel, profil: { ...ku, [VERZICHT_FELD]: false, [ueberFeld("2026")]: false } }), MAI, SB, {}, "2026-06-10T08:00:00");
    expect(datei(erneut, "Buchungsliste_2026-05.csv")).not.toMatch(/;3200;/);
    expect(datei(erneut, "LIESMICH.txt")).toContain("deshalb FEHLEN sie im Stapel");
  });

  it("nur steuerfreie Umsätze unter der Schwelle: ebenfalls 3200 ohne Schlüssel (nicht 3400)", () => {
    const [s1] = anlegen(stand({ profil: { "ust.kleinunternehmer": false, [VERZICHT_FELD]: false, [ueberFeld("2026")]: false } }), "rechnung", t("2026-05-05"), "r1");
    const s2 = felderSetzen(s1, "r1", { datum: "2026-05-05", kunde_name: "Patientin", kunde_anschrift: "Weg 2\n10115 Berlin", kunde_email: "p@x.example", befreiung: "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG", positionen: [{ bezeichnung: "Behandlung", menge: "1", einheit: "", preis: "100,00", satz: "0" }] }, t("2026-05-05"));
    const s3 = belegSetzen(ausgeben(s2, "r1", t("2026-05-05")), beleg({}), t("2026-05-15"));
    const liste = datei(steuerpaket(s3, MAI, SB, {}, "2026-06-10T08:00:00"), "Buchungsliste_2026-05.csv");
    expect(liste).toMatch(/1190,00;H;1610;3200;;/);
    expect(liste).not.toMatch(/;3400;/);
  });
});

describe("E-231: Voranmeldung des Kleinunternehmers nach § 18 Abs. 4a UStG als Entwurf (T-324)", () => {
  const ID = "steuern.ust_voranmeldung_kleinunternehmer";
  const KU: Profil = { rechtsform: "einzelunternehmen", gruendungsdatum: "2022-01-01", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "ust.kleinunternehmer": true, "umsatz.vorjahr": 20000, "einkauf.eu_unternehmen": true };

  // E-233: bis zur Freigabe zurückgehalten (nicht_vor_freigabe) – der Eintrag steht im Katalog, nicht im Bündel der App;
  // den Auslöser prüfen die Engine-Fixtures (catalog/fixtures/e231-ku-*.yaml) am ganzen Katalog
  const C37 = YAML.parse(fs.readFileSync(path.join(WURZEL, `catalog/pflichten/${ID}.yaml`), "utf8")) as { pruefung: { status: string }; nicht_vor_freigabe: boolean; rechtsgrundlage: string[]; quellen: { url: string }[]; frist: { typ: string; rhythmus: string; faellig: { monate_nach: number; tag: number } }; erklaerung: { de: string } };

  // E-234 (Steuerberater 27.10.2026, S5): v2 – Voranmeldungszeitraum statt „Monate“, Status in_pruefung (Folgen vom Rechtsanwalt freigegeben)
  it("im Katalog als Entwurf mit § 18 Abs. 4a UStG, Quelle gesetze-im-internet.de, fällig am 10. Tag nach Ablauf des Voranmeldungszeitraums", () => {
    const p = C37;
    expect(["entwurf", "in_pruefung"]).toContain(p.pruefung.status);
    expect(p.nicht_vor_freigabe).toBe(true);
    expect(p.rechtsgrundlage).toContain("§ 18 Abs. 4a UStG");
    expect(p.quellen.some((q) => q.url === "https://www.gesetze-im-internet.de/ustg_1980/__18.html")).toBe(true);
    expect(p.frist).toMatchObject({ typ: "wiederkehrend", rhythmus: { sonst: "quartalsweise" }, faellig: { monate_nach: 1, tag: 10 } });
    for (const s of ["§ 18 Abs. 4a Satz 1 UStG", "§ 18 Abs. 4a Satz 2 UStG", "bis zum 10. Tag nach Ablauf des Zeitraums", "Umsatzsteuer-Jahreserklärung", "in Zeiträumen ohne solche Steuer gibst du keine Voranmeldung ab"]) expect(p.erklaerung.de).toContain(s);
  });

  it("E-233: die App zeigt ihn bis zur Freigabe nicht; der Kern-Check fragt Kleinunternehmer weiter nach dem Einkauf im EU-Ausland", () => {
    expect(KATALOG.pflichten.map((x) => x.id)).not.toContain(ID);
    const a = auswertung(KU, "2026-10-27");
    expect([...a.gilt, ...a.unbekannt].map((x) => x.id)).not.toContain(ID);
    const { "einkauf.eu_unternehmen": _e, ...unbekannt } = KU;
    // E-234: zuerst „im Ausland“ (EU und Drittländer), die EU-Frage bei „ja“
    expect(checkFragen({ ...unbekannt, "einkauf.ausland_unternehmen": true }).map((f) => f.feld)).toContain("einkauf.eu_unternehmen");
    expect(checkFragen({ ...unbekannt, "ust.kleinunternehmer": false }).map((f) => f.feld)).not.toContain("einkauf.eu_unternehmen");
    for (const f of ["e231-ku-voranmeldung-18-4a.yaml", "e231-ku-ohne-eu-einkauf.yaml"]) expect(fs.existsSync(path.join(WURZEL, "catalog/fixtures", f)), f).toBe(true);
  });
});

describe("E-231: Voranmeldung – „1 Beleg … fehlt“ (T-325) und Kleinunternehmer-Zeitraum uneinbringlich (T-335)", () => {
  it("ein Beleg ohne Euro-Betrag: Einzahl auf dem PDF", () => {
    const s = stand({ profil: { "ust.kleinunternehmer": false }, belege: [beleg({ vorsteuer: true, steuer: [{ satz: 19, brutto_cent: 0 }], fremd: { waehrung: "SEK", steuer: [{ satz: 19, brutto_cent: 1000000 }] } } as Partial<Beleg>)] });
    const r = umsaetzeFuer(s.unterlagen, "2026-05", s.betrieb, "soll", s.belege, false, undefined, { profil: s.profil, schwelleEuro: SCHWELLE })!;
    expect(r.werte.unvollstaendig).toBe("Nicht vollständig: 1 Beleg ohne Euro-Betrag (innergemeinschaftlicher Erwerb) fehlt");
  });

  it("sein Satz wörtlich in App, Voranmeldung und LIESMICH; keine Berechnung", () => {
    const satz = "Die Umsatzsteuer kann berichtigt werden – bitte mit der Steuerberatung klären.";
    expect(TEXT.e229_uneinbringlich_ku(1)).toContain(satz);
    expect(TEXT.e229_uneinbringlich_ku_pdf("2025-001", "15.05.2026", "1.000,00")).toContain(satz);
    let s = stand({ profil: { "ust.kleinunternehmer": false } });
    const [s1] = anlegen(s, "rechnung", t("2025-11-20"), "r0");
    s = ausgeben(felderSetzen(s1, "r0", { datum: "2025-11-20", leistung_gleich: true, kunde_name: "Muster GmbH", kunde_anschrift: "Am Markt 1\n04109 Leipzig", kunde_email: "re@muster.example", positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "", preis: "1.000,00", satz: "19" }] }, t("2025-11-20")), "r0", t("2025-11-20"));
    s = { ...s, profil: { "ust.kleinunternehmer": true, [VERZICHT_FELD]: true } };
    s = uneinbringlichSetzen(s, "r0", { datum: "2026-05-15", grund: "insolvenz" }, t("2026-05-16"));
    s = belegSetzen(s, beleg({ vorsteuer: true }), t("2026-05-15"));
    const r = umsaetzeFuer(s.unterlagen, "2026-05", s.betrieb, "soll", s.belege, true, undefined, { profil: s.profil, schwelleEuro: SCHWELLE })!;
    expect(r.uneinbringlich).toEqual([]);
    expect(r.werte.annahmen).toContain(satz);
    expect(r.werte.annahmen).not.toContain("Ob und wo");
    const l = datei(steuerpaket(s, MAI, SB, {}, "2026-06-10T08:00:00"), "LIESMICH.txt");
    expect(l).toContain(`RE 2025-001 (Kleinunternehmer-Zeitraum: ${satz})`);
  });
});
