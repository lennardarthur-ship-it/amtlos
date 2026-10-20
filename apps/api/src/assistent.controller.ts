import { Body, Controller, Get, Inject, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { StandardKalender, plusMonate } from "@amtlos/fristen";
import { auswerten, entscheidendeSaetze } from "@amtlos/rules-engine";
import { Datenbank, frageBeantworten, heute, ladeAktivenKatalog, ladeEreignisse, profilZuFakten, type KatalogPflicht, type KatalogRegelwert } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { pruefe, seite, seitenkopf, t, type Text } from "./hilfen.js";

type Radarinfo = { wahrscheinlichkeit?: string; erwartet_ab?: string | null; vorbereitung?: Text[] };

/**
 * Rechtsänderungs-Radar (Spezifikation 5), Benachrichtigungen „Was ändert sich für dich?“ und „Frag Amtlos“ (6.10).
 */
@Controller("v1")
export class AssistentController {
  constructor(@Inject(Datenbank) private readonly db: Datenbank) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  /**
   * Radar: geplante/beschlossene Regeln, die dich betreffen würden (mit Wahrscheinlichkeit und Vorbereitung),
   * in Kraft gesetzte Regeln, die in den nächsten 24 Monaten gelten werden, und kommende Werte (z. B. Mindestlohn).
   */
  @MitUnternehmen()
  @Get("radar")
  async radar(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const aktiv = await ladeAktivenKatalog(tx);
      const profil = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
      if (!aktiv || !profil) return { eintraege: [], werte: [] };
      const stichtag = heute();
      const bis = plusMonate(stichtag, 24);
      const kalender = new StandardKalender();
      const fakten = profilZuFakten(profil.daten);
      const ereignisse = await ladeEreignisse(tx, k.unternehmenId!);
      const lauf = (tag: string) => auswerten({ katalog: aktiv.katalog, fakten, ereignisse, stichtag: tag, kalender });
      const jetzt = lauf(stichtag);
      const pflicht = new Map(aktiv.katalog.pflichten.map((p) => [p.id, p as unknown as Record<string, unknown> & { titel: Text; kurz: Text; erklaerung: Text; status_recht: string; gueltig_ab?: string | null; radar?: Radarinfo }]));

      const eintrag = (e: (typeof jetzt)[number], art: "radar" | "kommend") => {
        const p = pflicht.get(e.pflicht_id)!;
        const r = p.radar ?? {};
        return {
          art,
          pflicht_id: e.pflicht_id,
          titel: t(p.titel, k.sprache),
          kurz: t(p.kurz, k.sprache),
          erklaerung: t(p.erklaerung, k.sprache),
          status_recht: p.status_recht,
          wahrscheinlichkeit: art === "kommend" ? "sicher" : r.wahrscheinlichkeit ?? null,
          erwartet_ab: art === "kommend" ? p.gueltig_ab ?? null : r.erwartet_ab ?? null,
          vorbereitung: (r.vorbereitung ?? []).map((v) => t(v, k.sprache)),
          betroffen: e.ergebnis === "gilt" ? "ja" : "vielleicht",
          warum: entscheidendeSaetze(e.begruendung, k.sprache),
        };
      };
      const eintraege = jetzt.filter((e) => e.radar && e.ergebnis !== "gilt_nicht").map((e) => eintrag(e, "radar"));

      // In Kraft, aber erst später gültig: am Tag des Inkrafttretens auswerten
      const kommendeTage = [...new Set(aktiv.katalog.pflichten.filter((p) => p.status_recht === "in_kraft" && p.gueltig_ab && p.gueltig_ab > stichtag && p.gueltig_ab <= bis).map((p) => p.gueltig_ab!))];
      for (const tag of kommendeTage)
        for (const e of lauf(tag))
          if (!e.radar && e.ergebnis !== "gilt_nicht" && pflicht.get(e.pflicht_id)?.gueltig_ab === tag) eintraege.push(eintrag(e, "kommend"));

      // Kommende Werte, die geltende Pflichten verwenden
      const genutzt = new Set(jetzt.filter((e) => !e.radar && e.ergebnis !== "gilt_nicht").flatMap((e) => e.regelwerte_genutzt.map((r) => r.id)));
      const regelwerte = aktiv.katalog.regelwerte as unknown as KatalogRegelwert[];
      const gueltigAm = (id: string, tag: string) =>
        regelwerte.filter((r) => r.id === id && (!r.gueltig_ab || r.gueltig_ab <= tag) && (!r.gueltig_bis || r.gueltig_bis >= tag)).sort((a, b) => (b.gueltig_ab ?? "").localeCompare(a.gueltig_ab ?? "") || b.version - a.version)[0];
      const werte = regelwerte
        .filter((r) => genutzt.has(r.id) && r.gueltig_ab && r.gueltig_ab > stichtag && r.gueltig_ab <= bis)
        .map((r) => ({ id: r.id, bezeichnung: t(r.bezeichnung, k.sprache), wert_bisher: gueltigAm(r.id, stichtag)?.wert ?? null, wert_neu: r.wert, einheit: r.einheit, gueltig_ab: r.gueltig_ab, status_recht: r.status_recht }))
        .sort((a, b) => (a.gueltig_ab ?? "").localeCompare(b.gueltig_ab ?? ""));

      eintraege.sort((a, b) => (a.erwartet_ab ?? "9999").localeCompare(b.erwartet_ab ?? "9999"));
      return { eintraege, werte };
    });
  }

  @MitUnternehmen()
  @Get("benachrichtigungen")
  async benachrichtigungen(@Kontext() k: Anfragekontext, @Query() q: { limit?: string; cursor?: string }, @Res({ passthrough: true }) res: Response) {
    // Standard wie bisher 50 (Heute zeigt nur die neuesten); mit limit/cursor seitenweise bis 200 (M9)
    const s = seite({ limit: q.limit ?? "50", cursor: q.cursor });
    const zeilen = await this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage<{ gesamt: number }>(
        `select id, art, titel, text, link, gelesen_am, erstellt_am, count(*) over () as gesamt from app.benachrichtigung
          where unternehmen_id = $1 and konto_id = $2 order by gelesen_am is not null, erstellt_am desc, id limit $3 offset $4`,
        [k.unternehmenId, k.kontoId, s.limit, s.versatz],
      ),
    );
    return seitenkopf(res, zeilen, s);
  }

  /** Als gelesen markieren: bestimmte IDs oder alle. */
  @MitUnternehmen()
  @Post("benachrichtigungen/gelesen")
  async gelesen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { ids } = pruefe(z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).strict(), body ?? {});
    const r = await this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        "update app.benachrichtigung set gelesen_am = now() where unternehmen_id = $1 and konto_id = $2 and gelesen_am is null and ($3::uuid[] is null or id = any($3)) returning id",
        [k.unternehmenId, k.kontoId, ids ?? null],
      ),
    );
    return { gelesen: r.length };
  }

  /**
   * Frag Amtlos: sucht im aktiven Katalog (Pflichten und Regelwerte) und antwortet nur mit deren Texten, Quellen und
   * Prüfstatus. Pflichten, die für das Unternehmen gelten, werden bevorzugt. Keine Speicherung der Frage (E-100).
   */
  @MitUnternehmen()
  @Post("frage")
  async frage(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { frage } = pruefe(z.object({ frage: z.string().trim().min(3).max(500) }).strict(), body);
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const aktiv = await ladeAktivenKatalog(tx);
      if (!aktiv) return { art: "unsicher", treffer: [], regelwerte: [], ki_formuliert: false };
      const pruefung = await tx.abfrage<{ pflicht_id: string; pruef_status: string; geprueft_am: string | null }>(
        `select pv.pflicht_id, pv.pruef_status, pr.geprueft_am::text
           from katalog.aktives_release r join katalog.release_inhalt ri on ri.release_id = r.id and ri.objekt_art = 'pflicht_version'
           join katalog.pflicht_version_anzeige pv on pv.id = ri.objekt_id join katalog.pflicht_version_pruefung pr on pr.id = pv.id`,
      );
      const status = new Map(pruefung.map((p) => [p.pflicht_id, p]));
      const instanzen = await tx.abfrage<{ pflicht_id: string; ergebnis: string }>(
        "select distinct pflicht_id, ergebnis from app.pflicht_instanz where unternehmen_id = $1 and status <> 'entfallen'",
        [k.unternehmenId],
      );
      const pflichten = (aktiv.katalog.pflichten as unknown as KatalogPflicht[]).map((p) => ({ ...p, pruef_status: status.get(p.id)?.pruef_status, geprueft_am: status.get(p.id)?.geprueft_am ?? null }));
      return frageBeantworten(frage, { pflichten, regelwerte: aktiv.katalog.regelwerte as unknown as KatalogRegelwert[] }, {
        stichtag: heute(),
        sprache: k.sprache,
        geltend: new Set(instanzen.filter((i) => i.ergebnis === "gilt").map((i) => i.pflicht_id)),
        nichtGeltend: new Set(instanzen.filter((i) => i.ergebnis === "gilt_nicht").map((i) => i.pflicht_id)),
      });
    });
  }
}
