import path from "node:path";
import { validiereKatalog } from "@amtlos/rules-schema";
import { describe, expect, it } from "vitest";
import { frageBeantworten, istBeratungsfrage, woerter, type KatalogPflicht, type KatalogRegelwert } from "../src/assistent.js";
import { WURZEL } from "../src/testhilfen.js";

const k = validiereKatalog(path.join(WURZEL, "catalog"));
const katalog = {
  pflichten: k.pflichten.map((p) => p.inhalt as unknown as KatalogPflicht),
  regelwerte: k.regelwerte as unknown as KatalogRegelwert[],
};
const frage = (f: string, geltend: string[] = []) => frageBeantworten(f, katalog, { stichtag: "2026-10-11", sprache: "de", geltend: new Set(geltend) });

describe("Frag Amtlos (Suche im Katalog)", () => {
  it("normalisiert Wörter (Umlaute, Stoppwörter, Stämme)", () => {
    expect(woerter("Muss ich die Umsatzsteuer-Voranmeldung abgeben?")).toEqual(["umsatzsteu", "voranmeld", "abgeb"]);
    expect(woerter("Gefährdungsbeurteilung § 5")).toContain("paragraf");
  });

  it("findet die passende Pflicht mit Quelle und Prüfstatus", () => {
    const a = frage("Muss ich eine Umsatzsteuer-Voranmeldung abgeben?");
    expect(a.art).toBe("antwort");
    expect(a.treffer[0]).toMatchObject({ pflicht_id: "steuern.ust_voranmeldung", pruefung: { status: "freigegeben" } });
    expect(a.treffer[0]!.quellen[0]!.url).toMatch(/^https:\/\//);
    expect(a.ki_formuliert).toBe(false);
    expect(frage("Brauche ich ein Impressum auf meiner Website?").treffer[0]?.pflicht_id).toBe("online.impressum");
    expect(frage("Datenpanne – was muss ich tun?").treffer[0]?.pflicht_id).toBe("datenschutz.datenpanne_meldung");
  });

  it("nennt Beträge nur aus Regelwerten mit Gültigkeit", () => {
    const a = frage("Wie hoch ist der Mindestlohn?");
    expect(a.regelwerte[0]).toMatchObject({ id: "personal.mindestlohn.stunde", wert: 13.9, gueltig_ab: "2026-01-01" });
    const spaeter = frageBeantworten("Wie hoch ist der Mindestlohn?", katalog, { stichtag: "2027-02-01", sprache: "de" });
    expect(spaeter.regelwerte[0]).toMatchObject({ wert: 14.6, gueltig_ab: "2027-01-01" });
  });

  it("bevorzugt Pflichten, die für dich gelten", () => {
    const ohne = frage("Unterweisung");
    const mit = frage("Unterweisung", ["arbeitsschutz.unterweisung_wiederholen"]);
    expect(mit.treffer[0]?.pflicht_id).toBe("arbeitsschutz.unterweisung_wiederholen");
    expect(mit.treffer[0]?.gilt_fuer_dich).toBe(true);
    expect(ohne.treffer.length).toBeGreaterThan(0);
  });

  it("erkennt Beratungsfragen und sagt „weiß ich nicht sicher“ ohne Treffer", () => {
    expect(istBeratungsfrage("Soll ich eine GmbH gründen?")).toBe(true);
    expect(istBeratungsfrage("Kann ich in meinem Fall die Kosten absetzen?")).toBe(true);
    expect(istBeratungsfrage("Wann ist die Lohnsteuer-Anmeldung fällig?")).toBe(false);
    expect(frage("Soll ich eine GmbH gründen?").art).toBe("beratung");
    const u = frage("Wie flicke ich einen Fahrradschlauch?");
    expect(u).toMatchObject({ art: "unsicher", treffer: [], regelwerte: [] });
  });
});
