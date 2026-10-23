/**
 * Prüfbericht Lebensmittelhygiene (Tim Baum, 22.10.2026), Teil Allergene, Zusatzstoffe, IfSG und Schulungsnachweis:
 * Abschnitte C, D, E Fragen 12/13, Änderungsliste L-001 bis L-020.
 */
import { describe, expect, it } from "vitest";
import { ANLAESSE, KURZ, LEERER_BETRIEB, VORLAGEN, WARNFARBSTOFFE, ZUSATZSTOFFE, dokumentHtml, fehlendeAngaben, leereDaten, vorlageFuer, type Betrieb, type Daten, type Feld } from "../src/index.js";
import { IFSG_HAUSHALT, ohneLatein } from "../src/dokumente/branchen.js";
import { ALLERGENE_UMFANG } from "../src/dokumente/bausteine.js";

const B: Betrieb = { ...LEERER_BETRIEB, name: "Café Linde", strasse: "Markt 1", plz: "72764", ort: "Reutlingen", verantwortlich: "Mara Lindner", telefon: "07121 1", email: "hallo@example.de", bundesland: "Baden-Württemberg" };
const HEUTE = "2026-10-22";
const v = (id: string) => vorlageFuer(id)!;
// feste Leerzeichen (§&nbsp;4) für den Textvergleich als normale Leerzeichen
const html = (id: string, d: Daten, b = B) => dokumentHtml(v(id), { ...leereDaten(v(id), b, HEUTE), ...d }, b).replace(/&nbsp;/g, " ");
const felderVon = (id: string, liste: string) => (v(id).abschnitte.flatMap((a) => a.felder).find((f) => f.id === liste) as Extract<Feld, { art: "liste" }>).felder;

describe("Allergenliste (Prüfbericht C, Fragen 9 und 10)", () => {
  it("fragt Getreide- und Nussart als Pflichtfeld ab, sobald A bzw. H angekreuzt ist", () => {
    const f = felderVon("allergene", "gerichte");
    for (const id of ["getreidearten", "nussarten"]) expect(f.find((x) => x.id === id), id).toMatchObject({ art: "mehrfach", pflicht: true });
    const d = (x: Record<string, unknown>) => ({ ...leereDaten(v("allergene"), B, HEUTE), gerichte: [{ name: "Nusskuchen", keine: false, ...x }] }) as Daten;
    expect(fehlendeAngaben(v("allergene"), d({ allergene: ["gluten", "schalenfruechte"] }), B)).toEqual(["Gericht: Welches Getreide", "Gericht: Welche Schalenfrüchte (Nüsse)"]);
    expect(fehlendeAngaben(v("allergene"), d({ allergene: ["gluten", "schalenfruechte"], getreidearten: ["weizen"], nussarten: ["haselnuesse"] }), B)).toEqual([]);
    // ohne A und H keine Frage nach der Art
    expect(fehlendeAngaben(v("allergene"), d({ allergene: ["milch"] }), B)).toEqual([]);
    // die Arten nach Anhang II LMIV: Weizen (mit Dinkel, Khorasan), Roggen, Gerste, Hafer; acht Schalenfrüchte
    expect((f.find((x) => x.id === "getreidearten") as { optionen: { text: string }[] }).optionen.map((o) => o.text)).toEqual(["Weizen", "Dinkel", "Khorasan-Weizen", "Roggen", "Gerste", "Hafer"]);
    expect((f.find((x) => x.id === "nussarten") as { optionen: unknown[] }).optionen).toHaveLength(8);
  });

  it("ältere Listen mit der Sorte als Freitext laden weiter und drucken den Text, bis die Art gewählt ist", () => {
    const d = { gerichte: [{ name: "Brezel", allergene: ["gluten"], getreide: "Weizen", keine: false }] };
    expect(html("allergene", d)).toContain("Enthält: Weizen</span>");
    expect(fehlendeAngaben(v("allergene"), { ...leereDaten(v("allergene"), B, HEUTE), ...d } as Daten, B)).toEqual(["Gericht: Welches Getreide"]);
  });

  it("setzt „Enthält:“ als Textzeile je Speise und als Überschrift der Legende (§ 4 LMIDV), mit Fußnote zu den Weizenarten", () => {
    const h = html("allergene", { gerichte: [{ name: "Dinkelbrot", allergene: ["gluten", "sesam", "milch"], getreidearten: ["dinkel", "roggen"] }, { name: "Florentiner", allergene: ["schalenfruechte"], nussarten: ["mandeln", "kaschu"] }] });
    expect(h).toContain("<strong>Dinkelbrot</strong><br><span class=\"klein\">Enthält: Weizen (Dinkel), Roggen, Milch, Sesamsamen</span>");
    expect(h).toContain("Enthält: Mandeln, Kaschunüsse (Cashew)");
    expect(h).toContain('<p class="schluessel"><b>Enthält:</b> <span class="nb"><b>A</b> Glutenhaltiges Getreide</span>');
    expect(h).toContain("Dinkel und Khorasan sind Weizenarten.");
    // Punkte bleiben
    expect(h.match(/<td class="x">●<\/td>/g)).toHaveLength(4);
  });

  it("lässt die lateinischen Namen der Schalenfrüchte auf dem Aushang weg, andere Klammern bleiben", () => {
    const i = ALLERGENE_UMFANG.findIndex((a) => a.bezeichnung === "Schalenfrüchte");
    expect(ohneLatein(ALLERGENE_UMFANG[i]!.umfasst)).toBe("namentlich Mandeln, Haselnüsse, Walnüsse, Kaschunüsse, Pecannüsse, Paranüsse, Pistazien, Macadamia- oder Queenslandnüsse sowie daraus gewonnene Erzeugnisse");
    for (const a of ALLERGENE_UMFANG.filter((x) => x.bezeichnung !== "Schalenfrüchte")) expect(ohneLatein(a.umfasst), a.bezeichnung).toBe(a.umfasst);
    const h = html("allergene", { legende: true, gerichte: [] });
    expect(h).not.toContain("Corylus");
    expect(h).toContain("namentlich Weizen (wie Dinkel und Khorasan-Weizen)");
  });

  it("Hilfetexte: Sulfit, vor dem Kauf zugänglich, Spurenhinweis freiwillig, bei Rezeptwechsel aktualisieren", () => {
    const a = v("allergene");
    const texte = JSON.stringify(a.abschnitte);
    expect(texte).toContain("Ankreuzen, wenn eine Zutat „geschwefelt“ oder „Sulfit“ in der Zutatenliste nennt.");
    expect(texte).toContain("vor dem Kauf");
    expect(texte).toContain("freiwillig und ersetzt keine Kennzeichnung");
    expect(texte).toContain("Bei Rezept- oder Lieferantenwechsel sofort aktualisieren (Zutatenlisten der Zulieferer aufbewahren).");
    // Spurenhinweis als freiwilliger Freitext unter der Speise
    expect(html("allergene", { gerichte: [{ name: "Keks", allergene: ["milch"], spuren: "Kann Spuren von Nüssen enthalten." }] })).toContain('<span class="klein">Kann Spuren von Nüssen enthalten.</span>');
  });
});

describe("Zusatzstoffe in der Allergenliste (Prüfbericht E, Fragen 12 und 13)", () => {
  it("bietet die elf Kenntlichmachungen nach § 5 LMZDV, Koffeinhinweis, chininhaltig und Warnhinweis Farbstoff je mit eigener Quelle (berichtigter Bericht)", () => {
    expect(ZUSATZSTOFFE.map((o) => o.text)).toEqual(["mit Farbstoff", "mit Konservierungsstoff", "mit Antioxidationsmittel", "mit Geschmacksverstärker", "geschwefelt", "geschwärzt", "gewachst", "mit Phosphat", "mit Süßungsmittel(n)", "enthält eine Phenylalaninquelle", "kann bei übermäßigem Verzehr abführend wirken", "Erhöhter Koffeingehalt. Für Kinder und schwangere oder stillende Frauen nicht empfohlen", "chininhaltig", "Farbstoff (an der Speise genannt): Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen"]);
    expect(ZUSATZSTOFFE.filter((o) => o.lmzdv)).toHaveLength(11);
    // Werte-Schlüssel stabil: gespeicherte Auswahl „koffein“ lädt weiter und zeigt den neuen Wortlaut
    expect(ZUSATZSTOFFE.map((o) => o.wert).slice(11)).toEqual(["koffein", "chinin", "azofarbstoff"]);
    expect(ZUSATZSTOFFE.slice(11).map((o) => o.quelle)).toEqual(["§ 6 FrSaftErfrischGetrV i. V. m. Anhang III Nr. 4.1 LMIV", "§ 5 Abs. 1 AromenDV", "Art. 24 i. V. m. Anhang V VO (EG) Nr. 1333/2008"]);
    expect(WARNFARBSTOFFE.map((o) => o.text.split(" ").slice(0, 2).join(" "))).toEqual(["E 102", "E 104", "E 110", "E 122", "E 124", "E 129"]);
    const f = felderVon("allergene", "gerichte").find((x) => x.id === "zusatzstoffe") as { optionen: { text: string }[] };
    expect(f.optionen[0]!.text).toBe("1 mit Farbstoff");
    expect(f.optionen[11]!.text).toBe("12 Koffeinhinweis (Erfrischungsgetränk über 150 mg/l, nicht Kaffee oder Tee)");
    expect(f.optionen[12]!.text).toBe("13 chininhaltig");
    expect(f.optionen[13]!.text).toBe("14 Warnhinweis Farbstoff (E 102, 104, 110, 122, 124, 129)");
  });

  it("druckt Ziffern hinter dem Namen und die Legende unter der Allergen-Legende – nur die verwendeten", () => {
    const h = html("allergene", { gerichte: [{ name: "Cola", allergene: [], keine: true, zusatzstoffe: ["farbstoff", "koffein"], koffein_mg: "10" }, { name: "Trockenobst", allergene: ["schwefeldioxid"], zusatzstoffe: ["geschwefelt"] }] });
    expect(h).toContain("<strong>Cola</strong><sup>1,12</sup>");
    expect(h).toContain('<span class="klein">Koffeingehalt: 10 mg/100 ml</span>');
    expect(h).toContain("<strong>Trockenobst</strong><sup>5</sup>");
    expect(h).toMatch(/Weizenarten\.<\/p><p class="schluessel"><b>Zusatzstoffe und weitere Angaben:<\/b> <span class="nb"><b>1<\/b> mit Farbstoff<\/span> · <span class="nb"><b>5<\/b> geschwefelt<\/span> · <span class="nb"><b>12<\/b> Erhöhter Koffeingehalt\. Für Kinder und schwangere oder stillende Frauen nicht empfohlen<\/span>/);
    expect(h).not.toContain("mit Phosphat");
    expect(h).toContain("1–11: Kenntlichmachung nach § 5 LMZDV; 12: § 6 FrSaftErfrischGetrV i. V. m. Anhang III Nr. 4.1 LMIV");
    // Warnhinweis Farbstoff: Farbstoff an der Speise, Ziffer 1 kommt dazu; ohne Farbstoff bzw. Koffeingehalt meldet die App die Lücke
    const s = html("allergene", { gerichte: [{ name: "Götterspeise", allergene: [], keine: true, zusatzstoffe: ["azofarbstoff"], warnfarbstoffe: ["e129"] }] });
    expect(s).toContain("<strong>Götterspeise</strong><sup>1,14</sup>");
    expect(s).toContain('<span class="klein">E 129 Allurarot AC</span>');
    expect(s).toContain("<b>14</b> Farbstoff (an der Speise genannt): Kann Aktivität und Aufmerksamkeit bei Kindern beeinträchtigen");
    expect(s).toContain("14: Art. 24 i. V. m. Anhang V VO (EG) Nr. 1333/2008");
    expect(fehlendeAngaben(v("allergene"), { ...leereDaten(v("allergene"), B, HEUTE), gerichte: [{ name: "Energy", allergene: [], keine: true, zusatzstoffe: ["koffein", "azofarbstoff"] }] } as Daten, B)).toEqual(["Gericht: Koffeingehalt (mg/100 ml)", "Gericht: Welcher Farbstoff"]);
    // ohne Zusatzstoffe keine Legende; auf dem leeren Blatt alle Ziffern
    expect(html("allergene", { gerichte: [{ name: "Brot", allergene: ["gluten"], getreidearten: ["roggen"] }] })).not.toContain("Zusatzstoffe und weitere Angaben");
    expect(html("allergene", { gerichte: [] })).toContain("<b>13</b> chininhaltig");
    expect(html("allergene", { gerichte: [] })).toContain("13: § 5 Abs. 1 AromenDV");
  });
});

describe("Belehrung nach § 43 IfSG (Prüfbericht D)", () => {
  it("ergänzt die Krankheitszeichen um Haushaltsfälle, in der Anrede der Vorlage", () => {
    expect(IFSG_HAUSHALT).toBe("Sagen Sie auch Bescheid, wenn jemand in Ihrem Haushalt Durchfall oder Erbrechen hat.");
    const h = html("ifsg_belehrung", { liste_anhaengen: true });
    expect(h).toMatch(/<h3>Woran Sie das erkennen<\/h3>.*<\/ul><p>Sagen Sie auch Bescheid, wenn jemand in Ihrem Haushalt Durchfall oder Erbrechen hat\.<\/p>/s);
  });

  it("führt je Person die letzte Belehrung durch den Arbeitgeber und weist auf mehr als zwei Jahre Abstand hin", () => {
    const f = felderVon("ifsg_belehrung", "teilnehmer");
    expect(f.find((x) => x.id === "letzte_belehrung_am")).toMatchObject({ art: "datum" });
    const t = [{ name: "Tom Kessler", erstbelehrung_am: "2024-03-04", letzte_belehrung_am: "2025-03-15" }, { name: "Aylin Demir", erstbelehrung_am: "2026-09-10", letzte_belehrung_am: "" }];
    const h = html("ifsg_belehrung", { datum: "2026-10-01", teilnehmer: t });
    // Nachkontrolle T. Baum (23.10.2026, Hinweis 4): nicht mit der ersten Belehrung durch den Arbeitgeber verwechseln
    expect(h).toContain("<th>Bescheinigung Gesundheitsamt vom</th><th>Letzte Belehrung (Arbeitgeber)</th><th>Unterschrift</th>");
    expect(h).toContain("<td>Tom Kessler</td><td>04.03.2024</td><td>15.03.2025</td>");
    const i = v("ifsg_belehrung");
    expect(i.hinweise?.({ datum: "2026-10-01", teilnehmer: t }, B)).toEqual([]);
    expect(i.hinweise?.({ datum: "2026-10-01", teilnehmer: [{ ...t[0]!, letzte_belehrung_am: "2024-09-30" }] }, B)[0]).toMatch(/Tom Kessler: Die letzte Belehrung durch den Arbeitgeber am 30\.09\.2024 liegt mehr als zwei Jahre zurück/);
  });

  it("Hilfetext: in Küchen von Gaststätten gilt die Belehrung für alle Tätigkeiten", () => {
    expect(v("ifsg_belehrung").abschnitte.find((a) => a.titel === "Teilnehmende")!.hilfe).toMatch(/auch für Spülkräfte und den Service, wenn sie in der Küche arbeiten/);
  });
});

describe("Schulungsnachweis Lebensmittelhygiene § 4 LMHV (Prüfbericht E, Frage 12)", () => {
  const s = () => v("hygieneschulung");
  it("ist eine Vorlage der Gastronomie für die Pflicht Hygieneschulung, mit Kurztext und unter „Café, Restaurant, Lebensmittel“", () => {
    expect(s()).toMatchObject({ bereich: "gastro", pflichten: ["branche.gastro_hygieneschulung"] });
    expect(VORLAGEN.filter((x) => x.pflichten.includes("branche.gastro_hygieneschulung")).map((x) => x.id)).toEqual(["hygieneschulung"]);
    expect(KURZ.hygieneschulung).toBeTruthy();
    expect(ANLAESSE.find((a) => a.id === "gastro")!.vorlagen).toContain("hygieneschulung");
  });

  it("Themen nach Anlage 1 LMHV und Ergänzungen aus dem Prüfbericht, je mit Quelle", () => {
    const t = s().abschnitte.flatMap((a) => a.felder).find((f) => f.id === "themen") as { optionen: { text: string; quelle?: string }[] };
    expect(t.optionen.filter((o) => o.quelle?.startsWith("Anlage 1 LMHV"))).toHaveLength(10);
    expect(t.optionen.map((o) => o.text)).toEqual(expect.arrayContaining(["Eigenschaften und Zusammensetzung des jeweiligen Lebensmittels", "Reinigung und Desinfektion", "Personalhygiene", "Schädlingsbekämpfung", "Allergene"]));
    expect(t.optionen.every((o) => o.quelle)).toBe(true);
  });

  it("druckt Datum, Themen, Teilnehmende mit Unterschrift, schulende Person, jährliche Wiederholung, Abgrenzung und Ausnahme", () => {
    const h = html("hygieneschulung", { datum: "2026-10-01", geschult_von: "Mara Lindner", themen: ["eigenschaften", "personalhygiene", "allergene"], teilnehmer: [{ name: "Tom Kessler", taetigkeit: "Küche" }] });
    expect(h).toContain("Schulungsnachweis Lebensmittelhygiene");
    expect(h).toContain("<li>Eigenschaften und Zusammensetzung des jeweiligen Lebensmittels</li>");
    expect(h).toContain("<th>Name</th><th>Tätigkeit</th><th>Unterschrift</th>");
    expect(h).toContain("<td>Tom Kessler</td><td>Küche</td>");
    expect(h).toContain("Unterschrift der schulenden Person");
    // Nachkontrolle T. Baum (23.10.2026, Hinweis 2): Empfehlung, keine Frist
    expect(h).toMatch(/Wiederholung jährlich empfohlen \(DIN 10514\), nächste Schulung bis 01\.10\.2027\./);
    expect(h).not.toContain("spätestens");
    expect(h).toContain("Die Belehrung nach § 43 IfSG (Infektionsschutz) ist ein eigener Nachweis.");
    expect(h).toContain("§ 4 Abs. 2 LMHV");
    expect(h).toContain("Bäcker/in, Koch/Köchin");
    const hilfe = s().abschnitte.map((a) => a.hilfe ?? "").join(" ");
    expect(hilfe).toMatch(/IfSG betrifft den Infektionsschutz|Belehrung betrifft den Infektionsschutz/);
    expect(hilfe).toContain("je eine eigene Unterschriftsliste");
  });

  it("verlangt Datum, schulende Person, Themen und Teilnehmende nicht als Hindernis für das leere Blatt", () => {
    const leer = leereDaten(s(), B, HEUTE);
    expect(fehlendeAngaben(s(), leer, B)).toEqual(["Themen der Schulung"]);
    expect(dokumentHtml(s(), leer, B)).toContain("<th>Name</th><th>Tätigkeit</th><th>Unterschrift</th>");
  });
});
