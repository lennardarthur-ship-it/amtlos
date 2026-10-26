/**
 * E-213: Antworten der Prüfer vom 26.10.2026 (Mails beim Gründer, im Register in unseren Worten).
 * A) Regelwerte: alle 37 Versionen bestätigt – wo eine Anmerkung „gültig ab“, Rechtsgrundlage oder Wert korrigiert, in der
 *    korrigierten Fassung (neue Version), die der Prüfer so bestätigt hat. Vergleich (> oder ≥) in den Auslösern wie vom
 *    Prüfer angegeben; § 241a HGB nur beim e. K., § 141 AO nur nach Mitteilung des Finanzamts und nicht für Freiberufler.
 *    Der Startblocker „Regelwerte“ entfällt.
 * B) Voranmeldung v7, Lohnsteuerbescheinigung v2 (Steuerberater) und Lohnsteuer-Anmeldung v7 (Rechtsanwalt) erneut bestätigt.
 * D) Lebensmittelfachbeauftragter: Rolle nur bei Lebensmittel-Einträgen, deren aktuelle Fassung er bestätigt hat, „Folgen …
 *    von einem Rechtsanwalt“ nur mit dessen Bestätigung der Folgen; eine geänderte Fassung verliert den Vermerk.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { KATALOG } from "../src/pflichten/check";
import { offeneRegelwerte, pruefVermerk, regelwertBestaetigt, regelwertText, type PruefungRoh, type RegelwertRoh } from "../src/pflichten/pruefer";

const WURZEL = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
const AM = new Date(2026, 9, 26);
type P = { id: string; version: number; ausloeser?: unknown; frist?: unknown; erklaerung?: { de: string }; pruefung?: PruefungRoh };
type R = RegelwertRoh & { gueltig_ab: string | null; rechtsgrundlage: string[]; status_recht: string; einheit: string };
const pflichten = KATALOG.pflichten as unknown as P[];
const regelwerte = (KATALOG as unknown as { regelwerte: R[] }).regelwerte;
const pflicht = (id: string) => pflichten.find((p) => p.id === id)!;
const rw = (id: string) => regelwerte.filter((r) => r.id === id);
interface Block { pruefer: string; umfang: string; nachweis: { art: string; datum: string; rolle: string; umfang: string; aufbewahrung: string }; eintraege: Record<string, { version: number; stand: string; quelle: string }> }
const REG_RW = YAML.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben-regelwerte.yaml"), "utf8")) as Block[];
const REG = YAML.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8")) as Block[];

describe("E-213 A) Regelwerte bestätigt", () => {
  it("alle 37 Regelwert-Versionen schriftlich bestätigt (Mail 26.10.2026), Rolle passt", () => {
    expect(regelwerte).toHaveLength(37);
    for (const r of regelwerte) expect(regelwertBestaetigt(r), `${r.id}@${r.version}`).toBe(true);
    for (const b of REG_RW) {
      expect(b.nachweis).toMatchObject({ art: "mail", datum: "2026-10-26", rolle: b.pruefer, aufbewahrung: "beim Gründer" });
      expect(b.nachweis.umfang).toMatch(/^Prüfliste Regelwerte Nr\. /);
    }
    const rollen = (rolle: string) => REG_RW.filter((b) => b.pruefer === rolle).reduce((n, b) => n + Object.keys(b.eintraege).length, 0);
    expect([rollen("steuern"), rollen("recht"), rollen("arbeitsschutz")]).toEqual([18, 18, 1]);
  });

  it("Startblocker weg: keine Pflicht verweist heute oder künftig auf einen nicht bestätigten Wert", () => {
    for (const heute of ["2026-10-26", "2027-01-01"]) expect(pflichten.filter((p) => offeneRegelwerte(p, regelwerte, heute).length).map((p) => p.id), heute).toEqual([]);
    const v = pruefVermerk(pflicht("steuern.euer").version, pflicht("steuern.euer").pruefung, AM, offeneRegelwerte(pflicht("steuern.euer"), regelwerte, "2026-10-26"))!;
    expect(v).not.toMatch(/noch nicht fachlich bestätigt/);
  });

  it("korrigierte Fassungen genau wie in den Anmerkungen: gültig ab, Rechtsgrundlage, Wert", () => {
    const ab = (id: string) => rw(id).map((r) => [r.version, r.gueltig_ab]);
    expect(ab("steuern.ust_va.grenze_befreiung")).toEqual([[2, "2025-01-01"]]);
    expect(ab("steuern.ust_va.grenze_monatlich")).toEqual([[2, "2025-01-01"]]);
    for (const id of ["steuern.ustg19.grenze_vorjahr", "steuern.ustg19.grenze_laufendes_jahr", "steuern.ustg19.grenze_gruendungsjahr", "steuern.aufbewahrung.belege_jahre"]) expect(ab(id), id).toEqual([[2, "2025-01-01"]]);
    for (const id of ["steuern.ao141.grenze_umsatz", "steuern.ao141.grenze_gewinn", "steuern.hgb241a.grenze_umsatz", "steuern.hgb241a.grenze_gewinn"]) expect(ab(id), id).toEqual([[2, "2024-01-01"]]);
    expect(ab("datenschutz.dsb.schwelle_personen")).toEqual([[2, "2019-11-26"]]);
    expect(ab("personal.hinschg.schwelle")).toEqual([[2, "2023-12-17"]]);
    expect(ab("personal.schwerbehinderte.schwelle_arbeitsplaetze")).toEqual([[2, "2018-01-01"]]);
    expect(ab("online.vsbg.schwelle_beschaeftigte")).toEqual([[2, "2017-02-01"]]);
    expect(ab("gesellschaft.gmbh.stammkapital_mindest")).toEqual([[2, "2002-01-01"]]);
    expect(ab("gesellschaft.ug.stammkapital_mindest")).toEqual([[2, "2008-11-01"]]);
    expect(ab("personal.entgelttransparenz.berichtspflicht_schwelle")).toEqual([[2, null]]);
    expect(rw("personal.entgelttransparenz.berichtspflicht_schwelle")[0]!.status_recht).toBe("geplant");
    expect(ab("arbeitsschutz.ersthelfer.schwelle_versicherte")).toEqual([[2, null]]);
    // GmbH: je Geschäftsanteil ein Viertel des Nennbetrags, insgesamt mindestens 12.500 € (§ 7 Abs. 2 GmbHG)
    expect(rw("gesellschaft.gmbh.mindesteinzahlung_anteil").map((r) => [r.version, r.wert, r.einheit, r.gueltig_ab])).toEqual([[2, 25, "prozent", "2008-11-01"]]);
    expect(rw("gesellschaft.gmbh.mindesteinzahlung_gesamt").map((r) => [r.version, r.wert, r.einheit, r.gueltig_ab])).toEqual([[1, 12500, "EUR", "2008-11-01"]]);
    // Mindestlohn: Rechtsgrundlage Fünfte Mindestlohnanpassungsverordnung, Werte und Zeiträume unverändert
    expect(rw("personal.mindestlohn.stunde").map((r) => [r.version, r.wert, r.gueltig_ab, r.gueltig_bis])).toEqual([[3, 13.9, "2026-01-01", "2026-12-31"], [4, 14.6, "2027-01-01", null]]);
    for (const r of rw("personal.mindestlohn.stunde")) expect(r.rechtsgrundlage).toContain("Fünfte Mindestlohnanpassungsverordnung vom 5.11.2025 (BGBl. 2025 I Nr. 268)");
  });

  it("Register: jede korrigierte Fassung trägt den Hinweis auf die Anmerkung; Werte wie vorgelegt behalten ihre Version", () => {
    const korrigiert = REG_RW.flatMap((b) => Object.entries(b.eintraege).filter(([, e]) => /korrigierte bzw\. präzisierte Fassung/.test(e.quelle)).map(([id, e]) => `${id}@${e.version}`));
    expect(korrigiert).toHaveLength(23); // Steuerberater 10, Rechtsanwalt 12 (davon ein neuer Wert), Fachkraft für Arbeitssicherheit 1
    expect(korrigiert).toEqual(expect.arrayContaining(["gesellschaft.gmbh.mindesteinzahlung_gesamt@1", "personal.mindestlohn.stunde@3", "personal.mindestlohn.stunde@4", "arbeitsschutz.ersthelfer.schwelle_versicherte@2"]));
    for (const id of ["personal.minijob.grenze_monat", "steuern.e_rechnung.grenze_vorjahresumsatz_2027", "steuern.ust_va.neugruender_monatlich_ab", "online.bfsg.kleinst_umsatz"]) for (const r of rw(id)) expect(r.version <= 2, id).toBe(true);
  });

  it("Jahreszahl ohne Tausenderpunkt (Steuerberater): 2027", () => {
    expect(regelwertText(2027, "kalenderjahr")).toBe("2027");
    expect(regelwertText(25000, "EUR")).toBe("25.000 €");
  });
});

/** Vergleiche in Auslöser und Frist: [Pflicht, Feld, Operator, Regelwert, Faktor] */
function vergleiche(o: unknown, pid: string, aus: [string, string, string, string, number | undefined][] = []) {
  if (Array.isArray(o)) o.forEach((x) => vergleiche(x, pid, aus));
  else if (o && typeof o === "object") {
    const k = o as { feld?: string; op?: string; wert?: { regelwert?: string; faktor?: number } };
    if (k.wert && typeof k.wert === "object" && typeof k.wert.regelwert === "string") aus.push([pid, k.feld!, k.op!, k.wert.regelwert, k.wert.faktor]);
    Object.values(o).forEach((x) => vergleiche(x, pid, aus));
  }
  return aus;
}

describe("E-213 A) Vergleich in den Auslösern wie vom Prüfer angegeben", () => {
  // „über“: Grenze inklusive bzw. „mehr als“ – Pflicht bei >, Gegenprobe ≤; „ab“: „mindestens“ – Pflicht bei ≥, Gegenprobe <
  const ART: Record<string, "ueber" | "ab"> = {
    "steuern.ust_va.grenze_befreiung": "ueber", "steuern.ust_va.grenze_monatlich": "ueber", "steuern.ustg19.grenze_vorjahr": "ueber",
    "steuern.ustg19.grenze_laufendes_jahr": "ueber", "steuern.ustg19.grenze_gruendungsjahr": "ueber", "steuern.ao141.grenze_umsatz": "ueber",
    "steuern.ao141.grenze_gewinn": "ueber", "steuern.hgb241a.grenze_umsatz": "ueber", "steuern.hgb241a.grenze_gewinn": "ueber",
    "steuern.e_rechnung.grenze_vorjahresumsatz_2027": "ueber", "online.vsbg.schwelle_beschaeftigte": "ueber", "online.bfsg.kleinst_umsatz": "ueber",
    "datenschutz.dsb.schwelle_personen": "ab", "online.bfsg.kleinst_beschaeftigte": "ab", "personal.hinschg.schwelle": "ab",
    "personal.schwerbehinderte.schwelle_arbeitsplaetze": "ab", "personal.entgelttransparenz.berichtspflicht_schwelle": "ab", "steuern.ust_va.neugruender_monatlich_ab": "ab",
  };
  const alle = pflichten.flatMap((p) => [...vergleiche(p.ausloeser, p.id), ...vergleiche(p.frist, p.id)]);
  it("jeder Vergleich mit einem Schwellenwert (ohne Warnfaktor) nutzt den bestätigten Operator", () => {
    expect(new Set(alle.map((v) => v[3]))).toEqual(new Set(Object.keys(ART)));
    for (const [pid, feld, op, id, faktor] of alle) {
      if (faktor !== undefined && faktor !== 1) continue; // Warnungen bei 80 % / 95 % der Kleinunternehmergrenze
      expect(ART[id] === "ueber" ? [">", "<="] : [">=", "<"], `${pid} ${feld} ${op} ${id}`).toContain(op);
    }
  });

  type K = { all?: K[]; any?: K[]; not?: K; feld?: string; op?: string; wert?: unknown };
  const pfade = (k: K, ziel: (x: K) => boolean, vorfahren: K[] = [], aus: K[][] = []): K[][] => {
    if (ziel(k)) aus.push(vorfahren);
    for (const c of [...(k.all ?? []), ...(k.any ?? []), ...(k.not ? [k.not] : [])]) pfade(c, ziel, [...vorfahren, k], aus);
    return aus;
  };
  const enthaelt = (k: K, f: (x: K) => boolean): boolean => f(k) || [...(k.all ?? []), ...(k.any ?? []), ...(k.not ? [k.not] : [])].some((c) => enthaelt(c, f));
  const nutzt = (prefix: string) => (x: K) => typeof (x.wert as { regelwert?: string })?.regelwert === "string" && (x.wert as { regelwert: string }).regelwert.startsWith(prefix);

  it("§ 241a HGB wirkt nur beim e. K. (OHG und KG sind immer buchführungspflichtig)", () => {
    const mit = pflichten.filter((p) => enthaelt(p.ausloeser as K, nutzt("steuern.hgb241a.")));
    expect(mit.map((p) => p.id).sort()).toEqual(["gesellschaft.jahresabschluss_personenhandel", "steuern.buchfuehrungspflicht", "steuern.e_bilanz", "steuern.euer"]);
    for (const p of mit) {
      for (const weg of pfade(p.ausloeser as K, nutzt("steuern.hgb241a."))) {
        expect(weg.some((a) => (a.all ?? []).some((c) => c.feld === "profil.rechtsform" && c.op === "==" && c.wert === "ek")), p.id).toBe(true);
      }
      // OHG und KG stehen ohne Schwelle im Auslöser
      expect(enthaelt(p.ausloeser as K, (x) => x.feld === "profil.rechtsform" && x.op === "in" && JSON.stringify(x.wert) === '["ohg","kg"]'), p.id).toBe(true);
    }
  });

  it("§ 141 AO: nur nach Mitteilung des Finanzamts und nicht für Freiberufler", () => {
    const mit = pflichten.filter((p) => enthaelt(p.ausloeser as K, nutzt("steuern.ao141.")));
    expect(mit.map((p) => p.id).sort()).toEqual(["steuern.buchfuehrungspflicht", "steuern.e_bilanz", "steuern.euer"]);
    for (const p of mit)
      for (const weg of pfade(p.ausloeser as K, nutzt("steuern.ao141."))) {
        const zweig = weg.find((a) => (a.all ?? []).some((c) => c.feld === "profil.steuern.buchfuehrung_mitteilung" && c.op === "==" && c.wert === true));
        expect(zweig, p.id).toBeTruthy();
        expect(enthaelt(zweig!, (x) => x.feld === "profil.taetigkeit.einordnung" && x.op === "!=" && x.wert === "freiberuf"), p.id).toBe(true);
      }
  });
});

describe("E-213 B) Pflichten erneut bestätigt", () => {
  it("Voranmeldung v7 und Lohnsteuerbescheinigung v2 (Steuerberater), Lohnsteuer-Anmeldung v7 (Rechtsanwalt), Stand 26.10.2026, ohne offene Punkte", () => {
    for (const [id, v, wer] of [["steuern.ust_voranmeldung", 7, "Steuerberater"], ["personal.lohnsteuerbescheinigung", 2, "Steuerberater"], ["personal.lohnsteuer_anmeldung", 7, "Rechtsanwalt"]] as const) {
      const p = pflicht(id);
      expect(p.version, id).toBe(v);
      expect(p.pruefung?.offen ?? [], id).toEqual([]);
      expect(pruefVermerk(p.version, p.pruefung, AM), id).toMatch(new RegExp(`von einem ${wer}.*26\\.10\\.2026`));
    }
    expect(pflicht("personal.lohnsteuerbescheinigung").erklaerung!.de).toContain("gibt es keine Lohnsteuerbescheinigung (§ 41b Abs. 6 EStG)");
    // E-215: drei Einträge nach der Empfehlung des Rechtsanwalts neu gefasst – Vermerk erst nach seiner Bestätigung (T-278)
    expect(pflichten.filter((p) => !pruefVermerk(p.version, p.pruefung, AM)).map((p) => p.id).sort()).toEqual(["datenschutz.dsb", "it_sicherheit.nis2_meldepflichten", "it_sicherheit.nis2_registrierung"]);
  });
});

describe("E-213 D) Lebensmittelfachbeauftragter – Rolle nur mit den Maßgaben", () => {
  it("Register: seine Rolle nur bei Lebensmittel-Einträgen; jeder hat die Folgen vom Rechtsanwalt bestätigt", () => {
    const NICHT = ["branche.gastro_preisverzeichnis", "branche.gastro_mehrweg", "branche.gastro_ppwr_radar", "branche.gastro_einwegkunststofffonds", "branche.gastro_schankanlage_fluessiggas"];
    const ids = [...new Set(REG.filter((b) => b.pruefer === "hygiene").flatMap((b) => Object.keys(b.eintraege)))];
    for (const id of ids) expect(id.startsWith("branche.gastro_") && !NICHT.includes(id), id).toBe(true);
    for (const p of pflichten.filter((x) => x.pruefung?.geprueft_von?.includes("hygiene"))) {
      expect(REG.some((b) => b.pruefer === "recht" && b.umfang === "sanktion" && ["mail", "blatt", "bericht"].includes(b.nachweis.art) && p.id in b.eintraege), p.id).toBe(true);
      expect(pruefVermerk(p.version, p.pruefung, AM), p.id).toMatch(/^Inhalt fachlich geprüft von einem Lebensmittelfachbeauftragten, die Folgen bei Verstoß von einem Rechtsanwalt, Stand /);
    }
  });

  it("geänderte Fassung verliert den Vermerk bis zur erneuten Prüfung – Inhalt geändert oder nur die Folgen geändert (anwenden.py)", () => {
    const skript = `
import copy, json, sys
sys.path.insert(0, "docs/freigabe-katalog")
import anwenden as a
aus = []
for pfad, text, d in a.alle():
    if a.gebiet(d) != "lebensmittel":
        continue
    inhalt = copy.deepcopy(d); inhalt["version"] += 1; inhalt["erklaerung"] = {"de": d["erklaerung"]["de"] + " Geändert."}
    folgen = copy.deepcopy(d); folgen["version"] += 1; folgen["sanktion"] = dict(d["sanktion"], text={"de": d["sanktion"]["text"]["de"] + " Geändert."})
    notiz = copy.deepcopy(d); notiz["version"] += 1; notiz["fachlich_zu_pruefen"] = list(d.get("fachlich_zu_pruefen") or []) + ["Notiz"]
    aus.append([d["id"], a.auswerten(pfad, d)[0], a.auswerten(pfad, inhalt)[0], a.auswerten(pfad, folgen)[0], a.auswerten(pfad, notiz)[0]])
print(json.dumps(aus))
`;
    const r = spawnSync("python3", ["-c", skript], { cwd: WURZEL, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    expect(r.status, r.stderr).toBe(0);
    const zeilen = JSON.parse(r.stdout.trim().split("\n").pop()!) as string[][];
    expect(zeilen).toHaveLength(14);
    for (const [id, heute, inhalt, folgen, notiz] of zeilen) {
      expect(heute, id).toBe("freigegeben");
      expect(inhalt, `${id}: Inhalt geändert`).not.toBe("freigegeben");
      expect(folgen, `${id}: nur Folgen geändert`).not.toBe("freigegeben");
      // eine Notiz ohne Wirkung auf Inhalt und Folgen ändert nichts am Vermerk (wie bisher)
      expect(notiz, id).toBe("freigegeben");
    }
  });
});
