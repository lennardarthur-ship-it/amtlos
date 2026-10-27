/**
 * E-197 (ersetzt die Unterschriftsregel aus E-196): Der Prüfvermerk im Katalog folgt genau den schriftlich bestätigten
 * Freigaben (docs/freigabe-katalog/freigaben.yaml, `nachweis` mit Art, Datum, Rolle, Umfang und Aufbewahrung): Bestätigung
 * per Mail, vom Prüfer ausgefüllte Datei bzw. unterschriebenes Blatt (auf Wunsch des Gründers am 25.10.2026 entfernt) oder
 * Bericht. E-198/E-199: Keine dieser Unterlagen liegt im Repository – der Gründer bewahrt sie auf; das Register ist der
 * einzige Nachweis im Projekt (ohne Dateiverweis, ohne Zitat, ohne Namen). Je Rolle zeigen genau
 * die Einträge einen Vermerk, die ein bestätigter Block mit dieser Version (bei Teil-Umfängen: gültig nach anwenden.py)
 * abdeckt – eine Version, die nach der Bestätigung entstanden ist, zeigt keinen; das Datum im Vermerk liegt nie nach der
 * Bestätigung; keine Person wird genannt.
 */
import { createHash } from "node:crypto";
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
  nachweis: { art: string; datum: string; rolle: string; umfang: string; aufbewahrung: string };
  eintraege: Record<string, { version: number; stand: string; quelle: string; einschraenkung?: string; zitat?: string }>;
}
const REGISTER = YAML.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8")) as Block[];
const ZAEHLT = ["mail", "blatt", "bericht"];
const bestaetigt = (b: Block) => ZAEHLT.includes(b.nachweis.art);
/** E-199: Verweis auf eine Unterlage der Prüfer (Datei, Ordner) – das Register nennt keine */
const DATEIVERWEIS = /docs\/pruefberichte|versand-|\.(xlsx|xls|pdf|eml|msg|jpe?g|png|txt|md|docx?)\b/i;
/** E-199: Namen der Prüfer, abgeglichen über SHA-256 (docs/freigabe-katalog/namen-sha256.json) – ohne Klartext im Test */
const NAMEN = JSON.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/namen-sha256.json"), "utf8")) as { einzeln: string[]; paare: string[]; mehrdeutig: string[] };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const nenntName = (text: string) => {
  const w = text.toLowerCase().match(/[a-zäöüß]+/g) ?? [];
  return w.some((x) => NAMEN.einzeln.includes(sha(x)) || NAMEN.mehrdeutig.includes(sha(x))) || w.slice(1).some((x, i) => NAMEN.paare.includes(sha(`${w[i]} ${x}`)));
};
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
  it("Register: Rollen statt Namen, Nachweis je Block ohne Unterlage (E-198, E-199), Stand nie nach der Bestätigung", () => {
    for (const b of REGISTER) {
      expect(ROLLEN).toContain(b.pruefer);
      expect([...ZAEHLT, "ersetzt", "offen"], b.pruefer).toContain(b.nachweis.art);
      expect(b as object).not.toHaveProperty("unterschrift");
      // Nachweis: Art, Datum, Rolle, Umfang, Aufbewahrung – keine Datei, kein Zitat (E-198, E-199)
      expect(Object.keys(b.nachweis).sort(), b.pruefer).toEqual(["art", "aufbewahrung", "datum", "rolle", "umfang"]);
      expect(b.nachweis.rolle, b.pruefer).toBe(b.pruefer);
      expect(String(b.nachweis.datum), b.pruefer).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(b.nachweis.umfang, b.pruefer).toBeTruthy();
      expect(b.nachweis.aufbewahrung, b.pruefer).toBe("beim Gründer");
      expect(b.nachweis.umfang, b.pruefer).not.toMatch(DATEIVERWEIS);
      for (const [id, e] of Object.entries(b.eintraege)) {
        expect(Object.keys(e).every((k) => ["version", "stand", "quelle", "einschraenkung"].includes(k)), `${b.pruefer} ${id}`).toBe(true);
        expect(String(e.quelle), `${b.pruefer} ${id}`).not.toMatch(DATEIVERWEIS);
        expect(String(e.stand) <= String(b.nachweis.datum), `${b.pruefer} ${id}`).toBe(true);
        // bei Bestätigung per Mail ist der Stand das Datum der Mail
        if (b.nachweis.art === "mail") expect(String(e.stand), `${b.pruefer} ${id}`).toBe(String(b.nachweis.datum));
      }
    }
    // E-199: keine Prüfunterlagen im Repository
    expect(fs.existsSync(path.join(WURZEL, "docs/pruefberichte"))).toBe(false);
    expect(nenntName(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8"))).toBe(false);
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

  it("je Rolle so viele Einträge mit Vermerk wie vor E-196 – E-201: dazu Künstlersozialabgabe (Rechtsanwalt) und Lohnsteuerbescheinigung (Steuerberater)", () => {
    const zahl = (r: string) => pflichten.filter((p) => pruefVermerk(p.version, p.pruefung, AM) && p.pruefung!.geprueft_von!.includes(r)).length;
    // E-206: Lohnsteuer-Anmeldung (Rechtsanwalt), Lohnsteuerbescheinigung und Umsatzsteuer-Voranmeldung (Steuerberater) neu vorzulegen
    // – E-213: alle drei am 26.10.2026 erneut bestätigt
    // E-215: Datenschutzbeauftragter, NIS2-Registrierung und -Meldepflichten (Rechtsanwalt) neu vorzulegen (T-278)
    // E-216: Umsatzsteuer-Voranmeldung v8 (Satz zur Dauerfristverlängerung) wartet auf den Steuerberater (T-282) – 35 → 34
    // E-217: Voranmeldung v9 (Steuerberater) sowie Datenschutzbeauftragter und NIS2 (Rechtsanwalt) am 27.10.2026 bestätigt – 166/35
    // E-222: Kleinunternehmer-Warnungen 80 %/95 % v7 warten auf den Steuerberater (T-310) – 35 → 33
    // E-226: Warnungen bestätigt (Steuerberater 35), zwei neue Einträge in der Fassung des Rechtsanwalts freigegeben (166 → 168)
    expect(ROLLEN.map(zahl)).toEqual([168, 35, 27, 14]);
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
    // E-201: die offenen Punkte haben die Prüfer am 26.10.2026 erneut geprüft und als erledigt bestätigt – kein „teilweise“ mehr
    expect(v("steuern.e_rechnung_versand_2027")).toBe("Fachlich durchgesehen von einem Steuerberater (Stand 26.10.2026) – ohne Gewähr für den Einzelfall.");
    expect(v("personal.arbeitszeit_neuregelung")).toMatch(/^Inhalt fachlich geprüft von einem Rechtsanwalt, Stand 26\.10\.2026\./);
    expect(v("datenschutz.dsb_streichung")).toMatch(/^Inhalt fachlich geprüft von einem Rechtsanwalt, Stand 26\.10\.2026\./);
    // arbeitsmedizinische Vorsorge: Kern ist ärztlich – Vermerk nur mit der Einschränkung (vom Rechtsanwalt bestätigt)
    expect(v("arbeitsschutz.arbeitsmedizinische_vorsorge")).toMatch(/^Inhalt fachlich geprüft von einem Rechtsanwalt \(nur die rechtliche Seite, ohne medizinische Inhalte\), Stand 26\.10\.2026/);
    for (const p of pflichten) expect(p.pruefung?.offen ?? [], p.id).toEqual([]);
  });

  it("kein Vermerk und kein Katalogfeld nennt eine Person", () => {
    for (const p of pflichten) {
      expect(nenntName(JSON.stringify(p.pruefung ?? {})), p.id).toBe(false);
      const t = pruefVermerk(p.version, p.pruefung, AM);
      if (t) {
        expect(nenntName(t), p.id).toBe(false);
        expect(t, p.id).not.toMatch(/Dr\./);
      }
    }
  });
});
