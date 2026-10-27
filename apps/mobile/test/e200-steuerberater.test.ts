/**
 * E-200: Antwort des Steuerberaters vom 26.10.2026 – Daten für die Betriebsprüfung ohne Abo (§ 147 Abs. 6 AO), Hinweis bei
 * Kündigung bzw. Ende von Pro, Löschen erst nach dem Export, Android-Teilen (Verlauf jeder geteilten Fassung, Wahl der
 * Fassung, Nummer eines gelöschten Entwurfs nie neu), Beitragsnachweis am Vortag, Fundstelle § 125 HGB.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Daten, KassenInhalt } from "@amtlos/fachlogik";
import { aboHinweis } from "../src/pro/aboEnde";
import { auswertung, type Profil } from "../src/pflichten/check";
import { erinnerungen, erinnerungsText } from "../src/pflichten/erinnerungsplan";
import { T as TEXT } from "../src/texte";
import { PRUEFEXPORT, pruefexport, pruefexportDateien } from "../src/unterlagen/pruefexport";
import {
  LEERER_STAND,
  allesLoeschenErlaubt,
  anlegen,
  ausgeben,
  belegSetzen,
  felderSetzen,
  geteilteFassungFestschreiben,
  geteilteVersionen,
  kasseSpeichern,
  kopieren,
  leererBeleg,
  loeschen,
  pruefexportAktuell,
  standAus,
  stornieren,
  teilenOffenVermerken,
  unterlagenVereinen,
  vergebeneNummern,
  type Stand,
} from "../src/unterlagen/speicher";
import { BELEG_SPALTEN, KASSEN_SPALTEN, PROTOKOLL_SPALTEN, aenderungsprotokoll, rechnungsSpalten } from "../src/unterlagen/steuerpaket";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const quelle = (datei: string) => readFileSync(path.resolve(HIER, "..", datei), "utf8");
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Holzbau Nord GmbH", rechtsform: "GmbH", registergericht: "Amtsgericht Hamburg", registernummer: "HRB 123456", vertretung: "Jana Holm", strasse: "Werftweg 2", plz: "20457", ort: "Hamburg", email: "info@holzbau.example", telefon: "040 1", steuernummer: "41/724/03619", ust_idnr: "DE123456789", iban: "DE89370400440532013000" };
const KUNDE = { kunde_name: "Elbstudio GmbH", kunde_anschrift: "Hafenstraße 3\n20457 Hamburg", kunde_email: "re@elbstudio.example" };
const pos = (preis: string) => [{ bezeichnung: "Umbau Ladenlokal", menge: "1", einheit: "Pauschale", preis, satz: "19" }];
const tag = (datum: string, o: Partial<KassenInhalt> = {}): KassenInhalt => ({ datum, zbon: null, umsatz: [{ satz: 19, brutto_cent: 11900 }], karte_cent: 5000, sonstige_cent: 0, bewegungen: [], ...o });

function rechnung(s: Stand, id: string, datum: string, daten: Daten = {}): Stand {
  const [s1] = anlegen(s, "rechnung", t(datum), id);
  return ausgeben(felderSetzen(s1, id, { datum, leistung_gleich: true, zahlungsziel: "14", ...KUNDE, positionen: pos("1.000,00"), ...daten }, t(datum)), id, t(datum));
}

/** Betrieb mit zwei Rechnungen, drei Belegen (Foto, PDF, empfangene E-Rechnung) und einem Kassenabschluss mit Z-Bon-Foto */
function betrieb(): { s: Stand; dateien: Record<string, Uint8Array> } {
  let s: Stand = { ...LEERER_STAND, betrieb: BETRIEB };
  s = rechnung(s, "r1", "2026-09-01");
  s = rechnung(s, "r2", "2026-10-01");
  const dateien: Record<string, Uint8Array> = {};
  for (const [i, datei] of ["foto.jpg", "rechnung.pdf", "erechnung.xml"].entries()) {
    const b = { ...leererBeleg("foto", datei, false, t("2026-10-0" + (i + 2))), id: `b${i}`, lieferant: `Lieferant ${i}`, steuer: [{ satz: 19, brutto_cent: 11900 }] };
    s = belegSetzen(s, b, t("2026-10-0" + (i + 2)));
    dateien[datei] = new Uint8Array([i, 1, 2, 3]);
  }
  [s] = kasseSpeichern(s, tag("2026-10-05", { zbon: "17" }), t("2026-10-05", 20), "k1");
  s = { ...s, kasse: s.kasse.map((k) => ({ ...k, datei: "zbon.jpg" })) };
  dateien["zbon.jpg"] = new Uint8Array([9, 9]);
  return { s, dateien };
}

describe("5: Daten für die Betriebsprüfung – kostenlos, genau die verlangten Inhalte", () => {
  const { s, dateien } = betrieb();
  const e = pruefexport(s, dateien, "2026-10-26T10:00:00.000Z");
  const zip = unzipSync(e.zip);

  it("ZIP: Listen (CSV), Änderungsprotokoll, E-Rechnungen ein- und ausgehend, Originalbelege, Feldbeschreibung – kein DATEV, keine Sicherung, keine neu erzeugten Rechnungs-PDFs (E-232: aufbewahrte Originale ja, siehe e232-pdf-original)", () => {
    const namen = Object.keys(zip).sort();
    expect(namen).toEqual(e.inhalt);
    for (const n of [PRUEFEXPORT.rechnungen, PRUEFEXPORT.belege, PRUEFEXPORT.kasse, PRUEFEXPORT.protokoll, PRUEFEXPORT.feldbeschreibung]) expect(namen, n).toContain(n);
    expect(namen.filter((n) => n.startsWith(PRUEFEXPORT.xmlAus))).toHaveLength(2);
    expect(namen.filter((n) => n.startsWith(PRUEFEXPORT.xmlEin))).toEqual([expect.stringMatching(/^E-Rechnungen\/eingehend\/B2026-\d+_.*\.xml$/)]);
    expect(namen.filter((n) => n.startsWith(PRUEFEXPORT.belegDateien))).toHaveLength(2);
    expect(namen.filter((n) => n.startsWith(PRUEFEXPORT.kasseDateien))).toEqual(["Kasse/2026-10-05_Z17.jpg"]);
    // nur diese Arten – kein DATEV-Buchungsstapel (Pro), keine eigene Sicherung, keine Rechnungs-PDFs (hier ohne aufbewahrtes Original)
    for (const n of namen) expect(n).toMatch(/^(Rechnungen|Belege|Kassenabschluesse|Aenderungsprotokoll)\.csv$|^Feldbeschreibung\.txt$|^E-Rechnungen\/(aus|ein)gehend\/|^Belege\/|^Kasse\//);
    expect(namen.join(" ")).not.toMatch(/EXTF|Buchungsstapel|stand\.json|\.amtlos|Rechnungen\/.*\.pdf/);
    expect(e).toMatchObject({ rechnungen: 2, belege: 3, kasse: 1, xmlAusgehend: 2, xmlEingehend: 1, originale: 3, fehlend: [] });
    // Originale unverändert
    expect([...zip[namen.find((n) => n.startsWith(PRUEFEXPORT.xmlEin))!]!]).toEqual([2, 1, 2, 3]);
  });

  it("Feldbeschreibung aus denselben Spaltendefinitionen wie die Kopfzeilen: jede Spalte jeder CSV-Datei ist beschrieben", () => {
    const fb = strFromU8(zip[PRUEFEXPORT.feldbeschreibung]!);
    expect(fb).toMatch(/UTF-8 mit BOM, Trennzeichen Semikolon/);
    for (const datei of Object.keys(zip).filter((n) => n.endsWith(".csv"))) {
      const kopf = strFromU8(zip[datei]!).replace(/^\uFEFF/, "").split("\r\n")[0]!.split(";");
      const abschnitt = fb.split(`\r\n${datei}\r\n`)[1];
      expect(abschnitt, datei).toBeDefined();
      kopf.forEach((sp, i) => expect(abschnitt, `${datei}: ${sp}`).toContain(`${String(i + 1).padStart(2, " ")}. ${sp.replace(/^"|"$/g, "")}: `));
    }
    // die Kopfzeilen kommen aus den Definitionen (auch im Paket für die Steuerberatung)
    expect(strFromU8(zip[PRUEFEXPORT.belege]!).replace(/^\uFEFF/, "").split("\r\n")[0]).toBe(BELEG_SPALTEN.map((x) => x.name).join(";"));
    expect(strFromU8(zip[PRUEFEXPORT.kasse]!).replace(/^\uFEFF/, "").split("\r\n")[0]).toBe(KASSEN_SPALTEN.map((x) => x.name).join(";"));
    expect(strFromU8(zip[PRUEFEXPORT.protokoll]!).replace(/^\uFEFF/, "").split("\r\n")[0]).toBe(PROTOKOLL_SPALTEN.map((x) => x.name).join(";"));
    expect(rechnungsSpalten({ gutschriften: false, bis: "2026-12-31", datei: true }).map((x) => x.name)).toContain("Datei");
    for (const sp of [...BELEG_SPALTEN, ...KASSEN_SPALTEN, ...PROTOKOLL_SPALTEN]) expect(sp.beschreibung.length, sp.name).toBeGreaterThan(5);
  });

  it("Belegliste nennt den Pfad der Originaldatei im Export; das Änderungsprotokoll fehlt nie (auch nur mit Kopfzeile)", () => {
    const belege = strFromU8(zip[PRUEFEXPORT.belege]!);
    for (const n of Object.keys(zip).filter((x) => x.startsWith("Belege/") || x.startsWith(PRUEFEXPORT.xmlEin))) expect(belege).toContain(n);
    const leer = pruefexport({ ...LEERER_STAND, betrieb: BETRIEB }, {}, "2026-10-26T10:00:00.000Z");
    expect(leer.inhalt).toEqual([PRUEFEXPORT.protokoll, PRUEFEXPORT.belege, PRUEFEXPORT.feldbeschreibung, PRUEFEXPORT.rechnungen].sort());
  });

  it("fehlende Originaldateien werden gemeldet, der Export entsteht trotzdem", () => {
    const ohne = pruefexport(s, { "foto.jpg": dateien["foto.jpg"]! }, "2026-10-26T10:00:00.000Z");
    expect(ohne.fehlend.sort()).toEqual(["erechnung.xml", "rechnung.pdf", "zbon.jpg"]);
    expect(strFromU8(unzipSync(ohne.zip)[PRUEFEXPORT.feldbeschreibung]!)).toMatch(/3 Originaldateien ließen sich/);
    expect(pruefexportDateien(s).sort()).toEqual(["erechnung.xml", "foto.jpg", "rechnung.pdf", "zbon.jpg"]);
  });

  it("App: frei ohne Pro (keine Sperre), unter „Mein Betrieb“ und im Hinweis zum Abo-Ende; Texte nennen, was frei bleibt", () => {
    const seite = quelle("src/seiten/Pruefexport.tsx");
    expect(seite).not.toMatch(/useProSperre|sperre\(|z\.pro\b/);
    expect(quelle("src/seiten/Betrieb.tsx")).toContain("TEXT.e200_pruef_zeile");
    expect(quelle("src/seiten/AboEnde.tsx")).toContain("<PruefexportSeite />");
    expect(TEXT.pro_frei_bleibt).toMatch(/Betriebsprüfung[\s\S]*Listen, Änderungsprotokoll, E-Rechnungen, Originalbelegen und Feldbeschreibung/);
    expect(TEXT.pro_frei_bleibt).toContain("Aufzeichnungs- und Aufbewahrungspflichten laufen weiter");
    expect(TEXT.pro_grund.steuerberater(0)).toMatch(/Daten für die Betriebsprüfung/);
  });
});

describe("6: Hinweis bei Kündigung bzw. Ende von Pro", () => {
  it("gekündigt (verlängert sich nicht): Hinweis mit Enddatum; weggetippt je Anlass", () => {
    const abo = { aktiv: true, verlaengert: false, endetAm: "2026-11-30T10:00:00Z" };
    const h = aboHinweis({ pro: true, proBekannt: true, abo });
    expect(h).toEqual({ art: "gekuendigt", endetAm: abo.endetAm, schluessel: `gekuendigt:${abo.endetAm}` });
    expect(aboHinweis({ pro: true, proBekannt: true, abo, gesehen: h!.schluessel })).toBeNull();
    expect(aboHinweis({ pro: true, proBekannt: true, abo: { ...abo, verlaengert: true } })).toBeNull();
  });
  it("beendet: nur, wenn Pro auf diesem Gerät schon aktiv war und der Store geantwortet hat", () => {
    expect(aboHinweis({ pro: false, proBekannt: true, abo: null, proZuletzt: "2026-10-20" })).toEqual({ art: "beendet", schluessel: "beendet:2026-10-20" });
    expect(aboHinweis({ pro: false, proBekannt: false, abo: null, proZuletzt: "2026-10-20" })).toBeNull();
    expect(aboHinweis({ pro: false, proBekannt: true, abo: null })).toBeNull();
    expect(aboHinweis({ pro: false, proBekannt: true, abo: null, proZuletzt: "2026-10-20", gesehen: "beendet:2026-10-20" })).toBeNull();
  });
  it("Wortlaut neutral: Aufzeichnungs- und Aufbewahrungspflichten laufen weiter (Rechnungen, Belege, Kasse) und der Weg zum Export", () => {
    for (const x of [TEXT.e200_abo_gekuendigt("30.11.2026"), TEXT.e200_abo_gekuendigt(null), TEXT.e200_abo_beendet]) {
      expect(x).toContain("Aufzeichnungs- und Aufbewahrungspflichten laufen weiter – für Rechnungen, Belege und Kasse");
      expect(x).toContain("Daten für Betriebsprüfung exportieren");
      expect(x).not.toMatch(/Bußgeld|strafbar|musst du|haftest/);
    }
    expect(TEXT.e200_abo_gekuendigt("30.11.2026")).toContain("endet am 30.11.2026");
    // Stand: zuletzt mit Pro gesehen und weggetippt – gerätegebunden, übersteht Speichern
    const s = standAus(JSON.stringify({ ...LEERER_STAND, proZuletzt: "2026-10-20", aboHinweisGesehen: "beendet:2026-10-20" }));
    expect([s.proZuletzt, s.aboHinweisGesehen]).toEqual(["2026-10-20", "beendet:2026-10-20"]);
    expect(quelle("src/seiten/Heute.tsx")).toContain("<AboEndeHinweis />");
    expect(quelle("src/zustand.tsx")).toContain("aboStand()");
  });
});

describe("7: „Alle Daten löschen“ erst nach dem bestätigten Export", () => {
  it("aufbewahrungspflichtige Daten: weder ohne noch nach veraltetem Export; die Sicherung allein genügt nicht", () => {
    const { s } = betrieb();
    const gesichert = { ...s, geaendert: "2026-10-26T09:00:00.000Z", letzteSicherung: "2026-10-26T10:00:00.000Z" };
    expect(allesLoeschenErlaubt(gesichert)).toBe(false);
    const exportiert = { ...gesichert, pruefexport: "2026-10-26T10:00:00.000Z" };
    expect(pruefexportAktuell(exportiert)).toBe(true);
    expect(allesLoeschenErlaubt(exportiert)).toBe(true);
    expect(allesLoeschenErlaubt({ ...exportiert, geaendert: "2026-10-26T11:00:00.000Z" })).toBe(false);
    // ohne aufbewahrungspflichtige Daten wie bisher
    expect(allesLoeschenErlaubt({ ...LEERER_STAND, betrieb: BETRIEB })).toBe(true);
    expect(standAus(JSON.stringify(exportiert)).pruefexport).toBe("2026-10-26T10:00:00.000Z");
  });
  it("App: Warnung zur Aufbewahrung, zuerst der Export, Bestätigung „gespeichert“; Texte", () => {
    const b = quelle("src/seiten/Betrieb.tsx");
    expect(b).toContain("TEXT.r12p_loeschen_gesperrt(");
    expect(b).toContain("TEXT.e200_loeschen_export");
    expect(quelle("src/seiten/Pruefexport.tsx")).toContain("z.pruefexportBestaetigen()");
    expect(TEXT.r12p_loeschen_gesperrt(3, 8)).toMatch(/Exportiere zuerst die Daten für die Betriebsprüfung/);
    // keine Massenlöschung von Rechnungen oder Belegen in der App (nur einzeln bzw. „Alle Daten löschen“)
    for (const d of readdirSync(path.resolve(HIER, "../src/seiten"))) if (statSync(path.resolve(HIER, "../src/seiten", d)).isFile()) expect(quelle(`src/seiten/${d}`), d).not.toMatch(/\.forEach\(\(?\w+\)? => z\.(loeschen|belegLoeschen)\(/);
  });
});

describe("8: Android – jede geteilte Fassung im Verlauf, Wahl der Fassung, Nummer eines gelöschten Entwurfs nie neu", () => {
  function entwurf(): Stand {
    const [s1] = anlegen({ ...LEERER_STAND, betrieb: BETRIEB }, "rechnung", t("2026-10-12"), "r1");
    return felderSetzen(s1, "r1", { datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", ...KUNDE, positionen: pos("1.000,00") }, t("2026-10-12"));
  }
  const teilen = (s: Stand, d: string, art: "pdf" | "druck" | "xml" = "pdf") => teilenOffenVermerken(s, "r1", t(d), { art, daten: s.unterlagen.find((u) => u.id === "r1")!.daten, absender: BETRIEB });

  it("(a) jede Ausgabe mit Zeitpunkt und Prüfwert, nie gekürzt – auch nicht nach 25 Ausgaben, beim Speichern, Zusammenführen und Festschreiben", () => {
    let s = entwurf();
    for (let i = 0; i < 25; i++) s = teilenOffenVermerken(s, "r1", t(`2026-10-${String(12 + (i % 15)).padStart(2, "0")}`, 6 + Math.floor(i / 15)), { art: i % 2 ? "druck" : "pdf", daten: s.unterlagen[0]!.daten, absender: BETRIEB });
    const u = s.unterlagen[0]!;
    expect(u.geteiltOffen).toHaveLength(25);
    for (const g of u.geteiltOffen!) expect(g.inhaltSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(standAus(JSON.stringify(s)).unterlagen[0]!.geteiltOffen).toHaveLength(25);
    const anders = teilen(entwurf(), "2026-11-01");
    expect(unterlagenVereinen(u, anders.unterlagen[0]!).u.geteiltOffen!.length).toBe(26);
    // festgeschrieben: der Verlauf bleibt unverändert stehen
    const fest = geteilteFassungFestschreiben(s, "r1", t("2026-10-30"));
    expect(fest.unterlagen[0]!.festgeschrieben).toBeTruthy();
    expect(fest.unterlagen[0]!.geteiltOffen).toEqual(u.geteiltOffen);
  });

  it("(b) mehrere verschiedene Fassungen: Liste nach Prüfwert, festgeschrieben wird die gewählte – nicht automatisch die letzte", () => {
    let s = teilen(entwurf(), "2026-10-12");
    const erste = s.unterlagen[0]!.daten;
    s = teilen(s, "2026-10-13", "druck");
    s = felderSetzen(s, "r1", { positionen: pos("1.200,00") }, t("2026-10-14"));
    s = teilen(s, "2026-10-14");
    const v = geteilteVersionen(s.unterlagen[0]!);
    expect(v).toHaveLength(2);
    expect(v[0]!.ausgaben.map((a) => a.art)).toEqual(["pdf", "druck"]);
    expect(v[0]!.sha256).not.toBe(v[1]!.sha256);
    const fest = geteilteFassungFestschreiben(s, "r1", t("2026-10-15"), v[0]!.am);
    expect(fest.unterlagen[0]!.daten).toEqual(erste);
    expect(fest.unterlagen[0]!.ausgegeben).toBe("2026-10-12T09:00:00.000Z");
    // ohne Wahl wie bisher die zuletzt geteilte
    expect(geteilteFassungFestschreiben(s, "r1", t("2026-10-15")).unterlagen[0]!.daten.positionen).toEqual(pos("1.200,00"));
    const a = quelle("src/seiten/Abschluss.tsx");
    expect(a).toContain("z.geteiltFestschreiben(id, ver.am)");
    expect(a).toContain("TEXT.e200_fassungen_titel(versionen.length)");
  });

  it("(c) geteilter Entwurf: Löschen nur mit Grund und Protokoll; die Nummer wird nie neu vergeben – Anlegen, Kopie und Storno nehmen die nächste", () => {
    let s = rechnung({ ...LEERER_STAND, betrieb: BETRIEB }, "r0", "2026-10-01");
    expect(s.unterlagen[0]!.daten.nummer).toBe("2026-001");
    const [s1] = anlegen(s, "rechnung", t("2026-10-12"), "r1");
    s = felderSetzen(s1, "r1", { datum: "2026-10-12", leistung_gleich: true, zahlungsziel: "14", ...KUNDE, positionen: pos("1.000,00") }, t("2026-10-12"));
    expect(s.unterlagen.find((u) => u.id === "r1")!.daten.nummer).toBe("2026-002");
    s = teilen(s, "2026-10-12");
    expect(loeschen(s, "r1", t("2026-10-13"))).toBe(s);
    s = loeschen(s, "r1", t("2026-10-13"), "Nach dem Teilen nicht verschickt");
    expect(s.unterlagen.map((u) => u.id)).toEqual(["r0"]);
    const p = s.protokoll.at(-1)!;
    expect(p).toMatchObject({ art: "entwurf_geloescht", nr: "2026-002", vorlage: "rechnung", bezug: "r1" });
    expect(p.geteilt).toEqual([{ am: "2026-10-12T09:00:00.000Z", art: "pdf", sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }]);
    expect(p.text).toContain("Grund: Nach dem Teilen nicht verschickt");
    expect(standAus(JSON.stringify(s)).protokoll.at(-1)).toEqual(p);
    expect(vergebeneNummern(s, "rechnung", "nummer")).toContain("2026-002");
    // die nächste Unterlage bekommt die nächste Nummer – nie 2026-002
    expect(anlegen(s, "rechnung", t("2026-10-14"), "r2")[1].daten.nummer).toBe("2026-003");
    expect(kopieren(s, "r0", t("2026-10-14"), "r3")[1]!.daten.nummer).toBe("2026-003");
    expect(stornieren(s, "r0", t("2026-10-14"), "r4")[1]!.daten.nummer).toBe("2026-003");
    // die Lücke steht im Änderungsprotokoll (Paket und Export für die Betriebsprüfung)
    const zeile = aenderungsprotokoll(s, { von: "2026-01-01", bis: "2026-12-31", name: "2026" }).find((z) => z[2] === "2026-002")!;
    expect(zeile.slice(1, 4)).toEqual(["Rechnung", "2026-002", "Entwurf nach dem Teilen gelöscht (Nummer bleibt vergeben)"]);
    // ein nie geteilter Entwurf lässt sich wie bisher ohne Grund löschen (nichts ging hinaus)
    const [s5] = anlegen(s, "rechnung", t("2026-10-15"), "r5");
    expect(loeschen(s5, "r5").unterlagen.some((u) => u.id === "r5")).toBe(false);
  });

  it("(c) eine geteilte Fassung mit anderer Nummer zählt ebenfalls für die Nummernfolge", () => {
    let s = entwurf();
    s = felderSetzen(s, "r1", { nummer: "2026-040" }, t("2026-10-12"));
    s = teilen(s, "2026-10-12");
    s = felderSetzen(s, "r1", { nummer: "2026-002" }, t("2026-10-13"));
    expect(anlegen(s, "rechnung", t("2026-10-14"), "r9")[1].daten.nummer).toBe("2026-041");
  });
});

describe("9: Beitragsnachweis – spätestens am Vortag übermitteln", () => {
  const salon: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "kasse.elektronisch": true, "online.website": false, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", gruendungsdatum: "2024-03-01" };
  it("Termine = Tabellendatum − 1 Tag; nur beim Beitragsnachweis, nicht bei der Beitragsfälligkeit", () => {
    const a = auswertung(salon, "2026-10-27");
    const bn = a.gilt.find((p) => p.id === "personal.beitragsnachweis")!;
    expect(bn.termine.slice(0, 3)).toEqual(["2026-11-23", "2026-12-21", "2027-01-24"]);
    expect(bn.uebermittelnVortag).toBe(true);
    const sv = a.gilt.find((p) => p.id === "personal.sv_beitraege")!;
    expect(sv.termine.slice(0, 2)).toEqual(["2026-10-28", "2026-11-26"]);
    expect(sv.uebermittelnVortag).toBeUndefined();
  });
  it("Erinnerung und Anzeige: „Spätestens am … übermitteln“", () => {
    const a = auswertung(salon, "2026-11-19");
    const e = erinnerungen(a, { erledigt: {}, unterlagen: [], betrieb: { ...LEERER_STAND.betrieb } }, "2026-11-19").filter((x) => x.pflichtId === "personal.beitragsnachweis");
    expect(e.length).toBeGreaterThan(0);
    expect(e.every((x) => x.uebermitteln)).toBe(true);
    const vorher = e.find((x) => x.art === "vorher")!;
    expect(erinnerungsText(vorher)).toBe(`Spätestens am ${vorher.termin.split("-").reverse().join(".")} übermitteln`);
    expect(erinnerungsText({ ...vorher, am: vorher.termin, art: "heute" })).toBe(TEXT.e200_heute_uebermitteln);
    expect(TEXT.e200_uebermitteln_hinweis("21.12.2026", "22.12.2026")).toBe("Spätestens am 21.12.2026 übermitteln: Der Nachweis muss am 22.12.2026 um 0 Uhr bei der Krankenkasse vorliegen.");
    expect(quelle("src/seiten/Pflichten.tsx")).toContain("TEXT.e200_uebermitteln_hinweis(");
  });
});

describe("1/2: Fundstelle § 125 HGB, Bezeichnung „Geschäftsführer der Komplementärin“", () => {
  it("kein „§ 125a“ mehr in App und Fachlogik (Code, Texte, Kommentare)", () => {
    const treffer: string[] = [];
    const durch = (ordner: string) => {
      for (const n of readdirSync(ordner)) {
        const p = path.join(ordner, n);
        if (statSync(p).isDirectory()) durch(p);
        else if (/\.(ts|tsx)$/.test(n) && !n.endsWith(".json") && n !== "pruefstaende.ts" && n !== "geprueft-teilsummen.ts" && /§§? ?125a/.test(readFileSync(p, "utf8"))) treffer.push(p);
      }
    };
    durch(path.resolve(HIER, "../src"));
    durch(path.resolve(HIER, "../../../packages/fachlogik/src"));
    expect(treffer).toEqual([]);
    expect(TEXT.b_komplementaer_text).toContain("§§ 125, 177a HGB");
  });
});
