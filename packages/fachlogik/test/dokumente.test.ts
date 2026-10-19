import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KU_HINWEIS, eRechnungAus, xrechnungUbl, ANLAESSE, KURZ, PERSONEN_FELDER, kurztitel, naechsteNummer, personAus, personIn, personMerken, BEREICHE, bausteinText, eintragAusVorschlag, mindestlohnAm, mindesturlaub, stundenlohn, LEERER_BETRIEB, PRUEFHINWEIS, VORLAGEN, dokumentHtml, arbeitsminuten, aufbewahrenBis, berlinZuUtc, cent, dateiname, fehlendeAngaben, leereDaten, neuerEintrag, sichtbar, unterlagenName, vorlageFuer, type Betrieb, type Daten, type Feld } from "../src/index.js";

const KATALOG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../catalog/pflichten");
const BETRIEB: Betrieb = { name: "Salon Sonne", strasse: "Hauptstr. 1", plz: "12345", ort: "Musterstadt", verantwortlich: "Alex Muster", telefon: "0123 456", email: "info@example.de", steuernummer: "12/345/67890", ust_idnr: "", iban: "DE00 1234", bundesland: "Bayern" };

function generatorPflichten(): string[] {
  return fs
    .readdirSync(KATALOG)
    .filter((f) => f.endsWith(".yaml") && fs.readFileSync(path.join(KATALOG, f), "utf8").includes("automatisierung: dokument_generator"))
    .map((f) => f.replace(/\.yaml$/, ""));
}

/** Geldbeträge enthalten ein geschütztes Leerzeichen vor „€“. */
const n = <T,>(x: T): T => JSON.parse(JSON.stringify(x).replace(/\u00a0/g, " ")) as T;
const erg = (v: { ergebnis?: (d: Daten) => [string, string][] }, d: Daten) => n(v.ergebnis!(d));

/** Füllt jedes Feld mit einem Beispielwert (Listen mit zwei Einträgen). */
function alles(felder: Feld[], tiefe = 0): Daten {
  const d: Daten = {};
  for (const f of felder) {
    if (f.art === "liste") d[f.id] = [0, 1].map(() => alles(f.felder, tiefe + 1) as Record<string, string>);
    else if (f.art === "datum") d[f.id] = "2026-10-12";
    else if (f.art === "uhrzeit") d[f.id] = "09:30";
    else if (f.art === "betrag") d[f.id] = "1.234,50";
    else if (f.art === "zahl") d[f.id] = "2";
    else if (f.art === "schalter") d[f.id] = true;
    else if (f.art === "wahl") d[f.id] = f.optionen[0]!.wert;
    else if (f.art === "mehrfach") d[f.id] = f.optionen.slice(0, 2).map((o) => o.wert);
    else d[f.id] = `${f.label} <b>&</b>`;
  }
  return d;
}

describe("Dokumentvorlagen", () => {
  it("decken alle Pflichten mit Dokument-Generator im Katalog ab – und nur echte Pflichten", () => {
    const belegt = new Set(VORLAGEN.flatMap((v) => v.pflichten));
    const katalog = generatorPflichten();
    expect(katalog.length).toBeGreaterThanOrEqual(18);
    for (const p of katalog) expect(belegt, p).toContain(p);
    for (const p of belegt) expect(fs.existsSync(path.join(KATALOG, `${p}.yaml`)), p).toBe(true);
  });

  it("sind in sich stimmig: eindeutige IDs, Bereiche, Titel- und Namensfelder, Bedingungen", () => {
    expect(new Set(VORLAGEN.map((v) => v.id)).size).toBe(VORLAGEN.length);
    for (const v of VORLAGEN) {
      expect(BEREICHE.map((b) => b.id)).toContain(v.bereich);
      expect(vorlageFuer(v.id)).toBe(v);
      const felder = v.abschnitte.flatMap((a) => a.felder);
      const ids = felder.map((f) => f.id);
      expect(new Set(ids).size, v.id).toBe(ids.length);
      if (v.namensFeld) expect(ids, v.id).toContain(v.namensFeld);
      for (const f of felder) {
        if (f.wenn) expect(ids, `${v.id}.${f.id}`).toContain(f.wenn.feld);
        if (f.art === "liste") {
          const sub = f.felder.map((x) => x.id);
          expect(sub, `${v.id}.${f.id}`).toContain(f.titelFeld);
          for (const x of f.felder) if (x.wenn) expect(sub, `${v.id}.${f.id}.${x.id}`).toContain(x.wenn.feld);
        }
      }
    }
  });

  it("erzeugen aus leeren und vollen Eingaben ein vorzeigbares Dokument: Briefkopf, Rechtsgrundlage, Fußzeilendaten, maskierte Eingaben, kein Prüfstempel", () => {
    for (const v of VORLAGEN) {
      const leer = dokumentHtml(v, leereDaten(v, BETRIEB, "2026-10-12"), BETRIEB);
      expect(leer, v.id).toContain("<!doctype html>");
      expect(leer).not.toContain(PRUEFHINWEIS);
      expect(leer).not.toContain("noch nicht angegeben");
      expect(leer).toContain('name="amtlos-fuss-links" content="Salon Sonne');
      if (v.kundendokument) expect(leer, v.id).not.toMatch(/Rechtsgrundlage|Steuern und Buchhaltung/);
      else if (v.grundlage) expect(leer.replace(/&nbsp;/g, " "), v.id).toContain(`<dt>Rechtsgrundlage</dt><dd>${v.grundlage.replace(/&/g, "&amp;")}</dd>`);
      expect(leer).toContain("Salon Sonne");
      expect(leer.includes("A4 landscape"), v.id).toBe(Boolean(v.querformat));
      const voll = v.html(alles(v.abschnitte.flatMap((a) => a.felder)), BETRIEB);
      expect(voll, v.id).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
      expect(voll).not.toContain("<b>&</b>");
    }
  });

  it("füllt Angaben aus „Mein Betrieb“ und das heutige Datum vor; Listen beginnen mit einem Eintrag", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    const d = leereDaten(g, BETRIEB, "2026-10-12");
    expect(d.beurteilt_von).toBe("Alex Muster");
    expect(d.datum).toBe("2026-10-12");
    expect(d.gefaehrdungen).toEqual([]); // Start über Vorschläge
    expect(Array.isArray(leereDaten(vorlageFuer("rechnung")!, BETRIEB, "2026-10-12").positionen) && (leereDaten(vorlageFuer("rechnung")!, BETRIEB, "2026-10-12").positionen as unknown[]).length).toBe(1);
    const liste = g.abschnitte[1]!.felder[0]!;
    expect(liste.art === "liste" && neuerEintrag(liste, BETRIEB, "2026-10-12").risiko).toBe("mittel");
    expect(vorlageFuer("datenpanne") && leereDaten(vorlageFuer("datenpanne")!, BETRIEB, "2026-10-12").kontakt).toBe("Alex Muster, 0123 456, info@example.de");
  });

  it("nennt fehlende Pflichtangaben – auch in Listeneinträgen und nur für sichtbare Felder", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    const d = leereDaten(g, BETRIEB, "2026-10-12");
    expect(fehlendeAngaben(g, d)).toEqual(["Arbeitsbereich oder Gewerk", "mindestens ein Eintrag: Gefährdung", "Ergebnis für schwangere oder stillende Frauen"]);
    d.arbeitsbereich = "Küche";
    d.gefaehrdungen = [{ faktor: "arbeitsstaette", beschreibung: "Rutschgefahr", risiko: "mittel", massnahme: "", verantwortlich: "", umsetzen_bis: null, umgesetzt_am: null }];
    d.mutterschutz_ergebnis = "keine_massnahmen";
    expect(fehlendeAngaben(g, d)).toEqual(["Gefährdung: Schutzmaßnahmen"]);

    const p = vorlageFuer("datenpanne")!;
    const dp = leereDaten(p, BETRIEB, "2026-10-12");
    const begruendung = p.abschnitte[2]!.felder[1]!;
    expect(sichtbar(begruendung, dp)).toBe(false);
    dp.risiko = "kein_risiko";
    expect(sichtbar(begruendung, dp)).toBe(true);
    expect(fehlendeAngaben(p, dp)).toContain("Begründung, warum keine Meldung nötig ist");
  });

  it("rechnet die 72-Stunden-Frist in Berliner Zeit, auch über die Zeitumstellung", () => {
    expect(berlinZuUtc("2026-10-24", "22:00")!.toISOString()).toBe("2026-10-24T20:00:00.000Z");
    const p = vorlageFuer("datenpanne")!;
    const html = p.html({ ...leereDaten(p, BETRIEB, "2026-10-24"), entdeckt_um: "22:00" }, BETRIEB);
    expect(html).toContain("24.10.2026, 22:00 Uhr");
    expect(html).toContain("27.10.2026, 21:00 Uhr"); // Ende der Sommerzeit am 25.10.2026
    expect(berlinZuUtc("2026-13-01", "10:00")).toBeNull();
  });

  it("benennt Unterlagen und PDF-Dateien lesbar", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    expect(unterlagenName(g, { arbeitsbereich: "Küche" })).toBe("Gefährdungsbeurteilung · Küche");
    expect(dateiname(g, { arbeitsbereich: "Küche & Lager" }, "2026-10-12")).toBe("Gefaehrdungsbeurteilung-Kueche-Lager-2026-10-12.pdf");
    expect(dateiname(vorlageFuer("verfahrensdokumentation")!, {}, "2026-10-12")).toBe("Verfahrensdokumentation-GoBD-2026-10-12.pdf");
  });

  it("zeigt Allergene, Unterschriftszeilen und leere HACCP-Zeilen", () => {
    const a = vorlageFuer("allergene")!;
    const html = a.html({ stand: "2026-10-12", gerichte: [{ name: "Apfelkuchen", kategorie: "Kuchen", allergene: ["gluten", "eier", "milch"] }] }, BETRIEB);
    // Matrix (E-130): eine Spalte je Allergen, × = enthalten
    expect(html).toContain('<th class="dreh">Milch (einschließlich Laktose)</th>');
    expect((html.match(/<td class="x">×<\/td>/g) ?? []).length).toBe(3);
    const u = vorlageFuer("unterweisung")!;
    const uh = u.html({ thema: "Test", teilnehmer: [{ name: "Kim" }] }, BETRIEB);
    expect((uh.match(/<tr><td>/g) ?? []).length).toBe(3); // Kim + 2 freie Zeilen (ohne Namen: 6 Zeilen zum Ausdrucken)
    const h = vorlageFuer("haccp")!;
    // leere Zeilen füllen die erste Seite unter dem Titel (ohne Kontrollpunkte), mehr als drei
    expect((h.html({ zeitraum: "Okt", leerzeilen: true, messungen: [] }, BETRIEB).match(/<tr><td>/g) ?? []).length).toBeGreaterThan(3);
  });

  it("liest Beträge deutsch und englisch geschrieben", () => {
    expect(cent("1.234,56")).toBe(123456);
    expect(cent("12,5")).toBe(1250);
    expect(cent("12.50")).toBe(1250);
    expect(cent("1.000")).toBe(100000);
    expect(cent("12 €")).toBe(1200);
    expect(cent("")).toBeNull();
    expect(cent("abc")).toBeNull();
  });

  it("Rechnung: Summen je Steuersatz, Kleinunternehmer-Hinweis, fehlende Steuernummer im Betrieb", () => {
    const r = vorlageFuer("rechnung")!;
    const d = { ...leereDaten(r, BETRIEB, "2026-10-12"), nummer: "2026-001", leistung: "Oktober 2026", kunde_name: "Kim", kunde_anschrift: "Weg 1",
      positionen: [{ bezeichnung: "Haarschnitt", menge: "2", einheit: "", preis: "25,00", satz: "19" }, { bezeichnung: "Buch", menge: "1", einheit: "", preis: "10", satz: "7" }] };
    expect(erg(r, d)).toEqual([["Netto", "60,00 €"], ["Umsatzsteuer", "10,20 €"], ["Rechnungsbetrag", "70,20 €"]]);
    expect(fehlendeAngaben(r, d, BETRIEB)).toEqual([]);
    expect(fehlendeAngaben(r, d, { ...BETRIEB, steuernummer: "" })).toEqual(["Steuernummer oder USt-IdNr. (Mein Betrieb)"]);
    const ku = r.html({ ...d, kleinunternehmer: true }, BETRIEB);
    expect(ku.replace(/&nbsp;/g, " ")).toContain("Der Umsatz ist nach § 19 Abs. 1 UStG steuerfrei.");
    expect(n(ku)).toContain("60,00 €");
    expect(ku).not.toContain("Umsatzsteuer 19 %");
  });

  it("USt-Voranmeldung, EÜR und Kassenbuch rechnen", () => {
    const u = vorlageFuer("ust_voranmeldung")!;
    expect(erg(u, { umsatz_19: "1.000", umsatz_7: "100", vorsteuer: "50" })).toEqual([["Umsatzsteuer", "197,00 €"], ["Vorsteuer", "50,00 €"], ["Zahllast", "147,00 €"]]);
    expect(erg(u, { umsatz_19: "", vorsteuer: "30" })[2]).toEqual(["Erstattung", "30,00 €"]);
    const e = vorlageFuer("euer")!;
    expect(erg(e, { einnahmen: [{ text: "a", betrag: "5000" }], ausgaben: [{ text: "b", betrag: "1200,50" }], afa: [{ text: "c", betrag: "300" }] })).toEqual([["Einnahmen", "5.000,00 €"], ["Ausgaben", "1.200,50 €"], ["AfA", "300,00 €"], ["Gewinn", "3.499,50 €"]]);
    const k = vorlageFuer("kassenbuch")!;
    expect(erg(k, { anfang: "100", eintraege: [{ text: "Einnahmen", einnahme: "50" }, { text: "Einkauf", ausgabe: "30" }] })).toEqual([["Endbestand", "120,00 €"]]);
    expect(erg(k, { anfang: "10", eintraege: [{ text: "Einkauf", ausgabe: "30" }, { text: "Einnahme", einnahme: "50" }] })[1]![0]).toBe("Achtung");
  });

  it("Arbeitszeit und Aufbewahrung", () => {
    expect(arbeitsminuten("08:00", "16:30", "30")).toBe(480);
    expect(arbeitsminuten("22:00", "06:00", "")).toBe(480);
    expect(arbeitsminuten("8", "16:00", "")).toBeNull();
    expect(erg(vorlageFuer("arbeitszeitnachweis")!, { tage: [{ beginn: "08:00", ende: "12:15", pause: "" }, { beginn: "13:00", ende: "17:00", pause: "15" }] })).toEqual([["Arbeitszeit im Monat", "8:00 h"]]);
    expect(aufbewahrenBis("2025", "8")).toBe("31.12.2033");
    expect(aufbewahrenBis("", "8")).toBeNull();
    const a = leereDaten(vorlageFuer("aufbewahrung")!, BETRIEB, "2026-10-12");
    expect((a.eintraege as { jahre: string }[]).map((x) => x.jahre)).toEqual(["10", "8", "6"]);
  });

  it("Impressum und Datenschutzerklärung als Text zum Einfügen", () => {
    const i = vorlageFuer("impressum")!;
    const t = i.alsText!({ rechtsform: "Einzelunternehmen", vertreten: "Alex Muster", register: "" }, BETRIEB);
    expect(t).toContain("Impressum\n\nAngaben gemäß § 5 DDG\nSalon Sonne\nHauptstr. 1\n12345 Musterstadt\n\nInhaber/in\nAlex Muster");
    expect(t).toContain("E-Mail: info@example.de");
    expect(t).not.toContain("Registereintrag");
    expect(fehlendeAngaben(i, {}, LEERER_BETRIEB)).toContain("E-Mail (Mein Betrieb)");
    const dse = vorlageFuer("datenschutzerklaerung_website")!.alsText!({ module: ["hosting"], hoster_name: "Anbieter X", hoster_anschrift: "Weg 1, Berlin" }, BETRIEB);
    expect(dse).toContain("Diese Website wird bei Anbieter X, Weg 1, Berlin, gehostet.");
    expect(dse).toContain("Bayerisches Landesamt für Datenschutzaufsicht");
    expect(dse).not.toContain("{");
    expect(vorlageFuer("datenschutzerklaerung_website")!.alsText!({ module: ["hosting"] }, BETRIEB)).toContain("[bitte ergänzen]");
  });

  it("prüft Mindestlohn und Mindesturlaub im Nachweis", () => {
    expect(mindestlohnAm("2026-10-12")).toBe(1390);
    expect(mindestlohnAm("2027-01-01")).toBe(1460);
    expect(mindesturlaub(5)).toBe(20);
    expect(mindesturlaub(3)).toBe(12);
    expect(stundenlohn({ entgelt_art: "stunde", entgelt_betrag: "13,00" })).toBe(1300);
    // 2.600 € bei 40 Stunden: 2600 · 3 / (13 · 40) = 15 €
    expect(stundenlohn({ entgelt_art: "monat", entgelt_betrag: "2.600,00", wochenstunden: "40" })).toBe(1500);
    const v = vorlageFuer("nachweis_arbeitsbedingungen")!;
    const zuWenig = n(v.pruefen!({ beginn: "2026-10-12", entgelt_art: "stunde", entgelt_betrag: "12,00", urlaub: "18", tage_pro_woche: "5" }, BETRIEB));
    expect(zuWenig).toEqual(["Entgelt liegt unter dem gesetzlichen Mindestlohn von 13,90 € je Stunde (rechnerisch 12,00 €)", "Urlaub liegt unter dem gesetzlichen Mindesturlaub von 20 Arbeitstagen"]);
    expect(v.pruefen!({ beginn: "2026-10-12", entgelt_art: "stunde", entgelt_betrag: "14,00", urlaub: "20", tage_pro_woche: "5" }, BETRIEB)).toEqual([]);
  });

  it("warnt bei Minijob über der Grenze", () => {
    const v = vorlageFuer("sv_meldedaten")!;
    expect(n(v.pruefen!({ art: "minijob", beginn: "2026-10-12", entgelt: "650,00" }, BETRIEB))).toEqual(["Entgelt über der Minijob-Grenze von 603,00 € im Monat"]);
    expect(v.pruefen!({ art: "minijob", beginn: "2026-10-12", entgelt: "600,00" }, BETRIEB)).toEqual([]);
    expect(v.pruefen!({ art: "vollzeit", beginn: "2026-10-12", entgelt: "3.000,00" }, BETRIEB)).toEqual([]);
  });

  it("übernimmt Vorschläge als vollständige Listeneinträge", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    const f = g.abschnitte.flatMap((a) => a.felder).find((x) => x.id === "gefaehrdungen");
    if (f?.art !== "liste" || !f.vorschlaege?.length) throw new Error("Vorschläge fehlen");
    const e = eintragAusVorschlag(f, f.vorschlaege[0]!, BETRIEB, "2026-10-12");
    for (const feld of f.felder) expect(e).toHaveProperty(feld.id);
    for (const [k, w] of Object.entries(f.vorschlaege[0]!.werte)) expect(e[k]).toBe(w);
  });

  it("blendet Felder mit „nicht“-Bedingung und Mehrfachauswahl richtig ein", () => {
    const nicht = { id: "x", art: "text", label: "x", wenn: { feld: "a", nicht: true } } as Feld;
    expect(sichtbar(nicht, { a: true })).toBe(false);
    expect(sichtbar(nicht, { a: false })).toBe(true);
    const ist = { id: "y", art: "text", label: "y", wenn: { feld: "m", ist: "hosting" } } as Feld;
    expect(sichtbar(ist, { m: ["kontakt", "hosting"] })).toBe(true);
    expect(sichtbar(ist, { m: ["kontakt"] })).toBe(false);
  });

  it("füllt Platzhalter in Bausteinen und markiert Fehlendes", () => {
    const t = bausteinText("{firmenname}, {plz} {ort} – Logfiles {logfile_tage} Tage", {}, BETRIEB);
    expect(t.startsWith("Salon Sonne, 12345 Musterstadt")).toBe(true);
    expect(t).toContain("");
    expect(bausteinText("{logfile_tage}", { logfile_tage: "14" }, BETRIEB)).toBe("14");
  });

  it("enthält im AVV alle acht Pflichten nach Art. 28 Abs. 3 lit. a–h", () => {
    const html = dokumentHtml(vorlageFuer("avv")!, {}, BETRIEB);
    for (const lit of ["a", "b", "c", "d", "e", "f", "g", "h"]) expect(html).toContain(`<strong>(${lit})</strong>`);
    expect(html).not.toContain("{nr}");
  });

  it("verlangt berechtigte Interessen, sobald eine Verarbeitung auf lit. f beruht", () => {
    const v = vorlageFuer("datenschutzinformation")!;
    expect(v.pruefen!({ verarbeitungen: ["Rechnungsstellung und Buchhaltung"] }, BETRIEB).some((x) => x.includes("lit. f"))).toBe(false);
    expect(v.pruefen!({ verarbeitungen: ["Betrieb der Website (Hosting, Server-Logfiles)"] }, BETRIEB)).toContain("Berechtigte Interessen (bei Art. 6 Abs. 1 lit. f DSGVO)");
    expect(v.pruefen!({ verarbeitungen: ["Betrieb der Website (Hosting, Server-Logfiles)"], interessen: "sicherer Betrieb" }, BETRIEB)).toEqual([]);
  });

  it("verlangt bei 0 % Umsatzsteuer einen Hinweis auf die Befreiung", () => {
    const v = vorlageFuer("rechnung")!;
    const pos = [{ bezeichnung: "Leistung", menge: "1", einheit: "", preis: "100,00", satz: "0" }];
    expect(v.pruefen!({ positionen: pos }, BETRIEB)).toContain("Hinweis auf die Steuerbefreiung (bei 0 %)");
    expect(v.pruefen!({ positionen: pos, befreiung: "steuerfrei nach § 4 Nr. 14 UStG" }, BETRIEB)).toEqual([]);
    expect(v.pruefen!({ positionen: pos }, { ...BETRIEB, steuernummer: "" })).toContain("Steuernummer oder USt-IdNr. (Mein Betrieb)");
  });

  it("ordnet jede Vorlage mindestens einem Anlass zu und beschreibt sie ohne Paragrafen", () => {
    const ids = new Set(VORLAGEN.map((v) => v.id));
    for (const a of ANLAESSE) for (const id of a.vorlagen) expect(ids.has(id), `${a.id}: ${id}`).toBe(true);
    for (const v of VORLAGEN) {
      expect(ANLAESSE.some((a) => a.vorlagen.includes(v.id)), v.id).toBe(true);
      expect(KURZ[v.id], v.id).toBeTruthy();
      expect(KURZ[v.id]).not.toMatch(/§|Art\. \d/);
    }
    expect(Object.keys(KURZ).sort()).toEqual([...ids].sort());
  });

  it("gibt jedem Schritt einen Titel und kennzeichnet nur vorhandene Felder als selten", () => {
    for (const v of VORLAGEN) for (const a of v.abschnitte) expect(a.titel, v.id).toBeTruthy();
    // seltene Felder sind nie Pflicht – sonst wären sie versteckt und trotzdem gefordert
    for (const v of VORLAGEN)
      for (const a of v.abschnitte)
        for (const f of a.felder) {
          if (f.selten) expect(f.pflicht, `${v.id}.${f.id}`).toBeFalsy();
          if (f.art === "liste") for (const x of f.felder) if (x.selten) expect(x.pflicht, `${v.id}.${f.id}.${x.id}`).toBeFalsy();
        }
  });

  it("verbindet Vorlagen mit gespeicherten Mitarbeitern und Kunden", () => {
    const felderVon = (v: (typeof VORLAGEN)[number]) => new Set(v.abschnitte.flatMap((a) => a.felder.map((f) => f.id)));
    for (const v of VORLAGEN.filter((x) => x.person)) {
      const arten = new Set(PERSONEN_FELDER[v.person!.art].map((f) => f.id));
      for (const [k, feld] of Object.entries(v.person!.felder)) {
        expect(arten.has(k), `${v.id}: ${k}`).toBe(true);
        expect(felderVon(v).has(feld), `${v.id}: ${feld}`).toBe(true);
      }
    }
    const r = vorlageFuer("rechnung")!;
    expect(personAus(r, { kunde_name: "  ", kunde_anschrift: "x" })).toBeNull();
    expect(personAus(r, { kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3", kunde_ust_idnr: "" })).toEqual({ name: "Kim Beispiel", anschrift: "Gartenweg 3" });
    expect(personIn(r, { name: "Kim Beispiel", anschrift: "Gartenweg 3", ust_idnr: "" })).toEqual({ kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3" });
    const l = vorlageFuer("lohnkonto")!;
    expect(personIn(l, { name: "Sam", beginn: "2026-01-01", steuerklasse: "I" })).toEqual({ name: "Sam", eintritt: "2026-01-01", steuerklasse: "I" });
    // gleicher Name ergänzt, leere Werte überschreiben nichts
    let liste = personMerken([], { name: "Kim Beispiel", anschrift: "Gartenweg 3" }, "a");
    liste = personMerken(liste, { name: "kim beispiel ", anschrift: "", ust_idnr: "DE1" }, "b");
    expect(liste).toEqual([{ id: "a", name: "Kim Beispiel", anschrift: "Gartenweg 3", ust_idnr: "DE1" }]);
    liste = personMerken(liste, { name: "Robin" }, "c");
    expect(liste.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("zählt Rechnungsnummern fortlaufend weiter", () => {
    expect(vorlageFuer("rechnung")!.fortlaufend).toBe("nummer");
    expect(naechsteNummer([], "2026")).toBe("2026-001");
    expect(naechsteNummer(["2026-014", "2026-009", "2025-120"], "2026")).toBe("2026-015");
    expect(naechsteNummer(["2025-120"], "2026")).toBe("2026-001");
    expect(naechsteNummer(["RE-2026-0099"], "2026")).toBe("RE-2026-0100");
    expect(naechsteNummer(["17", "R18", ""], "2026")).toBe("R19");
  });

  it("kürzt lange Vorschläge zu einem lesbaren Titel", () => {
    expect(kurztitel("Ausrutschen, Stolpern und Stürzen durch glatte Böden, Schmierfilme oder Fußmatten.")).toBe("Ausrutschen, Stolpern und Stürzen");
    expect(kurztitel("Versperrte Verkehrs- und Fluchtwege, zu enge Bewegungsflächen")).toBe("Versperrte Verkehrs- und Fluchtwege");
    expect(kurztitel("Unzureichende Frischluftzufuhr, dadurch Belastung durch Dämpfe")).toBe("Unzureichende Frischluftzufuhr");
    expect(kurztitel("Hautkontakt mit Friseurchemikalien (Färbe-, Blondiermittel)")).toBe("Hautkontakt mit Friseurchemikalien");
    expect(kurztitel("Kühlschrank")).toBe("Kühlschrank");
  });

  it("macht aus einer Rechnung der App eine E-Rechnung (XRechnung, UBL) und nennt, was fehlt", () => {
    const b = { ...BETRIEB, email: "info@salon.example", telefon: "089 1", iban: "DE02120300000000202051" };
    const d = { nummer: "2026-014", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafenstraße 12\n20457 Hamburg", kunde_email: "a@b.example", positionen: [{ bezeichnung: "Haarschnitt", menge: "2", einheit: "Stunde", preis: "25,00", satz: "19" }] };
    const { daten, fehlt } = eRechnungAus(d, b);
    expect(fehlt).toEqual([]);
    expect(daten.kunde).toMatchObject({ strasse: "Hafenstraße 12", plz: "20457", ort: "Hamburg" });
    expect(daten.faellig_am).toBe("2026-10-26");
    const xml = xrechnungUbl(daten, KU_HINWEIS);
    expect(xml).toContain("<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>");
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="HUR">2</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">59.50</cbc:PayableAmount>');
    expect(xml).toContain("Hafenstraße 12");
    const ohne = eRechnungAus({ ...d, kunde_anschrift: "Hamburg", kunde_email: "", positionen: [{ ...d.positionen[0], satz: "0" }] }, { ...b, iban: "" }).fehlt;
    expect(ohne).toEqual(expect.arrayContaining(["IBAN (Mein Betrieb)", "E-Mail des Empfängers", "Anschrift des Empfängers: Straße in der ersten, PLZ und Ort in der letzten Zeile"]));
    expect(ohne.some((x) => x.includes("0 %"))).toBe(true);
  });

  it("E-Rechnung ins Ausland: Wien mit Steuerschuldnerschaft des Empfängers (AE), Lieferung in die Niederlande (K)", () => {
    const b = { ...BETRIEB, email: "info@salon.example", telefon: "089 1", iban: "DE02120300000000202051", ust_idnr: "DE123456789" };
    const wien = { nummer: "2026-020", datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", kunde_name: "Studio Wien GmbH", kunde_anschrift: "Mariahilfer Straße 1\n1060 Wien\nÖsterreich", kunde_email: "office@studio.example", kunde_ust_idnr: "ATU12345678", hinweise: ["reverse_charge"], positionen: [{ bezeichnung: "Beratung", menge: "4", einheit: "Stunde", preis: "90,00", satz: "0" }] };
    const r = eRechnungAus(wien, b);
    expect(r.fehlt).toEqual([]);
    expect(r.daten.kunde).toMatchObject({ strasse: "Mariahilfer Straße 1", plz: "1060", ort: "Wien", land: "AT" });
    const xml = xrechnungUbl(r.daten, KU_HINWEIS);
    expect(xml).toContain("<cbc:ID>AE</cbc:ID>");
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>");
    expect(xml).toContain("<cbc:IdentificationCode>AT</cbc:IdentificationCode>");
    // ohne Länderzeile: aus PLZ-Präfix bzw. USt-IdNr.
    expect(eRechnungAus({ ...wien, kunde_anschrift: "Mariahilfer Straße 1\nA-1060 Wien" }, b).daten.kunde.land).toBe("AT");
    expect(eRechnungAus({ ...wien, kunde_anschrift: "Mariahilfer Straße 1\n1060 Wien" }, b).daten.kunde.land).toBe("AT");
    // vierstellige PLZ ohne Land und ohne USt-IdNr.: Amtlos fragt nach dem Land
    expect(eRechnungAus({ ...wien, kunde_ust_idnr: "", kunde_anschrift: "Mariahilfer Straße 1\n1060 Wien" }, b).fehlt).toEqual(expect.arrayContaining(["Land des Empfängers in der letzten Zeile der Anschrift (z. B. Österreich)", "USt-IdNr. des Empfängers"]));
    // ohne eigene USt-IdNr. keine Steuerschuldnerschaft des Empfängers
    expect(eRechnungAus(wien, { ...b, ust_idnr: "" }).fehlt).toContain("USt-IdNr. des Betriebs (Mein Betrieb)");
    const nl = eRechnungAus({ ...wien, kunde_name: "Winkel BV", kunde_anschrift: "Damrak 1\n1012 LG Amsterdam\nNiederlande", kunde_ust_idnr: "NL123456789B01", hinweise: ["igl"], positionen: [{ bezeichnung: "Shampoo, Karton", menge: "10", einheit: "Stück", preis: "40,00", satz: "0" }] }, b);
    expect(nl.fehlt).toEqual([]);
    expect(nl.daten.kunde).toMatchObject({ plz: "1012 LG", ort: "Amsterdam", land: "NL" });
    expect(xrechnungUbl(nl.daten, KU_HINWEIS)).toContain("<cbc:ID>K</cbc:ID>");
  });

  it("Korrekturen aus der Durchsicht: Befreiungshinweis, Vorzeichen, leere Vorlagen, Angaben aus „Mein Betrieb“", () => {
    const html = (id: string, d: Daten, b: Betrieb = BETRIEB) => n(dokumentHtml(vorlageFuer(id)!, d, b));
    const pos = (satz: string) => [{ bezeichnung: "Haarschnitt", menge: "1", preis: "25", satz }];
    // Steuerbefreiung nur bei einer 0-%-Position
    expect(html("rechnung", { nummer: "1", positionen: pos("19"), befreiung: "Steuerfrei nach § 4 Nr. 14 UStG" })).not.toContain("Steuerfrei nach");
    expect(html("rechnung", { nummer: "1", positionen: pos("0"), befreiung: "Steuerfrei nach § 4 Nr. 14 UStG" })).toContain("Steuerfrei nach");
    expect(eRechnungAus({ nummer: "1", datum: "2026-10-12", positionen: pos("19"), befreiung: "x" }, BETRIEB).daten.befreiungsgrund).toBeNull();
    // fehlende Rechnungsnummer steht unter „Fehlt noch“ (Pflichtfeld)
    expect(fehlendeAngaben(vorlageFuer("rechnung")!, { positionen: pos("19") }, BETRIEB)).toContain("Rechnungsnummer");
    // Kz 83 mit Vorzeichen; Verlust/Fehlbetrag ohne doppeltes Minus
    expect(html("ust_voranmeldung", { umsatz_19: "100", vorsteuer: "50" })).toContain("-31,00 €");
    expect(erg(vorlageFuer("euer")!, { einnahmen: [{ betrag: "10" }], ausgaben: [{ betrag: "30" }] })).toContainEqual(["Verlust", "20,00 €"]);
    expect(erg(vorlageFuer("bilanz_guv")!, { ertraege: [{ betrag: "10" }], aufwendungen: [{ betrag: "30" }] })[0]).toEqual(["Jahresfehlbetrag", "20,00 €"]);
    // leere Vorlagen: Zeilen zum Ausfüllen, keine Summe 0
    const az = html("arbeitszeitnachweis", {});
    expect(az).not.toContain("0:00 h");
    expect(az.match(/<tr><td>/g)).toHaveLength(31);
    expect(html("bilanz_guv", {})).not.toContain("0,00 €");
    expect(html("kassenbuch", {})).toContain("Vorlage zum Ausdrucken");
    expect(html("kassenbuch", { eintraege: [{ text: "Einnahmen", einnahme: "10" }] })).not.toContain("Vorlage zum Ausdrucken");
    // Rechtsform, Vertretung und Register aus „Mein Betrieb“
    const gmbh: Betrieb = { ...BETRIEB, name: "Salon Sonne GmbH", rechtsform: "GmbH", vertretung: "Alex Muster, Kim Muster", registergericht: "Amtsgericht München", registernummer: "HRB 1" };
    const imp = vorlageFuer("impressum")!.alsText!(leereDaten(vorlageFuer("impressum")!, gmbh, "2026-10-12"), gmbh);
    expect(imp).toContain("Vertreten durch\nAlex Muster, Kim Muster");
    expect(imp).toContain("Registergericht: Amtsgericht München\nRegisternummer: HRB 1");
    expect(vorlageFuer("impressum")!.alsText!({ wirtschafts_id: "DE1" }, { ...gmbh, ust_idnr: "DE2" })).toContain("Umsatzsteuer-ID und Wirtschafts-ID");
    expect(html("gewerbeanmeldung", leereDaten(vorlageFuer("gewerbeanmeldung")!, gmbh, "2026-10-12"), gmbh)).toContain(">GmbH<");
    expect(html("handelsregister", {}, gmbh)).toContain(">Salon Sonne GmbH<");
    expect(html("transparenzregister", {}, gmbh)).toContain("Amtsgericht München, HRB 1");
    expect(bausteinText("nach {30} Tagen", { logfile_tage: "1" }, BETRIEB)).toBe("nach 1 Tag");
    // Datenpanne: Benachrichtigung bleibt offen, bis sie bewertet ist
    expect(html("datenpanne", leereDaten(vorlageFuer("datenpanne")!, BETRIEB, "2026-10-12"))).toMatch(/Benachrichtigung der Betroffenen<\/th><td>noch offen/);
    expect(vorlageFuer("datenschutzinformation")!.pruefen!({ verarbeitungen: ["Gibt es nicht"] }, BETRIEB)).toContain("Verarbeitung „Gibt es nicht“ gibt es nicht mehr – bitte neu auswählen");
  });

  it("Korrekturen aus der zweiten Durchsicht: verdeckte Felder, leere Blätter, Gutschrift, Hinweise", () => {
    const html = (id: string, d: Daten, b: Betrieb = BETRIEB) => n(dokumentHtml(vorlageFuer(id)!, d, b));
    const leer = (id: string, b: Betrieb = BETRIEB) => html(id, leereDaten(vorlageFuer(id)!, b, "2026-10-12"), b);
    const pruefe = (id: string, d: Daten, b: Betrieb = BETRIEB) => vorlageFuer(id)!.pruefen!(d, b);
    // verdeckte Felder gelangen nicht ins Dokument – gespeicherte Daten und Prüfung bleiben unberührt
    const haccp = { zeitraum: "Oktober", messungen: [{ datum: "2026-10-12", kontrollpunkt: "Kühlschrank", wert: "5 °C", in_ordnung: "ja", massnahme: "Alte Maßnahme" }] };
    expect(html("haccp", haccp)).not.toContain("Alte Maßnahme");
    expect(html("haccp", { ...haccp, messungen: [{ ...haccp.messungen[0]!, in_ordnung: "nein" }] })).toContain("Alte Maßnahme");
    expect(haccp.messungen[0]!.massnahme).toBe("Alte Maßnahme");
    // Datenpanne: kein Datum an „nicht erforderlich“, keine Meldung bei „kein Risiko“, auch nicht ihre Folgefelder
    const panne = { entdeckt_am: "2026-10-12", risiko: "kein_risiko", gemeldet: true, gemeldet_am: "2026-10-13", verspaetung: "Urlaub", benachrichtigung: "nicht_erforderlich", benachrichtigt_am: "2026-10-14", benachrichtigung_text: "per Brief" };
    const dp = html("datenpanne", panne);
    // kein Risiko: reine Dokumentation, keine 72-Stunden-Frist, Meldung nicht erforderlich
    expect(dp).toContain("nicht erforderlich (keine Meldepflicht)");
    expect(dp).toContain("<h1>Datenpanne – Dokumentation</h1>");
    expect(dp).not.toContain("Frist (72 Stunden)");
    expect(dp).not.toContain("13.10.2026");
    expect(dp).not.toContain("Begründung der späteren Meldung");
    expect(dp).not.toContain("per Brief");
    expect(dp).not.toContain("14.10.2026");
    expect(vorlageFuer("datenpanne")!.abschnitte.flatMap((a) => a.felder).filter((f) => f.id === "gemeldet" && sichtbar(f, panne))).toHaveLength(0);
    expect(html("datenpanne", { ...panne, risiko: "risiko", benachrichtigung: "erfolgt" })).toContain("Begründung der späteren Meldung");
    expect(html("datenpanne", { ...panne, risiko: "risiko", benachrichtigung: "erfolgt" })).toContain("am 14.10.2026 – per Brief");
    // Randspalte: „lit.“ bleibt beim Buchstaben, auch „lit. a, b“
    const vvt = html("datenschutz_dokumentation", { verarbeitungen: [{ bezeichnung: "Kundenkartei" }] });
    expect(vvt).toContain('<span class="nb">lit.&nbsp;b–g</span>');
    expect(vvt).not.toMatch(/Verarbeitungen<\/dt><dd>0/);
    expect(html("datenschutzinformation", leereDaten(vorlageFuer("datenschutzinformation")!, BETRIEB, "2026-10-12"))).not.toMatch(/lit\.(&nbsp;| )a, b/);
    // leere Blätter: Zeilen und Linien zum Ausfüllen statt „Keine … erfasst“ und „0,00 €“
    expect(html("allergene", {})).not.toContain("Keine Gerichte erfasst");
    expect(html("allergene", {}).match(/<tr><td>&nbsp;<\/td>/g)).toHaveLength(12);
    expect(html("haccp", {})).toContain("Korrekturmaßnahme</th>");
    expect(html("haccp", {})).toContain("<th>Zeitraum</th>");
    const euer = html("euer", {});
    expect(euer).not.toContain("0,00 €");
    expect(euer).not.toContain("erfasst");
    expect(euer).toContain("Gewinn bzw. Verlust");
    const re = leer("rechnung");
    expect(re).not.toContain("0,00 €");
    expect(re).toMatch(/Rechnungsnummer<\/td><td><span class="fuellen">/);
    const az = html("arbeitszeitnachweis", {});
    expect(az).toContain("<th>Beschäftigte Person</th>");
    expect(az).toContain("<th>Monat</th>");
    expect(html("arbeitszeitnachweis", { name: "Kim", monat: "Oktober", leerzeilen: true, tage: [{ datum: "2026-10-01", beginn: "08:00", ende: "12:00" }] })).toContain("Summe der erfassten Tage");
    const lk = html("lohnkonto", {});
    expect(lk).not.toContain("Noch keine Monate erfasst");
    expect(lk).toContain("Unterbrechung ohne Lohnanspruch");
    expect(lk).toContain("Kinderfreibeträge");
    expect(lk).toContain("Soli­daritäts­zuschlag");
    expect(html("lohnkonto", { monate: [{ monat: "Oktober", brutto: "100" }] })).not.toContain("Kinderfreibeträge");
    const km = html("kassenmeldung", {});
    expect(km).not.toContain("Keine Kassen erfasst");
    expect(km).toContain("Aufzeichnungssystem 1");
    expect(km).not.toMatch(/Anzahl der Aufzeichnungssysteme<\/th><td class="wert">0/);
    // Feldnummern laufen nach den tatsächlich gedruckten Zeilen weiter
    const kasse = { modell: "A", seriennummer: "1" };
    expect(html("kassenmeldung", { kassen: [kasse, kasse] })).toMatch(/Aufzeichnungssystem 2<\/h2><table class="felder"><tr><td class="nr">09</);
    expect(html("verfahrensdokumentation", {})).toContain("Änderung</th>");
    // Gewerbeanmeldung und Handelsregister
    const gmbh: Betrieb = { ...BETRIEB, name: "Salon Sonne GmbH", rechtsform: "GmbH" };
    expect(html("gewerbeanmeldung", {}, gmbh)).toContain("<th>Registereintrag</th>");
    expect(html("gewerbeanmeldung", {})).not.toContain("Registereintrag");
    expect(html("gewerbeanmeldung", {})).toContain("Zahl der Beschäftigten");
    expect(html("gewerbeanmeldung", {})).toContain("Erlaubnis, Handwerkskarte");
    const hr = html("handelsregister", {}, gmbh);
    expect(hr).toContain("Gesellschafter</h2>");
    expect(hr).toContain("<th>Stammkapital</th>");
    expect(hr).toContain("Geburtsdatum</th>");
    expect(html("handelsregister", {}, { ...BETRIEB, rechtsform: "e. K." })).not.toContain("Gesellschafter</h2>");
    // Transparenzregister: Meldedatum nur einmal
    expect(html("transparenzregister", { gemeldet: "2026-10-01" }).match(/Gemeldet am/g)).toHaveLength(1);
    // Nachweis: Versorgungsträger benannt, leere beschäftigte Person mit Linie für die Anschrift
    expect(html("nachweis_arbeitsbedingungen", { bav: true, bav_text: "Versorgungskasse X" })).toContain("Über den Versorgungsträger: Versorgungskasse X");
    expect(html("nachweis_arbeitsbedingungen", {})).toMatch(/<div class="name"><span class="fuellen"><\/span><\/div><div class="adresse"><span class="fuellen">/);
    // Gutschrift: Titel, Anrede, keine Zahlungsaufforderung, „Gutschrift“ nicht doppelt
    const gs = html("rechnung", { nummer: "G-1", datum: "2026-10-12", zahlungsziel: "14", kunde_name: "Kim", hinweise: ["gutschrift"], positionen: [{ bezeichnung: "Provision", menge: "1", preis: "100", satz: "19" }] });
    expect(gs).toContain(">Gutschrift G-1<");
    expect(gs).toContain("schreiben Ihnen den Betrag gut");
    expect(gs).not.toContain("Bitte überweisen");
    expect(gs).not.toContain("Zahlbar");
    expect(gs).not.toContain("GiroCode");
    expect(gs).not.toContain("<p>Gutschrift</p>");
    // Hinweise (keine Hindernisse)
    expect(pruefe("rechnung", { kleinunternehmer: true, hinweise: ["reverse_charge"] })).toContain("Kleinunternehmerregelung zusammen mit Steuerschuldnerschaft des Leistungsempfängers bzw. innergemeinschaftlicher Lieferung gewählt – bitte prüfen.");
    expect(pruefe("gefaehrdungsbeurteilung", { wirksamkeit: "wirksam", gefaehrdungen: [{ beschreibung: "Nässe" }] })).toHaveLength(1);
    expect(pruefe("gefaehrdungsbeurteilung", { wirksamkeit: "wirksam", gefaehrdungen: [{ beschreibung: "Nässe", umgesetzt_am: "2026-10-01" }] })).toHaveLength(0);
    expect(pruefe("datenschutzerklaerung_website", { module: ["google_fonts_lokal", "google_fonts_extern"] })).toContain("Schriftarten: entweder lokal oder extern wählen");
    expect(pruefe("impressum", { rechtsform: "Einzelunternehmen" }, gmbh).some((h) => h.includes("„GmbH“"))).toBe(true);
    expect(pruefe("impressum", { rechtsform: "GmbH" }, gmbh).some((h) => h.includes("Rechtsform"))).toBe(false);
    expect(pruefe("impressum", { rechtsform: "KG" }, { ...gmbh, name: "Sonne GmbH & Co. KG" }).some((h) => h.includes("„GmbH & Co. KG“"))).toBe(true);
    // Datenschutzerklärung: extern geht vor, kein Rat an den Betreiber im Text
    const dse = vorlageFuer("datenschutzerklaerung_website")!.alsText!({ module: ["google_fonts_lokal", "google_fonts_extern"] }, BETRIEB);
    expect(dse).not.toContain("lokal eingebunden");
    expect(dse).not.toContain("Empfehlung");
    // Steuererklärung: USt-Felder nur mit Umsatzsteuererklärung; Aufbewahrung „1 Jahr“; Erstattung
    const ust = vorlageFuer("steuererklaerung")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "ust_jahr")!;
    expect(sichtbar(ust, { arten: ["est"] })).toBe(false);
    expect(sichtbar(ust, { arten: ["est", "ust"] })).toBe(true);
    expect(html("aufbewahrung", { eintraege: [{ art: "Briefe", jahre: "1" }] })).toContain("1 Jahr<");
    expect(html("ust_voranmeldung", { vorsteuer: "50" })).toContain("Erstattung erhalten am");
    expect(html("pruefprotokoll_elektro", { einsatz: "baustellen" })).not.toMatch(/DGUV Vorschrift 3 \(DGUV/);
  });
  it("Korrekturen aus der dritten Durchsicht: Bausteine ohne Quellenvermerke, leere Blätter, Hinweise", () => {
    const html = (id: string, d: Daten, b: Betrieb = BETRIEB) => n(dokumentHtml(vorlageFuer(id)!, d, b));
    const leer = (id: string, b: Betrieb = BETRIEB) => html(id, leereDaten(vorlageFuer(id)!, b, "2026-10-12"), b);
    const pruefe = (id: string, d: Daten, b: Betrieb = BETRIEB) => vorlageFuer(id)!.pruefen!(d, b);
    const kopfLinie = (titel: string) => `<dt>${titel}</dt><dd><span class="fuellen"></span></dd>`;
    // HACCP: Quellen stehen im Feld „quelle“, nicht im Drucktext; beide Grenzwerte bleiben stehen
    const haccp = vorlageFuer("haccp")!.abschnitte.flatMap((a) => a.felder).find((f) => f.art === "liste")!;
    const vorschlaege = haccp.art === "liste" ? haccp.vorschlaege! : [];
    for (const v of vorschlaege) for (const k of ["grenzwert", "haeufigkeit", "korrektur"]) expect(String(v.werte[k])).not.toMatch(/Mainz|LAVES|BfR|BgVV|DGF|Älterer Wert/);
    const heiss = vorschlaege.find((v) => v.titel.startsWith("Heißhalten"))!;
    expect(String(heiss.werte.grenzwert)).toContain("+60 °C");
    expect(String(heiss.werte.grenzwert)).toContain("+65 °C");
    expect(heiss.quelle).toContain("BfR 2008");
    // Datenschutzinformation: keine Quellenvermerke im Text, Löschung als Aussage
    const dsi = html("datenschutzinformation", { fuer_wen: "Kunden", verarbeitungen: ["Kundenverwaltung / Kundenkartei", "Videoüberwachung (z. B. Verkaufsraum, Eingang, Lager)", "Bewerbungsverfahren", "E-Mail-Newsletter / E-Mail-Werbung"], interessen: "Schutz" });
    expect(dsi).not.toMatch(/BayLDA-Muster|laut DSK/);
    expect(dsi).toContain("Kundenstammdaten werden gelöscht, sobald");
    expect(dsi).toContain("Aufnahmen werden in der Regel nach 72 Stunden gelöscht");
    // USt-Voranmeldung: leeres Blatt ohne „0,00 €“, Zeitraum als Linie, Hinweis zu ELSTER
    const uv = leer("ust_voranmeldung");
    expect(uv).not.toContain("0,00 €");
    expect(uv).toContain(kopfLinie("Zeitraum"));
    expect(uv).not.toContain("wie hier angegeben");
    expect(html("ust_voranmeldung", { vorsteuer: "50" })).toContain("ELSTER rechnet aus vollen Euro; maßgeblich ist der Betrag, den ELSTER errechnet.");
    expect(html("ust_voranmeldung", { umsatz_19: "100" })).toContain("19,00 €");
    // Rechnung: leere Vorlage mit Umsatzsteuerzeile, Kleinunternehmer ohne; Leistungszeitraum
    expect(leer("rechnung")).toContain('Umsatzsteuer <span class="fuellen kurz"></span> %');
    expect(html("rechnung", { kleinunternehmer: true })).not.toContain("fuellen kurz");
    expect(html("rechnung", { leistung_gleich: false, leistung: "Oktober 2026" })).toContain("Leistungsdatum/-zeitraum");
    // Prüfprotokoll, Kassenbuch, Steuererklärung, Bilanz, EÜR, Hautschutzplan: Angaben zum Eintragen
    const pp = leer("pruefprotokoll_elektro");
    expect(pp).toContain(kopfLinie("Geprüft von"));
    expect(pp).toMatch(/<th>Prüfgrundlage<\/th><td><span class="fuellen">/);
    expect(pp).toMatch(/<th>Prüfgerät<\/th><td><span class="fuellen">/);
    expect(leer("kassenbuch")).toContain(kopfLinie("Zeitraum"));
    const se = leer("steuererklaerung");
    expect(se).toContain(kopfLinie("Jahr"));
    expect(se).toContain("Umsätze im Jahr (netto)");
    expect(html("steuererklaerung", { jahr: "2026", gewinn: "100" })).not.toContain("Umsätze im Jahr");
    const bg = leer("bilanz_guv");
    expect(bg).toContain(kopfLinie("Bilanzstichtag"));
    expect(bg.split('<tr class="summe">').length - 1).toBe(4);
    const eu = leer("euer");
    expect(eu).toContain(kopfLinie("Jahr"));
    expect(eu.split('<tr class="summe">').length - 1).toBe(3);
    expect(leer("hautschutzplan")).toContain(kopfLinie("Bereich"));
    // Aufbewahrung: Fristbeginn kein Jahr
    expect(pruefe("aufbewahrung", { eintraege: [{ art: "Belege", jahre: "8", letzte: "26" }] })).toHaveLength(1);
    expect(pruefe("aufbewahrung", { eintraege: [{ art: "Belege", jahre: "8", letzte: "2026" }, { art: "Briefe", jahre: "6" }] })).toHaveLength(0);
    // Personalfragebogen: Widersprüche, leeres Blatt ohne Startauswahl, Schlüssel vor dem Text
    expect(pruefe("sv_meldedaten", { art: "teilzeit", vertragsform: "1", personengruppe: "101" }).some((h) => h.includes("Vertragsform"))).toBe(true);
    expect(pruefe("sv_meldedaten", { art: "vollzeit", vertragsform: "1", personengruppe: "101" })).toHaveLength(0);
    expect(pruefe("sv_meldedaten", { art: "minijob", personengruppe: "101" }).some((h) => h.includes("109"))).toBe(true);
    expect(pruefe("sv_meldedaten", { art: "minijob", personengruppe: "109" })).toHaveLength(0);
    expect(pruefe("sv_meldedaten", { art: "ausbildung", personengruppe: "101" }).some((h) => h.includes("102"))).toBe(true);
    expect(pruefe("sv_meldedaten", { art: "ausbildung", personengruppe: "121" })).toHaveLength(0);
    const sv = leer("sv_meldedaten");
    expect(sv).not.toContain("Vollzeit");
    expect(sv).not.toContain("101 –");
    expect(sv).toContain("Geburtsname (falls abweichend)");
    expect(sv).toMatch(/<td class="nr">11<\/td><th>Beginn<\/th>/);
    const svVoll = html("sv_meldedaten", { name: "Kim", art: "vollzeit", personengruppe: "101", vertragsform: "1", schulabschluss: "4" });
    expect(svVoll).toContain("1 – Vollzeit, unbefristet");
    expect(svVoll).toContain("4 – Abitur/Fachabitur");
    expect(svVoll).not.toContain("Geburtsname");
    expect(svVoll).toMatch(/<td class="nr">10<\/td><th>Beginn<\/th>/);
    // Arbeitszeit: Tage nur mit Bemerkung, Pause gerundet, je fehlender Angabe eine Zeile
    const az = html("arbeitszeitnachweis", { name: "Kim", monat: "Oktober", tage: [{ datum: "2026-10-01", beginn: "08:00", ende: "16:30", pause: "7,5" }, { datum: "2026-10-02", bemerkung: "Urlaub" }] });
    expect(az).toContain("Urlaub");
    expect(az).toContain("8:22 h");
    expect(az).not.toContain(".5 h");
    expect(arbeitsminuten("08:00", "16:30", "7,5")).toBe(502);
    const azMonat = html("arbeitszeitnachweis", { name: "Kim" });
    expect(azMonat).toContain("<th>Monat</th>");
    expect(azMonat).not.toContain("<th>Beschäftigte Person</th>");
    // Teilnahme: letzter Name bleibt mit den Leerzeilen zusammen
    const uw = html("unterweisung", { thema: "Jährlich", datum: "2026-10-12", durchgefuehrt_von: "Alex", teilnehmer: [{ name: "Kim" }, { name: "Lou" }] });
    expect(uw).toMatch(/<tbody class="schluss"><tr><td>Lou<\/td>/);
    // Unterweisung und KI-Schulung: Dauer als Linie, Datum und Durchführende nicht doppelt
    expect(uw).toMatch(/<th>Dauer<\/th><td><span class="fuellen">/);
    expect(uw).not.toContain("<th>Durchgeführt von</th>");
    expect(html("unterweisung", { thema: "Jährlich" })).toContain("<th>Durchgeführt von</th>");
    const ki = html("ki_kompetenz", { thema: "KI", datum: "2026-10-12", durchgefuehrt_von: "Alex" });
    expect(ki).toMatch(/<th>Dauer<\/th><td><span class="fuellen">/);
    expect(ki).not.toContain("<th>Datum</th>");
    expect(html("ki_kompetenz", { thema: "KI", datum: "2026-10-12", durchgefuehrt_von: "Alex", dauer: "1 h" })).not.toContain("<th>Dauer</th>");
    // Impressum: keine Inhaltsübersicht, Stammkapital eigener Teil nach dem Registereintrag
    const gmbh: Betrieb = { ...BETRIEB, name: "Sonne GmbH", rechtsform: "GmbH", registergericht: "AG München", registernummer: "HRB 1", vertretung: "Alex Muster" };
    const imp = html("impressum", { rechtsform: "GmbH", kapital: "25.000 €", ausstehend: "12.500 €", vsbg: "nicht_bereit", reglementiert: true }, gmbh);
    expect(imp).not.toContain("<nav class=\"inhalt-uebersicht");
    expect(imp.indexOf("Registereintrag")).toBeLessThan(imp.indexOf(">Stammkapital<"));
    expect(imp).not.toMatch(/Alex Muster<br>Stammkapital/);
    // Transparenzregister: Meldedatum nur in Feld 04
    const tr = leer("transparenzregister");
    expect(tr).not.toContain("noch nicht gemeldet");
    expect(tr).not.toContain("Gemeldet am (transparenzregister.de)");
    expect(tr).toContain('<col style="width:11%">');
    // Verfahrensdokumentation: leere Tabelle der Programme
    expect(leer("verfahrensdokumentation")).toContain("<th>Programm, Gerät</th>");
    // Verzeichnis: Spalte „Verantwortlich“ nur bei Angabe, leeres Blatt ohne „Keine … erfasst.“
    const vvt = html("datenschutz_dokumentation", { tom: [{ schutzziel: "vertraulichkeit", massnahme: "Passwörter" }] });
    expect(vvt).not.toContain("<th>Verantwortlich</th>");
    expect(html("datenschutz_dokumentation", { tom: [{ schutzziel: "vertraulichkeit", massnahme: "Passwörter", verantwortlich: "Alex" }] })).toContain("<th>Verantwortlich</th>");
    expect(leer("datenschutz_dokumentation")).not.toContain("erfasst.");
    // AVV: Unterschriften mit den Namen der Parteien
    expect(html("avv", { rolle: "auftraggeber", partner: "Host AG" })).toContain("Auftragnehmer (Host AG)");
    // Handelsregister: GmbH mit Geschäftsführung und Vertretungsregelung
    const hr = html("handelsregister", { rechtsform: "GmbH" });
    expect(hr).toContain("Vertretungsregelung");
    expect(hr).toContain(">Geschäftsführung<");
    expect(hr).toContain("<th>Stammkapital</th>");
    expect(html("handelsregister", { rechtsform: "e. K." })).toContain("Geschäftsführung bzw. Inhaber/in");
    // Datenschutzerklärung: Zeilenumbrüche bleiben, Website nicht doppelt
    const dse = html("datenschutzerklaerung_website", { website: "www.sonne.example", ergaenzung: "Erste Zeile\nZweite Zeile" });
    expect(dse).toContain("Erste Zeile<br>Zweite Zeile");
    expect(dse).not.toContain("<dt>Website</dt>");
    // Gewerbeanmeldung: Geburtsname auf dem leeren Blatt, Rechtsform im Namen
    expect(leer("gewerbeanmeldung")).toContain("Geburtsname (falls abweichend)");
    expect(pruefe("gewerbeanmeldung", { rechtsform: "Einzelunternehmen" }, gmbh).some((h) => h.includes("„GmbH“"))).toBe(true);
    expect(pruefe("gewerbeanmeldung", { rechtsform: "GmbH" }, gmbh)).toHaveLength(0);
    // Handbuch: lange Textabschnitte dürfen umbrechen
    expect(dse).toContain("lang-im-handbuch");
  });
});
