/**
 * E-202: zweite Antworten der Prüfer vom 26.10.2026 – Fachlogik.
 * - Hygieneplan Friseur/Kosmetik: Die App bietet in dieser Fassung nie Zeilen eines Lebensmittelbetriebs an (Befund: das
 *   Beispiel-PDF „auswahl“ zeigte den Plan eines Lebensmittelbetriebs, weil das Werkzeug die Art des Betriebs umschaltete).
 * - XRechnung des Stornos einer Schlussrechnung: Anmerkung (BT-22) mit den Sätzen vom PDF, Verweis mit Datum (BT-26).
 * - Website-Datenschutzerklärung, Hinweisschild Video, Arbeitsschutz-Bausteine: „fachlich zu prüfen“ nur noch bei B-105.
 */
import { describe, expect, it } from "vitest";
import { HYGIENE_LM_GRUPPEN, KU_HINWEIS, LEERER_BETRIEB, PRUEFSTAENDE, VORLAGEN_GEPRUEFT, dokumentHtml, eRechnungAus, eintragAusVorschlag, freigabenFuer, leereDaten, passendeVorschlaege, vorlageFuer, xrechnungUbl, type Betrieb, type Daten, type ListenFeld } from "../src/index.js";
import { sichtbarerText } from "../src/dokumente/geprueft.js";

const SALON: Betrieb = { ...LEERER_BETRIEB, name: "Salon Sonne GmbH", rechtsform: "GmbH", strasse: "Hauptstraße 1", plz: "80331", ort: "München", bundesland: "Bayern", verantwortlich: "Alex Sonnberg" };
const hp = vorlageFuer("hygieneplan")!;
const eintraege = hp.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "eintraege") as ListenFeld;
/** sichtbarer Text mit normalen Leerzeichen (statt &nbsp; bzw. U+00A0) */
const klar = (html: string) => sichtbarerText(html).replace(/&nbsp;|\u00a0/g, " ");
const LM_TEXT = /852\/2004|LMHV|Schankanlage|Backwaren|Konditorei|Lebensmittel/;

describe("E-202: Hygieneplan Friseur/Kosmetik nie mit Bausteinen eines Lebensmittelbetriebs", () => {
  it("Fassung „beauty“ (Startwert): die App bietet nur Beauty-Vorschläge an – keine Gruppe eines Lebensmittelbetriebs", () => {
    const d = leereDaten(hp, SALON, "2026-10-26");
    expect(d.art).toBe("beauty");
    const vs = passendeVorschlaege(hp, eintraege, d);
    expect(vs.length).toBeGreaterThan(10);
    expect(vs.filter((v) => HYGIENE_LM_GRUPPEN.includes(v.gruppe ?? ""))).toEqual([]);
    expect(vs.length + (eintraege.vorschlaege ?? []).filter((v) => HYGIENE_LM_GRUPPEN.includes(v.gruppe ?? "")).length).toBe(eintraege.vorschlaege!.length);
  });

  it("„Alle übernehmen“ in der Fassung „beauty“ ergibt einen Plan ohne Lebensmittel-Inhalte (VO 852/2004, LMHV, Schankanlage, Backwaren, Konditorei)", () => {
    const d: Daten = { ...leereDaten(hp, SALON, "2026-10-26"), bereich: "Friseursalon und Kosmetik" };
    d.eintraege = passendeVorschlaege(hp, eintraege, d).map((v) => eintragAusVorschlag(eintraege, v, SALON, "2026-10-26"));
    const text = klar(dokumentHtml(hp, d, SALON));
    expect(text).toContain("Hygieneverordnung des Landes (§ 17 Abs. 4 IfSG)");
    expect(text).not.toMatch(LM_TEXT);
    expect(hp.hinweise!(d, SALON)).toEqual([]);
  });

  it("Fassung „lebensmittel“: nur die Gruppen „Gastronomie / Café“, „Bäckerei“ und „Foodtruck / mobiler Verkauf“", () => {
    const vs = passendeVorschlaege(hp, eintraege, { art: "lebensmittel" });
    expect(new Set(vs.map((v) => v.gruppe))).toEqual(new Set(HYGIENE_LM_GRUPPEN));
  });

  it("Zeilen eines Lebensmittelbetriebs im Plan eines Beauty-Betriebs (z. B. aus älteren Plänen) – die App weist darauf hin", () => {
    const lm = (eintraege.vorschlaege ?? []).filter((v) => HYGIENE_LM_GRUPPEN.includes(v.gruppe ?? "")).slice(0, 2).map((v) => eintragAusVorschlag(eintraege, v, SALON, "2026-10-26"));
    const h = hp.hinweise!({ art: "beauty", eintraege: lm }, SALON);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatch(/gehören in einen Lebensmittelbetrieb/);
  });

  it("die Regel ist eine Funktion – Prüfsumme der Beauty-Fassung unverändert (e1cf092f9b77, Zuordnung 101632b4de7a → e1cf092f9b77)", () => {
    const beauty = freigabenFuer("hygieneplan")[1]!;
    expect(beauty.pruefsumme_alt!.slice(0, 12)).toBe("101632b4de7a");
    expect(PRUEFSTAENDE["hygieneplan#1"]!.summe.slice(0, 12)).toBe("e1cf092f9b77");
    expect(beauty.pruefsumme.slice(0, 12)).toBe("e1cf092f9b77");
    // bleibt bis zur Bestätigung des Rechtsanwalts, wie es ist (Stand 25.10.2026, Länderzusatz nur für Bayern)
    expect([beauty.stand, beauty.einschraenkung]).toEqual(["2026-10-25", "Länderzusatz nur für Bayern geprüft"]);
  });
});

describe("E-202: XRechnung des Stornos einer Schlussrechnung (Steuerberater, vorab freigegeben)", () => {
  const B: Betrieb = { ...LEERER_BETRIEB, name: "Innenausbau Muster GmbH", rechtsform: "GmbH", registergericht: "Amtsgericht Hamburg", registernummer: "HRB 123456", vertretung: "Jana Holm", strasse: "Werftstraße 5", plz: "20457", ort: "Hamburg", telefon: "+49 40 1234567", email: "info@innenausbau-muster.example", steuernummer: "22/123/45678", ust_idnr: "DE123456789", iban: "DE02120300000000202051", bundesland: "Hamburg" };
  const KUNDE = { kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "rechnung@agentur-nord.example" };
  const ABSCHLAEGE = [{ nummer: "2026-010", datum: "01.08.2026", netto: "4.000,00", satz: "19" }, { nummer: "2026-021", datum: "01.09.2026", netto: "2.000,00", satz: "19" }];
  const pos = (v: number) => [{ bezeichnung: "Innenausbau Büroetage 2. OG", menge: "1", einheit: "Pauschale", preis: `${v < 0 ? "-" : ""}8.500,00`, satz: "19" }, { bezeichnung: "Einbauschränke Empfang, Eiche", menge: "1", einheit: "Pauschale", preis: `${v < 0 ? "-" : ""}1.500,00`, satz: "19" }];
  const SCHLUSS: Daten = { nummer: "2026-035", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", schluss: true, abschlaege: ABSCHLAEGE, ...KUNDE, positionen: pos(1) };
  const STORNO: Daten = { ...SCHLUSS, nummer: "2026-041", datum: "2026-10-20", storno_zu: "2026-035", storno_zu_datum: "2026-10-12", storno_abschlaege: true, positionen: pos(-1) };
  const SATZ = "Diese Rechnung storniert die Rechnung Nr. 2026-035 vom 12.10.2026. Storniert wird nur der Restbetrag der Schlussrechnung Nr. 2026-035. Die Abschlagsrechnungen Nr. 2026-010 vom 01.08.2026 über 4.760,00 € und Nr. 2026-021 vom 01.09.2026 über 2.380,00 € bleiben bestehen.";
  const xml = (d: Daten) => {
    const { daten, fehlt } = eRechnungAus(d, B);
    expect(fehlt).toEqual([]);
    return xrechnungUbl(daten, KU_HINWEIS);
  };

  it("BT-22 = die Sätze vom PDF (nicht „Abgesetzte Abschlagsrechnungen … Bereits gezahlt“ der Schlussrechnung)", () => {
    const x = xml(STORNO);
    const notizen = [...x.matchAll(/<cbc:Note>([^<]*)<\/cbc:Note>/g)].map((m) => m[1]);
    // E-203: in der XML zusätzlich der stornierte Restbetrag in Zahlen (Anregung des Steuerberaters)
    expect(notizen).toEqual([SATZ.replace("Schlussrechnung Nr. 2026-035.", "Schlussrechnung Nr. 2026-035 – Entgelt −4.000,00 €, Umsatzsteuer −760,00 €.")]);
    expect(x).not.toContain("Abgesetzte Abschlagsrechnungen");
    expect(x).not.toContain("Bereits gezahlt");
    // gleicher Wortlaut wie auf dem PDF: Satz unter dem Betreff und Schlusssatz
    const pdf = klar(dokumentHtml(vorlageFuer("rechnung")!, STORNO, B)).replace(/\s+/g, " ");
    for (const s of SATZ.split(/(?<=\.) (?=Storniert|Die Abschlag)/)) expect(pdf).toContain(s);
  });

  it("BT-26: Verweis auf die stornierte Rechnung mit ihrem Datum; Beträge unverändert (BT-113 negativ)", () => {
    const x = xml(STORNO);
    expect(x).toMatch(/<cac:InvoiceDocumentReference>\s*<cbc:ID>2026-035<\/cbc:ID>\s*<cbc:IssueDate>2026-10-12<\/cbc:IssueDate>\s*<\/cac:InvoiceDocumentReference>/);
    // die Abschlagsrechnungen bleiben als Verweis ohne Datum (nicht verlangt)
    expect(x).toMatch(/<cbc:ID>2026-010<\/cbc:ID>\s*<\/cac:InvoiceDocumentReference>/);
    expect([...["TaxInclusiveAmount", "PrepaidAmount", "PayableAmount"].map((t) => new RegExp(`<cbc:${t}[^>]*>([^<]*)<`).exec(x)?.[1])]).toEqual(["-11900.00", "-7140.00", "-4760.00"]);
    expect(x).toContain("<cbc:InvoiceTypeCode>384</cbc:InvoiceTypeCode>");
  });

  it("einfaches Storno: Datum im Verweis, Anmerkung wie bisher; Schlussrechnung selbst unverändert", () => {
    const einfach = xml({ nummer: "2026-050", datum: "2026-10-20", leistung_gleich: true, zahlungsziel: "14", storno_zu: "2026-049", storno_zu_datum: "2026-10-15", ...KUNDE, positionen: [{ bezeichnung: "Catering", menge: "1", einheit: "Pauschale", preis: "-100,00", satz: "19" }] });
    expect(einfach).toMatch(/<cbc:ID>2026-049<\/cbc:ID>\s*<cbc:IssueDate>2026-10-15<\/cbc:IssueDate>/);
    expect(einfach).not.toContain("Storniert wird nur");
    const s = xml(SCHLUSS);
    expect(s).toContain("Abgesetzte Abschlagsrechnungen (§ 14 Abs. 5 Satz 2 UStG)");
    expect(s).not.toContain("<cbc:IssueDate>2026-08-01</cbc:IssueDate>");
  });

  it("die Änderungen betreffen nur die XML – die Prüfsumme der Rechnung bleibt (Gesamtsumme 75a201030d66 wie bei der Nachprüfung)", () => {
    // E-208: seitdem hat sich nur der gemeinsame Teil (`basis`, Einzelpreis bei Bruttopreisen) geändert – alle übrigen
    // Teilsummen sind die der Nachprüfung vom 26.10.2026 (Gesamtsumme damals 75a201030d66)
    const storno = freigabenFuer("rechnung")[2]!;
    expect(storno.pruefsumme.slice(0, 12)).toBe("75a201030d66");
    expect(Object.keys(storno.teilsummen!).filter((g) => PRUEFSTAENDE.rechnung!.teile[g] !== storno.teilsummen![g])).toEqual(["basis"]);
    expect([storno.stand, storno.rolle, storno.nachweis!.datum]).toEqual(["2026-10-26", "steuern", "2026-10-26"]);
  });
});

describe("E-202: „fachlich zu prüfen“ – nur noch B-105", () => {
  it("Website-Datenschutzerklärung: Videokonferenz und Zahlungsdienstleister ohne Vermerk, „in der Regel in eigener Verantwortung“", () => {
    expect(PRUEFSTAENDE.datenschutzerklaerung_website!.offen).toBe(0);
    const v = vorlageFuer("datenschutzerklaerung_website")!;
    const d: Daten = { ...leereDaten(v, SALON, "2026-10-26"), module: ["zahlungsdienstleister", "videokonferenz"], zahlung_anbieter: "Beispiel Pay", zahlung_anschrift: "Musterweg 1, Berlin", video_anbieter: "Beispiel Video", video_anschrift: "Musterweg 2, Berlin" };
    const t = klar(dokumentHtml(v, d, SALON));
    expect(t).toContain("Der Zahlungsdienstleister verarbeitet die Daten in der Regel in eigener Verantwortung;");
    expect(t).not.toContain("fachlich zu prüfen");
  });

  it("Hinweisschild Video: Hilfetext ohne „– fachlich zu prüfen“, gedruckt kein Schlusssatz mit Prüfvermerk", () => {
    const v = vorlageFuer("video_hinweisschild")!;
    expect(v.abschnitte[0]!.hilfe).toBe("Das Schild hängt gut sichtbar, bevor man den überwachten Bereich betritt. Die zweite Seite hängst du daneben aus oder hältst sie bereit (z. B. an der Kasse). Muster nach der Datenschutzkonferenz.");
    const t = klar(dokumentHtml(v, leereDaten(v, SALON, "2026-10-26"), SALON));
    expect(t).not.toMatch(/fachlich zu prüfen|Orientierungshilfe/);
    expect(PRUEFSTAENDE.video_hinweisschild!.offen).toBe(0);
  });

  it("Arbeitsschutz: von 41 markierten Bausteinen nur B-105 (Nadelstichverletzungen) offen – Unterweisung und Hautschutzplan ohne offene Stellen", () => {
    expect(PRUEFSTAENDE.unterweisung!.offen).toBe(0);
    expect(PRUEFSTAENDE.hautschutzplan!.offen).toBe(0);
    expect(PRUEFSTAENDE.gefaehrdungsbeurteilung!.offen).toBe(1);
    const gb = vorlageFuer("gefaehrdungsbeurteilung")!.abschnitte.flatMap((a) => a.felder).flatMap((f) => (f.art === "liste" ? (f.vorschlaege ?? []) : []));
    expect(gb.filter((x) => /fachlich zu prüfen/.test(x.quelle ?? "")).map((x) => x.titel)).toEqual(["Stich- und Schnittverletzungen durch gebrauchte Kanülen und scharfe Instrumente (Nadelstichverletzungen)."]);
  });

  it("die neuen Fassungen sind als vorab freigegeben eingetragen – mit der Rolle, die die Änderung erlaubt hat", () => {
    for (const [id, rolle] of [["unterweisung", "arbeitsschutz"], ["hautschutzplan", "arbeitsschutz"], ["gefaehrdungsbeurteilung", "arbeitsschutz"], ["datenschutzerklaerung_website", "recht"], ["video_hinweisschild", "recht"]] as const) {
      const neu = freigabenFuer(id).at(-1)!;
      expect([neu.stand, neu.rolle, neu.nachweis!.art, neu.nachweis!.datum], id).toEqual(["2026-10-26", rolle, "mail", "2026-10-26"]);
      expect(neu.pruefsumme, id).toBe(PRUEFSTAENDE[`${id}#1`]!.summe);
    }
    // die sieben Arbeitsschutz-Vorlagen: Vermerk nicht mehr ausgesetzt, Stand 26.10.2026, frühere Bestätigung als weiterer Nachweis
    for (const id of ["unterweisung", "pruefprotokoll_elektro", "betriebsanweisung", "expositionsverzeichnis", "hautschutzplan", "gefaehrdungsbeurteilung", "betriebsanweisung_biostoffe"]) {
      const f = VORLAGEN_GEPRUEFT[id]!;
      expect(f.vermerk_ausgesetzt, id).toBeUndefined();
      expect([f.stand, f.bestaetigt_am, f.nachweis!.datum], id).toEqual(["2026-10-26", "2026-10-26", "2026-10-26"]);
      expect(f.weitere_nachweise?.length, id).toBe(1);
    }
    // Rechtsanwalt: Geschäftsbrief-Angaben der Co.-KG-Varianten als zweite Bestätigung (nur Nachweis, Vermerk bleibt beim Steuerberater)
    const kg = freigabenFuer("rechnung")[1]!;
    expect(kg.weitere_nachweise?.map((n) => [n.rolle, n.datum])).toEqual([["recht", "2026-10-26"]]);
    expect(kg.weitere_nachweise![0]!.umfang).toMatch(/23c88b1f276727cac2d24354.*812e83e7dd0d3ece9374f9c6/);
  });
});
