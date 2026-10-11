/**
 * Demo-Modus (E-119): Die App läuft ohne Server, startet aber leer wie die echte App – Unternehmen anlegen, Fragen
 * beantworten, dann berechnet das Gerät die Pflichten. Gerechnet wird mit derselben Regel-Engine und demselben
 * Katalog wie auf dem Server (@amtlos/rules-engine, catalog/ → src/demo/katalog.json); nur das Speichern ersetzt
 * eine Map die Datenbank. Nichts wird erfunden: Texte, Fristen und Begründungen kommen aus dem Katalog.
 * Ohne React-Native-Abhängigkeiten, damit testbar.
 */
import { StandardKalender, plusMonate, plusTage, type Datum } from "@amtlos/fristen";
import {
  BEREICH_JE_KATEGORIE,
  anzeigeStatus,
  auswerten,
  entscheidendeSaetze,
  heuteUebersicht,
  sollInstanzen,
  type Instanz,
  type Katalog,
  type Pflicht,
  type Soll,
} from "@amtlos/rules-engine";
import type { Abruf, Sprache } from "../kern/api";

export const DEMO_TOKEN = "demo";

type Text = { de: string; en?: string };
const t = (x: Text | undefined | null, s: Sprache) => (x ? (x[s] ?? x.de) : undefined);

/** Wie die Instanz in app.pflicht_instanz, nur im Speicher. */
interface DemoInstanz extends Omit<Soll, "status"> {
  status: Instanz["status"];
  erledigt_am: string | null;
  erledigt_mit_version_id: string | null;
}

/** Heutiges Datum in Berlin – wie heute() im Server. */
export function heuteBerlin(jetzt = new Date()): Datum {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(jetzt);
}

/** Wo die Demo ihren Stand ablegt (in der App: AsyncStorage), damit er das Schließen der App übersteht. */
export interface DemoSpeicher {
  lesen(): Promise<string | null>;
  schreiben(wert: string): Promise<void>;
}

export function demoAbruf(katalog: Katalog, jetzt: () => Date = () => new Date(), speicher?: DemoSpeicher): Abruf {
  const pflichtNachId = new Map<string, Pflicht>(katalog.pflichten.map((p) => [p.id, p]));
  const versionIds = new Map(katalog.pflichten.map((p) => [p.id, `${p.id}@${p.version}`]));
  const schluessel = (pflicht: string, periode: string) => `${pflicht}|${periode}`;

  let unternehmen: { id: string; name: string } | null = null;
  let profil: { version: number; daten: Record<string, unknown> } = { version: 0, daten: {} };
  const instanzen = new Map<string, DemoInstanz>();
  const laufend = new Map<string, string>();

  // Gespeicherten Stand einmal laden und neu rechnen – wie der tägliche Lauf auf dem Server
  const geladen = (async () => {
    const roh = await speicher?.lesen().catch(() => null);
    if (!roh) return;
    try {
      const st = JSON.parse(roh) as { unternehmen: typeof unternehmen; profil: typeof profil; instanzen: [string, DemoInstanz][] };
      unternehmen = st.unternehmen;
      profil = st.profil;
      for (const [k, i] of st.instanzen) instanzen.set(k, i);
      neuberechnen();
    } catch {
      // unlesbarer Stand: leer beginnen
    }
  })();
  const sichern = () => speicher?.schreiben(JSON.stringify({ unternehmen, profil, instanzen: [...instanzen] })).catch(() => undefined);

  /** neuberechnenInTx (packages/server/src/berechnung.ts) ohne Datenbank: auswerten → sollInstanzen → abgleichen. */
  function neuberechnen() {
    if (profil.version === 0) return;
    const stichtag = heuteBerlin(jetzt());
    const bestand = [...instanzen.values()].map((i) => ({ ...i, id: schluessel(i.pflicht_id, i.periode) }));
    const erledigt: Record<string, Datum> = {};
    for (const i of bestand) if (i.status === "erledigt" && i.erledigt_am && !(i.pflicht_id in erledigt)) erledigt[i.pflicht_id] = i.erledigt_am.slice(0, 10);
    const fakten = Object.fromEntries(Object.entries(profil.daten).map(([k, v]) => [`profil.${k}`, v]));
    const fenster = { von: plusMonate(stichtag, -3), bis: plusMonate(stichtag, 12) };
    const ergebnisse = auswerten({ katalog, fakten, ereignisse: [], stichtag, kalender: new StandardKalender(), erledigt, fenster });
    const soll = sollInstanzen(ergebnisse, pflichtNachId, versionIds, bestand, []);
    const sollSchluessel = new Set(soll.map((s) => schluessel(s.pflicht_id, s.periode)));
    for (const s of soll) {
      const k = schluessel(s.pflicht_id, s.periode);
      const vorher = instanzen.get(k);
      if (vorher?.status === "erledigt") continue; // Erledigtes bleibt unangetastet (E-036)
      instanzen.set(k, { ...s, erledigt_am: null, erledigt_mit_version_id: null });
    }
    // Nicht mehr gewünschte offene Instanzen entfallen – außer überfällige vor dem Fenster
    for (const [k, i] of instanzen) {
      if (sollSchluessel.has(k) || i.status === "erledigt" || i.status === "entfallen") continue;
      if (i.status === "offen" && i.faellig_am && i.faellig_am < fenster.von) continue;
      instanzen.set(k, { ...i, status: "entfallen" });
    }
  }

  /** karte() aus apps/api/src/pflichten.controller.ts */
  function karte(i: DemoInstanz, s: Sprache, heute: Datum) {
    const d = pflichtNachId.get(i.pflicht_id)! as Pflicht & Record<string, unknown>;
    const pruefung = (d.pruefung ?? {}) as { status?: string; geprueft_von?: string[] | null; geprueft_am?: string | null };
    const sanktion = d.sanktion as { text: Text; schwere: "niedrig" | "mittel" | "hoch" };
    return {
      pflicht_id: i.pflicht_id,
      periode: i.periode,
      status: anzeigeStatus(i, heute),
      ergebnis: i.ergebnis,
      faellig_am: i.faellig_am,
      verschoben_von: i.faellig_roh && i.faellig_am && i.faellig_roh !== i.faellig_am ? i.faellig_roh : null,
      titel: t(d.titel as Text, s) ?? i.pflicht_id,
      kurz: t(d.kurz as Text, s) ?? "",
      kategorie: d.kategorie,
      branchen: (d.branchen as string[] | undefined) ?? [],
      bereich: BEREICH_JE_KATEGORIE[d.kategorie as string] ?? "gesellschaft",
      sanktion: { text: t(sanktion.text, s) ?? "", schwere: sanktion.schwere },
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

  /** Reihenfolge wie die API: faellig_am nulls last, pflicht_id, periode; ohne Entfallenes. */
  const sichtbar = () =>
    [...instanzen.values()]
      .filter((i) => i.status !== "entfallen")
      .sort((a, b) => (a.faellig_am ?? "9999").localeCompare(b.faellig_am ?? "9999") || a.pflicht_id.localeCompare(b.pflicht_id) || a.periode.localeCompare(b.periode));

  const antwort = (status: number, wert?: unknown) => Promise.resolve({ ok: status < 400, status, json: async () => wert ?? {} });

  return async (url, init) => {
    await geladen;
    const r = await bearbeiten(url, init);
    if (init.method !== "GET") await sichern();
    return r;
  };

  async function bearbeiten(url: string, init: Parameters<Abruf>[1]) {
    const u = new URL(url, "http://demo");
    const pfad = u.pathname;
    const m = init.method;
    const s: Sprache = init.headers["X-Sprache"] === "en" ? "en" : "de";
    const koerper = typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const heute = heuteBerlin(jetzt());
    const nichtGefunden = () => antwort(404, { meldung: s === "en" ? "Not found" : "Nicht gefunden" });

    if (pfad === "/v1/ich" && m === "GET")
      return antwort(200, { konto: { id: "demo", email: "demo@amtlos.de", anzeigename: "Demo", sprache: s }, unternehmen: unternehmen ? [{ ...unternehmen, rolle: "inhaber" }] : [] });
    if (pfad === "/v1/ich/sprache") return antwort(204);
    if (pfad === "/v1/unternehmen" && m === "POST") {
      const name = String(koerper.name ?? "").trim();
      if (name.length < 2) return antwort(422, { meldung: s === "en" ? "Name is too short" : "Der Name ist zu kurz" });
      unternehmen = { id: "demo-unternehmen", name };
      return antwort(201, { ...unternehmen, rolle: "inhaber" });
    }
    if (!unternehmen) return antwort(403, { meldung: s === "en" ? "No company selected" : "Kein Unternehmen gewählt" });

    if (pfad === "/v1/profil" && m === "GET") return antwort(200, profil);
    if (pfad === "/v1/profil" && m === "PUT") {
      profil = { version: profil.version + 1, daten: { ...((koerper.daten as Record<string, unknown>) ?? {}) } };
      neuberechnen();
      return antwort(200, profil);
    }
    if (pfad === "/v1/heute") {
      const liste = sichtbar();
      const ue = heuteUebersicht(
        liste.map((i) => {
          const p = pflichtNachId.get(i.pflicht_id)!;
          return { pflicht_id: i.pflicht_id, periode: i.periode, kategorie: p.kategorie as string, anzeige_status: anzeigeStatus(i, heute), faellig_am: i.faellig_am, schwere: (p.sanktion as { schwere: "niedrig" | "mittel" | "hoch" }).schwere };
        }),
        heute,
      );
      return antwort(200, { ...ue, als_naechstes: ue.als_naechstes.map((a) => karte(instanzen.get(schluessel(a.pflicht_id, a.periode))!, s, heute)), vor_start: { anzahl: 0, seit: null } });
    }
    if (pfad === "/v1/pflichten" && m === "GET") {
      const filter = u.searchParams.get("status") ?? "alle";
      return antwort(200, sichtbar().map((i) => karte(i, s, heute)).filter((k) => filter === "alle" || k.status === filter));
    }
    const p = /^\/v1\/pflichten\/([^/]+)\/([^/]+)(?:\/(erledigen|wieder-oeffnen))?$/.exec(pfad);
    if (p) {
      const k = schluessel(decodeURIComponent(p[1]!), decodeURIComponent(p[2]!));
      const i = instanzen.get(k);
      if (!i || i.status === "entfallen") return nichtGefunden();
      if (p[3] === "erledigen") {
        if (i.status !== "offen") return nichtGefunden();
        instanzen.set(k, { ...i, status: "erledigt", erledigt_am: jetzt().toISOString(), erledigt_mit_version_id: i.pflicht_version_id });
        neuberechnen(); // abhängige Fristen (Bezug „pflicht_erledigt“) wie auf dem Server
        return antwort(200, { pflicht_id: i.pflicht_id, periode: i.periode, status: "erledigt" });
      }
      if (p[3] === "wieder-oeffnen") {
        if (i.status !== "erledigt") return nichtGefunden();
        instanzen.set(k, { ...i, status: "offen", erledigt_am: null, erledigt_mit_version_id: null });
        neuberechnen();
        return antwort(200, { pflicht_id: i.pflicht_id, periode: i.periode, status: "offen" });
      }
      const d = pflichtNachId.get(i.pflicht_id)! as Pflicht & Record<string, unknown>;
      return antwort(200, {
        ...karte(i, s, heute),
        erklaerung: t(d.erklaerung as Text, s) ?? "",
        begriffe: ((d.begriffe as { begriff: Text; erklaerung: Text }[] | undefined) ?? []).map((b) => ({ begriff: t(b.begriff, s), erklaerung: t(b.erklaerung, s) })),
        stelle: t(d.stelle as Text, s) ?? "",
        kosten: d.kosten ? t((d.kosten as { text: Text }).text, s) : null,
        quellen: d.quellen ?? [],
        dokumente: d.dokumente ?? [],
        pflicht_version: d.version,
        regelwerte: i.begruendung.regelwerte ?? [],
        begruendung: i.begruendung.knoten,
        nachweise: [],
      });
    }
    if (pfad === "/v1/abo") return antwort(200, { status: "test", test_bis: plusTage(heute, 14), laeuft_bis: null, schreibbar: true });
    if (pfad === "/v1/beschaeftigte") return antwort(200, []);
    if (pfad === "/v1/zeiten") return antwort(200, { laufend: [...laufend].map(([beschaeftigter_id, beginn]) => ({ beschaeftigter_id, beginn })) });
    if (pfad === "/v1/belege" || pfad === "/v1/geraete") return antwort(200, { id: `demo-${Date.now()}` });
    if (pfad.startsWith("/v1/geraete/")) return antwort(204);
    return antwort(404, { meldung: s === "en" ? "Not available in the demo" : "In der Demo nicht verfügbar" });
  }
}
