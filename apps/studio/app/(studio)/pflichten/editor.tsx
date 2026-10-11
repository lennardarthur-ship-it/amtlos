"use client";

import { cloneElement, useId, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { bedingungGliederung, fristAlsText, type Bedingung, type Frist, type Gliederung, type Pflicht } from "@amtlos/rules-engine";
import {
  IMMER,
  OPS_FUER_TYP,
  OP_TEXT,
  bedingungsArt,
  bereinigen,
  brauchtListe,
  dauerBauen,
  dauerZerlegen,
  dauernZuTage,
  istZahlTyp,
  neueBedingung,
  startwert,
  tageZuDauern,
  type Fakt,
} from "@/lib/editor-helfer";

export interface EditorDaten {
  fakten: Fakt[];
  ereignisse: string[];
  regelwerte: string[];
  pflichten: string[];
}

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- frei strukturierter Entwurf, validiert beim Speichern

const KATEGORIEN = ["gruendung", "gesellschaft", "steuern", "personal", "arbeitsschutz", "datenschutz", "it_sicherheit", "ki", "online", "produkte", "branche"];
const KANAELE = ["elster", "portal", "post", "notar", "intern_dokumentieren", "partner"];
const AUTOMATISIERUNG = ["hinweis", "formular_vorausfuellen", "direkt_uebermitteln", "dokument_generator", "partner"];
const STATUS_RECHT = ["in_kraft", "beschlossen", "entwurf", "geplant", "ausgelaufen"];
const AKTIONEN = ["", "link", "formular", "dokument", "uebermittlung", "partner", "abhaken"];
const VERSCHIEBUNGEN = ["keine", "naechster_werktag", "naechster_bankarbeitstag", "vorheriger_werktag", "vorheriger_bankarbeitstag"];
const KALENDER = ["bundeseinheitlich", "bundesland", "gemeinde", "bankarbeitstage"];
const RHYTHMEN = ["monatlich", "quartalsweise", "halbjaehrlich", "jaehrlich", "keiner"];
const EINHEITEN = [
  ["D", "Tage"],
  ["W", "Wochen"],
  ["M", "Monate"],
  ["Y", "Jahre"],
] as const;

/** Formular-Editor für eine Pflichtversion. Speichern legt immer eine neue Version an (Vier-Augen-Prüfung folgt). */
export function PflichtEditor({ start, daten, aktion, knopf }: { start: Pflicht; daten: EditorDaten; aktion: (f: FormData) => void; knopf: string }) {
  const [p, setP] = useState<P>(() => structuredClone(start) as P);
  const [jsonModus, setJsonModus] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonFehler, setJsonFehler] = useState<string | null>(null);
  const setze = (k: string, v: unknown) => setP((alt) => ({ ...alt, [k]: v }));
  const bereinigt = useMemo(() => bereinigen(p), [p]);
  const branchenFakt = daten.fakten.find((f) => f.pfad === "profil.taetigkeit.branchen");
  const radarNoetig = ["entwurf", "beschlossen", "geplant"].includes(p.status_recht);

  return (
    <form action={aktion} className="space-y-8">
      <input type="hidden" name="daten" value={JSON.stringify(bereinigt)} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="knopf knopf-leise" onClick={() => {
          if (jsonModus) {
            try {
              setP(JSON.parse(jsonText));
              setJsonFehler(null);
              setJsonModus(false);
            } catch (e) {
              setJsonFehler((e as Error).message);
            }
          } else {
            setJsonText(JSON.stringify(bereinigt, null, 2));
            setJsonModus(true);
          }
        }}>
          {jsonModus ? "JSON übernehmen und zurück zum Formular" : "Als JSON bearbeiten (Fortgeschrittene)"}
        </button>
        <span className="text-klein text-tinte-leise">ID: {p.id}</span>
      </div>

      {jsonModus ? (
        <div className="space-y-2">
          {jsonFehler ? <p role="alert" className="rounded-md border-2 border-frist bg-frist-hauch p-3 text-klein">Kein gültiges JSON: {jsonFehler}</p> : null}
          <textarea aria-label="Pflicht als JSON" rows={30} spellCheck={false} className="feld font-mono text-klein" value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
        </div>
      ) : (
        <>
          <Abschnitt titel="Was ist zu tun">
            <TextPaar name="Titel" wert={p.titel} aendern={(v) => setze("titel", v)} />
            <TextPaar name="In einem Satz" wert={p.kurz} aendern={(v) => setze("kurz", v)} hilfe="Was zu tun ist und warum, in einfacher Sprache." />
            <TextPaar name="Erklärung" wert={p.erklaerung} aendern={(v) => setze("erklaerung", v)} mehrzeilig />
            <TextPaar name="Zuständige Stelle" wert={p.stelle} aendern={(v) => setze("stelle", v)} />
            <ListeEditor
              titel="Fachbegriffe"
              eintraege={p.begriffe ?? []}
              neu={() => ({ begriff: { de: "" }, erklaerung: { de: "" } })}
              aendern={(v) => setze("begriffe", v)}
              zeile={(b, setB) => (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Feld name="Begriff"><input className="feld" value={b.begriff.de} onChange={(e) => setB({ ...b, begriff: { ...b.begriff, de: e.target.value } })} /></Feld>
                  <Feld name="Erklärung in einem Satz"><input className="feld" value={b.erklaerung.de} onChange={(e) => setB({ ...b, erklaerung: { ...b.erklaerung, de: e.target.value } })} /></Feld>
                </div>
              )}
            />
          </Abschnitt>

          <Abschnitt titel="Einordnung">
            <div className="grid gap-4 sm:grid-cols-3">
              <Feld name="Kategorie"><Auswahl werte={KATEGORIEN} wert={p.kategorie} aendern={(v) => setze("kategorie", v)} /></Feld>
              <Feld name="Katalog-Nr."><input className="feld" value={p.katalog_nr ?? ""} onChange={(e) => setze("katalog_nr", e.target.value)} /></Feld>
              <Feld name="Kanal"><Auswahl werte={KANAELE} wert={p.kanal} aendern={(v) => setze("kanal", v)} /></Feld>
              <Feld name="Automatisierung"><Auswahl werte={AUTOMATISIERUNG} wert={p.automatisierung} aendern={(v) => setze("automatisierung", v)} /></Feld>
              <Feld name="Rechtsstatus"><Auswahl werte={STATUS_RECHT} wert={p.status_recht} aendern={(v) => setze("status_recht", v)} /></Feld>
              <Feld name="Gültig ab"><input type="date" className="feld" value={p.gueltig_ab ?? ""} onChange={(e) => setze("gueltig_ab", e.target.value || null)} /></Feld>
              <Feld name="Gültig bis"><input type="date" className="feld" value={p.gueltig_bis ?? ""} onChange={(e) => setze("gueltig_bis", e.target.value || null)} /></Feld>
            </div>
            {radarNoetig ? (
              <div className="grid gap-4 rounded-md border-2 border-dashed border-linie p-4 sm:grid-cols-2">
                <p className="text-klein sm:col-span-2">Noch nicht in Kraft: erscheint im Rechtsänderungs-Radar statt im Pflichtenplan.</p>
                <Feld name="Wahrscheinlichkeit"><Auswahl werte={["niedrig", "mittel", "hoch", "sicher"]} wert={p.radar?.wahrscheinlichkeit ?? "mittel"} aendern={(v) => setze("radar", { ...(p.radar ?? {}), wahrscheinlichkeit: v })} /></Feld>
                <Feld name="Erwartet ab"><input type="date" className="feld" value={p.radar?.erwartet_ab ?? ""} onChange={(e) => setze("radar", { wahrscheinlichkeit: "mittel", ...(p.radar ?? {}), erwartet_ab: e.target.value || null })} /></Feld>
              </div>
            ) : null}
            {branchenFakt?.werte ? (
              <Mehrfach titel="Hervorheben in Branchenmodulen" werte={branchenFakt.werte} gewaehlt={p.branchen ?? []} aendern={(v) => setze("branchen", v)} />
            ) : null}
            <Mehrfach titel="Muss vorher erledigt sein" werte={daten.pflichten.filter((x) => x !== p.id)} gewaehlt={p.voraussetzungen ?? []} aendern={(v) => setze("voraussetzungen", v)} spalten />
          </Abschnitt>

          <Abschnitt titel="Wann gilt die Pflicht (Auslöser)">
            <p className="text-klein text-tinte-leise">Fehlt eine Angabe im Profil, ist das Ergebnis „Angabe fehlt“, nie „gilt nicht“ (E-033). Labels erscheinen beim Nutzer als „gilt für dich, weil …“.</p>
            <BedingungsEditor b={p.ausloeser} daten={daten} aendern={(v) => setze("ausloeser", v)} />
            <Vorschau g={bedingungGliederung(p.ausloeser as Bedingung)} />
          </Abschnitt>

          <Abschnitt titel="Frist">
            <FristEditor f={p.frist} daten={daten} aendern={(v) => setze("frist", v)} />
            <p className="text-klein"><strong>Klartext:</strong> {fristSicher(p.frist)}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld name="Wiederholung">
                <Auswahl werte={["einmalig", "periodisch", "bei_aenderung", "dauerhaft"]} wert={p.wiederholung?.art} aendern={(v) => setze("wiederholung", v === "bei_aenderung" ? { art: v, neu_ausloesen_bei: p.wiederholung?.neu_ausloesen_bei ?? [] } : { art: v })} />
              </Feld>
              <label className="flex items-center gap-3 self-end pb-2">
                <input type="checkbox" className="size-5 accent-amt" checked={Boolean(p.erneut_erledigen)} onChange={(e) => setze("erneut_erledigen", e.target.checked)} />
                Diese Version öffnet bereits erledigte Pflichten erneut
              </label>
            </div>
            {p.wiederholung?.art === "bei_aenderung" ? (
              <Mehrfach
                titel="Erneut fällig bei diesen Ereignissen"
                werte={daten.ereignisse}
                gewaehlt={(p.wiederholung.neu_ausloesen_bei ?? []).flatMap((x: { ereignis?: string }) => (x.ereignis ? [x.ereignis] : []))}
                aendern={(v) => setze("wiederholung", { art: "bei_aenderung", neu_ausloesen_bei: v.map((e) => ({ ereignis: e })) })}
                spalten
              />
            ) : null}
          </Abschnitt>

          <Abschnitt titel="Folgen und Erledigung">
            <TextPaar name="Was passiert, wenn man es nicht tut" wert={p.sanktion?.text} aendern={(v) => setze("sanktion", { ...p.sanktion, text: v })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Feld name="Schwere (für die Reihenfolge)"><Auswahl werte={["niedrig", "mittel", "hoch"]} wert={p.sanktion?.schwere} aendern={(v) => setze("sanktion", { ...p.sanktion, schwere: v })} /></Feld>
              <Feld name="Erledigen-Knopf"><Auswahl werte={AKTIONEN} wert={p.aktion?.art ?? ""} aendern={(v) => setze("aktion", v ? { ...(p.aktion ?? {}), art: v } : undefined)} leer="kein Knopf" /></Feld>
              <Feld name="Ziel des Knopfs"><input className="feld" value={p.aktion?.ziel ?? ""} disabled={!p.aktion?.art} onChange={(e) => setze("aktion", { ...p.aktion, ziel: e.target.value })} /></Feld>
            </div>
            <Feld name="Kosten (optional)"><input className="feld" value={p.kosten?.text?.de ?? ""} onChange={(e) => setze("kosten", e.target.value ? { text: { de: e.target.value } } : null)} /></Feld>
          </Abschnitt>

          <Abschnitt titel="Rechtsgrundlage und Quellen">
            <ListeEditor titel="Rechtsgrundlagen" eintraege={p.rechtsgrundlage ?? []} neu={() => ""} aendern={(v) => setze("rechtsgrundlage", v)}
              zeile={(r, setR, i) => <Feld name={`Rechtsgrundlage ${i + 1}`} versteckt><input className="feld" placeholder="z. B. § 18 UStG" value={r} onChange={(e) => setR(e.target.value)} /></Feld>} />
            <ListeEditor titel="Quellen" eintraege={p.quellen ?? []} neu={() => ({ titel: "", url: "", abgerufen: null as string | null, fundstelle: "" as string | undefined })} aendern={(v) => setze("quellen", v)}
              zeile={(q, setQ) => (
                <div className="grid gap-2 sm:grid-cols-[2fr_3fr_1fr_1fr]">
                  <Feld name="Titel"><input className="feld" value={q.titel} onChange={(e) => setQ({ ...q, titel: e.target.value })} /></Feld>
                  <Feld name="Adresse"><input className="feld" type="url" value={q.url} onChange={(e) => setQ({ ...q, url: e.target.value })} /></Feld>
                  <Feld name="Abgerufen am"><input className="feld" type="date" value={q.abgerufen ?? ""} onChange={(e) => setQ({ ...q, abgerufen: e.target.value || null })} /></Feld>
                  <Feld name="Fundstelle"><input className="feld" value={q.fundstelle ?? ""} onChange={(e) => setQ({ ...q, fundstelle: e.target.value })} /></Feld>
                </div>
              )} />
          </Abschnitt>

          <Abschnitt titel="Offene fachliche Punkte">
            <p className="text-klein text-tinte-leise">Alles, was nicht sicher ist. Mit offenen Punkten kann die Version in kein prod-Release.</p>
            <ListeEditor titel="Prüfpunkte" eintraege={p.fachlich_zu_pruefen ?? []} neu={() => ""} aendern={(v) => setze("fachlich_zu_pruefen", v)}
              zeile={(t, setT, i) => <Feld name={`Prüfpunkt ${i + 1}`} versteckt><input className="feld" value={t} onChange={(e) => setT(e.target.value)} /></Feld>} />
            <TextPaar name="Was hat sich gegenüber der Vorversion geändert" wert={p.aenderungsnotiz ?? { de: "" }} aendern={(v) => setze("aenderungsnotiz", v)} />
          </Abschnitt>
        </>
      )}

      <div className="sticky bottom-0 -mx-4 border-t-2 border-tinte bg-papier px-4 py-3">
        <button className="knopf" disabled={jsonModus}>{knopf}</button>
        {jsonModus ? <span className="ml-3 text-klein">Erst JSON übernehmen.</span> : <span className="ml-3 text-klein text-tinte-leise">Gespeichert wird eine neue Version; sie ist erst nach Vier-Augen-Prüfung freigegeben.</span>}
      </div>
    </form>
  );
}

function fristSicher(f: Frist): string {
  try {
    return fristAlsText(f);
  } catch {
    return "unvollständig";
  }
}

// ---------------------------------------------------------------- Bedingungen

function BedingungsEditor({ b, daten, aendern, tiefe = 0, entfernen }: { b: Bedingung; daten: EditorDaten; aendern: (b: Bedingung) => void; tiefe?: number; entfernen?: () => void }) {
  const art = bedingungsArt(b);
  const label = "label" in b ? b.label?.de ?? "" : "";
  const mitLabel = (x: Bedingung): Bedingung => (label && art !== "immer" ? ({ ...x, label: { de: label } } as Bedingung) : x);
  const id = useId();

  return (
    <div className={`space-y-3 rounded-md border-l-4 ${tiefe % 2 ? "border-amt-hauch" : "border-linie"} bg-blatt p-3`}>
      <div className="flex flex-wrap items-end gap-3">
        <Feld name={tiefe === 0 ? "Art der Bedingung" : "Art"}>
          <select className="feld" value={art} onChange={(e) => aendern(neueBedingung(e.target.value as never, daten.fakten, daten.ereignisse))}>
            <option value="vergleich">Angabe im Profil vergleichen</option>
            <option value="ereignis">Ereignis gemeldet</option>
            <option value="all">Alle folgenden (und)</option>
            <option value="any">Mindestens eine (oder)</option>
            <option value="not">Nicht</option>
            <option value="immer">Immer</option>
          </select>
        </Feld>
        {art === "vergleich" && "feld" in b ? <VergleichFelder b={b} daten={daten} aendern={(x) => aendern(mitLabel(x))} /> : null}
        {art === "ereignis" && "ereignis" in b ? (
          <>
            <Feld name="Ereignis"><Auswahl werte={daten.ereignisse} wert={b.ereignis} aendern={(v) => aendern(mitLabel({ ...b, ereignis: v }))} /></Feld>
            <Feld name="Zustand"><Auswahl werte={["eingetreten", "nicht_eingetreten", "geplant"]} wert={b.op} aendern={(v) => aendern(mitLabel({ ...b, op: v as never }))} /></Feld>
            <DauerFeld name="innerhalb von (optional)" wert={b.innerhalb} optional aendern={(v) => { const { innerhalb: _i, ...rest } = b; aendern(mitLabel(v ? { ...rest, innerhalb: v } : rest)); }} />
          </>
        ) : null}
        {entfernen ? <button type="button" className="verweis min-h-11 text-klein" onClick={entfernen}>Entfernen</button> : null}
      </div>

      {art !== "immer" ? (
        <Feld name="Satz für Nutzer (optional)" id={`${id}-l`}>
          <input className="feld" placeholder="z. B. Du beschäftigst mindestens eine Person." value={label}
            onChange={(e) => { const { label: _l, ...rest } = b as Bedingung & { label?: unknown }; aendern((e.target.value ? { ...rest, label: { de: e.target.value } } : rest) as Bedingung); }} />
        </Feld>
      ) : null}

      {art === "all" || art === "any" ? (
        <div className="space-y-3 pl-3">
          {((b as { all?: Bedingung[]; any?: Bedingung[] })[art] ?? []).map((kind, i, liste) => (
            <BedingungsEditor key={i} b={kind} daten={daten} tiefe={tiefe + 1}
              aendern={(x) => aendern({ ...b, [art]: liste.map((k, j) => (j === i ? x : k)) } as Bedingung)}
              entfernen={liste.length > 1 ? () => aendern({ ...b, [art]: liste.filter((_, j) => j !== i) } as Bedingung) : undefined} />
          ))}
          <button type="button" className="knopf knopf-leise min-h-9 py-1 text-klein"
            onClick={() => aendern({ ...b, [art]: [...((b as unknown as Record<string, Bedingung[]>)[art] ?? []), neueBedingung("vergleich", daten.fakten, daten.ereignisse)] } as Bedingung)}>
            Bedingung hinzufügen
          </button>
        </div>
      ) : null}
      {art === "not" && "not" in b ? (
        <div className="pl-3"><BedingungsEditor b={b.not} daten={daten} tiefe={tiefe + 1} aendern={(x) => aendern({ ...b, not: x })} /></div>
      ) : null}
    </div>
  );
}

function VergleichFelder({ b, daten, aendern }: { b: Extract<Bedingung, { feld: string }>; daten: EditorDaten; aendern: (b: Bedingung) => void }) {
  const fakt = daten.fakten.find((f) => f.pfad === b.feld);
  const ops = [...(OPS_FUER_TYP[fakt?.typ ?? ""] ?? []), ...IMMER];
  const setzeWert = (feld: string, op: string, w: unknown) => {
    const basis = { feld, op } as Record<string, unknown>;
    if (b.label) basis.label = b.label;
    if (w !== undefined) basis.wert = w;
    aendern(basis as Bedingung);
  };
  const istRegelwert = typeof b.wert === "object" && b.wert !== null && !Array.isArray(b.wert);
  const gruppen = useMemo(() => {
    const g = new Map<string, Fakt[]>();
    for (const f of daten.fakten) g.set(f.pfad.split(".")[0]!, [...(g.get(f.pfad.split(".")[0]!) ?? []), f]);
    return [...g.entries()];
  }, [daten.fakten]);

  return (
    <>
      <Feld name="Angabe (Fakt)">
        <select className="feld" value={b.feld} onChange={(e) => {
          const f = daten.fakten.find((x) => x.pfad === e.target.value);
          const op = (OPS_FUER_TYP[f?.typ ?? ""] ?? ["=="])[0]!;
          setzeWert(e.target.value, op, startwert(f, op));
        }}>
          {fakt ? null : <option value={b.feld}>{b.feld} (unbekannt)</option>}
          {gruppen.map(([gruppe, liste]) => (
            <optgroup key={gruppe} label={gruppe}>
              {liste.map((f) => <option key={f.pfad} value={f.pfad}>{f.pfad.slice(gruppe.length + 1)} ({f.typ})</option>)}
            </optgroup>
          ))}
        </select>
      </Feld>
      <Feld name="Vergleich">
        <select className="feld" value={b.op} onChange={(e) => setzeWert(b.feld, e.target.value, startwert(fakt, e.target.value))}>
          {ops.map((o) => <option key={o} value={o}>{OP_TEXT[o]}</option>)}
        </select>
      </Feld>
      {IMMER.includes(b.op) || !fakt ? null : brauchtListe(b.op) && fakt.werte ? (
        <Mehrfach titel="Werte" werte={fakt.werte} gewaehlt={(b.wert as string[]) ?? []} aendern={(v) => setzeWert(b.feld, b.op, v)} />
      ) : fakt.typ === "bool" ? (
        <Feld name="Wert"><select className="feld" value={String(b.wert)} onChange={(e) => setzeWert(b.feld, b.op, e.target.value === "true")}><option value="true">ja</option><option value="false">nein</option></select></Feld>
      ) : fakt.werte ? (
        <Feld name="Wert"><Auswahl werte={fakt.werte} wert={String(b.wert ?? "")} aendern={(v) => setzeWert(b.feld, b.op, v)} /></Feld>
      ) : istZahlTyp(fakt.typ) ? (
        <>
          <Feld name="Vergleichswert">
            <select className="feld" value={istRegelwert ? "regelwert" : "zahl"} onChange={(e) => setzeWert(b.feld, b.op, e.target.value === "regelwert" ? { regelwert: daten.regelwerte[0] ?? "" } : 0)}>
              <option value="zahl">feste Zahl</option>
              <option value="regelwert" disabled={!daten.regelwerte.length}>Regelwert (mit Gültigkeitszeitraum)</option>
            </select>
          </Feld>
          {istRegelwert ? (
            <>
              <Feld name="Regelwert"><Auswahl werte={daten.regelwerte} wert={(b.wert as { regelwert: string }).regelwert} aendern={(v) => setzeWert(b.feld, b.op, { ...(b.wert as object), regelwert: v })} /></Feld>
              <Feld name="Faktor (optional)">
                <input className="feld w-28" type="number" step="0.01" min="0" value={(b.wert as { faktor?: number }).faktor ?? ""}
                  onChange={(e) => { const { faktor: _f, ...rw } = b.wert as { regelwert: string; faktor?: number }; setzeWert(b.feld, b.op, e.target.value ? { ...rw, faktor: Number(e.target.value) } : rw); }} />
              </Feld>
            </>
          ) : (
            <Feld name="Zahl"><input className="feld w-36" type="number" step="any" value={Number(b.wert ?? 0)} onChange={(e) => setzeWert(b.feld, b.op, Number(e.target.value))} /></Feld>
          )}
        </>
      ) : fakt.typ === "datum" ? (
        <Feld name="Datum"><input className="feld" type="date" value={String(b.wert ?? "")} onChange={(e) => setzeWert(b.feld, b.op, e.target.value)} /></Feld>
      ) : (
        <Feld name="Wert"><input className="feld" value={String(b.wert ?? "")} onChange={(e) => setzeWert(b.feld, b.op, e.target.value)} /></Feld>
      )}
    </>
  );
}

function Vorschau({ g }: { g: Gliederung }) {
  const knoten = (x: Gliederung, i: number): ReactNode => (
    <li key={i}>
      {x.text}
      {x.kinder.length ? <ul className="list-[circle] pl-5">{x.kinder.map(knoten)}</ul> : null}
    </li>
  );
  return (
    <div className="rounded-md bg-amt-hauch p-3 text-klein" aria-live="polite">
      <strong>Klartext: Die Pflicht gilt, wenn</strong>
      <ul className="list-disc pl-5">{knoten(g, 0)}</ul>
    </div>
  );
}

// ---------------------------------------------------------------- Frist

function FristEditor({ f, daten, aendern }: { f: P; daten: EditorDaten; aendern: (f: P) => void }) {
  const verschiebung = f.verschiebung ?? { regel: "naechster_werktag", kalender: "bundesland" };
  const erinnerung = (
    <Feld name="Erinnern (Tage vorher, durch Komma getrennt)">
      <input className="feld w-48" defaultValue={dauernZuTage(f.erinnerung)} onBlur={(e) => { const d = tageZuDauern(e.target.value); const { erinnerung: _e, ...rest } = f; aendern(d.length ? { ...rest, erinnerung: d } : rest); }} />
    </Feld>
  );
  const verschiebungFelder = f.typ === "dauerhaft" ? null : (
    <>
      <Feld name="Fällt auf Wochenende/Feiertag"><Auswahl werte={VERSCHIEBUNGEN} wert={verschiebung.regel} aendern={(v) => aendern({ ...f, verschiebung: { ...verschiebung, regel: v } })} /></Feld>
      <Feld name="Feiertagskalender"><Auswahl werte={KALENDER} wert={verschiebung.kalender} aendern={(v) => aendern({ ...f, verschiebung: { ...verschiebung, kalender: v } })} /></Feld>
    </>
  );
  const typWechsel = (typ: string) => {
    const v = { verschiebung };
    if (typ === "dauerhaft") aendern({ typ });
    if (typ === "absolut") aendern({ typ, datum: "", ...v });
    if (typ === "relativ") aendern({ typ, bezug: { fakt: "profil.gruendungsdatum" }, versatz: "P0D", ...v });
    if (typ === "wiederkehrend") aendern({ typ, rhythmus: "monatlich", faellig: { art: "tag_nach_periodenende", monate_nach: 1, tag: 10 }, ...v });
  };
  const bezugArt = f.bezug ? Object.keys(f.bezug)[0] : "fakt";
  const datumsFakten = daten.fakten.filter((x) => x.typ === "datum").map((x) => x.pfad);
  const abhaengig = f.rhythmus && typeof f.rhythmus === "object";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Feld name="Art der Frist">
          <select className="feld" value={f.typ} onChange={(e) => typWechsel(e.target.value)}>
            <option value="dauerhaft">laufend, ohne Termin</option>
            <option value="absolut">festes Datum</option>
            <option value="relativ">nach einem Ereignis oder Datum</option>
            <option value="wiederkehrend">wiederkehrend</option>
          </select>
        </Feld>
        {f.typ === "absolut" ? <Feld name="Datum"><input className="feld" type="date" value={f.datum ?? ""} onChange={(e) => aendern({ ...f, datum: e.target.value })} /></Feld> : null}
        {f.typ === "relativ" ? (
          <>
            <Feld name="Bezug">
              <select className="feld" value={bezugArt} onChange={(e) => aendern({ ...f, bezug: e.target.value === "ereignis" ? { ereignis: daten.ereignisse[0] } : e.target.value === "fakt" ? { fakt: datumsFakten[0] } : { pflicht_erledigt: daten.pflichten[0] } })}>
                <option value="fakt">Datum im Profil</option>
                <option value="ereignis">Ereignis</option>
                <option value="pflicht_erledigt">andere Pflicht erledigt</option>
              </select>
            </Feld>
            <Feld name={bezugArt === "ereignis" ? "Ereignis" : bezugArt === "fakt" ? "Datum" : "Pflicht"}>
              <Auswahl werte={bezugArt === "ereignis" ? daten.ereignisse : bezugArt === "fakt" ? datumsFakten : daten.pflichten} wert={Object.values(f.bezug ?? {})[0] as string} aendern={(v) => aendern({ ...f, bezug: { [String(bezugArt)]: v } })} />
            </Feld>
            <Feld name="Zeitpunkt"><Auswahl werte={["spaetestens", "vor_beginn"]} wert={f.zeitpunkt ?? "spaetestens"} aendern={(v) => aendern({ ...f, zeitpunkt: v })} /></Feld>
            <DauerFeld name="Versatz" wert={f.versatz} negativErlaubt aendern={(v) => aendern({ ...f, versatz: v ?? "P0D" })} />
          </>
        ) : null}
        {f.typ === "wiederkehrend" ? (
          <>
            <Feld name="Rhythmus">
              <select className="feld" value={abhaengig ? "abhaengig" : f.rhythmus} onChange={(e) => aendern({ ...f, rhythmus: e.target.value === "abhaengig" ? { waehle: [{ wenn: { immer: true }, dann: "monatlich" }], sonst: "quartalsweise" } : e.target.value })}>
                {RHYTHMEN.map((r) => <option key={r} value={r}>{r}</option>)}
                <option value="abhaengig">abhängig von Angaben</option>
              </select>
            </Feld>
            <Feld name="Fällig">
              <select className="feld" value={f.faellig?.art} onChange={(e) => aendern({ ...f, faellig: e.target.value === "feste_termine" ? { art: e.target.value, termine: ["03-10"] } : e.target.value === "n_letzter_bankarbeitstag" ? { art: e.target.value, n: 3 } : { art: e.target.value, monate_nach: 1, tag: 10 } })}>
                <option value="tag_nach_periodenende">Tag X nach Zeitraumende</option>
                <option value="feste_termine">feste Termine im Jahr</option>
                <option value="n_letzter_bankarbeitstag">n-letzter Bankarbeitstag</option>
              </select>
            </Feld>
            {f.faellig?.art === "tag_nach_periodenende" ? (
              <>
                <Feld name="Monate nach Ende"><input className="feld w-24" type="number" min={0} value={f.faellig.monate_nach ?? 1} onChange={(e) => aendern({ ...f, faellig: { ...f.faellig, monate_nach: Number(e.target.value) } })} /></Feld>
                <Feld name="Tag"><input className="feld w-24" type="number" min={1} max={31} value={f.faellig.tag} onChange={(e) => aendern({ ...f, faellig: { ...f.faellig, tag: Number(e.target.value) } })} /></Feld>
              </>
            ) : null}
            {f.faellig?.art === "feste_termine" ? (
              <Feld name="Termine (MM-TT, durch Komma)"><input className="feld w-64" defaultValue={(f.faellig.termine ?? []).join(", ")} onBlur={(e) => aendern({ ...f, faellig: { ...f.faellig, termine: e.target.value.split(/[,\s]+/).filter(Boolean) } })} /></Feld>
            ) : null}
            {f.faellig?.art === "n_letzter_bankarbeitstag" ? (
              <>
                <Feld name="n"><input className="feld w-20" type="number" min={1} max={10} value={f.faellig.n} onChange={(e) => aendern({ ...f, faellig: { ...f.faellig, n: Number(e.target.value) } })} /></Feld>
                <Feld name="Arbeitstage vorher"><input className="feld w-20" type="number" min={0} value={f.faellig.arbeitstage_vorher ?? 0} onChange={(e) => aendern({ ...f, faellig: { ...f.faellig, arbeitstage_vorher: Number(e.target.value) } })} /></Feld>
              </>
            ) : null}
          </>
        ) : null}
        {verschiebungFelder}
        {erinnerung}
      </div>

      {f.typ === "wiederkehrend" && abhaengig ? (
        <div className="space-y-3 rounded-md border-2 border-dashed border-linie p-3">
          <p className="text-klein font-bold">Rhythmus nach Angaben (erste zutreffende Regel gilt)</p>
          {f.rhythmus.waehle.map((w: { wenn: Bedingung; dann: string }, i: number) => (
            <div key={i} className="space-y-2">
              <Feld name={`Regel ${i + 1}: Rhythmus`}><Auswahl werte={RHYTHMEN} wert={w.dann} aendern={(v) => aendern({ ...f, rhythmus: { ...f.rhythmus, waehle: f.rhythmus.waehle.map((x: object, j: number) => (j === i ? { ...x, dann: v } : x)) } })} /></Feld>
              <BedingungsEditor b={w.wenn} daten={daten} tiefe={1}
                aendern={(b) => aendern({ ...f, rhythmus: { ...f.rhythmus, waehle: f.rhythmus.waehle.map((x: object, j: number) => (j === i ? { ...x, wenn: b } : x)) } })}
                entfernen={f.rhythmus.waehle.length > 1 ? () => aendern({ ...f, rhythmus: { ...f.rhythmus, waehle: f.rhythmus.waehle.filter((_: unknown, j: number) => j !== i) } }) : undefined} />
            </div>
          ))}
          <button type="button" className="knopf knopf-leise min-h-9 py-1 text-klein" onClick={() => aendern({ ...f, rhythmus: { ...f.rhythmus, waehle: [...f.rhythmus.waehle, { wenn: { immer: true }, dann: "monatlich" }] } })}>Regel hinzufügen</button>
          <Feld name="Sonst"><Auswahl werte={RHYTHMEN} wert={f.rhythmus.sonst} aendern={(v) => aendern({ ...f, rhythmus: { ...f.rhythmus, sonst: v } })} /></Feld>
        </div>
      ) : null}

      {f.typ === "wiederkehrend" ? (
        <div className="space-y-2">
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-5 accent-amt" checked={Boolean(f.verlaengerung)} onChange={(e) => { const { verlaengerung: _v, ...rest } = f; aendern(e.target.checked ? { ...rest, verlaengerung: { wenn: { immer: true }, versatz: "P1M" } } : rest); }} />
            Frist verlängert sich unter einer Bedingung (z. B. Dauerfristverlängerung)
          </label>
          {f.verlaengerung ? (
            <div className="space-y-2 pl-8">
              <DauerFeld name="Verlängerung um" wert={f.verlaengerung.versatz} aendern={(v) => aendern({ ...f, verlaengerung: { ...f.verlaengerung, versatz: v ?? "P1M" } })} />
              <BedingungsEditor b={f.verlaengerung.wenn} daten={daten} tiefe={1} aendern={(b) => aendern({ ...f, verlaengerung: { ...f.verlaengerung, wenn: b } })} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Bausteine

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-4 border-t border-linie pt-5">
      <h2 id={id} className="text-gross font-bold">{titel}</h2>
      {children}
    </section>
  );
}

/** Beschriftetes Eingabefeld; Label explizit verknüpft (Name ohne Wert des Felds, WCAG 4.1.2). */
function Feld({ name, children, hilfe, versteckt }: { name: string; children: ReactElement<{ id?: string; "aria-describedby"?: string }>; hilfe?: string; versteckt?: boolean; id?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={versteckt ? "sr-only" : "mb-1 block text-klein font-bold"}>{name}</label>
      {cloneElement(children, { id, ...(hilfe ? { "aria-describedby": `${id}-h` } : {}) })}
      {hilfe ? <span id={`${id}-h`} className="mt-1 block text-klein text-tinte-leise">{hilfe}</span> : null}
    </div>
  );
}

function Auswahl({ werte, wert, aendern, leer, id }: { werte: string[]; wert: string | undefined; aendern: (v: string) => void; leer?: string; id?: string }) {
  return (
    <select id={id} className="feld" value={wert ?? ""} onChange={(e) => aendern(e.target.value)}>
      {werte.map((w) => <option key={w} value={w}>{w || leer || "–"}</option>)}
      {wert && !werte.includes(wert) ? <option value={wert}>{wert} (unbekannt)</option> : null}
    </select>
  );
}

function TextPaar({ name, wert, aendern, mehrzeilig, hilfe }: { name: string; wert: { de: string; en?: string } | undefined; aendern: (v: { de: string; en?: string }) => void; mehrzeilig?: boolean; hilfe?: string }) {
  const w = wert ?? { de: "" };
  const Eingabe = mehrzeilig ? "textarea" : "input";
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-1 text-klein font-bold">{name}</legend>
      <Feld name={`${name} (Deutsch)`} versteckt><Eingabe className="feld" rows={mehrzeilig ? 4 : undefined} placeholder="Deutsch" value={w.de} onChange={(e) => aendern({ ...w, de: e.target.value })} /></Feld>
      <Feld name={`${name} (Englisch)`} versteckt><Eingabe className="feld" rows={mehrzeilig ? 4 : undefined} placeholder="English (für prod nötig)" value={w.en ?? ""} onChange={(e) => aendern({ ...w, en: e.target.value })} /></Feld>
      {hilfe ? <span className="text-klein text-tinte-leise sm:col-span-2">{hilfe}</span> : null}
    </fieldset>
  );
}

function Mehrfach({ titel, werte, gewaehlt, aendern, spalten }: { titel: string; werte: string[]; gewaehlt: string[]; aendern: (v: string[]) => void; spalten?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-1 text-klein font-bold">{titel}</legend>
      <div className={spalten ? "grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-wrap gap-x-4"}>
        {werte.map((w) => (
          <label key={w} className="flex min-h-9 items-center gap-2 text-klein">
            <input type="checkbox" className="size-4 accent-amt" checked={gewaehlt.includes(w)} onChange={(e) => aendern(e.target.checked ? [...gewaehlt, w] : gewaehlt.filter((x) => x !== w))} />
            {w}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ListeEditor<T>({ titel, eintraege, neu, aendern, zeile }: { titel: string; eintraege: T[]; neu: () => T; aendern: (v: T[]) => void; zeile: (e: T, set: (e: T) => void, i: number) => ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-klein font-bold">{titel}</legend>
      {eintraege.map((e, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">{zeile(e, (x) => aendern(eintraege.map((y, j) => (j === i ? x : y))), i)}</div>
          <button type="button" className="verweis min-h-11 text-klein" aria-label={`${titel}: Eintrag ${i + 1} entfernen`} onClick={() => aendern(eintraege.filter((_, j) => j !== i))}>Entfernen</button>
        </div>
      ))}
      <button type="button" className="knopf knopf-leise min-h-9 py-1 text-klein" onClick={() => aendern([...eintraege, neu()])}>Hinzufügen</button>
    </fieldset>
  );
}

function DauerFeld({ name, wert, aendern, optional, negativErlaubt }: { name: string; wert: string | undefined; aendern: (v: string | undefined) => void; optional?: boolean; negativErlaubt?: boolean }) {
  const z = wert ? dauerZerlegen(wert) : undefined;
  const zahl = z ? (z.negativ ? -z.zahl : z.zahl) : wert ? NaN : optional ? "" : 0;
  const einheit = z?.einheit ?? "D";
  return (
    <fieldset className="flex items-end gap-2">
      <legend className="mb-1 text-klein font-bold">{name}</legend>
      {wert && !z ? (
        <Feld name={`${name} (ISO)`} versteckt><input className="feld w-32" defaultValue={wert} onBlur={(e) => aendern(e.target.value || undefined)} /></Feld>
      ) : (
        <>
          <Feld name={`${name}: Anzahl`} versteckt>
            <input className="feld w-24" type="number" min={negativErlaubt ? undefined : 0} value={Number.isNaN(zahl) ? "" : zahl}
              onChange={(e) => { if (e.target.value === "" && optional) return aendern(undefined); const n = Number(e.target.value); aendern(dauerBauen(Math.abs(n), einheit, negativErlaubt && n < 0)); }} />
          </Feld>
          <Feld name={`${name}: Einheit`} versteckt>
            <select className="feld" value={einheit} onChange={(e) => aendern(dauerBauen(z?.zahl ?? 0, e.target.value, z?.negativ))}>
              {EINHEITEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </Feld>
        </>
      )}
    </fieldset>
  );
}
