import { Body, ConflictException, Controller, Delete, Get, HttpCode, HttpException, Inject, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { Datenbank } from "@amtlos/server";
import { Kontext, type Anfragekontext } from "./auth.js";
import { pruefe } from "./hilfen.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";

/** Chiffretext im Format der App (amtlos-tresor: JSON mit Nonce und Daten) – der Server prüft nur Form und Größe. */
const Chiffre = (max: number) => z.string().min(20).max(max).regex(/^\{"format":"amtlos-tresor"/, "Kein verschlüsselter Inhalt");
const Schluessel = z.string().min(20).max(4000).regex(/^\{"format":"amtlos-schluessel"/, "Kein verschlüsselter Schlüssel");
const DATEINAME = /^[A-Za-z0-9_-]{4,64}\.[a-z0-9]{1,8}$/;

/** HTTP 402: Synchronisation gehört zu Amtlos Pro (nur geprüft, wenn REVENUECAT_SECRET_KEY gesetzt ist). */
class ProNoetig extends HttpException {
  constructor() {
    super({ statusCode: 402, meldung: "Die Synchronisation gehört zu Amtlos Pro." }, 402);
  }
}

/**
 * Ende-zu-Ende-verschlüsselte Synchronisation der iPhone-App (E-134). Je Konto ein Tresor mit Versionszähler
 * (optimistisches Sperren: wer eine veraltete Version schreibt, bekommt 409 und führt erst zusammen) und Dateien zu
 * Belegen. Der Server sieht nur Chiffretext; Schlüssel und Passwort bleiben auf den Geräten.
 */
@Controller("v1")
export class TresorController {
  private readonly proCache = new Map<string, { pro: boolean; bis: number }>();

  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  /** Pro über RevenueCat prüfen (App-User-ID = Konto-ID); ohne Schlüssel in der Konfiguration keine Prüfung. */
  private async proPruefen(kontoId: string): Promise<void> {
    if (!this.k.REVENUECAT_SECRET_KEY) return;
    const c = this.proCache.get(kontoId);
    if (c && c.bis > Date.now()) {
      if (!c.pro) throw new ProNoetig();
      return;
    }
    let pro = false;
    try {
      const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(kontoId)}`, { headers: { Authorization: `Bearer ${this.k.REVENUECAT_SECRET_KEY}` } });
      const d = (await r.json()) as { subscriber?: { entitlements?: Record<string, { expires_date: string | null }> } };
      const e = d.subscriber?.entitlements?.pro;
      pro = Boolean(e && (e.expires_date === null || Date.parse(e.expires_date) > Date.now()));
    } catch {
      // RevenueCat nicht erreichbar: nicht aussperren
      pro = true;
    }
    if (this.proCache.size > 10_000) this.proCache.clear();
    this.proCache.set(kontoId, { pro, bis: Date.now() + 10 * 60_000 });
    if (!pro) throw new ProNoetig();
  }

  @Get("tresor")
  async holen(@Kontext() k: Anfragekontext) {
    const t = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.eine<{ version: string; schluessel: string; daten: string | null; geaendert_am: string }>("select version, schluessel, daten, geaendert_am from app.tresor where konto_id = $1", [k.kontoId]));
    if (!t) throw new NotFoundException("Noch keine Synchronisation eingerichtet");
    return { version: Number(t.version), schluessel: t.schluessel, daten: t.daten, geaendert_am: t.geaendert_am, konto_id: k.kontoId };
  }

  /** Synchronisation einrichten: verschlüsselter Sync-Schlüssel, noch ohne Daten. */
  @Post("tresor")
  async einrichten(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(z.object({ schluessel: Schluessel }).strict(), body);
    await this.proPruefen(k.kontoId);
    const neu = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.eine<{ version: string }>("insert into app.tresor (konto_id, schluessel) values ($1, $2) on conflict (konto_id) do nothing returning version", [k.kontoId, d.schluessel]));
    if (!neu) throw new ConflictException("Synchronisation ist schon eingerichtet");
    return { version: 0, konto_id: k.kontoId };
  }

  /** Stand hochladen – nur auf der Version, die das Gerät zuletzt gesehen hat; sonst 409 mit der aktuellen Version. */
  @Put("tresor")
  async speichern(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(z.object({ version: z.number().int().min(0), daten: Chiffre(30_000_000) }).strict(), body);
    await this.proPruefen(k.kontoId);
    return this.db.imKontext({ kontoId: k.kontoId }, async (tx) => {
      const r = await tx.eine<{ version: string }>("update app.tresor set daten = $3, version = version + 1, geaendert_am = now() where konto_id = $1 and version = $2 returning version", [k.kontoId, d.version, d.daten]);
      if (r) return { version: Number(r.version) };
      const aktuell = await tx.eine<{ version: string }>("select version from app.tresor where konto_id = $1", [k.kontoId]);
      if (!aktuell) throw new NotFoundException("Noch keine Synchronisation eingerichtet");
      throw new ConflictException({ statusCode: 409, meldung: "Auf einem anderen Gerät wurde inzwischen etwas geändert.", version: Number(aktuell.version) });
    });
  }

  /** Sync-Passwort geändert: den neu verschlüsselten Sync-Schlüssel speichern (die Daten bleiben gleich). */
  @Put("tresor/schluessel")
  @HttpCode(204)
  async schluesselSetzen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(z.object({ schluessel: Schluessel }).strict(), body);
    const r = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.abfrage("update app.tresor set schluessel = $2, geaendert_am = now() where konto_id = $1 returning konto_id", [k.kontoId, d.schluessel]));
    if (!r.length) throw new NotFoundException("Noch keine Synchronisation eingerichtet");
  }

  /** Synchronisation beenden: alles auf dem Server löschen (die Geräte behalten ihre Daten). */
  @Delete("tresor")
  @HttpCode(204)
  async loeschen(@Kontext() k: Anfragekontext) {
    await this.db.imKontext({ kontoId: k.kontoId }, async (tx) => {
      await tx.abfrage("delete from app.tresor_datei where konto_id = $1", [k.kontoId]);
      await tx.abfrage("delete from app.tresor where konto_id = $1", [k.kontoId]);
    });
  }

  @Get("tresor/dateien")
  async dateien(@Kontext() k: Anfragekontext) {
    const r = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.abfrage<{ name: string }>("select name from app.tresor_datei where konto_id = $1 order by name", [k.kontoId]));
    return r.map((x) => x.name);
  }

  /** Datei hochladen; Namen sind unveränderlich – ein zweites Hochladen desselben Namens ändert nichts. */
  @Put("tresor/dateien/:name")
  @HttpCode(204)
  async dateiSpeichern(@Kontext() k: Anfragekontext, @Param("name") name: string, @Body() body: unknown) {
    pruefe(z.string().regex(DATEINAME), name);
    const d = pruefe(z.object({ daten: Chiffre(15_000_000) }).strict(), body);
    await this.proPruefen(k.kontoId);
    await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.abfrage("insert into app.tresor_datei (konto_id, name, daten) values ($1, $2, $3) on conflict (konto_id, name) do nothing", [k.kontoId, name, d.daten]));
  }

  @Get("tresor/dateien/:name")
  async datei(@Kontext() k: Anfragekontext, @Param("name") name: string) {
    pruefe(z.string().regex(DATEINAME), name);
    const r = await this.db.imKontext({ kontoId: k.kontoId }, (tx) => tx.eine<{ daten: string }>("select daten from app.tresor_datei where konto_id = $1 and name = $2", [k.kontoId, name]));
    if (!r) throw new NotFoundException("Datei nicht gefunden");
    return { daten: r.daten };
  }
}
