import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Post, Put, Res, UnprocessableEntityException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { Datenbank, GEFAEHRDUNGSFAKTOREN, dokumentAblegen, gefaehrdungsbeurteilungPdf, gefahrstoffverzeichnisPdf, heute, neuberechnungEinreihen, type Ablage, type Tx } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { ABLAGE } from "./finanzen.controller.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { WARTESCHLANGE } from "./kern.controller.js";
import { profilNachziehen } from "./profil-sync.js";

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
const Uuid = z.string().uuid();
const DATUM = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const TEXT = (max: number) => z.string().trim().min(1).max(max);
const OPTIONAL = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

const Beurteilung = z
  .object({ arbeitsbereich: TEXT(200), taetigkeiten: z.string().trim().max(5000).default(""), beurteilt_von: TEXT(200), datum: DATUM, mutterschutz: z.boolean().default(false) })
  .strict();
const Gefaehrdung = z
  .object({
    faktor: z.enum(Object.keys(GEFAEHRDUNGSFAKTOREN) as [string, ...string[]]),
    beschreibung: TEXT(2000),
    risiko: z.enum(["gering", "mittel", "hoch"]),
    massnahme: TEXT(2000),
    verantwortlich: OPTIONAL(200),
    umsetzen_bis: DATUM.nullable().optional(),
  })
  .strict();
const Umsetzung = z
  .object({ umgesetzt_am: DATUM.nullable().optional(), wirksam_geprueft_am: DATUM.nullable().optional(), wirksamkeit_notiz: OPTIONAL(2000) })
  .strict();
const Arbeitsmittel = z
  .object({ bezeichnung: TEXT(200), standort: OPTIONAL(200), kennung: OPTIONAL(100), pruefintervall_monate: z.number().int().min(1).max(120).nullable().optional(), naechste_pruefung: DATUM.nullable().optional() })
  .strict();
const Pruefung = z
  .object({ datum: DATUM, ergebnis: z.enum(["bestanden", "maengel", "ausgesondert"]), pruefer: TEXT(200), bemerkung: OPTIONAL(2000), naechste_pruefung: DATUM.nullable().optional() })
  .strict();
const Gefahrstoff = z
  .object({ bezeichnung: TEXT(200), hersteller: OPTIONAL(200), verwendung: OPTIONAL(500), arbeitsbereich: OPTIONAL(200), menge: OPTIONAL(100), sdb_stand: DATUM.nullable().optional() })
  .strict();

interface Datei { originalname: string; mimetype: string; buffer: Buffer; size: number }

/** Monate addieren, Monatsende beachten (31.1. + 1 Monat = 28./29.2.). */
export function plusMonate(datum: string, monate: number): string {
  const [j, m, t] = datum.split("-").map(Number) as [number, number, number];
  const ziel = new Date(Date.UTC(j, m - 1 + monate, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

/**
 * Arbeitsschutz-Dokumentation (Spezifikation 4 E, 6.4): Gefährdungsbeurteilung, Prüfung elektrischer Arbeitsmittel,
 * Gefahrstoffverzeichnis. Fachliche Werte (Prüffristen, Risikoeinstufung) setzt der Betrieb, nicht Amtlos (E-094).
 */
@Controller("v1")
export class ArbeitsschutzController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(ABLAGE) private readonly ablage: Ablage,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  private async offeneBeurteilung(tx: Tx, id: string) {
    const b = await tx.eine<{ abgeschlossen_am: string | null }>("select abgeschlossen_am from app.gefaehrdungsbeurteilung where id = $1", [id]);
    if (!b) throw new NotFoundException("Gefährdungsbeurteilung nicht gefunden");
    if (b.abgeschlossen_am) throw new ConflictException("Die Gefährdungsbeurteilung ist abgeschlossen. Lege für Änderungen eine neue an.");
  }

  // ------------------------------------------------------------ Gefährdungsbeurteilung

  /** Gefährdungsfaktoren (Gliederung nach § 5 Abs. 3 ArbSchG) – für Formulare. */
  @MitUnternehmen()
  @Get("gefaehrdungsfaktoren")
  faktoren() {
    return Object.entries(GEFAEHRDUNGSFAKTOREN).map(([id, titel]) => ({ id, titel }));
  }

  @MitUnternehmen()
  @Get("gefaehrdungsbeurteilungen")
  async beurteilungen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select b.id, b.arbeitsbereich, b.datum, b.beurteilt_von, b.mutterschutz, b.abgeschlossen_am, b.dokument_id,
                count(g.id)::int as gefaehrdungen,
                count(g.id) filter (where g.umgesetzt_am is null)::int as offen,
                count(g.id) filter (where g.umgesetzt_am is null and g.umsetzen_bis < $2::date)::int as ueberfaellig
           from app.gefaehrdungsbeurteilung b left join app.gefaehrdung g on g.beurteilung_id = b.id
          where b.unternehmen_id = $1 group by b.id order by b.datum desc, b.erstellt_am desc`,
        [k.unternehmenId, heute()],
      ),
    );
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("gefaehrdungsbeurteilungen")
  async beurteilungAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Beurteilung, body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          `insert into app.gefaehrdungsbeurteilung (unternehmen_id, arbeitsbereich, taetigkeiten, beurteilt_von, datum, mutterschutz, erstellt_von)
           values ($1, $2, $3, $4, $5, $6, $7) returning *`,
          [k.unternehmenId, d.arbeitsbereich, d.taetigkeiten, d.beurteilt_von, d.datum, d.mutterschutz, k.kontoId],
        ),
      )
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen()
  @Get("gefaehrdungsbeurteilungen/:id")
  async beurteilung(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const b = await tx.eine<Record<string, unknown>>("select * from app.gefaehrdungsbeurteilung where id = $1", [id]);
      if (!b) throw new NotFoundException("Gefährdungsbeurteilung nicht gefunden");
      const gefaehrdungen = await tx.abfrage("select * from app.gefaehrdung where beurteilung_id = $1 order by erstellt_am", [id]);
      return { ...b, gefaehrdungen };
    });
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("gefaehrdungsbeurteilungen/:id")
  async beurteilungAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Beurteilung, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        await this.offeneBeurteilung(tx, id);
        return tx.eine(
          "update app.gefaehrdungsbeurteilung set arbeitsbereich = $2, taetigkeiten = $3, beurteilt_von = $4, datum = $5, mutterschutz = $6 where id = $1 returning *",
          [id, d.arbeitsbereich, d.taetigkeiten, d.beurteilt_von, d.datum, d.mutterschutz],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Delete("gefaehrdungsbeurteilungen/:id")
  @HttpCode(204)
  async beurteilungLoeschen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    await this.db
      .imKontext(this.kontext(k), async (tx) => {
        await this.offeneBeurteilung(tx, id);
        await tx.abfrage("delete from app.gefaehrdung where beurteilung_id = $1", [id]);
        await tx.abfrage("delete from app.gefaehrdungsbeurteilung where id = $1", [id]);
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("gefaehrdungsbeurteilungen/:id/gefaehrdungen")
  async gefaehrdungAnlegen(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Gefaehrdung, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        await this.offeneBeurteilung(tx, id);
        return tx.eine(
          `insert into app.gefaehrdung (unternehmen_id, beurteilung_id, faktor, beschreibung, risiko, massnahme, verantwortlich, umsetzen_bis)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
          [k.unternehmenId, id, d.faktor, d.beschreibung, d.risiko, d.massnahme, d.verantwortlich, d.umsetzen_bis ?? null],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("gefaehrdungen/:id")
  async gefaehrdungAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Gefaehrdung, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const g = await tx.eine<{ beurteilung_id: string }>("select beurteilung_id from app.gefaehrdung where id = $1", [id]);
        if (!g) throw new NotFoundException("Gefährdung nicht gefunden");
        await this.offeneBeurteilung(tx, g.beurteilung_id);
        return tx.eine(
          "update app.gefaehrdung set faktor = $2, beschreibung = $3, risiko = $4, massnahme = $5, verantwortlich = $6, umsetzen_bis = $7 where id = $1 returning *",
          [id, d.faktor, d.beschreibung, d.risiko, d.massnahme, d.verantwortlich, d.umsetzen_bis ?? null],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  /** Umsetzung und Wirksamkeit – auch nach dem Abschluss (die Maßnahmen werden danach umgesetzt). */
  @MitUnternehmen(...SCHREIBEN)
  @Post("gefaehrdungen/:id/umsetzung")
  async umsetzung(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Umsetzung, body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("update app.gefaehrdung set umgesetzt_am = $2, wirksam_geprueft_am = $3, wirksamkeit_notiz = $4 where id = $1 returning *", [
          id, d.umgesetzt_am ?? null, d.wirksam_geprueft_am ?? null, d.wirksamkeit_notiz,
        ]),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Gefährdung nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Delete("gefaehrdungen/:id")
  @HttpCode(204)
  async gefaehrdungLoeschen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    await this.db
      .imKontext(this.kontext(k), async (tx) => {
        const g = await tx.eine<{ beurteilung_id: string }>("select beurteilung_id from app.gefaehrdung where id = $1", [id]);
        if (!g) throw new NotFoundException("Gefährdung nicht gefunden");
        await this.offeneBeurteilung(tx, g.beurteilung_id);
        await tx.abfrage("delete from app.gefaehrdung where id = $1", [id]);
      })
      .catch(uebersetzeDbFehler);
  }

  /**
   * Abschließen: PDF ablegen, offene Pflicht „Gefährdungsbeurteilung“ (und bei Mutterschutz die anlassunabhängige
   * Beurteilung nach MuSchG) mit dem Dokument als Nachweis erledigen.
   */
  @MitUnternehmen(...SCHREIBEN)
  @Post("gefaehrdungsbeurteilungen/:id/abschliessen")
  async beurteilungAbschliessen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const b = await tx.eine<{ arbeitsbereich: string; taetigkeiten: string; beurteilt_von: string; datum: string; mutterschutz: boolean; abgeschlossen_am: string | null }>(
          "select * from app.gefaehrdungsbeurteilung where id = $1 for update",
          [id],
        );
        if (!b) throw new NotFoundException("Gefährdungsbeurteilung nicht gefunden");
        if (b.abgeschlossen_am) throw new ConflictException("Schon abgeschlossen");
        const gefaehrdungen = await tx.abfrage<{ faktor: string; beschreibung: string; risiko: string; massnahme: string; verantwortlich: string | null; umsetzen_bis: string | null; umgesetzt_am: string | null }>(
          "select * from app.gefaehrdung where beurteilung_id = $1 order by erstellt_am",
          [id],
        );
        if (!gefaehrdungen.length) throw new UnprocessableEntityException({ meldung: "Erfasse mindestens eine Gefährdung mit Maßnahme", fehler: [{ feld: "gefaehrdungen", meldung: "mindestens eine" }] });
        const unternehmen = (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!.name;
        const pdf = await gefaehrdungsbeurteilungPdf({ unternehmen, ...b, gefaehrdungen });
        const dok = await dokumentAblegen(tx, this.ablage, {
          unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: `Gefährdungsbeurteilung ${b.arbeitsbereich} ${b.datum}`, art: "nachweis", quelle: "generiert", mime: "application/pdf", inhalt: pdf, endung: "pdf",
        });
        await tx.abfrage("update app.gefaehrdungsbeurteilung set abgeschlossen_am = now(), dokument_id = $2 where id = $1", [id, dok.id]);
        const pflichten = ["arbeitsschutz.gefaehrdungsbeurteilung", ...(b.mutterschutz ? ["personal.mutterschutz_gefaehrdungsbeurteilung"] : [])];
        const erledigt = await tx.abfrage<{ id: string }>(
          `update app.pflicht_instanz set status = 'erledigt', erledigt_am = now(), erledigt_von = $2, erledigt_mit_version_id = pflicht_version_id, aktualisiert_am = now()
            where unternehmen_id = $1 and status = 'offen' and ergebnis = 'gilt' and pflicht_id = any($3) returning id`,
          [k.unternehmenId, k.kontoId, pflichten],
        );
        for (const { id: instanz } of erledigt)
          await tx.abfrage("insert into app.nachweis (unternehmen_id, pflicht_instanz_id, art, dokument_id, notiz, erstellt_von) values ($1, $2, 'generiertes_dokument', $3, $4, $5)", [
            k.unternehmenId, instanz, dok.id, `Gefährdungsbeurteilung „${b.arbeitsbereich}“ vom ${b.datum}`, k.kontoId,
          ]);
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `gefaehrdungsbeurteilung:${id}` });
        return { id, dokument_id: dok.id, erledigte_pflichten: erledigt.length };
      })
      .catch(uebersetzeDbFehler);
  }

  // ------------------------------------------------------------ Elektrische Arbeitsmittel

  @MitUnternehmen()
  @Get("arbeitsmittel")
  async arbeitsmittel(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select a.*, p.datum as letzte_pruefung, p.ergebnis as letztes_ergebnis, p.pruefer as letzter_pruefer,
                (a.ausgesondert_am is null and a.naechste_pruefung < $2::date) as ueberfaellig
           from app.arbeitsmittel a
           left join lateral (select datum, ergebnis, pruefer from app.arbeitsmittel_pruefung where arbeitsmittel_id = a.id order by datum desc, erfasst_am desc limit 1) p on true
          where a.unternehmen_id = $1
          order by (a.ausgesondert_am is not null), a.naechste_pruefung nulls last, a.bezeichnung`,
        [k.unternehmenId, heute()],
      ),
    );
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("arbeitsmittel")
  async arbeitsmittelAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Arbeitsmittel, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const a = await tx.eine(
          `insert into app.arbeitsmittel (unternehmen_id, bezeichnung, standort, kennung, pruefintervall_monate, naechste_pruefung)
           values ($1, $2, $3, $4, $5, $6) returning *`,
          [k.unternehmenId, d.bezeichnung, d.standort, d.kennung, d.pruefintervall_monate ?? null, d.naechste_pruefung ?? null],
        );
        if (await profilNachziehen(tx, k.unternehmenId!, k.kontoId, { "arbeitsschutz.elektrische_geraete": true }))
          await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: "arbeitsmittel" });
        return a;
      })
      .catch(uebersetzeDbFehler);
  }

  /** Prüfung eintragen; nächster Termin: angegeben oder Datum + vom Betrieb festgelegtes Intervall. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("arbeitsmittel/:id/pruefungen")
  async pruefungEintragen(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Pruefung, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const a = await tx.eine<{ pruefintervall_monate: number | null; ausgesondert_am: string | null }>("select pruefintervall_monate, ausgesondert_am from app.arbeitsmittel where id = $1 for update", [id]);
        if (!a) throw new NotFoundException("Arbeitsmittel nicht gefunden");
        if (a.ausgesondert_am) throw new ConflictException("Das Arbeitsmittel ist ausgesondert");
        const p = await tx.eine(
          `insert into app.arbeitsmittel_pruefung (unternehmen_id, arbeitsmittel_id, datum, ergebnis, pruefer, bemerkung, erfasst_von)
           values ($1, $2, $3, $4, $5, $6, $7) returning *`,
          [k.unternehmenId, id, d.datum, d.ergebnis, d.pruefer, d.bemerkung, k.kontoId],
        );
        const naechste = d.ergebnis === "ausgesondert" ? null : (d.naechste_pruefung ?? (a.pruefintervall_monate ? plusMonate(d.datum, a.pruefintervall_monate) : null));
        await tx.abfrage("update app.arbeitsmittel set naechste_pruefung = $2, ausgesondert_am = $3 where id = $1", [id, naechste, d.ergebnis === "ausgesondert" ? d.datum : null]);
        return { ...p, naechste_pruefung: naechste };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen()
  @Get("arbeitsmittel/:id/pruefungen")
  async pruefungen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db.imKontext(this.kontext(k), (tx) => tx.abfrage("select * from app.arbeitsmittel_pruefung where arbeitsmittel_id = $1 order by datum desc, erfasst_am desc", [id]));
  }

  // ------------------------------------------------------------ Gefahrstoffe

  @MitUnternehmen()
  @Get("gefahrstoffe")
  async gefahrstoffe(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage("select * from app.gefahrstoff where unternehmen_id = $1 order by (entfernt_am is not null), bezeichnung", [k.unternehmenId]),
    );
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("gefahrstoffe")
  async gefahrstoffAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Gefahrstoff, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const g = await tx.eine(
          `insert into app.gefahrstoff (unternehmen_id, bezeichnung, hersteller, verwendung, arbeitsbereich, menge, sdb_stand)
           values ($1, $2, $3, $4, $5, $6, $7) returning *`,
          [k.unternehmenId, d.bezeichnung, d.hersteller, d.verwendung, d.arbeitsbereich, d.menge, d.sdb_stand ?? null],
        );
        if (await profilNachziehen(tx, k.unternehmenId!, k.kontoId, { "arbeitsschutz.gefahrstoffe": true }))
          await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: "gefahrstoff" });
        return g;
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("gefahrstoffe/:id")
  async gefahrstoffAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Gefahrstoff, body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          "update app.gefahrstoff set bezeichnung = $2, hersteller = $3, verwendung = $4, arbeitsbereich = $5, menge = $6, sdb_stand = $7 where id = $1 and entfernt_am is null returning *",
          [id, d.bezeichnung, d.hersteller, d.verwendung, d.arbeitsbereich, d.menge, d.sdb_stand ?? null],
        ),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Gefahrstoff nicht gefunden");
    return r;
  }

  /** Sicherheitsdatenblatt (PDF) hochladen; liegt danach unveränderlich bei den Dokumenten. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("gefahrstoffe/:id/sicherheitsdatenblatt")
  @UseInterceptors(FileInterceptor("datei", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  async sicherheitsdatenblatt(@Kontext() k: Anfragekontext, @Param("id") id: string, @UploadedFile() datei: Datei | undefined) {
    pruefe(Uuid, id);
    if (!datei) throw new BadRequestException("Datei fehlt (Feld „datei“)");
    if (datei.buffer.subarray(0, 5).toString() !== "%PDF-") throw new UnprocessableEntityException({ meldung: "Bitte das Sicherheitsdatenblatt als PDF hochladen", fehler: [{ feld: "datei", meldung: "kein PDF" }] });
    const r = await this.db
      .imKontext(this.kontext(k), async (tx) => {
        const g = await tx.eine<{ bezeichnung: string }>("select bezeichnung from app.gefahrstoff where id = $1 and entfernt_am is null", [id]);
        if (!g) return null;
        const dok = await dokumentAblegen(tx, this.ablage, {
          unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: `Sicherheitsdatenblatt ${g.bezeichnung}`.slice(0, 200), art: "sicherheitsdatenblatt", quelle: "upload", mime: "application/pdf", inhalt: datei.buffer, endung: "pdf",
        });
        return tx.eine("update app.gefahrstoff set sdb_dokument_id = $2 where id = $1 returning *", [id, dok.id]);
      })
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Gefahrstoff nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("gefahrstoffe/:id/entfernen")
  async gefahrstoffEntfernen(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const { datum } = pruefe(z.object({ datum: DATUM }).strict(), body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) => tx.eine("update app.gefahrstoff set entfernt_am = $2 where id = $1 and entfernt_am is null returning *", [id, datum]))
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Gefahrstoff nicht gefunden");
    return r;
  }

  /** Aktuelles Gefahrstoffverzeichnis als PDF (wird bei jedem Abruf neu erzeugt, nicht abgelegt). */
  @MitUnternehmen()
  @Get("gefahrstoffe/verzeichnis")
  async verzeichnis(@Kontext() k: Anfragekontext, @Res() res: Response) {
    const pdf = await this.db.imKontext(this.kontext(k), async (tx) => {
      const unternehmen = (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!.name;
      const stoffe = await tx.abfrage<{ bezeichnung: string; hersteller: string | null; verwendung: string | null; arbeitsbereich: string | null; menge: string | null; sdb_stand: string | null; sdb_dokument_id: string | null }>(
        "select * from app.gefahrstoff where unternehmen_id = $1 and entfernt_am is null order by bezeichnung",
        [k.unternehmenId],
      );
      return gefahrstoffverzeichnisPdf({ unternehmen, stand: heute(), stoffe: stoffe.map((s) => ({ ...s, sdb_vorhanden: Boolean(s.sdb_dokument_id) })) });
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="gefahrstoffverzeichnis.pdf"');
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  }
}
