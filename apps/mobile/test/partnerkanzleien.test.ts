/**
 * Partnerkanzleien „Steuerberatung finden“ (amtlos-intern: docs/15-partnerkanzleien.md): feste Listungsgebühr, nie Provision je Mandat
 * (§ 9 StBerG, § 49b Abs. 3 BRAO – Prüfbericht Rechtsanwalt, Abschnitt 7). Vorsorglich gebaut und verborgen, solange die
 * gebündelte Liste leer ist.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MARKE } from "@amtlos/marke";
import { BUNDESWEIT, KANZLEIEN, emailGueltig, festpreisText, gebietText, kanzleiFehler, mailtoLink, sichtbareKanzleien, telLink, type Kanzlei } from "../src/partner/kanzleien";
import { DATENSCHUTZ, datenschutzAbschnitte } from "../src/rechtliches";
import { T as TEXT } from "../src/texte";

const SRC = path.resolve(__dirname, "../src");
const lies = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8");
const HEUTE = "2026-10-21";

/** Testkanzlei – nur hier, nie in der gebündelten Liste. */
const MUSTER: Kanzlei = {
  id: "stb-muster",
  name: "Muster Steuerberatungsgesellschaft mbH",
  kurz: "Muster StB",
  berufsbezeichnung: "Steuerberatungsgesellschaft",
  ort: "Reutlingen",
  gebiet: BUNDESWEIT,
  email: "kontakt@muster-stb.example",
  telefon: "+49 7121 123456",
  web: "https://muster-stb.example",
  kammer: "Steuerberaterkammer Stuttgart",
  leistungen: ["Erstgespräch", "Buchhaltung übernehmen", "USt-Voranmeldung", "Jahresabschluss"],
  festpreise: ["Erstgespräch 30 Min. per Video: 90 € laut Kanzlei", "Buchhaltung ab 120 € im Monat"],
  datev: true,
  branchen: ["Handwerk"],
  gueltigBis: "2027-06-30",
};

describe("Sichtbarkeit", () => {
  it("die gebündelte Liste ist leer – ohne Listungsvertrag erscheint nichts", () => {
    expect(KANZLEIEN).toEqual([]);
    expect(sichtbareKanzleien(HEUTE)).toEqual([]);
  });

  it("eine gültige Kanzlei erscheint, eine abgelaufene nicht (der letzte Tag zählt noch)", () => {
    expect(sichtbareKanzleien(HEUTE, [MUSTER]).map((k) => k.id)).toEqual(["stb-muster"]);
    expect(sichtbareKanzleien(HEUTE, [{ ...MUSTER, gueltigBis: HEUTE }])).toHaveLength(1);
    expect(sichtbareKanzleien(HEUTE, [{ ...MUSTER, gueltigBis: "2026-10-20" }])).toEqual([]);
    expect(kanzleiFehler({ ...MUSTER, gueltigBis: "2026-10-20" }, HEUTE)).toContain("abgelaufen");
  });

  it("ungültige Einträge fallen heraus, doppelte Kennungen erscheinen einmal, Reihenfolge wie in der Liste", () => {
    const b = { ...MUSTER, id: "stb-b", name: "B" };
    expect(sichtbareKanzleien(HEUTE, [{ ...MUSTER, email: "kaputt" }, b, MUSTER, { ...MUSTER, name: "Doppelt" }]).map((k) => k.name)).toEqual(["B", MUSTER.name]);
  });

  it("die Seite zeigt den Bereich nur mit sichtbaren Kanzleien; Pflicht-Einstieg nur bei Steuern", () => {
    const k = lies("seiten/Kanzleien.tsx");
    expect(k).toMatch(/const liste = sichtbareKanzleien\(heute\(\)\);\s*if \(!liste\.length\) return null;/);
    const p = lies("seiten/Pflichten.tsx");
    expect(p).toContain('p.kategorie === "steuern" && kanzleienSichtbar()');
    expect(lies("seiten/Steuerberatung.tsx")).toContain("kanzleienZuerst && kanzleienSichtbar()");
  });
});

describe("Prüfung der Angaben", () => {
  it("vollständige Kanzlei ist in Ordnung (auch Einzelberater, PLZ-Bereich, ohne Kann-Felder)", () => {
    expect(kanzleiFehler(MUSTER, HEUTE)).toEqual([]);
    const { telefon: _t, web: _w, festpreise: _f, branchen: _b, kurz: _k, ...pflicht } = MUSTER;
    expect(kanzleiFehler({ ...pflicht, berufsbezeichnung: "Steuerberaterin", gebiet: "70–72", datev: false }, HEUTE)).toEqual([]);
  });

  it("fehlende Pflichtfelder werden gemeldet", () => {
    for (const feld of ["id", "name", "berufsbezeichnung", "ort", "gebiet", "email", "kammer", "leistungen", "datev", "gueltigBis"] as const) {
      const k: Partial<Kanzlei> = { ...MUSTER };
      delete k[feld];
      expect(kanzleiFehler(k, HEUTE), feld).toContain(feld);
    }
    expect(kanzleiFehler({ ...MUSTER, leistungen: [] }, HEUTE)).toContain("leistungen");
    expect(kanzleiFehler(null, HEUTE)).not.toEqual([]);
  });

  it("E-Mail, Website, Telefon, Kammer, Gebiet und Datum werden geprüft", () => {
    expect(emailGueltig("kontakt@muster-stb.example")).toBe(true);
    for (const e of ["", "kontakt", "kontakt@", "@muster.de", "a b@muster.de", "kontakt@muster", "x@y.de?subject=Hallo"]) expect(emailGueltig(e), e).toBe(false);
    expect(kanzleiFehler({ ...MUSTER, web: "http://muster-stb.example" }, HEUTE)).toContain("web");
    expect(kanzleiFehler({ ...MUSTER, telefon: "anrufen" }, HEUTE)).toContain("telefon");
    expect(kanzleiFehler({ ...MUSTER, kammer: "IHK Reutlingen" }, HEUTE)).toContain("kammer");
    expect(kanzleiFehler({ ...MUSTER, gebiet: "Süddeutschland" }, HEUTE)).toContain("gebiet");
    expect(kanzleiFehler({ ...MUSTER, gueltigBis: "2027-02-30" }, HEUTE)).toContain("gueltigBis");
    expect(kanzleiFehler({ ...MUSTER, berufsbezeichnung: "Rechtsanwalt" as never }, HEUTE)).toContain("berufsbezeichnung");
    expect(kanzleiFehler({ ...MUSTER, kurz: "Muster Steuerberatungsgesellschaft" }, HEUTE)).toContain("kurz");
  });

  it("erfolgsbezogene Vergütung in den Angaben wird abgelehnt", () => {
    expect(kanzleiFehler({ ...MUSTER, festpreise: ["Erstgespräch frei, Provision über die App"] }, HEUTE)).toContain("verguetung");
    expect(kanzleiFehler({ ...MUSTER, leistungen: ["Vermittlungsgebühr je Mandat"] }, HEUTE)).toContain("verguetung");
  });
});

describe("Anzeige", () => {
  it("Festpreise immer mit „laut Kanzlei“, nie doppelt", () => {
    expect(festpreisText(MUSTER.festpreise![0]!)).toBe("Erstgespräch 30 Min. per Video: 90 € laut Kanzlei");
    expect(festpreisText(MUSTER.festpreise![1]!)).toBe("Buchhaltung ab 120 € im Monat (laut Kanzlei)");
    expect(lies("seiten/Kanzleien.tsx")).not.toMatch(/>\{p\}<|>\{k\.festpreise\[0\]!?\}</);
  });

  it("Kontakt-Links: mailto mit Betreff ohne Anhang, tel nur mit Ziffern", () => {
    expect(mailtoLink(MUSTER.email, TEXT.kanzlei_betreff)).toBe(`mailto:kontakt@muster-stb.example?subject=${encodeURIComponent(`Anfrage über ${MARKE.name}`)}`);
    expect(telLink("+49 (7121) 12-34/56")).toBe("tel:+497121123456");
    expect(gebietText("72")).toBe("PLZ-Bereich 72");
    expect(gebietText(BUNDESWEIT)).toBe("bundesweit digital");
  });

  it("Transparenzhinweis mit Marke steht immer im Bereich und im Blatt", () => {
    expect(TEXT.kanzlei_transparenz).toBe(`Die Kanzleien beraten eigenverantwortlich unter eigenem Namen. ${MARKE.name} vermittelt nicht gegen Provision; Kanzleien zahlen eine feste Gebühr für die Listung.`);
    expect(TEXT.kanzlei_daten).toBe("Deine Daten gehen nur an die Kanzlei, wenn du sie selbst sendest.");
    const k = lies("seiten/Kanzleien.tsx");
    expect(k).toMatch(/function Transparenz\(\)[\s\S]*TEXT\.kanzlei_transparenz[\s\S]*TEXT\.kanzlei_daten/);
    // im Bereich (nach der Liste) und im Blatt der Kanzlei
    expect(k.match(/<Transparenz \/>/g)).toHaveLength(2);
    expect(k).not.toMatch(/Betriebsklar|Amtlos/);
  });
});

describe("Paket an die Kanzlei und Pro", () => {
  it("„Paket an … senden“ erstellt das vorhandene Steuerberater-Paket (mit Pro-Prüfung wie bisher)", () => {
    const k = lies("seiten/Kanzleien.tsx");
    expect(k).toMatch(/TEXT\.kanzlei_senden\(k\.kurz \?\? k\.name\)/);
    expect(k).toMatch(/setTimeout\(\(\) => senden\(k\), \d+\)/);
    const s = lies("seiten/Steuerberatung.tsx");
    expect(s).toContain("senden={(k) => void losRef.current(k)}");
    // dieselbe Funktion wie „Paket teilen“: Pro-Sperre, steuerpaket(), Teilen-Menü
    const los = s.slice(s.indexOf("const los = async (kanzlei?: Kanzlei)"), s.indexOf("losRef.current = los"));
    expect(los).toContain('if (!sperre("steuerberater")) return;');
    expect(los).toContain("steuerpaket(z.stand, zr, sb, dateien");
    expect(los).toContain('dateiTeilenBytes(p.dateiname, p.zip, "application/zip")');
    expect(TEXT.kanzlei_senden_ziel("Muster", MUSTER.email)).toContain(MUSTER.email);
  });

  it("Liste und Kontakt sind frei – keine Pro-Sperre im Kanzlei-Bereich", () => {
    const k = lies("seiten/Kanzleien.tsx");
    expect(k).not.toMatch(/useProSperre|sperre\(/);
    expect(k).toContain("mailtoLink(k.email");
    // Adresse auswählbar, falls keine Mail-App da ist
    expect(k).toMatch(/selectable/);
  });

  it("keine neue native Abhängigkeit (kein Mail-Composer, keine Zwischenablage)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["expo-mail-composer"]).toBeUndefined();
    expect(pkg.dependencies["expo-clipboard"]).toBeUndefined();
  });
});

describe("Berufsrecht und Datenschutz", () => {
  it("„Provision“ nur im verneinten Satz – nirgends sonst in Texten der App", () => {
    const werte = Object.entries(TEXT).flatMap(([schluessel, w]) => [[schluessel, typeof w === "function" ? String(w) : JSON.stringify(w)] as const]);
    const mit = werte.filter(([, w]) => /provision/i.test(w)).map(([s]) => s);
    expect(mit).toEqual(["kanzlei_transparenz"]);
    expect(TEXT.kanzlei_transparenz).toMatch(/vermittelt nicht gegen Provision/);
    for (const a of datenschutzAbschnitte(true)) expect(a.text).not.toMatch(/provision/i);
    // in Seiten und Daten der Funktion: kein Erfolgshonorar, keine Vermittlungsgebühr je Mandat
    for (const datei of ["seiten/Kanzleien.tsx", "seiten/Steuerberatung.tsx", "partner/kanzleien.ts"]) {
      const code = lies(datei).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code.replace(/const VERBOTEN = .*$/m, ""), datei).not.toMatch(/provision|erfolgshonorar|vermittlungsgeb/i);
    }
  });

  it("Datenschutzhinweis: Teilen an eine Kanzlei deiner Wahl – stimmt auch mit leerer Liste", () => {
    const teilen = DATENSCHUTZ.abschnitte.find((a) => a.titel === "Was du teilst")!;
    expect(teilen.text).toContain("an eine Kanzlei deiner Wahl");
    expect(teilen.text).toContain("Pakete für die Steuerberatung");
    expect(teilen.text).not.toMatch(/Partnerkanzlei/);
    expect(datenschutzAbschnitte(true).find((a) => a.titel === "Was du teilst")!.text).toContain("an eine Kanzlei deiner Wahl");
  });
});
