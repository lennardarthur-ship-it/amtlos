import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Post, Put, Res, UnprocessableEntityException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { Datenbank, SCHUTZZIELE, datenpanneMeldungPdf, datenschutzDokumentationPdf, dokumentAblegen, heute, neuberechnungEinreihen, type Ablage, type Tx } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { ortsdatum, plusMonate } from "./datum.js";
import { ABLAGE } from "./finanzen.controller.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { WARTESCHLANGE } from "./kern.controller.js";
import { profilNachziehen } from "./profil-sync.js";

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
const Uuid = z.string().uuid();
const DATUM = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const Zeitpunkt = z.string().datetime({ offset: true });
const TEXT = (max: number) => z.string().trim().min(1).max(max);
const FREI = (max: number) => z.string().trim().max(max).default("");
const OPTIONAL = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

const Verarbeitung = z
  .object({
    bezeichnung: TEXT(200), zweck: FREI(2000), rechtsgrundlage: FREI(500), betroffene: FREI(1000), datenarten: FREI(1000),
    empfaenger: FREI(1000), drittland: FREI(500), loeschfrist: FREI(500), tom_hinweis: FREI(500),
  })
  .strict();
const Tom = z
  .object({ schutzziel: z.enum(Object.keys(SCHUTZZIELE) as [string, ...string[]]), massnahme: TEXT(1000), umgesetzt_am: DATUM.nullable().optional(), verantwortlich: OPTIONAL(200) })
  .strict();
const Dienstleister = z
  .object({ name: TEXT(200), leistung: FREI(500), auftragsverarbeitung: z.boolean().default(true), avv_datum: DATUM.nullable().optional(), drittland: FREI(200) })
  .strict();
const ANFRAGE_ARTEN = ["auskunft", "berichtigung", "loeschung", "einschraenkung", "uebertragbarkeit", "widerspruch", "sonstiges"] as const;
const Anfrage = z.object({ eingang_am: DATUM, art: z.enum(ANFRAGE_ARTEN), person: TEXT(200), notiz: OPTIONAL(2000) }).strict();
const PanneNeu = z.object({ entdeckt_am: Zeitpunkt.optional(), beschreibung: TEXT(5000) }).strict();
const PanneAendern = z
  .object({
    beschreibung: TEXT(5000), datenarten: FREI(2000), betroffene_anzahl: FREI(500), folgen: FREI(5000), massnahmen: FREI(5000),
    risiko: z.enum(["kein_risiko", "risiko", "hohes_risiko"]).nullable().optional(), begruendung: OPTIONAL(5000),
  })
  .strict();

interface Datei { originalname: string; mimetype: string; buffer: Buffer; size: number }
interface Panne {
  id: string; entdeckt_am: Date; beschreibung: string; datenarten: string; betroffene_anzahl: string; folgen: string; massnahmen: string;
  risiko: string | null; begruendung: string | null; gemeldet_am: Date | null; aktenzeichen: string | null; abgeschlossen_am: Date | null;
}

/** Vorschläge für das VVT aus dem Profil – nur Bezeichnungen, Inhalte trägt der Betrieb ein (E-095). */
const VORSCHLAEGE: { wenn: (p: Record<string, unknown>) => boolean; bezeichnung: string }[] = [
  { wenn: (p) => arten(p).includes("kundendaten"), bezeichnung: "Kundenverwaltung und Rechnungen" },
  { wenn: (p) => arten(p).includes("beschaeftigtendaten") || Number(p["beschaeftigte.gesamt"] ?? 0) > 0, bezeichnung: "Personalverwaltung" },
  { wenn: (p) => arten(p).includes("gesundheitsdaten"), bezeichnung: "Gesundheitsdaten" },
  { wenn: (p) => arten(p).includes("videoueberwachung"), bezeichnung: "Videoüberwachung" },
  { wenn: (p) => arten(p).includes("newsletter"), bezeichnung: "Newsletter" },
  { wenn: (p) => arten(p).includes("tracking"), bezeichnung: "Website und Reichweitenmessung" },
  { wenn: (p) => p["ki.nutzung"] === true, bezeichnung: "Einsatz von KI-Werkzeugen" },
];
function arten(p: Record<string, unknown>): string[] {
  return Array.isArray(p["datenverarbeitung.arten"]) ? (p["datenverarbeitung.arten"] as string[]) : [];
}

@Controller("v1")
export class DatenschutzController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(ABLAGE) private readonly ablage: Ablage,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  private async ereignis(tx: Tx, k: Anfragekontext, typ: string, datum: string, payload: Record<string, unknown>) {
    const e = await tx.eine<{ id: string }>("insert into app.ereignis (unternehmen_id, typ, eingetreten_am, payload, quelle, erfasst_von) values ($1, $2, $3, $4, 'nutzer', $5) returning id", [
      k.unternehmenId, typ, datum, payload, k.kontoId,
    ]);
    await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `${typ}:${e!.id}` });
    return e!.id;
  }

  /** Offene Pflicht-Instanzen erledigen und das Dokument als Nachweis anhängen. */
  private async erledigen(tx: Tx, k: Anfragekontext, pflichten: { id: string; periode?: string }[], dokumentId: string | null, notiz: string) {
    let n = 0;
    for (const p of pflichten) {
      const r = await tx.abfrage<{ id: string }>(
        `update app.pflicht_instanz set status = 'erledigt', erledigt_am = now(), erledigt_von = $2, erledigt_mit_version_id = pflicht_version_id, aktualisiert_am = now()
          where unternehmen_id = $1 and status = 'offen' and ergebnis = 'gilt' and pflicht_id = $3 and ($4::text is null or periode = $4) returning id`,
        [k.unternehmenId, k.kontoId, p.id, p.periode ?? null],
      );
      for (const { id } of r)
        await tx.abfrage("insert into app.nachweis (unternehmen_id, pflicht_instanz_id, art, dokument_id, notiz, erstellt_von) values ($1, $2, $3, $4, $5, $6)", [
          k.unternehmenId, id, dokumentId ? "generiertes_dokument" : "bestaetigung", dokumentId, notiz, k.kontoId,
        ]);
      n += r.length;
    }
    return n;
  }

  // ------------------------------------------------------------ VVT

  @MitUnternehmen()
  @Get("verarbeitungen")
  async verarbeitungen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) => tx.abfrage("select * from app.verarbeitung where unternehmen_id = $1 order by not aktiv, bezeichnung", [k.unternehmenId]));
  }

  @MitUnternehmen()
  @Get("verarbeitungen/vorschlaege")
  async vorschlaege(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const p = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
      const vorhanden = new Set((await tx.abfrage<{ bezeichnung: string }>("select bezeichnung from app.verarbeitung where unternehmen_id = $1", [k.unternehmenId])).map((v) => v.bezeichnung));
      return VORSCHLAEGE.filter((v) => v.wenn(p?.daten ?? {}) && !vorhanden.has(v.bezeichnung)).map((v) => v.bezeichnung);
    });
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("verarbeitungen")
  async verarbeitungAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Verarbeitung, body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          `insert into app.verarbeitung (unternehmen_id, bezeichnung, zweck, rechtsgrundlage, betroffene, datenarten, empfaenger, drittland, loeschfrist, tom_hinweis)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
          [k.unternehmenId, d.bezeichnung, d.zweck, d.rechtsgrundlage, d.betroffene, d.datenarten, d.empfaenger, d.drittland, d.loeschfrist, d.tom_hinweis],
        ),
      )
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("verarbeitungen/:id")
  async verarbeitungAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Verarbeitung.extend({ aktiv: z.boolean().default(true) }), body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          `update app.verarbeitung set bezeichnung = $2, zweck = $3, rechtsgrundlage = $4, betroffene = $5, datenarten = $6, empfaenger = $7, drittland = $8,
                  loeschfrist = $9, tom_hinweis = $10, aktiv = $11, aktualisiert_am = now() where id = $1 returning *`,
          [id, d.bezeichnung, d.zweck, d.rechtsgrundlage, d.betroffene, d.datenarten, d.empfaenger, d.drittland, d.loeschfrist, d.tom_hinweis, d.aktiv],
        ),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Verarbeitung nicht gefunden");
    return r;
  }

  // ------------------------------------------------------------ TOM

  @MitUnternehmen()
  @Get("tom")
  async toms(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) => tx.abfrage("select * from app.tom where unternehmen_id = $1 order by schutzziel, erstellt_am", [k.unternehmenId]));
  }

  @MitUnternehmen()
  @Get("tom/schutzziele")
  schutzziele() {
    return Object.entries(SCHUTZZIELE).map(([id, titel]) => ({ id, titel }));
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("tom")
  async tomAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Tom, body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("insert into app.tom (unternehmen_id, schutzziel, massnahme, umgesetzt_am, verantwortlich) values ($1, $2, $3, $4, $5) returning *", [
          k.unternehmenId, d.schutzziel, d.massnahme, d.umgesetzt_am ?? null, d.verantwortlich,
        ]),
      )
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("tom/:id")
  async tomAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Tom, body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("update app.tom set schutzziel = $2, massnahme = $3, umgesetzt_am = $4, verantwortlich = $5 where id = $1 returning *", [id, d.schutzziel, d.massnahme, d.umgesetzt_am ?? null, d.verantwortlich]),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Maßnahme nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Delete("tom/:id")
  @HttpCode(204)
  async tomLoeschen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    const r = await this.db.imKontext(this.kontext(k), (tx) => tx.abfrage("delete from app.tom where id = $1 returning id", [id]));
    if (!r.length) throw new NotFoundException("Maßnahme nicht gefunden");
  }

  // ------------------------------------------------------------ Dienstleister / AVV

  @MitUnternehmen()
  @Get("dienstleister")
  async dienstleister(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select *, (auftragsverarbeitung and beendet_am is null and avv_datum is null and avv_dokument_id is null) as avv_fehlt
           from app.dienstleister where unternehmen_id = $1 order by (beendet_am is not null), name`,
        [k.unternehmenId],
      ),
    );
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("dienstleister")
  async dienstleisterAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Dienstleister, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const r = await tx.eine(
          "insert into app.dienstleister (unternehmen_id, name, leistung, auftragsverarbeitung, avv_datum, drittland) values ($1, $2, $3, $4, $5, $6) returning *",
          [k.unternehmenId, d.name, d.leistung, d.auftragsverarbeitung, d.avv_datum ?? null, d.drittland],
        );
        if (d.auftragsverarbeitung && (await profilNachziehen(tx, k.unternehmenId!, k.kontoId, { "datenschutz.dienstleister": true })))
          await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: "dienstleister" });
        return r;
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("dienstleister/:id")
  async dienstleisterAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Dienstleister, body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("update app.dienstleister set name = $2, leistung = $3, auftragsverarbeitung = $4, avv_datum = $5, drittland = $6 where id = $1 and beendet_am is null returning *", [
          id, d.name, d.leistung, d.auftragsverarbeitung, d.avv_datum ?? null, d.drittland,
        ]),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Dienstleister nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("dienstleister/:id/avv")
  @UseInterceptors(FileInterceptor("datei", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  async avvHochladen(@Kontext() k: Anfragekontext, @Param("id") id: string, @UploadedFile() datei: Datei | undefined) {
    pruefe(Uuid, id);
    if (!datei) throw new BadRequestException("Datei fehlt (Feld „datei“)");
    if (datei.buffer.subarray(0, 5).toString() !== "%PDF-") throw new UnprocessableEntityException({ meldung: "Bitte den Vertrag als PDF hochladen", fehler: [{ feld: "datei", meldung: "kein PDF" }] });
    const r = await this.db
      .imKontext(this.kontext(k), async (tx) => {
        const x = await tx.eine<{ name: string }>("select name from app.dienstleister where id = $1 and beendet_am is null", [id]);
        if (!x) return null;
        const dok = await dokumentAblegen(tx, this.ablage, {
          unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: `AVV ${x.name}`.slice(0, 200), art: "vertrag", quelle: "upload", mime: "application/pdf", inhalt: datei.buffer, endung: "pdf",
        });
        return tx.eine("update app.dienstleister set avv_dokument_id = $2, avv_datum = coalesce(avv_datum, $3) where id = $1 returning *", [id, dok.id, heute()]);
      })
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Dienstleister nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("dienstleister/:id/beenden")
  async dienstleisterBeenden(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const { datum } = pruefe(z.object({ datum: DATUM }).strict(), body);
    const r = await this.db.imKontext(this.kontext(k), (tx) => tx.eine("update app.dienstleister set beendet_am = $2 where id = $1 and beendet_am is null returning *", [id, datum])).catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Dienstleister nicht gefunden");
    return r;
  }

  // ------------------------------------------------------------ Dokumentation (VVT + TOM + Dienstleister)

  private async dokumentation(tx: Tx, k: Anfragekontext) {
    const unternehmen = (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!.name;
    const verarbeitungen = await tx.abfrage<{ bezeichnung: string; zweck: string; rechtsgrundlage: string; betroffene: string; datenarten: string; empfaenger: string; drittland: string; loeschfrist: string; tom_hinweis: string }>(
      "select * from app.verarbeitung where unternehmen_id = $1 and aktiv order by bezeichnung",
      [k.unternehmenId],
    );
    const tom = await tx.abfrage<{ schutzziel: string; massnahme: string; umgesetzt_am: string | null; verantwortlich: string | null }>("select * from app.tom where unternehmen_id = $1 order by erstellt_am", [k.unternehmenId]);
    const dienstleister = await tx.abfrage<{ name: string; leistung: string; auftragsverarbeitung: boolean; avv_datum: string | null; avv_dokument_id: string | null; drittland: string }>(
      "select * from app.dienstleister where unternehmen_id = $1 and beendet_am is null order by name",
      [k.unternehmenId],
    );
    return { unternehmen, stand: heute(), verarbeitungen, tom, dienstleister: dienstleister.map((d) => ({ ...d, avv_vorhanden: Boolean(d.avv_dokument_id) })) };
  }

  @MitUnternehmen()
  @Get("datenschutz/dokumentation")
  async dokumentationAnsehen(@Kontext() k: Anfragekontext, @Res() res: Response) {
    const pdf = await this.db.imKontext(this.kontext(k), async (tx) => datenschutzDokumentationPdf(await this.dokumentation(tx, k)));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="verzeichnis-verarbeitungstaetigkeiten.pdf"');
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  }

  /**
   * Stand ablegen: PDF als unveränderliches Dokument; erledigt VVT (mind. eine Verarbeitung), TOM (mind. eine umgesetzte
   * Maßnahme) und AVV (alle Auftragsverarbeiter mit Vertrag) mit dem Dokument als Nachweis.
   */
  @MitUnternehmen(...SCHREIBEN)
  @Post("datenschutz/dokumentation")
  async dokumentationAblegen(@Kontext() k: Anfragekontext) {
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const d = await this.dokumentation(tx, k);
        if (!d.verarbeitungen.length) throw new UnprocessableEntityException({ meldung: "Erfasse mindestens eine Verarbeitungstätigkeit", fehler: [{ feld: "verarbeitungen", meldung: "mindestens eine" }] });
        const pdf = await datenschutzDokumentationPdf(d);
        const dok = await dokumentAblegen(tx, this.ablage, {
          unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: `Verzeichnis der Verarbeitungstätigkeiten ${d.stand}`, art: "nachweis", quelle: "generiert", mime: "application/pdf", inhalt: pdf, endung: "pdf",
        });
        const pflichten = [{ id: "datenschutz.vvt" }];
        if (d.tom.some((t) => t.umgesetzt_am)) pflichten.push({ id: "datenschutz.tom" });
        const av = d.dienstleister.filter((x) => x.auftragsverarbeitung);
        if (av.length && av.every((x) => x.avv_datum || x.avv_vorhanden)) pflichten.push({ id: "datenschutz.avv" });
        const erledigt = await this.erledigen(tx, k, pflichten, dok.id, `Datenschutz-Dokumentation vom ${d.stand}`);
        return { dokument_id: dok.id, erledigte_pflichten: erledigt };
      })
      .catch(uebersetzeDbFehler);
  }

  // ------------------------------------------------------------ Betroffenenanfragen

  @MitUnternehmen()
  @Get("betroffenenanfragen")
  async anfragen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select *, (frist_am - $2::date) as tage_uebrig from app.betroffenenanfrage where unternehmen_id = $1
          order by (erledigt_am is not null), frist_am, eingang_am`,
        [k.unternehmenId, heute()],
      ),
    );
  }

  /** Eingang erfassen: Frist = Eingang + 1 Monat (F.59); meldet das Ereignis, aus dem die Pflicht entsteht. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("betroffenenanfragen")
  async anfrageAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(Anfrage, body);
    if (d.eingang_am > heute()) throw new UnprocessableEntityException({ meldung: "Der Eingang liegt in der Zukunft", fehler: [{ feld: "eingang_am", meldung: "nicht in der Zukunft" }] });
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const ereignis = await this.ereignis(tx, k, "betroffenenanfrage", d.eingang_am, { art: d.art });
        return tx.eine(
          `insert into app.betroffenenanfrage (unternehmen_id, eingang_am, art, person, frist_am, notiz, ereignis_id, erfasst_von)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
          [k.unternehmenId, d.eingang_am, d.art, d.person, plusMonate(d.eingang_am, 1), d.notiz, ereignis, k.kontoId],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  /** Beantwortet: erledigt die Pflicht des Eingangstags, wenn keine weitere Anfrage dieses Tages offen ist. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("betroffenenanfragen/:id/erledigen")
  async anfrageErledigen(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(z.object({ datum: DATUM, antwort: TEXT(2000) }).strict(), body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const a = await tx.eine<{ eingang_am: string; erledigt_am: string | null }>("select eingang_am, erledigt_am from app.betroffenenanfrage where id = $1 for update", [id]);
        if (!a) throw new NotFoundException("Anfrage nicht gefunden");
        if (a.erledigt_am) throw new ConflictException("Schon beantwortet");
        if (d.datum < a.eingang_am) throw new UnprocessableEntityException({ meldung: "Antwort vor dem Eingang", fehler: [{ feld: "datum", meldung: "nicht vor dem Eingang" }] });
        const r = await tx.eine("update app.betroffenenanfrage set erledigt_am = $2, antwort = $3 where id = $1 returning *", [id, d.datum, d.antwort]);
        const offen = await tx.eine("select 1 from app.betroffenenanfrage where unternehmen_id = $1 and eingang_am = $2 and erledigt_am is null", [k.unternehmenId, a.eingang_am]);
        const erledigt = offen ? 0 : await this.erledigen(tx, k, [{ id: "datenschutz.betroffenenanfrage", periode: `aenderung-${a.eingang_am.replaceAll("-", "")}` }], null, `Anfrage beantwortet am ${d.datum}`);
        return { ...r, erledigte_pflichten: erledigt };
      })
      .catch(uebersetzeDbFehler);
  }

  // ------------------------------------------------------------ Datenpannen

  @MitUnternehmen()
  @Get("datenpannen")
  async pannen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select id, entdeckt_am, beschreibung, risiko, gemeldet_am, abgeschlossen_am, entdeckt_am + interval '72 hours' as frist_bis
           from app.datenpanne where unternehmen_id = $1 order by (abgeschlossen_am is not null), entdeckt_am desc`,
        [k.unternehmenId],
      ),
    );
  }

  /** Notfallknopf: Panne sofort erfassen (Zeitpunkt der Entdeckung, kurze Beschreibung) – der Rest folgt. */
  @MitUnternehmen()
  @Post("datenpannen")
  async panneMelden(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(PanneNeu, body);
    const entdeckt = d.entdeckt_am ? new Date(d.entdeckt_am) : new Date();
    if (entdeckt.getTime() > Date.now() + 60_000) throw new UnprocessableEntityException({ meldung: "Der Zeitpunkt liegt in der Zukunft", fehler: [{ feld: "entdeckt_am", meldung: "nicht in der Zukunft" }] });
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const ereignis = await this.ereignis(tx, k, "datenpanne", ortsdatum(entdeckt), { bekannt_seit: entdeckt.toISOString() });
        return tx.eine(
          `insert into app.datenpanne (unternehmen_id, entdeckt_am, beschreibung, ereignis_id, erfasst_von) values ($1, $2, $3, $4, $5)
           returning *, entdeckt_am + interval '72 hours' as frist_bis`,
          [k.unternehmenId, entdeckt, d.beschreibung, ereignis, k.kontoId],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen()
  @Get("datenpannen/:id")
  async panne(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    const r = await this.db.imKontext(this.kontext(k), (tx) => tx.eine("select *, entdeckt_am + interval '72 hours' as frist_bis from app.datenpanne where id = $1", [id]));
    if (!r) throw new NotFoundException("Datenpanne nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("datenpannen/:id")
  async panneAendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(PanneAendern, body);
    if (d.risiko === "kein_risiko" && !d.begruendung) throw new UnprocessableEntityException({ meldung: "Begründe, warum voraussichtlich kein Risiko besteht", fehler: [{ feld: "begruendung", meldung: "Pflicht bei „kein Risiko“" }] });
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          `update app.datenpanne set beschreibung = $2, datenarten = $3, betroffene_anzahl = $4, folgen = $5, massnahmen = $6, risiko = $7, begruendung = $8
            where id = $1 and abgeschlossen_am is null returning *, entdeckt_am + interval '72 hours' as frist_bis`,
          [id, d.beschreibung, d.datenarten, d.betroffene_anzahl, d.folgen, d.massnahmen, d.risiko ?? null, d.begruendung],
        ),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Keine offene Datenpanne mit dieser ID");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("datenpannen/:id/gemeldet")
  async panneGemeldet(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(z.object({ gemeldet_am: Zeitpunkt, aktenzeichen: OPTIONAL(100) }).strict(), body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("update app.datenpanne set gemeldet_am = $2, aktenzeichen = $3 where id = $1 and abgeschlossen_am is null and gemeldet_am is null returning *", [id, d.gemeldet_am, d.aktenzeichen]),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Keine offene, ungemeldete Datenpanne mit dieser ID");
    return r;
  }

  private async panneLaden(tx: Tx, id: string) {
    const p = await tx.eine<Panne>("select * from app.datenpanne where id = $1", [id]);
    if (!p) throw new NotFoundException("Datenpanne nicht gefunden");
    return p;
  }

  private async pannePdf(tx: Tx, k: Anfragekontext, p: Panne) {
    const u = await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]);
    const konto = await tx.eine<{ anzeigename: string; email: string }>("select anzeigename, email from app.konto where id = $1", [k.kontoId]);
    return datenpanneMeldungPdf({
      unternehmen: u!.name, entdeckt_am: p.entdeckt_am.toISOString(), beschreibung: p.beschreibung, datenarten: p.datenarten, betroffene_anzahl: p.betroffene_anzahl,
      folgen: p.folgen, massnahmen: p.massnahmen, risiko: p.risiko, begruendung: p.begruendung, gemeldet_am: p.gemeldet_am?.toISOString() ?? null, aktenzeichen: p.aktenzeichen,
      kontakt: konto ? `${konto.anzeigename} <${konto.email}>` : "",
    });
  }

  /** Meldeentwurf als PDF (gegliedert nach Art. 33 Abs. 3 DSGVO) – Grundlage für das Portal der Aufsichtsbehörde. */
  @MitUnternehmen()
  @Get("datenpannen/:id/meldeentwurf")
  async meldeentwurf(@Kontext() k: Anfragekontext, @Param("id") id: string, @Res() res: Response) {
    pruefe(Uuid, id);
    const pdf = await this.db.imKontext(this.kontext(k), async (tx) => this.pannePdf(tx, k, await this.panneLaden(tx, id)));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="datenpanne-meldeentwurf.pdf"');
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  }

  /**
   * Abschließen: Bewertung nötig; bei Risiko muss die Meldung eingetragen sein. Die Dokumentation wird als PDF abgelegt
   * und erledigt die Meldepflicht dieses Tages (bei „kein Risiko“ als dokumentierte Entscheidung).
   */
  @MitUnternehmen(...SCHREIBEN)
  @Post("datenpannen/:id/abschliessen")
  async panneAbschliessen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const p = await this.panneLaden(tx, id);
        if (p.abgeschlossen_am) throw new ConflictException("Schon abgeschlossen");
        if (!p.risiko) throw new UnprocessableEntityException({ meldung: "Bewerte zuerst das Risiko für die Betroffenen", fehler: [{ feld: "risiko", meldung: "fehlt" }] });
        if (p.risiko !== "kein_risiko" && !p.gemeldet_am) throw new UnprocessableEntityException({ meldung: "Trag ein, wann du die Panne gemeldet hast", fehler: [{ feld: "gemeldet_am", meldung: "fehlt" }] });
        const pdf = await this.pannePdf(tx, k, p);
        const datum = ortsdatum(p.entdeckt_am);
        const dok = await dokumentAblegen(tx, this.ablage, {
          unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: `Datenpanne ${datum}`, art: "nachweis", quelle: "generiert", mime: "application/pdf", inhalt: pdf, endung: "pdf",
        });
        await tx.abfrage("update app.datenpanne set abgeschlossen_am = now() where id = $1", [id]);
        const offen = await tx.eine(
          "select 1 from app.datenpanne where unternehmen_id = $1 and abgeschlossen_am is null and (entdeckt_am at time zone 'Europe/Berlin')::date = $2::date",
          [k.unternehmenId, datum],
        );
        const erledigt = offen
          ? 0
          : await this.erledigen(tx, k, [{ id: "datenschutz.datenpanne_meldung", periode: `aenderung-${datum.replaceAll("-", "")}` }], dok.id, p.risiko === "kein_risiko" ? "Keine Meldung nötig (dokumentiert)" : `Gemeldet${p.aktenzeichen ? `, Az. ${p.aktenzeichen}` : ""}`);
        return { id, dokument_id: dok.id, erledigte_pflichten: erledigt };
      })
      .catch(uebersetzeDbFehler);
  }
}
