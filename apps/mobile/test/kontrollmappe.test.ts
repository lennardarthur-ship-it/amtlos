import { unzipSync, strFromU8 } from "fflate";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { VORLAGEN } from "@amtlos/fachlogik";
import { T as TEXT } from "../src/texte";
import { deckblattHtml, gehoertInMappe, mappeDateiname, mappeZusammenfuegen, mappenAuswahl, seitenzahl, startSeiten } from "../src/unterlagen/kontrollmappe";
import { fehltFuer } from "../src/unterlagen/pruefung";
import { LEERER_STAND, anlegen, ausgeben, betriebSetzen, felderSetzen, profilSetzen, type Stand } from "../src/unterlagen/speicher";
import { fragenText, kassenHinweis, kassenLage, kassenSatzPaket, steuerpaket } from "../src/unterlagen/steuerpaket";

const B = { name: "Café Mond", strasse: "Markt 2", plz: "54321", ort: "Beispielstadt", verantwortlich: "Robin Beispiel", telefon: "", email: "", steuernummer: "", ust_idnr: "", iban: "", bundesland: "Hessen" };
const t = (d: string) => new Date(`${d}T09:00:00Z`);

describe("Kassenhinweis: Voranmeldung, EÜR und Paket kennen keine Kassenumsätze", () => {
  it("liest die Antwort „Nutzt du eine elektronische Kasse?“ aus dem Pflichten-Check", () => {
    expect(kassenLage({ "kasse.elektronisch": true })).toBe("kasse");
    expect(kassenLage({ "kasse.elektronisch": false })).toBe("keine");
    expect(kassenLage({})).toBe("unbekannt");
    expect(kassenLage({ "kasse.elektronisch": null })).toBe("unbekannt");
  });
  it("mit Kasse eine Warnung, ohne Antwort ein ruhiger Hinweis „Falls du …“, ohne Kasse nichts", () => {
    expect(kassenHinweis("kasse", "ust")).toEqual({ text: TEXT.kasse_ust, warnung: true });
    expect(TEXT.kasse_ust).toBe("Deine Kassenumsätze sind nicht enthalten – trag die Umsätze aus deinen Tagesabschlüssen (Z-Bons) zusätzlich ein, sonst stimmt die Voranmeldung nicht.");
    expect(kassenHinweis("unbekannt", "ust")).toEqual({ text: TEXT.kasse_ust_vielleicht, warnung: false });
    expect(TEXT.kasse_ust_vielleicht).toMatch(/^Falls du eine Kasse nutzt: /);
    expect(kassenHinweis("kasse", "euer")!.text).toMatch(/sonst stimmt die EÜR nicht/);
    expect(kassenHinweis("unbekannt", "euer")!.warnung).toBe(false);
    expect(kassenHinweis("keine", "ust")).toBeNull();
    expect(kassenHinweis("keine", "euer")).toBeNull();
    expect(kassenSatzPaket("kasse")).toMatch(/^Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket\./);
    expect(kassenSatzPaket("unbekannt")).toMatch(/^Falls der Betrieb eine Kasse nutzt: Kassenumsätze fehlen/);
    expect(kassenSatzPaket("keine")).toBeNull();
  });
  it("Paket: Satz ganz oben im LIESMICH und in den Fragen (nicht als Frage gezählt)", () => {
    const Q = { von: "2026-01-01", bis: "2026-03-31", name: "2026-Q1" };
    const basis: Stand = { ...LEERER_STAND, betrieb: B };
    const liesmich = (s: Stand) => strFromU8(unzipSync(steuerpaket(s, Q, s.steuerberatung, {}, "2026-04-10T08:00:00").zip)["LIESMICH.txt"]!);
    const mit = profilSetzen(basis, { "kasse.elektronisch": true });
    expect(liesmich(mit).split("\r\n")[0]).toMatch(/^Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket\./);
    expect(liesmich(mit).split("\r\n")[2]).toBe("Amtlos – Unterlagen für die Steuerberatung");
    expect(fragenText(mit, Q).text).toContain("Betrieb mit Kasse: Kassenumsätze fehlen in diesem Paket.");
    expect(fragenText(mit, Q).anzahl).toBe(0);
    expect(liesmich(basis).split("\r\n")[0]).toMatch(/^Falls der Betrieb eine Kasse nutzt:/);
    const ohne = profilSetzen(basis, { "kasse.elektronisch": false });
    expect(liesmich(ohne).split("\r\n")[0]).toBe("Amtlos – Unterlagen für die Steuerberatung");
    expect(fragenText(ohne, Q).text).not.toMatch(/Kasse nutzt|Betrieb mit Kasse/);
    // der Punkt unter „Nicht enthalten“ bleibt in jedem Fall
    expect(liesmich(ohne)).toContain("- Kassenumsätze (Z-Bons bzw. Kassenexport)");
  });
});

describe("Kontrollmappe: Auswahl der Unterlagen", () => {
  it("nimmt Arbeitsschutz, Hygiene, Lebensmittel, Datenschutz und Personal-Nachweise – keine Rechnungen, Steuern, Lohn", () => {
    const drin = VORLAGEN.filter(gehoertInMappe).map((v) => v.id).sort();
    for (const id of ["unterweisung", "gefaehrdungsbeurteilung", "hygieneplan", "hautschutzplan", "haccp", "allergene", "betriebsanweisung", "gefahrstoffverzeichnis", "pruefprotokoll_elektro", "ifsg_belehrung", "datenschutz_dokumentation", "datenpanne", "avv", "arbeitszeitnachweis", "nachweis_arbeitsbedingungen"]) expect(drin, id).toContain(id);
    for (const id of ["rechnung", "kassenbuch", "ust_voranmeldung", "euer", "steuererklaerung", "lohnkonto", "sv_meldedaten", "impressum", "gewerbeanmeldung", "datenschutzerklaerung_website"]) expect(drin, id).not.toContain(id);
  });

  /** Unterweisungen „Hygiene“ (zwei Fassungen, die ältere geteilt), „Brandschutz“ (vollständig), eine leere Gefährdungsbeurteilung, eine Rechnung */
  function stand(): Stand {
    let s = betriebSetzen(LEERER_STAND, B);
    const neu = (id: string, vorlage: string, tag: string, werte: Record<string, unknown>, teilen = false) => {
      const [s1] = anlegen(s, vorlage, t(tag), id);
      s = felderSetzen(s1, id, werte as never, t(tag));
      if (teilen) s = ausgeben(s, id, t(tag));
    };
    neu("u1", "unterweisung", "2026-02-01", { thema: "Hygiene", datum: "2026-02-01" }, true);
    neu("u2", "unterweisung", "2026-05-01", { thema: "Hygiene", datum: "2026-05-01" });
    neu("u3", "unterweisung", "2026-03-01", { thema: "Brandschutz", datum: "2026-03-01" });
    neu("u4", "unterweisung", "2026-04-01", { thema: "Brandschutz", datum: "2026-04-01" }, true);
    neu("u5", "unterweisung", "2026-06-01", { thema: "Erste Hilfe", datum: "2026-06-01" });
    neu("g1", "gefaehrdungsbeurteilung", "2026-01-10", {});
    const [s2] = anlegen(s, "rechnung", t("2026-03-03"), "r1");
    s = s2;
    return s;
  }

  it("je Vorlage und Thema die zuletzt geteilte, sonst die neueste vollständige Fassung; Unvollständiges wird gezählt", () => {
    const s = stand();
    expect(fehltFuer(s, s.unterlagen.find((u) => u.id === "u5")!)).toEqual([]);
    const a = mappenAuswahl(s);
    // Hygiene: u1 geteilt schlägt die neuere, nur vollständige u2; Brandschutz: u4 (geteilt); Erste Hilfe: u5 (vollständig)
    expect(a.eintraege.map((e) => e.id).sort()).toEqual(["u1", "u4", "u5"]);
    const hyg = a.eintraege.find((e) => e.id === "u1")!;
    expect(hyg).toMatchObject({ vorlage: "unterweisung", bereich: "arbeitsschutz", datum: "2026-02-01", geteilt: true });
    expect(hyg.titel).toMatch(/Hygiene/);
    expect(a.eintraege.find((e) => e.id === "u5")!.geteilt).toBe(false);
    // die leere Gefährdungsbeurteilung fehlt und wird gezählt; die Rechnung gehört nicht in die Mappe
    expect(a.unvollstaendig).toBe(1);
    expect(a.eintraege.some((e) => e.vorlage === "rechnung" || e.vorlage === "gefaehrdungsbeurteilung")).toBe(false);
  });

  it("die neueste geteilte Fassung gewinnt, wenn mehrere geteilt sind", () => {
    let s = stand();
    s = ausgeben(s, "u2", t("2026-05-02"));
    expect(mappenAuswahl(s).eintraege.find((e) => /Hygiene/.test(e.titel))!.id).toBe("u2");
  });

  it("leerer Stand: keine Einträge", () => {
    expect(mappenAuswahl(LEERER_STAND)).toEqual({ eintraege: [], unvollstaendig: 0 });
  });
});

describe("Kontrollmappe: Deckblatt und PDF", () => {
  it("Deckblatt mit Betrieb, Datum, Inhalt (Titel, Datum, Seite) und Fußzeilen-Angaben", () => {
    const html = deckblattHtml("Café <Mond>", "2026-10-20", [
      { id: "a", vorlage: "unterweisung", titel: "Unterweisungsnachweis · Hygiene", bereich: "arbeitsschutz", datum: "2026-02-01", geteilt: true, seite: 2 },
      { id: "b", vorlage: "allergene", titel: "Allergenliste", bereich: "gastro", datum: "2026-03-05", geteilt: false, seite: 4 },
    ]);
    expect(html).toContain("<head>");
    expect(html).toContain("Café &lt;Mond&gt;");
    expect(html).toContain("Zusammengestellt am 20.10.2026 · 2 Unterlagen");
    expect(html).toMatch(/Unterweisungsnachweis · Hygiene.*01\.02\.2026.*>2</s);
    expect(html).toMatch(/Allergenliste.*05\.03\.2026.*>4</s);
    expect(html).toContain('<meta name="amtlos-fuss-links" content="Café &lt;Mond&gt; · Kontrollmappe">');
  });

  it("Startseiten nach dem Deckblatt und Zusammenfügen in Reihenfolge", async () => {
    expect(startSeiten(1, [2, 1, 3])).toEqual([2, 4, 5]);
    expect(startSeiten(2, [1])).toEqual([3]);
    const pdf = async (n: number, breite: number) => {
      const d = await PDFDocument.create();
      for (let i = 0; i < n; i++) d.addPage([breite, 842]);
      return d.save();
    };
    const mappe = await mappeZusammenfuegen([await pdf(1, 595), await pdf(2, 842), await pdf(1, 595)]);
    expect(await seitenzahl(mappe)).toBe(4);
    const d = await PDFDocument.load(mappe);
    expect(d.getPages().map((p) => p.getWidth())).toEqual([595, 842, 842, 595]);
    expect(d.getTitle()).toBe("Kontrollmappe");
  });

  it("Dateiname mit Betrieb und Datum, ohne Umlaute und Sonderzeichen", () => {
    expect(mappeDateiname("Café Mond & Söhne", "2026-10-20")).toMatch(/^Kontrollmappe_Cafe-Mond-.*Soehne_2026-10-20\.pdf$/);
    expect(mappeDateiname("", "2026-10-20")).toBe("Kontrollmappe_Betrieb_2026-10-20.pdf");
  });
});
