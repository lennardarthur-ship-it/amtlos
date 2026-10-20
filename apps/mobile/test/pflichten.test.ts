import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { VORLAGEN } from "@amtlos/fachlogik";
import { LEERER_STAND, anlegen, erledigtSetzen, profilSetzen, standAus } from "../src/unterlagen/speicher";
import { CHECK_FELDER, KATALOG, auswertung, checkFragen, ereignisseAusStand, dringlichkeit, erinnerungsPlan, fortschritt, frageZu, gruendungsSchritte, istErledigt, offeneFragenNachWirkung, selten, zusatzFragen, type PflichtInfo, type Profil } from "../src/pflichten/check";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../catalog/fixtures");
const salon: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "kasse.elektronisch": true, "online.website": false, "ust.kleinunternehmer": false, gruendungsdatum: "2024-03-01" };
const ids = (l: { id: string }[]) => l.map((p) => p.id);

describe("Pflichten-Check", () => {
  it("„Kurz klären“ fragt nur, was für den Betrieb gestellt wird – keine Investoren-Frage beim Einzelunternehmen", () => {
    const felder = offeneFragenNachWirkung(auswertung(salon, "2026-10-13"), salon).map((o) => o.feld);
    expect(felder).not.toContain("gesellschafter.auslaendische_investoren");
    const gmbh = { ...salon, rechtsform: "gmbh" };
    expect(offeneFragenNachWirkung(auswertung(gmbh, "2026-10-13"), gmbh).map((o) => o.feld)).toContain("gesellschafter.auslaendische_investoren");
  });
  it("bestehender Betrieb mit Beschäftigten: Pflichten mit Auslöser „einstellung“ gelten (Ereignisse wie auf dem Server)", () => {
    const cafe: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "SN", "beschaeftigte.gesamt": 2, "kasse.elektronisch": true, "online.website": true, "ust.kleinunternehmer": false, steuerberater: true, gruendungsdatum: "2022-03-01" };
    expect(ereignisseAusStand(cafe, "2026-01-15")).toEqual([
      { typ: "einstellung", datum: "2022-03-01" },
      { typ: "erste_einstellung", datum: "2022-03-01" },
    ]);
    const a = auswertung(cafe, "2026-01-15");
    expect(ids(a.gilt)).toEqual(expect.arrayContaining(["branche.gastro_ifsg_belehrung", "personal.nachweisgesetz", "personal.sv_anmeldung", "arbeitsschutz.erstunterweisung"]));
    // Termine der Einstellung liegen in der Vergangenheit – kein erfundener „überfälliger“ Termin
    for (const id of ["branche.gastro_ifsg_belehrung", "personal.nachweisgesetz"]) expect(a.gilt.find((p) => p.id === id)!.naechsterTermin, id).toBeNull();
    // ohne Beschäftigte keine Einstellung, also auch keine dieser Pflichten
    const allein = auswertung({ ...cafe, "beschaeftigte.gesamt": 0 }, "2026-01-15");
    expect(ereignisseAusStand({ ...cafe, "beschaeftigte.gesamt": 0 }, "2026-01-15")).toEqual([]);
    for (const id of ["branche.gastro_ifsg_belehrung", "personal.nachweisgesetz", "personal.sv_anmeldung"]) expect(ids(allein.gilt), id).not.toContain(id);
    // Gründung in der Zukunft: Einstellung geplant, noch nicht eingetreten
    const spaeter = auswertung({ ...cafe, gruendungsdatum: "2026-06-01" }, "2026-01-15");
    expect(ids(spaeter.gilt)).not.toContain("personal.nachweisgesetz");
  });
  it("ausgegebene Unterweisung ⇒ Wiederholung ein Jahr später; die Unterweisung selbst hakt die Wiederholung nicht ab", () => {
    const u = { vorlage: "unterweisung", daten: { datum: "2026-02-10", thema: "Jährliche Unterweisung" }, ausgegeben: "2026-02-10T10:00:00Z" };
    expect(ereignisseAusStand({}, "2026-10-20", [u, { ...u, ausgegeben: undefined }, { ...u, storniertDurch: "x" }])).toEqual([{ typ: "unterweisung_durchgefuehrt", datum: "2026-02-10" }]);
    const a = auswertung(salon, "2026-10-20", [u]);
    const w = a.gilt.find((p) => p.id === "arbeitsschutz.unterweisung_wiederholen");
    expect(w?.naechsterTermin).toBe("2027-02-10");
    expect(w?.wiederkehrend).toBe(true);
    const stand = { ...LEERER_STAND, unterlagen: [{ id: "u1", vorlage: "unterweisung", daten: u.daten, erstellt: "2026-02-10", geaendert: "2026-02-10", ausgegeben: u.ausgegeben }] };
    expect(istErledigt(w!, { erledigt: {}, unterlagen: stand.unterlagen, betrieb: stand.betrieb })).toBe(false);
    expect(ids(auswertung(salon, "2026-10-20").gilt)).not.toContain("arbeitsschutz.unterweisung_wiederholen");
  });
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

  it("ordnet offene Pflichten nach Dringlichkeit (14 / 45 Tage) und plant Erinnerungen", () => {
    const heute = "2026-10-12";
    const a = auswertung(salon, heute);
    const leer = { erledigt: {}, unterlagen: [], betrieb: LEERER_STAND.betrieb };
    const d = dringlichkeit(a, leer, heute);
    // jede offene Pflicht steht in genau einem Abschnitt
    expect(d.jetzt.length + d.naechsteWochen.length + d.imBlick.length).toBe(a.gilt.length);
    expect(new Set([...d.jetzt, ...d.naechsteWochen, ...d.imBlick].map((p) => p.id)).size).toBe(a.gilt.length);
    for (const p of d.jetzt) expect(p.naechsterTermin ? p.naechsterTermin <= "2026-10-26" : p.schwere === "hoch", p.id).toBe(true);
    for (const p of d.naechsteWochen) expect(p.naechsterTermin! > "2026-10-26" && p.naechsterTermin! <= "2026-11-26", p.id).toBe(true);
    // Erinnerungen: nur mit Termin, nie vor heute, höchstens 3 Tage vorher, sortiert und begrenzt
    const plan = erinnerungsPlan(a, leer, heute);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(30);
    for (const e of plan) {
      expect(e.am >= heute && e.am <= e.termin, e.pflichtId).toBe(true);
      expect(e.am === heute || e.am === new Date(Date.parse(e.termin + "T00:00:00Z") - 3 * 864e5).toISOString().slice(0, 10)).toBe(true);
    }
    expect([...plan].map((e) => e.am)).toEqual([...plan].map((e) => e.am).sort());
    expect(erinnerungsPlan(a, leer, heute, 3, 2)).toHaveLength(Math.min(2, plan.length));
    // abgehakte Pflicht verschwindet aus „Jetzt dran“ und aus den Erinnerungen
    const erste = plan[0]!;
    const p = a.gilt.find((x) => x.id === erste.pflichtId)!;
    const s = { ...erledigtSetzen(LEERER_STAND, p.id, heute, p.naechsterTermin), unterlagen: [] };
    expect(erinnerungsPlan(a, s, heute).some((e) => e.pflichtId === p.id)).toBe(false);
    expect(dringlichkeit(a, s, heute).jetzt.some((x) => x.id === p.id)).toBe(false);
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

  it("zeigt „Schon erledigt?“ nur jungen Betrieben mit mehreren offenen Gründungsschritten", () => {
    const heute = "2026-10-12";
    const leer = { erledigt: {}, unterlagen: [], betrieb: LEERER_STAND.betrieb };
    const jung = { ...salon, gruendungsdatum: "2026-09-01" };
    const a = auswertung(jung, heute);
    const l = gruendungsSchritte(a, jung, leer, heute);
    expect(l.length).toBeGreaterThanOrEqual(3);
    expect(ids(l)).toContain("gruendung.gewerbeanzeige");
    expect(l.every((p) => KATALOG.pflichten.find((k) => k.id === p.id)?.phase === "gruendung")).toBe(true);
    // abgehakte Schritte fallen heraus; bleiben weniger als drei, entfällt die Karte
    const fast = { ...leer, erledigt: Object.fromEntries(l.slice(0, l.length - 2).map((p) => [p.id, heute])) };
    expect(gruendungsSchritte(a, jung, fast, heute)).toEqual([]);
    expect(gruendungsSchritte(a, jung, { ...leer, erledigt: { [l[0]!.id]: heute } }, heute)).toHaveLength(l.length - 1);
    // bestehender Betrieb, Beginn in der Zukunft oder ohne Datum: keine Karte
    expect(gruendungsSchritte(auswertung(salon, heute), salon, leer, heute)).toEqual([]);
    const geplant = { ...salon, gruendungsdatum: "2027-01-01" };
    expect(gruendungsSchritte(auswertung(geplant, heute), geplant, leer, heute)).toEqual([]);
    const ohne = { ...salon, gruendungsdatum: null };
    expect(gruendungsSchritte(auswertung(ohne, heute), ohne, leer, heute)).toEqual([]);
  });

  it("zählt Pflichten, die höchstens einmal im Jahr anstehen", () => {
    const p = (termine: string[]) => ({ termine }) as unknown as PflichtInfo;
    expect(selten([p([]), p(["2026-11-01"]), p(["2026-11-01", "2026-12-01"])])).toBe(true);
    expect(selten([p([]), p(["2026-11-01", "2026-12-01"])])).toBe(false);
  });

  it("schlägt Zusatzfragen vor, die unklare Pflichten klären", () => {
    const z = zusatzFragen(salon, "2026-10-12");
    expect(z.length).toBeGreaterThan(0);
    expect(z.length).toBeLessThanOrEqual(8);
    // nach Wirkung sortiert: die erste Frage klärt am meisten
    const w = offeneFragenNachWirkung(auswertung(salon, "2026-10-12"), salon);
    expect(w.map((o) => o.anzahl)).toEqual([...w.map((o) => o.anzahl)].sort((x, y) => y - x));
    expect(z).toEqual(w.slice(0, 8).map((o) => o.feld));
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
