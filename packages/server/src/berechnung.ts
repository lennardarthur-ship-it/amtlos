import { createHash } from "node:crypto";
import { StandardKalender, plusMonate, type Datum, type Kalender } from "@amtlos/fristen";
import { ENGINE_VERSION, auswerten, entscheidendeSaetze, type Ereignis, type Pflicht, type PflichtErgebnis } from "@amtlos/rules-engine";
import type { Datenbank, Tx } from "./datenbank.js";
import { kanonisch } from "./katalog-import.js";
import { ladeAktivenKatalog } from "./katalog.js";
import { umsatzLaufendesJahr } from "./finanzen.js";

export interface BerechnungsErgebnis {
  status: "berechnet" | "kein_profil" | "kein_katalog";
  laufId?: string;
  instanzen?: { neu: number; aktualisiert: number; entfallen: number; nicht_zutreffend: number };
}

/** Profil-Daten werden ohne Präfix gespeichert ({ "rechtsform": … }); die Engine erwartet Fakten-Pfade. */
export function profilZuFakten(daten: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(daten).map(([k, v]) => [`profil.${k}`, v]));
}

export function heute(zeitzone = "Europe/Berlin"): Datum {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: zeitzone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

interface Instanz {
  id: string;
  pflicht_id: string;
  periode: string;
  status: "offen" | "erledigt" | "nicht_zutreffend" | "entfallen";
  faellig_am: Datum | null;
  erledigt_am: string | null;
  erledigt_mit_version_id: string | null;
}

interface Soll {
  pflicht_id: string;
  pflicht_version_id: string;
  periode: string;
  ergebnis: PflichtErgebnis["ergebnis"];
  status: "offen" | "nicht_zutreffend";
  faellig_am: Datum | null;
  faellig_roh: Datum | null;
  begruendung: unknown;
  fehlende_fakten: string[];
  nicht_zutreffend_grund: string | null;
}

/**
 * Neuberechnung des Pflichtenplans für ein Unternehmen (docs/01, Kernablauf).
 * Muss im Kontext genau dieses Unternehmens laufen (Rolle amtlos_worker oder amtlos_app).
 * Idempotent: Mehrfaches Ausführen mit gleicher Eingabe ändert nichts außer einem neuen Berechnungslauf.
 */
export async function neuberechnen(
  db: Datenbank,
  unternehmenId: string,
  ausgeloestDurch: string,
  optionen: { stichtag?: Datum; kalender?: Kalender } = {},
): Promise<BerechnungsErgebnis> {
  return db.imKontext({ unternehmenId }, (tx) => neuberechnenInTx(tx, unternehmenId, ausgeloestDurch, optionen));
}

export async function neuberechnenInTx(
  tx: Tx,
  unternehmenId: string,
  ausgeloestDurch: string,
  optionen: { stichtag?: Datum; kalender?: Kalender } = {},
): Promise<BerechnungsErgebnis> {
  const start = Date.now();
  const stichtag = optionen.stichtag ?? heute();
  const kalender = optionen.kalender ?? new StandardKalender();

  // Pro Unternehmen nur eine Berechnung gleichzeitig (verhindert Wettläufe beim Upsert)
  await tx.abfrage("select pg_advisory_xact_lock(hashtext('neuberechnung:' || $1))", [unternehmenId]);

  const aktiv = await ladeAktivenKatalog(tx);
  if (!aktiv) return { status: "kein_katalog" };
  const profil = await tx.eine<{ id: string; daten: Record<string, unknown> }>(
    "select id, daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1",
    [unternehmenId],
  );
  if (!profil) return { status: "kein_profil" };

  const ereignisZeilen = await tx.abfrage<{ id: string; typ: string; eingetreten_am: Datum; storniert_ereignis_id: string | null }>(
    "select id, typ, eingetreten_am, storniert_ereignis_id from app.ereignis where unternehmen_id = $1 order by eingetreten_am, erfasst_am",
    [unternehmenId],
  );
  const storniert = new Set(ereignisZeilen.map((e) => e.storniert_ereignis_id).filter(Boolean));
  const ereignisse: Ereignis[] = ereignisZeilen
    .filter((e) => !e.storniert_ereignis_id) // Storno-Einträge selbst sind keine fachlichen Ereignisse
    .map((e) => ({ typ: e.typ, datum: e.eingetreten_am, ...(storniert.has(e.id) ? { storniert: true } : {}) }));

  const bestand = await tx.abfrage<Instanz>(
    `select id, pflicht_id, periode, status, faellig_am, erledigt_am::date::text as erledigt_am, erledigt_mit_version_id
       from app.pflicht_instanz where unternehmen_id = $1`,
    [unternehmenId],
  );
  const erledigt: Record<string, Datum> = {};
  for (const i of bestand) if (i.status === "erledigt" && i.erledigt_am && !(i.pflicht_id in erledigt)) erledigt[i.pflicht_id] = i.erledigt_am;

  const fakten = profilZuFakten(profil.daten);
  // Kleinunternehmer-Wächter (C.23): Umsatz aus den Rechnungen in Amtlos, nur wenn welche gestellt wurden
  const umsatz = await umsatzLaufendesJahr(tx, unternehmenId, Number(stichtag.slice(0, 4)));
  if (umsatz !== null) fakten["finanzen.umsatz.laufendes_jahr"] = umsatz;
  const fenster = { von: plusMonate(stichtag, -3), bis: plusMonate(stichtag, 12) };
  const ergebnisse = auswerten({ katalog: aktiv.katalog, fakten, ereignisse, stichtag, kalender, erledigt, fenster });

  const lauf = await tx.eine<{ id: string }>(
    `insert into app.berechnungslauf (unternehmen_id, release_id, profil_version_id, stichtag, ausgeloest_durch, fakten, fakten_hash, engine_version, dauer_ms)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [unternehmenId, aktiv.releaseId, profil.id, stichtag, ausgeloestDurch, fakten, createHash("sha256").update(kanonisch(fakten)).digest(), ENGINE_VERSION, null],
  );

  const pflichtNachId = new Map(aktiv.katalog.pflichten.map((p) => [p.id, p]));
  const soll = sollInstanzen(ergebnisse, pflichtNachId, aktiv.versionIds, bestand, ereignisse);
  const zaehler = await abgleichen(tx, unternehmenId, lauf!.id, soll, bestand, fenster.von);

  await tx.abfrage("update app.berechnungslauf set dauer_ms = $2 where id = $1", [lauf!.id, Date.now() - start]);
  return { status: "berechnet", laufId: lauf!.id, instanzen: zaehler };
}

function sollInstanzen(
  ergebnisse: PflichtErgebnis[],
  pflichten: Map<string, Pflicht>,
  versionIds: Map<string, string>,
  bestand: Instanz[],
  ereignisse: Ereignis[],
): Soll[] {
  const soll: Soll[] = [];
  for (const e of ergebnisse) {
    if (e.radar) continue; // Radar wird getrennt angezeigt, nicht als Aufgabe
    const p = pflichten.get(e.pflicht_id)!;
    const versionId = versionIds.get(e.pflicht_id)!;
    const basis = {
      pflicht_id: e.pflicht_id,
      pflicht_version_id: versionId,
      ergebnis: e.ergebnis,
      begruendung: { knoten: e.begruendung, hinweise: e.hinweise, regelwerte: e.regelwerte_genutzt },
      fehlende_fakten: e.fehlende_fakten,
    };

    if (e.ergebnis === "gilt_nicht") {
      soll.push({ ...basis, periode: "einmalig", status: "nicht_zutreffend", faellig_am: null, faellig_roh: null,
        nicht_zutreffend_grund: entscheidendeSaetze(e.begruendung).join(" ") || null });
      continue;
    }
    if (e.ergebnis === "unbekannt" && p.frist.typ === "wiederkehrend") {
      // Ob die Pflicht gilt, ist offen: eine Frage-Karte statt einer „Angabe fehlt“-Karte je Termin
      soll.push({ ...basis, periode: "einmalig", status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
    } else if (e.termine.length) {
      for (const t of e.termine)
        soll.push({ ...basis, periode: t.periode, status: "offen", faellig_am: t.faellig_am, faellig_roh: t.verlaengert ?? t.roh, nicht_zutreffend_grund: null });
    } else if (p.frist.typ !== "wiederkehrend" || e.hinweise.includes("rhythmus_unbekannt")) {
      // einmalig/dauerhaft/bei_aenderung ohne Termin, oder Rhythmus noch unbekannt → eine Instanz ohne Datum
      soll.push({ ...basis, periode: "einmalig", status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
    }

    // E-036: neue Version mit erneut_erledigen öffnet erledigte Pflicht erneut
    // bei_aenderung: auslösendes Ereignis nach der letzten Erledigung öffnet die Pflicht erneut
    const letzteErledigung = bestand
      .filter((i) => i.pflicht_id === e.pflicht_id && i.status === "erledigt")
      .sort((a, b) => (a.erledigt_am ?? "").localeCompare(b.erledigt_am ?? ""))
      .at(-1);
    if (letzteErledigung) {
      if (p.erneut_erledigen && letzteErledigung.erledigt_mit_version_id !== versionId) {
        soll.push({ ...basis, periode: `aenderung-${p.version}`, status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
      }
      if (p.wiederholung.art === "bei_aenderung") {
        const typen = new Set((p.wiederholung.neu_ausloesen_bei ?? []).flatMap((x) => ("ereignis" in x ? [x.ereignis] : [])));
        const ausloeser = ereignisse
          .filter((x) => typen.has(x.typ) && !x.storniert && x.datum > (letzteErledigung.erledigt_am ?? ""))
          .map((x) => x.datum)
          .sort()
          .at(-1);
        if (ausloeser) soll.push({ ...basis, periode: `aenderung-${ausloeser.replaceAll("-", "")}`, status: "offen", faellig_am: null, faellig_roh: null, nicht_zutreffend_grund: null });
      }
    }
  }
  return soll;
}

/**
 * Abgleich Soll ↔ Bestand in zwei Anweisungen (E-085): ein Upsert für alle Soll-Instanzen, ein Update für Entfallenes.
 * Unveränderte Zeilen werden nicht angefasst – kein neues Tupel, kein Audit-Eintrag. Der tägliche Lauf schreibt
 * daher fast nichts und blockiert die Audit-Kette nicht.
 */
async function abgleichen(tx: Tx, unternehmenId: string, laufId: string, soll: Soll[], bestand: Instanz[], fensterVon: Datum) {
  const z = { neu: 0, aktualisiert: 0, entfallen: 0, nicht_zutreffend: 0 };
  const schluessel = (pflicht: string, periode: string) => `${pflicht}|${periode}`;
  const vorhanden = new Map(bestand.map((i) => [schluessel(i.pflicht_id, i.periode), i]));
  const sollSchluessel = new Set(soll.map((s) => schluessel(s.pflicht_id, s.periode)));
  // Erledigtes bleibt unangetastet (E-036); doppelte Schlüssel (sollte nicht vorkommen) → letzter gewinnt
  const zeilen = [...new Map(soll.filter((s) => vorhanden.get(schluessel(s.pflicht_id, s.periode))?.status !== "erledigt").map((s) => [schluessel(s.pflicht_id, s.periode), s])).values()];
  z.nicht_zutreffend = zeilen.filter((s) => s.status === "nicht_zutreffend").length;

  if (zeilen.length) {
    const r = await tx.abfrage<{ neu: boolean }>(
      `insert into app.pflicht_instanz
         (unternehmen_id, pflicht_id, pflicht_version_id, periode, ergebnis, status, faellig_am, faellig_roh, begruendung, fehlende_fakten, letzter_lauf_id, nicht_zutreffend_grund)
       select $1, x.pflicht_id, x.pflicht_version_id, x.periode, x.ergebnis::app.ergebnis, x.status::app.instanz_status, x.faellig_am, x.faellig_roh,
              x.begruendung, coalesce(x.fehlende_fakten, '{}'), $2, x.nicht_zutreffend_grund
         from jsonb_to_recordset($3::jsonb) as x(pflicht_id text, pflicht_version_id uuid, periode text, ergebnis text, status text,
              faellig_am date, faellig_roh date, begruendung jsonb, fehlende_fakten text[], nicht_zutreffend_grund text)
       on conflict (unternehmen_id, pflicht_id, periode) do update set
         pflicht_version_id = excluded.pflicht_version_id, ergebnis = excluded.ergebnis, status = excluded.status,
         faellig_am = excluded.faellig_am, faellig_roh = excluded.faellig_roh, begruendung = excluded.begruendung,
         fehlende_fakten = excluded.fehlende_fakten, letzter_lauf_id = excluded.letzter_lauf_id,
         nicht_zutreffend_grund = excluded.nicht_zutreffend_grund, aktualisiert_am = now()
       where app.pflicht_instanz.status <> 'erledigt'
         and (app.pflicht_instanz.pflicht_version_id, app.pflicht_instanz.ergebnis, app.pflicht_instanz.status, app.pflicht_instanz.faellig_am,
              app.pflicht_instanz.faellig_roh, app.pflicht_instanz.begruendung, app.pflicht_instanz.fehlende_fakten, app.pflicht_instanz.nicht_zutreffend_grund)
             is distinct from
             (excluded.pflicht_version_id, excluded.ergebnis, excluded.status, excluded.faellig_am,
              excluded.faellig_roh, excluded.begruendung, excluded.fehlende_fakten, excluded.nicht_zutreffend_grund)
       returning (xmax = 0) as neu`,
      [unternehmenId, laufId, JSON.stringify(zeilen.map((s) => ({ ...s, begruendung: s.begruendung })))],
    );
    z.neu = r.filter((x) => x.neu).length;
    z.aktualisiert = r.length - z.neu;
  }

  // Nicht mehr gewünschte offene Instanzen: entfallen – außer überfällige vor dem Fenster (bleiben offen)
  const weg = bestand
    .filter((i) => !sollSchluessel.has(schluessel(i.pflicht_id, i.periode)))
    .filter((i) => i.status !== "erledigt" && i.status !== "entfallen")
    .filter((i) => !(i.status === "offen" && i.faellig_am && i.faellig_am < fensterVon))
    .map((i) => i.id);
  if (weg.length) {
    await tx.abfrage("update app.pflicht_instanz set status = 'entfallen', letzter_lauf_id = $2, aktualisiert_am = now() where id = any($1::uuid[])", [weg, laufId]);
    z.entfallen = weg.length;
  }
  return z;
}
