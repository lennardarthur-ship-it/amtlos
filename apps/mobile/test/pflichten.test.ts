import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { VORLAGEN } from "@amtlos/fachlogik";
import { LEERER_STAND, anlegen, erledigtSetzen, profilSetzen, standAus } from "../src/unterlagen/speicher";
import { CHECK_FELDER, KATALOG, auswertung, checkFragen, fortschritt, frageZu, istErledigt, zusatzFragen, type Profil } from "../src/pflichten/check";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../catalog/fixtures");
const salon: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "kasse.elektronisch": true, "online.website": false, "ust.kleinunternehmer": false, gruendungsdatum: "2024-03-01" };
const ids = (l: { id: string }[]) => l.map((p) => p.id);

describe("Pflichten-Check", () => {
  it("stellt die Fragen aus dem Fragebogen – die Gesellschafts-Frage nur bei UG und GmbH", () => {
    for (const f of CHECK_FELDER) expect(frageZu(f), f).toBeTruthy();
    expect(checkFragen({}).map((f) => f.feld)).not.toContain("gesellschaft.handelsregister");
    expect(checkFragen({ rechtsform: "gmbh" }).map((f) => f.feld)).toContain("gesellschaft.handelsregister");
    expect(checkFragen({}).length).toBeLessThanOrEqual(10);
  });

  it("rechnet mit dem ganzen Katalog: Branche, Beschäftigte und Website entscheiden mit", () => {
    expect(KATALOG.pflichten.length).toBeGreaterThan(100);
    const a = auswertung(salon, "2026-10-12");
    expect(ids(a.gilt)).toEqual(expect.arrayContaining(["branche.beauty_hautschutzplan", "branche.beauty_hygieneplan", "arbeitsschutz.gefaehrdungsbeurteilung", "steuern.kassenmeldung"]));
    expect(ids(a.gilt)).not.toContain("branche.gastro_haccp");
    expect(ids(a.gilt)).not.toContain("online.impressum");
    const mitSeite = auswertung({ ...salon, "online.website": true }, "2026-10-12");
    expect(ids(mitSeite.gilt)).toContain("online.impressum");
    const ohneTeam = auswertung({ ...salon, "beschaeftigte.gesamt": 0 }, "2026-10-12");
    expect(ids(ohneTeam.gilt)).not.toContain("arbeitsschutz.gefaehrdungsbeurteilung");
    // jede verknüpfte Vorlage gibt es, Pflichten im Radar (Entwurf, geplant) zählen nicht mit
    const vorlagen = new Set(VORLAGEN.map((v) => v.id));
    for (const p of [...a.gilt, ...a.unbekannt]) if (p.vorlage) expect(vorlagen.has(p.vorlage), p.id).toBe(true);
    const radar = new Set(KATALOG.pflichten.filter((p) => ["entwurf", "beschlossen", "geplant"].includes(p.status_recht)).map((p) => p.id));
    for (const p of [...a.gilt, ...a.unbekannt]) expect(radar.has(p.id), p.id).toBe(false);
  });

  it("liefert dieselben Ergebnisse wie die Erwartungen der Katalog-Fixtures (ohne Ereignisse)", () => {
    let geprueft = 0;
    for (const datei of fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".yaml"))) {
      const fx = parse(fs.readFileSync(path.join(FIXTURES, datei), "utf8")) as { stichtag: string; fakten: Record<string, unknown>; ereignisse?: unknown[]; erwartet: Record<string, string> };
      if (fx.ereignisse?.length || Object.keys(fx.fakten).some((k) => !k.startsWith("profil."))) continue;
      const profil = Object.fromEntries(Object.entries(fx.fakten).map(([k, w]) => [k.slice("profil.".length), w])) as Profil;
      const a = auswertung(profil, fx.stichtag);
      for (const [id, erwartet] of Object.entries(fx.erwartet)) {
        if (KATALOG.pflichten.find((p) => p.id === id && ["entwurf", "beschlossen", "geplant"].includes(p.status_recht))) continue;
        const ist = ids(a.gilt).includes(id) || ids(a.gruendung).includes(id) ? "gilt" : ids(a.unbekannt).includes(id) ? "unbekannt" : "gilt_nicht";
        expect(ist, `${datei}: ${id}`).toBe(erwartet);
        geprueft++;
      }
    }
    expect(geprueft).toBeGreaterThan(20);
  });

  it("zählt Pflichten als erledigt durch Haken oder eine geteilte, vollständige Unterlage", () => {
    const a = auswertung(salon, "2026-10-12");
    let s = erledigtSetzen(LEERER_STAND, "arbeitsschutz.erste_hilfe", "2026-10-12");
    expect(fortschritt(a, s).fertig).toBe(1);
    s = erledigtSetzen(s, "arbeitsschutz.erste_hilfe", null);
    expect(fortschritt(a, s).fertig).toBe(0);
    // vollständige Unterlage zählt erst, wenn sie als PDF geteilt bzw. gedruckt wurde
    const [s2, u] = anlegen(s, "hautschutzplan", new Date("2026-10-12T08:00:00Z"), "h");
    const voll = { ...s2, unterlagen: [{ ...u, daten: { ...u.daten, eintraege: [{ anlass: "Haare waschen", schutz: "", handschuhe: "", reinigung: "", pflege: "" }] } }] };
    expect(fortschritt(a, voll).fertig).toBe(0);
    const ausgegeben = { ...voll, unterlagen: voll.unterlagen.map((x) => ({ ...x, ausgegeben: "2026-10-12T09:00:00Z" })) };
    const f = fortschritt(a, ausgegeben);
    expect(f.fertig).toBe(1);
    expect(f.prozent).toBe(Math.round((1 / a.gilt.length) * 100));
  });

  it("hakt wiederkehrende Pflichten nur bis zum nächsten Termin ab", () => {
    const a = auswertung(salon, "2026-10-12");
    const p = a.gilt.find((x) => x.wiederkehrend && x.naechsterTermin);
    expect(p, "wiederkehrende Pflicht mit Termin").toBeTruthy();
    const fuer = (termin: string | null) => istErledigt(p!, { ...erledigtSetzen(LEERER_STAND, p!.id, "2026-10-12", termin), unterlagen: [] });
    expect(fuer(p!.naechsterTermin)).toBe(true);
    expect(fuer("2020-01-10")).toBe(false);
    // wiederkehrende Pflichten erledigt keine Unterlage auf Dauer
    expect(a.gilt.filter((x) => x.wiederkehrend).every((x) => !istErledigt(x, { erledigt: {}, unterlagen: [], betrieb: LEERER_STAND.betrieb }))).toBe(true);
  });

  it("trennt Gründungsschritte bei bestehenden Betrieben ab und nennt Gründe", () => {
    const neu = auswertung({ ...salon, gruendungsdatum: "2026-09-01" }, "2026-10-12");
    const alt = auswertung({ ...salon, gruendungsdatum: "2019-05-01" }, "2026-10-12");
    expect(ids(neu.gilt)).toContain("gruendung.gewerbeanzeige");
    expect(ids(alt.gilt)).not.toContain("gruendung.gewerbeanzeige");
    expect(ids(alt.gruendung)).toContain("gruendung.gewerbeanzeige");
    expect(alt.gruendung.every((p) => KATALOG.pflichten.find((k) => k.id === p.id)?.phase === "gruendung")).toBe(true);
    // jede geltende Pflicht hat einen Grund („Warum für dich“)
    for (const p of alt.gilt) expect(p.grund, p.id).not.toBe("");
  });

  it("schlägt Zusatzfragen vor, die unklare Pflichten klären", () => {
    const z = zusatzFragen(salon, "2026-10-12");
    expect(z.length).toBeGreaterThan(0);
    expect(z.length).toBeLessThanOrEqual(5);
    for (const f of z) expect(frageZu(f), f).toBeTruthy();
    const vorher = auswertung(salon, "2026-10-12").unbekannt.length;
    const antworten: Profil = { ...salon };
    for (const f of z) {
      const q = frageZu(f)!;
      antworten[f] = q.art === "janein" ? false : q.art === "zahl" || q.art === "betrag" ? 0 : q.art === "mehrfach" ? [Object.keys(q.optionen ?? {})[0]!] : q.art === "auswahl" ? Object.keys(q.optionen ?? {})[0]! : null;
    }
    expect(auswertung(antworten, "2026-10-12").unbekannt.length).toBeLessThan(vorher);
  });

  it("speichert Antworten, übernimmt das Bundesland in „Mein Betrieb“ und liest den Stand tolerant", () => {
    let s = profilSetzen(LEERER_STAND, { bundesland: "BY" }, "Bayern");
    expect(s.betrieb.bundesland).toBe("Bayern");
    s = profilSetzen({ ...s, betrieb: { ...s.betrieb, bundesland: "Hessen" } }, { bundesland: "BY" }, "Bayern");
    expect(s.betrieb.bundesland).toBe("Hessen");
    const gelesen = standAus(JSON.stringify({ profil: { rechtsform: "gmbh", "taetigkeit.branchen": ["handwerk"], boese: { x: 1 } }, erledigt: { a: "2026-10-12", b: 5 } }));
    expect(gelesen.profil).toEqual({ rechtsform: "gmbh", "taetigkeit.branchen": ["handwerk"] });
    expect(gelesen.erledigt).toEqual({ a: "2026-10-12" });
  });
});
