/**
 * Vermerk unter den Vorlagen (zuerst Nachkontrolle Lebensmittelfachbeauftragter, 23.10.2026; E-196): nur bei
 * unterschriebener Freigabe, solange die Prüfsumme aller gedruckten Ausprägungen zum freigegebenen Stand passt; mit Rolle
 * statt Namen, mit Einschränkung des Prüfers und „teilweise“, wenn die Vorlage noch „fachlich zu prüfen“ enthält.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEERER_BETRIEB, PRUEFHINWEIS, PRUEFSTAENDE, PRUEF_ROLLEN, VERIFIZIERUNG, VORLAGEN, aktuellerPruefstand, dokumentHtml, freigabeUnterschrieben, freigabenFuer, leereDaten, VORLAGEN_GEPRUEFT, geprueftVermerk, pruefHinweisFuer, sha256, vorlageFuer, vorlageGeprueft, vorlagenPruefstand, vorlagenPruefsumme, type Daten, type Vorlage, type VorlagenFreigabe } from "../src/index.js";

const WURZEL = path.resolve(__dirname, "../../..");
const FUENF = ["haccp", "hygieneplan", "allergene", "ifsg_belehrung", "hygieneschulung"];
const WEITERE = ["rechnung", "euer", "verfahrensdokumentation", "kassenmeldung", "lohnkonto", "unterweisung", "gefahrstoffverzeichnis",
  "betriebsanweisung_maschine", "pruefprotokoll_elektro", "datenschutz_dokumentation", "datenschutzerklaerung_website", "avv", "datenschutzinformation", "datenpanne",
  "video_hinweisschild", "anamnese_einwilligung", "arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ki_kompetenz", "ausweis_hinweis", "schluesselquittung",
  "impressum", "gewerbeanmeldung", "transparenzregister",
  "ust_voranmeldung", "oss_meldung", "zm_meldung", "steuererklaerung", "kassenbuch", "aufbewahrung", "sv_meldedaten",
  "betriebsanweisung", "expositionsverzeichnis", "hautschutzplan", "gefaehrdungsbeurteilung", "betriebsanweisung_biostoffe", "bilanz_guv"];
// Rechtsanwalt 25.10.2026: nur für GmbH, OHG und KG (Vermerk abhängig von der Rechtsform)
const NUR_RECHTSFORM = ["handelsregister"];
const ALLE = [...FUENF, ...WEITERE];
// E-196: unterschrieben liegt nur die Bestätigung des Steuerberaters vom 23.10.2026 vor (fünf Vorlagen)
const UNTERSCHRIEBEN = ["rechnung", "euer", "verfahrensdokumentation", "kassenmeldung", "lohnkonto"];
// E-196: Vorlagen, die heute einen Vermerk zeigen – keine: Die fünf unterschriebenen haben seit der Freigabe die neue
// Fußzeile der GmbH & Co. KG (E-193), alle übrigen sind ohne unterschriebenes Blatt. Nach erneuter Freigabe hier eintragen.
const MIT_VERMERK: string[] = [];
const alleFreigaben = () => Object.keys(VORLAGEN_GEPRUEFT).flatMap((id) => freigabenFuer(id).map((f, i) => ({ id, f, schluessel: i ? `${id}#${i}` : id })));
const datenFuer = (id: string, f: Omit<VorlagenFreigabe, "weitere">): Daten => ({ ...(f.fassung ? { [f.fassung.feld]: f.fassung.wert } : {}), ...(f.rechtsformen ? { rechtsform: f.rechtsformen[0]! } : {}), ...(id === "hygieneplan" && !f.fassung ? { art: "lebensmittel" } : {}) });

describe("Vorlagen fachlich durchgesehen: Register (geprueft.ts)", () => {
  afterEach(() => vi.useRealTimers());

  it("zentrale Liste: alle freigegebenen Vorlagen mit Rolle, alter und neuer Prüfsumme", () => {
    expect(Object.keys(VORLAGEN_GEPRUEFT).sort()).toEqual([...ALLE, ...NUR_RECHTSFORM].sort());
    expect(VORLAGEN_GEPRUEFT.handelsregister!.rechtsformen).toEqual(["GmbH", "OHG", "KG"]);
    for (const { id, f } of alleFreigaben()) {
      expect(vorlageFuer(id), id).toBeDefined();
      expect(Object.keys(PRUEF_ROLLEN), id).toContain(f.rolle);
      expect(f.pruefsumme, id).toMatch(/^[0-9a-f]{64}$/);
      expect(f.pruefsumme_alt, id).toMatch(/^[0-9a-f]{64}$/);
      expect(["2026-10-23", "2026-10-25"]).toContain(f.stand);
      // nie ein Name im Register der App
      expect(JSON.stringify(f), id).not.toMatch(/weber|busch|heckler|\bkoch\b|\bbaum\b/i);
    }
  });

  it("Unterschrift: Datum und Datei liegen vor, der Stand liegt nie nach der Unterschrift", () => {
    const unterschrieben = alleFreigaben().filter(({ f }) => freigabeUnterschrieben(f)).map(({ id }) => id);
    expect(unterschrieben.sort()).toEqual([...UNTERSCHRIEBEN].sort());
    for (const { id, f } of alleFreigaben()) {
      if (f.unterschrieben_am) {
        expect(fs.existsSync(path.join(WURZEL, f.unterschrift!)), `${id}: ${f.unterschrift}`).toBe(true);
        expect(f.stand <= f.unterschrieben_am, id).toBe(true);
      } else expect(f.unterschrift_offen, id).toBeTruthy();
    }
  });

  it("die erzeugte Liste PRUEFSTAENDE passt zur Rechnung (sonst: werkzeuge/pruefstaende-erzeugen.mjs)", () => {
    const schluessel = alleFreigaben().map((x) => x.schluessel).sort();
    expect(Object.keys(PRUEFSTAENDE).sort()).toEqual(schluessel);
    for (const { id, f, schluessel: k } of alleFreigaben()) expect(vorlagenPruefstand({ ...vorlageFuer(id)! }, f), k).toEqual(PRUEFSTAENDE[k]);
  });

  it("je Rolle: Vermerk genau bei den unterschriebenen Freigaben mit passender Prüfsumme, Datum nie nach der Unterschrift", () => {
    const gezeigt: string[] = [];
    for (const rolle of Object.keys(PRUEF_ROLLEN)) {
      for (const { id, f } of alleFreigaben().filter((x) => x.f.rolle === rolle)) {
        const v = vorlageFuer(id)!;
        const soll = freigabeUnterschrieben(f) && aktuellerPruefstand(v, f).summe === f.pruefsumme;
        const hinweis = pruefHinweisFuer(v, datenFuer(id, f));
        expect(hinweis !== PRUEFHINWEIS, `${rolle} ${id}`).toBe(soll);
        if (soll) {
          gezeigt.push(id);
          expect(hinweis).toContain(PRUEF_ROLLEN[rolle as keyof typeof PRUEF_ROLLEN]);
          const datum = hinweis.match(/Stand (\d\d)\.(\d\d)\.(\d{4})/)!;
          expect(`${datum[3]}-${datum[2]}-${datum[1]}` <= f.unterschrieben_am!, id).toBe(true);
        }
      }
    }
    expect(gezeigt.sort()).toEqual([...MIT_VERMERK].sort());
    for (const v of VORLAGEN) if (!MIT_VERMERK.includes(v.id)) expect(pruefHinweisFuer(v, v.id === "hygieneplan" ? { art: "lebensmittel" } : {}), v.id).toBe(PRUEFHINWEIS);
  });

  it("E-196: heutige Prüfsumme weicht bei allen Vorlagen außer dem Handelsregister vom freigegebenen Stand ab (Fußzeile GmbH & Co. KG, E-193)", () => {
    for (const { id, f } of alleFreigaben()) {
      const gleich = aktuellerPruefstand(vorlageFuer(id)!, f).summe === f.pruefsumme;
      expect(gleich, id).toBe(id === "handelsregister");
    }
  });

  it("Vermerk mit Rolle, Einschränkung und offenen Stellen – ohne Rolle der frühere Wortlaut", () => {
    expect(geprueftVermerk("2026-10-23")).toBe("Vorlagen fachlich durchgesehen (Stand 23.10.2026)");
    expect(geprueftVermerk("2026-10-23", { rolle: "steuern" })).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 23.10.2026)");
    expect(geprueftVermerk("2026-10-25", { rolle: "arbeitsschutz", einschraenkung: "ohne arbeitsmedizinische Angaben" })).toBe("Vorlage fachlich durchgesehen von einer Fachkraft für Arbeitssicherheit (ohne arbeitsmedizinische Angaben) (Stand 25.10.2026)");
    expect(geprueftVermerk("2026-10-23", { rolle: "hygiene" }, 2)).toBe("Vorlage teilweise fachlich durchgesehen von einem Lebensmittelfachbeauftragten (Stand 23.10.2026) – mit „fachlich zu prüfen“ gekennzeichnete Angaben sind noch offen");
    for (const t of Object.values(PRUEF_ROLLEN)) expect(t).not.toMatch(/rechtssicher|garantiert|freigegeben/i);
    // Sifa: arbeitsmedizinische Angaben ausgenommen (Bestätigung und Mails vom 23. und 25.10.2026)
    for (const id of ["betriebsanweisung", "expositionsverzeichnis", "hautschutzplan", "gefaehrdungsbeurteilung", "betriebsanweisung_biostoffe"]) expect(VORLAGEN_GEPRUEFT[id]!.einschraenkung, id).toBe("ohne arbeitsmedizinische Angaben");
  });

  it("Vorlagen mit offenen Stellen („fachlich zu prüfen“) bekämen nur „teilweise durchgesehen“", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    const f = VORLAGEN_GEPRUEFT.gefaehrdungsbeurteilung!;
    expect(PRUEFSTAENDE.gefaehrdungsbeurteilung!.offen).toBeGreaterThan(0);
    const test: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, gefaehrdungsbeurteilung: { ...f, unterschrieben_am: "2026-10-25", unterschrift: "test.jpg", pruefsumme: vorlagenPruefsumme({ ...g }, f) } };
    const frei = vorlageGeprueft(g, {}, test)!;
    expect(frei).toBeDefined();
    expect(geprueftVermerk(frei.stand, frei, vorlagenPruefstand({ ...g }, f).offen)).toMatch(/^Vorlage teilweise fachlich durchgesehen von einer Fachkraft für Arbeitssicherheit \(ohne arbeitsmedizinische Angaben\)/);
  });
});

describe("E-196: Prüfsumme über alle gedruckten Ausprägungen", () => {
  const haccp = vorlageFuer("haccp")!;
  const re = vorlageFuer("rechnung")!;
  const f = (v: Vorlage) => vorlagenPruefsumme({ ...v }, {});

  it("Änderungen nur in der Fußzeile, nur bei einer Rechtsform, nur bei einer Auswahl oder nur im Storno ändern die Prüfsumme", () => {
    const basis = f(re);
    // Fußzeile nur bei GmbH & Co. KG (wie E-193)
    const fuss: Vorlage = { ...re, html: (d, b) => re.html(d, b).replace(/Persönlich haftende Gesellschafterin/g, "Komplementärin") };
    // nur bei einer Rechtsform (UG)
    const ug: Vorlage = { ...re, html: (d, b) => (b.rechtsform === "UG (haftungsbeschränkt)" ? re.html(d, b).replace("Rechnung", "Rechnung (UG)") : re.html(d, b)) };
    // nur bei Kleinunternehmern (Schalter) bzw. bei Steuerschuldnerschaft (Baustein)
    const ku: Vorlage = { ...re, html: (d, b) => (d.kleinunternehmer === true ? `${re.html(d, b)}<p>KU neu</p>` : re.html(d, b)) };
    const rc: Vorlage = { ...re, html: (d, b) => (Array.isArray(d.hinweise) && d.hinweise.length === 1 && d.hinweise[0] === "reverse_charge" ? `${re.html(d, b)}<p>13b neu</p>` : re.html(d, b)) };
    // nur im Storno einer Schlussrechnung (verdeckte Angaben)
    const storno: Vorlage = { ...re, html: (d, b) => (d.storno_abschlaege === true ? `${re.html(d, b)}<p>Storno neu</p>` : re.html(d, b)) };
    // nur in Bayern (Landeszusatz)
    const bayern: Vorlage = { ...haccp, html: (d, b) => (b.bundesland === "Bayern" ? `${haccp.html(d, b)}<p>Bayern neu</p>` : haccp.html(d, b)) };
    for (const [name, v, alt] of [["Fußzeile", fuss, basis], ["Rechtsform", ug, basis], ["Kleinunternehmer", ku, basis], ["§ 13b", rc, basis], ["Storno", storno, basis], ["Bayern", bayern, f(haccp)]] as const) expect(f(v), name).not.toBe(alt);
    // nur Gestaltung (CSS) zählt nicht
    const css: Vorlage = { ...re, html: (d, b) => re.html(d, b).replace("</style>", " .neu{color:red}</style>") };
    expect(f(css)).toBe(basis);
  });

  it("jede Änderung an Bausteinen, Hilfetexten oder festen Texten ändert die Prüfsumme", () => {
    const basis = f(haccp);
    const hilfe: Vorlage = { ...haccp, abschnitte: haccp.abschnitte.map((a, i) => (i === 0 ? { ...a, hilfe: `${a.hilfe ?? ""} Neu.` } : a)) };
    const grenzwert: Vorlage = {
      ...haccp,
      abschnitte: haccp.abschnitte.map((a) => ({ ...a, felder: a.felder.map((x) => (x.art === "liste" && x.id === "punkte" && x.vorschlaege ? { ...x, vorschlaege: x.vorschlaege.map((y, j) => (j === 0 ? { ...y, werte: { ...y.werte, grenzwert: "höchstens +8 °C" } } : y)) } : x)) })),
    };
    const dokument: Vorlage = { ...haccp, html: (d, b) => haccp.html(d, b).replace("Gefahrenanalyse", "Gefahrenanalyse (geändert)") };
    for (const [name, v] of [["Hilfetext", hilfe], ["Grenzwert", grenzwert], ["Dokumenttext", dokument]] as const) {
      expect(f(v), name).not.toBe(basis);
      expect(vorlageGeprueft(v), name).toBeUndefined();
      expect(pruefHinweisFuer(v), name).toBe(PRUEFHINWEIS);
    }
  });

  it("Prüfsumme hängt nicht vom heutigen Datum ab", () => {
    vi.useFakeTimers();
    const werte: string[] = [];
    for (const tag of ["2026-10-23T08:00:00Z", "2031-03-01T12:00:00Z"]) {
      vi.setSystemTime(new Date(tag));
      werte.push(f(haccp));
    }
    vi.useRealTimers();
    expect(werte[0]).toBe(werte[1]);
    expect(werte[0]).toBe(PRUEFSTAENDE.haccp!.summe);
  });

  it("SHA-256 ohne Node-APIs stimmt mit node:crypto überein", () => {
    for (const t of ["", "abc", "Allergene und Zusatzstoffe – °C ≤ 𝄞", "x".repeat(10_000)]) expect(sha256(t)).toBe(createHash("sha256").update(t, "utf8").digest("hex"));
  });
});

describe("Mehrere Freigaben je Vorlage (je Fassung eigene Prüfsumme, 24.10.2026)", () => {
  const h = vorlageFuer("hygieneplan")!;
  const lm = VORLAGEN_GEPRUEFT.hygieneplan!;
  const BEAUTY = { fassung: { feld: "art", wert: "beauty" } };
  const UNTERSCHRIFT = { rolle: "recht" as const, unterschrieben_am: "2026-11-02", unterschrift: "test.jpg" };
  // erfundene, unterschriebene Freigaben – nur im Test, nicht in geprueft.ts
  const lmTest = { ...lm, ...UNTERSCHRIFT, rolle: "hygiene" as const, unterschrieben_am: "2026-10-23", pruefsumme: vorlagenPruefsumme({ ...h }, lm) };
  const beautyFreigabe = { stand: "2026-11-02", bezug: "Test", pruefsumme: vorlagenPruefsumme(h, BEAUTY), ...BEAUTY, ...UNTERSCHRIFT };
  const mitBeauty: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, weitere: [beautyFreigabe] } };

  it("Hygieneplan: Lebensmittel-Freigabe plus Beauty-Freigabe (Rechtsanwalt 25.10.2026), sonst keine weiteren", () => {
    expect(freigabenFuer("hygieneplan").length).toBe(2);
    expect(lm.weitere?.map((x) => [x.fassung?.wert, x.stand, x.einschraenkung])).toEqual([["beauty", "2026-10-25", "Länderzusatz nur für Bayern geprüft"]]);
    expect(freigabenFuer("bilanz_guv")).toHaveLength(1);
    expect(freigabenFuer("gibt_es_nicht")).toEqual([]);
    for (const id of Object.keys(VORLAGEN_GEPRUEFT)) if (id !== "hygieneplan") expect(VORLAGEN_GEPRUEFT[id]!.weitere, id).toBeUndefined();
  });

  it("je Fassung eine eigene Prüfsumme: Beauty unterscheidet sich von der Lebensmittel-Fassung", () => {
    expect(beautyFreigabe.pruefsumme).toMatch(/^[0-9a-f]{64}$/);
    expect(beautyFreigabe.pruefsumme).not.toBe(lmTest.pruefsumme);
  });

  it("Beauty-Vorschläge gehören nicht zur Lebensmittel-Freigabe: eine Änderung dort lässt deren Prüfsumme stehen", () => {
    const beauty: Vorlage = {
      ...h,
      abschnitte: h.abschnitte.map((a) => ({ ...a, felder: a.felder.map((x) => (x.art === "liste" && x.vorschlaege ? { ...x, vorschlaege: x.vorschlaege.map((y) => (y.gruppe === "Alle Beauty-Betriebe" ? { ...y, titel: `${y.titel} (geändert)` } : y)) } : x)) })),
    };
    expect(vorlagenPruefsumme(beauty, lm)).toBe(lmTest.pruefsumme);
  });

  it("vorlageGeprueft wählt die Freigabe, deren Fassung zu den Daten passt", () => {
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, mitBeauty)).toBe(mitBeauty.hygieneplan);
    expect(vorlageGeprueft(h, { art: "beauty" }, mitBeauty)).toBe(beautyFreigabe);
    expect(vorlageGeprueft(h, {}, mitBeauty)).toBeUndefined();
    expect(vorlageGeprueft(h, undefined, mitBeauty)).toBeUndefined();
    // geprueft.ts: ohne unterschriebenes Blatt kein Vermerk (E-196)
    expect(vorlageGeprueft(h, { art: "beauty" })).toBeUndefined();
    expect(vorlageGeprueft(h, { art: "lebensmittel" })).toBeUndefined();
  });

  it("passt die Prüfsumme einer Fassung nicht mehr, entfällt nur deren Vermerk", () => {
    const veraltet: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, weitere: [{ ...beautyFreigabe, pruefsumme: "0".repeat(64) }] } };
    expect(vorlageGeprueft(h, { art: "beauty" }, veraltet)).toBeUndefined();
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, veraltet)).toBe(veraltet.hygieneplan);
    const geaendert: Vorlage = { ...h, grundlageFuer: (d, b) => `${h.grundlageFuer!(d, b)}${d.art === "beauty" ? " (geändert)" : ""}` };
    expect(vorlageGeprueft(geaendert, { art: "beauty" }, mitBeauty)).toBeUndefined();
    expect(vorlageGeprueft(geaendert, { art: "lebensmittel" }, mitBeauty)).toBe(mitBeauty.hygieneplan);
  });

  it("ohne Unterschrift oder mit Stand nach der Unterschrift kein Vermerk", () => {
    const ohne: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, unterschrieben_am: null } };
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, ohne)).toBeUndefined();
    const spaeter: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, stand: "2026-10-24" } };
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, spaeter)).toBeUndefined();
  });

  it("Vermerk in der App: Stand und Rolle der passenden Freigabe", () => {
    const x = vorlageGeprueft(h, { art: "beauty" }, mitBeauty)!;
    expect(geprueftVermerk(x.stand, x)).toBe("Vorlage fachlich durchgesehen von einem Rechtsanwalt (Stand 02.11.2026)");
  });
});

describe("Nachkontrolle Lebensmittelfachbeauftragter (23.10.2026): Ergänzungen und Hinweise 1–5", () => {
  const html = (id: string) => {
    const v = vorlageFuer(id)!;
    return dokumentHtml(v, leereDaten(v, LEERER_BETRIEB, "2026-10-23"), LEERER_BETRIEB);
  };
  it("L-085 ohne „fachlich zu prüfen“; Klarspül-Korrekturmaßnahme im Hilfetext des Monatsrasters", () => {
    expect(VERIFIZIERUNG.find((o) => o.wert === "kontrollen")!.quelle).not.toMatch(/zu prüfen/);
    const raster = vorlageFuer("haccp")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "raster_geraete")!;
    expect(raster.hilfe).toContain("unter Richtwert: Geschirr erneut spülen, Gerät vom Kundendienst prüfen lassen.");
  });
  it("Hinweis 1: Hackfleisch-Fundstellen getrennt (zugekauft Nr. 3.3.1, eigene Herstellung Nr. 3.1.3)", () => {
    const punkte = vorlageFuer("haccp")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "punkte");
    const vs = punkte?.art === "liste" ? (punkte.vorschlaege ?? []) : [];
    expect(vs.find((x) => x.titel === "Kühlung Hackfleisch")!.quelle).toMatch(/^Tier-LMHV Anlage 5 Kap\. II Nr\. 3\.3\.1;/);
    expect(vs.find((x) => x.titel === "Kühlung Hackfleisch – nur bei eigener Herstellung")!.quelle).toMatch(/^Tier-LMHV Anlage 5 Kap\. II Nr\. 3\.1\.3;/);
  });
  it("Hinweise 3 und 5: Überschriften der Allergenliste und der CCP-Tabelle", () => {
    expect(html("allergene")).toContain("Allergene und Zusatzstoffe in unseren Speisen und Getränken</h1>");
    expect(html("haccp")).toContain("Kritische Kontrollpunkte (CCP) und Temperaturkontrollen (GHP)</h2>");
  });
});
