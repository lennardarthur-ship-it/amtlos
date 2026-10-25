/**
 * Rückmeldungen Runde 3 (24.10.2026): Rechtsanwalt (Fachfragen, docs/pruefberichte/2026-10-24-runde3-fachfragen-recht.xlsx)
 * zu B-276 und zum Hygieneplan Beauty; Steuerberater (docs/pruefberichte/2026-10-24-runde3-vorlagen-steuern.xlsx) zu Bilanz/GuV.
 */
import { describe, expect, it } from "vitest";
import {
  BILANZ_ANHANG, BILANZ_OHNE_ANHANG, BILANZ_UNTERSCHRIFT, BILANZ_UNTERSCHRIFT_GMBH_CO_KG, VORLAGEN_GEPRUEFT, dokumentHtml, leereDaten, ohneVerdeckteFelder, profilStartwerte, sichtbar as feldSichtbar,
  vorlageFuer, vorlagenPruefsumme, type Betrieb, type Daten,
} from "../src/index.js";
import { HYGIENE } from "../src/dokumente/bausteine.js";
import { BILANZ_KLEINST } from "../src/dokumente/buchhaltung.js";

const B: Betrieb = { name: "Muster", strasse: "Weg 2", plz: "72764", ort: "Reutlingen", verantwortlich: "Ole Holm", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Baden-Württemberg" };
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ");
const html = (id: string, d: Daten, b: Betrieb = B) => glatt(dokumentHtml(vorlageFuer(id)!, d, b));
const feld = (id: string, f: string) => vorlageFuer(id)!.abschnitte.flatMap((a) => a.felder).find((x) => x.id === f);

const PEP = "sofort Durchgangsarzt bzw. Betriebsarzt aufsuchen – eine HIV-Postexpositionsprophylaxe sollte möglichst innerhalb von 2 Stunden beginnen, nach einer Stich- oder Schnittverletzung spätestens bis 24 Stunden; auch später noch ärztlich abklären lassen.";
const AUSKUNFT = "Kundin/Kunde fragen, ob sie freiwillig Auskunft über bekannte Infektionen (Hepatitis B/C, HIV) geben möchten – die Antwort ist freiwillig; nur an den Durchgangsarzt weitergeben, nicht im Verbandbuch notieren.";

describe("Rechtsanwalt, Fachfragen Runde 3: HIV-PEP und Hygieneplan Beauty", () => {
  it("B-276: Obergrenze nach Stich- oder Schnittverletzung im Wortlaut des Prüfers, Kurzbeleg S2k-Leitlinie", () => {
    const f = feld("betriebsanweisung_biostoffe", "unfall") as { vorschlaege: string[]; hilfe: string };
    expect(f.vorschlaege[0]).toBe(`Nach einer Stich- oder Schnittverletzung: Wunde desinfizieren und ${PEP}`);
    expect(f.hilfe).toContain("S2k-Leitlinie AWMF 055-004");
  });

  it("Hygieneplan, Zeile „Umgang mit Blut“: PEP-Satz und freiwillige Auskunft statt Abfrage des Infektionsstatus", () => {
    const z = HYGIENE.find((x) => x.titel === "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person")!;
    expect(z.werte.wie).toContain(PEP);
    expect(z.werte.wie).toContain(AUSKUNFT);
    expect(z.werte.wie).not.toMatch(/Infektionsstatus/);
    expect(z.quelle).toContain("S2k-Leitlinie AWMF 055-004");
    expect(z.quelle).toContain("Art. 9 Abs. 2 lit. a DSGVO");
    // im PDF
    const h = html("hygieneplan", { art: "beauty", eintraege: [{ ...z.werte }] });
    expect(h).toContain("spätestens bis 24 Stunden");
    expect(h).toContain("nicht im Verbandbuch notieren");
  });

  it("Rechtsgrundlage der Beauty-Fassung: § 17 Abs. 4 IfSG; die Lebensmittel-Fassung unverändert", () => {
    expect(html("hygieneplan", { art: "beauty" })).toContain("<dd>Hygieneverordnung des Landes (§ 17 Abs. 4 IfSG)</dd>");
    expect(html("hygieneplan", { art: "lebensmittel" })).toContain("<dd>Art. 4 Abs. 2, Art. 5, Anhang II VO (EG) Nr. 852/2004; §§ 3, 4 LMHV</dd>");
    expect(html("hygieneplan", { art: "beauty" })).not.toMatch(/§ 36 IfSG/);
  });

  it("„(Bayern: mind. begrenzt viruzid)“ nur bei einem Betrieb in Bayern", () => {
    const z = HYGIENE.find((x) => String(x.werte.womit ?? "").includes("(Bayern: mind. begrenzt viruzid)"))!;
    expect(z).toBeDefined();
    const d = { art: "beauty", eintraege: [{ ...z.werte }] };
    expect(html("hygieneplan", d, { ...B, bundesland: "Bayern" })).toContain("(Bayern: mind. begrenzt viruzid)");
    for (const land of ["Baden-Württemberg", "Nordrhein-Westfalen", ""]) expect(html("hygieneplan", d, { ...B, bundesland: land }), land).not.toContain("Bayern");
  });

  it("die Beauty-Ergänzungen ändern die Lebensmittel-Fassung nicht (nur Beauty-Gruppen und Fassung beauty)", () => {
    // E-196: Die Lebensmittel-Fassung hat seit ihrer Freigabe eine neue Fußzeile (GmbH & Co. KG, E-193) – ihre Prüfsumme
    // weicht deshalb ab; die Beauty-Vorschläge gehören aber nicht dazu: eine Änderung dort lässt sie unverändert
    const h = vorlageFuer("hygieneplan")!;
    const lm = VORLAGEN_GEPRUEFT.hygieneplan!;
    const beauty = { ...h, abschnitte: h.abschnitte.map((a) => ({ ...a, felder: a.felder.map((f) => (f.art === "liste" && f.vorschlaege ? { ...f, vorschlaege: f.vorschlaege.map((x) => (x.gruppe === "Alle Beauty-Betriebe" ? { ...x, titel: `${x.titel} (geändert)` } : x)) } : f)) })) };
    expect(vorlagenPruefsumme(beauty, lm)).toBe(vorlagenPruefsumme({ ...h }, lm));
  });
});

describe("Steuerberater, Runde 3: Bilanz und GuV", () => {
  const v = vorlageFuer("bilanz_guv")!;
  const GMBH: Betrieb = { ...B, name: "Muster GmbH", rechtsform: "GmbH", vertretung: "Anna Berg, Ben Kurz" };
  const COKG: Betrieb = { ...B, name: "Muster GmbH & Co. KG", rechtsform: "GmbH & Co. KG", vertretung: "Anna Berg" };

  it("Angaben unter der Bilanz (§ 264 Abs. 1 Satz 5 HGB) nur bei Kapitalgesellschaften und GmbH & Co. KG im Formular", () => {
    const felder = v.abschnitte.find((a) => a.titel === "Angaben unter der Bilanz")!.felder;
    const sichtbar = (d: Daten) => {
      const r = ohneVerdeckteFelder(felder, d);
      return felder.filter((f) => feldSichtbar(f, r)).map((f) => f.id);
    };
    for (const b of [GMBH, COKG, { ...B, rechtsform: "UG (haftungsbeschränkt)" }]) {
      const d = { ...leereDaten(v, b, "2026-10-24"), ...profilStartwerte(v, {}, b) };
      expect(d.anhang_form, b.rechtsform).toBe("kapital");
      expect(sichtbar(d), b.rechtsform).toEqual(expect.arrayContaining(["kleinst", "haftung", "organkredite"]));
    }
    for (const rf of ["OHG", "KG", "e. K."]) {
      const b = { ...B, rechtsform: rf };
      const d = { ...leereDaten(v, b, "2026-10-24"), ...profilStartwerte(v, {}, b) };
      expect(d.anhang_form, rf).toBe("personen");
      expect(sichtbar(d), rf).not.toContain("haftung");
      expect(sichtbar(d), rf).not.toContain("organkredite");
      expect(sichtbar(d), rf).not.toContain("kleinst");
    }
    // ältere Unterlagen ohne Angabe: wie bisher sichtbar
    expect(sichtbar({ kleinst: true })).toEqual(expect.arrayContaining(["kleinst", "haftung", "organkredite"]));
    for (const id of ["haftung", "organkredite"]) expect((felder.find((f) => f.id === id)!.hilfe ?? ""), id).toMatch(/§ 264 Abs\. 1 Satz 5 Nr\. [12] HGB/);
  });

  it("Kleinstkapitalgesellschaft: ausgefüllte Angaben stehen unter der Bilanz", () => {
    const zahlen = { aktiva: [{ posten: "Bank", betrag: "1.000,00" }], passiva: [{ posten: "Eigenkapital", betrag: "1.000,00" }] };
    const h = html("bilanz_guv", { ...zahlen, kleinst: true, haftung: "Bürgschaft für ein Darlehen der Muster Immobilien GmbH: 25.000 €", organkredite: "Darlehen an Geschäftsführerin Anna Berg: 10.000 €, 3 % Zinsen" }, GMBH);
    expect(h).toContain(BILANZ_KLEINST);
    expect(h).toContain("Bürgschaft für ein Darlehen der Muster Immobilien GmbH: 25.000 €");
    expect(h).toContain("Darlehen an Geschäftsführerin Anna Berg");
    // bei OHG nicht, auch wenn der Schalter in den Daten steht
    expect(html("bilanz_guv", { ...zahlen, kleinst: true, haftung: "Bürgschaft" }, { ...B, rechtsform: "OHG" })).not.toContain(BILANZ_KLEINST);
  });

  it("GmbH & Co. KG: zu unterschreiben von allen Geschäftsführern der Komplementär-GmbH (§ 245 HGB)", () => {
    const h = html("bilanz_guv", { kleinst: false }, COKG);
    expect(BILANZ_UNTERSCHRIFT_GMBH_CO_KG.startsWith("Zu unterschreiben von allen Geschäftsführern der Komplementär-GmbH")).toBe(true);
    expect(h).toContain(BILANZ_UNTERSCHRIFT_GMBH_CO_KG);
    expect(h).toContain("Anna Berg (Geschäftsführung der Komplementär-GmbH)");
    expect(h).not.toContain("persönlich haftenden Gesellschaftern");
    expect(h).toContain(BILANZ_ANHANG);
    expect(BILANZ_UNTERSCHRIFT).toContain("bei der GmbH & Co. KG alle Geschäftsführer der Komplementär-GmbH");
    expect(v.pruefen!({}, { ...COKG, vertretung: "" })[0]).toMatch(/Geschäftsführer der Komplementär-GmbH/);
    // OHG und GmbH unverändert
    expect(html("bilanz_guv", {}, { ...B, rechtsform: "OHG", vertretung: "Anna Berg, Ben Kurz" })).toContain("allen persönlich haftenden Gesellschaftern (§ 245 HGB)");
    expect(html("bilanz_guv", {}, { ...B, rechtsform: "OHG" })).toContain(BILANZ_OHNE_ANHANG);
    expect(html("bilanz_guv", { kleinst: false }, GMBH)).toContain("von allen Geschäftsführern (§ 245 HGB)");
  });
});
