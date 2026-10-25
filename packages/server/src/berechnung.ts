import { createHash } from "node:crypto";
import { StandardKalender, plusMonate, type Datum, type Kalender } from "@amtlos/fristen";
import { ENGINE_VERSION, auswerten, sollInstanzen, type Ereignis, type Instanz, type Pflicht, type Soll } from "@amtlos/rules-engine";
import type { Datenbank, Tx } from "./datenbank.js";
import { kanonisch } from "./katalog-import.js";
import { ladeAktivenKatalog } from "./katalog.js";
import { umsatzLaufendesJahr } from "./finanzen.js";

export interface BerechnungsErgebnis {
  status: "berechnet" | "kein_profil" | "kein_katalog";
  laufId?: string;
  instanzen?: { neu: number; aktualisiert: number; entfallen: number; nicht_zutreffend: number };
  /** Benachrichtigungen „Was ändert sich für dich?“ (nur beim Release-Rollout) */
  benachrichtigt?: number;
}

/** Profil-Daten werden ohne Präfix gespeichert ({ "rechtsform": … }); die Engine erwartet Fakten-Pfade. */
export function profilZuFakten(daten: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(daten).map(([k, v]) => [`profil.${k}`, v]));
}

export function heute(zeitzone = "Europe/Berlin"): Datum {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: zeitzone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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

  const ereignisse = ereignisseMitBestand(await ladeEreignisse(tx, unternehmenId), profil.daten, stichtag);

  const bestand = await tx.abfrage<Instanz>(
    `select id, pflicht_id, periode, status, faellig_am, erledigt_am::date::text as erledigt_am, erledigt_mit_version_id, pflicht_version_id
       from app.pflicht_instanz where unternehmen_id = $1`,
    [unternehmenId],
  );
  const erledigt: Record<string, Datum> = {};
  for (const i of bestand) if (i.status === "erledigt" && i.erledigt_am && !(i.pflicht_id in erledigt)) erledigt[i.pflicht_id] = i.erledigt_am;

  const fakten = profilZuFakten(profil.daten);
  // Kleinunternehmer-Wächter (C.23): Umsatz aus den Rechnungen in Amtlos, nur wenn welche gestellt wurden. Maßgeblich sind
  // die vereinnahmten Entgelte (§ 19 Abs. 2 UStG, Steuerberater 22.10.2026); der Server speichert keine Zahlungseingänge, also
  // gilt hier für alle Rechnungen die Ersatzregel „Rechnung ohne Zahlungsvermerk zählt mit dem Rechnungsdatum“ (fakten.json).
  // `finanzen.umsatz.laufendes_jahr` bleibt für ältere Katalog-Releases.
  // Steuerberater, Runde 2: „Grenze überschritten“ und „ab 1. Januar“ zählen nur tatsächliche Zahlungseingänge
  // (`finanzen.umsatz.bezahlt_*`). Die liefert der Server bewusst NICHT – ihre Zweige sind im Katalog über „vorhanden“
  // abgesichert und gelten hier nicht; die Einträge entscheiden dann nur nach den Profilangaben (Prognose, Vorjahr) und
  // bleiben ohne sie offen. Liegen die Rechnungen nach Rechnungsdatum über einer Grenze, zeigt der Server stattdessen den
  // Hinweis `steuern.kleinunternehmer_grenze_offene_rechnungen`. Eine Steuerart „befreit“ gibt es in app.rechnung nicht.
  const jahr = Number(stichtag.slice(0, 4));
  const umsatz = await umsatzLaufendesJahr(tx, unternehmenId, jahr);
  if (umsatz !== null) {
    fakten["finanzen.umsatz.laufendes_jahr"] = umsatz;
    fakten["finanzen.umsatz.vereinnahmt_laufendes_jahr"] = umsatz;
    fakten["finanzen.umsatz.vereinnahmt_vorjahr"] = (await umsatzLaufendesJahr(tx, unternehmenId, jahr - 1)) ?? 0;
  }
  const fenster = { von: plusMonate(stichtag, -3), bis: plusMonate(stichtag, 12) };
  const ergebnisse = auswerten({ katalog: aktiv.katalog, fakten, ereignisse, stichtag, kalender, erledigt, fenster });

  const lauf = await tx.eine<{ id: string }>(
    `insert into app.berechnungslauf (unternehmen_id, release_id, profil_version_id, stichtag, ausgeloest_durch, fakten, fakten_hash, engine_version, dauer_ms)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [unternehmenId, aktiv.releaseId, profil.id, stichtag, ausgeloestDurch, fakten, createHash("sha256").update(kanonisch(fakten)).digest(), ENGINE_VERSION, null],
  );

  const pflichtNachId = new Map(aktiv.katalog.pflichten.map((p) => [p.id, p]));
  const soll = sollInstanzen(ergebnisse, pflichtNachId, aktiv.versionIds, bestand, ereignisse);
  // Rechtsänderung (Release-Rollout): betroffene Mitglieder benachrichtigen – „Was ändert sich für dich?“ (Spezifikation 5)
  const benachrichtigt = ausgeloestDurch.startsWith("release:") ? await rechtsaenderungenMelden(tx, unternehmenId, soll, bestand, pflichtNachId) : 0;
  const zaehler = await abgleichen(tx, unternehmenId, lauf!.id, soll, bestand, fenster.von);

  await tx.abfrage("update app.berechnungslauf set dauer_ms = $2 where id = $1", [lauf!.id, Date.now() - start]);
  return { status: "berechnet", laufId: lauf!.id, instanzen: zaehler, benachrichtigt };
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

/** Ereignisse eines Unternehmens für die Engine (Storno-Einträge entfernt, stornierte markiert). */
export async function ladeEreignisse(tx: Tx, unternehmenId: string): Promise<Ereignis[]> {
  const zeilen = await tx.abfrage<{ id: string; typ: string; eingetreten_am: Datum; storniert_ereignis_id: string | null }>(
    "select id, typ, eingetreten_am, storniert_ereignis_id from app.ereignis where unternehmen_id = $1 order by eingetreten_am, erfasst_am",
    [unternehmenId],
  );
  const storniert = new Set(zeilen.map((e) => e.storniert_ereignis_id).filter(Boolean));
  return zeilen
    .filter((e) => !e.storniert_ereignis_id) // Storno-Einträge selbst sind keine fachlichen Ereignisse
    .map((e) => ({ typ: e.typ, datum: e.eingetreten_am, ...(storniert.has(e.id) ? { storniert: true } : {}) }));
}

/**
 * Beschäftigte laut Profil ohne erfasste Personen (H6): `beschaeftigte.gesamt` ≥ 1, aber noch keine Einstellung in
 * app.ereignis (die entsteht erst beim Anlegen in „Personal“). Dann gelten die Einstellungs-Pflichten trotzdem – wie in
 * der iPhone-App (apps/mobile/src/pflichten/check.ts, ereignisseAusStand): „erste_einstellung“ und „einstellung“ am
 * Gründungstag, sonst am Stichtag. Sobald echte Einstellungen erfasst sind, gelten nur noch diese.
 */
export function ereignisseMitBestand(ereignisse: Ereignis[], profil: Record<string, unknown>, stichtag: Datum): Ereignis[] {
  const anzahl = profil["beschaeftigte.gesamt"];
  if (typeof anzahl !== "number" || anzahl < 1) return ereignisse;
  if (ereignisse.some((e) => (e.typ === "einstellung" || e.typ === "erste_einstellung") && !e.storniert)) return ereignisse;
  const g = profil["gruendungsdatum"];
  const datum = typeof g === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g) ? g : stichtag;
  return [...ereignisse, { typ: "erste_einstellung", datum }, { typ: "einstellung", datum }].sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Höchstens so viele Einzelmeldungen je Rollout; darüber eine Sammelmeldung (keine Benachrichtigungsflut). */
const MAX_MELDUNGEN = 10;

/**
 * Vergleicht Soll und Bestand: neu geltende Pflichten (für die es noch keine Instanz gab) und Pflichten, die mit einer
 * neuen Katalogversion weiter gelten. Je Mitglied eine Benachrichtigung in seiner Sprache.
 */
async function rechtsaenderungenMelden(tx: Tx, unternehmenId: string, soll: Soll[], bestand: Instanz[], pflichten: Map<string, Pflicht>): Promise<number> {
  // „Neu“ = galt bisher nicht (keine oder nur nicht zutreffende/entfallene Instanzen)
  const bekannt = new Set(bestand.filter((b) => b.status === "offen" || b.status === "erledigt").map((b) => b.pflicht_id));
  // Geändert = offene Instanz mit älterer Version (Erledigtes behält seine Version, E-036; erneut zu erledigen → neue Instanz)
  const versionAlt = new Map(bestand.filter((b) => b.status === "offen").map((b) => [`${b.pflicht_id}|${b.periode}`, b.pflicht_version_id]));
  const vorhanden = new Set(bestand.map((b) => `${b.pflicht_id}|${b.periode}`));
  const meldungen = new Map<string, { art: "neue_pflicht" | "rechtsaenderung"; periode: string }>();
  for (const s of soll) {
    if (s.ergebnis !== "gilt" || meldungen.has(s.pflicht_id)) continue;
    const alt = versionAlt.get(`${s.pflicht_id}|${s.periode}`);
    if (!bekannt.has(s.pflicht_id)) meldungen.set(s.pflicht_id, { art: "neue_pflicht", periode: s.periode });
    else if (alt && alt !== s.pflicht_version_id) meldungen.set(s.pflicht_id, { art: "rechtsaenderung", periode: s.periode });
    else if (pflichten.get(s.pflicht_id)?.erneut_erledigen && s.periode === `aenderung-${pflichten.get(s.pflicht_id)!.version}` && !vorhanden.has(`${s.pflicht_id}|${s.periode}`))
      meldungen.set(s.pflicht_id, { art: "rechtsaenderung", periode: s.periode });
  }
  if (!meldungen.size || !bestand.length) return 0; // erste Berechnung eines Unternehmens: keine Meldungen
  const mitglieder = await tx.abfrage<{ konto_id: string; sprache: "de" | "en" }>(
    "select m.konto_id, k.sprache from app.mitgliedschaft m join app.konto k on k.id = m.konto_id where m.unternehmen_id = $1",
    [unternehmenId],
  );
  const TEXTE = {
    de: { neue_pflicht: "Neu für dich", rechtsaenderung: "Geändert", sammel: (n: number) => `${n} Pflichten sind neu oder geändert`, sammelText: "Sieh dir die Änderungen in deiner Pflichtenliste an." },
    en: { neue_pflicht: "New for you", rechtsaenderung: "Changed", sammel: (n: number) => `${n} obligations are new or changed`, sammelText: "Review the changes in your list of obligations." },
  } as const;
  const tt = (x: { de: string; en?: string }, s: "de" | "en") => (s === "en" && x.en ? x.en : x.de);
  const eintraege = [...meldungen.entries()];
  let n = 0;
  for (const m of mitglieder) {
    const T = TEXTE[m.sprache];
    const zeilen = eintraege.length > MAX_MELDUNGEN
      ? [{ art: "rechtsaenderung", titel: T.sammel(eintraege.length), text: T.sammelText, link: "/pflichten" }]
      : eintraege.map(([id, x]) => {
          const p = pflichten.get(id)!;
          return { art: x.art, titel: `${T[x.art]}: ${tt(p.titel, m.sprache)}`, text: tt(p.kurz, m.sprache), link: `/pflichten/${id}/${x.periode}` };
        });
    for (const z of zeilen) {
      await tx.abfrage("insert into app.benachrichtigung (unternehmen_id, konto_id, art, titel, text, link) values ($1, $2, $3, $4, $5, $6)", [unternehmenId, m.konto_id, z.art, z.titel, z.text, z.link]);
      n++;
    }
  }
  return n;
}
