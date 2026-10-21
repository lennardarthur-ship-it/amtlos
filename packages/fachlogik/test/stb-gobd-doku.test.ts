/**
 * StB GoBD (Prüfbericht Heckler und Busch vom 21.10.2026, Abschnitte 6–8, 10): Verfahrensdokumentation (Kasse, ersetzendes
 * Scannen, IKS, Sicherungsnachweis), Kassenbuch aus den Tagesabschlüssen, Bilanz/GuV (Ertragsteuern, Angaben unter der
 * Bilanz, Unterschriften aller Geschäftsführer), Lohnkonto-Übersicht und der Hinweis „Übertragungshilfe, keine
 * Steuerberatung“ auf den Steuer-PDFs.
 */
import { describe, expect, it } from "vitest";
import { MARKE } from "@amtlos/marke";
import { LEERER_BETRIEB, dokumentHtml, fehlendeAngaben, leereDaten, vorlageFuer, type Betrieb, type Daten } from "../src/index.js";
import { KEINE_STEUERBERATUNG, steuerHinweisText } from "../src/dokumente/html.js";
import { BILANZ_KLEINST, KASSENBUCH_AUS_KASSE, bilanzUnterzeichner, kassenbuchEinzel } from "../src/dokumente/buchhaltung.js";

const BETRIEB: Betrieb = { ...LEERER_BETRIEB, name: "Café Morgenrot", strasse: "Markt 1", plz: "04109", ort: "Leipzig", verantwortlich: "Mara Roth", steuernummer: "231/123/45678", bundesland: "Sachsen" };
const GMBH: Betrieb = { ...BETRIEB, name: "Salon Sonne GmbH", rechtsform: "GmbH", vertretung: "Alex Muster und Kim Muster" };

const html = (id: string, d: Daten, b: Betrieb = BETRIEB) => {
  const v = vorlageFuer(id)!;
  return dokumentHtml(v, { ...leereDaten(v, b, "2026-10-21"), ...d }, b).replace(/\u00a0/g, " ").replace(/&nbsp;/g, " ");
};
const h0 = (id: string, d: Daten) => html(id, d);
/** sichtbarer Text ohne Tags (Abstände vereinheitlicht) */
const klartext = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

describe("StB GoBD: Hinweis „Übertragungshilfe, keine Steuerberatung“ (Abschnitt 8)", () => {
  it("steht auf USt-VA, EÜR, Unterlagen zur Steuererklärung und Lohnkonto-Übersicht – mit dem Wortlaut des Berichts (nicht auf der Bilanz: unterschrieben und offengelegt, E-162)", () => {
    const je: [string, Daten, string][] = [
      ["ust_voranmeldung", { zeitraum: "Q3 2026", umsatz_19: "1000" }, "Übertragungshilfe aus den erfassten Rechnungen, Belegen und Kassenabschlüssen."],
      ["euer", { jahr: "2026" }, `rechnerische Zusammenstellung, keine Gewinnermittlung im Sinne des § 4 Abs. 3 EStG durch ${MARKE.name}.`],
      ["steuererklaerung", { jahr: "2026" }, "Übertragungshilfe: Zusammenstellung der erfassten Zahlen"],
      ["lohnkonto", { name: "Lena Klein", jahr: "2026" }, "Übersicht aus den Lohnabrechnungen; das Lohnkonto nach § 4 LStDV führt das Lohnprogramm"],
    ];
    for (const [id, d, satz] of je) {
      const t = klartext(html(id, d));
      expect(h0(id, d), id).toContain('<p class="nachsatz steuerhinweis">');
      expect(t, id).toContain(satz);
      // Lohnkonto-Übersicht: kurz („Keine Steuerberatung.“), damit alle zwölf Monate auf ein Querformatblatt passen
      expect(t, id).toContain(id === "lohnkonto" ? "* U = Unterbrechung ohne Lohnanspruch (§ 41 Abs. 1 EStG). Übersicht aus den Lohnabrechnungen; das Lohnkonto nach § 4 LStDV führt das Lohnprogramm. Keine Steuerberatung" : KEINE_STEUERBERATUNG);
    }
    expect(steuerHinweisText("euer", "X")).toContain("durch X.");
  });

  it("steht nicht auf Rechnung, Hygieneplan, Kassenbuch oder Verfahrensdokumentation", () => {
    for (const id of ["rechnung", "hygieneplan", "kassenbuch", "verfahrensdokumentation", "kassenmeldung", "bilanz_guv"]) expect(klartext(html(id, {})), id).not.toContain("Keine Steuerberatung");
  });
});

describe("StB GoBD: Verfahrensdokumentation (D-3, D-9, D-10, D-11)", () => {
  const v = vorlageFuer("verfahrensdokumentation")!;
  const KASSE_TSE = "Elektronisches Kassensystem mit TSE (Einzelaufzeichnung je Verkauf)";

  it("Kapitel Kasse: Kassensystem, TSE, DSFinV-K, Z-Bon, TSE-Ausfall; Einzelaufzeichnung beim Kassensystem, die App nur mit Tagessummen", () => {
    const d = leereDaten(v, BETRIEB, "2026-10-21");
    // Startwerte: Z-Bon, Export und Ausfall sind vorausgewählt
    expect((d.kasse_tse_ablauf as string[]).length).toBe(5);
    const t = klartext(html("verfahrensdokumentation", { kasse_art: KASSE_TSE, kasse_system: "KassaVista Tablet-Kasse 4.2", kasse_tse: "Cloud-TSE, Seriennummer 3f9a77" }));
    expect(t).toContain("Kasse");
    expect(t).toContain("Einzelaufzeichnungen: Kassensystem KassaVista Tablet-Kasse 4.2, TSE Cloud-TSE, Seriennummer 3f9a77, Export DSFinV-K");
    expect(t).toContain(`${MARKE.name} führt nur die Tagessummen`);
    expect(t).toContain("Z-Bon");
    expect(t).toContain("Bei Ausfall der TSE wird die Kasse weiter genutzt");
    expect(t).toContain("AEAO zu § 146a Nr. 7");
    expect(t).toContain("DSFinV-K-Export und der TSE-Export");
    // offene Ladenkasse: keine TSE-Bausteine
    const offen = klartext(html("verfahrensdokumentation", { kasse_art: "Offene Ladenkasse ohne elektronisches Kassensystem (Kassenbericht mit Zählung)" }));
    expect(offen).not.toContain("Ausfall der TSE");
    expect(offen).not.toContain("Einzelaufzeichnungen:");
  });

  it("Kapitel „Ersetzendes Scannen“ mit Fotoqualität, Vollständigkeitskontrolle und Vernichtung erst nach Prüfung, Festschreibung und Sicherung", () => {
    const t = klartext(html("verfahrensdokumentation", { scannen: true, papier: "Papier wird nach dem Scannen vernichtet" }));
    expect(t).toContain("Ersetzendes Scannen");
    expect(t).toContain("GoBD Rz. 136 ff.");
    expect(t).toContain("lesbar (Aussteller, Datum, Beträge, Steuer)");
    expect(t).toContain("Vollständigkeitskontrolle monatlich");
    expect(t).toContain("erst vernichtet, wenn das Foto geprüft, der Beleg festgeschrieben");
    expect(t).toContain("Sicherung außerhalb des Geräts");
    // ohne Scannen kein Kapitel
    expect(klartext(html("verfahrensdokumentation", { scannen: false }))).not.toContain("Ersetzendes Scannen");
  });

  it("Internes Kontrollsystem: wer prüft Kassensturz, wer gibt Pakete frei, Vier-Augen realistisch im Kleinbetrieb", () => {
    // leer: Bausteine zum Ankreuzen
    const leer = klartext(html("verfahrensdokumentation", {}));
    expect(leer).toContain("Internes Kontrollsystem");
    expect(leer).toContain("GoBD Rz. 100 ff.");
    expect(leer).toContain("Kassensturz: Die Inhaberin bzw. der Inhaber zählt die Kasse");
    const t = klartext(html("verfahrensdokumentation", { iks: ["Steuerberater-Pakete und Voranmeldungen gibt nur die Inhaberin bzw. die Geschäftsführung frei – vorher Abgleich mit den Kontoauszügen", "Vier-Augen-Prinzip, wo es eine zweite Person gibt (z. B. Zählung gegenzeichnen); im Betrieb ohne weitere Person ersetzt durch die Plausibilitätsprüfung der Steuerberatung beim Verbuchen"] }));
    expect(t).toContain("gibt nur die Inhaberin bzw. die Geschäftsführung frei");
    expect(t).toContain("im Betrieb ohne weitere Person ersetzt");
    expect(t).toContain("Verantwortlich für die Kontrollen Mara Roth");
    // „Weitere Kontrollen“ ist keine Pflicht mehr; die Bausteine sind es auch nicht
    expect(fehlendeAngaben(v, { ...leereDaten(v, BETRIEB, "2026-10-21") }, BETRIEB)).not.toContain("Internes Kontrollsystem");
  });

  it("Sicherung: Nachweis „Letzte Sicherung außerhalb des Geräts“, monatliche Erinnerung und technische Unveränderbarkeit in den Abläufen", () => {
    const t = klartext(html("verfahrensdokumentation", { sicherung_nachweis: "15.10.2026, verschlüsselte Sicherungsdatei", amtlos: true }));
    expect(t).toContain("Letzte Sicherung außerhalb des Geräts 15.10.2026, verschlüsselte Sicherungsdatei");
    expect(t).toContain("älter als 30 Tage");
    expect(t).toContain("nicht nur das iCloud-Backup des iPhones");
    expect(t).toContain("Unveränderbarkeit technisch:");
    expect(t).toContain("Eine Hash-Kette über die festgeschriebenen Abschlüsse gibt es noch nicht.");
  });

  it("die Gliederung folgt GoBD Rz. 153 – Kasse, Scannen und IKS als eigene Kapitel", () => {
    const h = html("verfahrensdokumentation", { scannen: true, kasse_art: KASSE_TSE, amtlos: true });
    const kapitel = [...h.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => klartext(m[1]!.slice(m[1]!.lastIndexOf("</span>") + 7)).trim());
    // Überschrift ohne die Randangabe davor (<span class="rand">…</span>)
    const ohneRand = kapitel.filter((k) => k && k !== "Inhalt");
    expect(ohneRand).toEqual(["Allgemeine Beschreibung", "Eingesetzte Programme und Geräte", "Anwenderdokumentation: Belegeingang, Erfassung und Ablage", "Ersetzendes Scannen", "Kasse", `Abläufe in ${MARKE.name}`, "Technische Systemdokumentation und Betriebsdokumentation", "Internes Kontrollsystem", "Aufbewahrung und Änderungen"]);
  });
});

describe("StB GoBD: Kassenbuch (D-1, D-9)", () => {
  it("heißt nicht mehr „Vorlage zum Ausdrucken“", () => {
    expect(vorlageFuer("kassenbuch")!.titel).toBe("Kassenbuch");
    expect(html("kassenbuch", {})).not.toContain("Vorlage zum Ausdrucken");
  });

  it("aus den Tagesabschlüssen: „nur lesbar“, Fassung und Erstellungszeitpunkt in der Fußzeile jeder Seite, Einzelaufzeichnungen beim Kassensystem", () => {
    const h = html("kassenbuch", { zeitraum: "Mai 2026", anfang: "150,00", eintraege: [{ datum: "2026-05-02", beleg: "Z 120", text: "Tageseinnahmen bar lt. Z-Bon Nr. 120", einnahme: "812,40" }], quelle: "tagesabschluesse", kb_fassung: "2", kb_erstellt: "21.10.2026, 14:05", kb_einzel: "KassaVista Tablet, TSE 3f9a" });
    expect(klartext(h)).toContain(`Mai 2026 · ${KASSENBUCH_AUS_KASSE}`);
    expect(h).toContain('<meta name="amtlos-fuss-rechts" content="Fassung 2 · erstellt 21.10.2026, 14:05">');
    expect(klartext(h)).toContain("Einzelaufzeichnungen: Kassensystem KassaVista Tablet, TSE 3f9a, Export DSFinV-K");
    expect(kassenbuchEinzel("")).toContain("Einzelaufzeichnungen: im Kassensystem");
    // eigene Einträge (nicht aus der App): keine Fassung, kein Satz zum Kassensystem
    const eigen = html("kassenbuch", { zeitraum: "Mai 2026", eintraege: [{ text: "Einnahmen", einnahme: "10" }] });
    expect(eigen).not.toContain("Fassung 2");
    expect(eigen).not.toContain("Einzelaufzeichnungen");
  });
});

describe("StB GoBD: Bilanz und GuV (E-4, E-5)", () => {
  const voll: Daten = {
    stichtag: "2026-12-31",
    aufgestellt: "2027-03-15",
    ertraege: [{ posten: "Umsatzerlöse", betrag: "100.000,00" }],
    aufwendungen: [{ posten: "Personalaufwand", betrag: "60.000,00" }],
    ertragsteuern: "12.000,00",
    aktiva: [{ posten: "Bank", betrag: "53.000,00" }],
    passiva: [{ posten: "Gezeichnetes Kapital", betrag: "25.000,00" }, { posten: "Jahresüberschuss", betrag: "28.000,00" }],
  };

  it("Steuern vom Einkommen und vom Ertrag vor dem Jahresüberschuss", () => {
    const t = klartext(html("bilanz_guv", voll, GMBH));
    expect(t).toContain("Ergebnis vor Steuern vom Einkommen und vom Ertrag 40.000,00 €");
    expect(t).toContain("Steuern vom Einkommen und vom Ertrag Körperschaft- und Gewerbesteuer 12.000,00 €");
    expect(t).toContain("Jahresüberschuss 28.000,00 €");
    expect(t.indexOf("Steuern vom Einkommen und vom Ertrag")).toBeLessThan(t.indexOf("Jahresüberschuss 28.000,00 €"));
    expect(vorlageFuer("bilanz_guv")!.ergebnis!(voll)[0]!.map((x) => x.replace(/\u00a0/g, " "))).toEqual(["Jahresüberschuss", "28.000,00 €"]);
  });

  it("Kleinstkapitalgesellschaft: Angaben unter der Bilanz statt Anhang (§ 264 Abs. 1 Satz 5 HGB)", () => {
    const t = klartext(html("bilanz_guv", voll, GMBH));
    expect(t).toContain(BILANZ_KLEINST);
    expect(t).toContain("Haftungsverhältnisse (§ 251, § 268 Abs. 7 HGB) Keine");
    expect(t).toContain("§ 285 Nr. 9 Buchst. c HGB) Keine");
    // ohne Kleinst-Befreiung: Hinweis auf den Anhang; Einzelunternehmen: nichts davon
    expect(klartext(html("bilanz_guv", { ...voll, kleinst: false }, GMBH))).toContain("Zum Jahresabschluss gehört ein Anhang");
    expect(klartext(html("bilanz_guv", voll))).not.toContain("Angaben unter der Bilanz");
  });

  it("Unterschriften aller Geschäftsführer mit Datum der Aufstellung (§ 245 HGB); klar als Vorlage mit Werten der Kanzlei", () => {
    const h = html("bilanz_guv", voll, GMBH);
    const t = klartext(h);
    expect(t).toContain("Alex Muster (Geschäftsführung)");
    expect(t).toContain("Kim Muster (Geschäftsführung)");
    expect((h.match(/class="unterschrift"/g) ?? []).length).toBe(2);
    expect(t).toContain("Aufgestellt am 15.03.2027");
    expect(t).toContain("von allen Geschäftsführern (§ 245 HGB)");
    expect(t).toContain("Vorlage – Werte aus der Buchführung der Kanzlei");
    expect(bilanzUnterzeichner(BETRIEB)).toEqual(["Mara Roth (Kaufmann/Kauffrau)"]);
    expect(bilanzUnterzeichner({ ...GMBH, vertretung: "" })).toHaveLength(2);
    expect(vorlageFuer("bilanz_guv")!.pruefen!({}, { ...GMBH, vertretung: "" })[0]).toContain("§ 245 HGB");
    // Hinweis auf die Bilanz statt EÜR für Kapitalgesellschaften (falls die EÜR gesperrt wird)
    expect(vorlageFuer("bilanz_guv")!.abschnitte[0]!.hilfe).toContain("keine EÜR");
  });
});

describe("StB GoBD: Lohnkonto-Übersicht (E-7)", () => {
  it("heißt „Lohnkonto-Übersicht (aus den Abrechnungen)“ und verweist auf das Lohnprogramm", () => {
    const v = vorlageFuer("lohnkonto")!;
    expect(v.titel).toBe("Lohnkonto-Übersicht (aus den Abrechnungen)");
    expect(v.beschreibung).toContain("Das Lohnkonto nach § 4 LStDV führt dein Lohnprogramm");
    const t = klartext(html("lohnkonto", { name: "Lena Klein", jahr: "2026" }));
    expect(t).toContain("Lohnkonto-Übersicht");
    expect(t).toContain("aus den Abrechnungen · Lena Klein · 2026");
  });
});
