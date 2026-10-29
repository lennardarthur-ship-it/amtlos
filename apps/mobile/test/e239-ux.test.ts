/**
 * E-239 (externe Rückmeldung 29.10.2026): A) Fortgeschrittenes nur bei passendem Profil sofort sichtbar – immer erreichbar,
 * mit Daten immer sichtbar; B) Warnungen in Stufen (Blocker sichtbar, Hinweise in einer Zeile, Erklärungen unter „Mehr
 * erfahren“), Wortlaut unverändert. Gerechnet wird wie vorher – geprüft wird nur, was sofort sichtbar ist, und gezählt,
 * wie viel davon für ein typisches Kleinunternehmen vorher und nachher auf den Hauptbildschirmen steht.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, RECHNUNG_EINHEIT_CODE, RECHNUNG_EU_19, RECHNUNG_KU_IGL, RECHNUNG_KU_PROFIL, RECHNUNG_LEITWEG, fehlendeAngaben, leereDaten, ohneVerdeckteFelder, profilStartwerte, sichtbar, vorlageFuer, type Daten, type Feld } from "@amtlos/fachlogik";
import { T as TEXT } from "../src/texte";
import { LEERER_STAND, type Stand, type Unterlage } from "../src/unterlagen/speicher";
import { betriebKuBisSichtbar, betriebUstIdSichtbar, betriebVersteuerungSichtbar, belegSkontoSichtbar, belegSteuerschuldSichtbar, felderAufteilen, kontenvorgabenSichtbar, mitarbeiterSichtbar, nebensacheFuer, rechnungFeldPasst, relevanz, uneinbringlichSichtbar, vorlagePasst } from "../src/ui/sichtbarkeit";
import { immerSichtbar, ordnen } from "../src/ui/hinweisStufen";
import { euMeldungen, ustErgebnis, ustMeldungen } from "../src/seiten/ustMeldungen";
import { handwerkLaut, ohneZahlungsweg, rechnungHinweisStufe } from "../src/seiten/rechnungHinweise";
import type { UstUebernahme } from "../src/unterlagen/ustAusRechnungen";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");

/** Typisches Kleinunternehmen: Kosmetikerin, Einzelunternehmen, Kunden nur in Deutschland, kein Einkauf im Ausland, niemand angestellt. */
const KLEIN: Stand = {
  ...LEERER_STAND,
  betrieb: { ...LEERER_BETRIEB, name: "Kosmetik Lea", strasse: "Rosenweg 1", plz: "80331", ort: "München", steuernummer: "143/123/12345", iban: "DE02120300000000202051" },
  profil: { rechtsform: "einzelunternehmen", "taetigkeit.branchen": ["beauty_kosmetik"], "kunden.regionen": ["inland"], "ust.kleinunternehmer": true, "einkauf.ausland_unternehmen": false, "beschaeftigte.gesamt": 0 },
};
/** Händlerin mit Privatkunden in der EU, regelbesteuert (OSS passt), mit Steuerberatung und einer Angestellten. */
const EU: Stand = {
  ...KLEIN,
  profil: { rechtsform: "einzelunternehmen", "taetigkeit.branchen": ["onlinehandel"], "kunden.regionen": ["inland", "eu"], "kunden.segmente": ["b2c", "b2b"], "ust.kleinunternehmer": false, "beschaeftigte.gesamt": 1, steuerberater: true },
};
/** Handwerk, regelbesteuert, Fragen zum Ausland nicht gestellt (nur Kleinunternehmer werden gefragt). */
const HANDWERK: Stand = { ...KLEIN, profil: { rechtsform: "einzelunternehmen", "taetigkeit.branchen": ["handwerk"], "kunden.regionen": ["inland"], "ust.kleinunternehmer": false } };

const rechnung = vorlageFuer("rechnung")!;
const feld = (id: string): Feld => rechnung.abschnitte.flatMap((a) => a.felder).find((f) => f.id === id)!;

const basis2: UstUebernahme = {
  werte: {}, anzahl: 6, ersatz: 0, offen: 0, vorsteuerBelege: 9, ohneVorsteuer: 0, kleinunternehmer: false, kuGemischt: false, gutschriften: 0, vorsteuerPruefen: false, steuerschuldBelege: 0, igeBelege: 0, igeKu: 0, erwerbsschwelle: null, kuVoranmeldungPflicht: false, igeAndere: 0, igeOhneEuro: 0, rcOhneEuro: 0,
  kasseTage: 0, kasseFehlend: [], minderungen: 0, ersatzNummern: [], oss: 0, berichtigungen: [], berichtigungenAnderswo: [], schlussFehlt: [], uneinbringlich: [], uneinbringlichNicht: [],
} as unknown as UstUebernahme;

describe("A – Fortgeschrittenes nur bei passendem Profil (gating)", () => {
  it("Relevanz aus den Antworten des Checks", () => {
    expect(relevanz(KLEIN)).toMatchObject({ euKunden: false, oss: false, einkaufAusland: false, bilanz: false, personal: false, kleinunternehmer: true, steuerberatung: false });
    expect(relevanz(EU)).toMatchObject({ euKunden: true, oss: true, einkaufAusland: true, personal: true, kleinunternehmer: false, steuerberatung: true });
    // nicht gefragt (regelbesteuert) bzw. unbekannt: sichtbar lassen
    expect(relevanz(HANDWERK)).toMatchObject({ einkaufAusland: true, personal: true });
    // Kleinunternehmer mit EU-Kunden: keine OSS (keine Umsatzsteuer), aber USt-IdNr. des Empfängers
    expect(relevanz({ ...KLEIN, profil: { ...KLEIN.profil, "kunden.regionen": ["eu"] } })).toMatchObject({ euKunden: true, oss: false });
    // „Einkauf in der EU: ja“ schließt den Einkauf im Ausland ein
    expect(relevanz({ ...KLEIN, profil: { ...KLEIN.profil, "einkauf.eu_unternehmen": true } }).einkaufAusland).toBe(true);
  });

  it("Rechnung: OSS und USt-IdNr. des Empfängers nur bei EU-Kunden – mit Daten immer", () => {
    const k = relevanz(KLEIN);
    const e = relevanz(EU);
    expect(rechnungFeldPasst("oss", k, {})).toBe(false);
    expect(rechnungFeldPasst("oss_satz", k, {})).toBe(false);
    expect(rechnungFeldPasst("kunde_ust_idnr", k, {})).toBe(false);
    expect(rechnungFeldPasst("oss", e, {})).toBe(true);
    expect(rechnungFeldPasst("kunde_ust_idnr", e, {})).toBe(true);
    // vorhandene Daten bzw. Gutschrift, igL, § 13b auf dieser Rechnung
    expect(rechnungFeldPasst("oss_satz", k, { oss: true })).toBe(true);
    expect(rechnungFeldPasst("kunde_ust_idnr", k, { kunde_ust_idnr: "ATU12345678" })).toBe(true);
    expect(rechnungFeldPasst("kunde_ust_idnr", k, { hinweise: ["gutschrift"] })).toBe(true);
    expect(rechnungFeldPasst("kunde_ust_idnr", k, { hinweise: ["reverse_charge"] })).toBe(true);
    // Grundstücks-Hinweis: im Salon nicht, im Handwerk und ohne Branche schon
    expect(rechnungFeldPasst("grundstueck_bezug", k, {})).toBe(false);
    expect(rechnungFeldPasst("grundstueck_bezug", relevanz(HANDWERK), {})).toBe(true);
    expect(rechnungFeldPasst("grundstueck_bezug", relevanz({ ...KLEIN, profil: {} }), {})).toBe(true);
    expect(rechnungFeldPasst("grundstueck_bezug", k, { grundstueck_bezug: true })).toBe(true);
    // andere Vorlagen und Felder unberührt
    expect(nebensacheFuer("ust_voranmeldung", k, {})).toBeUndefined();
    expect(rechnungFeldPasst("nummer", k, {})).toBe(true);
  });

  it("Felder: unpassend → hinter „Weitere Angaben“, ausgefüllt sofort, aufgeklappt unter „Für besondere Fälle“ (nichts springt)", () => {
    const steuer = rechnung.abschnitte[3]!.felder;
    // regelbesteuert, Kunden nur im Inland (OSS steht bei Kleinunternehmern ohnehin nicht zur Wahl)
    const rel = relevanz(HANDWERK);
    const neben = nebensacheFuer("rechnung", rel, {})!;
    const d: Daten = {};
    const da = steuer.filter((f) => sichtbar(f, d));
    const zu = felderAufteilen(da, d, [], null, neben);
    expect(zu.zeigen.map((f) => f.id)).toEqual(["hinweis"]);
    expect(zu.versteckt.map((f) => f.id)).toContain("oss");
    // aufgeklappt (Liste beim Aufklappen festgehalten – auch der noch verdeckte Steuersatz): OSS am Ende
    const ids = steuer.filter(neben).map((f) => f.id);
    expect(ids).toEqual(["oss", "oss_satz"]);
    const auf = felderAufteilen(da, d, [], ids, neben);
    expect(auf.besondere.map((f) => f.id)).toEqual(["oss"]);
    expect(auf.zeigen.map((f) => f.id)).toEqual(expect.arrayContaining(["kleinunternehmer", "hinweise", "hinweis"]));
    expect(auf.zeigen.map((f) => f.id)).not.toContain("oss");
    // OSS eingeschaltet, während aufgeklappt: Steuersatz erscheint bei den besonderen Fällen, nicht oben
    const d2 = { ...d, oss: true };
    const auf2 = felderAufteilen(steuer.filter((f) => sichtbar(f, d2)), d2, [], ids, nebensacheFuer("rechnung", rel, d2));
    expect(auf2.besondere.map((f) => f.id)).toEqual(["oss", "oss_satz"]);
    // zugeklappt mit Daten: beide sofort sichtbar
    const zu2 = felderAufteilen(steuer.filter((f) => sichtbar(f, d2)), d2, [], null, nebensacheFuer("rechnung", rel, d2));
    expect(zu2.zeigen.map((f) => f.id)).toEqual(expect.arrayContaining(["oss", "oss_satz"]));
    // unter „Fehlt noch“ genannt: sichtbar
    expect(felderAufteilen(da, d, [feld("oss").label], null, neben).zeigen.map((f) => f.id)).toContain("oss");
    // passendes Profil: OSS ist ein gewöhnliches seltenes Feld (keine besonderen Fälle)
    const eu = nebensacheFuer("rechnung", relevanz(EU), {})!;
    expect(steuer.filter(eu)).toEqual([]);
  });

  it("Beleg: „Ich schulde die Umsatzsteuer“ nur bei Einkauf im Ausland (oder unbekannt) – mit Daten immer; Skonto nur mit Betrag", () => {
    expect(belegSteuerschuldSichtbar(relevanz(KLEIN), { steuerschuld: null })).toBe(false);
    expect(belegSteuerschuldSichtbar(relevanz(KLEIN), { steuerschuld: "ige" })).toBe(true);
    expect(belegSteuerschuldSichtbar(relevanz(HANDWERK), { steuerschuld: null })).toBe(true);
    expect(belegSteuerschuldSichtbar(relevanz({ ...KLEIN, profil: { ...KLEIN.profil, "einkauf.ausland_unternehmen": true } }), { steuerschuld: null })).toBe(true);
    expect(belegSkontoSichtbar({ skonto_cent: null })).toBe(false);
    expect(belegSkontoSichtbar({ skonto_cent: 300 })).toBe(true);
    // die Seite hält die Liste beim Aufklappen fest und zeigt alles Ausgeblendete hinter einer Zeile
    const b = lies("seiten/Belege.tsx");
    expect(b).toContain("const weitere = mehr ?? weitereJetzt;");
    expect(b).toContain("TEXT.weitere_angaben(weitere.length)");
  });

  it("Mein Betrieb: USt-IdNr., Soll/Ist und „Kleinunternehmer bis“ nach Profil – eingetragen immer; Mitarbeiter nur mit Beschäftigten", () => {
    const k = relevanz(KLEIN);
    expect(betriebUstIdSichtbar(k, KLEIN.profil, "")).toBe(false);
    expect(betriebUstIdSichtbar(k, KLEIN.profil, "DE123456789")).toBe(true);
    expect(betriebUstIdSichtbar(relevanz(EU), EU.profil, "")).toBe(true);
    expect(betriebUstIdSichtbar(k, { ...KLEIN.profil, "einkauf.eu_unternehmen": true }, "")).toBe(true);
    expect(betriebVersteuerungSichtbar(k, "")).toBe(false);
    expect(betriebVersteuerungSichtbar(k, "ist")).toBe(true);
    expect(betriebVersteuerungSichtbar(relevanz(EU), "")).toBe(true);
    expect(betriebKuBisSichtbar(KLEIN.profil, "")).toBe(false);
    expect(betriebKuBisSichtbar(KLEIN.profil, "2026-03-31")).toBe(true);
    expect(betriebKuBisSichtbar(EU.profil, "")).toBe(true);
    expect(mitarbeiterSichtbar(k)).toBe(false);
    expect(mitarbeiterSichtbar(relevanz({ ...KLEIN, mitarbeiter: [{ id: "m1", name: "Sam" }] }))).toBe(true);
    expect(mitarbeiterSichtbar(relevanz({ ...KLEIN, profil: Object.fromEntries(Object.entries(KLEIN.profil).filter(([k]) => k !== "beschaeftigte.gesamt")) }))).toBe(true);
    expect(mitarbeiterSichtbar(relevanz(EU))).toBe(true);
    // Kontenvorgaben der Kanzlei: mit Steuerberatung, Bilanz oder eingetragenen Vorgaben
    expect(kontenvorgabenSichtbar(k, 0)).toBe(false);
    expect(kontenvorgabenSichtbar(k, 2)).toBe(true);
    expect(kontenvorgabenSichtbar(relevanz(EU), 0)).toBe(true);
    expect(kontenvorgabenSichtbar(relevanz({ ...KLEIN, profil: { ...KLEIN.profil, rechtsform: "gmbh" } }), 0)).toBe(relevanz({ ...KLEIN, profil: { ...KLEIN.profil, rechtsform: "gmbh" } }).bilanz);
  });

  it("Zahlung: „Forderung uneinbringlich“ ab Fälligkeit oder mit Vermerk; Vorlagen der Anlässe nach Profil, eigene immer", () => {
    expect(uneinbringlichSichtbar({}, "2026-11-12", "2026-10-29")).toBe(false);
    expect(uneinbringlichSichtbar({}, "2026-10-01", "2026-10-29")).toBe(true);
    expect(uneinbringlichSichtbar({ uneinbringlich: { datum: "2026-10-20", grund: "insolvenz", geaendert: "2026-10-20T10:00:00.000Z" } }, "2026-11-12", "2026-10-29")).toBe(true);
    const k = relevanz(KLEIN);
    expect(vorlagePasst("steuern", "oss_meldung", k, KLEIN)).toBe(false);
    expect(vorlagePasst("steuern", "zm_meldung", k, KLEIN)).toBe(false);
    expect(vorlagePasst("steuern", "bilanz_guv", k, KLEIN)).toBe(false);
    expect(vorlagePasst("steuern", "euer", k, KLEIN)).toBe(true);
    expect(vorlagePasst("laufend", "lohnkonto", k, KLEIN)).toBe(false);
    // „Ich stelle jemanden ein“: alles – man stellt ja gerade ein
    expect(vorlagePasst("einstellen", "lohnkonto", k, KLEIN)).toBe(true);
    expect(vorlagePasst("steuern", "oss_meldung", relevanz(EU), EU)).toBe(true);
    expect(vorlagePasst("steuern", "zm_meldung", relevanz(EU), EU)).toBe(true);
    // schon eine eigene OSS-Erklärung: immer sichtbar
    const mitOss: Stand = { ...KLEIN, unterlagen: [{ id: "o1", vorlage: "oss_meldung", daten: {}, erstellt: "2026-10-01T00:00:00Z", geaendert: "2026-10-01T00:00:00Z" } as unknown as Unterlage] };
    expect(vorlagePasst("steuern", "oss_meldung", relevanz(mitOss), mitOss)).toBe(true);
  });

  it("Rechnen bleibt gleich: die Regeln sitzen nur in der Oberfläche", () => {
    // keine Rechen- oder Exportdatei importiert die Sichtbarkeitsregeln
    for (const datei of ["unterlagen/ustAusRechnungen.ts", "unterlagen/steuerpaket.ts", "unterlagen/euMeldungen.ts", "unterlagen/speicher.ts", "unterlagen/kasse.ts", "unterlagen/pruefexport.ts"]) {
      expect(lies(datei), datei).not.toMatch(/sichtbarkeit|hinweisStufen|ustMeldungen/);
    }
  });
});

describe("B – Warnungen in Stufen", () => {
  it("ordnen: doppelte Texte einmal, höchste Stufe gewinnt; ein Kasten für Blocker, eine Zeile für den Rest", () => {
    const g = ordnen([{ text: "A", stufe: "hinweis" }, { text: "A", stufe: "blocker" }, { text: "B", stufe: "info" }, { text: "C", stufe: "hinweis" }, null, false, { text: " ", stufe: "blocker" }]);
    expect(g.blocker.map((m) => m.text)).toEqual(["A"]);
    expect(g.hinweise.map((m) => m.text)).toEqual(["C"]);
    expect(g.info.map((m) => m.text)).toEqual(["B"]);
    expect(immerSichtbar(g)).toBe(2);
    expect(immerSichtbar(ordnen([{ text: "x", stufe: "info" }]))).toBe(1);
    expect(immerSichtbar(ordnen([]))).toBe(0);
    expect(TEXT.e239_bereit(2)).toBe("Alles bereit – 2 Hinweise");
    expect(TEXT.e239_hinweise(1)).toBe("1 Hinweis");
  });

  const basis: UstUebernahme = basis2;

  it("Voranmeldung: Blocker sichtbar, Erklärungen unter „Mehr erfahren“ – Wortlaut unverändert", () => {
    const ruhig = ustMeldungen(basis, { kasse: null, dfv: false, dezember: false });
    expect(ruhig.blocker).toEqual([]);
    expect(ruhig.info.map((m) => m.text)).toEqual([TEXT.aus_rechnungen_vorsteuer(9, 0)]);
    expect(ustErgebnis(basis)).toBe(TEXT.aus_rechnungen_ok(6));
    // Kleinunternehmer mit Erwerbsbesteuerung: § 18 Abs. 4a UStG ist ein Blocker, keine Ergebniszeile
    const ku = ustMeldungen({ ...basis, kleinunternehmer: true, kuVoranmeldungPflicht: true, igeBelege: 1 }, { kasse: null, dfv: false, dezember: false });
    expect(ku.blocker.map((m) => m.text)).toEqual([TEXT.e227_ku_va_pflicht]);
    expect(ustErgebnis({ ...basis, kleinunternehmer: true, kuVoranmeldungPflicht: true })).toBeNull();
    const mehr = ustMeldungen({ ...basis, igeOhneEuro: 1, rcOhneEuro: 2, offen: 3, gutschriften: 1 }, { kasse: { text: "Kasse fehlt", warnung: true }, dfv: true, dezember: true });
    expect(mehr.blocker.map((m) => m.text)).toEqual(["Kasse fehlt", TEXT.e224_ige_ohne_euro(1), TEXT.e224_13b_ohne_euro(2), TEXT.ust_sondervorauszahlung]);
    expect(mehr.hinweise.map((m) => m.text)).toEqual([TEXT.aus_rechnungen_offen(3), TEXT.aus_rechnungen_gutschriften(1)]);
    expect(mehr.info.map((m) => m.text)).toEqual([TEXT.aus_rechnungen_vorsteuer(9, 0), TEXT.ust_dfv]);
    // OSS/ZM: Frist als Hinweis, Berichtigung als Blocker
    expect(euMeldungen("zm", null).hinweise.map((m) => m.text)).toEqual([TEXT.stb_zm_frist]);
  });

  it("Rechnung: Hinweise auf eine wahrscheinlich falsche steuerliche Behandlung sind Blocker, der Rest Hinweise", () => {
    expect(rechnungHinweisStufe(RECHNUNG_KU_IGL)).toBe("blocker");
    expect(rechnungHinweisStufe(RECHNUNG_LEITWEG)).toBe("blocker");
    expect(rechnungHinweisStufe(RECHNUNG_EU_19("Österreich"))).toBe("blocker");
    expect(rechnungHinweisStufe(RECHNUNG_KU_PROFIL(true))).toBe("blocker");
    expect(rechnungHinweisStufe(RECHNUNG_KU_PROFIL(false))).toBe("blocker");
    expect(rechnungHinweisStufe(RECHNUNG_EINHEIT_CODE(["Rolle"]))).toBe("hinweis");
    expect(rechnungHinweisStufe("irgendein anderer Hinweis")).toBe("hinweis");
  });

  it("Abschluss: Blocker im einen Kasten, Hinweise der Vorlage ruhig zusammengefasst", () => {
    const a = lies("seiten/Abschluss.tsx");
    expect(a).toContain("luecken ? blocker(TEXT.e210_luecken_hinweis(luecken)) : null");
    expect(a).toContain('rechnungHinweisStufe(h) === "blocker" ? blocker(h) : hinweis(h)');
    // fehlt noch etwas, stehen die Blocker im Kasten „Fehlt noch“ – nie zwei Kästen
    expect(a).toContain("(meldungen?.blocker ?? []).map((m) => (");
    expect(a).toContain("<HinweisStapel bereit={fertig} geordnet={meldungen && !fertig ? { ...meldungen, blocker: [] } : meldungen ?? undefined} />");
    // keine Warnung der Vorlage mehr einzeln als Kasten
    expect(a).not.toContain('.map((h) => <Hinweis key={h} art="warnung" text={h} />)');
  });
});

/** Zählung (E-239): sichtbare Eingaben bzw. Bedienelemente vor und nach der Änderung für das typische Kleinunternehmen. */
describe("Messung vorher/nachher (Kleinunternehmen KLEIN)", () => {
  it("Rechnung anlegen: je Schritt sichtbare Felder und Aufklappzeilen", () => {
    const r = relevanz(KLEIN);
    const d: Daten = { ...leereDaten(rechnung, KLEIN.betrieb, "2026-10-29"), kleinunternehmer: true, ...profilStartwerte(rechnung, KLEIN.profil, KLEIN.betrieb), kunde_art: "privat" };
    const fehlt = fehlendeAngaben(rechnung, d, KLEIN.betrieb);
    const zaehlen = (mit: boolean) =>
      rechnung.abschnitte.map((a) => {
        const da = a.felder.filter((f) => sichtbar(f, ohneVerdeckteFelder(a.felder, d)));
        const t = felderAufteilen(da, d, fehlt, null, mit ? nebensacheFuer("rechnung", r, d) : undefined);
        return t.zeigen.length + (t.versteckt.length ? 1 : 0);
      });
    const vorher = zaehlen(false);
    const nachher = zaehlen(true);
    // Empfänger „Privatperson“ im Salon: „Leistung an einem Grundstück“ steht nicht mehr sofort da
    expect(vorher).toEqual([5, 6, 1, 3]);
    expect(nachher).toEqual([5, 5, 1, 3]);
  });

  it("Rechnung abschließen (Handwerk an eine GmbH, „Montage Oktober“, ohne IBAN): vorher 2 Warnkästen, nachher 1 ruhige Zeile", () => {
    const b = { ...KLEIN.betrieb, name: "Tischlerei Holz", iban: "" };
    const p = HANDWERK.profil;
    const d: Daten = { ...leereDaten(rechnung, b, "2026-10-29"), kunde_name: "Muster GmbH", kunde_anschrift: "Industriestr. 1\n80333 München", positionen: [{ bezeichnung: "Montage Oktober", menge: "3", einheit: "Stunde", preis: "100", satz: "19" }] };
    const vorlage = rechnung.hinweise!(d, b, { kleinunternehmer: false, handwerk: handwerkLaut(p) });
    const l = [...(ohneZahlungsweg(d, b.iban) ? ["IBAN"] : []), ...vorlage];
    expect(l.length).toBe(2); // vorher: zwei Warnkästen untereinander
    const g = ordnen(l.map((t) => ({ text: t, stufe: rechnungHinweisStufe(t) })));
    expect([g.blocker.length, g.hinweise.length, immerSichtbar(g)]).toEqual([0, 2, 1]);
  });

  it("Umsatzsteuer-Voranmeldung, Quartal ohne Besonderheiten: vorher 1 Hinweiszeile unter dem Ergebnis, nachher keine (nur „Mehr erfahren“)", () => {
    const g = ustMeldungen(basis2, { kasse: null, dfv: false, dezember: false });
    expect([g.blocker.length + g.hinweise.length + g.info.length, g.blocker.length + g.hinweise.length]).toEqual([1, 0]);
  });

  it("Beleg erfassen, Mein Betrieb (Steuer und Bank, Personen), Zahlung", () => {
    const r = relevanz(KLEIN);
    // Beleg von Hand: Lieferant, Datum, Nummer, Betrag, Satz, „weiterer Satz“, Kategorie, Zahlung, Bezahlt, Notiz = 10 fest
    const fest = 10;
    const b = { steuerschuld: null, skonto_cent: null, vorsteuer: false };
    const belegVorher = fest + 1 /* § 13b */ + 1 /* Skonto */ + 1 /* „Weitere Angaben (1)“ Vorsteuer */;
    const weitere = [true /* Vorsteuer */, !belegSkontoSichtbar(b), !belegSteuerschuldSichtbar(r, b)].filter(Boolean).length;
    const belegNachher = fest + (belegSteuerschuldSichtbar(r, b) ? 1 : 0) + (belegSkontoSichtbar(b) ? 1 : 0) + (weitere ? 1 : 0);
    expect([belegVorher, belegNachher]).toEqual([13, 11]);
    // Steuer und Bank: Steuernummer, USt-IdNr., IBAN, Bank, BIC, Soll/Ist, „Kleinunternehmer bis“
    const versteckt = [!betriebUstIdSichtbar(r, KLEIN.profil, ""), !betriebVersteuerungSichtbar(r, ""), !betriebKuBisSichtbar(KLEIN.profil, "")].filter(Boolean).length;
    expect([7, 7 - versteckt + (versteckt ? 1 : 0)]).toEqual([7, 5]);
    // Personen: Mitarbeiter und Kunden → Kunden und „Weitere Optionen (1)“ (leise)
    expect(mitarbeiterSichtbar(r)).toBe(false);
  });
});
