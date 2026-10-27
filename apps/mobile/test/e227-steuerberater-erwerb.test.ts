/**
 * E-227 (Steuerberater 27.10.2026): Voranmeldung mit Tag des Erwerbs und Vermerk „Nicht vollständig“ (T-308), DATEV-Stapel
 * mit Erwerbskonten, Feld 116 und USt-IdNr. in LIESMICH (T-307), Erwerbsschwelle mit Verzicht für Kleinunternehmer und
 * Betriebe mit nur steuerfreien Umsätzen, Kleinunternehmer mit Erwerbsbesteuerung (Kz 89/93 ohne Kz 61, § 18 Abs. 4a UStG)
 * (T-309).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { dokumentHtml, ustNichtVollstaendig, vorlageFuer, type Beleg } from "@amtlos/fachlogik";
import { regelwert, REGELWERTE } from "../src/pflichten/check";
import { regelwertBestaetigt } from "../src/pflichten/pruefer";
import { T as TEXT } from "../src/texte";
import { ERWERBSSCHWELLE_REGELWERT, VERZICHT_FELD, erwerbsschwelleLage, igeOhneErwerbsbesteuerung, ueberFeld } from "../src/unterlagen/erwerbsschwelle";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, type Stand } from "../src/unterlagen/speicher";
import { steuerpaket } from "../src/unterlagen/steuerpaket";
import { IGE_ANNAHME, nurSteuerfreieUmsaetze, perioden, umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");

const BETRIEB = { ...LEERER_STAND.betrieb, name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.example", telefon: "030 1", steuernummer: "13/123/45678", iban: "DE89370400440532013000" };
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const stand = (o: Partial<Stand> = {}): Stand => ({ ...LEERER_STAND, betrieb: BETRIEB, steuerberatung: SB, ...o });
const beleg = (o: Partial<Beleg>): Beleg =>
  ({ id: "b1", datum: "2026-03-10", lieferant: "Fournitures SARL", nummer: "F-1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100000 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, quelle: "hand", erstellt: "2026-03-10T09:00:00Z", geaendert: "2026-03-10T09:00:00Z", steuerschuld: "ige", lieferant_ust_idnr: "FR12345678901", ...o }) as Beleg;
const SCHWELLE = 12500;
const datei = (p: ReturnType<typeof steuerpaket>, name: string) => strFromU8(unzipSync(p.zip)[name]!);
/** Rechnung, steuerfrei nach § 4 Nr. 14 UStG (Kz 48) – macht den Betrieb zu einem mit nur steuerfreien Umsätzen */
const t = (d: string) => new Date(`${d}T09:00:00Z`);
const steuerfreiStand = (): Stand => {
  const [s1] = anlegen(stand(), "rechnung", t("2026-03-05"), "r1");
  const s2 = felderSetzen(s1, "r1", { datum: "2026-03-05", kunde_name: "Patientin", kunde_anschrift: "Weg 2\n10115 Berlin", kunde_email: "p@x.example", befreiung: "Steuerfreie Heilbehandlung nach § 4 Nr. 14 Buchst. a UStG", positionen: [{ bezeichnung: "Behandlung", menge: "1", einheit: "", preis: "100,00", satz: "0" }] }, t("2026-03-05"));
  return ausgeben(s2, "r1", t("2026-03-05"));
};

describe("E-227: Regelwert Erwerbsschwelle (T-309)", () => {
  it("12.500 € im Katalog, vom Steuerberater bestätigt, gültig ab 01.01.2025", () => {
    expect(regelwert(ERWERBSSCHWELLE_REGELWERT)).toBe(12500);
    const r = REGELWERTE.find((x) => x.id === ERWERBSSCHWELLE_REGELWERT)!;
    expect(regelwertBestaetigt(r)).toBe(true);
    expect((r as unknown as { gueltig_ab: string }).gueltig_ab).toBe("2025-01-01");
    expect(r.pruefung).toMatchObject({ status: "freigegeben", geprueft_von: ["steuern"], bestaetigt_am: "2026-10-27" });
  });

  it("Lage: Verzicht → ja; Vorjahr laut Belegen über 12.500 € → ja; Angabe über → ja; beides verneint → nein; sonst offen", () => {
    const b26 = [beleg({ id: "a" })];
    expect(erwerbsschwelleLage({}, b26, "2026", SCHWELLE)).toMatchObject({ status: "offen" });
    expect(erwerbsschwelleLage({ [VERZICHT_FELD]: true }, b26, "2026", SCHWELLE)).toMatchObject({ status: "ja", grund: "verzicht" });
    expect(erwerbsschwelleLage({ [VERZICHT_FELD]: false }, b26, "2026", SCHWELLE)).toMatchObject({ status: "offen" });
    expect(erwerbsschwelleLage({ [VERZICHT_FELD]: false, [ueberFeld("2026")]: false }, b26, "2026", SCHWELLE)).toMatchObject({ status: "nein", grund: "verneint" });
    expect(erwerbsschwelleLage({ [VERZICHT_FELD]: false, [ueberFeld("2026")]: true }, b26, "2026", SCHWELLE)).toMatchObject({ status: "ja", grund: "angabe" });
    // die Angabe gilt je Jahr
    expect(erwerbsschwelleLage({ [VERZICHT_FELD]: false, [ueberFeld("2025")]: true }, b26, "2026", SCHWELLE)).toMatchObject({ status: "offen" });
    // Vorjahr genau 12.500 €: nicht „überstiegen“; 12.500,01 €: überstiegen
    const genau = [beleg({ id: "v", datum: "2025-06-01", steuer: [{ satz: 19, brutto_cent: 1250000 }] })];
    expect(erwerbsschwelleLage({}, genau, "2026", SCHWELLE)).toMatchObject({ status: "offen", vorjahr_cent: 1250000 });
    const drueber = [beleg({ id: "v", datum: "2025-06-01", steuer: [{ satz: 19, brutto_cent: 1250001 }] })];
    expect(erwerbsschwelleLage({ [VERZICHT_FELD]: false, [ueberFeld("2026")]: false }, drueber, "2026", SCHWELLE)).toMatchObject({ status: "ja", grund: "vorjahr" });
    // ohne Regelwert nur der Verzicht entscheidet
    expect(erwerbsschwelleLage({ [VERZICHT_FELD]: false, [ueberFeld("2026")]: false }, b26, "2026", null)).toMatchObject({ status: "offen" });
  });

  it("Frage zum Verzicht im Wortlaut des Steuerberaters; Hinweis mit den übrigen Fällen und § 1a Abs. 5 UStG", () => {
    expect(TEXT.e227_frage_verzicht).toBe("Hast du beim Finanzamt auf die Erwerbsschwelle verzichtet oder bei Lieferanten aus dem EU-Ausland deine USt-IdNr. angegeben?");
    const h = TEXT.e227_schwelle_hinweis("12.500 €");
    for (const t of ["§ 1a Abs. 3 UStG", "12.500 €", "nicht überstiegen", "voraussichtlich nicht übersteigen", "§ 24 UStG", "§ 1a Abs. 3 Nr. 1 UStG", "mindestens zwei Kalenderjahre", "USt-IdNr. angibst (§ 1a Abs. 4 UStG)", "Neue Fahrzeuge und verbrauchsteuerpflichtige Waren", "§ 1a Abs. 5 UStG", "Steuerberatung"]) expect(h).toContain(t);
    expect(TEXT.e227_ku_va_pflicht).toContain("§ 18 Abs. 4a UStG");
  });
});

describe("E-227: Voranmeldung (T-308, T-309)", () => {
  it("Tag des Erwerbs: späte Rechnung zählt im Monat nach dem Erwerb; Annahme nur noch für Belege ohne Erwerbstag", () => {
    const b = beleg({ datum: "2026-05-15", erwerb_datum: "2026-02-20" });
    expect(perioden([], BETRIEB, "soll", [b])).toContain("2026-03");
    const maerz = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [b], false)!;
    expect(maerz.werte).toMatchObject({ ige_19: "1.000,00", vorsteuer_ige: "190,00" });
    expect(maerz.werte.annahmen).not.toContain("ohne Tag des Erwerbs");
    expect(umsaetzeFuer([], "2026-05", BETRIEB, "soll", [b], false)!.werte).not.toHaveProperty("ige_19");
    const ohne = umsaetzeFuer([], "2026-05", BETRIEB, "soll", [beleg({ datum: "2026-05-15" })], false)!;
    expect(ohne.werte.annahmen).toContain(IGE_ANNAHME(1));
    expect(IGE_ANNAHME(1)).toContain("ohne Tag des Erwerbs");
  });

  it("Belege ohne Euro-Betrag: „Nicht vollständig: …“ im Wortlaut des Steuerberaters oben auf dem PDF (je Art)", () => {
    const ige0 = beleg({ id: "i0", fremd: { waehrung: "SEK", steuer: [{ satz: 19, brutto_cent: 1000000 }] }, steuer: [{ satz: 19, brutto_cent: 0 }] });
    const rc0 = beleg({ id: "r0", steuerschuld: "eu", kategorie: "buero", fremd: { waehrung: "USD", steuer: [{ satz: 0, brutto_cent: 5000 }] }, steuer: [{ satz: 0, brutto_cent: 0 }] });
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [ige0, ige0 && { ...ige0, id: "i1" }, rc0], false)!;
    expect(r.werte.unvollstaendig).toBe("Nicht vollständig: 2 Belege ohne Euro-Betrag (innergemeinschaftlicher Erwerb) fehlen\nNicht vollständig: 1 Belege ohne Euro-Betrag (§ 13b) fehlen");
    const h = dokumentHtml(vorlageFuer("ust_voranmeldung")!, { versteuerung: "soll", ...r.werte }, BETRIEB).replace(/&nbsp;|\u00a0/g, " ");
    expect(h).toContain(`<strong>${ustNichtVollstaendig(2, "ige")}</strong>`);
    expect(h).toContain(`<strong>${ustNichtVollstaendig(1, "13b")}</strong>`);
    // vollständig: Feld leer (überschreibt eine frühere Übernahme)
    expect(umsaetzeFuer([], "2026-03", BETRIEB, "soll", [beleg({})], false)!.werte.unvollstaendig).toBe("");
  });

  it("Kleinunternehmer ohne Angaben: nicht übernommen, Fragen zur Erwerbsschwelle", () => {
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [beleg({})], true, undefined, { profil: {}, schwelleEuro: SCHWELLE })!;
    expect(r.werte).not.toHaveProperty("ige_19");
    expect(r.igeKu).toBe(1);
    expect(r.erwerbsschwelle).toMatchObject({ status: "offen", art: "ku", jahr: "2026" });
    expect(r.kuVoranmeldungPflicht).toBe(false);
  });

  it("Kleinunternehmer unter der Schwelle ohne Verzicht: nicht übernommen, keine Voranmeldung", () => {
    const profil = { [VERZICHT_FELD]: false, [ueberFeld("2026")]: false };
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [beleg({})], true, undefined, { profil, schwelleEuro: SCHWELLE })!;
    expect(r.werte).not.toHaveProperty("ige_19");
    expect(r).toMatchObject({ igeKu: 1, kuVoranmeldungPflicht: false });
    expect(r.erwerbsschwelle?.status).toBe("nein");
  });

  it("Kleinunternehmer mit Verzicht: Kz 89/93 mit Steuer, keine Kz 61, Voranmeldung nach § 18 Abs. 4a UStG; PDF ohne Kz 61", () => {
    const b = beleg({ steuer: [{ satz: 19, brutto_cent: 100000 }, { satz: 7, brutto_cent: 20000 }] });
    const r = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [b], true, undefined, { profil: { [VERZICHT_FELD]: true }, schwelleEuro: SCHWELLE })!;
    expect(r.kleinunternehmer).toBe(true);
    expect(r.werte).toMatchObject({ ige_19: "1.000,00", ige_7: "200,00", vorsteuer_ige: "" });
    expect(r).toMatchObject({ igeBelege: 1, igeKu: 0, kuVoranmeldungPflicht: true });
    expect(r.werte).not.toHaveProperty("vorsteuer");
    const h = dokumentHtml(vorlageFuer("ust_voranmeldung")!, { versteuerung: "soll", ...r.werte }, BETRIEB);
    expect(h).toMatch(/<span>89<\/span>/);
    expect(h).not.toMatch(/<span>61<\/span>/);
    // Zahllast = Erwerbsteuer 190 + 14
    expect(h).toMatch(/204,00\s€/);
    // Kleinunternehmer mit Angabe „über der Schwelle“ ebenso
    expect(umsaetzeFuer([], "2026-03", BETRIEB, "soll", [b], true, undefined, { profil: { [VERZICHT_FELD]: false, [ueberFeld("2026")]: true }, schwelleEuro: SCHWELLE })!.kuVoranmeldungPflicht).toBe(true);
  });

  it("nur steuerfreie Umsätze (Kz 48): Erwerbe nur mit Erwerbsbesteuerung; Regelbesteuerte unverändert", () => {
    const b = beleg({ vorsteuer: false });
    const sf = steuerfreiStand();
    expect(nurSteuerfreieUmsaetze(sf.unterlagen, sf.betrieb)).toBe(true);
    const steuerfrei = sf.unterlagen;
    const offen = umsaetzeFuer(steuerfrei, "2026-03", BETRIEB, "soll", [b], false, undefined, { profil: {}, schwelleEuro: SCHWELLE })!;
    expect(offen.erwerbsschwelle).toMatchObject({ status: "offen", art: "steuerfrei" });
    expect(offen.werte).not.toHaveProperty("ige_19");
    expect(offen.igeKu).toBe(1);
    const ja = umsaetzeFuer(steuerfrei, "2026-03", BETRIEB, "soll", [b], false, undefined, { profil: { [VERZICHT_FELD]: true }, schwelleEuro: SCHWELLE })!;
    expect(ja.werte).toMatchObject({ ige_19: "1.000,00", vorsteuer_ige: "" });
    expect(ja.kuVoranmeldungPflicht).toBe(false);
    // ohne steuerfreie Rechnungen (Regelbesteuerung) keine Erwerbsschwelle
    const regel = umsaetzeFuer([], "2026-03", BETRIEB, "soll", [b], false, undefined, { profil: {}, schwelleEuro: SCHWELLE })!;
    expect(regel.erwerbsschwelle).toBeNull();
    expect(regel.werte).toMatchObject({ ige_19: "1.000,00" });
  });

  it("App: Fragen an Beleg und Übernahme, Hinweis § 18 Abs. 4a UStG, Erwerbstag am Beleg", () => {
    const belege = lies("seiten/Belege.tsx");
    expect(belege).toContain("TEXT.e227_erwerb_datum");
    expect(belege).toContain("<ErwerbsschwelleFragen");
    expect(belege).toContain("TEXT.e227_ku_va_pflicht");
    const ablauf = lies("seiten/Ablauf.tsx");
    expect(ablauf).toContain("<ErwerbsschwelleFragen");
    expect(ablauf).toContain("schwelleEuro: erwerbsschwelleEuro()");
    expect(ablauf).toContain("TEXT.e227_ku_va_pflicht");
    expect(lies("seiten/Erwerbsschwelle.tsx")).toContain("TEXT.e227_frage_verzicht");
  });
});

describe("E-227: Steuerberater-Paket (T-307)", () => {
  const zeitraum = { von: "2026-05-01", bis: "2026-05-31", name: "2026-05" };

  it("Erwerbskonten als Standard (19 % und 7 %), Feld 116 bei später Rechnung, USt-IdNr. in LIESMICH, kein „FEHLEN“", () => {
    const b = beleg({ datum: "2026-05-15", erwerb_datum: "2026-02-20", steuer: [{ satz: 19, brutto_cent: 100000 }, { satz: 7, brutto_cent: 20000 }] });
    const p = steuerpaket(stand({ belege: [b] }), zeitraum, SB, {}, "2026-06-10T08:00:00");
    const liste = datei(p, "Buchungsliste_2026-05.csv");
    expect(liste).toMatch(/1000,00;H;1610;3425;;/);
    expect(liste).toMatch(/200,00;H;1610;3420;;/);
    const stapel = datei(p, "EXTF_Buchungsstapel_2026-05.csv");
    expect(stapel).toContain("31032026");
    const lies2 = datei(p, "LIESMICH.txt");
    expect(lies2).toContain("Feld 40 „EU-Land u. UStID“ bleibt leer; USt-IdNr. der Lieferanten: Fournitures SARL am 15.05.2026: FR12345678901");
    expect(lies2).toContain("Feld 116 31.03.2026");
    expect(lies2).not.toContain("FEHLEN sie im Stapel");
    expect(lies2).not.toContain("noch nicht von der Steuerberatung bestätigt");
    expect(datei(p, "Belege_2026-05.csv")).toContain("Erwerb am 20.02.2026");
  });

  it("Kleinunternehmer: ohne festgestellte Erwerbsbesteuerung nicht im Stapel (LIESMICH nennt sie), mit Verzicht auf 3435", () => {
    const b = beleg({ datum: "2026-05-15" });
    const profilKu = { "ust.kleinunternehmer": true };
    const ohne = steuerpaket(stand({ belege: [b], profil: profilKu }), zeitraum, SB, {}, "2026-06-10T08:00:00");
    expect(datei(ohne, "Buchungsliste_2026-05.csv")).not.toMatch(/;3435;/);
    expect(datei(ohne, "LIESMICH.txt")).toContain("Erwerbsschwelle (§ 1a Abs. 3 UStG): Bei diesem Erwerb ist laut den Angaben in der App keine Erwerbsbesteuerung festgestellt");
    expect(datei(ohne, "Belege_2026-05.csv")).toContain("nein – Erwerbsschwelle");
    const mit = steuerpaket(stand({ belege: [b], profil: { ...profilKu, [VERZICHT_FELD]: true } }), zeitraum, SB, {}, "2026-06-10T08:00:00");
    expect(datei(mit, "Buchungsliste_2026-05.csv")).toMatch(/1000,00;H;1610;3435;;/);
    expect(datei(mit, "LIESMICH.txt")).toContain("§ 18 Abs. 4a UStG");
  });

  it("igeOhneErwerbsbesteuerung: Jahr des Erwerbs entscheidet, Vorjahressumme aus allen Belegen", () => {
    const vor = beleg({ id: "v", datum: "2025-04-01", steuer: [{ satz: 19, brutto_cent: 1300000 }] });
    const b = beleg({ id: "n", datum: "2026-05-15" });
    expect(igeOhneErwerbsbesteuerung([b], [vor, b], {}, SCHWELLE)).toEqual([]);
    expect(igeOhneErwerbsbesteuerung([b], [b], {}, SCHWELLE).map((x) => x.id)).toEqual(["n"]);
  });
});
