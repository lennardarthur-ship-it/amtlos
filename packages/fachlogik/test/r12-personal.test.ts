/** R12 Personal: Arbeitszeitnachweis (Minijob, Mindestlohn, ArbZG, 7-Tage-Frist, Monat), Ausweis-Hinweis, Fassung, Kassenmeldung je Betriebsstätte. */
import { describe, expect, it } from "vitest";
import { arbeitszeitPruefung, dokumentHtml, fassungText, fehlendeAngaben, monatAus, monatSchluessel, unterlagenName, vorlageFuer, type Betrieb, type Eintrag } from "../src/index.js";

const B: Betrieb = { name: "Café Hafenblick", strasse: "Kai 3", plz: "20457", ort: "Hamburg", verantwortlich: "Ines Hafner", telefon: "", email: "", steuernummer: "22/123/45678", ust_idnr: "", iban: "", bundesland: "Hamburg" };
const v = (id: string) => vorlageFuer(id)!;
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ");
const html = (id: string, d: Record<string, unknown>) => glatt(dokumentHtml(v(id), d as never, B));
const tag = (datum: string, beginn: string, ende: string, pause = "30"): Eintrag => ({ datum, beginn, ende, pause });

/** Minijobber: zehn Tage zu 5 Stunden (ohne Pause) = 50 h */
const minijob = (stundenlohn = "13,90") => ({ name: "Rami Haddad", art: "minijob", entgelt_art: "stunde", stundenlohn, tage: Array.from({ length: 10 }, (_, i) => tag(`2026-08-${String(i + 3).padStart(2, "0")}`, "10:00", "15:00", "0")) });

describe("Arbeitszeitnachweis: Minijob und Mindestlohn (Zoll #4)", () => {
  it("Stunden × Lohn über der Minijob-Grenze – mit Höchststunden", () => {
    const p = { hinweise: arbeitszeitPruefung(minijob()).hinweise.map(glatt) };
    expect(p.hinweise[0]).toContain("50:00 h × 13,90 € = 695,00 €");
    expect(p.hinweise[0]).toContain("603,00 €");
    expect(p.hinweise[0]).toContain("höchstens 43,38 h");
    expect(v("arbeitszeitnachweis").ergebnis!(minijob())).toEqual([["Höchstens im Minijob", "43,38 h"], ["Arbeitszeit im Monat", "50:00 h"]]);
    // unter der Grenze: kein Hinweis zur Grenze
    const wenig = { ...minijob(), tage: minijob().tage.slice(0, 8) };
    expect(arbeitszeitPruefung(wenig).hinweise.some((h) => h.includes("Minijob-Grenze"))).toBe(false);
  });
  it("Stundenlohn unter dem Mindestlohn; nicht bei Azubis", () => {
    expect(glatt(arbeitszeitPruefung({ ...minijob("12,00"), art: "teilzeit" }).hinweise[0]!)).toMatch(/12,00 € liegt unter dem Mindestlohn von 13,90 €/);
    expect(arbeitszeitPruefung({ ...minijob("8,00"), art: "ausbildung" }).hinweise).toEqual([]);
  });
  it("Monatsgehalt ÷ Stunden gegen den Mindestlohn", () => {
    const d = { name: "Sabine", art: "vollzeit", entgelt_art: "monat", monatsgehalt: "600,00", tage: minijob().tage };
    expect(glatt(arbeitszeitPruefung(d).hinweise[0]!)).toMatch(/Monatsgehalt 600,00 € ÷ 50:00 h = 12,00 € je Stunde/);
    expect(arbeitszeitPruefung({ ...d, monatsgehalt: "2.500,00" }).hinweise).toEqual([]);
  });
});

describe("Arbeitszeitnachweis: ArbZG und 7-Tage-Frist (Zoll #3, #14)", () => {
  it("mehr als 10 Stunden und zu kurze Pausen", () => {
    const h = arbeitszeitPruefung({ tage: [tag("2026-10-17", "08:00", "19:30", "30"), tag("2026-10-18", "08:00", "15:00", "0"), tag("2026-10-19", "08:00", "18:00", "30"), tag("2026-10-20", "08:00", "14:00", "0")] }).hinweise;
    expect(h[0]).toBe("Mehr als 10 Stunden Arbeitszeit am 17.10.2026 (§ 3 ArbZG). Bitte prüfen.");
    // 17.10.: 11 h mit 30 Min.; 18.10.: 7 h ohne Pause; 19.10.: 9:30 h mit 30 Min.; 20.10.: genau 6 h ohne Pause ist erlaubt
    expect(h[1]).toMatch(/^Zu kurze Pause am 17\.10\.2026, 18\.10\.2026, 19\.10\.2026:/);
  });
  it("Hinweis, wenn ein Tag mehr als sieben Tage nach dem Arbeitstag erfasst wurde", () => {
    const h = arbeitszeitPruefung({ tage: [{ ...tag("2026-08-03", "10:00", "15:00", "0"), erfasst_am: "2026-08-20" }, { ...tag("2026-08-04", "10:00", "15:00", "0"), erfasst_am: "2026-08-11" }] }).hinweise;
    expect(h).toEqual(["Ein Arbeitstag wurde später als sieben Tage nach dem Arbeitstag erfasst (03.08.2026). Nach § 17 Abs. 1 MiLoG ist bis zum Ablauf des siebten Tages aufzuzeichnen."]);
  });
  it("Spalte „Erfasst am“ im PDF nur auf Wunsch", () => {
    const d = { name: "Rami", tage: [{ ...tag("2026-08-03", "10:00", "15:00", "0"), erfasst_am: "2026-08-03", geaendert_am: "2026-09-21" }] };
    expect(html("arbeitszeitnachweis", d)).not.toContain("Erfasst am");
    const mit = html("arbeitszeitnachweis", { ...d, erfasst_spalte: true });
    expect(mit).toContain("<th>Erfasst am</th>");
    expect(mit).toContain("geändert 21.09.2026");
  });
});

describe("Arbeitszeitnachweis: Tage und Monat (Kurier #1, #11, #18; Zoll #11)", () => {
  it("leere Tage machen den Nachweis unvollständig, verschieben aber nicht den Monat", () => {
    const d = { name: "Kim", tage: [tag("2026-11-02", "08:00", "14:00", "0"), { datum: "2026-10-21" }, { datum: "2026-10-22" }] };
    expect(fehlendeAngaben(v("arbeitszeitnachweis"), d as never, B)).toEqual(["Arbeitstag 2: Beginn", "Arbeitstag 2: Ende", "Arbeitstag 3: Beginn", "Arbeitstag 3: Ende"]);
    expect(monatAus(d as never)).toBe("November 2026");
    // Blatt zum Eintragen von Hand: kein Tag mit Inhalt – nichts fehlt an den Tagen
    expect(fehlendeAngaben(v("arbeitszeitnachweis"), { name: "Kim", tage: [{ datum: "2026-10-21" }] } as never, B)).toEqual([]);
  });
  it("ein eingetragener Monat begrenzt die Tage", () => {
    expect(monatSchluessel("Oktober 2026")).toBe("2026-10");
    expect(monatSchluessel("Okt. 2026")).toBe("2026-10");
    expect(monatSchluessel("10/2026")).toBe("2026-10");
    expect(monatSchluessel("irgendwann")).toBeNull();
    const f = fehlendeAngaben(v("arbeitszeitnachweis"), { name: "Kim", monat: "Oktober 2026", tage: [tag("2026-10-30", "08:00", "12:00"), tag("2026-11-02", "08:00", "12:00")] } as never, B);
    expect(f).toEqual(["Der Arbeitstag am 02.11.2026 liegt nicht im Monat Oktober 2026."]);
  });
  it("der Monat der Aufzeichnung steht im Namen", () => {
    expect(unterlagenName(v("arbeitszeitnachweis"), { name: "Rami Haddad", tage: [tag("2026-09-03", "10:00", "15:00")] })).toBe("Arbeitszeitnachweis September 2026 · Rami Haddad");
    expect(unterlagenName(v("arbeitszeitnachweis"), { name: "Rami Haddad", tage: [] })).toBe("Arbeitszeitnachweis · Rami Haddad");
  });
});

describe("Fassungen und Ausweis-Hinweis (Zoll #2, #6)", () => {
  it("„Fassung vom …“ und nach einer Korrektur mit ersetzter Fassung und Grund", () => {
    expect(fassungText({ fassung_stand: "2026-09-01" })).toBe("Fassung vom 01.09.2026.");
    expect(fassungText({ fassung_stand: "2026-10-21", fassung_nr: "2", fassung_ersetzt: "2026-09-01", fassung_grund: "Beginn am 12.08. war 10:00" })).toBe("Fassung 2 vom 21.10.2026 – ersetzt die Fassung vom 01.09.2026. Grund der Korrektur: Beginn am 12.08. war 10:00");
    expect(fassungText({})).toBe("");
    expect(html("arbeitszeitnachweis", { ...minijob(), fassung_stand: "2026-10-21", fassung_nr: "2", fassung_ersetzt: "2026-09-01", fassung_grund: "Tippfehler" })).toContain("Fassung 2 vom 21.10.2026");
    for (const id of ["arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ausweis_hinweis"]) expect(v(id).festschreiben && v(id).korrektur).toBe(true);
  });
  it("Ausweis-Hinweis nach Beginn ausgehändigt: Warnung", () => {
    const h = v("ausweis_hinweis").hinweise!({ name: "Rami", datum: "2026-08-10", beginn: "2026-08-03" }, B);
    expect(h[0]).toMatch(/auf den 10\.08\.2026 datiert, die Beschäftigung begann am 03\.08\.2026/);
    expect(v("ausweis_hinweis").hinweise!({ name: "Rami", datum: "2026-08-01", beginn: "2026-08-03" }, B)).toEqual([]);
    expect(v("ausweis_hinweis").person!.felder.beginn).toBe("beginn");
  });
});

describe("Kassenmeldung je Betriebsstätte (Bäckerei #3)", () => {
  const kasse = (sn: string, staette = "") => ({ art: "elektronisch", hersteller: "K", modell: `M${sn}`, seriennummer: sn, anschaffung: "2026-01-02", tse_art: "Cloud-TSE", tse_seriennummer: `T${sn}`, betriebsstaette: staette });
  it("ein Blatt je Betriebsstätte mit ihrer Anschrift und ihren Kassen", () => {
    const h = html("kassenmeldung", { stand: "2026-10-21", betriebsstaetten: [{ name: "Filiale Markt", anschrift: "Markt 1\n20095 Hamburg" }], kassen: [kasse("1"), kasse("2", "Filiale Markt"), kasse("3", "filiale markt")] });
    expect(h).toContain("hier 2 Blätter");
    expect(h).toContain("Betriebsstätte 1 von 2");
    expect(h).toContain("Café Hafenblick, Kai 3, 20457 Hamburg");
    expect(h).toContain("Filiale Markt, Markt 1, 20095 Hamburg");
    expect(h.match(/break-before:page/g)?.length).toBe(1);
    // je Blatt die eigene Zahl und neu gezählte Aufzeichnungssysteme
    expect(h).toMatch(/Anzahl der Aufzeichnungssysteme<\/th><td class="wert">1</);
    expect(h).toMatch(/Anzahl der Aufzeichnungssysteme<\/th><td class="wert">2</);
  });
  it("ohne Betriebsstätten wie bisher ein Blatt", () => {
    const h = html("kassenmeldung", { kassen: [kasse("1"), kasse("2")] });
    expect(h).not.toContain("break-before:page");
    expect(h).not.toContain("hier 2 Blätter");
    expect(h).toContain("Aufzeichnungssystem 2");
  });
});
