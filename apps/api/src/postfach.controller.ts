import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Put, UnprocessableEntityException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { Datenbank, dokumentAblegen, heute, type Ablage } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { ABLAGE } from "./finanzen.controller.js";
import { DATUM, pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { terminTitel, weitereTermine } from "./pflichten.controller.js";

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
const Uuid = z.string().uuid();
const ARTEN = ["bescheid", "mahnung", "anhoerung", "auskunftsersuchen", "sonstiges"] as const;
const FRISTARTEN = ["einspruch", "zahlung", "antwort", "sonstige"] as const;
const TYPEN: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

const Einordnung = z
  .object({
    eingang_am: DATUM,
    absender: z.string().trim().max(200).default(""),
    art: z.enum(ARTEN).default("sonstiges"),
    aktenzeichen: z.string().trim().max(100).default(""),
    frist_am: DATUM.nullable().optional(),
    frist_art: z.enum(FRISTARTEN).nullable().optional(),
    betrag_cent: z.number().int().min(0).max(1e12).nullable().optional(),
    pflicht_id: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/).nullable().optional(),
    notiz: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((d) => !d.frist_am || d.frist_art, { message: "Welche Frist? (z. B. Einspruch oder Zahlung)", path: ["frist_art"] });

interface Datei { originalname: string; mimetype: string; buffer: Buffer; size: number }

/**
 * Behörden-Postfach (6.11): Brief hochladen, einordnen (Absender, Art, Aktenzeichen, Frist aus dem Brief), mit Pflicht
 * verknüpfen. Fristen erscheinen auf „Heute“ und im Kalender. Erkennung per OCR/KI und E-Mail-Weiterleitung folgen
 * (E-101). Keine individuelle Prüfung des Bescheids (RDG, J-2) – nur allgemeine Erklärung der Briefart.
 */
@Controller("v1")
export class PostfachController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(ABLAGE) private readonly ablage: Ablage,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  /** Termine außerhalb des Katalogs für Kalender und „Heute“: Brieffristen und Geräteprüfungen. */
  @MitUnternehmen()
  @Get("termine")
  async termine(@Kontext() k: Anfragekontext) {
    const liste = await this.db.imKontext(this.kontext(k), (tx) => weitereTermine(tx, k.unternehmenId!));
    return liste.map((w) => ({ ...w, titel: terminTitel(w, k.sprache) }));
  }

  @MitUnternehmen()
  @Get("briefe")
  async briefe(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select b.*, b.betrag_cent::float8 as betrag_cent, d.titel as datei_titel, d.mime, (b.frist_am - $2::date) as tage_bis_frist
           from app.behoerdenbrief b join app.dokument d on d.id = b.dokument_id
          where b.unternehmen_id = $1 order by (b.erledigt_am is not null), b.frist_am nulls last, b.eingang_am desc`,
        [k.unternehmenId, heute()],
      ),
    );
  }

  /** Hochladen (PDF, JPG, PNG bis 15 MB); Eingang = heute, Einordnung danach. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("briefe")
  @UseInterceptors(FileInterceptor("datei", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  async hochladen(@Kontext() k: Anfragekontext, @UploadedFile() datei: Datei | undefined) {
    if (!datei) throw new BadRequestException("Datei fehlt (Feld „datei“)");
    const endung = TYPEN[datei.mimetype];
    const kopf = datei.buffer.subarray(0, 8);
    const passt =
      (endung === "pdf" && kopf.subarray(0, 5).toString() === "%PDF-") ||
      (endung === "png" && kopf.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (endung === "jpg" && kopf[0] === 0xff && kopf[1] === 0xd8);
    if (!endung || !passt) throw new UnprocessableEntityException({ meldung: "Nur PDF, JPG oder PNG", fehler: [{ feld: "datei", meldung: "Dateityp nicht erlaubt oder Inhalt passt nicht" }] });
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const dok = await dokumentAblegen(tx, this.ablage, {
          unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: datei.originalname.slice(0, 200) || "Behördenbrief", art: "behoerdenbrief", quelle: "upload", mime: datei.mimetype, inhalt: datei.buffer, endung,
        });
        const doppelt = await tx.eine("select 1 from app.behoerdenbrief where dokument_id = $1", [dok.id]);
        if (doppelt) throw new UnprocessableEntityException({ meldung: "Dieser Brief ist schon im Postfach", fehler: [{ feld: "datei", meldung: "doppelt" }] });
        return tx.eine("insert into app.behoerdenbrief (unternehmen_id, dokument_id, eingang_am, erfasst_von) values ($1, $2, $3, $4) returning *", [k.unternehmenId, dok.id, heute(), k.kontoId]);
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen()
  @Get("briefe/:id")
  async brief(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    const r = await this.db.imKontext(this.kontext(k), (tx) =>
      tx.eine("select b.*, b.betrag_cent::float8 as betrag_cent, d.titel as datei_titel, d.mime from app.behoerdenbrief b join app.dokument d on d.id = b.dokument_id where b.id = $1", [id]),
    );
    if (!r) throw new NotFoundException("Brief nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("briefe/:id")
  async einordnen(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Einordnung, body);
    const r = await this.db
      .imKontext(this.kontext(k), async (tx) => {
        if (d.pflicht_id && !(await tx.eine("select 1 from katalog.pflicht where id = $1", [d.pflicht_id])))
          throw new UnprocessableEntityException({ meldung: "Unbekannte Pflicht", fehler: [{ feld: "pflicht_id", meldung: "nicht im Katalog" }] });
        return tx.eine(
          `update app.behoerdenbrief set eingang_am = $2, absender = $3, art = $4, aktenzeichen = $5, frist_am = $6, frist_art = $7, betrag_cent = $8, pflicht_id = $9, notiz = $10
            where id = $1 returning *, betrag_cent::float8 as betrag_cent`,
          [id, d.eingang_am, d.absender, d.art, d.aktenzeichen, d.frist_am ?? null, d.frist_am ? d.frist_art : null, d.betrag_cent ?? null, d.pflicht_id ?? null, d.notiz ?? null],
        );
      })
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Brief nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("briefe/:id/erledigt")
  async erledigt(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const { datum } = pruefe(z.object({ datum: DATUM.nullable() }).strict(), body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) => tx.eine("update app.behoerdenbrief set erledigt_am = $2 where id = $1 returning *", [id, datum]))
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Brief nicht gefunden");
    return r;
  }
}
