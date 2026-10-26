/**
 * E-198 (Gründerentscheidung 26.10.2026: „Du sollst keine E-Mails speichern.“): Das Repository enthält keine Mails – weder
 * die Mails der Prüfer (docs/pruefberichte) noch Entwürfe unserer Mails in den Versandordnern. Bestätigungen per Mail
 * bewahrt der Gründer auf; Register und Vorlagen-Freigaben nennen nur Art, Datum, Rolle und Umfang (in unseren Worten).
 * Die Werkzeuge schreiben E-Mail-Texte nicht ins Repository (Standardausgabe oder Ordner außerhalb).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = path.resolve(__dirname, "../../..");
const MAILNAME = /(\.eml|\.msg|\.mbox|mail[^/]*\.txt)$/i;
/** Kopfzeilen einer Mail: Betreff und Absender, Empfänger oder Anhänge */
const istMail = (text: string) => /^(Betreff|Subject):/m.test(text) && /^(Von|From|An|To|Anh(ä|ae)nge?|Date|Datum):/m.test(text);
const dateien = execFileSync("git", ["ls-files"], { cwd: WURZEL, encoding: "utf8" })
  .split("\n")
  .filter((d) => d && !d.includes("node_modules") && fs.existsSync(path.join(WURZEL, d)));

describe("E-198: keine E-Mails im Repository", () => {
  it("docs/pruefberichte: keine .eml, keine *mail*.txt, keine Datei mit Mail-Kopfzeilen", () => {
    const pb = fs.readdirSync(path.join(WURZEL, "docs/pruefberichte"));
    expect(pb.filter((d) => MAILNAME.test(d))).toEqual([]);
    const mitKopf = pb.filter((d) => /\.(txt|md|json|html?)$/i.test(d) && istMail(fs.readFileSync(path.join(WURZEL, "docs/pruefberichte", d), "utf8").slice(0, 4000)));
    expect(mitKopf).toEqual([]);
    // was bleibt, sind Berichte, ausgefüllte Dateien und Bestätigungsblätter des Prüfers
    expect(pb.every((d) => /\.(pdf|xlsx|md|txt|json)$/i.test(d)), pb.join(", ")).toBe(true);
  });

  it("keine Entwürfe unserer Mails (E-Mail.txt) in Versandordnern oder sonst unter docs", () => {
    const docs = dateien.filter((d) => d.startsWith("docs/"));
    expect(docs.filter((d) => MAILNAME.test(d) || /(^|\/)E-Mail[^/]*\.txt$/i.test(d))).toEqual([]);
    expect(docs.filter((d) => /\.(txt|md)$/i.test(d) && istMail(fs.readFileSync(path.join(WURZEL, d), "utf8").slice(0, 4000)))).toEqual([]);
  });

  it("Werkzeuge schreiben keine E-Mail-Texte ins Repository", () => {
    for (const d of dateien.filter((x) => /^(docs\/freigabe-[^/]+|apps\/mobile\/werkzeuge|packages\/fachlogik\/werkzeuge)\/.*\.(py|mjs|sh)$/.test(x))) {
      const src = fs.readFileSync(path.join(WURZEL, d), "utf8");
      // in einen Ordner des Projekts (Versandordner, ZIEL, HIER, ROOT) – erlaubt ist nur ein Ziel außerhalb (`--mail-ziel`)
      expect(src, d).not.toMatch(/(open|writeFileSync)\((os\.)?path\.join\((ordner|ZIEL|HIER|ROOT|WURZEL)\b[^)\n]*E-Mail/);
    }
    const np = fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/nachpruefliste.py"), "utf8");
    expect(np).toContain("--mail-ziel");
    expect(np).toMatch(/liegt im Repository/);
  });

  it("Register und Vorlagen-Freigaben verweisen auf keine Mail-Datei und zitieren keine Mail", () => {
    const reg = fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8");
    expect(reg).not.toMatch(/mail[^\s/]*\.txt|\.eml\b|^\s+(zitat|mail):/m);
    expect(reg).toMatch(/aufbewahrung: beim Gründer/);
    const ts = fs.readFileSync(path.join(WURZEL, "packages/fachlogik/src/dokumente/geprueft.ts"), "utf8");
    expect(ts).not.toMatch(/mail[^"\s/]*\.txt|\.eml\b|nachweis_text/);
  });
});
