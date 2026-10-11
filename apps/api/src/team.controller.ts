import { createHash, randomBytes } from "node:crypto";
import { Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post, Put } from "@nestjs/common";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { Datenbank, einladungEinreihen, pgFehlercode } from "@amtlos/server";
import { Kontext, MitUnternehmen, OhneAbo, type Anfragekontext } from "./auth.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";
import { WARTESCHLANGE } from "./kern.controller.js";

/** Einladungen gelten sieben Tage (Produktentscheidung, kein Rechtsinhalt; E-079). */
export const EINLADUNG_GUELTIG_TAGE = 7;

const EinladungNeu = z
  .object({
    email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben").max(254),
    rolle: z.enum(["mitarbeiter", "steuerberater", "admin"]),
  })
  .strict();
const Annehmen = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Link unvollständig") }).strict();
const Uuid = z.string().uuid();
const RolleNeu = z.object({ rolle: z.enum(["inhaber", "mitarbeiter", "steuerberater", "admin"]) }).strict();

const hash = (token: string) => createHash("sha256").update(token).digest();

@Controller("v1")
export class TeamController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  /** Wer ist im Team? Offene Einladungen sehen nur Inhaber und Admins (fremde E-Mail-Adressen). */
  @MitUnternehmen()
  @Get("team")
  async team(@Kontext() k: Anfragekontext) {
    return this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
      const mitglieder = await tx.abfrage<{ konto_id: string; anzeigename: string; email: string; rolle: string }>(
        `select m.konto_id, k.anzeigename, k.email, m.rolle from app.mitgliedschaft m join app.konto k on k.id = m.konto_id
          where m.unternehmen_id = $1 order by (m.rolle = 'inhaber') desc, k.anzeigename`,
        [k.unternehmenId],
      );
      const verwaltet = k.rolle === "inhaber" || k.rolle === "admin";
      const einladungen = verwaltet
        ? await tx.abfrage(
            `select id, email, rolle, erstellt_am, laeuft_ab from app.einladung
              where unternehmen_id = $1 and angenommen_am is null and widerrufen_am is null and laeuft_ab > now()
              order by erstellt_am desc`,
            [k.unternehmenId],
          )
        : [];
      return { mitglieder: mitglieder.map((m) => ({ ...m, ich: m.konto_id === k.kontoId })), einladungen, darf_verwalten: verwaltet };
    });
  }

  /** Einladen. Der Link wird einmal zurückgegeben (zum Weitergeben) und per E-Mail verschickt. */
  @MitUnternehmen("inhaber", "admin")
  @Post("einladungen")
  async einladen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { email, rolle } = pruefe(EinladungNeu, body);
    const token = randomBytes(32).toString("base64url");
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const schonDa = await tx.eine(
          "select 1 from app.mitgliedschaft m join app.konto k on k.id = m.konto_id where m.unternehmen_id = $1 and k.email = $2",
          [k.unternehmenId, email],
        );
        if (schonDa) throw new ConflictException("Diese Person ist schon im Team");
        // Eine neue Einladung ersetzt eine offene an dieselbe Adresse (der alte Link wird ungültig).
        await tx.abfrage(
          "update app.einladung set widerrufen_am = now() where unternehmen_id = $1 and email = $2 and angenommen_am is null and widerrufen_am is null",
          [k.unternehmenId, email],
        );
        const e = await tx.eine<{ id: string; laeuft_ab: string }>(
          `insert into app.einladung (unternehmen_id, email, rolle, token_hash, laeuft_ab, erstellt_von, sprache)
           values ($1, $2, $3, $4, now() + make_interval(days => $5), $6, $7) returning id, laeuft_ab`,
          [k.unternehmenId, email, rolle, hash(token), EINLADUNG_GUELTIG_TAGE, k.kontoId, k.sprache],
        );
        await einladungEinreihen(this.boss, tx, { einladungId: e!.id, token });
        return { id: e!.id, email, rolle, laeuft_ab: e!.laeuft_ab, link: `${this.k.WEB_URL}/einladung/${token}` };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen("inhaber", "admin")
  @Delete("einladungen/:id")
  @HttpCode(204)
  async widerrufen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    const eid = pruefe(Uuid, id);
    const n = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      tx.abfrage("update app.einladung set widerrufen_am = now() where id = $1 and angenommen_am is null and widerrufen_am is null returning id", [eid]),
    );
    if (!n.length) throw new NotFoundException("Einladung nicht gefunden");
  }

  /** Für die Annahmeseite: wohin lädt der Link ein? Ohne Mitgliedschaft, nur mit gültigem Token. */
  @Post("einladungen/vorschau")
  @HttpCode(200)
  async vorschau(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { token } = pruefe(Annehmen, body);
    const v = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.eine("select * from app.einladung_vorschau($1)", [hash(token)]));
    if (!v) throw new NotFoundException("Einladung ungültig oder abgelaufen");
    return v;
  }

  @Post("einladungen/annehmen")
  @HttpCode(200)
  async annehmen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { token } = pruefe(Annehmen, body);
    try {
      const r = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.eine<{ id: string }>("select app.einladung_annehmen($1) as id", [hash(token)]));
      return { unternehmen_id: r!.id };
    } catch (e) {
      if (pgFehlercode(e) === "P0002") throw new NotFoundException("Einladung ungültig oder abgelaufen");
      if (pgFehlercode(e) === "P0003") throw new ForbiddenException("Diese Einladung gilt für eine andere E-Mail-Adresse");
      throw e;
    }
  }

  /** Mitglied entfernen. Inhaber kann nur ein Inhaber entfernen; der letzte Inhaber bleibt immer. */
  @MitUnternehmen("inhaber", "admin")
  @Delete("team/:kontoId")
  @HttpCode(204)
  async entfernen(@Kontext() k: Anfragekontext, @Param("kontoId") kontoId: string) {
    const id = pruefe(Uuid, kontoId);
    try {
      await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const m = await tx.eine<{ rolle: string }>("select rolle from app.mitgliedschaft where unternehmen_id = $1 and konto_id = $2", [k.unternehmenId, id]);
        if (!m) throw new NotFoundException("Mitglied nicht gefunden");
        if (m.rolle === "inhaber" && k.rolle !== "inhaber") throw new ForbiddenException("Nur ein Inhaber kann einen Inhaber entfernen");
        await tx.abfrage("delete from app.mitgliedschaft where unternehmen_id = $1 and konto_id = $2", [k.unternehmenId, id]);
      });
    } catch (e) {
      if (pgFehlercode(e) === "P0004") throw new ConflictException("Das Unternehmen braucht mindestens einen Inhaber");
      uebersetzeDbFehler(e);
    }
  }

  /** Rolle ändern. Zur Inhaberin/zum Inhaber machen und Inhaber ändern darf nur ein Inhaber; der letzte Inhaber bleibt. */
  @MitUnternehmen("inhaber", "admin")
  @Put("team/:kontoId")
  async rolleAendern(@Kontext() k: Anfragekontext, @Param("kontoId") kontoId: string, @Body() body: unknown) {
    const id = pruefe(Uuid, kontoId);
    const { rolle } = pruefe(RolleNeu, body);
    try {
      return await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const m = await tx.eine<{ rolle: string }>("select rolle from app.mitgliedschaft where unternehmen_id = $1 and konto_id = $2", [k.unternehmenId, id]);
        if (!m) throw new NotFoundException("Mitglied nicht gefunden");
        if ((m.rolle === "inhaber" || rolle === "inhaber") && k.rolle !== "inhaber") throw new ForbiddenException("Nur ein Inhaber kann Inhaber ernennen oder ändern");
        await tx.abfrage("update app.mitgliedschaft set rolle = $3 where unternehmen_id = $1 and konto_id = $2", [k.unternehmenId, id, rolle]);
        return { konto_id: id, rolle };
      });
    } catch (e) {
      if (pgFehlercode(e) === "P0004") throw new ConflictException("Das Unternehmen braucht mindestens einen Inhaber");
      return uebersetzeDbFehler(e);
    }
  }

  /** Selbst austreten (jede Rolle). Der letzte Inhaber kann nicht austreten. */
  @MitUnternehmen()
  @OhneAbo()
  @Post("team/verlassen")
  @HttpCode(204)
  async verlassen(@Kontext() k: Anfragekontext) {
    try {
      await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) => tx.abfrage("select app.team_verlassen()"));
    } catch (e) {
      if (pgFehlercode(e) === "P0004") throw new ConflictException("Das Unternehmen braucht mindestens einen Inhaber");
      uebersetzeDbFehler(e);
    }
  }
}
