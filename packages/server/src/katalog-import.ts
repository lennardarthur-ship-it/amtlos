import fs from "node:fs";
import path from "node:path";
import { validiereKatalog } from "@amtlos/rules-schema";
import { parse } from "yaml";
import type { Datenbank, Tx } from "./datenbank.js";
import { katalogCacheLeeren } from "./katalog.js";

export const SYSTEMKONTO_KATALOG = "00000000-0000-0000-0000-000000000001";

export interface ImportErgebnis {
  release: number | null;
  neuePflichtversionen: number;
  neueRegelwertversionen: number;
  unveraendert: boolean;
  /** neu angelegte oder geänderte Übersetzungen (E-107) */
  uebersetzungen: number;
}

interface Quelle {
  titel: string;
  url: string;
  abgerufen?: string | null;
  fundstelle?: string;
}

/**
 * Importiert catalog/ (YAML) als neues Release (E-030: Startbestand und Entwicklungsumgebungen).
 * - Bestehende Versionen werden nie überschrieben; gleiche Nummer mit anderem Inhalt ist ein Fehler.
 * - Alles wird als 'entwurf' importiert. Freigaben entstehen nur im Studio (Vier-Augen, E-039).
 * - In prod verhindert der Datenbank-Trigger ein Release mit ungeprüften Inhalten.
 * Läuft als Rolle mit Schreibrecht auf katalog.* (amtlos_studio).
 */
export async function importiereKatalog(db: Datenbank, katalogDir: string): Promise<ImportErgebnis> {
  const pruefung = validiereKatalog(katalogDir);
  if (pruefung.fehler.length) throw new Error(`Katalog ungültig:\n- ${pruefung.fehler.join("\n- ")}`);

  return db.imKontext({ kontoId: SYSTEMKONTO_KATALOG }, async (tx) => {
    let neuePflichtversionen = 0;
    let neueRegelwertversionen = 0;
    const inhalt: { art: "pflicht_version" | "regelwert_version"; id: string }[] = [];

    for (const { inhalt: p } of pruefung.pflichten) {
      await tx.abfrage("insert into katalog.pflicht (id, kategorie) values ($1, $2) on conflict (id) do nothing", [p.id, p.kategorie]);
      const { id, neu } = await versionAnlegen(
        tx,
        "select id, daten from katalog.pflicht_version where pflicht_id = $1 and version = $2",
        `insert into katalog.pflicht_version (pflicht_id, version, daten, status_recht, gueltig_ab, gueltig_bis, erstellt_von)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [p.id, p.version],
        [p.id, p.version, p, p.status_recht, p.gueltig_ab ?? null, p.gueltig_bis ?? null, SYSTEMKONTO_KATALOG],
        p,
        `Pflicht ${p.id}@${p.version}`,
      );
      if (neu) {
        neuePflichtversionen++;
        await quellenVerknuepfen(tx, "pflicht_version", id, (p.quellen as Quelle[]) ?? []);
      }
      inhalt.push({ art: "pflicht_version", id });
    }

    for (const rw of pruefung.regelwerte) {
      await tx.abfrage("insert into katalog.regelwert (id, einheit, bezeichnung) values ($1, $2, $3) on conflict (id) do nothing", [
        rw.id,
        rw.einheit,
        rw.bezeichnung,
      ]);
      const { id, neu } = await versionAnlegen(
        tx,
        "select id, daten from katalog.regelwert_version where regelwert_id = $1 and version = $2",
        `insert into katalog.regelwert_version (regelwert_id, version, wert, gueltig_ab, gueltig_bis, status_recht, daten, erstellt_von)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [rw.id, rw.version],
        // E-213: gueltig_ab null (ohne Stichtag) – in der Datenbank „not null“, daher '-infinity'
        [rw.id, rw.version, rw.wert, rw.gueltig_ab ?? "-infinity", rw.gueltig_bis ?? null, rw.status_recht, rw, SYSTEMKONTO_KATALOG],
        rw,
        `Regelwert ${rw.id}@${rw.version}`,
      );
      if (neu) {
        neueRegelwertversionen++;
        await quellenVerknuepfen(tx, "regelwert_version", id, (rw.quellen as Quelle[]) ?? []);
      }
      inhalt.push({ art: "regelwert_version", id });
    }

    // Unverändert gegenüber dem aktiven Release? Dann kein neues Release.
    const aktiv = await tx.abfrage<{ objekt_id: string }>(
      "select ri.objekt_id from katalog.aktives_release r join katalog.release_inhalt ri on ri.release_id = r.id",
    );
    const aktivIds = new Set(aktiv.map((a) => a.objekt_id));
    const uebersetzungen = await importiereUebersetzungen(tx, katalogDir);
    if (uebersetzungen) katalogCacheLeeren();
    if (aktiv.length === inhalt.length && inhalt.every((i) => aktivIds.has(i.id))) {
      return { release: null, neuePflichtversionen, neueRegelwertversionen, unveraendert: true, uebersetzungen };
    }

    const r = await tx.eine<{ id: string; nummer: number }>(
      `insert into katalog.release (nummer, notiz, erstellt_von)
       values ((select coalesce(max(nummer), 0) + 1 from katalog.release), 'Import aus catalog/', $1) returning id, nummer`,
      [SYSTEMKONTO_KATALOG],
    );
    for (const i of inhalt) await tx.abfrage("insert into katalog.release_inhalt values ($1, $2, $3)", [r!.id, i.art, i.id]);
    await tx.abfrage("update katalog.release set veroeffentlicht_am = now() where id = $1", [r!.id]);
    katalogCacheLeeren();
    return { release: r!.nummer, neuePflichtversionen, neueRegelwertversionen, unveraendert: false, uebersetzungen };
  });
}

async function versionAnlegen(
  tx: Tx,
  sucheSql: string,
  einfuegenSql: string,
  sucheWerte: unknown[],
  einfuegenWerte: unknown[],
  daten: unknown,
  name: string,
): Promise<{ id: string; neu: boolean }> {
  const vorhanden = await tx.eine<{ id: string; daten: unknown }>(sucheSql, sucheWerte);
  if (vorhanden) {
    if (!gleicherInhalt(vorhanden.daten, daten)) {
      throw new Error(`${name}: existiert bereits mit anderem Inhalt. Für Änderungen eine neue Version anlegen.`);
    }
    return { id: vorhanden.id, neu: false };
  }
  const neu = await tx.eine<{ id: string }>(einfuegenSql, einfuegenWerte);
  return { id: neu!.id, neu: true };
}

export async function quellenVerknuepfen(tx: Tx, art: "pflicht_version" | "regelwert_version", versionId: string, quellen: Quelle[]) {
  for (const q of quellen) {
    let quelle = await tx.eine<{ id: string }>(
      "select id from katalog.quelle where url = $1 and abgerufen_am is not distinct from $2::date",
      [q.url, q.abgerufen ?? null],
    );
    quelle ??= await tx.eine<{ id: string }>("insert into katalog.quelle (titel, url, abgerufen_am) values ($1, $2, $3) returning id", [
      q.titel,
      q.url,
      q.abgerufen ?? null,
    ]);
    await tx.abfrage(
      `insert into katalog.${art}_quelle (${art}_id, quelle_id, fundstelle) values ($1, $2, $3) on conflict do nothing`,
      [versionId, quelle!.id, q.fundstelle ?? null],
    );
  }
}

/**
 * E-223 (Entscheidung zu T-124/T-270): Felder, die nicht zum Inhalt einer Version gehören – interne Notizen der Redaktion
 * (`fachlich_zu_pruefen`) und der Prüfstand aus dem Register (`pruefung`, von docs/freigabe-katalog/anwenden.py geschrieben;
 * in der Datenbank entstehen Freigaben nur im Studio, E-039). Wie `NICHT_VERGLICHEN` in anwenden.py: Ändern sie sich, ist
 * das keine neue Fassung. Der Import vergleicht ohne sie und lässt die gespeicherte Version unverändert (freigegebene
 * Versionen sind in der Datenbank unveränderlich, Trigger `status_schuetzen`). E-233: `nicht_vor_freigabe` (ob ein Entwurf
 * schon in der App erscheint) ist ebenfalls kein Inhalt.
 */
export const NICHT_INHALT = ["fachlich_zu_pruefen", "pruefung", "nicht_vor_freigabe"] as const;

/** Gleicher Inhalt einer Pflicht- bzw. Regelwert-Version, ohne Notizen und Prüfstand (NICHT_INHALT). */
export function gleicherInhalt(a: unknown, b: unknown): boolean {
  const ohne = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).filter(([k]) => !(NICHT_INHALT as readonly string[]).includes(k))) : x);
  return kanonisch(ohne(a)) === kanonisch(ohne(b));
}

/** JSON mit sortierten Schlüsseln, damit jsonb-Rundreisen (Schlüsselreihenfolge) nicht als Änderung zählen. */
export function kanonisch(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(kanonisch).join(",")}]`;
  if (x && typeof x === "object")
    return `{${Object.keys(x)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${kanonisch((x as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(x);
}

interface UebersetzungsDatei { sprache: string; status?: string; eintraege: { de: string; en: string }[] }

/** Prüft eine Übersetzungsdatei; gibt Fehlermeldungen zurück (leer = gültig). */
export function pruefeUebersetzungen(d: unknown, datei: string): string[] {
  const f: string[] = [];
  const u = d as Partial<UebersetzungsDatei> | null;
  if (!u || u.sprache !== "en") f.push(`${datei}: sprache muss "en" sein`);
  if (u?.status && !["maschinell", "geprueft"].includes(u.status)) f.push(`${datei}: status unbekannt`);
  if (!Array.isArray(u?.eintraege)) return [...f, `${datei}: eintraege fehlt`];
  const gesehen = new Set<string>();
  u.eintraege.forEach((e, i) => {
    if (typeof e?.de !== "string" || !e.de.trim() || typeof e?.en !== "string" || !e.en.trim()) f.push(`${datei}: Eintrag ${i + 1} braucht de und en`);
    else if (gesehen.has(e.de)) f.push(`${datei}: doppelter deutscher Text in Eintrag ${i + 1}`);
    else gesehen.add(e.de);
  });
  return f;
}

/**
 * Übersetzungen aus catalog/uebersetzungen/*.yaml übernehmen. Im Studio geprüfte Einträge gewinnen (die Datenbank ist
 * Quelle der Wahrheit, E-030); sonst übernimmt ein geänderter Text Text und Status der Datei. Danach werden die lokalisierten Dokumente neu berechnet.
 */
async function importiereUebersetzungen(tx: Tx, katalogDir: string): Promise<number> {
  const ordner = path.join(katalogDir, "uebersetzungen");
  if (!fs.existsSync(ordner)) return 0;
  let geaendert = 0;
  for (const name of fs.readdirSync(ordner).filter((n) => n.endsWith(".yaml")).sort()) {
    const d = parse(fs.readFileSync(path.join(ordner, name), "utf8")) as UebersetzungsDatei;
    const fehler = pruefeUebersetzungen(d, name);
    if (fehler.length) throw new Error(`Übersetzungen ungültig:\n- ${fehler.join("\n- ")}`);
    const status = d.status ?? "maschinell";
    for (const e of d.eintraege) {
      const r = await tx.abfrage(
        `insert into katalog.uebersetzung (sprache, de, text, status) values ($1, $2, $3, $4)
         on conflict (sprache, de_hash) do update set text = excluded.text, status = excluded.status, geprueft_von = null, geprueft_am = null, geaendert_am = now()
           where katalog.uebersetzung.text is distinct from excluded.text and katalog.uebersetzung.status <> 'geprueft' 
         returning 1`,
        [d.sprache, e.de, e.en.trim(), status],
      );
      geaendert += r.length;
    }
  }
  if (geaendert) await tx.abfrage("select katalog.lokal_auffrischen()");
  return geaendert;
}
