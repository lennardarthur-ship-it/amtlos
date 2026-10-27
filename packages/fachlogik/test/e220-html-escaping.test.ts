/**
 * E-220 (7): Jede Eingabe des Nutzers steht im HTML der Vorlagen maskiert (& < > " '), in jeder Vorlage und jedem
 * Feld – auch in Listen, Auswahlwerten (gespeicherte Daten können fremde Werte enthalten, z. B. nach einer
 * Synchronisation), den Angaben aus „Mein Betrieb“ (Kopf, Fußzeile, Briefkopf, Zahlungsblock) und den Meta-Angaben der
 * Fußzeile. Sonst ließe sich die Darstellung im PDF verändern (Tabellen schließen, Bilder oder Skripte einfügen).
 */
import { describe, expect, it } from "vitest";
import { EIGENE_GRUPPEN, LEERER_BETRIEB, VORLAGEN, dokumentHtml, rechtsformBetrieb, type Betrieb, type Daten, type Eintrag, type Feld } from "../src/index.js";

/** Bausteine eines Angriffs in Text-, Tabellen- und Attribut-Umgebung */
const ROH = ["<script>alert(1)</script>", "<img src=x onerror=alert(2)>", "</td></tr></table><b>", "\" onload=\"alert(3)", "' onfocus='alert(4)", "</style><i>"];
const P = `Ä&B ${ROH.join(" ")} Ende`;

function wert(f: Feld, i: number): Daten[string] {
  switch (f.art) {
    case "schalter":
      return true;
    case "mehrfach":
    case "bausteine":
      return [P, ...f.optionen.map((o) => o.wert)];
    case "liste":
      return [eintrag(f.felder, i), eintrag(f.felder, i + 1)];
    case "wahl":
      // abwechselnd ein fremder Wert und eine echte Option (deren Zweig sonst nicht gedruckt wird)
      return i % 2 === 0 ? P : (f.optionen[i % f.optionen.length]?.wert ?? P);
    default:
      return P;
  }
}
function eintrag(felder: readonly Feld[], i: number): Eintrag {
  const e: Eintrag = {};
  felder.forEach((f, j) => (e[f.id] = wert(f, i + j) as Eintrag[string]));
  return e;
}
function datenFuer(felder: readonly Feld[], i: number): Daten {
  const d: Daten = {};
  felder.forEach((f, j) => (d[f.id] = wert(f, i + j)));
  return d;
}

const betriebMit = (rf: string): Betrieb => {
  const b = rechtsformBetrieb(LEERER_BETRIEB, rf);
  const r: Record<string, unknown> = { ...b };
  for (const [k, w] of Object.entries(b)) if (typeof w === "string" && k !== "rechtsform") r[k] = P;
  return r as unknown as Betrieb;
};

/** Stellen, an denen ein Baustein unmaskiert im HTML steht (ohne Inhalte von <style>, die keine Eingaben enthalten) */
function unmaskiert(html: string): string[] {
  return ROH.filter((r) => html.includes(r));
}

describe("E-220 (7): Eingaben im HTML aller Vorlagen maskiert", () => {
  for (const v of VORLAGEN) {
    it(v.id, () => {
      const felder = v.abschnitte.flatMap((a) => a.felder);
      const funde = new Set<string>();
      const varianten: Daten[] = [0, 1, 2, 3].map((i) => datenFuer(felder, i));
      // alle Schalter aus (andere Zweige) und je Wahl jede Option
      varianten.push(Object.fromEntries(Object.entries(varianten[0]!).map(([k, w]) => [k, w === true ? false : w])));
      for (const f of felder) if (f.art === "wahl") for (const o of f.optionen) varianten.push({ ...varianten[1]!, [f.id]: o.wert });
      for (const g of EIGENE_GRUPPEN[v.id] ?? []) varianten.push({ ...varianten[1]!, ...(g.auswahl ?? {}), ...(g.verdeckt ?? {}), storno_zu: P });
      for (const rf of ["Einzelunternehmen", "GmbH", "GmbH & Co. KG", "e. K."]) {
        const b = betriebMit(rf);
        for (const d of varianten) for (const x of unmaskiert(dokumentHtml(v, d, b))) funde.add(`${rf}: ${x}`);
      }
      expect([...funde]).toEqual([]);
    });
  }

  it("Logo und Hausfarbe aus „Mein Betrieb“ brechen weder Attribut noch Stil auf", () => {
    const b: Betrieb = { ...rechtsformBetrieb(LEERER_BETRIEB, "GmbH"), logo: `data:image/png;base64,AAAA" onerror="alert(5)`, farbe: "red;}</style><script>alert(6)</script>" };
    const v = VORLAGEN.find((x) => x.id === "rechnung")!;
    const html = dokumentHtml(v, { nummer: "1", positionen: [{ bezeichnung: "A", preis: "1", satz: "19" }] }, b);
    expect(html).not.toContain(`onerror="alert(5)`);
    expect(html).not.toContain("<script>alert(6)");
  });

  it("normale Texte ohne Sonderzeichen bleiben Zeichen für Zeichen gleich; & steht als &amp;", () => {
    const v = VORLAGEN.find((x) => x.id === "rechnung")!;
    const b = { ...rechtsformBetrieb(LEERER_BETRIEB, "GmbH & Co. KG") };
    const html = dokumentHtml(v, { nummer: "2026-1", kunde_name: "Müller & Söhne", positionen: [{ bezeichnung: "Beratung", preis: "100", satz: "19" }] }, b);
    expect(html).toContain("Müller &amp; Söhne");
    expect(html).not.toMatch(/Müller & Söhne/);
    expect(html).toContain("Beratung");
  });
});
