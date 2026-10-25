/**
 * E-196: Der Prüfvermerk im Katalog folgt genau den unterschriebenen Freigaben (docs/freigabe-katalog/freigaben.yaml):
 * je Rolle zeigen genau die Einträge einen Vermerk, die ein unterschriebener Block mit dieser Version (bei Teil-Umfängen:
 * gültig nach anwenden.py) abdeckt; das Datum im Vermerk liegt nie nach der Unterschrift; keine Person wird genannt.
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
  unterschrieben_am: string | null;
  unterschrift: string | null;
  eintraege: Record<string, { version: number; stand: string; einschraenkung?: string }>;
}
const REGISTER = YAML.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8")) as Block[];
const unterschrieben = (b: Block) => Boolean(b.unterschrieben_am && b.unterschrift && fs.existsSync(path.join(WURZEL, b.unterschrift)));
const pflichten = KATALOG.pflichten as unknown as { id: string; version: number; pruefung?: PruefungRoh }[];
const AM = new Date(2026, 9, 26);
const ROLLEN = ["recht", "steuern", "arbeitsschutz", "hygiene"];

/** Einträge, die ein unterschriebener Block der Rolle (und ggf. des Umfangs) für die aktuelle Version abdeckt, mit Tag der Unterschrift. */
function signiert(rolle: string, umfang?: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of REGISTER.filter((x) => x.pruefer === rolle && (!umfang || x.umfang === umfang) && unterschrieben(x)))
    for (const [id, e] of Object.entries(b.eintraege)) {
      const p = pflichten.find((x) => x.id === id);
      if (!p) continue;
      // „alles“: genau diese Version; Teil-Umfänge können ältere Versionen abdecken (Vergleich mit der git-Historie in
      // anwenden.py, `pnpm katalog:pruefen` bzw. `anwenden.py --pruefen`)
      if (b.umfang === "alles" ? e.version === p.version : e.version <= p.version) if (!m.has(id) || m.get(id)! < b.unterschrieben_am!) m.set(id, b.unterschrieben_am!);
    }
  return m;
}
/** Nötige Freigaben eines Eintrags laut Register: Rollen und Umfänge der vollständigen Blöcke, in denen er steht. */
function noetig(id: string): [string, string][] {
  const s = new Set<string>();
  for (const b of REGISTER as (Block & { felder_fehlen?: string[] })[]) if (id in b.eintraege && (b.umfang === "sanktion" || !(b.felder_fehlen ?? []).length)) s.add(`${b.pruefer}|${b.umfang}`);
  return [...s].map((x) => x.split("|") as [string, string]);
}

describe("E-196: Prüfvermerk nur aus unterschriebenen Freigaben", () => {
  it("Register: Rollen statt Namen, Stand nie nach der Unterschrift, Beleg der Unterschrift liegt vor", () => {
    for (const b of REGISTER) {
      expect(ROLLEN).toContain(b.pruefer);
      if (b.unterschrieben_am) expect(fs.existsSync(path.join(WURZEL, b.unterschrift!)), b.unterschrift!).toBe(true);
      for (const [id, e] of Object.entries(b.eintraege)) if (b.unterschrieben_am) expect(String(e.stand) <= b.unterschrieben_am, `${b.pruefer} ${id}`).toBe(true);
    }
  });

  it("je Rolle: Einträge mit Vermerk = unterschriebene Einträge (bei geteilter Prüfung: beide Rollen unterschrieben)", () => {
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

  it("das Datum im Vermerk liegt nie nach der Unterschrift", () => {
    for (const p of pflichten.filter((x) => istGeprueft(x.version, x.pruefung))) {
      const pr = p.pruefung!;
      expect(pr.geprueft_am! <= pr.unterschrieben_am!, p.id).toBe(true);
      for (const r of pr.geprueft_von ?? []) expect(pr.geprueft_am! <= signiert(r).get(p.id)!, `${p.id} ${r}`).toBe(true);
    }
  });

  it("Steuerberater: 28 Einträge mit Vermerk – die sechs ohne unterschriebenes Blatt zeigen keinen", () => {
    const st = pflichten.filter((p) => pruefVermerk(p.version, p.pruefung, AM) && p.pruefung!.geprueft_von!.includes("steuern"));
    expect(st).toHaveLength(28);
    for (const id of ["steuern.buchfuehrungspflicht", "steuern.e_bilanz", "steuern.oss_erklaerung", "steuern.euer", "steuern.feststellungserklaerung", "gesellschaft.jahresabschluss_personenhandel"]) {
      const p = pflichten.find((x) => x.id === id)!;
      expect(pruefVermerk(p.version, p.pruefung, AM), id).toBeNull();
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
    // arbeitsmedizinische Vorsorge: Kern ist ärztlich – ohne unterschriebene Fassung (v6) kein Vermerk
    const amv = pflichten.find((x) => x.id === "arbeitsschutz.arbeitsmedizinische_vorsorge")!;
    expect(pruefVermerk(amv.version, amv.pruefung, AM)).toBeNull();
  });

  it("kein Vermerk und kein Katalogfeld nennt eine Person", () => {
    for (const p of pflichten) {
      expect(JSON.stringify(p.pruefung ?? {}), p.id).not.toMatch(/weber|busch|heckler|\bkoch\b|\bbaum\b/i);
      const t = pruefVermerk(p.version, p.pruefung, AM);
      if (t) expect(t, p.id).not.toMatch(/weber|busch|heckler|koch|baum|Dr\./i);
    }
  });
});
