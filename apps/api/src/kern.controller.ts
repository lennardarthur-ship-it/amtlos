import { Body, ConflictException, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Put, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type PgBoss from "pg-boss";
import fs from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import { Datenbank, neuberechnungEinreihen } from "@amtlos/server";
import { Kontext, MitUnternehmen, Oeffentlich, type Anfragekontext } from "./auth.js";
import { DATUM, pruefe, seite, seitenkopf, uebersetzeDbFehler } from "./hilfen.js";
import { EREIGNIS_PAYLOAD, EREIGNISTYPEN, ProfilSchema } from "./profil-schema.js";
import { profilSperren } from "./profil-sync.js";

export const WARTESCHLANGE = Symbol("WARTESCHLANGE");

const UnternehmenNeu = z.object({ name: z.string().trim().min(1).max(200), marke: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/).nullable().optional() }).strict();
/**
 * Profil speichern (M1): entweder das ganze Profil (daten) oder nur geänderte Angaben (aenderungen, null löscht), die der
 * Server unter einer Sperre mit der aktuellen Version zusammenführt. erwartete_version: die Version, die die Oberfläche
 * gelesen hat – passt sie nicht mehr, antwortet die API mit 409 statt fremde Änderungen zu überschreiben.
 */
const ProfilEingabe = z
  .object({ daten: z.unknown().optional(), aenderungen: z.record(z.unknown()).optional(), erwartete_version: z.number().int().min(0).optional() })
  .strict()
  .refine((x) => (x.daten === undefined) !== (x.aenderungen === undefined), "Entweder daten oder aenderungen angeben");
/** Nutzlast je Ereignistyp (G1): nur die Felder aus ereignisse.json, nur einfache Werte, klein. */
const PayloadWert = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);
const EreignisNeu = z
  .object({
    typ: z.string().refine((x) => EREIGNISTYPEN.has(x), "Unbekannter Ereignistyp"),
    datum: DATUM,
    payload: z.record(PayloadWert).default({}),
    client_id: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    const erlaubt = EREIGNIS_PAYLOAD.get(e.typ) ?? [];
    for (const feld of Object.keys(e.payload))
      if (!erlaubt.includes(feld)) ctx.addIssue({ code: "custom", path: ["payload", feld], message: `Unbekanntes Feld für ${e.typ}: ${feld}` });
  });
const Uuid = z.string().uuid();

/** Die Beschreibung liegt neben src/ und dist/ (apps/api/openapi.yaml); einmal beim Start gelesen. */
export const OPENAPI = parse(fs.readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8")) as Record<string, unknown>;

@Controller("v1")
export class KernController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
  ) {}

  @Oeffentlich()
  @Get("gesundheit")
  async gesundheit() {
    await this.db.imKontext({}, (tx) => tx.eine("select 1"));
    return { status: "ok" };
  }

  @Oeffentlich()
  @Get("openapi.json")
  openapi() {
    return OPENAPI;
  }

  @Get("ich")
  async ich(@Kontext() k: Anfragekontext) {
    return this.db.imKontext({ kontoId: k.kontoId }, async (tx) => ({
      konto: await tx.eine("select id, email, anzeigename, sprache from app.konto where id = $1", [k.kontoId]),
      unternehmen: await tx.abfrage(
        `select u.id, u.name, m.rolle from app.mitgliedschaft m join app.unternehmen u on u.id = m.unternehmen_id
          where m.konto_id = $1 and u.geloescht_am is null order by u.name`,
        [k.kontoId],
      ),
    }));
  }

  /** Sprache des Kontos für E-Mails und Benachrichtigungen. */
  @Put("ich/sprache")
  @HttpCode(204)
  async spracheSetzen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { sprache } = pruefe(z.object({ sprache: z.enum(["de", "en"]) }).strict(), body);
    await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.abfrage("select app.konto_sprache_setzen($1)", [sprache]));
  }

  @Post("unternehmen")
  async unternehmenAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { name, marke } = pruefe(UnternehmenNeu, body);
    const id = await this.db
      .imKontext({ kontoId: k.kontoId }, async (tx) => {
        // Unbekannte oder inaktive Marke: ohne Marke anlegen (die Marke kommt aus dem Hostnamen, nicht von der Nutzerin)
        const m = marke ? await tx.eine<{ id: string }>("select id from katalog.marke where schluessel = $1 and aktiv", [marke]) : undefined;
        return (await tx.eine<{ id: string }>("select app.unternehmen_anlegen($1, $2) as id", [name, m?.id ?? null]))!.id;
      })
      .catch(uebersetzeDbFehler);
    return { id, name, rolle: "inhaber" };
  }

  @MitUnternehmen()
  @Get("profil")
  async profil(@Kontext() k: Anfragekontext) {
    const p = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      tx.eine("select version, daten, erstellt_am from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]),
    );
    return p ?? { version: 0, daten: {}, erstellt_am: null };
  }

  /** Neue Profilversion (E-018: nie überschreiben) und Neuberechnung in derselben Transaktion. */
  @MitUnternehmen("inhaber", "admin", "steuerberater")
  @Put("profil")
  async profilSpeichern(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const eingabe = pruefe(ProfilEingabe, body);
    // Ganzes Profil vorab prüfen; zusammengeführte Änderungen erst unter der Sperre (dann mit dem aktuellen Stand)
    const ganz = eingabe.daten !== undefined ? pruefe(ProfilSchema, eingabe.daten) : undefined;
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        await profilSperren(tx, k.unternehmenId!);
        const alt = await tx.eine<{ version: number; daten: Record<string, unknown> }>(
          "select version, daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1",
          [k.unternehmenId],
        );
        const aktuell = alt?.version ?? 0;
        if (eingabe.erwartete_version !== undefined && eingabe.erwartete_version !== aktuell)
          throw new ConflictException({ statusCode: 409, meldung: "Das Profil wurde inzwischen geändert. Bitte lade die Seite neu und prüfe deine Angaben.", version: aktuell });
        const daten = ganz ?? pruefe(ProfilSchema, { ...(alt?.daten ?? {}), ...eingabe.aenderungen });
        const r = await tx.eine<{ version: number }>(
          "insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values ($1, $2, $3, $4) returning version",
          [k.unternehmenId, aktuell + 1, daten, k.kontoId],
        );
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `profil:${r!.version}` });
        return { version: r!.version, daten };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen()
  @Get("ereignisse")
  async ereignisse(@Kontext() k: Anfragekontext, @Query() q: { limit?: string; cursor?: string }, @Res({ passthrough: true }) res: Response) {
    const s = seite(q);
    const zeilen = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      tx.abfrage<{ gesamt: number }>(
        `select e.id, e.typ, e.eingetreten_am as datum, e.payload, e.erfasst_am, e.storniert_ereignis_id,
                exists (select 1 from app.ereignis s where s.storniert_ereignis_id = e.id) as storniert, count(*) over () as gesamt
           from app.ereignis e where e.unternehmen_id = $1 order by e.eingetreten_am desc, e.erfasst_am desc, e.id limit $2 offset $3`,
        [k.unternehmenId, s.limit, s.versatz],
      ),
    );
    return seitenkopf(res, zeilen, s);
  }

  /** Idempotent über client_id (Offline-Upload, E-018) – auch bei gleichzeitigen Wiederholungen (M2). */
  @MitUnternehmen("inhaber", "admin", "steuerberater")
  @Post("ereignisse")
  async ereignisMelden(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const e = pruefe(EreignisNeu, body);
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        // on conflict wartet auf eine parallele Transaktion mit derselben client_id und tut danach nichts
        const neu = await tx.eine<{ id: string }>(
          `insert into app.ereignis (unternehmen_id, typ, eingetreten_am, payload, quelle, client_id, erfasst_von)
           values ($1, $2, $3, $4, 'nutzer', $5, $6) on conflict (unternehmen_id, client_id) do nothing returning id`,
          [k.unternehmenId, e.typ, e.datum, e.payload, e.client_id ?? null, k.kontoId],
        );
        if (!neu) {
          const vorhanden = await tx.eine("select id, typ, eingetreten_am as datum from app.ereignis where unternehmen_id = $1 and client_id = $2", [k.unternehmenId, e.client_id]);
          return { ...vorhanden, wiederholt: true };
        }
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `ereignis:${neu!.id}` });
        return { id: neu!.id, typ: e.typ, datum: e.datum, wiederholt: false };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen("inhaber", "admin", "steuerberater")
  @Post("ereignisse/:id/storno")
  async storno(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const alt = await tx.eine<{ typ: string; eingetreten_am: string; storniert_ereignis_id: string | null }>(
          "select typ, eingetreten_am, storniert_ereignis_id from app.ereignis where id = $1",
          [id],
        );
        if (!alt || alt.storniert_ereignis_id) throw new NotFoundException("Ereignis nicht gefunden");
        // Höchstens ein Storno je Ereignis (M3, Teil-Unique-Index aus 0020): parallele Stornos legen keine Duplikate an
        const neu = await tx.eine(
          `insert into app.ereignis (unternehmen_id, typ, eingetreten_am, quelle, storniert_ereignis_id, erfasst_von)
           values ($1, $2, $3, 'nutzer', $4, $5)
           on conflict (storniert_ereignis_id) where storniert_ereignis_id is not null do nothing returning id`,
          [k.unternehmenId, alt.typ, alt.eingetreten_am, id, k.kontoId],
        );
        if (!neu) return { id, storniert: true };
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `storno:${id}` });
        return { id, storniert: true };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen("inhaber", "admin")
  @HttpCode(202)
  @Post("neuberechnung")
  async neuberechnung(@Kontext() k: Anfragekontext, @Query("grund") grund?: string) {
    await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `manuell${grund ? `:${grund.slice(0, 50)}` : ""}` }),
    );
    return { eingereiht: true };
  }
}
