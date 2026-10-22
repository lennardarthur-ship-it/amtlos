/** Befunde R12 (UX, Bäckerei, Kfz, Kurier, Coach, Recht): Rechnung, Fußzeile, Vorlagen für Werkstatt, Bäckerei, Kurier, Coach. */
import { describe, expect, it } from "vitest";
import { GMBH_ANGABEN, dokumentHtml, fehlendeAngaben, fussSpalten, gmbhAngabenFehlen, gruppenFuerBetrieb, istPrivatperson, leereDaten, neuerEintrag, optionSichtbar, profilStartwerte, standardAnrede, vertretungLabel, vorlageFuer, type Betrieb, type Daten, type ListenFeld } from "../src/index.js";

const B: Betrieb = { name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", verantwortlich: "Alex Muster", telefon: "089 1", email: "info@salon.example", steuernummer: "143/123/45678", ust_idnr: "", iban: "DE02120300000000202051", bundesland: "Bayern" };
const v = (id: string) => vorlageFuer(id)!;
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ");
const html = (id: string, d: Daten, b: Betrieb = B) => glatt(dokumentHtml(v(id), { ...leereDaten(v(id), b, "2026-10-21"), ...d }, b));
const RE: Daten = { nummer: "2026-050", datum: "2026-10-21", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Lea Schmitz", kunde_anschrift: "Am Markt 1\n80331 München", positionen: [{ bezeichnung: "Brautfrisur", menge: "1", einheit: "Pauschale", preis: "380", satz: "19" }] };

describe("Rechnung R12", () => {
  it("Anrede: Privatperson „Guten Tag …“, Firma „Sehr geehrte Damen und Herren“ (UX #15)", () => {
    expect(istPrivatperson("Lea Schmitz")).toBe(true);
    expect(istPrivatperson("Muster GmbH")).toBe(false);
    expect(istPrivatperson("Stadt Regensburg")).toBe(false);
    expect(istPrivatperson("Kita Sonnenschein")).toBe(false);
    expect(standardAnrede("Lea  Schmitz")).toBe("Guten Tag Lea Schmitz");
    expect(html("rechnung", RE)).toContain("Guten Tag Lea Schmitz,");
    expect(html("rechnung", { ...RE, kunde_name: "Studio Nord GmbH" })).toContain("Sehr geehrte Damen und Herren,");
  });
  it("Bruttopreise: sichtbar, im Salon und Café vorbelegt, bei reinen Privatkunden aus dem Check; nicht bei Kleinunternehmern (UX #5, Coach #18)", () => {
    const f = v("rechnung").abschnitte.flatMap((a) => a.felder).find((x) => x.id === "preise_brutto")!;
    expect(f.selten).toBeFalsy();
    expect(leereDaten(v("rechnung"), B, "2026-10-21", ["friseur"]).preise_brutto).toBe(true);
    expect(leereDaten(v("rechnung"), B, "2026-10-21", ["handwerk_allgemein"]).preise_brutto).toBe(false);
    expect(profilStartwerte(v("rechnung"), { "kunden.segmente": ["b2c"], "ust.kleinunternehmer": false })).toEqual({ preise_brutto: true });
    expect(profilStartwerte(v("rechnung"), { "kunden.segmente": ["b2b", "b2c"] })).toEqual({});
    expect(f.wenn).toEqual({ feld: "kleinunternehmer", nicht: true });
  });
  it("Einheit je Branche, Steuersatz wie die letzte Position (UX #14, Bäckerei #15)", () => {
    const pos = v("rechnung").abschnitte.flatMap((a) => a.felder).find((x) => x.id === "positionen") as ListenFeld;
    expect(neuerEintrag(pos, B, "2026-10-21", ["friseur"]).einheit).toBe("Pauschale");
    expect(neuerEintrag(pos, B, "2026-10-21", ["handwerk_allgemein"]).einheit).toBe("Stunde");
    expect(neuerEintrag(pos, B, "2026-10-21", []).einheit).toBe("Stück");
    expect(neuerEintrag(pos, B, "2026-10-21", [], { satz: "7" }).satz).toBe("7");
    expect(html("rechnung", { ...RE, positionen: [{ bezeichnung: "Färben", menge: "3", einheit: "Stunde", preis: "68", satz: "19" }] })).toContain("3 Stunden");
  });
  it("Kopfblock: Nummer, Rechnungsdatum, Leistungsdatum, Steuernummer (UX #16)", () => {
    const info = /<div class="info"><table>(.*?)<\/table>/.exec(html("rechnung", RE))![1]!;
    const k = [...info.matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1]).filter((_, i) => i % 2 === 0);
    expect(k.slice(0, 4)).toEqual(["Rechnungsnummer", "Rechnungsdatum", "Leistungsdatum", "Steuernummer"]);
  });
  it("Vorauszahlung: kein Leistungsdatum gleich Rechnungsdatum; Kleinbetrag ohne Leistungsdatum (Coach #6)", () => {
    const karte = { ...RE, kunde_name: "", kunde_anschrift: "", vorauszahlung: true, bezahlt_am: "2026-10-21", positionen: [{ bezeichnung: "10er-Karte Yoga", menge: "1", preis: "120", satz: "19" }] };
    const h = html("rechnung", karte);
    expect(h).toContain("folgt (Vorauszahlung)");
    expect(h).toContain("Zahlung erhalten");
    expect(h).not.toMatch(/Leistungsdatum<\/td><td>21\.10\.2026/);
    expect(fehlendeAngaben(v("rechnung"), karte as never, B)).not.toContain("Datum oder Zeitraum der Leistung");
    expect(html("rechnung", { ...RE, positionen: [{ bezeichnung: "Haarschnitt", menge: "1", preis: "38", satz: "19" }] })).not.toContain("Leistungsdatum");
  });
  it("Hinweise: Monat in der Position, Grundstück nur Bau/Ausbau an Privat und nicht bei Fahrzeugen (Bäckerei #14/#15, Kfz #11)", () => {
    const h = v("rechnung").hinweise!({ ...RE, positionen: [{ bezeichnung: "Brötchenlieferung Oktober", menge: "1", preis: "300", satz: "7" }] }, B);
    expect(h.some((x) => x.includes("„Oktober“"))).toBe(true);
    const grund = (d: Daten, b: Betrieb = B) => v("rechnung").hinweise!(d, b, { handwerk: true }).some((x) => x.startsWith("Leistung an einem Grundstück"));
    expect(grund(RE)).toBe(true);
    expect(grund({ ...RE, positionen: [{ bezeichnung: "Inspektion Pkw", menge: "1", preis: "300", satz: "19" }] })).toBe(false);
    expect(grund(RE, { ...B, name: "Aydın Autotechnik GmbH" })).toBe(false);
  });
  it("Kleinunternehmer: igL und § 13b nur in Ausnahmefällen sichtbar, E-Rechnung „möglich, aber keine Pflicht“ (Coach #18/#19)", () => {
    const hw = v("rechnung").abschnitte.flatMap((a) => a.felder).find((x) => x.id === "hinweise") as { optionen: { wert: string; wenn?: unknown }[] };
    const o = (w: string) => hw.optionen.find((x) => x.wert === w)! as never;
    expect(optionSichtbar(o("igl"), { kleinunternehmer: true })).toBe(false);
    expect(optionSichtbar(o("igl"), { kleinunternehmer: false })).toBe(true);
    expect(optionSichtbar(o("reverse_charge"), { kleinunternehmer: true })).toBe(false);
    expect(optionSichtbar(o("reverse_charge"), { kleinunternehmer: true, kunde_ust_idnr: "ATU12345678" })).toBe(true);
    expect(v("rechnung").abschnitte[0]!.hilfe).toContain("§ 34a UStDV");
  });
  it("GmbH ohne Registerangaben: § 35a GmbHG fehlt (Kfz #6)", () => {
    const g: Betrieb = { ...B, name: "Aydın Autotechnik GmbH", rechtsform: "GmbH" };
    expect(gmbhAngabenFehlen(g)).toHaveLength(3);
    expect(fehlendeAngaben(v("rechnung"), RE, g).filter((x) => x.includes(GMBH_ANGABEN))).toHaveLength(3);
    expect(gmbhAngabenFehlen({ ...g, registergericht: "Amtsgericht Duisburg", registernummer: "HRB 1", vertretung: "Serkan Aydın" })).toEqual([]);
    expect(gmbhAngabenFehlen(B)).toEqual([]);
  });
  it("Fußzeile: e. K. mit „Inhaber/in“, GmbH mit Rechtsform und Sitz (Bäckerei #14)", () => {
    expect(vertretungLabel("e. K.")).toBe("Inhaber/in");
    expect(vertretungLabel("GmbH")).toBe("Geschäftsführung");
    const ek = fussSpalten({ ...B, name: "Bäckerei Seidl", rechtsform: "e. K.", registergericht: "Amtsgericht Regensburg", registernummer: "HRA 1", vertretung: "Markus Seidl" }).flat();
    expect(ek).toContain("Inhaber/in: Markus Seidl");
    expect(ek.join(" ")).not.toContain("Geschäftsführung");
    const gmbh = fussSpalten({ ...B, name: "Aydın Autotechnik", rechtsform: "GmbH", registergericht: "Amtsgericht Duisburg", registernummer: "HRB 2", vertretung: "Serkan Aydın", ort: "Duisburg" }).flat();
    expect(gmbh).toContain("GmbH, Sitz Duisburg, Amtsgericht Duisburg HRB 2");
  });
  it("Anlage als Vermerk (Kurier #21)", () => {
    expect(html("rechnung", { ...RE, anlage: "Tourenliste Oktober" })).toContain("Anlage: Tourenliste Oktober");
  });
});

describe("Vorlagen R12", () => {
  it("Gefährdungen und Unterweisung für Werkstatt, Bäckerei und Kurier (Kfz #3, Bäckerei #6, Kurier #9/#10)", () => {
    const gb = (v("gefaehrdungsbeurteilung").abschnitte.flatMap((a) => a.felder).find((x) => x.id === "gefaehrdungen") as ListenFeld).vorschlaege!;
    for (const [gruppe, n] of [["Kfz-Werkstatt", 12], ["Bäckerei", 6], ["Transport / Kurier", 10]] as const) expect(gb.filter((x) => x.gruppe === gruppe).length, gruppe).toBe(n);
    expect(gb.find((x) => x.titel.startsWith("Abgase von Dieselmotoren"))!.quelle).toBe("TRGS 554; § 10a GefStoffV");
    expect(gb.filter((x) => x.gruppe === "Kfz-Werkstatt").some((x) => /fachlich zu prüfen/.test(x.quelle ?? ""))).toBe(true);
    const themen = (v("unterweisung").abschnitte.flatMap((a) => a.felder).find((x) => x.id === "themen") as { optionen: { wert: string; gruppen?: string[] }[] }).optionen;
    expect(themen.filter((t) => t.gruppen?.includes("transport")).map((t) => t.wert)).toContain("fahrer_eignung");
    const sprache = v("unterweisung").abschnitte.flatMap((a) => a.felder).find((x) => x.id === "sprache") as { vorschlaege: string[] };
    expect(sprache.vorschlaege).toContain("Dari/Farsi");
    expect(gruppenFuerBetrieb(["transport_logistik"])).toEqual(["transport"]);
    expect(gruppenFuerBetrieb(["handwerk"], "Aydın Autotechnik GmbH")).toEqual(["handwerk_allgemein", "kfz_werkstatt"]);
    expect(gruppenFuerBetrieb(["handwerk", "gastronomie_lebensmittel"])).toContain("baeckerei");
  });
  it("Hinweisschild Videoüberwachung mit zweiter Ebene (Kfz #8)", () => {
    const h = html("video_hinweisschild", { bereich: "Werkstatthof", zwecke: "Schutz vor Einbruch", interessen: "frühere Einbrüche", beschaeftigte: true });
    expect(v("video_hinweisschild").pflichten).toEqual(["datenschutz.videoueberwachung"]);
    expect(h).toContain("Dieser Bereich wird videoüberwacht: Werkstatthof");
    expect(h).toContain("Art. 6 Abs. 1 lit. f DSGVO");
    expect(h).toContain("72 Stunden");
    expect(h).toContain("auch Beschäftigte");
    expect(h).toContain("Information nach Art. 13 DSGVO zur Videoüberwachung");
    expect(h).toContain("fachlich zu prüfen");
  });
  it("Anamnese neutral: Kurs, Speicherdauer, Datenschutzinformation, leer ohne Datum, elektronisch (Coach #8/#9)", () => {
    expect(v("anamnese_einwilligung").bereich).toBe("datenschutz");
    const kurs = html("anamnese_einwilligung", { art: "kurs", name: "Kim", angaben: "" });
    expect(kurs).toContain("für meine Kursteilnahme");
    expect(kurs).toContain("Herz-Kreislauf");
    expect(kurs).toContain("Speicherung:");
    expect(kurs).toContain("Datenschutzinformation");
    const leer = html("anamnese_einwilligung", {});
    expect(leer).not.toContain("21.10.2026");
    const online = html("anamnese_einwilligung", { name: "Kim", elektronisch: true });
    expect(online).toContain("elektronisch erteilt");
    expect(online).not.toContain("Unterschrift Kundin/Kunde");
  });
  it("Datenschutzerklärung: Videokonferenz, Zahlungsdienstleister, § 257 HGB nur für Kaufleute, Hinweis ohne Hosting (Coach #10/#16/#17)", () => {
    const d = { module: ["kontakt", "videokonferenz", "zahlungsdienstleister"], video_anbieter: "Zoom Communications", video_anschrift: "San José, USA", video_drittland: "den USA", video_garantie: "scc", zahlung_anbieter: "PayPal (Europe)", zahlung_anschrift: "Luxemburg" };
    const h = html("datenschutzerklaerung_website", d);
    expect(h).toContain("Online-Kurse und Beratungen per Videokonferenz");
    expect(h).toContain("EU-Standardvertragsklauseln");
    expect(h).toContain("Zahlungsdienstleister");
    expect(h).not.toContain("§ 257 HGB");
    expect(html("datenschutzerklaerung_website", d, { ...B, rechtsform: "GmbH", registernummer: "HRB 1" })).toContain("§ 257 HGB");
    expect(fehlendeAngaben(v("datenschutzerklaerung_website"), d as never, B).some((x) => x.startsWith("Hosting nicht gewählt"))).toBe(true);
  });
  it("Impressum: Inhaber/in aus „Mein Betrieb“, Rechtsform aus dem Check (Coach #15)", () => {
    expect(profilStartwerte(v("impressum"), { rechtsform: "freiberuf" }, B)).toEqual({ rechtsform: "Einzelunternehmen", vertreten: "Alex Muster" });
    expect(profilStartwerte(v("impressum"), {}, { ...B, vertretung: "Alex Muster, Kim Muster" }).vertreten).toBe("Alex Muster, Kim Muster");
  });
  it("Handelsregister: GmbH mindestens 25.000 € in vollen Euro, UG ab 1 € (Recht #16)", () => {
    const p = (rechtsform: string, kapital: string) => v("handelsregister").pruefen!({ rechtsform, kapital }, B);
    expect(p("GmbH", "12.345,67")).toHaveLength(2);
    expect(p("GmbH", "25.000")).toEqual([]);
    expect(p("UG (haftungsbeschränkt)", "1")).toEqual([]);
    expect(p("UG (haftungsbeschränkt)", "0,50")).toHaveLength(2);
  });
});
