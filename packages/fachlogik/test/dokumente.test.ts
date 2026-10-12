import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BEREICHE, PRUEFHINWEIS, VORLAGEN, berlinZuUtc, dateiname, fehlendeAngaben, leereDaten, neuerEintrag, sichtbar, unterlagenName, vorlageFuer, type Betrieb, type Daten, type Feld } from "../src/index.js";

const KATALOG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../catalog/pflichten");
const BETRIEB: Betrieb = { name: "Salon Sonne", strasse: "Hauptstr. 1", plz: "12345", ort: "Musterstadt", verantwortlich: "Alex Muster", telefon: "0123 456", email: "info@example.de" };

function generatorPflichten(): string[] {
  return fs
    .readdirSync(KATALOG)
    .filter((f) => f.endsWith(".yaml") && fs.readFileSync(path.join(KATALOG, f), "utf8").includes("automatisierung: dokument_generator"))
    .map((f) => f.replace(/\.yaml$/, ""));
}

/** Füllt jedes Feld mit einem Beispielwert (Listen mit zwei Einträgen). */
function alles(felder: Feld[], tiefe = 0): Daten {
  const d: Daten = {};
  for (const f of felder) {
    if (f.art === "liste") d[f.id] = [0, 1].map(() => alles(f.felder, tiefe + 1) as Record<string, string>);
    else if (f.art === "datum") d[f.id] = "2026-10-12";
    else if (f.art === "uhrzeit") d[f.id] = "09:30";
    else if (f.art === "schalter") d[f.id] = true;
    else if (f.art === "wahl") d[f.id] = f.optionen[0]!.wert;
    else if (f.art === "mehrfach") d[f.id] = f.optionen.slice(0, 2).map((o) => o.wert);
    else d[f.id] = `${f.label} <b>&</b>`;
  }
  return d;
}

describe("Dokumentvorlagen", () => {
  it("decken alle Pflichten mit Dokument-Generator im Katalog ab – und nur echte Pflichten", () => {
    const belegt = new Set(VORLAGEN.flatMap((v) => v.pflichten));
    const katalog = generatorPflichten();
    expect(katalog.length).toBeGreaterThanOrEqual(18);
    for (const p of katalog) expect(belegt, p).toContain(p);
    for (const p of belegt) expect(fs.existsSync(path.join(KATALOG, `${p}.yaml`)), p).toBe(true);
  });

  it("sind in sich stimmig: eindeutige IDs, Bereiche, Titel- und Namensfelder, Bedingungen", () => {
    expect(new Set(VORLAGEN.map((v) => v.id)).size).toBe(VORLAGEN.length);
    for (const v of VORLAGEN) {
      expect(BEREICHE.map((b) => b.id)).toContain(v.bereich);
      expect(vorlageFuer(v.id)).toBe(v);
      const felder = v.abschnitte.flatMap((a) => a.felder);
      const ids = felder.map((f) => f.id);
      expect(new Set(ids).size, v.id).toBe(ids.length);
      if (v.namensFeld) expect(ids, v.id).toContain(v.namensFeld);
      for (const f of felder) {
        if (f.wenn) expect(ids, `${v.id}.${f.id}`).toContain(f.wenn.feld);
        if (f.art === "liste") {
          const sub = f.felder.map((x) => x.id);
          expect(sub, `${v.id}.${f.id}`).toContain(f.titelFeld);
          for (const x of f.felder) if (x.wenn) expect(sub, `${v.id}.${f.id}.${x.id}`).toContain(x.wenn.feld);
        }
      }
    }
  });

  it("erzeugen aus leeren und vollen Eingaben ein Dokument mit Prüfhinweis, Betrieb und maskierten Eingaben", () => {
    for (const v of VORLAGEN) {
      const leer = v.html(leereDaten(v, BETRIEB, "2026-10-12"), BETRIEB);
      expect(leer, v.id).toContain("<!doctype html>");
      expect(leer).toContain(PRUEFHINWEIS);
      expect(leer).toContain("Salon Sonne");
      expect(leer.includes("A4 landscape"), v.id).toBe(Boolean(v.querformat));
      const voll = v.html(alles(v.abschnitte.flatMap((a) => a.felder)), BETRIEB);
      expect(voll, v.id).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
      expect(voll).not.toContain("<b>&</b>");
    }
  });

  it("füllt Angaben aus „Mein Betrieb“ und das heutige Datum vor; Listen beginnen mit einem Eintrag", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    const d = leereDaten(g, BETRIEB, "2026-10-12");
    expect(d.beurteilt_von).toBe("Alex Muster");
    expect(d.datum).toBe("2026-10-12");
    expect(d.mutterschutz).toBe(false);
    expect(Array.isArray(d.gefaehrdungen) && d.gefaehrdungen.length).toBe(1);
    const liste = g.abschnitte[1]!.felder[0]!;
    expect(liste.art === "liste" && neuerEintrag(liste, BETRIEB, "2026-10-12").risiko).toBe("mittel");
    expect(vorlageFuer("datenpanne") && leereDaten(vorlageFuer("datenpanne")!, BETRIEB, "2026-10-12").kontakt).toBe("Alex Muster, 0123 456, info@example.de");
  });

  it("nennt fehlende Pflichtangaben – auch in Listeneinträgen und nur für sichtbare Felder", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    const d = leereDaten(g, BETRIEB, "2026-10-12");
    expect(fehlendeAngaben(g, d)).toEqual(["Arbeitsbereich oder Gewerk", "mindestens ein Eintrag: Gefährdung"]);
    d.arbeitsbereich = "Küche";
    d.gefaehrdungen = [{ faktor: "arbeitsstaette", beschreibung: "Rutschgefahr", risiko: "mittel", massnahme: "", verantwortlich: "", umsetzen_bis: null, umgesetzt_am: null }];
    expect(fehlendeAngaben(g, d)).toEqual(["Gefährdung: Maßnahme"]);
    d.mutterschutz = true;
    expect(fehlendeAngaben(g, d)).toEqual(["Gefährdung: Maßnahme"]);

    const p = vorlageFuer("datenpanne")!;
    const dp = leereDaten(p, BETRIEB, "2026-10-12");
    const begruendung = p.abschnitte[2]!.felder[1]!;
    expect(sichtbar(begruendung, dp)).toBe(false);
    dp.risiko = "kein_risiko";
    expect(sichtbar(begruendung, dp)).toBe(true);
    expect(fehlendeAngaben(p, dp)).toContain("Begründung, warum keine Meldung nötig ist");
  });

  it("rechnet die 72-Stunden-Frist in Berliner Zeit, auch über die Zeitumstellung", () => {
    expect(berlinZuUtc("2026-10-24", "22:00")!.toISOString()).toBe("2026-10-24T20:00:00.000Z");
    const p = vorlageFuer("datenpanne")!;
    const html = p.html({ ...leereDaten(p, BETRIEB, "2026-10-24"), entdeckt_um: "22:00" }, BETRIEB);
    expect(html).toContain("24.10.2026, 22:00 Uhr");
    expect(html).toContain("27.10.2026, 21:00 Uhr"); // Ende der Sommerzeit am 25.10.2026
    expect(berlinZuUtc("2026-13-01", "10:00")).toBeNull();
  });

  it("benennt Unterlagen und PDF-Dateien lesbar", () => {
    const g = vorlageFuer("gefaehrdungsbeurteilung")!;
    expect(unterlagenName(g, { arbeitsbereich: "Küche" })).toBe("Gefährdungsbeurteilung · Küche");
    expect(dateiname(g, { arbeitsbereich: "Küche & Lager" }, "2026-10-12")).toBe("Gefaehrdungsbeurteilung-Kueche-Lager-2026-10-12.pdf");
    expect(dateiname(vorlageFuer("verfahrensdokumentation")!, {}, "2026-10-12")).toBe("Verfahrensdokumentation-GoBD-2026-10-12.pdf");
  });

  it("zeigt Allergene, Unterschriftszeilen und leere HACCP-Zeilen", () => {
    const a = vorlageFuer("allergene")!;
    const html = a.html({ stand: "2026-10-12", gerichte: [{ name: "Apfelkuchen", kategorie: "Kuchen", allergene: ["gluten", "eier", "milch"] }] }, BETRIEB);
    expect(html).toContain("Glutenhaltiges Getreide, Eier, Milch (einschließlich Laktose)");
    const u = vorlageFuer("unterweisung")!;
    const uh = u.html({ thema: "Test", teilnehmer: [{ name: "Kim" }] }, BETRIEB);
    expect((uh.match(/<tr><td>/g) ?? []).length).toBe(8); // Kim + 7 freie Zeilen
    const h = vorlageFuer("haccp")!;
    expect((h.html({ zeitraum: "Okt", leerzeilen: true, messungen: [] }, BETRIEB).match(/<tr><td>/g) ?? []).length).toBe(14);
  });
});
