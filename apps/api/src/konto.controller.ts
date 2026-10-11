import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, Inject, Post, Req, ServiceUnavailableException } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { Datenbank, aboStand, checkoutStarten, portalOeffnen, pruefeStripeSignatur, stripeEreignis, type StripeKlient } from "@amtlos/server";
import { Kontext, MitUnternehmen, Oeffentlich, OhneAbo, type Anfragekontext } from "./auth.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";

export const STRIPE = Symbol("STRIPE");

/** Tabellen mit Unternehmensbezug, die in den Datenexport gehören (Lesen über RLS als Mitglied). */
const EXPORT_TABELLEN = [
  "profil_version", "ereignis", "pflicht_instanz", "nachweis", "dokument", "erinnerung", "benachrichtigung", "einladung",
  "beschaeftigter", "unterweisung", "unterweisung_teilnahme", "zeiteintrag", "gefaehrdungsbeurteilung", "gefaehrdung", "arbeitsmittel",
  "arbeitsmittel_pruefung", "gefahrstoff", "verarbeitung", "tom", "dienstleister", "betroffenenanfrage", "datenpanne", "online_check",
  "messpunkt", "messung", "gericht", "behoerdenbrief", "marktplatz_anfrage", "kunde", "rechnung", "beleg", "kasse", "abo",
];

/**
 * Konto, Abo und Löschen (E-113, E-114): Abo-Stand, Stripe-Checkout und Kundenportal, Stripe-Webhook,
 * Datenexport (DSGVO Art. 20), Unternehmen und Konto löschen (Art. 17).
 */
@Controller("v1")
export class KontoController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
    @Inject(STRIPE) private readonly stripe: StripeKlient | null,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  @MitUnternehmen()
  @Get("abo")
  async abo(@Kontext() k: Anfragekontext) {
    const stand = await this.db.imKontext(this.kontext(k), (tx) => aboStand(tx, k.unternehmenId!));
    return { ...stand, bezahlen_moeglich: Boolean(this.stripe), plan_name: "Amtlos", testtage: this.k.ABO_TESTTAGE };
  }

  /** Startet den Bezahlvorgang bei Stripe; die Seite leitet auf die zurückgegebene Adresse weiter. */
  @MitUnternehmen("inhaber", "admin")
  @OhneAbo()
  @Post("abo/checkout")
  async checkout(@Kontext() k: Anfragekontext) {
    if (!this.stripe || !this.k.STRIPE_PREIS_ID) throw new ServiceUnavailableException("Bezahlen ist noch nicht eingerichtet");
    const [konto, u] = await this.db.imKontext(this.kontext(k), async (tx) => [
      (await tx.eine<{ email: string }>("select email from app.konto where id = $1", [k.kontoId]))!,
      (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!,
    ]);
    const url = await checkoutStarten(this.db, this.stripe, { unternehmenId: k.unternehmenId!, kontoId: k.kontoId, email: konto.email, name: u.name, preisId: this.k.STRIPE_PREIS_ID, webUrl: this.k.WEB_URL });
    return { url };
  }

  /** Kundenportal (Rechnungen, Zahlungsmittel, Kündigung). */
  @MitUnternehmen("inhaber", "admin")
  @OhneAbo()
  @Post("abo/portal")
  async portal(@Kontext() k: Anfragekontext) {
    if (!this.stripe) throw new ServiceUnavailableException("Bezahlen ist noch nicht eingerichtet");
    const url = await portalOeffnen(this.db, this.stripe, { unternehmenId: k.unternehmenId!, kontoId: k.kontoId, webUrl: this.k.WEB_URL });
    if (!url) throw new ConflictException("Noch kein Abo – zuerst den Bezahlvorgang starten");
    return { url };
  }

  /** Stripe-Webhook: Signatur über den rohen Body, dann idempotente Verarbeitung. */
  @Oeffentlich()
  @Post("stripe/webhook")
  @HttpCode(200)
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Body() body: unknown) {
    if (!this.k.STRIPE_WEBHOOK_SECRET) throw new ServiceUnavailableException("Webhook nicht eingerichtet");
    const roh = req.rawBody?.toString("utf8") ?? "";
    if (!pruefeStripeSignatur(roh, req.headers["stripe-signature"] as string | undefined, this.k.STRIPE_WEBHOOK_SECRET)) throw new BadRequestException("Signatur ungültig");
    const e = pruefe(z.object({ id: z.string().min(1), type: z.string().min(1), data: z.object({ object: z.record(z.unknown()) }) }), body);
    const ergebnis = await stripeEreignis(this.db, e);
    return { ergebnis };
  }

  /** Datenexport (DSGVO Art. 20): alle Daten des Unternehmens als JSON; Dateien bleiben einzeln abrufbar. */
  @MitUnternehmen("inhaber", "admin")
  @Get("export")
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="amtlos-export.json"')
  async exportieren(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const daten: Record<string, unknown> = {
        exportiert_am: new Date().toISOString(),
        unternehmen: await tx.eine("select id, name, erstellt_am from app.unternehmen where id = $1", [k.unternehmenId]),
        mitglieder: await tx.abfrage("select k.anzeigename, k.email, m.rolle from app.mitgliedschaft m join app.konto k on k.id = m.konto_id where m.unternehmen_id = $1", [k.unternehmenId]),
      };
      for (const t of EXPORT_TABELLEN) {
        const da = await tx.eine("select 1 from information_schema.tables where table_schema = 'app' and table_name = $1", [t]);
        if (da) daten[t] = await tx.abfrage(`select * from app.${t} where unternehmen_id = $1`, [k.unternehmenId]);
      }
      return daten;
    });
  }

  /** Unternehmen löschen (nur Inhaber): sofort unsichtbar, endgültig nach 30 Tagen (Worker); Nachweise mit Aufbewahrungspflicht bleiben. */
  @MitUnternehmen("inhaber")
  @OhneAbo()
  @Delete("unternehmen")
  @HttpCode(204)
  async unternehmenLoeschen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { name } = pruefe(z.object({ name: z.string().min(1) }).strict(), body ?? {});
    await this.db
      .imKontext(this.kontext(k), async (tx) => {
        const u = await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]);
        if (!u || u.name !== name) throw new BadRequestException("Zur Bestätigung den Namen des Unternehmens genau so eingeben");
        await tx.abfrage("select app.unternehmen_loeschen($1)", [k.unternehmenId]);
      })
      .catch(uebersetzeDbFehler);
  }

  /** Konto löschen: nur, wenn kein aktives Unternehmen mehr dazugehört. */
  @Post("ich/loeschen")
  @HttpCode(204)
  async kontoLoeschen(@Kontext() k: Anfragekontext) {
    await this.db
      .imKontext({ kontoId: k.kontoId }, (tx) => tx.abfrage("select app.konto_loeschen()"))
      .catch((e: unknown) => {
        if ((e as { code?: string }).code === "P0005") throw new ConflictException("Zuerst alle Unternehmen löschen oder verlassen");
        throw e;
      });
  }
}
