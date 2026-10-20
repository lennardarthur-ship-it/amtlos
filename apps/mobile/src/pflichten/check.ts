/**
 * Pflichten-Check (E-126): wenige Fragen zum Betrieb, dann rechnet die Regel-Engine auf dem Gerät aus, welche Pflichten
 * aus dem Katalog gelten – derselbe Katalog und dieselbe Engine wie auf dem Server (E-119). Nichts wird erfunden:
 * Titel, Texte, Termine und Einstufungen kommen aus dem Katalog (fachlich noch ungeprüft, das sagt die App).
 * Reine Funktionen, ohne Gerät testbar.
 */
import { VORLAGEN, fehlendeAngaben, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { StandardKalender } from "@amtlos/fristen";
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
 * kennt jede und jeder; die Gesellschafts-Frage nur bei UG und GmbH (wie im Fragebogen).
 */
export const CHECK_FELDER = ["taetigkeit.branchen", "rechtsform", "gesellschaft.handelsregister", "taetigkeit.einordnung", "bundesland", "beschaeftigte.gesamt", "kasse.elektronisch", "online.website", "ust.kleinunternehmer", "steuerberater", "gruendungsdatum"] as const;

const FRAGE = new Map<string, { frage: Frage; nurWenn?: { feld: string; in: string[] } }>();
for (const s of SCHRITTE) for (const f of s.fragen) FRAGE.set(f.feld, { frage: f, nurWenn: s.nurWenn });
/** Reihenfolge im Fragenkatalog – vom Alltäglichen zum Speziellen; entscheidet bei gleicher Wirkung */
const RANG = new Map([...FRAGE.keys()].map((k, i) => [k, i]));

export const frageZu = (feld: string): Frage | undefined => FRAGE.get(feld)?.frage;

/** Fragen, die für dieses Profil gestellt werden (Bedingungen wie „nur bei UG/GmbH“ beachtet). */
export function checkFragen(profil: Profil, felder: readonly string[] = CHECK_FELDER): Frage[] {
  return felder
    .map((f) => FRAGE.get(f))
    .filter((x): x is { frage: Frage; nurWenn?: { feld: string; in: string[] } } => Boolean(x))
    .filter((x) => !x.nurWenn || x.nurWenn.in.includes(String(profil[x.nurWenn.feld])))
    .map((x) => x.frage);
}

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
}

export interface Auswertung {
  gilt: PflichtInfo[];
  /** Gründungsschritte eines Betriebs, der seit mehr als sechs Monaten läuft – vermutlich längst erledigt */
  gruendung: PflichtInfo[];
  unbekannt: PflichtInfo[];
}

/** Grund für Pflichten, deren Auslöser im Katalog „immer“ ist */
const IMMER = "Gilt für jedes Unternehmen, unabhängig von deinen Angaben.";

/** Ab wann ein Betrieb als „bestehend“ gilt: Gründungsschritte stehen dann nicht mehr bei den offenen Pflichten. */
export const BESTAND_AB_MONATEN = 6;

const text = (t: unknown) => (t && typeof t === "object" && typeof (t as { de?: unknown }).de === "string" ? (t as { de: string }).de : "");
/** Vorlagen je Pflicht in der Reihenfolge von VORLAGEN – die erste ist die Hauptvorlage */
const VORLAGEN_JE_PFLICHT = new Map<string, string[]>();
for (const v of VORLAGEN) for (const p of v.pflichten) VORLAGEN_JE_PFLICHT.set(p, [...(VORLAGEN_JE_PFLICHT.get(p) ?? []), v.id]);
const SCHWERE = { hoch: 0, mittel: 1, niedrig: 2 } as const;

function plusMonate(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(j, m - 1 + n, Math.min(t, 28)));
  return d.toISOString().slice(0, 10);
}

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
export function ereignisseAusStand(profil: Profil, stichtag: string, unterlagen: readonly UnterlageFuerEreignis[] = []): Ereignis[] {
  const ereignisse: Ereignis[] = [];
  const anzahl = profil["beschaeftigte.gesamt"];
  if (typeof anzahl === "number" && anzahl >= 1) {
    const g = profil.gruendungsdatum;
    const datum = typeof g === "string" && ISO.test(g) ? g : stichtag;
    ereignisse.push({ typ: "erste_einstellung", datum }, { typ: "einstellung", datum });
  }
  for (const u of unterlagen) {
    if (u.vorlage !== "unterweisung" || !u.ausgegeben || u.storniertDurch) continue;
    const d = u.daten.datum;
    if (typeof d === "string" && ISO.test(d)) ereignisse.push({ typ: "unterweisung_durchgefuehrt", datum: d });
  }
  return ereignisse.sort((a, b) => a.datum.localeCompare(b.datum) || a.typ.localeCompare(b.typ));
}

/**
 * Katalog für dieses Profil auswerten. Pflichten im Rechtsänderungs-Radar (Entwurf, geplant) zählen nicht mit.
 * Ereignisse leitet `ereignisseAusStand` aus Profil und Unterlagen ab (z. B. Beschäftigte ⇒ Einstellung).
 */
export function auswertung(profil: Profil, stichtag: string, unterlagen: readonly UnterlageFuerEreignis[] = []): Auswertung {
  const fakten = Object.fromEntries(Object.entries(profil).filter(([, w]) => w !== null && w !== undefined).map(([k, w]) => [`profil.${k}`, w]));
  const ereignisse = ereignisseAusStand(profil, stichtag, unterlagen);
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
      wiederkehrend: p.wiederholung?.art === "periodisch" || e.termine.length > 1 || Boolean(termin && p.frist.typ === "relativ" && "ereignis" in p.frist.bezug && p.frist.je_ereignis),
    };
  };
  const sortiert = (l: PflichtInfo[]) => l.sort((a, b) => SCHWERE[a.schwere] - SCHWERE[b.schwere] || (a.naechsterTermin ?? "9999").localeCompare(b.naechsterTermin ?? "9999") || a.titel.localeCompare(b.titel, "de"));
  const aktiv = ergebnisse.filter((e) => !e.radar);
  const beginn = typeof profil.gruendungsdatum === "string" ? profil.gruendungsdatum : null;
  const bestehend = Boolean(beginn && beginn <= plusMonate(stichtag, -BESTAND_AB_MONATEN));
  const ausGruendung = (e: (typeof ergebnisse)[number]) => bestehend && nachId.get(e.pflicht_id)?.phase === "gruendung";
  const gilt = aktiv.filter((e) => e.ergebnis === "gilt");
  return {
    gilt: sortiert(gilt.filter((e) => !ausGruendung(e)).map(info)),
    gruendung: sortiert(gilt.filter(ausGruendung).map(info)),
    unbekannt: sortiert(aktiv.filter((e) => e.ergebnis === "unbekannt" && !ausGruendung(e)).map(info)),
  };
}

/**
 * Zusatzfragen für ein genaueres Ergebnis: die Profilfelder, die die meisten unklaren Pflichten klären – höchstens `n`.
 */
export function zusatzFragen(profil: Profil, stichtag: string, n = 8, unterlagen: readonly UnterlageFuerEreignis[] = []): string[] {
  return offeneFragenNachWirkung(auswertung(profil, stichtag, unterlagen), profil).slice(0, n).map((o) => o.feld);
}

/** Offene Fragen, nach der Zahl unklarer Pflichten, die sie klären (E-129) – die wirksamste zuerst. */
export function offeneFragenNachWirkung(a: Auswertung, profil: Profil): { feld: string; anzahl: number }[] {
  const zaehler = new Map<string, number>();
  // nur Fragen, die für diesen Betrieb überhaupt gestellt werden (z. B. Investoren nur bei UG/GmbH)
  const passt = (f: string) => {
    const b = FRAGE.get(f)?.nurWenn;
    return !b || b.in.includes(String(profil[b.feld]));
  };
  for (const p of a.unbekannt) for (const f of p.offeneFragen) if (!beantwortet(profil, f) && passt(f)) zaehler.set(f, (zaehler.get(f) ?? 0) + 1);
  return [...zaehler.entries()].sort((x, y) => y[1] - x[1] || (RANG.get(x[0]) ?? 999) - (RANG.get(y[0]) ?? 999) || x[0].localeCompare(y[0])).map(([feld, anzahl]) => ({ feld, anzahl }));
}

export interface Erledigt {
  erledigt: Record<string, string>;
  unterlagen: { vorlage: string; daten: Record<string, unknown>; ausgegeben?: string; storniertDurch?: string }[];
  betrieb: Betrieb;
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
 */
export function istErledigt(p: PflichtInfo, e: Erledigt): boolean {
  const h = haken(e.erledigt[p.id]);
  if (h) return !p.wiederkehrend || !p.naechsterTermin || h.termin === p.naechsterTermin;
  if (!p.vorlage || p.wiederkehrend) return false;
  const v = vorlageFuer(p.vorlage);
  return Boolean(v && e.unterlagen.some((u) => u.vorlage === p.vorlage && u.ausgegeben && !u.storniertDurch && fehlendeAngaben(v, u.daten as never, e.betrieb).length === 0));
}

/** Fortschritt über die geltenden Pflichten (ohne Gründungsschritte eines bestehenden Betriebs). */
export function fortschritt(a: Auswertung, e: Erledigt) {
  const gesamt = a.gilt.length;
  const fertig = a.gilt.filter((p) => istErledigt(p, e)).length;
  return { gesamt, fertig, prozent: gesamt ? Math.round((fertig / gesamt) * 100) : 0 };
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
 * und die wichtigsten offenen ohne Termin; „Diesen Monat“ mit Termin in 15 bis 45 Tagen; der Rest „Im Blick“.
 */
export function dringlichkeit(a: Auswertung, e: Erledigt, heute: string) {
  const offen = a.gilt.filter((p) => !istErledigt(p, e));
  const bald = plusTage(heute, 14);
  const monat = plusTage(heute, 45);
  const mitTermin = offen.filter((p) => p.naechsterTermin).sort((x, y) => x.naechsterTermin!.localeCompare(y.naechsterTermin!));
  const terminBald = mitTermin.filter((p) => p.naechsterTermin! <= bald);
  const wichtigOhne = offen.filter((p) => !p.naechsterTermin && p.schwere === "hoch");
  const jetzt = [...terminBald, ...wichtigOhne];
  const diesenMonat = mitTermin.filter((p) => p.naechsterTermin! > bald && p.naechsterTermin! <= monat);
  const imBlick = offen.filter((p) => !jetzt.includes(p) && !diesenMonat.includes(p));
  return { jetzt, diesenMonat, imBlick };
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
    .filter((p) => p.naechsterTermin && p.naechsterTermin >= heute && !istErledigt(p, e))
    .map((p) => {
      const frueh = plusTage(p.naechsterTermin!, -vorlauf);
      return { pflichtId: p.id, titel: p.titel, termin: p.naechsterTermin!, am: frueh > heute ? frueh : heute };
    })
    .sort((x, y) => x.am.localeCompare(y.am) || x.titel.localeCompare(y.titel, "de"))
    .slice(0, max);
}
