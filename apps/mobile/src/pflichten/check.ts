/**
 * Pflichten-Check (E-126): wenige Fragen zum Betrieb, dann rechnet die Regel-Engine auf dem Gerät aus, welche Pflichten
 * aus dem Katalog gelten – derselbe Katalog und dieselbe Engine wie auf dem Server (E-119). Nichts wird erfunden:
 * Titel, Texte, Termine und Einstufungen kommen aus dem Katalog (fachlich noch ungeprüft, das sagt die App).
 * Reine Funktionen, ohne Gerät testbar.
 */
import { VORLAGEN, fehlendeAngaben, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
// Monatsende-Regel der Fristen: 31.01. + 1 Monat = 28./29.02., 29.02. + 12 Monate = 28.02.
import { StandardKalender, plusMonate } from "@amtlos/fristen";
import { SCHRITTE, type Frage } from "@amtlos/i18n";
import { auswerten, entscheidendeSaetze, zuErfragendeFakten, type Ereignis, type Katalog, type Pflicht } from "@amtlos/rules-engine";
import roh from "./katalog.json";

export const KATALOG = roh as unknown as Katalog;

/** Regelwert aus dem Katalog (z. B. Aufbewahrungsfristen) – keine Zahl in der App ist erfunden. */
export function regelwert(id: string): number | null {
  const r = (KATALOG as unknown as { regelwerte?: { id: string; wert: unknown }[] }).regelwerte?.find((x) => x.id === id);
  return typeof r?.wert === "number" ? r.wert : null;
}

/** Profil wie im Server (Schlüssel ohne „profil.“): Auswahl → Text, Mehrfach → Liste, Ja/Nein → boolean, Zahl → number, Datum → ISO. */
export type Profil = Record<string, string | number | boolean | string[] | null>;

/**
 * Die Fragen des Checks, in dieser Reihenfolge: der Schnellstart (E-111) plus Kasse und Website. Branche zuerst – die
 * kennt jede und jeder; die Gesellschafts-Frage nur bei UG und GmbH (wie im Fragebogen). R10: dazu die Fragen, die je
 * Branche entscheiden (Minijob, unter 18, Sofortmeldebranche, Geräte, Gefahrstoffe, Bauleistungen, Lohnbüro) – nur, wenn
 * sie passen (siehe `FRAGE_PASST`).
 */
export const CHECK_FELDER = [
  "taetigkeit.branchen",
  "rechtsform",
  "gesellschaft.handelsregister",
  "taetigkeit.einordnung",
  "bundesland",
  "beschaeftigte.gesamt",
  "beschaeftigte.minijob",
  "beschaeftigte.jugendlich",
  "personal.sofortmeldebranchen",
  "personal.lohn_durch",
  "arbeitsschutz.elektrische_geraete",
  "arbeitsschutz.gefahrstoffe",
  "bauleistungen.fuer_unternehmen",
  "kasse.elektronisch",
  "online.website",
  "online.social_media",
  "ust.kleinunternehmer",
  "steuerberater",
  "gruendungsdatum",
] as const;

const FRAGE = new Map<string, { frage: Frage; nurWenn?: { feld: string; in: string[] } }>();
for (const s of SCHRITTE) for (const f of s.fragen) FRAGE.set(f.feld, { frage: f, nurWenn: s.nurWenn });

// R10: Fragen, die nur zu bestimmten Betrieben passen – im Check und bei „Kurz klären“
const branchen = (p: Profil) => (Array.isArray(p["taetigkeit.branchen"]) ? (p["taetigkeit.branchen"] as string[]) : []);
const inBranche = (p: Profil, ...b: string[]) => branchen(p).some((x) => b.includes(x));
const mitTeam = (p: Profil) => typeof p["beschaeftigte.gesamt"] === "number" && (p["beschaeftigte.gesamt"] as number) >= 1;
const ohneTeam = (p: Profil) => p["beschaeftigte.gesamt"] === 0;
const freiberuflich = (p: Profil) => p.rechtsform === "freiberuf" || p["taetigkeit.einordnung"] === "freiberuf";
/** Einzelpersonen ohne Gesellschaft (Investoren-Frage nur für Gesellschaften, Nutzertest R10) */
export const EINZELPERSON = ["einzelunternehmen", "freiberuf", "ek"];
const PERSONAL_FRAGEN = ["beschaeftigte.minijob", "beschaeftigte.azubi", "beschaeftigte.jugendlich", "beschaeftigte.schwanger", "personal.sofortmeldebranchen", "personal.lohnsteuer_anmeldezeitraum", "personal.lohn_durch", "arbeitsschutz.elektrische_geraete", "arbeitsschutz.gefahrstoffe"];

/** Passt eine Frage überhaupt (immer, auch bei „Kurz klären“)? Bei 0 Beschäftigten keine Fragen zum Personal. */
function passtImmer(feld: string, p: Profil): boolean {
  if (PERSONAL_FRAGEN.includes(feld) && ohneTeam(p)) return false;
  // „Freiberuflich (ohne Gewerbe)“ beantwortet die Frage nach Gewerbe oder freiem Beruf schon (Nutzertest Lea)
  if (feld === "taetigkeit.einordnung" && p.rechtsform === "freiberuf") return false;
  if (feld === "gesellschafter.auslaendische_investoren" && typeof p.rechtsform === "string" && EINZELPERSON.includes(p.rechtsform)) return false;
  return true;
}

/**
 * Zusätzliche Bedingungen im Kern-Check: die branchentypischen Fragen nur, wo sie entscheiden (Nutzertests R10: Beauty
 * Gefahrstoffe und Geräte, Handwerk Bauleistungen, Geräte und unter 18, Gastronomie Minijob direkt nach der Zahl der
 * Beschäftigten); die Kassenfrage nicht für Freiberufler ohne Laden-Branche; Social Media nur ohne eigene Website.
 */
const FRAGE_PASST: Record<string, (p: Profil) => boolean> = {
  "beschaeftigte.minijob": mitTeam,
  "beschaeftigte.jugendlich": (p) => mitTeam(p) && inBranche(p, "handwerk", "bau", "beauty_kosmetik", "gastronomie_lebensmittel"),
  "personal.sofortmeldebranchen": (p) => mitTeam(p) && inBranche(p, "gastronomie_lebensmittel", "bau", "transport_logistik"),
  "personal.lohn_durch": mitTeam,
  "arbeitsschutz.elektrische_geraete": (p) => mitTeam(p) && inBranche(p, "handwerk", "bau", "beauty_kosmetik"),
  "arbeitsschutz.gefahrstoffe": (p) => mitTeam(p) && inBranche(p, "beauty_kosmetik", "handwerk", "bau"),
  "bauleistungen.fuer_unternehmen": (p) => inBranche(p, "handwerk", "bau"),
  "kasse.elektronisch": (p) => !freiberuflich(p) || inBranche(p, "gastronomie_lebensmittel", "beauty_kosmetik", "handwerk", "gesundheit_pflege"),
  "online.social_media": (p) => p["online.website"] === false,
};

/** Antworten, die aus einer anderen folgen (R10): „Freiberuflich (ohne Gewerbe)“ ⇒ freier Beruf, solange nichts anderes gewählt ist. */
export function folgeAntworten(feld: string, wert: Profil[string], profil: Profil): Profil {
  if (feld === "rechtsform" && wert === "freiberuf" && !beantwortet(profil, "taetigkeit.einordnung")) return { "taetigkeit.einordnung": "freiberuf" };
  return {};
}
/** Reihenfolge im Fragenkatalog – vom Alltäglichen zum Speziellen; entscheidet bei gleicher Wirkung */
const RANG = new Map([...FRAGE.keys()].map((k, i) => [k, i]));

export const frageZu = (feld: string): Frage | undefined => FRAGE.get(feld)?.frage;

/**
 * Fragen, die für dieses Profil gestellt werden (Bedingungen wie „nur bei UG/GmbH“ beachtet). Die Kern-Bedingungen
 * (`FRAGE_PASST`) gelten für alle Felder außer `frei` – ohne Angabe nur für den Kern-Check selbst, nicht für Nachfragen.
 */
export function checkFragen(profil: Profil, felder: readonly string[] = CHECK_FELDER, frei: readonly string[] = felder === CHECK_FELDER ? [] : felder): Frage[] {
  return felder
    .map((f) => FRAGE.get(f))
    .filter((x): x is { frage: Frage; nurWenn?: { feld: string; in: string[] } } => Boolean(x))
    .filter((x) => !x.nurWenn || x.nurWenn.in.includes(String(profil[x.nurWenn.feld])))
    .filter((x) => passtImmer(x.frage.feld, profil) && (frei.includes(x.frage.feld) || (FRAGE_PASST[x.frage.feld]?.(profil) ?? true)))
    .map((x) => x.frage);
}

/** Kern-Fragen, die noch offen sind (für „Check fortsetzen“ nach einem Abbruch, Nutzertest Lea). */
export const offeneKernFragen = (profil: Profil) => checkFragen(profil).filter((f) => !beantwortet(profil, f.feld)).map((f) => f.feld);

export const beantwortet = (profil: Profil, feld: string) => profil[feld] !== undefined && profil[feld] !== null && !(Array.isArray(profil[feld]) && (profil[feld] as string[]).length === 0);

export interface PflichtInfo {
  id: string;
  titel: string;
  kurz: string;
  erklaerung: string;
  kategorie: string;
  schwere: "niedrig" | "mittel" | "hoch";
  stelle: string;
  rechtsgrundlage: string[];
  quellen: { titel: string; url: string }[];
  /** Grund laut Katalog, z. B. „Du beschäftigst mindestens eine Person.“ */
  grund: string;
  /** Vorlage in der App, die diese Pflicht belegt (die erste; sie zählt für „erledigt durch Unterlage“) */
  vorlage: string | null;
  /** alle Vorlagen zu dieser Pflicht, z. B. Gefahrstoffverzeichnis und Betriebsanweisung */
  vorlagen: string[];
  /** nächster Termin aus dem Katalog (wiederkehrende Pflichten) */
  naechsterTermin: string | null;
  /** alle Termine ab heute in den nächsten zwölf Monaten (ISO, aufsteigend) – für den Jahresblick */
  termine: string[];
  /** Fragen, die für eine unklare Pflicht noch fehlen (Profilfelder) */
  offeneFragen: string[];
  /** wiederkehrend (z. B. jährlich): „erledigt“ gilt nur bis zum nächsten Termin */
  wiederkehrend: boolean;
  geprueft: boolean;
  /** R10: Pflicht, Hinweis oder freiwillige Option (Katalog `einordnung`) – im Ergebnis getrennt gezählt */
  einordnung: "pflicht" | "hinweis" | "option";
  /** R10: wann die Pflicht als erledigt gilt (Katalog `erledigung`) */
  erledigung: Erledigungsart;
  /** R10: Lohn-Meldung, die laut Antwort ein Lohnbüro bzw. die Steuerberatung übernimmt */
  lohnbuero: boolean;
  /**
   * R10: Pflicht je Person (Unterweisung vor Arbeitsbeginn): Namen der neu eingestellten Mitarbeiter („Beschäftigt seit“
   * in den letzten sechs Monaten oder demnächst) – erledigt erst, wenn alle in einer geteilten Unterweisung stehen.
   */
  personen: string[];
}

/** R10: Pflichten, die je neu eingestellter Person zu erfüllen sind (Nutzertest Jonas: ein Nachweis für den Azubi erledigte sie für alle). */
const JE_PERSON = new Set(["arbeitsschutz.erstunterweisung"]);

/** R10: Erledigung laut Katalog – einmalig (Standard), laufend je Zeitraum bzw. bis zum nächsten Termin, oder nur mit Bestätigung. */
export interface Erledigungsart {
  art: "einmalig" | "laufend" | "bestaetigen";
  zeitraum?: "monat" | "jahr";
  naechsterTerminAus?: string;
  /** Beschriftung des Knopfs bei „bestaetigen“, z. B. „In ELSTER gemeldet“ */
  bestaetigung?: string;
}

export interface Auswertung {
  gilt: PflichtInfo[];
  /** Gründungsschritte eines Betriebs, der seit mehr als sechs Monaten läuft – vermutlich längst erledigt */
  gruendung: PflichtInfo[];
  unbekannt: PflichtInfo[];
  /**
   * R10: Einstellungs-Pflichten (Sofortmeldung, SV-Anmeldung, Unterweisung vor Beginn …) eines bestehenden Betriebs ohne
   * Neueinstellung in den letzten sechs Monaten – „bei Neueinstellung“ statt „jetzt dran“ (Nutzertests Sabine, Jonas).
   */
  beiEinstellung: PflichtInfo[];
  /**
   * Pflichten, die erst in den nächsten zwölf Monaten in Kraft treten (gueltig_ab nach dem Stichtag) und für dieses
   * Profil dann gelten – ausgewertet zum Tag des Inkrafttretens; `naechsterTermin` ist dieser Tag (für den Jahresblick).
   */
  kommend: PflichtInfo[];
}

/**
 * R10: Lohn-Meldungen und -Termine, die ein Lohnbüro bzw. die Steuerberatung übernimmt, wenn sie die Löhne macht
 * (Frage „Wer macht die Löhne?“, Nutzertest Sabine) – sie stehen dann nicht bei „Jetzt dran“.
 */
export const LOHN_PFLICHTEN = new Set(["personal.beitragsnachweis", "personal.lohnsteuer_anmeldung", "personal.sv_jahresmeldung", "personal.sv_anmeldung", "personal.sofortmeldung", "personal.sv_abmeldung", "personal.lohnabrechnung", "personal.umlagen_eau"]);

/** Grund für Pflichten, deren Auslöser im Katalog „immer“ ist */
const IMMER = "Gilt für jedes Unternehmen, unabhängig von deinen Angaben.";

/** Ab wann ein Betrieb als „bestehend“ gilt: Gründungsschritte stehen dann nicht mehr bei den offenen Pflichten. */
export const BESTAND_AB_MONATEN = 6;

const text = (t: unknown) => (t && typeof t === "object" && typeof (t as { de?: unknown }).de === "string" ? (t as { de: string }).de : "");
/** Vorlagen je Pflicht in der Reihenfolge von VORLAGEN – die erste ist die Hauptvorlage */
const VORLAGEN_JE_PFLICHT = new Map<string, string[]>();
for (const v of VORLAGEN) for (const p of v.pflichten) VORLAGEN_JE_PFLICHT.set(p, [...(VORLAGEN_JE_PFLICHT.get(p) ?? []), v.id]);
const SCHWERE = { hoch: 0, mittel: 1, niedrig: 2 } as const;

/** Unterlage, soweit sie für abgeleitete Ereignisse zählt (Teil von `Unterlage` aus unterlagen/speicher.ts). */
export interface UnterlageFuerEreignis {
  vorlage: string;
  daten: Record<string, unknown>;
  ausgegeben?: string;
  storniertDurch?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ereignisse für die Engine, wie sie der Server aus seinen Datensätzen hat (packages/server `ladeEreignisse`) – die App
 * kennt keine Ereignis-Tabelle, also leitet sie dieselben Ereignistypen (packages/rules-schema/ereignisse.json) aus dem
 * ab, was auf dem Gerät steht. Keine neuen Auslöser, nur die Gegenstücke zu dem, was der Server meldet:
 * - Beschäftigte im Profil (`beschaeftigte.gesamt` ≥ 1) ⇒ „erste_einstellung“ und „einstellung“ sind eingetreten (Server:
 *   beim Anlegen einer beschäftigten Person, personal.controller). Den Tag kennt die App nicht: Gründungsdatum, sonst
 *   der Stichtag. Liegt die Gründung in der Zukunft, ist die Einstellung geplant (wie im Katalog „op: geplant“).
 * - ausgegebene, nicht stornierte Unterweisung mit Datum ⇒ „unterweisung_durchgefuehrt“ an diesem Tag (Server: beim
 *   Abschließen einer Unterweisung) – daraus die Wiederholung nach einem Jahr.
 */
export function ereignisseAusStand(profil: Profil, stichtag: string, unterlagen: readonly UnterlageFuerEreignis[] = [], mitarbeiter: readonly MitarbeiterFuerCheck[] = []): Ereignis[] {
  const ereignisse: Ereignis[] = [];
  const anzahl = profil["beschaeftigte.gesamt"];
  if (typeof anzahl === "number" && anzahl >= 1) {
    const g = profil.gruendungsdatum;
    const datum = typeof g === "string" && ISO.test(g) ? g : stichtag;
    ereignisse.push({ typ: "erste_einstellung", datum }, { typ: "einstellung", datum });
    // R10: „Beschäftigt seit“ der gespeicherten Mitarbeiter – je Person eine Einstellung (wie beim Server je Beschäftigtem)
    for (const tag of new Set(mitarbeiter.map((m) => m.beginn).filter((d): d is string => typeof d === "string" && ISO.test(d) && d !== datum))) ereignisse.push({ typ: "einstellung", datum: tag });
  }
  for (const u of unterlagen) {
    if (!u.ausgegeben || u.storniertDurch) continue;
    const d = u.daten.datum;
    if (typeof d !== "string" || !ISO.test(d)) continue;
    if (u.vorlage === "unterweisung") ereignisse.push({ typ: "unterweisung_durchgefuehrt", datum: d });
    // R10: Belehrung nach § 43 Abs. 4 IfSG ⇒ Folgebelehrung zwei Jahre später
    if (u.vorlage === "ifsg_belehrung") ereignisse.push({ typ: "ifsg_belehrung_durchgefuehrt", datum: d });
  }
  return ereignisse.sort((a, b) => a.datum.localeCompare(b.datum) || a.typ.localeCompare(b.typ));
}

/** Gespeicherte Mitarbeiterin bzw. gespeicherter Mitarbeiter, soweit der Check sie braucht (Teil von `Person`). */
export interface MitarbeiterFuerCheck {
  name?: string | null;
  geburtsdatum?: string | null;
  beginn?: string | null;
}

/** Alter in vollen Jahren am Stichtag (ISO-Daten). */
const alter = (geburt: string, tag: string) => Number(tag.slice(0, 4)) - Number(geburt.slice(0, 4)) - (tag.slice(5) < geburt.slice(5) ? 1 : 0);

/**
 * R10: Angaben, die die App aus „Mitarbeiter“ kennt, gehen in die Auswertung ein (Nutzertest Sabine: Lena, 17, stand
 * mit Geburtsdatum in der Liste, Jugendarbeitsschutz blieb „hängt ab“). Unter 18 am Stichtag: mindestens so viele
 * Jugendliche wie im Profil angegeben.
 */
export function profilMitStand(profil: Profil, stichtag: string, mitarbeiter: readonly MitarbeiterFuerCheck[] = []): Profil {
  const jung = mitarbeiter.filter((m) => typeof m.geburtsdatum === "string" && ISO.test(m.geburtsdatum) && alter(m.geburtsdatum, stichtag) < 18 && alter(m.geburtsdatum, stichtag) >= 0).length;
  if (!jung) return profil;
  const angegeben = typeof profil["beschaeftigte.jugendlich"] === "number" ? (profil["beschaeftigte.jugendlich"] as number) : 0;
  return { ...profil, "beschaeftigte.jugendlich": Math.max(angegeben, jung) };
}

/**
 * Katalog für dieses Profil auswerten. Pflichten im Rechtsänderungs-Radar (Entwurf, geplant) zählen nicht mit.
 * Ereignisse leitet `ereignisseAusStand` aus Profil und Unterlagen ab (z. B. Beschäftigte ⇒ Einstellung).
 */
export function auswertung(antworten: Profil, stichtag: string, unterlagen: readonly UnterlageFuerEreignis[] = [], mitarbeiter: readonly MitarbeiterFuerCheck[] = []): Auswertung {
  const profil = profilMitStand(antworten, stichtag, mitarbeiter);
  const fakten = Object.fromEntries(Object.entries(profil).filter(([, w]) => w !== null && w !== undefined).map(([k, w]) => [`profil.${k}`, w]));
  const ereignisse = ereignisseAusStand(profil, stichtag, unterlagen, mitarbeiter);
  const lohnExtern = profil["personal.lohn_durch"] === "steuerberatung" || profil["personal.lohn_durch"] === "lohnbuero";
  const seit = plusMonate(stichtag, -BESTAND_AB_MONATEN);
  const neuePersonen = mitarbeiter.filter((m) => typeof m.beginn === "string" && ISO.test(m.beginn) && m.beginn > seit && typeof m.name === "string" && m.name.trim()).map((m) => m.name!.trim());
  const ergebnisse = auswerten({ katalog: KATALOG, fakten, ereignisse, stichtag, kalender: new StandardKalender(), fenster: { von: stichtag, bis: plusMonate(stichtag, 12) } });
  const nachId = new Map(KATALOG.pflichten.map((p) => [p.id, p]));
  const info = (e: (typeof ergebnisse)[number]): PflichtInfo => {
    const p = nachId.get(e.pflicht_id) as Pflicht & { stelle?: unknown; quellen?: { titel: string; url?: string }[]; pruefung?: { status?: string } };
    const termine = e.termine.map((t) => t.faellig_am).filter((d) => d >= stichtag).sort();
    const termin = termine[0] ?? null;
    return {
      id: p.id,
      titel: text(p.titel),
      kurz: text(p.kurz),
      erklaerung: text(p.erklaerung),
      kategorie: p.kategorie,
      schwere: p.sanktion?.schwere ?? "mittel",
      stelle: text(p.stelle),
      rechtsgrundlage: p.rechtsgrundlage ?? [],
      quellen: (p.quellen ?? []).filter((q): q is { titel: string; url: string } => Boolean(q.url)),
      // die Sätze, die das Ergebnis tragen – auch bei zusammengesetzten Auslösern („weil du … und …“)
      grund: entscheidendeSaetze(e.begruendung).join(" ") || ("immer" in (p.ausloeser as object) ? IMMER : ""),
      vorlage: VORLAGEN_JE_PFLICHT.get(p.id)?.[0] ?? null,
      vorlagen: VORLAGEN_JE_PFLICHT.get(p.id) ?? [],
      naechsterTermin: termin,
      termine,
      offeneFragen: zuErfragendeFakten(e.fehlende_fakten)
        .filter((f) => f.startsWith("profil."))
        .map((f) => f.slice("profil.".length))
        .filter((f) => FRAGE.has(f)),
      geprueft: p.pruefung?.status === "freigegeben",
      // je Ereignis mit kommendem Termin (z. B. Unterweisung ein Jahr nach der letzten): „erledigt“ gilt nur für diesen
      // Termin – sonst hakte die Unterweisung, aus der der Termin entsteht, ihre eigene Wiederholung schon ab
      // R10: mehrere vergangene Einstellungen machen eine Pflicht je Einstellung nicht „wiederkehrend“ – nur kommende Termine zählen
      wiederkehrend: p.wiederholung?.art === "periodisch" || p.frist.typ === "wiederkehrend" || termine.length > 1 || Boolean(termin && p.frist.typ === "relativ" && "ereignis" in p.frist.bezug && p.frist.je_ereignis),
      einordnung: p.einordnung ?? "pflicht",
      erledigung: { art: p.erledigung?.art ?? "einmalig", ...(p.erledigung?.zeitraum ? { zeitraum: p.erledigung.zeitraum } : {}), ...(p.erledigung?.naechster_termin_aus ? { naechsterTerminAus: p.erledigung.naechster_termin_aus } : {}), ...(p.erledigung?.bestaetigung ? { bestaetigung: text(p.erledigung.bestaetigung) } : {}) },
      lohnbuero: lohnExtern && LOHN_PFLICHTEN.has(p.id),
      personen: JE_PERSON.has(p.id) ? neuePersonen : [],
    };
  };
  const sortiert = (l: PflichtInfo[]) => l.sort((a, b) => SCHWERE[a.schwere] - SCHWERE[b.schwere] || (a.naechsterTermin ?? "9999").localeCompare(b.naechsterTermin ?? "9999") || a.titel.localeCompare(b.titel, "de"));
  const aktiv = ergebnisse.filter((e) => !e.radar);
  const beginn = typeof profil.gruendungsdatum === "string" ? profil.gruendungsdatum : null;
  const bestehend = Boolean(beginn && beginn <= plusMonate(stichtag, -BESTAND_AB_MONATEN));
  const ausGruendung = (e: (typeof ergebnisse)[number]) => bestehend && nachId.get(e.pflicht_id)?.phase === "gruendung";
  // R10: Einstellungs-Pflichten (je Einstellung) ohne Einstellung in den letzten sechs Monaten oder demnächst: „bei Neueinstellung“
  const grenze = plusMonate(stichtag, -BESTAND_AB_MONATEN);
  const neueEinstellung = ereignisse.some((x) => x.typ === "einstellung" && x.datum > grenze);
  const beiEinstellung = (e: (typeof ergebnisse)[number]) => {
    const f = nachId.get(e.pflicht_id)?.frist;
    return !neueEinstellung && Boolean(f && f.typ === "relativ" && "ereignis" in f.bezug && f.bezug.ereignis === "einstellung" && f.je_ereignis);
  };
  const gilt = aktiv.filter((e) => e.ergebnis === "gilt");
  // erst später in Kraft (Engine wertet sie zum Stichtag nicht aus): je Tag des Inkrafttretens einmal auswerten
  const bis = plusMonate(stichtag, 12);
  const ab = [...new Set(KATALOG.pflichten.map((p) => p.gueltig_ab).filter((d): d is string => typeof d === "string" && d > stichtag && d <= bis))].sort();
  const kommend: PflichtInfo[] = [];
  for (const tag of ab) {
    const spaeter = auswerten({ katalog: { ...KATALOG, pflichten: KATALOG.pflichten.filter((p) => p.gueltig_ab === tag) }, fakten, ereignisse, stichtag: tag, kalender: new StandardKalender(), fenster: { von: tag, bis: plusMonate(tag, 12) } });
    for (const e of spaeter.filter((x) => !x.radar && x.ergebnis === "gilt")) kommend.push({ ...info(e), naechsterTermin: tag, termine: [tag] });
  }
  return {
    gilt: sortiert(gilt.filter((e) => !ausGruendung(e) && !beiEinstellung(e)).map(info)),
    gruendung: sortiert(gilt.filter(ausGruendung).map(info)),
    unbekannt: sortiert(aktiv.filter((e) => e.ergebnis === "unbekannt" && !ausGruendung(e)).map(info)),
    beiEinstellung: sortiert(gilt.filter((e) => !ausGruendung(e) && beiEinstellung(e)).map(info)),
    kommend,
  };
}

/**
 * Zusatzfragen für ein genaueres Ergebnis: die Profilfelder, die die meisten unklaren Pflichten klären – höchstens `n`.
 */
export function zusatzFragen(profil: Profil, stichtag: string, n = 8, unterlagen: readonly UnterlageFuerEreignis[] = [], mitarbeiter: readonly MitarbeiterFuerCheck[] = []): string[] {
  return offeneFragenNachWirkung(auswertung(profil, stichtag, unterlagen, mitarbeiter), profil).slice(0, n).map((o) => o.feld);
}

/** Offene Fragen, nach der Zahl unklarer Pflichten, die sie klären (E-129) – die wirksamste zuerst. */
export function offeneFragenNachWirkung(a: Auswertung, profil: Profil): { feld: string; anzahl: number }[] {
  const zaehler = new Map<string, number>();
  // nur Fragen, die für diesen Betrieb überhaupt gestellt werden (z. B. Investoren nur bei UG/GmbH)
  const passt = (f: string) => {
    const b = FRAGE.get(f)?.nurWenn;
    return (!b || b.in.includes(String(profil[b.feld]))) && passtImmer(f, profil);
  };
  // R10: auch geltende Pflichten ohne Termin, deren Rhythmus noch offen ist (z. B. Umsatzsteuer-Voranmeldung)
  const offenerRhythmus = a.gilt.filter((p) => !p.termine.length && p.offeneFragen.length && KATALOG.pflichten.find((k) => k.id === p.id)?.frist.typ === "wiederkehrend");
  for (const p of a.unbekannt) for (const f of p.offeneFragen) if (!beantwortet(profil, f) && passt(f)) zaehler.set(f, (zaehler.get(f) ?? 0) + 1);
  // beim offenen Rhythmus direkt nach dem Rhythmus fragen statt nach der Steuer des Vorjahres (Nutzertest Mehmet: „weiß ich nicht“)
  for (const p of offenerRhythmus)
    for (const f0 of p.offeneFragen) {
      const f = f0 === "ust.zahllast_vorjahr" && !beantwortet(profil, "ust.voranmeldung_rhythmus") ? "ust.voranmeldung_rhythmus" : f0;
      if (!beantwortet(profil, f) && passt(f)) zaehler.set(f, (zaehler.get(f) ?? 0) + 1);
    }
  return [...zaehler.entries()].sort((x, y) => y[1] - x[1] || (RANG.get(x[0]) ?? 999) - (RANG.get(y[0]) ?? 999) || x[0].localeCompare(y[0])).map(([feld, anzahl]) => ({ feld, anzahl }));
}

export interface Erledigt {
  erledigt: Record<string, string>;
  unterlagen: { vorlage: string; daten: Record<string, unknown>; ausgegeben?: string; storniertDurch?: string }[];
  betrieb: Betrieb;
  /** Stichtag für laufende Pflichten (R10); ohne Angabe heute (Europe/Berlin) */
  heute?: string;
}

const TAG = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
const heuteBerlin = () => TAG.format(new Date());
/** Derselbe Kalendermonat bzw. dasselbe Kalenderjahr (ISO-Daten oder -Zeitpunkte) */
const gleicherZeitraum = (a: string, b: string, z: "monat" | "jahr") => a.slice(0, z === "monat" ? 7 : 4) === b.slice(0, z === "monat" ? 7 : 4);

/**
 * R10: Bis wann eine geteilte Unterlage eine laufende Pflicht mit `naechsterTerminAus` erledigt: frühestes Datum im
 * Feld (z. B. „Nächste Prüfung“ je Gerät); ohne Datum Unterlagendatum + Richtwert der gewählten Option („Richtwert 6
 * Monate“, z. B. Einsatzbedingungen im Prüfprotokoll). null: kein Termin ableitbar.
 */
export function gueltigBis(u: Erledigt["unterlagen"][number], pfad: string): string | null {
  const [liste, feld] = pfad.includes(".") ? (pfad.split(".") as [string, string]) : [null, pfad];
  const werte = liste ? (Array.isArray(u.daten[liste]) ? (u.daten[liste] as Record<string, unknown>[]).map((e) => e?.[feld]) : []) : [u.daten[feld]];
  const daten = werte.filter((d): d is string => typeof d === "string" && ISO.test(d)).sort();
  if (daten.length) return daten[0]!;
  const v = vorlageFuer(u.vorlage);
  const basis = typeof u.daten.datum === "string" && ISO.test(u.daten.datum) ? u.daten.datum : u.ausgegeben?.slice(0, 10);
  if (!v || !basis) return null;
  for (const a of v.abschnitte)
    for (const f of a.felder as { id: string; art: string; optionen?: { wert: string; text: string }[] }[]) {
      if (f.art !== "wahl" || !f.optionen) continue;
      const text = f.optionen.find((o) => o.wert === u.daten[f.id])?.text ?? "";
      const m = /Richtwert[^0-9]{0,30}(\d+)\s*(Monat|Monate|Jahr|Jahre)\b/.exec(text);
      if (m) return plusMonate(basis, Number(m[1]) * (m[2]!.startsWith("Jahr") ? 12 : 1));
    }
  return null;
}

/** Haken einer Pflicht: Datum und – bei wiederkehrenden Pflichten – der Termin, für den er gilt. */
export function haken(wert: string | undefined): { datum: string; termin: string | null } | null {
  if (!wert) return null;
  const [datum, termin] = wert.split("|");
  return { datum: datum!, termin: termin || null };
}

/**
 * Erledigt (E-127): abgehakt – bei wiederkehrenden Pflichten nur für den nächsten Termin – oder, bei einmaligen bzw.
 * dauerhaften Pflichten, durch eine vollständige Unterlage, die tatsächlich als PDF geteilt oder gedruckt wurde.
 * R10 (Katalog `erledigung`): laufende Pflichten (HACCP, Arbeitszeit, Prüfung elektrischer Geräte) erledigen Haken und
 * Unterlage nur für ihren Zeitraum bzw. bis zum nächsten Termin aus der Unterlage; bei „bestaetigen“ (Kassenmeldung,
 * Sofortmeldung …) erledigt eine Unterlage nichts – nur die ausdrückliche Bestätigung (der Haken).
 */
export function istErledigt(p: PflichtInfo, e: Erledigt): boolean {
  const heute = e.heute ?? heuteBerlin();
  const erl = p.erledigung ?? { art: "einmalig" };
  const h = haken(e.erledigt[p.id]);
  if (h) {
    if (erl.zeitraum && erl.art !== "einmalig") return gleicherZeitraum(h.datum, heute, erl.zeitraum);
    return !p.wiederkehrend || !p.naechsterTermin || h.termin === p.naechsterTermin;
  }
  return Boolean(erledigtDurch(p, e));
}

/** Die Unterlage, die die Pflicht erledigt (geteilt, vollständig, im Zeitraum bzw. vor dem nächsten Termin) – sonst null. */
export function erledigtDurch(p: PflichtInfo, e: Erledigt): Erledigt["unterlagen"][number] | null {
  const heute = e.heute ?? heuteBerlin();
  const erl = p.erledigung ?? { art: "einmalig" };
  if (!p.vorlage || p.wiederkehrend || erl.art === "bestaetigen") return null;
  const v = vorlageFuer(p.vorlage);
  if (!v) return null;
  const fertige = e.unterlagen.filter((u) => u.vorlage === p.vorlage && u.ausgegeben && !u.storniertDurch && fehlendeAngaben(v, u.daten as never, e.betrieb).length === 0);
  // je Person: erst erledigt, wenn jede neu eingestellte Person in einer geteilten Unterlage steht (Teilnehmende)
  if (p.personen?.length) {
    const namen = new Set(fertige.flatMap((u) => (Array.isArray(u.daten.teilnehmer) ? (u.daten.teilnehmer as { name?: unknown }[]) : []).map((x) => (typeof x?.name === "string" ? x.name.trim().toLowerCase() : ""))));
    if (!p.personen.every((n) => namen.has(n.toLowerCase()))) return null;
  }
  const passend = fertige
    .filter((u) => {
      if (erl.art !== "laufend") return true;
      if (erl.naechsterTerminAus) {
        const bis = gueltigBis(u, erl.naechsterTerminAus);
        return Boolean(bis && bis > heute);
      }
      return erl.zeitraum ? gleicherZeitraum(u.ausgegeben!, heute, erl.zeitraum) : false;
    })
    .sort((x, y) => y.ausgegeben!.localeCompare(x.ausgegeben!));
  return passend[0] ?? null;
}

/**
 * Fortschritt über die geltenden Pflichten (ohne Gründungsschritte eines bestehenden Betriebs). R10: nur echte Pflichten –
 * Hinweise und Optionen zählen nicht mit (Rechtsprüfung: getrennt zählen).
 */
export function fortschritt(a: Auswertung, e: Erledigt) {
  const l = a.gilt.filter((p) => p.einordnung === "pflicht");
  const gesamt = l.length;
  const fertig = l.filter((p) => istErledigt(p, e)).length;
  return { gesamt, fertig, prozent: gesamt ? Math.round((fertig / gesamt) * 100) : 0 };
}

/** R10: Pflichten, Hinweise und Optionen getrennt gezählt („N Pflichten, M Hinweise“). */
export function zaehlung(l: readonly PflichtInfo[]) {
  return { pflichten: l.filter((p) => p.einordnung === "pflicht").length, hinweise: l.filter((p) => p.einordnung === "hinweis").length, optionen: l.filter((p) => p.einordnung === "option").length };
}

/** Bereiche für die Gliederung des Ergebnisses. */
export const KATEGORIE_TITEL: Record<string, string> = {
  gruendung: "Gründung",
  gesellschaft: "Gesellschaft",
  steuern: "Steuern",
  personal: "Personal",
  arbeitsschutz: "Arbeitsschutz",
  datenschutz: "Datenschutz",
  it_sicherheit: "IT-Sicherheit",
  ki: "Künstliche Intelligenz",
  online: "Website und Online-Handel",
  produkte: "Produkte",
  branche: "Deine Branche",
};

/** Branche aus dem Profil → Gruppe in den Vorschlägen (z. B. Gefährdungen „Friseur“). */
export const VORSCHLAG_GRUPPE: Record<string, string[]> = {
  gastronomie_lebensmittel: ["Gastronomie / Café"],
  beauty_kosmetik: ["Friseur", "Kosmetik", "Alle Beauty-Betriebe"],
  handwerk: ["Handwerk"],
  bau: ["Handwerk"],
  onlinehandel: ["Büro / Laden"],
  it_agentur_freelancer: ["Büro / Laden"],
  immobilien_finanzen: ["Büro / Laden"],
};

const plusTage = (iso: string, n: number) => {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1, t + n)).toISOString().slice(0, 10);
};

/**
 * Was jetzt dran ist (E-128, Review K7): offene Pflichten mit Termin in den nächsten 14 Tagen (auch überfällige)
 * und die wichtigsten offenen ohne Termin; „In den nächsten Wochen“ mit Termin in 15 bis 45 Tagen (bewusst nicht
 * „Diesen Monat“ – das Fenster reicht über das Monatsende hinaus); der Rest „Im Blick“.
 */
export function dringlichkeit(a: Auswertung, e: Erledigt, heute: string) {
  const ee = { ...e, heute: e.heute ?? heute };
  // R10: was das Lohnbüro bzw. die Steuerberatung erledigt, steht nicht bei „Jetzt dran“ (bleibt „Im Blick“)
  const offen = a.gilt.filter((p) => !istErledigt(p, ee));
  const selbst = offen.filter((p) => !p.lohnbuero);
  const bald = plusTage(heute, 14);
  const spaeter = plusTage(heute, 45);
  const mitTermin = selbst.filter((p) => p.naechsterTermin).sort((x, y) => x.naechsterTermin!.localeCompare(y.naechsterTermin!));
  const terminBald = mitTermin.filter((p) => p.naechsterTermin! <= bald);
  // Hinweise und Optionen ohne Termin sind nie „dringend“
  const wichtigOhne = selbst.filter((p) => !p.naechsterTermin && p.schwere === "hoch" && p.einordnung === "pflicht");
  const jetzt = [...terminBald, ...wichtigOhne];
  const naechsteWochen = mitTermin.filter((p) => p.naechsterTermin! > bald && p.naechsterTermin! <= spaeter);
  const imBlick = offen.filter((p) => !jetzt.includes(p) && !naechsteWochen.includes(p));
  // „N Termine in den nächsten 2 Wochen“ zählt nur Termine, nicht die wichtigen Aufgaben ohne Termin (Nutzertests Lea, Sabine)
  return { jetzt, naechsteWochen, imBlick, termine: terminBald.length, ohneTermin: wichtigOhne.length };
}

/** Höchstens einmal im Jahr fällig (ein Termin oder keiner in den nächsten zwölf Monaten) – für „viele davon nur einmal im Jahr“. */
export const selten = (gilt: readonly PflichtInfo[]) => gilt.filter((p) => p.termine.length <= 1).length * 2 > gilt.length;

/** Ab so vielen offenen Gründungsschritten lohnt die Karte „Schon erledigt?“. */
export const SCHON_ERLEDIGT_AB = 3;

/**
 * Karte „Schon erledigt?“ für junge Betriebe: Angefangen vor weniger als sechs Monaten (nicht in der Zukunft), dann
 * stehen die Gründungsschritte noch bei den offenen Pflichten – oft sind sie längst erledigt. Liefert die offenen
 * Gründungsschritte (Phase „gruendung“ im Katalog), sobald es mindestens `ab` sind; sonst nichts.
 */
export function gruendungsSchritte(a: Auswertung, profil: Profil, e: Erledigt, stichtag: string, ab = SCHON_ERLEDIGT_AB): PflichtInfo[] {
  const beginn = typeof profil.gruendungsdatum === "string" && ISO.test(profil.gruendungsdatum) ? profil.gruendungsdatum : null;
  if (!beginn || beginn > stichtag || beginn <= plusMonate(stichtag, -BESTAND_AB_MONATEN)) return [];
  const phase = new Map(KATALOG.pflichten.map((p) => [p.id, p.phase]));
  const l = a.gilt.filter((p) => phase.get(p.id) === "gruendung" && !istErledigt(p, { ...e, heute: e.heute ?? stichtag }));
  return l.length >= ab ? l : [];
}

export interface Erinnerung {
  pflichtId: string;
  titel: string;
  termin: string;
  /** Tag der Benachrichtigung (ISO), morgens zugestellt */
  am: string;
}

/** Lokale Erinnerungen: für offene Pflichten mit Termin, `vorlauf` Tage vorher (nicht in der Vergangenheit), höchstens `max`. */
export function erinnerungsPlan(a: Auswertung, e: Erledigt, heute: string, vorlauf = 3, max = 30): Erinnerung[] {
  return a.gilt
    .filter((p) => p.naechsterTermin && p.naechsterTermin >= heute && !p.lohnbuero && !istErledigt(p, { ...e, heute: e.heute ?? heute }))
    .map((p) => {
      const frueh = plusTage(p.naechsterTermin!, -vorlauf);
      return { pflichtId: p.id, titel: p.titel, termin: p.naechsterTermin!, am: frueh > heute ? frueh : heute };
    })
    .sort((x, y) => x.am.localeCompare(y.am) || x.titel.localeCompare(y.titel, "de"))
    .slice(0, max);
}
