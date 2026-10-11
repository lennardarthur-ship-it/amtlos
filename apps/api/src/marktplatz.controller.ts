import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, UnprocessableEntityException } from "@nestjs/common";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { Datenbank, QUALIFIKATIONEN, marktplatzAnfrageEinreihen, type GeteilteDaten } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { pruefe, t, uebersetzeDbFehler, type Text } from "./hilfen.js";
import { WARTESCHLANGE } from "./kern.controller.js";

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
const Anfrage = z
  .object({
    nachricht: z.string().trim().min(10).max(4000),
    paket: z.string().trim().max(200).nullable().optional(),
    teilen: z.object({ unternehmen: z.boolean().default(false), offene_pflichten: z.boolean().default(false) }).strict().default({}),
    einwilligung: z.literal(true, { errorMap: () => ({ message: "Ohne Einwilligung wird nichts weitergegeben" }) }),
  })
  .strict();

/**
 * Experten-Marktplatz (6.12): geprüfte Partner; Anfrage mit ausdrücklicher Einwilligung in die Weitergabe genau
 * der gewählten Daten. Keine Zahlung, keine Provision (J-4, E-102).
 */
@Controller("v1")
export class MarktplatzController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  /** Aktive Partner, Partner aus dem eigenen Bundesland (oder bundesweit) zuerst. */
  @MitUnternehmen()
  @Get("partner")
  async partner(@Kontext() k: Anfragekontext, @Query("qualifikation") qualifikation?: string) {
    if (qualifikation && !(QUALIFIKATIONEN as readonly string[]).includes(qualifikation)) throw new UnprocessableEntityException({ meldung: "Qualifikation unbekannt", fehler: [{ feld: "qualifikation", meldung: "unbekannt" }] });
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const p = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
      const land = typeof p?.daten.bundesland === "string" ? p.daten.bundesland : null;
      return tx.abfrage(
        `select id, name, qualifikation, kanzlei, regionen, beschreibung, pakete, website, zulassung_geprueft_am,
                (cardinality(regionen) = 0 or $2::text = any(regionen)) as in_der_naehe
           from katalog.partner where aktiv and zulassung_geprueft_am is not null and ($1::text is null or qualifikation = $1)
          order by (cardinality(regionen) = 0 or $2::text = any(regionen)) desc, name`,
        [qualifikation ?? null, land],
      );
    });
  }

  @MitUnternehmen()
  @Get("marktplatz/anfragen")
  async anfragen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select a.id, a.paket, a.nachricht, a.geteilte_daten, a.einwilligung_am, a.versendet_am, a.erstellt_am, p.name as partner, p.qualifikation
           from app.marktplatz_anfrage a join katalog.partner p on p.id = a.partner_id where a.unternehmen_id = $1 order by a.erstellt_am desc`,
        [k.unternehmenId],
      ),
    );
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("partner/:id/anfrage")
  async anfrage(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(z.string().uuid(), id);
    const d = pruefe(Anfrage, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const partner = await tx.eine<{ pakete: { titel: string }[] }>("select pakete from katalog.partner where id = $1 and aktiv and zulassung_geprueft_am is not null", [id]);
        if (!partner) throw new NotFoundException("Partner nicht gefunden");
        if (d.paket && !partner.pakete.some((p) => p.titel === d.paket)) throw new UnprocessableEntityException({ meldung: "Paket unbekannt", fehler: [{ feld: "paket", meldung: "unbekannt" }] });
        const konto = (await tx.eine<{ anzeigename: string; email: string }>("select anzeigename, email from app.konto where id = $1", [k.kontoId]))!;
        const daten: GeteilteDaten = { kontakt: { name: konto.anzeigename, email: konto.email } };
        if (d.teilen.unternehmen) {
          const u = (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!;
          const p = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
          daten.unternehmen = { name: u.name, rechtsform: p?.daten.rechtsform, branchen: p?.daten["taetigkeit.branchen"], beschaeftigte: p?.daten["beschaeftigte.gesamt"], bundesland: p?.daten.bundesland };
        }
        if (d.teilen.offene_pflichten) {
          const offen = await tx.abfrage<{ titel: Text }>(
            `select distinct on (pi.pflicht_id) pv.daten->'titel' as titel from app.pflicht_instanz pi join katalog.pflicht_version_anzeige pv on pv.id = pi.pflicht_version_id
              where pi.unternehmen_id = $1 and pi.status = 'offen' and pi.ergebnis = 'gilt' order by pi.pflicht_id limit 30`,
            [k.unternehmenId],
          );
          daten.offene_pflichten = offen.map((o) => t(o.titel, "de") ?? "").filter(Boolean);
        }
        const r = await tx.eine<{ id: string }>(
          "insert into app.marktplatz_anfrage (unternehmen_id, partner_id, konto_id, paket, nachricht, geteilte_daten, einwilligung_am) values ($1, $2, $3, $4, $5, $6, now()) returning id, geteilte_daten, einwilligung_am",
          [k.unternehmenId, id, k.kontoId, d.paket ?? null, d.nachricht, daten],
        );
        await marktplatzAnfrageEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, anfrageId: r!.id });
        return r;
      })
      .catch(uebersetzeDbFehler);
  }
}
