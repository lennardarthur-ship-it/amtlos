/**
 * E-220 (8b): Ausgegebene Unterlagen bleiben bei erneutem Öffnen, Teilen, Drucken und in Paketen unverändert
 * (§ 146 Abs. 4 AO, § 14b UStG) – auch wenn sich „Mein Betrieb“ (Anschrift, Steuernummer, Bank, Logo), der Pro-Stand
 * oder die Vorlage in einer späteren App-Version ändert. Nachgestellt: festschreiben, „Mein Betrieb“ ändern, erneut
 * wiedergeben (Vorschau, PDF, Paket, Archiv und Kontrollmappe nutzen `ausgabeHtml` bzw. `fassungHtml`).
 */
import { describe, expect, it } from "vitest";
import { KU_HINWEIS, LEERER_BETRIEB, dokumentHtml, eRechnungAus, vorlageFuer, xrechnungUbl, type Betrieb } from "@amtlos/fachlogik";
import { betriebFuerDokument } from "../src/pro/regeln";
import { LOGO_PLATZHALTER, ausgabeHtml, druckBetrieb, druckFesthalten, druckHtml, fassungHtml, nachgebildet } from "../src/unterlagen/ausgabe";
import { kompaktJson } from "../src/unterlagen/kompakt";
import { LEERER_STAND, anlegen, ausgeben, betriebSetzen, felderSetzen, geteilteFassungFestschreiben, kassenbuchFestschreiben, korrigieren, standAus, teilenOffenVermerken, unterlagenVereinen, type Stand } from "../src/unterlagen/speicher";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const ALT: Betrieb = { ...LEERER_BETRIEB, name: "Café Morgenrot", strasse: "Alte Gasse 1", plz: "10115", ort: "Berlin", verantwortlich: "Kim Morgen", telefon: "030 111", email: "info@morgenrot.example", steuernummer: "11/111/11111", ust_idnr: "DE111111111", iban: "DE89370400440532013000", bank: "Alte Bank", bundesland: "Berlin", logo: LOGO, farbe: "#1d4f7a" };
const NEU: Betrieb = { ...ALT, strasse: "Neue Allee 99", plz: "20095", ort: "Hamburg", steuernummer: "22/222/22222", ust_idnr: "DE222222222", iban: "DE02120300000000202051", bank: "Neue Bank", bundesland: "Hamburg", logo: "", farbe: "#7a1d1d" };
const BASIS: Stand = betriebSetzen(LEERER_STAND, ALT);

/** Rechnung anlegen und so festschreiben, wie es „PDF teilen“ tut (Abschluss.tsx): Absender und HTML wie gedruckt */
function rechnungTeilen(s0: Stand, pro: boolean, id = "r1"): { s: Stand; html: string } {
  let [s] = anlegen(s0, "rechnung", t("2026-03-01"), id);
  s = felderSetzen(s, id, { nummer: "2026-001", datum: "2026-03-01", kunde_email: "rechnung@nord.example", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafen 1\n20457 Hamburg", positionen: [{ bezeichnung: "Catering", menge: "1", preis: "300", satz: "19" }] }, t("2026-03-01"));
  const u = s.unterlagen.find((x) => x.id === id)!;
  const gedruckt = druckBetrieb(s, u, pro);
  const html = dokumentHtml(vorlageFuer("rechnung")!, u.daten, gedruckt);
  return { s: ausgeben(s, id, t("2026-03-02"), u.daten, "a".repeat(64), gedruckt, false, html), html };
}

describe("E-220 (8b): festgeschriebene Rechnung nach Änderung von „Mein Betrieb“", () => {
  it("Vorschau/PDF/Paket: gleiches HTML wie beim Teilen – Anschrift, Steuernummer, Bank und Logo von damals", () => {
    const { s, html } = rechnungTeilen(BASIS, true);
    const nachher = betriebSetzen(s, NEU);
    const u = nachher.unterlagen.find((x) => x.id === "r1")!;
    const wieder = ausgabeHtml(nachher, u, true);
    expect(wieder).toBe(html);
    expect(wieder).toContain("Alte Gasse 1");
    expect(wieder).toContain("11/111/11111");
    expect(wieder).toContain(LOGO);
    expect(wieder).not.toContain("Neue Allee");
    // auch ohne Pro (Abo beendet) bleibt das Logo, das auf der Rechnung stand
    expect(ausgabeHtml(nachher, u, false)).toBe(html);
  });

  it("ohne Pro festgeschrieben (ohne Logo gedruckt): später mit Pro erscheint kein Logo", () => {
    const { s, html } = rechnungTeilen(BASIS, false);
    expect(html).not.toContain(LOGO);
    const u = s.unterlagen.find((x) => x.id === "r1")!;
    expect(u.absenderGedruckt).toBe(true);
    expect(ausgabeHtml(betriebSetzen(s, NEU), u, true)).toBe(html);
    // die XRechnung ist das festgehaltene Original (unverändert seit R12)
    expect(u.xml).toBeTruthy();
    expect(u.xml).toBe(xrechnungUbl(eRechnungAus(u.daten, ALT).daten, KU_HINWEIS));
  });

  it("eine spätere App-Version mit anderem Vorlagentext ändert die Wiedergabe nicht (festgehaltenes HTML)", () => {
    const { s, html } = rechnungTeilen(BASIS, true);
    const u = s.unterlagen.find((x) => x.id === "r1")!;
    // Stand wie aus einer früheren Version: das festgehaltene HTML weicht vom heutigen Satz ab
    const alt = { ...u, druck: druckFesthalten(html.replace("Rechnungsnummer", "Rechnungs-Nr. (Fassung 2026)"), u.absender!.logo, u.druck!.am) };
    expect(ausgabeHtml(s, alt, true)).toContain("Rechnungs-Nr. (Fassung 2026)");
    expect(ausgabeHtml(s, alt, true)).not.toBe(dokumentHtml(vorlageFuer("rechnung")!, u.daten, u.absender!));
  });

  it("gespeichert, gesichert und wieder geladen: festgehaltenes HTML gleich; Stil und Logo nur einmal im Stand", () => {
    const { s: s1, html } = rechnungTeilen(BASIS, true, "r1");
    const { s: s2 } = rechnungTeilen(s1, true, "r2");
    const json = kompaktJson(s2);
    const geladen = standAus(json);
    expect(ausgabeHtml(geladen, geladen.unterlagen.find((x) => x.id === "r1")!, true)).toBe(html);
    const stil = html.match(/<style[\s\S]*?<\/style>/)![0];
    // je Rechnung ohne Stilblöcke und Logo (die stehen in der kompakten Schreibweise je einmal)
    expect(json.split(JSON.stringify(stil).slice(1, -1)).length - 1).toBe(1);
    // das Logo steht nur im festgehaltenen Absender (ein echtes Logo ist groß und steht dann ebenfalls nur einmal im Stand)
    expect(geladen.unterlagen.every((u) => !u.druck!.teile.join("").includes(LOGO))).toBe(true);
  });

  it("unlesbares festgehaltenes HTML fällt beim Laden weg (dann nachgebildet aus Daten und Absender)", () => {
    const { s } = rechnungTeilen(BASIS, true);
    const roh = JSON.parse(JSON.stringify(s));
    roh.unterlagen[0].druck = { am: "kein Datum", teile: [1, 2] };
    const g = standAus(JSON.stringify(roh));
    expect(g.unterlagen[0]!.druck).toBeUndefined();
    expect(nachgebildet(g.unterlagen[0]!)).toEqual({});
    expect(ausgabeHtml(betriebSetzen(g, NEU), g.unterlagen[0]!, true)).toContain("Alte Gasse 1");
  });

  it("Synchronisation: dieselbe festgeschriebene Rechnung ohne festgehaltenes Dokument (ältere App) verdrängt es nicht", () => {
    const { s, html } = rechnungTeilen(BASIS, true);
    const neu = s.unterlagen[0]!;
    const { druck: _d, absenderGedruckt: _g, ...alt } = neu;
    for (const [a, b] of [[neu, alt], [alt, neu]] as const) {
      const v = unterlagenVereinen(a, b);
      expect(v.kopie).toBeUndefined();
      expect(ausgabeHtml(betriebSetzen(s, NEU), v.u, false)).toBe(html);
    }
    // nachgetragener Absender gegen echten Schnappschuss: der echte gilt
    const nachgetragen = { ...alt, absender: NEU, absenderNachgetragen: "2026-10-27T10:00:00.000Z" };
    expect(unterlagenVereinen(nachgetragen, neu).u.absender?.strasse).toBe("Alte Gasse 1");
    expect(unterlagenVereinen(nachgetragen, neu).u.absenderNachgetragen).toBeUndefined();
  });

  it("Android „Doch verschickt – festschreiben“: festgeschrieben wird das HTML, das hinausging", () => {
    let [s] = anlegen(BASIS, "rechnung", t("2026-03-01"), "r1");
    s = felderSetzen(s, "r1", { nummer: "2026-001", datum: "2026-03-01", kunde_name: "A", kunde_anschrift: "Weg 1\n10115 Berlin", positionen: [{ bezeichnung: "X", preis: "10", satz: "19" }] }, t("2026-03-01"));
    const u = s.unterlagen[0]!;
    const html = dokumentHtml(vorlageFuer("rechnung")!, u.daten, ALT);
    s = teilenOffenVermerken(s, "r1", t("2026-03-02"), { daten: u.daten, art: "pdf", absender: ALT, druck: druckFesthalten(html, ALT.logo, t("2026-03-02").toISOString()) });
    s = betriebSetzen(s, NEU);
    s = geteilteFassungFestschreiben(s, "r1", t("2026-03-03"));
    expect(ausgabeHtml(s, s.unterlagen[0]!, true)).toBe(html);
  });
});

describe("E-220 (8b): Nachweise mit Fassungen und Kassenbuch", () => {
  it("Verfahrensdokumentation: Absender und HTML festgehalten; Korrektur – frühere Fassung wie damals, Entwurf mit heute", () => {
    let [s] = anlegen(BASIS, "verfahrensdokumentation", t("2026-01-15"), "vd");
    const u0 = s.unterlagen[0]!;
    const gedruckt = betriebFuerDokument(ALT, true);
    const html = dokumentHtml(vorlageFuer("verfahrensdokumentation")!, u0.daten, gedruckt);
    s = ausgeben(s, "vd", t("2026-01-16"), u0.daten, undefined, gedruckt, false, html);
    expect(s.unterlagen[0]!.absender?.strasse).toBe("Alte Gasse 1");
    s = betriebSetzen(s, NEU);
    expect(ausgabeHtml(s, s.unterlagen[0]!, true)).toBe(html);
    s = korrigieren(s, "vd", "Kassensystem gewechselt", t("2026-02-01"));
    const u = s.unterlagen[0]!;
    expect(u.festgeschrieben).toBeUndefined();
    expect(u.druck).toBeUndefined();
    expect(u.absender).toBeUndefined();
    // die abgelöste Fassung mit ihrem Absender und HTML
    expect(fassungHtml(s, "verfahrensdokumentation", u.fassungen![0]!, true)).toBe(html);
    // der Entwurf zeigt „Mein Betrieb“ von heute
    expect(ausgabeHtml(s, u, true)).toContain("Neue Allee 99");
  });

  it("vor E-220 festgeschrieben (ohne Absender): beim Laden mit Zeitpunkt nachgetragen, danach unabhängig von „Mein Betrieb“", () => {
    let [s] = anlegen(BASIS, "verfahrensdokumentation", t("2026-01-15"), "vd");
    s = ausgeben(s, "vd", t("2026-01-16"));
    const roh = JSON.parse(JSON.stringify(s));
    delete roh.unterlagen[0].absender;
    delete roh.unterlagen[0].druck;
    delete roh.unterlagen[0].absenderGedruckt;
    roh.unterlagen[0].fassungen = [{ daten: roh.unterlagen[0].daten, festgeschrieben: "2025-12-01T09:00:00.000Z", ersetzt: "2026-01-16T09:00:00.000Z" }];
    const g = standAus(JSON.stringify(roh));
    const u = g.unterlagen[0]!;
    expect(u.absender?.strasse).toBe("Alte Gasse 1");
    expect(u.absenderNachgetragen).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(u.fassungen![0]!.absender?.strasse).toBe("Alte Gasse 1");
    expect(nachgebildet(u)?.nachgetragen).toBe(u.absenderNachgetragen);
    const spaeter = betriebSetzen(g, NEU);
    expect(ausgabeHtml(spaeter, u, true)).toContain("Alte Gasse 1");
    expect(ausgabeHtml(spaeter, u, true)).not.toContain("Neue Allee");
    expect(fassungHtml(spaeter, "verfahrensdokumentation", u.fassungen![0]!, true)).toContain("Alte Gasse 1");
    // ein zweites Laden ändert nichts mehr
    expect(standAus(JSON.stringify(g)).unterlagen[0]!.absenderNachgetragen).toBe(u.absenderNachgetragen);
    // Entwürfe bekommen nichts
    const [e] = anlegen(BASIS, "verfahrensdokumentation", t("2026-01-15"), "e");
    expect(standAus(JSON.stringify(e)).unterlagen[0]!.absender).toBeUndefined();
  });

  it("Kassenbuch: Absender und HTML festgehalten, nach Korrektur bleibt die frühere Fassung wie damals", () => {
    const html = "<!doctype html><html><head><style>.a{color:red}</style></head><body>Kassenbuch April – Alte Gasse 1</body></html>";
    let s = kassenbuchFestschreiben(BASIS, "2026-04", "", { zeitraum: "April 2026", anfang: "200,00", eintraege: [] }, "abc", t("2026-04-02"), "kb", ALT, html);
    expect(druckHtml(s.unterlagen[0]!.druck!, s.unterlagen[0]!.absender)).toBe(html);
    s = betriebSetzen(s, NEU);
    s = kassenbuchFestschreiben(s, "2026-04", "", { zeitraum: "April 2026", anfang: "210,00", eintraege: [] }, "def", t("2026-04-04"), "kb2", NEU, html.replace("Alte Gasse 1", "Neue Allee 99"));
    const u = s.unterlagen[0]!;
    expect(fassungHtml(s, "kassenbuch", u.fassungen![0]!, true)).toBe(html);
    expect(ausgabeHtml(s, u, true)).toContain("Neue Allee 99");
  });
});

describe("E-220 (8b): festgehaltenes HTML", () => {
  it("Stilblöcke als eigene Teile, Logo als Platzhalter (kommt aus dem festgehaltenen Absender)", () => {
    const html = `<html><head><style>.x{}</style></head><body><img src="${LOGO}">Text<style>.y{}</style></body></html>`;
    const d = druckFesthalten(html, LOGO, "2026-01-01T00:00:00.000Z");
    expect(d.teile.filter((x) => x.startsWith("<style"))).toEqual(["<style>.x{}</style>", "<style>.y{}</style>"]);
    expect(d.teile.join("")).not.toContain(LOGO);
    expect(d.teile.join("")).toContain(LOGO_PLATZHALTER);
    expect(druckHtml(d, { logo: LOGO })).toBe(html);
  });
});
