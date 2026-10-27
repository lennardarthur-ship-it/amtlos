/**
 * E-219 (externer Prüfer, Befund 1): Unter „Unterlagen“ ließen sich ohne Pro beliebig viele Belege anlegen – die Karte
 * „Beleg erfassen“ am Ende der Liste (`<BelegErfassen kompakt />` in Meine.tsx) rief `useBelegErfassen` direkt auf,
 * ohne die Sperre, die nur die eigene Seite `BelegErfassenSeite` hatte. Jetzt gilt eine Sperre für jeden Weg:
 * - die Handlungen des Zustands (`zustand.tsx`) speichern eine Neuanlage ohne Pro nicht (`neuanlageErlaubt`, über den
 *   ganzen Stand gerechnet – auch Wege, die es heute noch nicht gibt);
 * - jede Stelle der Oberfläche, die etwas anlegt, zeigt vorher den Bezahlschirm (`erstellenErlaubt`/`kasseErfassenErlaubt`);
 * - dieser Test zählt alle Stellen auf, die etwas anlegen – eine neue Stelle fällt hier auf, bis sie geprüft eingetragen ist.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { erstellenErlaubt, neuanlageErlaubt, neuanlageGrund } from "../src/pro/regeln";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, kasseKorrigieren, kasseSpeichern, kassenbuchFestschreiben, kassensturzSpeichern, kopieren, leererBeleg, sachentnahmeSpeichern, stornieren, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";

const hier = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(hier, "../src");
const lies = (datei: string) => readFileSync(path.join(SRC, datei), "utf8");
const t = (d: string) => new Date(`${d}T10:00:00Z`);
const tag = (datum: string) => ({ datum, zbon: "1", umsatz: [{ satz: 19 as const, brutto_cent: 11900 }], karte_cent: 0, sonstige_cent: 0, bewegungen: [] });

/** mit Pro angelegt: eine geteilte Rechnung, ein Beleg, ein Kassentag – danach endet Pro */
function mitDaten(): Stand {
  let s: Stand = { ...LEERER_STAND, profil: { "kasse.elektronisch": true } };
  [s] = anlegen(s, "rechnung", t("2026-09-01"), "r1");
  s = ausgeben(s, "r1", t("2026-09-01"));
  s = belegSetzen(s, { ...leererBeleg("hand", null), id: "b1" }, t("2026-09-02"));
  [s] = kasseSpeichern(s, tag("2026-09-02"), t("2026-09-02"), "k1");
  return s;
}

describe("E-219: eine Prüfung für jede Neuanlage (Zustand)", () => {
  it("Neues anlegen braucht Pro – Rechnung, Vorlage, Kopie, Ersatzrechnung, Beleg (auch aus E-Rechnung), Kassentag, Kassensturz, Sachentnahme", () => {
    const s = mitDaten();
    const faelle: [string, Stand, string][] = [
      ["neue Rechnung", anlegen(s, "rechnung", t("2026-10-01"))[0], "rechnungen"],
      ["neue Vorlage", anlegen(s, "hygieneplan", t("2026-10-01"))[0], "pdf"],
      ["Kopie einer Rechnung", kopieren(s, "r1", t("2026-10-01"))[0], "rechnungen"],
      ["neuer Beleg", belegSetzen(s, leererBeleg("foto", "x.jpg"), t("2026-10-01")), "belege"],
      ["Beleg aus empfangener E-Rechnung", belegSetzen(s, { ...leererBeleg("foto", "e.xml"), quelle: "erechnung" }, t("2026-10-01")), "belege"],
      ["neuer Kassentag", kasseSpeichern(s, tag("2026-10-01"), t("2026-10-01"))[0], "kasse"],
      ["Kassensturz", kassensturzSpeichern(s, { gezaehlt_cent: 1000 }, t("2026-10-01"))[0], "kasse"],
      ["Sachentnahme", sachentnahmeSpeichern(s, { datum: "2026-10-01", netto7_cent: 100, netto19_cent: 0 }, t("2026-10-01")), "kasse"],
    ];
    for (const [name, nachher, grund] of faelle) {
      expect(neuanlageGrund(s, nachher), name).toBe(grund);
      expect(neuanlageErlaubt(s, nachher, false), name).toBe(false);
      expect(neuanlageErlaubt(s, nachher, true), name).toBe(true);
    }
    // Ersatzrechnung: Kopie eines Stornos – eine neue Rechnung
    const [st, storno] = stornieren(s, "r1", t("2026-10-01"));
    expect(neuanlageGrund(st, kopieren(st, storno!.id, t("2026-10-02"))[0])).toBe("rechnungen");
  });

  it("frei bleibt, was keine neue Unterlage im Sinn von E-188 ist: Storno, Kassenbuch erfasster Tage, Ändern und Korrigieren, Wiederherstellen", () => {
    const s = mitDaten();
    const frei: [string, Stand][] = [
      ["Storno einer ausgegebenen Rechnung (GoBD)", stornieren(s, "r1", t("2026-10-01"))[0]],
      ["Kassenbuch erfasster Tage festschreiben", kassenbuchFestschreiben(s, "2026-09", "", { monat: "2026-09" }, "ab".repeat(32), t("2026-10-01"))],
      ["vorhandenen Beleg bearbeiten", belegSetzen(s, { ...s.belege[0]!, lieferant: "Bäcker" }, t("2026-10-01"))],
      ["Kassentag mit Grund korrigieren", kasseKorrigieren(s, "k1", { ...tag("2026-09-02"), karte_cent: 100 }, "Kartenzahlung nachgetragen", t("2026-10-01"))],
      ["Sicherung wiederherstellen (eigene Daten)", zusammenfuehren(LEERER_STAND, s).stand],
    ];
    for (const [name, nachher] of frei) {
      const vorher = name.startsWith("Sicherung") ? LEERER_STAND : s;
      // das Wiederherstellen prüft der Zustand bewusst nicht (E-188: Wiederherstellen geht immer) – hier nur zur Abgrenzung
      if (name.startsWith("Sicherung")) expect(neuanlageGrund(vorher, nachher)).not.toBeNull();
      else expect(neuanlageErlaubt(vorher, nachher, false), name).toBe(true);
    }
  });

  it("der Zustand prüft jede Handlung, die etwas anlegt – und nur die Wege, die E-188 frei lässt, ohne die Prüfung", () => {
    const z = lies("zustand.tsx");
    const start = z.indexOf("const aktionen = useMemo<AmtlosAktionen>(");
    const teil = z.slice(start);
    const koerper = (name: string) => {
      const m = new RegExp(`\\n      ${name}: `).exec(teil);
      expect(m, name).not.toBeNull();
      const rest = teil.slice(m!.index + 1);
      const ende = rest.slice(1).search(/\n {6}[a-zA-Z]+: /);
      return rest.slice(0, ende + 1);
    };
    for (const name of ["anlegen", "kopieren", "belegSetzen", "kasseSpeichern", "kassensturzSpeichern", "sachentnahmeSpeichern"]) expect(koerper(name), name).toMatch(/neuGeprueft\(/);
    // frei nach E-188: Storno, Kassenbuch, Korrekturen, Wiederherstellen
    for (const name of ["stornieren", "kassenbuchFestschreiben", "kasseKorrigieren", "korrigieren", "zusammenfuehren"]) expect(koerper(name), name).not.toMatch(/neuGeprueft\(/);
    // die Prüfung selbst: regeln.ts, mit dem Pro-Stand von jetzt (nach einem Kauf gilt er sofort, vor dem nächsten Zeichnen)
    expect(z).toMatch(/neuanlageErlaubt\(/);
    expect(z).toMatch(/proJetzt\.current = /);
  });
});

/** alle Quelltexte der Oberfläche (ohne Zustand und Speicher) */
function quellen(dir = SRC): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return quellen(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

/** Name des Bausteins auf oberster Ebene, in dem eine Zeile steht, und sein Text */
function block(text: string, index: number): { name: string; text: string } {
  const re = /^(?:export )?(?:function|const) (\w+)/gm;
  let name = "";
  let von = 0;
  for (let m = re.exec(text); m && m.index <= index; m = re.exec(text)) {
    name = m[1]!;
    von = m.index;
  }
  re.lastIndex = Math.max(von + 1, index);
  const naechster = re.exec(text);
  return { name, text: text.slice(von, naechster ? naechster.index : text.length) };
}

/**
 * Jede Stelle der Oberfläche, die etwas anlegt (Handlungen des Zustands `anlegen`, `kopieren`, `belegSetzen`,
 * `kasseSpeichern`, `kassensturzSpeichern`, `sachentnahmeSpeichern`), mit Datei und Baustein. Kommt eine hinzu, muss
 * sie hier mit ihrer Sperre eingetragen werden.
 */
const EINSTIEGE: Record<string, "sperre" | string> = {
  // „+“ → Vorlage, Heute → „Rechnung“, Unterlagen-Liste (leer), Pflichten, Kontrollmappe, Gewerbe online – alle über useStarten
  "seiten/starten.tsx › useStarten": "sperre",
  // Abschluss → „Kopie“ (auch Ersatzrechnung aus einem Storno)
  "seiten/Abschluss.tsx › Abschluss": "sperre",
  // Beleg: Foto, Fotos, Datei (auch E-Rechnung empfangen), von Hand – von Heute, „+“, der eigenen Seite UND der Karte in „Unterlagen“ (der Befund)
  "seiten/Belege.tsx › useBelegErfassen": "sperre",
  // Bearbeiten eines vorhandenen Belegs (keine Neuanlage; der Zustand prüft es trotzdem)
  "seiten/Belege.tsx › BelegSeite": "vorhandener Beleg",
  // Kasse: Tagesabschluss, Kassensturz, Sachentnahme
  "seiten/Kasse.tsx › KassenTagSeite": "sperre",
  "seiten/Kasse.tsx › KassensturzSeite": "sperre",
  "seiten/Kasse.tsx › SachentnahmenSeite": "sperre",
};

describe("E-219: jede Stelle der Oberfläche, die etwas anlegt, zeigt vorher den Bezahlschirm", () => {
  // über das Zustandsobjekt (z.…) oder als herausgelöste Handlung (const { anlegen } = useAktionen(), Hilfsfunktion im Beleg-Hook)
  const AUFRUF = /\bz\.(anlegen|kopieren|belegSetzen|kasseSpeichern|kassensturzSpeichern|sachentnahmeSpeichern)\(|(?<![.\w])(anlegen|belegSetzen|kasseSpeichern|kassensturzSpeichern|sachentnahmeSpeichern)\(/g;
  const gefunden = new Map<string, string>();
  for (const datei of quellen()) {
    const rel = path.relative(SRC, datei).split(path.sep).join("/");
    if (rel === "zustand.tsx" || rel.startsWith("unterlagen/") || rel.startsWith("konto/")) continue;
    const text = readFileSync(datei, "utf8");
    for (const m of text.matchAll(AUFRUF)) {
      // Deklarationen (const anlegen = …, function anlegen(…)) zählen nicht
      const davor = text.slice(Math.max(0, m.index - 12), m.index);
      if (/(const|function) $/.test(davor)) continue;
      // Aufrufe einer eigenen Hilfsfunktion „anlegen“ im Beleg-Hook gehören zum Hook
      const b = block(text, m.index);
      gefunden.set(`${rel} › ${b.name}`, b.text);
    }
  }

  it("die Liste der Einstiege ist vollständig (eine neue Stelle muss hier geprüft eingetragen werden)", () => {
    expect([...gefunden.keys()].sort()).toEqual(Object.keys(EINSTIEGE).sort());
  });

  it("jeder Einstieg prüft Pro, bevor er etwas anlegt", () => {
    for (const [k, art] of Object.entries(EINSTIEGE)) {
      if (art !== "sperre") continue;
      expect(gefunden.get(k), k).toMatch(/erstellenErlaubt\(|kasseErfassenErlaubt\(/);
    }
  });

  it("Befund: die Karte „Beleg erfassen“ in „Unterlagen“ (Meine.tsx) geht durch dieselbe Sperre wie die eigene Seite", () => {
    expect(lies("seiten/Meine.tsx")).toMatch(/<BelegErfassen kompakt \/>/);
    const belege = lies("seiten/Belege.tsx");
    const hook = block(belege, belege.indexOf("export function useBelegErfassen")).text;
    // jede der vier Möglichkeiten (Foto, Fotos, Datei/E-Rechnung, von Hand) läuft durch die Sperre
    expect(hook).toMatch(/erstellenErlaubt\(/);
    for (const art of ["hand", "foto", "datei"]) expect(hook, art).toMatch(new RegExp(`${art}: [^\\n]*mitPro\\(`));
    // die Karte sagt ohne Pro, dass es zu Pro gehört
    const karte = block(belege, belege.indexOf("export function BelegErfassen(")).text;
    expect(karte).toMatch(/TEXT\.mitPro\(/);
    expect(erstellenErlaubt(false)).toBe(false);
  });

  it("Share-Extension, Intents, Deep Links: es gibt keinen Weg von außen, der etwas anlegt", () => {
    const app = readFileSync(path.resolve(hier, "../app.json"), "utf8");
    expect(app).not.toMatch(/intentFilters|CFBundleDocumentTypes|share-extension|NSExtension/);
    // einzige Deep Links: Partner-Code und Anmeldung – beide legen nichts an
    const links = quellen().filter((d) => /Linking\.(getInitialURL|addEventListener)/.test(readFileSync(d, "utf8"))).map((d) => path.relative(SRC, d).split(path.sep).join("/"));
    expect(links).toEqual(["seiten/Partner.tsx"]);
    expect(lies("seiten/Partner.tsx")).not.toMatch(/anlegen\(|belegSetzen\(|kopieren\(/);
  });
});
