/** Befunde R11 (Vorlagen): Arbeitszeitnachweis, Gefährdungsbeurteilung, Unterweisung, Hygieneplan, Datenschutz, NachwG, neue Vorlagen, Kleinbetragsrechnung. */
import { describe, expect, it } from "vitest";
import { dokumentHtml, fehlendeAngaben, leereDaten, monatAus, vorlageFuer, type Betrieb, type Eintrag } from "../src/index.js";

const B: Betrieb = { name: "Glanzwerk Gebäudeservice", strasse: "Hafenstraße 4", plz: "44137", ort: "Dortmund", verantwortlich: "Dragana Petrović", telefon: "", email: "info@glanzwerk.example", steuernummer: "315/123/45678", ust_idnr: "", iban: "", bundesland: "Nordrhein-Westfalen" };
const v = (id: string) => vorlageFuer(id)!;
/** Text des Dokuments mit normalen Leerzeichen (das Dokument setzt feste Leerzeichen nach „§“, „Abs.“, zwischen Zahl und Einheit …) */
const glatt = (h: string) => h.replace(/&nbsp;|\u00a0|\u202f/g, " ");
const html = (id: string, d: Record<string, unknown>, b: Betrieb = B) => glatt(dokumentHtml(v(id), d as never, b));

describe("Arbeitszeitnachweis (Reinigung #9, #10)", () => {
  const tage: Eintrag[] = [
    { datum: "2026-10-05", beginn: "05:00", ende: "09:00", pause: "", einsatzort: "Praxis Dr. Muster" },
    { datum: "2026-10-06", beginn: "05:00", ende: "09:00", pause: "" },
  ];
  it("nimmt den Monat aus den Arbeitstagen, ohne Pflichtfeld", () => {
    expect(monatAus({ tage })).toBe("Oktober 2026");
    expect(monatAus({ monat: "Okt. 26", tage })).toBe("Okt. 26");
    expect(monatAus({ tage: [...tage, { datum: "2026-11-02", beginn: "05:00", ende: "06:00" }] })).toBe("Oktober 2026 – November 2026");
    expect(fehlendeAngaben(v("arbeitszeitnachweis"), { name: "Amira", tage }, B)).toEqual([]);
    expect(html("arbeitszeitnachweis", { name: "Amira", tage })).toContain("Amira, Oktober 2026");
  });
  it("Einsatzort als Spalte, nur wenn eingetragen", () => {
    expect(html("arbeitszeitnachweis", { name: "Amira", tage })).toContain("<th>Einsatzort</th>");
    expect(html("arbeitszeitnachweis", { name: "Amira", tage: [tage[1]!] })).not.toContain("<th>Einsatzort</th>");
  });
  it("Arbeitstage vor „Beschäftigt seit“ sind ein Fehler (R12: nicht nur ein Hinweis)", () => {
    const f = v("arbeitszeitnachweis").pruefen!({ name: "Amira", beschaeftigt_seit: "2026-11-01", tage }, B);
    expect(f.at(-1)).toMatch(/^2 Arbeitstage \(ab 05\.10\.2026\) liegen vor „Beschäftigt seit“ \(01\.11\.2026\)/);
    expect(v("arbeitszeitnachweis").pruefen!({ name: "Amira", beschaeftigt_seit: "2026-10-01", tage }, B)).toEqual([]);
  });
  it("Satz zur Aufzeichnungspflicht nach der Branche aus dem Profil", () => {
    expect(leereDaten(v("arbeitszeitnachweis"), B, "2026-10-20", ["gebaeudereinigung"]).branche).toBe("gebaeudereinigung");
    expect(leereDaten(v("arbeitszeitnachweis"), B, "2026-10-20", ["kosmetik"]).branche).toBe("friseur_kosmetik");
    expect(leereDaten(v("arbeitszeitnachweis"), B, "2026-10-20", []).branche).toBeNull();
    expect(html("arbeitszeitnachweis", { name: "Amira", tage, branche: "gebaeudereinigung" })).toContain("(hier: Gebäudereinigung)");
    expect(html("arbeitszeitnachweis", { name: "Amira", tage })).toContain("Gebäudereinigung, Messebau, Fleischwirtschaft, Prostitution, Wach- und Sicherheitsgewerbe sowie seit 30.12.2025 Friseur- und Kosmetikgewerbe");
  });
});

describe("Gefährdungsbeurteilung (Reinigung #11, Tischlerei #5, #17, #18)", () => {
  const liste = v("gefaehrdungsbeurteilung").abschnitte.flatMap((a) => a.felder).find((f) => f.id === "gefaehrdungen")!;
  it("Gruppen Gebäudereinigung und Holz / Tischlerei, als fachlich zu prüfen markiert", () => {
    const vs = liste.art === "liste" ? liste.vorschlaege ?? [] : [];
    const r = vs.filter((x) => x.gruppe === "Gebäudereinigung");
    const h = vs.filter((x) => x.gruppe === "Holz / Tischlerei");
    // E-167: sechs weitere Gefährdungen der Gebäudereinigung aus der Sifa-Durchsicht; Fachquellen statt „Nutzertest“
    expect(r.length).toBe(11);
    expect(h.length).toBe(5);
    for (const x of [...r, ...h]) expect(x.quelle).not.toMatch(/Nutzertest/);
    expect([...r, ...h].filter((x) => /fachlich zu prüfen$/.test(x.quelle!)).length).toBe(2);
    expect(h.some((x) => /Hartholzstaub/.test(x.titel) && /TRGS 553/.test(x.quelle!))).toBe(true);
    expect(r.some((x) => /§ 8 ArbSchG/.test(String(x.werte.massnahme)))).toBe(true);
  });
  it("eigener Eintrag fragt den Gefährdungsfaktor ab", () => {
    const faktor = liste.art === "liste" ? liste.felder.find((f) => f.id === "faktor")! : null;
    expect(faktor && "vorbelegung" in faktor ? faktor.vorbelegung : undefined).toBeUndefined();
    expect(faktor?.pflicht).toBe(true);
  });
  it("Mutterschutz: Hinweis bei Holzstaub oder Lärm und „keine Schutzmaßnahmen erforderlich“", () => {
    const d = { gefaehrdungen: [{ beschreibung: "Hartholzstaub beim Schleifen", massnahme: "Absaugung" }], mutterschutz_ergebnis: "keine_massnahmen" };
    expect(v("gefaehrdungsbeurteilung").hinweise!(d, B)[0]).toMatch(/Mutterschutz: .*§§ 9 bis 12 MuSchG/);
    expect(v("gefaehrdungsbeurteilung").hinweise!({ ...d, mutterschutz_ergebnis: "umgestaltung" }, B)).toEqual([]);
  });
});

describe("Unterweisung, Hygieneplan, Datenschutz, NachwG", () => {
  it("Unterweisung: unterwiesen in Sprache", () => {
    const h = html("unterweisung", { thema: "Erstunterweisung", datum: "2026-10-20", durchgefuehrt_von: "Dragana", sprache: "Arabisch", teilnehmer: [{ name: "Amira" }] });
    expect(h).toContain("unterwiesen in Sprache: Arabisch");
    expect(h).toContain("Sprache");
  });
  it("Hygieneplan: Bayern-Zusatz nur in Bayern, „Wer“ ohne Beschäftigte aus „Verantwortlich“", () => {
    const e = [{ was: "Instrumente", womit: "Desinfektionsmittel (Bayern: mind. begrenzt viruzid)", wer: "Beschäftigte" }];
    const hh = { ...B, bundesland: "Hamburg", verantwortlich: "Nele Brandt" };
    expect(html("hygieneplan", { eintraege: e, erstellt_von: "Nele Brandt" }, hh)).not.toContain("Bayern");
    expect(html("hygieneplan", { eintraege: e }, { ...B, bundesland: "Bayern" })).toContain("Bayern: mind. begrenzt viruzid");
    expect(html("hygieneplan", { eintraege: e, erstellt_von: "Nele Brandt", mit_beschaeftigten: false }, hh)).toMatch(/<td>Nele Brandt<\/td>/);
    expect(html("hygieneplan", { eintraege: e, erstellt_von: "Nele Brandt", mit_beschaeftigten: true }, hh)).toMatch(/<td>Beschäftigte<\/td>/);
  });
  it("Datenschutzinformation: Gesundheitsangaben freiwillig, Buchungsplattform mit eigenem Konto", () => {
    const g = "Kundenkartei mit Gesundheitsangaben (z. B. Allergien, Unverträglichkeiten)";
    const t = "Terminvereinbarung (telefonisch, vor Ort oder Online-Buchung)";
    const h = html("datenschutzinformation", { fuer_wen: "Kundinnen und Kunden", verarbeitungen: [g, t], bereitstellung: "vertrag", buchung: "plattform" });
    expect(h).toContain("Ihre Angabe ist freiwillig");
    expect(h).toContain("Sichere Behandlung");
    expect(h).toContain("auch in eigener Verantwortung");
  });
  it("Website: Terminbuchung über eine Plattform mit eigenem Kundenkonto", () => {
    const d = { module: ["online_terminbuchung"], termin_anbieter: "Treatwell", termin_anschrift: "London", termin_art: "plattform" };
    expect(html("datenschutzerklaerung_website", d)).toContain("auch in eigener Verantwortung");
    expect(html("datenschutzerklaerung_website", { ...d, termin_art: "tool" })).toContain("Vertrags zur Auftragsverarbeitung nach Art. 28 DSGVO");
  });
  it("VVT Personalverwaltung: Krankheitszeiten mit Art. 9 Abs. 2 lit. b", () => {
    const h = html("datenschutz_dokumentation", { verarbeitungen: [{ bezeichnung: "x" }] });
    expect(typeof h).toBe("string");
    const vvt = v("datenschutzinformation").abschnitte[0]!.felder.find((f) => f.id === "verarbeitungen")!;
    expect(vvt.art).toBe("bausteine");
    expect(html("datenschutzinformation", { fuer_wen: "Beschäftigte", verarbeitungen: ["Personalverwaltung (Personalakte, Arbeitszeit)"] })).toContain("Art. 9 Abs. 2 lit. b DSGVO");
  });
  it("NachwG: Provision als eigene Zeile mit eigenem Datum", () => {
    const h = html("nachweis_arbeitsbedingungen", { name: "Kim", entgelt_art: "monat", entgelt_betrag: "3000", provision: "5 % vom eigenen Umsatz", provision_ab: "2026-07-01" });
    expect(h).toContain("<th>Provision</th><td>5 % vom eigenen Umsatz (ab 01.07.2026)</td>");
  });
});

describe("Neue Vorlagen und Kleinbetragsrechnung", () => {
  it("Hinweis auf die Ausweispflicht nennt § 2a SchwarzArbG und hat Unterschriften", () => {
    const h = html("ausweis_hinweis", { name: "Amira", datum: "2026-10-20" });
    expect(h).toContain("§ 2a Abs. 1 SchwarzArbG");
    expect(h).toContain("Unterschrift beschäftigte Person");
    expect(v("ausweis_hinweis").pflichten).toEqual(["personal.ausweis_hinweis"]);
  });
  it("Schlüsselquittung und Anamnese mit Einwilligung", () => {
    expect(html("schluesselquittung", { objekt: "Praxis", empfaenger: "Amira", datum: "2026-10-20", schluessel: [{ bezeichnung: "Haustür", anzahl: "1" }] })).toContain("Haustür");
    const a = html("anamnese_einwilligung", { name: "Kim", angaben: "Nickelallergie" });
    expect(a).toContain("Art. 9 Abs. 2 lit. a DSGVO");
    expect(a).toContain("Art. 7 Abs. 3 DSGVO");
    expect(a).toContain("Nickelallergie");
  });
  it("Kleinbetragsrechnung bis 250 €: Empfänger keine Pflicht, Steuersatz beim Gesamtbetrag", () => {
    const r = v("rechnung");
    const klein = { nummer: "2026-010", datum: "2026-10-20", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", preis: "37,82", satz: "19" }] };
    const fehlt = fehlendeAngaben(r, klein as never, B);
    expect(fehlt).not.toContain("Name oder Firma");
    expect(fehlt).not.toContain("Anschrift");
    expect(glatt(dokumentHtml(r, klein as never, B))).toContain("Rechnungsbetrag inkl. 19 % USt");
    const gross = { ...klein, positionen: [{ bezeichnung: "Hochzeit", menge: "1", preis: "300", satz: "19" }] };
    expect(fehlendeAngaben(r, gross as never, B)).toContain("Name oder Firma");
    expect(glatt(dokumentHtml(r, gross as never, B))).not.toContain("inkl. 19 % USt");
  });
});
