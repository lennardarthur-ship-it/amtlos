/**
 * E-228 (Steuerberater zu T-300): Das zuerst geteilte bzw. gedruckte PDF einer festgeschriebenen Unterlage wird selbst
 * aufbewahrt (Bytes, verschlüsselt im Belegordner) und bei erneutem Teilen, im offenen Archiv, im Steuerberater-Paket,
 * in Synchronisation und Sicherung weitergegeben. Vor E-228 festgeschriebene Unterlagen: geteiltes PDF einlesen, mit dem
 * gespeicherten Prüfwert vergleichen, nur bei Übereinstimmung als Original aufbewahren.
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { LEERER_BETRIEB, dokumentHtml, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { huelleErstellen, huelleOeffnen, syncZusammenfuehren, synchronisieren, zufallsSchluessel, SyncFehler, type SyncUmgebung, type TresorApi } from "../src/konto/sync";
import { druckBetrieb } from "../src/unterlagen/ausgabe";
import { offenesArchiv } from "../src/unterlagen/archiv";
import { PDF_ORIGINAL_MAX, ausgabePdf, pdfAusgabe, pdfEinlesen, pdfOriginalFuer, pdfPruefwert, pdfVergleichen, type PdfAusgabeUmgebung } from "../src/unterlagen/pdfOriginal";
import { schluesselAusPasswort } from "../src/unterlagen/sicherung";
import { containerOeffnen, containerSchreiben, type Leser } from "../src/unterlagen/sicherungContainer";
import { LEERER_STAND, anlegen, ausgeben, betriebSetzen, dateienImStand, felderSetzen, geteilteFassungFestschreiben, kassenbuchFestschreiben, korrigieren, pdfDateienImStand, pdfOriginalSetzen, standAus, teilenOffenVermerken, unterlagenVereinen, type Stand } from "../src/unterlagen/speicher";

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const B: Betrieb = { ...LEERER_BETRIEB, name: "Café Morgenrot", strasse: "Alte Gasse 1", plz: "10115", ort: "Berlin", verantwortlich: "Kim Morgen", email: "info@morgenrot.example", steuernummer: "11/111/11111", ust_idnr: "DE111111111", iban: "DE89370400440532013000", bank: "Alte Bank", bundesland: "Berlin" };
const BASIS: Stand = betriebSetzen(LEERER_STAND, B);
const enc = new TextEncoder();
/** ein „PDF“ (beginnt mit %PDF-) – Inhalt unterscheidbar */
const pdf = (inhalt: string) => enc.encode(`%PDF-1.7\n${inhalt}\n%%EOF`);
const SRC = (p: string) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src", p), "utf8");

function rechnungEntwurf(s0: Stand, id = "r1"): Stand {
  const [s] = anlegen(s0, "rechnung", t("2026-03-01"), id);
  return felderSetzen(s, id, { nummer: `2026-${id}`, datum: "2026-03-01", kunde_email: "rechnung@nord.example", kunde_name: "Agentur Nord GmbH", kunde_anschrift: "Hafen 1\n20457 Hamburg", positionen: [{ bezeichnung: "Catering", menge: "1", preis: "300", satz: "19" }] }, t("2026-03-01"));
}

/** Gerät im Test: Belegordner als Map, Teilen-Menü zählt mit */
function umgebung(erzeugt: Uint8Array | null) {
  const ordner = new Map<string, Uint8Array>();
  const log = { erzeugt: 0, bytesAusgegeben: [] as Uint8Array[] };
  let n = 0;
  const e: PdfAusgabeUmgebung = {
    lesen: async (name) => ordner.get(name) ?? null,
    erzeugenUndAusgeben: async () => {
      log.erzeugt++;
      return erzeugt ? { ok: true, sha256: pdfPruefwert(erzeugt), bytes: erzeugt } : { ok: true };
    },
    bytesAusgeben: async (b) => {
      log.bytesAusgegeben.push(b);
      return true;
    },
    ablegen: async (b) => {
      const name = `pdf${String(++n).padStart(4, "0")}x.pdf`;
      ordner.set(name, b);
      return name;
    },
    jetzt: () => "2026-03-02T09:00:00.000Z",
  };
  return { e, ordner, log };
}

/** Erste Ausgabe wie in Abschluss.tsx: erzeugen, teilen, ablegen, festschreiben mit Prüfwert, HTML und PDF */
async function rechnungTeilen(s0: Stand, bytes: Uint8Array, id = "r1") {
  const s = rechnungEntwurf(s0, id);
  const u = s.unterlagen.find((x) => x.id === id)!;
  const g = umgebung(bytes);
  const erg = await pdfAusgabe(u, true, g.e);
  const abs = druckBetrieb(s, u, true);
  const html = dokumentHtml(vorlageFuer("rechnung")!, u.daten, abs);
  return { s: ausgeben(s, id, t("2026-03-02"), u.daten, erg.sha256, abs, false, html, erg.neu), erg, g };
}

describe("E-228: erstes PDF wird aufbewahrt, erneutes Teilen gibt genau diese Bytes weiter", () => {
  it("erste Ausgabe: PDF-Bytes abgelegt, an der festgeschriebenen Rechnung mit Prüfwert und Größe", async () => {
    const original = pdf("Rechnung 2026-r1, gedruckt mit Druckdienst v1");
    const { s, erg, g } = await rechnungTeilen(BASIS, original);
    expect(erg.ok).toBe(true);
    expect(erg.neu).toBeTruthy();
    const u = s.unterlagen[0]!;
    expect(u.festgeschrieben).toBeTruthy();
    expect(u.pdf).toEqual({ datei: erg.neu!.datei, sha256: pdfPruefwert(original), groesse: original.length, am: "2026-03-02T09:00:00.000Z" });
    expect(u.pdfSha256).toBe(pdfPruefwert(original));
    expect([...g.ordner.get(u.pdf!.datei)!]).toEqual([...original]);
  });

  it("erneutes Teilen/Drucken: das gespeicherte PDF unverändert, nichts neu erzeugt – auch wenn der Druckdienst heute anders setzt", async () => {
    const original = pdf("v1");
    const { s, g } = await rechnungTeilen(BASIS, original);
    const u = s.unterlagen[0]!;
    const heute = umgebung(pdf("v2 – anderer Druckdienst"));
    heute.ordner.set(u.pdf!.datei, g.ordner.get(u.pdf!.datei)!);
    const r = await pdfAusgabe(u, true, heute.e);
    expect(r).toMatchObject({ ok: true, original: true, originalFehlt: false, sha256: u.pdfSha256 });
    expect(heute.log.erzeugt).toBe(0);
    expect(heute.log.bytesAusgegeben).toHaveLength(1);
    expect(pdfPruefwert(heute.log.bytesAusgegeben[0]!)).toBe(u.pdfSha256);
    expect(r.neu).toBeUndefined();
    expect(r.nachgereicht).toBeUndefined();
  });

  it("Original fehlt auf diesem Gerät (noch nicht synchronisiert) oder ist beschädigt: neu erzeugt, mit Hinweis – nie als Original", async () => {
    const { s } = await rechnungTeilen(BASIS, pdf("v1"));
    const u = s.unterlagen[0]!;
    const leer = umgebung(pdf("v2"));
    const r = await pdfAusgabe(u, true, leer.e);
    expect(r).toMatchObject({ ok: true, original: false, originalFehlt: true });
    expect(leer.log.erzeugt).toBe(1);
    expect(r.nachgereicht).toBeUndefined();
    // vertauschte/beschädigte Datei: Prüfwert passt nicht
    const kaputt = umgebung(pdf("v2"));
    kaputt.ordner.set(u.pdf!.datei, pdf("etwas anderes"));
    expect(await pdfAusgabe(u, true, kaputt.e)).toMatchObject({ original: false, originalFehlt: true });
  });

  it("abgebrochen: nichts abgelegt; Web (ohne Bytes): wie bisher ohne Original; zu groß: nicht aufbewahrt", async () => {
    const s = rechnungEntwurf(BASIS);
    const u = s.unterlagen[0]!;
    const ab = umgebung(pdf("x"));
    ab.e.erzeugenUndAusgeben = async () => ({ ok: false });
    expect(await pdfAusgabe(u, true, ab.e)).toMatchObject({ ok: false });
    expect(ab.ordner.size).toBe(0);
    const web = umgebung(null);
    expect((await pdfAusgabe(u, true, web.e)).neu).toBeUndefined();
    const gross = new Uint8Array(PDF_ORIGINAL_MAX + 1);
    gross.set(pdf("x"));
    const g = umgebung(gross);
    expect((await pdfAusgabe(u, true, g.e)).neu).toBeUndefined();
    expect(g.ordner.size).toBe(0);
  });

  it("ausgeben übernimmt das PDF nur, wenn es zum Prüfwert der Ausgabe passt", () => {
    const s = rechnungEntwurf(BASIS);
    const u = s.unterlagen[0]!;
    const o = pdfOriginalFuer("abcd1234.pdf", pdf("a"), "2026-03-02T09:00:00.000Z");
    expect(ausgeben(s, "r1", t("2026-03-02"), u.daten, "f".repeat(64), B, false, undefined, o).unterlagen[0]!.pdf).toBeUndefined();
    expect(ausgeben(s, "r1", t("2026-03-02"), u.daten, o.sha256, B, false, undefined, o).unterlagen[0]!.pdf).toEqual(o);
  });

  it("Seiten nutzen das Original: Teilen/Drucken, Kassenbuch, Fassungen, Paket, Archiv, Kontrollmappe", () => {
    expect(SRC("seiten/Abschluss.tsx")).toMatch(/pdfAusgabe\(u, Boolean\(v\.festschreiben\)/);
    expect(SRC("seiten/Kasse.tsx")).toContain("pdfAusgabe(gleich && fest ? fest : {}");
    expect(SRC("seiten/Fassungen.tsx")).toContain("originalLesen(f2.pdf");
    expect(SRC("seiten/Steuerberatung.tsx")).toContain("ausgabePdf(u, z.dateiLesen");
    expect(SRC("seiten/Sicherung.tsx")).toContain("ausgabePdf(u, async (n) => dateien[n]");
    expect(SRC("seiten/Kontrollmappe.tsx")).toContain("originalLesen(u.pdf");
  });
});

describe("E-228: Paket und Archiv bevorzugen das Original", () => {
  it("ausgabePdf: gespeichertes Original statt neu erzeugt; ohne Original neu erzeugt", async () => {
    const original = pdf("v1");
    const { s, g } = await rechnungTeilen(BASIS, original);
    const u = s.unterlagen[0]!;
    let erzeugt = 0;
    const r = await ausgabePdf(u, async (n) => g.ordner.get(n) ?? null, async () => (erzeugt++, pdf("neu")));
    expect(r.original).toBe(true);
    expect([...r.bytes!]).toEqual([...original]);
    expect(erzeugt).toBe(0);
    const ohne = await ausgabePdf({ ...u, pdf: undefined }, async () => null, async () => pdf("neu"));
    expect(ohne.original).toBe(false);
  });

  it("offenes Archiv: Rechnungen/…pdf ist das aufbewahrte Original (nicht das neu erzeugte), Nachweise unter Unterlagen/", async () => {
    const original = pdf("Original vom 02.03.");
    const { s, g } = await rechnungTeilen(BASIS, original);
    // Nachweis (Verfahrensdokumentation) mit Original
    let s2 = anlegen(s, "verfahrensdokumentation", t("2026-03-05"), "vd")[0];
    const vdPdf = pdfOriginalFuer("vdpdf0001.pdf", pdf("VD"), "2026-03-05T09:00:00.000Z");
    s2 = ausgeben(s2, "vd", t("2026-03-05"), undefined, vdPdf.sha256, B, false, undefined, vdPdf);
    expect(s2.unterlagen.find((u) => u.id === "vd")!.pdf).toEqual(vdPdf);
    const dateien: Record<string, Uint8Array> = {};
    for (const n of dateienImStand(s2)) dateien[n] = n === "vdpdf0001.pdf" ? pdf("VD") : g.ordner.get(n)!;
    const a = offenesArchiv(s2, dateien, "2026-03-10T10:00:00.000Z", { rechnungsPdfs: { r1: pdf("neu erzeugt") } });
    const zip = unzipSync(a.zip);
    const rechnung = Object.keys(zip).find((k) => k.startsWith("Rechnungen/"))!;
    expect([...zip[rechnung]!]).toEqual([...original]);
    const nachweis = Object.keys(zip).filter((k) => k.startsWith("Unterlagen/"));
    expect(nachweis).toHaveLength(1);
    expect(strFromU8(zip[nachweis[0]!]!)).toContain("VD");
    expect(strFromU8(zip["LIESMICH.txt"]!)).toContain("2 Original-PDF(s)");
    // die verschlüsselte Datei selbst (interner Name) steht nicht zusätzlich lose im Archiv
    expect(Object.keys(zip).some((k) => k.includes(s2.unterlagen.find((u) => u.id === "r1")!.pdf!.datei))).toBe(false);
  });
});

describe("E-228: Stand, Korrektur, Kassenbuch, Android „Doch verschickt“", () => {
  it("gespeichert und geladen: pdf bleibt; unzulässiger Dateiname (Pfad) oder kaputter Prüfwert fällt weg", async () => {
    const { s } = await rechnungTeilen(BASIS, pdf("v1"));
    expect(standAus(JSON.stringify(s)).unterlagen[0]!.pdf).toEqual(s.unterlagen[0]!.pdf);
    const roh = JSON.parse(JSON.stringify(s));
    roh.unterlagen[0].pdf.datei = "../../Library/x.pdf";
    expect(standAus(JSON.stringify(roh)).unterlagen[0]!.pdf).toBeUndefined();
    const roh2 = JSON.parse(JSON.stringify(s));
    roh2.unterlagen[0].pdf.sha256 = "kein-hash";
    expect(standAus(JSON.stringify(roh2)).unterlagen[0]!.pdf).toBeUndefined();
  });

  it("dateienImStand: aufbewahrte PDFs der Unterlage, früherer Fassungen und unbestätigter Ausgaben", () => {
    const p = (n: string) => pdfOriginalFuer(n, pdf(n), "2026-03-02T09:00:00.000Z");
    const s: Stand = { ...BASIS, unterlagen: [{ id: "u", vorlage: "arbeitszeitnachweis", daten: {}, erstellt: "2026-03-01T09:00:00.000Z", geaendert: "2026-03-01T09:00:00.000Z", festgeschrieben: "2026-03-02T09:00:00.000Z", pdf: p("aaaa0001.pdf"), fassungen: [{ daten: {}, festgeschrieben: "2026-02-01T09:00:00.000Z", ersetzt: "2026-03-01T09:00:00.000Z", pdf: p("bbbb0001.pdf") }], geteiltOffen: [{ am: "2026-03-01T10:00:00.000Z", art: "pdf", daten: {}, pdf: p("cccc0001.pdf") }] }] };
    expect(pdfDateienImStand(s).sort()).toEqual(["aaaa0001.pdf", "bbbb0001.pdf", "cccc0001.pdf"]);
    expect(dateienImStand(s)).toEqual(expect.arrayContaining(["aaaa0001.pdf", "bbbb0001.pdf", "cccc0001.pdf"]));
  });

  it("Korrektur eines Nachweises: das PDF gehört zur abgelösten Fassung, der Entwurf hat keins", () => {
    let s = anlegen(BASIS, "arbeitszeitnachweis", t("2026-03-01"), "az")[0];
    const o = pdfOriginalFuer("azpdf0001.pdf", pdf("AZ"), "2026-03-02T09:00:00.000Z");
    s = ausgeben(s, "az", t("2026-03-02"), undefined, o.sha256, B, false, undefined, o);
    s = korrigieren(s, "az", "Stunden nachgetragen", t("2026-03-05"));
    const u = s.unterlagen[0]!;
    expect(u.pdf).toBeUndefined();
    expect(u.fassungen![0]!.pdf).toEqual(o);
    expect(dateienImStand(s)).toContain("azpdf0001.pdf");
  });

  it("Kassenbuch: Original beim Festschreiben; neue Fassung nimmt das alte PDF in die Historie", () => {
    const o1 = pdfOriginalFuer("kbpdf0001.pdf", pdf("KB1"), "2026-04-01T09:00:00.000Z");
    let s = kassenbuchFestschreiben(BASIS, "2026-03", "", { eintraege: [] }, "a".repeat(64), t("2026-04-01"), "kb", B, undefined, o1);
    expect(s.unterlagen[0]!.pdf).toEqual(o1);
    const o2 = pdfOriginalFuer("kbpdf0002.pdf", pdf("KB2"), "2026-04-02T09:00:00.000Z");
    s = kassenbuchFestschreiben(s, "2026-03", "", { eintraege: [{ datum: "2026-03-02" }] }, "b".repeat(64), t("2026-04-02"), "x", B, undefined, o2);
    expect(s.unterlagen[0]!.pdf).toEqual(o2);
    expect(s.unterlagen[0]!.fassungen![0]!.pdf).toEqual(o1);
  });

  it("Android „Nein, noch nicht“ → später „Doch verschickt“: das PDF der geteilten Fassung wird das Original", () => {
    const s = rechnungEntwurf(BASIS);
    const u = s.unterlagen[0]!;
    const o = pdfOriginalFuer("offen0001.pdf", pdf("geteilt"), "2026-03-02T09:00:00.000Z");
    let s2 = teilenOffenVermerken(s, "r1", t("2026-03-02"), { daten: u.daten, art: "pdf", pdfSha256: o.sha256, absender: B, pdf: o });
    expect(s2.unterlagen[0]!.festgeschrieben).toBeUndefined();
    expect(dateienImStand(s2)).toContain("offen0001.pdf");
    // danach wurde dieselbe Fassung noch als XRechnung geteilt – festgeschrieben wird mit dem PDF
    s2 = teilenOffenVermerken(s2, "r1", t("2026-03-02", 10), { daten: u.daten, art: "xml", absender: B });
    const fest = geteilteFassungFestschreiben(s2, "r1", t("2026-03-03")).unterlagen[0]!;
    expect(fest.festgeschrieben).toBeTruthy();
    expect(fest.pdf).toEqual(o);
    expect(fest.pdfSha256).toBe(o.sha256);
    expect(fest.pdfFolgt).toBeUndefined();
  });
});

describe("E-228: zuerst als XRechnung geteilt – das erste PDF wird das Original", () => {
  it("pdfFolgt nach der XRechnung; das nächste PDF wird nachgereicht und gesetzt", async () => {
    const s = rechnungEntwurf(BASIS);
    const u0 = s.unterlagen[0]!;
    const s1 = ausgeben(s, "r1", t("2026-03-02"), u0.daten, undefined, B, true, dokumentHtml(vorlageFuer("rechnung")!, u0.daten, B));
    const u = s1.unterlagen[0]!;
    expect(u.festgeschrieben).toBeTruthy();
    expect(u.pdfFolgt).toBe(true);
    expect(u.pdfSha256).toBeUndefined();
    const erstes = pdf("erstes PDF nach der XRechnung");
    const g = umgebung(erstes);
    const r = await pdfAusgabe(u, true, g.e);
    expect(r.nachgereicht).toBeTruthy();
    expect(r.nachgereicht!.quelle).toBeUndefined();
    const s2 = pdfOriginalSetzen(s1, "r1", r.nachgereicht!);
    expect(s2.unterlagen[0]!.pdf).toEqual(r.nachgereicht);
    expect(s2.unterlagen[0]!.pdfSha256).toBe(pdfPruefwert(erstes));
    expect(s2.unterlagen[0]!.pdfFolgt).toBeUndefined();
    // ein späteres PDF ersetzt es nicht
    expect(pdfOriginalSetzen(s2, "r1", pdfOriginalFuer("spaeter01.pdf", pdf("später"), "2026-03-04T09:00:00.000Z"))).toBe(s2);
    // erneutes Teilen der XRechnung setzt pdfFolgt nicht wieder
    expect(ausgeben(s2, "r1", t("2026-03-05"), undefined, undefined, B, true).unterlagen[0]!.pdfFolgt).toBeUndefined();
  });
});

describe("E-228 (T-300 b): vor dem Update festgeschrieben – geteiltes PDF einlesen und prüfen", () => {
  /** Rechnung wie vor E-228: festgeschrieben mit Prüfwert des geteilten PDFs, ohne Bytes */
  const alt = (geteilt: Uint8Array) => {
    const s = rechnungEntwurf(BASIS);
    return ausgeben(s, "r1", t("2026-03-02"), s.unterlagen[0]!.daten, pdfPruefwert(geteilt), B);
  };
  const ablage = () => {
    const m = new Map<string, Uint8Array>();
    return { m, ablegen: async (b: Uint8Array) => (m.set(`imp${m.size}0000.pdf`, b), `imp${m.size - 1}0000.pdf`) };
  };

  it("Prüfwert stimmt: als Original aufbewahrt (eingelesen)", async () => {
    const geteilt = pdf("damals geteilt");
    const s = alt(geteilt);
    const a = ablage();
    const r = await pdfEinlesen(s.unterlagen[0]!, geteilt, a.ablegen, "2026-10-27T12:00:00.000Z");
    expect(r.ergebnis).toBe("gleich");
    expect(r.pdf).toMatchObject({ sha256: pdfPruefwert(geteilt), quelle: "eingelesen", groesse: geteilt.length });
    expect(a.m.size).toBe(1);
    const s2 = pdfOriginalSetzen(s, "r1", r.pdf!);
    expect(s2.unterlagen[0]!.pdf).toEqual(r.pdf);
    expect(dateienImStand(s2)).toContain(r.pdf!.datei);
  });

  it("Prüfwert weicht ab: nichts abgelegt, nichts gesetzt (auch nicht über pdfOriginalSetzen)", async () => {
    const s = alt(pdf("damals geteilt"));
    const a = ablage();
    const anders = pdf("später neu erzeugt");
    const r = await pdfEinlesen(s.unterlagen[0]!, anders, a.ablegen, "2026-10-27T12:00:00.000Z");
    expect(r.ergebnis).toBe("abweichend");
    expect(r.sha256).toBe(pdfPruefwert(anders));
    expect(r.pdf).toBeUndefined();
    expect(a.m.size).toBe(0);
    expect(pdfOriginalSetzen(s, "r1", pdfOriginalFuer("imp00000.pdf", anders, "2026-10-27T12:00:00.000Z", "eingelesen"))).toBe(s);
  });

  it("ohne Prüfwert (gedruckt bzw. Web), kein PDF, schon vorhanden: kein Original", () => {
    const s = rechnungEntwurf(BASIS);
    const ohne = ausgeben(s, "r1", t("2026-03-02"), s.unterlagen[0]!.daten, undefined, B).unterlagen[0]!;
    expect(pdfVergleichen(ohne, pdf("x")).ergebnis).toBe("ohne_pruefwert");
    expect(pdfVergleichen({ ...ohne, pdfSha256: "a".repeat(64) }, enc.encode("kein pdf")).ergebnis).toBe("kein_pdf");
    expect(pdfVergleichen({ ...ohne, pdf: pdfOriginalFuer("a1b2c3d4.pdf", pdf("x"), "2026-03-02T09:00:00.000Z") }, pdf("x")).ergebnis).toBe("schon_da");
    expect(pdfVergleichen(s.unterlagen[0]!, pdf("x")).ergebnis).toBe("schon_da");
  });

  it("zwischen E-220 und E-228 festgeschrieben: neu erzeugtes PDF byte-gleich mit dem Prüfwert → automatisch nachgereicht", async () => {
    const geteilt = pdf("gleich gesetzt");
    const u = alt(geteilt).unterlagen[0]!;
    const g = umgebung(geteilt);
    const r = await pdfAusgabe(u, true, g.e);
    expect(r.nachgereicht).toMatchObject({ sha256: pdfPruefwert(geteilt), quelle: "eingelesen" });
    // anders gesetzt: nur Wiedergabe, kein Original
    const g2 = umgebung(pdf("anders gesetzt"));
    expect((await pdfAusgabe(u, true, g2.e)).nachgereicht).toBeUndefined();
    expect(g2.ordner.size).toBe(0);
  });

  it("Abschluss bietet das Einlesen an (Dateiwahl → Vergleich → nur bei Gleichheit aufbewahren)", () => {
    const src = SRC("seiten/Abschluss.tsx");
    expect(src).toContain('dateiWaehlenBytes(["application/pdf"])');
    expect(src).toContain("pdfEinlesen(u, d.bytes");
    expect(src).toContain("TEXT.e228_einlesen_ergebnis(r.ergebnis");
  });
});

describe("E-228: Zusammenführen und Synchronisation behalten das Original", () => {
  it("gleiche Fassung auf beiden Seiten, nur eine mit PDF (z. B. ältere App-Version): das PDF bleibt – in beiden Richtungen", async () => {
    const { s } = await rechnungTeilen(BASIS, pdf("v1"));
    const mit = s.unterlagen[0]!;
    const { pdf: _p, ...ohne } = mit;
    expect(unterlagenVereinen(mit, ohne).u.pdf).toEqual(mit.pdf);
    expect(unterlagenVereinen(ohne, mit).u.pdf).toEqual(mit.pdf);
    // zuerst XRechnung auf Gerät A (pdfFolgt), PDF auf Gerät B nachgereicht
    const a = { ...ohne, pdfSha256: undefined, pdfFolgt: true as const };
    const b = { ...mit, pdfSha256: undefined };
    const v = unterlagenVereinen(a, b).u;
    expect(v.pdf).toEqual(mit.pdf);
    expect(v.pdfSha256).toBe(mit.pdf!.sha256);
    expect(v.pdfFolgt).toBeUndefined();
  });

  it("Synchronisation: die PDF-Datei geht verschlüsselt hoch und kommt auf dem zweiten Gerät an; Stand mit pdf", async () => {
    const server = { version: 0, schluessel: "", daten: null as string | null, dateien: new Map<string, string>() };
    const api: TresorApi = {
      holen: async () => ({ version: server.version, schluessel: server.schluessel, daten: server.daten }),
      speichern: async (version, daten) => {
        if (version !== server.version) throw new SyncFehler("konflikt");
        server.daten = daten;
        return ++server.version;
      },
      dateien: async () => [...server.dateien.keys()],
      dateiSpeichern: async (name, daten) => void (server.dateien.has(name) || server.dateien.set(name, daten)),
      dateiHolen: async (name) => server.dateien.get(name) ?? null,
    };
    const geraet = (sync: Uint8Array, start: Stand, ordner: Map<string, Uint8Array>) => {
      const g = { stand: start };
      const u: SyncUmgebung = { api, sync, zufall, lokal: () => g.stand, uebernehmen: (x) => void (g.stand = syncZusammenfuehren(g.stand, x).stand), dateiLokal: async (n) => ordner.get(n) ?? null, dateiAblegen: async (n, b) => void ordner.set(n, b) };
      return { g, u };
    };
    const original = pdf("Original zum Synchronisieren");
    const { s, g } = await rechnungTeilen(BASIS, original);
    const sync = zufallsSchluessel(zufall);
    server.schluessel = huelleErstellen(sync, "richtig-langes-passwort", zufall, 1000);
    const a = geraet(sync, s, g.ordner);
    expect(await synchronisieren(a.u)).toMatchObject({ hochgeladen: 1 });
    const name = s.unterlagen[0]!.pdf!.datei;
    expect(server.dateien.get(name)).toMatch(/^\{"format":"amtlos-tresor"/);
    expect(server.dateien.get(name)).not.toContain("Original zum");
    const ordnerB = new Map<string, Uint8Array>();
    const b = geraet(huelleOeffnen(server.schluessel, "richtig-langes-passwort"), LEERER_STAND, ordnerB);
    expect(await synchronisieren(b.u)).toMatchObject({ heruntergeladen: 1, fehlendeDateien: [] });
    expect(b.g.stand.unterlagen[0]!.pdf).toEqual(s.unterlagen[0]!.pdf);
    expect([...ordnerB.get(name)!]).toEqual([...original]);
    // erneutes Teilen auf Gerät B gibt dieselben Bytes weiter
    const heute = umgebung(pdf("Gerät B setzt anders"));
    heute.e.lesen = async (n) => ordnerB.get(n) ?? null;
    const r = await pdfAusgabe(b.g.stand.unterlagen[0]!, true, heute.e);
    expect(r.original).toBe(true);
    expect(pdfPruefwert(heute.log.bytesAusgegeben[0]!)).toBe(pdfPruefwert(original));
  });

  it("Sicherung (Container): das PDF steckt in der Sicherungsdatei und wird beim Einspielen abgelegt", async () => {
    const original = pdf("Original in der Sicherung");
    const { s, g } = await rechnungTeilen(BASIS, original);
    const K = schluesselAusPasswort("sonnenschein-2026", zufall, 1000);
    const stuecke: Uint8Array[] = [];
    const { fehlend } = await containerSchreiben({ schreiben: async (b) => void stuecke.push(b.slice()) }, s, K, zufall, { namen: dateienImStand(s), lesen: async (n) => g.ordner.get(n) ?? null }, new Date());
    expect(fehlend).toEqual([]);
    const bytes = Uint8Array.from(Buffer.concat(stuecke));
    const leser = async (): Promise<Leser> => {
      let pos = 0;
      return { lesen: async (n) => bytes.subarray(pos, (pos = Math.min(bytes.length, pos + n))) };
    };
    const geoeffnet = await containerOeffnen(leser, "sonnenschein-2026");
    expect(geoeffnet.stand.unterlagen[0]!.pdf).toEqual(s.unterlagen[0]!.pdf);
    const abgelegt = new Map<string, Uint8Array>();
    expect((await geoeffnet.dateien(async () => true, async (n, b) => void abgelegt.set(n, b))).fehler).toBe(0);
    expect([...abgelegt.get(s.unterlagen[0]!.pdf!.datei)!]).toEqual([...original]);
  });
});
