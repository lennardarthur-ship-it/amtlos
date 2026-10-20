import { createHash, randomBytes } from "node:crypto";
import { Body, ConflictException, Controller, Get, HttpException, Inject, NotFoundException, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { Datenbank, einladungEinreihen, heute, pgFehlercode } from "@amtlos/server";
import { Kontext, Oeffentlich, type Anfragekontext } from "./auth.js";
import { heuteUebersicht, type Aufgabe } from "./heute.js";
import { emailBestaetigt, pruefe, seite, t, uebersetzeDbFehler, type Text } from "./hilfen.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";
import { WARTESCHLANGE } from "./kern.controller.js";
import { EINLADUNG_GUELTIG_TAGE } from "./team.controller.js";

const SCHLUESSEL = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MandantNeu = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().toLowerCase().email("E-Mail-Adresse ungültig").max(200),
    marke: z.string().regex(SCHLUESSEL).nullable().optional(),
  })
  .strict();
const Host = z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9.-]+(:\d{1,5})?$/, "Hostname ungültig");

/** Zeilen für die Übersicht: nur, was für Zähler, Ampel und nächste Frist nötig ist. */
interface Zeile { pflicht_id: string; periode: string; kategorie: string; anzeige_status: string; faellig_am: string | null; schwere: Aufgabe["schwere"]; titel: Text }
interface Stand {
  id: string; name: string; rolle: string; marke: string | null; profil_vorhanden: boolean; hat_inhaber: boolean;
  einladung_email: string | null; einladung_laeuft_ab: string | null; einladung_status: "offen" | "abgelaufen" | "angenommen" | "widerrufen" | null;
}

/** Fehler der Mandanten-Funktionen (0020) in verständliche Antworten übersetzen. */
function mandantenFehler(e: unknown): never {
  switch (pgFehlercode(e)) {
    case "P0006":
      throw new HttpException({ statusCode: 429, meldung: "Heute wurden schon sehr viele Mandanten angelegt oder eingeladen. Bitte versuche es morgen wieder oder schreib uns." }, 429);
    case "P0007":
      throw new ConflictException("Der Mandant hat schon einen Inhaber – Einladungen verschickt er jetzt selbst.");
    case "P0002":
      throw new NotFoundException("Mandant nicht gefunden");
    default:
      return uebersetzeDbFehler(e);
  }
}

/**
 * Kanzlei- und Partnerfunktionen (Abschnitt 10, E-105/E-106): Übersicht über alle Unternehmen, in denen die Person
 * Mitglied ist (z. B. Steuerberatung mit vielen Mandanten), Mandanten anlegen, Marke zum Hostnamen.
 */
@Controller("v1")
export class KanzleiController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  /**
   * Je Unternehmen Ampel, Zähler, die dringendste offene Pflicht und (für die Kanzlei) der Stand der Inhaber-Einladung.
   * Zwei Abfragen für alle Unternehmen (M9) über Systemfunktionen, die nur Unternehmen mit Mitgliedschaft liefern.
   * Seitenweise (limit/cursor, X-Gesamt), optional gefiltert (suche: Name; filter: ueberfaellig | angabe_fehlt | einladung).
   */
  @Get("mandanten")
  async mandanten(
    @Kontext() k: Anfragekontext,
    @Query() q: { limit?: string; cursor?: string; suche?: string; filter?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const s = seite(q);
    const suche = (q.suche ?? "").trim().toLocaleLowerCase("de").slice(0, 100);
    const filter = pruefe(z.enum(["alle", "ueberfaellig", "angabe_fehlt", "einladung"]).default("alle"), q.filter || undefined);
    const stichtag = heute();
    const ergebnis = await this.db.imKontext({ kontoId: k.kontoId }, async (tx) => {
      const liste = await tx.abfrage<Stand>("select * from app.mandanten_stand()");
      const zeilen = liste.length ? await tx.abfrage<Zeile & { unternehmen_id: string }>("select * from app.mandanten_aufgaben($1)", [liste.map((u) => u.id)]) : [];
      const jeUnternehmen = new Map<string, Zeile[]>();
      for (const z of zeilen) jeUnternehmen.set(z.unternehmen_id, [...(jeUnternehmen.get(z.unternehmen_id) ?? []), z]);
      return liste.map((u) => {
        const eigene = jeUnternehmen.get(u.id) ?? [];
        const ue = heuteUebersicht(eigene, stichtag, 1);
        const n = ue.als_naechstes[0];
        const z = n ? eigene.find((x) => x.pflicht_id === n.pflicht_id && x.periode === n.periode) : undefined;
        return {
          id: u.id,
          name: u.name,
          rolle: u.rolle,
          marke: u.marke,
          profil_vorhanden: u.profil_vorhanden,
          zaehler: ue.zaehler,
          ampel: ue.ampel,
          naechste: z ? { pflicht_id: z.pflicht_id, periode: z.periode, titel: t(z.titel, k.sprache), faellig_am: z.faellig_am, status: z.anzeige_status } : null,
          // Stand der Inhaber-Einladung (nur für die Kanzlei, solange es keinen Inhaber gibt)
          einladung: u.rolle === "steuerberater" && !u.hat_inhaber && u.einladung_status
            ? { email: u.einladung_email, laeuft_ab: u.einladung_laeuft_ab, status: u.einladung_status, erneuerbar: true }
            : null,
        };
      });
    });
    const gefiltert = ergebnis
      .filter((u) => !suche || u.name.toLocaleLowerCase("de").includes(suche))
      .filter((u) => filter === "alle" || (filter === "einladung" ? Boolean(u.einladung && u.einladung.status !== "angenommen") : u.zaehler[filter] > 0))
      // Dringendes zuerst: Überfälliges, dann fehlende Angaben, dann Name
      .sort((a, b) => b.zaehler.ueberfaellig - a.zaehler.ueberfaellig || b.zaehler.angabe_fehlt - a.zaehler.angabe_fehlt || a.name.localeCompare(b.name, "de"));
    res.setHeader("X-Gesamt", String(gefiltert.length));
    const teil = gefiltert.slice(s.versatz, s.versatz + s.limit);
    if (s.versatz + teil.length < gefiltert.length) res.setHeader("X-Naechster-Cursor", String(s.versatz + teil.length));
    return teil;
  }

  /** Mandant anlegen: Kanzlei wird Steuerberatung, der Mandant erhält eine Einladung als Inhaber (Link einmal zurück). */
  @Post("mandanten")
  async mandantAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(MandantNeu, body);
    await emailBestaetigt(this.db, k.kontoId);
    const token = randomBytes(32).toString("base64url");
    return this.db
      .imKontext({ kontoId: k.kontoId }, async (tx) => {
        const m = d.marke ? await tx.eine<{ id: string }>("select id from katalog.marke where schluessel = $1 and aktiv", [d.marke]) : undefined;
        const r = (await tx.eine<{ unternehmen_id: string; einladung_id: string; laeuft_ab: string }>(
          "select * from app.mandant_anlegen($1, $2, $3, $4, $5, $6, $7)",
          [d.name, m?.id ?? null, d.email, createHash("sha256").update(token).digest(), EINLADUNG_GUELTIG_TAGE, k.sprache, this.k.MANDANTEN_JE_TAG],
        ))!;
        await tx.abfrage("select set_config('amtlos.unternehmen_id', $1, true)", [r.unternehmen_id]);
        await einladungEinreihen(this.boss, tx, { einladungId: r.einladung_id, token });
        return { id: r.unternehmen_id, name: d.name, rolle: "steuerberater", einladung: { email: d.email, laeuft_ab: r.laeuft_ab, link: `${this.k.WEB_URL}/einladung/${token}` } };
      })
      .catch(mandantenFehler);
  }

  /**
   * Inhaber-Einladung erneut senden (M6): solange das Unternehmen keinen Inhaber hat, darf die Kanzlei eine neue
   * Einladung verschicken (alte Links werden ungültig), optional an eine korrigierte Adresse.
   */
  @Post("mandanten/:id/einladung-erneuern")
  async einladungErneuern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(z.string().uuid(), id);
    const { email } = pruefe(z.object({ email: z.string().trim().toLowerCase().email("E-Mail-Adresse ungültig").max(254).optional() }).strict(), body ?? {});
    await emailBestaetigt(this.db, k.kontoId);
    const token = randomBytes(32).toString("base64url");
    return this.db
      .imKontext({ kontoId: k.kontoId }, async (tx) => {
        const r = (await tx.eine<{ einladung_id: string; email: string; laeuft_ab: string }>(
          "select * from app.mandant_einladung_erneuern($1, $2, $3, $4, $5, $6)",
          [id, email ?? null, createHash("sha256").update(token).digest(), EINLADUNG_GUELTIG_TAGE, k.sprache, this.k.MANDANTEN_JE_TAG],
        ))!;
        await tx.abfrage("select set_config('amtlos.unternehmen_id', $1, true)", [id]);
        await einladungEinreihen(this.boss, tx, { einladungId: r.einladung_id, token });
        return { email: r.email, laeuft_ab: r.laeuft_ab, link: `${this.k.WEB_URL}/einladung/${token}` };
      })
      .catch(mandantenFehler);
  }

  /** Marke zum Hostnamen (öffentlich; nur Darstellungsangaben, keine Mandantendaten). */
  @Oeffentlich()
  @Get("marke")
  async marke(@Query("host") host?: string) {
    const h = pruefe(Host, host ?? "").replace(/:\d+$/, "");
    const m = await this.db.imKontext({}, (tx) =>
      tx.eine("select schluessel, name, farbe_hell, farbe_dunkel, logo_url, support_email from katalog.marke where aktiv and $1 = any(hosts)", [h]),
    );
    if (!m) throw new NotFoundException("Keine Marke für diesen Host");
    return m;
  }
}
