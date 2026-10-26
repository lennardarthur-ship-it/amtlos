/**
 * E-199 (Gründerentscheidung 26.10.2026: „In der Datei sollen solche Sachen gar nicht drin sein“): Das Repository enthält
 * keine Unterlagen von oder für die Prüfer – keine Berichte, ausgefüllten Dateien, Bestätigungs- oder Nachtragsblätter,
 * Prüfpakete oder Nachprüflisten – und keinen Namen eines Prüfers. Die Unterlagen bewahrt der Gründer auf. Einziger
 * Nachweis im Projekt sind das Register docs/freigabe-katalog/freigaben.yaml und packages/fachlogik/src/dokumente/geprueft.ts
 * (Rolle, Datum, Umfang in unseren Worten, Art, `aufbewahrung: beim Gründer`). Die Werkzeuge, die Unterlagen erzeugen,
 * schreiben nur in ein Ziel außerhalb des Repositorys. Seit 26.10.2026 liegen die meisten davon (Freigabe- und Abgleich-
 * Dateien, Bestätigungsblätter, Nachprüflisten, Prüfpakete, Prüfmappen) im privaten Repository amtlos-intern; dort prüft
 * `python3 pruefen.py` Namen, Unterlagen und die Ablehnung von Zielen in beiden Repositorys. In amtlos bleiben das
 * Register (freigaben.yaml, offene-punkte.yaml, namen-sha256.json, anwenden.py) und die Werkzeuge, die Code brauchen.
 *
 * Namen stehen hier nicht im Klartext: Abgeglichen wird über SHA-256 der Wörter (docs/freigabe-katalog/namen-sha256.json).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = path.resolve(__dirname, "../../..");
const dateien = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: WURZEL, encoding: "utf8" })
  .split("\n")
  .filter((d) => d && !d.includes("node_modules") && fs.existsSync(path.join(WURZEL, d)) && fs.statSync(path.join(WURZEL, d)).isFile());
const NAMEN = JSON.parse(fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/namen-sha256.json"), "utf8")) as { einzeln: string[]; paare: string[]; mehrdeutig: string[] };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** Wörter (Kleinbuchstaben) und Wortpaare eines Textes, deren SHA-256 zu einem Namen gehört */
function namen(text: string, streng: boolean): number {
  const w = [...new Set(text.toLowerCase().match(/[a-zäöüß]+/g) ?? [])];
  const einzeln = new Set(streng ? [...NAMEN.einzeln, ...NAMEN.mehrdeutig] : NAMEN.einzeln);
  const paare = new Set(NAMEN.paare);
  const alle = text.toLowerCase().match(/[a-zäöüß]+/g) ?? [];
  return w.filter((x) => einzeln.has(sha(x))).length + alle.slice(1).filter((x, i) => paare.has(sha(`${alle[i]} ${x}`))).length;
}
/** Texte zur Prüfung: hier zählen auch Namen, die zugleich gewöhnliche Wörter sind */
const PRUEFTEXTE = ["docs/freigabe-katalog/freigaben.yaml", "docs/freigabe-katalog/offene-punkte.yaml", "packages/fachlogik/src/dokumente/geprueft.ts", "apps/mobile/src/pflichten/pruefer.ts"];
const istBinaer = (b: Buffer) => b.subarray(0, 8000).includes(0);

describe("E-199: keine Prüfunterlagen und keine Namen im Repository", () => {
  it("keine Berichte, ausgefüllten Dateien, Pakete oder Bestätigungsblätter der Prüfer", () => {
    expect(fs.existsSync(path.join(WURZEL, "docs/pruefberichte"))).toBe(false);
    expect(fs.readdirSync(path.join(WURZEL, "docs/freigabe-katalog")).filter((d) => d.startsWith("versand"))).toEqual([]);
    // in docs/freigabe-katalog nur noch das Register und anwenden.py – Werkzeuge für Prüfunterlagen liegen in amtlos-intern
    expect(fs.readdirSync(path.join(WURZEL, "docs/freigabe-katalog")).filter((d) => d !== "__pycache__").sort()).toEqual(["anwenden.py", "freigaben.yaml", "namen-sha256.json", "offene-punkte.yaml"]);
    expect(fs.existsSync(path.join(WURZEL, "docs/freigabe-vorlagen"))).toBe(false);
    // Excel, PDF, Mails und Office-Dateien gibt es im ganzen Repository nicht, Bilder unter docs/ (Scans) auch nicht
    expect(dateien.filter((d) => /\.(xlsx|xls|xlsm|pdf|eml|msg|mbox|docx?|odt|ods)$/i.test(d))).toEqual([]);
    expect(dateien.filter((d) => d.startsWith("docs/") && /\.(jpe?g|png|heic|tiff?)$/i.test(d))).toEqual([]);
  });

  it("kein Name eines Prüfers in einer Datei des Repositorys (Text und Binärdateien)", () => {
    const treffer: string[] = [];
    for (const d of dateien) {
      const roh = fs.readFileSync(path.join(WURZEL, d));
      // Binärdateien (Bilder, Schriften) als Latin-1 – Namen in Metadaten fielen auf
      const text = istBinaer(roh) ? roh.toString("latin1") : roh.toString("utf8");
      if (namen(text, PRUEFTEXTE.includes(d))) treffer.push(d);
    }
    expect(treffer).toEqual([]);
  });

  it("Register und geprueft.ts sind der einzige Nachweis: Rolle, Datum, Umfang, Art, Aufbewahrung beim Gründer – ohne Dateiverweis", () => {
    const reg = fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8");
    const ts = fs.readFileSync(path.join(WURZEL, "packages/fachlogik/src/dokumente/geprueft.ts"), "utf8");
    const verweis = /docs\/pruefberichte|versand-|\.(xlsx|xls|pdf|eml|msg|jpe?g)\b/i;
    expect(reg).not.toMatch(verweis);
    expect(ts).not.toMatch(verweis);
    expect(reg).not.toMatch(/^\s+(blatt|zitat|mail|beleg):/m);
    expect(ts).not.toMatch(/\b(blatt|beleg|zitat|nachweis_text): "/);
    // jede Bestätigung mit Aufbewahrung beim Gründer
    expect(reg.match(/^ {4}aufbewahrung: beim Gründer$/gm)!.length).toBe(reg.match(/^ {2}nachweis:$/gm)!.length);
    expect(ts.match(/aufbewahrung: "beim Gründer" \}/g)!.length).toBe(ts.match(/nachweis: \{ art: "/g)!.length);
  });

  it("Werkzeuge für Prüfunterlagen schreiben nur außerhalb des Repositorys", () => {
    const ziel = path.join(WURZEL, "docs", "e199-test-ziel");
    // die übrigen Werkzeuge (Freigabe-Dateien, Prüfpakete, Prüfmappen) prüft amtlos-intern: pruefen.py
    const aufrufe: [string, string[]][] = [["node", ["apps/mobile/werkzeuge/nachpruef-pdfs.mjs", ziel]]];
    for (const [prog, args] of aufrufe) {
      const r = spawnSync(prog, args, { cwd: WURZEL, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
      expect(r.status, args[0]).not.toBe(0);
      expect(r.stderr, args[0]).toContain("liegt im Repository");
    }
    expect(fs.existsSync(ziel)).toBe(false);
    // die Ersetzungen Name → Rolle für den Prüfsummen-Abgleich kommen aus einer Datei außerhalb des Repositorys
    const r = spawnSync("python3", ["packages/fachlogik/werkzeuge/pruefsummen-abgleich.py", "/dev/null", "--namen", "docs/freigabe-katalog/namen-sha256.json"], { cwd: WURZEL, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    expect(r.stderr).toContain("liegt im Repository");
  });
});
