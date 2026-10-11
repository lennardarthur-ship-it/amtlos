import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Put, Query, Res, UnprocessableEntityException } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { ALLERGENE, Datenbank, allergenAushangPdf, eigenkontrollProtokollPdf, heute } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
const Uuid = z.string().uuid();
const MONAT = /^\d{4}-(0[1-9]|1[0-2])$/;
const Zahl = z.number().finite().min(-1000).max(100000);

const Messpunkt = z
  .object({
    bezeichnung: z.string().trim().min(1).max(200),
    einheit: z.enum(["°C", "%", "pH", "sonstige"]).default("°C"),
    grenze_min: Zahl.nullable().optional(),
    grenze_max: Zahl.nullable().optional(),
    aktiv: z.boolean().default(true),
  })
  .strict()
  .refine((m) => m.grenze_min == null || m.grenze_max == null || m.grenze_min <= m.grenze_max, { message: "Untere Grenze größer als obere", path: ["grenze_min"] });
const Messung = z.object({ wert: Zahl, gemessen_am: z.string().datetime({ offset: true }).optional(), massnahme: z.string().trim().max(1000).optional() }).strict();
const Gericht = z
  .object({
    name: z.string().trim().min(1).max(200),
    kategorie: z.string().trim().max(100).default(""),
    allergene: z.array(z.enum(Object.keys(ALLERGENE) as [string, ...string[]])).max(14).default([]),
    aktiv: z.boolean().default(true),
  })
  .strict();

/** Ist ein Wert innerhalb der (vom Betrieb festgelegten) Grenzen? Fehlende Grenze = offen. */
export function innerhalb(wert: number, min: number | null, max: number | null): boolean {
  return (min === null || wert >= min) && (max === null || wert <= max);
}

const zahl = (x: unknown) => (x === null || x === undefined ? null : Number(x));

/**
 * Branchenwerkzeuge Gastronomie (Spezifikation 4 H): HACCP-Eigenkontrollen und Allergenliste (E-099).
 * Grenzwerte und Kontrollhäufigkeit legt der Betrieb fest – Amtlos gibt keine Werte vor.
 */
@Controller("v1")
export class BranchenController {
  constructor(@Inject(Datenbank) private readonly db: Datenbank) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  // ------------------------------------------------------------ Eigenkontrollen

  @MitUnternehmen()
  @Get("messpunkte")
  async messpunkte(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select m.*, m.grenze_min::float8 as grenze_min, m.grenze_max::float8 as grenze_max,
                l.gemessen_am as letzte_messung, l.wert::float8 as letzter_wert, l.in_ordnung as letzte_in_ordnung,
                (select count(*)::int from app.messung x where x.messpunkt_id = m.id and (x.gemessen_am at time zone 'Europe/Berlin')::date = $2::date) as heute
           from app.messpunkt m
           left join lateral (select gemessen_am, wert, in_ordnung from app.messung where messpunkt_id = m.id order by gemessen_am desc limit 1) l on true
          where m.unternehmen_id = $1 order by not m.aktiv, m.bezeichnung`,
        [k.unternehmenId, heute()],
      ),
    );
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("messpunkte")
  async messpunktAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Messpunkt, body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          "insert into app.messpunkt (unternehmen_id, bezeichnung, einheit, grenze_min, grenze_max, aktiv) values ($1, $2, $3, $4, $5, $6) returning *, grenze_min::float8 as grenze_min, grenze_max::float8 as grenze_max",
          [k.unternehmenId, d.bezeichnung, d.einheit, d.grenze_min ?? null, d.grenze_max ?? null, d.aktiv],
        ),
      )
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("messpunkte/:id")
  async messpunktAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Messpunkt, body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          "update app.messpunkt set bezeichnung = $2, einheit = $3, grenze_min = $4, grenze_max = $5, aktiv = $6 where id = $1 returning *, grenze_min::float8 as grenze_min, grenze_max::float8 as grenze_max",
          [id, d.bezeichnung, d.einheit, d.grenze_min ?? null, d.grenze_max ?? null, d.aktiv],
        ),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Messpunkt nicht gefunden");
    return r;
  }

  /** Messung erfassen (alle Mitglieder). Außerhalb der Grenzen ist eine Korrekturmaßnahme Pflicht. */
  @MitUnternehmen()
  @Post("messpunkte/:id/messungen")
  async messen(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Messung, body);
    const zeitpunkt = d.gemessen_am ? new Date(d.gemessen_am) : new Date();
    if (zeitpunkt.getTime() > Date.now() + 5 * 60_000) throw new UnprocessableEntityException({ meldung: "Der Zeitpunkt liegt in der Zukunft", fehler: [{ feld: "gemessen_am", meldung: "nicht in der Zukunft" }] });
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const m = await tx.eine<{ grenze_min: string | null; grenze_max: string | null; aktiv: boolean }>("select grenze_min, grenze_max, aktiv from app.messpunkt where id = $1", [id]);
        if (!m || !m.aktiv) throw new NotFoundException("Aktiver Messpunkt nicht gefunden");
        const ok = innerhalb(d.wert, zahl(m.grenze_min), zahl(m.grenze_max));
        if (!ok && !d.massnahme)
          throw new UnprocessableEntityException({ meldung: "Der Wert liegt außerhalb der Grenzen – trag ein, was du getan hast", fehler: [{ feld: "massnahme", meldung: "Pflicht bei Abweichung" }] });
        return tx.eine(
          `insert into app.messung (unternehmen_id, messpunkt_id, gemessen_am, wert, in_ordnung, grenze_min, grenze_max, massnahme, erfasst_von)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *, wert::float8 as wert`,
          [k.unternehmenId, id, zeitpunkt, d.wert, ok, m.grenze_min, m.grenze_max, d.massnahme || null, k.kontoId],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  private async messungenImMonat(k: Anfragekontext, monat: string) {
    if (!MONAT.test(monat)) throw new BadRequestException("monat im Format JJJJ-MM");
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage<{ id: string; gemessen_am: Date; messpunkt: string; einheit: string; wert: number; grenze_min: number | null; grenze_max: number | null; in_ordnung: boolean; massnahme: string | null }>(
        `select x.id, x.gemessen_am, p.bezeichnung as messpunkt, p.einheit, x.wert::float8 as wert, x.grenze_min::float8 as grenze_min, x.grenze_max::float8 as grenze_max, x.in_ordnung, x.massnahme
           from app.messung x join app.messpunkt p on p.id = x.messpunkt_id
          where x.unternehmen_id = $1 and (x.gemessen_am at time zone 'Europe/Berlin') >= $2::date and (x.gemessen_am at time zone 'Europe/Berlin') < ($2::date + interval '1 month')
          order by x.gemessen_am`,
        [k.unternehmenId, `${monat}-01`],
      ),
    );
  }

  @MitUnternehmen()
  @Get("eigenkontrollen")
  async eigenkontrollen(@Kontext() k: Anfragekontext, @Query("monat") monat = "") {
    const messungen = await this.messungenImMonat(k, monat);
    return { monat, messungen, abweichungen: messungen.filter((m) => !m.in_ordnung).length };
  }

  @MitUnternehmen()
  @Get("eigenkontrollen/protokoll")
  async protokoll(@Kontext() k: Anfragekontext, @Query("monat") monat = "", @Res() res: Response) {
    const messungen = await this.messungenImMonat(k, monat);
    const unternehmen = await this.db.imKontext(this.kontext(k), async (tx) => (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!.name);
    const pdf = await eigenkontrollProtokollPdf({ unternehmen, monat, messungen: messungen.map((m) => ({ ...m, gemessen_am: m.gemessen_am.toISOString() })) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="eigenkontrollen-${monat}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  }

  // ------------------------------------------------------------ Allergene

  @MitUnternehmen()
  @Get("allergene")
  allergene() {
    return Object.entries(ALLERGENE).map(([id, name]) => ({ id, name }));
  }

  @MitUnternehmen()
  @Get("gerichte")
  async gerichte(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) => tx.abfrage("select * from app.gericht where unternehmen_id = $1 order by not aktiv, kategorie, name", [k.unternehmenId]));
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("gerichte")
  async gerichtAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Gericht, body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("insert into app.gericht (unternehmen_id, name, kategorie, allergene, aktiv) values ($1, $2, $3, $4, $5) returning *", [k.unternehmenId, d.name, d.kategorie, [...new Set(d.allergene)], d.aktiv]),
      )
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("gerichte/:id")
  async gerichtAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Gericht, body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("update app.gericht set name = $2, kategorie = $3, allergene = $4, aktiv = $5, aktualisiert_am = now() where id = $1 returning *", [id, d.name, d.kategorie, [...new Set(d.allergene)], d.aktiv]),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Gericht nicht gefunden");
    return r;
  }

  @MitUnternehmen()
  @Get("gerichte/aushang")
  async aushang(@Kontext() k: Anfragekontext, @Res() res: Response) {
    const pdf = await this.db.imKontext(this.kontext(k), async (tx) => {
      const unternehmen = (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!.name;
      const gerichte = await tx.abfrage<{ name: string; kategorie: string; allergene: string[] }>("select name, kategorie, allergene from app.gericht where unternehmen_id = $1 and aktiv order by kategorie, name", [k.unternehmenId]);
      return allergenAushangPdf({ unternehmen, stand: heute(), gerichte });
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="allergene.pdf"');
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  }
}
