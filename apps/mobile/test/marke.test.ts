/**
 * Marke (docs/14-marke.md): Der sichtbare Produktname steht nur in packages/marke/marke.json. Dieser Test hält fest,
 * dass nirgends sonst ein fest geschriebener Name sichtbar wird – weder der alte („Amtlos“) noch der aktuelle – und
 * dass ein anderer Name in marke.json bis in App-Texte, Rechtstexte, Dokumente und Store-Texte durchschlägt.
 *
 * Technische Kennungen bleiben „amtlos“ (Paketnamen, Bundle-ID, URL-Schema, Speicherschlüssel, Dateiformate, Abo-IDs,
 * Schriftfamilien „Amtlos Sans/Serif“, iCloud-Ordner „/Amtlos“) – siehe ERLAUBT.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { LEERER_BETRIEB, VORLAGEN, dokumentHtml, leereDaten } from "@amtlos/fachlogik";
import { MARKE, markeAus, markeEinsetzenTief, type MarkeDaten } from "@amtlos/marke";
import { mitMarke } from "../app.config";
import { zuLoeschen } from "../src/unterlagen/cloud";

const APP = path.resolve(__dirname, "..");
const WURZEL = path.resolve(APP, "../..");
const lies = (p: string) => fs.readFileSync(path.resolve(WURZEL, p), "utf8");
const DATEN = JSON.parse(lies("packages/marke/marke.json")) as MarkeDaten;

/** Technische Namen, die „Amtlos“ enthalten dürfen (nicht sichtbar bzw. Datenablage) */
const ERLAUBT = [/Amtlos (?:Sans|Serif)/g, /\w+ außerhalb von AmtlosAnbieter/g];
const ERLAUBT_GANZ = new Set(['"/Amtlos"']);
// ohne \b am Anfang: in JSON steht z. B. „\nAmtlos“
const ALT = /Amtlos|amtlos\.de\b/;

function dateien(ordner: string, ausser: RegExp = /$^/): string[] {
  const aus: string[] = [];
  for (const e of fs.readdirSync(path.resolve(WURZEL, ordner), { withFileTypes: true })) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) aus.push(...dateien(p, ausser));
    else if (/\.tsx?$/.test(e.name) && !ausser.test(p)) aus.push(p);
  }
  return aus;
}

/** Zeichenketten, Template-Teile und JSX-Texte einer Quelldatei, die einen fest geschriebenen Namen enthalten */
function fundstellen(datei: string, muster: RegExp): string[] {
  const sf = ts.createSourceFile(datei, lies(datei), ts.ScriptTarget.Latest, true, datei.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const aus: string[] = [];
  const besuch = (n: ts.Node) => {
    const text =
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || n.kind === ts.SyntaxKind.JsxText
        ? n.getText(sf)
        : null;
    const technisch = n.parent && (ts.isImportDeclaration(n.parent) || ts.isExportDeclaration(n.parent) || ts.isLiteralTypeNode(n.parent));
    if (text !== null && !technisch && !ERLAUBT_GANZ.has(text)) {
      const rest = ERLAUBT.reduce((t, r) => t.replace(r, ""), text);
      if (muster.test(rest)) aus.push(`${datei}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${text.slice(0, 90)}`);
    }
    ts.forEachChild(n, besuch);
  };
  besuch(sf);
  return aus;
}

const QUELLEN = [
  ...dateien("apps/mobile/src", /schriftenDaten\.ts$/),
  ...dateien("packages/fachlogik/src"),
  ...dateien("packages/i18n/src"),
  "apps/mobile/app.config.ts",
];
const nameMuster = (name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);

describe("Marke: der Name steht nur in packages/marke/marke.json", () => {
  it("marke.json ist vollständig, technische Kennungen unverändert", () => {
    for (const k of ["name", "proName", "domain", "email"] as const) expect(DATEN[k], k).toMatch(/\S/);
    expect(DATEN.proName.startsWith(DATEN.name)).toBe(true);
    expect(DATEN.email.endsWith(`@${DATEN.domain}`)).toBe(true);
    // nur vor dem ersten Store-Release ändern – sonst verlieren Tester Daten, Käufe und Links
    expect(DATEN.technisch).toMatchObject({ bundleId: "de.amtlos.app", scheme: "amtlos", dateiendungSicherung: ".amtlos" });
  });

  it("Quelltexte der App, Fachlogik und i18n: kein fest geschriebener Name in Texten", () => {
    expect(QUELLEN.length).toBeGreaterThan(100);
    const funde = QUELLEN.flatMap((d) => [...fundstellen(d, ALT), ...fundstellen(d, nameMuster(MARKE.name))]);
    expect(funde, funde.join("\n")).toEqual([]);
  });

  it("gebündelter Katalog (katalog-buendel.mjs) zeigt die Marke statt „Amtlos“", () => {
    for (const d of ["apps/mobile/src/pflichten/katalog.json", "apps/mobile/src/unterlagen/katalog.json"]) expect(lies(d), d).not.toMatch(/Amtlos/);
    expect(lies("apps/mobile/src/pflichten/katalog.json")).toContain(MARKE.name);
  });

  it("Store-Texte: Name nur als Platzhalter, eingesetzt ohne Reste", () => {
    const roh = lies("apps/mobile/store/de.json");
    expect(roh).not.toMatch(ALT);
    expect(roh).not.toMatch(nameMuster(MARKE.name));
    expect(roh).toContain("{{MARKE}}");
    const fertig = JSON.stringify(markeEinsetzenTief(JSON.parse(roh)));
    expect(fertig).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(fertig).toContain(MARKE.name);
  });

  it("app.json/app.config.ts: Anzeigename und Berechtigungstexte aus der Marke, Bundle-ID und Schema wie unter „technisch“", () => {
    const roh = lies("apps/mobile/app.json");
    expect(roh).not.toMatch(ALT);
    const app = JSON.parse(roh).expo;
    const c = mitMarke(app);
    expect(c.name).toBe(MARKE.name);
    expect(c.ios?.infoPlist?.CFBundleDisplayName).toBe(MARKE.name);
    expect(JSON.stringify(c)).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(JSON.stringify(c.plugins)).toContain(`${MARKE.name} braucht die Kamera`);
    expect(c.ios?.bundleIdentifier).toBe(MARKE.technisch.bundleId);
    expect(c.android?.package).toBe(MARKE.technisch.bundleId);
    expect(c.scheme).toBe(MARKE.technisch.scheme);
  });

  it("Website: seite.html nur mit Platzhaltern, gebaute Seiten (falls vorhanden) ohne alten Namen", () => {
    const seite = lies("apps/website/seite.html");
    expect(seite).not.toMatch(ALT);
    expect(seite).not.toMatch(nameMuster(MARKE.name));
    expect(seite).toContain("{{MARKE}}");
    const dist = path.resolve(WURZEL, "apps/website/dist");
    if (fs.existsSync(dist))
      for (const f of fs.readdirSync(dist).filter((x) => x.endsWith(".html"))) {
        const html = fs.readFileSync(path.join(dist, f), "utf8");
        expect(html, f).not.toMatch(/\{\{[A-Z_]+\}\}/);
        expect(html.replace(ERLAUBT[0]!, ""), f).not.toMatch(ALT);
      }
  });

  it("Dokumente der Fachlogik (alle Vorlagen, Startwerte) und ihre Hilfetexte ohne alten Namen", () => {
    for (const v of VORLAGEN) {
      const html = dokumentHtml(v, leereDaten(v, LEERER_BETRIEB, "2026-10-21"), LEERER_BETRIEB).replace(ERLAUBT[0]!, "");
      expect(html, v.id).not.toMatch(ALT);
      expect(JSON.stringify(v).replace(ERLAUBT[0]!, ""), v.id).not.toMatch(/Amtlos/);
    }
  });

  it("iCloud: Aufräumen zählt Sicherungen unter altem und neuem Namen gemeinsam", () => {
    const alt = Array.from({ length: 8 }, (_, i) => `Amtlos-Sicherung-Tag-2026-10-0${i + 1}.amtlos`);
    const neu = [`${MARKE.name}-Sicherung-Tag-2026-10-10.amtlos`, `${MARKE.name}-Sicherung-Tag-2026-10-11.amtlos`];
    // 10 Tages-Sicherungen, 7 bleiben: die drei ältesten (alle unter dem alten Namen) fallen weg
    expect(zuLoeschen([...neu, ...alt, "Amtlos-Sicherung-aktuell.amtlos"])).toEqual(alt.slice(0, 3));
  });
});

describe("Marke: ein anderer Name in marke.json schlägt überall durch", () => {
  it("App-Texte, Rechtstexte, Sicherungsname, Dokumente und Store-Texte mit einem Probenamen", async () => {
    // ein Name, der sicher nicht der aktuelle ist
    const N = MARKE.name === "Testname" ? "Probename" : "Testname";
    const d = N.toLowerCase();
    const test = markeAus({ ...DATEN, name: N, proName: `${N} Pro`, domain: `${d}.example`, email: `hallo@${d}.example` });
    vi.resetModules();
    vi.doMock("@amtlos/marke", async (original) => {
      const echt = await original<typeof import("@amtlos/marke")>();
      return { ...echt, MARKE: test, markeEinsetzen: (t: string, m = test) => echt.markeEinsetzen(t, m), markeEinsetzenTief: <T>(w: T, m = test) => echt.markeEinsetzenTief(w, m) };
    });
    try {
      const { T } = await import("../src/texte");
      const recht = await import("../src/rechtliches");
      const { sicherungsName } = await import("../src/unterlagen/sicherung");
      const F = await import("@amtlos/fachlogik");
      const alt = nameMuster(MARKE.name);
      const texte = JSON.stringify(T);
      expect(texte).toContain(N);
      expect(texte).toContain(`${N} Pro`);
      expect(texte).not.toMatch(alt);
      expect(texte).not.toMatch(ALT);
      const rechtText = JSON.stringify([recht.ANBIETER, recht.LINKS, recht.datenschutzAbschnitte(true)]);
      expect(rechtText).toContain(`hallo@${d}.example`);
      expect(rechtText).toContain(`https://${d}.example/datenschutz.html`);
      expect(rechtText).toContain(`${N} Pro`);
      expect(rechtText).not.toMatch(alt);
      expect(rechtText).toContain("Lang Ventures UG");
      expect(sicherungsName("2026-10-21")).toBe(`${N}-Sicherung-2026-10-21.amtlos`);
      const v = F.vorlageFuer("verfahrensdokumentation")!;
      const html = F.dokumentHtml(v, F.leereDaten(v, F.LEERER_BETRIEB, "2026-10-21"), F.LEERER_BETRIEB);
      expect(html).toContain(`Abläufe in ${N}`);
      expect(html).not.toMatch(alt);
      const store = JSON.stringify((await import("@amtlos/marke")).markeEinsetzenTief(JSON.parse(lies("apps/mobile/store/de.json"))));
      expect(store).toContain(`${N}: `);
      expect(store).not.toMatch(alt);
    } finally {
      vi.doUnmock("@amtlos/marke");
      vi.resetModules();
    }
  });
});
