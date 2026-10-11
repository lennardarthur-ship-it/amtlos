/**
 * Gemeinsamer Zustand und Werkzeuge des Demo-Servers (E-119, E-120). Ein Objekt `Stand` ersetzt die Datenbank;
 * es wird als JSON im Gerät gespeichert. Die Module (kern, finanzen, personal, postfach, konto) beantworten je
 * einen Teil der API – mit derselben Fachlogik wie der Server, wo sie rein ist (@amtlos/rules-engine,
 * @amtlos/fachlogik), sonst so einfach wie möglich nachgebildet.
 */
import { StandardKalender, plusMonate, type Datum } from "@amtlos/fristen";
import { BEREICH_JE_KATEGORIE, anzeigeStatus, auswerten, entscheidendeSaetze, sollInstanzen, type Ereignis, type Instanz, type Katalog, type Pflicht, type Soll } from "@amtlos/rules-engine";
import type { Sprache } from "../kern/api";

export type Text = { de: string; en?: string };
export const tx = (x: Text | undefined | null, s: Sprache) => (x ? (x[s] ?? x.de) : undefined);

export interface DemoInstanz extends Omit<Soll, "status"> {
  status: Instanz["status"];
  erledigt_am: string | null;
  erledigt_mit_version_id: string | null;
}

/** Alles, was der Server in Tabellen hält – hier als ein Objekt. */
export interface Stand {
  zaehler: number;
  unternehmen: { id: string; name: string; erstellt_am: string } | null;
  profil: { version: number; daten: Record<string, unknown>; erstellt_am: string | null; erste_am: string | null };
  instanzen: Record<string, DemoInstanz>;
  ereignisse: { id: string; typ: string; datum: string; erfasst_am: string; storniert_ereignis_id: string | null; payload: Record<string, unknown> }[];
  nachweise: { id: string; schluessel: string; art: string; notiz: string | null; erstellt_am: string }[];
  /** weitere Module legen hier ihre Tabellen ab */
  tabellen: Record<string, unknown[]>;
  einstellungen: Record<string, unknown>;
}

export const leererStand = (): Stand => ({
  zaehler: 0,
  unternehmen: null,
  profil: { version: 0, daten: {}, erstellt_am: null, erste_am: null },
  instanzen: {},
  ereignisse: [],
  nachweise: [],
  tabellen: {},
  einstellungen: {},
});

/** Heutiges Datum in Berlin – wie heute() im Server. */
export function heuteBerlin(jetzt = new Date()): Datum {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(jetzt);
}

export interface Anfrage {
  pfad: string;
  teile: string[];
  methode: string;
  suche: URLSearchParams;
  koerper: Record<string, unknown>;
  roh: unknown;
  s: Sprache;
}
export interface Antwort {
  status: number;
  wert?: unknown;
}
export const ok = (wert?: unknown, status = 200): Antwort => ({ status, wert });
export const fehler = (status: number, de: string, en: string, s: Sprache): Antwort => ({ status, wert: { meldung: s === "en" ? en : de } });
export const nichtGefunden = (s: Sprache) => fehler(404, "Nicht gefunden", "Not found", s);

export class Kontext {
  readonly pflichtNachId: Map<string, Pflicht & Record<string, unknown>>;
  private readonly versionIds: Map<string, string>;
  constructor(
    readonly katalog: Katalog,
    public stand: Stand,
    readonly jetzt: () => Date,
  ) {
    this.pflichtNachId = new Map(katalog.pflichten.map((p) => [p.id, p as Pflicht & Record<string, unknown>]));
    this.versionIds = new Map(katalog.pflichten.map((p) => [p.id, `${p.id}@${p.version}`]));
  }

  heute(): Datum {
    return heuteBerlin(this.jetzt());
  }
  zeit(): string {
    return this.jetzt().toISOString();
  }
  id(praefix: string): string {
    this.stand.zaehler += 1;
    return `${praefix}-${this.stand.zaehler.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
  tabelle<T>(name: string): T[] {
    return (this.stand.tabellen[name] ??= []) as T[];
  }

  /** Ereignisse für die Engine, wie ladeEreignisse() im Server. */
  ereignisse(): Ereignis[] {
    const storniert = new Set(this.stand.ereignisse.map((e) => e.storniert_ereignis_id).filter(Boolean));
    return [...this.stand.ereignisse]
      .sort((a, b) => a.datum.localeCompare(b.datum) || a.erfasst_am.localeCompare(b.erfasst_am))
      .filter((e) => !e.storniert_ereignis_id)
      .map((e) => ({ typ: e.typ, datum: e.datum, ...(storniert.has(e.id) ? { storniert: true } : {}) }));
  }

  /** Umsatz des Jahres aus gestellten Rechnungen (wie umsatzLaufendesJahr im Server); null, solange keine gestellt ist. */
  umsatzLaufendesJahr(jahr: number): number | null {
    const r = this.tabelle<{ status: string; art: string; rechnungsdatum: string | null; netto_cent: number }>("rechnungen").filter((x) => x.status !== "entwurf");
    if (!r.length) return null;
    return r.filter((x) => x.rechnungsdatum?.startsWith(String(jahr))).reduce((a, x) => a + (x.art === "storno" ? -x.netto_cent : x.netto_cent), 0) / 100;
  }

  /** neuberechnenInTx (packages/server/src/berechnung.ts) ohne Datenbank: auswerten → sollInstanzen → abgleichen. */
  neuberechnen() {
    if (this.stand.profil.version === 0) return;
    const stichtag = this.heute();
    const schluessel = (p: string, per: string) => `${p}|${per}`;
    const instanzen = this.stand.instanzen;
    const bestand = Object.entries(instanzen).map(([k, i]) => ({ ...i, id: k }));
    const erledigt: Record<string, Datum> = {};
    for (const i of bestand) if (i.status === "erledigt" && i.erledigt_am && !(i.pflicht_id in erledigt)) erledigt[i.pflicht_id] = i.erledigt_am.slice(0, 10);
    const fakten: Record<string, unknown> = Object.fromEntries(Object.entries(this.stand.profil.daten).map(([k, v]) => [`profil.${k}`, v]));
    // Kleinunternehmer-Wächter (C.23): Umsatz aus den Rechnungen in Amtlos, nur wenn welche gestellt wurden
    const umsatz = this.umsatzLaufendesJahr(Number(stichtag.slice(0, 4)));
    if (umsatz !== null) fakten["finanzen.umsatz.laufendes_jahr"] = umsatz;
    const fenster = { von: plusMonate(stichtag, -3), bis: plusMonate(stichtag, 12) };
    const ereignisse = this.ereignisse();
    const ergebnisse = auswerten({ katalog: this.katalog, fakten, ereignisse, stichtag, kalender: new StandardKalender(), erledigt, fenster });
    const soll = sollInstanzen(ergebnisse, this.pflichtNachId, this.versionIds, bestand, ereignisse);
    const sollSchluessel = new Set(soll.map((s) => schluessel(s.pflicht_id, s.periode)));
    for (const s of soll) {
      const k = schluessel(s.pflicht_id, s.periode);
      if (instanzen[k]?.status === "erledigt") continue; // Erledigtes bleibt unangetastet (E-036)
      instanzen[k] = { ...s, erledigt_am: null, erledigt_mit_version_id: null };
    }
    for (const [k, i] of Object.entries(instanzen)) {
      if (sollSchluessel.has(k) || i.status === "erledigt" || i.status === "entfallen") continue;
      if (i.status === "offen" && i.faellig_am && i.faellig_am < fenster.von) continue; // überfällig vor dem Fenster bleibt
      instanzen[k] = { ...i, status: "entfallen" };
    }
  }

  /** Reihenfolge wie die API: faellig_am nulls last, pflicht_id, periode; ohne Entfallenes. */
  sichtbar(): DemoInstanz[] {
    return Object.values(this.stand.instanzen)
      .filter((i) => i.status !== "entfallen")
      .sort((a, b) => (a.faellig_am ?? "9999").localeCompare(b.faellig_am ?? "9999") || a.pflicht_id.localeCompare(b.pflicht_id) || a.periode.localeCompare(b.periode));
  }

  /** karte() aus apps/api/src/pflichten.controller.ts */
  karte(i: DemoInstanz, s: Sprache) {
    const d = this.pflichtNachId.get(i.pflicht_id)!;
    const pruefung = (d.pruefung ?? {}) as { status?: string; geprueft_von?: string[] | null; geprueft_am?: string | null };
    const sanktion = d.sanktion as { text: Text; schwere: "niedrig" | "mittel" | "hoch" };
    return {
      pflicht_id: i.pflicht_id,
      periode: i.periode,
      status: anzeigeStatus(i, this.heute()),
      ergebnis: i.ergebnis,
      faellig_am: i.faellig_am,
      verschoben_von: i.faellig_roh && i.faellig_am && i.faellig_roh !== i.faellig_am ? i.faellig_roh : null,
      titel: tx(d.titel as Text, s) ?? i.pflicht_id,
      kurz: tx(d.kurz as Text, s) ?? "",
      kategorie: d.kategorie as string,
      branchen: (d.branchen as string[] | undefined) ?? [],
      bereich: BEREICH_JE_KATEGORIE[d.kategorie as string] ?? "gesellschaft",
      sanktion: { text: tx(sanktion.text, s) ?? "", schwere: sanktion.schwere },
      rechtsgrundlage: d.rechtsgrundlage,
      warum: i.ergebnis === "gilt" ? entscheidendeSaetze(i.begruendung.knoten, s) : [],
      zu_klaeren: i.ergebnis === "unbekannt" ? entscheidendeSaetze(i.begruendung.knoten, s) : [],
      nicht_zutreffend_grund: i.nicht_zutreffend_grund,
      fehlende_fakten: i.fehlende_fakten,
      hinweise: i.begruendung.hinweise ?? [],
      aktion: d.aktion ?? null,
      pruefung: { status: pruefung.status ?? "entwurf", geprueft_von: pruefung.geprueft_von ?? null, geprueft_am: pruefung.geprueft_am ?? null },
      ungeprueft: pruefung.status !== "freigegeben",
      erledigt_am: i.erledigt_am,
    };
  }
}

export type Modul = (a: Anfrage, k: Kontext) => Antwort | undefined | Promise<Antwort | undefined>;
