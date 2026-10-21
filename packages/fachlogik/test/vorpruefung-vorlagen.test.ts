/**
 * Vorprüfung Phase 1 vom 21.10.2026 (docs/pruefberichte/2026-10-21-vorpruefung-phase-1.pdf), Vorlagen: Datenschutz-
 * information, NachwG, § 2a SchwarzArbG, AVV, Gefährdungsbeurteilung, Impressum, KI-Schulung, IfSG, Hygieneplan,
 * Unterweisung, Website-Datenschutzerklärung. Der Bericht ist eine Vorarbeit, keine anwaltliche Freigabe.
 */
import { describe, expect, it } from "vitest";
import { dokumentHtml, fehlendeAngaben, leereDaten, ohneVerdeckte, optionSichtbar, profilStartwerte, vorlageFuer, type Betrieb, type Daten, type Feld } from "../src/index.js";
import { VVT } from "../src/dokumente/bausteine.js";

const B: Betrieb = { name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", verantwortlich: "Alex Sonnberg", telefon: "089 123456", email: "hallo@salon-sonne.example", steuernummer: "143/123/45678", ust_idnr: "", iban: "", bundesland: "Bayern" };
const v = (id: string) => vorlageFuer(id)!;
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ");
const html = (id: string, d: Daten, b: Betrieb = B) => glatt(dokumentHtml(v(id), d, b));
const feld = (id: string, f: string) => v(id).abschnitte.flatMap((a) => a.felder).find((x) => x.id === f) as Feld & { optionen?: { wert: string; wenn?: unknown }[]; hilfe?: string };
/** Inhalt eines Abschnitts (von seiner Überschrift bis zum nächsten Abschnitt) */
const abschnittVon = (h: string, titel: string) => {
  const i = h.indexOf(`${titel}</h2>`);
  return i < 0 ? "" : h.slice(i, h.indexOf("</section>", i));
};

describe("Datenschutzinformation (Befund 1, T-65)", () => {
  it("Abschnitt 2 ist nie leer, sobald eine Verarbeitung gewählt ist – für jede einzelne Verarbeitung", () => {
    for (const x of VVT) {
      const z = abschnittVon(html("datenschutzinformation", { verarbeitungen: [x.titel] }), "Zwecke, Rechtsgrundlagen, Empfänger und Speicherdauer");
      expect(z, x.titel).toContain(`${x.titel}</h3>`);
      for (const k of ["Zweck", "Rechtsgrundlage", "Empfänger", "Speicherdauer"]) expect(z, `${x.titel}: ${k}`).toMatch(new RegExp(`<th>${k}</th><td>[^<]{3,}`));
    }
  });
  it("leeres Blatt: Abschnitt 2 mit beschrifteten Zeilen statt einer einzelnen Linie", () => {
    const z = abschnittVon(html("datenschutzinformation", leereDaten(v("datenschutzinformation"), B, "2026-10-21")), "Zwecke, Rechtsgrundlagen, Empfänger und Speicherdauer");
    expect(z.match(/<th>Speicherdauer<\/th>/g)).toHaveLength(3);
  });
  it("Datenschutzbeauftragte/r nur, wenn benannt; berechtigte Interessen nur bei lit. f", () => {
    const ohne = html("datenschutzinformation", { verarbeitungen: ["Lohn- und Gehaltsabrechnung"] });
    expect(ohne).not.toContain("Datenschutzbeauftragte/r");
    expect(ohne).not.toContain("Berechtigte Interessen</h2>");
    expect(html("datenschutzinformation", { verarbeitungen: ["Lohn- und Gehaltsabrechnung"], dsb: "Dr. Datenschutz, dsb@example.de" })).toContain("<th>Datenschutzbeauftragte/r</th><td>Dr. Datenschutz");
    expect(html("datenschutzinformation", { verarbeitungen: ["Videoüberwachung (z. B. Verkaufsraum, Eingang, Lager)"], interessen: "Schutz vor Diebstahl" })).toContain("Berechtigte Interessen</h2>");
  });
  it("Pflicht zur Bereitstellung je Gruppe; die Gruppe filtert die Bausteine", () => {
    const kunden = abschnittVon(html("datenschutzinformation", { gruppe: "kundschaft", verarbeitungen: ["Kundenverwaltung / Kundenkartei"] }), "Pflicht zur Bereitstellung");
    expect(kunden).toContain("für den Abschluss und die Durchführung des Vertrags erforderlich");
    const besch = abschnittVon(html("datenschutzinformation", { gruppe: "beschaeftigte", verarbeitungen: ["Lohn- und Gehaltsabrechnung"] }), "Pflicht zur Bereitstellung");
    expect(besch).toContain("gesetzlich vorgeschrieben");
    expect(besch).toContain("Bewerberinnen und Bewerber: Gesetzlich oder vertraglich verpflichtet");
    const lief = html("datenschutzinformation", { gruppe: "lieferanten", verarbeitungen: ["Lieferanten- und Dienstleisterverwaltung"] });
    expect(lief).toContain("Herkunft der Daten</h2>");
    expect(lief).toContain("<th>Datenkategorien</th>");
    expect(lief).toContain("Art. 13, 14 DSGVO");
    // ältere Informationen ohne Gruppe: aus „Für wen“
    expect(abschnittVon(html("datenschutzinformation", { fuer_wen: "Beschäftigte", verarbeitungen: ["Lohn- und Gehaltsabrechnung"] }), "Pflicht zur Bereitstellung")).toContain("gesetzlich vorgeschrieben");
    const opt = feld("datenschutzinformation", "verarbeitungen").optionen!;
    const sichtbar = (g: string) => opt.filter((o) => optionSichtbar(o as never, { gruppe: g })).map((o) => o.wert);
    expect(sichtbar("beschaeftigte")).toContain("Bewerbungsverfahren");
    expect(sichtbar("beschaeftigte")).not.toContain("E-Mail-Newsletter / E-Mail-Werbung");
    expect(sichtbar("kundschaft")).not.toContain("Lohn- und Gehaltsabrechnung");
    expect(sichtbar("lieferanten")).toContain("Lieferanten- und Dienstleisterverwaltung");
  });
  it("Soziale Netzwerke nennen die Garantie, Logfiles einen Wert, Newsletter „bis zu drei Jahre“", () => {
    const sn = html("datenschutzinformation", { verarbeitungen: ["Unternehmensauftritt in sozialen Netzwerken (z. B. Facebook-/Instagram-Seite)"] });
    expect(sn).toContain("Durchführungsbeschluss (EU) 2023/1795");
    expect(sn).not.toContain("siehe Datenschutzhinweise des Anbieters");
    const web = html("datenschutzinformation", { verarbeitungen: ["Betrieb der Website (Hosting, Server-Logfiles)"], logfile_tage: "7" });
    expect(web).toContain("Server-Logfiles mit IP-Adressen werden nach 7 Tagen gelöscht.");
    expect(web).not.toMatch(/Datenschutzerklärung genannt/);
    expect(html("datenschutzinformation", { verarbeitungen: ["E-Mail-Newsletter / E-Mail-Werbung"] })).toContain("bis zu drei Jahre aufbewahrt");
  });
});

describe("Nachweis der wesentlichen Arbeitsbedingungen (Befund 2)", () => {
  const voll: Daten = { name: "Jana Becker", anschrift: "Lindenstraße 12\n80469 München", beginn: "2026-11-01", entgelt_art: "monat", entgelt_betrag: "2650", ueberstunden_verguetung: "mit dem Stundenlohn", bestandteile: [{ bezeichnung: "Weihnachtsgeld", hoehe: "50 % eines Monatsgehalts" }, { bezeichnung: "Nachtzuschlag", hoehe: "25 %" }], faelligkeit: "am Monatsende", auszahlung: "Überweisung", bav: true, bav_text: "Allianz Pensionskasse AG", bav_anschrift: "Reinsburgstraße 19\n70178 Stuttgart" };
  it("Anschrift der beschäftigten Person ist Pflicht und hat auch ohne Angabe Linien; Beginn steht da", () => {
    expect(fehlendeAngaben(v("nachweis_arbeitsbedingungen"), { ...voll, anschrift: "" }, B)).toContain("Anschrift (Straße, PLZ, Ort)");
    const ohne = html("nachweis_arbeitsbedingungen", { ...voll, anschrift: "" });
    expect(ohne).toMatch(/Jana Becker<\/div><div class="adresse"><span class="fuellen"><\/span><span class="fuellen"><\/span><\/div>/);
    expect(html("nachweis_arbeitsbedingungen", voll)).toContain("<th>Beginn</th><td>01.11.2026</td>");
    expect(fehlendeAngaben(v("nachweis_arbeitsbedingungen"), { ...voll, beginn: "" }, B)).toContain("Beginn des Arbeitsverhältnisses");
  });
  it("Nr. 7: Überstundenvergütung und jeder Bestandteil als eigene Zeile", () => {
    const h = html("nachweis_arbeitsbedingungen", voll);
    expect(h).toContain("<th>Vergütung von Überstunden</th><td>mit dem Stundenlohn</td>");
    expect(h).toContain("<th>Weihnachtsgeld</th><td>50 % eines Monatsgehalts</td>");
    expect(h).toContain("<th>Nachtzuschlag</th><td>25 %</td>");
    expect(html("nachweis_arbeitsbedingungen", { ...voll, bestandteile: [] })).toContain("<th>Zuschläge, Zulagen, Prämien, Sonderzahlungen</th><td>keine</td>");
    expect(fehlendeAngaben(v("nachweis_arbeitsbedingungen"), { ...voll, ueberstunden_verguetung: "" }, B)).toContain("Vergütung von Überstunden");
  });
  it("Nr. 9: Arbeit auf Abruf mit Mindeststunden, Zeitrahmen, Ankündigungsfrist und Hinweis auf § 12 TzBfG", () => {
    const d = { ...leereDaten(v("nachweis_arbeitsbedingungen"), B, "2026-10-21"), ...voll, abruf: true, abruf_mindest: "15", abruf_zeitrahmen: "Montag bis Freitag, 8 bis 18 Uhr" };
    const h = html("nachweis_arbeitsbedingungen", d);
    expect(h).toContain("<th>Mindestens zu vergütende Stunden</th><td>15 Stunden pro Woche</td>");
    expect(h).toContain("<th>Zeitrahmen (Referenztage und -stunden)</th><td>Montag bis Freitag, 8 bis 18 Uhr</td>");
    expect(h).toContain("<th>Ankündigungsfrist</th><td>mindestens vier Tage im Voraus</td>");
    expect(h).toContain("(§ 12 Abs. 3 TzBfG)");
    expect(fehlendeAngaben(v("nachweis_arbeitsbedingungen"), { ...voll, abruf: true }, B)).toEqual(expect.arrayContaining(["Mindestens zu vergütende Stunden pro Woche", "Zeitrahmen (Referenztage und Referenzstunden)", "Ankündigungsfrist"]));
  });
  it("Nr. 13: Name und Anschrift des Versorgungsträgers", () => {
    expect(html("nachweis_arbeitsbedingungen", voll)).toContain("Über den Versorgungsträger: Allianz Pensionskasse AG, Reinsburgstraße 19, 70178 Stuttgart");
    expect(fehlendeAngaben(v("nachweis_arbeitsbedingungen"), { ...voll, bav_anschrift: "" }, B)).toContain("Anschrift des Versorgungsträgers");
  });
  it("Hilfetexte: Pausen und Ruhezeit konkret, Befristung, Ausschlussfristen, allgemeinverbindliche Tarifverträge", () => {
    expect(feld("nachweis_arbeitsbedingungen", "pausen").hilfe).toMatch(/30 Minuten bei mehr als 6 Stunden, 45 Minuten bei mehr als 9 Stunden/);
    expect(feld("nachweis_arbeitsbedingungen", "ruhezeit").hilfe).toMatch(/11 Stunden/);
    expect(feld("nachweis_arbeitsbedingungen", "befristet").hilfe).toMatch(/§ 14 Abs\. 4 TzBfG/);
    expect(feld("nachweis_arbeitsbedingungen", "probezeit").hilfe).toMatch(/§ 15 Abs\. 3 TzBfG/);
    expect(feld("nachweis_arbeitsbedingungen", "befristet_kuendbar").hilfe).toMatch(/§ 15 Abs\. 4 TzBfG/);
    expect(feld("nachweis_arbeitsbedingungen", "weitere").hilfe).toMatch(/Ausschlussfristen und Wettbewerbsverbote/);
    expect(feld("nachweis_arbeitsbedingungen", "kollektiv").hilfe).toMatch(/allgemeinverbindliche.*Gebäudereinigung.*Friseurhandwerk/i);
  });
  it("Befristung: ohne vereinbarte ordentliche Kündigung kein Verweis auf § 622 BGB", () => {
    const b = html("nachweis_arbeitsbedingungen", { ...voll, befristet: true, befristung_ende: "2027-10-31" });
    expect(b).toContain("Eine ordentliche Kündigung ist nicht vereinbart (§ 15 Abs. 4 TzBfG)");
    expect(b).not.toContain("Grundkündigungsfrist");
    expect(html("nachweis_arbeitsbedingungen", { ...voll, befristet: true, befristung_ende: "2027-10-31", befristet_kuendbar: true })).toContain("Grundkündigungsfrist");
  });
  it("Form je Branche: § 2a-Branchen Schriftform, sonst PDF mit Empfangsnachweis; Branche aus dem Pflichten-Check", () => {
    const h = (d: Daten) => v("nachweis_arbeitsbedingungen").hinweise!(d, B)[0]!;
    expect(h({ branche: "friseur_kosmetik" })).toMatch(/^In deiner Branche \(Friseur- und Kosmetikgewerbe, § 2a Abs\. 1 SchwarzArbG\): ausdrucken, unterschreiben, aushändigen/);
    expect(h({ branche: "keine" })).toMatch(/^PDF genügt.*Empfang bestätigen/);
    expect(h({})).toMatch(/Wähle die Branche/);
    expect(v("nachweis_arbeitsbedingungen").hinweise!({ befristet: true, probezeit: "6" }, B).join(" ")).toMatch(/§ 14 Abs\. 4 TzBfG.*§ 15 Abs\. 3 TzBfG/);
    expect(leereDaten(v("nachweis_arbeitsbedingungen"), B, "2026-10-21", ["kosmetik"]).branche).toBe("friseur_kosmetik");
    expect(profilStartwerte(v("nachweis_arbeitsbedingungen"), { "personal.sofortmeldebranchen": ["lieferdienste"] })).toEqual({ branche: "spedition_logistik" });
    expect(profilStartwerte(v("nachweis_arbeitsbedingungen"), { "personal.sofortmeldebranchen": ["keine"] })).toEqual({ branche: "keine" });
    expect(profilStartwerte(v("nachweis_arbeitsbedingungen"), { "taetigkeit.branchen": ["beauty_kosmetik"] })).toEqual({ branche: "friseur_kosmetik" });
    expect(profilStartwerte(v("nachweis_arbeitsbedingungen"), {})).toEqual({});
  });
});

describe("§ 2a SchwarzArbG n. F. (Befund 3, T-99)", () => {
  it("Arbeitszeitnachweis und NachwG kennen alle elf Branchen, Friseur und Kosmetik als Nr. 11", () => {
    for (const id of ["arbeitszeitnachweis", "nachweis_arbeitsbedingungen"]) {
      const o = feld(id, "branche").optionen!.map((x) => x.wert);
      expect(o, id).toEqual(["bau", "gastronomie", "personenbefoerderung", "spedition_logistik", "schausteller", "gebaeudereinigung", "messebau", "fleischwirtschaft", "prostitution", "sicherheitsgewerbe", "friseur_kosmetik", "keine"]);
    }
    const fuss = html("arbeitszeitnachweis", { name: "Amira", tage: [{ datum: "2026-10-05", beginn: "08:00", ende: "12:00" }] });
    expect(fuss).toContain("§ 2a Abs. 1 SchwarzArbG (Bau, Gaststätten und Beherbergung, Personenbeförderung, Spedition, Transport und Logistik (auch Lieferdienste)");
    expect(html("arbeitszeitnachweis", { name: "Amira", branche: "messebau", tage: [{ datum: "2026-10-05", beginn: "08:00", ende: "12:00" }] })).toContain("(hier: Auf- und Abbau von Messen und Ausstellungen)");
    // gespeicherte „andere“ aus der Zeit vor der vollständigen Liste
    expect(html("arbeitszeitnachweis", { name: "Amira", branche: "andere", tage: [] })).toContain("für Branchen nach § 2a Abs. 1 SchwarzArbG und für Minijobs");
    expect(profilStartwerte(v("arbeitszeitnachweis"), { "personal.sofortmeldebranchen": ["bau", "gastronomie"] })).toEqual({ branche: "bau" });
  });
  it("Ausweis-Hinweis: „Ausgehändigt am“ liegt vor dem Beginn (Hilfetext)", () => {
    expect(feld("ausweis_hinweis", "datum").hilfe).toMatch(/vor dem ersten Arbeitstag/);
  });
});

describe("AVV (Befund 5)", () => {
  const d: Daten = { partner: "IT-Service Krüger", partner_anschrift: "Bahnhofstraße 4\n80335 München", hauptvertrag: "IT-Betreuung", gegenstand: "Wartung der IT", zweck: "Betrieb der IT", dauer: "für die Laufzeit des Hauptvertrags", datenarten: "Name", betroffene: "Kundinnen und Kunden" };
  it("Unterauftragsverarbeiter als Tabelle, Genehmigung gesondert oder allgemein mit Einspruchsfrist", () => {
    const u = { ...d, unterauftragnehmer: [{ name: "Hetzner Online GmbH", anschrift: "Industriestr. 25, 91710 Gunzenhausen", leistung: "Rechenzentrum", ort: "Deutschland" }] };
    const h = html("avv", { ...u, genehmigung: "allgemein", einspruch_tage: "14" });
    expect(h).toContain("<th>Name</th><th>Anschrift</th><th>Leistung</th><th>Ort der Verarbeitung</th>");
    expect(h).toContain("<strong>Hetzner Online GmbH</strong>");
    expect(h).toContain("mindestens 14 Tage vor dem Einsatz");
    expect(html("avv", { ...u, genehmigung: "gesondert" })).toContain("vorheriger gesonderter schriftlicher Genehmigung");
    expect(html("avv", d)).toContain("setzt derzeit keine Unterauftragsverarbeiter ein");
  });
  it("TOM nach Kategorien (Art. 32 Abs. 1 lit. a–d), Ort mit Transfermechanismus, Weisungsberechtigte, Meldefrist, Kontrolle, Laufzeit, Haftung", () => {
    const h = html("avv", { ...d, tom_zutritt: "Büro abgeschlossen", ort: "drittland", drittland_land: "USA", drittland_garantie: "scc3", weisung_ag: "Alex Sonnberg", weisung_an: "Tom Krüger", meldefrist: "24", kontrolle_tage: "14", kontrolle_kosten: "eigene", zertifikate: true });
    expect(h).toContain("<th>Zutrittskontrolle (Räume) (lit. b)</th><td>Büro abgeschlossen</td>");
    expect(h).toContain("Wiederherstellung nach einem Zwischenfall (lit. c)");
    expect(h).toContain("Modul 3");
    expect(h).toContain("<th>Weisungsberechtigt beim Auftraggeber</th><td>Alex Sonnberg</td>");
    expect(h).toContain("spätestens innerhalb von 24 Stunden");
    expect(h).toContain("Art. 33 Abs. 3 DSGVO");
    expect(h).toContain("mindestens 14 Tage vorher angekündigt");
    expect(h).toContain("ISO 27001");
    expect(h).toContain("bis alle personenbezogenen Daten des Auftraggebers gelöscht oder zurückgegeben sind");
    expect(h).toContain("Art. 82 DSGVO");
    expect(html("avv", d)).toContain("ausschließlich in der Europäischen Union");
    expect(fehlendeAngaben(v("avv"), d, B)).toContain("Technische und organisatorische Maßnahmen (mindestens eine Kategorie oder Verweis auf eine Anlage)");
  });
  it("Option: Standardvertragsklauseln nach Art. 28 Abs. 7 DSGVO; Hinweis auf eigene Verträge großer Anbieter", () => {
    const h = html("avv", { ...d, muster: "scc", genehmigung: "allgemein", einspruch_tage: "30" });
    expect(h).toContain("Durchführungsbeschluss (EU) 2021/915");
    expect(h).toContain("Anhang III – Technische und organisatorische Maßnahmen");
    expect(h).toContain("Option 2");
    expect(h).toContain("Art. 28 Abs. 3, 7 DSGVO");
    expect(v("avv").abschnitte[0]!.hilfe).toMatch(/Große Dienstleister.*eigenen Vertrag.*kleine Dienstleister/);
  });
});

describe("Gefährdungsbeurteilung (Abschnitt 4)", () => {
  it("Spalte „bis wann“, Beschäftigte informiert, Fortschreibung, Skala, Mitwirkung", () => {
    const h = html("gefaehrdungsbeurteilung", { arbeitsbereich: "Salon", gefaehrdungen: [{ beschreibung: "Rutschgefahr", massnahme: "Matten", verantwortlich: "Lea", umsetzen_bis: "2026-11-01", faktor: "arbeitsstaette", risiko: "mittel" }], mutterschutz_ergebnis: "keine_massnahmen", mutterschutz_informiert: "2026-10-20" });
    expect(h).toContain("<th>Wer / bis wann</th>");
    expect(h).toContain("<th>Beschäftigte informiert am (§ 14 Abs. 2 MuSchG)</th><td>20.10.2026</td>");
    expect(h).toContain("§ 10 Abs. 2 MuSchG");
    expect(h).toMatch(/Risiko – gering: .*mittel: .*hoch: /);
    expect(feld("gefaehrdungsbeurteilung", "mitwirkung").hilfe).toMatch(/Fachkraft für Arbeitssicherheit.*Unternehmermodell/);
    expect((v("gefaehrdungsbeurteilung").abschnitte[1]!.felder[0] as { felder: Feld[] }).felder.find((f) => f.id === "risiko")!.hilfe).toMatch(/^Gering: .*mittel: .*hoch: /);
  });
  it("leeres Blatt mit den sechs Gefährdungsfaktoren des § 5 Abs. 3 ArbSchG", () => {
    const h = html("gefaehrdungsbeurteilung", leereDaten(v("gefaehrdungsbeurteilung"), B, "2026-10-21"));
    for (let i = 1; i <= 6; i++) expect(h).toContain(`§ 5 Abs. 3 Nr. ${i}`);
    expect(h).toContain("Psychische Belastungen bei der Arbeit</h2>");
  });
  it("Jugendliche (§ 28a JArbSchG) als eigener Abschnitt, aus dem Pflichten-Check vorbelegt", () => {
    const h = html("gefaehrdungsbeurteilung", { arbeitsbereich: "Salon", jugendliche: true, jugendliche_details: "Keine Akkordarbeit" });
    expect(h).toContain("Jugendliche (§ 28a JArbSchG)</h2>");
    expect(h).toContain("§ 28a JArbSchG");
    expect(html("gefaehrdungsbeurteilung", { arbeitsbereich: "Salon" })).not.toContain("Jugendliche (§ 28a JArbSchG)</h2>");
    expect(v("gefaehrdungsbeurteilung").ausProfil).toEqual({ jugendliche: "beschaeftigte.jugendlich" });
  });
});

describe("Impressum, KI-Schulung, IfSG, Hygieneplan, Unterweisung (Abschnitt 5)", () => {
  const imp = (d: Daten, b: Betrieb) => v("impressum").alsText!(ohneVerdeckte(v("impressum"), { ...leereDaten(v("impressum"), b, "2026-10-21"), ...d }), b);
  it("Impressum: GmbH mit Rechtsform und Vertretungsberechtigten, nie „Inhaber/in“ – auch ohne Rechtsform in „Mein Betrieb“", () => {
    const gmbh: Betrieb = { ...B, name: "Salon Sonne GmbH", vertretung: "Alex Sonnberg" };
    const t = imp({}, gmbh);
    expect(t).toContain("Rechtsform: GmbH");
    expect(t).toContain("Vertretungsberechtigte Geschäftsführung\nAlex Sonnberg");
    expect(t).not.toContain("Inhaber/in");
    expect(imp({}, B)).toContain("Inhaber/in\nAlex Sonnberg");
    expect(imp({}, { ...B, name: "Sonne UG (haftungsbeschränkt)" })).toContain("Vertretungsberechtigte Geschäftsführung");
  });
  it("Impressum: Kapital nur, wenn angegeben; Aufsichtsbehörde nur bei zulassungspflichtiger Tätigkeit", () => {
    const gmbh: Betrieb = { ...B, name: "Salon Sonne GmbH" };
    expect(imp({}, gmbh)).not.toContain("Stammkapital");
    expect(imp({ kapital: "25.000 €", ausstehend: "keine" }, gmbh)).toContain("Stammkapital\n25.000 €");
    expect(imp({ aufsicht: "Landratsamt" }, B)).not.toContain("Aufsichtsbehörde");
    expect(imp({ zulassung: true, aufsicht: "Landratsamt München" }, B)).toContain("Zuständige Aufsichtsbehörde\nLandratsamt München");
    expect(v("impressum").pruefen!({ aufsicht: "Landratsamt" }, B).join(" ")).toMatch(/behördliche Zulassung/);
  });
  it("KI-Schulung: Art. 4 KI-VO in der Fassung der VO (EU) 2026/1744, Titel ohne „Nachweis“", () => {
    expect(v("ki_kompetenz").titel).toBe("Dokumentation KI-Schulung");
    expect(v("ki_kompetenz").grundlage).toBe("Art. 4 KI-VO (VO (EU) 2024/1689, geändert durch VO (EU) 2026/1744)");
    expect(v("ki_kompetenz").abschnitte[0]!.hilfe).toMatch(/Förderung der KI-Kompetenz/);
    expect(html("ki_kompetenz", { thema: "Grundschulung" })).toContain("Dokumentation KI-Schulung");
  });
  it("IfSG: Krankheitszeichen in einfachen Worten, Merkblatt als Anlage", () => {
    const h = html("ifsg_belehrung", { liste_anhaengen: true, merkblatt: true, teilnehmer: [] });
    expect(h).toContain("Woran Sie das erkennen</h3>");
    expect(h).toContain("Gelbfärbung der Haut");
    expect(h).toContain("Anlage: Merkblatt zur Belehrung nach § 43 Abs. 1 Nr. 1 IfSG");
  });
  it("Hygieneplan: Rechtsgrundlage je Branche (T-104)", () => {
    expect(html("hygieneplan", { art: "lebensmittel", eintraege: [] })).toContain("VO (EG) Nr. 852/2004; LMHV");
    expect(html("hygieneplan", { art: "beauty", eintraege: [] })).toContain("Hygieneverordnung des Landes");
    expect(leereDaten(v("hygieneplan"), B, "2026-10-21", ["gastro_cafe"]).art).toBe("lebensmittel");
  });
  it("Unterweisung: Unterschrift statt eingetipptem Namen empfohlen (T-13)", () => {
    expect(v("unterweisung").abschnitte[2]!.hilfe).toMatch(/eigenhändig.*eingetippter Name ist als Nachweis schwach/);
  });
});

describe("Website-Datenschutzerklärung (T-106 Nr. 9)", () => {
  const dse = (d: Daten) => v("datenschutzerklaerung_website").alsText!(ohneVerdeckte(v("datenschutzerklaerung_website"), { ...leereDaten(v("datenschutzerklaerung_website"), B, "2026-10-21"), ...d }), B);
  it("YouTube und Google Fonts mit Data Privacy Framework wie Google Maps", () => {
    const t = dse({ module: ["youtube", "google_fonts_extern", "widerruf_einwilligung"] });
    expect(t.match(/Durchführungsbeschluss \(EU\) 2023\/1795/g)).toHaveLength(2);
    expect(t).toContain("§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO); die Einwilligung können Sie jederzeit widerrufen");
    expect(t).not.toContain("Empfehlung:");
    expect((feld("datenschutzerklaerung_website", "module").hilfe ?? "")).toMatch(/3 O 17493\/20/);
  });
  it("Videokonferenz und Zahlung: Auswahl wird zum Satz (nur EU, DPF, Standardvertragsklauseln)", () => {
    expect(dse({ module: ["videokonferenz"], video_anbieter: "Jitsi" })).toContain("Eine Übermittlung in Länder außerhalb der EU bzw. des EWR findet nicht statt.");
    expect(dse({ module: ["videokonferenz"], video_anbieter: "Zoom", video_garantie: "dpf" })).toContain("auch in den USA verarbeitet werden. Die Übermittlung stützt sich auf den Angemessenheitsbeschluss der EU-Kommission zum EU-U.S. Data Privacy Framework (Art. 45 DSGVO, Durchführungsbeschluss (EU) 2023/1795)");
    expect(dse({ module: ["zahlungsdienstleister"], zahlung_anbieter: "X", zahlung_garantie: "scc", zahlung_drittland: "Kanada" })).toContain("auch in Kanada verarbeitet werden. Die Übermittlung stützt sich auf die EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO, Durchführungsbeschluss (EU) 2021/914)");
    // gespeicherte Erklärungen von früher (Land + „angemessenheit“)
    expect(dse({ module: ["videokonferenz"], video_anbieter: "Zoom", video_drittland: "USA", video_garantie: "angemessenheit" })).toContain("Data Privacy Framework, Durchführungsbeschluss (EU) 2023/1795");
  });
});
