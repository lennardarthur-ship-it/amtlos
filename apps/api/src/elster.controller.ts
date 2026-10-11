import { Body, Controller, Get, HttpException, Inject, NotFoundException, Param, Post } from "@nestjs/common";
import { Datenbank, ElsterNichtVerfuegbar, type ElsterGateway, type ElsterVorgang } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { fragebogenVorbereitung } from "./fragebogen.js";

export const ELSTER = Symbol("ELSTER");
const VORGAENGE: ElsterVorgang[] = ["fragebogen_steuerliche_erfassung", "ust_voranmeldung", "zusammenfassende_meldung", "kassenmeldung"];

@Controller("v1")
export class ElsterController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(ELSTER) private readonly elster: ElsterGateway,
  ) {}

  /** Ist die direkte Übermittlung verfügbar? Wenn nicht: warum, und welcher Weg stattdessen. */
  @MitUnternehmen()
  @Get("elster/status")
  status() {
    return this.elster.status();
  }

  /** Übermittlung im Auftrag der Nutzerin/des Nutzers. Derzeit 501 mit Begründung (E-086). */
  @MitUnternehmen("inhaber", "admin", "steuerberater")
  @Post("elster/:vorgang")
  async uebermitteln(@Param("vorgang") vorgang: string, @Body() body: unknown) {
    if (!VORGAENGE.includes(vorgang as ElsterVorgang)) throw new NotFoundException("Unbekannter Vorgang");
    try {
      return await this.elster.uebermitteln(vorgang as ElsterVorgang, (body ?? {}) as Record<string, unknown>);
    } catch (e) {
      if (e instanceof ElsterNichtVerfuegbar) throw new HttpException({ statusCode: 501, message: e.status.grund, ...e.status }, 501);
      throw e;
    }
  }

  /** Angaben aus dem Profil für den Fragebogen zur steuerlichen Erfassung (Vorbereitung, kein amtliches Formular). */
  @MitUnternehmen()
  @Get("gruendung/fragebogen")
  async fragebogen(@Kontext() k: Anfragekontext) {
    const { name, daten } = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => ({
      name: (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!.name,
      daten: (await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]))?.daten ?? {},
    }));
    return { ...fragebogenVorbereitung(name, daten, k.sprache), uebermittlung: this.elster.status() };
  }
}
