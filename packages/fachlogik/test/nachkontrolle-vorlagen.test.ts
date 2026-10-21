/**
 * Nachkontrolle Dr. Weber (21.10.2026), Vorlagen: Ausschlussfrist im NachwG-Nachweis, sichtbarer Schriftform-Hinweis für
 * die Branchen nach § 2a SchwarzArbG und Hygieneplan für Lebensmittelbetriebe.
 */
import { describe, expect, it } from "vitest";
import { MARKE } from "@amtlos/marke";
import { dokumentHtml, leereDaten, vorlageFuer, type Betrieb, type Daten, type Feld, type ListenFeld } from "../src/index.js";
import { HYGIENE_LEBENSMITTEL, HYGIENE_THEMEN_LEBENSMITTEL } from "../src/dokumente/branchen.js";
import { NACHWG_AUSSCHLUSSFRIST_BEISPIEL, NACHWG_SCHRIFTFORM_HINWEIS, NACHWG_SCHRIFTFORM_PDF } from "../src/dokumente/personal.js";

const B: Betrieb = { name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", verantwortlich: "Alex Sonnberg", telefon: "089 123456", email: "hallo@salon-sonne.example", steuernummer: "143/123/45678", ust_idnr: "", iban: "", bundesland: "Bayern" };
const v = (id: string) => vorlageFuer(id)!;
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ").replace(/\u00ad/g, "");
const html = (id: string, d: Daten, b: Betrieb = B) => glatt(dokumentHtml(v(id), d, b));
const feld = (id: string, f: string) => v(id).abschnitte.flatMap((a) => a.felder).find((x) => x.id === f) as Feld & { hilfe?: string; vorschlaege?: unknown[] };

const NW: Daten = {
  name: "Jana Becker", anschrift: "Lindenstraße 12\n80469 München", beginn: "2026-11-01", entgelt_art: "monat", entgelt_betrag: "2.650,00", wochenstunden: "38,5", tage_pro_woche: "5",
  ueberstunden: "ja", ueberstunden_text: "bei unvorhersehbarem Arbeitsanfall, höchstens 10 Stunden im Monat",
  ueberstunden_verguetung: "Jede angeordnete Überstunde wird mit dem rechnerischen Stundenlohn (Monatsgehalt geteilt durch 167 Stunden) zuzüglich eines Zuschlags von 25 % vergütet und mit dem Gehalt des Folgemonats ausgezahlt.",
  faelligkeit: "am letzten Bankarbeitstag des laufenden Monats", auszahlung: "Überweisung", urlaub: "28", weitere: NACHWG_AUSSCHLUSSFRIST_BEISPIEL, ausgestellt_am: "2026-10-13",
};

describe("NachwG: Beispiel der Ausschlussfrist", () => {
  it("nimmt Körperschäden, Vorsatz und grobe Fahrlässigkeit, Mindestlohn und unverzichtbare Ansprüche aus; beide Stufen mindestens drei Monate", () => {
    const t = NACHWG_AUSSCHLUSSFRIST_BEISPIEL;
    expect(t).toContain("Verletzung des Lebens, des Körpers oder der Gesundheit");
    expect(t).toContain("vorsätzlicher oder grob fahrlässiger Pflichtverletzung");
    expect(t).toContain("gesetzlichen Mindestlohn (§ 3 Satz 1 MiLoG)");
    expect(t).toContain("Ansprüche, auf die nicht verzichtet werden kann");
    expect(t.match(/innerhalb von drei Monaten/g)).toHaveLength(2);
    expect(t).not.toMatch(/\b(einem|zwei) Monat/);
    expect(feld("nachweis_arbeitsbedingungen", "weitere").vorschlaege).toEqual([t]);
  });
  it("Hilfetext: Muster, nur nach rechtlicher Beratung anpassen", () => {
    expect(feld("nachweis_arbeitsbedingungen", "weitere").hilfe).toMatch(/Muster: Klauseln wie diese nur nach rechtlicher Beratung übernehmen und an deinen Vertrag anpassen/);
    expect(feld("nachweis_arbeitsbedingungen", "weitere").hilfe).toMatch(/Ausschlussfristen und Wettbewerbsverbote/);
  });
  it("steht im Nachweis unter Nr. 16; mit den Ausnahmen kein Hinweis, ohne sie ein Hinweis", () => {
    expect(html("nachweis_arbeitsbedingungen", NW)).toContain("grob fahrlässiger Pflichtverletzung");
    const h = (d: Daten) => v("nachweis_arbeitsbedingungen").hinweise!(d, B).join(" ");
    expect(h(NW)).not.toMatch(/Ausschlussfrist:|Überstunden:/);
    const alt = "Ansprüche aus dem Arbeitsverhältnis verfallen, wenn sie nicht innerhalb von drei Monaten nach Fälligkeit in Textform geltend gemacht werden; das gilt nicht für den Mindestlohn und für Ansprüche aus vorsätzlicher Pflichtverletzung.";
    expect(h({ ...NW, weitere: alt })).toMatch(/Ausschlussfrist: Es fehlen Ausnahmen \(Verletzung von Leben, Körper oder Gesundheit, grobe Fahrlässigkeit\)/);
  });
  it("Überstunden widerspruchsfrei: kein „vereinbarter Stundenlohn“ beim Monatsgehalt, nicht zugleich abgegolten und vergütet", () => {
    const h = (d: Daten) => v("nachweis_arbeitsbedingungen").hinweise!(d, B).join(" ");
    expect(h({ ...NW, ueberstunden_verguetung: "Überstunden werden mit dem vereinbarten Stundenlohn zuzüglich eines Zuschlags von 25 % vergütet." })).toMatch(/keinen vereinbarten Stundenlohn/);
    expect(h({ ...NW, entgelt_art: "stunde", entgelt_betrag: "15,00", ueberstunden_verguetung: "Überstunden werden mit dem vereinbarten Stundenlohn vergütet." })).not.toMatch(/Überstunden:/);
    expect(h({ ...NW, ueberstunden_verguetung: "Überstunden sind mit dem Gehalt abgegolten; darüber hinaus werden sie mit 25 % Zuschlag vergütet." })).toMatch(/widersprüchlich/);
    // Nr. 10 und Nr. 7 passen zusammen: Überstunden können angeordnet werden und werden gesondert vergütet
    const d = html("nachweis_arbeitsbedingungen", NW);
    expect(d).toContain("Bei betrieblichem Bedarf können Überstunden angeordnet werden: bei unvorhersehbarem Arbeitsanfall");
    expect(d).toContain("<th>Vergütung von Überstunden</th><td>Jede angeordnete Überstunde wird mit dem rechnerischen Stundenlohn");
  });
});

describe("NachwG: Schriftform in den Branchen nach § 2a SchwarzArbG", () => {
  const form = (d: Daten) => v("nachweis_arbeitsbedingungen").formHinweis!(d);
  it("Hinweis für Ablauf und Abschluss: Schriftform je § 2a-Branche, sonst Textform, ohne Branche offen", () => {
    expect(NACHWG_SCHRIFTFORM_HINWEIS).toBe("In deiner Branche gilt die Schriftform: Nachweis ausdrucken, eigenhändig unterschreiben und aushändigen – ein PDF oder eine E-Mail genügt nicht (§ 2 Abs. 1 S. 3 NachwG, § 2a SchwarzArbG).");
    for (const b of ["friseur_kosmetik", "gastronomie", "bau", "gebaeudereinigung"]) {
      expect(form({ branche: b })!.form, b).toBe("schrift");
      expect(form({ branche: b })!.text.startsWith(NACHWG_SCHRIFTFORM_HINWEIS), b).toBe(true);
    }
    expect(form({ branche: "keine" })).toEqual({ form: "text", text: expect.stringMatching(/^PDF genügt \(Textform/) });
    expect(form({})!.form).toBe("offen");
    // Friseur und Kosmetik aus der Branche des Betriebs: gleich beim Anlegen Schriftform
    expect(form(leereDaten(v("nachweis_arbeitsbedingungen"), B, "2026-10-21", ["friseur"]))!.form).toBe("schrift");
  });
  it("PDF: Zeile über den Unterschriften nur in § 2a-Branchen, Unterschriftsfelder bleiben", () => {
    const mit = html("nachweis_arbeitsbedingungen", { ...NW, branche: "friseur_kosmetik" });
    expect(mit).toContain(`<p class="schriftform">${NACHWG_SCHRIFTFORM_PDF}</p>`);
    expect(NACHWG_SCHRIFTFORM_PDF).toBe("Schriftform erforderlich – eigenhändig unterschreiben und im Original aushändigen");
    // direkt vor dem Unterschriftsblock und mit ihm zusammen (kein Umbruch dazwischen)
    expect(mit).toMatch(/<div class="schlussblock[^"]*"><p class="schriftform">[^<]+<\/p><div class="unterschriften mit-ort">/);
    expect(mit).toContain("<span>Arbeitgeber/in</span>");
    expect(mit).toContain("<span>Beschäftigte Person (Erhalt bestätigt)</span>");
    for (const branche of ["keine", ""]) {
      const ohne = html("nachweis_arbeitsbedingungen", { ...NW, branche });
      expect(ohne, branche).not.toContain("Schriftform erforderlich");
      expect(ohne, branche).toContain("<span>Beschäftigte Person (Erhalt bestätigt)</span>");
    }
    // kein Hinweis auf die App im PDF
    const sichtbar = mit.slice(mit.indexOf("<body")).replace(/<[^>]+>/g, " ");
    expect(sichtbar).not.toContain(MARKE.name);
    expect(sichtbar).not.toMatch(/Muster|keine Rechtsberatung/i);
  });
  it("Hinweise beim Teilen: Schriftform bzw. Textform mit Empfangsnachweis", () => {
    const h = (d: Daten) => v("nachweis_arbeitsbedingungen").hinweise!(d, B)[0]!;
    expect(h({ branche: "friseur_kosmetik" })).toContain(NACHWG_SCHRIFTFORM_HINWEIS);
    expect(h({ branche: "keine" })).toMatch(/Empfangsnachweis/);
  });
});

describe("Hygieneplan für Lebensmittelbetriebe", () => {
  const liste = feld("hygieneplan", "eintraege") as unknown as ListenFeld;
  const lm = liste.vorschlaege!.filter((x) => x.gruppe === "Gastronomie / Café");
  const voll = (extra: Daten = {}): Daten => ({ art: "lebensmittel", bereich: "Küche und Theke", erstellt_von: "Jana Weber", datum: "2026-10-21", eintraege: lm.map((x) => ({ ...x.werte })), ...extra });

  it("Rechtsgrundlage VO (EG) Nr. 852/2004 (Art. 4, 5, Anhang II) und LMHV (§§ 3, 4)", () => {
    const h = html("hygieneplan", voll());
    expect(h).toContain("Art. 4 Abs. 2, Art. 5, Anhang II VO (EG) Nr. 852/2004; §§ 3, 4 LMHV");
    expect(h).not.toContain("Hygieneverordnung des Landes");
  });
  it("Vorschläge decken alle Themenbereiche ab und stehen unter „Gastronomie / Café“", () => {
    expect(lm).toEqual(HYGIENE_LEBENSMITTEL);
    expect([...new Set(lm.map((x) => x.werte.thema))]).toEqual([...HYGIENE_THEMEN_LEBENSMITTEL]);
    expect(HYGIENE_THEMEN_LEBENSMITTEL).toEqual(["Reinigung und Desinfektion", "Personalhygiene", "Schädlingsbekämpfung", "Temperaturkontrollen", "Wareneingang", "Trennung rein/unrein", "Abfall", "Trinkwasser", "Schulungen"]);
    const alles = JSON.stringify(lm);
    for (const s of ["Händewaschen", "Arbeitskleidung und Schmuck", "Ringe, Uhren", "§ 42 IfSG", "Schädlingsmonitoring", "Wareneingang", "rohe und verzehrfertige", "Abfall", "Trinkwasser", "§ 4 LMHV"]) expect(alles, s).toContain(s);
    for (const x of lm) expect(x.quelle, x.titel).toMatch(/fachlich zu prüfen$/);
  });
  it("Temperaturen nur als Richtwerte, fachlich zu prüfen", () => {
    const kuehl = lm.find((x) => x.titel === "Kühlgeräte")!;
    const tief = lm.find((x) => x.titel === "Tiefkühlgeräte")!;
    expect(kuehl.werte.wie).toMatch(/höchstens \+7 °C \(üblicher Richtwert, fachlich zu prüfen/);
    expect(tief.werte.wie).toMatch(/−18 °C oder kälter \(üblicher Richtwert, fachlich zu prüfen\)/);
    // jede Zahl mit Einheit in den Vorschlägen steht bei „Richtwert“ oder „Herstellerangabe“
    for (const x of lm)
      for (const w of Object.values(x.werte))
        if (typeof w === "string" && /\d+\s?°C/.test(w)) expect(w, x.titel).toMatch(/Richtwert, fachlich zu prüfen/);
  });
  it("keine Beauty-Inhalte im Lebensmittel-Plan; HACCP als eigene Vorlage verlinkt", () => {
    const h = html("hygieneplan", voll());
    for (const s of ["Instrument", "Hautdesinfektion", "Hautantiseptik", "Steril", "Kundin", "VAH", "Bayern"]) expect(h, s).not.toContain(s);
    expect(h).toContain("Eigenkontrollen nach HACCP");
    expect(h).toContain("eigene Vorlage „Eigenkontrollen (HACCP)“");
    // nach Themenbereichen geordnet, der Bereich über dem ersten Eintrag
    expect(h).toContain('<span class="thema">Personalhygiene</span><strong>Händewaschen</strong>');
    expect(h.indexOf('class="thema">Reinigung und Desinfektion')).toBeLessThan(h.indexOf('class="thema">Schulungen'));
    expect(v("hygieneplan").hinweise!(voll(), B)).toEqual([]);
  });
  it("Hinweis bei Beauty-Zeilen oder fehlenden Themenbereichen im Lebensmittelbetrieb; Beauty-Plan unverändert", () => {
    const beauty = (liste.vorschlaege ?? []).find((x) => /Instrument/.test(x.titel))!;
    const d = voll({ eintraege: [...lm.slice(0, 3).map((x) => ({ ...x.werte })), { ...beauty.werte }] });
    const h = v("hygieneplan").hinweise!(d, B).join(" ");
    expect(h).toContain(`„${beauty.werte.was}“ gehört in einen Beauty-Betrieb`);
    expect(h).toMatch(/fehlt noch Personalhygiene, Schädlingsbekämpfung/);
    expect(v("hygieneplan").hinweise!({ art: "beauty", eintraege: [{ ...beauty.werte }] }, B)).toEqual([]);
    expect(html("hygieneplan", { art: "beauty", eintraege: [{ ...beauty.werte }] })).toContain("Hygieneverordnung des Landes");
  });
  it("leeres Blatt: je Themenbereich eine Zeile zum Eintragen", () => {
    const h = html("hygieneplan", leereDaten(v("hygieneplan"), B, "2026-10-21", ["gastro_cafe"]));
    for (const t of HYGIENE_THEMEN_LEBENSMITTEL) expect(h, t).toContain(`<span class="thema">${t}</span>`);
  });
});
