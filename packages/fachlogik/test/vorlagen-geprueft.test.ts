/**
 * Vermerk unter den Vorlagen (zuerst Nachkontrolle Lebensmittelfachbeauftragter, 23.10.2026; E-196, E-197): nur bei
 * schriftlich bestätigter Freigabe (Mail, Bericht oder ausgefüllte Datei des Prüfers – alles beim Gründer, nicht im
 * Repository, E-198/E-199), solange die Teilsummen der gedruckten Ausprägungen, die die Unterlage betreffen (Rechtsform,
 * Land, Rechnungsart …), zum freigegebenen Stand passen; mit Rolle statt Namen, mit Einschränkung des Prüfers und
 * „teilweise“, wenn die Vorlage noch „fachlich zu prüfen“ enthält.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEERER_BETRIEB, PRUEFHINWEIS, PRUEFSTAENDE, PRUEF_ROLLEN, VERIFIZIERUNG, VORLAGEN, aktuellerPruefstand, pruefGruppenFuer, type Betrieb, dokumentHtml, freigabeBestaetigt, freigabenFuer, leereDaten, VORLAGEN_GEPRUEFT, geprueftVermerk, pruefHinweisFuer, sha256, vorlageFuer, vorlageGeprueft, vorlagenPruefstand, vorlagenPruefsumme, type Daten, type Vorlage, type VorlagenFreigabe, type VorlagenNachweis } from "../src/index.js";

const WURZEL = path.resolve(__dirname, "../../..");
/** E-199: Namen der Prüfer nur als SHA-256 (docs/freigabe-katalog/namen-sha256.json), nie im Klartext */
const NAMEN = JSON.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/namen-sha256.json"), "utf8")) as { einzeln: string[]; paare: string[]; mehrdeutig: string[] };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const nenntName = (text: string) => {
  const w = text.toLowerCase().match(/[a-zäöüß]+/g) ?? [];
  return w.some((x) => NAMEN.einzeln.includes(sha(x)) || NAMEN.mehrdeutig.includes(sha(x))) || w.slice(1).some((x, i) => NAMEN.paare.includes(sha(`${w[i]} ${x}`)));
};
/** E-199: Verweis auf eine Unterlage der Prüfer (Datei, Ordner) – geprueft.ts nennt keine */
const DATEIVERWEIS = /docs\/pruefberichte|versand-|\.(xlsx|xls|pdf|eml|msg|jpe?g|png|txt|md|docx?)\b/i;
const FUENF = ["haccp", "hygieneplan", "allergene", "ifsg_belehrung", "hygieneschulung"];
const WEITERE = ["rechnung", "euer", "verfahrensdokumentation", "kassenmeldung", "lohnkonto", "unterweisung", "gefahrstoffverzeichnis",
  "betriebsanweisung_maschine", "pruefprotokoll_elektro", "datenschutz_dokumentation", "datenschutzerklaerung_website", "avv", "datenschutzinformation", "datenpanne",
  "video_hinweisschild", "anamnese_einwilligung", "arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ki_kompetenz", "ausweis_hinweis", "schluesselquittung",
  "impressum", "gewerbeanmeldung", "transparenzregister",
  "ust_voranmeldung", "oss_meldung", "zm_meldung", "steuererklaerung", "kassenbuch", "aufbewahrung", "sv_meldedaten",
  "betriebsanweisung", "expositionsverzeichnis", "hautschutzplan", "gefaehrdungsbeurteilung", "betriebsanweisung_biostoffe", "bilanz_guv"];
// Rechtsanwalt 25.10.2026: nur für GmbH, OHG und KG (Vermerk abhängig von der Rechtsform)
const NUR_RECHTSFORM = ["handelsregister"];
const ALLE = [...FUENF, ...WEITERE];
// E-197: jede Freigabe ist schriftlich bestätigt (Mail oder schriftliche Antwort des Prüfers; unterschriebene Blätter am
// 25.10.2026 auf Wunsch des Gründers entfernt)
const STEUERN_23 = ["rechnung", "euer", "verfahrensdokumentation", "kassenmeldung", "lohnkonto"];
// Vorlagen, die heute einen Vermerk zeigen (Café, Einzelunternehmen): alle bestätigten außer dem Handelsregister (nur GmbH,
// OHG, KG). Die Bilanz zählt mit: dort wurde seit der Bestätigung nur der Name im Hilfetext durch die Rolle ersetzt (E-196 A),
// der Abgleich rechnet die freigegebene Fassung ebenso anonymisiert (E-197).
// Bei der Rechnung fehlt der Vermerk in den seit der Bestätigung geänderten Varianten (Fußzeile GmbH & Co. KG /
// UG & Co. KG, Storno einer Schlussrechnung mit Abschlägen; E-193).
// E-201: Auf Bitte der Fachkraft für Arbeitssicherheit (26.10.2026) zeigten sieben Vorlagen keinen Vermerk, bis sie die neu
// gerechnete Prüfsumme bestätigt hatte (`vermerk_ausgesetzt`). E-202: Zuordnung am selben Tag bestätigt – keine ausgesetzt.
const MIT_VERMERK: string[] = [...ALLE];
/** E-202: neue, vorab freigegebene Fassungen (Prüfsumme nach dem Streichen von „fachlich zu prüfen“ bzw. Satzänderungen) */
const NEUE_FASSUNG = ["unterweisung", "hautschutzplan", "gefaehrdungsbeurteilung", "datenschutzerklaerung_website", "video_hinweisschild"];
const CAFE: Betrieb = { ...LEERER_BETRIEB, name: "Café Sonne", bundesland: "Berlin" };
const CO_KG = ["rf:GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG"];
/** Erfundener Nachweis für Test-Freigaben (E-198: Art, Datum, Rolle, Umfang) */
const testNachweis = (datum: string, rolle: VorlagenNachweis["rolle"]): VorlagenNachweis => ({ art: "mail", datum, rolle, umfang: "Testfreigabe (nur im Test)", aufbewahrung: "beim Gründer" });
const alleFreigaben = () => Object.keys(VORLAGEN_GEPRUEFT).flatMap((id) => freigabenFuer(id).map((f, i) => ({ id, f, schluessel: i ? `${id}#${i}` : id })));
const datenFuer = (id: string, f: Omit<VorlagenFreigabe, "weitere">): Daten => ({ ...(f.fassung ? { [f.fassung.feld]: f.fassung.wert } : {}), ...(f.rechtsformen ? { rechtsform: f.rechtsformen[0]! } : {}), ...(id === "hygieneplan" && !f.fassung ? { art: "lebensmittel" } : {}) });

describe("Vorlagen fachlich durchgesehen: Register (geprueft.ts)", () => {
  afterEach(() => vi.useRealTimers());

  it("zentrale Liste: alle freigegebenen Vorlagen mit Rolle, alter und neuer Prüfsumme", () => {
    expect(Object.keys(VORLAGEN_GEPRUEFT).sort()).toEqual([...ALLE, ...NUR_RECHTSFORM].sort());
    expect(VORLAGEN_GEPRUEFT.handelsregister!.rechtsformen).toEqual(["GmbH", "OHG", "KG"]);
    for (const { id, f } of alleFreigaben()) {
      expect(vorlageFuer(id), id).toBeDefined();
      expect(Object.keys(PRUEF_ROLLEN), id).toContain(f.rolle);
      expect(f.pruefsumme, id).toMatch(/^[0-9a-f]{64}$/);
      expect(f.pruefsumme_alt, id).toMatch(/^[0-9a-f]{64}$/);
      expect(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]).toContain(f.stand);
      // nie ein Name im Register der App
      expect(nenntName(JSON.stringify(f)), id).toBe(false);
    }
  });

  it("E-197: jede Freigabe schriftlich bestätigt – Nachweis liegt vor, der Stand liegt nie nach der Bestätigung", () => {
    for (const { schluessel, f } of alleFreigaben()) {
      expect(freigabeBestaetigt(f), schluessel).toBe(true);
      // E-198/E-199: Nachweis mit Art, Datum, Rolle, Umfang und Aufbewahrung – die Unterlage liegt beim Gründer, nicht im Repository
      const n = f.nachweis!;
      expect(["mail", "bericht", "blatt"], schluessel).toContain(n.art);
      expect(Object.keys(n).sort(), schluessel).toEqual(["art", "aufbewahrung", "datum", "rolle", "umfang"]);
      expect(n.datum, schluessel).toBe(f.bestaetigt_am);
      expect(n.rolle, schluessel).toBe(f.rolle);
      expect(n.umfang.length, schluessel).toBeGreaterThan(20);
      expect(n.aufbewahrung, schluessel).toBe("beim Gründer");
      expect(JSON.stringify(f), schluessel).not.toMatch(DATEIVERWEIS);
      expect(JSON.stringify(f), schluessel).not.toMatch(/"(nachweis_text|beleg|zitat|blatt)":/);
      expect(f.stand <= f.bestaetigt_am!, schluessel).toBe(true);
      // keine Unterschriften mehr im Projekt (E-197)
      expect(JSON.stringify(f), schluessel).not.toMatch(/\.jpe?g"/);
    }
    // die bestätigte Prüfsumme steht im Nachweis, wo die Bestätigung sie nennt
    for (const id of ["handelsregister", "gefaehrdungsbeurteilung", "betriebsanweisung_biostoffe", "bilanz_guv"]) {
      const f = VORLAGEN_GEPRUEFT[id]!;
      expect(f.nachweis!.umfang, id).toContain(f.pruefsumme_alt!.slice(0, 12));
    }
    // E-199: keine Prüfunterlagen im Repository
    expect(fs.existsSync(path.join(WURZEL, "docs/pruefberichte"))).toBe(false);
  });

  it("die erzeugte Liste PRUEFSTAENDE passt zur Rechnung (sonst: werkzeuge/pruefstaende-erzeugen.mjs)", () => {
    const schluessel = alleFreigaben().map((x) => x.schluessel).sort();
    expect(Object.keys(PRUEFSTAENDE).sort()).toEqual(schluessel);
    for (const { id, f, schluessel: k } of alleFreigaben()) expect(vorlagenPruefstand({ ...vorlageFuer(id)! }, f), k).toEqual(PRUEFSTAENDE[k]);
  });

  it("je Rolle: Vermerk genau bei den bestätigten Freigaben mit passender Prüfsumme, Datum nie nach der Bestätigung", () => {
    const gezeigt: string[] = [];
    for (const rolle of Object.keys(PRUEF_ROLLEN)) {
      for (const { id, f } of alleFreigaben().filter((x) => x.f.rolle === rolle)) {
        const v = vorlageFuer(id)!;
        const heute = aktuellerPruefstand(v, f).teile;
        const betrieb: Betrieb = f.rechtsformen ? { ...CAFE, name: "Sonne GmbH", rechtsform: "GmbH" } : CAFE;
        const passt = (x: Omit<VorlagenFreigabe, "weitere">) => freigabeBestaetigt(x) && !x.vermerk_ausgesetzt && pruefGruppenFuer(v, x.teilsummen!, datenFuer(id, x), betrieb).every((g) => aktuellerPruefstand(v, x).teile[g] === x.teilsummen![g]);
        const soll = passt(f);
        expect(soll, `${rolle} ${id}`).toBe(freigabeBestaetigt(f) && !f.vermerk_ausgesetzt && pruefGruppenFuer(v, f.teilsummen!, datenFuer(id, f), betrieb).every((g) => heute[g] === f.teilsummen![g]));
        const hinweis = pruefHinweisFuer(v, datenFuer(id, f), betrieb);
        // E-202: mehrere Freigaben derselben Fassung – der Vermerk erscheint, wenn irgendeine von ihnen passt (die erste passende)
        const irgendeine = freigabenFuer(id).filter((x) => JSON.stringify(x.fassung) === JSON.stringify(f.fassung)).some(passt);
        expect(hinweis !== PRUEFHINWEIS, `${rolle} ${id}`).toBe(irgendeine);
        if (soll) {
          gezeigt.push(id);
          expect(hinweis).toContain(PRUEF_ROLLEN[rolle as keyof typeof PRUEF_ROLLEN]);
          const datum = hinweis.match(/Stand (\d\d)\.(\d\d)\.(\d{4})/)!;
          expect(`${datum[3]}-${datum[2]}-${datum[1]}` <= f.bestaetigt_am!, id).toBe(true);
        }
      }
    }
    expect([...new Set(gezeigt)].sort()).toEqual([...MIT_VERMERK, ...NUR_RECHTSFORM].sort());
    for (const v of VORLAGEN) if (!MIT_VERMERK.includes(v.id) && !NUR_RECHTSFORM.includes(v.id)) expect(pruefHinweisFuer(v, v.id === "hygieneplan" ? { art: "lebensmittel" } : {}, CAFE), v.id).toBe(PRUEFHINWEIS);
    // Handelsregister nur für GmbH, OHG, KG
    expect(pruefHinweisFuer(vorlageFuer("handelsregister")!, {}, CAFE)).toBe(PRUEFHINWEIS);
    // ohne Betrieb: alle Varianten müssen passen – seit E-200 auch bei der Rechnung (Co.-KG-Varianten nachgeprüft); seit E-202
    // auch das Storno einer Schlussrechnung (eigene Gruppe, nur mit diesen Daten) vom Steuerberater bestätigt
    for (const id of STEUERN_23) expect(pruefHinweisFuer(vorlageFuer(id)!, {}) !== PRUEFHINWEIS, id).toBe(true);
    expect(pruefHinweisFuer(vorlageFuer("rechnung")!, { storno_zu: "RE-1", schluss: true, storno_abschlaege: true })).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 26.10.2026)");
    // GmbH & Co. KG: nur die Rechnung druckt die geänderte Fußzeile – seit E-200 vom Steuerberater nachgeprüft (26.10.2026)
    const coKg: Betrieb = { ...CAFE, name: "Sonne GmbH & Co. KG", rechtsform: "GmbH & Co. KG" };
    for (const id of STEUERN_23) expect(pruefHinweisFuer(vorlageFuer(id)!, {}, coKg) !== PRUEFHINWEIS, id).toBe(true);
  });

  it("E-196: geändert seit der Freigabe sind nur diese Varianten (Rechnung: Fußzeile GmbH & Co. KG und Storno, E-193)", () => {
    const geaendert: Record<string, string[]> = {};
    const f0 = (k: string) => alleFreigaben().find((x) => x.schluessel === k)!.f;
    for (const { f, schluessel } of alleFreigaben()) {
      const heute = PRUEFSTAENDE[schluessel]!.teile;
      expect(Object.keys(heute).sort(), schluessel).toEqual(Object.keys(f.teilsummen!).sort());
      geaendert[schluessel] = Object.keys(heute).filter((g) => heute[g] !== f.teilsummen![g]).sort();
    }
    for (const [k, g] of Object.entries(geaendert)) {
      // Bilanz: nur der Name im Hilfetext durch die Rolle ersetzt (E-196 A) – zählt nicht als Änderung (E-197)
      // E-200: die Nachprüfung der Co.-KG-Varianten („rechnung#1“) – geändert bleibt nur das Storno der Schlussrechnung
      // E-202: Storno der Schlussrechnung bestätigt („rechnung#2“); die Fassungen vor dem Streichen von „fachlich zu prüfen“
      // (Sifa: nur der gemeinsame Teil) bzw. vor den Satzänderungen (Rechtsanwalt: alle Varianten) sind durch „#1“ ersetzt
      const alleGruppen = Object.keys(f0(k).teilsummen!).sort();
      // E-210: Impressum der GmbH & Co. KG bzw. UG & Co. KG – Vertretung durch die Komplementärin (Vermerk nur dieser Varianten entfallen)
      const soll = k === "rechnung" ? [...CO_KG, "storno_schluss"] : k === "impressum" ? [...CO_KG] : k === "rechnung#1" ? ["storno_schluss"] : ["unterweisung", "hautschutzplan", "gefaehrdungsbeurteilung"].includes(k) ? ["basis"] : ["datenschutzerklaerung_website", "video_hinweisschild"].includes(k) ? alleGruppen : [];
      expect(g, k).toEqual([...soll].sort());
    }
  });

  it("E-196/E-200/E-202: Rechnung des Einzelunternehmens mit Vermerk vom 23.10., GmbH & Co. KG, UG & Co. KG und Storno einer Schlussrechnung vom 26.10.", () => {
    const re = vorlageFuer("rechnung")!;
    const ja = (d: Daten, b?: Betrieb) => pruefHinweisFuer(re, d, b) !== PRUEFHINWEIS;
    expect(ja({}, CAFE)).toBe(true);
    expect(ja({}, { ...CAFE, name: "Sonne GmbH", rechtsform: "GmbH" })).toBe(true);
    expect(ja({ schluss: true }, CAFE)).toBe(true);
    expect(ja({ storno_zu: "RE-1" }, CAFE)).toBe(true);
    // E-202: Storno einer Schlussrechnung vom Steuerberater bestätigt (26.10.2026)
    expect(pruefHinweisFuer(re, { storno_zu: "RE-1", schluss: true, storno_abschlaege: true }, CAFE)).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 26.10.2026)");
    // E-200: Steuerberater hat die Varianten GmbH & Co. KG und UG & Co. KG am 26.10.2026 bestätigt
    const coKg = { ...CAFE, name: "Sonne GmbH & Co. KG", rechtsform: "GmbH & Co. KG" };
    const ugCoKg = { ...CAFE, name: "Sonne UG (haftungsbeschränkt) & Co. KG" };
    expect(ja({}, coKg)).toBe(true);
    expect(ja({}, ugCoKg)).toBe(true);
    expect(pruefHinweisFuer(re, {}, coKg)).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 26.10.2026)");
    expect(pruefHinweisFuer(re, { schluss: true }, ugCoKg)).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 26.10.2026)");
    // E-202: das Storno einer Schlussrechnung auch bei der Co. KG („rechnung#2“ deckt Storno und Co.-KG-Varianten)
    expect(ja({ storno_zu: "RE-1", schluss: true, storno_abschlaege: true }, coKg)).toBe(true);
    expect(ja({}, { ...CAFE, name: "Sonne AG" })).toBe(false);
    expect(pruefHinweisFuer(re, {}, CAFE)).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 23.10.2026)");
    // die Nachprüfung umfasst nur die beiden Co.-KG-Varianten, alle übrigen Teilsummen sind die der ersten Freigabe
    const [erste, nach, storno] = freigabenFuer("rechnung");
    expect(nach!.varianten).toEqual(CO_KG);
    for (const g of Object.keys(erste!.teilsummen!)) expect(nach!.teilsummen![g], g).toBe(CO_KG.includes(g) ? PRUEFSTAENDE.rechnung!.teile[g] : erste!.teilsummen![g]);
    // E-202: Storno der Schlussrechnung und die Co.-KG-Varianten aus der Fassung vom 26.10., alle übrigen aus der ersten Freigabe
    expect(storno!.varianten).toEqual(["storno_schluss", ...CO_KG]);
    for (const g of Object.keys(erste!.teilsummen!)) expect(storno!.teilsummen![g], g).toBe(storno!.varianten!.includes(g) ? PRUEFSTAENDE.rechnung!.teile[g] : erste!.teilsummen![g]);
  });

  it("Vermerk mit Rolle, Einschränkung und offenen Stellen – ohne Rolle der frühere Wortlaut", () => {
    expect(geprueftVermerk("2026-10-23")).toBe("Vorlagen fachlich durchgesehen (Stand 23.10.2026)");
    expect(geprueftVermerk("2026-10-23", { rolle: "steuern" })).toBe("Vorlage fachlich durchgesehen von einem Steuerberater (Stand 23.10.2026)");
    expect(geprueftVermerk("2026-10-25", { rolle: "arbeitsschutz", einschraenkung: "ohne arbeitsmedizinische Angaben" })).toBe("Vorlage fachlich durchgesehen von einer Fachkraft für Arbeitssicherheit (ohne arbeitsmedizinische Angaben) (Stand 25.10.2026)");
    expect(geprueftVermerk("2026-10-23", { rolle: "hygiene" }, 2)).toBe("Vorlage teilweise fachlich durchgesehen von einem Lebensmittelfachbeauftragten (Stand 23.10.2026) – mit „fachlich zu prüfen“ gekennzeichnete Angaben sind noch offen");
    for (const t of Object.values(PRUEF_ROLLEN)) expect(t).not.toMatch(/rechtssicher|garantiert|freigegeben/i);
    // Sifa: arbeitsmedizinische Angaben ausgenommen nur, wo sie es erklärt hat (E-201: Gefährdungsbeurteilung, Betriebsanweisung
    // Biostoffe; Prüfprotokoll ohne die elektrotechnischen Grenzwerte) – bei Betriebsanweisung, Expositionsverzeichnis und
    // Hautschutzplan nicht (keine arbeitsmedizinischen Angaben, Einschränkung nie erklärt)
    for (const id of ["gefaehrdungsbeurteilung", "betriebsanweisung_biostoffe"]) expect(VORLAGEN_GEPRUEFT[id]!.einschraenkung, id).toBe("ohne arbeitsmedizinische Angaben");
    expect(VORLAGEN_GEPRUEFT.pruefprotokoll_elektro!.einschraenkung).toBe("ohne die elektrotechnischen Grenzwerte");
    for (const id of ["betriebsanweisung", "expositionsverzeichnis", "hautschutzplan"]) expect(VORLAGEN_GEPRUEFT[id]!.einschraenkung, id).toBeUndefined();
  });

  it("Vorlagen mit offenen Stellen („fachlich zu prüfen“) bekämen nur „teilweise durchgesehen“", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    const f = VORLAGEN_GEPRUEFT.gefaehrdungsbeurteilung!;
    expect(PRUEFSTAENDE.gefaehrdungsbeurteilung!.offen).toBeGreaterThan(0);
    const test: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, gefaehrdungsbeurteilung: { ...f, vermerk_ausgesetzt: undefined, bestaetigt_am: "2026-10-25", nachweis: testNachweis("2026-10-25", "arbeitsschutz"), pruefsumme: vorlagenPruefsumme({ ...g }, f), teilsummen: undefined } };
    const frei = vorlageGeprueft(g, {}, test)!;
    expect(frei).toBeDefined();
    expect(geprueftVermerk(frei.stand, frei, vorlagenPruefstand({ ...g }, f).offen)).toMatch(/^Vorlage teilweise fachlich durchgesehen von einer Fachkraft für Arbeitssicherheit \(ohne arbeitsmedizinische Angaben\)/);
  });
});

describe("E-196: Prüfsumme über alle gedruckten Ausprägungen", () => {
  const haccp = vorlageFuer("haccp")!;
  const re = vorlageFuer("rechnung")!;
  const f = (v: Vorlage) => vorlagenPruefsumme({ ...v }, {});

  it("Änderungen nur in der Fußzeile, nur bei einer Rechtsform, nur bei einer Auswahl oder nur im Storno ändern die Prüfsumme", () => {
    const basis = f(re);
    // Fußzeile nur bei GmbH & Co. KG (wie E-193)
    const fuss: Vorlage = { ...re, html: (d, b) => re.html(d, b).replace(/Persönlich haftende Gesellschafterin/g, "Komplementärin") };
    // nur bei einer Rechtsform (UG)
    const ug: Vorlage = { ...re, html: (d, b) => (b.rechtsform === "UG (haftungsbeschränkt)" ? re.html(d, b).replace("Rechnung", "Rechnung (UG)") : re.html(d, b)) };
    // nur bei Kleinunternehmern (Schalter) bzw. bei Steuerschuldnerschaft (Baustein)
    const ku: Vorlage = { ...re, html: (d, b) => (d.kleinunternehmer === true ? `${re.html(d, b)}<p>KU neu</p>` : re.html(d, b)) };
    const rc: Vorlage = { ...re, html: (d, b) => (Array.isArray(d.hinweise) && d.hinweise.length === 1 && d.hinweise[0] === "reverse_charge" ? `${re.html(d, b)}<p>13b neu</p>` : re.html(d, b)) };
    // nur im Storno einer Schlussrechnung (verdeckte Angaben)
    const storno: Vorlage = { ...re, html: (d, b) => (d.storno_abschlaege === true ? `${re.html(d, b)}<p>Storno neu</p>` : re.html(d, b)) };
    // nur in Bayern (Landeszusatz)
    const bayern: Vorlage = { ...haccp, html: (d, b) => (b.bundesland === "Bayern" ? `${haccp.html(d, b)}<p>Bayern neu</p>` : haccp.html(d, b)) };
    for (const [name, v, alt] of [["Fußzeile", fuss, basis], ["Rechtsform", ug, basis], ["Kleinunternehmer", ku, basis], ["§ 13b", rc, basis], ["Storno", storno, basis], ["Bayern", bayern, f(haccp)]] as const) expect(f(v), name).not.toBe(alt);
    // nur Gestaltung (CSS) zählt nicht
    const css: Vorlage = { ...re, html: (d, b) => re.html(d, b).replace("</style>", " .neu{color:red}</style>") };
    expect(f(css)).toBe(basis);
  });

  it("jede Änderung an Bausteinen, Hilfetexten oder festen Texten ändert die Prüfsumme", () => {
    const basis = f(haccp);
    const hilfe: Vorlage = { ...haccp, abschnitte: haccp.abschnitte.map((a, i) => (i === 0 ? { ...a, hilfe: `${a.hilfe ?? ""} Neu.` } : a)) };
    const grenzwert: Vorlage = {
      ...haccp,
      abschnitte: haccp.abschnitte.map((a) => ({ ...a, felder: a.felder.map((x) => (x.art === "liste" && x.id === "punkte" && x.vorschlaege ? { ...x, vorschlaege: x.vorschlaege.map((y, j) => (j === 0 ? { ...y, werte: { ...y.werte, grenzwert: "höchstens +8 °C" } } : y)) } : x)) })),
    };
    const dokument: Vorlage = { ...haccp, html: (d, b) => haccp.html(d, b).replace("Gefahrenanalyse", "Gefahrenanalyse (geändert)") };
    for (const [name, v] of [["Hilfetext", hilfe], ["Grenzwert", grenzwert], ["Dokumenttext", dokument]] as const) {
      expect(f(v), name).not.toBe(basis);
      expect(vorlageGeprueft(v), name).toBeUndefined();
      expect(pruefHinweisFuer(v), name).toBe(PRUEFHINWEIS);
    }
  });

  it("Prüfsumme hängt nicht vom heutigen Datum ab", () => {
    vi.useFakeTimers();
    const werte: string[] = [];
    for (const tag of ["2026-10-23T08:00:00Z", "2031-03-01T12:00:00Z"]) {
      vi.setSystemTime(new Date(tag));
      werte.push(f(haccp));
    }
    vi.useRealTimers();
    expect(werte[0]).toBe(werte[1]);
    expect(werte[0]).toBe(PRUEFSTAENDE.haccp!.summe);
  });

  it("SHA-256 ohne Node-APIs stimmt mit node:crypto überein", () => {
    for (const t of ["", "abc", "Allergene und Zusatzstoffe – °C ≤ 𝄞", "x".repeat(10_000)]) expect(sha256(t)).toBe(createHash("sha256").update(t, "utf8").digest("hex"));
  });
});

describe("E-196: Vermerk je Variantengruppe – eine Textänderung in einer Variante nimmt genau dieser den Vermerk", () => {
  const re = vorlageFuer("rechnung")!;
  const haccp = vorlageFuer("haccp")!;
  const BESTAETIGT = { bestaetigt_am: "2026-10-23", nachweis: testNachweis("2026-10-23", "steuern") };
  const freigabeFuer = (v: Vorlage): Record<string, VorlagenFreigabe> => {
    const st = vorlagenPruefstand({ ...v }, {});
    return { ...VORLAGEN_GEPRUEFT, [v.id]: { stand: "2026-10-23", rolle: "steuern", bezug: "Test", ...BESTAETIGT, pruefsumme: st.summe, teilsummen: st.teile } };
  };
  const reFrei = freigabeFuer(re);
  const haccpFrei = freigabeFuer(haccp);
  const geaendert = (v: Vorlage, frei: Record<string, VorlagenFreigabe>) => {
    const heute = vorlagenPruefstand({ ...v }, {}).teile;
    const alt = frei[v.id]!.teilsummen!;
    return Object.keys(alt).filter((g) => heute[g] !== alt[g]).sort();
  };
  const CO: Betrieb = { ...CAFE, name: "Sonne GmbH & Co. KG", rechtsform: "GmbH & Co. KG" };
  const UG: Betrieb = { ...CAFE, name: "Sonne UG", rechtsform: "UG (haftungsbeschränkt)" };

  it("Fußzeile nur der GmbH & Co. KG: nur rf:GmbH & Co. KG verliert den Vermerk", () => {
    const v: Vorlage = { ...re, html: (d, b) => (b.rechtsform === "GmbH & Co. KG" ? re.html(d, b).replace("Rechnung", "Rechnung (neu)") : re.html(d, b)) };
    expect(geaendert(v, reFrei)).toEqual(["rf:GmbH & Co. KG"]);
    expect(vorlageGeprueft(v, {}, reFrei, CAFE)).toBeDefined();
    expect(vorlageGeprueft(v, {}, reFrei, UG)).toBeDefined();
    expect(vorlageGeprueft(v, {}, reFrei, CO)).toBeUndefined();
    expect(vorlageGeprueft(v, {}, reFrei)).toBeUndefined();
  });

  it("nur bei der UG: nur rf:UG verliert den Vermerk", () => {
    const v: Vorlage = { ...re, html: (d, b) => (b.rechtsform === "UG (haftungsbeschränkt)" ? `${re.html(d, b)}<p>UG neu</p>` : re.html(d, b)) };
    expect(geaendert(v, reFrei)).toEqual(["rf:UG (haftungsbeschränkt)"]);
    expect(vorlageGeprueft(v, {}, reFrei, UG)).toBeUndefined();
    expect(vorlageGeprueft(v, {}, reFrei, CAFE)).toBeDefined();
  });

  it("nur im Storno einer Schlussrechnung mit Abschlägen: nur diese Rechnungsart verliert den Vermerk", () => {
    const v: Vorlage = { ...re, html: (d, b) => (d.storno_abschlaege === true ? `${re.html(d, b)}<p>Storno neu</p>` : re.html(d, b)) };
    expect(geaendert(v, reFrei)).toEqual(["storno_schluss"]);
    expect(vorlageGeprueft(v, { storno_zu: "RE-1", schluss: true, storno_abschlaege: true }, reFrei, CAFE)).toBeUndefined();
    expect(vorlageGeprueft(v, { storno_zu: "RE-1" }, reFrei, CAFE)).toBeDefined();
    expect(vorlageGeprueft(v, {}, reFrei, CAFE)).toBeDefined();
  });

  it("nur im einfachen Storno: Storno ohne, Rechnung und Storno der Schlussrechnung behalten ihn", () => {
    const v: Vorlage = { ...re, html: (d, b) => (d.storno_zu && d.storno_abschlaege !== true ? `${re.html(d, b)}<p>Storno neu</p>` : re.html(d, b)) };
    expect(geaendert(v, reFrei)).toEqual(["storno"]);
    expect(vorlageGeprueft(v, { storno_zu: "RE-1" }, reFrei, CAFE)).toBeUndefined();
    expect(vorlageGeprueft(v, {}, reFrei, CAFE)).toBeDefined();
  });

  it("nur in Bayern: nur land:Bayern verliert den Vermerk", () => {
    const v: Vorlage = { ...haccp, html: (d, b) => (b.bundesland === "Bayern" ? `${haccp.html(d, b)}<p>Bayern neu</p>` : haccp.html(d, b)) };
    expect(geaendert(v, haccpFrei)).toEqual(["land:Bayern"]);
    expect(vorlageGeprueft(v, {}, haccpFrei, { ...CAFE, bundesland: "Bayern" })).toBeUndefined();
    expect(vorlageGeprueft(v, {}, haccpFrei, CAFE)).toBeDefined();
  });

  it("Änderung im gemeinsamen Teil (Formular, Text für alle): alle verlieren den Vermerk", () => {
    const v: Vorlage = { ...haccp, html: (d, b) => haccp.html(d, b).replace("Gefahrenanalyse", "Gefahrenanalyse (geändert)") };
    expect(geaendert(v, haccpFrei)).toContain("basis");
    for (const b of [CAFE, CO, UG, { ...CAFE, bundesland: "Bayern" }]) expect(vorlageGeprueft(v, {}, haccpFrei, b)).toBeUndefined();
  });

  it("Fußleiste zählt nur, wo sie gedruckt wird (Briefe wie die Rechnung), nicht bei ausgeblendeter Fußleiste (EÜR)", () => {
    const anders = (v: Vorlage): Vorlage => ({ ...v, html: (d, b) => v.html(d, b).replace(/Persönlich haftende Gesellschafterin/g, "Komplementärin") });
    const euer = vorlageFuer("euer")!;
    expect(vorlagenPruefsumme(anders(euer), {})).toBe(vorlagenPruefsumme({ ...euer }, {}));
    expect(geaendert(anders(re), reFrei)).toEqual(["rf:GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG"]);
  });

  it("unbekannte Rechtsform (nicht in der Prüfung): kein Vermerk", () => {
    expect(vorlageGeprueft(re, {}, reFrei, { ...CAFE, name: "Sonne AG", rechtsform: "AG" })).toBeUndefined();
    expect(vorlageGeprueft(re, {}, reFrei, CAFE)).toBeDefined();
  });
});

describe("Mehrere Freigaben je Vorlage (je Fassung eigene Prüfsumme, 24.10.2026)", () => {
  const h = vorlageFuer("hygieneplan")!;
  const lm = VORLAGEN_GEPRUEFT.hygieneplan!;
  const BEAUTY = { fassung: { feld: "art", wert: "beauty" } };
  const BESTAETIGT = { rolle: "recht" as const, bestaetigt_am: "2026-11-02", nachweis: testNachweis("2026-11-02", "recht") };
  // erfundene, bestätigte Freigaben – nur im Test, nicht in geprueft.ts
  const lmTest = { ...lm, ...BESTAETIGT, rolle: "hygiene" as const, bestaetigt_am: "2026-10-23", nachweis: testNachweis("2026-10-23", "hygiene"), pruefsumme: vorlagenPruefsumme({ ...h }, lm), teilsummen: vorlagenPruefstand({ ...h }, lm).teile };
  const beautyFreigabe = { stand: "2026-11-02", bezug: "Test", pruefsumme: vorlagenPruefsumme(h, BEAUTY), ...BEAUTY, ...BESTAETIGT };
  const mitBeauty: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, weitere: [beautyFreigabe] } };

  it("Hygieneplan: Lebensmittel-Freigabe plus Beauty-Freigabe (Rechtsanwalt 25.10.2026), sonst keine weiteren", () => {
    expect(freigabenFuer("hygieneplan").length).toBe(2);
    expect(lm.weitere?.map((x) => [x.fassung?.wert, x.stand, x.einschraenkung])).toEqual([["beauty", "2026-10-25", "Länderzusatz nur für Bayern geprüft"]]);
    expect(freigabenFuer("bilanz_guv")).toHaveLength(1);
    expect(freigabenFuer("gibt_es_nicht")).toEqual([]);
    // E-200: Rechnung mit der Nachprüfung der Co.-KG-Varianten; E-202: Storno der Schlussrechnung
    expect(VORLAGEN_GEPRUEFT.rechnung!.weitere?.map((x) => [x.stand, x.varianten])).toEqual([["2026-10-26", ["rf:GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG"]], ["2026-10-26", ["storno_schluss", "rf:GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG"]]]);
    // E-202: je eine neue, vorab freigegebene Fassung (gleiche Rolle, Stand 26.10.2026)
    for (const id of NEUE_FASSUNG) expect(VORLAGEN_GEPRUEFT[id]!.weitere?.map((x) => [x.stand, x.rolle]), id).toEqual([["2026-10-26", VORLAGEN_GEPRUEFT[id]!.rolle]]);
    for (const id of Object.keys(VORLAGEN_GEPRUEFT)) if (id !== "hygieneplan" && id !== "rechnung" && !NEUE_FASSUNG.includes(id)) expect(VORLAGEN_GEPRUEFT[id]!.weitere, id).toBeUndefined();
  });

  it("je Fassung eine eigene Prüfsumme: Beauty unterscheidet sich von der Lebensmittel-Fassung", () => {
    expect(beautyFreigabe.pruefsumme).toMatch(/^[0-9a-f]{64}$/);
    expect(beautyFreigabe.pruefsumme).not.toBe(lmTest.pruefsumme);
  });

  it("Beauty-Vorschläge gehören nicht zur Lebensmittel-Freigabe: eine Änderung dort lässt deren Prüfsumme stehen", () => {
    const beauty: Vorlage = {
      ...h,
      abschnitte: h.abschnitte.map((a) => ({ ...a, felder: a.felder.map((x) => (x.art === "liste" && x.vorschlaege ? { ...x, vorschlaege: x.vorschlaege.map((y) => (y.gruppe === "Alle Beauty-Betriebe" ? { ...y, titel: `${y.titel} (geändert)` } : y)) } : x)) })),
    };
    expect(vorlagenPruefsumme(beauty, lm)).toBe(lmTest.pruefsumme);
  });

  it("vorlageGeprueft wählt die Freigabe, deren Fassung zu den Daten passt", () => {
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, mitBeauty)).toBe(mitBeauty.hygieneplan);
    expect(vorlageGeprueft(h, { art: "beauty" }, mitBeauty)).toBe(beautyFreigabe);
    expect(vorlageGeprueft(h, {}, mitBeauty)).toBeUndefined();
    expect(vorlageGeprueft(h, undefined, mitBeauty)).toBeUndefined();
    // geprueft.ts: beide Fassungen schriftlich bestätigt (E-197) – Lebensmittel (Nachkontrolle), Beauty (Mail Runde 4)
    expect(vorlageGeprueft(h, { art: "beauty" })?.rolle).toBe("recht");
    expect(vorlageGeprueft(h, { art: "lebensmittel" })?.rolle).toBe("hygiene");
  });

  it("passt die Prüfsumme einer Fassung nicht mehr, entfällt nur deren Vermerk", () => {
    const veraltet: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, weitere: [{ ...beautyFreigabe, pruefsumme: "0".repeat(64), teilsummen: { basis: "0".repeat(24) } }] } };
    expect(vorlageGeprueft(h, { art: "beauty" }, veraltet)).toBeUndefined();
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, veraltet)).toBe(veraltet.hygieneplan);
    const geaendert: Vorlage = { ...h, grundlageFuer: (d, b) => `${h.grundlageFuer!(d, b)}${d.art === "beauty" ? " (geändert)" : ""}` };
    expect(vorlageGeprueft(geaendert, { art: "beauty" }, mitBeauty)).toBeUndefined();
    expect(vorlageGeprueft(geaendert, { art: "lebensmittel" }, mitBeauty)).toBe(mitBeauty.hygieneplan);
  });

  it("ohne schriftliche Bestätigung oder mit Stand nach der Bestätigung kein Vermerk", () => {
    const ohne: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, bestaetigt_am: null } };
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, ohne)).toBeUndefined();
    const spaeter: Record<string, VorlagenFreigabe> = { ...VORLAGEN_GEPRUEFT, hygieneplan: { ...lmTest, stand: "2026-10-24" } };
    expect(vorlageGeprueft(h, { art: "lebensmittel" }, spaeter)).toBeUndefined();
  });

  it("Vermerk in der App: Stand und Rolle der passenden Freigabe", () => {
    const x = vorlageGeprueft(h, { art: "beauty" }, mitBeauty)!;
    expect(geprueftVermerk(x.stand, x)).toBe("Vorlage fachlich durchgesehen von einem Rechtsanwalt (Stand 02.11.2026)");
  });
});

describe("Nachkontrolle Lebensmittelfachbeauftragter (23.10.2026): Ergänzungen und Hinweise 1–5", () => {
  const html = (id: string) => {
    const v = vorlageFuer(id)!;
    return dokumentHtml(v, leereDaten(v, LEERER_BETRIEB, "2026-10-23"), LEERER_BETRIEB);
  };
  it("L-085 ohne „fachlich zu prüfen“; Klarspül-Korrekturmaßnahme im Hilfetext des Monatsrasters", () => {
    expect(VERIFIZIERUNG.find((o) => o.wert === "kontrollen")!.quelle).not.toMatch(/zu prüfen/);
    const raster = vorlageFuer("haccp")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "raster_geraete")!;
    expect(raster.hilfe).toContain("unter Richtwert: Geschirr erneut spülen, Gerät vom Kundendienst prüfen lassen.");
  });
  it("Hinweis 1: Hackfleisch-Fundstellen getrennt (zugekauft Nr. 3.3.1, eigene Herstellung Nr. 3.1.3)", () => {
    const punkte = vorlageFuer("haccp")!.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "punkte");
    const vs = punkte?.art === "liste" ? (punkte.vorschlaege ?? []) : [];
    expect(vs.find((x) => x.titel === "Kühlung Hackfleisch")!.quelle).toMatch(/^Tier-LMHV Anlage 5 Kap\. II Nr\. 3\.3\.1;/);
    expect(vs.find((x) => x.titel === "Kühlung Hackfleisch – nur bei eigener Herstellung")!.quelle).toMatch(/^Tier-LMHV Anlage 5 Kap\. II Nr\. 3\.1\.3;/);
  });
  it("Hinweise 3 und 5: Überschriften der Allergenliste und der CCP-Tabelle", () => {
    expect(html("allergene")).toContain("Allergene und Zusatzstoffe in unseren Speisen und Getränken</h1>");
    expect(html("haccp")).toContain("Kritische Kontrollpunkte (CCP) und Temperaturkontrollen (GHP)</h2>");
  });
});
