/**
 * E-237: Nachtrag des Steuerberaters vom 28.10.2026 zu C.37 (Voranmeldung des Kleinunternehmers, § 18 Abs. 4a UStG) –
 * Neugründer-Regel gilt für Kleinunternehmer nicht (Abschnitt 18.7 Abs. 1 Satz 4 UStAE); v3 freigegeben und im Bündel der
 * App. T-339: Frist und Erinnerung in der App nur für Zeiträume, in denen laut Belegen Steuer nach § 13b UStG bzw. auf
 * Erwerbe mit Erwerbsbesteuerung entsteht (Filter der Anzeige, kein Auslöser; Server und Web rechnen jeden Zeitraum).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Beleg } from "@amtlos/fachlogik";
import { describe, expect, it } from "vitest";
import { KATALOG, auswertung, dringlichkeit, offeneFragenNachWirkung, regelwert, type Profil } from "../src/pflichten/check";
import { erinnerungen } from "../src/pflichten/erinnerungsplan";
import { KU_VA_ID, kuVaFiltern, kuVaZeitraeume, zeitraumSchluessel } from "../src/pflichten/kuVoranmeldung";
import { ERWERBSSCHWELLE_REGELWERT, VERZICHT_FELD } from "../src/unterlagen/erwerbsschwelle";
import { LEERER_STAND } from "../src/unterlagen/speicher";
import { katalogEntwuerfe } from "../werkzeuge/interna.mjs";

const WURZEL = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
const lies = (d: string) => fs.readFileSync(path.join(WURZEL, d), "utf8");

/** Kleinunternehmer (Bestand seit 2022), kauft bei Unternehmen in anderen EU-Ländern ein */
const KU: Profil = { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 0, gruendungsdatum: "2022-01-01", "ust.kleinunternehmer": true, "umsatz.vorjahr": 20000, "einkauf.ausland_unternehmen": true, "einkauf.eu_unternehmen": true };
const beleg = (id: string, datum: string, o: Partial<Beleg> = {}): Beleg => ({ id, datum, lieferant: "Software Ltd. (Irland)", nummer: `R-${id}`, kategorie: "software", steuer: [{ satz: 19, brutto_cent: 2900 }], vorsteuer: false, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: `${datum}T08:00:00Z`, geaendert: `${datum}T08:00:00Z`, ...o });
/** Software-Abo eines Anbieters aus dem EU-Ausland, Steuerschuldnerschaft nach § 13b Abs. 1 UStG – im 3. Vierteljahr 2026 */
const ABO = beleg("abo", "2026-08-14", { steuerschuld: "eu" });
const schwelle = regelwert(ERWERBSSCHWELLE_REGELWERT);
const lauf = (p: Profil, belege: Beleg[], heute = "2026-09-20") => auswertung(p, heute, [], [], {}, { kuVaZeitraeume: kuVaZeitraeume(belege, p, schwelle) });
const c37 = (a: ReturnType<typeof auswertung>) => a.gilt.find((p) => p.id === KU_VA_ID);
const e = (heute: string) => ({ erledigt: {}, unterlagen: [], betrieb: LEERER_STAND.betrieb, heute });

describe("E-237: C.37 v3 freigegeben – Neugründer-Regel gilt für Kleinunternehmer nicht", () => {
  const roh = YAML.parse(lies(`catalog/pflichten/${KU_VA_ID}.yaml`)) as { version: number; nicht_vor_freigabe?: boolean; pruefung: { status: string; geprueft_version: number; geprueft_von: string[] }; fachlich_zu_pruefen: string[]; sanktion: { schwere: string } };
  it("v3, freigegeben von Steuerberater und Rechtsanwalt, nicht mehr zurückgehalten, im Bündel der App", () => {
    expect(roh.version).toBe(3);
    expect(roh.nicht_vor_freigabe).toBeUndefined();
    expect(roh.pruefung.status).toBe("freigegeben");
    expect(roh.pruefung.geprueft_version).toBe(3);
    expect([...roh.pruefung.geprueft_von].sort()).toEqual(["recht", "steuern"]);
    expect(KATALOG.pflichten.map((p) => p.id)).toContain(KU_VA_ID);
    expect(katalogEntwuerfe()).toEqual({ blockierend: [], zurueckgehalten: [] });
  });
  it("Quelle Abschnitt 18.7 Abs. 1 Satz 4 UStAE bei den Prüfnotizen", () => {
    expect(roh.fachlich_zu_pruefen.join(" ")).toContain("Abschnitt 18.7 Abs. 1 Satz 4 UStAE");
  });
  it("Register: Freigabe Steuerberater ohne Folgen für v3; Folgen weiter aus der Freigabe des Rechtsanwalts (v1)", () => {
    const reg = YAML.parse(lies("docs/freigabe-katalog/freigaben.yaml")) as { pruefer: string; umfang: string; nachweis: { umfang: string; datum: string }; eintraege: Record<string, { version: number }> }[];
    const stb = reg.filter((r) => r.eintraege[KU_VA_ID] && r.pruefer === "steuern");
    expect(stb.map((r) => [r.umfang, r.nachweis.datum, r.eintraege[KU_VA_ID]!.version])).toEqual([["ohne_sanktion", "2026-10-28", 3]]);
    expect(stb[0]!.nachweis.umfang).toContain("in seiner Fassung laut Prüfpaket und Nachtrag 28.10.2026");
    expect(reg.filter((r) => r.eintraege[KU_VA_ID] && r.pruefer === "recht").map((r) => [r.umfang, r.eintraege[KU_VA_ID]!.version])).toEqual([["sanktion", 1]]);
  });
  it("ohne Belege-Filter (Server, Web, Check ohne Belege): jeder Zeitraum wie im Katalog, vierteljährlich", () => {
    const p = auswertung(KU, "2026-09-20").gilt.find((x) => x.id === KU_VA_ID)!;
    expect(p.termine.slice(0, 3)).toEqual(["2026-10-12", "2027-01-11", "2027-04-12"]);
    expect(p.nurZeitraeumeMitSteuer).toBeUndefined();
  });
  it("Angabe „monatlich“ zählt nicht (freiwillige monatliche Abgabe ausgeschlossen, § 18 Abs. 4a Satz 3 UStG)", () => {
    const p = auswertung({ ...KU, "ust.voranmeldung_rhythmus": "monatlich" }, "2026-09-20").gilt.find((x) => x.id === KU_VA_ID)!;
    expect(p.termine.slice(0, 2)).toEqual(["2026-10-12", "2027-01-11"]);
  });
});

describe("E-237 (T-339): Frist und Erinnerung nur in Zeiträumen mit solcher Steuer laut Belegen", () => {
  it("Vierteljahr mit § 13b-Beleg (Software-Abo aus dem EU-Ausland) → Frist am 10. Tag nach Ablauf des Vierteljahrs", () => {
    const p = c37(lauf(KU, [ABO]))!;
    expect(p.termine).toEqual(["2026-10-12"]); // 10.10.2026 ist ein Samstag → Montag, 12.10.2026
    expect(p.naechsterTermin).toBe("2026-10-12");
    expect(p.nurZeitraeumeMitSteuer).toBe(true);
    const er = erinnerungen(lauf(KU, [ABO]), e("2026-09-20"), "2026-09-20").filter((x) => x.pflichtId === KU_VA_ID);
    expect(er.map((x) => [x.termin, x.art])).toEqual([["2026-10-12", "vorher"], ["2026-10-12", "heute"]]);
  });
  it("Vierteljahr ohne solchen Beleg → keine Frist, keine Erinnerung; Eintrag bleibt unter „gilt“ mit Hinweis", () => {
    const ohne = lauf(KU, [beleg("normal", "2026-08-14", { steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true })]);
    const p = c37(ohne)!;
    expect(p.termine).toEqual([]);
    expect(p.naechsterTermin).toBeNull();
    expect(p.rhythmusHinweise?.join(" ")).toContain("Bisher gibt es keinen solchen Zeitraum");
    expect(erinnerungen(ohne, e("2026-09-20"), "2026-09-20").some((x) => x.pflichtId === KU_VA_ID)).toBe(false);
    // nicht „jetzt dran“ trotz Einstufung „hoch“, keine Frage nach dem Rhythmus
    expect(dringlichkeit(ohne, e("2026-09-20"), "2026-09-20").jetzt.some((x) => x.id === KU_VA_ID)).toBe(false);
    expect(offeneFragenNachWirkung(ohne, KU).map((f) => f.feld)).not.toContain("ust.voranmeldung_rhythmus");
  });
  it("nächstes Vierteljahr ohne Beleg: nur der Zeitraum mit Beleg hat eine Frist", () => {
    const p = c37(lauf(KU, [ABO], "2026-10-13"))!;
    // Q3 ist schon vorbei (12.10.), Q4 hat keinen Beleg → kein kommender Termin; Q3 bleibt als vergangener Termin sichtbar
    expect(p.termine).toEqual([]);
    expect(p.vergangeneTermine).toEqual(["2026-10-12"]);
    const p2 = c37(lauf(KU, [ABO, beleg("abo2", "2026-11-14", { steuerschuld: "eu" })], "2026-10-13"))!;
    expect(p2.termine).toEqual(["2027-01-11"]);
  });
  it("mehr als 9.000 € Steuer im Vorjahr → monatlich, Frist am 10. des Folgemonats nur für Monate mit Beleg", () => {
    const p = c37(lauf({ ...KU, "ust.zahllast_vorjahr": 9500 }, [ABO]))!;
    // August → 10.09.2026 (am 20.09. schon vorbei, bleibt als vergangener Termin), sonst kein Monat
    expect(p.termine).toEqual([]);
    expect(p.vergangeneTermine).toEqual(["2026-09-10"]);
    const p2 = c37(lauf({ ...KU, "ust.zahllast_vorjahr": 9500 }, [ABO, beleg("abo2", "2026-09-03", { steuerschuld: "eu" })]))!;
    expect(p2.termine).toEqual(["2026-10-12"]); // September → 10.10.2026 (Samstag) → 12.10.2026
  });
  it("Gründungs- und Folgejahr weiter vierteljährlich (keine Neugründer-Regel)", () => {
    const neu: Profil = { ...KU, gruendungsdatum: "2026-03-01", "umsatz.vorjahr": null };
    const p = c37(lauf(neu, [ABO]))!;
    expect(p.termine).toEqual(["2026-10-12"]);
    const ohneFilter = auswertung(neu, "2026-09-20").gilt.find((x) => x.id === KU_VA_ID)!;
    expect(ohneFilter.termine.slice(0, 2)).toEqual(["2026-10-12", "2027-01-11"]);
  });
  it("Erwerb aus dem EU-Ausland nur mit Erwerbsbesteuerung; Bauleistung nach § 13b zählt; ungültige Belege nicht", () => {
    const ware = beleg("ware", "2026-08-03", { steuerschuld: "ige", erwerb_datum: "2026-08-01", lieferant: "Fournisseur SARL" });
    expect([...kuVaZeitraeume([ware], KU, schwelle)]).toEqual([]);
    expect([...kuVaZeitraeume([ware], { ...KU, [VERZICHT_FELD]: true }, schwelle)].sort()).toEqual(["2026-08", "2026-Q3"]);
    expect([...kuVaZeitraeume([beleg("bau", "2026-12-01", { steuerschuld: "bau" })], KU, schwelle)].sort()).toEqual(["2026-12", "2026-Q4"]);
    expect([...kuVaZeitraeume([{ ...ABO, ungueltig: "2026-08-20T00:00:00Z" }], KU, schwelle)]).toEqual([]);
    expect([...kuVaZeitraeume([{ ...ABO, steuer: [{ satz: 19, brutto_cent: 0 }] }], KU, schwelle)].sort()).toEqual(["2026-08", "2026-Q3"]);
    expect(zeitraumSchluessel("2026-12-31")).toEqual(["2026-12", "2026-Q4"]);
  });
  it("nur Einkauf im Drittland (EU-Frage „nein“): Belege können solche Leistungen nicht zeigen – jeder Zeitraum wie im Katalog", () => {
    const dritt: Profil = { ...KU, "einkauf.eu_unternehmen": false };
    expect(kuVaFiltern(dritt)).toBe(false);
    const p = c37(lauf(dritt, []))!;
    expect(p.termine.slice(0, 2)).toEqual(["2026-10-12", "2027-01-11"]);
    expect(p.nurZeitraeumeMitSteuer).toBeUndefined();
  });
  it("Hinweis nennt Drittland-Leistungen (an Belegen nicht erkennbar)", () => {
    expect(c37(lauf(KU, [ABO]))!.rhythmusHinweise?.join(" ")).toContain("Leistungen von Unternehmen aus Drittländern erkennt");
  });
});
