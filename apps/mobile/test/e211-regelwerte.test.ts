/**
 * E-211: Regelwerte (Schwellen, Beträge, Sätze in catalog/regelwerte) haben eine eigene fachliche Prüfung. Der Vermerk einer
 * Pflicht sagt genau, was geprüft ist: verweist sie (Auslöser oder Frist) auf einen Regelwert, der in der heute oder künftig
 * geltenden Version nicht schriftlich bestätigt ist, steht der Wert mit Bezeichnung als „noch nicht fachlich bestätigt“ im
 * Vermerk – datengetrieben, ohne Codeänderung, sobald `pruefung` des Regelwerts freigegeben ist. Die Summe „Pflichten sind
 * fachlich geprüft“ gilt erst dann; store-check meldet offene Regelwerte als Startblocker (Gründer).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KATALOG } from "../src/pflichten/check";
import { offeneRegelwerte, pruefVermerk, regelwertBestaetigt, regelwertVerweise, type PruefungRoh, type RegelwertRoh } from "../src/pflichten/pruefer";
import { checkHinweis, katalogGeprueft, rechtsHinweis } from "../src/rechtshinweis";
import { T } from "../src/texte";

const WURZEL = path.resolve(__dirname, "../../..");
const AM = new Date(2026, 10, 1);
const HEUTE = "2026-11-01";
type P = { id: string; version: number; status_recht?: string; pruefung?: PruefungRoh };
const pflichten = KATALOG.pflichten as unknown as P[];
const regelwerte = (KATALOG as unknown as { regelwerte: RegelwertRoh[] }).regelwerte;
const pflicht = (id: string) => pflichten.find((p) => p.id === id)!;
const freigabe = (version: number): PruefungRoh => ({ status: "freigegeben", geprueft_von: ["steuern"], geprueft_am: "2026-11-02", geprueft_version: version, bestaetigt_am: "2026-11-02" });
const alleBestaetigt = regelwerte.map((r) => ({ ...r, pruefung: freigabe(r.version) }));

describe("E-211 Inventar: Regelwerte im Bündel und ihre Verwendung", () => {
  it("36 Regelwert-Versionen im Bündel, mit Prüfstand; keine ist bisher bestätigt", () => {
    expect(regelwerte).toHaveLength(36);
    for (const r of regelwerte) expect(r.pruefung, r.id).toBeTruthy();
    expect(regelwerte.filter(regelwertBestaetigt)).toHaveLength(0);
  });

  it("Verweise kommen aus Auslöser und Frist (z. B. Rhythmus der USt-Voranmeldung)", () => {
    expect(regelwertVerweise(pflicht("steuern.ust_voranmeldung"))).toEqual(expect.arrayContaining(["steuern.ust_va.grenze_befreiung", "steuern.ust_va.grenze_monatlich", "steuern.ustg19.grenze_vorjahr"]));
    expect(regelwertVerweise(pflicht("steuern.euer")).sort()).toEqual(["steuern.ao141.grenze_gewinn", "steuern.ao141.grenze_umsatz", "steuern.hgb241a.grenze_gewinn", "steuern.hgb241a.grenze_umsatz"]);
    expect(regelwertVerweise(pflicht("datenschutz.avv"))).toEqual([]);
  });

  it("Zahlen: 19 Pflichten verweisen auf 18 Regelwert-Versionen (E-206: Neugründer ab 2027), alle offen", () => {
    const mit = pflichten.filter((p) => offeneRegelwerte(p, regelwerte, HEUTE).length);
    expect(mit).toHaveLength(19);
    expect(new Set(mit.flatMap((p) => offeneRegelwerte(p, regelwerte, HEUTE).map((r) => `${r.id}@${r.version}`))).size).toBe(18);
    expect(pflichten.filter((p) => offeneRegelwerte(p, alleBestaetigt, HEUTE).length)).toHaveLength(0);
  });
});

describe("E-211 Vermerk einer Pflicht mit nicht bestätigtem Regelwert", () => {
  it("nennt Bezeichnung und Wert und sagt, dass er noch nicht fachlich bestätigt ist", () => {
    const p = pflicht("online.vsbg_hinweis");
    const offen = offeneRegelwerte(p, regelwerte, HEUTE);
    expect(offen.map((r) => r.id)).toEqual(["online.vsbg.schwelle_beschaeftigte"]);
    const v = pruefVermerk(p.version, p.pruefung, AM, offen)!;
    expect(v).toMatch(/^Inhalt fachlich geprüft von einem Rechtsanwalt, Stand \d\d\.\d\d\.2026\. Schwellenwert „[^“]+“ \(10\) noch nicht fachlich bestätigt\. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall\.$/);
  });

  it("mehrere Werte, Beträge in Euro; Wortlaut des Steuerberaters", () => {
    const p = pflicht("steuern.euer");
    const v = pruefVermerk(p.version, p.pruefung, AM, offeneRegelwerte(p, regelwerte, HEUTE))!;
    expect(v).toMatch(/^Fachlich durchgesehen von einem Steuerberater \(Stand \d\d\.\d\d\.2026\) – ohne Gewähr für den Einzelfall\. Schwellenwerte „/);
    expect(v).toContain("(800.000 €)");
    expect(v).toContain("(80.000 €)");
    expect(v).toMatch(/“ \(80\.000 €\) noch nicht fachlich bestätigt\.$/);
    expect(v.match(/„/g)).toHaveLength(4);
  });

  it("wechselt automatisch zum vollen Vermerk, sobald der Regelwert bestätigt ist", () => {
    const p = pflicht("online.vsbg_hinweis");
    const offen = offeneRegelwerte(p, alleBestaetigt, HEUTE);
    expect(offen).toEqual([]);
    expect(pruefVermerk(p.version, p.pruefung, AM, offen)).toBe(pruefVermerk(p.version, p.pruefung, AM));
    expect(pruefVermerk(p.version, p.pruefung, AM, offen)).not.toMatch(/noch nicht fachlich bestätigt/);
    // eine neue Version des Regelwerts hebt die Bestätigung auf (wie bei Pflichten, E-171)
    const neu = alleBestaetigt.map((r) => (r.id === "online.vsbg.schwelle_beschaeftigte" ? { ...r, version: r.version + 1 } : r));
    expect(offeneRegelwerte(p, neu, HEUTE).map((r) => r.id)).toEqual(["online.vsbg.schwelle_beschaeftigte"]);
  });

  it("ausgelaufene Versionen zählen nicht, künftige mit „ab“", () => {
    const p = { ausloeser: { feld: "x", op: ">", wert: { regelwert: "personal.minijob.grenze_monat" } } };
    const offen = offeneRegelwerte(p, regelwerte, "2027-03-01");
    expect(offen.map((r) => r.version)).toEqual([2]);
    const vorher = offeneRegelwerte(p, regelwerte, HEUTE);
    expect(vorher.map((r) => [r.version, r.ab])).toEqual([[1, null], [2, "2027-01-01"]]);
    expect(pruefVermerk(1, freigabe(1), AM, vorher)).toContain("(603 € im Monat; 633 € im Monat ab 01.01.2027)");
  });

  it("ungeprüfte Pflicht: weiterhin kein Vermerk", () => {
    expect(pruefVermerk(2, { status: "entwurf" }, AM, offeneRegelwerte(pflicht("steuern.euer"), regelwerte, HEUTE))).toBeNull();
  });

  it("die Pflicht-Details zeigen den Vermerk mit den offenen Werten (Pflichten-Check)", () => {
    const quelle = fs.readFileSync(path.join(WURZEL, "apps/mobile/src/pflichten/check.ts"), "utf8");
    expect(quelle).toMatch(/pruefVermerk: pruefVermerk\(p\.version, p\.pruefung, undefined, offeneRegelwerte\(p, REGELWERTE, stichtag\)\)/);
  });
});

describe("E-211 Summen: „fachlich geprüft“ erst mit bestätigten Regelwerten", () => {
  // E-206: drei Einträge warten auf die erneute Bestätigung – für die Summe hier als ganz geprüft angenommen
  const ganz = (p: P) => ({ ...p, pruefung: { ...p.pruefung, status: "freigegeben", geprueft_version: p.version, geprueft_am: "2026-10-26", bestaetigt_am: "2026-10-26", einschraenkung: null, offen: [] } });
  it("heute „teil“ (Einträge mit Einschränkung bzw. in Nachprüfung) – nie „alle“, solange Regelwerte offen sind", () => {
    expect(katalogGeprueft()).toBe("teil");
    expect(checkHinweis()).toBe(T.check_hinweis_teil);
    // auch ohne die Einschränkungen nicht „alle“: eigener Hinweis mit den Schwellenwerten
    expect(katalogGeprueft(pflichten.map(ganz), regelwerte, HEUTE)).toBe("werte_offen");
    expect(checkHinweis("werte_offen")).toBe(T.check_hinweis_werte);
    expect(T.check_hinweis_werte).toMatch(/einzelne Schwellenwerte noch nicht bestätigt/);
    expect(T.hinweis_pflichten_werte).toMatch(/einzelne Schwellenwerte noch nicht bestätigt/);
    expect(rechtsHinweis("pflichten").text).toBe(T.hinweis_pflichten_teil);
  });
  it("mit bestätigten Regelwerten wieder „alle“", () => {
    expect(katalogGeprueft(pflichten.map(ganz), alleBestaetigt, HEUTE)).toBe("alle");
  });
});

describe("E-211 Startblocker in store-check", () => {
  it("meldet die von Pflichten verwendeten, nicht bestätigten Regelwerte mit ID", () => {
    let aus = "";
    try {
      aus = execFileSync("node", [path.join(WURZEL, "apps/mobile/werkzeuge/store-check.mjs"), "--ios"], { cwd: path.join(WURZEL, "apps/mobile"), encoding: "utf8" });
    } catch (e) {
      aus = String((e as { stdout?: string }).stdout ?? "");
    }
    const zeile = aus.split("\n").find((z) => z.includes("Regelwerte"))!;
    expect(zeile).toMatch(/^ {2}✗ Startblocker Regelwerte: /);
    expect(zeile).toContain("18 von Pflichten verwendete Regelwert-Versionen noch nicht fachlich bestätigt");
    expect(zeile).toContain("steuern.ustg19.grenze_vorjahr@1");
    expect(zeile).toContain("online.vsbg.schwelle_beschaeftigte@1");
  }, 60_000);
});
