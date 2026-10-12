/**
 * Pflichten-Check (E-126): wenige Fragen zum Betrieb, dann rechnet die Regel-Engine auf dem Gerät aus, welche Pflichten
 * aus dem Katalog gelten – derselbe Katalog und dieselbe Engine wie auf dem Server (E-119). Nichts wird erfunden:
 * Titel, Texte, Termine und Einstufungen kommen aus dem Katalog (fachlich noch ungeprüft, das sagt die App).
 * Reine Funktionen, ohne Gerät testbar.
 */
import { VORLAGEN, fehlendeAngaben, vorlageFuer, type Betrieb } from "@amtlos/fachlogik";
import { StandardKalender } from "@amtlos/fristen";
import { SCHRITTE, type Frage } from "@amtlos/i18n";
import { auswerten, zuErfragendeFakten, type Katalog, type Pflicht } from "@amtlos/rules-engine";
import roh from "./katalog.json";

export const KATALOG = roh as unknown as Katalog;

/** Profil wie im Server (Schlüssel ohne „profil.“): Auswahl → Text, Mehrfach → Liste, Ja/Nein → boolean, Zahl → number, Datum → ISO. */
export type Profil = Record<string, string | number | boolean | string[] | null>;

/**
 * Die Fragen des Checks, in dieser Reihenfolge: der Schnellstart (E-111) plus Kasse und Website. Branche zuerst – die
 * kennt jede und jeder; die Gesellschafts-Frage nur bei UG und GmbH (wie im Fragebogen).
 */
export const CHECK_FELDER = ["taetigkeit.branchen", "rechtsform", "gesellschaft.handelsregister", "taetigkeit.einordnung", "bundesland", "beschaeftigte.gesamt", "kasse.elektronisch", "online.website", "ust.kleinunternehmer", "gruendungsdatum"] as const;

const FRAGE = new Map<string, { frage: Frage; nurWenn?: { feld: string; in: string[] } }>();
for (const s of SCHRITTE) for (const f of s.fragen) FRAGE.set(f.feld, { frage: f, nurWenn: s.nurWenn });

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
  /** Vorlage in der App, die diese Pflicht belegt */
  vorlage: string | null;
  /** nächster Termin aus dem Katalog (wiederkehrende Pflichten) */
  naechsterTermin: string | null;
  /** Fragen, die für eine unklare Pflicht noch fehlen (Profilfelder) */
  offeneFragen: string[];
  geprueft: boolean;
}

export interface Auswertung {
  gilt: PflichtInfo[];
  unbekannt: PflichtInfo[];
}

const text = (t: unknown) => (t && typeof t === "object" && typeof (t as { de?: unknown }).de === "string" ? (t as { de: string }).de : "");
const VORLAGE_JE_PFLICHT = new Map<string, string>();
for (const v of VORLAGEN) for (const p of v.pflichten) if (!VORLAGE_JE_PFLICHT.has(p)) VORLAGE_JE_PFLICHT.set(p, v.id);
const SCHWERE = { hoch: 0, mittel: 1, niedrig: 2 } as const;

function plusMonate(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(j, m - 1 + n, Math.min(t, 28)));
  return d.toISOString().slice(0, 10);
}

/** Katalog für dieses Profil auswerten. Pflichten im Rechtsänderungs-Radar (Entwurf, geplant) zählen nicht mit. */
export function auswertung(profil: Profil, stichtag: string): Auswertung {
  const fakten = Object.fromEntries(Object.entries(profil).filter(([, w]) => w !== null && w !== undefined).map(([k, w]) => [`profil.${k}`, w]));
  const ergebnisse = auswerten({ katalog: KATALOG, fakten, ereignisse: [], stichtag, kalender: new StandardKalender(), fenster: { von: stichtag, bis: plusMonate(stichtag, 12) } });
  const nachId = new Map(KATALOG.pflichten.map((p) => [p.id, p]));
  const info = (e: (typeof ergebnisse)[number]): PflichtInfo => {
    const p = nachId.get(e.pflicht_id) as Pflicht & { stelle?: unknown; quellen?: { titel: string; url?: string }[]; pruefung?: { status?: string }; ausloeser: { label?: unknown } };
    const termin = e.termine.map((t) => t.faellig_am).filter((d) => d >= stichtag).sort()[0] ?? null;
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
      grund: text((p.ausloeser as { label?: unknown }).label),
      vorlage: VORLAGE_JE_PFLICHT.get(p.id) ?? null,
      naechsterTermin: termin,
      offeneFragen: zuErfragendeFakten(e.fehlende_fakten)
        .filter((f) => f.startsWith("profil."))
        .map((f) => f.slice("profil.".length))
        .filter((f) => FRAGE.has(f)),
      geprueft: p.pruefung?.status === "freigegeben",
    };
  };
  const sortiert = (l: PflichtInfo[]) => l.sort((a, b) => SCHWERE[a.schwere] - SCHWERE[b.schwere] || (a.naechsterTermin ?? "9999").localeCompare(b.naechsterTermin ?? "9999") || a.titel.localeCompare(b.titel, "de"));
  const aktiv = ergebnisse.filter((e) => !e.radar);
  return {
    gilt: sortiert(aktiv.filter((e) => e.ergebnis === "gilt").map(info)),
    unbekannt: sortiert(aktiv.filter((e) => e.ergebnis === "unbekannt").map(info)),
  };
}

/** Eine Pflicht gilt als erledigt, wenn sie abgehakt ist oder es eine vollständige Unterlage der passenden Vorlage gibt. */
export function istErledigt(p: PflichtInfo, erledigt: Record<string, string>, unterlagen: { vorlage: string; daten: Record<string, unknown> }[], betrieb: Betrieb): boolean {
  if (erledigt[p.id]) return true;
  if (!p.vorlage) return false;
  const v = vorlageFuer(p.vorlage);
  return Boolean(v && unterlagen.some((u) => u.vorlage === p.vorlage && fehlendeAngaben(v, u.daten as never, betrieb).length === 0));
}

/** Fortschritt über die geltenden Pflichten. */
export function fortschritt(a: Auswertung, erledigt: Record<string, string>, unterlagen: { vorlage: string; daten: Record<string, unknown> }[], betrieb: Betrieb) {
  const gesamt = a.gilt.length;
  const fertig = a.gilt.filter((p) => istErledigt(p, erledigt, unterlagen, betrieb)).length;
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
