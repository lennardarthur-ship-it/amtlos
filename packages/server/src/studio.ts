import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { StandardKalender } from "@amtlos/fristen";
import { auswerten, type Ergebnis, type Katalog, type Pflicht } from "@amtlos/rules-engine";
import { pruefePflichtObjekt, pruefeRegelwertObjekt } from "@amtlos/rules-schema";
import type { Datenbank, Tx } from "./datenbank.js";
import { katalogCacheLeeren, ladeAktivenKatalog } from "./katalog.js";
import { quellenVerknuepfen } from "./katalog-import.js";

export type Qualifikation = "steuerberater" | "rechtsanwalt" | "fachkraft_arbeitssicherheit" | "datenschutzbeauftragter" | "sonstige";
export type PlattformRolle = "plattform_admin" | "redaktion" | "experte" | "support";

/**
 * E-039: Welche Qualifikation eine Fachfreigabe je Kategorie braucht.
 * [FACHLICH ZU PRÜFEN] (PRUEFLISTE G-02) – Startbelegung, durch Rechtsanwalt zu bestätigen.
 */
export const PASSENDE_QUALIFIKATION: Record<string, Qualifikation[]> = {
  steuern: ["steuerberater"],
  gruendung: ["steuerberater", "rechtsanwalt"],
  gesellschaft: ["rechtsanwalt", "steuerberater"],
  personal: ["rechtsanwalt"],
  arbeitsschutz: ["fachkraft_arbeitssicherheit", "rechtsanwalt"],
  datenschutz: ["datenschutzbeauftragter", "rechtsanwalt"],
  it_sicherheit: ["rechtsanwalt", "datenschutzbeauftragter"],
  ki: ["rechtsanwalt"],
  online: ["rechtsanwalt"],
  produkte: ["rechtsanwalt"],
  branche: ["rechtsanwalt"],
};

export interface StudioKonto {
  id: string;
  anzeigename: string;
  rollen: PlattformRolle[];
  qualifikationen: Qualifikation[];
}

export class StudioFehler extends Error {}

export async function studioKonto(db: Datenbank, sub: string): Promise<StudioKonto | undefined> {
  return db.imKontext({}, async (tx) => {
    const k = await tx.eine<{ id: string; anzeigename: string }>("select id, anzeigename from app.konto where idp_subject = $1 and geloescht_am is null", [sub]);
    if (!k) return undefined;
    const rollen = (await tx.abfrage<{ rolle: PlattformRolle }>("select rolle from app.konto_plattform_rolle where konto_id = $1", [k.id])).map((r) => r.rolle);
    if (!rollen.some((r) => r === "plattform_admin" || r === "redaktion" || r === "experte")) return undefined;
    const qualifikationen = (
      await tx.abfrage<{ art: Qualifikation }>("select art from katalog.experte_qualifikation where konto_id = $1 and (gueltig_bis is null or gueltig_bis >= current_date)", [k.id])
    ).map((q) => q.art);
    return { ...k, rollen, qualifikationen };
  });
}

export interface PflichtUebersicht {
  pflicht_id: string;
  kategorie: string;
  version: number;
  version_id: string;
  pruef_status: string;
  status_recht: string;
  titel: string;
  katalog_nr: string | null;
  im_release: boolean;
  freigaben: number;
  offene_punkte: number;
}

export async function pflichtUebersicht(db: Datenbank): Promise<PflichtUebersicht[]> {
  return db.imKontext({}, (tx) =>
    tx.abfrage<PflichtUebersicht>(`
      select distinct on (pv.pflicht_id)
             pv.pflicht_id, p.kategorie, pv.version, pv.id as version_id, pv.pruef_status, pv.status_recht,
             pv.daten->'titel'->>'de' as titel, pv.daten->>'katalog_nr' as katalog_nr,
             exists (select 1 from katalog.aktives_release r join katalog.release_inhalt ri on ri.release_id = r.id where ri.objekt_id = pv.id) as im_release,
             (select count(*)::int from katalog.freigabe f where f.objekt_id = pv.id and f.entscheidung = 'freigegeben') as freigaben,
             coalesce(jsonb_array_length(pv.daten->'fachlich_zu_pruefen'), 0) as offene_punkte
        from katalog.pflicht_version pv join katalog.pflicht p on p.id = pv.pflicht_id
       order by pv.pflicht_id, pv.version desc`),
  );
}

export async function pflichtVersionen(db: Datenbank, pflichtId: string) {
  return db.imKontext({}, async (tx) => {
    const versionen = await tx.abfrage<{ id: string; version: number; pruef_status: string; daten: Pflicht; erstellt_von: string; autor: string; erstellt_am: Date }>(
      `select pv.id, pv.version, pv.pruef_status, pv.daten, pv.erstellt_von, k.anzeigename as autor, pv.erstellt_am
         from katalog.pflicht_version pv join app.konto k on k.id = pv.erstellt_von
        where pv.pflicht_id = $1 order by pv.version desc`,
      [pflichtId],
    );
    const freigaben = await tx.abfrage<{ objekt_id: string; pruefer: string; qualifikation: string | null; entscheidung: string; kommentar: string | null; zeitpunkt: Date }>(
      `select f.objekt_id, k.anzeigename as pruefer, f.qualifikation, f.entscheidung, f.kommentar, f.zeitpunkt
         from katalog.freigabe f join app.konto k on k.id = f.pruefer_id
        where f.objekt_art = 'pflicht_version' and f.objekt_id = any($1) order by f.zeitpunkt`,
      [versionen.map((v) => v.id)],
    );
    return versionen.map((v) => ({ ...v, freigaben: freigaben.filter((f) => f.objekt_id === v.id) }));
  });
}

async function bekannteIds(tx: Tx) {
  const regelwertIds = new Set((await tx.abfrage<{ id: string }>("select id from katalog.regelwert")).map((r) => r.id));
  const pflichtIds = new Set((await tx.abfrage<{ id: string }>("select id from katalog.pflicht")).map((r) => r.id));
  return { regelwertIds, pflichtIds };
}

/** Neue Version anlegen (nie überschreiben). Versionsnummer vergibt das System; Status „in Prüfung“. */
export async function neuePflichtversion(db: Datenbank, autor: StudioKonto, daten: Record<string, unknown>): Promise<{ id: string; version: number }> {
  if (!autor.rollen.some((r) => r === "redaktion" || r === "plattform_admin")) throw new StudioFehler("Nur die Redaktion legt Versionen an");
  return db.imKontext({ kontoId: autor.id }, async (tx) => {
    const id = String(daten.id ?? "");
    const max = await tx.eine<{ v: number | null }>("select max(version) as v from katalog.pflicht_version where pflicht_id = $1", [id]);
    const version = (max?.v ?? 0) + 1;
    const p = { ...daten, version, pruefung: undefined } as Record<string, unknown>;
    delete p.pruefung; // wird aus Freigaben abgeleitet (E-039)
    const ids = await bekannteIds(tx);
    ids.pflichtIds.add(id);
    const fehler = pruefePflichtObjekt(p, ids);
    if (fehler.length) throw new StudioFehler(fehler.join("\n"));
    await tx.abfrage("insert into katalog.pflicht (id, kategorie) values ($1, $2) on conflict (id) do nothing", [id, p.kategorie]);
    const r = await tx.eine<{ id: string }>(
      `insert into katalog.pflicht_version (pflicht_id, version, daten, status_recht, gueltig_ab, gueltig_bis, pruef_status, erstellt_von)
       values ($1, $2, $3, $4, $5, $6, 'in_pruefung', $7) returning id`,
      [id, version, p, p.status_recht, p.gueltig_ab ?? null, p.gueltig_bis ?? null, autor.id],
    );
    // Ältere, noch nicht entschiedene Versionen sind überholt – Prüfer sollen nur den neuesten Stand prüfen
    await tx.abfrage(
      "update katalog.pflicht_version set pruef_status = 'zurueckgezogen' where pflicht_id = $1 and version < $2 and pruef_status in ('entwurf', 'in_pruefung')",
      [id, version],
    );
    return { id: r!.id, version };
  });
}

/**
 * Prüfentscheidung (Vier-Augen, E-039). Die Datenbank erzwingt: Autor ≠ Prüfer, Qualifikation hinterlegt,
 * „freigegeben“ erst mit zwei Freigaben und einer qualifizierten. Hier zusätzlich: Qualifikation passt zur Kategorie.
 */
export async function pruefentscheidung(
  db: Datenbank,
  pruefer: StudioKonto,
  versionId: string,
  e: { entscheidung: "freigegeben" | "abgelehnt" | "aenderung_noetig"; qualifikation: Qualifikation | null; kommentar?: string },
  objektArt: "pflicht_version" | "regelwert_version" = "pflicht_version",
): Promise<{ status: string }> {
  if (!pruefer.rollen.some((r) => r === "experte" || r === "plattform_admin")) throw new StudioFehler("Nur Expertinnen und Experten prüfen");
  return db.imKontext({ kontoId: pruefer.id }, async (tx) => {
    // Regelwerte: Kategorie aus dem ID-Präfix (steuern.…, personal.…)
    const v = await tx.eine<{ kategorie: string; pruef_status: string }>(
      objektArt === "pflicht_version"
        ? "select p.kategorie::text, pv.pruef_status from katalog.pflicht_version pv join katalog.pflicht p on p.id = pv.pflicht_id where pv.id = $1"
        : "select split_part(regelwert_id, '.', 1) as kategorie, pruef_status from katalog.regelwert_version where id = $1",
      [versionId],
    );
    if (!v) throw new StudioFehler("Version nicht gefunden");
    if (v.pruef_status !== "in_pruefung" && v.pruef_status !== "entwurf") throw new StudioFehler(`Version ist nicht in Prüfung (Status: ${v.pruef_status})`);
    if (e.qualifikation && !(PASSENDE_QUALIFIKATION[v.kategorie] ?? []).includes(e.qualifikation))
      throw new StudioFehler(`Qualifikation „${e.qualifikation}“ passt nicht zur Kategorie „${v.kategorie}“`);
    if (e.entscheidung !== "freigegeben" && !e.kommentar?.trim()) throw new StudioFehler("Bitte begründen, warum nicht freigegeben wird");
    await tx.abfrage(
      "insert into katalog.freigabe (objekt_art, objekt_id, pruefer_id, qualifikation, entscheidung, kommentar) values ($6, $1, $2, $3, $4, $5)",
      [versionId, pruefer.id, e.qualifikation, e.entscheidung, e.kommentar ?? null, objektArt],
    );
    let status = "in_pruefung";
    if (e.entscheidung === "abgelehnt") status = "abgelehnt";
    else if ((await tx.eine<{ ok: boolean }>("select katalog.ist_freigegeben($2, $1) as ok", [versionId, objektArt]))?.ok) status = "freigegeben";
    if (status !== "in_pruefung") await tx.abfrage(`update katalog.${objektArt} set pruef_status = $2 where id = $1`, [versionId, status]);
    return { status };
  });
}

/**
 * Release aus der jeweils neuesten verwendbaren Version: in prod nur freigegebene (Trigger erzwingt das),
 * sonst neueste nicht abgelehnte. Danach Rollout: Neuberechnung aller Unternehmen.
 */
export async function releaseVeroeffentlichen(
  db: Datenbank,
  wer: StudioKonto,
  notiz: string,
  rollout?: (tx: Tx) => Promise<void>,
): Promise<{ nummer: number; inhalte: number }> {
  if (!wer.rollen.some((r) => r === "redaktion" || r === "plattform_admin")) throw new StudioFehler("Nur die Redaktion veröffentlicht Releases");
  return db.imKontext({ kontoId: wer.id }, async (tx) => {
    // Umgebung aus der Datenbank (0003), nicht aus der Dienst-Konfiguration
    const umgebung = (await tx.eine<{ u: string }>("select katalog.umgebung() as u"))!.u;
    const nurFreigegeben = umgebung === "prod" || umgebung === "staging";
    const bedingung = nurFreigegeben ? "pruef_status = 'freigegeben'" : "pruef_status not in ('abgelehnt','zurueckgezogen')";
    const pflichten = await tx.abfrage<{ id: string }>(`select distinct on (pflicht_id) id from katalog.pflicht_version where ${bedingung} order by pflicht_id, version desc`);
    const regelwerte = await tx.abfrage<{ id: string }>(
      `select id from katalog.regelwert_version rv where ${bedingung}
         and version = (select max(version) from katalog.regelwert_version x where x.regelwert_id = rv.regelwert_id and x.${bedingung} and x.gueltig_ab = rv.gueltig_ab)`,
    );
    if (!pflichten.length) throw new StudioFehler("Keine verwendbaren Pflichtversionen");
    // Konsistenz: jede verwendete Regelwert-ID braucht mindestens eine Version im Release,
    // sonst liefert die Engine für alle Nutzer „unbekannt“ statt eines Ergebnisses.
    const genutzt = await tx.abfrage<{ id: string }>(
      `select distinct m[1] as id from katalog.pflicht_version pv,
              regexp_matches(pv.daten::text, '"regelwert":\\s*"([a-z0-9_.]+)"', 'g') as m
        where pv.id = any($1)`,
      [pflichten.map((p) => p.id)],
    );
    const vorhanden = new Set(
      (await tx.abfrage<{ regelwert_id: string }>("select regelwert_id from katalog.regelwert_version where id = any($1)", [regelwerte.map((r) => r.id)])).map((r) => r.regelwert_id),
    );
    const fehlend = genutzt.map((g) => g.id).filter((id) => !vorhanden.has(id));
    if (fehlend.length) throw new StudioFehler(`Regelwerte fehlen im Release (nicht freigegeben?): ${fehlend.join(", ")}`);
    const r = await tx.eine<{ id: string; nummer: number }>(
      "insert into katalog.release (nummer, notiz, erstellt_von) values ((select coalesce(max(nummer),0)+1 from katalog.release), $1, $2) returning id, nummer",
      [notiz, wer.id],
    );
    for (const p of pflichten) await tx.abfrage("insert into katalog.release_inhalt values ($1, 'pflicht_version', $2)", [r!.id, p.id]);
    for (const v of regelwerte) await tx.abfrage("insert into katalog.release_inhalt values ($1, 'regelwert_version', $2)", [r!.id, v.id]);
    await tx.abfrage("update katalog.release set veroeffentlicht_am = now() where id = $1", [r!.id]);
    if (rollout) await rollout(tx);
    katalogCacheLeeren();
    return { nummer: r!.nummer, inhalte: pflichten.length + regelwerte.length };
  });
}

export interface FixtureErgebnis {
  datei: string;
  persona: string;
  pflicht_id: string;
  erwartet: Ergebnis | undefined;
  vorher: Ergebnis | undefined;
  nachher: Ergebnis | undefined;
}

/** Testlauf (docs/04 Studio): welche Fixtures ändern ihr Ergebnis, wenn diese Version die aktive ersetzt? */
export async function testlauf(db: Datenbank, kandidat: Pflicht, fixtureVerzeichnis: string): Promise<FixtureErgebnis[]> {
  const aktiv = await db.imKontext({}, (tx) => ladeAktivenKatalog(tx));
  const basis: Katalog = aktiv?.katalog ?? { pflichten: [], regelwerte: [] };
  const neu: Katalog = { ...basis, pflichten: [...basis.pflichten.filter((p) => p.id !== kandidat.id), kandidat] };
  const kalender = new StandardKalender();
  const dateien = fs.existsSync(fixtureVerzeichnis) ? fs.readdirSync(fixtureVerzeichnis).filter((f) => /\.ya?ml$/.test(f)).sort() : [];
  return dateien.map((datei) => {
    const fx = YAML.parse(fs.readFileSync(path.join(fixtureVerzeichnis, datei), "utf8")) as {
      persona: string; stichtag: string; fakten: Record<string, unknown>; ereignisse?: { typ: string; datum: string }[]; erwartet: Record<string, Ergebnis>;
    };
    const eingabe = { fakten: fx.fakten ?? {}, ereignisse: fx.ereignisse ?? [], stichtag: fx.stichtag, kalender };
    const vorher = auswerten({ ...eingabe, katalog: basis }).find((e) => e.pflicht_id === kandidat.id)?.ergebnis;
    const nachher = auswerten({ ...eingabe, katalog: neu }).find((e) => e.pflicht_id === kandidat.id)?.ergebnis;
    return { datei, persona: fx.persona, pflicht_id: kandidat.id, erwartet: fx.erwartet[kandidat.id], vorher, nachher };
  });
}

/**
 * Neue Regelwertversion (nie überschreiben, E-034). Status „in Prüfung“; offene ältere Versionen desselben
 * Regelwerts mit überlappendem Zeitraum gelten als überholt. Ein neuer Regelwert wird mit Einheit und Bezeichnung angelegt;
 * die Einheit eines bestehenden Regelwerts ist fest (Regeln vergleichen sonst Äpfel mit Birnen).
 */
export async function neueRegelwertversion(db: Datenbank, autor: StudioKonto, daten: Record<string, unknown>): Promise<{ id: string; version: number }> {
  if (!autor.rollen.some((r) => r === "redaktion" || r === "plattform_admin")) throw new StudioFehler("Nur die Redaktion legt Versionen an");
  return db.imKontext({ kontoId: autor.id }, async (tx) => {
    const id = String(daten.id ?? "");
    const max = await tx.eine<{ v: number | null }>("select max(version) as v from katalog.regelwert_version where regelwert_id = $1", [id]);
    const version = (max?.v ?? 0) + 1;
    const rw = { ...daten, schema_version: 1, version } as unknown as Record<string, unknown> & { einheit: string; bezeichnung: unknown; wert: number; gueltig_ab: string; gueltig_bis?: string | null; status_recht: string; quellen?: unknown };
    delete rw.pruefung;
    const fehler = pruefeRegelwertObjekt(rw);
    if (fehler.length) throw new StudioFehler(fehler.join("\n"));
    const vorhanden = await tx.eine<{ einheit: string }>("select einheit from katalog.regelwert where id = $1", [id]);
    if (vorhanden && vorhanden.einheit !== rw.einheit) throw new StudioFehler(`Einheit: ${id} hat die Einheit „${vorhanden.einheit}“ und kann sie nicht wechseln`);
    if (!vorhanden) await tx.abfrage("insert into katalog.regelwert (id, einheit, bezeichnung) values ($1, $2, $3)", [id, rw.einheit, rw.bezeichnung]);
    const r = await tx.eine<{ id: string }>(
      `insert into katalog.regelwert_version (regelwert_id, version, wert, gueltig_ab, gueltig_bis, status_recht, daten, pruef_status, erstellt_von)
       values ($1, $2, $3, $4, $5, $6, $7, 'in_pruefung', $8) returning id`,
      [id, version, rw.wert, rw.gueltig_ab, rw.gueltig_bis ?? null, rw.status_recht, rw, autor.id],
    );
    await quellenVerknuepfen(tx, "regelwert_version", r!.id, (rw.quellen as { titel: string; url: string; abgerufen?: string | null; fundstelle?: string }[]) ?? []);
    await tx.abfrage(
      `update katalog.regelwert_version set pruef_status = 'zurueckgezogen'
        where regelwert_id = $1 and version < $2 and pruef_status in ('entwurf', 'in_pruefung')
          and daterange(gueltig_ab, gueltig_bis, '[]') && daterange($3::date, $4::date, '[]')`,
      [id, version, rw.gueltig_ab, rw.gueltig_bis ?? null],
    );
    return { id: r!.id, version };
  });
}

/** Alle Versionen eines Regelwerts, neueste zuerst. */
export async function regelwertVersionen(db: Datenbank, regelwertId: string) {
  return db.imKontext({}, (tx) =>
    tx.abfrage<{ id: string; version: number; daten: Record<string, unknown>; pruef_status: string; freigaben: number; erstellt_am: string }>(
      `select rv.id, rv.version, rv.daten, rv.pruef_status, rv.erstellt_am,
              (select count(*)::int from katalog.freigabe f where f.objekt_id = rv.id and f.entscheidung = 'freigegeben') as freigaben
         from katalog.regelwert_version rv where rv.regelwert_id = $1 order by rv.version desc`,
      [regelwertId],
    ),
  );
}

export async function regelwertUebersicht(db: Datenbank) {
  return db.imKontext({}, (tx) =>
    tx.abfrage<{ id: string; regelwert_id: string; version: number; wert: number; einheit: string; gueltig_ab: string; gueltig_bis: string | null; pruef_status: string; status_recht: string; freigaben: number; im_release: boolean }>(`
      select rv.id, rv.regelwert_id, rv.version, rv.wert, r.einheit, rv.gueltig_ab, rv.gueltig_bis, rv.pruef_status, rv.status_recht,
             (select count(*)::int from katalog.freigabe f where f.objekt_id = rv.id and f.entscheidung = 'freigegeben') as freigaben,
             exists (select 1 from katalog.aktives_release a join katalog.release_inhalt ri on ri.release_id = a.id where ri.objekt_id = rv.id) as im_release
        from katalog.regelwert_version rv join katalog.regelwert r on r.id = rv.regelwert_id
       order by rv.regelwert_id, rv.gueltig_ab, rv.version`),
  );
}

export async function releaseListe(db: Datenbank) {
  return db.imKontext({}, (tx) =>
    tx.abfrage<{ nummer: number; notiz: string | null; veroeffentlicht_am: Date | null; autor: string; pflichten: number; regelwerte: number; ungeprueft: number }>(`
      select r.nummer, r.notiz, r.veroeffentlicht_am, k.anzeigename as autor,
             count(*) filter (where ri.objekt_art = 'pflicht_version')::int as pflichten,
             count(*) filter (where ri.objekt_art = 'regelwert_version')::int as regelwerte,
             (count(*) filter (where pv.pruef_status <> 'freigegeben') + count(*) filter (where rv.pruef_status <> 'freigegeben'))::int as ungeprueft
        from katalog.release r
        join app.konto k on k.id = r.erstellt_von
        left join katalog.release_inhalt ri on ri.release_id = r.id
        left join katalog.pflicht_version pv on pv.id = ri.objekt_id and ri.objekt_art = 'pflicht_version'
        left join katalog.regelwert_version rv on rv.id = ri.objekt_id and ri.objekt_art = 'regelwert_version'
       group by r.id, k.anzeigename order by r.nummer desc`),
  );
}

export async function pruefpunkte(db: Datenbank) {
  return db.imKontext({}, (tx) =>
    tx.abfrage<{ art: string; id: string; version: number; punkt: string }>(`
      select 'Pflicht' as art, pflicht_id as id, version, jsonb_array_elements_text(daten->'fachlich_zu_pruefen') as punkt
        from (select distinct on (pflicht_id) pflicht_id, version, daten from katalog.pflicht_version order by pflicht_id, version desc) p
      union all
      select 'Regelwert', regelwert_id, version, jsonb_array_elements_text(daten->'fachlich_zu_pruefen')
        from katalog.regelwert_version
      order by 1, 2, 3`),
  );
}

// ------------------------------------------------------------ Marktplatz-Partner (6.12, E-102)

export interface PartnerDaten {
  name: string;
  qualifikation: string;
  kanzlei?: string;
  regionen?: string[];
  beschreibung?: string;
  pakete?: { titel: string; umfang?: string; preis_text?: string }[];
  email: string;
  website?: string | null;
  zulassung_geprueft_am?: string | null;
  aktiv?: boolean;
}

const LAENDER = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"];

/** Prüft Partnerdaten; gibt Fehlermeldungen zurück (leer = gültig). */
export function pruefePartner(d: PartnerDaten): string[] {
  const f: string[] = [];
  if (!d.name?.trim()) f.push("Name fehlt");
  if (!["steuerberater", "rechtsanwalt", "fachkraft_arbeitssicherheit", "datenschutzbeauftragter"].includes(d.qualifikation)) f.push("Qualifikation unbekannt");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email ?? "")) f.push("E-Mail-Adresse ungültig");
  if (d.website && !/^https:\/\//.test(d.website)) f.push("Website muss mit https:// beginnen");
  for (const r of d.regionen ?? []) if (!LAENDER.includes(r)) f.push(`Bundesland unbekannt: ${r}`);
  for (const p of d.pakete ?? []) if (!p.titel?.trim()) f.push("Jedes Paket braucht einen Titel");
  if (d.zulassung_geprueft_am && !/^\d{4}-\d{2}-\d{2}$/.test(d.zulassung_geprueft_am)) f.push("Datum der Zulassungsprüfung ungültig");
  return f;
}

export async function partnerListe(db: Datenbank) {
  return db.imKontext({}, (tx) => tx.abfrage("select * from katalog.partner order by not aktiv, qualifikation, name"));
}

/** Anlegen oder ändern; nur Plattform-Admin oder Redaktion. Aktiv schalten nur mit geprüfter Zulassung. */
export async function partnerSpeichern(db: Datenbank, wer: StudioKonto, d: PartnerDaten, id?: string) {
  if (!wer.rollen.some((r) => r === "plattform_admin" || r === "redaktion")) throw new StudioFehler("Nur Plattform-Admin oder Redaktion pflegt Partner");
  const fehler = pruefePartner(d);
  if (d.aktiv !== false && !d.zulassung_geprueft_am) fehler.push("Aktiv nur mit geprüfter Berufszulassung");
  if (fehler.length) throw new StudioFehler(fehler.join("; "));
  const werte = [d.name.trim(), d.qualifikation, d.kanzlei ?? "", d.regionen ?? [], d.beschreibung ?? "", JSON.stringify(d.pakete ?? []), d.email.trim(), d.website ?? null, d.zulassung_geprueft_am ?? null, d.aktiv !== false];
  return db.imKontext({ kontoId: wer.id }, async (tx) => {
    if (id) {
      const r = await tx.eine("update katalog.partner set name = $2, qualifikation = $3, kanzlei = $4, regionen = $5, beschreibung = $6, pakete = $7, email = $8, website = $9, zulassung_geprueft_am = $10, aktiv = $11 where id = $1 returning *", [id, ...werte]);
      if (!r) throw new StudioFehler("Partner nicht gefunden");
      return r;
    }
    return tx.eine("insert into katalog.partner (name, qualifikation, kanzlei, regionen, beschreibung, pakete, email, website, zulassung_geprueft_am, aktiv) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *", werte);
  });
}
