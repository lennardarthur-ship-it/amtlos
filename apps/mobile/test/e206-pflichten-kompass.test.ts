/**
 * E-206: Pflichten-Kompass – „unbekannt“ heißt nie „trifft nicht zu“ (Befunde des externen Prüfers, Oktober 2026).
 * Alle Fälle laufen durch dieselbe Auswertung wie die App (`auswertung` aus src/pflichten/check.ts).
 */
import { describe, expect, it } from "vitest";
import { StandardKalender, plusMonate } from "@amtlos/fristen";
import { SCHRITTE } from "@amtlos/i18n";
import { auswerten, mitAbgeleitetenFakten, type Bedingung, type Katalog, type Pflicht } from "@amtlos/rules-engine";
import { BESTAND_AB_MONATEN, KATALOG, auswertung, ereignisseAusStand, profilMitStand, type Profil } from "../src/pflichten/check";

const STICHTAG = "2026-10-26";

/** Café-Gründerin: Start am 1.12., zwölf Beschäftigte geplant – so beantwortet, wie man den Check durchklickt. */
const CAFE: Profil = {
  "taetigkeit.branchen": ["gastronomie_lebensmittel"],
  rechtsform: "einzelunternehmen",
  gruendungsdatum: "2026-12-01",
  "taetigkeit.einordnung": "gewerbe",
  bundesland: "SN",
  "betriebsstaetten.anzahl": 1,
  "beschaeftigte.gesamt": 12,
  "beschaeftigte.minijob": 4,
  "beschaeftigte.jugendlich": 0,
  "beschaeftigte.azubi": 0,
  "personal.sofortmeldebranchen": ["gastronomie"],
  "ifsg.beschaeftigte": "erstmals",
  "personal.drittstaaten": false,
  "personal.lohn_durch": "selbst",
  "kasse.bargeld": true,
  "kasse.elektronisch": true,
  "online.website": false,
  "ust.kleinunternehmer": false,
  "ust.voranmeldung_rhythmus": "unklar",
  steuerberater: false,
};

const alle = (a: ReturnType<typeof auswertung>) => [...a.gilt, ...a.gruendung, ...a.unbekannt, ...a.beiEinstellung];
const finde = (a: ReturnType<typeof auswertung>, id: string) => alle(a).find((p) => p.id === id);

describe("E-206 Befund 1: geplante Beschäftigte vor dem Start", () => {
  const a = auswertung(CAFE, STICHTAG);
  it.each([
    ["personal.sofortmeldung", "2026-12-01"],
    ["personal.sv_anmeldung", "2027-01-12"],
    ["arbeitsschutz.erstunterweisung", "2026-12-01"],
    ["branche.gastro_ifsg_belehrung", "2026-12-01"],
    ["branche.gastro_ifsg_bescheinigung", "2026-11-30"],
  ])("%s gilt mit Termin %s (erster Arbeitstag bzw. Katalogfrist)", (id, termin) => {
    const p = a.gilt.find((x) => x.id === id);
    expect(p, id).toBeDefined();
    expect(p!.naechsterTermin).toBe(termin);
  });
});

describe("E-206 Befund 2: Lohnsteuer-Anmeldung ohne Angabe des Anmeldezeitraums", () => {
  it("Arbeitgeber ohne Zusatzfrage: Lohnsteuer-Anmeldung ist sichtbar, nicht „trifft nicht zu“", () => {
    const a = auswertung({ ...CAFE, gruendungsdatum: "2025-03-01" }, STICHTAG);
    const p = finde(a, "personal.lohnsteuer_anmeldung");
    expect(p).toBeDefined();
    // der Rhythmus bleibt offen – gefragt wird nach dem Anmeldezeitraum
    expect(p!.offeneFragen).toContain("personal.lohnsteuer_anmeldezeitraum");
  });
  it("„keine“ (nur Minijobs mit Pauschsteuer) bleibt „trifft nicht zu“; angegebener Rhythmus ergibt Termine", () => {
    const keine = auswertung({ ...CAFE, gruendungsdatum: "2025-03-01", "personal.lohnsteuer_anmeldezeitraum": "keine" }, STICHTAG);
    expect(finde(keine, "personal.lohnsteuer_anmeldung")).toBeUndefined();
    const monatlich = auswertung({ ...CAFE, gruendungsdatum: "2025-03-01", "personal.lohnsteuer_anmeldezeitraum": "monatlich" }, STICHTAG);
    expect(finde(monatlich, "personal.lohnsteuer_anmeldung")!.naechsterTermin).toBe("2026-11-10");
  });
});

describe("E-206 Befund 3: Umsatzsteuer-Voranmeldung bei „weiß ich nicht“", () => {
  it("Gründung 2027, „weiß ich nicht“: monatlich – erster Termin 10.02.2027 für Januar", () => {
    const a = auswertung({ ...CAFE, gruendungsdatum: "2027-01-04" }, STICHTAG);
    const p = finde(a, "steuern.ust_voranmeldung")!;
    expect(p.naechsterTermin).toBe("2027-02-10");
    expect(p.termine.slice(0, 3)).toEqual(["2027-02-10", "2027-03-10", "2027-04-12"]);
  });
  it("Gründung 2026 (Café ab 1.12.), „weiß ich nicht“: monatlich – Dezember am 11.01.2027 statt Q4 am 11.01. und dann erst April", () => {
    const p = finde(auswertung(CAFE, STICHTAG), "steuern.ust_voranmeldung")!;
    expect(p.termine.slice(0, 2)).toEqual(["2027-01-11", "2027-02-10"]);
  });
  it("„weiß ich nicht“ allgemein (Bestandsbetrieb ohne Vorjahressteuer): der frühere, monatliche Termin", () => {
    const p = finde(auswertung({ ...CAFE, gruendungsdatum: "2019-01-01" }, STICHTAG), "steuern.ust_voranmeldung")!;
    expect(p.naechsterTermin).toBe("2026-11-10");
  });
  it("T-238: Gründung 01/2027 mit Angabe „vierteljährlich“ – monatlich ab 10.02.2027, mit dem Hinweis aus dem Katalog", () => {
    const p = finde(auswertung({ ...CAFE, gruendungsdatum: "2027-01-04", "ust.voranmeldung_rhythmus": "quartalsweise" }, STICHTAG), "steuern.ust_voranmeldung")!;
    expect(p.termine.slice(0, 3)).toEqual(["2027-02-10", "2027-03-10", "2027-04-12"]);
    expect(p.rhythmusHinweise).toEqual(["Hast du 2026 oder später gegründet, gibst du ab 2027 im Gründungsjahr und im Folgejahr monatlich ab (§ 18 Abs. 2 Satz 4 UStG)."]);
    // Mitte 2028 gerechnet: Dezember 2028 noch monatlich, danach vierteljährlich
    const spaeter = finde(auswertung({ ...CAFE, gruendungsdatum: "2027-01-04", "ust.voranmeldung_rhythmus": "quartalsweise" }, "2028-10-20"), "steuern.ust_voranmeldung")!;
    expect(spaeter.termine).toEqual(["2028-11-10", "2028-12-11", "2029-01-10", "2029-04-10", "2029-07-10", "2029-10-10"]);
  });
  it("T-238: Gründung 2026 (Café ab 1.12.), Angabe „vierteljährlich“ – Q4 2026 vierteljährlich, 2027 monatlich", () => {
    const p = finde(auswertung({ ...CAFE, "ust.voranmeldung_rhythmus": "quartalsweise" }, STICHTAG), "steuern.ust_voranmeldung")!;
    expect(p.termine.slice(0, 3)).toEqual(["2027-01-11", "2027-02-10", "2027-03-10"]);
    expect(p.rhythmusHinweise).toHaveLength(1);
  });
  it("bekannte Vorjahressteuer und angegebener Rhythmus entscheiden weiter wie bisher", () => {
    const bestand = { ...CAFE, gruendungsdatum: "2019-01-01" };
    expect(finde(auswertung({ ...bestand, "ust.zahllast_vorjahr": 4000 }, STICHTAG), "steuern.ust_voranmeldung")!.naechsterTermin).toBe("2027-01-11");
    expect(finde(auswertung({ ...bestand, "ust.voranmeldung_rhythmus": "quartalsweise" }, STICHTAG), "steuern.ust_voranmeldung")!.naechsterTermin).toBe("2027-01-11");
  });
});

/*
 * Systematische Absicherung (Gründer, E-206): Über realistische Profile – noch nicht gestartet mit geplanten Beschäftigten,
 * Einzelunternehmen, UG/GmbH, Café, Handwerk – und mit „weiß ich nicht“ bzw. ohne Antwort bei jeder weiteren Frage darf
 * keine Pflicht nur deshalb „trifft nicht zu“ ergeben, weil eine Angabe fehlt. Prüfung: Dieselbe Auswertung wird mit
 * streng dreiwertiger Lesart wiederholt – „vorhanden“/„nicht vorhanden“ über eine fehlende Angabe, jeder Vergleich mit
 * „weiß ich nicht“ und „eingetreten“ über ein nur geplantes Ereignis zählen als unbekannt. Ist eine Pflicht dann nicht
 * eindeutig ausgeschlossen, muss die App sie zeigen (gilt oder „hängt ab“).
 */
const UNBEKANNT: Bedingung = { feld: "__e206_unbekannt__", op: "==", wert: true };
/** Felder, deren Frage „Weiß ich nicht“ anbietet (Optionsschlüssel „unklar“) */
const MIT_UNKLAR = SCHRITTE.flatMap((s) => s.fragen).filter((f) => f.optionen && "unklar" in f.optionen).map((f) => f.feld);

function streng(b: Bedingung, fakten: Record<string, unknown>, nurGeplant: Set<string>): Bedingung {
  if ("all" in b) return { ...b, all: b.all.map((x) => streng(x, fakten, nurGeplant)) };
  if ("any" in b) return { ...b, any: b.any.map((x) => streng(x, fakten, nurGeplant)) };
  if ("not" in b) return { ...b, not: streng(b.not, fakten, nurGeplant) };
  if ("immer" in b) return b;
  if ("ereignis" in b) return b.op === "eingetreten" && nurGeplant.has(b.ereignis) ? UNBEKANNT : b;
  // finanzen.* sind keine Fragen, sondern Summen aus Rechnungen und Kasse auf dem Gerät: ohne Einträge gibt es nichts zu warnen
  if (b.feld.startsWith("finanzen.")) return b;
  const wert = fakten[b.feld];
  if (wert === "unklar") return UNBEKANNT;
  if ((b.op === "vorhanden" || b.op === "nicht_vorhanden") && (wert === undefined || wert === null)) return UNBEKANNT;
  return b;
}

/**
 * Bewusste, vom Prüfer freigegebene Vermutungen „ohne Angabe nicht betroffen“ – E-215 (Rechtsanwalt 26.10.2026, T-239):
 * nur noch außerhalb der Branchen, in denen der Fall typisch ist. Kommt ein Fall hinzu, schlägt der Test fehl – erst
 * entscheiden, dann eintragen.
 * - datenschutz.dsb: außerhalb von Gesundheit/Pflege und Kosmetik nur bei Hinweisen (Gesundheitsdaten, Video, Ortung) oder
 *   angegebenen Gründen; in diesen Branchen „hängt ab“, solange die Angaben fehlen;
 * - it_sicherheit.nis2_*: außerhalb der Branchen, die der Katalog NIS2 zuordnet (IT und „Andere“, seit E-217 auch Gesundheit und
 *   Pflege, Transport und Logistik, Gastronomie und Lebensmittel – Rechtsanwalt 27.10.2026), gilt ein Betrieb unter
 *   50 Beschäftigten ohne Umsatzangabe als klein; Registrierung und Meldepflichten folgen nur auf „ja“ – bei „weiß ich nicht“
 *   steht in diesen Branchen „NIS2 prüfen“ mit der Frage (Ausnahme nur, wenn „NIS2 prüfen“ sichtbar ist).
 */
const DSB_BRANCHEN = ["gesundheit_pflege", "beauty_kosmetik"];
const NIS2_BRANCHEN = ["it_agentur_freelancer", "sonstige", "gesundheit_pflege", "transport_logistik", "gastronomie_lebensmittel"];
function vermutung(id: string, antworten: Profil, sichtbar: Set<string>): boolean {
  const branchen = (antworten["taetigkeit.branchen"] as string[] | undefined) ?? [];
  if (id === "datenschutz.dsb") return !branchen.some((b) => DSB_BRANCHEN.includes(b));
  if (!id.startsWith("it_sicherheit.nis2_")) return false;
  if (!branchen.some((b) => NIS2_BRANCHEN.includes(b))) return true;
  return id !== "it_sicherheit.nis2_pruefen" && antworten["nis2.betroffen"] === "unklar" && sichtbar.has("it_sicherheit.nis2_pruefen");
}

/** Pflichten, die ausgeblendet sind, obwohl sie nur an einer fehlenden bzw. unklaren Angabe scheitern. */
function stillAusgeblendet(antworten: Profil, stichtag = STICHTAG): string[] {
  const sichtbar = new Set(alle(auswertung(antworten, stichtag)).map((p) => p.id));
  const profil = profilMitStand(antworten, stichtag);
  const fakten: Record<string, unknown> = Object.fromEntries(Object.entries(profil).filter(([, w]) => w !== null && w !== undefined).map(([k, w]) => [`profil.${k}`, w]));
  const ereignisse = ereignisseAusStand(profil, stichtag);
  const nurGeplant = new Set(ereignisse.filter((e) => e.datum > stichtag && !ereignisse.some((x) => x.typ === e.typ && x.datum <= stichtag)).map((e) => e.typ));
  const abgeleitet = mitAbgeleitetenFakten(fakten, stichtag);
  const katalog: Katalog = { ...KATALOG, pflichten: KATALOG.pflichten.map((p) => ({ ...p, ausloeser: streng(p.ausloeser, abgeleitet, nurGeplant) }) as Pflicht) };
  const bestehend = typeof profil.gruendungsdatum === "string" && profil.gruendungsdatum <= plusMonate(stichtag, -BESTAND_AB_MONATEN);
  const phase = new Map(KATALOG.pflichten.map((p) => [p.id, (p as Pflicht & { phase?: string }).phase]));
  return auswerten({ katalog, fakten, ereignisse, stichtag, kalender: new StandardKalender() })
    .filter((e) => !e.radar && e.ergebnis !== "gilt_nicht" && !sichtbar.has(e.pflicht_id))
    // bewusst: Gründungsschritte eines laufenden Betriebs ohne passende Frage entfallen (R12 Coach #1)
    .filter((e) => !(bestehend && phase.get(e.pflicht_id) === "gruendung"))
    .map((e) => e.pflicht_id)
    .filter((id) => !vermutung(id, antworten, sichtbar));
}

const PROFILE: Record<string, Profil> = {
  "Café, noch nicht gestartet, 12 Beschäftigte geplant": { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", gruendungsdatum: "2026-12-01", bundesland: "SN", "beschaeftigte.gesamt": 12 },
  "Einzelunternehmen IT ohne Team, seit 2024": { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "einzelunternehmen", gruendungsdatum: "2024-04-01", bundesland: "BE", "beschaeftigte.gesamt": 0 },
  "UG Onlinehandel in Gründung, 2 Beschäftigte geplant": { "taetigkeit.branchen": ["onlinehandel"], rechtsform: "ug", gruendungsdatum: "2027-01-15", bundesland: "HH", "beschaeftigte.gesamt": 2 },
  "GmbH Agentur, 8 Beschäftigte, seit 2022": { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "gmbh", gruendungsdatum: "2022-02-01", bundesland: "BY", "beschaeftigte.gesamt": 8 },
  "Handwerk Elektro, 3 Beschäftigte, seit 2019": { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", gruendungsdatum: "2019-06-01", bundesland: "NW", "beschaeftigte.gesamt": 3 },
  "Handwerk Tischlerei, startet 2027, 1 Beschäftigte geplant": { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", gruendungsdatum: "2027-03-01", bundesland: "BW", "beschaeftigte.gesamt": 1 },
  "Café GmbH, läuft seit 2025, 5 Beschäftigte": { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "gmbh", gruendungsdatum: "2025-05-01", bundesland: "HE", "beschaeftigte.gesamt": 5 },
  "Friseur, gerade gestartet, 2 Beschäftigte": { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", gruendungsdatum: "2026-09-01", bundesland: "NI", "beschaeftigte.gesamt": 2 },
  // E-215: Branchen, in denen „ohne Angabe nicht betroffen“ nicht mehr gilt (Datenschutzbeauftragter bzw. NIS2)
  "Pflegedienst GmbH, 15 Beschäftigte, seit 2023": { "taetigkeit.branchen": ["gesundheit_pflege"], rechtsform: "gmbh", gruendungsdatum: "2023-01-01", bundesland: "RP", "beschaeftigte.gesamt": 15 },
  "Andere Branche, 5 Beschäftigte, seit 2021": { "taetigkeit.branchen": ["sonstige"], rechtsform: "einzelunternehmen", gruendungsdatum: "2021-05-01", bundesland: "SH", "beschaeftigte.gesamt": 5 },
};
const VARIANTEN: Record<string, (p: Profil) => Profil> = {
  "ohne weitere Antworten": (p) => p,
  "„weiß ich nicht“ überall": (p) => ({ ...p, ...Object.fromEntries(MIT_UNKLAR.map((f) => [f, "unklar"])) }),
  "nur Startdatum unbekannt": (p) => { const { gruendungsdatum: _g, ...rest } = p; return rest; },
};

describe("E-206 Absicherung: unbekannt blendet keine Pflicht aus", () => {
  for (const [name, p] of Object.entries(PROFILE))
    for (const [v, f] of Object.entries(VARIANTEN))
      it(`${name} – ${v}`, () => {
        expect(stillAusgeblendet(f(p))).toEqual([]);
      });
});
