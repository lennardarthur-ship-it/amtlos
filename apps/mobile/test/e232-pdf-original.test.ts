/**
 * E-232 (Steuerberater 27.10.2026 zu T-328): (c) PDFs über 10 MB bewahrt die App nicht auf – der Nutzer muss das PDF
 * selbst aufbewahren (deutlicher Hinweis beim Teilen und an der Unterlage); (d) der Export „Daten für die Betriebsprüfung“
 * enthält die Original-PDFs der Ausgangsrechnungen (§ 14b UStG, § 147 Abs. 1 Nr. 4 AO), die XRechnung ohnehin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, dokumentHtml, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { druckBetrieb } from "../src/unterlagen/ausgabe";
import { PDF_ORIGINAL_MAX, pdfAusgabe, pdfPruefwert, type PdfAusgabeUmgebung } from "../src/unterlagen/pdfOriginal";
import { PRUEFEXPORT, pruefexport, pruefexportDateien } from "../src/unterlagen/pruefexport";
import { LEERER_STAND, anlegen, ausgeben, betriebSetzen, felderSetzen, geteilteFassungFestschreiben, pdfOriginalSetzen, pdfSelbstVermerken, standAus, teilenOffenVermerken, unterlagenVereinen, type Stand } from "../src/unterlagen/speicher";
import { T as TEXT } from "../src/texte";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const B: Betrieb = { ...LEERER_BETRIEB, name: "Café Morgenrot", strasse: "Alte Gasse 1", plz: "10115", ort: "Berlin", verantwortlich: "Kim Morgen", email: "info@morgenrot.example", steuernummer: "11/111/11111", ust_idnr: "DE111111111", iban: "DE89370400440532013000", bank: "Alte Bank", bundesland: "Berlin" };
const BASIS: Stand = betriebSetzen(LEERER_STAND, B);
const enc = new TextEncoder();
const pdf = (inhalt: string) => enc.encode(`%PDF-1.7\n${inhalt}\n%%EOF`);
/** ein „PDF“ knapp über der Grenze */
const grossesPdf = () => {
  const b = new Uint8Array(PDF_ORIGINAL_MAX + 1000);
  b.set(enc.encode("%PDF-1.7\n"));
  return b;
};
const SRC = (p: string) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src", p), "utf8");

function rechnungEntwurf(s0: Stand, id = "r1"): Stand {
  const [s] = anlegen(s0, "rechnung", t("2026-03-01"), id);
  return felderSetzen(s, id, { nummer: `2026-${id}`, datum: "2026-03-01", kunde_email: "rechnung@nord.example", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafen 1\n20457 Hamburg", positionen: [{ bezeichnung: "Catering", menge: "1", preis: "300", satz: "19" }] }, t("2026-03-01"));
}
function umgebung(erzeugt: Uint8Array | null) {
  const ordner = new Map<string, Uint8Array>();
  let n = 0;
  const e: PdfAusgabeUmgebung = {
    lesen: async (name) => ordner.get(name) ?? null,
    erzeugenUndAusgeben: async () => (erzeugt ? { ok: true, sha256: pdfPruefwert(erzeugt), bytes: erzeugt } : { ok: true }),
    bytesAusgeben: async () => true,
    ablegen: async (b) => {
      const name = `pdf${String(++n).padStart(4, "0")}x.pdf`;
      ordner.set(name, b);
      return name;
    },
    jetzt: () => "2026-03-02T09:00:00.000Z",
  };
  return { e, ordner };
}
async function teilen(s0: Stand, bytes: Uint8Array, id = "r1") {
  const s = rechnungEntwurf(s0, id);
  const u = s.unterlagen.find((x) => x.id === id)!;
  const g = umgebung(bytes);
  const erg = await pdfAusgabe(u, true, g.e);
  const abs = druckBetrieb(s, u, true);
  const html = dokumentHtml(vorlageFuer("rechnung")!, u.daten, abs);
  return { s: ausgeben(s, id, t("2026-03-02"), u.daten, erg.sha256, abs, false, html, erg.neu, erg.zuGross), erg, g };
}

describe("E-232 (T-328 c): PDF über 10 MB – der Nutzer bewahrt es selbst auf", () => {
  it("erste Ausgabe über der Grenze: nichts abgelegt, `zuGross` mit Größe, an der Rechnung vermerkt", async () => {
    const gross = grossesPdf();
    const { s, erg, g } = await teilen(BASIS, gross);
    expect(erg.ok).toBe(true);
    expect(erg.neu).toBeUndefined();
    expect(erg.zuGross).toEqual({ groesse: gross.length, am: "2026-03-02T09:00:00.000Z" });
    expect(g.ordner.size).toBe(0);
    const u = s.unterlagen[0]!;
    expect(u.festgeschrieben).toBeTruthy();
    expect(u.pdf).toBeUndefined();
    expect(u.pdfSha256).toBe(pdfPruefwert(gross));
    expect(u.pdfSelbst).toEqual(erg.zuGross);
    // Laden: bleibt; ohne Festschreibung, mit Original oder mit Größe unter der Grenze fällt der Vermerk weg
    expect(standAus(JSON.stringify(s)).unterlagen[0]!.pdfSelbst).toEqual(erg.zuGross);
    expect(standAus(JSON.stringify({ ...s, unterlagen: [{ ...u, pdfSelbst: { groesse: 1000, am: u.pdfSelbst!.am } }] })).unterlagen[0]!.pdfSelbst).toBeUndefined();
    expect(standAus(JSON.stringify({ ...s, unterlagen: [{ ...u, festgeschrieben: undefined }] })).unterlagen[0]!.pdfSelbst).toBeUndefined();
  });

  it("unter der Grenze und Vorlagen ohne Festschreibung: kein Vermerk", async () => {
    const { erg } = await teilen(BASIS, pdf("klein"));
    expect(erg.zuGross).toBeUndefined();
    expect(erg.neu).toBeTruthy();
    const s = rechnungEntwurf(BASIS);
    expect((await pdfAusgabe(s.unterlagen[0]!, false, umgebung(grossesPdf()).e)).zuGross).toBeUndefined();
  });

  it("zuerst XRechnung (pdfFolgt): das erste PDF ist zu groß → Vermerk statt Original, `pdfFolgt` entfällt", async () => {
    const s0 = rechnungEntwurf(BASIS);
    const u0 = s0.unterlagen[0]!;
    const s = ausgeben(s0, "r1", t("2026-03-02"), u0.daten, undefined, B, true, dokumentHtml(vorlageFuer("rechnung")!, u0.daten, B));
    const u = s.unterlagen[0]!;
    expect(u.pdfFolgt).toBe(true);
    const erg = await pdfAusgabe(u, true, umgebung(grossesPdf()).e);
    expect(erg.nachgereicht).toBeUndefined();
    expect(erg.zuGross).toBeTruthy();
    const s2 = pdfSelbstVermerken(s, "r1", erg.zuGross!);
    expect(s2.unterlagen[0]!.pdfSelbst).toEqual(erg.zuGross);
    expect(s2.unterlagen[0]!.pdfFolgt).toBeUndefined();
    // ein späteres (kleines) PDF wird nicht nachträglich zum Original – das erste ging schon hinaus
    expect(pdfOriginalSetzen(s2, "r1", { datei: "abcd1234.pdf", sha256: "0".repeat(64), groesse: 10, am: "2026-03-03T09:00:00.000Z" })).toBe(s2);
    // erneutes Teilen einer Rechnung mit Original oder Vermerk: kein zweiter Vermerk
    expect((await pdfAusgabe(s2.unterlagen[0]!, true, umgebung(grossesPdf()).e)).zuGross).toBeUndefined();
  });

  it("unbestätigte Android-Ausgabe: Vermerk geht mit „Doch verschickt – festschreiben“ an die Rechnung", async () => {
    const s = rechnungEntwurf(BASIS);
    const u = s.unterlagen[0]!;
    const gross = grossesPdf();
    const sel = { groesse: gross.length, am: "2026-03-02T09:00:00.000Z" };
    const s2 = teilenOffenVermerken(s, "r1", t("2026-03-02"), { daten: u.daten, art: "pdf", pdfSha256: pdfPruefwert(gross), absender: B, pdfSelbst: sel });
    expect(standAus(JSON.stringify(s2)).unterlagen[0]!.geteiltOffen![0]!.pdfSelbst).toEqual(sel);
    const fest = geteilteFassungFestschreiben(s2, "r1", t("2026-03-03")).unterlagen[0]!;
    expect(fest.festgeschrieben).toBeTruthy();
    expect(fest.pdfSelbst).toEqual(sel);
  });

  it("Zusammenführen derselben Fassung: der Vermerk geht nicht verloren, ein Original geht vor", async () => {
    const { s } = await teilen(BASIS, grossesPdf());
    const mit = s.unterlagen[0]!;
    const { pdfSelbst: _p, ...ohne } = mit;
    expect(unterlagenVereinen(mit, ohne).u.pdfSelbst).toEqual(mit.pdfSelbst);
    expect(unterlagenVereinen(ohne, mit).u.pdfSelbst).toEqual(mit.pdfSelbst);
  });

  it("Hinweis beim Teilen (bestätigen) und an der Unterlage", () => {
    const src = SRC("seiten/Abschluss.tsx");
    expect(src).toContain("if (erg.zuGross) await hinweisen(TEXT.e232_pdf_selbst_titel, TEXT.e232_pdf_selbst(erg.zuGross.groesse))");
    expect(src).toContain("z.pdfSelbstVermerken(id, erg.zuGross)");
    expect(src).toContain("TEXT.e232_pdf_selbst_vermerk(");
    expect(TEXT.e232_pdf_selbst(12.4 * 1024 * 1024)).toMatch(/12,4 MB.*selbst aufbewahren/);
    expect(TEXT.e232_pdf_selbst_vermerk("02.03.2026, 10:00", 11 * 1024 * 1024)).toMatch(/NICHT in der App aufbewahrt.*11,0 MB.*selbst auf/);
  });
});

describe("E-232 (T-328 d): Original-PDFs der Ausgangsrechnungen im Export für die Betriebsprüfung", () => {
  it("das aufbewahrte Original byte-genau unter Rechnungen/; ohne Original genannt", async () => {
    const original = pdf("Rechnung 2026-r1 wie geteilt");
    const a = await teilen(BASIS, original, "r1");
    const b = await teilen(a.s, grossesPdf(), "r2");
    const s = b.s;
    const namen = pruefexportDateien(s);
    const datei = s.unterlagen.find((u) => u.id === "r1")!.pdf!.datei;
    expect(namen).toContain(datei);
    const e = pruefexport(s, { [datei]: original }, "2026-10-27T10:00:00.000Z");
    expect(e.pdfAusgehend).toBe(1);
    const zip = unzipSync(e.zip);
    expect([...zip[`${PRUEFEXPORT.pdfAus}2026-r1.pdf`]!]).toEqual([...original]);
    expect(zip[`${PRUEFEXPORT.pdfAus}2026-r2.pdf`]).toBeUndefined();
    const fb = strFromU8(zip[PRUEFEXPORT.feldbeschreibung]!);
    expect(fb).toContain("1 Original-PDF der gestellten Rechnungen");
    expect(fb).toContain("2026-r2 (PDF über 10 MB, vom Betrieb selbst aufbewahrt)");
    expect(e.fehlend).toEqual([]);
  });

  it("Datei fehlt oder passt nicht zum Prüfwert: nicht im Export, als fehlend genannt (nichts neu erzeugt)", async () => {
    const { s } = await teilen(BASIS, pdf("echt"));
    const datei = s.unterlagen[0]!.pdf!.datei;
    for (const dateien of [{}, { [datei]: pdf("verändert") }]) {
      const e = pruefexport(s, dateien, "2026-10-27T10:00:00.000Z");
      expect(e.pdfAusgehend).toBe(0);
      expect(e.inhalt.some((n) => n.startsWith(PRUEFEXPORT.pdfAus))).toBe(false);
      expect(e.fehlend).toContain(datei);
      expect(strFromU8(unzipSync(e.zip)[PRUEFEXPORT.feldbeschreibung]!)).toContain("2026-r1 (Original-PDF auf dem Gerät nicht lesbar)");
    }
  });
});
