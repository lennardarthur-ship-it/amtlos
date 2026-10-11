import { createHash, randomBytes } from "node:crypto";
import { Body, Controller, Get, Inject, NotFoundException, Post, Query } from "@nestjs/common";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { Datenbank, einladungEinreihen, heute } from "@amtlos/server";
import { Kontext, Oeffentlich, type Anfragekontext } from "./auth.js";
import { heuteUebersicht, type Aufgabe } from "./heute.js";
import { pruefe, t, uebersetzeDbFehler, type Text } from "./hilfen.js";
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
   * Je Unternehmen Ampel, Zähler und die dringendste offene Pflicht. Eine Transaktion; der Unternehmenskontext
   * wird je Unternehmen gesetzt, damit RLS wie bei jedem Einzelaufruf greift.
   */
  @Get("mandanten")
  async mandanten(@Kontext() k: Anfragekontext) {
    const stichtag = heute();
    return this.db.imKontext({ kontoId: k.kontoId }, async (tx) => {
      const liste = await tx.abfrage<{ id: string; name: string; rolle: string; marke: string | null }>(
        `select u.id, u.name, m.rolle, mk.name as marke from app.mitgliedschaft m join app.unternehmen u on u.id = m.unternehmen_id
           left join katalog.marke mk on mk.id = u.marke_id
          where m.konto_id = $1 and u.geloescht_am is null order by u.name limit 500`,
        [k.kontoId],
      );
      const ergebnis = [];
      for (const u of liste) {
        await tx.abfrage("select set_config('amtlos.unternehmen_id', $1, true)", [u.id]);
        const zeilen = await tx.abfrage<Zeile>(
          `select pi.pflicht_id, pi.periode, pv.daten->>'kategorie' as kategorie, pi.anzeige_status, pi.faellig_am::text,
                  pv.daten->'sanktion'->>'schwere' as schwere, pv.daten->'titel' as titel
             from app.pflicht_instanz_anzeige pi join katalog.pflicht_version_anzeige pv on pv.id = pi.pflicht_version_id
            where pi.unternehmen_id = $1 and pi.status <> 'entfallen'`,
          [u.id],
        );
        const ue = heuteUebersicht(zeilen, stichtag, 1);
        const n = ue.als_naechstes[0];
        const z = n ? zeilen.find((x) => x.pflicht_id === n.pflicht_id && x.periode === n.periode) : undefined;
        const profil = await tx.eine<{ version: number }>("select max(version)::int as version from app.profil_version where unternehmen_id = $1", [u.id]);
        ergebnis.push({
          ...u,
          profil_vorhanden: Boolean(profil?.version),
          zaehler: ue.zaehler,
          ampel: ue.ampel,
          naechste: z ? { pflicht_id: z.pflicht_id, periode: z.periode, titel: t(z.titel, k.sprache), faellig_am: z.faellig_am, status: z.anzeige_status } : null,
        });
      }
      // Dringendes zuerst: Überfälliges, dann fehlende Angaben, dann Name
      return ergebnis.sort((a, b) => b.zaehler.ueberfaellig - a.zaehler.ueberfaellig || b.zaehler.angabe_fehlt - a.zaehler.angabe_fehlt || a.name.localeCompare(b.name, "de"));
    });
  }

  /** Mandant anlegen: Kanzlei wird Steuerberatung, der Mandant erhält eine Einladung als Inhaber (Link einmal zurück). */
  @Post("mandanten")
  async mandantAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(MandantNeu, body);
    const token = randomBytes(32).toString("base64url");
    return this.db
      .imKontext({ kontoId: k.kontoId }, async (tx) => {
        const m = d.marke ? await tx.eine<{ id: string }>("select id from katalog.marke where schluessel = $1 and aktiv", [d.marke]) : undefined;
        const r = (await tx.eine<{ unternehmen_id: string; einladung_id: string; laeuft_ab: string }>(
          "select * from app.mandant_anlegen($1, $2, $3, $4, $5, $6)",
          [d.name, m?.id ?? null, d.email, createHash("sha256").update(token).digest(), EINLADUNG_GUELTIG_TAGE, k.sprache],
        ))!;
        await tx.abfrage("select set_config('amtlos.unternehmen_id', $1, true)", [r.unternehmen_id]);
        await einladungEinreihen(this.boss, tx, { einladungId: r.einladung_id, token });
        return { id: r.unternehmen_id, name: d.name, rolle: "steuerberater", einladung: { email: d.email, laeuft_ab: r.laeuft_ab, link: `${this.k.WEB_URL}/einladung/${token}` } };
      })
      .catch(uebersetzeDbFehler);
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
