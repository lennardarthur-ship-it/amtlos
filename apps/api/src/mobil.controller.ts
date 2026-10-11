import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { SignJWT } from "jose";
import { z } from "zod";
import { Datenbank } from "@amtlos/server";
import { Kontext, MitUnternehmen, Oeffentlich, type Anfragekontext } from "./auth.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";

const Geraet = z
  .object({
    push_token: z.string().trim().min(10).max(300).regex(/^[\x21-\x7e]+$/, "Token ungültig"),
    plattform: z.enum(["ios", "android"]),
    name: z.string().trim().max(100).default(""),
  })
  .strict();
const Einstellungen = z
  .object({
    kanaele: z
      .array(z.object({ kanal: z.enum(["email", "push"]), aktiv: z.boolean(), vorlauf_tage: z.array(z.number().int().min(0).max(90)).min(1).max(5) }).strict())
      .min(1)
      .max(2),
  })
  .strict()
  .refine((d) => new Set(d.kanaele.map((k) => k.kanal)).size === d.kanaele.length, { message: "Jeder Kanal nur einmal", path: ["kanaele"] });

/**
 * Mobile App (Abschnitt 10, E-108): Geräte für Push, Benachrichtigungseinstellungen je Unternehmen und – nur in der
 * Entwicklungsumgebung – ein Anmeldetoken für die App ohne Identity-Provider.
 */
@Controller("v1")
export class MobilController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  @Get("geraete")
  async geraete(@Kontext() k: Anfragekontext) {
    return this.db.imKontext({ kontoId: k.kontoId }, (tx) =>
      tx.abfrage("select id, plattform, name, erstellt_am, zuletzt_am from app.geraet where konto_id = $1 and aktiv order by zuletzt_am desc", [k.kontoId]),
    );
  }

  /** Gerät registrieren (Push-Token der App). Ein Token gehört immer dem zuletzt angemeldeten Konto. */
  @Post("geraete")
  async registrieren(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Geraet, body);
    const id = await this.db
      .imKontext({ kontoId: k.kontoId }, async (tx) => (await tx.eine<{ id: string }>("select app.geraet_registrieren($1, $2, $3) as id", [d.push_token, d.plattform, d.name]))!.id)
      .catch(uebersetzeDbFehler);
    return { id, plattform: d.plattform, name: d.name };
  }

  /** Abmelden (z. B. beim Abmelden in der App): keine Pushes mehr an dieses Gerät. */
  @Delete("geraete/:id")
  @HttpCode(204)
  async abmelden(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(z.string().uuid(), id);
    const r = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.abfrage("update app.geraet set aktiv = false where id = $1 and aktiv returning id", [id]));
    if (!r.length) throw new NotFoundException("Gerät nicht gefunden");
  }

  /** Eigene Erinnerungskanäle in diesem Unternehmen (ohne Eintrag: E-Mail 14 und 3 Tage vorher, Push mit Gerät). */
  @MitUnternehmen()
  @Get("benachrichtigungen/einstellungen")
  async einstellungen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
      const zeilen = await tx.abfrage<{ kanal: string; aktiv: boolean; vorlauf_tage: number[] }>(
        `select kanal, aktiv, array(select extract(day from v)::int from unnest(vorlauf) v order by 1 desc) as vorlauf_tage
           from app.benachrichtigung_einstellung where unternehmen_id = $1 and konto_id = $2 and kanal in ('email', 'push') order by kanal`,
        [k.unternehmenId, k.kontoId],
      );
      const geraet = await tx.eine("select 1 from app.geraet where konto_id = $1 and aktiv", [k.kontoId]);
      const standard = (kanal: string) => ({ kanal, aktiv: kanal === "email" || Boolean(geraet), vorlauf_tage: [14, 3] });
      return {
        eigene: zeilen.length > 0,
        geraet_vorhanden: Boolean(geraet),
        kanaele: ["email", "push"].map((kanal) => zeilen.find((z2) => z2.kanal === kanal) ?? standard(kanal)),
      };
    });
  }

  @MitUnternehmen()
  @Put("benachrichtigungen/einstellungen")
  async einstellungenSetzen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Einstellungen, body);
    await this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        for (const e of d.kanaele)
          await tx.abfrage(
            `insert into app.benachrichtigung_einstellung (unternehmen_id, konto_id, kanal, aktiv, vorlauf)
             values ($1, $2, $3, $4, (select array_agg(make_interval(days => t)) from unnest($5::int[]) t))
             on conflict (unternehmen_id, konto_id, kanal) do update set aktiv = excluded.aktiv, vorlauf = excluded.vorlauf`,
            [k.unternehmenId, k.kontoId, e.kanal, e.aktiv, [...new Set(e.vorlauf_tage)]],
          );
      })
      .catch(uebersetzeDbFehler);
    return this.einstellungen(k);
  }

  /**
   * Nur Entwicklung und Test (AUTH_MODUS=dev): Token für die App, wie es sonst der Identity-Provider ausstellt.
   * In staging und prod ist AUTH_MODUS=dev durch die Konfigurationsprüfung verboten.
   */
  @Oeffentlich()
  @Post("dev/token")
  async devToken(@Body() body: unknown) {
    if (this.k.AUTH_MODUS !== "dev" || !this.k.DEV_JWT_SECRET || !["dev", "test"].includes(this.k.UMGEBUNG)) throw new ForbiddenException("Nur in der Entwicklungsumgebung");
    const { kennung } = pruefe(z.object({ kennung: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,60}$/, "Kennung: 2–60 Zeichen a–z, 0–9, . _ -") }).strict(), body);
    const token = await new SignJWT({ email: `${kennung}@example.org`, name: kennung })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(kennung)
      .setIssuer("amtlos-dev")
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(new TextEncoder().encode(this.k.DEV_JWT_SECRET));
    return { token, laeuft_ab_in: 12 * 3600 };
  }
}
