import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { Datenbank, neuberechnungEinreihen } from "@amtlos/server";
import { Kontext, MitUnternehmen, Oeffentlich, type Anfragekontext } from "./auth.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { EREIGNISTYPEN, ProfilSchema } from "./profil-schema.js";

export const WARTESCHLANGE = Symbol("WARTESCHLANGE");

const UnternehmenNeu = z.object({ name: z.string().trim().min(1).max(200) }).strict();
const ProfilEingabe = z.object({ daten: z.unknown() }).strict();
const EreignisNeu = z
  .object({
    typ: z.string().refine((x) => EREIGNISTYPEN.has(x), "Unbekannter Ereignistyp"),
    datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    payload: z.record(z.unknown()).default({}),
    client_id: z.string().uuid().optional(),
  })
  .strict();
const Uuid = z.string().uuid();

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

  @Post("unternehmen")
  async unternehmenAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { name } = pruefe(UnternehmenNeu, body);
    const id = await this.db.imKontext({ kontoId: k.kontoId }, async (tx) => (await tx.eine<{ id: string }>("select app.unternehmen_anlegen($1) as id", [name]))!.id);
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
    const daten = pruefe(ProfilSchema, pruefe(ProfilEingabe, body).daten);
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const r = await tx.eine<{ version: number }>(
          `insert into app.profil_version (unternehmen_id, version, daten, erstellt_von)
           values ($1, (select coalesce(max(version), 0) + 1 from app.profil_version where unternehmen_id = $1), $2, $3)
           returning version`,
          [k.unternehmenId, daten, k.kontoId],
        );
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `profil:${r!.version}` });
        return { version: r!.version, daten };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen()
  @Get("ereignisse")
  async ereignisse(@Kontext() k: Anfragekontext) {
    return this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      tx.abfrage(
        `select e.id, e.typ, e.eingetreten_am as datum, e.payload, e.erfasst_am, e.storniert_ereignis_id,
                exists (select 1 from app.ereignis s where s.storniert_ereignis_id = e.id) as storniert
           from app.ereignis e where e.unternehmen_id = $1 order by e.eingetreten_am desc, e.erfasst_am desc`,
        [k.unternehmenId],
      ),
    );
  }

  /** Idempotent über client_id (Offline-Upload, E-018). */
  @MitUnternehmen("inhaber", "admin", "steuerberater")
  @Post("ereignisse")
  async ereignisMelden(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const e = pruefe(EreignisNeu, body);
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        if (e.client_id) {
          const vorhanden = await tx.eine("select id, typ, eingetreten_am as datum from app.ereignis where unternehmen_id = $1 and client_id = $2", [k.unternehmenId, e.client_id]);
          if (vorhanden) return { ...vorhanden, wiederholt: true };
        }
        const neu = await tx.eine<{ id: string }>(
          `insert into app.ereignis (unternehmen_id, typ, eingetreten_am, payload, quelle, client_id, erfasst_von)
           values ($1, $2, $3, $4, 'nutzer', $5, $6) returning id`,
          [k.unternehmenId, e.typ, e.datum, e.payload, e.client_id ?? null, k.kontoId],
        );
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
        const schon = await tx.eine("select 1 from app.ereignis where storniert_ereignis_id = $1", [id]);
        if (schon) return { id, storniert: true };
        await tx.abfrage(
          `insert into app.ereignis (unternehmen_id, typ, eingetreten_am, quelle, storniert_ereignis_id, erfasst_von)
           values ($1, $2, $3, 'nutzer', $4, $5)`,
          [k.unternehmenId, alt.typ, alt.eingetreten_am, id, k.kontoId],
        );
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
