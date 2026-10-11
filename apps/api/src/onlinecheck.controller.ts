import { Body, Controller, Get, HttpException, HttpStatus, Inject, NotFoundException, Param, Post, UnprocessableEntityException } from "@nestjs/common";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { CheckFehler, Datenbank, neuberechnungEinreihen, normalisiereUrl, onlineCheck, type CheckProfil } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";
import { WARTESCHLANGE } from "./kern.controller.js";
import { profilNachziehen } from "./profil-sync.js";

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
const Uuid = z.string().uuid();

/** Profilangaben → Prüfumfang (z. B. Kündigungsbutton nur bei Abos). Unbekannt = nicht prüfen. */
export function checkProfil(p: Record<string, unknown>): CheckProfil {
  const liste = (k: string) => (Array.isArray(p[k]) ? (p[k] as string[]) : []);
  const kanaele = liste("vertrieb.kanaele");
  const produkte = liste("produkte.arten");
  return {
    b2c: liste("kunden.segmente").includes("b2c"),
    fernabsatz: kanaele.some((k) => ["onlineshop", "marktplatz", "abo", "app"].includes(k)),
    abo: kanaele.includes("abo"),
    kapitalgesellschaft: ["ug", "gmbh", "gmbh_co_kg"].includes(String(p["rechtsform"])),
    waren: produkte.some((x) => ["physisch", "elektrogeraete", "batterien", "kosmetik", "lebensmittel"].includes(x)),
  };
}

/**
 * Online-Compliance-Check (6.8): technischer Check einer Website, kein Rechtsgutachten (E-097).
 * Läuft synchron mit engen Limits (wenige Seiten, Zeit- und Größenlimit, SSRF-Schutz).
 */
@Controller("v1")
export class OnlineCheckController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  @MitUnternehmen()
  @Get("onlinecheck")
  async liste(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage("select id, url, status, fehler, erstellt_am, befunde from app.online_check where unternehmen_id = $1 order by erstellt_am desc limit 10", [k.unternehmenId]),
    );
  }

  @MitUnternehmen()
  @Get("onlinecheck/:id")
  async einer(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    const r = await this.db.imKontext(this.kontext(k), (tx) => tx.eine("select * from app.online_check where id = $1", [id]));
    if (!r) throw new NotFoundException("Check nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("onlinecheck")
  async starten(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { url } = pruefe(z.object({ url: z.string().trim().min(3).max(500) }).strict(), body);
    let ziel: URL;
    try {
      ziel = normalisiereUrl(url);
    } catch {
      throw new UnprocessableEntityException({ meldung: "Bitte eine Web-Adresse wie https://www.beispiel.de eingeben", fehler: [{ feld: "url", meldung: "ungültige Adresse" }] });
    }
    const { profil, heute } = await this.db.imKontext(this.kontext(k), async (tx) => {
      const p = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
      const n = await tx.eine<{ n: number }>("select count(*)::int as n from app.online_check where unternehmen_id = $1 and erstellt_am > now() - interval '1 day'", [k.unternehmenId]);
      return { profil: p?.daten ?? {}, heute: n?.n ?? 0 };
    });
    if (heute >= this.k.ONLINECHECK_JE_TAG) throw new HttpException("Für heute sind keine weiteren Checks möglich", HttpStatus.TOO_MANY_REQUESTS);

    let ergebnis: { status: "ok" | "fehler"; fehler: string | null; url: string; seiten: string[]; befunde: unknown[] };
    try {
      const r = await onlineCheck(ziel.toString(), checkProfil(profil), { privateNetzeErlaubt: this.k.ONLINECHECK_PRIVATE_NETZE === "erlaubt" });
      ergebnis = { status: "ok", fehler: null, url: r.url, seiten: r.seiten, befunde: r.befunde };
    } catch (e) {
      ergebnis = { status: "fehler", fehler: e instanceof CheckFehler ? e.code : "nicht_erreichbar", url: ziel.toString(), seiten: [], befunde: [] };
    }
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const r = await tx.eine(
          "insert into app.online_check (unternehmen_id, url, status, fehler, seiten, befunde, erfasst_von) values ($1, $2, $3, $4, $5, $6, $7) returning *",
          [k.unternehmenId, ergebnis.url, ergebnis.status, ergebnis.fehler, JSON.stringify(ergebnis.seiten), JSON.stringify(ergebnis.befunde), k.kontoId],
        );
        if (ergebnis.status === "ok" && (await profilNachziehen(tx, k.unternehmenId!, k.kontoId, { "online.website": true })))
          await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: "onlinecheck" });
        return r;
      })
      .catch(uebersetzeDbFehler);
  }
}
