/**
 * E-197 (ersetzt die Unterschriftsregel aus E-196): Der Prüfvermerk im Katalog folgt genau den schriftlich bestätigten
 * Freigaben (docs/freigabe-katalog/freigaben.yaml, `nachweis` mit Art, Datum, Rolle und Umfang): Bestätigung per Mail
 * (E-198: die Mail liegt beim Gründer, nicht im Repository), vom Prüfer ausgefüllte Datei oder ein unterschriebenes Blatt,
 * das auf Wunsch des Gründers am 25.10.2026 aus dem Projekt entfernt wurde. Je Rolle zeigen genau
 * die Einträge einen Vermerk, die ein bestätigter Block mit dieser Version (bei Teil-Umfängen: gültig nach anwenden.py)
 * abdeckt – eine Version, die nach der Bestätigung entstanden ist, zeigt keinen; das Datum im Vermerk liegt nie nach der
 * Bestätigung; keine Person wird genannt.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { KATALOG } from "../src/pflichten/check";
import { istGeprueft, pruefVermerk, type PruefungRoh } from "../src/pflichten/pruefer";

const WURZEL = path.resolve(__dirname, "../../..");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
interface Block {
  pruefer: string;
  umfang: "alles" | "sanktion" | "ohne_sanktion";
  nachweis: { art: string; datum: string; rolle: string; umfang: string; aufbewahrung?: string; blatt?: string };
  eintraege: Record<string, { version: number; stand: string; quelle: string; einschraenkung?: string; zitat?: string }>;
}
const REGISTER = YAML.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8")) as Block[];
const ZAEHLT = ["mail", "unterschrift_entfernt", "blatt"];
const bestaetigt = (b: Block) => ZAEHLT.includes(b.nachweis.art) && (!b.nachweis.blatt || fs.existsSync(path.join(WURZEL, b.nachweis.blatt)));
const pflichten = KATALOG.pflichten as unknown as { id: string; version: number; pruefung?: PruefungRoh }[];
const AM = new Date(2026, 9, 26);
const ROLLEN = ["recht", "steuern", "arbeitsschutz", "hygiene"];

/** Einträge, die ein bestätigter Block der Rolle (und ggf. des Umfangs) für die aktuelle Version abdeckt, mit Tag der Bestätigung. */
function signiert(rolle: string, umfang?: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of REGISTER.filter((x) => x.pruefer === rolle && (!umfang || x.umfang === umfang) && bestaetigt(x)))
    for (const [id, e] of Object.entries(b.eintraege)) {
      const p = pflichten.find((x) => x.id === id);
      if (!p) continue;
      // „alles“: genau diese Version; Teil-Umfänge können ältere Versionen abdecken (Vergleich mit der git-Historie in
      // anwenden.py, `pnpm katalog:pruefen` bzw. `anwenden.py --pruefen`)
      if (b.umfang === "alles" ? e.version === p.version : e.version <= p.version) if (!m.has(id) || m.get(id)! < String(b.nachweis.datum)) m.set(id, String(b.nachweis.datum));
    }
  return m;
}
/** Nötige Freigaben eines Eintrags laut Register: Rollen und Umfänge der vollständigen Blöcke, in denen er steht. */
function noetig(id: string): [string, string][] {
  const s = new Set<string>();
  for (const b of REGISTER as (Block & { felder_fehlen?: string[] })[]) if (id in b.eintraege && (b.umfang === "sanktion" || !(b.felder_fehlen ?? []).length)) s.add(`${b.pruefer}|${b.umfang}`);
  return [...s].map((x) => x.split("|") as [string, string]);
}

describe("E-197: Prüfvermerk nur aus schriftlich bestätigten Freigaben", () => {
  it("Register: Rollen statt Namen, Nachweis je Block ohne Mail (E-198), Stand nie nach der Bestätigung, keine Unterschriftsdateien", () => {
    const MAIL = /(\.eml|\.msg|mail[^/]*\.txt)$/i;
    for (const b of REGISTER) {
      expect(ROLLEN).toContain(b.pruefer);
      expect([...ZAEHLT, "ersetzt", "offen"], b.pruefer).toContain(b.nachweis.art);
      expect(b as object).not.toHaveProperty("unterschrift");
      // Nachweis: Art, Datum, Rolle, Umfang – keine Mail-Datei, kein Zitat (E-198)
      expect(Object.keys(b.nachweis).every((k) => ["art", "datum", "rolle", "umfang", "aufbewahrung", "blatt"].includes(k)), `${b.pruefer}: ${Object.keys(b.nachweis)}`).toBe(true);
      expect(b.nachweis.rolle, b.pruefer).toBe(b.pruefer);
      expect(String(b.nachweis.datum), b.pruefer).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(b.nachweis.umfang, b.pruefer).toBeTruthy();
      if (b.nachweis.art === "mail" || b.nachweis.art === "unterschrift_entfernt") expect(b.nachweis.aufbewahrung, b.pruefer).toBe("beim Gründer");
      if (b.nachweis.blatt) {
        expect(fs.existsSync(path.join(WURZEL, b.nachweis.blatt)), b.nachweis.blatt).toBe(true);
        expect(b.nachweis.blatt).not.toMatch(MAIL);
      }
      if (b.nachweis.art === "unterschrift_entfernt") expect(b.nachweis.umfang, b.pruefer).toMatch(/aus dem Projekt entfernt/);
      for (const [id, e] of Object.entries(b.eintraege)) {
        expect(e, `${b.pruefer} ${id}`).not.toHaveProperty("zitat");
        expect(String(e.quelle), `${b.pruefer} ${id}`).not.toMatch(MAIL);
        expect(String(e.stand) <= String(b.nachweis.datum), `${b.pruefer} ${id}`).toBe(true);
        // bei Bestätigung per Mail ist der Stand das Datum der Mail
        if (b.nachweis.art === "mail") expect(String(e.stand), `${b.pruefer} ${id}`).toBe(String(b.nachweis.datum));
      }
    }
    expect(fs.readdirSync(path.join(WURZEL, "docs/pruefberichte")).filter((d) => /\.(jpe?g|png|heic|tiff?)$/i.test(d))).toEqual([]);
  });

  it("je Rolle: Einträge mit Vermerk = bestätigte Einträge (bei geteilter Prüfung: beide Rollen bestätigt)", () => {
    for (const rolle of ROLLEN) {
      const mitVermerk = pflichten.filter((p) => pruefVermerk(p.version, p.pruefung, AM) && (p.pruefung!.geprueft_von ?? []).includes(rolle)).map((p) => p.id).sort();
      const soll = pflichten
        .filter((p) => {
          const n = noetig(p.id);
          return n.some(([r]) => r === rolle) && n.every(([r, u]) => signiert(r, u).has(p.id));
        })
        .map((p) => p.id)
        .sort();
      expect(mitVermerk, rolle).toEqual(soll);
    }
  });

  it("das Datum im Vermerk liegt nie nach der Bestätigung", () => {
    for (const p of pflichten.filter((x) => istGeprueft(x.version, x.pruefung))) {
      const pr = p.pruefung!;
      expect(pr.geprueft_am! <= pr.bestaetigt_am!, p.id).toBe(true);
      for (const r of pr.geprueft_von ?? []) expect(pr.geprueft_am! <= signiert(r).get(p.id)!, `${p.id} ${r}`).toBe(true);
    }
  });

  it("je Rolle so viele Einträge mit Vermerk wie vor E-196 (Rechtsanwalt 165, Steuerberater 34, Sifa 27, Lebensmittel 14)", () => {
    const zahl = (r: string) => pflichten.filter((p) => pruefVermerk(p.version, p.pruefung, AM) && p.pruefung!.geprueft_von!.includes(r)).length;
    expect(ROLLEN.map(zahl)).toEqual([165, 34, 27, 14]);
    // die 17 von E-196 zurückgestuften Einträge zeigen den Vermerk wieder – ihre Version ist die bestätigte
    for (const id of ["steuern.buchfuehrungspflicht", "steuern.e_bilanz", "steuern.oss_erklaerung", "steuern.euer", "steuern.feststellungserklaerung", "gesellschaft.jahresabschluss_personenhandel",
      "arbeitsschutz.arbeitsmedizinische_vorsorge", "gesellschaft.gesellschaftsvertrag_notar", "gesellschaft.handelsregister_anmeldung", "gesellschaft.transparenzregister", "gesellschaft.geschaeftsbriefe_pflichtangaben",
      "gesellschaft.gesellschaftsvertrag_ohg_kg", "branche.gastro_ifsg_bescheinigung_selbst", "branche.gastro_zusatzstoffe", "arbeitsschutz.dguv_v3", "arbeitsschutz.flucht_rettungsplan", "branche.gastro_schankanlage_fluessiggas"]) {
      const p = pflichten.find((x) => x.id === id)!;
      expect(pruefVermerk(p.version, p.pruefung, AM), id).not.toBeNull();
    }
  });

  it("eine Version, die nach der Bestätigung entstanden ist, zeigt keinen Vermerk", () => {
    for (const p of pflichten) {
      const p2 = { ...p, version: p.version + 1 };
      expect(pruefVermerk(p2.version, p.pruefung, AM), p.id).toBeNull();
    }
  });

  it("Einschränkung und offene Punkte stehen im Vermerk", () => {
    const v = (id: string) => {
      const p = pflichten.find((x) => x.id === id)!;
      return pruefVermerk(p.version, p.pruefung, AM)!;
    };
    expect(v("arbeitsschutz.biostoffe")).toContain("von einer Fachkraft für Arbeitssicherheit (ohne arbeitsmedizinische Angaben)");
    expect(v("arbeitsschutz.laerm")).toContain("(ohne arbeitsmedizinische Angaben)");
    expect(v("steuern.e_rechnung_versand_2027")).toMatch(/^Teilweise fachlich durchgesehen von einem Steuerberater \(Stand 23\.10\.2026; noch offen: /);
    expect(v("personal.arbeitszeit_neuregelung")).toMatch(/^Inhalt teilweise fachlich geprüft von einem Rechtsanwalt/);
    // arbeitsmedizinische Vorsorge: Kern ist ärztlich – Vermerk nur mit der Einschränkung und als „teilweise“ (Vorsorgefristen offen)
    expect(v("arbeitsschutz.arbeitsmedizinische_vorsorge")).toMatch(/^Inhalt teilweise fachlich geprüft von einem Rechtsanwalt \(nur die rechtliche Seite, ohne medizinische Inhalte\)/);
  });

  it("kein Vermerk und kein Katalogfeld nennt eine Person", () => {
    for (const p of pflichten) {
      expect(JSON.stringify(p.pruefung ?? {}), p.id).not.toMatch(/weber|busch|heckler|\bkoch\b|\bbaum\b/i);
      const t = pruefVermerk(p.version, p.pruefung, AM);
      if (t) expect(t, p.id).not.toMatch(/weber|busch|heckler|koch|baum|Dr\./i);
    }
  });
});
