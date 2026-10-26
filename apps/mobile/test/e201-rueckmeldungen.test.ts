/**
 * E-201: Rückmeldungen der vier Prüfer vom 26.10.2026 (Mails beim Gründer, in unseren Worten im Register) als Bedingungen:
 * - Lebensmittelfachbeauftragter: seine Rolle nur bei Einträgen und Vorlagen der Lebensmittelhygiene, deren aktuelle Fassung
 *   er freigegeben hat; der Zusatz „die Folgen bei Verstoß von einem Rechtsanwalt“ nur, wo der Rechtsanwalt die Folgen der
 *   aktuellen Fassung bestätigt hat (nie z. B. bei Schankanlage und Flüssiggas).
 * - Rechtsanwalt (Bedingungen der Rollenangabe): Rolle nur bei der bestätigten Fassung, Einschränkungen und offene Punkte
 *   immer dabei, keine Rolle in Store-Texten, Bildzeilen und Werbung (Website).
 * - Fachkraft für Arbeitssicherheit: kein Vermerk für sieben Vorlagen, bis sie die neu gerechnete Prüfsumme bestätigt hat;
 *   Einschränkung nur, wo sie sie erklärt hat.
 * - Android-Datenschutzhinweis: freigegeben in genau der Fassung mit der Prüfsumme DATENSCHUTZ_ANDROID_PRUEFSUMME.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PRUEFHINWEIS, VORLAGEN, VORLAGEN_GEPRUEFT, freigabeBestaetigt, freigabenFuer, pruefHinweisFuer, vorlageFuer } from "@amtlos/fachlogik";
import { KATALOG } from "../src/pflichten/check";
import { pruefVermerk, type PruefungRoh } from "../src/pflichten/pruefer";
import { DATENSCHUTZ, DATENSCHUTZ_ANDROID, DATENSCHUTZ_ANDROID_PRUEFSUMME, LINKS } from "../src/rechtliches";
import { LEERER_STAND } from "../src/unterlagen/speicher";

const WURZEL = path.resolve(__dirname, "../../..");
const lies = (d: string) => fs.readFileSync(path.join(WURZEL, d), "utf8");
const YAML = createRequire(path.join(WURZEL, "packages/rules-engine/package.json"))("yaml") as { parse: (s: string) => unknown };
interface Block {
  pruefer: string;
  umfang: string;
  nachweis: { art: string; datum: string; rolle: string; umfang: string; aufbewahrung: string };
  eintraege: Record<string, { version: number; stand: string; einschraenkung?: string }>;
}
const REGISTER = YAML.parse(lies("docs/freigabe-katalog/freigaben.yaml")) as Block[];
const zaehlt = (b: Block) => ["mail", "blatt", "bericht"].includes(b.nachweis.art);
const pflichten = KATALOG.pflichten as unknown as { id: string; version: number; pruefung?: PruefungRoh }[];
const AM = new Date(2026, 9, 26);
// Einträge, die anwenden.py nicht der Lebensmittelhygiene zuordnet, obwohl sie mit „branche.gastro_“ beginnen
const NICHT_LEBENSMITTEL = ["branche.gastro_preisverzeichnis", "branche.gastro_mehrweg", "branche.gastro_ppwr_radar", "branche.gastro_einwegkunststofffonds", "branche.gastro_schankanlage_fluessiggas"];
const LEBENSMITTEL_VORLAGEN = ["haccp", "hygieneplan", "allergene", "ifsg_belehrung", "hygieneschulung"];
const ROLLE = /Rechtsanw|Steuerberater|Fachkraft für Arbeitssicherheit|Lebensmittelfachbeauftragt|\bSifa\b/;

describe("E-201: Lebensmittelfachbeauftragter – Rolle nur bei der Lebensmittelhygiene", () => {
  const mitHygiene = pflichten.filter((p) => p.pruefung?.geprueft_von?.includes("hygiene"));

  it("nur Lebensmittel-Einträge nennen die Rolle (nie Schankanlage und Flüssiggas)", () => {
    expect(mitHygiene.length).toBe(14);
    for (const p of mitHygiene) {
      expect(p.id.startsWith("branche.gastro_") && !NICHT_LEBENSMITTEL.includes(p.id), p.id).toBe(true);
      expect(p.pruefung!.geprueft_von, p.id).toEqual(["hygiene", "recht"]);
    }
    const schank = pflichten.find((p) => p.id === "branche.gastro_schankanlage_fluessiggas")!;
    expect(schank.pruefung!.geprueft_von).toEqual(["arbeitsschutz"]);
    expect(pruefVermerk(schank.version, schank.pruefung, AM)).not.toMatch(/Lebensmittelfachbeauftragt/);
    for (const p of pflichten.filter((x) => !mitHygiene.includes(x))) expect(pruefVermerk(p.version, p.pruefung, AM) ?? "", p.id).not.toMatch(/Lebensmittelfachbeauftragt/);
  });

  it("seine Rolle nur bei der Fassung, die er bestätigt hat; „Folgen … von einem Rechtsanwalt“ nur, wo der Rechtsanwalt die Folgen bestätigt hat", () => {
    for (const p of mitHygiene) {
      const hygiene = REGISTER.filter((b) => b.pruefer === "hygiene" && zaehlt(b) && p.id in b.eintraege);
      const folgen = REGISTER.filter((b) => b.pruefer === "recht" && b.umfang === "sanktion" && zaehlt(b) && p.id in b.eintraege);
      expect(hygiene.length, `${p.id}: Bestätigung Lebensmittelfachbeauftragter`).toBeGreaterThan(0);
      expect(folgen.length, `${p.id}: Folgen vom Rechtsanwalt bestätigt`).toBeGreaterThan(0);
      // Teil-Umfänge können ältere Versionen abdecken, wenn sich nur Felder außerhalb des Umfangs geändert haben (anwenden.py --pruefen)
      expect(Math.max(...hygiene.map((b) => b.eintraege[p.id]!.version)) <= p.version, p.id).toBe(true);
      const v = pruefVermerk(p.version, p.pruefung, AM)!;
      expect(v, p.id).toMatch(/^Inhalt fachlich geprüft von einem Lebensmittelfachbeauftragten, die Folgen bei Verstoß von einem Rechtsanwalt, Stand /);
      expect(pruefVermerk(p.version + 1, p.pruefung, AM), p.id).toBeNull();
    }
  });

  it("Vorlagen: Rolle nur bei den fünf Lebensmittel-Vorlagen (Hygieneplan nur in der Fassung Lebensmittelbetrieb)", () => {
    for (const id of Object.keys(VORLAGEN_GEPRUEFT))
      for (const f of freigabenFuer(id)) {
        if (f.rolle !== "hygiene") continue;
        expect(LEBENSMITTEL_VORLAGEN, id).toContain(id);
        if (id === "hygieneplan") expect(f.fassung).toEqual({ feld: "art", wert: "lebensmittel" });
      }
    const cafe = { ...LEERER_STAND.betrieb, name: "Café Sonne", bundesland: "Berlin" };
    for (const v of VORLAGEN) {
      const h = pruefHinweisFuer(v, v.id === "hygieneplan" ? { art: "beauty" } : {}, cafe);
      if (!LEBENSMITTEL_VORLAGEN.includes(v.id) || v.id === "hygieneplan") expect(h, v.id).not.toMatch(/Lebensmittelfachbeauftragt/);
    }
  });
});

describe("E-201: Rückmeldungen Rechtsanwalt und Steuerberater im Katalog", () => {
  const p = (id: string) => pflichten.find((x) => x.id === id)!;
  it("Künstlersozialabgabe v2/v3 (Wortlaut des Rechtsanwalts) und Lohnsteuerbescheinigung v1 freigegeben, Stand 26.10.2026", () => {
    const ksk = p("personal.kuenstlersozialabgabe") as unknown as { version: number; erklaerung: { de: string }; rechtsgrundlage: string[]; pruefung: PruefungRoh };
    // E-202: v3 – nur Punkt statt Semikolon nach „(§ 26 KSVG)“ (vom Rechtsanwalt vorab freigegeben)
    expect(ksk.version).toBe(3);
    expect(ksk.erklaerung.de).toContain("Er gilt jeweils für ein Kalenderjahr; den aktuellen Satz veröffentlicht die Künstlersozialkasse.");
    expect(ksk.erklaerung.de).toContain("(§ 25 KSVG). Zahlungen an eine GmbH, UG, OHG oder KG zählen nach Auffassung der Künstlersozialkasse nicht dazu.");
    expect(ksk.erklaerung.de).not.toMatch(/4,9 %|5,0 %/);
    expect(ksk.rechtsgrundlage).toContain("§ 29 KSVG");
    expect(pruefVermerk(ksk.version, ksk.pruefung, AM)).toMatch(/^Inhalt fachlich geprüft von einem Rechtsanwalt, Stand 26\.10\.2026\./);
    const lstb = p("personal.lohnsteuerbescheinigung");
    // E-206: v2 (Auslöser ohne Anmeldezeitraum) – die Freigabe von v1 gilt nicht mehr, bis der Steuerberater v2 bestätigt (PRUEFLISTE T-237)
    expect(lstb.version).toBe(2);
    expect(pruefVermerk(lstb.version, lstb.pruefung, AM)).toBeNull();
  });
  it("alle 228 Einträge freigegeben, keine offenen Punkte mehr – außer den drei von E-206 geänderten (Nachprüfung PRUEFLISTE T-236, T-237)", () => {
    expect(pflichten.length).toBe(228);
    const E206 = ["personal.lohnsteuer_anmeldung", "personal.lohnsteuerbescheinigung", "steuern.ust_voranmeldung"];
    for (const x of pflichten) {
      if (E206.includes(x.id)) {
        expect(pruefVermerk(x.version, x.pruefung, AM), x.id).toBeNull();
        continue;
      }
      expect(pruefVermerk(x.version, x.pruefung, AM), x.id).not.toBeNull();
      expect(x.pruefung?.offen ?? [], x.id).toEqual([]);
    }
  });
  it("Einschränkungen nur, wo sie bestätigt sind", () => {
    const mit = pflichten.filter((x) => x.pruefung?.einschraenkung).map((x) => [x.id, x.pruefung!.einschraenkung]);
    expect(mit.sort()).toEqual([
      ["arbeitsschutz.arbeitsmedizinische_vorsorge", "nur die rechtliche Seite, ohne medizinische Inhalte"],
      ["arbeitsschutz.biostoffe", "ohne arbeitsmedizinische Angaben"],
      ["arbeitsschutz.laerm", "ohne arbeitsmedizinische Angaben"],
    ]);
  });
});

describe("E-201: Fachkraft für Arbeitssicherheit – Vorlagen", () => {
  const AUSGESETZT = ["unterweisung", "pruefprotokoll_elektro", "betriebsanweisung", "expositionsverzeichnis", "hautschutzplan", "gefaehrdungsbeurteilung", "betriebsanweisung_biostoffe"];
  // E-202: Die Fachkraft für Arbeitssicherheit hat die Zuordnung am selben Tag bestätigt – die sieben Vorlagen zeigen den
  // Vermerk wieder (Stand 26.10.2026); ein ausgesetzter Vermerk bleibt als Möglichkeit erhalten
  it("sieben Vorlagen: Vermerk seit der Bestätigung der Zuordnung wieder da (E-202) – keine Freigabe mehr ausgesetzt", () => {
    const cafe = { ...LEERER_STAND.betrieb, name: "Café Sonne", bundesland: "Berlin" };
    for (const id of AUSGESETZT) {
      const f = VORLAGEN_GEPRUEFT[id]!;
      expect(f.vermerk_ausgesetzt, id).toBeUndefined();
      expect(freigabeBestaetigt(f), id).toBe(true);
      expect(f.rolle, id).toBe("arbeitsschutz");
      expect(pruefHinweisFuer(vorlageFuer(id)!, {}, cafe), id).toMatch(/von einer Fachkraft für Arbeitssicherheit.*\(Stand 26\.10\.2026\)/);
    }
    expect(Object.keys(VORLAGEN_GEPRUEFT).filter((id) => freigabenFuer(id).some((f) => f.vermerk_ausgesetzt))).toEqual([]);
    // ein Café sieht den Vermerk auf 41 von 43 Vorlagen (nicht Handelsregister, das nur für GmbH, OHG, KG bestätigt ist;
    // E-208: nicht die Rechnung, bis der Steuerberater die geänderte Fassung bestätigt – PRUEFLISTE T-245)
    expect(VORLAGEN.length).toBe(43);
    expect(VORLAGEN.filter((v) => pruefHinweisFuer(v, v.id === "hygieneplan" ? { art: "lebensmittel" } : {}, cafe) !== PRUEFHINWEIS).length).toBe(41);
  });
  it("Einschränkung nur bei Prüfprotokoll, Gefährdungsbeurteilung und Betriebsanweisung Biostoffe", () => {
    expect(VORLAGEN_GEPRUEFT.pruefprotokoll_elektro!.einschraenkung).toBe("ohne die elektrotechnischen Grenzwerte");
    expect(VORLAGEN_GEPRUEFT.gefaehrdungsbeurteilung!.einschraenkung).toBe("ohne arbeitsmedizinische Angaben");
    expect(VORLAGEN_GEPRUEFT.betriebsanweisung_biostoffe!.einschraenkung).toBe("ohne arbeitsmedizinische Angaben");
    for (const id of ["betriebsanweisung", "expositionsverzeichnis", "hautschutzplan"]) expect(VORLAGEN_GEPRUEFT[id]!.einschraenkung, id).toBeUndefined();
  });
});

describe("E-201: Android-Datenschutzhinweis und Rolle nicht in der Werbung", () => {
  it("freigegeben in genau der Fassung mit der eingetragenen Prüfsumme; iPhone-Text unverändert daneben", () => {
    const text = DATENSCHUTZ_ANDROID.abschnitte.map((a) => `## ${a.titel}\n\n${a.text}\n`).join("\n");
    expect(createHash("sha256").update(text).digest("hex").slice(0, 12)).toBe(DATENSCHUTZ_ANDROID_PRUEFSUMME);
    expect(DATENSCHUTZ_ANDROID.freigegeben).toBe(true);
    const s = (t: string) => DATENSCHUTZ_ANDROID.abschnitte.find((a) => a.titel === t)!.text;
    expect(s("Sicherungen")).toContain("Liegt der Ordner bei einem Cloud-Anbieter, gelten für die Speicherung die Vereinbarungen zwischen dir und diesem Anbieter; die Datei ist mit deinem Passwort verschlüsselt, und wir haben keinen Zugriff darauf.");
    expect(s("Empfänger und Drittland")).toContain("Google ist für Google Play und Käufe eigener Verantwortlicher. Wo du deine Sicherung ablegst, entscheidest du; wir übermitteln sie nicht.");
    expect(DATENSCHUTZ_ANDROID.abschnitte.map((a) => a.text).join(" ")).not.toMatch(/Anbieter[^.]*eigener Verantwortlicher|Cloud-Ordner der Anbieter/);
    expect(DATENSCHUTZ_ANDROID.abschnitte.map((a) => a.titel)).toEqual(DATENSCHUTZ.abschnitte.map((a) => a.titel.replace("iPhone", "Smartphone")));
    expect(LINKS.datenschutzAndroid).toBe(`${LINKS.datenschutz}#android`);
  });
  it("Website: eine Datenschutzseite mit den Abschnitten #iphone und #android", () => {
    const b = lies("apps/website/bauen.mjs");
    expect(b).toContain('<h2 id="android">Android</h2>');
    expect(b).toContain('<h2 id="iphone">iPhone</h2>');
  });
  it("keine Rolle eines Prüfers in Store-Texten, Bildzeilen und Werbetexten der Website", () => {
    for (const d of ["apps/mobile/store/de.json", "apps/mobile/store/de-android.json"]) expect(lies(d), d).not.toMatch(ROLLE);
    const seite = lies("apps/website/seite.html").replace(/Anwalt, Steuerberaterin oder Steuerberater zuständig/g, "");
    expect(seite).not.toMatch(ROLLE);
    expect(seite).not.toMatch(/Fachlich geprüft\./);
    expect(lies("apps/mobile/werkzeuge/store-bilder.mjs")).toContain("zeigt die Rolle eines Prüfers (E-201)");
    expect(lies("apps/mobile/werkzeuge/store-check.mjs")).toContain("ohne Rolle eines Prüfers");
  });
});
